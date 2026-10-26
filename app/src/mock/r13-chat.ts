// Round 13 CHAT (Marcus's video comments of 21 Oct, #6, #11, #16, #17, #20; robot notes 02-home-chat; PROPOSED 22 Oct
// 2026). The mock's Fume, a little cleverer in the one conversation:
// - #16: a message that names a campaign, a product, a collection or a creative (with "@" or in plain words, "Where
//   are the last 3 Autumn launch creatives?") gets a plain answer from what the app knows: where it is, the numbers,
//   what comes next, and a link card that opens it in the panel beside the conversation. "What waits on me?" and
//   "This month in numbers" answer with a card read from the same source as Home, so the numbers always match.
//   Robot note 02: such a question is never taken as an answer to a brief still being written (it was filed as Hand
//   Balm's claims); a question that names nothing goes to the talk about no campaign.
// - #20: changePlanWithFume: she changes the plan in the chat before the Engine starts. The number of creatives, how
//   many are videos or carousels, and the dates are changed at once in a new version that says what changed; anything
//   else goes to Fume as a change request (askPlanChanges), as on the plan page.
// - #11: the topics a meeting with Fume is usually about.
// - #6: a product question whose answer the brand's website does not give comes with templates: what this kind of
//   product usually says, to start from.
import type {
  Brief,
  Campaign,
  CampaignPlan,
  ChatLink,
  Collection,
  Creative,
  FumeApi,
  FumeEvent,
  Id,
  Message,
  OpenQuestion,
  PlannedCreative,
  Product,
  Thread,
  User,
} from "../contract";

interface Db {
  campaigns: Campaign[];
  briefs: Brief[];
  creatives: Creative[];
  products: Product[];
  collections: Collection[];
  threads: Thread[];
  messages: Message[];
  plans: CampaignPlan[];
  users: User[];
  staff: { userId: Id; workspaceId: Id; staffRole: string }[];
}

export interface R13ChatContext {
  db: Db;
  wait: <T>(value: T) => Promise<T>;
  now: () => string;
  nextId: (prefix: string) => string;
  emit: (event: FumeEvent) => void;
  say: (threadId: Id, message: Omit<Message, "id" | "threadId" | "at">) => Message;
  userId: () => Id;
  workspaceId: () => Id;
  /** The api as it was before this layer's wraps: its say, send, questions and askPlanChanges. */
  base: () => FumeApi;
  latency: number;
}

