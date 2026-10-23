// Collection deliveries (FLOWS §3.2, §7 step 13), a block for a campaign's page or the deliveries list: each
// collection the campaign takes, how many of its creatives are approved, and the delivery when it is ready
// ("AW26 is ready to deliver"), then the same for the whole campaign. Make delivery calls useMakeDelivery with the
// collection, or without one for the whole campaign, and opens the new delivery. Only owner and approver make one.
//
//   <CollectionDeliveries campaignId="c-autumn" />
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
  useToast,
} from "@fume/ui";
import { Link, useNavigate } from "react-router-dom";
import { useCampaign, useCatalogue, useDeliveries, useMakeDelivery } from "../../api/hooks";
import { readiness, readinessLine, type Readiness } from "../deliveries/grouping";
import { useCatalogueRights } from "./parts";

export interface CollectionDeliveriesProps {
  campaignId: string;
  /** Leave out the whole-campaign row (when the page offers it elsewhere). */
  hideWholeCampaign?: boolean;
}

export function CollectionDeliveries({ campaignId, hideWholeCampaign }: CollectionDeliveriesProps) {
  const view = useCampaign(campaignId);
  const catalogue = useCatalogue();
  const deliveries = useDeliveries();
  const make = useMakeDelivery();
  const toast = useToast();
  const navigate = useNavigate();
  const { canDecide } = useCatalogueRights();

  if (!view.data || !catalogue.data || !deliveries.data) return null;
  const { campaign, creatives } = view.data;
  const rows = readiness(campaign, creatives, catalogue.data.collections, deliveries.data).filter(
    (r) => !(hideWholeCampaign && !r.collection),
  );

  function deliver(r: Readiness) {
    const name = r.collection ? `${campaign.name} · ${r.collection.name}` : campaign.name;
    make.mutate(
      { campaignId, collectionId: r.collection?.id },
      {
        onSuccess: (d) => {
          toast.done(`Fume is packing ${name}`, { description: "It is ready to download in a moment." });
          navigate(`/deliveries/${d.id}`);
        },
        onError: (error) => toast.error("The delivery wasn’t made", { description: error.message }),
      },
    );
  }

  return (
    <ItemGroup as="ul" aria-label={`Deliveries for ${campaign.name}`}>
      {rows.map((r) => {
        const name = r.collection?.name ?? "Whole campaign";
        const busy = make.isPending && make.variables?.collectionId === r.collection?.id;
        return (
          <Item key={r.collection?.id ?? "campaign"} as="li" variant={r.ready && !r.delivery ? "default" : "muted"}>
            {r.collection?.cover ? (
              <ItemMedia variant="image">
                <ItemMediaImage src={r.collection.cover} alt="" />
              </ItemMedia>
            ) : (
              <ItemMedia variant="icon">
                <Icon name={r.collection ? "layers" : "megaphone"} />
              </ItemMedia>
            )}
            <ItemContent>
              <ItemTitle>{name}</ItemTitle>
              <ItemDescription>{readinessLine(r, r.collection?.name ?? campaign.name)}</ItemDescription>
            </ItemContent>
            <ItemActions>
              {r.delivery ? (
                <Button asChild variant="quiet" size="sm" icon="arrow-up-right">
                  <Link to={`/deliveries/${r.delivery.id}`}>Open the delivery</Link>
                </Button>
              ) : canDecide && r.approved > 0 ? (
                <Button
                  variant={r.ready ? "primary" : "secondary"}
                  size="sm"
                  icon="download"
                  loading={busy}
                  disabled={make.isPending && !busy}
                  onClick={() => deliver(r)}
                >
                  {r.ready ? "Make delivery" : `Deliver the ${r.approved} approved`}
                </Button>
              ) : null}
            </ItemActions>
          </Item>
        );
      })}
    </ItemGroup>
  );
}
