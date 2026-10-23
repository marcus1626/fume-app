// Settings (ARCHITECTURE §7.1, footer): the workspace, the team, the package and its usage, your notifications and
// your profile. Each page is a route (/settings/:page), so a link (the switcher's "Your profile") opens it directly.
// Round 8 (walk-through 19 Oct, WAY-21): the address says what shows. /settings is the list on a phone (and the
// workspace page on a desk); every page, the workspace too, opens at its own address as a new entry, so the phone's
// back from a page returns to the list, and the page's back does the same through history.
// Round 9 (desktop review DWAY-19; PROPOSED 19 Oct 2026): the browser tab names the page: "Team · Settings · Fume".
import { PageHeader, SettingsLayout, type SettingsSectionDef } from "@fume/ui";
import { useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSession, useTeam } from "../../api/hooks";
import { Nothing, Page, useBack } from "../../shell/Page";
import { NotificationSettings, PackageSettings, ProfileSettings, TeamSettings, WorkspaceSettings } from "./parts";

const PAGES = ["workspace", "team", "package", "notifications", "profile"] as const;
type PageId = (typeof PAGES)[number];

export function SettingsPage() {
  const { page } = useParams<"page">();
  const session = useSession().data!;
  const team = useTeam();
  const navigate = useNavigate();
  const known = page === undefined || PAGES.includes(page as PageId);
  const value = page ?? "workspace";
  // the phone shows the list at /settings and a page at /settings/:page
  const view: "list" | "page" = page ? "page" : "list";
  const back = useBack({ to: "/settings", label: "Settings" });
  // a row that is also the chosen tab opens no new address by itself; the layout then only asks for the page view
  const opened = useRef(false);

  const sections: SettingsSectionDef[] = [
    {
      id: "workspace",
      label: "Workspace",
      icon: "palette",
      description: "The brand name, market and language",
      content: <WorkspaceSettings session={session} />,
    },
    {
      id: "team",
      label: "Team",
      icon: "users",
      hint: team.data ? team.data.members.length : undefined,
      description: "Who is on the workspace and what they can do",
      content: <TeamSettings session={session} />,
    },
    {
      id: "package",
      label: "Package and usage",
      icon: "chart-column",
      description: "What the package includes and what is used",
      content: <PackageSettings session={session} />,
    },
    {
      id: "notifications",
      label: "Notifications",
      icon: "bell",
      description: "What Fume tells you, and where",
      content: <NotificationSettings />,
    },
    {
      id: "profile",
      label: "Profile",
      icon: "user",
      description: session.user.name,
      content: <ProfileSettings session={session} />,
    },
  ];

  if (!known)
    return (
      <Page title="Settings" width="reading">
        <PageHeader title="Settings" />
        <Nothing icon="search" title="This setting isn’t here" text="Choose one of the settings from the list." />
      </Page>
    );

  return (
    <Page
      title="Settings"
      docTitle={page ? `${sections.find((x) => x.id === value)?.label ?? "Settings"} · Settings` : "Settings"}
    >
      <SettingsLayout
        header={<PageHeader title="Settings" meta={[session.workspace.brandName]} />}
        sections={sections}
        value={value}
        onValueChange={(id) => {
          opened.current = true;
          navigate(`/settings/${id}`);
          queueMicrotask(() => {
            opened.current = false;
          });
        }}
        view={view}
        onViewChange={(next) => {
          if (next === "page") {
            if (!opened.current) navigate(`/settings/${value}`);
          } else if (!back.cold && back.href.split("?")[0] === "/settings") back.back();
          else navigate("/settings");
        }}
      />
    </Page>
  );
}
