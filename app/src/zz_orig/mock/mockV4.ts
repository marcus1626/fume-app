// The mock backend's v4 calls (FLOWS.md §15–§21, PROPOSED 15 Oct 2026): placements and Make formats, product fix
// with detail tokens, light and camera presets, the Engine chat, usage, meetings and the content calendar; Fume
// hands over to a person and offers meeting times inside the one conversation. createMockApi mixes these in.

import {
  FumeError,
  type CalendarEntry,
  type Campaign,
  type CreativeDocument,
  type Creative,
  type EngineMessage,
  type EngineRunDraft,
  type Format,
  type FormatTile,
  type FumeApi,
  type FumeEvent,
  type Id,
  type Meeting,
  type Message,
  type Product,
  type QaItem,
  type RenderVersion,
  type User,
} from "../contract";
import { img } from "./seed";
import * as seed4 from "./seed4";

/** The v4 tables, merged into the mock's in-memory db. */
export function v4Db() {
  return structuredClone({
    placements: seed4.placements,
    detailTokens: seed4.detailTokens,
    cameras: seed4.cameras,
    lights: seed4.lights,
    engineMessages: seed4.engineMessages,
    usage: seed4.usage,
    meetings: seed4.meetings,
    calendar: seed4.calendar,
  });
}

type Db = ReturnType<typeof v4Db> & {
  documents: CreativeDocument[];
  campaigns: Campaign[];
  creatives: Creative[];
  products: Product[];
  messages: Message[];
  threads: import("../contract").Thread[];
  batches: import("../contract").Batch[];
  modes: import("../contract").StudioMode[];
  collections?: import("../contract").Collection[];
  workspaces?: import("../contract").Workspace[];
  memberships?: import("../contract").Membership[];
  users?: User[];
};

/** Adds v4 fields to the v3 rows: what the Engine read on each render, its fixes, look sources, and the handover. */
export function upgradeV3(db: Db) {
  for (const d of db.documents) {
    for (const v of d.versions) {
      const finds = seed4.detailFinds[v.id];
      if (finds && d.id === "doc-autumn-m3") v.details = structuredClone(finds);
    }
    d.fixes = structuredClone(seed4.fixes[d.id] ?? []);
    d.sources = d.sources ?? { Light: "brand", Camera: "brand" };
    if (d.studio === "render" && d.specs.format === "feed") d.specs.placementId = "pl-ig-feed";
  }
  db.messages.push(...structuredClone(seed4.handover));
  // Round 12 DESK (DTASK-5): a run the Engine chat made has its creatives in Check, each naming the run, whether it
  // was for a campaign or the product page ("Product page" in Check). The seeded run from this morning is there too.
  const qa = (db as unknown as { qaItems?: QaItem[] }).qaItems;
  for (const b of db.batches) {
    if (!qa || !db.engineMessages.some((m) => m.widget?.kind === "batch" && m.widget.batchId === b.id)) continue;
    const campaign = db.campaigns.find((c) => c.id === b.campaignId);
    for (let i = 0; i < b.made; i++) {
      if (qa.some((x) => x.runId === b.id && x.creativeId === `${b.id}-c${i + 1}`)) continue;
      const product = db.products.find((p) => p.id === b.productIds[Math.floor(i / b.perProduct)]);
      const label = b.format === "square" ? "Square" : b.format === "story" ? "Story" : "Feed";
      const title = `${product?.name ?? "Packshot"} · ${label} ${i + 1}`;
      const madeAt = new Date(Date.parse(b.at) + (i + 1) * 60_000).toISOString();
      qa.push({
        id: `qa-${b.id}-${i + 1}`,
        workspaceId: b.workspaceId,
        campaignId: campaign?.id ?? "",
        creativeId: `${b.id}-c${i + 1}`,
        runId: b.id,
        title,
        slot: title,
        studio: "render",
        image: b.previews[i % Math.max(1, b.previews.length)],
        format: b.format,
        madeAt,
        dueAt: campaign?.dueAt ?? new Date(Date.parse(b.at) + 2 * 86_400_000).toISOString(),
        risk: "normal",
        state: "waiting",
        evaluation: { productTruth: "pass", brandRules: "pass", artefacts: "none", notes: [] },
        feedback: [],
      });
    }
  }
}

