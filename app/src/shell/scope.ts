// The address is the scope. Fume's studio and an agency are one frame, with one shape of address for its two scopes:
//   all brands or all clients   /studio/…            /agency/…
//   one brand or one client     /studio/b/:id/…      /agency/b/:id/…
// Under a brand's prefix live the staff pages (Studio, Check, Engine, models and references, boards, Engine output) and
// the customer's own pages as the frame shows them (Home, Campaigns and each campaign, Brand, Fume). So every place in
// the sidebar names its brand or client in the address, a link opens in the right client, and two browser tabs can hold
// two clients. The customer's own addresses (/campaigns/c-autumn, /brand/products) keep working for the frame's people:
// they open under the brand's prefix. A person of the other kind who opens such an address lands on their own page (a
// client on her /campaigns/c-autumn, Fume's people on the studio's, an agency's on the agency's).
// Fume's people see a brand exactly as its customer does through Customer view: until they go back to the studio, the
// customer's addresses are the customer's frame, marked "Fume view".
import { useSession } from "../api/hooks";

export type StaffFrameKind = "fume" | "agency";

/** The staff frame the signed-in person works in: an agency's people the agency's, Fume's people the studio's. */
export function useFrameKind(): StaffFrameKind {
  return useSession().data?.user.agency ? "agency" : "fume";
}

export const under = (pathname: string, to: string) => pathname === to || pathname.startsWith(`${to}/`);

/** Each frame's all-scope root. */
export const frameRoot: Record<StaffFrameKind, string> = { fume: "/studio", agency: "/agency" };

/** The check place's last segment: "Check" by name in both frames; Fume's address keeps its old qa. */
export const checkSegment: Record<StaffFrameKind, string> = { fume: "qa", agency: "check" };

/** The prefix of one brand's or one client's places. */
export const brandBase = (frame: StaffFrameKind, workspaceId: string) => `${frameRoot[frame]}/b/${workspaceId}`;

/** A Studio document keeps the frame's address, "/studio/doc/:id" or "/agency/doc/:id" (an agency's person who opens a
 *  studio address lands on the agency's, App.tsx). */
export const docHref = (frame: StaffFrameKind, documentId: string) => `${frameRoot[frame]}/doc/${documentId}`;

/** The check place of a scope: "/studio/qa", "/agency/b/w-lysne/check". */
export const checkPath = (frame: StaffFrameKind, workspaceId?: string) =>
  `${workspaceId ? brandBase(frame, workspaceId) : frameRoot[frame]}/${checkSegment[frame]}`;

export interface AddressBrand {
  frame: StaffFrameKind;
  workspaceId: string;
  /** What follows the brand's prefix: "" (its Home), "/campaigns/c-autumn", "/qa". */
  rest: string;
}

/** The brand an address names (/studio/b/:id/… or /agency/b/:id/…), if it names one. */
export function addressBrand(pathname: string): AddressBrand | undefined {
  const m = /^\/(studio|agency)\/b\/([^/]+)(\/.*)?$/.exec(pathname);
  if (!m) return undefined;
  let workspaceId = m[2]!;
  try {
    workspaceId = decodeURIComponent(workspaceId);
  } catch {
    /* keep it as it is */
  }
  return { frame: m[1] === "studio" ? "fume" : "agency", workspaceId, rest: (m[3] ?? "").replace(/\/$/, "") };
}

/** The customer's own per-brand addresses (the ones a staff frame keeps under a brand's prefix). The viewer and swipe
 *  (/review/:id/c/…, /review/:id/swipe) are full-screen pages of their own and stay where they are. */
const CUSTOMER: RegExp[] = [
  /^\/$/,
  /^\/campaigns(\/|$)/,
  /^\/brand(\/|$)/,
  /^\/fume(\/|$)/,
  /^\/review(\/[^/]+)?$/,
  /^\/deliveries(\/|$)/,
  /^\/products(\/|$)/,
  /^\/check\/products$/,
  /^\/calendar$/,
  /^\/contact$/,
  /^\/boards\/[^/]+$/,
];
export const isCustomerPath = (pathname: string) => CUSTOMER.some((re) => re.test(pathname));

