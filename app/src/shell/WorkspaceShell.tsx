// The customer's workspace (ARCHITECTURE §7.1, UX review 15 Oct §2.4): four places, Home (the one inbox), Campaigns,
// Brand and Fume. On a desk they are the sidebar, with Settings and the workspace in its footer; on a phone they are
// the tab bar at the foot of the screen, and Settings and the account sit under the avatar in the top bar. The older
// places live inside these (Review in Home, Deliveries and the calendar in Campaigns, Products in Brand), so their
// pages light up the place that holds them. The bar has search and the bell; ⌘K opens the command palette. Fume's
// people see a workspace exactly as its customer does, marked "Fume view".
// Round 8 (walk-through 19 Oct): a moodboard lights Brand, or Campaigns when it is a campaign's (WAY-13); tapping the
// place you are on scrolls it to its top, and from a page inside it opens the place itself (WAY-20); on a phone the
// bell opens the inbox page instead of a small popover (MOB-18); and once a sub-page's header has scrolled away, the
// bar keeps its back arrow and its title in view (MOB-7).
// Round 9 (desktop review 19 Oct; PROPOSED 19 Oct 2026):
// - DWAY-6, DLAY-16: on a desk the bar always carries the way back by name ("← Campaigns") beside the sidebar button,
//   and, once the page's header has scrolled away, a divider and the page's title; the page header leaves out its own
//   back row there (data-bar-back), so the content starts higher. A phone keeps round 8's arrow-and-title.
// - DWAY-21: the folded sidebar is remembered on this computer (storageKey). DWAY-9: every icon button names itself.
// - DWAY-11, DLOAD-4: on a desk the bell is the whole list, with All · Unread, counting only what Home does not already
//   ask; All notifications (/notifications) is for the phone and links, and does not light Home.
// - DWAY-10: ⌘K finds creatives too (name · format · campaign, to the viewer), the Brand DNA's parts and the
//   conversations with Fume.
// Round 11 (FLOWS §24; PROPOSED 20 Oct 2026):
// - Agency people (session.user.agency) get the agency's one sidebar (AgencySidebar.tsx) in this frame, on the agency's
//   pages, on a client's pages and (through StudioShell) on the client's studio pages; no "Fume view" badge. A summary
//   client's places show its preview notice (agencyNotice.tsx) instead of the page. ⌘K also goes to every client.
// - A client person in a workspace an agency runs (session.workspace.agencyId) has the customer app without the Fume
//   place (the agency decides whether the client talks to Fume; off by default), and the account menu says who makes
//   the brand's creatives ("Brygga Studio makes this brand's creatives with Fume").
// - The demo's person menus carry "Nora, agency lead (demo)"; inside the agency demo they list its people instead.
// Round 12 (desktop review 20 Oct, DWAY-2, DWAY-3, DWAY-5; PROPOSED 20 Oct 2026): this is the one layout of every
// page in a frame. It picks the frame: an agency's people and Fume's people work in the staff frame (StudioShell.tsx,
// one frame for both, Marcus 20 Oct); a customer, and a client of an agency, in the customer's. The frame itself
// (sidebar, bar, ⌘K, tab bar) is Frame.tsx. Fume's people see a brand exactly as its customer does through Customer
// view (scope.ts): until they go back to the studio, the customer's addresses are the customer's frame, marked "Fume
// view", and the account menu says "Back to LYSNE in the studio" (to the brand, not to All brands). A customer or a
// client who opens a studio or agency address lands on her own page (/agency/b/w-lysne/campaigns/c-autumn →
// /campaigns/c-autumn), or on her Home.
// Round 13 (Marcus #29, robot note 04; PROPOSED 21 Oct 2026): the customer's sidebar is Home, Review, Campaigns,
// Deliveries, Brand, Fume. Review carries the number of creatives that wait on her across campaigns and opens the
// Review place (features/review/ReviewPage.tsx); a campaign's review lights Review, so the sidebar and the page agree
// (it lit Campaigns while the bar said Home). Deliveries is /deliveries. Home keeps its inbox and its count. The
// phone's tab bar keeps five places (Deliveries lives in Campaigns there).
import {
  Avatar,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarLogo,
  SidebarMark,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  type IconName,
} from "@fume/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { isAgencyDemo, restartDemo, useApi, useDemoSignIn } from "../api/client";
import { useBoard, useSession } from "../api/hooks";
import * as copy from "../copy";
import { useReviewCount } from "../features/review/ReviewPage";
import { AgencyDemoSignIns, type NavItem } from "./AgencySidebar";
import { ShellFrame, paletteParts } from "./Frame";
import { Lockup, Mark } from "./Logo";
import { initials } from "./people";
import { customerAddress, customerViewOn, setCustomerView, under } from "./scope";
import { StudioShell } from "./StudioShell";
import { useWaitingOnYou } from "./waiting";

