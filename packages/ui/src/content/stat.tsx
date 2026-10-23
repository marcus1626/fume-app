// Stat tile: design-system/components/stat.css, a card (card.css) with a label, the number, the comparison in words
// and a sparkline (chart.css, type "spark"). The number leads; the comparison is words and the trending icon in Ink,
// never red or green. Approvals: at most the small checked triangle beside the label (Amber). In a StatGrid the tiles
// of a row line up part by part (subgrid). States: loading (skeletons in the tile's shapes), empty (0 in tertiary,
// the words that start the count, a flat line) and error (words beside a Rouge circle-alert, a quiet Try again).
import { Fragment, forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cx } from "../cx";
import { Icon } from "../icons";
import { Chart, type ChartDatum } from "./chart";
import { cssVars } from "./internal";

export function StatGrid({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("ui-stat-grid", className)} {...props} />;
}

export interface StatValuePart {
  num: ReactNode;
  /** A unit in words beside the number ("h", "min"). */
  unit?: ReactNode;
}

export interface StatSpark {
  /** The trend in words; the sparkline's name ("Creatives delivered, 1 to 13 October"). */
  title: string;
  /** The SVG's description in words. */
  summary?: string;
  data: number[] | ChartDatum[];
  /** Default var(--ui-stat-spark-line); approved tiles take var(--ui-chart-approved). */
  color?: string;
  unit?: string;
  format?: "minutes";
  min?: number;
}

export interface StatProps extends HTMLAttributes<HTMLDivElement> {
  label: ReactNode;
  /** The number: a plain value ("1,284") or parts with units ([{num: 3, unit: "h"}, {num: 40, unit: "min"}]). */
  value?: ReactNode | StatValuePart[];
  /** The comparison in words; wrap the figure in StatDeltaNum. */
  delta?: ReactNode;
  /** The trending icon before the comparison. */
  trend?: "up" | "down";
  /** The tile counts checked work: the Amber triangle beside the label, and an Amber sparkline. */
  approved?: boolean;
  spark?: StatSpark;
  state?: "loading" | "empty" | "error";
  /** Empty: what starts the count ("Your first brief starts the count."). */
  emptyDescription?: ReactNode;
  /** Empty: the flat line's name ("No creatives delivered yet"). */
  emptyLabel?: string;
  /** Error: "This number didn’t load." */
  errorMessage?: ReactNode;
  onRetry?: () => void;
  /** "Try again". */
  retryLabel?: string;
}

const isParts = (v: unknown): v is StatValuePart[] =>
  Array.isArray(v) && v.every((x) => typeof x === "object" && x !== null && "num" in (x as object));

/** One stat tile (div.ui-card.ui-stat). */
export const Stat = forwardRef<HTMLDivElement, StatProps>(function Stat(
  {
    label,
    value,
    delta,
    trend,
    approved,
    spark,
    state,
    emptyDescription,
    emptyLabel,
    errorMessage = "This number didn’t load.",
    onRetry,
    retryLabel = "Try again",
    className,
    ...props
  },
  ref,
) {
  if (state === "loading") {
    return (
      <div ref={ref} className={cx("ui-card ui-stat", className)} aria-busy="true" {...props}>
        <div className="ui-stat-head">
          <p className="ui-stat-label">
            <span className="ui-skeleton ui-skeleton--text" style={cssVars({ "--w": "72%" })} />
          </p>
          <p className="ui-stat-value">
            <span className="ui-skeleton ui-skeleton--title" style={cssVars({ "--w": "56%", "--i": 1 })} />
          </p>
          <p className="ui-stat-delta">
            <span className="ui-skeleton ui-skeleton--text" style={cssVars({ "--w": "84%", "--i": 2 })} />
          </p>
        </div>
        <div className="ui-stat-spark">
          <span className="ui-skeleton" style={cssVars({ "--i": 3 })} />
        </div>
      </div>
    );
  }

  const labelEl = (
    <p className="ui-stat-label">
      {approved && <Icon name="fume-check" className="ui-stat-approved" />}
      <span>{label}</span>
    </p>
  );

  if (state === "error") {
    return (
      <div ref={ref} className={cx("ui-card ui-stat ui-stat--error", className)} {...props}>
        <div className="ui-stat-head">
          {labelEl}
          <p className="ui-stat-error">
            <Icon name="circle-alert" />
            <span>{errorMessage}</span>
          </p>
        </div>
        <button className="ui-btn ui-btn--quiet ui-btn--sm ui-stat-retry" type="button" onClick={onRetry}>
          <Icon name="rotate-ccw" />
          {retryLabel}
        </button>
      </div>
    );
  }

  const empty = state === "empty";
  const parts: StatValuePart[] = isParts(value)
    ? value
    : [{ num: empty && value === undefined ? 0 : (value as ReactNode) }];
  return (
    <div ref={ref} className={cx("ui-card ui-stat", empty && "ui-stat--empty", className)} {...props}>
      <div className="ui-stat-head">
        {labelEl}
        <p className="ui-stat-value">
          {parts.map((p, i) => (
            <Fragment key={i}>
              <span className="ui-stat-num">{p.num}</span>
              {p.unit !== undefined && <span className="ui-stat-unit">{p.unit}</span>}
            </Fragment>
          ))}
        </p>
        {empty ? (
          <p className="ui-stat-delta">
            <span>{emptyDescription}</span>
          </p>
        ) : (
          delta !== undefined && (
            <p className="ui-stat-delta">
              {trend && <Icon name={trend === "up" ? "trending-up" : "trending-down"} />}
              <span>{delta}</span>
            </p>
          )
        )}
      </div>
      {empty ? (
        <div className="ui-stat-spark" role="img" aria-label={emptyLabel}>
          <span className="ui-stat-flat" />
        </div>
      ) : (
        spark && (
          <Chart
            type="spark"
            className="ui-stat-spark"
            title={spark.title}
            summary={spark.summary}
            data={spark.data}
            unit={spark.unit}
            format={spark.format}
            min={spark.min}
            config={{
              value: {
                label: spark.title,
                color: spark.color ?? (approved ? "var(--ui-chart-approved)" : "var(--ui-stat-spark-line)"),
              },
            }}
          />
        )
      )}
    </div>
  );
});

/** The figure inside the comparison's sentence ("<StatDeltaNum>18%</StatDeltaNum> more than 1–13 Sep"). */
export function StatDeltaNum({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cx("ui-stat-delta-num", className)} {...props} />;
}
