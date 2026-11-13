// FLOWS §38. Each completed photograph is checkpointed; clips stay with the video editor.
import type { ModelCall } from "../_shared/engine/types.ts";

export type Read = {
  sort: "pick" | "rest" | "out";
  why: string;
  sharp: boolean;
  look?: number;
  productId?: string;
  productName?: string;
  like?: string;
};
export type Source = { bucket?: string; path?: string; url?: string };
export type Picture = {
  id: string;
  number: number;
  kind: "photo" | "clip";
  bucket: string;
  path: string;
  contentType?: string;
  sha256?: string;
  capturedAt?: string;
};
export type Input = {
  id: string;
  workspaceId: string;
  state: string;
  rights: { people: string; consentYes: boolean; until: string | null };
  pictures: Picture[];
  look: unknown;
  products: {
    id: string;
    name: string;
    facts: unknown;
    campaignIds: string[];
    pictures: Source[];
  }[];
};
export type Entry = {
  id: string;
  read: Read;
  quality: number;
  // Missing on older, already completed checkpoints.
  comparison?: { ids: string[]; next: number; done: boolean };
};
export const LIMITS = { calls: 200, spendUsd: 2, reserveUsd: 0.02, representatives: 3, timeMs: 100_000 } as const;
export interface Deps {
  canRead(id: string): Promise<boolean>;
  input(id: string): Promise<Input | null>;
  take(id: string): Promise<{ token: string; entries: Entry[] } | null>;
  budget(): Promise<boolean>;
  reserve(id: string, token: string): Promise<boolean>;
  stop(id: string, token: string, entries: Entry[]): Promise<void>;
  now?: () => number;
  sign(p: Source): Promise<string>;
  assess(
    input: Input,
    url: string,
    products: { id: string; urls: string[] }[],
  ): Promise<{ read: Read; quality: number; call: ModelCall }>;
  compare(
    url: string,
    others: { id: string; url: string }[],
  ): Promise<{ like: string | null; why: string; call: ModelCall }>;
  cost(id: string, token: string, call: ModelCall, error?: string): Promise<void>;
  save(id: string, token: string, entries: Entry[], done: boolean): Promise<boolean>;
  release(id: string, token: string): Promise<void>;
  later(work: Promise<unknown>): void;
}
const viewable = (p: Picture) =>
  !p.contentType || ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(p.contentType);
const blocked = (i: Input) =>
  i.rights.people === "unsure" ||
  (i.rights.people === "released" && !i.rights.consentYes) ||
  Boolean(i.rights.until && i.rights.until < new Date().toISOString().slice(0, 10));

