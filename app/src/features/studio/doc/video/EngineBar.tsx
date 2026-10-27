// The Engine bar on a video (FLOWS §27.5): she says what to change ("Cut it to 6 s on the beat", "Hold the last shot
// longer", "No captions"); the Engine shows the change on the timeline, line by line, before anything is kept. Undo
// (Esc) or Keep (Enter), as on a picture. The Engine never talks in its bar.
import { Button, Icon, WithTooltip, useToast } from "@fume/ui";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useDecideEdit, useEngineEdit } from "../../../../api/hooks";
import type { CreativeDocument, VideoEngineEdit } from "../../../../contract";

export function VideoEngineBar({
  doc,
  proposed,
  onBefore,
}: {
  doc: CreativeDocument;
  proposed?: VideoEngineEdit;
  onBefore: () => void;
}) {
  const [text, setText] = useState("");
  const ask = useEngineEdit();
  const decide = useDecideEdit();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const keep = useRef<HTMLButtonElement>(null);
  const canKeep = Boolean(proposed?.changes.length);

  useEffect(() => {
    if (canKeep) keep.current?.focus({ preventScroll: true });
  }, [canKeep, proposed?.id]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const words = text.trim();
    if (!words) return;
    onBefore();
    ask.mutate(
      { documentId: doc.id, text: words },
      {
        onSuccess: () => setText(""),
        onError: (err) => toast.error("The Engine didn’t take that", { description: err.message }),
      },
    );
  };
  const verdict = (v: "keep" | "undo") =>
    proposed &&
    decide.mutate(
      { documentId: doc.id, editId: proposed.id, verdict: v },
      {
        onSuccess: () => input.current?.focus(),
        onError: (err) => toast.error("That didn’t go through", { description: err.message }),
      },
    );
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    verdict("undo");
  };

  return (
    <div className="ui-desk-engine" data-proposed={proposed ? "" : undefined}>
      {proposed && (
        <div className="ui-desk-engine-change" aria-live="polite" onKeyDown={onKey}>
          <div className="ui-desk-engine-words">
            {proposed.changes.length ? (
              <ul className="ui-desk-engine-parts" aria-label="What the Engine would change">
                {proposed.changes.map((c, i) => (
                  <li key={i} className="ui-desk-engine-part" data-read="">
                    <Icon name="circle-check" className="ui-desk-engine-part-icon" />
                    <span className="ui-desk-engine-part-text">
                      <span className="ui-desk-engine-what">{c}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ui-desk-engine-line">
                The Engine found nothing to change for “{proposed.text}”. Try a length, the beat, a shot to slow or
                hold, or captions.
              </p>
            )}
          </div>
          <div className="ui-desk-engine-actions">
            <WithTooltip label="Undo the change" shortcut="Esc">
              <Button
                size="sm"
                variant="quiet"
                icon="undo-2"
                disabled={decide.isPending}
                onClick={() => verdict("undo")}
              >
                {canKeep ? "Undo" : "Close"}
              </Button>
            </WithTooltip>
            {canKeep && (
              <WithTooltip label="Keep the change in the edit" shortcut="↵">
                <Button
                  ref={keep}
                  size="sm"
                  variant="secondary"
                  icon="check"
                  loading={decide.isPending}
                  onClick={() => verdict("keep")}
                >
                  Keep
                </Button>
              </WithTooltip>
            )}
          </div>
        </div>
      )}
      <form className="ui-desk-engine-form" onSubmit={submit}>
        <Icon name="fume-engine" className="ui-desk-engine-mark" />
        <label className="ui-sr-only" htmlFor="engine-bar">
          Tell the Engine what to change
        </label>
        <input
          ref={input}
          id="engine-bar"
          className="ui-input ui-input--sm ui-desk-engine-input"
          placeholder="Tell the Engine what to change, e.g. Cut it to 6 s on the beat"
          value={text}
          autoComplete="off"
          onChange={(e) => setText(e.target.value)}
        />
        <Button
          type="submit"
          size="sm"
          variant="secondary"
          icon="arrow-up"
          loading={ask.isPending}
          disabled={!text.trim()}
        >
          Send
        </Button>
      </form>
    </div>
  );
}
