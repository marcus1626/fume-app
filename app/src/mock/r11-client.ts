// Round 11 CLIENT FLOW (FLOWS §24.2, §24.3, §24.5; PROPOSED 20 Oct 2026): what changes in a client brand an agency
// runs.
// - home(): approving a creative is the client's word, so for the agency's people a checked creative is never "to
//   approve": their Home in the client leaves those waits out, and the screen shows the agency's own checks, what it
//   has to send, and what is with the client instead. For the client's own people (Maja in Brygga Studio's world) the
//   brief, the plan, Fume's questions, the directions and the products are the agency's: her Home keeps only the
//   creatives she approves (her deliveries come in `deliveries`).
// - clientLink(): the link names each creative with the app's one name (copy.creativeName: "Night Body Oil · Feed 3"),
//   so the client reads the same name on the link as in Fume.
// Round 12 AGENCY (UX review DLOAD-4, DLOAD-5, DLOAD-6, brief r12 SENDING; PROPOSED 20 Oct 2026):
// - Checked creatives reach the client only when the agency sends them, as in Fume they reach the customer only once
//   the set is released. `unsentToClient` says which ones are not sent yet: the mock's `visible` (mockApi.ts) hides
//   them from the client's people, so her review, her campaign and her counts hold only what was sent.
// - Every campaign of a client brand carries `waits.toSend` (contract CampaignWaits, round 12): how many checked
//   creatives the agency has not sent yet. The agency reads "2 creatives to send to Maja", the client reads only the
//   rest ("4 creatives to approve"). Fume's own brands get theirs from r9-campaign.ts.
// - The client's bell holds only what she approves and her deliveries (the agency's sends, the masters ready); the
//   brief, the plan and the Engine's runs are the agency's.
// - In the agency's Fume conversation Fume's person is a person at Fume (Sander, the producer Fume gives an agency),
//   so the people of the brand include him; and Fume says why it asks in the agency's words ("Your team checks each
//   one against the client's answer"), since no Fume expert checks an agency's work (FLOWS §24.1).
// A brand no agency runs is as it was.
import type { Campaign, CampaignPlan, ClientSend, Creative, FumeApi, Id, Membership, Notification, Product, User, Workspace } from "../contract";
import * as copy from "../copy";

interface ClientDb {
  users: User[];
  workspaces: Workspace[];
  memberships: Membership[];
  campaigns: Campaign[];
  creatives: Creative[];
  products: Product[];
  notifications: Notification[];
  clientSends?: ClientSend[];
  plans?: CampaignPlan[];
  organisations?: { id: Id; name: string }[];
}

export interface R11ClientContext {
  db: ClientDb;
  userId: () => Id;
  workspaceId: () => Id;
  /** The calls as they were before this layer (read when called). */
  base: () => FumeApi;
}

/** The workspace an agency runs, or undefined. */
const agencyRun = (db: Pick<ClientDb, "workspaces">, workspaceId: Id | undefined) => db.workspaces.find((w) => w.id === workspaceId && w.agencyId);

/** True for a checked creative in a client brand that the agency has not sent to the client yet. */
export function unsentToClient(db: Pick<ClientDb, "workspaces" | "campaigns" | "clientSends">, c: Creative): boolean {
  if (c.current.state !== "checked") return false;
  const campaign = db.campaigns.find((k) => k.id === c.campaignId);
  if (!agencyRun(db, campaign?.workspaceId)) return false;
  return !(db.clientSends ?? []).some((s) => s.versionIds.includes(c.current.id));
}

/** The client's people of a brand: its members who hold no agency seat. */
const clientPerson = (db: ClientDb, userId: Id, workspaceId: Id) => Boolean(agencyRun(db, workspaceId)) && !db.users.find((u) => u.id === userId)?.agency;

