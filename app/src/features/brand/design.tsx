// Brand › Design system (/brand/design, FLOWS §30, §34.4): the brand's design system for its campaign creatives, as
// Fume wrote it and code built it. It reads like a component library's docs (Marcus, 9 Nov: "like shadcn, or
// brand.fumecreatives.com", not a Word document): the index on the left, then the examples in use, the foundations
// (colour with the contrast of every pair that carries words, type, layout per format, the logo, words on photographs),
// every component live in the brand's own colours and type with its CSS, the rules, all the CSS, and what Fume still
// needs to know. The look is brand-book.css and design-book.css. Sizes in the book are pixels at a frame 1080 wide, so
// the examples, the type ladder and the components scale them.
// Round 15 (PROPOSED 9 Nov 2026). Marcus, 9 Nov: "What is the difference between Design system and Brand DNA? Logo is
// in both? Are the components hard-coded? Can the Engine add components?"
// - Brand DNA holds the facts and files (the logo file, the colours as found); the design system holds the rules for
//   using them in creatives. The logo is shown once here, as it is used (where it goes on each format), with a link to
//   its file in Brand DNA; the logo component's settings sit with it, not again under Components.
// - Components are the brand's own (blocks.tsx): Fume's people add one from a base, name it, set it in the brand's
//   tokens and take one out, in place, with Undo. The Engine's proposed component lies flat after them, with Add it and
//   Not now, and reaches no creative before it is added and the version is checked.
import {
  Button,
  DataList,
  DataListItem,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Icon,
  Input,
  NativeSelect,
  SegmentedControl,
  SegmentedOption,
  useToast,
} from "@fume/ui";
import { useEffect, useId, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type {
  BookProposal,
  BrandBook,
  DesignBook,
  DesignComponent,
  DesignComponentBase,
  DesignComponentName,
  DesignFormat,
  DesignRole,
  LogoPlace,
} from "../../contract";
import {
  componentBase,
  componentBases,
  componentFor,
  componentProblem,
  componentRole,
  componentRoles,
  componentSlug,
  newComponent,
  paddingSteps,
  radii,
  roleWords,
} from "../../domain/designComponents";
import { glideTo } from "../plan/PlanIndex";
import { AddedTag, BlockTools, openProposals, ProposedBlock } from "./blocks";
import { BookFrame, NoBook, type BookIndexGroup } from "./books";
import { Editable, EditList, useBookEdit } from "./edit";
import { useViewer } from "./parts";
import { BookEnd } from "./voice";

const formatWord: Record<DesignFormat, string> = { feed: "Feed", square: "Square", story: "Story", banner: "Banner" };
const SIZE: Record<DesignFormat, [number, number]> = {
  feed: [1080, 1350],
  square: [1080, 1080],
  story: [1080, 1920],
  banner: [1920, 1080],
};
const roleWord: Record<DesignRole, string> = {
  primary: "Primary",
  secondary: "Secondary",
  accent: "Accent",
  background: "Background",
  surface: "Surface",
  text: "Text",
  text_muted: "Quiet text",
  on_primary: "On primary",
  on_photo: "On a photograph",
  cta: "Call to action",
  cta_text: "Call to action’s words",
  border: "Border",
  support: "Support",
};
/** The nine roles in words. */
const componentWord = roleWords;
const baseWord: Record<DesignComponentBase, string> = {
  text: "Text",
  button: "Button",
  badge: "Badge",
  shape: "Shape",
  image: "Image",
  logo: "Logo",
};
/** What each base is, under the choice when a component is added. */
const baseLine: Record<DesignComponentBase, string> = {
  text: "A line of words in one of the brand’s type styles.",
  button: "A few words on a ground, with corners and padding.",
  badge: "A small mark: a word or a figure on a ground.",
  shape: "A form in one of the brand’s colours.",
  image: "A picture inside the creative.",
  logo: "The wordmark, as a mark of its own.",
};
const placeWord: Record<LogoPlace, string> = {
  top_left: "Top left",
  top_centre: "Top centre",
  top_right: "Top right",
  bottom_left: "Bottom left",
  bottom_centre: "Bottom centre",
  bottom_right: "Bottom right",
};

const isRoleName = (name: string): name is DesignComponentName => componentRoles.includes(name as DesignComponentName);
/** A component's name on the page: the nine by their role's word, the brand's own as it named them. */
const titleOf = (c: DesignComponent) => (isRoleName(c.name) ? componentWord[c.name] : c.name);
/** Its anchor: the nine keep theirs ("design-c-cta"); the brand's own take their name's. */
const anchorOf = (c: DesignComponent) => `design-c-${isRoleName(c.name) ? c.name : componentSlug(c.name)}`;
/** The components under Components: all but the logo, which the foundations' Logo part holds. */
const listed = (book: DesignBook) =>
  book.components.map((c, i) => ({ c, i })).filter(({ c }) => componentRole(c) !== "logo");

/** Brand › Design system. */
export function DesignSystemPage() {
  const viewer = useViewer();
  return (
    <BookFrame
      kind="design"
      description={`The rules for using ${viewer.staff ? `${viewer.brand}’s` : "your"} Brand DNA in creatives. The Engine lays out every creative from it.`}
      empty={<NoBook kind="design" staff={viewer.staff} brand={viewer.brand} />}
      index={designIndex}
    >
      {(body, book) => <DesignBookView book={body} version={book} />}
    </BookFrame>
  );
}

/** A face as CSS: the brand's own, the Google Font close to it, then the kind of face. */
function familyOf(book: DesignBook, role: DesignBook["styles"][number]["font"]): string {
  const t = book.typefaces.find((x) => x.role === role) ?? book.typefaces[0];
  if (!t) return "serif";
  const names = [t.family, t.fallback].filter((x, i, all) => x && all.indexOf(x) === i).map((f) => `"${f}"`);
  const serif = /serif|garamond|cormorant|baskerville|caslon|times|georgia|bodoni|didot|playfair|lora/i.test(
    `${t.family} ${t.fallback}`,
  );
  return `${names.join(", ")}, ${serif && !/sans/i.test(t.family) ? "Georgia, serif" : "system-ui, sans-serif"}`;
}

const caseOf = (c: DesignBook["styles"][number]["case"]) =>
  c === "upper" ? "uppercase" : c === "lower" ? "lowercase" : c === "title" ? "capitalize" : "none";

/** A style as CSS for a frame: its size is a share of the frame's width (container query units), never below `floor`. */
function styleOf(
  book: DesignBook,
  name: DesignBook["styles"][number]["name"],
  width: number,
  floor?: string,
): CSSProperties {
  const s = book.styles.find((x) => x.name === name);
  if (!s) return {};
  const size = `${(s.sizePx / width) * 100}cqw`;
  return {
    fontFamily: familyOf(book, s.font),
    fontSize: floor ? `max(${floor}, ${size})` : size,
    lineHeight: s.lineHeight,
    letterSpacing: `${s.trackingEm}em`,
    fontWeight: s.weight,
    textTransform: caseOf(s.case),
  };
}

/** The brand's faces as Google Fonts, so the examples and the ladder show them; the brand's own files come later. */
function useBrandFonts(book: DesignBook) {
  const families = [...new Set(book.typefaces.map((t) => t.fallback || t.family))]
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500`)
    .join("&");
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

const hexOf = (book: DesignBook, role: DesignRole | null) =>
  role ? book.colours.find((c) => c.role === role)?.hex : undefined;

/** One example of graphic design: the brand's photograph, and the layers on it where the book puts them. */
function Example({
  book,
  example,
  brand: name,
}: {
  book: DesignBook;
  example: DesignBook["examples"][number];
  brand: string;
}) {
  const [w, h] = SIZE[example.format];
  const brand = book.colours.find((c) => c.role === "primary");
  return (
    <figure className="ui-brandbook-example" data-format={example.format} style={{ "--ar": w / h } as CSSProperties}>
      <div
        className="ui-brandbook-frame"
        style={{ aspectRatio: `${w} / ${h}`, background: hexOf(book, "background") }}
        role="img"
        aria-label={`${example.name}: ${example.layers
          .filter((l) => l.text)
          .map((l) => l.text)
          .join(" · ")}`}
      >
        {example.image && <img className="ui-brandbook-frame-photo" src={example.image} alt="" loading="lazy" />}
        {example.layers.map((l, i) => {
          const c = book.components.find((x) => x.name === l.component);
          const bg = hexOf(book, c?.background ?? null);
          const radius = c ? book.radiusPx[c.radius] : 0;
          const box: CSSProperties = {
            left: `${l.x}%`,
            top: `${l.y}%`,
            width: `${l.w}%`,
            minHeight: `${l.h}%`,
            textAlign: l.align === "centre" ? "center" : l.align,
            justifyContent: l.align === "centre" ? "center" : l.align === "right" ? "flex-end" : "flex-start",
            color: hexOf(book, l.colour ?? c?.colour ?? "text"),
          };
          if (l.component === "logo")
            return (
              <span
                key={i}
                className="ui-brandbook-layer"
                data-layer="logo"
                style={{
                  ...box,
                  color: l.colour ? hexOf(book, l.colour) : brand?.hex,
                  fontFamily: familyOf(book, "display"),
                  fontSize: `${(l.h / 100) * (h / w) * 100 * 0.9}cqw`,
                }}
                aria-hidden="true"
              >
                {name}
              </span>
            );
          return (
            <span key={i} className="ui-brandbook-layer" style={box} aria-hidden="true">
              <span
                className="ui-brandbook-layer-text"
                data-boxed={bg ? "" : undefined}
                style={{
                  ...styleOf(book, c?.style ?? "body", w),
                  ...(bg
                    ? {
                        background: bg,
                        borderRadius: Math.min(radius, 999),
                        padding: `${((c?.paddingPx ?? 0) / w) * 60}cqw ${((c?.paddingPx ?? 0) / w) * 100}cqw`,
                      }
                    : {}),
                }}
              >
                {l.text}
              </span>
            </span>
          );
        })}
      </div>
      <figcaption className="ui-brandbook-example-text">
        <span className="ui-brandbook-example-name">{example.name}</span>
        <span className="ui-brandbook-example-meta">
          {formatWord[example.format]} · {example.purpose}
        </span>
        <span className="ui-brandbook-example-why">{example.why}</span>
      </figcaption>
    </figure>
  );
}

/** A group of the book's parts: "Foundations", "Components", with its own line. */
function Group({ id, title, line }: { id: string; title: string; line: string }) {
  return (
    <header className="ui-book-group" id={`design-group-${id}`}>
      <h2 className="ui-book-group-title">{title}</h2>
      <p className="ui-book-group-line">{line}</p>
    </header>
  );
}

/** A part of the design system: its title, its line, then what it holds. */
function Part({ id, title, line, children }: { id: string; title: string; line?: string; children: ReactNode }) {
  return (
    <section className="ui-voice-part" id={`design-${id}`} aria-labelledby={`design-${id}-title`}>
      <div className="ui-voice-part-words">
        <h3 className="ui-voice-part-title" id={`design-${id}-title`}>
          {title}
        </h3>
        {line && <p className="ui-voice-part-line">{line}</p>}
      </div>
      {children}
    </section>
  );
}

/** The design system's index on the left (FLOWS §34.4), as a component library's docs have it. Round 15: the
 *  brand's own components with the rest, and the Engine's proposed ones on a draft. */
export function designIndex(book: DesignBook, version?: BrandBook): BookIndexGroup[] {
  const part = (id: string, label: string, here = true) => (here ? [{ id: `design-${id}`, label }] : []);
  return [
    { title: "Overview", parts: part("examples", "In use", book.examples.length > 0) },
    {
      title: "Foundations",
      parts: [
        ...part("colour", "Colour"),
        ...part("type", "Type"),
        ...part("layout", "Layout"),
        ...part("logo", "Logo"),
        ...part("photo", "Words on photographs", book.photoText.rules.length > 0),
      ],
    },
    {
      title: "Components",
      parts: [
        ...listed(book).map(({ c }) => ({ id: anchorOf(c), label: titleOf(c) })),
        ...openProposals(version, "component").map((p) => ({
          id: `design-p-${p.id}`,
          label: `${p.component!.name} · proposed`,
        })),
      ],
    },
    { title: "Rules and code", parts: [...part("rules", "Do and don’t"), ...part("css", "CSS")] },
    {
      title: "This version",
      parts: [
        ...(book.gaps.length > 0 ? [{ id: "voice-gaps", label: "Still to know" }] : []),
        ...(book.sources.length > 0 ? [{ id: "voice-sources", label: "Where it comes from" }] : []),
      ],
    },
  ].filter((g) => g.parts.length > 0);
}

/** One colour per swatch, with every role it plays. */
function swatches(book: DesignBook) {
  const out: { name: string; hex: string; roles: DesignRole[]; use: string[] }[] = [];
  for (const c of book.colours) {
    const same = out.find((x) => x.hex.toUpperCase() === c.hex.toUpperCase());
    if (same) {
      same.roles.push(c.role);
      same.use.push(c.use);
    } else out.push({ name: c.name, hex: c.hex.toUpperCase(), roles: [c.role], use: [c.use] });
  }
  return out;
}

const pairWords = (pair: string) =>
  pair
    .split(" on ")
    .map((r) => roleWord[r as DesignRole] ?? r)
    .join(" on ");

const kebab = (s: string) => s.replace(/_/g, "-");
const styleWord = (name: string) => (name === "h1" || name === "h2" ? name.toUpperCase() : name);
const cap = (s: string) => `${s.charAt(0).toUpperCase()}${s.slice(1)}`;
/** Pixels at a frame 1080 wide, as a share of the stage's width. */
const cq = (px: number) => `${(px / 1080) * 100}cqw`;

/** A component as CSS on the brand's tokens (the `.brand` variables code builds from the book). */
function componentCss(book: DesignBook, c: DesignComponent): string {
  const s = book.styles.find((x) => x.name === c.style);
  const base = componentBase(c);
  const words = base !== "image" && (base !== "shape" || Boolean(c.sample));
  const lines = [`.brand .${isRoleName(c.name) ? kebab(c.name) : componentSlug(c.name)} {`];
  if (s && words)
    lines.push(
      `  font-family: var(--font-${s.font});`,
      `  font-size: var(--type-${s.name}-size);`,
      `  line-height: var(--type-${s.name}-line);`,
      `  letter-spacing: var(--type-${s.name}-tracking);`,
      `  font-weight: var(--type-${s.name}-weight);`,
    );
  if (s && words && s.case !== "none") lines.push(`  text-transform: ${caseOf(s.case)};`);
  if (words) lines.push(`  color: var(--color-${kebab(c.colour)});`);
  if (c.background) lines.push(`  background: var(--color-${kebab(c.background)});`);
  if (c.background || base === "image" || base === "shape") lines.push(`  border-radius: var(--radius-${c.radius});`);
  if (c.background && base !== "shape" && c.paddingPx)
    lines.push(`  padding: ${c.sizePx ? `${c.paddingPx}px` : `${Math.round(c.paddingPx * 0.6)}px ${c.paddingPx}px`};`);
  if (c.sizePx)
    lines.push(
      `  inline-size: ${c.sizePx}px;`,
      base === "image" ? "  aspect-ratio: 4 / 5;" : `  block-size: ${c.sizePx}px;`,
    );
  if (base === "image") lines.push("  object-fit: cover;");
  if (c.sizePx && words) lines.push("  display: grid;", "  place-items: center;", "  text-align: center;");
  lines.push("}");
  return lines.join("\n");
}

/** The words a component of the nine shows when no example uses it. */
const sampleWord: Record<DesignComponentName, string> = {
  headline: "Kvelden din.",
  subline: "Litt langsommere.",
  body: "Mandelolje og squalan.",
  cta: "Se oljen",
  price: "450 kr",
  badge: "Ny",
  legal: "Night Body Oil · 100 ml",
  product_name: "Night Body Oil",
  logo: "LYSNE",
};

/** Copy some CSS, and say so. */
function CopyCss({ css, label }: { css: string; label: string }) {
  const toast = useToast();
  return (
    <Button
      variant="secondary"
      size="sm"
      icon="copy"
      className="ui-brandbook-code-copy"
      onClick={() =>
        navigator.clipboard?.writeText(css).then(
          () => toast.done(`${label} copied`),
          () => toast.error(`The ${label.toLowerCase()} wasn’t copied`),
        )
      }
    >
      Copy
    </Button>
  );
}

/** A colour as a dot, its role's name and its code. */
function Swatch({ book, role }: { book: DesignBook; role: DesignRole }) {
  const hex = hexOf(book, role)?.toUpperCase();
  return (
    <span className="ui-ds-colour">
      <span className="ui-ds-colour-dot" style={{ background: hex }} aria-hidden="true" />
      {roleWord[role]}
      {hex && <span className="ui-ds-code">{hex}</span>}
    </span>
  );
}

/** The brand's colours, one per role, as a select's options. */
const colourOptions = (book: DesignBook) =>
  book.colours
    .filter((c, i, all) => all.findIndex((x) => x.role === c.role) === i)
    .map((c) => [c.role, `${roleWord[c.role]} · ${c.name}`] as const);

/** What a component is made of: a row of small facts. Where Fume's people write in the book, each setting is a choice
 *  of the brand's own tokens (Round 15): its style, its colours, its corners, its padding and its size. */
function Settings({
  book,
  c,
  i,
  title,
  editing,
}: {
  book: DesignBook;
  c: DesignComponent;
  i: number;
  title: string;
  editing: boolean;
}) {
  const { commit } = useBookEdit();
  const role = componentRole(c);
  const base = componentBase(c);
  const s = book.styles.find((x) => x.name === c.style);
  const face = s ? book.typefaces.find((t) => t.role === s.font) : undefined;
  const words = base !== "image" && (base !== "shape" || Boolean(c.sample));
  const sized = c.sizePx !== undefined || base === "shape" || base === "image";
  const taken = new Set(book.components.filter((_, j) => j !== i).map(componentRole));
  const steps = paddingSteps(book);
  const choose = (key: string, field: string, value: string, options: readonly (readonly [string, string])[]) => (
    <NativeSelect
      size="sm"
      aria-label={`${title}: ${field}`}
      value={value}
      onChange={(e) => commit({ path: `components.${i}.${key}`, to: e.target.value }, `${title}, ${field}`)}
    >
      {options.map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </NativeSelect>
  );
  const colour = (key: "colour" | "background", field: string, value: DesignRole | null, none?: string) => (
    <span className="ui-ds-colour">
      <span
        className="ui-ds-colour-dot"
        data-none={value ? undefined : ""}
        style={{ background: hexOf(book, value) }}
        aria-hidden="true"
      />
      {choose(key, field, value ?? "none", [...(none ? [["none", none] as const] : []), ...colourOptions(book)])}
    </span>
  );
  return (
    <dl className="ui-ds-props" data-editing={editing ? "" : undefined}>
      <div>
        <dt>Built from</dt>
        <dd>{baseWord[base]}</dd>
      </div>
      <div>
        <dt>Placed by</dt>
        <dd>
          {editing && !isRoleName(c.name)
            ? choose("role", "placed by", role ?? "none", [
                ["none", "A designer"],
                ...componentRoles
                  .filter((r) => r === role || !taken.has(r))
                  .map((r) => [r, `The Engine, as the ${componentWord[r].toLowerCase()}`] as const),
              ])
            : role
              ? `The Engine, as the ${componentWord[role].toLowerCase()}`
              : "A designer, where it fits"}
        </dd>
      </div>
      {words && s && (
        <div>
          <dt>Style</dt>
          <dd>
            {editing ? (
              choose(
                "style",
                "style",
                c.style,
                book.styles.map((x) => [x.name, `${styleWord(x.name)} · ${x.sizePx} px`] as const),
              )
            ) : (
              <>
                {styleWord(s.name)} · {face?.family ?? s.font}{" "}
                <span className="ui-ds-code">
                  {s.sizePx} px · {s.weight}
                </span>
                {s.case !== "none" && ` · ${s.case === "upper" ? "capitals" : `${s.case} case`}`}
              </>
            )}
          </dd>
        </div>
      )}
      {words && (
        <div>
          <dt>{base === "logo" ? "Colour" : "Words"}</dt>
          <dd>{editing ? colour("colour", "words", c.colour) : <Swatch book={book} role={c.colour} />}</dd>
        </div>
      )}
      {base !== "logo" && base !== "image" && (
        <div>
          <dt>{base === "shape" ? "Fill" : "Ground"}</dt>
          <dd>
            {editing ? (
              colour("background", "ground", c.background, base === "shape" ? undefined : "None")
            ) : c.background ? (
              <Swatch book={book} role={c.background} />
            ) : (
              "None: the wall or the photograph"
            )}
          </dd>
        </div>
      )}
      {(c.background || base === "image" || base === "shape") && (
        <div>
          <dt>Corners</dt>
          <dd>
            {editing ? (
              choose(
                "radius",
                "corners",
                c.radius,
                radii.map((r) => [r, r === "pill" ? "Pill" : `${cap(r)} · ${book.radiusPx[r]} px`] as const),
              )
            ) : (
              <>
                {c.radius === "pill" ? "Pill" : cap(c.radius)}
                {c.radius !== "pill" && <span className="ui-ds-code"> {book.radiusPx[c.radius]} px</span>}
              </>
            )}
          </dd>
        </div>
      )}
      {c.background && base !== "shape" && (
        <div>
          <dt>Padding</dt>
          <dd>
            {editing ? (
              choose(
                "paddingPx",
                "padding",
                String(c.paddingPx),
                [...new Set([...steps, c.paddingPx])]
                  .sort((a, b) => a - b)
                  .map((px) => [String(px), px ? `${px} px` : "None"] as const),
              )
            ) : (
              <span className="ui-ds-code">{c.paddingPx} px</span>
            )}
          </dd>
        </div>
      )}
      {(sized || (editing && (base === "badge" || base === "button"))) && (
        <div>
          <dt>Size</dt>
          <dd>
            {editing ? (
              choose("sizePx", "size", c.sizePx === undefined ? "none" : String(c.sizePx), [
                ...(sized ? [] : [["none", "Set by its words"] as const]),
                ...[...new Set([80, 120, 160, 200, 240, 320, 480, ...(c.sizePx ? [c.sizePx] : [])])]
                  .sort((a, b) => a - b)
                  .map((px) => [String(px), `${px} px`] as const),
              ])
            ) : c.sizePx ? (
              <span className="ui-ds-code">{c.sizePx} px</span>
            ) : (
              "Set by its words"
            )}
          </dd>
        </div>
      )}
    </dl>
  );
}

/** One component, as a component library shows it: live in the brand's colours and type, on the brand's wall or on one
 *  of its photographs, with its CSS a tab away, what it is made of, and its rules. Round 15: a component of the
 *  brand's own is named and set in place; the Engine's proposed one reads the same, flat, with Add it and Not now. */
function ComponentPart({
  book,
  c,
  i,
  brand,
  version,
  proposal,
}: {
  book: DesignBook;
  c: DesignComponent;
  /** Its place in the book's components; -1 for a proposal. */
  i: number;
  brand: string;
  version?: BrandBook;
  proposal?: BookProposal;
}) {
  const edit = useBookEdit();
  const editing = edit.mode === "direct" && !proposal;
  const [view, setView] = useState<"preview" | "css">("preview");
  const [ground, setGround] = useState<"wall" | "photo">("wall");
  const role = componentRole(c);
  const base = componentBase(c);
  const title = titleOf(c);
  const own = !isRoleName(c.name);
  const path = `components.${i}`;
  const uses = role
    ? book.examples.flatMap((e) => e.layers.filter((l) => l.component === role).map((l) => ({ e, l })))
    : [];
  const onPhoto = uses.find((u) => u.e.image) ?? { e: book.examples.find((e) => e.image), l: undefined };
  const text = base === "logo" ? brand : (c.sample ?? uses[0]?.l.text ?? (role ? sampleWord[role] : title));
  const photo = ground === "photo" ? onPhoto.e?.image : undefined;
  const colour = hexOf(book, (photo && onPhoto.l?.colour) || c.colour);
  const bg = hexOf(book, c.background);
  const css = componentCss(book, c);
  const size = c.sizePx ? cq(c.sizePx) : undefined;
  const round = Boolean(size && c.radius === "pill");
  const corner = round ? "50%" : c.radius === "pill" ? 999 : cq(book.radiusPx[c.radius]);
  const look: CSSProperties =
    base === "image"
      ? { width: size ?? cq(320), borderRadius: corner }
      : base === "shape"
        ? {
            ...(c.sample ? styleOf(book, c.style, 1080, "0.75rem") : {}),
            color: colour,
            width: size ?? cq(120),
            height: size ?? cq(120),
            background: bg ?? colour,
            borderRadius: corner,
          }
        : {
            ...styleOf(book, c.style, 1080, "0.75rem"),
            ...(base === "logo" ? { fontFamily: familyOf(book, "display") } : {}),
            color: colour,
            ...(bg
              ? {
                  background: bg,
                  borderRadius: corner,
                  padding: round ? cq(c.paddingPx) : `${cq(c.paddingPx * 0.6)} ${cq(c.paddingPx)}`,
                }
              : {}),
            ...(size ? { width: size, height: round ? size : undefined } : {}),
          };
  const picture = onPhoto.e?.image ?? book.examples.find((e) => e.image)?.image;
  const titleId = `${proposal ? `design-p-${proposal.id}` : anchorOf(c)}-title`;
  const body = (
    <>
      <div className="ui-voice-part-head">
        <div className="ui-voice-part-words">
          {editing && own ? (
            <Editable
              as="h3"
              path={`${path}.name`}
              value={c.name}
              label="Name of the component"
              className="ui-voice-part-title"
            />
          ) : (
            <h3 className="ui-voice-part-title" id={titleId}>
              {title}
            </h3>
          )}
          {editing ? (
            <Editable
              as="p"
              path={`${path}.purpose`}
              value={c.purpose}
              label={`What ${title} is for`}
              className="ui-voice-part-line"
            />
          ) : (
            <p className="ui-voice-part-line">{c.purpose}</p>
          )}
          {!proposal && <AddedTag mark={edit.marks.find((x) => x.path === path)} />}
        </div>
        {editing && <BlockTools head="components" index={i} count={book.components.length} name={title} move={false} />}
      </div>
      <div className="ui-ds-demo">
        <div className="ui-ds-demo-bar">
          <SegmentedControl
            value={view}
            onValueChange={(v) => v && setView(v as "preview" | "css")}
            aria-label={`${title}: preview or CSS`}
          >
            <SegmentedOption value="preview">Preview</SegmentedOption>
            <SegmentedOption value="css">CSS</SegmentedOption>
          </SegmentedControl>
          {view === "preview" && onPhoto.e?.image && base !== "image" && (
            <SegmentedControl
              value={ground}
              onValueChange={(v) => v && setGround(v as "wall" | "photo")}
              aria-label={`${title}: what it sits on`}
            >
              <SegmentedOption value="wall">On the wall</SegmentedOption>
              <SegmentedOption value="photo">On a photograph</SegmentedOption>
            </SegmentedControl>
          )}
        </div>
        {view === "preview" ? (
          <div
            className="ui-ds-stage"
            data-ground={photo ? "photo" : "wall"}
            style={{ background: photo ? undefined : hexOf(book, "background") }}
            role="img"
            aria-label={
              base === "image"
                ? `${title}: a picture of ${brand}’s, in its corners`
                : base === "shape" && !c.sample
                  ? `${title}: a form in ${brand}’s colour`
                  : `${title} in ${brand}’s colours and type: “${text}”`
            }
          >
            {photo && <img className="ui-ds-stage-photo" src={photo} alt="" loading="lazy" />}
            <span
              className="ui-ds-sample"
              data-base={base}
              data-round={round ? "" : undefined}
              style={look}
              lang="nb"
              aria-hidden="true"
            >
              {base === "image"
                ? picture && <img src={picture} alt="" loading="lazy" />
                : base === "shape" && !c.sample
                  ? null
                  : text}
            </span>
          </div>
        ) : (
          <div className="ui-brandbook-code">
            <CopyCss css={css} label={`${title} CSS`} />
            <pre className="ui-brandbook-code-text" tabIndex={0} aria-label={`${title} as CSS`}>
              {css}
            </pre>
          </div>
        )}
      </div>
      <Settings book={book} c={c} i={i} title={title} editing={editing} />
      {editing && own && c.sample !== undefined && (
        <p className="ui-ds-words">
          <span className="ui-voice-say-label">Words in the preview</span>
          <Editable path={`${path}.sample`} value={c.sample} label={`${title}: words in the preview`} lang="nb" />
        </p>
      )}
      {editing ? (
        <EditList path={`${path}.rules`} items={c.rules} label="Rule" />
      ) : (
        c.rules.length > 0 && (
          <ul className="ui-voice-list">
            {c.rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )
      )}
    </>
  );
  if (proposal && version)
    return (
      <ProposedBlock
        as="section"
        id={`design-p-${proposal.id}`}
        book={version}
        proposal={proposal}
        name={c.name}
        className="ui-voice-part ui-ds-part"
      >
        {body}
      </ProposedBlock>
    );
  return (
    <section
      className="ui-voice-part ui-ds-part"
      id={anchorOf(c)}
      {...(editing && own ? { "aria-label": title } : { "aria-labelledby": titleId })}
    >
      {body}
    </section>
  );
}

/** Add a component of the brand's own (Round 15): what it is built from and its name. It comes in set in the brand's
 *  first fitting tokens, at the end of the components, and the page glides to it. */
function AddComponent({ book, brand }: { book: DesignBook; brand: string }) {
  const { mode, commit } = useBookEdit();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [base, setBase] = useState<DesignComponentBase>("badge");
  const [name, setName] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  // Once it is in the book, the page glides to it.
  useEffect(() => {
    if (!sent || !book.components.some((c) => componentSlug(c.name) === sent)) return;
    const target = `design-c-${sent}`;
    window.requestAnimationFrame(() => glideTo(target, document.getElementById(target)));
    setSent(null);
  }, [book, sent]);
  if (mode !== "direct") return null;
  const problem = name.trim() ? componentProblem(book, newComponent(book, base, name)) : undefined;
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || problem) return;
    const item = newComponent(book, base, name);
    commit({ path: `components.${book.components.length}`, to: null, item }, item.name);
    setSent(componentSlug(item.name));
    setName("");
    setOpen(false);
  }
  if (!open)
    return (
      <div className="ui-block-add-row">
        <Button size="sm" variant="quiet" icon="plus" className="ui-edit-add" onClick={() => setOpen(true)}>
          Add a component
        </Button>
      </div>
    );
  return (
    <form className="ui-ds-add" onSubmit={submit} aria-label="Add a component">
      <p className="ui-voice-sub">A component of {brand}’s own</p>
      <Field>
        <FieldLabel as="span" id={`${id}-base`}>
          Built from
        </FieldLabel>
        <SegmentedControl
          value={base}
          onValueChange={(v) => v && setBase(v as DesignComponentBase)}
          aria-labelledby={`${id}-base`}
          aria-label="Built from"
        >
          {componentBases.map((b) => (
            <SegmentedOption key={b} value={b}>
              {baseWord[b]}
            </SegmentedOption>
          ))}
        </SegmentedControl>
        <FieldDescription>{baseLine[base]} It starts in the brand’s own colours and type.</FieldDescription>
      </Field>
      <Field invalid={Boolean(problem)}>
        <FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
        <Input
          id={`${id}-name`}
          value={name}
          maxLength={40}
          autoFocus
          aria-invalid={problem ? true : undefined}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              setOpen(false);
            }
          }}
        />
        <FieldError>{problem}</FieldError>
      </Field>
      <div className="ui-ds-add-actions">
        <Button type="submit" size="sm" variant="secondary" icon="plus" disabled={!name.trim() || Boolean(problem)}>
          Add the component
        </Button>
        <Button size="sm" variant="quiet" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** Where the logo goes on one format: the format's frame on the brand's wall, the wordmark at its place and width. */
function LogoPlacement({
  book,
  place,
  brand,
}: {
  book: DesignBook;
  place: DesignBook["logo"]["placements"][number];
  brand: string;
}) {
  const [w, h] = SIZE[place.format];
  const f = book.formats.find((x) => x.format === place.format);
  const margin = ((f?.marginPx ?? 64) / w) * 100;
  const top = ((f?.safeTopPx ?? 64) / h) * 100;
  const bottom = ((f?.safeBottomPx ?? 64) / h) * 100;
  // The wordmark is about 0.8 em a letter with its tracking: its size follows from the width the book gives it.
  const font = place.widthPct / (Math.max(brand.length, 3) * 0.8);
  const tall = font * (w / h);
  const x = place.where.endsWith("left")
    ? margin
    : place.where.endsWith("right")
      ? 100 - margin - place.widthPct
      : (100 - place.widthPct) / 2;
  const y = place.where.startsWith("top") ? top : 100 - bottom - tall;
  const logo = componentFor(book, "logo");
  const where = `${placeWord[place.where]} · ${place.widthPct} % of the width`;
  return (
    <figure className="ui-brandbook-example" style={{ "--ar": w / h } as CSSProperties}>
      <div
        className="ui-brandbook-frame"
        style={{ aspectRatio: `${w} / ${h}`, background: hexOf(book, "background") }}
        role="img"
        aria-label={`${formatWord[place.format]}: the logo ${where.toLowerCase()}`}
      >
        <span
          className="ui-brandbook-layer"
          data-layer="logo"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: `${place.widthPct}%`,
            color: hexOf(book, logo?.colour ?? "primary"),
            fontFamily: familyOf(book, "display"),
            fontSize: `${font}cqw`,
          }}
          aria-hidden="true"
        >
          {brand}
        </span>
      </div>
      <figcaption className="ui-brandbook-example-text">
        <span className="ui-brandbook-example-name">{formatWord[place.format]}</span>
        <span className="ui-brandbook-example-meta">{where}</span>
      </figcaption>
    </figure>
  );
}

/** The logo in the design system (Round 15): how a creative uses it, never the file again. The file is in Brand DNA,
 *  one link away; here, where it goes on each format, its versions' use, its space and size, and its rules. */
function LogoUse({ book, brand }: { book: DesignBook; brand: string }) {
  const logo = componentFor(book, "logo");
  return (
    <section className="ui-voice-part" id="design-logo" aria-labelledby="design-logo-title">
      <div className="ui-voice-part-words">
        <h3 className="ui-voice-part-title" id="design-logo-title">
          Logo
        </h3>
        <p className="ui-voice-part-line">
          How a creative uses the logo. The file itself is in{" "}
          <Link to={{ pathname: "/brand", hash: "logo" }} className="ui-link">
            Brand DNA
          </Link>
          .
        </p>
      </div>
      {book.logo.placements.length > 0 && (
        <div className="ui-brandbook-examples ui-ds-logo-uses">
          {book.logo.placements.map((p) => (
            <LogoPlacement key={`${p.format}-${p.where}`} book={book} place={p} brand={brand} />
          ))}
        </div>
      )}
      <DataList variant="stacked" className="ui-voice-facts">
        {book.logo.versions.map((v) => (
          <DataListItem key={v.name} label={v.name}>
            {v.use}
          </DataListItem>
        ))}
        <DataListItem label="Clear space">{book.logo.clearSpace}</DataListItem>
        <DataListItem label="Smallest">{book.logo.minWidthPx} px wide</DataListItem>
        {logo && logo.rules.length > 0 && <DataListItem label="Rules">{logo.rules.join(" ")}</DataListItem>}
      </DataList>
    </section>
  );
}

/** The whole design system, in groups as a component library's docs (FLOWS §34.4). */
export function DesignBookView({ book, version }: { book: DesignBook; version?: BrandBook }) {
  const { brand } = useViewer();
  useBrandFonts(book);
  const sample = book.examples
    .find((e) => e.layers.some((l) => l.component === "headline"))
    ?.layers.find((l) => l.component === "headline")?.text;
  const allCss = [book.css, ...book.components.map((c) => componentCss(book, c))].join("\n\n");
  const proposed = openProposals(version, "component");
  return (
    <div className="ui-voice-book" data-book="">
      <p className="ui-voice-lead ui-brandbook-summary">{book.summary}</p>

      {book.examples.length > 0 && (
        <Part id="examples" title="In use" line={`${brand}’s graphic design on its own photographs.`}>
          <div className="ui-brandbook-examples">
            {book.examples.map((e) => (
              <Example key={e.name} book={book} example={e} brand={brand} />
            ))}
          </div>
        </Part>
      )}

      <Group
        id="foundations"
        title="Foundations"
        line="Brand DNA’s colours, type and logo, and the rules for using them in a creative."
      />
      <Part id="colour" title="Colour" line="Every colour, the roles it plays, and its token.">
        <ul className="ui-brandbook-swatches">
          {swatches(book).map((s) => (
            <li key={s.hex} className="ui-brandbook-swatch">
              <span className="ui-brandbook-swatch-colour" style={{ background: s.hex }} aria-hidden="true" />
              <span className="ui-brandbook-swatch-name">{s.name}</span>
              <span className="ui-brandbook-swatch-code">{s.hex}</span>
              <span className="ui-brandbook-swatch-roles">{s.roles.map((r) => roleWord[r]).join(", ")}</span>
              <span className="ui-brandbook-swatch-code">{s.roles.map((r) => `--color-${kebab(r)}`).join(" ")}</span>
              <span className="ui-brandbook-swatch-use">{s.use[0]}</span>
            </li>
          ))}
        </ul>
        <div className="ui-voice-block">
          <h4 className="ui-voice-sub">Contrast, measured by Fume</h4>
          <ul className="ui-brandbook-contrast" aria-label="Contrast of every pair that carries words">
            {book.checks.contrast.map((p) => {
              const [fg, bg] = p.pair.split(" on ") as [DesignRole, DesignRole];
              return (
                <li key={p.pair} className="ui-brandbook-contrast-pair" data-ok={p.ok ? "" : undefined}>
                  <span
                    className="ui-brandbook-contrast-swatch"
                    style={{ color: hexOf(book, fg), background: hexOf(book, bg) }}
                    aria-hidden="true"
                  >
                    Aa
                  </span>
                  <span className="ui-brandbook-contrast-words">{pairWords(p.pair)}</span>
                  <span className="ui-brandbook-contrast-num">
                    {p.ratio.toFixed(1)}:1
                    <Icon name={p.ok ? "check" : "circle-alert"} />
                    <span className="ui-brandbook-contrast-need">needs {p.need}:1</span>
                  </span>
                </li>
              );
            })}
          </ul>
          {book.checks.fails.length > 0 && (
            <ul className="ui-voice-list ui-brandbook-fails">
              {book.checks.fails.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
        </div>
      </Part>

      <Part id="type" title="Type" line="The faces, and every style in proportion to a frame 1080 pixels wide.">
        <DataList variant="stacked" className="ui-voice-facts">
          {book.typefaces.map((t) => (
            <DataListItem key={t.role} label={cap(t.role)}>
              <span className="ui-brandbook-face" style={{ fontFamily: familyOf(book, t.role) }}>
                {t.family}
              </span>{" "}
              · {t.weights.join(" and ")}
              <span className="ui-brandbook-face-note">
                {t.fallback !== t.family ? `On the web: ${t.fallback}. ` : ""}
                {t.note}
              </span>
            </DataListItem>
          ))}
        </DataList>
        <ul className="ui-brandbook-ladder" aria-label="Type styles">
          {book.styles.map((s) => (
            <li key={s.name} className="ui-brandbook-ladder-row">
              <span className="ui-brandbook-ladder-meta">
                <span className="ui-brandbook-ladder-name">{styleWord(s.name)}</span>
                <span className="ui-brandbook-ladder-spec">
                  {s.sizePx} px · weight {s.weight}
                </span>
                <span className="ui-brandbook-ladder-spec">
                  line {s.lineHeight} · {s.trackingEm} em
                </span>
              </span>
              <span className="ui-brandbook-ladder-sample">
                <span className="ui-brandbook-ladder-text" style={styleOf(book, s.name, 1080, "0.75rem")} lang="nb">
                  {s.name === "cta" ? "Se oljen" : s.name === "price" ? "450 kr" : (sample ?? "Kvelden din.")}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Part>

      <Part id="layout" title="Layout" line="Margins and the space the platforms cover, per format.">
        <ul className="ui-brandbook-formats">
          {book.formats.map((f) => {
            const [w, h] = SIZE[f.format];
            return (
              <li key={f.format} className="ui-brandbook-format" style={{ "--ar": w / h } as CSSProperties}>
                <span
                  className="ui-brandbook-format-frame"
                  style={
                    {
                      aspectRatio: `${w} / ${h}`,
                      "--m-x": `${(f.marginPx / w) * 100}%`,
                      "--m-top": `${(f.safeTopPx / h) * 100}%`,
                      "--m-bottom": `${(f.safeBottomPx / h) * 100}%`,
                    } as CSSProperties
                  }
                  aria-hidden="true"
                >
                  <span className="ui-brandbook-format-safe" />
                </span>
                <span className="ui-brandbook-format-text">
                  <span className="ui-brandbook-format-name">{formatWord[f.format]}</span>
                  <span className="ui-brandbook-format-spec">
                    {w} × {h} · margin {f.marginPx}
                  </span>
                  <span className="ui-brandbook-format-spec">
                    Free top {f.safeTopPx}, bottom {f.safeBottomPx} · {f.columns} columns
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
        <DataList variant="stacked" className="ui-voice-facts">
          <DataListItem label="Spacing">
            {book.spacing.unitPx} px steps: {book.spacing.scale.map((m) => m * book.spacing.unitPx).join(", ")}
          </DataListItem>
          <DataListItem label="Corners">
            None {book.radiusPx.none}, small {book.radiusPx.small}, large {book.radiusPx.large}, pill
          </DataListItem>
        </DataList>
      </Part>

      <LogoUse book={book} brand={brand} />

      {book.photoText.rules.length > 0 && (
        <Part id="photo" title="Words on photographs">
          <ul className="ui-voice-list">
            {book.photoText.rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Part>
      )}

      <Group
        id="components"
        title="Components"
        line={`Each part of a creative, live in ${brand}’s colours and type. Fume writes the ones the Engine places words with; the rest are ${brand}’s own.`}
      />
      {listed(book).map(({ c, i }) => (
        <ComponentPart key={`${i}-${c.name}`} book={book} c={c} i={i} brand={brand} />
      ))}
      {proposed.map((p) => (
        <ComponentPart key={p.id} book={book} c={p.component!} i={-1} brand={brand} version={version} proposal={p} />
      ))}
      <AddComponent book={book} brand={brand} />

      <Group id="rules" title="Rules and code" line="What the Engine keeps to, and the system as CSS." />
      <Part id="rules" title="Do and don’t">
        <div className="ui-voice-cols">
          <div className="ui-voice-block">
            <h4 className="ui-voice-sub">Do</h4>
            <ul className="ui-voice-list">
              {book.rules.do.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
          <div className="ui-voice-block">
            <h4 className="ui-voice-sub">Don’t</h4>
            <ul className="ui-voice-list">
              {book.rules.dont.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      </Part>

      <Part id="css" title="CSS" line="The tokens and every component, built by code from this version.">
        <div className="ui-brandbook-code">
          <CopyCss css={allCss} label="CSS" />
          <pre className="ui-brandbook-code-text" tabIndex={0} aria-label="The design system as CSS">
            {allCss}
          </pre>
        </div>
      </Part>

      <Group id="version" title="This version" line="What Fume still needs to know, and where each part comes from." />
      <BookEnd gaps={book.gaps} sources={book.sources} level={3} />
    </div>
  );
}
