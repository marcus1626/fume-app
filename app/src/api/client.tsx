// The app's one way to the backend. Screens never fetch: they call the hooks in ./hooks, which call FumeApi.
// VITE_FUME_API picks the implementation: "mock" (default, the LYSNE workspace in memory) or "supabase", the live
// backend (./live), where a person signs in with an email link first.
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { FumeApi, Id } from "../contract";
import { SignInPage } from "../features/auth/SignInPage";
import { createMockApi } from "../mock/mockApi";
import { signOut, useAuthState } from "./auth";
import { createLiveApi } from "./live";
import { isLive } from "./live/supabase";

type MockApi = FumeApi & { signInAs(userId: Id): void };

const ApiContext = createContext<MockApi | null>(null);

/** The agency's people in the demo (FLOWS §24.8): signing in as one of them opens Brygga Studio's world. */
const AGENCY_PEOPLE = ["nora", "even", "live", "sindre"];

/**
 * The mock lets the demo sign in as anyone: ?as=anna opens Fume's Quality Gate, ?as=jonas a member, ?fresh the first
 * run, ?as=nora the agency. ?agency&as=maja is LYSNE's client view in the agency's world.
 */
function createApi(): MockApi {
  // Live: who is signed in comes from the sign-in, never from the address.
  if (isLive) return Object.assign(createLiveApi(), { signInAs() {} });
  const params = new URLSearchParams(window.location.search);
  const as = params.get("as");
  const agency = (as !== null && AGENCY_PEOPLE.includes(as)) || params.has("agency") || agencyFlag();
  if (agency) remember(AGENCY_KEY, "1");
  const after = takeOnce(AS_KEY);
  return createMockApi({
    userId: as ? `u-${as}` : (after ?? undefined),
    fresh: !agency && (params.has("fresh") || freshFlag()),
    agency,
    latency: Number(params.get("latency") ?? 160),
  }) as MockApi;
}

/** The demo's agency world, kept for the tab like the first run; who to sign in as after a demo reload. */
const AGENCY_KEY = "fume-demo-agency";
const AS_KEY = "fume-demo-as";
/** Where the preview's memory router starts after a demo reload (it has no address bar to keep it). */
const START_KEY = "fume-demo-start";

function remember(key: string, value: string | null) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    /* no storage: the demo starts as LYSNE with its history */
  }
}
function takeOnce(key: string): string | null {
  try {
    const value = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    return value;
  } catch {
    return null;
  }
}
function agencyFlag(): boolean {
  try {
    return sessionStorage.getItem(AGENCY_KEY) === "1";
  } catch {
    return false;
  }
}

/** Reloads the demo; a query string (?as, ?fresh, ?agency) would win over the choice just made, so it goes. */
function reloadDemo() {
  if (window.location.search) window.location.replace(window.location.pathname);
  else window.location.reload();
}

/** True while the demo is Brygga Studio's world (signed in as Nora, or LYSNE as Brygga Studio's client). */
export function isAgencyDemo(): boolean {
  return agencyFlag() || new URLSearchParams(window.location.search).has("agency");
}

/** The first route of the preview's memory router: the agency's Home in the agency demo, else Home. */
export function demoStartPath(): string {
  return takeOnce(START_KEY) ?? (agencyFlag() ? "/agency" : "/");
}

/** Reloads the demo as Brygga Studio's world, signed in as one of the agency's people (Nora by default). */
export function startAgencyDemo(who = "nora") {
  remember(FRESH_KEY, null);
  remember(AGENCY_KEY, "1");
  remember(AS_KEY, `u-${who}`);
  remember(START_KEY, AGENCY_PEOPLE.includes(who) ? "/agency" : "/");
  reloadDemo();
}

/** Reloads the demo as LYSNE with Fume's own people again, signed in as `who` (Maja by default). */
export function leaveAgencyDemo(who = "maja") {
  remember(AGENCY_KEY, null);
  remember(AS_KEY, `u-${who}`);
  remember(START_KEY, ["anna", "sander", "vera"].includes(who) ? "/studio" : "/");
  reloadDemo();
}

/** The demo's first run, kept for the tab so the preview (a memory router, no query string) can show it too. */
const FRESH_KEY = "fume-demo-fresh";
function freshFlag(): boolean {
  try {
    return sessionStorage.getItem(FRESH_KEY) === "1";
  } catch {
    return false;
  }
}

