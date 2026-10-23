// Round 11 (FLOWS §24, PROPOSED 20 Oct 2026): the agency demo. Signed in as Nora Vik, creative lead at Brygga Studio,
// the mock is a world where LYSNE is Brygga Studio's client: Maja and Jonas are LYSNE's client people, the checks are
// the agency's own (Anna's become Nora's), the briefs and plans are the agency's, and no Fume expert checks a plan
// (r10-plan.ts skips the check for a workspace an agency runs). AURÉA, HALM and VEV are example clients at the agency
// level only: the mock is one brand deep (LYSNE), so their own places say so in the preview (FLOWS §24.8).
import type {
  AgencyCampaignRow,
  AgencyClient,
  AgencyHomeView,
  AgencyNeed,
  AgencyTeamMember,
  Campaign,
  CampaignPlan,
  ClientLinkView,
  ClientSend,
  Creative,
  CreativeVersion,
  CustomerRole,
  Delivery,
  FumeApi,
  FumeEvent,
  Id,
  LicenceView,
  Membership,
  Notification,
  Organisation,
  QaItem,
  Session,
  StaffAssignment,
  UsageFigures,
  UsagePeriod,
  UsageRow,
  User,
  Workspace,
} from "../contract";
import { FumeError } from "../contract";
import * as copy from "../copy";
import { agencyWhy, FUME_CONTACT, unsentToClient } from "./r11-client";
import { NOW, at } from "./seed";

const BASE = import.meta.env.BASE_URL;
const pic = (path: string) => `${BASE}demo/${path}`;
const inDays = (d: number) => new Date(NOW + d * 86_400_000).toISOString();

export const AGENCY_ID = "o-brygga";
/** The one client with full example data in the preview. */
export const FULL_CLIENT = "w-lysne";

interface AgencyDb {
  users: User[];
  organisations: Organisation[];
  workspaces: Workspace[];
  memberships: Membership[];
  staff: StaffAssignment[];
  campaigns: Campaign[];
  creatives: Creative[];
  plans: CampaignPlan[];
  qaItems: QaItem[];
  notifications: Notification[];
  products: { workspaceId: Id; state: string }[];
  clientSends?: ClientSend[];
  /** Round 12 (DTASK-6): what usage is counted from. */
  deliveries: Delivery[];
  usage: UsageRow[];
  packages: { id: Id; creativeCap: number }[];
}

// ─── The agency world: made once, when the demo starts as Nora ─────────────

const agencyPeople: User[] = [
  {
    id: "u-nora",
    name: "Nora Vik",
    title: "Creative lead",
    email: "nora@brygga.example",
    staffRole: "expert",
    agency: { organisationId: AGENCY_ID, role: "lead" },
  },
  {
    id: "u-even",
    name: "Even Dahl",
    title: "Designer",
    email: "even@brygga.example",
    staffRole: "expert",
    agency: { organisationId: AGENCY_ID, role: "creative" },
  },
  {
    id: "u-live",
    name: "Live Hauge",
    title: "Art director",
    email: "live@brygga.example",
    staffRole: "expert",
    agency: { organisationId: AGENCY_ID, role: "creative" },
  },
  {
    id: "u-sindre",
    name: "Sindre Moe",
    title: "Producer",
    email: "sindre@brygga.example",
    staffRole: "operator",
    agency: { organisationId: AGENCY_ID, role: "creative" },
  },
];
const clientPeople: User[] = [
  { id: "u-camille", name: "Camille Roux", title: "Brand director", email: "camille@aurea.example" },
  { id: "u-henrik", name: "Henrik Aas", title: "Founder", email: "henrik@halm.example" },
  { id: "u-sara", name: "Sara Lind", title: "Marketing lead", email: "sara@vev.example" },
];
const summaryClients: { workspace: Workspace; org: Organisation }[] = [
  {
    workspace: {
      id: "w-aurea",
      organisationId: "o-aurea",
      brandName: "AURÉA",
      market: "Denmark",
      language: "Danish",
      agencyId: AGENCY_ID,
    },
    org: { id: "o-aurea", name: "AURÉA", packageId: "p-core", kind: "brand" },
  },
  {
    workspace: {
      id: "w-halm",
      organisationId: "o-halm",
      brandName: "HALM",
      market: "Norway",
      language: "Norwegian",
      agencyId: AGENCY_ID,
    },
    org: { id: "o-halm", name: "HALM", packageId: "p-core", kind: "brand" },
  },
  {
    workspace: {
      id: "w-vev",
      organisationId: "o-vev",
      brandName: "VEV",
      market: "Sweden",
      language: "Swedish",
      agencyId: AGENCY_ID,
    },
    org: { id: "o-vev", name: "VEV", packageId: "p-core", kind: "brand" },
  },
];
/** Who leads each client at the agency, and the client's own people. */
const leads: Record<Id, Id> = { "w-lysne": "u-nora", "w-aurea": "u-live", "w-halm": "u-even", "w-vev": "u-live" };
const clientOwners: Record<Id, Id[]> = { "w-aurea": ["u-camille"], "w-halm": ["u-henrik"], "w-vev": ["u-sara"] };

/** Fume's people in LYSNE's history become the agency's: the checks and the producer are Brygga Studio's now. */
const swapIds: Record<Id, Id> = { "u-anna": "u-nora", "u-tuva": "u-live", "u-sander": "u-sindre" };
const swapNames: [RegExp, string][] = [
  [/\bAnna\b/g, "Nora"],
  [/\bTuva\b/g, "Live"],
  [/\bSander\b/g, "Sindre"],
];

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

