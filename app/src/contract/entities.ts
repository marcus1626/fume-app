// The Fume app's entities: what the front end shows and what the backend stores.
// PROPOSED (14 Oct 2026), from app/ARCHITECTURE.md §4. Code names here; the words on screen live in src/copy/.
// No framework imports: this file is shared by the front end, the mock and the backend.

export type Id = string;
/** ISO 8601 date-time, UTC. */
export type Instant = string;

// ─── 4.1 Identity and workspace ─────────────────────────────────────────────

export type CustomerRole = "owner" | "approver" | "member" | "viewer";
export type StaffRole = "expert" | "operator" | "admin";

export interface User {
  id: Id;
  name: string;
  /** Real job title, shown with the name on every check (F-D040). */
  title: string;
  email: string;
  /** Image URL; people without one get initials on Cream (Warmer, F-D074). */
  avatar?: string;
  /** Set for Fume's own people. */
  staffRole?: StaffRole;
}

export interface Organisation {
  id: Id;
  name: string;
  packageId: Id;
}

export interface Workspace {
  id: Id;
  organisationId: Id;
  brandName: string;
  /** The brand's mark as an image URL (the composer chip and the switcher). */
  brandMark?: string;
  market: string;
  language: string;
}

export interface Membership {
  userId: Id;
  workspaceId: Id;
  role: CustomerRole;
}

export interface Invitation {
  id: Id;
  workspaceId: Id;
  email: string;
  role: CustomerRole;
  invitedBy: Id;
  state: "sent" | "accepted" | "expired";
  at: Instant;
}

export interface StaffAssignment {
  userId: Id;
  workspaceId: Id;
  staffRole: Exclude<StaffRole, "admin">;
}

// ─── 4.2 Brand DNA ──────────────────────────────────────────────────────────

/** Where a fact came from. The UI shows it on every fact (Product Vision §4.2). */
export type FactSource = "supplied" | "verified" | "inferred" | "learned" | "campaign" | "unknown";
export type Confidence = "high" | "medium" | "low";

export interface BrandDna {
  workspaceId: Id;
  version: number;
  state: "draft" | "in_review" | "approved";
  approvedBy?: Id;
  approvedAt?: Instant;
  /** 0–1: how much of what Fume needs it has. */
  completeness: number;
  summary: string;
}

export type RuleArea = "logo" | "colour" | "type" | "voice" | "layout" | "imagery" | "claims";

export interface BrandRule {
  id: Id;
  area: RuleArea;
  statement: string;
  /** A hard constraint is never broken; a preference can bend for a campaign. */
  kind: "rule" | "hard_constraint" | "preference";
  source: FactSource;
  confidence: Confidence;
}

export type ProductFactArea = "shape" | "colour" | "material" | "label" | "packaging" | "claim" | "never";

export interface ProductFact {
  id: Id;
  productId: Id;
  area: ProductFactArea;
  label: string;
  statement: string;
  source: FactSource;
  confidence: Confidence;
  verifiedBy?: Id;
  verifiedAt?: Instant;
}

export interface Product {
  id: Id;
  workspaceId: Id;
  name: string;
  variant: string;
  sku?: string;
  /** v2: the catalogue (FLOWS §3.1). */
  categoryId?: Id;
  collectionIds?: Id[];
  variants?: Variant[];
  /** v2: who added it; products the Engine read from the website start as proposals. */
  provenance?: Provenance;
  /** needs_you: Fume extracted facts the customer has not verified yet. */
  state: "draft" | "needs_you" | "verified";
  images: string[];
  facts: ProductFact[];
  /** v6: the product kind (category template) its specs follow; see ProductKind. */
  kindId?: Id;
  /** v6: the values of the kind's fields, each with its provenance (Engine proposal or the customer's). */
  specs?: SpecEntry[];
  /** v6: the physical parts (bottle, cap, pump, box, label), each with material, finish and colour. */
  parts?: ProductPart[];
  /** v6: the reference shots, one per angle slot of the kind. */
  shots?: ReferenceShot[];
  /** v6: a 3D model, dieline or label artwork the customer added. */
  files?: ProductFile[];
}

export interface Reference {
  id: Id;
  image: string;
  verdict: "liked" | "disliked";
  note?: string;
  addedBy: Id;
}

export interface TastePair {
  id: Id;
  a: string;
  b: string;
  question: string;
  chosen?: "a" | "b";
  reason?: string;
}

export interface MemoryEntry {
  id: Id;
  kind: "approved" | "rejected" | "changed" | "caught";
  campaignId: Id;
  creativeId?: Id;
  lesson: string;
  at: Instant;
}

export type SourceAssetKind = "logo" | "guideline" | "packshot" | "campaign" | "font" | "other";

export interface SourceAsset {
  id: Id;
  kind: SourceAssetKind;
  name: string;
  bytes: number;
  uploadedBy: Id;
  at: Instant;
  thumbnail?: string;
}

/** The comprehension check: Fume shows what it understood before any campaign (Product Vision §4.2). */
export interface Understanding {
  version: number;
  summary: string[];
  conflicts: { id: Id; text: string; resolved?: string }[];
  unknowns: { id: Id; question: string; why: string; answer?: string }[];
  testDirections: { id: Id; name: string; image: string; verdict?: "yes" | "no"; reason?: string }[];
}

// ─── 4.3 Package and scope ──────────────────────────────────────────────────

export type PackageKind = "launch" | "core" | "growth";

export interface Package {
  id: Id;
  kind: PackageKind;
  /** Creatives per cycle: 18, 27, 54 (Offer v0.1). */
  creativeCap: number;
  directionRounds: number;
  productionRounds: number;
  period: "one_off" | "monthly";
}

export interface Usage {
  creativesUsed: number;
  creativeCap: number;
  campaignsActive: number;
  periodEndsAt?: Instant;
}

export type ClockStage = "plan" | "directions" | "masters" | "variants";

export interface ServiceClock {
  campaignId: Id;
  stage: ClockStage;
  dueAt: Instant;
  state: "running" | "paused_waiting_on_you" | "met" | "missed";
  pausedReason?: string;
}

// ─── 4.4 Campaign ───────────────────────────────────────────────────────────

/** Order states, DECIDED in the Product Execution Roadmap. */
export type CampaignState =
  | "draft"
  | "awaiting_input"
  | "scoped"
  | "in_production"
  | "in_review"
  | "revision"
  | "approved"
  | "delivered"
  | "closed";

/** Where in the cycle a campaign is; a second axis beside the state (ARCHITECTURE §5.1). */
/** Round 10: "plan" replaces "directions" for new campaigns (the directions are part of the plan); "directions" stays
 *  for campaigns that ran before. */
export type CampaignStage = "brief" | "plan" | "directions" | "masters" | "variants" | "delivery";

export type Format = "square" | "feed" | "story";
export type Channel = "paid_social" | "organic_social" | "email" | "product_page" | "display";

export interface Campaign {
  id: Id;
  workspaceId: Id;
  name: string;
  productIds: Id[];
  state: CampaignState;
  stage: CampaignStage;
  approverId: Id;
  channels: Channel[];
  formats: Format[];
  market: string;
  language: string;
  dueAt?: Instant;
  createdBy: Id;
  createdAt: Instant;
  updatedAt: Instant;
  /** Counts for lists and headers. */
  counts: { creatives: number; inCheck: number; checked: number; approved: number; delivered: number };
  roundsUsed: number;
  roundsIncluded: number;
  chosenDirectionId?: Id;
  cover?: string;
  /** The Brand DNA version it is made and checked against. */
  brandDnaVersion: number;
  /** v2: whole collections in the campaign; their products are in productIds too. */
  collectionIds?: Id[];
  /** v2: the campaign's moodboard. */
  boardId?: Id;
  /** v5: the campaign's own look, if it differs from the brand. */
  look?: CampaignLook;
}

export interface Brief {
  campaignId: Id;
  version: number;
  state: "drafting" | "ready" | "approved";
  objective: string;
  audience: string;
  offer?: string;
  message: string;
  mandatory: string[];
  never: string[];
  channels: Channel[];
  formats: Format[];
  creatives: number;
  references: string[];
  /** What Fume still needs before the brief is complete. */
  missing: string[];
  approvedBy?: Id;
  approvedAt?: Instant;
}

export type DirectionState = "making" | "in_check" | "proposed" | "chosen" | "passed";

export interface Direction {
  id: Id;
  campaignId: Id;
  letter: "A" | "B" | "C" | "D";
  name: string;
  insight: string;
  hook: string;
  message: string;
  visualIdea: string;
  whyItFits: string;
  risks: string[];
  plannedOutputs: string;
  cover: string;
  images: string[];
  state: DirectionState;
  checkedBy?: Id;
  checkedAt?: Instant;
  decidedBy?: Id;
  decidedAt?: Instant;
  reason?: string;
}

/** ARCHITECTURE §5.2. The customer never sees making, in_check or correcting as a creative, only as counts. */
export type VersionState =
  | "making"
  | "in_check"
  | "correcting"
  | "held"
  | "checked"
  | "changes_requested"
  | "approved"
  | "delivered";

export interface CreativeVersion {
  id: Id;
  creativeId: Id;
  number: number;
  image: string;
  width: number;
  height: number;
  state: VersionState;
  madeAt: Instant;
  checkId?: Id;
  checkedBy?: Id;
  checkedAt?: Instant;
  approvedBy?: Id;
  approvedAt?: Instant;
  heldReason?: string;
}

