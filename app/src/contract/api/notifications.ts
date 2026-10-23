// Notifications calls: the bell. New notifications arrive as events (events.ts).

import type { Id } from "../entities/common";
import type { Notification } from "../entities/notifications";

export interface NotificationsApi {
  notifications(): Promise<Notification[]>;
  markRead(notificationIds: Id[] | "all"): Promise<void>;
}
