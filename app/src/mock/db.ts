// The mock's one in-memory database: a copy of the seed for each mock, set up as the demo starts (LYSNE as a Fume
// customer, the first run of a brand-new workspace, or LYSNE as Brygga Studio's client). Every domain module reads
// and writes these tables; nothing else holds state that a call returns, except the few per-mock memories in
// context.ts.
import type {
  Batch,
  Board,
  BrandDna,
  BrandIdentity,
  BrandModel,
  BrandPreset,
  BrandReference,
  BrandRule,
  BrandScan,
  BrandUpdate,
  Brief,
  CalendarEntry,
  CameraPreset,
  Campaign,
  CampaignPlan,
  CastMember,
  Category,
  Check,
  ClientSend,
  Collection,
  Creative,
  CreativeDocument,
  CreativeType,
  Delivery,
  DetailToken,
  Direction,
  EngineMessage,
  EngineRun,
  ImportJob,
  Invitation,
  LightPreset,
  Meeting,
  MemoryEntry,
  Membership,
  Message,
  Notification,
  OnboardingProgress,
  Organisation,
  Package,
  Placement,
  Product,
  ProductKind,
  QaItem,
  QualityLogEntry,
  Rating,
  RecordEvent,
  Reference,
  ReviewComment,
  Scene,
  ServiceClock,
  SourceAsset,
  StaffAssignment,
  StudioMode,
  StudioSession,
  TasteCard,
  TastePair,
  TasteState,
  Thread,
  Understanding,
  UsageRow,
  User,
  VoiceBook,
  Workspace,
} from "../contract";
import * as copy from "../copy";
import { agencyWhy } from "./agency";
import { writePlan } from "./plan";
import * as seed from "./seed";
import {
  AGENCY_ID,
  agencyPeople,
  clientOwners,
  clientPeople,
  FULL_CLIENT,
  FUME_CONTACT,
  summaryClients,
  swapIds,
  swapNames,
} from "./seed/agency";

/** An import job with where its script has got to. */
export type ImportRun = ImportJob & { step: number; stepAt: number; mapped?: boolean };

export interface Db {
  users: User[];
  workspaces: Workspace[];
  organisations: Organisation[];
  memberships: Membership[];
  invitations: Invitation[];
  staff: StaffAssignment[];
  packages: Package[];
  // Brand
  brandDna: BrandDna;
  rules: BrandRule[];
  references: Reference[];
  tastePairs: TastePair[];
  memory: MemoryEntry[];
  assets: SourceAsset[];
  understanding: Understanding;
  identity: BrandIdentity;
  boards: Board[];
  tasteCards: TasteCard[];
  tasteState: TasteState;
  voiceBook: VoiceBook;
  scan: BrandScan | null;
  brandUpdate: BrandUpdate | null;
  onboarding: OnboardingProgress;
  presets: BrandPreset[];
  models: BrandModel[];
  brandReferences: BrandReference[];
  // Products
  products: Product[];
  categories: Category[];
  collections: Collection[];
  productKinds: ProductKind[];
  detailTokens: DetailToken[];
  importJobs: ImportRun[];
  // Campaigns, plans and what is made
  campaigns: Campaign[];
  briefs: Brief[];
  directions: Direction[];
  clocks: ServiceClock[];
  plans: CampaignPlan[];
  calendar: CalendarEntry[];
  creatives: Creative[];
  runs: EngineRun[];
  batches: Batch[];
  engineMessages: EngineMessage[];
  usage: UsageRow[];
  // Studio
  modes: StudioMode[];
  documents: CreativeDocument[];
  placements: Placement[];
  cameras: CameraPreset[];
  lights: LightPreset[];
  creativeTypes: CreativeType[];
  cast: CastMember[];
  scenes: Scene[];
  sessions: StudioSession[];
  // Quality, review, delivery
  checks: Check[];
  qualityLog: QualityLogEntry[];
  qaItems: QaItem[];
  reviewComments: ReviewComment[];
  ratings: Rating[];
  record: RecordEvent[];
  deliveries: Delivery[];
  // Conversation and notifications
  threads: Thread[];
  messages: Message[];
  meetings: Meeting[];
  questions: seed.QuestionRecord[];
  notifications: Notification[];
  // The agency
  clientSends: ClientSend[];
}

export interface DbOptions {
  fresh?: boolean;
  agency?: boolean;
}

