// Engine run: the steps the Engine takes for a brief (design-system/components/run.css). DECIDED 13 Oct, round 8.
// A card with steps parted by space (no rail): a check when done, the spinner while it works, a grey dot before
// it starts, pause or stop when you held it, the circle-alert in Rouge when it failed, and for the Quality Gate
// the checked triangle in grey while it waits for Anna. Generating says "4 of 12" as data, fills an Ink bar and
// the creatives arrive soft to sharp. The run card never turns Amber: the Amber check belongs to each creative
// Anna checked (RunTile check).
import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cx } from "../cx";
import { Icon, type IconName } from "../icons";
import { Btn, ProgressBar, Spinner, formatAttrs, vars, type BtnVariant, type CreativeFormat } from "./_parts";

/** Contract RunState plus "stopped" (stopped by you), which run.css draws. */
export type EngineRunState = "queued" | "running" | "paused" | "stopped" | "failed" | "done";
/** Contract StepState. */
export type EngineStepState = "pending" | "active" | "done" | "waiting" | "paused" | "stopped" | "failed";

export interface RunTileData {
  /** done: made; active: being made (breathes); pending: a still slot; failed: could not be made. */
  state: "done" | "active" | "pending" | "failed";
  src?: string;
  /** "Creative 3". */
  alt?: string;
  format?: CreativeFormat;
  /** The check under a made creative: Amber triangle beside the checker's name, grey beside "In check". */
  check?: { state: "checked" | "in_check"; by?: string; time?: string };
}

export interface EngineRunStepData {
  label: ReactNode;
  state: EngineStepState;
  /** Words under the label (the reason a step failed, "Paused by you. Nothing made is lost."). */
  detail?: ReactNode;
  /** "4 of 12" as data beside the label, and an Ink bar in the detail while active, paused or stopped. */
  progress?: { made: number; total: number; label?: string };
  /** The creatives, under the step that makes them. */
  tiles?: RunTileData[];
}

export interface EngineRunProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** "Autumn launch". */
  title: string;
  /** What it is for: "Night Body Oil · Feed, Story, Banner". */
  description?: ReactNode;
  state: EngineRunState;
  /** The time it has run, as data ("2:14"). */
  time?: string;
  steps: EngineRunStepData[];
  /** Replaces the status badge (the chat passes the step under way: "Anna is checking · 6 of 9"). */
  badge?: ReactNode;
  /** The failed badge's words ("1 creative failed"). */
  failedLabel?: string;
  /** Buttons at the foot: EngineRunAction. Pause and stop are the person's. */
  actions?: ReactNode;
}

const BADGE: Record<EngineRunState, { dot?: "live" | "danger" | "idle"; icon?: IconName; words: string }> = {
  queued: { dot: "idle", words: "Queued" },
  // Round 9 (DLOAD-11): "Running" was a system word; the card says what a person would.
  running: { dot: "live", words: "Under way" },
  paused: { icon: "pause", words: "Paused" },
  stopped: { icon: "square", words: "Stopped by you" },
  failed: { dot: "danger", words: "Failed" },
  done: { icon: "check", words: "Done" },
};

/** The status badge of a run (badge.css), never Amber. */
export function EngineRunBadge({ state, label }: { state: EngineRunState; label?: string }) {
  const b = BADGE[state];
  return (
    <span className="ui-badge">
      {b.dot && <span className={cx("ui-badge-dot", `ui-badge-dot--${b.dot}`)} aria-hidden="true" />}
      {b.icon && <Icon name={b.icon} />}
      {label ?? b.words}
    </span>
  );
}

const SIGN: Record<EngineStepState, ReactNode> = {
  done: <Icon name="check" />,
  active: <Spinner label="Working" />,
  paused: <Icon name="pause" />,
  stopped: <Icon name="square" />,
  failed: <Icon name="circle-alert" />,
  waiting: <Icon name="fume-check" />,
  pending: null,
};

