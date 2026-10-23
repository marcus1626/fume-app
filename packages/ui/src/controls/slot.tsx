// Slot: the asChild helper for controls that are not Radix primitives (Button, Badge). It renders its one child
// element with the parent's props merged in: classes joined, event handlers chained (the child's first), styles
// merged, refs composed. A tiny stand-in for @radix-ui/react-slot, which is not a dependency of @fume/ui.
import {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
} from "react";
import { cx } from "../cx";

/** Sets every ref it is given (callback refs and object refs). */
export function composeRefs<T>(...refs: Array<Ref<T> | undefined>): (node: T | null) => void {
  return (node) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as { current: T | null }).current = node;
    }
  };
}

export interface SlotProps extends HTMLAttributes<HTMLElement> {
  children?: ReactNode;
}

type AnyProps = Record<string, unknown> & { ref?: Ref<HTMLElement> };

/** Renders its only child with these props merged into it. */
export const Slot = forwardRef<HTMLElement, SlotProps>(function Slot({ children, ...slotProps }, ref) {
  const child = Children.only(children);
  if (!isValidElement<AnyProps>(child)) return null;
  const childProps = child.props;
  const merged: AnyProps = { ...slotProps, ...childProps };
  for (const key of Object.keys(slotProps)) {
    const ours = (slotProps as Record<string, unknown>)[key];
    const theirs = childProps[key];
    if (/^on[A-Z]/.test(key) && typeof ours === "function" && typeof theirs === "function") {
      merged[key] = (...args: unknown[]) => {
        (theirs as (...a: unknown[]) => void)(...args);
        (ours as (...a: unknown[]) => void)(...args);
      };
    }
  }
  merged.className = cx(slotProps.className, childProps.className as string | undefined);
  if (slotProps.style || childProps.style)
    merged.style = { ...slotProps.style, ...(childProps.style as object | undefined) };
  // React 18 keeps the child's ref on the element, not in its props.
  const childRef = (child as unknown as { ref?: Ref<HTMLElement> }).ref;
  merged.ref = composeRefs(ref, childRef);
  return cloneElement(child, merged);
});
