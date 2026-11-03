import { describe, expect, it } from "vitest";
import { toMessage } from "../src/api/live/conversation";

const row = {
  id: "m1",
  thread_id: "t1",
  author_kind: "person" as const,
  author_id: "u1",
  text: "Where is Night ritual?",
  card: null,
  attachments: [],
  answers: null,
  at: "2026-11-03T12:00:00Z",
};

describe("the live Fume chat", () => {
  it("keeps her words as hers, without empty extras", () => {
    expect(toMessage(row)).toEqual({
      id: "m1",
      threadId: "t1",
      author: { kind: "person", userId: "u1" },
      text: "Where is Night ritual?",
      at: "2026-11-03T12:00:00Z",
    });
  });
  it("gives Fume's answer its card, and a handover names the person", () => {
    const m = toMessage({
      ...row,
      author_kind: "fume",
      author_id: null,
      text: "That is one for a person. William at Fume will answer you here.",
      card: { kind: "handover", userId: "u9", reason: "Packages are handled by people at Fume." },
    });
    expect(m.author).toEqual({ kind: "fume" });
    expect(m.card).toEqual({ kind: "handover", userId: "u9", reason: "Packages are handled by people at Fume." });
  });
  it("keeps her files", () => {
    const m = toMessage({
      ...row,
      text: "",
      attachments: [{ id: "a1", name: "brief.pdf", bytes: 1200, kind: "document" }],
    });
    expect(m.attachments).toHaveLength(1);
  });
});
