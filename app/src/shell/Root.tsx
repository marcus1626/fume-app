// The root of every route: it loads the session and sends each person to their place. A customer whose Brand DNA
// is not yet approved goes to the first run; Fume's people land in the studio and an agency's in the agency's overview
// (the staff frame, StudioShell.tsx, sends them there).
// Round 8 (walk-through 19 Oct, WAY-4, MOB-1, WAY-14, MOB-19): the root also keeps the person's place. One scroll rule
// for the page's scroller (.ui-sidebar-inset in a shell, the window in /welcome): a new page opens at its top, back
// and forward put each page where it was left, a tab of the same page keeps the reader's place, and an address with
// a #hash scrolls that item into view under the app bar and marks it for a moment. A toast belongs to the page it
// was raised on: when the path changes it leaves, unless it was raised with the move or holds an action (Undo).
// Round 9 (desktop review DWAY-8; PROPOSED 19 Oct 2026): the keyboard's place. "Skip to content" is the first stop of
// the Tab key and goes to the page's title. When a link, a menu row or the palette takes you to another page (also
// back and forward), focus moves to the new page's title (its h1), so the next Tab starts in the page and a screen
// reader says where you are; a tab of the same page, an overlay's ?c= or a filter keeps focus where it is, and a page
// that puts focus in a field of its own (the chat's composer) keeps it there.
import { tokenPx, useToast } from "@fume/ui";
import { useEffect, useLayoutEffect, useRef, type MouseEvent } from "react";
import { Outlet, useLocation, useMatches, useNavigate, useNavigationType } from "react-router-dom";
import { useSession } from "../api/hooks";
import { Failed, isTabChange, Loading } from "./Page";

export function Root() {
  const session = useSession();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const data = session.data;

  // Round 12 (DWAY-2, DWAY-3): Fume's and an agency's people land in their frame's overview on the first "/" only;
  // after that "/" is the Home of the brand they are in, and Customer view stays on the customer's Home (StudioShell)
  useEffect(() => {
    if (!data) return;
    const staff = Boolean(data.user.staffRole || data.user.agency);
    if (!staff && !data.onboarded && !pathname.startsWith("/welcome")) navigate("/welcome?resume", { replace: true }); // round 8 ONB: Welcome opens the furthest step reached
  }, [data, pathname, navigate]);

  useScrollRule();
  usePageFocus();
  useToastsBelongToTheirPage(pathname);

  if (session.isPending) return <Loading label="Opening Fume" />;
  if (session.error || !data) return <Failed error={session.error} onRetry={() => session.refetch()} />;
  return (
    <>
      <a className="ui-skip-link" href="#main" onClick={skipToContent}>
        Skip to content
      </a>
      <Outlet />
    </>
  );
}

// ─── Focus ──────────────────────────────────────────────────────────────────

