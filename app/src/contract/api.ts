// The Fume app's data contract: everything the front end asks of the backend (ARCHITECTURE §9).
// PROPOSED (14 Oct 2026). The mock (src/mock/) implements it now; the real backend implements it later.
// Every call acts for the signed-in user in their current workspace, and the server checks their role.

import type {
  BrandDna,
  CampaignPlan,
  PlannedCreative,
  BrandRule,
  Brief,
  Campaign,
  CampaignState,
  ChangeTag,
  Check,
  CheckNote,
  Creative,
  CreativeVersion,
  CustomerRole,
  Delivery,
  Direction,
  EngineRun,
  Format,
  Id,
  Instant,
  Invitation,
  MemoryEntry,
  Membership,
  Message,
  Notification,
  Organisation,
  Package,
  Pin,
  Product,
  ProductFact,
  QualityLogEntry,
  RecordEvent,
  Reference,
  ServiceClock,
  SourceAsset,
  TastePair,
  Thread,
  Understanding,
  Usage,
  User,
  VersionState,
  Workspace,
  Board,
  BoardItem,
  BrandIdentity,
  BrandScan,
  BrandUpdate,
  CastMember,
  Category,
  Collection,
  CreativeType,
  Generation,
  IdentityKind,
  Recipe,
  Scene,
  ScanSource,
  StudioSession,
  Batch,
  BrandModel,
  BrandPreset,
  BrandReference,
  BriefOrder,
  CreativeDocument,
  Layer,
  ProductOverride,
  QaItem,
  QaPin,
  Rating,
  ReviewComment,
  StudioKind,
  StudioMode,
  TasteCard,
  TasteState,
  CalendarEntry,
  CameraPreset,
  DetailToken,
  EngineMessage,
  FormatTile,
  LightPreset,
  LookSource,
  Meeting,
  Placement,
  ProductFix,
  UsageRow,
  ProductKind,
  ProductFile,
  ProductPart,
  SpecValue,
  ImportJob,
  ImportSource,
  AgencyClient,
  AgencyCampaignRow,
  AgencyHomeView,
  AgencyNeed,
  AgencyRole,
  AgencyTeamMember,
  ClientLinkView,
  ClientSend,
  LicenceView,
} from "./entities";

// ─── View models: shapes built for a screen, so a screen makes one call ──────

export interface Session {
  user: User;
  workspace: Workspace;
  organisation: Organisation;
  role: CustomerRole | null;
  /** Workspaces this user can open (Fume's people: every assigned one). */
  workspaces: Workspace[];
  /** True once Brand DNA v1 is approved; until then the app opens the first run. */
  onboarded: boolean;
}

/** Home answers five questions (ICP): what waits for you, what is being made, what Fume needs, what is approved, what Fume learned. */
export interface HomeView {
  waitingOnYou: WaitingItem[];
  inProduction: { campaign: Campaign; run?: EngineRun; clock?: ServiceClock }[];
  fumeNeeds: { id: Id; text: string; href: string }[];
  recentlyApproved: Creative[];
  deliveries: Delivery[];
  learned: MemoryEntry[];
  usage: Usage;
}

export interface WaitingItem {
  id: Id;
  kind: "brief" | "plan" | "directions" | "creatives" | "question" | "brand_dna" | "product";
  campaignId?: Id;
  title: string;
  detail: string;
  count?: number;
  dueAt?: Instant;
  href: string;
}

export interface CampaignView {
  campaign: Campaign;
  brief: Brief;
  directions: Direction[];
  creatives: Creative[];
  runs: EngineRun[];
  clock?: ServiceClock;
  record: RecordEvent[];
  approver: User;
  people: User[];
  threadId: Id;
}

export interface CampaignFilter {
  state?: CampaignState[];
  search?: string;
}

export interface CreativeFilter {
  state?: VersionState[];
  format?: Format[];
  directionId?: Id;
  kind?: "master" | "variant";
}

export interface ReviewItem {
  campaign: Campaign;
  kind: "brief" | "directions" | "creatives";
  creatives: Creative[];
  directions: Direction[];
  dueAt?: Instant;
}

export interface BrandDnaView {
  dna: BrandDna;
  rules: BrandRule[];
  products: Product[];
  references: Reference[];
  tastePairs: TastePair[];
  memory: MemoryEntry[];
  assets: SourceAsset[];
  understanding: Understanding;
}

export interface TeamView {
  members: { user: User; membership: Membership }[];
  invitations: Invitation[];
  fumeTeam: User[];
}

export interface SettingsView {
  workspace: Workspace;
  package: Package;
  usage: Usage;
  notificationPrefs: { kind: string; label: string; email: boolean; inApp: boolean }[];
}

/** The Quality Gate review screen in one call. */
export interface CheckView {
  check: Check;
  creative: Creative;
  version: CreativeVersion;
  campaign: Campaign;
  workspace: Workspace;
  product?: Product;
  /** Position in the expert's queue, for "3 of 12" and the arrows. */
  index: number;
  total: number;
  prevId?: Id;
  nextId?: Id;
}

export interface QueueItem {
  check: Check;
  creative: Creative;
  campaign: Campaign;
  workspace: Workspace;
}

export interface StudioCampaignRow {
  campaign: Campaign;
  workspace: Workspace;
  clock?: ServiceClock;
  expert?: User;
  operator?: User;
  readyToRelease: number;
}

