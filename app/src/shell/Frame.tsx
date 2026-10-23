// The frame every shell draws, so the customer's workspace, Fume's studio and an agency share one: the sidebar (given),
// the page's sheet with the app bar (56 px: the way back by name and, once the header has scrolled away, the page's
// title; search with ⌘K; the bell; the person on a phone), the phone's tab bar, ⌘K and the product card beside the
// page. The folded sidebar is remembered (storageKey). In a brand or client scope the frame names the brand to the
// page, so the browser tab says "Autumn launch · LYSNE · Fume".
import {
  Button,
  CommandPalette,
  NotificationBell,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  TabBar,
  TabBarItem,
  useNarrowScreen,
  type CommandPaletteItem,
  type IconName,
  type NotificationData,
} from "@fume/ui";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useCampaigns, useCampaignViews, useCatalogue, useDeliveries, usePlans, useThreads } from "../api/hooks";
import type { CampaignPlan, VersionState } from "../contract";
import * as copy from "../copy";
import { BookMeetingDialog } from "../features/fume/meeting";
import { ReturnToChat } from "../features/fume/open";
import { NotificationsPopover } from "../features/notifications/NotificationsPopover";
import { campaignSubject, creativeLabels, customerName } from "../features/review/names";
import { ProductCheckHost } from "../features/check/ProductCheckHost";
import type { NavItem } from "./AgencySidebar";
import { useNotificationItems } from "./notifications";
import { BarBack, PageBarProvider, PageScopeProvider, type PageBar } from "./Page";
import { under } from "./scope";

/** What a shell's parts get from the frame: whether a place is the current one, the place's click, the meeting. */
export interface Frame {
  isActive: (item: NavItem) => boolean;
  onPlace: (item: NavItem) => (e: MouseEvent<HTMLAnchorElement>) => void;
  openMeeting: () => void;
}

/** An address at or under `to`, where a star in `to` stands for one segment. */
const underPattern = (pathname: string, to: string) =>
  to.includes("*")
    ? new RegExp(
        `^${to
          .split("*")
          .map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
          .join("[^/]+")}(?:/|$)`,
      ).test(pathname)
    : under(pathname, to);

/** Whether a place is the one you are on: its own address, or one it holds, and none it leaves to another place. */
export const placeIsActive = (pathname: string, item: NavItem) =>
  !(item.except ?? []).some((x) => underPattern(pathname, x)) &&
  ((item.end ? pathname === item.to : under(pathname, item.to)) ||
    (item.holds ?? []).some((h) => underPattern(pathname, h)));

