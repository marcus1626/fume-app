// The Engine chat (FLOWS §19, Marcus 15 Oct 14:28: "designerne snakker med Engine"). Fume's people talk to the Engine
// the way customers talk to Fume: one conversation per brand, with the brand as context. "Take LYSNE's latest
// catalogue" → the Engine shows the products to tick → asks what it needs, one question at a time → runs → each
// creative lands in Check for the expert, and opens in the Studio for more control. Here the Engine talks (it never
// talks to customers): its lines carry its mark and name. The look is the customer's Fume chat (chat.css,
// message.css, composer.css) so both read as one product; the widgets are engine-chat.css.
// Round 12 (UX review DLAY-13, DTASK-5, DWAY-13, DWAY-21; PROPOSED 20 Oct 2026): the Fume chat's desk layout, the
// thread on the page's left edge and "The run" on the right (what the Engine has been told, each line changeable,
// the progress and Open in Check at its foot); the header is the title with quiet links to Engine output and the
// Studio, and the description moved into the thread's first line. A question gets an answer (what waits in Check,
// what is due first), never a run; the run card says what is true ("Landing in Check · 2 of 4") and every picture
// opens in the Studio. The composer has the focus on open and gets it back after every send and every answer.
import {
  Bubble,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Composer,
  CreativeTile,
  DataList,
  DataListItem,
  DataListNote,
  EngineRun,
  EngineRunAction,
  EngineRunBadge,
  Icon,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemMediaImage,
  ItemTitle,
  Marker,
  Message,
  MessageContent,
  MessageHeader,
  MessageScroller,
  MessageStatus,
  MessageText,
  OptionMenu,
  PageHeader,
  PickGrid,
  Progress,
  ProductSheetButton,
  ProductTile,
  useNarrowScreen,
  type IconName,
  type MessageScrollerHandle,
} from "@fume/ui";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  useAnswerEngineWidget,
  useBatches,
  useBrandWorkspace,
  useDocuments,
  useEngineChat,
  useEngineSay,
  usePeople,
  useQaQueue,
  useSession,
  useStudioKit,
  useStudioModes,
} from "../../api/hooks";
import type { Batch, Campaign, EngineMessage, EngineRunDraft, EngineWidget, Id, Product, QaView } from "../../contract";
import * as copy from "../../copy";
import { due, now, time } from "../../lib/time";
import { Page, Query } from "../../shell/Page";
import { directory, firstName, sign } from "../../shell/people";
import { AllProductsSheet, confirmed } from "../fume/AllProducts";
import { DayMarker, dayLabel } from "../fume/parts";
import { formatName } from "../studio/parts";
import { useOpenInStudio } from "../studio/shared";
import { useCheckWords, type CheckWords } from "../agency/agency-parts";

const COMPOSER_ID = "engine-composer";
/** After this long without a word, the chat is quiet and the suggested starts come back. */
const QUIET_MS = 20 * 60_000;
/** A layer on its way out gives the focus back as it goes; the composer takes it after. */
const CLOSING = "[role='dialog'][data-state='closed'], [role='alertdialog'][data-state='closed']";
/** The product page's line in "The run" (a run with no campaign). */
const PRODUCT_PAGE = "No campaign · product page";

type People = ReturnType<typeof directory>;
type Answer = (messageId: Id, answer: { picked?: Id[]; choice?: string }) => void;

/** Where Check opens for a run: filtered to it, at its first creative that waits. */
const checkHref = (workspaceId: Id, runId: Id, items: QaView[]) => {
  const first = items.find((v) => v.item.state === "waiting") ?? items[0];
  return `/studio/b/${workspaceId}/qa?run=${runId}${first ? `&item=${first.item.id}` : ""}`;
};
/** A run's creatives in Check, in the order they were made. */
const ofRun = (queue: QaView[] | undefined, runId: Id) =>
  (queue ?? []).filter((v) => v.item.runId === runId).sort((a, b) => a.item.madeAt.localeCompare(b.item.madeAt));

