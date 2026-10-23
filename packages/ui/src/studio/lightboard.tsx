// StudioLightboard: advanced light (FLOWS §18, PROPOSED 15 Oct 2026). A square board seen from above, like the light
// dial: the subject in the middle, the camera at the foot. Each light is a dot you drag where you want it (key, fill,
// rim, practical); a press on the empty board brings the chosen light there. Add a light with the plus, take the
// chosen one away with the bin. Under the board, the chosen light's own warmth, strength, softness and height.
// While a light is dragged, `onDragging` tells the desk, which shows the light on the creative (StudioLightOverlay).
// `preview` takes a slot beside the board: the app puts its three.js view of the lights there (lazy, so the library
// stays free of three.js).
//   <StudioLightboard label="Lights" value={rig} onChange={set} onDragging={(on, id) => …} preview={<Light3D … />} />
import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { Button } from "../controls/button";
import { SegmentedControl, SegmentedOption } from "../controls/segmented";
import { Icon } from "../icons";
import { StudioRow } from "./row";
import { StudioSlider, withUnit } from "./slider";
import { studioId, type StudioControlProps, type StudioLight, type StudioLightRig } from "./types";

export const lightKindNames: Record<StudioLight["kind"], string> = {
  key: "Key",
  fill: "Fill",
  rim: "Rim",
  practical: "Practical",
};
const kindOrder: StudioLight["kind"][] = ["key", "fill", "rim", "practical"];

/** A colour temperature in Kelvin as RGB 0–255 (Tanner Helland's fit), for a preview of the light's warmth. */
export function kelvinToRgb(kelvin: number): [number, number, number] {
  const t = Math.min(40000, Math.max(1000, kelvin)) / 100;
  const c = (n: number) => Math.round(Math.min(255, Math.max(0, n)));
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [c(r), c(g), c(b)];
}

/** Each light's name, numbered when a kind repeats: "Key", "Fill", "Fill 2". */
export function lightNames(rig: StudioLightRig): Record<string, string> {
  const seen: Record<string, number> = {};
  const out: Record<string, string> = {};
  for (const l of rig.lights) {
    seen[l.kind] = (seen[l.kind] ?? 0) + 1;
    out[l.id] = seen[l.kind]! > 1 ? `${lightKindNames[l.kind]} ${seen[l.kind]}` : lightKindNames[l.kind];
  }
  return out;
}

/** Where a light on the board falls on the creative, 0–1 (StudioLightOverlay): across as on the board, and higher
 *  in the frame the higher it stands and the further behind the subject it is. */
export function lightOnFrame(l: StudioLight) {
  const y = 0.55 - (l.height / 90) * 0.5 + (l.y - 0.5) * 0.3;
  return { x: Math.min(0.98, Math.max(0.02, l.x)), y: Math.min(0.98, Math.max(0.02, y)) };
}

export interface StudioLightboardProps extends StudioControlProps<StudioLightRig> {
  /** The chosen light, when the parent keeps it; otherwise the board does. */
  selected?: string;
  onSelect?: (id: string) => void;
  /** A light is being dragged (true) or let go (false), with the light's id. */
  onDragging?: (dragging: boolean, id: string) => void;
  /** Beside the board: a 3D view of the lights. */
  preview?: ReactNode;
  /** At most this many lights. Default 6. */
  max?: number;
  help?: string;
}

// Kept a little inside the board, so a dot never hangs over its edge.
const clamp01 = (n: number) => Math.min(0.96, Math.max(0.04, Number(n.toFixed(3))));

