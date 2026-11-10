// "Tell the Engine" (round 16, PROPOSED 9 Nov 2026). Marcus, 9 Nov, on the Studio with the panel closed: "the 'Tell the
// Engine' thing should be visible when the Engine chat is not open". So the Engine is at hand without opening anything:
// - In the Studio, a field at the foot of the board, beside "Add a picture made by hand", in all three studios. It is
//   the page's own thread's composer: what she writes goes there (the same draft), and sending opens the panel on that
//   thread, where the answer and the change card are. While the panel is open the field steps aside: one composer.
// - In the staff frame, the Engine button at the bar's end says "Tell the Engine" while the panel is closed
//   (EngineToggle), and opens it with the composer ready.
// ⌘J opens the panel from the field with what she has written.
import { Icon, InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, Kbd } from "@fume/ui";
import type { FormEvent } from "react";
import { useSeesEngine } from "./field";
import { enginePanel, threadKey, useEngineSees, useEngineState } from "./panel";

export function EnginePrompt() {
  const sees = useSeesEngine();
  const open = useEngineState((s) => s.open);
  const sight = useEngineSees();
  const thread = threadKey(sight.topic);
  const text = useEngineState((s) => s.drafts[thread] ?? "");
  if (!sees || open) return null;
  const desk = sight.desk;
  const waits = desk
    ? (desk.doc.video ? desk.doc.video.edits : desk.doc.edits).some((e) => e.state === "proposed")
    : false;
  const busy = Boolean(desk?.locked) || waits;
  const title = sight.title ?? "this";
  const placeholder = desk?.locked
    ? "The Engine is fixing it from Check"
    : waits
      ? "A change waits for you in the Engine"
      : `Tell the Engine what to change in ${title}`;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    enginePanel.send(thread, text.trim());
  };
  return (
    <form className="ui-engine-prompt" onSubmit={submit} aria-label="Tell the Engine">
      <InputGroup size="sm" className="ui-engine-prompt-field">
        <InputGroupAddon>
          <Icon name="fume-engine" className="ui-engine-prompt-mark" />
        </InputGroupAddon>
        <InputGroupInput
          aria-label={`Tell the Engine what to change in ${title}`}
          placeholder={placeholder}
          value={text}
          disabled={busy}
          onChange={(e) => enginePanel.draft(thread, e.target.value)}
        />
        <InputGroupAddon align="inline-end">
          {waits && !desk?.locked ? (
            <InputGroupButton size="sm" onClick={() => enginePanel.setOpen(true)}>
              Open it
            </InputGroupButton>
          ) : (
            <>
              <Kbd className="ui-engine-prompt-key" title="Opens the Engine">
                ⌘J
              </Kbd>
              <InputGroupButton
                type="submit"
                variant="primary"
                size="sm"
                iconOnly
                icon="arrow-up"
                aria-label="Send to the Engine"
                disabled={!text.trim() || busy}
              />
            </>
          )}
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
