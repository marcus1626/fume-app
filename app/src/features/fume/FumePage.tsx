// One conversation with Fume (FLOWS §12 and §23; Marcus 15 Oct: "Fume chatten lagrer ikke chatter, fordi den husker
// alt"; Marcus's card 20 Oct: "Én samtale", DECIDED). Fume remembers everything; campaigns appear in the talk as cards
// (brief, plan, runs, creatives, questions). ?new=1 starts a campaign: the next message becomes its first brief line.
//
// Round 8 (UX review 19 Oct, PROPOSED): the chat remembers her, not only the work.
// - Her unsent words stay, and a new campaign's words travel to and from the manual brief through sessionStorage
//   "fume-campaign-draft" = {name?, goal?, text?} (WAY-5, WAY-16, TASK-9).
// - Back from a card puts her where she was; a new answer from Fume comes into view from its top (WAY-5, TASK-10).
// - A new campaign starts on its own marker with the earlier talk folded behind "Earlier" (WAY-17); "Jump to a
//   campaign" lands on a campaign's latest card (WAY-19, MOB-2); on a phone the composer is one line and the tab bar
//   steps away while she writes (chat.css).
//
// Round 9 (desktop first, PROPOSED 19 Oct 2026), kept: the head over the conversation at its left edge, the composer
// with the focus on a desk and its keys, Fume's message with buttons in view above the composer (DTSK-3), the focus
// back in the composer after a tapped answer (DTSK-20), and from 1280 px the panel on the right (DLAY-5).
//
// Round 10 (PROPOSED 20 Oct 2026; FLOWS §22–§23):
// - ONE conversation on every screen size: no list of conversations. Every Fume message of the workspace, oldest
//   first, in one stream at a reading measure (the backend still keeps a thread per campaign: they are merged here).
//   Where the talk turns to a campaign, a quiet marker names it once (a link to it); where it turns back to talk
//   about nothing in particular, a quiet "Not about a campaign".
// - /fume/:threadId (the bell, Home, ⌘K) opens the one stream at that campaign's latest message, marked for a moment.
// - The composer answers what Fume last asked (the thread of the newest open question or brief), else the talk that
//   is not about a campaign. When more than one thing is open, a line over the composer says which campaign the reply
//   goes to, with Change.
// - The panel on the right (from 1280 px): "The brief" while one is written, with "Send to Fume"; once it is sent it
//   follows that campaign as "The plan" (writing, in check, then its summary and "Open the plan"). Nothing in flight:
//   no panel. She SENDS the brief; she approves the plan, on the plan page; nothing is made before that.
//
// Round 13 (Marcus's video comments of 21 Oct, #13 to #20; PROPOSED 22 Oct 2026):
// - #13: the panel hides and shows like Claude's artifact panel: a toggle in the head, remembered per viewer
//   (localStorage "fume-chat-panel"); without the panel the conversation is one calm column in the middle, the
//   composer pinned at its foot.
// - #15: what the chat links to (a campaign, a plan, a creative, a product, a collection) opens in the panel, with
//   "Open full page" (open.tsx, panel.tsx); the full page has "← Back to the conversation".
// - #16: "@" names a campaign, a product, a collection or a creative (mention.tsx); Fume answers about it with a line
//   that opens it in the panel. An empty composer offers a few questions.
// - #17: "Make a Christmas campaign for Hand Balm" starts the campaign from the composer, as New campaign does.
// - #19: her answer to "Which product is it for?" is not repeated as her bubble; the card shows the product.
// - #20: /fume?plan=<campaignId> (the plan page's "Change it with Fume") opens the chat with that plan in the panel,
//   and her words change it: Fume writes the next version at once and says in one line what changed.
import {
  Button,
  Composer,
  Marker,
  Message,
  MessageContent,
  MessageHeader,
  MessageScroller,
  MessageStatus,
  MessageText,
  OptionMenu,
  PageHeader,
  attachmentMeta,
  useNarrowScreen,
  type ComposerAttachment,
  type MessageScrollerHandle,
} from "@fume/ui";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useNavigationType, useParams, useSearchParams } from "react-router-dom";
import { useCampaign, useCampaigns, useCatalogue, useChangePlanWithFume, useConversation, usePeople, usePlan, useSay, useSend, useSession, useStartCampaign, useTeam, useThreads } from "../../api/hooks";
import type { Campaign, ChatLink, Id, Message as FumeMessage, ProductQuestionCard } from "../../contract";
import { time } from "../../lib/time";
import { Page, Query } from "../../shell/Page";
import { directory, firstName } from "../../shell/people";
import { StartCampaign } from "../campaigns/parts";
import { confirmed } from "./AllProducts";
import { BriefPanel, ChatHead } from "./desk";
import { cannotWrite, DayMarker, dayLabel, MessageView } from "./parts";
import { PlanPanel } from "./plan";
import { AskSuggestions, useMentions } from "./mention";
import { ChatLinkProvider, linkKey, useOpenFullPage } from "./open";
import { LinkPanel } from "./panel";

const COMPOSER_ID = "fume-composer";
/** A dialog or panel playing its closing animation. */
const CLOSING = "[role='dialog'][data-state='closed'], [role='alertdialog'][data-state='closed']";
/** Every message's anchor: the chat comes back to it and reveals a new answer from it. */
const anchor = (messageId: Id) => `fume-m-${messageId}`;
/** The marker where the talk turns to a campaign (or back to talk about nothing in particular). */
const turnAnchor = (messageId: Id) => `fume-turn-${messageId}`;
/** A burst of talk shows its time once: a gap longer than this starts a new one. */
const BURST = 30 * 60_000;
/** How long the message an address points at stays marked (app.css [data-ui-target] plays its own fade). */
const MARKED_MS = 4000;
/** Talk that is about no campaign, in the marker and the reply line. */
const NO_CAMPAIGN = "Not about a campaign";

