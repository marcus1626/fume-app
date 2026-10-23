// The frame every screen uses inside a shell: the page (app.css .ui-app-page), its sections, and what a page shows
// while its data loads or when it fails. Screens compose these with @fume/ui; none of them adds a look.
// Round 8 (walk-through 19 Oct, WAY-1, MOB-7): the page also names itself in the tab's history, so a Back arrow can
// name and return to where the person came from, and it tells the shell its title and its way back, so the app bar
// can keep both in view once the page's own header has scrolled away.
// Round 9 (desktop review 19 Oct; PROPOSED 19 Oct 2026):
// - DWAY-6, DLAY-16: on a desk (1024 px and wider) the app bar always carries the way back with its target's name
//   ("← Home"), beside the sidebar button, and the page's title after a thin divider once the header has scrolled
//   away; the page header's own back row is left out there, so the content starts higher. The phone keeps both.
// - DWAY-19: the browser tab says where you are: "<page> · <parent> · Fume". `title` names the page (its first part
//   names it in a Back arrow); `docTitle` gives the tab a fuller name ("Brief · Autumn launch").
// - DLAY-7, DLAY-8: `width="reading"` is the reading measure (760), left-aligned on the same left edge as every page.
// - DWAY-17: useTabNavigate() changes a tab with replace, so Back and the browser's Back both leave the page.
// Round 12 (desktop review 20 Oct, DWAY-15; PROPOSED 20 Oct 2026): in a staff frame's brand or client scope the frame
// names the brand (PageScopeProvider), and the tab says it after the page: "Autumn launch · LYSNE · Fume", so three
// clients in three tabs never read the same. A page whose name already holds the brand ("LYSNE") says it once.
import { BackLink, Button, cx, Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle, Spinner, WithTooltip, type IconName } from "@fume/ui";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type HTMLAttributes, type MouseEvent, type ReactNode } from "react";
import { useHref, useLocation, useNavigate, type NavigateOptions } from "react-router-dom";
import { FumeError } from "../contract";

export interface PageProps extends HTMLAttributes<HTMLDivElement> {
  /** The page's name ("Autumn launch", "Products · Brand"). Its first part (before " · ") names the page in a Back
   *  arrow and in the app bar; the whole of it is the browser tab's title, with " · Fume" added. */
  title: string;
  /** The browser tab's title when it should say more than `title` ("Brief · Autumn launch", "Team · Settings",
   *  "Winter gifting · Fume chat"). " · Fume" is added unless it already ends with Fume's name. */
  docTitle?: string;
  /** reading: a brief, a form, settings, a list of statements (the 760 reading measure, left-aligned);
   *  fill: the conversation or a canvas, which scrolls itself. */
  width?: "default" | "reading" | "fill";
}

/** "Brief · Autumn launch" → "Brief · Autumn launch · Fume"; "Winter gifting · Fume chat" stays as it is. */
export const tabTitle = (name: string) => (/(^|·\s*)Fume\b[^·]*$/.test(name) ? name : `${name} · Fume`);

/** What a page tells the shell's bar: its name and its way back (the shell shows them once the header scrolls away). */
export interface PageBar {
  title?: string;
  back?: BackProps;
}
const PageBarContext = createContext<((bar: PageBar) => void) | null>(null);
/** The shell provides this; Page and Back report to it. */
export const PageBarProvider = PageBarContext.Provider;
const PageTitleContext = createContext<string | undefined>(undefined);
/** Back tells its Page the parent's name, so the browser tab says "Autumn launch · Campaigns · Fume" (DWAY-19). */
const PageParentContext = createContext<((parent: string | undefined) => void) | null>(null);
/** The brand or client a staff frame's scope is in (round 12, DWAY-15): the tab names it instead of the parent. */
const PageScopeContext = createContext<string | undefined>(undefined);
export const PageScopeProvider = PageScopeContext.Provider;

export function Page({ title, docTitle, width = "default", className, ...props }: PageProps) {
  const { key } = useLocation();
  const setBar = useContext(PageBarContext);
  const scope = useContext(PageScopeContext);
  const [parent, setParent] = useState<string | undefined>(undefined);
  useEffect(() => {
    // "<page> · <parent> · Fume": the parent is the page's Back, unless the title or docTitle already says more; in a
    // brand's scope the brand takes the parent's place ("Autumn launch · LYSNE · Fume"), once
    const own = docTitle ?? (!scope && parent && !title.includes(" · ") && parent !== title ? `${title} · ${parent}` : title);
    const name = scope && !own.includes(scope) ? `${own} · ${scope}` : own;
    document.title = tabTitle(name);
    nameEntry(title);
  }, [title, docTitle, parent, scope, key]);
  useEffect(() => setBar?.({ title }), [setBar, title]);
  useEffect(() => () => setBar?.({ title: undefined }), [setBar]);
  const ref = useHoldHeight();
  return (
    <PageTitleContext.Provider value={title}>
      <PageParentContext.Provider value={setParent}>
        <div ref={ref} className={cx("ui-app-page", width !== "default" && `ui-app-page--${width}`, className)} {...props} />
      </PageParentContext.Provider>
    </PageTitleContext.Provider>
  );
}

