// The agency (FLOWS §24): an agency's people run client brands in Fume. In the agency demo LYSNE is Brygga Studio's
// client (the one client with full data); AURÉA, HALM and VEV are example clients at the agency level only, so their
// own places say so in the preview (FLOWS §24.8). The agency checks its own work, sends checked creatives and the plan
// to its client, and the client approves them in Fume or through a client link without an account. Fume decides the
// agency's plan; the agency borrows Fume's people on request.
import {
  FumeError,
  type AgencyCampaignRow,
  type AgencyClient,
  type AgencyFeature,
  type AgencyFumePlan,
  type AgencyHomeView,
  type AgencyNeed,
  type AgencyTeamMember,
  type Campaign,
  type ClientLinkView,
  type ClientSend,
  type CreativeVersion,
  type CustomerRole,
  type FumeApi,
  type FumeRequest,
  type Id,
  type LicenceView,
  type UsageFigures,
  type UsagePeriod,
  type UsageRow,
  type User,
  type Workspace,
} from "../contract";
import * as copy from "../copy";
import { canBeApproved } from "../domain/creatives";
import { canAddClients, canAnswerClientLink } from "../domain/permissions";
import type { Mock } from "./context";
import { at, inDays, pic } from "./seed/helpers";
import { AGENCY_ID, FULL_CLIENT, FUME_CONTACT, agencyPeople, clientOwners, leads, summaryUsage } from "./seed/agency";

type Calls =
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
  | "agencyPlan"
  | "askFume";

