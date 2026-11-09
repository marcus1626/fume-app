// The Engine panel (Round 15, PROPOSED 9 Nov 2026): one Engine for the whole app, in a panel on the right. Marcus, 9 Nov,
// on seeing a bar and a conversation at once in the video editor: "Either or. Ideally the right side should be a panel
// that can be opened and closed for the whole app, tied to the main Engine chat. With a choice of a global session or
// a project session, so the thread continues the next time we come back to it."
// - It opens and closes from the Engine button at the end of the staff bar and the Studio's bar, or ⌘J, and stays open
//   from page to page until it is closed (remembered per person on this computer, panel.ts).
// - It is the Engine chat (EngineChatPage.tsx), not a second one: the same threads, messages and widgets; the Engine
//   page is its full-screen view (the expand button).
// - Threads: Everything (the brand) and one per project, a campaign or a Studio document. On a project's page its
//   thread opens; the name at the top is a quiet switch to the others. A thread keeps its history, so coming back
//   continues it. A document's thread holds what the Studio's Engine bar and the video's conversation held: what she
//   asked, and the change shown before it is kept (Undo, Keep and render), changes.tsx.
// - The line under the top says what the Engine sees right now: the project, the picked version, the playhead, and the
//   field she asked about ("Ask about this"), each a chip she can take off.
// Only Fume's people and an agency's designers have it; a customer never does (they talk to Fume). The look is
// engine-panel.css: a Porcelain sheet on the layer behind, beside the page, as the page lies beside the sidebar.
import {
  Button,
  Composer,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  Icon,
  Marker,
  Message,
  MessageContent,
  MessageHeader,
  MessageScroller,
  MessageStatus,
  MessageText,
  useToast,
  type IconName,
  type MessageScrollerHandle,
} from "@fume/ui";
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  useAnswerEngineWidget,
  useDocument,
  useDocuments,
  useEngineChat,
  useEngineEdit,
  useEngineSay,
  useEngineThreads,
  usePeople,
  useSession,
  useStudioCampaigns,
} from "../../api/hooks";
import type {
  CreativeDocument,
  EngineEdit,
  EngineMessage,
  EngineThread,
  EngineTopic,
  Id,
  VideoEngineEdit,
} from "../../contract";
import * as copy from "../../copy";
import { addressBrand, frameRoot, useFrameKind } from "../../shell/scope";
import { directory } from "../../shell/people";
import { DayMarker, dayLabel } from "../fume/parts";
import { DocumentTurns, docStarts } from "./changes";
import { Line } from "./messages";
import { useSeesEngine } from "./field";
import {
  earlierChats,
  enginePanel,
  threadKey,
  topicOf,
  useEngineSees,
  useEngineSight,
  useEngineState,
  useSessionSplit,
  type EarlierChat,
  type EngineDesk,
  type EngineSeen,
  type EngineSight,
} from "./panel";

const COMPOSER_ID = "engine-panel-composer";

/** A document's one name, as the Studio's bar says it: "Master 3 · Feed 4:5", "Night ritual · Reels 9:16". */
export function docTitle(doc: Pick<CreativeDocument, "title" | "slot" | "studio" | "video" | "specs">): string {
  const own = doc.title || doc.slot || "";
  const cut = doc.studio === "video" ? doc.video?.formats.find((f) => f.id === doc.video?.formatId) : undefined;
  if (cut) return `${own.split(" · ")[0] || "Film"} · ${cut.name.split(" ")[0]} ${cut.ratio}`;
  return copy.creativeName({ title: own, format: doc.specs.format });
}

/** The Engine button at the end of a bar: opens and closes the panel (⌘J). On the desk, a change that waits for her
 *  while the panel is closed says so on the button. `labelled` (round 16, the staff frame's bar): while the panel is
 *  closed it says "Tell the Engine", so the Engine is in sight without opening it. */
