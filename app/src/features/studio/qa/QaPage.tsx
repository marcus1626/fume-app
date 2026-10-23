// Check (FLOWS §10, §24.3): the one check workspace for Fume's experts and an agency's creatives, the same page in both
// frames. Everything the Engine made that waits for a check, by due date and risk, grouped by campaign. /studio/qa and
// /agency/check show every brand or client; /studio/b/:id/qa and /agency/b/:id/check one.
// - Tabs at the top, Plans · Images · Designs (Video later), each with how many wait; the list shows that kind only,
//   and the keys and "the next one" stay inside it. Plans that wait on Fume's expert are Fume's only; a plan opens
//   beside the list with "Check the plan".
// - On a desk (1024 px and wider) a fixed-height workspace, never a scrolling page: the list | the creative fitted to
//   the screen | a ~300 px panel whose decision is pinned at its foot, at the same place for every creative. Each
//   column scrolls on its own. The keys sit on the pills (Mark checked C, Tell the Engine F, Open in Studio S, ← →
//   move). On a phone the list comes first and a creative opens as a full-screen sheet.
// - The list keeps the order it loaded in, so nothing moves under the cursor; a creative she answers stays where it
//   was, marked in place ("Checked by you", "With the Engine"). The next creative is the next one that waits, in the
//   order shown; ← → skip what is done, and past the last one the end card says what comes next.
// - The panel, in one order: where it stands (one actor per state: "Waiting for a check", "With the Engine", "In Studio
//   with Anna"), what the Engine found, what to tell the Engine, and the decision at its foot. Mark checked carries the
//   expert's check, the Focus pointer in Amber; every check shows "Checked: <name>" with Undo.
// - Pins: a click on the creative drops a numbered pin and a note beside it; the pins go with Tell the Engine as
//   located notes.
// - A version sent back from the Studio comes back to the same creative ("Version 2 from the Studio · Anna, 14:32"),
//   with Before | After over the creative.
// - ?run=<batch> shows one Engine run's creatives, ?campaign=<id> one campaign's: a filter pill with its ×, and "Show
//   all" as a quiet link.
import {
  Badge,
  Button,
  CheckMark,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  Glass,
  Icon,
  Input,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemGroupLabel,
  ItemMedia,
  ItemMediaImage,
  ItemTitle,
  Kbd,
  PageHeader,
  SegmentedControl,
  SegmentedOption,
  Textarea,
  TextShimmer,
  useNarrowScreen,
  useToast,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@fume/ui";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  useBrandAssets,
  usePlan,
  useQaCheck,
  useQaEdit,
  useQaFeedback,
  useQaQueue,
  useQaToStudio,
  useQaUncheck,
  useSession,
  useStudioCampaigns,
} from "../../../api/hooks";
import type { Evaluation, Id, Layer, QaItem, QaPin, QaView, StudioCampaignRow } from "../../../contract";
import * as copy from "../../../copy";
import { due, now, time, when } from "../../../lib/time";
import { Nothing, Page, Query } from "../../../shell/Page";
import { brandBase, checkPath, frameRoot, type StaffFrameKind } from "../../../shell/scope";
import { vars } from "../../brand/board";
import { formatName } from "../parts";
import { useNames } from "./names";

/** The end card's place in the address (?item=end): past the last creative that waits. */
const END = "end";

/** A creative that waits for a check (the rest are checked, with the Engine, or in the Studio). */
const open = (v: QaView) => v.item.state === "waiting";

/** The one name of a creative in Check. */
export const qaName = (v: QaView) =>
  copy.creativeName({ title: v.item.title, format: v.item.format, productName: v.productName });

/** The Engine run a creative came from, when the Engine chat made it (a runId the contract's QaItem does not
 *  declare). */
const runOf = (item: QaItem) => (item as QaItem & { runId?: Id }).runId;

/** What Check holds, as its tabs. Video comes later. */
type Kind = "plans" | "images" | "designs";
const KINDS: { id: Kind; label: string; noun: string }[] = [
  { id: "plans", label: "Plans", noun: "plans" },
  { id: "images", label: "Images", noun: "images" },
  { id: "designs", label: "Designs", noun: "designs" },
];
const isKind = (k: string | null): k is Kind => k === "plans" || k === "images" || k === "designs";
/** A creative's tab: a Design creative's, else Images (what Image renders). */
const kindOf = (v: QaView): Exclude<Kind, "plans"> => (v.item.studio === "design" ? "designs" : "images");
const planWaits = (r: StudioCampaignRow) => r.campaign.waits?.plan === "in_check";

