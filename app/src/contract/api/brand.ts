// Brand calls: Brand DNA and its board, voice and taste, the onboarding scan, brand updates and brand assets.
// Only the customer decides on what the Engine proposes (FLOWS §2).

import type {
  BookEdit,
  BrandBook,
  BrandBookKind,
  BrandColour,
  BrandDna,
  BrandImage,
  BrandModel,
  BrandReference,
  BrandRule,
  BrandScan,
  BrandUpdate,
  ColourUse,
  CopyLineCheck,
  IdentityKind,
  ImageGroup,
  OnboardingProgress,
  OnboardingStepId,
  Reference,
  ScanSource,
  SourceAsset,
  TasteCard,
  TastePair,
  TasteState,
  Understanding,
  UnderstoodLine,
  VoiceBook,
  VoiceChannel,
  VoicePartId,
} from "../entities/brand";
import type { Id } from "../entities/common";
import type { BrandAssetsView, BrandBoardView, BrandBooksView, BrandDnaView } from "../views/brand";

export interface BrandApi {
  // Brand DNA
  brandDna(): Promise<BrandDnaView>;
  updateRule(rule: BrandRule): Promise<BrandRule>;
  addRule(rule: Omit<BrandRule, "id" | "source" | "confidence">): Promise<BrandRule>;
  addReference(input: { image: string; verdict: "liked" | "disliked"; note?: string }): Promise<Reference>;
  chooseTastePair(pairId: Id, chosen: "a" | "b", reason?: string): Promise<TastePair>;
  /** Neither picture of a pair (onboarding pairId, Brand › Taste cardId) feels like the brand. */
  passTastePair(input: { pairId?: Id; cardId?: Id; reason?: string }): Promise<void>;
  answerUnderstanding(input: {
    unknownId?: Id;
    answer?: string;
    directionId?: Id;
    verdict?: "yes" | "no";
    reason?: string;
  }): Promise<Understanding>;
  approveBrandDna(): Promise<BrandDna>;
  uploadSourceAssets(files: { name: string; bytes: number; kind: SourceAsset["kind"] }[]): Promise<SourceAsset[]>;

  // The Brand DNA board
  brandBoard(): Promise<BrandBoardView>;
  /** Keep, change or remove an Engine proposal (FLOWS §2). Only the customer decides. */
  decide(input: {
    kind: IdentityKind;
    id: Id;
    verdict: "keep" | "change" | "remove";
    value?: string;
  }): Promise<BrandBoardView>;
  /** The uses she chose for a colour. */
  setColourUses(input: { colourId: Id; uses: ColourUse[] }): Promise<BrandColour>;
  /** She moves a picture to another group (a campaign look names its campaign). */
  moveImage(input: { imageId: Id; group: ImageGroup; campaign?: string }): Promise<BrandImage>;
  /** Confirm or Change one part of the voice (Change says what is right in her words). */
  decideVoicePart(input: { part: VoicePartId; verdict: "keep" | "change"; note?: string }): Promise<VoiceBook>;

  // The brand's books (FLOWS §30): a long Tone of Voice and a design system
  brandBooks(): Promise<BrandBooksView>;
  /** Fume writes a new version (the people who run the brand, or its owner or approver); one of a kind at a time. */
  writeBrandBook(input: { kind: BrandBookKind; ask?: string }): Promise<BrandBook>;
  /** An expert who can check marks a draft checked: the customer sees it then. */
  checkBrandBook(bookId: Id): Promise<BrandBook>;
  /** Only the customer's owner or approver approves; the version before is superseded. */
  approveBrandBook(bookId: Id): Promise<BrandBook>;
  /** The customer's change: Fume writes the next version with her words, or with the lines she edited in place (it
   *  keeps her lines as she wrote them); the approved one stays in use meanwhile. */
  askBrandBookChange(input: { bookId: Id; ask: string; edits?: BookEdit[] }): Promise<BrandBook>;
  /** Fume's people edit a book in place (FLOWS §34.3, PROPOSED): on a draft, the draft changes; on any other version, a
   *  new draft is made from it with the edits. The expert checks it as any draft. */
  editBrandBook(input: { bookId: Id; edits: BookEdit[] }): Promise<BrandBook>;
  /** Hold one line of copy against the Tone of Voice in use (Fume's people read the newest written one). */
  checkCopyLine(input: { text: string; channel?: VoiceChannel }): Promise<CopyLineCheck>;
  /** Round 15 (PROPOSED 9 Nov 2026): Fume's people answer the Engine's proposal on a draft. "add" puts the block at the
   *  end of its list, marked as added from the proposal; "not_now" sets it aside; "open" undoes either (an added block
   *  comes out again). Only a draft takes an answer. */
  answerBookProposal(input: { bookId: Id; proposalId: Id; answer: "add" | "not_now" | "open" }): Promise<BrandBook>;

  // Taste keeps learning (FLOWS §14)
  tasteTraining(): Promise<{ cards: TasteCard[]; state: TasteState }>;
  answerTaste(input: {
    cardId: Id;
    answer: "a" | "b" | "yes" | "no";
    reason?: string;
  }): Promise<{ card: TasteCard; state: TasteState }>;

  // Onboarding: the Engine reads the brand (FLOWS §7 step 3)
  startBrandScan(input: {
    source: ScanSource;
    url?: string;
    files?: { name: string; bytes: number }[];
  }): Promise<BrandScan>;
  brandScan(): Promise<BrandScan | null>;
  /** The workspace's onboarding progress (step "" before anything is read). */
  onboardingProgress(): Promise<OnboardingProgress>;
  /** Moves the furthest step or part forward (never back) and merges lines by id. */
  saveOnboardingProgress(input: {
    step?: OnboardingStepId;
    part?: string;
    line?: UnderstoodLine;
  }): Promise<OnboardingProgress>;

  // Brand updates
  /** Read the website again, or a zip of new things, and compare with the approved Brand DNA. */
  startBrandUpdate(input: {
    source: "website" | "upload";
    url?: string;
    files?: { name: string; bytes: number }[];
  }): Promise<BrandUpdate>;
  /** The latest update, while it reads and after (null when there is none). */
  brandUpdate(): Promise<BrandUpdate | null>;
  /** Keep, fix (with the customer's value) or remove one thing the Engine found. Keep and fix write it into Brand DNA. */
  decideBrandFound(input: {
    updateId: Id;
    foundId: Id;
    verdict: "keep" | "fix" | "remove";
    value?: string;
  }): Promise<BrandUpdate>;
  /** Approve all: keep everything not answered yet, and close the update. */
  approveBrandUpdate(updateId: Id): Promise<BrandUpdate>;

  // Brand assets: presets, AI models, references (FLOWS §9.4, §9.6)
  brandAssets(workspaceId?: Id): Promise<BrandAssetsView>;
  saveModel(input: { documentId: Id; name: string; state: "draft" | "saved" }): Promise<BrandModel>;
  /** The customer decides on a model Fume saved. */
  decideModel(modelId: Id, verdict: "approve" | "decline"): Promise<BrandModel>;
  saveReference(input: { documentId: Id; name: string; state: "draft" | "saved" }): Promise<BrandReference>;
}
