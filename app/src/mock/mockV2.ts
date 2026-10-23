// The mock backend's v2 calls (FLOWS.md, PROPOSED 15 Oct 2026): the brand scan, the Brand DNA board and its
// proposals, the catalogue, boards, collection deliveries and the Studio. createMockApi mixes these into FumeApi.

import {
  FumeError,
  type AllBrandsView,
  type Board,
  type BrandBoardView,
  type BrandScan,
  type BrandWorkspaceView,
  type Campaign,
  type CatalogueView,
  type Creative,
  type Delivery,
  type FumeApi,
  type FumeEvent,
  type Generation,
  type Id,
  type IdentityKind,
  type Provenance,
  type QueueItem,
  type StudioCampaignRow,
  type StudioSession,
  type TeamLoadRow,
  type User,
} from "../contract";
import * as seed from "./seed";
import * as seed2 from "./seed2";

type Db = ReturnType<typeof v2Db> & {
  campaigns: Campaign[];
  creatives: Creative[];
  deliveries: Delivery[];
  products: import("../contract").Product[];
  rules: import("../contract").BrandRule[];
  brandDna: import("../contract").BrandDna;
  runs: import("../contract").EngineRun[];
  workspaces: import("../contract").Workspace[];
  threads: import("../contract").Thread[];
  messages: import("../contract").Message[];
};

/** v5: a campaign moodboard started on the spot (the manual brief, the campaign's Moodboard tab): the pictures in rows
 *  of three, liked by whoever started it. The campaign gets the board's id. */
export function startCampaignBoard(
  db: { boards: Board[] },
  campaign: Campaign,
  images: string[],
  who: { id: Id; staff: boolean },
  at: string,
  nextId: (prefix: string) => string,
): Board {
  const id = nextId("bd");
  const provenance: Provenance = { origin: who.staff ? "fume" : "customer", state: "approved", by: who.id, at };
  const rows = Math.max(1, Math.ceil(images.length / 3));
  const board: Board = {
    id, workspaceId: campaign.workspaceId, kind: "campaign_moodboard", campaignId: campaign.id, name: `${campaign.name} moodboard`,
    width: 1100, height: 80 + rows * 405, updatedAt: at,
    items: images.map((image, i) => ({ id: nextId("bi"), boardId: id, kind: "image" as const, x: 40 + (i % 3) * 340, y: 40 + Math.floor(i / 3) * 405, w: 300, h: 375, image, verdict: "liked" as const, provenance })),
  };
  db.boards.push(board);
  campaign.boardId = id;
  campaign.updatedAt = at;
  return board;
}

/** The v2 tables, merged into the mock's in-memory db. */
export function v2Db() {
  return structuredClone({
    identity: seed2.identity,
    categories: seed2.categories,
    collections: seed2.collections,
    boards: seed2.boards,
    scan: null as BrandScan | null,
    creativeTypes: seed2.creativeTypes,
    cast: seed2.cast,
    scenes: seed2.scenes,
    sessions: seed2.sessions,
  });
}

/** Applies v2 fields to the v1 rows (products get places, campaigns get collections, threads get kinds). */
export function upgradeV1(db: Db) {
  for (const p of db.products) Object.assign(p, seed2.productPlaces[p.id] ?? {});
  db.products.push(...structuredClone(seed2.newProducts));
  for (const c of db.campaigns) Object.assign(c, seed2.campaignScope[c.id] ?? {});
  for (const t of db.threads) t.kind = "fume";
  db.threads.push(structuredClone(seed2.contactThread));
  db.messages.push(...structuredClone(seed2.contactMessages));
  db.deliveries.forEach((d) => (d.scope = "campaign"));
}

export interface V2Context {
  db: Db;
  wait: <T>(value: T) => Promise<T>;
  now: () => string;
  nextId: (prefix: string) => string;
  emit: (event: FumeEvent) => void;
  me: () => User;
  workspaceId: () => Id;
  mustStaff: () => void;
  mustApprove: () => void;
  queue: () => QueueItem[];
  studioRows: () => StudioCampaignRow[];
  teamLoad: () => TeamLoadRow[];
}

