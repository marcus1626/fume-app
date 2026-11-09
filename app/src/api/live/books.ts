// The brand's books on the live backend (app/FLOWS.md §30–32, supabase/migrations/20261104233000_brand_books.sql):
// a long Tone of Voice, a design system and a Look Book. Fume writes a version (write_brand_book, then the brand-book
// function), an expert checks it, and only the customer's owner or approver approves it. What a reader may see is the
// database's to decide: a customer reads a version once it is checked, and learns only that a newer one is on its way
// (brand_book_progress). A change to a book reaches the open screens over Realtime (events.ts).
import type { BookProgress, BrandBook, BrandBookKind, BrandBooksView, DesignBook, FumeApi, Id } from "../../contract";
import { FumeError } from "../../contract";
import type { Live } from "./context";
import { command, rows, supabase } from "./supabase";

type Calls = "brandBooks" | "writeBrandBook" | "checkBrandBook" | "approveBrandBook" | "askBrandBookChange";

export interface BookRow {
  id: string;
  workspace_id: string;
  kind: BrandBookKind;
  version: number;
  state: BrandBook["state"];
  body: Record<string, unknown> | null;
  ask: string | null;
  error: string | null;
  created_by: string | null;
  created_at: string;
  started_at: string | null;
  written_at: string | null;
  checked_by: string | null;
  checked_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
}

const COLUMNS =
  "id, workspace_id, kind, version, state, body, ask, error, created_by, created_at, started_at, written_at, checked_by, checked_at, approved_by, approved_at";

const hasBody = (r: Pick<BookRow, "state" | "body">) =>
  r.state !== "writing" && r.state !== "failed" && Boolean(r.body) && Object.keys(r.body ?? {}).length > 0;

/** A row as the contract's book; no body while it is written, or when writing it failed. */
export function toBook(r: BookRow, pictures: string[] = []): BrandBook {
  const base = {
    id: r.id,
    version: r.version,
    state: r.state,
    ...(r.ask ? { ask: r.ask } : {}),
    ...(r.ask && r.created_by ? { askedBy: r.created_by } : {}),
    ...(r.state === "failed" && r.error ? { error: r.error } : {}),
    createdAt: r.created_at,
    ...(r.written_at ? { writtenAt: r.written_at } : {}),
    ...(r.checked_by ? { checkedBy: r.checked_by } : {}),
    ...(r.checked_at ? { checkedAt: r.checked_at } : {}),
    ...(r.approved_by ? { approvedBy: r.approved_by } : {}),
    ...(r.approved_at ? { approvedAt: r.approved_at } : {}),
  };
  if (!hasBody(r)) return { ...base, kind: r.kind } as BrandBook;
  if (r.kind === "design")
    return { ...base, kind: "design", body: withPictures(r.body as unknown as DesignBook, pictures) };
  return { ...base, kind: r.kind, body: r.body } as unknown as BrandBook;
}

/** The design system's examples are drawn on the brand's own photographs: one each, in turn, where it has none. */
export function withPictures(body: DesignBook, pictures: string[]): DesignBook {
  if (!pictures.length || !Array.isArray(body.examples)) return body;
  return {
    ...body,
    examples: body.examples.map((e, i) => (e.image ? e : { ...e, image: pictures[i % pictures.length] })),
  };
}

/** The brand's own photographs, as its Look Book read them (public links on its website or its Brand DNA). */
export function brandPictures(look: BookRow | undefined): string[] {
  const evidence = (look?.body?.evidence ?? []) as { url?: string | null; kind?: string }[];
  return evidence
    .filter((e) => typeof e.url === "string" && /^https:\/\//.test(e.url) && e.kind !== "not_us")
    .map((e) => e.url as string);
}

/** The newest versions first, in the three books. */
export function toView(list: BookRow[], progress: BookProgress[]): BrandBooksView {
  const sorted = [...list].sort((a, b) => b.version - a.version);
  const look =
    sorted.find((r) => r.kind === "look" && hasBody(r) && r.state !== "superseded") ??
    sorted.find((r) => r.kind === "look" && hasBody(r));
  const pictures = brandPictures(look);
  const of = (kind: BrandBookKind) => sorted.filter((r) => r.kind === kind).map((r) => toBook(r, pictures));
  return { voice: of("voice"), design: of("design"), look: of("look"), ...(progress.length ? { progress } : {}) };
}

async function readBook(id: Id): Promise<BrandBook> {
  const found = await rows<BookRow>(supabase().from("brand_books").select(COLUMNS).eq("id", id));
  if (!found[0]) throw new FumeError("not_found", "No such book.");
  return toBook(found[0]);
}

/** Fume writes the version in the background; the call answers at once and the book shows "Fume is writing". */
const asked = new Set<Id>();
function startWriting(bookId: Id) {
  asked.add(bookId);
  void supabase()
    .functions.invoke("brand-book", { body: { bookId } })
    .catch(() => undefined);
}

export function bookCalls(live: Live): Pick<FumeApi, Calls> {
  return {
    async brandBooks() {
      const ws = await live.workspaceId();
      const [list, progress] = await Promise.all([
        rows<BookRow>(
          supabase().from("brand_books").select(COLUMNS).eq("workspace_id", ws).order("version", { ascending: false }),
        ),
        supabase()
          .rpc("brand_book_progress", { p_workspace_id: ws })
          .then(({ data }) => (Array.isArray(data) ? (data as BookProgress[]) : [])),
      ]);
      // A writing that never came back is taken again after four minutes (brand_book_take); a read asks for it.
      for (const r of list)
        if (
          r.state === "writing" &&
          !asked.has(r.id) &&
          Date.now() - new Date(r.started_at ?? r.created_at).getTime() > 4 * 60_000
        )
          startWriting(r.id);
      return toView(list, progress);
    },
    async writeBrandBook({ kind, ask }) {
      const ws = await live.workspaceId();
      const row = await command<{ id: string }>("write_brand_book", {
        p_workspace_id: ws,
        p_kind: kind,
        p_ask: ask ?? null,
      });
      startWriting(row.id);
      return readBook(row.id);
    },
    async checkBrandBook(bookId) {
      await command("check_brand_book", { p_book_id: bookId });
      return readBook(bookId);
    },
    async approveBrandBook(bookId) {
      await command("approve_brand_book", { p_book_id: bookId });
      return readBook(bookId);
    },
    async askBrandBookChange({ bookId, ask }) {
      const row = await command<{ id: string }>("ask_brand_book_change", { p_book_id: bookId, p_ask: ask });
      startWriting(row.id);
      // The customer does not read the new version while it is written: she gets the one she asked to change.
      return readBook(bookId);
    },
  };
}
