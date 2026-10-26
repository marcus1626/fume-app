// The mock backend: FumeApi in memory, on the LYSNE seed. Writes change the in-memory state and emit the same events
// the real backend will, so every screen can be designed and tested in every state. Not for production.

import {
  FumeError,
  type BrandRule,
  type Brief,
  type Campaign,
  type CampaignPlan,
  type Channel,
  type Check,
  type CheckView,
  type Creative,
  type CreativeVersion,
  type CustomerRole,
  type FumeApi,
  type FumeEvent,
  type HomeView,
  type Id,
  type Message,
  type ProductQuestionCard,
  type QueueItem,
  type ReviewItem,
  type Session,
  type User,
  type WaitingItem,
} from "../contract";
import * as seed from "./seed";
import { upgradeV1, v2Api, v2Db } from "./mockV2";
import { upgradeV2, v3Api, v3Db } from "./mockV3";
import { upgradeV3, v4Api, v4Db } from "./mockV4";
import { upgradeV6, v6Api, v6Db } from "./mockV6";
import { addV7 } from "./seed7";
import { v9Api, v9Db } from "./mockV9";
import { r8HomeApi } from "./r8-home";
import { r8ReviewApi } from "./r8-review";
import { r9ReviewApi } from "./r9-review";
import { r8OnbApi } from "./r8-onb";
import { r9CampaignApi } from "./r9-campaign";
import { r10Db, r10PlanApi } from "./r10-plan";
import { r13CampaignApi, r13Db } from "./r13-campaign";
import { agencyWorld, r11AgencyApi } from "./r11-agency";
import { r11ClientApi, unsentToClient } from "./r11-client";
import { r11PagesApi } from "./r11-pages";
import { r13BrandApi } from "./r13-brand";
import { r13AgencyApi } from "./r13-agency";
import { r13ChatApi } from "./r13-chat";
import { sendHeld, unsentByFume } from "./r13-studio";
import { v8Api, v8Db } from "./mockV8";
import {
  audienceIn,
  audienceWords,
  campaignName,
  dateOptions,
  dayIn,
  messageOptions,
  messageQuestion,
  objectiveOf,
  occasionOf,
  productQuestion,
  productsNamed,
  sameCampaign,
} from "./fumeBrief";
import { keepQuestions, openQuestion, seedQuestions, settleQuestions } from "./questions";

const clone = <T>(value: T): T => structuredClone(value);

/** What Fume asks when a campaign is started in the chat (UX review C1): only what it cannot read from the first line
 *  or the Brand DNA, one question at a time. Each answer fills its line of the brief; after the last, the brief card. */
interface BriefQuestion {
  key: "market" | "audience" | "date" | "product" | "message";
  /** The product question shows the products as a grid (walk-through Must 2). */
  productIds?: Id[];
  /** Round 8 (CHAT, TASK-1): the products she named that wait to be confirmed; confirming them answers the question. */
  named?: Id[];
  missing: string;
  text: string;
  question: string;
  why: string;
  options: string[];
  fill: (answer: string, campaign: Campaign, brief: Brief) => void;
}
const briefQuestions: BriefQuestion[] = [
  {
    key: "market",
    missing: "Which market it is for",
    text: "Which market is this for? It decides the language and the claims we can use.",
    question: "Which market is this for?",
    why: "It decides the language and the claims we can use.",
    options: ["Norway", "Sweden", "The Nordics"],
    fill: (answer, c) =>
      Object.assign(c, {
        market: answer,
        language: /swed|sver/i.test(answer)
          ? "Swedish"
          : /nordic|norden/i.test(answer)
            ? "Norwegian and Swedish"
            : "Norwegian",
      }),
  },
  {
    key: "audience",
    missing: "Who it should reach",
    text: "Who should it reach?",
    question: "Who should it reach?",
    why: "It decides the tone, and whether we show the product new or as an old friend.",
    options: ["Existing customers", "New customers", "Both"],
    fill: (answer, _c, b) => Object.assign(b, { audience: audienceWords(answer) }),
  },
  {
    key: "date",
    missing: "When it goes live",
    text: "When should it go live?",
    question: "When should it go live?",
    why: "We plan the work back from that day and tell you if your package needs longer.",
    options: ["In two weeks", "In a month", "No fixed date"],
    fill: (answer, c) => {
      // Round 8 (TASK-8): a day in words ("From 1 Dec", "15. november") is that day.
      const day = dayIn(answer, c.createdAt);
      const days = /two weeks|2 weeks/i.test(answer) ? 14 : /month/i.test(answer) ? 30 : 0;
      if (day) c.dueAt = day;
      else if (days) c.dueAt = new Date(Date.parse(c.createdAt) + days * 864e5).toISOString();
    },
  },
  {
    // Round 8 (TASK-2): the message is asked last, so a chat brief passes the same briefGaps rule as the form.
    key: "message",
    missing: messageQuestion.missing,
    text: messageQuestion.text,
    question: messageQuestion.question,
    why: messageQuestion.why,
    options: [],
    fill: (answer, _c, b) => Object.assign(b, { message: answer.trim().replace(/^[“"]|[”"]$/g, "") }),
  },
];

/** Round 8 (CHAT): a question as the card Fume shows; the product question carries the products she named. */
function questionCard(q: BriefQuestion): Message["card"] {
  const card: ProductQuestionCard = {
    kind: "question",
    question: q.question,
    why: q.why,
    options: q.options,
    ...(q.productIds ? { productIds: q.productIds } : {}),
    ...(q.named?.length ? { named: q.named } : {}),
  };
  return card;
}

export interface MockOptions {
  /** Who is signed in: a customer (default Maja) or one of Fume's people (Anna, the expert). */
  userId?: Id;
  /** Milliseconds each call waits, so loading states show (0 in tests). */
  latency?: number;
  /** Start as a brand-new workspace, for the first run. */
  fresh?: boolean;
  /** Round 11 (FLOWS §24): the agency demo. LYSNE is Brygga Studio's client; Nora Vik, its creative lead, is signed in. */
  agency?: boolean;
}

