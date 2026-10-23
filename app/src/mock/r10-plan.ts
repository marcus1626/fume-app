// The mock backend's round 10 calls: the plan (FLOWS §22, PROPOSED 20 Oct 2026).
// Marcus, 20 Oct: "hvor er planen som blir lagd før Engine genererer? Kunden må jo godkjenne det før Engine begynner å
// generere." She sends her brief; Fume writes the plan from it, the Brand DNA, the taste, the moodboard and Creative
// Memory; the expert checks it; she approves it; only then does the Engine start on the masters.
//
// - Winter gifting has a hand-written plan, checked by Anna and waiting on Maja (the demo's main example).
// - Black Friday has a plan in check: Anna sees it and marks it checked (staff), Maja sees that it is in check.
// - A brief sent now (Hand Balm, or any new campaign) gets a plan written by `writePlan`: "writing" for a moment,
//   then "in_check", then "ready" (the mock plays the expert's check so the flow can be tried end to end).
// - Campaigns that ran before the plan existed show a plan made from their brief and chosen direction, approved.
// Round 12 (UX review DLOAD-3, DLOAD-4, DLOAD-17, DTASK-9; brief r12 PLAN; PROPOSED 20 Oct 2026):
// - Fume talks in its own name ("Approve it and Fume starts on the 3 masters"); the Engine only makes the creatives.
// - In a brand an agency runs, the agency approves the plan and changes it; its client reads it ("Brygga Studio
//   approves the plan."), and the plan's notice goes to the agency person who sent the brief.
// - A new version Fume writes after "Ask for changes" is checked again by the expert before it is hers.
// Round 13 (Marcus's card, 23 Oct 2026, DECIDED "Klienten godkjenner"): in a brand an agency runs the agency CHECKS the
//   plan and sends it to the client (sendToClient with `plan`, r11-agency.ts, which calls checkPlan here); only the
//   client APPROVES it, in Fume or in the client link where she approves the creatives (answerClientPlan). Her approval
//   starts the Engine. She can ask for changes there too: Fume writes the next version and the agency checks it again
//   before it is hers. Until the agency sends it, the client sees only where the plan is.
// - Approved while a product it shows waits to be confirmed: the masters with that product wait for it, and Fume
//   says so; the others start.
// - A change the expert makes keeps who made it ("Changed by Anna"), its source and why unchanged.
// - Variants never repeat a master's own format or one another: past the formats, a variant is a closer or a wider
//   crop; the words on a creative are in the campaign's language, so Fume writes them from the brief's message.
// Round 13 (Marcus's video comments #20, #25, #26, #67, robot notes 03 and 04; 22 Oct 2026, PROPOSED):
// - Plans without a designer: Fume writes the plan and it is hers at once ("ready", no expert). The expert checks it
//   only when she asks (askPlanCheck: "Ask Anna to check"); Black Friday's check is one she asked for.
// - A new version says what changed (plan.versions) and the change is really made: "gift box closed on the first
//   master" changes Master 1's scene, and the note names it.
// - A creative can have its own look (light, direction, camera) and its own go-live day; a step's day can change.
// - A plan written from a past campaign counts its real masters and creatives (Autumn launch: 2 masters, 11), its
//   steps end before the go-live, and a Brand DNA rule the brief already says is not said twice.

import type {
  Brief,
  Campaign,
  CampaignPlan,
  ClientSend,
  Creative,
  Direction,
  EngineRun,
  FumeApi,
  FumeEvent,
  Id,
  Message,
  Notification,
  PlanDirection,
  PlanLine,
  PlannedCreative,
  PlanReference,
  Product,
  Reference,
  ServiceClock,
  Thread,
  User,
} from "../contract";
import { FumeError } from "../contract";
import { NOW, at, img } from "./seed";

interface Db {
  campaigns: Campaign[];
  briefs: Brief[];
  directions: Direction[];
  creatives: Creative[];
  products: Product[];
  references: Reference[];
  runs: EngineRun[];
  clocks: ServiceClock[];
  threads: Thread[];
  messages: Message[];
  notifications: Notification[];
  staff: { userId: Id; workspaceId: Id; staffRole: string }[];
  users: User[];
  plans: CampaignPlan[];
  /** Round 11: a workspace an agency runs has no Fume expert check (FLOWS §24.2). */
  workspaces?: { id: Id; agencyId?: Id }[];
  /** Round 12: the agency's name, for the client's "Brygga Studio approves the plan." */
  organisations?: { id: Id; name: string }[];
  /** Round 13: what the agency sent the client (r11-agency.ts); a client link that carries the plan answers it here. */
  clientSends?: ClientSend[];
}

export interface R10PlanContext {
  db: Db;
  wait: <T>(value: T) => Promise<T>;
  now: () => string;
  nextId: (prefix: string) => string;
  emit: (event: FumeEvent) => void;
  say: (threadId: Id, message: Omit<Message, "id" | "threadId" | "at">) => Message;
  userId: () => Id;
  isStaff: () => boolean;
  mustApprove: () => void;
  /** How long the mock lets Fume write and the expert check a new plan, in ms (short, so the flow can be tried). */
  pace?: { write: number; check: number; change: number };
}

const gen = (name: string) => `${import.meta.env.BASE_URL}demo/lysne/gen/${name}.jpg`;
const day = (days: number) => new Date(NOW + days * 86_400_000).toISOString();

/** A working day on (Mon–Fri), from a moment. */
function workingDays(from: string, days: number): string {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) left--;
  }
  return d.toISOString();
}
const dayWords = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Oslo" }).format(new Date(iso)).replace(",", "");

const line = (key: string, label: string, value: string, source: PlanLine["source"], why?: string): PlanLine => ({ key, label, value, source, ...(why ? { why } : {}) });
const ref = (image: string, caption: string, source: PlanReference["source"], campaignId?: Id): PlanReference => ({ image, caption, source, ...(campaignId ? { campaignId } : {}) });

// ─── Winter gifting: the hand-written plan ─────────────────────────────────

/** The masters and what follows them, in one direction. `scenes` gives the three masters' scenes and words. */
function winterCreatives(prefix: string, scenes: { scene: string; text: string; people: string; format: "feed" | "story"; products: Id[] }[], variants: { name: string; of: number; scene: string; format: "feed" | "story"; text?: string; people?: string; products?: Id[] }[]): PlannedCreative[] {
  const masters: PlannedCreative[] = scenes.map((s, i) => ({
    id: `${prefix}-m${i + 1}`,
    name: `Master ${i + 1}`,
    kind: "master",
    format: s.format,
    productIds: s.products,
    scene: s.scene,
    text: s.text,
    people: s.people,
  }));
  const rest: PlannedCreative[] = variants.map((v, i) => {
    const master = masters[v.of - 1];
    return {
      id: `${prefix}-v${i + 1}`,
      name: v.name,
      kind: "variant",
      of: master.id,
      format: v.format,
      productIds: v.products ?? master.productIds,
      scene: v.scene,
      text: v.text ?? master.text,
      people: v.people ?? master.people,
    };
  });
  return [...masters, ...rest];
}

