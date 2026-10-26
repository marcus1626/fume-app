// The one layout of every page in a frame. It picks the frame: Fume's people and an agency's people work in the staff
// frame (StudioShell.tsx); a customer, and a client of an agency, in the customer's. The frame itself (sidebar, bar,
// ⌘K, tab bar) is Frame.tsx.
// The customer's places are Home, Review, Campaigns, Deliveries, Brand and Fume (FLOWS §26.3); the phone's tab bar
// keeps five (Deliveries lives in Campaigns there). A page inside a place lights it: a moodboard lights Brand or its
// campaign, a campaign's review lights Review.
// Fume's people see a brand exactly as its customer does through Customer view (scope.ts), marked "Fume view", until
// they go back to the studio. A client of an agency has no Fume place unless the agency turns it on (FLOWS §24.5). A
// customer or a client who opens a studio or agency address lands on her own page (/agency/b/w-lysne/campaigns/c-autumn
// → /campaigns/c-autumn), or on her Home.
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

/** A campaign's review (/campaigns/c-autumn/review) belongs to Review, not Campaigns. */
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
  // She reads the status sentences as hers; a client of an agency as the client
  copy.setStatusReader({
    agency: false,
    viewer: session.agencyName ? "client" : undefined,
    agencyName: session.agencyName,
  });
  return <CustomerWorkspace />;
}

/** A moodboard belongs to Brand, or to its campaign. */
function useCampaignBoard(pathname: string) {
  const boardId = /^\/boards\/([^/]+)/.exec(pathname)?.[1];
  const board = useBoard(boardId);
  return Boolean(boardId && board.data?.campaignId);
}

/** The customer's places (a client of an agency has no Fume place). */
function CustomerWorkspace() {
  const session = useSession().data!;
  const waiting = useWaitingOnYou();
  const { pathname } = useLocation();
  const campaignBoard = useCampaignBoard(pathname);
  const staff = Boolean(session.user.staffRole);
  // Fume's people in Customer view read the brand's sentences as its customer does
  if (staff) copy.setStatusReader({ agency: false });
  // A client of an agency talks to the agency; the agency decides whether it also talks to Fume (off by default), so
  // the Fume place is gone and its address goes Home (FLOWS §24.5).
  const agencyClient = Boolean(session.workspace.agencyId);
  // … and its Home keeps only her approvals, her deliveries and the plans the agency checked and sent her: the badge
  // counts the same rows.
  const homeCount = agencyClient
    ? waiting.items.filter((row) => row.kind === "plan" || row.kind === "creatives" || row.kind === "download").length
    : waiting.count;
  const reviewCount = useReviewCount();
  // Review and Deliveries are places of their own: Home, Review, Campaigns, Deliveries, Brand, Fume. A campaign's
  // review lights Review, never Campaigns (FLOWS §26.3).
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
 * makes the brand's creatives.
 */
function AccountMenu({ onBookMeeting, avatar }: { onBookMeeting: () => void; avatar?: boolean }) {
  const signIn = useDemoSignIn();
  const session = useSession().data!;
  const api = useApi();
  const client = useQueryClient();
  const navigate = useNavigate();
  const { workspace, workspaces, user, agencyName } = session;
  const many = workspaces.length > 1 || Boolean(user.staffRole);
  // Inside the agency demo the demo's people are the agency's and LYSNE's, and Sign out signs in as Nora
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
          // Back to the brand she was looking at, in the studio
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
        {/* Fume's and an agency's people open their own profile, in their own frame */}
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
