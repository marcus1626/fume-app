// Touch or mouse: screens pick their words and their first focus by the person's main pointer. A finger (pointer:
// coarse) taps, so the words say "Tap", never "click", "drop" or "press"; and a dialog does not put the cursor in its
// first field, which would raise the keyboard over its buttons before the dialog is read. A mouse or a pen (pointer:
// fine) keeps the desk words and the first-field focus.
//   const touch = useTouch();
//   <p>{touch ? "Tap the creative to pin a comment" : "Click the creative to pin a comment on a spot"}</p>
import { useEffect, useState } from "react";

const COARSE = "(pointer: coarse)";

/** True when the main pointer is a finger, right now. */
export function isTouch(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(COARSE).matches;
}

/** True when the main pointer is a finger; follows a change (a tablet's keyboard folded away). */
export function useTouch(): boolean {
  const [touch, setTouch] = useState(isTouch);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(COARSE);
    const on = () => setTouch(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return touch;
}
