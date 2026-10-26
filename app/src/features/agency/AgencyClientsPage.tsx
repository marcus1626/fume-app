// Clients (FLOWS §24.3): every client brand the agency runs, A to Z, so a client stays where it was. On a desk a table
// to scan: the client's mark, name and status sentence (a quiet dot when something waits on the agency), its campaigns
// under way, the next delivery, what waits on the client, the client's people and who leads it at the agency. The whole
// row opens the client's Home. The phone keeps rows. ?client=<id> marks that row for a moment and brings it into view.
// The lead's one action is Add a client, a right panel (?add=1).
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
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAgencyClients } from "../../api/hooks";
import type { AgencyClient, User } from "../../contract";
import * as copy from "../../copy";
import { due } from "../../lib/time";
import { Nothing, Page, Query, Section } from "../../shell/Page";
import { AddClientPanel, useAddClientParam } from "./agency-add-client";
import { ClientMark, Faces, nameOrYou, useAgencySeat, useOpenFromAgency, WaitsDot } from "./agency-parts";

/** A to Z by the brand's name (AURÉA between ...A and B). */
const byName = (rows: AgencyClient[]) =>
  [...rows].sort((a, b) => a.workspace.brandName.localeCompare(b.workspace.brandName, "en", { sensitivity: "base" }));

export function AgencyClientsPage() {
  const { lead, isAgency, me } = useAgencySeat();
  const clients = useAgencyClients(isAgency);
  const add = useAddClientParam();
  const [params, setParams] = useSearchParams();
  const desk = !useNarrowScreen("(max-width: 1023px)");
  const marked = params.get("client") ?? undefined;
  const waiting = clients.data?.filter((c) => c.waitingOnYou > 0).length ?? 0;
  useMark(marked, Boolean(clients.data?.some((c) => c.workspace.id === marked)));

  return (
    <Page title="Clients">
      <PageHeader
        title="Clients"
        meta={
          clients.data
            ? [copy.count(clients.data.length, "client brand"), ...(waiting ? [`${waiting} wait on you`] : [])]
            : undefined
        }
        actions={
          lead ? (
            <Button icon="plus" onClick={() => add.setOpen(true)}>
              Add a client
            </Button>
          ) : undefined
        }
      />

      <Query query={clients} loading="Loading your clients">
        {(all) =>
          all.length === 0 ? (
            <Nothing
              icon="users"
              title="No clients yet"
              text="Add a client brand with its website: Fume reads the brand and starts its Brand DNA, and the client’s people get an invitation."
              action={
                lead ? (
                  <Button icon="plus" onClick={() => add.setOpen(true)}>
                    Add a client
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Section aria-label="Every client">
              {desk ? <ClientsTable rows={byName(all)} me={me} /> : <ClientRows rows={byName(all)} />}
            </Section>
          )
        }
      </Query>

      <AddClientPanel
        open={add.open}
        onOpenChange={(o) => add.setOpen(o)}
        onAdded={(client) => {
          const out = new URLSearchParams(params);
          out.delete("add");
          out.set("client", client.workspace.id);
          setParams(out, { replace: true });
        }}
      />
    </Page>
  );
}

/** Marks the row an address points at for a moment, and brings it into view once it is there. */
function useMark(id: string | undefined, ready: boolean) {
  useEffect(() => {
    if (!id || !ready) return;
    const el = document.querySelector<HTMLElement>(`[data-agency-client="${CSS.escape(id)}"]`);
    if (!el) return;
    el.scrollIntoView({
      block: "center",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
    el.setAttribute("data-marked", "");
    const t = window.setTimeout(() => el.removeAttribute("data-marked"), 3200);
    return () => window.clearTimeout(t);
  }, [id, ready]);
}

function ClientsTable({ rows, me }: { rows: AgencyClient[]; me?: User }) {
  return (
    <TableContainer>
      <Table className="ui-campaign-table ui-agency-table" aria-label="Every client">
        <TableHeader>
          <TableRow>
            <TableHead className="ui-campaign-col-cover">
              <span className="ui-campaign-sr">Picture</span>
            </TableHead>
            <TableHead className="ui-agency-col-client">Client</TableHead>
            <TableHead className="ui-agency-col-num" num>
              Under way
            </TableHead>
            <TableHead className="ui-agency-col-date">Next delivery</TableHead>
            <TableHead>With the client</TableHead>
            <TableHead className="ui-agency-col-people">People</TableHead>
            <TableHead className="ui-agency-col-who">Lead</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c) => (
            <ClientRow key={c.workspace.id} client={c} me={me} />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function ClientRow({ client, me }: { client: AgencyClient; me?: User }) {
  const open = useOpenFromAgency();
  const { workspace, nextDelivery, lead } = client;
  return (
    <TableRow className="ui-agency-row" data-agency-client={workspace.id}>
      <TableCell media>
        {client.picture ? (
          <img className="ui-campaign-cover" src={client.picture} alt="" />
        ) : (
          <ClientMark workspace={workspace} className="ui-campaign-cover ui-agency-cover-mark" />
        )}
      </TableCell>
      <TableCell>
        <span className="ui-agency-cell-client">
          <TableTitle sub={client.status}>
            <span className="ui-agency-cell-who">
              <button
                type="button"
                className="ui-agency-row-open"
                onClick={() => open({ id: workspace.id, example: client.example })}
                aria-label={`Open ${workspace.brandName}`}
              >
                {workspace.brandName}
              </button>
              <WaitsDot count={client.waitingOnYou} />
            </span>
          </TableTitle>
        </span>
      </TableCell>
      <TableCell data num muted={!client.campaignsActive}>
        {client.campaignsActive || "—"}
      </TableCell>
      <TableCell data muted={!nextDelivery}>
        {nextDelivery ? due(nextDelivery.at) : "Not set"}
      </TableCell>
      <TableCell muted={!client.waitingOn}>{client.waitingOn ?? "—"}</TableCell>
      <TableCell muted={!client.people.length}>
        {client.people.length ? (
          <Faces
            people={client.people}
            label={`${workspace.brandName}’s people: ${client.people.map((p) => p.name).join(", ")}`}
          />
        ) : (
          "Not invited yet"
        )}
      </TableCell>
      <TableCell muted={!lead}>{nameOrYou(lead, me) ?? "—"}</TableCell>
    </TableRow>
  );
}

/** The phone: one row per client, its mark, name and sentence. */
function ClientRows({ rows }: { rows: AgencyClient[] }) {
  return (
    <ItemGroup as="ul" aria-label="Every client">
      {rows.map((c) => (
        <ClientItem key={c.workspace.id} client={c} />
      ))}
    </ItemGroup>
  );
}

function ClientItem({ client }: { client: AgencyClient }) {
  const open = useOpenFromAgency();
  return (
    <li data-agency-client={client.workspace.id}>
      <Item asChild>
        <button type="button" onClick={() => open({ id: client.workspace.id, example: client.example })}>
          {client.picture ? (
            <ItemMedia variant="image">
              <ItemMediaImage src={client.picture} alt="" />
            </ItemMedia>
          ) : (
            <ItemMedia>
              <ClientMark workspace={client.workspace} />
            </ItemMedia>
          )}
          <ItemContent>
            <ItemTitle>
              {client.workspace.brandName} <WaitsDot count={client.waitingOnYou} />
            </ItemTitle>
            <ItemDescription>{[client.status, client.waitingOn].filter(Boolean).join(" · ")}</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Icon name="chevron-right" />
          </ItemActions>
        </button>
      </Item>
    </li>
  );
}
