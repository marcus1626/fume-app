// The calendar's parts (calendar-plan.css): the month and the week (weeks of seven days with campaign bars across
// them), the agenda list, the "Ready to plan" tray, and the creative that follows the pointer while it is dragged.
// Round 8 (LOAD-18, WAY-19, MOB-23): every creative under its customer name; a delivery opens that delivery; a finger
// reads "Tap".
// Round 9 (desktop review 19 Oct, DLAY-14, DLOAD-16; PROPOSED 19 Oct 2026): a planned creative on a day shows its
// thumbnail, its short unique name ("Night Body Oil · Feed A2", review/names.ts) on up to two lines, and the time; the
// placement is in its tooltip and its name for screen readers. The tray has no Plan pill per creative: a creative is
// dragged onto a day, or clicked to pick its day. Each campaign starts closed as one row, "Autumn launch · 2 to plan".
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Icon,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
  useTouch,
  type IconName,
} from "@fume/ui";
import { useMemo, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { Link } from "react-router-dom";
import { useCampaign } from "../../api/hooks";
import type { CalendarEntry, Campaign, Creative, Id, Placement } from "../../contract";
import * as copy from "../../copy";
import { Nothing } from "../../shell/Page";
import { useCustomerNames } from "../review/names";
import {
  addDays,
  between,
  clock,
  dateShort,
  dayNumber,
  dayOf,
  dayTitle,
  sameMonth,
  weekdayShort,
  type Day,
} from "./dates";
import type { DragPayload, DragState } from "./drag";
import type { PlanTarget } from "./plan";

export interface CalendarActions {
  canPlan: boolean;
  /** A desk with a mouse: posts and tray creatives drag. */
  canDrag: boolean;
  today: Day;
  placementOf: Map<Id, Placement>;
  /** The day under a drag. */
  over: Day | null;
  /** The post being dragged (it fades where it was). */
  dragging: Id | null;
  startDrag: (event: ReactPointerEvent<HTMLElement>, payload: DragPayload) => void;
  /** An entry's name: a planned creative as she approved it ("Night Body Oil · Feed"), the rest as they are. */
  nameOf: (entry: CalendarEntry) => string;
  /** Where a delivery on a day goes: that delivery. */
  deliveryHref: (entry: CalendarEntry) => string;
  openEntry: (entry: CalendarEntry) => void;
  openCreative: (target: PlanTarget) => void;
  showDay: (day: Day) => void;
}

const vars = (v: Record<string, string | number>) => v as CSSProperties;

const kindIcon: Record<Exclude<CalendarEntry["kind"], "campaign" | "post">, IconName> = {
  drop: "tag",
  delivery: "download",
  meeting: "users",
};

/** Entries by their Oslo day, campaigns apart (they span days). */
function sortEntries(entries: CalendarEntry[]) {
  const spans = entries.filter((e) => e.kind === "campaign");
  const byDay = new Map<Day, CalendarEntry[]>();
  for (const e of entries) {
    if (e.kind === "campaign") continue;
    const d = dayOf(e.start);
    byDay.set(d, [...(byDay.get(d) ?? []), e]);
  }
  for (const list of byDay.values()) list.sort((a, b) => a.start.localeCompare(b.start));
  return { spans, byDay };
}

interface Bar {
  entry: CalendarEntry;
  from: number;
  to: number;
  lane: number;
  cutStart: boolean;
  cutEnd: boolean;
}

/** The campaign bars in one week, each on the first free lane. */
function barsFor(weekStart: Day, spans: CalendarEntry[]): Bar[] {
  const weekEnd = addDays(weekStart, 6);
  const lanes: number[] = [];
  return spans
    .map((entry) => ({ entry, s: dayOf(entry.start), e: dayOf(entry.end ?? entry.start) }))
    .filter(({ s, e }) => e >= weekStart && s <= weekEnd)
    .sort((a, b) => a.s.localeCompare(b.s))
    .map(({ entry, s, e }) => {
      const from = Math.max(0, between(weekStart, s));
      const to = Math.min(6, between(weekStart, e));
      let lane = lanes.findIndex((end) => end < from);
      if (lane === -1) lane = lanes.length;
      lanes[lane] = to;
      return { entry, from, to, lane, cutStart: s < weekStart, cutEnd: e > weekEnd };
    });
}

// ─── Month and week ──────────────────────────────────────────────────────────

export function MonthGrid({
  start,
  end,
  month,
  entries,
  actions,
}: {
  start: Day;
  end: Day;
  month: Day;
  entries: CalendarEntry[];
  actions: CalendarActions;
}) {
  const { spans, byDay } = useMemo(() => sortEntries(entries), [entries]);
  const weeks: Day[] = [];
  for (let w = start; w <= end; w = addDays(w, 7)) weeks.push(w);
  return (
    <div className="ui-plan-cal" data-view="month">
      <div className="ui-plan-weekdays" aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i}>{weekdayShort(addDays(start, i))}</span>
        ))}
      </div>
      {weeks.map((w) => (
        <Week key={w} start={w} spans={spans} byDay={byDay} month={month} limit={3} actions={actions} />
      ))}
    </div>
  );
}