export interface Creative {
  id: Id;
  campaignId: Id;
  directionId: Id;
  /** Null for a master itself; a variant points at its master. */
  masterId: Id | null;
  kind: "master" | "variant";
  format: Format;
  channel: Channel;
  /** Delivery name, e.g. lysne_autumn_a_m1_v2_feed_v3. */
  name: string;
  title: string;
  current: CreativeVersion;
  versions: CreativeVersion[];
}

// ─── 4.5 Production ─────────────────────────────────────────────────────────

export type RunPurpose = "directions" | "masters" | "variants" | "correction";
export type RunState = "queued" | "running" | "paused" | "failed" | "done";
export type StepState = "pending" | "active" | "done" | "waiting" | "paused" | "stopped" | "failed";

export interface EngineStep {
  label: string;
  state: StepState;
  detail?: string;
}

export interface EngineRun {
  id: Id;
  campaignId: Id;
  purpose: RunPurpose;
  state: RunState;
  steps: EngineStep[];
  made: number;
  total: number;
  startedAt: Instant;
  /** Images of what is made so far, newest last. */
  previews: string[];
}

// ─── 4.6 Quality Gate ───────────────────────────────────────────────────────

export type CheckState = "waiting" | "in_check" | "checked" | "changes_requested" | "held";
export type CheckArea = "product_truth" | "brand_rules" | "claims" | "channel" | "artifacts" | "naming";

export interface CheckNote {
  id: Id;
  number: number;
  /** Pin position on the creative, 0–1 from the top left. */
  x: number;
  y: number;
  text: string;
  author: Id;
  at: Instant;
  resolved?: boolean;
}

export interface CheckItem {
  id: Id;
  area: CheckArea;
  label: string;
  /** What it is checked against: a Product Truth line or a Brand Rule. */
  against: string;
  result: "pending" | "pass" | "note";
  noteId?: Id;
}

export interface Check {
  id: Id;
  versionId: Id;
  creativeId: Id;
  campaignId: Id;
  workspaceId: Id;
  expertId: Id;
  state: CheckState;
  items: CheckItem[];
  notes: CheckNote[];
  dueAt: Instant;
  risk: "normal" | "high";
  startedAt?: Instant;
  checkedAt?: Instant;
}

export type Severity = "critical" | "major" | "minor";

export interface QualityLogEntry {
  id: Id;
  checkId: Id;
  workspaceId: Id;
  campaignId: Id;
  creativeId: Id;
  severity: Severity;
  what: string;
  fixed: boolean;
  by: Id;
  at: Instant;
}

// ─── 4.7 Review and decisions ───────────────────────────────────────────────

export type ChangeTag = "product" | "colour" | "text" | "composition" | "mood" | "other";

export interface Pin {
  x: number;
  y: number;
  text: string;
}

export interface Decision {
  id: Id;
  subject: "brief" | "direction" | "creative" | "brand_dna";
  subjectId: Id;
  versionId?: Id;
  by: Id;
  verdict: "approved" | "changes_requested" | "passed";
  reason?: string;
  at: Instant;
}

export interface ChangeRequest {
  id: Id;
  versionId: Id;
  creativeId: Id;
  by: Id;
  pins: Pin[];
  tags: ChangeTag[];
  text: string;
  state: "open" | "in_progress" | "done";
  /** Fume's own mistake: fixed without using a round. */
  isCorrection: boolean;
  at: Instant;
}

export interface Comment {
  id: Id;
  subjectId: Id;
  by: Id;
  text: string;
  at: Instant;
}

// ─── 4.8 Delivery, conversation and record ──────────────────────────────────

export interface Delivery {
  id: Id;
  campaignId: Id;
  name: string;
  creativeIds: Id[];
  state: "preparing" | "ready" | "downloaded" | "confirmed_live";
  rightsNote: string;
  bytes: number;
  createdAt: Instant;
  formats: Format[];
  /** v2: a delivery covers the whole campaign or one collection in it (FLOWS §3.2). */
  scope?: "campaign" | "collection";
  collectionId?: Id;
}

export type MessageAuthor = { kind: "person"; userId: Id } | { kind: "fume" } | { kind: "engine" };

/** What a message can carry besides text: the cards Fume shows in the conversation. */
export type MessageCard =
  | { kind: "brief"; campaignId: Id; version: number }
  | { kind: "directions"; campaignId: Id }
  /** Round 10 (FLOWS §22): the plan, written or ready; the card opens it. */
  | { kind: "plan"; campaignId: Id; version: number }
  | { kind: "run"; runId: Id }
  | { kind: "question"; question: string; why: string; options?: string[]; /** v7: Fume asks for the product with its picture grid (walk-through Must 2). */ productIds?: Id[] }
  | { kind: "creatives"; campaignId: Id; creativeIds: Id[] }
  /** v4: Fume hands the conversation to a person at Fume (FLOWS §21). */
  | { kind: "handover"; userId: Id; reason: string }
  /** v4: Fume offers meeting times (FLOWS §21). */
  | { kind: "meeting"; meetingId?: Id; slots: Instant[]; /** v7: what the customer asked to talk about ("Christmas plans"). */ topic?: string }
  /** Round 13 CHAT (#15, #16): a campaign, plan, creative, product or collection Fume points at; it opens in the panel. */
  | { kind: "link"; link: ChatLink }
  /** Round 13 CHAT (#16): what waits on her, or this month in numbers, read from the same source as Home. */
  | { kind: "summary"; of: "waiting" | "month" };

export interface Attachment {
  id: Id;
  name: string;
  bytes: number;
  kind: "image" | "document";
  thumbnail?: string;
}

export interface Message {
  id: Id;
  threadId: Id;
  author: MessageAuthor;
  text: string;
  at: Instant;
  attachments?: Attachment[];
  card?: MessageCard;
}

export interface Thread {
  id: Id;
  workspaceId: Id;
  /** Null for the general thread with Fume. */
  campaignId: Id | null;
  /** v2: fume = the conversation with Fume (AI); contact = people (your contact and your expert). */
  kind?: "fume" | "contact";
  title: string;
  updatedAt: Instant;
  unread: number;
}

export type NotificationKind =
  | "checked"
  | "engine_done"
  | "changes_asked"
  | "mention"
  | "waiting_on_you"
  | "delivered"
  | "held";

export interface Notification {
  id: Id;
  userId: Id;
  kind: NotificationKind;
  actor: MessageAuthor;
  text: string;
  href: string;
  read: boolean;
  at: Instant;
}

export interface RecordEvent {
  id: Id;
  workspaceId: Id;
  campaignId?: Id;
  subjectId: Id;
  actor: MessageAuthor;
  action:
    | "brief_approved"
    | "direction_chosen"
    | "made"
    | "checked"
    | "correction"
    | "held"
    | "approved"
    | "changes_requested"
    | "delivered"
    | "confirmed_live"
    | "brand_dna_approved";
  detail: string;
  at: Instant;
}

// ═══ Architecture v2 (FLOWS.md, PROPOSED 15 Oct 2026) ═══════════════════════

// ─── v2 §2 Proposal and approval ────────────────────────────────────────────

/** Who put an item in: the Engine (read it from the website, an upload or learning), the customer, or Fume's people. */
export type Origin = "engine" | "customer" | "fume";
/** One rule across the app (FLOWS §2): the Engine proposes, only the customer approves. */
export type ProposalState = "proposed" | "approved" | "changed" | "removed";

export interface Provenance {
  origin: Origin;
  state: ProposalState;
  /** Where the Engine found it, in words: "lysne.no/about", "LYSNE brand guide 2026.pdf, page 4". */
  evidence?: string;
  /** How sure the Engine is; low-confidence proposals become questions. */
  confidence?: Confidence;
  /** Who approved or changed it, and when. */
  by?: Id;
  at?: Instant;
  /** The Engine's value before the customer changed it. */
  was?: string;
}

// ─── v2 §3 Brand identity: what the Brand DNA board shows ────────────────────

export type ColourRole = "primary" | "accent" | "ground" | "text" | "support";

export interface BrandColour {
  id: Id;
  name: string;
  hex: string;
  role: ColourRole;
  usage: string;
  provenance: Provenance;
}

export interface BrandTypeface {
  id: Id;
  name: string;
  role: "display" | "body" | "accent";
  /** A stand-in web face to draw the specimen with, when the real face cannot be loaded. */
  cssFamily: string;
  weights: string[];
  sample: string;
  usage: string;
  provenance: Provenance;
}

export interface BrandLogo {
  id: Id;
  name: string;
  /** The word or mark as text, drawn in the display face when no image is supplied. */
  wordmark: string;
  image?: string;
  use: string;
  ground: "light" | "dark";
  provenance: Provenance;
}

export interface BrandVoiceLine {
  id: Id;
  statement: string;
  example: string;
  provenance: Provenance;
}

export interface BrandImage {
  id: Id;
  image: string;
  caption: string;
  provenance: Provenance;
}

export interface BrandIdentity {
  colours: BrandColour[];
  typefaces: BrandTypeface[];
  logos: BrandLogo[];
  voice: BrandVoiceLine[];
  imagery: BrandImage[];
}

export type IdentityKind = "colour" | "typeface" | "logo" | "voice" | "image" | "rule" | "product" | "collection" | "board_item";

// ─── v2 §3.1 Catalogue ──────────────────────────────────────────────────────

export interface Category {
  id: Id;
  workspaceId: Id;
  name: string;
  /** A tree: Body care › Oils. */
  parentId?: Id;
}

