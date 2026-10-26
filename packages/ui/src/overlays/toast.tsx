// Toast (design-system/components/toast.css, behaviour of toast.js), shadcn's sonner re-implemented in React.
// Markup: section.ui-toaster[aria-live=polite](.is-expanded) > ol.ui-toaster-list
//   > li.ui-glass.ui-glass--bar.ui-toast[data-type=done|error|loading|info][data-state=open|closed][data-index]
//     (svg.ico.ui-toast-icon, span.ui-toast-title, span.ui-toast-meta?, button.ui-btn.ui-btn--glass-clear.ui-btn--sm.ui-toast-action?)
// One line, every toast the same width at the bottom centre. Up to three show; each older one sits a little
// higher and smaller behind the newest with its words hidden; a mouse over the stack, or focus in it, opens
// it into a column and pauses every timer (so does a hidden page). A toast leaves after --ui-toast-duration
// (--ui-toast-duration-long with an action or for an error; a loading toast stays until updated), swipes
// away sideways or down past --ui-toast-swipe, and Escape dismisses the one with focus. Alt+T moves focus
// to the newest. The region is a polite live region, so each toast is read out.
// Words: say what happened, the actor named ("3 creatives approved", "Delivery failed"), no exclamation marks.
// Error: the icon alone is Rouge, the words say what went wrong. Never Amber, never green.
// A toast is for what happens out of sight or what can be undone, never for a change the item already shows. It leaves
// after 4 s (8 s with an action or for an error), leaves when the page changes (leave(): the app calls it on a change
// of path; a toast raised with the move, one with an action and a loading one stay), shows its whole sentence (it
// wraps, never cut), and rises above whatever sits at the foot of the screen: the tab bar, a floating action bar, a
// docked composer, a sheet's or dialog's footer, or anything marked [data-ui-foot].
// On a desk (1024 px and wider) toasts sit at the bottom left of the main column, 24 in from its edge (the sidebar's
// side), away from the composer's send and the viewer's Approve at the centre. A screen can name where its toasts go
// instead: [data-ui-toast-anchor] on a column puts them at its bottom left; [data-ui-toast-anchor="top"] at its top
// left (the viewer's comments panel). The same message raised again while it shows does not stack a second toast: the
// open one takes the new words and starts its time again. A toast never covers the control in use: what sits at the
// foot under it, and the element with focus when it is low on the screen, push it up.
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cx } from "../cx";
import { Icon, type IconName } from "../icons";
import { tokenMs, tokenPx } from "./shared";

export type ToastType = "done" | "error" | "loading" | "info";

export interface ToastAction {
  /** One or two words: "Undo", "Retry", "Open". */
  label: string;
  /** Runs, then the toast leaves. */
  onClick?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}

export interface ToastOptions {
  /** Reuse an id to replace nothing: ids only name a toast for update and dismiss. Default: a counter. */
  id?: string | number;
  /** done (circle check, default), error (alert circle in Rouge), loading (a turning loader, stays), info. */
  type?: ToastType;
  /** The message, one line. */
  title: string;
  /**
   * toast.css has one line and no description line: a description is joined to the title as a second
   * sentence on that line (and cut with an ellipsis when it does not fit; two lines on a phone).
   */
  description?: string;
  /** A count in the data type, such as "4 of 12": span.ui-toast-meta. */
  meta?: string;
  /** One clear button in the toast's ring (Undo). */
  action?: ToastAction;
  /** ms; default the tokens (5000, 8000 with an action or for an error, never for loading). */
  duration?: number;
}

export interface ToastHandle {
  id: string | number;
  /** Change it in place (a loading toast that becomes done); its timer starts again. */
  update: (changes: Partial<ToastOptions>) => ToastHandle;
  dismiss: () => void;
}

export interface ToastApi {
  /** Show a toast; a string is the title of a done toast. */
  toast: (options: ToastOptions | string) => ToastHandle;
  done: (title: string, options?: Omit<ToastOptions, "title" | "type">) => ToastHandle;
  error: (title: string, options?: Omit<ToastOptions, "title" | "type">) => ToastHandle;
  loading: (title: string, options?: Omit<ToastOptions, "title" | "type">) => ToastHandle;
  info: (title: string, options?: Omit<ToastOptions, "title" | "type">) => ToastHandle;
  /** A loading toast that becomes done or error when the promise settles. */
  promise: <T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      done: string | ((value: T) => Partial<ToastOptions>);
      error: string | ((error: unknown) => Partial<ToastOptions>);
    },
  ) => ToastHandle;
  /** Dismiss one toast by id, or all of them. */
  dismiss: (id?: string | number) => void;
  /** The place changed: toasts raised more than a moment ago leave; one raised with the move, one with an action
   *  (Undo) and a loading one stay. */
  leave: () => void;
}

