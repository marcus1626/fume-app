// Tooltip (design-system/components/tooltip.css, behaviour of tooltip.js), on Radix Tooltip as shadcn does.
// Markup: div.ui-glass.ui-glass--small.ui-tooltip[data-side][data-state=open|closed]
//   > span.ui-tooltip-label + span.ui-tooltip-kbd (the shortcut, in the data face).
// It names a control and never holds the only copy of anything: the trigger keeps its own label
// (aria-label on an icon-only button). One short line, no arrow, 8 from the trigger.
// Timing from tokens: --ui-tooltip-delay under a resting mouse, at once between triggers within
// --ui-tooltip-skip-delay, at once on keyboard focus (Radix). On a touch screen a long press
// (--ui-tooltip-long-press) shows it for a moment and the tap that ends the press does not act, as tooltip.js does.
// Radix writes data-state="delayed-open|instant-open"; the CSS animates on "open", so the content sets
// data-state from the open state itself.
// Round 9 (DWAY-9; PROPOSED 19 Oct 2026): every icon-only Button names itself in a tooltip (button.tsx wraps itself in
// WithTooltip from its aria-label, with its shortcut); a Button already inside a TooltipTrigger does not wrap twice. A
// shortcut is written the Mac way ("⌘B") and shown as this keyboard says it ("Ctrl+B" off a Mac). Focus opens the
// tooltip only when it is keyboard focus (:focus-visible), so a dialog or menu that hands focus back to its opener after
// a click does not leave a label hanging over it. Without a TooltipProvider above, WithTooltip brings its own.
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { shortcutLabel } from "../controls/kbd";
import { cx } from "../cx";
import { floatingStyle, tokenMs, tokenPx, useControllableState } from "./shared";

export type TooltipProviderProps = ComponentPropsWithoutRef<typeof TooltipPrimitive.Provider>;

/** True below a TooltipProvider. */
const HasProvider = createContext(false);
/** True inside a TooltipTrigger: a Button there does not add a tooltip of its own. */
const InTrigger = createContext(false);
/** True when the element is already a tooltip's trigger (button.tsx reads it). */
export const useInTooltipTrigger = () => useContext(InTrigger);

/** Once near the root of the app. delayDuration and skipDelayDuration default to the tokens (500, 300). */
export function TooltipProvider({ delayDuration, skipDelayDuration, children, ...props }: TooltipProviderProps) {
  return (
    <TooltipPrimitive.Provider
      delayDuration={delayDuration ?? tokenMs("--ui-tooltip-delay", 500)}
      skipDelayDuration={skipDelayDuration ?? tokenMs("--ui-tooltip-skip-delay", 300)}
      {...props}
    >
      <HasProvider.Provider value>{children}</HasProvider.Provider>
    </TooltipPrimitive.Provider>
  );
}

interface TooltipCtx {
  open: boolean;
  setOpen: (open: boolean) => void;
  longPress: {
    start: (e: ReactPointerEvent<HTMLElement>) => void;
    move: (e: ReactPointerEvent<HTMLElement>) => void;
    cancel: () => void;
    swallow: (e: ReactMouseEvent<HTMLElement>) => void;
  };
}
const Ctx = createContext<TooltipCtx | null>(null);

export type TooltipProps = ComponentPropsWithoutRef<typeof TooltipPrimitive.Root>;

