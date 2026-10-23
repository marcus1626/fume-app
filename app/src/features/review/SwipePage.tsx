// Swipe through (FLOWS §11; UX review 19 Oct, TASK-4, TASK-21): the creatives that wait on her, one at a time, full
// screen on the dark stage, as a layer over the campaign's review (?swipe=1). Approve (swipe right, →) acts at once,
// like the viewer's Approve, with Undo in the toast; Ask for changes (left, ←) says in one line what should change
// and puts the creative in the set's change request; Comment (up, ↑) adds the comment at once. So closing never
// throws anything away: what is approved is approved, and the change request waits on the review page until it is
// sent, once, as one. The end says what she decided and offers the change request's one Send.
// For a member (who may not approve) right is "Looks good": a note to the approver.
// Round 9 (PROPOSED 19 Oct 2026, UX review DWAY-2, DTSK-9, DTSK-15): Swipe through is the phone's; on a desk with a mouse
// the review page does not offer it and its address opens the viewer. Where a keyboard is used anyway, the keys are the
// viewer's: A approves, C asks for changes, ← → only move, Backspace or ⌘Z takes the last decision back. Never an
// arrow to approve. The change request's Send sends at once, with Undo.
// /review/:campaignId/swipe is the old address: it opens the same layer.
// Round 13 (Marcus #33, #34; PROPOSED 21 Oct 2026): left is "Needs changes": its one line is a comment, posted at once
// like every comment, and the creative is marked, so its open comments are the change list. The end offers "Start the
// changes" for the marked ones (the review page has it too). Keys: A approves, N marks Needs changes, C comments.
import { Button, Icon, Input, Kbd, KbdGroup, Progress, ViewerLayer, ViewerLayerTitle, useToast } from "@fume/ui";
import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useAddReviewComment, useApprove, usePeople, useSession, useUnapprove } from "../../api/hooks";
import type { Campaign, Creative, Id } from "../../contract";
import * as copy from "../../copy";
import { directory, firstName } from "../../shell/people";
import { labelOf, shapeLine } from "./names";
import { markOf, startWords, useSendChanges } from "./parts";
import { useChangeTray } from "./tray";

/** The old address: Swipe through over the campaign's review. */
export function SwipePage() {
  const { campaignId } = useParams<"campaignId">();
  return <Navigate to={`/campaigns/${campaignId}/review?swipe=1`} replace />;
}

type Verdict = "yes" | "no" | "comment";
type Ask = "no" | "comment" | null;

/** How far a swipe has to travel before it counts; shorter, the creative glides back. */
const THRESHOLD = 96;
/** How long a decided creative takes to leave (--ui-motion-base). */
const LEAVE_MS = 240;

const inField = (t: EventTarget | null) => t instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(t.tagName);

export interface SwipeThroughProps {
  campaign: Campaign;
  /** The creatives that waited when it opened, under their customer names. */
  set: Creative[];
  /** Every creative of the campaign as the customer sees it (for the change request). */
  all: Creative[];
  approver: string;
  canApprove: boolean;
  threadId?: Id;
  onClose: () => void;
}

