// The Video studio (FLOWS §27, PROPOSED 27 Oct 2026): the desk's body when the creative is a video. The same desk as
// Image and Design (the bar, the two panels, the Engine bar under the board), with the player as the board and the
// timeline across the whole width under it, as in the agency concept ("Video · Night ritual"). Left: what the edit is
// made from. Right: what is selected. The desk owns the clock: play runs it, the ruler moves it, and the player and
// the timeline follow. Every change of hers is an undo step of the desk (⌘Z), saved after a short pause.
import { Glass, Icon, Toggle, WithTooltip } from "@fume/ui";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePlacements } from "../../../../api/hooks";
import type { CreativeDocument, EditCheck, StudioMode, Variables, VideoClip, VideoEdit } from "../../../../contract";
import { clipAt, editLength, placed, timecode } from "../../../../domain/video";
import { lockProps } from "../lock";
import { checked, type Selection } from "./edit";
import { VideoEngineBar } from "./EngineBar";
import { VideoInspector, type VideoChange } from "./Inspector";
import { VideoMedia } from "./Media";
import { Player } from "./Player";
import { Timeline } from "./Timeline";

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
  /** While the Engine works on the creative, this takes the Engine bar's place. */
  lock?: ReactNode;
  onToggleBare: () => void;
  onChange: (part: VideoChange, key: string) => void;
  onMode: (id: string) => void;
  onBefore: () => void;
}) {
  const placements = usePlacements().data ?? [];
  const [selected, setSelected] = useState<Selection>();
  const [safe, setSafe] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const time = useRef(0);

  // The Engine's ask is shown on the timeline and the player until she keeps or undoes it.
  const proposed = [...edit.edits].reverse().find((e) => e.state === "proposed");
  const view = useMemo(() => (proposed ? checked({ ...edit, ...proposed.after }) : edit), [edit, proposed]);
  const length = editLength(view);
  const lengthRef = useRef(length);
  lengthRef.current = length;
  // A shorter edit (a cut, a trim, the Engine's ask) brings the playhead back inside it.
  useEffect(() => {
    if (time.current > length) {
      time.current = Math.max(0, length - 0.05);
      setT(time.current);
    }
  }, [length]);

  const seek = useCallback((to: number) => {
    time.current = Math.max(0, to);
    setT(time.current);
  }, []);
  const toggle = useCallback(() => {
    setPlaying((p) => {
      if (!p && time.current >= lengthRef.current - 0.05) seek(0);
      return !p;
    });
  }, [seek]);

  // The clock: one frame at a time while playing; it stops at the end.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const next = time.current + (now - last) / 1000;
      last = now;
      if (next >= lengthRef.current) {
        seek(lengthRef.current);
        setPlaying(false);
        return;
      }
      seek(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, seek]);

  // Space plays and pauses; Esc puts the selection down. Never while she types or works a control.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, [contenteditable], [role=dialog], [role=menu], [role=listbox]")) return;
      if (e.key === " " && !el?.closest("button, [role=slider], a")) {
        e.preventDefault();
        toggle();
      } else if (e.key === "Escape" && !el?.closest(".ui-desk-engine")) {
        setSelected(undefined);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  // A selection that is gone (removed, or undone) is put down.
  const exists =
    !selected ||
    (selected.kind === "shot"
      ? view.clips.some((c) => c.id === selected.id)
      : selected.kind === "motion"
        ? view.motion.some((m) => m.id === selected.id)
        : selected.kind === "caption"
          ? view.captions.some((c) => c.id === selected.id)
          : view.sound.some((s) => s.id === selected.id));
  const shown = exists ? selected : undefined;

  const change = useStable((part: VideoChange, key: string) =>
    onChange({ ...part, ...(part.video ? { video: checked(part.video) } : {}) }, key),
  );
  const setEdit = useStable((next: VideoEdit, key: string) => change({ video: next }, key));
  const select = useStable((s: Selection | undefined, seekTo?: "start") => {
    setSelected(s);
    if (s?.kind === "shot" && seekTo) {
      const p = placed(edit.clips).find((x) => x.clip.id === s.id);
      if (p && (time.current < p.start || time.current >= p.end)) seek(p.start + Math.min(0.75, (p.end - p.start) / 2));
    }
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
  const fromLibrary = view.clips.filter((c) => c.source === "library").length;
  const fromEngine = view.clips.length - fromLibrary;
  const made = [
    fromLibrary && `${fromLibrary} ${fromLibrary === 1 ? "shot" : "shots"} of ${brandName}’s footage`,
    fromEngine && `${fromEngine} made by the Engine`,
  ]
    .filter(Boolean)
    .join(" · ");

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
        {!readOnly && (lock ?? <VideoEngineBar doc={doc} proposed={proposed} onBefore={before} />)}
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
          onSelect={select}
          onSeek={seek}
          onTrim={trim}
          onFlag={flag}
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
