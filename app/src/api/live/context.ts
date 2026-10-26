// What every live domain module shares: who is signed in, the workspace they are in, and the people they meet.
import { FumeError, type CustomerRole, type Id, type StaffRole, type User, type Workspace } from "../../contract";
import { rows, supabase } from "./supabase";

/** The database's people, as the contract names them. */
export interface ProfileRow {
  id: string;
  email: string;
  name: string;
  title: string;
  staff_role: "designer" | "account_manager" | "admin" | null;
}
interface StaffRow {
  user_id: string;
  workspace_id: string;
  staff_role: "designer" | "account_manager";
  can_check: boolean;
}
export interface WorkspaceRow {
  id: string;
  organisation_id: string;
  slug: string;
  brand_name: string;
  market: string;
  language: string;
}

const WORKSPACE_KEY = "fume-live-workspace";

export interface Live {
  /** The signed-in person's id; fails when no one is signed in. */
  uid(): Promise<Id>;
  me(): Promise<User>;
  /** The workspace the person is in (the last one opened, else the first they can open). */
  workspaceId(): Promise<Id>;
  setWorkspace(id: Id): void;
  workspaces(): Promise<Workspace[]>;
  /** The caller's customer role in the current workspace, or null for Fume's people. */
  role(): Promise<CustomerRole | null>;
  /** Everyone the caller can see, by id: names on checks, approvals and the record. */
  people(): Promise<Map<Id, User>>;
  /** Forget what was read, after a change that affects who is who. */
  forget(): void;
}

/**
 * The app has three staff roles (expert, operator, admin); the database has Marcus's (26 Oct): designer, account
 * manager and admin, and a designer's right to check. Until the app's roles are designed, a designer who may check
 * shows as the expert, a designer or account manager as the operator, and an admin alone as the admin. The database
 * decides what each may do whatever the app shows.
 */
function appStaffRole(profile: ProfileRow, staff: StaffRow[]): StaffRole | undefined {
  const mine = staff.filter((s) => s.user_id === profile.id);
  if (mine.some((s) => s.can_check)) return "expert";
  if (mine.length > 0) return "operator";
  if (profile.staff_role === "admin") return "admin";
  return undefined;
}

export function toWorkspace(w: WorkspaceRow): Workspace {
  return {
    id: w.id,
    organisationId: w.organisation_id,
    brandName: w.brand_name,
    market: w.market,
    language: w.language,
  };
}

export function createLive(): Live {
  let peopleCache: Promise<Map<Id, User>> | null = null;
  let workspacesCache: Promise<Workspace[]> | null = null;

  const uid = async () => {
    const { data } = await supabase().auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new FumeError("forbidden", "Sign in first.");
    return id;
  };

  const people = () =>
    (peopleCache ??= (async () => {
      const [profiles, staff] = await Promise.all([
        rows<ProfileRow>(supabase().from("profiles").select("id, email, name, title, staff_role")),
        rows<StaffRow>(supabase().from("staff_assignments").select("user_id, workspace_id, staff_role, can_check")),
      ]);
      const map = new Map<Id, User>();
      for (const p of profiles) {
        const staffRole = appStaffRole(p, staff);
        map.set(p.id, { id: p.id, name: p.name, title: p.title, email: p.email, ...(staffRole ? { staffRole } : {}) });
      }
      return map;
    })());

  const workspaces = () =>
    (workspacesCache ??= rows<WorkspaceRow>(
      supabase()
        .from("workspaces")
        .select("id, organisation_id, slug, brand_name, market, language")
        .order("brand_name"),
    ).then((list) => list.map(toWorkspace)));

  const live: Live = {
    uid,
    async me() {
      const id = await uid();
      const me = (await people()).get(id);
      if (!me) throw new FumeError("forbidden", "Your invitation has not reached your account yet.");
      return me;
    },
    async workspaceId() {
      const list = await workspaces();
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(WORKSPACE_KEY);
      } catch {
        /* no storage: the first workspace */
      }
      const found = list.find((w) => w.id === saved) ?? list[0];
      if (!found) throw new FumeError("forbidden", "You have no brand to open yet. Ask Fume for an invitation.");
      return found.id;
    },
    setWorkspace(id) {
      try {
        localStorage.setItem(WORKSPACE_KEY, id);
      } catch {
        /* no storage: the choice lasts until the page reloads */
      }
    },
    workspaces,
    async role() {
      const [id, ws] = await Promise.all([uid(), live.workspaceId()]);
      const list = await rows<{ role: CustomerRole }>(
        supabase().from("memberships").select("role").eq("user_id", id).eq("workspace_id", ws),
      );
      return list[0]?.role ?? null;
    },
    people,
    forget() {
      peopleCache = null;
      workspacesCache = null;
    },
  };
  return live;
}
