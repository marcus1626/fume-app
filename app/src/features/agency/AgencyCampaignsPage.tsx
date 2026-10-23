// Campaigns across the clients (FLOWS §24.3, round 11, PROPOSED 20 Oct 2026). Round 12 (UX review DLAY-9, DLOAD-1,
// DLOAD-13): the same table as Fume's studio (features/studio/campaign-table.tsx): the cover, the campaign and its
// one status sentence as the agency reads it (copy.campaignStatus, viewer "agency": "3 creatives to check",
// "6 creatives to send to Maja", "6 creatives with Maja"), the client, the stage dots, the next date with its label,
// In check and what is with the client. Under way first (what waits on the agency, then the soonest date), then Done.
// The whole row opens it: a full example client opens that client and then the campaign; a summary client opens its
// Home, which says it is an example. Pills above filter by client (?client=). The phone keeps rows.
// Round 13 AGENCY (robot note 10-agency): the header's "to check" is Check's own number (its badge and the Overview's),
// the product page's creatives included; the table's In check column keeps each campaign's.
import { PageHeader, ToggleGroup, ToggleGroupItem } from "@fume/ui";
import { useSearchParams } from "react-router-dom";
import { useAgencyCampaigns, useAgencyClients } from "../../api/hooks";
import type { AgencyCampaignRow, Id, Workspace } from "../../contract";
import * as copy from "../../copy";
import { Nothing, Page, Query } from "../../shell/Page";
import { firstName } from "../../shell/people";
import { CampaignTables, type CampaignTableRow } from "../studio/campaign-table";
import { useQaWaiting } from "../studio/qa/count";
import { clientPerson, rowStatus, useOpenFromAgency } from "./agency-parts";

export function AgencyCampaignsPage() {
  const campaigns = useAgencyCampaigns();
  const clientList = useAgencyClients(true).data ?? [];
  const open = useOpenFromAgency();
  const [params, setParams] = useSearchParams();
  const filter = params.get("client") ?? "";

  const all = campaigns.data ?? [];
  const clients: Workspace[] = [];
  for (const r of all) if (!clients.some((c) => c.id === r.client.id)) clients.push(r.client);
  const choose = (id: string) => {
    const out = new URLSearchParams(params);
    if (id) out.set("client", id);
    else out.delete("client");
    setParams(out, { replace: true });
  };
  // The client's person who approves, by first name: "6 creatives with Maja".
  const personOf = (id: Id) => {
    const p = clientList.find((c) => c.workspace.id === id)?.people[0];
    return p ? firstName(p.name) : undefined;
  };
  const tableRow = (r: AgencyCampaignRow): CampaignTableRow => {
    const status: copy.CampaignStatus =
      r.example === "full"
        ? copy.campaignStatus(r.campaign, undefined, { viewer: "agency", customerName: personOf(r.client.id) ?? clientPerson(r.waitingOn), date: false })
        : { words: r.status, waiting: rowStatus(r).on === "You", on: rowStatus(r).on === "You" ? "you" : "client" };
    return { campaign: r.campaign, brand: r.client, status, onOpen: () => open({ id: r.client.id, example: r.example }, `/campaigns/${r.campaign.id}`), checkTo: r.example === "full" ? "/agency/check" : undefined };
  };
  const live = all.filter((r) => !["approved", "delivered", "closed"].includes(r.campaign.state));
  const checking = useQaWaiting().total;
  const sending = live.reduce((n, r) => n + Math.min(r.campaign.counts.checked, r.campaign.waits?.toSend ?? 0), 0);

  return (
    <Page title="Campaigns" docTitle={filter ? `${clients.find((c) => c.id === filter)?.brandName ?? "Campaigns"} · Campaigns` : "Campaigns"}>
      <PageHeader
        title="Campaigns"
        meta={
          campaigns.data
            ? [`${copy.count(live.length, "campaign")} under way`, copy.count(clients.length, "client"), copy.toCheck(0, checking), ...(sending ? [copy.send.toSend(sending)] : [])]
            : undefined
        }
        tabs={
          clients.length > 1 ? (
            <div className="ui-agency-filter">
              <ToggleGroup type="single" size="sm" loose value={filter || "all"} onValueChange={(v) => choose(v === "all" ? "" : v)} aria-label="Show the campaigns of">
                <ToggleGroupItem value="all">All clients</ToggleGroupItem>
                {clients.map((c) => (
                  <ToggleGroupItem key={c.id} value={c.id}>
                    {c.brandName}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          ) : undefined
        }
      />

      <Query query={campaigns} loading="Loading the campaigns">
        {(rows) => {
          const shown = filter ? rows.filter((r) => r.client.id === filter) : rows;
          if (!shown.length)
            return <Nothing icon="megaphone" title={filter ? "No campaigns for this client yet" : "No campaigns yet"} text="A campaign starts in a client’s Fume conversation, or from a brief you write." />;
          return <CampaignTables rows={shown.map(tableRow)} showBrand={!filter} brandLabel="Client" customerLabel="With the client" idPrefix="agency-campaigns" />;
        }}
      </Query>
    </Page>
  );
}
