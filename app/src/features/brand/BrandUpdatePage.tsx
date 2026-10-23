// Update the brand (/brand/update, from "More about your Brand DNA"): an onboarded brand is read again, from the
// website or from a zip of new things or changes. Fume compares what it reads with the approved Brand DNA and shows
// only what is new, changed or unsure, in the shared "What Fume found" review (FoundReview, @fume/ui): Approve all, or
// confirm, change or remove one. A find is changed, never "fixed", in the right panel; a confirmed one shows in the row
// itself, so it posts no toast. Fume reads and finds, never "the Engine" (it only makes creatives).
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dropzone,
  Field,
  FieldDescription,
  FieldLabel,
  FoundReview,
  Icon,
  Input,
  PageHeader,
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
  type DropzoneItem,
  type FoundItem,
} from "@fume/ui";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  useApproveBrandUpdate,
  useBrandBoard,
  useBrandScan,
  useBrandUpdate,
  useDecideBrandFound,
  useStartBrandUpdate,
} from "../../api/hooks";
import type { BrandFound, BrandIdentity, BrandUpdate } from "../../contract";
import * as copy from "../../copy";
import { Back, Page, Query } from "../../shell/Page";
import { vars } from "./board";
import { useRole } from "./parts";

const bare = (url: string) =>
  url
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
const HEX = /^#[0-9a-f]{6}$/i;
const icon = {
  colour: "palette",
  typeface: "type",
  voice: "message-square",
  logo: "image",
  rule: "list",
  image: "image",
} as const;

function Swatch({ hex }: { hex: string }) {
  return (
    <div className="ui-brand-update-swatch">
      <span className="ui-brand-update-colour" style={vars({ "--swatch": hex })} role="img" aria-label={hex} />
      <span className="ui-brand-update-hex">{hex.toUpperCase()}</span>
    </div>
  );
}

function Face({ name, family }: { name: string; family?: string }) {
  return (
    <div className="ui-brand-update-type" style={vars({ "--brand-font": family })}>
      <span className="ui-brand-update-aa" aria-hidden="true">
        Aa
      </span>
      <span className="ui-brand-update-type-name">{name}</span>
    </div>
  );
}

/** The customer's own value, drawn as itself: a swatch, a face, a line. */
function valueOf(f: BrandFound, value: string | undefined, identity: BrandIdentity | undefined): ReactNode {
  if (value === undefined) return undefined;
  if (f.kind === "colour") return <Swatch hex={value} />;
  if (f.kind === "typeface") {
    const known = identity?.typefaces.find((t) => t.name === value)?.cssFamily;
    return (
      <Face
        name={value}
        family={
          known ?? `"${value}", ${identity?.typefaces.find((t) => t.id === f.targetId)?.cssFamily ?? "system-ui"}`
        }
      />
    );
  }
  if (f.kind === "voice")
    return (
      <div>
        <p className="ui-brand-update-quote">{value}</p>
        {f.subtitle && <p className="ui-brand-update-quote-example">{f.subtitle}</p>}
      </div>
    );
  return value;
}