/** "/campaigns/c-autumn?x=1#a" → ["/campaigns/c-autumn", "?x=1#a"]. */
function split(href: string): [string, string] {
  const i = href.search(/[?#]/);
  return i < 0 ? [href, ""] : [href.slice(0, i), href.slice(i)];
}

/** A customer address in a frame's brand scope: "/campaigns/c-autumn" → "/agency/b/w-lysne/campaigns/c-autumn",
 *  "/" → the brand's Home. Anything else is returned as it is. */
export function inBrand(frame: StaffFrameKind, workspaceId: string, href: string): string {
  const [path, tail] = split(href);
  if (!isCustomerPath(path)) return href;
  return `${brandBase(frame, workspaceId)}${path === "/" ? "" : path}${tail}`;
}

/** Any address a page or the mock gives (a customer's "/campaigns/c-winter/plan", the studio's "/studio/b/w-lysne/qa",
 *  the agency's "/agency/clients?client=w-halm") as this frame writes it, in this brand or client. */
export function hrefIn(frame: StaffFrameKind, workspaceId: string | undefined, href: string): string {
  const [path, tail] = split(href);
  if (isCustomerPath(path)) return workspaceId ? inBrand(frame, workspaceId, href) : href;
  return ownAddress(frame, path, tail) ?? href;
}

/** Where a campaign opens in a staff frame (a campaign row opens the campaign, everywhere): for Fume's people its plan,
 *  the studio's page of a campaign; for an agency's the campaign itself, with its tabs. */
export const campaignHref = (frame: StaffFrameKind, workspaceId: string, campaignId: string) =>
  `${brandBase(frame, workspaceId)}/campaigns/${campaignId}${frame === "fume" ? "/plan" : ""}`;

/** The staff pages under a brand that are the same place in both frames, and their address in the other frame. */
const segmentIn = (frame: StaffFrameKind, rest: string) => {
  // the check place, by either name; the older /queue address is the check place too
  if (/^\/(qa|check|queue)(\/|$)/.test(rest)) return `/${checkSegment[frame]}`;
  return rest;
};

/** The all-scope places, and where each one is in the other frame. */
const ALL: { fume: string; agency: string }[] = [
  { fume: "/studio", agency: "/agency" },
  { fume: "/studio/qa", agency: "/agency/check" },
  { fume: "/studio/queue", agency: "/agency/check" },
  { fume: "/studio/campaigns", agency: "/agency/campaigns" },
  { fume: "/studio/deliveries", agency: "/agency/campaigns" },
  { fume: "/studio/team", agency: "/agency/team" },
  { fume: "/studio/usage", agency: "/agency/usage" },
  { fume: "/studio/quality", agency: "/agency/quality" },
  { fume: "/studio", agency: "/agency/clients" },
  { fume: "/studio", agency: "/agency/settings" },
];

/**
 * Where a person of this frame should be for an address that belongs to the other frame (a studio link followed by an
 * agency's person, an agency link by Fume's): the same place in their own frame. Undefined when the address is theirs.
 */
export function ownAddress(frame: StaffFrameKind, pathname: string, tail = ""): string | undefined {
  const brand = addressBrand(pathname);
  if (brand) {
    const rest = segmentIn(frame, brand.rest);
    if (brand.frame === frame && rest === brand.rest) return undefined;
    return `${brandBase(frame, brand.workspaceId)}${rest}${tail}`;
  }
  const other: StaffFrameKind = frame === "fume" ? "agency" : "fume";
  if (!under(pathname, frameRoot[other])) return undefined;
  const row = ALL.find((r) => under(pathname, r[other]) && (r[other] !== frameRoot[other] || pathname === r[other]));
  return `${row ? row[frame] : frameRoot[frame]}${tail}`;
}

/** For a customer (or a client of an agency) who follows a studio or agency link: her own page, or her Home. */
export function customerAddress(pathname: string, tail = ""): string {
  const brand = addressBrand(pathname);
  if (brand && brand.rest && isCustomerPath(brand.rest)) return `${brand.rest}${tail}`;
  return "/";
}

// ─── One place, kept across a change of scope ───────────────────────────────

export type PlaceKey = "home" | "check" | "campaigns" | "brand" | "studio" | "engine" | "fume" | "other";

/** The place an address is in, in either scope. */
export function placeOf(pathname: string): PlaceKey {
  const brand = addressBrand(pathname);
  const rest = brand ? brand.rest : pathname.replace(/^\/(studio|agency)/, "");
  if (brand && rest === "") return "home";
  if (/^\/(qa|check|queue)(\/|$)/.test(rest) && !/^\/check\/products/.test(rest)) return "check";
  if (/^\/(campaigns|deliveries|calendar)(\/|$)/.test(rest)) return "campaigns";
  if (brand && /^\/(brand|assets|boards|products|check\/products)(\/|$)/.test(rest)) return "brand";
  if (brand && /^\/studio(\/|$)/.test(rest)) return "studio";
  if (brand && /^\/(engine|output)(\/|$)/.test(rest)) return "engine";
  if (brand && /^\/fume(\/|$)/.test(rest)) return "fume";
  return brand ? "home" : "other";
}

/**
 * The same place in another scope, one rule for both pickers: Check, Campaigns, Studio, Engine and Brand map to the
 * same place in the new brand; a campaign, a plan or a document maps to that brand's Campaigns (or its Studio); from a
 * brand to all: Check to all Check, Campaigns to all Campaigns, anything else to the overview. `limited` (Fume's admin,
 * who follows the brands but has no Check, Studio or Engine) keeps Campaigns and lands on the first place else.
 */
export function equivalent(
  pathname: string,
  frame: StaffFrameKind,
  workspaceId: string | undefined,
  limited = false,
): string {
  const found = placeOf(pathname);
  const place = limited && found !== "campaigns" ? "other" : found;
  if (workspaceId) {
    const base = brandBase(frame, workspaceId);
    switch (place) {
      case "check":
        return `${base}/${checkSegment[frame]}`;
      case "campaigns":
        return `${base}/campaigns`;
      case "brand":
        return `${base}/brand`;
      case "studio":
        return `${base}/studio`;
      case "engine":
        return `${base}/engine`;
      case "fume":
        return frame === "agency" ? `${base}/fume` : base;
      default:
        return base;
    }
  }
  if (place === "check") return checkPath(frame);
  if (place === "campaigns") return `${frameRoot[frame]}/campaigns`;
  return frameRoot[frame];
}

// ─── Customer view (Fume's people only) ─────────────────────────────────────

const VIEW = "fume.customer-view";

/** Without storage (a private window) Customer view lasts as long as the page. */
let memory = false;

/** True while one of Fume's people looks at a brand as its customer does (until they go back to the studio). */
export function customerViewOn(): boolean {
  try {
    return sessionStorage.getItem(VIEW) === "1";
  } catch {
    return memory;
  }
}

export function setCustomerView(on: boolean) {
  memory = on;
  try {
    if (on) sessionStorage.setItem(VIEW, "1");
    else sessionStorage.removeItem(VIEW);
  } catch {
    /* kept in memory */
  }
}
