// LYSNE's books (FLOWS §30): the long Tone of Voice and the design system Fume wrote. The voice's version 1 is
// approved by Maja and in use; version 2 (the gift season's words, Anna's ask) is a draft that waits on Anna's check.
// The design system's version 1 is checked by Anna and waits on Maja. Code builds the CSS and measures the contrast,
// as the brand-book function does (supabase/functions/brand-book/book.ts). The Look Book's version 1 (FLOWS §32),
// written from twelve of LYSNE's pictures, is checked by Anna and waits on Maja too.
import type { BrandBook, DesignRole, DesignBook, VoiceBook } from "../../contract";
import { at, img } from "./helpers";
import { lysneLook } from "./look";

/** The voice at work, besides its five parts (the long Tone of Voice). */
function voiceAtWork(): Omit<VoiceBook, "parts" | "identity" | "speak" | "rules" | "audience" | "examples"> {
  return {
    summary:
      "LYSNE speaks quietly, to one person, about the hour before sleep. Short lines, one idea each, ending in a full stop. It says what the oil feels like, never what it does to the skin.",
    scale: [
      { from: "Warm", to: "Cool", at: 1 },
      { from: "Quiet", to: "Loud", at: 1 },
      { from: "Close", to: "Formal", at: 2 },
      { from: "Plain", to: "Ornate", at: 2 },
      { from: "Serious", to: "Playful", at: 2 },
    ],
    mechanics: {
      casing: "Sentence case everywhere, headlines and buttons too. LYSNE in capitals; product names as printed.",
      punctuation:
        "A full stop at the end of a line, also in a headline. No exclamation marks. A middle dot between a name and its size.",
      numbers: "Figures for sizes and prices: 100 ml, 450 kr. A space before % in Norwegian: 25 %.",
      emoji: "None.",
      names: "LYSNE, never Lysne. Night Body Oil · 100 ml, as on the label.",
    },
    vocabulary: [
      { word: "kveld / evening", use: "The brand's moment. Use it before “night”." },
      { word: "ro", use: "Calm, as a feeling, not a promise: «litt ro», never «total ro»." },
      { word: "ritual", use: "Sparingly, once a text at most. Never “self-care routine”." },
      { word: "varm / warm", use: "For the light and the oil in the hands." },
    ],
    channels: [
      {
        channel: "instagram_feed",
        how: "One line on the picture, or none. The caption carries the rest in two or three short lines.",
        length: "Headline up to 6 words; caption up to 40 words; no call to action on the picture.",
        example: "Kvelden din, litt langsommere.",
      },
      {
        channel: "instagram_story",
        how: "One line and one call to action, low in the calm part of the picture.",
        length: "Headline up to 6 words; call to action 2 words.",
        example: "Gi bort en roligere kveld. · Se settet",
      },
      {
        channel: "paid_social",
        how: "The product named as printed, one calm line, the offer stated plainly when there is one.",
        length: "Headline up to 6 words; primary text up to 25 words.",
        example: "Kveldssettet. 25 % av, til mandag.",
      },
      {
        channel: "email",
        how: "A subject line like a note from a friend; the body in short paragraphs, one picture.",
        length: "Subject up to 6 words; body up to 80 words.",
        example: "Litt mer kveld i uka som kommer.",
      },
      {
        channel: "website",
        how: "The product page says what is in it and how it feels; nothing about results.",
        length: "Headline up to 8 words; body up to 60 words.",
        example: "Mandelolje og squalan. Ikke noe mer.",
      },
      {
        channel: "packaging",
        how: "As few words as the label allows: the name, the size, the hour.",
        length: "Up to 6 words besides the name.",
        example: "Til timen før du sovner.",
      },
    ],
    headlines: [
      { pattern: "Your [moment], [slowed down].", example: "Kvelden din, litt langsommere." },
      { pattern: "[Ingredient] and [ingredient]. Nothing else.", example: "Mandelolje og squalan. Ikke noe mer." },
      { pattern: "[A small act]. [A breath].", example: "Varm oljen i hendene. Pust ut." },
      { pattern: "For [someone who deserves it].", example: "Til noen som fortjener kvelden." },
      { pattern: "[Give] a calmer [evening].", example: "Gi bort en roligere kveld." },
    ],
    ctas: [
      { cta: "Se oljen", when: "The product page, from a picture of the oil." },
      { cta: "Se settet", when: "A set or an offer." },
      { cta: "Gi den bort", when: "The gift season." },
      { cta: "Les mer", when: "A story or a journal post." },
    ],
    pairs: [
      {
        good: "Varm oljen i hendene. Pust ut.",
        bad: "Gi huden din en luksuriøs boost i kveld!",
        why: "A small act and a breath, not a result; no exclamation mark.",
      },
      {
        good: "Kveldssettet. 25 % av, til mandag.",
        bad: "SISTE SJANSE! Spar 25 % nå!",
        why: "The offer stated plainly, without urgency or capitals.",
      },
      {
        good: "Til timen før du sovner.",
        bad: "Sov bedre med LYSNE.",
        why: "The moment, never a promise about sleep.",
      },
      {
        good: "Mandelolje og squalan. Ikke noe mer.",
        bad: "En transformerende eliksir for huden.",
        why: "Plain words: what is in it, not a transformation.",
      },
    ],
    sources: [
      { part: "identity", source: "site", evidence: "lysne.no/about: “Made in Norway, for the hour before sleep.”" },
      { part: "speak", source: "site", evidence: "lysne.no, 14 pages read; short lines with full stops" },
      { part: "rules", source: "rules", evidence: "Brand DNA rules: no result claims, no urgency" },
      { part: "channels", source: "memory", evidence: "Autumn launch, approved captions" },
      { part: "headlines", source: "fume", evidence: "Fume's patterns from the brand's own lines" },
    ],
    gaps: [
      "Do you write «du» in English captions too, or only in Norwegian?",
      "May an offer name a date, or only “til mandag”?",
      "Which words do you use for the candle: «lys» or «duftlys»?",
    ],
  };
}