const ICON: Record<ToastType, IconName> = {
  done: "circle-check",
  error: "circle-alert",
  loading: "loader-circle",
  info: "info",
};
const MAX_SHOWN = 3;
/** A toast raised this close before a change of place was raised with the move ("Brief sent", then the campaign opens). */
const MOVE_MS = 1200;
/** What sits at the foot of the screen; a toast rises above the highest of them. */
const FOOT =
  "[data-ui-foot], .ui-tab-bar-dock .ui-tab-bar, .ui-action-bar, .ui-composer-dock--sticky, .ui-settings-savebar, .ui-drawer-footer, .ui-sheet-footer, .ui-dialog-footer";

/** Where the toaster sits: centred (a phone, a page without a main column), at the bottom left of a column, or at
 *  the top left of an anchor that asks for it. x and w are the toast column's left edge and width, in px. */
interface Place {
  mode: "center" | "start" | "top";
  x?: number;
  y?: number;
  w?: number;
}

const DESK = "(min-width: 1024px)";

function placement(): Place {
  if (typeof window === "undefined" || !window.matchMedia?.(DESK).matches) return { mode: "center" };
  const inset = tokenPx("--ui-space-xl", 24);
  const width = tokenPx("--ui-toast-width", 400);
  const shown = (el: HTMLElement) => el.getClientRects().length > 0 && !el.closest("[hidden], [inert]");
  const anchors = Array.from(document.querySelectorAll<HTMLElement>("[data-ui-toast-anchor]")).filter(shown);
  const anchor = anchors[anchors.length - 1];
  const column = anchor ?? document.querySelector<HTMLElement>(".ui-sidebar-inset");
  if (!column || !shown(column)) return { mode: "center" };
  const r = column.getBoundingClientRect();
  const w = Math.max(0, Math.min(width, r.width - 2 * inset));
  if (w < 240) return { mode: "center" };
  if (anchor?.dataset.uiToastAnchor === "top")
    return { mode: "top", x: Math.round(r.left + inset), y: Math.round(Math.max(0, r.top) + inset), w };
  return { mode: "start", x: Math.round(r.left + inset), w };
}

/**
 * How far from the bottom of the screen the toaster must stay: the top of the highest thing at the foot that lies
 * under the toasts (between `from` and `to` across), and of the element in use when it is low on the screen, or 0.
 */
function footClearance(from = 0, to = Infinity): number {
  if (typeof document === "undefined") return 0;
  const h = window.innerHeight;
  const across = (r: DOMRect) => r.right > from && r.left < to;
  let clear = 0;
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(FOOT))) {
    if (!el.getClientRects().length || el.closest("[hidden], [inert], [aria-hidden='true']")) continue;
    const r = el.getBoundingClientRect();
    if (r.height === 0 || r.bottom < h * 0.6 || r.top > h || r.top < h * 0.35 || !across(r)) continue;
    if (getComputedStyle(el).visibility === "hidden") continue;
    clear = Math.max(clear, h - r.top);
  }
  // the control in use (a field, a button with focus) low on the screen: the toast stays above it
  const a = document.activeElement;
  if (a instanceof HTMLElement && a !== document.body && !a.closest(".ui-toaster")) {
    const r = a.getBoundingClientRect();
    if (r.height > 0 && r.top > h * 0.6 && r.top < h && across(r)) clear = Math.max(clear, h - r.top);
  }
  return Math.ceil(clear);
}

interface Rec {
  id: string | number;
  type: ToastType;
  title: string;
  description?: string;
  meta?: string;
  action?: ToastAction;
  duration?: number;
  state: "open" | "closed";
  /** its place in the stack when it left */
  frozen?: number;
  exit?: { x: number; y: number };
  timer?: number;
  left?: number;
  since?: number;
  /** when it was raised (Date.now()) */
  born: number;
}

