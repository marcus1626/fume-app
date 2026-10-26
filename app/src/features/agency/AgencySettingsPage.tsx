// The agency's settings (FLOWS §24.3, §24.6), each page at its own address (/agency/settings/:page); the phone shows
// the list at /agency/settings.
// - The agency: its name, clients and people, with Fume's roles (Admin, Expert, Operator).
// - Licence and usage: this period's totals, "Approved by clients", the seats and what the licence covers. No prices
//   anywhere: the licence is a fixed platform fee and production is by use. The figures per client and per period are
//   on the one Usage page (/agency/usage).
// - Fume plan: what the agency has, what comes and that Fume decides it; Fume's people on request.
// - Your profile: the agency person's own page, never the customer's settings.
import {
  Avatar,
  Badge,
  Button,
  DataList,
  DataListItem,
  Icon,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
  PageHeader,
  SettingsLayout,
  SettingsPage as SettingsPane,
  SettingsSection,
  Stat,
  StatGrid,
  type SettingsSectionDef,
} from "@fume/ui";
import { useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAgencyClients, useAgencyPlan, useAgencyTeam, useLicence, useSession } from "../../api/hooks";
import type { AgencyFeature, LicenceView } from "../../contract";
import { when } from "../../lib/time";
import { Nothing, Page, Query, useBack } from "../../shell/Page";
import { initials } from "../../shell/people";
import { agencyRoleHelp, agencyRoleOf, agencyRoleWords, useAgencySeat } from "./agency-parts";
import { ProfileForm } from "../settings/parts";
import { requestWords, useFumeHelp } from "./fume-help";

const PAGES = ["agency", "plan", "licence", "profile"] as const;
/** A licence period's day as the licence says it (its days are whole days in UTC): "1 Oct", "31 Oct". */
const utcDay = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(Date.parse(iso));
type PageId = (typeof PAGES)[number];

