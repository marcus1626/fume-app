// The Engine panel's state (Round 15, PROPOSED 9 Nov 2026). Marcus, 9 Nov: "the right side should be a panel that can
// be opened and closed for the whole app, tied to the main Engine chat", with a global or a project thread. One store
// for the whole app, so the panel in the staff frame and the one beside the Studio's desk are the same panel:
// - open or closed, remembered per person on this computer (a convenience, safe to lose);
// - what the Engine can see right now: the page registers it (the brand, the project and its thread, small facts such
//   as the picked version or the playhead, and on the desk the handlers a change card needs);
// - the field she asked about ("Ask about this"), until she takes it off or leaves the page;
// - the thread she switched to on this page, the draft she is writing in each thread, and the words the Engine wrote
//   for a field from the panel, waiting by that field.
import type { IconName } from "@fume/ui";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useSession } from "../../api/hooks";
import type { CreativeDocument, EngineField, EngineTopic, Id, StudioMode, VarValue } from "../../contract";

/** The open document's hands on the desk: a change card keeps, undoes and renders through them. */
export interface EngineDesk {
  doc: CreativeDocument;
  mode?: StudioMode;
  /** A version is rendering: Keep and render waits. */
  busy: boolean;
  /** The Engine is fixing the creative from Check: she waits or takes over on the desk before she asks it more. */
  locked?: boolean;
  /** Saves the desk's unsaved changes first (an undo step), as every Engine ask does. */
  onBefore: () => void;
  /** A change the Engine only suggested, taken with Yes (an undo step of the desk). */
  onVariable: (key: string, value: VarValue) => void;
}

/** One thing the Engine sees, as a small chip in the panel's context line. */
export interface EngineSeen {
  id: string;
  icon: IconName;
  words: string;
}

/** What a page tells the Engine panel. Several pages can tell it at once (the desk, then the video in it); the panel
 *  reads them in order, a later one adding to an earlier one. */
export interface EngineSight {
  workspaceId?: Id;
  /** The project the page is about: its thread opens first. */
  topic?: EngineTopic;
  /** The project's name: "Winter gifting", "Master 3 · Feed 4:5". */
  title?: string;
  seen?: EngineSeen[];
  desk?: EngineDesk;
}

/** A field she asked about: its words go with every message until she takes it off. */
export interface AskedField {
  field: EngineField;
  /** Where it is: "Winter gifting's plan", "LYSNE's Tone of Voice". */
  where: string;
}

/** "brand", "campaign:c-winter", "document:doc-autumn-m3" */
export const threadKey = (topic?: EngineTopic) => (topic ? `${topic.kind}:${topic.id}` : "brand");
export const topicOf = (key: string): EngineTopic | undefined => {
  const [kind, id] = key.split(":");
  return (kind === "campaign" || kind === "document") && id ? { kind, id } : undefined;
};
/** A field's own name in the store, so the words the Engine wrote find their way back to it. */
export const fieldKey = (f: EngineField) =>
  f.kind === "plan_line"
    ? `plan:${f.campaignId}:${f.key}`
    : f.kind === "plan_creative"
      ? `plan:${f.campaignId}:${f.creativeId}:${f.part}`
      : `book:${f.workspaceId}:${f.path}`;

export interface EnginePanelState {
  open: boolean;
  sights: { id: number; rank: number; sight: EngineSight }[];
  asked?: AskedField;
  /** The thread she switched to, and the page's own thread when she did: a new page opens its own again. */
  chosen?: { on: string; thread: string };
  drafts: Record<string, string>;
  /** Words the Engine wrote for a field from the panel, waiting by that field. */
  offers: Record<string, string>;
  /** Asks the panel's composer to take the focus. */
  focus: number;
  /** Words from "Tell the Engine" (round 16), for the thread they go to; it sends them as it opens. */
  outbox?: { thread: string; text: string; n: number };
}