export function WeekGrid({
  start,
  entries,
  actions,
}: {
  start: Day;
  entries: CalendarEntry[];
  actions: CalendarActions;
}) {
  const { spans, byDay } = useMemo(() => sortEntries(entries), [entries]);
  return (
    <div className="ui-plan-cal" data-view="week">
      <Week start={start} spans={spans} byDay={byDay} actions={actions} named />
    </div>
  );
}

function Week({
  start,
  spans,
  byDay,
  month,
  limit,
  named,
  actions,
}: {
  start: Day;
  spans: CalendarEntry[];
  byDay: Map<Day, CalendarEntry[]>;
  month?: Day;
  limit?: number;
  named?: boolean;
  actions: CalendarActions;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const bars = barsFor(start, spans);
  const lanes = bars.reduce((n, b) => Math.max(n, b.lane + 1), 0);
  return (
    <div className="ui-plan-week" style={vars({ "--plan-rows": lanes + 2, "--plan-items-row": lanes + 2 })}>
      {days.map((d, i) => (
        <div
          key={`cell-${d}`}
          className="ui-plan-day"
          data-day={d}
          data-today={d === actions.today ? "" : undefined}
          data-outside={month && !sameMonth(d, month) ? "" : undefined}
          data-over={actions.over === d ? "" : undefined}
          style={vars({ "--plan-col": i + 1 })}
          aria-hidden="true"
        />
      ))}
      {days.map((d, i) => (
        <div
          key={`date-${d}`}
          className="ui-plan-date"
          data-today={d === actions.today ? "" : undefined}
          data-outside={month && !sameMonth(d, month) ? "" : undefined}
          style={vars({ "--plan-col": i + 1 })}
        >
          {named && <span className="ui-plan-date-day">{weekdayShort(d)}</span>}
          <span className="ui-plan-date-number">{dayNumber(d)}</span>
          {d === actions.today && <span className="ui-plan-sr">Today</span>}
        </div>
      ))}
      {bars.map((b) => (
        <Link
          key={`bar-${b.entry.id}`}
          className="ui-plan-span"
          to={`/campaigns/${b.entry.campaignId}`}
          data-cut-start={b.cutStart ? "" : undefined}
          data-cut-end={b.cutEnd ? "" : undefined}
          style={vars({ "--plan-from": b.from + 1, "--plan-to": b.to + 2, "--plan-lane": b.lane + 2 })}
          aria-label={`${b.entry.title}, campaign, ${dateShort(dayOf(b.entry.start))} to ${dateShort(dayOf(b.entry.end ?? b.entry.start))}`}
        >
          <span>{b.entry.title}</span>
        </Link>
      ))}
      {days.map((d, i) => {
        const list = byDay.get(d) ?? [];
        const shown = limit ? list.slice(0, list.length > limit ? limit - 1 : limit) : list;
        const more = list.length - shown.length;
        return (
          <div key={`items-${d}`} className="ui-plan-items" style={vars({ "--plan-col": i + 1 })}>
            {list.length > 0 && (
              <ul aria-label={dayTitle(d)}>
                {shown.map((e) => (
                  <li key={e.id}>
                    <EntryChip entry={e} actions={actions} large={named} />
                  </li>
                ))}
              </ul>
            )}
            {more > 0 && (
              <button type="button" className="ui-plan-more" onClick={() => actions.showDay(d)}>
                {more} more
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** One thing on a day: a planned post (its creative and placement), a meeting, a drop or a delivery. */
function EntryChip({ entry, actions, large }: { entry: CalendarEntry; actions: CalendarActions; large?: boolean }) {
  if (entry.kind === "post") {
    const placement = actions.placementOf.get(entry.placementId ?? "");
    const where = placement?.name ?? "A placement";
    const title = actions.nameOf(entry);
    // The part that tells it apart leads ("Feed A2"), what it shows follows ("Night Body Oil"), so a narrow day never
    // cuts the one word that makes the name unique (DLOAD-16). The whole name and the placement are in the tooltip.
    const parts = title.split(" · ");
    const short = parts.length > 1 ? parts[parts.length - 1]! : title;
    const subject = parts.length > 1 ? parts.slice(0, -1).join(" · ") : undefined;
    const body = (
      <>
        {entry.image && (
          <img
            className="ui-plan-post-media"
            src={entry.image}
            alt=""
            draggable={false}
            data-ratio={placement?.format}
          />
        )}
        <span className="ui-plan-post-text">
          <span className="ui-plan-post-title">{short}</span>
          {subject && <span className="ui-plan-post-subject">{subject}</span>}
          <span className="ui-plan-post-meta">
            <time className="ui-plan-post-time" dateTime={entry.start}>
              {clock(entry.start)}
            </time>
            {large && <span className="ui-plan-post-where"> · {where}</span>}
          </span>
        </span>
      </>
    );
    const label = `${title} on ${where}, ${dayTitle(dayOf(entry.start))} at ${clock(entry.start)}`;
    if (!actions.canPlan)
      return (
        <div
          className="ui-plan-post"
          data-size={large ? "lg" : undefined}
          aria-label={label}
          title={`${title}, ${where}`}
        >
          {body}
        </div>
      );
    return (
      <button
        type="button"
        className="ui-plan-post"
        title={`${title}, ${where}`}
        data-size={large ? "lg" : undefined}
        data-dragging={actions.dragging === entry.id ? "" : undefined}
        data-draggable={actions.canDrag ? "" : undefined}
        aria-label={`${label}. Move or change`}
        onPointerDown={
          actions.canDrag
            ? (e) => actions.startDrag(e, { kind: "entry", id: entry.id, image: entry.image, label: title })
            : undefined
        }
        onClick={() => actions.openEntry(entry)}
      >
        {body}
      </button>
    );
  }
  const icon = kindIcon[entry.kind as keyof typeof kindIcon];
  const inner = (
    <>
      <Icon name={icon} />
      <span className="ui-plan-event-text">
        {entry.kind === "meeting" && (
          <time className="ui-plan-event-time" dateTime={entry.start}>
            {clock(entry.start)}
          </time>
        )}
        <span className="ui-plan-event-title">{entry.title}</span>
      </span>
    </>
  );
  if (entry.kind === "delivery")
    return (
      <Link className="ui-plan-event" data-kind={entry.kind} to={actions.deliveryHref(entry)}>
        {inner}
      </Link>
    );
  return (
    <span className="ui-plan-event" data-kind={entry.kind}>
      {inner}
    </span>
  );
}

// ─── Agenda ───────────────────────────────────────────────────────────────────

const kindWord: Record<CalendarEntry["kind"], string> = {
  campaign: "Campaign",
  drop: "Drop",
  delivery: "Delivery",
  post: "Post",
  meeting: "Meeting with Fume",
};

export function Agenda({
  start,
  end,
  entries,
  actions,
}: {
  start: Day;
  end: Day;
  entries: CalendarEntry[];
  actions: CalendarActions;
}) {
  const { spans, byDay } = useMemo(() => sortEntries(entries), [entries]);
  const days = [...byDay.keys()].filter((d) => d >= start && d <= end).sort();
  const running = spans.filter((s) => dayOf(s.end ?? s.start) >= start && dayOf(s.start) <= end);
  if (days.length === 0 && running.length === 0)
    return (
      <Nothing
        icon="calendar"
        title="Nothing planned this month"
        text="Plan an approved creative on a day, or ask Fume to book a meeting."
      />
    );
  return (
    <div className="ui-plan-agenda">
      {running.length > 0 && (
        <section className="ui-plan-agenda-day" aria-labelledby="plan-running">
          <h3 className="ui-plan-agenda-title" id="plan-running">
            Campaigns
          </h3>
          <ItemGroup as="ul">
            {running.map((s) => (
              <Item key={s.id} as="li" size="sm" asChild>
                <Link to={`/campaigns/${s.campaignId}`}>
                  <ItemMedia variant="icon">
                    <Icon name="megaphone" />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{s.title}</ItemTitle>
                    <ItemDescription>
                      {dateShort(dayOf(s.start))} – {dateShort(dayOf(s.end ?? s.start))}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Icon name="chevron-right" />
                  </ItemActions>
                </Link>
              </Item>
            ))}
          </ItemGroup>
        </section>
      )}
      {days.map((d) => (
        <section
          key={d}
          className="ui-plan-agenda-day"
          aria-labelledby={`plan-day-${d}`}
          data-today={d === actions.today ? "" : undefined}
        >
          <h3 className="ui-plan-agenda-title" id={`plan-day-${d}`}>
            {dayTitle(d)}
            {d === actions.today && <span className="ui-plan-agenda-today">Today</span>}
          </h3>
          <ItemGroup as="ul">
            {byDay.get(d)!.map((e) => (
              <AgendaRow key={e.id} entry={e} actions={actions} />
            ))}
          </ItemGroup>
        </section>
      ))}
    </div>
  );
}

function AgendaRow({ entry, actions }: { entry: CalendarEntry; actions: CalendarActions }) {
  const placement = actions.placementOf.get(entry.placementId ?? "");
  const media =
    entry.kind === "post" && entry.image ? (
      <ItemMedia variant="image">
        <img src={entry.image} alt="" draggable={false} />
      </ItemMedia>
    ) : (
      <ItemMedia variant="icon">
        <Icon name={entry.kind === "post" ? "image" : kindIcon[entry.kind as keyof typeof kindIcon]} />
      </ItemMedia>
    );
  const content = (
    <ItemContent>
      <ItemTitle>{entry.kind === "post" ? (placement?.name ?? "A placement") : entry.title}</ItemTitle>
      <ItemDescription>
        {entry.kind === "post" ? actions.nameOf(entry) : kindWord[entry.kind]}
        {entry.kind === "post" || entry.kind === "meeting" ? ` · ${clock(entry.start)}` : ""}
      </ItemDescription>
    </ItemContent>
  );
  if (entry.kind === "post" && actions.canPlan)
    return (
      <Item as="li" size="sm" className="ui-plan-agenda-row">
        <button
          type="button"
          className="ui-plan-agenda-open"
          onClick={() => actions.openEntry(entry)}
          aria-label={`${actions.nameOf(entry)} on ${placement?.name ?? "a placement"} at ${clock(entry.start)}. Move or change`}
        >
          {media}
          {content}
          <ItemActions>
            <Icon name="pencil" />
          </ItemActions>
        </button>
      </Item>
    );
  if (entry.kind === "delivery")
    return (
      <Item as="li" size="sm" asChild>
        <Link to={actions.deliveryHref(entry)}>
          {media}
          {content}
          <ItemActions>
            <Icon name="chevron-right" />
          </ItemActions>
        </Link>
      </Item>
    );
  return (
    <Item as="li" size="sm">
      {media}
      {content}
    </Item>
  );
}

// ─── Ready to plan ──────────────────────────────────────────────────────────

/** Approved creatives, by campaign, to plan on a day. */
export function ReadyTray({
  campaigns,
  entries,
  actions,
  anchor,
}: {
  campaigns: Campaign[];
  entries: CalendarEntry[];
  actions: CalendarActions;
  anchor: Day;
}) {
  const planned = useMemo(() => {
    const n = new Map<Id, number>();
    for (const e of entries) if (e.creativeId) n.set(e.creativeId, (n.get(e.creativeId) ?? 0) + 1);
    return n;
  }, [entries]);
  const open = [...campaigns]
    .filter((c) => c.state !== "closed")
    .sort((a, b) => Number(a.state === "delivered") - Number(b.state === "delivered"));
  const touch = useTouch();
  return (
    <aside className="ui-plan-tray" aria-labelledby="plan-tray-title">
      <div className="ui-plan-tray-head">
        <h2 className="ui-plan-tray-title" id="plan-tray-title">
          Ready to plan
        </h2>
        <p className="ui-plan-tray-text">
          {touch
            ? "Approved creatives. Tap one to pick its day."
            : actions.canDrag
              ? "Approved creatives. Drag one onto a day, or click it to pick the day."
              : "Approved creatives. Click one to pick its day."}
        </p>
      </div>
      {open.map((c) => (
        <TrayGroup key={c.id} campaign={c} planned={planned} actions={actions} anchor={anchor} />
      ))}
      <p className="ui-plan-later">
        <Icon name="info" />
        {/* Round 13 (#38): the channels it publishes to, and Connect for the others, are in the dialog */}
        <span>
          Planned posts go out on the channels you connect: Instagram, Facebook, Meta ads, TikTok and Pinterest.
        </span>
      </p>
    </aside>
  );
}

/** One campaign's approved creatives, closed to one row at first: "Autumn launch · 2 to plan". */
function TrayGroup({
  campaign,
  planned,
  actions,
  anchor,
}: {
  campaign: Campaign;
  planned: Map<Id, number>;
  actions: CalendarActions;
  anchor: Day;
}) {
  const view = useCampaign(campaign.id);
  const named = useCustomerNames(campaign);
  const ready = (view.data?.creatives ?? [])
    .filter((c) => c.current.state === "approved" || c.current.state === "delivered")
    .map(named);
  if (ready.length === 0) return null;
  const toPlan = ready.filter((c) => !planned.get(c.id)).length;
  return (
    <section className="ui-plan-tray-group" aria-label={campaign.name}>
      <Collapsible>
        <h3 className="ui-plan-tray-campaign">
          <CollapsibleTrigger className="ui-plan-tray-toggle">
            <span className="ui-plan-tray-toggle-name">{campaign.name}</span>
            <span className="ui-plan-tray-toggle-meta">{toPlan > 0 ? `${toPlan} to plan` : "All planned"}</span>
          </CollapsibleTrigger>
        </h3>
        <CollapsibleContent>
          <ul className="ui-plan-tray-list">
            {ready.map((c) => (
              <TrayItem key={c.id} creative={c} count={planned.get(c.id) ?? 0} actions={actions} anchor={anchor} />
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}

/** One approved creative: dragged onto a day on a desk, or clicked (tapped) to pick its day in the plan dialog. */
function TrayItem({
  creative,
  count,
  actions,
  anchor,
}: {
  creative: Creative;
  count: number;
  actions: CalendarActions;
  anchor: Day;
}) {
  const payload: DragPayload = {
    kind: "creative",
    id: creative.id,
    image: creative.current.image,
    label: creative.title,
    format: creative.format,
  };
  return (
    <li className="ui-plan-tray-entry">
      <button
        type="button"
        className="ui-plan-item"
        data-draggable={actions.canDrag ? "" : undefined}
        onPointerDown={actions.canDrag ? (e) => actions.startDrag(e, payload) : undefined}
        onClick={() =>
          actions.openCreative({
            creativeId: creative.id,
            title: creative.title,
            image: creative.current.image,
            format: creative.format,
            day: anchor,
          })
        }
        aria-label={`${creative.title}${count > 0 ? `, planned ${count === 1 ? "once" : `${count} times`}` : ""}. Pick its day`}
      >
        <img className="ui-plan-item-media" src={creative.current.image} alt="" draggable={false} />
        <span className="ui-plan-item-text">
          <span className="ui-plan-item-title">{creative.title}</span>
          <span className="ui-plan-item-meta">
            {copy.format[creative.format].ratio}
            {count > 0 ? ` · ${count} planned` : ""}
          </span>
        </span>
      </button>
    </li>
  );
}

/** The creative under the pointer while it is dragged. */
export function DragGhost({ drag }: { drag: DragState }) {
  return (
    <div
      className="ui-plan-ghost"
      style={vars({ "--plan-x": `${drag.x}px`, "--plan-y": `${drag.y}px` })}
      aria-hidden="true"
    >
      {drag.image ? <img src={drag.image} alt="" /> : <Icon name="image" />}
      {drag.over && <span className="ui-plan-ghost-day">{dateShort(drag.over)}</span>}
    </div>
  );
}
