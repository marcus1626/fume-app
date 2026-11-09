// The edge function `design` (docs/mvp/design-layer.md): the app calls it after design_candidate, and again while the
// candidate shows "Fume is designing" (a layer that never came back is taken again after four minutes). The caller's
// own token decides whether they may see the layer (design_layers is staff-only); the service role takes the work.
// The answer comes at once (202); the work goes on in the background. handler.test.ts runs it without Supabase, a
// model or the design service.
import { formatOf, keepClearOf, type LayoutChoice, layoutsOf, plannedLayout, type Review, roomOf, type Take, type Words, wordsOf } from "./layer.ts";

/** A signed link to one of the brand's own font files, with the face it holds (brand-book fontfile.ts). */
export interface FontLink {
  family: string;
  weight: number;
  italic: boolean;
  url: string;
}

type Failure = { message: string } | null;
export type Spent = { usd: number };

export interface Deps {
  canRead(layerId: string): Promise<boolean>;
  service: {
    take(layerId: string): Promise<{ data: Take | null; error: Failure }>;
    finish(layerId: string, result: Record<string, unknown>): Promise<{ error: Failure }>;
    fail(layerId: string, error: string, usd: number): Promise<{ error: Failure }>;
    /** A link to read the picture, links to store the result where design_take said, and one to read the brand's logo. */
    links(t: Take): Promise<{ picture: string; png: string; fig: string; logo?: string | null; fonts?: FontLink[] }>;
    /** The stored result, to look at it. */
    read(bucket: string, path: string): Promise<Uint8Array | null>;
    picture(t: Take): Promise<Uint8Array | null>;
  };
  choose(t: Take, words: Words, picture: Uint8Array, spent: Spent): Promise<LayoutChoice | null>;
  /** The layout of the picture's first design (or of a designer's latest ask), up its line of fixes, so a redo keeps it. */
  before?(t: Take): Promise<LayoutChoice | null>;
  review(t: Take, words: Words, png: Uint8Array, spent: Spent, set?: { cta?: string } | null): Promise<Review | null>;
  /** The design service (services/design): POST /api/design. */
  lay(request: Record<string, unknown>): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }>;
  later(work: Promise<unknown>): void;
  now(): number;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const answer = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

