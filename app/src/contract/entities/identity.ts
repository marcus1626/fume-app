// Identity: people, their roles, organisations (brands and agencies) and workspaces (ARCHITECTURE §4.1, FLOWS §24).

import type { Id, Instant } from "./common";

// ─── Roles ──────────────────────────────────────────────────────────────────

export type CustomerRole = "owner" | "approver" | "member" | "viewer";
export type StaffRole = "expert" | "operator" | "admin";
/** An agency person's one role across the agency's clients; client people keep the customer roles (FLOWS §24.2).
 *  lead: everything a creative does, plus clients, the agency team, licence and usage. creative: briefs, plans,
 *  the Studio and the Engine chat, checks, Send to client. */
export type AgencyRole = "lead" | "creative";

/** An agency person's seat in the agency. */
export interface AgencySeat {
  organisationId: Id;
  role: AgencyRole;
}

// ─── People ─────────────────────────────────────────────────────────────────

export interface User {
  id: Id;
  name: string;
  /** Real job title, shown with the name on every check (F-D040). */
  title: string;
  email: string;
  /** Image URL; people without one get initials on Cream (Warmer, F-D074). */
  avatar?: string;
  /** Set for Fume's own people. */
  staffRole?: StaffRole;
  /** Set for agency people. They also check, so the mock gives them staffRole "expert" too. */
  agency?: AgencySeat;
}

// ─── Organisations and workspaces ───────────────────────────────────────────

/** An agency is an Organisation of kind "agency"; each client brand is a Workspace it runs (FLOWS §24.1). */
export type OrganisationKind = "brand" | "agency";

export interface Organisation {
  id: Id;
  name: string;
  packageId: Id;
  /** An agency's organisation says "agency". */
  kind?: OrganisationKind;
}

export interface Workspace {
  id: Id;
  organisationId: Id;
  brandName: string;
  /** The brand's mark as an image URL (the composer chip and the switcher). */
  brandMark?: string;
  market: string;
  language: string;
  /** A brand an agency runs names the agency (its Organisation id). */
  agencyId?: Id;
}

// ─── Team ───────────────────────────────────────────────────────────────────

export interface Membership {
  userId: Id;
  workspaceId: Id;
  role: CustomerRole;
}

export interface Invitation {
  id: Id;
  workspaceId: Id;
  email: string;
  role: CustomerRole;
  invitedBy: Id;
  state: "sent" | "accepted" | "expired";
  at: Instant;
}

/** A Fume person assigned to a brand ("Your Fume team"). */
export interface StaffAssignment {
  userId: Id;
  workspaceId: Id;
  staffRole: Exclude<StaffRole, "admin">;
}
