// Golden master for the mock backend: what every FumeApi call answers, for every demo person, and what each write
// leaves behind for the reads that follow it. The answers live in test/golden/*.txt, one line per call. A change in
// those files is a change in what the app sees, so rewrite them (`npx vitest run test/golden.test.ts -u`) only for a
// deliberate change, and read the diff first.
//
// It runs on a still clock: Date and the timers move only when a scenario says so (`advance`), so ids and times come
// out the same on every run. A call counts as answered once every timer due now has run, which settles the mock's
// latency and the writes it lands right after a call.
/// <reference types="node" />
import { createHash } from "node:crypto";
import { afterAll, beforeAll, expect, test } from "vitest";
import type { FumeApi, FumeEvent } from "../src/contract";
import { createMockApi, type MockOptions } from "../src/mock/mockApi";

// ── The still clock ──────────────────────────────────────────────────────────

/** Nine days after the seed's moment, so a timestamp taken from the real clock instead of the mock's shows. */
const START = Date.parse("2026-10-23T09:00:00Z");
let clock = START;

interface Timer {
  id: number;
  at: number;
  order: number;
  run: () => void;
  every?: number;
}
const timers = new Map<number, Timer>();
let timerSeq = 0;

const RealDate = Date;
class StillDate extends RealDate {
  constructor(...args: [] | [string | number | Date]) {
    super(args.length === 1 ? args[0] : clock);
  }
  static now() {
    return clock;
  }
}

function addTimer(run: () => void, ms: number | undefined, repeat: boolean) {
  const id = (timerSeq += 1);
  const delay = Math.max(0, Number(ms) || 0);
  timers.set(id, { id, at: clock + delay, order: id, run, every: repeat ? delay : undefined });
  return id;
}

/** Lets every pending promise callback run: setImmediate stays real and fires after all of them. */
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

/** Runs every timer due by `until`, earliest first (ties in the order they were set), with promise callbacks after each. */
async function runTimers(until: number) {
  for (let n = 0; n < 500_000; n++) {
    await flush();
    let next: Timer | undefined;
    for (const t of timers.values())
      if (t.at <= until && (!next || t.at < next.at || (t.at === next.at && t.order < next.order))) next = t;
    if (!next) {
      clock = Math.max(clock, until);
      return;
    }
    clock = Math.max(clock, next.at);
    if (next.every === undefined) timers.delete(next.id);
    else Object.assign(next, { at: next.at + next.every, order: (timerSeq += 1) });
    next.run();
  }
  throw new Error("The mock's timers never settle");
}

// ── Downloads: fetch and object URLs, made repeatable ───────────────────────

const blobs: Blob[] = [];
const real = {
  Date,
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
  setInterval: globalThis.setInterval,
  clearInterval: globalThis.clearInterval,
  fetch: globalThis.fetch,
  createObjectURL: URL.createObjectURL,
};

beforeAll(() => {
  const g = globalThis as unknown as Record<string, unknown>;
  g.Date = StillDate;
  g.setTimeout = (run: () => void, ms?: number) => addTimer(run, ms, false);
  g.setInterval = (run: () => void, ms?: number) => addTimer(run, ms, true);
  g.clearTimeout = g.clearInterval = (id: unknown) => void timers.delete(id as number);
  // An image's bytes are its own path, so a zip's contents follow from the creatives in it.
  g.fetch = async (url: string) => ({
    ok: true,
    arrayBuffer: async () => new TextEncoder().encode(String(url)).buffer,
  });
  URL.createObjectURL = (blob: Blob) => `blob:golden/${blobs.push(blob) - 1}`;
});

afterAll(() => {
  Object.assign(globalThis, real);
  URL.createObjectURL = real.createObjectURL;
});

/** A zip the mock packed, as the names inside it plus its size and hash. */
async function describeBlob(url: string) {
  const bytes = new Uint8Array(await blobs[Number(url.slice("blob:golden/".length))]!.arrayBuffer());
  const view = new DataView(bytes.buffer);
  const names: string[] = [];
  for (let at = 0; at + 30 <= bytes.length && view.getUint32(at, true) === 0x04034b50;) {
    const nameLength = view.getUint16(at + 26, true);
    names.push(new TextDecoder().decode(bytes.subarray(at + 30, at + 30 + nameLength)));
    at += 30 + nameLength + view.getUint32(at + 18, true);
  }
  return { zip: names, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex").slice(0, 16) };
}

// ── Recording ────────────────────────────────────────────────────────────────

/** Every member a mock instance has, and the ones this file calls. */
let members: string[] = [];
const covered = new Set<string>();

/** JSON with sorted keys, so the same answer always reads the same. */
const stable = (value: unknown): string =>
  JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
        )
      : v,
  ) ?? "undefined";

const short = (value: unknown) => {
  const s = stable(value);
  return s.length > 140 ? `${s.slice(0, 137)}...` : s;
};

/** Like JSON, but a value that does not fit a 120-character line breaks over lines, so a diff shows what changed. */
function pretty(value: unknown, pad = "  "): string {
  const flat = stable(value);
  if (value === null || typeof value !== "object" || flat.length + pad.length <= 120) return flat;
  const inner = `${pad}  `;
  if (Array.isArray(value))
    return `[\n${value.map((v) => inner + (v === undefined ? "null" : pretty(v, inner))).join(",\n")}\n${pad}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined && typeof v !== "function")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{\n${entries.map(([k, v]) => `${inner}${JSON.stringify(k)}: ${pretty(v, inner)}`).join(",\n")}\n${pad}}`;
}

type Recorded<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => Promise<infer R> ? (...args: A) => Promise<R | undefined> : never;
};

type Api = FumeApi & { signInAs(userId: string): void };

/** One golden file: a line per call with its answer under it; an answer given before points back to the first. */
class Golden {
  lines: string[] = [];
  private seen = new Map<string, string>();
  constructor(readonly name: string) {}

  write(label: string, value: unknown) {
    const json = stable(value);
    const first = this.seen.get(json);
    this.lines.push(label);
    if (first && json.length > 80) this.lines.push(`  = ${first}`);
    else {
      this.seen.set(json, label);
      this.lines.push(`  ${pretty(value)}`);
    }
  }

  note(text: string) {
    this.lines.push(`-- ${text}`);
  }

  /** A demo person on a mock of their own. */
  open(who: string, options: MockOptions) {
    this.note(`${who}: createMockApi(${short({ latency: 0, ...options })})`);
    return new Person(this, who, options);
  }

