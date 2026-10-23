// The one creative viewer (FLOWS §11; UX review 19 Oct, WAY-7, WAY-8, WAY-9, TASK-12, TASK-20, LOAD-17, MOB-20):
// one creative full screen on the dark stage, as a layer over the page that opened it (the review set, a campaign's
// creatives, a collection), kept in the address so the phone's back closes it and nothing else. The comments sit on
// the right (a sheet from the bottom on a phone). While a creative waits on her: Approve, which acts at once (Undo in
// the toast) and moves to the next one that waits, and Ask for changes, which opens the change form in that same
// right-hand panel, beside the creative, and puts it in the set's change request (sent once, as one, at once, from
// the panel's foot or the review page). Once approved: Download, under the customer's name with the file name in
// small mono. The customer never sees prompts, models or seeds here.
// Round 9, the desktop (PROPOSED 19 Oct 2026, UX review DLAY-1, DTSK-1, DWAY-3, DTSK-8, DWAY-1, DWAY-2, DTSK-9, DTSK-2,
// DTSK-15, DWAY-16, DTSK-11): a fixed frame. The bar is pinned (✕ at the left, "1 of 6" with ‹ › at the right edge of
// the stage), the panel is 360 wide on the right, and the creative fills what is left, by the stage's height, never
// past its own pixel size. Ask for changes and Approve sit at the same place under the stage for every creative and
// state, with their keys under them. Keys: ← → move, A approves (then the next), C asks for changes, Backspace or ⌘Z
// takes the last decision back, Esc takes away the nearest thing first (a spot being written, the change form, a
// field's focus) and then closes. A click on the creative opens a small comment box beside the pin (desktop).
// /review/:campaignId/c/:creativeId is the old address: it opens the same layer on the campaign's review.
// Round 11 CLIENT FLOW (FLOWS §24.2, §24.5; PROPOSED 20 Oct 2026): in a brand an agency runs, the agency's people never
// approve a creative. Where Approve stood they have Send to client (the right panel over the viewer, this creative
// chosen) and, in a quiet More menu beside it, Record an approval; A does nothing for them. A creative they sent says
// "Waiting on Maja"; an approval they recorded says "Maja approved · recorded by Nora" ("recorded by you").
// Round 12 AGENCY (UX review DLOAD-5, DTASK-15; brief r12 SENDING; PROPOSED 20 Oct 2026): a checked creative says its
// state for the agency, "Checked, not sent" or "With Maja"; the white pill is "Send to Maja" until it is sent ("Send
// again", clear, after), and Record an approval is a clear pill beside it, no longer in a one-item More menu.
// Round 13 (Marcus #28, #31, #32, #33, #34, robot notes 04; PROPOSED 21 Oct 2026):
// - One place to write: the comments. They post at once and her team and the expert see them. Per creative she decides
//   Approve (A) or Needs changes (N): the mark makes its open comments the change list (the panel says so at its top,
//   with the "The product itself is off" tick; she can add one more comment there), and with no comment yet the
//   field asks what should change and her comment marks it. Pressed again, Needs changes takes the mark back. The
//   change form ("What should change", "Send these comments with it") is gone. The panel's foot offers "Start the
//   changes" for the marked creatives; once every creative in the set has an answer it says so and the pill is white.
// - The keys read as shortcuts: a keycap inside each decision pill ("Approve  A", "Needs changes  N") with a tooltip;
//   C goes to the comment field. ← → move whenever focus is not in a text field, with a visible "← →" by the counter.
// - Whoever checked it shows under the title with the Amber pointer ("Checked by Anna"), as Check shows it.
// - Toasts on a desk land at the foot of the stage, over the hint, never over the panel (the decision row is the
//   toast anchor there; on a phone it stays the foot they rise above).
import {
  Avatar,
  Button,
  Checkbox,
  Choice,
  ChoiceText,
  Icon,
  Kbd,
  KbdGroup,
  Textarea,
  ViewerLayer,
  ViewerLayerTitle,
  WithTooltip,
  currentOpener,
  cx,
  returnFocusTo,
  tokenMs,
  useNarrowScreen,
  useToast,
  useTouch,
  type ButtonProps,
  type ToastHandle,
} from "@fume/ui";
import {
  forwardRef,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type FormEvent,
  type MouseEvent,
  type MutableRefObject,
  type ReactNode,
  type RefObject,
} from "react";
import { Navigate, useLocation, useParams, useSearchParams } from "react-router-dom";
import {
  useAddReviewComment,
  useApprove,
  usePeople,
  useResolveReviewComment,
  useReviewComments,
  useSession,
  useUnapprove,
} from "../../api/hooks";
import type { Campaign, Creative, CreativeVersion, Id, ReviewComment } from "../../contract";
import * as copy from "../../copy";
import { when } from "../../lib/time";
import { directory, firstName, sign } from "../../shell/people";
import { rights } from "../campaigns/parts";
import { approvedWords, sendState, useAgencyScope, useCampaignSends } from "../agency/clientFlow";
import { RecordApprovalSheet } from "../agency/RecordApproval";
import { SendToClientSheet } from "../agency/SendToClient";
import { canTake } from "../deliveries/parts";
import { labelOf, shapeLine } from "./names";
import { markOf, startWords, useChangeRecipient, useSendChanges } from "./parts";
import { useChangeTray, type ChangeTray } from "./tray";

type People = ReturnType<typeof directory>;
type Rights = ReturnType<typeof rights>;
type Draft = { x: number; y: number };

/** Where the viewer is a phone's: the comments become a sheet from the bottom (the container query in review-viewer.css). */
const PHONE = "(max-width: 719.98px)";
/** Where toasts sit at a column's foot (toast.tsx): there they land on the decision row's hint, never on the panel. */
const TOAST_DESK = "(min-width: 1024px)";

const pos = (x: number, y: number) => ({ "--x": `${x * 100}%`, "--y": `${y * 100}%` }) as CSSProperties;
const inField = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));
const emptyField = (t: EventTarget | null) =>
  (t instanceof HTMLTextAreaElement || (t instanceof HTMLInputElement && t.type === "text")) && t.value === "";