export type CollectionKind = "season" | "launch" | "line" | "custom";

export interface Collection {
  id: Id;
  workspaceId: Id;
  /** "SS27", "AW26", "Evening ritual". */
  name: string;
  kind: CollectionKind;
  startsAt?: Instant;
  endsAt?: Instant;
  productIds: Id[];
  cover?: string;
  description?: string;
  provenance: Provenance;
}

export interface Variant {
  id: Id;
  productId: Id;
  name: string;
  sku?: string;
  image?: string;
}

// ─── v2 §3.3 Boards (on OpenPencil later; positioned items now) ──────────────

export type BoardKind = "brand_moodboard" | "campaign_moodboard" | "ideas" | "layout";

export interface Board {
  id: Id;
  workspaceId: Id;
  kind: BoardKind;
  campaignId?: Id;
  name: string;
  /** The board's size in board units; items are placed in it. */
  width: number;
  height: number;
  updatedAt: Instant;
  items: BoardItem[];
  /** OpenPencil document reference, once the canvas runs on it (FLOWS §6). */
  documentRef?: string;
}

export type BoardItemKind = "image" | "note" | "section" | "creative" | "swatch";

export interface BoardItem {
  id: Id;
  boardId: Id;
  kind: BoardItemKind;
  x: number;
  y: number;
  w: number;
  h: number;
  image?: string;
  text?: string;
  hex?: string;
  /** Liked or disliked, with the reason: this is what feeds the Taste Map. */
  verdict?: "liked" | "disliked";
  note?: string;
  provenance: Provenance;
}

// ─── v2 §7 step 3 Brand scan (the onboarding animation's data) ──────────────

export type ScanSource = "website" | "upload" | "both";

export interface BrandScanFind {
  id: Id;
  kind: "logo" | "colour" | "typeface" | "image" | "product" | "voice" | "rule" | "audience";
  label: string;
  /** For a colour, its hex; for an image or product, its picture; for a typeface or voice, a sample line; for a rule or audience, the line. */
  value: string;
  /** v9: the page or file it was read from (BrandScan.sources[].id), so the onboarding map can say "Reading lysne.no/about". */
  sourceId?: Id;
  /** v9: a product find that lands in Products after onboarding (round 7, point 4). */
  productId?: Id;
  evidence: string;
  confidence: Confidence;
  /** supplied: the customer gave it themselves (an upload); proposed: the Engine read it. */
  origin: Origin;
}

export interface BrandScan {
  id: Id;
  workspaceId: Id;
  source: ScanSource;
  url?: string;
  files: string[];
  state: "reading" | "done" | "failed";
  /** What the Engine is reading now, in words ("Reading lysne.no/about"). */
  reading?: string;
  /** The pages or files, in reading order. */
  sources: { id: Id; label: string; kind: "page" | "file"; state: "waiting" | "reading" | "read" }[];
  finds: BrandScanFind[];
  needsYou: number;
  error?: string;
}

// ─── v2 §3.4 Studio (Fume's people only) ────────────────────────────────────

export interface CreativeType {
  id: Id;
  name: string;
  description: string;
  /** Imagery v0.2 family it maps to (S1–S4, H-B, H-D). */
  family: string;
  needs: ("product" | "variant" | "angle" | "cast" | "scene" | "area" | "layout")[];
  formats: Format[];
  /** Check items this type adds to the Quality Gate. */
  checks: string[];
  cover: string;
}

export interface CastMember {
  id: Id;
  name: string;
  look: string;
  image: string;
  /** Always true for now: an AI person, always labelled on use (F-D041, Imagery v0.2). */
  isAiPerson: boolean;
  allowedUses: string[];
  /** Brand-only cast or Fume's shared cast (Q5, open). */
  workspaceId?: Id;
}

export interface Scene {
  id: Id;
  workspaceId: Id;
  name: string;
  light: string;
  image: string;
}

export interface Recipe {
  mode: "free" | "type";
  creativeTypeId?: Id;
  direction?: string;
  productId?: Id;
  variantId?: Id;
  angle?: string;
  castIds: Id[];
  sceneId?: Id;
  references: string[];
  format: Format;
  count: number;
  /** Staff only, never sent to a customer (Roadmap §8.2). */
  route?: { provider: string; model: string };
  prompt?: string;
  seed?: number;
}

export interface Evaluation {
  productTruth: "pass" | "flag";
  brandRules: "pass" | "flag";
  artefacts: "none" | "minor" | "major";
  notes: string[];
}

export interface Generation {
  id: Id;
  sessionId: Id;
  branch: number;
  image: string;
  recipe: Recipe;
  evaluation: Evaluation;
  /** Generation cost in USD, staff only. */
  cost: number;
  state: "making" | "candidate" | "picked" | "discarded" | "sent_to_check";
  at: Instant;
  /** What the designer asked to repair, in words. */
  repair?: string;
}

export interface StudioSession {
  id: Id;
  workspaceId: Id;
  campaignId?: Id;
  /** The planned creative this session fills ("Master 3 · feed"). */
  slot?: string;
  recipe: Recipe;
  generations: Generation[];
  pickedId?: Id;
  by: Id;
  updatedAt: Instant;
}

// ─── v3 §9 Studio: creative documents, modes and controls (PROPOSED 15 Oct 2026) ─────────────────────────────

/** The three studios (FLOWS §9.1). */
export type StudioKind = "render" | "design" | "video";

/** The Studio's control library: every mode variable is edited with one of these (FLOWS §9.3). */
export type ControlKind =
  | "slider" | "segmented" | "select" | "swatch" | "toggle" | "angle" | "lens" | "chips" | "text" | "number"
  /** v4: the advanced light board (FLOWS §18). */
  | "lightboard";

export interface LightAngle {
  /** Degrees around the subject, 0 = from the camera, 90 = from the right. */
  azimuth: number;
  /** Degrees above the horizon, 0–90. */
  elevation: number;
}

export interface Lens {
  /** Focal length in mm. */
  focal: number;
  /** Camera height in cm from the surface. */
  height: number;
  /** Tilt in degrees, negative = looking down. */
  tilt: number;
}

export type VarValue = string | number | boolean | string[] | LightAngle | Lens | LightRig;
export type Variables = Record<string, VarValue>;

export interface ModeVariable {
  key: string;
  label: string;
  control: ControlKind;
  /** The right panel's folding section it sits in ("Light", "Camera"). */
  section: string;
  default: VarValue;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: { value: string; label: string; hex?: string }[];
  /** Swatches list the brand's chosen presets of this kind first (FLOWS §9.4). */
  brandPreset?: BrandPresetKind;
  help?: string;
}

/** A mode is a schema the Engine turns into a prompt; an agent makes a new mode by writing one (FLOWS §9.3). */
export interface StudioMode {
  id: Id;
  studio: StudioKind;
  name: string;
  description: string;
  /** What a render in this mode makes. */
  output: "creative" | "model" | "reference";
  /** Section order in the right panel. */
  sections: string[];
  variables: ModeVariable[];
  /** False for a mode that is planned but not built (3D object, video). */
  available: boolean;
  /** Which left-panel specs this mode uses. */
  uses: ("product" | "model" | "reference" | "count")[];
}

export interface Specs {
  format: Format;
  count: number;
  /** The image model; staff only, never shown to a customer. */
  imageModel: string;
  referenceIds: Id[];
  productId?: Id;
  variantId?: Id;
  modelIds: Id[];
  /** v4: the placement it is made for; the ratio follows (FLOWS §15). */
  placementId?: Id;
}

/** A change to the product's data made in the Studio (FLOWS §9.5). */
export interface ProductOverride {
  id: Id;
  productId: Id;
  /** The Product Truth line it changes ("Cap"). */
  field: string;
  value: string;
  was: string;
  /** this_render: stored on the document only; product: a proposal to the customer to change the product itself. */
  scope: "this_render" | "product";
  by: Id;
  at: Instant;
  /** For scope product: proposed until the customer approves. */
  state: "applied" | "proposed" | "approved" | "declined";
}

/** A layer of a Design creative (and the picked render under it). */
export interface Layer {
  id: Id;
  kind: "image" | "text" | "logo" | "shape";
  name: string;
  /** Position and size, 0–1 of the frame. */
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
  image?: string;
  /** For text: the role in the brand's type scale. */
  style?: "headline" | "body" | "small";
  visible: boolean;
  locked?: boolean;
}

/** One render: a version in the strip at the bottom. Nothing is overwritten (FLOWS §9.2). */
export interface RenderVersion {
  id: Id;
  number: number;
  image: string;
  at: Instant;
  by: Id;
  state: "rendering" | "done" | "failed";
  variables: Variables;
  specs: Specs;
  evaluation: Evaluation;
  /** The Engine bar instruction that led to it, if any. */
  instruction?: string;
  /** Staff only. */
  cost: number;
  /** v4: the product details the Engine masked and read on this render (FLOWS §17). */
  details?: DetailFind[];
}

/** What the Engine changed from words in the Engine bar, shown before it renders (FLOWS §9.1). */
export interface EngineEdit {
  id: Id;
  text: string;
  changes: { key: string; label: string; from: VarValue; to: VarValue }[];
  by: Id;
  at: Instant;
  state: "proposed" | "kept" | "undone";
}

