// The Design studio's right panel (round 15, PROPOSED 9 Nov 2026; app/FLOWS-r15-design.md): the properties of what is
// picked, with the names pros know from Figma and OpenPencil, each value from the brand's design system.
// - Words (headline, line): Text (content), Typography (text style, typeface, weight, size, alignment), Fill (the
//   brand's colours only), Position (X, Y, W in pixels of the frame).
// - The logo: its version (Wordmark or reversed), Position with its size. The call to action: the brand's button
//   component and its words, Position. The picture: which version, Fill or Fit. A shade: where it comes from.
// - Nothing picked: the frame. Layout (the template, or what Fume laid out; Align of the words, read from the canvas
//   and moving them when changed) and Words (one colour for every word).
// What a control says is what the canvas shows: Align reads where the words sit, not what was last asked.
// Round 16 (PROPOSED 9 Nov 2026), Marcus's comments on round 15: the controls work as pros know them from Figma and
// OpenPencil. Size has the brand's sizes and the type scale as presets, and minus and plus step between them; the
// text style, typeface and weight lists show each one as it looks; Align is a box of nine places; a colour of her own
// is always there after the brand's; every number has a handle to drag it; the frame has a layout grid with
// templates for its ratio, or values of her own.
import {
  Button,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  Kbd,
  ModeControl,
  ScrubHandle,
  StudioFolds,
  StudioNumber,
  StudioPlace,
  StudioRow,
  StudioSegmented,
  StudioSelect,
  StudioSwatch,
  StudioText,
  StudioToggle,
  useToast,
  type StudioFold,
  type StudioVariable,
} from "@fume/ui";
import { useEffect, useState, type KeyboardEvent } from "react";
import { usePickVersion } from "../../../api/hooks";
import type {
  CreativeDocument,
  DesignBook,
  DesignStyleName,
  Format,
  Layer,
  RenderVersion,
  StudioMode,
  Variables,
} from "../../../contract";
import { bookWords, useDesignAddress } from "./graphic";
import {
  blockPlaceOf,
  ctaOf,
  familyOf,
  FRAME,
  fromPx,
  gridOf,
  gridValue,
  inkOf,
  layerName,
  logoVersions,
  placeBlock,
  placeLayer,
  placeOf,
  roleOf,
  styleNames,
  toPx,
  typeOf,
  wordColours,
  type LayoutGrid,
} from "./layers";

export interface PropertiesProps {
  doc: CreativeDocument;
  mode?: StudioMode;
  variables: Variables;
  format: Format;
  layers: Layer[];
  /** The version Fume designed, when the layers are Fume's. */
  design?: RenderVersion;
  /** The version whose picture is under the layers. */
  picture?: RenderVersion;
  selected?: string;
  book?: DesignBook;
  brandName: string;
  onLayers: (layers: Layer[], key: string) => void;
  onVariables: (patch: Variables, key: string) => void;
  /** The layout grid drawn over the canvas (⇧G), and snapping to it while a layer is dragged. */
  gridShown: boolean;
  onGridShown: (on: boolean) => void;
  snap: boolean;
  onSnap: (on: boolean) => void;
}

const weightNames: Record<number, string> = {
  300: "Light",
  400: "Regular",
  500: "Medium",
  600: "Semibold",
  700: "Bold",
};
/** The classic type scale (as print designers set it, doubled past 72 for a frame 1080 wide): the natural steps. */
const TYPE_SCALE = [12, 14, 16, 18, 21, 24, 30, 36, 48, 60, 72, 96, 120, 144, 192, 240];

export function PropertiesPanel(props: PropertiesProps) {
  const { layers, selected, brandName, book } = props;
  const designAt = useDesignAddress();
  const layer = layers.find((l) => l.id === selected);
  const sections = layer ? layerSections(props, layer) : frameSections(props, designAt.open);
  const title = layer ? `${layerName(layer)}${layer.visible ? "" : " · hidden"}` : "Frame";
  return (
    <aside className="ui-desk-panel ui-desk-vars ui-desk-props" aria-label="Properties">
      <h2 className="ui-desk-panel-title">{title}</h2>
      {!book && <p className="ui-sc-help ui-desk-props-note">{brandName} has no design system yet.</p>}
      <StudioFolds key={layer?.id ?? "frame"} label="Properties" sections={sections} />
    </aside>
  );
}

