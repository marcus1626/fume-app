// What the Engine makes: the runs it plays on its tick, the batches started from the studio, and the Engine chat,
// where a person tells the Engine what to make (one question at a time until the run is clear) or asks what waits.
import {
  FumeError,
  type Batch,
  type Campaign,
  type EngineMessage,
  type EngineRunDraft,
  type Format,
  type FumeApi,
  type Id,
  type QaItem,
} from "../contract";
import type { Mock } from "./context";
import { qaViews } from "./quality";
import { img } from "./seed/helpers";

type Calls = "engineChat" | "engineSay" | "answerEngineWidget" | "batches" | "startBatch";

/** Renders in the demo come from this pool, so every new version looks different. */
export const POOL: Record<string, string[]> = {
  "m-free": ["05-03", "08-02", "06-04", "09-02", "04-02"],
  "m-packshot": ["03-08", "03-02", "03-05", "03-12"],
  "m-scene": ["05-06", "05-08", "04-06", "05-01", "06-05", "02-09"],
  "m-model": ["07-05", "07-02", "07-10", "07-11"],
  "m-lifestyle": ["07-05", "07-02", "07-10", "09-15"],
  "m-reference": ["02-04", "01-07", "09-13", "01-04"],
  "m-layout": ["05-01", "04-05"],
};

/** One creative of a run, by its place in the run: the same id from the chat, Check and the Studio. */
export const runCreativeId = (batchId: Id, i: number) => `${batchId}-c${i + 1}`;

/** The simulated Engine's tick (every few seconds): the expert checks the directions the Engine made on the tick
 *  after, and only then does the customer see them (the demo plays the expert and the operator, so the set is checked
 *  and released together); the running run makes one more creative, and finishes. */
export function tick(m: Mock) {
  const { db } = m;
  for (const d of db.directions.filter((x) => x.state === "in_check")) {
    d.state = "proposed";
    const c = db.campaigns.find((x) => x.id === d.campaignId);
    if (c && c.state === "in_production") c.state = "in_review";
    if (c) m.emit({ type: "campaign.state", campaign: c });
  }
  for (const run of db.runs.filter((r) => r.state === "running")) {
    if (run.made < run.total) {
      run.made += 1;
      const step = run.steps.find((s) => s.state === "active");
      if (step) step.detail = `${run.made} of ${run.total}`;
      if (run.made === run.total) {
        if (step) step.state = "done";
        const gate = run.steps.find((s) => s.state === "waiting");
        if (gate) gate.state = "active";
        run.state = "done";
        db.directions
          .filter((d) => d.campaignId === run.campaignId && d.state === "making")
          .forEach((d) => (d.state = "in_check"));
      }
      m.emit({ type: "run.progress", run });
    }
  }
}

const MODES = [
  { id: "m-packshot", name: "Packshot", re: /packshot/ },
  { id: "m-scene", name: "Product in scene", re: /in (a )?scene\b|product in scene/ },
  { id: "m-lifestyle", name: "Lifestyle with a model", re: /lifestyle|with a model/ },
];
const FORMATS: { id: Format; name: string; re: RegExp }[] = [
  { id: "feed", name: "Instagram feed 4:5", re: /\bfeed\b|4:5/ },
  { id: "story", name: "Story 9:16", re: /\bstor(y|ies)\b|9:16/ },
  { id: "square", name: "Square 1:1", re: /\bsquare\b|1:1/ },
];
const PRODUCT_PAGE = "No campaign · product page";
const PRODUCT_PAGE_FORMAT = "Product page 1:1";
const productPageWords = /no campaign|product page|produktside|nettbutikk|web ?shop/;

/** What a person has told the Engine about the next run. */
interface Draft {
  productIds?: Id[];
  modeId?: string;
  perProduct?: number;
  /** A campaign's name, or PRODUCT_PAGE. */
  campaign?: string;
  format?: Format;
  /** A campaign she named whose plan is not approved yet. */
  refused?: string;
}

const isWorkOrder = (text: string) =>
  /\b(make|take|render|create|shoot|produce|lag|ta)\b|packshots?|catalog|katalog|products|produkt|collection|kolleksjon|gift/.test(
    text.toLowerCase(),
  );
