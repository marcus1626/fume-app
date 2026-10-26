// Who may do what. Pure rules over the contract's data: the mock throws with its own words when one says no, and the
// real backend keeps the same rules.
import type { CampaignPlan, CustomerRole, User, Workspace } from "../contract";

/** Yes, or no with the reason, so the caller can say why in its own words. */
export type Verdict<Reason extends string> = { ok: true } | { ok: false; reason: Reason };
const yes = { ok: true } as const;
const no = <Reason extends string>(reason: Reason) => ({ ok: false, reason }) as const;

/** Only the workspace's owner and its approvers approve (ARCHITECTURE §2). */
export function canApprove(role: CustomerRole | null | undefined): boolean {
  return role === "owner" || role === "approver";
}

/** Only the workspace's owner invites people (ARCHITECTURE §2). */
export function canInvite(role: CustomerRole | null | undefined): boolean {
  return role === "owner";
}

/** The agency never approves a creative itself: approving is the client's word (FLOWS §24.2). */
export function canApproveCreatives(person: User): boolean {
  return !person.agency;
}

/** In a brand an agency runs, the agency checks the plan and sends it, and only the client approves it, once the agency
 *  has checked it (FLOWS §24.2, §26.8). Elsewhere approving a plan is the approver's, as any approval. */
export function canApprovePlan(
  person: User,
  workspace: Pick<Workspace, "agencyId"> | undefined,
  plan: CampaignPlan,
): Verdict<"only_the_client" | "not_checked"> {
  if (!workspace?.agencyId) return yes;
  if (person.agency) return no("only_the_client");
  if (plan.state === "ready" && !plan.checkedBy) return no("not_checked");
  return yes;
}

/** In a brand an agency runs, shaping the plan (a line, the direction, a new version, an expert's check) is the
 *  agency's, and only until it sends the plan to the client (FLOWS §24.2, §26.8). */
export function canShapePlan(
  person: User,
  workspace: Pick<Workspace, "agencyId"> | undefined,
  plan: CampaignPlan | undefined,
): Verdict<"only_the_agency" | "with_the_client"> {
  if (!workspace?.agencyId) return yes;
  if (!person.agency) return no("only_the_agency");
  if (plan?.state === "ready" && plan.checkedBy) return no("with_the_client");
  return yes;
}

/** Asking for changes to the plan: the agency's until it sends the plan, then the client's (FLOWS §26.8). */
export function canAskPlanChanges(
  person: User,
  workspace: Pick<Workspace, "agencyId"> | undefined,
  plan: CampaignPlan,
): Verdict<"only_the_agency" | "with_the_client"> {
  if (workspace?.agencyId && !person.agency && plan.checkedBy) return yes;
  return canShapePlan(person, workspace, plan);
}

/** In a brand an agency runs, the client's approval of the plan is undone only by the client (FLOWS §26.8). */
export function canUndoPlanApproval(person: User, workspace: Pick<Workspace, "agencyId"> | undefined): boolean {
  return !(workspace?.agencyId && person.agency);
}

/** In a brand an agency runs, the agency checks the plan; elsewhere Fume's people do (FLOWS §22.3, §24.2). */
export function canCheckPlan(
  person: User,
  workspace: Pick<Workspace, "agencyId"> | undefined,
): Verdict<"only_the_agency" | "only_fume"> {
  if (workspace?.agencyId) return person.agency ? yes : no("only_the_agency");
  return person.staffRole ? yes : no("only_fume");
}

/** Only the agency lead adds clients (FLOWS §24.1). */
export function canAddClients(person: User): boolean {
  return person.agency?.role === "lead";
}

/** The agency's own people see a client link as a preview; only the client answers there (FLOWS §26.8). */
export function canAnswerClientLink(person: User | undefined): boolean {
  return !person?.agency;
}
