// A campaign's review (ARCHITECTURE §6.2, §6.4): a state of the campaign at /campaigns/:id/review, with Review lit in
// the sidebar and the back arrow to the campaign (or wherever she came from); /review/:campaignId is the old address
// and sends you on. The checked creatives, every one selected to start with, so "Approve 6" is one press; it acts at
// once, with Undo in the toast (the selection and its bar are select.tsx, shared with the Review place). Tiles are at
// least 240 (creative.css). A creative opens in the one viewer as a layer over this page (?c=<id>), and Swipe through
// is a layer too (?swipe=1), so the selection stays as she left it and the phone's back closes the layer. Swipe through
// is the phone's: on a desk with a mouse it is not offered, and its address opens the viewer, which has the same speed
// with its keys.
// A creative she marks "Needs changes" in the viewer takes its open comments as its change list; the marked creatives
// sit above the grid with one "Start the changes" (parts.tsx, ChangesSection), and when every creative has an answer
// the section says so and its pill is the page's Ink. When nothing more waits here the page says what is next. A
// campaign in the plan stage has nothing to review yet: the page says where its plan stands and opens the plan.
// In a brand an agency runs the agency's people never see Approve (FLOWS §24.2): their review has no selection, names
// the two states of a checked creative once each ("To send", "With Maja"), and its Ink is "Send to Maja" while anything
// is not sent ("Send again", a white pill, after), with Record an approval as a white pill beside it. ?send=1 (from the
// campaign's page) opens the Send panel. The client's own people review as the customer does.
import { Button, CreativeGrid, PageHeader, useNarrowScreen } from "@fume/ui";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useParams, useSearchParams } from "react-router-dom";
import { useCampaign, usePeople, useReviewQueue, useSession } from "../../api/hooks";
import type { CampaignView, Creative, Direction, ReviewItem } from "../../contract";
import * as copy from "../../copy";
import { due } from "../../lib/time";
import { Back, Failed, Loading, Nothing, Page, Query, Section } from "../../shell/Page";
import { directory } from "../../shell/people";
import { useWaitingOnYou } from "../../shell/waiting";
import { useAgencyScope } from "../agency/clientFlow";
import { ClientCreatives, ClientNext, ClientSent, useClientActions, useClientPanels } from "../agency/ClientReview";
import { QuestionSheet } from "../questions/QuestionSheet";
import { DirectionCard, rights } from "../campaigns/parts";
import { useCustomerNames } from "./names";
import { useOverlay } from "./overlay";
import { ChangesSection, ChooseDialog, PassDialog, ReviewTile, useSendChanges } from "./parts";
import { ApproveBar, selectionWords, useReviewSelection } from "./select";
import { useReviewSet } from "./set";
import { SwipeThrough } from "./SwipePage";
import { useChangeTray } from "./tray";
import { ReviewViewer } from "./ViewerPage";

type People = ReturnType<typeof directory>;
type Rights = ReturnType<typeof rights>;

/** A desk: a wide screen and a mouse. Swipe through is not offered there. */
export const DESK = "(min-width: 1024px) and (pointer: fine)";

export function ReviewCampaign() {
  const { campaignId } = useParams<"campaignId">();
  const { pathname, search } = useLocation();
  // The old address (/review/:campaignId, from older links and notifications)
  if (pathname.startsWith("/review/")) return <Navigate to={`/campaigns/${campaignId}/review${search}`} replace />;
  return <CampaignReview campaignId={campaignId!} />;
}

function CampaignReview({ campaignId }: { campaignId: string }) {
  const campaign = useCampaign(campaignId);
  const agency = useAgencyScope() === "agency";
  return (
    <Page title={campaign.data ? `Review ${campaign.data.campaign.name}` : "Review"}>
      <Query query={campaign} loading="Loading the campaign">
        {(view) => (agency ? <AgencyReviewScreen view={view} /> : <ReviewScreen view={view} />)}
      </Query>
    </Page>
  );
}

