// The row every Studio control sits in (studio-controls.css .ui-sc): a 12 px label, the value as data at the end of
// the label line, the control under it and an optional help line. Inline controls (a toggle) sit on the label line.
//   <StudioRow label="Softness" htmlFor="sc-softness" readout="60 %"><StudioSlider … /></StudioRow>
import { type HTMLAttributes, type ReactNode } from "react";
import { cx } from "../cx";

export interface StudioRowProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  label: ReactNode;
  /** The control's id, so the label names it; omit for a group (the label then names it through labelId). */
  htmlFor?: string;
  /** The label's own id, for aria-labelledby on a group (segmented, swatches, chips, the dial). */
  labelId?: string;
  /** The value in words or numbers at the end of the label line ("65", "2700 K", "LYSNE packshot white"). */
  readout?: ReactNode;
  /** A control that sits at the end of the label line instead of under it (a switch). */
  inline?: ReactNode;
  help?: ReactNode;
  disabled?: boolean;
}

export function StudioRow({
  label,
  htmlFor,
  labelId,
  readout,
  inline,
  help,
  disabled,
  className,
  children,
  ...props
}: StudioRowProps) {
  return (
    <div className={cx("ui-sc", className)} data-disabled={disabled ? "" : undefined} {...props}>
      <div className="ui-sc-head">
        {htmlFor ? (
          <label className="ui-sc-label" htmlFor={htmlFor} id={labelId}>
            {label}
          </label>
        ) : (
          <span className="ui-sc-label" id={labelId}>
            {label}
          </span>
        )}
        {readout !== undefined && readout !== null && readout !== "" ? (
          <span className="ui-sc-readout">{readout}</span>
        ) : null}
        {inline}
      </div>
      {children}
      {help ? <p className="ui-sc-help">{help}</p> : null}
    </div>
  );
}
