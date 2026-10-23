// The quality log (ARCHITECTURE §4.6, §7.2): everything the Quality Gate caught before a customer saw it, how bad it
// was and whether it is fixed. The table holds each one and comes first; the chart below it shows catches week by
// week, stacked by severity. Round 12 (UX review DLAY-16, PROPOSED 20 Oct 2026): no stat tiles, the counts are the
// line under the title; Critical is one of the table's filters; the chart is the compact height.
// The point of the page is the record behind "every creative is checked" (F-D025), so nothing here is softened.
import {
  Badge,
  Chart,
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
  type ChartConfig,
  type ChartDatum,
} from "@fume/ui";
import { useState } from "react";
import { usePeople, useQualityLog, useSession, useStudioCampaigns } from "../../api/hooks";
import type { QualityLogEntry, Severity } from "../../contract";
import * as copy from "../../copy";
import { date, now, when } from "../../lib/time";
import { Nothing, Page, Query, Section } from "../../shell/Page";
import { directory } from "../../shell/people";
import { severityLabel } from "./parts";

const WEEKS = 8;
const DAY = 86_400_000;
const severities: Severity[] = ["critical", "major", "minor"];
const config: ChartConfig = { critical: { label: "Critical" }, major: { label: "Major" }, minor: { label: "Minor" } };

/** The Monday a moment falls in, as an ISO date (the chart's week key). */
function monday(t: number): string {
  const d = new Date(t);
  const back = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back)).toISOString().slice(0, 10);
}

/** The last eight weeks, each with its catches by severity. */
function byWeek(entries: QualityLogEntry[]): ChartDatum[] {
  const thisWeek = Date.parse(monday(now()));
  return Array.from({ length: WEEKS }, (_, i) => {
    const week = new Date(thisWeek - (WEEKS - 1 - i) * 7 * DAY).toISOString().slice(0, 10);
    const inWeek = entries.filter((e) => monday(Date.parse(e.at)) === week);
    // The week as the table writes a day ("24 Aug", DLOAD-21); the bar chart shows its key as it is.
    return {
      week: date(week),
      ...Object.fromEntries(severities.map((s) => [s, inWeek.filter((e) => e.severity === s).length])),
    };
  });
}

type Show = "all" | "open" | "fixed" | "critical";

export function QualityLogPage() {
  const log = useQualityLog();
  const campaigns = useStudioCampaigns().data;
  const people = directory(usePeople().data);
  const [show, setShow] = useState<Show>("all");
  const campaignOf = new Map((campaigns ?? []).map((r) => [r.campaign.id, r]));
  // Round 13 AGENCY: an agency's checks keep its clients from seeing a mistake.
  const agency = Boolean(useSession().data?.user.agency);

  return (
    <Page title="Quality log">
      <PageHeader
        title="Quality log"
        description={`What the Quality Gate caught before ${agency ? "a client" : "a customer"} saw it, how serious it was and whether it is fixed.`}
        meta={
          log.data
            ? [
                copy.count(log.data.length, "catch", "catches"),
                `${log.data.filter((e) => e.severity === "critical").length} critical`,
                `${log.data.filter((e) => !e.fixed).length} open`,
              ]
            : undefined
        }
      />

      <Query query={log} loading="Loading the quality log">
        {(entries) => {
          if (entries.length === 0)
            return (
              <Nothing
                icon="circle-check"
                title="Nothing caught yet"
                text="Every catch the expert makes in a check is written here."
              />
            );
          const shown = entries.filter((e) =>
            show === "all"
              ? true
              : show === "open"
                ? !e.fixed
                : show === "critical"
                  ? e.severity === "critical"
                  : e.fixed,
          );
          const fixed = entries.filter((e) => e.fixed).length;
          const critical = entries.filter((e) => e.severity === "critical").length;
          const chart = (
            <Section title="Catches by week" titleId="quality-chart" text="Stacked by severity, the last eight weeks.">
              <div className="ui-records-chart">
                <Chart
                  type="bar"
                  stack
                  legend
                  title="Catches by week"
                  description="What the Quality Gate caught each week, by severity."
                  config={config}
                  data={byWeek(entries)}
                  xKey="week"
                  xLabel="Week of"
                  valueLabel="Catches"
                  point="week"
                />
              </div>
            </Section>
          );
          return (
            <>
              <Section
                title="Every catch"
                meta={shown.length}
                titleId="quality-table"
                action={
                  <SegmentedControl aria-label="Show" value={show} onValueChange={(v) => setShow(v as Show)}>
                    <SegmentedOption value="all" count={entries.length}>
                      All
                    </SegmentedOption>
                    <SegmentedOption value="open" count={entries.length - fixed}>
                      Open
                    </SegmentedOption>
                    <SegmentedOption value="fixed" count={fixed}>
                      Fixed
                    </SegmentedOption>
                    <SegmentedOption value="critical" count={critical}>
                      Critical
                    </SegmentedOption>
                  </SegmentedControl>
                }
              >
                {shown.length === 0 ? (
                  <Nothing
                    icon="circle-check"
                    title={
                      show === "open" ? "Nothing open" : show === "critical" ? "Nothing critical" : "Nothing fixed yet"
                    }
                  />
                ) : (
                  <TableContainer>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>What was caught</TableHead>
                          <TableHead>Severity</TableHead>
                          <TableHead>State</TableHead>
                          <TableHead>Caught by</TableHead>
                          <TableHead>When</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {shown.map((e) => {
                          const row = campaignOf.get(e.campaignId);
                          return (
                            <TableRow key={e.id}>
                              <TableCell>
                                <TableTitle sub={row ? `${row.workspace.brandName} · ${row.campaign.name}` : undefined}>
                                  {e.what}
                                </TableTitle>
                              </TableCell>
                              <TableCell>
                                <Badge variant={e.severity === "critical" ? "ink" : "neutral"}>
                                  {severityLabel[e.severity]}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge dot={e.fixed ? "on" : "idle"}>{e.fixed ? "Fixed" : "Open"}</Badge>
                              </TableCell>
                              <TableCell>{people.name(e.by)}</TableCell>
                              <TableCell data trail>
                                <time dateTime={e.at}>{when(e.at)}</time>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Section>
              {chart}
            </>
          );
        }}
      </Query>
    </Page>
  );
}
