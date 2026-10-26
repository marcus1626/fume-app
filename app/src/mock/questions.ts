// One question, one record (walk-through 15 Oct, Must 4; UX review C3). A question Fume asks the customer can show in
// many places: as a line the brief still misses (campaign page, Campaigns, Home), as an unknown line of a product
// (product page), as an open question in the Brand understanding, and as a card in the Fume chat. Before, each place
// kept its own copy, so answering it in one place left it open everywhere else. Now every question is one record here:
// an answer given in ANY place closes the record, and the record then writes that answer into every other place, so
// every screen reads the same state. createMockApi wraps the api so the store settles before every call.

import {
  FumeError,
  type Brief,
  type Campaign,
  type FumeApi,
  type FumeEvent,
  type Id,
  type Message,
  type OpenQuestion,
  type Product,
  type ServiceClock,
} from "../contract";

export interface QuestionRecord {
  id: Id;
  workspaceId: Id;
  /** The campaign whose brief waits on it, when one does. */
  campaignId?: Id;
  /** The brief's line, as Fume writes it there: "The claims we may use for Hand Balm". */
  line: string;
  /** Where it is quickest to answer. */
  href: string;
  /** Round 8 (one sheet, WAY-3): the question as Fume asks it, why, and how it is answered. */
  ask: string;
  why: string;
  kind: "text" | "picture";
  suggestions?: { label: string; text: string }[];
  hint?: string;
  /** The places the same question shows. */
  productId?: Id;
  factId?: Id;
  specFieldId?: string;
  shotSlotId?: string;
  unknownId?: Id;
  answer?: string;
  answeredBy?: Id;
  answeredAt?: string;
}

/** LYSNE's open questions. Hand Balm's brief waits on its claims and a packshot of the tube. */
export const seedQuestions: QuestionRecord[] = [
  {
    id: "q-balm-claims",
    workspaceId: "w-lysne",
    campaignId: "c-balm",
    line: "The claims we may use for Hand Balm",
    href: "/brand/products/pr-balm#needs",
    productId: "pr-balm",
    factId: "f10",
    specFieldId: "claims",
    unknownId: "un1",
    ask: "Which claims may we use for Hand Balm?",
    why: "Every line on a creative must be true. Fume’s expert checks each one against your answer, so we never guess it.",
    kind: "text",
    suggestions: [{ label: "The same as Night Body Oil", text: "For the hour before sleep." }],
    hint: "One claim per line, as it may stand on a creative",
  },
  {
    id: "q-balm-packshot",
    workspaceId: "w-lysne",
    campaignId: "c-balm",
    line: "A packshot of the tube",
    href: "/brand/products/pr-balm#needs",
    productId: "pr-balm",
    shotSlotId: "front",
    ask: "Is this the Hand Balm packshot?",
    why: "The Engine draws the tube from this photo, so its shape, cap and label come out right. Confirm it, or add a better one.",
    kind: "picture",
  },
];

interface Db {
  products: Product[];
  briefs: Brief[];
  campaigns: Campaign[];
  clocks: ServiceClock[];
  threads: { id: Id; campaignId: Id | null }[];
  messages: Message[];
  understanding: { unknowns: { id: Id; question: string; answer?: string }[] };
}

