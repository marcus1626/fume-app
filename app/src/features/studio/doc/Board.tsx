// The middle of the desk (FLOWS §9.1): the board with the picked version large (fit or 100 %, side by side with the
// version before it), the layers of a Design creative on top, the Engine bar under it, and the versions strip. The
// Engine never talks in its bar: it shows what it changed ("The Engine changed Hair length 40 → 65").
// - The creative takes the board. The view tools sit on a glass rail at the board's left edge (icons, their names in
//   tooltips), the Engine bar is docked in its own row under the board, and nothing floats over the picture; the rail
//   also hides both panels (⌘\). The version is named once, in the strip.
// - The Engine bar's change card lists each part of the instruction: what it changed, and for a part it did not read,
//   why and the change it would make if asked (Yes). Enter on the card keeps and renders; Esc undoes.
// - A version whose product details read wrong is never "Clean": the strip says "1 flag · size reads 200 ml"; the
//   Engine bar's two buttons say what they do (Send, Render).
// - Compare on the rail starts with the picked version and the one before; while it is on, a tap on a version in the
//   strip adds it to the board or takes it off (up to four side by side). "Compare with the real product" puts the
//   product's own photo (its packshot) beside the creative.
import {
  Button,
  Glass,
  Icon,
  Input,
  Skeleton,
  TextShimmer,
  Toggle,
  WithTooltip,
  studioValueWords,
  useToast,
  type StudioVariable,
} from "@fume/ui";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useSearchParams } from "react-router-dom";
import {
  useAddVersion,
  useDecideEdit,
  useDetailTokens,
  useEngineEdit,
  usePlacements,
  useRender,
  usePickVersion,
} from "../../../api/hooks";
import type {
  CreativeDocument,
  DetailToken,
  EngineEdit,
  Layer,
  RenderVersion,
  StudioMode,
  VarValue,
} from "../../../contract";
import * as copy from "../../../copy";
import { when } from "../../../lib/time";
import { frameRoot } from "../../../shell/scope";
import { DetailsOverlay, useFixDone } from "./fix";
import { placementOf, SafeZones, versionRatio } from "./formats";
import { AddGraphicDesign, designFlags, designLine, DrawnWords, useDesignAddress, useSeesDesign } from "./graphic";
import { CanvasLayers } from "./Layers";
import { failedWords, usePromptAddress, useSeesPrompt } from "./prompt";
import { scoreLine } from "./scores";
import { isUnderBar } from "../../../domain/scores";
import { shownVersion, tabShown, tabVersions } from "./versions";

const ratio = { feed: "4 / 5", square: "1 / 1", story: "9 / 16" } as const;

/** A document's one name: a creative by copy.creativeName ("Master 3 · Feed 4:5"); a model or a reference by its own
 *  name. */
export function documentName(doc: CreativeDocument, mode?: StudioMode, productName?: string) {
  // The title first, as Check names the same creative: one name in the Studio, Check and the toast.
  const own = doc.title || doc.slot || "";
  // A video is named by the format it is cut for: "Night ritual · Reels 9:16" (FLOWS §27).
  const cut = doc.studio === "video" ? doc.video?.formats.find((f) => f.id === doc.video?.formatId) : undefined;
  if (cut) return `${own.split(" · ")[0] || "Film"} · ${cut.name.split(" ")[0]} ${cut.ratio}`;
  return mode && mode.output !== "creative"
    ? own
    : copy.creativeName({ title: own, format: doc.specs.format, productName });
}