  async check() {
    await expect(this.lines.join("\n") + "\n").toMatchFileSnapshot(`./golden/${this.name}.txt`);
  }
}

class Person {
  readonly api: Api;
  /** The api, recorded: each call writes its answer (or its error) and the events it caused. */
  readonly call: Recorded<FumeApi>;
  private events: string[] = [];

  constructor(
    readonly golden: Golden,
    public who: string,
    options: MockOptions,
  ) {
    this.api = createMockApi({ latency: 0, ...options }) as Api;
    if (!members.length) members = Object.keys(this.api).filter((k) => k !== "signInAs");
    covered.add("subscribe");
    this.api.subscribe((event: FumeEvent) => this.events.push(stable(event)));
    this.call = new Proxy({} as Recorded<FumeApi>, {
      get: (_target, name: string) => {
        covered.add(name);
        return (...args: unknown[]) =>
          this.record(`${this.who} ${name}(${args.map(short).join(", ")})`, () =>
            (this.api as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[name]!(...args),
          );
      },
    });
  }

  private async record<T>(label: string, run: () => Promise<T>): Promise<T | undefined> {
    let answer: { ok: T } | { error: unknown } | undefined;
    try {
      run().then(
        (ok) => (answer = { ok }),
        (error: unknown) => (answer = { error }),
      );
    } catch (error) {
      answer = { error };
    }
    await runTimers(clock);
    if (!answer) throw new Error(`${label} never answered`);
    this.writeEvents(label);
    if ("error" in answer) {
      const e = answer.error as { name?: string; code?: string; message?: string };
      this.golden.write(label, { error: e.code ?? e.name, message: e.message });
      return undefined;
    }
    const ok = answer.ok;
    this.golden.write(label, typeof ok === "string" && ok.startsWith("blob:golden/") ? await describeBlob(ok) : ok);
    return ok;
  }

  private writeEvents(label: string) {
    if (!this.events.length) return;
    this.golden.lines.push(`${label} → events`, ...this.events.map((e) => `  ${pretty(JSON.parse(e))}`));
    this.events = [];
  }

  /** Lets the clock run on: the writes Fume lands later (a plan written, a check done, the Engine's tick). */
  async advance(ms: number) {
    await runTimers(clock + ms);
    this.golden.note(`${ms / 1000} s later`);
    this.writeEvents(`${this.who}, ${ms / 1000} s later`);
  }

  /** The demo's "View as": the same mock, signed in as someone else. */
  signInAs(who: string, userId: string) {
    this.api.signInAs(userId);
    this.who = who;
    this.golden.note(`signed in as ${who}`);
  }
}

// ── Ids to ask about ─────────────────────────────────────────────────────────
// Gathered from the seed's own answers (the expert sees every brand; the agency sees its clients), so every person is
// asked about the same things, including what they may not see.

interface Universe {
  campaigns: string[];
  workspaces: string[];
  creatives: string[];
  products: string[];
  collections: string[];
  deliveries: string[];
  threads: string[];
  checks: string[];
  boards: string[];
  documents: string[];
  sessions: string[];
  tokens: string[];
}

const unique = (ids: (string | undefined)[]) => [...new Set(ids.filter((id): id is string => !!id))];

async function gatherIds(): Promise<Universe> {
  const scratch = new Golden("scratch");
  const anna = scratch.open("anna", { userId: "u-anna" }).call;
  const maja = scratch.open("maja", {}).call;
  const nora = scratch.open("nora", { agency: true }).call;
  const brands = (await anna.allBrands())?.brands ?? [];
  const clients = (await nora.agencyClients()) ?? [];
  const workspaces = unique([
    ...brands.map((b) => b.workspace.id),
    ...clients.map((c) => c.workspace.id),
    ...((await maja.session())?.workspaces ?? []).map((w) => w.id),
  ]);
  const campaigns = unique([
    ...((await maja.campaigns()) ?? []).map((c) => c.id),
    ...((await anna.campaigns()) ?? []).map((c) => c.id),
    ...((await anna.studioCampaigns()) ?? []).map((r) => r.campaign.id),
    ...((await nora.agencyCampaigns()) ?? []).map((r) => r.campaign.id),
  ]);
  const creatives: string[] = [];
  const tokens: (string | undefined)[] = [];
  for (const id of campaigns) {
    creatives.push(...((await anna.creatives(id)) ?? []).map((c) => c.id));
    tokens.push(...((await nora.clientSends(id)) ?? []).map((s) => s.link?.token));
  }
  const documents: string[] = [];
  const sessions: string[] = [];
  for (const id of workspaces) {
    documents.push(...((await anna.documents(id)) ?? []).map((d) => d.id));
    sessions.push(...((await anna.brandWorkspace(id))?.sessions ?? []).map((s) => s.id));
  }
  const catalogue = await maja.catalogue();
  return {
    campaigns: [...campaigns, "c-nope"],
    workspaces: [...workspaces, "w-nope"],
    creatives: unique(creatives),
    products: [...(catalogue?.products ?? []).map((p) => p.id), "pr-nope"],
    collections: (catalogue?.collections ?? []).map((c) => c.id),
    deliveries: unique([...((await maja.deliveries()) ?? []).map((d) => d.id), "dl-nope"]),
    threads: unique([...((await maja.threads()) ?? []), ...((await anna.threads()) ?? [])].map((t) => t.id)),
    checks: ((await anna.checkQueue()) ?? []).map((q) => q.check.id),
    boards: ((await maja.boards()) ?? []).map((b) => b.id),
    documents: unique(documents),
    sessions: unique(sessions),
    tokens: unique([...tokens, "bfplan", "no-such-link"]),
  };
}

// ── Every read, as one person ────────────────────────────────────────────────

async function readEverything(p: Person, ids: Universe) {
  const a = p.call;
  await a.session();
  await a.home();
  await a.brandDna();
  await a.campaigns();
  await a.campaigns({ state: ["in_review", "in_production"] });
  await a.campaigns({ search: "gift" });
  await a.reviewQueue();
  await a.deliveries();
  await a.threads();
  await a.team();
  await a.people();
  await a.settings();
  await a.notifications();
  await a.checkQueue();
  await a.studioCampaigns();
  await a.qualityLog();
  await a.teamLoad();
  await a.brandScan();
  await a.brandBoard();
  await a.catalogue();
  await a.boards();
  await a.allBrands();
  await a.studioModes();
  await a.brandAssets();
  await a.qaQueue();
  await a.tasteTraining();
  await a.conversation();
  await a.batches();
  await a.placements();
  await a.usage();
  await a.meetingSlots();
  await a.meetings();
  await a.calendar({ from: "2026-10-01T00:00:00Z", to: "2026-12-31T00:00:00Z" });
  await a.productKinds();
  await a.brandUpdate();
  const job = await a.productImport();
  if (job) await a.importJob(job.id);
  await a.importJob("ij-nope");
  await a.questions();
  await a.onboardingProgress();
  await a.agencyHome();
  await a.agencyClients();
  await a.agencyCampaigns();
  await a.agencyTeam();
  await a.licence();
  await a.briefTemplates();
  await a.briefAlternatives({ part: "brief", goal: "Launch the new oil for the dark months", productIds: ["pr-oil"] });
  await a.briefAlternatives({ part: "message", goal: "Gifts for winter", audience: "People who buy gifts", round: 2 });
  await a.agencyPlan();
  await a.meetingTopics();
  for (const id of ids.campaigns) {
    await a.campaign(id);
    await a.creatives(id);
    await a.creatives(id, { kind: "master" });
    await a.creatives(id, { state: ["checked", "approved"], format: ["feed"] });
    await a.plan(id);
    await a.ratings(id);
    await a.clientSends(id);
    await a.batches(id);
  }
  for (const id of ids.creatives) {
    await a.creative(id);
    await a.reviewComments(id);
  }
  for (const id of ids.products) {
    await a.product(id);
    await a.detailTokens(id);
    await a.productProposals(id);
  }
  for (const id of ids.collections) await a.collection(id);
  for (const id of ids.deliveries) {
    await a.delivery(id);
    await a.downloadUrl(id);
    await a.downloadUrl(id, "story");
  }
  for (const id of ids.threads) await a.messages(id);
  await a.messages("t-nope");
  for (const id of ids.checks) await a.check(id);
  for (const id of ids.boards) await a.board(id);
  for (const id of ids.workspaces) {
    await a.brandWorkspace(id);
    await a.studioKit(id);
    await a.documents(id);
    await a.brandAssets(id);
    await a.qaQueue(id);
    await a.lookPresets(id);
    await a.engineChat(id);
  }
  for (const id of ids.documents) await a.document(id);
  for (const id of ids.sessions) await a.studioSession(id);
  for (const token of ids.tokens) await a.clientLink(token);
}

// ── The tests ────────────────────────────────────────────────────────────────

let ids: Universe;

beforeAll(async () => {
  ids = await gatherIds();
});

/** The demo's people (FLOWS §1): the brand's own team, Fume's staff, a first run, and an agency with its client. */
const people: [who: string, options: MockOptions][] = [
  ["maja", {}],
  ["jonas", { userId: "u-jonas" }],
  ["ida", { userId: "u-ida" }],
  ["anna", { userId: "u-anna" }],
  ["sander", { userId: "u-sander" }],
  ["vera", { userId: "u-vera" }],
  ["maja (first run)", { fresh: true }],
  ["nora", { agency: true }],
  ["even", { agency: true, userId: "u-even" }],
  ["maja (agency's client)", { agency: true, userId: "u-maja" }],
  ["jonas (agency's client)", { agency: true, userId: "u-jonas" }],
];

test("every read, as every demo person", async () => {
  const golden = new Golden("reads");
  for (const [who, options] of people) await readEverything(golden.open(who, options), ids);
  await golden.check();
});

// ── Writes, and what the reads say after them ────────────────────────────────
// Each scenario starts from a fresh demo and follows one flow the app offers, then reads what it changed.

function scenario(name: string, run: (golden: Golden) => Promise<void>) {
  test(`writes: ${name}`, async () => {
    const golden = new Golden(`write-${name.replace(/ /g, "-")}`);
    await run(golden);
    await golden.check();
  });
}

const checkedIn = async (p: Person, campaignId: string) =>
  ((await p.call.campaign(campaignId))?.creatives ?? []).filter((c) => c.current.state === "checked");

scenario("review", async (golden) => {
  const maja = golden.open("maja", {});
  const a = maja.call;
  const checked = await checkedIn(maja, "c-autumn");
  const [v1, v2, v3, v4, v5, v6] = checked.map((c) => c.current.id);
  await golden.open("jonas", { userId: "u-jonas" }).call.approve([v1!]);
  await a.approve([v1!, v2!]);
  await a.approve([v1!]);
  await a.approve(["v-cr-a-v7-9"]);
  await a.unapprove([v1!]);
  await a.unapprove([v3!]);
  await a.creative(checked[0]!.id);
  const changed = await a.requestChanges({
    versionId: v3!,
    pins: [{ x: 0.4, y: 0.6, text: "Warmer light on the bottle" }],
    tags: ["mood", "colour"],
    text: "Warmer, like the hour before sleep",
  });
  await a.campaign("c-autumn");
  if (changed)
    await a.withdrawChangeRound({ campaignId: "c-autumn", versionIds: [changed.version.id], usedRound: true });
  await a.requestChanges({ versionId: v4!, pins: [], tags: ["product"], text: "The cap is matte burgundy" });
  await a.requestChangeRound({
    campaignId: "c-autumn",
    items: [
      { versionId: v5!, text: "Less text", pins: [], tags: ["text"] },
      {
        versionId: v6!,
        text: "More air above the bottle",
        pins: [{ x: 0.5, y: 0.2, text: "Here" }],
        tags: ["composition"],
      },
    ],
  });
  await a.campaign("c-autumn");
  await a.reviewQueue();
  await a.home();
  await a.notifications();
  const comment = await a.addReviewComment({
    creativeId: "cr-a-m1",
    versionId: "v-cr-a-m1-1",
    text: "Lovely light",
    pin: { x: 0.3, y: 0.3 },
  });
  if (comment) {
    await a.addReviewComment({ creativeId: "cr-a-m1", versionId: "v-cr-a-m1-1", text: "Agreed", replyTo: comment.id });
    await a.resolveReviewComment(comment.id);
  }
  await a.reviewComments("cr-a-m1");
  await a.rate({ creativeId: "cr-a-m1", versionId: "v-cr-a-m1-1", stars: 5 });
  await a.rate({ creativeId: "cr-a-m2", versionId: "v-cr-a-m2-2", stars: 2 });
  await a.ratings("c-autumn");
  await a.markRead(["n1"]);
  await a.markRead("all");
  await a.notifications();
  await maja.advance(13_000);
  await a.campaign("c-autumn");
});

scenario("delivery", async (golden) => {
  const maja = golden.open("maja", {});
  const a = maja.call;
  await a.approve((await checkedIn(maja, "c-autumn")).map((c) => c.current.id));
  await a.campaign("c-autumn");
  const delivery = await a.makeDelivery({ campaignId: "c-autumn" });
  await a.makeDelivery({ campaignId: "c-autumn", collectionId: "cl-aw26" });
  await a.makeDelivery({ campaignId: "c-winter" });
  if (delivery) {
    await a.delivery(delivery.id);
    await a.downloadUrl(delivery.id);
    await a.downloadUrl(delivery.id, "feed");
    await a.confirmLive(delivery.id);
  }
  await a.confirmLive("dl-autumn-m");
  await a.deliveries();
  await a.home();
  await a.collection("cl-aw26");
});

scenario("brand", async (golden) => {
  const maja = golden.open("maja", {});
  const a = maja.call;
  const dna = await a.brandDna();
  const rule = dna?.rules[0];
  if (rule) await a.updateRule({ ...rule, statement: `${rule.statement} Always.` });
  await a.addRule({ area: "voice", statement: "Never say cheap.", kind: "rule", polarity: "dont" });
  await a.verifyFact("f7");
  await a.correctFact("f8", "Shea butter and oat, no perfume.");
  await a.verifyProduct("pr-balm");
  await a.verifyFact("f20");
  await a.verifyFact("f21");
  await a.verifyFact("f22");
  await a.verifyProduct("pr-mist");
  await a.addProduct({ name: "Night Serum", variant: "30 ml", url: "https://lysne.example/serum" });
  await a.addReference({ image: "/demo/lysne/gen/taste-bedroom.jpg", verdict: "liked", note: "The low light" });
  await a.chooseTastePair("tp2", "b", "Softer");
  await a.answerUnderstanding({ directionId: "td1", verdict: "yes" });
  await a.answerUnderstanding({ directionId: "td2", verdict: "no", reason: "Too cold" });
  await a.uploadSourceAssets([{ name: "guide.pdf", bytes: 120_000, kind: "guideline" }]);
  await a.approveBrandDna();
  await a.brandDna();
  await a.decide({ kind: "colour", id: "col-amber", verdict: "change", value: "#C2873E" });
  await a.decide({ kind: "voice", id: "vo-2", verdict: "remove" });
  await a.decide({ kind: "typeface", id: "tf-body", verdict: "keep" });
  await a.decide({ kind: "rule", id: "r2", verdict: "keep" });
  await a.decide({ kind: "board_item", id: "bi-3", verdict: "remove" });
  await a.setColourUses({ colourId: "col-ink", uses: ["text", "buttons"] });
  await a.moveImage({ imageId: "im-3", group: "campaign", campaign: "Autumn launch" });
  await a.moveImage({ imageId: "im-4", group: "unused" });
  await a.decideVoicePart({ part: "speak", verdict: "change", note: "Shorter sentences" });
  await a.decideVoicePart({ part: "rules", verdict: "keep" });
  await a.brandBoard();
  await a.tasteTraining();
  await a.answerTaste({ cardId: "tc-1", answer: "a", reason: "Warmer" });
  await a.answerTaste({ cardId: "tc-2", answer: "no" });
  await a.passTastePair({ cardId: "tc-3", reason: "Both fine" });
  await a.passTastePair({ pairId: "tp3" });
  await a.tasteTraining();
  await a.brandDna();
  await a.home();
});

scenario("boards and catalogue", async (golden) => {
  const maja = golden.open("maja", {});
  const a = maja.call;
  const board = await a.addBoardItem("bd-ideas", {
    kind: "image",
    x: 0.1,
    y: 0.2,
    w: 0.3,
    h: 0.3,
    image: "/demo/lysne/gen/taste-bedroom.jpg",
    verdict: "liked",
    note: "This light",
  });
  const item = board?.items.at(-1);
  if (item) {
    await a.updateBoardItem("bd-ideas", item.id, { x: 0.5, verdict: "disliked", note: "Too dark" });
    await a.removeBoardItem("bd-ideas", item.id);
  }
  await a.addBoardItem("bd-brand", { kind: "note", x: 0, y: 0, w: 0.2, h: 0.1, text: "Linen, never cotton" });
  await a.board("bd-brand");
  await a.startMoodboard("c-bf", ["/demo/lysne/gen/taste-bedroom.jpg", "/demo/lysne/gen/model-ane.jpg"]);
  await a.skipMoodboard("c-balm");
  await a.setCampaignScope("c-bf", { productIds: ["pr-oil", "pr-candle"], collectionIds: ["cl-gifts"] });
  await a.campaign("c-bf");
  await a.boards();
  const collection = await a.addCollection({ name: "Night", kind: "line", productIds: ["pr-oil", "pr-balm"] });
  const catalogue = await a.catalogue();
  await a.setProductPlace("pr-mist", {
    categoryId: catalogue?.categories[0]?.id,
    collectionIds: collection ? [collection.id] : [],
  });
  if (collection) await a.collection(collection.id);
  await a.catalogue();
});

scenario("team and settings", async (golden) => {
  const maja = golden.open("maja", {});
  const a = maja.call;
  await golden.open("jonas", { userId: "u-jonas" }).call.invite("someone@lysne.example", "member");
  await a.invite("kari@lysne.example", "approver");
  await a.changeRole("u-jonas", "approver");
  await a.setApprover("c-winter", "u-jonas");
  await a.removeMember("u-ida");
  await a.team();
  await a.people();
  await a.updateWorkspace({ brandName: "LYSNE Studio", language: "English" });
  await a.updateProfile({ name: "Maja Lind", title: "CMO", email: "maja@lysne.example" });
  await a.session();
  await a.settings();
  await a.campaign("c-winter");
});

scenario("first run", async (golden) => {
  const maja = golden.open("maja", { fresh: true });
  const a = maja.call;
  await a.onboardingProgress();
  await a.saveOnboardingProgress({ step: "scan" });
  await a.startBrandScan({ source: "website", url: "https://lysne.example" });
  await maja.advance(5_000);
  await a.brandScan();
  await a.saveOnboardingProgress({ step: "review", part: "colour" });
  await a.saveOnboardingProgress({ line: { id: "brand", verdict: "right" } });
  await a.saveOnboardingProgress({ line: { id: "light", verdict: "not_quite", reason: "Warmer" } });
  await a.onboardingProgress();
  const dna = await a.brandDna();
  const unknown = dna?.understanding.unknowns[0];
  if (unknown) await a.answerUnderstanding({ unknownId: unknown.id, answer: "Women 30 to 50 who sleep badly" });
  await a.brandBoard();
  await a.approveBrandDna();
  await a.saveOnboardingProgress({ step: "taste" });
  await a.session();
  await a.home();
  await a.questions();
});

scenario("brand update", async (golden) => {
  const maja = golden.open("maja", {});
  const a = maja.call;
  await a.startBrandScan({ source: "upload", files: [{ name: "guide.pdf", bytes: 2_000_000 }] });
  await maja.advance(10_000);
  await a.brandScan();
  const update = await a.startBrandUpdate({ source: "website", url: "https://lysne.example" });
  await maja.advance(10_000);
  const ready = await a.brandUpdate();
  const [keep, fix, remove] = ready?.found ?? [];
  if (ready && keep) await a.decideBrandFound({ updateId: ready.id, foundId: keep.id, verdict: "keep" });
  if (ready && fix) await a.decideBrandFound({ updateId: ready.id, foundId: fix.id, verdict: "fix", value: "Fixed" });
  if (ready && remove) await a.decideBrandFound({ updateId: ready.id, foundId: remove.id, verdict: "remove" });
  if (update) await a.approveBrandUpdate(update.id);
  await a.brandUpdate();
  await a.brandBoard();
  await a.startBrandUpdate({ source: "upload", files: [{ name: "new-guide.pdf", bytes: 100 }] });
  await maja.advance(10_000);
  await a.brandUpdate();
});

scenario("product import", async (golden) => {
  const maja = golden.open("maja", {});
  const a = maja.call;
  const csv = await a.startProductImport({ source: "csv", file: { name: "products.csv", bytes: 4_000 } });
  await maja.advance(3_000);
  if (csv) {
    const mapping = await a.importJob(csv.id);
    const columns = mapping?.columns ?? [];
    await a.mapImportColumns(
      csv.id,
      columns.map((c, i) => ({ column: c.column, fieldId: i === 0 ? null : (c.fieldId ?? null) })),
    );
    await maja.advance(10_000);
    const job = await a.importJob(csv.id);
    const [first, second, third, fourth, fifth] = job?.found ?? [];
    if (first) await a.decideFound(csv.id, first.id, { verdict: "keep" });
    if (second) await a.decideFound(csv.id, second.id, { verdict: "remove" });
    if (third && first) await a.decideFound(csv.id, third.id, { verdict: "merge", intoId: first.id });
    if (fourth) await a.decideFound(csv.id, fourth.id, { verdict: "fix", name: "Renamed", variant: "100 ml" });
    if (fifth) await a.decideFound(csv.id, fifth.id, { verdict: "split" });
    await a.approveImport(csv.id);
    await a.productImport();
    await a.catalogue();
  }
  const site = await a.startProductImport({ source: "website", url: "https://lysne.example/shop" });
  await maja.advance(2_000);
  await a.productImport();
  await maja.advance(30_000);
  if (site) {
    await a.importJob(site.id);
    await a.dismissImport(site.id);
  }
  await a.productImport();
  const zip = await a.startProductImport({ source: "zip", file: { name: "shots.zip", bytes: 90_000_000 } });
  await maja.advance(30_000);
  if (zip) await a.importJob(zip.id);
});

scenario("products", async (golden) => {
  const maja = golden.open("maja", {});
  const a = maja.call;
  const made = await a.readProduct({
    kindId: "kind-skincare",
    name: "Night Serum",
    variant: "30 ml",
    url: "https://lysne.example/serum",
    shots: [{ slotId: "front", name: "front.jpg", bytes: 300_000 }],
  });
  await maja.advance(5_000);
  if (made) {
    await a.product(made.id);
    await a.saveProductSpecs(made.id, {
      values: [{ fieldId: "net", value: 30, unit: "ml" }],
      keep: made.specs?.slice(0, 1).map((s) => s.fieldId),
      parts: [{ id: "part-cap", name: "Cap", material: "Aluminium" }],
      keepShots: ["front"],
    });
    await a.uploadShot(made.id, "back", { name: "back.jpg", bytes: 200_000, src: "/demo/lysne/01-feed.jpg" });
    await a.uploadProductFile(made.id, { kind: "dieline", name: "dieline.pdf", bytes: 50_000 });
    await a.product(made.id);
  }
  await a.saveProductSpecs("pr-oil", { remove: ["texture"], keepParts: [] });
  await a.uploadShot("pr-oil", "scale", { name: "scale.jpg", bytes: 1_000 });
  await a.uploadProductFile("pr-oil", { kind: "spec", name: "spec.pdf", bytes: 9_000 });
  await a.product("pr-oil");
  await a.detailTokens("pr-oil");
  await a.catalogue();
  await a.questions();
});

scenario("brief to plan", async (golden) => {
  const maja = golden.open("maja", {});
  const a = maja.call;
  await a.changeBrief("c-balm", { message: "Soft hands for the hour before sleep.", missing: [] });
  await a.approveBrief("c-balm");
  await a.plan("c-balm");
  await maja.advance(3_000);
  const plan = await a.plan("c-balm");
  await a.changePlan("c-balm", { line: "light", value: "Low lamp light, warm." });
  const other = plan?.directions.find((d) => d.id !== plan.chosenDirectionId);
  if (other) await a.choosePlanDirection("c-balm", other.id, "Closer to the brand");
  const chosen = await a.plan("c-balm");
  const creative = chosen?.directions.find((d) => d.id === chosen.chosenDirectionId)?.creatives[0];
  if (creative) await a.changePlan("c-balm", { creativeId: creative.id, creative: { text: "Hands, then sleep" } });
  await a.changePlan("c-balm", { creativeId: "pc-nope", creative: { text: "Nothing" } });
  await a.askPlanChanges("c-balm", "Show the tube closed");
  await maja.advance(3_000);
  await a.plan("c-balm");
  await a.askPlanCheck("c-balm");
  await a.approvePlan("c-balm");
  await maja.advance(5_000);
  await a.plan("c-balm");
  await a.approvePlan("c-balm");
  await a.campaign("c-balm");
  await a.undoApprovePlan("c-balm");
  await a.approvePlan("c-balm");
  await a.changePlanWithFume("c-balm", "Make the light colder");
  await a.changePlanWithFume("c-spring", "Anything");
  await maja.advance(13_000);
  await a.campaign("c-balm");
  await a.home();
  await maja.advance(60_000);
  await a.campaign("c-balm");
  await a.studioCampaigns();
});

scenario("plan as the expert", async (golden) => {
  const anna = golden.open("anna", { userId: "u-anna" });
  const a = anna.call;
  await a.plan("c-bf");
  await a.changePlan("c-bf", { line: "light", value: "Candle light only." });
  await a.checkPlan("c-bf");
  await a.plan("c-bf");
  await a.approvePlan("c-bf");
  anna.signInAs("maja", "u-maja");
  await a.plan("c-bf");
  await a.approvePlan("c-bf");
  await a.changePlanWithFume("c-bf", "Warmer");
  await a.campaign("c-bf");
  await a.home();
});

scenario("campaign from the chat", async (golden) => {
  const maja = golden.open("maja", {});
  const a = maja.call;
  const started = await a.startCampaign({ text: "A spring campaign for the face oil", productIds: ["pr-face"] });
  if (started) {
    await a.campaign(started.campaign.id);
    await a.messages(started.threadId);
    for (const answer of [
      "Women who sleep badly",
      "Calm skin by morning",
      "Paid social, feed and story",
      "Mid March",
    ]) {
      await a.send(started.threadId, answer);
      await maja.advance(1_000);
    }
    await a.messages(started.threadId);
    await a.campaign(started.campaign.id);
    await a.sendBrief(started.campaign.id);
    await maja.advance(3_000);
    await a.plan(started.campaign.id);
  }
  await a.startCampaign({ text: "Something for the Autumn launch again" });
  await maja.advance(1_000);
  await a.conversation();
  await a.threads();
  await a.campaigns();
});

scenario("chat", async (golden) => {
  const maja = golden.open("maja", {});
  const a = maja.call;
  for (const text of [
    "What is waiting for me?",
    "What did we make this month?",
    "Tell me about the Hand Balm",
    "How is the Autumn launch going?",
    "Show me the Gift sets collection",
    "Which creatives are approved?",
    "Can we make a campaign for the Pillow Mist before Christmas?",
  ]) {
    await a.say(text);
    await maja.advance(1_000);
  }
  await a.conversation();
  await a.say("Start a new one");
  await maja.advance(2_000);
  await a.say("Here is the logo", [{ name: "logo.svg", bytes: 2_000 }]);
  await maja.advance(1_000);
  await a.conversation();
  await a.send("t-autumn", "Can the light be warmer on the next ones?");
  await maja.advance(1_000);
  await a.messages("t-autumn");
  await a.send("t-balm", "The claims are: no perfume, 98% natural.");
  await maja.advance(1_000);
  await a.messages("t-balm");
  await a.send("t-contact", "Can we talk on Friday?", [{ name: "notes.pdf", bytes: 1_000 }]);
  await a.messages("t-contact");
  await a.threads();
  await a.campaign("c-balm");
  await a.questions();
});

scenario("questions and new briefs", async (golden) => {
  const maja = golden.open("maja", {});
  const a = maja.call;
  await a.questions();
  await a.answerQuestion({ questionId: "q-balm-claims", text: "No perfume. 98% natural origin." });
  await a.answerQuestion({ questionId: "q-balm-packshot", keepPicture: true });
  await a.answerQuestion({ questionId: "q-fact-pr-candle-f24", text: "40 hours" });
  await a.answerQuestion({
    questionId: "q-fact-pr-kveld-f76",
    picture: { name: "kveld.jpg", bytes: 1_000, src: "/demo/lysne/01-feed.jpg" },
  });
  await a.questions();
  await a.campaign("c-balm");
  await a.product("pr-balm");
  await a.home();
  const ordered = await a.orderBrief({
    name: "Night ritual",
    goal: "Sell the night ritual set before Christmas",
    productIds: ["pr-ritual"],
    collectionIds: ["cl-gifts"],
    channels: ["paid_social", "email"],
    formats: ["feed", "story"],
    deadline: "2026-12-01T00:00:00.000Z",
    notes: "No snow",
    audience: "Gift buyers",
    message: "A calm evening, wrapped",
    mandatory: ["Logo"],
    never: ["Snow"],
    references: ["/demo/lysne/gen/taste-bedroom.jpg"],
    creatives: 6,
  });
  if (ordered) {
    await a.campaign(ordered.id);
    await a.plan(ordered.id);
    await maja.advance(3_000);
    await a.plan(ordered.id);
  }
  await a.orderBrief({
    name: "Quick one",
    goal: "Test",
    productIds: [],
    collectionIds: [],
    channels: [],
    formats: [],
    notes: "",
    references: [],
  });
  await a.campaigns();
  await a.chooseDirection("d-a2", "On second thought");
  await a.passDirections("c-autumn", "None of them");
  await a.meetingTopics();
  const slots = await a.meetingSlots();
  if (slots?.[0]) await a.bookMeeting({ at: slots[0], topic: "Winter gifting: plan the launch" });
  await a.meetings();
  await a.schedule({ creativeId: "cr-a-m1", placementId: "pl-ig-story", at: "2026-10-20T08:00:00.000Z" });
  await a.moveEntry("ce-5", "2026-10-21T08:00:00.000Z");
  await a.removeEntry("ce-6");
  await a.calendar({ from: "2026-10-01T00:00:00Z", to: "2026-12-31T00:00:00Z" });
  await a.askFume({ kind: "support", topic: "Billing", text: "Where is my invoice?" });
});

scenario("checks", async (golden) => {
  const anna = golden.open("anna", { userId: "u-anna" });
  const a = anna.call;
  await golden.open("maja", {}).call.markChecked("ck-a-v7");
  await a.check("ck-a-v7");
  await a.passItem("ck-a-v7", "ck-a-v7-i1");
  await a.addNote("ck-a-v7", { x: 0.2, y: 0.8, text: "Label slightly soft", itemId: "ck-a-v7-i2" });
  await a.markChecked("ck-a-v7");
  await a.requestCorrection("ck-a-v8");
  await a.hold("ck-a-v8", "Waiting for the cap colour");
  await a.markChecked("ck-a-v9");
  await a.checkQueue();
  await a.studioCampaigns();
  anna.signInAs("maja", "u-maja");
  await a.campaign("c-autumn");
  anna.signInAs("anna", "u-anna");
  await a.release("c-autumn");
  anna.signInAs("maja", "u-maja");
  await a.campaign("c-autumn");
  await a.home();
  anna.signInAs("anna", "u-anna");
  await a.qualityLog();
  await a.teamLoad();
  await a.allBrands();
  await a.switchWorkspace("w-solv");
  await a.session();
  await a.campaigns();
  await a.qaQueue();
  await anna.advance(13_000);
  await a.studioCampaigns();
  await a.campaign("c-solv");
});

scenario("quality gate", async (golden) => {
  const anna = golden.open("anna", { userId: "u-anna" });
  const a = anna.call;
  await a.qaCheck("qa-1");
  await a.qaUncheck("qa-1");
  await a.qaCheck("qa-1");
  await a.qaFeedback("qa-2", "The cap reads gold, not burgundy", [{ n: 1, x: 0.5, y: 0.3, text: "Cap" }]);
  await anna.advance(10_000);
  await a.qaQueue();
  const item = await a.qaCheck("qa-4");
  if (item?.layers)
    await a.qaEdit(
      "qa-4",
      item.layers.map((l) => (l.kind === "text" ? { ...l, text: "Autumn" } : l)),
    );
  await a.qaToStudio("qa-2");
  await a.qaToStudio("qa-bt-1-1", true);
  await a.qaQueue();
  await a.qaQueue("w-solv");
  await a.qaCheck("qa-5");
  await a.campaign("c-solv");
  await a.creative("cr-a-v9");
});

scenario("studio", async (golden) => {
  const anna = golden.open("anna", { userId: "u-anna" });
  const a = anna.call;
  const kit = await a.studioKit("w-lysne");
  const opened = await a.openStudio({ workspaceId: "w-lysne", campaignId: "c-autumn", slot: "Master 3" });
  if (opened) {
    const recipe = {
      ...opened.recipe,
      mode: "type" as const,
      creativeTypeId: kit?.creativeTypes[0]?.id,
      productId: "pr-oil",
      castIds: kit?.cast.slice(0, 1).map((c) => c.id) ?? [],
      sceneId: kit?.scenes[0]?.id,
      format: "feed" as const,
      count: 2,
    };
    const made = await a.generate(opened.id, recipe);
    await anna.advance(5_000);
    const session = await a.studioSession(opened.id);
    const first = session?.generations[0] ?? made?.generations[0];
    if (first) {
      await a.repair(opened.id, first.id, "The cap is gold");
      await anna.advance(5_000);
      await a.pickGeneration(opened.id, first.id);
    }
    await a.sendToCheck(opened.id);
  }
  await a.openStudio({ workspaceId: "w-lysne", fromGenerationId: "g4" });
  await a.pickGeneration("ss-autumn-m3", "g4");
  await a.repair("ss-autumn-m3", "g1", "Less glare");
  await anna.advance(5_000);
  await a.sendToCheck("ss-autumn-m3");
  await a.studioSession("ss-autumn-m3");
  await a.checkQueue();
  await a.qaQueue();
  await a.brandWorkspace("w-lysne");
});

scenario("documents", async (golden) => {
  const anna = golden.open("anna", { userId: "u-anna" });
  const a = anna.call;
  const doc = await a.openDocument({
    workspaceId: "w-lysne",
    studio: "render",
    modeId: "m-scene",
    campaignId: "c-autumn",
    title: "Autumn · Master 4",
    slot: "Master 4",
  });
  if (doc) {
    await a.updateDocument(doc.id, { title: "Autumn · Master 4, warm", variables: { ...doc.variables } });
    const edited = await a.engineEdit(doc.id, "Make the light warmer");
    await anna.advance(3_000);
    const edit = (await a.document(doc.id))?.edits.at(-1) ?? edited?.edits.at(-1);
    if (edit) await a.decideEdit(doc.id, edit.id, "undo");
    await a.render(doc.id);
    await anna.advance(5_000);
    const rendered = await a.document(doc.id);
    const version = rendered?.versions.at(-1);
    if (version) await a.pickVersion(doc.id, version.id);
    await a.overrideProduct(doc.id, { field: "cap", value: "Gold", scope: "product" });
    await a.overrideProduct(doc.id, { field: "label", value: "Matte", scope: "this_render" });
    await a.setSource(doc.id, "light", "brand");
    await a.setSource(doc.id, "camera", "own");
    await a.makeFormats(doc.id, ["pl-ig-story", "pl-pin"]);
    await anna.advance(5_000);
    await a.setFormatTile(doc.id, "pl-ig-story", { method: "crop", crop: { x: 0, y: 0.1, w: 1, h: 0.8 } });
    if (version) await a.fixProduct(doc.id, { versionId: version.id, tokenId: "dt-cap" });
    await a.fixProduct(doc.id, { versionId: "rv-nope", region: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 }, what: "Logo" });
    await anna.advance(5_000);
    await a.documentToCheck(doc.id);
    await a.undoDocumentToCheck(doc.id);
    await a.documentToCheck(doc.id);
    await a.document(doc.id);
  }
  await a.productProposals("pr-oil");
  const proposals = await a.productProposals("pr-oil");
  for (const o of proposals ?? []) await a.decideOverride(o.id, "approve");
  await a.decideOverride("ov-2", "decline");
  await a.decideEdit("doc-autumn-m3", "ed-1", "undo");
  await a.updateDocument("doc-autumn-m3", { campaignId: "c-bf" });
  await a.updateDocument("doc-autumn-m3", { campaignId: undefined });
  await a.openDocument({ workspaceId: "w-lysne", studio: "design", modeId: "m-layout", creativeId: "cr-a-m1" });
  await a.openDocument({ workspaceId: "w-lysne", studio: "video", modeId: "m-video" });
  await a.saveModel({ documentId: "doc-model-mia", name: "Mia", state: "saved" });
  await a.decideModel("bm-leo", "approve");
  await a.decideModel("bm-mia", "decline");
  await a.saveReference({ documentId: "doc-ref-lamp", name: "Lamp", state: "saved" });
  await a.brandAssets();
  await a.lookPresets("w-lysne");
  await a.documents("w-lysne");
  anna.signInAs("maja", "u-maja");
  await a.decideOverride("ov-2", "approve");
  await a.decideModel("bm-mia", "approve");
  await a.brandAssets();
});

