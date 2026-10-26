// The route table (ARCHITECTURE §7); every route is a screen in src/features/<domain>/. One layout (WorkspaceShell)
// holds every page in a frame and picks the frame: the customer's, or the one staff frame of Fume's studio and an
// agency (StudioShell); the first run has none. The staff frames share one shape of address: all brands /studio/…, all
// clients /agency/…; one brand /studio/b/:workspaceId/…, one client /agency/b/:workspaceId/… (brandPages). Under a
// brand's prefix live the staff pages and the customer's own pages as the frame shows them, so every place names its
// brand in the address (FLOWS §25.1).
import { IconSprite, ToastProvider, TooltipProvider } from "@fume/ui";
import { createBrowserRouter, createMemoryRouter, Navigate, RouterProvider, useParams } from "react-router-dom";
import { ApiProvider, demoStartPath } from "./api/client";
import { AboutYouPage } from "./features/auth/AboutYouPage";
import { BoardPage } from "./features/boards/BoardPage";
import { BrandBoardPage } from "./features/brand/BrandBoardPage";
import { ModelPage } from "./features/brand/models";
import { StaffProfilePage } from "./features/settings/ProfilePage";
import { ProductPage } from "./features/brand/ProductPage";
import { UnderstandingPage } from "./features/brand/UnderstandingPage";
import { CampaignPage } from "./features/campaigns/CampaignPage";
import { CampaignsPage } from "./features/campaigns/CampaignsPage";
import { DeliveriesPage } from "./features/deliveries/DeliveriesPage";
import { DeliveryPage } from "./features/deliveries/DeliveryPage";
import { FumePage } from "./features/fume/FumePage";
import { HomePage } from "./features/home/HomePage";
import { NotificationsPage } from "./features/notifications/NotificationsPage";
import { Welcome } from "./features/onboarding/Welcome";
import { CollectionPage } from "./features/products/CollectionPage";
import { ReviewCampaign } from "./features/review/ReviewCampaign";
import { ReviewPage } from "./features/review/ReviewPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { AllBrandsPage } from "./features/studio/AllBrandsPage";
import { BoardsListPage } from "./features/studio/BoardsListPage";
import { BrandHomePage } from "./features/studio/BrandHomePage";
import { CheckPage } from "./features/studio/CheckPage";
import { EngineOutputPage } from "./features/studio/EngineOutputPage";
import { StudioDeliveriesPage } from "./features/studio/StudioDeliveriesPage";
import { StudioPage } from "./features/studio/StudioPage";
import { QualityLogPage } from "./features/studio/QualityLogPage";
import { QueuePage } from "./features/studio/QueuePage";
import { StudioCampaignsPage } from "./features/studio/StudioCampaignsPage";
import { TeamLoadPage } from "./features/studio/TeamLoadPage";
import { AssetsPage } from "./features/studio/AssetsPage";
import { DocAddress } from "./features/agency/DocAddress";
import { StudioHomePage } from "./features/studio/doc/StudioHomePage";
import { QaPage } from "./features/studio/qa/QaPage";
import { SwipePage } from "./features/review/SwipePage";
import { ViewerPage } from "./features/review/ViewerPage";
import { NewBriefPage } from "./features/campaigns/NewBriefPage";
import { StaffPlanPage } from "./features/plan/StaffPlanPage";
import { StudioCampaignsOrCalendar } from "./features/calendar/StudioCalendarSwitch";
import { EngineChatPage } from "./features/engine/EngineChatPage";
import { UsagePage } from "./features/studio/UsagePage";
import { NotFound } from "./shell/NotFound";
import { ProductRedirect, Redirect } from "./shell/Redirect";
import { Root } from "./shell/Root";
import { WorkspaceShell } from "./shell/WorkspaceShell";

/** The agency's pages and the client link load when first opened. */
const agencyPage = (name: string) => () =>
  import("./features/agency/index").then((m) => ({ Component: m[name as keyof typeof m] }));

