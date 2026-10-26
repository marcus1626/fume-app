// Contract tests on the mock: the rules the real backend must keep too (ARCHITECTURE §1, §5).
// Run: npm test.
/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "vitest";
import { createMockApi } from "../src/mock/mockApi";

const maja = () => createMockApi({ latency: 0 });
const anna = () => createMockApi({ latency: 0, userId: "u-anna" });

test("the customer never sees a creative before the expert has checked it (F-D025)", async () => {
  const api = maja();
  const view = await api.campaign("c-autumn");
  for (const c of view.creatives)
    assert.ok(["checked", "approved", "delivered", "changes_requested"].includes(c.current.state), c.id);
  assert.ok(view.directions.every((d) => !["making", "in_check"].includes(d.state)));
});

test("only checked creatives can be approved, and only by the approver (F-D077)", async () => {
  const api = maja();
  const view = await api.campaign("c-autumn");
  const checked = view.creatives.filter((c) => c.current.state === "checked").map((c) => c.current.id);
  const approved = await api.approve(checked);
  assert.equal(approved.length, checked.length);
  assert.ok(approved.every((v) => v.state === "approved" && v.approvedBy === "u-maja"));
  await assert.rejects(createMockApi({ latency: 0, userId: "u-jonas" }).approve(checked), /approver/);
});

test("the expert checks and never approves; a checked creative reaches the customer", async () => {
  const expert = anna();
  const queue = await expert.checkQueue();
  assert.ok(queue.length > 0);
  const first = queue.find((q) => q.check.state !== "held")!;
  const check = await expert.markChecked(first.check.id);
  assert.equal(check.state, "checked");
  const { creative } = await expert.creative(first.creative.id);
  assert.equal(creative.current.state, "checked");
  assert.equal(creative.current.approvedBy, undefined);
  await assert.rejects(maja().checkQueue(), /experts/);
});

test("a change request makes a new version and keeps the old one in the chain", async () => {
  const api = maja();
  const view = await api.campaign("c-autumn");
  const target = view.creatives.find((c) => c.current.state === "checked")!;
  const before = target.versions.length;
  const result = await api.requestChanges({
    versionId: target.current.id,
    pins: [{ x: 0.5, y: 0.5, text: "Warmer light" }],
    tags: ["mood"],
    text: "Warmer light",
  });
  assert.equal(result.usesRound, true);
  assert.equal(result.version.number, target.current.number + 1);
  assert.equal(result.version.state, "making");
  const after = (await api.campaign("c-autumn")).creatives.find((c) => c.id === target.id);
  assert.equal(after, undefined, "the new version is back with the Engine, so the customer does not see it");
  assert.ok(before >= 1);
});

test("a product mistake is Fume's correction and does not use a round", async () => {
  const api = maja();
  const view = await api.campaign("c-autumn");
  const target = view.creatives.find((c) => c.current.state === "checked")!;
  const result = await api.requestChanges({
    versionId: target.current.id,
    pins: [],
    tags: ["product"],
    text: "The cap is wrong",
  });
  assert.equal(result.usesRound, false);
});

test("home answers what waits for you", async () => {
  const home = await maja().home();
  assert.ok(home.waitingOnYou.some((w) => w.kind === "creatives" && w.campaignId === "c-autumn"));
  assert.ok(home.waitingOnYou.some((w) => w.kind === "question"));
  assert.ok(home.usage.creativeCap === 27);
});

test("v5: a moodboard can be started on the spot, with a written brief or on a campaign without one", async () => {
  const api = maja();
  const campaign = await api.orderBrief({
    name: "Test",
    goal: "A test",
    productIds: ["pr-oil"],
    collectionIds: [],
    channels: ["paid_social"],
    formats: ["feed"],
    notes: "",
    references: ["a.jpg", "b.jpg"],
    moodboard: { images: ["a.jpg", "b.jpg"] },
  });
  assert.ok(campaign.boardId);
  const board = await api.board(campaign.boardId!);
  assert.equal(board.kind, "campaign_moodboard");
  assert.deepEqual(
    board.items.map((i) => i.image),
    ["a.jpg", "b.jpg"],
  );
  const bf = await api.startMoodboard("c-bf", ["c.jpg"]);
  assert.equal((await api.campaign("c-bf")).campaign.boardId, bf.id);
});

test("v5: a Studio document can change its campaign, and its look sources start over", async () => {
  const api = anna();
  const doc = await api.updateDocument("doc-autumn-m3", { campaignId: "c-bf" });
  assert.equal(doc.campaignId, "c-bf");
  assert.deepEqual(doc.sources, {});
  const none = await api.updateDocument("doc-autumn-m3", { campaignId: undefined });
  assert.equal(none.campaignId, undefined);
});

