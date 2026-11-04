// The Engine behind a version (FLOWS §29). A version that did not render says why in the strip and opens a panel
// with the reason and a way on. Fume's own people also see the prompt itself in that panel, for every version: what
// it had to carry and what the checks said (engine_prompts). Agencies and customers never see a prompt.
// - The panel's state is in the address (?prompt=<version id>), so Back closes it and a link opens it again.
// - It is a peek (modal={false}): the board stays live beside it.
// - Never Amber: nothing here is a person's check. Rouge marks only what works against a rule, cut with Porcelain.
import {
  Button,
  Icon,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  useToast,
  type IconName,
} from "@fume/ui";
import { useRef } from "react";
import { useSearchParams } from "react-router-dom";
import type { CreativeDocument, EnginePrompt, RenderVersion } from "../../../contract";
import * as copy from "../../../copy";
import { useFumeTeam } from "../shared";

/** The Engine checks a prompt this many times before it gives up. */
const TRIES = 3;

/** Only Fume's own people see the prompt behind a version (not an agency's people, not a customer). */
export const useSeesPrompt = useFumeTeam;

/** The panel's version, in the address. */
export function usePromptAddress() {
  const [search, setSearch] = useSearchParams();
  const id = search.get("prompt") ?? undefined;
  const set = (versionId: string | undefined) =>
    setSearch(
      (s) => {
        const next = new URLSearchParams(s);
        if (versionId) next.set("prompt", versionId);
        else next.delete("prompt");
        return next;
      },
      { replace: !versionId },
    );
  return { id, open: (versionId: string) => set(versionId), close: () => set(undefined) };
}

const against = (p?: EnginePrompt) => p?.findings.filter((f) => f.verdict === "against").length ?? 0;

/** A failed version's line in the strip, short enough for its tile: "Stopped by 2 rules". */
export function failedWords(v: RenderVersion): string {
  const p = v.prompt;
  const n = against(p);
  if (n) return `Stopped by ${copy.count(n, "rule")}`;
  if (p?.status === "escalated") return "Waits for a person";
  return "Not rendered";
}

const verdicts: Record<EnginePrompt["findings"][number]["verdict"], { words: string; icon: IconName; order: number }> =
  {
    against: { words: "Works against it", icon: "circle-x", order: 0 },
    person: { words: "Sent to a person", icon: "user", order: 1 },
    carried: { words: "", icon: "check", order: 2 },
    not_visible: { words: "Not visible in a picture", icon: "minus", order: 3 },
  };

const status: Record<EnginePrompt["status"], string> = {
  validated: "Passed, sent to the image model",
  escalated: "Waits for a person",
  blocked: "Stopped, never sent",
};