scenario("engine chat and batches", async (golden) => {
  const anna = golden.open("anna", { userId: "u-anna" });
  const a = anna.call;
  await a.engineSay("w-lysne", "Make packshots of the face oil for the product page");
  await anna.advance(3_000);
  await a.engineChat("w-lysne");
  await a.answerEngineWidget("w-lysne", "em-2", { picked: ["pr-oil", "pr-candle"] });
  await a.answerEngineWidget("w-lysne", "em-3", { choice: "6" });
  await anna.advance(3_000);
  const chat = await a.engineChat("w-lysne");
  for (const m of (chat ?? []).filter((m) => m.widget && !["em-2", "em-3", "em-3b", "em-4"].includes(m.id))) {
    const w = m.widget!;
    if (w.kind === "products") await a.answerEngineWidget("w-lysne", m.id, { picked: w.productIds.slice(0, 1) });
    if (w.kind === "choice") await a.answerEngineWidget("w-lysne", m.id, { choice: w.options[0] });
    await anna.advance(3_000);
  }
  await a.engineSay("w-lysne", "Is the Autumn launch on time?");
  await anna.advance(3_000);
  await a.engineSay("w-solv", "Hello");
  await anna.advance(3_000);
  await a.engineChat("w-lysne");
  const batch = await a.startBatch({
    campaignId: "c-autumn",
    modeId: "m-packshot",
    productIds: ["pr-oil", "pr-balm"],
    perProduct: 2,
    format: "square",
  });
  await anna.advance(10_000);
  await a.batches();
  if (batch) await a.batches(batch.campaignId);
  await a.qaQueue();
  await a.startBatch({
    campaignId: "",
    modeId: "m-packshot",
    productIds: ["pr-face"],
    collectionId: "cl-gifts",
    perProduct: 1,
    format: "feed",
  });
  await anna.advance(10_000);
  await a.batches();
  await a.usage();
});

