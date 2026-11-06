// The plan (FLOWS §22): she sends her brief; Fume writes the plan from it, the Brand DNA, the taste, the moodboard and
// Creative Memory; she approves it (the expert checks it first only when she asks); only then does the Engine start
// on the masters. In a brand an agency runs, the agency checks the plan and sends it to its client, and only the
// client approves it, in Fume or in the client link.
import {
  FumeError,
  type Brief,
  type Campaign,
  type CampaignPlan,
  type Direction,
  type EngineRun,
  type FumeApi,
  type Id,
  type Notification,
  type PlanDirection,
  type PlanLine,
  type PlannedCreative,
  type ServiceClock,
  type Thread,
} from "../contract";
import { addWorkingDays } from "../domain/dates";
import {
  canAnswerClientLink,
  canApprovePlan,
  canAskPlanChanges,
  canCheckPlan,
  canShapePlan,
  canUndoPlanApproval,
} from "../domain/permissions";
import { briefGap, mastersOnHold, planAllows, planTimeline, seesPlan } from "../domain/plan";
import { productsToConfirm } from "../domain/products";
import type { Mock } from "./context";
import type { Db } from "./db";
import { NOW } from "./seed";
import { gen, img } from "./seed/helpers";
import { line, ref } from "./seed/plans";

type Calls =
  | "plan"
  | "sendBrief"
  | "approveBrief"
  | "approvePlan"
  | "undoApprovePlan"
  | "changePlan"
  | "choosePlanDirection"
  | "askPlanChanges"
  | "checkPlan"
  | "askPlanCheck"
  | "answerClientPlan"
  | "changePlanWithFume";

/** How long the mock lets Fume write, the expert check and Fume change a plan, in ms (short, so the flow can be
 *  tried end to end). */
const PACE = { write: 2500, check: 4000, change: 2500 };

const dayWords = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Oslo" })
    .format(new Date(iso))
    .replace(",", "");
const list = (names: string[]) =>
  names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : (names[0] ?? "");
const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

// ─── The plan Fume writes ──────────────────────────────────────────────────

const formatWord = { feed: "Feed 4:5", story: "Story 9:16", square: "Square 1:1" } as const;

/** Fume writes a plan from the brief, the products and what it knows of the brand. `direction` is a direction that
 *  was already chosen (a campaign from before the plan), which then is the plan's only direction. */
