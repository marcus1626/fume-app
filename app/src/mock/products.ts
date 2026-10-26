// Products: what Fume knows of each (its facts, kind, specs, parts, shots and files), the catalogue with its categories
// and collections, and Import products from the website, a CSV or an unsorted zip. The Engine's "reading" of photos
// and the product page is a small table per kind (seed/productKinds.ts); an import plays its script
// (seed/productImport.ts) by the wall clock each time it is read.
import {
  FumeError,
  type FoundProduct,
  type FumeApi,
  type Id,
  type ImportJob,
  type Product,
  type ProductKind,
  type Provenance,
  type SpecEntry,
  type SpecValue,
} from "../contract";
import { isConfirmed } from "../domain/products";
import type { Mock } from "./context";
import type { ImportRun } from "./db";
import { fileReads, readGuesses } from "./seed";
import { csvFields, importScripts } from "./seed/productImport";

type Calls =
  | "product"
  | "verifyFact"
  | "correctFact"
  | "verifyProduct"
  | "addProduct"
  | "catalogue"
  | "collection"
  | "addCollection"
  | "setProductPlace"
  | "detailTokens"
  | "productKinds"
  | "readProduct"
  | "saveProductSpecs"
  | "uploadShot"
  | "uploadProductFile"
  | "productImport"
  | "startProductImport"
  | "importJob"
  | "mapImportColumns"
  | "decideFound"
  | "approveImport"
  | "dismissImport";

/** An import as the screens see it, without where its script has got to. */
const strip = (job: ImportRun): ImportJob => {
  const { step: _s, stepAt: _a, mapped: _m, ...rest } = job;
  return rest;
};

/** "200 ml" → 200 + ml; "Polishes, softens" → a list; else the words. */
function specValue(type: string | undefined, value: string): { value: SpecValue; unit?: string } {
  if (type === "number") {
    const m = /([\d.,]+)\s*([a-zA-Z]+)?/.exec(value);
    if (m) return { value: Number(m[1]!.replace(",", ".")), ...(m[2] ? { unit: m[2] } : {}) };
  }
  if (type === "list") return { value: value.split(/,\s*/).filter(Boolean) };
  return { value };
}

