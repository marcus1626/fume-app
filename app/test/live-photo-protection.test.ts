import { beforeEach, expect, test, vi } from "vitest";
import type { Live } from "../src/api/live/context";
import { readDocument, deskOf } from "../src/api/live/production";
import { studioCalls } from "../src/api/live/studio";

const db = vi.hoisted(() => ({ command: vi.fn(), engine: vi.fn(), rows: vi.fn(), urls: vi.fn() }));
vi.mock("../src/api/live/supabase", () => ({
  command: db.command,
  askEngine: db.engine,
  requestKey: () => "key",
  rows: db.rows,
  supabase: () => ({
    from: (table: string) => {
      const query = {
        table,
        filters: {} as Record<string, unknown>,
        select: vi.fn().mockReturnThis(),
        eq(key: string, value: unknown) {
          this.filters[key] = value;
          return this;
        },
        in(key: string, value: unknown) {
          this.filters[key] = value;
          return this;
        },
        order: vi.fn().mockReturnThis(),
      };
      return query;
    },
  }),
}));
vi.mock("../src/api/live/map", async (original) => ({
  ...(await original<typeof import("../src/api/live/map")>()),
  fileUrls: db.urls,
}));
vi.mock("../src/api/live/products", () => ({ readProducts: vi.fn() }));
const id = "11111111-1111-4111-8111-111111111111";
const live = { me: async () => ({ id: "expert", staffRole: "expert" }) } as unknown as Live;
let protectedPhoto = true;
beforeEach(() => {
  vi.clearAllMocks();
  protectedPhoto = true;
  deskOf(live, id).placements = { story: "ig-story" };
  db.urls.mockResolvedValue(new Map([["original", { url: "signed-original" }]]));
  db.rows.mockImplementation(
    async ({
      table,
      filters,
      select,
    }: {
      table: string;
      filters: Record<string, unknown>;
      select: ReturnType<typeof vi.fn>;
    }) => {
      if (table === "creatives") expect(select).toHaveBeenCalledWith(expect.stringContaining("protected_photo"));
      if (table === "creatives")
        return filters.master_id
          ? [{ id: "format", master_id: id, kind: "format", format: "story", title: "Story" }]
          : [
              {
                id,
                workspace_id: "workspace",
                campaign_id: "campaign",
                kind: "master",
                format: "feed",
                title: "Shoot original",
                protected_photo: protectedPhoto,
                created_at: "2026-11-13T12:00:00Z",
              },
            ];
      if (table === "creative_versions")
        return [
          {
            id: "version1",
            creative_id: id,
            number: 1,
            state: "making",
            file_id: "original",
            candidate_id: "v1",
            job_id: "job",
            created_at: "2026-11-13T12:00:00Z",
          },
        ];
      if (table === "production_jobs") return [{ id: "job", creative_id: id, mode: "manual", state: "succeeded" }];
      if (table === "candidates")
        return [{ id: "v1", job_id: "job", file_id: "original", origin: "manual", created_at: "2026-11-13T12:00:00Z" }];
      return [];
    },
  );
});
test.each([true, false])(
  "the real document and version mapping carries database protection %s",
  async (protectedValue) => {
    protectedPhoto = protectedValue;
    const { doc } = await readDocument(live, id);
    expect(doc.protectedPhoto ?? false).toBe(protectedValue);
    expect(doc.versions[0].protectedPhoto ?? false).toBe(protectedValue);
    expect(doc.versions[0].image).toBe("signed-original");
  },
);
test("live render refuses a protected photo before queuing or invoking the Engine", async () => {
  await expect(studioCalls(live).render(id)).rejects.toThrow(/Real people/);
  expect(db.command).not.toHaveBeenCalled();
  expect(db.engine).not.toHaveBeenCalled();
});
test("live product fix refuses arbitrary masks on protected people before invoking an image model", async () => {
  await expect(studioCalls(live).fixProduct(id, { versionId: "v1", what: "Change the face" })).rejects.toThrow(
    /Real people/,
  );
  expect(db.command).not.toHaveBeenCalled();
});
test.each(["expand", "regenerate"] as const)("live %s format is refused for protected people", async (method) => {
  await expect(studioCalls(live).setFormatTile(id, "ig-story", { method })).rejects.toThrow(/Real people/);
  expect(db.command).not.toHaveBeenCalled();
});
