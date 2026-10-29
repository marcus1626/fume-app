// The route table (ARCHITECTURE §7); every route is a screen in src/features/<domain>/. One layout (WorkspaceShell)
// holds every page in a frame and picks the frame: the customer's, or the one staff frame of Fume's studio and an
// agency (StudioShell); the first run has none. The staff frames share one shape of address: all brands /studio/…, all
// clients /agency/…; one brand /studio/b/:workspaceId/…, one client /agency/b/:workspaceId/… (brandPages). Under a
// brand's prefix live the staff pages and the customer's own pages as the frame shows them, so every place names its
// brand in the address (FLOWS §25.1).
import { IconSprite, ToastProvider, TooltipProvider } from "@fume/ui";
import { createBrowserRouter, createMemoryRouter, Navigate, RouterProvider, useParams } from "react-router-dom";
import type { ComponentType } from "react";
import { ApiProvider, demoStartPath } from "./api/client";
import { NotFound } from "./shell/NotFound";
import { ProductRedirect, Redirect } from "./shell/Redirect";
import { Root } from "./shell/Root";
import { WorkspaceShell } from "./shell/WorkspaceShell";

/**
 * Each page is its own file that loads when it is first opened, so the first visit downloads the frame and one page,
 * not the whole app. Once the first page is up, the rest load quietly in the background (warmPages), so moving
 * between pages does not wait for the network.
 */
type Loader = () => Promise<Record<string, unknown>>;
const loaders = new Set<Loader>();
function page(load: Loader, name: string) {
  loaders.add(load);
  return () => load().then((m) => ({ Component: m[name] as ComponentType }));
}
let warmed = false;
function warmPages() {
  if (warmed) return;
  warmed = true;
  const idle = (fn: () => void) =>
    "requestIdleCallback" in window ? window.requestIdleCallback(fn, { timeout: 4000 }) : setTimeout(fn, 1500);
  idle(() => {
    for (const load of loaders) void load().catch(() => undefined);
  });
}

/** The agency's pages and the client link load when first opened. */
const agencyPage = (name: string) => page(() => import("./features/agency/index"), name);

const brandCheckPage = page(() => import("./features/check/BrandCheckPage"), "BrandCheckPage");
const productCheckPage = page(() => import("./features/check/ProductCheckPage"), "ProductCheckPage");

/** For Fume's people a campaign is its plan, the studio's page of a campaign; its other tabs are the customer's, seen
 *  through Customer view. */
function ToStaffPlan() {
  const { workspaceId, campaignId } = useParams<"workspaceId" | "campaignId">();
  return <Navigate to={`/studio/b/${workspaceId}/campaigns/${campaignId}/plan`} replace />;
}

/**
 * One brand's (Fume) or one client's (an agency) pages, under its prefix: Home, Check, Campaigns and each campaign,
 * Brand (with the products, the models and references and the boards), Studio, Engine and what it made, and the
 * customer's own pages (Fume, review, deliveries) as the frame shows them.
 */
