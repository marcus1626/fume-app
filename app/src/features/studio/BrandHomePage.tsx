// One brand's Home, or one client's (FLOWS §4.2, §24.3): /studio/b/:workspaceId for Fume's people,
// /agency/b/:workspaceId for an agency's, one Home for both frames. The h1 is the brand: its mark and its name, and one
// sentence of where it stands ("1 plan and 3 creatives to check; 6 creatives with Maja."), so three clients in three
// browser tabs never read alike. The work comes first: what needs you here (a plan to check or approve, creatives to
// send, Fume's questions, a brief), then what waits for a check, each row opening that creative in Check (/qa?item=),
// beside the campaigns, each row opening the campaign (Fume's people: its plan), and this month's numbers. Then what
// the Engine made as one row of six, with the way to Engine output. The Studio and the boards are the sidebar's. Fume's
// admin follows the brand: its usage and its campaigns.
import {
  Badge,
  Button,
  CreativeGrid,
  Icon,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemMediaImage,
  ItemTitle,
  PageHeader,
  Stat,
  StatGrid,
  useNarrowScreen,
  type IconName,
} from "@fume/ui";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAgencyHome, useAllBrands, useBrandWorkspace, useQaQueue, useSession, useUsage } from "../../api/hooks";
import type { BrandWorkspaceView, Id, QaView } from "../../contract";
import * as copy from "../../copy";
import { Nothing, Page, Query, Section } from "../../shell/Page";
import { firstName, initials } from "../../shell/people";
import {
  brandBase,
  campaignHref,
  checkPath,
  frameRoot,
  hrefIn,
  useFrameKind,
  type StaffFrameKind,
} from "../../shell/scope";
import { useWaitingOnYou, type QuietProducts } from "../../shell/waiting";
import { useOpenProductCheck } from "../check/ProductCheckHost";
import { QuestionSheet } from "../questions/QuestionSheet";
import { headline, withCustomers } from "./OverviewPage";
import { ClockBadge } from "./parts";
import { periodSpan } from "./UsagePage";
import { bestFirst, CandidateTile, distinctOutput, useOpenInStudio } from "./shared";

/** One thing that needs you here: where it goes, or what it opens beside the page. */
interface Ask {
  id: string;
  /** What it asks: "plan", "send", "question" … (the sentence under the name counts the plans). */
  kind: string;
  title: string;
  detail: string;
  /** The pill: "Check the plan", "Send to Maja". */
  action?: string;
  picture?: string;
  icon: IconName;
  to?: string;
  productId?: Id;
  questionIds?: Id[];
}

const askIcon: Record<string, IconName> = {
  plan: "file-text",
  brief: "file-text",
  question: "message-square",
  products: "tag",
  brand: "palette",
  directions: "columns-2",
  download: "download",
  check: "send",
  client_changes: "message-square",
};

/** A row that goes to Check is not an ask here: the creatives are listed under "Waits for a check". */
const toCheck = (href: string) => /\/(qa|check)(\?|$)/.test(href);

/** What needs you in this brand or client, in the frame's words and addresses; for an agency, also the quiet line of
 *  products nothing waits on. */
function useAsks(
  frame: StaffFrameKind,
  workspaceId: Id,
  v: BrandWorkspaceView | undefined,
): { asks: Ask[]; quiet?: QuietProducts } {
  const all = useAllBrands();
  const home = useAgencyHome(frame === "agency");
  const waiting = useWaitingOnYou();
  const base = brandBase(frame, workspaceId);
  // Checked creatives the customer has not been sent (Fume's step: "Send to Maja", on the campaigns page)
  const sends: Ask[] =
    frame === "fume"
      ? (v?.campaigns ?? []).flatMap(({ campaign: c, approver }) => {
          const n = Math.min(c.counts.checked, c.waits?.toSend ?? (c.state === "in_production" ? c.counts.checked : 0));
          if (!n || c.state === "approved" || c.state === "delivered" || c.state === "closed") return [];
          const who = approver ? firstName(approver.name) : "the customer";
          return [
            {
              id: `send-${c.id}`,
              kind: "send",
              title: c.name,
              detail: `${copy.creatives(n)} to send to ${who}`,
              action: copy.send.action(who),
              picture: c.cover,
              icon: "send",
              to: `${base}/campaigns`,
            },
          ];
        })
      : [];
  if (frame === "fume")
    return {
      asks: [
        ...(all.data?.needsYou ?? [])
          .filter((n) => n.clientId === workspaceId && !toCheck(n.href))
          .map((n) => ({
            id: n.id,
            kind: n.kind,
            title: n.title.split(" · ").slice(1).join(" · ") || n.title,
            detail: n.detail,
            action: n.action,
            picture: n.picture,
            icon: askIcon[n.kind] ?? "file-text",
            to: hrefIn(frame, workspaceId, n.href),
          })),
        ...sends,
      ],
    };
  // An agency: what waits on it in this client (the session is on it), and what it has checked and not sent
  const rows: Ask[] = waiting.items.map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    detail: row.detail,
    action: row.kind === "plan" ? "Open the plan" : undefined,
    picture: row.pictures[0],
    icon: askIcon[row.kind] ?? "circle",
    to: hrefIn(frame, workspaceId, row.href),
    productId: row.productId,
    questionIds: row.questionIds,
  }));
  const agencySends: Ask[] = (home.data?.needsYou ?? [])
    .filter((n) => n.clientId === workspaceId && n.kind === "check" && !toCheck(n.href))
    .map((n) => ({
      id: n.id,
      kind: "send",
      title: n.title.split(" · ").slice(1).join(" · ") || n.title,
      detail: n.detail,
      action: n.action,
      picture: n.picture,
      icon: "send",
      to: hrefIn(frame, workspaceId, n.href),
    }));
  return {
    asks: [...rows, ...agencySends],
    quiet: waiting.quiet && { ...waiting.quiet, href: hrefIn(frame, workspaceId, waiting.quiet.href) },
  };
}

