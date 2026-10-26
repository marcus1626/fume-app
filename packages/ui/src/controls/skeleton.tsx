// Skeleton (design-system/components/skeleton.css), shadcn's skeleton: a sunken placeholder in the exact shape of
// what is coming, breathing slowly. Neighbours start a step apart (index), so the breath travels across a grid.
// Shapes are aria-hidden; put aria-busy and a label on the container that is loading.
// The Engine at work: <Skeleton shape="creative"><SkeletonEngine meta="Generating · 4 of 12" /></Skeleton>.
import { forwardRef, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { cx } from "../cx";
import { Icon } from "../icons";

export type SkeletonShape = "text" | "title" | "pill" | "circle" | "media" | "creative" | "thumb" | "card";

export interface SkeletonProps extends HTMLAttributes<HTMLSpanElement> {
  /** The shape of what is coming. Without one: a soft rectangle you size yourself. */
  shape?: SkeletonShape;
  /** Position in a grid or list: the breath starts index × the instant step later (--i). */
  index?: number;
  /** Width of a text, title or pill shape, as CSS: "40%" (--w). */
  width?: string;
  /** Size of a circle, media or thumb shape, as CSS (--s). */
  size?: string;
  /** Aspect ratio of a creative, as CSS: "9 / 16" (--ratio). Default the feed ratio, 4:5. */
  ratio?: string;
  /** Height of a card shape, as CSS (--h). */
  height?: string;
  /** Inside a surface other than a card: one step deeper. */
  onSurface?: boolean;
  /** On glass outside a .ui-glass parent. */
  onGlass?: boolean;
}

export const Skeleton = forwardRef<HTMLSpanElement, SkeletonProps>(function Skeleton(
  {
    shape,
    index,
    width,
    size,
    ratio,
    height,
    onSurface = false,
    onGlass = false,
    className,
    style,
    children,
    ...props
  },
  ref,
) {
  const vars: Record<string, string | number> = {};
  if (index !== undefined) vars["--i"] = index;
  if (width !== undefined) vars["--w"] = width;
  if (size !== undefined) vars["--s"] = size;
  if (ratio !== undefined) vars["--ratio"] = ratio;
  if (height !== undefined) vars["--h"] = height;
  const hasVars = Object.keys(vars).length > 0;
  return (
    <span
      ref={ref}
      aria-hidden={children ? undefined : true}
      className={cx(
        "ui-skeleton",
        shape && `ui-skeleton--${shape}`,
        onSurface && "ui-skeleton--on-surface",
        onGlass && "ui-skeleton--on-glass",
        className,
      )}
      style={hasVars ? ({ ...style, ...vars } as CSSProperties) : style}
      {...props}
    >
      {children}
    </span>
  );
});

export interface SkeletonEngineProps extends HTMLAttributes<HTMLSpanElement> {
  /** The Engine's progress in words, read by screen readers: "Generating · 4 of 12". */
  meta: ReactNode;
}

/** The Engine and its progress at the centre of a creative's skeleton. */
export const SkeletonEngine = forwardRef<HTMLSpanElement, SkeletonEngineProps>(function SkeletonEngine(
  { meta, className, ...props },
  ref,
) {
  return (
    <span ref={ref} className={cx("ui-skeleton-engine", className)} {...props}>
      <Icon name="fume-engine" />
      <span className="ui-skeleton-meta">{meta}</span>
    </span>
  );
});
