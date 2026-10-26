// Campaigns: started in the chat or from a brief, their scope and directions, the brief's templates and alternatives,
// what waits in each (one status sentence everywhere), and the content calendar.
import {
  FumeError,
  type Brief,
  type BriefTemplate,
  type Campaign,
  type CampaignWaits,
  type CalendarEntry,
  type Channel,
  type FumeApi,
  type Id,
} from "../contract";
import { customerSeesDirection } from "../domain/creatives";
import { addWorkingDays } from "../domain/dates";
import { canApprove } from "../domain/permissions";
import { mastersOnHold } from "../domain/plan";
import { canBeMade, productsToConfirm } from "../domain/products";
import {
  audienceIn,
  briefQuestions,
  campaignName,
  dateOptions,
  messageOptions,
  objectiveOf,
  occasionOf,
  productQuestion,
  productsNamed,
  questionCard,
  sameCampaign,
} from "./chatBrief";
import type { BriefQuestion, Mock } from "./context";

type Calls =
  | "campaigns"
  | "campaign"
  | "startCampaign"
  | "changeBrief"
  | "chooseDirection"
  | "passDirections"
  | "setCampaignScope"
  | "skipMoodboard"
  | "briefTemplates"
  | "briefAlternatives"
  | "calendar"
  | "schedule"
  | "moveEntry"
  | "removeEntry";

// ─── What waits in a campaign ─────────────────────────────────────────────

/** What waits in one campaign, read from the rows that say it: the questions Fume still has for the brief, the
 *  directions ready to choose from, whether the brief waits on its approval, where the plan stands, the masters under
 *  way, the checked creatives not sent yet, the plan's delivery date and size, and the date Fume works to.
 *  copy.campaignStatus reads it, so Home, the list, the header, ⌘K, the collection and the chat say ONE sentence with
 *  the same numbers. */
function waitsOf(m: Mock, campaign: Campaign): CampaignWaits {
  const { db } = m;
  const id = campaign.id;
  const brief = db.briefs.find((b) => b.campaignId === id);
  const clock = db.clocks.find((k) => k.campaignId === id);
  const open = brief && brief.state !== "approved";
  const c = db.campaigns.find((x) => x.id === id);
  const plan = db.plans.find((p) => p.campaignId === id);
  // A campaign that has just started (its brief approved, no directions yet, no service clock): the directions are
  // due three working days after the approval.
  const fresh =
    !clock &&
    brief?.state === "approved" &&
    brief.approvedAt &&
    (c?.stage === "directions" || c?.stage === "plan") &&
    !db.directions.some((d) => d.campaignId === id);
  const waits: CampaignWaits = {
    questions: open ? brief.missing.length : 0,
    directions: db.directions.filter((d) => d.campaignId === id && d.state === "proposed").length,
    briefReady: Boolean(open && brief.state === "ready" && brief.missing.length === 0),
    // Where the plan stands, while it is the step under way.
    ...(c?.stage === "plan" && plan ? { plan: plan.state, planChecked: Boolean(plan.checkedBy) } : {}),
    ...mastersOf(m, c),
    ...toSendOf(m, c),
    ...planNumbers(m, id),
    // Only while Fume works to it: a clock paused on the customer, met or late is not a promise.
    ...(clock?.state === "running" ? { by: clock.dueAt } : fresh ? { by: addWorkingDays(brief.approvedAt!, 3) } : {}),
  };
  // In a client brand an agency runs, the agency reads how many checked creatives it has not sent yet.
  if (m.agencyRun(campaign.workspaceId))
    waits.toSend = db.creatives.filter((cr) => cr.campaignId === id && m.unsentToClient(cr)).length;
  return waits;
}

/** The approved plan's masters, while the Engine makes them (stage masters, nothing checked yet). A master whose
 *  product still waits to be confirmed is not under way, so it is not counted. */
function mastersOf(m: Mock, campaign: Campaign | undefined): Pick<CampaignWaits, "masters"> {
  const { db } = m;
  if (!campaign || campaign.stage !== "masters" || campaign.state !== "in_production") return {};
  const plan = db.plans.find((p) => p.campaignId === campaign.id && p.state === "approved");
  const all =
    plan?.directions.find((d) => d.id === plan.chosenDirectionId)?.creatives.filter((c) => c.kind === "master") ?? [];
  const going = mastersOnHold(all, productsToConfirm(campaign, db.products)).going.length;
  const n = going || all.length;
  return n ? { masters: n } : {};
}