/** The project file of one creative, like a PSD (FLOWS §9.2). */
export interface CreativeDocument {
  id: Id;
  workspaceId: Id;
  campaignId?: Id;
  creativeId?: Id;
  title: string;
  /** The planned creative it fills ("Master 3 · feed"). */
  slot?: string;
  studio: StudioKind;
  modeId: Id;
  variables: Variables;
  specs: Specs;
  overrides: ProductOverride[];
  layers: Layer[];
  versions: RenderVersion[];
  /** The version that goes to the check. */
  pickedVersionId?: Id;
  edits: EngineEdit[];
  /** v4: where each look section comes from (FLOWS §18), by section name. */
  sources?: Record<string, LookSource>;
  /** v4: Make formats (FLOWS §16). */
  formats?: FormatTile[];
  /** v4: product fixes, automatic and by hand (FLOWS §17). */
  fixes?: ProductFix[];
  state: "draft" | "in_check" | "checked";
  by: Id;
  updatedAt: Instant;
}

// ─── v3 §9.4 and §9.6 Brand assets: presets, models (AI people), references ─────────────────────────────────

export type BrandPresetKind = "background" | "colour" | "light";

/** The brand's chosen colours, backgrounds and light, first in every swatch (FLOWS §9.4). */
export interface BrandPreset {
  id: Id;
  workspaceId: Id;
  kind: BrandPresetKind;
  name: string;
  hex?: string;
  /** For light: the setting in words ("Low side light, 2700 K"). */
  value?: string;
  /** Where it is used ("Packshot background"). */
  use: string;
  provenance: Provenance;
}

/** draft: a designer's; saved: in the brand's library (Fume); approved or declined: the customer decided. */
export type AssetState = "draft" | "saved" | "approved" | "declined";

/** An AI person made in Model mode. Always labelled as an AI person (F-D041). */
export interface BrandModel {
  id: Id;
  workspaceId: Id;
  name: string;
  image: string;
  /** The model sheet: front, side, three quarter. */
  sheet: string[];
  /** The Model mode variables it was made from (the JSON the Engine prompts from). */
  variables: Variables;
  look: string;
  state: AssetState;
  isAiPerson: true;
  madeBy: Id;
  savedBy?: Id;
  decidedBy?: Id;
  at: Instant;
  documentId?: Id;
  /** Creatives it appears in. */
  usedIn: number;
}

/** A reference in the brand's library: made in Reference maker, uploaded, or from the brand. */
export interface BrandReference {
  id: Id;
  workspaceId: Id;
  name: string;
  image: string;
  origin: "made" | "upload" | "brand";
  state: "draft" | "saved";
  madeBy: Id;
  at: Instant;
  documentId?: Id;
}

// ─── v3 §10 QA (Fume's people) ───────────────────────────────────────────────

export interface QaFeedback {
  id: Id;
  text: string;
  by: Id;
  at: Instant;
  /** sent: the Engine is fixing it; fixed: the fix is back in QA. */
  state: "sent" | "fixed";
}

export interface QaItem {
  id: Id;
  workspaceId: Id;
  campaignId: Id;
  creativeId: Id;
  documentId?: Id;
  title: string;
  slot: string;
  studio: StudioKind;
  image: string;
  format: Format;
  madeAt: Instant;
  dueAt: Instant;
  risk: "normal" | "high";
  state: "waiting" | "fixing" | "checked" | "in_studio";
  evaluation: Evaluation;
  feedback: QaFeedback[];
  /** Design creatives can be changed directly in QA (FLOWS §10). */
  layers?: Layer[];
  checkedBy?: Id;
  checkedAt?: Instant;
}

// ─── v3 §11 Review like frame.io ─────────────────────────────────────────────

export interface ReviewComment {
  id: Id;
  creativeId: Id;
  versionId: Id;
  by: Id;
  text: string;
  /** A pin on the creative, 0–1 from the top left; none for a plain comment. */
  pin?: { x: number; y: number };
  at: Instant;
  resolved?: boolean;
  replies: { id: Id; by: Id; text: string; at: Instant }[];
}

export interface Rating {
  creativeId: Id;
  versionId: Id;
  by: Id;
  stars: 1 | 2 | 3 | 4 | 5;
  at: Instant;
}

// ─── v3 §14 Taste keeps learning ─────────────────────────────────────────────

export type TasteArea = "light" | "colour" | "people" | "composition" | "styling";

export interface TasteCard {
  id: Id;
  /** pair: which is more LYSNE; single: LYSNE or not. */
  kind: "pair" | "single";
  area: TasteArea;
  question: string;
  a: string;
  b?: string;
}

export interface TasteState {
  /** How sure the Engine is per area, 0–1. */
  confidence: Record<TasteArea, number>;
  answered: number;
  /** What the Engine learned last, in words. */
  lastLesson?: string;
  updatedAt: Instant;
}

// ─── v3 §12 A brief without chat, and §9.7 batches ───────────────────────────

export interface BriefOrder {
  name: string;
  goal: string;
  productIds: Id[];
  collectionIds: Id[];
  channels: Channel[];
  formats: Format[];
  deadline?: Instant;
  notes: string;
  /** v5 (UX review H6): the brief's own lines, written by hand on the form, so nothing is left "Not set yet". */
  audience?: string;
  message?: string;
  mandatory?: string[];
  never?: string[];
  references: string[];
  /** v5: a moodboard started on the spot (Marcus 15 Oct): becomes the campaign's campaign_moodboard board. */
  moodboard?: { images: string[] };
}

export interface Batch {
  id: Id;
  workspaceId: Id;
  campaignId: Id;
  modeId: Id;
  productIds: Id[];
  collectionId?: Id;
  perProduct: number;
  format: Format;
  state: "queued" | "running" | "done";
  made: number;
  total: number;
  previews: string[];
  by: Id;
  at: Instant;
}

// ─── v4 §15–§16 Placements and Make formats (PROPOSED 15 Oct 2026) ──────────────────────────────────────────

/** A placement: where a creative runs. Its ratio follows from it (FLOWS §15). */
export interface Placement {
  id: Id;
  name: string;
  /** Grouping in the picker: "Instagram", "Meta ads", "Email", "Web". */
  group: string;
  ratio: string;
  width: number;
  height: number;
  /** The short form the rest of the app uses. */
  format: Format;
  /** Areas the platform covers, 0–1 from each edge. */
  safe: { top: number; bottom: number; left: number; right: number };
  textLimit?: string;
}

/** One target placement in Make formats (FLOWS §16). */
export interface FormatTile {
  placementId: Id;
  /** What the Engine chose and why; the designer can switch. */
  method: "native" | "crop" | "expand";
  engineChose: "native" | "crop" | "expand";
  why: string;
  /** For crop: the window on the source, 0–1. */
  crop?: { x: number; y: number; w: number; h: number };
  image?: string;
  state: "waiting" | "making" | "done";
}

// ─── v4 §17 Product fix ──────────────────────────────────────────────────────

/** A real detail of the real product the Engine protects (FLOWS §17). */
export interface DetailToken {
  id: Id;
  productId: Id;
  label: string;
  /** What it must read or look like: "100 ml". */
  value: string;
  kind: "text" | "label" | "cap" | "logo" | "material";
  /** The cut-out of the real product. */
  image: string;
  /** Where it sits on the product's main image, 0–1. */
  region: { x: number; y: number; w: number; h: number };
  provenance: Provenance;
}

/** A detail the Engine found on a render, with what it read. */
export interface DetailFind {
  tokenId: Id;
  /** Where it is on the render, 0–1. */
  region: { x: number; y: number; w: number; h: number };
  read: string;
  ok: boolean;
}

export interface ProductFix {
  id: Id;
  tokenId?: Id;
  region: { x: number; y: number; w: number; h: number };
  found: string;
  expected: string;
  /** auto: the Engine's own pass before QA; by hand: a designer asked. */
  auto: boolean;
  by: Id | "engine";
  at: Instant;
  state: "fixing" | "fixed";
  /** The version the fix made. */
  versionId?: Id;
}

// ─── v4 §18 Light and camera ─────────────────────────────────────────────────

export type LookSource = "brand" | "campaign" | "fume" | "own" | "engine";

/** A campaign's own look (Marcus 15 Oct: "Black Friday has completely different colours"): it wins over the brand's
 *  presets in every creative made for the campaign, and shows as the source "Campaign" in the Studio. */
export interface CampaignLook {
  colours: { name: string; hex: string; use: string }[];
  backgrounds: { name: string; hex: string }[];
  light?: string;
  /** In words: what makes this campaign look different from the brand. */
  note: string;
  provenance: Provenance;
}

export interface LightSource {
  id: Id;
  kind: "key" | "fill" | "rim" | "practical";
  /** Position on the light board over the canvas, 0–1. */
  x: number;
  y: number;
  /** Height above the subject, degrees 0–90. */
  height: number;
  warmth: number;
  strength: number;
  softness: number;
}

export interface LightRig {
  lights: LightSource[];
}

export interface CameraPreset {
  id: Id;
  origin: "brand" | "fume";
  workspaceId?: Id;
  name: string;
  /** The camera and lens, in words: "Hasselblad X2D · XCD 90 mm". */
  body: string;
  lens: Lens;
  image: string;
  note: string;
}

export interface LightPreset {
  id: Id;
  origin: "brand" | "fume";
  workspaceId?: Id;
  name: string;
  value: string;
  rig: LightRig;
}

// ─── v4 §19 The Engine chat (Fume's people) ──────────────────────────────────

export type EngineWidget =
  | { kind: "products"; productIds: Id[]; picked?: Id[] }
  | { kind: "choice"; question: string; options: string[]; answer?: string }
  | { kind: "batch"; batchId: Id }
  | { kind: "document"; documentId: Id };

