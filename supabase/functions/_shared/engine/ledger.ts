// The prompt's ledger: every piece of the brand's data the Engine had for one prompt, whether it went into the prompt,
// how it was checked there, and why it was left out when it was not. Built by code from the task and the compile
// package, so a person (and the prompt graph) can see that the brand and the product were in the prompt, not take it
// on trust.
import { brainImagery, brainLessons, brainNotes, brainPalette, type EngineTask, NO_BRAIN, plannedCreative, referenceCandidates, SCHEMA_LINES, schemaLines } from "./context.ts";
import { needOf, whyNot } from "./references.ts";
import type { CoverageDecision } from "./coverage.ts";
import type { CompilePackage, ManifestItem } from "./types.ts";

export type LedgerEntry = {
  /** Where it lives: a product fact's id, a Brand DNA rule's id, a brain node's id, a taste key, a lesson's id. */
  ref: string;
  source: "product_fact" | "brand_rule" | "taste" | "lesson" | "brain" | "picture" | "plan";
  what: string;
  used: boolean;
  /** verbatim: word for word, checked by code; meaning: a model checked the prompt says it; guidance: the writer read it. */
  how?: "verbatim" | "meaning" | "guidance" | "reference";
  /** Whether the check of this prompt found it there (verbatim and meaning only). */
  passed?: boolean;
  item?: string;
  why?: string;
};

const PICTURE_FACTS = ["shape", "material", "colour", "packaging", "label"];
const IMAGE_AREAS = new Set(["imagery", "colour", "layout"]);

