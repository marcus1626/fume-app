// Round 8, ONB (PROPOSED 19 Oct 2026): the onboarding's progress on the workspace (UX review ONB-4, "continue where
// you left off") and the first run's honest starting point (ONB-3). createMockApi mixes these calls in after v9.
//   - onboardingProgress / saveOnboardingProgress: the furthest step and part the first customer reached, and her
//     word on each line of What Fume understood. The furthest point only moves forward.
//   - A fresh brand read only from its website has no guide to disagree with and no moodboard pins the Engine
//     proposed: those would be decisions the onboarding never shows her, left over for Home (ONB-3).

import type { BrandIdentity, Board, FumeApi, OnboardingProgress, OnboardingStepId, Understanding } from "../contract";

type Db = { boards: Board[]; understanding: Understanding; identity: BrandIdentity };

export interface R8OnbContext {
  db: Db;
  wait: <T>(value: T) => Promise<T>;
  fresh?: boolean;
}

const steps: OnboardingStepId[] = ["", "scan", "review", "taste"];
const parts = ["logo", "colour", "type", "imagery", "voice"];

export function r8OnbApi(ctx: R8OnbContext): Pick<FumeApi, "onboardingProgress" | "saveOnboardingProgress"> {
  const { db, wait } = ctx;
  const progress: OnboardingProgress = { step: "", lines: [] };

  if (ctx.fresh) {
    db.understanding.conflicts = [];
    for (const b of db.boards)
      if (b.kind === "brand_moodboard") b.items = b.items.filter((i) => i.provenance.origin === "customer");
  }

  return {
    async onboardingProgress() {
      return wait(structuredClone(progress));
    },
    async saveOnboardingProgress({ step, part, line }) {
      if (step !== undefined) {
        const now = steps.indexOf(progress.step);
        const next = steps.indexOf(step);
        if (next > now) {
          progress.step = step;
          progress.part = step === "review" ? (part ?? parts[0]) : undefined;
        } else if (
          next === now &&
          step === "review" &&
          part &&
          parts.indexOf(part) > parts.indexOf(progress.part ?? parts[0])
        ) {
          progress.part = part;
        }
      }
      if (line) progress.lines = [...progress.lines.filter((l) => l.id !== line.id), line];
      return wait(structuredClone(progress));
    },
  };
}