/** A campaign's review (/campaigns/c-autumn/review): Review's, not Campaigns' (round 13). */
const CAMPAIGN_REVIEW = "/campaigns/*/review";

export function WorkspaceShell() {
  const session = useSession().data!;
  const { pathname, search, hash } = useLocation();
  const staffPath = under(pathname, "/studio") || under(pathname, "/agency");
  // An agency's people always work in the staff frame; Fume's people too, except in Customer view
  if (session.user.agency) return <StudioShell />;
  if (session.user.staffRole) return staffPath || !customerViewOn() ? <StudioShell /> : <CustomerWorkspace />;
  // A customer, or a client of an agency, who follows a studio or agency link: her own page
  if (staffPath) return <Navigate to={customerAddress(pathname, search + hash)} replace />;
  // She reads the status sentences as hers; a client of an agency as the client (round 12, DLOAD-4)
  copy.setStatusReader({
    agency: false,
    viewer: session.agencyName ? "client" : undefined,
    agencyName: session.agencyName,
  });
  return <CustomerWorkspace />;
}

/** A moodboard belongs to Brand, or to its campaign (WAY-13). */
function useCampaignBoard(pathname: string) {
  const boardId = /^\/boards\/([^/]+)/.exec(pathname)?.[1];
  const board = useBoard(boardId);
  return Boolean(boardId && board.data?.campaignId);
}

/** The customer's four places (three for a client of an agency, who has no Fume place). */
function CustomerWorkspace() {
  const session = useSession().data!;
  const waiting = useWaitingOnYou();
  const { pathname } = useLocation();
  const campaignBoard = useCampaignBoard(pathname);
  const staff = Boolean(session.user.staffRole);
  // Fume's people in Customer view read the brand's sentences as its customer does
  if (staff) copy.setStatusReader({ agency: false });
  // Round 11 (FLOWS §24.5): a client of an agency talks to the agency; the agency decides whether it also talks to
  // Fume (off by default), so the Fume place is gone and its address goes Home.
  const agencyClient = Boolean(session.workspace.agencyId);
  // … and its Home keeps only her approvals and deliveries (HomePage, CLIENT FLOW): the badge counts the same rows
  // (round 13: and the plans the agency checked and sent her).
  const homeCount = agencyClient
    ? waiting.items.filter((row) => row.kind === "plan" || row.kind === "creatives" || row.kind === "download").length
    : waiting.count;
  const reviewCount = useReviewCount();
  // Round 13 (Marcus #29): Review and Deliveries are places of their own again. Order: Home, Review, Campaigns,
  // Deliveries, Brand, Fume. A campaign's review lights Review, never Campaigns.
  const nav: NavItem[] = [
    {
      to: "/",
      label: "Home",
      icon: "house",
      end: true,
      count: homeCount || undefined,
    },
    {
      to: "/review",
      label: "Review",
      icon: "eye",
      count: reviewCount || undefined,
      holds: [CAMPAIGN_REVIEW],
      keywords: "review approve creatives waiting checked needs changes",
    },
    {
      to: "/campaigns",
      label: "Campaigns",
      icon: "megaphone",
      holds: ["/calendar", ...(campaignBoard ? ["/boards"] : [])],
      except: [CAMPAIGN_REVIEW],
    },
    { to: "/deliveries", label: "Deliveries", icon: "package", keywords: "deliveries download zip ready masters" },
    {
      to: "/brand",
      label: "Brand",
      icon: "palette",
      holds: ["/products", "/check", ...(campaignBoard ? [] : ["/boards"])],
    },
    ...(agencyClient ? [] : [{ to: "/fume", label: "Fume", icon: "message-square" as IconName }]),
  ];
  // The phone's tab bar keeps five: Deliveries lives in Campaigns there.
  const tabs = nav
    .filter((i) => i.to !== "/deliveries")
    .map((i) => (i.to === "/campaigns" ? { ...i, holds: [...(i.holds ?? []), "/deliveries"] } : i));
  if (agencyClient && under(pathname, "/fume")) return <Navigate to="/" replace />;
  const place = `${session.workspace.brandName} in Fume`;
  return (
    <ShellFrame
      label={place}
      tabs={tabs}
      barStart={staff ? <Badge dot="live">Fume view</Badge> : null}
      account={(f) => <AccountMenu onBookMeeting={f.openMeeting} avatar />}
      palette={{ nav, parts: agencyClient ? paletteParts.client : paletteParts.customer }}
      sidebar={(f) => (
        <Sidebar aria-label={place}>
          <SidebarHeader>
            <SidebarLogo asChild logo={<Lockup />} mark={<Mark />}>
              <Link to="/" />
            </SidebarLogo>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarMenu>
                {nav.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={f.isActive(item)} icon={item.icon} badge={item.count}>
                      <Link to={item.to} onClick={f.onPlace(item)}>
                        {item.label}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith("/settings")} icon="settings">
                  <Link to="/settings">Settings</Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <AccountMenu onBookMeeting={f.openMeeting} />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
      )}
    />
  );
}

