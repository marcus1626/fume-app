// The brand's own pictures in the Library (FLOWS §38, DECIDED 13 Nov 2026): the Engine's read of a shoot, an
// expert's check of the picks, and a checked pick becoming a creative in a campaign.
import { expect, test } from "vitest";
import type { OwnPicture } from "../src/contract";
import {
  NEAR,
  hashDistance,
  nearestFormat,
  readShoot,
  sortOf,
  summarise,
  type PictureProbe,
} from "../src/domain/shoot";
import { createMockApi } from "../src/mock/mockApi";

const photo = (n: number): Pick<OwnPicture, "id" | "number" | "kind"> => ({ id: `p${n}`, number: n, kind: "photo" });
const probe = (over: Partial<PictureProbe> = {}): PictureProbe => ({
  sharpness: 20,
  light: 0.45,
  contrast: 0.2,
  blown: 0,
  hash: "0000000000000000",
  ...over,
});
/** A fingerprint of its own for picture i, far from every other one (the bits spread by the golden ratio). */
const spread = (i: number) => ((BigInt(i + 1) * 0x9e3779b97f4a7c15n) % 2n ** 64n).toString(16).padStart(16, "0");
/** The same fingerprint with its last n bits turned over: a near copy. */
const near = (hash: string, n: number) =>
  (BigInt(`0x${hash}`) ^ (n ? 2n ** BigInt(n) - 1n : 0n)).toString(16).padStart(16, "0");

test("hashDistance counts the bits two fingerprints differ in", () => {
  expect(hashDistance("0000000000000000", "0000000000000000")).toBe(0);
  expect(hashDistance("0000000000000000", "000000000000000f")).toBe(4);
  expect(hashDistance("ffffffffffffffff", "0000000000000000")).toBe(64);
  expect(hashDistance(near(spread(1), 3), spread(1))).toBe(3);
  expect(hashDistance(spread(1), spread(2))).toBeGreaterThan(NEAR);
});

test("the read leaves out what cannot be used, and says why", () => {
  const pictures = [1, 2, 3, 4, 5, 6].map(photo);
  const probes = new Map<string, PictureProbe>([
    ["p1", probe({ hash: spread(1) })],
    ["p2", probe({ sharpness: 1, hash: spread(2) })],
    ["p3", probe({ blown: 0.5, hash: spread(3) })],
    ["p4", probe({ light: 0.05, hash: spread(4) })],
    ["p5", probe({ light: 0.97, hash: spread(5) })],
    ["p6", probe({ hash: spread(6) })],
  ]);
  const reads = readShoot(pictures, probes);
  expect(reads.get("p2")).toMatchObject({ sort: "out", sharp: false, why: expect.stringMatching(/^Soft/) });
  expect(reads.get("p3")).toMatchObject({ sort: "out", why: expect.stringMatching(/^Burnt out/) });
  expect(reads.get("p4")).toMatchObject({ sort: "out", why: expect.stringMatching(/dark/) });
  expect(reads.get("p5")).toMatchObject({ sort: "out", why: expect.stringMatching(/^Washed out/) });
  expect(reads.get("p1")?.sort).not.toBe("out");
});

test("of near copies the stronger stays and the other names it", () => {
  const pictures = [1, 2, 3].map(photo);
  const probes = new Map<string, PictureProbe>([
    ["p1", probe({ hash: spread(9) })],
    ["p2", probe({ light: 0.25, hash: near(spread(9), NEAR - 1) })],
    ["p3", probe({ hash: spread(10) })],
  ]);
  const reads = readShoot(pictures, probes);
  expect(reads.get("p2")).toMatchObject({ sort: "out", like: "p1", why: "Like 01, darker; 01 is better lit." });
  expect(reads.get("p1")?.sort).not.toBe("out");
  expect(reads.get("p3")?.sort).not.toBe("out");
});

