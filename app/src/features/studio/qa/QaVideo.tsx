// A video in Check (FLOWS §34.7, PROPOSED 9 Nov 2026): the same check as a picture, on a clock. The video plays in the
// well, fitted like a picture; under it, the transport and one strip of its shots, with what the Engine found as marks
// over the stretch it is on and her pins at their second. A mark or a pin takes the playhead there; the strip itself
// is the scrubber. A pin is dropped on the frame where the playhead stands and shows on the frame around its second.
// The timeline with its tracks stays in the Studio: Check is for looking, deciding and saying what is wrong. The look is
// qa.css.
import { Toggle, WithTooltip } from "@fume/ui";
import { useEffect, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { useDocument } from "../../../api/hooks";
import type { QaFinding, QaItem, QaPin, VideoEdit } from "../../../contract";
import { editLength, pickedTake, placed, timecode } from "../../../domain/video";
import { useBrandCta, useVideoClock } from "../doc/video/play";

/** A pin shows on the frame this long either side of its second. */
export const PIN_NEAR = 0.6;

/** A video creative's edit and its clock; nothing for a picture. */
export function useQaVideo(item: QaItem) {
  const video = item.studio === "video";
  const doc = useDocument(video ? item.documentId : undefined).data;
  const edit = video ? doc?.video : undefined;
  const clock = useVideoClock(edit ? editLength(edit) : 0);
  const cta = useBrandCta();
  // Space plays and pauses, from anywhere but a field or a control.
  const { toggle } = clock;
  useEffect(() => {
    if (!edit) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key !== " " || e.metaKey || e.ctrlKey || e.altKey) return;
      if (
        el?.closest(
          "input, textarea, select, button, a, [contenteditable], [role=slider], [role=dialog]:not(.ui-qa-sheet), [role=menu]",
        )
      )
        return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [edit, toggle]);
  return { video, edit, clock, cta };
}

/** "0:02.9", or "0:00.0 to 0:02.9" for a stretch. */
export const stretch = (s: { from: number; to: number }) =>
  s.to - s.from < 0.3 ? timecode(s.from, true) : `${timecode(s.from, true)} to ${timecode(s.to, true)}`;

/** Past the way in (a dissolve, a focus pull), so the frame she lands on shows what was found. A moment, shown as one
 *  time, lands on that time, so the playhead reads what the link said. */
export const landOn = (s: { from: number; to: number }) =>
  s.to - s.from < 0.3 ? s.from : Math.min(s.to, s.from + Math.min(0.7, (s.to - s.from) / 2));

export function QaReel({
  edit,
  t,
  playing,
  findings,
  pins,
  onToggle,
  onSeek,
}: {
  edit: VideoEdit;
  t: number;
  playing: boolean;
  findings: QaFinding[];
  pins: QaPin[];
  onToggle: () => void;
  onSeek: (t: number) => void;
}) {
  const length = Math.max(editLength(edit), 0.1);
  const shots = placed(edit.clips);
  const marks = findings.filter((f) => f.seconds && f.status === "open");
  const timeAt = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return Math.min(length, Math.max(0, ((e.clientX - r.left) / r.width) * length));
  };
  const scrub = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    onSeek(timeAt(e));
  };
  const scrubMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) onSeek(timeAt(e));
  };
  const scrubKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const by = e.shiftKey ? 1 : 0.1;
    const to = { ArrowRight: t + by, ArrowLeft: t - by, Home: 0, End: length }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    e.stopPropagation();
    onSeek(Math.min(length, Math.max(0, to)));
  };

  return (
    <div className="ui-qa-reel" style={{ "--len": length, "--t": Math.min(t, length) } as CSSProperties}>
      <div className="ui-qa-reel-bar">
        <WithTooltip label={playing ? "Pause" : "Play"} shortcut="Space">
          <Toggle
            size="sm"
            variant="outline"
            iconOnly
            icon={playing ? "pause" : "play"}
            aria-label={playing ? "Pause" : "Play"}
            pressed={playing}
            onPressedChange={onToggle}
          />
        </WithTooltip>
        <span className="ui-video-time">
          <b>{timecode(t, true)}</b> / {timecode(length, true)}
        </span>
      </div>
      <div className="ui-qa-reel-track">
        <div className="ui-qa-reel-marks" aria-label="What the Engine found, and your pins" role="group">
          {marks.map((f) => (
            <button
              key={f.id}
              type="button"
              className="ui-qa-reel-mark"
              data-severity={f.severity}
              style={{ "--from": f.seconds!.from, "--to": f.seconds!.to } as CSSProperties}
              aria-label={`Go to ${stretch(f.seconds!)}: ${f.finding}`}
              onClick={() => onSeek(landOn(f.seconds!))}
            />
          ))}
          {pins
            .filter((p) => p.at !== undefined)
            .map((p) => (
              <button
                key={p.n}
                type="button"
                className="ui-qa-reel-pin"
                style={{ "--at": p.at } as CSSProperties}
                aria-label={`Go to pin ${p.n} at ${timecode(p.at!, true)}: ${p.text}`}
                onClick={() => onSeek(p.at!)}
              >
                {p.n}
              </button>
            ))}
        </div>
        <div
          className="ui-qa-reel-shots"
          role="slider"
          tabIndex={0}
          aria-label="Playhead"
          aria-valuemin={0}
          aria-valuemax={Math.round(length * 10) / 10}
          aria-valuenow={Math.round(t * 10) / 10}
          aria-valuetext={timecode(t, true)}
          onPointerDown={scrub}
          onPointerMove={scrubMove}
          onKeyDown={scrubKey}
        >
          {shots.map(({ clip, index, start, end }) => {
            const take = pickedTake(clip);
            const poster = take?.poster ?? clip.recipe?.startImage;
            return (
              <span
                key={clip.id}
                className="ui-qa-reel-shot"
                style={
                  {
                    "--start": start,
                    "--dur": Math.max(0.05, end - start),
                    ...(poster ? { "--poster": `url("${poster}")` } : {}),
                  } as CSSProperties
                }
              >
                <span>
                  {index + 1} · {clip.name}
                </span>
              </span>
            );
          })}
        </div>
        <span className="ui-qa-reel-head" aria-hidden="true" />
      </div>
    </div>
  );
}
