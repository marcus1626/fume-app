// The staff frame: where Fume's people and an agency's people work (FLOWS §4.2, §24.3). The Studio's desk itself
// (/studio/doc/:id) is full screen, outside this frame, like Photoshop (FLOWS §9).
// Round 12 (desktop review 20 Oct, DWAY-5, DWAY-1, DWAY-2, DWAY-3, DWAY-6, DWAY-8, DLAY-4, DWAY-15, DTASK-10,
// DWAY-21; PROPOSED 20 Oct 2026): ONE frame for Fume's studio and an agency (Marcus 20 Oct 12:41Z: "Agency dashboard
// blir strengt tatt lik som vår"). The same sidebar (StaffSidebar.tsx: the picker, one list of places per scope), the
// same bar (Frame.tsx: the way back by name, the title once the header has scrolled away, Search with ⌘K, the bell),
// the same ⌘K, the same folded sidebar remembered on this computer. Only the words of the scope differ (brands or
// clients) and the root of the address:
//   Fume's people   /studio/…   one brand  /studio/b/:workspaceId/…
//   an agency's     /agency/…   one client /agency/b/:workspaceId/…
// The address is the scope (scope.ts): the session follows the brand or client the address names (one hook for both
// frames, so two browser tabs can hold two clients and a link opens in its own client); a page that names an object (a
// campaign, its plan, its review) moves to that object's own brand when the address holds another; the customer's own
// addresses (/campaigns/c-autumn, a link inside a customer page) open under the brand's prefix; the other frame's
// addresses open the same place in this one (an agency's person on /studio/b/w-lysne/qa lands on
// /agency/b/w-lysne/check); "/" is the frame's root on the first landing (DWAY-2), the brand's Home after that.
// Fume's admin follows the brands and does not check: a brand is its Home and its Campaigns (a list to read), anything
// else in a brand goes to its Home, and Check goes to the overview.
import type { CommandPaletteItem, IconName, NotificationData } from "@fume/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useApi } from "../api/client";
import { useAgencyHome, useAllBrands, useBoard, useQaQueue, useSession, useStudioCampaigns } from "../api/hooks";
import type { AgencyNeed, Id } from "../contract";
import * as copy from "../copy";
import { dayGroup, when } from "../lib/time";
import { agencyBell, AgencyPersonMenu } from "./AgencySidebar";
import { SummaryClientNotice } from "./agencyNotice";
import { ShellFrame, paletteParts, type PaletteParts } from "./Frame";
import { useNotificationItems } from "./notifications";
import { Loading } from "./Page";
import {
  addressBrand,
  brandBase,
  campaignHref,
  checkPath,
  customerViewOn,
  docHref,
  frameRoot,
  hrefIn,
  inBrand,
  isCustomerPath,
  ownAddress,
  setCustomerView,
  under,
  type StaffFrameKind,
} from "./scope";
import {
  FumePersonMenu,
  ScopePicker,
  StaffSidebar,
  useStaffPlaces,
  useStaffScope,
  type StaffScope,
} from "./StaffSidebar";

/** The staff frame for the person signed in: the agency's for an agency's people, the studio's for Fume's. */
export function StudioShell() {
  const session = useSession().data!;
  return <StaffFrame frame={session.user.agency ? "agency" : "fume"} />;
}

/** Pages a person opens as themselves, whatever the scope: an example client's notice never covers them. */
const ownPages = ["/notifications", "/settings/profile"];

