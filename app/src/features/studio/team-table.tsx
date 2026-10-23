// One Team table for Fume's studio and an agency (UX review DLAY-14, DTASK-7, DLOAD-20, PROPOSED 20 Oct 2026; Marcus 20
// Oct: "Agency dashboard blir strengt tatt lik som vår"). The agency's table: the person, their role, the brands or
// clients they work on, this week's load as a quiet bar with its number, and what they do now. Fume's studio adds
// today's checks and their time. An admin follows and carries no load ("Follows"), so the totals count only the
// people who carry work. Said once: no chart and no tiles beside it; the totals are the line under the page title.
// On the phone, rows.
import {
  Avatar,
  Badge,
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
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
import type { User } from "../../contract";
import { firstName, initials } from "../../shell/people";

export interface TeamTableRow {
  user: User;
  /** "Expert", "Creative lead". */
  role: string;
  /** The lead's role badge is Ink. */
  lead?: boolean;
  /** The brands or clients, by name. */
  brands: string[];
  /** This week's load: the bar's value against its max, and its words ("1.5 of 4", "82 %"); none for an admin. */
  week?: { value: number; max: number; words: string; label: string };
  /** What they do now: "3 creatives to check · 1 plan to check · LYSNE". */
  doing: string;
  /** Fume's studio: today's checks. */
  checks?: { today: number; perCheck: number };
}

export function TeamTable({ rows, me, brandLabel = "Brands", checks = false, label }: { rows: TeamTableRow[]; me?: User; brandLabel?: string; checks?: boolean; label: string }) {
  const desk = !useNarrowScreen("(max-width: 1023px)");
  const name = (t: TeamTableRow) => `${t.user.name}${t.user.id === me?.id ? " (you)" : ""}`;
  if (!desk)
    return (
      <ItemGroup as="ul" aria-label={label}>
        {rows.map((t) => (
          <Item key={t.user.id} as="li">
            <ItemMedia>
              <Avatar size="md" src={t.user.avatar} initials={initials(t.user.name)} ink={t.lead} aria-hidden="true" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{name(t)}</ItemTitle>
              <ItemDescription>{[t.user.title, t.role, t.brands.join(", ")].filter(Boolean).join(" · ")}</ItemDescription>
              <Week t={t} />
              <ItemDescription>{t.doing}</ItemDescription>
            </ItemContent>
          </Item>
        ))}
      </ItemGroup>
    );
  return (
    <TableContainer>
      <Table className="ui-records-table" aria-label={label}>
        <TableHeader>
          <TableRow>
            <TableHead className="ui-records-col-lg">Person</TableHead>
            <TableHead className="ui-records-col-md">Role</TableHead>
            <TableHead className="ui-records-col-md">{brandLabel}</TableHead>
            <TableHead className="ui-records-col-lg">This week</TableHead>
            <TableHead>What they do now</TableHead>
            {checks && (
              <>
                <TableHead className="ui-records-col-sm" num>
                  Checks today
                </TableHead>
                <TableHead className="ui-records-col-sm" num>
                  Time today
                </TableHead>
              </>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((t) => (
            <TableRow key={t.user.id}>
              <TableCell>
                <span className="ui-agency-cell-client">
                  <Avatar size="md" src={t.user.avatar} initials={initials(t.user.name)} ink={t.lead} aria-hidden="true" />
                  <TableTitle sub={t.user.title}>{name(t)}</TableTitle>
                </span>
              </TableCell>
              <TableCell>{t.lead ? <Badge variant="ink">{t.role}</Badge> : <Badge>{t.role}</Badge>}</TableCell>
              <TableCell muted={!t.brands.length}>{t.brands.join(", ") || "—"}</TableCell>
              <TableCell>
                <Week t={t} />
              </TableCell>
              <TableCell>{t.doing}</TableCell>
              {checks && (
                <>
                  <TableCell num muted={!t.checks?.today}>
                    {t.checks?.today || "—"}
                  </TableCell>
                  <TableCell num data muted={!t.checks?.today}>
                    {t.checks?.today ? `${t.checks.today * t.checks.perCheck} min` : "—"}
                  </TableCell>
                </>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function Week({ t }: { t: TeamTableRow }) {
  if (!t.week) return <span className="ui-table-muted">Follows</span>;
  return (
    <span className="ui-records-bar">
      <Progress className="ui-agency-load" value={Math.min(t.week.value, t.week.max)} max={t.week.max} aria-label={`${firstName(t.user.name)}: ${t.week.label}`} />
      <span className="ui-records-data">{t.week.words}</span>
    </span>
  );
}
