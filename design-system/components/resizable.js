// Resizable panels. DECIDED 13 Oct, from round 8. Runs shadcn's resizable (react-resizable-panels) on Fume's handle.
// Markup: <div class="ui-resizable" data-ui-resizable data-orientation="horizontal|vertical">
//           <div class="ui-resizable-panel" id="a" data-default-size="40" data-min-size="25" data-max-size="70">…</div>
//           <div class="ui-resizable-handle" role="separator" tabindex="0" aria-label="…"><span class="ui-resizable-grip"></span></div>
//           <div class="ui-resizable-panel">…</div></div>
// Sizes are percent of the group, set as the panels' flex-grow (--panel-size) and data-panel-size. Each
// handle is a separator for the panel before it: aria-orientation (vertical between side-by-side panels),
// aria-valuenow/min/max in percent, aria-controls. Drag it (pointer capture, touch too), or use the keys:
// arrows step by --ui-resizable-step (Shift: twice), Home/End go to the least and most size; a double click
// puts the defaults back. data-resize-handle-state is hover, drag or inactive, as react-resizable-panels.
// Each change fires "ui:resize" on the group with detail.sizes. window.fumeResizable(group) returns
// { sizes(), set(sizes), reset() }; groups with data-ui-resizable start by themselves. Safe to load twice.
(() => {
  if (window.fumeResizable) return;
  const round = (n) => Math.round(n * 10) / 10;

  function fumeResizable(group) {
    if (!group) return null;
    if (group.__fumeResizable) return group.__fumeResizable;
    const vertical = () => (group.dataset.orientation || group.dataset.panelGroupDirection) === "vertical";
    const panels = () => Array.from(group.children).filter((c) => c.classList.contains("ui-resizable-panel"));
    const handles = () => Array.from(group.children).filter((c) => c.classList.contains("ui-resizable-handle"));
    const num = (v, fb) => { const n = parseFloat(v); return isNaN(n) ? fb : n; };
    const lim = (p) => ({ min: num(p.dataset.minSize, 0), max: num(p.dataset.maxSize, 100) });

    const defaults = () => {
      const ps = panels(), given = ps.map((p) => num(p.dataset.defaultSize, NaN));
      const known = given.filter((n) => !isNaN(n)), rest = (100 - known.reduce((a, b) => a + b, 0)) / Math.max(1, given.length - known.length);
      return given.map((n) => (isNaN(n) ? rest : n));
    };
    let sizes = defaults();

    function apply(changed) {
      const ps = panels();
      ps.forEach((p, i) => { p.style.setProperty("--panel-size", String(sizes[i])); p.setAttribute("data-panel-size", String(round(sizes[i]))); });
      handles().forEach((h, i) => {
        const a = ps[i], b = ps[i + 1]; if (!a || !b) return;
        const la = lim(a), lb = lim(b), pair = sizes[i] + sizes[i + 1];
        h.setAttribute("role", "separator");
        h.setAttribute("aria-orientation", vertical() ? "horizontal" : "vertical");
        h.setAttribute("aria-valuenow", String(Math.round(sizes[i])));
        h.setAttribute("aria-valuemin", String(Math.round(Math.max(la.min, pair - lb.max))));
        h.setAttribute("aria-valuemax", String(Math.round(Math.min(la.max, pair - lb.min))));
        if (a.id) h.setAttribute("aria-controls", a.id);
        if (!h.hasAttribute("tabindex") && !h.hasAttribute("data-disabled")) h.tabIndex = 0;
        if (!h.dataset.resizeHandleState) h.dataset.resizeHandleState = "inactive";
      });
      if (changed) group.dispatchEvent(new CustomEvent("ui:resize", { bubbles: true, detail: { sizes: sizes.map(round) } }));
    }
    // move handle i: the panel before it takes `value` percent, the one after gives or takes the rest
    function setAt(i, value) {
      const ps = panels(), a = ps[i], b = ps[i + 1]; if (!a || !b) return;
      const la = lim(a), lb = lim(b), pair = sizes[i] + sizes[i + 1];
      const lo = Math.max(la.min, pair - lb.max), hi = Math.min(la.max, pair - lb.min);
      const v = Math.min(hi, Math.max(lo, value));
      if (Math.abs(v - sizes[i]) < 0.05) return;
      sizes[i] = v; sizes[i + 1] = pair - v;
      apply(true);
    }
    const stepSize = () => num(getComputedStyle(group).getPropertyValue("--ui-resizable-step"), 5);

    handles().forEach((h, i) => {
      h.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse" && h.dataset.resizeHandleState !== "drag") h.dataset.resizeHandleState = "hover"; });
      h.addEventListener("pointerleave", () => { if (h.dataset.resizeHandleState === "hover") h.dataset.resizeHandleState = "inactive"; });
      h.addEventListener("pointerdown", (e) => {
        if (e.button !== 0 || h.hasAttribute("data-disabled")) return;
        const ps = panels(), a = ps[i], b = ps[i + 1]; if (!a || !b) return;
        e.preventDefault();
        try { h.setPointerCapture(e.pointerId); } catch (err) { /* already released */ }
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        const span = vertical() ? ra.height + rb.height : ra.width + rb.width;
        const start = vertical() ? e.clientY : e.clientX, from = sizes[i], pair = sizes[i] + sizes[i + 1];
        h.dataset.resizeHandleState = "drag"; group.setAttribute("data-resizing", "");
        const move = (ev) => { const d = (vertical() ? ev.clientY : ev.clientX) - start; if (span > 0) setAt(i, from + (d / span) * pair); };
        const up = (ev) => {
          h.removeEventListener("pointermove", move); h.removeEventListener("pointerup", up); h.removeEventListener("pointercancel", up);
          group.removeAttribute("data-resizing");
          h.dataset.resizeHandleState = ev.pointerType === "mouse" && h.matches(":hover") ? "hover" : "inactive";
        };
        h.addEventListener("pointermove", move); h.addEventListener("pointerup", up); h.addEventListener("pointercancel", up);
      });
      h.addEventListener("keydown", (e) => {
        if (h.hasAttribute("data-disabled")) return;
        const s = stepSize() * (e.shiftKey ? 2 : 1);
        const less = vertical() ? "ArrowUp" : "ArrowLeft", more = vertical() ? "ArrowDown" : "ArrowRight";
        if (e.key === less) { e.preventDefault(); setAt(i, sizes[i] - s); }
        else if (e.key === more) { e.preventDefault(); setAt(i, sizes[i] + s); }
        else if (e.key === "Home") { e.preventDefault(); setAt(i, -Infinity); }
        else if (e.key === "End") { e.preventDefault(); setAt(i, Infinity); }
      });
      h.addEventListener("dblclick", () => { sizes = defaults(); apply(true); });
    });

    apply(false);
    group.__fumeResizable = {
      sizes: () => sizes.map(round),
      set: (next) => { if (Array.isArray(next) && next.length === sizes.length) { sizes = next.slice(); apply(true); } },
      reset: () => { sizes = defaults(); apply(true); },
    };
    return group.__fumeResizable;
  }

  const initAll = () => document.querySelectorAll("[data-ui-resizable]").forEach(fumeResizable);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAll); else initAll();
  window.fumeResizable = fumeResizable;
})();
