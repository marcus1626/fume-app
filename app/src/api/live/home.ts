// The customer's Home on the live backend: what waits on her in the cycle (a brief to send, a plan to approve,
// creatives to approve, product facts to confirm) and the campaigns under way. Runs, the service clock, what Fume
// learned and deliveries are not read here yet: they answer empty.
import type { FumeApi, HomeView, WaitingItem } from "../../contract";
import { readBriefs } from "./campaigns";
import type { Live } from "./context";
import { readCampaigns, readCreatives } from "./map";
import { readProducts } from "./products";

type Calls = "home";

/** Fume's Core package until packages are in the database (the mock's p-core): 27 creatives a month. */
const CREATIVE_CAP = 27;

export function homeCalls(live: Live): Pick<FumeApi, Calls> {
  return {
    async home(): Promise<HomeView> {
      const ws = await live.workspaceId();
      const [campaigns, products] = await Promise.all([readCampaigns({ workspaceId: ws }), readProducts(ws)]);
      const briefs = await readBriefs(campaigns.map((c) => c.id));
      const waitingOnYou: WaitingItem[] = [];
      for (const c of campaigns) {
        if (briefs.get(c.id)?.state === "ready")
          waitingOnYou.push({
            id: `wb-${c.id}`,
            kind: "brief",
            campaignId: c.id,
            title: c.name,
            detail: "Your brief is ready to send",
            href: `/campaigns/${c.id}/plan`,
          });
        // The plan, ready, waits on her before anything is made.
        if (c.stage === "plan" && c.waits?.plan === "ready")
          waitingOnYou.push({
            id: `wpl-${c.id}`,
            kind: "plan",
            campaignId: c.id,
            title: c.name,
            detail: "The plan is ready. Approve it and Fume starts.",
            href: `/campaigns/${c.id}/plan`,
          });
        if (c.counts.checked > 0 && c.state !== "in_production")
          waitingOnYou.push({
            id: `wc-${c.id}`,
            kind: "creatives",
            campaignId: c.id,
            title: c.name,
            detail: `${c.counts.checked} checked creatives are ready for you`,
            count: c.counts.checked,
            ...(c.dueAt ? { dueAt: c.dueAt } : {}),
            href: `/campaigns/${c.id}/review`,
          });
      }
      for (const p of products.filter((x) => x.state === "needs_you"))
        waitingOnYou.push({
          id: `wp-${p.id}`,
          kind: "product",
          title: `${p.name} ${p.variant}`.trim(),
          detail: "Confirm what Fume read about this product",
          href: `/brand/products/${p.id}`,
        });
      const active = campaigns.filter((c) => !["delivered", "closed"].includes(c.state));
      const withApproved = campaigns.filter((c) => c.counts.approved > 0).map((c) => c.id);
      const approved = withApproved.length
        ? (await readCreatives({ campaignIds: withApproved }))
            .filter((x) => x.current.state === "approved")
            .sort((a, b) => (b.current.approvedAt ?? "").localeCompare(a.current.approvedAt ?? ""))
            .slice(0, 4)
        : [];
      return {
        waitingOnYou,
        inProduction: campaigns
          .filter(
            (c) =>
              ["scoped", "in_production", "revision"].includes(c.state) ||
              (c.state === "in_review" && c.counts.inCheck > 0),
          )
          .map((campaign) => ({ campaign })),
        fumeNeeds: [],
        recentlyApproved: approved,
        deliveries: [],
        learned: [],
        usage: {
          creativesUsed: active.reduce((n, c) => n + c.counts.creatives, 0),
          creativeCap: CREATIVE_CAP,
          campaignsActive: active.length,
        },
      };
    },
  };
}
