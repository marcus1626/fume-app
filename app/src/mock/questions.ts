// One question, one record. A question Fume asks the customer can show in many places: as a line the brief still
// misses (campaign page, Campaigns, Home), as an unknown line of a product (product page), as an open question in the
// Brand understanding, and as a card in the Fume chat. An answer given in ANY place closes the record, and the record
// then writes that answer into every other place, so every screen reads the same state. index.ts settles the records
// before and after every call.
import { FumeError, type Id, type OpenQuestion, type Product } from "../contract";
import type { Mock } from "./context";
import type { QuestionRecord } from "./seed";

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** The open question a campaign waits on first, if any (Home and the campaign link to where it is answered). */
export function openQuestion(m: Mock, campaignId: Id): QuestionRecord | undefined {
  return m.db.questions.find((q) => q.campaignId === campaignId && !q.answer);
}

/** Settles every record: finds an answer given in any place, then writes it into every other place. */
export function settleQuestions(m: Mock): void {
  for (const q of m.db.questions) {
    if (q.answer) continue;
    const answer = answeredSomewhere(m, q);
    if (answer === undefined) continue;
    Object.assign(q, { answer, answeredBy: m.userId, answeredAt: m.now() });
    spread(m, q);
  }
}

function answeredSomewhere(m: Mock, q: QuestionRecord): string | undefined {
  const { db } = m;
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
      .filter((x) => x.threadId === thread?.id && x.author.kind === "person")
      .sort((a, b) => a.at.localeCompare(b.at))
      .at(-1);
    return said?.text ?? "Answered";
  }
  return undefined;
}

/** Writes an answered record into every place the question shows: the product's line, the Brand understanding, the
 *  brief, and with the brief the campaign and its clock. */
function spread(m: Mock, q: QuestionRecord): void {
  const { db } = m;
  const by = m.userId;
  const at = m.now();
  const product = q.productId ? db.products.find((p) => p.id === q.productId) : undefined;
  const answer = q.answer!;
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
  const unknown = q.unknownId ? db.understanding.unknowns.find((u) => u.id === q.unknownId) : undefined;
  if (unknown && !unknown.answer) unknown.answer = answer;
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
  m.emit({ type: "campaign.state", campaign });
}

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
export function listQuestions(m: Mock, workspaceId: Id): OpenQuestion[] {
  const { db } = m;
  const products = db.products.filter((p) => p.workspaceId === workspaceId);
  const campaigns = db.campaigns.filter((c) => c.workspaceId === workspaceId);
  const open: OpenQuestion[] = [];
  for (const q of db.questions) {
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

/** Answers one question: on the product's own line (by product, never by a bare line id), then everywhere else. */
export function answerOne(
  m: Mock,
  workspaceId: Id,
  input: {
    questionId: Id;
    text?: string;
    picture?: { name: string; bytes: number; src?: string };
    keepPicture?: boolean;
  },
): void {
  const { db } = m;
  const by = m.userId;
  const at = m.now();
  const open = listQuestions(m, workspaceId).find((q) => q.id === input.questionId);
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
  const record = db.questions.find((q) => q.id === open.id);
  if (record) {
    Object.assign(record, {
      answer: open.answer === "picture" ? "Packshot added" : text,
      answeredBy: by,
      answeredAt: at,
    });
    spread(m, record);
  }
}
