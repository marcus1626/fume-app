// Renders a copy deck (the presentation JSON that check-deck.ts reads) as one Fume web-kit page, with the check
// report at the end. node tools/copy/render-deck.mjs <deck.json> <report.json> <kit-dir> <logo.svg> <out.html>
import { readFileSync, writeFileSync } from "node:fs";

const [deckPath, reportPath, kitDir, logoPath, out] = process.argv.slice(2);
const deck = JSON.parse(readFileSync(deckPath, "utf8"));
const report = reportPath === "-" ? { fields: [], findings: [], counts: null } : JSON.parse(readFileSync(reportPath, "utf8"));
const css = readFileSync(`${kitDir}/fume-web.css`, "utf8");
const js = readFileSync(`${kitDir}/fume-kit.js`, "utf8");
const logo = readFileSync(logoPath, "utf8").replace(/<\?xml[^>]*>/, "");

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const byRef = new Map(report.fields.map((f) => [f.ref, f]));
const findingsByRef = new Map();
for (const f of report.findings) findingsByRef.set(f.ref, [...(findingsByRef.get(f.ref) ?? []), f]);

function fieldMeta(ref) {
  const r = byRef.get(ref);
  if (!r) return "";
  const lim = r.limit ? ` / ${r.limit}` : "";
  if (r.format === "plain.summary") return `<span class="ui-badge ui-badge--count">${r.text.split(/\s+/).length} words</span>`;
  const warns = (findingsByRef.get(ref) ?? []).filter((f) => f.severity !== "info");
  const swap = r.swap?.verdict === "anchored" ? `<span class="ui-badge">swap test: own</span>` : r.swap?.verdict === "generic" ? `<span class="ui-badge">swap test: generic</span>` : "";
  return `<span class="ui-badge ui-badge--count">${r.chars}${lim}</span>${swap}${warns.map((w) => `<span class="cd-note">${esc(w.message)}</span>`).join("")}`;
}

function piece(p) {
  const rows = p.fields.map((f) => `<tr><th scope="row">${esc(f.label ?? f.format)}</th><td class="cd-copy">${esc(f.text)}</td><td class="cd-meta">${fieldMeta(f.ref)}</td></tr>`).join("");
  return `<div class="ui-card ui-card--lg cd-block"><h4 class="web-title">${esc(p.title ?? p.id)}</h4>${p.job ? `<p class="web-text cd-job">Job: ${esc(p.job)}</p>` : ""}<table class="cd-table">${rows}</table></div>`;
}

function table(head, rows) {
  return `<div class="cd-scroll"><table class="cd-table cd-grid"><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function block(b) {
  switch (b.type) {
    case "text": return `<div class="web-text cd-prose">${b.html}</div>`;
    case "h3": return `<h3 class="web-title cd-h3">${esc(b.text)}</h3>`;
    case "cards": return `<div class="web-grid web-grid--2">${b.cards.map((c) => `<div class="ui-card ui-card--lg"><h3 class="web-title">${esc(c.title)}</h3><p class="web-text">${esc(c.text)}</p></div>`).join("")}</div>`;
    case "piece": return piece(b.piece);
    case "table": return table(b.head, b.rows);
    case "visual": return `<div class="ui-card ui-card--lg cd-block"><p class="web-eyebrow">The visual</p><p class="web-text">${esc(b.text)}</p></div>`;
    case "list": return `<ul class="web-text cd-list">${b.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
    case "beats": return table(["Beat", "Seconds", "What we see", "What is said", "Text on screen"], b.rows.map((r) => [r.beat, r.s, r.see, r.said || "(no voice)", r.screen]));
    default: return "";
  }
}

let warm = true;
const sections = deck.sections.map((s) => {
  warm = !warm;
  return `<section class="web-section${warm ? " web-section--warm" : ""}" id="${s.id}"><div class="web-wrap"><p class="web-eyebrow">${esc(s.eyebrow)}</p><h2 class="web-display">${esc(s.title)}</h2><div class="web-group cd-stack">${s.blocks.map(block).join("\n")}</div></div></section>`;
});

