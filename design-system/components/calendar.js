// Calendar and date picker. DECIDED 13 Oct, from round 7.
// Calendar: <div class="ui-calendar" data-ui-calendar data-mode="single|range" data-month="2026-10"
//             data-value="2026-10-14/2026-10-27" data-today="2026-10-13" data-min="2026-10-13" data-max=""
//             data-disabled="2026-10-24,2026-10-25" aria-label="Campaign dates"></div>
//   Renders the month (Monday first, days outside the month left out), selects on click (range: the first
//   click starts, the second ends; a click before the start starts again), previews the range under the
//   pointer, and moves with the keyboard: arrows by day and week, Home/End to the week's ends, PageUp/
//   PageDown by month (with Shift by year), Enter or Space selects. Dispatches "fume:calendar-change" with
//   { start, end } (ISO dates, end only in range mode) on the element. Add .ui-calendar--glass on glass.
// Date picker: <div class="ui-date-picker" data-ui-date-picker> a .ui-date-field button (aria-controls the
//   popover) with a .ui-date-value, and a .ui-glass.ui-calendar-popover holding the calendar, an optional
//   .ui-calendar-summary and a [data-ui-calendar-clear] button. The field opens and closes the popover;
//   Escape or a click outside closes it and focus returns to the field. A single date closes it on pick.
// fumeCalendar(el) / fumeDatePicker(el) are safe to call twice.
(function () {
  if (window.fumeCalendar) return;
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const parse = (s) => { const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec((s || "").trim()); return m ? new Date(+m[1], +m[2] - 1, +(m[3] || 1)) : null; };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const same = (a, b) => !!a && !!b && iso(a) === iso(b);
  const fmt = (d, o) => d.toLocaleDateString("en-GB", o);
  const WD = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"], WDL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  let uid = 0;

  function fumeCalendar(el) {
    if (!el || el.__fumeCalendar) return el && el.__fumeCalendar;
    const range = el.dataset.mode === "range";
    const glass = el.classList.contains("ui-calendar--glass");
    const today = parse(el.dataset.today) || new Date();
    const min = parse(el.dataset.min), max = parse(el.dataset.max);
    const off = new Set((el.dataset.disabled || "").split(",").map((s) => s.trim()).filter(Boolean));
    const [v0, v1] = (el.dataset.value || "").split("/");
    let start = parse(v0), end = range ? parse(v1) : null, hover = null;
    let view = parse(el.dataset.month) || start || today; view = new Date(view.getFullYear(), view.getMonth(), 1);
    let focusDay = start || (min && min > today ? min : today);
    const id = "ui-cal-" + (++uid);
    const isOff = (d) => (min && d < min) || (max && d > max) || off.has(iso(d));
    const btn = glass ? "ui-btn ui-btn--glass-clear ui-btn--icon ui-btn--sm" : "ui-btn ui-btn--secondary ui-btn--icon ui-btn--sm";

    el.setAttribute("data-slot", "calendar");
    el.innerHTML =
      '<div class="ui-calendar-header"><div class="ui-calendar-caption" id="' + id + '-caption" aria-live="polite"></div>' +
      '<div class="ui-calendar-nav">' +
      '<button class="' + btn + ' ui-calendar-prev" type="button" aria-label="Previous month"><svg aria-hidden="true"><use href="#fi-chevron-left"/></svg></button>' +
      '<button class="' + btn + ' ui-calendar-next" type="button" aria-label="Next month"><svg aria-hidden="true"><use href="#fi-chevron-right"/></svg></button></div></div>' +
      '<table class="ui-calendar-grid" role="grid" aria-labelledby="' + id + '-caption"><thead><tr>' +
      WD.map((w, i) => '<th class="ui-calendar-weekday" scope="col"><abbr title="' + WDL[i] + '">' + w + "</abbr></th>").join("") +
      "</tr></thead><tbody></tbody></table>";
    const cap = el.querySelector(".ui-calendar-caption"), tbody = el.querySelector("tbody");

    function render(focus) {
      cap.textContent = fmt(view, { month: "long", year: "numeric" });
      const first = view, lead = (first.getDay() + 6) % 7, days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
      if (focusDay.getMonth() !== view.getMonth() || focusDay.getFullYear() !== view.getFullYear()) {
        let d = new Date(view); while (isOff(d) && d.getMonth() === view.getMonth()) d = addDays(d, 1);
        focusDay = d.getMonth() === view.getMonth() ? d : new Date(view);
      }
      let html = "", cell = 0;
      for (let w = 0; w < Math.ceil((lead + days) / 7); w++) {
        html += '<tr>';
        for (let c = 0; c < 7; c++, cell++) {
          const n = cell - lead + 1;
          if (n < 1 || n > days) { html += '<td class="ui-calendar-cell" role="presentation"></td>'; continue; }
          const d = new Date(view.getFullYear(), view.getMonth(), n);
          html += '<td class="ui-calendar-cell" role="gridcell"><button class="ui-calendar-day" type="button" data-date="' + iso(d) + '"' +
            (same(d, today) ? " data-today" : "") + (isOff(d) ? " disabled" : "") +
            ' aria-label="' + fmt(d, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) + (same(d, today) ? ", today" : "") + '"' +
            ' tabindex="' + (same(d, focusDay) ? 0 : -1) + '">' + n + "</button></td>";
        }
        html += "</tr>";
      }
      tbody.innerHTML = html;
      paint();
      if (focus) { const b = tbody.querySelector('[data-date="' + iso(focusDay) + '"]'); if (b) b.focus(); }
    }
    // selection, range band and caps, without rebuilding the grid
    function paint() {
      const a = start, b = range ? (end || (hover && start && hover > start ? hover : null)) : null;
      const cells = Array.from(tbody.querySelectorAll("td"));
      cells.forEach((td, i) => {
        const day = td.firstElementChild; td.removeAttribute("data-range"); td.removeAttribute("data-cap"); td.removeAttribute("aria-selected");
        if (!day) return;
        const d = parse(day.dataset.date);
        const sel = same(d, a) || (range && same(d, end));
        day.toggleAttribute("data-selected", !!sel);
        if (td.getAttribute("role") === "gridcell") td.setAttribute("aria-selected", String(!!sel || (range && a && b && d > a && d < b)));
        if (!range || !a || !b) return;
        if (same(a, b) && same(d, a)) return;
        let r = null;
        if (same(d, a)) r = "start"; else if (same(d, b)) r = "end"; else if (d > a && d < b) r = "middle";
        if (!r) return;
        td.dataset.range = r;
        const col = i % 7, caps = [];
        const prevEmpty = col === 0 || !cells[i - 1].firstElementChild, nextEmpty = col === 6 || !cells[i + 1] || !cells[i + 1].firstElementChild;
        if (r !== "start" && prevEmpty) caps.push("start");
        if (r !== "end" && nextEmpty) caps.push("end");
        if (caps.length) td.dataset.cap = caps.join(" ");
      });
    }
    function pick(d) {
      if (isOff(d)) return;
      if (!range) { start = d; }
      else if (!start || end || d < start) { start = d; end = null; }
      else { end = d; }
      hover = null; focusDay = d; paint();
      el.dispatchEvent(new CustomEvent("fume:calendar-change", { bubbles: true, detail: { start: start ? iso(start) : null, end: end ? iso(end) : null, complete: !range || !!end } }));
    }
    function move(d, focus) {
      focusDay = d;
      if (d.getMonth() !== view.getMonth() || d.getFullYear() !== view.getFullYear()) { view = new Date(d.getFullYear(), d.getMonth(), 1); render(focus); return; }
      tbody.querySelectorAll(".ui-calendar-day").forEach((x) => { x.tabIndex = x.dataset.date === iso(d) ? 0 : -1; });
      if (focus) { const b = tbody.querySelector('[data-date="' + iso(d) + '"]'); if (b) b.focus(); }
    }
    el.addEventListener("click", (e) => {
      if (e.target.closest(".ui-calendar-prev")) { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); render(); return; }
      if (e.target.closest(".ui-calendar-next")) { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); render(); return; }
      const b = e.target.closest(".ui-calendar-day"); if (b && !b.disabled) pick(parse(b.dataset.date));
    });
    el.addEventListener("pointerover", (e) => {
      if (!range || !start || end) return;
      const b = e.target.closest(".ui-calendar-day"); const d = b && !b.disabled ? parse(b.dataset.date) : null;
      if (!same(d, hover)) { hover = d; paint(); }
    });
    el.addEventListener("pointerleave", () => { if (hover) { hover = null; paint(); } });
    el.addEventListener("keydown", (e) => {
      const b = e.target.closest(".ui-calendar-day"); if (!b) return;
      const d = parse(b.dataset.date), col = (d.getDay() + 6) % 7;
      const k = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
      let next = null;
      if (k) next = addDays(d, k);
      else if (e.key === "Home") next = addDays(d, -col);
      else if (e.key === "End") next = addDays(d, 6 - col);
      else if (e.key === "PageUp" || e.key === "PageDown") { const s = (e.key === "PageUp" ? -1 : 1) * (e.shiftKey ? 12 : 1); next = new Date(d.getFullYear(), d.getMonth() + s, Math.min(d.getDate(), 28)); }
      if (next) { e.preventDefault(); move(next, true); if (range && start && !end) { hover = next; paint(); } }
    });
    render();
    const api = {
      get value() { return { start: start ? iso(start) : null, end: end ? iso(end) : null }; },
      set(s, e2) { start = parse(s); end = range ? parse(e2) : null; if (start) { view = new Date(start.getFullYear(), start.getMonth(), 1); focusDay = start; } render(); },
      clear() { start = end = hover = null; paint(); el.dispatchEvent(new CustomEvent("fume:calendar-change", { bubbles: true, detail: { start: null, end: null, complete: false } })); },
      focus() { move(focusDay, true); },
    };
    el.__fumeCalendar = api;
    return api;
  }

  function label(start, end, range) {
    const s = parse(start), e = parse(end);
    if (!s) return null;
    if (!range) return fmt(s, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    if (!e) return fmt(s, { day: "numeric", month: "short" }) + " – pick the last day";
    if (s.getFullYear() !== e.getFullYear()) return fmt(s, { day: "numeric", month: "short", year: "numeric" }) + " – " + fmt(e, { day: "numeric", month: "short", year: "numeric" });
    if (s.getMonth() !== e.getMonth()) return fmt(s, { day: "numeric", month: "short" }) + " – " + fmt(e, { day: "numeric", month: "short", year: "numeric" });
    return s.getDate() + " – " + fmt(e, { day: "numeric", month: "short", year: "numeric" });
  }

  function fumeDatePicker(root) {
    if (!root || root.__fumeDatePicker) return root && root.__fumeDatePicker;
    const field = root.querySelector(".ui-date-field");
    const pop = field && document.getElementById(field.getAttribute("aria-controls"));
    const calEl = pop && pop.querySelector("[data-ui-calendar]");
    if (!field || !pop || !calEl) return null;
    const cal = fumeCalendar(calEl), range = calEl.dataset.mode === "range";
    const valueEl = field.querySelector(".ui-date-value"), summary = pop.querySelector(".ui-calendar-summary");
    const placeholder = valueEl ? valueEl.dataset.placeholder || "Pick a date" : "";
    const setOpen = (open, focus) => {
      field.setAttribute("aria-expanded", String(open)); pop.dataset.state = open ? "open" : "closed"; pop.hidden = !open;
      if (open && focus) setTimeout(() => cal.focus(), 0);
      if (!open && focus) field.focus({ preventScroll: true });
    };
    const show = (v) => {
      const t = label(v.start, v.end, range);
      if (valueEl) { valueEl.textContent = t || placeholder; valueEl.toggleAttribute("data-empty", !t); }
      if (summary) {
        const s = parse(v.start), e = parse(v.end);
        summary.textContent = !s ? (range ? "Pick the first day" : "Pick a date") : range && !e ? "Pick the last day" : range ? Math.round((e - s) / 864e5) + 1 + " days" : "";
      }
    };
    field.addEventListener("click", () => setOpen(field.getAttribute("aria-expanded") !== "true", true));
    calEl.addEventListener("fume:calendar-change", (e) => { show(e.detail); if (!range && e.detail.complete) setOpen(false, true); });
    pop.addEventListener("click", (e) => { if (e.target.closest("[data-ui-calendar-clear]")) { cal.clear(); cal.focus(); } });
    root.addEventListener("keydown", (e) => { if (e.key === "Escape" && field.getAttribute("aria-expanded") === "true") { e.stopPropagation(); setOpen(false, true); } });
    document.addEventListener("pointerdown", (e) => { if (field.getAttribute("aria-expanded") === "true" && !root.contains(e.target)) setOpen(false); });
    const initial = pop.dataset.state === "open" || (!pop.hidden && pop.dataset.state !== "closed");
    setOpen(initial, false); show(cal.value);
    const api = { open: () => setOpen(true, true), close: () => setOpen(false, true), calendar: cal };
    root.__fumeDatePicker = api;
    return api;
  }

  const initAll = () => {
    document.querySelectorAll("[data-ui-date-picker]").forEach(fumeDatePicker);
    document.querySelectorAll("[data-ui-calendar]").forEach(fumeCalendar);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAll); else initAll();
  window.fumeCalendar = fumeCalendar;
  window.fumeDatePicker = fumeDatePicker;
})();
