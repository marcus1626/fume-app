// The conversation's parts: one message in its author's voice, and the cards a message carries (FLOWS §12: one
// conversation, campaigns appear in it as cards).
// People speak in bubbles; Fume and the Engine write plain text under their names (message.css). A card is what
// Fume shows besides words: the brief, the directions, an Engine run, a question, or checked creatives.
// Round 9 (PROPOSED 19 Oct 2026): the brief card shows the whole brief in the one order and names (DTSK-4, DLOAD-10),
// and becomes one line when the brief panel beside the conversation shows it (desk.tsx); the run card speaks her
// words and its pill names the step under way (DLOAD-11, DLOAD-2); her own name is "you" (DLOAD-18); a product is
// confirmed in the one product panel (CHECK's ProductCheckHost, decision 5); "check" is the expert's word (DLOAD-1).
// Round 10 (PROPOSED 20 Oct 2026, FLOWS §22–§23): she SENDS the brief ("Send to Fume"), never approves it; a sent brief
// is one line; the plan card (plan.tsx) shows the plan as it is now, and only the campaign's latest one is drawn whole.
// Round 12 AGENCY (UX review DLOAD-6; PROPOSED 20 Oct 2026): a person's tag comes from the person: "Fume" only for
// Fume's people, the agency's name for the agency's (Nora, Sindre: "Brygga Studio"), and her own messages are hers
// ("You", at the end), never a staff header with a tag.
import {
  Attachment,
  Avatar,
  Badge,
  AttachmentGroup,
  attachmentMeta,
  Bubble,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  EngineRun,
  EngineRunBadge,
  Icon,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemMediaImage,
  ItemTitle,
  Marker,
  Message,
  MessageContent,
  MessageHeader,
  MessageText,
  PickGrid,
  ProductSheetButton,
  ProductTile,
  useToast,
  type EngineRunState,
  type EngineRunStepData,
} from "@fume/ui";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useCatalogue, useMeetings, useSendBrief, useSession } from "../../api/hooks";
import type { CampaignView, Id, Message as FumeMessage, MessageCard, ProductQuestionCard, User } from "../../contract";
import * as copy from "../../copy";
import { date, dayGroup, time } from "../../lib/time";
import { directory, firstName, initials, sign } from "../../shell/people";
import { runProps } from "../shared/creatives";
import { useOpenProductCheck } from "../check/ProductCheckHost";
import { briefGaps } from "../campaigns/brief-lines";
import { BriefRowsList, useBriefRows } from "./desk";
import { onDay, PlanCard, planHref } from "./plan";
import { QuestionSheet, useOpenQuestions } from "../questions/QuestionSheet";
import { AllProductsSheet, confirmed } from "./AllProducts";
import { osloDay, slotLabel, SlotForm } from "./meeting";
import { ChatThumbs, LinkCard, SummaryCard } from "./panel";

type People = ReturnType<typeof directory>;

/** "Today", "Yesterday", or the date: the day markers in a conversation. */
export function dayLabel(iso: string): string {
  const group = dayGroup(iso);
  return group === "Earlier" ? date(iso) : group;
}

export interface MessageViewProps {
  message: FumeMessage;
  people: People;
  meId: string;
  /** The thread's campaign, for the cards that show its brief, run or creatives. */
  view?: CampaignView;
  /** Shows a question's options as buttons; only on the latest message, for someone who can write. */
  onAnswer?: (answer: string) => void;
  /** Links that lead to a decision (review the creatives); hidden for a viewer. */
  canAct: boolean;
  /** The message's anchor (round 8, WAY-5): the chat comes back to it, and reveals a new answer from it. */
  anchorId?: string;
  /** The time beside the name: once per burst of talk, not on every message (LOAD-19). Default true. */
  showTime?: boolean;
  /** She pressed Send on the brief's card: the chat shows Fume's next line, and the composer takes the focus.
   *  Called as the brief goes out, since Fume's next line can arrive with it. */
  onSend?: () => void;
  /** Round 9: the brief panel beside the conversation shows this campaign's brief, so its card is one line. */
  briefInPanel?: boolean;
  /** Round 10: the panel beside the conversation shows this campaign's plan, so its plan card is one line. */
  planInPanel?: boolean;
  /** Round 10: this is the campaign's latest plan card; an earlier one is one line. Default true. */
  latestPlan?: boolean;
  /** Round 13 (#19): her answer to this card's product question, which the chat does not repeat as her bubble: the
   *  card shows the products it names instead. */
  answeredWith?: string;
}