// FLOWS §22: nothing is made before the customer approves the plan.
test("the Engine starts only after the customer approves the plan; the plan is checked first", async () => {
  {
    const api = maja();
    // Winter gifting: checked by Anna, waiting on Maja, nothing made.
    const winter = await api.plan("c-winter");
    assert.equal(winter?.state, "ready");
    assert.equal(winter?.checkedBy, "u-anna");
    assert.equal((await api.campaign("c-winter")).runs.filter((r) => r.state === "running").length, 0);
    const approved = await api.approvePlan("c-winter");
    assert.equal(approved.state, "approved");
    const after = await api.campaign("c-winter");
    assert.equal(after.campaign.stage, "masters");
    assert.equal(after.runs.find((r) => r.state === "running")?.purpose, "masters");
    // Undo puts it back, with nothing started.
    await api.undoApprovePlan("c-winter");
    assert.equal((await api.campaign("c-winter")).campaign.stage, "plan");
    // Black Friday is in check: Maja sees only that; Anna sees it whole and marks it checked.
    const bf = await api.plan("c-bf");
    assert.equal(bf?.state, "in_check");
    assert.equal(bf?.directions.length, 0);
    await assert.rejects(api.approvePlan("c-bf"), /isn.t ready/);
    const expert = anna();
    assert.ok(((await expert.plan("c-bf"))?.directions.length ?? 0) > 0);
    await assert.rejects(api.checkPlan("c-bf"), /expert/);
  }
});

// FLOWS §25: the expert's check of a plan is optional, so a written plan waits on the customer at once.
test("a sent brief becomes a plan that is written and then waits on the customer", async () => {
  const { vi } = await import("vitest");
  vi.useFakeTimers({ shouldAdvanceTime: true });
  try {
    const api = maja();
    await api.changeBrief("c-balm", { message: "Soft hands for the hour before sleep.", missing: [] });
    await api.sendBrief("c-balm");
    assert.equal((await api.plan("c-balm"))?.state, "writing");
    assert.equal((await api.campaign("c-balm")).campaign.stage, "plan");
    await vi.advanceTimersByTimeAsync(8000);
    const ready = await api.plan("c-balm");
    assert.equal(ready?.state, "ready");
    assert.ok((ready?.directions.length ?? 0) >= 1);
    const chosen = ready!.directions.find((d) => d.id === ready!.chosenDirectionId)!;
    assert.ok(chosen.creatives.some((c) => c.kind === "master"));
  } finally {
    vi.useRealTimers();
  }
});

// ── The agency (FLOWS §24, §26.8). The agency writes the brief and checks the plan; only the client approves the
// plan and the creatives.
const nora = () => createMockApi({ latency: 0, agency: true });

test("the agency sees its clients, recent first, and what waits on it", async () => {
  const api = nora();
  const session = await api.session();
  assert.equal(session.agency?.organisation.name, "Brygga Studio");
  assert.equal(session.agency?.role, "lead");
  const home = await api.agencyHome();
  assert.deepEqual(home.clients.map((c) => c.workspace.brandName).sort(), ["AURÉA", "HALM", "LYSNE", "VEV"]);
  assert.equal(home.clients[0].workspace.id, "w-lysne");
  assert.equal(home.clients.find((c) => c.workspace.id === "w-lysne")?.example, "full");
  assert.ok(home.needsYou.some((n) => n.kind === "plan" && n.href === "/campaigns/c-winter/plan"));
  await api.switchWorkspace("w-vev");
  assert.equal((await api.agencyClients())[0].workspace.id, "w-vev");
  await assert.rejects(createMockApi({ latency: 0 }).agencyHome(), /agency/);
});

test("in the agency's world Fume's expert is gone: the checks are the agency's and the plan needs no Fume check", async () => {
  const api = nora();
  const plan = await api.plan("c-winter");
  assert.equal(plan?.state, "ready");
  assert.equal(plan?.checkedBy, undefined);
  // Black Friday's plan: Nora checked it and sent it to Maja (both of the plan's states show in the demo).
  const bf = await api.plan("c-bf");
  assert.equal(bf?.state, "ready");
  assert.equal(bf?.checkedBy, "u-nora");
  const view = await api.campaign("c-autumn");
  const checkedBy = new Set(view.creatives.map((c) => c.current.checkedBy).filter(Boolean));
  assert.ok(!checkedBy.has("u-anna"));
  // FLOWS §26.8: the agency never approves the plan; only the client does.
  await assert.rejects(api.approvePlan("c-winter"), /Only Maja approves the plan/);
});