/** "7 products to confirm, none holds up a campaign. Confirm them when you first use them, or now (about 6 min)." */
function QuietLine({ quiet }: { quiet: QuietProducts }) {
  return (
    <p className="ui-home-quiet">
      {copy.count(quiet.count, quiet.more ? "more product" : "product", quiet.more ? "more products" : "products")} to
      confirm, none holds up a campaign. Confirm{" "}
      {quiet.count === 1 ? "it when you first use it" : "them when you first use them"}, or{" "}
      <Link className="ui-link" to={quiet.href}>
        now ({quiet.minutes})
      </Link>
      .
    </p>
  );
}

export function BrandHomePage() {
  const { workspaceId = "" } = useParams();
  const frame = useFrameKind();
  const session = useSession().data;
  const navigate = useNavigate();
  const view = useBrandWorkspace(workspaceId);
  const qa = useQaQueue(workspaceId);
  const usage = useUsage().data?.find((u) => (u.workspace?.id ?? u.workspaceId) === workspaceId);
  const v = view.data;
  const base = brandBase(frame, workspaceId);
  // Fume's admin follows the brand (deliveries, usage, campaigns); Check, the Studio and the Engine are not theirs (FLOWS §20).
  const admin = frame === "fume" && session?.user.staffRole === "admin";
  const { asks, quiet } = useAsks(frame, workspaceId, v);
  const checks = (qa.data ?? []).filter((x) => x.item.state === "waiting" && x.item.workspaceId === workspaceId);
  const [asking, setAsking] = useState<Id[] | null>(null);
  const name = v?.workspace.brandName ?? session?.workspaces.find((w) => w.id === workspaceId)?.brandName ?? "";

  const sent = withCustomers(v?.campaigns ?? [], frame);
  const sentence = v
    ? headline({
        plans: asks.filter((a) => a.kind === "plan").length,
        checks: checks.length,
        toSend: sent.toSend,
        withThem: sent.withThem,
        frame,
        follows: admin,
      })
    : undefined;

  return (
    <Page title="Home">
      <PageHeader
        title={
          <span className="ui-agency-notice-name">
            <span className="ui-agency-mark ui-agency-mark--lg" aria-hidden="true">
              {initials(name || "?")}
            </span>
            {name || "Home"}
          </span>
        }
        description={sentence}
        meta={v ? [`${v.workspace.market} · ${v.workspace.language}`] : undefined}
        primaryAction={
          admin
            ? undefined
            : frame === "agency"
              ? { label: "New campaign", icon: "plus", onSelect: () => navigate(`${base}/campaigns/new`) }
              : { label: "Open the Studio", icon: "layers", onSelect: () => navigate(`${base}/studio`) }
        }
        actions={
          admin ? undefined : (
            <Button asChild variant="secondary" icon="fume-engine">
              <Link to={`${base}/engine`} aria-label="Tell the Engine">
                <span className="ui-page-header-label">Tell the Engine</span>
              </Link>
            </Button>
          )
        }
      />

      <Query query={view} loading={`Opening ${name || "the brand"}`}>
        {(v) => (
          <>
            <div className="ui-app-cols">
              <div className="ui-app-stack ui-studio-gap">
                {admin ? (
                  <CampaignsSection v={v} frame={frame} base={base} admin />
                ) : (
                  <>
                    {asks.length > 0 && (
                      <Section title="Needs you" meta={asks.length} titleId="brand-needs">
                        <ItemGroup as="ul" aria-labelledby="brand-needs">
                          {asks.map((a) => (
                            <AskRow key={a.id} ask={a} onAsk={setAsking} />
                          ))}
                        </ItemGroup>
                        {quiet && <QuietLine quiet={quiet} />}
                      </Section>
                    )}
                    <CheckSection checks={checks} frame={frame} workspaceId={workspaceId} loading={qa.isPending} />
                  </>
                )}
              </div>

              <aside className="ui-app-stack ui-studio-gap" aria-label={`About ${v.workspace.brandName}`}>
                {!admin && <CampaignsSection v={v} frame={frame} base={base} />}
                {/* Every number names its period and says what it counts: this month with its dates, as Usage writes
                    them; a row without periods carries the last eight weeks. */}
                <Section
                  title={usage?.periods ? "This month" : "The last 8 weeks"}
                  titleId="brand-usage"
                  text={usage?.periods ? periodSpan(usage.periods.month) : undefined}
                  action={
                    <Button asChild variant="quiet" size="sm" iconEnd="arrow-right">
                      <Link to={`${frameRoot[frame]}/usage`}>Usage</Link>
                    </Button>
                  }
                >
                  {usage ? (
                    <StatGrid>
                      {admin && (
                        <Stat
                          label="Images the Engine made"
                          value={usage.periods?.month.renders ?? usage.renders}
                          spark={{ title: "Images per week, last 8 weeks", data: usage.trend }}
                        />
                      )}
                      {admin && (
                        <Stat
                          label="Cost of the images"
                          value={`$${(usage.periods?.month.cost ?? usage.cost).toFixed(2)}`}
                        />
                      )}
                      <Stat label="Creatives made" value={usage.periods?.month.creatives ?? usage.creatives} />
                      {usage.periods && <Stat label="Creatives approved" value={usage.periods.month.approved} />}
                      <Stat label="Creatives delivered" value={usage.periods?.month.delivered ?? usage.delivered} />
                    </StatGrid>
                  ) : (
                    <p className="ui-app-section-text">Nothing made for {v.workspace.brandName} yet.</p>
                  )}
                </Section>
              </aside>
            </div>

            {!admin && <MadeSection v={v} base={base} workspaceId={workspaceId} />}
          </>
        )}
      </Query>

      <QuestionSheet ids={asking ?? undefined} open={asking !== null} onOpenChange={(o) => !o && setAsking(null)} />
    </Page>
  );
}

