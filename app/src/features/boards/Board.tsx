// A board: moodboards and idea boards (FLOWS §3.3). The customer's and the staff screens use the same component, <Board
// board={…} />. It joins the data to the view: saves moves and new items through the API, keeps the selection, and
// carries the floating toolbar and the side panel of the selected item.
// Data and view are apart on purpose (FLOWS §6): BoardView.tsx only draws a Board, reports gestures as callbacks
// (onSelect, onMove) and takes commands through its handle (zoomBy, fit, centre). When the boards move onto
// OpenPencil's renderer, BoardView is the part that is replaced; this file, the toolbar, the panel and the API calls
// stay.
// Provenance stays quiet on the canvas (Fume's mark on a proposal, a small verdict disc on an image) and is spelled out
// in the side panel: who put the item in, where Fume found it, Confirm · Remove for a proposal (only the owner or
// approver decides, F-D077), and the verdicts This is us · Not us · Not yet, which teach Fume her taste. A proposal is
// Fume's find, never "the Engine's".
// ⌘Z / Ctrl+Z puts the last move back and ⇧⌘Z / Ctrl+Y does it again, never while typing in a field; the first move of
// a visit says so in a "Moved" toast with Undo.
import {
  Button,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
  ProposalActions,
  ProposalTag,
  SegmentedControl,
  SegmentedOption,
  Textarea,
  Toolbar,
  WithTooltip,
  useToast,
} from "@fume/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useAddBoardItem,
  useBoards,
  useDecide,
  usePeople,
  useRemoveBoardItem,
  useSession,
  useUpdateBoardItem,
} from "../../api/hooks";
import type { Board as BoardData, BoardItem } from "../../contract";
import { date } from "../../lib/time";
import { directory } from "../../shell/people";
import { BoardView, type BoardViewHandle } from "./BoardView";

export { BoardView, type BoardViewHandle, type BoardViewProps } from "./BoardView";

/** An image the customer can put on the board from what Fume already has. */
export interface BoardReference {
  src: string;
  label: string;
}

export interface BoardProps {
  board: BoardData;
  /** A fixed height inside a page (the campaign's Moodboard tab) instead of filling a full-height page. */
  embedded?: boolean;
  /** Images to add from; by default the liked images on the workspace's other boards. */
  references?: BoardReference[];
}

const kindName: Record<BoardItem["kind"], string> = {
  image: "Image",
  note: "Note",
  section: "Section",
  creative: "Creative",
  swatch: "Colour",
};

/** The image's own proportions at a width, so a picture lands uncropped. */
function sized(src: string, width: number): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () =>
      resolve({
        w: width,
        h: Math.round(width * Math.min(2, Math.max(0.4, img.naturalHeight / (img.naturalWidth || 1)))),
      });
    img.onerror = () => resolve({ w: width, h: Math.round(width * 1.25) });
    img.src = src;
  });
}