export function QaPage() {
  const { workspaceId } = useParams();
  const [params, setParams] = useSearchParams();
  const session = useSession().data;
  const agency = Boolean(session?.agency);
  const frame: StaffFrameKind = agency ? "agency" : "fume";
  const narrow = useNarrowScreen("(max-width: 1023.98px)");
  const queue = useQaQueue(workspaceId);
  const selectedId = params.get("item") ?? undefined;
  // ?run= (an Engine run's card) or ?campaign= (the Campaigns table's "In check") shows only those; Show all, the rest.
  const run = params.get("run") ?? undefined;
  const campaignOnly = params.get("campaign") ?? undefined;
  const filtered = Boolean(run || campaignOnly);
  // One run or one campaign shows only its creatives; the plans to check come back with Show all.
  const plans = usePlansToCheck(workspaceId, !agency && !filtered);

  const select = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set("item", id);
    else next.delete("item");
    setParams(next, { replace: true });
  };
  const showAll = () => {
    const next = new URLSearchParams(params);
    next.delete("run");
    next.delete("campaign");
    setParams(next, { replace: true });
  };

  const inScope = (v: QaView) => (!run || runOf(v.item) === run) && (!campaignOnly || v.campaign.id === campaignOnly);
  const scoped = useMemo(
    () => (queue.data && filtered ? queue.data.filter(inScope) : queue.data),
    [queue.data, run, campaignOnly],
  );
  const all = useStableOrder(scoped, `${workspaceId ?? "all"}|${run ?? ""}|${campaignOnly ?? ""}`);
  // What the filter is called: "This run", or the campaign's name.
  const only = run
    ? "This run"
    : campaignOnly
      ? (queue.data?.find((v) => v.campaign.id === campaignOnly)?.campaign.name ?? "This campaign")
      : undefined;
  const brand = workspaceId
    ? (queue.data?.[0]?.workspace.brandName ?? session?.workspaces.find((w) => w.id === workspaceId)?.brandName)
    : undefined;

  // The tabs: how many of each wait; the tab shown is the one asked for, the one the opened creative is in, or the
  // first kind that has creatives waiting (images, then designs, then plans).
  const counts: Record<Kind, number> = {
    plans: plans.filter(planWaits).length,
    images: all.filter((v) => kindOf(v) === "images" && open(v)).length,
    designs: all.filter((v) => kindOf(v) === "designs" && open(v)).length,
  };
  const asked = params.get("kind");
  const selectedAny = all.find((v) => v.item.id === selectedId);
  const fallback: Kind = counts.images
    ? "images"
    : counts.designs
      ? "designs"
      : counts.plans
        ? "plans"
        : all.some((v) => kindOf(v) === "images")
          ? "images"
          : all.length
            ? "designs"
            : plans.length
              ? "plans"
              : "images";
  const kind: Kind = isKind(asked)
    ? asked
    : selectedAny
      ? kindOf(selectedAny)
      : params.get("plan")
        ? "plans"
        : fallback;
  const chooseKind = (k: string) => {
    const next = new URLSearchParams(params);
    next.set("kind", k);
    next.delete("item");
    next.delete("plan");
    setParams(next, { replace: true });
  };
  /** The address of another tab, for the end card's "Next". */
  const kindHref = (k: Kind) => {
    const next = new URLSearchParams(params);
    next.set("kind", k);
    next.delete("item");
    next.delete("plan");
    return `?${next.toString()}`;
  };

  const views = useMemo(() => (kind === "plans" ? [] : all.filter((v) => kindOf(v) === kind)), [all, kind]);
  const groups = useMemo(() => byCampaign(views), [views]);
  // The order shown, group by group: the order the keys and "the next one" follow.
  const ordered = useMemo(() => groups.flat(), [groups]);
  const waitingAll = all.filter(open).length;
  const fixing = all.filter((v) => v.item.state === "fixing").length;
  const toCheck = counts.plans;

  // On a desk the first creative that waits opens at once; past the last one, the end card. On a phone the list first.
  const byId = ordered.find((v) => v.item.id === selectedId);
  const firstOpen = ordered.find(open);
  const current = kind === "plans" ? undefined : (byId ?? (narrow || selectedId === END ? undefined : firstOpen));
  const atEnd = kind !== "plans" && !narrow && !current;
  // The one opened by default goes into the address, so what she answers next follows from it (and a reload keeps it).
  const opened = kind !== "plans" && !narrow && !selectedId ? firstOpen?.item.id : undefined;
  useEffect(() => {
    if (opened) select(opened);
  }, [opened]);

  // After a key or an answer, the keyboard follows the selection to its row in the list.
  const follow = useRef(false);
  useEffect(() => {
    if (!follow.current) return;
    follow.current = false;
    const id = current?.item.id;
    const row = id ? document.querySelector<HTMLElement>(`[data-qa-row="${CSS.escape(id)}"]`) : null;
    const at = document.activeElement;
    const typing = at instanceof HTMLElement && at.closest("input, textarea, select, [contenteditable='true']");
    if (row && !typing && !narrow) {
      row.focus({ preventScroll: true });
      row.scrollIntoView({ block: "nearest" });
    }
  }, [current?.item.id, narrow]);

  const nextOpen = (from: number, step: 1 | -1, skip?: Id) => {
    for (let i = from + step; i >= 0 && i < ordered.length; i += step) {
      const v = ordered[i]!;
      if (open(v) && v.item.id !== skip) return v;
    }
    return undefined;
  };
  /** ← → and ↑ ↓: the one before or the next that waits; past the last, the end card. */
  const move = (step: 1 | -1) => {
    follow.current = true;
    if (!current) {
      const last = [...ordered].reverse().find(open);
      if (step < 0 && last) select(last.item.id);
      return;
    }
    const n = nextOpen(ordered.indexOf(current), step);
    if (n) select(n.item.id);
    else if (step > 0 && !narrow) select(END);
  };
  /** After she answers one: the next that waits in the order shown (from the top again if those above still wait). */
  const after = (id: Id) => {
    follow.current = true;
    const i = ordered.findIndex((v) => v.item.id === id);
    const n = nextOpen(i, 1, id) ?? nextOpen(-1, 1, id);
    if (n) select(n.item.id);
    else select(narrow ? null : END);
  };
  const reopen = (id: Id) => {
    follow.current = true;
    select(id);
  };

  // The decisions live here, not in the panel: the panel of one creative goes as soon as the next one opens, and a
  // toast and its Undo must not depend on the button that started them still being on screen.
  const names = useNames();
  const toast = useToast();
  const check = useQaCheck();
  const uncheck = useQaUncheck();
  const feedback = useQaFeedback();
  const shownId = useRef<Id | undefined>(undefined);
  // Each check's toast, so an Undo from the panel takes its toast (and its Undo) away too.
  const checkToasts = useRef(new Map<Id, ReturnType<typeof toast.done>>());
  shownId.current = current?.item.id;
  const failed = (what: string) => (e: Error) => {
    toast.error(what, { description: e.message });
  };
  const customerOf = (v: QaView) => (v.campaign.approverId ? names.name(v.campaign.approverId) : v.workspace.brandName);
  const act: QaActions = {
    busy: check.isPending || uncheck.isPending || feedback.isPending,
    checking: check.isPending,
    undoing: uncheck.isPending,
    telling: feedback.isPending,
    check: (v) =>
      check.mutateAsync(v.item.id).then(() => {
        checkToasts.current.get(v.item.id)?.dismiss();
        const shown = toast.done(`Checked: ${qaName(v)}`, {
          description: `Not sent to ${customerOf(v)} yet.`,
          duration: 10_000,
          action: { label: "Undo", onClick: () => void act.undo(v) },
        });
        checkToasts.current.set(v.item.id, shown);
        if (shownId.current === v.item.id) after(v.item.id);
      }, failed("The check didn’t go through")),
    undo: (v) =>
      uncheck.mutateAsync(v.item.id).then(() => {
        checkToasts.current.get(v.item.id)?.dismiss();
        checkToasts.current.delete(v.item.id);
        toast.done(`Check undone: ${qaName(v)}`, { description: "It waits for a check again." });
        reopen(v.item.id);
      }, failed("The check wasn’t undone")),
    tell: (v, text, pins) =>
      feedback.mutateAsync({ itemId: v.item.id, text, pins }).then(
        () => {
          toast.done(`With the Engine: ${qaName(v)}`, {
            description: pins.length
              ? `${copy.count(pins.length, "pinned note")} with it. Its fix comes back here.`
              : "Its fix comes back here to check.",
          });
          if (shownId.current === v.item.id) after(v.item.id);
          return true;
        },
        (e: Error) => {
          failed("The Engine didn’t get it")(e);
          return false;
        },
      ),
  };

  // ← → ↑ ↓ move, from anywhere but a field; never an arrow to check.
  useEffect(() => {
    if ((narrow && !current) || kind === "plans") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.closest("input, textarea, select, [contenteditable='true'], [role='tablist'], [role='menu']") ||
          t.closest("[role='dialog']:not(.ui-qa-sheet)"))
      )
        return;
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        move(1);
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        move(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const meta = queue.data
    ? [copy.toCheck(toCheck, waitingAll), ...(fixing ? [`${fixing} with the Engine`] : [])]
    : undefined;
  const nothingAtAll = queue.data && all.length === 0 && plans.length === 0;
  // The other tabs that still have something waiting, for the end card's "Next".
  const otherKinds = KINDS.filter((k) => k.id !== kind && counts[k.id] > 0);
  const currentPlan =
    kind === "plans"
      ? (plans.find((r) => r.campaign.id === params.get("plan")) ?? plans.find(planWaits) ?? plans[0])
      : undefined;

  return (
    <Page
      title={brand ? `Check · ${brand}` : "Check"}
      docTitle={brand ? `Check · ${brand}` : "Check"}
      width={narrow ? "default" : "fill"}
      className="ui-qa-page"
    >
      <PageHeader
        className="ui-qa-header"
        title="Check"
        meta={meta}
        tabs={
          nothingAtAll ? undefined : (
            <div className="ui-qa-bar">
              <SegmentedControl
                className="ui-qa-kinds"
                aria-label="What to check"
                value={kind}
                onValueChange={chooseKind}
              >
                {KINDS.map((k) => (
                  <SegmentedOption
                    key={k.id}
                    value={k.id}
                    count={counts[k.id] || undefined}
                    disabled={k.id === "plans" && agency}
                  >
                    {k.label}
                  </SegmentedOption>
                ))}
                <SegmentedOption value="video" disabled aria-disabled="true" title="Video is coming later">
                  Video <span className="ui-desk-later">Later</span>
                </SegmentedOption>
              </SegmentedControl>
              {filtered && only && (
                <div className="ui-qa-filter" role="group" aria-label="Filter">
                  <span className="ui-filter-pill">
                    <span className="ui-filter-pill-key">{run ? "Run" : "Campaign"}</span>
                    <span className="ui-filter-pill-value">{run ? "This run" : only}</span>
                    <button
                      type="button"
                      className="ui-filter-pill-remove"
                      aria-label={`Remove the filter: ${only}`}
                      onClick={showAll}
                    >
                      <Icon name="x" />
                    </button>
                  </span>
                  <button type="button" className="ui-link ui-qa-filter-all" onClick={showAll}>
                    Show all
                  </button>
                </div>
              )}
            </div>
          )
        }
      />
      <Query query={queue} loading="Loading Check">
        {() =>
          nothingAtAll ? (
            <Nothing
              icon="inbox"
              title={only ? `Nothing from ${run ? "this run" : only} waits for a check` : "Nothing waits for a check"}
              text={
                agency
                  ? "What the Engine makes lands here first, before anything goes to the client."
                  : "What the Engine makes lands here first, before anyone sends it to a customer."
              }
              action={
                filtered ? (
                  <Button variant="secondary" onClick={showAll}>
                    Show all
                  </Button>
                ) : undefined
              }
            />
          ) : kind === "plans" ? (
            <div className="ui-qa" data-end="">
              <PlansToCheck rows={plans} showBrand={!workspaceId} frame={frame} current={currentPlan?.campaign.id} />
              {currentPlan ? (
                <PlanFocus row={currentPlan} frame={frame} showBrand={!workspaceId} />
              ) : (
                <QaNoKind noun="plans" filtered={filtered} onShowAll={showAll} />
              )}
            </div>
          ) : (
            <div className="ui-qa" data-end={atEnd ? "" : undefined}>
              <QaList groups={groups} current={current?.item.id} showBrand={!workspaceId} onSelect={reopen} />
              {current ? (
                narrow ? (
                  createPortal(
                    <QaSheet
                      view={current}
                      index={ordered.indexOf(current)}
                      total={ordered.length}
                      onClose={() => select(null)}
                      onMove={move}
                    >
                      <QaFocus
                        key={current.item.id}
                        view={current}
                        index={ordered.indexOf(current)}
                        total={ordered.length}
                        onMove={move}
                        act={act}
                      />
                    </QaSheet>,
                    document.body,
                  )
                ) : (
                  <QaFocus
                    key={current.item.id}
                    view={current}
                    index={ordered.indexOf(current)}
                    total={ordered.length}
                    onMove={move}
                    act={act}
                  />
                )
              ) : atEnd ? (
                views.length === 0 ? (
                  <QaNoKind
                    noun={KINDS.find((k) => k.id === kind)!.noun}
                    filtered={filtered}
                    onShowAll={showAll}
                    next={
                      otherKinds[0]
                        ? {
                            label: otherKinds[0].label,
                            count: counts[otherKinds[0].id],
                            to: kindHref(otherKinds[0].id),
                          }
                        : undefined
                    }
                  />
                ) : (
                  <QaEnd
                    frame={frame}
                    workspaceId={workspaceId}
                    brand={brand}
                    only={only}
                    kindLabel={otherKinds.length ? KINDS.find((k) => k.id === kind)!.label : undefined}
                    otherKinds={otherKinds.map((k) => ({
                      key: `kind-${k.id}`,
                      title: k.id === "plans" ? "Plans" : k.label,
                      text:
                        k.id === "plans"
                          ? `${copy.count(counts.plans, "plan")} to check`
                          : `${copy.creatives(counts[k.id])} to check`,
                      to: kindHref(k.id),
                      action: `Check the ${k.noun}`,
                    }))}
                    beside={filtered ? (queue.data ?? []).filter((v) => open(v) && !inScope(v)).length : 0}
                    waiting={ordered.filter(open)}
                    fixing={views.filter((v) => v.item.state === "fixing").length}
                    plans={plans}
                    onFirst={() => {
                      follow.current = true;
                      select(firstOpen?.item.id ?? null);
                    }}
                    onShowAll={showAll}
                  />
                )
              ) : null}
            </div>
          )
        }
      </Query>
    </Page>
  );
}