// ── What the chat keeps for her (sessionStorage, for the visit) ──
/** Shared with the manual brief (the form side is NewBriefPage's): the new campaign's words, either way. */
const CAMPAIGN_DRAFT = "fume-campaign-draft";
const chatDraft = (workspaceId: Id) => `fume-chat-draft:${workspaceId}`;
const PLACE = "fume-chat-place";
/** The campaign the panel follows once she started or sent it here, until its plan is approved. */
const FOLLOW = (workspaceId: Id) => `fume-chat-follow:${workspaceId}`;
/** Round 13 (#15): what she opened from the chat into the panel, for the visit (Back from its full page keeps it). */
const OPENED = (workspaceId: Id) => `fume-chat-open:${workspaceId}`;
/** Round 13 (#13): the panel hidden or shown, per viewer, kept on this device. */
const PANEL = "fume-chat-panel";
function panelHidden(): boolean {
  try {
    return localStorage.getItem(PANEL) === "hidden";
  } catch {
    return false;
  }
}
function keepPanel(hidden: boolean) {
  try {
    localStorage.setItem(PANEL, hidden ? "hidden" : "shown");
  } catch {
    /* the choice holds for this visit only */
  }
}
/** #17: words that ask for a new campaign ("Make a Christmas campaign for Hand Balm"). */
const NEW_CAMPAIGN = /(^(please\s+)?(make|start|create|set up|begin|plan|launch)\b|\b(i want|i'd like|i would like|let's|lets|can you|could you|we need|i need)\b)[^.?!]*\b(a|an|new|another)\b[^.?!]*\bcampaign\b\s*(for|to|about|on|around|with|$|[.!])/i;
/** #20: words that change a plan: how many, which kind, when. */
const PLAN_WORDS = /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve)\s+(creatives?|videos?|carousels?|stories|feed posts?)\b|\b(more|fewer|less|no|add|some)\s+(creatives?|videos?|carousels?)\b|\b(masters?|go(es)? live|launch)\b[^?]*\b(by|on|to)\b|\bweeks? (earlier|sooner|later)\b/i;
/** A question rather than a change ("Where is…?"). */
const ASKS = (words: string) => /\?\s*$/.test(words.trim()) || /^(where|what|when|how|why|who|which|is|are|can|could|do|does)\b/i.test(words.trim());

function read<T>(key: string): T | undefined {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}
function keep(key: string, value: unknown) {
  try {
    if (value === undefined) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* nothing is kept; the chat still works */
  }
}
/** The composer's first words for a new campaign: what she wrote here, or what she wrote in the form. */
function campaignWords(): string {
  const draft = read<{ name?: string; goal?: string; text?: string }>(CAMPAIGN_DRAFT);
  if (!draft) return "";
  if (draft.text?.trim()) return draft.text;
  const goal = draft.goal?.trim() ?? "";
  const name = draft.name?.trim() ?? "";
  if (goal && name && !goal.toLowerCase().includes(name.toLowerCase())) return `${name}. ${goal}`;
  return goal || name;
}

/** A card with buttons, or a question: it comes into view with its buttons above the composer (DTSK-3). */
const acts = (m: FumeMessage) => m.author.kind !== "person" && Boolean(m.card) && m.card?.kind !== "handover";
/** The campaign a card speaks of, for a message said where no campaign is named. */
const cardCampaign = (m: FumeMessage): Id | undefined => (m.card && "campaignId" in m.card ? m.card.campaignId : undefined);
/** A campaign whose brief is still being written: not sent yet. */
const briefOpen = (c: Campaign | undefined) => Boolean(c && c.stage === "brief" && (c.state === "draft" || c.state === "awaiting_input"));
/** A campaign the chat is still working on with her: its brief is being written, or its plan is not approved yet. */
const inFlight = (c: Campaign | undefined) => (c && (briefOpen(c) || c.stage === "plan") ? c : undefined);

/** Something open in the conversation that a reply answers: a brief being written, or Fume's question. */
interface Open {
  threadId: Id;
  campaignId: Id | null;
  /** When Fume last asked or showed the brief there. */
  at: string;
  /** What is open, for the reply menu: "A brief being written", "Fume asked which product it is for". */
  why: string;
}