/** "Clean", or what the Engine's evaluation and its product read flagged ("1 flag · size reads 200 ml"). */
export function flagWords(v: RenderVersion, tokens: DetailToken[] = []): { clean: boolean; words: string } {
  const e = v.evaluation;
  const flags = [
    e.productTruth === "flag" && "product truth flagged",
    e.brandRules === "flag" && "brand rules flagged",
    e.artefacts !== "none" && `${e.artefacts === "major" ? "major" : "minor"} artefacts`,
    ...e.notes.map((n) => n.charAt(0).toLowerCase() + n.slice(1)),
    ...(v.details ?? [])
      .filter((d) => !d.ok)
      .map((d) => {
        const t = tokens.find((x) => x.id === d.tokenId);
        return t ? `${t.label.toLowerCase()} reads ${d.read}` : `reads ${d.read}`;
      }),
  ].filter(Boolean) as string[];
  if (!flags.length) return { clean: true, words: "Clean" };
  const n = flags.length - e.notes.length || flags.length;
  return { clean: false, words: `${copy.count(n, "flag")} · ${flags.join(" · ")}` };
}

export { shownVersion };

// ─── The board ───────────────────────────────────────────────────────────────

export function Board({
  doc,
  mode,
  layers,
  brandName,
  selectedLayer,
  onSelectLayer,
  readOnly,
  onBeforeRender,
  onVariable,
  bare,
  onToggleBare,
  compare,
  onCompare,
  realProduct,
  lock,
}: {
  doc: CreativeDocument;
  mode?: StudioMode;
  layers: Layer[];
  brandName: string;
  selectedLayer?: string;
  onSelectLayer: (id: string | undefined) => void;
  readOnly: boolean;
  onBeforeRender: () => void;
  /** A change the Engine only suggested, taken with Yes (an undo step of the desk). */
  onVariable: (key: string, value: VarValue) => void;
  /** Both panels hidden (⌘\). */
  bare: boolean;
  onToggleBare: () => void;
  /** The versions on the board side by side (empty: not comparing); the strip adds and removes them. */
  compare: string[];
  onCompare: (ids: string[]) => void;
  /** The product's own photo, to compare the creative with. */
  realProduct?: { name: string; image: string };
  /** While the Engine works on the creative, this takes the Engine bar's place (Wait · Take over). */
  lock?: ReactNode;
}) {
  const [zoom, setZoom] = useState<"fit" | "full">("fit");
  const [real, setReal] = useState(false);
  const shown = tabShown(doc);
  const rendering = tabVersions(doc).find((v) => v.state === "rendering");
  const before = shown
    ? [...doc.versions].reverse().find((v) => v.number < shown.number && v.state === "done")
    : undefined;
  const compared =
    compare.length && !readOnly ? doc.versions.filter((v) => compare.includes(v.id) && v.state === "done") : [];
  const withReal = real && Boolean(realProduct) && !readOnly;
  const comparing = compared.length + (withReal ? 1 : 0) > 1 || (withReal && !compared.length);
  const figures = comparing ? (compared.length ? compared : shown ? [shown] : []).length + (withReal ? 1 : 0) : 1;
  const isDesign = doc.studio === "design";
  const format = mode?.output === "creative" ? doc.specs.format : "square";
  // Design (round 15): the picture is a layer too; the frame is the format's, the picture fills it or fits in it.
  const pictureLayer = isDesign ? layers.find((l) => l.kind === "image") : undefined;
  // Formats (FLOWS §15) and product fix (FLOWS §17): safe zones of the chosen placement, the product's details.
  const [search] = useSearchParams();
  const [safe, setSafe] = useState(false);
  const [details, setDetails] = useState(search.get("details") === "1");
  const [brushing, setBrushing] = useState(false);
  const placements = usePlacements().data ?? [];
  const placement = mode?.output === "creative" ? placementOf(doc.specs, placements) : undefined;
  const tokens = useDetailTokens(doc.specs.productId).data ?? [];
  const hasProduct = Boolean(doc.specs.productId) && mode?.output === "creative";
  // A new creative starts with no product; it renders once one is picked
  // (Free renders without one: it may be a mood picture)
  const needsProduct =
    Boolean(mode?.uses.includes("product")) && doc.studio === "render" && mode?.id !== "m-free" && !doc.specs.productId;
  useFixDone(doc);
  // The prompt behind the shown version, for Fume's own people (FLOWS §29)
  const seesPrompt = useSeesPrompt();
  const promptAt = usePromptAddress();
  // The graphic design Fume laid on the shown version, for Fume's own people (FLOWS §33)
  const seesDesign = useSeesDesign();
  const designAt = useDesignAddress();
  const promptFor = promptAt.id && doc.versions.some((v) => v.id === promptAt.id) ? promptAt.id : undefined;
  // No picture to show, only a version that did not render: say so on the board (FLOWS §29)
  const failed = shown ? undefined : [...doc.versions].reverse().find((v) => v.state === "failed");
  // A picture under the bar is shown whole, with the warning above it (FLOWS §34.1)
  const warn = !comparing && !rendering && isUnderBar(shown) ? shown : undefined;

  const figure = (v: RenderVersion, label: string | undefined, withLayers: boolean) => (
    <figure className="ui-desk-figure" key={v.id}>
      <span
        className="ui-desk-shot"
        data-fit={withLayers && isDesign ? (pictureLayer?.fit ?? "fill") : undefined}
        data-picture-hidden={withLayers && pictureLayer && !pictureLayer.visible ? "" : undefined}
        style={{ "--ratio": ratio[format] } as CSSProperties}
      >
        <img src={v.image} alt={`${doc.title}, version ${v.number}`} draggable={false} />
        {v.drawn && !(withLayers && isDesign) && <DrawnWords drawing={v.drawn} />}
        {withLayers && safe && placement && !readOnly && (
          <SafeZones placement={placement} sourceRatio={versionRatio(v, placements)} />
        )}
        {withLayers && hasProduct && v.state === "done" && (
          <DetailsOverlay
            doc={doc}
            version={v}
            tokens={tokens}
            imageRatio={versionRatio(v, placements)}
            show={details}
            brushing={brushing && !comparing}
            onBrushingChange={setBrushing}
            readOnly={readOnly}
          />
        )}
        {withLayers && isDesign && (
          <CanvasLayers
            layers={layers}
            variables={doc.variables}
            format={format}
            brandName={brandName}
            selected={selectedLayer}
            onSelect={onSelectLayer}
            readOnly={readOnly}
          />
        )}
      </span>
      {label && <figcaption className="ui-desk-caption">{label}</figcaption>}
    </figure>
  );

  return (
    <>
      <section
        className="ui-desk-canvas"
        data-zoom={zoom}
        data-compare={comparing ? "" : undefined}
        data-warn={warn ? "" : undefined}
        style={comparing ? ({ "--compare-n": figures } as CSSProperties) : undefined}
        aria-label="Board"
      >
        {warn && (
          <Glass className="ui-score-warn ui-desk-score-warn" role="status">
            <Icon name="triangle-alert" />
            <span className="ui-score-warn-title">{`Version ${warn.number} is under ${brandName}’s bar`}</span>
            <span className="ui-score-warn-nums">{scoreLine(warn)}</span>
          </Glass>
        )}
        {!readOnly && (
          <Glass className="ui-desk-rail" role="toolbar" aria-orientation="vertical" aria-label="View">
            <RailToggle
              label={zoom === "full" ? "Fit to the board" : "Actual size, 100 %"}
              icon={zoom === "full" ? "minimize-2" : "zoom-in"}
              pressed={zoom === "full"}
              onPressedChange={(on) => setZoom(on ? "full" : "fit")}
            />
            <RailToggle
              label="Compare versions: tap them in the strip"
              icon="columns-2"
              pressed={compare.length > 0}
              disabled={!before}
              onPressedChange={(on) => onCompare(on && shown && before ? [before.id, shown.id] : [])}
            />
            {realProduct && hasProduct && (
              <RailToggle label="Compare with the real product" icon="image" pressed={real} onPressedChange={setReal} />
            )}
            {placement && (
              <RailToggle
                label={`Safe zones · ${placement.name}`}
                icon="crop"
                pressed={safe}
                onPressedChange={setSafe}
              />
            )}
            {hasProduct && (
              <>
                <RailToggle
                  label="Product details the Engine masked"
                  icon="package"
                  pressed={details}
                  onPressedChange={setDetails}
                />
                <RailToggle
                  label="Brush a fix: draw a box on the creative"
                  icon="pencil"
                  pressed={brushing}
                  disabled={!shown || Boolean(rendering)}
                  onPressedChange={setBrushing}
                />
              </>
            )}
            {seesPrompt && doc.versions.some((v) => v.prompt) && (
              <RailToggle
                label="The Engine’s prompt and checks"
                icon="file-text"
                pressed={Boolean(shown && promptFor === shown.id)}
                disabled={!shown?.prompt}
                onPressedChange={(on) => (on && shown ? promptAt.open(shown.id) : promptAt.close())}
              />
            )}
            {seesDesign && shown?.design && (
              <RailToggle
                label="The graphic design and its checks"
                icon="type"
                pressed={designAt.id === shown.id}
                onPressedChange={(on) => (on ? designAt.open(shown.id) : designAt.close())}
              />
            )}
            <span className="ui-desk-rail-gap" aria-hidden="true" />
            <RailToggle
              label={bare ? "Show the panels" : "Hide the panels"}
              shortcut="⌘\"
              icon={bare ? "minimize-2" : "maximize-2"}
              pressed={bare}
              onPressedChange={onToggleBare}
            />
          </Glass>
        )}

        <div
          className="ui-desk-stage"
          // A click beside the layers (the board, or the picture, which is locked) lets go of the picked one.
          onClick={(e) => !(e.target as HTMLElement).closest("button, a, input") && onSelectLayer(undefined)}
        >
          {rendering?.design && !comparing ? (
            <figure className="ui-desk-figure" aria-busy="true">
              <span className="ui-desk-shot" data-designing="" style={{ "--ratio": ratio[format] } as CSSProperties}>
                <img
                  src={rendering.image}
                  alt={`${doc.title}, version ${rendering.design.fromNumber}`}
                  draggable={false}
                />
              </span>
              <figcaption className="ui-desk-caption">
                <TextShimmer>{`Fume is designing version ${rendering.number} on V${rendering.design.fromNumber}`}</TextShimmer>
              </figcaption>
            </figure>
          ) : rendering && !comparing ? (
            <figure className="ui-desk-figure" aria-busy="true">
              <span className="ui-desk-shot" style={{ "--ratio": ratio[format] } as CSSProperties}>
                <Skeleton shape="creative" ratio={ratio[format]} className="ui-desk-skeleton" />
              </span>
              <figcaption className="ui-desk-caption">
                <TextShimmer>The Engine is rendering version {rendering.number}</TextShimmer>
              </figcaption>
            </figure>
          ) : comparing ? (
            <>
              {(compared.length ? compared : shown ? [shown] : []).map((v) =>
                figure(v, `Version ${v.number}${v.id === shown?.id ? ", picked" : ""}`, v.id === shown?.id),
              )}
              {withReal && realProduct && (
                <figure className="ui-desk-figure" key="real">
                  <span className="ui-desk-shot">
                    <img
                      src={realProduct.image}
                      alt={`${realProduct.name}, the product's own photo`}
                      draggable={false}
                    />
                  </span>
                  <figcaption className="ui-desk-caption">The real product</figcaption>
                </figure>
              )}
            </>
          ) : shown ? (
            figure(shown, undefined, true)
          ) : failed ? (
            <div className="ui-desk-empty">
              <p className="ui-desk-empty-text">
                Version {failed.number} didn’t render, so there is no picture yet. Its tile in the strip says why.
              </p>
              <Button size="sm" variant="secondary" onClick={() => promptAt.open(failed.id)}>
                See why
              </Button>
            </div>
          ) : (
            <p className="ui-desk-empty">
              {needsProduct
                ? "Pick a product, set the variables, then render."
                : "Nothing rendered yet. Set the variables, then render."}
            </p>
          )}
        </div>
      </section>

      {!readOnly &&
        (lock ?? (
          <EngineBar
            doc={doc}
            mode={mode}
            busy={Boolean(rendering)}
            needsProduct={needsProduct}
            onBeforeRender={onBeforeRender}
            onVariable={onVariable}
          />
        ))}
    </>
  );
}

