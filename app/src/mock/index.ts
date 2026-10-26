// The in-memory mock backend: the whole FumeApi over one database, a domain per module. Each call answers after the
// mock's latency with a copy of what it read, and the open pages hear what changed through `subscribe`.
import type { FumeApi, Id } from "../contract";
import { agencyCalls } from "./agency";
import { brandCalls } from "./brand";
import { campaignCalls, installWaits } from "./campaigns";
import { createMock, type MockOptions } from "./context";
import { conversationCalls } from "./conversation";
import { createDb } from "./db";
import { deliveryCalls } from "./delivery";
import { homeCalls } from "./home";
import { identityCalls } from "./identity";
import { notificationCalls } from "./notifications";
import { planCalls } from "./plan";
import { productCalls } from "./products";
import { productionCalls, tick } from "./production";
import { fixLater, qualityCalls } from "./quality";
import { settleQuestions } from "./questions";
import { reviewCalls } from "./review";
import { studioCalls } from "./studio";

export type { MockOptions } from "./context";

export function createMockApi(options: MockOptions = {}): FumeApi {
  const db = createDb(options);
  const m = createMock(db, options);

  // The simulated Engine plays on, every few seconds.
  const engine = setInterval(() => tick(m), 6000);
  (engine as unknown as { unref?: () => void }).unref?.();
  // Feedback the seed left with the Engine comes back fixed, like any other.
  for (const item of db.qaItems.filter((i) => i.state === "fixing")) fixLater(m, item, m.latency * 60);
  // The agency's picker lists the client opened last first; LYSNE is open as the demo starts.
  m.opened.set("w-lysne", m.now());
  installWaits(m);

  const api: FumeApi = {
    ...identityCalls(m),
    ...homeCalls(m),
    ...brandCalls(m),
    ...productCalls(m),
    ...campaignCalls(m),
    ...planCalls(m),
    ...productionCalls(m),
    ...studioCalls(m),
    ...qualityCalls(m),
    ...reviewCalls(m),
    ...deliveryCalls(m),
    ...conversationCalls(m),
    ...agencyCalls(m),
    ...notificationCalls(m),
    subscribe(handler) {
      m.listeners.add(handler);
      return () => m.listeners.delete(handler);
    },
  };

  // An answer given in any place closes its question everywhere: the records settle before and after every call.
  const settle = () => settleQuestions(m);
  const calls = api as unknown as Record<string, unknown>;
  for (const [name, fn] of Object.entries(calls)) {
    if (typeof fn !== "function" || name === "subscribe") continue;
    calls[name] = (...args: unknown[]) => {
      settle();
      const result = (fn as (...a: unknown[]) => unknown).apply(api, args);
      return result instanceof Promise ? result.then((value) => (settle(), value)) : result;
    };
  }
  m.api = api;

  return Object.assign(api, {
    /** Mock only: sign in as someone else (the demo's "View as"). Fume's people keep the brand they are in. */
    signInAs(id: Id) {
      m.userId = id;
      m.workspaceId = m.isStaff()
        ? m.workspaceId
        : (db.memberships.find((x) => x.userId === id)?.workspaceId ?? m.workspaceId);
    },
  });
}
