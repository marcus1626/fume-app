// Notifications: the bell, its popover and the inbox page (design-system/components/notify.css, behaviour from
// notify.js). What happened, in Fume's words: "Anna checked 6 creatives in Autumn launch", "The Engine finished 12
// creatives", "Anna asked for changes on creative 3", "Sander mentioned you".
// People are their avatars (Anna in Ink), the Engine its own icon. Unread is the words at full strength and a
// small dot after the time, never a blue dot. Grouped Today, Yesterday, Earlier with space.
// The read state belongs to the app: rows call onRead, Mark all read calls onReadAll. Arrow Up and Down move
// between rows, Home and End jump. The popover list stops on half a row so it says it scrolls.
import * as Popover from "@radix-ui/react-popover";
import {
  forwardRef,
  type ButtonHTMLAttributes,
  useCallback,
  useEffect,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { cx } from "../cx";
import { Icon } from "../icons";
import { Avatar, Btn, Seg, tokenPx, vars, type PersonSign } from "./_parts";

export interface NotificationData {
  id: string;
  /** Contract NotificationKind ("checked", "engine_done", "changes_asked", "mention", …): data-kind; "mention" feeds the Mentions filter. */
  kind: string;
  unread: boolean;
  /** "Today", "Yesterday", "Earlier": rows with the same group sit together, in the order given. */
  group: string;
  /** "14:32" (data). */
  time: string;
  /** dateTime of the time element. */
  dateTime?: string;
  /** What happened, names in <b>: <><b>Anna</b> checked 6 creatives in <b>Autumn launch</b></>. */
  text: ReactNode;
  /** The words quoted under it (a note, a mention). Shown in the inbox, not in the popover. */
  quote?: ReactNode;
  /** Creatives under it, 4:5 (shown in the inbox). */
  thumbs?: { src: string; alt?: string }[];
  /** "+8": the creatives not shown. */
  more?: number;
  /** A person (Anna with ink: true) or the Engine. */
  actor: { kind: "person"; person: PersonSign } | { kind: "engine" } | { kind: "fume" };
  href?: string;
}

export type NotificationFilter = "all" | "unread" | "mentions";

function matches(n: NotificationData, f: NotificationFilter) {
  return f === "all" || (f === "unread" ? n.unread : n.kind === "mention");
}

/** Sections in the order the groups first appear. */
function grouped(items: NotificationData[]) {
  const out: { name: string; rows: NotificationData[] }[] = [];
  for (const n of items) {
    const g = out.find((x) => x.name === n.group);
    if (g) g.rows.push(n);
    else out.push({ name: n.group, rows: [n] });
  }
  return out;
}

export interface NotificationItemProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "onSelect"> {
  item: NotificationData;
  /** The quote and the creatives under the words (the inbox shows them, the popover does not). */
  full?: boolean;
}

/** a.ui-notify-item[data-state=read|unread][data-kind]: media, words (with "Unread. " for screen readers), quote, creatives, time and dot. */
export const NotificationItem = forwardRef<HTMLAnchorElement, NotificationItemProps>(function NotificationItem(
  { item, full, className, href, ...props },
  ref,
) {
  const a = item.actor;
  return (
    <a
      ref={ref}
      className={cx("ui-notify-item", className)}
      href={href ?? item.href ?? "#"}
      data-state={item.unread ? "unread" : "read"}
      data-kind={item.kind}
      {...props}
    >
      {a.kind === "person" ? (
        <Avatar person={a.person} className="ui-notify-media" />
      ) : (
        <span className="ui-notify-media" aria-hidden="true">
          <Icon name="fume-engine" />
        </span>
      )}
      <span className="ui-notify-text">
        <span className="ui-notify-sr">{item.unread ? "Unread. " : ""}</span>
        {item.text}
      </span>
      {full && item.quote && <span className="ui-notify-quote">{item.quote}</span>}
      {full && item.thumbs && item.thumbs.length > 0 && (
        <span className="ui-notify-thumbs">
          {item.thumbs.map((t, i) => (
            <span key={i} className="ui-notify-thumb">
              <img src={t.src} alt={t.alt ?? ""} />
            </span>
          ))}
          {item.more ? <span className="ui-notify-more">+{item.more}</span> : null}
        </span>
      )}
      <span className="ui-notify-meta">
        <time className="ui-notify-time" dateTime={item.dateTime}>
          {item.time}
        </time>
        <span className="ui-notify-dot" aria-hidden="true" />
      </span>
    </a>
  );
});

export interface NotificationListProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> {
  items: NotificationData[];
  /** Which rows show. Sections with none left go. */
  filter?: NotificationFilter;
  /** A press on a row: mark it read (the app sets unread: false) … */
  onRead?: (id: string) => void;
  /** … and go where it points (prevent the link's default to route in the app). */
  onSelect?: (item: NotificationData, event: MouseEvent<HTMLAnchorElement>) => void;
  /** Quotes and creatives under the rows (the inbox). */
  full?: boolean;
  /** Glass colours outside a .ui-glass parent. */
  glass?: boolean;
}

/** div.ui-notify > section.ui-notify-section > h5.ui-notify-group + ul.ui-notify-rows. Hidden when no row matches. */
export const NotificationList = forwardRef<HTMLDivElement, NotificationListProps>(function NotificationList(
  { items, filter = "all", onRead, onSelect, full, glass, className, onKeyDown, ...props },
  ref,
) {
  const shown = items.filter((n) => matches(n, filter));
  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const row = (e.target as HTMLElement).closest<HTMLElement>(".ui-notify-item");
    if (!row) return;
    const rows = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(".ui-notify-item"));
    const i = rows.indexOf(row);
    const j =
      e.key === "ArrowDown"
        ? Math.min(rows.length - 1, i + 1)
        : e.key === "ArrowUp"
          ? Math.max(0, i - 1)
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? rows.length - 1
              : -1;
    if (j < 0) return;
    e.preventDefault();
    rows[j]?.focus();
    rows[j]?.scrollIntoView({ block: "nearest" });
  };
  return (
    <div
      ref={ref}
      className={cx("ui-notify", glass && "ui-notify--glass", className)}
      data-filter={filter}
      hidden={!shown.length}
      {...props}
      onKeyDown={keys}
    >
      {grouped(shown).map((g) => (
        <section key={g.name} className="ui-notify-section" aria-label={g.name}>
          <h5 className="ui-notify-group">{g.name}</h5>
          <ul className="ui-notify-rows">
            {g.rows.map((n) => (
              <li key={n.id}>
                <NotificationItem
                  item={n}
                  full={full}
                  onClick={(e) => {
                    if ((n.href ?? "#") === "#") e.preventDefault();
                    if (n.unread) onRead?.(n.id);
                    onSelect?.(n, e);
                  }}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
});

export interface NotificationBellProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  unread: number;
  /** On the span.ui-notify-bell wrapper. */
  className?: string;
}

/** span.ui-notify-bell > button (quiet, "Notifications, 3 unread") + span.ui-notify-count (9+ past nine).
 *  The ref and every other prop go to the button, so it can be a Radix trigger (asChild). */
export const NotificationBell = forwardRef<HTMLButtonElement, NotificationBellProps>(function NotificationBell(
  { unread, className, ...props },
  ref,
) {
  return (
    <span className={cx("ui-notify-bell", className)}>
      <Btn
        ref={ref}
        variant="quiet"
        iconOnly
        icon="bell"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        {...props}
      />
      <span className="ui-notify-count" aria-hidden="true" hidden={!unread}>
        {unread ? (unread > 9 ? "9+" : String(unread)) : ""}
      </span>
    </span>
  );
});

/** div.ui-notify-empty: "You are all caught up" (the popover's empty state). */
export function NotificationEmpty({
  title = "You are all caught up",
  text = "Approvals, Engine runs and mentions show here as they happen.",
}: {
  title?: string;
  text?: string;
}) {
  return (
    <div className="ui-notify-empty">
      <span className="ui-notify-empty-icon" aria-hidden="true">
        <Icon name="inbox" />
      </span>
      <p className="ui-notify-empty-title">{title}</p>
      <p className="ui-notify-empty-text">{text}</p>
    </div>
  );
}

/** The popover list stops on the middle of a row, never on a label or a sliver: sets --ui-notify-rows-visible. */
function useHalfRow(open: boolean) {
  const scroll = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState<number | null>(null);
  const fit = useCallback(() => {
    const s = scroll.current;
    if (!s || !s.getClientRects().length) return;
    const rowH = tokenPx("--ui-notify-row", 68),
      label = tokenPx("--ui-notify-label", 32);
    const n =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ui-notify-rows-visible")) || 3.5;
    const target = label + rowH * n,
      top = s.getBoundingClientRect().top - s.scrollTop;
    const items = Array.from(s.querySelectorAll<HTMLElement>(".ui-notify-item")).filter(
      (x) => x.getClientRects().length,
    );
    const last = items[items.length - 1];
    if (!last || last.getBoundingClientRect().bottom - top <= target) return setRows(null);
    for (const it of items) {
      const r = it.getBoundingClientRect();
      if (r.bottom - top > target) return setRows((r.top - top + r.height / 2 - label) / rowH);
    }
  }, []);
  useEffect(() => {
    if (!open) return;
    const a = requestAnimationFrame(fit);
    window.addEventListener("resize", fit);
    return () => {
      cancelAnimationFrame(a);
      window.removeEventListener("resize", fit);
    };
  }, [open, fit]);
  return { scroll, style: rows === null ? undefined : vars({ "--ui-notify-rows-visible": rows.toFixed(3) }), fit };
}

export interface NotificationPopoverProps {
  items: NotificationData[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onRead?: (id: string) => void;
  onReadAll?: () => void;
  onSelect?: NotificationListProps["onSelect"];
  /** "Open the inbox" at the foot. */
  onOpenInbox?: () => void;
  title?: string;
  readAllLabel?: string;
  inboxLabel?: string;
  emptyTitle?: string;
  emptyText?: string;
  /** Where the popover sits against the bell. */
  align?: "start" | "center" | "end";
  className?: string;
}

/** The bell and its Smoke glass popover (Radix Popover): head, Mark all read, the half-row list or the empty state, Open the inbox. */
export function NotificationPopover({
  items,
  open: openProp,
  onOpenChange,
  onRead,
  onReadAll,
  onSelect,
  onOpenInbox,
  title = "Notifications",
  readAllLabel = "Mark all read",
  inboxLabel = "Open the inbox",
  emptyTitle,
  emptyText,
  align = "end",
  className,
}: NotificationPopoverProps) {
  const [own, setOwn] = useState(false);
  const open = openProp ?? own;
  const setOpen = (v: boolean) => {
    if (openProp === undefined) setOwn(v);
    onOpenChange?.(v);
  };
  const unread = items.filter((n) => n.unread).length;
  const half = useHalfRow(open);
  useEffect(() => {
    if (open) requestAnimationFrame(half.fit);
  }, [items, open, half.fit]);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <NotificationBell unread={unread} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={cx("ui-glass ui-popover ui-notify-pop", className)}
          side="bottom"
          align={align}
          sideOffset={tokenPx("--ui-overlay-offset", 8)}
          collisionPadding={tokenPx("--ui-overlay-margin", 16)}
          aria-label={unread ? title : `${title}, all read`}
        >
          <div className="ui-notify-head">
            <h4 className="ui-notify-title">{title}</h4>
            {items.length > 0 && (
              <Btn variant="glass-clear" size="sm" disabled={!unread} onClick={onReadAll}>
                {readAllLabel}
              </Btn>
            )}
          </div>
          {items.length ? (
            <div ref={half.scroll} className="ui-notify-scroll" style={half.style}>
              <NotificationList items={items} onRead={onRead} onSelect={onSelect} />
            </div>
          ) : (
            <NotificationEmpty title={emptyTitle} text={emptyText} />
          )}
          {onOpenInbox && items.length > 0 && (
            <div className="ui-notify-foot">
              <Popover.Close asChild>
                <Btn variant="glass-clear" iconEnd="arrow-right" onClick={onOpenInbox}>
                  {inboxLabel}
                </Btn>
              </Popover.Close>
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export interface InboxProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect" | "title"> {
  items: NotificationData[];
  onRead?: (id: string) => void;
  onReadAll?: () => void;
  onSelect?: NotificationListProps["onSelect"];
  /** "Notifications". */
  title?: string;
  /** "Kristian’s inbox"; followed by " · 3 unread" or " · All read". */
  owner?: string;
  /** Controlled filter; without it the inbox keeps its own. */
  filter?: NotificationFilter;
  onFilterChange?: (f: NotificationFilter) => void;
  readAllLabel?: string;
  emptyTitle?: string;
  emptyText?: string;
  showAllLabel?: string;
}

/** div.ui-inbox: head (title, unread, Mark all read), the All · Unread · Mentions filter, the list, and ui-empty when nothing matches. */
export const Inbox = forwardRef<HTMLDivElement, InboxProps>(function Inbox(
  {
    items,
    onRead,
    onReadAll,
    onSelect,
    title = "Notifications",
    owner,
    filter: filterProp,
    onFilterChange,
    readAllLabel = "Mark all read",
    emptyTitle = "You are all caught up",
    emptyText = "Nothing new since you last looked. Anna’s checks, Engine runs and mentions show here as they happen.",
    showAllLabel = "Show all notifications",
    className,
    ...props
  },
  ref,
) {
  const [own, setOwn] = useState<NotificationFilter>("all");
  const filter = filterProp ?? own;
  const setFilter = (f: NotificationFilter) => {
    if (filterProp === undefined) setOwn(f);
    onFilterChange?.(f);
  };
  const unread = items.filter((n) => n.unread).length;
  const left = items.filter((n) => matches(n, filter)).length;
  return (
    <div ref={ref} className={cx("ui-inbox", className)} {...props}>
      <div className="ui-inbox-head">
        <div className="ui-inbox-title">
          <h3>{title}</h3>
          <p>
            {owner ? `${owner} · ` : ""}
            <span>{unread ? `${unread} unread` : "All read"}</span>
          </p>
        </div>
        <Btn variant="secondary" size="sm" icon="check" disabled={!unread} onClick={onReadAll}>
          {readAllLabel}
        </Btn>
      </div>
      <div className="ui-inbox-tools">
        <Seg<NotificationFilter>
          label="Show"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", data: { filter: "all" } },
            { value: "unread", label: "Unread", data: { filter: "unread" } },
            { value: "mentions", label: "Mentions", data: { filter: "mentions" } },
          ]}
        />
      </div>
      <NotificationList items={items} filter={filter} onRead={onRead} onSelect={onSelect} full />
      {!left && (
        <div className="ui-empty ui-empty--surface">
          <div className="ui-empty-header">
            <div className="ui-empty-media ui-empty-media--icon" aria-hidden="true">
              <Icon name="inbox" />
            </div>
            <h4 className="ui-empty-title">{emptyTitle}</h4>
            <p className="ui-empty-description">{emptyText}</p>
          </div>
          {filter !== "all" && (
            <div className="ui-empty-content">
              <Btn variant="secondary" onClick={() => setFilter("all")}>
                {showAllLabel}
              </Btn>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