scenario("agency sends creatives", async (golden) => {
  const nora = golden.open("nora", { agency: true });
  const a = nora.call;
  const checked = (await checkedIn(nora, "c-autumn")).map((c) => c.current.id);
  await a.approve(checked);
  const send = await a.sendToClient({
    campaignId: "c-autumn",
    versionIds: checked.slice(0, 3),
    to: ["u-maja"],
    link: true,
    note: "Three for the launch.",
  });
  await a.sendToClient({ campaignId: "c-autumn", versionIds: checked, to: ["u-even"], link: false });
  await a.clientSends("c-autumn");
  const token = send?.link?.token ?? "none";
  await a.clientLink(token);
  await a.answerClientLink({ token, versionId: checked[0]!, verdict: "approve", name: "Nora" });
  await a.recordClientApproval({
    versionIds: [checked[1]!],
    clientUserId: "u-maja",
    note: "Maja said yes in our Monday meeting.",
  });
  await a.recordClientApproval({ versionIds: [checked[3]!], clientUserId: "u-even", note: "Not a client" });
  nora.signInAs("maja (agency's client)", "u-maja");
  await a.clientLink(token);
  await a.answerClientLink({ token, versionId: checked[0]!, verdict: "approve", name: "Maja Lind" });
  await a.answerClientLink({ token, versionId: checked[2]!, verdict: "changes", text: "Warmer", name: "Maja Lind" });
  await a.home();
  await a.notifications();
  await a.campaign("c-autumn");
  nora.signInAs("nora", "u-nora");
  await a.campaign("c-autumn");
  await a.agencyHome();
  await a.markChecked("ck-a-v7");
  await a.checkQueue();
  await a.clientSends("c-autumn");
  await a.home();
});

