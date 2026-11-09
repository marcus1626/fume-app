// The Video studio (FLOWS §27, PROPOSED 27 Oct 2026): the desk's body when the creative is a video. The same desk as
// Image and Design (the bar, the two panels), with the player as the board and the timeline across the whole width
// under it, as in the agency concept ("Video · Night ritual"). Left: what the edit is made from. Right: what is
// selected. The desk owns the clock: play runs it, the ruler moves it, and the player and the timeline follow. Every
// change of hers is an undo step of the desk (⌘Z), saved after a short pause.
// Round 15 (PROPOSED 9 Nov 2026): no Engine bar under the player and no conversation in the inspector's place: she
// talks to the Engine in the Engine panel beside the desk, in the video's own thread. The desk tells the panel what
// she sees (the picked shot or layer, the playhead when stopped, the format, the mode), and a change the Engine
// proposes still shows on the timeline and the player first, kept or undone in the panel (engine/changes.tsx).
// Round 16 (PROPOSED 9 Nov 2026): the Storyboard is a page of its own over the whole desk (Storyboard.tsx); the
// timeline's tracks lie as the frame's layers (Timeline.tsx). Keys: M puts a marker at the playhead, ⇧M goes to the
// next one and ⌘⇧M to the one before; Delete takes out what is picked.
import { Glass, Icon, Toggle, WithTooltip } from "@fume/ui";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePlacements } from "../../../../api/hooks";
import { useEngineSight, type EngineSeen, type EngineSight } from "../../../engine/panel";
import { EnginePrompt } from "../../../engine/prompt";
import type { CreativeDocument, EditCheck, StudioMode, Variables, VideoClip, VideoEdit } from "../../../../contract";
import { clipAt, editLength, placed, timecode } from "../../../../domain/video";
import { lockProps } from "../lock";
import { useBrandCta, useVideoClock } from "./play";
import { checked, localId, MOTION, takeWords, type Selection } from "./edit";
import { VideoInspector, type VideoChange } from "./Inspector";
import { VideoMedia } from "./Media";
import { follow } from "./motion";
import { Player } from "./Player";
import { Storyboard } from "./Storyboard";
import { Timeline } from "./Timeline";
import { removeTrack, tracksOf } from "./tracks";

/** The latest value of a callback behind a stable function, so the panels need not draw again on every frame. */
function useStable<A extends unknown[], R>(fn: (...args: A) => R) {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback((...args: A) => ref.current(...args), []);
}