export function EngineToggle({ labelled = false }: { labelled?: boolean }) {
  const open = useEngineState((s) => s.open);
  const desk = useEngineSees().desk;
  const waiting = desk
    ? (desk.doc.video ? desk.doc.video.edits : desk.doc.edits).filter((e) => e.state === "proposed").length
    : 0;
  const onEnginePage = /\/engine\/?$/.test(useLocation().pathname);
  const sees = useSeesEngine();
  if (!sees || onEnginePage) return null;
  if (waiting && !open)
    return (
      <Button size="sm" variant="secondary" icon="fume-engine" onClick={() => enginePanel.setOpen(true)}>
        {waiting === 1 ? "A change waits" : `${waiting} changes wait`}
      </Button>
    );
  if (labelled && !open)
    return (
      <Button
        variant="secondary"
        size="sm"
        icon="fume-engine"
        className="ui-engine-toggle ui-engine-toggle--labelled"
        aria-expanded={false}
        aria-controls="engine-panel"
        shortcut="⌘J"
        onClick={() => enginePanel.setOpen(true)}
      >
        Tell the Engine
      </Button>
    );
  return (
    <Button
      variant="quiet"
      iconOnly
      icon="fume-engine"
      className="ui-engine-toggle"
      aria-label={open ? "Close the Engine" : "Open the Engine"}
      aria-expanded={open}
      aria-controls="engine-panel"
      data-open={open ? "" : undefined}
      shortcut="⌘J"
      onClick={() => enginePanel.toggle()}
    />
  );
}

/** ⌘J (Ctrl+J off a Mac) opens and closes the panel, from anywhere but a field she writes in with a menu open. */
function useHotkey() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== "j") return;
      e.preventDefault();
      enginePanel.toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** What a page of the staff frame shows the Engine, from its address: the brand, the campaign (its thread opens
 *  first) and the part of it she is on. */
const PAGE_SEEN: [RegExp, EngineSeen][] = [
  [/^\/campaigns\/[^/]+\/plan$/, { id: "page", icon: "file-text", words: "The plan" }],
  [/^\/review\/[^/]+$/, { id: "page", icon: "eye", words: "Its creatives in review" }],
  [/^\/brand\/(voice|tone)/, { id: "page", icon: "file-text", words: "Tone of Voice" }],
  [/^\/brand\/design/, { id: "page", icon: "file-text", words: "Design book" }],
  [/^\/(qa|check)$/, { id: "page", icon: "fume-check", words: "What waits in Check" }],
];

/** The Engine in the staff frame: its button for the bar's end and the panel beside the page, and what the page shows
 *  it. Nothing for someone who does not work with the Engine. */
