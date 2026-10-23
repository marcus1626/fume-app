// The mock backend's v3 calls (FLOWS.md §9–§14, PROPOSED 15 Oct 2026): Studio documents with modes, versions and
// Engine edits; brand presets, models and references; QA; frame.io-like review; taste training; one Fume chat,
// a brief without chat, and batches. createMockApi mixes these into FumeApi.

import {
  FumeError,
  type Batch,
  type Brief,
  type Campaign,
  type CreativeDocument,
  type Creative,
  type EngineEdit,
  type FumeApi,
  type FumeEvent,
  type Id,
  type LightAngle,
  type Lens,
  type Message,
  type QaItem,
  type QaView,
  type RenderVersion,
  type TasteArea,
  type TasteCard,
  type User,
  type VarValue,
  type Variables,
  type Workspace,
} from "../contract";
import { img } from "./seed";
import * as seed3 from "./seed3";
import { holdUntilSent, releaseHold } from "./r13-studio";
import { startCampaignBoard } from "./mockV2";

/** The v3 tables, merged into the mock's in-memory db. */
export function v3Db() {
  return structuredClone({
    modes: seed3.modes,
    documents: seed3.documents,
    presets: seed3.presets,
    models: seed3.models,
    brandReferences: seed3.references,
    qaItems: seed3.qaItems,
    reviewComments: seed3.reviewComments,
    ratings: seed3.ratings,
    tasteCards: seed3.tasteCards,
    tasteState: seed3.tasteState,
    batches: seed3.batches,
  });
}

type Db = ReturnType<typeof v3Db> & {
  boards: import("../contract").Board[];
  campaigns: Campaign[];
  creatives: Creative[];
  briefs: Brief[];
  workspaces: Workspace[];
  threads: import("../contract").Thread[];
  messages: Message[];
  products: import("../contract").Product[];
  sessions?: import("../contract").StudioSession[];
  // round 12 QA: the per-creative checks behind Check's "checked against" list, and the record a check writes to
  checks?: import("../contract").Check[];
  record?: import("../contract").RecordEvent[];
};

/** Points the seed's review comments and ratings at the creatives' real version ids. */
export function upgradeV2(db: Db) {
  const current = (creativeId: Id) => db.creatives.find((c) => c.id === creativeId)?.current.id ?? creativeId;
  for (const c of db.reviewComments) c.versionId = current(c.creativeId);
  for (const r of db.ratings) r.versionId = current(r.creativeId);
}

export interface V3Context {
  db: Db;
  wait: <T>(value: T) => Promise<T>;
  now: () => string;
  nextId: (prefix: string) => string;
  emit: (event: FumeEvent) => void;
  me: () => User;
  workspaceId: () => Id;
  mustStaff: () => void;
  mustApprove: () => void;
  send: FumeApi["send"];
  latency: number;
  /** Round 12 QA: a check in Check moves the creative itself (its version and the campaign's counts). */
  setVersion?: (creative: Creative, change: Partial<import("../contract").CreativeVersion>) => void;
  recount?: (campaign: Campaign) => void;
}

type V3Keys =
  | "studioModes" | "documents" | "document" | "openDocument" | "updateDocument" | "engineEdit" | "decideEdit" | "render" | "pickVersion"
  | "overrideProduct" | "documentToCheck" | "brandAssets" | "saveModel" | "decideModel" | "saveReference" | "decideOverride" | "productProposals"
  | "qaQueue" | "qaCheck" | "qaUncheck" | "undoDocumentToCheck" | "qaFeedback" | "qaEdit" | "qaToStudio" | "reviewComments" | "addReviewComment" | "resolveReviewComment"
  | "rate" | "ratings" | "tasteTraining" | "answerTaste" | "conversation" | "say" | "orderBrief" | "batches" | "startBatch";

/** Renders in the demo come from this pool, so every new version looks different. */
const POOL: Record<string, string[]> = {
  "m-free": ["05-03", "08-02", "06-04", "09-02", "04-02"],
  "m-packshot": ["03-08", "03-02", "03-05", "03-12"],
  "m-scene": ["05-06", "05-08", "04-06", "05-01", "06-05", "02-09"],
  "m-model": ["07-05", "07-02", "07-10", "07-11"],
  "m-lifestyle": ["07-05", "07-02", "07-10", "09-15"],
  "m-reference": ["02-04", "01-07", "09-13", "01-04"],
  "m-layout": ["05-01", "04-05"],
};

