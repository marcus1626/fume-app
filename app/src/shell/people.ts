// People in the app's words: the sign a person carries (avatar or initials), and who acted on something.
// Anna's avatar is Ink: the person who checks (F-D074). Fume and the Engine never pose as people.
// Round 9 (DLOAD-18; PROPOSED 19 Oct 2026): the signed-in person is "you", never their own name in the third person.
// useIsMe() tells whether a person (an id, a User or a name) is the one signed in; copy.byYou() says it.
import type { PersonSign } from "@fume/ui";
import { useCallback } from "react";
import { useSession } from "../api/hooks";
import type { MessageAuthor, User } from "../contract";

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

export const firstName = (name: string) => name.split(/\s+/)[0] ?? name;

export function sign(user: User | undefined): PersonSign {
  if (!user) return { name: "Someone", initials: "?" };
  return { name: user.name, avatar: user.avatar, initials: initials(user.name), ink: user.staffRole === "expert" };
}

/** A lookup over the people the screen knows, so a row can name who acted. */
export function directory(people: User[] | undefined) {
  const byId = new Map((people ?? []).map((u) => [u.id, u]));
  return {
    user: (id: string | undefined) => (id ? byId.get(id) : undefined),
    name: (id: string | undefined) => (id ? firstName(byId.get(id)?.name ?? "Someone") : "Someone"),
    author(author: MessageAuthor): string {
      if (author.kind === "fume") return "Fume";
      if (author.kind === "engine") return "The Engine";
      return firstName(byId.get(author.userId)?.name ?? "Someone");
    },
  };
}

/**
 * Whether a person is the one signed in (DLOAD-18): pass their id ("u-maja"), the User, or a name ("Maja Lind" or
 * "Maja"). Use it with copy.byYou: `copy.byYou(user.name, isMe(user), true)` → "You".
 *   const isMe = useIsMe();
 */
export function useIsMe(): (who: string | Pick<User, "id"> | null | undefined) => boolean {
  const me = useSession().data?.user;
  return useCallback(
    (who) => {
      if (!me || !who) return false;
      if (typeof who !== "string") return who.id === me.id;
      if (who === me.id) return true;
      const name = who.trim().toLowerCase();
      return name === me.name.toLowerCase() || name === firstName(me.name).toLowerCase();
    },
    [me],
  );
}
