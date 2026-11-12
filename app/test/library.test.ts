// The Library (FLOWS §37, PROPOSED 10 Nov 2026): everything made for a brand in one place, whatever stage it is at.
import { expect, test } from "vitest";
import { createMockApi } from "../src/mock/mockApi";

test("Fume's people get every creative of every brand, newest first, each at its stage", async () => {
  const items = await createMockApi({ latency: 0, userId: "u-anna" }).library();
  expect(items.length).toBeGreaterThan(0);
  expect(new Set(items.map((i) => i.workspaceId))).toEqual(new Set(["w-lysne", "w-solv"]));
  expect(items.map((i) => i.at)).toEqual([...items.map((i) => i.at)].sort().reverse());
  // A draft that never went to check is in it, in the Studio; checked work names its checker
  expect(items.some((i) => i.state === "studio" && i.kind === "draft" && i.documentId)).toBe(true);
  for (const i of items.filter((x) => x.state === "checked")) expect(i.checkedBy).toBeTruthy();
  // One waiting for a check carries its row in Check
  for (const i of items.filter((x) => x.state === "to_check")) expect(i.checkItemId).toBeTruthy();
});

test("one brand's Library holds that brand only", async () => {
  const items = await createMockApi({ latency: 0, userId: "u-anna" }).library("w-solv");
  expect(items.length).toBeGreaterThan(0);
  expect(items.every((i) => i.workspaceId === "w-solv")).toBe(true);
});

test("Fume's admin reads the Library too", async () => {
  const items = await createMockApi({ latency: 0, userId: "u-vera" }).library();
  expect(items.length).toBeGreaterThan(0);
});

test("an agency gets its own clients only", async () => {
  const agency = createMockApi({ latency: 0, agency: true });
  const clients = new Set((await agency.agencyClients()).map((c) => c.workspace.id));
  for (const i of await agency.library()) expect(clients.has(i.workspaceId)).toBe(true);
});

test("a customer's Library holds what reached them: approved and delivered, in their own brand (FLOWS §38.1)", async () => {
  const items = await createMockApi({ latency: 0 }).library("w-solv");
  expect(items.length).toBeGreaterThan(0);
  for (const i of items) {
    expect(i.workspaceId).toBe("w-lysne");
    expect(["approved", "delivered"]).toContain(i.state);
    // the ways into Fume's own places stay out
    expect(i.documentId).toBeUndefined();
    expect(i.checkItemId).toBeUndefined();
  }
});
