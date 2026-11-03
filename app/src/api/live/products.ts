// Products and Product Truth on the live backend: the product, its facts, its pictures, and the customer's
// verification. A picture of the product is a source of kind 'packshot' with the product and its reference slot
// (20261028100000_product_pictures.sql); the newest one of a slot is the product's picture there.
import { FunctionsHttpError } from "@supabase/supabase-js";
import {
  FumeError,
  type FumeApi,
  type FumeErrorCode,
  type ImportJob,
  type Product,
  type SpecEntry,
  type ProductFact,
  type ProductFactArea,
  type ReferenceShot,
} from "../../contract";
import type { Live } from "./context";
import { fileUrls, uploadFile } from "./map";
import { command, one, requestKey, rows, supabase } from "./supabase";

type Calls =
  | "product"
  | "verifyFact"
  | "correctFact"
  | "verifyProduct"
  | "catalogue"
  | "uploadShot"
  | "addProduct"
  | "productKinds"
  | "readProduct"
  | "saveProductSpecs"
  | "productImport"
  | "startProductImport"
  | "importJob"
  | "mapImportColumns"
  | "decideFound"
  | "approveImport"
  | "dismissImport";

interface PictureRow {
  id: string;
  product_id: string;
  slot: string | null;
  file_id: string | null;
  url: string | null;
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
  kind_id: string | null;
  specs: SpecEntry[] | null;
  verified_at: string | null;
}
const PRODUCT = "id, workspace_id, name, variant, sku, kind_id, specs, verified_at";

interface ImportRow {
  id: string;
  workspace_id: string;
  source: ImportJob["source"];
  url: string | null;
  file_name: string | null;
  state: "review" | "done" | "dismissed";
  found: ImportJob["found"];
  unchanged: number;
  unchanged_names: string[];
  counts: ImportJob["counts"];
  log: string[];
  result: ImportJob["result"] | null;
  created_at: string;
  approved_by: string | null;
  approved_at: string | null;
}
const toImport = (r: ImportRow): ImportJob => ({
  id: r.id,
  workspaceId: r.workspace_id,
  source: r.source,
  ...(r.url ? { url: r.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") } : {}),
  ...(r.file_name ? { fileName: r.file_name } : {}),
  state: r.state,
  progress: 1,
  counts: r.counts ?? [],
  log: r.log ?? [],
  found: r.found ?? [],
  unchanged: r.unchanged,
  ...(r.unchanged_names?.length ? { unchangedNames: r.unchanged_names } : {}),
  ...(r.result ? { result: r.result } : {}),
  startedAt: r.created_at,
  ...(r.approved_at ? { approvedAt: r.approved_at } : {}),
  ...(r.approved_by ? { approvedBy: r.approved_by } : {}),
});

async function importCall(body: Record<string, unknown>): Promise<ImportRow> {
  const { data, error } = await supabase().functions.invoke<{ import: ImportRow }>("product-import", { body });
  if (error) {
    const said: { code?: FumeErrorCode; message?: string } =
      error instanceof FunctionsHttpError ? await error.context.json().catch(() => ({})) : {};
    throw new FumeError(said.code ?? "unavailable", said.message ?? "Fume could not read the shop just now.");
  }
  return data!.import;
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
    ...(p.kind_id ? { kindId: p.kind_id } : {}),
    ...(p.specs?.length ? { specs: p.specs } : {}),
    // A product with no facts yet (read from the website, or added by hand) waits until the brand confirms it.
    state:
      current.some((f) => f.required && f.status !== "verified") || (current.length === 0 && !p.verified_at)
        ? "needs_you"
        : "verified",
    images: shots.map((x) => x.image),
    ...(shots.length ? { shots } : {}),
    facts: current.map(toFact),
  };
}

export async function readProducts(workspaceId: string, ids?: string[]): Promise<Product[]> {
  let products = supabase().from("products").select(PRODUCT).eq("workspace_id", workspaceId);
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
      .select("id, product_id, slot, file_id, url, created_by, created_at")
      .eq("kind", "packshot")
      .in(
        "product_id",
        list.map((p) => p.id),
      )
      .order("created_at", { ascending: false }),
  );
  const urls = await fileUrls(pictureRows.map((r) => r.file_id));
  const pictures = pictureRows.flatMap((row) => {
    // An upload, or a picture on the brand's website (an import).
    const url = row.file_id ? urls.get(row.file_id)?.url : row.url;
    return url ? [{ slot: row.slot ?? "front", image: url, row }] : [];
  });
  return list.map((p) => toProduct(p, facts, pictures));
}

