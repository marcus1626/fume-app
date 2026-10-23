// Products (FLOWS §0 row 4, §3.1, §7 step 5): the customer's catalogue, image-led. Every product with its picture,
// variants, category and collections, its state (verified, or it needs you) and who put it in: the Engine's
// proposals from the website lie flat until someone opens the product and verifies its facts. Filter by category
// (a tree) and by collection, search by name. Under the products, the collections: a campaign can take one whole,
// and each can be its own delivery. A proposed collection gets Keep · Change · Remove.
import {
  Button,
  Icon,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  PageHeader,
  ToggleGroup,
  ToggleGroupItem,
  useToast,
} from "@fume/ui";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCatalogue, useDecide, useSession } from "../../api/hooks";
import type { Collection, Product } from "../../contract";
import * as copy from "../../copy";
import { Nothing, Page, Query, Section } from "../../shell/Page";
import { ChangeCollectionDialog, NewCollectionDialog } from "./dialogs";
import { AddProductFlow } from "./add";
import { ImportPanel, ImportProducts, ImportSourceDialog } from "./import";
import { categoryAndChildren, CollectionCard, ProductCard, useCatalogueRights } from "./parts";

const ALL = "all";
/** Needs you first, then what Fume is still reading, then verified; by name inside each. */
const order: Record<Product["state"], number> = { needs_you: 0, draft: 1, verified: 2 };

