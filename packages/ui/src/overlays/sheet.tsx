// Sheet and drawer (design-system/components/sheet.css, behaviour of dialog.js), on Radix Dialog as shadcn's
// sheet; the drawer re-implements dialog.js's snap points instead of vaul.
// Sheet markup:  div.ui-dialog-overlay + div.ui-glass.ui-sheet[role=dialog][data-side=right|left|top|bottom][data-state]
//   > div.ui-sheet-header (h2.ui-sheet-title, p.ui-sheet-description), div.ui-sheet-body (scrolls on its own),
//     div.ui-sheet-footer, and last the close button.ui-btn.ui-btn--glass-clear.ui-btn--icon.ui-btn--sm.ui-sheet-close.
// Drawer markup: div.ui-dialog-overlay + div.ui-glass.ui-drawer[role=dialog][data-state][data-snap]
//   > button.ui-drawer-handle, div.ui-drawer-header (h2.ui-drawer-title, p.ui-drawer-description),
//     div.ui-drawer-body, div.ui-drawer-footer.
// The drawer opens at the first snap (--ui-drawer-snap of the screen), drags by the handle or the header
// between snaps and down and away, and the handle (click, ArrowUp, ArrowDown) moves between snaps.
// The sheet on a desk, the drawer on a phone: pick with useNarrowScreen().
// Footers: one ui-btn--glass-white (or --glass-danger), the rest ui-btn--glass-clear (glass-one-white).
// Round 8 (walk-through 19 Oct, MOB-14; PROPOSED 19 Oct 2026): on a touch screen the first focus is the title, never
// the first field, so the keyboard does not rise over the footer before the sheet is read.
//
// Round 9: THE RIGHT PANEL (DLAY-15, DWAY-5, DWAY-4; PROPOSED 19 Oct 2026). On a desk, anything with a form or more
// than about three fields opens as a panel on the right, never as a centred dialog: the page stays in view on the left.
//   <Sheet open={open} onOpenChange={setOpen}>
//     <SheetContent side="right" size="lg" aria-describedby={undefined}>      size md 440 (default) or lg 520
//       <SheetHeader><SheetTitle>Add a product</SheetTitle><SheetDescription>…</SheetDescription></SheetHeader>
//       <SheetBody> the form: it scrolls on its own </SheetBody>
//       <SheetFooter> <Button variant="glass-clear">Later</Button> <Button variant="glass-white">Confirm</Button> </SheetFooter>
//     </SheetContent>
//   </Sheet>
// It runs the full height of the window (12 off the edges, so its corners show), on the Smoke glass (glass.css), with a body that scrolls on its own and the footer pinned at its foot under a hairline.
// One white button in the footer, the main action last. Under 640 px the same panel rises from the bottom as a sheet
// (the phone keeps its bottom sheet), so one component serves both. Esc closes it; focus goes back to what opened it.
// Put the panel's subject in the address (?check=pr-balm) when Back and a reload should keep it open.
// A form inside: wrap SheetBody and SheetFooter in <form className="ui-sheet-form"> (it takes no box) and ⌘↵ submits.
// `modal={false}` on Sheet makes a peek that leaves the page scrollable and clickable (no scrim, no focus trap; a
// press outside closes it, unless onInteractOutside prevents that).
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ElementRef,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { cx } from "../cx";
import { Icon } from "../icons";
import { DialogOverlay, focusTitleOnTouch, submitOnModEnter } from "./dialog";
import { currentOpener, focusFirst, mergeRefs, returnFocusTo, tokenNumber, useControllableState } from "./shared";

const CHROME = ".ui-sheet-close, .ui-drawer-handle";

// ---------------------------------------------------------------- sheet

/** Root. Props: open, defaultOpen, onOpenChange(open). */
export const Sheet = DialogPrimitive.Root;
export type SheetProps = DialogPrimitive.DialogProps;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export type SheetSide = "right" | "left" | "top" | "bottom";