test("the picks are the strongest third, at most eight; a clip is kept for the video editor", () => {
  const pictures = [
    ...Array.from({ length: 30 }, (_, i) => photo(i + 1)),
    { id: "c1", number: 31, kind: "clip" as const },
  ];
  const probes = new Map(
    pictures
      .filter((p) => p.kind === "photo")
      .map((p, i) => [p.id, probe({ light: 0.45 + (i % 2 ? 0.01 : -0.01) * i, hash: spread(i) })]),
  );
  const reads = readShoot(pictures, probes);
  expect([...reads.values()].filter((r) => r.sort === "pick")).toHaveLength(8);
  expect(reads.get("c1")).toMatchObject({ sort: "rest", why: "Kept for the video editor." });
  // the best lit are among the picks
  expect(reads.get("p1")?.sort).toBe("pick");
});

test("a photograph with no look of its own (no canvas) is kept for later", () => {
  const reads = readShoot([photo(1)], new Map());
  expect(reads.get("p1")).toMatchObject({ sort: "rest", why: "Kept for later." });
});

test("a picture's shape gives the nearest format", () => {
  expect(nearestFormat(800, 800)).toBe("square");
  expect(nearestFormat(640, 800)).toBe("feed");
  expect(nearestFormat(1080, 1920)).toBe("story");
});

test("Fume's people see the Engine's read at once; the customer sees it once an expert has checked it", async () => {
  const anna = createMockApi({ latency: 0, userId: "u-anna" });
  const list = await anna.shoots("w-lysne");
  expect(list.map((s) => s.name)).toEqual(["Autumn studio day", "Spring packshots"]);
  expect(list[0]).toMatchObject({ state: "read", counts: { photos: 22, clips: 2, picks: 8, out: 6 } });

  const maja = createMockApi({ latency: 0 });
  const [autumn, spring] = await maja.shoots();
  expect(autumn.counts.picks).toBe(0);
  expect((await maja.shoot("sh-autumn")).pictures.every((p) => !p.read)).toBe(true);
  expect(spring.counts.picks).toBe(6);
  expect((await maja.shoot("sh-spring")).pictures.some((p) => p.read?.sort === "pick")).toBe(true);
  // the same shoot summed up for a customer shows no picks until the check
  const full = await anna.shoot("sh-autumn");
  expect(summarise(full, true).counts.picks).toBe(0);
  expect(summarise(full, false).counts.picks).toBe(8);
});

test("an expert moves a picture and checks the picks; a move after the check opens it again", async () => {
  const anna = createMockApi({ latency: 0, userId: "u-anna" });
  let s = await anna.movePicture("sh-autumn-p6", "pick");
  expect(sortOf(s.pictures.find((p) => p.id === "sh-autumn-p6")!)).toBe("pick");
  await expect(anna.movePicture("sh-autumn-p23", "pick")).rejects.toThrow(/clip/);
  s = await anna.checkPicks("sh-autumn");
  expect(s).toMatchObject({ state: "checked", checkedBy: "u-anna" });
  s = await anna.movePicture("sh-autumn-p6", "rest");
  expect(s.state).toBe("read");
  expect(s.checkedBy).toBeUndefined();
});

test("the admin reads the Library but adds and checks nothing; a viewer adds nothing", async () => {
  const vera = createMockApi({ latency: 0, userId: "u-vera" });
  expect((await vera.shoots()).length).toBeGreaterThan(0);
  await expect(vera.checkPicks("sh-autumn")).rejects.toThrow(/expert/);
  await expect(
    vera.addShoot({
      workspaceId: "w-lysne",
      name: "X",
      rights: { people: "none" },
      files: [{ name: "a.jpg", src: "a.jpg", kind: "photo" }],
    }),
  ).rejects.toThrow(/admin/);
  const ida = createMockApi({ latency: 0, userId: "u-ida" });
  await expect(
    ida.addShoot({
      workspaceId: "w-lysne",
      name: "X",
      rights: { people: "none" },
      files: [{ name: "a.jpg", src: "a.jpg", kind: "photo" }],
    }),
  ).rejects.toThrow(/viewer/);
  // a customer checks nothing
  await expect(createMockApi({ latency: 0 }).checkPicks("sh-autumn")).rejects.toThrow();
});