const c = report.counts ?? {};
const warnRows = report.findings.filter((f) => f.severity === "warn").map((f) => [f.ref, f.message]);
const checkSection = !report.counts ? "" : `<section class="web-section${!warm ? " web-section--warm" : ""}" id="check"><div class="web-wrap"><p class="web-eyebrow">How we checked every line</p><h2 class="web-display">${c.fields} lines. ${c.error} errors.</h2><p class="web-lede">Before a person read it, code checked every line: its character limit, quotes word for word, no number without a source, no price or savings claim, no stock phrases, and the swap test. ${c.warn} warnings are left for you to judge; we kept them on purpose or flag them below.</p><div class="web-group cd-stack">${table(["Line", "Warning"], warnRows)}</div></div></section>`;

const html = `<!doctype html>
<html lang="${deck.lang ?? "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(deck.file ?? deck.campaign)}</title>
<style>${css}
.cd-stack { display: grid; gap: var(--ui-space-lg); }
.cd-h3 { margin-top: var(--ui-space-xl); }
.cd-block .web-title { margin-bottom: var(--ui-space-sm); }
.cd-job { color: var(--ui-text-secondary); margin-bottom: var(--ui-space-md); }
.cd-scroll { overflow-x: auto; }
.cd-table { width: 100%; border-collapse: collapse; font-size: var(--ui-type-body); }
.cd-table th, .cd-table td { text-align: left; vertical-align: top; padding: var(--ui-space-md) var(--ui-space-md) var(--ui-space-md) 0; }
.cd-grid td, .cd-grid th { padding-left: var(--ui-space-md); }
.cd-grid tbody tr:nth-child(odd) td { background: var(--ui-surface-sunken); }
.cd-table th[scope="row"] { color: var(--ui-text-secondary); font-weight: var(--ui-type-weight-medium); width: 22%; }
.cd-grid thead th { color: var(--ui-text-secondary); font-weight: var(--ui-type-weight-medium); }
.cd-copy { font-size: var(--ui-type-body-large); width: 50%; }
.cd-meta { width: 28%; }
.cd-meta .ui-badge { margin: 0 var(--ui-space-xs) var(--ui-space-xs) 0; }
.cd-note { display: block; color: var(--ui-text-tertiary); margin-top: var(--ui-space-xs); }
.cd-prose p + p { margin-top: var(--ui-space-sm); }
.cd-list { padding-left: var(--ui-space-lg); display: grid; gap: var(--ui-space-xs); }
@media (max-width: 720px) {
  .cd-table th[scope="row"], .cd-copy, .cd-meta { display: block; width: auto; padding-top: 0; }
  .cd-table tr { display: block; padding-top: var(--ui-space-md); }
}
</style></head>
<body class="web-page">
<div class="web-section web-section--warm web-section--light web-hero">
  <fume-light name="L1"></fume-light>
  <header class="web-header"><div class="web-wrap"><span class="web-logo" aria-label="Fume">${logo}</span>${report.counts ? `<a class="ui-btn ui-btn--secondary" href="#check">How we checked it</a>` : ""}</div></header>
  <main class="web-wrap">
    <p class="web-eyebrow">${esc(deck.eyebrow ?? `${deck.brand} · ${deck.campaign}`)}</p>
    <h1 class="web-display web-display--hero">${esc(deck.heroTitle ?? deck.campaign)}</h1>
    <p class="web-lede">${esc(deck.status)}</p>
    ${deck.actions ? `<div class="web-actions">${deck.actions.map((a, i) => `<a class="ui-btn ${i ? "ui-btn--secondary" : "ui-btn--primary"} ui-btn--lg" href="${a.href}">${esc(a.label)}</a>`).join("")}</div>` : ""}
  </main>
</div>
${sections.join("\n")}
${checkSection}
<footer class="web-footer"><div class="web-wrap"><span>Fume · ${esc(deck.footer ?? `${deck.file ?? ""} · draft, not sent`)}</span></div></footer>
<script>${js}</script>
</body></html>`;
writeFileSync(out, html);
console.log(`wrote ${out} (${Math.round(html.length / 1024)} KB)`);
