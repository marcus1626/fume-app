// Usage (FLOWS §20): what each brand uses, for Fume's admin and operators. Renders, what they cost (staff only),
// creatives made and delivered, and renders per week over the last eight weeks. Calm: no Amber here (Amber counts
// checked work only), the series are Ink and Focus.
// Round 12 AGENCY (UX review DTASK-6, DLOAD-7, DLAY-16; PROPOSED 20 Oct 2026): ONE Usage page for both frames, at
// /studio/usage for Fume's people and /agency/usage for an agency's. A period control at the top, This month (the
// default) · Last month · Last 8 weeks, kept in the address (?period=last_month | weeks), with the dates written out
// in the meta line ("1–31 Oct 2026"). Then one table, a row per brand or client: Package (used of included, when it
// renews; Fume's brands, this month only), Creatives made, Approved by the customer (the client, for an agency),
// Delivered, and Renders and Cost (Fume's people only), with "In all" at its foot. No stat cards: the table is the
// answer. Fume's people then see the renders per week; an agency sees what its licence covers. The numbers are the
// same ones the brand's Home and the agency's Licence read (mock: r11-agency.ts usage()). On a phone each brand is a
// row with its figures in one line.
import {
  Button,
  Chart,
  DataList,
  DataListItem,
  Icon,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
  PageHeader,
  SegmentedControl,
  SegmentedOption,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  TableTitle,
  useNarrowScreen,
} from "@fume/ui";
import { Link, useSearchParams } from "react-router-dom";
import { useLicence, useSession, useUsage } from "../../api/hooks";
import type { UsageFigures, UsagePeriod, UsageRow } from "../../contract";
import * as copy from "../../copy";
import { now } from "../../lib/time";
import { Nothing, Page, Query, Section } from "../../shell/Page";
import { hrefIn } from "../../shell/scope";

const usd = (n: number) => `$${n.toFixed(2)}`;
const WEEKS = 8;

const PERIODS: { value: UsagePeriod; label: string }[] = [
  { value: "month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "weeks", label: "Last 8 weeks" },
];

/** A day of a period's edge; the periods are whole UTC days, so they are read in UTC. */
const part = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { ...o, timeZone: "UTC" }).format(Date.parse(iso));

/** "1–31 Oct 2026", "24 Aug – 18 Oct 2026": a period with its dates written out. */
export function periodSpan(p: { from: string; to: string }): string {
  const year = part(p.to, { year: "numeric" });
  const sameMonth = part(p.from, { month: "short", year: "numeric" }) === part(p.to, { month: "short", year: "numeric" });
  return sameMonth
    ? `${part(p.from, { day: "numeric" })}–${part(p.to, { day: "numeric", month: "short" })} ${year}`
    : `${part(p.from, { day: "numeric", month: "short" })} – ${part(p.to, { day: "numeric", month: "short" })} ${year}`;
}

/** The Monday of each of the last eight weeks, oldest first, as ISO dates (the chart's "week of" labels). */
function weekStarts(): string[] {
  const today = new Date(now());
  const monday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - ((today.getUTCDay() + 6) % 7));
  return Array.from({ length: WEEKS }, (_, i) => new Date(monday - (WEEKS - 1 - i) * 7 * 86_400_000).toISOString().slice(0, 10));
}

const isPeriod = (v: string | null): v is UsagePeriod => v === "month" || v === "last_month" || v === "weeks";