/** Version 2: what the gift season adds to the voice. */
function giftSeason(v: VoiceBook): VoiceBook {
  return {
    ...v,
    ctas: [...(v.ctas ?? []), { cta: "Gi kvelden bort", when: "A gift card or a set as a gift." }],
    headlines: [
      ...(v.headlines ?? []),
      { pattern: "[A gift] that [gives time].", example: "En gave som gir deg en kveld." },
    ],
    pairs: [
      ...(v.pairs ?? []),
      {
        good: "En gave som gir deg en kveld.",
        bad: "Årets mest populære julegave!",
        why: "No popularity claim the brand cannot back.",
      },
    ],
    gaps: [...(v.gaps ?? []).slice(0, 2), "Will gift cards have their own words on the card itself?"],
  };
}

// ─── The design system ────────────────────────────────────────────────────────

// The contrast of two colours (WCAG 2), as the brand-book function measures it.
const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel(((n >> 16) & 255) / 255) +
    0.7152 * channel(((n >> 8) & 255) / 255) +
    0.0722 * channel((n & 255) / 255)
  );
};
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
};

type Answer = Omit<DesignBook, "css" | "checks">;

function lysneDesign(): Answer {
  return {
    summary:
      "LYSNE's creatives are the photograph first: warm, low light and one bottle, with a few words where the wall is calm. Cormorant for what the brand says, Inter for names, sizes and buttons. Night brown words on light walls, Linen on dark ones, and Burgundy only for the call to action.",
    colours: [
      {
        name: "Night brown",
        hex: "#2B1D17",
        role: "primary",
        use: "The brand's dark: words, the logo on light.",
        source: "brand_dna",
      },
      {
        name: "Burgundy cap",
        hex: "#5C1F2A",
        role: "secondary",
        use: "The cap's colour; a badge, a price.",
        source: "brand_dna",
      },
      {
        name: "Amber glass",
        hex: "#A8642B",
        role: "accent",
        use: "A thin rule or a small mark, never words.",
        source: "brand_dna",
      },
      {
        name: "Linen",
        hex: "#EFE6DA",
        role: "background",
        use: "A flat ground when there is no photograph.",
        source: "brand_dna",
      },
      { name: "Warm paper", hex: "#F7F2EA", role: "surface", use: "A card or a panel on Linen.", source: "fume" },
      {
        name: "Night brown",
        hex: "#2B1D17",
        role: "text",
        use: "Words on a light wall or on Linen.",
        source: "brand_dna",
      },
      {
        name: "Walnut",
        hex: "#6B5B4E",
        role: "text_muted",
        use: "A size, a caption, the small print.",
        source: "fume",
      },
      { name: "Linen", hex: "#EFE6DA", role: "on_primary", use: "Words on Night brown.", source: "brand_dna" },
      { name: "Warm paper", hex: "#F7F2EA", role: "on_photo", use: "Words on a dark photograph.", source: "fume" },
      { name: "Burgundy cap", hex: "#5C1F2A", role: "cta", use: "The call to action's pill.", source: "brand_dna" },
      { name: "Linen", hex: "#EFE6DA", role: "cta_text", use: "The words on the call to action.", source: "brand_dna" },
      { name: "Evening stone", hex: "#B5A691", role: "border", use: "A hairline on Linen.", source: "brand_dna" },
      {
        name: "Dusk blue",
        hex: "#3E4A5C",
        role: "support",
        use: "A quiet accent in winter, sparingly.",
        source: "brand_dna",
      },
    ],
    typefaces: [
      {
        role: "display",
        family: "Cormorant",
        fallback: "Cormorant Garamond",
        weights: [400, 500],
        source: "brand",
        note: "LYSNE's own serif, from the brand guide; Cormorant Garamond on Google Fonts draws it the same.",
      },
      {
        role: "body",
        family: "Inter",
        fallback: "Inter",
        weights: [400, 500],
        source: "brand",
        note: "Names, sizes, prices and buttons.",
      },
    ],
    styles: [
      { name: "display", font: "display", sizePx: 104, lineHeight: 1, trackingEm: -0.01, weight: 400, case: "none" },
      { name: "h1", font: "display", sizePx: 76, lineHeight: 1.05, trackingEm: -0.01, weight: 400, case: "none" },
      { name: "h2", font: "display", sizePx: 52, lineHeight: 1.1, trackingEm: 0, weight: 400, case: "none" },
      { name: "subline", font: "body", sizePx: 30, lineHeight: 1.3, trackingEm: 0, weight: 400, case: "none" },
      { name: "body", font: "body", sizePx: 28, lineHeight: 1.45, trackingEm: 0, weight: 400, case: "none" },
      { name: "caption", font: "body", sizePx: 22, lineHeight: 1.35, trackingEm: 0, weight: 400, case: "none" },
      { name: "label", font: "body", sizePx: 20, lineHeight: 1.2, trackingEm: 0.08, weight: 500, case: "upper" },
      { name: "cta", font: "body", sizePx: 26, lineHeight: 1, trackingEm: 0.01, weight: 500, case: "none" },
      { name: "price", font: "body", sizePx: 30, lineHeight: 1.2, trackingEm: 0, weight: 500, case: "none" },
      { name: "legal", font: "body", sizePx: 16, lineHeight: 1.35, trackingEm: 0, weight: 400, case: "none" },
    ],
    spacing: { unitPx: 8, scale: [1, 2, 3, 4, 6, 8, 12] },
    radiusPx: { none: 0, small: 4, large: 16, pill: 999 },
    formats: [
      { format: "feed", marginPx: 72, safeTopPx: 72, safeBottomPx: 96, columns: 6, gutterPx: 24 },
      { format: "square", marginPx: 64, safeTopPx: 64, safeBottomPx: 64, columns: 6, gutterPx: 24 },
      { format: "story", marginPx: 72, safeTopPx: 250, safeBottomPx: 340, columns: 6, gutterPx: 24 },
      { format: "banner", marginPx: 96, safeTopPx: 80, safeBottomPx: 80, columns: 12, gutterPx: 32 },
    ],
    logo: {
      versions: [
        { name: "Wordmark", use: "Night brown, on Linen or a light wall." },
        { name: "Wordmark, reversed", use: "Linen, on Night brown or a dark photograph." },
      ],
      clearSpace: "The height of the L on every side.",
      minWidthPx: 160,
      placements: [
        { format: "banner", where: "top_left", widthPct: 12 },
        { format: "feed", where: "bottom_centre", widthPct: 22 },
      ],
    },
    photoText: {
      rules: [
        "Words sit where the picture is calm: the wall above the bottle, or the stone in front of it.",
        "Never over the bottle, the cap or the label.",
        "On a busy picture, a soft shade from the edge, never a box.",
        "Only where the label does not show the name is the wordmark added.",
      ],
      scrim: "gradient",
      scrimOpacity: 0.3,
    },
    components: [
      {
        name: "headline",
        purpose: "The one line that says the idea.",
        style: "h1",
        colour: "text",
        background: null,
        radius: "none",
        paddingPx: 0,
        rules: ["One line, two at most.", "Ends with a full stop."],
      },
      {
        name: "subline",
        purpose: "The product as printed, or a short second line.",
        style: "subline",
        colour: "text",
        background: null,
        radius: "none",
        paddingPx: 0,
        rules: ["Never longer than the headline."],
      },
      {
        name: "price",
        purpose: "A price or an offer, stated plainly.",
        style: "price",
        colour: "secondary",
        background: null,
        radius: "none",
        paddingPx: 0,
        rules: ["Figures, a space before %."],
      },
      {
        name: "cta",
        purpose: "The call to action, on a story or a banner.",
        style: "cta",
        colour: "cta_text",
        background: "cta",
        radius: "pill",
        paddingPx: 22,
        rules: ["Two words.", "Never on a feed picture."],
      },
      {
        name: "badge",
        purpose: "A small mark: a set, a season.",
        style: "label",
        colour: "on_primary",
        background: "secondary",
        radius: "small",
        paddingPx: 12,
        rules: ["One per creative at most."],
      },
      {
        name: "product_name",
        purpose: "The name and size, as on the label.",
        style: "label",
        colour: "text_muted",
        background: null,
        radius: "none",
        paddingPx: 0,
        rules: ["As printed: Night Body Oil · 100 ml."],
      },
      {
        name: "legal",
        purpose: "The offer's terms.",
        style: "legal",
        colour: "text_muted",
        background: null,
        radius: "none",
        paddingPx: 0,
        rules: ["Only when the offer needs it."],
      },
      {
        name: "logo",
        purpose: "The wordmark, where the label does not show it.",
        style: "label",
        colour: "primary",
        background: null,
        radius: "none",
        paddingPx: 0,
        rules: ["Never twice on one creative."],
      },
    ],
    rules: {
      do: [
        "Let the photograph carry the creative; words are the smaller part.",
        "Keep words on one side, aligned to the margin.",
        "Use Burgundy only for the call to action.",
      ],
      dont: [
        "Words over the bottle or the label.",
        "More than three layers of words.",
        "Amber glass for words: it is too light to read.",
      ],
    },
    examples: [
      {
        name: "The evening, launched",
        format: "feed",
        purpose: "Launch",
        picture: "The bottle low on evening stone; the light wall above it, to the right, is calm.",
        image: img("02-01"),
        layers: [
          { component: "headline", text: "Kvelden din, litt langsommere.", x: 37, y: 6, w: 56, h: 14, align: "right" },
          { component: "product_name", text: "Night Body Oil · 100 ml", x: 37, y: 22, w: 56, h: 3, align: "right" },
        ],
        why: "The headline on the lightest part of the wall, the bottle keeps the lower half; no logo, since the label shows it.",
      },
      {
        name: "The set, as an offer",
        format: "story",
        purpose: "Offer",
        picture: "The bottle low in a corner of light; the wall above it is calm.",
        image: img("01-03", "story"),
        layers: [
          { component: "headline", text: "Gi bort en roligere kveld.", x: 8, y: 15, w: 60, h: 9, align: "left" },
          { component: "price", text: "Kveldssettet · 25 % av", x: 8, y: 26, w: 60, h: 3, align: "left" },
          { component: "cta", text: "Se settet", x: 8, y: 31, w: 32, h: 4.5, align: "left" },
          { component: "legal", text: "Til og med mandag 30. november.", x: 8, y: 37, w: 60, h: 2, align: "left" },
        ],
        why: "Every word above the bottle and below the 250 pixels the platform covers at the top.",
      },
      {
        name: "What is in it",
        format: "square",
        purpose: "Product story",
        picture: "The bottle to the left, a hand on the stone; the wall above the hand is calm.",
        image: img("04-06", "square"),
        layers: [
          {
            component: "headline",
            text: "Mandelolje og squalan. Ikke noe mer.",
            x: 44,
            y: 7,
            w: 50,
            h: 22,
            align: "right",
          },
          { component: "product_name", text: "Night Body Oil · 100 ml", x: 44, y: 31, w: 50, h: 3, align: "right" },
        ],
        why: "The words to the right, over the calm wall, the bottle to the left; aligned to the right margin.",
      },
      {
        name: "An everyday post",
        format: "story",
        purpose: "Everyday post",
        picture: "The bottle to the right, its shadow behind it; the wall to the left is calm from top to bottom.",
        image: img("07-11", "story"),
        layers: [
          { component: "headline", text: "Varm oljen i hendene. Pust ut.", x: 8, y: 15, w: 40, h: 14, align: "left" },
        ],
        why: "One line on the calm side, no call to action; the bottle and its shadow are left to speak.",
      },
      {
        name: "A gift",
        format: "feed",
        purpose: "Gift season",
        picture: "Hands and a drop of oil against the wall; below them the wall is in shade. No bottle, so no label.",
        image: img("07-10"),
        layers: [
          {
            component: "headline",
            text: "Til noen som fortjener kvelden.",
            x: 10,
            y: 74,
            w: 80,
            h: 10,
            align: "centre",
            colour: "on_photo",
          },
          { component: "logo", text: "", x: 39, y: 88, w: 22, h: 3, align: "centre", colour: "on_photo" },
        ],
        why: "Warm paper words in the shade below the hands; the wordmark, since no label shows it.",
      },
    ],
    sources: [
      { part: "colours", source: "brand_dna", evidence: "Brand DNA colours, approved by Maja" },
      { part: "typefaces", source: "brand_dna", evidence: "LYSNE brand guide 2026.pdf" },
      { part: "styles", source: "fume", evidence: "Fume's scale for the formats" },
      { part: "examples", source: "memory", evidence: "Autumn launch, the approved creatives" },
    ],
    gaps: [
      "Can we have Cormorant's font files, or do we keep Cormorant Garamond?",
      "Is there a version of the wordmark for small sizes?",
    ],
  };
}