/** One tool on the rail: an icon, its name in a tooltip on the board's side. */
function RailToggle({
  label,
  icon,
  shortcut,
  ...props
}: {
  label: string;
  icon:
    | "zoom-in"
    | "minimize-2"
    | "maximize-2"
    | "columns-2"
    | "crop"
    | "package"
    | "pencil"
    | "image"
    | "file-text"
    | "type";
  shortcut?: string;
  pressed: boolean;
  disabled?: boolean;
  onPressedChange: (on: boolean) => void;
}) {
  return (
    <WithTooltip label={label} shortcut={shortcut} side="right">
      <Toggle size="sm" iconOnly icon={icon} className="ui-desk-rail-tool" aria-label={label} {...props} />
    </WithTooltip>
  );
}

// ─── The Engine bar ──────────────────────────────────────────────────────────

const changeWords = (c: { key: string; label: string; from: VarValue; to: VarValue }, mode?: StudioMode) => {
  const v = mode?.variables.find((x) => x.key === c.key) as StudioVariable | undefined;
  return `${c.label} ${studioValueWords(v, c.from as never)} → ${studioValueWords(v, c.to as never)}`;
};

/** An example for the Engine bar that fits the mode. */
const example = (doc: CreativeDocument, mode?: StudioMode) =>
  doc.studio === "design"
    ? "Hide the logo"
    : mode?.output === "model"
      ? "Make her hair longer"
      : mode?.output === "reference"
        ? "Make it in oak"
        : "Make the light warmer";