/** #11: what a meeting with Fume is usually about (mock data; the backend serves the brand's own). */
export const MEETING_TOPICS = [
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

/** #6: what the claims of this kind of product usually say. */
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

export function r13ChatApi(ctx: R13ChatContext): {
  calls: Pick<FumeApi, "meetingTopics" | "changePlanWithFume">;
  wraps: Pick<FumeApi, "say" | "send" | "questions" | "answerQuestion">;
} {
  const { db, now } = ctx;
  const base = () => ctx.base();
  const mine = <T extends { workspaceId: Id }>(rows: T[]) => rows.filter((r) => r.workspaceId === ctx.workspaceId());
  const general = () =>
    db.threads.find((t) => t.workspaceId === ctx.workspaceId() && t.kind !== "contact" && t.campaignId === null);
  const expertName = () =>
    firstName(
      db.users.find((u) =>
        db.staff.some((s) => s.userId === u.id && s.workspaceId === ctx.workspaceId() && s.staffRole === "expert"),
      ),
    ) ?? "the expert";
  /** The campaign's own thread in the conversation (made now if it has none). */
  const threadOf = (c: Campaign): Thread => {
    let t = db.threads.find((x) => x.campaignId === c.id && x.kind !== "contact");
    if (!t) {
      t = {
        id: ctx.nextId("t"),
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
  const later = (fn: () => void) => setTimeout(fn, ctx.latency * 6);

  // ── what a message is about ──
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
    if (p.state === "verified")
      return `${name} is confirmed, so Fume can make creatives of it.${using.length ? ` It is in ${list(using)}.` : " No campaign uses it yet."}`;
    const open = p.facts.filter((f) => f.source === "unknown").map((f) => lower(f.label));
    return `${name} is not confirmed yet${open.length ? `: Fume still needs ${list(open.map((o) => `the ${o}`))}` : ""}.${using.length ? ` ${list(using)} ${using.length === 1 ? "waits" : "wait"} on it.` : ""} Confirm it and Fume can make creatives of it.`;
  }
  function collectionWords(c: Collection): string {
    const products = db.products.filter((p) => c.productIds.includes(p.id));
    const ready = products.filter((p) => p.state === "verified").map((p) => p.name);
    const waiting = products.filter((p) => p.state !== "verified").map((p) => p.name);
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

  /** Fume answers a question about something the app knows. False when the text is not such a question. */
  function answer(text: string, from: Id | undefined): boolean {
    const g = general();
    const t = text.trim();
    if (!g || !t) return false;
    const me = { kind: "person" as const, userId: ctx.userId() };
    if (WAITING.test(t) || MONTH.test(t)) {
      const of = WAITING.test(t) ? "waiting" : "month";
      ctx.say(g.id, { author: me, text: t });
      later(() =>
        ctx.say(g.id, {
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
    ctx.say(thread.id, { author: me, text: t });
    thread.updatedAt = now();
    later(() => ctx.say(thread.id, { author: { kind: "fume" }, text: words, card: { kind: "link", link } }));
    return true;
  }

  // ── #20: the plan, changed in the chat ──
  const ORD: Record<string, number> = {
    one: 1,
    a: 1,
    an: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
  };
  const num = (w: string | undefined) =>
    w === undefined ? undefined : /^\d+$/.test(w) ? Number(w) : ORD[w.toLowerCase()];
  const N = "(\\d+|one|a|an|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)";
  const MONTHS = ["jan", "feb", "mar", "apr", "ma", "jun", "jul", "aug", "sep", "o", "nov", "d"];
  /** "30 Oct", "1. desember", "Friday" as the next such day. */
  function dayIn(text: string): string | undefined {
    const d = /\b(\d{1,2})\.?\s*(jan|feb|mar|apr|may|mai|jun|jul|aug|sep|oct|okt|nov|dec|des)/i.exec(text);
    const today = new Date(now());
    if (d) {
      const month = MONTHS.findIndex((m) => d[2].toLowerCase().startsWith(m));
      if (month >= 0)
        return new Date(
          Date.UTC(today.getUTCFullYear() + (month < today.getUTCMonth() ? 1 : 0), month, Number(d[1]), 15),
        ).toISOString();
    }
    const w = /\b(monday|tuesday|wednesday|thursday|friday)\b/i.exec(text);
    if (w) {
      const want = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].indexOf(
        w[1].toLowerCase(),
      );
      const at = new Date(today);
      do at.setUTCDate(at.getUTCDate() + 1);
      while (at.getUTCDay() !== want);
      at.setUTCHours(15, 0, 0, 0);
      return at.toISOString();
    }
    return undefined;
  }
  const shift = (iso: string, days: number) => new Date(Date.parse(iso) + days * 864e5).toISOString();

  /** The changes the words ask for, made on the plan. Returns what changed, one line each; none when the words ask for
   *  something else (Fume then takes it as a change request). */
  function applyNumbers(p: CampaignPlan, text: string): string[] {
    const direction = p.directions.find((d) => d.id === p.chosenDirectionId) ?? p.directions[0];
    if (!direction) return [];
    const changes: string[] = [];
    const list_ = direction.creatives;
    const masters = () => list_.filter((c) => c.kind === "master");
    const total = num(new RegExp(`\\b${N}\\s+(?:creatives|in all|in total)\\b`, "i").exec(text)?.[1]);
    const videos = /\bno videos?\b/i.test(text)
      ? 0
      : (num(new RegExp(`\\b${N}\\s+(?:of them\\s+)?(?:as\\s+)?videos?\\b`, "i").exec(text)?.[1]) ??
        (/\b(more|some|add (a )?)videos?\b|\bvideos? too\b/i.test(text)
          ? Math.max(2, list_.filter((c) => c.medium === "video").length + 1)
          : undefined));
    const carousels = /\bno carousels?\b/i.test(text)
      ? 0
      : (num(new RegExp(`\\b${N}\\s+(?:of them\\s+)?(?:as\\s+)?carousels?\\b`, "i").exec(text)?.[1]) ??
        (/\b(more|some|add (a )?)carousels?\b|\bcarousels? too\b/i.test(text)
          ? Math.max(1, list_.filter((c) => c.medium === "carousel").length + 1)
          : undefined));
    // how many in all: more variants of the masters, or fewer from the end (the masters stay)
    if (total !== undefined && total > 0 && total !== list_.length) {
      const was = list_.length;
      while (list_.length < total) {
        const m = masters()[list_.length % Math.max(1, masters().length)] ?? list_[0];
        if (!m) break;
        const format = list_.length % 2 ? "story" : "feed";
        const n = list_.filter((c) => c.format === format).length + 1;
        list_.push({
          id: ctx.nextId("pc"),
          name: `${format === "story" ? "Story" : "Feed"} ${n}`,
          kind: "variant",
          of: m.id,
          format,
          productIds: m.productIds,
          scene: `${m.scene.replace(/[.\s]+$/, "")}, as a ${format === "story" ? "story" : "feed post"}.`,
          text: m.text,
          people: m.people,
          changedBy: "fume",
          changedAt: now(),
        } as PlannedCreative);
      }
      while (list_.length > Math.max(total, 1)) {
        const i = list_.map((c) => c.kind).lastIndexOf("variant");
        list_.splice(i >= 0 ? i : list_.length - 1, 1);
      }
      changes.push(`${list_.length} creatives (was ${was})`);
    }
    const make = (medium: "video" | "carousel", want: number) => {
      const has = list_.filter((c) => c.medium === medium);
      if (want === has.length) return;
      // a video is a story, a carousel a feed post; the masters stay stills
      while (list_.filter((c) => c.medium === medium).length > want) {
        const c = [...list_].reverse().find((x) => x.medium === medium)!;
        c.medium = "image";
        c.name = c.name.replace(/ · (video|carousel)$/, "");
      }
      const free = () => list_.filter((c) => c.kind === "variant" && (c.medium ?? "image") === "image");
      while (list_.filter((c) => c.medium === medium).length < want) {
        let c = free().find((x) => x.format === (medium === "video" ? "story" : "feed")) ?? free()[0];
        if (!c) {
          const m = masters()[0] ?? list_[0];
          if (!m) break;
          c = {
            id: ctx.nextId("pc"),
            name: `${medium === "video" ? "Story" : "Feed"} ${list_.length + 1}`,
            kind: "variant",
            of: m.id,
            format: medium === "video" ? "story" : "feed",
            productIds: m.productIds,
            scene: m.scene,
            text: m.text,
            people: m.people,
          } as PlannedCreative;
          list_.push(c);
        }
        Object.assign(c, {
          medium,
          format: medium === "video" ? "story" : "feed",
          name: `${c.name} · ${medium}`,
          changedBy: "fume",
          changedAt: now(),
        });
      }
      changes.push(`${count(want, medium)}${has.length ? ` (was ${has.length})` : ""}`);
    };
    if (videos !== undefined) make("video", videos);
    if (carousels !== undefined) make("carousel", carousels);
    // the dates: the masters' day, the go-live, or everything a week earlier or later
    const masterStep = p.timeline[0];
    const liveStep = p.timeline.find((s) => /^goes live/i.test(s.label));
    const when = dayIn(text);
    if (when && /\bmasters?\b/i.test(text) && masterStep) {
      masterStep.at = when;
      changes.push(`the masters by ${dayWords(when)}`);
    } else if (when && /\b(live|launch|go(es)? out|publish)\b/i.test(text) && liveStep) {
      liveStep.at = when;
      const c = db.campaigns.find((x) => x.id === p.campaignId);
      if (c) c.dueAt = when;
      changes.push(`goes live ${dayWords(when)}`);
    } else {
      const weeks = /\b(a|one|two|2|1) weeks? (earlier|sooner|later)\b/i.exec(text);
      if (weeks) {
        const days = (/two|2/.test(weeks[1]) ? 14 : 7) * (/later/i.test(weeks[2]) ? 1 : -1);
        p.timeline.forEach((s) => (s.at = shift(s.at, days)));
        const c = db.campaigns.find((x) => x.id === p.campaignId);
        if (c?.dueAt) c.dueAt = shift(c.dueAt, days);
        changes.push(
          `every date ${weeks[1].replace(/^a$/, "one")} week${/two|2/.test(weeks[1]) ? "s" : ""} ${lower(weeks[2]) === "sooner" ? "earlier" : lower(weeks[2])}`,
        );
      }
    }
    return changes;
  }

  async function changePlanWithFume(campaignId: Id, text: string): Promise<CampaignPlan> {
    const p = db.plans.find((x) => x.campaignId === campaignId);
    const c = db.campaigns.find((x) => x.id === campaignId);
    if (!p || !c) throw new Error("No plan for this campaign yet.");
    const words = text.trim();
    const t = threadOf(c);
    const me = { kind: "person" as const, userId: ctx.userId() };
    // Round 13 (Marcus's card, 23 Oct 2026): in agency work the agency's plan, once checked and sent, is the client's.
    const agency = Boolean(db.users.find((u) => u.id === ctx.userId())?.agency);
    const client = firstName(db.users.find((u) => u.id === c.approverId)) ?? "the client";
    if (agency && p.state === "ready" && p.checkedBy) {
      ctx.say(t.id, { author: me, text: words });
      later(() =>
        ctx.say(t.id, {
          author: { kind: "fume" },
          text: `You sent this plan to ${client}, so it stays as it is while it is with her. If she asks for changes, Fume writes the next version and you check it again.`,
        }),
      );
      return ctx.wait(p);
    }
    if (p.state !== "ready") {
      ctx.say(t.id, { author: me, text: words });
      const why =
        p.state === "approved"
          ? `${agency ? `${client} approved` : "You approved"} this plan, and the Engine has started, so it stays as it is. Ask for a change on a creative once you see it.`
          : `${p.state === "in_check" ? `${expertName()} is checking the plan` : "Fume is still writing the plan"}${p.readyBy ? ` until ${dayWords(p.readyBy)}` : ""}. Tell me again once it is ready, and Fume changes it then.`;
      later(() => ctx.say(t.id, { author: { kind: "fume" }, text: why }));
      return ctx.wait(p);
    }
    // a copy to try the words on: only a change Fume can make at once is kept
    const trial = structuredClone(p);
    const changes = applyNumbers(trial, words);
    if (!changes.length) return base().askPlanChanges(campaignId, words);
    Object.assign(p, trial, {
      version: p.version + 1,
      writtenAt: now(),
      note: { by: "fume", text: `Changed as you asked: ${changes.join("; ")}.`, at: now() },
      versions: [...(p.versions ?? []), { version: p.version + 1, at: now(), by: ctx.userId(), asked: words, changes }],
      checkedBy: undefined,
      checkedAt: undefined,
    });
    ctx.say(t.id, { author: me, text: words });
    t.updatedAt = now();
    later(() => {
      ctx.say(t.id, {
        author: { kind: "fume" },
        text: `Version ${p.version}: ${changes.join("; ")}. It is in the panel; ${agency ? `check it and send it to ${client}. Nothing is made before she approves it.` : "nothing is made before you approve it."}`,
        card: { kind: "plan", campaignId, version: p.version },
      });
      ctx.emit({ type: "campaign.state", campaign: c });
    });
    return ctx.wait(p);
  }

  // ── #6: templates for a product question the website does not answer ──
  const site = () => (ctx.workspaceId() === "w-lysne" ? "lysne.no" : "Your website");
  function withTemplates(list_: OpenQuestion[]): OpenQuestion[] {
    return list_.map((q) => {
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

  const calls: Pick<FumeApi, "meetingTopics" | "changePlanWithFume"> = {
    async meetingTopics() {
      return ctx.wait([...MEETING_TOPICS]);
    },
    changePlanWithFume,
  };
  const wraps: Pick<FumeApi, "say" | "send" | "questions" | "answerQuestion"> = {
    async say(text, attachments) {
      if (!attachments?.length && answer(text, undefined)) return ctx.wait(db.messages[db.messages.length - 1]);
      return base().say(text, attachments);
    },
    async send(threadId, text, attachments) {
      const t = db.threads.find((x) => x.id === threadId);
      if (t?.kind !== "contact" && !attachments?.length && answer(text, threadId))
        return ctx.wait(db.messages[db.messages.length - 1]);
      // Robot note 02: a question that names nothing, sent while a brief is being written, is not its answer; it goes
      // to the talk about no campaign.
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
        return base().send(g.id, text, attachments);
      return base().send(threadId, text, attachments);
    },
    async questions() {
      return withTemplates(await base().questions());
    },
    async answerQuestion(input) {
      return withTemplates(await base().answerQuestion(input));
    },
  };
  return { calls, wraps };
}