export function ShellFrame({
  label,
  tabs,
  sidebar,
  barStart,
  account,
  content,
  palette,
  drawer,
  bell,
  scopeName,
}: {
  label: string;
  tabs: NavItem[];
  sidebar: (frame: Frame) => ReactNode;
  barStart?: ReactNode | ((state: { phone: boolean; away: boolean }) => ReactNode);
  account: (frame: Frame) => ReactNode;
  /** In place of the route's page (an example client's notice, a brand that is still opening). */
  content?: ReactNode;
  palette: Omit<PaletteProps, "open" | "onOpenChange" | "onBookMeeting">;
  /** Keep the drawer's button on a phone: the places do not all fit the tab bar (the agency's and the studio's). */
  drawer?: boolean;
  /** The bell's rows and number, when the frame says more than the person's notifications (the studio's). */
  bell?: { items: NotificationData[]; unread: number };
  /** The brand or client the scope is in, for the browser tab's title ("Autumn launch · LYSNE · Fume"). */
  scopeName?: string;
}) {
  const notified = useNotificationItems();
  const shownBell = bell ?? notified;
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const phone = useNarrowScreen("(max-width: 639.98px)");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const openMeeting = useCallback(() => setMeetingOpen(true), []);
  // What the page tells the bar, and whether its header has scrolled away under the bar
  const [bar, setBarState] = useState<PageBar>({});
  const setBar = useCallback((b: PageBar) => setBarState((prev) => ({ ...prev, ...b })), []);
  const inset = useRef<HTMLElement>(null);
  const away = useHeaderAway(inset, pathname, Boolean(bar.back || bar.title));

  const isActive = (item: NavItem) => placeIsActive(pathname, item);
  // The place you are on: its top. From a page inside it: the place itself (the link does that).
  const onPlace = (item: NavItem) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (pathname !== item.to) return;
    e.preventDefault();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    inset.current?.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };
  const frame: Frame = { isActive, onPlace, openMeeting };

  return (
    <SidebarProvider storageKey="fume.sidebar">
      {sidebar(frame)}
      <SidebarInset ref={inset} data-bar-back={bar.back ? "" : undefined}>
        <div className="ui-app-bar">
          <SidebarTrigger data-agency-drawer={drawer ? "" : undefined} />
          {typeof barStart === "function" ? barStart({ phone, away }) : barStart}
          {(bar.back || bar.title) && (
            <div className="ui-app-bar-back" data-shown={away ? "" : undefined}>
              <BarBack back={bar.back} title={bar.title} away={away} />
            </div>
          )}
          <div className="ui-app-bar-end">
            <Button
              variant="quiet"
              iconOnly
              icon="search"
              aria-label="Search"
              shortcut="⌘K"
              onClick={() => setPaletteOpen(true)}
            />
            {phone ? (
              // On a phone the inbox is a page, in reach of the thumb, not a small glass card at the top
              <NotificationBell unread={shownBell.unread} onClick={() => navigate("/notifications")} />
            ) : (
              <NotificationsPopover items={shownBell.items} unread={shownBell.unread} />
            )}
            {phone && account(frame)}
          </div>
        </div>
        <PageScopeProvider value={scopeName}>
          <PageBarProvider value={setBar}>{content ?? <Outlet />}</PageBarProvider>
        </PageScopeProvider>
      </SidebarInset>
      <TabBar aria-label={label}>
        {tabs.map((item) => (
          <TabBarItem key={item.to} asChild icon={item.icon} isActive={isActive(item)} count={item.count}>
            <Link to={item.to} onClick={onPlace(item)}>
              {item.label}
            </Link>
          </TabBarItem>
        ))}
      </TabBar>
      <Palette open={paletteOpen} onOpenChange={setPaletteOpen} onBookMeeting={openMeeting} {...palette} />
      <BookMeetingDialog open={meetingOpen} onOpenChange={setMeetingOpen} />
      <ProductCheckHost />
      <ReturnToChat />
    </SidebarProvider>
  );
}

/** True once the page's own title has scrolled up under the app bar (the bar then shows the way back). */
function useHeaderAway(inset: RefObject<HTMLElement | null>, pathname: string, watching: boolean) {
  const [away, setAway] = useState(false);
  useEffect(() => {
    const s = inset.current;
    setAway(false);
    if (!s || !watching) return;
    let frame = 0;
    const check = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const title = s.querySelector<HTMLElement>(".ui-app-page .ui-page-header-title");
        const bar = s.querySelector<HTMLElement>(":scope > .ui-app-bar");
        if (!title || !bar) return setAway(false);
        setAway(title.getBoundingClientRect().bottom <= bar.getBoundingClientRect().bottom);
      });
    };
    check();
    s.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      s.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
      window.cancelAnimationFrame(frame);
    };
  }, [inset, pathname, watching]);
  return away;
}

// ─── ⌘K ─────────────────────────────────────────────────────────────────────

/** Words that find one of the customer's places, and the agency's, by what it holds. */
const keywords: Record<string, string> = {
  "/": "inbox waiting review decisions approve ready download learned",
  "/campaigns": "brief creatives delivery",
  "/brand": "brand dna board guidelines",
  "/fume": "chat ask conversation contact",
};

