// The Engine's scores of a picture (FLOWS §34.1, PROPOSED). Marcus, 9 Nov: the Engine's judgement never stops the
// designer; she always has the last word. So a picture under the bar is still rendered and shown, with a clear warning,
// and the score board in the left panel says why. It goes on only when she sends it, and Check shows the warning.
// - Two scores: the product (against its photographs and verified facts) and the Engine (the brand's rules, taste and
//   the planned scene). A number, a meter with the bar on it, and under the bar one line on why.
// - Rouge only for a score under the bar: it works against a rule. Never Amber: nothing here is a person's check.
import { Button, Icon } from "@fume/ui";
import type { CSSProperties } from "react";
import type { Evaluation, RenderVersion, Scores } from "../../../contract";
import { SCORE_BAR, underBar } from "../../../domain/scores";

const names: Record<keyof Omit<Scores, "why">, string> = { engine: "Engine", product: "Product" };

/** "Engine 58 · Product 64": the scores under the bar, worst first; all of them when none is. */
export function scoreLine(v: Pick<RenderVersion, "evaluation">): string {
  const s = v.evaluation.scores;
  if (!s) return "";
  const under = underBar(v.evaluation);
  const keys = under.length ? under : (["engine", "product"] as const);
  return keys.map((k) => `${names[k]} ${s[k]}`).join(" · ");
}

/** The board: both scores of one picture, with the bar. */
export function ScoreBoard({
  id,
  evaluation,
  why = true,
  onWhy,
  whyLabel = "The Engine’s checks",
}: {
  /** The version's or the item's id, for the meters' names. */
  id: string;
  evaluation: Evaluation;
  /** Say why a score is under the bar (Check leaves it to the findings under the board). */
  why?: boolean;
  /** Opens the detail behind the scores (the prompt and its checks, for Fume's people). */
  onWhy?: () => void;
  whyLabel?: string;
}) {
  const s = evaluation.scores;
  if (!s) return <p className="ui-sc-help">The Engine has not scored this picture.</p>;
  const under = new Set(underBar(evaluation));
  const version = { id };
  return (
    <div className="ui-score-board">
      {(["engine", "product"] as const).map((k) => {
        const low = under.has(k);
        const lines = why ? (s.why?.filter((w) => w.score === k) ?? []) : [];
        return (
          <div key={k} className="ui-score" data-under={low ? "" : undefined}>
            <span className="ui-score-name" id={`score-${version.id}-${k}`}>
              {names[k]}
            </span>
            <span className="ui-score-num">{s[k]}</span>
            <span
              className="ui-score-meter"
              role="meter"
              aria-labelledby={`score-${version.id}-${k}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={s[k]}
              aria-valuetext={`${s[k]} of 100, ${low ? "under" : "over"} the bar of ${SCORE_BAR}`}
              style={{ "--score": s[k], "--bar": SCORE_BAR } as CSSProperties}
            >
              <span className="ui-score-fill" />
              <span className="ui-score-bar" />
            </span>
            {low &&
              lines.map((w) => (
                <p key={w.text} className="ui-score-why">
                  {w.text}
                </p>
              ))}
          </div>
        );
      })}
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
