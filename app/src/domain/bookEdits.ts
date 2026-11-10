// Editing a book's words in place (FLOWS §34.3, PROPOSED). One rule for the page and the server: an edit names the
// path of a line in the body ("speak.traits.1.do", "identity.believe.2") and its new words. In a list, `to: null` takes
// the item out, an index one past the end adds one, and `insert` puts one in before the item at that index. Every line
// changed keeps a mark: who changed it, and what it said before (null for a line someone added).
// Round 15 (PROPOSED 9 Nov 2026): a book's blocks are open. The Tone of Voice's blocks (speak.traits) and the design
// system's components (components) are lists of blocks, not lines: a block is put in whole (`item`), moved (`moveTo`)
// or taken out whole, with its lines' marks; the undo of each is an edit too. A component's settings are set in the
// brand's own tokens (designComponents.ts).
import type { BookEdit, BookEditMark, DesignBook, DesignComponent, Id, VoiceTrait } from "../contract";
import { blockProblem, componentProblem, componentRole, paddingSteps } from "./designComponents";

export class BookEditError extends Error {}

/** The lists whose items are blocks, not lines. */
export const blockLists = ["speak.traits", "components"] as const;

/** A component's settings that are not free words: each is checked against the brand's tokens. */
const settings = ["name", "style", "colour", "background", "radius", "paddingPx", "sizePx", "role", "base"] as const;
type Setting = (typeof settings)[number];

/** A block's list and its place in it, when the path names a block (or the place one past its end). */
function blockAt(body: unknown, path: string): { list: unknown[]; head: string; n: number } | undefined {
  const cut = path.lastIndexOf(".");
  const head = path.slice(0, cut);
  if (cut < 0 || !(blockLists as readonly string[]).includes(head)) return undefined;
  const n = Number(path.slice(cut + 1));
  let list: unknown = body;
  for (const k of head.split(".")) list = (list as Record<string, unknown> | undefined)?.[k];
  if (!Array.isArray(list) || !Number.isInteger(n) || n < 0 || n > list.length)
    throw new BookEditError("No such block.");
  return { list, head, n };
}

/** The marks of a block and of every line in it. */
const marksOf = (marks: BookEditMark[], path: string) =>
  marks.filter((x) => x.path === path || x.path.startsWith(`${path}.`));
/** The same marks at another place. */
const rebase = (marks: BookEditMark[], from: string, to: string) =>
  marks.map((x) => ({ ...x, path: to + x.path.slice(from.length) }));

/** Why a block cannot go into its list, or undefined. */
function itemProblem(body: unknown, head: string, item: unknown, at: number): string | undefined {
  if (!item || typeof item !== "object") return "Nothing to put in.";
  if (head === "speak.traits") return blockProblem(item as VoiceTrait);
  return componentProblem(body as DesignBook, item as DesignComponent, at);
}

/** Put in, move or take out a whole block. Returns the edit that undoes it. */
function applyBlockEdit(
  body: unknown,
  marks: BookEditMark[],
  e: BookEdit,
  at: { list: unknown[]; head: string; n: number },
  by: Id,
  when: string,
): BookEdit {
  const { list, head, n } = at;
  const path = `${head}.${n}`;
  if (e.item !== undefined) {
    const problem = itemProblem(body, head, e.item, -1);
    if (problem) throw new BookEditError(problem);
    list.splice(n, 0, structuredClone(e.item));
    shift(marks, path, n, 1);
    // Put back as it was (an undo: its marks, at the place it comes back to), or added as a new block.
    if (e.marks)
      marks.push(...e.marks.map((x) => ({ ...x, path: path + x.path.slice(head.length + 1).replace(/^\d+/, "") })));
    else marks.push({ path, by, at: when, from: null });
    return { path, to: null };
  }
  if (n >= list.length) throw new BookEditError("No such block.");
  if (e.moveTo !== undefined) {
    const m = e.moveTo;
    if (!Number.isInteger(m) || m < 0 || m >= list.length) throw new BookEditError("No such place.");
    if (m === n) return { path, to: null, moveTo: n };
    const own = marksOf(marks, path);
    for (const x of own) marks.splice(marks.indexOf(x), 1);
    const [moved] = list.splice(n, 1);
    shift(marks, path, n + 1, -1);
    list.splice(m, 0, moved);
    shift(marks, `${head}.${m}`, m, 1);
    marks.push(...rebase(own, path, `${head}.${m}`));
    return { path: `${head}.${m}`, to: null, moveTo: n };
  }
  if (e.to !== null) throw new BookEditError("A block is put in whole, not as a line.");
  const own = marksOf(marks, path);
  for (const x of own) marks.splice(marks.indexOf(x), 1);
  const [gone] = list.splice(n, 1);
  shift(marks, path, n + 1, -1);
  return { path, to: null, insert: true, item: gone as BookEdit["item"], marks: own };
}