const ToastContext = createContext<ToastApi | null>(null);

/** The toast functions. Throws outside a ToastProvider. */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast needs a <ToastProvider> above it.");
  return api;
}

export interface ToastProviderProps {
  children?: ReactNode;
  /** The region's name; default "Notifications (Alt+T)". */
  label?: string;
  /** Where the toaster mounts; default document.body. */
  container?: HTMLElement | null;
}

function words(r: Rec): string {
  if (!r.description) return r.title;
  return /[.?:]$/.test(r.title.trim()) ? `${r.title} ${r.description}` : `${r.title}. ${r.description}`;
}

/** Renders the toaster (section.ui-toaster) once and gives useToast() to everything inside. */
export function ToastProvider({ children, label = "Notifications (Alt+T)", container }: ToastProviderProps) {
  const recs = useRef<Rec[]>([]);
  const items = useRef(new Map<string | number, HTMLLIElement>());
  const regionRef = useRef<HTMLElement | null>(null);
  const counter = useRef(0);
  const paused = useRef(false);
  const [expanded, setExpandedState] = useState(false);
  const expandedRef = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [, render] = useReducer((n: number) => n + 1, 0);

  useEffect(() => setMounted(true), []);

  const live = () => recs.current.filter((r) => r.state === "open");

  const durationOf = (r: Rec) => {
    if (r.type === "loading") return Infinity;
    if (r.duration) return r.duration;
    return r.type === "error" || r.action
      ? tokenMs("--ui-toast-duration-long", 8000)
      : tokenMs("--ui-toast-duration", 5000);
  };
  const stop = (r: Rec) => {
    if (r.timer) {
      window.clearTimeout(r.timer);
      r.timer = undefined;
      if (r.since != null && r.left != null) r.left = Math.max(0, r.left - (Date.now() - r.since));
    }
  };
  // functions below reach each other through refs, so the api object stays stable
  const dismissRef = useRef<(r: Rec, dir?: { x: number; y: number }) => void>(() => {});
  const start = (r: Rec) => {
    stop(r);
    if (paused.current || r.state !== "open") return;
    if (r.left == null) r.left = durationOf(r);
    if (!Number.isFinite(r.left)) return;
    r.since = Date.now();
    r.timer = window.setTimeout(() => dismissRef.current(r), r.left);
  };
  const setPaused = (on: boolean) => {
    if (on === paused.current) return;
    paused.current = on;
    live().forEach((r) => (on ? stop(r) : start(r)));
  };
  const setExpanded = (on: boolean) => {
    expandedRef.current = on;
    setExpandedState(on);
    setPaused(on || document.hidden);
  };

  const remove = (r: Rec) => {
    const i = recs.current.indexOf(r);
    if (i < 0) return;
    recs.current.splice(i, 1);
    items.current.delete(r.id);
    render();
  };

  dismissRef.current = (r, dir) => {
    if (r.state !== "open") return;
    const order = live();
    const li = items.current.get(r.id);
    const focused = !!li && li.contains(document.activeElement);
    stop(r);
    r.frozen = order.indexOf(r);
    r.state = "closed";
    r.exit = dir;
    window.setTimeout(() => remove(r), 600); // in case animationend never comes
    render();
    if (focused) {
      const next = live()[0];
      const nextLi = next && items.current.get(next.id);
      if (nextLi) nextLi.focus();
      else regionRef.current?.focus();
    }
    if (!live().length && expandedRef.current && !regionRef.current?.matches(":hover")) setExpanded(false);
  };

  const apiRef = useRef<ToastApi | null>(null);
  if (!apiRef.current) {
    const handleOf = (r: Rec): ToastHandle => {
      const handle: ToastHandle = {
        id: r.id,
        update: (changes) => {
          Object.assign(r, changes);
          r.left = undefined;
          start(r);
          render();
          return handle;
        },
        dismiss: () => dismissRef.current(r),
      };
      return handle;
    };
    const toast = (input: ToastOptions | string): ToastHandle => {
      const o: ToastOptions = typeof input === "string" ? { title: input } : input;
      // the same message again while it shows: the open toast takes it and starts its time again
      const same = live().find((x) =>
        o.id != null
          ? x.id === o.id
          : x.title === o.title && x.type === (o.type ?? "done") && x.description === o.description,
      );
      if (same) {
        Object.assign(same, {
          title: o.title,
          type: o.type ?? same.type,
          description: o.description,
          meta: o.meta,
          action: o.action,
          duration: o.duration,
          born: Date.now(),
        });
        same.left = undefined;
        start(same);
        render();
        return handleOf(same);
      }
      const r: Rec = {
        id: o.id ?? ++counter.current,
        type: o.type ?? "done",
        title: o.title,
        description: o.description,
        meta: o.meta,
        action: o.action,
        duration: o.duration,
        state: "open",
        born: Date.now(),
      };
      recs.current.unshift(r);
      live()
        .slice(MAX_SHOWN)
        .forEach((old) => dismissRef.current(old));
      start(r);
      render();
      return handleOf(r);
    };
    const typed = (type: ToastType) => (title: string, options?: Omit<ToastOptions, "title" | "type">) =>
      toast({ ...options, title, type });
    apiRef.current = {
      toast,
      done: typed("done"),
      error: typed("error"),
      loading: typed("loading"),
      info: typed("info"),
      promise: (promise, m) => {
        const t = toast({ type: "loading", title: m.loading });
        promise.then(
          (v) => t.update({ type: "done", ...(typeof m.done === "function" ? m.done(v) : { title: m.done }) }),
          (err) => t.update({ type: "error", ...(typeof m.error === "function" ? m.error(err) : { title: m.error }) }),
        );
        return t;
      },
      dismiss: (id) => {
        recs.current
          .filter((r) => r.state === "open" && (id == null || r.id === id))
          .forEach((r) => dismissRef.current(r));
      },
      leave: () => {
        const now = Date.now();
        recs.current
          .filter((r) => r.state === "open" && !r.action && r.type !== "loading" && now - r.born > MOVE_MS)
          .forEach((r) => dismissRef.current(r));
      },
    };
  }

  // a hidden page pauses the timers; Alt+T reaches the stack; timers stop with the provider
  useEffect(() => {
    const onVisibility = () => setPaused(expandedRef.current || document.hidden);
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.code === "KeyT") {
        const first = live()[0];
        const li = first && items.current.get(first.id);
        if (li) {
          e.preventDefault();
          (li.querySelector("button") ?? li).focus();
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("keydown", onKey);
      recs.current.forEach(stop);
    };
    // the handlers read refs only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const order = live();
  const showing = order.length > 0;
  // rise above what sits at the foot of the screen, measured while toasts show (bars come and go under them)
  const [clear, setClear] = useState(0);
  const [place, setPlace] = useState<Place>({ mode: "center" });
  useLayoutEffect(() => {
    if (!showing) return;
    const measure = () => {
      const p = placement();
      setPlace((old) => (old.mode === p.mode && old.x === p.x && old.y === p.y && old.w === p.w ? old : p));
      const w =
        p.w ?? Math.min(tokenPx("--ui-toast-width", 400), window.innerWidth - 2 * tokenPx("--ui-overlay-margin", 16));
      const x = p.x ?? (window.innerWidth - w) / 2;
      setClear(p.mode === "top" ? 0 : footClearance(x, x + w));
    };
    measure();
    const timer = window.setInterval(measure, 400);
    window.addEventListener("resize", measure);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", measure);
    };
  }, [showing]);
  const region = (
    <section
      ref={regionRef}
      className={cx("ui-toaster", expanded && "is-expanded")}
      data-clear={clear > 0 ? "" : undefined}
      data-place={place.mode === "center" ? undefined : place.mode}
      style={
        {
          ...(clear > 0 ? { "--ui-toast-clear": `${clear}px` } : {}),
          ...(place.x != null ? { "--ui-toast-x": `${place.x}px` } : {}),
          ...(place.y != null ? { "--ui-toast-y": `${place.y}px` } : {}),
          ...(place.w != null ? { "--ui-toast-w": `${place.w}px` } : {}),
        } as CSSProperties
      }
      aria-label={label}
      aria-live="polite"
      aria-relevant="additions text"
      tabIndex={-1}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") setExpanded(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse" && !regionRef.current?.contains(document.activeElement)) setExpanded(false);
      }}
      onFocus={() => setExpanded(true)}
      onBlur={(e) => {
        if (!regionRef.current?.contains(e.relatedTarget as Node | null)) setExpanded(false);
      }}
    >
      <ol className="ui-toaster-list">
        {recs.current.map((r) => {
          const index = r.state === "open" ? order.indexOf(r) : (r.frozen ?? 0);
          return (
            <ToastItem
              key={r.id}
              rec={r}
              index={index}
              text={words(r)}
              onRef={(node) => {
                if (node) items.current.set(r.id, node);
              }}
              onDismiss={(dir) => dismissRef.current(r, dir)}
              onGone={() => remove(r)}
            />
          );
        })}
      </ol>
    </section>
  );

  return (
    <ToastContext.Provider value={apiRef.current}>
      {children}
      {mounted && createPortal(region, container ?? document.body)}
    </ToastContext.Provider>
  );
}

