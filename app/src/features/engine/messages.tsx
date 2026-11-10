// One line of the Engine chat and the widgets it carries (FLOWS §19): the person's words in a bubble, the Engine's
// under its mark with its products to tick, its question, the run it started, the creative it opened, the creatives in
// Check it answers with, and (Round 15, PROPOSED 9 Nov 2026) the words it wrote for a field. Shared by the Engine page
// and the Engine panel (EnginePanel.tsx), which are one conversation. The look is engine-chat.css and engine-panel.css.
import {
  Bubble,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  CreativeTile,
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
  Message,
  MessageContent,
  MessageHeader,
  MessageText,
  PickGrid,
  ProductSheetButton,
  ProductTile,
} from "@fume/ui";
import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  useBatches,
  useBrandWorkspace,
  useDocuments,
  usePeople,
  useQaQueue,
  useStudioKit,
  useStudioModes,
} from "../../api/hooks";
import type { Batch, EngineField, EngineMessage, EngineWidget, Id, Product, QaView } from "../../contract";
import * as copy from "../../copy";
import { due, time } from "../../lib/time";
import { directory, firstName, sign } from "../../shell/people";
import { AllProductsSheet, confirmed } from "../fume/AllProducts";
import { formatName } from "../studio/parts";
import { shownVersion } from "../studio/doc/versions";
import { useOpenInStudio } from "../studio/shared";
import { frameRoot, useFrameKind } from "../../shell/scope";
import { useCheckWords, type CheckWords } from "../agency/agency-parts";
import { enginePanel } from "./panel";

export type People = ReturnType<typeof directory>;
export type Answer = (messageId: Id, answer: { picked?: Id[]; choice?: string }) => void;

/** Where Check opens for a run: filtered to it, at its first creative that waits. */
export const checkHref = (workspaceId: Id, runId: Id, items: QaView[]) => {
  const first = items.find((v) => v.item.state === "waiting") ?? items[0];
  return `/studio/b/${workspaceId}/qa?run=${runId}${first ? `&item=${first.item.id}` : ""}`;
};
/** A run's creatives in Check, in the order they were made. */
export const ofRun = (queue: QaView[] | undefined, runId: Id) =>
  (queue ?? []).filter((v) => v.item.runId === runId).sort((a, b) => a.item.madeAt.localeCompare(b.item.madeAt));

/** One message: a person's words in a bubble, the Engine's under its mark, with the widget it carries. */
export function Line({
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
        <MessageHeader
          author="person"
          person={sign(user)}
          name={people.author(author)}
          role={user?.title}
          time={time(message.at)}
          dateTime={message.at}
        />
        <MessageContent>
          {message.field && (
            <p className="ui-engine-about">
              <Icon name="pencil" />
              <span>About {fieldName(message.field)}</span>
            </p>
          )}
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
        {message.widget && (
          <Widget widget={message.widget} messageId={message.id} workspaceId={workspaceId} onAnswer={onAnswer} />
        )}
        {message.answer?.kind === "check" && <CheckAnswer itemIds={message.answer.itemIds} workspaceId={workspaceId} />}
      </MessageContent>
    </Message>
  );
}

function Widget({
  widget,
  messageId,
  workspaceId,
  onAnswer,
}: {
  widget: EngineWidget;
  messageId: Id;
  workspaceId: Id;
  onAnswer?: Answer;
}) {
  switch (widget.kind) {
    case "products":
      return (
        <ProductsWidget
          widget={widget}
          workspaceId={workspaceId}
          onPick={onAnswer && ((picked) => onAnswer(messageId, { picked }))}
        />
      );
    case "choice":
      return <ChoiceWidget widget={widget} onChoose={onAnswer && ((choice) => onAnswer(messageId, { choice }))} />;
    case "batch":
      return <BatchWidget batchId={widget.batchId} workspaceId={workspaceId} />;
    case "document":
      return <DocumentWidget documentId={widget.documentId} workspaceId={workspaceId} />;
    case "suggestion":
      return <SuggestionWidget field={widget.field} text={widget.text} workspaceId={workspaceId} />;
  }
}

/** A field's name with where it is: "Camera, in the plan", "Headlines, in the brand book". */
const fieldName = (f: EngineField) => `${f.label}, in ${f.kind === "book_line" ? "the brand book" : "the plan"}`;

/** Where a field is, for "Go to the field" from another page. */
const fieldHref = (f: EngineField, root: string, workspaceId: Id) =>
  f.kind === "book_line"
    ? `${root}/b/${f.workspaceId}/brand`
    : `${root}/b/${workspaceId}/campaigns/${f.campaignId}/plan`;

/** Words the Engine wrote for a field (Round 15, PROPOSED 9 Nov 2026): put by the field, she keeps or drops them there,
 *  with the field's own save. They never go into the field on their own. */
