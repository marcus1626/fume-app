// The frame every onboarding step shares (FLOWS §7; round 8, UX review ONB-1, ONB-4, ONB-10, ONB-12, ONB-16): Fume's
// lockup on its own bar (the onboarding has no sidebar), where she is in the four steps (and, in step 3, in its five
// parts), held at the top as she scrolls, the step itself, and its way forward pinned to the bottom of the screen.
// Four steps, named as what happens: 1 Your brand, 2 Fume reads it, 3 Confirm what Fume found, 4 Your taste.
// A new step (or part) opens at its top with focus on its title; Back and forward keep the browser's own place.
// The furthest step and part she reached is kept on the workspace, so she can leave and continue where she left off:
// the logo, step 1's "Continue" and the root (/welcome?resume) all go there.
// Round 9 (desktop review DTSK-5, DTSK-7, PROPOSED 19 Oct 2026): while finds are open, step 3 says how many are left
// ("3 · 12 left") instead of a tick, on every step; Enter, outside a control, presses the step's forward pill.
import { cx, WelcomeProgress, type WelcomeProgressPart } from "@fume/ui";
import { useEffect, useRef, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useNavigationType } from "react-router-dom";
import { useBrandBoard, useOnboardingProgress, useSaveOnboardingProgress } from "../../api/hooks";
import type { OnboardingProgress, OnboardingStepId } from "../../contract";
import { Lockup } from "../../shell/Logo";
import { Page } from "../../shell/Page";
import { checkParts, openTotal } from "./found";

export { checkParts, type CheckPart } from "./found";

export const onboardingSteps: { id: OnboardingStepId; title: string }[] = [
  { id: "", title: "Your brand" },
  { id: "scan", title: "Fume reads it" },
  { id: "review", title: "Confirm what Fume found" },
  { id: "taste", title: "Your taste" },
];
export type OnboardingStep = OnboardingStepId;

export const stepTitle = (id: OnboardingStepId) => onboardingSteps.find((s) => s.id === id)?.title ?? "";

export const stepPath = (id: OnboardingStepId, part?: string) =>
  id === "review"
    ? part && part !== "logo"
      ? `/welcome/review?part=${part}`
      : "/welcome/review"
    : id
      ? `/welcome/${id}`
      : "/welcome";

/** Where "continue" goes: the furthest step and part reached. */
export const resumePath = (p?: OnboardingProgress) => (p ? stepPath(p.step, p.part) : "/welcome");

const stepIndex = (id: OnboardingStepId) => onboardingSteps.findIndex((s) => s.id === id);

/** The Fume lockup on its own bar, as on the intro site; it goes to where she left off. */
export function Bar({ to = "/welcome" }: { to?: string }) {
  return (
    <header className="ui-nav">
      <div className="ui-nav-bar">
        <Link to={to} className="ui-nav-brand" aria-label="Fume, continue your onboarding">
          <Lockup />
        </Link>
      </div>
    </header>
  );
}

/**
 * A new step or part opens at its top with focus on its title (h1.ui-welcome-title); Back keeps its place. Called by
 * the route (Welcome), which stays mounted from step to step, so the first page load is left alone.
 */
export function useOpenAtTop() {
  const location = useLocation();
  const type = useNavigationType();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (type === "POP") return;
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    const title = document.querySelector<HTMLElement>(".ui-welcome-title");
    if (title) {
      title.tabIndex = -1;
      title.focus({ preventScroll: true });
    }
  }, [location.key, type]);
}

/**
 * Enter presses the step's forward pill (DTSK-7) when nothing else wants it: not in a field, not on a button or a
 * link (they have their own Enter), not while a dialog or a menu is open.
 */
export function useEnterForward(go: (() => void) | undefined) {
  const ref = useRef(go);
  ref.current = go;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key !== "Enter" ||
        e.defaultPrevented ||
        e.isComposing ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        e.shiftKey ||
        !ref.current
      )
        return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        t !== document.body &&
        t.closest(
          "input, textarea, select, button, a[href], [role=button], [role=option], [role=menuitem], [role=tab], [role=radio], [role=checkbox], [contenteditable=true], [role=dialog]",
        )
      )
        return;
      if (document.querySelector("[role=dialog][data-state=open], [role=menu][data-state=open]")) return;
      e.preventDefault();
      ref.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
}

/** Moves the furthest point forward when she reaches a new step or part (never back). */
function useKeepProgress(step: OnboardingStepId, part?: string) {
  const progress = useOnboardingProgress();
  const save = useSaveOnboardingProgress();
  const p = progress.data;
  useEffect(() => {
    if (!p || !step || save.isPending) return;
    const ahead = stepIndex(step) > stepIndex(p.step);
    const partAhead =
      step === "review" &&
      p.step === "review" &&
      part &&
      checkParts.findIndex((x) => x.id === part) > checkParts.findIndex((x) => x.id === (p.part ?? "logo"));
    if (ahead || partAhead) save.mutate({ step, part });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.step, p?.part, step, part]);
  return p;
}

export interface StepFrameProps {
  step: OnboardingStepId;
  /** The browser tab's title. */
  title: string;
  /** Step 3: its parts, for the progress. */
  parts?: WelcomeProgressPart[];
  /** Step 3: the part she is on, for the furthest point. */
  part?: string;
  /** The way forward (and back), pinned to the bottom of the screen. */
  foot?: ReactNode;
  footAlign?: "between" | "end" | "center";
  /** False: the foot follows the content instead of being pinned (the taste deck, whose answers are its own foot). */
  footPinned?: boolean;
  children: ReactNode;
}

/** A step's page: the bar, where she is, the step itself, its way forward. */
export function StepFrame({
  step,
  title,
  parts,
  part,
  foot,
  footAlign = "between",
  footPinned = true,
  children,
}: StepFrameProps) {
  const navigate = useNavigate();
  const progress = useKeepProgress(step, part);
  const board = useBrandBoard();
  const current = stepIndex(step);
  const furthest = Math.max(current, progress ? stepIndex(progress.step) : 0);
  // Step 3 says how many finds are left once she has reached it, instead of a tick (DTSK-5).
  const identity = board.data?.identity;
  const open = identity && furthest >= stepIndex("review") ? openTotal(identity) : 0;
  const steps = onboardingSteps.map((s, i) => ({
    id: s.id || "brand",
    title: s.title,
    state: (i < current ? "done" : i === current ? "current" : "todo") as "done" | "current" | "todo",
    left: s.id === "review" && open > 0 ? `${open} left` : undefined,
    onSelect:
      i <= furthest && i !== current
        ? () => navigate(i === stepIndex(progress?.step ?? "") ? resumePath(progress) : stepPath(s.id))
        : undefined,
  }));

  return (
    <div className="ui-welcome">
      <Bar to={resumePath(progress)} />
      <Page title={title}>
        <div className="ui-welcome-screen" data-step={step || "brand"}>
          <WelcomeProgress
            aria-label="Your onboarding"
            steps={steps}
            parts={parts}
            partsLabel="The parts of your brand"
          />
          {children}
          {foot && (
            <div
              className={cx(
                "ui-welcome-foot",
                footAlign !== "between" && `ui-welcome-foot--${footAlign}`,
                !footPinned && "ui-welcome-foot--static",
              )}
              data-ui-foot={footPinned ? "" : undefined}
            >
              {foot}
            </div>
          )}
        </div>
      </Page>
    </div>
  );
}