function brandPages(frame: "studio" | "agency") {
  const b = `${frame}/b/:workspaceId`;
  const campaigns =
    frame === "studio"
      ? [
          // ?show=calendar is the brand's calendar, as ⌘K's "Campaigns · Calendar" says
          {
            path: `${b}/campaigns`,
            lazy: page(() => import("./features/calendar/StudioCalendarSwitch"), "StudioCampaignsOrCalendar"),
          },
          // The plan for the expert, who checks it before the customer sees it (FLOWS §22)
          {
            path: `${b}/campaigns/:campaignId/plan`,
            lazy: page(() => import("./features/plan/StaffPlanPage"), "StaffPlanPage"),
          },
          { path: `${b}/campaigns/:campaignId/*`, element: <ToStaffPlan /> },
        ]
      : [
          { path: `${b}/campaigns`, lazy: page(() => import("./features/campaigns/CampaignsPage"), "CampaignsPage") },
          { path: `${b}/campaigns/new`, lazy: page(() => import("./features/campaigns/NewBriefPage"), "NewBriefPage") },
          {
            path: `${b}/campaigns/:campaignId/review`,
            lazy: page(() => import("./features/review/ReviewCampaign"), "ReviewCampaign"),
          },
          {
            path: `${b}/campaigns/:campaignId/:tab?`,
            lazy: page(() => import("./features/campaigns/CampaignPage"), "CampaignPage"),
          },
        ];
  return [
    { path: b, lazy: page(() => import("./features/studio/BrandHomePage"), "BrandHomePage") },
    {
      path: `${b}/${frame === "studio" ? "qa" : "check"}`,
      lazy: page(() => import("./features/studio/qa/QaPage"), "QaPage"),
    },
    { path: `${b}/queue`, lazy: page(() => import("./features/studio/QueuePage"), "QueuePage") },
    ...campaigns,
    { path: `${b}/studio`, lazy: page(() => import("./features/studio/doc/StudioHomePage"), "StudioHomePage") },
    { path: `${b}/studio/session/:sessionId`, lazy: page(() => import("./features/studio/StudioPage"), "StudioPage") },
    { path: `${b}/engine`, lazy: page(() => import("./features/engine/EngineChatPage"), "EngineChatPage") },
    { path: `${b}/output`, lazy: page(() => import("./features/studio/EngineOutputPage"), "EngineOutputPage") },
    { path: `${b}/assets`, lazy: page(() => import("./features/studio/AssetsPage"), "AssetsPage") },
    { path: `${b}/boards`, lazy: page(() => import("./features/studio/BoardsListPage"), "BoardsListPage") },
    { path: `${b}/boards/:boardId`, lazy: page(() => import("./features/boards/BoardPage"), "BoardPage") },
    {
      path: `${b}/brand/understanding`,
      lazy: page(() => import("./features/brand/UnderstandingPage"), "UnderstandingPage"),
    },
    { path: `${b}/brand/products/:productId`, lazy: page(() => import("./features/brand/ProductPage"), "ProductPage") },
    // An AI model's own page: its sheet and specs
    { path: `${b}/brand/models/:modelId`, lazy: page(() => import("./features/brand/models"), "ModelPage") },
    { path: `${b}/brand/check`, lazy: brandCheckPage },
    { path: `${b}/check/products`, lazy: productCheckPage },
    { path: `${b}/brand/:tab?`, lazy: page(() => import("./features/brand/BrandBoardPage"), "BrandBoardPage") },
    { path: `${b}/fume/:threadId?`, lazy: page(() => import("./features/fume/FumePage"), "FumePage") },
    { path: `${b}/review`, lazy: page(() => import("./features/review/ReviewPage"), "ReviewPage") },
    { path: `${b}/review/:campaignId`, lazy: page(() => import("./features/review/ReviewCampaign"), "ReviewCampaign") },
    { path: `${b}/deliveries`, lazy: page(() => import("./features/deliveries/DeliveriesPage"), "DeliveriesPage") },
    {
      path: `${b}/deliveries/:deliveryId`,
      lazy: page(() => import("./features/deliveries/DeliveryPage"), "DeliveryPage"),
    },
    {
      path: `${b}/products/collections/:collectionId`,
      lazy: page(() => import("./features/products/CollectionPage"), "CollectionPage"),
    },
    // The older addresses send you on, under the brand (the frame writes the customer's address under its prefix)
    { path: `${b}/calendar`, element: <Redirect to="/campaigns" add={{ show: "calendar" }} /> },
    { path: `${b}/products`, element: <Redirect to="/brand/products" /> },
    { path: `${b}/products/:productId`, element: <ProductRedirect /> },
    { path: `${b}/contact`, element: <Redirect to="/fume" /> },
  ];
}

