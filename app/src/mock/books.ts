// The brand's books (FLOWS §30, §32): Fume writes a Tone of Voice, a design system or a Look Book, an expert checks the
// draft, and only the customer's owner or approver approves it or asks for a change. The rules are brand_books' (migration
// 20261104233000_brand_books): a customer never reads a version being written, a failed one, or a draft.
import {
  FumeError,
  type BookEdit,
  type BookProgress,
  type BrandBook,
  type BrandBookKind,
  type BrandBooksView,
  type CopyLineCheck,
  type FumeApi,
  type Id,
  type VoiceBook,
} from "../contract";
import { applyEdit, BookEditError } from "../domain/bookEdits";
import { canApprove } from "../domain/permissions";
import type { Mock } from "./context";

type Calls =
  | "brandBooks"
  | "writeBrandBook"
  | "checkBrandBook"
  | "approveBrandBook"
  | "askBrandBookChange"
  | "editBrandBook"
  | "checkCopyLine";
type Row = BrandBook & { workspaceId: Id };

/** What a customer reads: a version an expert checked, the one in use, and the ones before it. */
const customerReads = (b: BrandBook) => b.state === "checked" || b.state === "approved" || b.state === "superseded";

export function bookCalls(m: Mock): Pick<FumeApi, Calls> {
  const { db, wait } = m;
  const later = (fn: () => void, ticks = 12) => setTimeout(fn, m.latency * ticks);
  const out = ({ workspaceId: _, ...b }: Row): BrandBook => b as BrandBook;
  const mine = () => db.brandBooks.filter((b) => b.workspaceId === m.workspaceId);
  const readable = (b: Row) => b.workspaceId === m.workspaceId && (m.isStaff() || customerReads(b));
  const find = (bookId: Id) => {
    const b = db.brandBooks.find((x) => x.id === bookId);
    if (!b || !readable(b)) throw new FumeError("not_found", "No such book.");
    return b;
  };
  const mustCustomerDecide = (what: string) => {
    if (m.isStaff() || !canApprove(m.role()))
      throw new FumeError("forbidden", `Only the brand's owner or approver ${what}.`);
  };

  /** What a customer may know of a version she cannot read yet: the newest of each kind on its way, newer than the
   *  newest she reads. Its number and state, never its words (brand_book_progress). */
  function progress(): BookProgress[] {
    const out: BookProgress[] = [];
    for (const kind of ["voice", "design", "look"] as const) {
      const rows = mine().filter((b) => b.kind === kind);
      const read = Math.max(0, ...rows.filter(customerReads).map((b) => b.version));
      const next = rows.find(
        (b) => b.version > read && (b.state === "writing" || b.state === "draft" || b.state === "failed"),
      );
      if (next)
        out.push({
          kind,
          version: next.version,
          state: next.state as BookProgress["state"],
          updatedAt: next.writtenAt ?? next.createdAt,
        });
    }
    return out;
  }

  /** A new version, written in the background: from the version before, with the ask. A brand Fume has not read yet
   *  has nothing to write from, so the mock's writing fails there (as the writer does after three tries). */
  function write(kind: BrandBookKind, ask?: string, base?: Row, edits?: BookEdit[]): Row {
    const writing = mine().find((b) => b.kind === kind && b.state === "writing");
    if (writing) return writing;
    const before = mine().filter((b) => b.kind === kind);
    const from = base?.body ? base : before.find((b) => b.body);
    const row = {
      id: m.nextId("bb"),
      workspaceId: m.workspaceId,
      kind,
      version: Math.max(0, ...before.map((b) => b.version)) + 1,
      state: "writing",
      ...(ask?.trim() ? { ask: ask.trim(), askedBy: m.userId } : {}),
      createdAt: m.now(),
    } as Row;
    db.brandBooks.unshift(row);
    later(() => {
      if (row.state !== "writing") return;
      if (from?.body) {
        Object.assign(row, { state: "draft", writtenAt: m.now(), body: structuredClone(from.body) });
        // The customer's own lines go in as she wrote them, marked hers.
        if (edits?.length) Object.assign(row, edited(row, edits, row.askedBy ?? m.userId));
      } else {
        Object.assign(row, {
          state: "failed",
          error: "Fume found too little about the brand to write from. Add its website or its brand guide first.",
        });
      }
      m.emit({ type: "book.state", book: out(row) });
    });
    return row;
  }

  /** A version's body and marks with the edits applied, on copies: nothing changes when one edit is refused. */
  function edited(row: Pick<Row, "body" | "edits">, edits: BookEdit[], by: Id) {
    const body = structuredClone(row.body);
    const marks = structuredClone(row.edits ?? []);
    try {
      for (const e of edits) applyEdit(body, marks, e, by, m.now());
    } catch (error) {
      if (error instanceof BookEditError) throw new FumeError("invalid", error.message);
      throw error;
    }
    return { body, edits: marks } as Pick<Row, "body" | "edits">;
  }

  return {
    async brandBooks() {
      const list = db.brandBooks.filter(readable).map(out);
      const view: BrandBooksView = {
        voice: list.filter((b) => b.kind === "voice"),
        design: list.filter((b) => b.kind === "design"),
        look: list.filter((b) => b.kind === "look"),
      };
      if (!m.isStaff()) view.progress = progress();
      return wait(view);
    },
    async writeBrandBook({ kind, ask }) {
      if (kind !== "voice" && kind !== "design" && kind !== "look")
        throw new FumeError("invalid", "A Tone of Voice, a design system or a Look Book.");
      if ((ask ?? "").length > 2000) throw new FumeError("invalid", "Say it in fewer words.");
      if (!m.isStaff() && !canApprove(m.role()))
        throw new FumeError("forbidden", "Only the people who run the brand, or its owner or approver, ask for this.");
      return wait(out(write(kind, ask)));
    },
    async checkBrandBook(bookId) {
      const b = find(bookId);
      if (m.me().staffRole !== "expert" && !m.me().agency) throw new FumeError("forbidden", "An expert checks it.");
      if (b.state !== "draft") throw new FumeError("conflict", "Only a draft is checked.");
      Object.assign(b, { state: "checked", checkedBy: m.userId, checkedAt: m.now() });
      m.emit({ type: "book.state", book: out(b) });
      return wait(out(b));
    },
    async approveBrandBook(bookId) {
      const b = find(bookId);
      mustCustomerDecide("approves it");
      if (b.state !== "checked") throw new FumeError("conflict", "Only a checked version is approved.");
      for (const x of mine()) if (x.kind === b.kind && x.state === "approved") x.state = "superseded";
      Object.assign(b, { state: "approved", approvedBy: m.userId, approvedAt: m.now() });
      m.emit({ type: "book.state", book: out(b) });
      return wait(out(b));
    },
    async askBrandBookChange({ bookId, ask, edits }) {
      const b = find(bookId);
      mustCustomerDecide("asks for a change");
      if (!ask?.trim()) throw new FumeError("invalid", "Say what should change.");
      if (edits?.length) edited(b, edits, m.userId);
      if (b.state === "checked") b.state = "changes_asked";
      return wait(out(write(b.kind, ask, edits?.length ? b : undefined, edits)));
    },
    async editBrandBook({ bookId, edits }) {
      const b = find(bookId);
      if (!m.isStaff())
        throw new FumeError("forbidden", "Fume's people edit a book in place; the brand asks for a change.");
      if (!edits?.length) throw new FumeError("invalid", "No edits.");
      if (!b.body) throw new FumeError("conflict", "Nothing is written to edit yet.");
      if (edits.some((e) => e.to !== null && e.to.length > 600))
        throw new FumeError("invalid", "Say it in fewer words.");
      const next = edited(b, edits, m.userId);
      let row = b;
      if (b.state !== "draft") {
        const open = mine().find((x) => x.kind === b.kind && (x.state === "writing" || x.state === "draft"));
        if (open)
          throw new FumeError(
            "conflict",
            `Version ${open.version} is ${open.state === "writing" ? "being written" : "a draft"}: edit that one.`,
          );
        row = {
          id: m.nextId("bb"),
          workspaceId: m.workspaceId,
          kind: b.kind,
          version:
            Math.max(
              0,
              ...mine()
                .filter((x) => x.kind === b.kind)
                .map((x) => x.version),
            ) + 1,
          state: "draft",
          ask: `Edited from version ${b.version}`,
          askedBy: m.userId,
          createdAt: m.now(),
          writtenAt: m.now(),
          body: structuredClone(b.body),
        } as Row;
        db.brandBooks.unshift(row);
      }
      Object.assign(row, row === b ? next : edited(row, edits, m.userId));
      m.emit({ type: "book.state", book: out(row) });
      return wait(out(row));
    },
    async checkCopyLine({ text, channel }) {
      const line = text?.trim() ?? "";
      if (!line) throw new FumeError("invalid", "Write a line to check.");
      if (line.length > 600) throw new FumeError("invalid", "One line at a time.");
      const voices = mine().filter((b) => b.kind === "voice" && b.body);
      const book = m.isStaff() ? voices[0] : (voices.find((b) => b.state === "approved") ?? voices.find(customerReads));
      if (!book?.body) throw new FumeError("conflict", "There is no Tone of Voice to check against yet.");
      return wait(readLine(line, channel, book.body as VoiceBook, book.version));
    },
  };
}