scenario("agency sends the plan", async (golden) => {
  const nora = golden.open("nora", { agency: true });
  const a = nora.call;
  await a.approvePlan("c-winter");
  await a.changePlan("c-winter", { line: "light", value: "Window light, north." });
  const send = await a.sendToClient({
    campaignId: "c-winter",
    versionIds: [],
    to: ["u-maja"],
    link: true,
    plan: true,
    note: "Window light, as we said.",
  });
  await a.changePlan("c-winter", { line: "light", value: "Colder light." });
  const token = send?.link?.token ?? "none";
  await a.clientLink(token);
  await a.answerClientPlan({ token, verdict: "approve", name: "Nora" });
  nora.signInAs("maja (agency's client)", "u-maja");
  await a.answerClientPlan({ token, verdict: "changes", text: "The gift box closed", name: "Maja Lind" });
  await nora.advance(3_000);
  nora.signInAs("nora", "u-nora");
  await a.plan("c-winter");
  await a.checkPlan("c-winter");
  await a.sendToClient({ campaignId: "c-winter", versionIds: [], to: ["u-maja"], link: true, plan: true });
  nora.signInAs("maja (agency's client)", "u-maja");
  await a.answerClientPlan({ token, verdict: "approve", name: "Maja Lind" });
  await a.campaign("c-winter");
  await a.approvePlan("c-bf");
  await a.undoApprovePlan("c-bf");
  await a.clientLink("bfplan");
  await a.answerClientPlan({ token: "bfplan", verdict: "approve", name: "Maja Lind" });
  await a.home();
  nora.signInAs("nora", "u-nora");
  await a.agencyHome();
  await a.agencyCampaigns();
  await nora.advance(13_000);
  await a.campaign("c-winter");
});

