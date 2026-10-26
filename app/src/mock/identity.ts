// Who is signed in, the workspaces they work in, the team and the settings.
import { FumeError, type FumeApi, type Session } from "../contract";
import type { Mock } from "./context";
import { FUME_CONTACT } from "./seed/agency";

type Calls =
  | "session"
  | "switchWorkspace"
  | "team"
  | "people"
  | "invite"
  | "changeRole"
  | "removeMember"
  | "setApprover"
  | "settings"
  | "updateWorkspace"
  | "updateProfile";

export function identityCalls(m: Mock): Pick<FumeApi, Calls> {
  const { db, wait } = m;
  return {
    async session(): Promise<Session> {
      const workspace = m.find(db.workspaces, m.workspaceId, "workspace");
      const workspaces = m.isStaff()
        ? db.workspaces.filter(
            (w) =>
              m.me().staffRole === "admin" || db.staff.some((s) => s.userId === m.userId && s.workspaceId === w.id),
          )
        : db.workspaces.filter((w) => db.memberships.some((x) => x.userId === m.userId && x.workspaceId === w.id));
      const session: Session = {
        user: m.me(),
        workspace,
        organisation: m.find(db.organisations, workspace.organisationId, "organisation"),
        role: m.role(),
        workspaces,
        onboarded: db.brandDna.state === "approved" || db.brandDna.version > 0,
      };
      // It says which agency runs the brand, and the agency person's own seat.
      const runBy = db.organisations.find((o) => o.id === workspace.agencyId)?.name;
      const seat = db.users.find((u) => u.id === m.userId)?.agency;
      const agency = db.organisations.find((o) => o.id === seat?.organisationId);
      return wait({
        ...session,
        ...(runBy ? { agencyName: runBy } : {}),
        ...(seat && agency ? { agency: { organisation: agency, role: seat.role } } : {}),
      });
    },
    async switchWorkspace(id) {
      m.find(db.workspaces, id, "workspace");
      m.workspaceId = id;
      const session = await m.api.session();
      // Recent first in the picker: opening a client is remembered.
      m.opened.set(id, m.now());
      return session;
    },

    async team() {
      return wait({
        members: db.memberships
          .filter((x) => x.workspaceId === m.workspaceId)
          .map((membership) => ({ user: m.user(membership.userId), membership })),
        invitations: db.invitations.filter((i) => i.workspaceId === m.workspaceId),
        fumeTeam: db.staff.filter((s) => s.workspaceId === m.workspaceId).map((s) => m.user(s.userId)),
      });
    },
    // In a brand an agency runs, Fume's person in the agency's conversation is a person at Fume, so the people of
    // the brand include him (FLOWS §24.1).
    async people() {
      const ids = new Set([
        ...db.memberships.filter((x) => x.workspaceId === m.workspaceId).map((x) => x.userId),
        ...db.staff.filter((s) => s.workspaceId === m.workspaceId).map((s) => s.userId),
      ]);
      const list = db.users.filter((u) => ids.has(u.id));
      const contact = db.users.find((u) => u.id === FUME_CONTACT);
      if (!m.agencyRun(m.workspaceId) || list.some((u) => u.id === FUME_CONTACT) || !contact) return wait(list);
      return wait([...list, contact]);
    },
    async invite(email, role) {
      if (m.role() !== "owner") throw new FumeError("forbidden", "Only the owner invites people.");
      const invitation = {
        id: m.nextId("inv"),
        workspaceId: m.workspaceId,
        email,
        role,
        invitedBy: m.userId,
        state: "sent" as const,
        at: m.now(),
      };
      db.invitations.push(invitation);
      return wait(invitation);
    },
    async changeRole(userId, role) {
      const membership = db.memberships.find((x) => x.userId === userId && x.workspaceId === m.workspaceId);
      if (!membership) throw new FumeError("not_found", "Not in this workspace");
      membership.role = role;
      return wait(membership);
    },
    async removeMember(userId) {
      db.memberships = db.memberships.filter((x) => !(x.userId === userId && x.workspaceId === m.workspaceId));
      return wait(undefined);
    },
    async setApprover(campaignId, userId) {
      const c = m.campaignOf(campaignId);
      c.approverId = userId;
      return wait(c);
    },

    async settings() {
      const workspace = m.find(db.workspaces, m.workspaceId, "workspace");
      const pkg = m.find(
        db.packages,
        m.find(db.organisations, workspace.organisationId, "organisation").packageId,
        "package",
      );
      const home = await m.api.home();
      return wait({
        workspace,
        package: pkg,
        usage: home.usage,
        notificationPrefs: [
          { kind: "checked", label: "Creatives are checked and ready for you", email: true, inApp: true },
          { kind: "waiting_on_you", label: "Fume needs something from you", email: true, inApp: true },
          { kind: "engine_done", label: "The Engine finished a run", email: false, inApp: true },
          { kind: "delivered", label: "A delivery is ready", email: true, inApp: true },
          { kind: "mention", label: "Someone mentions you", email: true, inApp: true },
        ],
      });
    },
    async updateWorkspace(change) {
      const w = m.find(db.workspaces, m.workspaceId, "workspace");
      Object.assign(w, change);
      return wait(w);
    },
    // Her profile, changed in place.
    async updateProfile({ name, title, email }) {
      const u = db.users.find((x) => x.id === m.userId);
      if (!u) throw new FumeError("not_found", "No such person");
      if (!name.trim()) throw new FumeError("invalid", "Your name is needed.");
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) throw new FumeError("invalid", "That email address doesn’t look right.");
      Object.assign(u, { name: name.trim(), title: title.trim(), email: email.trim() });
      return wait(structuredClone(u));
    },
  };
}
