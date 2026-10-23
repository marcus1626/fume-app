// Import products (round 7, Marcus 16 Oct, decided points 2 and 3; PROPOSED): one button, three sources. From your
// website (Fume reads the product pages, the sitemap and a Shopify or WooCommerce feed), from a CSV (Fume
// maps the columns to Fume's fields and asks only about the ones it is unsure of, with its guesses filled in), from
// an unsorted zip (pictures, PDFs, spec sheets, tech packs: Fume groups the files into products, proposes the
// kind and pulls the data). While it reads: what it reads now in shimmer words, the counts, the last few steps. Then
// "What Fume found" (FoundReview, shared with the brand update), and after it the products in the catalogue.
// Round 8 (walk-through 19 Oct, TASK-6; PROPOSED): the main action says what it does, "Add 2 to the catalogue" (it
// never approved anything), and after it one Ink pill, "Confirm them now", opens the confirm queue: one product at a
// time, two taps each, instead of opening every product's page.
// Round 9 (desktop review 19 Oct, DLAY-15, DTSK-18, DLOAD-1, DLOAD-7; PROPOSED): each source opens as the right panel on
// a desk (the grid stays in view; a sheet from the bottom on a phone), and so do Change and Merge. Fume reads, sorts
// and finds; the Engine only makes creatives. One verb each: Confirm, Change, Later.
import {
  Button,
  Dropzone,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FoundFields,
  FoundReview,
  Icon,
  Input,
  OptionMenu,
  PickGrid,
  PickTile,
  Progress,
  ProductTile,
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
  TextShimmer,
  useToast,
  type FoundItem,
} from "@fume/ui";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  useApproveImport,
  useCatalogue,
  useDecideFound,
  useDismissImport,
  useMapImportColumns,
  useProductImport,
  useProductKinds,
  useStartProductImport,
} from "../../api/hooks";
import type { FoundProduct, ImportFile, ImportJob, ImportSource, ProductKind } from "../../contract";
import * as copy from "../../copy";
import { CHECK_PRODUCTS } from "./parts";

const sourceWords: Record<ImportSource, { label: string; line: string; icon: "link" | "file-text" | "folder" }> = {
  website: { label: "From your website", line: "Paste the address; Fume reads every product page", icon: "link" },
  csv: { label: "From a CSV", line: "A product list or a Shopify export; Fume maps the columns", icon: "file-text" },
  zip: { label: "From a zip", line: "Pictures, PDFs, spec sheets, tech packs, unsorted", icon: "folder" },
};

/** Where the import reads from, in words: "lysne.no", "lysne-products-2026.csv". */
const fromWords = (job: ImportJob) => job.url ?? job.fileName ?? "your files";

// ─── The entry point ────────────────────────────────────────────────────────

/** "Import products": one button with the three sources in an option menu; each opens its own right panel. */
export function ImportProducts({
  variant = "quiet",
  size = "sm",
}: {
  variant?: "quiet" | "secondary" | "primary";
  size?: "sm" | "md";
}) {
  const [source, setSource] = useState<ImportSource | null>(null);
  return (
    <>
      <OptionMenu
        title="Import products"
        options={(Object.keys(sourceWords) as ImportSource[]).map((s) => ({
          id: s,
          icon: sourceWords[s].icon,
          label: sourceWords[s].label,
          description: sourceWords[s].line,
          onSelect: () => setSource(s),
        }))}
      >
        <Button variant={variant} size={size} icon="upload">
          Import products
        </Button>
      </OptionMenu>
      <ImportSourceDialog source={source} onOpenChange={(open) => !open && setSource(null)} />
    </>
  );
}

