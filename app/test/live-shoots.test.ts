import { beforeEach, expect, test, vi } from "vitest";
import type { Live } from "../src/api/live/context";
import { shootCalls } from "../src/api/live/shoots";

const db = vi.hoisted(() => ({ command: vi.fn(), upload: vi.fn(), urls: vi.fn(), invoke: vi.fn() }));
vi.mock("../src/api/live/supabase", () => ({
  command: db.command,
  supabase: () => ({ functions: { invoke: db.invoke } }),
}));
vi.mock("../src/api/live/map", () => ({ uploadFile: db.upload, fileUrls: db.urls }));
const stored = () => ({
  id: "shoot",
  workspaceId: "w1",
  name: "Autumn",
  by: "u1",
  at: "2026-11-13T12:00:00Z",
  state: "reading",
  rights: { people: "unsure" },
  pictures: [
    {
      id: "p1",
      fileId: "f1",
      shootId: "shoot",
      workspaceId: "w1",
      number: 1,
      kind: "photo",
      name: "a.jpg",
      usedIn: [],
    },
  ],
});
function live(staffRole?: string, role = "owner", agency?: object): Live {
  return {
    me: async () => ({ id: "u1", staffRole, agency }),
    role: async () => role,
    workspaceId: async () => "w1",
    workspaces: async () => [{ id: "w1" }],
  } as unknown as Live;
}
beforeEach(() => {
  vi.resetAllMocks();
  db.invoke.mockResolvedValue({ data: { reading: true }, error: null });
  db.command.mockResolvedValue(stored());
  db.upload.mockResolvedValue("f1");
  db.urls.mockResolvedValue(new Map([["f1", { url: "signed-original" }]]));
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(new Blob(["original"], { type: "image/jpeg" }))),
  );
});
test("uploads original bytes as source material before atomically attaching them to a shoot", async () => {
  const api = shootCalls(live());
  const shoot = await api.addShoot({
    workspaceId: "w1",
    name: " Autumn ",
    rights: { people: "unsure" },
    files: [{ name: "a.jpg", src: "blob:original", kind: "photo", poster: "blob:poster", width: 800, height: 1000 }],
  });
  expect(db.upload).toHaveBeenCalledWith("w1", expect.any(Blob), {
    name: "a.jpg",
    purpose: "source",
    width: 800,
    height: 1000,
  });
  expect(db.command).toHaveBeenCalledWith("add_shoot", {
    p_workspace_id: "w1",
    p_name: "Autumn",
    p_shot_on: null,
    p_rights: { people: "unsure" },
    p_pictures: [{ fileId: "f1", kind: "photo", seconds: null }],
  });
  expect(shoot.pictures[0].src).toBe("signed-original");
  expect(shoot.pictures[0]).not.toHaveProperty("fileId");
  expect(shoot.pictures[0]).not.toHaveProperty("poster");
});
test("an upload failure never creates a partial shoot", async () => {
  db.upload.mockRejectedValue(new Error("Storage unavailable"));
  await expect(
    shootCalls(live()).addShoot({
      workspaceId: "w1",
      name: "X",
      rights: { people: "none" },
      files: [{ name: "a.jpg", src: "blob:original", kind: "photo" }],
    }),
  ).rejects.toThrow("Storage unavailable");
  expect(db.command).not.toHaveBeenCalled();
});
test("viewers and admins cannot upload; remote URLs are never treated as originals", async () => {
  const input = {
    workspaceId: "w1",
    name: "X",
    rights: { people: "none" as const },
    files: [{ name: "a.jpg", src: "https://external/a.jpg", kind: "photo" as const }],
  };
  for (const who of [live(undefined, "viewer"), live("admin"), live()])
    await expect(shootCalls(who).addShoot(input)).rejects.toThrow();
  expect(db.upload).not.toHaveBeenCalled();
});
test("rights edits persist the recorded release answer and replace the signed original links", async () => {
  await shootCalls(live()).updateShootRights("shoot", { photographer: "Ola", people: "released", until: "2027-01-01" });
  expect(db.command).toHaveBeenLastCalledWith("update_shoot_rights", {
    p_shoot_id: "shoot",
    p_rights: { photographer: "Ola", people: "released", until: "2027-01-01" },
  });
});
test("customer lists are scoped to their current workspace", async () => {
  db.command.mockResolvedValue([stored()]);
  const list = await shootCalls(live()).shoots("someone-else");
  expect(db.command).toHaveBeenCalledWith("list_shoots", { p_workspace_id: "w1" });
  expect(list[0]).toMatchObject({ counts: { photos: 1, picks: 0 }, cover: ["signed-original"] });
});
test("customers and agencies cannot start creatives; unknown people block Fume too", async () => {
  for (const who of [live(), live("expert", "owner", { organisationId: "agency" })])
    await expect(shootCalls(who).useShootInCampaign({ shootId: "shoot", campaignId: "c1" })).rejects.toMatchObject({
      code: "forbidden",
    });
  await expect(shootCalls(live("expert")).useShootInCampaign({ shootId: "shoot", campaignId: "c1" })).rejects.toThrow(
    /who is in/,
  );
});