const brandCheckPage = () => import("./features/check/BrandCheckPage").then((m) => ({ Component: m.BrandCheckPage }));
const productCheckPage = () =>
  import("./features/check/ProductCheckPage").then((m) => ({ Component: m.ProductCheckPage }));

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
          { path: `${b}/campaigns`, element: <StudioCampaignsOrCalendar /> },
          // The plan for the expert, who checks it before the customer sees it (FLOWS §22)
          { path: `${b}/campaigns/:campaignId/plan`, element: <StaffPlanPage /> },
          { path: `${b}/campaigns/:campaignId/*`, element: <ToStaffPlan /> },
        ]
      : [
          { path: `${b}/campaigns`, element: <CampaignsPage /> },
          { path: `${b}/campaigns/new`, element: <NewBriefPage /> },
          { path: `${b}/campaigns/:campaignId/review`, element: <ReviewCampaign /> },
          { path: `${b}/campaigns/:campaignId/:tab?`, element: <CampaignPage /> },
        ];
  return [
    { path: b, element: <BrandHomePage /> },
    { path: `${b}/${frame === "studio" ? "qa" : "check"}`, element: <QaPage /> },
    { path: `${b}/queue`, element: <QueuePage /> },
    ...campaigns,
    { path: `${b}/studio`, element: <StudioHomePage /> },
    { path: `${b}/studio/session/:sessionId`, element: <StudioPage /> },
    { path: `${b}/engine`, element: <EngineChatPage /> },
    { path: `${b}/output`, element: <EngineOutputPage /> },
    { path: `${b}/assets`, element: <AssetsPage /> },
    { path: `${b}/boards`, element: <BoardsListPage /> },
    { path: `${b}/boards/:boardId`, element: <BoardPage /> },
    { path: `${b}/brand/understanding`, element: <UnderstandingPage /> },
    { path: `${b}/brand/products/:productId`, element: <ProductPage /> },
    // An AI model's own page: its sheet and specs
    { path: `${b}/brand/models/:modelId`, element: <ModelPage /> },
    { path: `${b}/brand/check`, lazy: brandCheckPage },
    { path: `${b}/check/products`, lazy: productCheckPage },
    { path: `${b}/brand/:tab?`, element: <BrandBoardPage /> },
    { path: `${b}/fume/:threadId?`, element: <FumePage /> },
    { path: `${b}/review`, element: <ReviewPage /> },
    { path: `${b}/review/:campaignId`, element: <ReviewCampaign /> },
    { path: `${b}/deliveries`, element: <DeliveriesPage /> },
    { path: `${b}/deliveries/:deliveryId`, element: <DeliveryPage /> },
    { path: `${b}/products/collections/:collectionId`, element: <CollectionPage /> },
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
      { path: "hello", element: <AboutYouPage /> },
      { path: "welcome/:step?", element: <Welcome /> },
      { path: "studio/check/:checkId", element: <CheckPage /> },
      // The Studio itself is full screen, like Photoshop (FLOWS §9)
      { path: "studio/doc/:documentId", element: <DocAddress /> },
      // The agency's people open the Studio at their own address (features/agency/DocAddress.tsx)
      { path: "agency/doc/:documentId", element: <DocAddress /> },
      // Review's full-screen viewer and swipe mode (FLOWS §11)
      { path: "review/:campaignId/c/:creativeId", element: <ViewerPage /> },
      { path: "review/:campaignId/swipe", element: <SwipePage /> },
      // The client link opens only what was sent, for a client without an account (FLOWS §24.5, §26.8)
      { path: "c/:token", lazy: agencyPage("ClientLinkPage") },
      {
        element: <WorkspaceShell />,
        children: [
          // Fume's studio across every brand (FLOWS §4.2): the overview, Check, Campaigns, Deliveries, Team, Usage and
          // the quality log
          { path: "studio", element: <AllBrandsPage /> },
          { path: "studio/qa", element: <QaPage /> },
          { path: "studio/queue", element: <Navigate to="/studio/qa" replace /> },
          { path: "studio/campaigns", element: <StudioCampaignsPage /> },
          { path: "studio/deliveries", element: <StudioDeliveriesPage /> },
          { path: "studio/quality", element: <QualityLogPage /> },
          { path: "studio/team", element: <TeamLoadPage /> },
          { path: "studio/usage", element: <UsagePage /> },
          // A Fume person's own profile, in the studio
          { path: "studio/settings", element: <Navigate to="/studio/settings/profile" replace /> },
          { path: "studio/settings/profile", element: <StaffProfilePage /> },
          ...brandPages("studio"),
          // The agency's places across its clients (FLOWS §24.3), the same as the studio's (Usage is the one Usage
          // page), and one client's places under /agency/b/:workspaceId
          { path: "agency", lazy: agencyPage("AgencyHomePage") },
          { path: "agency/check", lazy: agencyPage("AgencyCheckPage") },
          { path: "agency/campaigns", lazy: agencyPage("AgencyCampaignsPage") },
          { path: "agency/deliveries", element: <StudioDeliveriesPage /> },
          { path: "agency/clients", lazy: agencyPage("AgencyClientsPage") },
          { path: "agency/team", lazy: agencyPage("AgencyTeamPage") },
          { path: "agency/usage", element: <UsagePage /> },
          { path: "agency/quality", element: <QualityLogPage /> },
          { path: "agency/settings/:page?", lazy: agencyPage("AgencySettingsPage") },
          ...brandPages("agency"),
          // The customer's places: Home (the one inbox), Fume, Campaigns, Brand; Review and Deliveries further down.
          { index: true, element: <HomePage /> },
          { path: "fume/:threadId?", element: <FumePage /> },
          // Campaigns: a list or the calendar (?show=calendar); each campaign holds its brief, creatives and delivery
          { path: "campaigns", element: <CampaignsPage /> },
          { path: "campaigns/new", element: <NewBriefPage /> },
          // A campaign's review is a state of the campaign; /review/:id sends you here
          { path: "campaigns/:campaignId/review", element: <ReviewCampaign /> },
          { path: "campaigns/:campaignId/:tab?", element: <CampaignPage /> },
          // Brand: one page, three tabs (Board, Products, Taste); the board's parts, Rules and Memory have their own address
          { path: "brand/understanding", element: <UnderstandingPage /> },
          { path: "brand/products/:productId", element: <ProductPage /> },
          // An AI model's own page: its sheet and specs
          { path: "brand/models/:modelId", element: <ModelPage /> },
          // The Engine's open proposals one at a time, inside Brand
          { path: "brand/check", lazy: brandCheckPage },
          // The product queue is inside the shell too, in the same frame as Brand's
          { path: "check/products", lazy: productCheckPage },
          { path: "brand/:tab?", element: <BrandBoardPage /> },
          // Review and Deliveries, and older addresses that send you on; their deep links keep working.
          { path: "review", element: <ReviewPage /> },
          { path: "review/:campaignId", element: <ReviewCampaign /> },
          { path: "deliveries", element: <DeliveriesPage /> },
          { path: "deliveries/:deliveryId", element: <DeliveryPage /> },
          {
            path: "calendar",
            element: <Redirect to="/campaigns" add={{ show: "calendar" }} />,
          },
          { path: "products", element: <Redirect to="/brand/products" /> },
          {
            path: "products/collections/:collectionId",
            element: <CollectionPage />,
          },
          // One address per product: the old one sends you on.
          { path: "products/:productId", element: <ProductRedirect /> },
          // Fume answers and hands over to people in the one conversation (FLOWS §21)
          { path: "contact", element: <Navigate to="/fume" replace /> },
          { path: "boards/:boardId", element: <BoardPage /> },
          { path: "notifications", element: <NotificationsPage /> },
          {
            // /settings is the list on a phone (the workspace page on a desk); each page has its own address
            path: "settings",
            element: <SettingsPage />,
          },
          { path: "settings/:page", element: <SettingsPage /> },
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
