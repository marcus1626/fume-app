// The people of the demo: LYSNE's team (Maja approves), SOLV's brand manager, and Fume's people (Anna is the expert).
// Names are placeholders (Verbal Identity).
import type { Invitation, Membership, Organisation, Package, StaffAssignment, User, Workspace } from "../../contract";
import { at } from "./helpers";

export const users: User[] = [
  { id: "u-maja", name: "Maja Lind", title: "Head of Marketing", email: "maja@lysne.example" },
  { id: "u-jonas", name: "Jonas Berg", title: "Performance Marketer", email: "jonas@lysne.example" },
  { id: "u-ida", name: "Ida Strand", title: "Finance Lead", email: "ida@lysne.example" },
  { id: "u-anna", name: "Anna", title: "Designer", email: "anna@fumecreatives.com", staffRole: "expert" },
  { id: "u-sander", name: "Sander", title: "Producer", email: "sander@fumecreatives.com", staffRole: "operator" },
  { id: "u-tuva", name: "Tuva", title: "Art Director", email: "tuva@fumecreatives.com", staffRole: "expert" },
  { id: "u-vera", name: "Vera", title: "Operations", email: "vera@fumecreatives.com", staffRole: "admin" },
  { id: "u-solv", name: "Elin Ek", title: "Brand Manager", email: "elin@solv.example" },
];

export const organisations: Organisation[] = [
  { id: "o-lysne", name: "LYSNE", packageId: "p-core" },
  { id: "o-solv", name: "SOLV", packageId: "p-launch" },
];

export const workspaces: Workspace[] = [
  { id: "w-lysne", organisationId: "o-lysne", brandName: "LYSNE", market: "Norway", language: "Norwegian" },
  { id: "w-solv", organisationId: "o-solv", brandName: "SOLV", market: "Sweden", language: "Swedish" },
];

export const memberships: Membership[] = [
  { userId: "u-maja", workspaceId: "w-lysne", role: "owner" },
  { userId: "u-jonas", workspaceId: "w-lysne", role: "member" },
  { userId: "u-ida", workspaceId: "w-lysne", role: "viewer" },
  { userId: "u-solv", workspaceId: "w-solv", role: "owner" },
];

export const invitations: Invitation[] = [
  {
    id: "inv-1",
    workspaceId: "w-lysne",
    email: "eva@lysne.example",
    role: "approver",
    invitedBy: "u-maja",
    state: "sent",
    at: at(60 * 26),
  },
];

export const staff: StaffAssignment[] = [
  { userId: "u-anna", workspaceId: "w-lysne", staffRole: "expert" },
  { userId: "u-sander", workspaceId: "w-lysne", staffRole: "operator" },
  { userId: "u-tuva", workspaceId: "w-solv", staffRole: "expert" },
  { userId: "u-sander", workspaceId: "w-solv", staffRole: "operator" },
];

export const packages: Package[] = [
  { id: "p-launch", kind: "launch", creativeCap: 18, directionRounds: 1, productionRounds: 2, period: "one_off" },
  { id: "p-core", kind: "core", creativeCap: 27, directionRounds: 1, productionRounds: 2, period: "monthly" },
];
