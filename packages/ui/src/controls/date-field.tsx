// DateField and TimeField (design-system/components/date-field.css; the month is calendar.css's glass calendar).
// Round 13 (Marcus's comment #37, "Feil tekst markerings farge"; PROPOSED 22 Oct 2026): the browser's own date and
// time inputs lit the part being edited in the system's blue (no author CSS reaches it) and wrote US dates and 12-hour
// times. These replace them everywhere in the app:
// - DateField: a button with the field's look (.ui-input) that shows the day in words, "Sat 17 Oct 2026", with the
//   calendar icon at the end. It opens the month in a Smoke glass popover: Monday first, today a small dot (never
//   Amber), the chosen day the white pill of glass, days outside min/max faded. Arrows move by day and week,
//   Home/End to the week's ends, PageUp/PageDown by month (Shift: by year); Enter or Space picks and closes; Esc closes;
//   focus goes back to the field. An optional field with a day has "Clear" under the month.
// - TimeField: the Select (glass listbox) with 24-hour slots, "00:00" to "23:45" every 15 minutes by default; a value
//   that is not on a slot is listed too.
//   <FieldLabel htmlFor="day">Day</FieldLabel>
//   <DateField id="day" value={day} onChange={setDay} min="2026-10-14" />
//   <FieldLabel as="span" id="time-l">Time</FieldLabel>
//   <TimeField aria-labelledby="time-l" value={time} onChange={setTime} />
import {
  forwardRef,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent,
} from "react";
import { cx } from "../cx";
import { Icon } from "../icons";
import { Popover, PopoverContent, PopoverTrigger } from "../overlays/popover";
import { Button } from "./button";
import type { FieldSize } from "./field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

/* ---------- days as "YYYY-MM-DD", counted on noon UTC so no time zone moves them ---------- */

const DAY_MS = 86_400_000;
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const pad = (n: number) => String(n).padStart(2, "0");

function noonOf(s: string | undefined): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? "");
  if (!m) return NaN;
  const t = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, 12);
  return new Date(t).getUTCDate() === +m[3]! ? t : NaN;
}
const isDay = (s: string | undefined): s is string => !Number.isNaN(noonOf(s));
const keyOf = (t: number) => new Date(t).toISOString().slice(0, 10);
const addDays = (s: string, n: number) => keyOf(noonOf(s) + n * DAY_MS);
/** Monday 0 … Sunday 6. */
const weekdayOf = (s: string) => (new Date(noonOf(s)).getUTCDay() + 6) % 7;
const daysInMonth = (s: string) => new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7), 0, 12)).getUTCDate();
/** The same day n months on, kept inside the shorter month (31 Jan + 1 → 28 Feb). */
function addMonths(s: string, n: number): string {
  const first = new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1 + n, 1, 12));
  const key = keyOf(first.getTime());
  return `${key.slice(0, 8)}${pad(Math.min(+s.slice(8, 10), daysInMonth(key)))}`;
}
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
/** "Sat 17 Oct 2026" (the app writes September "Sep"). */
function shortLabel(s: string): string {
  const t = new Date(noonOf(s));
  return `${WEEKDAYS[weekdayOf(s)]!.slice(0, 3)} ${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]!.slice(0, 3)} ${t.getUTCFullYear()}`;
}
/** "Saturday 17 October 2026", for the day buttons' names. */
function longLabel(s: string): string {
  const t = new Date(noonOf(s));
  return `${WEEKDAYS[weekdayOf(s)]} ${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]} ${t.getUTCFullYear()}`;
}

/* ---------- DateField ---------- */

export interface DateFieldProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "value" | "onChange" | "type" | "children" | "placeholder"
> {
  /** The day, "YYYY-MM-DD", or "" for none. */
  value: string;
  /** The picked day ("YYYY-MM-DD"), or "" after Clear. */
  onChange: (value: string) => void;
  /** sm 32, md 40 (default), lg 48, like Input. */
  size?: FieldSize;
  /** The first and last day that can be picked ("YYYY-MM-DD"); days outside are faded and cannot be picked. */
  min?: string;
  max?: string;
  /** Marks it aria-required and leaves out Clear. */
  required?: boolean;
  /** Shown while there is no day. Default "Pick a day". */
  placeholder?: string;
  /** The day that carries today's dot ("YYYY-MM-DD"). Default: today on this device (the app passes the demo's clock). */
  today?: string;
  /** Portal target for the popover; default document.body. */
  container?: HTMLElement | null;
}