/** The panel: why a version did not render, and (Fume's people) the prompt and its checks. */
export function PromptSheet({ doc }: { doc: CreativeDocument }) {
  const { id, close } = usePromptAddress();
  const sees = useSeesPrompt();
  const toast = useToast();
  const toEngine = useRef(false);
  const v = id ? doc.versions.find((x) => x.id === id) : undefined;
  // A done version opens only for Fume's people (its prompt is all the panel has); a failed one for everyone.
  const open = Boolean(v && (v.state === "failed" || (sees && v.prompt)));
  const failed = v?.state === "failed";
  const p = sees ? v?.prompt : undefined;
  const findings = p ? [...p.findings].sort((a, b) => verdicts[a.verdict].order - verdicts[b.verdict].order) : [];
  const passed = p?.codeChecks.filter((c) => c.pass).length ?? 0;

  const promptBlock = p?.text ? (
    <section className="ui-desk-sheet-part" aria-labelledby="trace-prompt">
      <div className="ui-desk-trace-head">
        <h3 className="ui-desk-sheet-head" id="trace-prompt">
          {p.status === "validated" ? "The prompt" : "The last try, never sent"}
        </h3>
        <Button size="sm" variant="glass-clear" icon="copy" onClick={copyPrompt}>
          Copy
        </Button>
      </div>
      <pre className="ui-desk-trace-prompt" tabIndex={0} aria-labelledby="trace-prompt">
        {p.text}
      </pre>
    </section>
  ) : undefined;

  async function copyPrompt() {
    if (!p?.text) return;
    try {
      await navigator.clipboard.writeText(p.text);
      toast.done("Prompt copied");
    } catch {
      toast.error("The prompt wasn’t copied", { description: "Select it and copy it by hand." });
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()} modal={false}>
      <SheetContent
        side="right"
        size={p ? "lg" : "md"}
        className="ui-desk-sheet ui-desk-trace"
        onCloseAutoFocus={(e) => {
          if (!toEngine.current) return;
          toEngine.current = false;
          e.preventDefault();
          document.getElementById("engine-bar")?.focus();
        }}
      >
        {v && (
          <>
            <SheetHeader>
              <SheetTitle>
                {failed ? `Version ${v.number} didn’t render` : `The prompt behind version ${v.number}`}
              </SheetTitle>
              <SheetDescription>
                {failed
                  ? (v.failure ?? "The Engine stopped before the picture. Nothing was charged for it.")
                  : "What the Engine sent to the image model, and what its checks said. Only Fume’s team sees this."}
              </SheetDescription>
            </SheetHeader>
            <SheetBody>
              {failed && v.instruction && (
                <section className="ui-desk-sheet-part" aria-labelledby="trace-asked">
                  <h3 className="ui-desk-sheet-head" id="trace-asked">
                    What was asked
                  </h3>
                  <p className="ui-desk-trace-asked">“{v.instruction}”</p>
                </section>
              )}

              {!failed && promptBlock}

              {p && findings.length > 0 && (
                <section className="ui-desk-sheet-part" aria-labelledby="trace-carry">
                  <h3 className="ui-desk-sheet-head" id="trace-carry">
                    What the prompt had to carry
                  </h3>
                  <ul className="ui-desk-trace-list">
                    {findings.map((f) => {
                      const w = verdicts[f.verdict];
                      return (
                        <li key={f.item} className="ui-desk-trace-item" data-verdict={f.verdict}>
                          <Icon name={w.icon} className="ui-desk-trace-mark" />
                          <span className="ui-desk-trace-text">
                            <span className="ui-desk-trace-what">{f.item}</span>
                            <span className="ui-desk-trace-note">{[w.words, f.note].filter(Boolean).join(" · ")}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              {failed && promptBlock}

              {p && p.codeChecks.length > 0 && (
                <section className="ui-desk-sheet-part" aria-labelledby="trace-code">
                  <h3 className="ui-desk-sheet-head" id="trace-code">
                    The code’s checks · {passed} of {p.codeChecks.length} passed
                  </h3>
                  <ul className="ui-desk-trace-list" data-dense="">
                    {p.codeChecks.map((c) => (
                      <li key={c.text} className="ui-desk-trace-item" data-verdict={c.pass ? "carried" : "against"}>
                        <Icon name={c.pass ? "check" : "circle-x"} className="ui-desk-trace-mark" />
                        <span className="ui-desk-trace-text">
                          <span className="ui-desk-trace-what">{c.text}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {p && (
                <section className="ui-desk-sheet-part" aria-labelledby="trace-about">
                  <h3 className="ui-desk-sheet-head" id="trace-about">
                    About this prompt
                  </h3>
                  <dl className="ui-desk-sheet-rows">
                    <div>
                      <dt>Status</dt>
                      <dd>{status[p.status]}</dd>
                    </div>
                    {p.status !== "validated" && p.reason && (
                      <div>
                        <dt>Why</dt>
                        <dd>{p.reason}</dd>
                      </div>
                    )}
                    <div>
                      <dt>Image model</dt>
                      <dd>{p.model}</dd>
                    </div>
                    {p.method && (
                      <div>
                        <dt>Method</dt>
                        <dd>{p.method}</dd>
                      </div>
                    )}
                    <div>
                      <dt>Tries</dt>
                      <dd>
                        {p.tries} of {TRIES}
                      </dd>
                    </div>
                    <div>
                      <dt>Writing and checking it</dt>
                      <dd>${p.llmUsd.toFixed(3)}</dd>
                    </div>
                  </dl>
                </section>
              )}
            </SheetBody>
            {failed && (
              <SheetFooter>
                <Button
                  variant="glass-white"
                  icon="pencil"
                  onClick={() => {
                    toEngine.current = true;
                    close();
                  }}
                >
                  Write a new instruction
                </Button>
              </SheetFooter>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