/** Checked creatives not sent to the customer yet. In Fume, a campaign in production holds its checked set until it is
 *  released; after that, the creatives checked since wait for the next send. (An agency sends its own: waitsOf.) */
function toSendOf(m: Mock, campaign: Campaign | undefined): Pick<CampaignWaits, "toSend"> {
  const { db } = m;
  if (!campaign || m.agencyRun(campaign.workspaceId)) return {};
  const checked = db.creatives.filter((cr) => cr.campaignId === campaign.id && cr.current.state === "checked").length;
  const held = db.creatives.filter((cr) => cr.campaignId === campaign.id && m.unsentByFume(cr)).length;
  return checked ? { toSend: campaign.state === "in_production" ? checked : held } : {};
}

/** The plan's "Delivery" step and its creatives (the chosen direction's), for the labelled dates ("Delivery Tue
 *  27 Oct", never a bare "Due") and "Planned: 9 creatives" before any is made. */
function planNumbers(m: Mock, id: Id): Pick<CampaignWaits, "delivery" | "planned"> {
  const { db } = m;
  const campaign = db.campaigns.find((c) => c.id === id);
  // A delivered campaign's date is its delivery's; one closed before deliveries were recorded keeps its last change.
  const sent = db.deliveries
    .filter((d) => d.campaignId === id && d.state === "confirmed_live")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (campaign && ["delivered", "closed"].includes(campaign.state))
    return { delivery: sent?.createdAt ?? campaign.updatedAt };
  // A campaign made before plans existed (it chose a direction) has a plan written afterwards from its brief, on
  // demand: its dates are not the record, so they are left out (the go-live stays).
  const plan = campaign?.chosenDirectionId ? undefined : db.plans.find((p) => p.campaignId === id);
  if (!plan) return {};
  const delivery = plan.timeline.find((t) => t.label === "Delivery")?.at;
  const planned = plan.directions.find((d) => d.id === plan.chosenDirectionId)?.creatives.length;
  return { ...(delivery ? { delivery } : {}), ...(planned ? { planned } : {}) };
}

/** Every campaign row carries its live `waits`, read when a call returns it, so an answered question or a chosen
 *  direction shows everywhere at once. New rows get it as they are pushed. */
export function installWaits(m: Mock) {
  const give = (c: Campaign) => {
    if (Object.getOwnPropertyDescriptor(c, "waits")?.get) return;
    Object.defineProperty(c, "waits", { get: () => waitsOf(m, c), enumerable: true, configurable: true });
  };
  m.db.campaigns.forEach(give);
  const list = m.db.campaigns;
  const push = list.push.bind(list);
  list.push = (...rows: Campaign[]) => {
    rows.forEach(give);
    return push(...rows);
  };
}

// ─── The brief's templates and alternatives ───────────────────────────────

/** Fume's own templates. */
const FUME_TEMPLATES: BriefTemplate[] = [
  {
    id: "tpl-launch",
    kind: "fume",
    name: "Product launch",
    description: "A new product, introduced to people who already know the brand.",
    goal: "Launch the product and make it the one people ask for this season",
    audience: "Existing customers and people who follow the brand",
    message: "Something new for the hour before sleep",
    channels: ["paid_social", "organic_social", "product_page"],
    formats: ["feed", "story", "square"],
    creatives: 12,
    mandatory: ["The product, label front and centred"],
    never: ["Before-and-after pictures"],
  },
  {
    id: "tpl-seasonal",
    kind: "fume",
    name: "Seasonal",
    description: "A season's mood around the products that suit it.",
    goal: "Show the products in this season's light, on social",
    audience: "People who buy for themselves when the season turns",
    message: "The season, slowed down",
    channels: ["organic_social", "paid_social"],
    formats: ["feed", "story"],
    creatives: 8,
  },
  {
    id: "tpl-bf",
    kind: "fume",
    name: "Black Friday",
    description: "One clear offer for one week, readable at a glance.",
    goal: "Black Friday: one offer for one week, in paid social and email",
    audience: "Existing customers and people who saved our posts",
    message: "One evening, wrapped",
    channels: ["paid_social", "email"],
    formats: ["feed", "story", "square"],
    creatives: 9,
    mandatory: ["The offer readable at a glance"],
    never: ["Countdown clocks", "Red discount stickers"],
  },
  {
    id: "tpl-always",
    kind: "fume",
    name: "Always-on social",
    description: "A steady month of posts that keep the brand in view.",
    goal: "A month of organic posts that keep the brand in view",
    audience: "People who follow the brand",
    message: "The evening ritual, every day",
    channels: ["organic_social"],
    formats: ["feed", "story"],
    creatives: 12,
  },
  {
    id: "tpl-email",
    kind: "fume",
    name: "Email",
    description: "Headers and pictures for one newsletter.",
    goal: "Pictures for this month's newsletter",
    audience: "Newsletter subscribers",
    message: "What is new this month",
    channels: ["email"],
    formats: ["square", "feed"],
    creatives: 4,
  },
];