export interface EngineMessage {
  id: Id;
  workspaceId: Id;
  author: { kind: "person"; userId: Id } | { kind: "engine" };
  text: string;
  at: Instant;
  widget?: EngineWidget;
}

// ─── v4 §20–§21 Usage, meetings, calendar ────────────────────────────────────

export interface UsageRow {
  workspaceId: Id;
  renders: number;
  cost: number;
  creatives: number;
  delivered: number;
  /** Renders per week, last 8 weeks, oldest first. */
  trend: number[];
}

export interface Meeting {
  id: Id;
  workspaceId: Id;
  topic: string;
  at: Instant;
  minutes: number;
  /** Fume's person, and who joins from the brand. */
  hostId: Id;
  guestIds: Id[];
  state: "booked" | "done" | "cancelled";
}

export interface CalendarEntry {
  id: Id;
  workspaceId: Id;
  kind: "campaign" | "drop" | "delivery" | "post" | "meeting";
  title: string;
  start: Instant;
  end?: Instant;
  placementId?: Id;
  creativeId?: Id;
  campaignId?: Id;
  meetingId?: Id;
  image?: string;
}

// ─── v6 Product kinds: what the Engine needs to know about a product, per category (round 6, PROPOSED 15 Oct) ───
// Like Studio modes, a product category is a schema (Marcus 15 Oct: "velger man produkt kategori når man legger til
// produkt, er masse data Engine krever for å få fidelity, inkludert mål og alt"). Research and sources:
// /mnt/project-files/app/product-data-research.md.

export type SpecFieldType = "text" | "number" | "dimensions" | "colour" | "material" | "finish" | "choice" | "list" | "image" | "file" | "blend" | "measurements" | "parts";

export type SpecGroupId = "identity" | "size" | "materials" | "packaging" | "label" | "variants" | "use" | "construction" | "decoration" | "formula" | "trims" | "care";

export type Finish = "matte" | "satin" | "gloss" | "frosted" | "metallic" | "brushed" | "soft-touch" | "textured";

export interface SpecField {
  id: Id;
  label: string;
  type: SpecFieldType;
  /** number: the unit ("ml"); the first of units is the default. */
  units?: string[];
  /** choice, material and finish: the options, in the customer's words. */
  options?: string[];
  /** Needed for fidelity: without it the Engine guesses, so it counts in the fidelity score. */
  required: boolean;
  /** One line under the field: why the Engine needs it, or how to measure it. */
  help?: string;
  placeholder?: string;
  /** A label line the Engine also protects as a detail token (FLOWS §17). */
  detail?: DetailToken["kind"];
  /** Limits what a creative may say (claims, INCI, allergens), never how it looks. */
  compliance?: boolean;
  /** v7: which of the three levels it belongs to (short: always on top; full: the kind's sections; technical: factory
   *  data beside the files). Left out = full. `required` means Engine-critical. */
  level?: SpecLevel;
  /** v7 measurements: the sizes a new table starts with. */
  sizes?: string[];
  /** v7 measurements: the points of measure a new table starts with. */
  poms?: string[];
}

export interface SpecGroup {
  id: SpecGroupId;
  /** v7: one line under the section title, in the customer's words. */
  text?: string;
  title: string;
  fields: SpecField[];
}

/** One angle the Engine needs a reference photo from. */
export interface ShotSlot {
  id: Id;
  label: string;
  help: string;
  required: boolean;
}

/** A category template: its fields, its shot slots, the parts a product of this kind usually has. */
export interface ProductKind {
  id: Id;
  name: string;
  /** "Serum, oil, cream, balm". */
  examples: string;
  /** A picture for the kind grid. */
  image?: string;
  groups: SpecGroup[];
  shots: ShotSlot[];
  /** Proposed when a product of this kind is added ("Bottle", "Cap", "Box"). */
  parts: string[];
  /** Files that raise fidelity a lot for this kind (3D model, dieline, artwork). */
  files: { kind: ProductFile["kind"]; label: string; help: string }[];
}

export interface Dimensions {
  /** Width, or the diameter of a round thing. */
  w: number;
  h: number;
  /** Depth; left out for a round thing. */
  d?: number;
  unit: "mm" | "cm";
  shape: "round" | "box" | "flat";
}

export interface ColourValue {
  name: string;
  hex: string;
  pantone?: string;
}

export type SpecValue = string | number | string[] | Dimensions | ColourValue | ColourValue[] | FibreBlend | MeasureTable | PartsValue;

export interface SpecEntry {
  fieldId: Id;
  value: SpecValue;
  /** number: the unit it was given in. */
  unit?: string;
  provenance: Provenance;
  /** A label line linked to the detail token the Engine protects. */
  detailTokenId?: Id;
}

export interface ProductPart {
  id: Id;
  name: string;
  material?: string;
  finish?: Finish;
  opacity?: "opaque" | "translucent" | "clear";
  colour?: ColourValue;
  note?: string;
  /** v7: how it is decorated (screen print, hot-foil, emboss). */
  decoration?: string;
  provenance: Provenance;
}

export interface ReferenceShot {
  slotId: Id;
  image: string;
  provenance: Provenance;
}

export interface ProductFile {
  id: Id;
  kind: "model" | "dieline" | "artwork" | "techpack" | "flats" | "cad" | "spec";
  name: string;
  bytes: number;
  at: Instant;
  by: Id;
  /** v7: what the Engine read from it, one line each ("12 points of measure × 5 sizes"). */
  read?: string[];
  /** v7: the fields it filled. */
  filled?: Id[];
}

/** One thing still missing for fidelity, with the one action that fills it. */
export interface FidelityGap {
  kind: "field" | "shot" | "proposals";
  id: Id;
  label: string;
  groupId?: SpecGroupId;
}

// ─── v9 Update the brand (round 7, points 2, 3, 5; PROPOSED 16 Oct 2026) ─────
// An onboarded brand is read again (the website) or given a zip of new things. The Engine compares what it reads with
// the approved Brand DNA and keeps only what is new, changed or unsure; the customer goes through it in the shared
// "What the Engine found" review. Products it sees are only counted and linked (point 5), never imported here.

export type FoundStatus = "new" | "changed" | "unsure";

export interface BrandFound {
  id: Id;
  kind: "image" | "colour" | "typeface" | "voice" | "logo" | "rule";
  status: FoundStatus;
  title: string;
  subtitle?: string;
  /** The tile's picture: an image find, or the first picture of a set. */
  image?: string;
  /** A set of pictures read together (a campaign), shown as one tile. */
  images?: string[];
  /** What Brand DNA holds now (a hex, a typeface name, a line), for a Changed or Unsure item. */
  before?: string;
  /** What the Engine read now. */
  after?: string;
  /** The Brand DNA item it changes, when it changes one. */
  targetId?: Id;
  confidence: Confidence;
  /** Where the Engine read it ("lysne.no/about"). */
  source: string;
  /** Why the Engine is unsure, or what it noticed. */
  note?: string;
  /** The customer's answer, once given. */
  decision?: "kept" | "removed" | "fixed";
}

export interface BrandUpdate {
  id: Id;
  workspaceId: Id;
  source: "website" | "upload";
  url?: string;
  files: string[];
  state: "reading" | "ready" | "applied" | "failed";
  /** What the Engine is reading now, in words ("Reading lysne.no/about"). */
  reading?: string;
  sources: BrandScan["sources"];
  found: BrandFound[];
  /** How many things the Engine read that match the approved Brand DNA (not shown as items). */
  unchanged: number;
  /** Products it saw that Products does not hold yet: a link only (round 7, point 5). */
  products?: { count: number; names: string[] };
  startedAt: Instant;
  appliedAt?: Instant;
  appliedBy?: Id;
  error?: string;
}

// ─── v7 Product data in three levels (round 7, PROPOSED 16 Oct) ─────────────────
// Research: /mnt/project-files/app/product-data-research.md §7–17.

export type SpecLevel = "short" | "full" | "technical";

/** Fibres by weight, highest first; the percentages sum to 100 (EU 1007/2011 art. 9). */
export interface FibreBlend {
  fibres: { fibre: string; pct: number }[];
}

/** Points of measure × sizes, each with its tolerance (a tech pack's measurement chart). */
export interface MeasureTable {
  unit: "cm" | "mm" | "in";
  sizes: string[];
  /** The sample size the others are graded from. */
  base?: string;
  rows: { pom: string; code?: string; values: (number | null)[]; tol?: number; how?: string }[];
}

/** One part of a product as data: a garment trim, a shoe component, a furniture part, a surface of a device. */
export interface SpecPart {
  name: string;
  material?: string;
  finish?: string;
  colour?: ColourValue;
  decoration?: string;
  /** A size or amount: "0.35 ct", "15 mm", "6 cm". */
  size?: string;
  note?: string;
}

export interface PartsValue {
  parts: SpecPart[];
}

// ─── v8 Import products (round 7, PROPOSED 16 Oct, worker W) ─────────────────────
// Products get their own "Import products" (Marcus 16 Oct, decided points 2 and 3): from the website, a CSV or an
// unsorted zip. The Engine reads, groups and compares with the catalogue, then shows "What the Engine found".

export type ImportSource = "website" | "csv" | "zip";

/** One file the Engine read: a page of the website, a row's picture, a file in the zip. */
export interface ImportFile {
  name: string;
  bytes?: number;
  kind: "page" | "picture" | "pdf" | "spec" | "techpack" | "artwork" | "other";
  /** A picture's preview. */
  src?: string;
}

