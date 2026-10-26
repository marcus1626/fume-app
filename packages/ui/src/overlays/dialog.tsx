// Dialog (design-system/components/dialog.css, behaviour of dialog.js), on Radix Dialog as shadcn does.
// Markup: div.ui-dialog-overlay (the glass scrim) + div.ui-glass.ui-dialog[role=dialog][data-state][data-size]
//   > div.ui-dialog-header > h2.ui-dialog-title + p.ui-dialog-description, div.ui-dialog-body?,
//     div.ui-dialog-footer > buttons, and last the close: button.ui-btn.ui-btn--glass-clear.ui-btn--icon.ui-btn--sm.ui-dialog-close.
// Radix gives focus trap, Escape, scrim click, scroll lock and focus back to the trigger, and the
// data-state="open|closed" the CSS animates on. Footer: at most one ui-btn--glass-white (or ui-btn--glass-danger)
// and the rest ui-btn--glass-clear (glass-one-white); on a phone the footer stacks with the main action last,
// so put the main action last.
// A dialog is for a short confirmation; anything with a form or more than about three fields opens as the right panel
// (SheetContent side="right", sheet.tsx). The dialog sits on the solid surface (glass.css), at most the window less 48
// px tall; its body scrolls between the header and the footer, which stays at the foot under a hairline. Focus goes
// back to what opened it, also when no Trigger did (a menu row, a shortcut). ⌘↵ (Ctrl+Enter) submits the form the focus
// is in.
// On a phone (under 640 px) a dialog of size md or lg is the bottom sheet the drawer already is: it rises from the
// bottom, a grab handle on top (press it, or drag it or the header down, to close), the body scrolls between the header
// and a footer that stays at the foot, and the close circle steps away for the handle (data-phone="sheet"). Size sm
// stays the centred dialog, for short confirmations. On a touch screen the first focus is the title, never the first
// field, so the keyboard does not rise over the buttons before the dialog is read.
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  forwardRef,
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
import { currentOpener, focusFirst, mergeRefs, returnFocusTo } from "./shared";
import { isTouch } from "./touch";

/** The phone, where a dialog of size md or lg becomes a bottom sheet. */
const PHONE = "(max-width: 639.98px)";
const onPhone = () => typeof window !== "undefined" && window.matchMedia(PHONE).matches;

/**
 * On a touch screen, focus a layer's title instead of its first field: the keyboard would rise over the buttons before
 * the dialog is read. Returns true when it took the focus. Used by dialogs, sheets and drawers.
 */
export function focusTitleOnTouch(layer: HTMLElement | null, title: string): boolean {
  if (!layer || !isTouch()) return false;
  const target = layer.querySelector<HTMLElement>(title) ?? layer;
  if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
  return true;
}

/** ⌘↵ / Ctrl+Enter inside a layer submits the form the focus is in (a dialog's, a panel's). */
export function submitOnModEnter(event: ReactKeyboardEvent<HTMLElement>) {
  if (event.defaultPrevented || event.key !== "Enter" || !(event.metaKey || event.ctrlKey) || event.altKey) return;
  const form = (event.target as HTMLElement).closest("form");
  if (!form || !event.currentTarget.contains(form)) return;
  event.preventDefault();
  form.requestSubmit();
}

/** Root. Props: open, defaultOpen, onOpenChange(open), modal (default true). */
export const Dialog = DialogPrimitive.Root;
/** The button that opens the dialog; use asChild around a Button. */
export const DialogTrigger = DialogPrimitive.Trigger;
/** Closes the dialog; use asChild around a footer button (<DialogClose asChild><button className="ui-btn ui-btn--glass-clear">Not yet</button></DialogClose>). */
export const DialogClose = DialogPrimitive.Close;
export const DialogPortal = DialogPrimitive.Portal;
export type DialogProps = DialogPrimitive.DialogProps;

/** The glass scrim under a dialog, sheet or drawer: div.ui-dialog-overlay[data-state]. */
export const DialogOverlay = forwardRef<
  ElementRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay ref={ref} className={cx("ui-dialog-overlay", className)} {...props} />
));
DialogOverlay.displayName = "DialogOverlay";

export type DialogSize = "sm" | "md" | "lg";

export interface DialogContentProps extends ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** sm 400 (confirmations), md 480 (default), lg 640 (the work in view). */
  size?: DialogSize;
  /** The clear close circle top right; default true. */
  showClose?: boolean;
  /** aria-label of the close button; default "Close". */
  closeLabel?: string;
  /** Where the portal mounts; default document.body. */
  container?: HTMLElement | null;
}

const CLOSE_CLASS = "ui-btn ui-btn--glass-clear ui-btn--icon ui-btn--sm ui-dialog-close";
const CHROME = ".ui-dialog-close, .ui-dialog-handle";

interface Drag {
  y: number;
  id: number;
  lastY: number;
  lastT: number;
  v: number;
  moved: boolean;
}

