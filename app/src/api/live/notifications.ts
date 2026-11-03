// The bell on the live backend. The database writes each person's notifications as the record grows
// (20261103100000_notifications.sql); this reads the caller's own and marks them read. A notification with no actor is
// Fume's own.
import type { FumeApi, Notification } from "../../contract";
import { command, rows, supabase } from "./supabase";

type Calls = "notifications" | "markRead";

interface NotificationRow {
  id: string;
  user_id: string;
  kind: Notification["kind"];
  actor: string | null;
  text: string;
  href: string;
  read_at: string | null;
  at: string;
}

export function toNotification(r: NotificationRow): Notification {
  return {
    id: r.id,
    userId: r.user_id,
    kind: r.kind,
    actor: r.actor ? { kind: "person", userId: r.actor } : { kind: "fume" },
    text: r.text,
    href: r.href,
    read: r.read_at !== null,
    at: r.at,
  };
}

export function notificationCalls(): Pick<FumeApi, Calls> {
  return {
    async notifications() {
      const list = await rows<NotificationRow>(
        supabase()
          .from("notifications")
          .select("id, user_id, kind, actor, text, href, read_at, at")
          .order("at", { ascending: false })
          .limit(100),
      );
      return list.map(toNotification);
    },
    async markRead(ids) {
      await command("mark_notifications_read", { p_ids: ids === "all" ? null : ids });
    },
  };
}
