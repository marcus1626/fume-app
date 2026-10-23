// The agency's team (FLOWS §24.3, round 11, PROPOSED 20 Oct 2026): its people, their role, the clients they work on,
// how full their week is (a quiet bar, the share as data) and what they do this week. Round 12 (UX review DLAY-14,
// DTASK-7): the same Team table as Fume's studio (features/studio/team-table.tsx). The lead invites someone with
// Invite, a secondary pill (a small right panel: email and role; in the preview a toast says the invitation went).
// Round 13 (Marcus #70): the roles are Fume's own, Admin, Expert and Operator.
import { Button, PageHeader } from "@fume/ui";
import { useState } from "react";
import { useAgencyClients, useAgencyTeam } from "../../api/hooks";
import type { AgencyClient, AgencyTeamMember } from "../../contract";
import * as copy from "../../copy";
import { Nothing, Page, Query, Section } from "../../shell/Page";
import { firstName } from "../../shell/people";
import { TeamTable, type TeamTableRow } from "../studio/team-table";
import { InvitePanel } from "./agency-invite";
import { agencyRoleOf, agencyRoleWords, useAgencySeat } from "./agency-parts";

/** An agency person in the shared Team table's terms. */
function teamRow(t: AgencyTeamMember, clients: AgencyClient[]): TeamTableRow {
  const pct = Math.round(t.load * 100);
  return {
    user: t.user,
    role: agencyRoleWords[agencyRoleOf(t.role, t.user)],
    lead: t.role === "lead",
    brands: t.clientIds.map((id) => clients.find((c) => c.workspace.id === id)?.workspace.brandName).filter((n): n is string => Boolean(n)),
    week: { value: pct, max: 100, words: `${pct} %`, label: `${firstName(t.user.name)}’s week is ${pct} % full` },
    doing: t.thisWeek,
  };
}

export function AgencyTeamPage() {
  const { lead, agency, me, isAgency } = useAgencySeat();
  const team = useAgencyTeam();
  const clients = useAgencyClients(isAgency);
  const [inviting, setInviting] = useState(false);
  const name = agency?.name ?? "the agency";

  return (
    <Page title="Team">
      <PageHeader
        title="Team"
        description={`${name}’s people, the clients they work on and how full their week is.`}
        meta={team.data ? [copy.count(team.data.length, "person", "people")] : undefined}
        actions={
          lead ? (
            <Button variant="secondary" icon="user-plus" onClick={() => setInviting(true)}>
              Invite
            </Button>
          ) : undefined
        }
      />

      <Query query={team} loading="Loading the team">
        {(rows) =>
          rows.length === 0 ? (
            <Nothing icon="users" title="No one on the team yet" />
          ) : (
            <Section aria-label="This week">
              <TeamTable rows={rows.map((t) => teamRow(t, clients.data ?? []))} me={me} brandLabel="Clients" label="The team this week" />
            </Section>
          )
        }
      </Query>

      <InvitePanel open={inviting} onOpenChange={setInviting} agencyName={name} known={(team.data ?? []).map((t) => t.user.email)} />
    </Page>
  );
}
