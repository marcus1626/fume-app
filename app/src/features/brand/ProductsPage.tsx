// Brand › Products (UX review 15 Oct, §2.3): the catalogue as a picture grid, one tab of Brand. Products are part of
// what Fume knows about the brand, so they live beside the board and the taste, not as a place of their own. A
// product that needs you comes first: Fume read lines about it that you have not confirmed, and nothing about it
// ships until you have (Product Vision §4.3). Under the products, the collections. Each product keeps its own page
// (/brand/products/:id); /products comes here.
// Round 8 (walk-through 19 Oct, LOAD-14, TASK-6, TASK-13; PROPOSED): a card is the picture and the name, plus "Check"
// while it needs her; the products that need her are checked one at a time from one pill, "Check 7 products" (the
// confirm queue), never by opening seven long pages. A product added by hand lands here, in the list, with a toast
// that says what is left.
// Round 9 (desktop review 19 Oct, DLAY-13, DLAY-15, DLOAD-1; PROPOSED): the tab's one action, "Confirm 7 products"
// (Ink), sits right on the section title's line with Import and Add as quiet pills to its left; the card's chip
// says "To confirm"; Add a product and Import open as the right panel, and a product added lands in the grid, shown
// and marked for a moment (#product-<id>).
import { Button, Icon, InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, useToast } from "@fume/ui";
import { Link } from "react-router-dom";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCatalogue, useDecide, useProductImport } from "../../api/hooks";
import type { Collection, Product } from "../../contract";
import * as copy from "../../copy";
import { Nothing, Query, Section } from "../../shell/Page";
import { ChangeCollectionDialog, NewCollectionDialog } from "../products/dialogs";
import { AddProductFlow } from "../products/add";
import { ImportPanel, ImportProducts, ImportSourceDialog } from "../products/import";
import { CHECK_PRODUCTS, CollectionCard, ProductCard, useCatalogueRights } from "../products/parts";

/** Needs you first, then what Fume is still reading, then verified; by name inside each. */
const order: Record<Product["state"], number> = {
  needs_you: 0,
  draft: 1,
  verified: 2,
};

/** The three groups of the Products tab (#44): what Fume found since she last looked, what waits for her, what is
 *  confirmed. Empty groups are left out. */
function productGroups(list: Product[]) {
  return [
    {
      id: "new",
      title: "New",
      line: "Fume found these since you last looked. Confirm them before they go into a campaign.",
      items: list.filter((p) => p.isNew),
    },
    {
      id: "open",
      title: "Not confirmed yet",
      line: "Fume uses a product in a campaign once you confirm what it read.",
      items: list.filter((p) => !p.isNew && p.state !== "verified"),
    },
    {
      id: "confirmed",
      title: "Confirmed",
      line: "Every creative shows these as they are.",
      items: list.filter((p) => !p.isNew && p.state === "verified"),
    },
  ].filter((g) => g.items.length > 0);
}

