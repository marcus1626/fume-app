// Every campaign, calmer (FLOWS §13): two groups, Under way (the ones that wait on you first) and Done (approved,
// delivered, closed). Home is the one inbox, so Campaigns has no "Waiting on you" group of its own; each row still says
// what waits or where it is, and when it goes live. The two ways to start a campaign sit in the header: with Fume in
// the conversation, or a brief written by hand (FLOWS §12).
// The same campaigns show as a list or on the calendar, chosen with one control: "List | Month | Week" on a desk, "List
// | Calendar" on a phone, where the calendar is always its agenda (?show=calendar and the calendar's own ?view and ?d).
// Every delivery is one quiet link away; a campaign's own delivery is its last stage. On a desk each group is a table
// she can scan and sort by Goes live or Stage: the cover, the campaign and its one status sentence
// (copy.campaignStatus), the stage as dots and a word, who it waits on, when it goes live, and how many creatives are
// approved of those made. The whole row is the link. The phone keeps the rows.
// The client of an agency reads each campaign as the client (useStatusOptions: "4 creatives to approve", "Brygga Studio
// is planning"), "Waiting on" names the agency where it says Fume, and she has no New campaign (the agency starts
// them).
import {
  Button,
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
  SegmentedControl,
  SegmentedOption,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableTitle,
  useNarrowScreen,
  useTableSort,
  type TableSort,
} from "@fume/ui";
import { Link, useSearchParams } from "react-router-dom";
import { useCampaigns, useSession, useTeam } from "../../api/hooks";
import type { Campaign } from "../../contract";
import * as copy from "../../copy";
import { date, due } from "../../lib/time";
import { Nothing, Page, Query, Section } from "../../shell/Page";
import { CalendarView } from "../calendar/CalendarPage";
import { useStatusOptions } from "../agency/clientFlow";
import { campaignGroup, rights, StartCampaign, StepDots, stepOf } from "./parts";

type Show = "list" | "calendar";
/** The one control's value: the list, or the calendar as a month or a week (a desk) or its agenda (a phone). */
type Look = "list" | "month" | "week" | "calendar";
type SortKey = "live" | "stage";

const groups = [
  { key: "under-way", title: "Under way" },
  { key: "done", title: "Done" },
] as const;

/** The go-live, as a row says it: "Sat 17 Oct" ahead, "17 Oct" once it is past. */
function liveDay(c: Campaign): string | undefined {
  if (!c.dueAt) return undefined;
  return c.state === "delivered" || c.state === "closed" ? date(c.dueAt) : due(c.dueAt);
}

/** One line under a campaign's name on a phone: its one status sentence, then when it goes live. */
function line(c: Campaign, options?: copy.CampaignStatusOptions): string {
  const live = copy.campaignLive(c);
  return [copy.campaignStatus(c, undefined, options).words, live].filter(Boolean).join(" · ");
}

/** The default order: what waits on you first, then the soonest go-live. */
function byDefault(rows: Campaign[], options?: copy.CampaignStatusOptions): Campaign[] {
  const live = (c: Campaign) => (c.dueAt ? Date.parse(c.dueAt) : Number.POSITIVE_INFINITY);
  return rows
    .slice()
    .sort(
      (a, b) =>
        Number(campaignGroup(b, options) === "you") - Number(campaignGroup(a, options) === "you") || live(a) - live(b),
    );
}

export function CampaignsPage() {
  const session = useSession().data!;
  const campaigns = useCampaigns();
  const client = useStatusOptions()?.viewer === "client";
  const can = { ...rights(session.role), start: rights(session.role).start && !client };
  const [params, setParams] = useSearchParams();
  const phone = useNarrowScreen("(max-width: 767px)");
  const desk = !useNarrowScreen("(max-width: 1023px)");
  const show: Show = params.get("show") === "calendar" ? "calendar" : "list";
  const look: Look = show === "list" ? "list" : phone ? "calendar" : params.get("view") === "week" ? "week" : "month";
  // The list has no use for the calendar's place; the calendar keeps its day.
  const choose = (next: Look) => {
    if (next === "list") return setParams({}, { replace: true });
    const out = new URLSearchParams(params);
    out.set("show", "calendar");
    if (next === "week") out.set("view", "week");
    else out.delete("view");
    setParams(out, { replace: true });
  };

  return (
    <Page
      title={show === "calendar" ? "Calendar · Campaigns" : "Campaigns"}
      className={show === "calendar" ? "ui-plan-page" : undefined}
    >
      <PageHeader
        title="Campaigns"
        meta={campaigns.data ? [copy.count(campaigns.data.length, "campaign")] : undefined}
        actions={can.start ? <StartCampaign /> : undefined}
        tabs={
          <div className="ui-app-row ui-app-row--between">
            <SegmentedControl aria-label="Show the campaigns as" value={look} onValueChange={(v) => choose(v as Look)}>
              <SegmentedOption value="list">List</SegmentedOption>
              {phone ? (
                <SegmentedOption value="calendar">Calendar</SegmentedOption>
              ) : (
                <>
                  <SegmentedOption value="month">Month</SegmentedOption>
                  <SegmentedOption value="week">Week</SegmentedOption>
                </>
              )}
            </SegmentedControl>
            <Button asChild variant="quiet" size="sm" icon="download">
              <Link to="/deliveries">All deliveries</Link>
            </Button>
          </div>
        }
      />

      {show === "calendar" ? (
        <CalendarView />
      ) : (
        <Query query={campaigns} loading="Loading your campaigns">
          {(all) =>
            all.length === 0 ? (
              <Nothing
                icon="megaphone"
                scene="start"
                title="No campaigns yet"
                text={
                  client
                    ? `${session.agencyName ?? "Your agency"} starts ${session.workspace.brandName}’s campaigns and sends you the creatives to approve.`
                    : "Tell Fume what you need and we ask a few questions, or write the brief yourself. Fume writes the plan from it, and nothing is made before you approve the plan."
                }
                action={
                  can.start ? (
                    <div className="ui-app-row">
                      <StartCampaign />
                    </div>
                  ) : undefined
                }
              />
            ) : (
              <CampaignGroups all={all} desk={desk} />
            )
          }
        </Query>
      )}
    </Page>
  );
}