export function FumePage() {
  const { threadId } = useParams<"threadId">();
  const [params, setParams] = useSearchParams();
  const starting = params.get("new") === "1";
  const navigation = useNavigationType();
  const session = useSession().data!;
  const workspaceId = session.workspace.id;
  const conversation = useConversation();
  const threads = useThreads();
  const campaigns = useCampaigns();
  const catalogue = useCatalogue();
  const team = useTeam();
  const people = directory(usePeople().data);
  const say = useSay();
  const answer = useSend();
  const start = useStartCampaign();
  const navigate = useNavigate();
  const docked = useNarrowScreen("(max-width: 1023px)");
  const phone = useNarrowScreen("(max-width: 639px)");
  const desk = !docked;
  // From 1280 the panel has room beside the conversation.
  const roomy = !useNarrowScreen("(max-width: 1279px)");
  // A mouse and a keyboard: the composer takes the focus (on a touch screen that would raise the keyboard).
  const fine = !useNarrowScreen("(pointer: coarse)");
  const scroller = useRef<MessageScrollerHandle>(null);
  const [text, setText] = useState("");
  const { picked, add, remove, clear } = usePicked();
  // From sending until Fume's answer arrives, Fume shows it is reading.
  const [waiting, setWaiting] = useState(false);
  // Fume's next message answers something she did (sent, answered, sent the brief): it comes into view from its top.
  const expecting = useRef(false);
  // Messages before this index sit behind "Earlier" while a new campaign is started (WAY-17).
  const [fold, setFold] = useState(0);
  // A card to bring into view once it is on the page (after unfolding, a jump, coming back).
  const [target, setTarget] = useState<{ id: string; offset?: number; smooth?: boolean; mark?: string } | null>(null);
  // The campaign the panel follows: started or sent here (kept for the visit, so Back from the plan keeps it).
  const [follow, setFollowState] = useState<Id | undefined>(() => read<Id>(FOLLOW(workspaceId)));
  const setFollow = (id: Id | undefined) => {
    setFollowState(id);
    keep(FOLLOW(workspaceId), id);
  };
  // Round 13 (#15): what she opened from the chat, shown in the panel; (#13) the panel hidden, per viewer.
  const [opened, setOpenedState] = useState<ChatLink | undefined>(() => read<ChatLink>(OPENED(workspaceId)));
  const setOpened = (link: ChatLink | undefined) => {
    setOpenedState(link);
    keep(OPENED(workspaceId), link);
  };
  const [hidden, setHiddenState] = useState(panelHidden);
  const setHidden = (h: boolean) => {
    setHiddenState(h);
    keepPanel(h);
  };
  // #20: /fume?plan=<campaignId> opens that plan in the panel; her words change it.
  const planParam = params.get("plan") ?? undefined;
  useEffect(() => {
    if (!planParam) return;
    setOpened({ kind: "plan", campaignId: planParam });
    setHidden(false);
  }, [planParam]); // eslint-disable-line react-hooks/exhaustive-deps
  const openFull = useOpenFullPage();
  // She chose where her reply goes; it holds while what is open stays the same.
  const [replyChoice, setReplyChoice] = useState<{ threadId: Id; over: Id | undefined } | null>(null);
  // A tapped answer: the composer takes the focus back once it is no longer busy (DTSK-20).
  const refocus = useRef(false);

  const staff = Boolean(session.user.staffRole);
  const owner = team.data?.members.find((m) => m.membership.role === "owner")?.user;
  const approverName = firstName(team.data?.members.find((m) => m.membership.role === "owner" || m.membership.role === "approver")?.user.name ?? "The approver");
  const blocked = cannotWrite(session.role, staff, owner);
  const canStart = session.role === "owner" || session.role === "approver" || session.role === "member";
  const canAct = session.role !== "viewer" && session.role !== null;

  // Which campaign each message speaks of: its thread's campaign, or the campaign its card names.
  const fumeThreads = useMemo(() => (threads.data ?? []).filter((t) => t.kind !== "contact"), [threads.data]);
  const threadCampaign = useMemo(() => new Map(fumeThreads.map((t) => [t.id, t.campaignId])), [fumeThreads]);
  const general = fumeThreads.find((t) => t.campaignId === null);
  const byId = useMemo(() => new Map((campaigns.data ?? []).map((c) => [c.id, c])), [campaigns.data]);
  const items = useMemo(() => conversation.data ?? [], [conversation.data]);
  const ready = Boolean(conversation.data && threads.data);
  const last = items[items.length - 1];

  // Where the talk turns (to a campaign, or back to no campaign), and each campaign's latest turn, message and plan.
  const layout = useMemo(() => {
    const about = new Map<Id, Id | null>();
    const turns = new Map<Id, Id | null>();
    const latest = new Map<Id, Id>();
    const latestTurn = new Map<Id, Id>();
    const latestPlan = new Map<Id, Id>();
    const lastSaid = new Map<Id, string>();
    // Round 13 (#19): her tick answer to Fume's product question ("Hand Balm") is not repeated as her bubble; the
    // question's card shows the product instead.
    const answers = new Map<Id, string>();
    const hidden = new Set<Id>();
    const lastIn = new Map<Id, FumeMessage>();
    const productNames = new Set((catalogue.data?.products ?? []).map((p) => p.name));
    let named: Id | null = null;
    items.forEach((m, i) => {
      const before = lastIn.get(m.threadId);
      lastIn.set(m.threadId, m);
      if (before?.author.kind === "fume" && before.card?.kind === "question" && before.card.productIds?.length && m.author.kind === "person" && !m.attachments?.length) {
        const names = m.text.split(", ").map((n) => n.trim());
        if (names.every((n) => productNames.has(n))) {
          answers.set(before.id, m.text);
          hidden.add(m.id);
        }
      }
      const id = threadCampaign.get(m.threadId) ?? cardCampaign(m) ?? null;
      about.set(m.id, id);
      if (id) {
        latest.set(id, m.id);
        lastSaid.set(id, m.at);
      }
      if (m.card?.kind === "plan") latestPlan.set(m.card.campaignId, m.id);
      if (id !== named) {
        // The very first message needs no marker when it is about no campaign.
        if (id || i > 0) turns.set(m.id, id);
        if (id) latestTurn.set(id, m.id);
        named = id;
      }
    });
    return { about, turns, latest, latestTurn, latestPlan, lastSaid, answers, hidden };
  }, [items, threadCampaign, catalogue.data]);

  // The campaigns talked about, latest first: "Jump to a campaign" (four at most).
  const talked = useMemo(
    () =>
      [...layout.lastSaid.entries()]
        .sort((a, b) => b[1].localeCompare(a[1]))
        .map(([id, at]) => ({ campaign: byId.get(id), at }))
        .filter((x): x is { campaign: Campaign; at: string } => Boolean(x.campaign))
        .slice(0, 4),
    [layout, byId],
  );

  // ── Where her reply goes ──
  // What is open, newest first: a brief being written, or Fume's question waiting for an answer.
  const open = useMemo<Open[]>(() => {
    const rows: Open[] = [];
    for (const t of fumeThreads) {
      const said = items.filter((m) => m.threadId === t.id);
      const newest = said[said.length - 1];
      const campaign = t.campaignId ? byId.get(t.campaignId) : undefined;
      const asking = newest?.author.kind === "fume" && newest.card?.kind === "question" ? newest.card.question : undefined;
      if (!briefOpen(campaign) && !asking) continue;
      const asked = [...said].reverse().find((m) => m.author.kind === "fume" && (m.card?.kind === "question" || m.card?.kind === "brief")) ?? newest;
      rows.push({ threadId: t.id, campaignId: t.campaignId, at: asked?.at ?? t.updatedAt, why: asking ? `Fume asked: ${asking}` : "A brief being written" });
    }
    return rows.sort((a, b) => b.at.localeCompare(a.at));
  }, [fumeThreads, items, byId]);
  // The address names a campaign she came to answer; else what Fume last asked; else the talk about no campaign.
  const addressedOpen = threadId && open.some((o) => o.threadId === threadId) ? threadId : undefined;
  // Round 10: the brief she just sent stays where her next words go while Fume writes its plan, so a line typed right
  // after "Send to Fume" is about that campaign, not about another brief still open.
  const followThread = follow && byId.get(follow)?.stage === "plan" ? fumeThreads.find((t) => t.campaignId === follow)?.id : undefined;
  const autoReply = addressedOpen ?? followThread ?? open[0]?.threadId ?? general?.id;
  const replyTo = replyChoice && replyChoice.over === autoReply ? replyChoice.threadId : autoReply;
  const replyCampaign = replyTo ? byId.get(threadCampaign.get(replyTo) ?? "") : undefined;

  // ── The panel (from 1280): the brief being written, or the plan of a brief she sent ──
  const addressed = threadId ? (threadCampaign.get(threadId) ?? undefined) : undefined;
  // She chose where her reply goes: that brief comes into the panel; else the campaign she started or sent here, the
  // one the address names, or the brief her reply answers.
  const chosen = replyChoice && replyChoice.over === autoReply && briefOpen(replyCampaign) ? replyCampaign : undefined;
  const focus = starting ? undefined : (chosen ?? inFlight(byId.get(follow ?? "")) ?? inFlight(byId.get(addressed ?? "")) ?? (briefOpen(replyCampaign) ? replyCampaign : undefined));
  const panel: "new" | "brief" | "plan" | "link" | null = !desk || !roomy ? null : starting ? "new" : opened ? "link" : !focus ? null : focus.stage === "plan" ? "plan" : "brief";
  // #13: the panel she hid stays hidden (the head's toggle shows it again); a thing she opens shows it.
  const shown = panel !== null && !hidden;
  // #15: a link opens in the panel on a desk with room for it, else on its own page (with the way back).
  const openLink = (link: ChatLink) => {
    if (desk && roomy) {
      setOpened(opened && linkKey(opened) === linkKey(link) ? opened : link);
      setHidden(false);
    } else openFull(link);
  };
  const closeLink = () => {
    setOpened(undefined);
    if (planParam) setParams({}, { replace: true });
  };
  // #20: the plan her words change: the one the address or the panel shows.
  const planFor = planParam ?? (opened?.kind === "plan" ? opened.campaignId : !opened && panel === "plan" ? focus?.id : undefined);
  const planNow = usePlan(planFor).data;
  const changePlan = useChangePlanWithFume();
  const briefView = useCampaign(panel === "brief" ? focus?.id : undefined).data;
  // The followed campaign's plan was approved (or it left the chat's hands): the panel stops following it.
  useEffect(() => {
    if (follow && campaigns.data && !inFlight(byId.get(follow))) setFollow(undefined);
  }, [follow, campaigns.data, byId]); // eslint-disable-line react-hooks/exhaustive-deps
  // The products she named that wait to be confirmed: the brief's Product line says so while Fume asks.
  const named = useMemo(() => {
    if (!focus) return [];
    const q = [...items].reverse().find((m) => layout.about.get(m.id) === focus.id && m.card?.kind === "question" && (m.card as ProductQuestionCard).named?.length);
    const ids = (q?.card as ProductQuestionCard | undefined)?.named ?? [];
    return (catalogue.data?.products ?? []).filter((p) => ids.includes(p.id) && !confirmed(p)).map((p) => p.name);
  }, [items, layout, focus, catalogue.data]);

  // A layer on its way out (the product panel after Confirm) gives focus back as it goes: the composer takes it after.
  const focusComposer = () => {
    if (!fine) return;
    const end = performance.now() + 2000;
    const go = () => {
      if (document.querySelector(CLOSING) && performance.now() < end) window.requestAnimationFrame(go);
      else window.setTimeout(() => document.getElementById(COMPOSER_ID)?.focus({ preventScroll: true }), 30);
    };
    go();
  };

  // ── Her words: kept for the visit; a new campaign's words shared with the manual brief ──
  useEffect(() => {
    setText(starting ? campaignWords() : (read<string>(chatDraft(workspaceId)) ?? ""));
  }, [starting, workspaceId]);
  const write = (words: string) => {
    setText(words);
    if (starting) keep(CAMPAIGN_DRAFT, words.trim() ? { text: words } : undefined);
    else keep(chatDraft(workspaceId), words.trim() ? words : undefined);
  };

  // ── Bringing a card into view, again while its pictures arrive, until she scrolls herself ──
  function settle(show: () => void) {
    const v = scroller.current?.viewport;
    let stopped = false;
    const stop = () => (stopped = true);
    const events = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
    events.forEach((e) => v?.addEventListener(e, stop, { passive: true }));
    show();
    const timers = [150, 500, 1000].map((ms) => window.setTimeout(() => !stopped && show(), ms));
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      events.forEach((e) => v?.removeEventListener(e, stop));
    };
  }
  const reveal = (id: string, options?: { offset?: number; smooth?: boolean; block?: "start" | "end" }) => {
    const el = document.getElementById(id);
    if (el) scroller.current?.reveal(el, options);
    return Boolean(el);
  };
  /** A message from its top (its campaign's marker over it), or, when it carries buttons and is too tall to show
   *  whole, from its buttons (DTSK-3). */
  const revealMessage = (m: FumeMessage, smooth?: boolean) => reveal(layout.turns.has(m.id) ? turnAnchor(m.id) : anchor(m.id), { smooth, block: acts(m) ? "end" : "start" });

  // A card asked for: unfold first if it sits in the earlier talk, then bring it into view once it is rendered (and
  // mark the message an address pointed at). Each ask is handled once; its settle timers live until the next ask.
  const handled = useRef<typeof target>(null);
  useEffect(() => {
    if (!target || handled.current === target) return;
    if (!document.getElementById(target.id) && fold > 0) {
      setFold(0);
      return;
    }
    handled.current = target;
    const marked = target.mark ? document.getElementById(target.mark) : null;
    const stop = settle(() => {
      reveal(target.id, { offset: target.offset, smooth: target.smooth });
      // From the campaign's marker when the message fits under it; else the message itself, its end in view.
      const port = scroller.current?.viewport?.getBoundingClientRect();
      if (marked && port && marked.getBoundingClientRect().bottom > port.bottom) reveal(marked.id, { block: "end" });
    });
    marked?.setAttribute("data-ui-target", "");
    const unmark = window.setTimeout(() => marked?.removeAttribute("data-ui-target"), MARKED_MS);
    return () => {
      stop();
      window.clearTimeout(unmark);
      marked?.removeAttribute("data-ui-target");
    };
  }, [target, fold]);  

  // Fume's answer to what she just did comes into view: its question, and its buttons above the composer.
  const newest = last;
  useEffect(() => {
    if (!newest || newest.author.kind === "person") return;
    setWaiting(false);
    if (!expecting.current) return;
    expecting.current = false;
    const timer = window.setTimeout(() => revealMessage(newest, true), 350);
    return () => window.clearTimeout(timer);
  }, [newest]); // eslint-disable-line react-hooks/exhaustive-deps

  // Opening the chat. A new campaign: the composer, on its marker, the earlier talk folded. An address that names a
  // campaign (the bell, Home): that campaign's latest message, marked. Back from a card: where she was. Otherwise the
  // newest item, from its top, its buttons above the composer. On a desk the composer has the focus (DLAY-4).
  const addressedLatest = addressed ? layout.latest.get(addressed) : undefined;
  useEffect(() => {
    if (!ready) return;
    if (starting) {
      setFold(items.length);
      return settle(() => {
        scroller.current?.scrollToEnd(false);
        document.getElementById(COMPOSER_ID)?.focus({ preventScroll: true });
      });
    }
    // The shell moves focus to the page on a new address; the chat's place for it is the composer, once that is done.
    const focusTimer = desk ? window.setTimeout(focusComposer, 60) : 0;
    const done = () => window.clearTimeout(focusTimer);
    const place = read<{ workspaceId: Id; id: string; offset: number }>(PLACE);
    if (navigation === "POP" && place?.workspaceId === workspaceId && document.getElementById(place.id)) {
      setTarget({ id: place.id, offset: place.offset });
      return done;
    }
    if (addressedLatest && addressed) {
      const turn = layout.latestTurn.get(addressed);
      setTarget({ id: turn ? turnAnchor(turn) : anchor(addressedLatest), mark: anchor(addressedLatest) });
      return done;
    }
    if (last && last.author.kind !== "person") {
      const stop = settle(() => revealMessage(last));
      return () => {
        stop();
        done();
      };
    }
    return done;
  }, [ready, starting, addressedLatest]); // eslint-disable-line react-hooks/exhaustive-deps

  // Her place, kept as she scrolls: the first card at the top of the conversation and how far it sits from the top.
  useEffect(() => {
    const v = scroller.current?.viewport;
    if (!ready || !v) return;
    let frame = 0;
    const save = () => {
      frame = 0;
      const top = v.getBoundingClientRect().top;
      const cards = v.querySelectorAll<HTMLElement>("[id^='fume-m-'], [id^='fume-turn-']");
      const first = [...cards].find((el) => el.getBoundingClientRect().bottom > top);
      if (!first) return;
      const margin = parseFloat(getComputedStyle(first).scrollMarginTop) || 0;
      keep(PLACE, { workspaceId, id: first.id, offset: first.getBoundingClientRect().top - top - margin });
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(save);
    };
    v.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      v.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [ready, workspaceId]);

  const jump = (campaignId: Id) => {
    const turn = layout.latestTurn.get(campaignId);
    if (turn) setTarget({ id: turnAnchor(turn), smooth: true });
  };

  // What she did is on its way: her own message shows at the end, and Fume's answer is revealed from its top.
  const sent = (words = true) => {
    if (words) {
      write("");
      clear();
    }
    expecting.current = true;
    setWaiting(true);
    scroller.current?.scrollToEnd(true);
  };

  /** A new campaign from her words: the panel follows it (an existing one with the same occasion is asked about first,
   *  in the talk about no campaign). */
  const startFrom = (words: string) =>
    start.mutate(
      { text: words },
      {
        onSuccess: (started) => {
          sent();
          keep(CAMPAIGN_DRAFT, undefined);
          if (started.threadId !== general?.id) setFollow(started.campaign.id);
          setReplyChoice(null);
          setOpened(undefined);
          setParams({}, { replace: true });
        },
      },
    );

  const submit = (words: string) => {
    // #20: words that change the plan the panel shows go to the plan (a question still goes to the talk).
    if (!starting && planFor && !ASKS(words) && !picked.length && (planParam || opened?.kind === "plan" ? true : planNow?.state === "ready" && PLAN_WORDS.test(words))) {
      changePlan.mutate({ campaignId: planFor, text: words }, { onSuccess: () => sent() });
      return;
    }
    // #17: "Make a Christmas campaign for Hand Balm" starts it, as New campaign does; not while she answers a brief.
    const namesOne = (campaigns.data ?? []).some((c) => words.toLowerCase().includes(c.name.toLowerCase()));
    if (!starting && canStart && !picked.length && NEW_CAMPAIGN.test(words.trim()) && !/\?\s*$/.test(words.trim()) && !namesOne) {
      startFrom(words);
      return;
    }
    if (starting) {
      startFrom(words);
      return;
    }
    const attachments = picked.map((a) => ({ name: a.name, bytes: a.bytes }));
    if (replyTo) answer.mutate({ threadId: replyTo, text: words, attachments }, { onSuccess: () => sent() });
    else say.mutate({ text: words, attachments }, { onSuccess: () => sent() });
  };
  // A question card is answered where it was asked, so the answer reaches that campaign's brief; her draft stays, and
  // the focus goes back to the composer (DTSK-20).
  const reply = (m: FumeMessage, words: string) => {
    refocus.current = true;
    answer.mutate({ threadId: m.threadId, text: words }, { onSuccess: () => sent(false) });
  };
  const pending = say.isPending || start.isPending || answer.isPending || changePlan.isPending;
  const failed = say.error || start.error || answer.error || changePlan.error;
  // The composer is disabled while her answer goes out (a disabled field cannot hold the focus): it takes it after.
  useEffect(() => {
    if (pending || !refocus.current) return;
    refocus.current = false;
    const timer = window.setTimeout(focusComposer, 0);
    return () => window.clearTimeout(timer);
  }, [pending]); // eslint-disable-line react-hooks/exhaustive-deps

  const cancel = () => {
    keep(CAMPAIGN_DRAFT, undefined);
    setParams({}, { replace: true });
  };

  const nameOf = (campaignId: Id | null | undefined) => (campaignId ? (byId.get(campaignId)?.name ?? fumeThreads.find((t) => t.campaignId === campaignId)?.title ?? "A campaign") : NO_CAMPAIGN);

  const conversationView = (
    <Query query={conversation} loading="Opening the conversation">
      {() => (
        <MessageScroller
          ref={scroller}
          label="Your conversation with Fume"
          announcement={last ? `${last.author.kind === "person" && last.author.userId === session.user.id ? "You" : people.author(last.author)}: ${last.text}` : undefined}
        >
          <AiLine />
          {items.length === 0 && !starting && <MessageText>Nothing here yet. Tell Fume what you need.</MessageText>}
          {fold > 0 && items.length > 0 && (
            <Marker variant="separator">
              <Button
                variant="quiet"
                size="sm"
                icon="arrow-up"
                onClick={() => {
                  const first = items[fold];
                  setFold(0);
                  if (first) setTarget({ id: anchor(first.id), offset: 0 });
                }}
              >
                Earlier in the conversation
              </Button>
            </Marker>
          )}
          {items.map((m, i) => {
            if (i < fold) return null;
            const prev = items[i - 1];
            const day = dayLabel(m.at);
            const newDay = !prev || dayLabel(prev.at) !== day;
            const campaignId = layout.about.get(m.id) ?? null;
            // The campaign is named once where the talk turns to it, and again at the top of what is shown.
            const turned = layout.turns.has(m.id) || (i === fold && i > 0 && campaignId !== null);
            const latest = i === items.length - 1;
            const showTime = !prev || newDay || i === fold || Date.parse(m.at) - Date.parse(prev.at) > BURST;
            return (
              <Fragment key={m.id}>
                {(newDay || (i === fold && i > 0)) && <DayMarker label={day} />}
                {turned &&
                  (campaignId ? (
                    <Marker icon="megaphone" id={turnAnchor(m.id)} className="ui-chat-turn">
                      {/* #15: the campaign opens beside the conversation (on a phone, its page with the way back) */}
                      <Link
                        to={`/campaigns/${campaignId}`}
                        onClick={(e) => {
                          e.preventDefault();
                          openLink({ kind: "campaign", campaignId });
                        }}
                      >
                        {nameOf(campaignId)}
                      </Link>
                    </Marker>
                  ) : (
                    <Marker icon="message-square" id={turnAnchor(m.id)} className="ui-chat-turn">
                      {NO_CAMPAIGN}
                    </Marker>
                  ))}
                {!layout.hidden.has(m.id) && <Line
                  message={m}
                  campaignId={campaignId}
                  people={people}
                  meId={session.user.id}
                  canAct={canAct}
                  anchorId={anchor(m.id)}
                  showTime={showTime}
                  briefInPanel={panel === "brief" && Boolean(campaignId) && campaignId === focus?.id}
                  planInPanel={panel === "plan" && m.card?.kind === "plan" && m.card.campaignId === focus?.id}
                  latestPlan={m.card?.kind !== "plan" || layout.latestPlan.get(m.card.campaignId) === m.id}
                  onSend={() => {
                    if (campaignId) setFollow(campaignId);
                    expecting.current = true;
                    focusComposer();
                  }}
                  onAnswer={latest && !blocked && !pending ? (words) => reply(m, words) : undefined}
                  answeredWith={layout.answers.get(m.id)}
                />}
              </Fragment>
            );
          })}
          {starting && <Marker icon="plus">A new campaign</Marker>}
          {starting && (
            <Message>
              <MessageHeader author="fume" />
              <MessageContent>
                <MessageText>
                  <p>Tell us what the new campaign is for: the product, who it should reach and where it will run.</p>
                  <p>We ask a few questions, one at a time, and write the brief with you. Once you send it, we write the plan; nothing is made before you approve the plan.</p>
                </MessageText>
              </MessageContent>
            </Message>
          )}
          {waiting && (
            <Message state="thinking">
              <MessageHeader author="fume" />
              <MessageContent>
                <MessageStatus>Fume is reading your message</MessageStatus>
              </MessageContent>
            </Message>
          )}
        </MessageScroller>
      )}
    </Query>
  );

  // When more than one thing is open (the brief she just sent counts), the line over the composer says where her reply
  // goes, with Change.
  const sentRow = followThread && !open.some((o) => o.threadId === followThread) ? [{ threadId: followThread, campaignId: follow, at: "", why: "The brief you just sent" }] : [];
  const choices = [...sentRow, ...open];
  const replyLine = !starting && choices.length > 1 && replyTo && (
    <div className="ui-chat-to">
      <p className="ui-chat-to-text">
        Your reply is about <span className="ui-chat-to-name">{replyCampaign ? replyCampaign.name : NO_CAMPAIGN.toLowerCase()}</span>
      </p>
      <OptionMenu
        title="What is your reply about?"
        align="start"
        options={[
          ...choices.map((o) => ({
            id: o.threadId,
            icon: (o.campaignId ? "megaphone" : "message-square") as "megaphone" | "message-square",
            label: nameOf(o.campaignId),
            description: o.why,
            onSelect: () => {
              setReplyChoice({ threadId: o.threadId, over: autoReply });
              focusComposer();
            },
          })),
          ...(general && !choices.some((o) => o.threadId === general.id)
            ? [{ id: general.id, icon: "message-square" as const, label: NO_CAMPAIGN, description: "Something else for Fume", onSelect: () => (setReplyChoice({ threadId: general.id, over: autoReply }), focusComposer()) }]
            : []),
        ]}
      >
        <Button variant="quiet" size="sm" aria-label="Change what your reply is about">
          Change
        </Button>
      </OptionMenu>
    </div>
  );

  // #16: "@" names something for Fume; an empty composer offers a few questions.
  const mentions = useMentions({ inputId: COMPOSER_ID, text, onText: write, disabled: Boolean(blocked) || pending || starting });
  // Not while Fume's own question waits for one of its answers (its buttons are the answer then).
  const asking = !starting && !blocked && !pending && !text.trim() && !planFor && !(last && last.author.kind === "fume" && last.card?.kind === "question");
  const askAbout = talked[0]?.campaign.name ?? (campaigns.data ?? []).find((c) => !["delivered", "closed"].includes(c.state))?.name;

  const foot = (
    <div className="ui-chat-foot">
      {mentions.list}
      {asking && <AskSuggestions campaign={askAbout} onAsk={(words) => submit(words)} />}
      {starting && (
        <div className="ui-chat-chips">
          <Button variant="quiet" size="sm" icon="x" onClick={cancel}>
            Cancel
          </Button>
          {/* Her words go with her: the form reads them from the shared draft (TASK-9). */}
          <Button variant="quiet" size="sm" icon="file-text" onClick={() => navigate("/campaigns/new")}>
            Write it yourself instead
          </Button>
        </div>
      )}
      {replyLine}
      <Composer
        value={text}
        onValueChange={write}
        onSubmit={({ text: words }) => submit(words)}
        disabled={Boolean(blocked) || pending || (starting && !canStart)}
        placeholder={
          blocked ??
          (starting
            ? "Tell Fume what the campaign is for"
            : planFor && (planParam || opened?.kind === "plan" || planNow?.state === "ready")
              ? "Tell Fume what to change: how many creatives, videos or carousels, the dates"
              : replyCampaign && !phone
                ? `${open.some((o) => o.threadId === replyTo) ? "Answer" : "Write to"} Fume about ${replyCampaign.name}`
                : "Write to Fume, or @ to name a campaign or product")
        }
        label={starting ? "Start a campaign with Fume" : "Write to Fume"}
        inputLabel={starting ? "What the campaign is for" : replyCampaign ? `Message to Fume about ${replyCampaign.name}` : "Message to Fume"}
        inputId={COMPOSER_ID}
        // "Send to Fume" is the brief's button (round 10); the composer sends a message, so it says only that.
        sendLabel={starting ? "Start the campaign" : "Send the message"}
        attachments={picked}
        onRemoveAttachment={remove}
        onAttach={blocked || starting ? undefined : (files) => add(files)}
        onMention={blocked || starting ? undefined : () => undefined}
        mentionLabel="Name a campaign, product or creative"
        error={failed ? "Fume didn’t get that. Your message is still here; send it again." : undefined}
        hint={!phone}
        inline={phone}
        sticky={docked}
      />
    </div>
  );

  const jumpMenu = talked.length > 0 && (
    <OptionMenu
      title="Jump to a campaign"
      options={talked.map(({ campaign, at }) => ({
        id: campaign.id,
        icon: "megaphone",
        label: campaign.name,
        description: `Last talked about ${when(at)}`,
        onSelect: () => jump(campaign.id),
      }))}
    >
      {desk ? (
        <Button variant="quiet" size="sm" icon="list">
          Jump to a campaign
        </Button>
      ) : (
        <Button variant="secondary" icon="list" iconOnly={phone} aria-label={phone ? "Jump to a campaign" : undefined}>
          {phone ? undefined : "Jump to a campaign"}
        </Button>
      )}
    </OptionMenu>
  );

  if (desk)
    return (
      <Page title="Fume" docTitle="Fume chat" width="fill">
        <ChatLinkProvider open={openLink}>
        <div className="ui-app-page ui-chat-page" data-desk="" data-panel={shown ? "" : undefined}>
          <div className="ui-chat">
            <ChatHead>
              {!starting && jumpMenu}
              {/* Quiet here: the composer's Send is the chat's one primary action (DTSK-21). */}
              {canStart && !starting && (
                <Button variant="quiet" size="sm" icon="plus" onClick={() => navigate("/fume?new=1")}>
                  New campaign
                </Button>
              )}
              {/* #13: the panel hides and shows, like Claude's artifact panel; the choice is kept on this device. */}
              {panel && (
                <Button
                  variant="quiet"
                  size="sm"
                  icon="panel-left"
                  iconOnly
                  className="ui-chat-panel-toggle"
                  aria-pressed={shown}
                  aria-label={shown ? "Hide the panel" : "Show the panel"}
                  title={shown ? "Hide the panel" : "Show the panel"}
                  onClick={() => setHidden(shown)}
                />
              )}
            </ChatHead>
            {conversationView}
            {foot}
          </div>
          {shown && panel === "link" && opened && <LinkPanel key={linkKey(opened)} link={opened} onClose={closeLink} />}
          {shown && (panel === "new" || panel === "brief") && (
            <BriefPanel
              key={panel === "new" ? "new" : focus?.id}
              view={panel === "new" ? undefined : briefView}
              named={named}
              canAct={canAct && !blocked}
              approver={approverName}
              onSending={() => {
                if (focus) setFollow(focus.id);
                expecting.current = true;
              }}
              onSent={focusComposer}
            />
          )}
          {shown && panel === "plan" && focus && <PlanPanel key={focus.id} campaignId={focus.id} />}
        </div>
        </ChatLinkProvider>
      </Page>
    );

  return (
    <Page title="Fume" width="fill">
      <ChatLinkProvider open={openLink}>
      {/* The fill page has no padding of its own; the header and the conversation take the page frame's. */}
      <div className="ui-app-page ui-chat-page">
        <PageHeader
          title="Fume"
          actions={
            !starting && (talked.length > 0 || canStart) ? (
              <>
                {jumpMenu}
                {/* Secondary here: the composer's Send is the chat's one primary action (DTSK-21). */}
                {canStart && <StartCampaign quiet />}
              </>
            ) : undefined
          }
        />
        <div className="ui-chat">
          {conversationView}
          {foot}
        </div>
      </div>
      </ChatLinkProvider>
    </Page>
  );
}

