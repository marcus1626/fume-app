// Home is the one inbox (UX review 15 Oct, §2.4; round 8: LOAD-3, LOAD-7, MOB-16, TASK-11, TASK-15, ONB-8, WAY-3;
// round 9: DLOAD-4, DLOAD-14, DTSK-21, DTSK-16, DLAY-18, DLOAD-22, DLOAD-1, DLOAD-3, DLOAD-10, DWAY-5).
// "Waiting on you" holds at most five rows, one per subject, and each row opens the one place where that work is done,
// one item at a time: the review set, the product's card beside Home (?check=, when Fume's questions are all about one
// product) or the question sheet, the chat where a brief waits on an answer, the confirm queue, Brand › Confirm your
// brand, the delivery. The count shows once, beside the heading; the same number is the Home badge (shell/waiting.ts).
// Products nothing waits on are one quiet line, never a row. Below, one line per campaign being made that does not
// already wait on her, in the same row style, quieter; its words are the campaign's one status sentence. A workspace
// with no campaign yet (the first visit after onboarding) leads with one card and one Ink, "Tell Fume what you need";
// the header's New campaign steps aside while it shows. On a desk the aside: This month first, then one line on what
// Fume learned.
// Round 10 (FLOWS §22, PROPOSED 20 Oct 2026): a plan checked and ready is a row, "The plan for Winter gifting is ready",
// with the campaign's cover and one action, "Open the plan"; it opens the plan, where she approves it. A campaign
// whose plan is being written or checked is a line under Being made in the plan's words ("The plan is in check").
// Round 11 CLIENT FLOW (FLOWS §24.3, §24.5; PROPOSED 20 Oct 2026): Home in a client brand an agency runs.
// - The agency's people (Nora at "/" in LYSNE): what waits on the agency in this client (the plan to approve, a brief
//   to send, products and Brand finds to confirm, and the creatives to check, as one row that opens the client's
//   Check), then what waits on the client as one row, "6 creatives with Maja". Never "to approve" for the agency: the
//   mock leaves the checked creatives out of the agency's waits (r11-client.ts). The aside is this month in the
//   client, with the way to the licence.
// - The client's own people (Maja in Brygga Studio's world): only her creatives to approve and her deliveries; the
//   brief, the Brand DNA and the products are the agency's. Round 13 (Marcus's card): the plan, once the agency checked
//   it and sent it to her, is hers too. No New campaign (the agency starts them); the
//   aside says who makes the brand's creatives.
// Round 12 AGENCY (UX review DTASK-13, DLOAD-5, DLOAD-7, DLAY-20, DLOAD-4; brief r12 SENDING; PROPOSED 20 Oct 2026):
// - The agency in one client: what it checked and has not sent is its own row in Waiting on you, "2 creatives to send
//   to Maja", with a Send pill that opens Send to Maja on the review; "With the client" holds only what was sent ("4
//   creatives with Maja · Autumn launch · since 14 Oct"), so "with Maja" and "not sent" never meet. The aside is this
//   month's usage in the client, from the one Usage page's numbers ("Made for LYSNE", "Approved"), with the way to it.
// - The client: under her row, the creatives that wait on her as tiles with the one Ink "Review them" (DLAY-20); the
//   lines under Being made read the agency's work as a fact ("Brygga Studio is planning").
import {
  Button,
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  CreativeGrid,
  CreativeTile,
  Icon,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
  PageHeader,
  Progress,
  Stat,
  StatGrid,
  useNarrowScreen,
  type IconName,
} from "@fume/ui";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useBrandDna, useCampaigns, useCatalogue, useHome, usePeople, useQaQueue, useReviewQueue, useSession, useUsage } from "../../api/hooks";
import type { Campaign, HomeView, Id } from "../../contract";
import * as copy from "../../copy";
import { date, due } from "../../lib/time";
import { Nothing, Page, Query, Section } from "../../shell/Page";
import { firstName } from "../../shell/people";
import { useWaitingOnYou, type QuietProducts, type WaitingKind, type WaitingRow } from "../../shell/waiting";
import { useAgencyScope, useCampaignSends, useStatusOptions } from "../agency/clientFlow";
import { useCustomerNames } from "../review/names";
import { tileCaption } from "../review/parts";
import { rights, StartCampaign } from "../campaigns/parts";
import { useOpenProductCheck } from "../check/ProductCheckHost";
import { QuestionSheet } from "../questions/QuestionSheet";

