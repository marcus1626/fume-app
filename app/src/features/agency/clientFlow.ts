// Round 11 CLIENT FLOW (FLOWS §24.2, §24.5; PROPOSED 20 Oct 2026): who is who in a client brand an agency runs, and
// where its checked creatives stand with the client. The agency's people never approve a creative: they send it to
// the client or record an approval the client gave outside Fume ("Maja approved · recorded by Nora"; "recorded by
// you" when Nora reads it). The client's own people approve as customers always have.
// Round 12 AGENCY (UX review DLOAD-5, DLOAD-4; brief r12 SENDING; PROPOSED 20 Oct 2026): a checked creative has two
// states for the agency, each named once: "Checked, not sent" (the agency's to send) and "With Maja" (sent; she
// approves it). The client sees a creative only once it is sent. The status sentence reads the frame
// (useStatusOptions: the client reads the agency's work as a fact, "Brygga Studio is planning").
import { useCallback, useMemo } from "react";
import { useClientSends, useSession, useTeam } from "../../api/hooks";
import type { ClientSend, Creative, CreativeVersion, CustomerRole, Id, User } from "../../contract";
import * as copy from "../../copy";
import { firstName } from "../../shell/people";

/** Where the signed-in person stands in a brand an agency runs: one of the agency's people, one of the client's own,
 *  or null when no agency runs the brand (everything as it was). */
export type AgencyScope = "agency" | "client" | null;

export function useAgencyScope(): AgencyScope {
  const session = useSession().data;
  if (!session?.workspace.agencyId) return null;
  return session.user.agency ? "agency" : "client";
}

/** One of the client's own people in Fume (never the agency's, who hold a seat in every client). */
export interface ClientPerson {
  user: User;
  role: CustomerRole;
  /** Owner or approver: the one whose word approves a creative. */
  approves: boolean;
}

/** "Approves", "Can comment", "Can look": a client person's part, as the panels say it. */
export const clientRole = (p: ClientPerson) => (p.approves ? "Approves" : p.role === "member" ? "Can comment" : "Can look");

/** The client's own people in this brand, the ones who approve first. */
export function useClientPeople(enabled = true): { people: ClientPerson[]; loading: boolean } {
  const team = useTeam();
  const people = useMemo(
    () =>
      (team.data?.members ?? [])
        .filter((m) => !m.user.agency)
        .map((m) => ({ user: m.user, role: m.membership.role, approves: m.membership.role === "owner" || m.membership.role === "approver" }))
        .sort((a, b) => Number(b.approves) - Number(a.approves)),
    [team.data],
  );
  return { people: enabled ? people : [], loading: enabled && team.isPending };
}

/** What the agency sent of a campaign, newest first, and the words for it. */
export function useCampaignSends(campaignId: Id | undefined, enabled: boolean) {
  const sends = useClientSends(enabled ? campaignId : undefined);
  const { people } = useClientPeople(enabled);
  const list = useMemo(() => sends.data ?? [], [sends.data]);
  /** Who a send waits on, by first name: the first person it went to who approves, else the first, else "the client". */
  const who = useCallback(
    (send: ClientSend): string => {
      const to = send.to.map((id) => people.find((p) => p.user.id === id)).filter((p): p is ClientPerson => Boolean(p));
      const one = to.find((p) => p.approves) ?? to[0];
      return one ? firstName(one.user.name) : "the client";
    },
    [people],
  );
  /** The newest send a version went out in. */
  const sendOf = useCallback((versionId: Id) => list.find((s) => s.versionIds.includes(versionId)), [list]);
  /** "Maja" while a checked version is with the client (sent); undefined before it is sent. */
  const waitingOn = useCallback(
    (v: Pick<CreativeVersion, "id" | "state">) => {
      if (v.state !== "checked") return undefined;
      const send = sendOf(v.id);
      return send ? who(send) : undefined;
    },
    [sendOf, who],
  );
  /** The checked creatives split by where they are: the agency's to send, and the ones with the client. */
  const split = useCallback(
    <C extends Pick<Creative, "current">>(checked: C[]) => ({ toSend: checked.filter((c) => !sendOf(c.current.id)), withThem: checked.filter((c) => Boolean(sendOf(c.current.id))) }),
    [sendOf],
  );
  return { sends: list, loading: enabled && sends.isPending, who, sendOf, waitingOn, split };
}

/** The words for where a checked creative stands, the same in every place the agency sees it (brief r12):
 *  "Checked, not sent" before the agency sends it, "With Maja" after. */
export const sendState = (withWhom: string | undefined) => (withWhom ? copy.send.withThem(withWhom) : copy.send.notSent);

/** The status sentence's reader in this frame (DLOAD-1): the client of an agency reads the agency's work as a fact
 *  ("Brygga Studio is planning") and only her approvals as hers; everyone else as the frame says (undefined). */
export function useStatusOptions(): copy.CampaignStatusOptions | undefined {
  const session = useSession().data;
  if (!session?.workspace.agencyId || session.user.agency) return undefined;
  return { viewer: "client", agencyName: session.agencyName };
}

/** "Sent to Maja on 14 Oct · 6 creatives · client link until 13 Nov"; "Sent to Maja on 23 Oct · the plan, version 1" */
export function sendLine(send: ClientSend, who: string, day: (iso: string) => string): string {
  const to = send.to.length ? `Sent to ${who}` : "A client link";
  // Round 13: a send can carry the plan ("the plan, version 2"), the creatives, or both.
  const what = [send.plan ? `the plan, version ${send.plan.version}` : "", send.versionIds.length || !send.plan ? copy.creatives(send.versionIds.length) : ""].filter(Boolean);
  return [`${to} on ${day(send.sentAt)}`, ...what, ...(send.link && send.to.length ? [`client link until ${day(send.link.expiresAt)}`] : send.link ? [`until ${day(send.link.expiresAt)}`] : [])].join(" · ");
}

/** "Maja approved · recorded by Nora" ("You approved", "recorded by you" for the person reading it); the plain
 *  "Maja approved" when it was given in Fume or through the client link. */
export function approvedWords(v: Pick<CreativeVersion, "approvedBy" | "recordedBy">, name: (id?: Id) => string, me: Id): string {
  const who = v.approvedBy ? copy.byYou(name(v.approvedBy), v.approvedBy === me, true) : "The client";
  const approved = `${who} approved`;
  return v.recordedBy ? `${approved} · recorded by ${copy.byYou(name(v.recordedBy), v.recordedBy === me)}` : approved;
}