/** Turns the LYSNE demo into Brygga Studio's: call once on a fresh db. */
export function agencyWorld(db: AgencyDb & Record<string, unknown>) {
  // The agency's history in LYSNE: every key but who the people are (users, seats and assignments stay as seeded).
  for (const key of Object.keys(db)) {
    if (["users", "memberships", "staff", "organisations", "workspaces"].includes(key)) continue;
    db[key] = swapDeep(db[key]);
  }
  db.organisations.push(
    { id: AGENCY_ID, name: "Brygga Studio", packageId: "p-core", kind: "agency" },
    ...summaryClients.map((c) => c.org),
  );
  const lysne = db.workspaces.find((w) => w.id === FULL_CLIENT);
  if (lysne) lysne.agencyId = AGENCY_ID;
  db.workspaces.push(...summaryClients.map((c) => c.workspace));
  db.users.push(...agencyPeople, ...clientPeople);
  for (const [ws, ids] of Object.entries(clientOwners))
    ids.forEach((userId) => db.memberships.push({ userId, workspaceId: ws, role: "owner" }));
  // Agency people work in every client: an assignment (what they can open) and the approver's seat for the brief and
  // the plan (the agency is Fume's customer). Creatives stay the client's to approve (approve() below refuses them).
  db.staff = db.staff.filter((s) => s.workspaceId !== FULL_CLIENT);
  for (const ws of [FULL_CLIENT, ...summaryClients.map((c) => c.workspace.id)])
    for (const p of agencyPeople) {
      db.staff.push({ userId: p.id, workspaceId: ws, staffRole: p.staffRole === "operator" ? "operator" : "expert" });
      db.memberships.push({ userId: p.id, workspaceId: ws, role: "approver" });
    }
  // Who said what: in LYSNE's Fume conversation it is the agency that talks to Fume, and it sent the briefs.
  const asAgency = (id?: Id) => (id === "u-maja" ? "u-nora" : id);
  for (const m of (db.messages as { author: { kind: string; userId?: Id } }[]) ?? [])
    if (m.author.kind === "person") m.author.userId = asAgency(m.author.userId);
  for (const b of (db.briefs as { approvedBy?: Id }[]) ?? []) b.approvedBy = asAgency(b.approvedBy);
  // The plans are the agency's to check, with no Fume check in between: one in check is ready for Nora. Round 13 (robot
  // notes 10-agency, 11-agency-client; Marcus's card 23 Oct 2026, DECIDED): the agency checks a plan and sends it to the
  // client, and only the client approves it. An approved plan reads "Maja approved it · Checked by Nora".
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

  // Round 12 AGENCY (UX review DLOAD-5, DLOAD-6, DTASK-13; PROPOSED 20 Oct 2026).
  // What the agency sent: Nora checked 6 of Autumn launch's creatives and sent the first 4 to Maja; 2 wait to be sent.
  // The client sees a checked creative only once it is sent (r11-client.ts), so Maja has 4 to approve.
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
          sentAt: at(4),
        },
      ]
    : [];
  // Round 13 (Marcus's card, 23 Oct 2026): Nora checked Black Friday's plan and sent it to Maja with the campaign's client
  // link, so both of the plan's states show: Winter gifting waits for Nora's check, Black Friday waits on Maja.
  const bfPlan = db.plans.find((p) => p.campaignId === "c-bf" && p.state === "ready");
  if (bfPlan) {
    Object.assign(bfPlan, { checkedBy: "u-nora", checkedAt: at(60 * 2) });
    db.clientSends.push({
      id: "cs-bf-plan",
      campaignId: "c-bf",
      workspaceId: FULL_CLIENT,
      versionIds: [],
      plan: { version: bfPlan.version },
      to: ["u-maja"],
      link: { token: "bfplan", url: "https://app.fumecreatives.com/c/bfplan", expiresAt: at(-60 * 24 * 28) },
      note: "Black Friday on night black, with gold words. Tell me if the gold is too much.",
      sentBy: "u-nora",
      sentAt: at(60 * 2),
    });
  }
  // The direction the agency chose is the agency's ("Chosen by you" for Nora).
  for (const d of (db.directions as { decidedBy?: Id }[] | undefined) ?? []) d.decidedBy = asAgency(d.decidedBy);
  // The agency's Fume conversation: Fume hands the invoice to its own person (Sander at Fume), who answers Nora; Fume
  // tells the agency its checked creatives are ready to send; Fume's "why" says the agency checks its own work.
  type Said = {
    id: Id;
    text: string;
    author: { kind: string; userId?: Id };
    card?: { kind: string; userId?: Id; why?: string };
  };
  const messages = (db.messages as Said[] | undefined) ?? [];
  const said = (id: Id, change: (m: Said) => void) => {
    const m = messages.find((x) => x.id === id);
    if (m) change(m);
  };
  said("msg-h2", (m) => {
    m.text = "That is one for a person. Sander at Fume will answer you here.";
    if (m.card?.kind === "handover") m.card.userId = FUME_CONTACT;
  });
  said("msg-h3", (m) => {
    m.author.userId = FUME_CONTACT;
    m.text = "Hi Nora, done: the October invoice is now due on the 31st.";
  });
  said("cm1", (m) => {
    m.author.userId = FUME_CONTACT;
    m.text =
      "Hi Nora, I’m Sander, Brygga Studio’s producer at Fume. Write here whenever you’d rather talk to a person.";
  });
  said(
    "msg6",
    (m) => (m.text = "Nora checked 6 creatives: 4 went to Maja and 2 wait to be sent. 3 more are in check."),
  );
  for (const m of messages) if (m.card?.why) m.card.why = agencyWhy(m.card.why);
  // The bell. Nora's: her own work in her words. The client's: only what she approves and her deliveries (the brief,
  // the plan and the runs are the agency's), and the 4 creatives Brygga Studio sent her.
  const nora = (id: Id, text: string) => {
    const n = db.notifications.find((x) => x.id === `${id}-nora`);
    if (n) n.text = text;
  };
  // Round 13 (robot note 10-agency): news of what she did, not a count that goes stale once she sends (Needs you says
  // what is still to send).
  nora("n1", "You checked 6 creatives in Autumn launch");
  nora("n7", "The plan for Winter gifting waits for your check");
  nora("n2", "You are fixing one creative in Autumn launch before Maja sees it");
  const agencyIds = new Set(agencyPeople.map((p) => p.id));
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
      at: at(60 * 2),
    });
}

// ─── The agency's calls ─────────────────────────────────────────────────────

export interface R11AgencyContext {
  db: AgencyDb;
  wait: <T>(value: T) => Promise<T>;
  now: () => string;
  nextId: (prefix: string) => string;
  emit: (event: FumeEvent) => void;
  userId: () => Id;
  workspaceId: () => Id;
  /** The calls as they were before this layer (read when called): the agency wraps a few of them. */
  base: () => FumeApi;
  setVersion: (creative: Creative, change: Partial<CreativeVersion>) => void;
  recount: (campaign: Campaign) => void;
}

