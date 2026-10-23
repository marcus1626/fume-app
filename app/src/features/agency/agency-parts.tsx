// Round 11 (FLOWS §24.3, PROPOSED 20 Oct 2026): the parts the agency's places share. A client's mark, who an agency
// person is, opening a client from any of the agency's places (a summary client opens its Home, where the shell shows
// its preview notice), and a campaign's one status sentence as the agency reads it: the agency checks, and creatives
// it has checked wait on the client ("6 creatives with Maja"), never "to approve" (only the client approves, §24.2).
import { Avatar, AvatarGroup, AvatarGroupCount, BadgeDot, cx } from "@fume/ui";
import { useSession } from "../../api/hooks";
import type { AgencyCampaignRow, AgencyClient, AgencyRole, Campaign, Id, User, Workspace } from "../../contract";
import * as copy from "../../copy";
import { firstName, initials } from "../../shell/people";
import { useOpenClient } from "./useOpenClient";

/** "Good morning" … "Good evening", by the hour in Oslo (as the customer's Home). */
export function greeting(): string {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/Oslo" }).format(Date.now()));
  if (hour < 5 || hour >= 22) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// Round 13 AGENCY (Marcus #70, 22 Oct 2026: "Agency skal egentlig bare være ganske likt som vår egen side, admin,
// expert, sånne ting"; PROPOSED): an agency's people have Fume's own roles, Admin, Expert and Operator. The contract's
// seat stays "lead" or "creative"; the Admin is the lead, and a creative is an Expert, or an Operator when they run the
// Engine (staffRole "operator", Sindre the producer).
export type AgencyRoleName = "admin" | "expert" | "operator";
export const agencyRoleWords: Record<AgencyRoleName, string> = { admin: "Admin", expert: "Expert", operator: "Operator" };
export const agencyRoleHelp: Record<AgencyRoleName, string> = {
  admin: "Everything an expert does, plus clients, the team, the Fume plan and usage",
  expert: "Briefs and plans, the Studio and the Engine, checks every creative, sends to the client",
  operator: "Runs the Engine and the Studio for the campaigns; an expert checks the work",
};
/** A person's role in the agency, in Fume's words. */
export const agencyRoleOf = (role: AgencyRole, user?: Pick<User, "staffRole">): AgencyRoleName => (role === "lead" ? "admin" : user?.staffRole === "operator" ? "operator" : "expert");
/** The seat's role in Fume's words, where the person is not at hand (the Overview's team line falls back to it). */
export const agencyRole: Record<AgencyRole, string> = { lead: agencyRoleWords.admin, creative: agencyRoleWords.expert };

/** Who is signed in, as the agency's places need it: the agency, and whether this person leads it. */
export function useAgencySeat() {
  const session = useSession().data;
  const agency = session?.agency;
  return { agency: agency?.organisation, lead: agency?.role === "lead", me: session?.user, isAgency: Boolean(agency) };
}

/** A client brand's mark: its initial on the Ink soft square, as in the switcher (studio.css). */
export function ClientMark({ workspace, small, className }: { workspace: Pick<Workspace, "brandName">; small?: boolean; className?: string }) {
  return (
    <span className={cx("ui-studio-mark", small && "ui-studio-mark--sm", className)} aria-hidden="true">
      {initials(workspace.brandName)}
    </span>
  );
}

/** The quiet dot beside a client that waits on the agency (the picker's dot, the list's count). */
export function WaitsDot({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ui-agency-dot" role="img" aria-label={count === 1 ? "One thing waits on you" : `${count} things wait on you`}>
      <BadgeDot />
    </span>
  );
}

/** A few faces, with everyone's name for a screen reader: "Maja Lind, Jonas Berg". */
export function Faces({ people, max = 3, label }: { people: User[]; max?: number; label?: string }) {
  if (!people.length) return null;
  const shown = people.slice(0, max);
  return (
    <AvatarGroup role="img" aria-label={label ?? people.map((p) => p.name).join(", ")}>
      {shown.map((p) => (
        <Avatar key={p.id} size="sm" src={p.avatar} initials={initials(p.name)} aria-hidden="true" />
      ))}
      {people.length > max && <AvatarGroupCount aria-hidden="true">+{people.length - max}</AvatarGroupCount>}
    </AvatarGroup>
  );
}

/** Opens a client from the agency's places. A full example client goes where it was asked (its plan, its campaign);
 *  a summary client always opens its Home, where the shell says it is an example (FLOWS §24.8). */
export function useOpenFromAgency() {
  const open = useOpenClient();
  return (client: { id: Id; example: AgencyClient["example"] }, to = "/") => open(client.id, client.example === "full" ? to : "/");
}

/** "Waiting on Maja" or "6 creatives with Maja" → "Maja". */
export function clientPerson(words?: string): string | undefined {
  if (!words) return undefined;
  const m = /(?:Waiting on|with)\s+(.+)$/.exec(words);
  return m?.[1]?.trim();
}

/** A campaign's one status sentence as the agency reads it (copy.campaignStatus, viewer "agency"): creatives it sent
 *  wait on the client ("6 creatives with Maja"), creatives in check and checked ones not sent are the agency's ("7
 *  creatives to check", "2 creatives to send to Maja"). */
export function agencyStatus(c: Campaign, client?: string): { words: string; on: "you" | "client" | "fume" | "done" } {
  const s = copy.campaignStatus(c, undefined, { viewer: "agency", customerName: client });
  return { words: s.words, on: s.on === "expert" ? "you" : s.on };
}

/** A row of the agency's campaign table: its sentence and who it waits on, the same way for full and summary rows. */
export function rowStatus(row: AgencyCampaignRow): { words: string; on: string } {
  const person = clientPerson(row.waitingOn);
  // A summary row's sentence names the agency's own step ("2 creatives to check", "The brief waits on you") when it has one.
  if (row.example === "summary") return { words: row.status, on: /to check|on you|for you|to confirm|to send/i.test(row.status) ? "You" : (person ?? "You") };
  const s = agencyStatus(row.campaign, person);
  const on = s.on === "client" ? (person ?? "The client") : s.on === "you" ? "You" : s.on === "fume" ? "Fume" : "";
  return { words: s.words, on: person && s.on !== "done" && s.on !== "you" ? person : on };
}

/** "Nora" or "You". */
export const nameOrYou = (user: User | undefined, me: User | undefined) => (user ? copy.byYou(user.name, user.id === me?.id, true) : undefined);

/** The first name, for a column that only has room for it. */
export const first = (user?: User) => (user ? firstName(user.name) : undefined);

/** Round 13 AGENCY (robot note 11-agency-client: "4 wait for the expert", "made for the expert"): who checks, in the
 *  frame's words. Fume's expert in Fume; in an agency its own team, since no Fume expert checks an agency's work. */
export function useCheckWords() {
  const agency = Boolean(useSession().data?.user.agency);
  return agency
    ? { taught: "what your team has taught it in Check", waitFor: "wait for your check", lands: "lands in Check for your team", allChecked: "Your team checked all of them", checkedBy: "checked by your team", talks: "Only your team talks to it; your clients talk to you.", planDone: "checked" }
    : { taught: "what the expert has taught it in Check", waitFor: "wait for the expert", lands: "lands in Check for the expert", allChecked: "The expert checked all of them", checkedBy: "checked by the expert", talks: "Only Fume’s people talk to it; customers talk to Fume.", planDone: "approved" };
}
export type CheckWords = ReturnType<typeof useCheckWords>;