// ─── A layer ─────────────────────────────────────────────────────────────────

function layerSections(p: PropertiesProps, l: Layer): StudioFold[] {
  const role = roleOf(l);
  const set = (change: Partial<Layer>, key: string) =>
    p.onLayers(
      p.layers.map((x) => (x.id === l.id ? { ...x, ...change } : x)),
      `layer-${l.id}-${key}`,
    );
  const book = p.book;
  const sections: StudioFold[] = [];
  if (role === "picture") {
    sections.push({ id: "picture", title: "Picture", children: <PictureFields {...p} layer={l} set={set} /> });
    return sections;
  }
  if (role === "shade") {
    sections.push({
      id: "shade",
      title: "Shade",
      children: (
        <>
          <StudioRow label="From" readout={l.shade?.from === "bottom" ? "The foot" : "The top"} />
          <StudioRow
            label="Strength"
            readout={`${Math.round((l.shade?.opacity ?? 0.3) * 100)} %`}
            help="The design system’s soft shade behind words on a busy picture."
          />
        </>
      ),
    });
    return sections;
  }
  if (role === "logo") {
    const versions = book ? logoVersions(book) : [];
    const first = versions[0]?.name ?? "Wordmark";
    const value = l.variant ?? first;
    const rule = book?.photoText.rules.find((r) => /wordmark|logo/i.test(r));
    sections.push({
      id: "logo",
      title: "Logo",
      children: versions.length ? (
        <StudioSegmented
          label="Version"
          id="layer-logo-version"
          value={value}
          options={versions.map((v, i) => ({
            value: v.name,
            label: i > 0 && v.name.startsWith(`${first}, `) ? capital(v.name.slice(first.length + 2)) : v.name,
          }))}
          help={[versions.find((v) => v.name === value)?.use, rule].filter(Boolean).join(" ")}
          onChange={(variant) => set({ variant }, "variant")}
        />
      ) : (
        <p className="ui-sc-help">The design system has no logo versions yet.</p>
      ),
    });
  }
  if (role === "cta") {
    const c = book ? ctaOf(book) : undefined;
    const colour = (hex?: string) => book?.colours.find((x) => x.hex === hex)?.name;
    sections.push({
      id: "component",
      title: "Component",
      children: (
        <>
          <StudioRow
            label="Component"
            readout={`${p.brandName}’s call to action`}
            help={
              c?.component
                ? `${[colour(c.fill) && `${colour(c.fill)} pill`, colour(c.ink) && `${colour(c.ink)} words`]
                    .filter(Boolean)
                    .join(", ")}. ${c.component.rules.join(" ")}`
                : undefined
            }
          />
          <TextField {...p} layer={l} set={set} rows={1} />
        </>
      ),
    });
  }
  if (role === "headline" || role === "subline" || role === "text") {
    sections.push({ id: "text", title: "Text", children: <TextField {...p} layer={l} set={set} rows={2} /> });
    if (book) {
      sections.push({
        id: "type",
        title: "Typography",
        children: <TypeFields book={book} layer={l} brandName={p.brandName} set={set} />,
      });
      const colours = wordColours(book);
      sections.push({
        id: "fill",
        title: "Fill",
        children: (
          <StudioSwatch
            label="Colour"
            id="layer-colour"
            custom
            value={inkOf(l, book, p.variables) ?? ""}
            options={[]}
            presets={colours.map((c) => ({ name: c.name, hex: c.hex, brand: p.brandName }))}
            help={offBrand(inkOf(l, book, p.variables), colours, p.brandName)}
            onChange={(colour) => set({ colour }, "colour")}
          />
        ),
      });
    }
  }
  sections.push({
    id: "position",
    title: "Position",
    children: <PositionFields {...p} layer={l} set={set} />,
  });
  return sections;
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A colour of her own is hers to choose; the help says it is not the brand's, and the design check counts it. */
function offBrand(hex: string | undefined, colours: { hex: string }[], brandName: string) {
  if (!hex || colours.some((c) => c.hex.toLowerCase() === hex.toLowerCase())) return undefined;
  return `Not one of ${brandName}’s colours. Yours to choose; the design check counts it under Design system.`;
}

/** The words of a layer. On Fume's design they are the approved plan's; a change says what the plan says. */
function TextField({
  layer,
  design,
  set,
  rows,
}: PropertiesProps & { layer: Layer; set: (c: Partial<Layer>, key: string) => void; rows: 1 | 2 }) {
  const words = design?.design?.words;
  const role = roleOf(layer);
  const plan =
    role === "headline"
      ? words?.headline
      : role === "subline"
        ? words?.subline
        : role === "cta"
          ? words?.cta
          : undefined;
  return (
    <StudioText
      label="Content"
      id="layer-text"
      rows={rows}
      value={layer.text ?? ""}
      help={
        plan ? (plan === layer.text ? "The approved plan’s words." : `The approved plan says “${plan}”`) : undefined
      }
      onChange={(text) => set({ text }, "text")}
    />
  );
}

/** The design system's text style, then what is set over it: typeface, weight, size and alignment. Each list shows
 *  its choices as they look (round 16): a text style in its face and weight, a typeface in itself, a weight in it. */
function TypeFields({
  book,
  layer,
  brandName,
  set,
}: {
  book: DesignBook;
  layer: Layer;
  brandName: string;
  set: (c: Partial<Layer>, key: string) => void;
}) {
  const t = typeOf(layer, book);
  const weights = t.typeface.weights.length ? t.typeface.weights : [t.weight];
  const scale = [...book.styles].sort((a, b) => b.sizePx - a.sizePx);
  return (
    <>
      <StudioSelect
        label="Text style"
        id="layer-style"
        value={t.style}
        options={book.styles.map((s) => {
          const face = book.typefaces.find((f) => f.role === s.font) ?? t.typeface;
          return {
            value: s.name,
            label: styleNames[s.name],
            meta: String(s.sizePx),
            preview: {
              fontFamily: familyOf(face),
              fontWeight: s.weight,
              textTransform: s.case === "upper" ? "uppercase" : "none",
              letterSpacing: `${s.trackingEm}em`,
              "--preview-size": `${Math.round(Math.min(26, Math.max(13, s.sizePx / 3.2)))}px`,
            },
          };
        })}
        onChange={(s) =>
          set(
            {
              textStyle: s as DesignStyleName,
              font: undefined,
              weight: undefined,
              sizePx: undefined,
              style: undefined,
            },
            "textStyle",
          )
        }
      />
      <StudioSelect
        label="Typeface"
        id="layer-font"
        value={t.typeface.role}
        options={book.typefaces.map((f) => ({
          value: f.role,
          label: f.family,
          meta: capital(f.role),
          preview: { fontFamily: familyOf(f), "--preview-size": "18px" },
        }))}
        onChange={(role) => {
          const face = book.typefaces.find((f) => f.role === role);
          set(
            {
              font: role as Layer["font"],
              ...(face && !face.weights.includes(t.weight) ? { weight: face.weights[0] } : {}),
            },
            "font",
          );
        }}
      />
      <StudioSelect
        label="Weight"
        id="layer-weight"
        value={String(t.weight)}
        options={weights.map((w) => ({
          value: String(w),
          label: weightNames[w] ?? String(w),
          meta: String(w),
          preview: { fontFamily: t.family, fontWeight: w, "--preview-size": "18px" },
        }))}
        onChange={(w) => set({ weight: Number(w) }, "weight")}
      />
      <StudioNumber
        label="Size"
        id="layer-size"
        unit="px"
        min={12}
        max={240}
        value={t.sizePx}
        presets={[
          {
            label: `${brandName}’s sizes`,
            items: scale
              .filter((s, i) => scale.findIndex((x) => x.sizePx === s.sizePx) === i)
              .map((s) => ({ value: s.sizePx, meta: styleNames[s.name] })),
          },
          { label: "Type scale", items: TYPE_SCALE.map((value) => ({ value })) },
        ]}
        help={
          t.sizePx === styleOfSize(book, t.style)
            ? undefined
            : `Set by hand; ${styleNames[t.style]} is ${styleOfSize(book, t.style)} px.`
        }
        onChange={(sizePx) => set({ sizePx }, "size")}
      />
      <StudioSegmented
        label="Text align"
        id="layer-align"
        value={layer.align ?? "left"}
        options={[
          { value: "left", label: "Left", icon: "text-align-start" },
          { value: "centre", label: "Centre", icon: "text-align-center" },
          { value: "right", label: "Right", icon: "text-align-end" },
        ]}
        onChange={(align) => set({ align: align as Layer["align"] }, "align")}
      />
    </>
  );
}

const styleOfSize = (book: DesignBook, style: DesignStyleName) => book.styles.find((s) => s.name === style)?.sizePx;

/** Where the layer sits (a box of nine places in the safe area), then X, Y and the width in pixels of the frame
 *  (1080 wide), as in Figma. Each number's letter is a handle to drag it. */
function PositionFields({
  layer,
  layers,
  format,
  book,
  onLayers,
  set,
}: PropertiesProps & { layer: Layer; set: (c: Partial<Layer>, key: string) => void }) {
  const [W, H] = FRAME[format];
  const role = roleOf(layer);
  const min = role === "logo" ? (book?.logo.minWidthPx ?? 80) : 40;
  const words = ["headline", "subline", "text"].includes(role);
  return (
    <>
      <StudioPlace
        label="Align"
        id="layer-place"
        value={placeOf(layer, book, format)}
        help={`In the frame, inside ${book ? "the design system’s" : "the"} safe area.${
          words ? " Words take the side’s alignment." : ""
        }`}
        onChange={(place) => onLayers(placeLayer(layers, layer.id, place, book, format), `layer-${layer.id}-place`)}
      />
      <StudioRow
        label="Position"
        labelId="layer-position-l"
        readout={`px of ${W} × ${H}`}
        help={
          role === "logo" && book
            ? `At least ${book.logo.minWidthPx} px wide. Clear space: ${book.logo.clearSpace.charAt(0).toLowerCase()}${book.logo.clearSpace.slice(1)}`
            : "Drag a letter, or the layer on the canvas."
        }
      >
        <div className="ui-desk-px-row" role="group" aria-labelledby="layer-position-l">
          <PxField
            short="X"
            name="X, from the left edge"
            value={toPx(layer.x, W)}
            max={W}
            onChange={(x) => set({ x: fromPx(x, W) }, "x")}
          />
          <PxField
            short="Y"
            name="Y, from the top edge"
            value={toPx(layer.y, H)}
            max={H}
            onChange={(y) => set({ y: fromPx(y, H) }, "y")}
          />
          {role !== "cta" && (
            <PxField
              short="W"
              name={role === "logo" ? "Width of the logo" : "Width"}
              value={toPx(layer.w, W)}
              min={min}
              max={W}
              onChange={(w) =>
                set({ w: fromPx(w, W), ...(role === "logo" ? { h: (fromPx(w, W) * W * 0.24) / H } : {}) }, "w")
              }
            />
          )}
        </div>
      </StudioRow>
    </>
  );
}

/** One number: typed, nudged with the arrow keys (Shift for ten), or dragged by its letter. */
function PxField({
  short,
  name,
  value,
  min = 0,
  max,
  onChange,
}: {
  short: string;
  name: string;
  value: number;
  min?: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)));
  const keys = (e: KeyboardEvent<HTMLInputElement>) => {
    const step = e.key === "ArrowUp" ? 1 : e.key === "ArrowDown" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    onChange(clamp(value + step * (e.shiftKey ? 10 : 1)));
  };
  return (
    <InputGroup size="sm" className="ui-desk-px">
      <InputGroupAddon>
        <ScrubHandle value={value} min={min} max={max} onChange={(n) => onChange(clamp(n))}>
          {short}
        </ScrubHandle>
      </InputGroupAddon>
      <InputGroupInput
        inputMode="numeric"
        aria-label={name}
        value={draft}
        onKeyDown={keys}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value.trim() !== "" && Number.isFinite(n) && n >= min && n <= max) onChange(Math.round(n));
        }}
        onBlur={() => setDraft(String(value))}
      />
    </InputGroup>
  );
}