const rowIcon: Record<WaitingKind, IconName> = {
  creatives: "eye",
  directions: "columns-2",
  plan: "file-text",
  brief: "file-text",
  question: "message-square",
  draft: "message-square",
  products: "tag",
  brand: "palette",
  download: "download",
};

function greeting(hour: number) {
  if (hour < 5 || hour >= 22) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** The row's pictures: one thumbnail, or a small stack of up to three (seven products, one row: MOB-16). */
function RowMedia({ row }: { row: WaitingRow }) {
  if (row.pictures.length === 0)
    return (
      <ItemMedia variant="icon">
        <Icon name={rowIcon[row.kind]} />
      </ItemMedia>
    );
  return (
    <ItemMedia className="ui-home-stack" data-count={row.pictures.length}>
      {row.pictures.map((src) => (
        <img key={src} src={src} alt="" loading="lazy" />
      ))}
    </ItemMedia>
  );
}

function RowWords({ row }: { row: WaitingRow }) {
  return (
    <ItemContent>
      <ItemTitle>
        {row.title}
        {row.dueAt && <span className="ui-home-due">live {due(row.dueAt)}</span>}
      </ItemTitle>
      <ItemDescription>{row.detail}</ItemDescription>
    </ItemContent>
  );
}

/** One row of the inbox. Fume's questions about one product open that product's card beside Home; questions about
 *  several open the question sheet; everything else goes where it is decided. */
function WaitingRowItem({ row, onAsk }: { row: WaitingRow; onAsk: (ids: Id[]) => void }) {
  const openCheck = useOpenProductCheck();
  // The plan's row names its one action (FLOWS §22.3): the whole row is the link, the pill only says where it goes.
  // A phone keeps the chevron: the pill would squeeze the title into a column of single words.
  const phone = useNarrowScreen("(max-width: 767px)");
  const end = (
    <ItemActions>
      {row.kind === "plan" && !phone ? (
        <Button asChild variant="secondary" size="sm">
          <span>Open the plan</span>
        </Button>
      ) : row.href.endsWith("?send=1") && !phone ? (
        <Button asChild variant="secondary" size="sm" icon="send">
          <span>Send</span>
        </Button>
      ) : (
        <Icon name="chevron-right" />
      )}
    </ItemActions>
  );
  if (row.productId || row.questionIds?.length)
    return (
      <Item as="li" variant="muted" asChild>
        <button type="button" onClick={() => (row.productId ? openCheck(row.productId) : onAsk(row.questionIds!))} aria-haspopup="dialog">
          <RowMedia row={row} />
          <RowWords row={row} />
          {end}
        </button>
      </Item>
    );
  return (
    <Item as="li" variant="muted" asChild>
      <Link to={row.href}>
        <RowMedia row={row} />
        <RowWords row={row} />
        {end}
      </Link>
    </Item>
  );
}

/** Products nothing waits on yet (DLOAD-14, DLOAD-4): one quiet line, never a row and never counted.
 *  Round 13 (robot note 05, PROPOSED 22 Oct 2026): the number is the one the page it opens says ("Confirm 7 products"),
 *  every product still to confirm; the ones a campaign above already asks about are said as part of it. */
function QuietLine({ quiet, first }: { quiet: QuietProducts; first?: boolean }) {
  const all = useCatalogue().data?.products.filter((p) => p.state === "needs_you").length ?? quiet.count;
  const total = Math.max(all, quiet.count);
  const above = total - quiet.count;
  const minutes = `about ${Math.max(1, Math.round(total / 2))} min`;
  return (
    <p className="ui-home-quiet">
      {first
        ? `Fume found ${copy.count(total, "product")}. `
        : above > 0
          ? `${copy.count(total, "product")} to confirm, ${above} of them for a campaign above. `
          : `${copy.count(total, "product")} to confirm, none holds up a campaign. `}
      Confirm {above > 0 ? (quiet.count === 1 ? "the other one when you first use it" : "the rest when you first use them") : total === 1 ? "it when you first use it" : "them when you first use them"}, or{" "}
      <Link className="ui-link" to={quiet.href}>
        {total === 1 ? "now" : "all now"} ({minutes})
      </Link>
      .
    </p>
  );
}

/** The first visit after onboarding (ONB-8): the Brand DNA is ready, so the one thing to do is the first campaign. */
function FirstCampaign({ quiet }: { quiet?: QuietProducts }) {
  return (
    <Card className="ui-home-first">
      <CardHeader>
        <CardTitle as="h2">Your Brand DNA is ready. Start your first campaign</CardTitle>
        <CardDescription>Say what you need in a sentence. Fume asks what is missing, then writes the brief with you.</CardDescription>
        {quiet && <QuietLine quiet={quiet} first />}
      </CardHeader>
      <CardFooter>
        <Button asChild icon="message-square">
          <Link to="/fume?new=1">Tell Fume what you need</Link>
        </Button>
        <Button asChild variant="secondary" icon="file-text">
          <Link to="/campaigns/new">Write the brief yourself</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

/** What a campaign being made is doing now, in its one status sentence (DLOAD-3: the same words as the Campaigns list,
 *  the campaign's header and the palette; the steps and pictures live on Campaigns). */
function makingLine({ campaign }: HomeView["inProduction"][number], options?: copy.CampaignStatusOptions): string {
  return copy.campaignStatus(campaign, undefined, options).words;
}

export function HomePage() {
  const scope = useAgencyScope();
  return scope === "agency" ? <AgencyHome /> : <CustomerHome client={scope === "client"} />;
}

/** The rows of "Being made": one line per campaign Fume works on, in its one status sentence. */
function MakingSection({ making }: { making: HomeView["inProduction"] }) {
  // The client of an agency reads the agency's work as a fact (round 12, DLOAD-4).
  const options = useStatusOptions();
  if (making.length === 0) return null;
  return (
    <Section
      title="Being made"
      titleId="home-making"
      action={
        <Button asChild variant="quiet" size="sm" iconEnd="arrow-right">
          <Link to="/campaigns">Campaigns</Link>
        </Button>
      }
    >
      {/* The same row as Waiting on you, without the fill: it is Fume's work, not hers. */}
      <ItemGroup as="ul" aria-labelledby="home-making" className="ui-home-making">
        {making.map((line) => (
          <Item key={line.campaign.id} as="li" asChild>
            <Link to={`/campaigns/${line.campaign.id}`}>
              <ItemMedia variant="icon">
                <Icon name="clock" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>
                  {line.campaign.name}
                  {line.campaign.dueAt && <span className="ui-home-due">live {due(line.campaign.dueAt)}</span>}
                </ItemTitle>
                <ItemDescription>{makingLine(line, options)}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Icon name="chevron-right" />
              </ItemActions>
            </Link>
          </Item>
        ))}
      </ItemGroup>
    </Section>
  );
}

/** One line on what Fume learned, under the month (DLAY-18, DLOAD-22). Round 13 (robot note 05): counted from the same
 *  lessons "All lessons" lists, so the two numbers always agree. */
function LearnedLine({ view }: { view: HomeView }) {
  const lessons = useBrandDna().data?.memory.length ?? view.learned.length;
  if (lessons === 0) return null;
  return (
    <p className="ui-home-learned">
      <span>Fume learned {lessons === 1 ? "one thing" : `${lessons} things`} from your campaigns</span>
      <span aria-hidden="true"> · </span>
      <Link className="ui-link" to="/brand/memory">
        All lessons
      </Link>
    </p>
  );
}

/** The kinds of row the client's own people see in a brand an agency runs: her approvals and her deliveries, and (round
 *  13, Marcus's card 23 Oct 2026) the plan once the agency checked it and sent it to her (the backend sends only those). */
const clientKinds: WaitingKind[] = ["plan", "creatives", "download"];

/** The customer's Home; `client`: one of the client's own people in a brand an agency runs (round 11). */
function CustomerHome({ client }: { client: boolean }) {
  const session = useSession().data!;
  const home = useHome();
  const all = useWaitingOnYou();
  const can = rights(session.role);
  const [asking, setAsking] = useState<Id[] | null>(null);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/Oslo" }).format(Date.now()));
  // In a brand an agency runs, the brief, the Brand DNA and the products are the agency's (round 11); the plan is hers
  // once the agency sent it (round 13).
  const items = client ? all.items.filter((row) => clientKinds.includes(row.kind)) : all.items;
  const waiting = { ...all, items, count: items.length, quiet: client ? undefined : all.quiet, campaignIds: items.map((r) => r.campaignId).filter((c): c is Id => Boolean(c)) };
  // The first visit: the card's "Tell Fume what you need" is the one Ink, so the header's New campaign steps aside.
  const welcome = waiting.firstRun && can.start && !client;
  const agencyName = session.agencyName ?? "Your agency";

  return (
    <Page title="Home">
      <PageHeader title={`${greeting(hour)}, ${firstName(session.user.name)}`} actions={welcome || client ? undefined : <StartCampaign />} />

      <Query query={home}>
        {(view) => {
          // A campaign already waiting on her is its row up there, not a second line here (DLOAD-4).
          const making = view.inProduction.filter((line) => !waiting.campaignIds.includes(line.campaign.id));
          return (
            <div className="ui-app-cols">
              <div className="ui-app-stack ui-home-main">
                {welcome && <FirstCampaign quiet={waiting.quiet} />}

                <Section
                  title="Waiting on you"
                  meta={waiting.count || undefined}
                  titleId="home-waiting"
                  text={waiting.count && !can.approve ? (can.ask ? "You can look and ask for changes. The approver approves." : "You can look. The approver decides.") : undefined}
                >
                  {waiting.count === 0 ? (
                    <Nothing
                      icon="circle-check"
                      title="Nothing waits on you"
                      text={client ? `${agencyName} tells you the moment creatives are ready for your approval.` : "Fume tells you the moment something is ready for your decision."}
                    />
                  ) : (
                    <ItemGroup as="ul" aria-labelledby="home-waiting">
                      {waiting.items.map((row) => (
                        <WaitingRowItem key={row.id} row={row} onAsk={setAsking} />
                      ))}
                    </ItemGroup>
                  )}
                  {client && <ClientWaiting />}
                  {!welcome && waiting.quiet && <QuietLine quiet={waiting.quiet} />}
                </Section>

                <MakingSection making={making} />
              </div>

              {/* Desk only (LOAD-7): on a phone Home is the inbox; what Fume learned lives in Brand, the month in Settings.
                  This month first, it is short and factual; then one line on what Fume learned (DLAY-18, DLOAD-22).
                  The client of an agency: who makes the brand's creatives, in one line (round 11). */}
              <aside className="ui-app-stack ui-home-aside" aria-label="About your workspace">
                {client ? (
                  <Section title={agencyName} titleId="home-agency" text={`${agencyName} makes ${session.workspace.brandName}’s creatives with Fume and sends you what is ready to approve.`} />
                ) : (
                  <>
                    <Section title="This month" titleId="home-usage">
                      <StatGrid>
                        <Stat label="Creatives used" value={[{ num: view.usage.creativesUsed, unit: `of ${view.usage.creativeCap}` }]} />
                        <Stat label="Campaigns active" value={view.usage.campaignsActive} />
                      </StatGrid>
                      <Progress value={view.usage.creativesUsed} max={view.usage.creativeCap} aria-label={`${view.usage.creativesUsed} of ${view.usage.creativeCap} creatives used`} />
                      {view.usage.periodEndsAt && <p className="ui-app-section-text">The package renews {date(view.usage.periodEndsAt)}.</p>}
                    </Section>
                    <LearnedLine view={view} />
                  </>
                )}
              </aside>
            </div>
          );
        }}
      </Query>

      <QuestionSheet ids={asking ?? undefined} open={asking !== null} onOpenChange={(o) => !o && setAsking(null)} />
    </Page>
  );
}

// ─── The agency in one client (round 11) ────────────────────────────────────

/** The soonest go-live first, then rows without a date, as the inbox orders them (shell/waiting.ts). */
const byGoLive = (a: WaitingRow, b: WaitingRow) => (a.dueAt && b.dueAt ? a.dueAt.localeCompare(b.dueAt) : a.dueAt ? -1 : b.dueAt ? 1 : 0);

/** Home for the agency's people in one client: what waits on the agency here, and what is with the client. */
function AgencyHome() {
  const session = useSession().data!;
  const home = useHome();
  const waiting = useWaitingOnYou();
  const qa = useQaQueue(session.workspace.id);
  const campaigns = useCampaigns();
  const people = usePeople();
  const [asking, setAsking] = useState<Id[] | null>(null);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/Oslo" }).format(Date.now()));
  const brand = session.workspace.brandName;
  const nameOf = (id?: Id) => firstName(people.data?.find((u) => u.id === id)?.name ?? "the client");

  // The creatives the agency checks (the client's Check), as one row.
  const toCheck = (qa.data ?? []).filter((q) => q.item.state === "waiting" && q.item.workspaceId === session.workspace.id);
  const checkCampaigns = [...new Map(toCheck.map((q) => [q.campaign.id, q.campaign])).values()];
  const checkRow: WaitingRow | undefined = toCheck.length
    ? {
        id: "row-check",
        kind: "creatives",
        title: checkCampaigns.length === 1 ? checkCampaigns[0]!.name : brand,
        detail: `${copy.creatives(toCheck.length)} to check`,
        dueAt: checkCampaigns.map((c) => c.dueAt).filter((d): d is string => Boolean(d)).sort()[0],
        href: `/studio/b/${session.workspace.id}/qa`,
        pictures: toCheck.slice(0, 3).map((q) => q.item.image),
        count: toCheck.length,
      }
    : undefined;
  // What the agency checked and has not sent (round 12, DTASK-13): its own row, opening Send to Maja on the review.
  const list = campaigns.data ?? [];
  const toSendOf = (c: Campaign) => Math.min(c.counts.checked, c.waits?.toSend ?? 0);
  const sendRows: WaitingRow[] = list
    .filter((c) => toSendOf(c) > 0)
    .map((c) => ({
      id: `row-send-${c.id}`,
      kind: "creatives",
      title: c.name,
      detail: `${copy.creatives(toSendOf(c))} to send to ${nameOf(c.approverId)}`,
      dueAt: c.dueAt,
      href: `/campaigns/${c.id}/review?send=1`,
      campaignId: c.id,
      pictures: [],
      count: toSendOf(c),
    }));
  const rows = [...waiting.items, ...(checkRow ? [checkRow] : []), ...sendRows].sort(byGoLive);

  // What is with the client: only what the agency sent; it waits on whoever approves each campaign (the mock leaves
  // the checked creatives out of the agency's own waits, so they are never "to approve" here).
  const withClient = list.filter((c) => c.counts.checked - toSendOf(c) > 0 && c.state !== "in_production");
  const busy = new Set([...waiting.campaignIds, ...checkCampaigns.map((c) => c.id), ...sendRows.map((r) => r.campaignId!), ...withClient.map((c) => c.id)]);

  return (
    <Page title="Home">
      <PageHeader title={`${greeting(hour)}, ${firstName(session.user.name)}`} meta={[brand]} actions={<StartCampaign />} />

      <Query query={home}>
        {(view) => {
          const making = view.inProduction.filter((line) => !busy.has(line.campaign.id));
          return (
            <div className="ui-app-cols">
              <div className="ui-app-stack ui-home-main">
                <Section title="Waiting on you" meta={rows.length || undefined} titleId="home-waiting">
                  {rows.length === 0 ? (
                    <Nothing icon="circle-check" title={`Nothing in ${brand} waits on you`} text="Fume tells you when a plan is ready, and the Engine’s creatives come to your Check." />
                  ) : (
                    <ItemGroup as="ul" aria-labelledby="home-waiting">
                      {rows.map((row) => (row.href.endsWith("?send=1") ? <SendRowItem key={row.id} row={row} /> : <WaitingRowItem key={row.id} row={row} onAsk={setAsking} />))}
                    </ItemGroup>
                  )}
                  {waiting.quiet && <QuietLine quiet={waiting.quiet} />}
                </Section>

                {withClient.length > 0 && (
                  <Section title="With the client" titleId="home-client">
                    <ItemGroup as="ul" aria-labelledby="home-client" className="ui-home-making">
                      {withClient.map((c) => (
                        <WithClientRow key={c.id} campaign={c} n={c.counts.checked - toSendOf(c)} client={nameOf(c.approverId)} />
                      ))}
                    </ItemGroup>
                  </Section>
                )}

                <MakingSection making={making} />
              </div>

              <aside className="ui-app-stack ui-home-aside" aria-label={`About ${brand}`}>
                <ClientMonth brand={brand} workspaceId={session.workspace.id} lead={session.agency?.role === "lead"} active={view.usage.campaignsActive} />
                <LearnedLine view={view} />
              </aside>
            </div>
          );
        }}
      </Query>

      <QuestionSheet ids={asking ?? undefined} open={asking !== null} onOpenChange={(o) => !o && setAsking(null)} />
    </Page>
  );
}

/** The agency's row for what it checked and has not sent (round 12, DTASK-13): the pictures are the unsent ones. */
function SendRowItem({ row }: { row: WaitingRow }) {
  const queue = useReviewQueue();
  const { sendOf } = useCampaignSends(row.campaignId, true);
  const checked = (queue.data ?? []).find((i) => i.campaign.id === row.campaignId && i.kind === "creatives");
  const pictures = (checked?.kind === "creatives" ? checked.creatives : [])
    .filter((c) => !sendOf(c.current.id))
    .slice(0, 3)
    .map((c) => c.current.image);
  return <WaitingRowItem row={{ ...row, pictures }} onAsk={() => undefined} />;
}

/** What the agency sent and the client has not answered yet: "4 creatives with Maja · Autumn launch · since 14 Oct". */
function WithClientRow({ campaign: c, n, client }: { campaign: Campaign; n: number; client: string }) {
  const { sends } = useCampaignSends(c.id, true);
  const sent = sends[0];
  return (
    <Item as="li" asChild>
      <Link to={`/campaigns/${c.id}/review`}>
        <ItemMedia variant="icon">
          <Icon name="send" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>
            {copy.creatives(n)} with {client}
          </ItemTitle>
          <ItemDescription>{[c.name, ...(sent ? [`since ${date(sent.sentAt)}`] : []), ...(sent?.link ? [`client link until ${date(sent.link.expiresAt)}`] : [])].join(" · ")}</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Icon name="chevron-right" />
        </ItemActions>
      </Link>
    </Item>
  );
}

/** This month in one client, from the one Usage page's numbers (round 12, DLOAD-7, DTASK-6): made, and approved by the
 *  client; the lead has the way to Usage. */
function ClientMonth({ brand, workspaceId, lead, active }: { brand: string; workspaceId: Id; lead: boolean; active: number }) {
  const usage = useUsage();
  const month = usage.data?.find((r) => r.workspaceId === workspaceId)?.periods?.month;
  return (
    <Section
      title="This month"
      titleId="home-usage"
      text={month ? `From ${date(month.from)} to ${date(month.to)}.` : undefined}
      action={
        lead ? (
          <Button asChild variant="quiet" size="sm" iconEnd="arrow-right">
            <Link to="/agency/usage">Usage</Link>
          </Button>
        ) : undefined
      }
    >
      <StatGrid>
        <Stat label={`Made for ${brand}`} value={month?.creatives ?? "–"} />
        <Stat label="Approved" value={month?.approved ?? "–"} />
        <Stat label="Campaigns active" value={active} />
      </StatGrid>
    </Section>
  );
}

/** The client's creatives that wait on her, right on Home (round 12, DLAY-20): the one Ink, "Review them", under her
 *  row, then the tiles of the first campaign that waits, under their one name; a tile opens it in the review. */
function ClientWaiting() {
  const navigate = useNavigate();
  const queue = useReviewQueue();
  const item = (queue.data ?? []).find((i) => i.kind === "creatives");
  const named = useCustomerNames(item?.campaign);
  if (item?.kind !== "creatives" || item.creatives.length === 0) return null;
  const review = `/campaigns/${item.campaign.id}/review`;
  return (
    <div className="ui-app-stack">
      <div className="ui-app-row">
        <Button asChild iconEnd="arrow-right">
          <Link to={review}>Review them</Link>
        </Button>
      </div>
      <CreativeGrid aria-label={`${item.campaign.name}: the creatives that wait on you`}>
        {item.creatives.slice(0, 8).map(named).map((c) => (
          <CreativeTile key={c.id} src={c.current.image} alt={c.title} format={c.format} label={c.title} caption={tileCaption(c)} onOpen={() => navigate(`${review}?c=${c.id}`)} />
        ))}
      </CreativeGrid>
    </div>
  );
}