export interface TeamLoadRow {
  user: User;
  /** Core-equivalent units carried now; capacity is 4 (Business Model & GTM). */
  load: number;
  capacity: number;
  checksToday: number;
  minutesPerCheck: number;
}

// ─── v2 view models (FLOWS.md) ─────────────────────────────────────────────

/** Brand DNA as a board (FLOWS §0.3): identity, rules and taste in one call. */
export interface BrandBoardView {
  dna: BrandDna;
  identity: BrandIdentity;
  rules: BrandRule[];
  moodboard: Board;
  /** Proposals the customer has not decided yet, across every part. */
  open: number;
}

export interface CatalogueView {
  products: Product[];
  categories: Category[];
  collections: Collection[];
}

export interface CollectionView {
  collection: Collection;
  products: Product[];
  campaigns: Campaign[];
  /** Approved creatives for this collection's products, across campaigns. */
  approved: Creative[];
  deliveries: Delivery[];
}

/** Fume's people: the "All brands" view at the top of the switcher. */
export interface AllBrandsView {
  brands: {
    workspace: Workspace;
    inCheck: number;
    readyToRelease: number;
    running: number;
    nextDue?: Instant;
    blocked: number;
    /** Round 11 (one overview for Fume and an agency, Marcus 20 Oct 2026): the brand's picture for its card. */
    picture?: string;
    /** Round 11: the brand's most urgent campaign and how far it is, 0 to 1 (approved creatives over planned). */
    current?: { campaignId: Id; name: string; progress: number; detail: string };
  }[];
  /** Round 11: what needs you across the brands, the same rows as the agency's Home (plans and creatives to check). */
  needsYou?: AgencyNeed[];
  queue: QueueItem[];
  runs: { run: EngineRun; campaign: Campaign; workspace: Workspace }[];
  deliveriesDue: { campaign: Campaign; workspace: Workspace; dueAt?: Instant; approved: number; total: number }[];
  team: TeamLoadRow[];
}

/** One brand's studio workspace for Fume's people. */
export interface BrandWorkspaceView {
  workspace: Workspace;
  campaigns: StudioCampaignRow[];
  /** What the Engine made since you last looked, newest first. */
  engineOutput: { run: EngineRun; campaign: Campaign; generations: Generation[] }[];
  queue: QueueItem[];
  sessions: StudioSession[];
  boards: Board[];
}

export interface StudioKit {
  creativeTypes: CreativeType[];
  cast: CastMember[];
  scenes: Scene[];
  products: Product[];
  references: string[];
}

// ─── v3 views ───

export interface BrandAssetsView {
  presets: BrandPreset[];
  models: BrandModel[];
  references: BrandReference[];
}

export interface QaView {
  item: QaItem;
  campaign: Campaign;
  workspace: Workspace;
}

// ─── Events: what changes while a screen is open ────────────────────────────

export type FumeEvent =
  | { type: "run.progress"; run: EngineRun }
  | { type: "version.state"; creativeId: Id; version: CreativeVersion }
  | { type: "message.new"; message: Message }
  | { type: "notification.new"; notification: Notification }
  | { type: "campaign.state"; campaign: Campaign }
  | { type: "scan.progress"; scan: BrandScan }
  | { type: "generation.state"; generation: Generation }
  | { type: "document.state"; document: CreativeDocument }
  | { type: "batch.progress"; batch: Batch }
  | { type: "qa.state"; item: QaItem }
  | { type: "engine.message"; message: EngineMessage };

export type Unsubscribe = () => void;

// ─── Errors ─────────────────────────────────────────────────────────────────

export type FumeErrorCode = "not_found" | "forbidden" | "conflict" | "invalid" | "unavailable";

export class FumeError extends Error {
  constructor(
    public code: FumeErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "FumeError";
  }
}

// ─── The contract ───────────────────────────────────────────────────────────

export interface FumeApi {
  // Session
  session(): Promise<Session>;
  switchWorkspace(workspaceId: Id): Promise<Session>;

  // Home
  home(): Promise<HomeView>;

  // Brand DNA
  brandDna(): Promise<BrandDnaView>;
  updateRule(rule: BrandRule): Promise<BrandRule>;
  addRule(rule: Omit<BrandRule, "id" | "source" | "confidence">): Promise<BrandRule>;
  product(productId: Id): Promise<Product>;
  verifyFact(factId: Id): Promise<ProductFact>;
  correctFact(factId: Id, statement: string): Promise<ProductFact>;
  verifyProduct(productId: Id): Promise<Product>;
  addProduct(input: { name: string; variant: string; url?: string }): Promise<Product>;
  addReference(input: { image: string; verdict: "liked" | "disliked"; note?: string }): Promise<Reference>;
  chooseTastePair(pairId: Id, chosen: "a" | "b", reason?: string): Promise<TastePair>;
  answerUnderstanding(input: {
    unknownId?: Id;
    answer?: string;
    directionId?: Id;
    verdict?: "yes" | "no";
    reason?: string;
  }): Promise<Understanding>;
  approveBrandDna(): Promise<BrandDna>;
  uploadSourceAssets(files: { name: string; bytes: number; kind: SourceAsset["kind"] }[]): Promise<SourceAsset[]>;

