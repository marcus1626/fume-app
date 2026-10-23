// Studio calls: one brand's studio workspace, creative documents (FLOWS §9: one per creative, versions for renders,
// undo for edits), and Studio sessions.

import type { Id } from "../entities/common";
import type { ProductOverride } from "../entities/products";
import type { CreativeDocument, Recipe, StudioKind, StudioMode, StudioSession } from "../entities/studio";
import type { BrandWorkspaceView, StudioCampaignRow, StudioKit } from "../views/studio";

export interface StudioApi {
  // The brand's studio workspace (Fume's people)
  brandWorkspace(workspaceId: Id): Promise<BrandWorkspaceView>;
  studioCampaigns(): Promise<StudioCampaignRow[]>;

  // Creative documents
  studioModes(): Promise<StudioMode[]>;
  documents(workspaceId: Id): Promise<CreativeDocument[]>;
  document(documentId: Id): Promise<CreativeDocument>;
  openDocument(input: {
    workspaceId: Id;
    studio: StudioKind;
    modeId: Id;
    campaignId?: Id;
    creativeId?: Id;
    title?: string;
    slot?: string;
    /** A candidate opened in the Studio becomes V1 of one document. */
    fromGenerationId?: Id;
    /** Started from a product; otherwise a new creative starts with no product (or its campaign's first). */
    productId?: Id;
  }): Promise<CreativeDocument>;
  /** A campaignId key given as undefined clears the campaign. */
  updateDocument(
    documentId: Id,
    change: Partial<
      Pick<CreativeDocument, "variables" | "specs" | "layers" | "modeId" | "studio" | "title" | "campaignId">
    >,
  ): Promise<CreativeDocument>;
  /** Words in the Engine bar: the Engine proposes a variable change and shows it before it renders. */
  engineEdit(documentId: Id, text: string): Promise<CreativeDocument>;
  decideEdit(documentId: Id, editId: Id, verdict: "keep" | "undo"): Promise<CreativeDocument>;
  render(documentId: Id): Promise<CreativeDocument>;
  pickVersion(documentId: Id, versionId: Id): Promise<CreativeDocument>;
  overrideProduct(
    documentId: Id,
    change: { field: string; value: string; scope: ProductOverride["scope"] },
  ): Promise<CreativeDocument>;
  documentToCheck(documentId: Id): Promise<CreativeDocument>;
  /** Undo a Send to check from the Studio: the creative in Check shows the version it showed before. */
  undoDocumentToCheck(documentId: Id): Promise<CreativeDocument>;

  // Studio sessions (FLOWS §3.4)
  studioKit(workspaceId: Id): Promise<StudioKit>;
  studioSession(sessionId: Id): Promise<StudioSession>;
  openStudio(input: { workspaceId: Id; campaignId?: Id; slot?: string; fromGenerationId?: Id }): Promise<StudioSession>;
  generate(sessionId: Id, recipe: Recipe): Promise<StudioSession>;
  repair(sessionId: Id, generationId: Id, what: string): Promise<StudioSession>;
  pickGeneration(sessionId: Id, generationId: Id): Promise<StudioSession>;
  sendToCheck(sessionId: Id): Promise<StudioSession>;
}