function ReviewScreen({ view }: { view: CampaignView }) {
  const c = view.campaign;
  const queue = useReviewQueue();
  const session = useSession().data!;
  const people = directory(usePeople().data);
  const can = rights(session.role);
  const viewer = useOverlay("c");
  const swipe = useOverlay("swipe");
  const tray = useChangeTray(c.id, view.creatives);
  const sender = useSendChanges({ campaign: c, tray, threadId: view.threadId });
  const items = (queue.data ?? []).filter((i) => i.campaign.id === c.id);
  /** Opens the creative in the viewer as if N was pressed there (Needs changes on the bar). */
  const askFor = (id: string) => viewer.open(id, { ask: "1" });
  const mine = view.approver.id === session.user.id;
  const waiting = items.find((i) => i.kind === "creatives")?.creatives ?? [];
  const answered = waiting.length > 0 && waiting.every((cr) => tray.has(cr.id));

  return (
    <>
      <PageHeader
        title="Review"
        back={<Back to={`/campaigns/${c.id}`} label={c.name} />}
        meta={[
          c.name,
          ...(c.dueAt ? [`due ${due(c.dueAt)}`] : []),
          ...(mine ? [] : [`${view.approver.name.split(" ")[0]} approves`]),
        ]}
      />

      {can.ask && (
        <ChangesSection campaign={c} tray={tray} sender={sender} answered={answered} onOpen={(id) => viewer.open(id)} />
      )}

      {queue.isPending ? (
        <Loading label="Loading what waits for you" />
      ) : queue.error ? (
        <Failed error={queue.error} onRetry={() => queue.refetch()} />
      ) : items.length === 0 && c.stage === "plan" ? (
        <PlanNext view={view} />
      ) : items.length === 0 ? (
        <WhatNext view={view} />
      ) : (
        items.map((item) => (
          <Decision
            key={item.kind}
            item={item}
            view={view}
            people={people}
            can={can}
            onOpen={(cr) => viewer.open(cr.id)}
            onAsk={(cr) => askFor(cr.id)}
            onSwipe={() => swipe.open("1")}
          />
        ))
      )}

      {viewer.value && (
        <ViewerLayerFor view={view} creativeId={viewer.value} onMove={viewer.move} onClose={viewer.close} />
      )}
      {swipe.value && can.ask && <SwipeLayerFor view={view} canApprove={can.approve} onClose={swipe.close} />}

      {sender.dialog}
    </>
  );
}

/** The viewer over the review: the set is what waited when it opened; a creative outside it (a link from the chat
 *  to one already approved) opens among all of the campaign's. */
function ViewerLayerFor({
  view,
  creativeId,
  onMove,
  onClose,
}: {
  view: CampaignView;
  creativeId: string;
  onMove: (id: string) => void;
  onClose: () => void;
}) {
  const review = useReviewSet(view.campaign.id);
  const named = useCustomerNames(view.campaign);
  const list = useMemo(() => review.list.map(named), [review.list, named]);
  const all = useMemo(() => review.all.map(named), [review.all, named]);
  if (!review.ready) return null;
  const set = list.some((c) => c.id === creativeId) ? list : all;
  return (
    <ReviewViewer
      set={set}
      campaigns={[view.campaign]}
      creativeId={creativeId}
      all={review.all}
      threadId={view.threadId}
      onMove={onMove}
      onClose={onClose}
    />
  );
}

function SwipeLayerFor({
  view,
  canApprove,
  onClose,
}: {
  view: CampaignView;
  canApprove: boolean;
  onClose: () => void;
}) {
  const review = useReviewSet(view.campaign.id);
  const named = useCustomerNames(view.campaign);
  const set = useMemo(() => review.list.map(named), [review.list, named]);
  const desk = useNarrowScreen(DESK);
  // Nothing waits any more (all decided elsewhere): there is nothing to swipe, so the layer closes.
  const empty = review.ready && set.length === 0;
  useEffect(() => {
    if (empty) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empty]);
  if (!review.ready || empty) return null;
  // On a desk the address of Swipe through opens the viewer on the first creative that waits.
  if (desk) return <Navigate to={`?c=${set[0]!.id}`} replace />;
  return (
    <SwipeThrough
      campaign={view.campaign}
      set={set}
      all={review.all}
      approver={view.approver.name}
      canApprove={canApprove}
      threadId={view.threadId}
      onClose={onClose}
    />
  );
}

