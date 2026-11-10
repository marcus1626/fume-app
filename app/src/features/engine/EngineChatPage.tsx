// The Engine chat (FLOWS §19): Fume's people talk to the Engine the way customers talk to Fume, one conversation per
// brand, with the brand as context. "Take LYSNE's latest catalogue" → the Engine shows the products to tick → asks what
// it needs, one question at a time → runs → each creative lands in Check for the expert, and opens in the Studio for
// more control. Here the Engine talks (it never talks to customers): its lines carry its mark and name. The look is the
// customer's Fume chat (chat.css, message.css, composer.css), so both read as one product; the widgets are
// engine-chat.css.
// On a desk the thread is on the left and "The run" on the right: what the Engine has been told, each line changeable,
// the progress and Open in Check at its foot. A question gets an answer (what waits in Check, what is due first), never
// a run; the run card says what is true ("Landing in Check · 2 of 4") and every picture opens in the Studio. The
// composer has the focus on open and gets it back after every send and every answer.
// Round 15 (PROPOSED 9 Nov 2026): the Engine page is the Engine panel's full-screen view (EnginePanel.tsx), the same
// threads: Everything for the brand, and one per campaign or Studio document (?thread=campaign:c-winter), switched from
// the name beside the title. The lines and widgets are messages.tsx, shared with the panel.
import {
  Button,
  Composer,
  DataList,
  DataListItem,
  DataListNote,
  Marker,
  Message,
  MessageContent,
  MessageHeader,
  MessageScroller,
  MessageStatus,
  MessageText,
  OptionMenu,
  PageHeader,
  Progress,
  useNarrowScreen,
  type IconName,
  type MessageScrollerHandle,
} from "@fume/ui";
import { Fragment, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  useAnswerEngineWidget,
  useBatches,
  useBrandWorkspace,
  useEngineChat,
  useEngineSay,
  usePeople,
  useQaQueue,
  useSession,
  useStudioKit,
  useStudioModes,
} from "../../api/hooks";
import type { Campaign, EngineMessage, EngineRunDraft, EngineWidget, Id } from "../../contract";
import { now, time } from "../../lib/time";
import { Page, Query } from "../../shell/Page";
import { directory } from "../../shell/people";
import { DayMarker, dayLabel } from "../fume/parts";
import { formatName } from "../studio/parts";
import { useCheckWords } from "../agency/agency-parts";
import { DocumentThread, ThreadSwitch, useThreadRows } from "./EnginePanel";
import { checkHref, Line, ofRun, type Answer } from "./messages";
import { topicOf } from "./panel";

const COMPOSER_ID = "engine-composer";
/** After this long without a word, the chat is quiet and the suggested starts come back. */
const QUIET_MS = 20 * 60_000;
/** A layer on its way out gives the focus back as it goes; the composer takes it after. */
const CLOSING = "[role='dialog'][data-state='closed'], [role='alertdialog'][data-state='closed']";
/** The product page's line in "The run" (a run with no campaign). */
const PRODUCT_PAGE = "No campaign · product page";

