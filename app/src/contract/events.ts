// Events: what changes while a screen is open. The backend pushes them; FumeApi.subscribe hands them to the screens.

import type { Id } from "./entities/common";
import type { Campaign } from "./entities/campaigns";
import type { BrandScan } from "./entities/brand";
import type { EngineMessage, Message } from "./entities/conversation";
import type { Notification } from "./entities/notifications";
import type { Batch, EngineRun } from "./entities/production";
import type { QaItem } from "./entities/quality";
import type { CreativeVersion } from "./entities/review";
import type { CreativeDocument, Generation } from "./entities/studio";

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

export interface EventsApi {
  /** Live changes: the handler gets every event until the returned function unsubscribes it. */
  subscribe(handler: (event: FumeEvent) => void): Unsubscribe;
}
