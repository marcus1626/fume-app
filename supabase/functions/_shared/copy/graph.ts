// The copy graph: what copy stands on, as nodes and edges in the Brand Brain. A line is not a string; it is a promise
// that an insight grounds, a proof backs and a stall reason calls for, said in the brand's voice. When the Engine
// writes, it walks this graph; when an expert rejects a line, the graph says what the line stood on.
//
// It maps onto brain_nodes / brain_edges (20261103190000_brand_brain.sql): copy nodes live in the layers 'market'
// (audience, insight, research), 'rules' (claims, facts, voice) and 'memory' (pieces, lines, verdicts, lessons). The
// copy edge kind is kept in body.edge; brain_edges.kind takes the nearest of its eleven kinds.

import { containsPhrase } from "./slop.ts";
import { findQuote } from "./truth.ts";
import type { CopyContext, CopyDeck } from "./types.ts";

export type CopyNodeKind =
  | "audience" | "awareness" | "research" | "insight" | "tension" | "idea" | "promise" | "proof" | "fact" | "quote"
  | "voice_trait" | "voc_phrase" | "category_line" | "stall_reason" | "objection" | "ask" | "hook" | "piece" | "line"
  | "verdict" | "lesson";

export type CopyEdgeKind =
  | "grounds" // research -> insight
  | "expresses" // idea -> insight
  | "keeps" // piece -> promise
  | "proves" // proof/fact/quote -> promise
  | "cites" // line -> fact/quote
  | "answers" // piece -> stall_reason/objection
  | "asks" // piece -> ask
  | "speaks_to" // piece -> audience/awareness
  | "part_of" // line -> piece
  | "sounds_like" // line -> voice_trait
  | "judged" // verdict -> line
  | "teaches" // lesson -> verdict
  | "too_close_to"; // line -> category_line

export interface CopyNode {
  id: string;
  kind: CopyNodeKind;
  label: string;
  body?: Record<string, unknown>;
  /** verified: a fact with a source; proposed: Fume's or a model's; assumption: a [placeholder] until someone confirms. */
  state: "verified" | "proposed" | "assumption" | "approved" | "rejected";
  source?: string;
}

export interface CopyEdge {
  from: string;
  to: string;
  kind: CopyEdgeKind;
}

export interface CopyGraph {
  nodes: CopyNode[];
  edges: CopyEdge[];
}

const LAYER: Record<CopyNodeKind, "market" | "rules" | "memory"> = {
  audience: "market", awareness: "market", research: "market", insight: "market", tension: "market", idea: "memory",
  promise: "rules", proof: "rules", fact: "rules", quote: "rules", voice_trait: "rules", voc_phrase: "market",
  category_line: "market", stall_reason: "market", objection: "market", ask: "rules", hook: "memory", piece: "memory",
  line: "memory", verdict: "memory", lesson: "memory",
};

const BRAIN_EDGE: Record<CopyEdgeKind, string> = {
  grounds: "from", expresses: "about", keeps: "uses", proves: "for", cites: "uses", answers: "for", asks: "uses",
  speaks_to: "for", part_of: "part_of", sounds_like: "related", judged: "about", teaches: "from", too_close_to: "related",
};

/** Draws the graph of a deck: its facts and quotes, its pieces and lines, and which line cites what. */
export function deckGraph(deck: CopyDeck, ctx: CopyContext, extra: CopyGraph = { nodes: [], edges: [] }): CopyGraph {
  const nodes: CopyNode[] = [...extra.nodes];
  const edges: CopyEdge[] = [...extra.edges];
  for (const f of ctx.facts)
    nodes.push({ id: `fact:${f.id}`, kind: "fact", label: f.statement, state: f.verified ? "verified" : "assumption", source: f.source });
  for (const q of ctx.quotes)
    nodes.push({ id: `quote:${q.id}`, kind: "quote", label: q.translation ?? q.original, body: { speaker: q.speaker, business: q.business, original: q.original }, state: "verified", source: q.source });
  for (const line of ctx.categoryLines) nodes.push({ id: `category:${line.slice(0, 40)}`, kind: "category_line", label: line, state: "verified" });
  for (const piece of deck.pieces) {
    nodes.push({ id: `piece:${piece.id}`, kind: "piece", label: piece.title ?? piece.id, body: { job: piece.job }, state: "proposed" });
    for (const f of piece.fields) {
      const lineId = `line:${f.ref}`;
      nodes.push({ id: lineId, kind: "line", label: f.text, body: { format: f.format }, state: "proposed" });
      edges.push({ from: lineId, to: `piece:${piece.id}`, kind: "part_of" });
      for (const m of f.text.matchAll(/[“„"]([^“”„"]{8,})[”“"]/g)) {
        const q = findQuote(m[1], ctx.quotes);
        if (q) edges.push({ from: lineId, to: `quote:${q.id}`, kind: "cites" });
      }
      for (const fact of ctx.facts) {
        const cue = (fact.numbers ?? []).some((n) => containsPhrase(f.text, n)) ||
          (fact.statement.length < 60 && containsPhrase(f.text, fact.statement));
        if (cue) edges.push({ from: lineId, to: `fact:${fact.id}`, kind: "cites" });
      }
    }
  }
  return { nodes, edges };
}

/** Rows for brain_nodes / brain_edges (ref_table 'copy_graph', ref_key the node id). */
export function toBrainRows(g: CopyGraph) {
  return {
    nodes: g.nodes.map((n) => ({
      layer: LAYER[n.kind], kind: `copy_${n.kind}`, ref_table: "copy_graph", ref_key: n.id, label: n.label.slice(0, 300),
      body: { ...(n.body ?? {}), source: n.source }, origin: "engine",
      state: n.state === "approved" || n.state === "verified" ? "approved" : n.state === "rejected" ? "removed" : "proposed",
      confidence: n.state === "verified" ? "high" : n.state === "assumption" ? "low" : "medium",
    })),
    edges: g.edges.map((e) => ({ from_key: e.from, to_key: e.to, kind: BRAIN_EDGE[e.kind], body: { edge: e.kind } })),
  };
}

/** What a writer must have before it writes a line, read from the graph; the gaps are what Brand DNA still lacks. */
export function readiness(g: CopyGraph): { ready: boolean; missing: string[] } {
  const has = (k: CopyNodeKind, min = 1) => g.nodes.filter((n) => n.kind === k).length >= min;
  const missing: string[] = [];
  if (!has("audience")) missing.push("an audience, in their words");
  if (!has("insight")) missing.push("an insight with its research");
  if (!has("promise")) missing.push("one promise the work keeps");
  if (!has("fact", 3) && !has("quote", 1)) missing.push("verified proof: facts with sources or customer quotes");
  if (!has("voice_trait", 3)) missing.push("three voice traits with example lines");
  if (!has("voc_phrase", 5)) missing.push("the customer's own phrases (reviews, calls, comments)");
  if (!has("category_line", 5)) missing.push("what competitors say, for the swap test");
  if (!has("stall_reason")) missing.push("why the audience hesitates");
  return { ready: missing.length === 0, missing };
}