export function StudioLightboard({
  value,
  onChange,
  label,
  id,
  disabled,
  selected,
  onSelect,
  onDragging,
  preview,
  max = 6,
  help,
}: StudioLightboardProps) {
  const sid = studioId(label, id);
  const board = useRef<HTMLDivElement>(null);
  const dragging = useRef<string>();
  const [own, setOwn] = useState(value.lights[0]?.id);
  const names = lightNames(value);
  const chosenId = selected ?? own;
  const chosen = value.lights.find((l) => l.id === chosenId) ?? value.lights[0];
  const select = (lightId: string) => {
    setOwn(lightId);
    onSelect?.(lightId);
  };

  const setLight = (lightId: string, change: Partial<StudioLight>) =>
    onChange({ lights: value.lights.map((l) => (l.id === lightId ? { ...l, ...change } : l)) });

  const toBoard = (x: number, y: number) => {
    const r = board.current?.getBoundingClientRect();
    if (!r) return;
    return { x: clamp01((x - r.left) / r.width), y: clamp01((y - r.top) / r.height) };
  };
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled || e.button !== 0) return;
    const dot = (e.target as HTMLElement).closest<HTMLElement>("[data-light]");
    const lightId = dot?.dataset.light ?? chosen?.id;
    if (!lightId) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = lightId;
    select(lightId);
    board.current?.querySelector<HTMLElement>(`[data-light="${lightId}"]`)?.focus({ preventScroll: true });
    onDragging?.(true, lightId);
    if (!dot) {
      const at = toBoard(e.clientX, e.clientY);
      if (at) setLight(lightId, at);
    }
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const lightId = dragging.current;
    if (!lightId || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const at = toBoard(e.clientX, e.clientY);
    if (at) setLight(lightId, at);
  };
  const up = () => {
    const lightId = dragging.current;
    dragging.current = undefined;
    if (lightId) onDragging?.(false, lightId);
  };
  const keys = (l: StudioLight) => (e: KeyboardEvent<HTMLButtonElement>) => {
    const by = e.shiftKey ? 0.1 : 0.02;
    const d = (
      { ArrowRight: [by, 0], ArrowLeft: [-by, 0], ArrowUp: [0, -by], ArrowDown: [0, by] } as Record<
        string,
        [number, number]
      >
    )[e.key];
    if (!d) return;
    e.preventDefault();
    setLight(l.id, { x: clamp01(l.x + d[0]), y: clamp01(l.y + d[1]) });
  };

  const add = () => {
    const have = new Set(value.lights.map((l) => l.kind));
    const kind = kindOrder.find((k) => !have.has(k)) ?? "fill";
    const base = {
      key: { x: 0.8, y: 0.3, height: 25 },
      fill: { x: 0.2, y: 0.6, height: 20 },
      rim: { x: 0.5, y: 0.1, height: 35 },
      practical: { x: 0.3, y: 0.2, height: 10 },
    }[kind];
    const n: StudioLight = {
      id: `l-${Date.now().toString(36)}`,
      kind,
      ...base,
      warmth: 3200,
      strength: kind === "key" ? 80 : 40,
      softness: 70,
    };
    onChange({ lights: [...value.lights, n] });
    select(n.id);
  };
  const remove = () => {
    if (!chosen || value.lights.length < 2) return;
    const rest = value.lights.filter((l) => l.id !== chosen.id);
    onChange({ lights: rest });
    select(rest[0]!.id);
  };

  const part = (
    key: "warmth" | "strength" | "softness" | "height",
    name: string,
    min: number,
    maxV: number,
    unit: string,
    step = 1,
  ) =>
    chosen && (
      <div className="ui-sl-part">
        <span className="ui-sc-label" aria-hidden="true">
          {name}
        </span>
        <StudioSlider
          bare
          label={`${names[chosen.id]} light: ${name.toLowerCase()}`}
          id={`${sid}-${key}`}
          value={chosen[key]}
          min={min}
          max={maxV}
          step={step}
          unit={unit}
          disabled={disabled}
          onChange={(n) => setLight(chosen.id, { [key]: n })}
        />
        <span className="ui-sc-readout">{withUnit(chosen[key], unit)}</span>
      </div>
    );

  return (
    <StudioRow
      label={label}
      labelId={`${sid}-l`}
      readout={`${value.lights.length} ${value.lights.length === 1 ? "light" : "lights"}`}
      help={help}
      disabled={disabled}
    >
      <div className="ui-sl" role="group" aria-labelledby={`${sid}-l`}>
        <div className="ui-sl-stage" data-preview={preview ? "" : undefined}>
          <div
            ref={board}
            className="ui-sl-board"
            data-disabled={disabled ? "" : undefined}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
          >
            <span className="ui-sl-subject" aria-hidden="true" />
            <Icon name="camera" className="ui-sl-camera" />
            {value.lights.map((l) => (
              <button
                key={l.id}
                type="button"
                data-light={l.id}
                className="ui-sl-dot"
                aria-pressed={l.id === chosen?.id}
                aria-label={`${names[l.id]} light, ${Math.round(l.x * 100)} % across, ${Math.round(l.y * 100)} % toward the camera. Arrow keys move it.`}
                disabled={disabled}
                style={{ "--x": l.x, "--y": l.y } as CSSProperties}
                onKeyDown={keys(l)}
                onFocus={() => select(l.id)}
              >
                {names[l.id]!.charAt(0)}
              </button>
            ))}
          </div>
          {preview && <div className="ui-sl-preview">{preview}</div>}
        </div>

        <div className="ui-sl-lights">
          <SegmentedControl
            className="ui-sl-pick"
            aria-label="Chosen light"
            value={chosen?.id ?? ""}
            onValueChange={select}
          >
            {value.lights.map((l) => (
              <SegmentedOption key={l.id} value={l.id} disabled={disabled}>
                {names[l.id]}
              </SegmentedOption>
            ))}
          </SegmentedControl>
          <Button
            size="sm"
            variant="quiet"
            iconOnly
            icon="plus"
            aria-label="Add a light"
            disabled={disabled || value.lights.length >= max}
            onClick={add}
          />
          <Button
            size="sm"
            variant="quiet"
            iconOnly
            icon="trash"
            aria-label={chosen ? `Remove the ${names[chosen.id]!.toLowerCase()} light` : "Remove the light"}
            disabled={disabled || value.lights.length < 2}
            onClick={remove}
          />
        </div>

        {chosen && (
          <div className="ui-sl-parts">
            <SegmentedControl
              className="ui-sc-seg ui-sl-kind"
              aria-label={`${names[chosen.id]} light: kind`}
              value={chosen.kind}
              onValueChange={(k) => setLight(chosen.id, { kind: k as StudioLight["kind"] })}
            >
              {kindOrder.map((k) => (
                <SegmentedOption key={k} value={k} disabled={disabled}>
                  {lightKindNames[k]}
                </SegmentedOption>
              ))}
            </SegmentedControl>
            {part("warmth", "Warmth", 2000, 6500, "K", 100)}
            {part("strength", "Strength", 0, 100, "%")}
            {part("softness", "Softness", 0, 100, "%")}
            {part("height", "Height", 0, 90, "°", 5)}
          </div>
        )}
      </div>
    </StudioRow>
  );
}