/** Which version the picture is, and whether it fills the frame or fits inside it. */
function PictureFields({
  doc,
  design,
  picture,
  layer,
  set,
}: PropertiesProps & { layer: Layer; set: (c: Partial<Layer>, key: string) => void }) {
  const pick = usePickVersion();
  const toast = useToast();
  const pictures = doc.versions.filter((v) => !v.design && v.state === "done");
  return (
    <>
      <StudioSelect
        label="Version"
        id="layer-picture-version"
        value={picture?.id ?? ""}
        disabled={Boolean(design) || pick.isPending}
        options={pictures.map((v) => ({ value: v.id, label: `V${v.number}` }))}
        help={
          design
            ? `Fume laid the words on V${picture?.number}. For another picture, design again from it in Image.`
            : "The picked version. Another one is picked for the whole creative."
        }
        onChange={(id) =>
          id !== picture?.id &&
          pick.mutate(
            { documentId: doc.id, versionId: id },
            { onError: (e) => toast.error("The version wasn’t picked", { description: e.message }) },
          )
        }
      />
      <StudioSegmented
        label="Fit"
        id="layer-fit"
        value={layer.fit ?? "fill"}
        options={[
          { value: "fill", label: "Fill" },
          { value: "fit", label: "Fit" },
        ]}
        help={
          (layer.fit ?? "fill") === "fill"
            ? "Fills the frame; what is outside it is cropped."
            : "The whole picture, inside the frame."
        }
        onChange={(fit) => set({ fit: fit as Layer["fit"] }, "fit")}
      />
    </>
  );
}

