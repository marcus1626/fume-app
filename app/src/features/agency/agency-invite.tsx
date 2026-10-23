// Round 11 (FLOWS §24.3, PROPOSED 20 Oct 2026): Invite someone to the agency, the lead's small right panel: their
// email and their role (Creative, or Agency lead). In the preview it sends nothing: a toast says the invitation went.
// Round 13 (Marcus #70): the roles are Fume's own, Expert, Operator or Admin.
import {
  Button,
  Choice,
  ChoiceText,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  Input,
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
  useToast,
} from "@fume/ui";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { agencyRoleHelp, agencyRoleWords, type AgencyRoleName } from "./agency-parts";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function InvitePanel({
  open,
  onOpenChange,
  agencyName,
  known,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agencyName: string;
  known: string[];
}) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AgencyRoleName>("expert");
  const [tried, setTried] = useState(false);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setEmail("");
    setRole("expert");
    setTried(false);
  }, [open]);

  const v = email.trim();
  const problem = !v
    ? "Write the email of the person you want to invite."
    : !EMAIL.test(v)
      ? "That is not an email address yet. Check the part after the @."
      : known.some((k) => k.toLowerCase() === v.toLowerCase())
        ? `${v} is already in ${agencyName}.`
        : undefined;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (problem) {
      field.current?.focus();
      return;
    }
    toast.done(`Invitation sent to ${v}`, {
      description: `They join ${agencyName} as ${role === "operator" ? "an operator" : role === "admin" ? "an admin" : "an expert"}.`,
    });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="md">
        <form className="ui-sheet-form" onSubmit={submit} noValidate aria-label="Invite to the agency">
          <SheetHeader>
            <SheetTitle>Invite to {agencyName}</SheetTitle>
            <SheetDescription>They work on every client you give them, with the role you choose here.</SheetDescription>
          </SheetHeader>
          <SheetBody>
            <div className="ui-agency-form">
              <FieldGroup>
                <Field invalid={tried && Boolean(problem)}>
                  <FieldLabel htmlFor="invite-email">Email</FieldLabel>
                  <Input
                    ref={field}
                    id="invite-email"
                    type="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@brygga.example"
                    autoComplete="off"
                    data-ui-autofocus=""
                    aria-invalid={tried && problem ? true : undefined}
                    aria-describedby="invite-email-error"
                  />
                  <FieldError id="invite-email-error">{tried ? problem : undefined}</FieldError>
                </Field>
                <FieldSet>
                  <FieldLegend variant="label">Role</FieldLegend>
                  <RadioGroup value={role} onValueChange={(r) => setRole(r as AgencyRoleName)} aria-label="Role">
                    {(["expert", "operator", "admin"] as const).map((r) => (
                      <Choice key={r}>
                        <RadioGroupItem value={r} />
                        <ChoiceText label={agencyRoleWords[r]} hint={agencyRoleHelp[r]} />
                      </Choice>
                    ))}
                  </RadioGroup>
                </FieldSet>
              </FieldGroup>
            </div>
          </SheetBody>
          <SheetFooter>
            <SheetClose asChild>
              <Button variant="glass-clear">Cancel</Button>
            </SheetClose>
            <Button type="submit" variant="glass-white" icon="send">
              Send the invitation
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