/** One message in its author's voice, with what it carries. */
export function MessageView({ message, people, meId, view, onAnswer, canAct, anchorId, showTime = true, onSend, briefInPanel, planInPanel, latestPlan, answeredWith }: MessageViewProps) {
  const { author } = message;
  const user = author.kind === "person" ? people.user(author.userId) : undefined;
  const mine = author.kind === "person" && author.userId === meId;
  const session = useSession().data;
  // The Engine never talks (F-D040): what it posts shows as its run card alone, with no name or chat line of its own.
  // No campaign name inside the card: the conversation (or the marker above it on a phone) names it (DLOAD-11).
  if (author.kind === "engine") {
    const run = message.card?.kind === "run" ? view?.runs.find((r) => r.id === (message.card as { runId: string }).runId) : undefined;
    return run ? (
      <Message id={anchorId}>
        <MessageContent>
          <EngineRun {...runForCustomer(runProps(run), people.name(meId))} />
        </MessageContent>
      </Message>
    ) : (
      <Marker id={anchorId} icon="fume-engine">The Engine is at work: {message.text.charAt(0).toLowerCase() + message.text.slice(1)}</Marker>
    );
  }
  // Fume hands the conversation to a person (FLOWS §21): one quiet line with their face and the reason, not a speech.
  if (message.card?.kind === "handover") return <HandoverLine card={message.card} people={people} at={message.at} id={anchorId} />;
  // A person at Fume answering in the conversation: their name, face and a Fume tag, so it is clear a human answered.
  const staffer = author.kind === "person" && Boolean(user?.staffRole) && !mine;
  const org = user?.agency ? (session?.agency?.organisation.name ?? session?.agencyName ?? "Agency") : "Fume";
  // Fume's words that only repeat its card's question ("Who should it reach?") are said once, by the card (LOAD-19).
  const echo = message.card?.kind === "question" && message.text.trim().replace(/[?.]$/, "") === message.card.question.trim().replace(/[?.]$/, "");
  return (
    <Message id={anchorId} align={mine ? "end" : "start"} className={staffer ? "ui-chat-staff" : undefined}>
      {staffer && user ? (
        <div className="ui-message-header">
          <Avatar size="sm" className="ui-message-avatar" src={user.avatar} initials={initials(user.name)} ink={user.staffRole === "expert"} aria-hidden="true" />
          <span className="ui-message-name">{people.author(author)}</span>
          <Badge variant="secondary" className="ui-chat-staff-tag">
            {org}
          </Badge>
          <span className="ui-message-role">{user.title}</span>
          {showTime && (
            <time className="ui-message-time" dateTime={message.at}>
              {time(message.at)}
            </time>
          )}
        </div>
      ) : (
        <MessageHeader
          author={author.kind}
          person={author.kind === "person" ? sign(user) : undefined}
          name={mine ? "You" : author.kind === "person" ? people.author(author) : undefined}
          role={user?.staffRole && !mine ? user.title : undefined}
          time={showTime ? time(message.at) : undefined}
          dateTime={message.at}
        />
      )}
      <MessageContent>
        {author.kind === "person" ? <Bubble>{message.text}</Bubble> : !echo && <MessageText>{message.text}</MessageText>}
        {message.attachments && message.attachments.length > 0 && (
          <AttachmentGroup>
            {message.attachments.map((a) => (
              <Attachment
                key={a.id}
                size="sm"
                title={a.name}
                meta={attachmentMeta(a.name, a.bytes)}
                media={a.thumbnail ? { kind: "image", src: a.thumbnail, alt: a.name } : { kind: "icon" }}
              />
            ))}
          </AttachmentGroup>
        )}
        {message.card && (
          <CardView
            card={message.card}
            people={people}
            meId={meId}
            view={view}
            onAnswer={onAnswer}
            canAct={canAct}
            messageId={message.id}
            onSend={onSend}
            briefInPanel={briefInPanel}
            planInPanel={planInPanel}
            latestPlan={latestPlan}
            answeredWith={answeredWith}
          />
        )}
      </MessageContent>
    </Message>
  );
}

