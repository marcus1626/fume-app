// Product fix (FLOWS §17). The Engine masks the product on every render and reads its details against the product's
// detail tokens (real cut-outs of the real product). On the board:
// - DetailsOverlay: the details it masked as subtle outlined regions, when "Product details" is on; a detail that
//   reads wrong always shows, with a small marker ("Reads 200 ml · should be 100 ml"). Tap one: what the Engine
//   read beside the real cut-out, and Fix with the real product. While it fixes, the region shimmers white; the fix
//   comes back as a version of its own and is picked.
// - Brush a fix: draw a rectangle on the creative and say what to change.
// - FixHistory (left panel, product section): every fix, the Engine's automatic ones marked as the Engine's.
// Styles: design-system/components/product-fix.css.
import {
  Button,
  Glass,
  Icon,
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
  TextShimmer,
  useToast,
} from "@fume/ui";
import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type PointerEvent } from "react";
import { useFixProduct } from "../../../api/hooks";
import type { CreativeDocument, DetailFind, DetailToken, ProductFix, RenderVersion } from "../../../contract";
import { when } from "../../../lib/time";

type Region = { x: number; y: number; w: number; h: number };
const box = (r: Region) => ({ "--x": r.x, "--y": r.y, "--w": r.w, "--h": r.h }) as CSSProperties;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** A crop around a region with some air, at a given aspect (display width over height), 0–1 of the image. */
function cropAround(r: Region, imageRatio: number, aspect?: number) {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  let w = r.w * 1.6;
  let h = r.h * 1.6;
  const ar = (w * imageRatio) / h;
  const want = aspect ?? clamp(ar, 1.25, 3);
  if (ar < want) w = (want * h) / imageRatio;
  else h = (w * imageRatio) / want;
  if (w > 1) {
    h = h / w;
    w = 1;
  }
  if (h > 1) {
    w = w / h;
    h = 1;
  }
  return { x: clamp(cx - w / 2, 0, 1 - w), y: clamp(cy - h / 2, 0, 1 - h), w, h, aspect: (w * imageRatio) / h };
}

/** An image shown cropped to a region through CSS custom properties. */
function Crop({ src, crop, alt }: { src: string; crop: ReturnType<typeof cropAround>; alt: string }) {
  return (
    <span
      className="ui-pfix-crop"
      style={{ "--cx": crop.x, "--cy": crop.y, "--cw": crop.w, "--ch": crop.h, "--ar": crop.aspect } as CSSProperties}
    >
      <img src={src} alt={alt} draggable={false} />
    </span>
  );
}

