// Identity on the live backend: the session, the workspaces, the team and the people. An invitation goes through the
// edge function `invite` (supabase/functions/invite), which keeps it in the database and sends the email.
import { FunctionsHttpError } from "@supabase/supabase-js";
import type {
  CustomerRole,
  FumeApi,
  FumeErrorCode,
  Invitation,
  Membership,
  Organisation,
  Session,
} from "../../contract";
import { FumeError } from "../../contract";
import type { Live } from "./context";
import { command, one, rows, supabase } from "./supabase";

type Calls = "session" | "switchWorkspace" | "team" | "people" | "updateProfile" | "invite";

interface InvitationRow {
  id: string;
  email: string;
  role: CustomerRole | null;
  invited_by: string | null;
  state: Invitation["state"];
  created_at: string;
}

const toInvitation = (i: InvitationRow, workspaceId: string): Invitation => ({
  id: i.id,
  workspaceId,
  email: i.email,
  role: i.role!,
  invitedBy: i.invited_by ?? "",
  state: i.state,
  at: i.created_at,
});

interface OrganisationRow {
  id: string;
  name: string;
  kind: "brand" | "agency";
}

export function identityCalls(live: Live): Pick<FumeApi, Calls> {
  const calls: Pick<FumeApi, Calls> = {
    async session(): Promise<Session> {
      // Two rounds, not four: the workspace first, then everything that hangs on it at once.
      const [wsId, uid] = await Promise.all([live.workspaceId(), live.uid()]);
      const workspaces = await live.workspaces();
      const workspace = workspaces.find((w) => w.id === wsId)!;
      const [user, role, org, dna, introduced] = await Promise.all([
        live.me(),
        live.role(),
        one<OrganisationRow>(
          supabase().from("organisations").select("id, name, kind").eq("id", workspace.organisationId).maybeSingle(),
          "organisation",
        ),
        rows<{ id: string }>(
          supabase().from("brand_dna_versions").select("id").eq("workspace_id", wsId).eq("state", "approved").limit(1),
        ),
        // Until the person has said who they are, "About you" opens first. A database without the column yet
        // (20261027170000_introductions.sql not applied) opens Fume as before.
        supabase()
          .from("profiles")
          .select("introduced_at")
          .eq("id", uid)
          .maybeSingle<{ introduced_at: string | null }>()
          .then(({ data, error }) => Boolean(error) || Boolean(data?.introduced_at)),
      ]);
      const organisation: Organisation = { id: org.id, name: org.name, kind: org.kind, packageId: "p-core" };
      return {
        user,
        workspace,
        organisation,
        role,
        workspaces,
        introduced,
        onboarded: dna.length > 0,
      };
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
      const [members, staff, invitations, waiting] = await Promise.all([
        rows<{ user_id: string; role: CustomerRole }>(
          supabase().from("memberships").select("user_id, role").eq("workspace_id", ws),
        ),
        rows<{ user_id: string }>(supabase().from("staff_assignments").select("user_id").eq("workspace_id", ws)),
        rows<InvitationRow>(
          supabase()
            .from("invitations")
            .select("id, email, role, invited_by, state, created_at")
            .eq("workspace_id", ws)
            .not("role", "is", null)
            .order("created_at", { ascending: false }),
        ),
        // The invitation email makes the account at once, so someone who has not opened Fume yet is a member already.
        // Until they have said who they are, the team shows them as invited.
        supabase()
          .from("profiles")
          .select("id")
          .is("introduced_at", null)
          .then(({ data, error }) => new Set(error ? [] : (data ?? []).map((p: { id: string }) => p.id))),
      ]);
      const joined = members.filter((m) => people.has(m.user_id) && !waiting.has(m.user_id));
      const invited = members.flatMap((m) => {
        const person = people.get(m.user_id);
        if (!person || !waiting.has(m.user_id)) return [];
        const row = invitations.find((i) => i.email.toLowerCase() === person.email.toLowerCase());
        return [
          {
            ...toInvitation(
              row ?? {
                id: m.user_id,
                email: person.email,
                role: m.role,
                invited_by: null,
                state: "sent",
                created_at: "",
              },
              ws,
            ),
            role: m.role,
            state: "sent" as const,
          },
        ];
      });
      return {
        members: joined.map((m) => ({
          user: people.get(m.user_id)!,
          membership: { userId: m.user_id, workspaceId: ws, role: m.role } satisfies Membership,
        })),
        invitations: [...invitations.filter((i) => i.state === "sent").map((i) => toInvitation(i, ws)), ...invited],
        fumeTeam: [...new Set(staff.map((s) => s.user_id))].flatMap((id) => people.get(id) ?? []),
      };
    },
    // The edge function keeps the invitation (the database decides who may invite) and sends the email. Someone who
    // already uses Fume joins at once ("accepted") and gets no email.
    async invite(email, role) {
      const ws = await live.workspaceId();
      const { data, error } = await supabase().functions.invoke<{ invitation: InvitationRow }>("invite", {
        body: { workspaceId: ws, email: email.trim(), role, site: window.location.origin },
      });
      if (error) {
        const said: { code?: FumeErrorCode; message?: string } =
          error instanceof FunctionsHttpError ? await error.context.json().catch(() => ({})) : {};
        throw new FumeError(said.code ?? "unavailable", said.message ?? "The invitation wasn’t sent. Try again.");
      }
      live.forget();
      return toInvitation(data!.invitation, ws);
    },
    // Name and title; the email address is the one the person signs in with.
    async updateProfile({ name, title }) {
      await command("update_profile", { p_name: name, p_title: title });
      live.forget();
      return live.me();
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
