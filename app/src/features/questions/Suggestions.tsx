// Fume's help under a question it asks, for the question sheet, the inline answer and the product check:
// - A suggestion shows what it says, inline, under its name ("Same as Night Body Oil" alone is not enough); pressed, it
//   puts those words in the field.
// - When the brand's website did not say, Fume says so in one line and offers what this kind of product usually says.
//   Each is a pill with its own words; pressed, it adds that line to the answer (one claim per line), pressed again it
//   takes it out.
import { Button, Icon } from "@fume/ui";
import type { OpenQuestion } from "../../contract";

const linesOf = (text: string) =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

export interface AnswerSuggestionsProps {
  question: Pick<OpenQuestion, "suggestions" | "templates" | "templatesWhy"> | undefined;
  /** The answer as it stands in the field. */
  value: string;
  onChange: (text: string) => void;
  /** On Smoke glass (the sheet, the product check panel): clear veils, never a second white pill. */
  glass?: boolean;
}

export function AnswerSuggestions({ question, value, onChange, glass }: AnswerSuggestionsProps) {
  const suggestions = question?.suggestions ?? [];
  const templates = question?.templates ?? [];
  if (!suggestions.length && !templates.length) return null;
  const lines = linesOf(value);
  const toggle = (line: string) =>
    onChange((lines.includes(line) ? lines.filter((l) => l !== line) : [...lines, line]).join("\n"));
  return (
    <div className="ui-qs-help" data-glass={glass || undefined}>
      {suggestions.length > 0 && (
        <div className="ui-qs-choices" role="group" aria-label="Fume suggests">
          {suggestions.map((s) => {
            const on = value.trim() === s.text.trim();
            return (
              <button
                key={s.label}
                type="button"
                className="ui-qs-choice"
                aria-pressed={on}
                onClick={() => onChange(on ? "" : s.text)}
              >
                <span className="ui-qs-choice-label">
                  {on && <Icon name="check" />}
                  {s.label}
                </span>
                <span className="ui-qs-choice-text">{s.text}</span>
              </button>
            );
          })}
        </div>
      )}
      {templates.length > 0 && (
        <div className="ui-qs-templates">
          {question?.templatesWhy && <p className="ui-qs-templates-why">{question.templatesWhy}</p>}
          <div className="ui-qs-suggest" role="group" aria-label="What this kind of product usually says">
            {templates.map((t) => {
              const on = lines.includes(t.text);
              return (
                <Button
                  key={t.label}
                  type="button"
                  size="sm"
                  variant={glass ? "glass-clear" : "secondary"}
                  icon={on ? "check" : "plus"}
                  aria-pressed={on}
                  onClick={() => toggle(t.text)}
                >
                  {t.text}
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