export interface V4Context {
  db: Db;
  wait: <T>(value: T) => Promise<T>;
  now: () => string;
  nextId: (prefix: string) => string;
  emit: (event: FumeEvent) => void;
  me: () => User;
  workspaceId: () => Id;
  mustStaff: () => void;
  latency: number;
  /** v3's say, for everything Fume answers itself. */
  say: FumeApi["say"];
  startBatch: FumeApi["startBatch"];
  /** v3's openDocument, for everything but a creative of an Engine chat run (round 12 DESK). */
  openDocument?: FumeApi["openDocument"];
  /** v3's qaQueue: the Engine chat asks it whether Check holds a creative with no campaign (the product page). */
  qaQueue?: FumeApi["qaQueue"];
}

type V4Keys =
  | "placements"
  | "makeFormats"
  | "setFormatTile"
  | "detailTokens"
  | "fixProduct"
  | "lookPresets"
  | "setSource"
  | "engineChat"
  | "engineSay"
  | "answerEngineWidget"
  | "usage"
  | "meetingSlots"
  | "bookMeeting"
  | "meetings"
  | "calendar"
  | "schedule"
  | "moveEntry"
  | "removeEntry"
  | "say"
  | "openDocument";

const ratioOf = (r: string) => {
  const [w, h] = r.split(":").map(Number);
  return w / h;
};