/** The brief in the conversation: what Fume filled in, and one step. A ready brief is sent right here by an owner or
 *  approver (UX review C1; round 10: "Send to Fume", never "Approve the brief"), by the same rule as the plan page's
 *  brief (briefGaps, TASK-2) and with every line in the one order and names (DTSK-4, DLOAD-10). With the brief panel
 *  beside the conversation (a desk from 1280 px) the card is one line that points to it: one Send, in the panel. A
 *  sent brief is one line: Fume writes the plan from it, and the plan card follows. */
function BriefCard({ campaignId, view, people, meId, canAct, onSend, inPanel }: { campaignId: string; view?: CampaignView; people: People; meId: Id; canAct: boolean; onSend?: () => void; inPanel?: boolean }) {
  const role = useSession().data?.role;
  const send = useSendBrief();
  const toast = useToast();
  const rows = useBriefRows(view);
  const brief = view?.brief;
  const campaign = view?.campaign;
  // A brief that covers no product cannot be sent (walk-through Must 2): Fume makes creatives of real products.
  const covers = (campaign?.productIds.length ?? 0) + (campaign?.collectionIds?.length ?? 0);
  const gaps = brief ? briefGaps(brief) : [];
  const maySend = canAct && (role === "owner" || role === "approver");
  const canSend = maySend && brief?.state === "ready" && brief.missing.length === 0 && gaps.length === 0 && covers > 0;
  // The brief is fixed at the version she sent (the backend keeps its word "approved" for it).
  const sent = brief?.state === "approved";
  const by = brief?.approvedBy ? (brief.approvedBy === meId ? "You" : people.name(brief.approvedBy)) : undefined;
  const sentWords = `${by ?? "Someone"} sent it${brief?.approvedAt ? ` ${onDay(brief.approvedAt)}` : ""}`;
  if (sent)
    return (
      <Item variant="outline" size="sm" asChild>
        <Link to={planHref(campaignId)}>
          <ItemMedia variant="icon">
            <Icon name="file-text" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>The brief</ItemTitle>
            <ItemDescription>{sentWords}. Fume writes the plan from it.</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Icon name="chevron-right" />
          </ItemActions>
        </Link>
      </Item>
    );
  const state = !brief
    ? undefined
    : gaps.length && brief.state !== "drafting"
      ? `Needs the ${gaps.map((g) => g.toLowerCase()).join(" and the ")}`
      : brief.state === "ready" && !maySend
        ? `${view?.approver ? people.name(view.approver.id) : "The approver"} sends it to Fume`
        : briefState[brief.state as keyof typeof briefState];
  if (inPanel)
    return (
      <Item variant="muted" size="sm">
        <ItemMedia variant="icon">
          <Icon name="file-text" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>The brief</ItemTitle>
          <ItemDescription>It is on the right, line by line. Change any line there, then send it to Fume.</ItemDescription>
        </ItemContent>
      </Item>
    );
  return (
    <Card>
      <CardHeader>
        <CardTitle as="p">The brief</CardTitle>
        {state && <CardDescription>{state}</CardDescription>}
      </CardHeader>
      {brief && (
        <CardContent>
          <BriefRowsList rows={rows} />
        </CardContent>
      )}
      <CardFooter>
        <div className="ui-app-stack ui-app-stack--tight">
          {canSend && <p className="ui-chat-card-note">Fume writes the plan from it. You approve the plan before anything is made.</p>}
          <div className="ui-app-row">
            {canSend && (
              <Button
                size="sm"
                icon="send"
                loading={send.isPending}
                onClick={() => {
                  onSend?.();
                  // mutateAsync: the card turns into one line as the brief is sent, and the toast still comes.
                  send.mutateAsync(campaignId).then(
                    () => toast.done("Sent to Fume.", { description: "Fume is writing the plan. Nothing is made before you approve it." }),
                    (e: Error) => toast.error("The brief wasn’t sent", { description: e.message }),
                  );
                }}
              >
                Send to Fume
              </Button>
            )}
            <Button asChild variant="secondary" size="sm" iconEnd="arrow-right">
              <Link to={planHref(campaignId)}>{canSend ? "Change a line" : "Open the brief"}</Link>
            </Button>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}

/** "Masters 1 and 2 approved by Maja" → "You approved the first 2 creatives": a run's lines in her words, no system
 *  words (DLOAD-11), and its pill naming the step under way, "Anna is checking · 6 of 9"; "Done" only when every line
 *  is done (DLOAD-2). `me` is her first name. Exported so the campaign page can say the same. */
export function runForCustomer<T extends { state: EngineRunState; steps: EngineRunStepData[] }>(run: T, me: string): T & { badge?: ReactNode } {
  const words = (label: ReactNode): ReactNode => {
    if (typeof label !== "string") return label;
    const gate = /^Quality Gate: (\S+) checks each (creative|direction|master)s?$/.exec(label);
    if (gate) return `${gate[1]} checks each one`;
    if (/^Variants and (channel )?formats$/i.test(label)) return "Sizes and formats made";
    const masters = /^Masters? ([\d, and]+) approved by (\S+)$/.exec(label);
    if (masters) {
      const n = masters[1].match(/\d+/g)?.length ?? 1;
      return `${masters[2] === me ? "You" : masters[2]} approved the first ${copy.creatives(n)}`;
    }
    return label;
  };
  const steps = run.steps.map((s) => ({ ...s, label: words(s.label) }));
  const open = steps.find((s) => s.state !== "done");
  if (!open || !["running", "done", "queued"].includes(run.state)) return { ...run, steps };
  const original = run.steps[steps.indexOf(open)]?.label;
  const gate = typeof original === "string" ? /^Quality Gate: (\S+)/.exec(original) : null;
  const count = open.progress ? ` · ${open.progress.made} of ${open.progress.total}` : "";
  const label = gate ? (open.state === "waiting" ? `Waiting for ${gate[1]}` : `${gate[1]} is checking${count}`) : `Under way${count}`;
  return { ...run, steps, badge: <EngineRunBadge state="running" label={label} /> };
}

/** A day marker between messages. */
export function DayMarker({ label }: { label: string }) {
  return <Marker variant="separator">{label}</Marker>;
}

const briefState = { drafting: "Being drafted", ready: "Ready to send" } as const;

function CardView({
  card,
  people,
  meId,
  view,
  onAnswer,
  canAct,
  messageId,
  onSend,
  briefInPanel,
  planInPanel,
  latestPlan,
  answeredWith,
}: {
  card: MessageCard;
  people: People;
  meId: Id;
  view?: CampaignView;
  onAnswer?: (answer: string) => void;
  canAct: boolean;
  messageId: string;
  onSend?: () => void;
  briefInPanel?: boolean;
  planInPanel?: boolean;
  latestPlan?: boolean;
  answeredWith?: string;
}) {
  switch (card.kind) {
    // Round 13 (#16): Fume's answer about something the app knows opens it beside the conversation; what waits on
    // her and the month read the same sources as Home.
    case "link":
      return <LinkCard link={card.link} />;
    case "summary":
      return <SummaryCard of={card.of} />;
    case "handover":
      return null;
    case "meeting":
      return card.meetingId ? <MeetingBooked meetingId={card.meetingId} people={people} /> : <MeetingOffer slots={card.slots} topic={card.topic} canAct={canAct} idBase={`offer-${messageId}`} />;
    case "brief":
      return <BriefCard campaignId={card.campaignId} view={view} people={people} meId={meId} canAct={canAct} onSend={onSend} inPanel={briefInPanel} />;
    case "plan":
      return <PlanCard campaignId={card.campaignId} latest={latestPlan} inPanel={planInPanel} />;
    case "directions": {
      const chosen = view?.directions.find((d) => d.state === "chosen");
      return (
        <Item variant="outline" asChild>
          {/* The chosen direction lands on the directions themselves, not on the tab above them (WAY-19). */}
          <Link to={chosen ? `/campaigns/${card.campaignId}/creatives#campaign-directions` : `/campaigns/${card.campaignId}/review`}>
            <ItemMedia variant="icon">
              <Icon name="columns-2" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{chosen ? `Direction ${chosen.letter}, ${chosen.name}` : "The directions"}</ItemTitle>
              <ItemDescription>
                {chosen
                  ? `Chosen by ${chosen.decidedBy === meId ? "you" : people.name(chosen.decidedBy)}`
                  : view
                    ? `${copy.count(view.directions.length, "direction")} to choose from`
                    : "Pick one to take forward"}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Icon name="chevron-right" />
            </ItemActions>
          </Link>
        </Item>
      );
    }
    case "run": {
      const run = view?.runs.find((r) => r.id === card.runId);
      return run ? <EngineRun {...runForCustomer(runProps(run), people.name(meId))} /> : null;
    }
    case "question":
      if (card.productIds?.length) return <ProductQuestion card={card} onAnswer={onAnswer} answeredWith={answeredWith} campaignName={view?.campaign.name} />;
      return <TextQuestion card={card} view={view} onAnswer={onAnswer} canAct={canAct} />;
    case "creatives": {
      // Round 13 (#14): small tiles, four at most and then +N; a tile opens the creative beside the conversation (on a
      // phone, the one viewer, whose close goes back into the chat, WAY-5).
      const shown = (view?.creatives ?? []).filter((c) => card.creativeIds.includes(c.id));
      if (shown.length === 0) return null;
      const waiting = shown.some((c) => c.current.state === "checked");
      return (
        <div className="ui-app-stack ui-app-stack--tight">
          <ChatThumbs creatives={shown} campaignId={card.campaignId} />
          {canAct && waiting && (
            <div className="ui-app-row">
              <Button asChild variant="secondary" size="sm" iconEnd="arrow-right">
                <Link to={`/campaigns/${card.campaignId}/review`}>Review them</Link>
              </Button>
            </div>
          )}
        </div>
      );
    }
  }
}

/** Why someone cannot write to Fume, or undefined when they can. */
export function cannotWrite(role: string | null, staff: boolean, owner: User | undefined): string | undefined {
  if (staff) return undefined;
  if (role === "viewer") return `Viewers read the conversation. ${owner ? `Ask ${owner.name}` : "Ask the owner"} for Can comment to write to Fume.`;
  if (role === null) return "You are not on this workspace’s team, so you can read the conversation but not write in it.";
  return undefined;
}

/** "Sander at Fume will answer you here": who takes over, and why Fume handed it on. */
function HandoverLine({ card, people, at, id }: { card: Extract<MessageCard, { kind: "handover" }>; people: People; at: string; id?: string }) {
  const user = people.user(card.userId);
  const name = firstName(user?.name ?? "Someone");
  return (
    <div className="ui-handover" role="note" id={id}>
      <Avatar size="sm" src={user?.avatar} initials={initials(user?.name ?? "?")} ink={user?.staffRole === "expert"} aria-hidden="true" />
      <div className="ui-handover-text">
        <p className="ui-handover-title">{name} at Fume will answer you here</p>
        <p className="ui-handover-why">
          {card.reason}{" "}
          <time dateTime={at} className="ui-handover-time">
            {time(at)}
          </time>
        </p>
      </div>
    </div>
  );
}

/** Fume offers times. Once one of them is booked, the card says so instead of offering again. */
function MeetingOffer({ slots, topic, canAct, idBase }: { slots: string[]; topic?: string; canAct: boolean; idBase: string }) {
  const meetings = useMeetings();
  const booked = (meetings.data ?? []).find((m) => m.state === "booked" && slots.includes(m.at));
  if (booked)
    return (
      <p className="ui-meeting-note">
        You booked {slotLabel(booked.at)}. <Link to={`/calendar?d=${osloDay(booked.at)}`}>See it in the calendar</Link>
      </p>
    );
  if (!canAct) return <p className="ui-meeting-note">Times offered: {slots.map(slotLabel).join(" · ")}</p>;
  return (
    <Card className="ui-meeting-card">
      <CardContent>
        <SlotForm slots={slots} idBase={idBase} topic={topic} quiet />
      </CardContent>
    </Card>
  );
}

/** A booked meeting: what, when, with whom, and where it is now. */
function MeetingBooked({ meetingId, people }: { meetingId: string; people: People }) {
  const meetings = useMeetings();
  const meeting = meetings.data?.find((m) => m.id === meetingId);
  if (!meeting) return null;
  const host = people.user(meeting.hostId);
  return (
    <Item variant="outline" asChild>
      <Link to={`/calendar?d=${osloDay(meeting.at)}`}>
        <ItemMedia variant="icon">
          <Icon name="calendar" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{meeting.topic}</ItemTitle>
          <ItemDescription>
            {slotLabel(meeting.at)} · {meeting.minutes} min{host ? ` with ${firstName(host.name)} at Fume` : ""}
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Icon name="chevron-right" />
        </ItemActions>
      </Link>
    </Item>
  );
}

/** A question in words. One Fume has on record (a product's claims, a packshot) is answered in the one shared sheet,
 *  so answering it here closes it on Home, the product and the brief too (round 8 decision, LOAD-4); the brief's own
 *  questions keep their option pills, on the latest message only. */
function TextQuestion({ card, view, onAnswer, canAct }: { card: Extract<MessageCard, { kind: "question" }>; view?: CampaignView; onAnswer?: (answer: string) => void; canAct: boolean }) {
  const [open, setOpen] = useState(false);
  const record = useOpenQuestions().questions.find((q) => q.question === card.question && (!view || !q.campaignId || q.campaignId === view.campaign.id));
  return (
    <Card className={onAnswer ? "ui-chat-ask" : undefined}>
      <CardHeader>
        <CardTitle as="p">{card.question}</CardTitle>
        <CardDescription>Why Fume asks: {record?.why ?? card.why}</CardDescription>
      </CardHeader>
      {record && canAct ? (
        <CardFooter>
          <div className="ui-app-row">
            <Button size="sm" iconEnd="arrow-right" onClick={() => setOpen(true)}>
              Answer
            </Button>
          </div>
          <QuestionSheet questionId={record.id} open={open} onOpenChange={setOpen} />
        </CardFooter>
      ) : (
        onAnswer &&
        card.options &&
        card.options.length > 0 && (
          <CardFooter>
            <div className="ui-app-row" role="group" aria-label={card.question}>
              {card.options.map((option) => (
                <Button key={option} variant="secondary" size="sm" onClick={() => onAnswer(option)}>
                  {option}
                </Button>
              ))}
            </div>
          </CardFooter>
        )
      )}
    </Card>
  );
}

/** Fume asks for the product (walk-through Must 2; round 8, TASK-1 and TASK-10). A product she named that waits to be
 *  confirmed is the card's first line, with what to do in words ("Confirm details"), not a cut badge and an ambiguous
 *  "Confirm". Round 9 (decision 5, DTSK-6): the details are confirmed in the one product panel (CHECK's
 *  ProductCheckHost: photo, the one question first, the lines), beside the conversation on a desk; once every product
 *  she named is confirmed, that is her answer and Fume moves on, so nothing has to be ticked again. Under it, the
 *  ready products to tick, "View all products" for the whole catalogue, and one button that answers. */
function ProductQuestion({ card, onAnswer, answeredWith, campaignName }: { card: ProductQuestionCard; onAnswer?: (answer: string) => void; answeredWith?: string; campaignName?: string }) {
  const catalogue = useCatalogue().data;
  const [ticked, setTicked] = useState<string[]>([]);
  const [all, setAll] = useState(false);
  // The one place a product is confirmed from the chat (?check=<id>, so Back closes it).
  const openCheck = useOpenProductCheck();
  // Round 13 (robot note 02): the panel names the campaign she is briefing ("Christmas waits on it").
  const confirm = (id: string) => openCheck(id, { over: "conversation", onConfirmed: confirmedHere, forCampaign: campaignName });
  // Confirmed here, before the catalogue has caught up.
  const [done, setDone] = useState<string[]>([]);
  const named = card.named ?? [];
  // In the order Fume offers them: the products named first.
  const products = (card.productIds ?? []).map((id) => catalogue?.products.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => Boolean(p));
  const ok = (p: (typeof products)[number]) => confirmed(p) || done.includes(p.id);
  const ready = products.filter(ok);
  const waiting = products.filter((p) => !ok(p));
  // The named products that wait; with nothing ready at all, the first few that wait, so there is a way on.
  const named_ = waiting.filter((p) => named.includes(p.id));
  const rows = named_.length ? named_ : ready.length ? [] : waiting.slice(0, 3);
  // A few ready tiles, plus any picked in the sheet beyond them; the order never moves under a tap.
  const tiles = ready.filter((p, i) => i < 6 || ticked.includes(p.id));
  const picked = products.filter((p) => ticked.includes(p.id));
  // Round 13 (#18, "Kan collections komme opp her?"): her collections that hold ready products; ticking one ticks
  // them all, and it shows ticked while every one of them is.
  const collections = (catalogue?.collections ?? [])
    .map((c) => ({ c, ids: c.productIds.filter((id) => ready.some((p) => p.id === id)) }))
    .filter((x) => x.ids.length > 0);
  const tickAll = (ids: string[], on: boolean) => setTicked((l) => (on ? [...new Set([...l, ...ids])] : l.filter((x) => !ids.includes(x))));
  // Round 13 (#19): once she answered, the card shows what she picked, on Fume's side; her answer is not repeated as a
  // bubble of hers (FumePage leaves it out).
  const chosen = answeredWith
    ? answeredWith
        .split(", ")
        .map((name) => (catalogue?.products ?? []).find((p) => p.name === name.trim()))
        .filter((p): p is NonNullable<typeof p> => Boolean(p))
    : [];

  function confirmedHere(id: string) {
    const nowDone = [...done, id];
    const nowTicked = [...new Set([...ticked, id])];
    setDone(nowDone);
    setTicked(nowTicked);
    // Every product she named is confirmed: that was her answer (TASK-1).
    const allDone = named.every((n) => nowDone.includes(n) || products.some((p) => p.id === n && confirmed(p)));
    if (onAnswer && named.includes(id) && allDone) onAnswer(products.filter((p) => nowTicked.includes(p.id)).map((p) => p.name).join(", "));
  }

  return (
    // Open, its heading stays in view while she looks through the products (MOB-2, chat.css).
    <Card className={onAnswer ? "ui-chat-ask" : undefined}>
      <CardHeader>
        <CardTitle as="p">{card.question}</CardTitle>
        <CardDescription>Why Fume asks: {card.why}</CardDescription>
      </CardHeader>
      {!onAnswer && chosen.length > 0 && (
        <CardContent>
          <div className="ui-app-stack ui-app-stack--tight">
            <p className="ui-chat-plan-eyebrow">{chosen.length === 1 ? "The product for this campaign" : "The products for this campaign"}</p>
            <ul className="ui-chat-picked">
              {chosen.map((p) => (
                <li key={p.id}>
                  <Item variant="muted" size="sm">
                    <ItemMedia variant="image">
                      <ItemMediaImage src={p.shots?.find((x) => x.slotId === "front")?.image ?? p.images[0]} />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>{p.name}</ItemTitle>
                      <ItemDescription>{[p.variant, confirmed(p) ? "Confirmed" : "Not confirmed yet"].filter(Boolean).join(" · ")}</ItemDescription>
                    </ItemContent>
                  </Item>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      )}
      {onAnswer && (
        <CardContent>
          <div className="ui-app-stack">
            {rows.length > 0 && (
              <div className="ui-app-stack ui-app-stack--tight">
                {rows.map((p) => (
                  <Item key={p.id} variant="muted" size="sm">
                    <ItemMedia variant="image">
                      <ItemMediaImage src={p.images[0]} />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>{p.name}</ItemTitle>
                      <ItemDescription>{named.includes(p.id) ? "You named it. Confirm its details first." : "Not confirmed yet."}</ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <Button size="sm" onClick={() => confirm(p.id)} aria-label={`Confirm the details of ${p.name}`}>
                        Confirm details
                      </Button>
                    </ItemActions>
                  </Item>
                ))}
              </div>
            )}
            {tiles.length > 0 && (
              <div className="ui-app-stack ui-app-stack--tight">
                {rows.length > 0 && <CardDescription>Or tick a product that is ready.</CardDescription>}
                <PickGrid size="sm" aria-label="Products that are ready">
                  {tiles.map((p) => (
                    <ProductTile
                      key={p.id}
                      name={p.name}
                      variant={p.variant}
                      src={p.images[0]}
                      selected={ticked.includes(p.id)}
                      onSelectedChange={(on) => setTicked((l) => (on ? [...l, p.id] : l.filter((x) => x !== p.id)))}
                    />
                  ))}
                </PickGrid>
              </div>
            )}
            {collections.length > 0 && (
              <div className="ui-app-stack ui-app-stack--tight">
                <CardDescription>Or a collection: it ticks the products in it that are ready.</CardDescription>
                <PickGrid size="sm" aria-label="Collections">
                  {collections.map(({ c, ids }) => (
                    <ProductTile
                      key={c.id}
                      name={c.name}
                      variant={copy.count(ids.length, "product")}
                      src={c.cover ?? products.find((p) => p.id === ids[0])?.images[0]}
                      selected={ids.every((id) => ticked.includes(id))}
                      onSelectedChange={(on) => tickAll(ids, on)}
                    />
                  ))}
                </PickGrid>
              </div>
            )}
            {products.length > 1 && <ProductSheetButton count={products.length} onClick={() => setAll(true)} />}
          </div>
          <AllProductsSheet open={all} onOpenChange={setAll} only={card.productIds} multiple value={ticked} onPick={setTicked} onConfirm={confirm} />
        </CardContent>
      )}
      {onAnswer && (tiles.length > 0 || picked.length > 0) && (
        <CardFooter>
          <div className="ui-app-row">
            <Button size="sm" iconEnd="arrow-right" variant={rows.length && !picked.length ? "secondary" : undefined} disabled={!picked.length} onClick={() => onAnswer(picked.map((p) => p.name).join(", "))}>
              {picked.length ? `Use ${copy.count(picked.length, "product")}` : "Tick a product"}
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