export function v3Api(ctx: V3Context): Pick<FumeApi, V3Keys> {
  const { db, wait, now, nextId, emit } = ctx;
  const find = <T extends { id: Id }>(list: T[], id: Id, what: string): T => {
    const found = list.find((x) => x.id === id);
    if (!found) throw new FumeError("not_found", `No ${what} ${id}`);
    return found;
  };
  const doc = (id: Id) => find(db.documents, id, "creative document");
  /** Taste cards already answered, by id (round 8: a reason can follow the pick). */
  const answeredTaste = new Map<Id, TasteCard>();
  const touch = (d: CreativeDocument) => {
    d.updatedAt = now();
    emit({ type: "document.state", document: structuredClone(d) });
  };
  const modeOf = (d: CreativeDocument) => find(db.modes, d.modeId, "mode");
  /** Which document holds each candidate opened in the Studio. */
  const fromCandidate = new Map<Id, Id>();

  /** The demo Engine: reads words from the Engine bar and turns them into variable changes. */
  function readInstruction(d: CreativeDocument, text: string, fallback = true): EngineEdit["changes"] {
    const t = text.toLowerCase();
    const mode = modeOf(d);
    const vars = d.variables;
    const changes: EngineEdit["changes"] = [];
    const has = (key: string) => mode.variables.some((v) => v.key === key);
    const label = (key: string) => mode.variables.find((v) => v.key === key)?.label ?? key;
    const num = (key: string, delta: number, min = 0, max = 100) => {
      if (!has(key)) return;
      const from = Number(vars[key]);
      const to = Math.max(min, Math.min(max, from + delta));
      if (to !== from) changes.push({ key, label: label(key), from, to });
    };
    const set = (key: string, to: VarValue) => {
      if (!has(key) || JSON.stringify(vars[key]) === JSON.stringify(to)) return;
      changes.push({ key, label: label(key), from: vars[key], to });
    };
    const more = /(longer|more|bigger|larger|up|increase|stronger)/.test(t);
    const less = /(shorter|less|smaller|down|decrease|weaker)/.test(t);
    if (/hair/.test(t) && /(long|short)/.test(t)) num("hairLength", /short/.test(t) ? -25 : 25);
    if (/hair/.test(t) && /(curl|wav|straight)/.test(t)) set("hairTexture", /curl/.test(t) ? "curly" : /wav/.test(t) ? "wavy" : "straight");
    if (/(older|younger)/.test(t)) num("age", /older/.test(t) ? 8 : -8, 18, 80);
    if (/freckle/.test(t)) num("freckles", less || /no freckle/.test(t) ? -30 : 30);
    if (/smil/.test(t)) set("expression", "soft_smile");
    if (/(warmer|cooler|colder)/.test(t)) num("warmth", /warmer/.test(t) ? -400 : 400, 2000, 6500);
    if (/(softer|harder) light|light.*(softer|harder)/.test(t)) num("softness", /softer/.test(t) ? 20 : -20);
    if (/(bottle|product)/.test(t) && (more || less)) num("productSize", more ? 6 : -6, 10, 80);
    if (/(lower|higher)/.test(t)) set("productPlace", /lower/.test(t) ? "low" : "high");
    if (/(from the left|from left)/.test(t) && has("lightAngle")) set("lightAngle", { ...(vars.lightAngle as LightAngle), azimuth: -70 });
    if (/(from the right|from right)/.test(t) && has("lightAngle")) set("lightAngle", { ...(vars.lightAngle as LightAngle), azimuth: 70 });
    if (/(closer|tighter)/.test(t) && has("lens")) set("lens", { ...(vars.lens as Lens), focal: Math.min(135, (vars.lens as Lens).focal + 15) });
    if (/(wider|further)/.test(t) && has("lens")) set("lens", { ...(vars.lens as Lens), focal: Math.max(24, (vars.lens as Lens).focal - 15) });
    if (/(white|linen|stone|brown) (background|ground)|background/.test(t) && has("background")) {
      const preset = db.presets.find((p) => p.kind === "background" && t.includes(p.name.toLowerCase().split(" ").pop()!));
      if (preset?.hex) set("background", preset.hex);
    }
    if (/shadow/.test(t)) set("shadow", /no shadow|without/.test(t) ? "none" : /hard/.test(t) ? "hard" : "soft");
    // Nothing matched a variable: the words go into the direction (Free) or the object (Reference maker). Round 12
    // DESK (DTASK-18): never a silent change to something she did not ask for; readParts says what was not read.
    if (!changes.length && fallback) {
      if (has("direction")) set("direction", [vars.direction, text].filter(Boolean).join(". "));
      else if (has("object")) set("object", text);
    }
    return changes;
  }

  /** Round 12 DESK (DTASK-18): each part of the instruction on its own ("Move the bottle lower and make the shadow
   *  softer" is two), so the change card shows what was read, what was not, and the Engine's guess for the rest. */
  function readParts(d: CreativeDocument, text: string): Pick<EngineEdit, "changes" | "parts"> {
    const mode = modeOf(d);
    const has = (key: string) => mode.variables.some((v) => v.key === key);
    const label = (key: string) => mode.variables.find((v) => v.key === key)?.label ?? key;
    const pieces = text.split(/\s*(?:[,;]|\.(?=\s|$)|\band then\b|\band\b|\bthen\b)\s*/i).map((s) => s.trim()).filter((s) => s.length > 2);
    const changes: EngineEdit["changes"] = [];
    const parts: NonNullable<EngineEdit["parts"]> = [];
    for (const piece of pieces.length ? pieces : [text]) {
      const found = readInstruction(d, piece, false).filter((c) => !changes.some((x) => x.key === c.key));
      changes.push(...found);
      if (found.length) {
        parts.push({ text: piece, keys: found.map((c) => c.key) });
        continue;
      }
      const t = piece.toLowerCase();
      const place = d.variables.productPlace;
      if (/(lower|higher)/.test(t) && has("productPlace") && place === (/lower/.test(t) ? "low" : "high")) {
        parts.push({ text: piece, keys: [], note: `${label("productPlace")} is already ${/lower/.test(t) ? "Low" : "High"}` });
      } else if (/(soft|hard)/.test(t) && has("softness")) {
        const from = Number(d.variables.softness);
        const to = Math.max(0, Math.min(100, from + (/soft/.test(t) ? 20 : -20)));
        parts.push({ text: piece, keys: [], note: /shadow/.test(t) && !has("shadow") ? `${mode.name} has no shadow of its own; the light sets it` : undefined, suggestion: to !== from ? { key: "softness", label: label("softness"), from, to } : undefined });
      } else {
        parts.push({ text: piece, keys: [], note: `Nothing in ${mode.name} sets that` });
      }
    }
    // Only when nothing at all was read do the words go into the direction or the object, as one change.
    if (!changes.length) {
      const whole = readInstruction(d, text, true);
      if (whole.length) return { changes: whole, parts: [{ text, keys: whole.map((c) => c.key) }] };
    }
    return { changes, parts };
  }

  function startRender(d: CreativeDocument, instruction?: string) {
    const pool = POOL[d.modeId] ?? POOL["m-free"];
    const n = d.versions.length + 1;
    const fmt = d.modeId === "m-model" || d.modeId === "m-reference" ? "square" : d.specs.format;
    const v: RenderVersion = {
      id: nextId("rv"), number: n, image: img(pool[n % pool.length], fmt), at: now(), by: ctx.me().id, state: "rendering",
      variables: structuredClone(d.variables), specs: structuredClone(d.specs), cost: 0.12 * Math.max(1, d.specs.count),
      evaluation: { productTruth: "pass", brandRules: "pass", artefacts: "none", notes: [] }, instruction,
    };
    d.versions.push(v);
    touch(d);
    setTimeout(() => {
      v.state = "done";
      if (n % 3 === 0) v.evaluation = { productTruth: "pass", brandRules: "pass", artefacts: "minor", notes: ["A soft edge on the label"] };
      d.pickedVersionId = v.id;
      touch(d);
    }, ctx.latency * 14);
  }

  /** The creative a QA item checks, when it is the same creative in the same format (a Design item may only borrow an id). */
  const creativeOf = (item: QaItem) => {
    const c = db.creatives.find((x) => x.id === item.creativeId);
    return c && c.format === item.format && c.campaignId === item.campaignId ? c : undefined;
  };
  /** Round 12 QA (DLAY-2): what it is checked against travels with it, from the creative's own check, else the brand's. */
  const againstOf = (item: QaItem): QaView["against"] => {
    const checks = db.checks ?? [];
    const own = creativeOf(item) ? checks.find((c) => c.creativeId === item.creativeId) : undefined;
    const check = own ?? checks.find((c) => c.workspaceId === item.workspaceId);
    return check?.items.map(({ area, label, against }) => ({ area, label, against }));
  };
  /** The product a QA item shows: its document's, else its campaign's when the campaign has one. */
  const productOf = (item: QaItem) => {
    const d = item.documentId ? db.documents.find((x) => x.id === item.documentId) : undefined;
    const ids = d?.specs.productId ? [d.specs.productId] : (db.campaigns.find((c) => c.id === item.campaignId)?.productIds ?? []);
    return ids.length === 1 ? db.products.find((p) => p.id === ids[0])?.name : undefined;
  };
  /** Round 12 QA: a creative made outside a campaign (a product page's pictures, campaignId "") is checked too. In Check
   *  it sits in its brand's "Product page" group; this stand-in only names the group and the brand's customer. */
  const productPage = (item: QaItem): Campaign => {
    const w = find(db.workspaces, item.workspaceId, "workspace");
    const any = db.campaigns.find((c) => c.workspaceId === item.workspaceId);
    return {
      id: "", workspaceId: w.id, name: "Product page", productIds: [], state: "in_production", stage: "masters", approverId: any?.approverId ?? "",
      channels: ["product_page"], formats: [item.format], market: w.market, language: w.language, createdBy: "fume", createdAt: item.sentAt ?? now(), updatedAt: now(),
      counts: { creatives: 0, inCheck: 0, checked: 0, approved: 0, delivered: 0 }, roundsUsed: 0, roundsIncluded: 0, brandDnaVersion: any?.brandDnaVersion ?? 1,
    };
  };
  const qaView = (item: QaItem): QaView => ({
    item,
    campaign: item.campaignId ? find(db.campaigns, item.campaignId, "campaign") : productPage(item),
    workspace: find(db.workspaces, item.workspaceId, "workspace"),
    against: againstOf(item),
    productName: productOf(item),
  });
  /** Before a check: what the creative and its check were, so Undo puts both back. */
  const beforeCheck = new Map<Id, { version?: import("../contract").CreativeVersion; check?: import("../contract").Check["state"] }>();
  /** Before a Send to check: what the QA item showed, so Undo puts it back (or removes the item it added). */
  const beforeSend = new Map<Id, { itemId: Id; was?: QaItem; added: boolean; docState: CreativeDocument["state"] }>();

  // Feedback the seed left with the Engine comes back fixed, like any other.
  for (const item of db.qaItems.filter((i) => i.state === "fixing")) {
    setTimeout(() => {
      if (item.state !== "fixing") return; // r13 #64: a designer took it over
      item.feedback.forEach((f) => (f.state = "fixed"));
      item.state = "waiting";
      item.evaluation = { productTruth: "pass", brandRules: "pass", artefacts: "none", notes: [] };
      emit({ type: "qa.state", item: structuredClone(item) });
    }, ctx.latency * 60);
  }

  const fumeThreadIds = () => new Set(db.threads.filter((t) => t.workspaceId === ctx.workspaceId() && t.kind !== "contact").map((t) => t.id));

  return {
    // ── Studio documents ──
    async studioModes() {
      return wait(db.modes);
    },
    async documents(workspaceId) {
      ctx.mustStaff();
      return wait(db.documents.filter((d) => d.workspaceId === workspaceId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    },
    async document(id) {
      ctx.mustStaff();
      return wait(doc(id));
    },
    async openDocument(input) {
      ctx.mustStaff();
      if (input.creativeId) {
        const existing = db.documents.find((d) => d.creativeId === input.creativeId);
        if (existing) return wait(existing);
      }
      // A candidate opens the one document that holds it, made once with the candidate as V1 (walk-through Must 10).
      if (input.fromGenerationId) {
        const held = fromCandidate.get(input.fromGenerationId);
        const existing = held && db.documents.find((d) => d.id === held);
        if (existing) return wait(existing);
        const session = db.sessions?.find((s) => s.generations.some((g) => g.id === input.fromGenerationId));
        const g = session?.generations.find((x) => x.id === input.fromGenerationId);
        if (g && session) {
          const modeId = g.recipe.mode === "type" ? "m-scene" : "m-free";
          const mode = find(db.modes, modeId, "mode");
          const specs = {
            format: g.recipe.format, count: 1, imageModel: g.recipe.route?.model ?? "Nano Banana Pro", referenceIds: [], modelIds: [],
            productId: g.recipe.productId ?? (mode.uses.includes("product") ? "pr-oil" : undefined), variantId: g.recipe.variantId,
          };
          const variables = seed3.defaults(mode.id);
          const campaign = db.campaigns.find((c) => c.id === (input.campaignId ?? session.campaignId));
          const d: CreativeDocument = {
            id: nextId("doc"), workspaceId: input.workspaceId, campaignId: campaign?.id,
            title: session.slot ?? (campaign ? `${campaign.name} · candidate ${g.branch}` : `Candidate ${g.branch}`), slot: session.slot,
            studio: "render", modeId: mode.id, variables, specs, overrides: [], layers: [], edits: [], state: "draft", by: ctx.me().id, updatedAt: now(),
            versions: [{ id: nextId("rv"), number: 1, image: g.image, at: g.at, by: ctx.me().id, state: "done", variables, specs, evaluation: g.evaluation, instruction: "The Engine's candidate, opened from its run", cost: g.cost }],
          };
          d.pickedVersionId = d.versions[0].id;
          db.documents.push(d);
          fromCandidate.set(g.id, d.id);
          return wait(d);
        }
      }
      // A campaign's free session opens again while it is still empty, so pressing twice makes one document.
      if (!input.creativeId) {
        const empty = db.documents.find((d) => d.workspaceId === input.workspaceId && d.campaignId === input.campaignId && d.slot === input.slot && d.modeId === input.modeId && d.versions.length === 0 && d.by === ctx.me().id);
        if (empty) return wait(empty);
      }
      const mode = find(db.modes, input.modeId, "mode");
      const d: CreativeDocument = {
        id: nextId("doc"), workspaceId: input.workspaceId, campaignId: input.campaignId, creativeId: input.creativeId,
        title: input.title ?? (mode.output === "model" ? "New model" : mode.output === "reference" ? "New reference" : "Untitled creative"),
        slot: input.slot, studio: input.studio, modeId: mode.id, variables: seed3.defaults(mode.id),
        // r13 #56: no product picked unless it was started from one, from its campaign (the campaign's first product) or
        // from a creative (the demo's creatives are Night Body Oil); before, every new creative started on Night Body Oil.
        specs: {
          format: mode.output === "creative" ? "feed" : "square", count: mode.output === "creative" ? 4 : 2, imageModel: "Nano Banana Pro", referenceIds: [], modelIds: [],
          productId: mode.uses.includes("product") ? (input.productId ?? (input.campaignId ? db.campaigns.find((c) => c.id === input.campaignId)?.productIds[0] : undefined) ?? (input.creativeId ? "pr-oil" : undefined)) : undefined,
        },
        overrides: [], layers: [], versions: [], edits: [], state: "draft", by: ctx.me().id, updatedAt: now(),
      };
      db.documents.push(d);
      return wait(d);
    },
    async updateDocument(id, change) {
      ctx.mustStaff();
      const d = doc(id);
      if (change.modeId && change.modeId !== d.modeId) {
        const mode = find(db.modes, change.modeId, "mode");
        // r13 #60: what the new mode has no use for is set aside on the document, and comes back on a switch back.
        const held = d as typeof d & { aside?: Variables };
        const fits = ([k]: [string, unknown]) => mode.variables.some((v) => v.key === k);
        const aside = { ...held.aside, ...Object.fromEntries(Object.entries(d.variables).filter((e) => !fits(e))) } as Variables;
        d.modeId = mode.id;
        d.studio = mode.studio;
        d.variables = { ...seed3.defaults(mode.id), ...Object.fromEntries(Object.entries(aside).filter(fits)), ...Object.fromEntries(Object.entries(d.variables).filter(fits)) };
        held.aside = Object.fromEntries(Object.entries(aside).filter((e) => !fits(e))) as Variables;
      }
      if (change.variables) d.variables = { ...d.variables, ...change.variables };
      if (change.specs) d.specs = { ...d.specs, ...change.specs };
      if (change.layers) d.layers = change.layers;
      if (change.studio) d.studio = change.studio;
      if (change.title) d.title = change.title;
      // v5: the document's campaign (Marcus 15 Oct: a campaign has its own look). The look sources start over, so a
      // campaign with a look of its own leads every look section.
      if ("campaignId" in change && change.campaignId !== d.campaignId) {
        if (change.campaignId) find(db.campaigns, change.campaignId, "campaign");
        d.campaignId = change.campaignId;
        d.sources = {};
      }
      touch(d);
      return wait(d);
    },
    async engineEdit(id, text) {
      ctx.mustStaff();
      const d = doc(id);
      const edit: EngineEdit = { id: nextId("ed"), text, ...readParts(d, text), by: ctx.me().id, at: now(), state: "proposed" }; // round 12 DESK: each part read
      d.edits.push(edit);
      for (const c of edit.changes) d.variables[c.key] = c.to;
      touch(d);
      return wait(d);
    },
    async decideEdit(id, editId, verdict) {
      ctx.mustStaff();
      const d = doc(id);
      const edit = find(d.edits, editId, "edit");
      if (verdict === "undo") {
        for (const c of edit.changes) d.variables[c.key] = c.from;
        edit.state = "undone";
      } else {
        edit.state = "kept";
        startRender(d, edit.text);
      }
      touch(d);
      return wait(d);
    },
    async render(id) {
      ctx.mustStaff();
      const d = doc(id);
      startRender(d);
      return wait(d);
    },
    async pickVersion(id, versionId) {
      ctx.mustStaff();
      const d = doc(id);
      const v = find(d.versions, versionId, "version");
      d.pickedVersionId = v.id;
      d.variables = structuredClone(v.variables);
      touch(d);
      return wait(d);
    },
    async overrideProduct(id, { field, value, scope }) {
      ctx.mustStaff();
      const d = doc(id);
      const product = d.specs.productId ? db.products.find((p) => p.id === d.specs.productId) : undefined;
      if (!product) throw new FumeError("invalid", "Pick a product first.");
      const fact = product.facts.find((f) => f.label === field);
      d.overrides = d.overrides.filter((o) => !(o.field === field && o.scope === scope && o.state !== "approved"));
      d.overrides.push({ id: nextId("ov"), productId: product.id, field, value, was: fact?.statement ?? "", scope, by: ctx.me().id, at: now(), state: scope === "product" ? "proposed" : "applied" });
      touch(d);
      return wait(d);
    },
    async documentToCheck(id) {
      ctx.mustStaff();
      const d = doc(id);
      if (!d.pickedVersionId) throw new FumeError("invalid", "Pick a version first.");
      const docState = d.state;
      d.state = "in_check";
      touch(d);
      // Round 12 QA (DTASK-1): the version sent lands in Check. A creative opened from Check takes the new picture there
      // and waits again ("Version 2 from the Studio · Anna, 14:32"), with the old one kept for Before | After; a
      // document of a campaign that is not in Check yet comes in as a new creative to check.
      const picked = d.versions.find((v) => v.id === d.pickedVersionId)!;
      const item = db.qaItems.find((i) => i.documentId === d.id);
      const by = { sentBy: ctx.me().id, sentAt: now() };
      if (item) {
        beforeSend.set(d.id, { itemId: item.id, was: structuredClone(item), added: false, docState });
        const shown = item.version ?? 1;
        if (picked.image !== item.image) Object.assign(item, { previous: { image: item.image, version: shown }, image: picked.image, version: Math.max(picked.number, shown + 1) });
        Object.assign(item, by, {
          state: "waiting", evaluation: picked.evaluation, format: d.specs.format, checkedBy: undefined, checkedAt: undefined, studioBy: undefined, studioAt: undefined,
          layers: d.studio === "design" ? structuredClone(d.layers) : item.layers,
        });
        emit({ type: "qa.state", item: structuredClone(item) });
      } else {
        // every creative is checked: one with no campaign (a product page's pictures) lands in "Product page"
        const campaign = db.campaigns.find((c) => c.id === d.campaignId);
        const added: QaItem = {
          id: nextId("qa"), workspaceId: d.workspaceId, campaignId: d.campaignId ?? "", creativeId: d.creativeId ?? `cr-${d.id}`, documentId: d.id,
          title: d.title, slot: d.slot ?? d.title, studio: d.studio, image: picked.image, format: d.specs.format, madeAt: picked.at,
          dueAt: campaign?.dueAt ?? now(), risk: "normal", state: "waiting", evaluation: picked.evaluation, feedback: [], version: picked.number,
          layers: d.studio === "design" ? structuredClone(d.layers) : undefined, ...by,
        };
        db.qaItems.push(added);
        beforeSend.set(d.id, { itemId: added.id, added: true, docState });
        emit({ type: "qa.state", item: structuredClone(added) });
      }
      return wait(d);
    },
    async undoDocumentToCheck(id) {
      ctx.mustStaff();
      const d = doc(id);
      const was = beforeSend.get(d.id);
      beforeSend.delete(d.id);
      d.state = was?.docState ?? "draft";
      touch(d);
      const at = was?.added ? db.qaItems.findIndex((i) => i.id === was.itemId) : -1;
      const removed = at >= 0 ? db.qaItems.splice(at, 1)[0] : undefined;
      if (!was?.added && was?.was) {
        const item = db.qaItems.find((i) => i.id === was.itemId);
        if (item && item.state !== "checked") {
          // back to the item as it was, without what the send added (previous, version, sentBy …)
          for (const k of Object.keys(item) as (keyof QaItem)[]) if (!(k in was.was)) delete item[k];
          Object.assign(item, was.was);
        }
      }
      const left = db.qaItems.find((i) => i.id === was?.itemId) ?? removed;
      if (left) emit({ type: "qa.state", item: structuredClone(left) }); // the open pages refresh Check
      return wait(d);
    },

    // ── Brand assets ──
    async brandAssets(workspaceId) {
      const ws = workspaceId ?? ctx.workspaceId();
      const staff = Boolean(ctx.me().staffRole);
      return wait({
        presets: db.presets.filter((p) => p.workspaceId === ws),
        // The customer sees what Fume saved for them, never a designer's drafts.
        models: db.models.filter((m) => m.workspaceId === ws && (staff || m.state !== "draft")),
        references: db.brandReferences.filter((r) => r.workspaceId === ws && (staff || r.state === "saved")),
      });
    },
    async saveModel({ documentId, name, state }) {
      ctx.mustStaff();
      const d = doc(documentId);
      const picked = d.versions.find((v) => v.id === d.pickedVersionId) ?? d.versions.at(-1);
      if (!picked) throw new FumeError("invalid", "Render the model first.");
      let m = db.models.find((x) => x.documentId === documentId);
      const v = d.variables;
      const look = [`${v.age ?? ""}s`.replace(/^(\d)\d/, "$10"), v.hairTexture, "hair"].filter(Boolean).join(", ");
      if (!m) {
        m = { id: nextId("bm"), workspaceId: d.workspaceId, name, image: picked.image, sheet: d.versions.filter((x) => x.state === "done").slice(-3).map((x) => x.image), variables: structuredClone(v), look, state, isAiPerson: true, madeBy: ctx.me().id, at: now(), usedIn: 0, documentId };
        db.models.push(m);
      } else Object.assign(m, { name, image: picked.image, variables: structuredClone(v), state });
      if (state === "saved") m.savedBy = ctx.me().id;
      d.title = name;
      return wait(m);
    },
    async decideModel(modelId, verdict) {
      ctx.mustApprove();
      const m = find(db.models, modelId, "model");
      if (m.state === "draft") throw new FumeError("invalid", "Fume has not saved this model yet.");
      Object.assign(m, { state: verdict === "approve" ? "approved" : "declined", decidedBy: ctx.me().id });
      return wait(m);
    },
    async saveReference({ documentId, name, state }) {
      ctx.mustStaff();
      const d = doc(documentId);
      const picked = d.versions.find((v) => v.id === d.pickedVersionId) ?? d.versions.at(-1);
      if (!picked) throw new FumeError("invalid", "Render the reference first.");
      let r = db.brandReferences.find((x) => x.documentId === documentId);
      if (!r) {
        r = { id: nextId("rf"), workspaceId: d.workspaceId, name, image: picked.image, origin: "made", state, madeBy: ctx.me().id, at: now(), documentId };
        db.brandReferences.push(r);
      } else Object.assign(r, { name, image: picked.image, state });
      d.title = name;
      return wait(r);
    },
    async productProposals(productId) {
      const ws = ctx.workspaceId();
      return wait(db.documents.filter((d) => d.workspaceId === ws).flatMap((d) => d.overrides.filter((o) => o.scope === "product" && o.productId === productId)));
    },
    async decideOverride(overrideId, verdict) {
      ctx.mustApprove();
      for (const d of db.documents) {
        const o = d.overrides.find((x) => x.id === overrideId);
        if (!o) continue;
        o.state = verdict === "approve" ? "approved" : "declined";
        if (o.state === "approved") {
          const fact = db.products.find((p) => p.id === o.productId)?.facts.find((f) => f.label === o.field);
          if (fact) fact.statement = o.value;
        }
        return wait(o);
      }
      throw new FumeError("not_found", `No override ${overrideId}`);
    },

    // ── QA ──
    async qaQueue(workspaceId) {
      ctx.mustStaff();
      const order = { waiting: 0, fixing: 1, in_studio: 2, checked: 3 };
      return wait(
        db.qaItems
          .filter((i) => !workspaceId || i.workspaceId === workspaceId)
          .sort((a, b) => order[a.state] - order[b.state] || (a.risk === b.risk ? a.dueAt.localeCompare(b.dueAt) : a.risk === "high" ? -1 : 1))
          .map(qaView),
      );
    },
    async qaCheck(itemId) {
      ctx.mustStaff();
      const item = find(db.qaItems, itemId, "QA item");
      if (item.state === "fixing") throw new FumeError("invalid", "The Engine is still fixing it.");
      if (item.state === "checked") return wait(item);
      Object.assign(item, { state: "checked", checkedBy: ctx.me().id, checkedAt: now() });
      // Round 12 QA (DTASK-14): the check moves the creative itself, so what waits to be sent counts it.
      const creative = creativeOf(item);
      const check = db.checks?.find((c) => c.creativeId === item.creativeId && creative);
      beforeCheck.set(item.id, { version: creative ? { ...creative.current } : undefined, check: check?.state });
      if (creative && ["making", "in_check", "correcting", "held"].includes(creative.current.state)) {
        ctx.setVersion?.(creative, { state: "checked", checkedBy: ctx.me().id, checkedAt: now(), heldReason: undefined });
        const campaign = db.campaigns.find((c) => c.id === item.campaignId); // none for a product page's pictures
        // Round 13 (robots' note 06): once the campaign's set is out, a new check waits for the next send (r13-studio.ts).
        if (campaign && campaign.state !== "in_production" && !(db.workspaces.find((w) => w.id === item.workspaceId) as { agencyId?: Id } | undefined)?.agencyId) holdUntilSent(creative.current.id);
        if (campaign) ctx.recount?.(campaign);
        db.record?.push({ id: nextId("e"), workspaceId: item.workspaceId, campaignId: item.campaignId, subjectId: creative.id, actor: { kind: "person", userId: ctx.me().id }, action: "checked", detail: `${creative.title} checked`, at: now() });
      }
      if (check) Object.assign(check, { state: "checked", checkedAt: now() });
      emit({ type: "qa.state", item: structuredClone(item) });
      return wait(item);
    },
    async qaUncheck(itemId) {
      ctx.mustStaff();
      const item = find(db.qaItems, itemId, "QA item");
      if (item.state !== "checked") return wait(item);
      Object.assign(item, { state: "waiting", checkedBy: undefined, checkedAt: undefined });
      const was = beforeCheck.get(item.id);
      beforeCheck.delete(item.id);
      const creative = creativeOf(item);
      if (creative && was?.version && creative.current.state === "checked") {
        releaseHold(creative.current.id); // round 13: nothing to send once the check is undone
        ctx.setVersion?.(creative, { state: was.version.state, checkedBy: was.version.checkedBy, checkedAt: was.version.checkedAt, heldReason: was.version.heldReason });
        const campaign = db.campaigns.find((c) => c.id === item.campaignId);
        if (campaign) ctx.recount?.(campaign);
        if (db.record) {
          const i = db.record.map((e) => e.subjectId === creative.id && e.action === "checked").lastIndexOf(true);
          if (i >= 0) db.record.splice(i, 1);
        }
      }
      const check = db.checks?.find((c) => c.creativeId === item.creativeId && creative);
      if (check && was?.check) check.state = was.check;
      emit({ type: "qa.state", item: structuredClone(item) });
      return wait(item);
    },
    async qaFeedback(itemId, text, pins) {
      ctx.mustStaff();
      const item = find(db.qaItems, itemId, "QA item");
      // r13 #51: the pins go with it as located notes
      const fb = { id: nextId("fb"), text, by: ctx.me().id, at: now(), state: "sent" as "sent" | "fixed", ...(pins?.length ? { pins: structuredClone(pins) } : {}) };
      item.feedback.push(fb);
      item.state = "fixing";
      setTimeout(() => {
        if (item.state !== "fixing") return; // r13 #64: a designer took it over
        fb.state = "fixed";
        item.state = "waiting";
        item.evaluation = { productTruth: "pass", brandRules: "pass", artefacts: "none", notes: [] };
        emit({ type: "qa.state", item: structuredClone(item) });
      }, ctx.latency * 20);
      return wait(item);
    },
    async qaEdit(itemId, layers) {
      ctx.mustStaff();
      const item = find(db.qaItems, itemId, "QA item");
      item.layers = layers;
      if (item.documentId) doc(item.documentId).layers = structuredClone(layers);
      return wait(item);
    },
    async qaToStudio(itemId, takeOver) {
      ctx.mustStaff();
      const item = find(db.qaItems, itemId, "QA item");
      let d = item.documentId ? db.documents.find((x) => x.id === item.documentId) : db.documents.find((x) => x.creativeId === item.creativeId);
      if (!d) {
        const modeId = item.studio === "design" ? "m-layout" : "m-scene";
        d = {
          id: nextId("doc"), workspaceId: item.workspaceId, campaignId: item.campaignId, creativeId: item.creativeId, title: item.title, slot: item.slot,
          studio: item.studio, modeId, variables: seed3.defaults(modeId),
          specs: { format: item.format, count: 4, imageModel: "Nano Banana Pro", referenceIds: [], modelIds: [], productId: "pr-oil" },
          overrides: [], layers: item.layers ?? [], edits: [], state: "draft", by: ctx.me().id, updatedAt: now(),
          versions: [{ id: nextId("rv"), number: 1, image: item.image, at: item.madeAt, by: ctx.me().id, state: "done", variables: seed3.defaults(modeId), specs: { format: item.format, count: 1, imageModel: "Nano Banana Pro", referenceIds: [], modelIds: [] }, evaluation: item.evaluation, cost: 0.12 }],
        };
        d.pickedVersionId = d.versions[0].id;
        db.documents.push(d);
      }
      item.documentId = d.id;
      // r13 #64: while the Engine fixes it, the desk opens locked; only Take over takes it (and the fix stops).
      if (item.state === "fixing" && !takeOver) return wait({ item, document: d });
      if (item.state !== "checked") Object.assign(item, { state: "in_studio", studioBy: ctx.me().id, studioAt: now() });
      emit({ type: "qa.state", item: structuredClone(item) });
      return wait({ item, document: d });
    },

    // ── Review ──
    async reviewComments(creativeId) {
      return wait(db.reviewComments.filter((c) => c.creativeId === creativeId).sort((a, b) => a.at.localeCompare(b.at)));
    },
    async addReviewComment({ creativeId, versionId, text, pin, replyTo }) {
      if (replyTo) {
        const parent = find(db.reviewComments, replyTo, "comment");
        parent.replies.push({ id: nextId("rcr"), by: ctx.me().id, text, at: now() });
        return wait(parent);
      }
      const c = { id: nextId("rc"), creativeId, versionId, by: ctx.me().id, text, pin, at: now(), replies: [] };
      db.reviewComments.push(c);
      return wait(c);
    },
    async resolveReviewComment(commentId) {
      const c = find(db.reviewComments, commentId, "comment");
      c.resolved = !c.resolved;
      return wait(c);
    },
    async rate({ creativeId, versionId, stars }) {
      const me = ctx.me().id;
      db.ratings = db.ratings.filter((r) => !(r.creativeId === creativeId && r.by === me));
      const r = { creativeId, versionId, by: me, stars, at: now() };
      db.ratings.push(r);
      return wait(r);
    },
    async ratings(campaignId) {
      const ids = new Set(db.creatives.filter((c) => c.campaignId === campaignId).map((c) => c.id));
      return wait(db.ratings.filter((r) => ids.has(r.creativeId)));
    },

    // ── Taste ──
    async tasteTraining() {
      return wait({ cards: db.tasteCards, state: db.tasteState });
    },
    async answerTaste({ cardId, answer, reason }) {
      // Round 8 (UX review ONB-11): "why" is asked after the pick, so a reason (or a changed answer, after "Back one")
      // can come for a card already answered: it updates what the Engine learned, without counting a new answer.
      const again = !db.tasteCards.some((c) => c.id === cardId) ? answeredTaste.get(cardId) : undefined;
      if (again) {
        const s = db.tasteState;
        if (reason) {
          s.confidence[again.area] = Math.min(0.98, s.confidence[again.area] + 0.02);
          s.lastLesson = `${reason.charAt(0).toUpperCase()}${reason.slice(1).replace(/\.?$/, ".")}`;
        }
        s.updatedAt = now();
        return wait({ card: again, state: s });
      }
      const card = find(db.tasteCards, cardId, "taste card");
      answeredTaste.set(cardId, card);
      const s = db.tasteState;
      const area: TasteArea = card.area;
      s.confidence[area] = Math.min(0.98, s.confidence[area] + (reason ? 0.04 : 0.02));
      s.answered += 1;
      s.updatedAt = now();
      const lessons: Record<TasteArea, string> = {
        light: "Low, warm side light over flat front light.",
        colour: "Warm neutrals; blue only as a quiet accent.",
        people: "Calm, unposed, skin that looks like skin.",
        composition: "The product low, with air above it.",
        styling: "Natural fabrics: linen and wool, nothing shiny.",
      };
      s.lastLesson = reason ? `${reason.charAt(0).toUpperCase()}${reason.slice(1).replace(/\.?$/, ".")}` : answer === "no" ? `Not this. ${lessons[area]}` : lessons[area];
      // The deck never ends: an answered card goes to the back with a fresh picture.
      db.tasteCards = [...db.tasteCards.filter((c) => c.id !== cardId), { ...card, id: nextId("tc") }];
      return wait({ card, state: s });
    },

    // ── One Fume chat ──
    async conversation() {
      const ids = fumeThreadIds();
      return wait(db.messages.filter((m) => ids.has(m.threadId)).sort((a, b) => a.at.localeCompare(b.at)));
    },
    async say(text, attachments) {
      const general = db.threads.find((t) => t.workspaceId === ctx.workspaceId() && t.kind !== "contact" && t.campaignId === null);
      if (!general) throw new FumeError("not_found", "No conversation with Fume");
      // A typed answer to Fume's latest question goes to the campaign it asked about, so it fills that brief (UX review C1).
      const ids = fumeThreadIds();
      const latest = db.messages.filter((m) => ids.has(m.threadId)).sort((a, b) => a.at.localeCompare(b.at)).at(-1);
      const asking = latest?.author.kind === "fume" && latest.card?.kind === "question" ? db.threads.find((t) => t.id === latest.threadId) : undefined;
      const open = asking?.campaignId ? db.briefs.find((b) => b.campaignId === asking.campaignId && b.state === "drafting") : undefined;
      return ctx.send(open && asking ? asking.id : general.id, text, attachments);
    },
    async orderBrief(order) {
      const me = ctx.me();
      const id = nextId("c");
      const campaign: Campaign = {
        id, workspaceId: ctx.workspaceId(), name: order.name || "New campaign", productIds: order.productIds, state: "draft", stage: "brief",
        // Round 9 (FORMS, DTSK-12): the market and the number of creatives come from the form when it says them.
        approverId: "u-maja", channels: order.channels, formats: order.formats, market: order.market ?? "Norway", language: order.language ?? "Norwegian", dueAt: order.deadline,
        createdBy: me.id, createdAt: now(), updatedAt: now(), counts: { creatives: 0, inCheck: 0, checked: 0, approved: 0, delivered: 0 },
        roundsUsed: 0, roundsIncluded: 2, brandDnaVersion: 3, collectionIds: order.collectionIds,
      };
      db.campaigns.push(campaign);
      if (order.moodboard?.images.length) startCampaignBoard(db, campaign, order.moodboard.images, { id: me.id, staff: Boolean(me.staffRole) }, now(), nextId);
      db.briefs.push({
        // Round 8 (BRIEF, TASK-2): the message is its own line, never the notes; the notes go to Fume as her words.
        campaignId: id, version: 1, state: "ready", objective: order.goal, audience: order.audience ?? "", message: order.message ?? "",
        mandatory: order.mandatory ?? [], never: order.never ?? [],
        channels: order.channels, formats: order.formats, creatives: order.creatives && order.creatives > 0 ? Math.round(order.creatives) : order.formats.length * 4, references: order.references, missing: [],
      });
      const threadId = nextId("t");
      db.threads.push({ id: threadId, workspaceId: ctx.workspaceId(), campaignId: id, title: campaign.name, kind: "fume", updatedAt: now(), unread: 0 });
      if (order.notes.trim()) db.messages.push({ id: nextId("msg"), threadId, author: { kind: "person", userId: me.id }, text: order.notes.trim(), at: now() });
      const m: Message = { id: nextId("msg"), threadId, author: { kind: "fume" }, text: `${me.name.split(" ")[0]} wrote the brief for ${campaign.name}.`, at: now(), card: { kind: "brief", campaignId: id, version: 1 } };
      db.messages.push(m);
      emit({ type: "message.new", message: m });
      emit({ type: "campaign.state", campaign });
      return wait(campaign);
    },

    // ── Batches ──
    async batches(campaignId) {
      ctx.mustStaff();
      return wait(db.batches.filter((b) => !campaignId || b.campaignId === campaignId).sort((a, b) => b.at.localeCompare(a.at)));
    },
    async startBatch(input) {
      ctx.mustStaff();
      // Round 12 (DLOAD-3a): a batch for the product page has no campaign; its brand is its products' brand.
      const campaign = input.campaignId ? find(db.campaigns, input.campaignId, "campaign") : undefined;
      const workspaceId = campaign?.workspaceId ?? db.products.find((p) => p.id === input.productIds[0])?.workspaceId ?? "";
      const total = input.productIds.length * input.perProduct;
      const b: Batch = { id: nextId("bt"), workspaceId, ...input, state: "running", made: 0, total, previews: [], by: ctx.me().id, at: now() };
      db.batches.push(b);
      const pool = POOL[input.modeId] ?? POOL["m-packshot"];
      const timer = setInterval(() => {
        b.made = Math.min(total, b.made + Math.max(1, Math.ceil(total / 8)));
        b.previews = Array.from({ length: Math.min(8, b.made) }, (_, i) => img(pool[i % pool.length], input.format));
        if (b.made >= total) {
          b.state = "done";
          clearInterval(timer);
        }
        emit({ type: "batch.progress", batch: structuredClone(b) });
      }, ctx.latency * 8);
      return wait(b);
    },
  };
}

export type { Variables };