export function writePlan(
  db: Pick<Db, "products" | "creatives" | "references">,
  campaign: Campaign,
  brief: Brief,
  direction?: Direction,
): CampaignPlan {
  const products = db.products.filter((p) => campaign.productIds.includes(p.id));
  const names = products.map((p) => `${p.name}${p.variant ? ` ${p.variant}` : ""}`);
  const productWords =
    names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : (names[0] ?? "the products");
  // In a sentence the products go by their names alone ("Evening Candle and Evening Ritual gift box"), never with sizes.
  const plain = products.map((p) => p.name);
  const productNames =
    plain.length > 1 ? `${plain.slice(0, -1).join(", ")} and ${plain[plain.length - 1]}` : (plain[0] ?? "the products");
  const formats = brief.formats.length
    ? brief.formats
    : campaign.formats.length
      ? campaign.formats
      : (["feed"] as const);
  // A plan written from a campaign that ran before it counts what that campaign really holds: its masters, their
  // shapes and all its creatives, so the plan and the Masters delivery say the same.
  const made = direction ? db.creatives.filter((c) => c.campaignId === campaign.id) : [];
  const madeMasters = made.filter((c) => c.kind === "master").length;
  const madeShapes = made.filter((c) => c.kind === "master").map((c) => c.format);
  const total = made.length || brief.creatives || formats.length * 3;
  const masters = madeMasters || Math.max(1, Math.min(3, Math.ceil(total / 3)));
  const lower = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
  const trim = (s: string) => s.replace(/[.\s]+$/, "");
  const market = campaign.market ?? "Norway";
  const language = campaign.language ?? "Norwegian";
  const live = campaign.dueAt ? `, from ${dayWords(campaign.dueAt)}` : "";
  const summary = [
    // Her objective is already a sentence about the campaign; it leads as she wrote it.
    brief.objective
      ? `${trim(brief.objective).charAt(0).toUpperCase()}${trim(brief.objective).slice(1)}.`
      : `${campaign.name} puts ${productNames} forward.`,
    brief.audience ? `It speaks to ${lower(trim(brief.audience))}.` : "",
    brief.message ? `The message: ${lower(trim(brief.message))}.` : "",
    `It runs in ${market}, in ${language}${live}.`,
  ]
    .filter(Boolean)
    .join(" ");
  const liked = db.references
    .filter((r) => r.verdict === "liked")
    .map((r) => ref(r.image, r.note ?? "A picture you liked", "taste"));
  const productRefs = products.flatMap((p) =>
    p.images.slice(0, 2).map((image) => ref(image, `${p.name}, as its Product Truth shows it`, "product")),
  );
  const ids = products.map((p) => p.id);
  const look = (light: string, set: string, people: string): PlanLine[] => [
    line("light", "Light", light, "brand_dna", "Your Brand DNA: warm neutrals and amber light"),
    line(
      "camera",
      "Camera",
      "50 mm, close and level with the product; the product sharp, the set soft behind.",
      "fume",
    ),
    line("set", "Set", set, "brand_dna"),
    line("props", "Props", "Only what the product needs: linen, stone, a little glass.", "brand_dna"),
    line("colour", "Colour", "Warm neutrals, amber glass and cream. No saturated colour.", "brand_dna"),
    line("people", "People", people, "brand_dna", "AI models only, always labelled; skin in crops"),
  ];
  // The words on the picture are in the campaign's language: the brief's message as it stands only when that is English;
  // otherwise Fume writes the line from it (the Text line says so), so no English line is planned on a Norwegian creative.
  const english = /^english$/i.test(language);
  const words = english && brief.message ? trim(brief.message) : undefined;
  // Variants never repeat a master's own format or one another: past the formats, a variant is another crop.
  const crops = [
    { name: "closer", scene: "closer: the product fills more of the frame" },
    { name: "wider", scene: "wider: more of the set around the product" },
    { name: "from above", scene: "from above, the same set" },
  ];
  const creativesFor = (prefix: string, scene: (i: number) => string): PlannedCreative[] => {
    const out: PlannedCreative[] = [];
    for (let i = 0; i < masters; i++)
      out.push({
        id: `${prefix}-m${i + 1}`,
        name: `Master ${i + 1}`,
        kind: "master",
        format: madeShapes[i] ?? formats[i % formats.length],
        productIds: [ids[i % Math.max(1, ids.length)]].filter(Boolean),
        scene: scene(i),
        text: words,
        people: "No people",
      });
    for (let v = 0; out.length < total; v++) {
      const of = out[v % masters];
      const round = Math.floor(v / masters);
      // first the master in each of the other formats; then a different crop in the master's own format
      const others = formats.filter((f) => f !== of.format);
      const variant =
        round < others.length
          ? {
              name: `${of.name} in ${formatWord[others[round]].split(" ")[0]}`,
              format: others[round],
              scene: `${of.name} in ${formatWord[others[round]]}, the same scene fitted to the frame.`,
            }
          : (() => {
              const crop = crops[(round - others.length) % crops.length];
              return { name: `${of.name}, ${crop.name}`, format: of.format, scene: `${of.name}, ${crop.scene}.` };
            })();
      out.push({
        id: `${prefix}-v${v + 1}`,
        kind: "variant",
        of: of.id,
        productIds: of.productIds,
        text: of.text,
        people: of.people,
        ...variant,
      });
    }
    return out;
  };
  const scenes = [
    (i: number) =>
      [
        `${products[0]?.name ?? "The product"} low in the frame on pale stone, warm side light, air above.`,
        `${products[1]?.name ?? products[0]?.name ?? "The product"} on folded linen, the light from the left.`,
        "The products together, seen from above on linen.",
      ][i] ?? "The product on stone in evening light.",
    (i: number) =>
      [
        `Close on ${products[0]?.name ?? "the product"}: its texture in a stripe of warm light.`,
        "The label close, the set soft behind.",
        "The product lying on linen, light across it.",
      ][i] ?? "Close on the product.",
    (i: number) =>
      [
        `A crop of skin and ${products[0]?.name ?? "the product"} in evening light, never a face.`,
        "Hands open the product on linen.",
        "The product on a bedside, one lamp.",
      ][i] ?? "The product at the hour before sleep.",
  ];

  const directions: PlanDirection[] = direction
    ? [
        {
          id: `pd-${direction.id}`,
          letter: direction.letter === "D" ? "A" : direction.letter,
          name: direction.name,
          recommended: true,
          idea: [direction.insight, direction.visualIdea].filter(Boolean).join(" "),
          hook: direction.hook,
          why: direction.whyItFits ? [{ text: direction.whyItFits, source: "brand_dna" }] : [],
          references: (direction.images.length ? direction.images : [direction.cover]).map((image) =>
            ref(image, direction.name, "fume"),
          ),
          look: look(direction.visualIdea || "Low, warm side light.", "Stone, linen and glass.", "No people."),
          creatives: creativesFor(`pc-${campaign.id}`, scenes[0]),
        },
      ]
    : [
        {
          id: `pd-${campaign.id}-a`,
          letter: "A",
          name: "Evening light",
          recommended: true,
          idea: `${productNames} at the hour before sleep: low, warm side light on stone and linen, the product low in the frame with air above it.`,
          hook: brief.message || "The hour before sleep, slowed down.",
          why: [
            { text: "Warm, low side light leads in your Brand DNA.", source: "brand_dna" },
            { text: "Your liked pictures keep the product low, with air above it.", source: "taste" },
            { text: "Evening stone won in your last campaign.", source: "memory" },
          ],
          references: [...productRefs.slice(0, 2), ...liked.slice(0, 3)],
          look: look(
            "Low, warm side light from the left, long soft shadows.",
            "Pale stone and folded linen.",
            "No people.",
          ),
          creatives: creativesFor(`pc-${campaign.id}-a`, scenes[0]),
        },
        {
          id: `pd-${campaign.id}-b`,
          letter: "B",
          name: "Close and quiet",
          idea: `Close on ${productNames}: the texture, the label and a stripe of warm light. Fewer things in the frame, the product nearer.`,
          hook: "Made to be felt.",
          why: [
            { text: "Close crops suit a product people touch every day.", source: "fume" },
            { text: "Golden, never orange: the Product Truth's colours lead.", source: "product" },
          ],
          references: [
            ...productRefs.slice(0, 1),
            ref(img("05-03"), "Texture in warm light", "fume"),
            ref(img("06-04"), "Close, a stripe of light", "fume"),
          ],
          look: look(
            "A stripe of warm light across the product, the rest in soft shadow.",
            "Stone, close; nothing else in the frame.",
            "No people.",
          ),
          creatives: creativesFor(`pc-${campaign.id}-b`, scenes[1]),
        },
        {
          id: `pd-${campaign.id}-c`,
          letter: "C",
          name: "The ritual",
          idea: `${productNames} in use: a crop of skin or hands at the hour before sleep, never a face. Closest to the feeling, furthest from a packshot.`,
          hook: "The last quiet hour of the day.",
          why: [
            { text: "Skin in crops, as your Brand DNA prefers; no face in this direction.", source: "brand_dna" },
            { text: "You passed on hands that hold the bottle once: here they never do.", source: "memory" },
          ],
          references: [
            ref(gen("taste-hands"), "Hands in evening light", "taste"),
            ref(gen("taste-bedroom"), "The evening room", "taste"),
          ],
          look: look(
            "One warm lamp, low; the room in soft shadow.",
            "A bedside of oak and linen.",
            "Hands or a crop of skin, never a face; never holding the product.",
          ),
          creatives: creativesFor(`pc-${campaign.id}-c`, scenes[2]),
        },
      ];

  const approvedAt = direction?.decidedAt ?? brief.approvedAt;
  const start = approvedAt ?? new Date(NOW).toISOString();
  return {
    campaignId: campaign.id,
    version: 1,
    state: direction ? "approved" : "writing",
    briefVersion: brief.version,
    summary,
    directions,
    chosenDirectionId: directions[0].id,
    content: [
      line("products", "Products", `${productWords}, as their Product Truth says.`, "product"),
      line(
        "formats",
        "Formats",
        `${formats.map((f) => formatWord[f]).join(", ")}: ${total} creatives in all, as your brief asks.`,
        "brief",
      ),
      line(
        "text",
        "Text on the creative",
        !brief.message
          ? "No words on the picture."
          : words
            ? `“${words}” on each creative, or none.`
            : `One short line in ${language} on each creative, from your brief’s message “${trim(brief.message)}”.`,
        "brief",
      ),
      line("logo", "Logo", "The wordmark on the label only; no logo added on the picture.", "brand_dna"),
      line("language", "Language", `${language}, for ${market}.`, "brief"),
    ],
    rules: [
      ...brief.mandatory.map((text) => ({ text, kind: "must" as const, source: "brief" as const })),
      ...brief.never.map((text) => ({ text, kind: "never" as const, source: "brief" as const })),
      // the Brand DNA's rule, unless the brief already says it
      ...(brief.never.some((t) => /^skin-result claims/i.test(t.trim()))
        ? []
        : [
            {
              text: "Skin-result claims; only the lines on the approved list",
              kind: "never" as const,
              source: "brand_dna" as const,
              ruleId: "r7",
            },
          ]),
    ],
    timeline: planTimeline(start, campaign.dueAt),
    changeRequestsIncluded: campaign.roundsIncluded ?? 2,
    writtenAt: direction ? (direction.checkedAt ?? approvedAt) : undefined,
    ...(direction
      ? {
          checkedBy: direction.checkedBy,
          checkedAt: direction.checkedAt,
          approvedBy: direction.decidedBy,
          approvedAt: direction.decidedAt,
        }
      : { readyBy: addWorkingDays(new Date(NOW).toISOString(), 1) }),
  };
}