/** Root. Props: open, defaultOpen, onOpenChange(open), delayDuration (overrides the provider). Needs a TooltipProvider above. */
export function Tooltip({ open: openProp, defaultOpen = false, onOpenChange, children, ...props }: TooltipProps) {
  const [open, setOpen] = useControllableState<boolean>(openProp, defaultOpen, onOpenChange);
  const timers = useRef<{ long: number; hide: number; start: { x: number; y: number } | null; suppress: boolean }>({
    long: 0,
    hide: 0,
    start: null,
    suppress: false,
  });

  useEffect(
    () => () => {
      window.clearTimeout(timers.current.long);
      window.clearTimeout(timers.current.hide);
    },
    [],
  );

  const start = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const t = timers.current;
      t.suppress = false;
      if (e.pointerType !== "touch") return;
      window.clearTimeout(t.long);
      window.clearTimeout(t.hide);
      t.start = { x: e.clientX, y: e.clientY };
      t.long = window.setTimeout(() => {
        setOpen(true);
        t.suppress = true;
        t.hide = window.setTimeout(() => setOpen(false), 1500);
      }, tokenMs("--ui-tooltip-long-press", 500));
    },
    [setOpen],
  );
  const move = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const t = timers.current;
    if (e.pointerType === "touch" && t.start && Math.hypot(e.clientX - t.start.x, e.clientY - t.start.y) > 10) window.clearTimeout(t.long);
  }, []);
  const cancel = useCallback(() => window.clearTimeout(timers.current.long), []);
  // the tap that ends a long press only showed the label
  const swallow = useCallback((e: ReactMouseEvent<HTMLElement>) => {
    if (!timers.current.suppress) return;
    timers.current.suppress = false;
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const value = useMemo<TooltipCtx>(() => ({ open, setOpen, longPress: { start, move, cancel, swallow } }), [open, setOpen, start, move, cancel, swallow]);

  return (
    <Ctx.Provider value={value}>
      <TooltipPrimitive.Root open={open} onOpenChange={setOpen} {...props}>
        {children}
      </TooltipPrimitive.Root>
    </Ctx.Provider>
  );
}

export type TooltipTriggerProps = ComponentPropsWithoutRef<typeof TooltipPrimitive.Trigger>;

/** The control it names; almost always asChild around a Button. Adds the touch long press. */
export const TooltipTrigger = forwardRef<ElementRef<typeof TooltipPrimitive.Trigger>, TooltipTriggerProps>(
  ({ onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClickCapture, onContextMenu, onFocus, ...props }, ref) => {
    const ctx = useContext(Ctx);
    return (
      <InTrigger.Provider value>
      <TooltipPrimitive.Trigger
        ref={ref}
        data-ui-tooltip=""
        onFocus={(e) => {
          onFocus?.(e);
          // keyboard focus opens it; focus handed back by a closing dialog or menu after a click does not
          let keyboard = true;
          try {
            keyboard = e.currentTarget.matches(":focus-visible");
          } catch {
            /* an old engine without :focus-visible: open as before */
          }
          if (!keyboard) e.preventDefault();
        }}
        onPointerDown={(e) => {
          onPointerDown?.(e);
          ctx?.longPress.start(e);
        }}
        onPointerMove={(e) => {
          onPointerMove?.(e);
          ctx?.longPress.move(e);
        }}
        onPointerUp={(e) => {
          onPointerUp?.(e);
          ctx?.longPress.cancel();
        }}
        onPointerCancel={(e) => {
          onPointerCancel?.(e);
          ctx?.longPress.cancel();
        }}
        onClickCapture={(e) => {
          onClickCapture?.(e);
          ctx?.longPress.swallow(e);
        }}
        onContextMenu={(e) => {
          onContextMenu?.(e);
          if (ctx?.open) e.preventDefault();
        }}
        {...props}
      />
      </InTrigger.Provider>
    );
  },
);
TooltipTrigger.displayName = "TooltipTrigger";

export interface TooltipContentProps extends ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> {
  /** A keyboard shortcut beside the label, written the Mac way ("⌘D"); shown as "Ctrl+D" off a Mac (span.ui-tooltip-kbd). */
  shortcut?: string;
  container?: HTMLElement | null;
}

/** The glass label in a portal. Children: the label (one short line). side default top. */
export const TooltipContent = forwardRef<ElementRef<typeof TooltipPrimitive.Content>, TooltipContentProps>(
  ({ className, side = "top", sideOffset, collisionPadding, shortcut, container, style, children, ...props }, ref) => {
    const ctx = useContext(Ctx);
    return (
      <TooltipPrimitive.Portal container={container}>
        <TooltipPrimitive.Content
          ref={ref}
          side={side}
          sideOffset={sideOffset ?? tokenPx("--ui-overlay-offset", 8)}
          collisionPadding={collisionPadding ?? tokenPx("--ui-overlay-margin", 16)}
          className={cx("ui-glass ui-glass--small ui-tooltip", className)}
          style={floatingStyle("--radix-tooltip-content-transform-origin", style)}
          {...props}
          data-state={ctx ? (ctx.open ? "open" : "closed") : undefined}
        >
          <span className="ui-tooltip-label">{children}</span>
          {shortcut && <span className="ui-tooltip-kbd">{shortcutLabel(shortcut)}</span>}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    );
  },
);
TooltipContent.displayName = "TooltipContent";

export interface WithTooltipProps {
  /** The words; repeat the trigger's own label (its aria-label), never add information only here. */
  label: ReactNode;
  /** Written the Mac way ("⌘B"); shown as "Ctrl+B" off a Mac. */
  shortcut?: string;
  side?: TooltipContentProps["side"];
  /** One element that takes a ref (a Button). */
  children: ReactElement;
}

/** Shorthand: <WithTooltip label="Download" shortcut="⌘D"><Button iconOnly aria-label="Download">…</Button></WithTooltip>. */
export function WithTooltip({ label, shortcut, side, children }: WithTooltipProps) {
  const provided = useContext(HasProvider);
  const tip = (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} shortcut={shortcut}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
  return provided ? tip : <TooltipProvider>{tip}</TooltipProvider>;
}
