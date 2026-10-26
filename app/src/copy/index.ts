// Every word the app shows about states, in one place (ARCHITECTURE §5), so the copy rules apply to all of it:
// "creative", never "file"; the expert checks ("In check", "Checked by Anna"); only the customer approves; name who
// acts; no exclamation marks. Sentences that belong to one screen stay in that screen, in the same voice.
import type { Campaign, CampaignStage, CampaignState, Channel, Format, PackageKind, VersionState } from "../contract";

/** One word for each state, everywhere: "Waiting on you" is the only name for a decision that waits on the customer, on
 *  a chip, a group title or a card. Use campaignStatus() where the campaign is at hand: it says "Waiting on you" only
 *  while something really does. */
export const waitingOnYou = "Waiting on you";

export const campaignState: Record<CampaignState, string> = {
  draft: "Drafting the brief",
  awaiting_input: waitingOnYou,
  scoped: "Brief sent",
  in_production: "In production",
  in_review: waitingOnYou,
  revision: "Changes under way",
  approved: "Approved",
  delivered: "Delivered",
  closed: "Closed",
};

/** What the customer can do next, per state; empty when Fume is the one working. */
export const campaignNext: Partial<Record<CampaignState, string>> = {
  draft: "Continue with Fume",
  awaiting_input: "Answer Fume",
  in_review: "Review",
  approved: "Get the delivery",
  delivered: "Download",
  closed: "Start the next campaign",
};

/** The six stages' words (features/campaigns/stages.ts): directions and masters are Masters, variants and formats are
 *  Creatives. */
export const stage: Record<CampaignStage, string> = {
  brief: "Brief",
  plan: "Plan",
  directions: "Masters",
  masters: "Masters",
  variants: "Creatives",
  delivery: "Delivery",
};

/** The four steps of a campaign, as the app demo shows them. */
export const steps = ["You write the brief", "The Engine works", "The expert checks", "You approve"] as const;

export const versionState: Record<VersionState, string> = {
  making: "The Engine is making it",
  in_check: "In check",
  correcting: "Anna is fixing it",
  held: "Held back",
  checked: "Checked",
  changes_requested: "You asked for changes",
  approved: "Approved",
  delivered: "In the delivery",
};

export const format: Record<Format, { label: string; ratio: string; size: string }> = {
  feed: { label: "Feed", ratio: "4:5", size: "1080 × 1350" },
  square: { label: "Square", ratio: "1:1", size: "1080 × 1080" },
  story: { label: "Story", ratio: "9:16", size: "1080 × 1920" },
};

export const channel: Record<Channel, string> = {
  paid_social: "Paid social",
  organic_social: "Organic social",
  email: "Email",
  product_page: "Product page",
  display: "Display",
};

export const packageName: Record<PackageKind, string> = { launch: "Launch", core: "Core", growth: "Growth" };

export const role = {
  owner: "Owner",
  approver: "Can approve",
  member: "Can comment",
  viewer: "Viewer",
} as const;

export const roleHelp = {
  owner: "Everything, including the team and the package",
  approver: "Sends briefs, approves plans and creatives",
  member: "Writes briefs, comments and asks for changes",
  viewer: "Sees campaigns and deliveries",
} as const;

export const factSource = {
  supplied: "You gave us this",
  verified: "You confirmed this",
  inferred: "Fume read this from your earlier work",
  learned: "Learned from your decisions",
  campaign: "For one campaign only",
  unknown: "Fume needs this from you",
} as const;

/** "Checked by Anna" (F-D077). */
export const checkedBy = (name: string) => `Checked by ${name}`;
export const approvedBy = (name: string) => `${name} approved`;
export const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const creatives = (n: number) => count(n, "creative");

/** Where a campaign stands, in one sentence. Every place that shows it calls this (Home, the Campaigns list, the
 *  campaign header, ⌘K, the collection, the chat cards, the bell), so a campaign never has two statuses: "6 creatives
 *  to approve", "A brief to send", "The plan is ready to approve", "Fume is writing the plan · by Thu 15 Oct", "3
 *  creatives in check". Never "Running", "In production" or "Brief approved"; the stage has its own line (the step
 *  dots).
 *  In the plan stage it says where the plan stands (`waits.plan`), never that directions are being made (FLOWS §22.3).
 *  The numbers come from the campaign's counts and `waits` (the backend fills them); `waits` passed here wins, for a
 *  page that knows more. `waiting` is true while it waits on the customer; `on` says who acts next. `{ date: false }`
 *  leaves out "· by <date>" where the date has a column of its own. "by" is the date Fume works to for the step under
 *  way; the go-live is `campaignLive()`. */