function Decision({
  item,
  view,
  people,
  can,
  onOpen,
  onAsk,
  onSwipe,
}: {
  item: ReviewItem;
  view: CampaignView;
  people: People;
  can: Rights;
  onOpen: (c: Creative) => void;
  onAsk: (c: Creative) => void;
  onSwipe: () => void;
}) {
  if (item.kind === "directions")
    return <DirectionsDecision directions={item.directions} view={view} people={people} can={can} />;
  if (item.kind === "creatives")
    return (
      <CreativesDecision
        creatives={item.creatives}
        view={view}
        people={people}
        can={can}
        onOpen={onOpen}
        onAsk={onAsk}
        onSwipe={onSwipe}
      />
    );
  return (
    <Section
      title="The brief"
      titleId="review-brief"
      text="The brief is ready to send. Read it in full, then send it to Fume: Fume writes the plan from it."
    >
      <div className="ui-app-row">
        <Button asChild iconEnd="arrow-right">
          <Link to={`/campaigns/${view.campaign.id}/plan`}>Read the brief</Link>
        </Button>
      </div>
    </Section>
  );
}

// ─── The agency's review ────────────────────────────────────────────────────

/** The review for the agency's people in a client brand: Send to Maja and Record an approval, never Approve. */
function AgencyReviewScreen({ view }: { view: CampaignView }) {
  const c = view.campaign;
  const queue = useReviewQueue();
  const session = useSession().data!;
  const people = directory(usePeople().data);
  const can = rights(session.role);
  const viewer = useOverlay("c");
  const swipe = useOverlay("swipe");
  const tray = useChangeTray(c.id, view.creatives);
  const sender = useSendChanges({ campaign: c, tray, threadId: view.threadId });
  const named = useCustomerNames(c);
  const items = useMemo(() => (queue.data ?? []).filter((i) => i.campaign.id === c.id), [queue.data, c.id]);
  const checked = useMemo(
    () => (items.find((i) => i.kind === "creatives")?.creatives ?? []).map(named),
    [items, named],
  );
  const others = items.filter((i) => i.kind !== "creatives");
  const panels = useClientPanels(view, checked);
  const headActions = useClientActions(view, checked, panels);
  const askFor = (id: string) => viewer.open(id, { ask: "1" });

  // ?send=1 (Send to Maja on the campaign's page or Home) opens the panel once the creatives are here, then leaves the address.
  const [params, setParams] = useSearchParams();
  const sendAsked = params.get("send") === "1";
  useEffect(() => {
    if (!sendAsked || queue.isPending) return;
    const p = new URLSearchParams(params);
    p.delete("send");
    setParams(p, { replace: true });
    if (checked.length) panels.openSend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendAsked, queue.isPending]);

  // Swipe through approves; the agency's people review here instead.
  if (swipe.value) return <Navigate to={`/campaigns/${c.id}/review`} replace />;

  return (
    <>
      <PageHeader
        title="Review"
        back={<Back to={`/campaigns/${c.id}`} label={c.name} />}
        meta={[c.name, ...(c.dueAt ? [`due ${due(c.dueAt)}`] : [])]}
        {...headActions}
      />

      {can.ask && (
        <ChangesSection
          campaign={c}
          tray={tray}
          sender={sender}
          answered={checked.length > 0 && checked.every((cr) => tray.has(cr.id))}
          onOpen={(id) => viewer.open(id)}
        />
      )}

      {queue.isPending ? (
        <Loading label="Loading what waits for the client" />
      ) : queue.error ? (
        <Failed error={queue.error} onRetry={() => queue.refetch()} />
      ) : (
        <div className="ui-app-cols">
          <div className="ui-app-stack ui-client-review">
            {items.length === 0 && c.stage === "plan" ? (
              <PlanNext view={view} />
            ) : (
              others.map((item) => (
                <Decision
                  key={item.kind}
                  item={item}
                  view={view}
                  people={people}
                  can={can}
                  onOpen={(cr) => viewer.open(cr.id)}
                  onAsk={(cr) => askFor(cr.id)}
                  onSwipe={() => undefined}
                />
              ))
            )}
            {items.length === 0 && c.stage !== "plan" && <ClientNext view={view} />}
            <ClientCreatives
              view={view}
              checked={checked}
              people={people}
              me={session.user.id}
              onOpen={(cr) => viewer.open(cr.id)}
            />
          </div>
          <aside className="ui-app-stack" aria-label="Sent to the client">
            <ClientSent view={view} />
          </aside>
        </div>
      )}

      {viewer.value && (
        <ViewerLayerFor view={view} creativeId={viewer.value} onMove={viewer.move} onClose={viewer.close} />
      )}
      {panels.panels}
      {sender.dialog}
    </>
  );
}