export function Board({ board, embedded, references }: BoardProps) {
  const session = useSession().data!;
  const people = directory(usePeople().data);
  const others = useBoards();
  const update = useUpdateBoardItem();
  const add = useAddBoardItem();
  const remove = useRemoveBoardItem();
  const decide = useDecide();
  const toast = useToast();
  const view = useRef<BoardViewHandle>(null);
  const upload = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [refsOpen, setRefsOpen] = useState(false);
  // The moves of this visit, so ⌘Z puts one back and ⇧⌘Z does it again.
  const history = useRef<{ undo: Move[]; redo: Move[]; told: boolean }>({ undo: [], redo: [], told: false });

  const staff = Boolean(session.user.staffRole);
  const editable = staff || session.role === "owner" || session.role === "approver" || session.role === "member";
  const canDecide = !staff && (session.role === "owner" || session.role === "approver");
  const selected = board.items.find((i) => i.id === selectedId && i.provenance.state !== "removed");

  // Let go of an item that has left the board.
  useEffect(() => {
    if (selectedId && !selected) setSelectedId(null);
  }, [selectedId, selected]);

  const refs = useMemo<BoardReference[]>(() => {
    if (references) return references;
    const here = new Set(board.items.map((i) => i.image));
    const seen = new Set<string>();
    return (others.data ?? [])
      .filter((b) => b.id !== board.id)
      .flatMap((b) =>
        b.items
          .filter((i) => i.image && i.verdict === "liked")
          .map((i) => ({ src: i.image!, label: i.note ?? `From ${b.name}` })),
      )
      .filter((r) => !here.has(r.src) && !seen.has(r.src) && seen.add(r.src));
  }, [references, others.data, board]);

  const failed = (what: string) => (e: Error) => toast.error(what, { description: e.message });

  const moveTo = (itemId: string, at: { x: number; y: number }) =>
    update.mutate({ boardId: board.id, itemId, change: at }, { onError: failed("The move wasn’t saved") });
  const undo = () => {
    const m = history.current.undo.pop();
    if (!m) return;
    history.current.redo.push(m);
    moveTo(m.itemId, m.from);
  };
  const redo = () => {
    const m = history.current.redo.pop();
    if (!m) return;
    history.current.undo.push(m);
    moveTo(m.itemId, m.to);
  };
  const moved = (itemId: string, x: number, y: number) => {
    const item = board.items.find((i) => i.id === itemId);
    if (item && (item.x !== x || item.y !== y)) {
      history.current.undo.push({ itemId, from: { x: item.x, y: item.y }, to: { x, y } });
      history.current.redo = [];
      if (!history.current.told) {
        history.current.told = true;
        toast.done("Moved", { description: `${modKey()}Z puts it back`, action: { label: "Undo", onClick: undo } });
      }
    }
    moveTo(itemId, { x, y });
  };
  // The keys always reach the latest undo and redo, without re-binding on every render.
  const keys = useRef({ undo, redo });
  keys.current = { undo, redo };
  useEffect(() => {
    if (!editable) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.defaultPrevented || typing(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) keys.current.undo();
      else if ((k === "z" && e.shiftKey) || (k === "y" && e.ctrlKey && !e.metaKey)) keys.current.redo();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editable]);

  /** Puts a new item in the middle of the view and opens it. */
  const place = (item: Omit<BoardItem, "id" | "boardId" | "provenance" | "x" | "y">) => {
    const c = view.current?.centre() ?? { x: board.width / 2, y: board.height / 2 };
    const before = new Set(board.items.map((i) => i.id));
    add.mutate(
      { boardId: board.id, item: { ...item, x: Math.round(c.x - item.w / 2), y: Math.round(c.y - item.h / 2) } },
      {
        onSuccess: (next) => setSelectedId(next.items.find((i) => !before.has(i.id))?.id ?? null),
        onError: failed("The item wasn’t added"),
      },
    );
  };

  const addImage = async (src: string, note?: string) => {
    const size = await sized(src, 320);
    place({ kind: "image", image: src, note, ...size });
  };

  const tool = (
    label: string,
    icon: Parameters<typeof Button>[0]["icon"],
    onClick: () => void,
    shortcut?: string,
    disabled?: boolean,
  ) => (
    <WithTooltip label={label} shortcut={shortcut} side="top">
      <Button variant="glass-clear" iconOnly icon={icon} aria-label={label} onClick={onClick} disabled={disabled} />
    </WithTooltip>
  );

  return (
    <BoardView
      ref={view}
      board={board}
      label={board.name}
      embedded={embedded}
      editable={editable}
      selectedId={selected?.id ?? null}
      onSelect={setSelectedId}
      onZoomChange={setZoom}
      onMove={moved}
    >
      <Toolbar
        bare
        aria-label={`${board.name}, tools`}
        className="ui-glass ui-glass--bar ui-board-toolbar"
        data-board-ui
      >
        {editable && (
          <div className="ui-board-toolbar-group" role="group" aria-label="Add">
            <Popover open={refsOpen} onOpenChange={setRefsOpen}>
              <WithTooltip label="Add an image" side="top">
                <PopoverTrigger asChild>
                  <Button variant="glass-clear" iconOnly icon="image-plus" aria-label="Add an image" />
                </PopoverTrigger>
              </WithTooltip>
              <PopoverContent side="top" data-board-ui>
                <PopoverHeader>
                  <PopoverTitle>Add an image</PopoverTitle>
                  <PopoverDescription>
                    {refs.length ? "From your other boards, or one of your own." : "Upload one of your own."}
                  </PopoverDescription>
                </PopoverHeader>
                {refs.length > 0 && (
                  <div className="ui-board-refs">
                    {refs.map((r) => (
                      <button
                        key={r.src}
                        type="button"
                        className="ui-board-ref"
                        aria-label={`Add ${r.label}`}
                        onClick={() => {
                          setRefsOpen(false);
                          void addImage(r.src, r.label);
                        }}
                      >
                        <img src={r.src} alt="" loading="lazy" />
                      </button>
                    ))}
                  </div>
                )}
                <Button
                  variant="glass-white"
                  icon="upload"
                  onClick={() => {
                    setRefsOpen(false);
                    upload.current?.click();
                  }}
                >
                  Upload an image
                </Button>
              </PopoverContent>
            </Popover>
            {tool("Add a note", "sticky-note", () => place({ kind: "note", w: 300, h: 160, text: "A new note" }))}
            {tool("Add a section", "layout-grid", () =>
              place({ kind: "section", w: 720, h: 520, text: "New section" }),
            )}
            <input
              ref={upload}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                for (const f of Array.from(e.target.files ?? []))
                  void addImage(URL.createObjectURL(f), f.name.replace(/\.[^.]+$/, ""));
                e.target.value = "";
              }}
            />
          </div>
        )}
        <div className="ui-board-toolbar-group" role="group" aria-label="Zoom">
          <span className="ui-board-toolbar-wide">
            {tool("Zoom out", "zoom-out", () => view.current?.zoomBy(0.8), "−")}
          </span>
          <output className="ui-board-zoom-num" aria-live="polite" aria-label="Zoom">
            {Math.round(zoom * 100)} %
          </output>
          <span className="ui-board-toolbar-wide">
            {tool("Zoom in", "zoom-in", () => view.current?.zoomBy(1.25), "+")}
          </span>
          {tool("Fit to screen", "maximize-2", () => view.current?.fit(), "⇧1")}
        </div>
      </Toolbar>

      {selected && (
        <ItemPanel
          key={selected.id}
          item={selected}
          people={people}
          editable={editable}
          canDecide={canDecide}
          staff={staff}
          busy={update.isPending || decide.isPending || remove.isPending}
          onClose={() => setSelectedId(null)}
          onChange={(change) =>
            update.mutate(
              { boardId: board.id, itemId: selected.id, change },
              { onError: failed("The change wasn’t saved") },
            )
          }
          onDecide={(verdict) => {
            const id = selected.id;
            decide.mutate(
              { kind: "board_item", id, verdict },
              {
                // Confirm shows on the item itself (its tag), so it says nothing; Remove takes it away, so it says so.
                onSuccess: () => {
                  if (verdict !== "remove") return;
                  setSelectedId(null);
                  toast.done("Removed from the board", {
                    action: {
                      label: "Undo",
                      onClick: () =>
                        decide.mutate(
                          { kind: "board_item", id, verdict: "keep" },
                          { onError: failed("It wasn’t put back") },
                        ),
                    },
                  });
                },
                onError: failed("That wasn’t saved"),
              },
            );
          }}
          onRemove={() =>
            remove.mutate(
              { boardId: board.id, itemId: selected.id },
              { onSuccess: () => setSelectedId(null), onError: failed("The item wasn’t removed") },
            )
          }
        />
      )}
    </BoardView>
  );
}

