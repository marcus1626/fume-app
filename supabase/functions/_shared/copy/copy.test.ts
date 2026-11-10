import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  charCount, checkDeck, checkFormat, deckGraph, editSignals, isVerbatim, learn, lessonsFor, lessonsPrompt, placeholders,
  readiness, slopCheck, swapTest, toBrainRows, truthCheck, type CopyContext, type CopyDeck,
} from "./index.ts";

const ctx: CopyContext = {
  brand: "SGB",
  lang: "en",
  anchors: ["SGB", "notice date", "even SGB's own", "VZ FLEX"],
  facts: [
    { id: "experts", statement: "Over 500 experts across Germany", source: "home page", verified: true, numbers: ["500"] },
    { id: "digital", statement: "100% digital documents", source: "home page", verified: true, numbers: ["100"] },
    { id: "term", statement: "Terms from 1 to 60 months", source: "tariff page", verified: true, numbers: ["1", "60"] },
  ],
  quotes: [
    { id: "wagner", speaker: "Henning Wagner", business: "Wagner Hotel zur Post", original: "Mein persönlicher SGB-Berater kümmert sich um alles.", translation: "My personal SGB advisor takes care of everything.", source: "home page" },
    { id: "riem", speaker: "Catharina Riem", original: "Der Wechsel zu SGB spart uns Arbeitszeit und bringt finanzielle Vorteile.", translation: "The switch to SGB saves us working time and brings financial benefits.", source: "home page" },
  ],
  categoryLines: [
    "Switch your business energy supplier today and save",
    "Personal contact person for your business electricity",
    "Cheap business electricity and gas, fair prices, transparent",
    "We take care of the complete switch for your business",
  ],
  forbidden: [{ pattern: "sustainab|green energy", why: "every supplier leads with sustainability" }],
  avoidWords: ["hassle"],
  noPriceOrSavings: true,
  briefText: "Make these owners want to find out what SGB would mean for them. Energy is a big cost for a restaurant.",
};

Deno.test("characters are counted as a person counts them", () => {
  assertEquals(charCount("Café"), 4);
  assertEquals(charCount("👍🏽 ok"), 4);
});

Deno.test("a line over its slot's limit is an error; over the recommended length a warning", () => {
  assertEquals(checkFormat("r", "google.rsa.headline", "This headline is far too long for search")[0].code, "too_long");
  assertEquals(checkFormat("r", "meta.headline", "A headline of thirty-one chars")[0].code, "over_recommended");
  assertEquals(checkFormat("r", "google.rsa.headline", "Your advisor calls first").length, 0);
});

Deno.test("the visible part of primary text must end on a finished thought", () => {
  const long = "The day you could leave your energy contract comes once a year and it usually lands in the middle of a busy lunch service when nobody looks at post. " + "x".repeat(40);
  assert(checkFormat("r", "meta.primary", long).some((f) => f.code === "visible_part_unfinished"));
  const ok = "Your contract renews if you miss one date. Your SGB advisor calls you before it. " + "More words follow here after the visible part.".repeat(2);
  assert(!checkFormat("r", "meta.primary", ok).some((f) => f.code === "visible_part_unfinished"));
});

Deno.test("a platform button must come from its list; a WhatsApp button is plain", () => {
  assertEquals(checkFormat("r", "meta.button", "Learn More").length, 0);
  assertEquals(checkFormat("r", "meta.button", "Call me maybe")[0].code, "not_in_fixed_list");
  assertEquals(checkFormat("r", "whatsapp.button", "Book a call!")[0].code, "not_plain");
});

Deno.test("the slop check finds the tells", () => {
  const codes = (t: string, format = "meta.primary") => slopCheck("r", t, { lang: "en", format, briefText: ctx.briefText }).map((f) => f.code);
  assert(codes("Unlock seamless energy — finally!").includes("stock_phrase"));
  assert(codes("Unlock seamless energy — finally!").includes("long_dash"));
  assert(codes("Unlock seamless energy — finally!").includes("exclamation"));
  assert(codes("Tired of high bills? Switch.").includes("invented_problem"));
  assert(codes("It's not just energy, it's a partner.").includes("contrast_cliche"));
  assert(codes("Simple, fast and transparent energy for you.").includes("abstract_triad"));
  assert(codes("Learn more", "landing.cta").includes("generic_cta"));
  assert(codes("Energy is a big cost for a restaurant", "image.hl").includes("brief_echo"));
  assertEquals(codes("Your notice date passed during lunch service."), []);
});

Deno.test("quotes are verbatim, with cuts marked [...]", () => {
  assert(isVerbatim("My personal SGB advisor takes care of everything", "My personal SGB advisor takes care of everything."));
  assert(isVerbatim("The switch to SGB saves us working time [...]", "The switch to SGB saves us working time and brings financial benefits."));
  assert(!isVerbatim("My SGB advisor handles everything", "My personal SGB advisor takes care of everything."));
});