let state: EnginePanelState = { open: false, sights: [], drafts: {}, offers: {}, focus: 0 };
let userId: string | undefined;
let seq = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const set = (patch: Partial<EnginePanelState>) => {
  state = { ...state, ...patch };
  notify();
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const storageKey = (id: string) => `fume.engine.panel.${id}`;
function remember(open: boolean) {
  if (!userId) return;
  try {
    localStorage.setItem(storageKey(userId), open ? "1" : "0");
  } catch {
    /* private mode: it lasts until the page closes */
  }
}
/** The person signed in: the panel opens as they left it on this computer. Read while drawing, so the first frame is
 *  already right; whoever drew before hears of it after. */
function signedIn(id: string) {
  if (userId === id) return;
  userId = id;
  let open = false;
  try {
    open = localStorage.getItem(storageKey(id)) === "1";
  } catch {
    /* no storage: closed */
  }
  state = { ...state, open, asked: undefined, chosen: undefined, offers: {}, drafts: {}, outbox: undefined };
  queueMicrotask(notify);
}

/** The panel's actions, the same from anywhere in the app. */
export const enginePanel = {
  setOpen(open: boolean) {
    remember(open);
    set({ open, ...(open ? { focus: state.focus + 1 } : {}) });
  },
  toggle() {
    enginePanel.setOpen(!state.open);
  },
  /** "Ask about this": the panel opens on the page's thread with the field as context, the composer ready. */
  ask(asked: AskedField) {
    remember(true);
    set({ open: true, asked, chosen: undefined, focus: state.focus + 1 });
  },
  dropField() {
    set({ asked: undefined });
  },
  choose(on: string, thread: string) {
    set({ chosen: { on, thread } });
  },
  draft(thread: string, text: string) {
    set({ drafts: { ...state.drafts, [thread]: text } });
  },
  /** Puts words the Engine wrote by their field, where she keeps or drops them. */
  offer(field: EngineField, text: string) {
    set({ offers: { ...state.offers, [fieldKey(field)]: text } });
  },
  takeOffer(key: string) {
    const { [key]: _, ...rest } = state.offers;
    set({ offers: rest });
  },
  /** "Tell the Engine" (round 16): words written while the panel was closed go to the page's own thread, which opens
   *  and sends them, so the answer and any change card are where they always are. */
  send(thread: string, text: string) {
    remember(true);
    set({
      open: true,
      chosen: undefined,
      drafts: { ...state.drafts, [thread]: text },
      outbox: { thread, text, n: (state.outbox?.n ?? 0) + 1 },
      focus: state.focus + 1,
    });
  },
  /** The words waiting for this thread, taken once (a second call, as React's checks make in development, gets none). */
  claimOutbox(thread: string): string | undefined {
    const o = state.outbox;
    if (!o || o.thread !== thread) return undefined;
    set({ outbox: undefined });
    return o.text;
  },
  /** A new page: the field asked about belonged to the last one. */
  leftPage() {
    if (state.asked) set({ asked: undefined });
  },
};

/** A part of the panel's state, for the parts that draw it. The pick must return the state's own values (not a new
 *  object), so a change elsewhere does not draw it again. */
export function useEngineState<T>(pick: (s: EnginePanelState) => T): T {
  const me = useSession().data?.user.id;
  if (me) signedIn(me);
  return useSyncExternalStore(
    subscribe,
    () => pick(state),
    () => pick(state),
  );
}

/** What the Engine can see on this page: one object, merged from every page part that told it (later ones add). */
export function useEngineSees(): EngineSight & { seen: EngineSeen[] } {
  const sights = useEngineState((s) => s.sights);
  return useMemo(() => {
    const out: EngineSight & { seen: EngineSeen[] } = { seen: [] };
    for (const { sight } of [...sights].sort((a, b) => a.rank - b.rank || a.id - b.id)) {
      const { seen, ...rest } = sight;
      Object.assign(out, Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)));
      for (const s of seen ?? []) if (!out.seen.some((x) => x.id === s.id)) out.seen.push(s);
    }
    return out;
  }, [sights]);
}

/** A page tells the Engine what it sees while it is open. Pass a memoised sight: a new object is told again, in its
 *  place. `rank` orders parts of one page: the desk (0) before the video in it (1). */
