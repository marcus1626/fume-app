// All notifications (ARCHITECTURE §7.1): everything the bell holds, in full, with All · Unread · Mentions. Opening a
// row marks it read and goes where it points (a review, a campaign, a conversation with Fume) through the router. One
// header ("Notifications · 3 unread · Mark all read"), then the filter and the list, so the first notification is on
// the first screen. On a desk the bell's popover is the whole list, so this page is for the phone and for links. It is
// not a second inbox: it has its way back (Home), Home is not lit while you are on it, and it counts unread as the bell
// does (what Home already asks shows as read).
import {
  Button,
  NotificationList,
  PageHeader,
  SegmentedControl,
  SegmentedOption,
  type NotificationFilter,
} from "@fume/ui";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMarkRead } from "../../api/hooks";
import { useNotificationItems } from "../../shell/notifications";
import { Back, Nothing, Page, Query } from "../../shell/Page";

const FILTERS: { value: NotificationFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "mentions", label: "Mentions" },
];

export function NotificationsPage() {
  const { query, items, unread } = useNotificationItems();
  const markRead = useMarkRead();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const anyUnread = (query.data ?? []).some((n) => !n.read);

  return (
    <Page title="All notifications" width="reading">
      <PageHeader
        back={<Back to="/" label="Home" />}
        title="All notifications"
        meta={query.data ? [unread ? `${unread} unread` : "All read"] : undefined}
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon="check"
            disabled={!anyUnread}
            onClick={() => markRead.mutate("all")}
          >
            Mark all read
          </Button>
        }
      />
      <Query query={query}>
        {() => {
          const shown = items.filter((n) =>
            filter === "unread" ? n.unread : filter === "mentions" ? n.kind === "mention" : true,
          );
          return (
            <div className="ui-app-stack">
              <SegmentedControl
                aria-label="Show"
                value={filter}
                onValueChange={(v) => setFilter(v as NotificationFilter)}
              >
                {FILTERS.map((f) => (
                  <SegmentedOption key={f.value} value={f.value}>
                    {f.label}
                  </SegmentedOption>
                ))}
              </SegmentedControl>
              {shown.length > 0 ? (
                <NotificationList
                  items={items}
                  filter={filter}
                  full
                  onSelect={(item, event) => {
                    event.preventDefault();
                    markRead.mutate([item.id]);
                    if (item.href) navigate(item.href);
                  }}
                />
              ) : (
                <Nothing
                  icon="inbox"
                  title={
                    filter === "all"
                      ? "Nothing new since you last looked"
                      : filter === "unread"
                        ? "Everything is read"
                        : "No one has mentioned you"
                  }
                  text={
                    filter === "all"
                      ? "Checked creatives, questions from Fume and mentions show here as they happen."
                      : filter === "unread"
                        ? "What waits on you is on Home."
                        : undefined
                  }
                  action={
                    filter !== "all" ? (
                      <Button variant="secondary" onClick={() => setFilter("all")}>
                        Show all notifications
                      </Button>
                    ) : undefined
                  }
                />
              )}
            </div>
          );
        }}
      </Query>
    </Page>
  );
}
