// Brand calls: Brand DNA and its board, voice and taste, the onboarding scan, brand updates and brand assets.
// Only the customer decides on what the Engine proposes (FLOWS §2).

import type {
  BrandColour,
  BrandDna,
  BrandImage,
  BrandModel,
  BrandReference,
  BrandRule,
  BrandScan,
  BrandUpdate,
  ColourUse,
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
  VoicePartId,
} from "../entities/brand";
import type { Id } from "../entities/common";
import type { BrandAssetsView, BrandBoardView, BrandDnaView } from "../views/brand";

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