function EngineBar({
  doc,
  mode,
  busy,
  needsProduct,
  onBeforeRender,
  onVariable,
}: {
  doc: CreativeDocument;
  mode?: StudioMode;
  busy: boolean;
  needsProduct?: boolean;
  onBeforeRender: () => void;
  onVariable: (key: string, value: VarValue) => void;
}) {
  const [text, setText] = useState("");
  const engineEdit = useEngineEdit();
  const render = useRender();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const proposed = [...doc.edits].reverse().find((e) => e.state === "proposed");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const words = text.trim();
    if (!words) return;
    onBeforeRender();
    engineEdit.mutate(
      { documentId: doc.id, text: words },
      {
        onSuccess: () => setText(""),
        onError: (err) => toast.error("The Engine didn’t take that", { description: err.message }),
      },
    );
  };

  return (
    <div className="ui-desk-engine" data-proposed={proposed ? "" : undefined}>
      {proposed && (
        <ChangeCard
          key={proposed.id}
          doc={doc}
          edit={proposed}
          mode={mode}
          busy={busy}
          onBeforeRender={onBeforeRender}
          onVariable={onVariable}
          onDone={() => input.current?.focus()}
        />
      )}
      <form className="ui-desk-engine-form" onSubmit={submit}>
        <Icon name="fume-engine" className="ui-desk-engine-mark" />
        <label className="ui-sr-only" htmlFor="engine-bar">
          Tell the Engine what to change
        </label>
        <input
          ref={input}
          id="engine-bar"
          className="ui-input ui-input--sm ui-desk-engine-input"
          placeholder={`Tell the Engine what to change, e.g. ${example(doc, mode)}`}
          value={text}
          autoComplete="off"
          onChange={(e) => setText(e.target.value)}
        />
        <Button
          type="submit"
          size="sm"
          variant="secondary"
          icon="arrow-up"
          loading={engineEdit.isPending}
          disabled={!text.trim()}
        >
          Send
        </Button>
        <WithTooltip
          label={needsProduct ? "Pick a product first" : "Render a new version from the variables as they are"}
        >
          <Button
            size="sm"
            variant="secondary"
            icon="refresh-cw"
            loading={render.isPending}
            disabled={busy || needsProduct}
            onClick={() => {
              onBeforeRender();
              render.mutate(doc.id, {
                onError: (err) => toast.error("The render didn’t start", { description: err.message }),
              });
            }}
          >
            Render
          </Button>
        </WithTooltip>
      </form>
    </div>
  );
}