/** The old address: the same creative, in the viewer over the campaign's review. */
export function ViewerPage() {
  const { campaignId, creativeId } = useParams<"campaignId" | "creativeId">();
  return <Navigate to={`/campaigns/${campaignId}/review?c=${creativeId}`} replace />;
}

/** Checked by the expert and not yet decided: the words say who checked it, beside the Amber pointer (round 13, #28). */
const checkedOnly = (v: CreativeVersion) => v.state === "checked" && Boolean(v.checkedBy);
/** The Amber Focus pointer, as Check marks "Checked by you"; only where the words say who checked it. */
const CheckedIcon = ({ v }: { v: CreativeVersion }) =>
  checkedOnly(v) ? <Icon name="fume-check" className="ui-rv-check-icon" /> : null;

/** The version's state in words for the stage and the compare captions: "You approved" when it was her. */
function versionWords(v: CreativeVersion, people: People, me: Id): string {
  if ((v.state === "approved" || v.state === "delivered") && v.recordedBy) return approvedWords(v, people.name, me);
  if (v.state === "approved" || v.state === "delivered")
    return v.approvedBy ? `${copy.byYou(people.name(v.approvedBy), v.approvedBy === me, true)} approved` : "Approved";
  if (v.state === "changes_requested") return "Changes asked for";
  if (v.checkedBy) return v.checkedBy === me ? "You checked it" : copy.checkedBy(people.name(v.checkedBy));
  return copy.versionState[v.state];
}

export interface ReviewViewerProps {
  /** The creatives to move through, in order, already under their customer names. */
  set: Creative[];
  /** The campaign of each (one campaign, or several on a collection). */
  campaigns: Campaign[];
  creativeId: Id;
  /** Every creative of the campaign as the customer sees it, so the change request knows what still applies. */
  all?: Creative[];
  /** The campaign's conversation, for "Ask Fume about one more" when the change requests are used up. */
  threadId?: Id;
  onMove: (id: Id) => void;
  onClose: () => void;
}

/**
 * The viewer as a layer. The layer stays while she moves through the set (so focus, Esc and the keys stay with it);
 * only what is about the creative changes. It renders nothing (and closes) when the creative is no longer in view.
 * `?ask=1` with the creative opens it as if N was pressed (Needs changes on the review page's bar, round 13).
 */
