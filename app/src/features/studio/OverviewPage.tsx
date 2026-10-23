// The overview (FLOWS §4.2 and §24.3): one page for Fume's studio ("All brands") and an agency ("All clients").
// DECIDED by Marcus 20 Oct 2026: "Agency dashboard blir strengt tatt lik som vår, vi skal ha performance og alt sånt
// vi også", so what Fume's team gets here, an agency gets too.
// Round 12 (desktop review 20 Oct, DLAY-7, DLOAD-12, DTASK-19, DWAY-14, DWAY-20; PROPOSED 20 Oct 2026): the work first.
// The greeting and one headline built the same way in both frames ("2 brands. 1 plan and 5 creatives to check; 6
// creatives with Maja."); then what needs you (two thirds) beside the deliveries due (a third), each opening where the
// work is done (a delivery opens its campaign, never the brand's list); then the brands or clients as compact tiles
// without photos (the mark, the name, a quiet dot when something waits on you, the first ask in one line, the next
// delivery, the current campaign as a thin bar), A to Z so a brand stays where it was (the photos stay on Clients and
// each brand's Home); then the Engine's runs beside the team this week, each person's load as "1.5 of 4". Fume's admin
// follows the work and checks nothing: no Needs you, and the page starts with the brands. Every link is the frame's
// own address (scope.ts): a campaign opens the campaign (Fume: its plan), a run its brand's Engine output.
import { Avatar, Button, EngineRun, Icon, Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemMediaImage, ItemTitle, PageHeader, Progress, useNarrowScreen, type PageHeaderPrimaryAction } from "@fume/ui";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAgencyHome, useAllBrands, useQaQueue, useSession, useStudioCampaigns } from "../../api/hooks";
import type { AgencyNeed, AllBrandsView, Id, StudioCampaignRow, User, Workspace } from "../../contract";
import * as copy from "../../copy";
import { due } from "../../lib/time";
import { Nothing, Page, Query, Section } from "../../shell/Page";
import { firstName, initials } from "../../shell/people";
import { brandBase, campaignHref, hrefIn, type StaffFrameKind } from "../../shell/scope";
import { AddClientPanel, useAddClientParam } from "../agency/agency-add-client";
import { agencyRoleOf, agencyRoleWords, ClientMark, greeting, useAgencySeat, WaitsDot } from "../agency/agency-parts";
import { FumeHelpSection } from "../agency/fume-help";
import { runProps } from "../shared/creatives";
import { staffRoleLabel } from "./parts";

interface TileModel {
  id: Id;
  workspace: Workspace;
  /** The first thing that waits, in one line: "Winter gifting: the plan waits for your check". */
  status: string;
  at?: string;
  current?: { name: string; progress: number; detail: string };
  waiting: number;
  to: string;
}
interface NeedModel {
  id: Id;
  kind: AgencyNeed["kind"];
  title: string;
  detail: string;
  action: string;
  picture?: string;
  to: string;
}
interface DeliveryModel {
  id: Id;
  title: string;
  detail: string;
  at?: string;
  to: string;
}
interface TeamModel {
  user: User;
  lead?: boolean;
  name: string;
  small: string;
  /** The load as a bar, with its number ("1.5 of 4"); none for someone who follows and carries no load. */
  load?: { value: number; max: number; number: string; label: string };
  week?: string;
}
interface OverviewModel {
  frame: StaffFrameKind;
  tilesTitle: string;
  tilesAction?: ReactNode;
  tiles: TileModel[];
  /** Left out for Fume's admin, who follows the work but doesn't check it (FLOWS §20). */
  needs?: NeedModel[];
  runs: AllBrandsView["runs"];
  /** Fume's admin doesn't open Engine output. */
  runsOpen: boolean;
  deliveries: DeliveryModel[];
  deliveriesTo: string;
  team: TeamModel[];
  teamTo: string;
  /** Round 13 AGENCY: the agency's ways to Fume's people, under the team. */
  help?: ReactNode;
}

