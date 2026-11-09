// Editing a book in place (FLOWS §34.3): the one rule the page and the server share (domain/bookEdits.ts).
import { describe, expect, it } from "vitest";
import type { BookEditMark } from "../src/contract";
import { applyEdit, BookEditError, lineAt } from "../src/domain/bookEdits";

const body = () => ({
  identity: { who: "LYSNE makes body oils.", believe: ["One", "Two", "Three"] },
  speak: { traits: [{ trait: "Calm", do: "Warm the oil." }] },
});

describe("editing a book in place", () => {
  it("changes a line and marks what it said before", () => {
    const b = body();
    const marks: BookEditMark[] = [];
    const undo = applyEdit(b, marks, { path: "speak.traits.0.do", to: "Breathe out." }, "anna", "t1");
    expect(b.speak.traits[0]!.do).toBe("Breathe out.");
    expect(marks).toEqual([{ path: "speak.traits.0.do", by: "anna", at: "t1", from: "Warm the oil." }]);
    // Undo puts the words back, and the line is no longer an edit.
    applyEdit(b, marks, undo, "anna", "t2");
    expect(b.speak.traits[0]!.do).toBe("Warm the oil.");
    expect(marks).toEqual([]);
  });

  it("adds a line at a list's end, and undo takes it out", () => {
    const b = body();
    const marks: BookEditMark[] = [];
    const undo = applyEdit(b, marks, { path: "identity.believe.3", to: "Four" }, "maja", "t1");
    expect(b.identity.believe).toEqual(["One", "Two", "Three", "Four"]);
    expect(marks[0]).toMatchObject({ path: "identity.believe.3", from: null });
    applyEdit(b, marks, undo, "maja", "t2");
    expect(b.identity.believe).toEqual(["One", "Two", "Three"]);
    expect(marks).toEqual([]);
  });

  it("takes a line out, moves the marks after it, and undo puts it back in its place", () => {
    const b = body();
    const marks: BookEditMark[] = [];
    applyEdit(b, marks, { path: "identity.believe.2", to: "Three, changed" }, "anna", "t1");
    const undo = applyEdit(b, marks, { path: "identity.believe.0", to: null }, "anna", "t2");
    expect(b.identity.believe).toEqual(["Two", "Three, changed"]);
    expect(marks.map((x) => x.path)).toEqual(["identity.believe.1"]);
    applyEdit(b, marks, undo, "anna", "t3");
    expect(b.identity.believe).toEqual(["One", "Two", "Three, changed"]);
    expect(lineAt(b, "identity.believe.2")).toBe("Three, changed");
    expect(marks.find((x) => x.path === "identity.believe.2")).toMatchObject({ from: "Three" });
  });

  it("refuses what is not a line", () => {
    const b = body();
    for (const path of ["identity", "identity.nope", "speak.traits.0", "identity.believe.9", "__proto__.x", "a..b"])
      expect(() => applyEdit(b, [], { path, to: "x" }, "anna", "t")).toThrow(BookEditError);
    expect(() => applyEdit(b, [], { path: "identity.who", to: null }, "anna", "t")).toThrow(BookEditError);
  });
});
