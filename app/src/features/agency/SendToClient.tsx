// Send to client (FLOWS §24.5, §26.8). The agency's people never approve: once checked they send to the client, who
// approves in Fume or through the campaign's one client link. A right panel on a desk, a sheet on a phone: which
// creatives (checked ones, as tiles to leave out), who at the client is told (whoever approves comes first and is
// chosen), "Also make a client link" for someone without an account, and a note. The action names who it goes to: "Send
// to Maja", "Send to 2 people", or "Make the client link". With `plan` the panel sends the plan instead ("Send the plan
// to Maja"); sending it is the agency's check of it. ⌘↵ sends; Esc closes.
// Also here: the sends of a campaign as quiet rows ("Sent to Maja on 14 Oct · 6 creatives · client link until 13 Nov").
import {
  Button,
  Checkbox,
  Choice,
  ChoiceText,
  CreativeGrid,
  CreativeTile,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldOptional,
  FieldSet,
  Icon,
  Input,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Switch,
  Textarea,
  useToast,
} from "@fume/ui";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useSendToClient, useSession } from "../../api/hooks";
import type { Campaign, CampaignPlan, ClientSend, Creative, Id } from "../../contract";
import * as copy from "../../copy";
import { date } from "../../lib/time";
import { firstName } from "../../shell/people";
import { labelOf } from "../review/names";
import { clientRole, sendLine, useCampaignSends, useClientPeople, type ClientPerson } from "./clientFlow";

/** Copies the link; a browser that will not lets her select it herself. */
export function useCopyLink() {
  const toast = useToast();
  return (url: string) => {
    const failed = () => toast.error("The link wasn’t copied", { description: "Select it and copy it yourself." });
    try {
      if (!navigator.clipboard) return failed();
      navigator.clipboard.writeText(url).then(() => toast.done("Link copied", { meta: "30 days" }), failed);
    } catch {
      failed();
    }
  };
}

/** The tiles to choose from: a creative is in or out with a press on its picture (or its round corner). */
export function CreativeChoice({
  creatives,
  chosen,
  onChange,
  note,
  labelledBy,
}: {
  creatives: Creative[];
  chosen: Set<Id>;
  onChange: (next: Set<Id>) => void;
  note?: (c: Creative) => string | undefined;
  labelledBy: string;
}) {
  const toggle = (id: Id, on: boolean) => {
    const next = new Set(chosen);
    if (on) next.add(id);
    else next.delete(id);
    onChange(next);
  };
  return (
    <CreativeGrid className="ui-client-pick" aria-labelledby={labelledBy}>
      {creatives.map((c) => {
        const extra = note?.(c);
        return (
          <CreativeTile
            key={c.id}
            src={c.current.image}
            alt=""
            format={c.format}
            label={c.title}
            caption={extra ? `${labelOf(c)} · ${extra}` : labelOf(c)}
            selected={chosen.has(c.id)}
            onSelectedChange={(on) => toggle(c.id, on)}
          />
        );
      })}
    </CreativeGrid>
  );
}

/** "6 of 6 chosen", with the quiet way to choose all or none. */
function ChooseAll({ n, total, onAll, onNone }: { n: number; total: number; onAll: () => void; onNone: () => void }) {
  return (
    <span className="ui-client-pick-count">
      <span>
        {n} of {total} chosen
      </span>
      {total > 1 && (
        <Button type="button" variant="glass-clear" size="sm" onClick={n === total ? onNone : onAll}>
          {n === total ? "Choose none" : "Choose all"}
        </Button>
      )}
    </span>
  );
}