/** A day field: the field's look, the day in words, and the month in a glass popover. No native date input. */
export const DateField = forwardRef<HTMLButtonElement, DateFieldProps>(function DateField(
  {
    value,
    onChange,
    size = "md",
    min,
    max,
    required,
    placeholder = "Pick a day",
    today,
    container,
    className,
    disabled,
    onKeyDown,
    "aria-describedby": describedBy,
    ...props
  },
  ref,
) {
  const [open, setOpen] = useState(false);
  const valueId = useId();
  const day = isDay(value) ? value : null;
  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <button
          ref={ref}
          type="button"
          className={cx("ui-input", size !== "md" && `ui-input--${size}`, "ui-date-field-trigger", className)}
          disabled={disabled}
          data-placeholder={day ? undefined : ""}
          aria-required={required || undefined}
          // the label names the field (FieldLabel htmlFor, or aria-label); the day it holds follows as its description
          aria-describedby={[valueId, describedBy].filter(Boolean).join(" ")}
          onKeyDown={(event) => {
            onKeyDown?.(event);
            if (!event.defaultPrevented && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
              event.preventDefault();
              setOpen(true);
            }
          }}
          {...props}
        >
          <span className="ui-date-field-value">
            <span id={valueId}>{day ? shortLabel(day) : placeholder}</span>
            {/* as wide as the longest day, like a native date input, so the field never jumps when the day changes */}
            <span className="ui-date-field-sizer" aria-hidden="true">
              Wed 28 May 2026
            </span>
          </span>
          <Icon name="calendar" className="ui-date-field-icon" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="ui-date-field-popover"
        align="start"
        container={container}
        aria-label="Choose a day"
        onOpenAutoFocus={(event) => {
          // the chosen day (or today) takes the focus, not the month's first button
          event.preventDefault();
          (event.currentTarget as HTMLElement)
            .querySelector<HTMLElement>('.ui-calendar-day[tabindex="0"]')
            ?.focus({ preventScroll: true });
        }}
      >
        <Month
          value={day}
          today={isDay(today) ? today : localToday()}
          min={isDay(min) ? min : undefined}
          max={isDay(max) ? max : undefined}
          onPick={pick}
          onClear={!required && day ? () => pick("") : undefined}
        />
      </PopoverContent>
    </Popover>
  );
});

interface MonthProps {
  value: string | null;
  today: string;
  min?: string;
  max?: string;
  onPick: (day: string) => void;
  onClear?: () => void;
}

