// Brand › Design system (/brand/design, FLOWS §30, §34.4): the brand's design system for its campaign creatives, as
// Fume wrote it and code built it. It reads like a component library's docs (Marcus, 9 Nov: "like shadcn, or
// brand.fumecreatives.com", not a Word document): the index on the left, then the examples in use, the foundations
// (colour with the contrast of every pair that carries words, type, layout per format, the logo, words on photographs),
// every component live in the brand's own colours and type with its CSS, the rules, all the CSS, and what Fume still
// needs to know. The look is brand-book.css and design-book.css. Sizes in the book are pixels at a frame 1080 wide, so
// the examples, the type ladder and the components scale them.
import { Button, DataList, DataListItem, Icon, SegmentedControl, SegmentedOption, useToast } from "@fume/ui";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { DesignBook, DesignFormat, DesignRole } from "../../contract";
import { BookFrame, NoBook, type BookIndexGroup } from "./books";
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
const componentWord: Record<DesignBook["components"][number]["name"], string> = {
  headline: "Headline",
  subline: "Subline",
  body: "Body",
  cta: "Call to action",
  price: "Price",
  badge: "Badge",
  legal: "Small print",
  product_name: "Product name",
  logo: "Logo",
};

/** Brand › Design system. */
export function DesignSystemPage() {
  const viewer = useViewer();
  return (
    <BookFrame
      kind="design"
      description={`How ${viewer.staff ? `${viewer.brand}’s` : "your"} creatives are laid out: the Engine designs every one from it.`}
      empty={<NoBook kind="design" staff={viewer.staff} brand={viewer.brand} />}
      index={designIndex}
    >
      {(body) => <DesignBookView book={body} />}
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

/** The design system's index on the left (FLOWS §34.4), as a component library's docs have it. */
export function designIndex(book: DesignBook): BookIndexGroup[] {
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
      parts: book.components.map((c) => ({ id: `design-c-${c.name}`, label: componentWord[c.name] })),
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
type Component = DesignBook["components"][number];

/** A component as CSS on the brand's tokens (the `.brand` variables code builds from the book). */
function componentCss(book: DesignBook, c: Component): string {
  const s = book.styles.find((x) => x.name === c.style);
  const lines = [`.brand .${kebab(c.name)} {`];
  if (s)
    lines.push(
      `  font-family: var(--font-${s.font});`,
      `  font-size: var(--type-${s.name}-size);`,
      `  line-height: var(--type-${s.name}-line);`,
      `  letter-spacing: var(--type-${s.name}-tracking);`,
      `  font-weight: var(--type-${s.name}-weight);`,
    );
  if (s && s.case !== "none") lines.push(`  text-transform: ${caseOf(s.case)};`);
  lines.push(`  color: var(--color-${kebab(c.colour)});`);
  if (c.background)
    lines.push(
      `  background: var(--color-${kebab(c.background)});`,
      `  border-radius: var(--radius-${c.radius});`,
      `  padding: ${Math.round(c.paddingPx * 0.6)}px ${c.paddingPx}px;`,
    );
  lines.push("}");
  return lines.join("\n");
}

/** The words a component shows when no example uses it. */
const sampleWord: Record<Component["name"], string> = {
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

/** One component, as a component library shows it: live in the brand's colours and type, on the brand's wall or on one
 *  of its photographs, with its CSS a tab away, what it is made of, and its rules. */
function ComponentPart({ book, c, brand }: { book: DesignBook; c: Component; brand: string }) {
  const [view, setView] = useState<"preview" | "css">("preview");
  const [ground, setGround] = useState<"wall" | "photo">("wall");
  const uses = book.examples.flatMap((e) => e.layers.filter((l) => l.component === c.name).map((l) => ({ e, l })));
  const onPhoto = uses.find((u) => u.e.image) ?? { e: book.examples.find((e) => e.image), l: undefined };
  const text = c.name === "logo" ? brand : (uses[0]?.l.text ?? sampleWord[c.name]);
  const s = book.styles.find((x) => x.name === c.style);
  const face = s ? book.typefaces.find((t) => t.role === s.font) : undefined;
  const photo = ground === "photo" ? onPhoto.e?.image : undefined;
  const colour = hexOf(book, (photo && onPhoto.l?.colour) || c.colour);
  const bg = hexOf(book, c.background);
  const css = componentCss(book, c);
  const radius = book.radiusPx[c.radius];
  const look: CSSProperties = {
    ...styleOf(book, c.style, 1080, "0.75rem"),
    ...(c.name === "logo"
      ? { fontFamily: familyOf(book, "display"), color: hexOf(book, "primary") }
      : { color: colour }),
    ...(bg
      ? {
          background: bg,
          borderRadius: c.radius === "pill" ? 999 : `${(radius / 1080) * 100}cqw`,
          padding: `${((c.paddingPx * 0.6) / 1080) * 100}cqw ${(c.paddingPx / 1080) * 100}cqw`,
        }
      : {}),
  };
  return (
    <section
      className="ui-voice-part ui-ds-part"
      id={`design-c-${c.name}`}
      aria-labelledby={`design-c-${c.name}-title`}
    >
      <div className="ui-voice-part-words">
        <h3 className="ui-voice-part-title" id={`design-c-${c.name}-title`}>
          {componentWord[c.name]}
        </h3>
        <p className="ui-voice-part-line">{c.purpose}</p>
      </div>
      <div className="ui-ds-demo">
        <div className="ui-ds-demo-bar">
          <SegmentedControl
            value={view}
            onValueChange={(v) => v && setView(v as "preview" | "css")}
            aria-label={`${componentWord[c.name]}: preview or CSS`}
          >
            <SegmentedOption value="preview">Preview</SegmentedOption>
            <SegmentedOption value="css">CSS</SegmentedOption>
          </SegmentedControl>
          {view === "preview" && onPhoto.e?.image && (
            <SegmentedControl
              value={ground}
              onValueChange={(v) => v && setGround(v as "wall" | "photo")}
              aria-label={`${componentWord[c.name]}: what it sits on`}
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
            aria-label={`${componentWord[c.name]} in ${brand}’s colours and type: “${text}”`}
          >
            {photo && <img className="ui-ds-stage-photo" src={photo} alt="" loading="lazy" />}
            <span className="ui-ds-sample" style={look} lang="nb" aria-hidden="true">
              {text}
            </span>
          </div>
        ) : (
          <div className="ui-brandbook-code">
            <CopyCss css={css} label={`${componentWord[c.name]} CSS`} />
            <pre className="ui-brandbook-code-text" tabIndex={0} aria-label={`${componentWord[c.name]} as CSS`}>
              {css}
            </pre>
          </div>
        )}
      </div>
      <dl className="ui-ds-props">
        {s && (
          <div>
            <dt>Style</dt>
            <dd>
              {s.name === "h1" || s.name === "h2" ? s.name.toUpperCase() : s.name} · {face?.family ?? s.font}{" "}
              <span className="ui-ds-code">
                {s.sizePx} px · {s.weight}
              </span>
              {s.case !== "none" && ` · ${s.case === "upper" ? "capitals" : `${s.case} case`}`}
            </dd>
          </div>
        )}
        {c.name !== "logo" && (
          <div>
            <dt>Words</dt>
            <dd>
              <Swatch book={book} role={c.colour} />
            </dd>
          </div>
        )}
        <div>
          <dt>Ground</dt>
          <dd>{c.background ? <Swatch book={book} role={c.background} /> : "None: the wall or the photograph"}</dd>
        </div>
        {c.background && (
          <div>
            <dt>Corners</dt>
            <dd>
              {c.radius === "pill" ? "Pill" : `${c.radius.charAt(0).toUpperCase()}${c.radius.slice(1)}`}
              {c.radius !== "pill" && <span className="ui-ds-code"> {radius} px</span>}
              {" · padding "}
              <span className="ui-ds-code">{c.paddingPx} px</span>
            </dd>
          </div>
        )}
      </dl>
      {c.rules.length > 0 && (
        <ul className="ui-voice-list">
          {c.rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The whole design system, in groups as a component library's docs (FLOWS §34.4). */
export function DesignBookView({ book }: { book: DesignBook }) {
  const { brand } = useViewer();
  useBrandFonts(book);
  const sample = book.examples
    .find((e) => e.layers.some((l) => l.component === "headline"))
    ?.layers.find((l) => l.component === "headline")?.text;
  const allCss = [book.css, ...book.components.map((c) => componentCss(book, c))].join("\n\n");
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
        line="The colours, the type, the space and the logo every part is made of."
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
            <DataListItem key={t.role} label={`${t.role.charAt(0).toUpperCase()}${t.role.slice(1)}`}>
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
                <span className="ui-brandbook-ladder-name">
                  {s.name === "h1" || s.name === "h2" ? s.name.toUpperCase() : s.name}
                </span>
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

      <Part id="logo" title="Logo">
        <DataList variant="stacked" className="ui-voice-facts">
          {book.logo.versions.map((v) => (
            <DataListItem key={v.name} label={v.name}>
              {v.use}
            </DataListItem>
          ))}
          <DataListItem label="Clear space">{book.logo.clearSpace}</DataListItem>
          <DataListItem label="Smallest">{book.logo.minWidthPx} px wide</DataListItem>
          {book.logo.placements.length > 0 && (
            <DataListItem label="Where">
              {book.logo.placements
                .map((p) => `${formatWord[p.format]}: ${p.where.replace("_", " ")}, ${p.widthPct} % wide`)
                .join(" · ")}
            </DataListItem>
          )}
        </DataList>
      </Part>

      {book.photoText.rules.length > 0 && (
        <Part id="photo" title="Words on photographs">
          <ul className="ui-voice-list">
            {book.photoText.rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Part>
      )}

      {book.components.length > 0 && (
        <Group
          id="components"
          title="Components"
          line={`Each part of a creative, live in ${brand}’s colours and type. The Engine builds every creative from them.`}
        />
      )}
      {book.components.map((c) => (
        <ComponentPart key={c.name} book={book} c={c} brand={brand} />
      ))}

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
