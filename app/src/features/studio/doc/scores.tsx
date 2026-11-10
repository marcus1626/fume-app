// The Engine's scores of a version (FLOWS §34.1, §35.3, PROPOSED). Marcus, 9 Nov: the Engine's judgement never stops
// the designer; she always has the last word. So a version under the bar is still made and shown, with a clear
// warning. It goes on only when she sends it, and Check shows the warning.
// Round 15 (PROPOSED 9 Nov 2026), Marcus: more scores, the product part by part, scores only once something is made,
// and a board that looks like Fume. So:
// - A version is scored on what matters for its studio (a picture, a design, a video), each a row: the name, the
//   number in GT Standard with tabular figures, and a thin Ink bar on the chart track with the bar at 80.
// - The product opens part by part (label, cap, glass, size), from its verified facts.
// - Under the bar is said in words and with a small warning mark, never in Rouge: Rouge is for errors and delete only,
//   and a low score is the Engine's view, not an error. Never Amber: nothing here is a person's check.
// - The board answers in words first: "Under the bar on Product" or "Over the bar on all four".
import { Button, Icon } from "@fume/ui";
import { useState, type CSSProperties } from "react";
import type { Evaluation, RenderVersion, ScoreMeasure } from "../../../contract";
import { SCORE_BAR, lowest, measuresOf, underBar } from "../../../domain/scores";

/** "Product 52 · Brand 74": the scores under the bar, worst first; all of them when none is. */
export function scoreLine(v: Pick<RenderVersion, "evaluation">): string {
  const under = underBar(v.evaluation);
  const shown = under.length ? under : measuresOf(v.evaluation);
  return shown.map((m) => `${m.label} ${m.value}`).join(" · ");
}

/** The board's answer in words: where the version stands against the bar. */
export function scoreHeadline(evaluation: Evaluation | undefined): string {
  const all = measuresOf(evaluation);
  const under = underBar(evaluation);
  if (!all.length) return "Not scored yet";
  if (!under.length)
    return all.length === 2 ? "Over the bar on both" : `Over the bar on all ${WORDS[all.length] ?? all.length}`;
  return `Under the bar on ${listWords(under.map((m) => m.label))}`;
}

/** The short form of the warning, for a chip: "Under the bar · Product 52", or "Scores · 88" (the lowest). */
export function scoreChip(evaluation: Evaluation | undefined): string {
  const under = underBar(evaluation);
  if (under.length) return `Under the bar · ${under[0]!.label} ${under[0]!.value}`;
  const low = lowest(evaluation);
  return low ? `Over the bar · lowest ${low.value}` : "Not scored yet";
}

const WORDS: Record<number, string> = { 3: "three", 4: "four", 5: "five", 6: "six" };

function listWords(words: string[]): string {
  if (words.length < 2) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}

/** The board: what one version is scored on, with the bar. */
export function ScoreBoard({
  id,
  evaluation,
  why = true,
  parts = "fold",
  onWhy,
  whyLabel = "The Engine’s checks",
}: {
  /** The version's or the item's id, for the meters' names. */
  id: string;
  evaluation: Evaluation;
  /** Say why a score is under the bar, one line under its row. */
  why?: boolean;
  /** The product part by part: shown, folded under the Product row, or left out. */
  parts?: "open" | "fold" | "none";
  /** Opens the detail behind the scores (the prompt and its checks, for Fume's people). */
  onWhy?: () => void;
  whyLabel?: string;
}) {
  const all = measuresOf(evaluation);
  if (!all.length) return <p className="ui-sc-help">Scores come once the version is made.</p>;
  return (
    <div className="ui-score-board">
      <p className="ui-score-head" data-under={underBar(evaluation).length ? "" : undefined}>
        {underBar(evaluation).length > 0 && <Icon name="triangle-alert" />}
        {scoreHeadline(evaluation)}
      </p>
      <ul className="ui-score-rows" aria-label="Scores">
        {all.map((m) => (
          <ScoreRow key={m.id} id={`${id}-${m.id}`} m={m} why={why} parts={parts} />
        ))}
      </ul>
      <div className="ui-score-foot">
        <span>
          <Icon name="minus" className="ui-score-foot-mark" /> The bar is {SCORE_BAR}
        </span>
        {onWhy && (
          <Button size="sm" variant="quiet" icon="file-text" onClick={onWhy}>
            {whyLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

function ScoreRow({
  id,
  m,
  why,
  parts,
}: {
  id: string;
  m: ScoreMeasure;
  why: boolean;
  parts: "open" | "fold" | "none";
}) {
  const low = m.value < SCORE_BAR;
  const hasParts = parts !== "none" && Boolean(m.parts?.length);
  // A product with a part under the bar opens by itself; the rest stay folded until asked.
  const [open, setOpen] = useState(parts === "open" || Boolean(m.parts?.some((p) => p.value < SCORE_BAR)));
  return (
    <li className="ui-score" data-under={low ? "" : undefined}>
      {hasParts ? (
        <button
          type="button"
          className="ui-score-name ui-score-toggle"
          id={`score-${id}`}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {m.label}
          <Icon name={open ? "chevron-up" : "chevron-down"} />
        </button>
      ) : (
        <span className="ui-score-name" id={`score-${id}`}>
          {m.label}
        </span>
      )}
      <span className="ui-score-num">
        {low && <Icon name="triangle-alert" className="ui-score-mark" />}
        {m.value}
      </span>
      <Meter labelledBy={`score-${id}`} value={m.value} />
      {low && why && m.why && <p className="ui-score-why">{m.why}</p>}
      {hasParts && open && (
        <ul className="ui-score-parts" aria-label={`${m.label}, part by part`}>
          {m.parts!.map((p) => (
            <li key={p.label} className="ui-score-part" data-under={p.value < SCORE_BAR ? "" : undefined}>
              <span className="ui-score-part-name" id={`score-${id}-${p.label}`}>
                {p.label}
              </span>
              <span className="ui-score-part-num">{p.value}</span>
              <Meter labelledBy={`score-${id}-${p.label}`} value={p.value} small />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function Meter({ labelledBy, value, small }: { labelledBy: string; value: number; small?: boolean }) {
  return (
    <span
      className="ui-score-meter"
      data-size={small ? "sm" : undefined}
      role="meter"
      aria-labelledby={labelledBy}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-valuetext={`${value} of 100, ${value < SCORE_BAR ? "under" : "over"} the bar of ${SCORE_BAR}`}
      style={{ "--score": value, "--bar": SCORE_BAR } as CSSProperties}
    >
      <span className="ui-score-fill" />
      <span className="ui-score-bar" />
    </span>
  );
}