export interface SendToClientProps {
  campaign: Campaign;
  /** The checked creatives, under their customer names. */
  creatives: Creative[];
  /** Chosen when the panel opens (creative ids); by default the ones not sent yet, or all when every one was sent. */
  initial?: Id[];
  /** Send this plan instead of creatives (the agency's check of it); `creatives` is then empty. */
  plan?: CampaignPlan;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SendToClientSheet({ campaign, creatives, initial, plan, open, onOpenChange }: SendToClientProps) {
  const id = useId();
  const toast = useToast();
  const navigate = useNavigate();
  const send = useSendToClient();
  const copyLink = useCopyLink();
  const session = useSession().data;
  const brand = session?.workspace.brandName ?? "the client";
  const { people, loading: peopleLoading } = useClientPeople();
  const { sendOf, who, loading: sendsLoading } = useCampaignSends(campaign.id, true);
  const ready = !peopleLoading && !sendsLoading;
  const chose = useRef(false);
  const [chosen, setChosen] = useState<Set<Id>>(new Set());
  const [to, setTo] = useState<Set<Id>>(new Set());
  const [link, setLink] = useState(false);
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);
  const [sent, setSent] = useState<ClientSend | null>(null);

  // Each time it opens, once the sends and the people are known: what was not sent yet (or all), whoever approves this
  // campaign, no link (unless no one at the client is in Fume), no note.
  useEffect(() => {
    if (!open) {
      chose.current = false;
      return;
    }
    if (!ready || chose.current) return;
    chose.current = true;
    const fresh = creatives.filter((c) => !sendOf(c.current.id)).map((c) => c.id);
    setChosen(new Set(initial ?? (fresh.length ? fresh : creatives.map((c) => c.id))));
    const approver = people.find((p) => p.user.id === campaign.approverId) ?? people.find((p) => p.approves);
    setTo(new Set(approver ? [approver.user.id] : []));
    setLink(people.length === 0);
    setNote("");
    setTried(false);
    setSent(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ready]);
  // The people arrive after the panel opened (a cold page): whoever approves is chosen then.
  useEffect(() => {
    if (!open || sent || to.size || tried) return;
    const approver = people.find((p) => p.user.id === campaign.approverId) ?? people.find((p) => p.approves);
    if (approver) setTo(new Set([approver.user.id]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people.length]);

  const picked = creatives.filter((c) => chosen.has(c.id));
  const names = people.filter((p) => to.has(p.user.id));
  const noCreative = tried && picked.length === 0 && !plan;
  const noOne = tried && names.length === 0 && !link;
  const submitWords =
    names.length === 1
      ? copy.send.action(firstName(names[0]!.user.name))
      : names.length > 1
        ? `Send to ${names.length} people`
        : "Make the client link";
  const whoWords =
    names.length === 1
      ? firstName(names[0]!.user.name)
      : names.length > 1
        ? `${names.length} people at ${brand}`
        : brand;
  /** The panel's name: the campaign's approver at the client, as the review's Ink says it ("Send to Maja"). */
  const approverPerson = people.find((p) => p.user.id === campaign.approverId) ?? people.find((p) => p.approves);
  const title = plan
    ? `Send the plan to ${approverPerson ? firstName(approverPerson.user.name) : brand}`
    : approverPerson
      ? copy.send.action(firstName(approverPerson.user.name))
      : `Send to ${brand}`;
  // The plan in one row: its version, the direction and what Fume makes in it.
  const direction = plan
    ? (plan.directions.find((d) => d.id === plan.chosenDirectionId) ?? plan.directions[0])
    : undefined;
  const planMasters = direction?.creatives.filter((c) => c.kind === "master").length ?? 0;
  const planRest = (direction?.creatives.length ?? 0) - planMasters;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (send.isPending) return;
    if ((!picked.length && !plan) || (!names.length && !link)) {
      setTried(true);
      return;
    }
    void send
      .mutateAsync({
        campaignId: campaign.id,
        versionIds: plan ? [] : picked.map((c) => c.current.id),
        to: names.map((p) => p.user.id),
        link,
        note: note.trim() || undefined,
        plan: Boolean(plan),
      })
      .then(
        (s) => {
          toast.done(names.length ? `Sent to ${whoWords}` : "Client link made", {
            description: [
              s.plan ? `The plan, version ${s.plan.version}` : copy.creatives(s.versionIds.length),
              ...(s.link ? [`client link until ${date(s.link.expiresAt)}`] : []),
            ].join(" · "),
          });
          if (s.link) setSent(s);
          else onOpenChange(false);
        },
        (err: Error) => toast.error("Nothing was sent", { description: err.message }),
      );
  };

  const togglePerson = (p: ClientPerson, on: boolean) => {
    const next = new Set(to);
    if (on) next.add(p.user.id);
    else next.delete(p.user.id);
    setTo(next);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="lg">
        {sent?.link ? (
          <>
            <SheetHeader>
              <SheetTitle>{sent.to.length ? `Sent to ${whoWords}` : "The client link is ready"}</SheetTitle>
              <SheetDescription>
                {sent.to.length
                  ? `${whoWords === brand ? "They have" : `${whoWords} has`} ${sent.plan ? "the plan" : `the ${copy.creatives(sent.versionIds.length)}`} in Fume. `
                  : ""}
                {sent.plan
                  ? `The client link opens the plan, with Approve and Ask for changes, until ${date(sent.link.expiresAt)}. The creatives come in the same link.`
                  : `The client link opens only these, with Approve and Ask for changes, until ${date(sent.link.expiresAt)}.`}
              </SheetDescription>
            </SheetHeader>
            <SheetBody>
              <div className="ui-client-linkbox">
                <Field>
                  <FieldLabel htmlFor={`${id}-url`}>Client link</FieldLabel>
                  <Input id={`${id}-url`} readOnly value={sent.link.url} onFocus={(e) => e.currentTarget.select()} />
                  <FieldDescription>
                    Anyone with the link can approve {sent.plan ? "the plan" : "these creatives"} or ask for changes. No
                    account needed.
                  </FieldDescription>
                </Field>
                <div className="ui-app-row">
                  <Button
                    variant="glass-white"
                    icon="copy"
                    data-ui-autofocus=""
                    onClick={() => copyLink(sent.link!.url)}
                  >
                    Copy the link
                  </Button>
                  <Button variant="glass-clear" icon="external-link" onClick={() => navigate(`/c/${sent.link!.token}`)}>
                    Open the link
                  </Button>
                </div>
              </div>
            </SheetBody>
            <SheetFooter>
              <SheetClose asChild>
                <Button variant="glass-clear">Done</Button>
              </SheetClose>
            </SheetFooter>
          </>
        ) : (
          <form className="ui-sheet-form" onSubmit={submit} noValidate>
            <SheetHeader>
              <SheetTitle>{title}</SheetTitle>
              <SheetDescription>
                {plan
                  ? names.length === 1
                    ? `${whoWords} gets the plan in Fume and approves it there. Fume starts on the masters once she does.`
                    : names.length > 1
                      ? `They are told in Fume; whoever approves for ${brand} approves the plan there.`
                      : `Make a client link for someone at ${brand} without an account.`
                  : names.length === 1
                    ? `${whoWords} gets them in Fume and approves them there.`
                    : names.length > 1
                      ? `They are told in Fume; whoever approves for ${brand} approves them there.`
                      : `Make a client link for someone at ${brand} without an account.`}{" "}
                {plan
                  ? "Sending it is your check; only the client approves the plan."
                  : "Only the client approves a creative."}
              </SheetDescription>
            </SheetHeader>
            <SheetBody>
              <FieldGroup>
                {plan ? (
                  <ItemGroup aria-label="What you send">
                    <Item size="sm" variant="outline">
                      <ItemMedia variant="icon">
                        <Icon name="file-text" />
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle>The plan · version {plan.version}</ItemTitle>
                        <ItemDescription>
                          {[
                            direction ? `Direction ${direction.letter} · ${direction.name}` : "",
                            planMasters
                              ? `${copy.count(planMasters, "master")}${planRest ? ` and ${planRest} more` : ""}`
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </ItemDescription>
                      </ItemContent>
                    </Item>
                  </ItemGroup>
                ) : (
                  <FieldSet>
                    <FieldLegend className="ui-client-legend">
                      <span id={`${id}-creatives`}>Creatives</span>
                      <ChooseAll
                        n={picked.length}
                        total={creatives.length}
                        onAll={() => setChosen(new Set(creatives.map((c) => c.id)))}
                        onNone={() => setChosen(new Set())}
                      />
                    </FieldLegend>
                    <CreativeChoice
                      creatives={creatives}
                      chosen={chosen}
                      onChange={setChosen}
                      labelledBy={`${id}-creatives`}
                      note={(c) => {
                        const s = sendOf(c.current.id);
                        return s ? `with ${who(s)}` : undefined;
                      }}
                    />
                    {noCreative && <FieldError>Choose at least one creative to send.</FieldError>}
                  </FieldSet>
                )}

                <FieldSet>
                  <FieldLegend>Who at {brand}</FieldLegend>
                  {people.length === 0 ? (
                    <FieldDescription>No one at {brand} is in Fume yet. Make a client link below.</FieldDescription>
                  ) : (
                    <div className="ui-app-stack ui-app-stack--tight">
                      {people.map((p) => (
                        <Choice key={p.user.id}>
                          <Checkbox
                            checked={to.has(p.user.id)}
                            onCheckedChange={(on) => togglePerson(p, on === true)}
                          />
                          <ChoiceText
                            label={p.user.name}
                            hint={[clientRole(p), p.user.title].filter(Boolean).join(" · ")}
                          />
                        </Choice>
                      ))}
                    </div>
                  )}
                  <Choice end>
                    <ChoiceText
                      label="Also make a client link"
                      hint={
                        plan
                          ? "Opens the plan, with Approve and Ask for changes; the creatives come in the same link later. Expires in 30 days."
                          : "Opens only these creatives, with Approve and Ask for changes. Expires in 30 days."
                      }
                    />
                    <Switch glass checked={link} onCheckedChange={setLink} />
                  </Choice>
                  {noOne && <FieldError>Choose who at {brand} is told, or make a client link.</FieldError>}
                </FieldSet>

                <Field>
                  <FieldLabel htmlFor={`${id}-note`}>
                    A note <FieldOptional />
                  </FieldLabel>
                  <Textarea
                    id={`${id}-note`}
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={
                      plan
                        ? "Window light, as we said. Tell me if the candle should go."
                        : "The story frames follow on Friday."
                    }
                  />
                </Field>
              </FieldGroup>
            </SheetBody>
            <SheetFooter>
              <SheetClose asChild>
                <Button variant="glass-clear">Later</Button>
              </SheetClose>
              <Button type="submit" variant="glass-white" icon="send" loading={send.isPending}>
                {submitWords}
              </Button>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** What was sent of a campaign, newest first: one quiet row each, with the client link's two actions. */
export function ClientSends({ campaignId, titleId }: { campaignId: Id; titleId: string }) {
  const navigate = useNavigate();
  const copyLink = useCopyLink();
  const { sends, who } = useCampaignSends(campaignId, true);
  if (!sends.length) return null;
  return (
    <ItemGroup as="ul" aria-labelledby={titleId} className="ui-client-sends">
      {sends.map((s) => (
        <Item key={s.id} as="li" size="sm">
          <ItemMedia variant="icon">
            <Icon name={s.link ? "link" : "send"} />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{sendLine(s, who(s), date)}</ItemTitle>
            {s.note && <ItemDescription>“{s.note}”</ItemDescription>}
          </ItemContent>
          {s.link && (
            <ItemActions>
              <Button
                variant="quiet"
                size="sm"
                iconOnly
                icon="copy"
                aria-label="Copy the link"
                onClick={() => copyLink(s.link!.url)}
              />
              <Button
                variant="quiet"
                size="sm"
                iconOnly
                icon="external-link"
                aria-label="Open the link"
                onClick={() => navigate(`/c/${s.link!.token}`)}
              />
            </ItemActions>
          )}
        </Item>
      ))}
    </ItemGroup>
  );
}
