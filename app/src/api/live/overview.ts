// Fume's own Overview on the live backend: every brand the person works on, what waits on them (plans and creatives
// to check), the deliveries due and the team's load. Engine runs and the queue answer empty until the Engine runs.
import type { AgencyNeed, AllBrandsView, FumeApi, Id, TeamLoadRow } from "../../contract";
import * as copy from "../../copy";
import type { Live } from "./context";
import { qualityCalls } from "./quality";
import { studioCalls } from "./studio";
import { rows, supabase } from "./supabase";

type Calls = "allBrands" | "teamLoad";

const live_ = (state: string) => !["closed", "delivered"].includes(state);

export function overviewCalls(live: Live): Pick<FumeApi, Calls> {
  const studio = studioCalls(live);
  const quality = qualityCalls(live);
  const calls: Pick<FumeApi, Calls> = {
    async allBrands(): Promise<AllBrandsView> {
      const [workspaces, campaignRows, qa] = await Promise.all([
        live.workspaces(),
        studio.studioCampaigns(),
        quality.qaQueue(),
      ]);
      const waiting = qa.filter((q) => q.item.state === "waiting");
      const brandOf = (id: Id) => workspaces.find((w) => w.id === id)?.brandName ?? "";
      const brands = workspaces.map((workspace) => {
        const mine = campaignRows.filter((r) => r.workspace.id === workspace.id);
        const open = mine
          .filter((r) => live_(r.campaign.state))
          .sort((a, b) => (a.campaign.dueAt ?? "9").localeCompare(b.campaign.dueAt ?? "9"));
        const c = open[0]?.campaign;
        const planned = c ? c.counts.creatives || (c.waits?.planned ?? 0) : 0;
        return {
          workspace,
          inCheck: waiting.filter((q) => q.item.workspaceId === workspace.id).length,
          readyToRelease: mine.reduce((n, r) => n + r.readyToRelease, 0),
          running: 0,
          ...(open.find((r) => r.campaign.dueAt)
            ? { nextDue: open.find((r) => r.campaign.dueAt)!.campaign.dueAt }
            : {}),
          blocked: mine.filter((r) => r.campaign.state === "awaiting_input").length,
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
        };
      });
      const plans: AgencyNeed[] = campaignRows
        .filter((r) => r.campaign.waits?.plan === "in_check")
        .map((r) => ({
          id: `on-plan-${r.campaign.id}`,
          clientId: r.workspace.id,
          kind: "plan" as const,
          title: `${r.workspace.brandName} · ${r.campaign.name}`,
          detail: "The plan waits for your check",
          action: "Check the plan",
          href: `/studio/b/${r.workspace.id}/campaigns/${r.campaign.id}/plan`,
          at: r.campaign.updatedAt,
        }));
      const checks: AgencyNeed[] = [...new Set(waiting.map((q) => `${q.item.workspaceId}|${q.item.campaignId}`))].map(
        (key) => {
          const [ws, campaignId] = key.split("|") as [Id, Id];
          const items = waiting
            .filter((q) => q.item.workspaceId === ws && q.item.campaignId === campaignId)
            .sort((x, y) => x.item.dueAt.localeCompare(y.item.dueAt));
          const name = campaignRows.find((r) => r.campaign.id === campaignId)?.campaign.name ?? "Product page";
          return {
            id: `on-check-${campaignId}`,
            clientId: ws,
            kind: "check" as const,
            title: `${brandOf(ws)} · ${name}`,
            detail: `${copy.creatives(items.length)} to check`,
            action: "Check",
            href: `/studio/b/${ws}/qa?campaign=${campaignId}`,
            picture: items[0]!.item.image,
            at: items[0]!.item.madeAt,
          };
        },
      );
      return {
        brands,
        needsYou: [...plans, ...checks].sort((x, y) => y.at.localeCompare(x.at)),
        queue: [],
        runs: [],
        deliveriesDue: campaignRows
          .filter((r) => r.campaign.dueAt && live_(r.campaign.state))
          .map((r) => ({
            campaign: r.campaign,
            workspace: r.workspace,
            dueAt: r.campaign.dueAt,
            approved: r.campaign.counts.approved,
            total: r.campaign.counts.creatives || (r.campaign.waits?.planned ?? 0),
          }))
          .sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? "")),
        team: await calls.teamLoad(),
      };
    },
    async teamLoad(): Promise<TeamLoadRow[]> {
      const [people, staff] = await Promise.all([
        live.people(),
        rows<{ user_id: string; workspace_id: string }>(
          supabase().from("staff_assignments").select("user_id, workspace_id"),
        ),
      ]);
      return [...new Set(staff.map((s) => s.user_id))].flatMap((id) => {
        const user = people.get(id);
        if (!user) return [];
        const brandIds = [...new Set(staff.filter((s) => s.user_id === id).map((s) => s.workspace_id))];
        return [{ user, load: 0, capacity: 4, checksToday: 0, minutesPerCheck: 0, brandIds }];
      });
    },
  };
  return calls;
}
