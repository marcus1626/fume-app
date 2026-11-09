// A motion layer's Transform in the inspector (round 16, PROPOSED 9 Nov 2026), as After Effects lays it out. Marcus:
// "Burde være bedre kontrollere, som i after effects, transform, opacity, rotate, osv." The anchor point, then a row
// for each property: its stopwatch, its name (drag it to change the value, as in After Effects and Figma), the value
// at the playhead, and the keyframe navigator: the key before, a key here, the key after. The stopwatch off: the
// value is the layer's own, whatever the time. Turning it on puts a key at the playhead with the value there; from
// then on a change of value puts a key where the playhead is. Turning it off takes the keys out and keeps the value
// at the playhead, as After Effects does. An animated property shows its keys on the layer's own short track under
// it: press a diamond to go to it. Scale and opacity read in per cent, rotation in degrees, position in per cent of
// the frame. The look is studio-video.css (.ui-video-tf).
import { Icon, Input, ScrubHandle, WithTooltip, type IconName } from "@fume/ui";
import { useEffect, useState, type CSSProperties } from "react";
import type { MotionLayer, MotionProp } from "../../../../contract";
import { timecode } from "../../../../domain/video";
import { REST, dropKey, setKey, valueAt } from "./motion";

/** Each property as she reads and types it: the stored value is a share (scale 1 = 100 %, opacity 1 = 100 %). */
export const TRANSFORM: {
  prop: MotionProp;
  name: string;
  short: string;
  unit: string;
  show: (v: number) => number;
  store: (n: number) => number;
  min: number;
  max: number;
}[] = [
  { prop: "x", name: "Position X", short: "X", unit: "%", show: (v) => v, store: (n) => n, min: -100, max: 100 },
  { prop: "y", name: "Position Y", short: "Y", unit: "%", show: (v) => v, store: (n) => n, min: -100, max: 100 },
  {
    prop: "scale",
    name: "Scale",
    short: "Scale",
    unit: "%",
    show: (v) => v * 100,
    store: (n) => n / 100,
    min: 10,
    max: 400,
  },
  {
    prop: "rotate",
    name: "Rotation",
    short: "Rotation",
    unit: "°",
    show: (v) => v,
    store: (n) => n,
    min: -360,
    max: 360,
  },
  {
    prop: "opacity",
    name: "Opacity",
    short: "Opacity",
    unit: "%",
    show: (v) => v * 100,
    store: (n) => n / 100,
    min: 0,
    max: 100,
  },
];

const round = (n: number) => Math.round(n * 10) / 10;

