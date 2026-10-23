// One campaigns table for Fume's studio and an agency (UX review DLAY-9, DLOAD-16, PROPOSED 20 Oct 2026; Marcus 20 Oct:
// "Agency dashboard blir strengt tatt lik som vår"). Built on the agency's table: the cover, Under way and Done, sortable
// headers. Each row holds the campaign with its one status sentence (copy.campaignStatus for the viewer, DLOAD-1),
// its brand or client (on the page for every brand only), the stage as five dots, the next date with its label
// ("Plan by", "Delivery", "Goes live", DLOAD-13), what is in check (a link into Check) and what is with the customer.
// The whole row opens the campaign. On the phone the rows stay list rows.
// Round 13 (Marcus #68: "columns for Under way, Done and so on instead of rows"): CampaignBoard shows the same rows as a
// board, one column per stage (Brief … Delivery, from campaigns/stages.ts) and Done, a card per campaign; the page
// keeps the table as List.
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
} from "@fume/ui";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Campaign, Workspace } from "../../contract";
import * as copy from "../../copy";
import { date, due } from "../../lib/time";
import { Section } from "../../shell/Page";
import { StepDots, stepOf } from "../campaigns/parts";
import { STAGES, stageOf } from "../campaigns/stages";

export interface CampaignTableRow {
  campaign: Campaign;
  /** The brand (studio) or the client (agency). */
  brand: Workspace;
  /** A quiet line under the brand: who is on it ("Anna, Sander"). */
  brandLine?: string;
  /** The one status sentence, for this viewer. */
  status: copy.CampaignStatus;
  /** A quiet line under the status: the Engine's run ("9 of 9 made · 6 of 9 checked"). */
  line?: ReactNode;
  /** Where the row leads (a link), or what opening it does. */
  to?: string;
  onOpen?: () => void;
  /** Where the In check count leads (Check, for that campaign). */
  checkTo?: string;
}

type SortKey = "brand" | "stage" | "date";

const done = (c: Campaign) => ["approved", "delivered", "closed"].includes(c.state);
const dateOf = (c: Campaign) => copy.campaignDate(c);
const when = (c: Campaign) => Date.parse(dateOf(c)?.at ?? "") || Number.POSITIVE_INFINITY;
/** Checked, not sent yet; the rest of the checked creatives are with the customer. */
const toSend = (c: Campaign) => Math.min(c.counts.checked, c.waits?.toSend ?? 0);

/** What waits on the reader first, then the soonest next date; done campaigns the latest first. */
function byDefault(rows: CampaignTableRow[], latest = false) {
  return rows
    .slice()
    .sort((a, b) => Number(b.status.on === "you") - Number(a.status.on === "you") || (latest ? when(b.campaign) - when(a.campaign) : when(a.campaign) - when(b.campaign)));
}

export function CampaignTables({
  rows,
  showBrand,
  brandLabel = "Brand",
  customerLabel = "With the customer",
  idPrefix,
}: {
  rows: CampaignTableRow[];
  /** The brand column, on the page for every brand. */
  showBrand: boolean;
  brandLabel?: string;
  customerLabel?: string;
  idPrefix: string;
}) {
  const desk = !useNarrowScreen("(max-width: 1023px)");
  const groups = [
    { key: "under-way", title: "Under way", rows: byDefault(rows.filter((r) => !done(r.campaign))) },
    { key: "done", title: "Done", rows: byDefault(rows.filter((r) => done(r.campaign)), true) },
  ].filter((g) => g.rows.length);
  return (
    <div className="ui-campaign-list">
      {groups.map((g) => (
        <Section key={g.key} title={g.title} meta={g.rows.length} titleId={`${idPrefix}-${g.key}`}>
          {desk ? (
            <CampaignTable rows={g.rows} showBrand={showBrand} brandLabel={brandLabel} customerLabel={customerLabel} labelledBy={`${idPrefix}-${g.key}`} />
          ) : (
            <ItemGroup as="ul" aria-labelledby={`${idPrefix}-${g.key}`}>
              {g.rows.map((r) => (
                <CampaignItem key={r.campaign.id} row={r} showBrand={showBrand} />
              ))}
            </ItemGroup>
          )}
        </Section>
      ))}
    </div>
  );
}