export function ReviewViewer({ set, campaigns, creativeId, all, threadId, onMove, onClose }: ReviewViewerProps) {
  const session = useSession().data!;
  const people = directory(usePeople().data);
  const can = rights(session.role);
  const agency = useAgencyScope() === "agency";
  const index = set.findIndex((c) => c.id === creativeId);
  const creative = index >= 0 ? set[index] : undefined;
  const campaign = creative ? campaigns.find((k) => k.id === creative.campaignId) : undefined;
  const gone = !creative || !campaign;

  // ?ask=1 is read once, for the creative it came with, and taken off the address.
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [asked] = useState(() => params.get("ask") === "1");
  const first = useRef(creativeId);
  const moved = useRef(false);
  if (creativeId !== first.current) moved.current = true;
  useEffect(() => {
    if (!params.has("ask")) return;
    const p = new URLSearchParams(params);
    p.delete("ask");
    setParams(p, { replace: true, state: location.state });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const move = useRef(onMove);
  move.current = onMove;
  const decisions = useDecisions(move, alive);
  const escape = useRef<(e: KeyboardEvent) => void>(() => undefined);
  const root = useRef<HTMLDivElement>(null);
  /** The control she last used, so it has focus again on the next creative ("next", "approve"). */
  const keep = useRef<string | null>(null);

  useEffect(() => {
    if (gone) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gone]);

  // Closed, focus goes back to what opened the viewer (the tile, SHELL's returnFocusTo). When that is gone (the grid
  // redrew it after an approval) it goes to the same creative's new tile, or the tile of the one she was looking at,
  // never to the page's body (DWAY-1). Nothing is given back when she left the page from the viewer.
  const [opener] = useState(currentOpener);
  const last = useRef(creativeId);
  last.current = creativeId;
  useEffect(
    () => () => {
      const ids = [opener?.closest<HTMLElement>("[data-creative]")?.dataset.creative, last.current];
      requestAnimationFrame(() => {
        const a = document.activeElement;
        if (a && a !== document.body) return;
        if (opener?.isConnected && returnFocusTo(opener)) return;
        const tile = ids
          .map(
            (id) => id && document.querySelector<HTMLElement>(`[data-creative="${CSS.escape(id)}"] .ui-creative-media`),
          )
          .find(Boolean);
        if (tile) tile.focus();
        else returnFocusTo(opener);
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  if (!creative || !campaign) return null;

  // Focus never falls to the page under the layer (DWAY-1): what loses it hands it to the layer itself.
  const guard = (e: ReactFocusEvent<HTMLDivElement>) => {
    if (e.relatedTarget) return;
    requestAnimationFrame(() => {
      const a = document.activeElement;
      if ((!a || a === document.body) && root.current?.isConnected) root.current.focus({ preventScroll: true });
    });
  };
  const remember = (e: ReactFocusEvent<HTMLDivElement>) => {
    keep.current = (e.target as HTMLElement).closest<HTMLElement>("[data-keep]")?.dataset.keep ?? null;
  };

  return (
    <ViewerLayer
      ref={root}
      className="ui-rv"
      label={creative.title}
      onClose={onClose}
      onEscape={(e) => escape.current(e)}
      onBlurCapture={guard}
      onFocusCapture={remember}
    >
      <Viewer
        key={creative.id}
        creative={creative}
        campaign={campaign}
        set={set}
        index={index}
        all={all}
        threadId={threadId}
        people={people}
        can={can}
        agency={agency}
        mayDownload={canTake(session.role)}
        me={session.user.id}
        startAsking={asked && !moved.current}
        escape={escape}
        root={root}
        keep={keep}
        decisions={decisions}
        onMove={onMove}
        onClose={onClose}
      />
    </ViewerLayer>
  );
}

function Viewer({
  creative,
  campaign,
  set,
  index,
  all,
  threadId,
  people,
  can,
  agency,
  mayDownload,
  me,
  startAsking,
  escape,
  root,
  keep,
  decisions,
  onMove,
  onClose,
}: {
  creative: Creative;
  campaign: Campaign;
  set: Creative[];
  index: number;
  all?: Creative[];
  threadId?: Id;
  people: People;
  can: Rights;
  /** One of the agency's people in a client brand: Send to Maja and Record an approval instead of Approve. */
  agency: boolean;
  mayDownload: boolean;
  me: Id;
  startAsking: boolean;
  escape: MutableRefObject<(e: KeyboardEvent) => void>;
  root: RefObject<HTMLDivElement>;
  keep: MutableRefObject<string | null>;
  decisions: Decisions;
  onMove: (id: Id) => void;
  onClose: () => void;
}) {
  const ids = useId();
  const toast = useToast();
  const touch = useTouch();
  const phone = useNarrowScreen(PHONE);
  const desk = useNarrowScreen(TOAST_DESK);
  const who = useChangeRecipient();
  const v = creative.current;
  const comments = useReviewComments(creative.id);
  const tray = useChangeTray(campaign.id, all ?? set);
  const n = set.length;
  const waiting = v.state === "checked";
  const approved = v.state === "approved" || v.state === "delivered";
  const marked = tray.get(creative.id);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [active, setActive] = useState<Id | null>(null);
  const [comparing, setComparing] = useState(false);
  /** Needs changes on a creative with no open comment: the composer asks what should change, and her comment marks it. */
  const [asking, setAsking] = useState(false);
  const [sheet, setSheet] = useState(false);
  const composer = useRef<HTMLTextAreaElement>(null);
  const sender = useSendChanges({ campaign, tray, threadId, onSent: onClose });
  // The agency (round 11): the client approves; the agency sends or records. Approve is never theirs.
  const mayApprove = can.approve && !agency;
  const { waitingOn } = useCampaignSends(campaign.id, agency);
  const withClient = agency ? waitingOn(v) : undefined;
  const [clientPanel, setClientPanel] = useState<"send" | "record" | null>(null);
  const checkedSet = useMemo(() => set.filter((c) => c.current.state === "checked"), [set]);
  /** Every creative in the set has an answer: approved (or otherwise decided), or marked "Needs changes". */
  const answered = set.every((c) => c.current.state !== "checked" || tray.has(c.id));

  // A new creative: focus goes back to the control she used (next, approve), or to the layer.
  useEffect(() => {
    const a = document.activeElement;
    if (a && a !== document.body && root.current?.contains(a)) return;
    const again = keep.current ? root.current?.querySelector<HTMLElement>(`[data-keep="${keep.current}"]`) : null;
    (again ?? root.current)?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (d: number) => {
    if (n < 2) return;
    onMove(set[(index + d + n) % n]!.id);
  };
  /** After a decision: the next creative that still waits and is not marked, or close. */
  const onward = () => {
    for (let k = 1; k < n; k += 1) {
      const next = set[(index + k) % n]!;
      if (next.id !== creative.id && next.current.state === "checked" && !tray.has(next.id)) return onMove(next.id);
    }
    onClose();
  };
  const approve = () => {
    if (!waiting || !mayApprove || decisions.approving) return;
    decisions.approve(creative);
    if (marked) tray.remove(creative.id);
    onward();
  };

  // The comments on this creative: the open ones first in time order, pins numbered in the order they were dropped.
  const mine = useMemo(
    () => (comments.data ?? []).filter((c) => c.versionId === v.id || c.creativeId === creative.id),
    [comments.data, v.id, creative.id],
  );
  const pinned = mine.filter((c) => c.pin);
  const number = (c: ReviewComment) => pinned.indexOf(c) + 1;
  const open = mine.filter((c) => !c.resolved);
  const resolved = mine.filter((c) => c.resolved);

  const writeHere = () => {
    setSheet(true);
    requestAnimationFrame(() => composer.current?.focus());
  };
  /** Marks it "Needs changes" (its open comments are the change list); with no comment yet, asks what should change.
   *  Pressed again, the mark is taken back. */
  const needsChanges = () => {
    if (!waiting || !can.ask) return;
    if (marked) {
      tray.remove(creative.id);
      setAsking(false);
      return;
    }
    if (asking) {
      setAsking(false);
      return;
    }
    if (open.length === 0) {
      setAsking(true);
      writeHere();
      return;
    }
    tray.put(markOf(creative));
    decisions.changed(creative);
  };
  /** A comment she wrote while the composer asked what should change marks the creative. */
  const posted = () => {
    if (!asking || !waiting || marked) return;
    setAsking(false);
    tray.put(markOf(creative));
    decisions.changed(creative);
  };
  const setProduct = (on: boolean) => {
    if (!waiting || !can.ask) return;
    if (!marked && on) decisions.changed(creative);
    if (!on && !marked) return;
    if (!on && marked && open.length === 0) return tray.remove(creative.id);
    tray.put(markOf(creative, on ? ["product"] : []));
    setAsking(false);
  };
  // ?ask=1 (Needs changes on the review page): once the comments are here, the same as pressing N.
  const askedOnce = useRef(false);
  useEffect(() => {
    if (!startAsking || askedOnce.current || comments.isPending) return;
    askedOnce.current = true;
    if (!marked) needsChanges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startAsking, comments.isPending]);

  // Keys (DWAY-2, decision 3; round 13, #31, #32): ← → move whenever focus is not in a text field, A approves, N marks
  // "Needs changes", C goes to the comment field, Backspace or ⌘Z takes the last decision back. Never an arrow to
  // approve. Inside a field the keys stay the field's; Escape is the layer's (below).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      // An empty field has no caret to move, so ← → still move there (the comment field after a post, #31).
      const arrow = (k === "ArrowRight" || k === "ArrowLeft") && emptyField(e.target);
      if (e.altKey || (inField(e.target) && !arrow) || sender.dialog || clientPanel) return;
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && k.toLowerCase() === "z") {
        if (decisions.undoLast(tray)) e.preventDefault();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      if (k === "ArrowRight") go(1);
      else if (k === "ArrowLeft") go(-1);
      else if (e.defaultPrevented || e.repeat) return;
      else if ((k === "a" || k === "A") && waiting && mayApprove) approve();
      else if ((k === "n" || k === "N") && waiting && can.ask) needsChanges();
      else if ((k === "c" || k === "C") && waiting && can.ask) writeHere();
      else if (k === "Backspace") {
        if (!decisions.undoLast(tray)) return;
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  // Escape takes away what is nearest first (DWAY-1): the pin being written, a field's focus, the question what should
  // change, the comment sheet on a phone; only then does the layer close. Focus goes to the layer, never to the page.
  escape.current = (e) => {
    e.preventDefault();
    const toLayer = () => root.current?.focus({ preventScroll: true });
    if (draft) {
      setDraft(null);
      toLayer();
    } else if (inField(e.target)) {
      (e.target as HTMLElement).blur();
      toLayer();
    } else if (asking) setAsking(false);
    else if (phone && sheet) setSheet(false);
    else onClose();
  };
  // A press on the creative drops a pin there (a key press, with no pointer position, drops it in the middle).
  const place = (e: MouseEvent<HTMLButtonElement>) => {
    if (!can.ask || !waiting) return;
    const b = e.currentTarget.getBoundingClientRect();
    const keyboard = e.detail === 0 || b.width === 0;
    const x = keyboard ? 0.5 : Math.min(1, Math.max(0, (e.clientX - b.left) / b.width));
    const y = keyboard ? 0.5 : Math.min(1, Math.max(0, (e.clientY - b.top) / b.height));
    setDraft({ x, y });
    setActive(null);
    if (phone) writeHere();
  };

  const download = () => {
    const a = document.createElement("a");
    a.href = v.image;
    a.download = `${creative.name}.jpg`;
    document.body.appendChild(a);
    try {
      a.click();
    } finally {
      a.remove();
    }
    toast.done(`Downloading ${creative.title}`, { meta: copy.format[creative.format].ratio });
  };

  const versions = creative.versions;
  const before = versions.length > 1 ? versions[versions.length - 2] : undefined;
  const writable = can.ask && waiting;
  /** The expert checked it: the Amber pointer beside who (rule check-states; round 13, #28). */
  const checked = v.checkedBy
    ? v.checkedBy === me
      ? "Checked by you"
      : copy.checkedBy(people.name(v.checkedBy))
    : undefined;
  /** The frame never grows past the creative's own pixels (DLAY-1). */
  const real = { "--real-w": `${v.width || 1080}px` } as CSSProperties;
  const product = Boolean(marked?.tags.includes("product"));

  return (
    <div className="ui-rv-screen" data-sheet={sheet ? "open" : "closed"} data-panel="comments">
      {/* ── the bar: close and what this is at the left; compare, then ← → · previous · 3 of 6 · next at a fixed place ── */}
      <header className="ui-rv-bar">
        <Button
          variant="glass-clear"
          iconOnly
          icon="x"
          aria-label="Close"
          shortcut="Esc"
          data-keep="close"
          onClick={onClose}
        />
        <div className="ui-rv-title">
          <ViewerLayerTitle asChild>
            <h1>{creative.title}</h1>
          </ViewerLayerTitle>
          <span className="ui-rv-sub">
            {approved ? <span className="ui-rv-file">{creative.name}</span> : <span>{shapeLine(creative)}</span>}
            {checked && (
              <span className="ui-rv-checked">
                <Icon name="fume-check" />
                {checked}
              </span>
            )}
          </span>
        </div>
        <div className="ui-rv-tools">
          {before && (
            <Button
              variant="glass-clear"
              size="sm"
              icon="columns-2"
              className="ui-viewer-tool ui-rv-compare"
              aria-pressed={comparing}
              data-keep="compare"
              onClick={() => setComparing((c) => !c)}
            >
              <span className="ui-rv-compare-label">Compare versions</span>
            </Button>
          )}
          {n > 1 && (
            <div className="ui-rv-nav" role="group" aria-label="Creatives in this set">
              <span
                className="ui-rv-nav-keys ui-keys-hint"
                title="The arrow keys move to the previous and the next creative"
              >
                <KbdGroup aria-hidden="true">
                  <Kbd>←</Kbd>
                  <Kbd>→</Kbd>
                </KbdGroup>
              </span>
              <Button
                variant="glass-clear"
                iconOnly
                icon="chevron-left"
                aria-label="The previous creative"
                aria-keyshortcuts="ArrowLeft"
                shortcut="←"
                data-keep="previous"
                onClick={() => go(-1)}
              />
              <span className="ui-rv-count" aria-live="polite">
                {index + 1} of {n}
              </span>
              <Button
                variant="glass-clear"
                iconOnly
                icon="chevron-right"
                aria-label="The next creative"
                aria-keyshortcuts="ArrowRight"
                shortcut="→"
                data-keep="next"
                onClick={() => go(1)}
              />
            </div>
          )}
        </div>
      </header>

      {/* ── the stage: the creative as large as the stage allows, its pins; or two versions side by side ── */}
      <main className="ui-rv-stage" data-compare={comparing && before ? "" : undefined}>
        {comparing && before ? (
          <>
            <figure
              className="ui-rv-frame"
              data-format={creative.format}
              style={{ "--real-w": `${before.width || 1080}px` } as CSSProperties}
            >
              <div className="ui-rv-media">
                <img src={before.image} alt={`${creative.title}, version ${before.number}`} draggable={false} />
              </div>
              <figcaption className="ui-rv-caption">
                <b>Version {before.number}</b> <CheckedIcon v={before} />
                {versionWords(before, people, me)}
              </figcaption>
            </figure>
            <figure className="ui-rv-frame" data-format={creative.format} style={real}>
              <div className="ui-rv-media">
                <img src={v.image} alt={`${creative.title}, version ${v.number}`} draggable={false} />
              </div>
              <figcaption className="ui-rv-caption">
                <b>Version {v.number}</b> Now · <CheckedIcon v={v} />
                {versionWords(v, people, me)}
              </figcaption>
            </figure>
          </>
        ) : (
          <figure className="ui-rv-frame" data-format={creative.format} style={real}>
            <button
              type="button"
              className="ui-rv-media"
              data-pinnable={writable ? "" : undefined}
              aria-label={writable ? `Pin a comment on ${creative.title}` : creative.title}
              aria-describedby={writable ? `${ids}-hint` : undefined}
              onClick={place}
            >
              <img src={v.image} alt="" draggable={false} />
            </button>
            {pinned
              .filter((c) => !c.resolved)
              .map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="ui-qg-pin"
                  style={pos(c.pin!.x, c.pin!.y)}
                  aria-expanded={active === c.id}
                  aria-label={`Pin ${number(c)}: ${people.name(c.by)}, “${c.text}”`}
                  onClick={() => {
                    setActive(c.id);
                    setDraft(null);
                    setSheet(true);
                    requestAnimationFrame(() =>
                      document
                        .getElementById(`${ids}-c-${c.id}`)
                        ?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
                    );
                  }}
                >
                  {number(c)}
                </button>
              ))}
            {draft && (
              <>
                <span className="ui-qg-pin is-new" data-state="draft" style={pos(draft.x, draft.y)} aria-hidden="true">
                  {pinned.length + 1}
                </span>
                {!phone && (
                  <PinBox
                    draft={draft}
                    n={pinned.length + 1}
                    creative={creative}
                    versionId={v.id}
                    placeholder={asking ? "What should change here" : undefined}
                    onPosted={posted}
                    onDone={() => {
                      setDraft(null);
                      root.current?.focus({ preventScroll: true });
                    }}
                  />
                )}
              </>
            )}
          </figure>
        )}
      </main>

      {/* ── the decision, at one place for every creative: the hint on the left (toasts land here on a desk, never
           over the panel), the pills on the right, each with its key in it ── */}
      <div className="ui-rv-decide" data-ui-foot={desk ? undefined : ""}>
        <p className="ui-rv-hint" id={`${ids}-hint`} data-ui-toast-anchor={desk ? "" : undefined}>
          {writable && (
            <>
              <span>{touch ? "Tap the creative to pin a comment" : "Click the creative to pin a comment"}</span>
              <span className="ui-keys-hint">
                {" · "}
                <Kbd>C</Kbd> to write one
              </span>
            </>
          )}
        </p>
        <div className="ui-rv-decision">
          {!waiting ? (
            <p className="ui-viewer-status ui-rv-status">
              {checkedOnly(v) ? <CheckedIcon v={v} /> : <Icon name={approved ? "circle-check" : "clock"} />}
              {versionWords(v, people, me)}
              {v.approvedAt && <span className="ui-viewer-status-time">{when(v.approvedAt)}</span>}
            </p>
          ) : agency && v.state === "checked" ? (
            <p className="ui-viewer-status ui-rv-status">
              <Icon name={withClient ? "clock" : "circle-check"} />
              {sendState(withClient)}
            </p>
          ) : null}
          {waiting && can.ask && (
            <KeyButton
              keyName="N"
              tip={marked ? "Needs changes: press again to take it back" : "Needs changes"}
              variant={can.approve || agency ? "glass-clear" : "glass-white"}
              icon={marked ? "check" : "message-square"}
              aria-pressed={Boolean(marked) || asking}
              data-keep="needs"
              onClick={needsChanges}
            >
              Needs changes
            </KeyButton>
          )}
          {waiting && mayApprove && (
            <KeyButton
              keyName="A"
              tip="Approve"
              variant="glass-white"
              icon="check"
              data-keep="approve"
              loading={decisions.approving}
              onClick={approve}
            >
              Approve
            </KeyButton>
          )}
          {waiting && agency && can.approve && (
            <>
              <Button variant="glass-clear" icon="check" data-keep="record" onClick={() => setClientPanel("record")}>
                Record an approval
              </Button>
              <Button
                variant={withClient ? "glass-clear" : "glass-white"}
                icon="send"
                data-keep="send-client"
                onClick={() => setClientPanel("send")}
              >
                {withClient ? "Send again" : copy.send.action(firstName(people.name(campaign.approverId)))}
              </Button>
            </>
          )}
          {approved && mayDownload && (
            <span className="ui-rv-act">
              <Button variant="glass-white" icon="download" data-keep="download" onClick={download}>
                Download
              </Button>
            </span>
          )}
        </div>
      </div>

      {/* ── the panel: the one place to write. What needs changing on this creative at its top, the comments, and
           the set's "Start the changes" at its foot ── */}
      <aside className="ui-rv-panel" aria-labelledby={`${ids}-comments`}>
        <Comments
          creative={creative}
          versionId={v.id}
          open={open}
          resolved={resolved}
          number={number}
          draft={phone ? draft : null}
          pinNumber={pinned.length + 1}
          onClearDraft={() => setDraft(null)}
          active={active}
          setActive={setActive}
          people={people}
          can={can}
          writable={writable}
          me={me}
          composer={composer}
          sheet={sheet}
          setSheet={setSheet}
          loading={comments.isPending}
          ids={ids}
          placeholder={asking ? `What should change in ${labelOf(creative)}` : undefined}
          onPosted={posted}
          note={
            writable && (marked || asking) ? (
              <div className="ui-rv-marked">
                <p className="ui-rv-marked-title">
                  <Icon name="message-square" />
                  {asking ? `What should change in ${labelOf(creative)}?` : "Needs changes"}
                </p>
                <p className="ui-rv-marked-text">
                  {asking
                    ? "Write it below or pin it on the creative. Your comment is the change list."
                    : open.length
                      ? `${open.length === 1 ? "Its open comment is" : `Its ${open.length} open comments are`} the change list. Add one more below if something is missing.`
                      : "Say below what should change."}
                </p>
                <Choice>
                  <Checkbox checked={product} onCheckedChange={(on) => setProduct(on === true)} />
                  <ChoiceText
                    label="The product itself is off"
                    hint={`${who === "Fume" ? "Fume’s" : `${who}’s`} own mistake: fixing it uses no change request.`}
                  />
                </Choice>
              </div>
            ) : null
          }
        />
        {tray.items.length > 0 && can.ask && (
          <div className="ui-rv-panel-foot ui-rv-tray" data-answered={answered ? "" : undefined}>
            <span className="ui-rv-tray-count">
              {answered ? "Every creative has an answer. " : ""}
              {copy.count(tray.items.length, "creative")} {tray.items.length === 1 ? "needs" : "need"} changes.
            </span>
            <Button
              variant={answered ? "glass-white" : "glass-clear"}
              size="sm"
              icon="send"
              loading={sender.pending}
              data-keep="start"
              onClick={sender.send}
            >
              {startWords(tray.items.length)}
            </Button>
          </div>
        )}
      </aside>
      {sender.dialog}
      {agency && (
        <>
          <SendToClientSheet
            campaign={campaign}
            creatives={checkedSet}
            initial={[creative.id]}
            open={clientPanel === "send"}
            onOpenChange={(o) => !o && setClientPanel(null)}
          />
          <RecordApprovalSheet
            campaign={campaign}
            creatives={checkedSet}
            initial={[creative.id]}
            open={clientPanel === "record"}
            onOpenChange={(o) => !o && setClientPanel(null)}
          />
        </>
      )}
    </div>
  );
}

/** A decision pill with its key in it, as a keycap that reads as a shortcut ("Approve  A"), and a tooltip that names
 *  both (round 13, #32). Touch screens hide the key (kbd.css). */
const KeyButton = forwardRef<HTMLButtonElement, ButtonProps & { keyName: string; tip: string }>(function KeyButton(
  { keyName, tip, children, className, ...props },
  ref,
) {
  return (
    <WithTooltip label={tip} shortcut={keyName} side="top">
      <Button ref={ref} aria-keyshortcuts={keyName} className={cx("ui-rv-keyed", className)} {...props}>
        {children}
        <Kbd className="ui-rv-btn-key" aria-hidden="true">
          {keyName}
        </Kbd>
      </Button>
    </WithTooltip>
  );
});

// ─── The comment box beside a new pin (desktop) ─────────────────────────────

/**
 * DWAY-16: the box opens next to the pin, 280 wide, on the pin's right or, near the stage's edge, its left (and above
 * it near the foot). Enter adds the comment (Shift+Enter a new line); Esc (the viewer's) takes the pin away.
 */
function PinBox({
  draft,
  n,
  creative,
  versionId,
  placeholder = "What do you see here",
  onPosted,
  onDone,
}: {
  draft: Draft;
  n: number;
  creative: Creative;
  versionId: Id;
  placeholder?: string;
  /** After the comment is added (it marks the creative when she was asked what should change). */
  onPosted?: () => void;
  onDone: () => void;
}) {
  const id = useId();
  const add = useAddReviewComment();
  const toast = useToast();
  const box = useRef<HTMLFormElement>(null);
  const [text, setText] = useState("");
  const [flip, setFlip] = useState({ x: false, y: false });

  useLayoutEffect(() => {
    const el = box.current;
    const stage = el?.closest(".ui-rv-stage");
    if (!el || !stage) return;
    const r = el.getBoundingClientRect();
    const s = stage.getBoundingClientRect();
    setFlip({ x: r.right > s.right, y: r.bottom > s.bottom });
  }, [draft.x, draft.y]);

  const send = (e?: FormEvent) => {
    e?.preventDefault();
    const t = text.trim();
    if (!t) return;
    add.mutate(
      { creativeId: creative.id, versionId, text: t, pin: { x: draft.x, y: draft.y } },
      {
        onSuccess: () => {
          onPosted?.();
          onDone();
        },
        onError: (err) => toast.error("The comment wasn’t added", { description: err.message }),
      },
    );
  };

  return (
    <form
      ref={box}
      className="ui-rv-pinbox"
      style={pos(draft.x, draft.y)}
      data-flip-x={flip.x ? "" : undefined}
      data-flip-y={flip.y ? "" : undefined}
      onSubmit={send}
    >
      <label className="ui-sr-only" htmlFor={id}>
        Comment on pin {n}
      </label>
      <Textarea
        id={id}
        autoFocus
        rows={2}
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            send();
          }
        }}
      />
      <div className="ui-rv-pinbox-foot">
        <span className="ui-rv-pinbox-keys ui-keys-hint">
          <Kbd>↵</Kbd> Add <Kbd>Esc</Kbd> Cancel
        </span>
        <Button
          type="submit"
          variant="glass-white"
          size="sm"
          icon="send"
          loading={add.isPending}
          disabled={!text.trim()}
        >
          Add
        </Button>
      </div>
    </form>
  );
}

// ─── Approve at once, Undo, and the last decision back ──────────────────────

interface Approval {
  kind: "approve";
  creativeId: Id;
  versionId: Id;
  /** Its short label ("Feed A2"), for the toasts. */
  title: string;
}
type Decision = Approval | { kind: "change"; creativeId: Id; title: string };
type Decisions = ReturnType<typeof useDecisions>;

/**
 * The decisions made in this viewer, so Backspace or ⌘Z can take the last one back and Undo can return her to the
 * creative it undid (DTSK-8). Approvals made one after the other count up in one toast, "3 creatives approved · Undo",
 * instead of piling up (DLOAD-12).
 */
function useDecisions(move: MutableRefObject<(id: Id) => void>, alive: MutableRefObject<boolean>) {
  const approveIt = useApprove();
  const unapprove = useUnapprove();
  const toast = useToast();
  const history = useRef<Decision[]>([]);
  const streak = useRef<{ handle: ToastHandle; items: Approval[]; at: number } | null>(null);
  const back = (id: Id) => {
    if (alive.current) move.current(id);
  };
  /** The approvals toast while it is still on screen. */
  const live = () => {
    const s = streak.current;
    return s && Date.now() - s.at < tokenMs("--ui-toast-duration-long", 8000) - 400 ? s : null;
  };
  const undo = (items: Approval[]) => {
    if (streak.current?.items === items) streak.current = null;
    history.current = history.current.filter((h) => !items.includes(h as Approval));
    unapprove.mutateAsync(items.map((i) => i.versionId)).then(
      () => {
        toast.info(
          items.length === 1
            ? `${items[0]!.title} waits on you again`
            : `${copy.creatives(items.length)} wait on you again`,
        );
        back(items[0]!.creativeId);
      },
      (e: Error) => toast.error("The approval stays", { description: e.message }),
    );
  };
  const show = (items: Approval[]) => {
    const s = live();
    if (!items.length) {
      s?.handle.dismiss();
      streak.current = null;
      return;
    }
    const title = items.length === 1 ? `${items[0]!.title} approved` : `${copy.creatives(items.length)} approved`;
    const action = { label: "Undo", onClick: () => undo(items) };
    if (s) {
      s.handle.update({ title, action });
      streak.current = { handle: s.handle, items, at: Date.now() };
    } else streak.current = { handle: toast.done(title, { action }), items, at: Date.now() };
  };

  return {
    approving: approveIt.isPending,
    /** Approves at once; the promise, not mutate's callbacks, since the viewer moves on (or closes) straight away. */
    approve: (c: Creative) => {
      const a: Approval = { kind: "approve", creativeId: c.id, versionId: c.current.id, title: labelOf(c) };
      approveIt.mutateAsync([a.versionId]).then(
        () => {
          history.current.push(a);
          const s = live();
          show(s ? [...s.items, a] : [a]);
        },
        (e: Error) => {
          toast.error("It wasn’t approved", { description: e.message });
          back(a.creativeId);
        },
      );
    },
    changed: (c: Creative) => {
      history.current.push({ kind: "change", creativeId: c.id, title: labelOf(c) });
    },
    /** Takes the last decision back and returns to its creative; false when there is none. */
    undoLast: (tray: ChangeTray): boolean => {
      const last = history.current.pop();
      if (!last) return false;
      if (last.kind === "approve") {
        const s = live();
        if (s?.items.includes(last)) show(s.items.filter((i) => i !== last));
        unapprove.mutateAsync([last.versionId]).then(
          () => {
            toast.info(`${last.title} waits on you again`);
            back(last.creativeId);
          },
          (e: Error) => toast.error("The approval stays", { description: e.message }),
        );
      } else {
        tray.remove(last.creativeId);
        toast.info(`${last.title} no longer needs changes`);
        back(last.creativeId);
      }
      return true;
    },
  };
}

// ─── Comments ───────────────────────────────────────────────────────────────

function Comments({
  creative,
  versionId,
  open,
  resolved,
  number,
  draft,
  pinNumber,
  onClearDraft,
  active,
  setActive,
  people,
  can,
  writable,
  me,
  composer,
  sheet,
  setSheet,
  loading,
  ids,
  placeholder,
  onPosted,
  note,
}: {
  creative: Creative;
  versionId: Id;
  open: ReviewComment[];
  resolved: ReviewComment[];
  number: (c: ReviewComment) => number;
  /** A pin waiting for its words: only on a phone, where the composer writes it (a desk writes beside the pin). */
  draft: Draft | null;
  pinNumber: number;
  onClearDraft: () => void;
  active: Id | null;
  setActive: (id: Id | null) => void;
  people: People;
  can: Rights;
  writable: boolean;
  me: Id;
  composer: RefObject<HTMLTextAreaElement>;
  sheet: boolean;
  setSheet: (open: boolean) => void;
  loading: boolean;
  ids: string;
  /** The field's words when it asks something ("What should change in Feed 3"). */
  placeholder?: string;
  /** After a comment is added. */
  onPosted?: () => void;
  /** What needs changing on this creative, between the head and the comments (round 13). */
  note?: ReactNode;
}) {
  const add = useAddReviewComment();
  const toast = useToast();
  const touch = useTouch();
  const [text, setText] = useState("");
  const [showResolved, setShowResolved] = useState(false);

  const send = (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    add.mutate(
      { creativeId: creative.id, versionId, text: t, pin: draft ?? undefined },
      {
        onSuccess: () => {
          setText("");
          onClearDraft();
          onPosted?.();
        },
        onError: (err) => toast.error("The comment wasn’t added", { description: err.message }),
      },
    );
  };

  const count = open.length;
  return (
    <>
      <div className="ui-rv-panel-head">
        <h2 id={`${ids}-comments`} className="ui-rv-panel-title">
          Comments
        </h2>
        {count > 0 && <span className="ui-rv-panel-meta">{count}</span>}
      </div>
      <button type="button" className="ui-rv-handle" aria-expanded={sheet} onClick={() => setSheet(!sheet)}>
        <span className="ui-rv-panel-title">Comments</span>
        {count > 0 && <span className="ui-rv-panel-meta">{count}</span>}
        <Icon name={sheet ? "chevron-down" : "chevron-up"} />
      </button>
      {note}

      <div className="ui-rv-panel-body">
        {loading ? (
          <p className="ui-rv-empty">Loading the comments</p>
        ) : count === 0 ? (
          <p className="ui-rv-empty">
            {writable
              ? `No comments yet. ${touch ? "Tap" : "Click"} a spot on the creative to pin one, or write below.`
              : "No comments yet."}
          </p>
        ) : (
          <ol className="ui-rv-comments">
            {open.map((c) => (
              <CommentItem
                key={c.id}
                c={c}
                n={c.pin ? number(c) : undefined}
                active={active === c.id}
                onFocus={() => setActive(c.id)}
                people={people}
                can={can}
                me={me}
                ids={ids}
              />
            ))}
          </ol>
        )}

        {resolved.length > 0 && (
          <div className="ui-rv-resolved">
            <Button
              variant="glass-clear"
              size="sm"
              iconEnd={showResolved ? "chevron-up" : "chevron-down"}
              aria-expanded={showResolved}
              onClick={() => setShowResolved((s) => !s)}
            >
              {copy.count(resolved.length, "resolved comment")}
            </Button>
            {showResolved && (
              <ol className="ui-rv-comments">
                {resolved.map((c) => (
                  <CommentItem
                    key={c.id}
                    c={c}
                    n={c.pin ? number(c) : undefined}
                    active={false}
                    onFocus={() => undefined}
                    people={people}
                    can={can}
                    me={me}
                    ids={ids}
                  />
                ))}
              </ol>
            )}
          </div>
        )}
      </div>

      {writable && (
        <form className="ui-rv-compose" onSubmit={send}>
          {draft && (
            <span className="ui-rv-draft">
              <span className="ui-rv-num" data-state="draft" aria-hidden="true">
                {pinNumber}
              </span>
              Pin {pinNumber} on the creative
              <Button
                variant="glass-clear"
                size="sm"
                iconOnly
                icon="x"
                aria-label={`Take pin ${pinNumber} away`}
                onClick={onClearDraft}
              />
            </span>
          )}
          <label className="ui-sr-only" htmlFor={`${ids}-text`}>
            {draft ? `Comment on pin ${pinNumber}` : "A comment"}
          </label>
          <div className="ui-rv-compose-row">
            <Textarea
              id={`${ids}-text`}
              ref={composer}
              rows={1}
              value={text}
              placeholder={placeholder ?? (draft ? "What do you see here" : "Write a comment")}
              onChange={(e) => setText(e.target.value)}
              onFocus={() => setSheet(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <Button
              type="submit"
              variant="glass-clear"
              iconOnly
              icon="send"
              aria-label="Add the comment"
              shortcut="↵"
              loading={add.isPending}
              disabled={!text.trim()}
            />
          </div>
        </form>
      )}
    </>
  );
}

function CommentItem({
  c,
  n,
  active,
  onFocus,
  people,
  can,
  me,
  ids,
}: {
  c: ReviewComment;
  n?: number;
  active: boolean;
  onFocus: () => void;
  people: People;
  can: Rights;
  me: Id;
  ids: string;
}) {
  const add = useAddReviewComment();
  const resolve = useResolveReviewComment();
  const toast = useToast();
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState("");
  const who = (id: Id) => (id === me ? "You" : people.name(id));
  const author = people.user(c.by);

  const sendReply = (e: FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    add.mutate(
      { creativeId: c.creativeId, versionId: c.versionId, text: reply.trim(), replyTo: c.id },
      {
        onSuccess: () => {
          setReply("");
          setReplying(false);
        },
        onError: (err) => toast.error("The reply wasn’t added", { description: err.message }),
      },
    );
  };

  return (
    <li
      className="ui-rv-comment"
      id={`${ids}-c-${c.id}`}
      data-active={active ? "" : undefined}
      data-resolved={c.resolved ? "" : undefined}
      onFocusCapture={onFocus}
    >
      <div className="ui-rv-comment-head">
        {n !== undefined ? (
          <span className="ui-rv-num" aria-label={`Pin ${n}`}>
            {n}
          </span>
        ) : null}
        <Avatar
          size="sm"
          src={author?.avatar}
          initials={sign(author).initials}
          ink={author?.staffRole === "expert"}
          alt=""
        />
        <span className="ui-rv-comment-who">{who(c.by)}</span>
        <time className="ui-rv-comment-time" dateTime={c.at}>
          {when(c.at)}
        </time>
      </div>
      <p className="ui-rv-comment-text">{c.text}</p>
      {c.replies.length > 0 && (
        <ul className="ui-rv-replies">
          {c.replies.map((r) => (
            <li key={r.id} className="ui-rv-reply">
              <span className="ui-rv-comment-who">{who(r.by)}</span>
              <time className="ui-rv-comment-time" dateTime={r.at}>
                {when(r.at)}
              </time>
              <p className="ui-rv-comment-text">{r.text}</p>
            </li>
          ))}
        </ul>
      )}
      {can.ask && (
        <div className="ui-rv-comment-actions">
          {!c.resolved && (
            <Button
              variant="glass-clear"
              size="sm"
              icon="reply"
              onClick={() => setReplying((r) => !r)}
              aria-expanded={replying}
            >
              Reply
            </Button>
          )}
          <Button
            variant="glass-clear"
            size="sm"
            icon={c.resolved ? "rotate-ccw" : "check"}
            loading={resolve.isPending}
            onClick={() =>
              resolve.mutate(c.id, {
                onError: (err) => toast.error("That didn’t change", { description: err.message }),
              })
            }
          >
            {c.resolved ? "Open again" : "Resolve"}
          </Button>
        </div>
      )}
      {replying && (
        <form className="ui-rv-compose-row" onSubmit={sendReply}>
          <label className="ui-sr-only" htmlFor={`${ids}-r-${c.id}`}>
            Reply to {firstName(author?.name ?? "them")}
          </label>
          <Textarea
            id={`${ids}-r-${c.id}`}
            rows={1}
            value={reply}
            placeholder="Reply"
            autoFocus
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <Button
            type="submit"
            variant="glass-clear"
            iconOnly
            icon="send"
            aria-label="Send the reply"
            shortcut="↵"
            loading={add.isPending}
            disabled={!reply.trim()}
          />
        </form>
      )}
    </li>
  );
}
