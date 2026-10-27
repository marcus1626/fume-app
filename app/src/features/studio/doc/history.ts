// Undo and redo inside a creative document (FLOWS §9.2): edits to variables, specs and layers between renders are
// undo/redo (⌘Z, ⌘⇧Z; Ctrl elsewhere), not versions. The document keeps a local copy that changes at once, a history
// of snapshots, and saves to the backend after a short pause. Quick changes to one control (a slider drag, typing)
// fold into one step. While a save is on its way the local copy leads; once it lands the backend's copy is the truth
// again, and a change from elsewhere (an Engine edit, a picked version) becomes a step you can undo too.
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useUpdateDocument } from "../../../api/hooks";
import type { CreativeDocument, Layer, Specs, Variables, VideoEdit } from "../../../contract";

export interface Snapshot {
  variables: Variables;
  specs: Specs;
  layers: Layer[];
  /** A video's edit (FLOWS §27): cutting, trimming, words and sound are undo steps too. */
  video?: VideoEdit;
}

const snapOf = (d: CreativeDocument): Snapshot => ({
  variables: d.variables,
  specs: d.specs,
  layers: d.layers,
  ...(d.video ? { video: d.video } : {}),
});
const same = (a: Snapshot, b: Snapshot) => JSON.stringify(a) === JSON.stringify(b);
const FOLD_MS = 800;
const SAVE_MS = 350;

export function useDocumentHistory(doc: CreativeDocument) {
  const update = useUpdateDocument();
  const [state, setState] = useState<Snapshot>(() => snapOf(doc));
  const current = useRef(state);
  current.current = state;
  const past = useRef<Snapshot[]>([]);
  const future = useRef<Snapshot[]>([]);
  const last = useRef<{ key: string; at: number }>();
  const timer = useRef<number>();
  const inflight = useRef(0);
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  const save = useCallback(
    (snap: Snapshot) => {
      window.clearTimeout(timer.current);
      timer.current = undefined;
      inflight.current += 1;
      update.mutate(
        {
          documentId: doc.id,
          change: {
            variables: snap.variables,
            specs: snap.specs,
            layers: snap.layers,
            ...(snap.video ? { video: snap.video } : {}),
          },
        },
        { onSettled: () => (inflight.current -= 1) },
      );
    },
    [doc.id, update],
  );
  const schedule = (snap: Snapshot) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => save(snap), SAVE_MS);
  };

  // The backend's copy wins whenever nothing of ours is on its way.
  useEffect(() => {
    if (timer.current !== undefined || inflight.current > 0) return;
    const server = snapOf(doc);
    if (same(server, current.current)) return;
    past.current.push(current.current);
    future.current = [];
    last.current = undefined;
    setState(server);
  }, [doc]);

  /** Change part of the document; `key` names the control, so a drag or typing folds into one undo step. */
  const change = (part: Partial<Snapshot>, key: string) => {
    const now = Date.now();
    const fold = last.current?.key === key && now - last.current.at < FOLD_MS;
    if (!fold) {
      past.current.push(current.current);
      future.current = [];
    }
    last.current = { key, at: now };
    const next = { ...current.current, ...part };
    current.current = next;
    setState(next);
    schedule(next);
  };

  const step = (from: React.MutableRefObject<Snapshot[]>, to: React.MutableRefObject<Snapshot[]>) => {
    const snap = from.current.pop();
    if (!snap) return;
    to.current.push(current.current);
    last.current = undefined;
    current.current = snap;
    setState(snap);
    schedule(snap);
    rerender();
  };
  const undo = () => step(past, future);
  const redo = () => step(future, past);

  /** Saves at once (before a render, a send to check or a save). */
  const flush = () => {
    if (timer.current !== undefined) save(current.current);
  };

  /** Forget the history (a new mode starts from its own defaults). */
  const reset = () => {
    past.current = [];
    future.current = [];
    last.current = undefined;
    rerender();
  };

  const keys = useRef({ undo, redo });
  keys.current = { undo, redo };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.closest("input, textarea, [contenteditable='true']") || t.isContentEditable)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) keys.current.undo();
      else if ((k === "z" && e.shiftKey) || (k === "y" && e.ctrlKey)) keys.current.redo();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Leaving the desk with a change still waiting saves it.
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => flushRef.current(), []);

  return {
    state,
    change,
    undo,
    redo,
    flush,
    reset,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}