export function EngineChatPage() {
  const { workspaceId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const session = useSession().data!;
  const checkWords = useCheckWords(); // who checks, in the frame's words
  // The thread: Everything (the brand) unless the address names a campaign's or a creative's
  const thread = params.get("thread") ?? "brand";
  const topic = topicOf(thread);
  const campaignTopic = topic?.kind === "campaign" ? topic : undefined;
  const rows = useThreadRows(workspaceId, { topic });
  const threadTitle = rows.find((r) => r.key === thread)?.title ?? (topic ? "This thread" : "Everything");
  const chooseThread = (key: string) =>
    setParams(
      (p) => {
        if (key === "brand") p.delete("thread");
        else p.set("thread", key);
        return p;
      },
      { replace: true },
    );
  const chat = useEngineChat(workspaceId, campaignTopic);
  const brand = useBrandWorkspace(workspaceId).data;
  const people = directory(usePeople().data);
  const say = useEngineSay();
  const answer = useAnswerEngineWidget();
  const docked = useNarrowScreen("(max-width: 1023px)");
  const fine = !useNarrowScreen("(pointer: coarse)");
  const desk = !docked;
  const scroller = useRef<MessageScrollerHandle>(null);
  const refocus = useRef(false);
  const [text, setText] = useState("");
  // From sending until the Engine's answer arrives, the Engine shows it is reading.
  const [waiting, setWaiting] = useState(false);

  const name =
    brand?.workspace.brandName ?? session.workspaces.find((w) => w.id === workspaceId)?.brandName ?? "the brand";
  const base = `/studio/b/${workspaceId}`;
  const items = chat.data ?? [];
  const last = items[items.length - 1];
  const open = last?.author.kind === "engine" && isOpen(last.widget);
  const quiet = !last || now() - Date.parse(last.at) > QUIET_MS;
  const starts = campaignTopic
    ? ["What waits for a check?"]
    : ["Packshots of the gift sets", "What waits for a check?", "Open the last creative"];
  // "The run": the latest run, or what the next one has been told so far (the brand's thread, where runs are made).
  const latest = [...items].reverse().find((m) => m.run || m.widget?.kind === "batch");
  const panel = desk && latest && !topic ? latest : undefined;

  // The composer is the chat's place for the focus: on a pointer, never a phone's keyboard popping up on its own.
  const focusComposer = () => {
    if (!fine) return;
    const end = performance.now() + 2000;
    const go = () => {
      if (document.querySelector(CLOSING) && performance.now() < end) window.requestAnimationFrame(go);
      else window.setTimeout(() => document.getElementById(COMPOSER_ID)?.focus({ preventScroll: true }), 30);
    };
    go();
  };

  useEffect(() => {
    if (last?.author.kind === "engine") setWaiting(false);
  }, [last]);
  // The chat opens at its latest line, once its widgets have their pictures; the shell has moved the focus to the page
  // by then, and the composer takes it.
  const loaded = Boolean(chat.data);
  useEffect(() => {
    if (!loaded) return;
    const timer = window.setTimeout(() => scroller.current?.scrollToEnd(false), 400);
    const focus = window.setTimeout(focusComposer, 80);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(focus);
    };
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // A line the Engine adds (its answer, the run starting) comes into view, as her own words do.
  const seen = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!last) return;
    const first = seen.current === undefined;
    seen.current = last.id;
    if (first || last.author.kind !== "engine") return;
    const timer = window.setTimeout(() => scroller.current?.scrollToEnd(true), 150);
    return () => window.clearTimeout(timer);
  }, [last?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const sent = () => {
    setText("");
    setWaiting(true);
    scroller.current?.scrollToEnd(true);
  };
  const write = (words: string) => {
    if (!words.trim()) return;
    refocus.current = true;
    say.mutate({ workspaceId, text: words, topic: campaignTopic }, { onSuccess: sent });
  };
  const reply: Answer = (messageId, a) => {
    refocus.current = true;
    answer.mutate({ workspaceId, messageId, ...a }, { onSuccess: sent });
  };
  const pending = say.isPending || answer.isPending;
  const failed = say.error || answer.error;
  // The composer is disabled while a message goes out (a disabled field cannot hold the focus): it takes it after.
  useEffect(() => {
    if (pending || !refocus.current) return;
    refocus.current = false;
    const timer = window.setTimeout(focusComposer, 0);
    return () => window.clearTimeout(timer);
  }, [pending]); // eslint-disable-line react-hooks/exhaustive-deps

  const switcher = (
    <ThreadSwitch rows={rows} current={thread} title={threadTitle} brandName={name} onChoose={chooseThread} />
  );
  const links = (
    <>
      <Button asChild variant="quiet" size="sm" icon="image">
        <Link to={`${base}/output`}>Engine output</Link>
      </Button>
      <Button asChild variant="quiet" size="sm" icon="layers">
        <Link to={`${base}/studio`}>Studio</Link>
      </Button>
    </>
  );

  const conversation = (
    <Query query={chat} loading="Opening the Engine chat">
      {(list) => (
        <MessageScroller
          ref={scroller}
          label={`Your conversation with the Engine about ${campaignTopic ? threadTitle : name}`}
          announcement={
            last ? `${last.author.kind === "engine" ? "Engine" : people.author(last.author)}: ${last.text}` : undefined
          }
        >
          <Marker icon="fume-engine">
            <span>
              {campaignTopic
                ? `This thread is about ${threadTitle}: the Engine knows its brief, its plan and its creatives. Ask it, or ask it to write a line. ${checkWords.talks}`
                : `The Engine knows ${name}: its products, Brand DNA, modes and ${checkWords.taught}. Say what to make, and it asks what it needs; each creative lands in Check as it is made. Ask it what waits, too. ${checkWords.talks}`}
            </span>
          </Marker>
          {list.length === 0 && (
            <MessageText>
              {campaignTopic
                ? `Nothing here yet. Ask the Engine about ${threadTitle}.`
                : `Nothing here yet. Tell the Engine what to make for ${name}, or ask what waits for a check.`}
            </MessageText>
          )}
          {list.map((m, i) => {
            const prev = list[i - 1];
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
      )}
    </Query>
  );

  const foot = (
    <div className="ui-chat-foot">
      {quiet && !open && !waiting && (
        <nav className="ui-chat-chips" aria-label="Ways to start">
          {starts.map((s) => (
            <Button
              key={s}
              variant="secondary"
              size="sm"
              icon="fume-engine"
              disabled={pending}
              onClick={() => write(s)}
            >
              {s}
            </Button>
          ))}
        </nav>
      )}
      <Composer
        value={text}
        onValueChange={setText}
        onSubmit={({ text: words }) => write(words)}
        disabled={pending}
        placeholder={
          campaignTopic ? `Ask the Engine about ${threadTitle}` : `Tell the Engine what to make for ${name}, or ask it`
        }
        label="Write to the Engine"
        inputLabel="Message to the Engine"
        inputId={COMPOSER_ID}
        sendLabel="Send to the Engine"
        error={failed ? "The Engine didn’t get that. Your message is still here; send it again." : undefined}
        hint
        sticky={docked}
      />
    </div>
  );

  // A creative's thread: its Engine changes, as in the panel beside the Studio
  const body =
    topic?.kind === "document" ? (
      <DocumentThread documentId={topic.id} thread={thread} />
    ) : (
      <>
        {conversation}
        {foot}
      </>
    );

  if (desk)
    return (
      <Page title={`Engine · ${name}`} width="fill">
        <div className="ui-app-page ui-chat-page" data-desk="" data-panel={panel ? "" : undefined}>
          <div className="ui-chat">
            <header className="ui-chat-head">
              <h1 className="ui-chat-head-title" tabIndex={-1}>
                Engine
              </h1>
              {switcher}
              <div className="ui-chat-head-actions">{links}</div>
            </header>
            {body}
          </div>
          {panel && (
            <RunPanel
              message={panel}
              messages={items}
              workspaceId={workspaceId}
              disabled={pending}
              onSay={write}
              onAnswer={reply}
            />
          )}
        </div>
      </Page>
    );

  return (
    <Page title={`Engine · ${name}`} width="fill">
      <div className="ui-app-page ui-chat-page">
        <PageHeader
          title="Engine"
          actions={
            <>
              {switcher}
              {links}
            </>
          }
        />
        <div className="ui-chat">{body}</div>
      </div>
    </Page>
  );
}

/** A widget still waiting for the answer of Fume's person. */
function isOpen(widget?: EngineWidget): boolean {
  if (!widget) return false;
  if (widget.kind === "products") return !widget.picked;
  if (widget.kind === "choice") return !widget.answer;
  return false;
}

// ─── The run, beside the conversation ──────────────────────────────────────

const MODE_OPTIONS: { label: string; icon: IconName }[] = [
  { label: "Packshot", icon: "package" },
  { label: "Product in scene", icon: "image" },
  { label: "Lifestyle with a model", icon: "user" },
];
const FORMAT_OPTIONS = ["Instagram feed 4:5", "Story 9:16", "Square 1:1"];
type LineKey = "products" | "mode" | "count" | "campaign" | "format";
const QUESTION: Record<Exclude<LineKey, "products">, RegExp> = {
  mode: /mode/i,
  count: /how many/i,
  campaign: /campaign/i,
  format: /format/i,
};

/** "The run": what the Engine has been told for the run, line by line, the one it is asking about marked; a line can be
 *  changed in place until the run starts. Once it runs: its progress and Open in Check at its foot. */
function RunPanel({
  message,
  messages,
  workspaceId,
  disabled,
  onSay,
  onAnswer,
}: {
  message: EngineMessage;
  messages: EngineMessage[];
  workspaceId: Id;
  disabled: boolean;
  onSay: (words: string) => void;
  onAnswer: Answer;
}) {
  const checkWords = useCheckWords();
  const batches = useBatches();
  const modes = useStudioModes().data ?? [];
  const kit = useStudioKit(workspaceId).data;
  const brand = useBrandWorkspace(workspaceId).data;
  const queue = useQaQueue(workspaceId).data;
  const navigate = useNavigate();
  const batch =
    message.widget?.kind === "batch"
      ? batches.data?.find((b) => b.id === (message.widget as { batchId: Id }).batchId)
      : undefined;
  const campaigns: Campaign[] = (brand?.campaigns ?? []).map((r) => r.campaign);
  const ready = campaigns.filter(
    (c) => !["brief", "plan"].includes(c.stage) && !["closed", "delivered", "draft"].includes(c.state),
  );
  const productName = (id: Id) => kit?.products.find((p) => p.id === id)?.name;

  // The lines: from the run itself once it is made, else from what the Engine has been told.
  const draft: EngineRunDraft = batch
    ? {
        productIds: batch.productIds,
        mode: modes.find((m) => m.id === batch.modeId)?.name,
        perProduct: batch.perProduct,
        campaign: campaigns.find((c) => c.id === batch.campaignId)?.name ?? PRODUCT_PAGE,
        format: batch.campaignId ? formatName(batch.format) : "Product page 1:1",
      }
    : (message.run ?? {});
  const asking = batch ? undefined : draft.asking;
  const products = (draft.productIds ?? []).map(productName).filter(Boolean) as string[];
  const lines: {
    key: LineKey;
    label: string;
    value?: string;
    note?: string;
    empty: string;
    options?: { label: string; icon: IconName }[];
  }[] = [
    {
      key: "products",
      label: "Products",
      value: products.length ? products.join(", ") : undefined,
      empty: asking === "products" ? "Tick them in the chat" : "Not yet",
    },
    { key: "mode", label: "Mode", value: draft.mode, empty: "Not yet", options: MODE_OPTIONS },
    {
      key: "count",
      label: "Count",
      value: draft.perProduct ? `${draft.perProduct} per product` : undefined,
      note: draft.perProduct && products.length > 1 ? `${draft.perProduct * products.length} in all` : undefined,
      empty: "Not yet",
      options: ["2", "4", "6"].map((n) => ({ label: n, icon: "layers" as const })),
    },
    {
      key: "campaign",
      label: "Campaign",
      value: draft.campaign,
      note: draft.campaign === PRODUCT_PAGE || batch ? undefined : "Only campaigns with an approved plan",
      empty: "Not yet",
      options: [
        { label: PRODUCT_PAGE, icon: "package" as const },
        ...ready.slice(0, 3).map((c) => ({ label: c.name, icon: "megaphone" as const })),
      ],
    },
    {
      key: "format",
      label: "Format",
      value: draft.format,
      empty: draft.campaign === PRODUCT_PAGE ? "Product page 1:1" : "Not yet",
      options:
        draft.campaign === PRODUCT_PAGE ? undefined : FORMAT_OPTIONS.map((f) => ({ label: f, icon: "crop" as const })),
    },
  ];

  // A change: a question already asked takes the new answer; anything else goes to the Engine in words.
  const since = messages.slice(messages.map((m) => m.widget?.kind).lastIndexOf("batch") + 1);
  const change = (key: Exclude<LineKey, "products">, value: string) => {
    const asked = [...since]
      .reverse()
      .find(
        (m) => m.widget?.kind === "choice" && QUESTION[key].test(m.widget.question) && m.widget.options.includes(value),
      );
    if (asked) onAnswer(asked.id, { choice: value });
    else onSay(`${key[0].toUpperCase()}${key.slice(1)}: ${value}`);
  };

  const inRun = batch ? ofRun(queue, batch.id) : [];
  const checked = inRun.filter((v) => v.item.state === "checked").length;
  let note: string;
  if (!batch)
    note = asking
      ? "The Engine asks one thing at a time. The run starts when it has what it needs."
      : "The run starts in a moment.";
  else if (batch.made < batch.total) note = `${batch.made} of ${batch.total} made · ${inRun.length} in Check`;
  else if (inRun.length < batch.total) note = `Landing in Check · ${inRun.length} of ${batch.total}`;
  else if (checked === batch.total) note = `All ${batch.total} ${checkWords.checkedBy}`;
  else
    note = `${inRun.length} in Check · ${checked ? `${checked} checked, ` : ""}${inRun.length - checked} ${checkWords.waitFor}`;

  return (
    <aside className="ui-chat-brief ui-engine-run-panel" aria-labelledby="engine-run-title">
      <div className="ui-chat-brief-head">
        <h2 className="ui-chat-brief-title" id="engine-run-title" tabIndex={-1}>
          The run
        </h2>
        <p className="ui-chat-brief-meta">
          {batch ? (batch.state === "done" ? `Made ${time(batch.at)}` : "Under way") : "Being set up"}
        </p>
        <p className="ui-chat-brief-lead">
          What the Engine has been told. Nothing is made for a campaign before its plan is {checkWords.planDone}, and
          every creative {checkWords.lands}.
        </p>
      </div>
      <div className="ui-chat-brief-body">
        <DataList className="ui-chat-brief-lines">
          {lines.map((l) => {
            const editable =
              !batch && l.key !== "products" && l.options && l.options.length > 1 && (l.value || asking === l.key);
            return (
              <DataListItem key={l.key} label={l.label}>
                {l.value ? (
                  <span className="ui-chat-brief-value">{l.value}</span>
                ) : (
                  <span
                    className={
                      asking === l.key
                        ? "ui-chat-brief-value ui-chat-brief-asking"
                        : "ui-chat-brief-value ui-chat-brief-empty"
                    }
                  >
                    {asking === l.key && l.key !== "products" ? "The Engine is asking" : l.empty}
                  </span>
                )}
                {l.note && <DataListNote>{l.note}</DataListNote>}
                {editable && (
                  <OptionMenu
                    title={`Change the ${l.label.toLowerCase()}`}
                    options={l.options!.slice(0, 4).map((o) => ({
                      id: o.label,
                      icon: o.icon,
                      label: o.label,
                      onSelect: () => change(l.key as Exclude<LineKey, "products">, o.label),
                    }))}
                  >
                    <Button
                      variant="quiet"
                      size="sm"
                      iconOnly
                      icon="pencil"
                      className="ui-chat-brief-edit"
                      disabled={disabled}
                      aria-label={`Change the ${l.label.toLowerCase()}`}
                    />
                  </OptionMenu>
                )}
              </DataListItem>
            );
          })}
        </DataList>
      </div>
      <div className="ui-chat-brief-foot">
        {batch && (
          <Progress
            className="ui-engine-run-progress"
            value={batch.made < batch.total ? batch.made : inRun.length}
            max={batch.total}
            aria-label={batch.made < batch.total ? "Made" : "In Check"}
          />
        )}
        <p className="ui-chat-brief-note" role="status">
          {note}
        </p>
        {batch && (
          <Button
            variant="secondary"
            icon="fume-check"
            disabled={!inRun.length}
            onClick={() => navigate(checkHref(workspaceId, batch.id, inRun))}
          >
            Open in Check
          </Button>
        )}
      </div>
    </aside>
  );
}