/** The page's title (its h1), or the page itself, made focusable from code only (tabindex -1). */
function pageTitle(): HTMLElement | null {
  const main = document.querySelector<HTMLElement>("main");
  const el = main?.querySelector<HTMLElement>("h1") ?? document.querySelector<HTMLElement>("h1") ?? main;
  if (el && !el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
  return el;
}

function skipToContent(e: MouseEvent<HTMLAnchorElement>) {
  const target = pageTitle();
  if (!target) return;
  e.preventDefault();
  target.focus();
}

/** A layer on its way out (its closing animation): it still holds focus until it has gone. */
const CLOSING = "[role='dialog'][data-state='closed'], [role='alertdialog'][data-state='closed']";

/** On a change of page, focus goes to the new page's title once it is there (the page itself after 1.5 s without one). */
function usePageFocus() {
  const location = useLocation();
  const matches = useMatches();
  const leaf = matches[matches.length - 1]?.id ?? "";
  const last = useRef<{ path: string; leaf: string } | null>(null);

  useEffect(() => {
    const before = last.current;
    last.current = { path: location.pathname, leaf };
    // the first page: the browser's own start, where "Skip to content" is the first Tab stop
    if (!before || before.path === location.pathname) return;
    // a tab of the same page keeps focus on the tab
    if (before.leaf === leaf && isTabChange(location.key)) return;
    const start = document.activeElement;
    const soft = performance.now() + 1500;
    const end = performance.now() + 3000;
    let frame = 0;
    const step = () => {
      const a = document.activeElement;
      // the page put focus somewhere itself (a composer, a search field, the viewer's creative): leave it there
      if (a && a !== start && a !== document.body && a !== document.documentElement && !a.closest(CLOSING)) return;
      if (!document.querySelector(CLOSING)) {
        // its title, or, on a page without one that has come by now (Not found), the page itself
        if (document.querySelector("main h1") || performance.now() > soft) {
          pageTitle()?.focus({ preventScroll: true });
          return;
        }
      }
      if (performance.now() < end) frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [location.key, location.pathname, leaf]);
}

// ─── Toasts ─────────────────────────────────────────────────────────────────

function useToastsBelongToTheirPage(pathname: string) {
  const toast = useToast();
  const shown = useRef(pathname);
  useEffect(() => {
    if (shown.current === pathname) return;
    shown.current = pathname;
    toast.leave();
  }, [pathname, toast]);
}

// ─── The scroll rule ────────────────────────────────────────────────────────

const SCROLL = "fume.scroll";
const KEEP = 120;

/** The page's scroller: the shell's inset, or the window (the onboarding, full-screen pages). */
function scroller(): HTMLElement {
  return document.querySelector<HTMLElement>(".ui-sidebar-inset") ?? (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}

/** Each entry's place, with the address it was left at: a fresh document's first entry has no key of its own (the
 *  router calls it "default"), so the address keeps one page's place from opening another. */
type Place = [top: number, url: string];

function readPlaces(): Record<string, Place> {
  try {
    return JSON.parse(sessionStorage.getItem(SCROLL) ?? "{}") as Record<string, Place>;
  } catch {
    return {};
  }
}

/** Where this entry was left, if it was left at this address. */
function placeOf(key: string, url: string): number | undefined {
  const place = readPlaces()[key];
  return Array.isArray(place) && place[1] === url ? place[0] : undefined;
}

/** A fresh document opened by a reload or by back/forward from another site keeps its place; one opened by a link,
 *  a typed address or a bookmark starts at its top (or at its #hash). */
function cameBack(): boolean {
  const nav = performance.getEntriesByType?.("navigation")[0] as PerformanceNavigationTiming | undefined;
  return nav?.type === "reload" || nav?.type === "back_forward";
}

function remember(key: string, url: string, top: number) {
  const places = readPlaces();
  delete places[key];
  places[key] = [Math.round(top), url];
  const keys = Object.keys(places);
  for (const k of keys.slice(0, Math.max(0, keys.length - KEEP))) delete places[k];
  try {
    sessionStorage.setItem(SCROLL, JSON.stringify(places));
  } catch {
    /* private mode: back opens at the top */
  }
}

const jump = (el: HTMLElement, top: number) => el.scrollTo({ top, behavior: "instant" as ScrollBehavior });

/** Stops a running restore or hash scroll as soon as the person scrolls or acts on their own. */
function untilTheyAct(run: (stopped: () => boolean) => void) {
  let stop = false;
  const quit = () => {
    stop = true;
  };
  const events = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
  for (const e of events) window.addEventListener(e, quit, { capture: true, passive: true });
  run(() => stop);
  window.setTimeout(() => {
    for (const e of events) window.removeEventListener(e, quit, { capture: true });
  }, 4500);
  return quit;
}

/** Back or forward: the entry's saved place, again while the page grows to it (its data may still come), up to 2 s. */
function restore(top: number) {
  return untilTheyAct((stopped) => {
    const end = performance.now() + 2000;
    const step = () => {
      if (stopped()) return;
      const s = scroller();
      const max = s.scrollHeight - s.clientHeight;
      jump(s, Math.min(top, Math.max(0, max)));
      if (max >= top - 1 || performance.now() > end) return;
      window.requestAnimationFrame(step);
    };
    step();
  });
}

/** What covers the top of the scroller once it has scrolled: the app bar and any sticky row under it (the Brand tabs,
 *  a campaign's tabs), plus the space before the item; or the item's own scroll-margin-block-start when that is more. */
function stuckAbove(s: HTMLElement, target: HTMLElement): number {
  const win = s === document.scrollingElement || s === document.documentElement;
  let covered = win ? 0 : (s.querySelector<HTMLElement>(":scope > .ui-app-bar")?.offsetHeight ?? 0);
  // sticky rows that hold to the top (top under the screen's first third), not the item itself or what holds it
  for (const el of Array.from(s.querySelectorAll<HTMLElement>(".ui-page-header-tabs, [data-ui-sticky], [class*='-bar'], [class*='tabs']"))) {
    if (el.contains(target) || target.contains(el) || !el.offsetHeight) continue;
    const cs = getComputedStyle(el);
    if (cs.position !== "sticky") continue;
    const stick = parseFloat(cs.top);
    if (!Number.isFinite(stick) || stick > window.innerHeight / 3) continue;
    covered = Math.max(covered, stick + el.offsetHeight);
  }
  const margin = parseFloat(getComputedStyle(target).scrollMarginBlockStart || getComputedStyle(target).scrollMarginTop) || 0;
  return Math.max(covered + tokenPx("--ui-space-lg", 24), margin);
}

/** An address with #id: wait for the item, scroll it into view under the app bar (and any sticky tab row), keep it there while what is above
 *  it still loads, then mark it for a moment with an Ink outline (app.css [data-ui-target]; no glow, no Amber). */
function toHash(hash: string) {
  let id = "";
  try {
    id = decodeURIComponent(hash.slice(1));
  } catch {
    id = hash.slice(1);
  }
  if (!id) return () => {};
  jump(scroller(), 0);
  return untilTheyAct((stopped) => {
    const end = performance.now() + 4000;
    let found = 0;
    const place = (el: HTMLElement) => {
      const s = scroller();
      const win = s === document.scrollingElement || s === document.documentElement;
      const top = el.getBoundingClientRect().top - (win ? 0 : s.getBoundingClientRect().top) + s.scrollTop - stuckAbove(s, el);
      if (Math.abs(s.scrollTop - Math.max(0, top)) > 1) jump(s, Math.max(0, top));
    };
    const step = () => {
      if (stopped()) return;
      const el = document.getElementById(id);
      if (el) {
        if (!found) {
          found = performance.now();
          el.setAttribute("data-ui-target", "");
          window.setTimeout(() => el.removeAttribute("data-ui-target"), 2600);
        }
        place(el);
        // keep it in view for a little while: parts above it may still be loading
        if (performance.now() - found > 1200) return;
      } else if (performance.now() > end) return;
      window.requestAnimationFrame(step);
    };
    step();
  });
}

/**
 * One scroll rule for the whole app (WAY-4, MOB-1). A new page (push or replace) opens at its top; back and forward
 * (pop) put the entry where it was left; the same page at a new address keeps the place when only the search changed
 * (an overlay's ?c=, a filter, ?show=calendar) or when it changed tab; an address with a #hash goes to that item.
 */
function useScrollRule() {
  const location = useLocation();
  const type = useNavigationType();
  const matches = useMatches();
  const leaf = matches[matches.length - 1]?.id ?? "";
  const last = useRef<{ key: string; path: string; leaf: string } | null>(null);
  const url = location.pathname + location.search;
  const current = useRef({ key: location.key, url });
  const running = useRef<() => void>(() => {});

  useEffect(() => {
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
  }, []);

  // remember each entry's place as the person scrolls
  useEffect(() => {
    let frame = 0;
    const onScroll = (e: Event) => {
      const s = scroller();
      const win = s === document.scrollingElement || s === document.documentElement;
      if (e.target !== s && !(win && e.target === document)) return;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => remember(current.current.key, current.current.url, s.scrollTop));
    };
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useLayoutEffect(() => {
    const before = last.current;
    if (before?.key === location.key) return;
    last.current = { key: location.key, path: location.pathname, leaf };
    current.current = { key: location.key, url };
    running.current();
    running.current = () => {};
    const saved = before || cameBack() ? placeOf(location.key, url) : undefined;
    // back and forward: where it was left (an entry never scrolled was at its top); a reload: where it was; a fresh
    // document opened by a link or a typed address: its top
    if (type === "POP" && (saved !== undefined || (before && !location.hash))) {
      running.current = restore(saved ?? 0);
      return;
    }
    if (location.hash) {
      running.current = toHash(location.hash);
      return;
    }
    if (!before || type === "POP") return;
    const samePage = before.leaf === leaf && (before.path === location.pathname || isTabChange(location.key));
    if (samePage) {
      remember(location.key, url, scroller().scrollTop);
      return;
    }
    jump(scroller(), 0);
  }, [location.key, location.pathname, location.hash, url, leaf, type]);
}