/** The component and the setting a path names ("components.8.background"), when it names one. */
function settingAt(body: unknown, path: string): { c: DesignComponent; key: Setting; i: number } | undefined {
  const m = /^components\.(\d+)\.([A-Za-z]+)$/.exec(path);
  if (!m || !(settings as readonly string[]).includes(m[2]!)) return undefined;
  const i = Number(m[1]);
  const c = (body as DesignBook | undefined)?.components?.[i];
  if (!c) throw new BookEditError("No such component.");
  return { c, key: m[2] as Setting, i };
}

/** A setting's value as words: the token's name, figures, or "none". */
const settingWords = (v: unknown) => (v === undefined || v === null ? "none" : String(v));

/** Set one of a component's settings from words, in the brand's tokens. Returns the edit that undoes it. */
function applySetting(
  body: unknown,
  marks: BookEditMark[],
  e: BookEdit,
  at: { c: DesignComponent; key: Setting; i: number },
  by: Id,
  when: string,
): BookEdit {
  const { c, key, i } = at;
  const book = body as DesignBook;
  if (e.to === null && key !== "background" && key !== "role" && key !== "sizePx")
    throw new BookEditError("Only a ground, a role or a size can be none.");
  const words = (e.to ?? "none").trim();
  const next: DesignComponent = { ...c };
  const before = settingWords(c[key]);
  if (words === before) return { path: e.path, to: before };
  switch (key) {
    case "paddingPx": {
      const px = Number(words);
      if (!paddingSteps(book).includes(px) && px !== c.paddingPx)
        throw new BookEditError("Use one of the brand's spacing steps.");
      next.paddingPx = px;
      break;
    }
    case "sizePx":
      if (words === "none") delete next.sizePx;
      else next.sizePx = Number(words);
      break;
    case "background":
      next.background = words === "none" ? null : (words as DesignComponent["colour"]);
      break;
    case "role":
      if (words === "none") delete next.role;
      else next.role = words as DesignComponent["role"];
      break;
    case "name":
      // A component the engine knows by its name keeps its role when the brand renames it.
      if (!next.role && componentRole(c)) next.role = componentRole(c);
      next.name = words;
      break;
    default:
      (next as unknown as Record<string, string>)[key] = words;
  }
  if (Number.isNaN(next.paddingPx) || Number.isNaN(next.sizePx)) throw new BookEditError("Figures, in pixels.");
  const problem = componentProblem(book, next, i);
  if (problem) throw new BookEditError(problem);
  book.components[i] = next;
  const mark = marks.find((x) => x.path === e.path);
  if (mark) {
    if (words === mark.from) marks.splice(marks.indexOf(mark), 1);
    else Object.assign(mark, { by, at: when });
  } else marks.push({ path: e.path, by, at: when, from: before });
  return { path: e.path, to: before };
}

