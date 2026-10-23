// Radio group (design-system/components/radio.css) on @radix-ui/react-radio-group: 20 px circles; chosen, a 6 px Ink
// ring around a Porcelain centre. Radix gives roving focus and the arrow keys. Never Amber.
//   <RadioGroup aria-label="Delivery" value={v} onValueChange={setV}>
//     <Choice><RadioGroupItem value="now" /><ChoiceText label="Deliver now" /></Choice> …</RadioGroup>
// Radio cards (pick one of a few, each with a preview): <RadioGroup cards> with RadioCard children.
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { forwardRef, type ComponentPropsWithoutRef, type HTMLAttributes, type LabelHTMLAttributes, type ReactNode } from "react";
import { cx } from "../cx";

export interface RadioGroupProps extends ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root> {
  /** A grid of RadioCards (.ui-radio-cards). */
  cards?: boolean;
}

export const RadioGroup = forwardRef<HTMLDivElement, RadioGroupProps>(function RadioGroup({ cards = false, orientation, className, ...props }, ref) {
  return (
    <RadioGroupPrimitive.Root
      ref={ref}
      orientation={orientation}
      data-orientation={orientation}
      className={cx("ui-radio-group", cards && "ui-radio-cards", className)}
      {...props}
    />
  );
});

export interface RadioGroupItemProps extends ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item> {}

/** One radio. Inside a Choice row its words label it; on its own give it an aria-label. */
export const RadioGroupItem = forwardRef<HTMLButtonElement, RadioGroupItemProps>(function RadioGroupItem({ className, ...props }, ref) {
  return (
    <RadioGroupPrimitive.Item ref={ref} className={cx("ui-radio", className)} {...props}>
      <RadioGroupPrimitive.Indicator className="ui-radio-indicator" />
    </RadioGroupPrimitive.Item>
  );
});

export interface RadioCardProps extends Omit<LabelHTMLAttributes<HTMLLabelElement>, "title"> {
  /** The option's value. */
  value: string;
  /** Its title: "Feed". */
  title: ReactNode;
  /** Data beside the title, in the mono face: "1080 × 1350 · 4:5". */
  meta?: ReactNode;
  /** A small preview above (an image or a frame in the format's shape). */
  preview?: ReactNode;
  disabled?: boolean;
  /** Accessible name for the radio; default the title when it is a string. */
  itemLabel?: string;
}

/** A card that picks one option: preview, title and meta, and the radio at the end of its head. */
export const RadioCard = forwardRef<HTMLButtonElement, RadioCardProps>(function RadioCard(
  { value, title, meta, preview, disabled, itemLabel, className, ...props },
  ref,
) {
  return (
    <label className={cx("ui-radio-card", className)} data-disabled={disabled ? "" : undefined} {...props}>
      {preview !== undefined ? <span className="ui-radio-card-preview">{preview}</span> : null}
      <span className="ui-radio-card-head">
        <span className="ui-radio-card-text">
          <span className="ui-radio-card-title">{title}</span>
          {meta !== undefined ? <span className="ui-radio-card-meta">{meta}</span> : null}
        </span>
        <RadioGroupItem ref={ref} value={value} disabled={disabled} aria-label={itemLabel ?? (typeof title === "string" ? title : undefined)} />
      </span>
    </label>
  );
});

/** The preview slot of a custom card, if you build one by hand. */
export const RadioCardPreview = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>(function RadioCardPreview({ className, ...props }, ref) {
  return <span ref={ref} className={cx("ui-radio-card-preview", className)} {...props} />;
});
