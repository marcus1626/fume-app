// Dragging on the calendar with pointer events: a creative from the tray onto a day, or a planned post to another
// day. A press that moves less than a few pixels stays a click. The day under the pointer is found by its
// data-day, so the whole cell (under bars and posts) takes the drop.
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Format } from "../../contract";
import type { Day } from "./dates";

export interface DragPayload {
  kind: "creative" | "entry";
  id: string;
  image?: string;
  label: string;
  format?: Format;
}

export interface DragState extends DragPayload {
  x: number;
  y: number;
  over: Day | null;
}

const THRESHOLD = 6;

function dayAt(x: number, y: number): Day | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const day = (el as HTMLElement).dataset?.day;
    if (day) return day;
  }
  return null;
}

export function useCalendarDrag(onDrop: (payload: DragPayload, day: Day) => void) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const dropRef = useRef(onDrop);
  dropRef.current = onDrop;
  // Set while a drag ends, so the click the browser sends after it does not open the post.
  const justDragged = useRef(false);
  const cleanup = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanup.current?.(), []);

  const start = (event: ReactPointerEvent<HTMLElement>, payload: DragPayload) => {
    // A phone plans with the dialog; only a mouse or a pen drags.
    if (event.button !== 0 || event.pointerType === "touch") return;
    const x0 = event.clientX;
    const y0 = event.clientY;
    let active = false;
    let over: Day | null = null;

    const move = (e: PointerEvent) => {
      if (!active && Math.hypot(e.clientX - x0, e.clientY - y0) < THRESHOLD) return;
      if (!active) {
        active = true;
        document.documentElement.dataset.uiDragging = "";
      }
      e.preventDefault();
      over = dayAt(e.clientX, e.clientY);
      setDrag({ ...payload, x: e.clientX, y: e.clientY, over });
    };
    const end = (e: PointerEvent) => {
      stop();
      if (!active) return;
      justDragged.current = true;
      window.setTimeout(() => (justDragged.current = false), 0);
      const day = e.type === "pointerup" ? dayAt(e.clientX, e.clientY) : null;
      setDrag(null);
      if (day) dropRef.current(payload, day);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      stop();
      setDrag(null);
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("keydown", key);
      delete document.documentElement.dataset.uiDragging;
      cleanup.current = null;
    };
    cleanup.current?.();
    cleanup.current = stop;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("keydown", key);
  };

  return { drag, start, wasDrag: () => justDragged.current };
}
