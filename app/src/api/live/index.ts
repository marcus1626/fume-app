// The live backend (VITE_FUME_API=supabase): FumeApi over Fume's Supabase project. Calls move here domain by domain,
// in the order of the MVP week's cycle (docs/mvp/code-map.md §3). A call not moved yet answers from an empty mock
// workspace (a brand that has just signed up), so its pages show nothing rather than the demo's data; what is
// written there is not kept.
import type { FumeApi } from "../../contract";
import { createMockApi } from "../../mock/mockApi";
import { createLive } from "./context";
import { identityCalls } from "./identity";
import { campaignCalls } from "./campaigns";
import { homeCalls } from "./home";
import { overviewCalls } from "./overview";
import { planCalls } from "./plan";
import { productCalls } from "./products";
import { productionCalls } from "./production";
import { qualityCalls } from "./quality";
import { studioCalls } from "./studio";
import { reviewCalls } from "./review";
import { deliveryCalls } from "./delivery";

export function createLiveApi(): FumeApi {
  const live = createLive();
  const notYet = createMockApi({ fresh: true, latency: 0 });
  return {
    ...notYet,
    ...identityCalls(live),
    ...productCalls(live),
    ...campaignCalls(live),
    ...planCalls(live),
    ...homeCalls(live),
    ...productionCalls(live),
    ...studioCalls(live),
    ...qualityCalls(live),
    ...overviewCalls(live),
    ...reviewCalls(live),
    ...deliveryCalls(live),
  };
}
