// The Studio: the expert's sessions with candidates, and creative documents with a mode, versions and Engine edits;
// placements and Make formats, the product fix with detail tokens, light and camera presets, and the brand's own
// presets, models and references.
import {
  FumeError,
  type CreativeDocument,
  type EngineEdit,
  type FormatTile,
  type FumeApi,
  type Generation,
  type Id,
  type LightAngle,
  type Lens,
  type QaItem,
  type RenderVersion,
  type StudioSession,
  type VarValue,
  type Variables,
} from "../contract";
import type { Mock } from "./context";
import { POOL } from "./production";
import { defaults } from "./seed";
import { img } from "./seed/helpers";
import { footage } from "./seed/video";
import { newTakes, readVideoAsk, startEdit, withChecks } from "./video";

type Calls =
  | "studioKit"
  | "studioSession"
  | "openStudio"
  | "generate"
  | "repair"
  | "pickGeneration"
  | "sendToCheck"
  | "studioModes"
  | "documents"
  | "document"
  | "openDocument"
  | "updateDocument"
  | "makeShot"
  | "adaptVideo"
  | "engineEdit"
  | "decideEdit"
  | "render"
  | "pickVersion"
  | "addVersion"
  | "overrideProduct"
  | "documentToCheck"
  | "undoDocumentToCheck"
  | "placements"
  | "makeFormats"
  | "setFormatTile"
  | "fixProduct"
  | "lookPresets"
  | "setSource"
  | "brandAssets"
  | "saveModel"
  | "decideModel"
  | "saveReference"
  | "decideOverride"
  | "productProposals";

const ratioOf = (r: string) => {
  const [w, h] = r.split(":").map(Number);
  return w / h;
};