/** The campaign an address names: "/campaigns/c-autumn/plan", "/review/c-autumn" → "c-autumn". */
const campaignIn = (path: string) => {
  const id = /^\/(?:campaigns|review)\/([^/?#]+)/.exec(path)?.[1];
  return id && id !== "new" ? id : undefined;
};

function StaffFrame({ frame }: { frame: StaffFrameKind }) {
  const session = useSession().data!;
  const location = useLocation();
  const navigate = useNavigate();
  const { pathname } = location;
  const tail = location.search + location.hash;
  const scope = useStaffScope(frame);
  const brand = addressBrand(pathname);
  const places = useStaffPlaces(scope, useCampaignBoard(brand?.rest));
  const campaigns = useStudioCampaigns();
  const needs = useStaffNeeds(frame);
  const extra = useStaffPaletteItems(scope, needs);
  const bell = useStaffBell(frame, needs);

  // Every status sentence under this frame reads the frame's way: an agency's "6 creatives with Maja", Fume's the staff's
  if (frame === "agency")
    copy.setStatusReader({ agency: true, client: scope.entry?.client?.people[0]?.name.split(" ")[0] });
  else copy.setStatusReader({ agency: false, viewer: "staff" });
  // Back in the studio, Customer view is over (it lasts until then, DWAY-2)
  if (frame === "fume" && customerViewOn()) setCustomerView(false);

  // Where this address belongs, if not here. "wait" while the brands or campaigns that decide it are still coming.
  const target = ((): string | "wait" | undefined => {
    const other = ownAddress(frame, pathname, tail);
    if (other) return other;
    const workspaceOf = (id: Id | undefined) =>
      id ? campaigns.data?.find((r) => r.campaign.id === id)?.workspace.id : undefined;
    if (pathname === "/") return location.key === "default" ? frameRoot[frame] : brandBase(frame, session.workspace.id);
    if (isCustomerPath(pathname)) {
      const id = campaignIn(pathname);
      if (id && !campaigns.data && !campaigns.isError) return "wait";
      return inBrand(frame, workspaceOf(id) ?? session.workspace.id, pathname + tail);
    }
    if (brand) {
      if (!scope.entry) return scope.loaded ? frameRoot[frame] : "wait";
      // A campaign of another brand under this brand's prefix: the campaign's own (an old link, a hand-typed address)
      const own = workspaceOf(campaignIn(brand.rest));
      if (own && own !== brand.workspaceId) return `${brandBase(frame, own)}${brand.rest}${tail}`;
      if (scope.limited && brand.rest !== "" && brand.rest !== "/campaigns") return brandBase(frame, brand.workspaceId);
    } else if (scope.limited && /^\/studio\/(qa|queue)(\/|$)/.test(pathname)) return frameRoot[frame];
    return undefined;
  })();
  useEffect(() => {
    if (target && target !== "wait") navigate(target, { replace: true });
  }, [target, navigate]);

  // The session follows the brand or client of the address
  const behind = useSessionOn(target ? undefined : scope.entry?.workspace.id);

  const name = scope.entry?.workspace.brandName;
  const notice = scope.entry?.summary && !ownPages.some((p) => under(pathname, p));
  const content = target ? (
    <Loading label="Opening Fume" />
  ) : behind ? (
    <Loading label={`Opening ${name ?? "the brand"}`} />
  ) : notice && scope.entry ? (
    <SummaryClientNotice key={scope.entry.workspace.id} workspace={scope.entry.workspace} client={scope.entry.client} />
  ) : undefined;

  // ⌘K: the scope's places; in a brand its own pages (an agency's full client: also what she starts, every creative and
  // the chat); every brand and its places, what waits for a check and the campaigns across brands (DTASK-10, DWAY-6)
  const parts: PaletteParts =
    !scope.entry || scope.entry.summary
      ? paletteParts.none
      : frame === "agency"
        ? { start: true, brand: true, creatives: true, chat: true }
        : { brand: true };
  const brandId = scope.entry?.workspace.id;
  const link = useMemo(() => (brandId ? (to: string) => hrefIn(frame, brandId, to) : undefined), [frame, brandId]);
  const label = name
    ? `${name}, ${frame === "agency" ? scope.orgName : "the Fume studio"}`
    : frame === "agency"
      ? `${scope.orgName} in Fume`
      : "Fume studio";

  return (
    <ShellFrame
      label={label}
      tabs={places.slice(0, 4)}
      drawer
      scopeName={name}
      bell={bell}
      barStart={({ phone, away }) => (phone && !away ? <ScopePicker scope={scope} compact /> : null)}
      account={() => (frame === "agency" ? <AgencyPersonMenu avatar /> : <FumePersonMenu avatar />)}
      content={content}
      palette={{
        nav: places,
        parts,
        extra,
        settings: frame === "agency" ? "/agency/settings" : null,
        meeting: frame === "agency",
        link,
      }}
      sidebar={(f) => <StaffSidebar scope={scope} places={places} frame={f} />}
    />
  );
}

/** A board belongs to Brand, or to its campaign (WAY-13). */
function useCampaignBoard(rest: string | undefined) {
  const boardId = /^\/boards\/([^/]+)/.exec(rest ?? "")?.[1];
  const board = useBoard(boardId);
  return Boolean(boardId && board.data?.campaignId);
}

/**
 * Keeps the session on the brand or client the address names (a link, the picker, the back button, a second browser
 * tab). True while it is still on another one: the frame shows the brand opening instead of the old one's page.
 */
function useSessionOn(workspaceId: Id | undefined): boolean {
  const session = useSession().data!;
  const api = useApi();
  const client = useQueryClient();
  const behind = Boolean(workspaceId && session.workspace.id !== workspaceId);
  const asked = useRef<Id | undefined>(undefined);
  useEffect(() => {
    if (!behind || !workspaceId) {
      asked.current = undefined;
      return;
    }
    if (asked.current === workspaceId) return;
    asked.current = workspaceId;
    void (async () => {
      const next = await api.switchWorkspace(workspaceId);
      client.setQueryData(["session"], next);
      await client.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "session" });
    })();
  }, [api, client, behind, workspaceId]);
  return behind;
}

