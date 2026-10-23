// One collection (FLOWS §3.1, §3.2): its cover (a band under the header, so the products start on the first screen),
// dates and products, the campaigns that belong to it, everything approved for it across campaigns, and its deliveries.
// A collection Fume proposed shows Confirm · Change · Remove under the header until someone decides.
// - The campaigns that belong to it take it whole, or take no collection and make only its products, each with its one
//   status sentence (copy.campaignStatus).
// - An approved creative opens in the viewer over this page and closes back to it (?c=, the same word as review).
// - "Make a delivery" is a labelled pill that opens a sheet ("2 approved creatives from SS27", with the campaign to
//   pick when there are several); after it she stays here, and the toast opens the new delivery.
import {
  Button,
  CreativeGrid,
  CreativeTile,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  Proposal,
  ProposalActions,
  ProposalFoot,
  RadioGroup,
  RadioGroupItem,
  Choice,
  ChoiceText,
  useToast,
} from "@fume/ui";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useCatalogue, useCollection, useDecide, useDeliveries, useMakeDelivery } from "../../api/hooks";
import type { Campaign, Collection, Creative } from "../../contract";
import * as copy from "../../copy";
import { Back, Nothing, Page, Query, Section } from "../../shell/Page";
import { useCustomerNamesAcross } from "../review/names";
import { useOverlay } from "../review/overlay";
import { ReviewViewer } from "../review/ViewerPage";
import { formatLine } from "../shared/creatives";
import { DeliveryBadge, deliveryLine } from "../deliveries/parts";
import { ChangeCollectionDialog } from "./dialogs";
import { collectionKind, ProductCard, ProvenanceTag, seasonDates, useCatalogueRights } from "./parts";

/** Does this campaign belong on the collection's page? It takes the collection whole, or it takes no collection and
 *  makes only products that are in it (an AW26 campaign is not listed under SS27 for sharing one product). */
function campaignOfCollection(campaign: Campaign, collection: Collection): boolean {
  if (campaign.collectionIds?.includes(collection.id)) return true;
  if (campaign.collectionIds?.length) return false;
  return campaign.productIds.length > 0 && campaign.productIds.every((id) => collection.productIds.includes(id));
}