// ─── The plan ───────────────────────────────────────────────────────────────

/** A campaign in the plan stage: nothing to review yet. Where the plan stands, in the status sentence's words, and the
 *  way to it; nothing is made before she approves it. */
function PlanNext({ view }: { view: CampaignView }) {
  const status = copy.campaignStatus(view.campaign);
  const ready = status.waiting;
  return (
    <Nothing
      icon="file-text"
      title={status.words}
      text={
        ready
          ? "Approve it and Fume starts on the masters. Nothing is made before that."
          : "Nothing is made before you approve the plan. Fume tells you when it is ready."
      }
      action={
        <div className="ui-app-row">
          <Button asChild variant={ready ? "primary" : "secondary"} iconEnd="arrow-right">
            <Link to={`/campaigns/${view.campaign.id}/plan`}>Open the plan</Link>
          </Button>
          {!ready && (
            <Button asChild variant="quiet">
              <Link to="/">Home</Link>
            </Button>
          )}
        </div>
      }
    />
  );
}

// ─── When nothing more waits here ───────────────────────────────────────────

/** The end of the review never dead-ends: the next thing that waits on her, and Home. A question opens the one question
 *  sheet right here. */
function WhatNext({ view }: { view: CampaignView }) {
  const waiting = useWaitingOnYou();
  const session = useSession().data;
  const [asking, setAsking] = useState(false);
  const next = waiting.items.find((w) => !w.href.includes(view.campaign.id));
  // A delivery says what she does there ("download Autumn launch’s masters", "Download"), and what is still in check
  // says who checks it ("3 more come once Brygga Studio has checked them").
  const download = next?.kind === "download";
  const checker = session?.workspace.agencyId && !session.user.agency ? (session.agencyName ?? "the agency") : "Fume";
  const inCheck = next?.campaignId === view.campaign.id ? view.campaign.counts.inCheck : 0;
  const detail = download && inCheck ? `${inCheck} more come once ${checker} has checked them.` : next?.detail;
  return (
    <>
      <Nothing
        icon="circle-check"
        title={
          next
            ? download
              ? `Done here. Next: download ${next.title}’s masters`
              : `Done here. Next: ${next.title}`
            : "Nothing more waits on you here"
        }
        text={next ? detail : `${checker} tells you when the next work in ${view.campaign.name} is checked and ready.`}
        action={
          <div className="ui-app-row">
            {next?.questionIds?.length ? (
              <Button iconEnd="arrow-right" onClick={() => setAsking(true)}>
                Answer
              </Button>
            ) : next ? (
              <Button asChild iconEnd="arrow-right">
                <Link to={next.href}>{download ? "Download" : "Go"}</Link>
              </Button>
            ) : null}
            <Button asChild variant="secondary">
              <Link to="/">Home</Link>
            </Button>
          </div>
        }
      />
      {next?.questionIds?.length ? (
        <QuestionSheet ids={next.questionIds} open={asking} onOpenChange={setAsking} />
      ) : null}
    </>
  );
}

// ─── Directions ─────────────────────────────────────────────────────────────