interface Ctx {
  now: () => string;
  userId: () => Id;
  emit: (event: FumeEvent) => void;
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** The open question a campaign waits on first, if any (Home and the campaign link to where it is answered). */
export function openQuestion(questions: QuestionRecord[], campaignId: Id): QuestionRecord | undefined {
  return questions.find((q) => q.campaignId === campaignId && !q.answer);
}

/** Settles every record: finds an answer given in any place, then writes it into every other place. */
export function settleQuestions(questions: QuestionRecord[], db: Db, ctx: Ctx): void {
  for (const q of questions) {
    if (q.answer) continue;
    const answer = answeredSomewhere(q, db);
    if (answer === undefined) continue;
    Object.assign(q, { answer, answeredBy: ctx.userId(), answeredAt: ctx.now() });
    spread(q, db, ctx);
  }
}

function answeredSomewhere(q: QuestionRecord, db: Db): string | undefined {
  const product = q.productId ? db.products.find((p) => p.id === q.productId) : undefined;
  const fact = q.factId ? product?.facts.find((f) => f.id === q.factId) : undefined;
  if (fact && fact.source !== "unknown") return fact.statement;
  const spec = q.specFieldId
    ? product?.specs?.find((s) => s.fieldId === q.specFieldId && s.provenance.origin === "customer")
    : undefined;
  if (spec) return Array.isArray(spec.value) ? spec.value.join("\n") : String(spec.value);
  const shot = q.shotSlotId ? product?.shots?.find((s) => s.slotId === q.shotSlotId) : undefined;
  if (shot && (shot.provenance.origin === "customer" || shot.provenance.state === "approved")) return "Packshot added";
  const unknown = q.unknownId ? db.understanding.unknowns.find((u) => u.id === q.unknownId) : undefined;
  if (unknown?.answer) return unknown.answer;
  // Answered in the chat: the brief took the answer in, so its line is gone. The answer is what the customer last said.
  const brief = q.campaignId ? db.briefs.find((b) => b.campaignId === q.campaignId) : undefined;
  if (brief && !brief.missing.includes(q.line)) {
    const thread = db.threads.find((t) => t.campaignId === q.campaignId);
    const said = db.messages
      .filter((m) => m.threadId === thread?.id && m.author.kind === "person")
      .sort((a, b) => a.at.localeCompare(b.at))
      .at(-1);
    return said?.text ?? "Answered";
  }
  return undefined;
}

function spread(q: QuestionRecord, db: Db, ctx: Ctx): void {
  const by = ctx.userId();
  const at = ctx.now();
  const product = q.productId ? db.products.find((p) => p.id === q.productId) : undefined;
  const answer = q.answer!;
  // The product's line.
  const fact = q.factId ? product?.facts.find((f) => f.id === q.factId) : undefined;
  if (fact && fact.source === "unknown")
    Object.assign(fact, { statement: answer, source: "verified", confidence: "high", verifiedBy: by, verifiedAt: at });
  if (
    product &&
    q.specFieldId &&
    product.kindId &&
    !product.specs?.some((s) => s.fieldId === q.specFieldId && s.provenance.origin === "customer")
  ) {
    const lines = answer
      .split(/\n|;/)
      .map((s) => s.trim())
      .filter(Boolean);
    product.specs = (product.specs ?? [])
      .filter((s) => s.fieldId !== q.specFieldId)
      .concat({ fieldId: q.specFieldId, value: lines, provenance: { origin: "customer", state: "approved", by, at } });
  }
  if (product && product.facts.every((f) => f.source === "verified" || f.source === "supplied") && product.facts.length)
    product.state = "verified";
  // The Brand understanding's question.
  const unknown = q.unknownId ? db.understanding.unknowns.find((u) => u.id === q.unknownId) : undefined;
  if (unknown && !unknown.answer) unknown.answer = answer;
  // The brief's line, and with it the campaign and its clock.
  const brief = q.campaignId ? db.briefs.find((b) => b.campaignId === q.campaignId) : undefined;
  const campaign = q.campaignId ? db.campaigns.find((c) => c.id === q.campaignId) : undefined;
  if (!brief || !campaign) return;
  brief.missing = brief.missing.filter((line) => line !== q.line);
  const clock = db.clocks.find((k) => k.campaignId === campaign.id);
  if (brief.missing.length === 0) {
    if (brief.state === "drafting") brief.state = "ready";
    if (campaign.state === "awaiting_input") campaign.state = "draft";
    if (clock?.state === "paused_waiting_on_you") {
      clock.state = "running";
      delete clock.pausedReason;
    }
  } else if (clock?.state === "paused_waiting_on_you") clock.pausedReason = `Fume needs ${lower(brief.missing[0])}.`;
  campaign.updatedAt = at;
  ctx.emit({ type: "campaign.state", campaign });
}

/** Wraps every api call so the questions settle before it reads or writes (answers in the chat land later, on a timer). */
export function keepQuestions(api: FumeApi, settle: () => void): void {
  const calls = api as unknown as Record<string, unknown>;
  for (const [name, fn] of Object.entries(calls)) {
    if (typeof fn !== "function" || name === "subscribe") continue;
    calls[name] = (...args: unknown[]) => {
      settle();
      const result = (fn as (...a: unknown[]) => unknown).apply(api, args);
      if (result instanceof Promise) return result.then((value) => (settle(), value));
      return result;
    };
  }
}

// ── Round 8 (HOME): one sheet answers every question (WAY-3, LOAD-4) ──────────────────────────────────────────────
// questions() lists what is still open: the records above whose campaign and product exist, plus every other line a
// product does not know yet (a claims line Fume asks before the product can be used). answerQuestion() writes the
// answer where it belongs, on that product's own line, then spreads it (the brief, the understanding, the clock).

const claimsWhy =
  "Every line on a creative must be true. Fume’s expert checks each one against your answer, so we never guess it.";

/** A product line Fume does not know, as a question of its own (no record: no brief waits on it). */
function factQuestion(p: Product, f: Product["facts"][number]): OpenQuestion {
  const claims = f.area === "claim";
  return {
    id: `q-fact-${p.id}-${f.id}`,
    question: claims
      ? `Which claims may we use for ${p.name}?`
      : f.statement.trim().endsWith("?")
        ? f.statement
        : `What is the ${f.label.toLowerCase()} of ${p.name}?`,
    why: claims ? claimsWhy : "Fume makes creatives only of what you have confirmed, so we ask before we guess.",
    line: claims ? `The claims we may use for ${p.name}` : `${f.label} of ${p.name}`,
    answer: "text",
    productId: p.id,
    factId: f.id,
    hint: claims ? "One claim per line, as it may stand on a creative" : undefined,
  };
}

/** The open questions in a workspace: brief questions first (a campaign waits on them), then product lines. */
export function listQuestions(questions: QuestionRecord[], db: Db, workspaceId: Id): OpenQuestion[] {
  const products = db.products.filter((p) => p.workspaceId === workspaceId);
  const campaigns = db.campaigns.filter((c) => c.workspaceId === workspaceId);
  const open: OpenQuestion[] = [];
  for (const q of questions) {
    if (q.answer || q.workspaceId !== workspaceId) continue;
    if (q.campaignId && !campaigns.some((c) => c.id === q.campaignId)) continue;
    const product = q.productId ? products.find((p) => p.id === q.productId) : undefined;
    if (q.productId && !product) continue;
    const shot = q.shotSlotId ? product?.shots?.find((s) => s.slotId === q.shotSlotId) : undefined;
    open.push({
      id: q.id,
      question: q.ask,
      why: q.why,
      line: q.line,
      answer: q.kind,
      campaignId: q.campaignId,
      productId: q.productId,
      factId: q.factId,
      shotSlotId: q.shotSlotId,
      suggestions: q.suggestions,
      hint: q.hint,
      picture: shot?.image,
    });
  }
  for (const p of products)
    for (const f of p.facts)
      if (f.source === "unknown" && !open.some((q) => q.productId === p.id && q.factId === f.id))
        open.push(factQuestion(p, f));
  return open;
}

/** Answer one question: on the product's own line (by product, never by a bare line id), then everywhere else. */
export function answerOne(
  questions: QuestionRecord[],
  db: Db,
  ctx: Ctx,
  workspaceId: Id,
  input: {
    questionId: Id;
    text?: string;
    picture?: { name: string; bytes: number; src?: string };
    keepPicture?: boolean;
  },
): void {
  const by = ctx.userId();
  const at = ctx.now();
  const open = listQuestions(questions, db, workspaceId).find((q) => q.id === input.questionId);
  if (!open) throw new FumeError("not_found", "That question is answered already.");
  const product = open.productId
    ? db.products.find((p) => p.id === open.productId && p.workspaceId === workspaceId)
    : undefined;
  const text = input.text?.trim();
  if (open.answer === "picture") {
    if (!product || !open.shotSlotId) throw new FumeError("invalid", "No product to add the photo to.");
    const shot = product.shots?.find((s) => s.slotId === open.shotSlotId);
    if (input.keepPicture && shot) shot.provenance = { ...shot.provenance, state: "approved", by, at };
    else if (input.picture) {
      const image = input.picture.src ?? product.images[0];
      if (!image) throw new FumeError("invalid", "The photo did not arrive. Try it again.");
      product.shots = (product.shots ?? [])
        .filter((s) => s.slotId !== open.shotSlotId)
        .concat({ slotId: open.shotSlotId, image, provenance: { origin: "customer", state: "approved", by, at } });
    } else throw new FumeError("invalid", "Keep the photo, or add one.");
  } else {
    if (!text) throw new FumeError("invalid", "Write the answer first.");
    const fact = open.factId ? product?.facts.find((f) => f.id === open.factId) : undefined;
    if (fact)
      Object.assign(fact, { statement: text, source: "verified", confidence: "high", verifiedBy: by, verifiedAt: at });
    if (
      product &&
      product.facts.length &&
      product.facts.every((f) => f.source === "verified" || f.source === "supplied")
    )
      product.state = "verified";
  }
  const record = questions.find((q) => q.id === open.id);
  if (record) {
    Object.assign(record, {
      answer: open.answer === "picture" ? "Packshot added" : text,
      answeredBy: by,
      answeredAt: at,
    });
    spread(record, db, ctx);
  }
}