/** What Fume says to an agency about why it asks: the agency checks its own creatives (FLOWS §24.1). */
export const agencyWhy = (why: string) =>
  why.replace(
    /Fume[’']s expert checks each one against your answer/,
    "Your team checks each one against the client’s answer",
  );

// ─── Usage: one way for Fume's admin and an agency ─────────────────────────

const DAY = 86_400_000;
const isoDay = (t: number) => new Date(t).toISOString();

/** The Usage page's three periods, from the demo's clock: this month, last month, and the last eight weeks (Monday
 *  to Sunday, the weeks of the renders chart). */
function usagePeriods(nowIso: string): Record<UsagePeriod, { from: string; to: string }> {
  const d = new Date(nowIso);
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth();
  const monday = Date.UTC(y, mo, d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return {
    month: { from: isoDay(Date.UTC(y, mo, 1)), to: isoDay(Date.UTC(y, mo + 1, 1) - 1000) },
    last_month: { from: isoDay(Date.UTC(y, mo - 1, 1)), to: isoDay(Date.UTC(y, mo, 1) - 1000) },
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

/** One brand's figures in one period, counted from its own creatives and deliveries (renders from its weekly trend). */
function figures(m: Mock, workspaceId: Id, p: { from: string; to: string }, row?: UsageRow): UsageFigures {
  const { db } = m;
  const inPeriod = (iso?: string) => Boolean(iso && iso >= p.from && iso <= p.to);
  const ids = new Set(db.campaigns.filter((c) => c.workspaceId === workspaceId).map((c) => c.id));
  const made = db.creatives.filter((c) => ids.has(c.campaignId));
  const renders = row ? rendersIn(row.trend, m.now(), p) : 0;
  return {
    ...p,
    creatives: made.filter((c) => inPeriod(c.versions[0]?.madeAt ?? c.current.madeAt)).length,
    approved: made.filter(
      (c) => (c.current.state === "approved" || c.current.state === "delivered") && inPeriod(c.current.approvedAt),
    ).length,
    delivered: new Set(
      db.deliveries.filter((d) => ids.has(d.campaignId) && inPeriod(d.createdAt)).flatMap((d) => d.creativeIds),
    ).size,
    renders,
    cost: row && row.renders ? Math.round(renders * (row.cost / row.renders) * 100) / 100 : 0,
  };
}

/** A brand's figures in each of the three periods (an example client's are its own summary figures). */
export function periodsOf(m: Mock, workspaceId: Id, row?: UsageRow) {
  const all = usagePeriods(m.now());
  const summary = summaryUsage[workspaceId];
  const one = (k: UsagePeriod): UsageFigures =>
    summary ? { ...all[k], ...summary[k], renders: 0, cost: 0 } : figures(m, workspaceId, all[k], row);
  return { month: one("month"), last_month: one("last_month"), weeks: one("weeks") };
}

/** The agency's clients (the ones added in this session too), each with its figures; no renders or cost. */
export function agencyUsage(m: Mock): UsageRow[] {
  const org = m.db.users.find((u) => u.id === m.userId)?.agency?.organisationId ?? AGENCY_ID;
  return m.db.workspaces
    .filter((w) => w.agencyId === org)
    .map((w) => {
      const periods = periodsOf(m, w.id);
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
}

/** A Fume customer's package this month, counted as her Home counts it (creatives in her campaigns under way). */
export function packageOf(m: Mock, workspaceId: Id): UsageRow["package"] {
  const { db } = m;
  const ws = db.workspaces.find((w) => w.id === workspaceId);
  const org = db.organisations.find((o) => o.id === ws?.organisationId);
  const pkg = db.packages.find((p) => p.id === org?.packageId);
  if (!pkg || ws?.agencyId) return undefined;
  const live = db.campaigns.filter((c) => c.workspaceId === workspaceId && !["delivered", "closed"].includes(c.state));
  return {
    used: live.reduce((n, c) => n + c.counts.creatives, 0),
    included: pkg.creativeCap,
    renewsAt: usagePeriods(m.now()).month.to,
  };
}

// ─── The agency's Fume plan ────────────────────────────────────────────────

/** What an agency's Fume plan holds in the preview: Fume decides it, and Fume's own people are borrowed on request. */
const FEATURES: AgencyFeature[] = [
  {
    id: "f-dna",
    name: "Brand DNA for each client",
    detail: "Fume reads each client’s brand and keeps it apart from the others",
    state: "included",
  },
  { id: "f-chat", name: "The Fume chat", detail: "One conversation per client, with its memory", state: "included" },
  {
    id: "f-engine",
    name: "The Engine with Product Truth",
    detail: "Images and designs, each product as it really is",
    state: "included",
  },
  { id: "f-studio", name: "The Studio", detail: "Image and Design, models, references and boards", state: "included" },
  {
    id: "f-check",
    name: "Check",
    detail: "Your own experts check every creative before the client sees it",
    state: "included",
  },
  {
    id: "f-send",
    name: "Send to client and the client link",
    detail: "The client approves in Fume, or through a link without an account",
    state: "included",
  },
  {
    id: "f-calendar",
    name: "The calendar and deliveries",
    detail: "Campaign windows, deliveries and approved creatives",
    state: "included",
  },
  {
    id: "f-video",
    name: "The video editor",
    detail: "Video in the Studio, next to Image and Design",
    state: "coming",
    when: "Next on Fume’s list",
  },
  {
    id: "f-performance",
    name: "Performance",
    detail: "How the creatives do once they run, per client",
    state: "coming",
    when: "Later this year",
  },
  {
    id: "f-publish",
    name: "Publishing to Meta and Instagram",
    detail: "From the calendar, straight to the channels",
    state: "coming",
    when: "Later this year",
  },
  { id: "f-figma", name: "Figma", detail: "Masters and designs both ways", state: "coming", when: "Not dated yet" },
  {
    id: "f-connectors",
    name: "Claude, ChatGPT and Slack",
    detail: "Fume in the tools your team already uses",
    state: "coming",
    when: "Not dated yet",
  },
  {
    id: "f-people",
    name: "Fume’s people",
    detail: "Fume’s experts, designers and operators for a campaign that needs more hands",
    state: "on_request",
  },
];

export function agencyCalls(m: Mock): Pick<FumeApi, Calls> {
  const { db, wait } = m;
  const now = () => m.now();
  const me = () => db.users.find((u) => u.id === m.userId);
  const seat = () => me()?.agency;
  const mustAgency = () => {
    const s = seat();
    if (!s) throw new FumeError("forbidden", "This is for the agency's people.");
    return s;
  };
  const person = (id?: Id) => db.users.find((u) => u.id === id);
  const first = (id?: Id) => person(id)?.name.split(" ")[0];
  const agency = () => db.organisations.find((o) => o.id === seat()?.organisationId);
  /** Clients the lead added in this session, as they were when added. */
  const added: AgencyClient[] = [];
  /** The workspaces at the start: a client added since is new (Fume is still reading it). */
  const seeded = new Set(db.workspaces.map((w) => w.id));
  /** What the agency asked of Fume in this session, newest first. */
  const requests: FumeRequest[] = [];

  // LYSNE, counted from its own data: plans to check, creatives to check, creatives to send, creatives with the client.
  const lysneCounts = () => {
    const ids = new Set(
      db.campaigns.filter((c) => c.workspaceId === FULL_CLIENT && c.state !== "closed").map((c) => c.id),
    );
    // A plan the agency checked is with the client (she approves it); only the unchecked ones are the agency's.
    const plans = db.plans.filter((p) => ids.has(p.campaignId) && p.state === "ready" && !p.checkedBy);
    const toCheck = db.qaItems.filter((q) => q.workspaceId === FULL_CLIENT && q.state === "waiting");
    // Checked creatives are the agency's to send until it sends them; then they are with Maja.
    const checked = db.creatives.filter((c) => ids.has(c.campaignId) && c.current.state === "checked");
    const toSend = checked.filter((c) => m.unsentToClient(c));
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
        .filter((x) => x.workspaceId === FULL_CLIENT && !person(x.userId)?.agency)
        .map((x) => person(x.userId)!)
        .filter(Boolean),
      lead: person(leads[FULL_CLIENT]),
      example: "full",
      since: at(60 * 24 * 120),
      openedAt: m.opened.get(FULL_CLIENT),
    };
  };

  const summary = (): AgencyClient[] => {
    const ws = (id: Id) => db.workspaces.find((w) => w.id === id)!;
    const people = (id: Id) => (clientOwners[id] ?? []).map((u) => person(u)!).filter(Boolean);
    return [
      {
        workspace: ws("w-vev"),
        // Check cannot open an example client's creatives, so VEV has none to check; its work is with Sara.
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
        openedAt: m.opened.get("w-vev") ?? at(60 * 26),
      },
      {
        workspace: ws("w-halm"),
        // No creatives yet, so no progress bar; the card says one thing.
        status: "Studio chair launch: the brief waits on you, who it is for",
        waitingOnYou: 1,
        picture: pic("kinds/furniture.jpg"),
        campaignsActive: 1,
        people: people("w-halm"),
        lead: person(leads["w-halm"]),
        example: "summary",
        since: at(60 * 24 * 21),
        openedAt: m.opened.get("w-halm") ?? at(60 * 50),
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
        openedAt: m.opened.get("w-aurea"),
      },
    ];
  };

  /** The agency's clients, the ones added in this session too, recent first; each person with their role in their
   *  client, and a client added in this session says it is new. */
  const clients = (): AgencyClient[] => {
    const list = [lysneClient(), ...summary()].sort((a, b) => (b.openedAt ?? "").localeCompare(a.openedAt ?? ""));
    return [...list, ...added.filter((a) => !list.some((c) => c.workspace.id === a.workspace.id))]
      .sort((a, b) => (b.openedAt ?? "").localeCompare(a.openedAt ?? ""))
      .map((c) => {
        const roles: Record<Id, CustomerRole> = {};
        for (const p of c.people) {
          const seatIn = db.memberships.find((x) => x.userId === p.id && x.workspaceId === c.workspace.id);
          if (seatIn) roles[p.id] = seatIn.role;
        }
        return { ...c, roles, isNew: !seeded.has(c.workspace.id) };
      });
  };

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
      // Sending checked creatives is the agency's own step, so it is a row here, and it opens the Send panel. VEV's
      // checks are not here: VEV is a summary-only example the Check page cannot open.
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

  /** Every campaign of the agency's clients: LYSNE's own, and one row for each example client. */
  const campaignRows = (): AgencyCampaignRow[] => {
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
          (x) => x.campaignId === c.id && x.current.state === "checked" && !m.unsentToClient(x),
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
    return [...full, ...rest];
  };

  /** creative id → its one name (copy.creativeName), over the campaign's creatives in the order they were made, so the
   *  client reads the same name on the link as in Fume. */
  const customerNames = (campaign: Campaign): Record<Id, string> => {
    const product =
      campaign.productIds.length === 1 ? db.products.find((p) => p.id === campaign.productIds[0])?.name : undefined;
    const count = new Map<string, number>();
    const names: Record<Id, string> = {};
    for (const c of db.creatives.filter((x) => x.campaignId === campaign.id)) {
      const n = (count.get(c.format) ?? 0) + 1;
      count.set(c.format, n);
      const own = /^(Feed|Square|Story) [A-Z]?\d+$/.test(c.title.trim())
        ? c.title.trim()
        : `${copy.format[c.format].label} ${n}`;
      names[c.id] = copy.creativeName({ title: own, format: c.format, productName: product ?? campaign.name });
    }
    return names;
  };

  return {
    // What waits on the agency (the checks and the sending included), then what is with the client; the same numbers
    // as Needs you. A campaign whose brief has Fume's questions waits on the agency too, as Campaigns says.
    async agencyHome(): Promise<AgencyHomeView> {
      mustAgency();
      const k = lysneCounts();
      const list = clients();
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
      const needsYou = needs();
      const asked: AgencyNeed[] = campaignRows()
        .filter(
          (r) =>
            r.example === "full" && r.campaign.state === "awaiting_input" && (r.campaign.waits?.questions ?? 0) > 0,
        )
        .filter((r) => !needsYou.some((n) => n.href.startsWith(`/campaigns/${r.campaign.id}`)))
        .map(({ campaign: c, client }) => {
          const n = c.waits?.questions ?? 0;
          return {
            id: `an-questions-${c.id}`,
            clientId: client.id,
            kind: "brief",
            title: `${client.brandName} · ${c.name}`,
            detail: `${n === 1 ? "1 question" : `${n} questions`} for you`,
            action: "Answer",
            href: `/campaigns/${c.id}`,
            picture: c.cover,
            at: c.updatedAt,
          };
        });
      return wait({
        agency: agency()!,
        summary: summaryLine,
        clients: list,
        needsYou: [...needsYou, ...asked].sort((a, b) => b.at.localeCompare(a.at)),
        team: team(),
      });
    },
    async agencyClients() {
      mustAgency();
      return wait(clients());
    },
    async agencyCampaigns(): Promise<AgencyCampaignRow[]> {
      mustAgency();
      return wait(campaignRows());
    },
    async agencyTeam() {
      mustAgency();
      return wait(team());
    },
    // The same numbers as Usage and the client's Home: this month's, per client.
    async licence(): Promise<LicenceView> {
      mustAgency();
      const month = usagePeriods(now()).month;
      const usage = agencyUsage(m).map((r) => ({
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
    // A client the lead adds stays: it joins the clients and Home (recent first), and the licence's usage.
    async addClient({ brandName, website, market, language, people }) {
      const s = mustAgency();
      if (!canAddClients(me()!)) throw new FumeError("forbidden", "Only the agency lead adds clients.");
      const name = brandName.trim();
      if (!name) throw new FumeError("invalid", "Write the brand's name.");
      const orgId = m.nextId("o");
      const workspace: Workspace = {
        id: m.nextId("w"),
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
          const u: User = {
            id: m.nextId("u"),
            name: p.name.trim() || p.email.trim(),
            title: "",
            email: p.email.trim(),
          };
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
      m.opened.set(workspace.id, now());
      m.emit({ type: "campaign.state", campaign: db.campaigns[0] });
      added.push(structuredClone(client));
      return wait(client);
    },

    // Sending the plan is the agency's check of it; only the client approves it. One client link per campaign: the
    // plan first, then the creatives, in the same link while it works.
    async sendToClient({ campaignId, versionIds, to, link, note, plan }) {
      mustAgency();
      const c = db.campaigns.find((x) => x.id === campaignId);
      if (!c) throw new FumeError("not_found", "No such campaign");
      if (!versionIds.length && !plan) throw new FumeError("invalid", "Choose the creatives to send.");
      const versions = versionIds.map((vid) => db.creatives.find((x) => x.current.id === vid));
      if (versions.some((x) => !x || x.current.state !== "checked"))
        throw new FumeError("conflict", "Only checked creatives go to the client.");
      const clientPeople = new Set(
        db.memberships.filter((x) => x.workspaceId === c.workspaceId && !person(x.userId)?.agency).map((x) => x.userId),
      );
      if (to.some((id) => !clientPeople.has(id))) throw new FumeError("invalid", "Send to the client's own people.");
      if (!to.length && !link)
        throw new FumeError("invalid", "Choose who at the client approves, or make a client link.");
      const checkedPlan = plan ? await m.api.checkPlan(campaignId) : undefined;
      const open = link
        ? db.clientSends.find((x) => x.campaignId === campaignId && x.link && x.link.expiresAt > now())?.link
        : undefined;
      const token = m.nextId("lk").replace(/[^a-z0-9]/gi, "");
      const send: ClientSend = {
        id: m.nextId("cs"),
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
        sentBy: m.userId,
        sentAt: now(),
      };
      db.clientSends.unshift(send);
      const brand = db.workspaces.find((w) => w.id === c.workspaceId)?.brandName ?? "";
      const from = agency()?.name ?? first(m.userId);
      const what = [checkedPlan ? "the plan" : "", versionIds.length ? copy.creatives(versionIds.length) : ""]
        .filter(Boolean)
        .join(" and ");
      // "checked" (creatives ready for her), so Home's creatives row and the bell say it once.
      for (const userId of to)
        db.notifications.unshift({
          id: m.nextId("n"),
          userId,
          kind: "checked",
          actor: { kind: "person", userId: m.userId },
          text:
            checkedPlan && !versionIds.length
              ? `${brand}: the plan for ${c.name} from ${from} to approve`
              : `${brand}: ${what} from ${from} to approve in ${c.name}`,
          href: `/campaigns/${c.id}/${checkedPlan && !versionIds.length ? "plan" : "review"}`,
          read: false,
          at: now(),
        });
      m.emit({ type: "campaign.state", campaign: c });
      return wait(send);
    },
    async clientSends(campaignId) {
      return wait(db.clientSends.filter((s) => s.campaignId === campaignId));
    },
    // The day the client approved, for the record; never later than now.
    async recordClientApproval({ versionIds, clientUserId, note, at: day }) {
      mustAgency();
      if (!note.trim()) throw new FumeError("invalid", "Say how the client approved, for the record.");
      if (!versionIds.length) throw new FumeError("invalid", "Tick what the client approved.");
      const approvedAt = day && day < now() ? day : now();
      const done: CreativeVersion[] = [];
      for (const vid of versionIds) {
        const c = db.creatives.find((x) => x.current.id === vid);
        if (!c) throw new FumeError("not_found", `No version ${vid}`);
        if (!canBeApproved(c.current)) throw new FumeError("conflict", "Only checked creatives can be approved.");
        m.setVersion(c, {
          state: "approved",
          approvedBy: clientUserId,
          approvedAt,
          recordedBy: m.userId,
          recordedNote: note.trim(),
        });
        done.push(c.current);
      }
      const touched = new Set(versionIds.map((v) => db.creatives.find((c) => c.current.id === v)!.campaignId));
      touched.forEach((id) => {
        const campaign = db.campaigns.find((c) => c.id === id);
        if (campaign) {
          m.recount(campaign);
          m.emit({ type: "campaign.state", campaign });
        }
      });
      return wait(done);
    },
    // One link per campaign, so it holds everything sent in it (the newest send first).
    async clientLink(token): Promise<ClientLinkView> {
      const all = db.clientSends.filter((s) => s.link?.token === token);
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
        names: customerNames(campaign),
      });
    },
    async answerClientLink({ token, versionId, verdict, text, name }) {
      // the send of the link that holds this creative (one link per campaign holds several sends)
      const send =
        db.clientSends.find((s) => s.link?.token === token && s.versionIds.includes(versionId)) ??
        db.clientSends.find((s) => s.link?.token === token);
      if (!send) throw new FumeError("not_found", "This client link has expired.");
      // The agency's own people see the link as a preview; an answer there is never the client's.
      if (!canAnswerClientLink(me()))
        throw new FumeError("forbidden", "This is a preview of the client’s page. Only the client answers here.");
      const c = db.creatives.find((x) => x.current.id === versionId);
      if (!c || !send.versionIds.includes(versionId))
        throw new FumeError("not_found", "This creative is not in the link.");
      // The link is the client's: their approval is theirs (the first person it was sent to, or the client's owner).
      const owner =
        send.to[0] ??
        db.memberships.find(
          (x) => x.workspaceId === send.workspaceId && x.role === "owner" && !person(x.userId)?.agency,
        )?.userId;
      if (verdict === "approve") {
        if (!canBeApproved(c.current)) throw new FumeError("conflict", "This creative is not waiting for approval.");
        m.setVersion(c, {
          state: "approved",
          approvedBy: owner,
          approvedAt: now(),
          recordedNote: name.trim() ? `Through the client link, by ${name.trim()}` : "Through the client link",
        });
      } else {
        if (!text?.trim()) throw new FumeError("invalid", "Say what should change.");
        m.setVersion(c, { state: "changes_requested" });
        db.notifications.unshift({
          id: m.nextId("n"),
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
        m.recount(campaign);
        m.emit({ type: "campaign.state", campaign });
      }
      return wait(c.current);
    },

    // Fume decides which features and updates an agency gets, and when; Fume's own people are not in the plan.
    async agencyPlan() {
      if (!seat()) throw new FumeError("forbidden", "This is for the agency’s people.");
      const plan: AgencyFumePlan = {
        name: "Agency · early access",
        decidedBy:
          "Fume decides which features and updates an agency gets, and when. A new one shows here before it reaches your team.",
        contact: db.users.find((u) => u.id === FUME_CONTACT),
        features: FEATURES,
        requests: [...requests],
      };
      return wait(plan);
    },
    // Borrow Fume's people (which client, what work, how much, when) or write to Fume's customer service. Sander, the
    // agency's producer at Fume, answers it.
    async askFume(input) {
      if (!seat()) throw new FumeError("forbidden", "This is for the agency’s people.");
      if (input.kind === "manpower") {
        if (!input.clientId) throw new FumeError("invalid", "Choose the client the work is for.");
        if (!input.work?.length) throw new FumeError("invalid", "Choose what Fume’s people should do.");
      } else if (!input.text?.trim()) throw new FumeError("invalid", "Write what it is about.");
      const request: FumeRequest = {
        ...input,
        text: input.text?.trim() || undefined,
        id: m.nextId("fr"),
        by: m.userId,
        at: now(),
        state: "sent",
      };
      requests.unshift(request);
      return wait(request);
    },
  };
}