// ─── A new version changes what she asked ──────────────────────────────────

const ORDINAL: Record<string, number> = { first: 1, second: 2, third: 3, "1": 1, "2": 2, "3": 3 };
const LOOK_WORDS: [RegExp, string][] = [
  [/\b(light|lit|darker|brighter|warmer|cooler)\b/i, "light"],
  [/\bcamera|closer|wider|lens|from above\b/i, "camera"],
  [/\b(set|sill|table|room)\b/i, "set"],
  [/\bprops?\b/i, "props"],
  [/\bcolou?rs?\b/i, "colour"],
  [/\b(people|hands?|faces?|model)\b/i, "people"],
];

/** What Fume changes for a request in her words (the mock reads it plainly): a master she names ("the first master",
 *  "Master 2") gets the request in its scene; otherwise the look line it is about; otherwise the first master. Returns
 *  what changed, one line each ("Master 1’s scene: the gift box closed"). */
function applyAsk(p: CampaignPlan, asked: string, at: string): string[] {
  const direction = p.directions.find((d) => d.id === p.chosenDirectionId) ?? p.directions[0];
  if (!direction || !asked.trim()) return [];
  const masters = direction.creatives.filter((c) => c.kind === "master");
  const named = /\b(?:(first|second|third) master|master\s*(1|2|3))\b/i.exec(asked);
  // the request without the words that only say where: "gift box closed on the first master" → "the gift box closed"
  const what = asked
    .replace(/\s*(?:on|in|for)?\s*(?:the\s+)?(?:(?:first|second|third) master|master\s*\d)\b[:,]?\s*/gi, " ")
    .replace(/^(?:the\s+)?(?:light|camera|set|props|colour|people|creatives|direction|words)\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.\s]+$/, "");
  const phrase = what
    ? /^(the|a|an|no|more|less)\b/i.test(what)
      ? what.charAt(0).toLowerCase() + what.slice(1)
      : `the ${what.charAt(0).toLowerCase()}${what.slice(1)}`
    : "";
  if (!phrase) return [];
  const target = named ? masters[(ORDINAL[(named[1] ?? named[2]).toLowerCase()] ?? 1) - 1] : undefined;
  const lineKey = !target ? LOOK_WORDS.find(([re]) => re.test(asked))?.[1] : undefined;
  if (lineKey) {
    const l = direction.look.find((x) => x.key === lineKey);
    if (l) {
      l.value = `${l.value.replace(/[.\s]+$/, "")}; ${phrase}.`;
      Object.assign(l, { changedBy: "fume", changedAt: at });
      return [`${l.label}: ${phrase}`];
    }
  }
  const m = target ?? masters[0];
  if (!m) return [];
  m.scene = `${m.scene.replace(/[.\s]+$/, "")}; ${phrase}.`;
  Object.assign(m, { changedBy: "fume", changedAt: at });
  return [`${m.name}’s scene: ${phrase}`];
}

// ─── The plan changed in the chat ──────────────────────────────────────────

const NUMBER_WORDS: Record<string, number> = {
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
  w === undefined ? undefined : /^\d+$/.test(w) ? Number(w) : NUMBER_WORDS[w.toLowerCase()];
const N = "(\\d+|one|a|an|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)";
const MONTHS = ["jan", "feb", "mar", "apr", "ma", "jun", "jul", "aug", "sep", "o", "nov", "d"];

/** "30 Oct", "1. desember", or "Friday" as the next such day. */
function dayAsked(text: string, now: string): string | undefined {
  const d = /\b(\d{1,2})\.?\s*(jan|feb|mar|apr|may|mai|jun|jul|aug|sep|oct|okt|nov|dec|des)/i.exec(text);
  const today = new Date(now);
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
    const day = new Date(today);
    do day.setUTCDate(day.getUTCDate() + 1);
    while (day.getUTCDay() !== want);
    day.setUTCHours(15, 0, 0, 0);
    return day.toISOString();
  }
  return undefined;
}
const shift = (iso: string, days: number) => new Date(Date.parse(iso) + days * 864e5).toISOString();