/** "Colour · Brand" → "Colour": the name a Back arrow shows for a page. */
export const pageName = (title: string) => title.split(" · ")[0]!.trim();

/**
 * Tabs that change the address (DWAY-17): a tab replaces the history entry instead of adding one, so the browser's
 * Back and the page's Back both leave the page, never step through its tabs.
 *   const goTab = useTabNavigate();
 *   <Tabs value={tab} onValueChange={(t) => goTab(`/campaigns/${id}/${t}`)}>
 * For a link: <Link to=… replace>.
 */
export function useTabNavigate() {
  const navigate = useNavigate();
  return useCallback((to: string, options?: Omit<NavigateOptions, "replace">) => navigate(to, { ...options, replace: true }), [navigate]);
}

// ─── Tabs that don't jump ───────────────────────────────────────────────────
// A tab or a view toggle changes the address (?show=calendar, /brand/products) while the page stays. The next tab
// often loads first, so for a moment the page is only its header and a spinner: the scroller clamps its scroll to
// the shorter page and, when the content comes, the tabs have moved (Marcus 15 Oct: "siden hopper litt"). So the
// page keeps the height it had while anything in it still loads after such a change (app.css, data-hold), and
// lets go as soon as the new content is there (or after 3 s), down to the height the reader's scroll needs. The
// scroller (.ui-sidebar-inset) keeps its scrollbar's room (app.css) and the app bar no longer shrinks.

let inPage: { key: string; tabs: boolean } | null = null;
/** True when the navigation with this key only changed the tab of the page that stays (read by the scroll rule). */
export const isTabChange = (key: string) => inPage?.key === key && inPage.tabs;

