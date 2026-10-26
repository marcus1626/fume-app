// The Brand DNA: what Fume read (the first reading and "Update the brand"), the board of colours, type, logos, voice
// and imagery with Fume's proposals, the rules, the moodboards, taste and the onboarding's progress.
import {
  FumeError,
  type Board,
  type BrandBoardView,
  type BrandRule,
  type BrandScan,
  type BrandUpdate,
  type Campaign,
  type FumeApi,
  type Id,
  type IdentityKind,
  type OnboardingStepId,
  type Provenance,
  type TasteArea,
  type TasteCard,
} from "../contract";
import type { Mock } from "./context";
import { brandUpdate, firstScan, zipSources } from "./seed";

type Calls =
  | "brandDna"
  | "updateRule"
  | "addRule"
  | "addReference"
  | "chooseTastePair"
  | "answerUnderstanding"
  | "approveBrandDna"
  | "uploadSourceAssets"
  | "startBrandScan"
  | "brandScan"
  | "brandBoard"
  | "decide"
  | "setColourUses"
  | "moveImage"
  | "decideVoicePart"
  | "boards"
  | "board"
  | "addBoardItem"
  | "updateBoardItem"
  | "removeBoardItem"
  | "startMoodboard"
  | "tasteTraining"
  | "answerTaste"
  | "passTastePair"
  | "startBrandUpdate"
  | "brandUpdate"
  | "decideBrandFound"
  | "approveBrandUpdate"
  | "onboardingProgress"
  | "saveOnboardingProgress";

/** A campaign moodboard started on the spot (the manual brief, the campaign's Moodboard tab): the pictures in rows of
 *  three, liked by whoever started it. The campaign gets the board's id. */
export function startCampaignBoard(m: Mock, campaign: Campaign, images: string[]): Board {
  const id = m.nextId("bd");
  const me = m.me();
  const at = m.now();
  const provenance: Provenance = { origin: me.staffRole ? "fume" : "customer", state: "approved", by: me.id, at };
  const rows = Math.max(1, Math.ceil(images.length / 3));
  const board: Board = {
    id,
    workspaceId: campaign.workspaceId,
    kind: "campaign_moodboard",
    campaignId: campaign.id,
    name: `${campaign.name} moodboard`,
    width: 1100,
    height: 80 + rows * 405,
    updatedAt: at,
    items: images.map((image, i) => ({
      id: m.nextId("bi"),
      boardId: id,
      kind: "image" as const,
      x: 40 + (i % 3) * 340,
      y: 40 + Math.floor(i / 3) * 405,
      w: 300,
      h: 375,
      image,
      verdict: "liked" as const,
      provenance,
    })),
  };
  m.db.boards.push(board);
  campaign.boardId = id;
  campaign.updatedAt = at;
  return board;
}

/** One page or file per tick: the current one is read, the next one opens; after the last, done. */
function step(sources: BrandScan["sources"]): string | undefined {
  const current = sources.find((s) => s.state === "reading");
  if (current) current.state = "read";
  const next = sources.find((s) => s.state === "waiting");
  if (!next) return undefined;
  next.state = "reading";
  return `Reading ${next.label}`;
}

const steps: OnboardingStepId[] = ["", "scan", "review", "taste"];
const parts = ["logo", "colour", "type", "imagery", "voice"];

const lessons: Record<TasteArea, string> = {
  light: "Low, warm side light over flat front light.",
  colour: "Warm neutrals; blue only as a quiet accent.",
  people: "Calm, unposed, skin that looks like skin.",
  composition: "The product low, with air above it.",
  styling: "Natural fabrics: linen and wool, nothing shiny.",
};
const sentence = (reason: string) => `${reason.charAt(0).toUpperCase()}${reason.slice(1).replace(/\.?$/, ".")}`;