/** The places inside the main places, so ⌘K still finds them by their own names. */
const inside: {
  to: string;
  label: string;
  icon: IconName;
  keywords: string;
}[] = [
  {
    to: "/campaigns?show=calendar",
    label: "Campaigns · Calendar",
    icon: "calendar",
    // not "plan": that word finds each campaign's plan
    keywords: "calendar schedule when dates",
  },
  {
    to: "/deliveries",
    label: "Campaigns · All deliveries",
    icon: "download",
    keywords: "deliveries download zip",
  },
  {
    to: "/brand/products",
    label: "Brand · Products",
    icon: "package",
    keywords: "products catalogue collections product truth",
  },
  {
    to: "/brand/taste",
    label: "Brand · Taste",
    icon: "columns-2",
    keywords: "taste moodboard pairs references",
  },
  {
    to: "/brand/rules",
    label: "Brand · Rules",
    icon: "list",
    keywords: "rules claims never",
  },
  {
    to: "/brand/memory",
    label: "Brand · What Fume learned",
    icon: "bookmark",
    keywords: "memory lessons learned",
  },
  // The Brand DNA's parts: each lands on its part of the board (/brand#logo), which marks it
  { to: "/brand#logo", label: "Brand · Logo", icon: "image", keywords: "logo mark wordmark brand dna" },
  {
    to: "/brand#colour",
    label: "Brand · Colour",
    icon: "palette",
    keywords: "colour color colours palette swatch brand dna",
  },
  { to: "/brand#type", label: "Brand · Type", icon: "type", keywords: "type typeface font fonts typography brand dna" },
  { to: "/brand#voice", label: "Brand · Voice", icon: "message-square", keywords: "voice tone words copy brand dna" },
  {
    to: "/brand#imagery",
    label: "Brand · Imagery",
    icon: "image",
    keywords: "imagery photos pictures style brand dna",
  },
  {
    to: "/brand/understanding",
    label: "Brand · What Fume understood",
    icon: "file-text",
    keywords: "understanding summary brand dna read answers",
  },
  { to: "/brand/check", label: "Brand · Confirm your brand", icon: "check", keywords: "check confirm finds brand dna" },
];

/** A creative the customer can see in the viewer: never one still being made, checked or fixed (ARCHITECTURE §5.2). */
const unseen: ReadonlySet<VersionState> = new Set<VersionState>(["making", "in_check", "correcting", "held"]);

/**
 * What ⌘K offers from the brand in the session, part by part:
 * - start: New campaign with Fume, write it yourself, Ask Fume, Book a meeting (a customer; an agency in a client);
 * - brand: the places inside Brand and Campaigns, the products and the deliveries;
 * - campaigns: each campaign of the brand and its plan (a customer's; the staff frames list every brand's instead);
 * - creatives: every creative she can see, to the viewer;
 * - chat: where a campaign was talked about in the one Fume chat.
 * A client of an agency gets brand, campaigns and creatives; an example client and the all-scopes nothing of a brand.
 */
export interface PaletteParts {
  start?: boolean;
  brand?: boolean;
  campaigns?: boolean;
  creatives?: boolean;
  chat?: boolean;
}
export const paletteParts = {
  customer: { start: true, brand: true, campaigns: true, creatives: true, chat: true },
  client: { brand: true, campaigns: true, creatives: true },
  none: {},
} satisfies Record<string, PaletteParts>;

export interface PaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nav: NavItem[];
  onBookMeeting: () => void;
  parts?: PaletteParts;
  /** More rows (the staff frames': every brand and its places, what to check, the campaigns across brands). */
  extra?: CommandPaletteItem[];
  /** Where Settings goes ("/agency/settings" for the agency's people); none in Fume's studio. */
  settings?: string | null;
  /** Leave out "Book a meeting" (it is the customer's, with Fume). */
  meeting?: boolean;
  /** How the frame writes a customer's address ("/campaigns/c-autumn" under the client's prefix in a staff frame). */
  link?: (to: string) => string;
}