function useHoldHeight() {
  const ref = useRef<HTMLDivElement>(null);
  const height = useRef(0);
  const { pathname, search, key } = useLocation();
  const place = pathname + search;
  const shown = useRef(place);
  // The height the page had in the last frame, while nothing in it was loading
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (!el.querySelector(".ui-app-loading")) height.current = el.offsetHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Hold while rendering the new place, before React swaps the content: any layout read after the swap (a tab
  // indicator measuring itself) would already let the scroller clamp.
  if (shown.current !== place) {
    shown.current = place;
    const el = ref.current;
    // The same page at a new address. When it shows tabs, this is a tab change: the scroll rule (Root) keeps the
    // reader's place for it instead of starting the page at its top.
    inPage = { key, tabs: Boolean(el?.querySelector(".ui-page-header-tabs")) };
    if (el && height.current) {
      el.style.setProperty("--ui-app-page-hold", `${height.current}px`);
      el.setAttribute("data-hold", "");
    }
  }
  // Let go once nothing in the page loads any more (or after 3 s)
  useEffect(() => {
    const el = ref.current;
    if (!el || !el.hasAttribute("data-hold")) return;
    // Letting go keeps a floor: as much height as the scroll the reader is at needs, so a shorter tab doesn't pull
    // the page (and its tabs) down either. It is room under the last line, until the next change of place.
    const scroller = el.closest(".ui-sidebar-inset");
    const release = () => {
      const floor = scroller
        ? scroller.scrollTop + scroller.clientHeight - (el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop)
        : 0;
      if (floor > 0) el.style.setProperty("--ui-app-page-hold", `${Math.ceil(floor)}px`);
      else {
        el.removeAttribute("data-hold");
        el.style.removeProperty("--ui-app-page-hold");
      }
      mo.disconnect();
      window.clearTimeout(timer);
    };
    // nothing loading for two frames in a row: a part that loads in steps has shown its next spinner by then
    let frame = 0;
    const loading = () => Boolean(el.querySelector(".ui-app-loading"));
    const check = () => {
      window.cancelAnimationFrame(frame);
      if (loading()) return;
      frame = window.requestAnimationFrame(() => {
        frame = window.requestAnimationFrame(() => {
          if (!loading()) release();
        });
      });
    };
    const mo = new MutationObserver(check);
    mo.observe(el, { childList: true, subtree: true });
    const timer = window.setTimeout(release, 3000);
    check();
    return () => {
      mo.disconnect();
      window.clearTimeout(timer);
      window.cancelAnimationFrame(frame);
    };
  }, [place]);
  return ref;
}

// ─── Back ───────────────────────────────────────────────────────────────────
// One back link above the title instead of a breadcrumb (Marcus 15 Oct: "heller bare en pil tilbake knapp"). Back goes
// back (walk-through 19 Oct, WAY-1): it names the page the person came from ("← Fume", "← SS27", "← Autumn launch")
// and returns there through history, so that page keeps its view, filters and scroll. Entries of the same page (its
// tabs, an overlay's ?param) are stepped over. Only on a cold deep link, with nothing of the app before it, does it
// name and open the fixed parent the screen passes. The browser router numbers its entries (history.state.idx);
// every push and replace is noted here, and each Page names its entry, so the entries before are known.

const TRAIL = "fume.trail";
interface Entry {
  /** pathname + search */
  url: string;
  /** The page's title (Page's `title`), once it rendered. */
  title?: string;
}
type Trail = Record<number, Entry>;

function readTrail(): Trail {
  try {
    const raw = JSON.parse(sessionStorage.getItem(TRAIL) ?? "{}") as Record<number, Entry | string>;
    const out: Trail = {};
    for (const [k, v] of Object.entries(raw)) out[Number(k)] = typeof v === "string" ? { url: v } : v;
    return out;
  } catch {
    return {};
  }
}

function writeTrail(trail: Trail) {
  try {
    sessionStorage.setItem(TRAIL, JSON.stringify(trail));
  } catch {
    /* private mode: Back opens the parent */
  }
}

const pathOf = (url: string) => url.split(/[?#]/)[0]!;
const currentIdx = () => {
  const idx = (window.history.state as { idx?: unknown } | null)?.idx;
  return typeof idx === "number" ? idx : undefined;
};

function note(state: unknown, url: string | URL | null | undefined) {
  const idx = (state as { idx?: unknown } | null)?.idx;
  if (typeof idx !== "number") return;
  const at = new URL(url ?? window.location.href, window.location.href);
  const trail = readTrail();
  const before = trail[idx];
  const next = at.pathname + at.search;
  // the same page at a new search keeps its name until the page names the entry again
  trail[idx] = { url: next, title: before && pathOf(before.url) === at.pathname ? before.title : undefined };
  for (const k of Object.keys(trail)) if (Number(k) > idx) delete trail[Number(k)];
  writeTrail(trail);
}

/** Page names the entry it is showing. */
function nameEntry(title: string) {
  const idx = currentIdx();
  if (idx === undefined) return;
  const trail = readTrail();
  trail[idx] = { url: window.location.pathname + window.location.search, title };
  writeTrail(trail);
}

if (typeof window !== "undefined" && !(window.history as { __fumeTrail?: boolean }).__fumeTrail) {
  (window.history as { __fumeTrail?: boolean }).__fumeTrail = true;
  const push = window.history.pushState.bind(window.history);
  const replace = window.history.replaceState.bind(window.history);
  window.history.pushState = (state, unused, url) => {
    push(state, unused, url);
    note(state, url);
  };
  window.history.replaceState = (state, unused, url) => {
    replace(state, unused, url);
    note(state, url);
  };
}

/** The nearest entry before this one that is another page, and how many steps back it is. The onboarding is never
 *  a place to go back to; an entry the app did not note means a cold start. */
function entryBefore(title: string | undefined, pathname: string): { steps: number; entry: Entry } | undefined {
  const idx = currentIdx();
  if (idx === undefined) return undefined;
  const trail = readTrail();
  for (let steps = 1; steps <= idx; steps++) {
    const entry = trail[idx - steps];
    if (!entry) return undefined;
    const path = pathOf(entry.url);
    if (path === pathname || (title !== undefined && entry.title === title)) continue;
    if (path === "/welcome" || path.startsWith("/welcome/")) return undefined;
    return { steps, entry };
  }
  return undefined;
}

export interface BackProps {
  /** The fixed parent ("/brand/products"): used on a cold deep link, when nothing of the app came before. */
  to: string;
  /** Its name ("Products"). */
  label: string;
}

/** Where Back goes: the name to show, a real href, whether it is the cold fallback, and the move itself. */
export interface BackTarget {
  label: string;
  href: string;
  /** True when nothing of the app came before (a deep link): the fixed parent. */
  cold: boolean;
  back: () => void;
}

/**
 * The history-aware way back, for any screen's own back or close (a viewer's ✕, a full-screen flow): the page the
 * person came from, by name, through history; the fixed parent only on a cold deep link.
 */
export function useBack({ to, label }: BackProps): BackTarget {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const title = useContext(PageTitleContext);
  const parentHref = useHref(to);
  const found = typeof window === "undefined" ? undefined : entryBefore(title, pathname);
  if (!found) return { label, href: parentHref, cold: true, back: () => navigate(to) };
  const { steps, entry } = found;
  const name = entry.title ? pageName(entry.title) : pathOf(entry.url) === pathOf(to) ? label : "Back";
  return { label: name, href: entry.url, cold: false, back: () => navigate(-steps) };
}

/** The back link for PageHeader's `back`. Screens pass their fixed parent; it is shown only on a cold deep link.
 *  On a desk the app bar shows it (with the same name), and the page header leaves its own row out (DLAY-16). */
export function Back({ to, label, className }: BackProps & { className?: string }) {
  const target = useBack({ to, label });
  const setBar = useContext(PageBarContext);
  const setParent = useContext(PageParentContext);
  useEffect(() => {
    setBar?.({ back: { to, label } });
    setParent?.(label);
    return () => {
      setBar?.({ back: undefined });
      setParent?.(undefined);
    };
  }, [setBar, setParent, to, label]);
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    target.back();
  };
  return <BackLink className={className} href={target.href} label={target.label} onClick={onClick} />;
}

/** The app bar's way back (MOB-7, DWAY-6): the arrow with its target's name ("← Home"; on a phone the arrow alone),
 *  then, once the page's header has scrolled away, a thin divider and the page's one-line title. */
export function BarBack({ back, title, away }: { back?: BackProps; title?: string; away?: boolean }) {
  // the bar sits outside the page, so it takes the page's title along: Back steps over the same page's entries
  return (
    <PageTitleContext.Provider value={title}>
      {back && <BarBackLink back={back} />}
      {title && (
        <>
          {back && <span className="ui-app-bar-divider" aria-hidden="true" />}
          <span className="ui-app-bar-title" aria-hidden={away ? undefined : true}>
            {pageName(title)}
          </span>
        </>
      )}
    </PageTitleContext.Provider>
  );
}

function BarBackLink({ back }: { back: BackProps }) {
  const target = useBack(back);
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    target.back();
  };
  return (
    <WithTooltip label={`Back to ${target.label}`} side="bottom">
      <BackLink href={target.href} label={target.label} onClick={onClick} />
    </WithTooltip>
  );
}

export interface SectionProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  /** A count or a time beside the title, in the data face. */
  meta?: ReactNode;
  /** One quiet action at the end of the title line ("See all"). */
  action?: ReactNode;
  /** One line under the title. */
  text?: ReactNode;
  titleId?: string;
}

