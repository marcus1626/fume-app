// Editing a book in place (FLOWS §34.3): the one rule the page and the server share (domain/bookEdits.ts).
import { describe, expect, it } from "vitest";
import type { BookEditMark, DesignBook, DesignComponent } from "../src/contract";
import { applyEdit, BookEditError, lineAt } from "../src/domain/bookEdits";
import { componentFor } from "../src/domain/designComponents";

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
    // The line that came back was never changed, so it has no mark.
    expect(marks.map((x) => x.path)).toEqual(["identity.believe.2"]);
  });

  it("undo of taking out a changed line brings back its mark, not a new one", () => {
    const b = body();
    const marks: BookEditMark[] = [];
    applyEdit(b, marks, { path: "identity.believe.1", to: "Two, changed" }, "anna", "t1");
    const undo = applyEdit(b, marks, { path: "identity.believe.1", to: null }, "maja", "t2");
    expect(marks).toEqual([]);
    applyEdit(b, marks, undo, "maja", "t3");
    expect(b.identity.believe).toEqual(["One", "Two, changed", "Three"]);
    expect(marks).toEqual([{ path: "identity.believe.1", by: "anna", at: "t1", from: "Two" }]);
  });

  it("refuses what is not a line", () => {
    const b = body();
    for (const path of ["identity", "identity.nope", "speak.traits.0", "identity.believe.9", "__proto__.x", "a..b"])
      expect(() => applyEdit(b, [], { path, to: "x" }, "anna", "t")).toThrow(BookEditError);
    expect(() => applyEdit(b, [], { path: "identity.who", to: null }, "anna", "t")).toThrow(BookEditError);
  });
});

// Round 15 (PROPOSED 9 Nov 2026): whole blocks of the Tone of Voice and the design system's components are put in,
// moved and taken out like lines, and a component's settings take only the brand's own tokens.
const voice = () => ({
  speak: {
    traits: [
      { trait: "Calm", means: "Never hurry.", do: "Breathe out.", dont: "Order now!" },
      { trait: "Plain", means: "Simple words.", do: "Almond oil.", dont: "An elixir." },
    ],
  },
});
const warm = { trait: "Warm", means: "", do: "", dont: "" };

describe("blocks of a book", () => {
  it("puts a block in at the end, marked as new, and undo takes it out", () => {
    const b = voice();
    const marks: BookEditMark[] = [];
    const undo = applyEdit(b, marks, { path: "speak.traits.2", to: null, item: warm }, "anna", "t1");
    expect(b.speak.traits.map((t) => t.trait)).toEqual(["Calm", "Plain", "Warm"]);
    expect(marks).toEqual([{ path: "speak.traits.2", by: "anna", at: "t1", from: null }]);
    applyEdit(b, marks, undo, "anna", "t2");
    expect(b.speak.traits.map((t) => t.trait)).toEqual(["Calm", "Plain"]);
    expect(marks).toEqual([]);
  });

  it("moves a block with the marks of its lines, and undo moves it back", () => {
    const b = voice();
    const marks: BookEditMark[] = [];
    applyEdit(b, marks, { path: "speak.traits.1.do", to: "Almond oil, nothing else." }, "anna", "t1");
    const undo = applyEdit(b, marks, { path: "speak.traits.1", to: null, moveTo: 0 }, "anna", "t2");
    expect(b.speak.traits.map((t) => t.trait)).toEqual(["Plain", "Calm"]);
    expect(marks.map((x) => x.path)).toEqual(["speak.traits.0.do"]);
    applyEdit(b, marks, undo, "anna", "t3");
    expect(b.speak.traits.map((t) => t.trait)).toEqual(["Calm", "Plain"]);
    expect(marks.map((x) => x.path)).toEqual(["speak.traits.1.do"]);
  });

  it("takes a block out, and undo puts it back in its place with its marks", () => {
    const b = voice();
    const marks: BookEditMark[] = [];
    applyEdit(b, marks, { path: "speak.traits.0.means", to: "We never hurry the reader." }, "anna", "t1");
    const undo = applyEdit(b, marks, { path: "speak.traits.0", to: null }, "anna", "t2");
    expect(b.speak.traits.map((t) => t.trait)).toEqual(["Plain"]);
    expect(marks).toEqual([]);
    applyEdit(b, marks, undo, "anna", "t3");
    expect(b.speak.traits[0]).toMatchObject({ trait: "Calm", means: "We never hurry the reader." });
    expect(marks).toEqual([{ path: "speak.traits.0.means", by: "anna", at: "t1", from: "Never hurry." }]);
  });

  it("puts in a block only whole, and never a block as a line", () => {
    const b = voice();
    const half = { trait: "Warm" } as unknown as typeof warm;
    expect(() => applyEdit(b, [], { path: "speak.traits.2", to: null, item: half }, "anna", "t1")).toThrow(
      BookEditError,
    );
    expect(() => applyEdit(b, [], { path: "speak.traits.0", to: "Calm" }, "anna", "t1")).toThrow(BookEditError);
    expect(() => applyEdit(b, [], { path: "speak.traits.5", to: null, item: warm }, "anna", "t1")).toThrow(
      "No such block.",
    );
  });
});

