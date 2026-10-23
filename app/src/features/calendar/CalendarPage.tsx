// The content calendar (FLOWS §21, Marcus 15 Oct: "Full kontroll på hva som skal hvor og når"). One view of what runs
// where and when: campaign windows as quiet bars across the days, collection drops, deliveries, meetings with Fume,
// and approved creatives planned on a day and a placement. Month by default or a week on a desk; always the agenda on
// a phone. "Ready to plan" holds the approved creatives, per campaign behind one "Plan 6 creatives" pill: on a desk
// they are dragged onto a day; anywhere, "Plan" opens a small dialog. v1 plans only: publishing to Instagram and Meta
// comes later. ?view=month|week and ?d=YYYY-MM-DD keep the place, so a link (a booked meeting) opens the right day.
// Since the UX review (15 Oct, §2.3) the calendar is a view of Campaigns (/campaigns?show=calendar): CalendarView is
// the calendar without a page, and /calendar sends you there with its day and view kept. Round 8 (WAY-18, LOAD-18):
// Campaigns' one control picks List, Month or Week, so the calendar has no switch of its own; a planned creative is
// named as she approved it ("Night Body Oil · Feed"), and a delivery on a day opens that delivery (WAY-19).
// Round 9 (desktop review 19 Oct, DLAY-14, DLOAD-16; PROPOSED 19 Oct 2026): the calendar takes the inset's full width
// (Campaigns gives its page .ui-plan-page), "Ready to plan" is a 300 px panel on the right that scrolls by itself, and
// a planned creative carries its short unique name, "Night Body Oil · Feed A2" (review/names.ts), so two Feeds of one
// product are told apart on the day. A creative in the tray is dragged onto a day, or clicked to pick its day.
import { Button, PageHeader, useNarrowScreen, useToast } from "@fume/ui";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  useCalendar,
  useCampaignViews,
  useCampaigns,
  useCatalogue,
  useDeliveries,
  useMoveEntry,
  usePlacements,
  useSchedule,
  useSession,
} from "../../api/hooks";
import type { CalendarEntry, Placement } from "../../contract";
import { now } from "../../lib/time";
import { campaignSubject, creativeLabels, customerName } from "../review/names";
import { Page, Query } from "../../shell/Page";
import {
  addDays,
  addMonths,
  clock,
  dayOf,
  dayShort,
  endOfMonth,
  instant,
  isDay,
  monthTitle,
  startOfMonth,
  startOfWeek,
  weekTitle,
  type Day,
} from "./dates";
import { useCalendarDrag, type DragPayload } from "./drag";
import { Agenda, DragGhost, MonthGrid, ReadyTray, WeekGrid, type CalendarActions } from "./parts";
import { DEFAULT_TIME, defaultPlacement, PlanDialog, type PlanTarget } from "./plan";

type View = "month" | "week" | "agenda";

function rangeOf(view: View, anchor: Day): { start: Day; end: Day; title: string } {
  if (view === "week") {
    const start = startOfWeek(anchor);
    return { start, end: addDays(start, 6), title: weekTitle(start) };
  }
  const first = startOfMonth(anchor);
  const last = endOfMonth(anchor);
  if (view === "agenda") return { start: first, end: last, title: monthTitle(anchor) };
  return {
    start: startOfWeek(first),
    end: addDays(startOfWeek(last), 6),
    title: monthTitle(anchor),
  };
}

