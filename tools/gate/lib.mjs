// Fume rule gate, the checks themselves: CSS and HTML against rules/ui.rules.json (rules with check:"auto").
// Used by the command line (gate.mjs) and by the Fume connector (fume_check), so both judge alike.
// Allow one line explicitly with a comment containing  gate-allow:<rule-id>  (state why next to it).
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

export const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
export const RULES = Object.fromEntries(JSON.parse(readFileSync(join(root, "rules/ui.rules.json"), "utf8")).rules.map((r) => [r.id, r]));
export const DEFAULT_SCOPE = ["design-system/components", "design-system/theme", "review/board.template.html", "review/sections", "site", "packages", "templates", "kit"];
// Brand surfaces (templates: decks, social, one-pagers) are not product UI: they are built on the brand primitives
// (--fume-*) at their own pixel scale, and GT Canon sets their titles. The UI scale rules do not apply there;
// every brand rule (colour, gradients, glow, strokes, Amber, mono, motion, copy) still does.
const BRAND_FILE = /^templates\//;
const BRAND_SKIP = new Set(["ui-tokens-not-primitives", "type-from-tokens", "radius-from-tokens", "space-from-tokens", "air", "canon-not-in-ui"]);
export const EXEMPT = [/^tokens\//, /^design-system\/tokens\//, /node_modules/, /\/dist\//, /^site\/web\//];

let findings = [];
const add = (rule, file, line, detail) => {
  const r = RULES[rule];
  findings.push({ rule, level: r ? r.level : "error", file, line, detail, fix: r && r.fix });
};

export function walk(p, out) {
  if (!existsSync(p)) return out;
  if (statSync(p).isDirectory()) { for (const f of readdirSync(p)) walk(join(p, f), out); }
  else if ([".css", ".html", ".htm"].includes(extname(p))) out.push(p);
  return out;
}

const lineAt = (text, idx) => text.slice(0, idx).split("\n").length;
const allowed = (lines, n, rule) => (lines[n - 1] || "").includes("gate-allow:" + rule);

const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(\s*[\d.]/;
const DISPLAY_FONT = /--fume-font-display|GT Canon|Newsreader|--ui-type-display/;
const FLOATING = /(glass|popover|menu|dialog|sheet|toast|tooltip|toolbar|dock|hud|composer)/i;
const POINT_SEL = /(check|point|dot|status|selection|signature)/i;
const DATA_SEL = /(data|code|kbd|meta|time|num|mono|spec|shortcut|count|slot|size)/i;
const ACTION_SEL = /\b(btn|button|chip|badge|seg|segmented|toggle)\b/i;
// state-tokens-in-state: a hover, pressed or active token belongs to that state of a control, never to a resting surface
const STATE_TOKEN = /var\(--ui-[\w-]*-(?:hover|pressed|active)(?![\w-])/;
const STATE_SEL = /:(?:hover|active|focus|focus-visible|focus-within|checked|has)\b|::selection|\[aria-(?:pressed|selected|current|expanded|checked)|\[data-(?:state|active|selected|dragging|open|checked|pressed)\b|\[open\]|\.is-[\w-]+/;
const COLOUR_PROP = /^(background(-color)?|color|fill|stroke|border(-(top|right|bottom|left|block|inline))?(-color)?|outline(-color)?|text-decoration-color|caret-color|accent-color)$/;
// few-strokes: a line is allowed only where an element would otherwise vanish, and for focus and selection rings
const STROKE_OK = /(field|input|textarea|select\b|creative|secondary|swatch|is-white|focus|selected|checked)/i;
const BORDER_PROP = /^border(-(top|right|bottom|left|block|inline)(-(start|end))?)?$/;
// space-from-tokens (components) and air (surfaces): spacing comes from --ui-space-*, --ui-inset-* or --ui-size-* tokens
const SPACE_PROP = /^(padding|margin|gap|row-gap|column-gap)(-(top|right|bottom|left|block|inline)(-(start|end))?)?$/;
const PAD_PROP = /^padding(-(top|right|bottom|left|block|inline)(-(start|end))?)?$/;
const COMPONENT_FILE = /^(design-system\/components|kit|site|packages|tools\/gate\/fixtures)\//;
const SURFACE_CLS = /\.ui-(glass|menu|dialog|sheet|popover|tooltip|toast|card|bar)(?![\w-])/;
function stripVars(v) { let prev; do { prev = v; v = v.replace(/var\(--[\w-]+(?:,[^()]*)?\)/g, ""); } while (v !== prev); return v; }
const rawLengths = (v) => (stripVars(v).match(/-?\d*\.?\d+(px|rem|em)\b/g) || []).filter((n) => parseFloat(n) !== 0);
// the subject of a selector: the last compound of each selector in a list
const subjects = (sel) => sel.split(",").map((x) => x.trim().split(/\s*[\s>+~]\s*/).pop() || "");

function splitTop(value) {
  const parts = []; let depth = 0, cur = "";
  for (const ch of value) {
    if (ch === "(") depth++; if (ch === ")") depth--;
    if (ch === "," && depth === 0) { parts.push(cur); cur = ""; } else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts.map((s) => s.trim());
}

// Ranges of @media blocks whose condition includes (hover: hover); :hover rules must sit inside one.
function hoverRanges(css) {
  const out = []; const re = /@media[^{]*hover\s*:\s*hover[^{]*\{/g; let m;
  while ((m = re.exec(css))) {
    let depth = 1, i = m.index + m[0].length;
    for (; i < css.length && depth; i++) { if (css[i] === "{") depth++; else if (css[i] === "}") depth--; }
    out.push([m.index, i]);
  }
  return out;
}
const classRe = (cls) => new RegExp(cls.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![\\w-])");

function checkCss(css, file, offsetLine, lines, glassCo = new Set()) {
  const hoverIn = hoverRanges(css);
  const blocks = [];
  { const re = /([^{}]+)\{([^{}]*)\}/g; let b; while ((b = re.exec(css))) blocks.push({ selector: b[1].trim().split("\n").pop().trim(), body: b[2], index: b.index }); }
  const hasMotion = /\b(transition|animation)\s*:/.test(css);
  if (hasMotion && !/prefers-reduced-motion/.test(css)) add("reduced-motion", file, offsetLine, "file animates but has no prefers-reduced-motion block");
  const hasGlass = /backdrop-filter\s*:(?!\s*none)/.test(css);
  if (hasGlass && !/prefers-reduced-transparency/.test(css)) add("reduced-transparency", file, offsetLine, "file uses backdrop-filter without a prefers-reduced-transparency fallback");

  const blockRe = /([^{}]+)\{([^{}]*)\}/g; let m;
  while ((m = blockRe.exec(css))) {
    const selector = m[1].trim().split("\n").pop().trim();
    const body = m[2];
    const bodyStart = m.index + m[0].indexOf("{") + 1;
    if (/^(from|to|\d+%)/.test(selector) || selector.startsWith("@font-face")) {
      // keyframe steps and font faces: still check colour literals and gradients
    }
    const isGlassBlock = /backdrop-filter\s*:(?!\s*none)/.test(body);
    const selLine = offsetLine + lineAt(css, m.index + m[0].indexOf(selector)) - 1;

    // hover-needs-hover: a sticky hover on touch screens looks like a stuck control
    if (/:hover\b/.test(selector) && !hoverIn.some(([a, b]) => m.index >= a && m.index < b) && !allowed(lines, selLine, "hover-needs-hover")) add("hover-needs-hover", file, selLine, selector);

    // touch-target and touch-feedback: every .ui-* control is 44 px to touch and shows its own pressed state
    const uiCls = (selector.match(/\.ui-[\w-]+/) || [])[0];
    if (uiCls && /cursor\s*:\s*pointer/.test(body)) {
      const mine = blocks.filter((x) => classRe(uiCls).test(x.selector));
      if (!mine.some((x) => /--ui-size-hit/.test(x.body)) && !allowed(lines, selLine, "touch-target")) add("touch-target", file, selLine, `${uiCls} has no hit area of --ui-size-hit`);
      if (!/-webkit-tap-highlight-color\s*:\s*transparent/.test(body) && !allowed(lines, selLine, "touch-feedback")) add("touch-feedback", file, selLine, `${uiCls} shows the grey tap flash (no -webkit-tap-highlight-color: transparent)`);
      if (!mine.some((x) => /:active\b/.test(x.selector)) && !allowed(lines, selLine, "touch-feedback")) add("touch-feedback", file, selLine, `${uiCls} has no :active state`);
    }
    const isComponent = COMPONENT_FILE.test(file);
    const isSurface = isGlassBlock || /--ui-radius-(panel|float)\b/.test(body) || subjects(selector).some((sub) => SURFACE_CLS.test(sub) || [...glassCo].some((c) => classRe("." + c).test(sub)));
    const declRe = /([\w-]+)\s*:\s*([^;]+);?/g; let d;
    while ((d = declRe.exec(body))) {
      const prop = d[1].toLowerCase(); const value = d[2].trim();
      if (prop.startsWith("--")) continue; // custom property definitions are tokens, checked in token files
      const ln = offsetLine + lineAt(css, bodyStart + d.index) - 1;
      const ok = (rule) => (BRAND_FILE.test(file) && BRAND_SKIP.has(rule)) || allowed(lines, ln, rule);
      const isFontFace = selector.startsWith("@font-face");

      if (!isFontFace && COLOR_LITERAL.test(value) && !ok("tokens-only-color")) add("tokens-only-color", file, ln, `${prop}: ${value}`);
      if (/var\(--fume-/.test(value) && !isFontFace && !ok("ui-tokens-not-primitives")) add("ui-tokens-not-primitives", file, ln, `${prop}: ${value}`);
      if (/(linear|radial|conic)-gradient\(/.test(value) && !ok("no-gradient")) add("no-gradient", file, ln, `${prop}: ${value}`);
      if (COLOUR_PROP.test(prop) && STATE_TOKEN.test(value) && !STATE_SEL.test(selector) && !ok("state-tokens-in-state")) add("state-tokens-in-state", file, ln, `${selector} { ${prop}: ${value} }`);

      if (["box-shadow", "text-shadow"].includes(prop) && value !== "none") {
        for (const s of splitTop(value)) {
          if (/^inset\b/.test(s) || /\binset$/.test(s)) continue;
          const nums = (s.replace(/var\([^)]*\)/g, "").match(/-?[\d.]+(px|rem|em)?/g) || []).map(parseFloat);
          if (nums.length >= 3 && nums[0] === 0 && nums[1] === 0 && nums[2] > 0 && !ok("no-glow")) add("no-glow", file, ln, s);
          else if (nums.length >= 4 && nums[0] === 0 && nums[1] === 0 && nums[2] === 0 && nums[3] > 0 && !ok("focus-is-sharp")) add("focus-is-sharp", file, ln, s);
        }
      }
      if (prop === "filter" && /drop-shadow\(\s*0(px)?\s+0(px)?\s+[1-9]/.test(value) && !ok("no-glow")) add("no-glow", file, ln, value);

      if (SPACE_PROP.test(prop) && rawLengths(value).length) {
        if (isSurface && PAD_PROP.test(prop) && !ok("air")) add("air", file, ln, `${selector} { ${prop}: ${value} }`);
        else if (isComponent && !ok("space-from-tokens")) add("space-from-tokens", file, ln, `${selector} { ${prop}: ${value} }`);
      }

      if (/^border(-[a-z]+)*-radius$/.test(prop) && !/^(0|0px|50%|inherit)$/.test(value) && !/^(var\(--ui-radius-[\w-]+\)\s*)+$/.test(value) && !ok("radius-from-tokens")) add("radius-from-tokens", file, ln, `${prop}: ${value}`);

      if (/^border(-[a-z]+)*-radius$/.test(prop) && ACTION_SEL.test(selector) && !/link/i.test(selector) && !/^(var\(--ui-radius-action\)|50%|inherit)$/.test(value) && !ok("actions-are-pills")) add("actions-are-pills", file, ln, `${selector} { ${prop}: ${value} }`);

      if (prop === "font-size" && !/^(var\(--ui-type-[\w-]+\)|inherit|1em|100%)$/.test(value) && !ok("type-from-tokens")) add("type-from-tokens", file, ln, `${prop}: ${value}`);
      if ((prop === "font-family" || prop === "font") && DISPLAY_FONT.test(value) && !ok("canon-not-in-ui")) add("canon-not-in-ui", file, ln, `${prop}: ${value}`);
      if ((prop === "font-family" || prop === "font") && /--ui-type-family-data|--fume-font-mono/.test(value) && !DATA_SEL.test(selector) && !ok("mono-is-data")) add("mono-is-data", file, ln, `${selector} { ${prop}: ${value} }`);

      if (/^(transition|animation)(-duration|-timing-function)?$/.test(prop)) {
        const stripped = value.replace(/var\(--ui-motion-[\w-]+\)/g, "");
        if (/\b\d*\.?\d+m?s\b/.test(stripped.replace(/\b0m?s\b/g, "")) && !ok("motion-from-tokens")) add("motion-from-tokens", file, ln, `${prop}: ${value}`);
        if (/cubic-bezier\(|\bease(-in|-out|-in-out)?\b/.test(stripped) && !ok("motion-from-tokens")) add("motion-from-tokens", file, ln, `${prop}: ${value}`);
      }

      if (!isGlassBlock && !STROKE_OK.test(selector) && !ok("few-strokes")) {
        const line = (BORDER_PROP.test(prop) && !/^(0|none|0px)\b/.test(value) && /\b(solid|dashed|dotted|double)\b/.test(value))
          || (prop === "outline" && /\b(solid|dashed|dotted|double)\b/.test(value))
          || (prop === "box-shadow" && splitTop(value).some((s) => /^(inset\s+)?0(px)?\s+0(px)?\s+0(px)?\s+[\d.]+px\b/.test(s)));
        if (line) add("few-strokes", file, ln, `${selector} { ${prop}: ${value} }`);
      }
      if (isGlassBlock && !FLOATING.test(selector) && prop.includes("backdrop-filter") && !ok("glass-only-floating")) add("glass-only-floating", file, ln, selector);
      if (isGlassBlock && (/^border(-(top|right|bottom|left))?$/.test(prop) && !/^(0|none)/.test(value) || (prop === "box-shadow" && /\binset\b/.test(value)) || (prop === "outline" && !/^(0|none)/.test(value))) && !ok("glass-no-stroke")) add("glass-no-stroke", file, ln, `${selector} { ${prop}: ${value} }`);

      if (/--ui-check(?![\w-])|--fume-amber(?![\w-])|--fume-accent-check/.test(value)) {
        if (prop === "color" && !ok("amber-is-a-point")) add("amber-is-a-point", file, ln, "Amber used as text colour");
        else if (/background/.test(prop) && (!POINT_SEL.test(selector) || /\.ui-btn|button/.test(selector)) && !ok("amber-is-a-point")) add("amber-is-a-point", file, ln, `${selector} { ${prop}: ${value} }`);
      }
    }
  }
}

function checkHtml(html, file) {
  const lines = html.split("\n");
  // classes that sit on the same element as .ui-glass (in markup or in script strings) are glass surfaces too
  const glassCo = new Set(); const clsRe = /class=\\?["']([^"']*\bui-glass\b[^"']*)["']/g; let c;
  while ((c = clsRe.exec(html))) c[1].split(/\s+/).filter((x) => x && !/^ui-glass/.test(x) && !/^(replay|is-[\w-]+)$/.test(x)).forEach((x) => glassCo.add(x));
  const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/g; let m;
  while ((m = styleRe.exec(html))) checkCss(m[1], file, lineAt(html, m.index + m[0].indexOf(">") + 1), lines, glassCo);
  const attrRe = /style="([^"]*)"/g;
  while ((m = attrRe.exec(html))) checkCss(`x{${m[1]}}`, file, lineAt(html, m.index), lines);
  // use-the-component: three or more plain buttons with aria-pressed switching a view, where the segmented control
  // or tabs belong (toolbars, filter bars and toggles are their own components and keep aria-pressed)
  const pressed = [...html.matchAll(/<button\b[^>]*>/g)].filter((b) => /aria-pressed=/.test(b[0]) && /class=["'][^"']*\bui-btn\b/.test(b[0]));
  if (pressed.length >= 3 && !/\bui-(seg|tabs|toolbar|filter|toggle|menubar)\b/.test(html)) {
    const ln = lineAt(html, pressed[0].index);
    if (!allowed(lines, ln, "use-the-component")) add("use-the-component", file, ln, `${pressed.length} buttons with aria-pressed: a segmented control or tabs`);
  }
  // copy: strip scripts, styles, tags and attributes, then look for "file"
  const text = visibleText(html);
  const wordRe = /\bfiles?\b/gi;
  while ((m = wordRe.exec(text))) { const ln = lineAt(text, m.index); if (!allowed(lines, ln, "say-creative")) add("say-creative", file, ln, m[0]); }
  // the expert checks, only the customer approves: read in the raw source, so badges built in scripts count too
  const expertRe = /\bApproved (?:by|·) (?!you\b|Marcus\b)(?=[A-Z])|\b(?:Anna|[Tt]he expert|[Aa]n expert|[Tt]he designer|[Tt]he AI|[Oo]ur AI|[Tt]he (?:Fume )?Engine|[Tt]he system|[Tt]he Quality Gate)\s+(?:has\s+)?approv/g;
  while ((m = expertRe.exec(html))) { const ln = lineAt(html, m.index); if (!allowed(lines, ln, "expert-checks")) add("expert-checks", file, ln, m[0].trim()); }
}

// The words a reader sees in markup: scripts, styles, tags and attributes blanked, line breaks kept.
export function visibleText(html) {
  return html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, (s) => s.replace(/[^\n]/g, " ")).replace(/<[^>]*>/g, (s) => s.replace(/[^\n]/g, " "));
}

// Copy that will go out (fume_check on text or markup, template content): the decided avoid list, a named actor, and
// calm punctuation. Not run over the repository, whose pages quote these words to explain them.
// Source: skills/fume-communication/references/vocabulary.md, "Avoid (decided)" (Verbal Identity v0.1, the book, RULES).
const AVOID = /\b(?:magic(?:al)?|10x|in seconds|unlimited|infinite|content at scale|assets generated|seamless(?:ly)?|effortless(?:ly)?|supercharg\w*|next-level|cutting-edge|state-of-the-art|unlock\w*|leverag\w*|optimi[sz]\w*|elevat\w*|revolutionary|game-changing|stunning|breathe life into|brand's soul|hyper-realistic|lifelike people|humanlike|AI actors?|hallucinat\w*|human-led|replace your (?:designers|agency)|curated by designers|taste included|our team of designers|compliant|guaranteed?|zero errors|fully autonomous|embers?|sparks?|ignit\w*|Fume Agent|Brand Brain|Operator Studio|Stolon|Rhizome)\b|\bhuman\s*\+\s*AI\b/gi;
const AVOID_SOFT = /\b(?:authentic|legal|prompts?|options|variations|avatars|smoke|fumes)\b/gi;
const NO_ACTOR = /\b(?:the|our) AI\b(?! Act)|\bthe system\b/gi;
const LOUD = /!|\p{Extended_Pictographic}/gu;
export function checkCopy(text, file) {
  const lines = text.split("\n"); let m;
  const scan = (re, rule, level) => { re.lastIndex = 0; while ((m = re.exec(text))) { const ln = lineAt(text, m.index); if (!allowed(lines, ln, rule)) { add(rule, file, ln, m[0]); if (level) findings[findings.length - 1].level = level; } } };
  scan(AVOID, "words-avoid");
  scan(AVOID_SOFT, "words-avoid", "warn");
  scan(NO_ACTOR, "name-the-actor");
  scan(LOUD, "no-exclamation");
}

export function checkTokens() {
  const compDir = "design-system/tokens/components";
  const comp = existsSync(join(root, compDir)) ? readdirSync(join(root, compDir)).filter((f) => f.endsWith(".tokens.json")).sort().map((f) => compDir + "/" + f) : [];
  for (const file of ["design-system/tokens/ui.tokens.json", ...comp]) checkTokenFile(file);
}
function checkTokenFile(file) {
  const p = join(root, file);
  if (!existsSync(p)) return;
  const prim = JSON.parse(readFileSync(join(root, "tokens/fume-tokens.json"), "utf8"));
  const palette = new Set(Object.values(prim.color).map((v) => String(v.value).toUpperCase()).concat("#FFFFFF"));
  const text = readFileSync(p, "utf8"); const ui = JSON.parse(text);
  (function walkT(node, path) {
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith("$")) continue;
      if (v && typeof v === "object" && "value" in v) {
        const hexes = String(v.value).match(/#[0-9a-fA-F]{6}\b/g) || [];
        for (const h of hexes) if (!palette.has(h.toUpperCase())) {
          const ln = lineAt(text, text.indexOf(`"${k}"`));
          if (!/PROPOSED/.test(v.status || "")) add("palette-only-tokens", file, ln, `${[...path, k].join(".")} = ${h}`);
          else findings.push({ rule: "palette-only-tokens", level: "info", file, line: ln, detail: `${[...path, k].join(".")} = ${h} is a PROPOSED new colour` });
        }
      } else if (v && typeof v === "object") walkT(v, [...path, k]);
    }
  })(ui, []);
}

// One text, judged as the file it would be: .css as CSS, anything else as HTML (copy is checked there too).
export function checkText(text, file) {
  if (file.endsWith(".css")) checkCss(text, file, 1, text.split("\n")); else checkHtml(text, file);
}
// The findings so far, and a clean slate for the next run.
export function takeFindings() { const f = findings; findings = []; return f; }
