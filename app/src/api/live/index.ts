// The live backend (VITE_FUME_API=supabase): FumeApi over Fume's Supabase project. Calls move here domain by domain,
// in the order of the MVP week's cycle (docs/mvp/code-map.md §3). A call not moved yet answers from an empty mock
// workspace (a brand that has just signed up), so its pages show nothing rather than the demo's data; what is
// written there is not kept. That empty workspace loads only when a page first asks it something, so the live app
// does not download the demo's data up front.
import type { FumeApi } from "../../contract";
import { createLive } from "./context";
import { eventCalls } from "./events";
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
import { brandCalls } from "./brand";

/** The calls not moved yet, answered by an empty mock workspace that loads on the first such call. */
function notYetCalls(): FumeApi {
  let mock: Promise<FumeApi> | undefined;
  const load = () => (mock ??= import("../../mock/mockApi").then((m) => m.createMockApi({ fresh: true, latency: 0 })));
  return new Proxy({} as FumeApi, {
    get: (_, key) =>
      typeof key === "string" && key !== "then"
        ? (...args: unknown[]) =>
            load().then((api) => (api[key as keyof FumeApi] as (...a: unknown[]) => unknown)(...args))
        : undefined,
  });
}

export function createLiveApi(): FumeApi {
  const live = createLive();
  const notYet = notYetCalls();
  const own: Partial<FumeApi> = {
    ...identityCalls(live),
    ...productCalls(live),
    ...campaignCalls(live),
    ...planCalls(live),
    ...homeCalls(live),
    ...productionCalls(live),
    ...studioCalls(live),
    ...qualityCalls(live),
    ...overviewCalls(live),
    ...eventCalls(live),
    ...reviewCalls(live),
    ...deliveryCalls(live),
    ...brandCalls(live, notYet),
  };
  return new Proxy(own as FumeApi, {
    get: (target, key, receiver) => (key in target ? Reflect.get(target, key, receiver) : Reflect.get(notYet, key)),
  });
}