const design = () =>
  ({
    styles: [{ name: "headline" }, { name: "body" }, { name: "label" }],
    colours: [{ role: "text" }, { role: "primary" }, { role: "secondary" }, { role: "on_primary" }],
    spacing: { unitPx: 8, scale: [1, 2, 3] },
    components: [
      {
        name: "headline",
        purpose: "What the brand says.",
        style: "headline",
        colour: "text",
        background: null,
        radius: "none",
        paddingPx: 0,
        rules: [],
      },
    ],
  }) as unknown as DesignBook;
const wheel: DesignComponent = {
  name: "Wheel",
  purpose: "A round mark for an offer.",
  style: "label",
  colour: "on_primary",
  background: "secondary",
  radius: "pill",
  paddingPx: 16,
  sizePx: 200,
  rules: [],
  base: "badge",
};

describe("the design system's components", () => {
  it("adds a component of the brand's own, in its tokens, under a name of its own", () => {
    const b = design();
    applyEdit(b, [], { path: "components.1", to: null, item: wheel }, "anna", "t1");
    expect(b.components.map((c) => c.name)).toEqual(["headline", "Wheel"]);
    expect(() =>
      applyEdit(b, [], { path: "components.2", to: null, item: { ...wheel, name: "Headline" } }, "anna", "t2"),
    ).toThrow("There is a component called Headline already.");
    expect(() =>
      applyEdit(
        b,
        [],
        { path: "components.2", to: null, item: { ...wheel, name: "Ring", colour: "gold" as never } },
        "anna",
        "t2",
      ),
    ).toThrow("Use one of the brand's colours.");
    expect(() =>
      applyEdit(
        b,
        [],
        { path: "components.2", to: null, item: { ...wheel, name: "Ring", role: "headline" } },
        "anna",
        "t2",
      ),
    ).toThrow("Headline holds that role already.");
  });

  it("sets a setting to one of the brand's tokens, and undo sets it back", () => {
    const b = design();
    const marks: BookEditMark[] = [];
    applyEdit(b, marks, { path: "components.1", to: null, item: wheel }, "anna", "t1");
    const undo = applyEdit(b, marks, { path: "components.1.background", to: null }, "anna", "t2");
    expect(b.components[1]!.background).toBeNull();
    expect(marks.find((x) => x.path === "components.1.background")).toMatchObject({ from: "secondary" });
    applyEdit(b, marks, undo, "anna", "t3");
    expect(b.components[1]!.background).toBe("secondary");
    expect(marks.find((x) => x.path === "components.1.background")).toBeUndefined();
    applyEdit(b, marks, { path: "components.1.paddingPx", to: "24" }, "anna", "t4");
    expect(b.components[1]!.paddingPx).toBe(24);
    expect(() => applyEdit(b, marks, { path: "components.1.paddingPx", to: "13" }, "anna", "t5")).toThrow(
      "Use one of the brand's spacing steps.",
    );
    expect(() => applyEdit(b, marks, { path: "components.1.style", to: "shout" }, "anna", "t5")).toThrow(BookEditError);
    expect(() => applyEdit(b, marks, { path: "components.1.colour", to: null }, "anna", "t5")).toThrow(BookEditError);
  });

  it("keeps a component's role when the brand renames it", () => {
    const b = design();
    applyEdit(b, [], { path: "components.0.name", to: "Big words" }, "anna", "t1");
    expect(componentFor(b, "headline")?.name).toBe("Big words");
  });
});
