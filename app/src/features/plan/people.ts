// Who the plan names, for the customer and for Fume's expert alike: the brand's people and Fume's team on it, and "you"
// for the person signed in. `viewer` is who reads: "customer" (Maja in Fume), "staff" (Anna), "agency" (Nora) or
// "client" (Maja in Brygga Studio's world). The customer approves the plan, in Fume and in a brand an agency runs,
// where the agency checks it and sends it to the client (FLOWS §26.8). So `approver` is the customer or client for
// everyone ("Maja", "you" for her), and `planner` names who shapes the plan: the agency in a brand it runs ("you",
// "Brygga Studio"), the one who approves it everywhere else.
import { usePeople, useSession, useTeam } from "../../api/hooks";
import type { Campaign, Id, User } from "../../contract";
import * as copy from "../../copy";

export type PlanViewer = "customer" | "staff" | "agency" | "client";

export interface PlanPeople {
  /** The person, when known. */
  user: (id?: Id) => User | undefined;
  /** "you" / "Anna", in the middle of a sentence. */
  name: (id?: Id) => string;
  /** "You" / "Anna", to start one. */
  Name: (id?: Id) => string;
  /** Whether this is the person signed in. */
  isMe: (id?: Id) => boolean;
  /** The person signed in. */
  me: User | undefined;
  /** Fume's expert on this brand ("Anna"), or "the expert". None in a brand an agency runs: the agency checks its own. */
  expert: User | undefined;
  expertName: string;
  /** The signed-in person reads the plan as one of Fume's people or the agency's (the third person for the customer). */
  staff: boolean;
  /** Who reads it (see above). */
  viewer: PlanViewer;
  /** The agency that runs the brand, when one does ("Brygga Studio"). */
  agencyName?: string;
  /** Who approves the plan, in the middle of a sentence ("you", "Maja"), and to start one. */
  approver: (campaign: Pick<Campaign, "approverId">) => string;
  Approver: (campaign: Pick<Campaign, "approverId">) => string;
  /** Who shapes the plan with Fume (chooses its direction): the agency in a brand it runs ("you", "Brygga Studio"). */
  planner: (campaign: Pick<Campaign, "approverId">) => string;
}

export function usePlanPeople(): PlanPeople {
  const session = useSession().data;
  const people = usePeople().data ?? [];
  const team = useTeam().data?.fumeTeam ?? [];
  const me = session?.user;
  const byId = new Map<Id, User>();
  for (const u of [...people, ...team, ...(me ? [me] : [])]) byId.set(u.id, u);
  const agencyRun = Boolean(session?.workspace.agencyId);
  const viewer: PlanViewer = agencyRun ? (me?.agency ? "agency" : "client") : me?.staffRole ? "staff" : "customer";
  const agencyName = agencyRun
    ? (session?.agency?.organisation.name ?? session?.agencyName ?? "The agency")
    : undefined;
  // No Fume expert checks the plan in a brand an agency runs (FLOWS §24.2).
  const expert = agencyRun ? undefined : team.find((u) => u.staffRole === "expert");
  const isMe = (id?: Id) => Boolean(id && me && id === me.id);
  const full = (id?: Id) => (id ? (byId.get(id)?.name ?? "Someone") : "Someone");
  const name = (id?: Id) => copy.byYou(full(id), isMe(id));
  const approver = (c: Pick<Campaign, "approverId">) => name(c.approverId);
  const planner = (c: Pick<Campaign, "approverId">) =>
    viewer === "agency" ? "you" : viewer === "client" ? (agencyName ?? "the agency") : approver(c);
  return {
    user: (id) => (id ? byId.get(id) : undefined),
    name,
    Name: (id) => copy.byYou(full(id), isMe(id), true),
    isMe,
    me,
    expert,
    expertName: expert ? copy.byYou(expert.name, isMe(expert.id)) : "the expert",
    staff: viewer === "staff" || viewer === "agency",
    viewer,
    agencyName,
    approver,
    planner,
    Approver: (c) => {
      const a = approver(c);
      return a.charAt(0).toUpperCase() + a.slice(1);
    },
  };
}
