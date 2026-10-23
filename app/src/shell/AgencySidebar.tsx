// The agency's person (round 11, FLOWS §24.3, §24.8; PROPOSED 20 Oct 2026): the person menu at the foot of the sidebar
// and the agency demo's sign-ins (Nora, Even, Maja and Jonas of LYSNE, Leave the agency demo), and the shape of one
// place in a sidebar.
// Round 12 (desktop review 20 Oct, DWAY-5; PROPOSED 20 Oct 2026): the agency's sidebar, its picker and its ⌘K rows moved
// to StaffSidebar.tsx and StudioShell.tsx, the one frame Fume's studio and an agency share. "Licence and usage" opens
// the one Usage page (/agency/usage, DTASK-6).
// Round 13 AGENCY (Marcus #71, robot note 10-agency; PROPOSED 22 Oct 2026): the person menu holds the three ways to
// Fume's people (Book a meeting, Borrow Fume's people, Customer service; on a phone this menu is where they are), and
// Your profile opens the agency's own profile page (/agency/settings/profile), never the customer's settings.
import {
  Avatar,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  SidebarAvatar,
  SidebarMenuButton,
  type IconName,
  type NotificationData,
} from "@fume/ui";
import { useNavigate } from "react-router-dom";
import { leaveAgencyDemo, useDemoSignIn, type DemoPerson } from "../api/client";
import { HelpMenuItems, useFumeHelp } from "../features/agency/fume-help";
import { useSession } from "../api/hooks";
import type { AgencyNeed, Notification } from "../contract";
import { homeKeys, isOnHome } from "./notifications";
import { initials } from "./people";
import type { WaitingKind } from "./waiting";

export { under } from "./scope";

/** One place in a sidebar or the phone's tab bar (both shells use it). */
export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
  count?: number;
  /** Older or deeper addresses that live inside this place, so their pages light it up. A star stands for one segment
   *  of the address (round 13). */
  holds?: string[];
  /** Addresses under this place that belong to another place, so they never light this one (round 13: a campaign's
   *  review lights Review, not Campaigns). "*" stands for one segment. */
  except?: string[];
  /** The link's name when its words alone repeat in the sidebar ("Campaigns, LYSNE" under a client in the list). */
  name?: string;
  /** Places inside this one, shown under it while it is the current place (Brand: Models and references, Boards). */
  sub?: NavItem[];
  /** Words ⌘K finds it by, beyond its label. */
  keywords?: string;
}

// ─── The person menu ────────────────────────────────────────────────────────

/** The agency demo's people (FLOWS §24.8): signing in as one of them stays in Brygga Studio's world. */
const agencyDemoPeople: [DemoPerson, string][] = [
  ["nora", "Nora, agency lead"],
  ["even", "Even, designer"],
  ["maja", "Maja, LYSNE (the client)"],
  ["jonas", "Jonas, LYSNE"],
];

/** The demo's sign-ins inside the agency world, for any person menu there (the agency's and the client's). */
export function AgencyDemoSignIns() {
  const signIn = useDemoSignIn();
  return (
    <>
      <DropdownMenuLabel>Sign in as someone else (demo)</DropdownMenuLabel>
      {agencyDemoPeople.map(([who, label]) => (
        <DropdownMenuItem key={who} icon="user" onSelect={() => signIn(who)}>
          {label}
        </DropdownMenuItem>
      ))}
      <DropdownMenuItem icon="rotate-ccw" onSelect={() => leaveAgencyDemo()}>
        Leave the agency demo
      </DropdownMenuItem>
    </>
  );
}

/**
 * The agency person: at the foot of the sidebar on a desk, under the avatar in the app bar on a phone. The agency's
 * Settings (and, for the lead, Licence and usage), the demo switch between A and B, the demo's people and Sign out
 * (which in the agency demo signs in as Nora again).
 */
export function AgencyPersonMenu({ avatar }: { avatar?: boolean }) {
  const session = useSession().data!;
  const navigate = useNavigate();
  const signIn = useDemoSignIn();
  const { user } = session;
  const agencyName = session.agency?.organisation.name ?? "";
  const lead = session.agency?.role === "lead";
  const triggerName = `${user.name}, ${agencyName}. Settings, help from Fume, demo and sign out`;
  const help = useFumeHelp();
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {avatar ? (
            <Button variant="quiet" iconOnly aria-label={triggerName}>
              <Avatar size="sm" ink initials={initials(user.name)} />
            </Button>
          ) : (
            <SidebarMenuButton
              size="lg"
              leading={<SidebarAvatar>{initials(user.name)}</SidebarAvatar>}
              description={agencyName}
              endIcon="chevrons-up-down"
              aria-label={triggerName}
            >
              {user.name}
            </SidebarMenuButton>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent side={avatar ? "bottom" : "top"} align={avatar ? "end" : "start"}>
          <DropdownMenuLabel>{`${user.name}, ${user.title.toLowerCase()} at ${agencyName}`}</DropdownMenuLabel>
          <DropdownMenuItem icon="settings" onSelect={() => navigate("/agency/settings")}>
            Settings
          </DropdownMenuItem>
          {lead && (
            <DropdownMenuItem icon="chart-column" onSelect={() => navigate("/agency/usage")}>
              Licence and usage
            </DropdownMenuItem>
          )}
          <DropdownMenuItem icon="user" onSelect={() => navigate("/agency/settings/profile")}>
            Your profile
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Help from Fume</DropdownMenuLabel>
          <HelpMenuItems onOpen={help.open} />
          <DropdownMenuSeparator />
          <AgencyDemoSignIns />
          <DropdownMenuSeparator />
          <DropdownMenuItem icon="log-out" onSelect={() => signIn("nora")}>
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {help.panels}
    </>
  );
}

// ─── The agency's bell (round 13, robot note 10-agency) ─────────────────────

const needKinds: Record<AgencyNeed["kind"], WaitingKind[]> = {
  plan: ["plan"],
  check: ["creatives"],
  brief: ["brief"],
  products: ["products"],
  brand: ["brand"],
  client_changes: [],
};
/** The campaign a Needs-you row is about: "/campaigns/c-winter/plan", "…/qa?campaign=c-autumn". */
const needCampaign = (href: string) =>
  /\/campaigns\/([^/?#]+)/.exec(href)?.[1] ?? /[?&]campaign=([^&#]+)/.exec(href)?.[1];

/**
 * The agency's bell is the same under All clients and inside any client (the robot saw 2 and 3): a notification is
 * read when it was read, or when the agency's Needs you (every client) already asks what it asks. The customer's rule
 * (shell/notifications.ts) read the session's one brand, so the number changed with the client.
 */
export function agencyBell(
  items: NotificationData[],
  raw: Notification[] | undefined,
  needs: AgencyNeed[],
): { items: NotificationData[]; unread: number } {
  const keys = new Set(
    homeKeys(
      needs
        .map((n) => ({ kind: needKinds[n.kind][0] ?? "draft", campaignId: needCampaign(n.href) }))
        .filter((r) => r.kind !== "draft"),
    ),
  );
  const read = new Map((raw ?? []).map((n) => [n.id, n.read]));
  const shown = items.map((n) => {
    const unread = read.get(n.id) === false && !isOnHome(n.kind, keys, n.href);
    return unread === n.unread ? n : { ...n, unread };
  });
  return { items: shown, unread: shown.filter((n) => n.unread && !n.id.startsWith("need-")).length };
}
