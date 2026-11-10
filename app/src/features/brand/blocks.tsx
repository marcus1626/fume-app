// A book's blocks are the brand's own (Round 15, PROPOSED 9 Nov 2026). Marcus, 9 Nov, on the Tone of Voice: "Can you
// add more blocks? Or only control the four?"; on the design system: "Are the components hard-coded? Can the Engine add
// components?" Now a block (a Tone of Voice block, a design system component) is added, named, moved and taken out in
// place, with Undo in the toast like a line (edit.tsx). The Engine may propose one from the brand's own material; its
// proposal lies flat beside the book with "Add it" and "Not now" for Fume's people (proposal.css), and only what is
// added goes into the version the expert checks. A customer never sees a proposal. The look is book-edit.css.
import { Button, cx, Icon, useToast } from "@fume/ui";
import type { ReactNode } from "react";
import { useAnswerBookProposal } from "../../api/hooks";
import type { BookEditMark, BookProposal, BrandBook } from "../../contract";
import { useBookEdit } from "./edit";

/** Move up, move down and take out, beside a block's name, for whoever may write in the book. `head` is the list's
 *  path ("speak.traits"), `name` the block's name for the buttons and the toast. */
export function BlockTools({
  head,
  index,
  count,
  name,
  move = true,
}: {
  head: string;
  index: number;
  count: number;
  name: string;
  /** Components keep the order Fume wrote; only the Tone of Voice's blocks move. */
  move?: boolean;
}) {
  const { mode, commit } = useBookEdit();
  if (mode === "read") return null;
  const path = `${head}.${index}`;
  return (
    <div className="ui-block-tools" role="group" aria-label={`${name}: move or take out`}>
      {move && (
        <>
          <Button
            size="sm"
            variant="quiet"
            iconOnly
            icon="arrow-up"
            aria-label={`Move ${name} up`}
            disabled={index === 0}
            onClick={() => commit({ path, to: null, moveTo: index - 1 }, name)}
          />
          <Button
            size="sm"
            variant="quiet"
            iconOnly
            icon="arrow-down"
            aria-label={`Move ${name} down`}
            disabled={index >= count - 1}
            onClick={() => commit({ path, to: null, moveTo: index + 1 }, name)}
          />
        </>
      )}
      <Button
        size="sm"
        variant="quiet"
        iconOnly
        icon="trash"
        aria-label={`Take out ${name}`}
        onClick={() => commit({ path, to: null }, name)}
      />
    </div>
  );
}

/** Who added a block, from its mark: "Anna added this", "Anna added this from the Engine's proposal". */
export function AddedTag({ mark }: { mark?: BookEditMark }) {
  const { who } = useBookEdit();
  if (!mark || mark.from !== null) return null;
  const name = who(mark.by);
  const by = name === "you" ? "You" : name;
  return (
    <span className="ui-proposal-tag ui-block-tag">
      <Icon name={mark.proposal ? "fume-engine" : "user"} />
      {by} added this{mark.proposal ? " from the Engine’s proposal" : ""}
    </span>
  );
}

/** The Engine's proposal, flat beside the book: who proposes it and from what, what it is, why, and for Fume's people
 *  on a draft, Add it · Not now. `children` is the block as it would read. */
export function ProposedBlock({
  as: As = "div",
  book,
  proposal,
  name,
  className,
  id,
  children,
}: {
  as?: "div" | "li" | "section";
  book: BrandBook;
  proposal: BookProposal;
  name: string;
  className?: string;
  id?: string;
  children: ReactNode;
}) {
  const answer = useAnswerBookProposal();
  const toast = useToast();
  const { mode } = useBookEdit();
  const may = mode === "direct" && book.state === "draft";
  function send(to: "add" | "not_now") {
    answer.mutateAsync({ bookId: book.id, proposalId: proposal.id, answer: to }).then(
      () =>
        toast.done(to === "add" ? `${name} added` : `${name} set aside`, {
          description:
            to === "add"
              ? `In version ${book.version} now. It reaches creatives once the version is checked.`
              : "It stays out of this version.",
          action: {
            label: "Undo",
            onClick: () =>
              answer.mutate(
                { bookId: book.id, proposalId: proposal.id, answer: "open" },
                { onError: (err) => toast.error("It wasn’t undone", { description: err.message }) },
              ),
          },
        }),
      (err: Error) => toast.error("That wasn’t saved", { description: err.message }),
    );
  }
  return (
    <As className={cx("ui-block-proposal", className)} data-state="proposed" id={id}>
      <span className="ui-proposal-tag">
        <Icon name="fume-engine" />
        The Engine proposes this, from {proposal.from}
      </span>
      {children}
      <div className="ui-proposal-foot">
        <p className="ui-block-proposal-why">{proposal.why}</p>
        {may && (
          <div className="ui-proposal-actions ui-block-proposal-actions">
            <Button
              size="sm"
              variant="secondary"
              icon="plus"
              loading={answer.isPending && answer.variables?.answer === "add"}
              disabled={answer.isPending}
              onClick={() => send("add")}
              aria-label={`Add ${name}`}
            >
              Add it
            </Button>
            <Button
              size="sm"
              variant="quiet"
              disabled={answer.isPending}
              onClick={() => send("not_now")}
              aria-label={`Not now: ${name}`}
            >
              Not now
            </Button>
          </div>
        )}
      </div>
    </As>
  );
}

/** The proposals still open on a draft, for Fume's people; once a version is checked, what was not added is gone. */
export const openProposals = (book: BrandBook | undefined, kind: "component" | "block") =>
  book?.state === "draft"
    ? (book.proposals ?? []).filter((p) => p.state === "open" && (kind === "component" ? p.component : p.block))
    : [];