/** What Fume says to an agency about why it asks: the agency checks its own creatives (FLOWS §24.1). */
export const agencyWhy = (why: string) => why.replace(/Fume[’']s expert checks each one against your answer/, "Your team checks each one against the client’s answer");

/** The person at Fume who answers an agency in its Fume conversation (FLOWS §24.1, §21). */
export const FUME_CONTACT = "u-sander";

export function r11ClientApi(ctx: R11ClientContext): Pick<FumeApi, "home" | "clientLink" | "notifications" | "people" | "questions"> {
  const { db } = ctx;
  const toSend = (campaignId: Id) => db.creatives.filter((c) => c.campaignId === campaignId && unsentToClient(db, c)).length;

  // Every campaign of a client brand carries how many checked creatives wait to be sent (r9-campaign.ts gives each
  // campaign its live `waits`; this adds `toSend` to the client brands' ones, and to the campaigns added later).
  const withToSend = (c: Campaign) => {
    const d = Object.getOwnPropertyDescriptor(c, "waits");
    if (!d?.get || (d.get as { toSend?: true }).toSend) return;
    const before = d.get;
    const get = function (this: Campaign) {
      const w = before.call(this) as Campaign["waits"];
      return agencyRun(db, c.workspaceId) && w ? { ...w, toSend: toSend(c.id) } : w;
    };
    (get as { toSend?: true }).toSend = true;
    Object.defineProperty(c, "waits", { get, enumerable: true, configurable: true });
  };
  db.campaigns.forEach(withToSend);
  const list = db.campaigns;
  const push = list.push.bind(list);
  list.push = (...rows: Campaign[]) => {
    const n = push(...rows);
    rows.forEach(withToSend);
    return n;
  };

  /** creative id → its one name (copy.creativeName), over the campaign's creatives in the order they were made. */
  const customerNames = (campaign: Campaign): Record<Id, string> => {
    const product = campaign.productIds.length === 1 ? db.products.find((p) => p.id === campaign.productIds[0])?.name : undefined;
    const count = new Map<string, number>();
    const names: Record<Id, string> = {};
    for (const c of db.creatives.filter((x) => x.campaignId === campaign.id)) {
      const n = (count.get(c.format) ?? 0) + 1;
      count.set(c.format, n);
      const own = /^(Feed|Square|Story) [A-Z]?\d+$/.test(c.title.trim()) ? c.title.trim() : `${copy.format[c.format].label} ${n}`;
      names[c.id] = copy.creativeName({ title: own, format: c.format, productName: product ?? campaign.name });
    }
    return names;
  };

  return {
    async home() {
      const view = await ctx.base().home();
      const workspace = agencyRun(db, ctx.workspaceId());
      if (!workspace) return view;
      const agencyPerson = Boolean(db.users.find((u) => u.id === ctx.userId())?.agency);
      // Round 13 (Marcus's card, 23 Oct 2026): a ready plan is the agency's to check until it sends it; then the client's.
      const checked = (campaignId?: Id) => Boolean(db.plans?.find((p) => p.campaignId === campaignId)?.checkedBy);
      const agencyName = db.organisations?.find((o) => o.id === workspace.agencyId)?.name ?? "Your agency";
      if (agencyPerson)
        return {
          ...view,
          waitingOnYou: view.waitingOnYou.flatMap((w) =>
            w.kind === "creatives" ? [] : w.kind === "plan" ? (checked(w.campaignId) ? [] : [{ ...w, detail: "The plan waits for your check. Check it and send it to the client." }]) : [w],
          ),
        };
      // The client: the plan once the agency sent it, and the creatives she approves, counted as sent (the agency's
      // unsent ones are not hers yet).
      const waitingOnYou = view.waitingOnYou.flatMap((w) => {
        if (w.kind === "plan") return checked(w.campaignId) ? [{ ...w, detail: `${agencyName} checked the plan. Approve it and Fume starts.` }] : [];
        if (w.kind !== "creatives") return [];
        const campaign = db.campaigns.find((c) => c.id === w.campaignId);
        const n = campaign ? campaign.counts.checked - toSend(campaign.id) : 0;
        return n > 0 ? [{ ...w, count: n, detail: `${copy.creatives(n)} to approve` }] : [];
      });
      return { ...view, waitingOnYou };
    },
    async clientLink(token) {
      const view = await ctx.base().clientLink(token);
      return { ...view, names: customerNames(view.campaign) };
    },
    async notifications() {
      const list = await ctx.base().notifications();
      // The client's bell: what she approves (the agency's sends) and her deliveries.
      return clientPerson(db, ctx.userId(), ctx.workspaceId()) ? list.filter((n) => n.kind === "checked" || n.kind === "delivered") : list;
    },
    async people() {
      const list = await ctx.base().people();
      if (!agencyRun(db, ctx.workspaceId()) || list.some((u) => u.id === FUME_CONTACT)) return list;
      const contact = db.users.find((u) => u.id === FUME_CONTACT);
      return contact ? [...list, contact] : list;
    },
    async questions() {
      const list = await ctx.base().questions();
      return agencyRun(db, ctx.workspaceId()) ? list.map((q) => ({ ...q, why: agencyWhy(q.why) })) : list;
    },
  };
}