/** ⌘K: the places and what is inside them, every campaign, and the few things a person starts from anywhere. */
function Palette({
  open,
  onOpenChange,
  nav,
  onBookMeeting,
  parts = paletteParts.customer,
  extra,
  settings = "/settings",
  meeting = true,
  link,
}: PaletteProps) {
  const go = useNavigate();
  const navigate = useCallback((to: string) => go(link ? link(to) : to), [go, link]);
  const campaigns = useCampaigns();
  // Search finds products and deliveries too: a brand can have many products
  const catalogue = useCatalogue();
  const deliveries = useDeliveries();
  const threads = useThreads();
  // … and every creative she can see, loaded once the palette opens
  const campaignIds = useMemo(
    () => (open && parts.creatives ? (campaigns.data ?? []).map((c) => c.id) : []),
    [open, parts.creatives, campaigns.data],
  );
  const views = useCampaignViews(campaignIds);
  // … and each campaign's plan (FLOWS §22.3): "Winter gifting · Plan" opens the Plan tab. A campaign whose brief is not
  // sent has no plan yet: "Hand Balm introduction · Brief" opens the same tab, where she sends it.
  const planIds = useMemo(
    () => (open && parts.campaigns ? (campaigns.data ?? []).filter((c) => c.stage !== "brief").map((c) => c.id) : []),
    [open, parts.campaigns, campaigns.data],
  );
  const plans = usePlans(planIds);
  const planOf = useMemo(
    () => new Map((plans.data ?? []).filter((p): p is CampaignPlan => Boolean(p)).map((p) => [p.campaignId, p])),
    [plans.data],
  );
  const creatives = useMemo<CommandPaletteItem[]>(() => {
    const out: CommandPaletteItem[] = [];
    for (const v of views.data ?? []) {
      const subject = campaignSubject(v.campaign, catalogue.data?.products) ?? v.campaign.name;
      const labels = creativeLabels(v.creatives, v.directions);
      for (const c of v.creatives) {
        if (unseen.has(c.current.state)) continue;
        const f = copy.format[c.format];
        out.push({
          id: `cr-${c.id}`,
          group: "Creatives",
          label: customerName(subject, c.format, labels.get(c.id)),
          icon: "image",
          meta: v.campaign.name,
          keywords: `creative ${f.label} ${f.ratio} ${v.campaign.name} ${c.current.state.replace(/_/g, " ")}`,
          onSelect: () => navigate(`/review/${v.campaign.id}/c/${c.id}`),
        });
      }
    }
    return out;
  }, [views.data, catalogue.data, navigate]);
  const start = useMemo<CommandPaletteItem[]>(
    () => [
      {
        id: "new",
        group: "Start",
        label: "New campaign with Fume",
        icon: "plus",
        keywords: "start brief new chat talk",
        onSelect: () => navigate("/fume?new=1"),
      },
      {
        id: "brief",
        group: "Start",
        label: "New campaign, write it yourself",
        icon: "file-text",
        keywords: "start brief new campaign form order write",
        onSelect: () => navigate("/campaigns/new"),
      },
      {
        id: "ask",
        group: "Start",
        label: "Ask Fume",
        icon: "message-square",
        onSelect: () => navigate("/fume"),
      },
      ...(meeting
        ? [
            {
              id: "meet",
              group: "Start",
              label: "Book a meeting with Fume",
              icon: "calendar" as IconName,
              keywords: "call talk person people contact",
              onSelect: onBookMeeting,
            },
          ]
        : []),
    ],
    [navigate, onBookMeeting, meeting],
  );
  const items = useMemo<CommandPaletteItem[]>(
    () => [
      ...(parts.start ? start : []),
      ...nav
        .flatMap((n) => [n, ...(n.sub ?? [])])
        .map((n) => ({
          id: `go-${n.to}`,
          group: "Go to",
          label: n.label,
          icon: n.icon,
          keywords: n.keywords ?? keywords[n.to],
          onSelect: () => navigate(n.to),
        })),
      // The places inside the main ones, by the names people may still look for (not one the sidebar has itself)
      ...(parts.brand ? inside.filter((n) => !nav.some((x) => x.to === n.to)) : []).map((n) => ({
        id: `in-${n.to}`,
        group: "Go to",
        label: n.label,
        icon: n.icon,
        keywords: n.keywords,
        onSelect: () => navigate(n.to),
      })),
      ...(settings
        ? [
            {
              id: "go-settings",
              group: "Go to",
              label: "Settings",
              icon: "settings" as IconName,
              keywords: "account profile team package licence usage",
              onSelect: () => navigate(settings),
            },
          ]
        : []),
      ...(extra ?? []),
      ...(parts.campaigns ? (campaigns.data ?? []) : []).flatMap((c) => {
        const plan = planOf.get(c.id);
        const tab: CommandPaletteItem | undefined = plan
          ? {
              id: `plan-${c.id}`,
              group: "Campaigns",
              label: `${c.name} · Plan`,
              icon: "file-text",
              meta: copy.planState[plan.state],
              keywords: "plan brief direction variables creatives approve",
              onSelect: () => navigate(`/campaigns/${c.id}/plan`),
            }
          : c.stage === "brief"
            ? {
                id: `brief-${c.id}`,
                group: "Campaigns",
                label: `${c.name} · Brief`,
                icon: "file-text",
                meta: c.waits?.briefReady ? "To send" : undefined,
                keywords: "brief plan send",
                onSelect: () => navigate(`/campaigns/${c.id}/plan`),
              }
            : undefined;
        const row: CommandPaletteItem = {
          id: `c-${c.id}`,
          group: "Campaigns",
          label: c.name,
          icon: "megaphone",
          meta: copy.campaignStatus(c).words,
          onSelect: () => navigate(`/campaigns/${c.id}`),
        };
        return tab ? [row, tab] : [row];
      }),
      ...(parts.brand ? (catalogue.data?.products ?? []) : []).map((p) => ({
        id: `p-${p.id}`,
        group: "Products",
        label: `${p.name} ${p.variant}`.trim(),
        icon: "tag" as IconName,
        keywords: `product ${p.sku ?? ""}`,
        meta: p.state === "verified" ? "Confirmed" : copy.waitingOnYou,
        onSelect: () => navigate(`/brand/products/${p.id}`),
      })),
      ...(parts.brand ? (deliveries.data ?? []) : []).map((d) => ({
        id: `d-${d.id}`,
        group: "Deliveries",
        label: d.name,
        icon: "download" as IconName,
        keywords: "delivery download zip",
        meta: copy.creatives(d.creativeIds.length),
        onSelect: () => navigate(`/deliveries/${d.id}`),
      })),
      ...(parts.creatives ? creatives : []),
      // Where a campaign was talked about in the one Fume chat (FLOWS §23: one conversation, no list)
      ...(parts.chat ? (threads.data ?? []) : []).map((t) => ({
        id: `t-${t.id}`,
        group: "In the Fume chat",
        label: t.campaignId ? t.title : "Fume",
        icon: "message-square" as IconName,
        keywords: "chat conversation fume talk ask",
        meta: t.unread ? copy.count(t.unread, "new message") : undefined,
        onSelect: () => navigate(`/fume/${t.id}`),
      })),
    ],
    [
      parts,
      start,
      extra,
      settings,
      campaigns.data,
      planOf,
      catalogue.data,
      deliveries.data,
      threads.data,
      creatives,
      nav,
      navigate,
    ],
  );
  return (
    <CommandPalette
      items={items}
      open={open}
      onOpenChange={onOpenChange}
      placeholder="Search creatives, campaigns and actions"
    />
  );
}