interface ToastItemProps {
  rec: Rec;
  index: number;
  text: string;
  onRef: (node: HTMLLIElement | null) => void;
  onDismiss: (dir?: { x: number; y: number }) => void;
  onGone: () => void;
}

function ToastItem({ rec, index, text, onRef, onDismiss, onGone }: ToastItemProps) {
  const [swipe, setSwipe] = useState({ x: 0, y: 0, on: false });
  const s = useRef<{ x: number; y: number; id: number; t: number; dx: number; dy: number } | null>(null);
  const liRef = useRef<HTMLLIElement | null>(null);

  const onPointerDown = (e: ReactPointerEvent<HTMLLIElement>) => {
    if ((e.target as HTMLElement).closest("button") || e.button > 0) return;
    s.current = { x: e.clientX, y: e.clientY, id: e.pointerId, t: performance.now(), dx: 0, dy: 0 };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture is a nicety */
    }
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLLIElement>) => {
    const d = s.current;
    if (!d || e.pointerId !== d.id) return;
    d.dx = e.clientX - d.x;
    d.dy = Math.max(0, e.clientY - d.y);
    setSwipe({ x: d.dx, y: d.dy, on: Math.abs(d.dx) > 2 || d.dy > 2 });
  };
  const end = (e: ReactPointerEvent<HTMLLIElement>) => {
    const d = s.current;
    if (!d || e.pointerId !== d.id) return;
    s.current = null;
    const far = tokenPx("--ui-toast-swipe", 48);
    const v = Math.hypot(d.dx, d.dy) / Math.max(1, performance.now() - d.t);
    const li = liRef.current;
    if (li && (Math.abs(d.dx) > far || d.dy > far || v > 0.6)) {
      const sideways = Math.abs(d.dx) >= d.dy;
      setSwipe({ x: d.dx, y: d.dy, on: false });
      onDismiss(sideways ? { x: (d.dx > 0 ? 1 : -1) * li.offsetWidth, y: 0 } : { x: 0, y: li.offsetHeight * 2 });
    } else {
      setSwipe({ x: 0, y: 0, on: false });
    }
  };

  // --i, --swipe-*, --exit-* are read by toast.css; z-index orders the stack, as toast.js sets them
  const style = {
    "--i": index,
    zIndex: 10 - index,
    "--swipe-x": `${swipe.x}px`,
    "--swipe-y": `${swipe.y}px`,
    ...(rec.exit ? { "--exit-x": `${rec.exit.x}px`, "--exit-y": `${rec.exit.y}px` } : null),
  } as CSSProperties;

  return (
    <li
      ref={(node) => {
        liRef.current = node;
        onRef(node);
      }}
      className="ui-glass ui-glass--bar ui-toast"
      data-type={rec.type}
      data-state={rec.state}
      data-index={String(index)}
      data-swiping={swipe.on ? "" : undefined}
      aria-hidden={index > MAX_SHOWN - 1}
      tabIndex={0}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !e.defaultPrevented) {
          e.preventDefault();
          onDismiss();
        }
      }}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && rec.state === "closed") onGone();
      }}
    >
      <Icon name={ICON[rec.type]} className="ui-toast-icon" />
      <span className="ui-toast-title">{text}</span>
      {rec.meta && <span className="ui-toast-meta">{rec.meta}</span>}
      {rec.action && (
        <button
          type="button"
          className="ui-btn ui-btn--glass-clear ui-btn--sm ui-toast-action"
          onClick={(e) => {
            e.stopPropagation();
            rec.action?.onClick?.(e);
            onDismiss();
          }}
        >
          {rec.action.label}
        </button>
      )}
    </li>
  );
}