/** One value the Engine read for a found product, in words; before = what Fume holds now (a changed product). */
export interface ImportField {
  /** A field of the product's kind ("net", "claims"), or name, variant, sku, price. */
  fieldId: Id;
  label: string;
  value: string;
  before?: string;
  source?: string;
}

export interface FoundProduct {
  id: Id;
  status: "new" | "changed" | "unsure";
  name: string;
  variant?: string;
  /** The kind the Engine proposes, and how sure it is of it. */
  kindId?: Id;
  kindConfidence?: Confidence;
  /** How sure the Engine is of the whole (the grouping, for a zip). */
  confidence: Confidence;
  images: string[];
  /** The files grouped into this product (zip), the pages it was read on (website), the row (CSV). */
  files: ImportFile[];
  fields: ImportField[];
  /** Changed: the product in the catalogue it updates. */
  productId?: Id;
  /** Changed: one line on what is new ("New size: 100 ml"). */
  changes?: string;
  /** Changed: the new main picture and variant line, applied on approval. */
  patch?: { variant?: string; image?: string };
  /** Unsure: why, in one line ("These 3 pictures might be one product"). */
  note?: string;
  source?: string;
  /** The customer's answer on this one item, before Approve all. */
  decision?: "kept" | "fixed";
}

/** A CSV column and the Fume field the Engine maps it to; sure = no need to ask. */
export interface ImportColumn {
  column: string;
  sample: string;
  fieldId: Id | null;
  sure: boolean;
  /** Unsure: why, in one line ("Could be millilitres or a garment size"). */
  why?: string;
}

export interface ImportJob {
  id: Id;
  workspaceId: Id;
  source: ImportSource;
  /** website: the address; csv and zip: the file's name. */
  url?: string;
  fileName?: string;
  /** reading → (csv, when unsure) mapping → review → done; dismissed once the customer closes the result. */
  state: "reading" | "mapping" | "review" | "done" | "dismissed";
  /** 0–1. */
  progress: number;
  /** What the Engine is reading now ("Reading lysne.no/products/body-scrub"). */
  reading?: string;
  /** Counts found so far ("Pages read 31", "Products found 4"). */
  counts: { label: string; n: number }[];
  /** What it has read, newest last (the last few are shown, quietly). */
  log: string[];
  /** csv: the columns and the Engine's guesses; shown only when one is not sure. */
  columns?: ImportColumn[];
  /** csv: the Fume fields a column can map to. */
  fieldOptions?: { id: Id; label: string }[];
  found: FoundProduct[];
  /** Products it read that are exactly as Fume holds them (not shown as items). */
  unchanged: number;
  unchangedNames?: string[];
  /** zip: files that are not about a product. */
  setAside?: { count: number; line: string };
  /** After approval: the products that landed or changed. */
  result?: { productIds: Id[]; added: number; updated: number };
  startedAt: Instant;
  approvedAt?: Instant;
  approvedBy?: Id;
}

// ── round 8 CHAT ──
/** Round 8 (CHAT, TASK-1): Fume's product question names the products the customer asked for that wait to be
 *  confirmed. Confirming the last of them over the conversation answers the question, so Fume moves on. */
export type ProductQuestionCard = Extract<MessageCard, { kind: "question" }> & { named?: Id[] };

// ── round 9 campaign ──
/** Round 9 (UX review DLOAD-3, PROPOSED 19 Oct 2026): what the one status sentence (copy.campaignStatus) needs beyond
 *  the state and the counts. The backend fills it on every campaign it returns, so Home, the Campaigns list, the
 *  campaign header, ⌘K, the collection and the chat all say the same sentence with the same numbers. */
export interface CampaignWaits {
  /** Questions Fume still has for the brief (its missing lines). */
  questions: number;
  /** Directions ready to choose from. */
  directions: number;
  /** The brief is complete and waits on its approval. */
  briefReady: boolean;
  /** The date Fume works to for the step under way (the service clock), while it runs. Never the go-live. */
  by?: Instant;
}

// Interfaces merge: this adds one optional field to Campaign above. `dueAt` there is the go-live ("Live from").
export interface Campaign {
  /** Round 9: see CampaignWaits. */
  waits?: CampaignWaits;
}

// ── round 9 forms ──
// Interfaces merge: this adds three optional lines to BriefOrder above (UX review DTSK-12, PROPOSED 19 Oct 2026). The
// brief written by hand says how many creatives it takes from the package and for which market, so "Approve and
// start" approves the whole brief the customer saw.
export interface BriefOrder {
  /** How many creatives the brief asks for; left out, Fume plans four per format. */
  creatives?: number;
  /** Where it runs and in which language; left out, the workspace's own. */
  market?: string;
  language?: string;
}

// ── round 10 the plan ──
// The plan (FLOWS §22, PROPOSED 20 Oct 2026; Marcus: "hvor er planen som blir lagd før Engine genererer? Kunden må jo
// godkjenne det før Engine begynner å generere."). Fume writes it from the brief she sent, the expert checks it, she
// approves it, and only then does the Engine make anything. One document: the brief in words, the direction (with the
// ones Fume also considered), the variables, every creative the Engine will make, the rules it keeps, and when.

export type PlanState = "writing" | "in_check" | "ready" | "changes_asked" | "approved";

/** Where a line of the plan comes from: her brief, her Brand DNA, her taste, her moodboard, an approved campaign
 *  (Creative Memory), a product's Product Truth, Fume's own proposal, or her change. */
export type PlanSource = "brief" | "brand_dna" | "taste" | "moodboard" | "memory" | "product" | "fume" | "you";

/** One line of the plan: "Light · Low, warm side light from a window at dusk". */
export interface PlanLine {
  key: string;
  label: string;
  value: string;
  source: PlanSource;
  /** Why, in one line, when the source alone does not say it: "You chose warm light three times". */
  why?: string;
  /** Set when she changed it in place. */
  changedBy?: Id;
  changedAt?: Instant;
}

export interface PlanReference {
  image: string;
  /** What it shows or why it is here, one line. */
  caption: string;
  source: PlanSource;
  /** The campaign it comes from, for source "memory". */
  campaignId?: Id;
}

/** A creative before it exists: what the Engine will make. */
export interface PlannedCreative {
  id: Id;
  /** "Master 1", "Feed A1" */
  name: string;
  kind: "master" | "variant";
  /** For a variant: the master it comes from. */
  of?: Id;
  format: Format;
  productIds: Id[];
  /** The scene in one line: "The oil in its gift sleeve on linen, the candle lit behind". */
  scene: string;
  /** The words on the creative, in the market's language; none for a picture without words. */
  text?: string;
  /** "No people", "Hands only", "Ane (AI person)" */
  people: string;
  changedBy?: Id;
  changedAt?: Instant;
}

export interface PlanDirection {
  id: Id;
  letter: "A" | "B" | "C";
  name: string;
  /** Two or three sentences. */
  idea: string;
  hook: string;
  /** Each reason names its source. */
  why: { text: string; source: PlanSource }[];
  references: PlanReference[];
  /** The look for this direction: light, camera, set, props, colour, people. */
  look: PlanLine[];
  /** What the Engine makes in this direction. */
  creatives: PlannedCreative[];
  /** Fume's pick. */
  recommended?: boolean;
}

export interface PlanStep {
  /** "Masters, checked", "Variants and formats", "Delivery", "Goes live" */
  label: string;
  at: Instant;
}

export interface CampaignPlan {
  campaignId: Id;
  version: number;
  state: PlanState;
  /** The brief in words: Fume's paragraph. */
  summary: string;
  /** The brief version the plan was written from. */
  briefVersion: number;
  directions: PlanDirection[];
  chosenDirectionId: Id;
  /** Why she took another direction than Fume's pick, if she said. */
  chosenReason?: string;
  /** What the Engine holds to on every creative besides the look: products, formats, text, call to action, logo, language. */
  content: PlanLine[];
  /** Must show and never (from her brief) and the Brand DNA rules that apply. */
  rules: { text: string; kind: "must" | "never"; source: PlanSource; ruleId?: Id }[];
  timeline: PlanStep[];
  changeRequestsIncluded: number;
  /** The latest version's note: what Fume changed, or what she asked for while it is being changed. */
  note?: { by: Id | "fume"; text: string; at: Instant };
  writtenAt?: Instant;
  /** Expected while it is being written or checked. */
  readyBy?: Instant;
  checkedBy?: Id;
  checkedAt?: Instant;
  approvedBy?: Id;
  approvedAt?: Instant;
}

/** Interfaces merge: the plan's state on every campaign, so the one status sentence can say it (copy.campaignStatus). */
export interface CampaignWaits {
  plan?: PlanState;
}

// ── round 10 FLOW ──
/** Interfaces merge: how many masters the Engine is making, while the masters are the step under way and the count is
 *  known (the approved plan's masters), so the status sentence says "The Engine is making the 3 masters". */
export interface CampaignWaits {
  masters?: number;
}

// ── round 11 agencies ──
// FLOWS §24 (PROPOSED 20 Oct 2026): an agency is an Organisation of kind "agency"; each client brand is a Workspace
// it runs. Agency people have one role across the agency's clients; client people keep the customer roles of §2.

export type OrganisationKind = "brand" | "agency";
/** lead: everything a creative does, plus clients, the agency team, licence and usage. creative: briefs, plans,
 *  the Studio and the Engine chat, checks, Send to client. */
export type AgencyRole = "lead" | "creative";

/** Interfaces merge: an agency organisation says so. */
export interface Organisation {
  kind?: OrganisationKind;
}

