// What waits on whom: the customer's Home, and the overview Fume's studio and an agency share (all brands, one brand,
// the campaigns, the team and usage).
import type {
  AgencyNeed,
  AllBrandsView,
  BrandWorkspaceView,
  Campaign,
  FumeApi,
  HomeView,
  Id,
  StudioCampaignRow,
  TeamLoadRow,
  WaitingItem,
} from "../contract";
import * as copy from "../copy";
import { agencyUsage, packageOf, periodsOf } from "./agency";
import type { Mock } from "./context";
import { queueItems } from "./quality";
import { openQuestion } from "./questions";
import { inDays } from "./seed";

type Calls = "home" | "allBrands" | "brandWorkspace" | "studioCampaigns" | "teamLoad" | "usage";

/** Every campaign, done ones too, with who works on it and who approves it. */
export function studioRows(m: Mock): StudioCampaignRow[] {
  const { db } = m;
  return db.campaigns.map((campaign) => ({
    campaign,
    workspace: m.find(db.workspaces, campaign.workspaceId, "workspace"),
    clock: db.clocks.find((k) => k.campaignId === campaign.id),
    expert: db.staff
      .filter((s) => s.workspaceId === campaign.workspaceId && s.staffRole === "expert")
      .map((s) => m.user(s.userId))[0],
    operator: db.staff
      .filter((s) => s.workspaceId === campaign.workspaceId && s.staffRole === "operator")
      .map((s) => m.user(s.userId))[0],
    readyToRelease: db.creatives.filter((cr) => cr.campaignId === campaign.id && cr.current.state === "checked").length,
    approver: db.users.find((u) => u.id === campaign.approverId),
  }));
}

/** Fume's people and their load. An admin follows and checks nothing, so carries no load and no capacity; only an
 *  expert checks. Each row says the brands and what the person does now, from the same QA items the Check page lists. */
function teamRows(m: Mock): TeamLoadRow[] {
  const { db } = m;
  return db.users
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
}

/** The workspaces the signed-in agency person may see, or undefined for anyone who is not an agency person. An
 *  agency's people check only their own clients' work: nothing crosses (F-D018). */
export function agencyBrands(m: Mock): Set<Id> | undefined {
  const seat = m.db.users.find((u) => u.id === m.userId)?.agency;
  if (!seat) return undefined;
  return new Set(m.db.workspaces.filter((w) => w.agencyId === seat.organisationId).map((w) => w.id));
}

