// Small pieces the Fume family shares. Internal: not exported from the package (controls/ owns Button, Avatar,
// Kbd, Segmented); these render the same markup so this family does not depend on files written in parallel.
import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cx } from "../cx";
import { Icon, type IconName } from "../icons";

/** Inline custom properties (the only inline style the conventions allow). */
export function vars(values: Record<string, string | number | undefined>): CSSProperties {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(values)) if (v !== undefined) out[k] = v;
  return out as CSSProperties;
}

/** A bare sprite glyph, for the places where the CSS styles `svg` directly and the markup has no `.ico`. */
export function Glyph({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg className={className} aria-hidden="true">
      <use href={`#fi-${name}`} />
    </svg>
  );
}

/** The spinner (spinner.css). */
export function Spinner({ label = "Working", size = "sm" }: { label?: string; size?: "sm" | "md" }) {
  return (
    <svg className={cx("ui-spinner", size === "sm" && "ui-spinner--sm")} role="status" aria-label={label}>
      <use href="#fi-loader-circle" />
    </svg>
  );
}

export type BtnVariant = "primary" | "secondary" | "quiet" | "danger" | "glass-white" | "glass-clear" | "glass-danger";

export interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: "sm" | "md" | "lg";
  /** Leading icon. */
  icon?: IconName;
  /** Trailing icon. */
  iconEnd?: IconName;
  /** Icon-only: a circle. Give it an aria-label. */
  iconOnly?: boolean;
}

/** button.css markup: <button class="ui-btn ui-btn--{variant} [ui-btn--sm] [ui-btn--icon]">. */
export const Btn = forwardRef<HTMLButtonElement, BtnProps>(function Btn(
  { variant = "secondary", size = "md", icon, iconEnd, iconOnly, className, children, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        "ui-btn",
        `ui-btn--${variant}`,
        iconOnly && "ui-btn--icon",
        size === "sm" && "ui-btn--sm",
        size === "lg" && "ui-btn--lg",
        className,
      )}
      {...props}
    >
      {icon && <Icon name={icon} />}
      {children}
      {iconEnd && <Icon name={iconEnd} />}
    </button>
  );
});

/** A person's sign: avatar.css. Initials on the sunken step, or Ink (`ink`) for the person who decides. */
export interface PersonSign {
  name: string;
  /** Image URL; without one the initials show. */
  avatar?: string;
  /** Defaults to the first letter of the name. */
  initials?: string;
  /** Ink with Paper initials: the person who decides (Anna on a check). */
  ink?: boolean;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

export function Avatar({ person, size, className }: { person: PersonSign; size?: "sm" | "lg"; className?: string }) {
  const initials = person.initials ?? person.name.trim().charAt(0).toUpperCase();
  return (
    <span
      className={cx(
        "ui-avatar",
        size === "sm" && "ui-avatar--sm",
        size === "lg" && "ui-avatar--lg",
        person.ink && "ui-avatar--ink",
        className,
      )}
      aria-hidden="true"
    >
      {person.avatar ? (
        <>
          <span className="ui-avatar-fallback">{initials}</span>
          <img className="ui-avatar-image" src={person.avatar} alt="" />
        </>
      ) : (
        initials
      )}
    </span>
  );
}

/** The Engine's mark in a message: frame corners and focal point, two layers of fi-fume-engine (message.css). */
export function EngineMark({ thinking, className }: { thinking?: boolean; className?: string }) {
  return (
    <span
      className={cx("ui-message-mark", className)}
      aria-hidden="true"
      data-state={thinking ? "thinking" : undefined}
    >
      <svg className="ui-message-mark-frame" aria-hidden="true">
        <use href="#fi-fume-engine" />
      </svg>
      <svg className="ui-message-mark-point" aria-hidden="true">
        <use href="#fi-fume-engine" />
      </svg>
    </span>
  );
}

/** kbd.css */
export function Kbd({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <kbd className={cx("ui-kbd", className)} aria-label={label}>
      {children}
    </kbd>
  );
}

/** progress.css: <div class="ui-progress" role="progressbar" style="--value: 58">. */
export function ProgressBar({
  value,
  max,
  label,
  className,
}: {
  value: number;
  max: number;
  label: string;
  className?: string;
}) {
  const pct = max > 0 ? Math.round((Math.min(value, max) / max) * 1000) / 10 : 0;
  return (
    <div
      className={cx("ui-progress", className)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      data-state={value >= max ? "complete" : "loading"}
      style={vars({ "--value": pct })}
    >
      <span className="ui-progress-indicator" />
    </div>
  );
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function isCoarsePointer(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
}

/** A duration token in ms (`--ui-share-copied: 2000ms`), with a fallback. */
export function tokenMs(name: string, fallback: number): number {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!v) return fallback;
  const n = parseFloat(v);
  if (Number.isNaN(n)) return fallback;
  return /ms$/.test(v) ? n : /s$/.test(v) ? n * 1000 : n;
}

/** A length token in px, with a fallback. */
export function tokenPx(name: string, fallback: number): number {
  if (typeof document === "undefined") return fallback;
  const n = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  return Number.isNaN(n) ? fallback : n;
}

export const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** A live region text that is read again even when the words repeat (clear, then set). */
export function useAnnouncer(): [string, (text: string) => void] {
  const [text, setText] = useState("");
  const timer = useRef<number>();
  const say = useCallback((next: string) => {
    setText("");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setText(next), 60);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return [text, say];
}

/** Sizes as dropzone.js writes them: one decimal under 100, whole from 100 up; number and unit never part. */
const NB = " ";
function num(v: number): string {
  return v >= 100 ? String(Math.round(v)) : v.toFixed(1);
}
export function formatBytes(b: number): string {
  return b >= 1e9
    ? num(b / 1e9) + NB + "GB"
    : b >= 1e6
      ? num(b / 1e6) + NB + "MB"
      : Math.max(1, Math.round(b / 1e3)) + NB + "KB";
}
/** "15.7 / 19.2 MB" while a creative uploads. */
export function formatBytesPart(done: number, total: number): string {
  const u = total >= 1e9 ? 1e9 : total >= 1e6 ? 1e6 : 1e3;
  return (u === 1e3 ? String(Math.round(done / u)) : num(done / u)) + " / " + formatBytes(total);
}
export function extOf(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name || "");
  return m ? m[1].toUpperCase() : "";
}

/** Opens the system file picker; returns the chosen files. */
export function pickFiles(accept: string, multiple = true): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = multiple;
    if (accept) input.accept = accept;
    input.hidden = true;
    document.body.appendChild(input);
    input.addEventListener("change", () => {
      const files = Array.from(input.files ?? []);
      input.remove();
      resolve(files);
    });
    input.click();
  });
}

