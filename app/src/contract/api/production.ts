// Production calls: batches, and the light and camera a document's look is set from.

import type { Id } from "../entities/common";
import type { Format } from "../entities/campaigns";
import type { Batch, CameraPreset, LightPreset, LookSource } from "../entities/production";
import type { CreativeDocument } from "../entities/studio";

export interface ProductionApi {
  // Batches (FLOWS §9.7)
  batches(campaignId?: Id): Promise<Batch[]>;
  startBatch(input: {
    campaignId: Id;
    modeId: Id;
    productIds: Id[];
    collectionId?: Id;
    perProduct: number;
    format: Format;
  }): Promise<Batch>;

  // Light and camera (FLOWS §18)
  lookPresets(workspaceId: Id): Promise<{ cameras: CameraPreset[]; lights: LightPreset[] }>;
  /** Where one look section of a document comes from. */
  setSource(documentId: Id, section: string, source: LookSource): Promise<CreativeDocument>;
}