/** A tab with nothing in it: says so, and where the work is instead. */
function QaNoKind({
  noun,
  filtered,
  onShowAll,
  next,
}: {
  noun: string;
  filtered: boolean;
  onShowAll: () => void;
  next?: { label: string; count: number; to: string };
}) {
  return (
    <section className="ui-qa-end" aria-labelledby="qa-none-title" data-ui-toast-anchor>
      <Icon name="circle-check" className="ui-qa-end-icon" />
      <h2 className="ui-qa-end-title" id="qa-none-title" tabIndex={-1}>
        No {noun} wait for a check
      </h2>
      <div className="ui-qa-end-actions">
        {next ? (
          <Button asChild iconEnd="arrow-right">
            <Link to={next.to}>
              {next.label} · {next.count}
            </Link>
          </Button>
        ) : filtered ? (
          <Button variant="secondary" onClick={onShowAll}>
            Show all
          </Button>
        ) : null}
      </div>
    </section>
  );
}

// ─── The order she sees ─────────────────────────────────────────────────────

/** The order the list loaded in (a check or a fix moves nothing under the cursor); a creative that arrives later goes
 *  under the rest. A new scope (another brand, a run) starts a new order. */
// The order lives for the session, not the page, so a creative sent from the Studio comes back to its own place in the
// list, not under the ones that wait.
const ranks = new Map<string, Map<Id, number>>();
function useStableOrder(data: QaView[] | undefined, scope: string): QaView[] {
  const rank = ranks.get(scope) ?? new Map<Id, number>();
  ranks.set(scope, rank);
  return useMemo(() => {
    for (const v of data ?? []) if (!rank.has(v.item.id)) rank.set(v.item.id, rank.size);
    return [...(data ?? [])].sort((a, b) => rank.get(a.item.id)! - rank.get(b.item.id)!);
  }, [data, rank]);
}

/** A group's key: the brand and the campaign. A creative with no campaign (a product page's pictures) is in its brand's
 *  "Product page" group (the mock names it). */
const groupOf = (v: QaView) => `${v.workspace.id}|${v.campaign.id}`;

/** Groups by campaign, in the order their first creative comes. */
function byCampaign(views: QaView[]): QaView[][] {
  const map = new Map<string, QaView[]>();
  for (const v of views) map.set(groupOf(v), [...(map.get(groupOf(v)) ?? []), v]);
  return [...map.values()];
}

