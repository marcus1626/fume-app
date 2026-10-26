// Record an approval (FLOWS §24.2, §24.5): the client approved outside Fume (in a meeting, on a call, by email), and
// the agency records which creatives, who at the client approved, when, and how, in a note that is required. The
// approval stays the client's ("Maja approved"); the creative says who recorded it ("Maja approved · recorded by
// Nora"). A record of someone else's decision must be exact, so the panel starts with nothing ticked and its action
// counts ("Record 4 approvals"). "When" is @fume/ui's DateField, never the browser's date input (FLOWS §26.7). A small
// right panel on a desk, a sheet on a phone; ⌘↵ records; Esc closes.
import {
  Button,
  Choice,
  ChoiceText,
  DateField,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  RadioGroup,
  RadioGroupItem,
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Textarea,
  useToast,
} from "@fume/ui";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useRecordClientApproval, useSession } from "../../api/hooks";
import type { Campaign, Creative, Id } from "../../contract";
import * as copy from "../../copy";
import { date, now } from "../../lib/time";
import { firstName } from "../../shell/people";
import { clientRole, useCampaignSends, useClientPeople } from "./clientFlow";
import { CreativeChoice } from "./SendToClient";

export interface RecordApprovalProps {
  campaign: Campaign;
  /** The checked creatives, under their customer names. */
  creatives: Creative[];
  /** Ticked when the panel opens (creative ids); none when not given: she ticks what the client approved. */
  initial?: Id[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Today on the demo's clock, as a date field writes it ("2026-10-20"). */
function today(): string {
  const d = new Date(now());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function RecordApprovalSheet({ campaign, creatives, initial, open, onOpenChange }: RecordApprovalProps) {
  const id = useId();
  const toast = useToast();
  const record = useRecordClientApproval();
  const brand = useSession().data?.workspace.brandName ?? "the client";
  const { people: all } = useClientPeople();
  const people = all.filter((p) => p.approves);
  const [chosen, setChosen] = useState<Set<Id>>(new Set());
  const [who, setWho] = useState<Id>("");
  const [how, setHow] = useState("");
  const [day, setDay] = useState(today());
  const [tried, setTried] = useState(false);
  const { sendOf, who: sentTo } = useCampaignSends(campaign.id, open);
  const field = useRef<HTMLTextAreaElement>(null);

  const approverOf = () => (people.find((p) => p.user.id === campaign.approverId) ?? people[0])?.user.id ?? "";
  useEffect(() => {
    if (!open) return;
    setChosen(new Set(initial ?? []));
    setWho(approverOf());
    setHow("");
    setDay(today());
    setTried(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => {
    if (open && !who) setWho(approverOf());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people.length]);

  const picked = creatives.filter((c) => chosen.has(c.id));
  const person = people.find((p) => p.user.id === who);
  const name = person ? firstName(person.user.name) : "the client";
  /** The same at the start of a sentence: "Maja", "The client". */
  const Name = `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
  const noCreative = tried && picked.length === 0;
  const noNote = tried && !how.trim();
  const noDay = tried && (!day || day > today());

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (record.isPending) return;
    if (!picked.length || !how.trim() || !who || !day || day > today()) {
      setTried(true);
      if (picked.length && !how.trim()) field.current?.focus();
      return;
    }
    // A day before today is kept at its noon; today is now.
    const at = day < today() ? new Date(`${day}T12:00:00`).toISOString() : undefined;
    void record
      .mutateAsync({ versionIds: picked.map((c) => c.current.id), clientUserId: who, note: how.trim(), at })
      .then(
        (done) => {
          toast.done(`${Name} approved ${copy.creatives(done.length)}`, {
            description: "Recorded by you, with your note.",
          });
          onOpenChange(false);
        },
        (err: Error) => toast.error("Nothing was recorded", { description: err.message }),
      );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="md">
        <form className="ui-sheet-form" onSubmit={submit} noValidate>
          <SheetHeader>
            <SheetTitle>Record an approval</SheetTitle>
            <SheetDescription>
              When {name} approved outside Fume: in a meeting, on a call, by email. The creatives then show “{Name}{" "}
              approved · recorded by you”.
            </SheetDescription>
          </SheetHeader>
          <SheetBody>
            <FieldGroup>
              <FieldSet>
                <FieldLegend className="ui-client-legend">
                  <span id={`${id}-creatives`}>Tick what {name} approved</span>
                  <span className="ui-client-pick-count">
                    <span>
                      {picked.length} of {creatives.length} ticked
                    </span>
                  </span>
                </FieldLegend>
                <CreativeChoice
                  creatives={creatives}
                  chosen={chosen}
                  onChange={setChosen}
                  labelledBy={`${id}-creatives`}
                  note={(c) => {
                    const s = sendOf(c.current.id);
                    return s ? `with ${sentTo(s)} since ${date(s.sentAt)}` : copy.send.notSent.toLowerCase();
                  }}
                />
                {noCreative && <FieldError>Tick at least one creative {name} approved.</FieldError>}
              </FieldSet>

              <FieldSet>
                <FieldLegend id={`${id}-who`}>Who approved</FieldLegend>
                {people.length === 0 ? (
                  <FieldDescription>
                    No one at {brand} approves in Fume yet. Invite the person who approves first.
                  </FieldDescription>
                ) : (
                  <RadioGroup value={who} onValueChange={setWho} aria-labelledby={`${id}-who`}>
                    {people.map((p) => (
                      <Choice key={p.user.id}>
                        <RadioGroupItem value={p.user.id} />
                        <ChoiceText
                          label={p.user.name}
                          hint={[clientRole(p), p.user.title].filter(Boolean).join(" · ")}
                        />
                      </Choice>
                    ))}
                  </RadioGroup>
                )}
              </FieldSet>

              <Field invalid={noDay}>
                <FieldLabel htmlFor={`${id}-when`}>When</FieldLabel>
                <DateField
                  id={`${id}-when`}
                  value={day}
                  max={today()}
                  today={today()}
                  required
                  onChange={setDay}
                  aria-invalid={noDay || undefined}
                  aria-describedby={`${id}-when-help`}
                />
                {noDay ? (
                  <FieldError id={`${id}-when-help`}>Give the day {name} approved, today or before.</FieldError>
                ) : (
                  <FieldDescription id={`${id}-when-help`}>
                    The day {name} said yes. Today unless it was earlier.
                  </FieldDescription>
                )}
              </Field>

              <Field invalid={noNote}>
                <FieldLabel htmlFor={`${id}-how`}>How {name} approved</FieldLabel>
                <Textarea
                  ref={field}
                  id={`${id}-how`}
                  rows={3}
                  value={how}
                  onChange={(e) => setHow(e.target.value)}
                  placeholder={`For example: ${name === "the client" ? "They" : Name} said yes in our Monday meeting.`}
                  aria-invalid={noNote || undefined}
                  aria-describedby={`${id}-how-help`}
                />
                {noNote ? (
                  <FieldError id={`${id}-how-help`}>Say how {name} approved, for the record.</FieldError>
                ) : (
                  <FieldDescription id={`${id}-how-help`}>For the record: it stays with the approval.</FieldDescription>
                )}
              </Field>
            </FieldGroup>
          </SheetBody>
          <SheetFooter>
            <SheetClose asChild>
              <Button variant="glass-clear">Later</Button>
            </SheetClose>
            <Button type="submit" variant="glass-white" icon="check" loading={record.isPending}>
              {picked.length ? `Record ${copy.count(picked.length, "approval")}` : "Record an approval"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