export function CataloguePage() {
  const session = useSession().data!;
  const catalogue = useCatalogue();
  const { canEdit, canDecide } = useCatalogueRights();
  const decide = useDecide();
  const toast = useToast();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [top, setTop] = useState(ALL);
  const [sub, setSub] = useState(ALL);
  const [collection, setCollection] = useState(ALL);
  const [adding, setAdding] = useState(false);
  const [csv, setCsv] = useState(false);
  const [making, setMaking] = useState(false);
  const [changing, setChanging] = useState<Collection | null>(null);

  const products = catalogue.data?.products ?? [];
  const needYou = products.filter((p) => p.state === "needs_you").length;

  function onDecide(c: Collection, verdict: "keep" | "change" | "remove") {
    if (verdict === "change") return setChanging(c);
    decide.mutate(
      { kind: "collection", id: c.id, verdict },
      {
        onSuccess: () =>
          toast.done(
            verdict === "keep" ? `${c.name} is yours now` : `${c.name} removed`,
            verdict === "remove" ? { description: "Its products stay in the catalogue." } : undefined,
          ),
        onError: (error) => toast.error("That wasn’t saved", { description: error.message }),
      },
    );
  }

  return (
    <Page title="Products">
      <PageHeader
        title="Products"
        description="Your catalogue: every product Fume makes creatives of, sorted into categories and collections. A product goes into a campaign once you have verified its facts."
        meta={
          catalogue.data
            ? [
                copy.count(products.length, "product"),
                needYou ? `${needYou} need you` : "All verified",
                session.workspace.brandName,
              ]
            : undefined
        }
        primaryAction={canEdit ? { label: "Add a product", icon: "plus", onSelect: () => setAdding(true) } : undefined}
        secondaryActions={
          canEdit ? [{ label: "New collection", icon: "layers", onSelect: () => setMaking(true) }] : undefined
        }
      />

      {canEdit && (
        <div className="ui-import-entry">
          <ImportProducts variant="secondary" size="md" />
        </div>
      )}
      {canEdit && <ImportPanel />}
      <Query query={catalogue} loading="Loading your catalogue">
        {({ products: all, categories, collections }) => {
          if (all.length === 0)
            return (
              <Nothing
                icon="package"
                title="No products yet"
                text="Add the products your campaigns are about, by hand or from a CSV. Fume reads what it can, and you verify every fact."
                action={
                  canEdit ? (
                    <Button variant="secondary" icon="plus" onClick={() => setAdding(true)}>
                      Add a product
                    </Button>
                  ) : undefined
                }
              />
            );

          const roots = categories.filter((c) => !c.parentId);
          const children = top === ALL ? [] : categories.filter((c) => c.parentId === top);
          const categoryIds = top === ALL ? null : categoryAndChildren(categories, sub !== ALL ? sub : top);
          const q = query.trim().toLowerCase();
          const shown = all
            .filter((p) => !categoryIds || (p.categoryId && categoryIds.has(p.categoryId)))
            .filter((p) => collection === ALL || p.collectionIds?.includes(collection))
            .filter(
              (p) =>
                !q ||
                `${p.name} ${p.variant} ${p.variants?.map((v) => v.name).join(" ") ?? ""}`.toLowerCase().includes(q),
            )
            .sort((a, b) => order[a.state] - order[b.state] || a.name.localeCompare(b.name));
          const filtering = Boolean(q) || top !== ALL || collection !== ALL;
          const clear = () => {
            setQuery("");
            setTop(ALL);
            setSub(ALL);
            setCollection(ALL);
          };

          return (
            <>
              <Section
                title="Catalogue"
                meta={filtering ? `${shown.length} of ${all.length}` : all.length}
                titleId="catalogue-products"
                text={
                  needYou
                    ? `${copy.count(needYou, "product")} ${needYou === 1 ? "needs" : "need"} you: open ${needYou === 1 ? "it" : "each one"} and verify its facts.`
                    : undefined
                }
              >
                <div className="ui-catalogue-filters">
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
                  <div className="ui-catalogue-filter">
                    <span className="ui-catalogue-filter-label" id="filter-category">
                      Category
                    </span>
                    <ToggleGroup
                      type="single"
                      size="sm"
                      aria-labelledby="filter-category"
                      value={top}
                      onValueChange={(v) => {
                        setTop(v || ALL);
                        setSub(ALL);
                      }}
                    >
                      <ToggleGroupItem value={ALL}>All</ToggleGroupItem>
                      {roots.map((c) => (
                        <ToggleGroupItem key={c.id} value={c.id}>
                          {c.name}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </div>
                  {children.length > 0 && (
                    <div className="ui-catalogue-filter">
                      <span className="ui-catalogue-filter-label" id="filter-subcategory">
                        In {categories.find((c) => c.id === top)?.name}
                      </span>
                      <ToggleGroup
                        type="single"
                        size="sm"
                        aria-labelledby="filter-subcategory"
                        value={sub}
                        onValueChange={(v) => setSub(v || ALL)}
                      >
                        <ToggleGroupItem value={ALL}>All</ToggleGroupItem>
                        {children.map((c) => (
                          <ToggleGroupItem key={c.id} value={c.id}>
                            {c.name}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    </div>
                  )}
                  {collections.length > 0 && (
                    <div className="ui-catalogue-filter">
                      <span className="ui-catalogue-filter-label" id="filter-collection">
                        Collection
                      </span>
                      <ToggleGroup
                        type="single"
                        size="sm"
                        aria-labelledby="filter-collection"
                        value={collection}
                        onValueChange={(v) => setCollection(v || ALL)}
                      >
                        <ToggleGroupItem value={ALL}>All</ToggleGroupItem>
                        {collections.map((c) => (
                          <ToggleGroupItem key={c.id} value={c.id}>
                            {c.name}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    </div>
                  )}
                </div>

                {shown.length === 0 ? (
                  <Nothing
                    icon="search"
                    title="No product matches"
                    text="Try another name, or show every product."
                    action={
                      <Button variant="secondary" onClick={clear}>
                        Show every product
                      </Button>
                    }
                  />
                ) : (
                  <ul className="ui-catalogue-grid" aria-label="Products">
                    {shown.map((p) => (
                      <li key={p.id}>
                        <ProductCard product={p} categories={categories} collections={collections} canEdit={canEdit} />
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section
                title="Collections"
                meta={collections.length}
                titleId="catalogue-collections"
                text="A campaign can take a collection whole; new products in it join the campaign too. Each collection can be its own delivery."
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
            onAdded={(p) => navigate(`/brand/products/${p.id}`)}
            onCsv={() => setCsv(true)}
          />
          <ImportSourceDialog source={csv ? "csv" : null} onOpenChange={setCsv} />
        </>
      )}
      {canDecide && (
        <ChangeCollectionDialog collection={changing} onOpenChange={(open) => !open && setChanging(null)} />
      )}
    </Page>
  );
}
