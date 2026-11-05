// Review, a place of its own (FLOWS §26.3): the customer's sidebar has Review, with the number of creatives that wait
// on her across campaigns, and this page lists them grouped by campaign: the review grid (every one selected to start
// with, "Approve 8" one press with Undo), the viewer over the page with ← → through all of them, and per campaign the
// creatives she marked "Needs changes" with its one "Start the changes". A campaign's own review
// (/campaigns/:id/review) stays, and lights Review too. Home keeps its inbox. In a staff frame (Fume's studio, an
// agency) the brand's /review address goes on to the frame's start.
import { Button, CreativeGrid, PageHeader } from "@fume/ui";
import { useMemo, type MouseEvent as ReactMouseEvent } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useCampaign, usePeople, useReviewQueue, useSession } from "../../api/hooks";
import type { Campaign, Creative, Id } from "../../contract";
import * as copy from "../../copy";
import { due } from "../../lib/time";
import { Failed, Loading, Nothing, Page, Section } from "../../shell/Page";
import { directory } from "../../shell/people";
import { rights } from "../campaigns/parts";
import { useCustomerNamesAcross } from "./names";
import { useOverlay } from "./overlay";
import { ChangesSection, ReviewTile, useSendChanges } from "./parts";
import { ApproveBar, selectionWords, useReviewSelection } from "./select";
import { useReviewSetAcross } from "./set";
import { isMarked, useChangeTray, useMarksAcross } from "./tray";
import { ReviewViewer } from "./ViewerPage";

type People = ReturnType<typeof directory>;
type Rights = ReturnType<typeof rights>;

export function ReviewPage() {
  const { pathname } = useLocation();
  // A staff frame's brand address (/studio/b/w-lysne/review): its start.
  if (pathname !== "/review") return <Navigate to="/" replace />;
  return (
    <Page title="Review">
      <ReviewPlace />
    </Page>
  );
}

/** The number on the sidebar's Review: every creative that waits on her, across campaigns. */
export function useReviewCount(): number {
  const queue = useReviewQueue();
  return (queue.data ?? []).reduce((n, i) => n + (i.kind === "creatives" ? i.creatives.length : 0), 0);
}

function ReviewPlace() {
  const queue = useReviewQueue();
  const session = useSession().data!;
  const people = directory(usePeople().data);
  const can = rights(session.role);
  const viewer = useOverlay("c");
  const groups = useMemo(
    () => (queue.data ?? []).filter((i) => i.kind === "creatives" && i.creatives.length > 0),
    [queue.data],
  );
  const campaigns = useMemo(() => groups.map((g) => g.campaign), [groups]);
  const campaignIds = useMemo(() => campaigns.map((c) => c.id), [campaigns]);
  const named = useCustomerNamesAcross(campaigns);
  const marks = useMarksAcross(campaignIds);
  const list = useMemo(() => groups.flatMap((g) => g.creatives.map(named)), [groups, named]);
  const pick = useReviewSelection(list, (c) => isMarked(marks, c), can.approve);
  const n = pick.selected.length;
  const total = list.length;
  const checkers = [...new Set(list.map((c) => c.current.checkedBy).filter(Boolean))].map((id) => people.name(id));
  const approvers = [...new Set(campaigns.map((c) => people.name(c.approverId).split(" ")[0]!))];
  const words = selectionWords({
    n,
    total,
    open: pick.open.length,
    approver: approvers.join(" or ") || "The approver",
    canApprove: can.approve,
    canAsk: can.ask,
  });

  return (
    <>
      <PageHeader
        title="Review"
        description={
          total
            ? `${checkers.length ? `${checkers.join(" and ")} checked ${total === 1 ? "this one" : `these ${total}`}. ` : ""}${words}`
            : "The creatives that wait on you, from every campaign, once the expert has checked them."
        }
        meta={total ? [copy.creatives(total), copy.count(groups.length, "campaign")] : undefined}
      />

      {queue.isPending ? (
        <Loading label="Loading what waits for you" />
      ) : queue.error ? (
        <Failed error={queue.error} onRetry={() => queue.refetch()} />
      ) : total === 0 ? (
        <Nothing
          icon="circle-check"
          scene="quiet"
          title="Nothing waits on you"
          text="When the expert has checked new creatives, they wait for you here. Home says what else waits."
          action={
            <div className="ui-app-row">
              <Button asChild variant="secondary">
                <Link to="/">Home</Link>
              </Button>
              <Button asChild variant="quiet">
                <Link to="/deliveries">Deliveries</Link>
              </Button>
            </div>
          }
        />
      ) : (
        groups.map((g) => (
          <CampaignGroup
            key={g.campaign.id}
            campaign={g.campaign}
            creatives={list.filter((c) => c.campaignId === g.campaign.id)}
            people={people}
            can={can}
            selected={(c) => pick.isSelected(c)}
            onSelectedChange={pick.toggle}
            onOpen={(id) => viewer.open(id)}
          />
        ))
      )}

      {can.approve && (
        <ApproveBar
          selected={pick.selected}
          onClear={pick.clear}
          onNeedsChanges={can.ask ? (c) => viewer.open(c.id, { ask: "1" }) : undefined}
        />
      )}

      {viewer.value && campaignIds.length > 0 && (
        <ViewerAcross
          campaigns={campaigns}
          campaignIds={campaignIds}
          creativeId={viewer.value}
          onMove={viewer.move}
          onClose={viewer.close}
        />
      )}
    </>
  );
}