/** One message, with the campaign its cards speak of. The Engine's messages are run cards only (F-D040). */
function Line({
  message,
  campaignId,
  ...rest
}: {
  message: FumeMessage;
  campaignId: Id | null;
  people: ReturnType<typeof directory>;
  meId: string;
  canAct: boolean;
  anchorId: string;
  showTime: boolean;
  briefInPanel?: boolean;
  planInPanel?: boolean;
  latestPlan?: boolean;
  onSend: () => void;
  onAnswer?: (answer: string) => void;
  answeredWith?: string;
}) {
  const view = useCampaign(message.card && campaignId ? campaignId : undefined);
  return <MessageView message={message} view={view.data} {...rest} />;
}

/** "today, 14:02", "yesterday, 09:10", "on 12 Oct, 16:40". */
function when(at: string): string {
  const day = dayLabel(at);
  return `${day === "Today" || day === "Yesterday" ? day.toLowerCase() : `on ${day}`}, ${time(at)}`;
}

/** The quiet line at the top of the conversation: Fume is AI and says so (FLOWS §1.1; AI Act art. 50, F-D041; exact
 *  wording to counsel), and a person is brought in here when one is needed (FLOWS §21). Round 9 (DLOAD-11): one voice
 *  in the sentence, Fume's, in the third person. */
function AiLine() {
  return (
    <Marker icon="info">
      <span>Fume is AI. When something needs a person, Fume brings one in here, and remembers everything you tell it.</span>
    </Marker>
  );
}

/** What the composer holds before it is sent: the attachments picked so far. */
interface Picked extends ComposerAttachment {
  bytes: number;
}

function usePicked() {
  const [picked, setPicked] = useState<Picked[]>([]);
  const add = (files: File[]) =>
    setPicked((list) => [
      ...list,
      ...files.map((f, i) => ({
        id: `${Date.now()}-${i}-${f.name}`,
        name: f.name,
        bytes: f.size,
        meta: attachmentMeta(f.name, f.size),
        media: f.type.startsWith("image/") ? { kind: "image" as const, src: URL.createObjectURL(f), alt: f.name } : { kind: "icon" as const },
      })),
    ]);
  const remove = (id: string) => setPicked((list) => list.filter((a) => a.id !== id));
  return { picked, add, remove, clear: () => setPicked([]) };
}
