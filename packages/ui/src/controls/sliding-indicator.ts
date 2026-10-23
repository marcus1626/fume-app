// The sliding white pill of segmented controls and tabs, re-implemented from segmented.js and tabs.js:
// place --x/--w (horizontal, on .ui-seg-indicator) or --y/--h (vertical, on .ui-tabs-indicator) from the selected
// option; is-placing while placing without motion (first paint, resize), is-ready once placed so the pill shows.
import { useEffect, useLayoutEffect, useState, type RefObject } from "react";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export interface SlidingIndicatorState {
  /** Add "is-ready" to the track: the indicator is placed and visible. */
  ready: boolean;
  /** Add "is-placing" to the track: move without the slide. */
  placing: boolean;
}

/**
 * @param listRef the track (.ui-seg or .ui-tabs-list--vertical)
 * @param indicatorRef the pill (.ui-seg-indicator or .ui-tabs-indicator)
 * @param selectedKey changes whenever the selection changes (the selected value)
 * @param axis "x" for a horizontal track, "y" for a vertical one
 */
export function useSlidingIndicator(
  listRef: RefObject<HTMLElement>,
  indicatorRef: RefObject<HTMLElement>,
  selectedKey: string | undefined,
  axis: "x" | "y" = "x",
): SlidingIndicatorState {
  const [ready, setReady] = useState(false);
  const [placing, setPlacing] = useState(true);

  const place = () => {
    const list = listRef.current, ind = indicatorRef.current;
    if (!list || !ind) return;
    const sel = list.querySelector<HTMLElement>('[aria-selected="true"], [aria-pressed="true"], [aria-checked="true"]');
    if (!sel) return;
    if (axis === "x") {
      ind.style.setProperty("--x", `${sel.offsetLeft}px`);
      ind.style.setProperty("--w", `${sel.offsetWidth}px`);
    } else {
      ind.style.setProperty("--y", `${sel.offsetTop}px`);
      ind.style.setProperty("--h", `${sel.offsetHeight}px`);
    }
  };

  // First paint: place without motion, then show the pill two frames later (as segmented.js does).
  useIsoLayoutEffect(() => {
    place();
    let a = 0, b = 0;
    a = requestAnimationFrame(() => {
      b = requestAnimationFrame(() => {
        place(); // measure again: a label that changed in these two frames (a count arriving) is not missed
        setReady(true);
        setPlacing(false);
      });
    });
    return () => {
      cancelAnimationFrame(a);
      cancelAnimationFrame(b);
    };
     
  }, []);

  // A new selection: slide to it.
  useIsoLayoutEffect(() => {
    place();
     
  }, [selectedKey]);

  // While placing (after a resize), move without the slide, then let it slide again.
  useIsoLayoutEffect(() => {
    if (!placing || !ready) return;
    place();
    const f = requestAnimationFrame(() => setPlacing(false));
    return () => cancelAnimationFrame(f);
     
  }, [placing, ready]);

  // Resizes (fonts arriving, a narrower window, a label that changes) re-place it without motion.
  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof ResizeObserver === "undefined") return;
    // Every call re-places, the first one too: a count that arrives just after the first paint (Check's tabs, round 13)
    // changes the options' widths before the observer's first call, and skipping it left the pill short. The options
    // are watched as well as the track, so a sibling growing inside a track of fixed width moves the pill too.
    const ro = new ResizeObserver(() => {
      // Before the pill shows, place it at once (it is hidden, so nothing slides); after, place it without motion.
      if (!listRef.current?.classList.contains("is-ready")) place();
      setPlacing(true);
    });
    ro.observe(list);
    Array.from(list.children).forEach((c) => ro.observe(c));
    return () => ro.disconnect();
  }, [listRef]);

  return { ready, placing };
}

/** Moves focus and selection with the arrow keys, Home and End over the enabled options of a list (as
 *  segmented.js and tabs.js do: the arrows choose, wrapping). Returns the value to choose, or undefined. */
export function nextByKey(list: HTMLElement, key: string, selector: string): HTMLElement | undefined {
  const items = Array.from(list.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => !(el as HTMLButtonElement).disabled && !el.hasAttribute("data-disabled"),
  );
  const i = items.indexOf(document.activeElement as HTMLElement);
  if (i < 0) return undefined;
  const step = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[key];
  if (step) return items[(i + step + items.length) % items.length];
  if (key === "Home") return items[0];
  if (key === "End") return items[items.length - 1];
  return undefined;
}