export type SheetSize = "md" | "lg";

export interface SheetContentProps extends ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** The edge it slides in from; default right. Right (or left) is the desk's side panel; under 640 px it rises from the bottom. */
  side?: SheetSide;
  /** The side panel's width: md 440 (default), lg 520 (a long form: Add a product, Import). */
  size?: SheetSize;
  /** The clear close circle; default true. */
  showClose?: boolean;
  /** aria-label of the close button; default "Close". */
  closeLabel?: string;
  container?: HTMLElement | null;
}

/** The side panel (the desk's right panel, see above) or an edge sheet, with its scrim, in a portal. */
export const SheetContent = forwardRef<ElementRef<typeof DialogPrimitive.Content>, SheetContentProps>(
  (
    {
      side = "right",
      size = "md",
      showClose = true,
      closeLabel = "Close",
      container,
      className,
      children,
      onOpenAutoFocus,
      onCloseAutoFocus,
      onKeyDown,
      ...props
    },
    ref,
  ) => {
    const el = useRef<HTMLDivElement | null>(null);
    const opener = useRef<HTMLElement | null>(null);
    return (
      <DialogPrimitive.Portal container={container}>
        <DialogOverlay />
        <DialogPrimitive.Content
          ref={mergeRefs(ref, el)}
          aria-modal="true"
          data-side={side}
          data-size={size}
          className={cx("ui-glass ui-sheet", className)}
          onOpenAutoFocus={(event) => {
            opener.current = currentOpener();
            onOpenAutoFocus?.(event);
            if (event.defaultPrevented) return;
            const layer = event.currentTarget as HTMLElement;
            if (focusTitleOnTouch(layer, ".ui-sheet-title") || focusFirst(layer, CHROME)) event.preventDefault();
          }}
          onCloseAutoFocus={(event) => {
            onCloseAutoFocus?.(event);
            if (!event.defaultPrevented && returnFocusTo(opener.current, el.current)) event.preventDefault();
          }}
          onKeyDown={(event) => {
            onKeyDown?.(event);
            submitOnModEnter(event);
          }}
          {...props}
        >
          {children}
          {showClose && (
            <DialogPrimitive.Close
              className="ui-btn ui-btn--glass-clear ui-btn--icon ui-btn--sm ui-sheet-close"
              aria-label={closeLabel}
            >
              <Icon name="x" />
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    );
  },
);
SheetContent.displayName = "SheetContent";

function part(name: string, base: string) {
  const C = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
    <div ref={ref} className={cx(base, className)} {...props} />
  ));
  C.displayName = name;
  return C;
}

/** div.ui-sheet-header: title and description, 8 apart. */
export const SheetHeader = part("SheetHeader", "ui-sheet-header");
/** div.ui-sheet-body: scrolls on its own, 24 of air above and below. */
export const SheetBody = part("SheetBody", "ui-sheet-body");
/** div.ui-sheet-footer: the actions, pinned at the foot under a hairline; the main action last. */
export const SheetFooter = part("SheetFooter", "ui-sheet-footer");

/** h2.ui-sheet-title. */
export const SheetTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cx("ui-sheet-title", className)} {...props} />
));
SheetTitle.displayName = "SheetTitle";

/** p.ui-sheet-description. */
export const SheetDescription = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cx("ui-sheet-description", className)} {...props} />
));
SheetDescription.displayName = "SheetDescription";

// ---------------------------------------------------------------- drawer

const DrawerContext = createContext<{ close: () => void } | null>(null);

export type DrawerProps = DialogPrimitive.DialogProps;

/** Root. Props: open, defaultOpen, onOpenChange(open). Holds the open state so a drag can close it. */
export function Drawer({ open, defaultOpen = false, onOpenChange, ...props }: DrawerProps) {
  const [isOpen, setOpen] = useControllableState<boolean>(open, defaultOpen, onOpenChange);
  const value = useMemo(() => ({ close: () => setOpen(false) }), [setOpen]);
  return (
    <DrawerContext.Provider value={value}>
      <DialogPrimitive.Root open={isOpen} onOpenChange={setOpen} {...props} />
    </DrawerContext.Provider>
  );
}
export const DrawerTrigger = DialogPrimitive.Trigger;
export const DrawerClose = DialogPrimitive.Close;