// ─── The list ───────────────────────────────────────────────────────────────

function QaList({
  groups,
  current,
  showBrand,
  onSelect,
}: {
  groups: QaView[][];
  current?: Id;
  showBrand: boolean;
  onSelect: (id: Id) => void;
}) {
  const names = useNames();
  // One Tab stop for the creatives: the selected row (or the first); the arrows move it (roving tabindex).
  const stop = current ?? groups[0]?.[0]?.item.id;
  return (
    <nav className="ui-qa-list" aria-label="To check">
      {groups.map((group) => {
        const { campaign, workspace } = group[0]!;
        const left = group.filter(open).length;
        return (
          <ItemGroup key={groupOf(group[0]!)} as="ul" aria-label={campaign.name}>
            <ItemGroupLabel count={left ? `${left} to check` : "All answered"}>
              {showBrand ? `${workspace.brandName} · ${campaign.name}` : campaign.name}
            </ItemGroupLabel>
            {group.map((v) => (
              <li key={v.item.id}>
                <Item
                  as="button"
                  className="ui-qa-row"
                  data-qa-row={v.item.id}
                  data-state={v.item.state}
                  tabIndex={v.item.id === stop ? 0 : -1}
                  aria-current={v.item.id === current ? "true" : undefined}
                  onClick={() => onSelect(v.item.id)}
                >
                  <ItemMedia variant="creative">
                    <ItemMediaImage src={v.item.image} alt="" />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{qaName(v)}</ItemTitle>
                    <ItemDescription>
                      {[
                        v.item.risk === "high" && v.item.state !== "checked" ? "High risk" : undefined,
                        `Due ${due(v.item.dueAt)}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </ItemDescription>
                    <ItemDescription>{rowState(v.item, names.who)}</ItemDescription>
                  </ItemContent>
                </Item>
              </li>
            ))}
          </ItemGroup>
        );
      })}
    </nav>
  );
}

/** One line on where the creative stands, one actor per state; only a checked one carries the Amber triangle. */
function rowState(item: QaItem, who: (id?: Id) => string): ReactNode {
  switch (item.state) {
    case "checked":
      return <Badge check="approved">{copy.checkedBy(who(item.checkedBy))}</Badge>;
    case "fixing":
      return "With the Engine";
    case "in_studio":
      return `In Studio with ${who(item.studioBy)}`;
    default:
      if (item.sentAt)
        return (item.version ?? 1) > 1 ? `Version ${item.version} from the Studio` : "Back from the Studio";
      if (item.feedback.at(-1)?.state === "fixed") return "The Engine’s fix is back";
      return "Waiting for a check";
  }
}

// ─── Plans to check (Fume's expert only) ──────────────────────────────────

/** The campaigns whose plan waits on Fume's expert (in check) or that Fume is still writing, in one brand or all. */
function usePlansToCheck(workspaceId: string | undefined, fume: boolean): StudioCampaignRow[] {
  const rows = useStudioCampaigns().data ?? [];
  if (!fume) return [];
  return rows.filter(
    (r) =>
      (!workspaceId || r.workspace.id === workspaceId) &&
      r.campaign.stage === "plan" &&
      (r.campaign.waits?.plan === "in_check" || r.campaign.waits?.plan === "writing"),
  );
}

/** "4 h ago", "12 min ago", "just now"; a day or more back, the day ("Yesterday", "12 Oct"). */
function ago(iso: string): string {
  const min = Math.round((now() - Date.parse(iso)) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  if (min < 60 * 24) return `${Math.round(min / 60)} h ago`;
  return when(iso);
}

const planPath = (frame: StaffFrameKind, row: StudioCampaignRow) =>
  `${brandBase(frame, row.workspace.id)}/campaigns/${row.campaign.id}/plan`;

/** The Plans tab's list: each plan as a row; the one picked opens beside it. */
function PlansToCheck({
  rows,
  showBrand,
  frame,
  current,
}: {
  rows: StudioCampaignRow[];
  showBrand: boolean;
  frame: StaffFrameKind;
  current?: Id;
}) {
  const left = rows.filter(planWaits).length;
  return (
    <nav className="ui-qa-list" aria-label="Plans to check">
      <ItemGroup as="ul" aria-label="Plans to check">
        <ItemGroupLabel count={left ? `${left} to check` : undefined}>Plans to check</ItemGroupLabel>
        {rows.map((r) => (
          <PlanToCheck
            key={r.campaign.id}
            row={r}
            showBrand={showBrand}
            frame={frame}
            current={r.campaign.id === current}
          />
        ))}
      </ItemGroup>
    </nav>
  );
}

/** One plan: the campaign, its brand (across brands), when Fume wrote it, and when it is due. */
function PlanToCheck({
  row,
  showBrand,
  current,
}: {
  row: StudioCampaignRow;
  showBrand: boolean;
  frame: StaffFrameKind;
  current: boolean;
}) {
  const plan = usePlan(row.campaign.id).data;
  const [params, setParams] = useSearchParams();
  const writing = (plan?.state ?? row.campaign.waits?.plan) === "writing";
  const line = [
    showBrand ? row.workspace.brandName : undefined,
    writing
      ? "Fume is writing it"
      : plan?.writtenAt
        ? `${showBrand ? "written" : "Written"} ${ago(plan.writtenAt)}`
        : undefined,
  ]
    .filter(Boolean)
    .join(" · ");
  const by = plan?.readyBy ?? row.clock?.dueAt;
  return (
    <li>
      <Item
        as="button"
        className="ui-qa-row"
        aria-current={current ? "true" : undefined}
        onClick={() => {
          const next = new URLSearchParams(params);
          next.set("kind", "plans");
          next.set("plan", row.campaign.id);
          setParams(next, { replace: true });
        }}
      >
        <ItemMedia variant="icon">
          <Icon name="file-text" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{row.campaign.name}</ItemTitle>
          {line && <ItemDescription>{line}</ItemDescription>}
          <ItemDescription>
            {[`Version ${plan?.version ?? 1}`, by ? `Due ${due(by)}` : undefined].filter(Boolean).join(" · ")}
          </ItemDescription>
        </ItemContent>
      </Item>
    </li>
  );
}

/** The plan picked in the Plans tab, in the well: what it is and the one way on, Check the plan. */
function PlanFocus({ row, frame, showBrand }: { row: StudioCampaignRow; frame: StaffFrameKind; showBrand: boolean }) {
  const plan = usePlan(row.campaign.id).data;
  const writing = (plan?.state ?? row.campaign.waits?.plan) === "writing";
  const by = plan?.readyBy ?? row.clock?.dueAt;
  return (
    <section className="ui-qa-end ui-qa-plan" aria-labelledby="qa-plan-title" data-ui-toast-anchor>
      <Icon name="file-text" className="ui-qa-end-icon" />
      <h2 className="ui-qa-end-title" id="qa-plan-title" tabIndex={-1}>
        {row.campaign.name} · the plan
      </h2>
      <p className="ui-qa-end-text">
        {[
          showBrand ? row.workspace.brandName : undefined,
          writing ? "Fume is writing it" : plan?.writtenAt ? `Fume wrote it ${ago(plan.writtenAt)}` : "Fume wrote it",
          `version ${plan?.version ?? 1}`,
          by ? `due ${due(by)}` : undefined,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <div className="ui-qa-end-actions">
        <Button asChild iconEnd="arrow-right" disabled={writing}>
          <Link to={planPath(frame, row)}>{writing ? "Open the plan" : "Check the plan"}</Link>
        </Button>
      </div>
    </section>
  );
}

// ─── The phone sheet ────────────────────────────────────────────────────────

function QaSheet({
  view,
  index,
  total,
  onClose,
  onMove,
  children,
}: {
  view: QaView;
  index: number;
  total: number;
  onClose: () => void;
  onMove: (step: 1 | -1) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // The next creative opens at its top, not where the last one was scrolled to.
  useEffect(() => ref.current?.scrollTo({ top: 0 }), [view.item.id]);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div ref={ref} className="ui-qa-sheet" role="dialog" aria-modal="true" aria-label={qaName(view)} tabIndex={-1}>
      <div className="ui-qa-sheet-bar">
        <Button variant="quiet" icon="arrow-left" onClick={onClose}>
          Check
        </Button>
        <div className="ui-app-row">
          <span className="ui-qa-pos">
            {index + 1} of {total}
          </span>
          <Button variant="quiet" iconOnly icon="chevron-left" aria-label="The one before" onClick={() => onMove(-1)} />
          <Button variant="quiet" iconOnly icon="chevron-right" aria-label="The next one" onClick={() => onMove(1)} />
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── The creative and its panel ─────────────────────────────────────────────

/** The page's decisions on one creative: each shows its toast and opens the next one that waits. */
interface QaActions {
  busy: boolean;
  checking: boolean;
  undoing: boolean;
  telling: boolean;
  check: (v: QaView) => Promise<void>;
  undo: (v: QaView) => Promise<void>;
  /** True once the Engine has it. */
  tell: (v: QaView, text: string, pins: QaPin[]) => Promise<boolean>;
}

/** A pin's note is written beside it; where the well has no room for it on either side (the box's width and the pin,
 *  about 300 px across, 150 down), it opens centred under the pin (or over it near the bottom), so it stays in the well. */
const ROOM_X = 300;
const ROOM_Y = 150;

function QaFocus({
  view,
  index,
  total,
  onMove,
  act,
}: {
  view: QaView;
  index: number;
  total: number;
  onMove: (step: 1 | -1) => void;
  act: QaActions;
}) {
  const { item, campaign, workspace } = view;
  const name = qaName(view);
  const names = useNames();
  const toast = useToast();
  const navigate = useNavigate();
  const edit = useQaEdit();
  const toStudio = useQaToStudio();
  const tellRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const textLayers = (item.layers ?? []).filter((l) => l.kind === "text");
  const [words, setWords] = useState<Record<string, string>>({});
  const [active, setActive] = useState<string>();
  const [shown, setShown] = useState<"after" | "before">("after");
  // the pins she drops on the creative, and the one she is writing
  const [pins, setPins] = useState<QaPin[]>([]);
  const [draft, setDraft] = useState<{
    x: number;
    y: number;
    side: "right" | "left" | "center";
    flipY: boolean;
  } | null>(null);
  const [draftText, setDraftText] = useState("");
  const [activePin, setActivePin] = useState<number>();
  const dirty = textLayers.some((l) => words[l.id] !== undefined && words[l.id] !== l.text);
  // Words on a photograph take the brand's chosen light ground colour (its packshot white).
  const ink = useBrandAssets(item.workspaceId).data?.presets.find((p) => p.kind === "background")?.hex;
  const busy = act.busy || edit.isPending || toStudio.isPending;
  const checked = item.state === "checked";
  const fixing = item.state === "fixing";
  const failed = (what: string) => (e: Error) => toast.error(what, { description: e.message });

  const changedLayers = (): Layer[] =>
    (item.layers ?? []).map((l) => (words[l.id] !== undefined ? { ...l, text: words[l.id] } : l));
  const saveWords = (then?: () => void) =>
    edit.mutate(
      { itemId: item.id, layers: changedLayers() },
      {
        onSuccess: () => {
          setWords({});
          if (then) then();
          else toast.done("Words changed", { description: `On ${name}. The Studio has them too.` });
        },
        onError: failed("The words weren’t changed"),
      },
    );

  const markChecked = () => {
    if (busy || checked) return;
    if (fixing) {
      toast.info("With the Engine: nothing to check yet", { description: "Its fix comes back here." });
      return;
    }
    const go = () => void act.check(view);
    if (dirty) saveWords(go);
    else go();
  };

  // One creative, one worker: a creative a designer has open in the Studio goes to the Engine only after a yes.
  const [asking, setAsking] = useState(false);
  const tell = (sure = false) => {
    const said = text.trim();
    if (!said && !pins.length) {
      tellRef.current?.focus();
      return;
    }
    if (busy || fixing || checked) return;
    if (item.state === "in_studio" && !sure) {
      setAsking(true);
      return;
    }
    void act.tell(view, said, pins).then((sent) => {
      if (!sent) return;
      setText("");
      setPins([]);
    });
  };

  const openStudio = () => {
    if (busy) return;
    toStudio.mutate(item.id, {
      onSuccess: ({ document }) => navigate(`/studio/doc/${document.id}`),
      onError: failed("The Studio didn’t open"),
    });
  };

  // a click on the creative drops a pin and opens its note beside it
  const pinnable = !checked && !fixing && shown === "after";
  const dropPin = (e: ReactMouseEvent<HTMLElement>) => {
    if (!pinnable) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    // the note box stays inside the well: beside the pin where there is room, else centred under (or over) it
    const well = (e.currentTarget.closest(".ui-qa-fit") ?? e.currentTarget).getBoundingClientRect();
    const right = well.right - e.clientX;
    const left = e.clientX - well.left;
    const side = right >= ROOM_X ? "right" : left >= ROOM_X ? "left" : "center";
    setDraft({ x, y, side, flipY: well.bottom - e.clientY < ROOM_Y });
    setDraftText("");
    setActivePin(undefined);
  };
  const addPin = () => {
    const note = draftText.trim();
    if (!draft || !note) return;
    setPins((p) => [...p, { n: p.length + 1, x: draft.x, y: draft.y, text: note }]);
    setDraft(null);
    setDraftText("");
  };
  const removePin = (n: number) => setPins((p) => p.filter((x) => x.n !== n).map((x, i) => ({ ...x, n: i + 1 })));

  // C checked, F tell the Engine, S Studio. Never while typing in a field; the arrows are the page's.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.closest("input, textarea, select, [contenteditable='true'], [role='tablist'], [role='menu']") ||
          t.closest("[role='dialog']:not(.ui-qa-sheet)"))
      )
        return;
      const k = e.key.toLowerCase();
      if (k === "c") markChecked();
      else if (k === "f" && !checked) {
        e.preventDefault();
        tellRef.current?.focus();
      } else if (k === "s") openStudio();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const latest = item.feedback.at(-1);
  const before = shown === "before" && item.previous;
  const image = before ? item.previous!.image : item.image;
  const version = before ? item.previous!.version : (item.version ?? 1);
  const pinStyle = (p: { x: number; y: number }) =>
    ({ "--x": `${p.x * 100}%`, "--y": `${p.y * 100}%` }) as CSSProperties;

  return (
    <>
      <section className="ui-qa-stage" aria-label={`${name}, ${formatName(item.format)}`} data-ui-toast-anchor>
        <div className="ui-qa-stage-bar">
          <div className="ui-qa-stage-start">
            {item.previous ? (
              <SegmentedControl
                aria-label="Version shown"
                value={shown}
                onValueChange={(v) => setShown(v as "after" | "before")}
              >
                <SegmentedOption value="before">Before · V{item.previous.version}</SegmentedOption>
                <SegmentedOption value="after">After · V{item.version ?? item.previous.version + 1}</SegmentedOption>
              </SegmentedControl>
            ) : (
              <span className="ui-qa-stage-meta">
                {formatName(item.format)} · V{version}
              </span>
            )}
          </div>
          <div className="ui-qa-stage-end">
            <span className="ui-qa-pos">
              {index + 1} of {total}
            </span>
            <Button
              variant="quiet"
              size="sm"
              iconOnly
              icon="chevron-left"
              aria-label="The one before that waits"
              shortcut="←"
              disabled={index === 0}
              onClick={() => onMove(-1)}
            />
            <Button
              variant="quiet"
              size="sm"
              iconOnly
              icon="chevron-right"
              aria-label="The next one that waits"
              shortcut="→"
              onClick={() => onMove(1)}
            />
          </div>
        </div>
        <div className="ui-qa-fit">
          <div className="ui-qa-shot" data-format={item.format}>
            <figure
              className="ui-qa-creative"
              data-format={item.format}
              data-pinnable={pinnable ? "" : undefined}
              style={ink ? vars({ "--layer-ink": ink }) : undefined}
              onClick={dropPin}
              title={pinnable ? "Click to pin a note" : undefined}
            >
              <img src={image} alt={`${name}, version ${version}`} draggable={false} />
              {!before &&
                (item.layers ?? [])
                  .filter((l) => l.visible && (l.kind === "text" || l.kind === "logo"))
                  .map((l) => (
                    <span
                      key={l.id}
                      className="ui-qa-layer"
                      data-kind={l.kind}
                      data-style={l.style}
                      data-active={active === l.id ? "" : undefined}
                      style={layerBox(l)}
                      aria-hidden="true"
                    >
                      {l.kind === "logo" ? workspace.brandName : (words[l.id] ?? l.text)}
                    </span>
                  ))}
            </figure>
            {!before &&
              pins.map((p) => (
                <button
                  key={p.n}
                  type="button"
                  className={activePin === p.n ? "ui-qg-pin is-active" : "ui-qg-pin"}
                  style={pinStyle(p)}
                  aria-label={`Pin ${p.n}: ${p.text}`}
                  title={p.text}
                  onClick={() => setActivePin(activePin === p.n ? undefined : p.n)}
                >
                  {p.n}
                </button>
              ))}
            {draft && (
              <>
                <span className="ui-qg-pin" data-state="draft" style={pinStyle(draft)} aria-hidden="true">
                  {pins.length + 1}
                </span>
                <Glass
                  className="ui-qa-pinbox"
                  style={pinStyle(draft)}
                  data-side={draft.side}
                  data-flip-y={draft.flipY ? "" : undefined}
                  role="group"
                  aria-label={`Pin ${pins.length + 1}`}
                >
                  <Textarea
                    autoFocus
                    rows={2}
                    aria-label={`What is wrong here, pin ${pins.length + 1}`}
                    placeholder="What is wrong here?"
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        addPin();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        e.stopPropagation();
                        setDraft(null);
                      }
                    }}
                  />
                  <div className="ui-qa-pinbox-foot">
                    <Button size="sm" variant="glass-clear" onClick={() => setDraft(null)}>
                      Cancel
                    </Button>
                    <Button size="sm" variant="glass-white" disabled={!draftText.trim()} onClick={addPin}>
                      Pin it
                    </Button>
                  </div>
                </Glass>
              </>
            )}
          </div>
        </div>
      </section>

      <aside className="ui-qa-panel" aria-label={`Check ${name}`}>
        <div className="ui-qa-panel-body">
          {/* 1. Where it stands */}
          <header className="ui-qa-head">
            <h2 className="ui-qa-title">{name}</h2>
            <p className="ui-qa-sub">{[workspace.brandName, campaign.name, formatName(item.format)].join(" · ")}</p>
            <p className="ui-qa-state" aria-live="polite">
              <QaStatus item={item} who={names.who} />
            </p>
            {item.state !== "checked" && (
              <div className="ui-qa-badges">
                {item.risk === "high" && <Badge variant="ink">High risk</Badge>}
                <Badge icon="clock">
                  Due {due(item.dueAt)}, {time(item.dueAt)}
                </Badge>
              </div>
            )}
          </header>

          {/* 2. What the Engine found */}
          <Evaluated
            evaluation={item.evaluation}
            id={item.id}
            against={view.against}
            format={item.format}
            brandDna={campaign.brandDnaVersion}
          >
            {/* 2b. What was said to the Engine before: one folded line, so it never sits under the decision */}
            {item.feedback.length > 0 && (
              <Collapsible className="ui-qa-against">
                <CollapsibleTrigger>{`Said to the Engine · ${item.feedback.length}`}</CollapsibleTrigger>
                <CollapsibleContent>
                  <ol className="ui-qa-history" aria-label="Said to the Engine">
                    {item.feedback.map((f) => (
                      <li key={f.id} className="ui-qa-said">
                        <span className="ui-qa-said-who">
                          {names.Who(f.by)} · <time dateTime={f.at}>{time(f.at)}</time> ·{" "}
                          {f.state === "sent" ? "with the Engine" : "the Engine fixed it"}
                        </span>
                        {f.text && <p>{f.text}</p>}
                        {(f.pins ?? []).map((p) => (
                          <p key={p.n} className="ui-qa-said-pin">
                            <span className="ui-qa-pin-num" aria-hidden="true">
                              {p.n}
                            </span>
                            <span>{p.text}</span>
                          </p>
                        ))}
                      </li>
                    ))}
                  </ol>
                </CollapsibleContent>
              </Collapsible>
            )}
          </Evaluated>

          {/* 3. A design's words, changed right here */}
          {textLayers.length > 0 && !checked && (
            <section className="ui-qa-part" aria-labelledby={`${item.id}-words`}>
              <h3 className="ui-qa-part-title" id={`${item.id}-words`}>
                Words on the creative
              </h3>
              <FieldGroup>
                {textLayers.map((l) => (
                  <Field key={l.id}>
                    <FieldLabel htmlFor={`${item.id}-${l.id}`}>{l.name}</FieldLabel>
                    <Input
                      id={`${item.id}-${l.id}`}
                      value={words[l.id] ?? l.text ?? ""}
                      onChange={(e) => setWords((w) => ({ ...w, [l.id]: e.target.value }))}
                      onFocus={() => setActive(l.id)}
                      onBlur={() => setActive(undefined)}
                      onKeyDown={(e) => e.key === "Escape" && e.currentTarget.blur()}
                    />
                  </Field>
                ))}
              </FieldGroup>
              {dirty && (
                <div className="ui-qa-tell-foot">
                  <FieldDescription>Not changed yet. Mark checked changes them too.</FieldDescription>
                  <div className="ui-app-row">
                    <Button variant="quiet" size="sm" onClick={() => setWords({})}>
                      Undo
                    </Button>
                    <Button variant="secondary" size="sm" loading={edit.isPending} onClick={() => saveWords()}>
                      Change the words
                    </Button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* 4. Tell the Engine: words, and the pins on the creative */}
          {!checked && (
            <section className="ui-qa-part" aria-labelledby={`${item.id}-tell`}>
              <h3 className="ui-qa-part-title" id={`${item.id}-tell`}>
                Tell the Engine
              </h3>
              {pins.length > 0 && (
                <ol className="ui-qa-pins" aria-label="Pinned notes">
                  {pins.map((p) => (
                    <li key={p.n} className="ui-qa-pin-row" data-active={activePin === p.n ? "" : undefined}>
                      <span className="ui-qa-pin-num" aria-hidden="true">
                        {p.n}
                      </span>
                      <span className="ui-qa-pin-text">{p.text}</span>
                      <Button
                        size="sm"
                        variant="quiet"
                        iconOnly
                        icon="x"
                        aria-label={`Remove pin ${p.n}`}
                        onClick={() => removePin(p.n)}
                      />
                    </li>
                  ))}
                </ol>
              )}
              <Textarea
                ref={tellRef}
                aria-labelledby={`${item.id}-tell`}
                placeholder={
                  pins.length ? "Anything else, in words" : "What is wrong? Or click the creative to pin it."
                }
                value={text}
                disabled={fixing}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    tell();
                  }
                  if (e.key === "Escape") e.currentTarget.blur();
                }}
              />
              {item.studio === "render" && !fixing && (
                <Button
                  className="ui-qa-chip"
                  variant="quiet"
                  size="sm"
                  icon="package"
                  onClick={() => {
                    setText((t) => (t.trim() ? t : "Fix with the real product: "));
                    requestAnimationFrame(() => {
                      const el = tellRef.current;
                      el?.focus();
                      el?.setSelectionRange(el.value.length, el.value.length);
                    });
                  }}
                >
                  Fix with the real product
                </Button>
              )}
            </section>
          )}
        </div>

        {/* 5. The decision, at the same place for every creative */}
        <footer className="ui-qa-foot" data-ui-foot>
          {checked ? (
            <>
              <div className="ui-qa-foot-row">
                <Button variant="secondary" icon="undo-2" loading={act.undoing} onClick={() => void act.undo(view)}>
                  Undo the check
                </Button>
              </div>
            </>
          ) : (
            <>
              <Button
                className="ui-qa-foot-main ui-qa-mark"
                icon="fume-check"
                onClick={markChecked}
                disabled={fixing}
                loading={act.checking}
              >
                Mark checked
                <Kbd className="ui-qa-key">C</Kbd>
              </Button>
              <div className="ui-qa-foot-row">
                <Button
                  variant="secondary"
                  size="sm"
                  icon="send"
                  disabled={fixing}
                  loading={act.telling}
                  onClick={() => tell()}
                >
                  {pins.length ? `Tell the Engine · ${pins.length}` : "Tell the Engine"}
                  <Kbd className="ui-qa-key">F</Kbd>
                </Button>
                <Button
                  variant="quiet"
                  size="sm"
                  icon="external-link"
                  loading={toStudio.isPending}
                  onClick={openStudio}
                >
                  Open in Studio
                  <Kbd className="ui-qa-key">S</Kbd>
                </Button>
              </div>
            </>
          )}
          {latest?.state === "sent" && fixing && (
            <p className="ui-qa-foot-note">
              <TextShimmer>The Engine is fixing it</TextShimmer>
            </p>
          )}
          <AlertDialog open={asking} onOpenChange={setAsking}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {names.Who(item.studioBy)} {names.who(item.studioBy) === "you" ? "have" : "has"} this open in the
                  Studio
                </AlertDialogTitle>
                <AlertDialogDescription>
                  The Engine and a designer never work on one creative at once. Send it to the Engine and the Studio
                  locks until the fix is back, or wait until it comes back from the Studio.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Wait</AlertDialogCancel>
                <AlertDialogAction variant="white" icon="send" onClick={() => tell(true)}>
                  Send to the Engine
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </footer>
      </aside>
    </>
  );
}

/** Where it stands, in one line, updated in place. */
function QaStatus({ item, who }: { item: QaItem; who: (id?: Id) => string }) {
  if (item.state === "checked")
    return (
      <CheckMark
        state="checked"
        by={who(item.checkedBy)}
        time={item.checkedAt ? time(item.checkedAt) : undefined}
        dateTime={item.checkedAt}
        wording="long"
      />
    );
  if (item.state === "fixing") {
    const said = item.feedback.at(-1);
    return (
      <>
        <TextShimmer>With the Engine</TextShimmer>
        {said?.text
          ? `: “${said.text.replace(/[.\s]+$/, "")}”`
          : said?.pins?.length
            ? `: ${copy.count(said.pins.length, "pinned note")}`
            : ""}
      </>
    );
  }
  if (item.state === "in_studio")
    return (
      <>{`In Studio with ${who(item.studioBy)}${item.studioAt ? ` since ${time(item.studioAt)}` : ""}. Send it back from the Studio, or check this version.`}</>
    );
  if (item.sentAt)
    return (
      <>{`${(item.version ?? 1) > 1 ? `Version ${item.version} from the Studio` : "Back from the Studio"} · ${who(item.sentBy)}, ${time(item.sentAt)}`}</>
    );
  if (item.feedback.at(-1)?.state === "fixed") return <>The Engine’s fix is back. Check it again.</>;
  return <>Waiting for a check</>;
}

/** The Engine's own evaluation of what it made, in words, and what it is checked against (the per-rule list, read-only,
 *  folded). */
function Evaluated({
  evaluation,
  id,
  against,
  format,
  brandDna,
  children,
}: {
  evaluation: Evaluation;
  id: string;
  against: QaView["against"];
  format: QaItem["format"];
  brandDna?: number;
  /** Folds that belong with the findings (what was said to the Engine), 8 under them rather than 24. */
  children?: ReactNode;
}) {
  const rows: { result: "pass" | "flag"; text: string }[] = [
    {
      result: evaluation.productTruth,
      text: evaluation.productTruth === "pass" ? "Product Truth holds" : "Product Truth is off",
    },
    {
      result: evaluation.brandRules,
      text: evaluation.brandRules === "pass" ? "Brand rules hold" : "A brand rule is broken",
    },
    {
      result: evaluation.artefacts === "none" ? "pass" : "flag",
      text:
        evaluation.artefacts === "none"
          ? "No artefacts"
          : evaluation.artefacts === "minor"
            ? "A minor artefact"
            : "A major artefact",
    },
    ...evaluation.notes.map((n) => ({ result: "flag" as const, text: n })),
  ];
  const flagged = rows.filter((r) => r.result === "flag").length;
  const f = copy.format[format];
  // The channel line follows the creative's own format (the brand's list is written for a feed).
  const lines = (against ?? []).map((a) =>
    a.area === "channel" ? { ...a, against: `${f.label} ${f.size}; nothing important in the outer 6 %.` } : a,
  );
  return (
    <section className="ui-qa-part" aria-labelledby={`${id}-found`}>
      <h3 className="ui-qa-part-title" id={`${id}-found`}>
        What the Engine found {flagged ? `· ${copy.count(flagged, "flag")}` : "· nothing flagged"}
      </h3>
      <ul className="ui-qa-notes">
        {rows.map((r, i) => (
          <li key={i} className="ui-qa-note" data-result={r.result}>
            <Icon name={r.result === "pass" ? "circle-check" : "circle-alert"} />
            {r.text}
          </li>
        ))}
      </ul>
      {lines.length > 0 && (
        <Collapsible className="ui-qa-against">
          <CollapsibleTrigger>
            {brandDna ? `Checked against Brand DNA v${brandDna}` : "What it is checked against"}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <dl className="ui-qa-against-list">
              {lines.map((a) => (
                <div key={a.area + a.label} className="ui-qa-against-row">
                  <dt>{a.label}</dt>
                  <dd>{a.against}</dd>
                </div>
              ))}
            </dl>
          </CollapsibleContent>
        </Collapsible>
      )}
      {children}
    </section>
  );
}

// ─── The end of the queue ─────────────────────────────────────────────────

function QaEnd({
  frame,
  workspaceId,
  brand,
  only,
  kindLabel,
  otherKinds = [],
  beside,
  waiting,
  fixing,
  plans,
  onFirst,
  onShowAll,
}: {
  frame: StaffFrameKind;
  workspaceId?: Id;
  brand?: string;
  /** One run or one campaign shown: "This run", "Autumn launch". */
  only?: string;
  /** The tab that is done while other tabs still wait: "Images". */
  kindLabel?: string;
  /** The other tabs with something waiting, first in "Next". */
  otherKinds?: { key: string; title: string; text: string; to: string; action: string }[];
  /** Then: how many others wait for a check here. */
  beside: number;
  waiting: QaView[];
  fixing: number;
  plans: StudioCampaignRow[];
  onFirst: () => void;
  onShowAll: () => void;
}) {
  // What waits elsewhere: the other brands' (or clients') creatives, from the whole queue.
  const all = useQaQueue(undefined).data ?? [];
  const elsewhere = useMemo(() => {
    const map = new Map<Id, QaView[]>();
    for (const v of all)
      if (open(v) && v.workspace.id !== workspaceId && workspaceId)
        map.set(v.workspace.id, [...(map.get(v.workspace.id) ?? []), v]);
    return [...map.values()];
  }, [all, workspaceId]);
  const plansLeft = plans.filter((r) => r.campaign.waits?.plan === "in_check");
  const nexts: { key: string; title: string; text: string; to: string; action: string }[] = [
    ...otherKinds,
    ...(otherKinds.some((k) => k.key === "kind-plans") ? [] : plansLeft).map((r) => ({
      key: r.campaign.id,
      title: `${r.campaign.name} · the plan`,
      text: [workspaceId ? undefined : r.workspace.brandName, "Fume wrote it; it waits on your check"]
        .filter(Boolean)
        .join(" · "),
      to: planPath(frame, r),
      action: "Check the plan",
    })),
    ...elsewhere.map((list) => {
      const v = list[0]!;
      const campaigns = [...new Set(list.map((x) => x.campaign.name))];
      return {
        key: v.workspace.id,
        title: `${v.workspace.brandName} · ${campaigns.join(", ")}`,
        text: `${copy.creatives(list.length)} to check`,
        to: checkPath(frame, v.workspace.id),
        action: `Check ${v.workspace.brandName}`,
      };
    }),
  ];
  const [first, ...rest] = nexts;

  if (waiting.length > 0)
    return (
      <section className="ui-qa-end" aria-labelledby="qa-end-title" data-ui-toast-anchor>
        <h2 className="ui-qa-end-title" id="qa-end-title" tabIndex={-1}>
          {waiting.length === 1 ? "One still waits for a check" : `${waiting.length} still wait for a check`}
        </h2>
        <p className="ui-qa-end-text">You went past the last one. The ones above you skipped still wait.</p>
        <div className="ui-qa-end-actions">
          <Button iconEnd="arrow-right" onClick={onFirst}>
            Go to the first
          </Button>
        </div>
      </section>
    );

  const title = kindLabel
    ? `${kindLabel} are checked`
    : only
      ? `${only} is checked`
      : brand
        ? `${brand} is checked`
        : "Everything is checked";
  if (only && beside > 0)
    return (
      <section className="ui-qa-end" aria-labelledby="qa-end-title" data-ui-toast-anchor>
        <Icon name="circle-check" className="ui-qa-end-icon" />
        <h2 className="ui-qa-end-title" id="qa-end-title" tabIndex={-1}>
          {title}
        </h2>
        <p className="ui-qa-end-text">{`${copy.count(beside, "more creative", "more creatives")} ${beside === 1 ? "waits" : "wait"} for a check ${brand ? `in ${brand}` : "here"}.`}</p>
        <div className="ui-qa-end-actions">
          <Button iconEnd="arrow-right" onClick={onShowAll}>
            Show all
          </Button>
        </div>
      </section>
    );
  const engine = fixing
    ? ` ${fixing === 1 ? "One is" : `${fixing} are`} with the Engine; ${fixing === 1 ? "its fix comes" : "their fixes come"} back here.`
    : "";
  return (
    <section className="ui-qa-end" aria-labelledby="qa-end-title" data-ui-toast-anchor>
      <Icon name="circle-check" className="ui-qa-end-icon" />
      <h2 className="ui-qa-end-title" id="qa-end-title" tabIndex={-1}>
        {title}
      </h2>
      <p className="ui-qa-end-text">
        {(first ? "Nothing else waits for a check here." : "Nothing else waits on you.") + engine}
      </p>
      {first ? (
        <>
          <ul className="ui-qa-end-next" aria-label="Next">
            <li className="ui-qa-end-first">
              <span className="ui-qa-end-eyebrow">Next</span>
              <span className="ui-qa-end-name">{first.title}</span>
              <span className="ui-qa-end-line">{first.text}</span>
              <Button asChild iconEnd="arrow-right">
                <Link to={first.to}>{first.action}</Link>
              </Button>
            </li>
          </ul>
          {rest.length > 0 && (
            <ItemGroup as="ul" aria-label="Then">
              {rest.map((n) => (
                <Item key={n.key} as="li" asChild className="ui-qa-row">
                  <Link to={n.to}>
                    <ItemContent>
                      <ItemTitle>{n.title}</ItemTitle>
                      <ItemDescription>{n.text}</ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <Icon name="chevron-right" />
                    </ItemActions>
                  </Link>
                </Item>
              ))}
            </ItemGroup>
          )}
        </>
      ) : (
        <div className="ui-qa-end-actions">
          {only ? (
            <Button variant="secondary" onClick={onShowAll}>
              Show all
            </Button>
          ) : (
            <Button asChild variant="secondary" iconEnd="arrow-right">
              <Link to={frameRoot[frame]}>Overview</Link>
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

/** A layer's box on the creative, 0–1 of the frame: data for the stylesheet. */
const layerBox = (l: Layer) => ({ "--x": l.x, "--y": l.y, "--w": l.w, "--h": l.h }) as CSSProperties;
