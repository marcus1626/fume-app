// Editing a book's words in place (FLOWS §34.3, PROPOSED). One rule for the page and the server: an edit names the
// path of a line in the body ("speak.traits.1.do", "identity.believe.2") and its new words. In a list, `to: null` takes
// the item out, an index one past the end adds one, and `insert` puts one in before the item at that index. Every line
// changed keeps a mark: who changed it, and what it said before (null for a line someone added).
import type { BookEdit, BookEditMark, Id } from "../contract";

export class BookEditError extends Error {}

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
  const { parent, key } = reachLine(body, e.path, e.insert);
  const list = Array.isArray(parent) ? (parent as string[]) : undefined;
  const n = list ? Number(key) : -1;
  if (list && e.insert) {
    if (e.to === null) throw new BookEditError("Nothing to put in.");
    list.splice(n, 0, e.to);
    shift(marks, e.path, n, 1);
    marks.push({ path: e.path, by, at, from: null });
    return { path: e.path, to: null };
  }
  const before = list ? (n < list.length ? list[n] : null) : ((parent as Record<string, string>)[key] ?? null);
  const mark = marks.find((x) => x.path === e.path);
  if (list && e.to === null) {
    if (n >= list.length) throw new BookEditError("No such line.");
    list.splice(n, 1);
    if (mark) marks.splice(marks.indexOf(mark), 1);
    shift(marks, e.path, n + 1, -1);
    return { path: e.path, to: before, insert: true };
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
  } else marks.push({ path: e.path, by, at, from: before });
  return before === null ? { path: e.path, to: null } : { path: e.path, to: before };
}
