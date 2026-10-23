// Switch (design-system/components/switch.css) on @radix-ui/react-switch: a pill track, off sunken, on Ink (never
// Amber); the white thumb slides and stretches toward where it is going when pressed. Pair it with words in a
// Choice row (<Choice end>). Sizes md 40 × 24 (default) and sm 32 × 20; glass inside a .ui-glass surface.
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cx } from "../cx";

export interface SwitchProps extends ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> {
  /** Default "md". */
  size?: "sm" | "md";
  /** On glass: a Porcelain veil off, glass white on with an Ink thumb. */
  glass?: boolean;
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { size = "md", glass = false, className, ...props },
  ref,
) {
  return (
    <SwitchPrimitive.Root
      ref={ref}
      className={cx("ui-switch", size === "sm" && "ui-switch--sm", glass && "ui-switch--glass", className)}
      {...props}
    >
      <SwitchPrimitive.Thumb className="ui-switch-thumb" />
    </SwitchPrimitive.Root>
  );
});
