// Graphic design by Fume in the demo (FLOWS §33): the words of a plan laid on a picture in the brand's design system,
// as the design service would lay them out, with what code measured and what Fume's review found. The live service
// renders a PNG and a .fig; the demo draws the same words over the photograph (DesignDrawing).
import type {
  DesignBook,
  DesignCheck,
  DesignDrawing,
  DesignFinding,
  DesignWords,
  Format,
  PlanLine,
  VersionDesign,
} from "../../contract";

/** Autumn launch's plan is older than the demo's plans; these are its approved words, as the plan keeps them. */
export const planCopy: Record<string, Pick<PlanLine, "key" | "label" | "value">[]> = {
  "c-autumn": [
    { key: "headline", label: "Headline", value: "Den langsomme timen før søvn." },
    { key: "support", label: "Supporting line", value: "Night Body Oil · 100 ml" },
    { key: "cta", label: "Call to action", value: "Se kveldsoljen" },
  ],
};

const pick = (lines: Pick<PlanLine, "key" | "label" | "value">[], keys: RegExp) =>
  lines
    .find((l) => keys.test(`${l.key} ${l.label}`))
    ?.value.replace(/\s+/g, " ")
    .trim();

/** The words on the layer, as the design function picks them: the headline, the supporting line and the call to
 *  action, word for word (supabase/functions/design/layer.ts, wordsOf). None without a headline. */
export function wordsOf(lines: Pick<PlanLine, "key" | "label" | "value">[]): DesignWords | undefined {
  const headline = pick(lines, /headline|overskrift/i);
  if (!headline) return undefined;
  const subline = pick(lines, /support|subline|sub_?head|body|undertekst/i);
  const cta = pick(lines, /call_?to_?action|\bcta\b|knapp/i);
  return { headline, ...(subline ? { subline } : {}), ...(cta ? { cta } : {}) };
}

const SIZE: Record<Format, [number, number]> = { feed: [1080, 1350], square: [1080, 1080], story: [1080, 1920] };

export interface Choice {
  band: "top" | "middle" | "bottom";
  align: "left" | "centre" | "right";
  /** The colour role of the words. */
  colour: "text" | "on_photo";
  ground: "photo" | "gradient";
}

const round = (n: number) => Math.round(n * 10) / 10;

/** The words laid out on the brand's grid: a headline in its type style, the supporting line under it, the call to
 *  action at the foot where the design system allows it (never on a feed in LYSNE's). */
export function laidOut(book: DesignBook, format: Format, words: DesignWords, choice: Choice) {
  const [W, H] = SIZE[format];
  const grid = book.formats.find((f) => f.format === format) ?? book.formats[0];
  const col = (W - 2 * grid.marginPx - (grid.columns - 1) * grid.gutterPx) / grid.columns;
  const span = format === "story" ? 5 : 4;
  const width = span * col + (span - 1) * grid.gutterPx;
  const style = (name: string) => book.styles.find((s) => s.name === name);
  const face = (role: string) => {
    const t = book.typefaces.find((x) => x.role === role) ?? book.typefaces[0];
    const serif = role === "display";
    return {
      family: `"${t.family}", "${t.fallback}", ${serif ? "Georgia, serif" : "system-ui, sans-serif"}`,
      font: t.fallback || t.family,
    };
  };
  const hex = (role: string) => book.colours.find((c) => c.role === role)?.hex ?? "#000000";
  const head = style(book.components.find((c) => c.name === "headline")?.style ?? "h1") ?? book.styles[0];
  const sub = style(book.components.find((c) => c.name === "subline")?.style ?? "subline") ?? book.styles[0];
  const ctaComp = book.components.find((c) => c.name === "cta");
  const ctaStyle = style(ctaComp?.style ?? "cta");
  const onFeed = ctaComp?.rules.some((r) => /never on a feed/i.test(r)) && format === "feed";
  const cta = words.cta && !onFeed ? words.cta : undefined;
  // About as many characters as fit a line of the column, for the lines check and the height of each part.
  const linesOf = (text: string, px: number, serif: boolean) =>
    Math.max(1, Math.ceil(text.length / (width / (px * (serif ? 0.46 : 0.52)))));
  const headLines = linesOf(words.headline, head.sizePx, true);
  const subLines = words.subline ? linesOf(words.subline, sub.sizePx, false) : 0;
  const gap = book.spacing.unitPx * 3;
  const headH = headLines * head.sizePx * head.lineHeight;
  const subH = subLines * sub.sizePx * sub.lineHeight;
  const block = headH + (subLines ? gap + subH : 0);
  const top =
    choice.band === "top"
      ? grid.safeTopPx
      : choice.band === "middle"
        ? (H - block) / 2
        : H - grid.safeBottomPx - block - (cta && ctaStyle ? ctaStyle.sizePx + 2 * (ctaComp?.paddingPx ?? 0) + gap : 0);
  const x =
    choice.align === "left" ? grid.marginPx : choice.align === "right" ? W - grid.marginPx - width : (W - width) / 2;
  const colour = hex(choice.colour);
  const pct = (px: number, of: number) => round((px / of) * 100);
  const layers: DesignDrawing["layers"] = [
    {
      role: "headline",
      text: words.headline,
      x: pct(x, W),
      y: pct(top, H),
      w: pct(width, W),
      align: choice.align,
      sizePx: head.sizePx,
      family: face(head.font).family,
      weight: head.weight,
      lineHeight: head.lineHeight,
      trackingEm: head.trackingEm,
      colour,
    },
  ];
  if (words.subline)
    layers.push({
      role: "subline",
      text: words.subline,
      x: pct(x, W),
      y: pct(top + headH + gap, H),
      w: pct(width, W),
      align: choice.align,
      sizePx: sub.sizePx,
      family: face(sub.font).family,
      weight: sub.weight,
      lineHeight: sub.lineHeight,
      trackingEm: sub.trackingEm,
      colour,
    });
  if (cta && ctaStyle && ctaComp) {
    const h = ctaStyle.sizePx + 2 * ctaComp.paddingPx;
    layers.push({
      role: "cta",
      text: cta,
      x: pct(x, W),
      y: pct(choice.band === "bottom" ? top + block + gap : H - grid.safeBottomPx - h, H),
      w: pct(width, W),
      align: choice.align,
      sizePx: ctaStyle.sizePx,
      family: face(ctaStyle.font).family,
      weight: ctaStyle.weight,
      lineHeight: ctaStyle.lineHeight,
      trackingEm: ctaStyle.trackingEm,
      colour: hex(ctaComp.colour),
      fill: hex(ctaComp.background ?? "cta"),
      radiusPx: book.radiusPx[ctaComp.radius],
      paddingPx: ctaComp.paddingPx,
    });
  }
  const drawing: DesignDrawing = {
    ...(choice.ground === "gradient"
      ? { shade: { from: choice.band === "bottom" ? "bottom" : "top", opacity: book.photoText.scrimOpacity } }
      : {}),
    fonts: [...new Set(book.typefaces.map((t) => t.fallback || t.family))],
    layers,
  };
  const most = H > W * 1.5 ? [3, 4] : [2, 3];
  const display = book.typefaces.find((t) => t.role === "display");
  const checks: DesignCheck[] = [
    { check: "fits", node: "Words", ok: true, hard: true, note: "Inside the safe area." },
    ...(cta ? [{ check: "fits" as const, node: "CTA", ok: true, hard: true, note: "Inside the safe area." }] : []),
    {
      check: "lines",
      node: "Headline",
      ok: headLines <= most[0],
      hard: true,
      value: headLines,
      need: most[0],
      note: `${headLines} line${headLines === 1 ? "" : "s"} (at most ${most[0]}).`,
    },
    ...(subLines
      ? [
          {
            check: "lines" as const,
            node: "Subline",
            ok: subLines <= most[1],
            hard: true,
            value: subLines,
            need: most[1],
            note: `${subLines} line${subLines === 1 ? "" : "s"} (at most ${most[1]}).`,
          },
        ]
      : []),
  ];
  return { drawing, checks, headLines, display };
}

