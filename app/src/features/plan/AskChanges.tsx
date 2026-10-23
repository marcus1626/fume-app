// Ask Fume for changes to the plan (FLOWS §22.2): anything larger than a line goes to Fume in her words, and Fume
// answers with the next version, checked again by the expert. On a desk it is the right panel (the plan stays in view
// on the left); on a phone a sheet from the bottom. Quick chips start the sentence; ⌘↵ sends; Esc closes the panel.
// Round 12 (brief r12 PLAN, PROPOSED 20 Oct 2026): in a brand an agency runs no Fume expert checks it again, so the
// lead names one only when there is one; and it says that changing the plan never uses a change request (the plan's
// "2 change requests included" are for the creatives).
import {
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  Field,
  FieldDescription,
  FieldLabel,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Textarea,
  useNarrowScreen,
  useToast,
} from "@fume/ui";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAskPlanChanges } from "../../api/hooks";

const STARTS = ["The direction: ", "The light: ", "The people: ", "The words: ", "The creatives: "];

export function AskChanges({
  campaignId,
  expert,
  included,
  open,
  onOpenChange,
}: {
  campaignId: string;
  /** Fume's expert who checks the next version, when one does ("Anna"). */
  expert?: string;
  /** The change requests the campaign includes, for the creatives. */
  included?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const narrow = useNarrowScreen();
  const ask = useAskPlanChanges();
  const toast = useToast();
  const [text, setText] = useState("");
  const [tried, setTried] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const formId = "ask-plan-changes";
  // Esc with words in the field first leaves the field (the draft stays); a second Esc, or an empty field, closes.
  const onEscape = (e: KeyboardEvent) => {
    if (document.activeElement === field.current && text.trim()) {
      e.preventDefault();
      panel.current?.focus({ preventScroll: true });
    }
  };
  const missing = tried && !text.trim();

  // A new ask starts empty.
  useEffect(() => {
    if (open) {
      setText("");
      setTried(false);
    }
  }, [open]);

  const start = (words: string) => {
    const next = text.trim() ? `${text.replace(/\s+$/, "")}\n${words}` : words;
    setText(next);
    window.requestAnimationFrame(() => {
      const el = field.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(next.length, next.length);
    });
  };

  const send = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || STARTS.includes(text)) {
      setTried(true);
      field.current?.focus();
      return;
    }
    // mutateAsync: once asked, the plan's footer (and this panel with it) unmounts before mutate's callbacks would run
    void ask.mutateAsync({ campaignId, note: text.trim() }).then(
      () => {
        toast.done("Sent. Fume is changing the plan.");
        onOpenChange(false);
      },
      (err: Error) => toast.error("That wasn’t sent", { description: err.message }),
    );
  };

  const title = "Ask Fume for changes";
  const lead = `Say what should be different. Fume writes the next version${expert ? ` and ${expert.charAt(0).toUpperCase() + expert.slice(1)} checks it again` : ""}.${included ? " This never uses one of your change requests; they are for the creatives." : ""}`;
  const body = (
    <form id={formId} className="ui-qs-form" onSubmit={send}>
      <div className="ui-qs-suggest" role="group" aria-label="Start with">
        {STARTS.map((s) => (
          <Button key={s} type="button" size="sm" variant="glass-clear" onClick={() => start(s)}>
            {s.replace(/: $/, "")}
          </Button>
        ))}
      </div>
      <Field invalid={missing}>
        <FieldLabel htmlFor={`${formId}-text`}>What should change</FieldLabel>
        <Textarea
          ref={field}
          id={`${formId}-text`}
          value={text}
          rows={6}
          onChange={(e) => setText(e.target.value)}
          aria-invalid={missing || undefined}
          aria-describedby={`${formId}-help`}
          data-ui-autofocus=""
        />
        <FieldDescription id={`${formId}-help`}>
          {missing
            ? "Write what should be different first, or choose Later."
            : "In your words. A single line you can also change on the plan itself."}
        </FieldDescription>
      </Field>
    </form>
  );
  const actions = (
    <>
      <Button type="button" variant="glass-clear" onClick={() => onOpenChange(false)}>
        Later
      </Button>
      <Button type="submit" form={formId} variant="glass-white" icon="send" loading={ask.isPending}>
        Send to Fume
      </Button>
    </>
  );

  if (narrow)
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent ref={panel} onEscapeKeyDown={onEscape}>
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{lead}</DrawerDescription>
          </DrawerHeader>
          <DrawerBody>{body}</DrawerBody>
          <DrawerFooter>{actions}</DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent ref={panel} side="right" size="md" onEscapeKeyDown={onEscape}>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{lead}</SheetDescription>
        </SheetHeader>
        <SheetBody>{body}</SheetBody>
        <SheetFooter>{actions}</SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