export function Section({ title, meta, action, text, titleId, className, children, ...props }: SectionProps) {
  return (
    <section className={cx("ui-app-section", className)} aria-labelledby={title ? titleId : undefined} {...props}>
      {(title || action) && (
        <div className="ui-app-section-head">
          {title && (
            <h2 className="ui-app-section-title" id={titleId}>
              {title}
            </h2>
          )}
          {meta !== undefined && <span className="ui-app-section-meta">{meta}</span>}
          {action}
        </div>
      )}
      {text && <p className="ui-app-section-text">{text}</p>}
      {children}
    </section>
  );
}

/** While a page's data is on its way: one spinner, nothing else. */
export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="ui-app-loading">
      <Spinner size="xl" label={label} />
    </div>
  );
}

/** When a call fails: what happened in words, and one way on. A forbidden call says who can do it instead. */
export function Failed({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message =
    error instanceof FumeError ? error.message : "Fume couldn’t load this just now. Your work is safe; try again in a moment.";
  const notFound = error instanceof FumeError && error.code === "not_found";
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia icon={notFound ? "search" : "circle-alert"} />
        <EmptyTitle>{notFound ? "This isn’t here" : "This didn’t load"}</EmptyTitle>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
      {onRetry && !notFound && (
        <EmptyContent>
          <Button variant="secondary" icon="refresh-cw" onClick={onRetry}>
            Try again
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}

/** An empty list with one line on why and, when there is one, the way to fill it. */
export function Nothing({ icon, title, text, action }: { icon: IconName; title: string; text?: ReactNode; action?: ReactNode }) {
  return (
    <Empty surface>
      <EmptyHeader>
        <EmptyMedia icon={icon} />
        <EmptyTitle>{title}</EmptyTitle>
        {text && <EmptyDescription>{text}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}

/** Renders a query's three states the same way on every screen. */
export function Query<T>({
  query,
  children,
  loading,
}: {
  query: { data: T | undefined; error: unknown; isPending: boolean; refetch: () => unknown };
  children: (data: T) => ReactNode;
  loading?: string;
}) {
  if (query.isPending) return <Loading label={loading} />;
  if (query.error || query.data === undefined) return <Failed error={query.error} onRetry={() => query.refetch()} />;
  return <>{children(query.data)}</>;
}