// ---------- segmented control (segmented.css + segmented.js), for the QG format switch and the inbox filter ----------

export interface SegOption<V extends string> {
  value: V;
  label: ReactNode;
  /** data-* extras the CSS or a screen reads (data-format, data-size). */
  data?: Record<string, string>;
}

/** The sliding segmented control: roving tabindex, arrows, Home and End; places --x and --w on the indicator. */
export function Seg<V extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: SegOption<V>[];
  value: V;
  onChange: (value: V) => void;
  label: string;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; w: number } | null>(null);
  const [phase, setPhase] = useState<"placing" | "ready">("placing");

  const place = useCallback(() => {
    const el = root.current?.querySelector<HTMLButtonElement>('.ui-seg-option[aria-selected="true"]');
    if (el) setPos({ x: el.offsetLeft, w: el.offsetWidth });
  }, []);

  useIsoLayoutEffect(() => {
    place();
  }, [value, options.length, place]);

  useEffect(() => {
    let a = 0;
    const b = requestAnimationFrame(() => {
      a = requestAnimationFrame(() => setPhase("ready"));
    });
    const el = root.current;
    let ro: ResizeObserver | undefined;
    if (el && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => place());
      ro.observe(el);
    }
    return () => {
      cancelAnimationFrame(a);
      cancelAnimationFrame(b);
      ro?.disconnect();
    };
  }, [place]);

  const select = (i: number, focus: boolean) => {
    const o = options[(i + options.length) % options.length];
    if (!o) return;
    if (o.value !== value) onChange(o.value);
    if (focus) {
      const btn =
        root.current?.querySelectorAll<HTMLButtonElement>(".ui-seg-option")[(i + options.length) % options.length];
      btn?.focus();
    }
  };

  const current = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  return (
    <div
      ref={root}
      className={cx("ui-seg", phase === "placing" ? "is-placing" : "is-ready", className)}
      role="tablist"
      aria-label={label}
      onKeyDown={(e) => {
        const step = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[e.key];
        if (step) {
          e.preventDefault();
          select(current + step, true);
        } else if (e.key === "Home") {
          e.preventDefault();
          select(0, true);
        } else if (e.key === "End") {
          e.preventDefault();
          select(options.length - 1, true);
        }
      }}
    >
      <span
        className="ui-seg-indicator"
        aria-hidden="true"
        style={pos ? vars({ "--x": `${pos.x}px`, "--w": `${pos.w}px` }) : undefined}
      />
      {options.map((o) => {
        const on = o.value === value;
        const data: Record<string, string> = {};
        if (o.data) for (const [k, v] of Object.entries(o.data)) data[`data-${k}`] = v;
        return (
          <button
            key={o.value}
            className="ui-seg-option"
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => select(options.indexOf(o), false)}
            {...data}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** The creative formats the design system draws (creative.css data-format). */
export type CreativeFormat = "feed" | "story" | "banner" | "square";

/** The data-format attribute for a creative's format. */
export function formatAttrs(format: CreativeFormat | undefined): { "data-format"?: string; style?: CSSProperties } {
  return format ? { "data-format": format } : {};
}