export interface StudioLightOverlayProps {
  rig: StudioLightRig;
  /** The light being moved: drawn a little stronger. */
  selected?: string;
  /** Shown while true; fades out when it turns false. */
  active: boolean;
}

/** The lights drawn on the creative while one is dragged (FLOWS §18): a soft white light where each one falls on
 *  the frame, stronger for a strong light and wider for a soft one. A picture of the light, not UI chrome: it is
 *  a blurred white disc over the creative, never a gradient. Put it inside the creative's frame (position: relative). */
export function StudioLightOverlay({ rig, selected, active }: StudioLightOverlayProps) {
  return (
    <span className="ui-sl-overlay" data-active={active ? "" : undefined} aria-hidden="true">
      {rig.lights.map((l) => {
        const at = lightOnFrame(l);
        return (
          <span
            key={l.id}
            className="ui-sl-glow"
            data-selected={l.id === selected ? "" : undefined}
            style={
              {
                "--x": at.x,
                "--y": at.y,
                "--power": (l.strength / 100).toFixed(2),
                "--soft": (l.softness / 100).toFixed(2),
              } as CSSProperties
            }
          />
        );
      })}
      {rig.lights
        .filter((l) => l.id === selected)
        .map((l) => {
          const at = lightOnFrame(l);
          return <span key={l.id} className="ui-sl-pin" style={{ "--x": at.x, "--y": at.y } as CSSProperties} />;
        })}
    </span>
  );
}
