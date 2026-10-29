// Products and Product Truth on the live backend: the product, its facts, its pictures, and the customer's
// verification. A picture of the product is a source of kind 'packshot' with the product and its reference slot
// (20261028100000_product_pictures.sql); the newest one of a slot is the product's picture there.
import {
  FumeError,
  type FumeApi,
  type Product,
  type ProductFact,
  type ProductFactArea,
  type ReferenceShot,
} from "../../contract";
import type { Live } from "./context";
import { fileUrls, uploadFile } from "./map";
import { command, one, requestKey, rows, supabase } from "./supabase";

type Calls = "product" | "verifyFact" | "correctFact" | "verifyProduct" | "catalogue" | "uploadShot";

interface PictureRow {
  id: string;
  product_id: string;
  slot: string | null;
  file_id: string | null;
  created_by: string | null;
  created_at: string;
}

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

function toProduct(
  p: ProductRow,
  facts: FactRow[],
  pictures: { slot: string; image: string; row: PictureRow }[],
): Product {
  const current = facts.filter((f) => f.product_id === p.id && !f.superseded_by);
  // Newest first, one per slot; the front leads.
  const mine = pictures.filter((x) => x.row.product_id === p.id);
  const bySlot = new Map<string, (typeof mine)[number]>();
  for (const x of mine) if (!bySlot.has(x.slot)) bySlot.set(x.slot, x);
  const shots: ReferenceShot[] = [...bySlot.values()]
    .sort((a, b) => Number(b.slot === "front") - Number(a.slot === "front"))
    .map((x) => ({
      slotId: x.slot,
      image: x.image,
      provenance: {
        origin: "customer",
        state: "approved",
        ...(x.row.created_by ? { by: x.row.created_by } : {}),
        at: x.row.created_at,
      },
    }));
  return {
    id: p.id,
    workspaceId: p.workspace_id,
    name: p.name,
    variant: p.variant,
    ...(p.sku ? { sku: p.sku } : {}),
    state: current.some((f) => f.required && f.status !== "verified") ? "needs_you" : "verified",
    images: shots.map((x) => x.image),
    ...(shots.length ? { shots } : {}),
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
  const pictureRows = await rows<PictureRow>(
    supabase()
      .from("sources")
      .select("id, product_id, slot, file_id, created_by, created_at")
      .eq("kind", "packshot")
      .in(
        "product_id",
        list.map((p) => p.id),
      )
      .order("created_at", { ascending: false }),
  );
  const urls = await fileUrls(pictureRows.map((r) => r.file_id));
  const pictures = pictureRows.flatMap((row) => {
    const url = row.file_id && urls.get(row.file_id)?.url;
    return url ? [{ slot: row.slot ?? "front", image: url, row }] : [];
  });
  return list.map((p) => toProduct(p, facts, pictures));
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
    // A picture of the product for one reference slot, from the customer or Fume's team. It needs the file itself.
    async uploadShot(productId, slotId, file) {
      if (!file.blob) throw new FumeError("invalid", "Choose the picture again.");
      const p = await one<ProductRow>(
        supabase().from("products").select("id, workspace_id, name, variant, sku").eq("id", productId).maybeSingle(),
        "product",
      );
      let size: { width?: number; height?: number } = {};
      try {
        const bitmap = await createImageBitmap(file.blob);
        size = { width: bitmap.width, height: bitmap.height };
        bitmap.close();
      } catch {
        /* not a picture the browser reads: the size stays unknown */
      }
      const fileId = await uploadFile(p.workspace_id, file.blob, { name: file.name, purpose: "source", ...size });
      await command("add_source", {
        p_workspace_id: p.workspace_id,
        p_kind: "packshot",
        p_name: file.name,
        p_file_id: fileId,
        p_product_id: p.id,
        p_slot: slotId,
        p_key: requestKey(),
      });
      return calls.product(productId);
    },
    async catalogue() {
      return { products: await readProducts(await live.workspaceId()), categories: [], collections: [] };
    },
  };
  return calls;
}