export function brandCalls(m: Mock): Pick<FumeApi, Calls> {
  const { db, wait } = m;
  /** Answers with the state as it is now, not as it is when the answer arrives. */
  const asNow = <T>(value: T) => wait(structuredClone(value));
  /** Taste cards already answered, by id: a reason, or a changed answer after "Back one", can follow the pick. */
  const answeredTaste = new Map<Id, TasteCard>();

  const decided = (p: Provenance, verdict: "keep" | "change" | "remove", was?: string): Provenance => ({
    ...p,
    state: verdict === "keep" ? "approved" : verdict === "change" ? "changed" : "removed",
    by: m.me().id,
    at: m.now(),
    ...(verdict === "change" && was !== undefined ? { was } : {}),
  });
  /** The board, with the voice in its five parts. */
  function board(): BrandBoardView {
    const id = db.identity;
    const all = [...id.colours, ...id.typefaces, ...id.logos, ...id.voice, ...id.imagery].map((x) => x.provenance);
    const moodboard = db.boards.find((b) => b.workspaceId === m.workspaceId && b.kind === "brand_moodboard")!;
    const open =
      all.filter((p) => p.state === "proposed").length +
      moodboard.items.filter((i) => i.provenance.state === "proposed").length;
    return { dna: db.brandDna, identity: { ...id, voiceBook: db.voiceBook }, rules: db.rules, moodboard, open };
  }

  /** The Engine reads one page or file per tick and lets the finds land one by one. */
  function playScan(scan: BrandScan) {
    scan.reading = step(scan.sources);
    const timer = setInterval(() => {
      scan.reading = step(scan.sources);
      if (!scan.reading) {
        scan.state = "done";
        clearInterval(timer);
      }
      m.emit({ type: "scan.progress", scan: structuredClone(scan) });
    }, 1200);
    (timer as unknown as { unref?: () => void }).unref?.();
  }
  function playUpdate(update: BrandUpdate) {
    update.reading = step(update.sources);
    const timer = setInterval(() => {
      update.reading = step(update.sources);
      if (!update.reading) {
        update.state = "ready";
        clearInterval(timer);
      }
    }, 900);
    (timer as unknown as { unref?: () => void }).unref?.();
  }
  const currentUpdate = (id: Id) => {
    const u = db.brandUpdate;
    if (!u || u.id !== id) throw new FumeError("not_found", `No brand update ${id}`);
    return u;
  };
  /** Keep or fix writes the find into the Brand DNA as the customer's decision. */
  function apply(update: BrandUpdate, foundId: Id, value?: string) {
    const f = update.found.find((x) => x.id === foundId);
    if (!f) throw new FumeError("not_found", `No find ${foundId}`);
    const id = db.identity;
    const prov: Provenance = { origin: "engine", state: "approved", by: m.me().id, at: m.now(), evidence: f.source };
    if (f.kind === "image") {
      (f.images ?? (f.image ? [f.image] : [])).forEach((src, i) =>
        id.imagery.push({
          id: m.nextId("im"),
          image: src,
          caption: `${value ?? f.title}, ${i + 1}`,
          provenance: { ...prov },
        }),
      );
    } else if (f.kind === "colour" && f.targetId) {
      const c = id.colours.find((x) => x.id === f.targetId);
      if (c) {
        const was = c.hex;
        c.hex = value ?? f.after ?? c.hex;
        c.provenance = { ...prov, state: "changed", was };
      }
    } else if (f.kind === "typeface" && f.targetId) {
      const t = id.typefaces.find((x) => x.id === f.targetId);
      if (t) {
        const was = t.name;
        t.name = value ?? f.after ?? t.name;
        t.provenance = { ...prov, state: "changed", was };
      }
    } else if (f.kind === "voice") {
      id.voice.push({
        id: m.nextId("vo"),
        statement: value ?? f.after ?? f.title,
        example: (f.subtitle ?? "").replace(/^“|”$/g, ""),
        provenance: prov,
      });
    }
    f.decision = value !== undefined ? "fixed" : "kept";
  }
  /** An update applied is the Brand DNA's next version. */
  function applied(update: BrandUpdate) {
    update.state = "applied";
    update.appliedAt = m.now();
    update.appliedBy = m.me().id;
    db.brandDna.version += 1;
    db.brandDna.approvedAt = m.now();
    db.brandDna.approvedBy = m.me().id;
  }

  return {
    async brandDna() {
      return wait({
        dna: db.brandDna,
        rules: db.rules,
        products: m.inWorkspace(db.products),
        references: db.references,
        tastePairs: db.tastePairs,
        memory: db.memory,
        assets: db.assets,
        understanding: db.understanding,
      });
    },
    async updateRule(rule) {
      const i = db.rules.findIndex((r) => r.id === rule.id);
      if (i < 0) throw new FumeError("not_found", "No such rule");
      db.rules[i] = { ...rule, source: "verified" };
      return wait(db.rules[i]);
    },
    async addRule(input) {
      const rule: BrandRule = { ...input, id: m.nextId("r"), source: "supplied", confidence: "high" };
      db.rules.push(rule);
      return wait(rule);
    },
    async addReference(input) {
      const r = { id: m.nextId("ref"), addedBy: m.userId, ...input };
      db.references.push(r);
      return wait(r);
    },
    async chooseTastePair(pairId, chosen, reason) {
      const p = m.find(db.tastePairs, pairId, "pair");
      Object.assign(p, { chosen, reason });
      return wait(p);
    },
    async answerUnderstanding(input) {
      const u = db.understanding;
      if (input.unknownId) Object.assign(m.find(u.unknowns, input.unknownId, "question"), { answer: input.answer });
      if (input.directionId)
        Object.assign(m.find(u.testDirections, input.directionId, "direction"), {
          verdict: input.verdict,
          reason: input.reason,
        });
      return wait(u);
    },
    async approveBrandDna() {
      m.mustApprove();
      Object.assign(db.brandDna, {
        state: "approved",
        version: db.brandDna.version + 1,
        approvedBy: m.userId,
        approvedAt: m.now(),
      });
      return wait(db.brandDna);
    },
    async uploadSourceAssets(files) {
      const added = files.map((f) => ({ id: m.nextId("a"), uploadedBy: m.userId, at: m.now(), ...f }));
      db.assets.push(...added);
      return wait(added);
    },

    // ── The first reading: the website's pages one by one, brand and products together ──
    async startBrandScan(input) {
      const base = structuredClone(firstScan);
      const files = (input.files ?? []).map((f, i) => ({
        id: `sf${i}`,
        label: f.name,
        kind: "file" as const,
        state: "waiting" as const,
      }));
      const pages = input.source === "upload" ? [] : base.sources;
      const sources = [...pages, ...files];
      const finds =
        input.source === "upload"
          ? base.finds.map((f, i) => ({
              ...f,
              origin: "customer" as const,
              sourceId: files[i % Math.max(1, files.length)]?.id,
              evidence: files[i % Math.max(1, files.length)]?.label ?? f.evidence,
            }))
          : base.finds;
      const scan: BrandScan = {
        ...base,
        id: m.nextId("scan"),
        source: input.source,
        url: input.source === "upload" ? undefined : (input.url ?? base.url),
        files: files.map((f) => f.label),
        sources: sources.length ? sources : base.sources,
        finds,
      };
      db.scan = scan;
      playScan(scan);
      return asNow(scan);
    },
    async brandScan() {
      return asNow(db.scan);
    },

    // ── The board ──
    async brandBoard() {
      return wait(board());
    },
    async decide({ kind, id, verdict, value }) {
      m.mustApprove();
      const lists: Partial<Record<IdentityKind, { id: Id; provenance: Provenance }[]>> = {
        colour: db.identity.colours,
        typeface: db.identity.typefaces,
        logo: db.identity.logos,
        voice: db.identity.voice,
        image: db.identity.imagery,
        collection: db.collections,
        board_item: db.boards.flatMap((b) => b.items),
      };
      const list = lists[kind];
      if (!list) throw new FumeError("invalid", `Nothing to decide for ${kind}`);
      const target = m.find(list as { id: Id; provenance: Provenance }[], id, kind) as {
        id: Id;
        provenance: Provenance;
        hex?: string;
        statement?: string;
        name?: string;
      };
      let was: string | undefined;
      if (verdict === "change" && value !== undefined) {
        if ("hex" in target && target.hex !== undefined) {
          was = target.hex;
          target.hex = value;
        } else if ("statement" in target && target.statement !== undefined) {
          was = target.statement;
          target.statement = value;
        } else if ("name" in target && target.name !== undefined) {
          was = target.name;
          target.name = value;
        }
      }
      target.provenance = decided(target.provenance, verdict, was);
      return wait(board());
    },
    // Each colour's uses (Buttons, Accent, Backgrounds …), set as chips.
    async setColourUses({ colourId, uses }) {
      const c = db.identity.colours.find((x) => x.id === colourId);
      if (!c) throw new FumeError("not_found", `No colour ${colourId}`);
      c.uses = [...uses];
      return asNow(c);
    },
    // The pictures Fume found sit in groups (Your look, Campaign looks, Product shots, Not used); she moves one.
    async moveImage({ imageId, group, campaign }) {
      const i = db.identity.imagery.find((x) => x.id === imageId);
      if (!i) throw new FumeError("not_found", `No picture ${imageId}`);
      i.group = group;
      i.campaign = group === "campaign" ? campaign?.trim() || i.campaign || "A campaign" : undefined;
      return asNow(i);
    },
    // The voice in five parts, each confirmed or changed. How we speak holds the board's short voice lines:
    // confirming the part confirms them too. (Its time is the real clock's, not the mock's.)
    async decideVoicePart({ part, verdict, note }) {
      const book = db.voiceBook;
      const p = book.parts.find((x) => x.id === part);
      if (!p) throw new FumeError("not_found", `No voice part ${part}`);
      p.provenance = {
        ...p.provenance,
        state: verdict === "keep" ? "approved" : "changed",
        by: m.userId,
        at: new Date().toISOString(),
      };
      p.note = verdict === "change" ? note?.trim() || p.note : undefined;
      if (part === "speak" && verdict === "keep")
        for (const v of db.identity.voice)
          if (v.provenance.state === "proposed")
            v.provenance = { ...v.provenance, state: "approved", by: m.userId, at: new Date().toISOString() };
      return asNow(book);
    },

    // ── Boards ──
    async boards() {
      return wait(db.boards.filter((b) => b.workspaceId === m.workspaceId));
    },
    async board(boardId) {
      return wait(m.find(db.boards, boardId, "board"));
    },
    async addBoardItem(boardId, input) {
      const b = m.find(db.boards, boardId, "board");
      const staff = Boolean(m.me().staffRole);
      b.items.push({
        ...input,
        id: m.nextId("bi"),
        boardId,
        provenance: { origin: staff ? "fume" : "customer", state: "approved", by: m.me().id, at: m.now() },
      });
      b.updatedAt = m.now();
      return wait(b);
    },
    async updateBoardItem(boardId, itemId, change) {
      const b = m.find(db.boards, boardId, "board");
      Object.assign(m.find(b.items, itemId, "board item"), change);
      b.updatedAt = m.now();
      return wait(b);
    },
    async removeBoardItem(boardId, itemId) {
      const b = m.find(db.boards, boardId, "board");
      b.items = b.items.filter((i) => i.id !== itemId);
      return wait(b);
    },
    async startMoodboard(campaignId, images) {
      const c = m.find(db.campaigns, campaignId, "campaign");
      if (c.boardId) return wait(m.find(db.boards, c.boardId, "board"));
      const b = startCampaignBoard(m, c, images);
      m.emit({ type: "campaign.state", campaign: c });
      return wait(b);
    },

    // ── Taste ──
    async tasteTraining() {
      return wait({ cards: db.tasteCards, state: db.tasteState });
    },
    // "Why" is asked after the pick, so a reason (or a changed answer, after "Back one") can come for a card already
    // answered: it updates what the Engine learned, without counting a new answer. The deck never ends: an answered
    // card goes to the back with a fresh picture.
    async answerTaste({ cardId, answer, reason }) {
      const again = !db.tasteCards.some((c) => c.id === cardId) ? answeredTaste.get(cardId) : undefined;
      if (again) {
        const s = db.tasteState;
        if (reason) {
          s.confidence[again.area] = Math.min(0.98, s.confidence[again.area] + 0.02);
          s.lastLesson = sentence(reason);
        }
        s.updatedAt = m.now();
        return wait({ card: again, state: s });
      }
      const card = m.find(db.tasteCards, cardId, "taste card");
      answeredTaste.set(cardId, card);
      const s = db.tasteState;
      const area: TasteArea = card.area;
      s.confidence[area] = Math.min(0.98, s.confidence[area] + (reason ? 0.04 : 0.02));
      s.answered += 1;
      s.updatedAt = m.now();
      s.lastLesson = reason ? sentence(reason) : answer === "no" ? `Not this. ${lessons[area]}` : lessons[area];
      db.tasteCards = [...db.tasteCards.filter((c) => c.id !== cardId), { ...card, id: m.nextId("tc") }];
      return wait({ card, state: s });
    },
    // "Neither" in a taste pair. A training pair answered "Neither" is answered, and leaves the deck. (Its time is
    // the real clock's, not the mock's.)
    async passTastePair({ pairId, cardId, reason }) {
      const p = pairId ? db.tastePairs.find((x) => x.id === pairId) : undefined;
      if (p) {
        p.neither = true;
        p.chosen = undefined;
        p.reason = reason ?? p.reason;
      }
      const i = cardId ? db.tasteCards.findIndex((c) => c.id === cardId) : -1;
      if (i >= 0) {
        db.tasteCards.splice(i, 1);
        db.tasteState.answered += 1;
        db.tasteState.updatedAt = new Date().toISOString();
      }
      return wait(undefined);
    },

    // ── Update the brand: lysne.no (or a zip) read again, keeping only what is new, changed or unsure ──
    async startBrandUpdate(input) {
      m.mustApprove();
      const base = structuredClone(brandUpdate);
      const files = (input.files ?? []).map((f) => f.name);
      const update: BrandUpdate = {
        ...base,
        id: m.nextId("bu"),
        source: input.source,
        url: input.source === "website" ? (input.url ?? base.url) : undefined,
        files,
        sources: input.source === "website" ? base.sources : zipSources(files),
        // A zip shows the same finds, read from its files.
        found:
          input.source === "website"
            ? base.found
            : base.found.map((f) => ({ ...f, source: files[0] ?? "LYSNE autumn 2026.zip" })),
        startedAt: m.now(),
      };
      db.brandUpdate = update;
      playUpdate(update);
      return asNow(update);
    },
    async brandUpdate() {
      return asNow(db.brandUpdate);
    },
    async decideBrandFound({ updateId, foundId, verdict, value }) {
      m.mustApprove();
      const update = currentUpdate(updateId);
      const f = update.found.find((x) => x.id === foundId);
      if (!f) throw new FumeError("not_found", `No find ${foundId}`);
      if (f.decision) throw new FumeError("invalid", `${f.title} is already answered`);
      if (verdict === "remove") f.decision = "removed";
      else apply(update, foundId, verdict === "fix" ? value : undefined);
      if (update.found.every((x) => x.decision)) applied(update);
      return asNow(update);
    },
    async approveBrandUpdate(updateId) {
      m.mustApprove();
      const update = currentUpdate(updateId);
      for (const f of update.found) if (!f.decision) apply(update, f.id);
      applied(update);
      return asNow(update);
    },

    // ── The onboarding: continue where you left off. The furthest point only moves forward. ──
    async onboardingProgress() {
      return asNow(db.onboarding);
    },
    async saveOnboardingProgress({ step: to, part, line }) {
      const progress = db.onboarding;
      if (to !== undefined) {
        const now = steps.indexOf(progress.step);
        const next = steps.indexOf(to);
        if (next > now) {
          progress.step = to;
          progress.part = to === "review" ? (part ?? parts[0]) : undefined;
        } else if (
          next === now &&
          to === "review" &&
          part &&
          parts.indexOf(part) > parts.indexOf(progress.part ?? parts[0])
        ) {
          progress.part = part;
        }
      }
      if (line) progress.lines = [...progress.lines.filter((l) => l.id !== line.id), line];
      return asNow(progress);
    },
  };
}