export function VideoDesk({
  doc,
  edit,
  variables,
  mode,
  modes,
  brandName,
  productName,
  title,
  readOnly,
  bare,
  locked,
  lock,
  onToggleBare,
  onChange,
  onMode,
  onBefore,
}: {
  doc: CreativeDocument;
  edit: VideoEdit;
  variables: Variables;
  mode?: StudioMode;
  modes: StudioMode[];
  brandName: string;
  productName?: string;
  title: string;
  readOnly: boolean;
  bare: boolean;
  locked: boolean;
  /** While the Engine works on the creative, this lies under the player (Wait · Take over). */
  lock?: ReactNode;
  onToggleBare: () => void;
  onChange: (part: VideoChange, key: string) => void;
  onMode: (id: string) => void;
  onBefore: () => void;
}) {
  const placements = usePlacements().data ?? [];
  // The brand's call to action as its design system sets it, for the CTA on the video.
  const cta = useBrandCta();
  const [selected, setSelected] = useState<Selection>();
  // Storyboard or Timeline: two ways to see the same shots (FLOWS §34.6).
  const [board, setBoard] = useState(false);
  const [safe, setSafe] = useState(false);

  // The Engine's ask is shown on the timeline and the player until she keeps or undoes it.
  const proposed = [...edit.edits].reverse().find((e) => e.state === "proposed");
  const view = useMemo(() => (proposed ? checked({ ...edit, ...proposed.after }) : edit), [edit, proposed]);
  const length = editLength(view);
  const { t, time, playing, seek, toggle } = useVideoClock(length);

  // Space plays and pauses; Esc puts the selection down. Never while she types or works a control. On the board,
  // space is the hand (Storyboard.tsx). M, ⇧M and ⌘⇧M: the markers. Delete: what is picked goes.
  const keyed = useStable((e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null;
    if (el?.closest("input, textarea, select, [contenteditable], [role=dialog], [role=menu], [role=listbox]")) return;
    if (el?.closest(".ui-engine-panel")) return;
    const k = e.key.toLowerCase();
    if (e.key === " " && !board && !el?.closest("button, [role=slider], a")) {
      e.preventDefault();
      toggle();
    } else if (e.key === "Escape") {
      setSelected(undefined);
    } else if (k === "m" && !e.altKey && !board) {
      const markers = [...(view.markers ?? [])].sort((a, b) => a.at - b.at);
      const now = time.current;
      if (e.shiftKey) {
        // ⇧M the next marker, ⌘⇧M the one before.
        e.preventDefault();
        const to =
          e.metaKey || e.ctrlKey
            ? [...markers].reverse().find((m) => m.at < now - 0.05)
            : markers.find((m) => m.at > now + 0.05);
        if (to) seek(to.at);
      } else if (!e.metaKey && !e.ctrlKey && !readOnly && !proposed && !locked) {
        e.preventDefault();
        const id = localId("mk");
        setEdit(
          {
            ...edit,
            markers: [
              ...(edit.markers ?? []),
              { id, at: Math.round(now * 10) / 10, name: `Marker ${markers.length + 1}` },
            ],
          },
          `marker-${id}`,
        );
        setSelected({ kind: "marker", id });
      }
    } else if ((e.key === "Delete" || e.key === "Backspace") && shown && !readOnly && !proposed && !locked) {
      if (el?.closest("button[aria-haspopup]")) return;
      const next = without(edit, shown);
      if (next === edit) return;
      e.preventDefault();
      setEdit(next, `remove-${shown.id}`);
      setSelected(undefined);
    }
  });
  useEffect(() => {
    window.addEventListener("keydown", keyed);
    return () => window.removeEventListener("keydown", keyed);
  }, [keyed]);

  // A selection that is gone (removed, or undone) is put down.
  const exists =
    !selected ||
    (selected.kind === "shot"
      ? view.clips.some((c) => c.id === selected.id)
      : selected.kind === "motion"
        ? view.motion.some((m) => m.id === selected.id)
        : selected.kind === "caption"
          ? view.captions.some((c) => c.id === selected.id)
          : selected.kind === "sound"
            ? view.sound.some((s) => s.id === selected.id)
            : selected.kind === "overlay"
              ? (view.overlays ?? []).some((o) => o.id === selected.id)
              : selected.kind === "marker"
                ? (view.markers ?? []).some((m) => m.id === selected.id)
                : tracksOf(view).some((k) => k.id === selected.id));
  const shown = exists ? selected : undefined;

  // Layers that follow a shot move with it, whatever moved the shot (FLOWS §34.6).
  const change = useStable((part: VideoChange, key: string) =>
    onChange({ ...part, ...(part.video ? { video: checked(follow(edit, part.video)) } : {}) }, key),
  );
  const setEdit = useStable((next: VideoEdit, key: string) => change({ video: next }, key));
  const select = useStable((s: Selection | undefined, seekTo?: "start") => {
    setSelected(s);
    if (s?.kind === "shot" && seekTo) {
      const p = placed(edit.clips).find((x) => x.clip.id === s.id);
      if (p && (time.current < p.start || time.current >= p.end)) seek(p.start + Math.min(0.75, (p.end - p.start) / 2));
    }
  });
  // From the board back to the timeline, with the shot picked and the playhead on it.
  const open = useStable((clipId: string) => {
    setBoard(false);
    select({ kind: "shot", id: clipId }, "start");
  });
  const flag = useStable((c: EditCheck) => {
    if (c.at === undefined) return;
    // Past the way in (a dissolve or a focus pull), so the frame she lands on is the flagged shot itself.
    const hit = clipAt(view.clips, c.at + 0.05);
    seek(hit ? Math.min(hit.end - 0.05, Math.max(c.at + 0.05, hit.start + 0.7)) : c.at);
    if (hit) setSelected({ kind: "shot", id: hit.clip.id });
  });
  const trim = useStable((clipId: string, cut: Pick<VideoClip, "in" | "out">, key: string) =>
    setEdit({ ...edit, clips: edit.clips.map((c) => (c.id === clipId ? { ...c, ...cut } : c)) }, key),
  );
  const timeNow = useStable(() => time.current);
  const before = useStable(onBefore);
  const mode_ = useStable(onMode);

  const format = view.formats.find((f) => f.id === view.formatId);
  const placement = placements.find((p) => p.id === format?.placementId);

  // What the Engine panel sees on the video: what is picked, the playhead while it stands still, the format, the mode
  const clip = shown?.kind === "shot" ? view.clips.find((c) => c.id === shown.id) : undefined;
  const layer = shown?.kind === "motion" ? view.motion.find((m) => m.id === shown.id) : undefined;
  const over = shown?.kind === "overlay" ? view.overlays?.find((o) => o.id === shown.id) : undefined;
  const marker = shown?.kind === "marker" ? view.markers?.find((m) => m.id === shown.id) : undefined;
  const track = shown?.kind === "track" ? tracksOf(view).find((k) => k.id === shown.id) : undefined;
  const shotNo = clip ? placed(view.clips).findIndex((p) => p.clip.id === clip.id) + 1 : 0;
  const picked = clip
    ? `Shot ${shotNo} · ${takeWords(clip)}`
    : layer
      ? `${MOTION[layer.template].name}: ${layer.text}`
      : over
        ? `Over the video: ${over.name}`
        : marker
          ? `Marker: ${marker.name}`
          : track
            ? `The ${track.name} track`
            : "";
  const at = playing ? "" : timecode(Math.round(t * 10) / 10, true);
  const cut = format ? `${format.name} ${format.ratio}` : "";
  const sight = useMemo<EngineSight>(() => {
    const seen: EngineSeen[] = [];
    if (picked)
      seen.push({
        id: "picked",
        icon:
          picked.startsWith("Shot") || picked.startsWith("Over")
            ? "film"
            : picked.startsWith("Marker")
              ? "bookmark"
              : picked.startsWith("The ")
                ? "layers"
                : "type",
        words: picked,
      });
    if (at) seen.push({ id: "time", icon: "clock", words: `At ${at}` });
    if (cut) seen.push({ id: "format", icon: "crop", words: cut });
    if (mode) seen.push({ id: "mode", icon: "layers", words: board ? "The storyboard" : `${mode.name} mode` });
    return {
      workspaceId: doc.workspaceId,
      topic: { kind: "document", id: doc.id },
      title,
      seen,
      desk: { doc, mode, busy: false, locked, onBefore: before, onVariable: () => {} },
    };
  }, [doc, mode, title, picked, at, cut, before, locked, board]);
  useEngineSight(sight);
  const fromLibrary = view.clips.filter((c) => c.source === "library").length;
  const fromEngine = view.clips.length - fromLibrary;
  const made = [
    fromLibrary && `${fromLibrary} ${fromLibrary === 1 ? "shot" : "shots"} of ${brandName}’s footage`,
    fromEngine && `${fromEngine} made by the Engine`,
  ]
    .filter(Boolean)
    .join(" · ");

  // The storyboard is a page of its own: it covers the desk under the bar (Marcus, 9 Nov).
  if (board)
    return (
      <div className="ui-desk-lockable" {...lockProps(locked || Boolean(proposed))}>
        <Storyboard
          edit={view}
          selected={shown}
          readOnly={readOnly || Boolean(proposed)}
          brandName={brandName}
          onSelect={select}
          onBoard={setBoard}
          onEdit={setEdit}
          onOpen={open}
        />
      </div>
    );

  return (
    <>
      {!readOnly && !bare && (
        <div className="ui-desk-lockable" {...lockProps(locked || Boolean(proposed))}>
          <VideoMedia
            doc={doc}
            edit={edit}
            mode={mode}
            modes={modes}
            brandName={brandName}
            productName={productName}
            selected={shown}
            onMode={mode_}
            onSelect={select}
            onEdit={setEdit}
            timeNow={timeNow}
            cta={cta}
          />
        </div>
      )}

      <main className="ui-desk-centre">
        <section className="ui-desk-canvas ui-video-canvas" aria-label="Player">
          {!readOnly && (
            <Glass className="ui-desk-rail" role="toolbar" aria-orientation="vertical" aria-label="View">
              {placement && (
                <RailToggle
                  label={`Safe zones · ${placement.name}`}
                  icon="crop"
                  pressed={safe}
                  onPressedChange={setSafe}
                />
              )}
              <span className="ui-desk-rail-gap" aria-hidden="true" />
              <RailToggle
                label={bare ? "Show the panels" : "Hide the panels"}
                shortcut="⌘\"
                icon={bare ? "minimize-2" : "maximize-2"}
                pressed={bare}
                onPressedChange={onToggleBare}
              />
            </Glass>
          )}
          <div className="ui-desk-stage" onClick={(e) => e.target === e.currentTarget && setSelected(undefined)}>
            <Player
              edit={view}
              t={t}
              playing={playing}
              placement={placement}
              safe={safe}
              brandName={brandName}
              title={title}
              cta={cta}
            />
          </div>
          <div className="ui-video-transport">
            <WithTooltip label={playing ? "Pause" : "Play"} shortcut="Space">
              <Toggle
                size="sm"
                variant="outline"
                iconOnly
                icon={playing ? "pause" : "play"}
                aria-label={playing ? "Pause" : "Play"}
                pressed={playing}
                disabled={!view.clips.length}
                onPressedChange={toggle}
              />
            </WithTooltip>
            <span className="ui-video-time">
              <b>{timecode(t, true)}</b> / {timecode(length, true)}
            </span>
            <span className="ui-video-transport-end">
              {made && <span className="ui-video-made">{made}</span>}
              <span className="ui-video-grade">
                <Icon name="palette" />
                {view.grade}
              </span>
            </span>
          </div>
        </section>
        {!readOnly && <EnginePrompt />}
        {!readOnly && lock}
      </main>

      {!readOnly && !bare && (
        <div className="ui-desk-lockable" {...lockProps(locked || Boolean(proposed))}>
          <VideoInspector
            doc={doc}
            edit={edit}
            mode={mode}
            variables={variables}
            selected={shown}
            brandName={brandName}
            onChange={change}
            onSelect={select}
            onFlag={flag}
            onBefore={before}
            t={shown?.kind === "motion" ? Math.round(t * 10) / 10 : 0}
            onSeek={seek}
          />
        </div>
      )}
      <div className="ui-desk-lockable" {...lockProps(locked)}>
        <Timeline
          edit={view}
          t={t}
          selected={shown}
          readOnly={readOnly}
          proposed={Boolean(proposed)}
          motionMode={mode?.id === "m-video-motion"}
          onSelect={select}
          onSeek={seek}
          onTrim={trim}
          onFlag={flag}
          onBoard={setBoard}
          onEdit={setEdit}
        />
      </div>
    </>
  );
}