function CampaignTable({ rows, showBrand, brandLabel, customerLabel, labelledBy }: { rows: CampaignTableRow[]; showBrand: boolean; brandLabel: string; customerLabel: string; labelledBy: string }) {
  const sort = useTableSort<SortKey>();
  const shown = sort.key
    ? sort.sorted(rows, (r, key) => (key === "date" ? when(r.campaign) : key === "brand" ? r.brand.brandName : stepOf(r.campaign).step + (stepOf(r.campaign).done ? 1 : 0)))
    : rows;
  return (
    <TableContainer>
      <Table className="ui-campaign-table ui-records-table" aria-labelledby={labelledBy}>
        <TableHeader>
          <TableRow>
            <TableHead className="ui-campaign-col-cover">
              <span className="ui-campaign-sr">Cover</span>
            </TableHead>
            <TableHead>Campaign</TableHead>
            {showBrand && (
              <TableHead className="ui-records-col-md" sort={sort.directionOf("brand")} onSort={() => sort.sortBy("brand")}>
                {brandLabel}
              </TableHead>
            )}
            <TableHead className="ui-campaign-col-stage" sort={sort.directionOf("stage")} onSort={() => sort.sortBy("stage")}>
              Stage
            </TableHead>
            <TableHead className="ui-records-col-md" sort={sort.directionOf("date")} onSort={() => sort.sortBy("date")}>
              Next date
            </TableHead>
            <TableHead className="ui-records-col-sm" num>
              In check
            </TableHead>
            <TableHead className="ui-records-col-md" num>
              {customerLabel}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.map((r) => (
            <CampaignRow key={r.campaign.id} row={r} showBrand={showBrand} />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function Opener({ row, children }: { row: CampaignTableRow; children: ReactNode }) {
  const label = `${row.campaign.name}, ${row.brand.brandName}: open the campaign`;
  if (row.to)
    return (
      <Link className="ui-campaign-row-link" to={row.to} aria-label={label}>
        {children}
      </Link>
    );
  // Neither a link nor an action (the admin's limited view, robots' note 09): the name, as words.
  if (!row.onOpen) return <>{children}</>;
  return (
    <button type="button" className="ui-agency-row-open" onClick={row.onOpen} aria-label={label}>
      {children}
    </button>
  );
}

function Cover({ c }: { c: Campaign }) {
  return c.cover ? (
    <img className="ui-campaign-cover" src={c.cover} alt="" />
  ) : (
    <span className="ui-campaign-cover" aria-hidden="true">
      <Icon name="megaphone" />
    </span>
  );
}

function CampaignRow({ row, showBrand }: { row: CampaignTableRow; showBrand: boolean }) {
  const { campaign: c } = row;
  const next = dateOf(c);
  const sending = toSend(c);
  const withThem = c.counts.checked - sending;
  return (
    <TableRow className="ui-campaign-row">
      <TableCell media>
        <Cover c={c} />
      </TableCell>
      <TableCell className="ui-campaign-cell-name">
        <TableTitle sub={row.status.words}>
          <Opener row={row}>{c.name}</Opener>
        </TableTitle>
        {row.line && <span className="ui-records-line">{row.line}</span>}
      </TableCell>
      {showBrand && (
        <TableCell>
          <TableTitle sub={row.brandLine}>{row.brand.brandName}</TableTitle>
        </TableCell>
      )}
      <TableCell>
        <StepDots campaign={c} />
      </TableCell>
      <TableCell muted={!next}>
        {next ? (
          <TableTitle sub={next.label}>
            <span className="ui-records-data">{next.label === copy.dateLabel.delivered || next.label === "Went live" ? date(next.at) : due(next.at)}</span>
          </TableTitle>
        ) : done(c) ? (
          "—"
        ) : (
          "Not set"
        )}
      </TableCell>
      <TableCell num muted={!c.counts.inCheck}>
        {c.counts.inCheck && row.checkTo ? (
          <Link className="ui-link ui-records-cell-link" to={row.checkTo} aria-label={`${copy.creatives(c.counts.inCheck)} in check: open Check`}>
            {c.counts.inCheck}
          </Link>
        ) : (
          c.counts.inCheck || "—"
        )}
      </TableCell>
      <TableCell num muted={!withThem && !sending}>
        {sending ? <TableTitle sub={copy.send.toSend(sending)}>{withThem}</TableTitle> : withThem || "—"}
      </TableCell>
    </TableRow>
  );
}

function CampaignItem({ row, showBrand }: { row: CampaignTableRow; showBrand: boolean }) {
  const { campaign: c } = row;
  const next = copy.campaignDateWords(c);
  const body = (
    <>
      <ItemMedia variant={c.cover ? "image" : "icon"}>{c.cover ? <ItemMediaImage src={c.cover} alt="" /> : <Icon name="megaphone" />}</ItemMedia>
      <ItemContent>
        <ItemTitle>
          {c.name} {showBrand && <span className="ui-home-due">{row.brand.brandName}</span>}
        </ItemTitle>
        <ItemDescription>{[row.status.words, next].filter(Boolean).join(" · ")}</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Icon name="chevron-right" />
      </ItemActions>
    </>
  );
  return (
    <Item as="li" asChild>
      {row.to ? (
        <Link to={row.to}>{body}</Link>
      ) : row.onOpen ? (
        <button type="button" onClick={row.onOpen}>
          {body}
        </button>
      ) : (
        <div>{body}</div>
      )}
    </Item>
  );
}

// ─── The board (r13 #68) ─────────────────────────────────────────────────────

/** The campaigns as a board: a column per stage, then Done; in each, what waits on the reader first. */
export function CampaignBoard({ rows, showBrand, label = "Campaigns by stage" }: { rows: CampaignTableRow[]; showBrand: boolean; label?: string }) {
  const columns = [
    ...STAGES.map((s) => ({ id: s.id as string, title: s.label, rows: byDefault(rows.filter((r) => !done(r.campaign) && stageOf(r.campaign) === s.id)) })),
    { id: "done", title: "Done", rows: byDefault(rows.filter((r) => done(r.campaign)), true) },
  ];
  return (
    <div className="ui-stage-board" role="list" aria-label={label}>
      {columns.map((col) => (
        <section key={col.id} className="ui-stage-col" role="listitem" aria-labelledby={`stage-col-${col.id}`} data-empty={col.rows.length ? undefined : ""}>
          <h3 className="ui-stage-col-head" id={`stage-col-${col.id}`}>
            {col.title}
            <span className="ui-stage-col-count">{col.rows.length}</span>
          </h3>
          {col.rows.length ? (
            <ul className="ui-stage-cards">
              {col.rows.map((r) => (
                <li key={r.campaign.id}>
                  <StageCard row={r} showBrand={showBrand} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="ui-stage-col-none">None</p>
          )}
        </section>
      ))}
    </div>
  );
}

function StageCard({ row, showBrand }: { row: CampaignTableRow; showBrand: boolean }) {
  const { campaign: c } = row;
  const next = copy.campaignDateWords(c);
  const body = (
    <>
      <span className="ui-stage-card-head">
        <Cover c={c} />
        <span className="ui-stage-card-name">{c.name}</span>
      </span>
      {showBrand && <span className="ui-stage-card-brand">{row.brand.brandName}</span>}
      <span className="ui-stage-card-status" data-on={row.status.on === "you" ? "" : undefined}>
        {row.status.words}
      </span>
      {next && <span className="ui-stage-card-date">{next}</span>}
    </>
  );
  const label = `${c.name}, ${row.brand.brandName}: ${row.status.words}`;
  return row.to ? (
    <Link className="ui-stage-card" to={row.to} aria-label={label}>
      {body}
    </Link>
  ) : row.onOpen ? (
    <button type="button" className="ui-stage-card" onClick={row.onOpen} aria-label={label}>
      {body}
    </button>
  ) : (
    <div className="ui-stage-card">{body}</div>
  );
}