/** "LYSNE · 2 of 11 approved", or "LYSNE · No creatives yet" while the plan comes first (DLOAD-12: one way to say it). */
const approvedOf = (d: AllBrandsView["deliveriesDue"][number]) => `${d.workspace.brandName} · ${d.total ? `${d.approved} of ${d.total} approved` : "No creatives yet"}`;

const needIcon = { plan: "file-text", check: "fume-check", client_changes: "message-square", brief: "file-text", products: "tag", brand: "palette" } as const;

const byBrand = <T extends { workspace: Workspace }>(a: T, b: T) => a.workspace.brandName.localeCompare(b.workspace.brandName, "en", { sensitivity: "base" });

/** "LYSNE · " (a batch made outside a campaign has no name yet) → "LYSNE". */
const tidy = (title: string) => title.replace(/\s·\s*$/, "");

/** "LYSNE · Winter gifting", "The plan waits for your check" → "Winter gifting: the plan waits for your check". One
 *  colon a sentence: a detail's own ("The brief waits on you: who it is for") becomes a comma after the subject's. */
const askLine = (n: AgencyNeed) => {
  const subject = n.title.split(" · ").slice(1).join(" · ");
  const detail = n.detail.charAt(0).toLowerCase() + n.detail.slice(1);
  return subject ? `${subject}: ${detail.replace(": ", ", ")}` : n.detail;
};

/** Checked creatives not sent yet (waits.toSend), and those sent that wait on someone ("6 creatives with Maja"), counted
 *  as copy.campaignStatus counts them for the staff and the agency. */
export function withCustomers(rows: StudioCampaignRow[], frame: StaffFrameKind) {
  let toSend = 0;
  const people = new Map<string, number>();
  for (const { campaign: c, approver } of rows) {
    if (c.state === "approved" || c.state === "delivered" || c.state === "closed") continue;
    const unsent = Math.min(c.counts.checked, c.waits?.toSend ?? (c.state === "in_production" ? c.counts.checked : 0));
    toSend += unsent;
    const sent = c.state === "in_review" ? c.counts.checked - unsent : 0;
    if (sent <= 0) continue;
    const who = approver ? firstName(approver.name) : frame === "agency" ? "the client" : "the customer";
    people.set(who, (people.get(who) ?? 0) + sent);
  }
  const withThem = [...people].map(([who, n], i) => (i === 0 ? `${copy.creatives(n)} with ${who}` : `${n} with ${who}`)).join(", ");
  return { toSend, withThem };
}

/** The headline, the same sentence in both frames (DLOAD-12): how many, what to check, what to send, what is with whom. */
export function headline(o: { count?: string; plans: number; checks: number; toSend: number; withThem: string; frame: StaffFrameKind; follows: boolean }): string {
  const asks: string[] = [];
  if (!o.follows) {
    const plans = o.plans ? copy.count(o.plans, "plan") : "";
    // Fume's expert checks both: "1 plan and 5 creatives to check". Round 13 AGENCY (robot notes 10-agency,
    // 11-agency-client): so does an agency, which checks its plans and never approves one (only the client approves).
    const both = [plans, o.checks ? copy.creatives(o.checks) : ""].filter(Boolean).join(" and ");
    if (both) asks.push(`${both} to check`);
    if (o.toSend) asks.push(`${copy.creatives(o.toSend)} to send`);
  }
  const rest = [asks.join(", "), o.withThem].filter(Boolean).join("; ");
  // One brand's Home has no count: the sentence alone ("1 plan and 3 creatives to check; 6 creatives with Maja.")
  if (!o.count) return rest ? `${rest.charAt(0).toUpperCase()}${rest.slice(1)}.` : "Nothing waits on you today.";
  return `${o.count}.${rest ? ` ${rest}.` : " Nothing waits on you today."}`;
}

export function OverviewPage() {
  const agency = Boolean(useSession().data?.agency);
  return agency ? <AgencyOverview /> : <StudioOverview />;
}

