// The settings pages: workspace, team, package and usage, notifications, profile. Each is a SettingsPage (the
// design system's page head) with its sections. What only the owner may do is hidden or disabled, with the reason.
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Avatar,
  Badge,
  Button,
  checkInviteEmail,
  Choice,
  ChoiceText,
  DataList,
  DataListItem,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Icon,
  Input,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
  Progress,
  ProgressField,
  ProgressHead,
  SettingsForm,
  SettingsPage as SettingsPane,
  SettingsSection,
  ShareRoleSelect,
  Switch,
  useToast,
  type ShareGrant,
} from "@fume/ui";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useChangeRole, useInvite, useMeetings, useRemoveMember, useSettings, useTeam, useUpdateProfile, useUpdateWorkspace } from "../../api/hooks";
import type { Session, SettingsView, TeamView, User } from "../../contract";
import * as copy from "../../copy";
import { date, now } from "../../lib/time";
import { Query } from "../../shell/Page";
import { firstName, initials } from "../../shell/people";
import { BookMeetingDialog, slotLabel } from "../fume/meeting";

const isOwner = (session: Session) => session.role === "owner";

/** "Only the owner changes this. Ask Maja Lind." */
function ownerOnly(team: TeamView | undefined, what: string) {
  const owner = team?.members.find((m) => m.membership.role === "owner")?.user;
  return `Only the owner ${what}.${owner ? ` Ask ${owner.name}.` : ""}`;
}

function Person({ user }: { user: User }) {
  return (
    <ItemMedia>
      <Avatar size="md" src={user.avatar} initials={initials(user.name)} ink={user.staffRole === "expert"} aria-hidden="true" />
    </ItemMedia>
  );
}

// ─── Workspace ──────────────────────────────────────────────────────────────

export function WorkspaceSettings({ session }: { session: Session }) {
  const settings = useSettings();
  const team = useTeam();
  return (
    <SettingsPane title="Workspace" description="The brand this workspace is for, and where its creatives run.">
      <Query query={settings}>{(view) => <WorkspaceForm view={view} editable={isOwner(session)} reason={ownerOnly(team.data, "changes the workspace")} />}</Query>
    </SettingsPane>
  );
}