export interface DrawerContentProps extends ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** aria-label of the grab handle; default "Resize: drag, or press to open fully". */
  handleLabel?: string;
  container?: HTMLElement | null;
}

interface Drag {
  y: number;
  h: number;
  lastY: number;
  lastT: number;
  v: number;
  moved: boolean;
  id: number;
}

/** The sheet's content from the bottom of a phone, with snap points, a grab handle and its scrim. */
export const DrawerContent = forwardRef<ElementRef<typeof DialogPrimitive.Content>, DrawerContentProps>(
  (
    {
      handleLabel = "Resize: drag, or press to open fully",
      container,
      className,
      style,
      children,
      onOpenAutoFocus,
      onCloseAutoFocus,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      ...props
    },
    ref,
  ) => {
    const ctx = useContext(DrawerContext);
    const el = useRef<HTMLDivElement | null>(null);
    const opener = useRef<HTMLElement | null>(null);
    const snaps = useRef<number[]>([]);
    const drag = useRef<Drag | null>(null);
    const noClick = useRef(false);
    const [height, setHeight] = useState<number | null>(null);
    const [offset, setOffset] = useState(0);
    const [snap, setSnap] = useState(0);
    const snapRef = useRef(0);
    const [snapping, setSnapping] = useState(false);
    const [dragging, setDragging] = useState(false);

    // the snap points: the first share of the screen, and the content's own height (up to the CSS max-height)
    const measure = useCallback((): number[] => {
      const node = el.current;
      if (!node) return [];
      const prev = node.style.height;
      node.style.height = "";
      const full = node.offsetHeight;
      node.style.height = prev;
      const first = Math.min(full, Math.round(window.innerHeight * tokenNumber("--ui-drawer-snap", 0.6)));
      return first < full - 24 ? [first, full] : [full];
    }, []);

    const snapTo = useCallback((i: number, animate = true) => {
      const s = snaps.current;
      if (!s.length) return;
      const n = Math.max(0, Math.min(s.length - 1, i));
      setSnapping(animate);
      setHeight(s[n]);
      setOffset(0);
      setSnap(n);
      snapRef.current = n;
    }, []);

    // content mounts when the drawer opens: start at the first snap
    useLayoutEffect(() => {
      snaps.current = measure();
      snapTo(0, false);
    }, [measure, snapTo]);

    useEffect(() => {
      const onResize = () => {
        snaps.current = measure();
        snapTo(snapRef.current);
      };
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }, [measure, snapTo]);

    const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
      onPointerDown?.(e);
      if (e.defaultPrevented || e.button > 0) return;
      const target = e.target as HTMLElement;
      const grip = target.closest<HTMLElement>(".ui-drawer-handle, .ui-drawer-header");
      if (!grip || !el.current) return;
      if (target.closest("button:not(.ui-drawer-handle), a, input, textarea, select")) return;
      if (!snaps.current.length) snaps.current = measure();
      const now = performance.now();
      drag.current = {
        y: e.clientY,
        h: el.current.offsetHeight,
        lastY: e.clientY,
        lastT: now,
        v: 0,
        moved: false,
        id: e.pointerId,
      };
      try {
        grip.setPointerCapture(e.pointerId);
      } catch {
        /* capture is a nicety */
      }
    };

    const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
      onPointerMove?.(e);
      const d = drag.current;
      if (!d || e.pointerId !== d.id) return;
      const dy = e.clientY - d.y;
      if (!d.moved && Math.abs(dy) < 4) return;
      if (!d.moved) {
        d.moved = true;
        setDragging(true);
        setSnapping(false);
      }
      const s = snaps.current;
      const min = s[0];
      const max = s[s.length - 1];
      let h = d.h - dy;
      if (h > max) h = max + (h - max) / 6; // a little give past fully open
      if (h >= min) {
        setHeight(h);
        setOffset(0);
      } else {
        setHeight(min);
        setOffset(min - h);
      }
      const now = performance.now();
      d.v = (e.clientY - d.lastY) / Math.max(1, now - d.lastT);
      d.lastY = e.clientY;
      d.lastT = now;
    };

    const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.id) return;
      drag.current = null;
      setDragging(false);
      if (!d.moved) return;
      noClick.current = true; // the click after a drag is not a press
      window.setTimeout(() => {
        noClick.current = false;
      }, 0);
      const s = snaps.current;
      const h = d.h - (d.lastY - d.y);
      const v = d.v;
      if (h < s[0] * 0.66 || (v > 0.6 && h < s[0] + 8)) {
        ctx?.close();
        return;
      }
      let target = 0;
      let best = Infinity;
      s.forEach((p, i) => {
        const dist = Math.abs(p - h) - (v < -0.4 && p > h ? 200 : 0) - (v > 0.4 && p < h ? 200 : 0);
        if (dist < best) {
          best = dist;
          target = i;
        }
      });
      snapTo(target);
    };

    const onHandleClick = () => {
      if (noClick.current) return;
      if (snaps.current.length > 1) snapTo((snap + 1) % snaps.current.length);
    };
    const onHandleKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        snapTo(snap + 1);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        snapTo(snap - 1);
      }
    };

    // height and --drawer-y are computed here at run time, as dialog.js sets them
    const runtime = {
      ...style,
      height: height == null ? undefined : Math.round(height),
      "--drawer-y": `${offset}px`,
    } as CSSProperties;

    return (
      <DialogPrimitive.Portal container={container}>
        <DialogOverlay />
        <DialogPrimitive.Content
          ref={mergeRefs(ref, el)}
          aria-modal="true"
          className={cx("ui-glass ui-drawer", snapping && "is-snapping", className)}
          data-snap={String(snap)}
          data-dragging={dragging ? "" : undefined}
          style={runtime}
          onOpenAutoFocus={(event) => {
            opener.current = currentOpener();
            onOpenAutoFocus?.(event);
            if (event.defaultPrevented) return;
            const layer = event.currentTarget as HTMLElement;
            if (focusTitleOnTouch(layer, ".ui-drawer-title") || focusFirst(layer, CHROME)) event.preventDefault();
          }}
          onCloseAutoFocus={(event) => {
            onCloseAutoFocus?.(event);
            if (!event.defaultPrevented && returnFocusTo(opener.current, el.current)) event.preventDefault();
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={(e) => {
            onPointerUp?.(e);
            endDrag(e);
          }}
          onPointerCancel={(e) => {
            onPointerCancel?.(e);
            endDrag(e);
          }}
          {...props}
        >
          <button
            type="button"
            className="ui-drawer-handle"
            aria-label={handleLabel}
            onClick={onHandleClick}
            onKeyDown={onHandleKeyDown}
          />
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    );
  },
);
DrawerContent.displayName = "DrawerContent";

/** div.ui-drawer-header: drags the drawer too. */
export const DrawerHeader = part("DrawerHeader", "ui-drawer-header");
/** div.ui-drawer-body: scrolls on its own. */
export const DrawerBody = part("DrawerBody", "ui-drawer-body");
/** div.ui-drawer-footer: the actions share the width, 44 tall. */
export const DrawerFooter = part("DrawerFooter", "ui-drawer-footer");

/** h2.ui-drawer-title. */
export const DrawerTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cx("ui-drawer-title", className)} {...props} />
));
DrawerTitle.displayName = "DrawerTitle";

/** p.ui-drawer-description. */
export const DrawerDescription = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cx("ui-drawer-description", className)} {...props} />
));
DrawerDescription.displayName = "DrawerDescription";