Deno.test("the truth check: numbers, savings, quotes, superlatives, placeholders", () => {
  const codes = (t: string) => truthCheck("r", t, ctx).map((f) => f.code);
  assertEquals(codes("Over 500 experts. 100% digital."), []);
  assert(codes("Over 600 experts.").includes("unbacked_number"));
  assert(codes("Save on your energy bill.").includes("price_or_saving"));
  assert(codes("From 99 € a month.").includes("price_or_saving"));
  // A customer may say it; the brand may not.
  assertEquals(codes(`"The switch to SGB saves us working time and brings financial benefits." Catharina Riem`), []);
  assert(codes(`"The switch to SGB saves us a lot of money and time." Catharina Riem`).includes("quote_not_verbatim"));
  assert(codes("The best supplier in Germany.").includes("unproven_superlative"));
  assert(codes("Sustainable power for hotels.").includes("forbidden"));
  assertEquals(placeholders("We call back within [callback time]."), ["callback time"]);
  assert(codes("We call back within [callback time].").includes("placeholder"));
  assert(!codes("We call back within [callback time].").includes("unbacked_number"));
});

Deno.test("the swap test: anchored, generic or open", () => {
  assertEquals(swapTest("Your advisor calls before every notice date, even SGB's own.", ctx).verdict, "anchored");
  assertEquals(swapTest("Switch your business energy supplier today", ctx).verdict, "generic");
  assertEquals(swapTest("The lunch rush ate your exit.", ctx).verdict, "open");
  assertEquals(swapTest(`"My personal SGB advisor takes care of everything."`, { ...ctx, anchors: [] }).verdict, "anchored");
});

const deck: CopyDeck = {
  brand: "SGB",
  pieces: [
    {
      id: "trackB/cellA", fields: [
        { ref: "trackB/cellA/hl", format: "image.hl", text: "Leave on time. Even us.", group: "trackB" },
        { ref: "trackB/cellA/cta", format: "landing.cta", text: "Get your callback" },
      ],
    },
    {
      id: "trackB/cellE", fields: [
        { ref: "trackB/cellE/hl", format: "image.hl", text: "Leave on time, even us.", group: "trackB" },
        { ref: "trackB/cellE/sl", format: "image.sl", text: "Switch your business energy supplier today" },
      ],
    },
    {
      id: "search", fields: [
        { ref: "search/h1", format: "google.rsa.headline", text: "Your Advisor Calls First" },
        { ref: "search/h2", format: "google.rsa.headline", text: "Your Advisor Calls You First" },
      ],
    },
  ],
};

Deno.test("the deck check: groups stay the same, near-duplicate search headlines, swap failures by piece", () => {
  const r = checkDeck(deck, ctx);
  assert(r.findings.some((f) => f.code === "group_differs" && f.ref === "trackB/cellE/hl"));
  assert(r.findings.some((f) => f.code === "near_duplicate" && f.ref === "search/h2"));
  assert(r.swapFailures.includes("trackB/cellE"));
  assert(!r.clean);
});

Deno.test("the copy graph: lines cite facts and quotes; rows fit the Brand Brain", () => {
  const d: CopyDeck = { brand: "SGB", pieces: [{ id: "p", fields: [{ ref: "p/1", format: "landing.sl", text: `Over 500 experts. "My personal SGB advisor takes care of everything."` }] }] };
  const g = deckGraph(d, ctx);
  assert(g.edges.some((e) => e.from === "line:p/1" && e.to === "fact:experts" && e.kind === "cites"));
  assert(g.edges.some((e) => e.from === "line:p/1" && e.to === "quote:wagner"));
  const rows = toBrainRows(g);
  assert(rows.nodes.every((n) => ["market", "rules", "memory"].includes(n.layer)));
  assert(rows.edges.every((e) => ["about", "uses", "for", "from", "part_of", "related"].includes(e.kind)));
  assert(!readiness(g).ready);
  assert(readiness(g).missing.some((m) => m.includes("insight")));
});

Deno.test("learning from edits: two experts cutting the same word makes an active lesson", () => {
  const fb = (before: string, after: string, by: string) => ({ ref: "x", format: "image.hl", brand: "SGB", before, after, by, at: "2026-11-10" });
  assert(editSignals("We unlock savings — fast!", "Your advisor calls first.").some((s) => s.rule.type === "no_long_dash"));
  const lessons = learn([
    fb("Seamless switching for hotels", "Switching, done by your advisor", "anna"),
    fb("A seamless switch, finally", "The switch is done for you", "tore"),
  ]);
  const seamless = lessons.find((l) => l.key === "avoid_word:seamless")!;
  assertEquals(seamless.support, 2);
  assertEquals(seamless.state, "active");
  const picked = lessonsFor(lessons, "SGB", "image.hl");
  assert(picked.some((l) => l.key === "avoid_word:seamless"));
  assert(lessonsPrompt(picked).includes(`Do not use "seamless"`));
  // A "yes" on a line that uses the word counts against the lesson.
  const after = learn([{ ref: "y", format: "image.hl", brand: "SGB", before: "Seamless, and you never lift a pen", verdict: "yes", by: "maja", at: "2026-11-10" }], lessons);
  assert(after.find((l) => l.key === "avoid_word:seamless")!.confidence < seamless.confidence);
});
