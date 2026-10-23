// Proposal (design-system/components/proposal.css): Fume finds and proposes, only the customer approves (FLOWS §2).
// Wrap the thing in <Proposal state>, put <ProposalTag> and, while it is a proposal and the person may decide,
// <ProposalActions> in its foot.
// Who acts is named once and the same everywhere: Fume reads, finds and proposes; the Engine only makes creatives. So a
// proposal's tag says "Fume found this on lysne.no/about" (or "Fume found this · Brand guide, page 6"), never "Engine
// proposal"; origin "engine" is the data's word for Fume's reading. The answers are the verbs of facts: Confirm ·
// Change · Remove, Confirm a secondary pill so a page of proposals never shows more than one Ink.
import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cx } from "../cx";
import { Icon } from "../icons";
import { Btn } from "./_parts";

export type ProposalState = "proposed" | "approved" | "changed" | "removed";

export interface ProposalProps extends HTMLAttributes<HTMLDivElement> {
  state: ProposalState;
  /** No card of its own (for a row inside a list, or an image that is its own surface). */
  bare?: boolean;
}

export const Proposal = forwardRef<HTMLDivElement, ProposalProps>(function Proposal(
  { state, bare, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cx("ui-proposal", bare && "ui-proposal--bare", className)}
      data-state={state}
      {...props}
    />
  );
});

export function ProposalFoot({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("ui-proposal-foot", className)} {...props} />;
}

export interface ProposalTagProps {
  /** Who put it in: Fume's reading ("engine", the data's word), the customer (supplied) or Fume's people. */
  origin: "engine" | "customer" | "fume";
  state: ProposalState;
  /** Where Fume found it ("lysne.no/about", "Brand guide, page 6"). */
  evidence?: string;
  /** The person who approved or changed it, by first name. */
  by?: string;
  /** When, already in words ("14 Oct"). */
  when?: string;
}

/** "Fume found this on lysne.no/about" for a place on the web, "Fume found this · Brand guide, page 6" for anything else. */
export function foundWords(evidence?: string): string {
  if (!evidence) return "Fume found this";
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+(?=$|[/\s,])/i.test(evidence)
    ? `Fume found this on ${evidence}`
    : `Fume found this · ${evidence}`;
}

/** The words for an item's origin and state, with its icon: Fume's mark on a proposal, a check once decided. */
export function ProposalTag({ origin, state, evidence, by, when }: ProposalTagProps) {
  let words: ReactNode;
  if (state === "proposed") words = foundWords(evidence);
  else if (state === "changed") words = `${by ?? "You"} changed this${when ? ` · ${when}` : ""}`;
  else if (origin === "customer") words = by ? `${by} added this${when ? ` · ${when}` : ""}` : "You added this";
  else words = `${by ?? "You"} approved${when ? ` · ${when}` : ""}`;
  return (
    <span className="ui-proposal-tag">
      <Icon
        name={state === "proposed" ? "fume-engine" : origin === "customer" && state === "approved" ? "user" : "check"}
      />
      {words}
    </span>
  );
}

export interface ProposalActionsProps {
  /** Confirm (the prop keeps its first name, so every caller stays as it is). */
  onKeep: () => void;
  onChange?: () => void;
  onRemove: () => void;
  disabled?: boolean;
  /** For screen readers: "Confirm Dusk blue". */
  name?: string;
}

/** Confirm · Change · Remove: the customer's three answers to a proposal. */
export function ProposalActions({ onKeep, onChange, onRemove, disabled, name }: ProposalActionsProps) {
  const label = (verb: string) => (name ? `${verb} ${name}` : undefined);
  return (
    <div className="ui-proposal-actions">
      <Btn
        size="sm"
        variant="secondary"
        icon="check"
        onClick={onKeep}
        disabled={disabled}
        aria-label={label("Confirm")}
      >
        Confirm
      </Btn>
      {onChange && (
        <Btn size="sm" variant="quiet" onClick={onChange} disabled={disabled} aria-label={label("Change")}>
          Change
        </Btn>
      )}
      <Btn
        size="sm"
        variant="quiet"
        onClick={onRemove}
        disabled={disabled}
        aria-label={label("Remove")}
        className="ui-decide-remove"
      >
        Remove
      </Btn>
    </div>
  );
}
