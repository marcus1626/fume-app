// The Storyboard (FLOWS §34.6; round 16, PROPOSED 9 Nov 2026). Marcus: "Story board må ikke nødvendigvis ligge der
// timelinen ligger. Jeg tenker liksom en egen side, med et board, som dekker hele siden, litt som et lite figma canvas
// på en måte." So it is a page of its own: the board covers the desk under the bar, a canvas she pans (the hand, space
// and drag, or the wheel) and zooms (⌘ and the wheel, − and +, Fit). The shots lie on it as cards in sections, left to
// right in the film's order: Hook, Story, End card to start with, renamed, added and taken out as she likes. A card
// is the shot: its picture with its other takes stacked behind, its number and name, where it comes from, its length
// and camera, and the words on screen while it plays. Drag a card to another place, in its section or another, and
// the edit's order follows (the timeline shows the same). Notes lie where she puts them (the Note tool, then a click).
// Picking a card picks the shot; "Open in the edit" goes to the timeline with it picked. The look is
// studio-video.css (.ui-video-board).
import { Button, Glass, Icon, Toggle, WithTooltip, type IconName } from "@fume/ui";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import type { CameraMove, StoryboardNote, VideoEdit } from "../../../../contract";
import { pickedTake, placed } from "../../../../domain/video";
import {
  addNote,
  addSection,
  boardOf,
  moveShot,
  nudgeShot,
  removeNote,
  removeSection,
  renameSection,
  setNote,
} from "./board";
import { localId, openFindings, takeWords, type Selection } from "./edit";
import { Views } from "./Timeline";

const MOVE: Record<CameraMove, string> = {
  still: "Still",
  push: "Push in",
  pull: "Pull out",
  orbit: "Orbit",
  pan: "Pan",
  tilt: "Tilt",
  handheld: "Handheld",
};
const ZOOM = { min: 0.25, max: 2 };
type Tool = "move" | "hand" | "note";

/** A card being dragged to another place on the board. */
type CardDrag = { id: string; x: number; y: number; dx: number; dy: number; moved: boolean };
type Drop = { section: string; index: number };