const trim = (s: string) => s.replace(/[.\s]+$/, "").trim();
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Three angles for a message, written from the brief's own words and the products; a new round and her feedback
 *  ("warmer", "shorter") move them. Never her own words back as an alternative. */
function messages(base: string, product: string, feedback: string, round: number): string[] {
  const f = feedback.toLowerCase();
  const short = /short|kort|fewer|brief/.test(f);
  const warm = /warm|varm|soft|myk/.test(f);
  const bold = /bold|strong|sterk|louder/.test(f);
  const pools = [
    [
      `${product}, for the hour before sleep`,
      "A slower evening, given",
      "The last quiet hour of the day",
      "Made to be felt, at night",
      "Give the evening back",
    ],
    [
      "The evening, wrapped",
      `${product}: a quiet gift`,
      "For someone who deserves the evening",
      "Light the evening",
      "Slow down. Then sleep",
    ],
    [
      "Warm light, a slower night",
      "The ritual after the day",
      `Keep ${product} by the bed`,
      "An evening worth giving",
      "Less day, more evening",
    ],
  ];
  const out = pools
    .map((pool, i) => pool[(round + i) % pool.length])
    .map((x, i) => (trim(x) === trim(base) ? pools[i][(round + i + 1) % pools[i].length] : x));
  return out.map((x) => {
    let t = x;
    if (warm) {
      const w = t.replace(/^The /, "A warm ").replace(/quiet/, "warm");
      t =
        w !== t
          ? w
          : t.replace(
              /\b(the|an?) (evening|night|hour)\b/i,
              (_m, art: string, word: string) => `${/^an$/i.test(art) ? "a" : art} warm ${word}`,
            );
      if (t === x) t = `${t}, warmly`;
    }
    if (bold) t = t.replace(/^(A|The) /, "").replace(/^./, (ch) => ch.toUpperCase());
    if (short) t = t.split(/[,:]/)[0];
    return cap(trim(t));
  });
}