export function useEngineSight(sight: EngineSight | undefined, rank = 0) {
  const id = useRef(0);
  useEffect(() => {
    id.current = seq += 1;
    return () => set({ sights: state.sights.filter((s) => s.id !== id.current) });
  }, []);
  useEffect(() => {
    const others = state.sights.filter((s) => s.id !== id.current);
    if (!sight) {
      if (others.length !== state.sights.length) set({ sights: others });
      return;
    }
    const at = state.sights.findIndex((s) => s.id === id.current);
    const entry = { id: id.current, rank, sight };
    set({ sights: at < 0 ? [...others, entry] : state.sights.map((s, i) => (i === at ? entry : s)) });
  }, [sight, rank]);
}

// ─── A web session's chat (round 16, PROPOSED 9 Nov 2026) ───────────────────
// Marcus, 9 Nov: "The chat log can stay in the chat within the same web session. But if you have left Fume completely
// and come back, the chat should be empty, BUT remember earlier chats that were about 'The plan', for example."
// A session is this browser tab's (sessionStorage): a reload keeps it, closing Fume ends it. The first time a session
// opens a thread, the newest message there marks where this session's chat begins; what came before is "Earlier", listed
// by what it was about, and the Engine remembers it unless she takes the chip off.

const SESSION_KEY = "fume.engine.session";
/** Where each thread's chat begins in this session, by thread. Kept in memory too, for a browser without storage. */
let marks: Record<string, string> | undefined;
function readMarks(): Record<string, string> {
  if (marks) return marks;
  try {
    marks = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "{}") as Record<string, string>;
  } catch {
    marks = {};
  }
  return marks;
}
/** The id this session's chat in a thread begins after ("" when the thread was empty); set once, the first time. */
function sessionMark(thread: string, lastId: string): string {
  const m = readMarks();
  if (thread in m) return m[thread]!;
  m[thread] = lastId;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(m));
  } catch {
    /* no storage: this page load is the session */
  }
  return lastId;
}

/** A thread's messages (or changes) in two: before this session, and in it. `stays` keeps one in the session's chat
 *  whenever it was made (a change that still waits for her). */
export function useSessionSplit<T extends { id: string }>(
  thread: string,
  items: T[] | undefined,
  stays?: (item: T) => boolean,
): { earlier: T[]; now: T[]; ready: boolean } {
  return useMemo(() => {
    if (!items) return { earlier: [], now: [], ready: false };
    const mark = sessionMark(thread, items.at(-1)?.id ?? "");
    const at = mark ? items.findIndex((x) => x.id === mark) : -1;
    // A mark no longer there (the thread was cleared): all of it is this session's
    if (mark && at < 0) return { earlier: [], now: items, ready: true };
    const before = items.slice(0, at + 1);
    return {
      earlier: before.filter((x) => !stays?.(x)),
      now: [...before.filter((x) => stays?.(x)), ...items.slice(at + 1)],
      ready: true,
    };
  }, [thread, items, stays]);
}

/** One earlier chat: messages close in time about one thing ("The plan"), named by it and by the day. */
export interface EarlierChat<T> {
  id: string;
  about?: string;
  at: string;
  /** Her first words in it. */
  said?: string;
  items: T[];
}

/** Earlier messages as chats: a new one begins after three quiet hours or when she writes from another part. */
export function earlierChats<T extends { id: string; at: string; page?: string; text?: string; mine?: boolean }>(
  items: T[],
): EarlierChat<T>[] {
  const chats: EarlierChat<T>[] = [];
  for (const x of items) {
    const last = chats.at(-1);
    const gap = last ? Date.parse(x.at) - Date.parse(last.items.at(-1)!.at) : Infinity;
    const elsewhere = Boolean(x.page && last?.about && x.page !== last.about);
    if (!last || gap > 3 * 3_600_000 || elsewhere) chats.push({ id: x.id, about: x.page, at: x.at, items: [x] });
    else {
      last.items.push(x);
      last.about ??= x.page;
    }
    const chat = chats.at(-1)!;
    if (!chat.said && x.mine) chat.said = x.text;
  }
  return chats.reverse();
}