export function SwipeThrough({ campaign, set, all, approver, canApprove, threadId, onClose }: SwipeThroughProps) {
  const ids = useId();
  const toast = useToast();
  const approve = useApprove();
  const unapprove = useUnapprove();
  const comment = useAddReviewComment();
  const tray = useChangeTray(campaign.id, all);
  const people = directory(usePeople().data);
  const me = useSession().data?.user.id;
  const n = set.length;
  const [i, setI] = useState(0);
  /** What she did here, so the end can say it. A creative approved and then undone drops out. */
  const [made, setMade] = useState<Record<Id, Verdict>>({});
  const [ask, setAsk] = useState<Ask>(null);
  const [text, setText] = useState("");
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [leaving, setLeaving] = useState<"right" | "left" | "up" | null>(null);
  const sender = useSendChanges({ campaign, tray, threadId, onSent: onClose });
  /** What she decided here, newest last, so Backspace can take the last one back. */
  const history = useRef<{ index: number; creative: Creative; verdict: Verdict }[]>([]);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const field = useRef<HTMLInputElement>(null);
  // The layer itself has focus when it opens, not the ✕ (whose tooltip would open with it); Esc and the keys work.
  const layer = useRef<HTMLDivElement>(null);
  useEffect(() => layer.current?.focus({ preventScroll: true }), []);
  const done = i >= n;
  const at = Math.min(i, n - 1);
  const creative = set[at]!;
  const approved = creative.current.state === "approved" || creative.current.state === "delivered";
  const inTray = tray.has(creative.id);
  const decided = approved || inTray;

  useEffect(() => {
    document.title = `Swipe through ${campaign.name} · Fume`;
  }, [campaign.name]);

  // Leaving: the creative glides out the way it was sent, then the next one comes in.
  const leave = (way: "right" | "left" | "up", verdict: Verdict) => {
    history.current.push({ index: at, creative, verdict });
    setMade((m) => ({ ...m, [creative.id]: verdict }));
    setAsk(null);
    setText("");
    setPin(null);
    setDrag(null);
    setLeaving(way);
    window.setTimeout(() => {
      setLeaving(null);
      setI((x) => x + 1);
    }, LEAVE_MS);
  };
  const next = () => setI((x) => x + 1);

  const yes = () => {
    if (decided) return next();
    const c = creative;
    const index = at;
    if (canApprove) {
      // Promises, not mutate's callbacks: the layer may be gone by the time they land.
      approve.mutateAsync([c.current.id]).then(
        () =>
          toast.done(`${labelOf(c)} approved`, {
            action: {
              label: "Undo",
              onClick: () =>
                unapprove.mutateAsync([c.current.id]).then(
                  () => {
                    setMade((m) => {
                      const rest = { ...m };
                      delete rest[c.id];
                      return rest;
                    });
                    setI(index);
                  },
                  (e: Error) => toast.error("The approval stays", { description: e.message }),
                ),
            },
          }),
        (e: Error) => toast.error("It wasn’t approved", { description: e.message }),
      );
    } else {
      comment.mutate({ creativeId: c.id, versionId: c.current.id, text: "Looks good to me." });
    }
    leave("right", "yes");
  };
  const askFor = (a: Exclude<Ask, null>) => {
    if (decided && a === "no") return;
    setDrag(null);
    setAsk(a);
    setText(a === "no" ? (tray.get(creative.id)?.text ?? "") : "");
    setPin(null);
    requestAnimationFrame(() => field.current?.focus());
  };
  const submitAsk = (e?: FormEvent) => {
    e?.preventDefault();
    if (!ask || !text.trim()) return;
    const c = creative;
    if (ask === "no") {
      // One place to write (round 13): what should change is a comment like any other, and the mark makes it the list.
      comment.mutate(
        { creativeId: c.id, versionId: c.current.id, text: text.trim(), pin: pin ?? undefined },
        { onError: (err) => toast.error("The comment wasn’t added", { description: err.message }) },
      );
      tray.put(markOf(c));
      leave("left", "no");
    } else {
      comment.mutate(
        { creativeId: c.id, versionId: c.current.id, text: text.trim(), pin: pin ?? undefined },
        { onError: (err) => toast.error("The comment wasn’t added", { description: err.message }) },
      );
      leave("up", "comment");
    }
  };
  const undoApproval = () =>
    unapprove.mutateAsync([creative.current.id]).then(
      () =>
        setMade((m) => {
          const rest = { ...m };
          delete rest[creative.id];
          return rest;
        }),
      (e: Error) => toast.error("The approval stays", { description: e.message }),
    );

  /** Backspace or ⌘Z: the last decision taken back, and that creative shown again. */
  const undoLast = () => {
    const last = history.current.pop();
    if (!last) return false;
    const drop = () =>
      setMade((m) => {
        const rest = { ...m };
        delete rest[last.creative.id];
        return rest;
      });
    if (last.verdict === "yes" && canApprove) {
      unapprove.mutateAsync([last.creative.current.id]).then(
        () => toast.info(`${labelOf(last.creative)} waits on you again`),
        (e: Error) => toast.error("The approval stays", { description: e.message }),
      );
    } else if (last.verdict === "no") tray.remove(last.creative.id);
    drop();
    setI(last.index);
    return true;
  };

  // Keys (the viewer's): A approve, C ask for changes, ← → move, Backspace or ⌘Z the last decision back. Never an
  // arrow to approve. Escape is the layer's (onEscape).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || leaving || sender.dialog || inField(e.target)) return;
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
        if (undoLast()) e.preventDefault();
        return;
      }
      if (e.metaKey || e.ctrlKey) return;
      if (e.key === "Backspace") {
        if (!undoLast()) return;
      } else if (e.key === "ArrowLeft" && i > 0) setI(i - 1);
      else if (done) return;
      else if (e.key === "ArrowRight") next();
      else if (e.key === "a" || e.key === "A") yes();
      else if ((e.key === "n" || e.key === "N") && !decided) askFor("no");
      else if ((e.key === "c" || e.key === "C") && !decided) askFor("comment");
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const onEscape = (e: KeyboardEvent) => {
    if (inField(e.target) || ask) {
      e.preventDefault();
      setAsk(null);
      (e.target as HTMLElement).blur?.();
    }
  };

  // Touch and mouse: the creative follows the finger, a little turned; let go past the threshold to decide.
  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (ask || leaving || decided || (e.pointerType === "mouse" && e.button !== 0)) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!start.current || start.current.id !== e.pointerId) return;
    setDrag({ x: e.clientX - start.current.x, y: Math.min(0, e.clientY - start.current.y) });
  };
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!start.current || start.current.id !== e.pointerId) return;
    start.current = null;
    const d = drag;
    if (!d) return;
    if (d.x > THRESHOLD && Math.abs(d.x) > Math.abs(d.y)) yes();
    else if (d.x < -THRESHOLD && Math.abs(d.x) > Math.abs(d.y)) askFor("no");
    else if (d.y < -THRESHOLD) askFor("comment");
    else setDrag(null);
  };
  const hint: Verdict | null = drag
    ? drag.x > THRESHOLD / 2 && Math.abs(drag.x) > Math.abs(drag.y)
      ? "yes"
      : drag.x < -THRESHOLD / 2 && Math.abs(drag.x) > Math.abs(drag.y)
        ? "no"
        : drag.y < -THRESHOLD / 2
          ? "comment"
          : null
    : null;
  const yesWord = canApprove ? "Approve" : "Looks good";

  // While writing, a tap on the creative pins the words to that spot.
  const tap = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!ask) return;
    const b = e.currentTarget.getBoundingClientRect();
    setPin({ x: Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)), y: Math.min(1, Math.max(0, (e.clientY - b.top) / b.height)) });
    field.current?.focus();
  };

  const count = (v: Verdict) => set.filter((c) => made[c.id] === v).length;
  const changes = tray.items.filter((d) => set.some((c) => c.id === d.creativeId)).length;
  const summary =
    [count("yes") ? (canApprove ? `${count("yes")} approved` : `${count("yes")} look good`) : "", changes ? `${changes} ${changes === 1 ? "needs" : "need"} changes` : "", count("comment") ? copy.count(count("comment"), "comment") : ""]
      .filter(Boolean)
      .join(" · ") || "Nothing decided";

  return (
    <ViewerLayer ref={layer} className="ui-rv ui-sw" label={`Swipe through ${campaign.name}`} onClose={onClose} onEscape={onEscape}>
      <div className="ui-sw-screen">
        <header className="ui-rv-bar">
          <Button variant="glass-clear" iconOnly icon="x" aria-label="Close" onClick={onClose} />
          <div className="ui-rv-title">
            <ViewerLayerTitle asChild>
              <h1>{done ? "That was all of them" : creative.title}</h1>
            </ViewerLayerTitle>
            <span className="ui-rv-sub">
              <span>{done ? campaign.name : shapeLine(creative)}</span>
              {/* The expert checked it: the Amber pointer beside who, as in the viewer (round 13, #28) */}
              {!done && creative.current.checkedBy && (
                <span className="ui-rv-checked">
                  <Icon name="fume-check" />
                  {creative.current.checkedBy === me ? "Checked by you" : copy.checkedBy(people.name(creative.current.checkedBy))}
                </span>
              )}
            </span>
          </div>
          <span className="ui-rv-count">{done ? `${n} of ${n}` : `${i + 1} of ${n}`}</span>
        </header>
        <Progress glass className="ui-sw-progress" value={Math.min(i, n)} max={n} aria-label={`${Math.min(i, n)} of ${n} gone through`} />

        {done ? (
          <>
            <main className="ui-sw-summary">
              <div className="ui-sw-summary-head">
                <h2 className="ui-sw-summary-title">{summary}</h2>
                <p className="ui-sw-summary-text">
                  {changes
                    ? "What you approved is approved. Start the changes, and the marked creatives go as one change request with their comments."
                    : canApprove
                      ? "What you approved is approved. Tap a creative to look again."
                      : `${firstName(approver)} sees what you said. Tap a creative to look again.`}
                </p>
              </div>
              <ol className="ui-sw-grid">
                {set.map((c, x) => {
                  const v = made[c.id] ?? (tray.has(c.id) ? "no" : c.current.state === "approved" ? "yes" : undefined);
                  const words = v === "yes" ? yesWord.replace("Approve", "Approved") : v === "no" ? "Needs changes" : v === "comment" ? "Comment" : "Not decided";
                  return (
                    <li key={c.id}>
                      <button type="button" className="ui-sw-tile" data-verdict={v ?? "open"} onClick={() => setI(x)} aria-label={`${c.title}, ${shapeLine(c)}: ${words}. Look again`}>
                        <span className="ui-sw-tile-media" data-format={c.format}>
                          <img src={c.current.image} alt="" />
                        </span>
                        <span className="ui-sw-tile-verdict">{words}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </main>
            <div className="ui-sw-foot ui-sw-send">
              {changes ? (
                <>
                  <Button variant="glass-clear" size="lg" onClick={onClose}>
                    Done for now
                  </Button>
                  <Button variant="glass-white" size="lg" icon="send" loading={sender.pending} onClick={sender.send}>
                    {startWords(changes)}
                  </Button>
                </>
              ) : (
                <Button variant="glass-white" size="lg" icon="check" onClick={onClose}>
                  Done
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            <main className="ui-sw-stage">
              <div
                key={creative.id}
                className="ui-sw-card"
                data-format={creative.format}
                data-dragging={drag && start.current ? "" : undefined}
                data-leaving={leaving ?? undefined}
                data-hint={hint ?? undefined}
                data-asking={ask ?? undefined}
                style={{ "--dx": drag?.x ?? 0, "--dy": drag?.y ?? 0 } as CSSProperties}
                onPointerDown={down}
                onPointerMove={move}
                onPointerUp={up}
                onPointerCancel={() => {
                  start.current = null;
                  setDrag(null);
                }}
                onClick={tap}
              >
                <img src={creative.current.image} alt={creative.title} draggable={false} />
                {pin && (
                  <span className="ui-qg-pin is-new" data-state="draft" style={{ "--x": `${pin.x * 100}%`, "--y": `${pin.y * 100}%` } as CSSProperties} aria-hidden="true">
                    1
                  </span>
                )}
                <span className="ui-sw-stamp" aria-hidden="true">
                  {hint === "yes" ? yesWord : hint === "no" ? "Change" : hint === "comment" ? "Comment" : ""}
                </span>
              </div>
            </main>

            <div className="ui-sw-foot" data-ui-foot="">
              {ask ? (
                <form className="ui-sw-ask" onSubmit={submitAsk}>
                  <label className="ui-sw-ask-label" htmlFor={`${ids}-ask`}>
                    {ask === "no"
                      ? pin
                        ? "What should change on the pinned spot"
                        : "What should change, in one line. Tap the creative to pin it to a spot."
                      : pin
                        ? "Your comment on the pinned spot"
                        : "Your comment. Tap the creative to pin it to a spot."}
                  </label>
                  <div className="ui-rv-compose-row">
                    <Input
                      id={`${ids}-ask`}
                      ref={field}
                      value={text}
                      placeholder={ask === "no" ? "The product sits too high" : "A little warmer light on the oil"}
                      onChange={(e) => setText(e.target.value)}
                      enterKeyHint="next"
                    />
                    <Button type="submit" variant="glass-white" disabled={!text.trim()}>
                      {ask === "no" ? "Add" : "Next"}
                    </Button>
                  </div>
                  <Button type="button" variant="glass-clear" size="sm" onClick={() => setAsk(null)}>
                    Back to the choice
                  </Button>
                </form>
              ) : decided ? (
                <div className="ui-sw-pills" role="group" aria-label={`${creative.title}: ${approved ? "approved" : "needs changes"}`}>
                  {approved ? (
                    <Button variant="glass-clear" size="lg" icon="rotate-ccw" onClick={undoApproval} loading={unapprove.isPending}>
                      Undo the approval
                    </Button>
                  ) : (
                    <Button variant="glass-clear" size="lg" icon="x" onClick={() => tray.remove(creative.id)}>
                      Take the mark back
                    </Button>
                  )}
                  <Button variant="glass-white" size="lg" iconEnd="arrow-right" onClick={next}>
                    Next
                  </Button>
                </div>
              ) : (
                <>
                  <div className="ui-sw-pills" role="group" aria-label={`Your decision on ${creative.title}`}>
                    <Button variant="glass-clear" size="lg" icon="message-square" onClick={() => askFor("no")}>
                      Needs changes
                    </Button>
                    <Button variant="glass-clear" size="lg" icon="pencil" className="ui-sw-pill-icon" onClick={() => askFor("comment")}>
                      <span className="ui-sw-pill-word">Comment</span>
                    </Button>
                    <Button variant="glass-white" size="lg" icon="check" onClick={yes}>
                      {yesWord}
                    </Button>
                  </div>
                  <p className="ui-sw-keys">
                    <Kbd>N</Kbd> Needs changes <Kbd>C</Kbd> Comment <Kbd>A</Kbd> {yesWord}{" "}
                    <KbdGroup>
                      <Kbd>←</Kbd>
                      <Kbd>→</Kbd>
                    </KbdGroup>{" "}
                    Move
                    {history.current.length > 0 && (
                      <>
                        {" "}
                        <Kbd>⌫</Kbd> Undo
                      </>
                    )}
                  </p>
                  <p className="ui-sw-touch">Swipe right to {yesWord.toLowerCase()}, left when it needs changes, up to comment.</p>
                </>
              )}
            </div>
          </>
        )}
      </div>
      {sender.dialog}
    </ViewerLayer>
  );
}
