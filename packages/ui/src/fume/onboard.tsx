// Onboarding: the first run (design-system/components/onboard.css). DECIDED 13 Oct, round 8 (Paper ground, round 9).
// No script of its own: a step is done when its work is. Welcome by name, one sentence on what happens next,
// three steps in order (Add your Brand DNA, Invite your team, Write your first brief), each a card with one
// action. The step to do now carries the only Ink button; the next ones are white; a finished one keeps a quiet
// way back in. A finished step's mark is an Ink circle with a Paper check, never Amber, and the words say Done.
// Below, the campaigns are empty and point at the first brief.
import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cx } from "../cx";
import { Icon, type IconName } from "../icons";
import { Avatar, Btn, ProgressBar, type PersonSign } from "./_parts";

export type OnboardingStepState = "done" | "current" | "todo";

export interface OnboardingStepData {
  id: string;
  /** "Add your Brand DNA". */
  title: string;
  /** One or two sentences on what it is for. */
  text: ReactNode;
  done: boolean;
  /** The step's one action: "Invite your team" with user-plus. */
  action: { label: string; icon?: IconName; onClick: () => void };
  /** Once done, the quiet way back in: "Open" with " Brand DNA" kept for screen readers on a phone. */
  doneAction?: { label: string; more?: string; icon?: IconName; onClick: () => void };
}

const STATE_WORDS: Record<OnboardingStepState, string> = { done: "Done", current: "Next", todo: "To do" };

/** The state of each step: done ones are done, the first not done is current, the rest are to do. */
export function onboardingStates(steps: { done: boolean }[]): OnboardingStepState[] {
  const next = steps.findIndex((s) => !s.done);
  return steps.map((s, i) => (s.done ? "done" : i === next ? "current" : "todo"));
}

export interface OnboardingStepProps extends Omit<HTMLAttributes<HTMLLIElement>, "title"> {
  /** 1-based, shown in the mark until done. */
  number: number;
  state: OnboardingStepState;
  title: string;
  text: ReactNode;
  action: OnboardingStepData["action"];
  doneAction?: OnboardingStepData["doneAction"];
  /** Replaces "Done", "Next", "To do". */
  stateLabel?: string;
}

/** li.ui-card.ui-onboard-step[data-state]: mark, state word, title, text, one action (primary now, secondary later, quiet when done). */
export const OnboardingStep = forwardRef<HTMLLIElement, OnboardingStepProps>(function OnboardingStep(
  { number, state, title, text, action, doneAction, stateLabel, className, ...props },
  ref,
) {
  const back = state === "done" ? doneAction : undefined;
  return (
    <li ref={ref} className={cx("ui-card ui-onboard-step", className)} data-state={state} {...props}>
      <div className="ui-onboard-step-top">
        <span className="ui-onboard-mark" aria-hidden="true">
          <span>{number}</span>
          <Icon name="check" />
        </span>
        <span className="ui-onboard-state">{stateLabel ?? STATE_WORDS[state]}</span>
      </div>
      <h4 className="ui-onboard-step-title">{title}</h4>
      <p className="ui-onboard-step-text">{text}</p>
      <div className="ui-onboard-step-action">
        {back ? (
          <Btn variant="quiet" icon={back.icon} aria-label={back.more ? `${back.label}${back.more}` : undefined} onClick={back.onClick}>
            <span>
              {back.label}
              {back.more && <span className="ui-onboard-more">{back.more}</span>}
            </span>
          </Btn>
        ) : (
          <Btn variant={state === "current" ? "primary" : state === "done" ? "quiet" : "secondary"} icon={action.icon} onClick={action.onClick}>
            {action.label}
          </Btn>
        )}
      </div>
    </li>
  );
});

/** ol.ui-onboard-steps: the steps, their states worked out from `done`. */
export function OnboardingSteps({ steps, className }: { steps: OnboardingStepData[]; className?: string }) {
  const states = onboardingStates(steps);
  return (
    <ol className={cx("ui-onboard-steps", className)}>
      {steps.map((s, i) => (
        <OnboardingStep key={s.id} number={i + 1} state={states[i]} title={s.title} text={s.text} action={s.action} doneAction={s.doneAction} />
      ))}
    </ol>
  );
}

