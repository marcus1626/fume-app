// The mock backend's v6 calls (round 6, PROPOSED 15 Oct 2026): product kinds (a category as a schema), a product's
// specs, parts, reference shots and files. createMockApi mixes these in. The Engine's "reading" of photos and the
// product page is a small table per kind (seed6.readGuesses).

import { FumeError, type Category, type DetailToken, type FumeApi, type Id, type Product, type ProductKind, type Provenance, type SpecEntry, type User } from "../contract";
import * as seed6 from "./seed6";

/** The v6 tables, merged into the mock's in-memory db. */
export function v6Db() {
  return structuredClone({ productKinds: seed6.productKinds });
}

type Db = ReturnType<typeof v6Db> & { products: Product[]; detailTokens: DetailToken[]; categories?: Category[] };

/** Gives LYSNE's products their kind, specs, parts, shots and files; adds the round 7 demo sweater (merchandise). */
export function upgradeV6(db: Db) {
  if (!db.products.some((p) => p.id === seed6.sweaterProduct.id)) db.products.push(structuredClone(seed6.sweaterProduct) as Product);
  if (db.categories && !db.categories.some((c) => c.id === seed6.merchCategory.id)) db.categories.push({ ...seed6.merchCategory } as Category);
  for (const p of db.products) {
    const v6 = seed6.productSpecs[p.id];
    if (!v6) continue;
    Object.assign(p, structuredClone(v6));
  }
}

export interface V6Context {
  db: Db;
  wait: <T>(value: T) => Promise<T>;
  now: () => string;
  nextId: (prefix: string) => string;
  me: () => User;
  workspaceId: () => Id;
}

type V6Keys = "productKinds" | "readProduct" | "saveProductSpecs" | "uploadShot" | "uploadProductFile";

export function v6Api(ctx: V6Context): Pick<FumeApi, V6Keys> {
  const { db, wait, now, nextId } = ctx;
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
  const mine = (): Provenance => ({ origin: "customer", state: "approved", by: ctx.me().id, at: now() });
  const fieldOf = (k: ProductKind | undefined, fieldId: Id) => k?.groups.flatMap((g) => g.fields).find((f) => f.id === fieldId);

  /** A label line linked to a detail token: the token says what the customer says. */
  function syncToken(p: Product, entry: SpecEntry) {
    if (!entry.detailTokenId) return;
    const t = db.detailTokens.find((x) => x.id === entry.detailTokenId);
    if (!t || typeof entry.value !== "string") return;
    t.value = entry.value.split("\n").join(" · ");
    t.provenance = { ...t.provenance, origin: "customer", state: entry.provenance.state === "proposed" ? "proposed" : "approved", by: ctx.me().id, at: now() };
    void p;
  }

  return {
    async productKinds() {
      return wait(db.productKinds);
    },

    async readProduct(input) {
      const k = kind(input.kindId);
      const p: Product = {
        id: nextId("pr"),
        workspaceId: ctx.workspaceId(),
        name: input.name,
        variant: input.variant,
        state: "needs_you",
        images: input.shots.map((s) => s.src).filter((s): s is string => Boolean(s)),
        facts: [],
        kindId: k.id,
        provenance: { origin: "customer", state: "approved", by: ctx.me().id, at: now() },
        specs: (seed6.readGuesses[k.id] ?? [])
          .filter((g) => fieldOf(k, g.fieldId))
          .map((g) => ({ fieldId: g.fieldId, value: g.value, ...(g.unit ? { unit: g.unit } : {}), provenance: { origin: "engine", state: "proposed", evidence: input.url && /page/.test(g.evidence) ? input.url.replace(/^https?:\/\//, "") : g.evidence, confidence: "medium" } })),
        parts: k.parts.map((name) => ({ id: nextId("pp"), name, provenance: { origin: "engine", state: "proposed", evidence: `Usual for ${k.name.toLowerCase()}`, confidence: "low" } })),
        shots: input.shots.filter((s) => s.src).map((s) => ({ slotId: s.slotId, image: s.src!, provenance: mine() })),
        files: [],
      };
      // The size the customer typed is the net content, when the kind has one.
      const n = /^(\d+(?:[.,]\d+)?)\s*([a-zA-Z/²]+)?/.exec(input.variant.trim());
      const net = fieldOf(k, "net") ?? fieldOf(k, "count");
      if (n && net) p.specs!.push({ fieldId: net.id, value: Number(n[1]!.replace(",", ".")), ...(n[2] ? { unit: n[2] } : {}), provenance: mine() });
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
          provenance: old?.provenance.origin === "engine" ? { ...mine(), state: "changed", ...(was ? { was } : {}) } : mine(),
          ...(old?.detailTokenId ? { detailTokenId: old.detailTokenId } : {}),
        };
        p.specs = p.specs.filter((s) => s.fieldId !== v.fieldId).concat(entry);
        syncToken(p, entry);
      }
      for (const id of input.keep ?? []) {
        const s = p.specs.find((x) => x.fieldId === id);
        if (s) {
          s.provenance = { ...s.provenance, state: "approved", by: ctx.me().id, at: now() };
          syncToken(p, s);
        }
      }
      if (input.remove?.length) p.specs = p.specs.filter((s) => !input.remove!.includes(s.fieldId));
      if (input.parts) {
        const before = new Map((p.parts ?? []).map((x) => [x.id, x]));
        p.parts = input.parts.map((x) => {
          const old = before.get(x.id);
          const same = old && JSON.stringify({ ...old, provenance: undefined }) === JSON.stringify({ ...x, provenance: undefined });
          return { ...x, id: x.id || nextId("pp"), provenance: same && old ? old.provenance : mine() };
        });
      }
      for (const id of input.keepParts ?? []) {
        const part = p.parts?.find((x) => x.id === id);
        if (part) part.provenance = { ...part.provenance, state: "approved", by: ctx.me().id, at: now() };
      }
      for (const id of input.keepShots ?? []) {
        const shot = p.shots?.find((x) => x.slotId === id);
        if (shot) shot.provenance = { ...shot.provenance, state: "approved", by: ctx.me().id, at: now() };
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
      p.files = (p.files ?? []).concat({ id: nextId("pf"), kind: file.kind, name: file.name, bytes: file.bytes, at: now(), by: ctx.me().id, read: seed6.fileReads[file.kind] });
      return wait(p);
    },
  };
}
