// The agency on the live backend (20261103140000_agency.sql, FLOWS §24). An agency's person works on its clients as
// Fume's people do on their brands, so the agency's pages read the same campaigns and checks as Fume's studio, for
// the agency's clients only. Sending to the client and recording an approval are commands; the client link goes
// through the edge function `client-link`, which opens it without an account. The licence is counted by the database
// (public.agency_licence); the Usage page stays on the fallback until the Engine's renders are counted.
import { FunctionsHttpError } from "@supabase/supabase-js";
import type {
  AgencyCampaignRow,
  AgencyClient,
  AgencyFeature,
  AgencyHomeView,
  AgencyNeed,
  AgencyTeamMember,
  ClientLinkView,
  ClientSend,
  CustomerRole,
  FumeApi,
  FumeErrorCode,
  FumeRequest,
  Id,
  Organisation,
  StudioCampaignRow,
  UsageRow,
  User,
  Workspace,
} from "../../contract";
import { FumeError } from "../../contract";
import * as copy from "../../copy";
import type { Live } from "./context";
import { toWorkspace, type WorkspaceRow } from "./context";
import { type CampaignRow, type CreativeWithVersions, type FileRow, toCampaign, toCreatives } from "./map";
import { type PlanRow, toPlan } from "./plan";
import { qualityCalls } from "./quality";
import { studioCalls } from "./studio";
import { command, requestKey, rows, supabase } from "./supabase";

type Calls =
  | "agencyHome"
  | "agencyClients"
  | "agencyCampaigns"
  | "agencyTeam"
  | "addClient"
  | "inviteToAgency"
  | "sendToClient"
  | "clientSends"
  | "recordClientApproval"
  | "clientLink"
  | "answerClientLink"
  | "answerClientPlan"
  | "agencyPlan"
  | "askFume"
  | "licence"
  | "usage";

interface SendRow {
  id: string;
  campaign_id: string;
  workspace_id: string;
  version_ids: string[];
  plan_version: number | null;
  to_ids: string[];
  link_token: string | null;
  note: string | null;
  sent_by: string;
  sent_at: string;
  link?: { token: string; expires_at: string } | null;
}
interface RequestRow {
  id: string;
  kind: FumeRequest["kind"];
  client_id: string | null;
  campaign_id: string | null;
  work: FumeRequest["work"];
  amount: string | null;
  when_text: string | null;
  topic: string | null;
  text: string | null;
  by: string;
  at: string;
}

const linkUrl = (token: string) => `${window.location.origin}/c/${token}`;

function toSend(r: SendRow, links: Map<string, string>): ClientSend {
  const token = r.link?.token ?? r.link_token;
  const expires = r.link?.expires_at ?? (token ? links.get(token) : undefined);
  return {
    id: r.id,
    campaignId: r.campaign_id,
    workspaceId: r.workspace_id,
    versionIds: r.version_ids ?? [],
    ...(r.plan_version ? { plan: { version: r.plan_version } } : {}),
    to: r.to_ids ?? [],
    ...(token && expires ? { link: { token, url: linkUrl(token), expiresAt: expires } } : {}),
    ...(r.note ? { note: r.note } : {}),
    sentBy: r.sent_by,
    sentAt: r.sent_at,
  };
}

const toRequest = (r: RequestRow): FumeRequest => ({
  id: r.id,
  kind: r.kind,
  ...(r.client_id ? { clientId: r.client_id } : {}),
  ...(r.campaign_id ? { campaignId: r.campaign_id } : {}),
  ...(r.work?.length ? { work: r.work } : {}),
  ...(r.amount ? { amount: r.amount } : {}),
  ...(r.when_text ? { when: r.when_text } : {}),
  ...(r.topic ? { topic: r.topic } : {}),
  ...(r.text ? { text: r.text } : {}),
  by: r.by,
  at: r.at,
  state: "sent",
});

