import { describe, expect, it } from "vitest";
import { toNotification } from "../src/api/live/notifications";

const row = {
  id: "n1",
  user_id: "u1",
  kind: "approved" as const,
  actor: "u2",
  text: "Maja approved 3 creatives in Night ritual",
  href: "/studio/b/w1/campaigns/c1/plan",
  read_at: null,
  at: "2026-11-03T12:00:00Z",
};

describe("the live bell", () => {
  it("names the person who did it, and is unread until marked", () => {
    expect(toNotification(row)).toEqual({
      id: "n1",
      userId: "u1",
      kind: "approved",
      actor: { kind: "person", userId: "u2" },
      text: "Maja approved 3 creatives in Night ritual",
      href: "/studio/b/w1/campaigns/c1/plan",
      read: false,
      at: "2026-11-03T12:00:00Z",
    });
  });
  it("is Fume's own without an actor, and read once marked", () => {
    const n = toNotification({ ...row, actor: null, read_at: "2026-11-03T12:05:00Z" });
    expect(n.actor).toEqual({ kind: "fume" });
    expect(n.read).toBe(true);
  });
});
