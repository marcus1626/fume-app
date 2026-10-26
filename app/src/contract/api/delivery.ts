// Delivery calls: deliveries and downloads, the Usage page and an agency's licence.

import type { Id } from "../entities/common";
import type { Campaign, Format } from "../entities/campaigns";
import type { Delivery } from "../entities/delivery";
import type { Creative } from "../entities/review";
import type { LicenceView, UsageRow } from "../views/delivery";

export interface DeliveryApi {
  // Deliveries
  deliveries(): Promise<Delivery[]>;
  delivery(deliveryId: Id): Promise<{ delivery: Delivery; creatives: Creative[]; campaign: Campaign }>;
  /** A delivery of the whole campaign, or of one collection in it (FLOWS §3.2). */
  makeDelivery(input: { campaignId: Id; collectionId?: Id }): Promise<Delivery>;
  downloadUrl(deliveryId: Id, format?: Format): Promise<string>;
  confirmLive(deliveryId: Id): Promise<Delivery>;

  // Usage and licence
  /** The Usage page, for Fume's admin and an agency. */
  usage(): Promise<UsageRow[]>;
  /** The agency's licence and what its clients used. */
  licence(): Promise<LicenceView>;
}
