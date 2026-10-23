// One creative, one worker at a time (round 13, Marcus #64: "make sure the Engine isn't working on a project at the
// same time as a designer"). While the Engine works on this creative (the expert told it what to fix in Check), the
// desk says so over the board, the panels and the Engine bar are locked, and she can Wait (the desk opens again when
// the fix is back) or Take over (the creative comes to her in the Studio and the Engine's fix stops).
import { Button, Icon, TextShimmer, useToast } from "@fume/ui";
import { useEffect, useRef, useState } from "react";
import { useQaQueue, useQaTakeOver } from "../../../api/hooks";
import type { CreativeDocument, QaItem } from "../../../contract";

/** The creative's item in Check while the Engine is fixing it; when the fix comes back, a toast says the desk is hers. */
export function useEngineWork(doc: CreativeDocument, title: string): QaItem | undefined {
  const queue = useQaQueue(doc.workspaceId).data;
  const toast = useToast();
  const item = queue?.find((v) => v.item.documentId === doc.id || (doc.creativeId !== undefined && v.item.creativeId === doc.creativeId))?.item;
  const fixing = item?.state === "fixing";
  const was = useRef(fixing);
  useEffect(() => {
    if (was.current && !fixing && item?.state === "waiting") toast.done(`The Engine’s fix of ${title} is back`, { description: "The desk is yours again." });
    was.current = fixing;
  }, [fixing]); // eslint-disable-line react-hooks/exhaustive-deps
  return fixing ? item : undefined;
}

/** Props that lock a part of the desk (inert: no pointer, no keyboard, read by screen readers as unavailable). */
export const lockProps = (locked: boolean) => (locked ? ({ inert: "" } as Record<string, string>) : {});

export function EngineLockBar({ item, title }: { item: QaItem; title: string }) {
  const take = useQaTakeOver();
  const toast = useToast();
  const [waiting, setWaiting] = useState(false);
  const note = item.feedback.filter((f) => f.state === "sent").at(-1)?.text;
  return (
    <div className="ui-desk-lock" role="status">
      <Icon name="fume-engine" className="ui-desk-lock-icon" />
      <p className="ui-desk-lock-text">
        <TextShimmer>The Engine is working on this</TextShimmer>
        <span className="ui-desk-lock-note">{waiting ? "The desk opens again when its fix is back." : note ? `“${note}”` : "A fix the expert asked for in Check."}</span>
      </p>
      {!waiting && (
        <Button size="sm" variant="quiet" onClick={() => setWaiting(true)}>
          Wait
        </Button>
      )}
      <Button
        size="sm"
        variant="secondary"
        loading={take.isPending}
        onClick={() =>
          take.mutate(item.id, {
            onSuccess: () => {
              toast.done(`${title} is yours`, { description: "The Engine stopped its fix. Check sees it in the Studio with you." });
            },
            onError: (e) => toast.error("That didn’t work", { description: e.message }),
          })
        }
      >
        Take over
      </Button>
    </div>
  );
}