export function campaignStatus(
  c: CampaignStatusInput,
  waits?: Partial<CampaignWaits>,
  options?: CampaignStatusOptions,
): CampaignStatus {
  // One sentence per viewer. Without a viewer: the customer's, or the agency's under the agency's frame
  // (setStatusReader).
  const viewer: StatusViewer =
    options?.viewer ??
    (options?.asCustomer ? "customer" : (statusReader.viewer ?? (statusReader.agency ? "agency" : "customer")));
  if (viewer === "customer") return customerStatus(c, waits, options);
  const customerName = options?.customerName ?? (viewer === "agency" ? statusReader.client : undefined);
  const agencyName = options?.agencyName ?? statusReader.agencyName;
  return viewerStatus(c, waits, viewer, { ...options, customerName, agencyName });
}

function customerStatus(
  c: CampaignStatusInput,
  waits?: Partial<CampaignWaits>,
  options?: CampaignStatusOptions,
): CampaignStatus {
  const w: CampaignWaits = { questions: 0, directions: 0, briefReady: false, ...c.waits, ...waits };
  const by = options?.date !== false && w.by ? ` · by ${due(w.by)}` : "";
  const you = (words: string): CampaignStatus => ({ words, waiting: true, on: "you" });
  const fume = (words: string): CampaignStatus => ({ words, waiting: false, on: "fume" });
  const expert = (n: number): CampaignStatus => ({
    words: `${creatives(n)} in check${by}`,
    waiting: false,
    on: "expert",
  });
  const done = (words: string): CampaignStatus => ({ words, waiting: false, on: "done" });
  const { counts } = c;
  // The plan, while it is the step under way: Fume writes it, the expert checks it, she approves it (FLOWS §22.3).
  if (c.stage === "plan" && w.plan && w.plan !== "approved") {
    switch (w.plan) {
      case "writing":
        return fume(`${planStatus.writing}${by}`);
      case "in_check":
        return {
          words: `${options?.expertName ? `${options.expertName} is checking the plan` : planStatus.in_check}${by}`,
          waiting: false,
          on: "expert",
        };
      case "ready":
        return you(planStatus.ready);
      case "changes_asked":
        return fume(`${planStatus.changes_asked}${by}`);
    }
  }
  switch (c.state) {
    case "draft":
    case "awaiting_input":
      if (w.questions > 0) return you(`${count(w.questions, "question")} for you`);
      if (w.briefReady) return you("A brief to send");
      return you(c.state === "draft" ? "A brief to finish" : "Fume has a question for you");
    case "in_review":
      if (w.directions > 0) return you(`${count(w.directions, "direction")} to choose from`);
      // Only what was sent to her counts, never a checked creative not sent yet (`waits.toSend`).
      if (counts.checked - Math.min(counts.checked, w.toSend ?? 0) > 0)
        return you(`${creatives(counts.checked - Math.min(counts.checked, w.toSend ?? 0))} to approve`);
      if (counts.inCheck > 0) return expert(counts.inCheck);
      // In the plan stage, review means the plan (an older backend without `waits.plan`).
      if (c.stage === "plan") return you(planStatus.ready);
      // Without the campaign's waits (an older backend), review with nothing checked means directions to choose.
      if (!c.waits && !waits) return you("Directions to choose from");
      return fume(`Fume is making the next creatives${by}`);
    case "scoped":
    case "in_production":
    case "revision":
      if (counts.inCheck > 0 && c.stage !== "directions" && c.stage !== "brief" && c.stage !== "plan")
        return expert(counts.inCheck);
      return fume(`${campaignMaking(c)}${by}`);
    case "approved":
      return done(`${creatives(counts.approved)} approved`);
    case "delivered":
    case "closed":
      return done(`${creatives(counts.delivered || counts.approved)} delivered`);
  }
}

// Types and helpers for campaignStatus above, and the go-live.
import { due as dueDay } from "../lib/time";
import type { CampaignWaits } from "../contract";