/** What code measured and Fume's review found on a layout, for the demo: the top of a dark picture is calm for the
 *  headline and a little busy under the supporting line; the bottom of it competes with the light on the stone. */
export function measured(
  book: DesignBook,
  format: Format,
  words: DesignWords,
  choice: Choice,
): Pick<VersionDesign, "layout" | "checks" | "findings" | "verdict" | "tried"> & { drawing: DesignDrawing } {
  const { drawing, checks, display } = laidOut(book, format, words, choice);
  const low = choice.band === "bottom";
  const light = choice.colour === "text";
  const contrast = (node: "Headline" | "Subline", value: number, need: number): DesignCheck => ({
    check: "contrast",
    node,
    ok: value >= need,
    hard: true,
    value,
    need,
    note: `${value}:1 against nine in ten of the pixels under the words (needs ${need}:1).`,
  });
  const busy = (node: "Headline" | "Subline", value: number): DesignCheck => ({
    check: "busy",
    node,
    ok: value <= 0.12,
    hard: false,
    value,
    need: 0.12,
    note: value <= 0.12 ? "Calm under the words." : "The picture is busy under the words.",
  });
  // Round 15 (FLOWS §35.1): code measures whether the words keep the product clear. In the demo the bottle stands in
  // the middle of the picture, so words in the middle band cover it; at the top or the bottom they keep it clear.
  const covers: DesignCheck = {
    check: "covers",
    node: "Words",
    ok: choice.band !== "middle",
    hard: true,
    note: choice.band !== "middle" ? "Clear of the product." : "The words sit over the bottle.",
  };
  const all: DesignCheck[] = [
    ...checks,
    covers,
    contrast("Headline", light ? 9.4 : low ? 3.6 : 6.2, 3),
    ...(words.subline ? [contrast("Subline", light ? 7.8 : low ? 4.6 : 5.1, 4.5)] : []),
    ...(light ? [] : [busy("Headline", low ? 0.14 : 0.07)]),
    ...(words.subline && !light ? [busy("Subline", low ? 0.19 : 0.15)] : []),
    ...(display && display.family !== display.fallback
      ? [
          {
            check: "font" as const,
            node: "h1",
            ok: false,
            hard: false,
            note: `${display.family} is not on file; set in ${display.fallback} until the brand gives Fume its font.`,
          },
        ]
      : []),
  ];
  const findings: DesignFinding[] = light
    ? [
        {
          severity: "minor",
          what: "The supporting line sits close to the headline; one more step of space would let it breathe.",
          by: "fume_review",
        },
      ]
    : low
      ? [
          {
            severity: "major",
            what: "The headline sits on the bright edge of the stone; it reads, but it fights the light.",
            by: "fume_review",
          },
          { severity: "minor", what: "The words feel pushed to the foot; more air under them.", by: "fume_review" },
        ]
      : [
          {
            severity: "minor",
            what:
              choice.align === "left"
                ? "The supporting line runs over the bright stripes at the left; a softer shade would calm it."
                : "The supporting line sits on the warm light behind the bottle; a softer shade would calm it.",
            by: "fume_review",
          },
        ];
  return {
    layout: { band: choice.band, align: choice.align, ground: choice.ground, colour: choice.colour },
    checks: all,
    findings,
    verdict: findings.some((f) => f.severity !== "minor") ? "needs_work" : "ready_for_check",
    tried: low ? 14 : 6,
    drawing,
  };
}
