// StudioPlace: where something sits, as a box of nine places (round 16, PROPOSED 9 Nov 2026). Marcus: "Align as a box
// grid with different places, instead of tabs." Top left to bottom right, like Figma's alignment box and a photo
// editor's anchor. The place it is in now is marked; none is marked when it sits between places. Arrow keys move
// across and down (a radio group laid out in two directions); a press places it.
//   <StudioPlace label="Align" value="top-left" onChange={place} help="Inside the safe area." />
import { useRef, type KeyboardEvent } from "react";
import { StudioRow } from "./row";
import { studioId, type StudioControlProps } from "./types";

export type StudioPlaceValue =
  | "top-left"
  | "top-centre"
  | "top-right"
  | "middle-left"
  | "middle-centre"
  | "middle-right"
  | "bottom-left"
  | "bottom-centre"
  | "bottom-right";

const ROWS = ["top", "middle", "bottom"] as const;
const COLS = ["left", "centre", "right"] as const;
export const studioPlaces = ROWS.flatMap((r) => COLS.map((c) => `${r}-${c}` as StudioPlaceValue));

/** "Top left", "Centre" (the middle of the middle), "Bottom right". */
export function placeWords(p: StudioPlaceValue): string {
  if (p === "middle-centre") return "Centre";
  const [r, c] = p.split("-") as [string, string];
  return `${r.charAt(0).toUpperCase()}${r.slice(1)} ${c}`;
}

export interface StudioPlaceProps extends Omit<StudioControlProps<string>, "value" | "onChange"> {
  /** The place it is in now; none when it sits between places. */
  value?: StudioPlaceValue;
  onChange: (p: StudioPlaceValue) => void;
  /** Places that cannot be chosen (left out of the keyboard's way, shown quiet). */
  without?: StudioPlaceValue[];
  help?: string;
}

export function StudioPlace({ value, onChange, label, id, disabled, without = [], help }: StudioPlaceProps) {
  const sid = studioId(label, id);
  const box = useRef<HTMLDivElement>(null);
  const focusAt = (p: StudioPlaceValue) =>
    requestAnimationFrame(() => box.current?.querySelector<HTMLElement>(`[data-place="${p}"]`)?.focus());
  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    const move = (
      { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] } as Record<
        string,
        [number, number]
      >
    )[e.key];
    if (!move) return;
    e.preventDefault();
    const at = (e.target as HTMLElement).dataset.place as StudioPlaceValue | undefined;
    const i = studioPlaces.indexOf(at ?? value ?? "middle-centre");
    let r = Math.floor(i / 3);
    let c = i % 3;
    for (let n = 0; n < 3; n++) {
      r = Math.min(2, Math.max(0, r + move[0]));
      c = Math.min(2, Math.max(0, c + move[1]));
      const next = studioPlaces[r * 3 + c]!;
      if (!without.includes(next)) {
        onChange(next);
        focusAt(next);
        return;
      }
    }
  };
  return (
    <StudioRow
      label={label}
      labelId={`${sid}-l`}
      readout={value ? placeWords(value) : "Between places"}
      help={help}
      disabled={disabled}
    >
      <div ref={box} id={sid} role="radiogroup" aria-labelledby={`${sid}-l`} className="ui-sc-place" onKeyDown={keys}>
        {studioPlaces.map((p) => {
          const on = p === value;
          const off = disabled || without.includes(p);
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={placeWords(p)}
              data-place={p}
              disabled={off}
              tabIndex={on || (!value && p === "middle-centre") ? 0 : -1}
              className="ui-sc-place-cell"
              onClick={() => onChange(p)}
            >
              <span className="ui-sc-place-mark" aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </StudioRow>
  );
}