/** What campaignStatus reads: a whole Campaign fits. */
export type CampaignStatusInput = Pick<Campaign, "state" | "counts"> & Partial<Pick<Campaign, "stage" | "waits">>;

export interface CampaignStatus {
  /** The one sentence, e.g. "6 creatives to approve". */
  words: string;
  /** True while a decision or an answer waits on the customer. */
  waiting: boolean;
  /** Who acts next: the customer, Fume, Fume's expert (creatives in check), the agency's client, or nobody. */
  on: "you" | "fume" | "expert" | "client" | "done";
}

// An agency's people read the same sentence the agency's way (FLOWS §24.2): the creatives they checked wait on the
// client ("6 creatives with Maja", never "to approve": only the client approves), and the creatives in check are theirs
// to check. The shell sets the reader from the session; it can also carry the viewer and the agency's name, for the
// lists that call campaignStatus(c) with no options.
let statusReader: StatusReader = { agency: false };
export interface StatusReader {
  agency: boolean;
  /** The client's first name, for the agency's sentences ("6 creatives with Maja"). */
  client?: string;
  /** Who reads, when a call's options don't say. */
  viewer?: StatusViewer;
  /** The agency's name, for its client ("Brygga Studio is planning"). */
  agencyName?: string;
}
export function setStatusReader(next: StatusReader) {
  statusReader = next;
}

/** "Sun, 18 Oct", "today", "tomorrow": the app's one way to say a day ahead (lib/time `due`). */
function due(iso: string): string {
  return dueDay(iso);
}

/** What is being made while nothing waits on the customer. The plan is Fume's (it writes it; nothing is generated
 *  before she approves it); masters and variants are creatives, which the Engine makes. "Fume is making 3 directions"
 *  stays only for a campaign that ran before the plan and still sits on its directions. */
export function campaignMaking(c: CampaignStatusInput): string {
  if (c.state === "revision")
    return c.stage === "plan" || c.stage === "brief" ? planStatus.changes_asked : "Fume is making your changes";
  switch (c.stage) {
    case "masters": {
      const n = c.waits?.masters;
      // Only the masters under way are counted, so "1 master" when the others wait.
      return n
        ? n === 1
          ? "The Engine is making 1 master"
          : `The Engine is making the ${n} masters`
        : "The Engine is making the masters";
    }
    case "variants":
      return "The Engine is making the variants";
    case "delivery":
      return "Fume is packing the delivery";
    case "directions":
      return "Fume is making 3 directions";
    default:
      // The brief is sent (stage brief or plan): Fume writes the plan.
      return planStatus.writing;
  }
}

// The plan wherever a campaign shows (FLOWS §22.3): the status sentence for each state, and the plan's state as a short
// meta (⌘K, the staff Check list). She sends the brief, Fume writes the plan, the expert checks it, she approves it;
// the Engine only makes creatives.
import type { PlanState } from "../contract";

/** The status sentence while the plan is the step under way (campaignStatus adds " · by Thu 15 Oct"). */
export const planStatus: Record<PlanState, string> = {
  writing: "Fume is writing the plan",
  in_check: "The plan is in check",
  ready: "The plan is ready to approve",
  changes_asked: "Fume is changing the plan",
  approved: "The plan is approved",
};

/** The plan's state in two or three words, after its name ("Winter gifting · Plan  Ready to approve"). */
export const planState: Record<PlanState, string> = {
  writing: "Fume is writing it",
  in_check: "In check",
  ready: "Ready to approve",
  changes_asked: "Fume is changing it",
  approved: "Approved",
};

/** "The plan for Winter gifting is ready": Home, the bell and the chat say it in these words (FLOWS §22.3). */
export const planReady = (campaign: string) => `The plan for ${campaign} is ready`;

/** The go-live, the one meaning of a campaign's date: "Live from Sat, 17 Oct"; "Went live 17 Oct" after. */
export function campaignLive(c: Pick<Campaign, "dueAt" | "state">): string | undefined {
  if (!c.dueAt) return undefined;
  return c.state === "delivered" || c.state === "closed"
    ? `Went live ${dueDay(c.dueAt)}`
    : `Live from ${dueDay(c.dueAt)}`;
}

