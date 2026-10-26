// The one conversation with Fume: its threads and messages, what Fume answers itself (a question about something the
// app knows, the brief's next question), a meeting or a person when Fume can't do it alone, a brief written without
// the chat, and the questions Fume still has for the customer.
import {
  FumeError,
  type Campaign,
  type ChatLink,
  type Collection,
  type Creative,
  type FumeApi,
  type Id,
  type Meeting,
  type Message,
  type OpenQuestion,
  type Product,
  type Thread,
  type User,
} from "../contract";
import { canBeMade } from "../domain/products";
import { agencyWhy } from "./agency";
import { startCampaignBoard } from "./brand";
import { questionCard } from "./chatBrief";
import type { Mock } from "./context";
import { answerOne, listQuestions } from "./questions";

type Calls =
  | "threads"
  | "messages"
  | "send"
  | "conversation"
  | "say"
  | "orderBrief"
  | "meetingSlots"
  | "bookMeeting"
  | "meetings"
  | "meetingTopics"
  | "questions"
  | "answerQuestion";

/** What a meeting with Fume is usually about (mock data; the backend serves the brand's own). */
const MEETING_TOPICS = [
  "Urgent",
  "An update",
  "Feedback on creatives",
  "The plan",
  "Package and billing",
  "Something else",
];

// ── words ──
const TZ = "Europe/Oslo";
const dayWords = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: TZ })
    .format(Date.parse(iso))
    .replace(",", "");
const list = (names: string[]) =>
  names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : (names[0] ?? "");
const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const STAGE: Record<string, string> = {
  brief: "the brief",
  moodboard: "the moodboard",
  plan: "the plan",
  directions: "the masters",
  masters: "the masters",
  variants: "the creatives",
  delivery: "delivery",
};
const firstName = (u: User | undefined) => u?.name.split(" ")[0];
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** The text says this name: after "@", or as whole words. */
const names = (text: string, name: string) => new RegExp(`(^|[^\\p{L}])@?${escape(name)}(?![\\p{L}])`, "iu").test(text);

/** A question rather than an answer: "Where are…", "How is…", "…?". */
const asks = (text: string) =>
  /\?\s*$/.test(text.trim()) ||
  /^(where|what|when|how|why|who|which|is|are|can|could|do|does|show|tell)\b/i.test(text.trim());
const WAITING =
  /\b(what|anything)\b[^?]*\b(wait(s|ing)? (on|for) me|do i (need|have) to)\b|\bwaiting on me\b|\bmy to-?do\b/i;
const MONTH = /\b(this month|in numbers|month in numbers|my usage|how many creatives (have i|did we) (used|use))\b/i;

/** What the claims of this kind of product usually say, for a product question the brand's website does not answer. */
const CLAIM_TEMPLATES: { kind: RegExp; plural: string; templates: { label: string; text: string }[] }[] = [
  {
    kind: /balm|cream|lotion/i,
    plural: "hand balms",
    templates: [
      { label: "Care", text: "Softens dry hands." },
      { label: "Texture", text: "Sinks in quickly and leaves no greasy film." },
      { label: "Ingredients", text: "With shea butter and plant oils." },
      { label: "Scent", text: "Lightly scented, like the evening ritual." },
    ],
  },
  {
    kind: /candle/i,
    plural: "candles",
    templates: [
      { label: "Burn time", text: "Burns for about 40 hours." },
      { label: "Wax", text: "Plant wax and a cotton wick." },
      { label: "Scent", text: "Cedar and lavender, for the hour before sleep." },
    ],
  },
  {
    kind: /oil|serum/i,
    plural: "body oils",
    templates: [
      { label: "Care", text: "Leaves the skin soft and supple." },
      { label: "Texture", text: "A light oil that sinks in." },
      { label: "Ritual", text: "For the hour before sleep." },
    ],
  },
];