const routes = [
  {
    element: <Root />,
    errorElement: <NotFound />,
    children: [
      // The first sign-in: name and title, before anything else (features/auth/AboutYouPage.tsx)
      { path: "hello", lazy: page(() => import("./features/auth/AboutYouPage"), "AboutYouPage") },
      // An email's sign-in link, once it has signed in (features/auth/SignInPage.tsx), goes on to Fume
      { path: "auth/confirm", element: <Navigate to="/" replace /> },
      { path: "welcome/:step?", lazy: page(() => import("./features/onboarding/Welcome"), "Welcome") },
      { path: "studio/check/:checkId", lazy: page(() => import("./features/studio/CheckPage"), "CheckPage") },
      // The Studio itself is full screen, like Photoshop (FLOWS §9)
      { path: "studio/doc/:documentId", lazy: page(() => import("./features/agency/DocAddress"), "DocAddress") },
      // The agency's people open the Studio at their own address (features/agency/DocAddress.tsx)
      { path: "agency/doc/:documentId", lazy: page(() => import("./features/agency/DocAddress"), "DocAddress") },
      // Review's full-screen viewer and swipe mode (FLOWS §11)
      {
        path: "review/:campaignId/c/:creativeId",
        lazy: page(() => import("./features/review/ViewerPage"), "ViewerPage"),
      },
      { path: "review/:campaignId/swipe", lazy: page(() => import("./features/review/SwipePage"), "SwipePage") },
      // The client link opens only what was sent, for a client without an account (FLOWS §24.5, §26.8)
      { path: "c/:token", lazy: agencyPage("ClientLinkPage") },
      {
        element: <WorkspaceShell />,
        children: [
          // Fume's studio across every brand (FLOWS §4.2): the overview, Check, Campaigns, Deliveries, Team, Usage and
          // the quality log
          { path: "studio", lazy: page(() => import("./features/studio/AllBrandsPage"), "AllBrandsPage") },
          { path: "studio/qa", lazy: page(() => import("./features/studio/qa/QaPage"), "QaPage") },
          { path: "studio/queue", element: <Navigate to="/studio/qa" replace /> },
          {
            path: "studio/campaigns",
            lazy: page(() => import("./features/studio/StudioCampaignsPage"), "StudioCampaignsPage"),
          },
          {
            path: "studio/deliveries",
            lazy: page(() => import("./features/studio/StudioDeliveriesPage"), "StudioDeliveriesPage"),
          },
          { path: "studio/quality", lazy: page(() => import("./features/studio/QualityLogPage"), "QualityLogPage") },
          { path: "studio/team", lazy: page(() => import("./features/studio/TeamLoadPage"), "TeamLoadPage") },
          { path: "studio/usage", lazy: page(() => import("./features/studio/UsagePage"), "UsagePage") },
          // A Fume person's own profile, in the studio
          { path: "studio/settings", element: <Navigate to="/studio/settings/profile" replace /> },
          {
            path: "studio/settings/profile",
            lazy: page(() => import("./features/settings/ProfilePage"), "StaffProfilePage"),
          },
          ...brandPages("studio"),
          // The agency's places across its clients (FLOWS §24.3), the same as the studio's (Usage is the one Usage
          // page), and one client's places under /agency/b/:workspaceId
          { path: "agency", lazy: agencyPage("AgencyHomePage") },
          { path: "agency/check", lazy: agencyPage("AgencyCheckPage") },
          { path: "agency/campaigns", lazy: agencyPage("AgencyCampaignsPage") },
          {
            path: "agency/deliveries",
            lazy: page(() => import("./features/studio/StudioDeliveriesPage"), "StudioDeliveriesPage"),
          },
          { path: "agency/clients", lazy: agencyPage("AgencyClientsPage") },
          { path: "agency/team", lazy: agencyPage("AgencyTeamPage") },
          { path: "agency/usage", lazy: page(() => import("./features/studio/UsagePage"), "UsagePage") },
          { path: "agency/quality", lazy: page(() => import("./features/studio/QualityLogPage"), "QualityLogPage") },
          { path: "agency/settings/:page?", lazy: agencyPage("AgencySettingsPage") },
          ...brandPages("agency"),
          // The customer's places: Home (the one inbox), Fume, Campaigns, Brand; Review and Deliveries further down.
          { index: true, lazy: page(() => import("./features/home/HomePage"), "HomePage") },
          { path: "fume/:threadId?", lazy: page(() => import("./features/fume/FumePage"), "FumePage") },
          // Campaigns: a list or the calendar (?show=calendar); each campaign holds its brief, creatives and delivery
          { path: "campaigns", lazy: page(() => import("./features/campaigns/CampaignsPage"), "CampaignsPage") },
          { path: "campaigns/new", lazy: page(() => import("./features/campaigns/NewBriefPage"), "NewBriefPage") },
          // A campaign's review is a state of the campaign; /review/:id sends you here
          {
            path: "campaigns/:campaignId/review",
            lazy: page(() => import("./features/review/ReviewCampaign"), "ReviewCampaign"),
          },
          {
            path: "campaigns/:campaignId/:tab?",
            lazy: page(() => import("./features/campaigns/CampaignPage"), "CampaignPage"),
          },
          // Brand: one page, three tabs (Board, Products, Taste); the board's parts, Rules and Memory have their own address
          {
            path: "brand/understanding",
            lazy: page(() => import("./features/brand/UnderstandingPage"), "UnderstandingPage"),
          },
          {
            path: "brand/products/:productId",
            lazy: page(() => import("./features/brand/ProductPage"), "ProductPage"),
          },
          // An AI model's own page: its sheet and specs
          { path: "brand/models/:modelId", lazy: page(() => import("./features/brand/models"), "ModelPage") },
          // The Engine's open proposals one at a time, inside Brand
          { path: "brand/check", lazy: brandCheckPage },
          // The product queue is inside the shell too, in the same frame as Brand's
          { path: "check/products", lazy: productCheckPage },
          { path: "brand/:tab?", lazy: page(() => import("./features/brand/BrandBoardPage"), "BrandBoardPage") },
          // Review and Deliveries, and older addresses that send you on; their deep links keep working.
          { path: "review", lazy: page(() => import("./features/review/ReviewPage"), "ReviewPage") },
          {
            path: "review/:campaignId",
            lazy: page(() => import("./features/review/ReviewCampaign"), "ReviewCampaign"),
          },
          { path: "deliveries", lazy: page(() => import("./features/deliveries/DeliveriesPage"), "DeliveriesPage") },
          {
            path: "deliveries/:deliveryId",
            lazy: page(() => import("./features/deliveries/DeliveryPage"), "DeliveryPage"),
          },
          {
            path: "calendar",
            element: <Redirect to="/campaigns" add={{ show: "calendar" }} />,
          },
          { path: "products", element: <Redirect to="/brand/products" /> },
          {
            path: "products/collections/:collectionId",
            lazy: page(() => import("./features/products/CollectionPage"), "CollectionPage"),
          },
          // One address per product: the old one sends you on.
          { path: "products/:productId", element: <ProductRedirect /> },
          // Fume answers and hands over to people in the one conversation (FLOWS §21)
          { path: "contact", element: <Navigate to="/fume" replace /> },
          { path: "boards/:boardId", lazy: page(() => import("./features/boards/BoardPage"), "BoardPage") },
          {
            path: "notifications",
            lazy: page(() => import("./features/notifications/NotificationsPage"), "NotificationsPage"),
          },
          {
            // /settings is the list on a phone (the workspace page on a desk); each page has its own address
            path: "settings",
            lazy: page(() => import("./features/settings/SettingsPage"), "SettingsPage"),
          },
          { path: "settings/:page", lazy: page(() => import("./features/settings/SettingsPage"), "SettingsPage") },
          { path: "*", element: <NotFound /> },
        ],
      },
    ],
  },
];

// The preview build (VITE_ROUTER=memory) runs where the address bar cannot be used, so it keeps the route in memory
// (and starts where a demo reload asked: the agency's Home in the agency demo).
const router =
  import.meta.env.VITE_ROUTER === "memory"
    ? createMemoryRouter(routes, { initialEntries: [demoStartPath()] })
    : createBrowserRouter(routes);
const stop = router.subscribe((state) => {
  if (state.navigation.state === "idle" && state.initialized) {
    stop();
    warmPages();
  }
});

export function App() {
  return (
    <ApiProvider>
      <TooltipProvider>
        <ToastProvider>
          <IconSprite />
          <RouterProvider router={router} />
        </ToastProvider>
      </TooltipProvider>
    </ApiProvider>
  );
}