export function campaignCalls(m: Mock): Pick<FumeApi, Calls> {
  const { db, wait } = m;

  return {
    async campaigns(filter) {
      let list = m.myCampaigns();
      if (filter?.state?.length) list = list.filter((c) => filter.state!.includes(c.state));
      if (filter?.search) list = list.filter((c) => c.name.toLowerCase().includes(filter.search!.toLowerCase()));
      return wait(list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    },
    // The customer sees directions only once the expert has checked them.
    async campaign(id) {
      const campaign = m.campaignOf(id);
      const brief: Brief = db.briefs.find((b) => b.campaignId === id) ?? {
        campaignId: id,
        version: 1,
        state: "drafting",
        objective: "",
        audience: "",
        message: "",
        mandatory: [],
        never: [],
        channels: [],
        formats: [],
        creatives: 0,
        references: [],
        missing: [],
      };
      return wait({
        campaign,
        brief,
        directions: db.directions.filter((d) => d.campaignId === id && (m.isStaff() || customerSeesDirection(d))),
        creatives: db.creatives.filter((c) => c.campaignId === id && m.visible(c)),
        runs: db.runs.filter((r) => r.campaignId === id),
        clock: db.clocks.find((k) => k.campaignId === id),
        record: db.record.filter((e) => e.campaignId === id).sort((a, b) => b.at.localeCompare(a.at)),
        approver: m.user(campaign.approverId),
        people: db.memberships.filter((x) => x.workspaceId === campaign.workspaceId).map((x) => m.user(x.userId)),
        threadId: db.threads.find((t) => t.campaignId === id)?.id ?? "t-general",
      });
    },
    // Fume reads what it can from the first line (the products, the occasion, where it runs, the date), so it only
    // asks what it cannot infer, one question at a time, then the brief card. No confirmed product named: Fume asks
    // with the product grid. An open campaign with the same occasion is offered before a second one is made. The
    // market comes from Settings.
    async startCampaign({ text, productIds }) {
      const said = text.toLowerCase();
      const brandProducts = db.products.filter((p) => p.workspaceId === m.workspaceId);
      const picked = productIds?.length
        ? brandProducts.filter((p) => productIds.includes(p.id))
        : productsNamed(said, brandProducts);
      // Only products with confirmed facts can be made; one named but not confirmed is asked about with the grid.
      const named = picked.filter(canBeMade);
      const waiting = picked.filter((p) => !canBeMade(p));
      const occasion = occasionOf(said);
      const name = campaignName(occasion, named);
      const general = db.threads.find(
        (t) => t.workspaceId === m.workspaceId && t.kind !== "contact" && t.campaignId === null,
      );
      const same = sameCampaign(m.inWorkspace(db.campaigns), occasion, name);
      if (same && general && !m.chat.startingAnyway) {
        // "You already have Black Friday, due 13 Nov. Add to it or start a new one?"
        m.post(general.id, { author: { kind: "person", userId: m.userId }, text });
        const due = same.dueAt
          ? `, due ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Europe/Oslo" }).format(Date.parse(same.dueAt))}`
          : "";
        const ask = "Add to it or start a new one?";
        m.chat.pendingStart.set(general.id, { text, productIds: named.map((p) => p.id), campaignId: same.id });
        setTimeout(
          () =>
            m.post(general.id, {
              author: { kind: "fume" },
              text: `You already have ${same.name}${due}.`,
              card: {
                kind: "question",
                question: ask,
                why: "One campaign per occasion keeps the brief, the creatives and the deliveries together.",
                options: [`Add to ${same.name}`, "Start a new one"],
              },
            }),
          m.latency * 6,
        );
        return wait({ campaign: same, threadId: general.id });
      }
      m.chat.startingAnyway = false;
      const id = m.nextId("c");
      const products = named.map((p) => p.id);
      const channels: Channel[] = [
        ...(/paid|ads?\b|annonse/.test(said) ? (["paid_social"] as const) : []),
        ...(/organic|instagram|social/.test(said) && !/paid/.test(said) ? (["organic_social"] as const) : []),
        ...(/e-?mail|newsletter|nyhetsbrev/.test(said) ? (["email"] as const) : []),
      ];
      const day = /\b(\d{1,2})\.?\s*(jan|feb|mar|apr|may|mai|jun|jul|aug|sep|oct|okt|nov|dec|des)/.exec(said);
      const dated = Boolean(day);
      const month = day
        ? ["jan", "feb", "mar", "apr", "ma", "jun", "jul", "aug", "sep", "o", "nov", "d"].findIndex((x) =>
            day[2].startsWith(x),
          )
        : -1;
      const today = new Date(m.now());
      const live =
        day && month >= 0
          ? new Date(
              Date.UTC(today.getUTCFullYear() + (month < today.getUTCMonth() ? 1 : 0), month, +day[1], 15),
            ).toISOString()
          : undefined;
      const workspace = db.workspaces.find((w) => w.id === m.workspaceId);
      const role = m.role();
      const campaign: Campaign = {
        id,
        workspaceId: m.workspaceId,
        name,
        productIds: products,
        state: "draft",
        stage: "brief",
        approverId: canApprove(role) ? m.userId : "u-maja",
        channels: channels.length ? channels : ["paid_social"],
        formats: ["feed", "story"],
        market: workspace?.market ?? "Norway",
        language: workspace?.language ?? "Norwegian",
        dueAt: live,
        createdBy: m.userId,
        createdAt: m.now(),
        updatedAt: m.now(),
        counts: { creatives: 0, inCheck: 0, checked: 0, approved: 0, delivered: 0 },
        roundsUsed: 0,
        roundsIncluded: 2,
        brandDnaVersion: db.brandDna.version,
      };
      db.campaigns.push(campaign);
      const threadId = m.nextId("t");
      // No product named: Fume asks with the grid first; the answer names the campaign and writes its objective. A
      // product she named but has not confirmed is named, with the way on; confirming it answers the question.
      const ask: BriefQuestion = {
        key: "product",
        missing: productQuestion.missing,
        text: waiting.length
          ? `${waiting.map((p) => p.name).join(" and ")} ${waiting.length === 1 ? "is" : "are"} not confirmed yet, so we cannot make ${waiting.length === 1 ? "it" : "them"}. Confirm ${waiting.length === 1 ? "its" : "their"} details now, or tick a product that is ready.`
          : productQuestion.text,
        question: productQuestion.question,
        why: productQuestion.why,
        options: [],
        productIds: [...waiting, ...brandProducts.filter((p) => !waiting.includes(p))].map((p) => p.id),
        named: waiting.map((p) => p.id),
        fill: (answer, c, brief) => {
          const answered = productsNamed(answer, brandProducts).filter(canBeMade);
          c.productIds = answered.map((p) => p.id);
          c.name = campaignName(occasion, answered);
          brief.objective = objectiveOf(occasion, answered, c.channels);
          const t = db.threads.find((x) => x.id === threadId);
          if (t) t.title = c.name;
        },
      };
      // The audience she wrote is not asked again; the dates fit the occasion; the message is asked last with Fume's
      // suggestion and the brand's last approved line as the pills.
      const heard = audienceIn(said);
      const lastMessage = m
        .inWorkspace(db.campaigns)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((c) => db.briefs.find((b) => b.campaignId === c.id && b.state === "approved" && b.message.trim()))
        .find(Boolean)?.message;
      const questions = [
        ...(products.length ? [] : [ask]),
        ...briefQuestions.filter(
          (q) => q.key !== "market" && (q.key !== "date" || !dated) && (q.key !== "audience" || !heard),
        ),
      ].map((q) =>
        q.key === "date"
          ? { ...q, ...dateOptions(occasion) }
          : q.key === "message"
            ? { ...q, ...messageOptions(occasion, lastMessage) }
            : q,
      );
      db.briefs.push({
        campaignId: id,
        version: 1,
        state: "drafting",
        objective: objectiveOf(occasion, named, campaign.channels),
        audience: heard ?? "",
        message: "",
        mandatory: [],
        never: [],
        channels: campaign.channels,
        formats: campaign.formats,
        creatives: 0,
        references: [],
        missing: questions.map((q) => q.missing),
      });
      m.chat.drafting.set(id, questions);
      db.threads.push({
        id: threadId,
        workspaceId: m.workspaceId,
        campaignId: id,
        title: campaign.name,
        updatedAt: m.now(),
        unread: 0,
      });
      m.post(threadId, { author: { kind: "person", userId: m.userId }, text });
      const first = questions[0];
      setTimeout(
        () => m.post(threadId, { author: { kind: "fume" }, text: first.text, card: questionCard(first) }),
        m.latency * 6,
      );
      return wait({ campaign, threadId });
    },
    // A line changed before approval is the same version; a change after it makes the next one.
    async changeBrief(campaignId, change) {
      const b = db.briefs.find((x) => x.campaignId === campaignId);
      if (!b) throw new FumeError("not_found", "No brief");
      Object.assign(b, change, {
        version: b.state === "approved" ? b.version + 1 : b.version,
        state: b.missing.length ? b.state : "ready",
      });
      return wait(b);
    },
    async chooseDirection(directionId, reason) {
      m.mustApprove();
      const d = m.find(db.directions, directionId, "direction");
      db.directions
        .filter((x) => x.campaignId === d.campaignId && x.id !== d.id && x.state === "proposed")
        .forEach((x) => Object.assign(x, { state: "passed", decidedBy: m.userId, decidedAt: m.now() }));
      Object.assign(d, { state: "chosen", decidedBy: m.userId, decidedAt: m.now(), reason });
      const c = m.campaignOf(d.campaignId);
      Object.assign(c, { chosenDirectionId: d.id, stage: "masters", state: "in_production" });
      m.emit({ type: "campaign.state", campaign: c });
      return wait(d);
    },
    async passDirections(campaignId, reason) {
      m.mustApprove();
      const list = db.directions.filter((d) => d.campaignId === campaignId && d.state === "proposed");
      list.forEach((d) => Object.assign(d, { state: "passed", decidedBy: m.userId, decidedAt: m.now(), reason }));
      return wait(list);
    },
    // A collection picked for a campaign brings all its products.
    async setCampaignScope(campaignId, scope) {
      const c = m.find(db.campaigns, campaignId, "campaign");
      const fromCollections = db.collections
        .filter((cl) => scope.collectionIds.includes(cl.id))
        .flatMap((cl) => cl.productIds);
      c.collectionIds = scope.collectionIds;
      c.productIds = [...new Set([...scope.productIds, ...fromCollections])];
      c.updatedAt = m.now();
      m.emit({ type: "campaign.state", campaign: c });
      return wait(c);
    },
    // The moodboard is a stage of its own and optional.
    async skipMoodboard(campaignId) {
      m.mustApprove();
      const c = db.campaigns.find((x) => x.id === campaignId);
      if (!c) throw new FumeError("not_found", `No campaign ${campaignId}`);
      c.moodboardSkipped = true;
      return wait(c);
    },
    // Fume's own templates, and hers: one for each campaign she finished or approved, made from its brief.
    async briefTemplates() {
      const yours: BriefTemplate[] = db.campaigns
        .filter(
          (c) =>
            c.workspaceId === m.workspaceId &&
            ["approved", "delivered", "closed", "in_review"].includes(c.state) &&
            !["brief", "plan"].includes(c.stage),
        )
        .flatMap((c) => {
          const b = db.briefs.find((x) => x.campaignId === c.id);
          return b
            ? [
                {
                  id: `tpl-${c.id}`,
                  kind: "yours" as const,
                  name: `Like ${c.name}`,
                  description: `Fume made it from ${c.name}: its audience, channels, formats and rules.`,
                  goal: trim(b.objective),
                  audience: trim(b.audience),
                  message: trim(b.message),
                  channels: b.channels,
                  formats: b.formats,
                  creatives: b.creatives,
                  mandatory: b.mandatory,
                  never: b.never,
                  campaignId: c.id,
                },
              ]
            : [];
        });
      return wait([...FUME_TEMPLATES, ...yours]);
    },
    // Three alternatives for the message or the whole brief, again with what she wants changed.
    async briefAlternatives({ part, goal, audience = "", message = "", productIds = [], feedback = "", round = 0 }) {
      const products = db.products.filter((p) => productIds.includes(p.id)).map((p) => p.name);
      const product = products[0] ?? "The product";
      const msgs = messages(message, product, feedback, round);
      if (part === "message") return wait(msgs.map((x) => ({ goal, audience, message: x })));
      const g = trim(goal) || `A campaign for ${product}`;
      const short = /short|kort/.test(feedback.toLowerCase());
      const briefs = [
        {
          goal: `${cap(g.replace(/^(a|an|the) /i, ""))}, told as the evening it gives`,
          audience: audience || "People who buy premium body care for themselves",
          message: msgs[0],
        },
        {
          goal: `${product} as a considered gift, in paid social`,
          audience: "People buying a considered gift for someone close",
          message: msgs[1],
        },
        {
          goal: `${product} close: its texture, its label, its light`,
          audience: audience || "People who already follow the brand",
          message: msgs[2],
        },
      ];
      return wait(short ? briefs.map((b) => ({ ...b, goal: b.goal.split(",")[0] })) : briefs);
    },

    // ── The content calendar ──
    async calendar({ from, to }) {
      return wait(
        db.calendar
          .filter((e) => e.workspaceId === m.workspaceId && (e.end ?? e.start) >= from && e.start <= to)
          .sort((a, b) => a.start.localeCompare(b.start)),
      );
    },
    async schedule({ creativeId, placementId, at }) {
      const c = m.find(db.creatives, creativeId, "creative");
      const e: CalendarEntry = {
        id: m.nextId("ce"),
        workspaceId: m.workspaceId,
        kind: "post",
        title: c.title,
        start: at,
        placementId,
        creativeId,
        campaignId: c.campaignId,
        image: c.current.image,
      };
      db.calendar.push(e);
      return wait(e);
    },
    async moveEntry(entryId, at) {
      const e = m.find(db.calendar, entryId, "calendar entry");
      const length = e.end ? Date.parse(e.end) - Date.parse(e.start) : 0;
      e.start = at;
      if (e.end) e.end = new Date(Date.parse(at) + length).toISOString();
      return wait(e);
    },
    async removeEntry(entryId) {
      db.calendar = db.calendar.filter((e) => e.id !== entryId);
      return wait(undefined);
    },
  };
}