/** What the agency's plan with Fume holds now, and what comes (Fume decides when). */
const FEATURES: AgencyFeature[] = [
  {
    id: "f-dna",
    name: "Brand DNA for each client",
    detail: "Fume keeps each client’s brand apart from the others",
    state: "included",
  },
  { id: "f-chat", name: "The Fume chat", detail: "One conversation per client, with its memory", state: "included" },
  { id: "f-plan", name: "Plans and copy", detail: "Fume writes the campaign plan from the brief", state: "included" },
  {
    id: "f-check",
    name: "Check",
    detail: "Your own people check every creative before the client sees it",
    state: "included",
  },
  {
    id: "f-send",
    name: "Send to client and the client link",
    detail: "The client approves in Fume, or through a link without an account",
    state: "included",
  },
  {
    id: "f-engine",
    name: "The Engine",
    detail: "Images made from the plan, each product as it really is",
    state: "coming",
    when: "November",
  },
  {
    id: "f-video",
    name: "Video",
    detail: "Video in the Studio, next to Image and Design",
    state: "coming",
    when: "December",
  },
  {
    id: "f-calendar",
    name: "The content calendar",
    detail: "Campaign windows, deliveries and what goes out when",
    state: "coming",
    when: "Not dated yet",
  },
  {
    id: "f-performance",
    name: "Performance and the ad channels",
    detail: "Meta, TikTok, Google and WhatsApp ads, each result tied to its creative",
    state: "coming",
    when: "Not dated yet",
  },
  {
    id: "f-people",
    name: "Fume’s people",
    detail: "Fume’s experts and designers for a campaign that needs more hands",
    state: "on_request",
  },
];

/** The edge function's refusal, with its code and words. */
async function linkCall<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase().functions.invoke<T>("client-link", { body });
  if (error) {
    const said: { code?: FumeErrorCode; message?: string } =
      error instanceof FunctionsHttpError ? await error.context.json().catch(() => ({})) : {};
    throw new FumeError(said.code ?? "unavailable", said.message ?? "The link could not be opened just now.");
  }
  return data as T;
}

interface LinkData {
  view: {
    sends: SendRow[];
    workspace: WorkspaceRow;
    agency: { id: string; name: string } | null;
    campaign: CampaignRow;
    creatives: CreativeWithVersions[];
    plans: PlanRow[];
    brief_version: number;
    people: { id: string; name: string; title: string; email: string; avatar_url: string | null }[];
  };
  urls: Record<string, string>;
}

function toLinkView(d: LinkData): ClientLinkView {
  const v = d.view;
  const links = new Map<string, string>();
  const sends = v.sends.map((s) => toSend(s, links));
  const files = new Map<Id, { url: string; file: FileRow }>();
  for (const c of v.creatives)
    for (const x of c.creative_versions ?? [])
      if (x.files && d.urls[x.files.id]) files.set(x.files.id, { url: d.urls[x.files.id]!, file: x.files });
  const creatives = toCreatives(v.creatives, files);
  const campaign = toCampaign(v.campaign, {
    productIds: [],
    plan: v.plans.at(-1),
    creatives,
    toSend: 0,
    brandDnaVersion: 1,
  });
  const people = new Map<Id, User>(
    v.people.map((p) => [
      p.id,
      { id: p.id, name: p.name, title: p.title, email: p.email, ...(p.avatar_url ? { avatar: p.avatar_url } : {}) },
    ]),
  );
  const send = sends[0]!;
  const planSend = sends.find((s) => s.plan);
  const count = new Map<string, number>();
  const names: Record<Id, string> = {};
  for (const c of creatives) {
    const n = (count.get(c.format) ?? 0) + 1;
    count.set(c.format, n);
    const own = /^(Feed|Square|Story) [A-Z]?\d+$/.test(c.title.trim())
      ? c.title.trim()
      : `${copy.format[c.format].label} ${n}`;
    names[c.id] = copy.creativeName({ title: own, format: c.format, productName: campaign.name });
  }
  const agency: Organisation = {
    id: v.agency?.id ?? "",
    name: v.agency?.name ?? "",
    kind: "agency",
    packageId: "p-agency",
  };
  return {
    send,
    client: toWorkspace(v.workspace),
    agency,
    campaign,
    creatives,
    sentBy: people.get(send.sentBy) ?? { id: send.sentBy, name: agency.name, title: "", email: "" },
    names,
    ...(planSend && v.plans.length
      ? { plan: toPlan(v.plans, [], v.brief_version, v.campaign.rounds_included), planSend }
      : {}),
  };
}