test("a customer uploads a shoot; the Engine reads it and every photograph without a canvas is kept for later", async () => {
  const maja = createMockApi({ latency: 0 });
  const s = await maja.addShoot({
    workspaceId: "w-lysne",
    name: " Summer by the sea ",
    shotOn: "2026-07-01",
    rights: { photographer: " Ola ", people: "unsure" },
    files: [
      { name: "a.jpg", src: "a.jpg", kind: "photo", width: 1080, height: 1350 },
      { name: "b.mov", src: "b.mov", kind: "clip", seconds: 6 },
    ],
  });
  expect(s).toMatchObject({ name: "Summer by the sea", state: "reading", rights: { photographer: "Ola" } });
  expect(s.pictures.map((p) => p.id)).toEqual([`${s.id}-p1`, `${s.id}-p2`]);
  await new Promise((r) => setTimeout(r, 10));
  const [mine] = await maja.shoots();
  expect(mine).toMatchObject({ id: s.id, state: "read", counts: { photos: 1, clips: 1, picks: 0 } });
  await expect(
    maja.addShoot({ workspaceId: "w-lysne", name: "", rights: { people: "none" }, files: [] }),
  ).rejects.toThrow();
});

test("a checked pick becomes a creative in a campaign, with the photograph as its first version", async () => {
  const anna = createMockApi({ latency: 0, userId: "u-anna" });
  await expect(anna.useShootInCampaign({ shootId: "sh-autumn", campaignId: "c-winter" })).rejects.toThrow(
    /checks the picks/,
  );
  await anna.checkPicks("sh-autumn");
  await expect(anna.useShootInCampaign({ shootId: "sh-autumn", campaignId: "c-solv" })).rejects.toThrow(
    /another brand/,
  );
  const { documentIds } = await anna.useShootInCampaign({
    shootId: "sh-autumn",
    campaignId: "c-winter",
    pictureIds: ["sh-autumn-p1", "sh-autumn-p13", "sh-autumn-p2"],
  });
  // p2 is left out, so only the two picks are made
  expect(documentIds).toHaveLength(2);
  const doc = await anna.document(documentIds[0]);
  expect(doc.title).toBe("Autumn studio day 01");
  expect(doc.specs.format).toBe("feed");
  expect(doc.versions).toHaveLength(1);
  expect(doc.versions[0]).toMatchObject({
    number: 1,
    cost: 0,
    instruction: expect.stringMatching(/own photograph.*Ingrid Holm/),
  });
  const s = await anna.shoot("sh-autumn");
  expect(s.pictures.find((p) => p.id === "sh-autumn-p1")!.usedIn).toMatchObject([
    { campaignId: "c-winter", documentId: documentIds[0] },
  ]);
  expect((await anna.shoots("w-lysne"))[0].counts.used).toBe(2);
});

test("nothing from a shoot is used while nobody knows who is in it", async () => {
  const anna = createMockApi({ latency: 0, userId: "u-anna" });
  const s = await anna.addShoot({
    workspaceId: "w-lysne",
    name: "Staff party",
    rights: { people: "unsure" },
    files: [{ name: "a.jpg", src: "a.jpg", kind: "photo" }],
  });
  await new Promise((r) => setTimeout(r, 10));
  await anna.movePicture(`${s.id}-p1`, "pick");
  await anna.checkPicks(s.id);
  await expect(anna.useShootInCampaign({ shootId: s.id, campaignId: "c-winter" })).rejects.toThrow(
    /who is in the pictures/,
  );
});

test("rights can be resolved after upload; returning to unsure blocks every later use", async () => {
  const anna = createMockApi({ latency: 0, userId: "u-anna" });
  await anna.checkPicks("sh-autumn");
  await anna.updateShootRights("sh-autumn", { people: "unsure" });
  await expect(anna.useShootInCampaign({ shootId: "sh-autumn", campaignId: "c-winter" })).rejects.toThrow(/who is in/);
  await anna.updateShootRights("sh-autumn", { people: "released", photographer: " Ola " });
  expect((await anna.shoot("sh-autumn")).rights).toEqual({ people: "released", photographer: "Ola" });
  expect(
    (await anna.useShootInCampaign({ shootId: "sh-autumn", campaignId: "c-winter", pictureIds: ["sh-autumn-p1"] }))
      .documentIds,
  ).toHaveLength(1);
  await expect(
    createMockApi({ latency: 0, userId: "u-ida" }).updateShootRights("sh-autumn", { people: "none" }),
  ).rejects.toThrow(/viewer/);
});