/** What code builds from the answer: the `.brand` CSS and the contrast of every pair that carries words. */
export function builtDesign(a: Answer): DesignBook {
  const kebab = (s: string) => s.replace(/_/g, "-");
  const role = (r: DesignRole) => a.colours.find((c) => c.role === r)?.hex;
  const lines = [".brand {"];
  const seen = new Set<string>();
  for (const c of a.colours)
    if (!seen.has(c.role)) {
      seen.add(c.role);
      lines.push(`  --color-${kebab(c.role)}: ${c.hex};`);
    }
  for (const t of a.typefaces) {
    const names = [t.family, t.fallback].filter((x, i, all) => all.indexOf(x) === i).map((f) => `"${f}"`);
    lines.push(`  --font-${t.role}: ${names.join(", ")}, ${t.role === "display" ? "serif" : "sans-serif"};`);
  }
  for (const s of a.styles)
    lines.push(
      `  --type-${s.name}-size: ${s.sizePx}px;`,
      `  --type-${s.name}-line: ${s.lineHeight};`,
      `  --type-${s.name}-tracking: ${s.trackingEm}em;`,
      `  --type-${s.name}-weight: ${s.weight};`,
    );
  for (const m of a.spacing.scale) lines.push(`  --space-${m}: ${m * a.spacing.unitPx}px;`);
  for (const [k, v] of Object.entries(a.radiusPx)) lines.push(`  --radius-${k}: ${v}px;`);
  lines.push("}");
  const pairs: DesignBook["checks"]["contrast"] = [];
  const measure = (fg: DesignRole, bg: DesignRole, need: number) => {
    const f = role(fg);
    const b = role(bg);
    if (!f || !b || pairs.some((p) => p.pair === `${fg} on ${bg}`)) return;
    const ratio = contrast(f, b);
    pairs.push({ pair: `${fg} on ${bg}`, ratio, ok: ratio >= need, need });
  };
  measure("text", "background", 4.5);
  measure("text", "surface", 4.5);
  measure("on_primary", "primary", 4.5);
  measure("cta_text", "cta", 4.5);
  measure("text_muted", "background", 4.5);
  for (const c of a.components) if (c.background) measure(c.colour, c.background, c.name === "headline" ? 3 : 4.5);
  return {
    ...a,
    css: lines.join("\n"),
    checks: {
      contrast: pairs,
      missingRoles: [],
      fails: pairs.filter((p) => !p.ok).map((p) => `${p.pair} reads at ${p.ratio}:1; it needs ${p.need}:1.`),
    },
  };
}