function WorkspaceForm({ view, editable, reason }: { view: SettingsView; editable: boolean; reason: string }) {
  const saved = { brandName: view.workspace.brandName, market: view.workspace.market, language: view.workspace.language };
  const [value, setValue] = useState(saved);
  const update = useUpdateWorkspace();
  const toast = useToast();
  // A save (or a change elsewhere) brings new saved values: the form follows them.
  useEffect(() => setValue(saved), [saved.brandName, saved.market, saved.language]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = value.brandName !== saved.brandName || value.market !== saved.market || value.language !== saved.language;
  const empty = !value.brandName.trim();

  const submit = (_: FormEvent<HTMLFormElement>) => {
    if (empty) return;
    update.mutate(
      { brandName: value.brandName.trim(), market: value.market.trim(), language: value.language.trim() },
      { onSuccess: () => toast.done("Workspace saved"), onError: () => toast.error("The workspace wasn’t saved", { description: "Your changes are still here; try again." }) },
    );
  };

  const field = (key: keyof typeof saved, label: string, help: string) => (
    <Field invalid={key === "brandName" && empty} disabled={!editable}>
      <FieldLabel htmlFor={`ws-${key}`}>{label}</FieldLabel>
      <Input
        id={`ws-${key}`}
        value={value[key]}
        disabled={!editable}
        aria-invalid={key === "brandName" && empty ? true : undefined}
        aria-describedby={`ws-${key}-help`}
        onChange={(e) => setValue({ ...value, [key]: e.target.value })}
      />
      <FieldDescription id={`ws-${key}-help`}>{help}</FieldDescription>
      {key === "brandName" && empty && <FieldError>Give the brand its name; Fume uses it on every creative’s delivery name.</FieldError>}
    </Field>
  );

  return (
    <SettingsForm dirty={dirty} saving={update.isPending} onDiscard={() => setValue(saved)} onSubmit={submit}>
      <SettingsSection title="The brand" description={editable ? "How Fume names the brand in the workspace and in deliveries." : reason}>
        <FieldGroup>
          {field("brandName", "Brand name", "As it is written on the product.")}
          {field("market", "Market", "Where the creatives run. It decides the claims Fume may use.")}
          {field("language", "Language", "The language of the words on the creatives.")}
        </FieldGroup>
      </SettingsSection>
    </SettingsForm>
  );
}

// ─── Team ───────────────────────────────────────────────────────────────────

const staffWork = {
  expert: "Checks every creative before you see it",
  operator: "Runs the Engine for your campaigns",
  admin: "Runs Fume",
} as const;

export function TeamSettings({ session }: { session: Session }) {
  const team = useTeam();
  return (
    <SettingsPane title="Team" description={`Who works on ${session.workspace.brandName} in Fume, and what each of them can do.`}>
      <Query query={team}>{(view) => <TeamSections view={view} session={session} />}</Query>
    </SettingsPane>
  );
}

function TeamSections({ view, session }: { view: TeamView; session: Session }) {
  const owner = isOwner(session);
  const changeRole = useChangeRole();
  const remove = useRemoveMember();
  const toast = useToast();
  const pending = view.invitations.filter((i) => i.state === "sent");
  const nameOf = (id: string) => view.members.find((m) => m.user.id === id)?.user.name ?? "Someone";
  // Round 13 (robot note 12): an agency's people work in the brand through the agency; they are the agency's to
  // manage, so they are listed apart, with no role to change and no remove
  const agencyPeople = view.members.filter((m) => m.user.agency);
  const people = view.members.filter((m) => !m.user.agency);

  return (
    <>
      <SettingsSection title="People" description={owner ? "Change what someone can do, or take them off the workspace." : ownerOnly(view, "changes roles and the team")}>
        <ItemGroup as="ul">
          {people.map(({ user, membership }) => {
            const you = user.id === session.user.id;
            const editable = owner && !you && membership.role !== "owner";
            return (
              <Item key={user.id} as="li" size="sm">
                <Person user={user} />
                <ItemContent>
                  <ItemTitle>
                    {user.name}
                    {you ? " (you)" : ""}
                  </ItemTitle>
                  <ItemDescription>
                    {user.title} · {copy.roleHelp[membership.role]}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  {editable ? (
                    <>
                      <ShareRoleSelect
                        value={membership.role as ShareGrant}
                        label={`What ${firstName(user.name)} can do`}
                        disabled={changeRole.isPending}
                        onValueChange={(role) =>
                          changeRole.mutate({ userId: user.id, role }, { onSuccess: () => toast.done(`${firstName(user.name)}: ${copy.role[role]}`) })
                        }
                      />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="quiet" iconOnly icon="trash" aria-label={`Remove ${user.name}`} />
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Remove {user.name} from {session.workspace.brandName}?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              They lose the campaigns, the conversation with Fume and the deliveries. Their decisions stay in the record.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep {firstName(user.name)}</AlertDialogCancel>
                            <AlertDialogAction icon="trash" onClick={() => remove.mutate(user.id, { onSuccess: () => toast.done(`${user.name} removed`) })}>
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  ) : (
                    <Badge>{copy.role[membership.role]}</Badge>
                  )}
                </ItemActions>
              </Item>
            );
          })}
        </ItemGroup>
      </SettingsSection>

      {agencyPeople.length > 0 && (
        <SettingsSection
          title={session.agencyName ?? "Your agency"}
          description={`They make ${session.workspace.brandName}’s creatives with Fume and send them to you to approve. ${session.agencyName ?? "The agency"} decides who works on them.`}
        >
          <ItemGroup as="ul">
            {agencyPeople.map(({ user }) => (
              <Item key={user.id} as="li" size="sm">
                <Person user={user} />
                <ItemContent>
                  <ItemTitle>{user.name}</ItemTitle>
                  <ItemDescription>
                    {user.title}, {session.agencyName ?? "the agency"}
                  </ItemDescription>
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
        </SettingsSection>
      )}

      {!session.agencyName && <FumeTeamSection view={view} />}

      {owner && <InviteSection view={view} />}

      {pending.length > 0 && (
        <SettingsSection title="Invitations" description="Sent and not yet accepted.">
          <ItemGroup as="ul">
            {pending.map((inv) => (
              <Item key={inv.id} as="li" size="sm">
                <ItemMedia>
                  <Avatar size="md" initials={inv.email.slice(0, 1).toUpperCase()} aria-hidden="true" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{inv.email}</ItemTitle>
                  <ItemDescription>
                    Invited by {firstName(nameOf(inv.invitedBy))} on {date(inv.at)}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Badge>{copy.role[inv.role]}</Badge>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        </SettingsSection>
      )}

      <SettingsSection title="What each role can do" description="Only the owner and the people who can approve make decisions on creatives.">
        <DataList>
          {(Object.keys(copy.role) as (keyof typeof copy.role)[]).map((r) => (
            <DataListItem key={r} label={copy.role[r]}>
              {copy.roleHelp[r]}
            </DataListItem>
          ))}
        </DataList>
      </SettingsSection>
    </>
  );
}

/** Fume's people on the brand (FLOWS §21): Fume answers first and brings one of them into the conversation when a
 *  person is needed; a meeting with them is one tap away. */
function FumeTeamSection({ view }: { view: TeamView }) {
  const [booking, setBooking] = useState(false);
  const meetings = useMeetings();
  const people = new Map(view.fumeTeam.map((u) => [u.id, u]));
  const ahead = (meetings.data ?? []).filter((m) => m.state === "booked" && Date.parse(m.at) >= now());
  return (
    <SettingsSection
      title="Your Fume team"
      description="Fume answers you in the conversation. When something needs a person, one of them answers you there, with their own name."
    >
      <ItemGroup as="ul">
        {view.fumeTeam.map((user) => (
          <Item key={user.id} as="li" size="sm">
            <Person user={user} />
            <ItemContent>
              <ItemTitle>
                {user.name}, {user.title}
              </ItemTitle>
              <ItemDescription>{user.staffRole ? staffWork[user.staffRole] : user.email}</ItemDescription>
            </ItemContent>
          </Item>
        ))}
      </ItemGroup>
      {ahead.length > 0 && (
        <ItemGroup as="ul" aria-label="Meetings booked">
          {ahead.map((m) => (
            <Item key={m.id} as="li" size="sm" variant="muted">
              <ItemMedia variant="icon">
                <Icon name="calendar" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{m.topic}</ItemTitle>
                <ItemDescription>
                  {slotLabel(m.at)} · {m.minutes} min{people.get(m.hostId) ? ` with ${firstName(people.get(m.hostId)!.name)}` : ""}
                </ItemDescription>
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
      )}
      <div className="ui-app-row">
        <Button variant="secondary" icon="calendar" onClick={() => setBooking(true)}>
          Book a meeting
        </Button>
        <Button asChild variant="quiet" icon="message-square">
          <Link to="/fume">Ask Fume</Link>
        </Button>
      </div>
      <BookMeetingDialog open={booking} onOpenChange={setBooking} />
    </SettingsSection>
  );
}

function InviteSection({ view }: { view: TeamView }) {
  const invite = useInvite();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ShareGrant>("member");
  const [problem, setProblem] = useState<string | null>(null);
  const known = [
    ...view.members.map((m) => ({ id: m.user.id, name: m.user.name, email: m.user.email, role: m.membership.role })),
    ...view.invitations.filter((i) => i.state === "sent").map((i) => ({ id: i.id, name: i.email, email: i.email, role: i.role })),
  ];

  const send = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const reason = checkInviteEmail(email, known);
    setProblem(reason);
    if (reason) return;
    invite.mutate(
      { email: email.trim(), role },
      {
        onSuccess: () => {
          toast.done(`Invitation sent to ${email.trim()}`);
          setEmail("");
        },
        onError: () => setProblem("The invitation wasn’t sent. Try again in a moment."),
      },
    );
  };

  return (
    <SettingsSection title="Invite someone" description="They get an email with a link to this workspace.">
      <form className="ui-app-stack" onSubmit={send} noValidate>
        <FieldGroup>
          <Field invalid={Boolean(problem)}>
            <FieldLabel htmlFor="invite-email">Email</FieldLabel>
            <Input
              id="invite-email"
              type="email"
              autoComplete="off"
              value={email}
              placeholder="name@lysne.example"
              aria-invalid={problem ? true : undefined}
              aria-describedby={problem ? "invite-email-error" : undefined}
              onChange={(e) => {
                setEmail(e.target.value);
                setProblem(null);
              }}
            />
            <FieldError id="invite-email-error">{problem}</FieldError>
          </Field>
          <Field>
            <FieldLabel as="span" id="invite-role-label">
              What they can do
            </FieldLabel>
            <ShareRoleSelect value={role} onValueChange={setRole} label="What they can do" />
            <FieldDescription>{copy.roleHelp[role]}</FieldDescription>
          </Field>
        </FieldGroup>
        <div className="ui-app-row">
          <Button type="submit" icon="user-plus" loading={invite.isPending}>
            Send the invitation
          </Button>
        </div>
      </form>
    </SettingsSection>
  );
}

// ─── Package and usage ──────────────────────────────────────────────────────

export function PackageSettings({ session }: { session: Session }) {
  const settings = useSettings();
  return (
    <SettingsPane title="Package and usage" description="What your package includes, and how much of it this period has used.">
      <Query query={settings}>
        {({ package: pkg, usage }) => (
          // Round 13 (robot note 12): a brand an agency runs is under the agency's licence, so the agency answers for it
          session.agencyName ? (
            <SettingsSection
              title="Your package"
              description={`${session.agencyName} holds the licence: it makes ${session.workspace.brandName}’s creatives with Fume. Ask ${session.agencyName} about the package and what it includes.`}
            >
              <DataList>
                <DataListItem label="Licence">{session.agencyName}</DataListItem>
                <DataListItem label="Creatives this period">{usage.creativesUsed}</DataListItem>
                <DataListItem label="Campaigns active">{usage.campaignsActive}</DataListItem>
              </DataList>
            </SettingsSection>
          ) : (
          <>
            <SettingsSection title="This period" description={usage.periodEndsAt ? `The package renews ${date(usage.periodEndsAt)}.` : "A one-off package: it does not renew."}>
              <ProgressField>
                <ProgressHead label="Creatives used" labelId="usage-label" num={`${usage.creativesUsed} / ${usage.creativeCap}`} />
                <Progress value={usage.creativesUsed} max={usage.creativeCap} aria-labelledby="usage-label" />
              </ProgressField>
              <DataList>
                <DataListItem label="Campaigns active">{usage.campaignsActive}</DataListItem>
                <DataListItem label="Creatives left">{Math.max(usage.creativeCap - usage.creativesUsed, 0)}</DataListItem>
              </DataList>
            </SettingsSection>
            <SettingsSection title="Your package" description="Fume’s own corrections never use a round.">
              <DataList>
                <DataListItem label="Package">{copy.packageName[pkg.kind]}</DataListItem>
                <DataListItem label="Creatives">
                  {pkg.creativeCap} {pkg.period === "monthly" ? "a month" : "in all"}
                </DataListItem>
                <DataListItem label="Rounds included">
                  {copy.count(pkg.directionRounds, "direction round")} and {copy.count(pkg.productionRounds, "round")} of changes per campaign
                </DataListItem>
                <DataListItem label="Period">{pkg.period === "monthly" ? "Monthly" : "One-off"}</DataListItem>
              </DataList>
              {isOwner(session) ? (
                <div className="ui-app-row">
                  <Button asChild variant="secondary" icon="message-square">
                    <Link to="/fume">Ask Fume about the package</Link>
                  </Button>
                </div>
              ) : (
                <p className="ui-app-section-text">The owner changes the package.</p>
              )}
            </SettingsSection>
          </>
          )
        )}
      </Query>
    </SettingsPane>
  );
}

// ─── Notifications ──────────────────────────────────────────────────────────

type Prefs = SettingsView["notificationPrefs"];

export function NotificationSettings() {
  const settings = useSettings();
  return (
    <SettingsPane title="Notifications" description="What Fume tells you, in the app and by email. These are yours alone.">
      <Query query={settings}>{(view) => <NotificationForm prefs={view.notificationPrefs} />}</Query>
    </SettingsPane>
  );
}

function NotificationForm({ prefs }: { prefs: Prefs }) {
  // The contract has no call to save these yet, so they are kept for this visit only (reported).
  const [saved, setSaved] = useState(prefs);
  const [value, setValue] = useState(prefs);
  const toast = useToast();
  const dirty = JSON.stringify(value) !== JSON.stringify(saved);
  const set = (kind: string, channel: "inApp" | "email", on: boolean) => setValue(value.map((p) => (p.kind === kind ? { ...p, [channel]: on } : p)));

  const rows = (channel: "inApp" | "email") =>
    value.map((p) => (
      <Choice key={p.kind} end>
        <ChoiceText label={p.label} />
        <Switch checked={p[channel]} onCheckedChange={(on) => set(p.kind, channel, on)} />
      </Choice>
    ));

  return (
    <SettingsForm
      dirty={dirty}
      onDiscard={() => setValue(saved)}
      onSubmit={() => {
        setSaved(value);
        toast.done("Notification settings saved");
      }}
    >
      <SettingsSection title="In Fume" description="The bell and the inbox.">
        <div className="ui-app-stack ui-app-stack--tight">{rows("inApp")}</div>
      </SettingsSection>
      <SettingsSection title="By email" description="To the email on your profile.">
        <div className="ui-app-stack ui-app-stack--tight">{rows("email")}</div>
      </SettingsSection>
    </SettingsForm>
  );
}

// ─── Profile ────────────────────────────────────────────────────────────────
// Round 13 (Marcus's video comment #49; PROPOSED 22 Oct 2026): her name, title and email are changed in place and
// saved, not asked of Fume. ProfileForm is the one profile, shared by every frame: the customer's Settings › Profile,
// Fume's people at /studio/settings/profile and an agency's at /agency/settings/profile (builder F links it).

const EMAIL = /^\S+@\S+\.\S+$/;

/** Name, title and email, edited in place; Save changes (or Discard) in the settings' save bar. `about` follows the
 *  fields: where the person works and what they can do there. */
export function ProfileForm({ user, about }: { user: User; about?: ReactNode }) {
  const saved = { name: user.name, title: user.title, email: user.email };
  const [value, setValue] = useState(saved);
  const [tried, setTried] = useState(false);
  const update = useUpdateProfile();
  const toast = useToast();
  // A save (or a change elsewhere) brings new saved values: the form follows them.
  useEffect(() => setValue(saved), [saved.name, saved.title, saved.email]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = value.name !== saved.name || value.title !== saved.title || value.email !== saved.email;
  const nameMissing = !value.name.trim();
  const emailWrong = !EMAIL.test(value.email.trim());

  const submit = (_: FormEvent<HTMLFormElement>) => {
    setTried(true);
    if (nameMissing || emailWrong) return;
    update.mutate(
      { name: value.name.trim(), title: value.title.trim(), email: value.email.trim() },
      {
        onSuccess: () => {
          setTried(false);
          toast.done("Profile saved");
        },
        onError: (error) => toast.error("Your profile wasn’t saved", { description: error.message }),
      },
    );
  };

  return (
    <SettingsForm
      dirty={dirty}
      saving={update.isPending}
      onDiscard={() => {
        setTried(false);
        setValue(saved);
      }}
      onSubmit={submit}
    >
      <SettingsSection title="You" description="Your name and title sign everything you decide in Fume.">
        <ItemGroup>
          <Item>
            <Person user={{ ...user, name: value.name.trim() || user.name }} />
            <ItemContent>
              <ItemTitle>{value.name.trim() || user.name}</ItemTitle>
              <ItemDescription>{value.title.trim() || user.title}</ItemDescription>
            </ItemContent>
          </Item>
        </ItemGroup>
        <FieldGroup>
          <Field invalid={tried && nameMissing}>
            <FieldLabel htmlFor="profile-name">Name</FieldLabel>
            <Input id="profile-name" autoComplete="name" value={value.name} aria-invalid={tried && nameMissing ? true : undefined} onChange={(e) => setValue({ ...value, name: e.target.value })} />
            {tried && nameMissing && <FieldError>Your name is needed: it signs what you decide.</FieldError>}
          </Field>
          <Field>
            <FieldLabel htmlFor="profile-title">Title</FieldLabel>
            <Input id="profile-title" autoComplete="organization-title" value={value.title} aria-describedby="profile-title-help" onChange={(e) => setValue({ ...value, title: e.target.value })} />
            <FieldDescription id="profile-title-help">Your real job title, shown with your name.</FieldDescription>
          </Field>
          <Field invalid={tried && emailWrong}>
            <FieldLabel htmlFor="profile-email">Email</FieldLabel>
            <Input
              id="profile-email"
              type="email"
              autoComplete="email"
              value={value.email}
              aria-invalid={tried && emailWrong ? true : undefined}
              aria-describedby="profile-email-help"
              onChange={(e) => setValue({ ...value, email: e.target.value })}
            />
            <FieldDescription id="profile-email-help">Where Fume’s emails go.</FieldDescription>
            {tried && emailWrong && <FieldError>That email address doesn’t look right.</FieldError>}
          </Field>
        </FieldGroup>
        {about}
      </SettingsSection>
    </SettingsForm>
  );
}

export function ProfileSettings({ session }: { session: Session }) {
  const { user, role, workspace } = session;
  return (
    <SettingsPane title="Profile" description="You, as Fume and your team see you.">
      <ProfileForm
        user={user}
        about={
          <DataList>
            <DataListItem label={`On ${workspace.brandName}`}>
              {role ? `${copy.role[role]}: ${copy.roleHelp[role].toLowerCase()}` : user.staffRole ? `Fume’s ${user.title.toLowerCase()}, in Fume view` : "Not on the team"}
            </DataListItem>
          </DataList>
        }
      />
    </SettingsPane>
  );
}
