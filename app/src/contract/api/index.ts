// The contract: everything the front end asks of the backend (ARCHITECTURE §9), one interface per domain.
// The mock (src/mock/) implements it now; the real backend implements it later.
// Every call acts for the signed-in user in their current workspace, and the server checks their role.

import type { EventsApi } from "../events";
import type { AgencyApi } from "./agency";
import type { BrandApi } from "./brand";
import type { CampaignsApi } from "./campaigns";
import type { ConversationApi } from "./conversation";
import type { DeliveryApi } from "./delivery";
import type { HomeApi } from "./home";
import type { IdentityApi } from "./identity";
import type { NotificationsApi } from "./notifications";
import type { PlanApi } from "./plan";
import type { ProductionApi } from "./production";
import type { ProductsApi } from "./products";
import type { QualityApi } from "./quality";
import type { ReviewApi } from "./review";
import type { StudioApi } from "./studio";

export * from "./identity";
export * from "./home";
export * from "./brand";
export * from "./products";
export * from "./campaigns";
export * from "./plan";
export * from "./production";
export * from "./studio";
export * from "./quality";
export * from "./review";
export * from "./delivery";
export * from "./conversation";
export * from "./agency";
export * from "./notifications";

export interface FumeApi
  extends
    IdentityApi,
    HomeApi,
    BrandApi,
    ProductsApi,
    CampaignsApi,
    PlanApi,
    ProductionApi,
    StudioApi,
    QualityApi,
    ReviewApi,
    DeliveryApi,
    ConversationApi,
    AgencyApi,
    NotificationsApi,
    EventsApi {}