/** Fume's studio: every brand Fume works for. */
function StudioOverview() {
  const session = useSession().data;
  const me = session?.user;
  const admin = me?.staffRole === "admin";
  const all = useAllBrands();
  // What waits in Check is counted once (qa/count.ts): the same items as the Check page and its badge.
  const qa = useQaQueue();
  const waiting = (qa.data ?? []).filter((x) => x.item.state === "waiting");
  const campaigns = useStudioCampaigns();
  const sent = withCustomers(campaigns.data ?? [], "fume");

  const model = (v: AllBrandsView): OverviewModel => {
    const needs = v.needsYou ?? [];
    return {
      frame: "fume",
      tilesTitle: "Brands",
      tiles: [...v.brands].sort(byBrand).map((b) => {
        const first = needs.find((n) => n.clientId === b.workspace.id);
        const inCheck = waiting.filter((x) => x.item.workspaceId === b.workspace.id).length;
        const status = admin
          ? b.current ? `${b.current.name}: ${b.current.detail}` : b.running ? `${copy.count(b.running, "run")} under way` : "Nothing due"
          : first
            ? askLine(first)
            : inCheck
              ? `${copy.creatives(inCheck)} to check`
              : b.running
                ? `${copy.count(b.running, "run")} under way`
                : "Nothing waits on you";
        return {
          id: b.workspace.id,
          workspace: b.workspace,
          status,
          at: b.nextDue,
          current: b.current,
          waiting: admin ? 0 : needs.filter((n) => n.clientId === b.workspace.id).length || inCheck,
          to: brandBase("fume", b.workspace.id),
        };
      }),
      needs: admin ? undefined : needs.map((n) => ({ ...n, title: tidy(n.title), to: hrefIn("fume", n.clientId, n.href) })),
      runs: v.runs,
      runsOpen: !admin,
      deliveries: v.deliveriesDue.map((d) => ({
        id: d.campaign.id,
        title: d.campaign.name,
        detail: approvedOf(d),
        at: d.dueAt,
        // DTASK-19, DWAY-14: the campaign itself (Fume's admin has no plan to check: the brand's Home)
        to: admin ? brandBase("fume", d.workspace.id) : campaignHref("fume", d.workspace.id, d.campaign.id),
      })),
      deliveriesTo: "/studio/deliveries",
      team: v.team.map((r) => {
        const brands = (r.brandIds ?? []).map((id) => v.brands.find((b) => b.workspace.id === id)?.workspace.brandName).filter(Boolean).join(", ");
        return {
          user: r.user,
          name: `${firstName(r.user.name)}${r.user.id === me?.id ? " (you)" : ""}`,
          small: [staffRoleLabel[r.user.staffRole ?? "expert"], r.follows ? "follows every brand" : brands].filter(Boolean).join(" · "),
          load: r.follows
            ? undefined
            : {
                value: Math.min(r.load, r.capacity),
                max: r.capacity,
                number: `${r.load} of ${r.capacity}`,
                label: `${firstName(r.user.name)} carries ${r.load} of ${r.capacity} Core-equivalents`,
              },
          week: r.doing,
        };
      }),
      teamTo: "/studio/team",
    };
  };

  const summary = all.data
    ? headline({
        count: copy.count(all.data.brands.length, "brand"),
        plans: (all.data.needsYou ?? []).filter((n) => n.kind === "plan").length,
        checks: waiting.length,
        toSend: sent.toSend,
        withThem: sent.withThem,
        frame: "fume",
        follows: admin,
      })
    : undefined;

  return (
    <Page title="Overview" docTitle="All brands">
      <Greeting summary={summary} />
      <Query query={all} loading="Loading every brand">
        {(v) => <Overview model={model(v)} />}
      </Query>
    </Page>
  );
}