function RailToggle({
  label,
  icon,
  shortcut,
  ...props
}: {
  label: string;
  icon: "crop" | "maximize-2" | "minimize-2";
  shortcut?: string;
  pressed: boolean;
  onPressedChange: (on: boolean) => void;
}) {
  return (
    <WithTooltip label={label} shortcut={shortcut} side="right">
      <Toggle size="sm" iconOnly icon={icon} className="ui-desk-rail-tool" aria-label={label} {...props} />
    </WithTooltip>
  );
}

/** The edit without the picked thing: a shot, a layer, a caption, a sound (the music stays: the mode sets it), a clip
 *  over the video, a marker, or a track with what lies on it (Main stays). The same edit when nothing can go. */
function without(edit: VideoEdit, s: Selection): VideoEdit {
  switch (s.kind) {
    case "shot":
      return { ...edit, clips: edit.clips.filter((c) => c.id !== s.id) };
    case "motion":
      return { ...edit, motion: edit.motion.filter((m) => m.id !== s.id) };
    case "caption":
      return { ...edit, captions: edit.captions.filter((c) => c.id !== s.id) };
    case "sound":
      return edit.sound.some((x) => x.id === s.id && x.kind !== "music")
        ? { ...edit, sound: edit.sound.filter((x) => x.id !== s.id) }
        : edit;
    case "overlay":
      return { ...edit, overlays: (edit.overlays ?? []).filter((o) => o.id !== s.id) };
    case "marker":
      return { ...edit, markers: (edit.markers ?? []).filter((m) => m.id !== s.id) };
    case "track":
      return removeTrack(edit, s.id);
  }
}