const isQuestion = (text: string) => {
  const t = text.toLowerCase().trim();
  return /\?$/.test(t) || /^(what|which|where|when|who|how|is|are|do|does|has|have|can|show|list)\b/.test(t);
};
const aboutCheck = (text: string) => /wait|due|check|queue|left|landed|status|where/.test(text.toLowerCase());

/** The draft in the words the chat's panel shows. */
function draftWords(d: Draft): EngineRunDraft {
  return {
    productIds: d.productIds,
    mode: MODES.find((x) => x.id === d.modeId)?.name,
    perProduct: d.perProduct,
    campaign: d.campaign,
    format: d.campaign === PRODUCT_PAGE ? PRODUCT_PAGE_FORMAT : FORMATS.find((f) => f.id === d.format)?.name,
  };
}

export function productionCalls(m: Mock): Pick<FumeApi, Calls> {
  const { db, wait } = m;
  const now = () => m.now();
  const later = (fn: () => void, ticks = 12) => setTimeout(fn, m.latency * ticks);

  function engineSays(workspaceId: Id, text: string, widget?: EngineMessage["widget"]) {
    const msg: EngineMessage = {
      id: m.nextId("em"),
      workspaceId,
      author: { kind: "engine" },
      text,
      at: now(),
      ...(widget ? { widget } : {}),
    };
    db.engineMessages.push(msg);
    m.emit({ type: "engine.message", message: structuredClone(msg) });
    return msg;
  }

  const brandName = (workspaceId: Id) => db.workspaces.find((w) => w.id === workspaceId)?.brandName ?? "The brand";
  const customerName = (workspaceId: Id) => {
    const owner = db.memberships.find((x) => x.workspaceId === workspaceId && x.role === "owner");
    return db.users.find((u) => u.id === owner?.userId)?.name.split(" ")[0] ?? "the customer";
  };
  /** A campaign the Engine may make for: open, and its plan approved (FLOWS §22: nothing is made before). */
  const brandCampaigns = (workspaceId: Id) =>
    db.campaigns.filter((c) => c.workspaceId === workspaceId && !["closed", "delivered", "draft"].includes(c.state));
  const planApproved = (c: Campaign) => !["brief", "plan"].includes(c.stage);

  /** In a client an agency runs, the Engine says the agency's own check ("for your check"), never "for the expert":
   *  no Fume expert checks an agency's work (FLOWS §24.1). */
  const agencyWords = (msg: EngineMessage): EngineMessage => {
    const seat = db.users.find((u) => u.id === m.userId)?.agency;
    if (!seat || !db.workspaces.find((w) => w.id === msg.workspaceId)?.agencyId) return msg;
    const text = msg.text
      .replace(
        /Each lands in Check as it is made, for the expert\./g,
        "Each lands in Check as it is made, for your check.",
      )
      .replace(/, for the expert\b/g, ", for your check")
      .replace(/wait for their plans to be approved/g, "wait for your check of their plans")
      .replace(/waits for its plan to be approved/g, "waits for your check of its plan");
    return text === msg.text ? msg : { ...msg, text };
  };

  /** What a person's words say about the run: "4 per product", "for Autumn launch", "in Product in scene", "feed". */
  function readWords(workspaceId: Id, text: string): Partial<Draft> {
    const t = text.toLowerCase();
    const out: Partial<Draft> = {};
    const mode = MODES.find((x) => x.re.test(t));
    if (mode) out.modeId = mode.id;
    const count = /(\d+)\s*(per product|each|of each|a product)/.exec(t) ?? /^count:\s*(\d+)/.exec(t);
    if (count) out.perProduct = Number(count[1]);
    if (productPageWords.test(t)) out.campaign = PRODUCT_PAGE;
    else {
      const named = brandCampaigns(workspaceId).find((c) => t.includes(c.name.toLowerCase()));
      if (named) {
        if (planApproved(named)) out.campaign = named.name;
        else out.refused = named.name;
      }
    }
    const format = FORMATS.find((f) => f.re.test(t));
    if (format) out.format = format.id;
    // A product she names by name is the one she means, when its facts are confirmed ("4 packshots of Night Body Oil").
    const named = db.products.filter(
      (p) => p.workspaceId === workspaceId && p.state !== "needs_you" && t.includes(p.name.toLowerCase()),
    );
    if (named.length) {
      out.productIds = named.map((p) => p.id);
      const many = /\b(\d+)\s+(packshots?|creatives?|pictures?|images?|versions?)\b/.exec(t);
      if (many && named.length === 1 && !out.perProduct) out.perProduct = Number(many[1]);
    }
    return out;
  }

  /** Everything said since the last run, in order: her words and her answers; a later one wins. The draft rides on
   *  the Engine's messages, so the chat's "The run" panel shows what it has been told. */
  function draftOf(workspaceId: Id): Draft & { words: string; ordered: boolean } {
    const list = db.engineMessages
      .filter((x) => x.workspaceId === workspaceId)
      .sort((a, b) => a.at.localeCompare(b.at));
    const lastRun = list.map((x) => x.widget?.kind).lastIndexOf("batch");
    const recent = list.slice(lastRun + 1);
    const d: Draft = {};
    let ordered = false;
    for (const msg of recent) {
      if (msg.author.kind === "person") {
        const read = readWords(workspaceId, msg.text);
        if (isWorkOrder(msg.text)) ordered = true;
        Object.assign(d, read);
        if (read.campaign) d.refused = read.refused;
      } else if (msg.widget?.kind === "products" && msg.widget.picked?.length) d.productIds = msg.widget.picked;
      else if (msg.widget?.kind === "choice" && msg.widget.answer) {
        const a = msg.widget.answer;
        const q = msg.widget.question;
        if (/mode/i.test(q)) d.modeId = (MODES.find((x) => x.name === a) ?? MODES[0]).id;
        else if (/how many/i.test(q)) d.perProduct = Number(a) || 4;
        else if (/campaign/i.test(q)) {
          d.campaign = a;
          d.refused = undefined;
        } else if (/format/i.test(q)) d.format = (FORMATS.find((f) => f.name === a) ?? FORMATS[0]).id;
      }
    }
    if (d.productIds) ordered = true;
    return {
      ...d,
      words: recent
        .filter((x) => x.author.kind === "person")
        .map((x) => x.text.toLowerCase())
        .join(" "),
      ordered,
    };
  }

  /** The Engine offers products to tick: a collection named in the words, else the whole catalogue. Products whose
   *  facts the customer has not confirmed come along locked. */
  function offerProducts(workspaceId: Id, words: string) {
    const all = db.products.filter((p) => p.workspaceId === workspaceId);
    const collection = db.collections.find(
      (c) =>
        c.workspaceId === workspaceId &&
        (words.includes(c.name.toLowerCase()) || (/gift/.test(words) && c.id === "cl-gifts")),
    );
    const offered = collection ? all.filter((p) => collection.productIds.includes(p.id)) : all;
    const locked = offered.filter((p) => p.state !== "verified").length;
    const where = collection
      ? `The ${collection.name} collection holds ${offered.length} products`
      : `${brandName(workspaceId)}'s catalogue has ${offered.length} products`;
    const msg = engineSays(
      workspaceId,
      `${where}. ${locked ? `${locked} wait for ${customerName(workspaceId)} to confirm their facts, so they are locked. ` : ""}Tick the ones to make for.`,
      { kind: "products", productIds: offered.map((p) => p.id) },
    );
    msg.run = { ...draftWords(draftOf(workspaceId)), asking: "products" };
  }

  /** One question at a time until the run is clear, then the run. The count per product and the campaign are always
   *  asked; the mode only when her words don't name it; only campaigns whose plan is approved are offered. */
  function askNext(workspaceId: Id) {
    const s = draftOf(workspaceId);
    const ask = (asking: EngineRunDraft["asking"], text: string, question: string, options: string[]) => {
      const msg = engineSays(workspaceId, text, { kind: "choice", question, options });
      msg.run = { ...draftWords(s), asking };
      return msg;
    };
    if (!s.productIds) return offerProducts(workspaceId, s.words);
    if (!s.modeId)
      return ask("mode", "Which mode should they be made in?", "Which mode?", [
        ...MODES.map((x) => x.name),
        "Engine decides",
      ]);
    if (!s.perProduct)
      return ask(
        "count",
        `${s.productIds.length === 1 ? "One product" : `${s.productIds.length} products`}. How many per product?`,
        "How many per product?",
        ["2", "4", "6"],
      );
    const all = brandCampaigns(workspaceId);
    const ready = all.filter(planApproved);
    const waiting = all.filter((c) => !planApproved(c)).map((c) => c.name);
    const campaign = ready.find((c) => c.name === s.campaign);
    if (!s.campaign || (s.campaign !== PRODUCT_PAGE && !campaign)) {
      const why = s.refused
        ? `${s.refused}’s plan isn’t approved yet, so nothing is made for it. `
        : waiting.length
          ? `${waiting.join(" and ")} ${waiting.length === 1 ? "waits for its plan" : "wait for their plans"} to be approved. `
          : "";
      return ask("campaign", `${why}For which campaign?`, "For which campaign?", [
        PRODUCT_PAGE,
        ...ready.slice(0, 3).map((c) => c.name),
      ]);
    }
    if (!s.format && s.campaign !== PRODUCT_PAGE)
      return ask("format", "Which format?", "Which format?", [...FORMATS.map((f) => f.name), "Engine decides"]);
    const format: Format = s.campaign === PRODUCT_PAGE ? "square" : (s.format ?? "feed");
    const modeId = s.modeId === "engine" ? "m-packshot" : s.modeId;
    const perProduct = s.perProduct;
    const productIds = s.productIds;
    const final = { ...draftWords({ ...s, format }) };
    later(async () => {
      const batch = await startBatch({ campaignId: campaign?.id ?? "", modeId, productIds, perProduct, format });
      const mode = db.modes.find((x) => x.id === modeId);
      const what = modeId === "m-packshot" ? `${batch.total} packshots` : `${batch.total} creatives`;
      const shape = format === "square" ? "1:1" : format === "feed" ? "4:5 for the feed" : "9:16 for stories";
      // Every creative is checked: a product-page run lands in Check too, once Check holds creatives with no campaign.
      const inCheck = Boolean(campaign) || (await checkHoldsProductPage(workspaceId));
      const where = inCheck
        ? `Each lands in Check as it is made, for the expert. Open any of them in the Studio for more control.`
        : `Open any of them in the Studio for more control.`;
      const msg = engineSays(
        workspaceId,
        `Making ${what} for ${campaign ? campaign.name : "the product page"} in ${mode?.name ?? "Packshot"} mode, ${shape}: ${productIds.length} × ${perProduct}. ${where}`,
        { kind: "batch", batchId: batch.id },
      );
      msg.run = final;
      if (inCheck) land(batch.id, campaign);
    }, 3);
  }

  /** Whether Check shows a creative with no campaign ("Product page"): a probe item goes in and out of the table in
   *  the same tick, so nothing else sees it, and Check's queue is asked whether it shows it. Only Fume's people read
   *  the queue, so for anyone else the answer is no. */
  async function checkHoldsProductPage(workspaceId: Id): Promise<boolean> {
    const qa = db.qaItems;
    const probe = {
      id: "qa-probe",
      workspaceId,
      campaignId: "",
      creativeId: "probe",
      title: "",
      slot: "",
      studio: "render",
      image: "",
      format: "square",
      madeAt: now(),
      dueAt: now(),
      risk: "normal",
      state: "waiting",
      evaluation: { productTruth: "pass", brandRules: "pass", artefacts: "none", notes: [] },
      feedback: [],
    } satisfies QaItem;
    qa.push(probe);
    let asked: Promise<unknown>;
    try {
      m.mustStaff();
      asked = wait(qaViews(m, workspaceId));
    } catch {
      asked = Promise.reject();
    } finally {
      qa.splice(qa.indexOf(probe), 1);
    }
    return asked.then(
      (views) => Array.isArray(views) && views.some((v) => (v as { item?: { id?: string } }).item?.id === probe.id),
      () => false,
    );
  }

  /** The run's creatives land in Check one by one, a little after each is made ("Landing in Check · 2 of 4"). A new
   *  run's creatives count on from the brand's earlier ones ("Square 5", not a second "Square 1"). */
  function land(batchId: Id, campaign?: Campaign) {
    const qa = db.qaItems;
    const timer = setInterval(() => {
      const b = db.batches.find((x) => x.id === batchId);
      if (!b) return clearInterval(timer);
      const landed = qa.filter((i) => i.runId === b.id).length;
      if (landed < b.made && b.previews.length) {
        const product = db.products.find((p) => p.id === b.productIds[Math.floor(landed / b.perProduct)]);
        const label = b.format === "square" ? "Square" : b.format === "story" ? "Story" : "Feed";
        const base = `${product?.name ?? "Packshot"} · ${label}`;
        const numberOf = (title: string) => (title.startsWith(`${base} `) ? Number(title.slice(base.length + 1)) : NaN);
        const earlier = qa
          .filter((x) => x.workspaceId === b.workspaceId && x.runId !== b.id)
          .map((x) => numberOf(x.title))
          .filter(Number.isFinite);
        const n =
          Math.max(0, ...earlier) + qa.filter((x) => x.runId === b.id && Number.isFinite(numberOf(x.title))).length + 1;
        const item: QaItem = {
          id: m.nextId("qa"),
          workspaceId: b.workspaceId,
          campaignId: campaign?.id ?? "",
          creativeId: runCreativeId(b.id, landed),
          runId: b.id,
          title: `${base} ${n}`,
          slot: `${base} ${n}`,
          studio: "render",
          image: b.previews[landed % b.previews.length],
          format: b.format,
          madeAt: now(),
          dueAt: campaign?.dueAt ?? new Date(Date.parse(now()) + 86_400_000).toISOString(),
          risk: "normal",
          state: "waiting",
          evaluation: { productTruth: "pass", brandRules: "pass", artefacts: "none", notes: [] },
          feedback: [],
        };
        qa.push(item);
        m.emit({ type: "qa.state", item: structuredClone(item) });
      } else if (b.state === "done" && landed >= b.total) clearInterval(timer);
    }, m.latency * 10);
  }

  // A batch for the product page has no campaign; its brand is its products' brand.
  const startBatch: FumeApi["startBatch"] = async (input) => {
    m.mustStaff();
    const campaign = input.campaignId ? m.find(db.campaigns, input.campaignId, "campaign") : undefined;
    const workspaceId =
      campaign?.workspaceId ?? db.products.find((p) => p.id === input.productIds[0])?.workspaceId ?? "";
    const total = input.productIds.length * input.perProduct;
    const b: Batch = {
      id: m.nextId("bt"),
      workspaceId,
      ...input,
      state: "running",
      made: 0,
      total,
      previews: [],
      by: m.me().id,
      at: now(),
    };
    db.batches.push(b);
    const pool = POOL[input.modeId] ?? POOL["m-packshot"];
    const timer = setInterval(() => {
      b.made = Math.min(total, b.made + Math.max(1, Math.ceil(total / 8)));
      b.previews = Array.from({ length: Math.min(8, b.made) }, (_, i) => img(pool[i % pool.length], input.format));
      if (b.made >= total) {
        b.state = "done";
        clearInterval(timer);
      }
      m.emit({ type: "batch.progress", batch: structuredClone(b) });
    }, m.latency * 8);
    return wait(b);
  };

  return {
    async batches(campaignId) {
      m.mustStaff();
      return wait(
        db.batches.filter((b) => !campaignId || b.campaignId === campaignId).sort((a, b) => b.at.localeCompare(a.at)),
      );
    },
    startBatch,

    async engineChat(workspaceId) {
      m.mustStaff();
      return wait(
        db.engineMessages
          .filter((x) => x.workspaceId === workspaceId)
          .sort((a, b) => a.at.localeCompare(b.at))
          .map(agencyWords),
      );
    },
    async engineSay(workspaceId, text) {
      m.mustStaff();
      const msg: EngineMessage = {
        id: m.nextId("em"),
        workspaceId,
        author: { kind: "person", userId: m.me().id },
        text,
        at: now(),
      };
      db.engineMessages.push(msg);
      const t = text.toLowerCase();
      later(() => {
        // A question about the work gets an answer, never a run.
        if (isQuestion(t) && aboutCheck(t) && !/\b(make|render|create)\b/.test(t)) {
          const qa = db.qaItems.filter(
            (i) => i.workspaceId === workspaceId && (i.state === "waiting" || i.state === "fixing"),
          );
          const order = [...qa].sort((a, b) => a.dueAt.localeCompare(b.dueAt));
          const brand = brandName(workspaceId);
          if (!order.length) return engineSays(workspaceId, `Nothing from ${brand} waits for a check.`);
          const first = order[0];
          const campaign = db.campaigns.find((c) => c.id === first.campaignId);
          // The creative's one name, as Check shows it: its product before "Feed 6" when the title leaves it out.
          const only =
            campaign?.productIds.length === 1
              ? db.products.find((p) => p.id === campaign.productIds[0])?.name
              : undefined;
          const firstName = first.title.includes(" · ") || !only ? first.title : `${only} · ${first.title}`;
          const fixing = order.filter((i) => i.state === "fixing").length;
          const a = engineSays(
            workspaceId,
            `${order.length === 1 ? "One creative" : `${order.length} creatives`} from ${brand} ${order.length === 1 ? "is" : "are"} in Check${fixing ? `, ${fixing} of them with the Engine for a fix` : ""}. Due first: ${firstName}${campaign ? ` for ${campaign.name}` : ", for the product page"}.`,
          );
          a.answer = { kind: "check", itemIds: order.map((i) => i.id) };
          return;
        }
        // A change to the run from the chat's panel ("Mode: Product in scene"): taken, and the open question stays.
        const change = /^(mode|count|campaign|format):/.exec(t);
        if (change) {
          const open = db.engineMessages
            .filter((x) => x.workspaceId === workspaceId && x.author.kind === "engine")
            .at(-1);
          const waits =
            open?.widget &&
            ((open.widget.kind === "choice" && !open.widget.answer) ||
              (open.widget.kind === "products" && !open.widget.picked));
          const d = draftOf(workspaceId);
          const said = draftWords(d);
          const line =
            change[1] === "mode"
              ? said.mode
              : change[1] === "count"
                ? d.perProduct
                  ? `${d.perProduct} per product`
                  : undefined
                : change[1] === "campaign"
                  ? said.campaign
                  : said.format;
          if (d.refused) return askNext(workspaceId);
          const ok = engineSays(workspaceId, line ? `${line}, then.` : "I didn’t read that. Pick from the list.");
          ok.run = { ...said, asking: open?.run?.asking };
          if (!waits) later(() => askNext(workspaceId), 3);
          return;
        }
        if (/(open|studio)/.test(t) && !isWorkOrder(t)) {
          const d = db.documents
            .filter((x) => x.workspaceId === workspaceId)
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
          if (d) return engineSays(workspaceId, `Opening ${d.title}.`, { kind: "document", documentId: d.id });
        }
        if (isWorkOrder(t) || draftOf(workspaceId).ordered) return askNext(workspaceId);
        engineSays(
          workspaceId,
          `I make creatives for ${brandName(workspaceId)}. Tell me what to make, for example “4 packshots of the gift sets for the product page”, or ask what waits for a check.`,
        );
      }, 6);
      return wait(msg).then(agencyWords);
    },
    async answerEngineWidget(workspaceId, messageId, answer) {
      m.mustStaff();
      const msg = m.find(db.engineMessages, messageId, "message");
      if (!msg.widget) throw new FumeError("invalid", "Nothing to answer");
      if (msg.widget.kind === "products") {
        // Only products with confirmed facts are made (FLOWS: verify before production); the card locks the rest.
        const ids = (answer.picked ?? []).filter((id) => db.products.find((p) => p.id === id)?.state === "verified");
        if (!ids.length) throw new FumeError("invalid", "Pick a product whose facts are confirmed.");
        msg.widget.picked = ids;
      } else if (msg.widget.kind === "choice") msg.widget.answer = answer.choice;
      // An answer changed further up while a later question is still open: the open question stays (no second ask).
      const after = db.engineMessages.filter(
        (x) => x.workspaceId === workspaceId && x.author.kind === "engine" && x.at > msg.at,
      );
      const stillOpen = after.some(
        (x) =>
          x.widget &&
          ((x.widget.kind === "choice" && !x.widget.answer) || (x.widget.kind === "products" && !x.widget.picked)),
      );
      if (stillOpen) {
        const last = after.at(-1)!;
        last.run = { ...draftWords(draftOf(workspaceId)), asking: last.run?.asking };
        m.emit({ type: "engine.message", message: structuredClone(last) });
      } else later(() => askNext(workspaceId), 5);
      return wait(msg);
    },
  };
}
