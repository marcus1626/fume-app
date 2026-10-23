// The contract's notifications in the shape the notification components draw.
// Round 9 (desktop review DWAY-11, DLOAD-4; PROPOSED 19 Oct 2026): Home is the one to-do list and its count the only
// to-do count. A notification whose ask is already a row on Home ("Anna checked 6 creatives": the creatives row; "Fume
// needs the Hand Balm claims": the question row; "Masters are ready": the download row) is news she has already been
// given, so the bell and All notifications show it as read and do not count it. The bell then counts only what Home
// does not say (seed: 1, "Anna is fixing one creative").
// Round 10 (FLOWS §22.3, PROPOSED 20 Oct 2026): "The plan for Winter gifting is ready" opens the plan and is read while
// Home has the plan's row. A notification that names a campaign (/campaigns/c-winter/plan) is matched to that
// campaign's row, not to any row of the same kind; once its ask is answered (the plan approved, nothing waits on her in
// that campaign) it stays read, so approving the plan never lights the bell.
import type { NotificationData } from "@fume/ui";
import { useMemo } from "react";
import { useCampaigns, useNotifications, usePeople } from "../api/hooks";
import type { Campaign, Notification, NotificationKind, User } from "../contract";
import * as copy from "../copy";
import { dayGroup, when } from "../lib/time";
import { sign } from "./people";
import { useWaitingOnYou, type WaitingKind } from "./waiting";

export function toNotificationData(list: Notification[] | undefined, people: User[] | undefined): NotificationData[] {
  const byId = new Map((people ?? []).map((u) => [u.id, u]));
  return (list ?? [])
    .slice()
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((n) => ({
      id: n.id,
      kind: n.kind,
      unread: !n.read,
      group: dayGroup(n.at),
      time: when(n.at),
      dateTime: n.at,
      text: n.text,
      href: n.href,
      actor: n.actor.kind === "person" ? { kind: "person", person: sign(byId.get(n.actor.userId)) } : { kind: n.actor.kind },
    }));
}

/** The Home rows that already ask what a notification of this kind asks. */
const askedOnHome: Partial<Record<NotificationKind, WaitingKind[]>> = {
  checked: ["creatives", "directions"],
  waiting_on_you: ["question", "brief", "plan", "products", "brand"],
  delivered: ["download"],
};

/** The campaign a notification's link names ("/campaigns/c-winter/plan" → "c-winter"), if it names one. */
const campaignIn = (href: string | undefined) => /^\/campaigns\/([^/?#]+)/.exec(href ?? "")?.[1];

/** What Home asks, as the keys isOnHome reads: each row's kinds ("plan"), and each with its campaign ("plan@c-winter"). */
export function homeKeys(rows: { kind: WaitingKind; also?: WaitingKind[]; campaignId?: string }[]): string[] {
  return rows.flatMap((r) => [r.kind, ...(r.also ?? [])].flatMap((k) => (r.campaignId ? [k, `${k}@${r.campaignId}`] : [k])));
}

/**
 * True when Home already has a row for what this notification asks, or its ask is answered. A notification about one
 * campaign needs that campaign's row (or the campaign no longer waits on her); one about no campaign, any row of its
 * kind.
 */
export function isOnHome(kind: string, home: ReadonlySet<string>, href?: string, campaigns?: Campaign[]): boolean {
  const kinds = askedOnHome[kind as NotificationKind] ?? [];
  if (!kinds.length) return false;
  const id = campaignIn(href);
  if (!id) return kinds.some((k) => home.has(k));
  if (kinds.some((k) => home.has(`${k}@${id}`))) return true;
  const campaign = campaigns?.find((c) => c.id === id);
  return Boolean(campaign && !copy.campaignStatus(campaign).waiting);
}

/**
 * The notifications as the bell and All notifications show them: newest first, with what Home already asks shown as
 * read. `unread` is the bell's number (0 until Home's rows have loaded, so it never shows a count that then drops).
 */
export function useNotificationItems() {
  const notifications = useNotifications();
  const people = usePeople();
  const waiting = useWaitingOnYou();
  const campaigns = useCampaigns();
  const homeKey = homeKeys(waiting.items).join(",");
  const items = useMemo(() => {
    const home = new Set(homeKey ? homeKey.split(",") : []);
    return toNotificationData(notifications.data, people.data).map((n) => (n.unread && isOnHome(n.kind, home, n.href, campaigns.data) ? { ...n, unread: false } : n));
  }, [notifications.data, people.data, homeKey, campaigns.data]);
  const unread = waiting.loading ? 0 : items.filter((n) => n.unread).length;
  return { query: notifications, items, unread };
}