export function conversationCalls(m: Mock): Pick<FumeApi, Calls> {
  const { db, wait } = m;
  const now = () => m.now();
  const mine = <T extends { workspaceId: Id }>(rows: T[]) => rows.filter((r) => r.workspaceId === m.workspaceId);
  const general = () =>
    db.threads.find((t) => t.workspaceId === m.workspaceId && t.kind !== "contact" && t.campaignId === null);
  const fumeThreadIds = () =>
    new Set(db.threads.filter((t) => t.workspaceId === m.workspaceId && t.kind !== "contact").map((t) => t.id));
  const expertName = () =>
    firstName(
      db.users.find((u) =>
        db.staff.some((s) => s.userId === u.id && s.workspaceId === m.workspaceId && s.staffRole === "expert"),
      ),
    ) ?? "the expert";
  /** The campaign's own thread in the conversation (made now if it has none). */
  const threadOf = (c: Campaign): Thread => {
    let t = db.threads.find((x) => x.campaignId === c.id && x.kind !== "contact");
    if (!t) {
      t = {
        id: m.nextId("t"),
        workspaceId: c.workspaceId,
        campaignId: c.id,
        title: c.name,
        updatedAt: now(),
        unread: 0,
      };
      db.threads.push(t);
    }
    return t;
  };
  const later = (fn: () => void, ticks = 6) => setTimeout(fn, m.latency * ticks);

  /** Fume's own lines in the talk about no campaign. */
  function fumeSays(text: string, card?: Message["card"], author: Message["author"] = { kind: "fume" }) {
    const msg: Message = {
      id: m.nextId("msg"),
      threadId: general()!.id,
      author,
      text,
      at: now(),
      ...(card ? { card } : {}),
    };
    db.messages.push(msg);
    m.emit({ type: "message.new", message: structuredClone(msg) });
    return msg;
  }

  /** The next weekday mornings and noons Sander is free; a time already booked is not offered again. */
  function slots(): string[] {
    const base = new Date(now());
    const out: string[] = [];
    for (let d = 1; out.length < 6; d++) {
      const day = new Date(base.getTime() + d * 86_400_000);
      if (day.getUTCDay() === 0 || day.getUTCDay() === 6) continue;
      for (const h of [8, 12]) {
        day.setUTCHours(h, 0, 0, 0);
        const iso = day.toISOString();
        if (!db.meetings.some((x) => x.state === "booked" && x.at === iso)) out.push(iso);
      }
    }
    return out;
  }

  // ── What a message is about ──
  interface About {
    campaign?: Campaign;
    product?: Product;
    collection?: Collection;
    creative?: Creative;
  }
  /** The first thing the text names: a creative ("@Feed 3 in Autumn launch"), a campaign, a collection, a product. The
   *  longest name wins, so "Night Body Oil" is not read as "Oil". */
  function about(text: string): About {
    const campaigns = mine(db.campaigns).sort((a, b) => b.name.length - a.name.length);
    const creative = /@?(Feed|Story|Square)\s+(\d+)\s+in\s+(.+?)(?=[?.!,]|$)/i.exec(text);
    if (creative) {
      const c = campaigns.find((x) => names(creative[3], x.name));
      if (c) {
        const format = creative[1].toLowerCase();
        const shown = db.creatives.filter((x) => x.campaignId === c.id && x.format === format);
        const hit = shown[Number(creative[2]) - 1];
        if (hit) return { creative: hit, campaign: c };
      }
    }
    const campaign = campaigns.find((c) => names(text, c.name));
    if (campaign) return { campaign };
    const collection = mine(db.collections)
      .sort((a, b) => b.name.length - a.name.length)
      .find((c) => names(text, c.name));
    if (collection) return { collection };
    const product = mine(db.products)
      .sort((a, b) => b.name.length - a.name.length)
      .find((p) => names(text, p.name));
    if (product) return { product };
    return {};
  }

  // ── Fume's answers, from what the app knows ──
  function campaignWords(c: Campaign): string {
    const brief = db.briefs.find((b) => b.campaignId === c.id);
    const plan = db.plans.find((p) => p.campaignId === c.id);
    const live = c.dueAt ? `, live ${dayWords(c.dueAt)}` : "";
    const head = ["delivered", "closed"].includes(c.state)
      ? `${c.name} is delivered`
      : `${c.name} is at ${STAGE[c.stage] ?? c.stage}${live}`;
    const facts: string[] = [];
    let next = "";
    if (c.stage === "brief" && brief) {
      if (brief.state === "drafting" && brief.missing.length) {
        facts.push(`Fume waits on you for ${lower(list(brief.missing.map(lower)))}`);
        next = "Answer it and Fume writes the plan.";
      } else if (brief.state === "ready") next = "The brief is ready to send to Fume.";
      else next = "Fume is reading the brief.";
    } else if (c.stage === "plan" && plan) {
      const by = plan.readyBy ? `, ready by ${dayWords(plan.readyBy)}` : "";
      if (plan.state === "writing") facts.push(`Fume is writing the plan${by}`);
      else if (plan.state === "in_check") facts.push(`${expertName()} is checking the plan${by}`);
      else if (plan.state === "changes_asked") facts.push(`Fume is changing the plan${by}`);
      else if (plan.state === "ready") {
        facts.push(`The plan, version ${plan.version}, is ready for you`);
        next = "Approve it and the Engine starts; nothing is made before that.";
      }
    } else {
      // one short sentence each: what waits on her first, then what is still with the expert, then what is done
      const n = c.counts;
      const sentences: string[] = [];
      if (n.checked)
        sentences.push(`${count(n.checked, "creative")} ${n.checked === 1 ? "waits" : "wait"} on you to approve.`);
      if (n.inCheck)
        sentences.push(
          `${n.inCheck} more ${n.inCheck === 1 ? "is" : "are"} in check with ${expertName()}; you see ${n.inCheck === 1 ? "it" : "them"} once ${n.inCheck === 1 ? "it is" : "they are"} checked.`,
        );
      if (n.approved) sentences.push(`You approved ${n.approved}.`);
      if (n.delivered) sentences.push(`${n.delivered} ${n.delivered === 1 ? "is" : "are"} delivered.`);
      return `${head}. ${sentences.join(" ")}`.trim();
    }
    return `${head}.${facts.length ? ` ${list(facts.map((f, i) => (i ? lower(f) : f)))}.` : ""}${next ? ` ${next}` : ""}`;
  }
  function productWords(p: Product): string {
    const using = mine(db.campaigns)
      .filter((c) => c.productIds.includes(p.id) && !["closed", "delivered"].includes(c.state))
      .map((c) => c.name);
    const name = `${p.name}${p.variant ? ` ${p.variant}` : ""}`;
    if (canBeMade(p))
      return `${name} is confirmed, so Fume can make creatives of it.${using.length ? ` It is in ${list(using)}.` : " No campaign uses it yet."}`;
    const open = p.facts.filter((f) => f.source === "unknown").map((f) => lower(f.label));
    return `${name} is not confirmed yet${open.length ? `: Fume still needs ${list(open.map((o) => `the ${o}`))}` : ""}.${using.length ? ` ${list(using)} ${using.length === 1 ? "waits" : "wait"} on it.` : ""} Confirm it and Fume can make creatives of it.`;
  }
  function collectionWords(c: Collection): string {
    const products = db.products.filter((p) => c.productIds.includes(p.id));
    const ready = products.filter(canBeMade).map((p) => p.name);
    const waiting = products.filter((p) => !canBeMade(p)).map((p) => p.name);
    return `${c.name} holds ${list(products.map((p) => p.name))}.${waiting.length ? ` ${list(waiting)} ${waiting.length === 1 ? "is" : "are"} not confirmed yet.` : ready.length ? " All of them are confirmed." : ""} Pick it for a campaign and the campaign takes ${products.length === 1 ? "it" : `all ${products.length}`}.`;
  }
  function creativeWords(cr: Creative, c: Campaign): string {
    const by = cr.current.checkedBy ? firstName(db.users.find((u) => u.id === cr.current.checkedBy)) : undefined;
    const state: Record<string, string> = {
      making: "the Engine is making it",
      in_check: `${expertName()} is checking it`,
      correcting: `${expertName()} is fixing it before you see it`,
      held: "it is held back for now",
      checked: `checked by ${by ?? expertName()}, it waits on you to approve`,
      changes_requested: "your changes are being made",
      approved: "you approved it",
      delivered: "it is delivered",
    };
    return `${cr.title || "This creative"} in ${c.name}: ${state[cr.current.state] ?? cr.current.state}.`;
  }

  /** A message that names a campaign, a product, a collection or a creative (with "@" or in plain words) gets a plain
   *  answer from what the app knows and a link card that opens it beside the conversation; "What waits on me?" and
   *  "This month in numbers" answer with a card read from the same source as Home. Such a question is never taken as
   *  an answer to a brief still being written. False when the text is not such a question. */
  function answer(text: string, from: Id | undefined): boolean {
    const g = general();
    const t = text.trim();
    if (!g || !t) return false;
    const me = { kind: "person" as const, userId: m.userId };
    if (WAITING.test(t) || MONTH.test(t)) {
      const of = WAITING.test(t) ? "waiting" : "month";
      m.post(g.id, { author: me, text: t });
      later(() =>
        m.post(g.id, {
          author: { kind: "fume" },
          text:
            of === "waiting"
              ? "Here is what waits on you, soonest first. It is the same list as on Home."
              : "This month in numbers, as Home counts them.",
          card: { kind: "summary", of },
        }),
      );
      return true;
    }
    const a = about(t);
    const mention = t.includes("@");
    // A named thing answers a question about it, or a bare mention; never an answer to the brief being written.
    if (!a.campaign && !a.product && !a.collection) return false;
    if (!mention && !asks(t)) return false;
    // A question about the campaign whose brief is being written, while Fume asks it something: the brief's own talk.
    if (
      !mention &&
      a.campaign &&
      from &&
      db.threads.find((x) => x.id === from)?.campaignId === a.campaign.id &&
      !/\b(where|status|how far|what.?s next)\b/i.test(t)
    )
      return false;
    let words: string;
    let link: ChatLink;
    let thread: Thread = g;
    if (a.creative && a.campaign) {
      words = creativeWords(a.creative, a.campaign);
      link = { kind: "creative", campaignId: a.campaign.id, creativeId: a.creative.id };
      thread = threadOf(a.campaign);
    } else if (a.campaign) {
      words = campaignWords(a.campaign);
      const plan = db.plans.find((p) => p.campaignId === a.campaign!.id);
      link =
        /\bplan\b/i.test(t) && plan
          ? { kind: "plan", campaignId: a.campaign.id }
          : { kind: "campaign", campaignId: a.campaign.id };
      thread = threadOf(a.campaign);
    } else if (a.collection) {
      words = collectionWords(a.collection);
      link = { kind: "collection", collectionId: a.collection.id };
    } else {
      words = productWords(a.product!);
      link = { kind: "product", productId: a.product!.id };
    }
    m.post(thread.id, { author: me, text: t });
    thread.updatedAt = now();
    later(() => m.post(thread.id, { author: { kind: "fume" }, text: words, card: { kind: "link", link } }));
    return true;
  }

  /** A product question whose answer the brand's website does not give comes with templates: what this kind of
   *  product usually says, to start from. */
  const site = () => (m.workspaceId === "w-lysne" ? "lysne.no" : "Your website");
  function withTemplates(questions: OpenQuestion[]): OpenQuestion[] {
    return questions.map((q) => {
      if (q.answer !== "text" || !q.productId || !/claim/i.test(`${q.question} ${q.line}`)) return q;
      const p = db.products.find((x) => x.id === q.productId);
      const kind = p ? CLAIM_TEMPLATES.find((k) => k.kind.test(p.name)) : undefined;
      if (!p || !kind) return q;
      return {
        ...q,
        templates: kind.templates,
        templatesWhy: `${site()} says nothing about the claims of ${p.name}, so here is what ${kind.plural} usually say. Start from one and keep only what is true.`,
      };
    });
  }

  /** Her message in a thread, and Fume's answer: the brief's next question while a campaign started in the chat is
   *  being written, its next missing line, or a thank-you. The Contact thread is people: Fume never answers there. */
  function post(threadId: Id, text: string, attachments?: Parameters<FumeApi["send"]>[2]) {
    const t = m.find(db.threads, threadId, "thread");
    const msg = m.post(threadId, {
      author: { kind: "person", userId: m.userId },
      text,
      attachments: attachments?.map((a) => ({ id: m.nextId("att"), kind: "document" as const, ...a })),
    });
    t.updatedAt = msg.at;
    if (t.kind === "contact") return wait(msg);
    // "Add to it or start a new one?": the answer to Fume's question about a campaign for the same occasion.
    const pending = m.chat.pendingStart.get(threadId);
    if (pending) {
      m.chat.pendingStart.delete(threadId);
      const existing = m.campaignOf(pending.campaignId);
      if (/start|new|ny/i.test(text) && !/add|legg/i.test(text)) {
        m.chat.startingAnyway = true;
        setTimeout(
          () => void m.api.startCampaign({ text: pending.text, productIds: pending.productIds }),
          m.latency * 4,
        );
        return wait(msg);
      }
      const added = db.products.filter((p) => pending.productIds.includes(p.id) && !existing.productIds.includes(p.id));
      existing.productIds = [...existing.productIds, ...added.map((p) => p.id)];
      existing.updatedAt = now();
      // The answer goes to the campaign's own thread (made now if it had none), so its brief card shows in full.
      let thread = db.threads.find((x) => x.campaignId === existing.id && x.kind !== "contact");
      if (!thread) {
        thread = {
          id: m.nextId("t"),
          workspaceId: m.workspaceId,
          campaignId: existing.id,
          title: existing.name,
          updatedAt: now(),
          unread: 0,
        };
        db.threads.push(thread);
      }
      setTimeout(() => {
        m.post(thread?.id ?? threadId, {
          author: { kind: "fume" },
          text: added.length
            ? `${added.map((p) => p.name).join(" and ")} is in ${existing.name} now. Here is its brief.`
            : `${existing.name} it is. Here is its brief; tell us what to add.`,
          card: {
            kind: "brief",
            campaignId: existing.id,
            version: db.briefs.find((x) => x.campaignId === existing.id)?.version ?? 1,
          },
        });
        m.emit({ type: "campaign.state", campaign: existing });
      }, m.latency * 6);
      return wait(msg);
    }
    // A brief still missing something takes the answer in; once nothing is missing it is ready to send.
    const brief = t.campaignId ? db.briefs.find((b) => b.campaignId === t.campaignId) : undefined;
    setTimeout(() => {
      const asked = brief ? m.chat.drafting.get(brief.campaignId) : undefined;
      if (brief?.state === "drafting" && asked?.length) {
        // A campaign started in the chat: the answer fills its line, then the next question or the brief card.
        const c = m.campaignOf(brief.campaignId);
        const q = asked.shift()!;
        q.fill(text, c, brief);
        // No confirmed product in the answer: the product question stays (a campaign never has 0 products).
        if (q.key === "product" && !c.productIds.length) {
          asked.unshift(q);
          m.post(threadId, {
            author: { kind: "fume" },
            text: "We found no confirmed product in that. Tick one in the grid, or confirm a product’s details first.",
            card: questionCard(q),
          });
          m.emit({ type: "campaign.state", campaign: c });
          return;
        }
        brief.missing.shift();
        const next = asked[0];
        if (next) m.post(threadId, { author: { kind: "fume" }, text: next.text, card: questionCard(next) });
        else {
          m.chat.drafting.delete(brief.campaignId);
          Object.assign(brief, { state: "ready", creatives: brief.formats.length * 4 });
          // The same words whether the brief is a card here or the panel beside the conversation.
          m.post(threadId, {
            author: { kind: "fume" },
            text: `That is all we need. The brief for ${c.name} is ready. Send it when it reads right; nothing is made before you approve the plan.`,
            card: { kind: "brief", campaignId: brief.campaignId, version: brief.version },
          });
        }
        c.updatedAt = now();
        m.emit({ type: "campaign.state", campaign: c });
      } else if (brief?.state === "drafting") {
        brief.missing.shift();
        if (brief.missing.length === 0) {
          brief.state = "ready";
          m.post(threadId, {
            author: { kind: "fume" },
            text: "Thanks, that was the last thing. Here is your brief. Send it when it reads right; nothing is made before you approve the plan.",
            card: { kind: "brief", campaignId: brief.campaignId, version: brief.version },
          });
        } else
          m.post(threadId, {
            author: { kind: "fume" },
            text: `Thanks, that is in the brief. One more thing: ${brief.missing[0].charAt(0).toLowerCase()}${brief.missing[0].slice(1)}.`,
          });
        const c = db.campaigns.find((x) => x.id === brief.campaignId);
        if (c) m.emit({ type: "campaign.state", campaign: c });
      } else
        m.post(threadId, {
          author: { kind: "fume" },
          text: "Thanks. We have that now and will come back to you here.",
        });
    }, m.latency * 8);
    return wait(msg);
  }

  return {
    async threads() {
      return wait(m.inWorkspace(db.threads).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    },
    async messages(threadId) {
      const t = m.find(db.threads, threadId, "thread");
      t.unread = 0;
      return wait(db.messages.filter((x) => x.threadId === threadId).sort((a, b) => a.at.localeCompare(b.at)));
    },
    async send(threadId, text, attachments) {
      const t = db.threads.find((x) => x.id === threadId);
      if (t?.kind !== "contact" && !attachments?.length && answer(text, threadId))
        return wait(db.messages[db.messages.length - 1]);
      // A question that names nothing, sent while a brief is being written, is not its answer; it goes to the talk
      // about no campaign.
      const brief = t?.campaignId ? db.briefs.find((b) => b.campaignId === t.campaignId) : undefined;
      const g = general();
      if (
        t?.kind !== "contact" &&
        brief?.state === "drafting" &&
        g &&
        g.id !== threadId &&
        /\?\s*$/.test(text.trim()) &&
        /^(where|what|when|how|why|who|can|could|is|are|do|does)\b/i.test(text.trim())
      )
        return post(g.id, text, attachments);
      return post(threadId, text, attachments);
    },
    async conversation() {
      const ids = fumeThreadIds();
      return wait(db.messages.filter((x) => ids.has(x.threadId)).sort((a, b) => a.at.localeCompare(b.at)));
    },
    async say(text, attachments) {
      if (!attachments?.length && answer(text, undefined)) return wait(db.messages[db.messages.length - 1]);
      const t = text.toLowerCase();
      // A meeting: times Sander at Fume is free, and the topic carries over ("a meeting … about the Christmas plans?").
      if (/(meeting|møte|call|book)/.test(t)) {
        const msg: Message = {
          id: m.nextId("msg"),
          threadId: general()!.id,
          author: { kind: "person", userId: m.me().id },
          text,
          at: now(),
        };
        db.messages.push(msg);
        const topicWords = /\b(?:about|om)\s+(?:the\s+|our\s+|my\s+)?(.+?)[?.!\s]*$/i.exec(text)?.[1]?.trim();
        const topic = topicWords ? topicWords.charAt(0).toUpperCase() + topicWords.slice(1) : undefined;
        later(() =>
          fumeSays(
            `Here are times Sander at Fume is free${topic ? ` to talk about ${topicWords}` : ""}. Pick one, and we book it.`,
            { kind: "meeting", slots: slots(), ...(topic ? { topic } : {}) },
          ),
        );
        return wait(msg);
      }
      // Contracts, prices and invoices: a person at Fume answers.
      if (/(invoice|faktura|contract|kontrakt|price|pris|cancel|person|human|menneske)/.test(t)) {
        const msg: Message = {
          id: m.nextId("msg"),
          threadId: general()!.id,
          author: { kind: "person", userId: m.me().id },
          text,
          at: now(),
        };
        db.messages.push(msg);
        later(() =>
          fumeSays("That is one for a person. Sander at Fume will answer you here.", {
            kind: "handover",
            userId: "u-sander",
            reason: "Contracts, prices and invoices are handled by people at Fume.",
          }),
        );
        later(
          () =>
            fumeSays("Hi, Sander here. I'm looking at it and will answer here shortly.", undefined, {
              kind: "person",
              userId: "u-sander",
            }),
          24,
        );
        return wait(msg);
      }
      const g = general();
      if (!g) throw new FumeError("not_found", "No conversation with Fume");
      // A typed answer to Fume's latest question goes to the campaign it asked about, so it fills that brief.
      const ids = fumeThreadIds();
      const latest = db.messages
        .filter((x) => ids.has(x.threadId))
        .sort((a, b) => a.at.localeCompare(b.at))
        .at(-1);
      const asking =
        latest?.author.kind === "fume" && latest.card?.kind === "question"
          ? db.threads.find((x) => x.id === latest.threadId)
          : undefined;
      const open = asking?.campaignId
        ? db.briefs.find((b) => b.campaignId === asking.campaignId && b.state === "drafting")
        : undefined;
      return m.api.send(open && asking ? asking.id : g.id, text, attachments);
    },
    // A brief written without the chat: the message is its own line, never the notes; the notes go to Fume as her
    // words. The market and the number of creatives come from the form when it says them.
    async orderBrief(order) {
      const me = m.me();
      const id = m.nextId("c");
      const campaign: Campaign = {
        id,
        workspaceId: m.workspaceId,
        name: order.name || "New campaign",
        productIds: order.productIds,
        state: "draft",
        stage: "brief",
        approverId: "u-maja",
        channels: order.channels,
        formats: order.formats,
        market: order.market ?? "Norway",
        language: order.language ?? "Norwegian",
        dueAt: order.deadline,
        createdBy: me.id,
        createdAt: now(),
        updatedAt: now(),
        counts: { creatives: 0, inCheck: 0, checked: 0, approved: 0, delivered: 0 },
        roundsUsed: 0,
        roundsIncluded: 2,
        brandDnaVersion: 3,
        collectionIds: order.collectionIds,
      };
      db.campaigns.push(campaign);
      if (order.moodboard?.images.length) startCampaignBoard(m, campaign, order.moodboard.images);
      db.briefs.push({
        campaignId: id,
        version: 1,
        state: "ready",
        objective: order.goal,
        audience: order.audience ?? "",
        message: order.message ?? "",
        mandatory: order.mandatory ?? [],
        never: order.never ?? [],
        channels: order.channels,
        formats: order.formats,
        creatives: order.creatives && order.creatives > 0 ? Math.round(order.creatives) : order.formats.length * 4,
        references: order.references,
        missing: [],
      });
      const threadId = m.nextId("t");
      db.threads.push({
        id: threadId,
        workspaceId: m.workspaceId,
        campaignId: id,
        title: campaign.name,
        kind: "fume",
        updatedAt: now(),
        unread: 0,
      });
      if (order.notes.trim())
        db.messages.push({
          id: m.nextId("msg"),
          threadId,
          author: { kind: "person", userId: me.id },
          text: order.notes.trim(),
          at: now(),
        });
      const msg: Message = {
        id: m.nextId("msg"),
        threadId,
        author: { kind: "fume" },
        text: `${me.name.split(" ")[0]} wrote the brief for ${campaign.name}.`,
        at: now(),
        card: { kind: "brief", campaignId: id, version: 1 },
      };
      db.messages.push(msg);
      m.emit({ type: "message.new", message: msg });
      m.emit({ type: "campaign.state", campaign });
      return wait(campaign);
    },

    // ── Meetings ──
    async meetingSlots() {
      return wait(slots());
    },
    async bookMeeting({ at, topic }) {
      const meeting: Meeting = {
        id: m.nextId("mt"),
        workspaceId: m.workspaceId,
        topic,
        at,
        minutes: 30,
        hostId: "u-sander",
        guestIds: [m.me().id],
        state: "booked",
      };
      db.meetings.push(meeting);
      db.calendar.push({
        id: m.nextId("ce"),
        workspaceId: m.workspaceId,
        kind: "meeting",
        title: topic,
        start: at,
        meetingId: meeting.id,
      });
      fumeSays(`Booked: ${topic}, with Sander at Fume. It is in your calendar.`, {
        kind: "meeting",
        meetingId: meeting.id,
        slots: [at],
      });
      return wait(meeting);
    },
    async meetings() {
      return wait(db.meetings.filter((x) => x.workspaceId === m.workspaceId).sort((a, b) => a.at.localeCompare(b.at)));
    },
    async meetingTopics() {
      return wait([...MEETING_TOPICS]);
    },

    // ── What Fume still asks ──
    // In a brand an agency runs, Fume says why it asks in the agency's words: no Fume expert checks an agency's work.
    async questions() {
      const open = listQuestions(m, m.workspaceId);
      const said = m.agencyRun(m.workspaceId) ? open.map((q) => ({ ...q, why: agencyWhy(q.why) })) : open;
      return wait(withTemplates(said));
    },
    async answerQuestion(input) {
      answerOne(m, m.workspaceId, input);
      return wait(withTemplates(listQuestions(m, m.workspaceId)));
    },
  };
}
