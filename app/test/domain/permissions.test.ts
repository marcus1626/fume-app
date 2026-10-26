// Who may do what (app/src/domain/permissions.ts).
import { describe, expect, test } from "vitest";
import type { CampaignPlan, User } from "../../src/contract";
import {
  canAddClients,
  canAnswerClientLink,
  canApprove,
  canApproveCreatives,
  canApprovePlan,
  canAskPlanChanges,
  canCheckPlan,
  canInvite,
  canShapePlan,
  canUndoPlanApproval,
} from "../../src/domain/permissions";

const client = { id: "u-maja", name: "Maja" } as User;
const expert = { id: "u-anna", name: "Anna", staffRole: "expert" } as User;
const lead = {
  id: "u-nora",
  name: "Nora",
  staffRole: "expert",
  agency: { organisationId: "o-a", role: "lead" },
} as User;
const creative = { ...lead, id: "u-ola", agency: { organisationId: "o-a", role: "creative" } } as User;
const agencyBrand = { agencyId: "a-1" };
const ownBrand = {};
const plan = (state: CampaignPlan["state"], checkedBy?: string) => ({ state, checkedBy }) as CampaignPlan;

describe("roles in the workspace", () => {
  test("only the owner and approvers approve", () => {
    expect(["owner", "approver", "member", "viewer", null, undefined].map((r) => canApprove(r as never))).toEqual([
      true,
      true,
      false,
      false,
      false,
      false,
    ]);
  });

  test("only the owner invites", () => {
    expect(canInvite("owner")).toBe(true);
    expect(canInvite("approver")).toBe(false);
    expect(canInvite(null)).toBe(false);
  });
});

describe("agency work", () => {
  test("the agency never approves a creative itself", () => {
    expect(canApproveCreatives(lead)).toBe(false);
    expect(canApproveCreatives(client)).toBe(true);
  });

  test("only the client approves the plan, once the agency has checked it", () => {
    expect(canApprovePlan(lead, agencyBrand, plan("ready", "u-nora"))).toEqual({
      ok: false,
      reason: "only_the_client",
    });
    expect(canApprovePlan(client, agencyBrand, plan("ready"))).toEqual({ ok: false, reason: "not_checked" });
    expect(canApprovePlan(client, agencyBrand, plan("ready", "u-nora"))).toEqual({ ok: true });
    expect(canApprovePlan(client, ownBrand, plan("ready"))).toEqual({ ok: true });
  });

  test("the agency shapes the plan until it sends it", () => {
    expect(canShapePlan(lead, agencyBrand, plan("ready"))).toEqual({ ok: true });
    expect(canShapePlan(lead, agencyBrand, plan("ready", "u-nora"))).toEqual({ ok: false, reason: "with_the_client" });
    expect(canShapePlan(client, agencyBrand, plan("ready"))).toEqual({ ok: false, reason: "only_the_agency" });
    expect(canShapePlan(client, ownBrand, undefined)).toEqual({ ok: true });
  });

  test("asking for changes passes from the agency to the client once the plan is sent", () => {
    expect(canAskPlanChanges(client, agencyBrand, plan("ready"))).toEqual({ ok: false, reason: "only_the_agency" });
    expect(canAskPlanChanges(client, agencyBrand, plan("ready", "u-nora"))).toEqual({ ok: true });
    expect(canAskPlanChanges(lead, agencyBrand, plan("ready", "u-nora"))).toEqual({
      ok: false,
      reason: "with_the_client",
    });
  });

  test("only the client undoes her approval of the plan", () => {
    expect(canUndoPlanApproval(lead, agencyBrand)).toBe(false);
    expect(canUndoPlanApproval(client, agencyBrand)).toBe(true);
    expect(canUndoPlanApproval(lead, ownBrand)).toBe(true);
  });

  test("the agency checks the plan in its brands, Fume's people elsewhere", () => {
    expect(canCheckPlan(lead, agencyBrand)).toEqual({ ok: true });
    expect(canCheckPlan(expert, agencyBrand)).toEqual({ ok: false, reason: "only_the_agency" });
    expect(canCheckPlan(expert, ownBrand)).toEqual({ ok: true });
    expect(canCheckPlan(client, ownBrand)).toEqual({ ok: false, reason: "only_fume" });
  });

  test("only the agency lead adds clients", () => {
    expect(canAddClients(lead)).toBe(true);
    expect(canAddClients(creative)).toBe(false);
    expect(canAddClients(client)).toBe(false);
  });

  test("only the client answers in the client link", () => {
    expect(canAnswerClientLink(lead)).toBe(false);
    expect(canAnswerClientLink(client)).toBe(true);
    expect(canAnswerClientLink(undefined)).toBe(true);
  });
});