function Tile({ tile, i }: { tile: RunTileData; i: number }) {
  const name = tile.alt ?? `Creative ${i + 1}`;
  const fa = formatAttrs(tile.format);
  let body: ReactNode;
  if (tile.state === "done")
    body = (
      <div className="ui-creative-media" {...fa}>
        {tile.src && <img src={tile.src} alt={name} />}
      </div>
    );
  else if (tile.state === "active")
    body = (
      <div
        className="ui-skeleton ui-skeleton--creative"
        role="img"
        aria-label={`${name}, being made`}
        {...fa}
        style={{ ...fa.style, ...vars({ "--i": i }) }}
      />
    );
  else if (tile.state === "failed")
    body = (
      <div className="ui-run-slot" role="img" aria-label={`${name} couldn’t be made`} {...fa}>
        <Icon name="circle-alert" />
      </div>
    );
  else body = <div className="ui-run-slot" aria-hidden="true" {...fa} />;
  return (
    <li className="ui-run-tile" data-state={tile.state}>
      {body}
      {tile.state === "done" && tile.check && (
        <span className="ui-creative-check" data-check={tile.check.state === "checked" ? "approved" : "waiting"}>
          <Icon name="fume-check" />
          {tile.check.state === "checked" ? (tile.check.by ?? "Checked") : "In check"}
          {tile.check.state === "checked" && tile.check.time && (
            <>
              {" "}
              <span className="ui-creative-time">{tile.check.time}</span>
            </>
          )}
        </span>
      )}
    </li>
  );
}

/** One step: li.ui-run-step[data-state] with its sign, label, "n of m", detail and tiles. */
export function EngineRunStep({ step }: { step: EngineRunStepData }) {
  const p = step.progress;
  const bar = p && (step.state === "active" || step.state === "paused" || step.state === "stopped");
  return (
    <li className="ui-run-step" data-state={step.state}>
      <span className="ui-run-step-icon">{SIGN[step.state]}</span>
      <span className="ui-run-step-label">{step.label}</span>
      {p && (
        <span className="ui-run-num">
          {p.made} of {p.total}
        </span>
      )}
      {(bar || step.detail) && (
        <div className="ui-run-step-detail">
          {bar && p && <ProgressBar value={p.made} max={p.total} label={p.label ?? "Creatives made"} />}
          {typeof step.detail === "string" ? <span>{step.detail}</span> : step.detail}
        </div>
      )}
      {step.tiles && step.tiles.length > 0 && (
        <ul className="ui-run-tiles" aria-label="Creatives">
          {step.tiles.map((t, i) => (
            <Tile key={i} tile={t} i={i} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** div.ui-card.ui-run[data-state][role=group]: the run card. */
export const EngineRun = forwardRef<HTMLDivElement, EngineRunProps>(function EngineRun(
  { title, description, state, time, steps, badge, failedLabel, actions, className, ...props },
  ref,
) {
  // Done only when every line is done (round 9, DLOAD-2): a run whose making is over while a step still works or
  // waits (the Quality Gate) wears "Under way", never "Done" next to a spinner.
  const open = state === "done" && steps.some((s) => s.state !== "done");
  const shown: EngineRunState = open ? "running" : state;
  return (
    <div
      ref={ref}
      className={cx("ui-card ui-run", className)}
      data-state={shown}
      role="group"
      aria-label={`Engine run for ${title}`}
      {...props}
    >
      <div className="ui-run-header">
        <div className="ui-run-heading">
          <h4 className="ui-run-title">{title}</h4>
          {description && <p className="ui-run-description">{description}</p>}
        </div>
        <div className="ui-run-status">
          {badge ?? <EngineRunBadge state={shown} label={state === "failed" ? failedLabel : undefined} />}
          {time && <span className="ui-run-time">{time}</span>}
        </div>
      </div>
      <ol className="ui-run-steps">
        {steps.map((s, i) => (
          <EngineRunStep key={i} step={s} />
        ))}
      </ol>
      {actions && <div className="ui-run-actions">{actions}</div>}
    </div>
  );
});

export interface EngineRunActionProps extends Omit<HTMLAttributes<HTMLButtonElement>, "children"> {
  /** quiet for Pause and Stop; secondary (white) for Resume, Try again, Make the other 6. */
  variant?: Extract<BtnVariant, "quiet" | "secondary" | "primary">;
  icon?: IconName;
  children: ReactNode;
  disabled?: boolean;
}

/** A button at the run's foot: button.ui-btn.ui-btn--{variant}.ui-btn--sm with its icon. */
export const EngineRunAction = forwardRef<HTMLButtonElement, EngineRunActionProps>(function EngineRunAction(
  { variant = "quiet", icon, children, ...props },
  ref,
) {
  return (
    <Btn ref={ref} variant={variant} size="sm" icon={icon} {...props}>
      {children}
    </Btn>
  );
});

/** Time a run has taken, as run.css shows it: 134 → "2:14". */
export function runClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