export async function designLayer(t: Take, d: Deps): Promise<"made" | "failed"> {
  const started = d.now();
  const spent: Spent = { usd: 0 };
  const fail = async (why: string) => {
    await d.service.fail(t.layer_id, why, spent.usd);
    return "failed" as const;
  };
  try {
    const words = wordsOf(t);
    if (!words) return await fail("The plan has no headline to set.");
    const format = formatOf(t);
    const picture = await d.service.picture(t);
    if (!picture) return await fail("The picture could not be read.");
    // A picture designed again (new words) or fixed (a small part redrawn) keeps the layout chosen before (9 Nov:
    // Dressmann's redone designs moved their words and broke "MANDAG"). A designer's own ask gets a fresh look.
    let choice: LayoutChoice | null = null;
    let kept = false;
    let keptWhy: string | null = null;
    if (!t.ask && d.before) {
      try {
        choice = await d.before(t);
        // A layout from an earlier book the brand has since replaced is not the brand's any more (Anthem, 9 Nov: the
        // new book's navy block never showed because every redo kept the old book's layout).
        const current = layoutsOf(t);
        if (choice && current.length && !current.some((l) => l.name === choice!.layout)) {
          choice = null;
          keptWhy = "the design book no longer has the earlier layout";
        }
        // A choice made before people were marked as whole figures marked only faces (Anthem v12, 9 Nov): look again.
        if (choice && !choice.people) {
          choice = null;
          keptWhy = "the earlier design did not mark the people";
        }
        kept = Boolean(choice);
        if (!choice && !keptWhy) keptWhy = "no earlier design";
      } catch (e) {
        choice = null;
        keptWhy = e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200);
      }
    }
    // The model's eye is a help, not a gate: without it the service still finds a layout that passes its checks.
    // A failed look is tried once more: without it nothing in the picture is kept clear, and the words can land on a
    // person or the product while every measured check still passes (Anthem "Two on two", 9 Nov: a headline across
    // the father's body, no keep-clear box at all).
    let blind: string | null = null;
    for (let i = 0; !choice && !kept && i < 2; i++) {
      try {
        choice = await d.choose(t, words, picture, spent);
        if (!choice) blind = "the model gave no answer";
      } catch (e) {
        choice = null;
        blind = e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200);
      }
    }
    if (choice) blind = null;
    // The layout the plan chose is the one the Engine left room for (9 Nov): the words go there. The model's eye still
    // marks what to keep clear and the colour; only an earlier design kept above, or a designer's ask, sets it apart.
    const planned = kept || t.ask ? null : plannedLayout(t);
    const plannedBand = (["top", "middle", "bottom"] as const).find((b) => b === planned?.band);
    const plannedAlign = (["left", "center", "right"] as const).find((a) => a === planned?.align);
    if (planned && choice) {
      choice = { ...choice, layout: planned.name, band: plannedBand ?? choice.band, align: plannedAlign ?? choice.align };
    }
    const links = await d.service.links(t);
    const request = {
      picture: links.picture,
      format,
      book: t.book.body,
      words,
      // Where the Engine left room for the words comes first; the model's eye places the rest.
      prefer: {
        ...(choice
          ? {
            band: choice.band,
            align: choice.align,
            colour: choice.colour,
            ...(layoutsOf(t).some((l) => l.name === choice!.layout) ? { signature: choice.layout } : {}),
          }
          : planned
          ? { ...(plannedBand ? { band: plannedBand } : {}), ...(plannedAlign ? { align: plannedAlign } : {}), signature: planned.name }
          : {}),
        ...roomOf(t),
      },
      keepClear: choice ? keepClearOf(choice, format) : [],
      ...(links.logo ? { logo: links.logo } : {}),
      ...(links.fonts?.length ? { fonts: links.fonts } : {}),
      upload: { png: links.png, fig: links.fig },
    };
    let res = await d.lay(request);
    // A slow read or a cold start is worth one more try; a refusal (4xx) is not.
    if (res.status === 500 || res.status === 504) res = await d.lay(request);
    if (!res.ok) {
      const e = res.body.error as unknown;
      const why = typeof e === "string" ? e : e && typeof e === "object" ? String((e as { message?: unknown }).message ?? JSON.stringify(e)) : "";
      return await fail(`The design service answered ${res.status}${why ? `: ${why}` : "."}`);
    }
    const out = res.body as {
      ok?: boolean; width?: number; height?: number; layout?: unknown; checks?: unknown[]; attempts?: unknown[];
      png: { bytes: number; sha256: string }; fig: { bytes: number; sha256: string };
    };
    let findings: { severity: string; what: string; by: string }[] = [];
    let verdict: string | null = null;
    let scores: { onBrand: number; craft: number | null; like: string[] } | null = null;
    try {
      const png = await d.service.read(t.store.bucket, t.store.png);
      const r = png ? await d.review(t, words, png, spent, out.layout as { cta?: string } | null) : null;
      if (r) {
        findings = r.findings.map((f) => ({ ...f, by: "fume_review" }));
        verdict = r.verdict;
        // On brand is judged against the brand's own pages and ads: what they do that this creative does not is a
        // finding the expert sees, major when the creative does not look like the brand made it.
        if (r.onBrand) {
          const weak = r.onBrand.score <= 2;
          for (const what of r.onBrand.unlike.slice(0, 4)) findings.push({ severity: weak ? "major" : "minor", what: `Not like the brand's own work: ${what}`, by: "fume_review" });
          scores = { onBrand: r.onBrand.score, craft: r.craft ?? null, like: r.onBrand.like.slice(0, 4) };
        }
      }
    } catch {
      // The expert still checks it; the layer is kept without Fume's own review.
    }
    if (!out.ok) findings.unshift({ severity: "major", what: "No layout passed every check; this is the closest one.", by: "code" });
    if (blind) {
      findings.unshift({
        severity: "major",
        what: "Fume could not read the picture, so nothing in it was kept clear: check that the words cover no person and not the product.",
        by: "code",
      });
    }
    const { error } = await d.service.finish(t.layer_id, {
      name: `${t.creative.title ?? "Creative"}, graphic design`,
      words,
      choice: { ...(choice ?? {}), verdict, ...(scores ? { review: scores } : {}), ...(kept ? { kept: true } : {}), ...(keptWhy ? { not_kept: keptWhy } : {}), ...(planned ? { planned: true } : {}), ...(blind ? { blind } : {}) },
      layout: out.layout ?? null,
      checks: out.checks ?? [],
      attempts: out.attempts ?? [],
      findings,
      ok: Boolean(out.ok),
      width: out.width ?? null,
      height: out.height ?? null,
      png: { path: t.store.png, ...out.png },
      fig: { path: t.store.fig, ...out.fig },
      llm_usd: Math.round(spent.usd * 10_000) / 10_000,
      ms: d.now() - started,
    });
    if (error) return await fail(error.message);
    return "made";
  } catch (e) {
    return await fail(e instanceof Error ? e.message : String(e));
  }
}

export async function handleDesign(req: Request, deps: (authorization: string) => Deps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return answer(400, { code: "invalid", message: "Use POST." });
  const authorization = req.headers.get("Authorization");
  if (!authorization) return answer(403, { code: "forbidden", message: "Sign in first." });
  let layerId: unknown;
  try {
    layerId = (await req.json()).layerId;
  } catch {
    // handled below
  }
  if (typeof layerId !== "string" || !/^[0-9a-f-]{36}$/i.test(layerId)) return answer(400, { code: "invalid", message: "Name the layer." });
  const d = deps(authorization);
  if (!(await d.canRead(layerId))) return answer(404, { code: "not_found", message: "No such layer." });
  const { data: take, error } = await d.service.take(layerId);
  if (error) return answer(503, { code: "unavailable", message: error.message });
  if (!take) return answer(200, { designing: false });
  d.later(designLayer(take, d));
  return answer(202, { designing: true });
}