function DirectionsDecision({
  directions,
  view,
  people,
  can,
}: {
  directions: Direction[];
  view: CampaignView;
  people: People;
  can: Rights;
}) {
  const [choosing, setChoosing] = useState<Direction | null>(null);
  const [passing, setPassing] = useState(false);
  return (
    <Section
      title="Directions"
      meta={directions.length}
      titleId="review-directions"
      text={
        can.approve
          ? `${copy.count(directions.length, "direction")} ready. Pick one to take forward, or tell Fume why none fits.`
          : `${view.approver.name} chooses the direction. You can tell Fume what you think in the conversation.`
      }
      action={
        can.approve ? (
          <Button variant="secondary" size="sm" onClick={() => setPassing(true)}>
            None of these fits
          </Button>
        ) : can.ask ? (
          <Button asChild variant="quiet" size="sm" iconEnd="arrow-right">
            <Link to={`/fume/${view.threadId}`}>Talk to Fume</Link>
          </Button>
        ) : undefined
      }
    >
      <div className="ui-app-grid">
        {directions.map((d) => (
          <DirectionCard
            key={d.id}
            direction={d}
            name={people.name}
            footer={
              can.approve ? (
                <Button icon="check" onClick={() => setChoosing(d)}>
                  Choose {d.letter}
                </Button>
              ) : undefined
            }
          />
        ))}
      </div>
      {choosing && <ChooseDialog direction={choosing} open onOpenChange={(o) => !o && setChoosing(null)} />}
      <PassDialog campaign={view.campaign} open={passing} onOpenChange={setPassing} />
    </Section>
  );
}

// ─── Creatives ──────────────────────────────────────────────────────────────

function CreativesDecision({
  creatives: raw,
  view,
  people,
  can,
  onOpen,
  onAsk,
  onSwipe,
}: {
  creatives: Creative[];
  view: CampaignView;
  people: People;
  can: Rights;
  onOpen: (c: Creative) => void;
  onAsk: (c: Creative) => void;
  onSwipe: () => void;
}) {
  const desk = useNarrowScreen(DESK);
  const named = useCustomerNames(view.campaign);
  const creatives = useMemo(() => raw.map(named), [raw, named]);
  const tray = useChangeTray(view.campaign.id, view.creatives);
  // Everything checked starts selected; she leaves one out with its circle. A creative marked "Needs changes" is
  // never in the selection; ids that leave the list (approved, being remade) drop out on their own.
  const pick = useReviewSelection(creatives, (c) => tray.has(c.id), can.approve);
  const n = pick.selected.length;
  const total = creatives.length;
  const checkers = [...new Set(creatives.map((c) => c.current.checkedBy).filter(Boolean))].map((id) => people.name(id));
  const approver = view.approver.name.split(" ")[0]!;

  // "Anna checked these 6. All are selected; click a circle to leave one out.": the words follow the selection, so they
  // and the bar never disagree.
  const checked = checkers.length
    ? `${checkers.join(" and ")} checked ${total === 1 ? "this one" : `these ${total}`}. `
    : "";
  const words = selectionWords({
    n,
    total,
    open: pick.open.length,
    approver,
    canApprove: can.approve,
    canAsk: can.ask,
  });

  return (
    <Section
      title="Ready for you"
      meta={total}
      titleId="review-creatives"
      text={`${checked}${words}`}
      action={
        (can.ask && !desk) || (can.approve && n < pick.open.length && pick.open.length > 1) ? (
          <div className="ui-app-row">
            {can.ask && !desk && (
              <Button variant="secondary" size="sm" icon="layers" onClick={onSwipe}>
                Swipe through
              </Button>
            )}
            {can.approve && n < pick.open.length && pick.open.length > 1 && (
              <Button variant="quiet" size="sm" onClick={pick.selectAll}>
                Select all
              </Button>
            )}
          </div>
        ) : undefined
      }
    >
      <CreativeGrid className="ui-review-grid" aria-labelledby="review-creatives">
        {creatives.map((c) => (
          <ReviewTile
            key={c.id}
            creative={c}
            people={people.user}
            toChange={tray.has(c.id)}
            selected={can.approve ? pick.isSelected(c) : undefined}
            onSelectedChange={can.approve ? (on, e) => pick.toggle(c.id, on, e) : undefined}
            onOpen={() => onOpen(c)}
          />
        ))}
      </CreativeGrid>

      {can.approve && (
        <ApproveBar selected={pick.selected} onClear={pick.clear} onNeedsChanges={can.ask ? onAsk : undefined} />
      )}
    </Section>
  );
}