// ─── The frame ───────────────────────────────────────────────────────────────

function frameSections(p: PropertiesProps, openDesign: (versionId: string) => void): StudioFold[] {
  const { book, layers, format, design } = p;
  const place = blockPlaceOf(layers, book, format);
  const hasWords = layers.some((l) => l.visible && ["headline", "subline", "text"].includes(roleOf(l)));
  const template = p.mode?.variables.find((v) => v.key === "template");
  const words = layers.filter((l) => ["headline", "subline", "text"].includes(roleOf(l)));
  const inks = [...new Set(words.map((l) => (book ? inkOf(l, book, p.variables) : l.colour)).filter(Boolean))];
  const sections: StudioFold[] = [
    {
      id: "layout",
      title: "Layout",
      children: (
        <>
          {design?.design && design.state === "rendering" ? (
            <StudioRow
              label="Laid out by"
              readout={`Fume · V${design.number}`}
              help={`Fume is laying the plan’s words on V${design.design.fromNumber}. Its layers and checks come with it.`}
            />
          ) : design?.design ? (
            <StudioRow
              label="Laid out by"
              readout={`Fume · V${design.number}`}
              help={`Fume laid the plan’s words on V${design.design.fromNumber} in the design system${
                design.design.book ? ` (${bookWords(design.design.book).toLowerCase()})` : ""
              }. Every layer is yours to change.`}
            >
              <Button
                size="sm"
                variant="secondary"
                icon="file-text"
                className="ui-desk-props-action"
                onClick={() => openDesign(design.id)}
              >
                Its checks
              </Button>
            </StudioRow>
          ) : (
            template && (
              <ModeControl
                variable={template as StudioVariable}
                value={p.variables.template}
                onChange={(v) => p.onVariables({ template: v as string }, "var-template")}
              />
            )
          )}
          <StudioPlace
            label="Align"
            id="frame-align"
            value={place}
            disabled={!hasWords}
            help={
              hasWords
                ? "Where the headline and its line sit, inside the safe area. They keep clear of a shown logo and call to action, take the side’s alignment, and the shade follows them."
                : "No words are showing."
            }
            onChange={(to) => to !== place && p.onLayers(placeBlock(layers, to, book, format), "frame-align")}
          />
        </>
      ),
    },
  ];
  if (book && words.length)
    sections.push({
      id: "words",
      title: "Words",
      children: (
        <StudioSwatch
          label="Colour"
          id="frame-colour"
          value={inks.length === 1 ? inks[0]! : ""}
          options={[]}
          presets={wordColours(book).map((c) => ({ name: c.name, hex: c.hex, brand: p.brandName }))}
          help={
            inks.length > 1
              ? "Mixed: the words have colours of their own. A colour here sets them all; the call to action keeps its own."
              : "Sets every word layer at once; the call to action keeps its own."
          }
          onChange={(colour) =>
            p.onLayers(
              layers.map((l) => (words.includes(l) ? { ...l, colour } : l)),
              "frame-colour",
            )
          }
        />
      ),
    });
  sections.push({ id: "grid", title: "Layout grid", children: <GridFields {...p} /> });
  return sections;
}