/** The words a voice avoids, with the Norwegian forms the mock knows of them. */
const forms: Record<string, string[]> = {
  luxury: ["luksus", "luksuriøs"],
  transform: ["transformer"],
  results: ["resultat"],
  miracle: ["mirakel"],
  hurry: ["skynd"],
  "best ever": ["beste noensinne"],
};
const claimWords =
  /\b(best|beste|most|mest|nr\.? ?1|#1|100 ?%|guaranteed|garantert|clinically|klinisk|proven|bevist|heals?|leger|anti-?age?ing)\b/i;

/** The mock's reading of one line: the words the voice avoids, a claim of best or most, the voice's mechanics, and the
 *  channel's length. Its version drops what it found. The live check is the copy check's model (FLOWS §31). */
function readLine(text: string, channel: CopyLineCheck["channel"], book: VoiceBook, version: number): CopyLineCheck {
  const findings: CopyLineCheck["findings"] = [];
  const lower = text.toLowerCase();
  const avoided: string[] = [];
  for (const w of book.speak.avoid) {
    const hit = [w, ...(forms[w] ?? [])].find((f) => lower.includes(f.toLowerCase()));
    if (hit) {
      avoided.push(hit);
      findings.push({
        kind: "avoided_word",
        words: hit,
        note: hit.toLowerCase() === w.toLowerCase() ? `The voice avoids “${w}”.` : `“${hit}”: the voice avoids “${w}”.`,
      });
    }
  }
  const claim = text.match(claimWords)?.[0];
  if (claim)
    findings.push({
      kind: "unbacked_claim",
      words: claim,
      note: `A claim of best or most: no verified fact says “${claim}”.`,
    });
  const punctuation = book.mechanics?.punctuation.toLowerCase() ?? "";
  if (text.includes("!") && punctuation.includes("no exclamation"))
    findings.push({ kind: "off_voice", words: "!", note: "No exclamation marks." });
  const shouting = text.split(/\s+/).filter((w) => w.length > 2 && w === w.toUpperCase() && /[A-ZÆØÅ]/.test(w));
  if (shouting.some((w) => w !== "LYSNE"))
    findings.push({ kind: "off_voice", words: shouting[0], note: "Sentence case, never capitals for weight." });
  const words = text.split(/\s+/).filter(Boolean).length;
  const rule = book.channels?.find((c) => c.channel === channel)?.length ?? "";
  const max = Number(rule.match(/up to (\d+) words/i)?.[1] ?? 0) || undefined;
  if (max && words > max)
    findings.push({ kind: "too_long", note: `${words} words: the headline takes up to ${max} here.` });
  // The mock's version: the brand's own line for the same thing (the on-brand side of the closest off-brand pair),
  // else the channel's example, else the first headline. The live check writes one with the copy model.
  let rewrite: string | undefined;
  if (findings.length) {
    const tokens = (x: string) => new Set(x.toLowerCase().match(/[\p{L}\d]+/gu) ?? []);
    const mine = tokens(text);
    const near = (book.pairs ?? [])
      .map((x) => ({ x, n: [...tokens(x.bad)].filter((w) => mine.has(w)).length }))
      .sort((a, b) => b.n - a.n)[0];
    rewrite =
      near && near.n >= 2
        ? near.x.good
        : (book.channels?.find((c) => c.channel === channel)?.example ?? book.headlines?.[0]?.example);
  }
  return { text, channel, length: max ? { words, max } : undefined, findings, rewrite, version };
}