/** One ask: the whole row is the link (or opens the product's card or Fume's questions beside the page). */
function AskRow({ ask, onAsk }: { ask: Ask; onAsk: (ids: Id[]) => void }) {
  const openCheck = useOpenProductCheck();
  const phone = useNarrowScreen("(max-width: 767px)");
  const inner = (
    <>
      {ask.picture ? (
        <ItemMedia variant="image">
          <ItemMediaImage src={ask.picture} alt="" />
        </ItemMedia>
      ) : (
        <ItemMedia variant="icon">
          <Icon name={ask.icon} />
        </ItemMedia>
      )}
      <ItemContent>
        <ItemTitle>{ask.title}</ItemTitle>
        <ItemDescription>{ask.detail}</ItemDescription>
      </ItemContent>
      <ItemActions>
        {ask.action && !phone ? (
          <Button asChild variant="secondary" size="sm">
            <span>{ask.action}</span>
          </Button>
        ) : (
          <Icon name="chevron-right" />
        )}
      </ItemActions>
    </>
  );
  if (ask.productId || ask.questionIds?.length)
    return (
      <Item as="li" variant="muted" asChild>
        <button
          type="button"
          className="ui-agency-need"
          onClick={() => (ask.productId ? openCheck(ask.productId) : onAsk(ask.questionIds!))}
          aria-haspopup="dialog"
        >
          {inner}
        </button>
      </Item>
    );
  return (
    <Item as="li" variant="muted" asChild>
      <Link to={ask.to ?? "#"} className="ui-agency-need">
        {inner}
      </Link>
    </Item>
  );
}