const OIL = "pr-oil";
const CANDLE = "pr-candle";

function winterPlan(): CampaignPlan {
  const lookBase = (overrides: Partial<Record<string, PlanLine>>): PlanLine[] =>
    [
      line("light", "Light", "Low, warm side light from a window at dusk; the lit candle as a second, small warm light. Never cold blue light inside the room.", "brand_dna", "Your Brand DNA: warm neutrals and amber light"),
      line("camera", "Camera", "50 mm at table height, close. The bottle sharp, the window soft behind it.", "fume"),
      line("set", "Set", "A deep windowsill in pale stone and oak, a linen cloth, the dark blue evening outside.", "moodboard", "From your Winter gifting moodboard"),
      line("props", "Props", "The gift sleeve, a loose ribbon in clay, Evening Candle lit. Nothing seasonal beyond that: no trees, no baubles.", "brief", "Your brief: never red and green Christmas colours"),
      line("colour", "Colour", "Amber glass, cream, clay and the window's deep blue. No red, no green.", "brand_dna"),
      line("people", "People", "Hands only, in one master: tying the ribbon, never holding the bottle. Never a face.", "memory", "You passed on hands that hold the bottle in Autumn launch"),
    ].map((l) => overrides[l.key] ?? l);

  const a: PlanDirection = {
    id: "pd-w-a",
    letter: "A",
    name: "Window light",
    recommended: true,
    idea:
      "A gift waits by a window on a dark December afternoon: the oil in its sleeve, the candle just lit, the last blue light outside and warm light inside. It is the moment before the gift is given, calm and certain.",
    hook: "The candle is lit before the gift is opened.",
    why: [
      { text: "Warm, low side light leads in your Brand DNA.", source: "brand_dna" },
      { text: "You chose warm light over cool every time it came up in your taste.", source: "taste" },
      { text: "Your moodboard keeps the product low, with air above it.", source: "moodboard" },
      { text: "Evening stone won in Autumn launch; this carries its warmth into winter.", source: "memory" },
    ],
    references: [
      ref(gen("candle-scene"), "A candle by a window at dusk: the light we aim for", "moodboard"),
      ref(gen("ritual-pack"), "The Evening Ritual box: the gift itself", "product"),
      ref(img("08-06"), "Product low, air above it, as you liked", "taste"),
      ref(img("02-05"), "The reference in your brief", "brief"),
      ref(img("03-12"), "Window light through glass", "moodboard"),
      ref(gen("taste-bedroom"), "The evening room, one warm lamp", "taste"),
    ],
    look: lookBase({}),
    creatives: winterCreatives(
      "pc-w-a",
      [
        { format: "feed", products: [OIL, CANDLE], scene: "The oil in its gift sleeve on the sill, the candle lit behind it, the window going blue.", text: "En roligere kveld, gitt.", people: "No people" },
        { format: "feed", products: [OIL], scene: "Two hands tie a clay ribbon around the sleeve; the bottle stands beside them, label to the front.", text: "Gi bort en roligere kveld.", people: "Hands only" },
        { format: "story", products: [OIL, CANDLE], scene: "From above: the open Evening Ritual box on linen, the candle lit, the lid set aside.", text: "Til noen som fortjener kvelden.", people: "No people" },
      ],
      [
        { name: "Master 1 in Story", of: 1, format: "story", scene: "Master 1, taller: more of the window and the evening above the bottle." },
        { name: "Master 2 in Story", of: 2, format: "story", scene: "Master 2, taller: the ribbon's loose end falls into the frame." },
        { name: "Master 3 in Feed", of: 3, format: "feed", scene: "Master 3, closer: the box and the candle fill the frame." },
        { name: "The candle alone", of: 1, format: "feed", products: [CANDLE], scene: "Master 1's sill with Evening Candle alone, its flame the only light inside.", text: "Tenn kvelden." },
        { name: "The label, close", of: 1, format: "feed", products: [OIL], scene: "Close on the label and the sleeve's edge, the candle a warm blur behind.", text: "For timen før søvn." },
        { name: "The candle alone in Story", of: 1, format: "story", products: [CANDLE], scene: "The candle alone, taller, the window's blue above it.", text: "Tenn kvelden." },
      ],
    ),
  };

  const b: PlanDirection = {
    id: "pd-w-b",
    letter: "B",
    name: "Linen and glass",
    idea:
      "Close and quiet: the oil and the candle on folded linen, warm light through ribbed glass, as if the gift were already unwrapped at home. No window and no season, only the evening.",
    hook: "Wrapped as softly as the evening it gives.",
    why: [
      { text: "Ribbed glass and slow light are on your list of liked pictures.", source: "taste" },
      { text: "Linen and glass are named in your Brand DNA's imagery.", source: "brand_dna" },
      { text: "Less seasonal than A: it can run past Christmas.", source: "fume" },
    ],
    references: [ref(img("02-04"), "Ribbed glass and slow light, as you liked", "taste"), ref(img("05-08"), "Light through ribbed glass", "moodboard"), ref(gen("taste-stone"), "Stone and folded linen", "taste"), ref(gen("ritual-pack"), "The Evening Ritual box", "product")],
    look: lookBase({
      light: line("light", "Light", "Soft, warm light through a ribbed glass screen, from the left. The candle lit but not the main light.", "taste", "Ribbed glass and slow light, from your liked pictures"),
      set: line("set", "Set", "Folded cream linen on oak, a ribbed glass screen behind.", "brand_dna"),
      people: line("people", "People", "No people.", "fume"),
    }),
    creatives: winterCreatives(
      "pc-w-b",
      [
        { format: "feed", products: [OIL, CANDLE], scene: "The oil and the candle on folded linen, light striped by the ribbed glass.", text: "En roligere kveld, gitt.", people: "No people" },
        { format: "feed", products: [OIL], scene: "The oil lying on the linen, its sleeve half off, the stripes of light across the label's edge.", text: "Gi bort en roligere kveld.", people: "No people" },
        { format: "story", products: [OIL, CANDLE], scene: "The open box on linen, seen from above, a stripe of light across it.", text: "Til noen som fortjener kvelden.", people: "No people" },
      ],
      [
        { name: "Master 1 in Story", of: 1, format: "story", scene: "Master 1, taller, more linen above." },
        { name: "Master 2 in Story", of: 2, format: "story", scene: "Master 2, taller." },
        { name: "Master 3 in Feed", of: 3, format: "feed", scene: "Master 3, closer." },
        { name: "The candle alone", of: 1, format: "feed", products: [CANDLE], scene: "The candle alone on the linen, lit.", text: "Tenn kvelden." },
        { name: "The label, close", of: 1, format: "feed", products: [OIL], scene: "Close on the label in a stripe of light.", text: "For timen før søvn." },
        { name: "The candle alone in Story", of: 1, format: "story", products: [CANDLE], scene: "The candle alone, taller.", text: "Tenn kvelden." },
      ],
    ),
  };

  const c: PlanDirection = {
    id: "pd-w-c",
    letter: "C",
    name: "Candle hour",
    idea:
      "A dark room and only the candle: the oil catches its flame. The most intimate of the three, and darker than LYSNE usually goes, so the words must stay readable on a phone.",
    hook: "The first hour after the candle is lit.",
    why: [
      { text: "The candle is the gift's second product: here it is also the light.", source: "product" },
      { text: "Darker than your recent campaigns: a risk on small screens.", source: "fume" },
    ],
    references: [ref(gen("candle-scene"), "The candle as the only light", "moodboard"), ref(img("10-06"), "Darker, the bottle in deep shadow", "fume"), ref(gen("holder-lit"), "A dark shelf, one warm source", "fume")],
    look: lookBase({
      light: line("light", "Light", "The candle is the only light: warm, low, falling off fast into deep shadow.", "fume"),
      set: line("set", "Set", "A dark oak shelf, a stone dish, the room behind in shadow.", "fume"),
      people: line("people", "People", "No people.", "fume"),
    }),
    creatives: winterCreatives(
      "pc-w-c",
      [
        { format: "feed", products: [OIL, CANDLE], scene: "The oil beside the lit candle on a dark shelf, the flame in the glass.", text: "En roligere kveld, gitt.", people: "No people" },
        { format: "feed", products: [OIL], scene: "The oil alone, its glass glowing from the candle just out of frame.", text: "Gi bort en roligere kveld.", people: "No people" },
        { format: "story", products: [OIL, CANDLE], scene: "The open box in candlelight, from above.", text: "Til noen som fortjener kvelden.", people: "No people" },
      ],
      [
        { name: "Master 1 in Story", of: 1, format: "story", scene: "Master 1, taller." },
        { name: "Master 2 in Story", of: 2, format: "story", scene: "Master 2, taller." },
        { name: "Master 3 in Feed", of: 3, format: "feed", scene: "Master 3, closer." },
        { name: "The candle alone", of: 1, format: "feed", products: [CANDLE], scene: "The candle alone, the flame sharp.", text: "Tenn kvelden." },
        { name: "The label, close", of: 1, format: "feed", products: [OIL], scene: "Close on the label in candlelight.", text: "For timen før søvn." },
        { name: "The candle alone in Story", of: 1, format: "story", products: [CANDLE], scene: "The candle alone, taller.", text: "Tenn kvelden." },
      ],
    ),
  };

  // Round 13 (#26): one master with its own look over the plan's: the box from straight above.
  a.creatives[2].look = { camera: "From straight above, 35 mm; the box square in the frame.", light: "The same window light, softer, the box lit from the left." };

  return {
    campaignId: "c-winter",
    version: 1,
    state: "ready",
    briefVersion: 1,
    summary:
      "Winter gifting puts Night Body Oil and Evening Candle forward as one considered gift in the weeks before Christmas. It speaks to people buying for someone close, who want a present that feels chosen rather than grabbed. The message: a slower evening, given. It runs in paid and organic social in Norway, in Norwegian, from Tuesday 3 November.",
    directions: [a, b, c],
    chosenDirectionId: a.id,
    content: [
      line("products", "Products", "Night Body Oil 100 ml and Evening Candle, as their Product Truth says: amber glass, matte burgundy cap, the label front and centred.", "product"),
      line("formats", "Formats", "Feed 4:5 (5 creatives) and Story 9:16 (4 creatives): 9 in all, as your brief asks.", "brief"),
      line("text", "Text on the creative", "One short line in Norwegian on each creative, as planned under The 9 creatives; nothing else on the picture.", "brand_dna", "Your voice: short, quiet sentences"),
      line("cta", "Call to action", "“Kjøp gaven” in the ad's button, never on the picture.", "fume"),
      line("logo", "Logo", "The LYSNE wordmark on the label only; no logo added on the picture.", "brand_dna", "Your Brand DNA: the wordmark stands alone on the label"),
      line("language", "Language", "Norwegian, for Norway.", "brief"),
    ],
    rules: [
      { text: "The bottle with its gift sleeve", kind: "must", source: "brief" },
      { text: "Warm, low light", kind: "must", source: "brief" },
      { text: "Red and green Christmas colours", kind: "never", source: "brief" },
      { text: "Discount language", kind: "never", source: "brief" },
      { text: "Skin-result claims; only “For the hour before sleep.”", kind: "never", source: "brand_dna", ruleId: "r7" },
      { text: "A cropped or covered label", kind: "never", source: "product" },
      { text: "A glossy or black cap", kind: "never", source: "product" },
    ],
    timeline: [
      { label: "Masters, checked by Anna", at: day(5) },
      { label: "Variants and formats", at: day(9) },
      { label: "Delivery", at: day(13) },
      { label: "Goes live", at: day(20) },
    ],
    changeRequestsIncluded: 2,
    writtenAt: at(60 * 18),
    checkedBy: "u-anna",
    checkedAt: at(60 * 3),
  };
}

