// Identity view models: the session, Team and Settings.

import type { Id } from "../entities/common";
import type { Package, Usage } from "../entities/delivery";
import type {
  AgencyRole,
  CustomerRole,
  Invitation,
  Membership,
  Organisation,
  User,
  Workspace,
} from "../entities/identity";

export interface Session {
  user: User;
  workspace: Workspace;
  organisation: Organisation;
  role: CustomerRole | null;
  /** Workspaces this user can open (Fume's people: every assigned one). */
  workspaces: Workspace[];
  /** True once the person has said who they are (name and title) on their first sign-in; until then the app opens
   *  "About you" before anything else. */
  introduced: boolean;
  /** True once Brand DNA v1 is approved; until then the app opens the first run. */
  onboarded: boolean;
  /** Agency people: their agency and their role in it. */
  agency?: { organisation: Organisation; role: AgencyRole };
  /** The agency that runs this workspace, when one does (a client person sees "Brygga Studio makes this brand's creatives with Fume"). */
  agencyName?: string;
}

export interface TeamView {
  members: { user: User; membership: Membership }[];
  invitations: Invitation[];
  fumeTeam: User[];
}

/** One person in the Team table, the same table for Fume and an agency. */
export interface TeamLoadRow {
  user: User;
  /** Core-equivalent units carried now; capacity is 4 (Business Model & GTM). */
  load: number;
  capacity: number;
  checksToday: number;
  minutesPerCheck: number;
  /** The brands the person works on. */
  brandIds?: Id[];
  /** What they do now: "3 creatives to check · 1 plan · LYSNE". */
  doing?: string;
  /** An admin follows and carries no load (FLOWS §20), so a follower is left out of capacity. */
  follows?: boolean;
}

export interface SettingsView {
  workspace: Workspace;
  package: Package;
  usage: Usage;
  notificationPrefs: { kind: string; label: string; email: boolean; inApp: boolean }[];
}
