// Send to check, with a stop for open product errors (walk-through Must 11): when the picked version still reads a
// product detail wrong ("Reads 200 ml · should be 100 ml") and no fix is under way, the designer sees it first and
// chooses: fix it first (the Engine's product fix, a new version) or send anyway (the expert sees the flag in Check).
// Round 12 (UX review DTASK-1, PROPOSED 20 Oct 2026): sending says which version left for Check, offers Undo, and,
// when the creative was opened from Check, takes her back to the item she came from (the item now shows the new
// version: the mock's documentToCheck, QA's).
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  useToast,
} from "@fume/ui";
import { useState } from "react";
import { useDetailTokens, useDocumentToCheck, useFixProduct, useSession, useUndoDocumentToCheck } from "../../../api/hooks";
import type { CreativeDocument } from "../../../contract";
import * as copy from "../../../copy";

/** The product details the picked version reads wrong, with no fix running. */
export function useOpenFlags(doc: CreativeDocument) {
  const tokens = useDetailTokens(doc.specs.productId).data ?? [];
  const picked = doc.versions.find((v) => v.id === doc.pickedVersionId);
  const flags = (picked?.details ?? [])
    .filter((d) => !d.ok && !(doc.fixes ?? []).some((f) => f.tokenId === d.tokenId && (f.state === "fixing" || f.versionId === picked?.id)))
    .map((d) => ({ find: d, token: tokens.find((t) => t.id === d.tokenId) }));
  return { picked, flags };
}

export function SendToCheck({
  doc,
  name,
  disabled,
  onBefore,
  onSent,
}: {
  doc: CreativeDocument;
  /** The creative's one name (copy.creativeName), for the toast. */
  name: string;
  disabled?: boolean;
  onBefore: () => void;
  /** Opened from Check: go back to the item, which now holds the new version. */
  onSent?: () => void;
}) {
  const toCheck = useDocumentToCheck();
  const undo = useUndoDocumentToCheck();
  const fix = useFixProduct();
  const toast = useToast();
  const agency = Boolean(useSession().data?.user.agency); // round 13 AGENCY: the agency's own team checks
  const [asking, setAsking] = useState(false);
  const { picked, flags } = useOpenFlags(doc);

  const send = (withFlags: boolean) => {
    onBefore();
    const number = picked?.number;
    // mutateAsync: once sent, the button makes way for "In check" (this component goes), and the toast, its Undo and
    // the way back still follow.
    toCheck.mutateAsync(doc.id).then(
      () => {
        toast.done(`Version ${number ?? ""} of ${name} sent to check`, {
          description: withFlags
            ? `${agency ? "Your team sees" : "The expert sees"} the ${flags.length === 1 ? "product flag" : "product flags"} in Check.`
            : onSent
              ? "It takes the place of the version Check had."
              : agency ? "It waits in Check for your team." : "It waits in Check for the expert.",
          action: {
            label: "Undo",
            onClick: () =>
              undo.mutateAsync(doc.id).then(
                () => toast.done(`Version ${number ?? ""} is back in the Studio`),
                (e: Error) => toast.error("It is still in Check", { description: e.message }),
              ),
          },
        });
        onSent?.();
      },
      (e: Error) => toast.error("It didn’t go to check", { description: e.message }),
    );
  };
  const fixFirst = () => {
    if (!picked) return;
    onBefore();
    for (const { find } of flags)
      fix.mutate(
        { documentId: doc.id, versionId: picked.id, tokenId: find.tokenId },
        { onError: (e) => toast.error("The fix didn’t start", { description: e.message }) },
      );
    toast.done(flags.length === 1 && flags[0].token ? `Fixing the ${flags[0].token.label.toLowerCase()}` : `Fixing ${copy.count(flags.length, "product detail")}`, {
      description: "The Engine makes a new version with the real product. Send that one to check.",
    });
  };
  const what = flags
    .map(({ find, token }) => (token ? `${token.label} reads ${find.read}, should be ${token.value}` : `It reads ${find.read}`))
    .join(". ");

  return (
    <>
      <Button
        size="sm"
        icon="send"
        loading={toCheck.isPending}
        disabled={disabled}
        onClick={() => (flags.length ? setAsking(true) : send(false))}
      >
        Send to check
      </Button>
      <AlertDialog open={asking} onOpenChange={setAsking}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{flags.length === 1 ? "1 product detail is wrong" : `${flags.length} product details are wrong`}</AlertDialogTitle>
            <AlertDialogDescription>
              {what}. Fix it first, or send it anyway and the expert sees the flag in Check.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Later</AlertDialogCancel>
            <Button variant="glass-clear" onClick={() => (setAsking(false), send(true))}>
              Send anyway
            </Button>
            <AlertDialogAction variant="white" icon="refresh-cw" onClick={fixFirst}>
              Fix it first
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
