// Graphic design by Fume on a version (FLOWS §33, PROPOSED). A Fume designer asks Fume to lay the plan's approved
// words on the picked picture in the brand's design system. It comes back as a version of its own, picked, with an
// editable design file; the picture under it stays as it is. What code measured and what Fume's review found are
// for Fume's people only, here and in Check; an agency's people and customers never see them.
// - The action sits under the strip, beside "Add a picture made by hand", and opens a dialog that says what Fume
//   lays on the picture and with what: the plan's words word for word, the design system in use, the designer's ask.
// - Fume designs in the Design studio (round 14, FLOWS §34.5): from Image, starting a design takes the Studio to
//   Design, whose strip holds the designs; Image keeps the pictures.
// - While Fume designs, the version is in the strip with the picture under it and "Fume is designing".
// - The panel (?design=<version id>) is a peek, like the prompt's: what Fume's review found, what code measured, the
//   words, the design file and Design again. A version that could not be designed opens it with why.
// - Never Amber: nothing here is a person's check. Rouge only for a hard check that failed.
import {
  Button,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldDescription,
  FieldLabel,
  Icon,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  TextShimmer,
  Textarea,
  useToast,
  type IconName,
} from "@fume/ui";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useDesignAsk, useDesignVersion } from "../../../api/hooks";
import type {
  CreativeDocument,
  DesignBookUsed,
  DesignCheck,
  DesignDrawing,
  DesignFinding,
  DesignWords,
  RenderVersion,
  VersionDesign,
} from "../../../contract";
import * as copy from "../../../copy";
import { useFumeTeam } from "../shared";

/** Only Fume's designers ask Fume for graphic design and read what it found (design_layers is Fume's own). */
export const useSeesDesign = useFumeTeam;

// ─── The words drawn on the picture (demo only) ─────────────────────────────

