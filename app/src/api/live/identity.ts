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
  Package,
  Session,
  SettingsView,
  Workspace,
} from "../../contract";
import { FumeError } from "../../contract";
import type { Live } from "./context";
import { command, one, rows, supabase } from "./supabase";

type Calls =
  | "session"
  | "switchWorkspace"
  | "team"
  | "people"
  | "updateProfile"
  | "invite"
  | "changeRole"
  | "removeMember"
  | "settings"
  | "updateWorkspace";

/** What public.package_usage answers: the package with its period, and what the period has used. */
interface PackageUsage {
  package: Package & { from: string; to: string | null };
  usage: { creativesUsed: number; creativeCap: number; campaignsActive: number; periodEndsAt: string | null };
}

// Fume sends these by email and in the bell; choosing them per person comes later, so they are what Fume sends today.
const NOTIFICATION_PREFS: SettingsView["notificationPrefs"] = [
  { kind: "checked", label: "Creatives are checked and ready for you", email: true, inApp: true },
  { kind: "waiting_on_you", label: "Fume needs something from you", email: true, inApp: true },
  { kind: "delivered", label: "A delivery is ready", email: true, inApp: true },
  { kind: "mention", label: "Someone mentions you", email: true, inApp: true },
];

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
      // An agency's lead before its first client: the agency's own frame, with no client open yet.
      if ((await live.workspaces()).length === 0) {
        const me = await live.me().catch(() => undefined);
        if (me?.agency) {
          const agency = await one<OrganisationRow>(
            supabase().from("organisations").select("id, name, kind").eq("id", me.agency.organisationId).maybeSingle(),
            "agency",
          );
          const organisation: Organisation = {
            id: agency.id,
            name: agency.name,
            kind: "agency",
            packageId: "p-agency",
          };
          const { data } = await supabase()
            .from("profiles")
            .select("introduced_at")
            .eq("id", me.id)
            .maybeSingle<{ introduced_at: string | null }>();
          return {
            user: me,
            workspace: { id: "", organisationId: agency.id, brandName: agency.name, market: "", language: "en" },
            organisation,
            role: null,
            workspaces: [],
            introduced: Boolean(data?.introduced_at),
            onboarded: true,
            agency: { organisation, role: me.agency.role },
          };
        }
      }
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
      // An agency's person: their agency and seat. A client's person: the agency that runs the brand.
      const agencyOrg = user.agency?.organisationId ?? workspace.agencyId;
      const agency = agencyOrg
        ? await one<OrganisationRow>(
            supabase().from("organisations").select("id, name, kind").eq("id", agencyOrg).maybeSingle(),
            "agency",
          ).catch(() => undefined)
        : undefined;
      return {
        ...(user.agency && agency
          ? {
              agency: {
                organisation: { id: agency.id, name: agency.name, kind: "agency", packageId: "p-agency" },
                role: user.agency.role,
              },
            }
          : {}),
        ...(!user.agency && agency && workspace.agencyId ? { agencyName: agency.name } : {}),
        user,
        workspace,
        organisation,
        role,
        workspaces,
        introduced,
        onboarded: dna.length > 0,
      };
    },
    // Only the owner changes roles, takes people off and renames the brand; the database says so to anyone else.
    async changeRole(userId, role) {
      return command<Membership>("change_role", {
        p_workspace_id: await live.workspaceId(),
        p_user_id: userId,
        p_role: role,
      });
    },
    async removeMember(userId) {
      await command("remove_member", { p_workspace_id: await live.workspaceId(), p_user_id: userId });
    },
    async updateWorkspace(change) {
      const w = await command<Workspace>("update_workspace", {
        p_workspace_id: await live.workspaceId(),
        p_brand_name: change.brandName ?? null,
        p_market: change.market ?? null,
        p_language: change.language ?? null,
      });
      live.forget();
      return (await live.workspaces()).find((x) => x.id === w.id) ?? w;
    },
    async settings() {
      const ws = await live.workspaceId();
      const [workspaces, r] = await Promise.all([
        live.workspaces(),
        command<PackageUsage>("package_usage", { p_workspace_id: ws }),
      ]);
      const { from: _from, to: _to, ...pkg } = r.package;
      return {
        workspace: workspaces.find((w) => w.id === ws)!,
        package: pkg,
        usage: {
          creativesUsed: r.usage.creativesUsed,
          creativeCap: r.usage.creativeCap,
          campaignsActive: r.usage.campaignsActive,
          ...(r.usage.periodEndsAt ? { periodEndsAt: r.usage.periodEndsAt } : {}),
        },
        notificationPrefs: NOTIFICATION_PREFS,
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