// ─── What waits on you, for the bell and ⌘K ─────────────────────────────────

/** What waits on this person across the brands or clients: plans to check, creatives to check, briefs to send. */
function useStaffNeeds(frame: StaffFrameKind): AgencyNeed[] {
  const all = useAllBrands();
  const home = useAgencyHome(frame === "agency");
  return (frame === "agency" ? home.data?.needsYou : all.data?.needsYou) ?? [];
}

/** The bell (DWAY-8): the person's notifications, and what waits on them (shown as read: Check and the overview count
 *  it already, so the number stays the notifications'). */
function useStaffBell(frame: StaffFrameKind, needs: AgencyNeed[]): { items: NotificationData[]; unread: number } {
  const own = useNotificationItems();
  return useMemo(() => {
    const waiting: NotificationData[] = needs.map((n) => ({
      id: `need-${n.id}`,
      kind: "waiting_on_you",
      unread: false,
      group: dayGroup(n.at),
      time: when(n.at),
      dateTime: n.at,
      text: (
        <>
          {/* a check batch without a campaign reads "LYSNE ·" in the seed: the brand alone */}
          {/* one colon a sentence: the detail's own becomes a comma ("the brief waits on you, who it is for") */}
          <b>{n.title.replace(/\s*·\s*$/, "")}</b>: {n.detail.charAt(0).toLowerCase()}
          {n.detail.slice(1).replace(": ", ", ")}
        </>
      ),
      href: hrefIn(frame, n.clientId, n.href),
      actor: { kind: "fume" },
    }));
    const items = [...waiting, ...own.items].sort((a, b) => (b.dateTime ?? "").localeCompare(a.dateTime ?? ""));
    // Round 13 AGENCY (robot note 10-agency): the agency's bell reads every client's Needs you, so its number is the
    // same under All clients and inside a client (AgencySidebar.tsx, agencyBell)
    if (frame === "agency") return agencyBell(items, own.query.data, needs);
    return { items, unread: own.unread };
  }, [needs, own.items, own.unread, own.query.data, frame]);
}

/** A brand's places in ⌘K, by their names ("LYSNE · Engine output"). */
const brandPlaces = (frame: StaffFrameKind): { rest: string; label: string; icon: IconName; keywords: string }[] => [
  {
    rest: `/${frame === "agency" ? "check" : "qa"}`,
    label: "Check",
    icon: "inbox",
    keywords: "check qa queue to check",
  },
  { rest: "/campaigns", label: "Campaigns", icon: "megaphone", keywords: "campaigns plans" },
  { rest: "/brand", label: "Brand", icon: "palette", keywords: "brand dna products" },
  { rest: "/studio", label: "Studio", icon: "layers", keywords: "studio desk documents" },
  { rest: "/engine", label: "Engine", icon: "fume-engine", keywords: "engine chat make" },
  { rest: "/output", label: "Engine output", icon: "image", keywords: "engine output runs made" },
  { rest: "/assets", label: "Models and references", icon: "users", keywords: "models references cast assets" },
  { rest: "/boards", label: "Boards", icon: "layout-grid", keywords: "boards moodboard" },
  ...(frame === "agency"
    ? [{ rest: "/fume", label: "Fume", icon: "message-square" as IconName, keywords: "chat ask fume" }]
    : []),
];

/** ⌘K across the scope (DTASK-10, DWAY-6): every brand or client and its places, the plans and creatives to check, and
 *  the campaigns across brands, each opening where it is worked on. */
