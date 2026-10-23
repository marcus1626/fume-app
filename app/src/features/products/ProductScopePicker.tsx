// Product scope picker (FLOWS §3.2, §7 step 8): what a campaign is about, as single products and whole collections,
// picked as a grid of pictures (Marcus 15 Oct: "ser man produktene som grid, ikke liste med navn"). A collection brings
// all its products, and new products in it join later.
// Round 8 (UX review 19 Oct, LOAD-5 and LOAD-2): the grid shows only products that can be used. Products not confirmed
// yet fold into ONE row, "6 more products to confirm". A product the brief's line names comes first, alone.
// Collections wait behind a quiet "A whole collection", so the first question stays "Which product?".
// Round 9 (desktop review 19 Oct, DWAY-5, DTSK-6, DLOAD-1; PROPOSED): a product that waits is confirmed in CHECK's one
// product panel (useOpenProductCheck, the card with the photo and Fume's question first), beside the form; once
// confirmed it is ticked here. One verb: Confirm.
//
//   With a campaign, it saves itself through useSetCampaignScope:
//     <ProductScopePicker campaign={campaign} onSaved={() => …} />
//   Inside a flow that has no campaign yet, it is controlled:
//     <ProductScopePicker value={{ productIds, collectionIds }} onChange={setScope} named={ids} size="sm" />
import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Icon,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
  PickGrid,
  PickTile,
  ProductSheetButton,
  ProductTile,
  useToast,
} from "@fume/ui";
import { useState } from "react";
import { useCatalogue, useSetCampaignScope } from "../../api/hooks";
import type { Campaign, Id, Product } from "../../contract";
import * as copy from "../../copy";
import { Query } from "../../shell/Page";
import { AllProductsSheet } from "../fume/AllProducts";
import { usable } from "./parts";
import { useOpenProductCheck } from "../check/ProductCheckHost";

/** How many products show inline; the rest are in the All products sheet. */
const INLINE = 6;

export interface Scope {
  productIds: Id[];
  collectionIds: Id[];
}

export interface ProductScopePickerProps {
  /** Saves to this campaign with a Save button. */
  campaign?: Campaign;
  onSaved?: (campaign: Campaign) => void;
  /** Controlled use, without a campaign. */
  value?: Scope;
  onChange?: (scope: Scope) => void;
  /** Products the brief's line names: one that waits for a check is offered first, on its own. */
  named?: Id[];
  /** "sm": smaller tiles, about three across on a phone (the brief form). */
  size?: "md" | "sm";
}

const names = (list: Product[]) =>
  list.length <= 3
    ? list
        .map((p) => p.name)
        .join(", ")
        .replace(/, ([^,]*)$/, " and $1")
    : `${list
        .slice(0, 3)
        .map((p) => p.name)
        .join(", ")} and ${list.length - 3} more`;