  // Campaigns
  campaigns(filter?: CampaignFilter): Promise<Campaign[]>;
  campaign(campaignId: Id): Promise<CampaignView>;
  startCampaign(input: { text: string; productIds?: Id[] }): Promise<{ campaign: Campaign; threadId: Id }>;
  approveBrief(campaignId: Id): Promise<Brief>;
  changeBrief(campaignId: Id, change: Partial<Brief>): Promise<Brief>;
  chooseDirection(directionId: Id, reason?: string): Promise<Direction>;
  passDirections(campaignId: Id, reason: string): Promise<Direction[]>;
  creatives(campaignId: Id, filter?: CreativeFilter): Promise<Creative[]>;
  creative(creativeId: Id): Promise<{ creative: Creative; campaign: Campaign; siblings: Id[] }>;

  // Review (the customer's decisions)
  reviewQueue(): Promise<ReviewItem[]>;
  approve(versionIds: Id[]): Promise<CreativeVersion[]>;
  requestChanges(input: { versionId: Id; pins: Pin[]; tags: ChangeTag[]; text: string }): Promise<{
    version: CreativeVersion;
    usesRound: boolean;
    roundsLeft: number;
  }>;

  // Deliveries
  deliveries(): Promise<Delivery[]>;
  delivery(deliveryId: Id): Promise<{ delivery: Delivery; creatives: Creative[]; campaign: Campaign }>;
  downloadUrl(deliveryId: Id, format?: Format): Promise<string>;
  confirmLive(deliveryId: Id): Promise<Delivery>;

  // Fume (the conversation)
  threads(): Promise<Thread[]>;
  messages(threadId: Id): Promise<Message[]>;
  send(threadId: Id, text: string, attachments?: { name: string; bytes: number }[]): Promise<Message>;

  // Team
  team(): Promise<TeamView>;
  /** Everyone this user meets in the workspace (its members and Fume's people on it), to name who acted. */
  people(): Promise<User[]>;
  invite(email: string, role: CustomerRole): Promise<Invitation>;
  changeRole(userId: Id, role: CustomerRole): Promise<Membership>;
  removeMember(userId: Id): Promise<void>;
  setApprover(campaignId: Id, userId: Id): Promise<Campaign>;

  // Settings
  settings(): Promise<SettingsView>;
  updateWorkspace(change: Partial<Pick<Workspace, "brandName" | "market" | "language">>): Promise<Workspace>;

  // Notifications
  notifications(): Promise<Notification[]>;
  markRead(notificationIds: Id[] | "all"): Promise<void>;

  // Studio: the Quality Gate and Operations (Fume's people only)
  checkQueue(): Promise<QueueItem[]>;
  check(checkId: Id): Promise<CheckView>;
  passItem(checkId: Id, itemId: Id): Promise<Check>;
  addNote(checkId: Id, note: Pick<CheckNote, "x" | "y" | "text"> & { itemId?: Id }): Promise<Check>;
  markChecked(checkId: Id): Promise<Check>;
  requestCorrection(checkId: Id): Promise<Check>;
  hold(checkId: Id, reason: string): Promise<Check>;
  release(campaignId: Id): Promise<Campaign>;
  studioCampaigns(): Promise<StudioCampaignRow[]>;
  qualityLog(): Promise<QualityLogEntry[]>;
  teamLoad(): Promise<TeamLoadRow[]>;

  // ─── v2 (FLOWS.md) ───

  // Onboarding: the Engine reads the brand (FLOWS §7 step 3)
  startBrandScan(input: { source: ScanSource; url?: string; files?: { name: string; bytes: number }[] }): Promise<BrandScan>;
  brandScan(): Promise<BrandScan | null>;

  // Brand DNA board
  brandBoard(): Promise<BrandBoardView>;
  /** Keep, change or remove an Engine proposal (FLOWS §2). Only the customer decides. */
  decide(input: { kind: IdentityKind; id: Id; verdict: "keep" | "change" | "remove"; value?: string }): Promise<BrandBoardView>;

  // Catalogue (FLOWS §3.1)
  catalogue(): Promise<CatalogueView>;
  collection(collectionId: Id): Promise<CollectionView>;
  addCollection(input: { name: string; kind: Collection["kind"]; productIds: Id[] }): Promise<Collection>;
  setProductPlace(productId: Id, change: { categoryId?: Id; collectionIds?: Id[] }): Promise<Product>;

  // Boards (moodboards and idea boards)
  boards(): Promise<Board[]>;
  board(boardId: Id): Promise<Board>;
  addBoardItem(boardId: Id, item: Omit<BoardItem, "id" | "boardId" | "provenance">): Promise<Board>;
  updateBoardItem(boardId: Id, itemId: Id, change: Partial<Pick<BoardItem, "x" | "y" | "w" | "h" | "verdict" | "note" | "text">>): Promise<Board>;
  removeBoardItem(boardId: Id, itemId: Id): Promise<Board>;
  /** v5: start a campaign's moodboard on the spot with these pictures; the campaign gets its boardId. */
  startMoodboard(campaignId: Id, images: string[]): Promise<Board>;

  // Campaigns with collections, and deliveries per collection (FLOWS §3.2)
  setCampaignScope(campaignId: Id, scope: { productIds: Id[]; collectionIds: Id[] }): Promise<Campaign>;
  makeDelivery(input: { campaignId: Id; collectionId?: Id }): Promise<Delivery>;

