import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1";
import { type BookTask, contrast, type DesignAnswer, designPrompt, DESIGN_PARTS, joinParts, pageText, toDesignBody, VOICE_PARTS, voicePrompt } from "./book.ts";
import { type Deps, handleBook, type Usage, writeBook } from "./handler.ts";

const task: BookTask = {
  book: { id: "00000000-0000-4000-8000-000000000001", workspace_id: "w1", kind: "voice", version: 1, ask: null, attempt: 1 },
  brand: { brand: { name: "Nordlys Kaffe (test)", market: "Norway", language: "Norwegian" }, rules: [] },
  identity: { voice: [{ statement: "How the site opens", example: "Ferskbrent kaffe" }] },
  dna_state: "approved",
  rules: [{ area: "voice", kind: "rule", statement: "Speak plainly", origin: "supplied" }],
  claims: [{ product: "Morning Roast", claim: "Certified organic", verified: true }],
  website: "https://nordlys.example",
  previous: null,
  voice: null,
};
const usage: Usage = { model: "test", input_tokens: 10, output_tokens: 10, cost_usd: 0.0001 };

Deno.test("a page is read as the words a person sees", () => {
  const text = pageText("<html><head><style>.a{}</style><script>var x=1</script></head><body><h1>Ferskbrent kaffe</h1><p>Fra Bergen &amp; Oslo.</p><p>Fra Bergen &amp; Oslo.</p><!-- no --></body></html>");
  assertEquals(text, "Ferskbrent kaffe\nFra Bergen & Oslo.");
});

