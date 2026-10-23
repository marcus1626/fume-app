// An example client's places in the preview (FLOWS §24.8). The mock is one brand deep (LYSNE), so a summary client's
// own pages would show LYSNE's Brand DNA, products and chat under AURÉA's name. Instead every place of a summary client
// shows a notice inside the agency's sidebar, with one way on (Open LYSNE) and a quiet way back (All clients):
// - Home keeps the summary: the client's mark and name, where it stands, its current campaign and how far it is, its
//   people, and the line that says only LYSNE has the full example data;
// - Campaigns shows the client's campaign; Check, Brand, Studio, Engine and Fume say what that place holds for this
//   client, and the way on opens LYSNE's same place ("Open LYSNE’s Check").
// A client the agency has just added is new, not an example: "Fume is reading nordlys.no", and its first place is the
// Brand DNA. Each of the client's people shows their role ("Can approve"); an invited one says so.
import {
  Alert,
  AlertAction,
  AlertDescription,
  Avatar,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataList,
  DataListItem,
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
  PageHeader,
  Progress,
  ProgressField,
  ProgressHead,
  type IconName,
} from "@fume/ui";
import { useId } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAgencyClients, useSession } from "../api/hooks";
import type { AgencyClient, Workspace } from "../contract";
import * as copy from "../copy";
import { useOpenClient } from "../features/agency/useOpenClient";
import { date, due } from "../lib/time";
import { Nothing, Page, Section } from "./Page";
import { initials, useIsMe } from "./people";
import { brandBase, equivalent, placeOf, type PlaceKey } from "./scope";

/** The places of a client other than Home, with their name and what each holds. */
const PLACES: Partial<Record<PlaceKey, { label: string; icon: IconName; holds: string }>> = {
  check: { label: "Check", icon: "inbox", holds: "the creatives that wait for your check" },
  campaigns: { label: "Campaigns", icon: "megaphone", holds: "its campaigns, their plans and creatives" },
  brand: { label: "Brand", icon: "palette", holds: "its Brand DNA, products and taste" },
  studio: { label: "Studio", icon: "layers", holds: "its creatives in the Studio" },
  engine: { label: "Engine", icon: "fume-engine", holds: "its Engine chat and what the Engine made" },
  fume: { label: "Fume", icon: "message-square", holds: "its conversation with Fume" },
};

/** "New client: Fume is reading nordlys.no" → "nordlys.no". */
const siteOf = (client?: AgencyClient) => /reading (\S+)/.exec(client?.status ?? "")?.[1];

export function SummaryClientNotice({ workspace, client }: { workspace: Workspace; client?: AgencyClient }) {
  const { pathname } = useLocation();
  const key = placeOf(pathname);
  const place = PLACES[key];
  return place ? (
    <ClientPlace workspace={workspace} client={client} place={place} pathname={pathname} />
  ) : (
    <ClientHome workspace={workspace} client={client} />
  );
}

/** What the preview says about this client, with the way on: LYSNE's same place (an example), or All clients. */
function PreviewAlert({
  workspace,
  client,
  place,
  pathname,
}: {
  workspace: Workspace;
  client?: AgencyClient;
  place?: { label: string };
  pathname: string;
}) {
  const session = useSession().data!;
  const clients = useAgencyClients(Boolean(session.user.agency)).data ?? [];
  const full = clients.find((c) => c.example === "full");
  const navigate = useNavigate();
  const openClient = useOpenClient();
  const name = workspace.brandName;
  const fullName = full?.workspace.brandName ?? "LYSNE";
  const site = siteOf(client);
  const onBrand = placeOf(pathname) === "brand";
  const words = client?.isNew
    ? onBrand
      ? `${name} is new: its Brand DNA comes first, then its campaigns.`
      : `${name} is new. Fume is reading ${site ?? "the brand"} and starts its Brand DNA; ${place ? `its ${place.label}` : "everything else"} fills in from there.`
    : `${name} is an example client in this preview${place ? `: its ${place.label} is not here` : ""}. Only ${fullName} has the full example data.`;
  return (
    <Alert variant="info">
      <AlertDescription>{words}</AlertDescription>
      <AlertAction>
        {client?.isNew && !onBrand && (
          <Button
            size="sm"
            iconEnd="arrow-right"
            onClick={() => navigate(`${brandBase("agency", workspace.id)}/brand`)}
          >
            Its Brand DNA
          </Button>
        )}
        {full && !client?.isNew && (
          <Button
            size="sm"
            iconEnd="arrow-right"
            onClick={() =>
              place
                ? navigate(equivalent(pathname, "agency", full.workspace.id))
                : void openClient(full.workspace.id, "/")
            }
          >
            {place ? `Open ${fullName}’s ${place.label}` : `Open ${fullName}`}
          </Button>
        )}
        <Button size="sm" variant="quiet" onClick={() => navigate("/agency")}>
          All clients
        </Button>
      </AlertAction>
    </Alert>
  );
}