/** Where a path leads: the list or object holding the line, and its key. Anything that is not a line is refused. */
export function reachLine(body: unknown, path: string, insert = false): { parent: unknown; key: string } {
  const keys = path.split(".");
  if (!body || keys.some((k) => !k || k === "__proto__" || k === "constructor" || k === "prototype"))
    throw new BookEditError("No such line.");
  let at: unknown = body;
  for (const k of keys.slice(0, -1)) {
    at = (at as Record<string, unknown>)?.[k];
    if (at === undefined || at === null || typeof at !== "object") throw new BookEditError("No such line.");
  }
  const key = keys[keys.length - 1];
  if (Array.isArray(at)) {
    const n = Number(key);
    const ok = Number.isInteger(n) && n >= 0 && n <= at.length && (n === at.length || typeof at[n] === "string");
    if (!ok || (insert && n > at.length)) throw new BookEditError("No such line.");
  } else if (insert || typeof (at as Record<string, unknown>)[key] !== "string")
    throw new BookEditError("No such line.");
  return { parent: at, key };
}

/** The words at a path, or undefined when there is no line there. */
export function lineAt(body: unknown, path: string): string | undefined {
  try {
    const { parent, key } = reachLine(body, path);
    const v = (parent as Record<string, unknown>)[key];
    return typeof v === "string" ? v : undefined;
  } catch {
    return undefined;
  }
}

/** Move the marks of a list's items after `from` by `by` (an item taken out or put in). */
function shift(marks: BookEditMark[], path: string, from: number, by: number) {
  const head = path.slice(0, path.lastIndexOf(".") + 1);
  for (const x of marks) {
    if (!x.path.startsWith(head)) continue;
    const rest = x.path.slice(head.length);
    const n = Number(rest.split(".")[0]);
    if (Number.isInteger(n) && n >= from) x.path = head + String(n + by) + rest.slice(String(n).length);
  }
}

/** Apply one edit to a body in place, and keep the marks right. Returns the edit that undoes it. */
export function applyEdit(body: unknown, marks: BookEditMark[], e: BookEdit, by: Id, at: string): BookEdit {
  if (!body) throw new BookEditError("No such line.");
  const block = blockAt(body, e.path);
  if (block) return applyBlockEdit(body, marks, e, block, by, at);
  if (e.item !== undefined || e.moveTo !== undefined) throw new BookEditError("Only a block is put in or moved whole.");
  const setting = settingAt(body, e.path);
  if (setting) return applySetting(body, marks, e, setting, by, at);
  const { parent, key } = reachLine(body, e.path, e.insert);
  const list = Array.isArray(parent) ? (parent as string[]) : undefined;
  const n = list ? Number(key) : -1;
  if (list && e.insert) {
    if (e.to === null) throw new BookEditError("Nothing to put in.");
    list.splice(n, 0, e.to);
    shift(marks, e.path, n, 1);
    // Put back as it was (an undo), or added as a new line.
    if (e.mark !== undefined) {
      if (e.mark) marks.push({ ...e.mark, path: e.path });
    } else marks.push({ path: e.path, by, at, from: null });
    return { path: e.path, to: null };
  }
  const before = list ? (n < list.length ? list[n] : null) : ((parent as Record<string, string>)[key] ?? null);
  const mark = marks.find((x) => x.path === e.path);
  if (list && e.to === null) {
    if (n >= list.length) throw new BookEditError("No such line.");
    list.splice(n, 1);
    if (mark) marks.splice(marks.indexOf(mark), 1);
    shift(marks, e.path, n + 1, -1);
    return { path: e.path, to: before, insert: true, mark: mark ? { ...mark } : null };
  }
  if (e.to === null) throw new BookEditError("Only an item of a list can be taken out.");
  if (list) {
    if (n === list.length) list.push(e.to);
    else list[n] = e.to;
  } else (parent as Record<string, string>)[key] = e.to;
  if (mark) {
    // Back to what it said: no longer an edit.
    if (e.to === mark.from) marks.splice(marks.indexOf(mark), 1);
    else Object.assign(mark, { by, at });
  } else marks.push({ path: e.path, by, at, from: before || null }); // a line of a new block, written for the first time, is added
  return before === null ? { path: e.path, to: null } : { path: e.path, to: before };
}