function useStaffPaletteItems(scope: StaffScope, needs: AgencyNeed[]): CommandPaletteItem[] {
  const navigate = useNavigate();
  const qa = useQaQueue();
  const campaigns = useStudioCampaigns();
  const { frame, entries, limited, noun } = scope;
  const here = scope.entry?.workspace.id;
  return useMemo<CommandPaletteItem[]>(() => {
    const group = noun === "brand" ? "Brands" : "Clients";
    const items: CommandPaletteItem[] = [
      {
        id: "scope-all",
        group,
        label: `All ${noun}s`,
        icon: "layout-grid",
        keywords: `overview every ${noun} home today`,
        onSelect: () => navigate(frameRoot[frame]),
      },
      ...entries.map((e) => ({
        id: `scope-${e.workspace.id}`,
        group,
        label: `Go to ${e.workspace.brandName}`,
        icon: "folder" as IconName,
        meta: e.client?.status ?? (e.waiting ? `${e.waiting} waiting on you` : e.workspace.market),
        keywords: `${noun} brand switch open home ${e.workspace.brandName} ${e.workspace.market}`,
        onSelect: () => navigate(brandBase(frame, e.workspace.id)),
      })),
    ];
    // Each brand's places, by name (the brand you are in has them as its own places above); the admin's is Campaigns
    for (const e of entries) {
      if (e.summary || e.workspace.id === here) continue;
      for (const p of brandPlaces(frame).filter((x) => !limited || x.rest === "/campaigns"))
        items.push({
          id: `place-${e.workspace.id}${p.rest}`,
          group: "Go to",
          label: `${e.workspace.brandName} · ${p.label}`,
          icon: p.icon,
          keywords: `${p.keywords} ${e.workspace.brandName}`,
          onSelect: () => navigate(`${brandBase(frame, e.workspace.id)}${p.rest}`),
        });
    }
    if (limited) return items;
    // The plans that wait on you: Fume's expert checks them, an agency opens them for its client
    for (const n of needs.filter((x) => x.kind === "plan")) {
      const [brandName, campaignName] = n.title.split(" · ");
      items.push({
        id: `need-${n.id}`,
        group: "To check",
        label:
          frame === "fume" ? `Check the ${campaignName ?? n.title} plan` : `Open the ${campaignName ?? n.title} plan`,
        icon: "file-text",
        meta: brandName,
        keywords: "plan check approve brief",
        onSelect: () => navigate(hrefIn(frame, n.clientId, n.href)),
      });
    }
    // The creatives in Check, by their one name, and the way into the Studio with one
    for (const v of (qa.data ?? []).filter((x) => x.item.state === "waiting")) {
      const label = copy.creativeName({ title: v.item.title, format: v.item.format, productName: v.productName });
      items.push({
        id: `qa-${v.item.id}`,
        group: "To check",
        label,
        icon: "inbox",
        meta: `${v.workspace.brandName} · ${v.campaign.name}`,
        keywords: `check creative qa ${v.campaign.name} ${v.workspace.brandName}`,
        onSelect: () => navigate(`${checkPath(frame, v.workspace.id)}?item=${v.item.id}`),
      });
      if (v.item.documentId)
        items.push({
          id: `qa-doc-${v.item.id}`,
          group: "To check",
          label: `Open ${label} in Studio`,
          icon: "layers",
          meta: v.workspace.brandName,
          keywords: `studio edit fix desk ${v.campaign.name}`,
          onSelect: () => navigate(docHref(frame, v.item.documentId!)),
        });
    }
    // The campaigns across brands, in the frame's words, each to the campaign (DWAY-14)
    for (const r of campaigns.data ?? [])
      items.push({
        id: `campaign-${r.campaign.id}`,
        group: "Campaigns",
        label: `${r.campaign.name} · ${r.workspace.brandName}`,
        icon: "megaphone",
        meta: copy.campaignStatus(r.campaign, undefined, { viewer: frame === "agency" ? "agency" : "staff" }).words,
        keywords: `campaign plan ${r.workspace.brandName}`,
        onSelect: () => navigate(campaignHref(frame, r.workspace.id, r.campaign.id)),
      });
    return items;
  }, [noun, entries, frame, limited, here, needs, qa.data, campaigns.data, navigate]);
}