/** The Engine's change, shown before it renders (FLOWS §9.1), part by part. */
function ChangeCard({
  doc,
  edit,
  mode,
  busy,
  onBeforeRender,
  onVariable,
  onDone,
}: {
  doc: CreativeDocument;
  edit: EngineEdit;
  mode?: StudioMode;
  busy: boolean;
  onBeforeRender: () => void;
  onVariable: (key: string, value: VarValue) => void;
  onDone: () => void;
}) {
  const decide = useDecideEdit();
  const keep = useRef<HTMLButtonElement>(null);
  // The suggestions she took with Yes, by variable: undone with the card.
  const [taken, setTaken] = useState<Record<string, VarValue>>({});
  const parts = edit.parts?.length ? edit.parts : [{ text: edit.text, keys: edit.changes.map((c) => c.key) }];
  const canKeep = edit.changes.length > 0 || Object.keys(taken).length > 0;
  const many = parts.length > 1 || parts.some((p) => !p.keys.length);
  const byKey = (key: string) => edit.changes.find((c) => c.key === key);

  // The card takes the keyboard when it comes: Enter keeps and renders, Esc undoes.
  useEffect(() => {
    if (canKeep) keep.current?.focus({ preventScroll: true });
  }, [canKeep]);

  const undo = () => {
    for (const [key, from] of Object.entries(taken)) onVariable(key, from);
    decide.mutate({ documentId: doc.id, editId: edit.id, verdict: "undo" }, { onSuccess: onDone });
  };
  const keepIt = () => {
    onBeforeRender();
    decide.mutate({ documentId: doc.id, editId: edit.id, verdict: "keep" }, { onSuccess: onDone });
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    undo();
  };

  return (
    <div className="ui-desk-engine-change" aria-live="polite" onKeyDown={onKey}>
      <div className="ui-desk-engine-words">
        {!many ? (
          <p className="ui-desk-engine-line">
            {edit.changes.length ? (
              <>
                The Engine changed{" "}
                <span className="ui-desk-engine-what">{edit.changes.map((c) => changeWords(c, mode)).join(" · ")}</span>
              </>
            ) : (
              "The Engine found nothing to change for that"
            )}
          </p>
        ) : (
          <ul className="ui-desk-engine-parts" aria-label="What the Engine read">
            {parts.map((p, i) => {
              const s = p.suggestion;
              const took = s && s.key in taken;
              return (
                <li key={i} className="ui-desk-engine-part" data-read={p.keys.length || took ? "" : undefined}>
                  <Icon name={p.keys.length || took ? "circle-check" : "minus"} className="ui-desk-engine-part-icon" />
                  <span className="ui-desk-engine-part-text">
                    <span className="ui-desk-engine-said">“{p.text}”</span>
                    {p.keys.length > 0 && (
                      <span className="ui-desk-engine-what">
                        {p.keys
                          .map((k) => byKey(k))
                          .filter(Boolean)
                          .map((c) => changeWords(c!, mode))
                          .join(" · ")}
                      </span>
                    )}
                    {!p.keys.length && p.note && <span className="ui-desk-engine-note">{p.note}.</span>}
                    {!p.keys.length && s && (
                      <span className="ui-desk-engine-what">
                        {took ? changeWords(s, mode) : `${changeWords(s, mode)}?`}
                      </span>
                    )}
                  </span>
                  {!p.keys.length && s && !took && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setTaken((t) => ({ ...t, [s.key]: s.from }));
                        onVariable(s.key, s.to);
                      }}
                    >
                      Yes
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="ui-desk-engine-actions">
        <WithTooltip label="Undo the change" shortcut="Esc">
          <Button size="sm" variant="quiet" icon="undo-2" disabled={decide.isPending} onClick={undo}>
            Undo
          </Button>
        </WithTooltip>
        {canKeep && (
          <WithTooltip label="Keep it and render a new version" shortcut="↵">
            <Button
              ref={keep}
              size="sm"
              variant="secondary"
              icon="refresh-cw"
              loading={decide.isPending}
              disabled={busy}
              onClick={keepIt}
            >
              Keep and render
            </Button>
          </WithTooltip>
        )}
      </div>
    </div>
  );
}

// ─── The versions strip ──────────────────────────────────────────────────────

/** Up to four versions side by side on the board. */
const COMPARE_MAX = 4;

export function Versions({
  doc,
  readOnly,
  compare = [],
  onCompare,
  onDesign,
}: {
  doc: CreativeDocument;
  readOnly: boolean;
  compare?: string[];
  onCompare?: (ids: string[]) => void;
  /** Fume started a graphic design: the Studio goes to Design, where it lands (FLOWS §34.5). */
  onDesign?: () => void;
}) {
  const pick = usePickVersion();
  const tokens = useDetailTokens(doc.specs.productId).data ?? [];
  const promptAt = usePromptAddress();
  const designAt = useDesignAddress();
  const strip = useRef<HTMLOListElement>(null);
  const versions = tabVersions(doc);
  const shownId = tabShown(doc)?.id;
  const count = versions.length;
  // Newest right: keep the newest in view when one arrives.
  useEffect(() => {
    const el = strip.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [count]);

  if (!count)
    return (
      <>
        <p className="ui-desk-versions ui-desk-versions--empty">
          No versions yet. Each render becomes a version here; nothing is ever overwritten.
        </p>
        {!readOnly && <AddPicture doc={doc} onDesign={onDesign} />}
      </>
    );
  // While comparing, a tap adds a version to the board or takes it off; otherwise it picks.
  const comparing = compare.length > 0 && Boolean(onCompare);
  const toggle = (id: string) =>
    onCompare?.(compare.includes(id) ? compare.filter((x) => x !== id) : [...compare, id].slice(-COMPARE_MAX));
  return (
    <>
      <ol
        ref={strip}
        className="ui-desk-versions"
        aria-label={comparing ? "Versions: tap to compare" : "Versions"}
        data-comparing={comparing ? "" : undefined}
      >
        {versions.map((v) => {
          const failed = v.state === "failed";
          // A version that did not render is never the picked one, even if the address says so; in Image, the
          // picture under a picked design stands for it
          const picked = (v.id === doc.pickedVersionId || v.id === shownId) && !failed;
          const designed = v.design;
          const under = !designed && isUnderBar(v);
          const flags = failed
            ? { clean: false, words: designed ? "Not designed" : failedWords(v) }
            : under
              ? { clean: false, words: `Under the bar · ${scoreLine(v)}` }
              : designFlags(v, flagWords(v, tokens));
          const busy = v.state === "rendering";
          const body = (
            <>
              <span
                className="ui-desk-version-thumb"
                data-none={failed ? "" : undefined}
                data-designing={busy && designed ? "" : undefined}
              >
                {busy && designed ? (
                  <img src={v.image} alt="" />
                ) : busy ? (
                  <Skeleton shape="thumb" size="100%" />
                ) : failed ? (
                  <Icon name="image" />
                ) : (
                  <img src={v.image} alt="" />
                )}
              </span>
              <span className="ui-desk-version-text">
                <span className="ui-desk-version-head">
                  <span className="ui-desk-version-num">V{v.number}</span>
                  {picked && (
                    <span className="ui-desk-version-picked">
                      <Icon name="bookmark" /> Picked
                    </span>
                  )}
                  <span className="ui-desk-version-when">{when(v.at)}</span>
                </span>
                <span className="ui-desk-version-line">
                  {busy && designed ? (
                    <TextShimmer>Fume is designing</TextShimmer>
                  ) : busy ? (
                    <TextShimmer>Rendering</TextShimmer>
                  ) : designed ? (
                    designLine(designed)
                  ) : v.instruction ? (
                    `“${v.instruction}”`
                  ) : failed ? (
                    "From the variables"
                  ) : (
                    "Rendered from the variables"
                  )}
                </span>
                {v.state !== "rendering" && (
                  <span
                    className="ui-desk-version-flags"
                    data-clean={flags.clean ? "" : undefined}
                    data-failed={failed || under ? "" : undefined}
                  >
                    <Icon name={failed ? "circle-x" : flags.clean ? "circle-check" : "triangle-alert"} />
                    {flags.words}
                  </span>
                )}
              </span>
            </>
          );
          return (
            <li key={v.id}>
              {readOnly ? (
                <div className="ui-desk-version" aria-current={picked ? "true" : undefined}>
                  {body}
                </div>
              ) : (
                <button
                  type="button"
                  className="ui-desk-version"
                  aria-current={picked ? "true" : undefined}
                  aria-pressed={comparing ? compare.includes(v.id) : undefined}
                  aria-label={`Version ${v.number}${picked ? ", picked" : ""}. ${designed ? `${designLine(designed)}.` : (v.instruction ?? "")} ${flags.words}${failed ? ". Open to see why" : ""}`}
                  aria-haspopup={failed ? "dialog" : undefined}
                  title={
                    failed
                      ? v.failure
                      : comparing
                        ? compare.includes(v.id)
                          ? "On the board: tap to take it off"
                          : "Tap to compare it"
                        : flags.clean
                          ? undefined
                          : flags.words
                  }
                  disabled={v.state === "rendering" || (failed ? comparing : pick.isPending)}
                  onClick={() =>
                    failed
                      ? designed
                        ? designAt.open(v.id)
                        : promptAt.open(v.id)
                      : comparing
                        ? toggle(v.id)
                        : !picked && pick.mutate({ documentId: doc.id, versionId: v.id })
                  }
                >
                  {body}
                </button>
              )}
            </li>
          );
        })}
      </ol>
      {!readOnly && <AddPicture doc={doc} onDesign={onDesign} />}
    </>
  );
}

/** A picture made by hand (outside the Engine) becomes the newest version, picked, with how it was made. */
function AddPicture({ doc, onDesign }: { doc: CreativeDocument; onDesign?: () => void }) {
  const add = useAddVersion();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!file || !note.trim()) return;
    add.mutate(
      { documentId: doc.id, file, note: note.trim() },
      {
        onSuccess: () => {
          setFile(null);
          setNote("");
          toast.done("The picture is the newest version", { description: "Picked to go to check." });
        },
        onError: (err) => toast.error("The picture wasn’t added", { description: err.message }),
      },
    );
  };
  return (
    <form className="ui-desk-row-actions" onSubmit={submit}>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      {file ? (
        <>
          <Input
            size="sm"
            aria-label={`How was ${file.name} made?`}
            placeholder={`How was ${file.name} made?`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            autoFocus
          />
          <Button size="sm" type="submit" icon="check" loading={add.isPending} disabled={!note.trim()}>
            Add
          </Button>
          <Button size="sm" variant="quiet" onClick={() => setFile(null)}>
            Cancel
          </Button>
        </>
      ) : (
        <>
          <Button size="sm" variant="quiet" icon="image-plus" onClick={() => input.current?.click()}>
            Add a picture made by hand
          </Button>
          <AddGraphicDesign doc={doc} base={`${frameRoot.fume}/b/${doc.workspaceId}`} onStarted={onDesign} />
        </>
      )}
    </form>
  );
}
