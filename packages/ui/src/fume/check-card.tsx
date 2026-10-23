// Check card (design-system/components/check-card.css): one thing at a time to confirm (app round 8, UX review
// LOAD-3, TASK-6, WAY-6). PROPOSED 19 Oct 2026. <CheckCard> is the card (a product, a brand item); <CheckLine> one
// Product Truth line with its Change; <CheckAsk> the one question Fume has, on the card itself; <CheckEnd> what is next
// after the last card. <CheckStage> is the round 8 full-screen stage (kept for old callers; the queues no longer use it).
// Round 9 (DLAY-10, DLOAD-13, DWAY-13, DTSK-14; PROPOSED 19 Oct 2026): <CheckQueue> is the ONE queue frame for every
// "one at a time" confirm (products, the brand), inside the app's shell: on a desk a 260 list of the items on the left
// (<CheckQueueList>, <CheckQueueItem>: thumbnail, name, why it waits, a done tick; ↑ ↓ move through it), the card on
// the right at a 760 measure, and its foot pinned to the bottom of the window at the same place for every item: where
// she is ("2 of 7", ‹ ›) on the left, Later · Confirm on the right (the app's step footer, PageFooter). On a phone the
// list goes and the foot takes the tab bar's place, so the one-card flow stays.
import { forwardRef, useLayoutEffect, useRef, type ButtonHTMLAttributes, type HTMLAttributes, type KeyboardEvent, type ReactNode } from "react";
import { PageFooter } from "../content/page-header";
import { cx } from "../cx";
import { Icon } from "../icons";
import { Btn, ProgressBar } from "./_parts";

export interface CheckStageProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title: ReactNode;
  /** Where she is: done and total, for "2 of 7" and the progress line. Left out on the end card. */
  step?: { at: number; of: number };
  /** The close button's action (back to where she came from). */
  onClose: () => void;
  closeLabel?: string;
  /** The pills at the foot: Later · Confirm. */
  foot?: ReactNode;
  /** Read aloud when it changes ("Hand Balm confirmed. Next: Pillow Mist"). */
  live?: string;
}

export function CheckStage({ title, step, onClose, closeLabel = "Close", foot, live, className, children, ...props }: CheckStageProps) {
  return (
    <div className={cx("ui-check", className)} {...props}>
      <header className="ui-check-bar">
        <Btn variant="quiet" iconOnly icon="x" aria-label={closeLabel} onClick={onClose} />
        <h1 className="ui-check-title">{title}</h1>
        {step && step.of > 1 && (
          <span className="ui-check-count">
            {Math.min(step.at + 1, step.of)} of {step.of}
          </span>
        )}
      </header>
      {step && step.of > 1 ? <ProgressBar className="ui-check-progress" value={step.at} max={step.of} label={`${step.at} of ${step.of} done`} /> : <span />}
      <main className="ui-check-stage">{children}</main>
      <footer className="ui-check-foot">{foot}</footer>
      <p className="ui-check-live" aria-live="polite">
        {live}
      </p>
    </div>
  );
}

export interface CheckCardProps extends HTMLAttributes<HTMLElement> {
  /** Moving on: slides out to the left and fades (motion slow). */
  leaving?: boolean;
  /** Inside a page (Brand › Check) instead of the full-screen stage. */
  page?: boolean;
  /** The card has a picture column beside its words on a wide screen (page cards). */
  media?: boolean;
}

export const CheckCard = forwardRef<HTMLElement, CheckCardProps>(function CheckCard({ leaving, page, media, className, ...props }, ref) {
  return (
    <article
      ref={ref}
      className={cx("ui-check-card", page && "ui-check-card--page", className)}
      data-leaving={leaving || undefined}
      data-media={media || undefined}
      {...props}
    />
  );
});

export interface CheckLineProps extends Omit<HTMLAttributes<HTMLLIElement>, "title"> {
  label: ReactNode;
  /** A quiet note after the label ("Fume is not sure", "Fixed"). */
  note?: ReactNode;
  /** The words, or a field while she fixes it. */
  children: ReactNode;
  /** The field is open: it takes the whole width. */
  editing?: boolean;
  /** Fix, at the end of the line. */
  action?: ReactNode;
}

export function CheckLine({ label, note, editing, action, className, children, ...props }: CheckLineProps) {
  return (
    <li className={cx("ui-check-line", className)} data-editing={editing || undefined} {...props}>
      <span className="ui-check-line-label">
        {label}
        {note && <span className="ui-check-line-note">{note}</span>}
      </span>
      {editing ? <div className="ui-check-line-field">{children}</div> : <span className="ui-check-line-text">{children}</span>}
      {action && !editing && <span className="ui-check-line-act">{action}</span>}
    </li>
  );
}

export interface CheckAskProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  /** Small words above the question: "Fume needs this from you". */
  eyebrow?: ReactNode;
  title: ReactNode;
  why?: ReactNode;
}

export function CheckAsk({ eyebrow = "Fume needs this from you", title, why, className, children, ...props }: CheckAskProps) {
  return (
    <section className={cx("ui-check-ask", className)} {...props}>
      <div className="ui-check-ask-head">
        {eyebrow && <p className="ui-check-ask-eyebrow">{eyebrow}</p>}
        <h3 className="ui-check-ask-title">{title}</h3>
        {why && <p className="ui-check-ask-why">{why}</p>}
      </div>
      {children}
    </section>
  );
}