export function studioCalls(m: Mock): Pick<FumeApi, Calls> {
  const { db, wait } = m;
  const now = () => m.now();
  const doc = (id: Id) => m.find(db.documents, id, "creative document");
  const touch = (d: CreativeDocument) => {
    d.updatedAt = now();
    m.emit({ type: "document.state", document: structuredClone(d) });
  };
  const modeOf = (d: CreativeDocument) => m.find(db.modes, d.modeId, "mode");
  const picked = (d: CreativeDocument) => d.versions.find((v) => v.id === d.pickedVersionId) ?? d.versions.at(-1);
  const later = (fn: () => void, ticks = 12) => setTimeout(fn, m.latency * ticks);
  const sessionOf = (id: Id) => m.find(db.sessions, id, "Studio session");
  /** Which document holds each candidate opened in the Studio. */
  const fromCandidate = new Map<Id, Id>();
  /** Before a Send to check: what the QA item showed, so Undo puts it back (or removes the item it added). */
  const beforeSend = new Map<Id, { itemId: Id; was?: QaItem; added: boolean; docState: CreativeDocument["state"] }>();

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
    if (/hair/.test(t) && /(curl|wav|straight)/.test(t))
      set("hairTexture", /curl/.test(t) ? "curly" : /wav/.test(t) ? "wavy" : "straight");
    if (/(older|younger)/.test(t)) num("age", /older/.test(t) ? 8 : -8, 18, 80);
    if (/freckle/.test(t)) num("freckles", less || /no freckle/.test(t) ? -30 : 30);
    if (/smil/.test(t)) set("expression", "soft_smile");
    if (/(warmer|cooler|colder)/.test(t)) num("warmth", /warmer/.test(t) ? -400 : 400, 2000, 6500);
    if (/(softer|harder) light|light.*(softer|harder)/.test(t)) num("softness", /softer/.test(t) ? 20 : -20);
    if (/(bottle|product)/.test(t) && (more || less)) num("productSize", more ? 6 : -6, 10, 80);
    if (/(lower|higher)/.test(t)) set("productPlace", /lower/.test(t) ? "low" : "high");
    if (/(from the left|from left)/.test(t) && has("lightAngle"))
      set("lightAngle", { ...(vars.lightAngle as LightAngle), azimuth: -70 });
    if (/(from the right|from right)/.test(t) && has("lightAngle"))
      set("lightAngle", { ...(vars.lightAngle as LightAngle), azimuth: 70 });
    if (/(closer|tighter)/.test(t) && has("lens"))
      set("lens", { ...(vars.lens as Lens), focal: Math.min(135, (vars.lens as Lens).focal + 15) });
    if (/(wider|further)/.test(t) && has("lens"))
      set("lens", { ...(vars.lens as Lens), focal: Math.max(24, (vars.lens as Lens).focal - 15) });
    if (/(white|linen|stone|brown) (background|ground)|background/.test(t) && has("background")) {
      const preset = db.presets.find(
        (p) => p.kind === "background" && t.includes(p.name.toLowerCase().split(" ").pop()!),
      );
      if (preset?.hex) set("background", preset.hex);
    }
    if (/shadow/.test(t)) set("shadow", /no shadow|without/.test(t) ? "none" : /hard/.test(t) ? "hard" : "soft");
    // Nothing matched a variable: the words go into the direction (Free) or the object (Reference maker), never a
    // silent change to something she did not ask for; readParts says what was not read.
    if (!changes.length && fallback) {
      if (has("direction")) set("direction", [vars.direction, text].filter(Boolean).join(". "));
      else if (has("object")) set("object", text);
    }
    return changes;
  }

  /** Each part of the instruction on its own ("Move the bottle lower and make the shadow softer" is two), so the
   *  change card shows what was read, what was not, and the Engine's guess for the rest. */
  function readParts(d: CreativeDocument, text: string): Pick<EngineEdit, "changes" | "parts"> {
    const mode = modeOf(d);
    const has = (key: string) => mode.variables.some((v) => v.key === key);
    const label = (key: string) => mode.variables.find((v) => v.key === key)?.label ?? key;
    const pieces = text
      .split(/\s*(?:[,;]|\.(?=\s|$)|\band then\b|\band\b|\bthen\b)\s*/i)
      .map((s) => s.trim())
      .filter((s) => s.length > 2);
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
        parts.push({
          text: piece,
          keys: [],
          note: `${label("productPlace")} is already ${/lower/.test(t) ? "Low" : "High"}`,
        });
      } else if (/(soft|hard)/.test(t) && has("softness")) {
        const from = Number(d.variables.softness);
        const to = Math.max(0, Math.min(100, from + (/soft/.test(t) ? 20 : -20)));
        parts.push({
          text: piece,
          keys: [],
          note:
            /shadow/.test(t) && !has("shadow") ? `${mode.name} has no shadow of its own; the light sets it` : undefined,
          suggestion: to !== from ? { key: "softness", label: label("softness"), from, to } : undefined,
        });
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
      id: m.nextId("rv"),
      number: n,
      image: img(pool[n % pool.length], fmt),
      at: now(),
      by: m.me().id,
      state: "rendering",
      variables: structuredClone(d.variables),
      specs: structuredClone(d.specs),
      cost: 0.12 * Math.max(1, d.specs.count),
      evaluation: { productTruth: "pass", brandRules: "pass", artefacts: "none", notes: [] },
      instruction,
    };
    d.versions.push(v);
    touch(d);
    setTimeout(() => {
      v.state = "done";
      if (n % 3 === 0)
        v.evaluation = {
          productTruth: "pass",
          brandRules: "pass",
          artefacts: "minor",
          notes: ["A soft edge on the label"],
        };
      d.pickedVersionId = v.id;
      touch(d);
    }, m.latency * 14);
  }

  /** A document opened from a creative, a candidate, or empty. */
  async function openPlain(input: Parameters<FumeApi["openDocument"]>[0]): Promise<CreativeDocument> {
    m.mustStaff();
    if (input.creativeId) {
      const existing = db.documents.find((d) => d.creativeId === input.creativeId);
      if (existing) return wait(existing);
    }
    // A candidate opens the one document that holds it, made once with the candidate as V1.
    if (input.fromGenerationId) {
      const held = fromCandidate.get(input.fromGenerationId);
      const existing = held && db.documents.find((d) => d.id === held);
      if (existing) return wait(existing);
      const session = db.sessions.find((s) => s.generations.some((g) => g.id === input.fromGenerationId));
      const g = session?.generations.find((x) => x.id === input.fromGenerationId);
      if (g && session) {
        const modeId = g.recipe.mode === "type" ? "m-scene" : "m-free";
        const mode = m.find(db.modes, modeId, "mode");
        const specs = {
          format: g.recipe.format,
          count: 1,
          imageModel: g.recipe.route?.model ?? "Nano Banana Pro",
          referenceIds: [],
          modelIds: [],
          productId: g.recipe.productId ?? (mode.uses.includes("product") ? "pr-oil" : undefined),
          variantId: g.recipe.variantId,
        };
        const variables = defaults(mode.id);
        const campaign = db.campaigns.find((c) => c.id === (input.campaignId ?? session.campaignId));
        const d: CreativeDocument = {
          id: m.nextId("doc"),
          workspaceId: input.workspaceId,
          campaignId: campaign?.id,
          title: session.slot ?? (campaign ? `${campaign.name} · candidate ${g.branch}` : `Candidate ${g.branch}`),
          slot: session.slot,
          studio: "render",
          modeId: mode.id,
          variables,
          specs,
          overrides: [],
          layers: [],
          edits: [],
          state: "draft",
          by: m.me().id,
          updatedAt: now(),
          versions: [
            {
              id: m.nextId("rv"),
              number: 1,
              image: g.image,
              at: g.at,
              by: m.me().id,
              state: "done",
              variables,
              specs,
              evaluation: g.evaluation,
              instruction: "The Engine's candidate, opened from its run",
              cost: g.cost,
            },
          ],
        };
        d.pickedVersionId = d.versions[0].id;
        db.documents.push(d);
        fromCandidate.set(g.id, d.id);
        return wait(d);
      }
    }
    // A campaign's free session opens again while it is still empty, so pressing twice makes one document.
    if (!input.creativeId) {
      const empty = db.documents.find(
        (d) =>
          d.workspaceId === input.workspaceId &&
          d.campaignId === input.campaignId &&
          d.slot === input.slot &&
          d.modeId === input.modeId &&
          d.versions.length === 0 &&
          d.by === m.me().id,
      );
      if (empty) return wait(empty);
    }
    const mode = m.find(db.modes, input.modeId, "mode");
    const d: CreativeDocument = {
      id: m.nextId("doc"),
      workspaceId: input.workspaceId,
      campaignId: input.campaignId,
      creativeId: input.creativeId,
      title:
        input.title ??
        (mode.output === "model" ? "New model" : mode.output === "reference" ? "New reference" : "Untitled creative"),
      slot: input.slot,
      studio: input.studio,
      modeId: mode.id,
      variables: defaults(mode.id),
      // No product is picked unless it was started from one, from its campaign (the campaign's first product) or from
      // a creative (the demo's creatives are Night Body Oil).
      specs: {
        format: mode.output === "creative" ? "feed" : "square",
        count: mode.output === "creative" ? 4 : 2,
        imageModel: "Nano Banana Pro",
        referenceIds: [],
        modelIds: [],
        productId: mode.uses.includes("product")
          ? (input.productId ??
            (input.campaignId ? db.campaigns.find((c) => c.id === input.campaignId)?.productIds[0] : undefined) ??
            (input.creativeId ? "pr-oil" : undefined))
          : undefined,
      },
      overrides: [],
      layers: [],
      versions: [],
      edits: [],
      ...(input.studio === "video" ? { video: startEdit(undefined, m.nextId) } : {}),
      state: "draft",
      by: m.me().id,
      updatedAt: now(),
    };
    db.documents.push(d);
    return wait(d);
  }

  return {
    // ── Sessions ──
    async studioKit(workspaceId) {
      m.mustStaff();
      return wait({
        creativeTypes: db.creativeTypes,
        cast: db.cast.filter((c) => !c.workspaceId || c.workspaceId === workspaceId),
        scenes: db.scenes.filter((s) => s.workspaceId === workspaceId),
        products: db.products.filter((p) => p.workspaceId === workspaceId),
        references: db.boards
          .filter((b) => b.workspaceId === workspaceId)
          .flatMap((b) => b.items.filter((i) => i.image && i.verdict !== "disliked").map((i) => i.image!)),
      });
    },
    async studioSession(sessionId) {
      m.mustStaff();
      return wait(sessionOf(sessionId));
    },
    async openStudio({ workspaceId, campaignId, slot, fromGenerationId }) {
      m.mustStaff();
      const from = fromGenerationId
        ? db.sessions.flatMap((s) => s.generations).find((g) => g.id === fromGenerationId)
        : undefined;
      const s: StudioSession = {
        id: m.nextId("ss"),
        workspaceId,
        campaignId,
        slot,
        recipe: from
          ? structuredClone(from.recipe)
          : { mode: "free", castIds: [], references: [], format: "feed", count: 4 },
        generations: from ? [{ ...structuredClone(from), id: m.nextId("g"), state: "candidate", branch: 1 }] : [],
        by: m.me().id,
        updatedAt: now(),
      };
      db.sessions.unshift(s);
      return wait(s);
    },
    async generate(sessionId, recipe) {
      m.mustStaff();
      const s = sessionOf(sessionId);
      s.recipe = recipe;
      const branch = Math.max(0, ...s.generations.map((g) => g.branch)) + 1;
      const tiles = ["05-06", "04-02", "08-06", "03-05", "05-03", "09-13"];
      const made: Generation[] = Array.from({ length: Math.min(recipe.count, 6) }, (_, i) => ({
        id: m.nextId("g"),
        sessionId,
        branch,
        image: img(tiles[(i + branch) % tiles.length], recipe.format),
        recipe: structuredClone(recipe),
        evaluation: {
          productTruth: i === 1 ? "flag" : "pass",
          brandRules: "pass",
          artefacts: i === 2 ? "minor" : "none",
          notes: i === 1 ? ["Label edge soft"] : [],
        },
        cost: 0.12,
        state: "making",
        at: now(),
      }));
      s.generations.push(...made);
      s.updatedAt = now();
      made.forEach((g, i) => {
        const t = setTimeout(
          () => {
            g.state = "candidate";
            m.emit({ type: "generation.state", generation: structuredClone(g) });
          },
          900 * (i + 1),
        );
        (t as unknown as { unref?: () => void }).unref?.();
      });
      return wait(s);
    },
    async repair(sessionId, generationId, what) {
      m.mustStaff();
      const s = sessionOf(sessionId);
      const from = m.find(s.generations, generationId, "generation");
      const branch = Math.max(...s.generations.map((g) => g.branch)) + 1;
      const g: Generation = {
        ...structuredClone(from),
        id: m.nextId("g"),
        branch,
        state: "making",
        repair: what,
        at: now(),
        evaluation: { ...from.evaluation, productTruth: "pass", notes: [] },
      };
      s.generations.push(g);
      const t = setTimeout(() => {
        g.state = "candidate";
        m.emit({ type: "generation.state", generation: structuredClone(g) });
      }, 1200);
      (t as unknown as { unref?: () => void }).unref?.();
      return wait(s);
    },
    async pickGeneration(sessionId, generationId) {
      m.mustStaff();
      const s = sessionOf(sessionId);
      for (const g of s.generations) if (g.state === "picked") g.state = "candidate";
      m.find(s.generations, generationId, "generation").state = "picked";
      s.pickedId = generationId;
      return wait(s);
    },
    async sendToCheck(sessionId) {
      m.mustStaff();
      const s = sessionOf(sessionId);
      const g = s.generations.find((x) => x.id === s.pickedId);
      if (!g) throw new FumeError("conflict", "Pick a generation first.");
      g.state = "sent_to_check";
      s.updatedAt = now();
      return wait(s);
    },

    // ── Documents ──
    async studioModes() {
      return wait(db.modes);
    },
    async documents(workspaceId) {
      m.mustStaff();
      return wait(
        db.documents
          .filter((d) => d.workspaceId === workspaceId)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      );
    },
    async document(id) {
      m.mustStaff();
      return wait(doc(id));
    },
    // A creative of an Engine chat run opens as one document, with the Engine's picture as V1; the same document each
    // time, from the chat, Check or the Studio. It takes its creative's name in Check, so both say the same.
    async openDocument(input) {
      const run = input.creativeId ? /^(.+)-c(\d+)$/.exec(input.creativeId) : null;
      const b = run ? db.batches.find((x) => x.id === run[1]) : undefined;
      if (!(b && run && !db.documents.some((d) => d.creativeId === input.creativeId))) return openPlain(input);
      m.mustStaff();
      const i = Number(run[2]) - 1;
      const opened = await openPlain({
        workspaceId: b.workspaceId,
        studio: "render",
        modeId: b.modeId,
        campaignId: b.campaignId || undefined,
        creativeId: input.creativeId,
      });
      const d = db.documents.find((x) => x.id === opened.id)!;
      const product = db.products.find((p) => p.id === b.productIds[Math.floor(i / b.perProduct)]);
      const label = b.format === "square" ? "Square" : b.format === "story" ? "Story" : "Feed";
      const named = db.qaItems.find((q) => q.creativeId === input.creativeId)?.title;
      d.title = named ?? `${product?.name ?? "Packshot"} · ${label} ${i + 1}`;
      d.slot = d.title;
      d.specs = { ...d.specs, format: b.format, productId: product?.id ?? d.specs.productId };
      if (!d.versions.length) {
        const image = b.previews[i % Math.max(1, b.previews.length)];
        d.versions.push({
          id: m.nextId("rv"),
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
      const inCheck = db.qaItems.find((q) => q.creativeId === input.creativeId);
      if (inCheck && !inCheck.documentId) inCheck.documentId = d.id;
      touch(d);
      return wait(d);
    },
    async updateDocument(id, change) {
      m.mustStaff();
      const d = doc(id);
      if (change.modeId && change.modeId !== d.modeId) {
        const mode = m.find(db.modes, change.modeId, "mode");
        // What the new mode has no use for is set aside on the document, and comes back on a switch back.
        const held = d as typeof d & { aside?: Variables };
        const fits = ([k]: [string, unknown]) => mode.variables.some((v) => v.key === k);
        const aside = {
          ...held.aside,
          ...Object.fromEntries(Object.entries(d.variables).filter((e) => !fits(e))),
        } as Variables;
        d.modeId = mode.id;
        d.studio = mode.studio;
        d.variables = {
          ...defaults(mode.id),
          ...Object.fromEntries(Object.entries(aside).filter(fits)),
          ...Object.fromEntries(Object.entries(d.variables).filter(fits)),
        };
        held.aside = Object.fromEntries(Object.entries(aside).filter((e) => !fits(e))) as Variables;
      }
      if (change.variables) d.variables = { ...d.variables, ...change.variables };
      if (change.specs) d.specs = { ...d.specs, ...change.specs };
      if (change.layers) d.layers = change.layers;
      if (change.studio) d.studio = change.studio;
      // Into Video from a picture: the picked render becomes the first shot's start frame (FLOWS §27.1).
      if (d.studio === "video" && !d.video) d.video = startEdit(picked(d)?.image, m.nextId);
      // The takes, the Engine's asks and the formats' progress are the backend's; the edit around them is hers.
      if (change.video) {
        const was = d.video;
        const takesOf = new Map(was?.clips.map((c) => [c.id, c.takes]));
        const stateOf = new Map(was?.formats.map((f) => [f.id, f.state]));
        const next = change.video;
        d.video = withChecks({
          ...next,
          clips: next.clips.map((c) => ({ ...c, takes: takesOf.get(c.id) ?? c.takes })),
          formats: next.formats.map((f) => {
            if (f.id === next.formatId) return { ...f, state: "this" as const };
            const s = stateOf.get(f.id);
            return { ...f, state: !s || s === "this" ? ("planned" as const) : s };
          }),
          edits: was?.edits ?? next.edits,
        });
      }
      if (change.title) d.title = change.title;
      // A campaign has its own look: the look sources start over, so a campaign with a look of its own leads every
      // look section.
      if ("campaignId" in change && change.campaignId !== d.campaignId) {
        if (change.campaignId) m.find(db.campaigns, change.campaignId, "campaign");
        d.campaignId = change.campaignId;
        d.sources = {};
      }
      touch(d);
      return wait(d);
    },
    async makeShot(id, input) {
      m.mustStaff();
      const d = doc(id);
      if (!d.video) throw new FumeError("invalid", "This creative is not a video.");
      if (input.takes < 1 || input.takes > 4) throw new FumeError("invalid", "Make one to four takes.");
      let clip = input.clipId ? m.find(d.video.clips, input.clipId, "shot") : undefined;
      if (!clip) {
        clip = {
          id: m.nextId("vc"),
          name: input.name ?? `Shot ${d.video.clips.length + 1}`,
          source: "engine",
          takes: [],
          in: 0,
          out: input.recipe.seconds,
          speed: 1,
          transition: d.video.clips.length ? "dissolve" : "cut",
        };
        d.video.clips.push(clip);
      }
      clip.recipe = structuredClone(input.recipe);
      const made = newTakes(clip, input.recipe, input.takes, m.nextId);
      clip.takes.push(...made.takes);
      d.video = withChecks(d.video);
      touch(d);
      const clipId = clip.id;
      later(() => {
        if (!d.video) return;
        made.ready(d.video.clips);
        const now = d.video.clips.find((c) => c.id === clipId);
        if (now && !now.pickedTakeId) now.pickedTakeId = made.takes[0]!.id;
        d.video = withChecks(d.video);
        touch(d);
      }, 30);
      return wait(d);
    },
    async adaptVideo(id, formatIds) {
      m.mustStaff();
      const d = doc(id);
      if (!d.video) throw new FumeError("invalid", "This creative is not a video.");
      const pick = new Set(formatIds);
      d.video.formats = d.video.formats.map((f) =>
        pick.has(f.id) && f.state !== "this" ? { ...f, state: "making" } : f,
      );
      touch(d);
      later(() => {
        if (!d.video) return;
        d.video.formats = d.video.formats.map((f) => (f.state === "making" ? { ...f, state: "ready" } : f));
        touch(d);
      }, 40);
      return wait(d);
    },
    async engineEdit(id, text) {
      m.mustStaff();
      const d = doc(id);
      if (d.studio === "video" && d.video) {
        if (!text.trim()) throw new FumeError("invalid", "Say what to change.");
        d.video.edits = [
          ...d.video.edits.map((e) => (e.state === "proposed" ? { ...e, state: "undone" as const } : e)),
          readVideoAsk(d, text, m.nextId, m.me().id),
        ];
        touch(d);
        return wait(d);
      }
      const edit: EngineEdit = {
        id: m.nextId("ed"),
        text,
        ...readParts(d, text),
        by: m.me().id,
        at: now(),
        state: "proposed",
      };
      d.edits.push(edit);
      for (const c of edit.changes) d.variables[c.key] = c.to;
      touch(d);
      return wait(d);
    },
    async decideEdit(id, editId, verdict) {
      m.mustStaff();
      const d = doc(id);
      const asked = d.video?.edits.find((e) => e.id === editId);
      if (d.video && asked) {
        asked.state = verdict === "keep" ? "kept" : "undone";
        const takesOf = new Map(d.video.clips.map((c) => [c.id, { takes: c.takes, pickedTakeId: c.pickedTakeId }]));
        const after = { ...asked.after, clips: asked.after.clips.map((c) => ({ ...c, ...takesOf.get(c.id) })) };
        d.video = withChecks(verdict === "keep" ? { ...d.video, ...after } : d.video);
        touch(d);
        return wait(d);
      }
      const edit = m.find(d.edits, editId, "edit");
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
      m.mustStaff();
      const d = doc(id);
      startRender(d);
      return wait(d);
    },
    async pickVersion(id, versionId) {
      m.mustStaff();
      const d = doc(id);
      const v = m.find(d.versions, versionId, "version");
      d.pickedVersionId = v.id;
      d.variables = structuredClone(v.variables);
      touch(d);
      return wait(d);
    },
    async addVersion(id, file, note) {
      m.mustStaff();
      const d = doc(id);
      if (!note.trim()) throw new FumeError("invalid", "Say how the picture was made.");
      const v: RenderVersion = {
        id: m.nextId("rv"),
        number: d.versions.length + 1,
        image: URL.createObjectURL(file),
        at: now(),
        by: m.me().id,
        state: "done",
        variables: structuredClone(d.variables),
        specs: structuredClone(d.specs),
        cost: 0,
        evaluation: { productTruth: "pass", brandRules: "pass", artefacts: "none", notes: [] },
        instruction: `Made by hand: ${note.trim()}`,
      };
      d.versions.push(v);
      d.pickedVersionId = v.id;
      touch(d);
      return wait(d);
    },
    async overrideProduct(id, { field, value, scope }) {
      m.mustStaff();
      const d = doc(id);
      const product = d.specs.productId ? db.products.find((p) => p.id === d.specs.productId) : undefined;
      if (!product) throw new FumeError("invalid", "Pick a product first.");
      const fact = product.facts.find((f) => f.label === field);
      d.overrides = d.overrides.filter((o) => !(o.field === field && o.scope === scope && o.state !== "approved"));
      d.overrides.push({
        id: m.nextId("ov"),
        productId: product.id,
        field,
        value,
        was: fact?.statement ?? "",
        scope,
        by: m.me().id,
        at: now(),
        state: scope === "product" ? "proposed" : "applied",
      });
      touch(d);
      return wait(d);
    },
    // The version sent lands in Check. A creative opened from Check takes the new picture there and waits again
    // ("Version 2 from the Studio · Anna, 14:32"), with the old one kept for Before | After; a document that is not in
    // Check yet comes in as a new creative to check, and one with no campaign lands in "Product page".
    async documentToCheck(id) {
      m.mustStaff();
      const d = doc(id);
      if (!d.pickedVersionId) throw new FumeError("invalid", "Pick a version first.");
      const docState = d.state;
      d.state = "in_check";
      touch(d);
      const version = d.versions.find((v) => v.id === d.pickedVersionId)!;
      const item = db.qaItems.find((i) => i.documentId === d.id);
      const by = { sentBy: m.me().id, sentAt: now() };
      if (item) {
        beforeSend.set(d.id, { itemId: item.id, was: structuredClone(item), added: false, docState });
        const shown = item.version ?? 1;
        if (version.image !== item.image)
          Object.assign(item, {
            previous: { image: item.image, version: shown },
            image: version.image,
            version: Math.max(version.number, shown + 1),
          });
        Object.assign(item, by, {
          state: "waiting",
          evaluation: version.evaluation,
          format: d.specs.format,
          checkedBy: undefined,
          checkedAt: undefined,
          studioBy: undefined,
          studioAt: undefined,
          layers: d.studio === "design" ? structuredClone(d.layers) : item.layers,
        });
        m.emit({ type: "qa.state", item: structuredClone(item) });
      } else {
        const campaign = db.campaigns.find((c) => c.id === d.campaignId);
        const added: QaItem = {
          id: m.nextId("qa"),
          workspaceId: d.workspaceId,
          campaignId: d.campaignId ?? "",
          creativeId: d.creativeId ?? `cr-${d.id}`,
          documentId: d.id,
          title: d.title,
          slot: d.slot ?? d.title,
          studio: d.studio,
          image: version.image,
          format: d.specs.format,
          madeAt: version.at,
          dueAt: campaign?.dueAt ?? now(),
          risk: "normal",
          state: "waiting",
          evaluation: version.evaluation,
          feedback: [],
          version: version.number,
          layers: d.studio === "design" ? structuredClone(d.layers) : undefined,
          ...by,
        };
        db.qaItems.push(added);
        beforeSend.set(d.id, { itemId: added.id, added: true, docState });
        m.emit({ type: "qa.state", item: structuredClone(added) });
      }
      return wait(d);
    },
    async undoDocumentToCheck(id) {
      m.mustStaff();
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
      if (left) m.emit({ type: "qa.state", item: structuredClone(left) });
      return wait(d);
    },

    // ── Placements and Make formats ──
    async placements() {
      return wait(db.placements);
    },
    // Narrower than the source: the subject fits, so it is cropped. Wider or much taller: the Engine extends the scene.
    async makeFormats(documentId, placementIds) {
      m.mustStaff();
      const d = doc(documentId);
      const source = picked(d);
      if (!source) throw new FumeError("invalid", "Render and pick a version first.");
      const from =
        db.placements.find((p) => p.id === d.specs.placementId) ??
        db.placements.find((p) => p.format === d.specs.format)!;
      d.formats = placementIds.map((id): FormatTile => {
        const p = m.find(db.placements, id, "placement");
        const a = ratioOf(p.ratio);
        const b = ratioOf(from.ratio);
        const same = Math.abs(a - b) < 0.01;
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
            m.find(db.placements, t.placementId, "placement").format,
          );
        }
        touch(d);
      }, 14);
      return wait(d);
    },
    async setFormatTile(documentId, placementId, change) {
      m.mustStaff();
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
    async fixProduct(documentId, { versionId, tokenId, region, what }) {
      m.mustStaff();
      const d = doc(documentId);
      const v = m.find(d.versions, versionId, "version");
      const token = tokenId ? m.find(db.detailTokens, tokenId, "detail") : undefined;
      const findOn = token ? v.details?.find((f) => f.tokenId === token.id) : undefined;
      const fix = {
        id: m.nextId("fx"),
        tokenId,
        region: findOn?.region ?? region ?? token?.region ?? { x: 0.4, y: 0.4, w: 0.2, h: 0.2 },
        found: findOn?.read ?? what ?? "The brushed area",
        expected: token?.value ?? what ?? "As described",
        auto: false,
        by: m.me().id,
        at: now(),
        state: "fixing" as "fixing" | "fixed",
        versionId: undefined as Id | undefined,
      };
      d.fixes = [...(d.fixes ?? []), fix];
      touch(d);
      later(() => {
        const n: RenderVersion = {
          ...structuredClone(v),
          id: m.nextId("rv"),
          number: d.versions.length + 1,
          at: now(),
          by: m.me().id,
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
      m.mustStaff();
      const d = doc(documentId);
      d.sources = { ...(d.sources ?? {}), [section]: source };
      touch(d);
      return wait(d);
    },

    // ── The brand's presets, models and references ──
    async brandAssets(workspaceId) {
      const ws = workspaceId ?? m.workspaceId;
      const staff = Boolean(m.me().staffRole);
      return wait({
        presets: db.presets.filter((p) => p.workspaceId === ws),
        // The customer sees what Fume saved for them, never a designer's drafts.
        models: db.models.filter((x) => x.workspaceId === ws && (staff || x.state !== "draft")),
        references: db.brandReferences.filter((r) => r.workspaceId === ws && (staff || r.state === "saved")),
        footage: footage.filter((f) => f.workspaceId === ws),
      });
    },
    async saveModel({ documentId, name, state }) {
      m.mustStaff();
      const d = doc(documentId);
      const version = d.versions.find((v) => v.id === d.pickedVersionId) ?? d.versions.at(-1);
      if (!version) throw new FumeError("invalid", "Render the model first.");
      let model = db.models.find((x) => x.documentId === documentId);
      const v = d.variables;
      const look = [`${v.age ?? ""}s`.replace(/^(\d)\d/, "$10"), v.hairTexture, "hair"].filter(Boolean).join(", ");
      if (!model) {
        model = {
          id: m.nextId("bm"),
          workspaceId: d.workspaceId,
          name,
          image: version.image,
          sheet: d.versions
            .filter((x) => x.state === "done")
            .slice(-3)
            .map((x) => x.image),
          variables: structuredClone(v),
          look,
          state,
          isAiPerson: true,
          madeBy: m.me().id,
          at: now(),
          usedIn: 0,
          documentId,
        };
        db.models.push(model);
      } else Object.assign(model, { name, image: version.image, variables: structuredClone(v), state });
      if (state === "saved") model.savedBy = m.me().id;
      d.title = name;
      return wait(model);
    },
    async decideModel(modelId, verdict) {
      m.mustApprove();
      const model = m.find(db.models, modelId, "model");
      if (model.state === "draft") throw new FumeError("invalid", "Fume has not saved this model yet.");
      Object.assign(model, { state: verdict === "approve" ? "approved" : "declined", decidedBy: m.me().id });
      return wait(model);
    },
    async saveReference({ documentId, name, state }) {
      m.mustStaff();
      const d = doc(documentId);
      const version = d.versions.find((v) => v.id === d.pickedVersionId) ?? d.versions.at(-1);
      if (!version) throw new FumeError("invalid", "Render the reference first.");
      let r = db.brandReferences.find((x) => x.documentId === documentId);
      if (!r) {
        r = {
          id: m.nextId("rf"),
          workspaceId: d.workspaceId,
          name,
          image: version.image,
          origin: "made",
          state,
          madeBy: m.me().id,
          at: now(),
          documentId,
        };
        db.brandReferences.push(r);
      } else Object.assign(r, { name, image: version.image, state });
      d.title = name;
      return wait(r);
    },
    async productProposals(productId) {
      const ws = m.workspaceId;
      return wait(
        db.documents
          .filter((d) => d.workspaceId === ws)
          .flatMap((d) => d.overrides.filter((o) => o.scope === "product" && o.productId === productId)),
      );
    },
    async decideOverride(overrideId, verdict) {
      m.mustApprove();
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
  };
}
