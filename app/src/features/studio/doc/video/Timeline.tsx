// The timeline (FLOWS §27.3): the whole width under the panels, as in the agency concept. A ruler in seconds with the
// music's beats and the Engine's flags on it (a Rouge dot that jumps to the moment), then the tracks. Click or drag
// the ruler to move the playhead; click a track's empty part to go there; click an item to select it. A selected shot
// has handles at both ends: drag to trim (the shots after it move up), with the arrow keys a tenth at a time. A trimmed
// end that lands near a beat snaps to it.
// Round 14 (FLOWS §34.6): a layer that follows a shot moves with it and carries a small link; a layer's keyframes are
// diamonds on its item; in Motion mode each layer has its own track, as in After Effects; a 3D track shows only behind
// the 3d flag (?flags=3d).
// Round 16 (PROPOSED 9 Nov 2026), Marcus: "Hvor mange spor kan man ha? Kan man zoome inn og ut horisontalt og
// vertikalt? Kan man markere time stamps? Kan man lage flere lydspor? Kan man putte flere videoer over hverandre?
// Hvorfor er captions under Main? Tidslinjen sin høyde burde representere hva som er over hverandre, som layers."
// The tracks lie top to bottom as they lie in the frame (tracks.ts): the brand's components, the captions and the
// text over the video, a video track over Main for a clip over the shots, then the audio tracks under a gap. As many
// as she wants: + Track adds a video, text or audio track. Each track's head has its name (double-click to rename),
// its eye and lock (a visual track) or mute and solo (an audio track), and a grip: drag it up or down and the frame's
// order follows. Items drag along their track and onto another of their kind. The view zooms across (the slider, ⌘
// with the wheel, = and −, \ to fit) and in height (S, M, L). Markers: M at the playhead, named, on the ruler; ⇧M and
// ⌘⇧M go to the next and the one before.
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  Button,
  Icon,
  SegmentedControl,
  SegmentedOption,
  StudioSlider,
  Toggle,
  WithTooltip,
  type IconName,
} from "@fume/ui";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import type { EditCheck, MotionLayer, VideoClip, VideoEdit, VideoTrack } from "../../../../contract";
import { MIN_SHOT, editLength, nearestBeat, pickedTake, placed, timecode } from "../../../../domain/video";
import { MOTION, flagOn, localId, openFindings, wavePath, type Selection } from "./edit";
import {
  ICON_HIDDEN,
  ICON_UNLOCKED,
  MAIN,
  TRACK_ICON,
  addTrack,
  captionTrack,
  fits,
  freeAt,
  isAudio,
  motionTrack,
  moveTrack,
  onTrack,
  overlayEnd,
  removeTrack,
  soundTrack,
  tracksOf,
  withTrack,
} from "./tracks";

const SNAP = 0.12;
/** How far the view zooms across: 1 fits the film to the width. */
export const ZOOM = { min: 1, max: 12 };
/** Track heights, S M L. */
const HEIGHT = { s: 0.75, m: 1, l: 1.6 } as const;
export type TrackHeight = keyof typeof HEIGHT;

/** One row of the timeline: a track, or in Motion mode a layer on its own row. */
type Row = { track: VideoTrack; layer?: MotionLayer };

/** A thing being dragged along its track (or onto another): what it is, where it started, how far it went. */
type Drag = {
  sel: Selection;
  x: number;
  start: number;
  end: number;
  trackId?: string;
  dt: number;
  to?: string;
  moved: boolean;
};

