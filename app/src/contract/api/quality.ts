// Quality calls: the Quality Gate (the expert's checks and the release to the customer), the quality log, and Check,
// where Fume's people and an agency check the Engine's work. Fume's people and agency people only.

import type { Id } from "../entities/common";
import type { Campaign } from "../entities/campaigns";
import type { Check, CheckNote, QaItem, QaPin, QualityLogEntry } from "../entities/quality";
import type { CreativeDocument, Layer } from "../entities/studio";
import type { CheckView, QaView, QueueItem } from "../views/quality";

export interface QualityApi {
  // The Quality Gate
  checkQueue(): Promise<QueueItem[]>;
  check(checkId: Id): Promise<CheckView>;
  passItem(checkId: Id, itemId: Id): Promise<Check>;
  addNote(checkId: Id, note: Pick<CheckNote, "x" | "y" | "text"> & { itemId?: Id }): Promise<Check>;
  markChecked(checkId: Id): Promise<Check>;
  requestCorrection(checkId: Id): Promise<Check>;
  hold(checkId: Id, reason: string): Promise<Check>;
  /** Releases the campaign's checked set to the customer ("Send to Maja", FLOWS §25.3). */
  release(campaignId: Id): Promise<Campaign>;
  qualityLog(): Promise<QualityLogEntry[]>;

  // Check (FLOWS §10, §25.2)
  qaQueue(workspaceId?: Id): Promise<QaView[]>;
  qaCheck(itemId: Id): Promise<QaItem>;
  /** Undo a check just made (the toast's Undo, or Undo in the panel): the creative waits for a check again. */
  qaUncheck(itemId: Id): Promise<QaItem>;
  /** Tell the Engine what to fix; `pins` are located notes on the creative. */
  qaFeedback(itemId: Id, text: string, pins?: QaPin[]): Promise<QaItem>;
  qaEdit(itemId: Id, layers: Layer[]): Promise<QaItem>;
  /** Open the creative in the Studio. While the Engine fixes it, it opens without taking it; `takeOver` takes it from
   *  the Engine. */
  qaToStudio(itemId: Id, takeOver?: boolean): Promise<{ item: QaItem; document: CreativeDocument }>;
}
