// The review grid's selection and its one Approve (UX review 19 Oct, TASK-4, MOB-10; round 9, DTSK-10, DLOAD-12):
// everything checked starts selected, she leaves one out with its circle, shift-click selects a range and ⌘A selects
// all; "Approve 6" acts at once, with Undo in the toast. On a phone the bar takes the tab bar's slot while the
// selection is open. A creative marked "Needs changes" is never in the selection.
// Round 13 (PROPOSED 21 Oct 2026): taken out of ReviewCampaign.tsx, so a campaign's review and the Review place (every
// campaign at once) share it; with one selected, the bar's second pill is "Needs changes" (it opens the creative as if
// N was pressed there).
import { ActionBar, useToast } from "@fume/ui";
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useApprove, useUnapprove } from "../../api/hooks";
import type { Creative, Id } from "../../contract";
import * as copy from "../../copy";

const inField = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

/** The selection over `list` (in its order): `marked` creatives are left out of it. */
export function useReviewSelection(list: Creative[], marked: (c: Creative) => boolean, canApprove: boolean) {
  const [out, setOut] = useState<Set<Id>>(() => new Set());
  /** The last circle she clicked, where a shift-click's range starts (DTSK-10). */
  const anchor = useRef<number | null>(null);
  const open = list.filter((c) => !marked(c));
  const selected = open.filter((c) => !out.has(c.id));

  const toggle = (id: Id, on: boolean, e?: ReactMouseEvent<HTMLElement>) => {
    const at = list.findIndex((c) => c.id === id);
    const from = e?.shiftKey && anchor.current !== null ? anchor.current : at;
    const range = list.slice(Math.min(from, at), Math.max(from, at) + 1).map((c) => c.id);
    setOut((p) => {
      const next = new Set(p);
      for (const r of range) {
        if (on) next.delete(r);
        else next.add(r);
      }
      return next;
    });
    anchor.current = at;
  };

  // ⌘A selects every creative that waits, while nothing else has the keys (a field, the viewer).
  useEffect(() => {
    if (!canApprove) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== "a") return;
      if (inField(e.target) || (e.target instanceof Element && e.target.closest("[role='dialog']"))) return;
      e.preventDefault();
      setOut(new Set());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canApprove]);

  return {
    out,
    open,
    selected,
    toggle,
    isSelected: (c: Creative) => !out.has(c.id),
    selectAll: () => setOut(new Set()),
    clear: () => setOut(new Set(open.map((c) => c.id))),
  };
}

/** The bar: "6 selected", ✕, and Approve 6 (with Needs changes beside it when one is selected and she may ask). */
export function ApproveBar({
  selected,
  onClear,
  onNeedsChanges,
}: {
  selected: Creative[];
  onClear: () => void;
  /** One selected: open it as if N was pressed. Left out when she may not ask for changes. */
  onNeedsChanges?: (c: Creative) => void;
}) {
  const toast = useToast();
  const approve = useApprove();
  const unapprove = useUnapprove();
  const n = selected.length;
  const approveSelected = () => {
    const ids = selected.map((c) => c.current.id);
    // The promise, not mutate's callbacks: approving the last of them replaces this list with what comes next.
    approve.mutateAsync(ids).then(
      () =>
        toast.done(`${copy.creatives(ids.length)} approved`, {
          action: {
            label: "Undo",
            onClick: () => unapprove.mutateAsync(ids).catch((e: Error) => toast.error("The approval stays", { description: e.message })),
          },
        }),
      (e: Error) => toast.error("Nothing was approved", { description: e.message }),
    );
  };
  return (
    // On a phone the bar takes the tab bar's slot while the selection is open (tab-bar.css, data-tab-bar).
    <div className="ui-action-bar-dock" data-tab-bar={n > 0 ? "replace" : undefined}>
      <ActionBar
        dock="none"
        open={n > 0}
        count={n}
        onClear={onClear}
        aria-label={`${n} selected`}
        actions={[
          ...(n === 1 && onNeedsChanges ? [{ label: "Needs changes", icon: "message-square" as const, onSelect: () => onNeedsChanges(selected[0]!) }] : []),
          { label: `Approve ${n}`, icon: "check" as const, variant: "white" as const, disabled: approve.isPending, onSelect: approveSelected },
        ]}
      />
    </div>
  );
}

/** The words over the grid: they follow the selection, so they and the bar never disagree (DLOAD-12). */
export function selectionWords({ n, total, open, approver, canApprove, canAsk }: { n: number; total: number; open: number; approver: string; canApprove: boolean; canAsk: boolean }): string {
  const marked = total - open;
  const needs = marked ? ` ${copy.count(marked, "creative")} ${marked === 1 ? "needs" : "need"} changes.` : "";
  if (!canApprove) return canAsk ? `Open one to comment, or mark it Needs changes; ${approver} approves.` : `${approver} approves these.`;
  if (open === 0) return total === 1 ? "It needs changes." : "All of them need changes.";
  if (n === 0) return `None is selected; click a circle to select one.${needs}`;
  if (n === total) return total === 1 ? "It is selected." : "All are selected; click a circle to leave one out.";
  if (n === open) return `${open === 1 ? "The other one is" : `The other ${open} are`} selected.${needs}`;
  return `${n} of ${open} ${n === 1 ? "is" : "are"} selected.${needs}`;
}