/** Reloads the demo, as a brand that has just signed up (fresh) or as LYSNE with its history. */
export function restartDemo(fresh: boolean) {
  remember(AGENCY_KEY, null);
  try {
    if (fresh) sessionStorage.setItem(FRESH_KEY, "1");
    else sessionStorage.removeItem(FRESH_KEY);
  } catch {
    /* no storage: the reload still restarts the demo */
  }
  reloadDemo();
}

export function ApiProvider({ children }: { children: ReactNode }) {
  const auth = useAuthState();
  if (auth === "checking") return null;
  if (auth === "signed_out") return <SignInPage />;
  return <SignedIn>{children}</SignedIn>;
}

function SignedIn({ children }: { children: ReactNode }) {
  const api = useMemo(createApi, []);
  const queryClient = useMemo(
    () =>
      new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false } } }),
    [],
  );
  return (
    <ApiContext.Provider value={api}>
      <QueryClientProvider client={queryClient}>
        <LiveUpdates api={api} />
        {children}
      </QueryClientProvider>
    </ApiContext.Provider>
  );
}

/** Keeps open screens current: every backend event refreshes the queries it touches. */
function LiveUpdates({ api }: { api: FumeApi }) {
  const client = useQueryClient();
  useEffect(
    () =>
      api.subscribe((event) => {
        switch (event.type) {
          case "run.progress":
            client.invalidateQueries({ queryKey: ["campaign", event.run.campaignId] });
            client.invalidateQueries({ queryKey: ["home"] });
            break;
          case "message.new":
            client.invalidateQueries({ queryKey: ["messages", event.message.threadId] });
            client.invalidateQueries({ queryKey: ["threads"] });
            client.invalidateQueries({ queryKey: ["conversation"] });
            break;
          case "notification.new":
            client.invalidateQueries({ queryKey: ["notifications"] });
            break;
          case "scan.progress":
            client.setQueryData(["scan"], event.scan);
            break;
          case "document.state":
            client.setQueryData(["studio", "document", event.document.id], event.document);
            client.invalidateQueries({ queryKey: ["studio", "documents"] });
            break;
          case "batch.progress":
            client.invalidateQueries({ queryKey: ["studio", "batches"] });
            break;
          case "engine.message":
            client.invalidateQueries({ queryKey: ["engine", "chat", event.message.workspaceId] });
            break;
          case "qa.state":
            client.invalidateQueries({ queryKey: ["studio", "qa"] });
            break;
          case "generation.state":
            client.invalidateQueries({ queryKey: ["studio", "session", event.generation.sessionId] });
            break;
          case "version.state":
          case "campaign.state":
            client.invalidateQueries();
            break;
        }
      }),
    [api, client],
  );
  return null;
}

export function useApi(): MockApi {
  const api = useContext(ApiContext);
  if (!api) throw new Error("useApi needs <ApiProvider>");
  return api;
}

/** Demo only: sign in as someone else in the mock without leaving the page (the preview has no address bar to change). */
/** True with the mock: the demo's people and its restarts show only then. */
export const isDemo = !isLive;

export type DemoPerson = "maja" | "jonas" | "ida" | "anna" | "sander" | "vera" | "nora" | "even";
export function useDemoSignIn(): (who: DemoPerson) => void {
  const api = useApi();
  const client = useQueryClient();
  const navigate = useNavigate();
  return (who) => {
    // Live, the person menu's Sign out signs out for real; there are no demo people to become.
    if (isLive) return void signOut();
    const agencyPerson = AGENCY_PEOPLE.includes(who);
    const fumePerson = who === "anna" || who === "sander" || who === "vera";
    // The agency's world and Fume's own are two demos: crossing between them reloads.
    if (agencyPerson && !isAgencyDemo()) return startAgencyDemo(who);
    if (fumePerson && isAgencyDemo()) return leaveAgencyDemo(who);
    // Leaving the first-run demo goes back to LYSNE with its history (signed in as Maja).
    if (freshFlag()) return restartDemo(false);
    api.signInAs(`u-${who}`);
    client.clear();
    navigate(fumePerson ? "/studio" : agencyPerson ? "/agency" : "/");
  };
}