  // Fume's people: the switcher's two levels and the Studio (FLOWS §4.2, §5)
  allBrands(): Promise<AllBrandsView>;
  brandWorkspace(workspaceId: Id): Promise<BrandWorkspaceView>;
  studioKit(workspaceId: Id): Promise<StudioKit>;
  studioSession(sessionId: Id): Promise<StudioSession>;
  openStudio(input: { workspaceId: Id; campaignId?: Id; slot?: string; fromGenerationId?: Id }): Promise<StudioSession>;
  generate(sessionId: Id, recipe: Recipe): Promise<StudioSession>;
  repair(sessionId: Id, generationId: Id, what: string): Promise<StudioSession>;
  pickGeneration(sessionId: Id, generationId: Id): Promise<StudioSession>;
  sendToCheck(sessionId: Id): Promise<StudioSession>;

  // ─── v3 (FLOWS §9–§14) ───

  // Studio documents (FLOWS §9): one per creative, versions for renders, undo for edits
  studioModes(): Promise<StudioMode[]>;
  documents(workspaceId: Id): Promise<CreativeDocument[]>;
  document(documentId: Id): Promise<CreativeDocument>;
  openDocument(input: { workspaceId: Id; studio: StudioKind; modeId: Id; campaignId?: Id; creativeId?: Id; title?: string; slot?: string; /** v7: a candidate opened in the Studio becomes V1 of one document (walk-through Must 10). */ fromGenerationId?: Id; /** r13 #56: started from a product; otherwise a new creative starts with no product (or its campaign's first) */ productId?: Id }): Promise<CreativeDocument>;
  updateDocument(documentId: Id, change: Partial<Pick<CreativeDocument, "variables" | "specs" | "layers" | "modeId" | "studio" | "title" | "campaignId">>): Promise<CreativeDocument>; // v5: campaignId (a key with undefined clears it)
  /** Words in the Engine bar: the Engine proposes a variable change and shows it before it renders. */
  engineEdit(documentId: Id, text: string): Promise<CreativeDocument>;
  decideEdit(documentId: Id, editId: Id, verdict: "keep" | "undo"): Promise<CreativeDocument>;
  render(documentId: Id): Promise<CreativeDocument>;
  pickVersion(documentId: Id, versionId: Id): Promise<CreativeDocument>;
  overrideProduct(documentId: Id, change: { field: string; value: string; scope: ProductOverride["scope"] }): Promise<CreativeDocument>;
  documentToCheck(documentId: Id): Promise<CreativeDocument>;

  // Brand assets (FLOWS §9.4, §9.6)
  brandAssets(workspaceId?: Id): Promise<BrandAssetsView>;
  saveModel(input: { documentId: Id; name: string; state: "draft" | "saved" }): Promise<BrandModel>;
  /** The customer decides on a model Fume saved. */
  decideModel(modelId: Id, verdict: "approve" | "decline"): Promise<BrandModel>;
  saveReference(input: { documentId: Id; name: string; state: "draft" | "saved" }): Promise<BrandReference>;
  decideOverride(overrideId: Id, verdict: "approve" | "decline"): Promise<ProductOverride>;
  /** Product-data changes Fume made in the Studio for this product (scope product, any state), for the customer to decide. */
  productProposals(productId: Id): Promise<ProductOverride[]>;

  // QA (FLOWS §10, Fume's people)
  qaQueue(workspaceId?: Id): Promise<QaView[]>;
  qaCheck(itemId: Id): Promise<QaItem>;
  qaFeedback(itemId: Id, text: string, /** r13 #51: located notes on the creative */ pins?: QaPin[]): Promise<QaItem>;
  qaEdit(itemId: Id, layers: Layer[]): Promise<QaItem>;
  /** r13 #64: while the Engine fixes the creative it opens without taking it; `takeOver` takes it from the Engine. */
  qaToStudio(itemId: Id, takeOver?: boolean): Promise<{ item: QaItem; document: CreativeDocument }>;

  // Review like frame.io (FLOWS §11)
  reviewComments(creativeId: Id): Promise<ReviewComment[]>;
  addReviewComment(input: { creativeId: Id; versionId: Id; text: string; pin?: { x: number; y: number }; replyTo?: Id }): Promise<ReviewComment>;
  resolveReviewComment(commentId: Id): Promise<ReviewComment>;
  rate(input: { creativeId: Id; versionId: Id; stars: Rating["stars"] }): Promise<Rating>;
  ratings(campaignId: Id): Promise<Rating[]>;

  // Taste keeps learning (FLOWS §14)
  tasteTraining(): Promise<{ cards: TasteCard[]; state: TasteState }>;
  answerTaste(input: { cardId: Id; answer: "a" | "b" | "yes" | "no"; reason?: string }): Promise<{ card: TasteCard; state: TasteState }>;

  // One Fume chat (FLOWS §12): no list of chats, Fume remembers everything
  conversation(): Promise<Message[]>;
  say(text: string, attachments?: { name: string; bytes: number }[]): Promise<Message>;
  /** A brief written by hand, without the chat. */
  orderBrief(order: BriefOrder): Promise<Campaign>;