/** A colour's tile is the colour itself: the new one, or old and new side by side for a change (a data picture). */
function colourTile(f: BrandFound): string | undefined {
  if (f.kind !== "colour" || !f.after) return undefined;
  const ok = (h?: string) => (h && HEX.test(h) ? h : undefined);
  const before = ok(f.before);
  const after = ok(f.after);
  if (!after) return undefined;
  const svg = before
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2" preserveAspectRatio="none"><rect width="1" height="2" fill="${before}"/><rect x="1" width="1" height="2" fill="${after}"/></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2" preserveAspectRatio="none"><rect width="2" height="2" fill="${after}"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function toItem(f: BrandFound, identity: BrandIdentity | undefined): FoundItem {
  return {
    id: f.id,
    status: f.status,
    title: f.title,
    subtitle: f.subtitle,
    image: f.image ?? colourTile(f),
    images: f.images,
    icon: icon[f.kind],
    // Unsure shows both too: the customer decides with what Brand DNA holds in view.
    before: valueOf(f, f.before, identity),
    after: valueOf(f, f.after, identity),
    confidence: f.confidence,
    source: f.source,
    note: f.note,
    kept: f.decision === "kept" || f.decision === "fixed",
  };
}

/** Change: the customer says what is right, and that goes into Brand DNA (the data's verdict is still "fix"). A
 *  form, so it opens as the right panel. */
function ChangePanel({ update, found, onClose }: { update: BrandUpdate; found: BrandFound; onClose: () => void }) {
  const decide = useDecideBrandFound();
  const toast = useToast();
  const field = {
    colour: {
      label: "The colour’s hex",
      help: "Six digits, for example #A3927B. Fume uses your value from the next creative on.",
    },
    typeface: { label: "The typeface’s name", help: "As it is called in your guidelines or by the foundry." },
    voice: { label: "The line, in your words", help: "Write it the way you would tell a copywriter." },
    image: {
      label: "What this set is called",
      help: "For example Autumn 2026. The pictures are kept under this name.",
    },
    logo: { label: "The logo’s name", help: "What your team calls this version." },
    rule: { label: "The rule, in your words", help: "One sentence every creative can be held against." },
  }[found.kind];
  const start = found.after ?? found.title;
  const [text, setText] = useState(start);
  const next =
    found.kind === "colour"
      ? (text.trim().startsWith("#") ? text.trim() : `#${text.trim()}`).toUpperCase()
      : text.trim();
  const valid = found.kind === "colour" ? HEX.test(next) : next.length > 0;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    decide.mutate(
      { updateId: update.id, foundId: found.id, verdict: "fix", value: next },
      {
        onSuccess: () => {
          toast.done(`${found.title} changed`, { description: "Your value is in your Brand DNA now." });
          onClose();
        },
        onError: (error) => toast.error("The change wasn’t saved", { description: error.message }),
      },
    );
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Change {found.title}</SheetTitle>
          <SheetDescription>
            Fume read this on {found.source}. Say what is right, and it becomes yours.
          </SheetDescription>
        </SheetHeader>
        <form className="ui-sheet-form" onSubmit={submit}>
          <SheetBody>
            <Field>
              <FieldLabel htmlFor={`change-${found.id}-value`}>{field.label}</FieldLabel>
              <Input
                id={`change-${found.id}-value`}
                value={text}
                onChange={(e) => setText(e.target.value)}
                aria-describedby={`change-${found.id}-help`}
                data-ui-autofocus
              />
              <FieldDescription id={`change-${found.id}-help`}>{field.help}</FieldDescription>
            </Field>
          </SheetBody>
          <SheetFooter>
            <SheetClose asChild>
              <Button type="button" variant="glass-clear">
                Cancel
              </Button>
            </SheetClose>
            <Button type="submit" variant="glass-white" loading={decide.isPending} disabled={!valid}>
              Save the change
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

/** The two ways in: the website again (the main one), or a zip. */
function Ways({ onStarted }: { onStarted: () => void }) {
  const scan = useBrandScan();
  const start = useStartBrandUpdate();
  const toast = useToast();
  const { canApprove } = useRole();
  const [url, setUrl] = useState(scan.data?.url ?? "lysne.no");
  const [files, setFiles] = useState<(DropzoneItem & { file: File })[]>([]);
  const site = bare(url);

  function read(source: "website" | "upload") {
    start.mutate(
      {
        source,
        url: source === "website" ? site : undefined,
        files: source === "upload" ? files.map((f) => ({ name: f.name, bytes: f.bytes })) : undefined,
      },
      {
        onSuccess: onStarted,
        onError: (error) => toast.error("Fume couldn’t start reading", { description: error.message }),
      },
    );
  }

  return (
    <div className="ui-brand-update">
      <div className="ui-brand-update-ways">
        <Card>
          <CardHeader>
            <Icon name="globe" />
            <CardTitle>Read {bare(scan.data?.url ?? "") || "your website"} again</CardTitle>
            <CardDescription>New pages, colours or campaigns on it.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="ui-app-stack"
              onSubmit={(e) => {
                e.preventDefault();
                if (site.length > 3) read("website");
              }}
            >
              <Field>
                <FieldLabel htmlFor="update-url">Website address</FieldLabel>
                <Input
                  id="update-url"
                  type="text"
                  inputMode="url"
                  autoComplete="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={!canApprove}
                />
              </Field>
              <div className="ui-app-row">
                <Button
                  type="submit"
                  icon="fume-engine"
                  loading={start.isPending && start.variables?.source === "website"}
                  disabled={site.length <= 3 || !canApprove}
                >
                  Read it again
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Icon name="upload" />
            <CardTitle>Upload new material</CardTitle>
            <CardDescription>A zip, guidelines, logos, fonts or pictures.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="ui-app-stack">
              <Dropzone
                compact
                items={files}
                onFiles={(list) =>
                  setFiles((now) => [
                    ...now,
                    ...list.map((f, i) => ({
                      id: `up-${Date.now()}-${i}`,
                      name: f.name,
                      bytes: f.size,
                      state: "done" as const,
                      file: f,
                    })),
                  ])
                }
                onRemove={(id) => setFiles((now) => now.filter((f) => f.id !== id))}
                accept=".zip,image/*,.pdf,.svg,.otf,.ttf,.woff,.woff2"
                maxBytes={500_000_000}
                maxLabel="500 MB"
                target="your Brand DNA"
                copy="Drop a zip or files here, or choose them"
                touchCopy="Tap to choose a zip or files"
                meta="Zip, PDF, images or fonts · up to 500 MB"
                listLabel="New things to read"
                disabled={!canApprove}
              />
              {files.length > 0 && (
                <div className="ui-app-row">
                  <Button
                    variant="secondary"
                    icon="fume-engine"
                    loading={start.isPending && start.variables?.source === "upload"}
                    onClick={() => read("upload")}
                  >
                    Read {files.length === 1 ? files[0].name : copy.count(files.length, "upload")}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      {!canApprove && <p className="ui-brand-update-note">An owner or an approver updates the brand.</p>}
    </div>
  );
}

function Reading({ update }: { update: BrandUpdate }) {
  const where = update.url ?? update.files[0] ?? "your upload";
  return (
    <div className="ui-brand-update-reading" aria-live="polite">
      <p className="ui-brand-update-now">
        <Icon name="fume-engine" />
        <TextShimmer>{update.reading ?? `Fume is opening ${where}`}</TextShimmer>
      </p>
      <ol className="ui-brand-update-sources" aria-label="What Fume reads">
        {update.sources.map((s) => (
          <li key={s.id} className="ui-brand-update-source" data-state={s.state}>
            <span className="ui-brand-update-source-label">{s.label}</span>
            <span className="ui-brand-update-source-state">
              {s.state === "waiting" ? "Waiting" : s.state === "reading" ? "Reading now" : "Compared"}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Review({ update, identity }: { update: BrandUpdate; identity?: BrandIdentity }) {
  const decide = useDecideBrandFound();
  const approve = useApproveBrandUpdate();
  const toast = useToast();
  const { canApprove } = useRole();
  const [fixing, setFixing] = useState<BrandFound | null>(null);
  const open = update.found.filter((f) => f.decision !== "removed");
  const items = open.map((f) => toItem(f, identity));
  const n = (s: BrandFound["status"]) => update.found.filter((f) => f.status === s).length;
  const counts = [
    n("new") && `${n("new")} new`,
    n("changed") && `${n("changed")} changed`,
    n("unsure") && `${n("unsure")} unsure`,
  ]
    .filter(Boolean)
    .join(", ");
  const where = update.url ?? (update.files.length ? update.files.join(", ") : "your upload");

  const answer = (foundId: string, verdict: "keep" | "remove") => {
    const f = update.found.find((x) => x.id === foundId);
    decide.mutate(
      { updateId: update.id, foundId, verdict },
      {
        // a confirmed one shows in the row itself; leaving one out takes it out of the list, so that one is said.
        onSuccess: () => {
          if (verdict === "remove")
            toast.done(f?.status === "changed" ? `${f?.title} stays as it was` : `${f?.title} left out`);
        },
        onError: (error) => toast.error("That wasn’t saved", { description: error.message }),
      },
    );
  };

  return (
    <>
      <FoundReview
        title="What Fume found"
        summary={`On ${where}: ${counts}. ${copy.count(update.unchanged, "thing")} match your Brand DNA and are left as they are.`}
        items={items}
        busy={decide.isPending || approve.isPending || !canApprove}
        onApproveAll={() =>
          approve.mutate(update.id, {
            onSuccess: () =>
              toast.done("Your Brand DNA is updated", { description: "Every creative from now on is made with it." }),
            onError: (error) => toast.error("The update wasn’t approved", { description: error.message }),
          })
        }
        onKeep={(id) => answer(id, "keep")}
        onFix={(id) => setFixing(update.found.find((f) => f.id === id) ?? null)}
        onRemove={(id) => answer(id, "remove")}
        footer={
          update.products && update.products.count > 0 ? (
            <Alert>
              <Icon name="package" />
              <AlertTitle>
                {/* the same products Import from website finds, new or changed */}
                {update.products.count === 1
                  ? "1 product new or changed"
                  : `${update.products.count} products new or changed`}
                , see {update.products.count === 1 ? "it" : "them"} in Products
              </AlertTitle>
              <AlertDescription>
                {update.products.names.join("; ")}. Products have their own import and review; nothing was added here.
              </AlertDescription>
              <AlertAction>
                <Button asChild variant="secondary" size="sm" iconEnd="arrow-right">
                  <Link to="/brand/products">Open Products</Link>
                </Button>
              </AlertAction>
            </Alert>
          ) : undefined
        }
      />
      {fixing && <ChangePanel update={update} found={fixing} onClose={() => setFixing(null)} />}
    </>
  );
}

function Applied({ update, onAgain }: { update: BrandUpdate; onAgain: () => void }) {
  const kept = update.found.filter((f) => f.decision === "kept" || f.decision === "fixed").length;
  return (
    <Alert variant="success">
      <AlertTitle>{kept === 0 ? "Nothing new was kept" : "Your Brand DNA is updated"}</AlertTitle>
      <AlertDescription>
        {kept === 0
          ? "Your Brand DNA stays as it was."
          : `${copy.count(kept, "thing")} from ${update.url ?? "your upload"} ${kept === 1 ? "is" : "are"} in your Brand DNA now.`}
      </AlertDescription>
      <AlertAction>
        <Button asChild size="sm" iconEnd="arrow-right">
          <Link to="/brand">Open Brand DNA</Link>
        </Button>
        <Button size="sm" variant="secondary" onClick={onAgain}>
          Update again
        </Button>
      </AlertAction>
    </Alert>
  );
}

export function BrandUpdatePage() {
  const query = useBrandUpdate();
  const board = useBrandBoard();
  const [fresh, setFresh] = useState(false);

  return (
    <Page title="Update the brand · Brand" width="reading">
      <PageHeader
        title="Update the brand"
        back={<Back to="/brand" label="Brand" />}
        description="Fume shows only what is new or changed."
      />
      <Query query={query} loading="Loading">
        {(update) =>
          !update || (fresh && update.state === "applied") ? (
            <Ways onStarted={() => setFresh(false)} />
          ) : update.state === "reading" ? (
            <Reading update={update} />
          ) : update.state === "failed" ? (
            <Alert variant="error">
              <AlertTitle>{update.error ?? `We could not read ${update.url ?? "your upload"}.`}</AlertTitle>
              <AlertDescription>Try again, or upload the new things instead.</AlertDescription>
            </Alert>
          ) : update.state === "applied" ? (
            <Applied update={update} onAgain={() => setFresh(true)} />
          ) : (
            <Review update={update} identity={board.data?.identity} />
          )
        }
      </Query>
    </Page>
  );
}
