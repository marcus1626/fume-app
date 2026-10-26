// Stepper: where you are in a flow, design-system/components/stepper.css (no JS: the page that owns the flow sets the
// states). Each item carries data-state complete|current|upcoming; the current one aria-current="step"; a finished
// step is a button that goes back to it. A step that is working carries the spinner in its Ink circle (aria-busy).
// Upright (orientation "vertical") the current step can hold its content under its title. Narrow (under 560 px) a
// sideways stepper turns compact by CSS alone: "Step 2 of 5" and the title over a row of dots.
import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cx } from "../cx";
import { Icon } from "../icons";

export interface StepperStep {
  title: string;
  description?: ReactNode;
  /** The current step is working (Generate): the spinner in its circle. */
  busy?: boolean;
  /** Upright steppers: shown under the current step's title (.ui-stepper-content). */
  content?: ReactNode;
}

export interface StepperProps extends HTMLAttributes<HTMLElement> {
  /** The flow's name ("New campaign"); required for the nav landmark. */
  "aria-label": string;
  steps: StepperStep[];
  /** The current step, from 0. Steps before it are complete; after it, upcoming. */
  current: number;
  /** Going back to a finished step. Without it finished steps are not buttons. */
  onStepSelect?: (index: number) => void;
  orientation?: "horizontal" | "vertical";
  /** The summary's count words; default `Step ${n} of ${total}`. */
  countLabel?: (step: number, total: number) => string;
  /** Hidden words before a title; defaults "Done: " and "Current step: ". */
  doneStatus?: string;
  currentStatus?: string;
  /** A finished step's button name; default `${title}, done. Go back to it`. */
  backLabel?: (title: string) => string;
}

/** The whole stepper (nav.ui-stepper). */
export const Stepper = forwardRef<HTMLElement, StepperProps>(function Stepper(
  {
    steps,
    current,
    onStepSelect,
    orientation = "horizontal",
    countLabel = (n, t) => `Step ${n} of ${t}`,
    doneStatus = "Done: ",
    currentStatus = "Current step: ",
    backLabel = (t) => `${t}, done. Go back to it`,
    className,
    ...props
  },
  ref,
) {
  const at = Math.max(0, Math.min(current, steps.length - 1));
  return (
    <nav ref={ref} className={cx("ui-stepper", className)} data-orientation={orientation} {...props}>
      <p className="ui-stepper-summary">
        <span className="ui-stepper-count">{countLabel(at + 1, steps.length)}</span> {steps[at]?.title}
      </p>
      <ol className="ui-stepper-list">
        {steps.map((s, i) => {
          const state = i < at ? "complete" : i === at ? "current" : "upcoming";
          const busy = state === "current" && s.busy;
          const marker =
            state === "complete" ? (
              <Icon name="check" />
            ) : busy ? (
              <Icon name="loader-circle" className="ui-spinner" />
            ) : (
              i + 1
            );
          const inner = (
            <>
              <span className="ui-stepper-marker" aria-hidden="true">
                {marker}
              </span>
              <span className="ui-stepper-text">
                <span className="ui-stepper-title">
                  <span className="ui-stepper-status">
                    {state === "complete" ? doneStatus : state === "current" ? currentStatus : ""}
                  </span>
                  {s.title}
                </span>
                {s.description !== undefined && <span className="ui-stepper-description">{s.description}</span>}
              </span>
            </>
          );
          return (
            <li
              key={i}
              className="ui-stepper-item"
              data-state={state}
              aria-current={state === "current" ? "step" : undefined}
              aria-busy={busy || undefined}
            >
              {state === "complete" && onStepSelect ? (
                <button
                  className="ui-stepper-trigger"
                  type="button"
                  aria-label={backLabel(s.title)}
                  onClick={() => onStepSelect(i)}
                >
                  {inner}
                </button>
              ) : (
                <div className="ui-stepper-trigger">{inner}</div>
              )}
              {state === "current" && orientation === "vertical" && s.content !== undefined && (
                <div className="ui-stepper-content">{s.content}</div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
});