  // Batches (FLOWS §9.7)
  batches(campaignId?: Id): Promise<Batch[]>;
  startBatch(input: { campaignId: Id; modeId: Id; productIds: Id[]; collectionId?: Id; perProduct: number; format: Format }): Promise<Batch>;

  // ─── v4 (FLOWS §15–§21) ───

  // Placements and Make formats
  placements(): Promise<Placement[]>;
  makeFormats(documentId: Id, placementIds: Id[]): Promise<CreativeDocument>;
  setFormatTile(documentId: Id, placementId: Id, change: { method?: FormatTile["method"]; crop?: FormatTile["crop"] }): Promise<CreativeDocument>;

  // Product fix
  detailTokens(productId: Id): Promise<DetailToken[]>;
  /** Fix a detail with the real product: a token the Engine masked, or a region the designer brushed. */
  fixProduct(documentId: Id, input: { versionId: Id; tokenId?: Id; region?: ProductFix["region"]; what?: string }): Promise<CreativeDocument>;

  // Light and camera
  lookPresets(workspaceId: Id): Promise<{ cameras: CameraPreset[]; lights: LightPreset[] }>;
  setSource(documentId: Id, section: string, source: LookSource): Promise<CreativeDocument>;

  // The Engine chat (Fume's people)
  engineChat(workspaceId: Id): Promise<EngineMessage[]>;
  engineSay(workspaceId: Id, text: string): Promise<EngineMessage>;
  answerEngineWidget(workspaceId: Id, messageId: Id, answer: { picked?: Id[]; choice?: string }): Promise<EngineMessage>;

  // Admin
  usage(): Promise<UsageRow[]>;

  // Meetings and the calendar
  meetingSlots(): Promise<Instant[]>;
  bookMeeting(input: { at: Instant; topic: string }): Promise<Meeting>;
  meetings(): Promise<Meeting[]>;
  calendar(input: { from: Instant; to: Instant }): Promise<CalendarEntry[]>;
  schedule(input: { creativeId: Id; placementId: Id; at: Instant }): Promise<CalendarEntry>;
  moveEntry(entryId: Id, at: Instant): Promise<CalendarEntry>;
  removeEntry(entryId: Id): Promise<void>;

  // ─── v6 Product kinds and specs (round 6) ───
  /** The category templates: fields, shot slots, parts (like Studio modes). */
  productKinds(): Promise<ProductKind[]>;
  /** Add a product of a kind: the Engine reads the shots and the product page and proposes specs and parts. */
  readProduct(input: { kindId: Id; name: string; variant: string; url?: string; shots: { slotId: Id; name: string; bytes: number; src?: string }[] }): Promise<Product>;
  /** The customer's values and decisions: set values (supplied), keep proposals (approved), remove, parts. */
  saveProductSpecs(
    productId: Id,
    input: {
      kindId?: Id;
      values?: { fieldId: Id; value: SpecValue; unit?: string }[];
      keep?: Id[];
      remove?: Id[];
      parts?: Omit<ProductPart, "provenance">[];
      keepParts?: Id[];
      /** Reference shots the Engine took from the website, kept by slot. */
      keepShots?: Id[];
    },
  ): Promise<Product>;
  /** A reference photo for one angle slot. src: where the upload landed (the mock takes the browser's preview). */
  uploadShot(productId: Id, slotId: Id, file: { name: string; bytes: number; src?: string }): Promise<Product>;
  /** A 3D model, dieline or label artwork. */
  uploadProductFile(productId: Id, file: { kind: ProductFile["kind"]; name: string; bytes: number }): Promise<Product>;

  // Live changes
  subscribe(handler: (event: FumeEvent) => void): Unsubscribe;
}

// ─── v9 Update the brand (round 7, PROPOSED 16 Oct 2026); merged into FumeApi ───
export interface FumeApi {
  /** Read the website again, or a zip of new things, and compare with the approved Brand DNA. */
  startBrandUpdate(input: { source: "website" | "upload"; url?: string; files?: { name: string; bytes: number }[] }): Promise<BrandUpdate>;
  /** The latest update, while it reads and after (null when there is none). */
  brandUpdate(): Promise<BrandUpdate | null>;
  /** Keep, fix (with the customer's value) or remove one thing the Engine found. Keep and fix write it into Brand DNA. */
  decideBrandFound(input: { updateId: Id; foundId: Id; verdict: "keep" | "fix" | "remove"; value?: string }): Promise<BrandUpdate>;
  /** Approve all: keep everything not answered yet, and close the update. */
  approveBrandUpdate(updateId: Id): Promise<BrandUpdate>;
}

// v8: Import products (round 7, worker W). Merged into FumeApi.
export interface ProductImportApi {
  /** The import that is under way or waits for review, or the result not yet closed; null when none. */
  productImport(): Promise<ImportJob | null>;
  startProductImport(input: { source: ImportSource; url?: string; file?: { name: string; bytes: number } }): Promise<ImportJob>;
  importJob(id: Id): Promise<ImportJob>;
  /** csv: the customer's answer to the column mapping; reading goes on. */
  mapImportColumns(jobId: Id, columns: { column: string; fieldId: Id | null }[]): Promise<ImportJob>;
  /** One found product: keep, remove, fix (its values), split a zip group, or merge it into another. */
  decideFound(
    jobId: Id,
    foundId: Id,
    decision:
      | { verdict: "keep" | "remove" | "split" }
      | { verdict: "merge"; intoId: Id }
      | { verdict: "fix"; name?: string; variant?: string; kindId?: Id; fields?: { fieldId: Id; value: string }[] },
  ): Promise<ImportJob>;
  /** Approve all that is left: new products land in the catalogue, changed ones are updated. */
  approveImport(jobId: Id): Promise<ImportJob>;
  /** Close the result (or cancel an import under way). */
  dismissImport(jobId: Id): Promise<void>;
}
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface FumeApi extends ProductImportApi {}