/** The Products tab: the grid, a search once there are many, and the collections. */
export function ProductsContent() {
  const catalogue = useCatalogue();
  const { canEdit, canDecide } = useCatalogueRights();
  const importJob = useProductImport().data;
  const importing =
    canEdit && (importJob?.state === "mapping" || importJob?.state === "review" || importJob?.state === "done");
  const decide = useDecide();
  const toast = useToast();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [csv, setCsv] = useState(false);
  const [making, setMaking] = useState(false);
  const [changing, setChanging] = useState<Collection | null>(null);

  function onDecide(c: Collection, verdict: "keep" | "change" | "remove") {
    if (verdict === "change") return setChanging(c);
    decide.mutate(
      { kind: "collection", id: c.id, verdict },
      {
        onSuccess: () =>
          toast.done(
            verdict === "keep" ? `${c.name} confirmed.` : `${c.name} removed.`,
            verdict === "remove" ? { description: "Its products stay in the catalogue." } : undefined,
          ),
        onError: (error) => toast.error("That wasn’t saved", { description: error.message }),
      },
    );
  }

  return (
    <>
      {canEdit && <ImportPanel />}
      <Query query={catalogue} loading="Loading your products">
        {({ products: all, categories, collections }) => {
          if (all.length === 0)
            return (
              <Nothing
                icon="package"
                title="No products yet"
                text="Add the products your campaigns are about. Fume reads what it can, and you confirm it."
                action={
                  canEdit ? (
                    <span className="ui-import-entry">
                      <ImportProducts variant="secondary" size="md" />
                      <Button variant="quiet" icon="plus" onClick={() => setAdding(true)}>
                        Add a product
                      </Button>
                    </span>
                  ) : undefined
                }
              />
            );
          const needYou = all.filter((p) => p.state === "needs_you").length;
          const q = query.trim().toLowerCase();
          const shown = all
            .filter(
              (p) =>
                !q ||
                `${p.name} ${p.variant} ${p.variants?.map((v) => v.name).join(" ") ?? ""}`.toLowerCase().includes(q),
            )
            .sort((a, b) => order[a.state] - order[b.state] || a.name.localeCompare(b.name));
          return (
            <>
              <Section
                title="Products"
                meta={q ? `${shown.length} of ${all.length}` : all.length}
                titleId="brand-products"
                text={needYou ? undefined : "Every product is confirmed."}
                action={
                  canEdit ? (
                    // Round 7: many products come in by Import products (website, CSV, zip); one by Add a product. Round 9
                    // (DLAY-13): the one Ink action, the confirm queue, last on the title's line; the two quiet pills before it.
                    <span className="ui-import-entry">
                      <ImportProducts />
                      <Button variant="quiet" size="sm" icon="plus" onClick={() => setAdding(true)}>
                        Add a product
                      </Button>
                      {needYou > 0 && (
                        // While an import panel holds the page's Ink action, the queue pill steps back to secondary (one Ink).
                        <Button asChild size="sm" icon="check" variant={importing ? "secondary" : "primary"}>
                          <Link to={CHECK_PRODUCTS}>Confirm {copy.count(needYou, "product")}</Link>
                        </Button>
                      )}
                    </span>
                  ) : undefined
                }
              >
                {all.length > 8 && (
                  <InputGroup role="search" className="ui-catalogue-search">
                    <InputGroupAddon>
                      <Icon name="search" />
                    </InputGroupAddon>
                    <InputGroupInput
                      aria-label="Search products"
                      placeholder="Search products"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onClear={() => setQuery("")}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton clear aria-label="Clear the search" onClick={() => setQuery("")} />
                    </InputGroupAddon>
                  </InputGroup>
                )}
                {shown.length === 0 ? (
                  <Nothing
                    icon="search"
                    title="No product matches"
                    text="Try another name."
                    action={
                      <Button variant="secondary" onClick={() => setQuery("")}>
                        Show every product
                      </Button>
                    }
                  />
                ) : (
                  // Round 13 (#44): New, Not confirmed yet and Confirmed, each a group with its own title
                  productGroups(shown).map((g) => (
                    <section key={g.id} className="ui-product-group" aria-labelledby={`products-${g.id}`}>
                      <div className="ui-image-group-head">
                        <h3 className="ui-image-group-title" id={`products-${g.id}`}>
                          {g.title} <span className="ui-image-group-count">{g.items.length}</span>
                        </h3>
                        <p className="ui-image-group-line">{g.line}</p>
                      </div>
                      <ul className="ui-catalogue-grid" aria-labelledby={`products-${g.id}`}>
                        {g.items.map((p) => (
                          <li key={p.id} id={`product-${p.id}`}>
                            <ProductCard
                              product={p}
                              categories={categories}
                              collections={collections}
                              canEdit={canEdit}
                            />
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))
                )}
              </Section>

              <Section
                title="Collections"
                meta={collections.length || undefined}
                titleId="brand-collections"
                action={
                  canEdit ? (
                    <Button variant="quiet" size="sm" icon="plus" onClick={() => setMaking(true)}>
                      New collection
                    </Button>
                  ) : undefined
                }
              >
                {collections.length === 0 ? (
                  <Nothing
                    icon="layers"
                    title="No collections yet"
                    text="Group products into a season, a launch or a line, such as SS27."
                  />
                ) : (
                  <div className="ui-catalogue-grid ui-catalogue-grid--collections">
                    {collections.map((c) => (
                      <CollectionCard
                        key={c.id}
                        collection={c}
                        onDecide={canDecide ? (v) => onDecide(c, v) : undefined}
                        deciding={decide.isPending}
                      />
                    ))}
                  </div>
                )}
              </Section>

              {canEdit && (
                <NewCollectionDialog
                  open={making}
                  onOpenChange={setMaking}
                  products={all}
                  categories={categories}
                  onMade={(c) => navigate(`/products/collections/${c.id}`)}
                />
              )}
            </>
          );
        }}
      </Query>

      {canEdit && (
        // Round 6: one product starts with its kind; many come in by CSV.
        <>
          <AddProductFlow
            open={adding}
            onOpenChange={setAdding}
            onCsv={() => setCsv(true)}
            // It lands in the grid: the page scrolls to it and marks it for a moment (the shell's #hash).
            onAdded={(p) => navigate({ hash: `product-${p.id}` }, { replace: true, preventScrollReset: true })}
          />
          <ImportSourceDialog source={csv ? "csv" : null} onOpenChange={setCsv} />
        </>
      )}
      {canDecide && (
        <ChangeCollectionDialog collection={changing} onOpenChange={(open) => !open && setChanging(null)} />
      )}
    </>
  );
}