export function planCalls(m: Mock): Pick<FumeApi, Calls> {
  const { db, wait } = m;
  const now = () => m.now();

  const expertOf = (workspaceId: Id) =>
    m.agencyRun(workspaceId)
      ? undefined
      : db.staff.find((s) => s.workspaceId === workspaceId && s.staffRole === "expert")?.userId;
  const firstName = (id?: Id) => (id ? db.users.find((u) => u.id === id)?.name.split(" ")[0] : undefined);
  const agencyName = (workspaceId: Id) =>
    db.organisations.find((o) => o.id === db.workspaces.find((w) => w.id === workspaceId)?.agencyId)?.name ??
    "The agency";
  const agencyPerson = () => Boolean(db.users.find((u) => u.id === m.userId)?.agency);
  const workspaceOf = (c: Campaign) => db.workspaces.find((w) => w.id === c.workspaceId);
  /** The client's first name, as the plan's words say it ("Maja"). */
  const clientName = (c: Campaign) => firstName(c.approverId) ?? "the client";
  const mustShape = (c: Campaign, verdict: ReturnType<typeof canShapePlan>) => {
    if (verdict.ok) return;
    if (verdict.reason === "only_the_agency")
      throw new FumeError(
        "forbidden",
        `${agencyName(c.workspaceId)} makes the plan with Fume. You approve it, or ask for changes.`,
      );
    throw new FumeError("invalid", `The plan is with ${clientName(c)}. She approves it or asks for changes.`);
  };
  const mustApproveAsClient = (c: Campaign, p: CampaignPlan) => {
    const verdict = canApprovePlan(m.me(), workspaceOf(c), p);
    if (verdict.ok) return;
    if (verdict.reason === "only_the_client")
      throw new FumeError("forbidden", `Only ${clientName(c)} approves the plan. Check it and send it to her.`);
    throw new FumeError("invalid", `${agencyName(c.workspaceId)} checks the plan first.`);
  };
  /** The clock's paused reason, read on the studio's side, so with the customer's name: "The plan waits on Maja’s
   *  approval." In agency work it waits for the agency’s check, then (once the agency has sent it) on the client's
   *  approval. */
  const waitsOn = (c: Campaign, p?: CampaignPlan) =>
    m.agencyRun(c.workspaceId) && !p?.checkedBy
      ? `The plan waits for ${agencyName(c.workspaceId)}’s check.`
      : `The plan waits on ${firstName(c.approverId) ?? "the customer"}’s approval.`;
  /** Who the plan waits on: the customer's approver, or in agency work the agency person who sent the brief. */
  const decider = (c: Campaign) => {
    if (!m.agencyRun(c.workspaceId)) return c.approverId;
    const sender = db.briefs.find((b) => b.campaignId === c.id)?.approvedBy;
    const agencyId = db.workspaces.find((w) => w.id === c.workspaceId)?.agencyId;
    return (
      db.users.find((u) => u.id === sender && u.agency)?.id ??
      db.users.find((u) => u.agency?.organisationId === agencyId)?.id ??
      c.approverId
    );
  };
  const threadOf = (campaignId: Id) =>
    db.threads.find((t) => t.campaignId === campaignId && t.kind !== "contact") ??
    db.threads.find((t) => !t.campaignId && t.kind !== "contact");
  /** The campaign's own thread in the conversation (made now if it has none). */
  const ownThread = (c: Campaign): Thread => {
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
  const expertName = () =>
    db.users
      .find((u) =>
        db.staff.some((s) => s.userId === u.id && s.workspaceId === m.workspaceId && s.staffRole === "expert"),
      )
      ?.name.split(" ")[0] ?? "the expert";
  const clockTo = (
    campaignId: Id,
    stage: ServiceClock["stage"],
    dueAt: string,
    state: ServiceClock["state"] = "running",
    pausedReason?: string,
  ) => {
    const k = db.clocks.find((x) => x.campaignId === campaignId);
    const next: ServiceClock = { campaignId, stage, dueAt, state, ...(pausedReason ? { pausedReason } : {}) };
    if (k) Object.assign(k, next, pausedReason ? {} : { pausedReason: undefined });
    else db.clocks.push(next);
  };
  const changed = (c: Campaign) => {
    c.updatedAt = now();
    m.emit({ type: "campaign.state", campaign: c });
  };
  const notify = (
    c: Campaign,
    text: string,
    actor: Notification["actor"],
    kind: Notification["kind"] = "waiting_on_you",
  ) => {
    const n: Notification = {
      id: m.nextId("n"),
      userId: decider(c),
      kind,
      actor,
      text,
      href: `/campaigns/${c.id}/plan`,
      read: false,
      at: now(),
    };
    db.notifications.unshift(n);
    m.emit({ type: "notification.new", notification: n });
  };

  /** The plan, made on first ask for a campaign that ran before the plan existed. */
  const planOf = (campaignId: Id): CampaignPlan | undefined => {
    const found = db.plans.find((p) => p.campaignId === campaignId);
    if (found) return found;
    const c = db.campaigns.find((x) => x.id === campaignId);
    const brief = db.briefs.find((b) => b.campaignId === campaignId);
    const direction = c?.chosenDirectionId ? db.directions.find((d) => d.id === c.chosenDirectionId) : undefined;
    if (!c || !brief || !direction) return undefined;
    const p = writePlan(db, c, brief, direction);
    // In agency work the agency checked it and the client approved it, whoever chose the direction.
    if (m.agencyRun(c.workspaceId) && db.users.find((u) => u.id === p.approvedBy)?.agency)
      Object.assign(p, { checkedBy: p.approvedBy, checkedAt: p.checkedAt ?? p.approvedAt, approvedBy: c.approverId });
    db.plans.push(p);
    return p;
  };
  const must = (campaignId: Id) => {
    const p = planOf(campaignId);
    if (!p) throw new FumeError("not_found", "This campaign has no plan yet. Send the brief first.");
    return p;
  };

  const mastersIn = (p: CampaignPlan) => {
    const n =
      (p.directions.find((d) => d.id === p.chosenDirectionId) ?? p.directions[0])?.creatives.filter(
        (x) => x.kind === "master",
      ).length ?? 0;
    return n === 1 ? "master" : n ? `${n} masters` : "masters";
  };

  /** The plan is ready: it waits on her (in agency work, on the agency's check), and the chat and the bell say so. */
  const ready = (c: Campaign, p: CampaignPlan, checkedBy?: Id) => {
    Object.assign(p, { state: "ready", checkedBy, checkedAt: now(), readyBy: undefined });
    Object.assign(c, { state: "in_review", stage: "plan" });
    clockTo(c.id, "plan", p.timeline[0]?.at ?? now(), "paused_waiting_on_you", waitsOn(c, p));
    const who = firstName(checkedBy);
    const t = threadOf(c.id);
    const agency = m.agencyRun(c.workspaceId);
    const which = p.version > 1 ? `Version ${p.version} of the plan for ${c.name}` : `The plan for ${c.name}`;
    if (t)
      m.post(t.id, {
        author: { kind: "fume" },
        text: agency
          ? `${which} is ready. Check it and send it to ${clientName(c)}; Fume starts on the ${mastersIn(p)} once she approves it. Change it with me here first if you like.`
          : who
            ? `${who} checked the plan for ${c.name}. Approve it and Fume starts on the ${mastersIn(p)}; nothing is made before that.`
            : `The plan for ${c.name} is ready. Approve it and Fume starts on the ${mastersIn(p)}, or change it with me here first. Nothing is made before you approve it.`,
        card: { kind: "plan", campaignId: c.id, version: p.version },
      });
    notify(c, agency ? `${which} waits for your check` : `The plan for ${c.name} is ready`, { kind: "fume" });
    changed(c);
  };

  /** Fume writes the plan from the brief she sent; it is hers as soon as it is written. */
  const startPlan = (c: Campaign, brief: Brief) => {
    const p = writePlan(db, c, brief);
    const readyBy = addWorkingDays(now(), 1);
    Object.assign(p, { state: "writing", readyBy });
    // A brief changed after it was sent makes the plan again, as its next version.
    const before = db.plans.find((x) => x.campaignId === c.id);
    if (before && before.state !== "approved")
      Object.assign(p, {
        version: before.version + 1,
        versions: [
          ...(before.versions ?? []),
          {
            version: before.version + 1,
            at: now(),
            by: m.userId,
            changes: [`Written again from version ${brief.version} of the brief`],
          },
        ],
      });
    db.plans = db.plans.filter((x) => x.campaignId !== c.id);
    db.plans.push(p);
    Object.assign(c, { state: "scoped", stage: "plan" });
    clockTo(c.id, "plan", readyBy);
    const t = threadOf(c.id);
    if (t)
      m.post(t.id, {
        author: { kind: "fume" },
        text: `Thank you. Fume writes the plan now: the direction, the look and every creative, before anything is made. You see it here by ${dayWords(readyBy)}.`,
        card: { kind: "plan", campaignId: c.id, version: p.version },
      });
    changed(c);
    setTimeout(() => {
      if (p.state !== "writing") return;
      p.writtenAt = now();
      ready(c, p, undefined);
    }, PACE.write);
  };

  const sendBrief = async (campaignId: Id) => {
    m.mustApprove();
    const b = db.briefs.find((x) => x.campaignId === campaignId);
    if (!b) throw new FumeError("not_found", "No brief");
    const c = m.campaignOf(campaignId);
    const gap = briefGap(b, c);
    if (gap?.reason === "questions_open") throw new FumeError("invalid", "Fume still needs something for this brief.");
    if (gap?.reason === "lines_empty")
      throw new FumeError("invalid", `Fill in the ${gap.lines.join(" and the ")} first.`);
    if (gap?.reason === "no_product") throw new FumeError("invalid", "Pick the product the campaign is for first.");
    // The brief is fixed at this version: it is what Fume writes the plan from.
    Object.assign(b, { state: "approved", approvedBy: m.userId, approvedAt: now() });
    startPlan(c, b);
    return wait(b);
  };

  /** The plan approved, by her (or, through the client link, by the client it was sent to): the Engine starts. */
  const approve = (c: Campaign, p: CampaignPlan, by: Id, note?: string) => {
    Object.assign(p, { state: "approved", approvedBy: by, approvedAt: now(), approvedNote: note });
    const agency = m.agencyRun(c.workspaceId);
    const direction = p.directions.find((d) => d.id === p.chosenDirectionId)!;
    const masterList = direction.creatives.filter((x) => x.kind === "master");
    const masters = masterList.length;
    // A product the plan shows that waits to be confirmed holds the masters that show it; the others start.
    const waiting = productsToConfirm(c, db.products);
    const { going, held } = mastersOnHold(masterList, waiting);
    const productWords = list(waiting.map((x) => x.name));
    Object.assign(c, { state: "in_production", stage: "masters" });
    const due = p.timeline[0]?.at ?? addWorkingDays(now(), 3);
    clockTo(c.id, "masters", due);
    const expert = expertOf(c.workspaceId);
    // In agency work the run is the agency's to follow: who approved it by name, and the agency checks each master.
    const approver = firstName(by) ?? "the client";
    const run: EngineRun = {
      id: `run-plan-${c.id}`,
      campaignId: c.id,
      purpose: "masters",
      state: "running",
      made: 0,
      total: masters,
      startedAt: now(),
      previews: [],
      steps: [
        { label: agency ? `Plan approved by ${approver}` : "Plan approved by you", state: "done" },
        {
          label: `Masters in ${direction.name}`,
          state: going.length ? "active" : "waiting",
          detail: `0 of ${masters}`,
        },
        ...(held.length
          ? [{ label: `${list(held.map((x) => x.name))}: ${productWords} to confirm first`, state: "waiting" as const }]
          : []),
        {
          label: `Quality Gate: ${agency ? agencyName(c.workspaceId) : (firstName(expert) ?? "the expert")} checks each master`,
          state: "waiting",
        },
      ],
    };
    db.runs = db.runs.filter((r) => r.id !== run.id);
    db.runs.push(run);
    const t = threadOf(c.id);
    const lead = agency ? `${approver} approved the plan.` : "Approved.";
    if (t)
      m.post(t.id, {
        author: { kind: "fume" },
        text: `${
          held.length === 0
            ? `${lead} The Engine has started on the ${masters === 1 ? "master" : `${masters} masters`} in ${direction.name}.`
            : going.length === 0
              ? `${lead} The Engine starts on the ${masters === 1 ? "master" : `${masters} masters`} in ${direction.name} once ${productWords} ${waiting.length === 1 ? "is" : "are"} confirmed.`
              : `${lead} The Engine has started on ${list(going.map((x) => x.name))} in ${direction.name}; ${list(held.map((x) => x.name))} ${held.length === 1 ? "starts" : "start"} once ${productWords} ${waiting.length === 1 ? "is" : "are"} confirmed.`
        } ${expert ? `${firstName(expert)} checks each one before you see it, by ${dayWords(due)}.` : agency ? `They are yours to check by ${dayWords(due)}, before ${approver} sees them.` : `They are yours to check by ${dayWords(due)}.`}`,
        card: { kind: "run", runId: run.id },
      });
    // The agency hears that its client approved (in Fume the approver is the one who acted).
    if (agency)
      notify(
        c,
        `${approver} approved the plan for ${c.name}${note ? " in the client link" : ""}. The Engine has started.`,
        { kind: "person", userId: by },
        "checked",
      );
    changed(c);
  };

  /** Changes asked by her (or, in agency work, by the client): Fume writes the next version, which says what changed
   *  and is hers at once (in agency work, the agency's to check and send again). */
  const askChanges = (c: Campaign, p: CampaignPlan, by: Id, note: string, name?: string) => {
    Object.assign(p, {
      state: "changes_asked",
      note: { by, text: note, at: now() },
      readyBy: addWorkingDays(now(), 1),
    });
    Object.assign(c, { state: "revision", stage: "plan" });
    clockTo(c.id, "plan", p.readyBy!);
    const t = threadOf(c.id);
    // In agency work a client's ask reaches the agency's conversation with her name; the agency checks the next version.
    const fromClient = m.agencyRun(c.workspaceId) && !db.users.find((u) => u.id === by)?.agency;
    const who = name ?? firstName(by) ?? "The client";
    if (t) {
      m.post(t.id, { author: { kind: "person", userId: by }, text: note });
      m.post(t.id, {
        author: { kind: "fume" },
        text: fromClient
          ? `${who} asked for changes to the plan for ${c.name}. Fume is changing it: you get version ${p.version + 1} here by ${dayWords(p.readyBy!)}, to check and send to ${clientName(c)}. Changing the plan never uses a change request.`
          : `Fume is changing the plan for ${c.name}. You get version ${p.version + 1} here by ${dayWords(p.readyBy!)}. Changing the plan never uses a change request.`,
      });
    }
    if (fromClient)
      notify(
        c,
        `${who} asked for changes to the plan for ${c.name}: “${note}”`,
        { kind: "person", userId: by },
        "changes_asked",
      );
    changed(c);
    setTimeout(() => {
      if (p.state !== "changes_asked") return;
      const asked = p.note?.text ?? "";
      const asker = p.note?.by ?? by;
      const changes = applyAsk(p, asked, now());
      Object.assign(p, {
        version: p.version + 1,
        writtenAt: now(),
        note: {
          by: "fume",
          text: changes.length ? `Changed as you asked: ${changes.join("; ")}.` : `Changed as you asked: “${asked}”`,
          at: now(),
        },
        versions: [...(p.versions ?? []), { version: p.version + 1, at: now(), by: asker, asked, changes }],
        checkedBy: undefined,
        checkedAt: undefined,
      });
      ready(c, p, undefined);
    }, PACE.change);
  };

  /** The changes the words ask for (how many creatives, how many videos or carousels, the dates), made on the plan.
   *  Returns what changed, one line each; none when the words ask for something else. */
  const applyNumbers = (p: CampaignPlan, text: string): string[] => {
    const direction = p.directions.find((d) => d.id === p.chosenDirectionId) ?? p.directions[0];
    if (!direction) return [];
    const changes: string[] = [];
    const all = direction.creatives;
    const masters = () => all.filter((c) => c.kind === "master");
    const total = num(new RegExp(`\\b${N}\\s+(?:creatives|in all|in total)\\b`, "i").exec(text)?.[1]);
    const videos = /\bno videos?\b/i.test(text)
      ? 0
      : (num(new RegExp(`\\b${N}\\s+(?:of them\\s+)?(?:as\\s+)?videos?\\b`, "i").exec(text)?.[1]) ??
        (/\b(more|some|add (a )?)videos?\b|\bvideos? too\b/i.test(text)
          ? Math.max(2, all.filter((c) => c.medium === "video").length + 1)
          : undefined));
    const carousels = /\bno carousels?\b/i.test(text)
      ? 0
      : (num(new RegExp(`\\b${N}\\s+(?:of them\\s+)?(?:as\\s+)?carousels?\\b`, "i").exec(text)?.[1]) ??
        (/\b(more|some|add (a )?)carousels?\b|\bcarousels? too\b/i.test(text)
          ? Math.max(1, all.filter((c) => c.medium === "carousel").length + 1)
          : undefined));
    // how many in all: more variants of the masters, or fewer from the end (the masters stay)
    if (total !== undefined && total > 0 && total !== all.length) {
      const was = all.length;
      while (all.length < total) {
        const master = masters()[all.length % Math.max(1, masters().length)] ?? all[0];
        if (!master) break;
        const format = all.length % 2 ? "story" : "feed";
        const n = all.filter((c) => c.format === format).length + 1;
        all.push({
          id: m.nextId("pc"),
          name: `${format === "story" ? "Story" : "Feed"} ${n}`,
          kind: "variant",
          of: master.id,
          format,
          productIds: master.productIds,
          scene: `${master.scene.replace(/[.\s]+$/, "")}, as a ${format === "story" ? "story" : "feed post"}.`,
          text: master.text,
          people: master.people,
          changedBy: "fume",
          changedAt: now(),
        } as PlannedCreative);
      }
      while (all.length > Math.max(total, 1)) {
        const i = all.map((c) => c.kind).lastIndexOf("variant");
        all.splice(i >= 0 ? i : all.length - 1, 1);
      }
      changes.push(`${all.length} creatives (was ${was})`);
    }
    const make = (medium: "video" | "carousel", want: number) => {
      const has = all.filter((c) => c.medium === medium);
      if (want === has.length) return;
      // a video is a story, a carousel a feed post; the masters stay stills
      while (all.filter((c) => c.medium === medium).length > want) {
        const c = [...all].reverse().find((x) => x.medium === medium)!;
        c.medium = "image";
        c.name = c.name.replace(/ · (video|carousel)$/, "");
      }
      const free = () => all.filter((c) => c.kind === "variant" && (c.medium ?? "image") === "image");
      while (all.filter((c) => c.medium === medium).length < want) {
        let c = free().find((x) => x.format === (medium === "video" ? "story" : "feed")) ?? free()[0];
        if (!c) {
          const master = masters()[0] ?? all[0];
          if (!master) break;
          c = {
            id: m.nextId("pc"),
            name: `${medium === "video" ? "Story" : "Feed"} ${all.length + 1}`,
            kind: "variant",
            of: master.id,
            format: medium === "video" ? "story" : "feed",
            productIds: master.productIds,
            scene: master.scene,
            text: master.text,
            people: master.people,
          } as PlannedCreative;
          all.push(c);
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
    const when = dayAsked(text, now());
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
          `every date ${weeks[1].replace(/^a$/, "one")} week${/two|2/.test(weeks[1]) ? "s" : ""} ${lowerFirst(weeks[2]) === "sooner" ? "earlier" : lowerFirst(weeks[2])}`,
        );
      }
    }
    return changes;
  };

  return {
    async plan(campaignId) {
      const p = planOf(campaignId) ?? null;
      // Before she may read it, the plan says only where it is.
      const c = db.campaigns.find((x) => x.id === campaignId);
      if (p && !seesPlan(m.me(), c && workspaceOf(c), p))
        return wait({ ...p, directions: [], content: [], rules: [], summary: "" });
      return wait(p);
    },
    sendBrief,
    // Approving the brief is sending it.
    approveBrief: sendBrief,
    async approvePlan(campaignId, version) {
      m.mustApprove();
      const p = must(campaignId);
      if (version !== undefined && version !== p.version)
        throw new FumeError("conflict", `The plan has changed since: version ${p.version} is current, not ${version}.`);
      const c = m.campaignOf(campaignId);
      mustApproveAsClient(c, p);
      if (!planAllows(p, "approve"))
        throw new FumeError(
          "invalid",
          p.state === "approved" ? "You approved this plan already." : "The plan isn't ready for you yet.",
        );
      approve(c, p, m.userId);
      return wait(p);
    },
    async answerClientPlan({ token, verdict, text, name }) {
      const send = db.clientSends.find((s) => s.link?.token === token && s.plan);
      if (!send) throw new FumeError("not_found", "This client link has expired, or it holds no plan.");
      // The agency's own people see the link as a preview; an answer there is never the client's.
      if (!canAnswerClientLink(m.me()))
        throw new FumeError("forbidden", "This is a preview of the client’s page. Only the client answers here.");
      const c = m.campaignOf(send.campaignId);
      const p = must(c.id);
      if (!planAllows(p, "approve") || !p.checkedBy)
        throw new FumeError(
          "conflict",
          p.state === "approved"
            ? "The plan is approved already."
            : `${agencyName(c.workspaceId)} is working on the plan. You get the next version here.`,
        );
      // The link is the client's: her answer is hers (the first person it was sent to, or the campaign's approver).
      const owner = send.to[0] ?? c.approverId;
      const how = name.trim() ? `Through the client link, by ${name.trim()}` : "Through the client link";
      if (verdict === "approve") approve(c, p, owner, how);
      else {
        if (!text?.trim()) throw new FumeError("invalid", "Say what should change.");
        askChanges(c, p, owner, text.trim(), name.trim() || undefined);
      }
      return wait(p);
    },
    async undoApprovePlan(campaignId) {
      m.mustApprove();
      const p = must(campaignId);
      if (!planAllows(p, "undo")) return wait(p);
      const c = m.campaignOf(campaignId);
      if (!canUndoPlanApproval(m.me(), workspaceOf(c)))
        throw new FumeError("forbidden", `${clientName(c)} approved the plan; only she can undo it.`);
      Object.assign(p, { state: "ready", approvedBy: undefined, approvedAt: undefined, approvedNote: undefined });
      Object.assign(c, { state: "in_review", stage: "plan" });
      db.runs = db.runs.filter((r) => r.id !== `run-plan-${c.id}`);
      clockTo(c.id, "plan", p.timeline[0]?.at ?? now(), "paused_waiting_on_you", waitsOn(c, p));
      // What Fume said when it was approved goes too: nothing started.
      const t = threadOf(c.id);
      const last = t
        ? [...db.messages]
            .reverse()
            .find(
              (x) =>
                x.threadId === t.id && x.card?.kind === "run" && (x.card as { runId: Id }).runId === `run-plan-${c.id}`,
            )
        : undefined;
      if (last) db.messages = db.messages.filter((x) => x !== last);
      changed(c);
      return wait(p);
    },
    async changePlan(campaignId, change) {
      const p = must(campaignId);
      const c = m.campaignOf(campaignId);
      mustShape(c, canShapePlan(m.me(), workspaceOf(c), p));
      if (!m.isStaff()) {
        m.mustApprove();
        if (!planAllows(p, "change"))
          throw new FumeError("invalid", "The plan can be changed once it is ready for you.");
      }
      const direction = p.directions.find((d) => d.id === p.chosenDirectionId)!;
      const by = { changedBy: m.userId, changedAt: now() };
      if (change.step) {
        // A step's day; the go-live is the campaign's too.
        const st = p.timeline.find((x) => x.label === change.step || x.label.startsWith(`${change.step},`));
        if (!st || !change.stepAt) throw new FumeError("not_found", "No such step in the plan.");
        st.at = change.stepAt;
        if (/^goes live/i.test(st.label)) c.dueAt = change.stepAt;
      } else if (change.creativeId) {
        const pc = direction.creatives.find((x) => x.id === change.creativeId);
        if (!pc) throw new FumeError("not_found", "No such creative in the plan.");
        Object.assign(pc, change.creative ?? {}, change.value !== undefined ? { scene: change.value } : {});
        // A creative's own look (null goes back to the plan's) and its own go-live day.
        if (change.look !== undefined)
          pc.look = change.look && Object.values(change.look).some((v) => v?.trim()) ? change.look : undefined;
        if (change.liveAt) pc.liveAt = change.liveAt;
        Object.assign(pc, by);
      } else if (change.line) {
        const l = direction.look.find((x) => x.key === change.line) ?? p.content.find((x) => x.key === change.line);
        if (!l) throw new FumeError("not_found", "No such line in the plan.");
        if (!(change.value ?? "").trim()) throw new FumeError("invalid", "Write what it should be.");
        // The expert's change keeps its source and why, and who made it ("Changed by Anna" on both sides).
        Object.assign(
          l,
          {
            value: change.value!.trim(),
            source: m.isStaff() ? l.source : "you",
            why: m.isStaff() ? l.why : undefined,
          },
          by,
        );
      }
      changed(c);
      return wait(p);
    },
    async choosePlanDirection(campaignId, directionId, reason) {
      m.mustApprove();
      const p = must(campaignId);
      const c = m.campaignOf(campaignId);
      mustShape(c, canShapePlan(m.me(), workspaceOf(c), p));
      if (!planAllows(p, "change")) throw new FumeError("invalid", "The plan can be changed once it is ready for you.");
      if (!p.directions.some((d) => d.id === directionId))
        throw new FumeError("not_found", "No such direction in the plan.");
      Object.assign(p, { chosenDirectionId: directionId, chosenReason: reason?.trim() || undefined });
      changed(c);
      return wait(p);
    },
    async askPlanChanges(campaignId, note) {
      m.mustApprove();
      const p = must(campaignId);
      const c = m.campaignOf(campaignId);
      mustShape(c, canAskPlanChanges(m.me(), workspaceOf(c), p));
      if (!planAllows(p, "ask_changes"))
        throw new FumeError("invalid", "The plan can be changed once it is ready for you.");
      if (!note.trim()) throw new FumeError("invalid", "Write what Fume should change.");
      askChanges(c, p, m.userId, note.trim());
      return wait(p);
    },
    // She asks the expert to check the plan before she approves it (optional); the mock plays the expert's check.
    async askPlanCheck(campaignId) {
      m.mustApprove();
      const p = must(campaignId);
      const c = m.campaignOf(campaignId);
      mustShape(c, canShapePlan(m.me(), workspaceOf(c), p));
      const expert = expertOf(c.workspaceId);
      if (!expert) throw new FumeError("invalid", "No expert checks plans in this brand.");
      if (!planAllows(p, "ask_check"))
        throw new FumeError("invalid", "The plan can be checked once it is ready for you.");
      Object.assign(p, {
        state: "in_check",
        checkAsked: { by: m.userId, at: now() },
        readyBy: addWorkingDays(now(), 1),
        checkedBy: undefined,
        checkedAt: undefined,
      });
      Object.assign(c, { state: "scoped", stage: "plan" });
      clockTo(c.id, "plan", p.readyBy!);
      const t = threadOf(c.id);
      if (t)
        m.post(t.id, {
          author: { kind: "fume" },
          text: `${firstName(expert)} checks the plan for ${c.name} and you see it again by ${dayWords(p.readyBy!)}. Nothing is made before you approve it.`,
        });
      const n: Notification = {
        id: m.nextId("n"),
        userId: expert,
        kind: "waiting_on_you",
        actor: { kind: "person", userId: m.userId },
        text: `${firstName(m.userId) ?? "The customer"} asked you to check the plan for ${c.name}`,
        href: `/studio/b/${c.workspaceId}/campaigns/${c.id}/plan`,
        read: false,
        at: now(),
      };
      db.notifications.unshift(n);
      m.emit({ type: "notification.new", notification: n });
      changed(c);
      setTimeout(() => {
        if (p.state === "in_check" && p.checkAsked) ready(c, p, expert);
      }, PACE.check);
      return wait(p);
    },
    async checkPlan(campaignId) {
      const p = must(campaignId);
      const c = m.campaignOf(campaignId);
      // In agency work the agency checks the plan, which makes it the client's to approve (sendToClient with `plan`
      // calls this and tells her).
      if (m.agencyRun(c.workspaceId)) {
        if (!canCheckPlan(m.me(), workspaceOf(c)).ok)
          throw new FumeError("forbidden", `${agencyName(c.workspaceId)} checks the plan.`);
        if (!planAllows(p, "agency_check"))
          throw new FumeError(
            "invalid",
            p.state === "approved"
              ? `${clientName(c)} approved this plan already.`
              : "The plan is not ready to check yet.",
          );
        if (!p.checkedBy) Object.assign(p, { checkedBy: m.userId, checkedAt: now() });
        clockTo(c.id, "plan", p.timeline[0]?.at ?? now(), "paused_waiting_on_you", waitsOn(c, p));
        changed(c);
        return wait(p);
      }
      if (!canCheckPlan(m.me(), workspaceOf(c)).ok)
        throw new FumeError("forbidden", "Only Fume's expert checks a plan.");
      if (!planAllows(p, "expert_check")) throw new FumeError("invalid", "This plan is not in check.");
      ready(m.campaignOf(campaignId), p, m.userId);
      return wait(p);
    },
    // She changes the plan in the chat before the Engine starts: the number of creatives, how many are videos or
    // carousels, and the dates change at once in a new version that says what changed; anything else goes to Fume as
    // a change request, as on the plan page.
    async changePlanWithFume(campaignId, text) {
      const p = db.plans.find((x) => x.campaignId === campaignId);
      const c = db.campaigns.find((x) => x.id === campaignId);
      if (!p || !c) throw new Error("No plan for this campaign yet.");
      const words = text.trim();
      const t = ownThread(c);
      const me = { kind: "person" as const, userId: m.userId };
      const later = (fn: () => void) => setTimeout(fn, m.latency * 6);
      // In agency work the agency's plan, once checked and sent, is the client's.
      const agency = agencyPerson();
      const client = clientName(c);
      if (agency && p.state === "ready" && p.checkedBy) {
        m.post(t.id, { author: me, text: words });
        later(() =>
          m.post(t.id, {
            author: { kind: "fume" },
            text: `You sent this plan to ${client}, so it stays as it is while it is with her. If she asks for changes, Fume writes the next version and you check it again.`,
          }),
        );
        return wait(p);
      }
      if (p.state !== "ready") {
        m.post(t.id, { author: me, text: words });
        const why =
          p.state === "approved"
            ? `${agency ? `${client} approved` : "You approved"} this plan, and the Engine has started, so it stays as it is. Ask for a change on a creative once you see it.`
            : `${p.state === "in_check" ? `${expertName()} is checking the plan` : "Fume is still writing the plan"}${p.readyBy ? ` until ${dayWords(p.readyBy)}` : ""}. Tell me again once it is ready, and Fume changes it then.`;
        later(() => m.post(t.id, { author: { kind: "fume" }, text: why }));
        return wait(p);
      }
      // a copy to try the words on: only a change Fume can make at once is kept
      const trial = structuredClone(p);
      const changes = applyNumbers(trial, words);
      if (!changes.length) return m.api.askPlanChanges(campaignId, words);
      Object.assign(p, trial, {
        version: p.version + 1,
        writtenAt: now(),
        note: { by: "fume", text: `Changed as you asked: ${changes.join("; ")}.`, at: now() },
        versions: [...(p.versions ?? []), { version: p.version + 1, at: now(), by: m.userId, asked: words, changes }],
        checkedBy: undefined,
        checkedAt: undefined,
      });
      m.post(t.id, { author: me, text: words });
      t.updatedAt = now();
      later(() => {
        m.post(t.id, {
          author: { kind: "fume" },
          text: `Version ${p.version}: ${changes.join("; ")}. It is in the panel; ${agency ? `check it and send it to ${client}. Nothing is made before she approves it.` : "nothing is made before you approve it."}`,
          card: { kind: "plan", campaignId, version: p.version },
        });
        m.emit({ type: "campaign.state", campaign: c });
      });
      return wait(p);
    },
  };
}