export function Transform({
  layer,
  t,
  onLayer,
  onSeek,
}: {
  layer: MotionLayer;
  /** The playhead, in the video's seconds. */
  t: number;
  onLayer: (change: Partial<MotionLayer>, key: string) => void;
  onSeek: (t: number) => void;
}) {
  const dur = Math.max(0.1, layer.end - layer.start);
  const local = round(t - layer.start);
  const inside = local >= 0 && local <= dur;
  const at = Math.min(dur, Math.max(0, local));
  const anchor = layer.anchor ?? { x: 50, y: 50 };
  const animated = (prop: MotionProp) => (layer.keys ?? []).some((k) => k.prop === prop);
  const anyKeys = TRANSFORM.some((p) => animated(p.prop));

  return (
    <div className="ui-video-tf" style={{ "--p": Math.min(1, Math.max(0, local / dur)) } as CSSProperties}>
      <p className="ui-video-help">
        {anyKeys
          ? inside
            ? `The playhead is ${local.toFixed(1)} s into the layer (${timecode(t, true)} in the video). A change on a property with its stopwatch on puts a key here.`
            : "Move the playhead onto the layer to put a key on an animated property."
          : "Turn on a property’s stopwatch to animate it: a key goes in at the playhead."}
      </p>
      <div className="ui-video-tf-row" data-anchor="">
        <span className="ui-video-tf-watch" aria-hidden="true" />
        <span className="ui-video-tf-name">Anchor point</span>
        <span className="ui-video-tf-pair">
          <Field
            id="tf-anchor-x"
            label="Anchor point X"
            short="X"
            value={anchor.x}
            unit="%"
            min={0}
            max={100}
            onValue={(x) => onLayer({ anchor: { ...anchor, x } }, "anchor-x")}
          />
          <Field
            id="tf-anchor-y"
            label="Anchor point Y"
            short="Y"
            value={anchor.y}
            unit="%"
            min={0}
            max={100}
            onValue={(y) => onLayer({ anchor: { ...anchor, y } }, "anchor-y")}
          />
        </span>
      </div>
      {TRANSFORM.map((p) => {
        const on = animated(p.prop);
        const keys = (layer.keys ?? []).filter((k) => k.prop === p.prop).sort((a, b) => a.at - b.at);
        const here = keys.find((k) => Math.abs(k.at - local) < 0.05);
        const before = [...keys].reverse().find((k) => k.at < local - 0.05);
        const after = keys.find((k) => k.at > local + 0.05);
        const value = valueAt(layer, p.prop, at);
        const blocked = on && !inside;
        // A value at the playhead: a key when the stopwatch is on, else the layer's own value.
        const put = (v: number) => {
          if (on) {
            if (!inside) return;
            onLayer({ keys: setKey(layer.keys, { prop: p.prop, at: local, value: v }) }, `tf-${p.prop}-${local}`);
          } else {
            const transform = { ...layer.transform, [p.prop]: v };
            if (v === REST[p.prop]) delete transform[p.prop];
            onLayer({ transform }, `tf-${p.prop}`);
          }
        };
        const watch = () => {
          if (on) {
            // Off: the keys go, the value at the playhead stays.
            const transform = { ...layer.transform, [p.prop]: value };
            if (value === REST[p.prop]) delete transform[p.prop];
            onLayer({ keys: (layer.keys ?? []).filter((k) => k.prop !== p.prop), transform }, `tf-${p.prop}-watch`);
          } else {
            const transform = { ...layer.transform };
            delete transform[p.prop];
            onLayer({ keys: setKey(layer.keys, { prop: p.prop, at, value }), transform }, `tf-${p.prop}-watch`);
          }
        };
        return (
          <div key={p.prop} className="ui-video-tf-row" data-on={on ? "" : undefined}>
            <WithTooltip label={on ? `Stop animating ${p.name.toLowerCase()}` : `Animate ${p.name.toLowerCase()}`}>
              <button
                type="button"
                className="ui-video-tf-watch"
                aria-pressed={on}
                aria-label={`Stopwatch: ${on ? "stop animating" : "animate"} ${p.name.toLowerCase()}`}
                onClick={watch}
              >
                <Icon name="timer" />
              </button>
            </WithTooltip>
            <Field
              id={`tf-${p.prop}`}
              label={p.name}
              short={p.name}
              named
              value={round(p.show(value))}
              unit={p.unit}
              min={p.min}
              max={p.max}
              disabled={blocked}
              onValue={(n) => put(p.store(n))}
            />
            <span className="ui-video-tf-nav" role="group" aria-label={`${p.name} keys`}>
              {on && (
                <>
                  <NavButton
                    icon="chevron-left"
                    label={
                      before ? `The ${p.name.toLowerCase()} key before, at ${before.at.toFixed(1)} s` : "No key before"
                    }
                    disabled={!before}
                    onClick={() => before && onSeek(layer.start + before.at + 0.001)}
                  />
                  <WithTooltip label={here ? "Take out the key here" : "Add a key here"}>
                    <button
                      type="button"
                      className="ui-video-keytoggle"
                      aria-pressed={Boolean(here)}
                      aria-label={`${here ? "Take out" : "Add"} a key on ${p.name.toLowerCase()} at ${local.toFixed(1)} s`}
                      disabled={!inside}
                      onClick={() =>
                        here ? onLayer({ keys: dropKey(layer.keys, p.prop, here.at) }, `tf-${p.prop}-out`) : put(value)
                      }
                    />
                  </WithTooltip>
                  <NavButton
                    icon="chevron-right"
                    label={
                      after ? `The ${p.name.toLowerCase()} key after, at ${after.at.toFixed(1)} s` : "No key after"
                    }
                    disabled={!after}
                    onClick={() => after && onSeek(layer.start + after.at + 0.001)}
                  />
                </>
              )}
            </span>
            {on && (
              <span className="ui-video-keytrack">
                {keys.map((k) => (
                  <button
                    key={k.at}
                    type="button"
                    className="ui-video-keydot"
                    style={{ "--k": Math.min(1, k.at / dur) } as CSSProperties}
                    aria-label={`Go to the ${p.name.toLowerCase()} key at ${k.at.toFixed(1)} s: ${round(p.show(k.value))}${p.unit}`}
                    onClick={() => onSeek(layer.start + k.at + 0.001)}
                  />
                ))}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function NavButton({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: IconName;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <WithTooltip label={label}>
      <button type="button" className="ui-video-tf-step" aria-label={label} disabled={disabled} onClick={onClick}>
        <Icon name={icon} />
      </button>
    </WithTooltip>
  );
}

/** A value with its scrub handle: drag the name, or type. It keeps what is typed until it is a number in range. */
export function Field({
  id,
  label,
  short,
  named,
  value,
  unit,
  min,
  max,
  step = 1,
  disabled,
  onValue,
}: {
  id: string;
  label: string;
  /** The handle's words: the name in a row of its own, a letter in a pair. */
  short: string;
  /** The handle is the row's name. */
  named?: boolean;
  value: number;
  unit?: string;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onValue: (n: number) => void;
}) {
  const shownValue = String(step < 1 ? Number(value.toFixed(2)) : Math.round(value * 10) / 10);
  const [draft, setDraft] = useState(shownValue);
  useEffect(() => setDraft(shownValue), [shownValue]);
  return (
    <span className="ui-video-tf-field" data-named={named ? "" : undefined}>
      <ScrubHandle
        className="ui-video-tf-scrub"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={onValue}
      >
        {short}
      </ScrubHandle>
      <label className="ui-sr-only" htmlFor={id}>
        {label}
      </label>
      <Input
        id={id}
        size="sm"
        inputMode="decimal"
        className="ui-sc-field ui-sc-number-field ui-video-tf-input"
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const n = Number(draft);
          if (draft !== "" && Number.isFinite(n) && n >= min && n <= max && n !== value) onValue(n);
          else setDraft(shownValue);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const by = (e.shiftKey ? 10 : 1) * step * (e.key === "ArrowUp" ? 1 : -1);
            onValue(Math.min(max, Math.max(min, Math.round((value + by) / step) * step)));
          }
        }}
      />
      {unit && <span className="ui-video-tf-unit">{unit}</span>}
    </span>
  );
}