function SuggestionWidget({ field, text, workspaceId }: { field: EngineField; text: string; workspaceId: Id }) {
  const [put, setPut] = useState(false);
  const frame = useFrameKind();
  const { pathname } = useLocation();
  const href = fieldHref(field, frameRoot[frame], workspaceId);
  const here = pathname.startsWith(href);
  return (
    <Card className="ui-engine-widget ui-engine-suggestion">
      <CardHeader>
        <CardTitle as="p">{`For ${field.label.toLowerCase()}`}</CardTitle>
        <CardDescription>{fieldName(field)}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="ui-engine-suggestion-text">{text}</p>
      </CardContent>
      <CardFooter>
        <div className="ui-app-row">
          {put ? (
            <p className="ui-engine-answer">
              <Icon name="circle-check" />
              <span>By the field now: keep it or drop it there.</span>
            </p>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              icon="pencil"
              onClick={() => {
                enginePanel.offer(field, text);
                setPut(true);
              }}
            >
              Put it by the field
            </Button>
          )}
          {!here && (
            <Button asChild variant="quiet" size="sm" iconEnd="arrow-right">
              <Link to={href}>Go to the field</Link>
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}

/** The answer to a question about the work: the creatives in Check it is about, due first; each opens Check at that
 *  creative. */
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
        <CardDescription>
          {views.length === 1
            ? "One creative, due first at the top"
            : `${views.length} creatives, due first at the top`}
        </CardDescription>
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
                  <ItemTitle>
                    {copy.creativeName({ title: v.item.title, format: v.item.format, productName: v.productName })}
                  </ItemTitle>
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

/** The brand's products to tick: products whose facts the customer has not confirmed are locked, never ticked, and say
 *  who confirms them. The card shows a few tiles; "View all products" opens the whole offer in the shared sheet. Once
 *  picked, the card keeps only the picked ones and reads as an answer. */
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
  const shown = (answered ? widget.picked! : widget.productIds)
    .map((id) => byId.get(id))
    .filter((p): p is Product => Boolean(p));
  const open = shown.filter(confirmed);
  const locked = shown.length - open.length;
  // Who confirms a product's facts: the brand's customer (the demo's first customer is its owner).
  const owner = customer ? firstName(customer.name) : "the customer";
  const toggle = (id: Id, on: boolean) =>
    setTicked((list) => (on ? [...new Set([...list, id])] : list.filter((x) => x !== id)));
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
            <Button
              variant="primary"
              size="sm"
              iconEnd="arrow-right"
              disabled={ticked.length === 0}
              onClick={() => onPick(ticked)}
            >
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
function ChoiceWidget({
  widget,
  onChoose,
}: {
  widget: Extract<EngineWidget, { kind: "choice" }>;
  onChoose?: (choice: string) => void;
}) {
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
      description={[
        campaign ?? "Product page",
        mode?.name,
        `${copy.count(b.productIds.length, "product")} × ${b.perProduct}`,
        formatName(b.format),
      ]
        .filter(Boolean)
        .join(" · ")}
      state={b.state === "queued" ? "queued" : b.state === "running" ? "running" : "done"}
      steps={batchSteps(
        b,
        inRun,
        (i) =>
          studio.open({ creativeId: `${b.id}-c${i + 1}`, campaignId: b.campaignId || undefined, modeId: b.modeId }),
        studio.pending,
        checkWords,
      )}
      badge={
        b.state === "done" && inRun.some((v) => v.item.state !== "checked") ? (
          <EngineRunBadge state="running" label="In Check" />
        ) : undefined
      }
      actions={
        <EngineRunAction
          icon="fume-check"
          variant={inRun.length ? "secondary" : "quiet"}
          disabled={!inRun.length}
          onClick={() => navigate(checkHref(workspaceId, b.id, inRun))}
        >
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
      state:
        checked === b.total
          ? ("done" as const)
          : allIn
            ? ("waiting" as const)
            : landed
              ? ("active" as const)
              : ("pending" as const),
      progress: allIn ? undefined : { made: landed, total: b.total, label: `${landed} of ${b.total} in Check` },
      detail: allIn
        ? checked === b.total
          ? checkWords.allChecked
          : `${b.total - checked} ${checkWords.waitFor}${checked ? ` · ${checked} checked` : ""}`
        : undefined,
    },
  ];
}

/** A creative the Engine opened or made: its cover, and Open in the Studio for more control. */
function DocumentWidget({ documentId, workspaceId }: { documentId: Id; workspaceId: Id }) {
  const doc = useDocuments(workspaceId).data?.find((d) => d.id === documentId);
  if (!doc) return null;
  const cover = shownVersion(doc);
  return (
    <Item variant="outline" className="ui-engine-widget">
      <ItemMedia variant="creative">
        {cover ? <ItemMediaImage src={cover.image} alt="" /> : <Icon name="layers" />}
      </ItemMedia>
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
