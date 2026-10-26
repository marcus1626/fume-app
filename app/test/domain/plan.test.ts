// The brief and the plan (app/src/domain/plan.ts).
import { describe, expect, test } from "vitest";
import type { Brief, Campaign, CampaignPlan, PlannedCreative, Product, User } from "../../src/contract";
import {
  briefGap,
  engineMayMake,
  mastersOnHold,
  planAllows,
  planTimeline,
  seesPlan,
  type PlanAction,
} from "../../src/domain/plan";

const brief = (over: Partial<Brief> = {}) =>
  ({ missing: [], objective: "Sell the oil", audience: "Women 30+", message: "Calm skin", ...over }) as Brief;
const campaign = (over: Partial<Campaign> = {}) => ({ productIds: ["p-oil"], ...over }) as Campaign;
const plan = (state: CampaignPlan["state"], checkedBy?: string) => ({ state, checkedBy }) as CampaignPlan;

describe("the brief", () => {
  test("a complete brief with a product has no gap", () => {
    expect(briefGap(brief(), campaign())).toBeUndefined();
    expect(briefGap(brief(), campaign({ productIds: [], collectionIds: ["cl-gifts"] }))).toBeUndefined();
  });

  test("Fume's open questions come first, then the empty lines, then the product", () => {
    expect(briefGap(brief({ missing: ["audience"], objective: "" }), campaign())).toEqual({ reason: "questions_open" });
    expect(briefGap(brief({ objective: " ", message: "" }), campaign())).toEqual({
      reason: "lines_empty",
      lines: ["objective", "message"],
    });
    expect(briefGap(brief(), campaign({ productIds: [] }))).toEqual({ reason: "no_product" });
  });
});

describe("the plan", () => {
  test("what can be done in each state", () => {
    const actions: PlanAction[] = [
      "approve",
      "change",
      "ask_changes",
      "ask_check",
      "expert_check",
      "agency_check",
      "undo",
    ];
    const allowed = (state: CampaignPlan["state"]) => actions.filter((a) => planAllows(plan(state), a));
    expect(allowed("ready")).toEqual(["approve", "change", "ask_changes", "ask_check", "agency_check"]);
    expect(allowed("in_check")).toEqual(["expert_check"]);
    expect(allowed("writing")).toEqual(["expert_check"]);
    expect(allowed("approved")).toEqual(["undo"]);
    expect(allowed("changes_asked")).toEqual([]);
  });

  test("the customer reads the plan once it is ready; the client once the agency has sent it", () => {
    const maja = { id: "u-maja" } as User;
    const anna = { id: "u-anna", staffRole: "expert" } as User;
    const nora = { id: "u-nora", staffRole: "expert", agency: { organisationId: "o-a", role: "lead" } } as User;
    expect(seesPlan(maja, {}, plan("writing"))).toBe(false);
    expect(seesPlan(maja, {}, plan("in_check"))).toBe(false);
    expect(seesPlan(anna, {}, plan("in_check"))).toBe(true);
    expect(seesPlan(maja, {}, plan("ready"))).toBe(true);
    expect(seesPlan(maja, { agencyId: "a-1" }, plan("ready"))).toBe(false);
    expect(seesPlan(maja, { agencyId: "a-1" }, plan("ready", "u-nora"))).toBe(true);
    expect(seesPlan(nora, { agencyId: "a-1" }, plan("ready"))).toBe(true);
  });

  test("the Engine makes nothing before the plan is approved", () => {
    expect(engineMayMake({ stage: "brief" })).toBe(false);
    expect(engineMayMake({ stage: "plan" })).toBe(false);
    expect(engineMayMake({ stage: "directions" })).toBe(true);
    expect(engineMayMake({ stage: "masters" })).toBe(true);
  });

  test("a master waits for the unconfirmed products it shows", () => {
    const master = (id: string, productIds: string[]) => ({ id, kind: "master", productIds }) as PlannedCreative;
    const masters = [master("m1", ["p-oil"]), master("m2", ["p-cream"]), master("m3", ["p-oil", "p-mask"])];
    const { going, held } = mastersOnHold(masters, [{ id: "p-oil" } as Product]);
    expect(going.map((m) => m.id)).toEqual(["m2"]);
    expect(held.map((m) => m.id)).toEqual(["m1", "m3"]);
  });

  test("the steps fall on working days from the start", () => {
    // Friday 2 October 2026.
    expect(planTimeline("2026-10-02T09:00:00.000Z")).toEqual([
      { label: "Masters, checked", at: "2026-10-07T09:00:00.000Z" },
      { label: "Variants and formats", at: "2026-10-12T09:00:00.000Z" },
      { label: "Delivery", at: "2026-10-14T09:00:00.000Z" },
    ]);
  });

  test("a go-live the steps would pass pulls them in, to a day before it at the latest", () => {
    const steps = planTimeline("2026-10-02T09:00:00.000Z", "2026-10-10T09:00:00.000Z");
    expect(steps.at(-1)).toEqual({ label: "Goes live", at: "2026-10-10T09:00:00.000Z" });
    expect(steps[2].at).toBe("2026-10-09T09:00:00.000Z");
    expect(Date.parse(steps[0].at)).toBeLessThan(Date.parse(steps[1].at));
  });

  test("a go-live after the steps leaves them where they are", () => {
    const steps = planTimeline("2026-10-02T09:00:00.000Z", "2026-11-02T09:00:00.000Z");
    expect(steps.map((s) => s.at)).toEqual([
      "2026-10-07T09:00:00.000Z",
      "2026-10-12T09:00:00.000Z",
      "2026-10-14T09:00:00.000Z",
      "2026-11-02T09:00:00.000Z",
    ]);
  });
});