/** A new database for one mock. */
export function createDb(options: DbOptions = {}): Db {
  const db: Db = structuredClone({
    users: seed.users,
    workspaces: seed.workspaces,
    organisations: seed.organisations,
    memberships: seed.memberships,
    invitations: seed.invitations,
    staff: seed.staff,
    packages: seed.packages,
    brandDna: seed.brandDna,
    rules: seed.rules,
    references: seed.references,
    tastePairs: seed.tastePairs,
    memory: seed.memory,
    assets: seed.assets,
    understanding: seed.understanding,
    identity: seed.identity,
    boards: seed.boards,
    tasteCards: seed.tasteCards,
    tasteState: seed.tasteState,
    voiceBook: undefined as unknown as VoiceBook,
    scan: null,
    brandUpdate: null,
    onboarding: { step: "", lines: [] },
    presets: seed.presets,
    models: seed.models,
    brandReferences: seed.brandReferences,
    products: seed.products,
    categories: seed.categories,
    collections: seed.collections,
    productKinds: seed.productKinds,
    detailTokens: seed.detailTokens,
    importJobs: [],
    campaigns: seed.campaigns,
    briefs: seed.briefs,
    directions: seed.directions,
    clocks: seed.clocks,
    plans: [],
    calendar: seed.calendar,
    creatives: seed.creatives,
    runs: seed.runs,
    batches: seed.batches,
    engineMessages: seed.engineMessages,
    usage: seed.usage,
    modes: seed.modes,
    documents: seed.documents,
    placements: seed.placements,
    cameras: seed.cameras,
    lights: seed.lights,
    creativeTypes: seed.creativeTypes,
    cast: seed.cast,
    scenes: seed.scenes,
    sessions: seed.sessions,
    checks: seed.checks,
    qualityLog: seed.qualityLog,
    qaItems: seed.qaItems,
    reviewComments: seed.reviewComments,
    ratings: seed.ratings,
    record: seed.record,
    deliveries: seed.deliveries,
    threads: seed.threads,
    messages: seed.messages,
    meetings: seed.meetings,
    questions: [],
    notifications: seed.notifications,
    clientSends: [],
  });
  // See seed/products.ts: Night Body Oil's provenance is the seed's own object, shared by every mock.
  const oil = db.products.find((p) => p.id === "pr-oil");
  if (oil) oil.provenance = seed.oilAdded;

  // Winter gifting's plan waits on Maja; Black Friday's, written by Fume from its brief, is in check.
  db.plans = [seed.winterPlan];
  const bf = db.campaigns.find((c) => c.id === "c-bf");
  const bfBrief = db.briefs.find((b) => b.campaignId === "c-bf");
  if (bf && bfBrief) db.plans.push(seed.blackFridayPlan(writePlan(db, bf, bfBrief)));
  db.plans = structuredClone(db.plans);

  if (options.agency) agencyWorld(db);
  if (options.fresh) firstRun(db);

  // What Fume found on the website: approved by Maja, or in a first run waiting for her.
  const found = (evidence: string) => (options.fresh ? seed.proposed(evidence) : seed.engineFound(evidence));
  db.identity.imagery.push(...seed.moreImages(found));
  db.voiceBook = seed.voiceBook(found);
  db.questions = structuredClone(seed.seedQuestions);
  return db;
}

// ─── A first run: a brand-new workspace ─────────────────────────────────────

/** No history of any kind: what the Engine read is its proposal, not yet approved; nothing was chosen, answered, made
 *  or said before today. A brand read only from its website has no guide to disagree with and no moodboard pins the
 *  Engine proposed. */
function firstRun(db: Db) {
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
  const proposed = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(proposed);
    if (!node || typeof node !== "object") return;
    const o = node as Record<string, unknown>;
    if (typeof o.origin === "string" && typeof o.state === "string") {
      if (o.origin !== "customer") o.state = "proposed";
      delete o.by;
      delete o.at;
      delete o.was;
    }
    Object.values(o).forEach(proposed);
  };
  proposed(db.identity);
  proposed(db.boards);
  proposed(db.products);
  db.understanding = {
    ...db.understanding,
    version: 1,
    conflicts: [],
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
  for (const b of db.boards) b.items = b.items.filter((i) => i.provenance.origin === "customer");
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

// ─── The agency demo: LYSNE as Brygga Studio's client ───────────────────────

/** Swaps Fume's people for the agency's, in ids and in words. */
function swapDeep(node: unknown): unknown {
  if (typeof node === "string") return swapIds[node] ?? swapNames.reduce((s, [re, to]) => s.replace(re, to), node);
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) node[i] = swapDeep(node[i]);
    return node;
  }
  if (node && typeof node === "object") {
    const o = node as Record<string, unknown>;
    for (const k of Object.keys(o)) o[k] = swapDeep(o[k]);
  }
  return node;
}