// ─── Any other brief: the plan Fume writes ─────────────────────────────────

const formatWord = { feed: "Feed 4:5", story: "Story 9:16", square: "Square 1:1" } as const;

/** Fume writes a plan from the brief, the products and what it knows of the brand. `direction` is a direction that
 *  was already chosen (a campaign from before the plan), which then is the plan's only direction. */
export function writePlan(db: Db, campaign: Campaign, brief: Brief, direction?: Direction): CampaignPlan {
  const products = db.products.filter((p) => campaign.productIds.includes(p.id));
  const names = products.map((p) => `${p.name}${p.variant ? ` ${p.variant}` : ""}`);
  const productWords = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0] ?? "the products";
  // In a sentence the products go by their names alone ("Evening Candle and Evening Ritual gift box"), never with sizes.
  const plain = products.map((p) => p.name);
  const productNames = plain.length > 1 ? `${plain.slice(0, -1).join(", ")} and ${plain[plain.length - 1]}` : plain[0] ?? "the products";
  const formats = brief.formats.length ? brief.formats : campaign.formats.length ? campaign.formats : (["feed"] as const);
  // A plan written from a campaign that ran before it counts what that campaign really holds (robot note 04).
  const made = direction ? db.creatives.filter((c) => c.campaignId === campaign.id) : [];
  const madeMasters = made.filter((c) => c.kind === "master").length;
  // Round 13 (robot note 04): the real masters' shapes too, so the plan and the Masters delivery say the same.
  const madeShapes = made.filter((c) => c.kind === "master").map((c) => c.format);
  const total = (made.length || brief.creatives) || formats.length * 3;
  const masters = madeMasters || Math.max(1, Math.min(3, Math.ceil(total / 3)));
  const lower = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
  const trim = (s: string) => s.replace(/[.\s]+$/, "");
  const market = campaign.market ?? "Norway";
  const language = campaign.language ?? "Norwegian";
  const live = campaign.dueAt ? `, from ${dayWords(campaign.dueAt)}` : "";
  const summary = [
    // Her objective is already a sentence about the campaign; it leads as she wrote it.
    brief.objective ? `${trim(brief.objective).charAt(0).toUpperCase()}${trim(brief.objective).slice(1)}.` : `${campaign.name} puts ${productNames} forward.`,
    brief.audience ? `It speaks to ${lower(trim(brief.audience))}.` : "",
    brief.message ? `The message: ${lower(trim(brief.message))}.` : "",
    `It runs in ${market}, in ${language}${live}.`,
  ]
    .filter(Boolean)
    .join(" ");
  const liked = db.references.filter((r) => r.verdict === "liked").map((r) => ref(r.image, r.note ?? "A picture you liked", "taste"));
  const productRefs = products.flatMap((p) => p.images.slice(0, 2).map((image) => ref(image, `${p.name}, as its Product Truth shows it`, "product")));
  const ids = products.map((p) => p.id);
  const look = (light: string, set: string, people: string): PlanLine[] => [
    line("light", "Light", light, "brand_dna", "Your Brand DNA: warm neutrals and amber light"),
    line("camera", "Camera", "50 mm, close and level with the product; the product sharp, the set soft behind.", "fume"),
    line("set", "Set", set, "brand_dna"),
    line("props", "Props", "Only what the product needs: linen, stone, a little glass.", "brand_dna"),
    line("colour", "Colour", "Warm neutrals, amber glass and cream. No saturated colour.", "brand_dna"),
    line("people", "People", people, "brand_dna", "AI models only, always labelled; skin in crops"),
  ];
  // The words on the picture are in the campaign's language: the brief's message as it stands only when that is English;
  // otherwise Fume writes the line from it (the Text line says so), so no English line is planned on a Norwegian creative.
  const english = /^english$/i.test(language);
  const words = english && brief.message ? trim(brief.message) : undefined;
  const crops = [
    { name: "closer", scene: "closer: the product fills more of the frame" },
    { name: "wider", scene: "wider: more of the set around the product" },
    { name: "from above", scene: "from above, the same set" },
  ];
  const creativesFor = (prefix: string, scene: (i: number) => string): PlannedCreative[] => {
    const list: PlannedCreative[] = [];
    for (let i = 0; i < masters; i++)
      list.push({ id: `${prefix}-m${i + 1}`, name: `Master ${i + 1}`, kind: "master", format: madeShapes[i] ?? formats[i % formats.length], productIds: [ids[i % Math.max(1, ids.length)]].filter(Boolean), scene: scene(i), text: words, people: "No people" });
    for (let v = 0; list.length < total; v++) {
      const of = list[v % masters];
      const round = Math.floor(v / masters);
      // first the master in each of the other formats; then a different crop in the master's own format
      const others = formats.filter((f) => f !== of.format);
      const variant =
        round < others.length
          ? { name: `${of.name} in ${formatWord[others[round]].split(" ")[0]}`, format: others[round], scene: `${of.name} in ${formatWord[others[round]]}, the same scene fitted to the frame.` }
          : (() => {
              const crop = crops[(round - others.length) % crops.length];
              return { name: `${of.name}, ${crop.name}`, format: of.format, scene: `${of.name}, ${crop.scene}.` };
            })();
      list.push({ id: `${prefix}-v${v + 1}`, kind: "variant", of: of.id, productIds: of.productIds, text: of.text, people: of.people, ...variant });
    }
    return list;
  };
  const scenes = [
    (i: number) => [`${products[0]?.name ?? "The product"} low in the frame on pale stone, warm side light, air above.`, `${products[1]?.name ?? products[0]?.name ?? "The product"} on folded linen, the light from the left.`, "The products together, seen from above on linen."][i] ?? "The product on stone in evening light.",
    (i: number) => [`Close on ${products[0]?.name ?? "the product"}: its texture in a stripe of warm light.`, "The label close, the set soft behind.", "The product lying on linen, light across it."][i] ?? "Close on the product.",
    (i: number) => [`A crop of skin and ${products[0]?.name ?? "the product"} in evening light, never a face.`, "Hands open the product on linen.", "The product on a bedside, one lamp."][i] ?? "The product at the hour before sleep.",
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
          references: (direction.images.length ? direction.images : [direction.cover]).map((image) => ref(image, direction.name, "fume")),
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
          look: look("Low, warm side light from the left, long soft shadows.", "Pale stone and folded linen.", "No people."),
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
          references: [...productRefs.slice(0, 1), ref(img("05-03"), "Texture in warm light", "fume"), ref(img("06-04"), "Close, a stripe of light", "fume")],
          look: look("A stripe of warm light across the product, the rest in soft shadow.", "Stone, close; nothing else in the frame.", "No people."),
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
          references: [ref(gen("taste-hands"), "Hands in evening light", "taste"), ref(gen("taste-bedroom"), "The evening room", "taste")],
          look: look("One warm lamp, low; the room in soft shadow.", "A bedside of oak and linen.", "Hands or a crop of skin, never a face; never holding the product."),
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
      line("formats", "Formats", `${formats.map((f) => formatWord[f]).join(", ")}: ${total} creatives in all, as your brief asks.`, "brief"),
      line(
        "text",
        "Text on the creative",
        !brief.message ? "No words on the picture." : words ? `“${words}” on each creative, or none.` : `One short line in ${language} on each creative, from your brief’s message “${trim(brief.message)}”.`,
        "brief",
      ),
      line("logo", "Logo", "The wordmark on the label only; no logo added on the picture.", "brand_dna"),
      line("language", "Language", `${language}, for ${market}.`, "brief"),
    ],
    rules: [
      ...brief.mandatory.map((text) => ({ text, kind: "must" as const, source: "brief" as const })),
      ...brief.never.map((text) => ({ text, kind: "never" as const, source: "brief" as const })),
      // the Brand DNA's rule, unless the brief already says it (robot note 04: «Skin-result claims» twice)
      ...(brief.never.some((t) => /^skin-result claims/i.test(t.trim()))
        ? []
        : [{ text: "Skin-result claims; only the lines on the approved list", kind: "never" as const, source: "brand_dna" as const, ruleId: "r7" }]),
    ],
    timeline: stepsBefore(start, campaign.dueAt),
    changeRequestsIncluded: campaign.roundsIncluded ?? 2,
    writtenAt: direction ? direction.checkedAt ?? approvedAt : undefined,
    ...(direction
      ? { checkedBy: direction.checkedBy, checkedAt: direction.checkedAt, approvedBy: direction.decidedBy, approvedAt: direction.decidedAt }
      : { readyBy: workingDays(new Date(NOW).toISOString(), 1) }),
  };
}

