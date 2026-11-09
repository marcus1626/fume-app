// The timeline (FLOWS §27.3): the whole width under the panels, as in the agency concept. A ruler in seconds with the
// music's beats and the Engine's flags on it (a Rouge dot that jumps to the moment), then four tracks: the brand's
// motion, the shots (a strip of each shot's own frames), the captions and the sound. Click or drag the ruler to move
// the playhead; click a track's empty part to go there; click an item to select it. A selected shot has handles at
// both ends: drag to trim (the shots after it move up), with the arrow keys a tenth at a time. A trimmed end that
// lands near a beat snaps to it.
// Round 14 (FLOWS §34.6, PROPOSED 9 Nov 2026): the tracks are named as in an editor: Text and Brand (the brand's
// components: its call to action, its end card) over Main (the shots, magnetic: a trim closes the gap), then the
// captions and the sound. A layer that follows a shot moves with it, and carries a small link. A layer's keyframes are
// diamonds on its item. In Motion mode each layer has its own track, as in After Effects. The corner switches to the
// Storyboard: the same shots as cards. A 3D track shows only behind the 3d flag (?flags=3d), off in production.
import { Icon, Toggle, WithTooltip, type IconName } from "@fume/ui";
import { useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import type { EditCheck, MotionLayer, VideoClip, VideoEdit } from "../../../../contract";
import { MIN_SHOT, editLength, nearestBeat, pickedTake, placed, timecode } from "../../../../domain/video";
import { MOTION, flagOn, openFindings, wavePath, type Selection } from "./edit";

const BRAND = new Set<MotionLayer["template"]>(["cta", "end"]);

type Lane = { id: string; name: string; icon: IconName; size: "sm" | "shot" | "md"; layers?: MotionLayer[] };

const SNAP = 0.12;

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
}) {
  const length = Math.max(editLength(edit), ...edit.sound.map((s) => s.end), 1);
  const track = useRef<HTMLDivElement>(null);
  const shots = placed(edit.clips);
  const beats = edit.sound.find((s) => s.kind === "music")?.beats?.filter((b) => b <= length) ?? [];
  const step = length > 40 ? 10 : length > 20 ? 5 : 3;
  const ticks = Array.from({ length: Math.floor(length / step) + 1 }, (_, i) => i * step);
  const flags = edit.checks.filter((c) => c.state === "flag" && c.at !== undefined);
  const still = readOnly || proposed;

  const timeAt = (clientX: number) => {
    const r = track.current?.getBoundingClientRect();
    if (!r) return 0;
    return Math.min(length, Math.max(0, ((clientX - r.left) / r.width) * length));
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

  const pick = (s: Selection, start: number, end: number) => {
    if (selected?.kind === s.kind && selected.id === s.id) return onSelect(undefined);
    onSelect(s);
    // Past the way in (a dissolve, a focus pull), so the frame shown is the shot itself.
    if (t < start || t >= end) onSeek(start + Math.min(0.75, (end - start) / 2));
  };
  const item = (s: Selection, start: number, end: number, label: string) => ({
    type: "button" as const,
    className: "ui-video-item",
    "data-kind": s.kind,
    "aria-pressed": selected?.kind === s.kind && selected.id === s.id,
    "aria-label": `${label}, ${timecode(start, true)} to ${timecode(end, true)}`,
    disabled: still,
    onClick: () => pick(s, start, end),
  });
  const at = (start: number, end: number, extra: Record<string, string | number> = {}) =>
    ({ "--start": start, "--dur": Math.max(0.05, end - start), ...extra }) as CSSProperties;
  // A click on a track's empty part moves the playhead there.
  const laneClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onSeek(timeAt(e.clientX));
      onSelect(undefined);
    }
  };

  const sel = selected?.kind === "shot" ? shots.find((s) => s.clip.id === selected.id) : undefined;
  const shotNo = new Map(shots.map((s) => [s.clip.id, s.index + 1]));

  // The tracks, top to bottom.
  const lanes: Lane[] = [
    ...(motionMode
      ? edit.motion.map((m) => ({
          id: m.id,
          name: m.template === "cta" ? "CTA" : MOTION[m.template].name,
          icon: "type" as const,
          size: "sm" as const,
          layers: [m],
        }))
      : [
          {
            id: "text",
            name: "Text",
            icon: "type" as const,
            size: "sm" as const,
            layers: edit.motion.filter((m) => !BRAND.has(m.template)),
          },
          {
            id: "brand",
            name: "Brand",
            icon: "layers" as const,
            size: "sm" as const,
            layers: edit.motion.filter((m) => BRAND.has(m.template)),
          },
        ]),
    { id: "main", name: "Main", icon: "film", size: "shot" },
    ...(motionMode ? [] : [{ id: "captions", name: "Captions", icon: "captions" as const, size: "sm" as const }]),
    { id: "sound", name: "Sound", icon: "music", size: "md" },
    ...(flagOn("3d") ? [{ id: "3d", name: "3D", icon: "package" as const, size: "sm" as const }] : []),
  ];

  const layerLane = (lane: Lane) => (
    <div key={lane.id} className="ui-video-lane" data-lane="motion" onClick={laneClick}>
      {lane.layers!.map((m) => {
        const dur = Math.max(0.1, m.end - m.start);
        const keys = [...new Set((m.keys ?? []).map((k) => k.at))]
          .filter((k) => k >= 0 && k <= dur)
          .sort((a, b) => a - b);
        const follows = m.clipId ? shotNo.get(m.clipId) : undefined;
        return (
          <button
            key={m.id}
            {...item(
              { kind: "motion", id: m.id },
              m.start,
              m.end,
              `${m.text}${follows ? `, follows shot ${follows}` : ""}`,
            )}
            data-template={m.template}
            data-keys={keys.length ? "" : undefined}
            style={at(m.start, m.end)}
          >
            {follows && <Icon name="link" className="ui-video-item-link" />}
            <span>{m.text}</span>
            {keys.map((k) => (
              <i key={k} className="ui-video-key" style={{ "--k": k / dur } as CSSProperties} aria-hidden="true" />
            ))}
          </button>
        );
      })}
    </div>
  );

  return (
    <section
      className="ui-video-timeline"
      aria-label="Timeline"
      data-proposed={proposed ? "" : undefined}
      data-mode={motionMode ? "motion" : "edit"}
      style={
        {
          "--len": length,
          "--t": Math.min(t, length),
          "--video-lanes": lanes.map((l) => `var(--lane-${l.size})`).join(" "),
        } as CSSProperties
      }
    >
      <div className="ui-video-heads">
        <Views board={false} onBoard={onBoard} />
        {lanes.map((l) => (
          <span key={l.id} aria-hidden="true" title={l.name}>
            <Icon name={l.icon} />
            <span>{l.name}</span>
          </span>
        ))}
      </div>
      <div className="ui-video-lanes" ref={track}>
        <div className="ui-video-ruler">
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
            <span key={s} className="ui-video-tick" style={{ "--at": s } as CSSProperties} aria-hidden="true">
              {timecode(s)}
            </span>
          ))}
          {beats.map((b) => (
            <span key={b} className="ui-video-beat" style={{ "--at": b } as CSSProperties} aria-hidden="true" />
          ))}
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

        {lanes.filter((l) => l.layers).map(layerLane)}

        <div className="ui-video-lane" data-lane="shots" onClick={laneClick}>
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
          {sel && !still && (
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
        </div>

        {!motionMode && (
          <div className="ui-video-lane" data-lane="captions" onClick={laneClick}>
            {edit.captions.map((c) => (
              <button
                key={c.id}
                {...item({ kind: "caption", id: c.id }, c.start, c.end, c.text)}
                style={at(c.start, c.end)}
              >
                <span>{c.text}</span>
              </button>
            ))}
          </div>
        )}

        <div className="ui-video-lane" data-lane="sound" onClick={laneClick}>
          {edit.sound.map((s) => (
            <button
              key={s.id}
              {...item({ kind: "sound", id: s.id }, s.start, s.end, s.name)}
              data-sound={s.kind}
              title={s.kind === "music" ? undefined : s.name}
              style={at(s.start, s.end)}
            >
              <svg className="ui-video-wave" viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden="true">
                <path d={wavePath(s.name, Math.max(8, Math.round((s.end - s.start) * 16)))} fill="currentColor" />
              </svg>
              <span>{s.name}</span>
            </button>
          ))}
        </div>

        {lanes.some((l) => l.id === "3d") && (
          <div className="ui-video-lane" data-lane="3d">
            <span className="ui-video-lane-note">The product’s 3D model with a camera move. Behind a flag.</span>
          </div>
        )}

        <span className="ui-video-head" aria-hidden="true" />
      </div>
    </section>
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
      <WithTooltip label="Storyboard">
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