export interface CheckEndProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title: ReactNode;
  text?: ReactNode;
  /** The one Ink pill first, then at most one more. */
  actions?: ReactNode;
}

export function CheckEnd({ title, text, actions, className, children, ...props }: CheckEndProps) {
  return (
    <section className={cx("ui-check-end", className)} {...props}>
      <h2 className="ui-check-end-title">{title}</h2>
      {text && <p className="ui-check-end-text">{text}</p>}
      {children}
      {actions && <div className="ui-check-end-actions">{actions}</div>}
    </section>
  );
}

// ---------------------------------------------------------------- the queue frame (round 9)

export interface CheckQueueProps extends HTMLAttributes<HTMLDivElement> {
  /** <CheckQueueList> of every item. Shown beside the card on a desk; gone on a phone. */
  list?: ReactNode;
  /** Where she is, at the foot's start: "2 of 7" and the ‹ › buttons. */
  step?: ReactNode;
  /** The decision, at the foot's end: Later (quiet) · Confirm (Ink, last). */
  foot?: ReactNode;
  /** Read aloud when it changes ("Hand Balm confirmed. Next: Pillow Mist."). */
  live?: string;
}

/** The scroller the queue lives in: the shell's inset, or the window. */
function scrollerOf(el: HTMLElement): HTMLElement {
  return el.closest<HTMLElement>(".ui-sidebar-inset") ?? (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}

/**
 * The queue frame. The card column fills the window down to its foot, so the foot sits at the bottom of the window
 * for a short card and stays there (sticky) for a long one: Later and Confirm never move between items.
 */
export const CheckQueue = forwardRef<HTMLDivElement, CheckQueueProps>(function CheckQueue({ list, step, foot, live, className, children, ...props }, ref) {
  const own = useRef<HTMLDivElement | null>(null);
  // The room from the queue’s top to the window’s foot, as a custom property the stylesheet reads at every width.
  useLayoutEffect(() => {
    const el = own.current;
    if (!el) return;
    const measure = () => {
      const s = scrollerOf(el);
      const win = s === document.scrollingElement || s === document.documentElement;
      const top = el.getBoundingClientRect().top - (win ? 0 : s.getBoundingClientRect().top) + s.scrollTop;
      const room = Math.max(0, (win ? window.innerHeight : s.clientHeight) - top);
      el.style.setProperty("--ui-check-queue-room", `${Math.round(room)}px`);
    };
    measure();
    const ro = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
    ro?.observe(scrollerOf(el));
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  return (
    <div
      ref={(node) => {
        own.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      className={cx("ui-check-queue", className)}
      data-list={list ? "" : undefined}
      {...props}
    >
      {list}
      <div className="ui-check-queue-main">
        <div className="ui-check-queue-stage">{children}</div>
        {(step || foot) && (
          // The app's step footer (PageFooter, DLAY-13), pinned to the window's foot under the card. On a phone it takes
          // the tab bar's place (tab-bar.css: data-tab-bar="replace").
          <PageFooter className="ui-check-queue-foot" data-tab-bar="replace" start={step ? <div className="ui-check-queue-step">{step}</div> : undefined}>
            {foot}
          </PageFooter>
        )}
      </div>
      <p className="ui-check-live" aria-live="polite">
        {live}
      </p>
    </div>
  );
});

export interface CheckQueueListProps extends HTMLAttributes<HTMLElement> {
  /** The list's name: "Products to confirm". */
  label: string;
}

/** The items, on the left. ↑ and ↓ move between them (and open the one they land on). */
export function CheckQueueList({ label, className, children, onKeyDown, ...props }: CheckQueueListProps) {
  const keys = (e: KeyboardEvent<HTMLElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented || (e.key !== "ArrowDown" && e.key !== "ArrowUp")) return;
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>(".ui-check-queue-item"));
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    const next = items[at + (e.key === "ArrowDown" ? 1 : -1)];
    if (!next) return;
    e.preventDefault();
    next.focus();
    next.click();
  };
  return (
    <nav className={cx("ui-check-queue-list", className)} aria-label={label} onKeyDown={keys} {...props}>
      <ol className="ui-check-queue-items">{children}</ol>
    </nav>
  );
}

export interface CheckQueueItemProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title"> {
  /** The thumbnail: an <img>, a swatch, a specimen. */
  media?: ReactNode;
  title: ReactNode;
  /** Why it waits, or what she did: "Hand Balm introduction waits on it", "Confirmed", "Later". */
  detail?: ReactNode;
  /** The item on the card now. */
  current?: boolean;
  /** Decided: a tick at the end. */
  done?: boolean;
}

/** One item of the list: a whole-row button. */
export function CheckQueueItem({ media, title, detail, current, done, className, ...props }: CheckQueueItemProps) {
  return (
    <li>
      <button type="button" className={cx("ui-check-queue-item", className)} aria-current={current ? "step" : undefined} data-done={done || undefined} {...props}>
        <span className="ui-check-queue-media" aria-hidden="true">
          {media}
        </span>
        <span className="ui-check-queue-words">
          <span className="ui-check-queue-title">{title}</span>
          {detail && <span className="ui-check-queue-detail">{detail}</span>}
        </span>
        {done && <Icon name="circle-check" className="ui-check-queue-tick" aria-hidden="true" />}
      </button>
    </li>
  );
}
