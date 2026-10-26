// Input group (design-system/components/input-group.css), shadcn's InputGroup, InputGroupAddon (align
// inline-start | inline-end | block-start | block-end), InputGroupText, InputGroupInput, InputGroupTextarea and
// InputGroupButton. The whole group is the field: one white surface, one hairline, one focus ring around it all.
//   <InputGroup role="search">
//     <InputGroupAddon><Icon name="search" /></InputGroupAddon>
//     <InputGroupInput placeholder="Search creatives" value={q} onChange={…} onClear={() => setQ("")} />
//     <InputGroupAddon align="inline-end"><Kbd>⌘K</Kbd>
//       <InputGroupButton clear aria-label="Clear search" onClick={() => setQ("")} /></InputGroupAddon>
//   </InputGroup>
// Clear shows only while the field holds text, and needs a placeholder on the input (the CSS reads
// :placeholder-shown). Escape in a field with a clear button calls onClear.
import { forwardRef, type HTMLAttributes, type InputHTMLAttributes, type KeyboardEvent, type MouseEvent } from "react";
import { cx } from "../cx";
import { Button, type ButtonProps } from "./button";
import { growTextarea, type TextareaProps } from "./field";
import { composeRefs } from "./slot";

export interface InputGroupProps extends HTMLAttributes<HTMLDivElement> {
  /** sm, md (default), lg. */
  size?: "sm" | "md" | "lg";
  /** Rouge edge (also automatic when a control inside has aria-invalid). */
  invalid?: boolean;
  /** Disabled look (also automatic when the control inside is disabled). */
  disabled?: boolean;
}

export const InputGroup = forwardRef<HTMLDivElement, InputGroupProps>(function InputGroup(
  { size = "md", invalid, disabled, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      data-invalid={invalid ? "true" : undefined}
      data-disabled={disabled ? "true" : undefined}
      className={cx("ui-input-group", size !== "md" && `ui-input-group--${size}`, className)}
      {...props}
    />
  );
});

export interface InputGroupAddonProps extends HTMLAttributes<HTMLDivElement> {
  /** Default "inline-start". */
  align?: "inline-start" | "inline-end" | "block-start" | "block-end";
}

/** Something inside the field: an icon, words, a key hint or a button. A click on it (not on a button) focuses the control. */
export const InputGroupAddon = forwardRef<HTMLDivElement, InputGroupAddonProps>(function InputGroupAddon(
  { align = "inline-start", className, onClick, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      data-align={align}
      className={cx("ui-input-group-addon", className)}
      onClick={(e: MouseEvent<HTMLDivElement>) => {
        onClick?.(e);
        if (e.defaultPrevented || (e.target as Element).closest("button, a, input, textarea, select")) return;
        const control = e.currentTarget.parentElement?.querySelector<HTMLElement>(
          ".ui-input-group-input, .ui-input-group-textarea",
        );
        control?.focus();
      }}
      {...props}
    />
  );
});

/** Quiet words inside the field: "https://", "kr". */
export const InputGroupText = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>(function InputGroupText(
  { className, ...props },
  ref,
) {
  return <span ref={ref} className={cx("ui-input-group-text", className)} {...props} />;
});

export interface InputGroupInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Called on Escape while the field holds text (pair with an InputGroupButton clear). */
  onClear?: () => void;
}

/** The input inside the group: no edge or ring of its own. */
export const InputGroupInput = forwardRef<HTMLInputElement, InputGroupInputProps>(function InputGroupInput(
  { type = "text", onClear, onKeyDown, className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cx("ui-input-group-input", className)}
      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
        onKeyDown?.(e);
        if (!e.defaultPrevented && onClear && e.key === "Escape" && e.currentTarget.value) {
          e.preventDefault();
          onClear();
        }
      }}
      {...props}
    />
  );
});

/** The textarea inside the group; it grows with its text. Put buttons under it in an addon with align="block-end". */
export const InputGroupTextarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function InputGroupTextarea(
  { className, onInput, ...props },
  ref,
) {
  return (
    <textarea
      ref={composeRefs(ref, growTextarea)}
      className={cx("ui-input-group-textarea", className)}
      onInput={(e) => {
        growTextarea(e.currentTarget);
        onInput?.(e);
      }}
      {...props}
    />
  );
});

export interface InputGroupButtonProps extends ButtonProps {
  /** The clear button: a quiet circle with circle-x, shown only while the field holds text. Give it an aria-label
   *  ("Clear search") and an onClick that empties the value; focus goes back to the field. */
  clear?: boolean;
}

/** A small button inside the group: quiet by default (variant="primary" for the Ink send button). */
export const InputGroupButton = forwardRef<HTMLButtonElement, InputGroupButtonProps>(function InputGroupButton(
  { clear = false, variant = "quiet", iconOnly, icon, size, className, onClick, ...props },
  ref,
) {
  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      iconOnly={iconOnly ?? (clear || (!!icon && !props.children))}
      icon={clear ? "circle-x" : icon}
      data-ui-clear={clear ? "" : undefined}
      className={cx("ui-input-group-button", className)}
      onClick={(e) => {
        onClick?.(e);
        if (clear)
          e.currentTarget
            .closest(".ui-input-group")
            ?.querySelector<HTMLElement>(".ui-input-group-input, .ui-input-group-textarea")
            ?.focus();
      }}
      {...props}
    />
  );
});
