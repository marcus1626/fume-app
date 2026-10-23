// The bell on a desk (round 9, desktop review DWAY-11, DLOAD-4; PROPOSED 19 Oct 2026): the whole list of notifications
// in the bell's popover, with its own All · Unread tabs, scrolling inside a popover up to 70 % of the screen's height.
// There is no second inbox to open: "Open the inbox" is gone; All notifications (/notifications) stays for the phone
// and for links. The bell counts only what Home does not already ask (shell/notifications.ts), so the sidebar's Home
// number stays the one to-do count. Opening a row marks it read and goes where it points ("The plan for Winter gifting
// is ready" opens the plan, round 10).
import {
  Button,
  NotificationBell,
  NotificationEmpty,
  NotificationList,
  Popover,
  PopoverContent,
  PopoverTrigger,
  WithTooltip,
  type NotificationData,
  type NotificationFilter,
} from "@fume/ui";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMarkRead } from "../../api/hooks";

const TABS: { value: Extract<NotificationFilter, "all" | "unread">; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
];

export function NotificationsPopover({ items, unread }: { items: NotificationData[]; unread: number }) {
  const markRead = useMarkRead();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const id = useId();
  const tabs = useRef<HTMLDivElement>(null);
  const shown = items.filter((n) => filter === "all" || n.unread);
  const anyUnread = items.some((n) => n.unread);

  // ← → between the two tabs, as a tab list does
  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const i = TABS.findIndex((t) => t.value === filter);
    const j =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? TABS.length - 1
          : (i + (e.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
    setFilter(TABS[j]!.value);
    tabs.current?.querySelectorAll<HTMLElement>("[role=tab]")[j]?.focus();
  };

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setFilter("all");
      }}
    >
      <WithTooltip label="Notifications" side="bottom">
        <PopoverTrigger asChild>
          <NotificationBell unread={unread} />
        </PopoverTrigger>
      </WithTooltip>
      <PopoverContent className="ui-notify-pop ui-popover--list" align="end" aria-labelledby={`${id}-title`}>
        <div className="ui-popover-head">
          <h2 className="ui-popover-title" id={`${id}-title`}>
            Notifications
          </h2>
          {items.length > 0 && (
            <Button variant="glass-clear" size="sm" disabled={!anyUnread} onClick={() => markRead.mutate("all")}>
              Mark all read
            </Button>
          )}
        </div>
        {items.length > 0 && (
          <div ref={tabs} className="ui-popover-tabs" role="tablist" aria-label="Show" onKeyDown={onTabKey}>
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                role="tab"
                id={`${id}-tab-${t.value}`}
                aria-controls={`${id}-panel`}
                aria-selected={filter === t.value}
                tabIndex={filter === t.value ? 0 : -1}
                className="ui-popover-tab"
                onClick={() => setFilter(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
        <div
          className="ui-popover-scroll"
          id={`${id}-panel`}
          role={items.length ? "tabpanel" : undefined}
          aria-labelledby={items.length ? `${id}-tab-${filter}` : undefined}
        >
          {shown.length > 0 ? (
            <NotificationList
              items={items}
              filter={filter}
              onSelect={(item, event) => {
                event.preventDefault();
                // read in the store too, also when it only shows as read because Home asks it
                markRead.mutate([item.id]);
                setOpen(false);
                if (item.href) navigate(item.href);
              }}
            />
          ) : (
            <NotificationEmpty
              title={filter === "unread" ? "Everything is read" : "You are all caught up"}
              text={
                filter === "unread"
                  ? "What waits on you is on Home."
                  : "Plans ready for you, checked creatives, questions from Fume and mentions show here as they happen."
              }
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