export function agencyCalls(live: Live): Pick<FumeApi, Calls> {
  const studio = studioCalls(live);
  const quality = qualityCalls(live);

  const mustAgency = async () => {
    const me = await live.me();
    if (!me.agency) throw new FumeError("forbidden", "This is for the agency's people.");
    return { me, seat: me.agency };
  };

  /** Everything the agency's pages read, in one round: its clients, their campaigns and checks, the people. */
  const read = async () => {
    const { me, seat } = await mustAgency();
    const [workspaces, campaignRows, qa, people, memberships, seats, made, org] = await Promise.all([
      live.workspaces(),
      studio.studioCampaigns(),
      quality.qaQueue(undefined, { light: true }),
      live.people(),
      rows<{ user_id: string; workspace_id: string; role: CustomerRole }>(
        supabase().from("memberships").select("user_id, workspace_id, role"),
      ),
      rows<{ user_id: string; role: "lead" | "creative" }>(
        supabase().from("agency_seats").select("user_id, role").eq("organisation_id", seat.organisationId),
      ),
      rows<{ id: string; created_at: string }>(
        supabase().from("workspaces").select("id, created_at").eq("agency_id", seat.organisationId),
      ),
      rows<{ id: string; name: string }>(
        supabase().from("organisations").select("id, name").eq("id", seat.organisationId),
      ),
    ]);
    const clients = workspaces.filter((w) => w.agencyId === seat.organisationId);
    const ids = new Set(clients.map((w) => w.id));
    const mine = campaignRows.filter((r) => ids.has(r.workspace.id));
    const waiting = qa.filter((q) => q.item.state === "waiting" && ids.has(q.item.workspaceId));
    const agency: Organisation = {
      id: seat.organisationId,
      name: org[0]?.name ?? "",
      kind: "agency",
      packageId: "p-agency",
    };
    return { me, seat, clients, mine, waiting, people, memberships, seats, made, agency };
  };
  type Read = Awaited<ReturnType<typeof read>>;

  const clientPeople = (r: Read, ws: Id) =>
    r.memberships.filter((m) => m.workspace_id === ws).flatMap((m) => r.people.get(m.user_id) ?? []);
  const firstName = (r: Read, ws: Id) => clientPeople(r, ws)[0]?.name.split(" ")[0] ?? "the client";
  const live_ = (row: StudioCampaignRow) => !["closed", "delivered"].includes(row.campaign.state);
  /** Checked and sent, not approved yet: with the client. */
  const withClient = (row: StudioCampaignRow) => Math.max(0, row.campaign.counts.checked - row.readyToRelease);
  const plansToCheck = (rows_: StudioCampaignRow[]) => rows_.filter((x) => x.campaign.waits?.plan === "in_check");

  const toClient = (r: Read, w: Workspace): AgencyClient => {
    const rows_ = r.mine.filter((x) => x.workspace.id === w.id);
    const open = rows_.filter(live_).sort((a, b) => (a.campaign.dueAt ?? "9").localeCompare(b.campaign.dueAt ?? "9"));
    const plans = plansToCheck(open);
    const checks = r.waiting.filter((q) => q.item.workspaceId === w.id);
    const toSendRows = open.filter((x) => x.readyToRelease > 0);
    const sending = toSendRows.reduce((n, x) => n + x.readyToRelease, 0);
    const theirs = open.reduce((n, x) => n + withClient(x), 0);
    const who = firstName(r, w.id);
    const c = open[0]?.campaign;
    const planned = c ? c.counts.creatives || (c.waits?.planned ?? 0) : 0;
    const since = r.made.find((m) => m.id === w.id)?.created_at ?? new Date().toISOString();
    const status = plans[0]
      ? `${plans[0].campaign.name}: the plan waits for your check`
      : checks.length
        ? `${copy.creatives(checks.length)} to check`
        : sending
          ? `${toSendRows[0]!.campaign.name}: ${copy.creatives(sending)} to send to ${who}`
          : theirs
            ? `${copy.creatives(theirs)} with ${who}`
            : open.length
              ? "Nothing waits on you"
              : "No campaign yet";
    const lead = r.seats.find((s) => s.role === "lead");
    const roles: Record<Id, CustomerRole> = {};
    for (const m of r.memberships.filter((x) => x.workspace_id === w.id)) roles[m.user_id] = m.role;
    return {
      workspace: w,
      status,
      waitingOnYou: plans.length + (checks.length ? 1 : 0) + (sending ? 1 : 0),
      ...(theirs ? { waitingOn: `${copy.creatives(theirs)} with ${who}` } : {}),
      ...(checks[0]?.item.image ? { picture: checks[0].item.image } : {}),
      campaignsActive: open.length,
      ...(c
        ? {
            current: {
              campaignId: c.id,
              name: c.name,
              progress: planned ? Math.min(1, c.counts.approved / planned) : 0,
              detail: planned ? `${planned} creatives · ${c.counts.approved} approved` : "No creatives yet",
            },
          }
        : {}),
      ...(open.find((x) => x.campaign.dueAt)
        ? {
            nextDelivery: {
              title: `${open.find((x) => x.campaign.dueAt)!.campaign.name}, the delivery`,
              at: open.find((x) => x.campaign.dueAt)!.campaign.dueAt!,
            },
          }
        : {}),
      people: clientPeople(r, w.id),
      ...(lead && r.people.get(lead.user_id) ? { lead: r.people.get(lead.user_id) } : {}),
      example: "full",
      since,
      roles,
      isNew: rows_.length === 0 && Date.now() - Date.parse(since) < 2 * 86_400_000,
    };
  };

  const clientsOf = (r: Read) =>
    r.clients
      .map((w) => toClient(r, w))
      .sort((a, b) => b.waitingOnYou - a.waitingOnYou || b.since.localeCompare(a.since));

  const needsOf = (r: Read): AgencyNeed[] => {
    const brand = (ws: Id) => r.clients.find((w) => w.id === ws)?.brandName ?? "";
    const open = r.mine.filter(live_);
    const plans = plansToCheck(open).map((x) => ({
      id: `an-plan-${x.campaign.id}`,
      clientId: x.workspace.id,
      kind: "plan" as const,
      title: `${x.workspace.brandName} · ${x.campaign.name}`,
      detail: "The plan waits for your check",
      action: "Check the plan",
      href: `/campaigns/${x.campaign.id}/plan`,
      at: x.campaign.updatedAt,
    }));
    const checks = [...new Set(r.waiting.map((q) => `${q.item.workspaceId}|${q.item.campaignId}`))].map((key) => {
      const [ws, campaignId] = key.split("|") as [Id, Id];
      const items = r.waiting.filter((q) => q.item.workspaceId === ws && q.item.campaignId === campaignId);
      const name = open.find((x) => x.campaign.id === campaignId)?.campaign.name ?? "Product page";
      return {
        id: `an-check-${campaignId || "product-page"}`,
        clientId: ws,
        kind: "check" as const,
        title: `${brand(ws)} · ${name}`,
        detail: `${copy.creatives(items.length)} to check`,
        action: "Check",
        href: `/studio/b/${ws}/qa${campaignId ? `?campaign=${campaignId}` : ""}`,
        ...(items[0]?.item.image ? { picture: items[0].item.image } : {}),
        at: items[0]?.item.madeAt ?? new Date().toISOString(),
      };
    });
    const sends = open
      .filter((x) => x.readyToRelease > 0)
      .map((x) => ({
        id: `an-send-${x.campaign.id}`,
        clientId: x.workspace.id,
        kind: "check" as const,
        title: `${x.workspace.brandName} · ${x.campaign.name}`,
        detail: `${copy.creatives(x.readyToRelease)} to send to ${firstName(r, x.workspace.id)}`,
        action: "Send",
        href: `/campaigns/${x.campaign.id}/review?send=1`,
        at: x.campaign.updatedAt,
      }));
    return [...plans, ...checks, ...sends].sort((a, b) => b.at.localeCompare(a.at));
  };

  const teamOf = (r: Read): AgencyTeamMember[] =>
    r.seats.flatMap((s) => {
      const user = r.people.get(s.user_id);
      if (!user) return [];
      const checks = r.waiting.length;
      const plans = plansToCheck(r.mine.filter(live_)).length;
      return [
        {
          user,
          role: s.role,
          clientIds: r.clients.map((w) => w.id),
          load: 0,
          thisWeek:
            [checks ? `${copy.creatives(checks)} to check` : "", plans ? `${copy.count(plans, "plan")} to check` : ""]
              .filter(Boolean)
              .join(" · ") || "Nothing to check",
        },
      ];
    });

  const sendRows = async (filter: { campaignId: Id }) => {
    const [sends, links] = await Promise.all([
      rows<SendRow>(
        supabase()
          .from("client_sends")
          .select(
            "id, campaign_id, workspace_id, version_ids, plan_version, to_ids, link_token, note, sent_by, sent_at",
          )
          .eq("campaign_id", filter.campaignId)
          .order("sent_at", { ascending: false }),
      ),
      rows<{ token: string; expires_at: string }>(
        supabase().from("client_links").select("token, expires_at").eq("campaign_id", filter.campaignId),
      ),
    ]);
    const map = new Map(links.map((l) => [l.token, l.expires_at]));
    return sends.map((s) => toSend(s, map));
  };

  const calls: Pick<FumeApi, Calls> = {
    async agencyHome(): Promise<AgencyHomeView> {
      const r = await read();
      const clients = clientsOf(r);
      const open = r.mine.filter(live_);
      const plans = plansToCheck(open).length;
      const checks = r.waiting.length;
      const sending = open.reduce((n, x) => n + x.readyToRelease, 0);
      const theirs = open.reduce((n, x) => n + withClient(x), 0);
      const yours = [
        plans ? copy.count(plans, "plan") : "",
        checks ? `${copy.creatives(checks)} to check` : "",
        sending ? `${sending} to send` : "",
      ].filter(Boolean);
      const mine =
        yours.length > 1
          ? `${yours.slice(0, -1).join(", ")} and ${yours[yours.length - 1]} wait on you`
          : yours.length
            ? `${yours[0]} ${yours[0]!.startsWith("1 ") ? "waits" : "wait"} on you`
            : "";
      const parts = [mine, theirs ? `${copy.creatives(theirs)} with your clients` : ""].filter(Boolean);
      const n = clients.length;
      return {
        agency: r.agency,
        summary: `${n === 1 ? "1 client brand" : `${n} client brands`}.${parts.length ? ` ${parts.join("; ")}.` : " Nothing waits on you today."}`,
        clients,
        needsYou: needsOf(r),
        team: teamOf(r),
      };
    },
    async licence() {
      const { seat } = await mustAgency();
      const [r, workspaces, org] = await Promise.all([
        command<{
          package: { from: string; to: string | null; scope: string };
          clients: { workspaceId: string; creativesMade: number; creativesApproved: number }[];
          seats: { used: number; included: number };
        }>("agency_licence", {}),
        live.workspaces(),
        rows<{ id: string; name: string }>(
          supabase().from("organisations").select("id, name").eq("id", seat.organisationId),
        ),
      ]);
      const usage = r.clients.flatMap((c) => {
        const client = workspaces.find((w) => w.id === c.workspaceId);
        return client ? [{ client, creativesMade: c.creativesMade, creativesApproved: c.creativesApproved }] : [];
      });
      const to = r.package.to ?? new Date().toISOString();
      return {
        agency: { id: seat.organisationId, name: org[0]?.name ?? "", kind: "agency", packageId: "p-agency" },
        period: { from: r.package.from, to },
        scope: r.package.scope || "Product campaigns for your clients, made with Fume",
        usage,
        total: {
          creativesMade: usage.reduce((n, u) => n + u.creativesMade, 0),
          creativesApproved: usage.reduce((n, u) => n + u.creativesApproved, 0),
        },
        seats: r.seats,
      };
    },
    // The Usage page: Fume's people see the brands they work on, an agency the agency's clients (usage_overview).
    async usage() {
      const [list, workspaces] = await Promise.all([
        command<(Omit<UsageRow, "package"> & { package: UsageRow["package"] | null })[]>("usage_overview", {}),
        live.workspaces(),
      ]);
      return list.map(({ package: pkg, ...r }) => {
        const workspace = workspaces.find((w) => w.id === r.workspaceId);
        return { ...r, ...(workspace ? { workspace } : {}), ...(pkg ? { package: pkg } : {}) };
      });
    },
    async agencyClients() {
      return clientsOf(await read());
    },
    async agencyCampaigns(): Promise<AgencyCampaignRow[]> {
      const r = await read();
      return r.mine.map((x) => ({
        campaign: x.campaign,
        client: x.workspace,
        status: "",
        ...(x.campaign.dueAt ? { liveAt: x.campaign.dueAt } : {}),
        example: "full" as const,
        ...(withClient(x) ? { waitingOn: `Waiting on ${firstName(r, x.workspace.id)}` } : {}),
      }));
    },
    async agencyTeam() {
      return teamOf(await read());
    },
    // Into the agency: the database keeps the invitation and the seat (invite_agency_person), the edge function sends
    // the email. An Operator runs the Engine, so that role comes with it.
    async inviteToAgency({ email, role }) {
      const { seat } = await mustAgency();
      if (role === "operator")
        throw new FumeError(
          "unavailable",
          "An operator runs the Engine, which comes later. Invite them as an expert for now.",
        );
      const { data, error } = await supabase().functions.invoke<{ joined: boolean }>("invite", {
        body: {
          agencyId: seat.organisationId,
          agencyRole: role === "admin" ? "lead" : "creative",
          email: email.trim(),
          site: window.location.origin,
        },
      });
      if (error) {
        const said: { code?: FumeErrorCode; message?: string } =
          error instanceof FunctionsHttpError ? await error.context.json().catch(() => ({})) : {};
        throw new FumeError(said.code ?? "unavailable", said.message ?? "The invitation wasn’t sent. Try again.");
      }
      live.forget();
      return { joined: Boolean(data?.joined) };
    },
    // The client brand first (the database makes the agency's people its team), then its people's invitations.
    async addClient({ brandName, website, market, language, people }) {
      const { me } = await mustAgency();
      const row = await command<WorkspaceRow>("add_client", {
        p_brand_name: brandName,
        p_market: market ?? "",
        p_language: language ?? "en",
        p_website: website ?? null,
        p_key: requestKey(),
      });
      const failed: string[] = [];
      for (const p of people.filter((x) => x.email.trim())) {
        const { error } = await supabase().functions.invoke("invite", {
          body: { workspaceId: row.id, email: p.email.trim(), role: p.role, site: window.location.origin },
        });
        if (error) failed.push(p.email.trim());
      }
      live.forget();
      const workspace = toWorkspace(row);
      // Fume reads the brand from its website at once (edge function brand-scan); a site that will not open is kept
      // as a failed reading, and the client's Brand page says what to do.
      let read = false;
      if (website?.trim())
        read = await supabase()
          .functions.invoke("brand-scan", {
            body: { workspaceId: row.id, url: website.trim(), brand: workspace.brandName },
          })
          .then(({ data }) => (data as { scan?: { state?: string } } | null)?.scan?.state === "done")
          .catch(() => false);
      if (failed.length)
        throw new FumeError(
          "unavailable",
          `${workspace.brandName} is added, but the invitation to ${failed.join(", ")} wasn’t sent. Invite them from the client’s Team.`,
        );
      return {
        workspace,
        status: read
          ? "New client: Brand DNA to confirm"
          : website
            ? `New client: Fume could not read ${website.replace(/^https?:\/\//, "")}`
            : "New client: Fume needs the website or the brand guide",
        waitingOnYou: 1,
        campaignsActive: 0,
        people: [],
        lead: me,
        example: "full",
        since: new Date().toISOString(),
        isNew: true,
      };
    },
    async sendToClient({ campaignId, versionIds, to, link, note, plan }) {
      const row = await command<SendRow>("send_to_client", {
        p_campaign_id: campaignId,
        p_version_ids: versionIds,
        p_to: to,
        p_link: link,
        p_note: note ?? null,
        p_plan: plan ?? false,
        p_key: requestKey(),
      });
      return toSend(row, new Map());
    },
    async clientSends(campaignId) {
      return sendRows({ campaignId });
    },
    async recordClientApproval({ versionIds, clientUserId, note, at }) {
      const done = await command<{ id: string; creative_id: string }[]>("record_client_approval", {
        p_version_ids: versionIds,
        p_client_user_id: clientUserId,
        p_note: note,
        p_at: at ?? null,
      });
      const { readCreatives } = await import("./map");
      const creatives = await readCreatives({ creativeIds: [...new Set(done.map((v) => v.creative_id))] });
      return creatives.flatMap((c) => c.versions.filter((v) => versionIds.includes(v.id)));
    },
    async clientLink(token) {
      return toLinkView(await linkCall<LinkData>({ action: "view", token }));
    },
    async answerClientLink({ token, versionId, verdict, text, name }) {
      await linkCall({ action: "answer", token, versionId, verdict, text, name });
      const view = toLinkView(await linkCall<LinkData>({ action: "view", token }));
      const found = view.creatives.flatMap((c) => c.versions).find((v) => v.id === versionId);
      if (!found) throw new FumeError("not_found", "This creative is not in the link.");
      return found;
    },
    async answerClientPlan({ token, verdict, text, name }) {
      await linkCall({ action: "plan", token, verdict, text, name });
      const view = toLinkView(await linkCall<LinkData>({ action: "view", token }));
      if (!view.plan) throw new FumeError("not_found", "This link holds no plan.");
      return view.plan;
    },
    async agencyPlan() {
      await mustAgency();
      const requests = await rows<RequestRow>(
        supabase()
          .from("fume_requests")
          .select("id, kind, client_id, campaign_id, work, amount, when_text, topic, text, by, at")
          .order("at", { ascending: false }),
      );
      return {
        name: "Agency · early access",
        decidedBy:
          "Fume decides which features and updates an agency gets, and when. A new one shows here before it reaches your team.",
        features: FEATURES,
        requests: requests.map(toRequest),
      };
    },
    async askFume(input) {
      const row = await command<RequestRow>("ask_fume", {
        p_kind: input.kind,
        p_client_id: input.clientId ?? null,
        p_campaign_id: input.campaignId ?? null,
        p_work: input.work ?? [],
        p_amount: input.amount ?? null,
        p_when: input.when ?? null,
        p_topic: input.topic ?? null,
        p_text: input.text ?? null,
      });
      return toRequest(row);
    },
  };
  return calls;
}