test("the agency checks the plan and sends it; the client approves it in Fume or in the campaign's one client link", async () => {
  const { vi } = await import("vitest");
  vi.useFakeTimers({ shouldAdvanceTime: true });
  try {
    const api = nora();
    // Before the agency sends it, the client sees where the plan is, not the plan, and cannot approve it.
    const maja = createMockApi({ latency: 0, agency: true, userId: "u-maja" });
    assert.equal((await maja.plan("c-winter"))?.directions.length, 0);
    await assert.rejects(maja.approvePlan("c-winter"), /checks the plan first/);
    // Sending the plan is the agency's check of it.
    const send = await api.sendToClient({
      campaignId: "c-winter",
      versionIds: [],
      to: ["u-maja"],
      link: true,
      plan: true,
      note: "Window light, as we said.",
    });
    assert.equal(send.plan?.version, 1);
    const checked = await api.plan("c-winter");
    assert.equal(checked?.state, "ready");
    assert.equal(checked?.checkedBy, "u-nora");
    assert.equal((await api.campaign("c-winter")).campaign.waits?.planChecked, true);
    // Once sent, the agency no longer changes it; it is with the client.
    await assert.rejects(api.changePlan("c-winter", { line: "light", value: "Colder light." }), /with Maja/);
    // The link opens the plan; the agency sees it as a preview and its answer never counts.
    const link = await api.clientLink(send.link!.token);
    assert.equal(link.plan?.campaignId, "c-winter");
    assert.equal(link.planSend?.note, "Window light, as we said.");
    await assert.rejects(
      api.answerClientPlan({ token: send.link!.token, verdict: "approve", name: "Nora" }),
      /preview/,
    );
    // The client asks for changes in the link: Fume writes version 2, and it is the agency's to check again.
    (api as typeof api & { signInAs(userId: string): void }).signInAs("u-maja");
    const asked = await api.answerClientPlan({
      token: send.link!.token,
      verdict: "changes",
      text: "The gift box closed on the first master",
      name: "Maja Lind",
    });
    assert.equal(asked.state, "changes_asked");
    await vi.advanceTimersByTimeAsync(3000);
    (api as typeof api & { signInAs(userId: string): void }).signInAs("u-nora");
    const second = await api.plan("c-winter");
    assert.equal(second?.version, 2);
    assert.equal(second?.state, "ready");
    assert.equal(second?.checkedBy, undefined);
    // Sent again, in the same link.
    const again = await api.sendToClient({
      campaignId: "c-winter",
      versionIds: [],
      to: ["u-maja"],
      link: true,
      plan: true,
    });
    assert.equal(again.link?.token, send.link?.token);
    // She approves it in the link: the Engine starts, and it is her approval.
    (api as typeof api & { signInAs(userId: string): void }).signInAs("u-maja");
    const approved = await api.answerClientPlan({ token: send.link!.token, verdict: "approve", name: "Maja Lind" });
    assert.equal(approved.state, "approved");
    assert.equal(approved.approvedBy, "u-maja");
    assert.equal(approved.checkedBy, "u-nora");
    assert.match(approved.approvedNote ?? "", /client link, by Maja Lind/);
    const run = (await api.campaign("c-winter")).runs.find((r) => r.id === "run-plan-c-winter");
    assert.equal(run?.steps[0].label, "Plan approved by Maja");
    // In Fume she approves Black Friday's plan, which Nora sent her.
    assert.equal((await maja.approvePlan("c-bf")).approvedBy, "u-maja");
  } finally {
    vi.useRealTimers();
  }
});