/** An agency: its own client brands (the preview has full data for LYSNE only, FLOWS §24.8). */
function AgencyOverview() {
  const { me, lead, isAgency } = useAgencySeat();
  const home = useAgencyHome(isAgency);
  const all = useAllBrands();
  const add = useAddClientParam();
  const navigate = useNavigate();
  const qa = useQaQueue();
  const checks = (qa.data ?? []).filter((x) => x.item.state === "waiting").length;
  const campaigns = useStudioCampaigns();
  const sent = withCustomers(campaigns.data ?? [], "agency");

  const model = (view: NonNullable<typeof home.data>): OverviewModel => {
    const client = (id: Id) => view.clients.find((c) => c.workspace.id === id);
    const v = all.data;
    // The deliveries the mock holds (LYSNE). Round 13 AGENCY (robot note 10-agency): the same list as Deliveries, so
    // an example client's next delivery stays on its tile and its Home (Overview said 4, Deliveries 3).
    const full: DeliveryModel[] = (v?.deliveriesDue ?? []).map((d) => ({
      id: d.campaign.id,
      title: d.campaign.name,
      detail: approvedOf(d),
      at: d.dueAt,
      to: client(d.workspace.id)?.example === "summary" ? brandBase("agency", d.workspace.id) : campaignHref("agency", d.workspace.id, d.campaign.id),
    }));
    return {
      frame: "agency",
      tilesTitle: "Clients",
      tilesAction: (
        <Button asChild variant="quiet" size="sm" iconEnd="arrow-right">
          <Link to="/agency/clients">All clients</Link>
        </Button>
      ),
      tiles: [...view.clients].sort(byBrand).map((c) => {
        const first = view.needsYou.find((n) => n.clientId === c.workspace.id);
        return {
          id: c.workspace.id,
          workspace: c.workspace,
          status: first ? askLine(first) : c.status,
          at: c.nextDelivery?.at,
          current: c.current,
          waiting: c.waitingOnYou,
          to: brandBase("agency", c.workspace.id),
        };
      }),
      needs: view.needsYou.map((n) => ({ ...n, title: tidy(n.title), to: hrefIn("agency", n.clientId, n.href) })),
      runs: v?.runs ?? [],
      runsOpen: true,
      deliveries: full.sort((x, y) => (x.at ?? "9").localeCompare(y.at ?? "9")),
      deliveriesTo: "/agency/deliveries",
      team: view.team.map((t) => {
        const pct = Math.round(t.load * 100);
        const brands = t.clientIds.map((id) => client(id)?.workspace.brandName).filter(Boolean).join(", ");
        return {
          user: t.user,
          lead: t.role === "lead",
          name: `${firstName(t.user.name)}${t.user.id === me?.id ? " (you)" : ""}`,
          // Round 13 AGENCY (Marcus #70): the role in Fume's words, as Fume's own team line ("Expert · LYSNE")
          small: `${agencyRoleWords[agencyRoleOf(t.role, t.user)]} · ${brands}`,
          load: { value: pct, max: 100, number: `${pct} %`, label: `${firstName(t.user.name)}’s week is ${pct} % full` },
          week: t.thisWeek,
        };
      }),
      teamTo: "/agency/team",
      // Round 13 AGENCY (Marcus #71): Book a meeting, Borrow Fume's people and Customer service, beside the team
      help: <FumeHelpSection />,
    };
  };

  const summary = home.data
    ? headline({
        count: copy.count(home.data.clients.length, "client brand"),
        plans: home.data.needsYou.filter((n) => n.kind === "plan").length,
        checks,
        toSend: sent.toSend,
        withThem: sent.withThem,
        frame: "agency",
        follows: false,
      })
    : undefined;

  return (
    <Page title="Overview" docTitle={home.data ? `All clients · ${home.data.agency.name}` : "All clients"}>
      <Greeting
        summary={summary}
        action={lead ? { label: "Add a client", icon: "plus", onSelect: () => add.setOpen(true) } : undefined}
      />
      <Query query={home} loading="Loading your clients">
        {(view) => <Overview model={model(view)} />}
      </Query>
      <AddClientPanel open={add.open} onOpenChange={(o) => add.setOpen(o)} onAdded={(client) => navigate(`/agency/clients?client=${client.workspace.id}`, { replace: true })} />
    </Page>
  );
}