export function AgencySettingsPage() {
  const { page } = useParams<"page">();
  const { agency } = useAgencySeat();
  const navigate = useNavigate();
  const known = page === undefined || PAGES.includes(page as PageId);
  const value = page ?? "agency";
  const view: "list" | "page" = page ? "page" : "list";
  const back = useBack({ to: "/agency/settings", label: "Settings" });
  const opened = useRef(false);

  const sections: SettingsSectionDef[] = [
    {
      id: "agency",
      label: "Agency",
      icon: "users",
      description: "The agency, its clients and its people",
      content: <AgencyPane />,
    },
    {
      id: "plan",
      label: "Fume plan",
      icon: "package",
      description: "What you have from Fume, and what comes",
      content: <PlanPane />,
    },
    {
      id: "licence",
      label: "Licence and usage",
      icon: "chart-column",
      description: "What the licence covers and what is used",
      content: <LicencePane />,
    },
    {
      id: "profile",
      label: "Your profile",
      icon: "user",
      description: "You, as your team and Fume see you",
      content: <ProfilePane />,
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
        header={<PageHeader title="Settings" meta={agency ? [agency.name] : undefined} />}
        sections={sections}
        value={value}
        onValueChange={(id) => {
          opened.current = true;
          navigate(`/agency/settings/${id}`);
          queueMicrotask(() => {
            opened.current = false;
          });
        }}
        view={view}
        onViewChange={(next) => {
          if (next === "page") {
            if (!opened.current) navigate(`/agency/settings/${value}`);
          } else if (!back.cold && back.href.split("?")[0] === "/agency/settings") back.back();
          else navigate("/agency/settings");
        }}
      />
    </Page>
  );
}

// ─── The agency ─────────────────────────────────────────────────────────────

function AgencyPane() {
  const { agency, me, lead, isAgency } = useAgencySeat();
  const team = useAgencyTeam();
  const clients = useAgencyClients(isAgency);
  const licence = useLicence();
  const seats = licence.data?.seats;
  return (
    <SettingsPane
      title="Agency"
      description="The agency that runs these client brands in Fume. Each client keeps its own Brand DNA, products, taste and conversation with Fume; nothing crosses between them."
    >
      <SettingsSection title="The agency">
        <DataList>
          <DataListItem label="Name">{agency?.name ?? "—"}</DataListItem>
          <DataListItem label="Client brands">
            {clients.data ? clients.data.map((c) => c.workspace.brandName).join(", ") : "—"}
          </DataListItem>
          <DataListItem label="Seats">{seats ? `${seats.used} of ${seats.included} used` : "—"}</DataListItem>
        </DataList>
      </SettingsSection>

      <SettingsSection
        title="People"
        description={
          lead
            ? "Who works in the agency, and their role. Invite someone from Team."
            : "Who works in the agency, and their role. The agency lead invites people."
        }
      >
        <Query query={team}>
          {(rows) => (
            <ItemGroup as="ul">
              {rows.map((t) => (
                <Item key={t.user.id} as="li" size="sm">
                  <ItemMedia>
                    <Avatar
                      size="md"
                      src={t.user.avatar}
                      initials={initials(t.user.name)}
                      ink={t.role === "lead"}
                      aria-hidden="true"
                    />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>
                      {t.user.name}
                      {t.user.id === me?.id ? " (you)" : ""}
                    </ItemTitle>
                    <ItemDescription>{[t.user.title, t.user.email].filter(Boolean).join(" · ")}</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Badge>{agencyRoleWords[agencyRoleOf(t.role, t.user)]}</Badge>
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          )}
        </Query>
        <div className="ui-app-row">
          <Button asChild variant="quiet" size="sm" iconEnd="arrow-right">
            <Link to="/agency/team">Team</Link>
          </Button>
        </div>
      </SettingsSection>
    </SettingsPane>
  );
}

// ─── Licence and usage ──────────────────────────────────────────────────────

function LicencePane() {
  const licence = useLicence();
  return (
    <SettingsPane
      title="Licence and usage"
      description="The agency licence is a fixed platform fee; production is by use, counted per client each month."
    >
      <Query query={licence} loading="Loading the licence">
        {(v) => <Licence view={v} />}
      </Query>
    </SettingsPane>
  );
}

function Licence({ view }: { view: LicenceView }) {
  const { period, scope, total, seats } = view;
  const span = `${utcDay(period.from)} to ${utcDay(period.to)}`;
  // The same numbers as Usage and each client's Home, under the same names.
  return (
    <>
      <SettingsSection title="This period" description={span}>
        <StatGrid>
          <Stat label="Creatives made" value={total.creativesMade} />
          <Stat label="Approved by clients" value={total.creativesApproved} />
          <Stat label="Seats used" value={[{ num: seats.used, unit: `of ${seats.included}` }]} />
        </StatGrid>
        <div className="ui-app-row">
          <Button asChild variant="secondary" size="sm" iconEnd="arrow-right">
            <Link to="/agency/usage">Usage per client</Link>
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection title="What the licence covers">
        <DataList>
          <DataListItem label="Platform">A fixed fee</DataListItem>
          <DataListItem label="Production">By use: the creatives made for each client, counted each month</DataListItem>
          <DataListItem label="Scope">{scope}</DataListItem>
          <DataListItem label="Seats">
            {seats.used} of {seats.included} used
          </DataListItem>
        </DataList>
      </SettingsSection>
    </>
  );
}

// ─── The Fume plan ─────────────────────────────────────────────────────────

const featureIcon = { included: "circle-check", coming: "clock", on_request: "users" } as const;

function PlanPane() {
  const plan = useAgencyPlan();
  const licence = useLicence();
  const clients = useAgencyClients(true).data ?? [];
  const help = useFumeHelp();
  return (
    <SettingsPane
      title="Fume plan"
      description={plan.data?.decidedBy ?? "Fume decides which features and updates an agency gets, and when."}
    >
      <Query query={plan} loading="Loading your plan">
        {(p) => {
          const clientName = (id?: string) => clients.find((c) => c.workspace.id === id)?.workspace.brandName;
          const list = (state: AgencyFeature["state"]) => (
            <ItemGroup as="ul">
              {p.features
                .filter((f) => f.state === state)
                .map((f) => (
                  <Item key={f.id} as="li" size="sm">
                    <ItemMedia variant="icon">
                      <Icon name={featureIcon[f.state]} />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>{f.name}</ItemTitle>
                      <ItemDescription>{f.detail}</ItemDescription>
                    </ItemContent>
                    {f.when && (
                      <ItemActions>
                        <Badge>{f.when}</Badge>
                      </ItemActions>
                    )}
                  </Item>
                ))}
            </ItemGroup>
          );
          return (
            <>
              <SettingsSection title="Your plan">
                <DataList>
                  <DataListItem label="Plan">{p.name}</DataListItem>
                  {licence.data && <DataListItem label="Scope">{licence.data.scope}</DataListItem>}
                  {p.contact && (
                    <DataListItem label="Your contact at Fume">
                      {p.contact.name}, {p.contact.title.toLowerCase()}
                    </DataListItem>
                  )}
                  <DataListItem label="Fume’s people">Not in the plan: borrow them for a campaign</DataListItem>
                </DataList>
              </SettingsSection>
              <SettingsSection title="In your plan" description="What your team has in Fume today.">
                {list("included")}
              </SettingsSection>
              <SettingsSection
                title="Coming"
                description="Fume decides when an update reaches your team. It shows here first."
              >
                {list("coming")}
              </SettingsSection>
              <SettingsSection
                title="On request"
                description="Fume’s own people work for Fume’s customers. Borrow them when a campaign needs more hands."
              >
                {list("on_request")}
                <div className="ui-app-row">
                  <Button variant="secondary" size="sm" icon="users" onClick={() => help.open("borrow")}>
                    Borrow Fume’s people
                  </Button>
                  <Button variant="quiet" size="sm" icon="calendar" onClick={() => help.open("meeting")}>
                    Book a meeting
                  </Button>
                </div>
              </SettingsSection>
              {p.requests.length > 0 && (
                <SettingsSection
                  title="What you asked Fume"
                  description={`${p.contact ? p.contact.name.split(" ")[0] : "Fume"} answers within a working day.`}
                >
                  <ItemGroup as="ul">
                    {p.requests.map((r) => (
                      <Item key={r.id} as="li" size="sm">
                        <ItemMedia variant="icon">
                          <Icon name={r.kind === "support" ? "mail" : "users"} />
                        </ItemMedia>
                        <ItemContent>
                          <ItemTitle>{requestWords(r, clientName(r.clientId))}</ItemTitle>
                          <ItemDescription>
                            {[`Sent ${when(r.at)}`, r.text ? `“${r.text}”` : undefined].filter(Boolean).join(" · ")}
                          </ItemDescription>
                        </ItemContent>
                      </Item>
                    ))}
                  </ItemGroup>
                </SettingsSection>
              )}
            </>
          );
        }}
      </Query>
      {help.panels}
    </SettingsPane>
  );
}

// ─── Your profile ──────────────────────────────────────────────────────────

/** The agency person's own profile: who they are and their role in the agency, never a client's customer role. */
function ProfilePane() {
  const { agency } = useAgencySeat();
  const me = useSession().data?.user;
  const team = useAgencyTeam();
  const clients = useAgencyClients(true).data ?? [];
  const mine = team.data?.find((t) => t.user.id === me?.id);
  const clientNames = (mine?.clientIds ?? [])
    .map((id) => clients.find((c) => c.workspace.id === id)?.workspace.brandName)
    .filter(Boolean);
  const role = mine ? agencyRoleOf(mine.role, mine.user) : undefined;
  if (!me) return null;
  // The one profile form (features/settings/parts.tsx), then the person's role at the agency and their clients.
  return (
    <SettingsPane title="Your profile" description="You, as your team, your clients and Fume see you.">
      <ProfileForm
        user={me}
        about={
          <DataList>
            <DataListItem label={`At ${agency?.name ?? "the agency"}`}>
              {role
                ? `${agencyRoleWords[role]}: ${agencyRoleHelp[role].charAt(0).toLowerCase()}${agencyRoleHelp[role].slice(1)}`
                : "—"}
            </DataListItem>
            {mine && (
              <DataListItem label="Clients">{clientNames.length ? clientNames.join(", ") : "None yet"}</DataListItem>
            )}
          </DataList>
        }
      />
    </SettingsPane>
  );
}
