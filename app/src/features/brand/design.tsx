// Brand › Design system (/brand/design, FLOWS §30): the brand's design system for its campaign creatives, as Fume
// wrote it and code built it. Examples of graphic design first, drawn on the brand's own photographs with its own
// colours and type; then colour (with the contrast of every pair that carries words), type, layout per format, the
// logo, words on photographs, components, rules, the CSS, and what Fume still needs to know. The look is
// brand-book.css. Sizes in the book are pixels at a frame 1080 wide, so the examples and the type ladder scale them.
import { Button, DataList, DataListItem, Icon, useToast } from "@fume/ui";
import { useEffect, type CSSProperties, type ReactNode } from "react";
import type { DesignBook, DesignFormat, DesignRole } from "../../contract";
import { BookFrame, NoBook } from "./books";
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

/** A part of the design system: its title, its line, then what it holds. */
function Part({ id, title, line, children }: { id: string; title: string; line?: string; children: ReactNode }) {
  return (
    <section className="ui-voice-part" id={`design-${id}`} aria-labelledby={`design-${id}-title`}>
      <div className="ui-voice-part-words">
        <h2 className="ui-voice-part-title" id={`design-${id}-title`}>
          {title}
        </h2>
        {line && <p className="ui-voice-part-line">{line}</p>}
      </div>
      {children}
    </section>
  );
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

/** The whole design system. */
export function DesignBookView({ book }: { book: DesignBook }) {
  const toast = useToast();
  const { brand } = useViewer();
  useBrandFonts(book);
  const sample = book.examples
    .find((e) => e.layers.some((l) => l.component === "headline"))
    ?.layers.find((l) => l.component === "headline")?.text;
  return (
    <div className="ui-voice-book">
      <p className="ui-voice-lead ui-brandbook-summary">{book.summary}</p>

      <Part id="examples" title="In use" line="Examples of graphic design, on the brand’s own photographs.">
        <div className="ui-brandbook-examples">
          {book.examples.map((e) => (
            <Example key={e.name} book={book} example={e} brand={brand} />
          ))}
        </div>
      </Part>

      <Part id="colour" title="Colour" line="Every colour and the roles it plays.">
        <ul className="ui-brandbook-swatches">
          {swatches(book).map((s) => (
            <li key={s.hex} className="ui-brandbook-swatch">
              <span className="ui-brandbook-swatch-colour" style={{ background: s.hex }} aria-hidden="true" />
              <span className="ui-brandbook-swatch-name">{s.name}</span>
              <span className="ui-brandbook-swatch-code">{s.hex}</span>
              <span className="ui-brandbook-swatch-roles">{s.roles.map((r) => roleWord[r]).join(", ")}</span>
              <span className="ui-brandbook-swatch-use">{s.use[0]}</span>
            </li>
          ))}
        </ul>
        <div className="ui-voice-block">
          <h3 className="ui-voice-sub">Contrast, measured by Fume</h3>
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

      <Part id="photo" title="Words on photographs">
        <ul className="ui-voice-list">
          {book.photoText.rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </Part>

      <Part id="components" title="Components" line="Each part of a creative, its style and its colours.">
        <ul className="ui-brandbook-rows">
          {book.components.map((c) => (
            <li key={c.name}>
              <span className="ui-brandbook-row-main">{componentWord[c.name]}</span>
              <span className="ui-brandbook-row-meta">
                {c.purpose} Style {c.style}, {roleWord[c.colour].toLowerCase()}
                {c.background ? ` on ${roleWord[c.background].toLowerCase()}` : ""}. {c.rules.join(" ")}
              </span>
            </li>
          ))}
        </ul>
      </Part>

      <Part id="rules" title="Rules">
        <div className="ui-voice-cols">
          <div className="ui-voice-block">
            <h3 className="ui-voice-sub">Do</h3>
            <ul className="ui-voice-list">
              {book.rules.do.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
          <div className="ui-voice-block">
            <h3 className="ui-voice-sub">Don’t</h3>
            <ul className="ui-voice-list">
              {book.rules.dont.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      </Part>

      <Part id="css" title="Tokens as CSS" line="Built by code from the system, for a designer or a developer.">
        <div className="ui-brandbook-code">
          <Button
            variant="secondary"
            size="sm"
            icon="copy"
            className="ui-brandbook-code-copy"
            onClick={() =>
              navigator.clipboard?.writeText(book.css).then(
                () => toast.done("CSS copied"),
                () => toast.error("The CSS wasn’t copied"),
              )
            }
          >
            Copy
          </Button>
          <pre className="ui-brandbook-code-text" tabIndex={0} aria-label="The design system as CSS">
            {book.css}
          </pre>
        </div>
      </Part>

      <BookEnd gaps={book.gaps} sources={book.sources} />
    </div>
  );
}