export function ProductScopePicker({
  campaign,
  onSaved,
  value,
  onChange,
  named = [],
  size = "md",
}: ProductScopePickerProps) {
  const catalogue = useCatalogue();
  const save = useSetCampaignScope();
  const toast = useToast();
  // Round 6 (walk-through Must 1, worker T): a few tiles inline, the whole catalogue in the All products sheet.
  const [all, setAll] = useState(false);
  const [own, setOwn] = useState<Scope>(() => ({
    collectionIds: campaign?.collectionIds ?? [],
    // Products that come from a chosen collection are not picked one by one.
    productIds: campaign?.productIds ?? [],
  }));
  const openCheck = useOpenProductCheck();
  const scope = value ?? own;
  const set = (next: Scope) => (onChange ? onChange(next) : setOwn(next));

  return (
    <Query query={catalogue} loading="Loading your catalogue">
      {({ products, collections }) => {
        const fromCollections = new Map<Id, string>();
        for (const c of collections)
          if (scope.collectionIds.includes(c.id))
            for (const id of c.productIds) if (!fromCollections.has(id)) fromCollections.set(id, c.name);
        const total = new Set([
          ...scope.productIds.filter((id) => products.some((p) => p.id === id && usable(p))),
          ...fromCollections.keys(),
        ]).size;
        const toggle = (key: keyof Scope, id: Id, on: boolean) =>
          set({ ...scope, [key]: on ? [...new Set([...scope[key], id])] : scope[key].filter((x) => x !== id) });
        const pictures = (ids: Id[]) =>
          ids.map((id) => products.find((p) => p.id === id)?.images[0]).filter((s): s is string => Boolean(s));

        const ready = products.filter(usable);
        // A product picked before its check (an older campaign) keeps its tile, with the way to check it.
        const shown = [
          ...ready.filter((p, i) => i < INLINE || scope.productIds.includes(p.id)),
          ...products.filter((p) => !usable(p) && scope.productIds.includes(p.id)),
        ];
        const waiting = products.filter((p) => !usable(p) && !scope.productIds.includes(p.id));
        const asked = waiting.filter((p) => named.includes(p.id));
        const next = asked.length ? asked : waiting;
        const title = asked.length
          ? `Confirm ${names(asked)} first`
          : `${ready.length ? `${waiting.length} more ${waiting.length === 1 ? "product" : "products"}` : copy.count(waiting.length, "product")} to confirm`;
        const line = asked.length ? "Confirm what Fume read, and it is added here." : names(waiting);
        // The one product panel (CHECK), beside the page; once she confirms, the product is ticked here.
        const check = (id: Id) =>
          openCheck(id, {
            over: "brief",
            onConfirmed: (done) => set({ ...scope, productIds: [...new Set([...scope.productIds, done])] }),
          });

        return (
          <div className="ui-app-stack">
            {shown.length > 0 && (
              <PickGrid size={size} aria-label="Products">
                {shown.map((p) => {
                  const via = fromCollections.get(p.id);
                  const ok = usable(p);
                  return (
                    <ProductTile
                      key={p.id}
                      name={p.name}
                      variant={p.variant}
                      src={p.images[0]}
                      included={ok && Boolean(via)}
                      note={ok && via ? `In ${via}` : undefined}
                      selected={ok ? scope.productIds.includes(p.id) : undefined}
                      onSelectedChange={(on) => toggle("productIds", p.id, on)}
                      flag={ok ? undefined : "Not confirmed yet"}
                      action={
                        ok ? undefined : (
                          <Button
                            size="sm"
                            variant="secondary"
                            icon="circle-check"
                            aria-label={`Confirm ${p.name}`}
                            onClick={() => check(p.id)}
                          >
                            Confirm
                          </Button>
                        )
                      }
                    />
                  );
                })}
              </PickGrid>
            )}
            {ready.length > INLINE && <ProductSheetButton count={products.length} onClick={() => setAll(true)} />}
            {waiting.length > 0 && (
              <Item
                as="button"
                type="button"
                variant="muted"
                data-reveal={asked.length ? "" : undefined}
                onClick={() => check(next[0].id)}
              >
                {next[0].images[0] ? (
                  <ItemMedia variant="image">
                    <img src={next[0].images[0]} alt="" />
                  </ItemMedia>
                ) : (
                  <ItemMedia variant="icon">
                    <Icon name="circle-check" />
                  </ItemMedia>
                )}
                <ItemContent>
                  <ItemTitle>{title}</ItemTitle>
                  <ItemDescription>{line}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Icon name="chevron-right" />
                </ItemActions>
              </Item>
            )}
            {collections.length > 0 && (
              <Collapsible className="ui-brief-fold" defaultOpen={scope.collectionIds.length > 0}>
                <CollapsibleTrigger>A whole collection</CollapsibleTrigger>
                <CollapsibleContent>
                  <PickGrid size={size} aria-label="Whole collections">
                    {collections.map((c) => (
                      <PickTile
                        key={c.id}
                        title={c.name}
                        line={`Collection · ${copy.count(c.productIds.length, "product")}`}
                        src={c.cover}
                        images={pictures(c.productIds)}
                        icon="layers"
                        selected={scope.collectionIds.includes(c.id)}
                        onSelectedChange={(on) => toggle("collectionIds", c.id, on)}
                      />
                    ))}
                  </PickGrid>
                </CollapsibleContent>
              </Collapsible>
            )}
            <AllProductsSheet
              open={all}
              onOpenChange={setAll}
              multiple
              value={scope.productIds.filter((id) => products.some((p) => p.id === id && usable(p)))}
              onPick={(ids) => set({ ...scope, productIds: ids })}
              onConfirm={(id) => check(id)}
            />
            {campaign && (
              <div className="ui-app-row">
                <Button
                  icon="check"
                  loading={save.isPending}
                  disabled={total === 0}
                  onClick={() =>
                    save.mutate(
                      { campaignId: campaign.id, ...scope },
                      {
                        onSuccess: (c) => {
                          toast.done(`${campaign.name} takes ${copy.count(total, "product")}`);
                          onSaved?.(c);
                        },
                        onError: (error) => toast.error("That wasn’t saved", { description: error.message }),
                      },
                    )
                  }
                >
                  Save the products
                </Button>
              </div>
            )}
          </div>
        );
      }}
    </Query>
  );
}