export function CollectionPage() {
  const { collectionId } = useParams<"collectionId">();
  const view = useCollection(collectionId);
  const catalogue = useCatalogue();
  const { canEdit, canDecide } = useCatalogueRights();
  const make = useMakeDelivery();
  const decide = useDecide();
  const toast = useToast();
  const navigate = useNavigate();
  const [picking, setPicking] = useState(false);
  const [changing, setChanging] = useState<Collection | null>(null);
  const viewer = useOverlay("c");
  const allDeliveries = useDeliveries();

  const c = view.data?.collection;
  const name = c?.name ?? "Collection";
  // Only the campaigns that belong here, and what they made.
  const campaigns = useMemo(
    () => (view.data && c ? view.data.campaigns.filter((cp) => campaignOfCollection(cp, c)) : []),
    [view.data, c],
  );
  const named = useCustomerNamesAcross(campaigns);
  const approvedNamed = useMemo(
    () => (view.data?.approved ?? []).filter((cr) => campaigns.some((cp) => cp.id === cr.campaignId)).map(named),
    [view.data?.approved, campaigns, named],
  );
  // What is approved and in no delivery yet, per campaign: only that is packed, and only once everything in that
  // campaign is approved, as on the campaign's Delivery tab (never a pill she must press half way).
  const packed = useMemo(() => new Set((allDeliveries.data ?? []).flatMap((d) => d.creativeIds)), [allDeliveries.data]);
  const waiting = (cp: Campaign) =>
    approvedNamed.filter((cr) => cr.campaignId === cp.id && cr.current.state === "approved" && !packed.has(cr.id));
  const ready = campaigns.filter((cp) => waiting(cp).length > 0 && cp.counts.approved >= cp.counts.creatives);

  function deliver(campaign: Campaign) {
    if (!c) return;
    make.mutate(
      { campaignId: campaign.id, collectionId: c.id },
      {
        onSuccess: (d) => {
          setPicking(false);
          toast.done(`Fume is packing ${campaign.name} · ${c.name}`, {
            description: "It is ready to download in a moment.",
            action: { label: "Open", onClick: () => navigate(`/deliveries/${d.id}`) },
          });
        },
        onError: (error) => toast.error("The delivery wasn’t made", { description: error.message }),
      },
    );
  }

  function onDecide(verdict: "keep" | "change" | "remove") {
    if (!c) return;
    if (verdict === "change") return setChanging(c);
    decide.mutate(
      { kind: "collection", id: c.id, verdict },
      {
        onSuccess: () => {
          toast.done(verdict === "keep" ? `${c.name} is yours now` : `${c.name} removed`);
          if (verdict === "remove") navigate("/products");
        },
        onError: (error) => toast.error("That wasn’t saved", { description: error.message }),
      },
    );
  }

  return (
    <Page title={name}>
      <PageHeader
        title={name}
        back={<Back to="/brand/products" label="Products" />}
        description={c?.description}
        meta={
          c
            ? [
                collectionKind[c.kind],
                ...(seasonDates(c) ? [seasonDates(c)!] : []),
                copy.count(c.productIds.length, "product"),
              ]
            : undefined
        }
        primaryAction={
          canDecide && c && ready.length > 0
            ? {
                label: "Make a delivery",
                icon: "package",
                busy: make.isPending,
                onSelect: () => setPicking(true),
              }
            : undefined
        }
      />

      {c?.cover && (
        <div className="ui-collection-band">
          <img src={c.cover} alt="" />
        </div>
      )}

      <Query query={view} loading="Loading the collection">
        {({ collection, products, deliveries: all }) => {
          const approved = approvedNamed;
          const deliveries = all.filter(
            (d) =>
              d.collectionId === collection.id ||
              campaigns.some((cp) => cp.id === d.campaignId && d.scope !== "collection"),
          );
          return (
            <>
              {collection.provenance.state === "proposed" && (
                <Proposal state="proposed">
                  <p className="ui-app-section-text">
                    Fume grouped these products from your website. Keep it as a collection, give it your own name, or
                    remove it; the products stay either way.
                  </p>
                  <ProposalFoot>
                    <ProvenanceTag provenance={collection.provenance} />
                    {canDecide && (
                      <ProposalActions
                        disabled={decide.isPending}
                        onKeep={() => onDecide("keep")}
                        onChange={() => onDecide("change")}
                        onRemove={() => onDecide("remove")}
                      />
                    )}
                  </ProposalFoot>
                </Proposal>
              )}

              <Section title="Products" meta={products.length} titleId="collection-products">
                {products.length === 0 ? (
                  <Nothing
                    icon="package"
                    title="No products in it yet"
                    text="Add products to it from their menu in the catalogue."
                  />
                ) : (
                  <ul className="ui-catalogue-grid" aria-label={`Products in ${collection.name}`}>
                    {products.map((p) => (
                      <li key={p.id}>
                        <ProductCard
                          product={p}
                          categories={catalogue.data?.categories ?? []}
                          collections={catalogue.data?.collections ?? []}
                          canEdit={canEdit}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <div className="ui-app-cols">
                <div className="ui-app-stack">
                  <Section
                    title="Approved for it"
                    meta={approved.length}
                    titleId="collection-approved"
                    text={approved.length ? `Everything approved for ${collection.name}, across campaigns.` : undefined}
                  >
                    {approved.length === 0 ? (
                      <Nothing
                        icon="image"
                        title="Nothing approved yet"
                        text={`When you approve creatives of these products, they gather here, ready to deliver as ${collection.name}.`}
                      />
                    ) : (
                      // Each campaign names its creatives Feed 1, Feed 2…, so across campaigns the names repeat; they
                      // are grouped under their campaign's name.
                      campaigns
                        .map((cp) => ({ cp, items: approvedNamed.filter((cr) => cr.campaignId === cp.id) }))
                        .filter((g) => g.items.length > 0)
                        .map(({ cp, items }) => (
                          <section key={cp.id} className="ui-product-group" aria-labelledby={`approved-${cp.id}`}>
                            <div className="ui-image-group-head">
                              <h3 className="ui-image-group-title" id={`approved-${cp.id}`}>
                                {cp.name} <span className="ui-image-group-count">{items.length}</span>
                              </h3>
                            </div>
                            <CreativeGrid aria-label={`Approved for ${collection.name} in ${cp.name}`}>
                              {items.map((cr) => (
                                <CreativeTile
                                  key={cr.id}
                                  src={cr.current.image}
                                  alt={`${cr.title}, ${cp.name}`}
                                  format={cr.format}
                                  label={cr.title}
                                  caption={formatLine(cr)}
                                  onOpen={() => viewer.open(cr.id)}
                                />
                              ))}
                            </CreativeGrid>
                          </section>
                        ))
                    )}
                  </Section>
                </div>

                <aside className="ui-app-stack" aria-label={`About ${collection.name}`}>
                  <Section title="Campaigns" meta={campaigns.length} titleId="collection-campaigns">
                    {campaigns.length === 0 ? (
                      <p className="ui-app-section-text">No campaign uses it yet. A new campaign can take it whole.</p>
                    ) : (
                      <ItemGroup as="ul">
                        {campaigns.map((cp) => (
                          <Item key={cp.id} as="li" size="sm" asChild>
                            <Link to={`/campaigns/${cp.id}`}>
                              {cp.cover ? (
                                <ItemMedia variant="image">
                                  <ItemMediaImage src={cp.cover} alt="" />
                                </ItemMedia>
                              ) : (
                                <ItemMedia variant="icon">
                                  <Icon name="megaphone" />
                                </ItemMedia>
                              )}
                              <ItemContent>
                                <ItemTitle>{cp.name}</ItemTitle>
                                <ItemDescription>{copy.campaignStatus(cp).words}</ItemDescription>
                              </ItemContent>
                            </Link>
                          </Item>
                        ))}
                      </ItemGroup>
                    )}
                  </Section>

                  <Section title="Deliveries" meta={deliveries.length} titleId="collection-deliveries">
                    {deliveries.length === 0 ? (
                      <p className="ui-app-section-text">No delivery yet.</p>
                    ) : (
                      <ItemGroup as="ul">
                        {deliveries.map((d) => (
                          <Item key={d.id} as="li" size="sm" asChild>
                            <Link to={`/deliveries/${d.id}`} title={d.name}>
                              <ItemContent className="ui-collection-delivery">
                                <ItemTitle>{d.name}</ItemTitle>
                                <ItemDescription>
                                  {deliveryLine(d)
                                    .split(" · ")
                                    .map((v, i) => (
                                      <span key={i}>{i > 0 ? ` · ${v}` : v}</span>
                                    ))}
                                </ItemDescription>
                              </ItemContent>
                              <ItemActions>
                                <DeliveryBadge state={d.state} />
                              </ItemActions>
                            </Link>
                          </Item>
                        ))}
                      </ItemGroup>
                    )}
                  </Section>
                </aside>
              </div>
            </>
          );
        }}
      </Query>

      {c && (
        <MakeDeliveryDialog
          open={picking}
          onOpenChange={setPicking}
          collection={c}
          campaigns={ready}
          waiting={waiting}
          busy={make.isPending}
          onPick={deliver}
        />
      )}
      {viewer.value && view.data && approvedNamed.some((cr) => cr.id === viewer.value) && (
        <ReviewViewer
          set={approvedNamed}
          campaigns={campaigns}
          creativeId={viewer.value}
          onMove={viewer.move}
          onClose={viewer.close}
        />
      )}
      {canDecide && (
        <ChangeCollectionDialog collection={changing} onOpenChange={(open) => !open && setChanging(null)} />
      )}
    </Page>
  );
}

/** What the delivery holds before Fume packs it ("2 approved creatives from SS27"), and with several campaigns which
 *  one it is made from. */
function MakeDeliveryDialog({
  open,
  onOpenChange,
  collection,
  campaigns,
  waiting,
  busy,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collection: Collection;
  campaigns: Campaign[];
  waiting: (campaign: Campaign) => Creative[];
  busy: boolean;
  onPick: (campaign: Campaign) => void;
}) {
  const [chosen, setChosen] = useState<string>("");
  const one = campaigns.length === 1 ? campaigns[0] : undefined;
  const campaign = one ?? campaigns.find((c) => c.id === chosen);
  const n = campaign ? waiting(campaign).length : 0;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Make a delivery for {collection.name}</DialogTitle>
          <DialogDescription>
            {one
              ? `${copy.count(n, "approved creative")} from ${collection.name}, in ${one.name}. Fume names them, packs every format and tells you when it is ready.`
              : `Approved creatives for ${collection.name} are in more than one campaign. Which one does Fume pack?`}
          </DialogDescription>
        </DialogHeader>
        {!one && (
          <DialogBody>
            <RadioGroup value={chosen} onValueChange={setChosen} aria-label="Campaign" className="ui-catalogue-pick">
              {campaigns.map((c) => (
                <Choice key={c.id}>
                  <RadioGroupItem value={c.id} />
                  <ChoiceText label={c.name} hint={copy.count(waiting(c).length, "approved creative")} />
                </Choice>
              ))}
            </RadioGroup>
          </DialogBody>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="glass-clear">Later</Button>
          </DialogClose>
          <Button
            variant="glass-white"
            icon="package"
            loading={busy}
            disabled={!campaign}
            onClick={() => campaign && onPick(campaign)}
          >
            Make the delivery
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