/** A detail token's real cut-out: the product's image cropped to the token's region, with some air. */
export function DetailCutout({ token }: { token: DetailToken }) {
  return <Crop src={token.image} crop={cropAround(token.region, 1, 1.25)} alt={`${token.label} on the real product`} />;
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

// ─── On the board ────────────────────────────────────────────────────────────

export interface DetailsOverlayProps {
  doc: CreativeDocument;
  version: RenderVersion;
  tokens: DetailToken[];
  /** The ratio the version was rendered at (width over height). */
  imageRatio: number;
  show: boolean;
  brushing: boolean;
  onBrushingChange: (on: boolean) => void;
  readOnly: boolean;
}

export function DetailsOverlay({
  doc,
  version,
  tokens,
  imageRatio,
  show,
  brushing,
  onBrushingChange,
  readOnly,
}: DetailsOverlayProps) {
  const fixing = (doc.fixes ?? []).filter((f) => f.state === "fixing");
  const details = (version.details ?? []).filter(
    (d) => (show || !d.ok) && !fixing.some((f) => f.tokenId === d.tokenId),
  );
  const token = (id: string) => tokens.find((t) => t.id === id);
  return (
    <span className="ui-pfix" data-brushing={brushing ? "" : undefined}>
      {details.map((d) => {
        const t = token(d.tokenId);
        return t ? (
          <DetailRegion
            key={d.tokenId}
            doc={doc}
            version={version}
            find={d}
            token={t}
            imageRatio={imageRatio}
            readOnly={readOnly}
          />
        ) : null;
      })}
      {fixing.map((f) => (
        <span key={f.id} className="ui-pfix-region" data-fixing="" style={box(f.region)}>
          <span className="ui-pfix-marker" data-fixing="">
            <TextShimmer>{f.tokenId ? "Fixing with the real product" : "Fixing"}</TextShimmer>
          </span>
        </span>
      ))}
      {show && !brushing && !version.details?.length && (
        <span className="ui-pfix-hint">The Engine masked no product details on this version</span>
      )}
      {brushing && !readOnly && <Brush doc={doc} version={version} onDone={() => onBrushingChange(false)} />}
    </span>
  );
}

function DetailRegion({
  doc,
  version,
  find,
  token,
  imageRatio,
  readOnly,
}: {
  doc: CreativeDocument;
  version: RenderVersion;
  find: DetailFind;
  token: DetailToken;
  imageRatio: number;
  readOnly: boolean;
}) {
  const [open, setOpen] = useState(false);
  const fix = useFixProduct();
  const toast = useToast();
  const marker = !find.ok && (
    <span className="ui-pfix-marker">
      <Icon name="triangle-alert" />
      Reads {find.read}
      {/* side by side the pictures are narrow: compare shows only what it reads */}
      <span className="ui-pfix-should"> · should be {token.value}</span>
    </span>
  );
  const label = `${token.label}: the Engine reads ${find.read}${find.ok ? "" : `, should be ${token.value}`}`;
  if (readOnly)
    return (
      <span
        className="ui-pfix-region"
        data-ok={find.ok ? "" : undefined}
        style={box(find.region)}
        role="img"
        aria-label={label}
      >
        {marker}
      </span>
    );
  const onCreative = cropAround(find.region, imageRatio);
  const real = cropAround(token.region, 1, onCreative.aspect);
  const go = () =>
    fix.mutate(
      { documentId: doc.id, versionId: version.id, tokenId: token.id },
      {
        onSuccess: () => setOpen(false),
        onError: (e) => toast.error("The fix didn’t start", { description: e.message }),
      },
    );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="ui-pfix-region"
          data-ok={find.ok ? "" : undefined}
          style={box(find.region)}
          aria-label={label}
        >
          {marker}
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="ui-pfix-popover" aria-labelledby={`pfix-${token.id}`}>
        <PopoverHeader>
          <PopoverTitle id={`pfix-${token.id}`}>{token.label}</PopoverTitle>
          <PopoverDescription>
            {find.ok
              ? `The Engine reads ${find.read}, as on the real product.`
              : `The Engine reads ${find.read}. The real product says ${token.value}.`}
          </PopoverDescription>
        </PopoverHeader>
        <div className="ui-pfix-compare">
          <figure className="ui-pfix-figure">
            <Crop src={version.image} crop={onCreative} alt={`${token.label} on version ${version.number}`} />
            <figcaption className="ui-pfix-caption">
              <span>On the creative</span>
              <span className="ui-pfix-value">{find.read}</span>
            </figcaption>
          </figure>
          <figure className="ui-pfix-figure">
            <Crop src={token.image} crop={real} alt={`${token.label} on the real product`} />
            <figcaption className="ui-pfix-caption">
              <span>The real product</span>
              <span className="ui-pfix-value">{token.value}</span>
            </figcaption>
          </figure>
        </div>
        <p className="ui-pfix-note">
          The Engine gets the real cut-out, makes only this region again and places it back. It comes back as a new
          version.
        </p>
        <div className="ui-pfix-actions">
          <Button size="sm" variant="glass-white" icon="package" loading={fix.isPending} onClick={go}>
            Fix with the real product
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Draw a rectangle on the creative, then say what to change there. */
function Brush({ doc, version, onDone }: { doc: CreativeDocument; version: RenderVersion; onDone: () => void }) {
  const layer = useRef<HTMLSpanElement>(null);
  const start = useRef<{ x: number; y: number }>();
  const [rect, setRect] = useState<Region>();
  const [drawn, setDrawn] = useState(false);
  const [what, setWhat] = useState("");
  const fix = useFixProduct();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onDone();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onDone]);
  useEffect(() => {
    if (drawn) input.current?.focus();
  }, [drawn]);

  const at = (e: PointerEvent) => {
    const b = layer.current!.getBoundingClientRect();
    return { x: clamp((e.clientX - b.left) / b.width, 0, 1), y: clamp((e.clientY - b.top) / b.height, 0, 1) };
  };
  const down = (e: PointerEvent<HTMLSpanElement>) => {
    if (e.target !== e.currentTarget) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = at(e);
    setDrawn(false);
    setRect({ ...start.current, w: 0, h: 0 });
  };
  const move = (e: PointerEvent<HTMLSpanElement>) => {
    const s = start.current;
    if (!s) return;
    const p = at(e);
    setRect({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
  };
  const up = () => {
    if (!start.current) return;
    start.current = undefined;
    if (rect && rect.w > 0.02 && rect.h > 0.02) setDrawn(true);
    else setRect(undefined);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!rect || !what.trim()) return;
    fix.mutate(
      { documentId: doc.id, versionId: version.id, region: rect, what: what.trim() },
      { onSuccess: onDone, onError: (err) => toast.error("The fix didn’t start", { description: err.message }) },
    );
  };

  const above = rect ? rect.y + rect.h > 0.62 : false;
  return (
    <span
      ref={layer}
      className="ui-pfix-brush"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      {!rect && <span className="ui-pfix-hint">Draw a box around what to fix</span>}
      {rect && <span className="ui-pfix-region" data-brush="" style={box(rect)} />}
      {rect && drawn && (
        <Glass className="ui-pfix-brush-form" data-above={above ? "" : undefined} style={box(rect)}>
          <form className="ui-pfix-brush-row" onSubmit={submit}>
            <label className="ui-sr-only" htmlFor="pfix-what">
              What to change in the box
            </label>
            <input
              ref={input}
              id="pfix-what"
              className="ui-input ui-input--sm ui-pfix-brush-input"
              placeholder="What to change, e.g. the label reads 100 ml"
              value={what}
              autoComplete="off"
              onChange={(e) => setWhat(e.target.value)}
            />
            <Button
              type="button"
              size="sm"
              variant="glass-clear"
              iconOnly
              icon="x"
              aria-label="Cancel the fix"
              onClick={onDone}
            />
            <Button type="submit" size="sm" variant="glass-white" loading={fix.isPending} disabled={!what.trim()}>
              Fix
            </Button>
          </form>
        </Glass>
      )}
    </span>
  );
}

/** Says when a fix this session is watching comes back, and opens nothing: the new version is already picked. */
export function useFixDone(doc: CreativeDocument) {
  const toast = useToast();
  const seen = useRef<Record<string, ProductFix["state"]>>(
    Object.fromEntries((doc.fixes ?? []).map((f) => [f.id, f.state])),
  );
  useEffect(() => {
    for (const f of doc.fixes ?? []) {
      const before = seen.current[f.id];
      seen.current[f.id] = f.state;
      if (before === "fixing" && f.state === "fixed") {
        const v = doc.versions.find((x) => x.id === f.versionId);
        toast.done(v ? `${v.instruction ?? "Fixed"} · version ${v.number}` : "Fixed");
      }
    }
  }, [doc.fixes, doc.versions, toast]);
}

// ─── The history, in the left panel's product section ────────────────────────

export function FixHistory({
  doc,
  tokens,
  name,
}: {
  doc: CreativeDocument;
  tokens: DetailToken[];
  name: (id: string | undefined) => string;
}) {
  const fixes = [...(doc.fixes ?? [])].reverse();
  if (!fixes.length) return null;
  const label = (f: ProductFix) => tokens.find((t) => t.id === f.tokenId)?.label;
  const words = (f: ProductFix) => {
    const what = label(f);
    const who = f.by === "engine" ? "The Engine" : name(f.by);
    if (f.state === "fixing") return what ? `${who} is fixing the ${lower(what)}` : `${who} is fixing a brushed area`;
    if (f.auto) return `The Engine fixed the ${what ? lower(what) : "product"} before Check`;
    return what ? `${who} fixed the ${lower(what)}` : `${who} fixed by hand: ${f.expected}`;
  };
  return (
    <div className="ui-sc">
      <span className="ui-sc-head">
        <span className="ui-sc-label">Product fixes</span>
      </span>
      <ul className="ui-pfix-history">
        {fixes.map((f) => (
          <li key={f.id} className="ui-pfix-fix" data-auto={f.auto ? "" : undefined}>
            <Icon name={f.auto ? "fume-engine" : "pencil"} className="ui-pfix-fix-icon" />
            <span className="ui-pfix-fix-text">
              <span className="ui-pfix-fix-words">{words(f)}</span>
              <span className="ui-pfix-fix-meta">
                {f.tokenId ? `${f.found} → ${f.expected}` : "Brushed"} · {when(f.at)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
