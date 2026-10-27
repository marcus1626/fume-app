// The drawing of every Fume icon on Lucide's 24 px grid. Built by tools/icons/build.mjs.
// Lucide paths are copied exactly from lucide-icons/lucide (ISC licence); "from" names the source icon.
// Element: [role, tag, attributes, options]. Roles are explained in build.mjs.
// status: the set below was approved by Marcus on the review board, round 4 (13 Oct 2026). A new icon
// sets status: "PROPOSED" until it is approved.

export const LINE = 2.25; // stroke of line-only icons, a little heavier than Lucide's 2 so they sit with the filled ones
export const CUT = 2;     // width of a knocked-out detail
export const DEFAULT_STATUS = "APPROVED";

// --- Fume geometry (tools/canvas/tools/geo.py) -------------------------------------------------
// The Focus point: a right-angled triangle with a soft hypotenuse. Tip at (225,225), legs 150.
const PT_D = "M225 245C225 234 234 225 245 225H326.7C334.8 225 342.1 229.9 345.2 237.3C348.3 244.8 346.6 253.4 340.9 259.1L259.1 340.9C253.4 346.6 244.8 348.3 237.3 345.2C229.9 342.1 225 334.8 225 326.7Z";
const n = (x) => +x.toFixed(3);
// tip: where the point's tip sits; P: leg length; rot 0 = logo angle (tip up-left), 45 = focal point (tip up)
const point = (tip, P, rot = 0) => `d="${PT_D}" transform="translate(${n(tip[0])} ${n(tip[1])}) rotate(${rot}) scale(${n(P / 150)}) translate(-225 -225)"`;
// Focal point centred on (cx, cy): the tip sits P*sqrt(2)/3 above the centre (geo.py focal_tip)
const focal = (cx, cy, P) => point([cx, cy - (P * Math.SQRT2) / 3], P, 45);

function roundPoly(pts, r) {
  const toward = (a, b, d) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); d = Math.min(d, l / 2);
    return [a[0] + (dx / l) * d, a[1] + (dy / l) * d];
  };
  let d = "";
  pts.forEach((p1, i) => {
    const p0 = pts[(i - 1 + pts.length) % pts.length], p2 = pts[(i + 1) % pts.length];
    const a = toward(p1, p0, r), b = toward(p1, p2, r);
    d += `${i ? "L" : "M"}${n(a[0])} ${n(a[1])}Q${n(p1[0])} ${n(p1[1])} ${n(b[0])} ${n(b[1])}`;
  });
  return d + "Z";
}
// A Focus frame corner (geo.py corner_d), redrawn for 24 px: arm thickness t, length L, a 45° cut at each
// arm's end, soft corners r. At icon size the gap between the two arms would blur away, so it is one piece.
// at = the corner's outer point; flip draws the bottom-right corner.
function corner(at, { t = 2.5, L = 8.5, r = 0.6 } = {}, flip = false) {
  const s = flip ? -1 : 1;
  const pts = [[0, 0], [L, 0], [L - t, t], [t, t], [t, L - t], [0, L]].map(([x, y]) => [at[0] + s * x, at[1] + s * y]);
  return `d="${roundPoly(pts, r)}"`;
}

