// Team (ARCHITECTURE §7.2): who on Fume's team carries what, against a capacity of four Core-equivalents each
// (Business Model & GTM), with today's checks and their time. It answers one question for the founders: who has room
// for the next customer, and who is past their share. Round 12 (UX review DLAY-14, DTASK-7, DLOAD-20, PROPOSED 20 Oct
// 2026): the agency's Team table, one component for both frames (team-table.tsx), with the studio's checks added;
// the load once, as the bar in its row (no chart, no tiles); an admin follows and is left out of the capacity.
import { PageHeader } from "@fume/ui";
import { useSession, useTeamLoad } from "../../api/hooks";
import type { TeamLoadRow } from "../../contract";
import * as copy from "../../copy";
import { Nothing, Page, Query, Section } from "../../shell/Page";
import { staffRoleLabel } from "./parts";
import { TeamTable, type TeamTableRow } from "./team-table";

/** 1.5 → "1.5"; 4 → "4". */
const units = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function TeamLoadPage() {
  const team = useTeamLoad();
  const session = useSession().data;
  const me = session?.user;
  const workspaces = session?.workspaces ?? [];
  const brandName = (id: string) => workspaces.find((w) => w.id === id)?.brandName;
  const carrying = (team.data ?? []).filter((r) => !r.follows);
  const load = carrying.reduce((n, r) => n + r.load, 0);
  const capacity = carrying.reduce((n, r) => n + r.capacity, 0);
  const checks = carrying.reduce((n, r) => n + r.checksToday, 0);
  const minutes = carrying.reduce((n, r) => n + r.checksToday * r.minutesPerCheck, 0);

  const row = (r: TeamLoadRow): TeamTableRow => ({
    user: r.user,
    role: r.user.staffRole ? staffRoleLabel[r.user.staffRole] : "Fume",
    brands: (r.brandIds ?? []).map(brandName).filter((n): n is string => Boolean(n)),
    week: r.follows ? undefined : { value: r.load, max: r.capacity, words: `${units(r.load)} of ${r.capacity}`, label: `${units(r.load)} of ${r.capacity} Core-equivalents this week` },
    doing: r.doing ?? "",
    checks: r.checksToday ? { today: r.checksToday, perCheck: r.minutesPerCheck } : undefined,
  });

  return (
    <Page title="Team">
      <PageHeader
        title="Team"
        description="What each person carries this week, against four Core-equivalents each. An admin follows the work and carries none."
        meta={team.data ? [copy.count(team.data.length, "person", "people"), `load ${units(load)} of ${capacity}`, `${copy.count(checks, "check")} today`, `${minutes} min`] : undefined}
      />

      <Query query={team} loading="Loading the team">
        {(rows) =>
          rows.length === 0 ? (
            <Nothing icon="users" title="No one on the team yet" />
          ) : (
            <Section aria-label="This week">
              <TeamTable rows={rows.map(row)} me={me} checks label="The team this week" />
            </Section>
          )
        }
      </Query>
    </Page>
  );
}