test("large shoots resolve every original below PostgREST's row cap", async () => {
  const s = stored();
  s.pictures = Array.from({ length: 1001 }, (_, i) => ({
    ...s.pictures[0],
    id: `p${i}`,
    fileId: `f${i}`,
    number: i + 1,
  }));
  db.command.mockResolvedValue(s);
  db.urls.mockImplementation(async (ids: string[]) => new Map(ids.map((id) => [id, { url: `signed:${id}` }])));
  const result = await shootCalls(live()).shoot("shoot");
  expect(result.pictures).toHaveLength(1001);
  expect(result.pictures[1000].src).toBe("signed:f1000");
  expect(db.urls.mock.calls.every(([ids]) => ids.length <= 100)).toBe(true);
});

test("expert moves and checks persist through RPC and return freshly signed originals", async () => {
  const api = shootCalls(live("expert"));
  expect((await api.movePicture("p1", "pick")).pictures[0].src).toBe("signed-original");
  expect(db.command).toHaveBeenLastCalledWith("move_shoot_picture", { p_picture_id: "p1", p_sort: "pick" });
  await api.checkPicks("shoot");
  expect(db.command).toHaveBeenLastCalledWith("check_shoot_picks", { p_shoot_id: "shoot" });
});
test("use creates selected photo masters atomically and returns their Studio ids", async () => {
  const s = { ...stored(), state: "checked", rights: { people: "released" } };
  db.command.mockResolvedValueOnce(s).mockResolvedValueOnce({ documentIds: ["master1", "master2"] });
  const result = await shootCalls(live("expert")).useShootInCampaign({
    shootId: "shoot",
    campaignId: "c1",
    pictureIds: ["p1", "p2"],
  });
  expect(result).toEqual({ documentIds: ["master1", "master2"] });
  expect(db.command).toHaveBeenLastCalledWith("use_shoot_in_campaign", {
    p_shoot_id: "shoot",
    p_campaign_id: "c1",
    p_picture_ids: ["p1", "p2"],
  });
});
test("omitted selection asks the database for all picks; an empty selection stays empty", async () => {
  for (const pictureIds of [undefined, []]) {
    db.command
      .mockResolvedValueOnce({ ...stored(), rights: { people: "none" } })
      .mockResolvedValueOnce({ documentIds: [] });
    await shootCalls(live("expert")).useShootInCampaign({ shootId: "shoot", campaignId: "c1", pictureIds });
    expect(db.command).toHaveBeenLastCalledWith("use_shoot_in_campaign", {
      p_shoot_id: "shoot",
      p_campaign_id: "c1",
      p_picture_ids: pictureIds ?? null,
    });
  }
});
test("database denials propagate without creating a client-side creative", async () => {
  db.command.mockRejectedValueOnce(Object.assign(new Error("An expert checks the picks."), { code: "forbidden" }));
  await expect(shootCalls(live()).checkPicks("shoot")).rejects.toMatchObject({ code: "forbidden" });
});

test("a permitted upload starts shoot-read and answers immediately with reading; polling reads the stored result", async () => {
  const waiting = { ...stored(), rights: { people: "none" } };
  db.command.mockResolvedValue(waiting);
  const api = shootCalls(live());
  const result = await api.addShoot({
    workspaceId: "w1",
    name: "Autumn",
    rights: { people: "none" },
    files: [{ name: "a.jpg", src: "blob:original", kind: "photo" }],
  });
  expect(result.state).toBe("reading");
  expect(db.invoke).toHaveBeenCalledWith("shoot-read", { body: { shootId: "shoot" } });
  await api.shoot("shoot");
  expect(db.invoke).toHaveBeenCalledTimes(1);
  const read = { sort: "pick", sharp: true, why: "Sharp label and warm side light.", look: 92 };
  db.command.mockResolvedValue({ ...waiting, state: "read", pictures: waiting.pictures.map((p) => ({ ...p, read })) });
  expect((await api.shoot("shoot")).pictures[0].read).toEqual(read);
  expect(db.invoke).toHaveBeenCalledTimes(1);
});

test("blocked shoots never start reading; settling rights starts the waiting shoot", async () => {
  const api = shootCalls(live());
  await api.shoot("shoot");
  expect(db.invoke).not.toHaveBeenCalled();
  db.command.mockResolvedValue({ ...stored(), rights: { people: "none", until: "2000-01-01" } });
  await api.shoot("shoot");
  expect(db.invoke).not.toHaveBeenCalled();
  db.command.mockResolvedValue({ ...stored(), rights: { people: "released" } });
  await api.updateShootRights("shoot", { people: "released" });
  expect(db.invoke).toHaveBeenCalledTimes(1);
});

test("a worker failure preserves originals and retries after a minute; list polling starts waiting shoots", async () => {
  vi.useFakeTimers();
  try {
    db.invoke.mockRejectedValue(new Error("offline"));
    db.command.mockResolvedValue([{ ...stored(), rights: { people: "none" } }]);
    const api = shootCalls(live());
    expect((await api.shoots())[0].state).toBe("reading");
    await api.shoots();
    expect(db.invoke).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    await api.shoots();
    expect(db.invoke).toHaveBeenCalledTimes(2);
  } finally {
    vi.useRealTimers();
  }
});

test("tightening rights never starts reading with the previous rights", async () => {
  db.command.mockResolvedValueOnce({ ...stored(), rights: { people: "none" } }).mockResolvedValueOnce(stored());
  await shootCalls(live()).updateShootRights("shoot", { people: "unsure" });
  expect(db.invoke).not.toHaveBeenCalled();
});