export function v4Api(ctx: V4Context): Pick<FumeApi, V4Keys> {
  const { db, wait, now, nextId, emit } = ctx;
  const find = <T extends { id: Id }>(list: T[], id: Id, what: string): T => {
    const found = list.find((x) => x.id === id);
    if (!found) throw new FumeError("not_found", `No ${what} ${id}`);
    return found;
  };
  const doc = (id: Id) => find(db.documents, id, "creative document");
  const touch = (d: CreativeDocument) => {
    d.updatedAt = now();
    emit({ type: "document.state", document: structuredClone(d) });
  };
  const picked = (d: CreativeDocument) => d.versions.find((v) => v.id === d.pickedVersionId) ?? d.versions.at(-1);
  const later = (fn: () => void, ticks = 12) => setTimeout(fn, ctx.latency * ticks);

  /** Fume's own lines in the one conversation. */
  function fumeSays(text: string, card?: Message["card"], author: Message["author"] = { kind: "fume" }) {
    const general = db.threads.find(
      (t) => t.workspaceId === ctx.workspaceId() && t.kind !== "contact" && t.campaignId === null,
    )!;
    const m: Message = { id: nextId("msg"), threadId: general.id, author, text, at: now(), ...(card ? { card } : {}) };
    db.messages.push(m);
    emit({ type: "message.new", message: structuredClone(m) });
    return m;
  }

  function engineSays(workspaceId: Id, text: string, widget?: EngineMessage["widget"]) {
    const m: EngineMessage = {
      id: nextId("em"),
      workspaceId,
      author: { kind: "engine" },
      text,
      at: now(),
      ...(widget ? { widget } : {}),
    };
    db.engineMessages.push(m);
    emit({ type: "engine.message", message: structuredClone(m) });
    return m;
  }

  function slots(): string[] {
    const base = new Date(now());
    const out: string[] = [];
    for (let d = 1; out.length < 6; d++) {
      const day = new Date(base.getTime() + d * 86_400_000);
      if (day.getUTCDay() === 0 || day.getUTCDay() === 6) continue;
      for (const h of [8, 12]) {
        day.setUTCHours(h, 0, 0, 0);
        const iso = day.toISOString();
        // A time already booked is not offered again (walk-through Must 7).
        if (!db.meetings.some((m) => m.state === "booked" && m.at === iso)) out.push(iso);
      }
    }
    return out;
  }

  /** The Engine offers products to tick: a collection named in the words, else the whole catalogue. Products whose
   *  facts the customer has not confirmed come along locked (walk-through Must 9). */
  function offerProducts(workspaceId: Id, words: string) {
    const all = db.products.filter((p) => p.workspaceId === workspaceId);
    const collection = db.collections?.find(
      (c) =>
        c.workspaceId === workspaceId &&
        (words.includes(c.name.toLowerCase()) || (/gift/.test(words) && c.id === "cl-gifts")),
    );
    const offered = collection ? all.filter((p) => collection.productIds.includes(p.id)) : all;
    const locked = offered.filter((p) => p.state !== "verified").length;
    const where = collection
      ? `The ${collection.name} collection holds ${offered.length} products`
      : `${brandName(workspaceId)}'s catalogue has ${offered.length} products`;
    const m = engineSays(
      workspaceId,
      `${where}. ${locked ? `${locked} wait for ${customerName(workspaceId)} to confirm their facts, so they are locked. ` : ""}Tick the ones to make for.`,
      { kind: "products", productIds: offered.map((p) => p.id) },
    );
    m.run = { ...draftWords(draftOf(workspaceId)), asking: "products" };
  }
  const brandName = (workspaceId: Id) => db.workspaces?.find((w) => w.id === workspaceId)?.brandName ?? "The brand";
  const customerName = (workspaceId: Id) => {
    const owner = db.memberships?.find((x) => x.workspaceId === workspaceId && x.role === "owner");
    return db.users?.find((u) => u.id === owner?.userId)?.name.split(" ")[0] ?? "the customer";
  };

  // ── Round 12 DESK (UX review DTASK-5, DLAY-13; PROPOSED 20 Oct 2026) ──
  // The Engine reads a question as a question (what waits, what is due: an answer with the items in Check), asks for a
  // mode only after a work order, keeps what it has been told for the next run on its messages (the chat's "The run"
  // panel), offers only campaigns whose plan is approved (nothing is made before), and a campaign run lands its
  // creatives in Check one by one, each naming the run.
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
  /** A campaign the Engine may make for: open, and its plan approved (FLOWS §22: nothing is made before). */
  const brandCampaigns = (workspaceId: Id) =>
    db.campaigns.filter((c) => c.workspaceId === workspaceId && !["closed", "delivered", "draft"].includes(c.state));
  const planApproved = (c: Campaign) => !["brief", "plan"].includes(c.stage);

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
  /** What a person's words say about the run: "4 per product", "for Autumn launch", "in Product in scene", "feed". */
  function readWords(workspaceId: Id, text: string): Partial<Draft> {
    const t = text.toLowerCase();
    const out: Partial<Draft> = {};
    const mode = MODES.find((m) => m.re.test(t));
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
  /** Everything said since the last run, in order: her words and her answers; a later one wins. */
  function draftOf(workspaceId: Id): Draft & { words: string; ordered: boolean } {
    const list = db.engineMessages
      .filter((x) => x.workspaceId === workspaceId)
      .sort((a, b) => a.at.localeCompare(b.at));
    const lastRun = list.map((x) => x.widget?.kind).lastIndexOf("batch");
    const recent = list.slice(lastRun + 1);
    const d: Draft = {};
    let ordered = false;
    for (const m of recent) {
      if (m.author.kind === "person") {
        const read = readWords(workspaceId, m.text);
        if (isWorkOrder(m.text)) ordered = true;
        Object.assign(d, read);
        if (read.campaign) d.refused = read.refused;
      } else if (m.widget?.kind === "products" && m.widget.picked?.length) d.productIds = m.widget.picked;
      else if (m.widget?.kind === "choice" && m.widget.answer) {
        const a = m.widget.answer;
        const q = m.widget.question;
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
  /** The draft in the words the chat's panel shows. */
  function draftWords(d: Draft): EngineRunDraft {
    return {
      productIds: d.productIds,
      mode: MODES.find((m) => m.id === d.modeId)?.name,
      perProduct: d.perProduct,
      campaign: d.campaign,
      format: d.campaign === PRODUCT_PAGE ? PRODUCT_PAGE_FORMAT : FORMATS.find((f) => f.id === d.format)?.name,
    };
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

  /** One question at a time until the run is clear, then the run (walk-through Must 9: count per product and the
   *  campaign are always asked; the mode only when her words don't name it). */
  function askNext(workspaceId: Id) {
    const s = draftOf(workspaceId);
    const ask = (asking: EngineRunDraft["asking"], text: string, question: string, options: string[]) => {
      const m = engineSays(workspaceId, text, { kind: "choice", question, options });
      m.run = { ...draftWords(s), asking };
      return m;
    };
    if (!s.productIds) return offerProducts(workspaceId, s.words);
    if (!s.modeId)
      return ask("mode", "Which mode should they be made in?", "Which mode?", [
        ...MODES.map((m) => m.name),
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
      const batch = await ctx.startBatch({ campaignId: campaign?.id ?? "", modeId, productIds, perProduct, format });
      const mode = db.modes.find((x) => x.id === modeId);
      const what = modeId === "m-packshot" ? `${batch.total} packshots` : `${batch.total} creatives`;
      const shape = format === "square" ? "1:1" : format === "feed" ? "4:5 for the feed" : "9:16 for stories";
      // Every creative is checked: a product-page run lands in Check too, once Check holds creatives with no campaign.
      const inCheck = Boolean(campaign) || (await checkHoldsProductPage(workspaceId));
      const where = inCheck
        ? `Each lands in Check as it is made, for the expert. Open any of them in the Studio for more control.`
        : `Open any of them in the Studio for more control.`;
      const m = engineSays(
        workspaceId,
        `Making ${what} for ${campaign ? campaign.name : "the product page"} in ${mode?.name ?? "Packshot"} mode, ${shape}: ${productIds.length} × ${perProduct}. ${where}`,
        { kind: "batch", batchId: batch.id },
      );
      m.run = final;
      if (inCheck) land(batch.id, campaign);
    }, 3);
  }

  /** Whether Check can show a creative with no campaign (QA's qaView, "Product page"): a probe item goes in and out
   *  of the table in the same tick, so nothing else sees it; until Check holds one, product-page runs stay out of it
   *  and their card says so. */
  async function checkHoldsProductPage(workspaceId: Id): Promise<boolean> {
    const qa = (db as unknown as { qaItems?: QaItem[] }).qaItems;
    if (!qa || !ctx.qaQueue) return false;
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
      asked = ctx.qaQueue(workspaceId);
    } catch {
      asked = Promise.reject();
    } finally {
      qa.splice(qa.indexOf(probe), 1);
    }
    // True only when the probe was read and shown: a queue that reads the table later can't answer for it.
    return asked.then(
      (views) => Array.isArray(views) && views.some((v) => (v as { item?: { id?: string } }).item?.id === probe.id),
      () => false,
    );
  }

  /** The run's creatives land in Check one by one, a little after each is made ("Landing in Check · 2 of 4"). */
  function land(batchId: Id, campaign?: Campaign) {
    const qa = (db as unknown as { qaItems?: QaItem[] }).qaItems;
    if (!qa) return;
    const timer = setInterval(() => {
      const b = db.batches.find((x) => x.id === batchId);
      if (!b) return clearInterval(timer);
      const landed = qa.filter((i) => i.runId === b.id).length;
      if (landed < b.made && b.previews.length) {
        const product = db.products.find((p) => p.id === b.productIds[Math.floor(landed / b.perProduct)]);
        const label = b.format === "square" ? "Square" : b.format === "story" ? "Story" : "Feed";
        // r13 (robot note 07): a new run's creatives count on from the brand's earlier ones ("Square 5", not a second "Square 1").
        const base = `${product?.name ?? "Packshot"} · ${label}`;
        const numberOf = (title: string) => (title.startsWith(`${base} `) ? Number(title.slice(base.length + 1)) : NaN);
        const earlier = qa
          .filter((x) => x.workspaceId === b.workspaceId && x.runId !== b.id)
          .map((x) => numberOf(x.title))
          .filter(Number.isFinite);
        const n =
          Math.max(0, ...earlier) + qa.filter((x) => x.runId === b.id && Number.isFinite(numberOf(x.title))).length + 1;
        const item: QaItem = {
          id: nextId("qa"),
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
        emit({ type: "qa.state", item: structuredClone(item) });
      } else if (b.state === "done" && landed >= b.total) clearInterval(timer);
    }, ctx.latency * 10);
  }
  /** One creative of a run, by its place in the run: the same id from the chat, Check and the Studio. */
  const runCreativeId = (batchId: Id, i: number) => `${batchId}-c${i + 1}`;

  return {
    // ── Placements and Make formats ──
    async placements() {
      return wait(db.placements);
    },
    async makeFormats(documentId, placementIds) {
      ctx.mustStaff();
      const d = doc(documentId);
      const source = picked(d);
      if (!source) throw new FumeError("invalid", "Render and pick a version first.");
      const from =
        db.placements.find((p) => p.id === d.specs.placementId) ??
        db.placements.find((p) => p.format === d.specs.format)!;
      d.formats = placementIds.map((id): FormatTile => {
        const p = find(db.placements, id, "placement");
        const a = ratioOf(p.ratio);
        const b = ratioOf(from.ratio);
        const same = Math.abs(a - b) < 0.01;
        // Narrower than the source: the subject fits, crop. Wider or much taller: expand.
        const method: FormatTile["method"] = same ? "native" : a < b && b / a < 1.6 ? "crop" : "expand";
        const why = same
          ? "Same ratio as the master."
          : method === "crop"
            ? "The product fits inside the crop with air around it."
            : "Cropping would cut the product; the Engine extends the scene.";
        const crop = method === "crop" ? { x: (1 - a / b) / 2, y: 0, w: a / b, h: 1 } : undefined;
        return {
          placementId: id,
          method,
          engineChose: method,
          why,
          crop,
          state: method === "native" ? "done" : "making",
          image: method === "native" ? source.image : undefined,
        };
      });
      touch(d);
      later(() => {
        for (const t of d.formats ?? []) {
          t.state = "done";
          t.image = img(
            source.image.match(/(\d\d-\d\d)-/)?.[1] ?? "05-06",
            find(db.placements, t.placementId, "placement").format,
          );
        }
        touch(d);
      }, 14);
      return wait(d);
    },
    async setFormatTile(documentId, placementId, change) {
      ctx.mustStaff();
      const d = doc(documentId);
      const t = (d.formats ?? []).find((x) => x.placementId === placementId);
      if (!t) throw new FumeError("not_found", `No format ${placementId}`);
      if (change.crop) t.crop = change.crop;
      if (change.method && change.method !== t.method) {
        t.method = change.method;
        t.state = "making";
        later(() => {
          t.state = "done";
          touch(d);
        }, 10);
      }
      touch(d);
      return wait(d);
    },

    // ── Product fix ──
    async detailTokens(productId) {
      return wait(db.detailTokens.filter((t) => t.productId === productId));
    },
    async fixProduct(documentId, { versionId, tokenId, region, what }) {
      ctx.mustStaff();
      const d = doc(documentId);
      const v = find(d.versions, versionId, "version");
      const token = tokenId ? find(db.detailTokens, tokenId, "detail") : undefined;
      const findOn = token ? v.details?.find((f) => f.tokenId === token.id) : undefined;
      const fix = {
        id: nextId("fx"),
        tokenId,
        region: findOn?.region ?? region ?? token?.region ?? { x: 0.4, y: 0.4, w: 0.2, h: 0.2 },
        found: findOn?.read ?? what ?? "The brushed area",
        expected: token?.value ?? what ?? "As described",
        auto: false,
        by: ctx.me().id,
        at: now(),
        state: "fixing" as "fixing" | "fixed",
        versionId: undefined as Id | undefined,
      };
      d.fixes = [...(d.fixes ?? []), fix];
      touch(d);
      later(() => {
        const n: RenderVersion = {
          ...structuredClone(v),
          id: nextId("rv"),
          number: d.versions.length + 1,
          at: now(),
          by: ctx.me().id,
          state: "done",
          instruction: token
            ? `Fixed ${token.label.toLowerCase()} with the real product: ${token.value}`
            : `Fixed by hand: ${what ?? "brushed area"}`,
          details: v.details?.map((f) => (f.tokenId === tokenId ? { ...f, read: token!.value, ok: true } : f)),
        };
        d.versions.push(n);
        d.pickedVersionId = n.id;
        fix.state = "fixed";
        fix.versionId = n.id;
        touch(d);
      }, 16);
      return wait(d);
    },

    // ── Light and camera ──
    async lookPresets(workspaceId) {
      return wait({
        cameras: db.cameras.filter((c) => c.origin === "fume" || c.workspaceId === workspaceId),
        lights: db.lights.filter((l) => l.origin === "fume" || l.workspaceId === workspaceId),
      });
    },
    async setSource(documentId, section, source) {
      ctx.mustStaff();
      const d = doc(documentId);
      d.sources = { ...(d.sources ?? {}), [section]: source };
      touch(d);
      return wait(d);
    },

    // ── The Engine chat ──
    async engineChat(workspaceId) {
      ctx.mustStaff();
      return wait(
        db.engineMessages.filter((m) => m.workspaceId === workspaceId).sort((a, b) => a.at.localeCompare(b.at)),
      );
    },
    async engineSay(workspaceId, text) {
      ctx.mustStaff();
      const m: EngineMessage = {
        id: nextId("em"),
        workspaceId,
        author: { kind: "person", userId: ctx.me().id },
        text,
        at: now(),
      };
      db.engineMessages.push(m);
      const t = text.toLowerCase();
      later(() => {
        // A question about the work gets an answer, never a run (DTASK-5).
        if (isQuestion(t) && aboutCheck(t) && !/\b(make|render|create)\b/.test(t)) {
          const qa = ((db as unknown as { qaItems?: QaItem[] }).qaItems ?? []).filter(
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
      return wait(m);
    },
    async answerEngineWidget(workspaceId, messageId, answer) {
      ctx.mustStaff();
      const m = find(db.engineMessages, messageId, "message");
      if (!m.widget) throw new FumeError("invalid", "Nothing to answer");
      if (m.widget.kind === "products") {
        // Only products with confirmed facts are made (FLOWS: verify before production); the card locks the rest.
        const ids = (answer.picked ?? []).filter((id) => db.products.find((p) => p.id === id)?.state === "verified");
        if (!ids.length) throw new FumeError("invalid", "Pick a product whose facts are confirmed.");
        m.widget.picked = ids;
      } else if (m.widget.kind === "choice") m.widget.answer = answer.choice;
      // An answer changed further up while a later question is still open: the open question stays (no second ask).
      const later_ = db.engineMessages.filter(
        (x) => x.workspaceId === workspaceId && x.author.kind === "engine" && x.at > m.at,
      );
      const stillOpen = later_.some(
        (x) =>
          x.widget &&
          ((x.widget.kind === "choice" && !x.widget.answer) || (x.widget.kind === "products" && !x.widget.picked)),
      );
      if (stillOpen) {
        const last = later_.at(-1)!;
        last.run = { ...draftWords(draftOf(workspaceId)), asking: last.run?.asking };
        emit({ type: "engine.message", message: structuredClone(last) });
      } else later(() => askNext(workspaceId), 5);
      return wait(m);
    },

    // A creative of an Engine chat run opens as one document, with the Engine's picture as V1 (DWAY-13); the same
    // document each time, from the chat, Check or the Studio.
    async openDocument(input) {
      const run = input.creativeId ? /^(.+)-c(\d+)$/.exec(input.creativeId) : null;
      const b = run ? db.batches.find((x) => x.id === run[1]) : undefined;
      if (b && run && !db.documents.some((d) => d.creativeId === input.creativeId)) {
        ctx.mustStaff();
        const i = Number(run[2]) - 1;
        const v3 = await ctx.openDocument!({
          workspaceId: b.workspaceId,
          studio: "render",
          modeId: b.modeId,
          campaignId: b.campaignId || undefined,
          creativeId: input.creativeId,
        });
        const d = db.documents.find((x) => x.id === v3.id)!;
        const product = db.products.find((p) => p.id === b.productIds[Math.floor(i / b.perProduct)]);
        const label = b.format === "square" ? "Square" : b.format === "story" ? "Story" : "Feed";
        // r13: the document takes its creative's name in Check, so the Studio and Check say the same.
        const named = ((db as unknown as { qaItems?: QaItem[] }).qaItems ?? []).find(
          (q) => q.creativeId === input.creativeId,
        )?.title;
        d.title = named ?? `${product?.name ?? "Packshot"} · ${label} ${i + 1}`;
        d.slot = d.title;
        d.specs = { ...d.specs, format: b.format, productId: product?.id ?? d.specs.productId };
        if (!d.versions.length) {
          const image = b.previews[i % Math.max(1, b.previews.length)];
          d.versions.push({
            id: nextId("rv"),
            number: 1,
            image,
            at: b.at,
            by: b.by,
            state: "done",
            variables: structuredClone(d.variables),
            specs: structuredClone(d.specs),
            evaluation: { productTruth: "pass", brandRules: "pass", artefacts: "none", notes: [] },
            instruction: "The Engine’s picture, from its run in the Engine chat",
            cost: 0.12,
          });
          d.pickedVersionId = d.versions[0].id;
        }
        // Its creative in Check now knows the document, so a new version sent from the Studio takes its place there.
        const inCheck = ((db as unknown as { qaItems?: QaItem[] }).qaItems ?? []).find(
          (q) => q.creativeId === input.creativeId,
        );
        if (inCheck && !inCheck.documentId) inCheck.documentId = d.id;
        touch(d);
        return wait(d);
      }
      return ctx.openDocument!(input);
    },

    // ── Admin ──
    async usage() {
      ctx.mustStaff();
      return wait(db.usage);
    },

    // ── Meetings and the calendar ──
    async meetingSlots() {
      return wait(slots());
    },
    async bookMeeting({ at, topic }) {
      const m: Meeting = {
        id: nextId("mt"),
        workspaceId: ctx.workspaceId(),
        topic,
        at,
        minutes: 30,
        hostId: "u-sander",
        guestIds: [ctx.me().id],
        state: "booked",
      };
      db.meetings.push(m);
      db.calendar.push({
        id: nextId("ce"),
        workspaceId: ctx.workspaceId(),
        kind: "meeting",
        title: topic,
        start: at,
        meetingId: m.id,
      });
      fumeSays(`Booked: ${topic}, with Sander at Fume. It is in your calendar.`, {
        kind: "meeting",
        meetingId: m.id,
        slots: [at],
      });
      return wait(m);
    },
    async meetings() {
      return wait(
        db.meetings.filter((m) => m.workspaceId === ctx.workspaceId()).sort((a, b) => a.at.localeCompare(b.at)),
      );
    },
    async calendar({ from, to }) {
      return wait(
        db.calendar
          .filter((e) => e.workspaceId === ctx.workspaceId() && (e.end ?? e.start) >= from && e.start <= to)
          .sort((a, b) => a.start.localeCompare(b.start)),
      );
    },
    async schedule({ creativeId, placementId, at }) {
      const c = find(db.creatives, creativeId, "creative");
      const e: CalendarEntry = {
        id: nextId("ce"),
        workspaceId: ctx.workspaceId(),
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
      const e = find(db.calendar, entryId, "calendar entry");
      const length = e.end ? Date.parse(e.end) - Date.parse(e.start) : 0;
      e.start = at;
      if (e.end) e.end = new Date(Date.parse(at) + length).toISOString();
      return wait(e);
    },
    async removeEntry(entryId) {
      db.calendar = db.calendar.filter((e) => e.id !== entryId);
      return wait(undefined);
    },

    // ── The one conversation: people and meetings when Fume can't do it alone ──
    async say(text, attachments) {
      const t = text.toLowerCase();
      if (/(meeting|møte|call|book)/.test(t)) {
        const general = db.threads.find(
          (x) => x.workspaceId === ctx.workspaceId() && x.kind !== "contact" && x.campaignId === null,
        )!;
        const mine: Message = {
          id: nextId("msg"),
          threadId: general.id,
          author: { kind: "person", userId: ctx.me().id },
          text,
          at: now(),
        };
        db.messages.push(mine);
        // The topic carries over: "a meeting … about the Christmas plans?" → "Christmas plans".
        const about = /\b(?:about|om)\s+(?:the\s+|our\s+|my\s+)?(.+?)[?.!\s]*$/i.exec(text)?.[1]?.trim();
        const topic = about ? about.charAt(0).toUpperCase() + about.slice(1) : undefined;
        later(
          () =>
            fumeSays(
              `Here are times Sander at Fume is free${topic ? ` to talk about ${about}` : ""}. Pick one, and we book it.`,
              { kind: "meeting", slots: slots(), ...(topic ? { topic } : {}) },
            ),
          6,
        );
        return wait(mine);
      }
      if (/(invoice|faktura|contract|kontrakt|price|pris|cancel|person|human|menneske)/.test(t)) {
        const general = db.threads.find(
          (x) => x.workspaceId === ctx.workspaceId() && x.kind !== "contact" && x.campaignId === null,
        )!;
        const mine: Message = {
          id: nextId("msg"),
          threadId: general.id,
          author: { kind: "person", userId: ctx.me().id },
          text,
          at: now(),
        };
        db.messages.push(mine);
        later(
          () =>
            fumeSays("That is one for a person. Sander at Fume will answer you here.", {
              kind: "handover",
              userId: "u-sander",
              reason: "Contracts, prices and invoices are handled by people at Fume.",
            }),
          6,
        );
        later(
          () =>
            fumeSays("Hi, Sander here. I'm looking at it and will answer here shortly.", undefined, {
              kind: "person",
              userId: "u-sander",
            }),
          24,
        );
        return wait(mine);
      }
      return ctx.say(text, attachments);
    },
  };
}