test("the agency never approves a creative: it sends it to the client, or records the client's approval", async () => {
  const api = nora();
  const view = await api.campaign("c-autumn");
  const checked = view.creatives.filter((c) => c.current.state === "checked").map((c) => c.current.id);
  assert.ok(checked.length >= 2);
  await assert.rejects(api.approve(checked), /Only the client approves/);
  // The demo starts with one earlier send (the first four creatives), so both send states show.
  const before = (await api.clientSends("c-autumn")).length;
  const send = await api.sendToClient({
    campaignId: "c-autumn",
    versionIds: checked,
    to: ["u-maja"],
    link: true,
    note: "Two for the launch.",
  });
  assert.ok(send.link?.url.endsWith(send.link.token));
  assert.equal((await api.clientSends("c-autumn")).length, before + 1);
  await assert.rejects(
    api.sendToClient({ campaignId: "c-autumn", versionIds: checked, to: ["u-even"], link: false }),
    /client's own people/,
  );
  const [one, two] = checked;
  const recorded = await api.recordClientApproval({
    versionIds: [one],
    clientUserId: "u-maja",
    note: "Maja said yes in our Monday meeting.",
  });
  assert.equal(recorded[0].approvedBy, "u-maja");
  assert.equal(recorded[0].recordedBy, "u-nora");
  const link = await api.clientLink(send.link!.token);
  assert.equal(link.agency.name, "Brygga Studio");
  // Signed in, the agency sees the link as a preview; its answer never counts as the client's.
  await assert.rejects(
    api.answerClientLink({ token: send.link!.token, versionId: two, verdict: "approve", name: "Maja" }),
    /preview/,
  );
  (api as typeof api & { signInAs(userId: string): void }).signInAs("u-maja"); // the client, on the same demo
  const answered = await api.answerClientLink({
    token: send.link!.token,
    versionId: two,
    verdict: "approve",
    name: "Maja",
  });
  assert.equal(answered.state, "approved");
  assert.equal(answered.approvedBy, "u-maja");
  // The client herself still approves as before.
  const maja = createMockApi({ latency: 0, agency: true, userId: "u-maja" });
  const left = (await maja.campaign("c-autumn")).creatives
    .filter((c) => c.current.state === "checked")
    .map((c) => c.current.id);
  if (left.length) assert.ok((await maja.approve(left)).every((v) => v.approvedBy === "u-maja"));
});

test("a sent brief in an agency's client becomes a plan with no Fume check", async () => {
  const { vi } = await import("vitest");
  vi.useFakeTimers({ shouldAdvanceTime: true });
  try {
    const api = nora();
    await api.changeBrief("c-balm", { message: "Soft hands for the hour before sleep.", missing: [] });
    await api.sendBrief("c-balm");
    await vi.advanceTimersByTimeAsync(3000);
    const ready = await api.plan("c-balm");
    assert.equal(ready?.state, "ready");
    assert.equal(ready?.checkedBy, undefined);
  } finally {
    vi.useRealTimers();
  }
});

// The client's flow (FLOWS §24.3, §24.5): Home in a client an agency runs.
test("in a client an agency runs, Home never asks the agency to approve a creative, and the client's Home keeps only her approvals", async () => {
  const agency = await nora().home();
  assert.ok(!agency.waitingOnYou.some((w) => w.kind === "creatives"), "checked creatives are the client's to approve");
  assert.ok(agency.waitingOnYou.some((w) => w.kind === "plan" && w.campaignId === "c-winter"));
  assert.ok(agency.waitingOnYou.some((w) => w.kind === "product"));
  // The plan the agency checked and sent (Black Friday) is hers too; the one it has not checked is not.
  assert.ok(
    !agency.waitingOnYou.some((w) => w.kind === "plan" && w.campaignId === "c-bf"),
    "a plan sent to the client waits on her",
  );
  const client = await createMockApi({ latency: 0, agency: true, userId: "u-maja" }).home();
  assert.deepEqual([...new Set(client.waitingOnYou.map((w) => w.kind))].sort(), ["creatives", "plan"]);
  assert.deepEqual(
    client.waitingOnYou.filter((w) => w.kind === "plan").map((w) => w.campaignId),
    ["c-bf"],
  );
  assert.ok(client.deliveries.length > 0);
  // Outside the agency's world Maja's Home is as it was.
  const own = await maja().home();
  assert.ok(own.waitingOnYou.some((w) => w.kind === "plan") && own.waitingOnYou.some((w) => w.kind === "creatives"));
});

test("a client link names each creative as the client reads it in Fume, never Master 1 · Variant 1", async () => {
  const api = nora();
  const checked = (await api.campaign("c-autumn")).creatives.filter((c) => c.current.state === "checked");
  const send = await api.sendToClient({
    campaignId: "c-autumn",
    versionIds: checked.map((c) => c.current.id),
    to: [],
    link: true,
  });
  const link = await api.clientLink(send.link!.token);
  const names = checked.map((c) => link.names?.[c.id]);
  // One name, copy.creativeName, without the direction's letter ("Night Body Oil · Feed 3").
  assert.ok(
    names.every((n) => n && /^Night Body Oil · (Feed|Story|Square) \d+$/.test(n)),
    names.join(", "),
  );
  assert.equal(new Set(names).size, names.length);
});
