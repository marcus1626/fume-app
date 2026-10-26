// Products and Product Truth on the live backend: the product, its facts, and the customer's verification.
import type { FumeApi, Product, ProductFact, ProductFactArea } from "../../contract";
import type { Live } from "./context";
import { command, one, requestKey, rows, supabase } from "./supabase";

type Calls = "product" | "verifyFact" | "correctFact" | "verifyProduct" | "catalogue";

export interface FactRow {
  id: string;
  product_id: string;
  area: ProductFactArea;
  label: string;
  statement: string;
  origin: "supplied" | "inferred" | "learned" | "campaign";
  status: "unverified" | "verified" | "conflict";
  required: boolean;
  verified_by: string | null;
  verified_at: string | null;
  superseded_by: string | null;
}
interface ProductRow {
  id: string;
  workspace_id: string;
  name: string;
  variant: string;
  sku: string | null;
}

const FACT =
  "id, product_id, area, label, statement, origin, status, required, verified_by, verified_at, superseded_by";

export function toFact(f: FactRow): ProductFact {
  return {
    id: f.id,
    productId: f.product_id,
    area: f.area,
    label: f.label,
    statement: f.statement,
    source: f.status === "verified" ? "verified" : f.origin,
    confidence: f.status === "verified" ? "high" : f.status === "conflict" ? "low" : "medium",
    ...(f.verified_by ? { verifiedBy: f.verified_by } : {}),
    ...(f.verified_at ? { verifiedAt: f.verified_at } : {}),
  };
}

function toProduct(p: ProductRow, facts: FactRow[]): Product {
  const current = facts.filter((f) => f.product_id === p.id && !f.superseded_by);
  return {
    id: p.id,
    workspaceId: p.workspace_id,
    name: p.name,
    variant: p.variant,
    ...(p.sku ? { sku: p.sku } : {}),
    state: current.some((f) => f.required && f.status !== "verified") ? "needs_you" : "verified",
    images: [],
    facts: current.map(toFact),
  };
}

export async function readProducts(workspaceId: string, ids?: string[]): Promise<Product[]> {
  let products = supabase()
    .from("products")
    .select("id, workspace_id, name, variant, sku")
    .eq("workspace_id", workspaceId);
  if (ids) products = products.in("id", ids);
  const list = await rows<ProductRow>(products.order("name"));
  if (list.length === 0) return [];
  const facts = await rows<FactRow>(
    supabase()
      .from("product_facts")
      .select(FACT)
      .in(
        "product_id",
        list.map((p) => p.id),
      )
      .order("created_at"),
  );
  return list.map((p) => toProduct(p, facts));
}

export function productCalls(live: Live): Pick<FumeApi, Calls> {
  const calls: Pick<FumeApi, Calls> = {
    async product(productId) {
      const p = await one<ProductRow>(
        supabase().from("products").select("id, workspace_id, name, variant, sku").eq("id", productId).maybeSingle(),
        "product",
      );
      return (await readProducts(p.workspace_id, [p.id]))[0]!;
    },
    async verifyFact(factId) {
      return toFact(await command<FactRow>("verify_fact", { p_fact_id: factId, p_key: requestKey() }));
    },
    async correctFact(factId, statement) {
      return toFact(
        await command<FactRow>("correct_fact", { p_fact_id: factId, p_statement: statement, p_key: requestKey() }),
      );
    },
    async verifyProduct(productId) {
      const product = await calls.product(productId);
      for (const f of product.facts.filter((x) => x.source !== "verified")) await calls.verifyFact(f.id);
      return calls.product(productId);
    },
    async catalogue() {
      return { products: await readProducts(await live.workspaceId()), categories: [], collections: [] };
    },
  };
  return calls;
}