export function useEngineFrame(): { barEnd: ReactNode; aside: ReactNode } {
  const sees = useSeesEngine();
  const { pathname } = useLocation();
  const campaigns = useStudioCampaigns().data;
  const brand = addressBrand(pathname);
  const campaignId = brand ? /^\/(?:campaigns|review)\/([^/?#]+)/.exec(brand.rest)?.[1] : undefined;
  const id = campaignId && campaignId !== "new" ? campaignId : undefined;
  const title = id ? campaigns?.find((r) => r.campaign.id === id)?.campaign.name : undefined;
  const page = brand ? PAGE_SEEN.find(([re]) => re.test(brand.rest))?.[1] : undefined;
  const workspaceId = brand?.workspaceId;
  const sight = useMemo<EngineSight | undefined>(
    () =>
      sees && workspaceId
        ? {
            workspaceId,
            topic: id ? { kind: "campaign", id } : undefined,
            title,
            seen: page ? [page] : undefined,
          }
        : undefined,
    [sees, workspaceId, id, title, page],
  );
  useEngineSight(sight);
  if (!sees) return { barEnd: null, aside: null };
  return { barEnd: <EngineToggle labelled />, aside: <EnginePanel /> };
}

/** The Studio's desk with the panel beside it: the desk is a full-screen page of its own, outside the frame. */
export function EngineDock({ children }: { children: ReactNode }) {
  const sees = useSeesEngine();
  const open = useEngineState((s) => s.open);
  if (!sees) return <>{children}</>;
  return (
    <div className="ui-engine-dock" data-open={open ? "" : undefined}>
      {children}
      <EnginePanel />
    </div>
  );
}

/** The panel, where the frame or the desk puts it. Nothing while it is closed, on the Engine page itself (its
 *  full-screen view) and for anyone who does not work with the Engine. */
export function EnginePanel() {
  const sees = useSeesEngine();
  return sees ? <PanelHost /> : null;
}

function PanelHost() {
  const open = useEngineState((s) => s.open);
  const { pathname } = useLocation();
  useHotkey();
  // A new page: the field she asked about belonged to the last one
  const first = useRef(true);
  useEffect(() => {
    if (first.current) first.current = false;
    else enginePanel.leftPage();
  }, [pathname]);
  if (!open || /\/engine\/?$/.test(pathname)) return null;
  return <Panel />;
}

export interface ThreadRow {
  key: string;
  title: string;
  icon: IconName;
  meta?: string;
}

const iconOf = (t?: EngineTopic): IconName => (!t ? "folder" : t.kind === "campaign" ? "megaphone" : "layers");

/** The brand's threads with the Engine, for the switch: Everything, the page's own project (with or without a history
 *  yet), then every other thread, latest first. A thread no row names (an old address) still gets its name. */
export function useThreadRows(workspaceId: Id, page?: { topic?: EngineTopic; title?: string }) {
  const session = useSession().data!;
  const brandName = session.workspaces.find((w) => w.id === workspaceId)?.brandName ?? "the brand";
  const threads = useEngineThreads(workspaceId).data;
  const documents = useDocuments(workspaceId).data;
  const campaigns = useStudioCampaigns().data;
  const pageKey = page?.topic ? threadKey(page.topic) : undefined;
  const pageTitle = page?.title;
  return useMemo<ThreadRow[]>(() => {
    const pageTopic = pageKey ? topicOf(pageKey) : undefined;
    const docName = (id: Id) => {
      const doc = documents?.find((d) => d.id === id);
      return doc ? docTitle(doc) : undefined;
    };
    const campaignName = (id: Id) => campaigns?.find((c) => c.campaign.id === id)?.campaign.name;
    const name = (t: EngineThread) =>
      (t.topic?.kind === "document" ? docName(t.topic.id) : t.topic ? campaignName(t.topic.id) : undefined) ?? t.title;
    const list: ThreadRow[] = [{ key: "brand", title: "Everything", icon: "folder", meta: brandName }];
    if (pageTopic)
      list.push({
        key: threadKey(pageTopic),
        title:
          pageTitle ??
          (pageTopic.kind === "document" ? docName(pageTopic.id) : campaignName(pageTopic.id)) ??
          "This project",
        icon: iconOf(pageTopic),
        meta: pageTitle ? "This page" : undefined,
      });
    for (const t of threads ?? []) {
      const key = threadKey(t.topic);
      if (list.some((r) => r.key === key)) continue;
      list.push({ key, title: name(t), icon: iconOf(t.topic), meta: copy.count(Math.ceil(t.count / 2), "turn") });
    }
    return list;
  }, [threads, documents, campaigns, pageKey, pageTitle, brandName]);
}

/** The thread's name at the top, a quiet switch to the brand's other threads. */
export function ThreadSwitch({
  rows,
  current,
  title,
  brandName,
  onChoose,
}: {
  rows: ThreadRow[];
  current: string;
  title: string;
  brandName: string;
  onChoose: (key: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="ui-engine-thread" aria-label={`Thread: ${title}. Switch thread`}>
          <span className="ui-engine-thread-name">{title}</span>
          <Icon name="chevron-down" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="ui-engine-threads">
        <DropdownMenuLabel>{`${brandName}’s threads with the Engine`}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={current} onValueChange={onChoose}>
          {rows.map((r) => (
            <DropdownMenuRadioItem key={r.key} value={r.key} icon={r.icon}>
              <span className="ui-engine-thread-row">
                <span>{r.title}</span>
                {r.meta && <span className="ui-engine-thread-meta">{r.meta}</span>}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Panel() {
  const session = useSession().data!;
  const frame = useFrameKind();
  const sees = useEngineSees();
  const workspaceId = sees.workspaceId ?? session.workspace.id;
  const brandName = session.workspaces.find((w) => w.id === workspaceId)?.brandName ?? "the brand";
  const pageThread = threadKey(sees.topic);
  const chosen = useEngineState((s) => s.chosen);
  const current = chosen && chosen.on === pageThread ? chosen.thread : pageThread;
  const topic = topicOf(current);
  const rows = useThreadRows(workspaceId, sees);
  const row = rows.find((r) => r.key === current) ?? { key: current, title: topic ? "This thread" : "Everything" };

  // What the Engine sees now, as chips: the thread's project, the page's facts, the field she asked about
  const asked = useEngineState((s) => s.asked);
  const [off, setOff] = useState<string[]>([]);
  useEffect(() => setOff([]), [pageThread]);
  const onPage = current === pageThread;
  // The thread's own project is its title; Everything sees the brand
  const chips: (EngineSeen & { removable?: boolean })[] = [
    ...(!topic ? [{ id: "brand", icon: "folder" as IconName, words: brandName }] : []),
    ...(onPage ? sees.seen.map((s) => ({ ...s, removable: true })) : []),
    // The field she asked about belongs to this page's thread; another thread does not see it
    ...(asked && onPage
      ? [
          {
            id: "field",
            icon: "pencil" as IconName,
            words: `${asked.field.label} · ${asked.where}`,
            removable: true,
          },
        ]
      : []),
  ].filter((c) => !off.includes(c.id));
  // Round 16: earlier chats in this thread, from before this web session; the Engine remembers them
  const [earlier, setEarlier] = useState(0);
  if (earlier && !off.includes("memory"))
    chips.push({
      id: "memory",
      icon: "clock",
      words: earlier === 1 ? "Your earlier chat" : `Your ${earlier} earlier chats`,
      removable: true,
    });
  const takeOff = (id: string) => (id === "field" ? enginePanel.dropField() : setOff((o) => [...o, id]));
  const page = onPage && !off.includes("page") ? sees.seen.find((s) => s.id === "page")?.words : undefined;

  const full = `${frameRoot[frame]}/b/${workspaceId}/engine${current === "brand" ? "" : `?thread=${current}`}`;

  return (
    <aside id="engine-panel" className="ui-engine-panel" aria-label="Engine">
      <header className="ui-engine-panel-head">
        <Icon name="fume-engine" className="ui-engine-panel-mark" />
        <ThreadSwitch
          rows={rows}
          current={current}
          title={row.title}
          brandName={brandName}
          onChoose={(v) => enginePanel.choose(pageThread, v)}
        />
        <span className="ui-engine-panel-actions">
          <Button asChild variant="quiet" size="sm" iconOnly icon="maximize-2" aria-label="Open the Engine full screen">
            <Link to={full} />
          </Button>
          <Button
            variant="quiet"
            size="sm"
            iconOnly
            icon="x"
            aria-label="Close the Engine"
            shortcut="⌘J"
            onClick={() => enginePanel.setOpen(false)}
          />
        </span>
      </header>
      {chips.length > 0 && (
        <div className="ui-engine-sees">
          <span className="ui-engine-sees-label">Sees</span>
          <ul className="ui-engine-sees-list" aria-label="What the Engine sees">
            {chips.map((c) => (
              <li key={c.id} className="ui-badge ui-badge--secondary ui-engine-sees-chip">
                <Icon name={c.icon} />
                <span className="ui-engine-sees-words">{c.words}</span>
                {c.removable && (
                  <button
                    type="button"
                    className="ui-engine-sees-x"
                    aria-label={`Leave out: ${c.words}`}
                    onClick={() => takeOff(c.id)}
                  >
                    <Icon name="x" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {topic?.kind === "document" ? (
        <DocumentThread
          key={current}
          documentId={topic.id}
          thread={current}
          desk={sees.desk?.doc.id === topic.id ? sees.desk : undefined}
          onEarlier={setEarlier}
        />
      ) : (
        <ChatThread
          key={current}
          workspaceId={workspaceId}
          topic={topic}
          thread={current}
          title={row.title}
          brandName={brandName}
          field={asked && onPage && !off.includes("field") ? asked.field : undefined}
          page={page}
          onEarlier={setEarlier}
        />
      )}
    </aside>
  );
}

/** The composer's focus: when the panel opens, on "Ask about this", after a send. Never on a touch screen. */
function useComposerFocus() {
  const focus = useEngineState((s) => s.focus);
  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    const timer = window.setTimeout(() => document.getElementById(COMPOSER_ID)?.focus({ preventScroll: true }), 60);
    return () => window.clearTimeout(timer);
  }, [focus]);
}

/** The panel's foot: a few ways to start, and the composer, keeping the draft per thread. */
function Foot({
  thread,
  starts,
  placeholder,
  pending,
  error,
  onSend,
}: {
  thread: string;
  starts: string[];
  placeholder: string;
  pending: boolean;
  error?: boolean;
  onSend: (words: string) => void;
}) {
  const text = useEngineState((s) => s.drafts[thread] ?? "");
  useComposerFocus();
  return (
    <div className="ui-engine-panel-foot">
      {starts.length > 0 && (
        <nav className="ui-chat-chips" aria-label="Ways to start">
          {starts.map((s) => (
            <Button
              key={s}
              variant="secondary"
              size="sm"
              icon="fume-engine"
              disabled={pending}
              onClick={() => onSend(s)}
            >
              {s}
            </Button>
          ))}
        </nav>
      )}
      <Composer
        value={text}
        onValueChange={(v) => enginePanel.draft(thread, v)}
        onSubmit={({ text: words }) => onSend(words)}
        disabled={pending}
        placeholder={placeholder}
        label="Write to the Engine"
        inputLabel="Message to the Engine"
        inputId={COMPOSER_ID}
        sendLabel="Send to the Engine"
        error={error ? "The Engine didn’t get that. Your message is still here; send it again." : undefined}
        inline
      />
    </div>
  );
}

/** The brand's Everything thread or a campaign's: the Engine chat's own messages and widgets. */
function ChatThread({
  workspaceId,
  topic,
  thread,
  title,
  brandName,
  field,
  page,
  onEarlier,
}: {
  workspaceId: Id;
  topic?: EngineTopic;
  thread: string;
  title: string;
  brandName: string;
  field?: import("../../contract").EngineField;
  /** The part of the project she writes from ("The plan"): an earlier chat is named by it. */
  page?: string;
  /** How many earlier chats the thread has, for the panel's "Sees" line. */
  onEarlier?: (n: number) => void;
}) {
  const session = useSession().data!;
  const people = directory(usePeople().data);
  const chat = useEngineChat(workspaceId, topic);
  const say = useEngineSay();
  const answer = useAnswerEngineWidget();
  const scroller = useRef<MessageScrollerHandle>(null);
  const [waiting, setWaiting] = useState(false);
  const all = chat.data ?? [];
  const last = all[all.length - 1];
  // Round 16: this web session's chat; what came before is listed under Earlier, named by what it was about
  const split = useSessionSplit(thread, chat.data);
  const items = split.now;
  const earlier = useMemo(
    () => earlierChats(split.earlier.map((m) => ({ ...m, mine: m.author.kind === "person" }))),
    [split.earlier],
  );
  useEffect(() => onEarlier?.(earlier.length), [earlier.length, onEarlier]);

  useEffect(() => {
    if (last?.author.kind === "engine") setWaiting(false);
  }, [last]);
  const loaded = Boolean(chat.data);
  useEffect(() => {
    if (!loaded) return;
    const timer = window.setTimeout(() => scroller.current?.scrollToEnd(false), 200);
    return () => window.clearTimeout(timer);
  }, [loaded]);
  const seen = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!last) return;
    const firstTime = seen.current === undefined;
    seen.current = last.id;
    if (firstTime || last.author.kind !== "engine") return;
    const timer = window.setTimeout(() => scroller.current?.scrollToEnd(true), 150);
    return () => window.clearTimeout(timer);
  }, [last?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const sent = () => {
    enginePanel.draft(thread, "");
    setWaiting(true);
    scroller.current?.scrollToEnd(true);
  };
  const write = (words: string) => {
    if (!words.trim()) return;
    say.mutate({ workspaceId, text: words, topic, field, page }, { onSuccess: sent });
  };
  useOutbox(thread, split.ready, write);
  const reply = (messageId: Id, a: { picked?: Id[]; choice?: string }) =>
    answer.mutate({ workspaceId, messageId, ...a }, { onSuccess: sent });
  const pending = say.isPending || answer.isPending;
  const quiet = items.length === 0 || last?.author.kind === "engine";
  const starts =
    !quiet || waiting
      ? []
      : field
        ? ["Write it shorter", "Is it on brand?"]
        : topic
          ? ["What waits for a check?"]
          : items.length === 0
            ? ["Packshots of the gift sets", "What waits for a check?"]
            : [];

  return (
    <>
      <div className="ui-engine-panel-body">
        <MessageScroller
          ref={scroller}
          label={`Your conversation with the Engine about ${title === "Everything" ? brandName : title}`}
          announcement={
            last ? `${last.author.kind === "engine" ? "Engine" : people.author(last.author)}: ${last.text}` : undefined
          }
        >
          {earlier.length > 0 && (
            <EarlierList
              chats={earlier}
              fallback={title}
              render={(list) =>
                list.map((m) => (
                  <Line key={m.id} message={m} workspaceId={workspaceId} people={people} meId={session.user.id} />
                ))
              }
            />
          )}
          {items.length === 0 && (
            <Marker icon="fume-engine">
              <span>
                {earlier.length
                  ? topic
                    ? `A new chat about ${title}. The Engine remembers your earlier chats about it; ask it, or ask it to write a line.`
                    : `A new chat for ${brandName}. The Engine remembers your earlier chats; tell it what to make, or ask what waits for a check.`
                  : topic
                    ? `This thread is about ${title}. The Engine knows its brief, its plan and its creatives; ask it, or ask it to write a line.`
                    : `Everything for ${brandName}: tell the Engine what to make, or ask what waits for a check.`}
              </span>
            </Marker>
          )}
          {items.map((m: EngineMessage, i) => {
            const prev = items[i - 1];
            const day = dayLabel(m.at);
            return (
              <Fragment key={m.id}>
                {(!prev || dayLabel(prev.at) !== day) && <DayMarker label={day} />}
                <Line
                  message={m}
                  workspaceId={workspaceId}
                  people={people}
                  meId={session.user.id}
                  onAnswer={pending ? undefined : reply}
                />
              </Fragment>
            );
          })}
          {waiting && (
            <Message state="thinking">
              <MessageHeader author="engine" />
              <MessageContent>
                <MessageStatus>The Engine is reading</MessageStatus>
              </MessageContent>
            </Message>
          )}
        </MessageScroller>
      </div>
      <Foot
        thread={thread}
        starts={starts}
        placeholder={
          field
            ? `Ask about ${field.label.toLowerCase()}`
            : topic
              ? `Ask the Engine about ${title}`
              : `Tell the Engine what to make for ${brandName}, or ask it`
        }
        pending={pending}
        error={Boolean(say.error || answer.error)}
        onSend={write}
      />
    </>
  );
}

/** A Studio document's thread: its Engine changes, the one that waits as a card to keep or undo. Also the Engine page's
 *  view of the thread, where the creative is not open beside it. */
export function DocumentThread({
  documentId,
  thread,
  desk,
  onEarlier,
}: {
  documentId: Id;
  thread: string;
  desk?: EngineDesk;
  onEarlier?: (n: number) => void;
}) {
  const session = useSession().data!;
  const people = directory(usePeople().data);
  const fetched = useDocument(desk ? undefined : documentId).data;
  const doc = desk?.doc ?? fetched;
  const ask = useEngineEdit();
  const toast = useToast();
  const scroller = useRef<MessageScrollerHandle>(null);
  const edits: (EngineEdit | VideoEngineEdit)[] | undefined = doc
    ? doc.video
      ? doc.video.edits
      : doc.edits
    : undefined;
  const last = edits?.[edits.length - 1];
  const waits = Boolean(edits?.some((e) => e.state === "proposed"));
  // Round 16: this web session's changes; a change that still waits stays in it, whenever it was asked for
  const split = useSessionSplit(thread, edits, stillWaits);
  const earlier = useMemo(() => earlierChats(split.earlier.map((e) => ({ ...e, mine: true }))), [split.earlier]);
  useEffect(() => onEarlier?.(earlier.length), [earlier.length, onEarlier]);
  useEffect(() => {
    const timer = window.setTimeout(() => scroller.current?.scrollToEnd(Boolean(last)), 150);
    return () => window.clearTimeout(timer);
  }, [last?.id, last?.state]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = (words: string) => {
    const said = words.trim();
    if (!said || !doc) return;
    desk?.onBefore();
    ask.mutate(
      { documentId: doc.id, text: said },
      {
        onSuccess: () => enginePanel.draft(thread, ""),
        onError: (err) => toast.error("The Engine didn’t take that", { description: err.message }),
      },
    );
  };
  useOutbox(thread, Boolean(doc) && split.ready, send);
  if (!doc)
    return (
      <div className="ui-engine-panel-body">
        <MessageText>Opening the creative’s thread</MessageText>
      </div>
    );
  const title = docTitle(doc);
  return (
    <>
      <div className="ui-engine-panel-body">
        <MessageScroller
          ref={scroller}
          label={`Your conversation with the Engine about ${title}`}
          announcement={
            last && "after" in last
              ? `Engine: ${last.changes.length ? last.changes.join(". ") : "nothing to change"}`
              : undefined
          }
        >
          {earlier.length > 0 && (
            <EarlierList
              chats={earlier}
              fallback={title}
              render={(list) => (
                <DocumentTurns
                  doc={doc}
                  edits={list}
                  mode={desk?.mode}
                  desk={desk}
                  people={people}
                  meId={session.user.id}
                />
              )}
            />
          )}
          <Marker icon="fume-engine">
            <span>
              {earlier.length ? "A new chat. " : ""}
              {doc.studio === "video"
                ? `One thread for ${title}. Every change shows on the timeline first: keep it or undo it here.`
                : `One thread for ${title}. Every change shows on the board first: keep it and render, or undo it here.`}
              {desk ? "" : " Open the creative in the Studio to see it."}
            </span>
          </Marker>
          <DocumentTurns
            doc={doc}
            edits={split.now}
            mode={desk?.mode}
            desk={desk}
            people={people}
            meId={session.user.id}
          />
          {ask.isPending && (
            <Message state="thinking">
              <MessageHeader author="engine" />
              <MessageContent>
                <MessageStatus>
                  {doc.studio === "video" ? "The Engine is reading the edit" : "The Engine is reading the creative"}
                </MessageStatus>
              </MessageContent>
            </Message>
          )}
        </MessageScroller>
      </div>
      <Foot
        thread={thread}
        starts={!waits && !ask.isPending && desk ? docStarts(doc, desk.mode).slice(0, 2) : []}
        placeholder={
          desk?.locked
            ? "The Engine is fixing it from Check. Wait, or take over on the board."
            : `Tell the Engine what to change in ${title}`
        }
        pending={ask.isPending || waits || Boolean(desk?.locked)}
        error={Boolean(ask.error)}
        onSend={send}
      />
    </>
  );
}

/** A change that still waits for her stays in this session's chat. */
const stillWaits = (e: { state: string }) => e.state === "proposed";

/** Sends what "Tell the Engine" wrote for this thread, once the thread is ready (round 16). */
function useOutbox(thread: string, ready: boolean, send: (words: string) => void) {
  const outbox = useEngineState((s) => s.outbox);
  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(() => {
    if (!ready || !outbox) return;
    const text = enginePanel.claimOutbox(thread);
    // Sent once the thread has settled in, so its own "reading" line and its answer follow as usual
    if (text) window.setTimeout(() => sendRef.current(text), 0);
  }, [ready, outbox, thread]);
}

/** Earlier chats in the thread, from before this web session (round 16): one row each, named by what it was about
 *  and the day, her first words under it; a row opens to read it. The newest first. */
function EarlierList<T>({
  chats,
  fallback,
  render,
}: {
  chats: EarlierChat<T>[];
  fallback: string;
  render: (items: T[]) => ReactNode;
}) {
  const [open, setOpen] = useState<string>();
  return (
    <section className="ui-engine-earlier" aria-label="Earlier chats">
      <h3 className="ui-engine-earlier-title">Earlier</h3>
      <ul className="ui-engine-earlier-list">
        {chats.map((c) => {
          const shown = open === c.id;
          return (
            <li key={c.id} className="ui-engine-earlier-item" data-open={shown ? "" : undefined}>
              <button
                type="button"
                className="ui-engine-earlier-row"
                aria-expanded={shown}
                onClick={() => setOpen(shown ? undefined : c.id)}
              >
                <Icon name="clock" />
                <span className="ui-engine-earlier-words">
                  <span className="ui-engine-earlier-about">{`${c.about ?? fallback} · ${dayLabel(c.at)}`}</span>
                  {c.said && <span className="ui-engine-earlier-said">{`“${c.said}”`}</span>}
                </span>
                <Icon name="chevron-down" className="ui-engine-earlier-chevron" />
              </button>
              {shown && <div className="ui-engine-earlier-chat">{render(c.items)}</div>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
