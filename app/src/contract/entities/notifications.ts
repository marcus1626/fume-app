// Notifications: what the bell shows a person (ARCHITECTURE §4.8).

import type { Id, Instant } from "./common";
import type { MessageAuthor } from "./conversation";

export type NotificationKind =
  "checked" | "engine_done" | "changes_asked" | "mention" | "waiting_on_you" | "delivered" | "held";

export interface Notification {
  id: Id;
  userId: Id;
  kind: NotificationKind;
  actor: MessageAuthor;
  text: string;
  href: string;
  read: boolean;
  at: Instant;
}
