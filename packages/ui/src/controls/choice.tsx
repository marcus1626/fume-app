// Choice row (design-system/components/choice.css): the label that pairs a Checkbox, RadioGroupItem or Switch with
// its words, so a click on the words toggles the control and shows its hover and pressed state.
//   <Choice><Checkbox checked={on} onCheckedChange={…} /><ChoiceText label="Product photography" hint="14 photos" /></Choice>
//   <Choice end><ChoiceText label="Safe zones" /><Switch /></Choice>   (control at the end: settings lists)
// A group: <ChoiceGroup legend="In the brief for the Engine">…rows…</ChoiceGroup>, rows 12 apart.
import { forwardRef, useId, type HTMLAttributes, type LabelHTMLAttributes, type ReactNode } from "react";
import { cx } from "../cx";
import { Icon } from "../icons";

export interface ChoiceProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** The control at the end of the row (.ui-choice--end). */
  end?: boolean;
  /** Reads the row as disabled (also automatic when the control is disabled). */
  disabled?: boolean;
}

export const Choice = forwardRef<HTMLLabelElement, ChoiceProps>(function Choice(
  { end = false, disabled, className, ...props },
  ref,
) {
  return (
    <label
      ref={ref}
      data-disabled={disabled ? "" : undefined}
      className={cx("ui-choice", end && "ui-choice--end", className)}
      {...props}
    />
  );
});

export interface ChoiceTextProps extends HTMLAttributes<HTMLSpanElement> {
  /** The option's words. */
  label?: ReactNode;
  /** A quieter line under it. */
  hint?: ReactNode;
  /** What is wrong, in Rouge words after the alert icon. Give it errorId and point the control's aria-describedby at it. */
  error?: ReactNode;
  errorId?: string;
}

/** The words of a row: label, hint, error. Children go after them. */
export const ChoiceText = forwardRef<HTMLSpanElement, ChoiceTextProps>(function ChoiceText(
  { label, hint, error, errorId, className, children, ...props },
  ref,
) {
  return (
    <span ref={ref} className={cx("ui-choice-text", className)} {...props}>
      {label !== undefined ? <span className="ui-choice-label">{label}</span> : null}
      {hint !== undefined ? <span className="ui-choice-hint">{hint}</span> : null}
      {error ? (
        <span className="ui-choice-error" id={errorId} role="alert">
          <Icon name="circle-alert" />
          {error}
        </span>
      ) : null}
      {children}
    </span>
  );
});

/** The label line alone (.ui-choice-label), for custom ChoiceText content. */
export const ChoiceLabel = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>(function ChoiceLabel(
  { className, ...props },
  ref,
) {
  return <span ref={ref} className={cx("ui-choice-label", className)} {...props} />;
});

/** The hint line alone (.ui-choice-hint). */
export const ChoiceHint = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>(function ChoiceHint(
  { className, ...props },
  ref,
) {
  return <span ref={ref} className={cx("ui-choice-hint", className)} {...props} />;
});

export interface ChoiceGroupProps extends HTMLAttributes<HTMLDivElement> {
  /** The group's title, 8 above its rows; labels the group. */
  legend?: ReactNode;
}

/** Rows that belong together: role="group", 12 apart. Checkbox rows go here; radios go in a RadioGroup. */
export const ChoiceGroup = forwardRef<HTMLDivElement, ChoiceGroupProps>(function ChoiceGroup(
  { legend, className, children, ...props },
  ref,
) {
  const id = useId();
  return (
    <div
      ref={ref}
      role="group"
      aria-labelledby={legend !== undefined ? id : undefined}
      className={cx("ui-choice-group", className)}
      {...props}
    >
      {legend !== undefined ? (
        <span className="ui-choice-legend" id={id}>
          {legend}
        </span>
      ) : null}
      {children}
    </div>
  );
});