// ─── Undo and redo ──────────────────────────────────────────────────────────

interface Move {
  itemId: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

/** "⌘" on a Mac, "Ctrl+" elsewhere: the words of the toast. */
function modKey(): string {
  return typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent)
    ? "⌘"
    : "Ctrl+";
}

/** A key pressed while typing belongs to the field (its own undo), never to the board. */
function typing(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.closest) return false;
  return Boolean(
    el.closest("input, textarea, select, [contenteditable=''], [contenteditable='true'], [role='dialog']"),
  );
}

// ─── The side panel ─────────────────────────────────────────────────────────

type People = ReturnType<typeof directory>;
type Change = Partial<Pick<BoardItem, "verdict" | "note" | "text">>;

interface ItemPanelProps {
  item: BoardItem;
  people: People;
  editable: boolean;
  canDecide: boolean;
  staff: boolean;
  busy: boolean;
  onClose: () => void;
  onChange: (change: Change) => void;
  onDecide: (verdict: "keep" | "remove") => void;
  onRemove: () => void;
}

function ItemPanel({
  item,
  people,
  editable,
  canDecide,
  staff,
  busy,
  onClose,
  onChange,
  onDecide,
  onRemove,
}: ItemPanelProps) {
  const p = item.provenance;
  const proposed = p.state === "proposed";
  const isImage = item.kind === "image" || item.kind === "creative";
  const [reason, setReason] = useState(item.note ?? "");
  const [text, setText] = useState(item.text ?? "");
  const title =
    item.kind === "section"
      ? item.text || "Section"
      : item.kind === "swatch"
        ? item.text || "Colour"
        : kindName[item.kind];

  return (
    <aside className="ui-board-panel" aria-label={`${title}, details`} data-board-ui>
      <div className="ui-board-panel-head">
        <h2 className="ui-board-panel-title">{title}</h2>
        <Button variant="quiet" size="sm" iconOnly icon="x" aria-label="Close the details" onClick={onClose} />
      </div>

      {isImage && item.image && <img className="ui-board-panel-media" src={item.image} alt={item.note ?? ""} />}
      {item.kind === "swatch" && <p className="ui-board-panel-text">{item.hex}</p>}

      <div className="ui-board-panel-group">
        <ProposalTag
          origin={p.origin}
          state={p.state}
          evidence={p.evidence}
          by={p.by ? people.name(p.by) : undefined}
          when={p.at ? date(p.at) : undefined}
        />
        {proposed ? (
          <>
            <p className="ui-board-panel-text">It stays a proposal until it is confirmed.</p>
            {canDecide ? (
              <ProposalActions
                name={title}
                disabled={busy}
                onKeep={() => onDecide("keep")}
                onRemove={() => onDecide("remove")}
              />
            ) : (
              <p className="ui-board-panel-text">
                {staff
                  ? "Only the customer confirms or removes what Fume found."
                  : "Your workspace’s owner or approver confirms or removes what Fume found."}
              </p>
            )}
          </>
        ) : p.origin === "fume" && p.by ? (
          <p className="ui-board-panel-text">Added by {people.name(p.by)} at Fume.</p>
        ) : null}
      </div>

      {item.kind === "note" && (
        <div className="ui-board-panel-group">
          {editable ? (
            <Field>
              <FieldLabel htmlFor={`note-${item.id}`}>The note</FieldLabel>
              <Textarea id={`note-${item.id}`} value={text} onChange={(e) => setText(e.target.value)} rows={3} />
            </Field>
          ) : (
            <p className="ui-board-panel-text">{item.text}</p>
          )}
          {editable && text.trim() !== (item.text ?? "") && (
            <div className="ui-app-row">
              <Button
                variant="secondary"
                size="sm"
                disabled={busy || !text.trim()}
                onClick={() => onChange({ text: text.trim() })}
              >
                Save the note
              </Button>
            </div>
          )}
        </div>
      )}

      {item.kind === "section" && editable && (
        <div className="ui-board-panel-group">
          <Field>
            <FieldLabel htmlFor={`section-${item.id}`}>Name</FieldLabel>
            <Input id={`section-${item.id}`} value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          {text.trim() !== (item.text ?? "") && (
            <div className="ui-app-row">
              <Button
                variant="secondary"
                size="sm"
                disabled={busy || !text.trim()}
                onClick={() => onChange({ text: text.trim() })}
              >
                Save the name
              </Button>
            </div>
          )}
        </div>
      )}

      {isImage && (
        <div className="ui-board-panel-group">
          {editable ? (
            <>
              <SegmentedControl
                aria-label="Is this image you?"
                value={item.verdict ?? "none"}
                onValueChange={(v) => onChange({ verdict: v === "none" ? undefined : (v as "liked" | "disliked") })}
              >
                <SegmentedOption value="liked">This is us</SegmentedOption>
                <SegmentedOption value="disliked">Not us</SegmentedOption>
                <SegmentedOption value="none">Not yet</SegmentedOption>
              </SegmentedControl>
              <Field>
                <FieldLabel htmlFor={`reason-${item.id}`}>Why</FieldLabel>
                <Textarea
                  id={`reason-${item.id}`}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder={item.verdict === "disliked" ? "Hands too staged" : "Low side light on stone"}
                />
                <FieldDescription>Your yes or no, with its reason, teaches Fume your taste.</FieldDescription>
              </Field>
              {reason.trim() !== (item.note ?? "") && (
                <div className="ui-app-row">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() => onChange({ note: reason.trim() })}
                  >
                    Save the reason
                  </Button>
                </div>
              )}
            </>
          ) : (
            <p className="ui-board-panel-text">
              {item.verdict === "liked" ? "This is us" : item.verdict === "disliked" ? "Not us" : "Not answered yet"}
              {item.note ? `: ${item.note}` : ""}
            </p>
          )}
        </div>
      )}

      {editable && !proposed && (
        <div className="ui-app-row">
          <Button variant="quiet" size="sm" icon="trash" disabled={busy} onClick={onRemove}>
            Remove from the board
          </Button>
        </div>
      )}
    </aside>
  );
}
