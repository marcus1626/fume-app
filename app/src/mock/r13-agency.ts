// Round 13 AGENCY (Marcus's video comments #70, #71 and the robots' notes 10-agency, 11-agency-client, 22 Oct 2026;
// PROPOSED): what the agency's places need from the mock this round.
// - agencyPlan(): the agency's Fume plan. Marcus (#70): "vi velger hvilke nye funksjoner og updates de får", so Fume
//   decides what an agency has, what comes and when; Fume's own people are not in the plan ("de får ikke vår
//   manpower"), the agency borrows them on request (#71).
// - askFume(): Borrow Fume's people (which client and campaign, what: checks, design, renders; how much; when) or
//   write to Fume's customer service. It sends a request; Sander, the agency's producer at Fume, answers it.
// - agencyClients / agencyHome: each client's people carry their role ("Can approve"), and a client added in this
//   session says it is new (Fume is still reading it), never "an example client in this preview". Needs you also
//   holds a brief with Fume's questions ("LYSNE · Hand Balm introduction: 2 questions for you"), as Campaigns says.
// - engineChat / engineSay: in a client an agency runs, the Engine says the agency's own check ("for your check"),
//   never "for the expert": no Fume expert checks an agency's work (FLOWS §24.1).
import type { AgencyClient, AgencyFeature, AgencyFumePlan, AgencyNeed, CustomerRole, EngineMessage, FumeApi, FumeRequest, Id, Membership, User, Workspace } from "../contract";
import { FumeError } from "../contract";
import { FUME_CONTACT } from "./r11-client";

type Calls = "agencyPlan" | "askFume";
type Wraps = "agencyClients" | "agencyHome" | "engineChat" | "engineSay";

export interface R13AgencyContext {
  db: { users: User[]; workspaces: Workspace[]; memberships: Membership[] };
  userId: () => Id;
  now: () => string;
  nextId: (prefix: string) => string;
  wait: <T>(value: T) => Promise<T>;
  /** The calls as they were before this layer's wraps (read when called). */
  base: () => Pick<FumeApi, Wraps | "agencyCampaigns">;
}

/** What an agency's Fume plan holds in the preview: Fume decides it (Marcus #70). */
const FEATURES: AgencyFeature[] = [
  { id: "f-dna", name: "Brand DNA for each client", detail: "Fume reads each client’s brand and keeps it apart from the others", state: "included" },
  { id: "f-chat", name: "The Fume chat", detail: "One conversation per client, with its memory", state: "included" },
  { id: "f-engine", name: "The Engine with Product Truth", detail: "Images and designs, each product as it really is", state: "included" },
  { id: "f-studio", name: "The Studio", detail: "Image and Design, models, references and boards", state: "included" },
  { id: "f-check", name: "Check", detail: "Your own experts check every creative before the client sees it", state: "included" },
  { id: "f-send", name: "Send to client and the client link", detail: "The client approves in Fume, or through a link without an account", state: "included" },
  { id: "f-calendar", name: "The calendar and deliveries", detail: "Campaign windows, deliveries and approved creatives", state: "included" },
  { id: "f-video", name: "The video editor", detail: "Video in the Studio, next to Image and Design", state: "coming", when: "Next on Fume’s list" },
  { id: "f-performance", name: "Performance", detail: "How the creatives do once they run, per client", state: "coming", when: "Later this year" },
  { id: "f-publish", name: "Publishing to Meta and Instagram", detail: "From the calendar, straight to the channels", state: "coming", when: "Later this year" },
  { id: "f-figma", name: "Figma", detail: "Masters and designs both ways", state: "coming", when: "Not dated yet" },
  { id: "f-connectors", name: "Claude, ChatGPT and Slack", detail: "Fume in the tools your team already uses", state: "coming", when: "Not dated yet" },
  { id: "f-people", name: "Fume’s people", detail: "Fume’s experts, designers and operators for a campaign that needs more hands", state: "on_request" },
];