/** Under way, then Done: a table on a desk (one sort for both), the rows on a phone. */
function CampaignGroups({ all, desk }: { all: Campaign[]; desk: boolean }) {
  const sort = useTableSort<SortKey>();
  const expert =
    useTeam()
      .data?.fumeTeam.find((u) => u.staffRole === "expert")
      ?.name.split(" ")[0] ?? "Fume’s expert";
  const options = useStatusOptions();
  return (
    <div className="ui-campaign-list">
      {groups.map((g) => {
        const rows = byDefault(
          all.filter((c) => (campaignGroup(c, options) === "done") === (g.key === "done")),
          options,
        );
        if (rows.length === 0) return null;
        return (
          <Section key={g.key} title={g.title} meta={rows.length} titleId={`campaigns-${g.key}`}>
            {desk ? (
              <CampaignTable
                rows={rows}
                sort={sort}
                expert={expert}
                labelledBy={`campaigns-${g.key}`}
                options={options}
              />
            ) : (
              <ItemGroup as="ul" aria-labelledby={`campaigns-${g.key}`}>
                {rows.map((c) => (
                  <Item key={c.id} as="li" asChild>
                    <Link to={`/campaigns/${c.id}`}>
                      <ItemMedia variant={c.cover ? "image" : "icon"}>
                        {c.cover ? <ItemMediaImage src={c.cover} alt="" /> : <Icon name="megaphone" />}
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle>{c.name}</ItemTitle>
                        <ItemDescription>{line(c, options)}</ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <Icon name="chevron-right" />
                      </ItemActions>
                    </Link>
                  </Item>
                ))}
              </ItemGroup>
            )}
          </Section>
        );
      })}
    </div>
  );
}

/** One group as a table. The campaign's name is the link, stretched over the row, so the whole row opens it (and a
 *  middle click opens it in a new tab). */
function CampaignTable({
  rows,
  sort,
  expert,
  labelledBy,
  options,
}: {
  rows: Campaign[];
  sort: TableSort<SortKey>;
  expert: string;
  labelledBy: string;
  options?: copy.CampaignStatusOptions;
}) {
  const shown = sort.key
    ? sort.sorted(rows, (c, key) =>
        key === "live"
          ? c.dueAt
            ? Date.parse(c.dueAt)
            : Number.MAX_SAFE_INTEGER
          : stepOf(c).step + (stepOf(c).done ? 1 : 0),
      )
    : rows;
  const waitingOn = (c: Campaign) => {
    const on = copy.campaignStatus(c, undefined, options).on;
    return on === "you"
      ? "You"
      : on === "fume"
        ? (options?.agencyName ?? "Fume")
        : on === "expert"
          ? expert
          : undefined;
  };
  return (
    <TableContainer>
      <Table className="ui-campaign-table" aria-labelledby={labelledBy}>
        <TableHeader>
          <TableRow>
            <TableHead className="ui-campaign-col-cover">
              <span className="ui-campaign-sr">Cover</span>
            </TableHead>
            <TableHead>Campaign</TableHead>
            <TableHead
              className="ui-campaign-col-stage"
              sort={sort.directionOf("stage")}
              onSort={() => sort.sortBy("stage")}
            >
              Stage
            </TableHead>
            <TableHead className="ui-campaign-col-who">Waiting on</TableHead>
            <TableHead
              className="ui-campaign-col-live"
              sort={sort.directionOf("live")}
              onSort={() => sort.sortBy("live")}
            >
              Goes live
            </TableHead>
            <TableHead className="ui-campaign-col-made" num>
              Approved
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.map((c) => {
            const who = waitingOn(c);
            const live = liveDay(c);
            return (
              <TableRow key={c.id} className="ui-campaign-row">
                <TableCell media>
                  {c.cover ? (
                    <img className="ui-campaign-cover" src={c.cover} alt="" />
                  ) : (
                    <span className="ui-campaign-cover" aria-hidden="true">
                      <Icon name="megaphone" />
                    </span>
                  )}
                </TableCell>
                <TableCell className="ui-campaign-cell-name">
                  <TableTitle sub={copy.campaignStatus(c, undefined, options).words}>
                    <Link className="ui-campaign-row-link" to={`/campaigns/${c.id}`}>
                      {c.name}
                    </Link>
                  </TableTitle>
                </TableCell>
                <TableCell>
                  <StepDots campaign={c} />
                </TableCell>
                <TableCell muted={!who}>{who ?? "—"}</TableCell>
                <TableCell data muted={!live}>
                  {live ?? (campaignGroup(c, options) === "done" ? "—" : "Not set")}
                </TableCell>
                <TableCell data num>
                  {c.counts.creatives > 0 ? `${c.counts.approved} of ${c.counts.creatives}` : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