export function v2Api(ctx: V2Context): Pick<
  FumeApi,
  | "startBrandScan" | "brandScan" | "brandBoard" | "decide" | "catalogue" | "collection" | "addCollection" | "setProductPlace"
  | "boards" | "board" | "addBoardItem" | "updateBoardItem" | "removeBoardItem" | "startMoodboard" | "setCampaignScope" | "makeDelivery"
  | "allBrands" | "brandWorkspace" | "studioKit" | "studioSession" | "openStudio" | "generate" | "repair" | "pickGeneration" | "sendToCheck"
> {
  const { db, wait, now, nextId, emit } = ctx;
  const find = <T extends { id: Id }>(list: T[], id: Id, what: string): T => {
    const found = list.find((x) => x.id === id);
    if (!found) throw new FumeError("not_found", `No ${what} ${id}`);
    return found;
  };
  const ws = () => ctx.workspaceId();
  const decided = (p: Provenance, verdict: "keep" | "change" | "remove", was?: string): Provenance => ({
    ...p,
    state: verdict === "keep" ? "approved" : verdict === "change" ? "changed" : "removed",
    by: ctx.me().id,
    at: now(),
    ...(verdict === "change" && was !== undefined ? { was } : {}),
  });

  function brandBoardView(): BrandBoardView {
    const id = db.identity;
    const all = [...id.colours, ...id.typefaces, ...id.logos, ...id.voice, ...id.imagery].map((x) => x.provenance);
    const moodboard = db.boards.find((b) => b.workspaceId === ws() && b.kind === "brand_moodboard")!;
    const open = all.filter((p) => p.state === "proposed").length + moodboard.items.filter((i) => i.provenance.state === "proposed").length;
    return { dna: db.brandDna, identity: id, rules: db.rules, moodboard, open };
  }

  /** The demo's Engine reads one source per tick and lets the finds land one by one. */
  function playScan(scan: BrandScan) {
    let step = 0;
    const timer = setInterval(() => {
      const current = scan.sources.find((s) => s.state === "reading");
      if (current) current.state = "read";
      const next = scan.sources.find((s) => s.state === "waiting");
      if (next) {
        next.state = "reading";
        scan.reading = next.kind === "page" ? `Reading ${next.label}` : `Reading ${next.label}`;
      } else {
        scan.state = "done";
        scan.reading = undefined;
        clearInterval(timer);
      }
      step += 1;
      emit({ type: "scan.progress", scan: structuredClone(scan) });
    }, 1400);
    (timer as unknown as { unref?: () => void }).unref?.();
    return step;
  }

  function sessionOf(id: Id) {
    return find(db.sessions, id, "Studio session");
  }

  return {
    async startBrandScan(input) {
      const base = structuredClone(seed2.scan);
      const pages = base.sources.filter((s) => s.kind === "page");
      const files = (input.files ?? []).map((f, i) => ({ id: `sf${i}`, label: f.name, kind: "file" as const, state: "waiting" as const }));
      const sources = input.source === "website" ? pages : input.source === "upload" ? files : [...pages, ...files];
      const scan: BrandScan = {
        ...base,
        id: nextId("scan"),
        source: input.source,
        url: input.url,
        files: (input.files ?? []).map((f) => f.name),
        sources: sources.length ? sources : base.sources,
        finds: base.finds.map((f) => (input.source === "website" ? { ...f, origin: "engine" as const } : f)),
      };
      db.scan = scan;
      playScan(scan);
      return wait(scan);
    },
    async brandScan() {
      return wait(db.scan);
    },

    async brandBoard() {
      return wait(brandBoardView());
    },
    async decide({ kind, id, verdict, value }) {
      ctx.mustApprove();
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
      const target = find(list as { id: Id; provenance: Provenance }[], id, kind) as { id: Id; provenance: Provenance; hex?: string; statement?: string; name?: string };
      let was: string | undefined;
      if (verdict === "change" && value !== undefined) {
        if ("hex" in target && target.hex !== undefined) { was = target.hex; target.hex = value; }
        else if ("statement" in target && target.statement !== undefined) { was = target.statement; target.statement = value; }
        else if ("name" in target && target.name !== undefined) { was = target.name; target.name = value; }
      }
      target.provenance = decided(target.provenance, verdict, was);
      return wait(brandBoardView());
    },

    async catalogue(): Promise<CatalogueView> {
      return wait({
        products: db.products.filter((p) => p.workspaceId === ws()),
        categories: db.categories.filter((c) => c.workspaceId === ws()),
        collections: db.collections.filter((c) => c.workspaceId === ws() && c.provenance.state !== "removed"),
      });
    },
    async collection(collectionId) {
      const collection = find(db.collections, collectionId, "collection");
      const products = db.products.filter((p) => collection.productIds.includes(p.id));
      const campaigns = db.campaigns.filter((c) => c.collectionIds?.includes(collectionId) || c.productIds.some((id) => collection.productIds.includes(id)));
      const approved = db.creatives.filter((cr) => campaigns.some((c) => c.id === cr.campaignId) && ["approved", "delivered"].includes(cr.current.state));
      const deliveries = db.deliveries.filter((d) => d.collectionId === collectionId || campaigns.some((c) => c.id === d.campaignId && d.scope !== "collection"));
      return wait({ collection, products, campaigns, approved, deliveries });
    },
    async addCollection(input) {
      const c = { id: nextId("cl"), workspaceId: ws(), ...input, provenance: { origin: "customer" as const, state: "approved" as const, by: ctx.me().id, at: now() } };
      db.collections.push(c);
      for (const p of db.products.filter((x) => input.productIds.includes(x.id))) p.collectionIds = [...(p.collectionIds ?? []), c.id];
      return wait(c);
    },
    async setProductPlace(productId, change) {
      const p = find(db.products, productId, "product");
      if (change.categoryId !== undefined) p.categoryId = change.categoryId;
      if (change.collectionIds) {
        p.collectionIds = change.collectionIds;
        for (const c of db.collections) {
          const has = change.collectionIds.includes(c.id);
          c.productIds = has ? [...new Set([...c.productIds, p.id])] : c.productIds.filter((id) => id !== p.id);
        }
      }
      return wait(p);
    },

    async boards() {
      return wait(db.boards.filter((b) => b.workspaceId === ws()));
    },
    async board(boardId) {
      return wait(find(db.boards, boardId, "board"));
    },
    async addBoardItem(boardId, input) {
      const b = find(db.boards, boardId, "board");
      const staff = Boolean(ctx.me().staffRole);
      b.items.push({ ...input, id: nextId("bi"), boardId, provenance: { origin: staff ? "fume" : "customer", state: "approved", by: ctx.me().id, at: now() } });
      b.updatedAt = now();
      return wait(b);
    },
    async updateBoardItem(boardId, itemId, change) {
      const b = find(db.boards, boardId, "board");
      Object.assign(find(b.items, itemId, "board item"), change);
      b.updatedAt = now();
      return wait(b);
    },
    async removeBoardItem(boardId, itemId) {
      const b: Board = find(db.boards, boardId, "board");
      b.items = b.items.filter((i) => i.id !== itemId);
      return wait(b);
    },
    async startMoodboard(campaignId, images) {
      const c = find(db.campaigns, campaignId, "campaign");
      if (c.boardId) {
        const b = find(db.boards, c.boardId, "board");
        return wait(b);
      }
      const b = startCampaignBoard(db, c, images, { id: ctx.me().id, staff: Boolean(ctx.me().staffRole) }, now(), nextId);
      emit({ type: "campaign.state", campaign: structuredClone(c) });
      return wait(b);
    },

    async setCampaignScope(campaignId, scope) {
      const c = find(db.campaigns, campaignId, "campaign");
      const fromCollections = db.collections.filter((cl) => scope.collectionIds.includes(cl.id)).flatMap((cl) => cl.productIds);
      c.collectionIds = scope.collectionIds;
      c.productIds = [...new Set([...scope.productIds, ...fromCollections])];
      c.updatedAt = now();
      emit({ type: "campaign.state", campaign: c });
      return wait(c);
    },
    async makeDelivery({ campaignId, collectionId }) {
      ctx.mustApprove();
      const c = find(db.campaigns, campaignId, "campaign");
      const collection = collectionId ? find(db.collections, collectionId, "collection") : undefined;
      // round 8 REVIEW (TASK-16): only what is in no delivery yet, so a second delivery never packs the same creatives again
      const packed = new Set(db.deliveries.filter((x) => x.campaignId === campaignId).flatMap((x) => x.creativeIds));
      const creatives = db.creatives.filter((cr) => cr.campaignId === campaignId && cr.current.state === "approved" && !packed.has(cr.id));
      if (!creatives.length) throw new FumeError("conflict", "Every approved creative in this campaign is in a delivery already.");
      const d: Delivery = {
        id: nextId("dl"),
        campaignId,
        name: collection ? `${c.name} · ${collection.name}` : c.name,
        creativeIds: creatives.map((cr) => cr.id),
        state: "preparing",
        rightsNote: "For LYSNE's paid and organic channels in the Nordics, no end date. Images with AI people are labelled.",
        bytes: creatives.length * 4_800_000,
        createdAt: now(),
        formats: [...new Set(creatives.map((cr) => cr.format))],
        scope: collection ? "collection" : "campaign",
        collectionId,
      };
      db.deliveries.unshift(d);
      setTimeout(() => (d.state = "ready"), 1500);
      return wait(d);
    },

    async allBrands(): Promise<AllBrandsView> {
      ctx.mustStaff();
      const queue = ctx.queue();
      const rows = ctx.studioRows();
      // Round 12 NUMBERS (DLOAD-2): one count per thing. "In check" is what the Check page lists as waiting (its QA
      // items), for every brand alike; "to send" is the checked work not yet with the customer (waits.toSend), so a
      // card never says "6 ready to release" over a list that says 0.
      const qaWaiting = ((db as { qaItems?: import("../contract").QaItem[] }).qaItems ?? []).filter((q) => q.state === "waiting");
      return wait({
        brands: db.workspaces.map((workspace) => {
          const mine = rows.filter((r) => r.workspace.id === workspace.id);
          return {
            workspace,
            inCheck: qaWaiting.filter((q) => q.workspaceId === workspace.id).length,
            readyToRelease: mine.reduce((n, r) => n + Math.min(r.readyToRelease, r.campaign.waits?.toSend ?? 0), 0),
            running: db.runs.filter((r) => r.state === "running" && mine.some((m) => m.campaign.id === r.campaignId)).length,
            nextDue: mine.map((r) => r.campaign.dueAt).filter(Boolean).sort()[0],
            blocked: mine.filter((r) => r.campaign.state === "awaiting_input").length,
          };
        }),
        queue,
        runs: db.runs.map((run) => {
          const campaign = find(db.campaigns, run.campaignId, "campaign");
          return { run, campaign, workspace: find(db.workspaces, campaign.workspaceId, "workspace") };
        }),
        // Round 12 (DLOAD-13, DLOAD-21): due by the plan's delivery date, not the go-live; before any creative is made
        // the total is what the plan holds ("Planned: 9 creatives"), never "0 of 0".
        deliveriesDue: rows
          .filter((r) => (r.campaign.waits?.delivery ?? r.campaign.dueAt) && !["delivered", "closed"].includes(r.campaign.state))
          .map((r) => ({ campaign: r.campaign, workspace: r.workspace, dueAt: r.campaign.waits?.delivery ?? r.campaign.dueAt, approved: r.campaign.counts.approved, total: r.campaign.counts.creatives || (r.campaign.waits?.planned ?? 0) }))
          .sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? "")),
        team: ctx.teamLoad(),
      });
    },
    async brandWorkspace(workspaceId): Promise<BrandWorkspaceView> {
      ctx.mustStaff();
      const workspace = find(db.workspaces, workspaceId, "workspace");
      const campaigns = ctx.studioRows().filter((r) => r.workspace.id === workspaceId);
      return wait({
        workspace,
        campaigns,
        engineOutput: db.runs
          .filter((r) => campaigns.some((c) => c.campaign.id === r.campaignId))
          .map((run) => ({ run, campaign: find(db.campaigns, run.campaignId, "campaign"), generations: db.sessions.filter((s) => s.campaignId === run.campaignId).flatMap((s) => s.generations) })),
        queue: ctx.queue().filter((q) => q.workspace.id === workspaceId),
        sessions: db.sessions.filter((s) => s.workspaceId === workspaceId),
        boards: db.boards.filter((b) => b.workspaceId === workspaceId),
      });
    },
    async studioKit(workspaceId) {
      ctx.mustStaff();
      return wait({
        creativeTypes: db.creativeTypes,
        cast: db.cast.filter((c) => !c.workspaceId || c.workspaceId === workspaceId),
        scenes: db.scenes.filter((s) => s.workspaceId === workspaceId),
        products: db.products.filter((p) => p.workspaceId === workspaceId),
        references: db.boards.filter((b) => b.workspaceId === workspaceId).flatMap((b) => b.items.filter((i) => i.image && i.verdict !== "disliked").map((i) => i.image!)),
      });
    },
    async studioSession(sessionId) {
      ctx.mustStaff();
      return wait(sessionOf(sessionId));
    },
    async openStudio({ workspaceId, campaignId, slot, fromGenerationId }) {
      ctx.mustStaff();
      const from = fromGenerationId ? db.sessions.flatMap((s) => s.generations).find((g) => g.id === fromGenerationId) : undefined;
      const s: StudioSession = {
        id: nextId("ss"),
        workspaceId,
        campaignId,
        slot,
        recipe: from ? structuredClone(from.recipe) : { mode: "free", castIds: [], references: [], format: "feed", count: 4 },
        generations: from ? [{ ...structuredClone(from), id: nextId("g"), state: "candidate", branch: 1 }] : [],
        by: ctx.me().id,
        updatedAt: now(),
      };
      db.sessions.unshift(s);
      return wait(s);
    },
    async generate(sessionId, recipe) {
      ctx.mustStaff();
      const s = sessionOf(sessionId);
      s.recipe = recipe;
      const branch = Math.max(0, ...s.generations.map((g) => g.branch)) + 1;
      const tiles = ["05-06", "04-02", "08-06", "03-05", "05-03", "09-13"];
      const made: Generation[] = Array.from({ length: Math.min(recipe.count, 6) }, (_, i) => ({
        id: nextId("g"), sessionId, branch, image: seed.img(tiles[(i + branch) % tiles.length], recipe.format), recipe: structuredClone(recipe),
        evaluation: { productTruth: i === 1 ? "flag" : "pass", brandRules: "pass", artefacts: i === 2 ? "minor" : "none", notes: i === 1 ? ["Label edge soft"] : [] },
        cost: 0.12, state: "making", at: now(),
      }));
      s.generations.push(...made);
      s.updatedAt = now();
      made.forEach((g, i) => {
        const t = setTimeout(() => {
          g.state = "candidate";
          emit({ type: "generation.state", generation: structuredClone(g) });
        }, 900 * (i + 1));
        (t as unknown as { unref?: () => void }).unref?.();
      });
      return wait(s);
    },
    async repair(sessionId, generationId, what) {
      ctx.mustStaff();
      const s = sessionOf(sessionId);
      const from = find(s.generations, generationId, "generation");
      const branch = Math.max(...s.generations.map((g) => g.branch)) + 1;
      const g: Generation = { ...structuredClone(from), id: nextId("g"), branch, state: "making", repair: what, at: now(), evaluation: { ...from.evaluation, productTruth: "pass", notes: [] } };
      s.generations.push(g);
      const t = setTimeout(() => {
        g.state = "candidate";
        emit({ type: "generation.state", generation: structuredClone(g) });
      }, 1200);
      (t as unknown as { unref?: () => void }).unref?.();
      return wait(s);
    },
    async pickGeneration(sessionId, generationId) {
      ctx.mustStaff();
      const s = sessionOf(sessionId);
      for (const g of s.generations) if (g.state === "picked") g.state = "candidate";
      find(s.generations, generationId, "generation").state = "picked";
      s.pickedId = generationId;
      return wait(s);
    },
    async sendToCheck(sessionId) {
      ctx.mustStaff();
      const s = sessionOf(sessionId);
      const g = s.generations.find((x) => x.id === s.pickedId);
      if (!g) throw new FumeError("conflict", "Pick a generation first.");
      g.state = "sent_to_check";
      s.updatedAt = now();
      return wait(s);
    },
  };
}
