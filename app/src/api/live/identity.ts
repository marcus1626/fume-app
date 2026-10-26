// Identity on the live backend: the session, the workspaces, the team and the people.
import type { CustomerRole, FumeApi, Invitation, Membership, Organisation, Session } from "../../contract";
import { FumeError } from "../../contract";
import type { Live } from "./context";
import { one, rows, supabase } from "./supabase";

type Calls = "session" | "switchWorkspace" | "team" | "people";

interface OrganisationRow {
  id: string;
  name: string;
  kind: "brand" | "agency";
}

export function identityCalls(live: Live): Pick<FumeApi, Calls> {
  const calls: Pick<FumeApi, Calls> = {
    async session(): Promise<Session> {
      const [user, workspaces, wsId, role] = await Promise.all([
        live.me(),
        live.workspaces(),
        live.workspaceId(),
        live.role(),
      ]);
      const workspace = workspaces.find((w) => w.id === wsId)!;
      const org = await one<OrganisationRow>(
        supabase().from("organisations").select("id, name, kind").eq("id", workspace.organisationId).maybeSingle(),
        "organisation",
      );
      const organisation: Organisation = { id: org.id, name: org.name, kind: org.kind, packageId: "p-core" };
      const dna = await rows<{ id: string }>(
        supabase().from("brand_dna_versions").select("id").eq("workspace_id", wsId).eq("state", "approved").limit(1),
      );
      return { user, workspace, organisation, role, workspaces, onboarded: dna.length > 0 };
    },
    async switchWorkspace(workspaceId) {
      const list = await live.workspaces();
      if (!list.some((w) => w.id === workspaceId)) throw new FumeError("not_found", "No such workspace.");
      live.setWorkspace(workspaceId);
      return calls.session();
    },
    async team() {
      const ws = await live.workspaceId();
      const people = await live.people();
      const [members, staff, invitations] = await Promise.all([
        rows<{ user_id: string; role: CustomerRole }>(
          supabase().from("memberships").select("user_id, role").eq("workspace_id", ws),
        ),
        rows<{ user_id: string }>(supabase().from("staff_assignments").select("user_id").eq("workspace_id", ws)),
        rows<{
          id: string;
          email: string;
          role: CustomerRole | null;
          invited_by: string | null;
          state: Invitation["state"];
          created_at: string;
        }>(
          supabase()
            .from("invitations")
            .select("id, email, role, invited_by, state, created_at")
            .eq("workspace_id", ws)
            .not("role", "is", null),
        ),
      ]);
      return {
        members: members
          .filter((m) => people.has(m.user_id))
          .map((m) => ({
            user: people.get(m.user_id)!,
            membership: { userId: m.user_id, workspaceId: ws, role: m.role } satisfies Membership,
          })),
        invitations: invitations
          .filter((i) => i.state === "sent")
          .map((i) => ({
            id: i.id,
            workspaceId: ws,
            email: i.email,
            role: i.role!,
            invitedBy: i.invited_by ?? "",
            state: i.state,
            at: i.created_at,
          })),
        fumeTeam: [...new Set(staff.map((s) => s.user_id))].flatMap((id) => people.get(id) ?? []),
      };
    },
    async people() {
      const ws = await live.workspaceId();
      const people = await live.people();
      const [members, staff] = await Promise.all([
        rows<{ user_id: string }>(supabase().from("memberships").select("user_id").eq("workspace_id", ws)),
        rows<{ user_id: string }>(supabase().from("staff_assignments").select("user_id").eq("workspace_id", ws)),
      ]);
      const ids = new Set([...members, ...staff].map((r) => r.user_id));
      return [...ids].flatMap((id) => people.get(id) ?? []);
    },
  };
  return calls;
}