// ── round 8 HOME ──
// One question, one sheet (UX review 19 Oct, WAY-3, LOAD-4). A question Fume asks shows wherever it matters (Home,
// the chat, a campaign, the product it is about) and is answered in one shared sheet; the answer lands on the
// product's line, the brief and the chat at once, so it is closed everywhere. Merged into FumeApi.
export interface OpenQuestion {
  id: Id;
  /** As Fume asks it: "Which claims may we use for Hand Balm?" */
  question: string;
  /** Why Fume asks, in one sentence. */
  why: string;
  /** The brief's line it fills: "The claims we may use for Hand Balm". */
  line: string;
  /** text: a written answer; picture: a photo (a packshot). */
  answer: "text" | "picture";
  /** The campaign whose brief waits on it, when one does. */
  campaignId?: Id;
  /** The product it is about: the question is a line of that product. */
  productId?: Id;
  factId?: Id;
  shotSlotId?: Id;
  /** Short answers Fume suggests, as pills: the label on the pill, and the words it puts in the field. */
  suggestions?: { label: string; text: string }[];
  /** What a good answer looks like, for the field's placeholder. */
  hint?: string;
  /** A picture question: the photo the Engine found, which the customer may keep instead of adding one. */
  picture?: string;
}

export interface FumeApi {
  /** The questions Fume still waits on (open only), the soonest needed first. */
  questions(): Promise<OpenQuestion[]>;
  /** Answer one: in words, or with a picture for a picture question. Returns what is still open. */
  answerQuestion(input: { questionId: Id; text?: string; picture?: { name: string; bytes: number; src?: string }; keepPicture?: boolean }): Promise<OpenQuestion[]>;
}

// ── round 8 REVIEW ──
// Review acts at once, and a set's change requests travel together (UX review 19 Oct, TASK-4, TASK-5, MOB-10).
// Approve takes effect the moment it is pressed; the toast's Undo takes it back while nothing has moved on. The
// change requests Maja collects on one review set go to Fume as ONE change request: it uses one of the campaign's
// change requests (none when every item is Fume's own mistake, tag "product"). Merged into FumeApi.
export interface ChangeRoundItem {
  versionId: Id;
  /** What should change, in her words. */
  text: string;
  /** The spots she marked, each with its words. */
  pins: Pin[];
  tags: ChangeTag[];
}

export interface FumeApi {
  /** Undo approvals just made: the versions are checked and waiting again. Owner and approver only. */
  unapprove(versionIds: Id[]): Promise<CreativeVersion[]>;
  /** Send a review set's collected change requests as one. */
  requestChangeRound(input: { campaignId: Id; items: ChangeRoundItem[] }): Promise<{ versions: CreativeVersion[]; usesRound: boolean; roundsLeft: number }>;
}

// ── round 8 ONB ──
// Continue where you left off (UX review ONB-4): the furthest the first customer got in the onboarding, kept on the
// workspace, so leaving and coming back opens that step and part instead of step 1. Also her word on each line of
// What Fume understood (ONB-14: "Right" or "Not quite", with an optional reason). Merged into FumeApi.
export type OnboardingStepId = "" | "scan" | "review" | "taste";

export interface UnderstoodLine {
  /** brand | light | product | rules | audience */
  id: string;
  verdict: "right" | "not_quite";
  reason?: string;
}

export interface OnboardingProgress {
  /** The furthest step reached. */
  step: OnboardingStepId;
  /** In "review": the furthest part reached ("logo", "colour", "type", "imagery", "voice"). */
  part?: string;
  lines: UnderstoodLine[];
}

export interface FumeApi {
  /** The workspace's onboarding progress (step "" before anything is read). */
  onboardingProgress(): Promise<OnboardingProgress>;
  /** Moves the furthest step or part forward (never back) and merges lines by id. */
  saveOnboardingProgress(input: { step?: OnboardingStepId; part?: string; line?: UnderstoodLine }): Promise<OnboardingProgress>;
}

// ── round 9 VIEWER ──
// Send acts at once (UX review DTSK-15): "Send it" sends the review set's change request straight away, and the toast's
// Undo takes it back while Fume has not started on it. Merged into FumeApi.
export interface FumeApi {
  /** Take back a change request just sent: pass the new versions requestChangeRound returned and whether it used one
   *  of the package's change requests. The creatives wait on you again at the version you asked changes on. */
  withdrawChangeRound(input: { campaignId: Id; versionIds: Id[]; usedRound: boolean }): Promise<CreativeVersion[]>;
}