export function homeCalls(m: Mock): Pick<FumeApi, Calls> {
  const { db, wait } = m;

  function customerHome(): HomeView {
    const campaigns = m.myCampaigns();
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
          href: openQuestion(m, c.id)?.href ?? `/fume/${thread?.id ?? "t-general"}`,
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
      // The plan, ready, waits on her before the Engine makes anything.
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
    for (const p of m.inWorkspace(db.products).filter((x) => x.state === "needs_you")) {
      waitingOnYou.push({
        id: `wp-${p.id}`,
        kind: "product",
        title: `${p.name} ${p.variant}`,
        detail: "Confirm what Fume read about this product",
        href: `/brand/products/${p.id}`,
      });
    }
    return {
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
        creativeCap: m.find(
          db.packages,
          m.find(db.organisations, m.find(db.workspaces, m.workspaceId, "workspace").organisationId, "organisation")
            .packageId,
          "package",
        ).creativeCap,
        campaignsActive: campaigns.filter((c) => !["delivered", "closed"].includes(c.state)).length,
        periodEndsAt: inDays(17),
      },
    };
  }

  /** Checked creatives the agency has not sent to the client yet, in one campaign. */
  const toSend = (campaignId: Id) =>
    db.creatives.filter((c) => c.campaignId === campaignId && m.unsentToClient(c)).length;

  function overview(): AllBrandsView {
    m.mustStaff();
    const queue = queueItems(m);
    const rows = studioRows(m);
    // One count per thing. "In check" is what the Check page lists as waiting (its QA items), for every brand alike;
    // "to send" is the checked work not yet with the customer (waits.toSend).
    const qaWaiting = db.qaItems.filter((q) => q.state === "waiting");
    return {
      brands: db.workspaces.map((workspace) => {
        const mine = rows.filter((r) => r.workspace.id === workspace.id);
        return {
          workspace,
          inCheck: qaWaiting.filter((q) => q.workspaceId === workspace.id).length,
          readyToRelease: mine.reduce((n, r) => n + Math.min(r.readyToRelease, r.campaign.waits?.toSend ?? 0), 0),
          running: db.runs.filter((r) => r.state === "running" && mine.some((x) => x.campaign.id === r.campaignId))
            .length,
          nextDue: mine
            .map((r) => r.campaign.dueAt)
            .filter(Boolean)
            .sort()[0],
          blocked: mine.filter((r) => r.campaign.state === "awaiting_input").length,
        };
      }),
      queue,
      runs: db.runs.map((run) => {
        const campaign = m.find(db.campaigns, run.campaignId, "campaign");
        return { run, campaign, workspace: m.find(db.workspaces, campaign.workspaceId, "workspace") };
      }),
      // Due by the plan's delivery date, not the go-live; before any creative is made the total is what the plan
      // holds ("Planned: 9 creatives"), never "0 of 0".
      deliveriesDue: rows
        .filter(
          (r) => (r.campaign.waits?.delivery ?? r.campaign.dueAt) && !["delivered", "closed"].includes(r.campaign.state),
        )
        .map((r) => ({
          campaign: r.campaign,
          workspace: r.workspace,
          dueAt: r.campaign.waits?.delivery ?? r.campaign.dueAt,
          approved: r.campaign.counts.approved,
          total: r.campaign.counts.creatives || (r.campaign.waits?.planned ?? 0),
        }))
        .sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? "")),
      team: teamRows(m),
    };
  }

  return {
    // In a client brand an agency runs, approving a creative is the client's word (FLOWS §24.2): the agency's people
    // see their own checks, the plan to check and what they have to send instead; the client's own people see only the
    // plan once the agency sent it and the creatives she approves, counted as sent.
    async home() {
      const view = customerHome();
      const workspace = db.workspaces.find((w) => w.id === m.workspaceId && w.agencyId);
      if (!workspace) return wait(view);
      const agencyPerson = Boolean(db.users.find((u) => u.id === m.userId)?.agency);
      // A ready plan is the agency's to check until it sends it; then the client's.
      const checked = (campaignId?: Id) => Boolean(db.plans.find((p) => p.campaignId === campaignId)?.checkedBy);
      const agencyName = db.organisations.find((o) => o.id === workspace.agencyId)?.name ?? "Your agency";
      if (agencyPerson)
        return wait({
          ...view,
          waitingOnYou: view.waitingOnYou.flatMap((w) =>
            w.kind === "creatives"
              ? []
              : w.kind === "plan"
                ? checked(w.campaignId)
                  ? []
                  : [{ ...w, detail: "The plan waits for your check. Check it and send it to the client." }]
                : [w],
          ),
        });
      const waitingOnYou = view.waitingOnYou.flatMap((w) => {
        if (w.kind === "plan")
          return checked(w.campaignId)
            ? [{ ...w, detail: `${agencyName} checked the plan. Approve it and Fume starts.` }]
            : [];
        if (w.kind !== "creatives") return [];
        const campaign = db.campaigns.find((c) => c.id === w.campaignId);
        const n = campaign ? campaign.counts.checked - toSend(campaign.id) : 0;
        return n > 0 ? [{ ...w, count: n, detail: `${copy.creatives(n)} to approve` }] : [];
      });
      return wait({ ...view, waitingOnYou });
    },

    // One overview for Fume's studio and an agency. Each brand gets its picture and its most urgent campaign; Fume's
    // people get what needs them (plans and creatives to check). An agency sees only its own clients.
    async allBrands() {
      const v = overview();
      const seat = db.users.find((u) => u.id === m.userId)?.agency;
      const mine = (id: Id) => !seat || db.workspaces.find((w) => w.id === id)?.agencyId === seat.organisationId;
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
              at: p.writtenAt ?? m.now(),
            },
          ];
        });
      const waiting = db.qaItems.filter((q) => q.state === "waiting");
      const checks: AgencyNeed[] = [...new Set(waiting.map((q) => `${q.workspaceId}|${q.campaignId}`))].map((key) => {
        const [brand, campaignId] = key.split("|") as [Id, Id];
        const items = waiting
          .filter((q) => q.workspaceId === brand && q.campaignId === campaignId)
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
      return wait({
        ...v,
        brands,
        needsYou: seat ? [] : [...plans, ...checks].sort((x, y) => y.at.localeCompare(x.at)),
        queue: v.queue.filter((q) => mine(q.workspace.id)),
        runs: v.runs.filter((r) => mine(r.workspace.id)),
        deliveriesDue: v.deliveriesDue.filter((d) => mine(d.workspace.id)),
        team: seat ? v.team.filter((r) => r.user.agency?.organisationId === seat.organisationId) : v.team,
      });
    },
    async brandWorkspace(workspaceId): Promise<BrandWorkspaceView> {
      m.mustStaff();
      const workspace = m.find(db.workspaces, workspaceId, "workspace");
      const campaigns = studioRows(m).filter((r) => r.workspace.id === workspaceId);
      return wait({
        workspace,
        campaigns,
        engineOutput: db.runs
          .filter((r) => campaigns.some((c) => c.campaign.id === r.campaignId))
          .map((run) => ({
            run,
            campaign: m.find(db.campaigns, run.campaignId, "campaign"),
            generations: db.sessions.filter((s) => s.campaignId === run.campaignId).flatMap((s) => s.generations),
          })),
        queue: queueItems(m).filter((q) => q.workspace.id === workspaceId),
        sessions: db.sessions.filter((s) => s.workspaceId === workspaceId),
        boards: db.boards.filter((b) => b.workspaceId === workspaceId),
      });
    },
    async studioCampaigns() {
      m.mustStaff();
      const rows = studioRows(m);
      const keep = agencyBrands(m);
      return wait(keep ? rows.filter((r) => keep.has(r.workspace.id)) : rows);
    },
    async teamLoad() {
      m.mustStaff();
      return wait(teamRows(m));
    },
    // One Usage page for Fume's admin and an agency. Fume's people get every brand with its figures per period and its
    // package; an agency's people get their own clients, without renders or cost.
    async usage() {
      if (db.users.find((u) => u.id === m.userId)?.agency) return wait(agencyUsage(m));
      m.mustStaff();
      return wait(
        db.usage
          .filter((r) => !db.workspaces.find((w) => w.id === r.workspaceId)?.agencyId)
          .map((r) => ({
            ...r,
            workspace: db.workspaces.find((w) => w.id === r.workspaceId),
            periods: periodsOf(m, r.workspaceId, r),
            package: packageOf(m, r.workspaceId),
          })),
      );
    },
  };
}