/** The client's current campaign and how far it is (Home's "Now", Campaigns' one card). */
function NowCard({ client, progressId }: { client?: AgencyClient; progressId: string }) {
  const current = client?.current;
  if (!current)
    return (
      <Card>
        <CardHeader>
          <CardTitle>No campaign yet</CardTitle>
          <CardDescription>
            {client?.isNew
              ? "The first campaign starts once Fume has read the brand and you have confirmed its Brand DNA."
              : "The first campaign starts once the Brand DNA is confirmed."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  const pct = Math.round(current.progress * 100);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{current.name}</CardTitle>
        <CardDescription>{current.detail}</CardDescription>
      </CardHeader>
      <CardContent>
        <ProgressField>
          <ProgressHead
            label={`${client?.people[0]?.name.split(" ")[0] ?? "The client"} approved`}
            labelId={progressId}
            num={`${pct} %`}
          />
          <Progress value={pct} aria-labelledby={progressId} />
        </ProgressField>
        <DataList variant="grid">
          <DataListItem label="Next delivery">
            {client?.nextDelivery ? due(client.nextDelivery.at) : "Not set yet"}
          </DataListItem>
          <DataListItem label="Waiting on">
            {client?.waitingOn ?? (client?.waitingOnYou ? "You" : "No one")}
          </DataListItem>
          <DataListItem label="Campaigns">{copy.count(client?.campaignsActive ?? 0, "active campaign")}</DataListItem>
        </DataList>
      </CardContent>
    </Card>
  );
}

function ClientHome({ workspace, client }: { workspace: Workspace; client?: AgencyClient }) {
  const session = useSession().data!;
  const { pathname } = useLocation();
  const isMe = useIsMe();
  const progressId = useId();
  const name = workspace.brandName;
  const agencyName = session.agency?.organisation.name ?? "the agency";
  const lead = client?.lead;

  return (
    <Page title={name} width="reading">
      <PageHeader
        title={
          <span className="ui-agency-notice-name">
            <span className="ui-agency-mark ui-agency-mark--lg" aria-hidden="true">
              {initials(name)}
            </span>
            {name}
          </span>
        }
        description={client?.status}
        meta={[
          `${workspace.market} · ${workspace.language}`,
          ...(lead ? [`Led by ${copy.byYou(lead.name, isMe(lead))}`] : []),
          ...(client ? [client.isNew ? "Added today" : `Client since ${date(client.since)}`] : []),
        ]}
      />

      <PreviewAlert workspace={workspace} client={client} pathname={pathname} />

      <Section title="Now" titleId={`${progressId}-now`}>
        <NowCard client={client} progressId={progressId} />
      </Section>

      <Section title="People" titleId={`${progressId}-people`}>
        <ItemGroup as="ul">
          {(client?.people ?? []).map((p) => {
            const role = client?.roles?.[p.id];
            const what = [p.title, role ? copy.role[role] : undefined, client?.isNew ? "invited" : undefined]
              .filter(Boolean)
              .join(" · ");
            return (
              <Item key={p.id} as="li" variant="muted">
                <ItemMedia>
                  <Avatar size="sm" initials={initials(p.name)} />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{p.name}</ItemTitle>
                  <ItemDescription>{[what, name].filter(Boolean).join(", ")}</ItemDescription>
                </ItemContent>
              </Item>
            );
          })}
          {lead && (
            <Item as="li" variant="muted">
              <ItemMedia>
                <Avatar size="sm" ink initials={initials(lead.name)} />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{isMe(lead) ? `${lead.name} (you)` : lead.name}</ItemTitle>
                <ItemDescription>
                  {lead.title} at {agencyName} · leads {name}
                </ItemDescription>
              </ItemContent>
            </Item>
          )}
        </ItemGroup>
      </Section>
    </Page>
  );
}

/** One place of the client (Check, Campaigns, Brand, Studio, Engine, Fume): its own title and what it holds here. */
function ClientPlace({
  workspace,
  client,
  place,
  pathname,
}: {
  workspace: Workspace;
  client?: AgencyClient;
  place: { label: string; icon: IconName; holds: string };
  pathname: string;
}) {
  const progressId = useId();
  const name = workspace.brandName;
  const key = placeOf(pathname);
  const brandNews = /brand dna/i.test(client?.status ?? "") ? client?.status : undefined;

  const body = (() => {
    switch (key) {
      case "campaigns":
        return (
          <Section
            title={client?.current ? "Under way" : undefined}
            titleId={`${progressId}-campaigns`}
            action={
              client?.current ? (
                <Button asChild variant="quiet" size="sm" iconEnd="arrow-right">
                  <Link to={`/agency/campaigns?client=${workspace.id}`}>In all campaigns</Link>
                </Button>
              ) : undefined
            }
          >
            <NowCard client={client} progressId={progressId} />
          </Section>
        );
      case "check":
        return (
          <Nothing
            icon={place.icon}
            title={`Nothing waits for your check in ${name}`}
            text={client?.status ? `${client.status}.` : undefined}
            action={
              <Button asChild variant="secondary" size="sm" iconEnd="arrow-right">
                <Link to="/agency/check">Check across your clients</Link>
              </Button>
            }
          />
        );
      case "brand":
        return (
          <Nothing
            icon={place.icon}
            title={client?.isNew ? `Fume is reading ${name}’s brand` : `${name}’s Brand DNA`}
            text={
              client?.isNew
                ? `From ${siteOf(client) ?? "its website"}: the logo, colours, type, voice and products. You confirm what Fume found.`
                : (brandNews ?? `${name}’s Brand DNA, products and taste are kept apart from your other clients’.`)
            }
          />
        );
      default:
        return <Nothing icon={place.icon} title={`${name}’s ${place.label}`} text={`Here: ${place.holds}.`} />;
    }
  })();

  return (
    <Page title={`${place.label} · ${name}`} width="reading">
      <PageHeader title={place.label} meta={[name, `${workspace.market} · ${workspace.language}`]} />
      <PreviewAlert workspace={workspace} client={client} place={place} pathname={pathname} />
      {body}
    </Page>
  );
}
