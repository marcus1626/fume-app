// The mock backend's v8 calls (round 7, PROPOSED 16 Oct 2026, worker W): Import products from the website, a CSV or
// an unsorted zip. createMockApi mixes these in. A job plays its script (seed8.ts) by the wall clock each time it is
// read, stops at the column mapping when the Engine is unsure of a CSV column, then compares what it found with the
// catalogue: a product the catalogue already holds, as found, is counted as unchanged and not shown.
import { FumeError, type FoundProduct, type ImportJob, type Product, type ProductKind, type SpecEntry, type SpecValue, type User, type Id, type ProductImportApi } from "../contract";
import { csvFields, importScripts } from "./seed8";

export function v8Db() {
  return { importJobs: [] as (ImportJob & { step: number; stepAt: number; mapped?: boolean })[] };
}

type Job = ReturnType<typeof v8Db>["importJobs"][number];
type Db = ReturnType<typeof v8Db> & { products: Product[]; productKinds: ProductKind[] };

export interface V8Context {
  db: Db;
  wait: <T>(value: T) => Promise<T>;
  now: () => string;
  nextId: (prefix: string) => string;
  me: () => User;
  workspaceId: () => Id;
}

const strip = (job: Job): ImportJob => {
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
  if (type === "colour" || type === "dimensions") return { value };
  return { value };
}

export function v8Api(ctx: V8Context): ProductImportApi {
  const { db, wait, now, nextId } = ctx;
  const job = (id: Id) => {
    const j = db.importJobs.find((x) => x.id === id);
    if (!j) throw new FumeError("not_found", `No import ${id}`);
    return j;
  };

  /** Plays the script up to now. */
  function advance(j: Job) {
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
    const done = script.steps.slice(0, j.step).reduce((a, s) => a + s.ms, 0) + Math.min(t - j.stepAt, script.steps[j.step]?.ms ?? 0);
    j.progress = Math.min(0.99, done / total);
    if (j.step >= script.steps.length) finish(j);
  }

  /** Compares the finds with the catalogue. */
  function finish(j: Job) {
    const script = importScripts[j.source];
    const mine = db.products.filter((p) => p.workspaceId === j.workspaceId);
    const named = (n: string) => mine.find((p) => p.name.toLowerCase() === n.toLowerCase());
    const found: FoundProduct[] = [];
    const unchangedNames = script.unchanged.filter((n) => named(n));
    for (const f of structuredClone(script.found)) {
      if (f.status === "new" && named(f.name)) {
        unchangedNames.push(f.name);
        continue;
      }
      if (f.status === "changed") {
        const p = mine.find((x) => x.id === f.productId);
        if (!p) continue;
        if (f.patch?.variant && p.variant === f.patch.variant) {
          unchangedNames.push(f.name);
          continue;
        }
      }
      found.push(f);
    }
    Object.assign(j, { state: "review", progress: 1, reading: undefined, found, unchanged: unchangedNames.length, unchangedNames, setAside: script.setAside });
  }

  function land(j: Job, f: FoundProduct): Id | undefined {
    const kind = db.productKinds.find((k) => k.id === f.kindId);
    const fieldType = (id: string) => kind?.groups.flatMap((g) => g.fields).find((x) => x.id === id)?.type;
    const by = ctx.me().id;
    const at = now();
    const specs: SpecEntry[] = f.fields
      .filter((x) => fieldType(x.fieldId))
      .map((x) => ({
        fieldId: x.fieldId,
        ...specValue(fieldType(x.fieldId), x.value),
        provenance: f.decision === "fixed" ? { origin: "customer", state: "approved", by, at } : { origin: "engine", state: "proposed", evidence: x.source ?? f.source, confidence: f.confidence },
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
      id: nextId("pr"),
      workspaceId: j.workspaceId,
      name: f.name,
      variant: f.variant && f.variant !== "Name not found" ? f.variant : "",
      ...(sku ? { sku } : {}),
      state: "needs_you",
      images: f.images,
      facts: [],
      ...(kind ? { kindId: kind.id } : {}),
      provenance: { origin: "engine", state: "approved", evidence: f.source ?? j.url ?? j.fileName, by, at },
      specs,
      shots: f.images[0] && kind?.shots.some((s) => s.id === "front") ? [{ slotId: "front", image: f.images[0], provenance: { origin: "engine", state: "proposed", evidence: f.files.find((x) => x.src === f.images[0])?.name ?? f.source, confidence: "medium" } }] : [],
      parts: [],
    };
    db.products.push(p);
    return p.id;
  }

  return {
    async productImport() {
      const mine = db.importJobs.filter((j) => j.workspaceId === ctx.workspaceId() && j.state !== "dismissed");
      const j = mine[mine.length - 1];
      if (j) advance(j);
      return wait(j ? strip(j) : null);
    },

    async startProductImport(input) {
      for (const old of db.importJobs) if (old.workspaceId === ctx.workspaceId() && old.state !== "done") old.state = "dismissed";
      const script = importScripts[input.source];
      const first = script.steps[0]!;
      const j: Job = {
        id: nextId("imp"),
        workspaceId: ctx.workspaceId(),
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
        startedAt: now(),
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
      j.result = { productIds: ids, added: j.found.filter((f) => f.status !== "changed").length, updated: j.found.filter((f) => f.status === "changed").length };
      Object.assign(j, { state: "done", approvedAt: now(), approvedBy: ctx.me().id });
      return wait(strip(j));
    },

    async dismissImport(jobId) {
      job(jobId).state = "dismissed";
      return wait(undefined);
    },
  };
}