export function EngineChatPage() {
  const { workspaceId = "" } = useParams();
  const session = useSession().data!;
  const checkWords = useCheckWords(); // round 13 AGENCY: who checks, in the frame's words
  const chat = useEngineChat(workspaceId);
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

  const name = brand?.workspace.brandName ?? session.workspaces.find((w) => w.id === workspaceId)?.brandName ?? "the brand";
  const base = `/studio/b/${workspaceId}`;
  const items = chat.data ?? [];
  const last = items[items.length - 1];
  const open = last?.author.kind === "engine" && isOpen(last.widget);
  const quiet = !last || now() - Date.parse(last.at) > QUIET_MS;
  const starts = ["Packshots of the gift sets", "What waits for a check?", "Open the last creative"];
  // "The run": the latest run, or what the next one has been told so far.
  const latest = [...items].reverse().find((m) => m.run || m.widget?.kind === "batch");
  const panel = desk && latest ? latest : undefined;

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
  // The chat opens at its latest line, once its widgets have their pictures; the shell has moved the focus to the
  // page by then, and the composer takes it (DWAY-21).
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
    say.mutate({ workspaceId, text: words }, { onSuccess: sent });
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

  const thread = (
    <Query query={chat} loading="Opening the Engine chat">
      {(list) => (
        <MessageScroller
          ref={scroller}
          label={`Your conversation with the Engine about ${name}`}
          announcement={last ? `${last.author.kind === "engine" ? "Engine" : people.author(last.author)}: ${last.text}` : undefined}
        >
          <Marker icon="fume-engine">
            <span>
              The Engine knows {name}: its products, Brand DNA, modes and {checkWords.taught}. Say what to make, and it asks what it needs; each creative lands in Check as it is made. Ask it what waits, too. {checkWords.talks}
            </span>
          </Marker>
          {list.length === 0 && <MessageText>Nothing here yet. Tell the Engine what to make for {name}, or ask what waits for a check.</MessageText>}
          {list.map((m, i) => {
            const prev = list[i - 1];
            const day = dayLabel(m.at);
            return (
              <Fragment key={m.id}>
                {(!prev || dayLabel(prev.at) !== day) && <DayMarker label={day} />}
                <Line message={m} workspaceId={workspaceId} people={people} meId={session.user.id} onAnswer={pending ? undefined : reply} />
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
            <Button key={s} variant="secondary" size="sm" icon="fume-engine" disabled={pending} onClick={() => write(s)}>
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
        placeholder={`Tell the Engine what to make for ${name}, or ask it`}
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

  if (desk)
    return (
      <Page title={`Engine · ${name}`} width="fill">
        <div className="ui-app-page ui-chat-page" data-desk="" data-panel={panel ? "" : undefined}>
          <div className="ui-chat">
            <header className="ui-chat-head">
              <h1 className="ui-chat-head-title" tabIndex={-1}>
                Engine
              </h1>
              <div className="ui-chat-head-actions">{links}</div>
            </header>
            {thread}
            {foot}
          </div>
          {panel && <RunPanel message={panel} messages={items} workspaceId={workspaceId} disabled={pending} onSay={write} onAnswer={reply} />}
        </div>
      </Page>
    );

  return (
    <Page title={`Engine · ${name}`} width="fill">
      <div className="ui-app-page ui-chat-page">
        <PageHeader title="Engine" actions={links} />
        <div className="ui-chat">
          {thread}
          {foot}
        </div>
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
const QUESTION: Record<Exclude<LineKey, "products">, RegExp> = { mode: /mode/i, count: /how many/i, campaign: /campaign/i, format: /format/i };

/** "The run" (DLAY-13): what the Engine has been told for the run, line by line, the one it is asking about marked;
 *  a line can be changed in place until the run starts. Once it runs: its progress and Open in Check at its foot. */
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
  const batch = message.widget?.kind === "batch" ? batches.data?.find((b) => b.id === (message.widget as { batchId: Id }).batchId) : undefined;
  const campaigns: Campaign[] = (brand?.campaigns ?? []).map((r) => r.campaign);
  const ready = campaigns.filter((c) => !["brief", "plan"].includes(c.stage) && !["closed", "delivered", "draft"].includes(c.state));
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
  const lines: { key: LineKey; label: string; value?: string; note?: string; empty: string; options?: { label: string; icon: IconName }[] }[] = [
    { key: "products", label: "Products", value: products.length ? products.join(", ") : undefined, empty: asking === "products" ? "Tick them in the chat" : "Not yet" },
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
      options: [{ label: PRODUCT_PAGE, icon: "package" as const }, ...ready.slice(0, 3).map((c) => ({ label: c.name, icon: "megaphone" as const }))],
    },
    {
      key: "format",
      label: "Format",
      value: draft.format,
      empty: draft.campaign === PRODUCT_PAGE ? "Product page 1:1" : "Not yet",
      options: draft.campaign === PRODUCT_PAGE ? undefined : FORMAT_OPTIONS.map((f) => ({ label: f, icon: "crop" as const })),
    },
  ];

  // A change: a question already asked takes the new answer; anything else goes to the Engine in words.
  const since = messages.slice(messages.map((m) => m.widget?.kind).lastIndexOf("batch") + 1);
  const change = (key: Exclude<LineKey, "products">, value: string) => {
    const asked = [...since].reverse().find((m) => m.widget?.kind === "choice" && QUESTION[key].test(m.widget.question) && m.widget.options.includes(value));
    if (asked) onAnswer(asked.id, { choice: value });
    else onSay(`${key[0].toUpperCase()}${key.slice(1)}: ${value}`);
  };

  const inRun = batch ? ofRun(queue, batch.id) : [];
  const checked = inRun.filter((v) => v.item.state === "checked").length;
  let note: string;
  if (!batch) note = asking ? "The Engine asks one thing at a time. The run starts when it has what it needs." : "The run starts in a moment.";
  else if (batch.made < batch.total) note = `${batch.made} of ${batch.total} made · ${inRun.length} in Check`;
  else if (inRun.length < batch.total) note = `Landing in Check · ${inRun.length} of ${batch.total}`;
  else if (checked === batch.total) note = `All ${batch.total} ${checkWords.checkedBy}`;
  else note = `${inRun.length} in Check · ${checked ? `${checked} checked, ` : ""}${inRun.length - checked} ${checkWords.waitFor}`;

  return (
    <aside className="ui-chat-brief ui-engine-run-panel" aria-labelledby="engine-run-title">
      <div className="ui-chat-brief-head">
        <h2 className="ui-chat-brief-title" id="engine-run-title" tabIndex={-1}>
          The run
        </h2>
        <p className="ui-chat-brief-meta">{batch ? (batch.state === "done" ? `Made ${time(batch.at)}` : "Under way") : "Being set up"}</p>
        <p className="ui-chat-brief-lead">What the Engine has been told. Nothing is made for a campaign before its plan is {checkWords.planDone}, and every creative {checkWords.lands}.</p>
      </div>
      <div className="ui-chat-brief-body">
        <DataList className="ui-chat-brief-lines">
          {lines.map((l) => {
            const editable = !batch && l.key !== "products" && l.options && l.options.length > 1 && (l.value || asking === l.key);
            return (
              <DataListItem key={l.key} label={l.label}>
                {l.value ? (
                  <span className="ui-chat-brief-value">{l.value}</span>
                ) : (
                  <span className={asking === l.key ? "ui-chat-brief-value ui-chat-brief-asking" : "ui-chat-brief-value ui-chat-brief-empty"}>{asking === l.key && l.key !== "products" ? "The Engine is asking" : l.empty}</span>
                )}
                {l.note && <DataListNote>{l.note}</DataListNote>}
                {editable && (
                  <OptionMenu
                    title={`Change the ${l.label.toLowerCase()}`}
                    options={l.options!.slice(0, 4).map((o) => ({ id: o.label, icon: o.icon, label: o.label, onSelect: () => change(l.key as Exclude<LineKey, "products">, o.label) }))}
                  >
                    <Button variant="quiet" size="sm" iconOnly icon="pencil" className="ui-chat-brief-edit" disabled={disabled} aria-label={`Change the ${l.label.toLowerCase()}`} />
                  </OptionMenu>
                )}
              </DataListItem>
            );
          })}
        </DataList>
      </div>
      <div className="ui-chat-brief-foot">
        {batch && <Progress className="ui-engine-run-progress" value={batch.made < batch.total ? batch.made : inRun.length} max={batch.total} aria-label={batch.made < batch.total ? "Made" : "In Check"} />}
        <p className="ui-chat-brief-note" role="status">
          {note}
        </p>
        {batch && (
          <Button variant="secondary" icon="fume-check" disabled={!inRun.length} onClick={() => navigate(checkHref(workspaceId, batch.id, inRun))}>
            Open in Check
          </Button>
        )}
      </div>
    </aside>
  );
}

// ─── One message ───────────────────────────────────────────────────────────

/** One message: a person's words in a bubble, the Engine's under its mark, with the widget it carries. */
function Line({
  message,
  workspaceId,
  people,
  meId,
  onAnswer,
}: {
  message: EngineMessage;
  workspaceId: Id;
  people: People;
  meId: Id;
  onAnswer?: Answer;
}) {
  const { author } = message;
  if (author.kind === "person") {
    const user = people.user(author.userId);
    return (
      <Message align={author.userId === meId ? "end" : "start"}>
        <MessageHeader author="person" person={sign(user)} name={people.author(author)} role={user?.title} time={time(message.at)} dateTime={message.at} />
        <MessageContent>
          <Bubble>{message.text}</Bubble>
        </MessageContent>
      </Message>
    );
  }
  return (
    <Message>
      <MessageHeader author="engine" time={time(message.at)} dateTime={message.at} />
      <MessageContent>
        <MessageText>{message.text}</MessageText>
        {message.widget && <Widget widget={message.widget} messageId={message.id} workspaceId={workspaceId} onAnswer={onAnswer} />}
        {message.answer?.kind === "check" && <CheckAnswer itemIds={message.answer.itemIds} workspaceId={workspaceId} />}
      </MessageContent>
    </Message>
  );
}

function Widget({ widget, messageId, workspaceId, onAnswer }: { widget: EngineWidget; messageId: Id; workspaceId: Id; onAnswer?: Answer }) {
  switch (widget.kind) {
    case "products":
      return <ProductsWidget widget={widget} workspaceId={workspaceId} onPick={onAnswer && ((picked) => onAnswer(messageId, { picked }))} />;
    case "choice":
      return <ChoiceWidget widget={widget} onChoose={onAnswer && ((choice) => onAnswer(messageId, { choice }))} />;
    case "batch":
      return <BatchWidget batchId={widget.batchId} workspaceId={workspaceId} />;
    case "document":
      return <DocumentWidget documentId={widget.documentId} workspaceId={workspaceId} />;
  }
}

/** The answer to a question about the work (DTASK-5): the creatives in Check it is about, due first; each opens Check
 *  at that creative. */
const ANSWER_ROWS = 5;
function CheckAnswer({ itemIds, workspaceId }: { itemIds: Id[]; workspaceId: Id }) {
  const queue = useQaQueue(workspaceId).data;
  const views = itemIds.map((id) => queue?.find((v) => v.item.id === id)).filter((v): v is QaView => Boolean(v));
  if (!views.length) return null;
  const shown = views.slice(0, ANSWER_ROWS);
  return (
    <Card className="ui-engine-widget ui-engine-check-answer">
      <CardHeader>
        <CardTitle as="p">In Check</CardTitle>
        <CardDescription>{views.length === 1 ? "One creative, due first at the top" : `${views.length} creatives, due first at the top`}</CardDescription>
      </CardHeader>
      <CardContent>
        <ItemGroup>
          {shown.map((v) => (
            <Item key={v.item.id} asChild size="sm">
              <Link to={`/studio/b/${workspaceId}/qa?item=${v.item.id}`}>
                <ItemMedia variant="creative">
                  <ItemMediaImage src={v.item.image} alt="" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{copy.creativeName({ title: v.item.title, format: v.item.format, productName: v.productName })}</ItemTitle>
                  <ItemDescription>
                    {v.campaign.name} · due {due(v.item.dueAt)}
                    {v.item.state === "fixing" ? " · with the Engine for a fix" : ""}
                  </ItemDescription>
                </ItemContent>
              </Link>
            </Item>
          ))}
        </ItemGroup>
      </CardContent>
      {views.length > ANSWER_ROWS && (
        <CardFooter>
          <Button asChild variant="quiet" size="sm" iconEnd="arrow-right">
            <Link to={`/studio/b/${workspaceId}/qa`}>All {views.length} in Check</Link>
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

/** The brand's products to tick (walk-through Must 9): products whose facts the customer has not confirmed are
 *  locked, never ticked, and say who confirms them. The card shows a few tiles; "View all products" opens the whole
 *  offer in the shared sheet. Once picked, the card keeps only the picked ones and reads as an answer. */
const INLINE = 8;
function ProductsWidget({
  widget,
  workspaceId,
  onPick,
}: {
  widget: Extract<EngineWidget, { kind: "products" }>;
  workspaceId: Id;
  onPick?: (picked: Id[]) => void;
}) {
  const kit = useStudioKit(workspaceId);
  const customer = (usePeople().data ?? []).find((u) => !u.staffRole);
  const [ticked, setTicked] = useState<Id[]>([]);
  const [all, setAll] = useState(false);
  const byId = useMemo(() => new Map((kit.data?.products ?? []).map((p) => [p.id, p])), [kit.data]);
  const answered = Boolean(widget.picked);
  const shown = (answered ? widget.picked! : widget.productIds).map((id) => byId.get(id)).filter((p): p is Product => Boolean(p));
  const open = shown.filter(confirmed);
  const locked = shown.length - open.length;
  // Who confirms a product's facts: the brand's customer (the demo's first customer is its owner).
  const owner = customer ? firstName(customer.name) : "the customer";
  const toggle = (id: Id, on: boolean) => setTicked((list) => (on ? [...new Set([...list, id])] : list.filter((x) => x !== id)));
  const everything = open.length > 0 && ticked.length === open.length;
  // The first few, and any picked in the sheet beyond them, so a pick made there shows in the card.
  const inline = shown.filter((p, i) => i < INLINE || ticked.includes(p.id));

  if (answered) {
    return (
      <Card className="ui-engine-widget" data-answered="">
        <CardHeader>
          <CardTitle as="p">{copy.count(shown.length, "product")} picked</CardTitle>
          <CardDescription>{shown.map((p) => p.name).join(", ")}</CardDescription>
        </CardHeader>
        <CardContent>
          <PickGrid size="sm" aria-label="Picked products">
            {shown.map((p) => (
              <ProductTile key={p.id} name={p.name} variant={p.variant} src={p.images[0]} />
            ))}
          </PickGrid>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="ui-engine-widget">
      <CardHeader>
        <CardTitle as="p">Tick the products to make for</CardTitle>
        <CardDescription>
          {ticked.length ? `${ticked.length} of ${open.length} ticked` : copy.count(open.length, "product") + " ready"}
          {locked ? ` · ${locked} locked until ${owner} confirms their facts` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="ui-app-stack">
          <PickGrid aria-label="Products">
            {inline.map((p) => {
              const ok = confirmed(p);
              return (
                <ProductTile
                  key={p.id}
                  name={p.name}
                  variant={p.variant}
                  src={p.images[0]}
                  selected={onPick && ok ? ticked.includes(p.id) : undefined}
                  onSelectedChange={(on) => toggle(p.id, on)}
                  flag={ok ? undefined : "Needs facts"}
                  flagIcon="lock"
                  note={ok ? undefined : `Waits for ${owner}`}
                />
              );
            })}
          </PickGrid>
          {onPick && shown.length > 1 && <ProductSheetButton count={shown.length} onClick={() => setAll(true)} />}
        </div>
      </CardContent>
      {onPick && (
        <CardFooter>
          <div className="ui-app-row">
            <Button variant="primary" size="sm" iconEnd="arrow-right" disabled={ticked.length === 0} onClick={() => onPick(ticked)}>
              {ticked.length ? `Make for ${copy.count(ticked.length, "product")}` : "Tick at least one"}
            </Button>
            {open.length > 1 && (
              <Button variant="quiet" size="sm" onClick={() => setTicked(everything ? [] : open.map((p) => p.id))}>
                {everything ? "Clear" : locked ? `Tick the ${open.length} ready` : "Tick all"}
              </Button>
            )}
          </div>
        </CardFooter>
      )}
      {onPick && (
        <AllProductsSheet
          open={all}
          onOpenChange={setAll}
          only={widget.productIds}
          multiple
          value={ticked}
          onPick={setTicked}
          doneLabel={(n) => (n ? `Tick ${copy.count(n, "product")}` : "Tick a product")}
          staff
          confirmer={owner}
        />
      )}
    </Card>
  );
}

/** The Engine's question, with its options as pills. Once answered, the answer stays and the pills go. */
function ChoiceWidget({ widget, onChoose }: { widget: Extract<EngineWidget, { kind: "choice" }>; onChoose?: (choice: string) => void }) {
  if (widget.answer) {
    return (
      <p className="ui-engine-answer">
        <Icon name="circle-check" />
        <span>
          {widget.question} <strong>{widget.answer}</strong>
        </span>
      </p>
    );
  }
  return (
    <div className="ui-app-row" role="group" aria-label={widget.question}>
      {widget.options.map((option) => (
        <Button key={option} variant="secondary" size="sm" disabled={!onChoose} onClick={() => onChoose?.(option)}>
          {option}
        </Button>
      ))}
    </div>
  );
}

/** A live run card for the batch: what it makes, its pictures (each opens in the Studio), and how far it is in Check. */
function BatchWidget({ batchId, workspaceId }: { batchId: Id; workspaceId: Id }) {
  const checkWords = useCheckWords();
  const batches = useBatches();
  const modes = useStudioModes().data ?? [];
  const brand = useBrandWorkspace(workspaceId).data;
  const queue = useQaQueue(workspaceId).data;
  const studio = useOpenInStudio(workspaceId);
  const navigate = useNavigate();
  const b = batches.data?.find((x) => x.id === batchId);
  if (!b) return null;
  const mode = modes.find((m) => m.id === b.modeId);
  const campaign = brand?.campaigns.find((c) => c.campaign.id === b.campaignId)?.campaign.name;
  const what = mode?.id === "m-packshot" ? copy.count(b.total, "packshot") : copy.creatives(b.total);
  const inRun = ofRun(queue, b.id);
  return (
    <EngineRun
      title={b.state === "done" ? `The Engine made ${what}` : `The Engine is making ${what}`}
      description={[campaign ?? "Product page", mode?.name, `${copy.count(b.productIds.length, "product")} × ${b.perProduct}`, formatName(b.format)].filter(Boolean).join(" · ")}
      state={b.state === "queued" ? "queued" : b.state === "running" ? "running" : "done"}
      steps={batchSteps(b, inRun, (i) => studio.open({ creativeId: `${b.id}-c${i + 1}`, campaignId: b.campaignId || undefined, modeId: b.modeId }), studio.pending, checkWords)}
      badge={b.state === "done" && inRun.some((v) => v.item.state !== "checked") ? <EngineRunBadge state="running" label="In Check" /> : undefined}
      actions={
        <EngineRunAction icon="fume-check" variant={inRun.length ? "secondary" : "quiet"} disabled={!inRun.length} onClick={() => navigate(checkHref(workspaceId, b.id, inRun))}>
          Open in Check
        </EngineRunAction>
      }
    />
  );
}

/** Making (the pictures, each opening in the Studio), then Check: landing one by one, then waiting for the expert. */
function batchSteps(b: Batch, inRun: QaView[], open: (i: number) => void, busy: boolean, checkWords: CheckWords) {
  const done = b.state === "done";
  const shown = Math.min(b.total, 8);
  const checkOf = (i: number) => inRun.find((v) => v.item.creativeId === `${b.id}-c${i + 1}`)?.item;
  // The tile's name says where it is; the step under the pictures counts them (a badge per tile would crowd them).
  const tiles = (
    <ul className="ui-engine-run-tiles" aria-label="Creatives">
      {Array.from({ length: shown }, (_, i) => {
        const item = checkOf(i);
        const made = i < b.made && b.previews.length > 0;
        return (
          <CreativeTile
            key={i}
            src={made ? b.previews[i % b.previews.length] : undefined}
            alt=""
            format={b.format === "story" ? "story" : b.format === "square" ? "square" : "feed"}
            label={`Open creative ${i + 1} in the Studio${item?.state === "checked" ? ", checked" : item ? ", in Check" : ""}`}
            loading={!made}
            onOpen={made && !busy ? () => open(i) : undefined}
          />
        );
      })}
    </ul>
  );
  const landed = inRun.length;
  const checked = inRun.filter((v) => v.item.state === "checked").length;
  const allIn = landed >= b.total;
  return [
    {
      label: "Making",
      state: done ? ("done" as const) : ("active" as const),
      progress: { made: b.made, total: b.total, label: `${b.made} of ${b.total} made` },
      detail: tiles,
    },
    {
      label: allIn ? (checked === b.total ? "Checked" : "In Check") : "Landing in Check",
      state: checked === b.total ? ("done" as const) : allIn ? ("waiting" as const) : landed ? ("active" as const) : ("pending" as const),
      progress: allIn ? undefined : { made: landed, total: b.total, label: `${landed} of ${b.total} in Check` },
      detail: allIn ? (checked === b.total ? checkWords.allChecked : `${b.total - checked} ${checkWords.waitFor}${checked ? ` · ${checked} checked` : ""}`) : undefined,
    },
  ];
}

/** A creative the Engine opened or made: its cover, and Open in the Studio for more control. */
function DocumentWidget({ documentId, workspaceId }: { documentId: Id; workspaceId: Id }) {
  const doc = useDocuments(workspaceId).data?.find((d) => d.id === documentId);
  if (!doc) return null;
  const cover = doc.versions.find((v) => v.id === doc.pickedVersionId) ?? doc.versions.at(-1);
  return (
    <Item variant="outline" className="ui-engine-widget">
      <ItemMedia variant="creative">{cover ? <ItemMediaImage src={cover.image} alt="" /> : <Icon name="layers" />}</ItemMedia>
      <ItemContent>
        <ItemTitle>{doc.slot ?? doc.title}</ItemTitle>
        <ItemDescription>
          {copy.count(doc.versions.length, "version")}
          {cover ? ` · V${cover.number} picked` : ""}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button asChild variant="secondary" size="sm" icon="layers">
          <Link to={`/studio/doc/${doc.id}`}>Open in the Studio</Link>
        </Button>
      </ItemActions>
    </Item>
  );
}