/** The faces of a drawing, from Google Fonts, once. */
function useFonts(fonts: string[]) {
  const families = fonts.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500`).join("&");
  useEffect(() => {
    if (!families) return;
    const href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.append(link);
  }, [families]);
}

/** The words Fume laid on the picture, drawn over it where the demo has no designed PNG (the live picture carries
 *  them). Sizes are pixels at a frame 1080 wide, so they scale with the picture. */
export function DrawnWords({ drawing }: { drawing: DesignDrawing }) {
  useFonts(drawing.fonts);
  const px = (n: number) => `${(n / 1080) * 100}cqw`;
  return (
    <span className="ui-design-drawn" aria-hidden="true">
      {drawing.shade && (
        <span
          className="ui-design-shade"
          data-from={drawing.shade.from}
          // The brand's own scrim on its creative (its design system's photo text), not Fume's interface.
          style={{
            background: `linear-gradient(to ${drawing.shade.from === "top" ? "bottom" : "top"}, rgb(0 0 0 / ${drawing.shade.opacity}), transparent)`,
          }}
        />
      )}
      {drawing.layers.map((l) => (
        <span
          key={l.role}
          className="ui-design-words"
          data-role={l.role}
          style={{
            left: `${l.x}%`,
            top: `${l.y}%`,
            width: `${l.w}%`,
            textAlign: l.align === "centre" ? "center" : l.align,
            justifyContent: l.align === "centre" ? "center" : l.align === "right" ? "flex-end" : "flex-start",
          }}
        >
          <span
            className="ui-design-words-text"
            data-fill={l.fill ? "" : undefined}
            style={{
              color: l.colour,
              fontFamily: l.family,
              fontSize: px(l.sizePx),
              fontWeight: l.weight,
              lineHeight: l.lineHeight,
              letterSpacing: `${l.trackingEm}em`,
              ...(l.fill
                ? {
                    background: l.fill,
                    borderRadius: Math.min(l.radiusPx ?? 0, 999),
                    padding: `${px(l.paddingPx ?? 0)} ${px((l.paddingPx ?? 0) * 1.6)}`,
                  }
                : {}),
            }}
          >
            {l.text}
          </span>
        </span>
      ))}
    </span>
  );
}

// ─── Words ───────────────────────────────────────────────────────────────────

const severityWords: Record<DesignFinding["severity"], string> = {
  critical: "Critical",
  major: "Major",
  minor: "Minor",
};
const severityOrder: Record<DesignFinding["severity"], number> = { critical: 0, major: 1, minor: 2 };
const checkWords: Record<DesignCheck["check"], string> = {
  fits: "Safe area",
  lines: "Lines",
  contrast: "Contrast",
  busy: "Calm under the words",
  covers: "Keeps clear",
  font: "Typeface",
};
const nodeWords: Record<string, string> = {
  Words: "the words",
  Headline: "the headline",
  Subline: "the supporting line",
  CTA: "the call to action",
  Action: "the call to action",
};
const node = (n: string) => nodeWords[n] ?? (n === "h1" || n === "display" || n === "h2" ? "the headline" : n);

export const bookWords = (b?: DesignBookUsed) =>
  b
    ? `Version ${b.version} · ${b.state === "approved" ? "approved" : b.state === "checked" ? "checked" : "a draft"}`
    : "";

/** "Ready for check", or what Fume's review and code said, short enough for a tile: "Needs work · 2 design notes". */
export function designFlags(v: RenderVersion, picture: { clean: boolean; words: string }) {
  const d = v.design;
  if (!d || v.state !== "done") return picture;
  const notes = d.findings.length;
  const parts = [
    !picture.clean && picture.words.split(" · ")[0],
    d.verdict === "needs_work" && "Needs work",
    notes > 0 && copy.count(notes, "design note"),
  ].filter(Boolean) as string[];
  return parts.length ? { clean: false, words: parts.join(" · ") } : { clean: true, words: "Ready for check" };
}

/** The tile's second line for a designed version. */
export const designLine = (d: VersionDesign) => `Designed from V${d.fromNumber}`;

/** The checks in the order a designer reads them: what failed hard, what code only says, then what passed. */
const checkOrder = (c: DesignCheck) => (c.ok ? 2 : c.hard ? 0 : 1);
const mark = (c: DesignCheck): IconName => (c.ok ? "check" : c.hard ? "circle-x" : "triangle-alert");

/** "Contrast · the headline": one check's name and part. */
const checkName = (c: DesignCheck) =>
  c.check === "font" ? checkWords.font : `${checkWords[c.check]} · ${node(c.node)}`;

/** Fume's review of the finished layout: its verdict, and what a designer would fix, most severe first. */
export function DesignFindings({ design, tone }: { design: VersionDesign; tone: "glass" | "page" }) {
  const findings = [...design.findings].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  return (
    <ul className="ui-design-list" data-tone={tone} aria-label="What Fume’s review found">
      {design.verdict && (
        <li className="ui-design-item" data-verdict={design.verdict}>
          <Icon
            name={design.verdict === "ready_for_check" ? "circle-check" : "circle-alert"}
            className="ui-design-mark"
          />
          <span className="ui-design-text">
            <span className="ui-design-what">
              {design.verdict === "ready_for_check"
                ? "Ready for the expert’s check"
                : "Needs work before it goes to check"}
            </span>
          </span>
        </li>
      )}
      {findings.map((f, i) => (
        <li key={i} className="ui-design-item" data-severity={f.severity}>
          <Icon name="circle-alert" className="ui-design-mark" />
          <span className="ui-design-text">
            <span className="ui-design-what">{f.what}</span>
            <span className="ui-design-note">
              {severityWords[f.severity]} · {f.by === "code" ? "from code’s checks" : "Fume’s review"}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** What code measured. Compact: what passed in one line, and only the rest one by one. */
export function DesignChecks({
  checks,
  tone,
  compact = false,
}: {
  checks: DesignCheck[];
  tone: "glass" | "page";
  compact?: boolean;
}) {
  const sorted = [...checks].sort((a, b) => checkOrder(a) - checkOrder(b));
  const passed = sorted.filter((c) => c.ok);
  const shown = compact ? sorted.filter((c) => !c.ok) : sorted;
  return (
    <ul className="ui-design-list" data-tone={tone} data-dense="" aria-label="What code measured">
      {shown.map((c, i) => (
        <li key={i} className="ui-design-item" data-check={c.ok ? "ok" : c.hard ? "failed" : "soft"}>
          <Icon name={mark(c)} className="ui-design-mark" />
          <span className="ui-design-text">
            <span className="ui-design-what">{checkName(c)}</span>
            <span className="ui-design-note">{c.note}</span>
          </span>
        </li>
      ))}
      {compact && passed.length > 0 && (
        <li className="ui-design-item" data-check="ok">
          <Icon name="check" className="ui-design-mark" />
          <span className="ui-design-text">
            <span className="ui-design-what">{`${copy.count(passed.length, "check")} passed`}</span>
            <span className="ui-design-note">{passedLine(passed)}</span>
          </span>
        </li>
      )}
    </ul>
  );
}

/** The passed checks in one line: "Inside the safe area · 2 lines · contrast 6.2:1 and 5.1:1 · calm under the headline". */
function passedLine(passed: DesignCheck[]) {
  const words: string[] = [];
  if (passed.some((c) => c.check === "fits")) words.push("inside the safe area");
  const lines = passed.filter((c) => c.check === "lines" && c.value !== undefined).map((c) => c.value);
  if (lines.length) words.push(`${lines.join(" and ")} line${lines.length === 1 && lines[0] === 1 ? "" : "s"}`);
  const contrast = passed.filter((c) => c.check === "contrast" && c.value !== undefined).map((c) => `${c.value}:1`);
  if (contrast.length) words.push(`contrast ${contrast.join(" and ")}`);
  // Named by part, so a part that failed the same check (listed above) never reads as passed here.
  const parts = (check: DesignCheck["check"]) => [
    ...new Set(passed.filter((c) => c.check === check).map((c) => node(c.node))),
  ];
  const calm = parts("busy");
  if (calm.length) words.push(`calm under ${calm.join(" and ")}`);
  const clear = parts("covers");
  if (clear.length) words.push(`${clear.join(" and ")} clear of the product`);
  const s = words.join(" · ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** The plan's words, word for word. */
/** In a dialog (no tone) at the control size; on the sheet's glass at the label size. */
function Words({ words, tone }: { words: DesignWords; tone?: "glass" }) {
  const rows: [string, string | undefined][] = [
    ["Headline", words.headline],
    ["Supporting line", words.subline],
    ["Call to action", words.cta],
  ];
  return (
    <dl className="ui-design-rows" data-tone={tone}>
      {rows
        .filter(([, v]) => v)
        .map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
    </dl>
  );
}

// ─── Add graphic design ──────────────────────────────────────────────────────

/** Under the strip: Fume lays the plan's words on the picked picture. Fume's designers only. */
export function AddGraphicDesign({
  doc,
  base,
  onStarted,
}: {
  doc: CreativeDocument;
  base: string;
  /** Fume started: the Studio goes to Design, where the design lands (FLOWS §34.5). */
  onStarted?: () => void;
}) {
  const sees = useSeesDesign();
  const [open, setOpen] = useState(false);
  const picked = doc.versions.find((v) => v.id === doc.pickedVersionId && v.state === "done");
  if (!sees || doc.studio === "video") return null;
  const under = picked?.design ? doc.versions.find((v) => v.id === picked.design!.fromVersionId) : picked;
  const designing = under && doc.versions.find((v) => v.state === "rendering" && v.design?.fromVersionId === under.id);
  return (
    <>
      <Button
        size="sm"
        variant="quiet"
        icon="type"
        disabled={!under || Boolean(designing)}
        title={!under ? "Pick a rendered version first" : undefined}
        onClick={() => setOpen(true)}
      >
        {designing
          ? `Fume is designing on V${under!.number}`
          : !under
            ? "Add graphic design"
            : picked?.design
              ? `Design again from V${under.number}`
              : `Add graphic design to V${under.number}`}
      </Button>
      {open && picked && (
        <DesignDialog doc={doc} version={picked} base={base} onOpenChange={setOpen} onStarted={onStarted} />
      )}
    </>
  );
}

/** What Fume will do, with what, and the designer's ask. */
function DesignDialog({
  doc,
  version,
  base,
  onOpenChange,
  onStarted,
}: {
  doc: CreativeDocument;
  version: RenderVersion;
  /** The brand's root in this frame, for the design system's page. */
  base: string;
  onOpenChange: (open: boolean) => void;
  onStarted?: () => void;
}) {
  const ask = useDesignAsk(doc.id, version.id);
  const design = useDesignVersion();
  const toast = useToast();
  const [text, setText] = useState("");
  const a = ask.data;
  const n = a?.fromNumber ?? version.number;
  const id = "design-ask";
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!a || a.blocked) return;
    design
      .mutateAsync({ documentId: doc.id, versionId: version.id, ...(text.trim() ? { ask: text.trim() } : {}) })
      .then(
        (d) => {
          onOpenChange(false);
          onStarted?.();
          const made = [...d.versions].reverse().find((v) => v.design?.fromVersionId === a.fromVersionId);
          toast.done(made ? `Fume is designing version ${made.number}` : "Fume is designing it", {
            description: `On V${n}, in the design system. V${n} stays as it is.`,
          });
        },
        (err: Error) => toast.error("The graphic design wasn’t started", { description: err.message }),
      );
  };
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{version.design ? `Design again from V${n}` : `Add graphic design to V${n}`}</DialogTitle>
          <DialogDescription>
            {`Fume lays the plan’s words on V${n} and checks the layout. You get a new version, with a file you can change by hand; V${n} stays as it is.`}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {ask.isPending ? (
            <p className="ui-design-loading">
              <TextShimmer>Reading the plan and the design system</TextShimmer>
            </p>
          ) : a ? (
            <form id={id} className="ui-design-form" onSubmit={submit}>
              <section className="ui-design-part" aria-labelledby={`${id}-words`}>
                <h3 className="ui-design-head" id={`${id}-words`}>
                  The words, from the approved plan
                </h3>
                {a.words ? (
                  <Words words={a.words} />
                ) : (
                  <p className="ui-design-quiet">The plan has no headline for this creative yet.</p>
                )}
              </section>
              <section className="ui-design-part" aria-labelledby={`${id}-book`}>
                <h3 className="ui-design-head" id={`${id}-book`}>
                  The design system
                </h3>
                {a.book ? (
                  <p className="ui-design-line">
                    {bookWords(a.book)}
                    {a.book.state !== "approved" && <span className="ui-design-quiet">, not approved yet</span>}
                    {" · "}
                    <Link className="ui-design-link" to={`${base}/brand/design`}>
                      Open it
                    </Link>
                  </p>
                ) : (
                  <p className="ui-design-quiet">None yet.</p>
                )}
              </section>
              {a.blocked ? (
                <p className="ui-design-blocked" role="status">
                  <Icon name="info" />
                  <span>{a.blocked}</span>
                </p>
              ) : (
                <Field>
                  <FieldLabel htmlFor={`${id}-text`}>Anything Fume should know (if anything)</FieldLabel>
                  <Textarea
                    id={`${id}-text`}
                    rows={3}
                    value={text}
                    maxLength={1000}
                    onChange={(e) => setText(e.target.value)}
                    aria-describedby={`${id}-help`}
                    data-ui-autofocus
                  />
                  <FieldDescription id={`${id}-help`}>
                    For example: Keep the words high, clear of the bottle. The words stay the plan’s.
                  </FieldDescription>
                </Field>
              )}
            </form>
          ) : (
            <p className="ui-design-blocked" role="alert">
              <Icon name="info" />
              <span>{ask.error?.message ?? "Fume could not read what it would lay on the picture."}</span>
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="glass-clear">Cancel</Button>
          </DialogClose>
          <Button
            type="submit"
            form={id}
            variant="glass-white"
            icon="type"
            loading={design.isPending}
            disabled={!a || Boolean(a.blocked)}
          >
            {version.design ? "Design again" : "Add graphic design"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── The panel ───────────────────────────────────────────────────────────────

/** The panel's version, in the address. */
export function useDesignAddress() {
  const [search, setSearch] = useSearchParams();
  const id = search.get("design") ?? undefined;
  const set = (versionId: string | undefined) =>
    setSearch(
      (s) => {
        const next = new URLSearchParams(s);
        if (versionId) next.set("design", versionId);
        else next.delete("design");
        return next;
      },
      { replace: !versionId },
    );
  return { id, open: (versionId: string) => set(versionId), close: () => set(undefined) };
}

const bandWords = { top: "At the top", middle: "In the middle", bottom: "At the foot" } as const;
const groundWords = { photo: "on the picture", gradient: "on a soft shade", flat: "on a flat ground" } as const;
const alignWords = { left: "left", centre: "centred", right: "right" } as const;

/** What Fume laid on a version, for Fume's people: the review, code's checks, the words, the file, Design again. */
export function DesignSheet({ doc }: { doc: CreativeDocument }) {
  const { id, close } = useDesignAddress();
  const sees = useSeesDesign();
  const design = useDesignVersion();
  const toast = useToast();
  const v = id ? doc.versions.find((x) => x.id === id) : undefined;
  const d = sees ? v?.design : undefined;
  const open = Boolean(v && d && v.state !== "rendering");
  const failed = v?.state === "failed";
  const again = () => {
    if (!v) return;
    design.mutateAsync({ documentId: doc.id, versionId: v.id }).then(
      (next) => {
        close();
        const made = [...next.versions].reverse().find((x) => x.design?.fromVersionId === d?.fromVersionId);
        toast.done(made ? `Fume is designing version ${made.number}` : "Fume is designing it", {
          description: `Again from V${d?.fromNumber}, with the same words.`,
        });
      },
      (err: Error) => toast.error("The graphic design wasn’t started", { description: err.message }),
    );
  };
  const download = () => {
    if (!d?.document) return;
    if (d.document.url) {
      const a = document.createElement("a");
      a.href = d.document.url;
      a.download = d.document.name;
      a.click();
    } else
      toast.info("No file in the demo", {
        description: `Live, ${d.document.name} is the file the design service made.`,
      });
  };
  const hardFailed = d?.checks.filter((c) => c.hard && !c.ok).length ?? 0;
  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()} modal={false}>
      <SheetContent side="right" size="lg" className="ui-desk-sheet ui-desk-trace">
        {v && d && (
          <>
            <SheetHeader>
              <SheetTitle>
                {failed ? `Version ${v.number} wasn’t designed` : `The graphic design on version ${v.number}`}
              </SheetTitle>
              <SheetDescription>
                {failed
                  ? (d.error ?? v.failure ?? "Fume could not lay the words on the picture.")
                  : `Fume laid the plan’s words on V${d.fromNumber}. Only Fume’s team sees this.`}
              </SheetDescription>
            </SheetHeader>
            <SheetBody>
              {!failed && (
                <section className="ui-desk-sheet-part" aria-labelledby="design-review">
                  <h3 className="ui-desk-sheet-head" id="design-review">
                    What Fume’s review found
                  </h3>
                  <DesignFindings design={d} tone="glass" />
                </section>
              )}
              {!failed && d.checks.length > 0 && (
                <section className="ui-desk-sheet-part" aria-labelledby="design-checks">
                  <h3 className="ui-desk-sheet-head" id="design-checks">
                    What code measured
                  </h3>
                  {hardFailed > 0 && (
                    <p className="ui-desk-sheet-note">No layout passed every check; this is the closest one.</p>
                  )}
                  <DesignChecks checks={d.checks} tone="glass" compact />
                </section>
              )}
              {d.words && (
                <section className="ui-desk-sheet-part" aria-labelledby="design-words">
                  <h3 className="ui-desk-sheet-head" id="design-words">
                    The words, from the approved plan
                  </h3>
                  <Words words={d.words} tone="glass" />
                </section>
              )}
              <section className="ui-desk-sheet-part" aria-labelledby="design-about">
                <h3 className="ui-desk-sheet-head" id="design-about">
                  About this design
                </h3>
                <dl className="ui-desk-sheet-rows">
                  <div>
                    <dt>The picture under it</dt>
                    <dd>Version {d.fromNumber}</dd>
                  </div>
                  {d.book && (
                    <div>
                      <dt>Design system</dt>
                      <dd>{bookWords(d.book)}</dd>
                    </div>
                  )}
                  {d.layout && (
                    <div>
                      <dt>Where the words sit</dt>
                      <dd>
                        {`${bandWords[d.layout.band]}, ${alignWords[d.layout.align]}, ${groundWords[d.layout.ground]}`}
                      </dd>
                    </div>
                  )}
                  {d.tried !== undefined && (
                    <div>
                      <dt>Layouts code tried</dt>
                      <dd>{d.tried}</dd>
                    </div>
                  )}
                  {d.ask && (
                    <div>
                      <dt>What was asked</dt>
                      <dd>“{d.ask}”</dd>
                    </div>
                  )}
                  {d.llmUsd !== undefined && (
                    <div>
                      <dt>What Fume’s review cost</dt>
                      <dd>${d.llmUsd.toFixed(3)}</dd>
                    </div>
                  )}
                </dl>
              </section>
              {d.document && !failed && (
                <section className="ui-desk-sheet-part" aria-labelledby="design-file">
                  <h3 className="ui-desk-sheet-head" id="design-file">
                    The design file
                  </h3>
                  <p className="ui-design-file-line">
                    {`${d.document.name}: open it in Figma to change it by hand. The words stay text and the picture is a layer of its own.`}
                  </p>
                </section>
              )}
            </SheetBody>
            <SheetFooter>
              {d.document && !failed && (
                <Button variant="glass-clear" icon="download" onClick={download}>
                  Download the design file
                </Button>
              )}
              <Button variant="glass-white" icon="refresh-cw" loading={design.isPending} onClick={again}>
                Design again
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
