// The review screens' parts: a checked creative as a tile you can open or leave out; the creatives she marked "Needs
// changes" and their one "Start the changes" (UX review 19 Oct, TASK-5; round 9, DTSK-15: at once, with Undo); and
// the two direction decisions (take one forward, or tell Fume why none fits).
// Round 13 (Marcus #33, #34; PROPOSED 21 Oct 2026): one place to write. Comments (with pins) post at once and her team
// and the expert see them; per creative she decides Approve or Needs changes, and a creative that needs changes takes
// its open comments as its change list. "Start the changes" sends the marked creatives of a campaign as ONE change
// request, the comments read at that moment, with the package's counting, the last-one and none-left dialogs and Undo.
// The separate change form ("What should change", "Send these comments with it") is gone. In a brand an agency runs,
// the client's change request goes to the agency, and the toast says so (FLOWS §24.5).
import {
  Button,
  CheckMark,
  CreativeTile,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldDescription,
  FieldLabel,
  FieldOptional,
  Textarea,
  useToast,
  type CreativeFormat,
} from "@fume/ui";
import { useId, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../../api/client";
import {
  useChooseDirection,
  usePassDirections,
  useRequestChangeRound,
  useReviewComments,
  useSession,
  useWithdrawChangeRound,
} from "../../api/hooks";
import type { Campaign, ChangeTag, Creative, Direction, Id, Pin, ReviewComment, User } from "../../contract";
import * as copy from "../../copy";
import { Section } from "../../shell/Page";
import { CreativeCheck } from "../shared/creatives";
import { labelOf } from "./names";
import type { ChangeDraft, ChangeTray } from "./tray";

// ─── A checked creative in review ───────────────────────────────────────────

/** "Feed A2 · 4:5", and the version once there is more than one: the tile's caption (DTSK-11). */
export const tileCaption = (c: Creative) =>
  `${labelOf(c)} · ${copy.format[c.format].ratio}${c.current.number > 1 ? ` · version ${c.current.number}` : ""}`;

/**
 * Two targets and nothing else (MOB-21): the picture opens the viewer, the round corner checkbox (the circle itself,
 * 44 px to a finger, round 13) leaves it out of the selection (shift-click selects a range, DTSK-10). A creative
 * marked "Needs changes" says so where its check was, and is never in the selection.
 */
export function ReviewTile({
  creative,
  people,
  selected,
  onSelectedChange,
  onOpen,
  toChange,
}: {
  creative: Creative;
  people: (id?: string) => User | undefined;
  selected?: boolean;
  onSelectedChange?: (selected: boolean, event?: ReactMouseEvent<HTMLElement>) => void;
  onOpen: () => void;
  /** Marked "Needs changes". */
  toChange?: boolean;
}) {
  return (
    <CreativeTile
      data-creative={creative.id}
      src={creative.current.image}
      alt={creative.title}
      format={creative.format}
      label={creative.title}
      caption={tileCaption(creative)}
      check={
        toChange ? (
          <CheckMark state="changes" label="Needs changes" />
        ) : (
          <CreativeCheck creative={creative} people={people} />
        )
      }
      selected={toChange ? undefined : selected}
      onSelectedChange={toChange ? undefined : onSelectedChange}
      onOpen={onOpen}
    />
  );
}

// ─── Needs changes: the mark, and who gets the change request ───────────────

/** The mark for a creative ("Needs changes"), with the product tick when the product itself is off. */
export const markOf = (c: Creative, tags: ChangeTag[] = []): ChangeDraft => ({
  creativeId: c.id,
  versionId: c.current.id,
  title: c.title,
  image: c.current.image,
  format: c.format,
  tags,
});

/** Who a change request goes to: Fume, or the agency that runs the brand for a client of it (FLOWS §24.5). */
export function useChangeRecipient(): string {
  const session = useSession().data;
  return session?.workspace.agencyId && !session.user.agency ? (session.agencyName ?? "the agency") : "Fume";
}

/** "This is change request 2 of 2." in words, once, before anything is sent. */
export function roundLine(campaign: Campaign, correction = false, who = "Fume"): string {
  if (correction)
    return `A product that is off is ${who === "Fume" ? "Fume’s" : `${who}’s`} own mistake, so fixing it uses no change request.`;
  const left = campaign.roundsIncluded - campaign.roundsUsed;
  if (left <= 0)
    return `All ${copy.count(campaign.roundsIncluded, "change request")} in this campaign are used. ${who} tells you what one more takes before any work starts.`;
  return `This is change request ${campaign.roundsUsed + 1} of ${campaign.roundsIncluded}. Each new version is checked before you see it.`;
}

/** The open comments that are a creative's change list: every open comment on it, oldest first. */
export const changeList = (comments: ReviewComment[], creativeId: Id) =>
  comments.filter((c) => c.creativeId === creativeId && !c.resolved);

// ─── Start the changes, once, at once ───────────────────────────────────────

/**
 * One "Start the changes" for the campaign's marked creatives (DTSK-15, round 13). It sends straight away, with Undo
 * in the toast for 10 s: Undo takes it back and marks the creatives again. Each creative's change list is its open
 * comments at that moment (their pins go with them), or "The product itself is off". Only two cases stop to ask first,
 * each in a short dialog: the last change request in the package (the title says so), and none left (then Fume, or
 * the agency, is asked about one more).
 */
export function useSendChanges({
  campaign,
  tray,
  threadId,
  onSent,
}: {
  campaign: Campaign;
  tray: ChangeTray;
  threadId?: Id;
  /** After it is sent (the viewer closes, the page shows what is next). */
  onSent?: () => void;
}): { send: () => void; pending: boolean; dialog: ReactNode } {
  const api = useApi();
  const toast = useToast();
  const request = useRequestChangeRound();
  const withdraw = useWithdrawChangeRound();
  const who = useChangeRecipient();
  const [asking, setAsking] = useState<"last" | "used" | null>(null);
  const [reading, setReading] = useState(false);
  const items = tray.items;
  const correction = items.length > 0 && items.every((d) => d.tags.includes("product"));
  const left = campaign.roundsIncluded - campaign.roundsUsed;

  const go = async () => {
    const sent = [...items];
    setAsking(null);
    setReading(true);
    // The change list is what the comments say now: read them as the changes start.
    let lists: { versionId: Id; text: string; pins: Pin[]; tags: ChangeTag[] }[];
    try {
      lists = await Promise.all(
        sent.map(async (d) => {
          const open = changeList(await api.reviewComments(d.creativeId), d.creativeId);
          const product = d.tags.includes("product") ? ["The product itself is off."] : [];
          const text = [...product, ...open.map((c) => c.text)].join("\n") || "Needs changes.";
          const pins = open.filter((c) => c.pin).map((c) => ({ x: c.pin!.x, y: c.pin!.y, text: c.text }));
          return { versionId: d.versionId, text, pins, tags: d.tags };
        }),
      );
    } catch (e) {
      setReading(false);
      toast.error("The changes didn’t start", { description: (e as Error).message });
      return;
    }
    setReading(false);
    // The promise, not mutate's callbacks: once sent, the creatives are remade and the screen that sent it may be gone.
    request.mutateAsync({ campaignId: campaign.id, items: lists }).then(
      (r) => {
        tray.clear();
        toast.done(`Change request sent to ${who}`, {
          description: r.usesRound
            ? r.roundsLeft > 0
              ? `You see each new version once it is checked. ${copy.count(r.roundsLeft, "change request")} left.`
              : "You see each new version once it is checked. That was the last change request in your package."
            : "This one is on us; it uses no change request.",
          duration: 10000,
          action: {
            label: "Undo",
            onClick: () =>
              withdraw
                .mutateAsync({
                  campaignId: campaign.id,
                  versionIds: r.versions.map((v) => v.id),
                  usedRound: r.usesRound,
                })
                .then(
                  () => {
                    sent.forEach((d) => tray.put(d));
                    toast.info("The changes are back with you, not sent");
                  },
                  (e: Error) => toast.error("The change request stays sent", { description: e.message }),
                ),
          },
        });
        onSent?.();
      },
      (e: Error) => toast.error("The changes didn’t start", { description: e.message }),
    );
  };

  const send = () => {
    if (!items.length || request.isPending || reading) return;
    if (!correction && left <= 0) setAsking("used");
    else if (!correction && left === 1 && campaign.roundsIncluded > 1) setAsking("last");
    else void go();
  };

  const dialog = asking ? (
    <Dialog open onOpenChange={(o) => !o && setAsking(null)}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>
            {asking === "last"
              ? "Your last change request"
              : `All ${copy.count(campaign.roundsIncluded, "change request")} are used`}
          </DialogTitle>
          <DialogDescription>
            {asking === "last"
              ? `This is change request ${campaign.roundsIncluded} of ${campaign.roundsIncluded} in your package. After it, ${who} tells you what one more takes before any work starts.`
              : `${who} tells you what one more takes before any work starts.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="glass-clear">Later</Button>
          </DialogClose>
          {asking === "last" ? (
            <Button variant="glass-white" icon="send" loading={request.isPending || reading} onClick={() => void go()}>
              {startWords(items.length)}
            </Button>
          ) : who === "Fume" ? (
            <Button asChild variant="glass-white" icon="message-square">
              <Link to={threadId ? `/fume/${threadId}` : "/fume"}>Ask Fume about one more</Link>
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ) : null;

  return { send, pending: request.isPending || reading, dialog };
}

/** The one action's words: "Start the changes", with how many when there is more than one. */
export const startWords = (n: number) => (n > 1 ? `Start the changes (${n})` : "Start the changes");
/** Before round 13 the action was "Send it"; kept for old call sites. */
export const sendWords = startWords;

/**
 * The marked creatives on a review page, above the grid: each with its change list in short, the way to its comments
 * (the viewer) and to take the mark back; "Start the changes" at the head. When every creative in the set has an
 * answer (approved, or marked), the section says so and the action is the page's Ink.
 */
export function ChangesSection({
  title = "Needs changes",
  campaign,
  tray,
  sender,
  answered,
  onOpen,
}: {
  /** "Needs changes"; the Review place names the campaign ("Autumn launch: needs changes"). */
  title?: string;
  campaign: Campaign;
  tray: ChangeTray;
  sender: ReturnType<typeof useSendChanges>;
  /** Every creative that waited has an answer. */
  answered: boolean;
  onOpen: (creativeId: Id) => void;
}) {
  const who = useChangeRecipient();
  const n = tray.items.length;
  if (!n) return null;
  const round = roundLine(
    campaign,
    tray.items.every((d) => d.tags.includes("product")),
    who,
  );
  return (
    <Section
      title={title}
      meta={n}
      titleId={`review-changes-${campaign.id}`}
      text={
        answered
          ? `Every creative has an answer. Start the changes and ${who} gets them as one change request. ${round}`
          : round
      }
      action={
        <Button
          variant={answered ? "primary" : "secondary"}
          size="sm"
          icon="send"
          loading={sender.pending}
          onClick={sender.send}
        >
          {startWords(n)}
        </Button>
      }
    >
      <ul className="ui-review-tray-list" aria-labelledby={`review-changes-${campaign.id}`}>
        {tray.items.map((d) => (
          <MarkLine
            key={d.creativeId}
            draft={d}
            onOpen={() => onOpen(d.creativeId)}
            onRemove={() => tray.remove(d.creativeId)}
          />
        ))}
      </ul>
    </Section>
  );
}

/** One marked creative: its picture, its name and its change list in short ("2 comments: Could the oil catch…"). */
function MarkLine({ draft, onOpen, onRemove }: { draft: ChangeDraft; onOpen: () => void; onRemove: () => void }) {
  const comments = useReviewComments(draft.creativeId);
  const open = changeList(comments.data ?? [], draft.creativeId);
  const product = draft.tags.includes("product");
  const line = [
    product ? "The product itself is off" : "",
    open.length
      ? `${copy.count(open.length, "comment")}: ${open[open.length - 1]!.text}`
      : product
        ? ""
        : "No comment yet. Open it and say what should change.",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="ui-review-tray-item">
      <button
        type="button"
        className="ui-review-tray-open"
        onClick={onOpen}
        aria-label={`${draft.title}: ${line}. Open its comments`}
      >
        <span className="ui-review-tray-thumb" data-format={draft.format as CreativeFormat}>
          <img src={draft.image} alt="" />
        </span>
        <span className="ui-review-tray-text">
          <b>{draft.title}</b>
          <span>{comments.isPending ? "Reading the comments" : line}</span>
        </span>
      </button>
      <Button
        variant="quiet"
        size="sm"
        iconOnly
        icon="x"
        aria-label={`${draft.title} does not need changes after all`}
        tooltip="Take the mark back"
        onClick={onRemove}
      />
    </li>
  );
}

// ─── Directions ─────────────────────────────────────────────────────────────

/** Take one direction forward, with an optional reason (it teaches Fume your taste). */
export function ChooseDialog({
  direction,
  open,
  onOpenChange,
}: {
  direction: Direction;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const id = useId();
  const toast = useToast();
  const choose = useChooseDirection();
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>
            Take {direction.letter}, {direction.name}, forward
          </DialogTitle>
          <DialogDescription>
            The Engine makes the masters on this direction. The others are not taken forward.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Field>
            <FieldLabel htmlFor={id}>
              Why this one <FieldOptional />
            </FieldLabel>
            <Textarea
              id={id}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              aria-describedby={`${id}-help`}
            />
            <FieldDescription id={`${id}-help`}>Fume keeps your reason in Creative Memory.</FieldDescription>
          </Field>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="glass-clear">Later</Button>
          </DialogClose>
          <Button
            variant="glass-white"
            icon="check"
            loading={choose.isPending}
            onClick={() =>
              choose.mutateAsync({ directionId: direction.id, reason: reason.trim() || undefined }).then(
                () => {
                  toast.done(`${direction.letter}, ${direction.name}, chosen`, {
                    description: "The Engine starts on the masters.",
                  });
                  onOpenChange(false);
                },
                (e: Error) => toast.error("The direction wasn’t chosen", { description: e.message }),
              )
            }
          >
            Choose {direction.letter}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** None fits: say why, and Fume makes new directions from it. The reason is required. */
export function PassDialog({
  campaign,
  open,
  onOpenChange,
}: {
  campaign: Campaign;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const id = useId();
  const toast = useToast();
  const pass = usePassDirections();
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>None of these fits</DialogTitle>
          <DialogDescription>Tell Fume what is missing. Fume makes new directions from it.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Field>
            <FieldLabel htmlFor={id}>What is missing</FieldLabel>
            <Textarea
              id={id}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="All three feel too cool for autumn."
            />
          </Field>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="glass-clear">Later</Button>
          </DialogClose>
          <Button
            variant="glass-white"
            icon="send"
            disabled={!reason.trim()}
            loading={pass.isPending}
            onClick={() =>
              pass.mutateAsync({ campaignId: campaign.id, reason: reason.trim() }).then(
                () => {
                  toast.done("Sent to Fume", { description: "Fume makes new directions from what you said." });
                  onOpenChange(false);
                },
                (e: Error) => toast.error("That wasn’t sent", { description: e.message }),
              )
            }
          >
            Pass on all
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
