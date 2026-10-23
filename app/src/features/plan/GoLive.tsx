// When each creative goes live (round 13, Marcus's comment #67; PROPOSED 22 Oct 2026): under the plan's steps, a small
// calendar strip of the days the creatives go live (a count on each day that has any), and each creative with its day.
// Who may change the plan changes the days with a date picker (the customer while it is ready; the expert until it is
// approved); "Open the content calendar" goes to the calendar view of Campaigns. A creative with no day of its own goes
// live from the plan's go-live day: the masters on the day, then two variants a day after it.
// Round 13 (#37): the day is @fume/ui's DateField ("Sat 17 Oct 2026" and a glass month), not the browser's date input.
import { Button, DateField, useToast } from "@fume/ui";
import { Link, useLocation } from "react-router-dom";
import { useChangePlan } from "../../api/hooks";
import type { Campaign, CampaignPlan, PlannedCreative } from "../../contract";
import { todayKey } from "../../lib/time";
import { addressBrand, brandBase } from "../../shell/scope";
import { creativesOf, plannedName } from "./words";

const DAY = 86_400_000;
const tz = "Europe/Oslo";
const keyOf = (t: number) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(t);
const dow = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: tz });
const dayNum = new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: tz });
const month = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: tz });
const long = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: tz });
/** A picked day ("2026-11-03") as an instant in the morning of that day in Oslo. */
const fromKey = (key: string) => new Date(`${key}T08:00:00Z`).toISOString();
const noon = (key: string) => Date.parse(`${key}T12:00:00Z`);

/** The plan's go-live day: its "Goes live" step, else the campaign's. */
export const liveOf = (plan: CampaignPlan, campaign: Campaign) => plan.timeline.find((s) => /^goes live/i.test(s.label))?.at ?? campaign.dueAt;

/** Each planned creative with its go-live day: its own, else the masters on the day and two variants a day after. */
export function liveDays(plan: CampaignPlan, campaign: Campaign): { creative: PlannedCreative; at: string }[] {
  const live = liveOf(plan, campaign);
  if (!live) return [];
  const { masters, variants } = creativesOf(plan);
  const base = Date.parse(live);
  return [
    ...masters.map((c) => ({ creative: c, at: c.liveAt ?? live })),
    ...variants.map((c, i) => ({ creative: c, at: c.liveAt ?? new Date(base + (Math.floor(i / 2) + 1) * DAY).toISOString() })),
  ];
}

export function GoLive({ plan, campaign, edit }: { plan: CampaignPlan; campaign: Campaign; edit: boolean }) {
  const { pathname } = useLocation();
  const change = useChangePlan();
  const toast = useToast();
  const rows = liveDays(plan, campaign);
  if (!rows.length) return null;

  // The strip: from the first day a creative goes live, a week at least, three at most.
  const keys = rows.map((r) => keyOf(Date.parse(r.at))).sort();
  const first = noon(keys[0]!);
  const span = Math.min(21, Math.max(7, Math.round((noon(keys[keys.length - 1]!) - first) / DAY) + 1));
  const days = Array.from({ length: span }, (_, i) => first + i * DAY);
  const here = addressBrand(pathname);
  const calendar = `${here ? brandBase(here.frame, here.workspaceId) : ""}/campaigns?show=calendar`;

  const setDay = (c: PlannedCreative, key: string) => {
    if (!key) return;
    change.mutate(
      { campaignId: campaign.id, creativeId: c.id, liveAt: fromKey(key) },
      {
        onSuccess: () => toast.done(`${plannedName(c)} goes live ${long.format(noon(key))}`),
        onError: (e) => toast.error("The day wasn’t changed", { description: e.message }),
      },
    );
  };

  return (
    <div className="ui-plandoc-golive">
      <div className="ui-plandoc-golive-head">
        <h3 className="ui-plandoc-group-title">When each creative goes live</h3>
        <Button asChild variant="quiet" size="sm" icon="calendar">
          <Link to={calendar}>Open the content calendar</Link>
        </Button>
      </div>
      <ol className="ui-plandoc-strip" aria-label="The days the creatives go live">
        {days.map((t, i) => {
          const key = keyOf(t);
          const on = rows.filter((r) => keyOf(Date.parse(r.at)) === key);
          const firstOfMonth = i === 0 || dayNum.format(t) === "1";
          return (
            <li
              key={key}
              className="ui-plandoc-strip-day"
              data-on={on.length ? "" : undefined}
              title={on.length ? on.map((r) => plannedName(r.creative)).join("\n") : undefined}
              aria-label={`${long.format(t)}: ${on.length ? `${on.length} ${on.length === 1 ? "creative goes" : "creatives go"} live` : "nothing goes live"}`}
            >
              <span className="ui-plandoc-strip-dow" aria-hidden="true">
                {dow.format(t)}
              </span>
              <span className="ui-plandoc-strip-date" aria-hidden="true">
                {dayNum.format(t)}
                {firstOfMonth && <span className="ui-plandoc-strip-month"> {month.format(t)}</span>}
              </span>
              <span className="ui-plandoc-strip-count" aria-hidden="true">
                {on.length || ""}
              </span>
            </li>
          );
        })}
      </ol>
      <ul className="ui-plandoc-golive-list" aria-label="Each creative and its day">
        {rows.map(({ creative, at }) => {
          const key = keyOf(Date.parse(at));
          const name = plannedName(creative);
          return (
            <li key={creative.id} className="ui-plandoc-golive-row">
              <span className="ui-plandoc-golive-name">{name}</span>
              {edit ? (
                <DateField
                  size="sm"
                  className="ui-plandoc-golive-date"
                  value={key}
                  today={todayKey()}
                  required
                  aria-label={`The day ${name} goes live`}
                  disabled={change.isPending && change.variables?.creativeId === creative.id}
                  onChange={(next) => setDay(creative, next)}
                />
              ) : (
                <time className="ui-plandoc-golive-when" dateTime={at}>
                  {long.format(Date.parse(at))}
                </time>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