/** The greeting and the day's sentence; the page's one action is its primary one (under the sentence on a phone). */
function Greeting({ summary, action }: { summary?: string; action?: PageHeaderPrimaryAction }) {
  const me = useSession().data?.user;
  return <PageHeader title={`${greeting()}, ${me ? firstName(me.name) : ""}`} description={summary} primaryAction={action} />;
}

/** Two rows of tiles at most; the rest are a click away (Clients). */
const MAX_TILES = 8;

function Overview({ model }: { model: OverviewModel }) {
  const m = model;
  const tiles = (
    <Section title={m.tilesTitle} meta={m.tiles.length} titleId="overview-brands" action={m.tiles.length > MAX_TILES || m.frame === "agency" ? m.tilesAction : undefined}>
      <ul className="ui-agency-tiles" aria-labelledby="overview-brands">
        {m.tiles.slice(0, MAX_TILES).map((t) => (
          <BrandTile key={t.id} tile={t} />
        ))}
      </ul>
    </Section>
  );
  const deliveries = (
    <Section
      title="Deliveries due"
      meta={m.deliveries.length || undefined}
      titleId="overview-deliveries"
      action={
        <Button asChild variant="quiet" size="sm" iconEnd="arrow-right">
          <Link to={m.deliveriesTo} aria-label="All deliveries">
            All
          </Link>
        </Button>
      }
    >
      {m.deliveries.length ? (
        <ItemGroup as="ul" aria-labelledby="overview-deliveries">
          {m.deliveries.slice(0, 5).map((d) => (
            <Item key={d.id} as="li" variant="muted" asChild>
              <Link to={d.to}>
                <ItemContent>
                  <ItemTitle>{d.title}</ItemTitle>
                  <ItemDescription>{d.detail}</ItemDescription>
                </ItemContent>
                <ItemActions>{d.at && <span className="ui-agency-data">{due(d.at)}</span>}</ItemActions>
              </Link>
            </Item>
          ))}
        </ItemGroup>
      ) : (
        <Nothing icon="download" title="Nothing due" text="A delivery shows here once a campaign has a date." />
      )}
    </Section>
  );
  const team = (
    <Section
      title="The team this week"
      titleId="overview-team"
      action={
        <Button asChild variant="quiet" size="sm" iconEnd="arrow-right">
          <Link to={m.teamTo}>Team</Link>
        </Button>
      }
    >
      <TeamWeek team={m.team} />
    </Section>
  );
  const runs = (
    <Section title="The Engine’s runs" meta={m.runs.length || undefined} titleId="overview-runs">
      {m.runs.length ? (
        <div className="ui-app-stack">
          {[...m.runs]
            .sort((a, b) => Number(a.run.state === "done") - Number(b.run.state === "done"))
            .slice(0, 4)
            .map(({ run, campaign, workspace }) => (
              <EngineRun
                key={run.id}
                {...runProps(run)}
                description={`${workspace.brandName} · ${campaign.name}`}
                actions={
                  m.runsOpen ? (
                    <Button asChild variant="secondary" size="sm" iconEnd="arrow-right">
                      <Link to={`${brandBase(m.frame, workspace.id)}/output`}>Engine output</Link>
                    </Button>
                  ) : undefined
                }
              />
            ))}
        </div>
      ) : (
        <Nothing icon="fume-engine" title="No runs today" text="A run starts when a plan is approved." />
      )}
    </Section>
  );

  return (
    <>
      {m.needs ? (
        <div className="ui-app-cols">
          <div className="ui-app-stack ui-studio-gap">
            <Section title="Needs you" meta={m.needs.length || undefined} titleId="overview-needs">
              {m.needs.length ? (
                <ItemGroup as="ul" aria-labelledby="overview-needs">
                  {m.needs.map((n) => (
                    <NeedRow key={n.id} need={n} />
                  ))}
                </ItemGroup>
              ) : (
                <Nothing icon="circle-check" title="Nothing needs you" text="A plan to check, a creative to check or an answer shows here first." />
              )}
            </Section>
          </div>
          <aside className="ui-app-stack ui-studio-gap" aria-label="Deliveries due">
            {deliveries}
          </aside>
        </div>
      ) : null}

      {tiles}

      <div className="ui-app-cols">
        <div className="ui-app-stack ui-studio-gap">{runs}</div>
        <aside className="ui-app-stack ui-studio-gap" aria-label={m.needs ? "The team" : "Deliveries and the team"}>
          {!m.needs && deliveries}
          {team}
          {m.help}
        </aside>
      </div>
    </>
  );
}