/** calls: the agency's own (spread into the api); wraps: four calls it changes, put on over the finished api. */
export function r13AgencyApi(ctx: R13AgencyContext): { calls: Pick<FumeApi, Calls>; wraps: Pick<FumeApi, Wraps> } {
  const { db, wait } = ctx;
  const base = () => ctx.base();
  const me = () => db.users.find((u) => u.id === ctx.userId());
  const seat = () => me()?.agency;
  const requests: FumeRequest[] = [];
  /** Clients added in this session (an added client's workspace is new: it was not in the db at the start). */
  const seeded = new Set(db.workspaces.map((w) => w.id));

  /** Each person's role in their client, from the client's seats. */
  const withRoles = (c: AgencyClient): AgencyClient => {
    const roles: Record<Id, CustomerRole> = {};
    for (const p of c.people) {
      const m = db.memberships.find((x) => x.userId === p.id && x.workspaceId === c.workspace.id);
      if (m) roles[p.id] = m.role;
    }
    return { ...c, roles, isNew: !seeded.has(c.workspace.id) };
  };

  /** The Engine says the agency's own check in a client an agency runs. */
  const agencyWords = (m: EngineMessage): EngineMessage => {
    if (!seat() || !db.workspaces.find((w) => w.id === m.workspaceId)?.agencyId) return m;
    const text = m.text
      .replace(/Each lands in Check as it is made, for the expert\./g, "Each lands in Check as it is made, for your check.")
      .replace(/, for the expert\b/g, ", for your check")
      .replace(/wait for their plans to be approved/g, "wait for your check of their plans")
      .replace(/waits for its plan to be approved/g, "waits for your check of its plan");
    return text === m.text ? m : { ...m, text };
  };

  const calls: Pick<FumeApi, Calls> = {
    async agencyPlan() {
      if (!seat()) throw new FumeError("forbidden", "This is for the agency’s people.");
      const plan: AgencyFumePlan = {
        name: "Agency · early access",
        decidedBy: "Fume decides which features and updates an agency gets, and when. A new one shows here before it reaches your team.",
        contact: db.users.find((u) => u.id === FUME_CONTACT),
        features: FEATURES,
        requests: [...requests],
      };
      return wait(plan);
    },
    async askFume(input) {
      if (!seat()) throw new FumeError("forbidden", "This is for the agency’s people.");
      if (input.kind === "manpower") {
        if (!input.clientId) throw new FumeError("invalid", "Choose the client the work is for.");
        if (!input.work?.length) throw new FumeError("invalid", "Choose what Fume’s people should do.");
      } else if (!input.text?.trim()) throw new FumeError("invalid", "Write what it is about.");
      const request: FumeRequest = { ...input, text: input.text?.trim() || undefined, id: ctx.nextId("fr"), by: ctx.userId(), at: ctx.now(), state: "sent" };
      requests.unshift(request);
      return wait(request);
    },
  };
  const wraps: Pick<FumeApi, Wraps> = {
    async agencyClients() {
      return (await base().agencyClients()).map(withRoles);
    },
    async agencyHome() {
      const view = await base().agencyHome();
      // A campaign whose brief has Fume's questions waits on the agency (its brief, FLOWS §24.2): a row in Needs you,
      // as Campaigns says "2 questions for you".
      const rows = await base().agencyCampaigns();
      const asked: AgencyNeed[] = rows
        .filter((r) => r.example === "full" && r.campaign.state === "awaiting_input" && (r.campaign.waits?.questions ?? 0) > 0)
        .filter((r) => !view.needsYou.some((n) => n.href.startsWith(`/campaigns/${r.campaign.id}`)))
        .map(({ campaign: c, client }) => {
          const n = c.waits?.questions ?? 0;
          return { id: `an-questions-${c.id}`, clientId: client.id, kind: "brief", title: `${client.brandName} · ${c.name}`, detail: `${n === 1 ? "1 question" : `${n} questions`} for you`, action: "Answer", href: `/campaigns/${c.id}`, picture: c.cover, at: c.updatedAt };
        });
      const needsYou = [...view.needsYou, ...asked].sort((a, b) => b.at.localeCompare(a.at));
      return { ...view, needsYou, clients: view.clients.map(withRoles) };
    },
    async engineChat(workspaceId) {
      return (await base().engineChat(workspaceId)).map(agencyWords);
    },
    async engineSay(workspaceId, text) {
      return agencyWords(await base().engineSay(workspaceId, text));
    },
  };
  return { calls, wraps };
}
