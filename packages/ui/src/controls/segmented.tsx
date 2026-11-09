// Segmented control (design-system/components/segmented.css; behaviour from segmented.js): a sunken pill track and
// one white pill that slides to the chosen option. The arrow keys, Home and End choose (wrapping); Tab reaches the
// chosen option only. Markup as on the board: role="tablist" with role="tab" options and aria-selected.
//   <SegmentedControl aria-label="Format" value={f} onValueChange={setF}>
//     <SegmentedOption value="feed">Feed</SegmentedOption><SegmentedOption value="story" count={4}>Story</SegmentedOption>
//   </SegmentedControl>
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cx } from "../cx";
import { composeRefs } from "./slot";
import { nextByKey, useSlidingIndicator } from "./sliding-indicator";

interface SegContext {
  value: string | undefined;
  select: (value: string) => void;
}

const SegmentedContext = createContext<SegContext | null>(null);

export interface SegmentedControlProps extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

export const SegmentedControl = forwardRef<HTMLDivElement, SegmentedControlProps>(function SegmentedControl(
  { value, defaultValue, onValueChange, className, onKeyDown, children, ...props },
  ref,
) {
  const [own, setOwn] = useState(defaultValue);
  const current = value !== undefined ? value : own;
  const select = useCallback(
    (v: string) => {
      if (v === current) return;
      if (value === undefined) setOwn(v);
      onValueChange?.(v);
    },
    [current, value, onValueChange],
  );
  const listRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const { ready, placing } = useSlidingIndicator(listRef, indicatorRef, current, "x");
  const setRef = useMemo(() => composeRefs(ref, listRef), [ref]);

  return (
    <SegmentedContext.Provider value={{ value: current, select }}>
      <div
        ref={setRef}
        role="tablist"
        className={cx("ui-seg", ready && "is-ready", placing && "is-placing", className)}
        onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
          onKeyDown?.(e);
          if (e.defaultPrevented) return;
          const next = nextByKey(e.currentTarget, e.key, ".ui-seg-option");
          if (!next) return;
          e.preventDefault();
          next.focus();
          const v = next.getAttribute("data-value");
          if (v !== null) select(v);
        }}
        {...props}
      >
        <span ref={indicatorRef} className="ui-seg-indicator" aria-hidden="true" />
        {children}
      </div>
    </SegmentedContext.Provider>
  );
});

export interface SegmentedOptionProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "value"> {
  value: string;
  /** A count after the label, in tertiary with tabular figures: "Creatives 12". */
  count?: ReactNode;
}

export const SegmentedOption = forwardRef<HTMLButtonElement, SegmentedOptionProps>(function SegmentedOption(
  { value, count, className, onClick, children, ...props },
  ref,
) {
  const seg = useContext(SegmentedContext);
  if (!seg) throw new Error("SegmentedOption must be inside a SegmentedControl");
  const selected = seg.value === value;
  // A count that changes while the page is open (a creative back from the Engine) comes into focus, so the change is
  // seen; the first count does not move.
  const last = useRef<ReactNode>(undefined);
  const [arrived, setArrived] = useState(false);
  useLayoutEffect(() => {
    if (last.current !== undefined && count !== undefined && last.current !== count) setArrived(true);
    last.current = count;
  }, [count]);
  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      aria-selected={selected}
      tabIndex={selected || seg.value === undefined ? 0 : -1}
      data-value={value}
      className={cx("ui-seg-option", className)}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) seg.select(value);
      }}
      {...props}
    >
      {children}
      {count !== undefined ? (
        <>
          {" "}
          <span
            key={typeof count === "number" || typeof count === "string" ? count : undefined}
            className="ui-seg-count"
            data-arrived={arrived ? "" : undefined}
          >
            {count}
          </span>
        </>
      ) : null}
    </button>
  );
});