export function productCalls(live: Live): Pick<FumeApi, Calls> {
  const calls: Pick<FumeApi, Calls> = {
    async product(productId) {
      const p = await one<ProductRow>(
        supabase().from("products").select(PRODUCT).eq("id", productId).maybeSingle(),
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
      await command("verify_product", { p_product_id: productId });
      return calls.product(productId);
    },
    // A picture of the product for one reference slot, from the customer or Fume's team. It needs the file itself.
    async uploadShot(productId, slotId, file) {
      if (!file.blob) throw new FumeError("invalid", "Choose the picture again.");
      const p = await one<ProductRow>(
        supabase().from("products").select(PRODUCT).eq("id", productId).maybeSingle(),
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
    async addProduct({ name, variant, url }) {
      const row = await command<ProductRow>("add_product", {
        p_workspace_id: await live.workspaceId(),
        p_name: name,
        p_variant: variant,
        p_url: url ?? null,
        p_key: requestKey(),
      });
      return calls.product(row.id);
    },
    // The category templates are Fume's own, the same for every brand.
    async productKinds() {
      return (await import("../../mock/seed/productKinds")).productKinds;
    },
    // Add one product of a kind with its photos. Reading the specs from the photos and the page comes with the
    // Engine; until then she fills in what Fume needs.
    async readProduct({ kindId, name, variant, url, shots }) {
      const row = await command<ProductRow>("add_product", {
        p_workspace_id: await live.workspaceId(),
        p_name: name,
        p_variant: variant,
        p_url: url ?? null,
        p_key: requestKey(),
        p_kind_id: kindId,
      });
      for (const shot of shots) {
        if (!shot.src) continue;
        const blob = await fetch(shot.src)
          .then((r) => r.blob())
          .catch(() => undefined);
        if (blob) await calls.uploadShot(row.id, shot.slotId, { name: shot.name, bytes: shot.bytes, blob });
      }
      return calls.product(row.id);
    },
    async saveProductSpecs(productId, { kindId, values, keep, remove }) {
      await command("save_product_specs", {
        p_product_id: productId,
        p_kind_id: kindId ?? null,
        p_values: values ?? [],
        p_keep: keep ?? [],
        p_remove: remove ?? [],
      });
      return calls.product(productId);
    },
    async productImport() {
      const found = await rows<ImportRow>(
        supabase()
          .from("product_imports")
          .select("*")
          .eq("workspace_id", await live.workspaceId())
          .neq("state", "dismissed")
          .order("created_at", { ascending: false })
          .limit(1),
      );
      return found[0] ? toImport(found[0]) : null;
    },
    async startProductImport({ source, url }) {
      if (source !== "website" || !url)
        throw new FumeError(
          "unavailable",
          "Reading a CSV or a zip comes soon. Import from the website, or add the products one by one.",
        );
      return toImport(await importCall({ workspaceId: await live.workspaceId(), url }));
    },
    async importJob(id) {
      return toImport(
        await one<ImportRow>(supabase().from("product_imports").select("*").eq("id", id).maybeSingle(), "import"),
      );
    },
    async mapImportColumns() {
      throw new FumeError("unavailable", "Reading a CSV comes soon.");
    },
    async decideFound(jobId, foundId, decision) {
      return toImport(
        await command<ImportRow>("decide_found", { p_import_id: jobId, p_found_id: foundId, p_decision: decision }),
      );
    },
    async approveImport(jobId) {
      return toImport(await command<ImportRow>("approve_import", { p_import_id: jobId }));
    },
    async dismissImport(jobId) {
      await command("dismiss_import", { p_import_id: jobId });
    },
  };
  return calls;
}