/** Interfaces merge: a brand an agency runs names the agency (its Organisation id). */
export interface Workspace {
  agencyId?: Id;
}

/** An agency person's seat in the agency. */
export interface AgencySeat {
  organisationId: Id;
  role: AgencyRole;
}

/** Interfaces merge: set for agency people (they also check, so they carry staffRole "expert" in the mock). */
export interface User {
  agency?: AgencySeat;
}

/** Interfaces merge: an approval the client gave outside Fume, recorded by the agency (FLOWS §24.5). */
export interface CreativeVersion {
  /** The agency person who recorded the client's approval; approvedBy is still the client. */
  recordedBy?: Id;
  /** How the client approved: "In our meeting on 19 Oct". */
  recordedNote?: string;
}

/** One client brand as the agency sees it (Home's cards, Clients, the picker and the sidebar list). */
export interface AgencyClient {
  workspace: Workspace;
  /** One sentence on where the client stands, by its most urgent campaign: "Winter gifting: the plan is ready to approve". */
  status: string;
  /** What waits on the agency in this client, as a count (the picker's dot, the list's count). */
  waitingOnYou: number;
  /** Who the work waits on when it is the client: "Waiting on Maja". */
  waitingOn?: string;
  /** The client's picture for its card (a recent creative or its product). */
  picture?: string;
  campaignsActive: number;
  /** The current campaign and how far it is, 0 to 1 (approved creatives over planned). */
  current?: { campaignId?: Id; name: string; progress: number; detail: string };
  nextDelivery?: { title: string; at: Instant };
  /** The client's own people in Fume. */
  people: User[];
  /** The agency person who leads the client. */
  lead?: User;
  /** The preview has full example data for LYSNE only; the others are shown at the agency level. */
  example: "full" | "summary";
  since: Instant;
  /** When the signed-in person last opened it (recent first in the picker). */
  openedAt?: Instant;
}

/** Something across the agency's clients that waits on the agency (Home's "Needs you"). */
export interface AgencyNeed {
  id: Id;
  clientId: Id;
  kind: "plan" | "check" | "client_changes" | "brief" | "products" | "brand";
  /** "LYSNE · Winter gifting" */
  title: string;
  /** "The plan is ready to approve" */
  detail: string;
  /** The pill: "Open the plan", "Check", "Open". */
  action: string;
  href: string;
  picture?: string;
  at: Instant;
}

/** One agency person this week (Home's "Team this week", Team). */
export interface AgencyTeamMember {
  user: User;
  role: AgencyRole;
  /** The clients they lead or work on. */
  clientIds: Id[];
  /** 0 to 1: this week's load. */
  load: number;
  /** "12 creatives to check · LYSNE, HALM" */
  thisWeek: string;
}

export interface AgencyHomeView {
  agency: Organisation;
  /** One line under the greeting: "Four client brands. Two plans wait on you; Maja has 6 creatives to approve." */
  summary: string;
  clients: AgencyClient[];
  needsYou: AgencyNeed[];
  team: AgencyTeamMember[];
}

/** A campaign in the agency's table across clients. */
export interface AgencyCampaignRow {
  campaign: Campaign;
  client: Workspace;
  /** copy.campaignStatus's sentence, made by the mock the same way */
  status: string;
  waitingOn?: string;
  liveAt?: Instant;
  example: "full" | "summary";
}

/** The agency licence (FLOWS §24.6): a fixed platform fee, production by use. No prices in the demo. */
export interface LicenceView {
  agency: Organisation;
  period: { from: Instant; to: Instant };
  /** "Early access: product campaigns for paid social, scoped with Fume on 6 Oct" */
  scope: string;
  usage: { client: Workspace; creativesMade: number; creativesApproved: number }[];
  total: { creativesMade: number; creativesApproved: number };
  seats: { used: number; included: number };
}

/** A client link: opens only the creatives sent, with Approve and Ask for changes (FLOWS §24.5). */
export interface ClientLink {
  token: string;
  url: string;
  expiresAt: Instant;
}

/** Creatives the agency sent to the client to approve. */
export interface ClientSend {
  id: Id;
  campaignId: Id;
  workspaceId: Id;
  /** The creatives sent (none when the send carries only the plan). */
  versionIds: Id[];
  /** Round 13 (Marcus's card, 23 Oct 2026, DECIDED): the plan the agency checked and sent to the client to approve, by
   *  its version. The client approves it in Fume or in the client link, the same link she approves the creatives in. */
  plan?: { version: number };
  /** Client people notified in Fume. */
  to: Id[];
  link?: ClientLink;
  note?: string;
  sentBy: Id;
  sentAt: Instant;
}

/** What a client link opens: the brand, the campaign, the creatives sent and who sent them. */
export interface ClientLinkView {
  send: ClientSend;
  client: Workspace;
  agency: Organisation;
  campaign: Campaign;
  creatives: Creative[];
  sentBy: User;
}

// ── round 11 client flow ──
// FLOWS §24.5 (PROPOSED 20 Oct 2026): a client link names each creative as Fume names it for the customer.
/** Interfaces merge: what the client link calls each creative (creative id → "Night Body Oil · Feed A3"), the same
 *  customer name the client reads in Fume; without it the page says the campaign's name and the format. */
export interface ClientLinkView {
  names?: Record<Id, string>;
}
/** Interfaces merge (round 13, Marcus's card 23 Oct 2026, DECIDED): one client link per campaign. It opens the plan the
 *  agency sent first and, later, the creatives sent in the same link; `creatives` holds every one sent in it. */
export interface ClientLinkView {
  /** The plan, when the link carries it: as it stands now (a version the client asked to change is being rewritten). */
  plan?: CampaignPlan;
  /** The newest send that carried the plan: its version, its note and when. */
  planSend?: ClientSend;
}

// ── round 12 numbers ──
/** Interfaces merge (UX review DLOAD-1, DLOAD-5, PROPOSED 20 Oct 2026): how many checked creatives are not sent to the
 *  customer yet (in Fume, a checked set waiting for its release; in an agency, what it has not sent to the client).
 *  copy.campaignStatus says "6 creatives to send to Maja" for them, and "with Maja" only for the rest. */
export interface CampaignWaits {
  toSend?: number;
  /** The plan's delivery date (its timeline's "Delivery" step), never the go-live (DLOAD-13). */
  delivery?: Instant;
  /** How many creatives the plan holds, before they are made ("Planned: 9 creatives", DLOAD-21). */
  planned?: number;
  /** Round 13 (Marcus's card, 23 Oct 2026): a ready plan someone checked. In a brand an agency runs, the agency checked
   *  it and sent it to the client, so it waits on her ("The plan waits on Maja"); unchecked, it waits on the agency. */
  planChecked?: boolean;
}

// ── round 12 desk ──
/** Interfaces merge (UX review DTASK-5, PROPOSED 20 Oct 2026): a run started in the Engine chat lands its creatives in
 *  Check one by one; each item names the run (the batch) it came from, so the run card can say "Landing in Check ·
 *  2 of 4" and open Check at that run. */
export interface QaItem {
  runId?: Id;
}

/** One part of an Engine bar instruction (DTASK-18): the words, the variables it changed, or why nothing changed
 *  ("Placement is already Low") and, where the Engine has a guess, the change it would make if asked. */
export interface EngineEditPart {
  text: string;
  keys: string[];
  note?: string;
  suggestion?: { key: string; label: string; from: VarValue; to: VarValue };
}
/** Interfaces merge (DTASK-18): an Engine bar edit lists each part of the instruction, read or not. */
export interface EngineEdit {
  parts?: EngineEditPart[];
}

/** What the Engine chat has been told for the next run (DLAY-13): its products, mode, count, campaign and format,
 *  and the one it is asking about now. "No campaign" is the product page. */
export interface EngineRunDraft {
  productIds?: Id[];
  mode?: string;
  perProduct?: number;
  campaign?: string;
  format?: string;
  asking?: "products" | "mode" | "count" | "campaign" | "format";
}
/** The Engine chat's answer to a question about the work (DTASK-5): the items in Check it is about. */
export interface EngineCheckAnswer {
  kind: "check";
  itemIds: Id[];
}
/** Interfaces merge (DTASK-5, DLAY-13): an Engine message can answer a question with items in Check, and carries what
 *  the next run has been told so far. */
export interface EngineMessage {
  answer?: EngineCheckAnswer;
  run?: EngineRunDraft;
}

// ── round 12 QA ──
/** Interfaces merge (UX review 20 Oct, DTASK-1, DLOAD-14): a creative in Check knows which version it shows, the one it
 *  replaced when the Studio sent a new version to check (Before | After), who sent it, and who opened it in the Studio. */
export interface QaItem {
  /** The version shown; 1 until the Studio sends a new one. */
  version?: number;
  /** The version it replaced, when the Studio sent a new one to check. */
  previous?: { image: string; version: number };
  /** Who sent the version shown from the Studio, and when. */
  sentBy?: Id;
  sentAt?: Instant;
  /** Who opened it in the Studio, and when (state in_studio). */
  studioBy?: Id;
  studioAt?: Instant;
}