scenario("agency brief and clients", async (golden) => {
  const nora = golden.open("nora", { agency: true });
  const a = nora.call;
  await a.changeBrief("c-balm", { message: "Soft hands for the hour before sleep.", missing: [] });
  await a.sendBrief("c-balm");
  await nora.advance(3_000);
  await a.plan("c-balm");
  await a.askPlanCheck("c-balm");
  await nora.advance(5_000);
  await a.plan("c-balm");
  const client = await a.addClient({
    brandName: "FJELL",
    website: "https://fjell.example",
    market: "Norway",
    language: "Norwegian",
    people: [
      { name: "Kari Fjell", email: "kari@fjell.example", role: "owner" },
      { name: "Ola Fjell", email: "ola@fjell.example", role: "approver" },
    ],
  });
  await a.agencyClients();
  await a.agencyHome();
  await a.licence();
  if (client) {
    await a.switchWorkspace(client.workspace.id);
    await a.session();
    await a.home();
    await a.brandDna();
  }
  await a.switchWorkspace("w-vev");
  await a.session();
  await a.home();
  await a.campaigns();
  await a.engineSay("w-vev", "What waits on me?");
  await nora.advance(3_000);
  await a.engineChat("w-vev");
  await a.askFume({
    kind: "manpower",
    clientId: "w-lysne",
    work: ["checks", "renders"],
    amount: "About 20 creatives",
    when: "This week",
  });
  await a.askFume({ kind: "support", topic: "Licence", text: "Can we add a client?" });
  await a.agencyPlan();
  await a.agencyTeam();
  const even = golden.open("even", { agency: true, userId: "u-even" }).call;
  await even.addClient({ brandName: "NOPE", people: [] });
  await even.approve(["v-cr-a-v1-3"]);
  await even.checkPlan("c-winter");
  await even.agencyHome();
});

test("the golden master calls every member of the mock", () => {
  const missing = members.filter((m) => !covered.has(m));
  console.log(`golden master: ${members.length - missing.length} of ${members.length} FumeApi members called`);
  if (missing.length) console.log(`not called: ${missing.join(", ")}`);
  expect(members.length).toBeGreaterThan(0);
});
