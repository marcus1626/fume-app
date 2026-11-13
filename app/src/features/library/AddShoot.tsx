// Add a shoot (FLOWS §38.2): the brand's own pictures and clips, as they are, with what may be done with them. The
// files first, then the shoot's name, who took them and when, how long they may be used, and who is in them; on all
// brands, which brand. The button counts what goes in ("Add 24 pictures and 2 clips"). Nothing is changed in a
// picture: the Engine reads the shoot, and an expert checks the picks before any of them is used.
import {
  Button,
  Choice,
  ChoiceText,
  DateField,
  Dropzone,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldOptional,
  FieldSet,
  Input,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  useToast,
  type DropzoneItem,
} from "@fume/ui";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAddShoot } from "../../api/hooks";
import type { ShootFile, ShootPeople, Workspace } from "../../contract";
import * as copy from "../../copy";
import { todayKey } from "../../lib/time";
import { measure } from "../../lib/probe";
import { PEOPLE } from "./words";

interface Dropped extends DropzoneItem {
  file: File;
}

/** "24 pictures and 2 clips". */
export const whatGoesIn = (photos: number, clips: number) =>
  [photos ? copy.count(photos, "picture") : "", clips ? copy.count(clips, "clip") : ""].filter(Boolean).join(" and ");

export function AddShoot({
  open,
  onOpenChange,
  workspaceId,
  brands,
  base,
  customer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The brand it goes to; on all brands the person chooses from `brands`. */
  workspaceId?: string;
  brands: Workspace[];
  /** The Library's address, to open the new shoot. */
  base: string;
  customer: boolean;
}) {
  const id = useId();
  const add = useAddShoot();
  const toast = useToast();
  const navigate = useNavigate();
  const nameField = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<Dropped[]>([]);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState(workspaceId ?? "");
  const [by, setBy] = useState("");
  const [shotOn, setShotOn] = useState("");
  const [lasts, setLasts] = useState<"good" | "until">("good");
  const [until, setUntil] = useState("");
  const [people, setPeople] = useState<ShootPeople | "">("");
  const [tried, setTried] = useState(false);

  // A fresh form each time it opens; the pictures' addresses are let go when it closes.
  useEffect(() => {
    if (!open) return;
    setItems([]);
    setName("");
    setBrand(workspaceId ?? "");
    setBy("");
    setShotOn("");
    setLasts("good");
    setUntil("");
    setPeople("");
    setTried(false);
  }, [open, workspaceId]);

  const photos = items.filter((i) => i.kind === "image").length;
  const clips = items.length - photos;
  const noFiles = tried && items.length === 0;
  const noName = tried && !name.trim();
  const noBrand = tried && !brand;
  const noUntil = tried && lasts === "until" && !until;
  const noPeople = tried && !people;

  const onFiles = (files: File[]) =>
    setItems((now) => [
      ...now,
      ...files.map((f, i): Dropped => ({
        id: `shoot-${Date.now()}-${i}`,
        name: f.name,
        bytes: f.size,
        state: "done",
        src: URL.createObjectURL(f),
        kind: f.type.startsWith("video/") || /\.(mov|mp4)$/i.test(f.name) ? "video" : "image",
        file: f,
      })),
    ]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!items.length || !name.trim() || !brand || (lasts === "until" && !until) || !people) {
      if (items.length && !name.trim()) nameField.current?.focus();
      return;
    }
    const files: ShootFile[] = await Promise.all(
      items.map(async (i) => {
        const kind = i.kind === "video" ? "clip" : "photo";
        return { name: i.name, src: i.src!, kind, bytes: i.bytes, ...(await measure(i.src!, kind)) };
      }),
    );
    add.mutate(
      {
        workspaceId: brand,
        name: name.trim(),
        shotOn: shotOn || undefined,
        rights: { photographer: by.trim() || undefined, until: lasts === "until" ? until : undefined, people },
        files,
      },
      {
        onSuccess: (shoot) => {
          onOpenChange(false);
          toast.done(customer ? "Fume is going through your pictures" : "The Engine is going through the shoot", {
            description: `${whatGoesIn(photos, clips)} in ${shoot.name}.`,
          });
          navigate(`${base}/shoots/${shoot.id}`);
        },
        onError: (err: Error) => toast.error("Nothing was added", { description: err.message }),
      },
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="lg">
        <form className="ui-sheet-form" onSubmit={submit} noValidate>
          <SheetHeader>
            <SheetTitle>Upload a shoot</SheetTitle>
            <SheetDescription>
              {customer
                ? "Your own pictures and clips, as they are. Fume picks the best, an expert checks the picks, and they become creatives. Nothing in a picture is changed."
                : "The brand's own pictures and clips, as they are. The Engine picks the best and an expert checks the picks before any is used. Nothing in a picture is changed."}
            </SheetDescription>
          </SheetHeader>
          <SheetBody>
            <FieldGroup>
              <FieldSet>
                <FieldLegend variant="label">Pictures and clips</FieldLegend>
                <Dropzone
                  items={items}
                  onFiles={onFiles}
                  onRemove={(gone) =>
                    setItems((now) => {
                      const item = now.find((i) => i.id === gone);
                      if (item?.src) URL.revokeObjectURL(item.src);
                      return now.filter((i) => i.id !== gone);
                    })
                  }
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,.raw,.arw,.cr2,.cr3,.nef,.dng,.orf,.rw2,video/mp4,video/quicktime"
                  maxBytes={2_000_000_000}
                  maxLabel="2 GB"
                  icon="image-plus"
                  copy="Drop the shoot here or choose the pictures"
                  touchCopy="Tap to choose the pictures"
                  moreCopy="Add more from the shoot"
                  meta="JPG, PNG, WebP, HEIC, RAW, MP4 or MOV · up to 2 GB each"
                  aria-invalid={noFiles || undefined}
                />
                {noFiles && <FieldError>Add the pictures first.</FieldError>}
              </FieldSet>

              {!workspaceId && (
                <Field invalid={noBrand}>
                  <FieldLabel id={`${id}-brand`}>Brand</FieldLabel>
                  <Select value={brand || undefined} onValueChange={setBrand}>
                    <SelectTrigger aria-labelledby={`${id}-brand`} aria-invalid={noBrand || undefined}>
                      <SelectValue placeholder="Choose the brand" />
                    </SelectTrigger>
                    <SelectContent>
                      {brands.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.brandName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {noBrand && <FieldError>Choose whose pictures they are.</FieldError>}
                </Field>
              )}

              <Field invalid={noName}>
                <FieldLabel htmlFor={`${id}-name`}>Name of the shoot</FieldLabel>
                <Input
                  ref={nameField}
                  id={`${id}-name`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="For example: Autumn studio day"
                  aria-invalid={noName || undefined}
                />
                {noName && <FieldError>Give the shoot a name, so it can be found again.</FieldError>}
              </Field>

              <div className="ui-library-add-row">
                <Field>
                  <FieldLabel htmlFor={`${id}-by`}>
                    Who took them <FieldOptional />
                  </FieldLabel>
                  <Input
                    id={`${id}-by`}
                    value={by}
                    onChange={(e) => setBy(e.target.value)}
                    placeholder="The photographer"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${id}-on`}>
                    Shot on <FieldOptional />
                  </FieldLabel>
                  <DateField id={`${id}-on`} value={shotOn} max={todayKey()} today={todayKey()} onChange={setShotOn} />
                </Field>
              </div>

              <FieldSet>
                <FieldLegend id={`${id}-lasts`}>How long they may be used</FieldLegend>
                <RadioGroup
                  value={lasts}
                  onValueChange={(v) => setLasts(v as "good" | "until")}
                  aria-labelledby={`${id}-lasts`}
                >
                  <Choice>
                    <RadioGroupItem value="good" />
                    <ChoiceText label="For good" hint="The brand owns them" />
                  </Choice>
                  <Choice>
                    <RadioGroupItem value="until" />
                    <ChoiceText label="Until a day" hint="The photographer's licence ends" />
                  </Choice>
                </RadioGroup>
                {lasts === "until" && (
                  <Field invalid={noUntil}>
                    <FieldLabel htmlFor={`${id}-until`}>Usable until</FieldLabel>
                    <DateField
                      id={`${id}-until`}
                      value={until}
                      min={todayKey()}
                      today={todayKey()}
                      required
                      onChange={setUntil}
                      aria-invalid={noUntil || undefined}
                    />
                    {noUntil ? (
                      <FieldError>Give the last day they may be used.</FieldError>
                    ) : (
                      <FieldDescription>Fume stops using them after this day and says so before.</FieldDescription>
                    )}
                  </Field>
                )}
              </FieldSet>

              <FieldSet>
                <FieldLegend id={`${id}-people`}>Who is in them</FieldLegend>
                <RadioGroup
                  value={people}
                  onValueChange={(v) => setPeople(v as ShootPeople)}
                  aria-labelledby={`${id}-people`}
                  aria-invalid={noPeople || undefined}
                >
                  {PEOPLE.map((p) => (
                    <Choice key={p.value}>
                      <RadioGroupItem value={p.value} />
                      <ChoiceText label={p.label} hint={p.hint} />
                    </Choice>
                  ))}
                </RadioGroup>
                {noPeople ? (
                  <FieldError>Say who is in them: it decides what may be done with them.</FieldError>
                ) : (
                  <FieldDescription>
                    {customer ? "Fume" : "The Engine"} never changes a real person's face or body in a photograph.
                  </FieldDescription>
                )}
              </FieldSet>
            </FieldGroup>
          </SheetBody>
          <SheetFooter>
            <SheetClose asChild>
              <Button variant="glass-clear">Later</Button>
            </SheetClose>
            <Button type="submit" variant="glass-white" icon="upload" loading={add.isPending}>
              {items.length ? `Add ${whatGoesIn(photos, clips)}` : "Add the shoot"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
