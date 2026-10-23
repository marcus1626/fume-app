// Round 11 AGENCY PAGES (FLOWS §24.1, §24.3; PROPOSED 20 Oct 2026): two things the agency's places need from the mock.
// 1. An agency's people check only their own clients' work. The studio's queue calls (qaQueue, studioCampaigns) return
//    every brand's items to any staff person; for an agency person they keep to the brands that agency runs, so the
//    agency's Check (and its count) never shows a brand Fume works on for someone else (F-D018: nothing crosses).
// 2. A client the lead adds stays: addClient's new client joins agencyClients and agencyHome (recent first, as the
//    others) and the licence's usage (nothing made yet), so the new row is there after Add the client.
// Everyone else is served as before.
import type { AgencyClient, FumeApi, Id, User, Workspace } from "../contract";

type Calls = "qaQueue" | "studioCampaigns" | "addClient" | "agencyClients" | "agencyHome" | "licence";

export interface R11PagesContext {
  db: { users: User[]; workspaces: Workspace[] };
  userId: () => Id;
  /** The calls as they were before this layer. */
  base: Pick<FumeApi, Calls>;
}

export function r11PagesApi(ctx: R11PagesContext): Pick<FumeApi, Calls> {
  const { base } = ctx;
  /** The workspaces the signed-in agency person may see, or undefined for anyone who is not an agency person. */
  const ours = (): Set<Id> | undefined => {
    const seat = ctx.db.users.find((u) => u.id === ctx.userId())?.agency;
    if (!seat) return undefined;
    return new Set(ctx.db.workspaces.filter((w) => w.agencyId === seat.organisationId).map((w) => w.id));
  };
  const added: AgencyClient[] = [];
  /** The agency's clients with the ones added in this session, recent first. */
  const withAdded = (list: AgencyClient[]) =>
    [...list, ...added.filter((a) => !list.some((c) => c.workspace.id === a.workspace.id))].sort((a, b) => (b.openedAt ?? "").localeCompare(a.openedAt ?? ""));

  return {
    async qaQueue(workspaceId) {
      const views = await base.qaQueue(workspaceId);
      const keep = ours();
      return keep ? views.filter((v) => keep.has(v.workspace.id)) : views;
    },
    async studioCampaigns() {
      const rows = await base.studioCampaigns();
      const keep = ours();
      return keep ? rows.filter((r) => keep.has(r.workspace.id)) : rows;
    },
    async addClient(input) {
      const client = await base.addClient(input);
      added.push(client);
      return client;
    },
    async agencyClients() {
      return withAdded(await base.agencyClients());
    },
    async agencyHome() {
      const view = await base.agencyHome();
      const clients = withAdded(view.clients);
      const summary = clients.length === view.clients.length ? view.summary : view.summary.replace(/^\d+ client brands\./, `${clients.length} client brands.`);
      return { ...view, clients, summary };
    },
    async licence() {
      const view = await base.licence();
      const usage = [...view.usage, ...added.filter((a) => !view.usage.some((u) => u.client.id === a.workspace.id)).map((a) => ({ client: a.workspace, creativesMade: 0, creativesApproved: 0 }))];
      return { ...view, usage };
    },
  };
}
