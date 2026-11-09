// The brand's books (FLOWS §30, §32): Fume writes a Tone of Voice, a design system or a Look Book, an expert checks the
// draft, and only the customer's owner or approver approves it or asks for a change. The rules are brand_books' (migration
// 20261104233000_brand_books): a customer never reads a version being written, a failed one, or a draft.
import {
  FumeError,
  type BookProgress,
  type BrandBook,
  type BrandBookKind,
  type BrandBooksView,
  type FumeApi,
  type Id,
} from "../contract";
import { canApprove } from "../domain/permissions";
import type { Mock } from "./context";

type Calls = "brandBooks" | "writeBrandBook" | "checkBrandBook" | "approveBrandBook" | "askBrandBookChange";
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
  function write(kind: BrandBookKind, ask?: string): Row {
    const writing = mine().find((b) => b.kind === kind && b.state === "writing");
    if (writing) return writing;
    const before = mine().filter((b) => b.kind === kind);
    const from = before.find((b) => b.body);
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
    async askBrandBookChange({ bookId, ask }) {
      const b = find(bookId);
      mustCustomerDecide("asks for a change");
      if (!ask?.trim()) throw new FumeError("invalid", "Say what should change.");
      if (b.state === "checked") b.state = "changes_asked";
      return wait(out(write(b.kind, ask)));
    },
  };
}