/** LYSNE's books, newest version first per kind. */
export function brandBooks(voice: VoiceBook): BrandBook[] {
  const v1: VoiceBook = { ...voice, ...voiceAtWork() };
  return [
    {
      id: "bb-voice-2",
      kind: "voice",
      version: 2,
      state: "draft",
      ask: "Add the gift season's words: calls to action and headlines for a gift.",
      askedBy: "u-anna",
      createdAt: at(60 * 3),
      writtenAt: at(60 * 3 - 1),
      body: giftSeason(v1),
    },
    {
      id: "bb-voice-1",
      kind: "voice",
      version: 1,
      state: "approved",
      createdAt: at(60 * 24 * 8),
      writtenAt: at(60 * 24 * 8 - 1),
      checkedBy: "u-anna",
      checkedAt: at(60 * 24 * 7),
      approvedBy: "u-maja",
      approvedAt: at(60 * 24 * 6),
      body: v1,
    },
    {
      id: "bb-design-1",
      kind: "design",
      version: 1,
      state: "checked",
      createdAt: at(60 * 26),
      writtenAt: at(60 * 26 - 1),
      checkedBy: "u-anna",
      checkedAt: at(60 * 5),
      body: builtDesign(lysneDesign()),
    },
    {
      id: "bb-look-1",
      kind: "look",
      version: 1,
      state: "checked",
      createdAt: at(60 * 7),
      writtenAt: at(60 * 7 - 2),
      checkedBy: "u-anna",
      checkedAt: at(60 * 2),
      body: lysneLook(),
    },
  ];
}
