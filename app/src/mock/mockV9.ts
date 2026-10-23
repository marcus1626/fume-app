// The mock backend's v9 calls (round 7, PROPOSED 16 Oct 2026). createMockApi mixes these in after v2, so the first
// reading (startBrandScan) plays seed9's map data: the website's pages one by one, brand and products together.
// "Update the brand" reads lysne.no (or a zip) again and keeps only what is new, changed or unsure.

import {
  FumeError,
  type BrandIdentity,
  type BrandScan,
  type BrandUpdate,
  type FumeApi,
  type FumeEvent,
  type Id,
  type Provenance,
  type User,
} from "../contract";
import * as seed9 from "./seed9";

/** The v9 tables, merged into the mock's in-memory db. */
export function v9Db() {
  return { brandUpdate: null as BrandUpdate | null };
}

type Db = ReturnType<typeof v9Db> & {
  scan: BrandScan | null;
  identity: BrandIdentity;
  brandDna: { version: number; approvedAt?: string; approvedBy?: Id };
};

export interface V9Context {
  db: Db;
  wait: <T>(value: T) => Promise<T>;
  now: () => string;
  nextId: (prefix: string) => string;
  emit: (event: FumeEvent) => void;
  me: () => User;
  mustApprove: () => void;
}

type V9Keys =
  "startBrandScan" | "brandScan" | "startBrandUpdate" | "brandUpdate" | "decideBrandFound" | "approveBrandUpdate";

/** One page or file per tick: the current one is read, the next one opens; after the last, done. */
function step(sources: BrandScan["sources"]): string | undefined {
  const current = sources.find((s) => s.state === "reading");
  if (current) current.state = "read";
  const next = sources.find((s) => s.state === "waiting");
  if (!next) return undefined;
  next.state = "reading";
  return `Reading ${next.label}`;
}