export function createMockApi(options: MockOptions = {}): FumeApi {
  const db = clone({
    users: seed.users,
    workspaces: seed.workspaces,
    organisations: seed.organisations,
    memberships: seed.memberships,
    invitations: seed.invitations,
    staff: seed.staff,
    packages: seed.packages,
    brandDna: seed.brandDna,
    rules: seed.rules,
    products: seed.products,
    references: seed.references,
    tastePairs: seed.tastePairs,
    memory: seed.memory,
    assets: seed.assets,
    understanding: seed.understanding,
    campaigns: seed.campaigns,
    briefs: seed.briefs,
    directions: seed.directions,
    creatives: seed.creatives,
    runs: seed.runs,
    clocks: seed.clocks,
    checks: seed.checks,
    qualityLog: seed.qualityLog,
    deliveries: seed.deliveries,
    threads: seed.threads,
    messages: seed.messages,
    notifications: seed.notifications,
    record: seed.record,
    ...v2Db(),
    ...v3Db(),
    ...v4Db(),
    ...v6Db(),
    ...v9Db(),
    ...v8Db(),
    plans: [] as CampaignPlan[], // round 10: the plan (r10-plan.ts), filled below
  });
  upgradeV1(db);
  upgradeV2(db);
  upgradeV3(db);
  addV7(db); // round 6, worker T: more LYSNE products for the All products sheet
  upgradeV6(db);
  db.plans = r10Db(db).plans; // round 10: Winter gifting's plan waits on Maja, Black Friday's is in check
  r13Db(db); // round 13 (#38): Facebook and TikTok placements for the calendar's channels
  if (options.agency) agencyWorld(db as unknown as Parameters<typeof agencyWorld>[0]); // round 11: Brygga Studio's world

  if (options.fresh) {
    db.brandDna = {
      ...db.brandDna,
      version: 0,
      state: "draft",
      approvedBy: undefined,
      approvedAt: undefined,
      completeness: 0.2,
    };
    db.campaigns = [];
    db.deliveries = [];
    db.notifications = [];
    // A real first run (UX review M7): no history of any kind. What the Engine read is its proposal, not yet
    // approved; nothing was chosen, answered, made or said before today.
    const fresh = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(fresh);
      if (!node || typeof node !== "object") return;
      const o = node as Record<string, unknown>;
      if (typeof o.origin === "string" && typeof o.state === "string") {
        if (o.origin !== "customer") o.state = "proposed";
        delete o.by;
        delete o.at;
        delete o.was;
      }
      Object.values(o).forEach(fresh);
    };
    fresh(db.identity);
    fresh(db.boards);
    fresh(db.products);
    db.understanding = {
      ...db.understanding,
      version: 1,
      conflicts: db.understanding.conflicts.map(({ resolved: _resolved, ...c }) => c),
      unknowns: db.understanding.unknowns.map(({ answer: _answer, ...u }) => u),
      testDirections: db.understanding.testDirections.map(({ verdict: _verdict, reason: _reason, ...d }) => d),
    };
    db.tastePairs = db.tastePairs.map(({ chosen: _chosen, reason: _reason, ...t }) => t);
    db.tasteState = {
      ...db.tasteState,
      answered: 0,
      lastLesson: undefined,
      confidence: { light: 0, colour: 0, people: 0, composition: 0, styling: 0 },
    };
    db.memory = [];
    db.references = [];
    db.ratings = [];
    db.reviewComments = [];
    db.record = [];
    db.briefs = [];
    db.directions = [];
    db.creatives = [];
    db.runs = [];
    db.clocks = [];
    db.checks = [];
    db.qualityLog = [];
    db.documents = [];
    db.batches = [];
    db.qaItems = [];
    db.sessions = [];
    db.calendar = [];
    db.meetings = [];
    db.engineMessages = [];
    db.boards = db.boards.filter((b) => b.kind === "brand_moodboard");
    db.threads = db.threads.filter((t) => t.campaignId === null).map((t) => ({ ...t, unread: 0 }));
    db.messages = [];
    for (const p of db.products) {
      if (p.state === "verified") p.state = "needs_you";
      for (const f of p.facts) {
        if (f.source === "verified" || f.source === "supplied") f.source = "inferred";
        delete f.verifiedBy;
        delete f.verifiedAt;
      }
    }
  }

  /** One record per question Fume asks (walk-through Must 4): answered anywhere, closed everywhere. */
  const questions = clone(seedQuestions);
  const latency = options.latency ?? 120;
  let userId = options.userId ?? (options.agency ? "u-nora" : "u-maja");
  let workspaceId = "w-lysne";
  let seq = 0;
  const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(seq += 1)}`;
  /** Campaigns started in the chat whose brief Fume is still asking about: the questions left, in order. */
  const drafting = new Map<Id, BriefQuestion[]>();
  /** A new campaign that matched an open one: Fume asked "Add to it or start a new one?" (walk-through Must 2). */
  const pendingStart = new Map<Id, { text: string; productIds: Id[]; campaignId: Id }>();
  let startingAnyway = false;
  /** The mock's time runs on from the seed's moment (14 Oct 2026, 14:32 Oslo), so the demo always reads the same. */
  const started = Date.now();
  const now = () => new Date(seed.NOW + Date.now() - started).toISOString();
  const listeners = new Set<(event: FumeEvent) => void>();
  const emit = (event: FumeEvent) => listeners.forEach((l) => l(clone(event)));
  const wait = <T>(value: T): Promise<T> => new Promise((resolve) => setTimeout(() => resolve(clone(value)), latency));

  const me = () => db.users.find((u) => u.id === userId)!;
  const isStaff = () => Boolean(me().staffRole);
  const role = (): CustomerRole | null =>
    db.memberships.find((m) => m.userId === userId && m.workspaceId === workspaceId)?.role ?? null;
  const user = (id: Id): User => {
    const found = db.users.find((u) => u.id === id);
    if (!found) throw new FumeError("not_found", `No person ${id}`);
    return found;
  };
  const mustApprove = () => {
    const r = role();
    if (r !== "owner" && r !== "approver") throw new FumeError("forbidden", "Only the approver can approve.");
  };
  const mustStaff = () => {
    if (!isStaff()) throw new FumeError("forbidden", "The Quality Gate is for Fume's experts.");
  };
  const find = <T extends { id: Id }>(list: T[], id: Id, what: string): T => {
    const found = list.find((x) => x.id === id);
    if (!found) throw new FumeError("not_found", `No ${what} ${id}`);
    return found;
  };
  const campaignOf = (id: Id) => find(db.campaigns, id, "campaign");
  const inWorkspace = <T extends { workspaceId: Id }>(list: T[]) => list.filter((x) => x.workspaceId === workspaceId);
  const myCampaigns = () => inWorkspace(db.campaigns);
  /** The customer only ever sees checked work (F-D025), and checked work only once the operator has released the set:
   * while a campaign is in production its checked creatives wait for the release (ARCHITECTURE §5.2). */
  const visible = (c: Creative) =>
    isStaff() ||
    ["approved", "delivered", "changes_requested"].includes(c.current.state) ||
    (c.current.state === "checked" &&
      campaignOf(c.campaignId).state !== "in_production" &&
      !unsentToClient(db as never, c) &&
      !unsentByFume(c)); // round 12 AGENCY: an agency's client sees what it sent; round 13: and Fume's held checks wait for the send

  function recount(campaign: Campaign) {
    const list = db.creatives.filter((c) => c.campaignId === campaign.id);
    const n = (...states: CreativeVersion["state"][]) => list.filter((c) => states.includes(c.current.state)).length;
    campaign.counts = {
      creatives: list.length,
      inCheck: n("making", "in_check", "correcting", "held"),
      checked: n("checked"),
      approved: n("approved", "delivered"),
      delivered: n("delivered"),
    };
    if (
      campaign.counts.creatives > 0 &&
      campaign.counts.approved === campaign.counts.creatives &&
      campaign.state === "in_review"
    )
      campaign.state = "approved";
    campaign.updatedAt = now();
    emit({ type: "campaign.state", campaign });
  }

  /** A product is verified once the customer has confirmed every line of it. */
  function settleProduct(factId: Id) {
    const p = db.products.find((x) => x.facts.some((f) => f.id === factId));
    if (p && p.facts.every((f) => f.source === "verified" || f.source === "supplied")) p.state = "verified";
  }

  function setVersion(creative: Creative, change: Partial<CreativeVersion>) {
    creative.current = { ...creative.current, ...change };
    creative.versions[creative.versions.length - 1] = creative.current;
    emit({ type: "version.state", creativeId: creative.id, version: creative.current });
  }

  function say(threadId: Id, message: Omit<Message, "id" | "threadId" | "at">) {
    const m: Message = { id: nextId("msg"), threadId, at: now(), ...message };
    db.messages.push(m);
    emit({ type: "message.new", message: m });
    return m;
  }

  function checkView(check: Check, queue: Check[]): CheckView {
    const creative = find(db.creatives, check.creativeId, "creative");
    const campaign = campaignOf(check.campaignId);
    const index = queue.findIndex((c) => c.id === check.id);
    return {
      check,
      creative,
      version: creative.current,
      campaign,
      workspace: find(db.workspaces, check.workspaceId, "workspace"),
      product: db.products.find((p) => campaign.productIds.includes(p.id)),
      index: Math.max(index, 0),
      total: queue.length,
      prevId: queue[index - 1]?.id,
      nextId: queue[index + 1]?.id,
    };
  }

  // The expert's own checks; an operator or admin sees every open check in the workspaces they are on.
  const openChecks = () =>
    db.checks
      .filter((c) =>
        me().staffRole === "expert"
          ? c.expertId === userId
          : db.staff.some((s) => s.userId === userId && s.workspaceId === c.workspaceId) || me().staffRole === "admin",
      )
      .filter((c) => c.state !== "checked")
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt) || (a.risk === "high" ? -1 : 1));

  const queueItems = (): QueueItem[] =>
    openChecks().map((check) => ({
      check,
      creative: find(db.creatives, check.creativeId, "creative"),
      campaign: campaignOf(check.campaignId),
      workspace: find(db.workspaces, check.workspaceId, "workspace"),
    }));
  // Round 12 NUMBERS (DLOAD-2): every campaign, done ones too (Spring relaunch was missing), with who approves it.
  const studioRows = () =>
    db.campaigns.map((campaign) => ({
      campaign,
      workspace: find(db.workspaces, campaign.workspaceId, "workspace"),
      clock: db.clocks.find((k) => k.campaignId === campaign.id),
      expert: db.staff
        .filter((s) => s.workspaceId === campaign.workspaceId && s.staffRole === "expert")
        .map((s) => user(s.userId))[0],
      operator: db.staff
        .filter((s) => s.workspaceId === campaign.workspaceId && s.staffRole === "operator")
        .map((s) => user(s.userId))[0],
      readyToRelease: db.creatives.filter((cr) => cr.campaignId === campaign.id && cr.current.state === "checked")
        .length,
      approver: db.users.find((u) => u.id === campaign.approverId),
    }));
  // Round 12 NUMBERS (DLOAD-20, DTASK-7): an admin follows and checks nothing, so carries no load and no capacity; only
  // an expert checks. Each row says the brands and what the person does now, from the same QA items the Check page lists.
  const teamRows = () =>
    db.users
      .filter((u) => u.staffRole)
      .map((u) => {
        const brandIds = [...new Set(db.staff.filter((s) => s.userId === u.id).map((s) => s.workspaceId))];
        const brandNames = brandIds
          .map((id) => db.workspaces.find((w) => w.id === id)?.brandName)
          .filter(Boolean)
          .join(", ");
        const follows = u.staffRole === "admin";
        const expert = u.staffRole === "expert";
        const toCheck = db.qaItems.filter((q) => brandIds.includes(q.workspaceId) && q.state === "waiting").length;
        const plans = db.plans.filter(
          (p) =>
            p.state === "in_check" &&
            brandIds.includes(db.campaigns.find((c) => c.id === p.campaignId)?.workspaceId ?? ""),
        ).length;
        const live = db.campaigns.filter(
          (c) => brandIds.includes(c.workspaceId) && !["approved", "delivered", "closed"].includes(c.state),
        ).length;
        const doing = follows
          ? "Usage and quality, every brand"
          : [
              expert && toCheck ? `${toCheck} ${toCheck === 1 ? "creative" : "creatives"} to check` : "",
              expert && plans ? `${plans} ${plans === 1 ? "plan" : "plans"} to check` : "",
              !expert && live ? `${live} ${live === 1 ? "campaign" : "campaigns"} under way` : "",
              brandNames,
            ]
              .filter(Boolean)
              .join(" · ") || "Nothing assigned";
        return {
          user: u,
          load: follows ? 0 : brandIds.length * 1.5,
          capacity: follows ? 0 : 4,
          checksToday: expert
            ? db.checks.filter((c) => c.expertId === u.id && c.state === "checked").length + (u.id === "u-anna" ? 6 : 2)
            : 0,
          minutesPerCheck: u.id === "u-anna" ? 4 : 6,
          brandIds,
          doing,
          follows,
        };
      });

  // A simulated Engine: the running run makes one more creative every few seconds, and finishes.
  const tick = setInterval(() => {
    // The expert checks the directions the Engine made on the tick after; only then does the customer see them.
    // (The demo plays the expert and the operator here: the set is checked and released together.)
    for (const d of db.directions.filter((x) => x.state === "in_check")) {
      d.state = "proposed";
      const c = db.campaigns.find((x) => x.id === d.campaignId);
      if (c && c.state === "in_production") c.state = "in_review";
      if (c) emit({ type: "campaign.state", campaign: c });
    }
    for (const run of db.runs.filter((r) => r.state === "running")) {
      if (run.made < run.total) {
        run.made += 1;
        const step = run.steps.find((s) => s.state === "active");
        if (step) step.detail = `${run.made} of ${run.total}`;
        if (run.made === run.total) {
          if (step) step.state = "done";
          const gate = run.steps.find((s) => s.state === "waiting");
          if (gate) gate.state = "active";
          run.state = "done";
          db.directions
            .filter((d) => d.campaignId === run.campaignId && d.state === "making")
            .forEach((d) => (d.state = "in_check"));
        }
        emit({ type: "run.progress", run });
      }
    }
  }, 6000);
  (tick as unknown as { unref?: () => void }).unref?.();

  const v3 = v3Api({
    db,
    wait,
    now,
    nextId,
    emit,
    me,
    workspaceId: () => workspaceId,
    mustStaff,
    mustApprove,
    send: (threadId, text, attachments) => api.send(threadId, text, attachments),
    latency,
    setVersion, // round 12 QA: a check in Check moves the creative and the campaign's counts
    recount,
  });

  /** Round 11: the agency layer (r11-agency.ts); its wraps read the calls as they were before them. */
  let beforeAgency: FumeApi | undefined;
  const agency = r11AgencyApi({
    db: db as unknown as Parameters<typeof r11AgencyApi>[0]["db"],
    wait,
    now,
    nextId,
    emit,
    userId: () => userId,
    workspaceId: () => workspaceId,
    base: () => beforeAgency!,
    setVersion,
    recount,
  });

  /** Round 13 BRAND (r13-brand.ts): colour uses, imagery groups, the voice in five parts, Do and Don't, model sheets. */
  const r13brand = r13BrandApi({ db, wait, userId: () => userId, fresh: options.fresh });

  /** Round 13: the agency's Fume plan and asking Fume (r13-agency.ts); its wraps read the calls as they were before. */
  let beforeR13Agency: FumeApi | undefined;
  const r13agency = r13AgencyApi({ db, userId: () => userId, now, nextId, wait, base: () => beforeR13Agency! });

  /** Round 13 CHAT (r13-chat.ts): meeting topics, the plan changed in the chat; its wraps read the calls as they were before. */
  let beforeR13Chat: FumeApi | undefined;
  const r13chat = r13ChatApi({
    db,
    wait,
    now,
    nextId,
    emit,
    say,
    latency,
    userId: () => userId,
    workspaceId: () => workspaceId,
    base: () => beforeR13Chat!,
  });

  const api: FumeApi = {
    async session(): Promise<Session> {
      const workspace = find(db.workspaces, workspaceId, "workspace");
      const visibleWorkspaces = isStaff()
        ? db.workspaces.filter(
            (w) => me().staffRole === "admin" || db.staff.some((s) => s.userId === userId && s.workspaceId === w.id),
          )
        : db.workspaces.filter((w) => db.memberships.some((m) => m.userId === userId && m.workspaceId === w.id));
      return wait({
        user: me(),
        workspace,
        organisation: find(db.organisations, workspace.organisationId, "organisation"),
        role: role(),
        workspaces: visibleWorkspaces,
        onboarded: db.brandDna.state === "approved" || db.brandDna.version > 0,
      });
    },

    async switchWorkspace(id) {
      find(db.workspaces, id, "workspace");
      workspaceId = id;
      return api.session();
    },

    async home(): Promise<HomeView> {
      const campaigns = myCampaigns();
      const waitingOnYou: WaitingItem[] = [];
      for (const c of campaigns) {
        const brief = db.briefs.find((b) => b.campaignId === c.id);
        if (c.state === "awaiting_input") {
          const thread = db.threads.find((t) => t.campaignId === c.id);
          waitingOnYou.push({
            id: `w-${c.id}`,
            kind: "question",
            campaignId: c.id,
            title: c.name,
            detail: brief?.missing[0]
              ? `Fume needs ${brief.missing[0].charAt(0).toLowerCase()}${brief.missing[0].slice(1)}`
              : "Fume has a question",
            href: openQuestion(questions, c.id)?.href ?? `/fume/${thread?.id ?? "t-general"}`,
          });
        }
        if (brief?.state === "ready")
          waitingOnYou.push({
            id: `wb-${c.id}`,
            kind: "brief",
            campaignId: c.id,
            title: c.name,
            detail: "Your brief is ready to send",
            href: `/campaigns/${c.id}/plan`,
          });
        // Round 10: the plan, checked and ready, waits on her before the Engine makes anything.
        if (c.stage === "plan" && db.plans.some((p) => p.campaignId === c.id && p.state === "ready"))
          waitingOnYou.push({
            id: `wpl-${c.id}`,
            kind: "plan",
            campaignId: c.id,
            title: c.name,
            detail: "The plan is ready. Approve it and Fume starts.",
            href: `/campaigns/${c.id}/plan`,
          });
        if (db.directions.some((d) => d.campaignId === c.id && d.state === "proposed"))
          waitingOnYou.push({
            id: `wd-${c.id}`,
            kind: "directions",
            campaignId: c.id,
            title: c.name,
            detail: "Three directions are ready. Pick one to take forward.",
            href: `/campaigns/${c.id}/review`,
          });
        if (c.counts.checked > 0 && c.state !== "in_production")
          waitingOnYou.push({
            id: `wc-${c.id}`,
            kind: "creatives",
            campaignId: c.id,
            title: c.name,
            detail: `${c.counts.checked} checked creatives are ready for you`,
            count: c.counts.checked,
            dueAt: c.dueAt,
            href: `/campaigns/${c.id}/review`,
          });
      }
      for (const p of inWorkspace(db.products).filter((p) => p.state === "needs_you")) {
        waitingOnYou.push({
          id: `wp-${p.id}`,
          kind: "product",
          title: `${p.name} ${p.variant}`,
          detail: "Confirm what Fume read about this product",
          href: `/brand/products/${p.id}`,
        });
      }
      return wait({
        waitingOnYou,
        inProduction: campaigns
          .filter(
            (c) =>
              ["scoped", "in_production", "revision"].includes(c.state) ||
              (c.state === "in_review" && c.counts.inCheck > 0),
          )
          .map((campaign) => ({
            campaign,
            run:
              db.runs.find((r) => r.campaignId === campaign.id && r.state !== "done") ??
              db.runs.find((r) => r.campaignId === campaign.id),
            clock: db.clocks.find((k) => k.campaignId === campaign.id),
          })),
        fumeNeeds: db.understanding.unknowns
          .filter((u) => !u.answer)
          .map((u) => ({ id: u.id, text: u.question, href: "/brand" })),
        recentlyApproved: db.creatives
          .filter((c) => campaigns.some((k) => k.id === c.campaignId) && c.current.state === "approved")
          .slice(0, 4),
        deliveries: db.deliveries.filter((d) => campaigns.some((k) => k.id === d.campaignId)),
        learned: db.memory.slice(-3).reverse(),
        usage: {
          creativesUsed: campaigns
            .filter((c) => !["delivered", "closed"].includes(c.state))
            .reduce((n, c) => n + c.counts.creatives, 0),
          creativeCap: find(
            db.packages,
            find(db.organisations, find(db.workspaces, workspaceId, "workspace").organisationId, "organisation")
              .packageId,
            "package",
          ).creativeCap,
          campaignsActive: campaigns.filter((c) => !["delivered", "closed"].includes(c.state)).length,
          periodEndsAt: seed.inDays(17),
        },
      });
    },

    // ── Brand DNA ──
    async brandDna() {
      return wait({
        dna: db.brandDna,
        rules: db.rules,
        products: inWorkspace(db.products),
        references: db.references,
        tastePairs: db.tastePairs,
        memory: db.memory,
        assets: db.assets,
        understanding: db.understanding,
      });
    },
    async updateRule(rule) {
      const i = db.rules.findIndex((r) => r.id === rule.id);
      if (i < 0) throw new FumeError("not_found", "No such rule");
      db.rules[i] = { ...rule, source: "verified" };
      return wait(db.rules[i]);
    },
    async addRule(input) {
      const rule: BrandRule = { ...input, id: nextId("r"), source: "supplied", confidence: "high" };
      db.rules.push(rule);
      return wait(rule);
    },
    async product(id) {
      return wait(find(db.products, id, "product"));
    },
    async verifyFact(factId) {
      const f = db.products.flatMap((p) => p.facts).find((x) => x.id === factId);
      if (!f) throw new FumeError("not_found", "No such fact");
      Object.assign(f, { source: "verified", confidence: "high", verifiedBy: userId, verifiedAt: now() });
      settleProduct(factId);
      return wait(f);
    },
    async correctFact(factId, statement) {
      const f = db.products.flatMap((p) => p.facts).find((x) => x.id === factId);
      if (!f) throw new FumeError("not_found", "No such fact");
      Object.assign(f, { statement, source: "verified", confidence: "high", verifiedBy: userId, verifiedAt: now() });
      settleProduct(factId);
      return wait(f);
    },
    async verifyProduct(id) {
      const p = find(db.products, id, "product");
      if (p.facts.some((f) => f.source === "unknown")) throw new FumeError("invalid", "Answer every open line first.");
      p.facts.forEach((f) => Object.assign(f, { source: "verified", verifiedBy: userId, verifiedAt: now() }));
      p.state = "verified";
      return wait(p);
    },
    async addProduct(input) {
      const p = {
        id: nextId("pr"),
        workspaceId,
        name: input.name,
        variant: input.variant,
        state: "needs_you" as const,
        images: [],
        facts: [],
      };
      db.products.push(p);
      return wait(p);
    },
    async addReference(input) {
      const r = { id: nextId("ref"), addedBy: userId, ...input };
      db.references.push(r);
      return wait(r);
    },
    async chooseTastePair(pairId, chosen, reason) {
      const p = find(db.tastePairs, pairId, "pair");
      Object.assign(p, { chosen, reason });
      return wait(p);
    },
    async answerUnderstanding(input) {
      const u = db.understanding;
      if (input.unknownId) Object.assign(find(u.unknowns, input.unknownId, "question"), { answer: input.answer });
      if (input.directionId)
        Object.assign(find(u.testDirections, input.directionId, "direction"), {
          verdict: input.verdict,
          reason: input.reason,
        });
      return wait(u);
    },
    async approveBrandDna() {
      mustApprove();
      Object.assign(db.brandDna, {
        state: "approved",
        version: db.brandDna.version + 1,
        approvedBy: userId,
        approvedAt: now(),
      });
      return wait(db.brandDna);
    },
    async uploadSourceAssets(files) {
      const added = files.map((f) => ({ id: nextId("a"), uploadedBy: userId, at: now(), ...f }));
      db.assets.push(...added);
      return wait(added);
    },

    // ── Campaigns ──
    async campaigns(filter) {
      let list = myCampaigns();
      if (filter?.state?.length) list = list.filter((c) => filter.state!.includes(c.state));
      if (filter?.search) list = list.filter((c) => c.name.toLowerCase().includes(filter.search!.toLowerCase()));
      return wait(list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    },
    async campaign(id) {
      const campaign = campaignOf(id);
      const brief = db.briefs.find((b) => b.campaignId === id) ?? {
        campaignId: id,
        version: 1,
        state: "drafting" as const,
        objective: "",
        audience: "",
        message: "",
        mandatory: [],
        never: [],
        channels: [],
        formats: [],
        creatives: 0,
        references: [],
        missing: [],
      };
      return wait({
        campaign,
        brief,
        directions: db.directions.filter(
          (d) => d.campaignId === id && (isStaff() || !["making", "in_check"].includes(d.state)),
        ),
        creatives: db.creatives.filter((c) => c.campaignId === id && visible(c)),
        runs: db.runs.filter((r) => r.campaignId === id),
        clock: db.clocks.find((k) => k.campaignId === id),
        record: db.record.filter((e) => e.campaignId === id).sort((a, b) => b.at.localeCompare(a.at)),
        approver: user(campaign.approverId),
        people: db.memberships.filter((m) => m.workspaceId === campaign.workspaceId).map((m) => user(m.userId)),
        threadId: db.threads.find((t) => t.campaignId === id)?.id ?? "t-general",
      });
    },
    async startCampaign({ text, productIds }) {
      // Fume reads what it can from the first line (the products, the occasion, where it runs, the date), so it only
      // asks what it cannot infer, one question at a time, then the brief card (UX review C1). Walk-through Must 2:
      // no product named → Fume asks with the product grid; a real name and objective; the audience in words; and an
      // open campaign with the same occasion is offered before a second one is made. The market comes from Settings.
      const said = text.toLowerCase();
      const mine = db.products.filter((p) => p.workspaceId === workspaceId);
      const said_ = productIds?.length ? mine.filter((p) => productIds.includes(p.id)) : productsNamed(said, mine);
      // Only products with confirmed facts can be made; one named but not confirmed is asked about with the grid.
      const named = said_.filter((p) => p.state === "verified");
      const waiting = said_.filter((p) => p.state !== "verified");
      const occasion = occasionOf(said);
      const name = campaignName(occasion, named);
      const general = db.threads.find(
        (t) => t.workspaceId === workspaceId && t.kind !== "contact" && t.campaignId === null,
      );
      const same = sameCampaign(inWorkspace(db.campaigns), occasion, name);
      if (same && general && !startingAnyway) {
        // "You already have Black Friday, due 13 Nov. Add to it or start a new one?"
        say(general.id, { author: { kind: "person", userId }, text });
        const due = same.dueAt
          ? `, due ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Europe/Oslo" }).format(Date.parse(same.dueAt))}`
          : "";
        const ask = "Add to it or start a new one?";
        pendingStart.set(general.id, { text, productIds: named.map((p) => p.id), campaignId: same.id });
        setTimeout(
          () =>
            say(general.id, {
              author: { kind: "fume" },
              text: `You already have ${same.name}${due}.`,
              card: {
                kind: "question",
                question: ask,
                why: "One campaign per occasion keeps the brief, the creatives and the deliveries together.",
                options: [`Add to ${same.name}`, "Start a new one"],
              },
            }),
          latency * 6,
        );
        return wait({ campaign: same, threadId: general.id });
      }
      startingAnyway = false;
      const id = nextId("c");
      const products = named.map((p) => p.id);
      const channels: Channel[] = [
        ...(/paid|ads?\b|annonse/.test(said) ? (["paid_social"] as const) : []),
        ...(/organic|instagram|social/.test(said) && !/paid/.test(said) ? (["organic_social"] as const) : []),
        ...(/e-?mail|newsletter|nyhetsbrev/.test(said) ? (["email"] as const) : []),
      ];
      const day = /\b(\d{1,2})\.?\s*(jan|feb|mar|apr|may|mai|jun|jul|aug|sep|oct|okt|nov|dec|des)/.exec(said);
      const dated = Boolean(day);
      const month = day
        ? ["jan", "feb", "mar", "apr", "ma", "jun", "jul", "aug", "sep", "o", "nov", "d"].findIndex((m) =>
            day[2].startsWith(m),
          )
        : -1;
      const today = new Date(now());
      const live =
        day && month >= 0
          ? new Date(
              Date.UTC(today.getUTCFullYear() + (month < today.getUTCMonth() ? 1 : 0), month, +day[1], 15),
            ).toISOString()
          : undefined;
      const workspace = db.workspaces.find((w) => w.id === workspaceId) as
        { market?: string; language?: string } | undefined;
      const campaign: Campaign = {
        id,
        workspaceId,
        name,
        productIds: products,
        state: "draft",
        stage: "brief",
        approverId: role() === "owner" || role() === "approver" ? userId : "u-maja",
        channels: channels.length ? channels : ["paid_social"],
        formats: ["feed", "story"],
        market: workspace?.market ?? "Norway",
        language: workspace?.language ?? "Norwegian",
        dueAt: live,
        createdBy: userId,
        createdAt: now(),
        updatedAt: now(),
        counts: { creatives: 0, inCheck: 0, checked: 0, approved: 0, delivered: 0 },
        roundsUsed: 0,
        roundsIncluded: 2,
        brandDnaVersion: db.brandDna.version,
      };
      db.campaigns.push(campaign);
      const threadId = nextId("t");
      // No product named: Fume asks with the grid first; the answer names the campaign and writes its objective.
      const ask: BriefQuestion = {
        key: "product",
        missing: productQuestion.missing,
        // Round 8 (CHAT, TASK-10): no "facts", and the way on is named; confirming what she named answers it (TASK-1).
        // Round 9 (CHAT, DLOAD-1): "check" is the expert's word; she confirms.
        text: waiting.length
          ? `${waiting.map((p) => p.name).join(" and ")} ${waiting.length === 1 ? "is" : "are"} not confirmed yet, so we cannot make ${waiting.length === 1 ? "it" : "them"}. Confirm ${waiting.length === 1 ? "its" : "their"} details now, or tick a product that is ready.`
          : productQuestion.text,
        question: productQuestion.question,
        why: productQuestion.why,
        options: [],
        productIds: [...waiting, ...mine.filter((p) => !waiting.includes(p))].map((p) => p.id),
        named: waiting.map((p) => p.id),
        fill: (answer, c, brief) => {
          const picked = productsNamed(answer, mine).filter((p) => p.state === "verified");
          c.productIds = picked.map((p) => p.id);
          c.name = campaignName(occasion, picked);
          brief.objective = objectiveOf(occasion, picked, c.channels);
          const t = db.threads.find((x) => x.id === threadId);
          if (t) t.title = c.name;
        },
      };
      // Round 8 (CHAT, TASK-8): the audience she wrote is not asked again; the dates fit the occasion; the message is
      // asked last with Fume's suggestion and the brand's last approved line as the pills (TASK-2).
      const heard = audienceIn(said);
      const lastMessage = inWorkspace(db.campaigns)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((c) => db.briefs.find((b) => b.campaignId === c.id && b.state === "approved" && b.message.trim()))
        .find(Boolean)?.message;
      const questions = [
        ...(products.length ? [] : [ask]),
        ...briefQuestions.filter(
          (q) => q.key !== "market" && (q.key !== "date" || !dated) && (q.key !== "audience" || !heard),
        ),
      ].map((q) =>
        q.key === "date"
          ? { ...q, ...dateOptions(occasion) }
          : q.key === "message"
            ? { ...q, ...messageOptions(occasion, lastMessage) }
            : q,
      );
      db.briefs.push({
        campaignId: id,
        version: 1,
        state: "drafting",
        objective: objectiveOf(occasion, named, campaign.channels),
        audience: heard ?? "",
        message: "",
        mandatory: [],
        never: [],
        channels: campaign.channels,
        formats: campaign.formats,
        creatives: 0,
        references: [],
        missing: questions.map((q) => q.missing),
      });
      drafting.set(id, questions);
      db.threads.push({ id: threadId, workspaceId, campaignId: id, title: campaign.name, updatedAt: now(), unread: 0 });
      say(threadId, { author: { kind: "person", userId }, text });
      const first = questions[0];
      setTimeout(
        () => say(threadId, { author: { kind: "fume" }, text: first.text, card: questionCard(first) }),
        latency * 6,
      );
      return wait({ campaign, threadId });
    },
    // approveBrief: round 10 sends the brief and starts the plan (r10-plan.ts, sendBrief).
    async changeBrief(campaignId, change) {
      const b = db.briefs.find((x) => x.campaignId === campaignId);
      if (!b) throw new FumeError("not_found", "No brief");
      // A line changed before approval is the same version; a change after it makes the next one (walk-through Must 12).
      Object.assign(b, change, {
        version: b.state === "approved" ? b.version + 1 : b.version,
        state: b.missing.length ? b.state : "ready",
      });
      return wait(b);
    },
    async chooseDirection(directionId, reason) {
      mustApprove();
      const d = find(db.directions, directionId, "direction");
      db.directions
        .filter((x) => x.campaignId === d.campaignId && x.id !== d.id && x.state === "proposed")
        .forEach((x) => Object.assign(x, { state: "passed", decidedBy: userId, decidedAt: now() }));
      Object.assign(d, { state: "chosen", decidedBy: userId, decidedAt: now(), reason });
      const c = campaignOf(d.campaignId);
      Object.assign(c, { chosenDirectionId: d.id, stage: "masters", state: "in_production" });
      emit({ type: "campaign.state", campaign: c });
      return wait(d);
    },
    async passDirections(campaignId, reason) {
      mustApprove();
      const list = db.directions.filter((d) => d.campaignId === campaignId && d.state === "proposed");
      list.forEach((d) => Object.assign(d, { state: "passed", decidedBy: userId, decidedAt: now(), reason }));
      return wait(list);
    },
    async creatives(campaignId, filter) {
      let list = db.creatives.filter((c) => c.campaignId === campaignId && visible(c));
      if (filter?.state?.length) list = list.filter((c) => filter.state!.includes(c.current.state));
      if (filter?.format?.length) list = list.filter((c) => filter.format!.includes(c.format));
      if (filter?.directionId) list = list.filter((c) => c.directionId === filter.directionId);
      if (filter?.kind) list = list.filter((c) => c.kind === filter.kind);
      return wait(list);
    },
    async creative(id) {
      const creative = find(db.creatives, id, "creative");
      if (!visible(creative)) throw new FumeError("not_found", "No such creative");
      return wait({
        creative,
        campaign: campaignOf(creative.campaignId),
        siblings: db.creatives.filter((c) => c.campaignId === creative.campaignId && visible(c)).map((c) => c.id),
      });
    },

    // ── Review ──
    async reviewQueue(): Promise<ReviewItem[]> {
      const items: ReviewItem[] = [];
      for (const campaign of myCampaigns()) {
        const directions = db.directions.filter((d) => d.campaignId === campaign.id && d.state === "proposed");
        const creatives = db.creatives.filter(
          (c) => c.campaignId === campaign.id && c.current.state === "checked" && visible(c),
        );
        if (directions.length)
          items.push({ campaign, kind: "directions", directions, creatives: [], dueAt: campaign.dueAt });
        if (creatives.length)
          items.push({ campaign, kind: "creatives", directions: [], creatives, dueAt: campaign.dueAt });
        if (db.briefs.find((b) => b.campaignId === campaign.id)?.state === "ready")
          items.push({ campaign, kind: "brief", directions: [], creatives: [] });
      }
      return wait(items);
    },
    async approve(versionIds) {
      mustApprove();
      const done: CreativeVersion[] = [];
      for (const vid of versionIds) {
        const c = db.creatives.find((x) => x.current.id === vid);
        if (!c) throw new FumeError("not_found", `No version ${vid}`);
        if (c.current.state !== "checked") throw new FumeError("conflict", "Only checked creatives can be approved.");
        setVersion(c, { state: "approved", approvedBy: userId, approvedAt: now() });
        done.push(c.current);
      }
      const touched = new Set(versionIds.map((v) => db.creatives.find((c) => c.current.id === v)!.campaignId));
      touched.forEach((id) => recount(campaignOf(id)));
      db.record.push({
        id: nextId("e"),
        workspaceId,
        campaignId: [...touched][0],
        subjectId: versionIds[0],
        actor: { kind: "person", userId },
        action: "approved",
        detail: `${versionIds.length} creatives approved`,
        at: now(),
      });
      return wait(done);
    },
    async requestChanges({ versionId, pins, tags, text }) {
      const c = db.creatives.find((x) => x.current.id === versionId);
      if (!c) throw new FumeError("not_found", "No such creative");
      const campaign = campaignOf(c.campaignId);
      const isCorrection = tags.includes("product");
      if (!isCorrection && campaign.roundsUsed >= campaign.roundsIncluded)
        throw new FumeError(
          "conflict",
          "The rounds in your package are used for this campaign. Ask Fume for an extra round.",
        );
      if (!isCorrection) campaign.roundsUsed += 1;
      setVersion(c, { state: "changes_requested" });
      const next: CreativeVersion = {
        ...c.current,
        id: nextId("v"),
        number: c.current.number + 1,
        state: "making",
        madeAt: now(),
        checkedAt: undefined,
        checkedBy: undefined,
      };
      c.versions.push(next);
      c.current = next;
      campaign.state = "revision";
      recount(campaign);
      db.record.push({
        id: nextId("e"),
        workspaceId,
        campaignId: campaign.id,
        subjectId: c.id,
        actor: { kind: "person", userId },
        action: "changes_requested",
        detail: `${text}${pins.length ? ` (${pins.length} pins)` : ""}`,
        at: now(),
      });
      return wait({
        version: next,
        usesRound: !isCorrection,
        roundsLeft: campaign.roundsIncluded - campaign.roundsUsed,
      });
    },

    // ── Deliveries ──
    async deliveries() {
      const ids = new Set(myCampaigns().map((c) => c.id));
      return wait(
        db.deliveries.filter((d) => ids.has(d.campaignId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
    },
    async delivery(id) {
      const delivery = find(db.deliveries, id, "delivery");
      return wait({
        delivery,
        campaign: campaignOf(delivery.campaignId),
        creatives: db.creatives.filter((c) => delivery.creativeIds.includes(c.id)),
      });
    },
    // downloadUrl: round 9 CAMPAIGN packs one real zip (r9-campaign.ts).
    async confirmLive(id) {
      const d = find(db.deliveries, id, "delivery");
      d.state = "confirmed_live";
      return wait(d);
    },

    // ── Fume ──
    async threads() {
      return wait(inWorkspace(db.threads).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    },
    async messages(threadId) {
      const t = find(db.threads, threadId, "thread");
      t.unread = 0;
      return wait(db.messages.filter((m) => m.threadId === threadId).sort((a, b) => a.at.localeCompare(b.at)));
    },
    async send(threadId, text, attachments) {
      const t = find(db.threads, threadId, "thread");
      const m = say(threadId, {
        author: { kind: "person", userId },
        text,
        attachments: attachments?.map((a) => ({ id: nextId("att"), kind: "document" as const, ...a })),
      });
      t.updatedAt = m.at;
      // v2: the Contact thread is people; Fume (AI) never answers there (FLOWS §1.2).
      if (t.kind === "contact") return wait(m);
      // "Add to it or start a new one?": the answer to Fume's duplicate question (walk-through Must 2).
      const pending = pendingStart.get(threadId);
      if (pending) {
        pendingStart.delete(threadId);
        const existing = campaignOf(pending.campaignId);
        if (/start|new|ny/i.test(text) && !/add|legg/i.test(text)) {
          startingAnyway = true;
          setTimeout(() => void api.startCampaign({ text: pending.text, productIds: pending.productIds }), latency * 4);
          return wait(m);
        }
        const added = db.products.filter(
          (p) => pending.productIds.includes(p.id) && !existing.productIds.includes(p.id),
        );
        existing.productIds = [...existing.productIds, ...added.map((p) => p.id)];
        existing.updatedAt = now();
        // The answer goes to the campaign's own thread (made now if it had none), so its brief card shows in full.
        let thread = db.threads.find((x) => x.campaignId === existing.id && x.kind !== "contact");
        if (!thread) {
          thread = {
            id: nextId("t"),
            workspaceId,
            campaignId: existing.id,
            title: existing.name,
            updatedAt: now(),
            unread: 0,
          };
          db.threads.push(thread);
        }
        setTimeout(() => {
          say(thread?.id ?? threadId, {
            author: { kind: "fume" },
            text: added.length
              ? `${added.map((p) => p.name).join(" and ")} is in ${existing.name} now. Here is its brief.`
              : `${existing.name} it is. Here is its brief; tell us what to add.`,
            card: {
              kind: "brief",
              campaignId: existing.id,
              version: db.briefs.find((x) => x.campaignId === existing.id)?.version ?? 1,
            },
          });
          emit({ type: "campaign.state", campaign: existing });
        }, latency * 6);
        return wait(m);
      }
      // Fume answers. A brief still missing something takes the answer in; once nothing is missing it is ready to approve.
      const brief = t.campaignId ? db.briefs.find((b) => b.campaignId === t.campaignId) : undefined;
      setTimeout(() => {
        const asked = brief ? drafting.get(brief.campaignId) : undefined;
        if (brief?.state === "drafting" && asked?.length) {
          // A campaign started in the chat: the answer fills its line, then the next question or the brief card.
          const c = campaignOf(brief.campaignId);
          const q = asked.shift()!;
          q.fill(text, c, brief);
          // No confirmed product in the answer: the product question stays (walk-through Must 2: never 0 products).
          if (q.key === "product" && !c.productIds.length) {
            asked.unshift(q);
            say(threadId, {
              author: { kind: "fume" },
              text: "We found no confirmed product in that. Tick one in the grid, or confirm a product’s details first.",
              card: questionCard(q),
            });
            emit({ type: "campaign.state", campaign: c });
            return;
          }
          brief.missing.shift();
          const next = asked[0];
          if (next) say(threadId, { author: { kind: "fume" }, text: next.text, card: questionCard(next) });
          else {
            drafting.delete(brief.campaignId);
            Object.assign(brief, { state: "ready", creatives: brief.formats.length * 4 });
            // Round 9 (CHAT): the same words whether the brief is a card here or the panel beside the conversation.
            // Round 10 (CHAT): she sends the brief; Fume writes the plan; nothing is made before she approves the plan.
            say(threadId, {
              author: { kind: "fume" },
              text: `That is all we need. The brief for ${c.name} is ready. Send it when it reads right; nothing is made before you approve the plan.`,
              card: { kind: "brief", campaignId: brief.campaignId, version: brief.version },
            });
          }
          c.updatedAt = now();
          emit({ type: "campaign.state", campaign: c });
        } else if (brief?.state === "drafting") {
          brief.missing.shift();
          if (brief.missing.length === 0) {
            brief.state = "ready";
            say(threadId, {
              author: { kind: "fume" },
              text: "Thanks, that was the last thing. Here is your brief. Send it when it reads right; nothing is made before you approve the plan.",
              card: { kind: "brief", campaignId: brief.campaignId, version: brief.version },
            });
          } else
            say(threadId, {
              author: { kind: "fume" },
              text: `Thanks, that is in the brief. One more thing: ${brief.missing[0].charAt(0).toLowerCase()}${brief.missing[0].slice(1)}.`,
            });
          const c = db.campaigns.find((x) => x.id === brief.campaignId);
          if (c) emit({ type: "campaign.state", campaign: c });
        } else
          say(threadId, { author: { kind: "fume" }, text: "Thanks. We have that now and will come back to you here." });
      }, latency * 8);
      return wait(m);
    },

    // ── Team ──
    async team() {
      return wait({
        members: db.memberships
          .filter((m) => m.workspaceId === workspaceId)
          .map((membership) => ({ user: user(membership.userId), membership })),
        invitations: db.invitations.filter((i) => i.workspaceId === workspaceId),
        fumeTeam: db.staff.filter((s) => s.workspaceId === workspaceId).map((s) => user(s.userId)),
      });
    },
    async people() {
      const ids = new Set([
        ...db.memberships.filter((m) => m.workspaceId === workspaceId).map((m) => m.userId),
        ...db.staff.filter((s) => s.workspaceId === workspaceId).map((s) => s.userId),
      ]);
      return wait(db.users.filter((u) => ids.has(u.id)));
    },
    async invite(email, r) {
      if (role() !== "owner") throw new FumeError("forbidden", "Only the owner invites people.");
      const inv = {
        id: nextId("inv"),
        workspaceId,
        email,
        role: r,
        invitedBy: userId,
        state: "sent" as const,
        at: now(),
      };
      db.invitations.push(inv);
      return wait(inv);
    },
    async changeRole(uid, r) {
      const m = db.memberships.find((x) => x.userId === uid && x.workspaceId === workspaceId);
      if (!m) throw new FumeError("not_found", "Not in this workspace");
      m.role = r;
      return wait(m);
    },
    async removeMember(uid) {
      db.memberships = db.memberships.filter((x) => !(x.userId === uid && x.workspaceId === workspaceId));
      return wait(undefined);
    },
    async setApprover(campaignId, uid) {
      const c = campaignOf(campaignId);
      c.approverId = uid;
      return wait(c);
    },

    // ── Settings ──
    async settings() {
      const workspace = find(db.workspaces, workspaceId, "workspace");
      const pkg = find(
        db.packages,
        find(db.organisations, workspace.organisationId, "organisation").packageId,
        "package",
      );
      const home = await api.home();
      return wait({
        workspace,
        package: pkg,
        usage: home.usage,
        notificationPrefs: [
          { kind: "checked", label: "Creatives are checked and ready for you", email: true, inApp: true },
          { kind: "waiting_on_you", label: "Fume needs something from you", email: true, inApp: true },
          { kind: "engine_done", label: "The Engine finished a run", email: false, inApp: true },
          { kind: "delivered", label: "A delivery is ready", email: true, inApp: true },
          { kind: "mention", label: "Someone mentions you", email: true, inApp: true },
        ],
      });
    },
    async updateWorkspace(change) {
      const w = find(db.workspaces, workspaceId, "workspace");
      Object.assign(w, change);
      return wait(w);
    },

    // ── Notifications ──
    async notifications() {
      return wait(db.notifications.filter((n) => n.userId === userId).sort((a, b) => b.at.localeCompare(a.at)));
    },
    async markRead(ids) {
      db.notifications
        .filter((n) => n.userId === userId && (ids === "all" || ids.includes(n.id)))
        .forEach((n) => (n.read = true));
      return wait(undefined);
    },

    // ── Studio ──
    async checkQueue(): Promise<QueueItem[]> {
      mustStaff();
      return wait(queueItems());
    },
    async check(id) {
      mustStaff();
      const check = find(db.checks, id, "check");
      if (check.state === "waiting") Object.assign(check, { state: "in_check", startedAt: now() });
      return wait(checkView(check, openChecks()));
    },
    async passItem(id, itemId) {
      const check = find(db.checks, id, "check");
      const item = find(check.items, itemId, "item");
      item.result = item.result === "pass" ? "pending" : "pass";
      return wait(check);
    },
    async addNote(id, note) {
      const check = find(db.checks, id, "check");
      const n = {
        id: nextId("n"),
        number: check.notes.length + 1,
        author: userId,
        at: now(),
        x: note.x,
        y: note.y,
        text: note.text,
      };
      check.notes.push(n);
      if (note.itemId) Object.assign(find(check.items, note.itemId, "item"), { result: "note", noteId: n.id });
      return wait(check);
    },
    async markChecked(id) {
      mustStaff();
      const check = find(db.checks, id, "check");
      Object.assign(check, { state: "checked", checkedAt: now() });
      check.items.forEach((i) => i.result === "pending" && (i.result = "pass"));
      const creative = find(db.creatives, check.creativeId, "creative");
      setVersion(creative, { state: "checked", checkedBy: userId, checkedAt: now() });
      recount(campaignOf(check.campaignId));
      db.record.push({
        id: nextId("e"),
        workspaceId: check.workspaceId,
        campaignId: check.campaignId,
        subjectId: creative.id,
        actor: { kind: "person", userId },
        action: "checked",
        detail: `${creative.title} checked`,
        at: now(),
      });
      return wait(check);
    },
    async requestCorrection(id) {
      mustStaff();
      const check = find(db.checks, id, "check");
      check.state = "changes_requested";
      setVersion(find(db.creatives, check.creativeId, "creative"), { state: "correcting" });
      return wait(check);
    },
    async hold(id, reason) {
      mustStaff();
      const check = find(db.checks, id, "check");
      check.state = "held";
      setVersion(find(db.creatives, check.creativeId, "creative"), { state: "held", heldReason: reason });
      return wait(check);
    },
    async release(campaignId) {
      mustStaff();
      const c = campaignOf(campaignId);
      c.state = "in_review";
      sendHeld(db.creatives, campaignId); // round 13 (robots' note 06): the checks held since the last send go too
      emit({ type: "campaign.state", campaign: c });
      return wait(c);
    },
    async studioCampaigns() {
      mustStaff();
      return wait(studioRows());
    },
    async qualityLog() {
      mustStaff();
      return wait([...db.qualityLog].sort((a, b) => b.at.localeCompare(a.at)));
    },
    async teamLoad() {
      mustStaff();
      return wait(teamRows());
    },

    ...v2Api({
      db,
      wait,
      now,
      nextId,
      emit,
      me,
      workspaceId: () => workspaceId,
      mustStaff,
      mustApprove,
      queue: queueItems,
      studioRows,
      teamLoad: teamRows,
    }),
    ...v3,
    ...v4Api({
      db,
      wait,
      now,
      nextId,
      emit,
      me,
      workspaceId: () => workspaceId,
      mustStaff,
      latency,
      say: v3.say,
      startBatch: v3.startBatch,
      openDocument: v3.openDocument, // round 12 DESK: an Engine chat run's creative opens as one document
      qaQueue: v3.qaQueue, // round 12 DESK: whether Check holds a product-page creative yet
    }),
    ...v6Api({ db, wait, now, nextId, me, workspaceId: () => workspaceId }),
    ...v9Api({ db, wait, now, nextId, emit, me, mustApprove }), // round 7, worker X: first reading as a mind map, Update the brand
    ...r8OnbApi({ db, wait, fresh: options.fresh }), // round 8 ONB: continue where you left off; a fresh brand's honest start
    ...v8Api({ db, wait, now, nextId, me, workspaceId: () => workspaceId }), // round 7, worker W: Import products
    ...r8HomeApi({ db, questions, wait, now, userId: () => userId, workspaceId: () => workspaceId, emit }), // round 8 HOME: one question sheet
    ...r8ReviewApi({
      db,
      wait,
      now,
      nextId,
      userId: () => userId,
      workspaceId: () => workspaceId,
      mustApprove,
      campaignOf,
      setVersion,
      recount,
    }), // round 8 REVIEW: Approve with Undo, one change request per set
    ...r9CampaignApi({ db, wait }), // round 9 CAMPAIGN: every campaign's waits (one status sentence), Download all as one zip
    ...r9ReviewApi({ db, wait, campaignOf, setVersion, recount }), // round 9 VIEWER: Undo a change request just sent
    ...r10PlanApi({ db, wait, now, nextId, emit, say, userId: () => userId, isStaff, mustApprove }), // round 10: the plan before the Engine makes anything (sendBrief; approveBrief sends it)
    ...agency.calls, // round 11: the agency's Home, clients, licence, Send to client and the client link
    ...r13brand.calls, // round 13 BRAND: a colour's uses, a picture's group, the voice's parts, Neither, the profile
    ...r13agency.calls, // round 13 AGENCY: the agency's Fume plan, Borrow Fume's people, customer service
    ...r13CampaignApi({ db, wait, workspaceId: () => workspaceId, mustApprove }), // round 13 CAMPAIGN: skip the moodboard, the brief's templates and alternatives
    ...r13chat.calls, // round 13 CHAT: meeting topics, the plan changed with Fume in the chat

    subscribe(handler) {
      listeners.add(handler);
      return () => listeners.delete(handler);
    },
  };

  keepQuestions(api, () => settleQuestions(questions, db, { now, userId: () => userId, emit }));
  // Round 11 (FLOWS §24): session, switchWorkspace and approve change for the agency's people, over the finished api.
  beforeAgency = { ...api };
  Object.assign(
    api,
    agency.wraps,
    r11ClientApi({ db, userId: () => userId, workspaceId: () => workspaceId, base: () => beforeAgency! }),
  ); // round 11 CLIENT FLOW: Home in a client an agency runs
  Object.assign(api, r11PagesApi({ db, userId: () => userId, base: { ...api } })); // round 11 AGENCY PAGES: an agency checks only its own clients; an added client stays
  Object.assign(api, r13brand.wraps({ ...api })); // round 13 BRAND: the board carries the voice book
  beforeR13Agency = { ...api };
  Object.assign(api, r13agency.wraps); // round 13 AGENCY: a client's people with their role, a new client, the Engine's words for an agency
  beforeR13Chat = { ...api };
  Object.assign(api, r13chat.wraps); // round 13 CHAT: questions about what the app knows answered with a link, question templates

  return Object.assign(api, {
    /** Mock only: sign in as someone else (the demo's "View as"). */
    signInAs(id: Id) {
      userId = id;
      workspaceId = isStaff() ? workspaceId : (db.memberships.find((m) => m.userId === id)?.workspaceId ?? workspaceId);
    },
  });
}