/**
 * The person named, as the signed-in person reads it: "you" when it is them, otherwise their first name. `start` is for
 * the start of a sentence ("You approved it on 3 Oct"); mid-sentence it is "you" ("Chosen by you on 8 Oct"). Others
 * keep their names ("Jonas approved"). Pair it with useIsMe() from shell/people.ts:
 *   const isMe = useIsMe();
 *   `${copy.byYou(approver.name, isMe(approver.id), true)} approved it on 3 Oct`   → "You approved it on 3 Oct"
 *   `Chosen by ${copy.byYou(user.name, isMe(user.id))} on 8 Oct`                    → "Chosen by you on 8 Oct"
 */
export const byYou = (name: string, isMe: boolean, start = false): string =>
  isMe ? (start ? "You" : "you") : name.trim().split(/\s+/)[0] || name;

// The channel says what it is: "Display ads", not "Display".
channel.display = "Display ads";

// One status per campaign and viewer, and one name per creative (FLOWS §25.4).

/** Who reads the status sentence: the customer (Maja in Fume), Fume's people, an agency's people, or an agency's
 *  client. The person who acts reads "you"; everyone else reads that person's name. */
export type StatusViewer = "customer" | "staff" | "agency" | "client";

export interface CampaignStatusOptions {
  /** false leaves out "· by <date>" where the date has a column of its own. */
  date?: boolean;
  /** The customer's own words whatever the frame (the same as viewer "customer"). */
  asCustomer?: boolean;
  /** Who reads; the customer when left out (the agency under the agency's frame, setStatusReader). */
  viewer?: StatusViewer;
  /** The first name of the person who approves: "Maja" ("6 creatives with Maja", "The plan waits on Maja"). */
  customerName?: string;
  /** For an agency's client: the agency's name ("Brygga Studio is planning"). */
  agencyName?: string;
  /** For the customer: the expert's first name while she checks the plan ("Anna is checking the plan"). */
  expertName?: string;
}

/**
 * The sentence for everyone but the customer. Fume's people and an agency's people check creatives and send them as a
 * set ("6 creatives to send to Maja", then "6 creatives with Maja"). In Fume the expert checks the plan and the
 * customer approves it; in an agency the agency checks the plan and sends it, and the client approves it and the
 * creatives (FLOWS §26.8). So the client reads the agency's work as a fact ("Brygga Studio is planning") and the plan,
 * once sent, as hers ("The plan is ready to approve").
 * `on` says who acts: "you" (the reader), "client" (the customer or the client, when someone else reads), "fume" (the
 * maker: Fume, the Engine, or the agency for its client), "expert" or "done".
 */
