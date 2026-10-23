// Checkbox (design-system/components/checkbox.css) on @radix-ui/react-checkbox: a 20 px soft square, white with the
// allowed hairline; checked, the edge thickens inward to Ink and the Porcelain check lands; indeterminate is a dash.
// Never Amber. Pair it with words in a Choice row (choice.tsx). checked: true | false | "indeterminate".
// Select all: keep the parent's state yourself (some checked → "indeterminate").
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cx } from "../cx";

export type CheckedState = CheckboxPrimitive.CheckedState;

export interface CheckboxProps extends ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {}

export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(function Checkbox({ className, ...props }, ref) {
  return (
    <CheckboxPrimitive.Root ref={ref} className={cx("ui-checkbox", className)} {...props}>
      {/* Both marks always present: the CSS fades in the one that matches the state. */}
      <CheckboxPrimitive.Indicator forceMount className="ui-checkbox-indicator">
        <svg className="ui-checkbox-check" aria-hidden="true">
          <use href="#fi-check" />
        </svg>
        <svg className="ui-checkbox-minus" aria-hidden="true">
          <use href="#fi-minus" />
        </svg>
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
