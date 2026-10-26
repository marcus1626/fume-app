// The one sidebar of Fume's studio and an agency (FLOWS §25.1), with one list of places per scope and the same names in
// both frames. All brands or all clients: Overview · Check · Campaigns · Deliveries · (Clients) · Team · Usage ·
// Quality log; Fume's admin follows and does not check, so has no Check. One brand or client: Home · Check · Campaigns
// · Brand · Studio · Engine (· Fume for an agency). Brand holds the Brand DNA, the products, the models and references
// and the boards; the Engine holds what it made; while one of them is the current place, its places inside show under
// it. Fume's people have Customer view at the foot of a brand; the admin has a brand's Home and its Campaigns, to read.
// The top of the sidebar is one picker for both: the Fume mark and "All brands" or "All clients", or the brand's mark
// and its market. Its glass menu lists them A to Z (never recent first, so a brand stays where it was), with a quiet
// dot where something waits on you, "Here" on the one you are in, and from 8 up a search and a Recent group. Choosing
// one keeps the place you are on when the new scope has it (scope.ts, equivalent). The brand is found in the brands the
// menu lists, never only in the session.
import {
  Avatar,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Icon,
  Sidebar,
  SidebarAvatar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMark,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@fume/ui";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { isDemo, useDemoSignIn } from "../api/client";
import { useAgencyClients, useAllBrands, useSession, useStudioCampaigns } from "../api/hooks";
import type { AgencyClient, Workspace } from "../contract";
import { useQaWaiting } from "../features/studio/qa/count";
import { AgencyHelpMenu } from "../features/agency/fume-help";
import { AgencyPersonMenu, type NavItem } from "./AgencySidebar";
import type { Frame } from "./Frame";
import { Mark } from "./Logo";
import { initials } from "./people";
import {
  addressBrand,
  brandBase,
  checkPath,
  checkSegment,
  equivalent,
  frameRoot,
  setCustomerView,
  type StaffFrameKind,
} from "./scope";

// ─── The scope ──────────────────────────────────────────────────────────────

/** One brand (Fume) or one client (an agency) in the picker. */
export interface ScopeEntry {
  workspace: Workspace;
  /** What waits on you there (the picker's dot). */
  waiting: number;
  /** An example client with no data of its own in the preview (FLOWS §24.8): its places show its notice. */
  summary: boolean;
  /** When you last opened it (the Recent group, from 8 up). */
  openedAt?: string;
  client?: AgencyClient;
}

export interface StaffScope {
  frame: StaffFrameKind;
  /** The brand or client the address names (/studio/b/:id/…, /agency/b/:id/…); none in the all scope. */
  workspaceId?: string;
  /** That brand or client, once the list knows it. */
  entry?: ScopeEntry;
  /** Every brand or client, A to Z. */
  entries: ScopeEntry[];
  /** True once the list has come, so an unknown address can be told from one still loading. */
  loaded: boolean;
  /** "Fume" or the agency's name. */
  orgName: string;
  /** Fume's admin: follows the brands, never checks; the brand scope is its Home. */
  limited: boolean;
  /** "brand" or "client". */
  noun: "brand" | "client";
}

const byName = (a: ScopeEntry, b: ScopeEntry) =>
  a.workspace.brandName.localeCompare(b.workspace.brandName, "en", { sensitivity: "base" });

/** Where the person is: all brands or clients, or the one the address names. */
export function useStaffScope(frame: StaffFrameKind): StaffScope {
  const session = useSession().data!;
  const { pathname } = useLocation();
  const agency = frame === "agency";
  const all = useAllBrands();
  const clients = useAgencyClients(agency);
  const qa = useQaWaiting();
  const workspaceId = addressBrand(pathname)?.workspaceId;
  const entries = useMemo<ScopeEntry[]>(() => {
    if (agency) {
      if (clients.data)
        return clients.data
          .map((c) => ({
            workspace: c.workspace,
            waiting: c.waitingOnYou,
            summary: c.example === "summary",
            openedAt: c.openedAt,
            client: c,
          }))
          .sort(byName);
      return session.workspaces.map((workspace) => ({ workspace, waiting: 0, summary: false })).sort(byName);
    }
    const needs = all.data?.needsYou ?? [];
    const brands = all.data?.brands.map((b) => b.workspace) ?? session.workspaces;
    const seen = new Set(brands.map((w) => w.id));
    return (
      [...brands, ...session.workspaces.filter((w) => !seen.has(w.id))]
        // A creative waiting in Check counts one each, as Check counts it; the rest of what needs you (a plan, a
        // question) one each too.
        .map((workspace) => ({
          workspace,
          waiting: needs.filter((n) => n.clientId === workspace.id && n.kind !== "check").length + qa.of(workspace.id),
          summary: false,
        }))
        .sort(byName)
    );
  }, [agency, clients.data, all.data, session.workspaces, qa]);
  const entry = workspaceId ? entries.find((e) => e.workspace.id === workspaceId) : undefined;
  return {
    frame,
    workspaceId,
    entry,
    entries,
    loaded: agency ? clients.isSuccess || clients.isError : all.isSuccess || all.isError,
    orgName: agency ? (session.agency?.organisation.name ?? "Your agency") : "Fume",
    limited: !agency && session.user.staffRole === "admin",
    noun: agency ? "client" : "brand",
  };
}

// ─── The places ─────────────────────────────────────────────────────────────

/** Check's number as its page says it (copy.toCheck, "8 to check: 1 plan, 7 creatives"): the creatives that wait for a
 *  check and, in Fume, the plans that wait for the expert's check. */
function useCheckCount(frame: StaffFrameKind): { total: number; of: (workspaceId: string) => number } {
  const qa = useQaWaiting();
  const rows = useStudioCampaigns().data;
  const plans =
    frame === "fume"
      ? (rows ?? []).filter((r) => r.campaign.stage === "plan" && r.campaign.waits?.plan === "in_check")
      : [];
  return { total: qa.total + plans.length, of: (id) => qa.of(id) + plans.filter((r) => r.workspace.id === id).length };
}

/** The places of the scope; Check carries the number its page says (useCheckCount). */
export function useStaffPlaces(scope: StaffScope, campaignBoard = false): NavItem[] {
  const qa = useCheckCount(scope.frame);
  const { frame, workspaceId, limited } = scope;
  const root = frameRoot[frame];
  if (!workspaceId) {
    const overview: NavItem = {
      to: root,
      label: "Overview",
      icon: "house",
      end: true,
      keywords: "home today all brands clients needs you",
    };
    const deliveries: NavItem = {
      to: `${root}/deliveries`,
      label: "Deliveries",
      icon: "download",
      keywords: "deliveries due sent download",
    };
    const team: NavItem = {
      to: `${root}/team`,
      label: "Team",
      icon: "users",
      keywords: "team people load capacity invite",
    };
    // Licence is its own page under Settings, so Usage is lit only on Usage
    const usage: NavItem = {
      to: `${root}/usage`,
      label: "Usage",
      icon: "chart-column",
      keywords: "usage licence creatives made approved renders month",
    };
    const quality: NavItem = {
      to: `${root}/quality`,
      label: "Quality log",
      icon: "list",
      keywords: "quality log findings severity fixed",
    };
    const campaigns: NavItem = {
      to: `${root}/campaigns`,
      label: "Campaigns",
      icon: "megaphone",
      keywords: "campaigns across brands clients calendar plans",
    };
    if (limited) return [overview, campaigns, deliveries, team, usage, quality];
    return [
      overview,
      {
        to: checkPath(frame),
        label: "Check",
        icon: "inbox",
        count: qa.total || undefined,
        holds: [`${root}/queue`],
        keywords: "check qa queue creatives plans to check mark checked",
      },
      campaigns,
      deliveries,
      ...(frame === "agency"
        ? [
            {
              to: "/agency/clients",
              label: "Clients",
              icon: "layout-grid",
              keywords: "clients brands add a client",
            } satisfies NavItem,
          ]
        : []),
      team,
      usage,
      quality,
      // The agency's Settings is a place of its own (its plan with Fume, its people)
      ...(frame === "agency"
        ? [
            {
              to: "/agency/settings",
              label: "Settings",
              icon: "settings",
              keywords: "settings agency fume plan features licence profile roles",
            } satisfies NavItem,
          ]
        : []),
    ];
  }
  const base = brandBase(frame, workspaceId);
  const home: NavItem = {
    to: base,
    label: "Home",
    icon: "house",
    end: true,
    holds: [`${base}/review`],
    keywords: "home brand today needs you waiting",
  };
  // Fume's admin reads the brand's campaigns (she follows the work); a campaign opens the brand's Home
  if (limited)
    return [
      home,
      {
        to: `${base}/campaigns`,
        label: "Campaigns",
        icon: "megaphone",
        end: true,
        keywords: "campaigns brief plan creatives delivery",
      },
    ];
  const boards = `${base}/boards`;
  return [
    home,
    {
      to: `${base}/${checkSegment[frame]}`,
      label: "Check",
      icon: "inbox",
      end: true,
      count: qa.of(workspaceId) || undefined,
      holds: [`${base}/queue`],
      keywords: "check qa queue creatives to check mark checked",
    },
    {
      to: `${base}/campaigns`,
      label: "Campaigns",
      icon: "megaphone",
      holds: [`${base}/deliveries`, `${base}/calendar`, ...(campaignBoard ? [boards] : [])],
      keywords: "campaigns brief plan creatives delivery calendar",
    },
    {
      to: `${base}/brand`,
      label: "Brand",
      icon: "palette",
      holds: [`${base}/products`, `${base}/check/products`, `${base}/assets`, ...(campaignBoard ? [] : [boards])],
      keywords: "brand dna products taste rules",
      sub: [
        {
          to: `${base}/assets`,
          label: "Models and references",
          icon: "users",
          keywords: "models references cast presets assets",
        },
        { to: boards, label: "Boards", icon: "layout-grid", keywords: "boards moodboard" },
      ],
    },
    { to: `${base}/studio`, label: "Studio", icon: "layers", keywords: "studio desk documents sessions edit" },
    {
      to: `${base}/engine`,
      label: "Engine",
      icon: "fume-engine",
      holds: [`${base}/output`],
      keywords: "engine chat make generate runs",
      sub: [
        {
          to: `${base}/output`,
          label: "Engine output",
          icon: "image",
          keywords: "engine output runs generations made candidates",
        },
      ],
    },
    ...(frame === "agency"
      ? [
          {
            to: `${base}/fume`,
            label: "Fume",
            icon: "message-square",
            keywords: "chat ask fume conversation",
          } satisfies NavItem,
        ]
      : []),
  ];
}

// ─── The sidebar ────────────────────────────────────────────────────────────

export function StaffSidebar({ scope, places, frame }: { scope: StaffScope; places: NavItem[]; frame: Frame }) {
  const name = scope.entry?.workspace.brandName;
  const label = name
    ? `${name}, ${scope.frame === "agency" ? scope.orgName : "the Fume studio"}`
    : scope.frame === "agency"
      ? `${scope.orgName} in Fume`
      : "Fume studio";
  return (
    <Sidebar aria-label={label}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <ScopePicker scope={scope} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {places.flatMap((item) => {
              const open = frame.isActive(item) ? (item.sub ?? []) : [];
              const inside = open.some((s) => frame.isActive(s));
              return [
                <SidebarMenuItem key={item.to}>
                  {/* A place is lit while you are in it, unless one of its places inside is (then that one is) */}
                  <SidebarMenuButton
                    asChild
                    isActive={frame.isActive(item) && !inside}
                    icon={item.icon}
                    badge={item.count}
                  >
                    <Link to={item.to} onClick={frame.onPlace(item)} aria-label={item.name}>
                      {item.label}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>,
                ...open.map((s) => (
                  <SidebarMenuItem key={s.to} className="ui-sidebar-menu-item--sub">
                    <SidebarMenuButton asChild isActive={frame.isActive(s)} className="ui-sidebar-menu-button--sub">
                      <Link to={s.to} onClick={frame.onPlace(s)}>
                        {s.label}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )),
              ];
            })}
          </SidebarMenu>
        </SidebarGroup>
        {scope.frame === "fume" && scope.workspaceId && (
          <SidebarGroup>
            <SidebarMenu>
              <SidebarMenuItem>
                <CustomerView />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        {/* Settings is in the person menu, so the foot stays one row. An agency has Help from Fume above the person
            (Book a meeting, Borrow Fume's people, Customer service). */}
        <SidebarMenu>
          {scope.frame === "agency" && (
            <SidebarMenuItem>
              <AgencyHelpMenu />
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>{scope.frame === "agency" ? <AgencyPersonMenu /> : <FumePersonMenu />}</SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

/** Opens the brand as its customer sees it, marked "Fume view" there: the session is already on the brand of the
 *  address, so the customer's Home is the brand's, until "Back to <brand> in the studio". */
function CustomerView() {
  const navigate = useNavigate();
  return (
    <SidebarMenuButton
      icon="eye"
      onClick={() => {
        setCustomerView(true);
        navigate("/");
      }}
    >
      Customer view
    </SidebarMenuButton>
  );
}

// ─── The picker ─────────────────────────────────────────────────────────────

/** A search and a Recent group in the picker from this many brands or clients up (FLOWS §24.4). */
const MANY = 8;

/** A small mark (16 px) holds one letter; the large ones keep two ("BS"). */
const letter = (name: string) => initials(name).slice(0, 1);

/** "LYSNE, 2 waiting on you": a name with what waits on you, for a screen reader. */
const entryName = (name: string, waiting: number) => (waiting ? `${name}, ${waiting} waiting on you` : name);

/**
 * The picker: the top of the sidebar (a large row), or on a phone a quiet pill in the app bar (compact). Its glass
 * menu: All brands or All clients, then each one A to Z with a dot where something waits on you. Choosing keeps the
 * place.
 */
export function ScopePicker({ scope, compact }: { scope: StaffScope; compact?: boolean }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const { frame, entries, noun, limited } = scope;
  const current = scope.entry?.workspace;
  const plural = `${noun}s`;
  const allLabel = `All ${plural}`;
  const many = entries.length >= MANY;
  const q = query.trim().toLowerCase();
  const shown = q ? entries.filter((e) => e.workspace.brandName.toLowerCase().includes(q)) : entries;
  const recent =
    many && !q
      ? entries
          .filter((e) => e.openedAt)
          .sort((a, b) => b.openedAt!.localeCompare(a.openedAt!))
          .slice(0, 3)
      : [];
  const triggerName = `${current ? current.brandName : allLabel}${frame === "agency" ? `, ${scope.orgName}` : ""}. Switch ${noun}`;
  const go = (workspaceId?: string) => navigate(equivalent(pathname, frame, workspaceId, limited));

  const trigger = compact ? (
    <Button
      variant="quiet"
      size="sm"
      iconEnd="chevrons-up-down"
      className="ui-agency-bar-picker"
      aria-label={triggerName}
    >
      {current ? (
        <span className="ui-agency-mark" aria-hidden="true">
          {letter(current.brandName)}
        </span>
      ) : (
        <Mark />
      )}
      <span className="ui-agency-bar-picker-name">{current ? current.brandName : allLabel}</span>
    </Button>
  ) : (
    <SidebarMenuButton
      size="lg"
      leading={
        current ? (
          <SidebarMark>{initials(current.brandName)}</SidebarMark>
        ) : (
          <SidebarMark className="ui-switcher-fume">
            <Mark />
          </SidebarMark>
        )
      }
      description={current ? current.market : `${entries.length} ${entries.length === 1 ? noun : plural}`}
      endIcon="chevrons-up-down"
      aria-label={triggerName}
    >
      {current ? current.brandName : allLabel}
    </SidebarMenuButton>
  );

  // With a mouse the search takes the typing as the menu opens; on a touch screen it waits for a tap, so the keyboard
  // does not cover the list
  useEffect(() => {
    if (!open || !many || !window.matchMedia?.("(pointer: fine)").matches) return;
    const f = requestAnimationFrame(() => field.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(f);
  }, [open, many]);

  // The search field keeps its letters (the menu's typeahead would take them); Down goes into the list, Enter opens the
  // first one found
  const fieldKeys = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.currentTarget.closest('[role="menu"]')?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    } else if (e.key === "Enter" && q && shown.length) {
      e.preventDefault();
      setOpen(false);
      go(shown[0]!.workspace.id);
    } else if (e.key !== "Escape" && e.key !== "Tab") e.stopPropagation();
  };

  const row = (e: ScopeEntry, key: string) => {
    const here = current?.id === e.workspace.id;
    return (
      <DropdownMenuItem
        key={key}
        onSelect={() => go(e.workspace.id)}
        aria-label={entryName(e.workspace.brandName, e.waiting)}
        aria-current={here ? "page" : undefined}
      >
        <span className="ui-switcher-mark" aria-hidden="true">
          {letter(e.workspace.brandName)}
        </span>
        <span className="ui-switcher-name">{e.workspace.brandName}</span>
        {e.waiting > 0 && <span className="ui-agency-dot" aria-hidden="true" />}
        {here && (
          <span className="ui-switcher-here" aria-hidden="true">
            Here
          </span>
        )}
      </DropdownMenuItem>
    );
  };

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="start" className="ui-switcher-menu">
        <DropdownMenuLabel>{`Switch ${noun}`}</DropdownMenuLabel>
        {many && (
          <div className="ui-agency-picker-search">
            <Icon name="search" />
            <input
              ref={field}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={fieldKeys}
              placeholder={`Find a ${noun}`}
              aria-label={`Find a ${noun}`}
              autoComplete="off"
            />
          </div>
        )}
        <DropdownMenuItem
          onSelect={() => go(undefined)}
          aria-label={allLabel}
          aria-current={current ? undefined : "page"}
        >
          <span className="ui-switcher-mark ui-switcher-mark--fume" aria-hidden="true">
            <Mark />
          </span>
          <span className="ui-switcher-name">{allLabel}</span>
          {!current && (
            <span className="ui-switcher-here" aria-hidden="true">
              Here
            </span>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {recent.length > 0 && (
          <>
            <DropdownMenuLabel>Recent</DropdownMenuLabel>
            {recent.map((e) => row(e, `recent-${e.workspace.id}`))}
            <DropdownMenuSeparator />
          </>
        )}
        {shown.length > 0 && (
          <DropdownMenuLabel>
            {q ? `${noun === "brand" ? "Brands" : "Clients"} found` : noun === "brand" ? "Brands" : "Clients"}
          </DropdownMenuLabel>
        )}
        {shown.map((e) => row(e, e.workspace.id))}
        {q && !shown.length && (
          <p className="ui-agency-picker-none">
            No {noun} called “{query.trim()}”
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Fume's person ──────────────────────────────────────────────────────────

const staffTitle = { expert: "Expert", operator: "Operator", admin: "Admin" } as const;

/** One of Fume's people: at the foot of the sidebar, under the avatar in the app bar on a phone. Their profile, the
 *  demo's people and Sign out. */
export function FumePersonMenu({ avatar }: { avatar?: boolean }) {
  const signIn = useDemoSignIn();
  const navigate = useNavigate();
  const { user } = useSession().data!;
  const role = user.staffRole ? staffTitle[user.staffRole] : "";
  const triggerName = `${user.name}, ${role} at Fume. Profile, demo and sign out`;
  return (
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
            description={`${user.title} · ${role}`}
            endIcon="chevrons-up-down"
            aria-label={triggerName}
          >
            {user.name}
          </SidebarMenuButton>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent side={avatar ? "bottom" : "top"} align={avatar ? "end" : "start"}>
        <DropdownMenuLabel>{`${user.name}, ${role.toLowerCase()} at Fume`}</DropdownMenuLabel>
        {/* A Fume person's own profile, in the studio, never the customer's Settings */}
        <DropdownMenuItem icon="user" onSelect={() => navigate("/studio/settings/profile")}>
          Your profile
        </DropdownMenuItem>
        {isDemo && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Sign in as someone else (demo)</DropdownMenuLabel>
            {(
              [
                ["anna", "Anna, expert"],
                ["sander", "Sander, operator"],
                ["vera", "Vera, admin"],
                ["maja", "Maja, LYSNE"],
                ["nora", "Nora, agency lead (demo)"],
              ] as const
            ).map(([who, label]) => (
              <DropdownMenuItem key={who} icon="user" onSelect={() => signIn(who)}>
                {label}
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem icon="log-out" onSelect={() => signIn("maja")}>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