/** One brand or client as a compact tile (DLAY-7): the whole tile opens it. */
function BrandTile({ tile }: { tile: TileModel }) {
  const { workspace, current } = tile;
  const pct = current ? Math.round(current.progress * 100) : 0;
  return (
    <li>
      <Link className="ui-card ui-agency-tile" to={tile.to} aria-label={`Open ${workspace.brandName}: ${tile.status}`}>
        <ClientMark workspace={workspace} />
        <span className="ui-agency-tile-body">
          <span className="ui-agency-tile-head">
            <span className="ui-agency-tile-name">{workspace.brandName}</span>
            <WaitsDot count={tile.waiting} />
            {tile.at && <span className="ui-agency-data ui-agency-tile-at">{due(tile.at)}</span>}
          </span>
          <span className="ui-agency-tile-status">{tile.status}</span>
          {current && <Progress className="ui-agency-tile-bar" value={pct} aria-label={`${current.name}: ${current.detail}`} />}
        </span>
      </Link>
    </li>
  );
}

/** One thing that needs you: the picture, what and where, and one pill naming where it goes. */
function NeedRow({ need }: { need: NeedModel }) {
  // A phone keeps the chevron: the pill would squeeze the title into a column of single words (as the customer's Home).
  const phone = useNarrowScreen("(max-width: 767px)");
  return (
    <Item as="li" variant="muted" asChild>
      <Link to={need.to} className="ui-agency-need">
        {need.picture ? (
          <ItemMedia variant="image">
            <ItemMediaImage src={need.picture} alt="" />
          </ItemMedia>
        ) : (
          <ItemMedia variant="icon">
            <Icon name={needIcon[need.kind]} />
          </ItemMedia>
        )}
        <ItemContent>
          <ItemTitle>{need.title}</ItemTitle>
          <ItemDescription>{need.detail}</ItemDescription>
        </ItemContent>
        <ItemActions>
          {phone ? (
            <Icon name="chevron-right" />
          ) : (
            <Button asChild variant="secondary" size="sm">
              <span>{need.action}</span>
            </Button>
          )}
        </ItemActions>
      </Link>
    </Item>
  );
}

/** The people this week: who, their role and brands, how full the week is ("1.5 of 4"), and what they do now. */
function TeamWeek({ team }: { team: TeamModel[] }) {
  if (!team.length) return <Nothing icon="users" title="No one on the team yet" />;
  return (
    <ul className="ui-agency-team">
      {team.map((t) => (
        <li key={t.user.id} className="ui-agency-team-row">
          <Avatar size="sm" src={t.user.avatar} initials={initials(t.user.name)} ink={t.lead} aria-hidden="true" />
          <span className="ui-agency-team-text">
            <span className="ui-agency-team-head">
              <span className="ui-agency-team-name">
                {t.name}
                <small>{t.small}</small>
              </span>
              {t.load && (
                <span className="ui-agency-data" title={t.load.label}>
                  {t.load.number}
                </span>
              )}
            </span>
            {t.load && <Progress className="ui-agency-load" value={t.load.value} max={t.load.max} aria-label={t.load.label} />}
            {t.week && <span className="ui-agency-team-week">{t.week}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