/**
 * The workspace and the person: at the foot of the sidebar on a desk (its mark, its name), under the avatar in the top
 * bar on a phone, where it also holds Settings. Fume's people switch workspace here. A client of an agency reads who
 * makes the brand's creatives (round 11).
 */
function AccountMenu({ onBookMeeting, avatar }: { onBookMeeting: () => void; avatar?: boolean }) {
  const signIn = useDemoSignIn();
  const session = useSession().data!;
  const api = useApi();
  const client = useQueryClient();
  const navigate = useNavigate();
  const { workspace, workspaces, user, agencyName } = session;
  const many = workspaces.length > 1 || Boolean(user.staffRole);
  // Round 11: inside the agency demo the demo's people are the agency's and LYSNE's, and Sign out signs in as Nora
  const agencyWorld = isAgencyDemo();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {avatar ? (
          <Button
            variant="quiet"
            iconOnly
            aria-label={`${user.name}, ${workspace.brandName}. Settings, profile and workspace`}
          >
            <Avatar size="sm" ink initials={initials(user.name)} />
          </Button>
        ) : (
          <SidebarMenuButton
            size="lg"
            leading={<SidebarMark>{initials(workspace.brandName)}</SidebarMark>}
            description={user.name}
            endIcon="chevrons-up-down"
            aria-label={`${workspace.brandName}, ${user.name}. Switch workspace or person`}
          >
            {workspace.brandName}
          </SidebarMenuButton>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent side={avatar ? "bottom" : "top"} align={avatar ? "end" : "start"}>
        <DropdownMenuLabel>{avatar ? `${user.name}, ${workspace.brandName}` : user.name}</DropdownMenuLabel>
        {agencyName && <DropdownMenuLabel>{`${agencyName} makes this brand’s creatives with Fume`}</DropdownMenuLabel>}
        {many && (
          <>
            {workspaces.map((w) => (
              <DropdownMenuItem
                key={w.id}
                icon={w.id === workspace.id ? "check" : "folder"}
                onSelect={async () => {
                  await api.switchWorkspace(w.id);
                  await client.invalidateQueries();
                  navigate("/");
                }}
              >
                {w.brandName}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}
        {user.staffRole && (
          // Round 12 (DWAY-2): back to the brand she was looking at, in the studio
          <DropdownMenuItem
            icon="layout-grid"
            onSelect={() => {
              setCustomerView(false);
              navigate(`/studio/b/${workspace.id}`);
            }}
          >
            {`Back to ${workspace.brandName} in the studio`}
          </DropdownMenuItem>
        )}
        {avatar && (
          <DropdownMenuItem icon="settings" onSelect={() => navigate("/settings")}>
            Settings
          </DropdownMenuItem>
        )}
        {/* Round 13 (robots' notes 08, 10): Fume's and an agency's people open their own profile, in their own frame */}
        <DropdownMenuItem
          icon="user"
          onSelect={() => {
            if (user.staffRole || user.agency) setCustomerView(false);
            navigate(
              user.staffRole
                ? "/studio/settings/profile"
                : user.agency
                  ? "/agency/settings/profile"
                  : "/settings/profile",
            );
          }}
        >
          Your profile
        </DropdownMenuItem>
        {!user.staffRole && !agencyName && (
          <DropdownMenuItem icon="calendar" onSelect={onBookMeeting}>
            Book a meeting
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {agencyWorld ? (
          <AgencyDemoSignIns />
        ) : (
          <>
            <DropdownMenuLabel>Sign in as someone else (demo)</DropdownMenuLabel>
            {(
              [
                ["maja", "Maja, LYSNE owner"],
                ["jonas", "Jonas, member"],
                ["ida", "Ida, viewer"],
                ["anna", "Anna, expert at Fume"],
                ["sander", "Sander, operator at Fume"],
                ["vera", "Vera, admin at Fume"],
                ["nora", "Nora, agency lead (demo)"],
              ] as const
            ).map(([who, label]) => (
              <DropdownMenuItem key={who} icon="user" onSelect={() => signIn(who)}>
                {label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem icon="rotate-ccw" onSelect={() => restartDemo(true)}>
              Start as a new brand (demo)
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem icon="log-out" onSelect={() => signIn(agencyWorld ? "nora" : "maja")}>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
