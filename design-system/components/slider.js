// Slider: places and drives .ui-slider (one thumb, or two for a range). DECIDED 13 Oct, from round 7.
// Same parts and attributes as Radix Slider: thumbs with role="slider", aria-valuemin/max/now, and
// data-orientation / data-disabled on the root. Read from the root: data-min, data-max, data-step
// (default 0, 100, 1) and data-suffix for the value text ("s", "%"); each thumb's aria-valuenow.
// Pointer: press anywhere on the track and the nearest thumb jumps there and follows the drag (it gets
// data-dragging, so its value bubble shows). Keyboard on a thumb: arrows one step, Shift+arrows and
// Page Up/Down ten steps, Home/End the ends. Thumbs of a range never cross.
// Dispatches "ui-valuechange" while moving and "ui-valuecommit" when let go (bubble from the root;
// detail.values). fumeSlider(root) sets up every slider under root (call it after rendering);
// fumeSlider.set(slider, [values]) moves it from code. Safe to load twice.
(() => {
  if (window.fumeSlider) return;
  const num = (v, d) => (v === null || v === undefined || v === "" || isNaN(+v) ? d : +v);
  const conf = (el) => ({
    min: num(el.dataset.min, 0), max: num(el.dataset.max, 100), step: num(el.dataset.step, 1),
    suffix: el.dataset.suffix || "", vertical: el.dataset.orientation === "vertical",
  });
  const thumbs = (el) => Array.from(el.querySelectorAll('.ui-slider-thumb[role="slider"]'));
  const text = (c, v) => {
    const dec = (String(c.step).split(".")[1] || "").length;
    return v.toFixed(dec) + (c.suffix ? " " + c.suffix : "");
  };
  const render = (el, notify) => {
    const c = conf(el), ts = thumbs(el), span = c.max - c.min || 1;
    const vals = ts.map((t) => num(t.getAttribute("aria-valuenow"), c.min));
    ts.forEach((t, i) => {
      const v = vals[i];
      t.style.setProperty("--p", String((v - c.min) / span));
      t.setAttribute("aria-valuemin", String(i > 0 ? vals[i - 1] : c.min));
      t.setAttribute("aria-valuemax", String(i < ts.length - 1 ? vals[i + 1] : c.max));
      t.setAttribute("aria-valuetext", text(c, v));
      t.setAttribute("aria-orientation", c.vertical ? "vertical" : "horizontal");
      const out = t.querySelector(".ui-slider-value"); if (out) out.textContent = text(c, v);
    });
    el.dataset.thumbs = String(ts.length);
    el.style.setProperty("--a", ts.length > 1 ? String((vals[0] - c.min) / span) : "0");
    el.style.setProperty("--b", String((vals[vals.length - 1] - c.min) / span));
    if (notify) el.dispatchEvent(new CustomEvent(notify, { bubbles: true, detail: { values: vals } }));
    return vals;
  };
  const setValue = (el, i, v, notify) => {
    const c = conf(el), ts = thumbs(el);
    const lo = i > 0 ? num(ts[i - 1].getAttribute("aria-valuenow"), c.min) : c.min;
    const hi = i < ts.length - 1 ? num(ts[i + 1].getAttribute("aria-valuenow"), c.max) : c.max;
    const snapped = Math.round((v - c.min) / c.step) * c.step + c.min;
    const next = Math.min(hi, Math.max(lo, +snapped.toFixed(6)));
    if (num(ts[i].getAttribute("aria-valuenow"), NaN) === next) return false;
    ts[i].setAttribute("aria-valuenow", String(next));
    render(el, notify);
    return true;
  };
  const disabled = (el) => el.hasAttribute("data-disabled") || el.getAttribute("aria-disabled") === "true";
  const fromPointer = (el, e) => {
    const c = conf(el), r = el.getBoundingClientRect(), t = thumbs(el)[0], size = t ? t.offsetWidth : 0;
    const f = c.vertical ? (r.bottom - e.clientY - size / 2) / ((r.height - size) || 1) : (e.clientX - r.left - size / 2) / ((r.width - size) || 1);
    return c.min + Math.min(1, Math.max(0, f)) * (c.max - c.min);
  };
  const setup = (el) => {
    if (!thumbs(el).length) return; // a drawing of a slider (no role="slider" thumbs): leave it alone
    if (el.dataset.uiSlider === "ready") { render(el); return; }
    el.dataset.uiSlider = "ready";
    el.dataset.orientation = el.dataset.orientation || "horizontal";
    thumbs(el).forEach((t) => { if (disabled(el)) t.removeAttribute("tabindex"); else t.tabIndex = 0; });
    let active = -1;
    el.addEventListener("pointerdown", (e) => {
      if (disabled(el) || (e.pointerType === "mouse" && e.button !== 0)) return;
      const ts = thumbs(el), v = fromPointer(el, e);
      const vals = ts.map((t) => num(t.getAttribute("aria-valuenow"), 0));
      const onThumb = e.target.closest(".ui-slider-thumb");
      active = onThumb ? ts.indexOf(onThumb) : vals.reduce((best, x, i) => (Math.abs(x - v) < Math.abs(vals[best] - v) || (x === vals[best] && v > x) ? i : best), 0);
      e.preventDefault();
      ts[active].focus({ preventScroll: true });
      ts[active].setAttribute("data-dragging", "");
      el.setPointerCapture(e.pointerId);
      if (!onThumb) setValue(el, active, v, "ui-valuechange");
    });
    el.addEventListener("pointermove", (e) => { if (active >= 0) setValue(el, active, fromPointer(el, e), "ui-valuechange"); });
    const end = () => {
      if (active < 0) return;
      thumbs(el)[active].removeAttribute("data-dragging"); active = -1;
      el.dispatchEvent(new CustomEvent("ui-valuecommit", { bubbles: true, detail: { values: render(el) } }));
    };
    el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end); el.addEventListener("lostpointercapture", end);
    el.addEventListener("keydown", (e) => {
      const t = e.target.closest(".ui-slider-thumb"); if (!t || disabled(el)) return;
      const c = conf(el), i = thumbs(el).indexOf(t), v = num(t.getAttribute("aria-valuenow"), c.min);
      const big = c.step * 10;
      const delta = { ArrowRight: c.step, ArrowUp: c.step, ArrowLeft: -c.step, ArrowDown: -c.step, PageUp: big, PageDown: -big }[e.key];
      let next = null;
      if (delta !== undefined) next = v + (e.shiftKey && /Arrow/.test(e.key) ? delta * 10 : delta);
      if (e.key === "Home") next = c.min;
      if (e.key === "End") next = c.max;
      if (next === null) return;
      e.preventDefault();
      if (setValue(el, i, next, "ui-valuechange")) el.dispatchEvent(new CustomEvent("ui-valuecommit", { bubbles: true, detail: { values: render(el) } }));
    });
    render(el);
  };
  window.fumeSlider = (root = document) => {
    const list = Array.from(root.querySelectorAll(".ui-slider"));
    if (root.matches && root.matches(".ui-slider")) list.push(root);
    list.forEach(setup);
  };
  window.fumeSlider.set = (el, values) => { [].concat(values).forEach((v, i) => { const t = thumbs(el)[i]; if (t) t.setAttribute("aria-valuenow", String(v)); }); render(el, "ui-valuechange"); };
  if (document.readyState !== "loading") window.fumeSlider(); else document.addEventListener("DOMContentLoaded", () => window.fumeSlider());
})();
