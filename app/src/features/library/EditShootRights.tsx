import {
  Button,
  Choice,
  ChoiceText,
  DateField,
  Field,
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
  SheetFooter,
  SheetHeader,
  SheetTitle,
  useToast,
} from "@fume/ui";
import { useEffect, useId, useState, type FormEvent } from "react";
import { useUpdateShootRights } from "../../api/hooks";
import type { Shoot, ShootPeople } from "../../contract";
import { todayKey } from "../../lib/time";
import { PEOPLE } from "./words";

export function EditShootRights({
  shoot,
  open,
  onOpenChange,
}: {
  shoot: Shoot;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const id = useId();
  const save = useUpdateShootRights();
  const toast = useToast();
  const [photographer, setPhotographer] = useState("");
  const [until, setUntil] = useState("");
  const [people, setPeople] = useState<ShootPeople>("unsure");
  useEffect(() => {
    if (!open) return;
    setPhotographer(shoot.rights.photographer ?? "");
    setUntil(shoot.rights.until ?? "");
    setPeople(shoot.rights.people);
  }, [open, shoot.id, shoot.rights.photographer, shoot.rights.until, shoot.rights.people]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(
      {
        shootId: shoot.id,
        rights: { photographer: photographer.trim() || undefined, until: until || undefined, people },
      },
      {
        onSuccess: () => {
          toast.done("Rights updated");
          onOpenChange(false);
        },
        onError: (err: Error) => toast.error("Rights not updated", { description: err.message }),
      },
    );
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <form className="ui-sheet-form" onSubmit={submit}>
          <SheetHeader>
            <SheetTitle>Edit rights</SheetTitle>
          </SheetHeader>
          <SheetBody>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={`${id}-by`}>Who took them</FieldLabel>
                <Input id={`${id}-by`} value={photographer} onChange={(e) => setPhotographer(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${id}-until`}>Usable until (leave empty for good)</FieldLabel>
                <DateField id={`${id}-until`} value={until} onChange={setUntil} today={todayKey()} />
              </Field>
              <FieldSet>
                <FieldLegend id={`${id}-people`}>People in the pictures</FieldLegend>
                <RadioGroup
                  aria-labelledby={`${id}-people`}
                  value={people}
                  onValueChange={(v) => setPeople(v as ShootPeople)}
                >
                  {PEOPLE.map((p) => (
                    <Choice key={p.value}>
                      <RadioGroupItem value={p.value} />
                      <ChoiceText label={p.label} hint={p.hint} />
                    </Choice>
                  ))}
                </RadioGroup>
              </FieldSet>
            </FieldGroup>
          </SheetBody>
          <SheetFooter>
            <SheetClose asChild>
              <Button variant="glass-clear">Cancel</Button>
            </SheetClose>
            <Button type="submit" variant="glass-white" loading={save.isPending}>
              Save rights
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
