// "Write with Engine" on a field (Round 15, PROPOSED 9 Nov 2026). Marcus, 9 Nov: "every field should have a button
// where you can ask the Engine to write it; then perhaps also open a chat, a mini chat by the field or the right-side
// panel with a reference to the field". Two small buttons by each field Fume's people (and an agency's) may change:
// - Write with Engine: the Engine writes the field from what it knows. Its words come as a suggestion under the field,
//   with what it wrote them from; she keeps them (written as if she had, with the field's own save) or drops them. They
//   are never written over her words on their own.
// - Ask about this: the Engine panel opens on the page's thread with the field as context ("Light · Winter gifting's
//   plan"); a line the Engine writes there can be put by the field the same way.
// Customers never see either: they talk to Fume, not the Engine. The look is engine-panel.css.
import { Button, Icon, TextShimmer, useToast } from "@fume/ui";
import { useEffect, useState, type ReactNode } from "react";
import { useEngineWrite, useSession } from "../../api/hooks";
import type { EngineField, EngineWriting } from "../../contract";
import { customerViewOn } from "../../shell/scope";
import { enginePanel, fieldKey, useEngineState } from "./panel";

/** Whether this person works with the Engine: Fume's people and an agency's designers, never a customer (and not
 *  while Fume's person looks through Customer view). Fume's admin follows the brands and does not make. */
export function useSeesEngine(): boolean {
  const user = useSession().data?.user;
  return Boolean(user?.staffRole && user.staffRole !== "admin" && !customerViewOn());
}

/** A field's name in the words of the buttons: "the light", "Master 2's words". */
const lower = (label: string) => (/^[A-Z][a-z]/.test(label) ? label.charAt(0).toLowerCase() + label.slice(1) : label);

/**
 * The Engine by one field: its two buttons, and the suggestion (or the writing) to show under the field. `onKeep`
 * writes the words into the field the way she would. Nothing for someone who does not work with the Engine.
 */
export function useEngineField({
  field,
  where,
  onKeep,
  enabled = true,
  writes = true,
}: {
  field: EngineField;
  /** Where the field is, for the panel's context line: "Winter gifting's plan". */
  where: string;
  onKeep: (text: string) => void;
  enabled?: boolean;
  /** False for a field of facts the Engine does not write (the products, the formats): only "Ask about this". */
  writes?: boolean;
}): { tools: ReactNode; suggestion: ReactNode } {
  const sees = useSeesEngine() && enabled;
  const write = useEngineWrite();
  const toast = useToast();
  const key = fieldKey(field);
  const offered = useEngineState((s) => s.offers[key]);
  const [wrote, setWrote] = useState<EngineWriting>();
  // Words the Engine wrote in the panel and she put here: shown like its own
  useEffect(() => {
    if (!offered) return;
    setWrote({ text: offered, why: "From the Engine panel." });
    enginePanel.takeOffer(key);
  }, [offered, key]);
  if (!sees) return { tools: null, suggestion: null };

  const name = lower(field.label);
  const ask = () =>
    write.mutate(field, {
      onSuccess: setWrote,
      onError: (err) => toast.error("The Engine didn’t write that", { description: err.message }),
    });
  const tools = (
    <span className="ui-engine-field-tools">
      {writes && (
        <Button
          size="sm"
          variant="quiet"
          iconOnly
          icon="fume-engine"
          tooltip="Write with Engine"
          aria-label={`Write ${name} with Engine`}
          disabled={write.isPending}
          onClick={ask}
        />
      )}
      <Button
        size="sm"
        variant="quiet"
        iconOnly
        icon="message-square"
        tooltip="Ask about this"
        aria-label={`Ask the Engine about ${name}`}
        onClick={() => enginePanel.ask({ field, where })}
      />
    </span>
  );
  const same = wrote && wrote.text.trim() === field.value.trim();
  const suggestion = write.isPending ? (
    <span className="ui-engine-suggest" data-writing="" role="status">
      <TextShimmer>{`The Engine is writing ${name}`}</TextShimmer>
    </span>
  ) : wrote ? (
    <span className="ui-engine-suggest" role="status" aria-label={`The Engine’s suggestion for ${name}`}>
      <span className="ui-engine-suggest-head">
        <Icon name="fume-engine" />
        {same ? "The Engine would keep it as it is" : "The Engine suggests"}
      </span>
      {!same && <span className="ui-engine-suggest-text">{wrote.text}</span>}
      <span className="ui-engine-suggest-why">{wrote.why}</span>
      <span className="ui-engine-suggest-actions">
        {!same && (
          <Button
            size="sm"
            variant="secondary"
            icon="check"
            onClick={() => {
              onKeep(wrote.text);
              setWrote(undefined);
            }}
          >
            Keep it
          </Button>
        )}
        <Button size="sm" variant="quiet" onClick={() => setWrote(undefined)}>
          {same ? "Close" : "Drop"}
        </Button>
      </span>
    </span>
  ) : null;
  return { tools, suggestion };
}