export function productCalls(m: Mock): Pick<FumeApi, Calls> {
  const { db, wait } = m;
  const ws = () => m.workspaceId;
  const product = (id: Id) => {
    const p = db.products.find((x) => x.id === id);
    if (!p) throw new FumeError("not_found", `No product ${id}`);
    return p;
  };
  const kind = (id: Id): ProductKind => {
    const k = db.productKinds.find((x) => x.id === id);
    if (!k) throw new FumeError("not_found", `No product kind ${id}`);
    return k;
  };
  const mine = (): Provenance => ({ origin: "customer", state: "approved", by: m.me().id, at: m.now() });
  const fieldOf = (k: ProductKind | undefined, fieldId: Id) =>
    k?.groups.flatMap((g) => g.fields).find((f) => f.id === fieldId);
  /** A product is verified once the customer has confirmed every line of it. */
  const settleProduct = (factId: Id) => {
    const p = db.products.find((x) => x.facts.some((f) => f.id === factId));
    if (p && isConfirmed(p)) p.state = "verified";
  };
  /** A label line linked to a detail token: the token says what the customer says. */
  const syncToken = (entry: SpecEntry) => {
    if (!entry.detailTokenId) return;
    const t = db.detailTokens.find((x) => x.id === entry.detailTokenId);
    if (!t || typeof entry.value !== "string") return;
    t.value = entry.value.split("\n").join(" · ");
    t.provenance = {
      ...t.provenance,
      origin: "customer",
      state: entry.provenance.state === "proposed" ? "proposed" : "approved",
      by: m.me().id,
      at: m.now(),
    };
  };

  // ── Import ──
  const job = (id: Id) => {
    const j = db.importJobs.find((x) => x.id === id);
    if (!j) throw new FumeError("not_found", `No import ${id}`);
    return j;
  };
  /** Plays the script up to now; it stops at the column mapping when the Engine is unsure of a CSV column. */
  function advance(j: ImportRun) {
    if (j.state !== "reading") return;
    const script = importScripts[j.source];
    const t = Date.now();
    while (j.step < script.steps.length) {
      const s = script.steps[j.step]!;
      j.reading = s.reading;
      j.counts = Object.entries(s.counts).map(([label, n]) => ({ label, n }));
      if (t - j.stepAt < s.ms) break;
      if (s.mapping && !j.mapped && j.columns?.some((c) => !c.sure)) {
        j.state = "mapping";
        return;
      }
      j.stepAt += s.ms;
      j.log = [...j.log, s.reading];
      j.step += 1;
    }
    const total = script.steps.reduce((a, s) => a + s.ms, 0);
    const done =
      script.steps.slice(0, j.step).reduce((a, s) => a + s.ms, 0) +
      Math.min(t - j.stepAt, script.steps[j.step]?.ms ?? 0);
    j.progress = Math.min(0.99, done / total);
    if (j.step >= script.steps.length) finish(j);
  }
  /** Compares the finds with the catalogue: a product the catalogue already holds, as found, is counted as unchanged
   *  and not shown. */
  function finish(j: ImportRun) {
    const script = importScripts[j.source];
    const brand = db.products.filter((p) => p.workspaceId === j.workspaceId);
    const named = (n: string) => brand.find((p) => p.name.toLowerCase() === n.toLowerCase());
    const found: FoundProduct[] = [];
    const unchangedNames = script.unchanged.filter((n) => named(n));
    for (const f of structuredClone(script.found)) {
      if (f.status === "new" && named(f.name)) {
        unchangedNames.push(f.name);
        continue;
      }
      if (f.status === "changed") {
        const p = brand.find((x) => x.id === f.productId);
        if (!p) continue;
        if (f.patch?.variant && p.variant === f.patch.variant) {
          unchangedNames.push(f.name);
          continue;
        }
      }
      found.push(f);
    }
    Object.assign(j, {
      state: "review",
      progress: 1,
      reading: undefined,
      found,
      unchanged: unchangedNames.length,
      unchangedNames,
      setAside: script.setAside,
    });
  }
  /** A find, approved, lands in the catalogue: a new product, or the changes to one it holds. */
  function land(j: ImportRun, f: FoundProduct): Id | undefined {
    const k = db.productKinds.find((x) => x.id === f.kindId);
    const fieldType = (id: string) => k?.groups.flatMap((g) => g.fields).find((x) => x.id === id)?.type;
    const by = m.me().id;
    const at = m.now();
    const specs: SpecEntry[] = f.fields
      .filter((x) => fieldType(x.fieldId))
      .map((x) => ({
        fieldId: x.fieldId,
        ...specValue(fieldType(x.fieldId), x.value),
        provenance:
          f.decision === "fixed"
            ? { origin: "customer", state: "approved", by, at }
            : { origin: "engine", state: "proposed", evidence: x.source ?? f.source, confidence: f.confidence },
      }));
    if (f.status === "changed") {
      const p = db.products.find((x) => x.id === f.productId);
      if (!p) return undefined;
      if (f.patch?.variant) p.variant = f.patch.variant;
      if (f.patch?.image && !p.images.includes(f.patch.image)) p.images = [f.patch.image, ...p.images];
      const keep = (p.specs ?? []).filter((s) => !specs.some((n) => n.fieldId === s.fieldId));
      p.specs = [...keep, ...specs];
      const sku = f.fields.find((x) => x.fieldId === "sku");
      if (sku && !p.sku) p.sku = sku.value;
      return p.id;
    }
    const sku = f.fields.find((x) => x.fieldId === "sku")?.value;
    const p: Product = {
      id: m.nextId("pr"),
      workspaceId: j.workspaceId,
      name: f.name,
      variant: f.variant && f.variant !== "Name not found" ? f.variant : "",
      ...(sku ? { sku } : {}),
      state: "needs_you",
      images: f.images,
      facts: [],
      ...(k ? { kindId: k.id } : {}),
      provenance: { origin: "engine", state: "approved", evidence: f.source ?? j.url ?? j.fileName, by, at },
      specs,
      shots:
        f.images[0] && k?.shots.some((s) => s.id === "front")
          ? [
              {
                slotId: "front",
                image: f.images[0],
                provenance: {
                  origin: "engine",
                  state: "proposed",
                  evidence: f.files.find((x) => x.src === f.images[0])?.name ?? f.source,
                  confidence: "medium",
                },
              },
            ]
          : [],
      parts: [],
    };
    db.products.push(p);
    return p.id;
  }

  return {
    async product(id) {
      return wait(m.find(db.products, id, "product"));
    },
    async verifyFact(factId) {
      const f = db.products.flatMap((p) => p.facts).find((x) => x.id === factId);
      if (!f) throw new FumeError("not_found", "No such fact");
      Object.assign(f, { source: "verified", confidence: "high", verifiedBy: m.userId, verifiedAt: m.now() });
      settleProduct(factId);
      return wait(f);
    },
    async correctFact(factId, statement) {
      const f = db.products.flatMap((p) => p.facts).find((x) => x.id === factId);
      if (!f) throw new FumeError("not_found", "No such fact");
      Object.assign(f, {
        statement,
        source: "verified",
        confidence: "high",
        verifiedBy: m.userId,
        verifiedAt: m.now(),
      });
      settleProduct(factId);
      return wait(f);
    },
    async verifyProduct(id) {
      const p = m.find(db.products, id, "product");
      if (p.facts.some((f) => f.source === "unknown")) throw new FumeError("invalid", "Answer every open line first.");
      p.facts.forEach((f) => Object.assign(f, { source: "verified", verifiedBy: m.userId, verifiedAt: m.now() }));
      p.state = "verified";
      return wait(p);
    },
    async addProduct(input) {
      const p = {
        id: m.nextId("pr"),
        workspaceId: m.workspaceId,
        name: input.name,
        variant: input.variant,
        state: "needs_you" as const,
        images: [],
        facts: [],
      };
      db.products.push(p);
      return wait(p);
    },

    async catalogue() {
      return wait({
        products: db.products.filter((p) => p.workspaceId === ws()),
        categories: db.categories.filter((c) => c.workspaceId === ws()),
        collections: db.collections.filter((c) => c.workspaceId === ws() && c.provenance.state !== "removed"),
      });
    },
    async collection(collectionId) {
      const collection = m.find(db.collections, collectionId, "collection");
      const products = db.products.filter((p) => collection.productIds.includes(p.id));
      const campaigns = db.campaigns.filter(
        (c) => c.collectionIds?.includes(collectionId) || c.productIds.some((id) => collection.productIds.includes(id)),
      );
      const approved = db.creatives.filter(
        (cr) => campaigns.some((c) => c.id === cr.campaignId) && ["approved", "delivered"].includes(cr.current.state),
      );
      const deliveries = db.deliveries.filter(
        (d) =>
          d.collectionId === collectionId || campaigns.some((c) => c.id === d.campaignId && d.scope !== "collection"),
      );
      return wait({ collection, products, campaigns, approved, deliveries });
    },
    async addCollection(input) {
      const c = {
        id: m.nextId("cl"),
        workspaceId: ws(),
        ...input,
        provenance: { origin: "customer" as const, state: "approved" as const, by: m.me().id, at: m.now() },
      };
      db.collections.push(c);
      for (const p of db.products.filter((x) => input.productIds.includes(x.id)))
        p.collectionIds = [...(p.collectionIds ?? []), c.id];
      return wait(c);
    },
    async setProductPlace(productId, change) {
      const p = m.find(db.products, productId, "product");
      if (change.categoryId !== undefined) p.categoryId = change.categoryId;
      if (change.collectionIds) {
        p.collectionIds = change.collectionIds;
        for (const c of db.collections) {
          const has = change.collectionIds.includes(c.id);
          c.productIds = has ? [...new Set([...c.productIds, p.id])] : c.productIds.filter((id) => id !== p.id);
        }
      }
      return wait(p);
    },
    async detailTokens(productId) {
      return wait(db.detailTokens.filter((t) => t.productId === productId));
    },

    // ── Kinds, specs, parts, shots and files ──
    async productKinds() {
      return wait(db.productKinds);
    },
    async readProduct(input) {
      const k = kind(input.kindId);
      const p: Product = {
        id: m.nextId("pr"),
        workspaceId: m.workspaceId,
        name: input.name,
        variant: input.variant,
        state: "needs_you",
        images: input.shots.map((s) => s.src).filter((s): s is string => Boolean(s)),
        facts: [],
        kindId: k.id,
        provenance: { origin: "customer", state: "approved", by: m.me().id, at: m.now() },
        specs: (readGuesses[k.id] ?? [])
          .filter((g) => fieldOf(k, g.fieldId))
          .map((g) => ({
            fieldId: g.fieldId,
            value: g.value,
            ...(g.unit ? { unit: g.unit } : {}),
            provenance: {
              origin: "engine",
              state: "proposed",
              evidence: input.url && /page/.test(g.evidence) ? input.url.replace(/^https?:\/\//, "") : g.evidence,
              confidence: "medium",
            },
          })),
        parts: k.parts.map((name) => ({
          id: m.nextId("pp"),
          name,
          provenance: {
            origin: "engine",
            state: "proposed",
            evidence: `Usual for ${k.name.toLowerCase()}`,
            confidence: "low",
          },
        })),
        shots: input.shots.filter((s) => s.src).map((s) => ({ slotId: s.slotId, image: s.src!, provenance: mine() })),
        files: [],
      };
      // The size the customer typed is the net content, when the kind has one.
      const n = /^(\d+(?:[.,]\d+)?)\s*([a-zA-Z/²]+)?/.exec(input.variant.trim());
      const net = fieldOf(k, "net") ?? fieldOf(k, "count");
      if (n && net)
        p.specs!.push({
          fieldId: net.id,
          value: Number(n[1]!.replace(",", ".")),
          ...(n[2] ? { unit: n[2] } : {}),
          provenance: mine(),
        });
      db.products.push(p);
      return wait(p);
    },
    async saveProductSpecs(productId, input) {
      const p = product(productId);
      if (input.kindId) p.kindId = kind(input.kindId).id;
      const k = p.kindId ? kind(p.kindId) : undefined;
      p.specs = p.specs ?? [];
      for (const v of input.values ?? []) {
        if (k && !fieldOf(k, v.fieldId)) throw new FumeError("invalid", `No field ${v.fieldId} on ${k.name}`);
        const old = p.specs.find((s) => s.fieldId === v.fieldId);
        const was = old && typeof old.value === "string" ? old.value : undefined;
        const entry: SpecEntry = {
          fieldId: v.fieldId,
          value: v.value,
          ...(v.unit ? { unit: v.unit } : {}),
          provenance:
            old?.provenance.origin === "engine" ? { ...mine(), state: "changed", ...(was ? { was } : {}) } : mine(),
          ...(old?.detailTokenId ? { detailTokenId: old.detailTokenId } : {}),
        };
        p.specs = p.specs.filter((s) => s.fieldId !== v.fieldId).concat(entry);
        syncToken(entry);
      }
      for (const id of input.keep ?? []) {
        const s = p.specs.find((x) => x.fieldId === id);
        if (s) {
          s.provenance = { ...s.provenance, state: "approved", by: m.me().id, at: m.now() };
          syncToken(s);
        }
      }
      if (input.remove?.length) p.specs = p.specs.filter((s) => !input.remove!.includes(s.fieldId));
      if (input.parts) {
        const before = new Map((p.parts ?? []).map((x) => [x.id, x]));
        p.parts = input.parts.map((x) => {
          const old = before.get(x.id);
          const same =
            old &&
            JSON.stringify({ ...old, provenance: undefined }) === JSON.stringify({ ...x, provenance: undefined });
          return { ...x, id: x.id || m.nextId("pp"), provenance: same && old ? old.provenance : mine() };
        });
      }
      for (const id of input.keepParts ?? []) {
        const part = p.parts?.find((x) => x.id === id);
        if (part) part.provenance = { ...part.provenance, state: "approved", by: m.me().id, at: m.now() };
      }
      for (const id of input.keepShots ?? []) {
        const shot = p.shots?.find((x) => x.slotId === id);
        if (shot) shot.provenance = { ...shot.provenance, state: "approved", by: m.me().id, at: m.now() };
      }
      return wait(p);
    },
    async uploadShot(productId, slotId, file) {
      const p = product(productId);
      const k = p.kindId ? kind(p.kindId) : undefined;
      if (k && !k.shots.some((s) => s.id === slotId)) throw new FumeError("invalid", `No shot ${slotId} on ${k.name}`);
      const image = file.src ?? p.images[0];
      if (!image) throw new FumeError("invalid", "The photo did not arrive. Try it again.");
      p.shots = (p.shots ?? []).filter((s) => s.slotId !== slotId).concat({ slotId, image, provenance: mine() });
      return wait(p);
    },
    async uploadProductFile(productId, file) {
      const p = product(productId);
      p.files = (p.files ?? []).concat({
        id: m.nextId("pf"),
        kind: file.kind,
        name: file.name,
        bytes: file.bytes,
        at: m.now(),
        by: m.me().id,
        read: fileReads[file.kind],
      });
      return wait(p);
    },

    // ── Import ──
    async productImport() {
      const brand = db.importJobs.filter((j) => j.workspaceId === m.workspaceId && j.state !== "dismissed");
      const j = brand[brand.length - 1];
      if (j) advance(j);
      return wait(j ? strip(j) : null);
    },
    async startProductImport(input) {
      for (const old of db.importJobs)
        if (old.workspaceId === m.workspaceId && old.state !== "done") old.state = "dismissed";
      const script = importScripts[input.source];
      const first = script.steps[0]!;
      const j: ImportRun = {
        id: m.nextId("imp"),
        workspaceId: m.workspaceId,
        source: input.source,
        ...(input.url ? { url: input.url.replace(/^https?:\/\//, "").replace(/\/$/, "") } : {}),
        ...(input.file ? { fileName: input.file.name } : {}),
        state: "reading",
        progress: 0,
        reading: first.reading,
        counts: Object.entries(first.counts).map(([label, n]) => ({ label, n })),
        log: [],
        ...(script.columns ? { columns: structuredClone(script.columns), fieldOptions: csvFields } : {}),
        found: [],
        unchanged: 0,
        startedAt: m.now(),
        step: 0,
        stepAt: Date.now(),
      };
      db.importJobs.push(j);
      return wait(strip(j));
    },
    async importJob(id) {
      const j = job(id);
      advance(j);
      return wait(strip(j));
    },
    async mapImportColumns(jobId, columns) {
      const j = job(jobId);
      if (j.state !== "mapping") throw new FumeError("invalid", "This import is not waiting for its columns");
      j.columns = (j.columns ?? []).map((c) => {
        const a = columns.find((x) => x.column === c.column);
        return a ? { ...c, fieldId: a.fieldId, sure: true } : { ...c, sure: true };
      });
      j.mapped = true;
      j.state = "reading";
      j.stepAt = Date.now() - (importScripts[j.source].steps[j.step]?.ms ?? 0);
      advance(j);
      return wait(strip(j));
    },
    async decideFound(jobId, foundId, d) {
      const j = job(jobId);
      if (j.state !== "review") throw new FumeError("invalid", "This import is not waiting for review");
      const i = j.found.findIndex((f) => f.id === foundId);
      const f = j.found[i];
      if (!f) throw new FumeError("not_found", `No found product ${foundId}`);
      if (d.verdict === "keep") f.decision = "kept";
      else if (d.verdict === "remove") j.found.splice(i, 1);
      else if (d.verdict === "fix") {
        if (d.name) f.name = d.name;
        if (d.variant !== undefined) f.variant = d.variant;
        if (d.kindId) Object.assign(f, { kindId: d.kindId, kindConfidence: "high" });
        for (const v of d.fields ?? []) {
          const x = f.fields.find((y) => y.fieldId === v.fieldId);
          if (x) x.value = v.value;
        }
        f.decision = "fixed";
        if (f.status === "unsure") Object.assign(f, { status: "new", confidence: "high", note: undefined });
      } else if (d.verdict === "split") {
        const pics = f.files.filter((x) => x.kind === "picture");
        if (pics.length < 2) throw new FumeError("invalid", "There is nothing to split");
        const parts: FoundProduct[] = pics.map((p, n) => ({
          ...structuredClone(f),
          id: `${f.id}-${n + 1}`,
          status: "unsure",
          name: `${f.name} ${n + 1}`,
          images: p.src ? [p.src] : [],
          files: [p],
          confidence: "low",
          note: "Split from a group: one picture. Name it, or merge it with another product.",
          decision: undefined,
        }));
        j.found.splice(i, 1, ...parts);
      } else if (d.verdict === "merge") {
        const into = j.found.find((x) => x.id === d.intoId);
        if (!into || into === f) throw new FumeError("invalid", "Pick another product to merge with");
        into.files = [...into.files, ...f.files];
        into.images = [...into.images, ...f.images.filter((s) => !into.images.includes(s))];
        for (const x of f.fields) if (!into.fields.some((y) => y.fieldId === x.fieldId)) into.fields.push(x);
        j.found.splice(j.found.indexOf(f), 1);
      }
      return wait(strip(j));
    },
    async approveImport(jobId) {
      const j = job(jobId);
      if (j.state !== "review") throw new FumeError("invalid", "This import is not waiting for review");
      const ids = j.found.map((f) => land(j, f)).filter((x): x is Id => Boolean(x));
      j.result = {
        productIds: ids,
        added: j.found.filter((f) => f.status !== "changed").length,
        updated: j.found.filter((f) => f.status === "changed").length,
      };
      Object.assign(j, { state: "done", approvedAt: m.now(), approvedBy: m.me().id });
      return wait(strip(j));
    },
    async dismissImport(jobId) {
      job(jobId).state = "dismissed";
      return wait(undefined);
    },
  };
}