/** The month in the popover (calendar.css .ui-calendar--glass). Mounted each time it opens, so it starts on the day. */
function Month({ value, today, min, max, onPick, onClear }: MonthProps) {
  const off = (d: string) => Boolean((min && d < min) || (max && d > max));
  const start = value ?? (min && today < min ? min : max && today > max ? max : today);
  const [focus, setFocus] = useState(start);
  // after the arrows the focused day shows the hover veil, so it is seen without the Tab ring (focus.js)
  const [keyed, setKeyed] = useState(false);
  const moved = useRef(false);
  const body = useRef<HTMLTableSectionElement>(null);
  const captionId = useId();
  const view = `${focus.slice(0, 8)}01`;
  const count = daysInMonth(view);
  const lead = weekdayOf(view);
  const last = `${view.slice(0, 8)}${pad(count)}`;

  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    body.current?.querySelector<HTMLElement>(`[data-date="${focus}"]`)?.focus({ preventScroll: true });
  }, [focus]);

  const go = (next: string, withFocus: boolean) => {
    moved.current = withFocus;
    setFocus(next);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTableSectionElement>) => {
    const step = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 } as Record<string, number>)[event.key];
    let next: string | null = null;
    if (step) next = addDays(focus, step);
    else if (event.key === "Home") next = addDays(focus, -weekdayOf(focus));
    else if (event.key === "End") next = addDays(focus, 6 - weekdayOf(focus));
    else if (event.key === "PageUp" || event.key === "PageDown")
      next = addMonths(focus, (event.key === "PageUp" ? -1 : 1) * (event.shiftKey ? 12 : 1));
    if (!next) return;
    event.preventDefault();
    setKeyed(true);
    go(next, true);
  };

  const weeks = Math.ceil((lead + count) / 7);
  return (
    <div className="ui-calendar ui-calendar--glass" data-slot="calendar">
      <div className="ui-calendar-header">
        <div className="ui-calendar-caption" id={captionId} aria-live="polite">
          {MONTHS[+view.slice(5, 7) - 1]} {view.slice(0, 4)}
        </div>
        <div className="ui-calendar-nav">
          <Button
            variant="glass-clear"
            size="sm"
            iconOnly
            icon="chevron-left"
            aria-label="Previous month"
            tooltip={false}
            disabled={Boolean(min && addDays(view, -1) < min)}
            onClick={() => go(addMonths(focus, -1), false)}
          />
          <Button
            variant="glass-clear"
            size="sm"
            iconOnly
            icon="chevron-right"
            aria-label="Next month"
            tooltip={false}
            disabled={Boolean(max && addDays(last, 1) > max)}
            onClick={() => go(addMonths(focus, 1), false)}
          />
        </div>
      </div>
      <table className="ui-calendar-grid" role="grid" aria-labelledby={captionId}>
        <thead>
          <tr>
            {WEEKDAYS.map((w) => (
              <th key={w} className="ui-calendar-weekday" scope="col">
                <abbr title={w}>{w.slice(0, 2)}</abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody ref={body} onKeyDown={onKeyDown}>
          {Array.from({ length: weeks }, (_, w) => (
            <tr key={w}>
              {Array.from({ length: 7 }, (_, c) => {
                const n = w * 7 + c - lead + 1;
                if (n < 1 || n > count) return <td key={c} className="ui-calendar-cell" role="presentation" />;
                const d = `${view.slice(0, 8)}${pad(n)}`;
                const chosen = d === value;
                const isToday = d === today;
                const no = off(d);
                return (
                  <td key={c} className="ui-calendar-cell" role="gridcell" aria-selected={chosen}>
                    <button
                      type="button"
                      className={cx("ui-calendar-day", keyed && d === focus && "is-hover")}
                      data-date={d}
                      data-today={isToday ? "" : undefined}
                      data-selected={chosen ? "" : undefined}
                      aria-disabled={no || undefined}
                      aria-current={isToday ? "date" : undefined}
                      aria-label={`${longLabel(d)}${isToday ? ", today" : ""}`}
                      tabIndex={d === focus ? 0 : -1}
                      onClick={() => !no && onPick(d)}
                    >
                      {n}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {onClear && (
        <div className="ui-calendar-footer">
          <Button variant="glass-clear" size="sm" onClick={onClear}>
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}

/* ---------- TimeField ---------- */

/** "00:00" … "23:45" every `step` minutes, with `value` among them when it falls between. */
function timeSlots(step: number, value: string): string[] {
  const every = Math.max(1, Math.round(step));
  const out: string[] = [];
  for (let t = 0; t < 24 * 60; t += every) out.push(`${pad(Math.floor(t / 60))}:${pad(t % 60)}`);
  if (/^\d{2}:\d{2}$/.test(value) && !out.includes(value)) {
    out.push(value);
    out.sort();
  }
  return out;
}

export interface TimeFieldProps {
  /** "HH:MM", 24-hour, or "" for none. */
  value: string;
  onChange: (value: string) => void;
  /** Minutes between the slots. Default 15. */
  step?: number;
  /** On the trigger. */
  id?: string;
  /** sm 32 or md 40 (default), like SelectTrigger. */
  size?: "sm" | "md";
  disabled?: boolean;
  required?: boolean;
  /** Point it at a FieldLabel as="span" (the Select pattern). */
  "aria-labelledby"?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  /** Shown while there is no time. Default "Pick a time". */
  placeholder?: string;
  /** Classes for the .ui-select wrapper. */
  className?: string;
  /** Portal target for the listbox; default document.body. */
  container?: Element | DocumentFragment | null;
}

/** A time field: the glass Select with 24-hour slots ("20:00"). No native time input. */
export function TimeField({
  value,
  onChange,
  step = 15,
  id,
  size,
  disabled,
  required,
  placeholder = "Pick a time",
  className,
  container,
  ...aria
}: TimeFieldProps) {
  const slots = useMemo(() => timeSlots(step, value), [step, value]);
  const [open, setOpen] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  // open, the chosen time sits in the middle of the list, with the times before and after it in view
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const root = list.current;
      const item = root?.querySelector<HTMLElement>('[data-state="checked"]');
      if (!root || !item) return;
      // the element that scrolls: Radix's viewport or the listbox itself
      let el = item.parentElement;
      while (el && el !== root && el.scrollHeight <= el.clientHeight + 1) el = el.parentElement;
      if (!el || el.scrollHeight <= el.clientHeight + 1) return;
      const top = item.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
      el.scrollTop = top - (el.clientHeight - item.offsetHeight) / 2;
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);
  return (
    <Select
      value={value || undefined}
      onValueChange={(v) => v && onChange(v)}
      open={open}
      onOpenChange={setOpen}
      disabled={disabled}
      required={required}
      className={cx("ui-time-field", className)}
    >
      <SelectTrigger id={id} size={size} className="ui-time-field-trigger" {...aria}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent ref={list} container={container} className="ui-time-field-list">
        {slots.map((s) => (
          <SelectItem key={s} value={s}>
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