export interface OnboardingSectionProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  /** "Campaigns". */
  title: string;
  /** The count, as data ("0"). */
  meta?: ReactNode;
  children: ReactNode;
}

/** section.ui-onboard-section: a titled block under the steps (the campaigns). */
export function OnboardingSection({ title, meta, className, children, ...props }: OnboardingSectionProps) {
  return (
    <section className={cx("ui-onboard-section", className)} aria-label={title} {...props}>
      <div className="ui-onboard-section-head">
        <h4 className="ui-onboard-section-title">{title}</h4>
        {meta !== undefined && <span className="ui-onboard-section-meta">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

export interface EmptyCampaignsProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  text?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

/** div.ui-empty.ui-empty--surface with the Engine's mark: "No campaigns yet" and Write your first brief. */
export function EmptyCampaigns({
  title = "No campaigns yet",
  text = "Your first brief becomes your first campaign. The Engine makes the creatives, and Anna checks each one before it reaches you.",
  actionLabel = "Write your first brief",
  onAction,
  className,
  ...props
}: EmptyCampaignsProps) {
  return (
    <div className={cx("ui-empty ui-empty--surface", className)} {...props}>
      <div className="ui-empty-header">
        <div className="ui-empty-media ui-empty-media--icon" aria-hidden="true">
          <Icon name="fume-engine" />
        </div>
        <h5 className="ui-empty-title">{title}</h5>
        <p className="ui-empty-description">{text}</p>
      </div>
      {onAction && (
        <div className="ui-empty-content">
          <Btn variant="secondary" icon="file-text" onClick={onAction}>
            {actionLabel}
          </Btn>
        </div>
      )}
    </div>
  );
}

export interface OnboardingProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** "LYSNE": the title says "Welcome to Fume, LYSNE", and "You are set up, LYSNE" when every step is done. */
  workspace: string;
  /** The person in the eyebrow ("LYSNE · Marcus"); the workspace's mark is an Ink avatar. */
  person?: string;
  workspaceSign?: PersonSign;
  title?: string;
  lede?: ReactNode;
  steps: OnboardingStepData[];
  /** Under the steps: OnboardingSection with EmptyCampaigns. */
  children?: ReactNode;
}

/** div.ui-onboard > div.ui-onboard-screen: the welcome, the progress (n / 3 as data), the steps, then the children. */
export const Onboarding = forwardRef<HTMLDivElement, OnboardingProps>(function Onboarding(
  { workspace, person, workspaceSign, title, lede, steps, children, className, ...props },
  ref,
) {
  const done = steps.filter((s) => s.done).length;
  const all = done === steps.length && steps.length > 0;
  const words = all ? "All set" : "Getting started";
  return (
    <div ref={ref} className={cx("ui-onboard", className)} {...props}>
      <div className="ui-onboard-screen">
        <div className="ui-onboard-head">
          <div className="ui-onboard-hello">
            <p className="ui-onboard-eyebrow">
              <Avatar person={workspaceSign ?? { name: workspace, ink: true }} size="sm" />
              {person ? `${workspace} · ${person}` : workspace}
            </p>
            <h3 className="ui-onboard-title">{title ?? (all ? `You are set up, ${workspace}` : `Welcome to Fume, ${workspace}`)}</h3>
            <p className="ui-onboard-lede">
              {lede ?? `${steps.length === 3 ? "Three steps" : `${steps.length} steps`}, and the Engine can make your first creatives. Anna checks every one against your Brand DNA before you see it.`}
            </p>
          </div>
          <div className="ui-progress-field ui-onboard-progress">
            <div className="ui-progress-head">
              <span>{words}</span>
              <span className="ui-progress-num">
                {done} / {steps.length}
              </span>
            </div>
            <ProgressBar value={done} max={steps.length} label={words} />
          </div>
        </div>
        <OnboardingSteps steps={steps} />
        {children}
      </div>
    </div>
  );
});

// ─── Where she is in the brand onboarding (round 8, UX review ONB-12, ONB-16, MOB-5, WAY-15) ──────────────
// design-system/components/welcome-progress.css. PROPOSED 19 Oct 2026. One progress for the whole onboarding, held at
// the top of the screen as she scrolls: the steps by name (a step she has visited stays tappable, also one after the
// current), and in a step with parts (Check what Fume found) equal segments for the parts, a check on each part done.
// On a phone it is one line ("Step 3 of 4 · Confirm what Fume found · Colour, 2 of 5") over one thin bar.
// Round 9 (desktop review DTSK-5, PROPOSED 19 Oct 2026): a step can say what is left ("12 left"); while it does, its
// marker keeps its number instead of the tick, so a step with open finds never reads as done.

export interface WelcomeProgressStep {
  id: string;
  title: string;
  state: "done" | "current" | "todo";
  /** What is still open in this step, in words ("12 left"): shown after the title, and the marker keeps its number. */
  left?: string;
  /** Visited steps (and finished ones) can be opened again. */
  onSelect?: () => void;
}

export interface WelcomeProgressPart {
  id: string;
  label: string;
  done: boolean;
  current: boolean;
  onSelect?: () => void;
}

export interface WelcomeProgressProps extends HTMLAttributes<HTMLElement> {
  "aria-label": string;
  steps: WelcomeProgressStep[];
  parts?: WelcomeProgressPart[];
  /** The parts' name for assistive tech ("The parts of your brand"). */
  partsLabel?: string;
}

/** nav.ui-wp: the line (phone), the steps, the parts. */
export function WelcomeProgress({ steps, parts, partsLabel, className, ...props }: WelcomeProgressProps) {
  const at = Math.max(0, steps.findIndex((s) => s.state === "current"));
  const pi = parts ? parts.findIndex((p) => p.current) : -1;
  return (
    <nav className={cx("ui-wp", className)} data-parts={parts ? "" : undefined} {...props}>
      <p className="ui-wp-line">
        <span className="ui-wp-count">
          Step {at + 1} of {steps.length}
        </span>
        <span className="ui-wp-title">{steps[at]?.title}</span>
        {steps[at]?.left && <span className="ui-wp-part">{steps[at].left}</span>}
        {parts && pi >= 0 && (
          <span className="ui-wp-part">
            {parts[pi].label}, {pi + 1} of {parts.length}
          </span>
        )}
      </p>
      <ol className="ui-wp-steps">
        {steps.map((s, i) => {
          const inner = (
            <>
              <span className="ui-wp-marker" aria-hidden="true">
                {s.state === "done" && !s.left ? <Icon name="check" /> : i + 1}
              </span>
              <span className="ui-wp-step-title">{s.title}</span>
              {s.left && <span className="ui-wp-left">{s.left}</span>}
              <span className="ui-wp-bar" aria-hidden="true" />
            </>
          );
          return (
            <li key={s.id} className="ui-wp-step" data-state={s.state} data-left={s.left ? "" : undefined} data-open={s.onSelect && s.state !== "current" ? "" : undefined}>
              {s.onSelect && s.state !== "current" ? (
                <button type="button" className="ui-wp-step-btn" onClick={s.onSelect} aria-label={`${s.title}${s.left ? `, ${s.left}` : s.state === "done" ? ", done" : ""}. Open this step`}>
                  {inner}
                </button>
              ) : (
                <span className="ui-wp-step-btn" aria-current={s.state === "current" ? "step" : undefined}>
                  <span className="ui-sr-only">{s.state === "current" ? "Current step: " : s.state === "done" ? "Done: " : ""}</span>
                  {inner}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {parts && (
        <ol className="ui-wp-parts" aria-label={partsLabel}>
          {parts.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="ui-wp-seg"
                data-state={p.current ? "current" : p.done ? "done" : "todo"}
                aria-current={p.current ? "step" : undefined}
                aria-label={`${p.label}${p.done ? ", done" : ""}`}
                onClick={p.onSelect}
              >
                <span className="ui-wp-seg-label" aria-hidden="true">
                  {p.done && <Icon name="check" />}
                  {p.label}
                </span>
                <span className="ui-wp-seg-bar" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
      )}
    </nav>
  );
}
