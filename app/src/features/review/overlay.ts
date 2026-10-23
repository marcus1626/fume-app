// A full-screen layer kept in the address (?c=<creative>, ?creative=<creative>, ?swipe=1), over the page that holds
// it (UX review 19 Oct, WAY-7, WAY-8): opening it is one history entry, moving inside it replaces that entry, and
// closing goes back in history, so the phone's back gesture closes the layer and nothing else, and the page under it
// (its selection, filters and scroll) is still there. On a cold deep link (nothing before it in this tab) closing
// takes the parameter off instead.
// Round 9 (PROPOSED 19 Oct 2026, DTSK-2): open() may carry more of the address with it (?c=<id>&ask=1 opens the viewer
// with its change form already open in the panel); the viewer reads such a word once and takes it off.
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

/** True when this tab's history has an entry before this one that the app made (the browser router's idx). */
export function hasHistory(): boolean {
  const idx = (window.history.state as { idx?: unknown } | null)?.idx;
  return typeof idx === "number" && idx > 0;
}

export function useOverlay(key: string) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const value = params.get(key);
  const with_ = (v: string | null, extra?: Record<string, string>) => {
    const p = new URLSearchParams(params);
    if (v === null) p.delete(key);
    else p.set(key, v);
    for (const [k, x] of Object.entries(extra ?? {})) p.set(k, x);
    return p;
  };
  return {
    value,
    /** Opens the layer: a new history entry. */
    open: (v: string, extra?: Record<string, string>) => setParams(with_(v, extra)),
    /** Moves inside the layer (the next creative): the same entry. */
    move: (v: string) => setParams(with_(v), { replace: true, state: location.state }),
    /** Closes the layer: back in history, or off the address on a cold link. */
    close: () => {
      if (hasHistory()) navigate(-1);
      else setParams(with_(null), { replace: true });
    },
  };
}
