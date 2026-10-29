// One product's page (ARCHITECTURE §4.2; Product Vision §4.3), in two layers:
// - Check, on top: the product's photo (a thumbnail beside the name on a phone, big on a desk), what Fume still needs
//   from her as the first card (id="needs", the shared question), then the Product Truth lines, with what Fume read and
//   has not had confirmed marked on its line, the expert's proposed change on the line it changes, and one pill:
//   "Confirm <product>", which confirms every line at once. One state word: Confirmed. Where a value came from shows
//   only while it waits for her.
// - All details, one closed row: every section of the kind (size, materials, label, variants, use, …), the reference
//   shots, what would make it better, and the factory files one level deeper. Each section opens on its own, confirms
//   all its proposals with one labelled pill, and changes one value with a quiet "Change". No percentage, no meter.
// One count per object: the line under the title says what blocks confirming, as questions ("2 questions for you"), and
// All details counts details ("14 details"), never "to check" (only the expert checks). Fume's people see the page read
// only. Looks: product-check.css on product-spec.css and product-data.css.
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Field,
  FieldLabel,
  Icon,
  PageHeader,
  Proposal,
  ProposalFoot,
  Textarea,
  formatBytes,
  pickFiles,
  useToast,
} from "@fume/ui";
import { Fragment, useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  useCatalogue,
  useCorrectFact,
  useDecideOverride,
  useDetailTokens,
  usePeople,
  useProduct,
  useProductKinds,
  useProductProposals,
  useQuestions,
  useSaveProductSpecs,
  useUploadProductFile,
  useUploadShot,
  useVerifyProduct,
} from "../../api/hooks";
import type {
  FidelityGap,
  OpenQuestion,
  Product,
  ProductFact,
  ProductFile,
  ProductKind,
  ProductOverride,
  SpecField,
  SpecGroupId,
  SpecValue,
} from "../../contract";
import * as copy from "../../copy";
import { Back, Nothing, Page, Query } from "../../shell/Page";
import { directory } from "../../shell/people";
import { KindDialog } from "../products/add";
import { CHECK_PRODUCTS, categoryPath, ProductMenu } from "../products/parts";
import { QuestionAnswer } from "../questions/QuestionSheet";
import { ProductTruthSheet } from "../products/truth";
import { essentials, fidelity, fieldsOf, filled, isDims, levelOf, valueWords } from "../products/spec";
import { DimsDrawing, GapList, PartsList, previewOf, ReadTag, ShotGrid, SpecDialog, SpecRow } from "../products/specs";
import { DetailCutout } from "../studio/doc/fix";
import { factArea, useExpertName, useRole, useViewer } from "./parts";

const settled = (f: ProductFact) => f.source === "verified" || f.source === "supplied";

/** "Not known yet. Which lines may we use?" asks "Which lines may we use?". */
const asked = (f: ProductFact) => f.statement.replace(/^Not known yet\.\s*/i, "");

/** What the Engine read about the product that still waits for the customer: fields, parts and photos. */
function proposalsOf(p: Product) {
  const specs = (p.specs ?? []).filter((s) => s.provenance.state === "proposed");
  const parts = (p.parts ?? []).filter((x) => x.provenance.state === "proposed");
  const shots = (p.shots ?? []).filter((x) => x.provenance.state === "proposed");
  return { specs, parts, shots, count: specs.length + parts.length + shots.length };
}

/** "You" for me, a first name for anyone else; undefined when no one is named. */
function useWho() {
  const { me } = useRole();
  const dir = directory(usePeople().data);
  return (id?: string) => (id === undefined ? undefined : id === me ? "You" : dir.name(id));
}

// ─── The photo ──────────────────────────────────────────────────────────────