export function UsagePage() {
  const session = useSession().data!;
  const agency = Boolean(session.user.agency);
  const usage = useUsage();
  const [params, setParams] = useSearchParams();
  const asked = params.get("period");
  const period: UsagePeriod = isPeriod(asked) ? asked : "month";
  const choose = (next: string) => {
    const out = new URLSearchParams(params);
    if (next === "month") out.delete("period");
    else out.set("period", next);
    setParams(out, { replace: true });
  };
  const span = usage.data?.find((r) => r.periods)?.periods?.[period];
  const org = session.agency?.organisation.name ?? "The agency";
  const noun = agency ? (["client", "clients"] as const) : (["brand", "brands"] as const);

  return (
    <Page title="Usage">
      <PageHeader
        title="Usage"
        description={
          agency
            ? `What ${org} made for each client, and what each client approved and received. Production is by use, counted per client each month.`
            : "What each brand used, made, approved and received, and what the Engine’s images cost. Cost is for Fume’s people only."
        }
        meta={usage.data ? [...(span ? [periodSpan(span)] : []), copy.count(usage.data.length, noun[0], noun[1])] : undefined}
        tabs={
          <SegmentedControl aria-label="The period" value={period} onValueChange={choose}>
            {PERIODS.map((p) => (
              <SegmentedOption key={p.value} value={p.value}>
                {p.label}
              </SegmentedOption>
            ))}
          </SegmentedControl>
        }
      />

      <Query query={usage} loading="Loading usage">
        {(rows) =>
          rows.length === 0 ? (
            <Nothing
              icon="chart-column"
              title="No usage yet"
              text={agency ? "Clients show here once the Engine makes creatives for them." : "Brands show here once the Engine makes images for them."}
            />
          ) : (
            <>
              <UsageTable rows={rows} period={period} agency={agency} />
              {agency ? <LicenceFacts /> : <RendersChart rows={rows} />}
            </>
          )
        }
      </Query>
    </Page>
  );
}

