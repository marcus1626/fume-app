// Brand view models: Brand DNA, the Brand DNA board, and the brand's assets in the Studio.

import type { Board } from "../entities/campaigns";
import type {
  BrandDna,
  BrandIdentity,
  BrandModel,
  BrandPreset,
  BrandReference,
  BrandRule,
  MemoryEntry,
  Reference,
  SourceAsset,
  TastePair,
  Understanding,
} from "../entities/brand";
import type { Product } from "../entities/products";

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

/** Brand DNA as a board (FLOWS §0.3): identity, rules and taste in one call. */
export interface BrandBoardView {
  dna: BrandDna;
  identity: BrandIdentity;
  rules: BrandRule[];
  moodboard: Board;
  /** Proposals the customer has not decided yet, across every part. */
  open: number;
}

export interface BrandAssetsView {
  presets: BrandPreset[];
  models: BrandModel[];
  references: BrandReference[];
}
