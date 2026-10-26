// Look sources (FLOWS §18): every section that sets a look (Light, Camera, a section with a brand preset) says where
// its look comes from, with the same four words at its head (five when the creative belongs to a campaign with a look
// of its own):
//   StudioSource        (Campaign ·) Brand · Fume · Own · Engine, a small segmented control
//   StudioPresetPicker  the presets of the chosen source as rows (a picture or a colour, a name, a line)
//   StudioSummary       the section's values in words, read-only, while a preset sets them
//   StudioEngineNote    the quiet line that takes the controls' place when the Engine decides
//   <StudioSource label="Light" value={source} brand="LYSNE" onChange={setSource} />
import { type CSSProperties, type KeyboardEvent, type ReactNode, useRef } from "react";
import { Button } from "../controls/button";
import { SegmentedControl, SegmentedOption } from "../controls/segmented";
import { cx } from "../cx";
import { Icon } from "../icons";
import type { StudioLookSource } from "./types";

export const lookSourceNames: Record<StudioLookSource, string> = {
  campaign: "Campaign",
  brand: "Brand",
  fume: "Fume",
  own: "Own",
  engine: "Engine",
};
const order: StudioLookSource[] = ["campaign", "brand", "fume", "own", "engine"];

export interface StudioSourceProps {
  value: StudioLookSource;
  onChange: (source: StudioLookSource) => void;
  /** The section it sets ("Light"): names the control for assistive tech. */
  label: string;
  /** The brand's name, said on the Brand option ("LYSNE’s own"). */
  brand?: string;
  /** The creative's campaign when it has a look of its own ("Black Friday"): adds the Campaign option, first. */
  campaign?: string;
  /** Sources with nothing to offer (no brand preset yet): shown, not choosable. */
  unavailable?: StudioLookSource[];
  disabled?: boolean;
  className?: string;
}

export function StudioSource({
  value,
  onChange,
  label,
  brand,
  campaign,
  unavailable = [],
  disabled,
  className,
}: StudioSourceProps) {
  const title: Record<StudioLookSource, string> = {
    campaign: campaign ? `${campaign}’s look` : "The campaign’s look",
    brand: brand ? `${brand}’s own` : "The brand’s own",
    fume: "One of Fume’s presets",
    own: "Set it yourself",
    engine: "The Engine decides",
  };
  return (
    <SegmentedControl
      className={cx("ui-sc-seg ui-sl-source", campaign && "ui-sl-source--five", className)}
      aria-label={`${label} comes from`}
      value={value}
      onValueChange={(v) => !disabled && onChange(v as StudioLookSource)}
    >
      {order
        .filter((s) => s !== "campaign" || campaign)
        .map((s) => (
          <SegmentedOption
            key={s}
            value={s}
            title={unavailable.includes(s) ? `${title[s]}: none yet` : title[s]}
            disabled={disabled || unavailable.includes(s)}
          >
            {lookSourceNames[s]}
          </SegmentedOption>
        ))}
    </SegmentedControl>
  );
}

export interface StudioPresetItem {
  id: string;
  name: string;
  /** One line under the name: what it is ("Low side light from the right, warm, 2700 K", the camera and lens). */
  line?: string;
  /** Data at the end of the name line ("85 mm"). */
  meta?: string;
  /** A picture (a camera) … */
  image?: string;
  /** … or a colour (a background), shown through --swatch. */
  hex?: string;
}

export interface StudioPresetPickerProps {
  items: StudioPresetItem[];
  /** The preset in force, if one is. */
  value?: string;
  onPick: (id: string) => void;
  /** Names the group ("LYSNE’s light"). */
  label: string;
  disabled?: boolean;
  className?: string;
}

/** One of a few presets, as rows you pick (a radio group: arrow keys move). */
export function StudioPresetPicker({ items, value, onPick, label, disabled, className }: StudioPresetPickerProps) {
  const list = useRef<HTMLDivElement>(null);
  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = ({ ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 } as Record<string, number>)[e.key];
    if (!step || !items.length) return;
    e.preventDefault();
    const i = Math.max(
      0,
      items.findIndex((x) => x.id === value),
    );
    const next = items[(i + step + items.length) % items.length]!;
    onPick(next.id);
    requestAnimationFrame(() => list.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus());
  };
  return (
    <div ref={list} role="radiogroup" aria-label={label} className={cx("ui-sl-presets", className)} onKeyDown={keys}>
      {items.map((p, i) => {
        const on = p.id === value;
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on || (!value && i === 0) ? 0 : -1}
            disabled={disabled}
            className="ui-sl-preset"
            data-picture={p.image ? "" : undefined}
            onClick={() => onPick(p.id)}
          >
            {p.image ? (
              <img className="ui-sl-preset-picture" src={p.image} alt="" loading="lazy" />
            ) : p.hex ? (
              <span className="ui-sl-preset-swatch" style={{ "--swatch": p.hex } as CSSProperties} aria-hidden="true" />
            ) : null}
            <span className="ui-sl-preset-text">
              <span className="ui-sl-preset-head">
                <span className="ui-sl-preset-name">{p.name}</span>
                {p.meta && <span className="ui-sl-preset-meta">{p.meta}</span>}
              </span>
              {p.line && <span className="ui-sl-preset-line">{p.line}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export interface StudioSummaryProps {
  rows: { label: string; value: ReactNode }[];
  /** "Adjust": switch to Own, starting from these values. */
  onAdjust?: () => void;
  disabled?: boolean;
}

/** The section's values in words while a preset sets them, with Adjust to take them over. */
export function StudioSummary({ rows, onAdjust, disabled }: StudioSummaryProps) {
  return (
    <div className="ui-sl-summary">
      {rows.length > 0 && (
        <dl className="ui-sl-summary-rows">
          {rows.map((r) => (
            <div key={r.label} className="ui-sl-summary-row">
              <dt>{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {onAdjust && (
        <Button
          size="sm"
          variant="secondary"
          icon="sliders-horizontal"
          className="ui-sl-adjust"
          disabled={disabled}
          onClick={onAdjust}
        >
          Adjust
        </Button>
      )}
    </div>
  );
}

/** When the Engine decides: a quiet line in place of the controls ("The Engine decides the light"). */
export function StudioEngineNote({ children }: { children: ReactNode }) {
  return (
    <p className="ui-sl-engine">
      <Icon name="fume-engine" className="ui-sl-engine-icon" />
      <span>{children}</span>
    </p>
  );
}