function viewerStatus(
  c: CampaignStatusInput,
  waits: Partial<CampaignWaits> | undefined,
  viewer: Exclude<StatusViewer, "customer">,
  o: CampaignStatusOptions,
): CampaignStatus {
  const w: CampaignWaits = { questions: 0, directions: 0, briefReady: false, ...c.waits, ...waits };
  const by = o.date !== false && w.by ? ` · by ${due(w.by)}` : "";
  const who = o.customerName ?? (viewer === "agency" ? "the client" : "the customer");
  const Who = who.charAt(0).toUpperCase() + who.slice(1);
  const you = (words: string): CampaignStatus => ({ words, waiting: true, on: "you" });
  const them = (words: string): CampaignStatus => ({ words, waiting: false, on: "client" });
  const maker = (words: string): CampaignStatus => ({ words, waiting: false, on: "fume" });
  const done = (words: string): CampaignStatus => ({ words, waiting: false, on: "done" });
  const { counts } = c;
  // Checked, not sent yet: in Fume, the checked set of a campaign in production waits for the release; in an agency,
  // what the agency has not sent (the backend says it in `waits.toSend`).
  const toSend = Math.min(counts.checked, w.toSend ?? (c.state === "in_production" ? counts.checked : 0));
  const withThem = counts.checked - toSend;
  const ended =
    c.state === "approved"
      ? done(`${creatives(counts.approved)} approved`)
      : c.state === "delivered" || c.state === "closed"
        ? done(`${creatives(counts.delivered || counts.approved)} delivered`)
        : undefined;
  if (ended) return ended;

  if (viewer === "client") {
    // She approves the plan once the agency sent it, and the creatives; the agency writes the brief, plans, checks and sends.
    const agency = o.agencyName ?? "The agency";
    if (c.stage === "plan" && w.plan === "ready" && w.planChecked) return you(planStatus.ready);
    if (c.state === "in_review" && withThem > 0) return you(`${creatives(withThem)} to approve`);
    if (c.state === "draft" || c.state === "awaiting_input" || c.stage === "brief")
      return maker(`${agency} is writing the brief`);
    if (c.stage === "plan" || c.stage === "directions") return maker(`${agency} is planning${by}`);
    if (counts.inCheck > 0) return maker(`${agency} is checking ${creatives(counts.inCheck)}${by}`);
    return maker(`${campaignMaking(c).replace(/^(The Engine|Fume) is /, `${agency} is `)}${by}`);
  }

  const agency = viewer === "agency";
  // The plan, while it is the step under way.
  if (c.stage === "plan" && w.plan && w.plan !== "approved") {
    switch (w.plan) {
      case "writing":
        return maker(`${planStatus.writing}${by}`);
      case "changes_asked":
        return maker(`${planStatus.changes_asked}${by}`);
      case "in_check":
        return you(`Check the plan${by}`);
      case "ready":
        // An agency checks its plans and sends them; the client approves them (FLOWS §26.8).
        return agency && !w.planChecked ? you(`Check the plan${by}`) : them(`The plan waits on ${who}`);
    }
  }
  switch (c.state) {
    case "draft":
    case "awaiting_input":
      // The agency writes its client's brief with Fume; in Fume the customer does.
      if (agency) return customerStatus(c, waits, o);
      if (w.questions > 0) return them(`Waiting on ${who}: ${count(w.questions, "question")}`);
      if (w.briefReady) return them(`The brief waits on ${who} to send it`);
      return them(c.state === "draft" ? `${Who} is writing the brief` : `Waiting on ${who}: a question`);
    case "in_review":
      if (counts.inCheck > 0) return you(`${creatives(counts.inCheck)} to check`);
      if (toSend > 0) return you(`${creatives(toSend)} to send to ${who}`);
      if (w.directions > 0)
        return agency
          ? you(`${count(w.directions, "direction")} to choose from`)
          : them(`${count(w.directions, "direction")} with ${who}`);
      if (withThem > 0) return them(`${creatives(withThem)} with ${who}`);
      if (c.stage === "plan")
        return agency && !w.planChecked ? you(`Check the plan${by}`) : them(`The plan waits on ${who}`);
      return maker(`Fume is making the next creatives${by}`);
    case "scoped":
    case "in_production":
    case "revision":
      if (counts.inCheck > 0 && c.stage !== "directions" && c.stage !== "brief" && c.stage !== "plan")
        return you(`${creatives(counts.inCheck)} to check${by}`);
      if (toSend > 0) return you(`${creatives(toSend)} to send to ${who}`);
      return maker(`${campaignMaking(c)}${by}`);
    default:
      return customerStatus(c, waits, o);
  }
}

/** "6 creatives to send", "6 creatives with Maja": the sending words, the same in Fume and in an agency. */
export const send = {
  /** The checker's list, for a count: "6 to send". */
  toSend: (n: number) => `${n} to send`,
  /** A creative's state before it is sent. */
  notSent: "Checked, not sent",
  /** The action: "Send to Maja". */
  action: (name: string) => `Send to ${name}`,
  /** After sending: "With Maja". */
  withThem: (name: string) => `With ${name}`,
} as const;

/** The three dates a campaign has, each with its label, never a bare "Due". */
export const dateLabel = { plan: "Plan by", delivery: "Delivery", live: "Goes live", delivered: "Delivered" } as const;

const SHORT_LABEL = /^(Feed|Square|Story) [A-Z]?(\d+)$/;

/**
 * One name per creative: the only way to label a creative, in the chat, tiles, review, the viewer, the client link,
 * Check, Home, the Studio, Engine output, ⌘K and deliveries. A creative the plan named keeps that name with its format:
 * "Master 1 · Feed 4:5", "Master 1 in Story · Story 9:16". A creative made before plans existed is its product and its
 * number among the campaign's creatives in that format: "Night Body Oil · Feed 3" (its title is "Feed 3"). Never "A3",
 * "Variant 2" or "candidate, branch 2": the lineage stays in the Studio's version strip. A name it made before is read
 * as it is, so a name never doubles.
 */