/** The product's picture, big, with its other pictures and reference shots as thumbnails under it. */
function Gallery({ product }: { product: Product }) {
  const pictures = [...new Set([...product.images, ...(product.shots ?? []).map((s) => s.image)])];
  const [at, setAt] = useState(0);
  const shown = pictures[Math.min(at, pictures.length - 1)];
  return (
    <div className="ui-pspec-gallery">
      <div className="ui-pspec-media">
        {shown ? (
          <img src={shown} alt={`${product.name}, picture ${at + 1} of ${pictures.length}`} />
        ) : (
          <Icon name="camera" />
        )}
      </div>
      {pictures.length > 1 && (
        <ul className="ui-pspec-thumbs" aria-label="Pictures">
          {pictures.map((src, i) => (
            <li key={src}>
              <button
                type="button"
                className="ui-pspec-thumb"
                aria-pressed={i === at}
                aria-label={`Picture ${i + 1}`}
                onClick={() => setAt(i)}
              >
                <img src={src} alt="" loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** On a phone: the photo as a small square beside the name; a tap opens every picture in a sheet. */
function PhotoButton({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  const src = product.images[0] ?? product.shots?.[0]?.image;
  const count = new Set([...product.images, ...(product.shots ?? []).map((s) => s.image)]).size;
  return (
    <>
      <button
        type="button"
        className="ui-pcheck-photo"
        onClick={() => setOpen(true)}
        aria-label={count > 1 ? `See the ${count} pictures of ${product.name}` : `See the picture of ${product.name}`}
      >
        {src ? <img src={src} alt="" /> : <Icon name="camera" />}
      </button>
      {open && (
        <Drawer open onOpenChange={setOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{product.name}</DrawerTitle>
            </DrawerHeader>
            <DrawerBody>
              <Gallery product={product} />
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="glass-clear">Close</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      )}
    </>
  );
}

// ─── Fume needs this from you ───────────────────────────────────────────────

/** An open line no shared question covers yet (a product added by hand): answered in place, it confirms the line. */
function LineAnswer({ fact, product }: { fact: ProductFact; product: Product }) {
  const correct = useCorrectFact();
  const toast = useToast();
  const expert = useExpertName();
  const [text, setText] = useState("");
  const id = `ask-${fact.id}`;
  function save(event: FormEvent) {
    event.preventDefault();
    const said = text.trim();
    if (!said) return;
    correct.mutate(
      { factId: fact.id, statement: said },
      {
        onSuccess: () =>
          toast.done("Answer saved", { description: `${expert} checks every creative of ${product.name} against it.` }),
        onError: (error) => toast.error("That wasn’t saved", { description: error.message }),
      },
    );
  }
  return (
    <form onSubmit={save} className="ui-pcheck-ask-form">
      <Field>
        <FieldLabel htmlFor={id}>Your answer</FieldLabel>
        <Textarea id={id} value={text} onChange={(e) => setText(e.target.value)} rows={2} />
      </Field>
      <div className="ui-pcheck-ask-actions">
        <Button type="submit" size="sm" icon="check" loading={correct.isPending} disabled={!text.trim()}>
          Answer
        </Button>
      </div>
    </form>
  );
}

/** The first card: what Fume cannot know and needs from her, on the product it is about, one question at a time (the
 *  next one is named, quietly). A shared question is answered with the shared answer (QuestionAnswer), so the answer
 *  closes it on Home, in the chat and in the brief too. */
function Needs({ product, questions, facts }: { product: Product; questions: OpenQuestion[]; facts: ProductFact[] }) {
  const { canEdit } = useRole();
  const expert = useExpertName();
  const location = useLocation();
  const total = questions.length + facts.length;
  const q = questions[0];
  const f = q ? undefined : facts[0];
  const then = q
    ? (questions[1]?.question ?? (facts[0] && `${factArea[facts[0].area]}: ${asked(facts[0])}`))
    : facts[1] && `${factArea[facts[1].area]}: ${asked(facts[1])}`;

  // A link from Home with #needs lands on the answer, ready to type. The shell scrolls to it.
  useEffect(() => {
    if (location.hash !== "#needs" || !total) return;
    const t = window.setTimeout(
      () => document.querySelector<HTMLTextAreaElement>("#needs textarea")?.focus({ preventScroll: true }),
      300,
    );
    return () => window.clearTimeout(t);
  }, [location.hash, total]);

  if (!total) return null;
  return (
    <section id="needs" className="ui-pcheck-needs" aria-labelledby="needs-title">
      <h2 className="ui-pcheck-needs-title" id="needs-title">
        Fume needs this from you
        {total > 1 && <span className="ui-pcheck-count">1 of {total}</span>}
      </h2>
      <div className="ui-pcheck-ask">
        <p className="ui-pcheck-ask-q">{q ? q.question : f ? `${factArea[f.area]}: ${asked(f)}` : ""}</p>
        <p className="ui-pcheck-ask-why">
          {q
            ? q.why
            : `Every claim on a creative must be true before anything ships. ${expert} checks each one against your answer.`}
        </p>
        {!canEdit ? (
          <p className="ui-pcheck-ask-why">Someone on your team who can edit Brand DNA answers it.</p>
        ) : q ? (
          <QuestionAnswer key={q.id} question={q} />
        ) : (
          f && <LineAnswer key={f.id} fact={f} product={product} />
        )}
      </div>
      {then && <p className="ui-pcheck-then">Then: {then}</p>}
    </section>
  );
}

// ─── Product Truth: the lines, and one pill ─────────────────────────────────

/** Correct one line: what it should say. A correction is confirmed by whoever makes it. */
function CorrectDialog({ fact, onOpenChange }: { fact: ProductFact; onOpenChange: (open: boolean) => void }) {
  const correct = useCorrectFact();
  const toast = useToast();
  const [text, setText] = useState(fact.statement);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    correct.mutate(
      { factId: fact.id, statement: text.trim() },
      {
        onSuccess: () => {
          toast.done(`${fact.label || factArea[fact.area]} changed.`);
          onOpenChange(false);
        },
        onError: (error) => toast.error("That wasn’t saved", { description: error.message }),
      },
    );
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change the {(fact.label || factArea[fact.area]).toLowerCase()}</DialogTitle>
          <DialogDescription>Say what is true. Your words replace Fume’s, and the line is confirmed.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form id="correct-fact" onSubmit={submit}>
            <Field>
              <FieldLabel htmlFor="correct-fact-text">{fact.label || factArea[fact.area]}</FieldLabel>
              <Textarea id="correct-fact-text" value={text} onChange={(e) => setText(e.target.value)} rows={3} />
            </Field>
          </form>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="glass-clear">Cancel</Button>
          </DialogClose>
          <Button
            type="submit"
            form="correct-fact"
            variant="glass-white"
            loading={correct.isPending}
            disabled={!text.trim() || text.trim() === fact.statement}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** A change Fume's designer proposed from the Studio, on the line it changes: her words now, the proposal, and the
 *  choice (only the owner or approver makes it). Approve is for creatives; a product line is used or kept. */
function ChangeProposal({ o, canApprove }: { o: ProductOverride; canApprove: boolean }) {
  const decide = useDecideOverride();
  const toast = useToast();
  const who = useWho();
  const name = who(o.by) ?? "Fume’s designer";
  const viewer = useViewer();
  const verdict = (v: "approve" | "decline") =>
    decide.mutate(
      { overrideId: o.id, verdict: v },
      { onError: (e) => toast.error("That wasn’t saved", { description: e.message }) },
    );
  return (
    <div className="ui-pcheck-change">
      <p className="ui-pcheck-change-text">
        <span className="ui-pcheck-source">
          <Icon name="user" />
          {name} {name === "You" ? "propose" : "proposes"}
        </span>
        {o.value}
      </p>
      {canApprove ? (
        <div className="ui-pcheck-line-actions">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => verdict("approve")}
            loading={decide.isPending && decide.variables?.verdict === "approve"}
          >
            Use it
          </Button>
          <Button
            size="sm"
            variant="quiet"
            onClick={() => verdict("decline")}
            loading={decide.isPending && decide.variables?.verdict === "decline"}
          >
            Keep yours
          </Button>
        </div>
      ) : (
        <p className="ui-pcheck-source">{viewer.Your} approver decides.</p>
      )}
    </div>
  );
}

function TruthList({
  product,
  kind,
  onDetails,
}: {
  product: Product;
  kind?: ProductKind;
  onDetails: (section?: string) => void;
}) {
  const { canEdit, canApprove, role } = useRole();
  const verify = useVerifyProduct();
  const save = useSaveProductSpecs();
  const catalogue = useCatalogue().data;
  const overrides = (useProductProposals(product.id).data ?? []).filter((o) => o.state === "proposed");
  const toast = useToast();
  const navigate = useNavigate();
  const [correcting, setCorrecting] = useState<ProductFact | null>(null);
  const [busy, setBusy] = useState(false);
  const known = product.facts.filter((f) => f.source !== "unknown");
  const unknownLines = product.facts.filter((f) => f.source === "unknown");
  const unknown = unknownLines.length > 0;
  const confirmed = product.state === "verified";
  const read = proposalsOf(product);
  const fields = kind ? fieldsOf(kind) : [];
  const readNames = [
    ...read.specs.map((s) => fields.find((f) => f.id === s.fieldId)?.label ?? s.fieldId),
    ...read.parts.map((x) => x.name),
    ...read.shots.map((x) => `${kind?.shots.find((s) => s.id === x.slotId)?.label ?? x.slotId} photo`),
  ].map((w, i) => (i === 0 ? w : w.toLowerCase()));
  // "From your detail photo and LYS-KN-001 tech pack v3.pdf": only a plain capitalised word ("Your") goes lower case
  // after "From"; a code or a file name keeps its capitals.
  const readFrom = [...new Set(read.specs.map((s) => s.provenance.evidence).filter((e): e is string => Boolean(e)))]
    .slice(0, 2)
    .map(lowerFirst);
  const unmatched = overrides.filter((o) => !known.some((f) => f.label === o.field));
  const canConfirm =
    canEdit &&
    !confirmed &&
    !unknown &&
    (known.some((f) => !settled(f)) || read.count > 0 || product.state === "needs_you");
  const next = catalogue?.products.find((x) => x.id !== product.id && x.state === "needs_you");

  async function confirm() {
    setBusy(true);
    try {
      if (read.count)
        await save.mutateAsync({
          productId: product.id,
          keep: read.specs.map((s) => s.fieldId),
          keepParts: read.parts.map((x) => x.id),
          keepShots: read.shots.map((x) => x.slotId),
        });
      await verify.mutateAsync(product.id);
      toast.done(`${product.name} confirmed`, {
        description: "It is ready for campaigns.",
        // The rest wait in the confirm queue, one at a time.
        action: next ? { label: "Confirm the next", onClick: () => navigate(CHECK_PRODUCTS) } : undefined,
      });
    } catch (error) {
      toast.error(`${product.name} wasn’t confirmed`, {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ui-pcheck-truth" aria-labelledby="product-truth">
      <header className="ui-pcheck-truth-head">
        <h2 className="ui-pcheck-truth-title" id="product-truth">
          Product Truth
        </h2>
        <p className="ui-pcheck-truth-text">What every creative must keep true.</p>
      </header>
      {known.length === 0 && !unknown && read.count === 0 && unmatched.length === 0 ? (
        <Nothing
          icon="tag"
          title="Fume is reading this product"
          text="The lines it finds land here for you to confirm."
        />
      ) : (
        <ul className="ui-pcheck-lines">
          {known.map((f) => {
            const change = overrides.find((o) => o.field === f.label);
            const open = !settled(f);
            return (
              <li key={f.id} className="ui-pcheck-line" data-open={open || change ? "" : undefined}>
                <span className="ui-pcheck-label">{f.label || factArea[f.area]}</span>
                <p className="ui-pcheck-text">{f.statement}</p>
                {open && (
                  <span className="ui-pcheck-source">
                    <Icon name="fume-engine" />
                    {product.provenance?.evidence
                      ? `Fume read this on ${product.provenance.evidence}`
                      : "Fume read this"}
                    {f.confidence === "low" ? " · not sure" : ""}
                  </span>
                )}
                {change && <ChangeProposal o={change} canApprove={canApprove} />}
              </li>
            );
          })}
          {unknownLines.map((f) => (
            // A line Fume could not read stays in the list, open, and is answered in the card above (one record).
            <li key={f.id} className="ui-pcheck-line" data-open="">
              <span className="ui-pcheck-label">{f.label || factArea[f.area]}</span>
              <p className="ui-pcheck-text">Not known yet</p>
              <span className="ui-pcheck-source">
                <Icon name="fume-engine" />
                {canEdit ? "Fume asks you this above" : "Fume asks the brand for it"}
              </span>
            </li>
          ))}
          {unmatched.map((o) => (
            <li key={o.id} className="ui-pcheck-line" data-open="">
              <span className="ui-pcheck-label">{o.field}</span>
              <p className="ui-pcheck-text">{o.was}</p>
              <ChangeProposal o={o} canApprove={canApprove} />
            </li>
          ))}
          {!confirmed && read.count > 0 && (
            <li className="ui-pcheck-line" data-open="">
              <span className="ui-pcheck-label">Details</span>
              <p className="ui-pcheck-text">
                Fume read {copy.count(read.count, "detail")}: {readNames.slice(0, 3).join(", ")}
                {read.count > 3 ? ` and ${read.count - 3} more` : ""}.
              </p>
              <span className="ui-pcheck-source">
                <Icon name="fume-engine" />
                {readFrom.length ? `From ${readFrom.join(" and ")}` : "From your photos and your website"}
              </span>
              <div className="ui-pcheck-line-actions">
                <Button size="sm" variant="quiet" icon="chevron-down" onClick={() => onDetails("read")}>
                  See them
                </Button>
              </div>
            </li>
          )}
        </ul>
      )}

      {canEdit && (canConfirm || known.length > 0) && (
        <div className="ui-pcheck-confirm">
          {canConfirm && (
            <Button icon="check" onClick={() => void confirm()} loading={busy}>
              Confirm {product.name}
            </Button>
          )}
          {known.length > 0 && (
            // One quiet way to change any line, the open lines first; no button on every line.
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="quiet" icon="pencil">
                  Change a line
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {[...known.filter((f) => !settled(f)), ...known.filter(settled)].map((f) => (
                  <DropdownMenuItem key={f.id} onSelect={() => setCorrecting(f)}>
                    {f.label || factArea[f.area]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}
      {canConfirm && read.count > 0 && (
        <p className="ui-pcheck-confirm-note">It keeps what Fume read and confirms every line.</p>
      )}
      {role === null && (
        <p className="ui-pcheck-confirm-note">
          The customer’s Product Truth, read only. A change to the product is a proposal the customer decides on.
        </p>
      )}
      {correcting && (
        <CorrectDialog key={correcting.id} fact={correcting} onOpenChange={(o) => !o && setCorrecting(null)} />
      )}
    </section>
  );
}

// ─── All details ────────────────────────────────────────────────────────────

const fileAccept: Record<ProductFile["kind"], string> = {
  model: ".glb,.gltf,.obj,.step,.stp,.fbx,.usdz,.zprj,.3dm,.stl",
  dieline: ".pdf,.ai,.eps,.svg",
  artwork: ".pdf,.ai,.eps,.svg,.png,.tif,.tiff",
  techpack: ".pdf,.xlsx,.xls,.numbers",
  flats: ".ai,.svg,.pdf,.eps",
  cad: ".dxf,.dwg,.step,.stp,.iges,.igs,.3dm,.stl",
  spec: ".pdf,.xlsx,.xls",
};

/** Everything else, under one closed row: each section opens on its own, the factory files one level deeper. */
function AllDetails({
  product,
  kind,
  open,
  onOpen,
  sections,
  onSections,
}: {
  product: Product;
  kind?: ProductKind;
  open: boolean;
  onOpen: (open: boolean) => void;
  sections: string[];
  onSections: (s: string[]) => void;
}) {
  const { canEdit } = useRole();
  const catalogue = useCatalogue().data;
  const toast = useToast();
  const save = useSaveProductSpecs();
  const upload = useUploadShot();
  const uploadFile = useUploadProductFile();
  const tokens = useDetailTokens(product.id).data ?? [];
  const [editing, setEditing] = useState<SpecField | null>(null);
  const [choosingKind, setChoosingKind] = useState(false);
  const [busySlot, setBusySlot] = useState<string>();
  const [more, setMore] = useState<Record<string, boolean>>({});
  const specs = product.specs ?? [];
  const entry = (id: string) => specs.find((s) => s.fieldId === id);
  const fail = (error: Error) => toast.error("That wasn’t saved", { description: error.message });
  const fid = fidelity(product, kind);
  const read = proposalsOf(product);
  // One count: every detail Fume holds, read or given, the same unit as "Fume read 14 details" above.
  const details =
    specs.filter((x) => filled(x.value)).length + (product.parts ?? []).length + (product.shots ?? []).length;

  function saveValue(field: SpecField, v: { value: SpecValue; unit?: string }) {
    save.mutate(
      { productId: product.id, values: [{ fieldId: field.id, ...v }] },
      { onSuccess: () => setEditing(null), onError: fail },
    );
  }
  const keep = (input: { keep?: string[]; keepParts?: string[]; keepShots?: string[] }) =>
    save.mutate({ productId: product.id, ...input }, { onError: fail });

  function addShot(slotId: string, file: File) {
    setBusySlot(slotId);
    upload.mutate(
      { productId: product.id, slotId, name: file.name, bytes: file.size, src: previewOf(file), blob: file },
      { onError: fail, onSettled: () => setBusySlot(undefined) },
    );
  }
  async function addFile(kindOfFile: ProductFile["kind"], label: string) {
    const [file] = await pickFiles(fileAccept[kindOfFile], false);
    if (!file) return;
    uploadFile.mutate(
      { productId: product.id, kind: kindOfFile, name: file.name, bytes: file.size },
      {
        onSuccess: () => toast.done(`${label} added`, { description: "Fume reads it and shows what it finds here." }),
        onError: fail,
      },
    );
  }
  async function onGap(g: FidelityGap) {
    if (g.kind === "field") {
      const f = kind && fieldsOf(kind).find((x) => x.id === g.id);
      if (f) setEditing(f);
    } else if (g.kind === "shot") {
      const [file] = await pickFiles("image/*", false);
      if (file) addShot(g.id, file);
    }
  }
  function chooseKind(k: ProductKind) {
    save.mutate({ productId: product.id, kindId: k.id }, { onSuccess: () => setChoosingKind(false), onError: fail });
  }

  const row = (f: SpecField) => {
    const e = entry(f.id);
    return (
      <SpecRow
        key={f.id}
        field={f}
        entry={e}
        canEdit={canEdit}
        onEdit={() => setEditing(f)}
        extra={e?.detailTokenId ? <span className="ui-pspec-need">Protected on every creative</span> : undefined}
      />
    );
  };
  const rows = (fields: SpecField[], two = false) => (
    <dl className={two ? "ui-pspec-rows ui-pspec-rows--two" : "ui-pspec-rows"}>{fields.map(row)}</dl>
  );

  /** A section's rows folded to what matters first, with "Show all" for the rest. */
  const folded = (key: string, fields: SpecField[], two: boolean) => {
    const keepIds = new Set(essentials(fields, specs).map((f) => f.id));
    fields.forEach((f) => levelOf(f) === "short" && keepIds.add(f.id));
    const isOpen = more[key] || keepIds.size === 0 || fields.length - keepIds.size <= 1;
    const shown = isOpen ? fields : fields.filter((f) => keepIds.has(f.id));
    const hidden = fields.length - shown.length;
    return (
      <>
        {shown.length > 0 && rows(shown, two)}
        {(hidden > 0 || (more[key] && keepIds.size > 0 && fields.length - keepIds.size > 1)) && (
          <div className="ui-pspec-more">
            <Button
              size="sm"
              variant="quiet"
              icon="chevron-down"
              data-open={isOpen || undefined}
              aria-expanded={isOpen}
              onClick={() => setMore((o) => ({ ...o, [key]: !isOpen }))}
            >
              {isOpen ? "Show fewer" : `Show all ${fields.length}`}
            </Button>
          </div>
        )}
      </>
    );
  };

  /** "Confirm all 3": one labelled pill per section for what Fume read in it; never one per value. */
  const keepAll = (n: number, title: string, input: { keep?: string[]; keepParts?: string[]; keepShots?: string[] }) =>
    canEdit && n > 0 ? (
      <div className="ui-pdetails-keep">
        <Button
          size="sm"
          variant="secondary"
          icon="check"
          aria-label={n === 1 ? `Confirm it, in ${title}` : `Confirm all ${n} in ${title}`}
          onClick={() => keep(input)}
          disabled={save.isPending}
        >
          {n === 1 ? "Confirm it" : `Confirm all ${n}`}
        </Button>
        <span className="ui-pspec-need">Fume read {n === 1 ? "this" : "these"}. Change any that is off.</span>
      </div>
    ) : null;

  // What waits for her inside a section is "to confirm"; only the expert checks.
  const metaFor = (proposed: number, missing: number) =>
    proposed ? `${proposed} to confirm` : missing ? `${missing} missing` : undefined;

  const group = (id: SpecGroupId) => kind?.groups.find((g) => g.id === id);
  const all = kind ? fieldsOf(kind) : [];
  const techFields = all.filter((f) => levelOf(f) === "technical");
  const files = product.files ?? [];
  const parts = product.parts ?? [];
  const shots = product.shots ?? [];
  const label = (id: string) => all.find((f) => f.id === id)?.label;
  const dims = entry("dims")?.value;
  const categories = catalogue?.categories ?? [];
  const collections = catalogue?.collections ?? [];
  const inCollections = collections.filter((c) => product.collectionIds?.includes(c.id));
  const gaps = fid.gaps.filter((g) => g.kind !== "proposals");

  const groupItem = (g: NonNullable<ReturnType<typeof group>>) => {
    const fields = g.fields.filter((f) => levelOf(f) !== "technical");
    if (!fields.length) return null;
    const proposed = fields.filter((f) => entry(f.id)?.provenance.state === "proposed");
    const missing = fields.filter((f) => f.required && !(entry(f.id) && filled(entry(f.id)!.value))).length;
    const two = fields.length > 2;
    return (
      <Fragment key={g.id}>
        <AccordionItem value={g.id} id={`spec-${g.id}`}>
          <AccordionTrigger headingLevel={3} meta={metaFor(proposed.length, missing)}>
            {g.title}
          </AccordionTrigger>
          <AccordionContent>
            <div className="ui-pdetails-body">
              {keepAll(proposed.length, g.title, { keep: proposed.map((f) => f.id) })}
              {g.id === "size" && isDims(dims) ? (
                <div className="ui-pspec-split">
                  <DimsDrawing dims={dims} label={`${product.name}: ${valueWords(undefined, { value: dims })}`} />
                  <div className="ui-app-stack">{folded(g.id, fields, false)}</div>
                </div>
              ) : (
                folded(g.id, fields, two)
              )}
              {g.id === "label" && tokens.length > 0 && (
                <ul className="ui-pfix-tokens" aria-label="Details we protect">
                  {tokens.map((t) => (
                    <li key={t.id}>
                      <Proposal state={t.provenance.state} className="ui-pfix-token">
                        <DetailCutout token={t} />
                        <span className="ui-pfix-token-text">
                          <span className="ui-brand-caption-title">{t.label}</span>
                          <span className="ui-brand-caption-text">{t.value}</span>
                        </span>
                        {t.provenance.state === "proposed" && (
                          <ProposalFoot>
                            <ReadTag provenance={t.provenance} />
                          </ProposalFoot>
                        )}
                      </Proposal>
                    </li>
                  ))}
                </ul>
              )}
              {g.id === "variants" && product.variants && product.variants.length > 0 && (
                <p className="ui-pspec-need">On sale as: {product.variants.map((v) => v.name).join(", ")}</p>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
        {g.id === "materials" && !group("packaging") && parts.length > 0 && (
          <AccordionItem value="parts" id="spec-parts">
            <AccordionTrigger headingLevel={3} meta={metaFor(read.parts.length, 0)}>
              Packaging parts
            </AccordionTrigger>
            <AccordionContent>
              <div className="ui-pdetails-body">
                {keepAll(read.parts.length, "Packaging parts", { keepParts: read.parts.map((x) => x.id) })}
                <PartsList parts={parts} />
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
      </Fragment>
    );
  };

  const neededShots = kind?.shots.filter((s) => s.required) ?? [];
  const missingShots = neededShots.filter((s) => !shots.some((x) => x.slotId === s.id)).length;

  return (
    <section className="ui-pdetails" aria-label="All details">
      <Accordion value={open ? ["all"] : []} onValueChange={(v) => onOpen(v.includes("all"))}>
        <AccordionItem value="all" id="all-details">
          {/* one count, the details it holds ("14 details"), the same words as the line above; never "to check" */}
          <AccordionTrigger headingLevel={2} meta={details ? copy.count(details, "detail") : undefined}>
            All details
          </AccordionTrigger>
          <AccordionContent>
            <Accordion type="multiple" flush value={sections} onValueChange={onSections}>
              <AccordionItem value="about" id="spec-about">
                <AccordionTrigger headingLevel={3} meta={kind ? undefined : "Kind not set"}>
                  Category and collections
                </AccordionTrigger>
                <AccordionContent>
                  <div className="ui-pdetails-body">
                    <dl className="ui-pspec-rows ui-pspec-rows--two">
                      <div className="ui-pspec-row" data-missing={kind ? undefined : ""}>
                        <dt className="ui-pspec-label">Kind</dt>
                        <dd className="ui-pspec-value">{kind?.name ?? "Not set"}</dd>
                        {canEdit && (
                          <dd className="ui-pspec-actions">
                            <Button
                              size="sm"
                              variant="quiet"
                              onClick={() => setChoosingKind(true)}
                              aria-label="Change the kind"
                            >
                              {kind ? "Change" : "Choose"}
                            </Button>
                          </dd>
                        )}
                      </div>
                      <div className="ui-pspec-row" data-missing={product.sku ? undefined : ""}>
                        <dt className="ui-pspec-label">SKU</dt>
                        <dd className="ui-pspec-value">{product.sku ?? "Not added"}</dd>
                      </div>
                      <div className="ui-pspec-row" data-missing={product.categoryId ? undefined : ""}>
                        <dt className="ui-pspec-label">Category</dt>
                        <dd className="ui-pspec-value">
                          {categoryPath(categories, product.categoryId) ?? "Not sorted yet"}
                        </dd>
                      </div>
                      <div className="ui-pspec-row" data-missing={inCollections.length ? undefined : ""}>
                        <dt className="ui-pspec-label">Collections</dt>
                        <dd className="ui-pspec-value">
                          {inCollections.length ? inCollections.map((c) => c.name).join(", ") : "In none yet"}
                        </dd>
                      </div>
                    </dl>
                    {canEdit && catalogue && (
                      <ProductMenu
                        product={product}
                        categories={categories}
                        collections={collections}
                        onPage
                        trigger={
                          <Button size="sm" variant="quiet" icon="layers">
                            Move it
                          </Button>
                        }
                      />
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {kind && kind.groups.filter((g) => g.id !== "use").map(groupItem)}

              {kind && (
                <AccordionItem value="shots" id="spec-shots">
                  <AccordionTrigger headingLevel={3} meta={metaFor(read.shots.length, missingShots)}>
                    Reference shots
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="ui-pdetails-body">
                      {keepAll(read.shots.length, "Reference shots", { keepShots: read.shots.map((x) => x.slotId) })}
                      <p className="ui-pspec-need">On white, the whole product in frame, the label readable.</p>
                      <ShotGrid
                        kind={kind}
                        shots={shots}
                        who={() => undefined}
                        onPick={canEdit ? addShot : undefined}
                        busySlot={busySlot}
                        label={`Reference shots of ${product.name}`}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}

              {kind && group("use") && groupItem(group("use")!)}

              {kind && gaps.length > 0 && (
                <AccordionItem value="gaps" id="spec-gaps">
                  <AccordionTrigger headingLevel={3} meta={`${gaps.length}`}>
                    Add these and every creative gets truer
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="ui-pdetails-body">
                      <p className="ui-pspec-need">
                        Not needed to start. Each one takes the guessing out of a creative.
                      </p>
                      <GapList gaps={gaps} canEdit={canEdit} onGap={(g) => void onGap(g)} />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}

              {kind && (kind.files.length > 0 || files.length > 0 || techFields.length > 0) && (
                <AccordionItem value="factory" id="spec-factory">
                  <AccordionTrigger headingLevel={3} meta={files.length ? `${files.length} added` : undefined}>
                    Production notes
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="ui-pdetails-body">
                      <ul className="ui-pfiles">
                        {[
                          ...kind.files,
                          ...files
                            .filter((x) => !kind.files.some((k) => k.kind === x.kind))
                            .map((x) => ({ kind: x.kind, label: x.name, help: "" })),
                        ].map((f) => {
                          const mine = files.filter((x) => x.kind === f.kind);
                          return (
                            <li key={f.label} className="ui-pfile" data-missing={mine.length ? undefined : ""}>
                              <span className="ui-pfile-icon" aria-hidden="true">
                                <Icon name={mine.length ? "file-text" : "file"} />
                              </span>
                              <div className="ui-pfile-body">
                                <span className="ui-pfile-title">{f.label}</span>
                                {mine.length === 0 && <span className="ui-pfile-help">{f.help}</span>}
                                {mine.map((x) => (
                                  <div key={x.id} className="ui-pfile-one">
                                    <span className="ui-pfile-name">{x.name}</span>
                                    <span className="ui-pfile-meta">{formatBytes(x.bytes)}</span>
                                    {x.read && x.read.length > 0 && (
                                      <div className="ui-pfile-read">
                                        <span className="ui-pfile-read-title">What Fume read</span>
                                        <ul className="ui-pfile-lines">
                                          {x.read.map((line) => (
                                            <li key={line}>{line}</li>
                                          ))}
                                        </ul>
                                        {x.filled && x.filled.length > 0 && (
                                          <span className="ui-pfile-help">
                                            Filled: {x.filled.map(label).filter(Boolean).join(", ")}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                              {canEdit && (
                                <div className="ui-pfile-action">
                                  <Button
                                    size="sm"
                                    variant="quiet"
                                    icon="upload"
                                    onClick={() => void addFile(f.kind, f.label)}
                                    aria-label={
                                      mine.length
                                        ? `Add another ${f.label.toLowerCase()}`
                                        : `Add the ${f.label.toLowerCase()}`
                                    }
                                  >
                                    {mine.length ? "Add another" : "Add"}
                                  </Button>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                      {techFields.length > 0 && (
                        <div className="ui-pdetails-group">
                          <h4 className="ui-pdetails-sub">Factory data</h4>
                          {folded("technical", techFields, true)}
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {editing && (
        <SpecDialog
          key={editing.id}
          field={editing}
          entry={entry(editing.id)}
          productName={product.name}
          saving={save.isPending}
          onSave={(v) => saveValue(editing, v)}
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}
      {canEdit && (
        <KindDialog
          open={choosingKind}
          onOpenChange={setChoosingKind}
          value={product.kindId}
          onPick={chooseKind}
          busy={save.isPending}
        />
      )}
    </section>
  );
}

// ─── The page ───────────────────────────────────────────────────────────────

/** One status sentence under the title: what blocks confirming, said as questions ("2 questions for you", the same
 *  number as the card's "1 of 2"), "Ready to confirm", then "Confirmed", with a change someone proposes named
 *  ("Confirmed · Anna proposes a change"). */
function statusOf(
  p: Product,
  questions: number,
  proposals: ProductOverride[],
  who: (id?: string) => string | undefined,
): string {
  if (p.state === "verified") {
    if (!proposals.length) return "Confirmed";
    const name = who(proposals[0].by) ?? "Fume’s designer";
    return `Confirmed · ${name} ${name === "You" ? "propose" : "proposes"} ${proposals.length === 1 ? "a change" : `${proposals.length} changes`}`;
  }
  if (p.state === "draft" && p.facts.length === 0) return "Fume is reading it";
  return questions ? `${copy.count(questions, "question")} for you` : "Ready to confirm";
}

/** "Your detail photo" → "your detail photo"; "LYS-KN-001 tech pack" and "lysne.no" stay as they are. */
const lowerFirst = (e: string) => (/^[A-Z][a-z]/.test(e) ? e.charAt(0).toLowerCase() + e.slice(1) : e);

export function ProductPage() {
  const { productId } = useParams<"productId">();
  const product = useProduct(productId ?? "");
  const kinds = useProductKinds().data;
  const questions = useQuestions().data ?? [];
  const overrides = (useProductProposals(productId).data ?? []).filter((o) => o.state === "proposed");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [sections, setSections] = useState<string[]>([]);
  const p = product.data;
  const title = p ? `${p.name} ${p.variant}`.trim() : "Product";
  const kind = kinds?.find((k) => k.id === p?.kindId);

  // What is asked about this product: the shared questions first, then any open line no question covers yet.
  const asks = p ? questions.filter((q) => q.productId === p.id) : [];
  const unknownFacts = p ? p.facts.filter((f) => f.source === "unknown" && !asks.some((q) => q.factId === f.id)) : [];
  const read = p ? proposalsOf(p) : undefined;
  const who = useWho();

  /** "See them": open All details at the first section that holds what Fume read. */
  function openDetails(section?: string) {
    setDetailsOpen(true);
    let target = section;
    if (section === "read" && p && kind) {
      const first = read?.specs[0] && kind.groups.find((g) => g.fields.some((f) => f.id === read.specs[0]!.fieldId));
      target = first ? first.id : read?.parts.length ? "parts" : read?.shots.length ? "shots" : undefined;
    }
    if (target) setSections((s) => (s.includes(target!) ? s : [...s, target!]));
    window.setTimeout(
      () =>
        document
          .getElementById(target ? `spec-${target}` : "all-details")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      80,
    );
  }

  return (
    <Page title={title}>
      <PageHeader
        title={title}
        // Up to Products, under Brand; a back arrow, never a path. The shell's history-aware Back names where she came from.
        back={<Back to="/brand/products" label="Products" />}
        description={p ? statusOf(p, asks.length + unknownFacts.length, overrides, who) : undefined}
        actions={p ? <PhotoButton product={p} /> : undefined}
      />
      <Query query={product} loading="Loading the product">
        {(data) => (
          <>
            <div className="ui-pcheck">
              <div className="ui-pcheck-media">
                <Gallery product={data} />
              </div>
              <div className="ui-pcheck-body">
                <Needs product={data} questions={asks} facts={unknownFacts} />
                <TruthList product={data} kind={kind} onDetails={openDetails} />
              </div>
            </div>
            {/* everything Fume holds, organised, in view without opening a section */}
            <ProductTruthSheet product={data} kind={kind} />
            <AllDetails
              product={data}
              kind={kind}
              open={detailsOpen}
              onOpen={setDetailsOpen}
              sections={sections}
              onSections={setSections}
            />
          </>
        )}
      </Query>
    </Page>
  );
}