// ── round 10 the plan ──
// FLOWS §22 (PROPOSED 20 Oct 2026). Merged into FumeApi.
export interface PlanChange {
  /** A look line (in the chosen direction) or a content line, by key; or a planned creative, by id. */
  line?: string;
  creativeId?: Id;
  /** The new words for a line, or the creative's changed fields. */
  value?: string;
  creative?: Partial<Pick<PlannedCreative, "scene" | "text" | "people" | "format">>;
}

export interface FumeApi {
  /** The campaign's plan, or null before the brief is sent. */
  plan(campaignId: Id): Promise<CampaignPlan | null>;
  /** She sends her brief to Fume: the brief is fixed at this version and Fume starts writing the plan. Nothing is
   *  generated. (approveBrief does the same for older callers.) */
  sendBrief(campaignId: Id): Promise<Brief>;
  /** She approves the plan (only while it is ready): the Engine starts on the masters. In a brand an agency runs only
   *  the client approves it, once the agency has checked it and sent it to her (round 13, Marcus's card 23 Oct 2026). */
  approvePlan(campaignId: Id): Promise<CampaignPlan>;
  /** Undo an approval just made, while the Engine has not delivered anything: the plan waits on her again. */
  undoApprovePlan(campaignId: Id): Promise<CampaignPlan>;
  /** She changes one line or one planned creative in place (while ready). */
  changePlan(campaignId: Id, change: PlanChange): Promise<CampaignPlan>;
  /** She takes another of the plan's directions; the look and the creatives follow it. */
  choosePlanDirection(campaignId: Id, directionId: Id, reason?: string): Promise<CampaignPlan>;
  /** She asks Fume for changes in words: Fume answers with the next version and what it changed. */
  askPlanChanges(campaignId: Id, note: string): Promise<CampaignPlan>;
  /** Staff: the expert marks the plan checked, which sends it to the customer. In a brand an agency runs the agency
   *  checks it (sendToClient with `plan` does it and tells the client). */
  checkPlan(campaignId: Id): Promise<CampaignPlan>;
}

// ── round 11 agencies ──
// FLOWS §24. The agency's own calls; inside a client the agency uses the customer's calls on that client's workspace.

/** Interfaces merge: agency people get their agency and role. */
export interface Session {
  agency?: { organisation: Organisation; role: AgencyRole };
  /** The agency that runs this workspace, when one does (a client person sees "Brygga Studio makes this brand's creatives with Fume"). */
  agencyName?: string;
}

export interface FumeApi {
  /** The agency's Home: the clients as cards, what needs you, the team this week. */
  agencyHome(): Promise<AgencyHomeView>;
  /** Every client brand (Clients, the picker, the sidebar list), recent first. */
  agencyClients(): Promise<AgencyClient[]>;
  /** Every campaign across the clients. */
  agencyCampaigns(): Promise<AgencyCampaignRow[]>;
  agencyTeam(): Promise<AgencyTeamMember[]>;
  licence(): Promise<LicenceView>;
  /** Lead only: a new client brand; Fume starts its Brand DNA from the website; the client's people are invited. */
  addClient(input: { brandName: string; website?: string; market?: string; language?: string; people: { name: string; email: string; role: CustomerRole }[] }): Promise<AgencyClient>;
  /** Checked creatives to the client: the people named are told in Fume; with link, a client link too. With `plan`
   *  the agency checks the plan and sends it (round 13): the client approves it, and only then does the Engine start.
   *  A campaign has one client link: a later send with a link reuses it. */
  sendToClient(input: { campaignId: Id; versionIds: Id[]; to: Id[]; link: boolean; note?: string; plan?: boolean }): Promise<ClientSend>;
  /** What was sent to the client for a campaign, newest first. */
  clientSends(campaignId: Id): Promise<ClientSend[]>;
  /** An approval the client gave outside Fume, recorded by the agency (approvedBy stays the client). */
  recordClientApproval(input: { versionIds: Id[]; clientUserId: Id; note: string; /** Round 12 (DTASK-15): the day she approved; today when left out. */ at?: Instant }): Promise<CreativeVersion[]>;
  /** What a client link opens (no sign-in in the real app; the mock serves it to anyone). */
  clientLink(token: string): Promise<ClientLinkView>;
  /** Approve or ask for changes through a client link, as the client person it was sent to. */
  answerClientLink(input: { token: string; versionId: Id; verdict: "approve" | "changes"; text?: string; name: string }): Promise<CreativeVersion>;
  /** Round 13: approve the plan or ask for changes through a client link, as the client person it was sent to. Approved,
   *  the Engine starts on the masters; changes go to Fume, and the agency checks the next version before she sees it. */
  answerClientPlan(input: { token: string; verdict: "approve" | "changes"; text?: string; name: string }): Promise<CampaignPlan>;
}

// ── round 12 numbers ──
/** Interfaces merge (UX review DLOAD-1, PROPOSED 20 Oct 2026): the person who approves the campaign, so a studio row
 *  can say "The plan waits on Maja" and "6 creatives with Maja". */
export interface StudioCampaignRow {
  approver?: User;
}

// ── round 12 QA ──
// One check workspace for Fume and an agency (UX review 20 Oct, DLAY-1, DLAY-2, DTASK-4): what a creative is checked
// against travels with it into Check (the per-rule list of the retired full-screen check), and every check can be
// undone from its toast. Merged into QaView and FumeApi.
export interface QaView {
  /** What it is checked against, by area: the Product Truth lines and the Brand DNA rules (read-only). */
  against?: { area: import("./entities").CheckArea; label: string; against: string }[];
  /** The product it shows, when it shows one, for its one name (copy.creativeName: "Night Body Oil · Feed 6"). */
  productName?: string;
}