export function creativeName(c: { title: string; format: Format; productName?: string; planName?: string }): string {
  const f = format[c.format];
  const shape = `${f.label} ${f.ratio}`;
  const planned = c.planName?.trim();
  if (planned) return planned.endsWith(` · ${shape}`) ? planned : `${planned} · ${shape}`;
  const parts = c.title.trim().split(" · ");
  const last = parts[parts.length - 1] ?? "";
  // Already whole: "The candle alone · Feed 4:5".
  if (parts.length > 1 && /^(Feed|Square|Story) \d+:\d+$/.test(last)) return parts.join(" · ");
  const short = SHORT_LABEL.exec(last);
  if (short) {
    const label = `${short[1]} ${short[2]}`;
    const subject = parts.length > 1 ? parts.slice(0, -1).join(" · ") : c.productName?.trim();
    return subject ? `${subject} · ${label}` : label;
  }
  // A name from before the plan named it ("Master 2 · Variant 2 · square"): the master's name alone, then the format.
  const own =
    /^(Master \d+) · Variant \d+/.exec(parts.join(" · "))?.[1] ??
    parts.filter((p) => !/^(feed|square|story)$/i.test(p)).join(" · ");
  return `${own || f.label} · ${shape}`;
}

/** The creative's number in its format alone ("Feed 3"), for a tile's caption under a heading that names the product. */
export function creativeLabel(c: { title: string; format: Format; planName?: string }): string {
  const name = creativeName(c);
  const parts = name.split(" · ");
  const last = parts[parts.length - 1] ?? name;
  return SHORT_LABEL.test(last) ? last : parts.slice(0, -1).join(" · ") || name;
}

/** A campaign's next date, always with its label: "Plan by" while Fume writes or the expert checks the plan, the plan's
 *  "Delivery" until it is delivered, then "Delivered"; "Goes live" only when no delivery date is known.
 *  `{ delivery: true }` skips "Plan by" (the Deliveries list). */
export function campaignDate(
  c: CampaignStatusInput & Pick<Campaign, "dueAt">,
  options?: { delivery?: boolean },
): { label: string; at: string } | undefined {
  const w = c.waits;
  if (c.state === "delivered" || c.state === "closed")
    return w?.delivery
      ? { label: dateLabel.delivered, at: w.delivery }
      : c.dueAt
        ? { label: "Went live", at: c.dueAt }
        : undefined;
  // `delivery`: the delivery's own date (Deliveries), never the plan's.
  if (!options?.delivery && c.stage === "plan" && w?.plan && w.plan !== "approved" && w.plan !== "ready" && w.by)
    return { label: dateLabel.plan, at: w.by };
  if (w?.delivery) return { label: dateLabel.delivery, at: w.delivery };
  return c.dueAt ? { label: dateLabel.live, at: c.dueAt } : undefined;
}

/** "Plan by Fri 16 Oct", "Delivery Tue 27 Oct", "Delivered 3 Oct". */
export function campaignDateWords(c: CampaignStatusInput & Pick<Campaign, "dueAt">): string | undefined {
  const d = campaignDate(c);
  if (!d) return undefined;
  return `${d.label} ${d.label === dateLabel.delivered || d.label === "Went live" ? dayMonth(d.at) : due(d.at)}`;
}

/** "3 Oct": a day in the past, without the weekday. */
function dayMonth(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()]}`;
}

/** "2 of 11 approved", or "Planned: 9 creatives" before any is made (never "0 of 0"). */
export function approvedOf(approved: number, total: number, planned?: number): string {
  if (total > 0) return `${approved} of ${total} approved`;
  return planned ? `Planned: ${creatives(planned)}` : "No creatives yet";
}

/** What waits for a check, as one count with its parts: "6 to check: 1 plan, 5 creatives". */
export function toCheck(plans: number, creativesWaiting: number): string {
  const total = plans + creativesWaiting;
  if (!total) return "Nothing to check";
  if (!plans || !creativesWaiting)
    return plans ? `${count(plans, "plan")} to check` : `${creatives(creativesWaiting)} to check`;
  return `${total} to check: ${count(plans, "plan")}, ${creatives(creativesWaiting)}`;
}