export function ImportSourceDialog({
  source,
  onOpenChange,
}: {
  source: ImportSource | null;
  onOpenChange: (open: boolean) => void;
}) {
  const start = useStartProductImport();
  const toast = useToast();
  const [url, setUrl] = useState("https://lysne.no");
  const [file, setFile] = useState<{ name: string; bytes: number } | null>(null);
  const open = source !== null;

  function close() {
    onOpenChange(false);
    setFile(null);
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!source) return;
    // Round 13 (robot note 05): «lysne.no» is enough; the https:// is added for her
    const site = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
    start.mutate(source === "website" ? { source, url: site } : { source, file: file ?? undefined }, {
      onSuccess: () => close(),
      onError: (error) => toast.error("The import didn’t start", { description: error.message }),
    });
  }

  const ready = source === "website" ? /\w+\.\w+/.test(url) : Boolean(file);
  const title =
    source === "website" ? "Import from your website" : source === "csv" ? "Import from a CSV" : "Import from a zip";
  const description =
    source === "website"
      ? "Fume reads your product pages, the sitemap and your shop’s product feed (Shopify, WooCommerce), and compares what it finds with your products."
      : source === "csv"
        ? "One product per row, any columns. Fume matches the columns to what it needs and asks only about the ones it is unsure of."
        : "Everything you have, unsorted: pictures, PDFs, spec sheets, tech packs, label artwork. Fume sorts them into products and reads what it can.";

  return (
    <Sheet open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <SheetContent side="right" size="lg">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <SheetBody>
          <form id="import-source" onSubmit={submit} aria-label={title}>
            {source === "website" ? (
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="import-url">Your website</FieldLabel>
                  <Input
                    id="import-url"
                    type="text"
                    inputMode="url"
                    autoComplete="url"
                    spellCheck={false}
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="lysne.no"
                    data-ui-autofocus
                  />
                  <FieldDescription>
                    Your shop’s front page is enough, such as lysne.no; Fume finds the products from there.
                  </FieldDescription>
                </Field>
              </FieldGroup>
            ) : (
              source && (
                <Dropzone
                  accept={source === "csv" ? ".csv,text/csv" : ".zip,application/zip"}
                  maxBytes={source === "csv" ? 20_000_000 : 2_000_000_000}
                  maxLabel={source === "csv" ? "20 MB" : "2 GB"}
                  icon={source === "csv" ? "file-text" : "folder"}
                  copy={source === "csv" ? "Drop your CSV here, or choose it" : "Drop your zip here, or choose it"}
                  touchCopy={source === "csv" ? "Tap to choose your CSV" : "Tap to choose your zip"}
                  moreCopy="Choose another"
                  compact={Boolean(file)}
                  items={file ? [{ id: "f", name: file.name, bytes: file.bytes, state: "done" }] : []}
                  onFiles={(files) => files[0] && setFile({ name: files[0].name, bytes: files[0].size })}
                  onRemove={() => setFile(null)}
                />
              )
            )}
          </form>
        </SheetBody>
        <SheetFooter>
          <SheetClose asChild>
            <Button variant="glass-clear">Later</Button>
          </SheetClose>
          <Button type="submit" form="import-source" variant="glass-white" loading={start.isPending} disabled={!ready}>
            {source === "website" ? "Read the website" : source === "csv" ? "Read the CSV" : "Read the zip"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── The import on the Products page ────────────────────────────────────────

/** The import under way, waiting for its columns, waiting for review, or just approved. Nothing when there is none. */
export function ImportPanel() {
  const job = useProductImport().data;
  if (!job) return null;
  if (job.state === "reading") return <ImportProgress job={job} />;
  if (job.state === "mapping") return <ImportMapping job={job} />;
  if (job.state === "review") return <ImportReview job={job} />;
  if (job.state === "done") return <ImportResult job={job} />;
  return null;
}

function ImportProgress({ job }: { job: ImportJob }) {
  const dismiss = useDismissImport();
  const recent = job.log.slice(-3);
  return (
    <section className="ui-import" data-state="reading" aria-labelledby="import-title" aria-busy="true">
      <div className="ui-import-head">
        <h2 className="ui-import-title" id="import-title">
          Importing from {fromWords(job)}
        </h2>
        <Button variant="quiet" size="sm" onClick={() => dismiss.mutate(job.id)} disabled={dismiss.isPending}>
          Stop
        </Button>
      </div>
      <p className="ui-import-now" aria-live="polite">
        <Icon name="fume-engine" />
        <TextShimmer>
          {job.reading ? `Fume is ${job.reading.charAt(0).toLowerCase()}${job.reading.slice(1)}` : "Fume is reading"}
        </TextShimmer>
      </p>
      <Progress value={Math.round(job.progress * 100)} aria-label="How far Fume has read" />
      <dl className="ui-import-counts">
        {job.counts.map((c) => (
          <div key={c.label} className="ui-import-count">
            <dt>{c.label}</dt>
            <dd>{c.n}</dd>
          </div>
        ))}
      </dl>
      {recent.length > 0 && (
        <ol className="ui-import-log" aria-label="Read so far">
          {recent.map((line, i) => (
            <li key={`${line}-${i}`} data-age={recent.length - 1 - i}>
              <Icon name="check" />
              {line}
            </li>
          ))}
        </ol>
      )}
      <p className="ui-import-hint">You can leave this page; Fume keeps reading and the import waits here for you.</p>
    </section>
  );
}

/** CSV: shown only when Fume is unsure of a column; its guesses are filled in. */
function ImportMapping({ job }: { job: ImportJob }) {
  const map = useMapImportColumns();
  const dismiss = useDismissImport();
  const toast = useToast();
  const columns = job.columns ?? [];
  const unsure = columns.filter((c) => !c.sure);
  const [all, setAll] = useState(false);
  const [picked, setPicked] = useState<Record<string, string>>(() =>
    Object.fromEntries(columns.map((c) => [c.column, c.fieldId ?? "skip"])),
  );
  const shown = all ? columns : unsure;
  const options = [...(job.fieldOptions ?? []), { id: "skip", label: "Leave this column out" }];

  function submit(e: FormEvent) {
    e.preventDefault();
    map.mutate(
      {
        jobId: job.id,
        columns: columns.map((c) => ({
          column: c.column,
          fieldId: picked[c.column] === "skip" ? null : (picked[c.column] ?? null),
        })),
      },
      { onError: (error) => toast.error("That wasn’t saved", { description: error.message }) },
    );
  }

  return (
    <section className="ui-import" data-state="mapping" aria-labelledby="import-title">
      <div className="ui-import-head">
        <h2 className="ui-import-title" id="import-title">
          {unsure.length === 1 ? "One column needs you" : `${copy.count(unsure.length, "column")} need you`}
        </h2>
        <Button variant="quiet" size="sm" onClick={() => dismiss.mutate(job.id)} disabled={dismiss.isPending}>
          Stop
        </Button>
      </div>
      <p className="ui-import-text">
        Fume matched {columns.length - unsure.length} of the {columns.length} columns in {fromWords(job)}. It is unsure
        of {unsure.length === 1 ? "this one" : "these"}; its guess is filled in.
      </p>
      <form id="import-map" onSubmit={submit} className="ui-import-map">
        {shown.map((c) => (
          <div key={c.column} className="ui-import-map-row" data-unsure={!c.sure || undefined}>
            <div className="ui-import-map-column">
              <span className="ui-import-map-name" id={`col-${c.column}`}>
                {c.column}
              </span>
              <span className="ui-import-map-sample">{c.sample}</span>
              {c.why && !c.sure && <span className="ui-import-map-why">{c.why}</span>}
            </div>
            <Icon name="arrow-right" className="ui-import-map-arrow" />
            <Select value={picked[c.column]} onValueChange={(v) => setPicked((now) => ({ ...now, [c.column]: v }))}>
              <SelectTrigger aria-labelledby={`col-${c.column}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </form>
      <div className="ui-import-actions">
        <Button type="submit" form="import-map" variant="primary" loading={map.isPending}>
          Go on reading
        </Button>
        <Button variant="quiet" onClick={() => setAll((v) => !v)}>
          {all ? "Show only the unsure ones" : `Show all ${columns.length} columns`}
        </Button>
      </div>
    </section>
  );
}

// ─── What Fume found ──────────────────────────────────────────────────

const fileIcon = (f: ImportFile) => (f.kind === "picture" ? "image" : f.kind === "page" ? "link" : "file-text");
const fileKind: Record<ImportFile["kind"], string> = {
  page: "Page",
  picture: "Picture",
  pdf: "PDF",
  spec: "Spec sheet",
  techpack: "Tech pack",
  artwork: "Label artwork",
  other: "File",
};

function Files({ files }: { files: ImportFile[] }) {
  if (files.length < 2) return null;
  return (
    <div className="ui-import-files">
      <p className="ui-import-files-title">{copy.count(files.length, "file")} in this group</p>
      <ul>
        {files.map((f, i) => (
          <li key={`${f.name}-${i}`}>
            <Icon name={fileIcon(f)} />
            <span className="ui-import-file-name">{f.name}</span>
            <span className="ui-import-file-kind">{fileKind[f.kind]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function kindLine(f: FoundProduct, kinds: ProductKind[]) {
  const k = kinds.find((x) => x.id === f.kindId);
  if (!k) return "Kind not known yet";
  return f.kindConfidence === "low" ? `${k.name}?` : k.name;
}

function ImportReview({ job }: { job: ImportJob }) {
  const kinds = useProductKinds().data ?? [];
  const decide = useDecideFound();
  const approve = useApproveImport();
  const dismiss = useDismissImport();
  const toast = useToast();
  const [fixing, setFixing] = useState<FoundProduct | null>(null);
  const [merging, setMerging] = useState<FoundProduct | null>(null);

  const run = (
    foundId: string,
    decision: Parameters<ReturnType<typeof useDecideFound>["mutate"]>[0]["decision"],
    done?: string,
  ) =>
    decide.mutate(
      { jobId: job.id, foundId, decision },
      {
        onSuccess: () => done && toast.done(done),
        onError: (error) => toast.error("That wasn’t saved", { description: error.message }),
      },
    );

  const items: FoundItem[] = job.found.map((f) => {
    const pictures = f.files.filter((x) => x.kind === "picture").length;
    const others = job.found.filter((x) => x.id !== f.id);
    const read = f.fields.map((x) => ({ label: x.label, value: x.value }));
    return {
      id: f.id,
      status: f.status,
      title: f.name,
      subtitle: f.status === "changed" ? f.changes : [f.variant, kindLine(f, kinds)].filter(Boolean).join(" · "),
      image: f.images.length === 1 ? f.images[0] : undefined,
      images: f.status === "unsure" && f.images.length > 1 ? f.images : f.images.slice(0, 1),
      icon: f.images.length ? undefined : "tag",
      confidence: f.confidence,
      source: f.source,
      note: f.note,
      kept: Boolean(f.decision),
      before:
        f.status === "changed" ? (
          <FoundFields
            image={f.patch?.image ? f.images[1] : undefined}
            rows={f.fields.map((x) => ({ label: x.label, value: x.before ?? "Not known yet" }))}
          />
        ) : undefined,
      after:
        f.status === "changed" ? (
          <FoundFields
            image={f.patch?.image}
            imageLabel="New picture"
            rows={f.fields.map((x) => ({ label: x.label, value: x.value, changed: x.before !== x.value }))}
          />
        ) : read.length ? (
          <FoundFields rows={[{ label: "Kind", value: kindLine(f, kinds) }, ...read]} />
        ) : undefined,
      detail: job.source === "zip" ? <Files files={f.files} /> : undefined,
      actions:
        job.source === "zip"
          ? [
              ...(pictures > 1
                ? [
                    {
                      id: "split",
                      label: `Split into ${pictures}`,
                      icon: "columns-2" as const,
                      onSelect: () => run(f.id, { verdict: "split" }, `${f.name} split into ${pictures}`),
                    },
                  ]
                : []),
              ...(others.length
                ? [{ id: "merge", label: "Merge with…", icon: "layers" as const, onSelect: () => setMerging(f) }]
                : []),
            ]
          : undefined,
    };
  });

  const counts = {
    new: job.found.filter((f) => f.status === "new").length,
    changed: job.found.filter((f) => f.status === "changed").length,
    unsure: job.found.filter((f) => f.status === "unsure").length,
  };
  const parts = [
    counts.new && `${counts.new} new`,
    counts.changed && `${counts.changed} changed`,
    counts.unsure && `${counts.unsure} it is unsure of`,
  ]
    .filter(Boolean)
    .join(", ");
  const read =
    job.source === "website"
      ? `On ${fromWords(job)}`
      : job.source === "csv"
        ? `In ${fromWords(job)}`
        : `In ${fromWords(job)}`;
  const summary =
    job.found.length === 0
      ? `${read} Fume found nothing new: ${copy.count(job.unchanged, "product")} ${job.unchanged === 1 ? "is" : "are"} exactly as Fume has ${job.unchanged === 1 ? "it" : "them"}.`
      : `${read} Fume found ${copy.count(job.found.length, "product")} to look at: ${parts}.${job.unchanged ? ` ${copy.count(job.unchanged, "product")} ${job.unchanged === 1 ? "is" : "are"} exactly as Fume has ${job.unchanged === 1 ? "it" : "them"}, so ${job.unchanged === 1 ? "it is" : "they are"} not shown.` : ""} Open one to see what it read.`;

  return (
    <section className="ui-import" data-state="review">
      <FoundReview
        title="What Fume found"
        summary={summary}
        items={items}
        busy={decide.isPending || approve.isPending}
        approveLabel={(n) => `Add ${n} to the catalogue`}
        onApproveAll={() =>
          approve.mutate(job.id, {
            onError: (error) => toast.error("That wasn’t saved", { description: error.message }),
          })
        }
        onKeep={(id) => run(id, { verdict: "keep" })}
        onFix={(id) => setFixing(job.found.find((f) => f.id === id) ?? null)}
        onRemove={(id) => {
          const f = job.found.find((x) => x.id === id);
          run(
            id,
            { verdict: "remove" },
            f?.status === "changed" ? `${f.name} stays as it was` : `${f?.name ?? "It"} is not imported`,
          );
        }}
        footer={
          <>
            {job.setAside && <p>{job.setAside.line}</p>}
            <div className="ui-import-actions">
              <Button variant="quiet" size="sm" onClick={() => dismiss.mutate(job.id)} disabled={dismiss.isPending}>
                {job.found.length ? "Import nothing" : "Close"}
              </Button>
            </div>
          </>
        }
      />
      <FixDialog job={job} found={fixing} kinds={kinds} onOpenChange={(o) => !o && setFixing(null)} />
      <MergeDialog
        found={merging}
        others={job.found.filter((f) => f.id !== merging?.id)}
        onOpenChange={(o) => !o && setMerging(null)}
        onMerge={(intoId) => {
          if (!merging) return;
          const into = job.found.find((f) => f.id === intoId);
          run(merging.id, { verdict: "merge", intoId }, `Merged into ${into?.name ?? "the product"}`);
          setMerging(null);
        }}
      />
    </section>
  );
}

/** Change one: the found product's fields with Fume's values filled in, each marked as what Fume read. */
function FixDialog({
  job,
  found,
  kinds,
  onOpenChange,
}: {
  job: ImportJob;
  found: FoundProduct | null;
  kinds: ProductKind[];
  onOpenChange: (open: boolean) => void;
}) {
  const decide = useDecideFound();
  const toast = useToast();
  const [draft, setDraft] = useState<{
    id?: string;
    name: string;
    variant: string;
    kindId: string;
    fields: Record<string, string>;
  }>({ name: "", variant: "", kindId: "", fields: {} });
  if (found && draft.id !== found.id)
    setDraft({
      id: found.id,
      name: found.name,
      variant: found.variant === "Name not found" ? "" : (found.variant ?? ""),
      kindId: found.kindId ?? "",
      fields: Object.fromEntries(found.fields.map((f) => [f.fieldId, f.value])),
    });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!found) return;
    decide.mutate(
      {
        jobId: job.id,
        foundId: found.id,
        decision: {
          verdict: "fix",
          name: draft.name.trim() || found.name,
          variant: draft.variant.trim(),
          kindId: draft.kindId || undefined,
          fields: Object.entries(draft.fields).map(([fieldId, value]) => ({ fieldId, value })),
        },
      },
      {
        onSuccess: () => {
          toast.done(`${draft.name.trim() || found.name} changed.`, {
            description: "It comes in with the others when you add them.",
          });
          onOpenChange(false);
        },
        onError: (error) => toast.error("That wasn’t saved", { description: error.message }),
      },
    );
  }

  return (
    <Sheet open={Boolean(found)} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="lg">
        <SheetHeader>
          <SheetTitle>Change {found?.name}</SheetTitle>
          <SheetDescription>
            What Fume read is filled in. Change what is wrong; what you save counts as yours.
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          {found && (
            <form id="import-fix" onSubmit={submit} aria-label={`Change ${found.name}`}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="fix-name">Name</FieldLabel>
                  <Input
                    id="fix-name"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    data-ui-autofocus
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="fix-variant">Size or variant</FieldLabel>
                  <Input
                    id="fix-variant"
                    value={draft.variant}
                    onChange={(e) => setDraft({ ...draft, variant: e.target.value })}
                    placeholder="100 ml"
                  />
                </Field>
                <Field>
                  <FieldLabel id="fix-kind-label">Kind of product</FieldLabel>
                  <Select value={draft.kindId || undefined} onValueChange={(v) => setDraft({ ...draft, kindId: v })}>
                    <SelectTrigger aria-labelledby="fix-kind-label">
                      <SelectValue placeholder="Choose the kind" />
                    </SelectTrigger>
                    <SelectContent>
                      {kinds.map((k) => (
                        <SelectItem key={k.id} value={k.id}>
                          {k.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {found.kindId && (
                    <FieldDescription>
                      Fume’s guess{found.kindConfidence === "low" ? ", not sure" : ""}
                    </FieldDescription>
                  )}
                </Field>
                {found.fields.map((f) => (
                  <Field key={f.fieldId}>
                    <FieldLabel htmlFor={`fix-${f.fieldId}`}>{f.label}</FieldLabel>
                    <Input
                      id={`fix-${f.fieldId}`}
                      value={draft.fields[f.fieldId] ?? ""}
                      onChange={(e) => setDraft({ ...draft, fields: { ...draft.fields, [f.fieldId]: e.target.value } })}
                    />
                    <FieldDescription>Fume read this{f.source ? ` on ${f.source}` : ""}</FieldDescription>
                  </Field>
                ))}
              </FieldGroup>
            </form>
          )}
        </SheetBody>
        <SheetFooter>
          <SheetClose asChild>
            <Button variant="glass-clear">Later</Button>
          </SheetClose>
          <Button type="submit" form="import-fix" variant="glass-white" loading={decide.isPending}>
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** Merge a zip group into another found product: the other products as pictures. */
function MergeDialog({
  found,
  others,
  onOpenChange,
  onMerge,
}: {
  found: FoundProduct | null;
  others: FoundProduct[];
  onOpenChange: (open: boolean) => void;
  onMerge: (intoId: string) => void;
}) {
  return (
    <Sheet open={Boolean(found)} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="lg">
        <SheetHeader>
          <SheetTitle>Merge {found?.name} with</SheetTitle>
          <SheetDescription>Its files and what Fume read join the product you pick.</SheetDescription>
        </SheetHeader>
        <SheetBody>
          <PickGrid size="sm" aria-label="Found products">
            {others.map((o) => (
              <PickTile
                key={o.id}
                title={o.name}
                line={o.variant}
                src={o.images[0]}
                icon="package"
                onOpen={() => onMerge(o.id)}
                label={`Merge into ${o.name}`}
              />
            ))}
          </PickGrid>
        </SheetBody>
        <SheetFooter>
          <SheetClose asChild>
            <Button variant="glass-clear">Later</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── After approval ─────────────────────────────────────────────────────────

function ImportResult({ job }: { job: ImportJob }) {
  const catalogue = useCatalogue().data;
  const dismiss = useDismissImport();
  const navigate = useNavigate();
  const landed = (job.result?.productIds ?? [])
    .map((id) => catalogue?.products.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  const toConfirm = landed.filter((p) => p.state !== "verified");
  const added = job.result?.added ?? 0;
  const updated = job.result?.updated ?? 0;
  const what = [added && `${added} new`, updated && `${updated} updated`].filter(Boolean).join(", ");

  return (
    <section className="ui-import" data-state="done" aria-labelledby="import-title">
      <div className="ui-import-head">
        <h2 className="ui-import-title" id="import-title">
          {copy.count(landed.length, "product")} from {fromWords(job)} {landed.length === 1 ? "is" : "are"} in your
          catalogue
        </h2>
      </div>
      <p className="ui-import-text">
        {what ? `${what[0]!.toUpperCase()}${what.slice(1)}. ` : ""}
        {toConfirm.length
          ? `Fume read ${toConfirm.length === 1 ? "it" : "them"}; confirm ${toConfirm.length === 1 ? "it" : "them"} before ${toConfirm.length === 1 ? "it goes" : "they go"} into a campaign, one at a time.`
          : "Every one is confirmed."}
      </p>
      {landed.length > 0 && (
        <PickGrid size="sm" aria-label="Imported products">
          {landed.map((p) => (
            <ProductTile
              key={p.id}
              name={p.name}
              line={p.variant || undefined}
              note={p.state === "verified" ? "Confirmed" : "Not confirmed yet"}
              src={p.images[0]}
              onOpen={() => navigate(`/brand/products/${p.id}`)}
            />
          ))}
        </PickGrid>
      )}
      <div className="ui-import-actions">
        {toConfirm.length > 0 && (
          <Button
            variant="primary"
            icon="check"
            onClick={() => {
              dismiss.mutate(job.id);
              navigate(CHECK_PRODUCTS);
            }}
          >
            Confirm {toConfirm.length === 1 ? "it" : "them"} now
          </Button>
        )}
        <Button
          variant={toConfirm.length ? "quiet" : "secondary"}
          onClick={() => dismiss.mutate(job.id)}
          disabled={dismiss.isPending}
        >
          {toConfirm.length ? "Later" : "Done"}
        </Button>
      </div>
    </section>
  );
}
