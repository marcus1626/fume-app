// Who acted, for Fume's people: the brand's own people (Maja) and Fume's team (Anna, Tuva), so a row can say
// "Made by Tuva" or "Maja approved" on any brand, not only the one the session sits in.
import { usePeople, useSession, useTeamLoad } from "../../../api/hooks";
import type { Id, User } from "../../../contract";
import { firstName } from "../../../shell/people";

export function useNames() {
  const people = usePeople().data ?? [];
  const team = useTeamLoad().data ?? [];
  const me = useSession().data?.user;
  const byId = new Map<Id, User>();
  for (const u of [...people, ...team.map((r) => r.user), ...(me ? [me] : [])]) byId.set(u.id, u);
  const who = (id: Id | undefined) => (id && id === me?.id ? "you" : id ? firstName(byId.get(id)?.name ?? "Someone") : "Someone");
  return {
    /** "Anna", or "Someone" when the person is not known here. */
    name: (id: Id | undefined) => (id ? firstName(byId.get(id)?.name ?? "Someone") : "Someone"),
    /** "you" for the signed-in person, otherwise the first name. */
    who,
    /** "You" or "Anna", to start a sentence. */
    Who: (id: Id | undefined) => {
      const w = who(id);
      return w.charAt(0).toUpperCase() + w.slice(1);
    },
  };
}