/** One row per brand or client in the period; "In all" at its foot. On a phone, one row each with its figures. */
function UsageTable({ rows, period, agency }: { rows: UsageRow[]; period: UsagePeriod; agency: boolean }) {
  const phone = useNarrowScreen("(max-width: 767px)");
  const of = (r: UsageRow): UsageFigures | undefined => r.periods?.[period];
  const name = (r: UsageRow) => r.workspace?.brandName ?? r.workspaceId;
  const href = (r: UsageRow) => (agency ? hrefIn("agency", r.workspaceId, "/") : `/studio/b/${r.workspaceId}`);
  const sorted = [...rows].sort((a, b) => (of(b)?.creatives ?? 0) - (of(a)?.creatives ?? 0) || name(a).localeCompare(name(b)));
  const sum = (pick: (f: UsageFigures) => number) => rows.reduce((n, r) => n + (of(r) ? pick(of(r)!) : 0), 0);
  // The package is this month's: Fume's brands only (an agency pays by use).
  const showPackage = !agency && period === "month";
  const approvedBy = agency ? "Approved by the client" : "Approved by the customer";
  const example = (r: UsageRow) => (r.example === "summary" ? "Example client: summary figures" : r.workspace ? `${r.workspace.market}` : undefined);
  const pkg = (r: UsageRow) => (r.package ? `${r.package.used} of ${r.package.included}` : "–");
  const renews = (r: UsageRow) => (r.package?.renewsAt ? `renews ${part(r.package.renewsAt, { day: "numeric", month: "short" })}` : undefined);
  const title = agency ? "Per client" : "Per brand";

  if (phone)
    return (
      <Section title={title} meta={rows.length} titleId="usage-rows">
        <ItemGroup as="ul" aria-labelledby="usage-rows">
          {sorted.map((r) => {
            const f = of(r);
            const line = f
              ? [
                  ...(showPackage && r.package ? [`package ${pkg(r)}`] : []),
                  `${f.creatives} made`,
                  `${f.approved} approved`,
                  `${f.delivered} delivered`,
                  ...(agency ? [] : [`${f.renders} images`, usd(f.cost)]),
                ].join(" · ")
              : "No figures";
            return (
              <Item key={r.workspaceId} as="li" asChild>
                <Link to={href(r)}>
                  <ItemContent>
                    <ItemTitle>{name(r)}</ItemTitle>
                    <ItemDescription>{line}</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Icon name="chevron-right" />
                  </ItemActions>
                </Link>
              </Item>
            );
          })}
        </ItemGroup>
      </Section>
    );

  return (
    <Section title={title} meta={rows.length} titleId="usage-rows">
      <TableContainer>
        <Table className="ui-agency-table ui-usage-table" aria-labelledby="usage-rows">
          <TableHeader>
            <TableRow>
              <TableHead>{agency ? "Client" : "Brand"}</TableHead>
              {showPackage && <TableHead className="ui-usage-col-package">Package</TableHead>}
              <TableHead className="ui-usage-col-num" num>
                Creatives made
              </TableHead>
              <TableHead className="ui-usage-col-wide" num>
                {approvedBy}
              </TableHead>
              <TableHead className="ui-usage-col-num" num>
                Delivered
              </TableHead>
              {!agency && (
                <>
                  <TableHead className="ui-usage-col-num" num>
                    Images
                  </TableHead>
                  <TableHead className="ui-usage-col-num" num>
                    Cost
                  </TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((r) => {
              const f = of(r);
              return (
                <TableRow key={r.workspaceId} className="ui-agency-row">
                  <TableCell>
                    <TableTitle sub={example(r)}>
                      <Link className="ui-agency-row-open" to={href(r)}>
                        {name(r)}
                      </Link>
                    </TableTitle>
                  </TableCell>
                  {showPackage && (
                    <TableCell>
                      <TableTitle sub={renews(r)}>{pkg(r)}</TableTitle>
                    </TableCell>
                  )}
                  <TableCell data num muted={!f?.creatives}>
                    {f?.creatives ?? "–"}
                  </TableCell>
                  <TableCell data num muted={!f?.approved}>
                    {f?.approved ?? "–"}
                  </TableCell>
                  <TableCell data num muted={!f?.delivered}>
                    {f?.delivered ?? "–"}
                  </TableCell>
                  {!agency && (
                    <>
                      <TableCell data num muted={!f?.renders}>
                        {f?.renders ?? "–"}
                      </TableCell>
                      <TableCell data num muted={!f?.cost}>
                        {f ? usd(f.cost) : "–"}
                      </TableCell>
                    </>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>In all</TableCell>
              {showPackage && <TableCell />}
              <TableCell data num>
                {sum((f) => f.creatives)}
              </TableCell>
              <TableCell data num>
                {sum((f) => f.approved)}
              </TableCell>
              <TableCell data num>
                {sum((f) => f.delivered)}
              </TableCell>
              {!agency && (
                <>
                  <TableCell data num>
                    {sum((f) => f.renders)}
                  </TableCell>
                  <TableCell data num>
                    {usd(sum((f) => f.cost))}
                  </TableCell>
                </>
              )}
            </TableRow>
          </TableFooter>
        </Table>
      </TableContainer>
    </Section>
  );
}

/** Fume's people: the Engine's images (renders) per brand over the last eight weeks, Monday to Sunday (r13 #58: "Image" in the words). */
function RendersChart({ rows }: { rows: UsageRow[] }) {
  const weeks = weekStarts();
  const name = (r: UsageRow) => r.workspace?.brandName ?? r.workspaceId;
  const sorted = [...rows].sort((a, b) => b.renders - a.renders);
  const key = (row: UsageRow) => row.workspaceId.replace(/[^a-z0-9]/gi, "");
  return (
    <Section title="Images per week" titleId="usage-trend" text="The last eight weeks, Monday to Sunday, whatever the period above.">
      <Chart
        type="line"
        title="Images per week"
        description="The Engine’s images per brand, the last eight weeks."
        config={Object.fromEntries(sorted.map((r) => [key(r), { label: name(r) }]))}
        data={weeks.map((week, i) => ({ week, ...Object.fromEntries(sorted.map((r) => [key(r), r.trend[i] ?? 0])) }))}
        xKey="week"
        xFormat="week"
        xLabel="Week"
        valueLabel="Images"
        point="week"
        legend={sorted.length > 1}
      />
    </Section>
  );
}

/** An agency: what its licence covers, from the licence itself; the settings keep the rest. */
function LicenceFacts() {
  const licence = useLicence();
  const lead = useSession().data?.agency?.role === "lead";
  return (
    <Section
      title="The licence"
      titleId="usage-licence"
      action={
        lead ? (
          <Button asChild variant="quiet" size="sm" iconEnd="arrow-right">
            <Link to="/agency/settings/licence">Licence settings</Link>
          </Button>
        ) : undefined
      }
    >
      <Query query={licence} loading="Loading the licence">
        {(v) => (
          <DataList>
            <DataListItem label="Platform">A fixed fee for {v.agency.name}</DataListItem>
            <DataListItem label="Production">By use: the creatives made for each client, counted each month</DataListItem>
            <DataListItem label="Scope">{v.scope}</DataListItem>
            <DataListItem label="Seats">
              {v.seats.used} of {v.seats.included} used
            </DataListItem>
          </DataList>
        )}
      </Query>
    </Section>
  );
}
