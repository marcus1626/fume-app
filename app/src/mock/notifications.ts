// The bell.
import type { FumeApi } from "../contract";
import type { Mock } from "./context";

export function notificationCalls(m: Mock): Pick<FumeApi, "notifications" | "markRead"> {
  const { db, wait } = m;
  return {
    // A client's own people in a brand an agency runs hear only what they approve (the agency's sends) and their
    // deliveries; the brief, the plan and the Engine's runs are the agency's.
    async notifications() {
      const list = db.notifications.filter((n) => n.userId === m.userId).sort((a, b) => b.at.localeCompare(a.at));
      const client = m.agencyRun(m.workspaceId) && !db.users.find((u) => u.id === m.userId)?.agency;
      return wait(client ? list.filter((n) => n.kind === "checked" || n.kind === "delivered") : list);
    },
    async markRead(ids) {
      db.notifications
        .filter((n) => n.userId === m.userId && (ids === "all" || ids.includes(n.id)))
        .forEach((n) => (n.read = true));
      return wait(undefined);
    },
  };
}
