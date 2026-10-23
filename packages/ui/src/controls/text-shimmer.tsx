// Shimmer text (design-system/components/text-shimmer.css): a band of white light through dark words that say
// something is under way right now ("Making creatives, 7 of 12"), the Engine's words included: the Amber variant
// was taken out on 15 Oct (Marcus: "Bytt Engine shimmer teksten til vanlig shimmer"). At most one line shimmers
// in a view; never on a decision, a check or the upload box. It rests by itself on glass, with reduced motion and
// in forced colours.
import { forwardRef, type HTMLAttributes } from "react";
import { cx } from "../cx";

export type TextShimmerProps = HTMLAttributes<HTMLSpanElement>;

export const TextShimmer = forwardRef<HTMLSpanElement, TextShimmerProps>(function TextShimmer({ className, ...props }, ref) {
  return <span ref={ref} className={cx("ui-text-shimmer", className)} {...props} />;
});
