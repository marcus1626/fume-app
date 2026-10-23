// One rule across Brand DNA (FLOWS §2): every item shows where it came from and what state it is in, and a find
// Fume is not sure of gets Confirm · Change · Remove. Only an owner or an approver decides; everyone else sees the
// tag. The Brand DNA board acts in place (<ConfirmRow> for a colour, a typeface, a logo or a line of voice;
// <Provenanced> for a picture that must stay big enough to judge); the onboarding's compact rows and the Brand
// check use useDecision and DecisionActions directly.
// Round 8 (UX review ONB-9, ONB-15, ONB-17): Confirm says nothing (the item's own "Confirmed" is the feedback, no
// toast); Remove is one tap with Undo in its toast, and the removed item stays where it was, dimmed, with "Put back".
// Round 9 (desktop review DLOAD-1, DLOAD-7, DLAY-19, DWAY-14; PROPOSED 19 Oct 2026): one verb per action: Confirm
// (never Keep), Change, Remove; the tag says "Fume found this on lysne.no" (never "Engine proposal"). Change opens
// in place, under the item: one field, Enter saves, Esc puts it back (no centred dialog over the board). The props
// of every export stay as they were, so the onboarding and the queues keep working.
// Round 13 (walk-through 21 Oct, #2, #42; PROPOSED 22 Oct 2026): a colour's Change has a colour picker beside its hex
// and its uses as chips under it (colour.tsx); Save keeps both.
import {
  Button,
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
  foundWords,
  Icon,
  Input,
  Proposal,
  ProposalFoot,
  Textarea,
  useToast,
} from "@fume/ui";
import { useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { useDecide, usePeople, useSetColourUses } from "../../api/hooks";
import type { ColourUse, IdentityKind, Provenance } from "../../contract";
import { date } from "../../lib/time";
import { directory } from "../../shell/people";
import { ColourUsesField, HexPicker } from "./colour";
import { confidence, useRole } from "./parts";

/** What Change edits for each kind: the mock changes a hex, a statement or a name. Images have nothing to rename. */
export const changeField: Partial<Record<IdentityKind, { label: string; help: string; hex?: boolean }>> = {
  colour: {
    label: "The colour’s hex",
    help: "Six digits, for example #5C1F2A. Fume uses your value from the next creative on.",
    hex: true,
  },
  typeface: { label: "The typeface’s name", help: "As it is called in your guidelines or by the foundry." },
  logo: { label: "The logo’s name", help: "What your team calls this version." },
  voice: { label: "The line, in your words", help: "Write it the way you would tell a copywriter." },
  board_item: { label: "The note", help: "Why this belongs, or does not." },
  collection: { label: "The collection’s name", help: "For example SS27." },
};

/** "Maja" or "You", for the tag. */
function useWho() {
  const { me } = useRole();
  const dir = directory(usePeople().data);
  return (id?: string) => (id ? (id === me ? "You" : dir.name(id)) : undefined);
}

/** Where an item came from and where it stands, in the customer's words. */
export function provenanceWords(p: Provenance, who: (id?: string) => string | undefined): string {
  const by = who(p.by);
  const when = p.at ? ` · ${date(p.at)}` : "";
  if (p.state === "proposed") return foundWords(p.evidence);
  if (p.state === "removed") return "Removed";
  if (p.state === "changed") return `${by ?? "You"} changed this${when}`;
  if (p.origin === "customer") return by && by !== "You" ? `${by} added this${when}` : "You added this";
  return by && by !== "You" ? `${by} confirmed this${when}` : `Confirmed${when}`;
}

/** The tag alone: who put it in and where it stands (proposal.css .ui-proposal-tag). */
export function ProvenanceTag({ provenance }: { provenance: Provenance }) {
  const who = useWho();
  const icon =
    provenance.state === "proposed"
      ? "fume-engine"
      : provenance.origin === "customer" && provenance.state === "approved"
        ? "user"
        : provenance.state === "removed"
          ? "x"
          : "check";
  return (
    <span className="ui-proposal-tag">
      <Icon name={icon} />
      {provenanceWords(provenance, who)}
    </span>
  );
}

/**
 * Confirm, Remove and Put back for one item, with the round 8 rule: no toast for Confirm; Remove's toast carries Undo
 * (which puts it back, confirmed). `removed` is true once it was removed here, so the caller can keep it in place,
 * dimmed. `keep` is the old name of `confirm`, kept so the onboarding's calls stay as they are.
 */
export function useDecision(kind: IdentityKind, id: string, name: string, onDecided?: (id: string) => void) {
  const decide = useDecide();
  const toast = useToast();
  const [removedHere, setRemovedHere] = useState(false);
  const failed = (error: Error) => toast.error("That wasn’t saved", { description: error.message });
  // Each answer shows at once: the item is marked decided here before the call, so it keeps its place even when the
  // saved board no longer lists it as a find (a callback of a row that has left the page would never run).
  const putBack = () => {
    setRemovedHere(false);
    decide.mutate({ kind, id, verdict: "keep" }, { onError: failed });
  };
  const confirm = () => {
    onDecided?.(id);
    decide.mutate({ kind, id, verdict: "keep" }, { onError: failed });
  };
  return {
    pending: decide.isPending,
    removedHere,
    confirm,
    keep: confirm,
    remove: () => {
      setRemovedHere(true);
      onDecided?.(id);
      decide.mutate(
        { kind, id, verdict: "remove" },
        {
          onError: (error) => {
            setRemovedHere(false);
            failed(error);
          },
        },
      );
      toast.done(`${name} removed`, {
        description: "Fume will not use it.",
        action: { label: "Undo", onClick: putBack },
      });
    },
    putBack,
  };
}

/** Confirm · Change · Remove on one row: Confirm is the white pill (one Ink action per screen stays the page's own), Remove last and apart. */
export function DecisionActions({
  onKeep,
  onChange,
  onRemove,
  disabled,
  name,
}: {
  /** Confirm (the prop keeps its first name, so every caller stays as it is). */
  onKeep: () => void;
  onChange?: () => void;
  onRemove: () => void;
  disabled?: boolean;
  /** For screen readers: "Confirm Dusk blue". */
  name: string;
}) {
  return (
    <div className="ui-proposal-actions">
      <Button
        size="sm"
        variant="secondary"
        icon="check"
        onClick={onKeep}
        disabled={disabled}
        aria-label={`Confirm ${name}`}
      >
        Confirm
      </Button>
      {onChange && (
        <Button size="sm" variant="quiet" onClick={onChange} disabled={disabled} aria-label={`Change ${name}`}>
          Change
        </Button>
      )}
      <Button
        size="sm"
        variant="quiet"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Remove ${name}`}
        className="ui-decide-remove"
      >
        Remove
      </Button>
    </div>
  );
}

const HEX = /^#[0-9a-f]{6}$/i;

/** The value Change saves: a hex is written with its # and in capitals. */
function useChangeValue(value: string, field: { hex?: boolean }) {
  const [text, setText] = useState(value);
  const next = field.hex ? (text.trim().startsWith("#") ? text.trim() : `#${text.trim()}`).toUpperCase() : text.trim();
  const valid = field.hex ? HEX.test(next) : next.length > 0;
  return { text, setText, next, valid };
}

/**
 * Change in place (round 9, DWAY-14, DLAY-19): one field under the item, the old value in it. Enter saves, Esc puts
 * it back and returns to the item; nothing covers the board. Fume's value stays in the record ("was").
 */
export function ChangeInline({
  kind,
  id,
  name,
  value,
  field,
  uses,
  onDone,
  onSaving,
}: {
  kind: IdentityKind;
  id: string;
  name: string;
  value: string;
  field: { label: string; help: string; hex?: boolean };
  /** A colour's uses (#42): chips under the hex, saved with it. */
  uses?: ColourUse[];
  /** Saved or cancelled: the caller closes the field and gives focus back to its Change. */
  onDone: (saved: boolean) => void;
  /** Called as the change is sent, so the item can keep its place before the board has it saved. */
  onSaving?: () => void;
}) {
  const decide = useDecide();
  const setUses = useSetColourUses();
  const toast = useToast();
  const v = useChangeValue(value, field);
  const [chosen, setChosen] = useState<ColourUse[]>(uses ?? []);
  const usesChanged = uses !== undefined && (chosen.length !== uses.length || chosen.some((u) => !uses.includes(u)));
  const long = kind === "voice" || kind === "board_item";
  const fieldId = `change-${id}-value`;
  const unchanged = v.next === value && !usesChanged;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!v.valid || unchanged) return;
    onSaving?.();
    try {
      await decide.mutateAsync({ kind, id, verdict: "change", value: v.next });
      if (usesChanged) await setUses.mutateAsync({ colourId: id, uses: chosen });
      onDone(true);
    } catch (error) {
      toast.error("The change wasn’t saved", { description: error instanceof Error ? error.message : undefined });
    }
  }
  function keys(e: KeyboardEvent<HTMLElement>) {
    if (e.key === "Escape") {
      // Esc closes this field first, never the page around it
      e.preventDefault();
      e.stopPropagation();
      onDone(false);
    } else if (long && e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.currentTarget.closest("form")?.requestSubmit();
    }
  }

  return (
    <form className="ui-brand-change" onSubmit={submit} aria-label={`Change ${name}`}>
      <Field>
        <FieldLabel htmlFor={fieldId}>{field.label}</FieldLabel>
        {long ? (
          <Textarea
            id={fieldId}
            value={v.text}
            onChange={(e) => v.setText(e.target.value)}
            onKeyDown={keys}
            rows={2}
            autoFocus
            aria-describedby={`${fieldId}-help`}
          />
        ) : (
          <div className={field.hex ? "ui-colour-hex" : undefined}>
            {field.hex && <HexPicker value={v.text} onChange={v.setText} label={`Pick ${name}’s colour`} />}
            <Input
              id={fieldId}
              value={v.text}
              onChange={(e) => v.setText(e.target.value)}
              onKeyDown={keys}
              autoFocus
              aria-describedby={`${fieldId}-help`}
              aria-invalid={v.text !== value && !v.valid ? true : undefined}
            />
          </div>
        )}
        <FieldDescription id={`${fieldId}-help`}>{field.help}</FieldDescription>
      </Field>
      {uses !== undefined && <ColourUsesField id={`${fieldId}-uses`} value={chosen} onChange={setChosen} />}
      <div className="ui-brand-change-actions">
        <Button
          type="submit"
          size="sm"
          variant="secondary"
          loading={decide.isPending || setUses.isPending}
          disabled={!v.valid || unchanged}
        >
          Save the change
        </Button>
        <Button type="button" size="sm" variant="quiet" onClick={() => onDone(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export interface ProvenancedProps {
  kind: IdentityKind;
  id: string;
  /** The item's name in words, for the toast and the screen reader ("Dusk blue"). */
  name: string;
  provenance: Provenance;
  /** The value Change starts from (a hex, a statement, a name). */
  value?: string;
  /** No card of its own: the item is its own surface (an image, a logo tile). */
  bare?: boolean;
  className?: string;
  /** Called once it was confirmed, changed or removed here, so the caller can keep it in place for the visit. */
  onDecided?: (id: string) => void;
  /** A colour's uses, for its Change (#42). */
  uses?: ColourUse[];
  children: ReactNode;
}

/** The item, then its tag, then (for a find, and only for someone who may decide) Confirm · Change · Remove. */
export function Provenanced({
  kind,
  id,
  name,
  provenance,
  value,
  bare,
  className,
  onDecided,
  uses,
  children,
}: ProvenancedProps) {
  const { canApprove } = useRole();
  const d = useDecision(kind, id, name, onDecided);
  const [changing, setChanging] = useState(false);
  const removed = provenance.state === "removed";
  // A removed item leaves the view, except right after it was removed here: then it stays, dimmed, with Put back.
  if (removed && !d.removedHere) return null;
  const proposal = provenance.state === "proposed";
  const field = changeField[kind];

  return (
    <Proposal
      state={provenance.state}
      bare={bare}
      className={className}
      data-confidence={proposal ? provenance.confidence : undefined}
      data-removed={removed ? "" : undefined}
    >
      {children}
      <ProposalFoot>
        <ProvenanceTag provenance={provenance} />
        {proposal && provenance.confidence === "low" && <span className="ui-proposal-tag">{confidence.low}</span>}
        {removed && canApprove ? (
          <Button
            size="sm"
            variant="secondary"
            icon="undo-2"
            onClick={d.putBack}
            disabled={d.pending}
            className="ui-decide-putback"
          >
            Put back
          </Button>
        ) : (
          proposal &&
          canApprove &&
          !changing && (
            <DecisionActions
              name={name}
              onKeep={d.confirm}
              onChange={field && value !== undefined ? () => setChanging(true) : undefined}
              onRemove={d.remove}
              disabled={d.pending}
            />
          )
        )}
      </ProposalFoot>
      {changing && field && value !== undefined && (
        <ChangeInline
          kind={kind}
          id={id}
          name={name}
          value={value}
          field={field}
          uses={uses}
          onSaving={() => onDecided?.(id)}
          onDone={(saved) => {
            setChanging(false);
            if (saved) onDecided?.(id);
          }}
        />
      )}
    </Proposal>
  );
}

/**
 * One find to confirm as a row (round 9, DLAY-19; brand-board.css .ui-brand-confirm): the thing small and sharp (a
 * 64 px swatch, the logo on its ground, "Aa" in the face), its name, where Fume found it and whether Fume is sure,
 * then Confirm · Change · Remove right after the words. Once decided here it stays in its place for the visit with
 * its new tag ("Confirmed", "You changed this", or dimmed with Put back), so nothing moves under the mouse.
 */
export function ConfirmRow({
  kind,
  id,
  name,
  provenance,
  value,
  media,
  title,
  meta,
  text,
  uses,
  onDecided,
}: {
  kind: IdentityKind;
  id: string;
  name: string;
  provenance: Provenance;
  value?: string;
  /** A colour's uses, for its Change (#42). */
  uses?: ColourUse[];
  /** The thing itself, small: a swatch, a logo tile, a specimen. Left out for a line of voice. */
  media?: ReactNode;
  /** The name as it reads ("Dusk blue"); defaults to name. */
  title?: ReactNode;
  /** Beside the title, in the data face or quiet (a hex, "Accent · Medium"). */
  meta?: ReactNode;
  /** One line under the title (an example sentence, a use). */
  text?: ReactNode;
  onDecided?: (id: string) => void;
}) {
  const { canApprove } = useRole();
  const d = useDecision(kind, id, name, onDecided);
  const [changing, setChanging] = useState(false);
  const removed = provenance.state === "removed";
  if (removed && !d.removedHere) return null;
  const proposal = provenance.state === "proposed";
  const field = changeField[kind];
  const unsure = proposal && provenance.confidence === "low";

  return (
    <div
      className="ui-brand-confirm"
      data-state={provenance.state}
      data-removed={removed ? "" : undefined}
      data-media={media ? undefined : "none"}
    >
      {media && <div className="ui-brand-confirm-media">{media}</div>}
      <div className="ui-brand-confirm-body">
        <p className="ui-brand-confirm-title">
          <span>{title ?? name}</span>
          {meta && <span className="ui-brand-confirm-meta">{meta}</span>}
        </p>
        {/* the line and where Fume found it share a line when they fit */}
        <div className="ui-brand-confirm-line">
          {text && <p className="ui-brand-confirm-text">{text}</p>}
          <p className="ui-brand-confirm-tags">
            <ProvenanceTag provenance={provenance} />
            {unsure && <span className="ui-proposal-tag">{confidence.low}</span>}
            {proposal && !canApprove && <span className="ui-proposal-tag">An owner or an approver confirms it</span>}
          </p>
        </div>
        {changing && field && value !== undefined && (
          <ChangeInline
            kind={kind}
            id={id}
            name={name}
            value={value}
            field={field}
            uses={uses}
            onSaving={() => onDecided?.(id)}
            onDone={(saved) => {
              setChanging(false);
              if (saved) onDecided?.(id);
            }}
          />
        )}
      </div>
      {canApprove && (removed || (proposal && !changing)) && (
        <div className="ui-brand-confirm-actions">
          {removed ? (
            <Button
              size="sm"
              variant="secondary"
              icon="undo-2"
              onClick={d.putBack}
              disabled={d.pending}
              className="ui-decide-putback"
            >
              Put back
            </Button>
          ) : (
            <DecisionActions
              name={name}
              onKeep={d.confirm}
              onChange={field && value !== undefined ? () => setChanging(true) : undefined}
              onRemove={d.remove}
              disabled={d.pending}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** Change a find in a dialog: say what is right. Fume's value stays in the record ("was"). The onboarding's rows use it. */
export function ChangeDialog({
  kind,
  id,
  name,
  value,
  field,
  onOpenChange,
}: {
  kind: IdentityKind;
  id: string;
  name: string;
  value: string;
  field: { label: string; help: string; hex?: boolean };
  onOpenChange: (open: boolean) => void;
}) {
  const decide = useDecide();
  const toast = useToast();
  const v = useChangeValue(value, field);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!v.valid) return;
    decide.mutate(
      { kind, id, verdict: "change", value: v.next },
      {
        onSuccess: () => onOpenChange(false),
        onError: (error) => toast.error("The change wasn’t saved", { description: error.message }),
      },
    );
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change {name}</DialogTitle>
          <DialogDescription>
            Say what is right, and it becomes yours. What Fume read stays in the record.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form id={`change-${id}`} onSubmit={submit}>
            <Field>
              <FieldLabel htmlFor={`change-${id}-value`}>{field.label}</FieldLabel>
              <Input
                id={`change-${id}-value`}
                value={v.text}
                onChange={(e) => v.setText(e.target.value)}
                aria-describedby={`change-${id}-help`}
                aria-invalid={v.text !== value && !v.valid ? true : undefined}
                data-ui-autofocus
              />
              <FieldDescription id={`change-${id}-help`}>{field.help}</FieldDescription>
            </Field>
          </form>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="glass-clear">Cancel</Button>
          </DialogClose>
          <Button
            type="submit"
            form={`change-${id}`}
            variant="glass-white"
            loading={decide.isPending}
            disabled={!v.valid || v.next === value}
          >
            Save the change
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