export function buildLedger(task: EngineTask, pkg: CompilePackage, decisions: CoverageDecision[] = []): LedgerEntry[] {
  const out: LedgerEntry[] = [];
  const byRef = new Map<string, ManifestItem>();
  for (const m of pkg.manifest) byRef.set(m.refId, m);
  const passed = (item: ManifestItem | undefined) => {
    if (!item) return undefined;
    const d = decisions.filter((x) => x.kind === "coverage" && x.itemId === item.id);
    return d.length ? d.every((x) => x.passed) : undefined;
  };
  // `item` is the manifest's ref when several entries share one item (the brand's pictures, its palette).
  const inManifest = (ref: string, source: LedgerEntry["source"], what: string, notUsed: string, itemRef = ref) => {
    const item = byRef.get(itemRef);
    out.push(item
      ? { ref, source, what, used: true, how: item.check === "code" ? "verbatim" : "meaning", item: item.id, ...(passed(item) === undefined ? {} : { passed: passed(item) }) }
      : { ref, source, what, used: false, why: notUsed });
  };
  const edit = pkg.target.imageType === "picture_edit";
  const productText = pkg.lockedProductText;

  // The product: its verified facts about how it looks go in word for word; the others are not the picture's.
  for (const p of task.products) {
    for (const f of p.facts) {
      const what = `${p.name}: ${f.label}: ${f.statement}`;
      if (f.status !== "verified") out.push({ ref: f.id, source: "product_fact", what, used: false, why: "Not verified yet." });
      else if (f.area === "never") inManifest(f.id, "product_fact", what, "Not in the prompt.");
      else if (PICTURE_FACTS.includes(f.area)) {
        const inText = productText.includes(f.statement.trim().replace(/\s+/g, " ").replace(/[.!?]$/, ""));
        out.push(inText
          ? { ref: f.id, source: "product_fact", what, used: true, how: "verbatim", item: "product-text", passed: decisions.length ? decisions.some((d) => d.itemId === "product-text" && d.passed) : undefined }
          : { ref: f.id, source: "product_fact", what, used: false, why: "The product is not in this picture." });
      } else out.push({ ref: f.id, source: "product_fact", what, used: false, why: `A ${f.area} fact is for the words, not the picture.` });
    }
  }
  const pictureRef = (url: string) => url.split("?")[0].split("/").slice(-2).join("/");
  for (const r of pkg.references) out.push({ ref: pictureRef(r.url), source: "picture", what: r.role, used: true, how: "reference" });
  // The product's and the models' pictures that were not sent, and why: the wrong side, a person in a picture with none, or no room.
  const sent = new Set(pkg.references.map((r) => r.url));
  const need = needOf(plannedCreative(task));
  for (const c of referenceCandidates(task))
    if (!sent.has(c.url)) out.push({ ref: pictureRef(c.url), source: "picture", what: c.role, used: false, why: whyNot(c.card, need, c.subject, pkg.dialect.maxReferences) });

  // The Brand DNA's rules: those about pictures are in the prompt; the others shape words and layouts.
  for (const r of task.rules) {
    const what = `${r.area}: ${r.statement}`;
    if (!IMAGE_AREAS.has(r.area)) out.push({ ref: r.id, source: "brand_rule", what, used: false, why: `A ${r.area} rule is for the words and the layout, not the picture.` });
    else if (edit && r.kind === "preference") out.push({ ref: r.id, source: "brand_rule", what, used: false, why: "A change to a picture keeps its look; only hard rules are restated." });
    else inManifest(r.id, "brand_rule", what, "Not in the prompt.");
  }

  // The taste model: only what Fume is sure enough of.
  for (const t of task.taste) {
    if (t.words) {
      const ref = `taste-${t.key}`;
      if (t.do_confidence < 0.6) out.push({ ref, source: "taste", what: t.words, used: false, why: `Not sure enough yet (${Math.round(t.do_confidence * 100)} %).` });
      else inManifest(ref, "taste", t.words, edit ? "A change to a picture keeps its look." : "Only the twelve surest taste words are used.");
    }
    if (t.avoid_words) {
      const ref = `taste-${t.key}-avoid`;
      if (t.avoid_confidence < 0.6) out.push({ ref, source: "taste", what: `Avoid ${t.avoid_words}`, used: false, why: `Not sure enough yet (${Math.round(t.avoid_confidence * 100)} %).` });
      else inManifest(ref, "taste", `Avoid ${t.avoid_words}`, edit ? "A change to a picture keeps its look." : "Only the twelve surest taste words are used.");
    }
  }

  // The taste schema: every habit the photograph could carry, and whether this prompt took it.
  const taken = new Set(schemaLines(task).map((l) => l.id));
  for (const l of task.tasteDirection?.lines ?? []) {
    if (l.lever !== "prompt" && l.lever !== "reference") continue;
    const ref = `schema-${l.key}`;
    if (taken.has(ref)) inManifest(ref, "taste", l.says, edit ? "A change to a picture keeps its look." : "Not in the prompt.");
    else out.push({ ref, source: "taste", what: l.says, used: false, why: `Only the ${SCHEMA_LINES.most} weightiest habits that apply to this picture are used.` });
  }

  // The Brand Brain.
  const b = task.brain ?? NO_BRAIN;
  const imagery = new Set(brainImagery(b).slice(0, 6).map((i) => i.id));
  for (const i of b.imagery) {
    const why = !i.confirmed ? "Proposed, not confirmed by the brand." : imagery.has(i.id) ? null : "The caption says nothing about the look.";
    if (why) out.push({ ref: i.id, source: "brain", what: `Picture: ${i.what}`, used: false, why });
    else inManifest(i.id, "brain", `Picture: ${i.what}`, edit ? "A change to a picture keeps its look." : "Not in the prompt.", "brain-imagery");
  }
  const palette = new Set(brainPalette(b).map((c) => c.id));
  for (const c of b.palette) {
    const what = `Colour: ${c.name} ${c.hex}${c.role ? ` (${c.role})` : ""}`;
    const why = !c.confirmed ? "Proposed, not confirmed by the brand." : palette.has(c.id) ? null
      : ["text", "ground", "background"].includes((c.role ?? "").toLowerCase()) ? "A text or ground colour is for layouts." : "Fume is not sure of it, or three colours are already used.";
    if (why) out.push({ ref: c.id, source: "brain", what, used: false, why });
    else inManifest(c.id, "brain", what, edit ? "A change to a picture keeps its look." : "Not in the prompt.", "brain-palette");
  }
  if (b.market?.market) inManifest("market", "brain", `Market: ${b.market.market}`, edit ? "A change to a picture keeps its look." : "Not in the prompt.", "brain-market");
  const notes = new Set(brainNotes(b).slice(0, 4).map((n) => n.id));
  for (const n of b.notes) {
    const what = `${n.kind}: ${n.what}`;
    if (notes.has(n.id)) inManifest(n.id, "brain", what, edit ? "A change to a picture keeps its look." : "Not in the prompt.", `brain-${n.id}`);
    else out.push({ ref: n.id, source: "brain", what, used: false, why: n.confirmed ? "About the words or the business, not the picture." : "Proposed, not confirmed by the brand." });
  }

  // Lessons: what verdicts taught, and what the brand asked to change before. The writer reads them.
  const lessons = new Set(pkg.knowledge.lessons.map((l) => l.id));
  for (const l of task.lessons)
    out.push(lessons.has(l.id)
      ? { ref: l.id, source: "lesson", what: `${l.polarity}: ${l.statement}`, used: true, how: "guidance" }
      : { ref: l.id, source: "lesson", what: `${l.polarity}: ${l.statement}`, used: false, why: "Only the twelve newest lessons are read." });
  const fromBrain = new Set(brainLessons(b).map((l) => l.id.replace(/^brain-/, "")));
  for (const c of [...b.changes, ...b.checks]) {
    const what = `Earlier: ${c.what}`;
    out.push(fromBrain.has(c.id) && lessons.has(`brain-${c.id}`)
      ? { ref: c.id, source: "brain", what, used: true, how: "guidance" }
      : { ref: c.id, source: "brain", what, used: false, why: "Older than the newest four changes and three checks." });
  }
  for (const e of pkg.knowledge.exemplars)
    out.push({ ref: "exemplar", source: "plan", what: `An approved prompt: ${e.promptText.slice(0, 80)}…`, used: true, how: "guidance" });
  return out;
}

/** The ledger in numbers: what the Engine had, and what went in. */
export function ledgerSummary(ledger: LedgerEntry[]) {
  const by = (s: LedgerEntry["source"]) => ledger.filter((e) => e.source === s);
  const sum = (es: LedgerEntry[]) => ({ had: es.length, used: es.filter((e) => e.used).length });
  return {
    product: sum(by("product_fact")),
    rules: sum(by("brand_rule")),
    taste: sum(by("taste")),
    brain: sum(by("brain")),
    lessons: sum(by("lesson")),
    missing: ledger.filter((e) => e.used && e.passed === false).map((e) => e.ref),
  };
}