export interface FumeApi {
  /** Undo a check just made (the toast's Undo, or Undo in the panel): the creative waits for a check again. */
  qaUncheck(itemId: Id): Promise<QaItem>;
  /** Undo a Send to check from the Studio: the creative in Check shows the version it showed before. */
  undoDocumentToCheck(documentId: Id): Promise<CreativeDocument>;
}

/** Interfaces merge (DLAY-14, DTASK-7, PROPOSED 20 Oct 2026): one Team table for Fume and an agency. The brands a
 *  person works on and what they do now ("3 creatives to check · 1 plan · LYSNE"); an admin follows and carries no
 *  load (FLOWS §20), so `follows` leaves them out of capacity. */
export interface TeamLoadRow {
  brandIds?: Id[];
  doing?: string;
  follows?: boolean;
}

// ── round 13 campaign ──
// Marcus's video comments #22–#26, #21, #67 (22 Oct 2026; PROPOSED). Merged into PlanChange and FumeApi.
export interface PlanChange {
  /** #26: a planned creative's own look; null takes it back to the plan's look. */
  look?: import("./entities").CreativeLook | null;
  /** #67: a planned creative's go-live day. */
  liveAt?: Instant;
  /** #67: a step of the timeline by its label ("Goes live"), and its new day. */
  step?: string;
  stepAt?: Instant;
}

export interface FumeApi {
  /** #21: she skips the moodboard stage; Fume plans from the brief and the Brand DNA alone. */
  skipMoodboard(campaignId: Id): Promise<Campaign>;
  /** #25: she asks the expert to check the plan before she approves it (optional). */
  askPlanCheck(campaignId: Id): Promise<CampaignPlan>;
  /** #22: the briefs she can start from: Fume's templates, and hers the Engine made from her past campaigns. */
  briefTemplates(): Promise<import("./entities").BriefTemplate[]>;
  /** #24: three alternatives for the brief's message (or its idea, or the whole brief), with what she wants changed
   *  ("warmer", "shorter"). `round` asks for a new set. */
  briefAlternatives(input: {
    part: "message" | "brief";
    goal: string;
    audience?: string;
    message?: string;
    productIds?: Id[];
    feedback?: string;
    round?: number;
  }): Promise<{ goal: string; audience: string; message: string }[]>;
}

// ── round 13 brand ──
// Marcus's video comments #2–#5, #41–#49 (22 Oct 2026; PROPOSED). Merged into FumeApi.
export interface FumeApi {
  /** #42: the uses she chose for a colour. */
  setColourUses(input: { colourId: Id; uses: import("./entities").ColourUse[] }): Promise<import("./entities").BrandColour>;
  /** #3: she moves a picture to another group (a campaign look names its campaign). */
  moveImage(input: { imageId: Id; group: import("./entities").ImageGroup; campaign?: string }): Promise<import("./entities").BrandImage>;
  /** #4: Confirm or Change one part of the voice (Change says what is right in her words). */
  decideVoicePart(input: { part: import("./entities").VoicePartId; verdict: "keep" | "change"; note?: string }): Promise<import("./entities").VoiceBook>;
  /** #47: neither picture of a pair (onboarding pairId, Brand › Taste cardId) feels like the brand. */
  passTastePair(input: { pairId?: Id; cardId?: Id; reason?: string }): Promise<void>;
  /** #49: her own name, title and email, changed in place. */
  updateProfile(input: { name: string; title: string; email: string }): Promise<User>;
}

// ── round 13 agency ──
// Marcus's video comments #70, #71 (22 Oct 2026; PROPOSED): the agency's Fume plan, and asking Fume for people or help.
export interface FumeApi {
  /** #70: what the agency's Fume plan holds and what comes (Fume decides). */
  agencyPlan(): Promise<import("./entities").AgencyFumePlan>;
  /** #71: Borrow Fume's people, or write to Fume's customer service. Sends a request; Fume answers in a working day. */
  askFume(input: Omit<import("./entities").FumeRequest, "id" | "by" | "at" | "state">): Promise<import("./entities").FumeRequest>;
}

// ── round 13 chat ──
// Marcus's video comments #6, #11, #20 (22 Oct 2026; PROPOSED). Merged into OpenQuestion and FumeApi.
export interface OpenQuestion {
  /** #6: what this kind of product usually says, when the brand's own site does not: starting points she changes. */
  templates?: { label: string; text: string }[];
  /** #6: why Fume offers them, in one line ("lysne.no says nothing about the claims of Hand Balm. …"). */
  templatesWhy?: string;
}
export interface FumeApi {
  /** #11: what a meeting with Fume is usually about (the presets under "What it is about"). */
  meetingTopics(): Promise<string[]>;
  /** #20: she changes the plan with Fume in the chat, before the Engine starts ("12 creatives, 3 of them videos",
   *  "masters by Friday"): Fume writes the next version at once and says in one line what changed. Only while the
   *  plan is ready for her. */
  changePlanWithFume(campaignId: Id, text: string): Promise<CampaignPlan>;
}