// --- Icons -------------------------------------------------------------------------------------------
export const ICONS = {
  // Line-only Lucide icons stay lines.
  check: { from: "check", kind: "line", body: [["line", "path", 'd="M20 6 9 17l-5-5"']] },
  plus: { from: "plus", kind: "line", body: [["line", "path", 'd="M5 12h14"'], ["line", "path", 'd="M12 5v14"']] },
  x: { from: "x", kind: "line", body: [["line", "path", 'd="M18 6 6 18"'], ["line", "path", 'd="m6 6 12 12"']] },
  "arrow-right": { from: "arrow-right", kind: "line", body: [["line", "path", 'd="M5 12h14"'], ["line", "path", 'd="m12 5 7 7-7 7"']] },
  "rotate-ccw": { from: "rotate-ccw", kind: "line", body: [["line", "path", 'd="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"'], ["line", "path", 'd="M3 3v5h5"']] },
  search: { from: "search", kind: "line", note: "A filled lens reads as a lollipop; the ring stays.", body: [["line", "path", 'd="m21 21-4.34-4.34"'], ["line", "circle", 'cx="11" cy="11" r="8"']] },
  "loader-circle": { from: "loader-circle", kind: "line", note: "Spins; stays a line.", body: [["line", "path", 'd="M21 12a9 9 0 1 1-6.219-8.56"']] },

  // Filled Lucide.
  ellipsis: { from: "ellipsis", kind: "filled", body: [["solid", "circle", 'cx="5" cy="12" r="2"'], ["solid", "circle", 'cx="12" cy="12" r="2"'], ["solid", "circle", 'cx="19" cy="12" r="2"']] },
  "message-square": { from: "message-square", kind: "filled", body: [["fill", "path", 'd="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"']] },
  eye: {
    from: "eye", kind: "filled",
    body: [["fill", "path", 'd="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"']],
    cuts: [["cutline", "circle", 'cx="12" cy="12" r="3.25"', { w: 1.75 }]],
  },
  copy: {
    from: "copy", kind: "filled",
    body: [["fill", "rect", 'x="3" y="3" width="12" height="12" rx="1"']],
    cuts: [["cut", "rect", 'x="5.5" y="5.5" width="19" height="19" rx="3.5"']],
    top: [["fill", "rect", 'x="8" y="8" width="14" height="14" rx="2"']],
  },
  download: {
    from: "download", kind: "filled", status: "PROPOSED", note: "The tray is a flat base as heavy as the arrow (round 9: the old solid base read too thick, Marcus 13 Oct); the arrow drops towards it.",
    body: [["line", "path", 'd="M4.125 19.875h15.75"']],
    top: [["line", "path", 'd="M12 3v12"'], ["line", "path", 'd="m7.5 10.5 4.5 4.5 4.5-4.5"']],
  },
  "sliders-horizontal": {
    from: "sliders-horizontal", kind: "filled", note: "Thin tracks, solid knobs.",
    body: [["line", "path", 'd="M3 5h18"', { w: 2 }], ["line", "path", 'd="M3 12h18"', { w: 2 }], ["line", "path", 'd="M3 19h18"', { w: 2 }]],
    cuts: [["cut", "circle", 'cx="15" cy="5" r="4.75"'], ["cut", "circle", 'cx="8" cy="12" r="4.75"'], ["cut", "circle", 'cx="16" cy="19" r="4.75"']],
    top: [["solid", "circle", 'cx="15" cy="5" r="3"'], ["solid", "circle", 'cx="8" cy="12" r="3"'], ["solid", "circle", 'cx="16" cy="19" r="3"']],
  },
  "layout-grid": {
    from: "layout-grid", kind: "filled",
    body: [["fill", "rect", 'x="3" y="3" width="7" height="7" rx="1"'], ["fill", "rect", 'x="14" y="3" width="7" height="7" rx="1"'], ["fill", "rect", 'x="14" y="14" width="7" height="7" rx="1"'], ["fill", "rect", 'x="3" y="14" width="7" height="7" rx="1"']],
  },
  trash: {
    from: "trash", kind: "filled", note: "Body filled with the two slots cut; lid and handle stay lines.",
    body: [["fill", "path", 'd="M6 9.5h12v10a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19.5z"']],
    cuts: [["cutline", "path", 'd="M10 13v4.5"', { w: 1.75 }], ["cutline", "path", 'd="M14 13v4.5"', { w: 1.75 }]],
    top: [["line", "path", 'd="M3 6h18"'], ["line", "path", 'd="M8.5 6V4.5a1.5 1.5 0 0 1 1.5-1.5h4a1.5 1.5 0 0 1 1.5 1.5V6"']],
  },
  house: {
    from: "house", kind: "filled",
    body: [["fill", "path", 'd="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"']],
    cuts: [["cut", "rect", 'x="9.75" y="13.5" width="4.5" height="10" rx="1.25"']],
  },
  folder: { from: "folder", kind: "filled", body: [["fill", "path", 'd="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"']] },
  image: {
    from: "image", kind: "filled",
    body: [["fill", "rect", 'x="3" y="3" width="18" height="18" rx="2"']],
    cuts: [["cut", "circle", 'cx="9" cy="9" r="2"'], ["cutline", "path", 'd="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"']],
  },
  user: { from: "user", kind: "filled", body: [["fill", "circle", 'cx="12" cy="7" r="4"'], ["fill", "path", 'd="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2z"']] },
  settings: {
    from: "settings", kind: "filled",
    body: [["fill", "path", 'd="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"']],
    cuts: [["cut", "circle", 'cx="12" cy="12" r="3"']],
  },
  bell: {
    from: "bell", kind: "filled",
    body: [["fill", "path", 'd="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"'], ["fill", "path", 'd="M10.268 21a2 2 0 0 0 3.464 0z"']],
  },

  // Round 7 (PROPOSED): what the component wave needs. Line-only icons stay lines; the rest filled.
  "chevron-down": { from: "chevron-down", kind: "line", status: "PROPOSED", body: [["line", "path", 'd="m6 9 6 6 6-6"']] },
  "chevron-up": { from: "chevron-up", kind: "line", status: "PROPOSED", body: [["line", "path", 'd="m18 15-6-6-6 6"']] },
  "chevron-left": { from: "chevron-left", kind: "line", status: "PROPOSED", body: [["line", "path", 'd="m15 18-6-6 6-6"']] },
  "chevron-right": { from: "chevron-right", kind: "line", status: "PROPOSED", body: [["line", "path", 'd="m9 18 6-6-6-6"']] },
  "chevrons-up-down": { from: "chevrons-up-down", kind: "line", status: "PROPOSED", body: [["line", "path", 'd="m7 15 5 5 5-5"'], ["line", "path", 'd="m7 9 5-5 5 5"']] },
  minus: { from: "minus", kind: "line", status: "PROPOSED", body: [["line", "path", 'd="M5 12h14"']] },
  "arrow-left": { from: "arrow-left", kind: "line", status: "PROPOSED", body: [["line", "path", 'd="m12 19-7-7 7-7"'], ["line", "path", 'd="M19 12H5"']] },
  "arrow-up": { from: "arrow-up", kind: "line", status: "PROPOSED", body: [["line", "path", 'd="m5 12 7-7 7 7"'], ["line", "path", 'd="M12 19V5"']] },
  "arrow-down": { from: "arrow-down", kind: "line", status: "PROPOSED", body: [["line", "path", 'd="M12 5v14"'], ["line", "path", 'd="m19 12-7 7-7-7"']] },
  "arrow-up-down": { from: "arrow-up-down", kind: "line", status: "PROPOSED", body: [["line", "path", 'd="m21 16-4 4-4-4"'], ["line", "path", 'd="M17 20V4"'], ["line", "path", 'd="m3 8 4-4 4 4"'], ["line", "path", 'd="M7 4v16"']] },
  upload: { from: "upload", kind: "filled", status: "PROPOSED", note: "As download: a flat base as heavy as the arrow, the arrow rises from it.", body: [["line", "path", 'd="M4.125 19.875h15.75"']], top: [["line", "path", 'd="M12 15V3"'], ["line", "path", 'd="m7.5 7.5 4.5-4.5 4.5 4.5"']] },
  link: { from: "link", kind: "line", status: "PROPOSED", body: [["line", "path", 'd="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"'], ["line", "path", 'd="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"']] },
  paperclip: { from: "paperclip", kind: "line", status: "PROPOSED", body: [["line", "path", 'd="m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551"']] },
  info: { from: "info", kind: "filled", status: "PROPOSED", body: [["fill", "circle", 'cx="12" cy="12" r="10"']], cuts: [["cutline", "path", 'd="M12 16v-4"'], ["cutline", "path", 'd="M12 8h.01"']] },
  "circle-alert": { from: "circle-alert", kind: "filled", status: "PROPOSED", body: [["fill", "circle", 'cx="12" cy="12" r="10"']], cuts: [["cutline", "path", 'd="M12 8v4"'], ["cutline", "path", 'd="M12 16h.01"']] },
  "circle-check": { from: "circle-check", kind: "filled", status: "PROPOSED", note: "Done, saved, sent. Not the Quality Gate check: that is the checked triangle.", body: [["fill", "circle", 'cx="12" cy="12" r="10"']], cuts: [["cutline", "path", 'd="m16 9-5.5 5.5L8 12"']] },
  "circle-x": { from: "circle-x", kind: "filled", status: "PROPOSED", note: "Clear a field.", body: [["fill", "circle", 'cx="12" cy="12" r="10"']], cuts: [["cutline", "path", 'd="m15 9-6 6"'], ["cutline", "path", 'd="m9 9 6 6"']] },
  "triangle-alert": { from: "triangle-alert", kind: "filled", status: "PROPOSED", body: [["fill", "path", 'd="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"']], cuts: [["cutline", "path", 'd="M12 9v4"'], ["cutline", "path", 'd="M12 17h.01"']] },
  clock: { from: "clock", kind: "filled", status: "PROPOSED", body: [["fill", "circle", 'cx="12" cy="12" r="10"']], cuts: [["cutline", "path", 'd="M12 6v6l4 2"']] },
  calendar: { from: "calendar", kind: "filled", status: "PROPOSED", note: "Filled page; the binding rings stay lines; the header line is cut.", body: [["fill", "rect", 'x="3" y="4" width="18" height="17" rx="2"']], cuts: [["cutline", "path", 'd="M3 9.5h18"', { w: 1.75 }]], top: [["line", "path", 'd="M8 2v3"'], ["line", "path", 'd="M16 2v3"']] },
  pencil: { from: "pencil", kind: "filled", status: "PROPOSED", body: [["fill", "path", 'd="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"']], cuts: [["cutline", "path", 'd="m15 5 4 4"', { w: 1.75 }]] },
  send: { from: "send", kind: "filled", status: "PROPOSED", body: [["fill", "path", 'd="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"']], cuts: [["cutline", "path", 'd="m21.854 2.147-10.94 10.939"', { w: 1.75 }]] },
  "panel-left": { from: "panel-left", kind: "filled", status: "PROPOSED", note: "Show or hide the sidebar.", body: [["fill", "rect", 'x="3" y="3" width="18" height="18" rx="2"']], cuts: [["cut", "rect", 'x="10" y="5.5" width="8.5" height="13" rx="1"']] },
  "grip-vertical": { from: "grip-vertical", kind: "filled", status: "PROPOSED", body: [["solid", "circle", 'cx="9" cy="12" r="1.5"'], ["solid", "circle", 'cx="9" cy="5" r="1.5"'], ["solid", "circle", 'cx="9" cy="19" r="1.5"'], ["solid", "circle", 'cx="15" cy="12" r="1.5"'], ["solid", "circle", 'cx="15" cy="5" r="1.5"'], ["solid", "circle", 'cx="15" cy="19" r="1.5"']] },
  lock: { from: "lock", kind: "filled", status: "PROPOSED", body: [["fill", "rect", 'x="3" y="11" width="18" height="11" rx="2"']], top: [["line", "path", 'd="M7 11V7a5 5 0 0 1 10 0v4"']] },
  mail: { from: "mail", kind: "filled", status: "PROPOSED", body: [["fill", "rect", 'x="2" y="4" width="20" height="16" rx="2"']], cuts: [["cutline", "path", 'd="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"', { w: 1.75 }]] },
  users: { from: "users", kind: "filled", status: "PROPOSED", body: [["fill", "circle", 'cx="9" cy="7" r="4"'], ["fill", "path", 'd="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2z"'], ["line", "path", 'd="M16 3.128a4 4 0 0 1 0 7.744"'], ["line", "path", 'd="M22 21v-2a4 4 0 0 0-3-3.87"']] },
  inbox: { from: "inbox", kind: "filled", status: "PROPOSED", body: [["fill", "path", 'd="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"']], cuts: [["cutline", "path", 'd="M22 12h-6l-2 3h-4l-2-3H2"', { w: 1.75 }]] },
  funnel: { from: "funnel", kind: "filled", status: "PROPOSED", body: [["fill", "path", 'd="M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z"']] },
  package: { from: "package", kind: "filled", status: "PROPOSED", note: "Products, the catalogue (app v2).", body: [["fill", "path", 'd="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"']], cuts: [["cutline", "path", 'd="M12 22V12"', { w: 1.75 }], ["cutline", "path", 'd="m3.3 7 7.7 4.73a2 2 0 0 0 2 0L20.7 7"', { w: 1.75 }]] },
  layers: { from: "layers", kind: "filled", status: "PROPOSED", note: "Collections, layers in the Studio (app v2).", body: [["fill", "path", 'd="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"'], ["line", "path", 'd="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"'], ["line", "path", 'd="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"']] },
  "sticky-note": { from: "sticky-note", kind: "filled", status: "PROPOSED", note: "A note on a board (app v2).", body: [["fill", "path", 'd="M21 9a2.4 2.4 0 0 0-.7-1.7l-3.6-3.6A2.4 2.4 0 0 0 15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z"']], cuts: [["cutline", "path", 'd="M15 3v5a1 1 0 0 0 1 1h5"', { w: 1.75 }]] },
  globe: { from: "globe", kind: "filled", status: "PROPOSED", note: "A website the Engine reads (app v2).", body: [["fill", "circle", 'cx="12" cy="12" r="10"']], cuts: [["cutline", "path", 'd="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"', { w: 1.75 }], ["cutline", "path", 'd="M2 12h20"', { w: 1.75 }]] },
  tag: { from: "tag", kind: "filled", status: "PROPOSED", body: [["fill", "path", 'd="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"']], cuts: [["cut", "circle", 'cx="7.5" cy="7.5" r="1.75"']] },
  "log-out": { from: "log-out", kind: "line", status: "PROPOSED", body: [["line", "path", 'd="m16 17 5-5-5-5"'], ["line", "path", 'd="M21 12H9"'], ["line", "path", 'd="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"']] },
  megaphone: { from: "megaphone", kind: "filled", status: "PROPOSED", note: "Campaigns.", body: [["fill", "path", 'd="M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"'], ["fill", "path", 'd="M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14z"']], cuts: [["cutline", "path", 'd="M8 6v8"', { w: 1.75 }]] },
  palette: { from: "palette", kind: "filled", status: "PROPOSED", note: "Brand DNA.", body: [["fill", "path", 'd="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"']], cuts: [["cut", "circle", 'cx="13.5" cy="6.5" r="1.4"'], ["cut", "circle", 'cx="17.5" cy="10.5" r="1.4"'], ["cut", "circle", 'cx="6.5" cy="12.5" r="1.4"'], ["cut", "circle", 'cx="8.5" cy="7.5" r="1.4"']] },
  list: { from: "list", kind: "line", status: "PROPOSED", note: "List view; the bullets are solid dots.", body: [["solid", "circle", 'cx="3.5" cy="5" r="1.5"'], ["solid", "circle", 'cx="3.5" cy="12" r="1.5"'], ["solid", "circle", 'cx="3.5" cy="19" r="1.5"'], ["line", "path", 'd="M8 5h13"'], ["line", "path", 'd="M8 12h13"'], ["line", "path", 'd="M8 19h13"']] },
  bold: { from: "bold", kind: "line", status: "PROPOSED", body: [["line", "path", 'd="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"']] },
  italic: { from: "italic", kind: "line", status: "PROPOSED", body: [["line", "path", 'd="M19 4h-9"'], ["line", "path", 'd="M14 20H5"'], ["line", "path", 'd="M15 4 9 20"']] },
  command: { from: "command", kind: "line", status: "PROPOSED", body: [["line", "path", 'd="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"']] },

  // Round 8 (PROPOSED): what the next wave needs (Engine and chat, charts, layout, upload, patterns).
  menu: { from: "menu", kind: "line", status: "PROPOSED", body: [["line", "path", 'd="M4 6h16"'], ["line", "path", 'd="M4 12h16"'], ["line", "path", 'd="M4 18h16"']] },
  file: { from: "file", kind: "filled", status: "PROPOSED", note: "A brand asset or document that is not a creative.", body: [["fill", "path", 'd="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"']], cuts: [["cutline", "path", 'd="M14 2v5a1 1 0 0 0 1 1h5"', { w: 1.75 }]] },
  "file-text": { from: "file-text", kind: "filled", status: "PROPOSED", note: "A brief or a written document.", body: [["fill", "path", 'd="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"']], cuts: [["cutline", "path", 'd="M14 2v5a1 1 0 0 0 1 1h5"', { w: 1.75 }], ["cutline", "path", 'd="M8 13h8"', { w: 1.75 }], ["cutline", "path", 'd="M8 17h6"', { w: 1.75 }]] },
  camera: { from: "camera", kind: "filled", status: "PROPOSED", body: [["fill", "path", 'd="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z"']], cuts: [["cut", "circle", 'cx="12" cy="13" r="3.5"']] },
  "zoom-in": { from: "zoom-in", kind: "line", status: "PROPOSED", note: "As search: the ring stays a line.", body: [["line", "path", 'd="m21 21-4.34-4.34"'], ["line", "circle", 'cx="11" cy="11" r="8"'], ["line", "path", 'd="M11 8v6"'], ["line", "path", 'd="M8 11h6"']] },
  "zoom-out": { from: "zoom-out", kind: "line", status: "PROPOSED", body: [["line", "path", 'd="m21 21-4.34-4.34"'], ["line", "circle", 'cx="11" cy="11" r="8"'], ["line", "path", 'd="M8 11h6"']] },
  "maximize-2": { from: "maximize-2", kind: "line", status: "PROPOSED", body: [["line", "path", 'd="M15 3h6v6"'], ["line", "path", 'd="m21 3-7 7"'], ["line", "path", 'd="m3 21 7-7"'], ["line", "path", 'd="M9 21H3v-6"']] },
  "minimize-2": { from: "minimize-2", kind: "line", status: "PROPOSED", body: [["line", "path", 'd="m14 10 7-7"'], ["line", "path", 'd="M20 10h-6V4"'], ["line", "path", 'd="m3 21 7-7"'], ["line", "path", 'd="M4 14h6v6"']] },
  square: { from: "square", kind: "filled", status: "PROPOSED", note: "Stop: ends a run of the Engine.", body: [["fill", "rect", 'x="5" y="5" width="14" height="14" rx="2.5"']] },
  play: { from: "play", kind: "filled", status: "PROPOSED", body: [["fill", "path", 'd="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"']] },
  pause: { from: "pause", kind: "filled", status: "PROPOSED", body: [["fill", "rect", 'x="14" y="3" width="5" height="18" rx="1"'], ["fill", "rect", 'x="5" y="3" width="5" height="18" rx="1"']] },
  "refresh-cw": { from: "refresh-cw", kind: "line", status: "PROPOSED", note: "Generate again.", body: [["line", "path", 'd="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"'], ["line", "path", 'd="M21 3v5h-5"'], ["line", "path", 'd="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"'], ["line", "path", 'd="M8 16H3v5"']] },
  "trending-up": { from: "trending-up", kind: "line", status: "PROPOSED", body: [["line", "path", 'd="M16 7h6v6"'], ["line", "path", 'd="m22 7-8.5 8.5-5-5L2 17"']] },
  "trending-down": { from: "trending-down", kind: "line", status: "PROPOSED", body: [["line", "path", 'd="M16 17h6v-6"'], ["line", "path", 'd="m22 17-8.5-8.5-5 5L2 7"']] },
  "chart-column": { from: "chart-column", kind: "line", status: "PROPOSED", body: [["line", "path", 'd="M3 3v16a2 2 0 0 0 2 2h16"'], ["line", "path", 'd="M18 17V9"'], ["line", "path", 'd="M13 17V5"'], ["line", "path", 'd="M8 17v-3"']] },
  "chart-line": { from: "chart-line", kind: "line", status: "PROPOSED", body: [["line", "path", 'd="M3 3v16a2 2 0 0 0 2 2h16"'], ["line", "path", 'd="m19 9-5 5-4-4-3 3"']] },
  "chart-pie": { from: "chart-pie", kind: "filled", status: "PROPOSED", body: [["fill", "path", 'd="M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z"'], ["line", "path", 'd="M21.21 15.89A10 10 0 1 1 8 2.83"']] },
  reply: { from: "reply", kind: "line", status: "PROPOSED", body: [["line", "path", 'd="M20 18v-2a4 4 0 0 0-4-4H4"'], ["line", "path", 'd="m9 17-5-5 5-5"']] },
  "at-sign": { from: "at-sign", kind: "line", status: "PROPOSED", note: "Mention someone.", body: [["line", "circle", 'cx="12" cy="12" r="4"'], ["line", "path", 'd="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"']] },
  "thumbs-up": { from: "thumbs-up", kind: "filled", status: "PROPOSED", body: [["fill", "path", 'd="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"']], cuts: [["cutline", "path", 'd="M7 10v12"', { w: 1.75 }]] },
  film: { from: "film", kind: "filled", status: "PROPOSED", note: "a shot in the Video studio (FLOWS §27)", body: [["fill", "rect", 'x="3" y="3" width="18" height="18" rx="2"']], cuts: [["cutline", "path", 'd="M7.5 3v18"', { w: 1.75 }], ["cutline", "path", 'd="M16.5 3v18"', { w: 1.75 }], ["cutline", "path", 'd="M7.5 12h9"', { w: 1.75 }]] },
  music: { from: "music", kind: "filled", status: "PROPOSED", note: "the sound track in the Video studio (FLOWS §27)", body: [["fill", "circle", 'cx="6" cy="18" r="3"'], ["fill", "circle", 'cx="18" cy="16" r="3"']], top: [["line", "path", 'd="M9 18V5l12-2v13"']] },
  captions: { from: "captions", kind: "filled", status: "PROPOSED", note: "captions in the Video studio (FLOWS §27)", body: [["fill", "rect", 'x="3" y="5" width="18" height="14" rx="2"']], cuts: [["cutline", "path", 'd="M7 15h4"', { w: 1.75 }], ["cutline", "path", 'd="M15 15h2"', { w: 1.75 }], ["cutline", "path", 'd="M7 11h2"', { w: 1.75 }], ["cutline", "path", 'd="M13 11h4"', { w: 1.75 }]] },
  mic: { from: "mic", kind: "filled", status: "PROPOSED", body: [["fill", "rect", 'x="9" y="2" width="6" height="13" rx="3"']], top: [["line", "path", 'd="M12 19v3"'], ["line", "path", 'd="M19 10v2a7 7 0 0 1-14 0v-2"']] },
  "undo-2": { from: "undo-2", kind: "line", status: "PROPOSED", body: [["line", "path", 'd="M9 14 4 9l5-5"'], ["line", "path", 'd="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"']] },
  "redo-2": { from: "redo-2", kind: "line", status: "PROPOSED", body: [["line", "path", 'd="m15 14 5-5-5-5"'], ["line", "path", 'd="M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13"']] },
  crop: { from: "crop", kind: "line", status: "PROPOSED", note: "Crop a creative into another format.", body: [["line", "path", 'd="M6 2v14a2 2 0 0 0 2 2h14"'], ["line", "path", 'd="M18 22V8a2 2 0 0 0-2-2H2"']] },
  "external-link": { from: "external-link", kind: "line", status: "PROPOSED", body: [["line", "path", 'd="M15 3h6v6"'], ["line", "path", 'd="M10 14 21 3"'], ["line", "path", 'd="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"']] },
  "share-2": { from: "share-2", kind: "filled", status: "PROPOSED", body: [["fill", "circle", 'cx="18" cy="5" r="3"'], ["fill", "circle", 'cx="6" cy="12" r="3"'], ["fill", "circle", 'cx="18" cy="19" r="3"'], ["line", "path", 'd="m8.59 13.51 6.83 3.98"'], ["line", "path", 'd="m15.41 6.51-6.82 3.98"']] },
  bookmark: { from: "bookmark", kind: "filled", status: "PROPOSED", note: "Save a creative or a brief for later.", body: [["fill", "path", 'd="M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z"']] },
  "arrow-up-right": { from: "arrow-up-right", kind: "line", status: "PROPOSED", body: [["line", "path", 'd="M7 7h10v10"'], ["line", "path", 'd="M7 17 17 7"']] },
  "user-plus": { from: "user-plus", kind: "filled", status: "PROPOSED", note: "Invite someone.", body: [["fill", "circle", 'cx="9" cy="7" r="4"'], ["fill", "path", 'd="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2z"'], ["line", "path", 'd="M19 8v6"'], ["line", "path", 'd="M22 11h-6"']] },
  "image-plus": { from: "image-plus", kind: "filled", status: "PROPOSED", note: "Add a reference image. The plus sits in a notch cut from the corner, so it never touches the image.", body: [["fill", "rect", 'x="3" y="3" width="18" height="18" rx="2"']], cuts: [["cut", "circle", 'cx="19" cy="5" r="5.5"'], ["cut", "circle", 'cx="9" cy="9" r="2"'], ["cutline", "path", 'd="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"']], top: [["line", "path", 'd="M16 5h6"'], ["line", "path", 'd="M19 2v6"']] },
  "columns-2": { from: "columns-2", kind: "filled", status: "PROPOSED", note: "Compare side by side.", body: [["fill", "rect", 'x="3" y="3" width="18" height="18" rx="2"']], cuts: [["cutline", "path", 'd="M12 3v18"', { w: 1.75 }]] },
  type: { from: "type", kind: "line", status: "PROPOSED", body: [["line", "path", 'd="M12 4v16"'], ["line", "path", 'd="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2"'], ["line", "path", 'd="M9 20h6"']] },
  expand: { from: "expand", kind: "line", status: "PROPOSED", note: "Open a creative full screen.", body: [["line", "path", 'd="m15 15 6 6"'], ["line", "path", 'd="m15 9 6-6"'], ["line", "path", 'd="M21 16v5h-5"'], ["line", "path", 'd="M21 8V3h-5"'], ["line", "path", 'd="M3 16v5h5"'], ["line", "path", 'd="m3 21 6-6"'], ["line", "path", 'd="M3 8V3h5"'], ["line", "path", 'd="M9 9 3 3"']] },

  // Fume's own icons.
  "fume-check": {
    kind: "fume", note: "The checked triangle: the Focus point at the logo angle. Amber (--ui-check) when the work is approved; grey (--ui-check-waiting) while it is sent for approval (Marcus 13 Oct).",
    body: [["solid", "path", point([4.9, 4.9], 150 * (17 / 122), 0)]],
  },
  "fume-engine": {
    kind: "fume", status: "DECIDED", note: "AI and the Engine (DECIDED by Marcus 13 Oct 2026, F-D068): the focal point inside the two frame corners (Focus System: focal point = the Engine). Never stars or sparkles.",
    body: [["solid", "path", corner([2.5, 2.5])], ["solid", "path", corner([21.5, 21.5], {}, true)], ["solid", "path", focal(12, 12.4, 9)]],
  },
};
