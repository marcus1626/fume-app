// A campaign's deliveries, each said once (UX review 19 Oct, TASK-16; PROPOSED 19 Oct 2026): one row per delivery
// that exists ("Autumn launch · Masters · 2 creatives"), then a row only for approved creatives that are in no
// delivery yet. "Make the delivery" is offered only once everything in the campaign (or the collection it takes) is
// approved, so it never reads as something she must press, and it never packs the same creatives twice. Making one
// keeps her where she is; the toast opens it. Used on the campaign's Delivery tab and on All deliveries.
//
//   <CampaignDeliveries campaignId="c-autumn" />
//   <CampaignDeliveries campaignId="c-autumn" named />   (All deliveries, with no campaign heading over the rows: the
//   rows that are not a delivery yet say the campaign's name too, round 9, DLOAD-15)
import {
  Button,
  Icon,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
  useToast,
} from "@fume/ui";
import { Link, useNavigate } from "react-router-dom";
import { useCampaign, useCatalogue, useDeliveries, useMakeDelivery, useSession } from "../../api/hooks";
import type { Campaign, Collection, Creative, Delivery } from "../../contract";
import * as copy from "../../copy";
import { rights } from "../campaigns/parts";
import { inCollection } from "./grouping";
import { DeliveryBadge, deliveryLine } from "./parts";

export interface ToDeliver {
  /** Undefined for the whole campaign. */
  collection?: Collection;
  /** Approved, and in no delivery yet. */
  waiting: Creative[];
  /** Still in the making, in check, with her, or being changed. */
  underWay: number;
  /** Everything in it is approved: Fume offers the delivery. */
  ready: boolean;
}

const done = (c: Creative) => c.current.state === "approved" || c.current.state === "delivered";

/** What waits for a delivery: per collection the campaign takes, or the whole campaign when it takes none. */
export function toDeliver(
  campaign: Campaign,
  creatives: Creative[],
  collections: Collection[],
  deliveries: Delivery[],
): ToDeliver[] {
  const packed = new Set(deliveries.filter((d) => d.campaignId === campaign.id).flatMap((d) => d.creativeIds));
  // What she cannot see yet (being made or checked) is still under way, though it is not in her list.
  const unseen = Math.max(0, campaign.counts.creatives - creatives.length);
  const measure = (list: Creative[], collection?: Collection): ToDeliver => {
    const waiting = list.filter((c) => c.current.state === "approved" && !packed.has(c.id));
    const underWay = list.filter((c) => !done(c)).length + unseen;
    return { collection, waiting, underWay, ready: waiting.length > 0 && underWay === 0 };
  };
  const taken = (campaign.collectionIds ?? [])
    .map((id) => collections.find((c) => c.id === id))
    .filter((c): c is Collection => Boolean(c));
  const rows = taken
    .map((cl) =>
      measure(
        creatives.filter((c) => inCollection(c, campaign, cl)),
        cl,
      ),
    )
    .filter((r) => r.waiting.length > 0);
  if (rows.length > 0) return rows;
  const whole = measure(creatives);
  return whole.waiting.length > 0 ? [whole] : [];
}

export function CampaignDeliveries({ campaignId, named = false }: { campaignId: string; named?: boolean }) {
  const view = useCampaign(campaignId);
  const catalogue = useCatalogue();
  const deliveries = useDeliveries();
  const session = useSession().data!;
  const make = useMakeDelivery();
  const toast = useToast();
  const navigate = useNavigate();
  const can = rights(session.role);

  if (!view.data || !catalogue.data || !deliveries.data) return null;
  const { campaign, creatives } = view.data;
  const made = deliveries.data.filter((d) => d.campaignId === campaign.id);
  const rows = toDeliver(campaign, creatives, catalogue.data.collections, deliveries.data);

  if (made.length === 0 && rows.length === 0)
    return named ? null : (
      <p className="ui-app-section-text">
        {campaign.counts.approved > 0
          ? "Everything approved is in a delivery."
          : "Nothing approved yet. Once it is, Fume packs it here: every format, named and ready to use."}
      </p>
    );

  function deliver(r: ToDeliver) {
    const name = r.collection ? `${campaign.name} · ${r.collection.name}` : campaign.name;
    make.mutate(
      { campaignId, collectionId: r.collection?.id },
      {
        onSuccess: (d) =>
          toast.done(`Fume is packing ${name}`, {
            description: "It is ready to download in a moment.",
            action: { label: "Open", onClick: () => navigate(`/deliveries/${d.id}`) },
          }),
        onError: (error) => toast.error("The delivery wasn’t made", { description: error.message }),
      },
    );
  }

  return (
    <ItemGroup as="ul" aria-label={`Deliveries for ${campaign.name}`}>
      {made.map((d) => (
        <Item key={d.id} as="li" variant="outline" asChild>
          <Link to={`/deliveries/${d.id}`}>
            <ItemMedia variant="icon">
              <Icon name="package" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{d.name}</ItemTitle>
              <ItemDescription>{deliveryLine(d)}</ItemDescription>
            </ItemContent>
            <ItemActions>
              <DeliveryBadge state={d.state} />
              <Icon name="chevron-right" />
            </ItemActions>
          </Link>
        </Item>
      ))}
      {rows.map((r) => {
        const name = r.collection
          ? named
            ? `${campaign.name} · ${r.collection.name}`
            : r.collection.name
          : campaign.name;
        const busy = make.isPending && make.variables?.collectionId === r.collection?.id;
        return (
          <Item key={r.collection?.id ?? "campaign"} as="li" variant="muted">
            <ItemMedia variant="icon">
              <Icon name={r.ready ? "package" : "clock"} />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>
                {r.ready
                  ? `${name} is ready to deliver`
                  : `${named ? `${name} · ` : ""}${copy.creatives(r.waiting.length)} approved, in no delivery yet`}
              </ItemTitle>
              <ItemDescription>
                {r.ready
                  ? `${copy.creatives(r.waiting.length)}, every format, named and ready to use.`
                  : `${r.underWay} still under way. Fume offers the delivery once all of ${name} is approved.`}
              </ItemDescription>
            </ItemContent>
            {r.ready && can.approve && (
              <ItemActions>
                <Button
                  variant="secondary"
                  size="sm"
                  icon="package"
                  loading={busy}
                  disabled={make.isPending && !busy}
                  onClick={() => deliver(r)}
                >
                  Make the delivery
                </Button>
              </ItemActions>
            )}
          </Item>
        );
      })}
    </ItemGroup>
  );
}