export function Timeline({
  edit,
  t,
  selected,
  readOnly,
  proposed,
  motionMode,
  onSelect,
  onSeek,
  onTrim,
  onFlag,
  onBoard,
  onEdit,
}: {
  edit: VideoEdit;
  t: number;
  selected?: Selection;
  readOnly: boolean;
  /** The Engine's ask is shown on the timeline until she keeps or undoes it; nothing else moves meanwhile. */
  proposed: boolean;
  /** Motion mode: a track for each layer. */
  motionMode?: boolean;
  onSelect: (s: Selection | undefined) => void;
  onSeek: (t: number) => void;
  onTrim: (clipId: string, change: Pick<VideoClip, "in" | "out">, key: string) => void;
  onFlag: (check: EditCheck) => void;
  onBoard: (on: boolean) => void;
  onEdit: (next: VideoEdit, key: string) => void;
}) {
  const overlays = edit.overlays ?? [];
  const markers = [...(edit.markers ?? [])].sort((a, b) => a.at - b.at);
  const length = Math.max(
    editLength(edit),
    ...edit.sound.map((s) => s.end),
    ...overlays.map(overlayEnd),
    ...markers.map((m) => m.at + 0.5),
    1,
  );
  const ruler = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const shots = placed(edit.clips);
  const beats = edit.sound.find((s) => s.kind === "music")?.beats?.filter((b) => b <= length) ?? [];
  const flags = edit.checks.filter((c) => c.state === "flag" && c.at !== undefined);
  const still = readOnly || proposed;
  const tracks = tracksOf(edit);
  const [zoom, setZoomState] = useState(1);
  const [height, setHeight] = useState<TrackHeight>("m");
  const [renaming, setRenaming] = useState<string>();
  const [drag, setDrag] = useState<Drag>();
  const [grab, setGrab] = useState<{ id: string; y: number; to: number }>();
  // Where the view should stand after a zoom: a moment kept under the same spot of the scroller.
  const anchor = useRef<{ time: number; px: number }>();

  // The ruler's ticks: a step that leaves room between them at this zoom.
  const step = niceStep(length / (zoom * 7));
  const ticks = Array.from(
    { length: Math.floor(length / step + 1e-6) + 1 },
    (_, i) => Math.round(i * step * 100) / 100,
  );

  const timeAt = (clientX: number) => {
    const r = ruler.current?.getBoundingClientRect();
    if (!r) return 0;
    return Math.min(length, Math.max(0, ((clientX - r.left) / r.width) * length));
  };
  const secondsPerPx = () => length / Math.max(1, ruler.current?.getBoundingClientRect().width ?? 1);

  // Zoom across, keeping a moment where it is (the pointer's, or the playhead's).
  const setZoom = (z: number, at?: { time: number; clientX: number }) => {
    const next = Math.min(ZOOM.max, Math.max(ZOOM.min, Math.round(z * 100) / 100));
    const box = scroller.current?.getBoundingClientRect();
    const r = ruler.current?.getBoundingClientRect();
    if (box && r) {
      const time = at?.time ?? t;
      const clientX = at?.clientX ?? r.left + (time / length) * r.width;
      anchor.current = { time, px: clientX - box.left };
    }
    setZoomState(next);
  };
  useLayoutEffect(() => {
    const a = anchor.current;
    const el = scroller.current;
    const r = ruler.current?.getBoundingClientRect();
    if (!a || !el || !r) return;
    anchor.current = undefined;
    const box = el.getBoundingClientRect();
    const x = r.left - box.left + el.scrollLeft + (a.time / length) * r.width;
    el.scrollLeft = Math.max(0, x - a.px);
  }, [zoom, length]);

  // ⌘ (or Ctrl, or a pinch) and the wheel zoom across around the pointer. A listener of its own, so the page never
  // zooms; the plain wheel scrolls the tracks as it would.
  const wheel = useRef<(e: WheelEvent) => void>(() => {});
  wheel.current = (e: WheelEvent) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    e.preventDefault();
    setZoom(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), { time: timeAt(e.clientX), clientX: e.clientX });
  };
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const on = (e: WheelEvent) => wheel.current(e);
    el.addEventListener("wheel", on, { passive: false });
    return () => el.removeEventListener("wheel", on);
  }, []);
  const keys = (e: KeyboardEvent<HTMLElement>) => {
    const el = e.target as HTMLElement;
    if (el.closest("input, textarea, [role=menu]") || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "=" || e.key === "+") setZoom(zoom * 1.5);
    else if (e.key === "-") setZoom(zoom / 1.5);
    else if (e.key === "\\") setZoom(1);
    else return;
    e.preventDefault();
  };

  // The ruler: press and drag to move the playhead.
  const scrub = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    onSeek(timeAt(e.clientX));
  };
  const scrubMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) onSeek(timeAt(e.clientX));
  };
  const scrubKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const by = e.shiftKey ? 1 : 0.1;
    const to =
      e.key === "ArrowRight"
        ? t + by
        : e.key === "ArrowLeft"
          ? t - by
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? length
              : undefined;
    if (to === undefined) return;
    e.preventDefault();
    onSeek(Math.min(length, Math.max(0, to)));
  };

  const isPicked = (s: Selection) => selected?.kind === s.kind && selected.id === s.id;
  const pick = (s: Selection, start: number, end: number) => {
    if (isPicked(s)) return onSelect(undefined);
    onSelect(s);
    // Past the way in (a dissolve, a focus pull), so the frame shown is the shot itself.
    if (t < start || t >= end) onSeek(start + Math.min(0.75, (end - start) / 2));
  };

  // ── Dragging an item along its track, or onto another of its kind ──
  const trackOfSel = (s: Selection) =>
    s.kind === "motion"
      ? motionTrack(edit.motion.find((m) => m.id === s.id)!)
      : s.kind === "caption"
        ? captionTrack(edit.captions.find((c) => c.id === s.id)!)
        : s.kind === "sound"
          ? soundTrack(edit.sound.find((x) => x.id === s.id)!)
          : s.kind === "overlay"
            ? overlays.find((o) => o.id === s.id)?.trackId
            : undefined;
  const lockedTrack = (id?: string) => Boolean(id && tracks.find((k) => k.id === id)?.locked);
  const down = (s: Selection, start: number, end: number) => (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || still || s.kind === "shot") return;
    const trackId = trackOfSel(s);
    if (lockedTrack(trackId)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ sel: s, x: e.clientX, start, end, trackId, dt: 0, moved: false });
  };
  // Points a moved item's ends snap to: the playhead, the markers, the shots' cuts, the beats, the other items' ends.
  const snaps = () => [
    t,
    ...markers.map((m) => m.at),
    ...shots.flatMap((p) => [p.start, p.end]),
    ...beats,
    ...edit.motion.flatMap((m) => [m.start, m.end]),
    ...edit.captions.flatMap((c) => [c.start, c.end]),
  ];
  const move = (e: PointerEvent<HTMLElement>) => {
    if (!drag || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const px = e.clientX - drag.x;
    if (!drag.moved && Math.abs(px) < 4 && !e.altKey) {
      // Not a drag yet; a move to another track counts once the pointer is over one.
      const over = trackUnder(e.clientX, e.clientY);
      if (!over || over === drag.trackId) return;
    }
    let dt = px * secondsPerPx();
    const dur = drag.end - drag.start;
    dt = Math.max(-drag.start, dt);
    if (drag.sel.kind !== "marker") {
      // Snap either end to a point within a few pixels.
      const reach = 6 * secondsPerPx();
      let best: number | undefined;
      for (const p of snaps()) {
        for (const edge of [drag.start + dt, drag.start + dt + dur]) {
          const d = p - edge;
          if (Math.abs(d) < reach && (best === undefined || Math.abs(d) < Math.abs(best))) best = d;
        }
      }
      if (best !== undefined) dt += best;
    }
    const over = trackUnder(e.clientX, e.clientY);
    const kind = drag.sel.kind;
    const to =
      over && kind !== "marker" && over !== drag.trackId && !lockedTrack(over)
        ? fits(tracks.find((k) => k.id === over)!.kind, kind as "motion" | "caption" | "sound" | "overlay", over)
          ? over
          : drag.to
        : drag.to;
    // Things on one track never overlap: it stops against what is in the way, or keeps its last place when there is
    // no room near.
    const on = to ?? drag.trackId;
    if (kind !== "marker" && on) {
      const place = freeAt(edit, on, Math.round((drag.start + dt) * 10) / 10, dur, drag.sel.id);
      if (place === undefined) return;
      dt = place - drag.start;
    }
    setDrag({ ...drag, dt: Math.round(dt * 10) / 10, to, moved: true });
  };
  const up = () => {
    const d = drag;
    setDrag(undefined);
    if (!d) return;
    if (!d.moved) {
      const item = d.sel;
      if (item.kind === "marker") {
        onSelect(isPicked(item) ? undefined : item);
        onSeek(d.start);
      } else pick(item, d.start, d.end);
      return;
    }
    const dt = d.dt;
    const to = d.to ?? d.trackId;
    const at = (n: number) => Math.round(Math.max(0, n + dt) * 10) / 10;
    let next = edit;
    if (d.sel.kind === "motion") {
      const m = edit.motion.find((x) => x.id === d.sel.id)!;
      // A layer moved onto another shot follows that one.
      const startAt = at(m.start);
      const shot = shots.find((p) => startAt >= p.start && startAt < p.end);
      next = {
        ...edit,
        motion: edit.motion.map((x) =>
          x.id === m.id
            ? {
                ...x,
                start: startAt,
                end: at(m.end),
                trackId: to,
                clipId: x.clipId ? (shot?.clip.id ?? x.clipId) : undefined,
              }
            : x,
        ),
      };
    } else if (d.sel.kind === "caption")
      next = {
        ...edit,
        captions: edit.captions.map((c) =>
          c.id === d.sel.id ? { ...c, start: at(c.start), end: at(c.end), trackId: to } : c,
        ),
      };
    else if (d.sel.kind === "sound")
      next = {
        ...edit,
        sound: edit.sound.map((s) =>
          s.id === d.sel.id ? { ...s, start: at(s.start), end: at(s.end), trackId: to } : s,
        ),
      };
    else if (d.sel.kind === "overlay")
      next = {
        ...edit,
        overlays: overlays.map((o) => (o.id === d.sel.id ? { ...o, start: at(o.start), trackId: to ?? o.trackId } : o)),
      };
    else if (d.sel.kind === "marker")
      next = { ...edit, markers: markers.map((m) => (m.id === d.sel.id ? { ...m, at: at(m.at) } : m)) };
    onEdit(next, `move-${d.sel.id}`);
    if (d.sel.kind !== "marker") onSelect(d.sel);
  };
  const dragged = (s: Selection) =>
    drag?.moved && drag.sel.kind === s.kind && drag.sel.id === s.id ? drag : undefined;

  const item = (s: Selection, start: number, end: number, label: string) => {
    const d = dragged(s);
    return {
      type: "button" as const,
      className: "ui-video-item",
      "data-kind": s.kind,
      "data-dragging": d ? "" : undefined,
      "aria-pressed": isPicked(s),
      "aria-label": `${label}, ${timecode(start, true)} to ${timecode(end, true)}`,
      disabled: still,
      // Shots are picked with a click (their ends trim); everything else is picked or dragged.
      ...(s.kind === "shot"
        ? { onClick: () => pick(s, start, end) }
        : {
            onPointerDown: down(s, start, end),
            onPointerMove: move,
            onPointerUp: up,
            onPointerCancel: () => setDrag(undefined),
            onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                pick(s, start, end);
              }
            },
          }),
    };
  };
  const at = (start: number, end: number, extra: Record<string, string | number> = {}, s?: Selection) => {
    const d = s ? dragged(s) : undefined;
    return {
      "--start": start + (d?.dt ?? 0),
      "--dur": Math.max(0.05, end - start),
      ...extra,
    } as CSSProperties;
  };
  // A click on a track's empty part moves the playhead there.
  const laneClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onSeek(timeAt(e.clientX));
      onSelect(undefined);
    }
  };

  const sel = selected?.kind === "shot" ? shots.find((s) => s.clip.id === selected.id) : undefined;
  const shotNo = new Map(shots.map((s) => [s.clip.id, s.index + 1]));

  // The rows, top to bottom. In Motion mode the words' tracks open into a row per layer, as in After Effects.
  const rows: Row[] = tracks.flatMap((k) =>
    motionMode && (k.kind === "text" || k.kind === "brand")
      ? edit.motion.filter((m) => motionTrack(m) === k.id).map((m) => ({ track: k, layer: m }))
      : motionMode && k.kind === "captions"
        ? []
        : [{ track: k }],
  );
  if (flagOn("3d")) rows.push({ track: { id: "t-3d", kind: "video", name: "3D" } });
  const firstAudio = rows.findIndex((r) => isAudio(r.track));
  const rowHeight = (r: Row) =>
    r.track.kind === "video" ? "var(--lane-shot)" : r.track.kind === "audio" ? "var(--lane-md)" : "var(--lane-sm)";
  const template = [
    "var(--lane-ruler)",
    ...rows.flatMap((r, i) => (i === firstAudio && i > 0 ? ["var(--lane-gap)", rowHeight(r)] : [rowHeight(r)])),
  ].join(" ");

  const layerItems = (layers: MotionLayer[]) =>
    layers.map((m) => {
      const dur = Math.max(0.1, m.end - m.start);
      const keysAt = [...new Set((m.keys ?? []).map((k) => k.at))]
        .filter((k) => k >= 0 && k <= dur)
        .sort((a, b) => a - b);
      const follows = m.clipId ? shotNo.get(m.clipId) : undefined;
      const s: Selection = { kind: "motion", id: m.id };
      return (
        <button
          key={m.id}
          {...item(s, m.start, m.end, `${m.text}${follows ? `, follows shot ${follows}` : ""}`)}
          data-template={m.template}
          data-keys={keysAt.length ? "" : undefined}
          style={at(m.start, m.end, {}, s)}
        >
          {follows && <Icon name="link" className="ui-video-item-link" />}
          {m.animate && <Icon name="type" className="ui-video-item-link" />}
          <span>{m.text}</span>
          {keysAt.map((k) => (
            <i key={k} className="ui-video-key" style={{ "--k": k / dur } as CSSProperties} aria-hidden="true" />
          ))}
        </button>
      );
    });

  const lane = (r: Row): ReactNode => {
    const k = r.track;
    if (r.layer) return layerItems([r.layer]);
    if (k.id === "t-3d")
      return <span className="ui-video-lane-note">The product’s 3D model with a camera move. Behind a flag.</span>;
    if (k.id === MAIN)
      return (
        <>
          {shots.map(({ clip, index, start, end }) => {
            const take = pickedTake(clip);
            const poster = take?.poster ?? clip.recipe?.startImage;
            const flagged = openFindings(clip).length > 0;
            return (
              <button
                key={clip.id}
                {...item({ kind: "shot", id: clip.id }, start, end, `Shot ${index + 1}, ${clip.name}`)}
                data-making={!take ? "" : undefined}
                style={at(start, end, poster ? { "--poster": `url("${poster}")` } : {})}
              >
                <span>
                  {index + 1} · {clip.name}
                </span>
                {flagged && <span className="ui-video-item-flag" aria-label="The Engine flagged this shot" />}
              </button>
            );
          })}
          {sel && !still && !k.locked && (
            <>
              <TrimHandle
                end="in"
                clip={sel.clip}
                start={sel.start}
                dur={sel.end - sel.start}
                {...{ timeAt, onTrim }}
              />
              <TrimHandle
                end="out"
                clip={sel.clip}
                start={sel.start}
                dur={sel.end - sel.start}
                beats={beats}
                {...{ timeAt, onTrim }}
              />
            </>
          )}
        </>
      );
    if (k.kind === "video")
      return overlays
        .filter((o) => o.trackId === k.id)
        .map((o) => {
          const take = o.takes.find((x) => x.id === o.pickedTakeId) ?? o.takes[0];
          const s: Selection = { kind: "overlay", id: o.id };
          return (
            <button
              key={o.id}
              {...item(s, o.start, overlayEnd(o), `${o.name}, over the video`)}
              data-over=""
              style={at(o.start, overlayEnd(o), take?.poster ? { "--poster": `url("${take.poster}")` } : {}, s)}
            >
              <span>{o.name}</span>
            </button>
          );
        });
    if (k.kind === "captions")
      return edit.captions
        .filter((c) => captionTrack(c) === k.id)
        .map((c) => {
          const s: Selection = { kind: "caption", id: c.id };
          return (
            <button key={c.id} {...item(s, c.start, c.end, c.text)} style={at(c.start, c.end, {}, s)}>
              <span>{c.text}</span>
            </button>
          );
        });
    if (k.kind === "audio")
      return edit.sound
        .filter((x) => soundTrack(x) === k.id)
        .map((x) => {
          const s: Selection = { kind: "sound", id: x.id };
          return (
            <button
              key={x.id}
              {...item(s, x.start, x.end, x.name)}
              data-sound={x.kind}
              title={x.kind === "music" ? undefined : x.name}
              style={at(x.start, x.end, {}, s)}
            >
              <svg className="ui-video-wave" viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden="true">
                <path d={wavePath(x.name, Math.max(8, Math.round((x.end - x.start) * 16)))} fill="currentColor" />
              </svg>
              <span>{x.name}</span>
            </button>
          );
        });
    return layerItems(edit.motion.filter((m) => motionTrack(m) === k.id));
  };

  // ── Track heads ──
  const visualCount = tracks.filter((k) => !isAudio(k)).length;
  const groupIndex = (k: VideoTrack) => tracks.filter((x) => isAudio(x) === isAudio(k)).indexOf(k);
  const groupSize = (k: VideoTrack) => (isAudio(k) ? tracks.length - visualCount : visualCount);
  const setTrack = (id: string, change: Partial<VideoTrack>, key: string) =>
    onEdit(withTrack(edit, id, change), `track-${id}-${key}`);
  const reorder = (k: VideoTrack, to: number) => onEdit(moveTrack(edit, k.id, to), `track-${k.id}-order`);
  // The grip: drag a head up or down among its own; the drop line shows where it lands.
  const grip = {
    down: (k: VideoTrack) => (e: PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0 || still) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      setGrab({ id: k.id, y: e.clientY, to: groupIndex(k) });
    },
    move: (k: VideoTrack) => (e: PointerEvent<HTMLButtonElement>) => {
      if (!grab || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
      // Its new place among its own: as many of the others as lie above the pointer.
      const others = [...(scroller.current?.querySelectorAll<HTMLElement>(".ui-video-track[data-id]") ?? [])].filter(
        (h) => h.dataset.id !== k.id && (h.dataset.audio !== undefined) === isAudio(k),
      );
      const to = others.filter((h) => {
        const r = h.getBoundingClientRect();
        return r.top + r.height / 2 < e.clientY;
      }).length;
      if (to !== grab.to) setGrab({ ...grab, to });
    },
    up: (k: VideoTrack) => () => {
      const g = grab;
      setGrab(undefined);
      if (g && g.to !== groupIndex(k)) reorder(k, g.to);
    },
  };

  // The line that shows where a dragged track lands: over the track it goes before, or under the last.
  const dropLine = (k: VideoTrack): "above" | "below" | undefined => {
    const g = grab && tracks.find((x) => x.id === grab.id);
    if (!g || g.id === k.id || isAudio(g) !== isAudio(k)) return undefined;
    const others = tracks.filter((x) => isAudio(x) === isAudio(g) && x.id !== g.id);
    if (grab.to === groupIndex(g)) return undefined;
    if (others[grab.to]?.id === k.id) return "above";
    return grab.to === others.length && others[others.length - 1]?.id === k.id ? "below" : undefined;
  };

  const head = (r: Row, i: number) => {
    const k = r.track;
    if (r.layer)
      return (
        <div key={`h-${r.layer.id}`} className="ui-video-track" data-kind={k.kind} style={{ gridRow: rowOf(i) }}>
          <span className="ui-video-track-name" data-static="">
            <Icon name="type" />
            <span>{r.layer.template === "cta" ? "CTA" : MOTION[r.layer.template].name}</span>
          </span>
        </div>
      );
    if (k.id === "t-3d")
      return (
        <div key="h-3d" className="ui-video-track" data-kind="video" style={{ gridRow: rowOf(i) }}>
          <span className="ui-video-track-name" data-static="">
            <Icon name="package" />
            <span>3D</span>
          </span>
        </div>
      );
    const audio = isAudio(k);
    const picked = selected?.kind === "track" && selected.id === k.id;
    const gi = groupIndex(k);
    const n = groupSize(k);
    return (
      <div
        key={`h-${k.id}`}
        className="ui-video-track"
        data-kind={k.kind}
        data-audio={audio ? "" : undefined}
        data-hidden={k.hidden ? "" : undefined}
        data-muted={k.muted ? "" : undefined}
        data-grabbed={grab?.id === k.id ? "" : undefined}
        data-id={k.id}
        data-drop={dropLine(k)}
        style={{ gridRow: rowOf(i) }}
      >
        {!still && (
          <button
            type="button"
            className="ui-video-track-grip"
            aria-label={`Move the ${k.name} track: drag it up or down, or Alt and the arrow keys`}
            title="Drag to move the track"
            onPointerDown={grip.down(k)}
            onPointerMove={grip.move(k)}
            onPointerUp={grip.up(k)}
            onPointerCancel={() => setGrab(undefined)}
            onKeyDown={(e) => {
              if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
              e.preventDefault();
              reorder(k, gi + (e.key === "ArrowUp" ? -1 : 1));
            }}
          >
            <Icon name="grip-vertical" />
          </button>
        )}
        {renaming === k.id ? (
          <input
            className="ui-video-track-input"
            aria-label="Track name"
            defaultValue={k.name}
            // she asked to rename it; the field is where she types
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            onBlur={(e) => {
              const name = e.currentTarget.value.trim();
              setRenaming(undefined);
              if (name && name !== k.name) setTrack(k.id, { name }, "name");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                e.currentTarget.value = k.name;
                e.currentTarget.blur();
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="ui-video-track-name"
            aria-pressed={picked}
            aria-label={`${k.name} track${k.hidden ? ", hidden" : ""}${k.locked ? ", locked" : ""}${k.muted ? ", muted" : ""}${k.solo ? ", solo" : ""}. Double-click to rename.`}
            onClick={() => onSelect(picked ? undefined : { kind: "track", id: k.id })}
            onDoubleClick={() => !still && setRenaming(k.id)}
          >
            <Icon name={TRACK_ICON[k.kind] as IconName} />
            <span>{k.name}</span>
          </button>
        )}
        <span className="ui-video-track-tools">
          {audio ? (
            <>
              <TrackButton
                icon={k.muted ? "volume-x" : "volume-2"}
                label={k.muted ? `Hear ${k.name}` : `Mute ${k.name}`}
                pressed={Boolean(k.muted)}
                disabled={still}
                onClick={() => setTrack(k.id, { muted: !k.muted }, "mute")}
              />
              <TrackButton
                text="S"
                label={k.solo ? `${k.name} is solo: hear every track` : `Hear only ${k.name} (solo)`}
                pressed={Boolean(k.solo)}
                disabled={still}
                onClick={() => setTrack(k.id, { solo: !k.solo }, "solo")}
              />
            </>
          ) : (
            <>
              <TrackButton
                icon={k.hidden ? ICON_HIDDEN : "eye"}
                label={k.hidden ? `Show ${k.name}` : `Hide ${k.name}`}
                pressed={Boolean(k.hidden)}
                off={Boolean(k.hidden)}
                disabled={still}
                onClick={() => setTrack(k.id, { hidden: !k.hidden }, "hide")}
              />
              <TrackButton
                icon={k.locked ? "lock" : ICON_UNLOCKED}
                label={k.locked ? `Unlock ${k.name}` : `Lock ${k.name}`}
                pressed={Boolean(k.locked)}
                quiet={!k.locked}
                disabled={still}
                onClick={() => setTrack(k.id, { locked: !k.locked }, "lock")}
              />
            </>
          )}
          {!still && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="ui-video-track-btn" aria-label={`More for the ${k.name} track`}>
                  <Icon name="ellipsis" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>{k.name}</DropdownMenuLabel>
                <DropdownMenuItem icon="pencil" onSelect={() => setRenaming(k.id)}>
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem icon="arrow-up" disabled={gi === 0} onSelect={() => reorder(k, gi - 1)}>
                  Move up
                  <DropdownMenuShortcut>⌥↑</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem icon="arrow-down" disabled={gi === n - 1} onSelect={() => reorder(k, gi + 1)}>
                  Move down
                  <DropdownMenuShortcut>⌥↓</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  icon="trash"
                  danger
                  disabled={k.id === MAIN}
                  onSelect={() => {
                    onEdit(removeTrack(edit, k.id), `track-${k.id}-remove`);
                    if (picked) onSelect(undefined);
                  }}
                >
                  {k.id === MAIN
                    ? "Main stays: it holds the shots"
                    : `Remove the track${onTrack(edit, k.id) ? ` and its ${onTrack(edit, k.id)}` : ""}`}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </span>
      </div>
    );
  };
  // The grid row of the i-th row (the ruler is row 1, and a gap row sits before the first audio track).
  const rowOf = (i: number) => i + 2 + (firstAudio > 0 && i >= firstAudio ? 1 : 0);

  // Markers: M adds one at the playhead (VideoDesk), named "Marker 1" and so on.
  const addMarker = () => {
    const id = localId("mk");
    onEdit(
      { ...edit, markers: [...markers, { id, at: Math.round(t * 10) / 10, name: `Marker ${markers.length + 1}` }] },
      `marker-${id}`,
    );
    onSelect({ kind: "marker", id });
  };
  const nextMarker = markers.find((m) => m.at > t + 0.05);
  const prevMarker = [...markers].reverse().find((m) => m.at < t - 0.05);

  return (
    <section
      className="ui-video-timeline"
      aria-label="Timeline"
      data-proposed={proposed ? "" : undefined}
      data-mode={motionMode ? "motion" : "edit"}
      onKeyDown={keys}
      style={
        {
          "--len": length,
          "--t": Math.min(t, length),
          "--zoom": zoom,
          "--vz": HEIGHT[height],
        } as CSSProperties
      }
    >
      <div className="ui-video-tools" role="toolbar" aria-label="Timeline tools">
        <Views board={false} onBoard={onBoard} />
        {!still && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="quiet" icon="plus">
                Track
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Add a track</DropdownMenuLabel>
              <DropdownMenuItem
                icon="film"
                onSelect={() => {
                  const id = localId("t");
                  onEdit(addTrack(edit, "video", id), `track-${id}`);
                  onSelect({ kind: "track", id });
                }}
              >
                Video, over the shots
              </DropdownMenuItem>
              <DropdownMenuItem
                icon="type"
                onSelect={() => {
                  const id = localId("t");
                  onEdit(addTrack(edit, "text", id), `track-${id}`);
                  onSelect({ kind: "track", id });
                }}
              >
                Text
              </DropdownMenuItem>
              <DropdownMenuItem
                icon="music"
                onSelect={() => {
                  const id = localId("t");
                  onEdit(addTrack(edit, "audio", id), `track-${id}`);
                  onSelect({ kind: "track", id });
                }}
              >
                Audio
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="quiet" icon="bookmark">
              Markers{markers.length ? ` · ${markers.length}` : ""}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {!still && (
              <DropdownMenuItem icon="plus" onSelect={addMarker}>
                Add a marker at {timecode(t, true)}
                <DropdownMenuShortcut>M</DropdownMenuShortcut>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              icon="arrow-left"
              disabled={!prevMarker}
              onSelect={() => prevMarker && onSeek(prevMarker.at)}
            >
              The one before
              <DropdownMenuShortcut>⌘⇧M</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem
              icon="arrow-right"
              disabled={!nextMarker}
              onSelect={() => nextMarker && onSeek(nextMarker.at)}
            >
              The next one
              <DropdownMenuShortcut>⇧M</DropdownMenuShortcut>
            </DropdownMenuItem>
            {markers.length > 0 && <DropdownMenuSeparator />}
            {markers.map((m) => (
              <DropdownMenuItem
                key={m.id}
                onSelect={() => {
                  onSeek(m.at);
                  onSelect({ kind: "marker", id: m.id });
                }}
              >
                {m.name}
                <DropdownMenuShortcut>{timecode(m.at, true)}</DropdownMenuShortcut>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="ui-video-tools-gap" />
        <span className="ui-video-zoom" role="group" aria-label="Zoom across">
          <Button
            size="sm"
            variant="quiet"
            iconOnly
            icon="zoom-out"
            aria-label="Zoom out"
            shortcut="−"
            disabled={zoom <= ZOOM.min}
            onClick={() => setZoom(zoom / 1.5)}
          />
          <StudioSlider
            bare
            className="ui-video-zoom-range"
            label="Zoom"
            id="tl-zoom"
            min={ZOOM.min}
            max={ZOOM.max}
            step={0.1}
            value={zoom}
            format={(z) => `${z.toFixed(1)}×`}
            onChange={(z) => setZoom(z)}
          />
          <Button
            size="sm"
            variant="quiet"
            iconOnly
            icon="zoom-in"
            aria-label="Zoom in"
            shortcut="="
            disabled={zoom >= ZOOM.max}
            onClick={() => setZoom(zoom * 1.5)}
          />
          <WithTooltip label="Fit the film to the width" shortcut="\">
            <Button size="sm" variant="quiet" disabled={zoom === 1} onClick={() => setZoom(1)}>
              Fit
            </Button>
          </WithTooltip>
        </span>
        <SegmentedControl
          className="ui-video-heights"
          aria-label="Track height"
          value={height}
          onValueChange={(v) => setHeight(v as TrackHeight)}
        >
          <SegmentedOption value="s" aria-label="Short tracks">
            S
          </SegmentedOption>
          <SegmentedOption value="m" aria-label="Medium tracks">
            M
          </SegmentedOption>
          <SegmentedOption value="l" aria-label="Tall tracks">
            L
          </SegmentedOption>
        </SegmentedControl>
      </div>

      <div className="ui-video-scroll" ref={scroller}>
        <div className="ui-video-grid" style={{ gridTemplateRows: template }}>
          <span className="ui-video-corner" aria-hidden="true">
            {timecode(t, true)}
          </span>
          <div className="ui-video-ruler" ref={ruler}>
            <div
              className="ui-video-scrub"
              role="slider"
              tabIndex={0}
              aria-label="Playhead"
              aria-valuemin={0}
              aria-valuemax={Number(length.toFixed(1))}
              aria-valuenow={Number(t.toFixed(1))}
              aria-valuetext={timecode(t, true)}
              onPointerDown={scrub}
              onPointerMove={scrubMove}
              onKeyDown={scrubKey}
            />
            {ticks.map((s) => (
              <span
                key={s}
                className="ui-video-tick"
                data-edge={s === 0 ? "start" : s > length - step * 0.6 ? "end" : undefined}
                style={{ "--at": s } as CSSProperties}
                aria-hidden="true"
              >
                {timecode(s, step < 1)}
              </span>
            ))}
            {beats.map((b) => (
              <span key={b} className="ui-video-beat" style={{ "--at": b } as CSSProperties} aria-hidden="true" />
            ))}
            {markers.map((m) => {
              const s: Selection = { kind: "marker", id: m.id };
              const d = dragged(s);
              return (
                <button
                  key={m.id}
                  type="button"
                  className="ui-video-marker"
                  aria-pressed={isPicked(s)}
                  aria-label={`Marker ${m.name}, at ${timecode(m.at, true)}`}
                  title={m.name}
                  style={{ "--at": Math.max(0, m.at + (d?.dt ?? 0)) } as CSSProperties}
                  onPointerDown={down(s, m.at, m.at)}
                  onPointerMove={move}
                  onPointerUp={up}
                  onPointerCancel={() => setDrag(undefined)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSeek(m.at);
                      onSelect(s);
                    }
                  }}
                >
                  <Icon name="bookmark" />
                  {isPicked(s) && <span className="ui-video-marker-name">{m.name}</span>}
                </button>
              );
            })}
            {flags.map((c) => (
              <button
                key={c.id}
                type="button"
                className="ui-video-flag"
                style={{ "--at": c.at } as CSSProperties}
                aria-label={`${c.note ?? c.label}, at ${timecode(c.at!, true)}`}
                title={c.note ?? c.label}
                onClick={() => onFlag(c)}
              />
            ))}
          </div>

          {rows.map(head)}
          {firstAudio > 0 && (
            <span className="ui-video-track-gap" style={{ gridRow: firstAudio + 2 }} aria-hidden="true">
              Audio
            </span>
          )}
          {rows.map((r, i) => (
            <div
              key={`l-${r.layer?.id ?? r.track.id}`}
              className="ui-video-lane"
              data-track={r.track.id}
              data-kind={r.track.kind}
              data-hidden={r.track.hidden ? "" : undefined}
              data-locked={r.track.locked ? "" : undefined}
              data-muted={
                r.track.muted || (isAudio(r.track) && tracks.some((x) => x.solo) && !r.track.solo) ? "" : undefined
              }
              data-target={drag?.to === r.track.id ? "" : undefined}
              data-lane={r.track.id === MAIN ? "shots" : r.track.kind}
              style={{ gridRow: rowOf(i) }}
              onClick={laneClick}
            >
              {lane(r)}
            </div>
          ))}
          <div className="ui-video-headcol" aria-hidden="true">
            <span className="ui-video-head" />
            {markers.map((m) => (
              <span key={m.id} className="ui-video-marker-line" style={{ "--at": m.at } as CSSProperties} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/** The track under the pointer while something is dragged. */
function trackUnder(x: number, y: number): string | undefined {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  return el?.closest<HTMLElement>("[data-track]")?.dataset.track;
}

/** A tick step that reads well: a quarter, a half, 1, 2, 3, 5, 10, 15 or 30 seconds. */
function niceStep(raw: number): number {
  return [0.25, 0.5, 1, 2, 3, 5, 10, 15, 30, 60].find((s) => s >= raw) ?? 60;
}

/** A small button on a track's head: the eye, the lock, mute, solo. */
function TrackButton({
  icon,
  text,
  label,
  pressed,
  off,
  quiet,
  disabled,
  onClick,
}: {
  icon?: IconName;
  text?: string;
  label: string;
  pressed: boolean;
  /** The eye of a hidden track: the slash, dimmed. */
  off?: boolean;
  /** Shown faintly until it is on or the row is under the pointer (the lock, as in Figma). */
  quiet?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <WithTooltip label={label}>
      <button
        type="button"
        className="ui-video-track-btn"
        aria-label={label}
        aria-pressed={pressed}
        data-off={off ? "" : undefined}
        data-quiet={quiet ? "" : undefined}
        disabled={disabled}
        onClick={onClick}
      >
        {icon ? <Icon name={icon} /> : <span className="ui-video-track-letter">{text}</span>}
      </button>
    </WithTooltip>
  );
}

/** The corner of the tracks: Timeline or Storyboard, two ways to see the same shots. */
export function Views({ board, onBoard }: { board: boolean; onBoard: (on: boolean) => void }) {
  return (
    <div className="ui-video-views" role="group" aria-label="View">
      <WithTooltip label="Timeline">
        <Toggle
          size="sm"
          iconOnly
          icon="layers"
          aria-label="Timeline"
          pressed={!board}
          onPressedChange={() => onBoard(false)}
        />
      </WithTooltip>
      <WithTooltip label="Storyboard: the shots on a board of their own">
        <Toggle
          size="sm"
          iconOnly
          icon="layout-grid"
          aria-label="Storyboard"
          pressed={board}
          onPressedChange={() => onBoard(true)}
        />
      </WithTooltip>
    </div>
  );
}

/** One end of the selected shot: drag it, or use the arrow keys. */
function TrimHandle({
  end,
  clip,
  start,
  dur,
  beats = [],
  timeAt,
  onTrim,
}: {
  end: "in" | "out";
  clip: VideoClip;
  start: number;
  dur: number;
  beats?: number[];
  timeAt: (clientX: number) => number;
  onTrim: (clipId: string, change: Pick<VideoClip, "in" | "out">, key: string) => void;
}) {
  const from = useRef<{ x: number; clip: VideoClip; start: number; end: number }>();
  const speed = clip.speed || 1;
  const max = pickedTake(clip)?.seconds ?? clip.out;
  const key = `trim-${clip.id}-${end}`;

  const set = (edge: number, base = clip) => {
    if (end === "in") {
      const value = Math.min(base.out - MIN_SHOT * speed, Math.max(0, edge));
      onTrim(clip.id, { in: round(value), out: base.out }, key);
    } else {
      const value = Math.max(base.in + MIN_SHOT * speed, Math.min(max, edge));
      onTrim(clip.id, { in: base.in, out: round(value) }, key);
    }
  };

  const down = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    from.current = { x: timeAt(e.clientX), clip, start, end: start + dur };
  };
  const move = (e: PointerEvent<HTMLButtonElement>) => {
    const f = from.current;
    if (!f || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const dt = timeAt(e.clientX) - f.x;
    if (end === "in") return set(f.clip.in + dt * speed, f.clip);
    // The out end lands on a beat when it comes near one (on the timeline, where she hears it).
    const landing = f.end + dt;
    const beat = nearestBeat(beats, landing, SNAP);
    set(f.clip.out + ((beat ?? landing) - f.end) * speed, f.clip);
  };
  const up = () => (from.current = undefined);
  const keys = (e: KeyboardEvent<HTMLButtonElement>) => {
    const by = (e.shiftKey ? 0.5 : 0.1) * speed;
    const d = e.key === "ArrowRight" ? by : e.key === "ArrowLeft" ? -by : 0;
    if (!d) return;
    e.preventDefault();
    set((end === "in" ? clip.in : clip.out) + d);
  };

  return (
    <button
      type="button"
      className="ui-video-trim"
      data-end={end}
      style={{ "--start": start, "--dur": dur } as CSSProperties}
      aria-label={`${end === "in" ? "Start" : "End"} of ${clip.name}: ${(end === "in" ? clip.in : clip.out).toFixed(1)} s into the take. Arrow keys trim it.`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={keys}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

const round = (n: number) => Math.round(n * 100) / 100;