type AgencyCalls = Pick<
  FumeApi,
  | "agencyHome"
  | "agencyClients"
  | "agencyCampaigns"
  | "agencyTeam"
  | "licence"
  | "addClient"
  | "sendToClient"
  | "clientSends"
  | "recordClientApproval"
  | "clientLink"
  | "answerClientLink"
>;
type AgencyWraps = Pick<FumeApi, "session" | "switchWorkspace" | "approve" | "allBrands" | "usage">;

// ─── Round 12 (DTASK-6, DLOAD-7): usage, one way for Fume's admin and an agency ───────────────────────────────

const DAY = 86_400_000;
const isoDay = (t: number) => new Date(t).toISOString();

/** The Usage page's three periods, from the demo's clock: this month, last month, and the last eight weeks (Monday
 *  to Sunday, the weeks of the renders chart). */
export function usagePeriods(nowIso: string): Record<UsagePeriod, { from: string; to: string }> {
  const d = new Date(nowIso);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const monday = Date.UTC(y, m, d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return {
    month: { from: isoDay(Date.UTC(y, m, 1)), to: isoDay(Date.UTC(y, m + 1, 1) - 1000) },
    last_month: { from: isoDay(Date.UTC(y, m - 1, 1)), to: isoDay(Date.UTC(y, m, 1) - 1000) },
    weeks: { from: isoDay(monday - 7 * 7 * DAY), to: isoDay(monday + 7 * DAY - 1000) },
  };
}

/** Renders in a period, from the eight weekly totals (oldest first; a week's renders spread over its seven days). */
function rendersIn(trend: number[], nowIso: string, p: { from: string; to: string }): number {
  const d = new Date(nowIso);
  const monday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  const from = Date.parse(p.from);
  const to = Date.parse(p.to) + 1000;
  let sum = 0;
  trend.forEach((renders, i) => {
    const start = monday - (trend.length - 1 - i) * 7 * DAY;
    const days = Math.max(0, Math.min(start + 7 * DAY, to) - Math.max(start, from)) / DAY;
    sum += (renders * days) / 7;
  });
  return Math.round(sum);
}

/** The example clients' own figures (the preview has full data for LYSNE only, FLOWS §24.8). */
const summaryUsage: Record<Id, Record<UsagePeriod, Pick<UsageFigures, "creatives" | "approved" | "delivered">>> = {
  "w-vev": {
    month: { creatives: 16, approved: 10, delivered: 0 },
    last_month: { creatives: 12, approved: 12, delivered: 12 },
    weeks: { creatives: 28, approved: 22, delivered: 12 },
  },
  "w-halm": {
    month: { creatives: 0, approved: 0, delivered: 0 },
    last_month: { creatives: 0, approved: 0, delivered: 0 },
    weeks: { creatives: 0, approved: 0, delivered: 0 },
  },
  "w-aurea": {
    month: { creatives: 0, approved: 0, delivered: 0 },
    last_month: { creatives: 0, approved: 0, delivered: 0 },
    weeks: { creatives: 0, approved: 0, delivered: 0 },
  },
};

/** calls: the agency's own (spread into the api); wraps: three calls the agency changes, put on over the finished api. */
export function r11AgencyApi(ctx: R11AgencyContext): { calls: AgencyCalls; wraps: AgencyWraps } {
  const { db, wait, now, nextId } = ctx;
  const base = () => ctx.base();
  const me = () => db.users.find((u) => u.id === ctx.userId());
  const seat = () => me()?.agency;
  const mustAgency = () => {
    const s = seat();
    if (!s) throw new FumeError("forbidden", "This is for the agency's people.");
    return s;
  };
  const person = (id?: Id) => db.users.find((u) => u.id === id);
  const first = (id?: Id) => person(id)?.name.split(" ")[0];
  const agency = () => db.organisations.find((o) => o.id === seat()?.organisationId);
  const opened = new Map<Id, string>([[FULL_CLIENT, now()]]);
  const sends = () => (db.clientSends ??= []);

  // LYSNE, counted from its own data: plans ready, briefs to send, creatives to check, creatives with the client.
  const lysneCounts = () => {
    const ids = new Set(
      db.campaigns.filter((c) => c.workspaceId === FULL_CLIENT && c.state !== "closed").map((c) => c.id),
    );
    // Round 13: a plan the agency checked is with the client (she approves it); only the unchecked ones are the agency's.
    const plans = db.plans.filter((p) => ids.has(p.campaignId) && p.state === "ready" && !p.checkedBy);
    const toCheck = db.qaItems.filter((q) => q.workspaceId === FULL_CLIENT && q.state === "waiting");
    // Round 12 (DLOAD-5): checked creatives are the agency's to send until it sends them; then they are with Maja.
    const checked = db.creatives.filter((c) => ids.has(c.campaignId) && c.current.state === "checked");
    const toSend = checked.filter((c) => unsentToClient(db as never, c));
    const withClient = checked.filter((c) => !toSend.includes(c));
    const products = db.products.filter((p) => p.workspaceId === FULL_CLIENT && p.state === "needs_you");
    return { plans, toCheck, toSend, withClient, products };
  };
  const campaignName = (id: Id) => db.campaigns.find((c) => c.id === id)?.name ?? "";

  const lysneClient = (): AgencyClient => {
    const ws = db.workspaces.find((w) => w.id === FULL_CLIENT)!;
    const k = lysneCounts();
    const autumn = db.campaigns.find((c) => c.id === "c-autumn");
    const planned = autumn?.counts.creatives || 1;
    const status = k.plans[0]
      ? `${campaignName(k.plans[0].campaignId)}: the plan waits for your check`
      : k.toCheck.length
        ? `${copy.creatives(k.toCheck.length)} to check`
        : k.toSend.length
          ? `${campaignName(k.toSend[0]!.campaignId)}: ${copy.creatives(k.toSend.length)} to send to Maja`
          : "Nothing waits on you";
    return {
      workspace: ws,
      status,
      waitingOnYou:
        k.plans.length + (k.toCheck.length ? 1 : 0) + (k.toSend.length ? 1 : 0) + (k.products.length ? 1 : 0),
      waitingOn: k.withClient.length ? `${copy.creatives(k.withClient.length)} with Maja` : undefined,
      picture: autumn?.cover ?? db.creatives.find((c) => c.campaignId === "c-autumn")?.current.image,
      campaignsActive: db.campaigns.filter(
        (c) => c.workspaceId === FULL_CLIENT && !["closed", "delivered"].includes(c.state),
      ).length,
      current: autumn
        ? {
            campaignId: autumn.id,
            name: autumn.name,
            progress: Math.min(1, autumn.counts.approved / planned),
            detail: `${autumn.counts.creatives} creatives · ${autumn.counts.approved} approved`,
          }
        : undefined,
      nextDelivery: autumn?.dueAt ? { title: `${autumn.name}, the delivery`, at: autumn.dueAt } : undefined,
      people: db.memberships
        .filter((m) => m.workspaceId === FULL_CLIENT && !person(m.userId)?.agency)
        .map((m) => person(m.userId)!)
        .filter(Boolean),
      lead: person(leads[FULL_CLIENT]),
      example: "full",
      since: at(60 * 24 * 120),
      openedAt: opened.get(FULL_CLIENT),
    };
  };

  const summary = (): AgencyClient[] => {
    const ws = (id: Id) => db.workspaces.find((w) => w.id === id)!;
    const people = (id: Id) => (clientOwners[id] ?? []).map((u) => person(u)!).filter(Boolean);
    return [
      {
        workspace: ws("w-vev"),
        // Round 13 (robot note 10-agency): Check cannot open an example client's creatives, so VEV has none to check;
        // its work is with Sara.
        status: "Autumn knit: 6 creatives with Sara",
        waitingOnYou: 0,
        waitingOn: "6 creatives with Sara",
        picture: pic("lysne/gen/sweater-flat.jpg"),
        campaignsActive: 1,
        current: { name: "Autumn knit", progress: 0.62, detail: "16 creatives · 10 approved" },
        nextDelivery: { title: "Autumn knit, the delivery", at: inDays(3) },
        people: people("w-vev"),
        lead: person(leads["w-vev"]),
        example: "summary",
        since: at(60 * 24 * 64),
        openedAt: opened.get("w-vev") ?? at(60 * 26),
      },
      {
        workspace: ws("w-halm"),
        // Round 12 (DLOAD-7): no creatives yet, so no progress bar; the card says one thing.
        status: "Studio chair launch: the brief waits on you, who it is for",
        waitingOnYou: 1,
        picture: pic("kinds/furniture.jpg"),
        campaignsActive: 1,
        people: people("w-halm"),
        lead: person(leads["w-halm"]),
        example: "summary",
        since: at(60 * 24 * 21),
        openedAt: opened.get("w-halm") ?? at(60 * 50),
      },
      {
        workspace: ws("w-aurea"),
        status: "New client: 14 Brand DNA finds to confirm",
        waitingOnYou: 1,
        picture: pic("kinds/fragrance.jpg"),
        campaignsActive: 0,
        people: people("w-aurea"),
        lead: person(leads["w-aurea"]),
        example: "summary",
        since: at(60 * 24 * 4),
        openedAt: opened.get("w-aurea"),
      },
    ];
  };
  const clients = () =>
    [lysneClient(), ...summary()].sort((a, b) => (b.openedAt ?? "").localeCompare(a.openedAt ?? ""));

  const needs = (): AgencyNeed[] => {
    const k = lysneCounts();
    const lysnePic = (campaignId: Id) => db.campaigns.find((c) => c.id === campaignId)?.cover;
    const rows: AgencyNeed[] = [
      ...k.plans.map((p) => ({
        id: `an-plan-${p.campaignId}`,
        clientId: FULL_CLIENT,
        kind: "plan" as const,
        title: `LYSNE · ${campaignName(p.campaignId)}`,
        detail: "The plan waits for your check",
        action: "Check the plan",
        href: `/campaigns/${p.campaignId}/plan`,
        picture: lysnePic(p.campaignId),
        at: p.writtenAt ?? now(),
      })),
      // One row per campaign, as in Fume's studio; a batch made outside a plan is the "Product page".
      ...[...new Set(k.toCheck.map((q) => q.campaignId))].map((campaignId) => {
        const items = k.toCheck.filter((q) => q.campaignId === campaignId);
        return {
          id: `an-check-${campaignId || "product-page"}`,
          clientId: FULL_CLIENT,
          kind: "check" as const,
          title: `LYSNE · ${campaignName(campaignId) || "Product page"}`,
          detail: `${copy.creatives(items.length)} to check`,
          action: "Check",
          href: `/studio/b/${FULL_CLIENT}/qa${campaignId ? `?campaign=${campaignId}` : ""}`,
          picture: items[0]?.image,
          at: items[0]?.madeAt ?? now(),
        };
      }),
      // Round 12 (DTASK-13): sending checked creatives is the agency's own step, so it is a row here, and it opens the
      // Send panel. VEV's checks are not here (DLOAD-7): VEV is a summary-only example the Check page cannot open.
      ...[...new Set(k.toSend.map((c) => c.campaignId))].map((campaignId) => {
        const n = k.toSend.filter((c) => c.campaignId === campaignId);
        return {
          id: `an-send-${campaignId}`,
          clientId: FULL_CLIENT,
          kind: "check" as const,
          title: `LYSNE · ${campaignName(campaignId)}`,
          detail: `${copy.creatives(n.length)} to send to Maja`,
          action: "Send",
          href: `/campaigns/${campaignId}/review?send=1`,
          picture: n[0]?.current.image,
          at: n[0]?.current.checkedAt ?? n[0]?.current.madeAt ?? now(),
        };
      }),
      {
        id: "an-halm-brief",
        clientId: "w-halm",
        kind: "brief",
        title: "HALM · Studio chair launch",
        detail: "The brief waits on you: who it is for",
        action: "Open",
        href: "/agency/clients?client=w-halm",
        picture: pic("kinds/furniture.jpg"),
        at: at(60 * 5),
      },
      {
        id: "an-aurea-brand",
        clientId: "w-aurea",
        kind: "brand",
        title: "AURÉA · Brand DNA",
        detail: "14 finds to confirm",
        action: "Open",
        href: "/agency/clients?client=w-aurea",
        picture: pic("kinds/fragrance.jpg"),
        at: at(60 * 20),
      },
    ];
    return rows.sort((a, b) => b.at.localeCompare(a.at));
  };

  const team = (): AgencyTeamMember[] => {
    const k = lysneCounts();
    return [
      {
        user: person("u-nora")!,
        role: "lead",
        clientIds: ["w-lysne"],
        load: 0.82,
        thisWeek: [
          copy.creatives(k.toCheck.length) + " to check",
          k.plans.length ? `${copy.count(k.plans.length, "plan")} to check` : "",
          "LYSNE",
        ]
          .filter(Boolean)
          .join(" · "),
      },
      {
        user: person("u-live")!,
        role: "creative",
        clientIds: ["w-vev", "w-aurea"],
        load: 0.7,
        thisWeek: "Autumn knit's variants · AURÉA's Brand DNA",
      },
      {
        user: person("u-even")!,
        role: "creative",
        clientIds: ["w-halm"],
        load: 0.45,
        thisWeek: "Studio chair launch: the brief and the plan",
      },
      {
        user: person("u-sindre")!,
        role: "creative",
        clientIds: ["w-lysne", "w-vev"],
        load: 0.58,
        thisWeek: "Deliveries: Autumn launch, Autumn knit",
      },
    ];
  };

  const summaryCampaign = (
    id: Id,
    workspaceId: Id,
    name: string,
    stage: Campaign["stage"],
    state: Campaign["state"],
    counts: Campaign["counts"],
    dueAt?: string,
    cover?: string,
  ): Campaign => ({
    id,
    workspaceId,
    name,
    productIds: [],
    state,
    stage,
    approverId: clientOwners[workspaceId]?.[0] ?? "",
    channels: ["paid_social"],
    formats: ["feed", "story"],
    market: db.workspaces.find((w) => w.id === workspaceId)?.market ?? "",
    language: db.workspaces.find((w) => w.id === workspaceId)?.language ?? "",
    dueAt,
    createdBy: leads[workspaceId] ?? "u-nora",
    createdAt: at(60 * 24 * 20),
    updatedAt: at(60 * 3),
    counts,
    roundsUsed: 0,
    roundsIncluded: 2,
    brandDnaVersion: 1,
    cover,
  });

  /** One brand's figures in one period, counted from its own creatives and deliveries (renders from its weekly trend). */
  const figures = (workspaceId: Id, p: { from: string; to: string }, row?: UsageRow): UsageFigures => {
    const inPeriod = (iso?: string) => Boolean(iso && iso >= p.from && iso <= p.to);
    const ids = new Set(db.campaigns.filter((c) => c.workspaceId === workspaceId).map((c) => c.id));
    const mine = db.creatives.filter((c) => ids.has(c.campaignId));
    const renders = row ? rendersIn(row.trend, now(), p) : 0;
    return {
      ...p,
      creatives: mine.filter((c) => inPeriod(c.versions[0]?.madeAt ?? c.current.madeAt)).length,
      approved: mine.filter(
        (c) => (c.current.state === "approved" || c.current.state === "delivered") && inPeriod(c.current.approvedAt),
      ).length,
      delivered: new Set(
        db.deliveries.filter((d) => ids.has(d.campaignId) && inPeriod(d.createdAt)).flatMap((d) => d.creativeIds),
      ).size,
      renders,
      cost: row && row.renders ? Math.round(renders * (row.cost / row.renders) * 100) / 100 : 0,
    };
  };
  const periodsOf = (workspaceId: Id, row?: UsageRow) => {
    const all = usagePeriods(now());
    const summary = summaryUsage[workspaceId];
    const one = (k: UsagePeriod): UsageFigures =>
      summary ? { ...all[k], ...summary[k], renders: 0, cost: 0 } : figures(workspaceId, all[k], row);
    return { month: one("month"), last_month: one("last_month"), weeks: one("weeks") };
  };
  /** The agency's clients (the ones added in this session too), each with its figures; no renders or cost. */
  const agencyUsage = (): UsageRow[] => {
    const org = seat()?.organisationId ?? AGENCY_ID;
    return db.workspaces
      .filter((w) => w.agencyId === org)
      .map((w) => {
        const periods = periodsOf(w.id);
        return {
          workspaceId: w.id,
          workspace: w,
          renders: 0,
          cost: 0,
          creatives: periods.weeks.creatives,
          delivered: periods.weeks.delivered,
          trend: [],
          periods,
          example: w.id === FULL_CLIENT || !summaryUsage[w.id] ? ("full" as const) : ("summary" as const),
        };
      });
  };
  /** A Fume customer's package this month, counted as her Home counts it (creatives in her campaigns under way). */
  const packageOf = (workspaceId: Id): UsageRow["package"] => {
    const ws = db.workspaces.find((w) => w.id === workspaceId);
    const org = db.organisations.find((o) => o.id === ws?.organisationId);
    const pkg = db.packages.find((p) => p.id === org?.packageId);
    if (!pkg || ws?.agencyId) return undefined;
    const live = db.campaigns.filter(
      (c) => c.workspaceId === workspaceId && !["delivered", "closed"].includes(c.state),
    );
    return {
      used: live.reduce((n, c) => n + c.counts.creatives, 0),
      included: pkg.creativeCap,
      renewsAt: usagePeriods(now()).month.to,
    };
  };

  const wraps: AgencyWraps = {
    // Round 12 (DTASK-6): one Usage page for Fume's admin and an agency. Fume's people get every brand with its
    // figures per period and its package; an agency's people get their own clients, without renders or cost.
    async usage() {
      if (seat()) return wait(agencyUsage());
      const rows = await base().usage();
      return rows
        .filter((r) => !db.workspaces.find((w) => w.id === r.workspaceId)?.agencyId)
        .map((r) => ({
          ...r,
          workspace: db.workspaces.find((w) => w.id === r.workspaceId),
          periods: periodsOf(r.workspaceId, r),
          package: packageOf(r.workspaceId),
        }));
    },
    // The session says who the agency is; it changes nothing else.
    async session(): Promise<Session> {
      const s = await base().session();
      const a = seat();
      const org = agency();
      const runBy = db.organisations.find((o) => o.id === s.workspace.agencyId)?.name;
      const withAgency = runBy ? { ...s, agencyName: runBy } : s;
      return a && org ? { ...withAgency, agency: { organisation: org, role: a.role } } : withAgency;
    },
    // Recent first in the picker: opening a client is remembered.
    async switchWorkspace(id) {
      const s = await base().switchWorkspace(id);
      opened.set(id, now());
      return s;
    },
    // Approving a creative is the client's word (FLOWS §24.2): the agency sends it, or records an approval given outside.
    async approve(versionIds) {
      if (seat())
        throw new FumeError(
          "forbidden",
          "Only the client approves creatives. Send them to the client, or record an approval the client gave you.",
        );
      return base().approve(versionIds);
    },
    // The overview is one page for Fume's studio and an agency (Marcus 20 Oct 2026: "Agency dashboard blir strengt
    // tatt lik som vår"). Each brand gets its picture and its most urgent campaign; Fume's people get what needs them
    // (plans and creatives to check) as the agency's rows. An agency sees only its own clients.
    async allBrands() {
      const v = await base().allBrands();
      const a = seat();
      const mine = (id: Id) => !a || db.workspaces.find((w) => w.id === id)?.agencyId === a.organisationId;
      const live = (c: Campaign) => !["closed", "delivered"].includes(c.state);
      const soonest = (x: Campaign, y: Campaign) => (x.dueAt ?? "9").localeCompare(y.dueAt ?? "9");
      const brands = v.brands
        .filter((b) => mine(b.workspace.id))
        .map((b) => {
          const list = db.campaigns.filter((c) => c.workspaceId === b.workspace.id && live(c)).sort(soonest);
          const c = list[0];
          const planned = c?.counts.creatives ?? 0;
          const current = c
            ? {
                campaignId: c.id,
                name: c.name,
                progress: planned ? Math.min(1, c.counts.approved / planned) : 0,
                detail: planned ? `${planned} creatives · ${c.counts.approved} approved` : "No creatives yet",
              }
            : undefined;
          return { ...b, picture: c?.cover ?? list.find((x) => x.cover)?.cover, current };
        });
      const brandOf = (id: Id) => db.workspaces.find((w) => w.id === id)?.brandName ?? "";
      const plans: AgencyNeed[] = db.plans
        .filter((p) => p.state === "in_check")
        .flatMap((p) => {
          const c = db.campaigns.find((x) => x.id === p.campaignId);
          if (!c) return [];
          return [
            {
              id: `on-plan-${c.id}`,
              clientId: c.workspaceId,
              kind: "plan" as const,
              title: `${brandOf(c.workspaceId)} · ${c.name}`,
              detail: "The plan waits for your check",
              action: "Check the plan",
              href: `/studio/b/${c.workspaceId}/campaigns/${c.id}/plan`,
              picture: c.cover,
              at: p.writtenAt ?? now(),
            },
          ];
        });
      const waiting = db.qaItems.filter((q) => q.state === "waiting");
      const checks: AgencyNeed[] = [...new Set(waiting.map((q) => `${q.workspaceId}|${q.campaignId}`))].map((key) => {
        const [wsOf, campaignId] = key.split("|") as [Id, Id];
        const items = waiting
          .filter((q) => q.workspaceId === wsOf && q.campaignId === campaignId)
          .sort((x, y) => x.dueAt.localeCompare(y.dueAt));
        const c = db.campaigns.find((x) => x.id === campaignId);
        const ws = items[0].workspaceId;
        return {
          id: `on-check-${campaignId || `${ws}-product-page`}`,
          clientId: ws,
          kind: "check" as const,
          title: `${brandOf(ws)} · ${c?.name ?? "Product page"}`,
          detail: `${copy.creatives(items.length)} to check`,
          action: "Check",
          href: `/studio/b/${ws}/qa${c ? `?campaign=${c.id}` : ""}`,
          picture: items[0].image,
          at: items[0].madeAt,
        };
      });
      return {
        ...v,
        brands,
        needsYou: a ? [] : [...plans, ...checks].sort((x, y) => y.at.localeCompare(x.at)),
        queue: v.queue.filter((q) => mine(q.workspace.id)),
        runs: v.runs.filter((r) => mine(r.workspace.id)),
        deliveriesDue: v.deliveriesDue.filter((d) => mine(d.workspace.id)),
        team: a ? v.team.filter((r) => r.user.agency?.organisationId === a.organisationId) : v.team,
      };
    },
  };

  const calls: AgencyCalls = {
    async agencyHome(): Promise<AgencyHomeView> {
      mustAgency();
      const k = lysneCounts();
      const list = clients();
      // Round 12 (DLOAD-5, DLOAD-7, DTASK-13): what waits on the agency, the checks and the sending included, then what is
      // with the client; the same numbers as Needs you.
      const yours = [
        k.plans.length ? copy.count(k.plans.length, "plan") : "",
        k.toCheck.length ? `${copy.creatives(k.toCheck.length)} to check` : "",
        k.toSend.length ? `${k.toSend.length} to send` : "",
      ].filter(Boolean);
      const mine =
        yours.length > 1
          ? `${yours.slice(0, -1).join(", ")} and ${yours[yours.length - 1]} wait on you`
          : yours.length
            ? `${yours[0]} ${yours[0]!.startsWith("1 ") ? "waits" : "wait"} on you`
            : "";
      const theirs = k.withClient.length ? `${copy.creatives(k.withClient.length)} with Maja` : "";
      const parts = [mine, theirs].filter(Boolean);
      const summaryLine = `${list.length} client brands.${parts.length ? ` ${parts.join("; ")}.` : " Nothing waits on you today."}`;
      return wait({ agency: agency()!, summary: summaryLine, clients: list, needsYou: needs(), team: team() });
    },
    async agencyClients() {
      mustAgency();
      return wait(clients());
    },
    async agencyCampaigns(): Promise<AgencyCampaignRow[]> {
      mustAgency();
      const lysne = db.workspaces.find((w) => w.id === FULL_CLIENT)!;
      const ws = (id: Id) => db.workspaces.find((w) => w.id === id)!;
      const full: AgencyCampaignRow[] = db.campaigns
        .filter((c) => c.workspaceId === FULL_CLIENT && c.state !== "closed")
        .map((c) => ({
          campaign: c,
          client: lysne,
          status: "",
          liveAt: c.dueAt,
          example: "full" as const,
          waitingOn: db.creatives.some(
            (x) => x.campaignId === c.id && x.current.state === "checked" && !unsentToClient(db as never, x),
          )
            ? "Waiting on Maja"
            : undefined,
        }));
      const rest: AgencyCampaignRow[] = [
        {
          campaign: summaryCampaign(
            "c-vev-knit",
            "w-vev",
            "Autumn knit",
            "variants",
            "in_review",
            { creatives: 16, inCheck: 0, checked: 6, approved: 10, delivered: 0 },
            inDays(3),
            pic("lysne/gen/sweater-flat.jpg"),
          ),
          client: ws("w-vev"),
          status: "6 creatives with Sara",
          waitingOn: "Waiting on Sara",
          liveAt: inDays(6),
          example: "summary",
        },
        {
          campaign: summaryCampaign(
            "c-halm-chair",
            "w-halm",
            "Studio chair launch",
            "brief",
            "awaiting_input",
            { creatives: 0, inCheck: 0, checked: 0, approved: 0, delivered: 0 },
            inDays(24),
            pic("kinds/furniture.jpg"),
          ),
          client: ws("w-halm"),
          status: "The brief waits on you",
          liveAt: inDays(24),
          example: "summary",
        },
      ];
      return wait([...full, ...rest]);
    },
    async agencyTeam() {
      mustAgency();
      return wait(team());
    },
    async licence(): Promise<LicenceView> {
      mustAgency();
      // Round 12 (DLOAD-7, DTASK-6): the same numbers as Usage and the client's Home: this month's, per client.
      const month = usagePeriods(now()).month;
      const usage = agencyUsage().map((r) => ({
        client: r.workspace!,
        creativesMade: r.periods!.month.creatives,
        creativesApproved: r.periods!.month.approved,
      }));
      return wait({
        agency: agency()!,
        period: { from: month.from, to: month.to },
        scope: "Early access: product campaigns for paid social, scoped with Fume on 6 Oct",
        usage,
        total: {
          creativesMade: usage.reduce((n, u) => n + u.creativesMade, 0),
          creativesApproved: usage.reduce((n, u) => n + u.creativesApproved, 0),
        },
        seats: { used: agencyPeople.length, included: 6 },
      });
    },
    async addClient({ brandName, website, market, language, people }) {
      const s = mustAgency();
      if (s.role !== "lead") throw new FumeError("forbidden", "Only the agency lead adds clients.");
      const name = brandName.trim();
      if (!name) throw new FumeError("invalid", "Write the brand's name.");
      const orgId = nextId("o");
      const workspace: Workspace = {
        id: nextId("w"),
        organisationId: orgId,
        brandName: name,
        market: market || "Norway",
        language: language || "Norwegian",
        agencyId: s.organisationId,
      };
      db.organisations.push({ id: orgId, name, packageId: "p-core", kind: "brand" });
      db.workspaces.push(workspace);
      for (const p of agencyPeople)
        db.staff.push({
          userId: p.id,
          workspaceId: workspace.id,
          staffRole: p.staffRole === "operator" ? "operator" : "expert",
        });
      for (const p of agencyPeople) db.memberships.push({ userId: p.id, workspaceId: workspace.id, role: "approver" });
      const invited = people
        .filter((p) => p.email.trim())
        .map((p) => {
          const u: User = { id: nextId("u"), name: p.name.trim() || p.email.trim(), title: "", email: p.email.trim() };
          db.users.push(u);
          db.memberships.push({ userId: u.id, workspaceId: workspace.id, role: p.role as CustomerRole });
          return u;
        });
      const client: AgencyClient = {
        workspace,
        status: website
          ? `New client: Fume is reading ${website.replace(/^https?:\/\//, "")}`
          : "New client: Fume needs the website or the brand guide",
        waitingOnYou: website ? 0 : 1,
        campaignsActive: 0,
        people: invited,
        lead: me(),
        example: "summary",
        since: now(),
        openedAt: now(),
      };
      opened.set(workspace.id, now());
      ctx.emit({ type: "campaign.state", campaign: db.campaigns[0] });
      return wait(client);
    },

    async sendToClient({ campaignId, versionIds, to, link, note, plan }) {
      const s = mustAgency();
      void s;
      const c = db.campaigns.find((x) => x.id === campaignId);
      if (!c) throw new FumeError("not_found", "No such campaign");
      if (!versionIds.length && !plan) throw new FumeError("invalid", "Choose the creatives to send.");
      const versions = versionIds.map((vid) => db.creatives.find((x) => x.current.id === vid));
      if (versions.some((x) => !x || x.current.state !== "checked"))
        throw new FumeError("conflict", "Only checked creatives go to the client.");
      const clientPeople = new Set(
        db.memberships.filter((m) => m.workspaceId === c.workspaceId && !person(m.userId)?.agency).map((m) => m.userId),
      );
      if (to.some((id) => !clientPeople.has(id))) throw new FumeError("invalid", "Send to the client's own people.");
      if (!to.length && !link)
        throw new FumeError("invalid", "Choose who at the client approves, or make a client link.");
      // Round 13 (Marcus's card, 23 Oct 2026): sending the plan is the agency's check of it; the client approves it.
      const checkedPlan = plan ? await base().checkPlan(campaignId) : undefined;
      // One client link per campaign: the plan first, then the creatives, in the same link while it works.
      const open = link
        ? sends().find((x) => x.campaignId === campaignId && x.link && x.link.expiresAt > now())?.link
        : undefined;
      const token = nextId("lk").replace(/[^a-z0-9]/gi, "");
      const send: ClientSend = {
        id: nextId("cs"),
        campaignId,
        workspaceId: c.workspaceId,
        versionIds,
        ...(checkedPlan ? { plan: { version: checkedPlan.version } } : {}),
        to,
        link: link
          ? (open ?? {
              token,
              url: `https://app.fumecreatives.com/c/${token}`,
              expiresAt: new Date(Date.parse(now()) + 30 * 86_400_000).toISOString(),
            })
          : undefined,
        note: note?.trim() || undefined,
        sentBy: ctx.userId(),
        sentAt: now(),
      };
      sends().unshift(send);
      const brand = db.workspaces.find((w) => w.id === c.workspaceId)?.brandName ?? "";
      const from = agency()?.name ?? first(ctx.userId());
      const what = [checkedPlan ? "the plan" : "", versionIds.length ? copy.creatives(versionIds.length) : ""]
        .filter(Boolean)
        .join(" and ");
      for (const userId of to)
        // Round 12: "checked" (creatives ready for her), so Home's creatives row and the bell say it once (shell/notifications).
        db.notifications.unshift({
          id: nextId("n"),
          userId,
          kind: "checked",
          actor: { kind: "person", userId: ctx.userId() },
          text:
            checkedPlan && !versionIds.length
              ? `${brand}: the plan for ${c.name} from ${from} to approve`
              : `${brand}: ${what} from ${from} to approve in ${c.name}`,
          href: `/campaigns/${c.id}/${checkedPlan && !versionIds.length ? "plan" : "review"}`,
          read: false,
          at: now(),
        });
      ctx.emit({ type: "campaign.state", campaign: c });
      return wait(send);
    },
    async clientSends(campaignId) {
      return wait(sends().filter((s) => s.campaignId === campaignId));
    },
    async recordClientApproval({ versionIds, clientUserId, note, at: day }) {
      mustAgency();
      if (!note.trim()) throw new FumeError("invalid", "Say how the client approved, for the record.");
      if (!versionIds.length) throw new FumeError("invalid", "Tick what the client approved.");
      // Round 12 (DTASK-15): the day the client approved; never later than now.
      const approvedAt = day && day < now() ? day : now();
      const done: CreativeVersion[] = [];
      for (const vid of versionIds) {
        const c = db.creatives.find((x) => x.current.id === vid);
        if (!c) throw new FumeError("not_found", `No version ${vid}`);
        if (c.current.state !== "checked") throw new FumeError("conflict", "Only checked creatives can be approved.");
        ctx.setVersion(c, {
          state: "approved",
          approvedBy: clientUserId,
          approvedAt,
          recordedBy: ctx.userId(),
          recordedNote: note.trim(),
        });
        done.push(c.current);
      }
      const touched = new Set(versionIds.map((v) => db.creatives.find((c) => c.current.id === v)!.campaignId));
      touched.forEach((id) => {
        const campaign = db.campaigns.find((c) => c.id === id);
        if (campaign) {
          ctx.recount(campaign);
          ctx.emit({ type: "campaign.state", campaign });
        }
      });
      return wait(done);
    },
    async clientLink(token): Promise<ClientLinkView> {
      // Round 13: one link per campaign, so it holds everything sent in it (the newest send first).
      const all = sends().filter((s) => s.link?.token === token);
      const send = all[0];
      if (!send) throw new FumeError("not_found", "This client link has expired or was never made.");
      const campaign = db.campaigns.find((c) => c.id === send.campaignId)!;
      const versionIds = all.flatMap((s) => s.versionIds);
      const planSend = all.find((s) => s.plan);
      const plan = planSend ? db.plans.find((p) => p.campaignId === campaign.id) : undefined;
      return wait({
        send,
        client: db.workspaces.find((w) => w.id === send.workspaceId)!,
        agency: db.organisations.find((o) => o.id === db.workspaces.find((w) => w.id === send.workspaceId)?.agencyId)!,
        campaign,
        creatives: db.creatives.filter(
          (c) => versionIds.includes(c.current.id) || c.versions.some((v) => versionIds.includes(v.id)),
        ),
        sentBy: person(send.sentBy)!,
        ...(plan && planSend ? { plan, planSend } : {}),
      });
    },
    async answerClientLink({ token, versionId, verdict, text, name }) {
      // the send of the link that holds this creative (one link per campaign holds several sends)
      const send =
        sends().find((s) => s.link?.token === token && s.versionIds.includes(versionId)) ??
        sends().find((s) => s.link?.token === token);
      if (!send) throw new FumeError("not_found", "This client link has expired.");
      // Round 12 (DWAY-4): the agency's own people see the link as a preview; an answer there is never the client's.
      if (me()?.agency)
        throw new FumeError("forbidden", "This is a preview of the client’s page. Only the client answers here.");
      const c = db.creatives.find((x) => x.current.id === versionId);
      if (!c || !send.versionIds.includes(versionId))
        throw new FumeError("not_found", "This creative is not in the link.");
      // The link is the client's: their approval is theirs (the first person it was sent to, or the client's owner).
      const owner =
        send.to[0] ??
        db.memberships.find(
          (m) => m.workspaceId === send.workspaceId && m.role === "owner" && !person(m.userId)?.agency,
        )?.userId;
      if (verdict === "approve") {
        if (c.current.state !== "checked")
          throw new FumeError("conflict", "This creative is not waiting for approval.");
        ctx.setVersion(c, {
          state: "approved",
          approvedBy: owner,
          approvedAt: now(),
          recordedNote: name.trim() ? `Through the client link, by ${name.trim()}` : "Through the client link",
        });
      } else {
        if (!text?.trim()) throw new FumeError("invalid", "Say what should change.");
        ctx.setVersion(c, { state: "changes_requested" });
        db.notifications.unshift({
          id: nextId("n"),
          userId: send.sentBy,
          kind: "changes_asked",
          actor: { kind: "person", userId: owner ?? send.sentBy },
          text: `${name.trim() || first(owner) || "The client"} asked for changes on ${c.title}: “${text.trim()}”`,
          href: `/campaigns/${c.campaignId}/review`,
          read: false,
          at: now(),
        });
      }
      const campaign = db.campaigns.find((x) => x.id === c.campaignId);
      if (campaign) {
        ctx.recount(campaign);
        ctx.emit({ type: "campaign.state", campaign });
      }
      return wait(c.current);
    },
  };

  return { calls, wraps };
}