/** The steps from a start, each by its working days; a go-live they would pass pulls them in, so the delivery is always
 *  a day before it goes live at the latest (robot note 04: delivery Tue 20 Oct after «Goes live» Sat 17 Oct). */
function stepsBefore(start: string, live?: string): CampaignPlan["timeline"] {
  const steps = [
    { label: "Masters, checked", at: workingDays(start, 3) },
    { label: "Variants and formats", at: workingDays(start, 6) },
    { label: "Delivery", at: workingDays(start, 8) },
  ];
  if (live) {
    const last = Date.parse(live) - 86_400_000;
    const from = Date.parse(start);
    if (Date.parse(steps[2].at) > last && last > from) [3, 6, 8].forEach((d, i) => (steps[i].at = new Date(from + ((last - from) * d) / 8).toISOString()));
  }
  return [...steps, ...(live ? [{ label: "Goes live", at: live }] : [])];
}

// ─── The seed: Winter gifting ready, Black Friday in check ─────────────────

export function r10Db(db: Omit<Db, "plans">): { plans: CampaignPlan[] } {
  const plans: CampaignPlan[] = [winterPlan()];
  const bf = db.campaigns.find((c) => c.id === "c-bf");
  const bfBrief = db.briefs.find((b) => b.campaignId === "c-bf");
  if (bf && bfBrief) {
    const p = writePlan({ ...db, plans } as Db, bf, bfBrief);
    // Black Friday's own look (the campaign's look in the brief): black grounds, gold words, one hard light.
    for (const d of p.directions) {
      d.look = d.look.map((l) =>
        l.key === "light"
          ? line("light", "Light", "Hard top light, one bright edge on the glass.", "brief", "Your Black Friday look")
          : l.key === "colour"
            ? line("colour", "Colour", "Night black grounds, gold-foil words, linen for small text.", "brief", "Your Black Friday look")
            : l,
      );
    }
    p.directions[0].name = "One evening, wrapped";
    p.directions[0].idea = "The oil and the candle as one set on night black, gold words, one hard light catching the glass. The offer readable at a glance, the evening still calm.";
    p.directions[0].references = [ref(img("10-06"), "Darker, one hard light on the glass", "brief"), ref(gen("ritual-pack"), "The set", "product"), ref(img("02-09"), "The bottle close, glass catching light", "fume")];
    // Round 13 (#25): the expert's check is optional; Maja asked Anna to check this one.
    plans.push({ ...p, state: "in_check", writtenAt: at(60 * 4), readyBy: day(2), checkAsked: { by: "u-maja", at: at(60 * 3) } });
  }
  return { plans };
}