/** The checks are the agency's own (Anna's become Nora's), the briefs and plans are the agency's, and no Fume expert
 *  checks a plan. Agency people work in every client: an assignment (what they can open) and the approver's seat for
 *  the brief and the plan (the agency is Fume's customer); creatives stay the client's to approve. */
function agencyWorld(db: Db) {
  // The agency's history in LYSNE: every table but who the people are (users, seats and assignments stay as seeded).
  const tables = db as unknown as Record<string, unknown>;
  for (const key of Object.keys(tables)) {
    if (["users", "memberships", "staff", "organisations", "workspaces", "questions", "clientSends"].includes(key))
      continue;
    tables[key] = swapDeep(tables[key]);
  }
  const people = structuredClone(agencyPeople);
  const clients = structuredClone(summaryClients);
  db.organisations.push(
    { id: AGENCY_ID, name: "Brygga Studio", packageId: "p-core", kind: "agency" },
    ...clients.map((c) => c.org),
  );
  const lysne = db.workspaces.find((w) => w.id === FULL_CLIENT);
  if (lysne) lysne.agencyId = AGENCY_ID;
  db.workspaces.push(...clients.map((c) => c.workspace));
  db.users.push(...people, ...structuredClone(clientPeople));
  for (const [ws, ids] of Object.entries(clientOwners))
    ids.forEach((userId) => db.memberships.push({ userId, workspaceId: ws, role: "owner" }));
  db.staff = db.staff.filter((s) => s.workspaceId !== FULL_CLIENT);
  for (const ws of [FULL_CLIENT, ...clients.map((c) => c.workspace.id)])
    for (const p of people) {
      db.staff.push({ userId: p.id, workspaceId: ws, staffRole: p.staffRole === "operator" ? "operator" : "expert" });
      db.memberships.push({ userId: p.id, workspaceId: ws, role: "approver" });
    }
  // Who said what: in LYSNE's Fume conversation it is the agency that talks to Fume, and it sent the briefs.
  const asAgency = (id?: string) => (id === "u-maja" ? "u-nora" : id);
  for (const m of db.messages) if (m.author.kind === "person") m.author.userId = asAgency(m.author.userId)!;
  for (const b of db.briefs) b.approvedBy = asAgency(b.approvedBy);
  // The agency checks a plan and sends it to the client; only the client approves it. An approved plan reads "Maja
  // approved it · Checked by Nora"; one in check is ready for Nora.
  for (const p of db.plans) {
    if (p.state === "approved") {
      p.checkedBy = "u-nora";
      p.checkedAt = p.checkedAt ?? p.approvedAt;
      continue;
    }
    delete p.checkedBy;
    delete p.checkedAt;
    if (p.state === "in_check") {
      Object.assign(p, { state: "ready", readyBy: undefined });
      const c = db.campaigns.find((x) => x.id === p.campaignId);
      if (c) c.state = "in_review";
    }
  }
  // Nora hears what the brand's activity says, as Maja does (the client keeps her own).
  db.notifications.push(
    ...db.notifications
      .filter((n) => n.userId === "u-maja")
      .map((n) => ({ ...n, id: `${n.id}-nora`, userId: "u-nora" })),
  );
  // Nora checked 6 of Autumn launch's creatives and sent the first 4 to Maja; 2 wait to be sent. The client sees a
  // checked creative only once it is sent, so Maja has 4 to approve.
  const checkedAutumn = db.creatives.filter((c) => c.campaignId === "c-autumn" && c.current.state === "checked");
  db.clientSends = checkedAutumn.length
    ? [
        {
          id: "cs-autumn-1",
          campaignId: "c-autumn",
          workspaceId: FULL_CLIENT,
          versionIds: checkedAutumn.slice(0, 4).map((c) => c.current.id),
          to: ["u-maja"],
          note: "The first four for the autumn launch. The last two follow once they are ready.",
          sentBy: "u-nora",
          sentAt: seed.at(4),
        },
      ]
    : [];
  // Nora checked Black Friday's plan and sent it to Maja with the campaign's client link, so both of the plan's states
  // show: Winter gifting waits for Nora's check, Black Friday waits on Maja.
  const bfPlan = db.plans.find((p) => p.campaignId === "c-bf" && p.state === "ready");
  if (bfPlan) {
    Object.assign(bfPlan, { checkedBy: "u-nora", checkedAt: seed.at(60 * 2) });
    db.clientSends.push({
      id: "cs-bf-plan",
      campaignId: "c-bf",
      workspaceId: FULL_CLIENT,
      versionIds: [],
      plan: { version: bfPlan.version },
      to: ["u-maja"],
      link: { token: "bfplan", url: "https://app.fumecreatives.com/c/bfplan", expiresAt: seed.at(-60 * 24 * 28) },
      note: "Black Friday on night black, with gold words. Tell me if the gold is too much.",
      sentBy: "u-nora",
      sentAt: seed.at(60 * 2),
    });
  }
  // The direction the agency chose is the agency's ("Chosen by you" for Nora).
  for (const d of db.directions) d.decidedBy = asAgency(d.decidedBy);
  // The agency's Fume conversation: Fume hands the invoice to its own person (Sander at Fume), who answers Nora; Fume
  // tells the agency its checked creatives are ready to send; Fume's "why" says the agency checks its own work.
  const said = (id: string, change: (m: Message) => void) => {
    const m = db.messages.find((x) => x.id === id);
    if (m) change(m);
  };
  said("msg-h2", (m) => {
    m.text = "That is one for a person. Sander at Fume will answer you here.";
    if (m.card?.kind === "handover") m.card.userId = FUME_CONTACT;
  });
  said("msg-h3", (m) => {
    if (m.author.kind === "person") m.author.userId = FUME_CONTACT;
    m.text = "Hi Nora, done: the October invoice is now due on the 31st.";
  });
  said("cm1", (m) => {
    if (m.author.kind === "person") m.author.userId = FUME_CONTACT;
    m.text =
      "Hi Nora, I’m Sander, Brygga Studio’s producer at Fume. Write here whenever you’d rather talk to a person.";
  });
  said(
    "msg6",
    (m) => (m.text = "Nora checked 6 creatives: 4 went to Maja and 2 wait to be sent. 3 more are in check."),
  );
  for (const m of db.messages) {
    const card = m.card as { why?: string } | undefined;
    if (card?.why) card.why = agencyWhy(card.why);
  }
  // The bell. Nora's: her own work in her words, news of what she did (Needs you says what is still to send). The
  // client's: only what she approves and her deliveries (the brief, the plan and the runs are the agency's), and the 4
  // creatives Brygga Studio sent her.
  const nora = (id: string, text: string) => {
    const n = db.notifications.find((x) => x.id === `${id}-nora`);
    if (n) n.text = text;
  };
  nora("n1", "You checked 6 creatives in Autumn launch");
  nora("n7", "The plan for Winter gifting waits for your check");
  nora("n2", "You are fixing one creative in Autumn launch before Maja sees it");
  const agencyIds = new Set(people.map((p) => p.id));
  const clientOfLysne = new Set(
    db.memberships.filter((m) => m.workspaceId === FULL_CLIENT && !agencyIds.has(m.userId)).map((m) => m.userId),
  );
  db.notifications = db.notifications.filter((n) => !clientOfLysne.has(n.userId) || n.kind === "delivered");
  const firstSend = db.clientSends[0];
  if (firstSend)
    db.notifications.unshift({
      id: "n-send-autumn-1",
      userId: "u-maja",
      kind: "checked",
      actor: { kind: "person", userId: "u-nora" },
      text: `LYSNE: ${copy.creatives(firstSend.versionIds.length)} from Brygga Studio to approve in Autumn launch`,
      href: "/campaigns/c-autumn/review",
      read: false,
      at: firstSend.sentAt,
    });
  if (bfPlan)
    db.notifications.unshift({
      id: "n-send-bf-plan",
      userId: "u-maja",
      kind: "checked",
      actor: { kind: "person", userId: "u-nora" },
      text: "LYSNE: the plan for Black Friday from Brygga Studio to approve",
      href: "/campaigns/c-bf/plan",
      read: false,
      at: seed.at(60 * 2),
    });
}
