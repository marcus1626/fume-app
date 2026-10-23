// Identity calls: the session, the team, settings and the profile.

import type { Id } from "../entities/common";
import type { CustomerRole, Invitation, Membership, User, Workspace } from "../entities/identity";
import type { Session, SettingsView, TeamLoadRow, TeamView } from "../views/identity";

export interface IdentityApi {
  // Session
  session(): Promise<Session>;
  switchWorkspace(workspaceId: Id): Promise<Session>;

  // Team
  team(): Promise<TeamView>;
  /** Everyone this user meets in the workspace (its members and Fume's people on it), to name who acted. */
  people(): Promise<User[]>;
  invite(email: string, role: CustomerRole): Promise<Invitation>;
  changeRole(userId: Id, role: CustomerRole): Promise<Membership>;
  removeMember(userId: Id): Promise<void>;
  /** The Team table for Fume's people and an agency: each person's load and what they do now. */
  teamLoad(): Promise<TeamLoadRow[]>;

  // Settings and profile
  settings(): Promise<SettingsView>;
  updateWorkspace(change: Partial<Pick<Workspace, "brandName" | "market" | "language">>): Promise<Workspace>;
  /** Her own name, title and email, changed in place. */
  updateProfile(input: { name: string; title: string; email: string }): Promise<User>;
}
