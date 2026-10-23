// The keys of a confirm queue (round 9, DWAY-13, DTSK-14): ← → step between items when the focus is not in a field,
// ⌘↵ (Ctrl+Enter) confirms, Esc leaves a field first (onto its card, tabIndex -1) and then the queue (what Back does). ↑ ↓ live on the list itself
// (CheckQueueList). A dialog, sheet, menu or the palette on top keeps its own keys. Never an arrow to decide.
import { useEffect, useRef } from "react";

export interface QueueKeys {
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  /** Left out while there is nothing to confirm (the end card). */
  onConfirm?: () => void;
}

const FIELD = 'input, textarea, select, [contenteditable="true"], [role="textbox"]';
const LAYER = '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="menu"][data-state="open"], [cmdk-root]';

export function useQueueKeys(keys: QueueKeys) {
  const latest = useRef(keys);
  latest.current = keys;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      if (document.querySelector(LAYER)) return;
      const k = latest.current;
      const target = e.target as HTMLElement | null;
      const field = target?.closest<HTMLElement>(FIELD);
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        if (!k.onConfirm) return;
        e.preventDefault();
        k.onConfirm();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        // Out of the field onto its card (never to the page's body), so ← → step from there; then out of the queue.
        // An empty field the queue focused for her holds nothing to lose, so Esc leaves at once.
        const empty = field && !((field.matches("textarea, input") ? (field as HTMLInputElement) : field.querySelector<HTMLInputElement>("textarea, input"))?.value ?? "").trim();
        if (field && !empty) {
          const card = field.closest<HTMLElement>(".ui-check-card");
          if (card) card.focus({ preventScroll: true });
          else field.blur();
        } else k.onClose();
        return;
      }
      if (field || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        k.onPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        k.onNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
