// Progress (design-system/components/progress.css), shadcn's progress (Radix Progress attributes, no Radix
// dependency needed): a thin pill track with an Ink fill, never Amber. --value is the percentage the CSS reads.
// With words: <ProgressField><ProgressHead label="Generating creatives" id="g" num="7 / 12" />
//   <Progress value={7} max={12} aria-labelledby="g" /></ProgressField>
// Steps: the four stages of a campaign as segments (Brief, Generate, Quality Gate, Delivered).
import {
  Children,
  forwardRef,
  type CSSProperties,
  type HTMLAttributes,
  type OlHTMLAttributes,
  type ReactNode,
} from "react";
import { cx } from "../cx";
import { Icon } from "../icons";

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  /** Work done, from 0 to max. Leave it out (or null) for indeterminate: a segment sweeps across. */
  value?: number | null;
  /** Default 100. */
  max?: number;
  /** On glass: a Porcelain veil track and a Porcelain fill. */
  glass?: boolean;
}

type ProgressState = "loading" | "complete" | "indeterminate";

export const Progress = forwardRef<HTMLDivElement, ProgressProps>(function Progress(
  { value = null, max = 100, glass = false, className, style, ...props },
  ref,
) {
  const known = value !== null && Number.isFinite(value) && max > 0;
  const clamped = known ? Math.min(Math.max(value as number, 0), max) : 0;
  const state: ProgressState = !known ? "indeterminate" : clamped >= max ? "complete" : "loading";
  const pct = known ? Math.round((clamped / max) * 1000) / 10 : undefined;
  return (
    <div
      ref={ref}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={known ? clamped : undefined}
      data-state={state}
      data-value={known ? clamped : undefined}
      data-max={max}
      className={cx("ui-progress", glass && "ui-progress--glass", className)}
      style={pct !== undefined ? ({ ...style, "--value": pct } as CSSProperties) : style}
      {...props}
    >
      <span className="ui-progress-indicator" />
    </div>
  );
});

export interface ProgressFieldProps extends HTMLAttributes<HTMLDivElement> {
  /** On glass: Porcelain words. Use with <Progress glass />. */
  glass?: boolean;
}

/** A label and value above a track, 8 apart. */
export const ProgressField = forwardRef<HTMLDivElement, ProgressFieldProps>(function ProgressField(
  { glass = false, className, ...props },
  ref,
) {
  return (
    <div ref={ref} className={cx("ui-progress-field", glass && "ui-progress-field--glass", className)} {...props} />
  );
});

export interface ProgressHeadProps extends Omit<HTMLAttributes<HTMLDivElement>, "id"> {
  /** What is under way: "Generating creatives". */
  label: ReactNode;
  /** The label's id, for aria-labelledby on the Progress or Steps. */
  labelId?: string;
  /** The value as data, in the mono face: "7 / 12". */
  num?: ReactNode;
  /** Or a quiet hint instead: "A few seconds", "Step 2 of 4". */
  hint?: ReactNode;
}

/** The line above a track: the label at the start, the value or a hint at the end. */
export const ProgressHead = forwardRef<HTMLDivElement, ProgressHeadProps>(function ProgressHead(
  { label, labelId, num, hint, className, ...props },
  ref,
) {
  return (
    <div ref={ref} className={cx("ui-progress-head", className)} {...props}>
      <span id={labelId}>{label}</span>
      {num !== undefined ? <span className="ui-progress-num">{num}</span> : null}
      {hint !== undefined ? <span className="ui-progress-hint">{hint}</span> : null}
    </div>
  );
});

export interface StepsProps extends OlHTMLAttributes<HTMLOListElement> {}

/** The stages of a campaign as segments 4 apart (an <ol>). Label it with aria-labelledby. */
export const Steps = forwardRef<HTMLOListElement, StepsProps>(function Steps(
  { className, style, children, ...props },
  ref,
) {
  const n = Children.count(children);
  return (
    <ol
      ref={ref}
      className={cx("ui-steps", className)}
      style={n !== 4 ? ({ ...style, "--steps": n } as CSSProperties) : style}
      {...props}
    >
      {children}
    </ol>
  );
});

export interface StepsItemProps extends HTMLAttributes<HTMLLIElement> {
  /** complete (Ink, with a check), active (filling, aria-current="step"), upcoming (sunken). */
  state: "complete" | "active" | "upcoming";
  /** How far the active stage is, 0 to 100. */
  value?: number;
}

/** One stage: its segment and its name (children) under it. */
export const StepsItem = forwardRef<HTMLLIElement, StepsItemProps>(function StepsItem(
  { state, value, className, children, ...props },
  ref,
) {
  const pct = state === "active" && value !== undefined ? Math.min(Math.max(value, 0), 100) : undefined;
  return (
    <li
      ref={ref}
      className={cx("ui-steps-item", className)}
      data-state={state}
      aria-current={state === "active" ? "step" : undefined}
      {...props}
    >
      <span
        className="ui-progress"
        aria-hidden="true"
        style={pct !== undefined ? ({ "--value": pct } as CSSProperties) : undefined}
      >
        <span className="ui-progress-indicator" />
      </span>
      <span className="ui-steps-label">
        {state === "complete" ? <Icon name="check" /> : null}
        <span>{children}</span>
      </span>
    </li>
  );
});
