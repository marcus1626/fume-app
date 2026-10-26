// Deliveries (FLOWS §3.2), a place of its own in the customer's sidebar. By campaign: the deliveries it has, one row
// each, then what is approved and in no delivery yet, offered as a delivery only once it is complete. No heading per
// campaign: each row already carries the campaign's name ("Autumn launch · Masters"). Ready to download wears Moss.
import { PageHeader } from "@fume/ui";
import { useCampaigns, useDeliveries } from "../../api/hooks";
import type { Campaign } from "../../contract";
import * as copy from "../../copy";
import { Nothing, Page, Query } from "../../shell/Page";
import { CampaignDeliveries } from "./CampaignDeliveries";

/** A campaign with something to show here: approved work, and not closed. */
const hasWork = (c: Campaign) => c.counts.approved > 0 && c.state !== "closed";

export function DeliveriesPage() {
  const deliveries = useDeliveries();
  const campaigns = useCampaigns();
  const ready = (deliveries.data ?? []).filter((d) => d.state === "ready").length;

  return (
    <Page title="Deliveries">
      <PageHeader
        title="Deliveries"
        description="Approved creatives, named and grouped by collection, product and format."
        meta={
          deliveries.data
            ? [ready ? `${ready} ready to download` : copy.count(deliveries.data.length, "delivery", "deliveries")]
            : undefined
        }
      />
      <Query query={deliveries}>
        {(list) => {
          // One section per campaign, each delivery said once: the campaigns whose newest delivery is newest first,
          // then the campaigns with approved work and no delivery yet.
          const order = new Map<string, number>();
          list.forEach((d) => order.set(d.campaignId, Math.max(order.get(d.campaignId) ?? 0, Date.parse(d.createdAt))));
          for (const c of campaigns.data ?? []) if (hasWork(c) && !order.has(c.id)) order.set(c.id, 0);
          const ids = [...order].sort((a, b) => b[1] - a[1]).map(([id]) => id);
          if (ids.length === 0)
            return (
              <Nothing
                icon="package"
                title="No deliveries yet"
                text="When you approve the creatives in a campaign, Fume names them, groups them by collection and format and puts them here."
              />
            );
          return (
            <div className="ui-app-stack">
              {ids.map((campaignId) => (
                <CampaignDeliveries key={campaignId} campaignId={campaignId} named />
              ))}
            </div>
          );
        }}
      </Query>
    </Page>
  );
}
