// Deliveries across every brand (FLOWS §4.2). Round 12 (UX review DLAY-15, DLOAD-13, DLOAD-21, PROPOSED 20 Oct 2026):
// the records table of Campaigns, grouped Due and Sent (not by brand): the cover, the campaign and where it stands
// (the one status sentence, as Fume's people read it), the brand on the page for every brand, how much is approved
// ("2 of 11" with a bar, or "Planned: 9 creatives" before any is made, never "0 of 0") and the delivery date with
// its label: the plan's "Delivery", never the go-live under a bare "Due"; a sent row says "Delivered 26 Sep".
// Due is sorted by that date, soonest first. A row opens the campaign.
import {
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
  Progress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableTitle,
  useNarrowScreen,
} from "@fume/ui";
import { Link, useParams } from "react-router-dom";
import { useStudioCampaigns } from "../../api/hooks";
import type { StudioCampaignRow } from "../../contract";
import * as copy from "../../copy";
import { date, due } from "../../lib/time";
import { Nothing, Page, Query, Section } from "../../shell/Page";
import { firstName } from "../../shell/people";

const sentState = (r: StudioCampaignRow) => r.campaign.state === "delivered" || r.campaign.state === "closed";
const dateOf = (r: StudioCampaignRow) => copy.campaignDate(r.campaign, { delivery: true });
const at = (r: StudioCampaignRow) => Date.parse(dateOf(r)?.at ?? "") || Number.POSITIVE_INFINITY;

export function StudioDeliveriesPage() {
  const { workspaceId } = useParams();
  const all = useStudioCampaigns();
  const campaigns = { ...all, data: workspaceId ? all.data?.filter((r) => r.workspace.id === workspaceId) : all.data };
  const rows = campaigns.data ?? [];
  const dueRows = rows.filter((r) => !sentState(r) && dateOf(r)).sort((a, b) => at(a) - at(b));
  const sent = rows.filter(sentState).sort((a, b) => at(b) - at(a));

  return (
    <Page title="Deliveries">
      <PageHeader title="Deliveries" meta={campaigns.data ? [`${dueRows.length} due`, `${sent.length} sent`] : undefined} />

      <Query query={campaigns} loading="Loading the deliveries">
        {() => (
          <div className="ui-campaign-list">
            <Section title="Due" meta={dueRows.length || undefined} titleId="deliveries-due">
              {dueRows.length === 0 ? (
                <Nothing icon="download" title="Nothing due" text="A delivery shows here once a campaign has a date." />
              ) : (
                <Deliveries rows={dueRows} showBrand={!workspaceId} labelledBy="deliveries-due" />
              )}
            </Section>
            <Section title="Sent" meta={sent.length || undefined} titleId="deliveries-sent">
              {sent.length === 0 ? (
                <Nothing icon="send" title="Nothing sent yet" text="Sent deliveries stay here with their campaign." />
              ) : (
                <Deliveries rows={sent} showBrand={!workspaceId} labelledBy="deliveries-sent" />
              )}
            </Section>
          </div>
        )}
      </Query>
    </Page>
  );
}

const to = (r: StudioCampaignRow) => `/studio/b/${r.workspace.id}/campaigns/${r.campaign.id}/plan`;
// Round 13 AGENCY (robot note 10-agency): the frame's reader (StudioShell sets it), so an agency reads its own step
// ("Check the plan"), not Fume's staff's ("The plan waits on Maja")
const status = (r: StudioCampaignRow) =>
  copy.campaignStatus(r.campaign, undefined, { customerName: r.approver ? firstName(r.approver.name) : undefined, date: false }).words;
const dayOf = (r: StudioCampaignRow) => {
  const d = dateOf(r);
  if (!d) return undefined;
  return { label: d.label, day: d.label === copy.dateLabel.delivered || d.label === "Went live" ? date(d.at) : due(d.at) };
};

function Deliveries({ rows, showBrand, labelledBy }: { rows: StudioCampaignRow[]; showBrand: boolean; labelledBy: string }) {
  const desk = !useNarrowScreen("(max-width: 1023px)");
  if (!desk)
    return (
      <ItemGroup as="ul" aria-labelledby={labelledBy}>
        {rows.map((r) => {
          const d = dayOf(r);
          return (
            <Item key={r.campaign.id} as="li" asChild>
              <Link to={to(r)}>
                <ItemMedia variant={r.campaign.cover ? "image" : "icon"}>{r.campaign.cover ? <ItemMediaImage src={r.campaign.cover} alt="" /> : <Icon name="megaphone" />}</ItemMedia>
                <ItemContent>
                  <ItemTitle>
                    {r.campaign.name} {showBrand && <span className="ui-home-due">{r.workspace.brandName}</span>}
                  </ItemTitle>
                  <ItemDescription>{[approved(r), d ? `${d.label} ${d.day}` : undefined].filter(Boolean).join(" · ")}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Icon name="chevron-right" />
                </ItemActions>
              </Link>
            </Item>
          );
        })}
      </ItemGroup>
    );
  return (
    <TableContainer>
      <Table className="ui-campaign-table ui-records-table" aria-labelledby={labelledBy}>
        <TableHeader>
          <TableRow>
            <TableHead className="ui-campaign-col-cover">
              <span className="ui-campaign-sr">Cover</span>
            </TableHead>
            <TableHead>Campaign</TableHead>
            {showBrand && <TableHead className="ui-records-col-md">Brand</TableHead>}
            <TableHead className="ui-records-col-lg">Approved</TableHead>
            <TableHead className="ui-records-col-md">Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const d = dayOf(r);
            const { approved: n, creatives: total } = r.campaign.counts;
            return (
              <TableRow key={r.campaign.id} className="ui-campaign-row">
                <TableCell media>
                  {r.campaign.cover ? (
                    <img className="ui-campaign-cover" src={r.campaign.cover} alt="" />
                  ) : (
                    <span className="ui-campaign-cover" aria-hidden="true">
                      <Icon name="megaphone" />
                    </span>
                  )}
                </TableCell>
                <TableCell className="ui-campaign-cell-name">
                  <TableTitle sub={status(r)}>
                    <Link className="ui-campaign-row-link" to={to(r)} aria-label={`${r.campaign.name}, ${r.workspace.brandName}: open the campaign`}>
                      {r.campaign.name}
                    </Link>
                  </TableTitle>
                </TableCell>
                {showBrand && <TableCell>{r.workspace.brandName}</TableCell>}
                <TableCell>
                  {total > 0 ? (
                    <span className="ui-records-bar">
                      <Progress value={n} max={total} aria-label={`${r.campaign.name}: ${n} of ${total} approved`} />
                      <span className="ui-records-data">
                        {n} of {total}
                      </span>
                    </span>
                  ) : (
                    <span className="ui-table-muted">{copy.approvedOf(n, total, r.campaign.waits?.planned)}</span>
                  )}
                </TableCell>
                <TableCell muted={!d}>
                  {d ? (
                    <TableTitle sub={d.label}>
                      <span className="ui-records-data">{d.day}</span>
                    </TableTitle>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

/** "2 of 11 approved", "Planned: 9 creatives". */
const approved = (r: StudioCampaignRow) => copy.approvedOf(r.campaign.counts.approved, r.campaign.counts.creatives, r.campaign.waits?.planned);
