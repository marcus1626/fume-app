// Alert dialog (design-system/components/dialog.css, shadcn alert-dialog), on Radix Dialog with
// role="alertdialog", as Radix's own AlertDialog does (react-alert-dialog is not a dependency).
// Markup: the dialog's, at size sm (div.ui-glass.ui-dialog.ui-dialog--sm[role=alertdialog][data-size=sm]),
// with no close button. The scrim does not close it: the person chooses; Escape still cancels.
// Focus starts on Cancel, so Enter never deletes by accident. One coloured button: the action is
// Rouge glass (ui-btn--glass-danger) by default; Cancel is clear (ui-btn--glass-clear).
// Words: say what goes ("Delete 3 creatives?"), keep it on the cancel ("Keep them").
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  createContext,
  forwardRef,
  useContext,
  useRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type RefObject,
} from "react";
import { cx } from "../cx";
import { Icon, type IconName } from "../icons";
import { DialogDescription, DialogFooter, DialogHeader, DialogOverlay, DialogTitle, type DialogSize } from "./dialog";
import { currentOpener, mergeRefs, returnFocusTo } from "./shared";

const CancelRefContext = createContext<RefObject<HTMLButtonElement> | null>(null);

/** Root. Props: open, defaultOpen, onOpenChange(open). */
export const AlertDialog = DialogPrimitive.Root;
export type AlertDialogProps = DialogPrimitive.DialogProps;
/** The button that asks (often the danger button or a danger menu row); use asChild. */
export const AlertDialogTrigger = DialogPrimitive.Trigger;

export interface AlertDialogContentProps extends ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** Default sm (400), as shadcn's AlertDialog data-size="sm". */
  size?: DialogSize;
  container?: HTMLElement | null;
}

/** The alert dialog with its scrim, in a portal. Children: AlertDialogHeader, AlertDialogFooter. */
export const AlertDialogContent = forwardRef<ElementRef<typeof DialogPrimitive.Content>, AlertDialogContentProps>(
  (
    {
      size = "sm",
      container,
      className,
      children,
      onOpenAutoFocus,
      onCloseAutoFocus,
      onPointerDownOutside,
      onInteractOutside,
      ...props
    },
    ref,
  ) => {
    const cancelRef = useRef<HTMLButtonElement>(null);
    const el = useRef<HTMLDivElement | null>(null);
    const opener = useRef<HTMLElement | null>(null);
    return (
      <CancelRefContext.Provider value={cancelRef}>
        <DialogPrimitive.Portal container={container}>
          <DialogOverlay />
          <DialogPrimitive.Content
            ref={mergeRefs(ref, el)}
            role="alertdialog"
            aria-modal="true"
            data-size={size}
            className={cx(
              "ui-glass ui-dialog",
              size === "sm" && "ui-dialog--sm",
              size === "lg" && "ui-dialog--lg",
              className,
            )}
            onOpenAutoFocus={(event) => {
              opener.current = currentOpener();
              onOpenAutoFocus?.(event);
              if (event.defaultPrevented || !cancelRef.current) return;
              event.preventDefault();
              cancelRef.current.focus({ preventScroll: true });
            }}
            onCloseAutoFocus={(event) => {
              onCloseAutoFocus?.(event);
              // focus goes back to what asked, also when no Trigger did
              if (!event.defaultPrevented && returnFocusTo(opener.current, el.current)) event.preventDefault();
            }}
            onPointerDownOutside={(event) => {
              onPointerDownOutside?.(event);
              event.preventDefault();
            }}
            onInteractOutside={(event) => {
              onInteractOutside?.(event);
              event.preventDefault();
            }}
            {...props}
          >
            {children}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </CancelRefContext.Provider>
    );
  },
);
AlertDialogContent.displayName = "AlertDialogContent";

/** div.ui-dialog-header. */
export const AlertDialogHeader = DialogHeader;
/** h2.ui-dialog-title. */
export const AlertDialogTitle = DialogTitle;
/** p.ui-dialog-description. */
export const AlertDialogDescription = DialogDescription;
/** div.ui-dialog-footer: Cancel first, the action last (nearest the thumb on a phone). */
export const AlertDialogFooter = DialogFooter;

type CloseProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Close>;

/** Keeps things as they were and closes: button.ui-btn.ui-btn--glass-clear. Gets the focus when the dialog opens. */
export const AlertDialogCancel = forwardRef<ElementRef<typeof DialogPrimitive.Close>, CloseProps>(
  ({ className, ...props }, ref) => {
    const cancelRef = useContext(CancelRefContext);
    return (
      <DialogPrimitive.Close
        ref={mergeRefs(ref, cancelRef ?? undefined)}
        className={cx("ui-btn ui-btn--glass-clear", className)}
        {...props}
      />
    );
  },
);
AlertDialogCancel.displayName = "AlertDialogCancel";

export interface AlertDialogActionProps extends CloseProps {
  /** danger (default): Rouge glass, for delete and other things that cannot be undone; white: the glass white button. */
  variant?: "danger" | "white";
  /** An icon before the words (trash for a delete). */
  icon?: IconName;
}

/**
 * Does it and closes: button.ui-btn.ui-btn--glass-danger (or --glass-white). Call event.preventDefault() in
 * onClick to keep the dialog open while the work runs, then close it through `open`.
 */
export const AlertDialogAction = forwardRef<ElementRef<typeof DialogPrimitive.Close>, AlertDialogActionProps>(
  ({ variant = "danger", icon, className, children, asChild, ...props }, ref) => (
    <DialogPrimitive.Close
      ref={ref}
      asChild={asChild}
      className={cx("ui-btn", variant === "danger" ? "ui-btn--glass-danger" : "ui-btn--glass-white", className)}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {icon && <Icon name={icon} />}
          {children}
        </>
      )}
    </DialogPrimitive.Close>
  ),
);
AlertDialogAction.displayName = "AlertDialogAction";