/** The frame's layout grid (round 16): shown or not (⇧G), a template for the format's ratio (the brand's own grid
 *  first) or values of her own, and whether a dragged layer snaps to it. */
function GridFields(p: PropertiesProps) {
  const { book, format, brandName, variables } = p;
  const g = gridOf(variables, book, format, brandName);
  const setGrid = (patch: Partial<LayoutGrid>) =>
    p.onVariables({ grid: "custom", gridCustom: gridValue({ ...g.grid, ...patch }) }, "grid-custom");
  const [W] = FRAME[format];
  return (
    <>
      <StudioToggle
        label="Show the grid"
        id="frame-grid-shown"
        value={p.gridShown}
        help={undefined}
        onChange={p.onGridShown}
      />
      <p className="ui-sc-help ui-desk-grid-key">
        <Kbd>⇧G</Kbd> shows and hides it anywhere in Design.
      </p>
      <StudioSelect
        label="Template"
        id="frame-grid"
        value={g.id}
        options={[
          ...g.templates.map((t) => ({ value: t.id, label: t.name, meta: t.meta })),
          ...(g.id === "custom" ? [{ value: "custom", label: "Custom", meta: gridValue(g.grid) }] : []),
        ]}
        onChange={(id) => {
          p.onVariables({ grid: id }, "grid-template");
          if (!p.gridShown) p.onGridShown(true);
        }}
      />
      <StudioRow
        label="Values"
        labelId="frame-grid-values-l"
        readout={g.id === "custom" ? "Custom" : "From the template"}
        help="Change one and the grid is your own."
      >
        <div className="ui-desk-px-row ui-desk-grid-values" role="group" aria-labelledby="frame-grid-values-l">
          <PxField
            short="Columns"
            name="Columns"
            value={g.grid.columns}
            min={0}
            max={24}
            onChange={(columns) => setGrid({ columns })}
          />
          <PxField
            short="Rows"
            name="Rows"
            value={g.grid.rows}
            min={0}
            max={24}
            onChange={(rows) => setGrid({ rows })}
          />
          <PxField
            short="Gutter"
            name="Gutter in px"
            value={g.grid.gutterPx}
            min={0}
            max={200}
            onChange={(gutterPx) => setGrid({ gutterPx })}
          />
          <PxField
            short="Margin"
            name="Margin in px"
            value={g.grid.marginPx}
            min={0}
            max={Math.round(W / 3)}
            onChange={(marginPx) => setGrid({ marginPx })}
          />
        </div>
      </StudioRow>
      <StudioToggle
        label="Snap to the grid"
        id="frame-grid-snap"
        value={p.snap}
        help="A dragged layer snaps to the columns, the safe area and the middle. Hold ⌘ to place it freely."
        onChange={p.onSnap}
      />
    </>
  );
}