// ── round 12 agency ──
// UX review DTASK-6, DLOAD-7 (PROPOSED 20 Oct 2026): ONE Usage page for Fume's admin and an agency (its Licence and
// usage). Each row carries the same figures for three periods, each with its dates, so no figure stands without its
// period, and Home, the licence and Usage read one number.
export type UsagePeriod = "month" | "last_month" | "weeks";
export interface UsageFigures {
  from: Instant;
  to: Instant;
  /** Creatives the Engine made for the brand in the period. */
  creatives: number;
  /** Creatives the customer (an agency's client) approved in the period. */
  approved: number;
  /** Creatives delivered in the period. */
  delivered: number;
  /** Renders, and what they cost: Fume's people only (0 for an agency, which never sees prices). */
  renders: number;
  cost: number;
}
/** Interfaces merge: the brand, its figures per period and its package (a Fume customer's; an agency's client runs on
 *  the agency's licence, so it has none). */
export interface UsageRow {
  workspace?: Workspace;
  periods?: Record<UsagePeriod, UsageFigures>;
  package?: { used: number; included: number; renewsAt?: Instant };
  /** An agency's example clients other than LYSNE have summary figures only (FLOWS §24.8). */
  example?: "full" | "summary";
}

// ── round 13 campaign ──
// Marcus's video comments (22 Oct 2026; PROPOSED): a campaign in six stages (Brief → Moodboard → Plan → Masters →
// Creatives → Delivery, features/campaigns/stages.ts), the moodboard optional, a plan that needs no expert unless she
// asks for one, each creative's own look and go-live day, and what each plan version changed.
export interface Campaign {
  /** #21: she skipped the moodboard (it stays optional; she can still start one). */
  moodboardSkipped?: boolean;
}
/** #26: a creative's own light, light direction and camera, over the plan's look. */
export interface CreativeLook {
  light?: string;
  direction?: string;
  camera?: string;
}
export interface PlannedCreative {
  /** #26: this creative's own look, when it differs from "The look". */
  look?: CreativeLook;
  /** #67: the day it goes live; left out, the plan's go-live (with the masters first). */
  liveAt?: Instant;
}
/** #25: one version of the plan, and what changed in it ("Master 1's scene: the gift box closed"). */
export interface PlanVersionNote {
  version: number;
  at: Instant;
  by: Id | "fume";
  /** What she asked, in her words (for a version Fume wrote after "Change it with Fume"). */
  asked?: string;
  /** What changed, one line each. */
  changes: string[];
}
export interface CampaignPlan {
  /** Round 13 (Marcus's card, 23 Oct 2026): how the client approved it when not in Fume ("Through the client link, by
   *  Maja Lind"). */
  approvedNote?: string;
  /** #25: she asked the expert to check it (optional); the expert's check is otherwise skipped. */
  checkAsked?: { by: Id; at: Instant };
  /** #25: every version after the first, with what changed. */
  versions?: PlanVersionNote[];
}
/** #22: a brief to start from: Fume's own, or one the Engine made from a past campaign of hers. */
export interface BriefTemplate {
  id: Id;
  kind: "fume" | "yours";
  /** "Product launch", "Like Autumn launch" */
  name: string;
  /** One line on what it is for. */
  description: string;
  goal: string;
  audience: string;
  message: string;
  channels: Channel[];
  formats: Format[];
  creatives?: number;
  mandatory?: string[];
  never?: string[];
  /** The campaign it was made from (kind "yours"). */
  campaignId?: Id;
}

// ─── Round 13 STUDIO (Marcus's video comments #51, #64; PROPOSED 22 Oct 2026) ───────────────────────────────
/** A spot on a creative in Check (#51): a numbered pin, 0–1 from the top left, with what is wrong there. It goes to
 *  the Engine with "Tell the Engine" as a located note, the same pin as the customer's review viewer. */
export interface QaPin {
  n: number;
  x: number;
  y: number;
  text: string;
}
/** Interfaces merge (#51): what was said to the Engine may carry its pins. */
export interface QaFeedback {
  pins?: QaPin[];
}

// ── round 13 brand ──
// Marcus's video comments #2–#5, #41–#47 (22 Oct 2026; PROPOSED): a colour's uses, imagery sorted into groups, a
// deeper voice, rules as Do or Don't, the AI models' sheets and specs, and products found since last time.
// Interfaces merge.

/** #42: what a colour is for, chosen as chips when she confirms or changes it. */
export type ColourUse = "buttons" | "accent" | "backgrounds" | "text" | "light" | "packaging" | "ui";
export interface BrandColour {
  uses?: ColourUse[];
}

/** #3: the group Fume sorts a picture into: the brand's lasting look, a campaign's look (temporary, named after the
 *  campaign or season), a product shot, or not used. She can move a picture to another group. */
export type ImageGroup = "look" | "campaign" | "product" | "unused";
export interface BrandImage {
  group?: ImageGroup;
  /** A campaign look: the campaign or season it belonged to ("Spring relaunch 2026"). */
  campaign?: string;
}

/** #43: a rule says what to do, or what never to do. */
export type RulePolarity = "do" | "dont";
export interface BrandRule {
  polarity?: RulePolarity;
}

/** #41: one angle of an AI model's sheet. Every angle is shot in a white studio in the same plain clothes. */
export type ModelAngle = "front" | "three-quarter" | "profile" | "back" | "face" | "face-three-quarter" | "face-profile";
export interface ModelSpec {
  ageRange: string;
  height: string;
  build: string;
  skinTone: string;
  hair: string;
  eyes: string;
  /** Clothing sizes, for styling: "Top S", "Trousers 36", "Shoes 38". */
  sizes: { label: string; value: string }[];
  /** What the model wears on the sheet. */
  clothing: string;
  allowedUses: string[];
  neverUses: string[];
}
export interface BrandModel {
  angles?: { angle: ModelAngle; image: string }[];
  spec?: ModelSpec;
}

/** #4: the brand's voice in five parts (Fume's own came from a 37-page brand process). */
export type VoicePartId = "identity" | "speak" | "rules" | "audience" | "examples";
export interface VoiceTrait {
  trait: string;
  means: string;
  do: string;
  dont: string;
}
export interface VoiceExample {
  line: string;
  where: string;
  language: "no" | "en";
}
export interface VoiceBook {
  /** What Fume found for each part, in one line, where, and whether she confirmed it. */
  parts: { id: VoicePartId; found: string; provenance: Provenance; note?: string }[];
  identity: { who: string; believe: string[]; personality: string[] };
  speak: { traits: VoiceTrait[]; use: string[]; avoid: string[]; sentences: string; formality: string; languages: string };
  rules: { must: string[]; never: string[]; claims: string[] };
  audience: { who: string; cares: string[]; notFor: string };
  examples: VoiceExample[];
}
/** The brand board's voice lines stay the short form; the book is the whole voice. */
export interface BrandIdentity {
  voiceBook?: VoiceBook;
}

/** #47: neither picture of a pair felt like the brand. */
export interface TastePair {
  neither?: boolean;
}

/** #44: a product Fume found since she last looked at her products ("New"). */
export interface Product {
  isNew?: boolean;
}

// ── round 13 agency ──
// Marcus's video comments #70, #71 (22 Oct 2026; PROPOSED): an agency is like Fume's own studio, but Fume decides
// which features and updates it gets, it has no Fume people unless it borrows them, and it sees no API costs.

/** One feature in an agency's Fume plan: in the plan now, coming (Fume decides when), or on request. */
export interface AgencyFeature {
  id: Id;
  name: string;
  /** One line on what it does. */
  detail: string;
  state: "included" | "coming" | "on_request";
  /** For a coming feature: when Fume plans it ("November", "Later this year"). */
  when?: string;
}

/** Borrow Fume's people for a client's work, or ask Fume's customer service. */
export type FumeRequestKind = "manpower" | "support";
/** What Fume's people do when an agency borrows them. */
export type BorrowedWork = "checks" | "design" | "renders";

export interface FumeRequest {
  id: Id;
  kind: FumeRequestKind;
  /** The client (and campaign) the work is for. */
  clientId?: Id;
  campaignId?: Id;
  work?: BorrowedWork[];
  /** How much: "About 20 creatives". */
  amount?: string;
  /** When: "This week", "By Fri 30 Oct". */
  when?: string;
  /** Customer service: what it is about. */
  topic?: string;
  text?: string;
  by: Id;
  at: Instant;
  state: "sent";
}

/** The agency's plan with Fume: what it has, what comes and who at Fume answers it. */
export interface AgencyFumePlan {
  /** "Agency · early access" */
  name: string;
  /** Who decides: one sentence. */
  decidedBy: string;
  /** The person at Fume who answers the agency (Sander, its producer at Fume). */
  contact?: User;
  features: AgencyFeature[];
  /** What the agency asked Fume for, newest first. */
  requests: FumeRequest[];
}

/** Interfaces merge: a client's people with their role, and a client added just now (Fume is still reading it). */
export interface AgencyClient {
  roles?: Record<Id, CustomerRole>;
  isNew?: boolean;
}

// ─── Round 13 CHAT (Marcus's video comments #14–#20; PROPOSED 22 Oct 2026) ───────────────────────────────────────
/** #15, #16: what a link in the Fume chat points at. On a desk it opens in the panel beside the conversation, with
 *  "Open full page"; on a phone it goes to the page. */
export type ChatLink =
  | { kind: "campaign"; campaignId: Id }
  | { kind: "plan"; campaignId: Id }
  | { kind: "creative"; campaignId: Id; creativeId: Id }
  | { kind: "product"; productId: Id }
  | { kind: "collection"; collectionId: Id };
/** #20: what a planned creative is: a still image (the default), a video or a carousel. She sets how many of each
 *  with Fume in the chat before the Engine starts. */
export interface PlannedCreative {
  medium?: "image" | "video" | "carousel";
}