// ─── Round 13: a new version really changes what she asked ─────────────────

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
  const phrase = what ? (/^(the|a|an|no|more|less)\b/i.test(what) ? what.charAt(0).toLowerCase() + what.slice(1) : `the ${what.charAt(0).toLowerCase()}${what.slice(1)}`) : "";
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
  // what follows the master keeps to it
  return [`${m.name}’s scene: ${phrase}`];
}

// ─── The calls ─────────────────────────────────────────────────────────────

export function r10PlanApi(ctx: R10PlanContext): Pick<
  FumeApi,
  "plan" | "sendBrief" | "approveBrief" | "approvePlan" | "undoApprovePlan" | "changePlan" | "choosePlanDirection" | "askPlanChanges" | "checkPlan" | "askPlanCheck" | "answerClientPlan"
> {
  const { db, wait, now, emit, say } = ctx;
  const pace = ctx.pace ?? { write: 2500, check: 4000, change: 2500 };

  const campaignOf = (id: Id) => {
    const c = db.campaigns.find((x) => x.id === id);
    if (!c) throw new FumeError("not_found", `No campaign ${id}`);
    return c;
  };
  // Round 11 (FLOWS §24.2): an agency's own people check its work; no Fume expert checks an agency's plan.
  const agencyRun = (workspaceId: Id) => Boolean(db.workspaces?.find((w) => w.id === workspaceId)?.agencyId);
  const expertOf = (workspaceId: Id) => (agencyRun(workspaceId) ? undefined : db.staff.find((s) => s.workspaceId === workspaceId && s.staffRole === "expert")?.userId);
  const firstName = (id?: Id) => (id ? db.users.find((u) => u.id === id)?.name.split(" ")[0] : undefined);
  // Round 12 (DLOAD-4, FLOWS §24.2): in a brand an agency runs, the agency makes the plan with Fume and changes it.
  // Round 13 (Marcus's card, 23 Oct 2026): the agency checks it and sends it; only the client approves it.
  const agencyName = (workspaceId: Id) => db.organisations?.find((o) => o.id === db.workspaces?.find((w) => w.id === workspaceId)?.agencyId)?.name ?? "The agency";
  const agencyPerson = () => Boolean(db.users.find((u) => u.id === ctx.userId())?.agency);
  /** The client's first name, as the plan's words say it ("Maja"). */
  const clientName = (c: Campaign) => firstName(c.approverId) ?? "the client";
  /** Shaping the plan (a line, the direction, a new version) is the agency's, and only until it sends it to the client. */
  const mustShape = (c: Campaign, p?: CampaignPlan) => {
    if (!agencyRun(c.workspaceId)) return;
    if (!agencyPerson()) throw new FumeError("forbidden", `${agencyName(c.workspaceId)} makes the plan with Fume. You approve it, or ask for changes.`);
    if (p?.state === "ready" && p.checkedBy) throw new FumeError("invalid", `The plan is with ${clientName(c)}. She approves it or asks for changes.`);
  };
  /** Approving the plan is the client's, once the agency has checked it and sent it to her. */
  const mustApproveAsClient = (c: Campaign, p: CampaignPlan) => {
    if (!agencyRun(c.workspaceId)) return;
    if (agencyPerson()) throw new FumeError("forbidden", `Only ${clientName(c)} approves the plan. Check it and send it to her.`);
    if (p.state === "ready" && !p.checkedBy) throw new FumeError("invalid", `${agencyName(c.workspaceId)} checks the plan first.`);
  };
  /** The clock's paused reason, read on the studio's side (features/studio/parts.tsx), so with the customer's name, as
   *  seed.ts words it: "The plan waits on Maja’s approval." In agency work it waits for the agency’s check, then (once
   *  the agency has sent it) on the client's approval. */
  const waitsOn = (c: Campaign, p?: CampaignPlan) =>
    agencyRun(c.workspaceId) && !p?.checkedBy ? `The plan waits for ${agencyName(c.workspaceId)}’s check.` : `The plan waits on ${firstName(c.approverId) ?? "the customer"}’s approval.`;
  /** Who the plan waits on: the customer's approver, or in agency work the agency person who sent the brief. */
  const decider = (c: Campaign) => {
    if (!agencyRun(c.workspaceId)) return c.approverId;
    const sender = db.briefs.find((b) => b.campaignId === c.id)?.approvedBy;
    const agencyId = db.workspaces?.find((w) => w.id === c.workspaceId)?.agencyId;
    return db.users.find((u) => u.id === sender && u.agency)?.id ?? db.users.find((u) => u.agency?.organisationId === agencyId)?.id ?? c.approverId;
  };
  const threadOf = (campaignId: Id) => db.threads.find((t) => t.campaignId === campaignId && t.kind !== "contact") ?? db.threads.find((t) => !t.campaignId && t.kind !== "contact");
  const clockTo = (campaignId: Id, stage: ServiceClock["stage"], dueAt: string, state: ServiceClock["state"] = "running", pausedReason?: string) => {
    const k = db.clocks.find((x) => x.campaignId === campaignId);
    const next: ServiceClock = { campaignId, stage, dueAt, state, ...(pausedReason ? { pausedReason } : {}) };
    if (k) Object.assign(k, next, pausedReason ? {} : { pausedReason: undefined });
    else db.clocks.push(next);
  };
  const changed = (c: Campaign) => {
    c.updatedAt = now();
    emit({ type: "campaign.state", campaign: c });
  };
  const notify = (c: Campaign, text: string, actor: Notification["actor"], kind: Notification["kind"] = "waiting_on_you") => {
    const n: Notification = { id: ctx.nextId("n"), userId: decider(c), kind, actor, text, href: `/campaigns/${c.id}/plan`, read: false, at: now() };
    db.notifications.unshift(n);
    emit({ type: "notification.new", notification: n });
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
    // Round 13 (Marcus's card): in agency work the agency checked it and the client approved it, whoever chose the direction.
    if (agencyRun(c.workspaceId) && db.users.find((u) => u.id === p.approvedBy)?.agency) Object.assign(p, { checkedBy: p.approvedBy, checkedAt: p.checkedAt ?? p.approvedAt, approvedBy: c.approverId });
    db.plans.push(p);
    return p;
  };
  const must = (campaignId: Id) => {
    const p = planOf(campaignId);
    if (!p) throw new FumeError("not_found", "This campaign has no plan yet. Send the brief first.");
    return p;
  };

  const mastersIn = (p: CampaignPlan) => {
    const n = (p.directions.find((d) => d.id === p.chosenDirectionId) ?? p.directions[0])?.creatives.filter((x) => x.kind === "master").length ?? 0;
    return n === 1 ? "master" : n ? `${n} masters` : "masters";
  };

  /** The plan is ready: it waits on her, the chat and the bell say so. */
  const ready = (c: Campaign, p: CampaignPlan, checkedBy?: Id) => {
    Object.assign(p, { state: "ready", checkedBy, checkedAt: now(), readyBy: undefined });
    Object.assign(c, { state: "in_review", stage: "plan" });
    clockTo(c.id, "plan", p.timeline[0]?.at ?? now(), "paused_waiting_on_you", waitsOn(c, p));
    const who = firstName(checkedBy);
    const t = threadOf(c.id);
    // Round 13 (Marcus's card): in agency work the agency checks it and sends it to the client, who approves it.
    const agency = agencyRun(c.workspaceId);
    const which = p.version > 1 ? `Version ${p.version} of the plan for ${c.name}` : `The plan for ${c.name}`;
    if (t)
      say(t.id, {
        author: { kind: "fume" },
        // Round 13 (#25): no expert unless she asked for one; she approves it, changes it with Fume, or asks the expert.
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

  /** Fume writes the plan from the brief she sent; the expert checks it (the mock plays both, quickly). */
  const startPlan = (c: Campaign, brief: Brief) => {
    const p = writePlan(db, c, brief);
    const readyBy = workingDays(now(), 1);
    Object.assign(p, { state: "writing", readyBy });
    // Round 13 (#21): a brief changed after it was sent makes the plan again, as its next version.
    const before = db.plans.find((x) => x.campaignId === c.id);
    if (before && before.state !== "approved")
      Object.assign(p, {
        version: before.version + 1,
        versions: [...(before.versions ?? []), { version: before.version + 1, at: now(), by: ctx.userId(), changes: [`Written again from version ${brief.version} of the brief`] }],
      });
    db.plans = db.plans.filter((x) => x.campaignId !== c.id);
    db.plans.push(p);
    Object.assign(c, { state: "scoped", stage: "plan" });
    clockTo(c.id, "plan", readyBy);
    const t = threadOf(c.id);
    if (t)
      say(t.id, {
        author: { kind: "fume" },
        text: `Thank you. Fume writes the plan now: the direction, the look and every creative, before anything is made. You see it here by ${dayWords(readyBy)}.`,
        card: { kind: "plan", campaignId: c.id, version: p.version },
      });
    changed(c);
    // Round 13 (#20, #25): the plan is hers as soon as Fume has written it; the expert checks it only when she asks.
    setTimeout(() => {
      if (p.state !== "writing") return;
      p.writtenAt = now();
      ready(c, p, undefined);
    }, pace.write);
  };

  const sendBrief = async (campaignId: Id) => {
    ctx.mustApprove();
    const b = db.briefs.find((x) => x.campaignId === campaignId);
    if (!b) throw new FumeError("not_found", "No brief");
    if (b.missing.length) throw new FumeError("invalid", "Fume still needs something for this brief.");
    const gaps = (["objective", "audience", "message"] as const).filter((k) => !(b[k] ?? "").trim());
    if (gaps.length) throw new FumeError("invalid", `Fill in the ${gaps.join(" and the ")} first.`);
    const c = campaignOf(campaignId);
    if (!c.productIds.length && !c.collectionIds?.length) throw new FumeError("invalid", "Pick the product the campaign is for first.");
    // The brief is fixed at this version: it is what Fume writes the plan from.
    Object.assign(b, { state: "approved", approvedBy: ctx.userId(), approvedAt: now() });
    startPlan(c, b);
    return wait(b);
  };

  /** The plan approved, by her (or, through the client link, by the client it was sent to): the Engine starts. */
  const approve = (c: Campaign, p: CampaignPlan, by: Id, note?: string) => {
    Object.assign(p, { state: "approved", approvedBy: by, approvedAt: now(), approvedNote: note });
    const agency = agencyRun(c.workspaceId);
    const direction = p.directions.find((d) => d.id === p.chosenDirectionId)!;
    const masterList = direction.creatives.filter((x) => x.kind === "master");
    const masters = masterList.length;
    // A product the plan shows that waits to be confirmed holds the masters that show it (DLOAD-3); the others start.
    const waiting = db.products.filter((x) => c.productIds.includes(x.id) && x.state === "needs_you");
    const held = masterList.filter((m) => m.productIds.some((id) => waiting.some((x) => x.id === id)));
    const going = masterList.filter((m) => !held.includes(m));
    const list = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : (names[0] ?? ""));
    const productWords = list(waiting.map((x) => x.name));
    Object.assign(c, { state: "in_production", stage: "masters" });
    const due = p.timeline[0]?.at ?? workingDays(now(), 3);
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
        { label: `Masters in ${direction.name}`, state: going.length ? "active" : "waiting", detail: `0 of ${masters}` },
        ...(held.length ? [{ label: `${list(held.map((m) => m.name))}: ${productWords} to confirm first`, state: "waiting" as const }] : []),
        { label: `Quality Gate: ${agency ? agencyName(c.workspaceId) : (firstName(expert) ?? "the expert")} checks each master`, state: "waiting" },
      ],
    };
    db.runs = db.runs.filter((r) => r.id !== run.id);
    db.runs.push(run);
    const t = threadOf(c.id);
    const lead = agency ? `${approver} approved the plan.` : "Approved.";
    if (t)
      say(t.id, {
        author: { kind: "fume" },
        text: `${
          held.length === 0
            ? `${lead} The Engine has started on the ${masters === 1 ? "master" : `${masters} masters`} in ${direction.name}.`
            : going.length === 0
              ? `${lead} The Engine starts on the ${masters === 1 ? "master" : `${masters} masters`} in ${direction.name} once ${productWords} ${waiting.length === 1 ? "is" : "are"} confirmed.`
              : `${lead} The Engine has started on ${list(going.map((m) => m.name))} in ${direction.name}; ${list(held.map((m) => m.name))} ${held.length === 1 ? "starts" : "start"} once ${productWords} ${waiting.length === 1 ? "is" : "are"} confirmed.`
        } ${expert ? `${firstName(expert)} checks each one before you see it, by ${dayWords(due)}.` : agency ? `They are yours to check by ${dayWords(due)}, before ${approver} sees them.` : `They are yours to check by ${dayWords(due)}.`}`,
        card: { kind: "run", runId: run.id },
      });
    // The agency hears that its client approved (in Fume the approver is the one who acted).
    if (agency) notify(c, `${approver} approved the plan for ${c.name}${note ? " in the client link" : ""}. The Engine has started.`, { kind: "person", userId: by }, "checked");
    changed(c);
  };

  /** Changes asked by her (or, in agency work, by the client): Fume writes the next version. */
  const askChanges = (c: Campaign, p: CampaignPlan, by: Id, note: string, name?: string) => {
    Object.assign(p, { state: "changes_asked", note: { by, text: note, at: now() }, readyBy: workingDays(now(), 1) });
    Object.assign(c, { state: "revision", stage: "plan" });
    clockTo(c.id, "plan", p.readyBy!);
    const t = threadOf(c.id);
    // In agency work a client's ask reaches the agency's conversation with her name; the agency checks the next version.
    const fromClient = agencyRun(c.workspaceId) && !db.users.find((u) => u.id === by)?.agency;
    const who = name ?? firstName(by) ?? "The client";
    if (t) {
      say(t.id, { author: { kind: "person", userId: by }, text: note });
      say(t.id, {
        author: { kind: "fume" },
        text: fromClient
          ? `${who} asked for changes to the plan for ${c.name}. Fume is changing it: you get version ${p.version + 1} here by ${dayWords(p.readyBy!)}, to check and send to ${clientName(c)}. Changing the plan never uses a change request.`
          : `Fume is changing the plan for ${c.name}. You get version ${p.version + 1} here by ${dayWords(p.readyBy!)}. Changing the plan never uses a change request.`,
      });
    }
    if (fromClient) notify(c, `${who} asked for changes to the plan for ${c.name}: “${note}”`, { kind: "person", userId: by }, "changes_asked");
    changed(c);
    setTimeout(() => {
      if (p.state !== "changes_asked") return;
      const asked = p.note?.text ?? "";
      const asker = p.note?.by ?? by;
      // Round 13 (robot note 03, #25): the change is made, and the version says what it changed.
      const changes = applyAsk(p, asked, now());
      Object.assign(p, {
        version: p.version + 1,
        writtenAt: now(),
        note: { by: "fume", text: changes.length ? `Changed as you asked: ${changes.join("; ")}.` : `Changed as you asked: “${asked}”`, at: now() },
        versions: [...(p.versions ?? []), { version: p.version + 1, at: now(), by: asker, asked, changes }],
        checkedBy: undefined,
        checkedAt: undefined,
      });
      // Round 13 (#25): the new version is hers at once (in agency work, the agency's to check and send again).
      ready(c, p, undefined);
    }, pace.change);
  };

  return {
    async plan(campaignId) {
      const p = planOf(campaignId) ?? null;
      // The customer sees the plan once it is checked; while Fume writes it or the expert checks it, only its state.
      if (p && !ctx.isStaff() && (p.state === "writing" || p.state === "in_check"))
        return wait({ ...p, directions: [], content: [], rules: [], summary: "" });
      // Round 13: in agency work the client sees the plan once the agency has checked it and sent it to her.
      const c = db.campaigns.find((x) => x.id === campaignId);
      if (p && c && agencyRun(c.workspaceId) && !agencyPerson() && p.state === "ready" && !p.checkedBy)
        return wait({ ...p, directions: [], content: [], rules: [], summary: "" });
      return wait(p);
    },
    sendBrief,
    // Older callers (the chat's brief card, the brief page, the form) approve the brief: it is the same as sending it.
    approveBrief: sendBrief,
    async approvePlan(campaignId) {
      ctx.mustApprove();
      const p = must(campaignId);
      const c = campaignOf(campaignId);
      mustApproveAsClient(c, p);
      if (p.state !== "ready") throw new FumeError("invalid", p.state === "approved" ? "You approved this plan already." : "The plan isn't ready for you yet.");
      approve(c, p, ctx.userId());
      return wait(p);
    },
    async answerClientPlan({ token, verdict, text, name }) {
      const send = (db.clientSends ?? []).find((s) => s.link?.token === token && s.plan);
      if (!send) throw new FumeError("not_found", "This client link has expired, or it holds no plan.");
      // The agency's own people see the link as a preview (DWAY-4); an answer there is never the client's.
      if (agencyPerson()) throw new FumeError("forbidden", "This is a preview of the client’s page. Only the client answers here.");
      const c = campaignOf(send.campaignId);
      const p = must(c.id);
      if (p.state !== "ready" || !p.checkedBy) throw new FumeError("conflict", p.state === "approved" ? "The plan is approved already." : `${agencyName(c.workspaceId)} is working on the plan. You get the next version here.`);
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
      ctx.mustApprove();
      const p = must(campaignId);
      if (p.state !== "approved") return wait(p);
      const c = campaignOf(campaignId);
      // In agency work the approval is the client's, so only she undoes it.
      if (agencyRun(c.workspaceId) && agencyPerson()) throw new FumeError("forbidden", `${clientName(c)} approved the plan; only she can undo it.`);
      Object.assign(p, { state: "ready", approvedBy: undefined, approvedAt: undefined, approvedNote: undefined });
      Object.assign(c, { state: "in_review", stage: "plan" });
      db.runs = db.runs.filter((r) => r.id !== `run-plan-${c.id}`);
      clockTo(c.id, "plan", p.timeline[0]?.at ?? now(), "paused_waiting_on_you", waitsOn(c, p));
      // What Fume said when it was approved goes too: nothing started.
      const t = threadOf(c.id);
      const last = t ? [...db.messages].reverse().find((m) => m.threadId === t.id && m.card?.kind === "run" && (m.card as { runId: Id }).runId === `run-plan-${c.id}`) : undefined;
      if (last) db.messages = db.messages.filter((m) => m !== last);
      changed(c);
      return wait(p);
    },
    async changePlan(campaignId, change) {
      const p = must(campaignId);
      mustShape(campaignOf(campaignId), p);
      if (!ctx.isStaff()) {
        ctx.mustApprove();
        if (p.state !== "ready") throw new FumeError("invalid", "The plan can be changed once it is ready for you.");
      }
      const direction = p.directions.find((d) => d.id === p.chosenDirectionId)!;
      const by = { changedBy: ctx.userId(), changedAt: now() };
      if (change.step) {
        // Round 13 (#67): a step's day ("Goes live"); the go-live is the campaign's too.
        const st = p.timeline.find((x) => x.label === change.step || x.label.startsWith(`${change.step},`));
        if (!st || !change.stepAt) throw new FumeError("not_found", "No such step in the plan.");
        st.at = change.stepAt;
        if (/^goes live/i.test(st.label)) campaignOf(campaignId).dueAt = change.stepAt;
      } else if (change.creativeId) {
        const pc = direction.creatives.find((x) => x.id === change.creativeId);
        if (!pc) throw new FumeError("not_found", "No such creative in the plan.");
        Object.assign(pc, change.creative ?? {}, change.value !== undefined ? { scene: change.value } : {});
        // Round 13: its own look (#26; null goes back to the plan's) and its go-live day (#67)
        if (change.look !== undefined) pc.look = change.look && Object.values(change.look).some((v) => v?.trim()) ? change.look : undefined;
        if (change.liveAt) pc.liveAt = change.liveAt;
        Object.assign(pc, by);
      } else if (change.line) {
        const l = direction.look.find((x) => x.key === change.line) ?? p.content.find((x) => x.key === change.line);
        if (!l) throw new FumeError("not_found", "No such line in the plan.");
        if (!(change.value ?? "").trim()) throw new FumeError("invalid", "Write what it should be.");
        // The expert's change keeps its source and why, and who made it (DTASK-9: "Changed by Anna" on both sides).
        Object.assign(l, { value: change.value!.trim(), source: ctx.isStaff() ? l.source : "you", why: ctx.isStaff() ? l.why : undefined }, by);
      }
      changed(campaignOf(campaignId));
      return wait(p);
    },
    async choosePlanDirection(campaignId, directionId, reason) {
      ctx.mustApprove();
      const p = must(campaignId);
      mustShape(campaignOf(campaignId), p);
      if (p.state !== "ready") throw new FumeError("invalid", "The plan can be changed once it is ready for you.");
      if (!p.directions.some((d) => d.id === directionId)) throw new FumeError("not_found", "No such direction in the plan.");
      Object.assign(p, { chosenDirectionId: directionId, chosenReason: reason?.trim() || undefined });
      changed(campaignOf(campaignId));
      return wait(p);
    },
    async askPlanChanges(campaignId, note) {
      ctx.mustApprove();
      const p = must(campaignId);
      const c = campaignOf(campaignId);
      // In agency work the agency changes the plan before it sends it; the client asks for changes once it is hers.
      if (!(agencyRun(c.workspaceId) && !agencyPerson() && p.checkedBy)) mustShape(c, p);
      if (p.state !== "ready") throw new FumeError("invalid", "The plan can be changed once it is ready for you.");
      if (!note.trim()) throw new FumeError("invalid", "Write what Fume should change.");
      askChanges(c, p, ctx.userId(), note.trim());
      return wait(p);
    },
    // Round 13 (#25): she asks the expert to check the plan before she approves it (optional).
    async askPlanCheck(campaignId) {
      ctx.mustApprove();
      const p = must(campaignId);
      const c = campaignOf(campaignId);
      mustShape(c, p);
      const expert = expertOf(c.workspaceId);
      if (!expert) throw new FumeError("invalid", "No expert checks plans in this brand.");
      if (p.state !== "ready") throw new FumeError("invalid", "The plan can be checked once it is ready for you.");
      Object.assign(p, { state: "in_check", checkAsked: { by: ctx.userId(), at: now() }, readyBy: workingDays(now(), 1), checkedBy: undefined, checkedAt: undefined });
      Object.assign(c, { state: "scoped", stage: "plan" });
      clockTo(c.id, "plan", p.readyBy!);
      const t = threadOf(c.id);
      if (t) say(t.id, { author: { kind: "fume" }, text: `${firstName(expert)} checks the plan for ${c.name} and you see it again by ${dayWords(p.readyBy!)}. Nothing is made before you approve it.` });
      const n: Notification = { id: ctx.nextId("n"), userId: expert, kind: "waiting_on_you", actor: { kind: "person", userId: ctx.userId() }, text: `${firstName(ctx.userId()) ?? "The customer"} asked you to check the plan for ${c.name}`, href: `/studio/b/${c.workspaceId}/campaigns/${c.id}/plan`, read: false, at: now() };
      db.notifications.unshift(n);
      emit({ type: "notification.new", notification: n });
      changed(c);
      // the mock plays the expert's check, so the flow can be tried end to end
      setTimeout(() => {
        if (p.state === "in_check" && p.checkAsked) ready(c, p, expert);
      }, pace.check);
      return wait(p);
    },
    async checkPlan(campaignId) {
      const p = must(campaignId);
      const c = campaignOf(campaignId);
      // Round 13 (Marcus's card): in agency work the agency checks the plan, which makes it the client's to approve
      // (sendToClient with `plan` calls this and tells her).
      if (agencyRun(c.workspaceId)) {
        if (!agencyPerson()) throw new FumeError("forbidden", `${agencyName(c.workspaceId)} checks the plan.`);
        if (p.state !== "ready") throw new FumeError("invalid", p.state === "approved" ? `${clientName(c)} approved this plan already.` : "The plan is not ready to check yet.");
        if (!p.checkedBy) Object.assign(p, { checkedBy: ctx.userId(), checkedAt: now() });
        clockTo(c.id, "plan", p.timeline[0]?.at ?? now(), "paused_waiting_on_you", waitsOn(c, p));
        changed(c);
        return wait(p);
      }
      if (!ctx.isStaff()) throw new FumeError("forbidden", "Only Fume's expert checks a plan.");
      if (p.state !== "in_check" && p.state !== "writing") throw new FumeError("invalid", "This plan is not in check.");
      ready(campaignOf(campaignId), p, ctx.userId());
      return wait(p);
    },
  };
}