/** The creatives that wait for a check here, each opening in Check. */
function CheckSection({
  checks,
  frame,
  workspaceId,
  loading,
}: {
  checks: QaView[];
  frame: StaffFrameKind;
  workspaceId: Id;
  loading: boolean;
}) {
  const to = checkPath(frame, workspaceId);
  return (
    <Section
      title="Waits for a check"
      meta={checks.length || undefined}
      titleId="brand-check"
      action={
        <Button asChild variant="quiet" size="sm" iconEnd="arrow-right">
          <Link to={to}>All checks</Link>
        </Button>
      }
    >
      {checks.length ? (
        <ItemGroup as="ul" aria-labelledby="brand-check">
          {checks.slice(0, 5).map((x) => {
            const f = copy.format[x.item.format];
            return (
              <Item key={x.item.id} as="li" variant="muted" asChild>
                <Link to={`${to}?item=${x.item.id}`}>
                  <ItemMedia variant="creative">
                    <ItemMediaImage src={x.item.image} alt="" />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>
                      {copy.creativeName({ title: x.item.title, format: x.item.format, productName: x.productName })}
                    </ItemTitle>
                    <ItemDescription>
                      {x.campaign.name} · {f.label} {f.ratio}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    {x.item.risk === "high" && <Badge variant="ink">High risk</Badge>}
                    <Icon name="chevron-right" />
                  </ItemActions>
                </Link>
              </Item>
            );
          })}
        </ItemGroup>
      ) : (
        <Nothing icon="circle-check" title={loading ? "Looking for creatives to check" : "Nothing waits for a check"} />
      )}
    </Section>
  );
}

/** The brand's campaigns, each opening the campaign, in the frame's one status sentence. */
function CampaignsSection({
  v,
  frame,
  base,
  admin,
}: {
  v: BrandWorkspaceView;
  frame: StaffFrameKind;
  base: string;
  admin?: boolean;
}) {
  return (
    <Section
      title="Campaigns"
      meta={v.campaigns.length || undefined}
      titleId="brand-campaigns"
      action={
        <Button asChild variant="quiet" size="sm" iconEnd="arrow-right">
          <Link to={`${base}/campaigns`}>All campaigns</Link>
        </Button>
      }
    >
      {v.campaigns.length ? (
        <ItemGroup as="ul" aria-labelledby="brand-campaigns">
          {v.campaigns.map(({ campaign, clock, approver }) => {
            // Fume's rows carry the clock's date as a badge, so the sentence leaves its own date out
            const status = copy.campaignStatus(campaign, undefined, {
              viewer: frame === "agency" ? "agency" : "staff",
              customerName: approver ? firstName(approver.name) : undefined,
              date: frame === "agency",
            });
            const content = (
              <>
                <ItemContent>
                  <ItemTitle>{campaign.name}</ItemTitle>
                  <ItemDescription>{status.words}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  {frame === "fume" ? <ClockBadge clock={clock} /> : <Icon name="chevron-right" />}
                </ItemActions>
              </>
            );
            // Fume's admin checks no plan: the row is the campaign's line, not a way in
            return admin ? (
              <Item key={campaign.id} as="li" variant="muted">
                {content}
              </Item>
            ) : (
              <Item key={campaign.id} as="li" variant="muted" asChild>
                <Link to={campaignHref(frame, v.workspace.id, campaign.id)}>{content}</Link>
              </Item>
            );
          })}
        </ItemGroup>
      ) : (
        <Nothing icon="megaphone" title="No campaigns yet" />
      )}
    </Section>
  );
}

/** What the Engine made since you last looked: one row of six, best first; any candidate opens in the Studio. */
function MadeSection({ v, base, workspaceId }: { v: BrandWorkspaceView; base: string; workspaceId: Id }) {
  const studio = useOpenInStudio(workspaceId);
  const made = distinctOutput(v.engineOutput).flatMap(({ campaign, generations }) =>
    generations.filter((g) => g.state !== "discarded").map((g) => ({ g, campaign })),
  );
  const shown = bestFirst(made.map((m) => m.g)).slice(0, 6);
  const campaignOf = new Map(made.map((m) => [m.g.id, m.campaign.id]));
  return (
    <Section
      title="What the Engine made"
      meta={made.length || undefined}
      titleId="brand-made"
      text="Best first. Open any candidate in the Studio to tweak it, repair it or pick it for its slot."
      action={
        <Button asChild variant="quiet" size="sm" iconEnd="arrow-right">
          <Link to={`${base}/output`}>Engine output</Link>
        </Button>
      }
    >
      {shown.length ? (
        <CreativeGrid className="ui-app-made" aria-labelledby="brand-made">
          {shown.map((g) => (
            <CandidateTile
              key={g.id}
              g={g}
              onOpen={() => studio.open({ campaignId: campaignOf.get(g.id), fromGenerationId: g.id })}
            />
          ))}
        </CreativeGrid>
      ) : (
        <Nothing
          icon="fume-engine"
          title="The Engine has made nothing new"
          text="Runs for this brand show here as they finish."
        />
      )}
    </Section>
  );
}
