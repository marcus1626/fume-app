// Chart: area, line, bar (grouped, stacked, rows), donut and sparkline, drawn as dependency-free inline SVG
// from data. DECIDED 13 Oct, from round 8. Built on shadcn's chart: ChartContainer with a config of series (each a label
// and a colour as a CSS variable), ChartTooltip and ChartTooltipContent, ChartLegend and ChartLegendContent.
// As in shadcn's ChartStyle, each series colour becomes --color-<key> on the container, so chart.css can
// later sit under Recharts too. Markup:
//   <div class="ui-chart" data-ui-chart>
//     <script type="application/json">{
//       "type": "area", "title": "Creatives per week", "xKey": "week", "xFormat": "week", "legend": true,
//       "config": { "generated": { "label": "Generated", "color": "var(--ui-chart-series-1)" }, ... },
//       "data": [ { "week": "2026-07-20", "generated": 531, "approved": 452 }, ... ] }</script>
//   </div>
// type: area | line | bar | donut | spark. Options: "summary" (the SVG's desc; written from the data when
// left out), "point" (what one point is called: week, campaign), "xLabel", "unit" ("%"), "format"
// ("minutes"), "max" (a fixed top of the scale), "endLabels" (false to drop the last values on lines).
// bar: "stack": true|false, "orientation": "auto"|"vertical"|"horizontal" (auto turns columns into rows
// when the names no longer fit, as on a phone), "track": true (a sunken track to "max" behind each row).
// donut: "nameKey", "dataKey", "centerLabel". spark: "dataKey"; no axes, no tooltip, an aria-label only.
// "legend": true adds the pill toggles (ChartLegend) above the plot, into a [data-ui-chart-legend] element
// when the container holds one (a .ui-chart-toolbar with a view switch beside it), else as its first row.
// .ui-chart--fill on the container lets the plot take the height its card is stretched to (a dashboard).
// On the container: data-state="loading|empty|error" shows that state in the chart's size (copy from
// data-empty-title, data-empty-description, data-empty-action, data-error-title, data-error-description);
// data-active="<index>" keeps one point open (a frozen tooltip); data-motion="reduce" draws at once.
// Behaviour: legend pills toggle series (aria-pressed; one always stays on; the scale never moves). Pointer,
// touch (press and drag) and keyboard (focus the plot, then the arrow keys, Home, End, Escape) move through
// the points: a soft band marks the point (with the focus ring from the keyboard) and the Smoke glass
// tooltip shows the date and every series (name, value in the data type) beside the band, clear of the
// lines, or above the finger on touch; a live region says it in words; a visually
// hidden table holds every value. On first draw lines draw in, bars grow and the donut sweeps round
// (--ui-chart-draw); stacked and grouped morph into each other; reduced motion draws at once. Re-renders
// on window resize, and once after the first draw when a plot's box changed (a --fill plot stretched by
// its neighbours). No ResizeObserver: rows write the height they read.
// window.fumeChart(root) sets up every [data-ui-chart] under root (safe to call again and to load twice);
// window.fumeChart.get(el) returns { setActive(i), toggle(key, on), set(options), setState(state), draw() }.
// Events (bubbling, on the container): "fume:chart-toggle" { key, on }, "fume:chart-active" { index },
// "fume:chart-retry" (the error state's Try again).
(() => {
  if (window.fumeChart) return;
  const NS = "http://www.w3.org/2000/svg";
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const nf = new Intl.NumberFormat("en-GB");
  const all = [];
  const reduceMQ = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  let uid = 0, ctx2d = null;

  // ---------- helpers ----------
  const f = (n) => Math.round(n * 100) / 100;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const h = (tag, cls, parent) => { const n = document.createElement(tag); if (cls) n.className = cls; if (parent) parent.appendChild(n); return n; };
  const s = (tag, attrs, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  const color = (n, key) => { n.style.setProperty("--c", "var(--color-" + key + ")"); return n; };
  const cssVal = (node, name) => getComputedStyle(node).getPropertyValue(name).trim();
  const cssPx = (node, name, fb) => { const n = parseFloat(cssVal(node, name)); return isFinite(n) ? n : fb; };
  const cssMs = (node, name, fb) => { const v = cssVal(node, name), n = parseFloat(v); return !isFinite(n) ? fb : /ms$/.test(v) ? n : /s$/.test(v) ? n * 1000 : n; };
  const measure = (text, font) => { if (!ctx2d) ctx2d = document.createElement("canvas").getContext("2d"); ctx2d.font = font; return ctx2d.measureText(String(text)).width; };
  const fontOf = (svg, cls) => { const p = s("text", { class: cls }, svg); const cs = getComputedStyle(p); const font = cs.fontStyle + " " + cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily; p.remove(); return font; };
  const reduced = (el) => el.getAttribute("data-motion") === "reduce" || !!(reduceMQ && reduceMQ.matches);
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const max = (a) => a.reduce((x, y) => Math.max(x, y), 0);
  const day = (v) => { const p = String(v).split("-"); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] || 1)); };

  // round ticks from zero, in steps of 1, 2, 2.5 or 5 x 10^n (2.5 only from 25 up, so counts stay whole).
  // Of the steps that give at most `most` intervals, the one whose last tick sits closest above the top
  // wins (786 ends at 800, not 1,000); three or more intervals before two; then the fewer.
  const before = (a, b) => { for (let j = 0; j < a.length; j++) if (a[j] !== b[j]) return a[j] < b[j]; return false; };
  function nice(top, most) {
    if (!(top > 0)) return { max: 1, ticks: [0, 1] };
    most = Math.max(2, Math.floor(most) || 2);
    let best = null;
    const e0 = Math.floor(Math.log10(top / most)) - 1;
    for (let e = e0; e <= e0 + 3; e++) for (const k of [1, 2, 2.5, 5]) {
      if (k === 2.5 && e < 1) continue;
      const step = k * Math.pow(10, e), n = Math.ceil(top / step - 1e-9);
      if (n < 2 || n > most) continue;
      const score = [n < 3 ? 1 : 0, n * step, n];
      if (!best || before(score, best.score)) best = { step, n, score };
    }
    if (!best) { const step = Math.pow(10, Math.ceil(Math.log10(top))); best = { step, n: 1 }; }
    const ticks = [];
    for (let i = 0; i <= best.n; i++) ticks.push(Math.round(i * best.step * 1e6) / 1e6);
    return { max: best.n * best.step, ticks };
  }
  // how many intervals a scale of this height can hold with its tick words well apart
  const room = (span) => clamp(Math.floor(span / 36), 2, 5);
  // a monotone curve through the points: smooth, and it never overshoots a value (d3 curveMonotoneX)
  function monotone(p) {
    const n = p.length;
    if (!n) return "";
    if (n < 3) return "M" + p.map((q) => f(q[0]) + "," + f(q[1])).join("L");
    const dx = [], m = [], t = [];
    for (let i = 0; i < n - 1; i++) { dx[i] = p[i + 1][0] - p[i][0]; m[i] = dx[i] ? (p[i + 1][1] - p[i][1]) / dx[i] : 0; }
    for (let i = 1; i < n - 1; i++) {
      const pm = (m[i - 1] * dx[i] + m[i] * dx[i - 1]) / (dx[i - 1] + dx[i]);
      t[i] = (Math.sign(m[i - 1]) + Math.sign(m[i])) * Math.min(Math.abs(m[i - 1]), Math.abs(m[i]), 0.5 * Math.abs(pm)) || 0;
    }
    t[0] = (3 * m[0] - t[1]) / 2; t[n - 1] = (3 * m[n - 2] - t[n - 2]) / 2;
    let d = "M" + f(p[0][0]) + "," + f(p[0][1]);
    for (let i = 0; i < n - 1; i++) {
      const k = dx[i] / 3;
      d += "C" + f(p[i][0] + k) + "," + f(p[i][1] + k * t[i]) + "," + f(p[i + 1][0] - k) + "," + f(p[i + 1][1] - k * t[i + 1]) + "," + f(p[i + 1][0]) + "," + f(p[i + 1][1]);
    }
    return d;
  }
  // bars: the data end rounded, the baseline end square; same commands at any size, so CSS can morph d
  function barUp(x, y, w, hh, r) {
    r = Math.max(0, Math.min(r, w / 2, hh)); const b = y + hh, x1 = x + w;
    return "M" + f(x) + "," + f(b) + "V" + f(y + r) + "A" + f(r) + "," + f(r) + " 0 0 1 " + f(x + r) + "," + f(y) + "H" + f(x1 - r) + "A" + f(r) + "," + f(r) + " 0 0 1 " + f(x1) + "," + f(y + r) + "V" + f(b) + "Z";
  }
  function barRight(x, y, w, hh, r, r0) {
    r = Math.max(0, Math.min(r, hh / 2, w)); r0 = Math.max(0, Math.min(r0 || 0, hh / 2, w)); const x1 = x + w, y1 = y + hh;
    return "M" + f(x + r0) + "," + f(y) + "H" + f(x1 - r) + "A" + f(r) + "," + f(r) + " 0 0 1 " + f(x1) + "," + f(y + r) + "V" + f(y1 - r) + "A" + f(r) + "," + f(r) + " 0 0 1 " + f(x1 - r) + "," + f(y1) +
      "H" + f(x + r0) + "A" + f(r0) + "," + f(r0) + " 0 0 1 " + f(x) + "," + f(y1 - r0) + "V" + f(y + r0) + "A" + f(r0) + "," + f(r0) + " 0 0 1 " + f(x + r0) + "," + f(y) + "Z";
  }
  // split a name over at most two lines, at the space that balances them
  function wrap(name, font, room) {
    if (measure(name, font) <= room) return [name];
    const w = name.split(" "); if (w.length < 2) return [name];
    let best = null;
    for (let i = 1; i < w.length; i++) {
      const a = w.slice(0, i).join(" "), b = w.slice(i).join(" "), m = Math.max(measure(a, font), measure(b, font));
      if (!best || m < best.m) best = { m, lines: [a, b] };
    }
    return best.lines;
  }
  // percentages that add up to 100 (largest remainder)
  function shares(vals) {
    const tot = sum(vals) || 1, raw = vals.map((v) => (v / tot) * 100), out = raw.map(Math.floor);
    let left = 100 - sum(out);
    raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { out[i]++; left--; } });
    return out;
  }

  // ---------- words ----------
  const label = (c, k) => (c.cfg.config[k] && c.cfg.config[k].label) || k;
  function fmtV(cfg, v) {
    if (v == null || !isFinite(v)) return "–";
    if (cfg.format === "minutes") { const hh = Math.floor(v / 60), mm = Math.round(v % 60); return (hh ? hh + " h " : "") + mm + " min"; }
    return nf.format(v) + (cfg.unit || "");
  }
  function fmtX(cfg, v, mode) {
    if (cfg.xFormat === "week" || cfg.xFormat === "date") {
      const a = day(v);
      if (mode === "spoken") return (cfg.xFormat === "week" ? "Week of " : "") + a.getUTCDate() + " " + MONTH[a.getUTCMonth()];
      if (cfg.xFormat === "date" || mode === "tick") return a.getUTCDate() + " " + MON[a.getUTCMonth()];
      const b = new Date(a.getTime() + 6 * 864e5);
      return a.getUTCMonth() === b.getUTCMonth() ? a.getUTCDate() + "–" + b.getUTCDate() + " " + MON[b.getUTCMonth()]
        : a.getUTCDate() + " " + MON[a.getUTCMonth()] + " – " + b.getUTCDate() + " " + MON[b.getUTCMonth()];
    }
    return String(v);
  }
  const lower1 = (t) => t.charAt(0).toLowerCase() + t.slice(1); // "Week of 5 October" inside a sentence; month names keep their capital
  function summary(c) {
    const cfg = c.cfg, d = cfg.data || [];
    if (cfg.summary) return cfg.summary;
    if (!d.length) return "";
    if (c.type === "donut") {
      const vals = d.map((r) => +r[cfg.dataKey] || 0), sh = shares(vals);
      return d.map((r, i) => label(c, r[cfg.nameKey]) + " " + nf.format(vals[i]) + " (" + sh[i] + "%)").join(", ") + "; " + nf.format(sum(vals)) + " in all.";
    }
    if (c.type === "bar") {
      const tot = d.map((r) => sum(c.keys.map((k) => +r[k] || 0))), i = tot.indexOf(max(tot));
      return d.length + " " + (cfg.point || "item") + "s. Highest: " + d[i][cfg.xKey] + ", " + fmtV(cfg, tot[i]) + ".";
    }
    const vals = (k) => d.map((r) => (typeof r === "number" ? r : +r[k]));
    return c.keys.map((k) => label(c, k) + " from " + fmtV(cfg, vals(k)[0]) + " to " + fmtV(cfg, vals(k)[d.length - 1])).join("; ") +
      (cfg.xKey ? ", from the " + lower1(fmtX(cfg, d[0][cfg.xKey], "spoken")) + " to the " + lower1(fmtX(cfg, d[d.length - 1][cfg.xKey], "spoken")) : "") + ".";
  }
  function spoken(c, i) {
    const cfg = c.cfg, r = cfg.data[i];
    if (c.type === "donut") { const vals = cfg.data.map((x) => +x[cfg.dataKey] || 0); return label(c, r[cfg.nameKey]) + ": " + fmtV(cfg, vals[i]) + ", " + shares(vals)[i] + "%."; }
    const vis = c.keys.filter((k) => !c.hidden[k]);
    let t = fmtX(cfg, r[cfg.xKey], "spoken") + ": " + vis.map((k) => label(c, k) + " " + fmtV(cfg, +r[k])).join(", ");
    if (cfg.stack && vis.length > 1) t += ", total " + fmtV(cfg, sum(vis.map((k) => +r[k] || 0)));
    return t + ".";
  }

  // ---------- set up ----------
  function make(el) {
    let cfg = {};
    const src = el.querySelector(':scope > script[type="application/json"]');
    try { cfg = JSON.parse(src ? src.textContent : el.getAttribute("data-config") || "{}"); } catch (e) { cfg = {}; }
    cfg.config = cfg.config || {}; cfg.data = cfg.data || [];
    const c = { el, cfg, type: cfg.type || "line", hidden: {}, active: -1, pinned: null, id: "ui-chart-" + ++uid, w: -1, old: {}, morph: null };
    c.keys = Object.keys(cfg.config).filter((k) => /^[\w-]+$/.test(k));
    c.keys.forEach((k, i) => el.style.setProperty("--color-" + k, cfg.config[k].color || "var(--ui-chart-series-" + Math.min(i + 1, 4) + ")"));
    if (el.hasAttribute("data-active")) c.pinned = +el.getAttribute("data-active");
    el.classList.add("ui-chart", "ui-chart--" + c.type);
    el.setAttribute("data-slot", "chart"); el.setAttribute("data-chart", c.id);

    if (cfg.legend && c.type !== "donut" && c.type !== "spark") {
      c.legend = el.querySelector("[data-ui-chart-legend]") || h("div", "", el);
      c.legend.classList.add("ui-chart-legend");
      c.legend.setAttribute("role", "group"); c.legend.setAttribute("aria-label", "Series in " + (cfg.title || "the chart"));
      c.legend.setAttribute("data-slot", "chart-legend");
      c.keys.forEach((k) => {
        const b = h("button", "ui-chart-legend-item", c.legend);
        b.type = "button"; b.setAttribute("aria-pressed", "true"); b.setAttribute("data-state", "on"); b.setAttribute("data-key", k);
        color(h("span", "ui-chart-legend-swatch", b), k).setAttribute("aria-hidden", "true");
        h("span", "", b).textContent = label(c, k);
        b.addEventListener("click", () => toggle(c, k));
      });
    }
    const host = c.type === "donut" ? (c.body = h("div", "ui-chart-body", el)) : el;
    c.frame = h("div", "ui-chart-frame", host);
    c.cursor = h("div", "ui-chart-cursor", c.frame);
    c.svg = s("svg", { class: "ui-chart-svg", role: "img", "aria-labelledby": c.id + "-t " + c.id + "-d", focusable: "false" }, c.frame);
    if (c.type !== "spark") {
      c.plot = h("div", "ui-chart-plot", c.frame);
      c.plot.tabIndex = 0; c.plot.setAttribute("role", "group"); c.plot.setAttribute("aria-roledescription", "chart");
      c.plot.setAttribute("aria-label", (cfg.title || "Chart") + ". Arrow keys read each " + (cfg.point || "point") + ".");
      c.tipBox = h("div", "ui-chart-tip", c.frame);
      c.tip = h("div", "ui-glass ui-glass--small ui-chart-tooltip", c.tipBox);
      c.tip.setAttribute("data-slot", "chart-tooltip"); c.tip.hidden = true;
      c.table = h("table", "", h("div", "ui-chart-sr", el)); // a table sizes to its content: the 1 px box is its wrapper
      c.live = h("p", "ui-chart-sr", el); c.live.setAttribute("aria-live", "polite");
      events(c);
    }
    if (c.type === "donut") {
      c.center = h("div", "ui-chart-donut-center", c.frame); c.center.setAttribute("aria-hidden", "true");
      c.centerNum = h("span", "ui-chart-donut-num", c.center); c.centerCap = h("span", "ui-chart-donut-caption", c.center);
      c.list = h("ul", "ui-chart-legend ui-chart-legend--list", c.body); c.list.setAttribute("data-slot", "chart-legend");
      c.list.addEventListener("pointerover", (e) => { const li = e.target.closest("[data-index]"); if (li && e.pointerType === "mouse") setActive(c, +li.getAttribute("data-index")); });
      c.list.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse" && !c.focused) clearActive(c); });
    }
    c.api = {
      setActive: (i) => (i == null || i < 0 ? clearActive(c) : setActive(c, i)),
      toggle: (k, on) => toggle(c, k, on),
      set: (o) => { Object.assign(c.cfg, o); render(c, true); },
      setState: (st) => { if (st) el.setAttribute("data-state", st); else el.removeAttribute("data-state"); render(c, false); if (!st) draw(c); },
      draw: () => draw(c),
      render: () => render(c, false),
    };
    el._fumeChart = c;
    all.push(c);
    return c;
  }

  // ---------- render ----------
  function render(c, animate) {
    const el = c.el, state = el.getAttribute("data-state");
    if (c.stateNode) { c.stateNode.remove(); c.stateNode = null; }
    if (c.skel) { c.skel.remove(); c.skel = null; }
    el.removeAttribute("aria-busy");
    (c.body || c.frame).hidden = false;
    const W = c.frame.clientWidth;
    if (!W && !state) { c.w = 0; return; }
    c.old = {};
    if (animate) c.svg.querySelectorAll("[data-k]").forEach((n) => { c.old[n.getAttribute("data-k")] = { d: n.getAttribute("d"), t: n.style.transform }; });
    c.svg.textContent = "";
    s("title", { id: c.id + "-t" }, c.svg).textContent = c.cfg.title || "Chart";
    const desc = s("desc", { id: c.id + "-d" }, c.svg); desc.textContent = summary(c);
    c.morph = animate ? [] : null;
    el.classList.toggle("is-placing", !animate);
    if (state) { renderState(c, state); c.w = W; c.lastW = c.type === "bar" ? el.clientWidth : W; c.lastH = c.frame.clientHeight; return; }
    if (c.type === "area" || c.type === "line") xy(c, W);
    else if (c.type === "bar") bars(c);
    else if (c.type === "donut") donut(c);
    else if (c.type === "spark") spark(c, W);
    c.w = c.frame.clientWidth || W;
    c.lastW = c.type === "bar" ? el.clientWidth : c.w;
    c.lastH = c.frame.clientHeight;
    if (c.morph && c.morph.length) {
      c.svg.getBoundingClientRect(); // commit the old shapes, then move to the new ones
      c.morph.forEach(([n, prop, v]) => { if (prop === "d") n.style.d = 'path("' + v + '")'; else n.style.transform = v; });
    }
    c.morph = null;
    if (!animate) requestAnimationFrame(() => el.classList.remove("is-placing"));
    if (c.table) table(c);
    if (c.active >= 0) setActive(c, c.active); else if (c.pinned != null) setActive(c, c.pinned); else clearActive(c);
  }
  // a mark that keeps its key across renders, so it can move to its new place (stacked <-> grouped, toggles)
  function keyed(c, node, key, prop, val) {
    node.setAttribute("data-k", key);
    if (prop === "d") node.setAttribute("d", val);
    const o = c.old[key], from = o && (prop === "d" ? o.d : o.t);
    if (c.morph && from) {
      if (prop === "d") node.style.d = 'path("' + from + '")'; else node.style.transform = from;
      c.morph.push([node, prop, val]);
    } else if (prop === "d") node.style.d = 'path("' + val + '")';
    else node.style.transform = val;
    return node;
  }
  function text(parent, cls, x, y, str, anchor) {
    const t = s("text", { class: cls, x: f(x), y: f(y), "text-anchor": anchor || "start", "dominant-baseline": "central" }, parent);
    t.textContent = str;
    return t;
  }
  function dot(parent, x, y, key, r, cls) {
    return color(s("circle", { class: "ui-chart-dot" + (cls || ""), cx: f(x), cy: f(y), r: f(r), "data-series": key }, parent), key);
  }
  function metrics(c) {
    const el = c.el;
    return {
      gap: cssPx(el, "--ui-chart-tick-gap", 8), point: cssPx(el, "--ui-chart-point", 8), ring: cssPx(el, "--ui-chart-gap", 2),
      barMax: cssPx(el, "--ui-chart-bar-max", 24), barGrouped: cssPx(el, "--ui-chart-bar-grouped", 16), barRow: cssPx(el, "--ui-chart-bar-row", 12),
      radius: cssPx(el, "--ui-chart-bar-radius", 4), rowGap: cssPx(el, "--ui-space-xl", 24), line: 16,
    };
  }

  // area and line: weeks across, one scale from zero, ticks at round values, the last values labelled
  function xy(c, W) {
    const cfg = c.cfg, d = cfg.data, n = d.length, svg = c.svg, M = metrics(c), H = c.frame.clientHeight;
    const font = fontOf(svg, "ui-chart-data");
    const top = Math.max(M.line / 2, M.point / 2 + M.ring), bottom = H - M.line - M.gap;
    const sc = nice(cfg.max || max(d.map((r) => max(c.keys.map((k) => +r[k] || 0)))), room(bottom - top));
    const left = Math.ceil(max(sc.ticks.map((t) => measure(fmtV(cfg, t), font))) + M.gap);
    const endW = cfg.endLabels === false ? 0 : max(c.keys.map((k) => measure(fmtV(cfg, +d[n - 1][k]), font)));
    const right = endW ? Math.ceil(M.point / 2 + M.ring + M.gap + endW) : M.point / 2 + M.ring;
    const plotW = Math.max(16, W - left - right), step = n > 1 ? plotW / (n - 1) : plotW;
    const X = (i) => left + (n > 1 ? i * step : plotW / 2), Y = (v) => top + (1 - v / sc.max) * (bottom - top);
    const marks = (i) => { const ys = visibleKeys(c).map((k) => Y(+d[i][k] || 0)); return [Math.min(...ys), Math.max(...ys)]; };
    c.geo = { kind: "xy", n, X, Y, top, bottom, left, right: left + plotW, step, W, cx: X, marks };
    const gT = s("g", { "aria-hidden": "true" }, svg);
    sc.ticks.forEach((t) => text(gT, "ui-chart-data", left - M.gap, Y(t), fmtV(cfg, t), "end"));
    // dates under the plot, thinned so they never collide and never more than seven; the latest is always there
    const labels = d.map((r) => fmtX(cfg, r[cfg.xKey], "tick")), lw = max(labels.map((l) => measure(l, font)));
    const every = [1, 2, 3, 4, 6, 12].find((k) => k * step >= lw + M.gap * 2 && Math.ceil(n / k) <= 7) || n;
    for (let i = n - 1; i >= 0; i -= every) {
      const w = measure(labels[i], font);
      text(gT, "ui-chart-data", clamp(X(i), w / 2, W - w / 2), bottom + M.gap + M.line / 2, labels[i], "middle");
    }
    const gA = s("g", {}, svg), gL = s("g", {}, svg), gP = s("g", {}, svg);
    const ends = [];
    c.keys.forEach((k) => {
      const pts = d.map((r, i) => [X(i), Y(+r[k] || 0)]), line = monotone(pts), off = c.hidden[k] ? " is-off" : "";
      if (c.type === "area") color(s("path", { class: "ui-chart-area" + off, d: line + "L" + f(X(n - 1)) + "," + f(Y(0)) + "L" + f(X(0)) + "," + f(Y(0)) + "Z", "data-series": k }, gA), k);
      color(s("path", { class: "ui-chart-line" + off, d: line, pathLength: "1", "data-series": k }, gL), k);
      ends.push({ k, y: pts[n - 1][1], v: +d[n - 1][k], off });
    });
    // the last value of each line, labelled beside its point; a label that would touch another is left to the tooltip
    let last = -Infinity;
    ends.sort((a, b) => a.y - b.y).forEach((e) => {
      dot(gP, X(n - 1), e.y, e.k, M.point / 2 + M.ring / 2, e.off);
      if (endW && e.y - last >= M.line) { color(text(gP, "ui-chart-data ui-chart-data--label" + e.off, X(n - 1) + M.point / 2 + M.ring + M.gap, e.y, fmtV(cfg, e.v)), e.k).setAttribute("data-series", e.k); last = e.y; }
    });
    c.gActive = s("g", {}, svg);
  }

  // bars: columns on a baseline, or rows when the names no longer fit
  function bars(c) {
    const cfg = c.cfg, d = cfg.data, n = d.length, M = metrics(c);
    const fontN = fontOf(c.svg, "ui-chart-name");
    const avail = c.el.clientWidth, slot0 = avail / Math.max(n, 1);
    let orient = cfg.orientation || "auto";
    if (orient === "auto") {
      const fits = slot0 >= 56 && d.every((r) => { const l = wrap(String(r[cfg.xKey]), fontN, slot0 - M.gap * 2); return l.length <= 2 && l.every((x) => measure(x, fontN) <= slot0 - M.gap * 2); });
      orient = fits ? "vertical" : "horizontal";
    }
    c.frame.classList.toggle("ui-chart-frame--rows", orient === "horizontal");
    if (orient === "horizontal") rows(c, M); else { c.frame.style.height = ""; columns(c, M, fontN); }
  }
  const visibleKeys = (c) => c.keys.filter((k) => !c.hidden[k]);
  const scaleTop = (c) => {
    const d = c.cfg.data;
    if (c.cfg.max) return c.cfg.max;
    return c.cfg.stack ? max(d.map((r) => sum(c.keys.map((k) => +r[k] || 0)))) : max(d.map((r) => max(c.keys.map((k) => +r[k] || 0))));
  };
  function columns(c, M, fontN) {
    const cfg = c.cfg, d = cfg.data, n = d.length, svg = c.svg, W = c.frame.clientWidth, H = c.frame.clientHeight, stack = !!cfg.stack;
    const font = fontOf(svg, "ui-chart-data");
    // stacked columns carry their totals and no ticks, so the scale ends at the tallest; grouped ones get round ticks
    const sc = stack ? { max: scaleTop(c), ticks: [] } : nice(scaleTop(c), room(H - M.line * 3));
    const left = stack ? 0 : Math.ceil(max(sc.ticks.map((t) => measure(fmtV(cfg, t), font))) + M.gap);
    const slot = (W - left) / n;
    const names = d.map((r) => wrap(String(r[cfg.xKey]), fontN, slot - M.gap * 2)), lines = max(names.map((l) => l.length));
    const bottom = Math.round(H - lines * M.line - M.gap), top = stack ? M.line + M.gap : M.line / 2;
    const Y = (v) => bottom - (v / sc.max) * (bottom - top), vis = visibleKeys(c), m = vis.length;
    const bw = stack ? Math.min(M.barMax, slot * 0.5) : Math.min(M.barGrouped, (slot * 0.72 - M.ring * (m - 1)) / Math.max(m, 1));
    const tops = d.map((r) => Y(stack ? sum(vis.map((k) => +r[k] || 0)) : max(vis.map((k) => +r[k] || 0))));
    c.geo = { kind: "cols", n, left, slot, top, bottom, W, cx: (i) => left + slot * (i + 0.5), step: slot, marks: (i) => [tops[i], bottom] };
    const gT = s("g", { "aria-hidden": "true" }, svg);
    if (!stack) sc.ticks.forEach((t) => text(gT, "ui-chart-data", left - M.gap, Y(t), fmtV(cfg, t), "end"));
    names.forEach((l, i) => l.forEach((line, j) => text(gT, "ui-chart-name", left + slot * (i + 0.5), bottom + M.gap + M.line * (j + 0.5), line, "middle")));
    s("line", { class: "ui-chart-baseline", x1: left, x2: W, y1: bottom + 0.5, y2: bottom + 0.5 }, svg);
    const gB = s("g", {}, svg), gV = s("g", {}, svg);
    d.forEach((r, i) => {
      const cx = left + slot * (i + 0.5), g = s("g", { class: "ui-chart-grow" }, gB);
      g.style.setProperty("--i", i);
      let acc = 0;
      if (stack) {
        const live = vis.filter((k) => (+r[k] || 0) > 0), topKey = live[live.length - 1];
        c.keys.forEach((k) => {
          const v = c.hidden[k] ? 0 : +r[k] || 0, y1 = Y(acc), y0 = Y(acc + v), isTop = k === topKey, cut = v && !isTop ? M.ring : 0;
          acc += v;
          keyed(c, color(s("path", { class: "ui-chart-bar" + (v ? "" : " is-off"), "data-series": k }, g), k), i + "|" + k, "d", barUp(cx - bw / 2, y0 + cut, bw, Math.max(0, y1 - y0 - cut), isTop ? M.radius : 0));
        });
      } else {
        const gw = m * bw + (m - 1) * M.ring; let j = 0;
        c.keys.forEach((k) => {
          const hid = !!c.hidden[k], v = hid ? 0 : +r[k] || 0, x = hid ? cx - bw / 2 : cx - gw / 2 + j++ * (bw + M.ring), hh = bottom - Y(v);
          acc += v;
          keyed(c, color(s("path", { class: "ui-chart-bar" + (v ? "" : " is-off"), "data-series": k }, g), k), i + "|" + k, "d", barUp(x, bottom - hh, bw, hh, M.radius));
        });
      }
      // the total on top of each column (stacked only); it glides with the bars
      const t = text(gV, "ui-chart-data ui-chart-data--label ui-chart-data--total" + (stack ? "" : " is-off"), 0, 0, fmtV(cfg, acc), "middle");
      keyed(c, t, "total|" + i, "transform", "translate(" + f(cx) + "px, " + f(Y(acc) - M.gap - M.line / 2) + "px)");
    });
  }
  function rows(c, M) {
    const cfg = c.cfg, d = cfg.data, n = d.length, svg = c.svg, W = c.frame.clientWidth, stack = !!cfg.stack, vis = visibleKeys(c), m = vis.length;
    const single = c.keys.length === 1, grouped = !stack && !single;
    const subH = Math.round(M.barRow * 2 / 3), barH = grouped ? m * subH + (m - 1) * M.ring : M.barRow;
    const rowH = M.line + M.gap + barH, band = grouped ? M.line + M.gap : 0;
    const H = n * rowH + (n - 1) * M.rowGap + band;
    c.frame.style.height = H + "px";
    const x0 = M.gap, x1 = W - M.gap, sc = grouped ? nice(scaleTop(c), 3) : { max: scaleTop(c), ticks: [] };
    const X = (v) => x0 + (v / sc.max) * (x1 - x0), top = (i) => i * (rowH + M.rowGap);
    c.geo = { kind: "rows", n, top, rowH, W, x0, x1 };
    const gT = s("g", { "aria-hidden": "true" }, svg), gB = s("g", {}, svg);
    d.forEach((r, i) => {
      const y = top(i), by = y + M.line + M.gap;
      text(gT, "ui-chart-name ui-chart-name--strong", x0, y + M.line / 2, String(r[cfg.xKey]), "start");
      if (cfg.track) s("path", { class: "ui-chart-track", d: barRight(x0, by, x1 - x0, barH, barH / 2, barH / 2) }, gB);
      const g = s("g", { class: "ui-chart-grow ui-chart-grow--x" }, gB); g.style.setProperty("--i", i);
      let acc = 0;
      if (grouped) {
        let j = 0;
        c.keys.forEach((k) => {
          const hid = !!c.hidden[k], v = hid ? 0 : +r[k] || 0, yy = hid ? by : by + j++ * (subH + M.ring);
          acc += v;
          keyed(c, color(s("path", { class: "ui-chart-bar" + (v ? "" : " is-off"), "data-series": k }, g), k), i + "|" + k, "d", barRight(x0, yy, X(v) - x0, hid ? 0 : subH, M.radius));
        });
      } else {
        const live = vis.filter((k) => (+r[k] || 0) > 0), lastKey = live[live.length - 1];
        c.keys.forEach((k) => {
          const v = c.hidden[k] ? 0 : +r[k] || 0, xa = X(acc), xb = X(acc + v), isLast = k === lastKey, cut = v && !isLast ? M.ring : 0;
          acc += v;
          const rr = cfg.track ? barH / 2 : isLast ? M.radius : 0;
          keyed(c, color(s("path", { class: "ui-chart-bar" + (v ? "" : " is-off"), "data-series": k }, g), k), i + "|" + k, "d", barRight(xa, by, Math.max(0, xb - xa - cut), barH, rr, cfg.track ? rr : 0));
        });
      }
      const t = text(gT, "ui-chart-data ui-chart-data--label ui-chart-data--total" + (grouped ? " is-off" : ""), 0, 0, fmtV(cfg, acc), "end");
      keyed(c, t, "total|" + i, "transform", "translate(" + f(x1) + "px, " + f(y + M.line / 2) + "px)");
    });
    if (grouped) sc.ticks.forEach((t, i) => text(gT, "ui-chart-data", X(t), H - M.line / 2, fmtV(cfg, t), i === 0 ? "start" : i === sc.ticks.length - 1 ? "end" : "middle"));
  }

  // donut: share of a whole, slices 2 apart, the total in the middle, every value in the list beside it
  function donut(c) {
    const cfg = c.cfg, d = cfg.data, svg = c.svg, M = metrics(c);
    const size = c.frame.clientWidth, ring = cssPx(c.el, "--ui-chart-donut-ring", 20), R = size / 2 - ring / 2, cx = size / 2;
    const vals = d.map((r) => +r[cfg.dataKey] || 0), tot = sum(vals) || 1, sh = shares(vals), gapA = M.ring / R;
    let a = -Math.PI / 2, acc = 0;
    c.geo = { kind: "donut", n: d.length, cx, R, ring, arcs: [] };
    const g = s("g", {}, svg);
    d.forEach((r, i) => {
      const fr = vals[i] / tot, a0 = a, a1 = a + fr * Math.PI * 2; a = a1;
      c.geo.arcs.push([a0, a1]);
      const s0 = a0 + gapA / 2, s1 = a1 - gapA / 2;
      if (s1 <= s0) { acc += fr; return; }
      const p = (t) => f(cx + R * Math.cos(t)) + "," + f(cx + R * Math.sin(t));
      const arc = s("path", { class: "ui-chart-arc", d: "M" + p(s0) + "A" + f(R) + "," + f(R) + " 0 " + (s1 - s0 > Math.PI ? 1 : 0) + " 1 " + p(s1), pathLength: "1", "data-index": i }, g);
      color(arc, r[cfg.nameKey]); arc.style.setProperty("--d", f(acc)); arc.style.setProperty("--f", f(fr));
      acc += fr;
    });
    c.centerNum.textContent = fmtV(cfg, sum(vals)); c.centerCap.textContent = cfg.centerLabel || "in all";
    c.list.textContent = "";
    d.forEach((r, i) => {
      const li = h("li", "ui-chart-legend-row", c.list); li.setAttribute("data-index", i);
      color(h("span", "ui-chart-legend-swatch", li), r[cfg.nameKey]).setAttribute("aria-hidden", "true");
      h("span", "", li).textContent = label(c, r[cfg.nameKey]);
      h("span", "ui-chart-legend-num", li).textContent = fmtV(cfg, vals[i]);
      h("span", "ui-chart-legend-num ui-chart-legend-num--share", li).textContent = sh[i] + "%";
    });
  }

  // sparkline: the shape of the last weeks, ending in a dot on the value the tile shows
  function spark(c, W) {
    const cfg = c.cfg, d = cfg.data, n = d.length, svg = c.svg, M = metrics(c), H = c.frame.clientHeight, k = c.keys[0] || "value";
    const vals = d.map((r) => (typeof r === "number" ? r : +r[cfg.dataKey || k] || 0));
    const pad = M.point / 2 + M.ring, lo = cfg.min != null ? cfg.min : Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
    const X = (i) => pad + (n > 1 ? (i * (W - 2 * pad)) / (n - 1) : (W - 2 * pad) / 2), Y = (v) => pad + (1 - (v - lo) / span) * (H - 2 * pad);
    const pts = vals.map((v, i) => [X(i), Y(v)]), line = monotone(pts);
    c.geo = { kind: "spark", n };
    color(s("path", { class: "ui-chart-area", d: line + "L" + f(X(n - 1)) + "," + H + "L" + f(X(0)) + "," + H + "Z" }, svg), k);
    color(s("path", { class: "ui-chart-line", d: line, pathLength: "1" }, svg), k);
    dot(svg, X(n - 1), Y(vals[n - 1]), k, M.point / 2 + M.ring / 2 - 1);
  }

  // loading, empty, error: in the chart's own size
  function renderState(c, state) {
    const el = c.el, cfg = c.cfg, A = (n, fb) => el.getAttribute(n) || fb;
    hideTip(c);
    if (state === "loading") {
      el.setAttribute("aria-busy", "true");
      const sk = (c.skel = h("div", "ui-chart-skeleton" + (c.type === "donut" ? " ui-chart-skeleton--donut" : ""), c.frame));
      sk.setAttribute("aria-hidden", "true");
      const n = c.type === "donut" || c.type === "spark" ? 1 : cfg.data.length || 12;
      for (let i = 0; i < n; i++) {
        const b = h("span", "ui-skeleton", sk);
        b.style.setProperty("--i", i); b.style.setProperty("--h", Math.round(42 + 44 * Math.sin((i / Math.max(n - 1, 1)) * 1.4)) + "%");
      }
      if (c.live) c.live.textContent = "Loading " + (cfg.title || "the chart") + ".";
      return;
    }
    (c.body || c.frame).hidden = true;
    const err = state === "error";
    const box = (c.stateNode = h("div", "ui-empty ui-empty--sm ui-chart-state" + (err ? " ui-chart-state--error" : ""), null));
    (c.body || c.frame).after(box);
    const head = h("div", "ui-empty-header", box);
    const media = h("div", "ui-empty-media ui-empty-media--icon", head);
    media.innerHTML = '<svg aria-hidden="true"><use href="#fi-' + (err ? "circle-alert" : c.type === "donut" ? "chart-pie" : c.type === "bar" ? "chart-column" : "chart-line") + '"/></svg>';
    h("p", "ui-empty-title", head).textContent = err ? A("data-error-title", "The chart didn’t load.") : A("data-empty-title", "No creatives yet.");
    h("p", "ui-empty-description", head).textContent = err ? A("data-error-description", "Fume couldn’t reach the numbers just now.") : A("data-empty-description", "Your first brief starts the chart.");
    const act = err ? "Try again" : el.getAttribute("data-empty-action");
    if (act) {
      const row = h("div", "ui-empty-content", box), b = h("button", "ui-btn ui-btn--sm " + (err ? "ui-btn--secondary" : "ui-btn--primary"), row);
      b.type = "button";
      b.innerHTML = '<svg aria-hidden="true"><use href="#fi-' + (err ? "rotate-ccw" : "plus") + '"/></svg>';
      b.appendChild(document.createTextNode(act));
      b.addEventListener("click", () => el.dispatchEvent(new CustomEvent(err ? "fume:chart-retry" : "fume:chart-empty-action", { bubbles: true })));
    }
  }

  // ---------- the table every value lives in ----------
  function table(c) {
    const cfg = c.cfg, t = c.table, d = cfg.data;
    t.textContent = "";
    h("caption", "", t).textContent = (cfg.title || "Chart") + (cfg.description ? ", " + cfg.description : "");
    const hr = h("tr", "", h("thead", "", t)), body = h("tbody", "", t);
    const th = (row, str, scope) => { const x = h("th", "", row); x.scope = scope; x.textContent = str; };
    const td = (row, str) => { h("td", "", row).textContent = str; };
    if (c.type === "donut") {
      const vals = d.map((r) => +r[cfg.dataKey] || 0), sh = shares(vals);
      th(hr, cfg.xLabel || "Format", "col"); th(hr, cfg.valueLabel || "Creatives", "col"); th(hr, "Share", "col");
      d.forEach((r, i) => { const tr = h("tr", "", body); th(tr, label(c, r[cfg.nameKey]), "row"); td(tr, fmtV(cfg, vals[i])); td(tr, sh[i] + "%"); });
      return;
    }
    th(hr, cfg.xLabel || "", "col"); c.keys.forEach((k) => th(hr, label(c, k), "col"));
    if (cfg.stack) th(hr, "Total", "col");
    d.forEach((r) => {
      const tr = h("tr", "", body); th(tr, fmtX(cfg, r[cfg.xKey], "head"), "row");
      c.keys.forEach((k) => td(tr, fmtV(cfg, +r[k])));
      if (cfg.stack) td(tr, fmtV(cfg, sum(c.keys.map((k) => +r[k] || 0))));
    });
  }

  // ---------- the active point: band, points, tooltip, words ----------
  function setActive(c, i) {
    const g = c.geo;
    if (!g || !c.plot || i == null || !(i >= 0) || i >= g.n || c.el.getAttribute("data-state")) return;
    i = Math.round(i);
    const changed = i !== c.active;
    c.active = i;
    c.frame.setAttribute("data-active", i);
    const M = metrics(c), cfg = c.cfg, r = cfg.data[i];
    let box = null;
    if (g.kind === "xy") {
      const bw = clamp(g.step * 0.9, M.point * 2, M.point * 5), x = clamp(g.X(i) - bw / 2, g.left - M.point, g.right + M.point - bw);
      band(c, x, 0, bw, g.bottom + M.gap / 2);
      c.gActive.textContent = "";
      visibleKeys(c).forEach((k) => dot(c.gActive, g.X(i), g.Y(+r[k] || 0), k, M.point / 2 + M.ring / 2));
      box = { x0: x, x1: x + bw, y0: 0, y1: g.bottom, top: g.marks(i)[0] };
    } else if (g.kind === "cols") {
      const x = g.left + g.slot * i + M.ring;
      band(c, x, 0, g.slot - M.ring * 2, g.bottom + M.gap / 2);
      box = { x0: x, x1: x + g.slot - M.ring * 2, y0: 0, y1: g.bottom, top: g.marks(i)[0] };
    } else if (g.kind === "rows") {
      const y = g.top(i) - M.gap / 2 - M.ring;
      band(c, 0, y, g.W, g.rowH + M.gap + M.ring * 2);
      box = { x0: 0, x1: g.W, y0: y, y1: y + g.rowH, top: y, above: true };
    } else if (g.kind === "donut") {
      c.svg.querySelectorAll(".ui-chart-arc").forEach((a) => a.classList.toggle("is-dim", +a.getAttribute("data-index") !== i));
      c.list.querySelectorAll("[data-index]").forEach((li) => li.classList.toggle("is-active", +li.getAttribute("data-index") === i));
      const vals = cfg.data.map((x) => +x[cfg.dataKey] || 0);
      c.centerNum.textContent = fmtV(cfg, vals[i]); c.centerCap.textContent = label(c, r[cfg.nameKey]) + " · " + shares(vals)[i] + "%";
    }
    if (box) { fillTip(c, i); placeTip(c, box); }
    if (c.focused && changed) c.live.textContent = spoken(c, i);
    if (changed) c.el.dispatchEvent(new CustomEvent("fume:chart-active", { bubbles: true, detail: { index: i } }));
  }
  function band(c, x, y, w, hh) {
    const b = c.cursor.style;
    b.setProperty("--x", f(x) + "px"); b.setProperty("--y", f(y) + "px"); b.setProperty("--w", f(w) + "px"); b.setProperty("--h", f(hh) + "px");
  }
  function clearActive(c) {
    if (c.pinned != null && !c.el.getAttribute("data-state") && c.geo) return setActive(c, c.pinned);
    c.active = -1;
    if (!c.frame) return;
    c.frame.removeAttribute("data-active");
    if (c.gActive) c.gActive.textContent = "";
    hideTip(c);
    if (c.type === "donut" && c.geo) {
      c.svg.querySelectorAll(".is-dim").forEach((a) => a.classList.remove("is-dim"));
      c.list.querySelectorAll(".is-active").forEach((li) => li.classList.remove("is-active"));
      const vals = c.cfg.data.map((x) => +x[c.cfg.dataKey] || 0);
      c.centerNum.textContent = fmtV(c.cfg, sum(vals)); c.centerCap.textContent = c.cfg.centerLabel || "in all";
    }
  }
  function hideTip(c) { if (c.tip) { c.tip.hidden = true; c.tip.removeAttribute("data-state"); } }
  function fillTip(c, i) {
    const cfg = c.cfg, r = cfg.data[i], tip = c.tip, vis = visibleKeys(c);
    tip.textContent = "";
    h("div", "ui-chart-tooltip-head" + (cfg.xFormat ? " ui-chart-tooltip-time" : ""), tip).textContent = fmtX(cfg, r[cfg.xKey], "head");
    const rowsEl = h("div", "ui-chart-tooltip-rows", tip);
    vis.forEach((k) => {
      h("span", "ui-chart-tooltip-name", rowsEl).textContent = label(c, k);
      h("span", "ui-chart-tooltip-num", rowsEl).textContent = fmtV(cfg, +r[k]);
    });
    if (cfg.stack && vis.length > 1) {
      h("span", "ui-chart-tooltip-name ui-chart-tooltip-total is-total", rowsEl).textContent = "Total";
      h("span", "ui-chart-tooltip-num is-total", rowsEl).textContent = fmtV(cfg, sum(vis.map((k) => +r[k] || 0)));
    }
  }
  // Where the tooltip goes. With a pointer or the keyboard: beside the band (right first, else left), and
  // up or down so it clears the lines and columns it lies over (above them, else below, else at the top).
  // On a touch screen the finger is on the chart, so it sits above the touched point, over the legend if it
  // must; a row's tooltip sits above its row. Never wider than the chart.
  function placeTip(c, b) {
    const tip = c.tip, box = c.tipBox, fresh = tip.hidden, W = c.frame.clientWidth, off = cssPx(c.el, "--ui-chart-tick-gap", 8), g = c.geo;
    tip.hidden = false;
    if (fresh) { box.classList.add("is-placing"); tip.removeAttribute("data-state"); void tip.offsetWidth; tip.setAttribute("data-state", "open"); }
    const tw = tip.offsetWidth, th = tip.offsetHeight, mid = (b.x0 + b.x1) / 2;
    const ceiling = c.el.getBoundingClientRect().top - c.frame.getBoundingClientRect().top; // the chart's own top, legend included
    let x = null, y;
    if (!b.above && !c.touch) {
      if (b.x1 + off + tw <= W) x = b.x1 + off; else if (b.x0 - off - tw >= 0) x = b.x0 - off - tw;
    }
    if (x == null) {
      x = clamp(mid - tw / 2, 0, Math.max(0, W - tw));
      y = Math.max(ceiling, (b.above ? b.y0 : b.top) - th - off * 2);
    } else {
      y = b.y0;
      if (g && g.marks) {
        // the marks under the tooltip's width: above them in the plot, else below them (over the dates,
        // which the tooltip repeats), else above them over the legend; if none is clear, at the top
        let lo = Infinity, hi = -Infinity;
        for (let i = 0; i < g.n; i++) {
          const cx = g.cx(i);
          if (cx < x - g.step || cx > x + tw + g.step) continue;
          const [a, z] = g.marks(i); lo = Math.min(lo, a); hi = Math.max(hi, z);
        }
        const H = c.frame.clientHeight, up = lo - off * 2 - th, down = hi + off * 2;
        if (lo < Infinity) y = up >= 0 ? up : down + th <= H ? down : up >= ceiling ? up : b.y0;
      }
    }
    box.style.setProperty("--x", Math.round(x) + "px"); box.style.setProperty("--y", Math.round(y) + "px");
    if (fresh) requestAnimationFrame(() => box.classList.remove("is-placing"));
  }

  // ---------- input ----------
  function hit(c, e) {
    const g = c.geo; if (!g) return -1;
    const rc = c.frame.getBoundingClientRect(), x = e.clientX - rc.left, y = e.clientY - rc.top;
    if (g.kind === "xy") return clamp(Math.round((x - g.left) / g.step), 0, g.n - 1);
    if (g.kind === "cols") return clamp(Math.floor((x - g.left) / g.slot), 0, g.n - 1);
    if (g.kind === "rows") { for (let i = 0; i < g.n; i++) if (y < g.top(i) + g.rowH + cssPx(c.el, "--ui-space-xl", 24) / 2) return i; return g.n - 1; }
    if (g.kind === "donut") {
      const dx = x - g.cx, dy = y - g.cx, dist = Math.hypot(dx, dy);
      if (dist < g.R - g.ring / 2 - 8 || dist > g.R + g.ring / 2 + 12) return -1;
      let a = Math.atan2(dy, dx); if (a < -Math.PI / 2) a += Math.PI * 2;
      return g.arcs.findIndex(([a0, a1]) => a >= a0 && a < a1);
    }
    return -1;
  }
  function events(c) {
    const p = c.plot;
    p.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse") c.touch = false; if (e.pointerType === "mouse" || c.dragging) { const i = hit(c, e); if (i >= 0) setActive(c, i); else if (!c.focused) clearActive(c); } });
    p.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse") return;
      c.dragging = true; c.touch = true;
      const i = hit(c, e); if (i >= 0) setActive(c, i);
    });
    const up = () => { c.dragging = false; };
    p.addEventListener("pointerup", up); p.addEventListener("pointercancel", up);
    p.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse" && !c.focused) clearActive(c); });
    p.addEventListener("focus", () => {
      c.focused = true;
      let kb = true; try { kb = p.matches(":focus-visible"); } catch (x) { /* older engines */ }
      if (kb) c.frame.setAttribute("data-focus", "visible");
      if (c.active < 0) setActive(c, c.pinned != null ? c.pinned : c.type === "donut" ? 0 : c.geo ? c.geo.n - 1 : 0);
      if (c.active >= 0) c.live.textContent = spoken(c, c.active);
    });
    p.addEventListener("blur", () => { c.focused = false; c.frame.removeAttribute("data-focus"); clearActive(c); });
    p.addEventListener("keydown", (e) => {
      const g = c.geo; if (!g) return;
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      let i = null;
      if (step) i = clamp((c.active < 0 ? (step > 0 ? -1 : g.n) : c.active) + step, 0, g.n - 1);
      else if (e.key === "Home") i = 0;
      else if (e.key === "End") i = g.n - 1;
      else if (e.key === "Escape" && c.active >= 0 && c.pinned == null) { e.preventDefault(); clearActive(c); return; }
      if (i == null) return;
      e.preventDefault();
      c.touch = false;
      c.frame.setAttribute("data-focus", "visible");
      setActive(c, i);
    });
  }
  // a tap outside a chart closes its tooltip
  document.addEventListener("pointerdown", (e) => { all.forEach((c) => { if (c.active >= 0 && !c.focused && !c.el.contains(e.target)) clearActive(c); }); }, true);

  function toggle(c, k, on) {
    if (!c.cfg.config[k]) return;
    if (on === undefined) on = !!c.hidden[k];
    const vis = visibleKeys(c);
    if (!on && vis.length === 1 && vis[0] === k) return; // one series always stays
    if (on === !c.hidden[k]) return;
    c.hidden[k] = !on;
    const b = c.legend && c.legend.querySelector('[data-key="' + k + '"]');
    if (b) { b.setAttribute("aria-pressed", String(on)); b.setAttribute("data-state", on ? "on" : "off"); }
    if (c.type === "bar") render(c, true);
    else { c.svg.querySelectorAll('[data-series="' + k + '"]').forEach((n) => n.classList.toggle("is-off", !on)); if (c.active >= 0) setActive(c, c.active); }
    if (c.active >= 0 && c.type === "bar") setActive(c, c.active);
    c.el.dispatchEvent(new CustomEvent("fume:chart-toggle", { bubbles: true, detail: { key: k, on } }));
  }

  // ---------- motion ----------
  function draw(c) {
    const el = c.el;
    if (reduced(el) || el.getAttribute("data-state")) return;
    el.removeAttribute("data-draw"); void el.offsetWidth;
    el.setAttribute("data-draw", "run");
    clearTimeout(c.drawT);
    const n = c.geo ? c.geo.n : 12;
    c.drawT = setTimeout(() => el.removeAttribute("data-draw"), cssMs(el, "--ui-chart-draw", 480) + cssMs(el, "--ui-motion-base", 240) + n * cssMs(el, "--ui-motion-instant", 100) / 4 + 120);
  }

  // ---------- start ----------
  const fontsReady = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 400))]) : Promise.resolve();
  function fumeChart(root) {
    const scope = root || document, list = Array.from(scope.querySelectorAll("[data-ui-chart]"));
    if (scope.matches && scope.matches("[data-ui-chart]")) list.push(scope);
    const fresh = list.filter((el) => !el._fumeChart).map(make);
    fontsReady.then(() => {
      fresh.forEach((c) => render(c, false));
      // a chart drawn before its neighbours can be stretched by them (a filled plot beside a donut card):
      // one more pass redraws any whose box changed, before the first frame is shown
      fresh.forEach((c) => { if (moved(c)) render(c, false); });
      fresh.forEach((c) => { if (c.w > 0) draw(c); });
    });
    return fresh.map((c) => c.api);
  }
  // the box a chart was drawn for: its width, and the plot's height (a --fill plot takes its card's)
  function moved(c) {
    const w = c.type === "bar" ? c.el.clientWidth : c.frame.clientWidth;
    return !!w && (w !== c.lastW || (c.type !== "bar" && c.frame.clientHeight !== c.lastH));
  }
  fumeChart.get = (el) => (el && el._fumeChart ? el._fumeChart.api : null);
  let raf = 0;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => all.forEach((c) => {
      if (!c.el.isConnected) return;
      if (moved(c)) { const first = c.w <= 0; render(c, false); if (first) draw(c); }
    }));
  }, { passive: true });
  window.fumeChart = fumeChart;
  if (document.readyState !== "loading") fumeChart(); else document.addEventListener("DOMContentLoaded", () => fumeChart());
})();