/** The calendar itself, for a page that has its own header (Campaigns). Other search params on the address stay. */
export function CalendarView() {
  const [params, setParams] = useSearchParams();
  const phone = useNarrowScreen("(max-width: 767px)");
  const session = useSession().data!;
  const today = dayOf(now());
  const asked = params.get("d");
  const anchor: Day = isDay(asked) ? asked : today;
  const chosen: View = params.get("view") === "week" ? "week" : "month";
  const view: View = phone ? "agenda" : chosen;
  const range = rangeOf(view, anchor);

  const calendar = useCalendar(instant(range.start), instant(addDays(range.end, 1)));
  const placements = usePlacements();
  const campaigns = useCampaigns();
  const schedule = useSchedule();
  const move = useMoveEntry();
  const toast = useToast();
  const [plan, setPlan] = useState<PlanTarget | null>(null);

  const staff = Boolean(session.user.staffRole);
  const canPlan = staff || session.role === "owner" || session.role === "approver" || session.role === "member";
  const entries = calendar.data ?? [];
  const placementOf = useMemo(() => new Map((placements.data ?? []).map((p) => [p.id, p])), [placements.data]);
  const deliveries = useDeliveries();
  const catalogue = useCatalogue();
  // A planned creative under the name she approved it by, short and unique: what it shows, and which one it is
  // ("Night Body Oil · Feed A2", DLOAD-16). The labels come from each planned campaign's creatives.
  const postCampaigns = useMemo(
    () => [...new Set(entries.filter((e) => e.kind === "post" && e.campaignId).map((e) => e.campaignId!))].sort(),
    [entries],
  );
  const views = useCampaignViews(postCampaigns);
  const labels = useMemo(() => {
    const all = new Map<string, string>();
    for (const v of views.data ?? []) for (const [id, l] of creativeLabels(v.creatives, v.directions)) all.set(id, l);
    return all;
  }, [views.data]);
  const nameOf = (e: CalendarEntry) => {
    if (e.kind !== "post") return e.title;
    const what = campaignSubject(
      campaigns.data?.find((c) => c.id === e.campaignId),
      catalogue.data?.products,
    );
    const format = placementOf.get(e.placementId ?? "")?.format;
    const label = labels.get(e.creativeId ?? "");
    if (!what) return e.title;
    return format ? customerName(what, format, label) : label ? `${what} · ${label}` : what;
  };
  // A delivery on a day opens that delivery: the campaign's one made nearest that day.
  const deliveryHref = (e: CalendarEntry) => {
    const near = (deliveries.data ?? [])
      .filter((d) => d.campaignId === e.campaignId)
      .sort(
        (a, b) =>
          Math.abs(Date.parse(a.createdAt) - Date.parse(e.start)) -
          Math.abs(Date.parse(b.createdAt) - Date.parse(e.start)),
      )[0];
    return near ? `/deliveries/${near.id}` : "/deliveries";
  };

  const go = (next: { view?: View; d?: Day }) => {
    const v = next.view ?? chosen;
    const d = next.d ?? anchor;
    const out = new URLSearchParams(params);
    out.delete("view");
    out.delete("d");
    if (v !== "month") out.set("view", v);
    if (d !== today) out.set("d", d);
    setParams(out, { replace: true });
  };
  const step = (n: number) => go({ d: view === "week" ? addDays(anchor, 7 * n) : addMonths(anchor, n) });

  const drop = (payload: DragPayload, day: Day) => {
    const list = placements.data ?? [];
    if (payload.kind === "creative") {
      const placement = defaultPlacement(list, payload.format);
      if (!placement) return;
      schedule.mutate(
        {
          creativeId: payload.id,
          placementId: placement.id,
          at: instant(day, DEFAULT_TIME),
        },
        {
          onSuccess: (entry) =>
            toast.done(`Planned: ${payload.label}`, {
              description: `${placement.name}, ${dayShort(day)} at ${DEFAULT_TIME}.`,
              action: {
                label: "Change",
                onClick: () =>
                  setPlan({
                    creativeId: payload.id,
                    title: payload.label,
                    image: payload.image,
                    format: payload.format,
                    entry,
                  }),
              },
            }),
          onError: () => toast.error("It wasn’t planned. Try again in a moment."),
        },
      );
      return;
    }
    const entry = entries.find((e) => e.id === payload.id);
    if (!entry || dayOf(entry.start) === day) return;
    const before = entry.start;
    move.mutate(
      { entryId: entry.id, at: instant(day, clock(entry.start)) },
      {
        onSuccess: () =>
          toast.done(`Moved to ${dayShort(day)}`, {
            description: `${nameOf(entry)}, ${placementOf.get(entry.placementId ?? "")?.name ?? "the calendar"}.`,
            action: {
              label: "Undo",
              onClick: () => move.mutate({ entryId: entry.id, at: before }),
            },
          }),
        onError: () => toast.error("It didn’t move. Try again in a moment."),
      },
    );
  };
  const { drag, start, wasDrag } = useCalendarDrag(drop);

  const actions: CalendarActions = {
    canPlan,
    canDrag: canPlan && !phone,
    today,
    placementOf,
    over: drag?.over ?? null,
    dragging: drag?.kind === "entry" ? drag.id : null,
    startDrag: start,
    nameOf,
    deliveryHref,
    openEntry: (e: CalendarEntry) => {
      if (wasDrag() || !canPlan || !e.creativeId) return;
      setPlan({
        creativeId: e.creativeId,
        title: nameOf(e),
        image: e.image,
        entry: e,
      });
    },
    openCreative: (target: PlanTarget) => {
      if (!wasDrag()) setPlan(target);
    },
    showDay: (d: Day) => go({ view: "week", d }),
  };

  return (
    <>
      <div className="ui-plan" data-dragging={drag ? "" : undefined}>
        <div className="ui-plan-main">
          <div className="ui-plan-bar">
            <h2 className="ui-plan-period" aria-live="polite">
              {range.title}
            </h2>
            <div className="ui-plan-nav" role="group" aria-label="Move through the calendar">
              <Button
                variant="quiet"
                iconOnly
                icon="chevron-left"
                aria-label={view === "week" ? "Previous week" : "Previous month"}
                onClick={() => step(-1)}
              />
              <Button variant="secondary" size="sm" onClick={() => go({ d: today })} disabled={anchor === today}>
                Today
              </Button>
              <Button
                variant="quiet"
                iconOnly
                icon="chevron-right"
                aria-label={view === "week" ? "Next week" : "Next month"}
                onClick={() => step(1)}
              />
            </div>
          </div>
          <Query query={calendar} loading="Opening the calendar">
            {(list) =>
              view === "month" ? (
                <MonthGrid start={range.start} end={range.end} month={anchor} entries={list} actions={actions} />
              ) : view === "week" ? (
                <WeekGrid start={range.start} entries={list} actions={actions} />
              ) : (
                <Agenda start={range.start} end={range.end} entries={list} actions={actions} />
              )
            }
          </Query>
        </div>
        {canPlan && <ReadyTray campaigns={campaigns.data ?? []} entries={entries} actions={actions} anchor={anchor} />}
      </div>
      {drag && <DragGhost drag={drag} />}
      <PlanDialog
        target={plan}
        placements={(placements.data ?? []) as Placement[]}
        today={today}
        onClose={() => setPlan(null)}
      />
    </>
  );
}

/** The calendar on a page of its own. */
export function CalendarPage() {
  return (
    <Page title="Calendar" className="ui-plan-page">
      <PageHeader title="Calendar" description="What runs where, and when." />
      <CalendarView />
    </Page>
  );
}