export function v9Api(ctx: V9Context): Pick<FumeApi, V9Keys> {
  const { db, wait, now, nextId, emit } = ctx;

  function playScan(scan: BrandScan) {
    scan.reading = step(scan.sources);
    const timer = setInterval(() => {
      scan.reading = step(scan.sources);
      if (!scan.reading) {
        scan.state = "done";
        clearInterval(timer);
      }
      emit({ type: "scan.progress", scan: structuredClone(scan) });
    }, 1200);
    (timer as unknown as { unref?: () => void }).unref?.();
  }

  function playUpdate(update: BrandUpdate) {
    update.reading = step(update.sources);
    const timer = setInterval(() => {
      update.reading = step(update.sources);
      if (!update.reading) {
        update.state = "ready";
        clearInterval(timer);
      }
    }, 900);
    (timer as unknown as { unref?: () => void }).unref?.();
  }

  const current = (id: Id) => {
    const u = db.brandUpdate;
    if (!u || u.id !== id) throw new FumeError("not_found", `No brand update ${id}`);
    return u;
  };
  const mine = (): Provenance => ({ origin: "engine", state: "approved", by: ctx.me().id, at: now() });

  /** Keep or fix writes the find into Brand DNA as the customer's decision. */
  function apply(update: BrandUpdate, foundId: Id, value?: string) {
    const f = update.found.find((x) => x.id === foundId);
    if (!f) throw new FumeError("not_found", `No find ${foundId}`);
    const id = db.identity;
    const prov: Provenance = { ...mine(), evidence: f.source };
    if (f.kind === "image") {
      (f.images ?? (f.image ? [f.image] : [])).forEach((src, i) =>
        id.imagery.push({
          id: nextId("im"),
          image: src,
          caption: `${value ?? f.title}, ${i + 1}`,
          provenance: { ...prov },
        }),
      );
    } else if (f.kind === "colour" && f.targetId) {
      const c = id.colours.find((x) => x.id === f.targetId);
      if (c) {
        const was = c.hex;
        c.hex = value ?? f.after ?? c.hex;
        c.provenance = { ...prov, state: "changed", was };
      }
    } else if (f.kind === "typeface" && f.targetId) {
      const t = id.typefaces.find((x) => x.id === f.targetId);
      if (t) {
        const was = t.name;
        t.name = value ?? f.after ?? t.name;
        t.provenance = { ...prov, state: "changed", was };
      }
    } else if (f.kind === "voice") {
      id.voice.push({
        id: nextId("vo"),
        statement: value ?? f.after ?? f.title,
        example: (f.subtitle ?? "").replace(/^“|”$/g, ""),
        provenance: prov,
      });
    }
    f.decision = value !== undefined ? "fixed" : "kept";
  }

  return {
    async startBrandScan(input) {
      const base = structuredClone(seed9.firstScan);
      const files = (input.files ?? []).map((f, i) => ({
        id: `sf${i}`,
        label: f.name,
        kind: "file" as const,
        state: "waiting" as const,
      }));
      const pages = input.source === "upload" ? [] : base.sources;
      const sources = [...pages, ...files];
      const finds =
        input.source === "upload"
          ? base.finds.map((f, i) => ({
              ...f,
              origin: "customer" as const,
              sourceId: files[i % Math.max(1, files.length)]?.id,
              evidence: files[i % Math.max(1, files.length)]?.label ?? f.evidence,
            }))
          : base.finds;
      const scan: BrandScan = {
        ...base,
        id: nextId("scan"),
        source: input.source,
        url: input.source === "upload" ? undefined : (input.url ?? base.url),
        files: files.map((f) => f.label),
        sources: sources.length ? sources : base.sources,
        finds,
      };
      db.scan = scan;
      playScan(scan);
      return wait(structuredClone(scan));
    },
    async brandScan() {
      return wait(db.scan ? structuredClone(db.scan) : null);
    },

    async startBrandUpdate(input) {
      ctx.mustApprove();
      const base = structuredClone(seed9.update);
      const files = (input.files ?? []).map((f) => f.name);
      const update: BrandUpdate = {
        ...base,
        id: nextId("bu"),
        source: input.source,
        url: input.source === "website" ? (input.url ?? base.url) : undefined,
        files,
        sources: input.source === "website" ? base.sources : seed9.zipSources(files),
        // A zip shows the same finds, read from its files.
        found:
          input.source === "website"
            ? base.found
            : base.found.map((f) => ({ ...f, source: files[0] ?? "LYSNE autumn 2026.zip" })),
        startedAt: now(),
      };
      db.brandUpdate = update;
      playUpdate(update);
      return wait(structuredClone(update));
    },
    async brandUpdate() {
      return wait(db.brandUpdate ? structuredClone(db.brandUpdate) : null);
    },
    async decideBrandFound({ updateId, foundId, verdict, value }) {
      ctx.mustApprove();
      const update = current(updateId);
      const f = update.found.find((x) => x.id === foundId);
      if (!f) throw new FumeError("not_found", `No find ${foundId}`);
      if (f.decision) throw new FumeError("invalid", `${f.title} is already answered`);
      if (verdict === "remove") f.decision = "removed";
      else apply(update, foundId, verdict === "fix" ? value : undefined);
      if (update.found.every((x) => x.decision)) {
        update.state = "applied";
        update.appliedAt = now();
        update.appliedBy = ctx.me().id;
        db.brandDna.version += 1;
        db.brandDna.approvedAt = now();
        db.brandDna.approvedBy = ctx.me().id;
      }
      return wait(structuredClone(update));
    },
    async approveBrandUpdate(updateId) {
      ctx.mustApprove();
      const update = current(updateId);
      for (const f of update.found) if (!f.decision) apply(update, f.id);
      update.state = "applied";
      update.appliedAt = now();
      update.appliedBy = ctx.me().id;
      db.brandDna.version += 1;
      db.brandDna.approvedAt = now();
      db.brandDna.approvedBy = ctx.me().id;
      return wait(structuredClone(update));
    },
  };
}
