// A text layer's Animate fold (round 16, PROPOSED 9 Nov 2026), as After Effects' text animators and their presets.
// Marcus: "Og egne til tekst, presets, type writer, osv." Pick a preset (Typewriter, Fade up by word, Blur in by
// letter, Slide up by line, Tracking in, Scale down by word) and the words come in a letter, a word or a line at a
// time. The range says which part moves (start and end, per cent of the letters, words or lines) and the offset
// slides that range along, as After Effects' Range Selector does; Over is how long it takes to run through them. While
// an animator is on, it is the layer's way in. The look is studio-video.css (.ui-video-anim).
import { StudioSegmented, StudioSlider } from "@fume/ui";
import type { MotionLayer, TextAnimator, TextAnimatorId } from "../../../../contract";
import { ANIMATORS, animator, unitsOf } from "./motion";

const BY: { value: TextAnimator["by"]; label: string; one: string; many: string }[] = [
  { value: "letter", label: "Letters", one: "letter", many: "letters" },
  { value: "word", label: "Words", one: "word", many: "words" },
  { value: "line", label: "Lines", one: "line", many: "lines" },
];

export function Animate({
  layer,
  onAnimate,
}: {
  layer: MotionLayer;
  onAnimate: (animate: TextAnimator | undefined, key: string) => void;
}) {
  const a = layer.animate;
  const set = (change: Partial<TextAnimator>, key: string) => a && onAnimate({ ...a, ...change }, `anim-${key}`);
  const by = BY.find((b) => b.value === a?.by) ?? BY[0]!;
  const n = a ? unitsOf(layer.text, a.by).filter((u) => u.trim()).length : 0;
  return (
    <div className="ui-video-anim">
      <ul className="ui-video-styles" aria-label="Text animators">
        <li>
          <button
            type="button"
            className="ui-video-style"
            aria-pressed={!a}
            onClick={() => onAnimate(undefined, "anim-off")}
          >
            <span className="ui-video-style-name">None</span>
            <span className="ui-video-style-line">The layer comes in as its In says</span>
          </button>
        </li>
        {(Object.keys(ANIMATORS) as TextAnimatorId[]).map((id) => (
          <li key={id}>
            <button
              type="button"
              className="ui-video-style"
              data-animator={id}
              aria-pressed={a?.preset === id}
              onClick={() => onAnimate(a?.preset === id ? a : animator(id), `anim-${id}`)}
            >
              <span className="ui-video-style-name">{ANIMATORS[id].name}</span>
              <span className="ui-video-style-line">{ANIMATORS[id].line}</span>
            </button>
          </li>
        ))}
      </ul>
      {a && (
        <>
          <StudioSegmented
            label="By"
            id="anim-by"
            value={a.by}
            options={BY.map((b) => ({ value: b.value, label: b.label }))}
            help={`${n} ${n === 1 ? by.one : by.many} in “${layer.text.length > 28 ? `${layer.text.slice(0, 27)}…` : layer.text}”`}
            onChange={(v) => set({ by: v as TextAnimator["by"] }, "by")}
          />
          <p className="ui-video-sub">Range</p>
          <StudioSlider
            label="Start"
            id="anim-start"
            value={a.start}
            min={0}
            max={100}
            unit="%"
            onChange={(start) => set({ start: Math.min(start, a.end) }, "start")}
          />
          <StudioSlider
            label="End"
            id="anim-end"
            value={a.end}
            min={0}
            max={100}
            unit="%"
            onChange={(end) => set({ end: Math.max(end, a.start) }, "end")}
          />
          <StudioSlider
            label="Offset"
            id="anim-offset"
            value={a.offset}
            min={-100}
            max={100}
            unit="%"
            help={`Which ${by.many} move: the range slides along them`}
            onChange={(offset) => set({ offset }, "offset")}
          />
          <StudioSlider
            label="Over"
            id="anim-over"
            value={a.over}
            min={0.3}
            max={4}
            step={0.1}
            unit="s"
            help="From the layer’s start until the last one is in. It is the layer’s way in while it is on."
            onChange={(over) => set({ over }, "over")}
          />
        </>
      )}
    </div>
  );
}