/** The dialog itself, with its scrim, in a portal. Children: DialogHeader, DialogBody, DialogFooter. */
export const DialogContent = forwardRef<ElementRef<typeof DialogPrimitive.Content>, DialogContentProps>(
  (
    {
      size = "md",
      showClose = true,
      closeLabel = "Close",
      container,
      className,
      style,
      children,
      onOpenAutoFocus,
      onCloseAutoFocus,
      onKeyDown,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      ...props
    },
    ref,
  ) => {
    const sheet = size !== "sm";
    const el = useRef<HTMLDivElement | null>(null);
    const opener = useRef<HTMLElement | null>(null);
    const away = useRef<HTMLButtonElement | null>(null);
    const drag = useRef<Drag | null>(null);
    const noClick = useRef(false);
    const [offset, setOffset] = useState(0);
    const [dragging, setDragging] = useState(false);

    // On a phone the sheet drags down by its handle or header and goes when let go far or fast enough.
    const down = (e: ReactPointerEvent<HTMLDivElement>) => {
      onPointerDown?.(e);
      if (e.defaultPrevented || e.button > 0 || !sheet || !onPhone()) return;
      const target = e.target as HTMLElement;
      const grip = target.closest<HTMLElement>(".ui-dialog-handle, .ui-dialog-header");
      if (!grip || target.closest("button:not(.ui-dialog-handle), a, input, textarea, select")) return;
      const now = performance.now();
      drag.current = { y: e.clientY, id: e.pointerId, lastY: e.clientY, lastT: now, v: 0, moved: false };
      try {
        grip.setPointerCapture(e.pointerId);
      } catch {
        /* capture is a nicety */
      }
    };
    const move = (e: ReactPointerEvent<HTMLDivElement>) => {
      onPointerMove?.(e);
      const d = drag.current;
      if (!d || e.pointerId !== d.id) return;
      const dy = Math.max(0, e.clientY - d.y);
      if (!d.moved && dy < 4) return;
      if (!d.moved) {
        d.moved = true;
        setDragging(true);
      }
      setOffset(dy);
      const now = performance.now();
      d.v = (e.clientY - d.lastY) / Math.max(1, now - d.lastT);
      d.lastY = e.clientY;
      d.lastT = now;
    };
    const end = (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.id) return;
      drag.current = null;
      setDragging(false);
      if (!d.moved) return;
      noClick.current = true; // the click after a drag is not a press on the handle
      window.setTimeout(() => {
        noClick.current = false;
      }, 0);
      const dy = Math.max(0, d.lastY - d.y);
      const h = el.current?.offsetHeight ?? 1;
      if (dy > h * 0.3 || (d.v > 0.6 && dy > 24)) away.current?.click();
      else setOffset(0);
    };

    return (
      <DialogPrimitive.Portal container={container}>
        <DialogOverlay />
        <DialogPrimitive.Content
          ref={mergeRefs(ref, el)}
          aria-modal="true"
          data-size={size}
          data-phone={sheet ? "sheet" : undefined}
          data-dragging={dragging ? "" : undefined}
          className={cx(
            "ui-glass ui-dialog",
            size === "sm" && "ui-dialog--sm",
            size === "lg" && "ui-dialog--lg",
            className,
          )}
          // the drag's offset is computed at run time, as the drawer's --drawer-y
          style={sheet ? ({ ...style, "--dialog-y": `${offset}px` } as CSSProperties) : style}
          onOpenAutoFocus={(event) => {
            opener.current = currentOpener();
            onOpenAutoFocus?.(event);
            if (event.defaultPrevented) return;
            const layer = event.currentTarget as HTMLElement;
            // a finger: the title, so the keyboard waits; a mouse or keys: the first control, never the
            // close circle or the handle ([data-ui-autofocus] wins), as dialog.js does
            if (focusTitleOnTouch(layer, ".ui-dialog-title") || focusFirst(layer, CHROME)) event.preventDefault();
          }}
          onCloseAutoFocus={(event) => {
            onCloseAutoFocus?.(event);
            if (!event.defaultPrevented && returnFocusTo(opener.current, el.current)) event.preventDefault();
          }}
          onKeyDown={(event) => {
            onKeyDown?.(event);
            submitOnModEnter(event);
          }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={(e) => {
            onPointerUp?.(e);
            end(e);
          }}
          onPointerCancel={(e) => {
            onPointerCancel?.(e);
            end(e);
          }}
          {...props}
        >
          {sheet && (
            <DialogPrimitive.Close
              className="ui-dialog-handle"
              aria-label={closeLabel}
              onClick={(e) => {
                if (noClick.current) e.preventDefault();
              }}
            />
          )}
          {children}
          {showClose && (
            <DialogPrimitive.Close className={CLOSE_CLASS} aria-label={closeLabel}>
              <Icon name="x" />
            </DialogPrimitive.Close>
          )}
          {sheet && <DialogPrimitive.Close ref={away} hidden tabIndex={-1} aria-hidden="true" />}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    );
  },
);
DialogContent.displayName = "DialogContent";

/** Title and description as one group, 8 apart: div.ui-dialog-header. */
export const DialogHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cx("ui-dialog-header", className)} {...props} />,
);
DialogHeader.displayName = "DialogHeader";

/** h2.ui-dialog-title, wired to the dialog's aria-labelledby. Required by Radix (it warns without one). */
export const DialogTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cx("ui-dialog-title", className)} {...props} />
));
DialogTitle.displayName = "DialogTitle";

/** p.ui-dialog-description, wired to aria-describedby. Without one, pass aria-describedby={undefined} to DialogContent. */
export const DialogDescription = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cx("ui-dialog-description", className)} {...props} />
));
DialogDescription.displayName = "DialogDescription";

/** The work between the words and the actions: div.ui-dialog-body. */
export const DialogBody = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cx("ui-dialog-body", className)} {...props} />
));
DialogBody.displayName = "DialogBody";

/** The actions, right-aligned (stacked on a phone, the last one nearest the thumb): div.ui-dialog-footer. */
export const DialogFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cx("ui-dialog-footer", className)} {...props} />,
);
DialogFooter.displayName = "DialogFooter";