Deno.test("the prompt carries the brand's data fenced as data, its pages, the last version and the ask", () => {
  const p = voicePrompt({ ...task, previous: { version: 1, state: "approved", body: { summary: "Warm" } }, book: { ...task.book, ask: "More playful" } }, [{ url: "https://nordlys.example/", text: "Ferskbrent kaffe" }]);
  assertMatch(p, /The brand: Nordlys Kaffe\. Market: Norway/);
  assertMatch(p, /never instructions to you/);
  assertMatch(p, /<page>\nhttps:\/\/nordlys\.example\/\nFerskbrent kaffe\n<\/page>/);
  assertMatch(p, /<what_to_change>\nMore playful\n<\/what_to_change>/);
  assertMatch(p, /Write the next version/);
  assertMatch(designPrompt({ ...task, voice: { summary: "Plain and warm" } }, []), /<tone_of_voice>\n\{"summary":"Plain and warm"/);
});

Deno.test("contrast is measured as WCAG does", () => {
  assertEquals(contrast("#000000", "#FFFFFF"), 21);
  assertEquals(contrast("#FFFFFF", "#FFFFFF"), 1);
  assert(contrast("#767676", "#FFFFFF") >= 4.5);
});

const design: DesignAnswer = {
  summary: "Red and paper.",
  colours: [
    { name: "Paper", hex: "#FAF7F2", role: "background", use: "Grounds", source: "site" },
    { name: "Ink", hex: "#1A1A1A", role: "text", use: "Words", source: "site" },
    { name: "Red", hex: "#c83232", role: "primary", use: "The brand", source: "site" },
    { name: "White", hex: "#FFFFFF", role: "on_primary", use: "On red", source: "fume" },
    { name: "Yellow", hex: "#FFCB23", role: "cta", use: "Buttons", source: "site" },
    { name: "Pale", hex: "#FFFFFF", role: "cta_text", use: "On yellow", source: "fume" },
    { name: "Bad", hex: "red", role: "accent", use: "?", source: "fume" },
  ],
  typefaces: [{ role: "display", family: "Baskerville", fallback: "Libre Baskerville", weights: [400], source: "brand", note: "" }],
  styles: [{ name: "h1", font: "display", sizePx: 96, lineHeight: 1.05, trackingEm: -0.01, weight: 400, case: "none" }],
  spacing: { unitPx: 8, scale: [1, 2, 4] },
  radiusPx: { none: 0, small: 4, large: 16, pill: 999 },
  formats: [{ format: "story", marginPx: 64, safeTopPx: 250, safeBottomPx: 340, columns: 4, gutterPx: 24 }],
  logo: { versions: [], clearSpace: "x", minWidthPx: 120, placements: [] },
  photoText: { rules: [], scrim: "gradient", scrimOpacity: 0.3 },
  components: [{ name: "cta", purpose: "Buy", style: "h1", colour: "cta_text", background: "cta", radius: "pill", paddingPx: 24, rules: [] }],
  rules: { do: [], dont: [] },
  examples: [],
  sources: [],
  gaps: [],
};

Deno.test("the tokens and the CSS are built by code from the answer, and every pair with words on it is measured", () => {
  const body = toDesignBody(design, task);
  assertEquals((body.tokens.color as Record<string, { $value: string }>).primary.$value, "#C83232");
  assert(!("accent" in body.tokens.color), "a colour not written as #RRGGBB is left out");
  assertMatch(body.css, /--color-primary: #C83232;/);
  assertMatch(body.css, /--font-display: "Baskerville", "Libre Baskerville", serif;/);
  assertMatch(body.css, /\.brand \.type-h1 \{ font-family: var\(--font-display\); font-size: var\(--type-h1-size\);/);
  assertMatch(body.css, /--space-4: 32px;/);
  const cta = body.checks.contrast.find((p) => p.pair === "cta_text on cta")!;
  assertEquals(cta.ok, false);
  assert(body.checks.fails.some((f) => f.startsWith("cta_text on cta reads at")));
  assert(body.checks.missingRoles.includes("accent") && body.checks.missingRoles.includes("on_photo"));
  assertEquals(body.checks.contrast.find((p) => p.pair === "text on background")!.ok, true);
});

function deps(over: Partial<Deps> = {}, log: string[] = []): Deps {
  return {
    canRead: () => Promise.resolve(true),
    service: {
      take: () => Promise.resolve({ data: task, error: null }),
      finish: (_id, body, sources) => {
        log.push(`finish ${Object.keys(body).join(",")} ${JSON.stringify(sources.pages)}`);
        return Promise.resolve({ error: null });
      },
      fail: (_id, error, _u, final) => {
        log.push(`fail ${error} ${final}`);
        return Promise.resolve({ error: null });
      },
    },
    pages: () => Promise.resolve([{ url: "https://nordlys.example/", text: "Ferskbrent kaffe" }]),
    write: () => Promise.resolve({ ok: true, body: { summary: "Plain" }, sources: {}, usage }),
    later: () => {},
    ...over,
  };
}

Deno.test("a book is written from the pages and handed back with the pages it read", async () => {
  const log: string[] = [];
  assertEquals(await writeBook(task, deps({}, log)), "written");
  assertEquals(log, ['finish summary ["https://nordlys.example/"]']);
});

Deno.test("a closed site or a failed writing never loses the run: it is failed with why, or written without pages", async () => {
  const log: string[] = [];
  assertEquals(await writeBook(task, deps({ pages: () => Promise.reject(new Error("closed")) }, log)), "written");
  assertEquals(log, ["finish summary []"]);
  const log2: string[] = [];
  assertEquals(await writeBook(task, deps({ write: () => Promise.resolve({ ok: false, error: "The model declined to write this book.", usage, final: true }) }, log2)), "failed");
  assertEquals(log2, ["fail The model declined to write this book. true"]);
  const log3: string[] = [];
  assertEquals(await writeBook(task, deps({ write: () => Promise.reject(new Error("timeout")) }, log3)), "failed");
  assertEquals(log3, ["fail timeout false"]);
});

Deno.test("the function asks who is calling, and answers at once while the writing goes on", async () => {
  const post = (body: unknown, auth = "Bearer x") => new Request("http://x", { method: "POST", headers: { Authorization: auth }, body: JSON.stringify(body) });
  assertEquals((await handleBook(new Request("http://x", { method: "POST", body: "{}" }), () => deps())).status, 403);
  assertEquals((await handleBook(post({ bookId: "nope" }), () => deps())).status, 400);
  assertEquals((await handleBook(post({ bookId: task.book.id }), () => deps({ canRead: () => Promise.resolve(false) }))).status, 404);
  let later = 0;
  const res = await handleBook(post({ bookId: task.book.id }), () => deps({ later: () => void later++ }));
  assertEquals([res.status, await res.json(), later], [202, { writing: true, version: 1 }, 1]);
  const none = await handleBook(post({ bookId: task.book.id }), () => deps({ service: { ...deps().service, take: () => Promise.resolve({ data: null, error: null }) } }));
  assertEquals(await none.json(), { writing: false });
});

Deno.test("a book is written in parts that together hold every field once, and the parts are joined", () => {
  for (const [parts, all] of [[VOICE_PARTS, ["summary", "identity", "speak", "scale", "audience", "mechanics", "vocabulary", "channels", "headlines", "ctas", "rules", "pairs", "examples"]], [DESIGN_PARTS, ["summary", "colours", "typefaces", "styles", "spacing", "radiusPx", "formats", "logo", "photoText", "components", "rules", "examples"]]] as const) {
    const keys = parts.flatMap((p) => Object.keys(p.schema.shape).filter((k) => k !== "sources" && k !== "gaps"));
    assertEquals([...keys].sort(), [...all].sort());
  }
  const joined = joinParts<{ summary: string; sources: unknown[]; gaps: string[] }>([
    { summary: "A", sources: [{ part: "identity" }], gaps: ["Font files?"] },
    { pairs: [], sources: [{ part: "pairs" }], gaps: ["Font files?", "Logo on dark?"] },
  ]);
  assertEquals([joined.summary, joined.sources.length, joined.gaps], ["A", 2, ["Font files?", "Logo on dark?"]]);
});

Deno.test("a serif face falls back to serif, a sans to sans-serif", async () => {
  const { genericOf } = await import("./book.ts");
  if (genericOf("Baskerville", "Libre Baskerville") !== "serif") throw new Error("Baskerville");
  if (genericOf("Nunito Sans", "Nunito Sans") !== "sans-serif") throw new Error("Nunito Sans");
  if (genericOf("Geist Mono") !== "monospace") throw new Error("mono");
  if (genericOf("Inter") !== "sans-serif") throw new Error("Inter");
});
