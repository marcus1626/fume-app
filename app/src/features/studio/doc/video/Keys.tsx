// A motion layer's keyframes in the inspector (FLOWS §34.6, PROPOSED 9 Nov 2026), as in an editor: a row for each
// property it can move (across, up and down, size, opacity). Each row has the diamond that puts a key at the playhead
// or takes the one there out, the value at the playhead (writing a value puts a key there), and the layer's own short
// track with its keys as diamonds: press one to go to it. The keys sit on the layer, in its own seconds, so they move
// with it. The easing between keys is the layer's (the Motion fold). The look is studio-video.css.
import { Input, WithTooltip } from "@fume/ui";
import { useEffect, useState, type CSSProperties } from "react";
import type { MotionKey, MotionLayer, MotionProp } from "../../../../contract";
import { timecode } from "../../../../domain/video";
import { PROPS, dropKey, setKey, valueAt } from "./motion";

const RANGE: Record<MotionProp, { min: number; max: number; step: number }> = {
  x: { min: -50, max: 50, step: 1 },
  y: { min: -50, max: 50, step: 1 },
  scale: { min: 0.2, max: 3, step: 0.01 },
  opacity: { min: 0, max: 1, step: 0.05 },
};
const shown = (prop: MotionProp, v: number) => (prop === "x" || prop === "y" ? String(Math.round(v)) : v.toFixed(2));

export function Keys({
  layer,
  t,
  onKeys,
  onSeek,
}: {
  layer: MotionLayer;
  /** The playhead, in the video's seconds. */
  t: number;
  onKeys: (keys: MotionKey[], key: string) => void;
  onSeek: (t: number) => void;
}) {
  const dur = Math.max(0.1, layer.end - layer.start);
  const local = Math.round((t - layer.start) * 10) / 10;
  const inside = local >= 0 && local <= dur;
  return (
    <div className="ui-video-keys" style={{ "--p": Math.min(1, Math.max(0, local / dur)) } as CSSProperties}>
      <p className="ui-video-help">
        {inside
          ? `The playhead is ${local.toFixed(1)} s into the layer (${timecode(t, true)} in the video).`
          : "Move the playhead onto the layer to add a key."}
      </p>
      {PROPS.map((p) => {
        const keys = (layer.keys ?? []).filter((k) => k.prop === p.prop);
        const here = keys.find((k) => Math.abs(k.at - local) < 0.05);
        const value = valueAt(layer, p.prop, Math.min(dur, Math.max(0, local)));
        const put = (v: number) =>
          onKeys(setKey(layer.keys, { prop: p.prop, at: local, value: v }), `key-${p.prop}-${local}`);
        return (
          <div key={p.prop} className="ui-video-keyrow">
            <WithTooltip label={here ? "Take out the key here" : "Add a key here"}>
              <button
                type="button"
                className="ui-video-keytoggle"
                aria-pressed={Boolean(here)}
                aria-label={`${here ? "Take out" : "Add"} a key on ${p.name.toLowerCase()} at ${local.toFixed(1)} s`}
                disabled={!inside}
                onClick={() => (here ? onKeys(dropKey(layer.keys, p.prop, here.at), `key-${p.prop}-out`) : put(value))}
              />
            </WithTooltip>
            <label className="ui-video-keyname" htmlFor={`key-${p.prop}`}>
              {p.name}
            </label>
            <KeyValue id={`key-${p.prop}`} prop={p.prop} value={value} unit={p.unit} disabled={!inside} onValue={put} />
            <span className="ui-video-keytrack">
              {keys.map((k) => (
                <button
                  key={k.at}
                  type="button"
                  className="ui-video-keydot"
                  style={{ "--k": Math.min(1, k.at / dur) } as CSSProperties}
                  aria-label={`Go to the ${p.name.toLowerCase()} key at ${k.at.toFixed(1)} s: ${shown(p.prop, k.value)}${p.unit}`}
                  onClick={() => onSeek(layer.start + k.at + 0.001)}
                />
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** The value at the playhead: it keeps what is typed until it is a number in range. */
function KeyValue({
  id,
  prop,
  value,
  unit,
  disabled,
  onValue,
}: {
  id: string;
  prop: MotionProp;
  value: number;
  unit: string;
  disabled: boolean;
  onValue: (v: number) => void;
}) {
  const [draft, setDraft] = useState(shown(prop, value));
  useEffect(() => setDraft(shown(prop, value)), [prop, value]);
  const r = RANGE[prop];
  return (
    <span className="ui-video-keyvalue">
      <Input
        id={id}
        size="sm"
        inputMode="decimal"
        className="ui-sc-field ui-sc-number-field"
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const n = Number(draft);
          if (draft !== "" && Number.isFinite(n) && n >= r.min && n <= r.max && n !== value) onValue(n);
          else setDraft(shown(prop, value));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
      {unit && <span className="ui-video-keyunit">{unit}</span>}
    </span>
  );
}