/** Paid stages are saved before testing any pause condition or starting another call. */
export async function readShoot(id: string, token: string, initial: Entry[], d: Deps): Promise<void> {
  let entries = structuredClone(initial);
  const now = d.now ?? Date.now,
    started = now();
  const checkpoint = async () => {
    if (!(await d.save(id, token, entries, false))) throw new Error("Checkpoint refused.");
  };
  async function ask<T extends { call: ModelCall }>(f: (fresh: Input) => Promise<T>): Promise<T> {
    if (now() - started >= LIMITS.timeMs) throw new Error("Reading paused.");
    const fresh = await d.input(id);
    if (!fresh || blocked(fresh) || !(await d.budget())) throw new Error("Reading paused.");
    if (!(await d.reserve(id, token))) {
      await d.stop(id, token, entries);
      throw new Error("Partly read: the shoot's call or spend limit was reached.");
    }
    let out: T;
    try {
      out = await f(fresh);
    } catch (e) {
      const err = e as Error & { call?: ModelCall };
      if (err.call) await d.cost(id, token, err.call, err.message);
      throw e;
    }
    await d.cost(id, token, out.call);
    return out;
  }
  try {
    const input = await d.input(id);
    if (!input || blocked(input)) return;
    const pictures = [...input.pictures].sort((a, b) => a.number - b.number);
    for (const p of pictures) {
      let entry = entries.find((e) => e.id === p.id);
      if (entry && (!entry.comparison || entry.comparison.done)) continue;
      if (now() - started >= LIMITS.timeMs) return;
      if (!entry) {
        if (p.kind === "clip" || !viewable(p)) {
          entry = {
            id: p.id,
            quality: 0,
            read: {
              sort: "rest",
              sharp: false,
              why:
                p.kind === "clip"
                  ? "Kept for the video editor."
                  : "Kept for an expert: this original needs a viewable JPEG, PNG or WebP preview before vision can read it.",
            },
          };
        } else {
          // Cheap exact-hash grouping before any model work. Reuse only completed reads.
          const duplicate =
            p.sha256 &&
            entries.find(
              (e) =>
                (!e.comparison || e.comparison.done) &&
                pictures.some((q) => q.id === e.id && q.kind === "photo" && viewable(q) && q.sha256 === p.sha256),
            );
          if (duplicate) {
            const winner = entries.find((e) => e.id === duplicate.read.like) ?? duplicate;
            entry = {
              id: p.id,
              quality: duplicate.quality,
              read: {
                ...duplicate.read,
                sort: "out",
                like: winner.id,
                why: "Exact copy of another photograph in this shoot.",
              },
            };
          } else {
            const assessed = await ask(async (fresh) => {
              // Never cache signed product references across calls: SQL filters current reference-shoot rights.
              const context = { ...fresh, products: fresh.products.slice(0, 4) };
              const products = await Promise.all(
                context.products.map(async (product) => ({
                  id: product.id,
                  urls: (
                    await Promise.all(product.pictures.slice(0, 2).map((source) => d.sign(source).catch(() => null)))
                  ).filter((url): url is string => url !== null),
                })),
              );
              const current = fresh.pictures.find((q) => q.id === p.id);
              if (!current) throw new Error("Picture unavailable.");
              const preview = await d.sign(current);
              if (now() - started >= LIMITS.timeMs) throw new Error("Reading paused.");
              return { ...(await d.assess(context, preview, products)), context };
            });
            const read = assessed.read;
            if (
              !["pick", "rest", "out"].includes(read.sort) ||
              typeof read.sharp !== "boolean" ||
              !read.why?.trim() ||
              !Number.isFinite(assessed.quality) ||
              assessed.quality < 0 ||
              assessed.quality > 100 ||
              (read.look !== undefined && (!Number.isFinite(read.look) || read.look < 0 || read.look > 100))
            )
              throw new Error("Invalid picture assessment.");
            delete read.like;
            if (!assessed.context.look) delete read.look;
            const product = assessed.context.products.find((product) => product.id === read.productId);
            if (product) read.productName = product.name;
            else {
              delete read.productId;
              delete read.productName;
            }
            // Capture-time neighbours when supplied; upload order is the deterministic fallback.
            const distance = (q: Picture) =>
              p.capturedAt && q.capturedAt
                ? Math.abs(Date.parse(p.capturedAt) - Date.parse(q.capturedAt))
                : Math.abs(p.number - q.number);
            const reps = entries
              .filter((e) => !e.read.like && pictures.some((q) => q.id === e.id && q.kind === "photo" && viewable(q)))
              .sort(
                (a, b) =>
                  distance(pictures.find((q) => q.id === a.id)!) - distance(pictures.find((q) => q.id === b.id)!),
              )
              .slice(0, LIMITS.representatives)
              .map((e) => e.id);
            entry = {
              id: p.id,
              read,
              quality: assessed.quality,
              comparison: { ids: reps, next: 0, done: reps.length === 0 },
            };
          }
        }
        entries.push(entry);
        await checkpoint(); // assessment is durable even if the next call cannot start
      }
      const progress = entry.comparison;
      if (progress && !progress.done) {
        // One comparison per representative, with a durable position after each paid answer.
        while (progress.next < progress.ids.length) {
          const otherId = progress.ids[progress.next];
          const match = await ask(async (fresh) => {
            const current = fresh.pictures.find((q) => q.id === p.id),
              other = fresh.pictures.find((q) => q.id === otherId);
            if (!current || !other) throw new Error("Picture unavailable.");
            const preview = await d.sign(current),
              otherPreview = await d.sign(other);
            if (now() - started >= LIMITS.timeMs) throw new Error("Reading paused.");
            return d.compare(preview, [{ id: other.id, url: otherPreview }]);
          });
          progress.next++;
          if (progress.next === progress.ids.length) progress.done = true;
          if (match.like && (match.like !== otherId || !match.why.trim())) {
            await checkpoint();
            throw new Error("Invalid near-duplicate group.");
          }
          if (match.like) {
            const previous = entries.find((e) => e.id === otherId)!;
            const better =
              (entry.read.sort !== "out" && previous.read.sort === "out") ||
              ((entry.read.sort === "out") === (previous.read.sort === "out") && entry.quality > previous.quality);
            const winner = better ? entry : previous,
              loser = better ? previous : entry;
            entries = entries.map((e) => {
              if (e.read.like === loser.id) e.read = { ...e.read, like: winner.id };
              return e;
            });
            loser.read = {
              ...loser.read,
              sort: "out",
              like: winner.id,
              why: `Near copy of ${pictures.find((q) => q.id === winner.id)!.number}: ${match.why}. Kept the stronger picture: ${winner.read.why}`.slice(
                0,
                1000,
              ),
            };
            progress.done = true;
          }
          if (progress.next === progress.ids.length) progress.done = true;
          await checkpoint();
          if (progress.done) break;
        }
      }
    }
    await d.save(id, token, entries, true);
  } catch (e) {
    console.error("shoot-read paused", e instanceof Error ? e.message : "Reading failed.");
  } finally {
    await d.release(id, token);
  }
}

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Content-Type": "application/json",
};
const answer = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
export async function handleShootRead(req: Request, d: Deps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return answer(405, { code: "invalid", message: "Use POST." });
  let id: unknown;
  try {
    id = (await req.json()).shootId;
  } catch {
    /* validated below */
  }
  if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    return answer(400, { code: "invalid", message: "Name the shoot." });
  try {
    if (!(await d.canRead(id))) return answer(404, { code: "not_found", message: "No such shoot." });
    const input = await d.input(id);
    if (!input) return answer(404, { code: "not_found", message: "No such shoot." });
    if (blocked(input))
      return answer(409, { code: "invalid", message: "Settle the shoot's rights before reading it." });
    if (input.state !== "reading") return answer(200, { reading: false });
    if (!(await d.budget()))
      return answer(429, { code: "unavailable", message: "This week's language model budget is used up." });
    const take = await d.take(id);
    if (!take) return answer(200, { reading: false });
    d.later(readShoot(id, take.token, take.entries, d));
    return answer(202, { reading: true });
  } catch {
    return answer(503, { code: "unavailable", message: "The shoot could not be read. Try again." });
  }
}