/** One campaign's creatives on the Review place: its name (to its own review), what she marked, and the grid. */
function CampaignGroup({
  campaign,
  creatives,
  people,
  can,
  selected,
  onSelectedChange,
  onOpen,
}: {
  campaign: Campaign;
  creatives: Creative[];
  people: People;
  can: Rights;
  selected: (c: Creative) => boolean;
  onSelectedChange: (id: Id, on: boolean, e?: ReactMouseEvent<HTMLElement>) => void;
  onOpen: (id: Id) => void;
}) {
  const view = useCampaign(campaign.id);
  const tray = useChangeTray(campaign.id, view.data?.creatives);
  const sender = useSendChanges({ campaign: view.data?.campaign ?? campaign, tray, threadId: view.data?.threadId });
  const answered = creatives.length > 0 && creatives.every((c) => tray.has(c.id));
  const titleId = `review-${campaign.id}`;
  return (
    <>
      {can.ask && (
        <ChangesSection
          title={`${campaign.name}: needs changes`}
          campaign={view.data?.campaign ?? campaign}
          tray={tray}
          sender={sender}
          answered={answered}
          onOpen={onOpen}
        />
      )}
      <Section
        title={campaign.name}
        meta={creatives.length}
        titleId={titleId}
        text={campaign.dueAt ? `Goes live ${due(campaign.dueAt)}.` : undefined}
        action={
          <Button asChild variant="quiet" size="sm" iconEnd="arrow-right">
            <Link to={`/campaigns/${campaign.id}/review`}>Its review</Link>
          </Button>
        }
      >
        <CreativeGrid className="ui-review-grid" aria-labelledby={titleId}>
          {creatives.map((c) => (
            <ReviewTile
              key={c.id}
              creative={c}
              people={people.user}
              toChange={tray.has(c.id)}
              selected={can.approve ? selected(c) : undefined}
              onSelectedChange={can.approve ? (on, e) => onSelectedChange(c.id, on, e) : undefined}
              onOpen={() => onOpen(c.id)}
            />
          ))}
        </CreativeGrid>
      </Section>
    </>
  );
}

/** The viewer over the Review place: ← → move through every creative that waited, campaign after campaign. */
function ViewerAcross({
  campaigns,
  campaignIds,
  creativeId,
  onMove,
  onClose,
}: {
  campaigns: Campaign[];
  campaignIds: Id[];
  creativeId: Id;
  onMove: (id: Id) => void;
  onClose: () => void;
}) {
  const review = useReviewSetAcross(campaignIds);
  const named = useCustomerNamesAcross(campaigns);
  const list = useMemo(() => review.list.map(named), [review.list, named]);
  const all = useMemo(() => review.all.map(named), [review.all, named]);
  if (!review.ready) return null;
  const set = list.some((c) => c.id === creativeId) ? list : all;
  const fresh = review.views.map((v) => v.campaign);
  return (
    <ReviewViewer
      set={set}
      campaigns={fresh.length ? fresh : campaigns}
      creativeId={creativeId}
      all={review.all}
      threadId={review.views.length === 1 ? review.views[0]!.threadId : undefined}
      onMove={onMove}
      onClose={onClose}
    />
  );
}