export function Storyboard({
  edit,
  selected,
  readOnly,
  brandName,
  onSelect,
  onBoard,
  onEdit,
  onOpen,
}: {
  edit: VideoEdit;
  selected?: Selection;
  readOnly: boolean;
  brandName: string;
  onSelect: (s: Selection | undefined, seekTo?: "start") => void;
  onBoard: (on: boolean) => void;
  onEdit: (next: VideoEdit, key: string) => void;
  /** Back to the timeline with the shot picked. */
  onOpen: (clipId: string) => void;
}) {
  const board = boardOf(edit);
  const shots = placed(edit.clips);
  const at = new Map(shots.map((p) => [p.clip.id, p]));
  const canvas = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, zoom: 1 });
  const [tool, setTool] = useState<Tool>("move");
  const [space, setSpace] = useState(false);
  const [pan, setPan] = useState<{ x: number; y: number; vx: number; vy: number }>();
  const [drag, setDrag] = useState<CardDrag>();
  const [drop, setDrop] = useState<Drop>();
  const [note, setNoteDrag] = useState<{ id: string; x: number; y: number; nx: number; ny: number }>();
  const [renaming, setRenaming] = useState<string>();
  const [fresh, setFresh] = useState<string>();
  const fitted = useRef(false);
  const still = readOnly;
  const picked = selected?.kind === "shot" ? at.get(selected.id) : undefined;

  // Fit the board in the canvas: on opening, and on Fit (⇧1).
  const fit = () => {
    const c = canvas.current;
    const w = world.current;
    if (!c || !w) return;
    const pad = 48;
    const zoom = clamp(
      Math.min((c.clientWidth - pad * 2) / w.offsetWidth, (c.clientHeight - pad * 2 - 64) / w.offsetHeight),
      ZOOM.min,
      1,
    );
    setView({
      zoom,
      x: Math.round((c.clientWidth - w.offsetWidth * zoom) / 2),
      y: Math.round(Math.max(pad, (c.clientHeight - 64 - w.offsetHeight * zoom) / 2)),
    });
  };
  useLayoutEffect(() => {
    if (fitted.current) return;
    fitted.current = true;
    fit();
  });

  // Zoom around a point of the canvas (the pointer's, or its middle).
  const zoomTo = (z: number, cx?: number, cy?: number) => {
    const c = canvas.current;
    if (!c) return;
    const zoom = clamp(Math.round(z * 100) / 100, ZOOM.min, ZOOM.max);
    const r = c.getBoundingClientRect();
    const px = cx === undefined ? r.width / 2 : cx - r.left;
    const py = cy === undefined ? r.height / 2 : cy - r.top;
    setView((v) => ({
      zoom,
      x: Math.round(px - ((px - v.x) / v.zoom) * zoom),
      y: Math.round(py - ((py - v.y) / v.zoom) * zoom),
    }));
  };
  // The wheel pans; with ⌘ (or a pinch) it zooms around the pointer. A listener of its own, so the page never zooms.
  const wheel = useRef<(e: WheelEvent) => void>(() => {});
  wheel.current = (e: WheelEvent) => {
    e.preventDefault();
    if (e.metaKey || e.ctrlKey) zoomTo(view.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), e.clientX, e.clientY);
    else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
  };
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const on = (e: WheelEvent) => wheel.current(e);
    c.addEventListener("wheel", on, { passive: false });
    return () => c.removeEventListener("wheel", on);
  }, []);

  // Space held: the hand, while it is down (as in Figma).
  useEffect(() => {
    const typing = (e: globalThis.KeyboardEvent) =>
      (e.target as HTMLElement | null)?.closest("input, textarea, [contenteditable], [role=menu]");
    const down = (e: globalThis.KeyboardEvent) => {
      if (e.key === " " && !typing(e)) {
        e.preventDefault();
        setSpace(true);
      }
    };
    const up = (e: globalThis.KeyboardEvent) => e.key === " " && setSpace(false);
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    return () => {
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up, true);
    };
  }, []);
  const hand = tool === "hand" || space;

  // The board's own keys: V the pointer, H the hand, N a note, ⇧1 fit, − and + zoom, ⌥← ⌥→ move the picked card.
  const keys = (e: KeyboardEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest("input, textarea")) return;
    const k = e.key;
    if (e.altKey && picked && !still && (k === "ArrowLeft" || k === "ArrowRight")) {
      e.preventDefault();
      onEdit(nudgeShot(edit, picked.clip.id, k === "ArrowLeft" ? -1 : 1), `board-move-${picked.clip.id}`);
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (k === "v" || k === "V") setTool("move");
    else if (k === "h" || k === "H") setTool("hand");
    else if ((k === "n" || k === "N") && !still) setTool("note");
    else if (k === "!" || (e.shiftKey && k === "1")) fit();
    else if (k === "=" || k === "+") zoomTo(view.zoom * 1.25);
    else if (k === "-") zoomTo(view.zoom / 1.25);
    else return;
    e.preventDefault();
  };

  // The canvas: drag to pan with the hand; a click with the Note tool puts a note there; a click on nothing puts
  // the selection down.
  const canvasDown = (e: PointerEvent<HTMLDivElement>) => {
    const onNothing =
      e.target === e.currentTarget ||
      e.target === world.current ||
      (e.target as HTMLElement).dataset.empty !== undefined;
    if (hand || e.button === 1) {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setPan({ x: e.clientX, y: e.clientY, vx: view.x, vy: view.y });
      return;
    }
    if (!onNothing || e.button !== 0) return;
    if (tool === "note" && !still) {
      const r = canvas.current!.getBoundingClientRect();
      const n: StoryboardNote = {
        id: localId("nt"),
        text: "",
        x: Math.round((e.clientX - r.left - view.x) / view.zoom),
        y: Math.round((e.clientY - r.top - view.y) / view.zoom),
      };
      onEdit(addNote(edit, n), `note-${n.id}`);
      setFresh(n.id);
      setTool("move");
      return;
    }
    onSelect(undefined);
  };
  const canvasMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!pan || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    setView((v) => ({ ...v, x: pan.vx + e.clientX - pan.x, y: pan.vy + e.clientY - pan.y }));
  };

  // A card: press and drag to move it; a click picks it; a double-click opens it in the edit.
  const cardDown = (id: string) => (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || hand || still) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ id, x: e.clientX, y: e.clientY, dx: 0, dy: 0, moved: false });
  };
  const cardMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (!drag || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    setDrag({ ...drag, dx, dy, moved: true });
    setDrop(dropAt(e.clientX, e.clientY));
  };
  const cardUp = (id: string) => () => {
    const d = drag;
    const to = drop;
    setDrag(undefined);
    setDrop(undefined);
    if (!d?.moved) {
      const on = selected?.kind === "shot" && selected.id === id;
      onSelect(on ? undefined : { kind: "shot", id }, "start");
      return;
    }
    if (to) {
      onEdit(moveShot(edit, id, to.section, to.index), `board-move-${id}`);
      onSelect({ kind: "shot", id });
    }
  };

  // A note: drag its top to move it.
  const noteDown = (n: StoryboardNote) => (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || hand || still) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setNoteDrag({ id: n.id, x: e.clientX, y: e.clientY, nx: n.x, ny: n.y });
  };
  const noteMove = (e: PointerEvent<HTMLElement>) => {
    if (!note || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    // Drawn straight on the note while it moves; the board takes the place when she lets go.
    const el = e.currentTarget.closest<HTMLElement>(".ui-video-note");
    if (el) {
      el.style.setProperty("--nx", String(Math.round(note.nx + (e.clientX - note.x) / view.zoom)));
      el.style.setProperty("--ny", String(Math.round(note.ny + (e.clientY - note.y) / view.zoom)));
    }
  };
  const noteUp = (e: PointerEvent<HTMLElement>) => {
    const d = note;
    setNoteDrag(undefined);
    if (!d) return;
    const x = Math.round(d.nx + (e.clientX - d.x) / view.zoom);
    const y = Math.round(d.ny + (e.clientY - d.y) / view.zoom);
    if (x !== d.nx || y !== d.ny) onEdit(setNote(edit, d.id, { x, y }), `note-${d.id}-move`);
  };

  // What is on screen while a shot plays: the words over it, the captions.
  const onScreen = (start: number, end: number) =>
    [
      ...edit.motion.filter((m) => m.start < end && m.end > start).map((m) => m.text),
      ...edit.captions.filter((c) => c.start < end && c.end > start).map((c) => `“${c.text}”`),
    ].slice(0, 3);

  const length = shots.length ? shots[shots.length - 1]!.end : 0;
  return (
    <section
      className="ui-video-board"
      aria-label="Storyboard"
      data-tool={hand ? "hand" : tool}
      data-panning={pan ? "" : undefined}
      onKeyDown={keys}
    >
      <div className="ui-video-board-head">
        <Views board onBoard={onBoard} />
        <hgroup className="ui-video-board-title">
          <h2>Storyboard</h2>
          <p>
            {shots.length} {shots.length === 1 ? "shot" : "shots"} · {length.toFixed(1)} s · {board.sections.length}{" "}
            {board.sections.length === 1 ? "section" : "sections"}
          </p>
        </hgroup>
      </div>
      <div
        ref={canvas}
        className="ui-video-board-canvas"
        role="application"
        aria-label="The board: drag to move a card, the hand or space to pan, ⌘ and the wheel to zoom"
        // the board takes its keys (V, H, N, ⇧1)
        tabIndex={0}
        onPointerDown={canvasDown}
        onPointerMove={canvasMove}
        onPointerUp={() => setPan(undefined)}
        onPointerCancel={() => setPan(undefined)}
      >
        <div
          ref={world}
          className="ui-video-board-world"
          style={{ "--vx": `${view.x}px`, "--vy": `${view.y}px`, "--vz": view.zoom } as CSSProperties}
        >
          {board.sections.map((s, si) => (
            <section key={s.id} className="ui-video-section" aria-label={s.name} data-section={s.id}>
              <header className="ui-video-section-head">
                {renaming === s.id ? (
                  <input
                    className="ui-video-section-input"
                    aria-label="Section name"
                    defaultValue={s.name}
                    // she asked to rename it
                    autoFocus
                    onFocus={(e) => e.currentTarget.select()}
                    onBlur={(e) => {
                      const name = e.currentTarget.value.trim();
                      setRenaming(undefined);
                      if (name && name !== s.name) onEdit(renameSection(edit, s.id, name), `section-${s.id}-name`);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      if (e.key === "Escape") {
                        e.currentTarget.value = s.name;
                        e.currentTarget.blur();
                      }
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="ui-video-section-name"
                    aria-label={`${s.name}: double-click to rename`}
                    disabled={still}
                    onDoubleClick={() => setRenaming(s.id)}
                    onKeyDown={(e) => e.key === "Enter" && setRenaming(s.id)}
                  >
                    {s.name}
                  </button>
                )}
                <span className="ui-video-section-meta">
                  {s.clipIds.length} · {sectionSeconds(s.clipIds, at).toFixed(1)} s
                </span>
                {!still && board.sections.length > 1 && (
                  <WithTooltip label={`Take out ${s.name}: its shots join ${si === 0 ? "the next" : "the one before"}`}>
                    <Button
                      size="sm"
                      variant="quiet"
                      iconOnly
                      icon="x"
                      aria-label={`Take out the section ${s.name}`}
                      onClick={() => onEdit(removeSection(edit, s.id), `section-${s.id}-remove`)}
                    />
                  </WithTooltip>
                )}
              </header>
              <ol className="ui-video-section-cards" data-drop-section={s.id}>
                {s.clipIds.map((id, i) => {
                  const p = at.get(id);
                  if (!p) return null;
                  const { clip, index, start, end } = p;
                  const take = pickedTake(clip);
                  const poster = take?.poster ?? clip.recipe?.startImage;
                  const on = selected?.kind === "shot" && selected.id === clip.id;
                  const stack = Math.min(2, Math.max(0, clip.takes.length - 1));
                  const flagged = openFindings(clip).length > 0;
                  const from = clip.source === "library" ? `Upload · ${brandName}’s footage` : takeWords(clip);
                  const words = onScreen(start, end);
                  const d = drag?.moved && drag.id === id ? drag : undefined;
                  return (
                    <li
                      key={id}
                      data-slot={id}
                      data-section={s.id}
                      data-index={i}
                      data-drop={
                        drop?.section === s.id && drop.index === i
                          ? "before"
                          : drop?.section === s.id && drop.index === i + 1 && i === s.clipIds.length - 1
                            ? "after"
                            : undefined
                      }
                    >
                      <button
                        type="button"
                        className="ui-video-card"
                        aria-pressed={on}
                        aria-label={`Shot ${index + 1}, ${clip.name}. ${from}. ${(end - start).toFixed(1)} s.`}
                        data-dragging={d ? "" : undefined}
                        style={
                          d
                            ? ({ "--dx": `${d.dx / view.zoom}px`, "--dy": `${d.dy / view.zoom}px` } as CSSProperties)
                            : undefined
                        }
                        onPointerDown={cardDown(id)}
                        onPointerMove={cardMove}
                        onPointerUp={cardUp(id)}
                        onPointerCancel={() => {
                          setDrag(undefined);
                          setDrop(undefined);
                        }}
                        onDoubleClick={() => onOpen(id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onSelect(on ? undefined : { kind: "shot", id }, "start");
                          }
                        }}
                      >
                        <span
                          className="ui-video-card-img"
                          style={{ "--stack": stack } as CSSProperties}
                          aria-hidden="true"
                        >
                          {clip.takes
                            .filter((k) => k.id !== take?.id && k.poster)
                            .slice(0, 2)
                            .map((k, j) => (
                              <img key={k.id} src={k.poster} alt="" draggable={false} data-behind={j + 1} />
                            ))}
                          {poster && <img src={poster} alt="" draggable={false} />}
                        </span>
                        <span className="ui-video-card-text">
                          <span className="ui-video-card-name">
                            <span className="ui-video-card-no">{index + 1}</span>
                            {clip.name}
                          </span>
                          <span className="ui-video-card-from">{from}</span>
                          <span className="ui-video-card-chips">
                            <span className="ui-badge ui-badge--secondary">{(end - start).toFixed(1)} s</span>
                            {clip.recipe && (
                              <span className="ui-badge ui-badge--secondary">{MOVE[clip.recipe.move]}</span>
                            )}
                            {clip.takes.length > 1 && (
                              <span className="ui-badge ui-badge--secondary">{clip.takes.length} takes</span>
                            )}
                            {flagged && (
                              <span className="ui-video-card-flag">
                                <Icon name="triangle-alert" />
                                Flagged
                              </span>
                            )}
                          </span>
                          {words.length > 0 && (
                            <span className="ui-video-card-words">
                              {words.map((w) => (
                                <span key={w}>{w}</span>
                              ))}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
                {!s.clipIds.length && (
                  <li
                    className="ui-video-section-empty"
                    data-slot=""
                    data-section={s.id}
                    data-index={0}
                    data-empty=""
                    data-drop={drop?.section === s.id ? "before" : undefined}
                  >
                    Drag shots here
                  </li>
                )}
                {si === board.sections.length - 1 && (
                  <li className="ui-video-card-add" data-empty="">
                    <Icon name="plus" />
                    <span>
                      Add a shot from a master or an upload in the library, or ask the Engine to plan the cards first.
                      It makes the takes once you agree.
                    </span>
                  </li>
                )}
              </ol>
            </section>
          ))}
          {board.notes.map((n) => (
            <div
              key={n.id}
              className="ui-video-note"
              data-moving={note?.id === n.id ? "" : undefined}
              style={{ "--nx": n.x, "--ny": n.y } as CSSProperties}
            >
              <span
                className="ui-video-note-grip"
                aria-hidden="true"
                onPointerDown={noteDown(n)}
                onPointerMove={noteMove}
                onPointerUp={noteUp}
              />
              <textarea
                className="ui-video-note-text"
                aria-label="Note"
                placeholder="A note on the board"
                defaultValue={n.text}
                readOnly={still}
                // she just put the note down to write on it
                autoFocus={fresh === n.id}
                onBlur={(e) => {
                  const text = e.currentTarget.value;
                  if (fresh === n.id) setFresh(undefined);
                  if (text !== n.text) onEdit(setNote(edit, n.id, { text }), `note-${n.id}-text`);
                }}
              />
              {!still && (
                <button
                  type="button"
                  className="ui-video-note-x"
                  aria-label="Take the note away"
                  onClick={() => onEdit(removeNote(edit, n.id), `note-${n.id}-remove`)}
                >
                  <Icon name="x" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {picked && (
        <Glass className="ui-video-board-picked" role="toolbar" aria-label={`Shot ${picked.index + 1}`}>
          <span className="ui-video-board-picked-name">
            <span className="ui-video-card-no">{picked.index + 1}</span>
            {picked.clip.name}
          </span>
          {!still && (
            <>
              <WithTooltip label="Earlier" shortcut="⌥←">
                <Button
                  size="sm"
                  variant="glass-clear"
                  iconOnly
                  icon="arrow-left"
                  aria-label="Earlier"
                  disabled={picked.index === 0}
                  onClick={() => onEdit(nudgeShot(edit, picked.clip.id, -1), `board-move-${picked.clip.id}`)}
                />
              </WithTooltip>
              <WithTooltip label="Later" shortcut="⌥→">
                <Button
                  size="sm"
                  variant="glass-clear"
                  iconOnly
                  icon="arrow-right"
                  aria-label="Later"
                  disabled={picked.index === shots.length - 1}
                  onClick={() => onEdit(nudgeShot(edit, picked.clip.id, 1), `board-move-${picked.clip.id}`)}
                />
              </WithTooltip>
            </>
          )}
          <Button size="sm" variant="glass-white" iconEnd="arrow-right" onClick={() => onOpen(picked.clip.id)}>
            Open in the edit
          </Button>
        </Glass>
      )}

      <Glass className="ui-video-board-tools" role="toolbar" aria-label="Board tools">
        <BoardTool
          icon="mouse-pointer-2"
          label="Pointer"
          shortcut="V"
          pressed={tool === "move" && !space}
          onPress={() => setTool("move")}
        />
        <BoardTool icon="hand" label="Hand" shortcut="H" pressed={hand} onPress={() => setTool("hand")} />
        {!still && (
          <>
            <BoardTool
              icon="sticky-note"
              label="Note"
              shortcut="N"
              pressed={tool === "note"}
              onPress={() => setTool("note")}
            />
            <WithTooltip label="Add a section">
              <Button
                size="sm"
                variant="glass-clear"
                icon="plus"
                onClick={() => {
                  const id = localId("sb");
                  onEdit(addSection(edit, id), `section-${id}`);
                  setRenaming(id);
                }}
              >
                Section
              </Button>
            </WithTooltip>
          </>
        )}
        <span className="ui-video-board-tools-gap" aria-hidden="true" />
        <Button
          size="sm"
          variant="glass-clear"
          iconOnly
          icon="zoom-out"
          aria-label="Zoom out"
          disabled={view.zoom <= ZOOM.min}
          onClick={() => zoomTo(view.zoom / 1.25)}
        />
        <span className="ui-video-board-zoom" aria-live="polite">
          {Math.round(view.zoom * 100)} %
        </span>
        <Button
          size="sm"
          variant="glass-clear"
          iconOnly
          icon="zoom-in"
          aria-label="Zoom in"
          disabled={view.zoom >= ZOOM.max}
          onClick={() => zoomTo(view.zoom * 1.25)}
        />
        <WithTooltip label="Fit the board" shortcut="⇧1">
          <Button size="sm" variant="glass-clear" onClick={fit}>
            Fit
          </Button>
        </WithTooltip>
      </Glass>
    </section>
  );
}

function BoardTool({
  icon,
  label,
  shortcut,
  pressed,
  onPress,
}: {
  icon: IconName;
  label: string;
  shortcut: string;
  pressed: boolean;
  onPress: () => void;
}) {
  return (
    <WithTooltip label={label} shortcut={shortcut}>
      <Toggle
        size="sm"
        iconOnly
        icon={icon}
        className="ui-video-board-tool"
        aria-label={label}
        pressed={pressed}
        onPressedChange={onPress}
      />
    </WithTooltip>
  );
}

/** Where a dragged card would land: before the card under the pointer (after it, past its middle), or in an empty
 *  section. */
function dropAt(x: number, y: number): Drop | undefined {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  const slot = el?.closest<HTMLElement>("[data-slot]");
  if (slot?.dataset.section) {
    const r = slot.getBoundingClientRect();
    const i = Number(slot.dataset.index ?? 0);
    return {
      section: slot.dataset.section,
      index: slot.dataset.empty !== undefined ? 0 : x > r.left + r.width / 2 ? i + 1 : i,
    };
  }
  const list = el?.closest<HTMLElement>("[data-drop-section]");
  if (list?.dataset.dropSection)
    return { section: list.dataset.dropSection, index: list.querySelectorAll("[data-slot]:not([data-empty])").length };
  return undefined;
}

function sectionSeconds(ids: string[], at: Map<string, { start: number; end: number }>) {
  return ids.reduce((sum, id) => {
    const p = at.get(id);
    return sum + (p ? p.end - p.start : 0);
  }, 0);
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
