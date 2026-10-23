// Tabs: shadcn's tabs API on Fume's segmented control. DECIDED 13 Oct, from round 7.
// Markup: <div class="ui-tabs" data-ui-tabs data-orientation="horizontal|vertical">
//           horizontal: <div class="ui-seg ui-tabs-list" role="tablist"><span class="ui-seg-indicator"></span>
//                         <button class="ui-seg-option ui-tabs-trigger" role="tab" aria-selected="true" aria-controls="p1">…
//           vertical:   <div class="ui-tabs-list ui-tabs-list--vertical" role="tablist" aria-orientation="vertical">
//                         <span class="ui-tabs-indicator"></span><button class="ui-tabs-trigger" role="tab" …>…
//           <div class="ui-tabs-content" role="tabpanel" id="p1" tabindex="0">…</div> …
// Panels follow the selected trigger (data-state active/inactive on both, hidden on inactive panels), whoever
// moved the selection: segmented.js for the horizontal list, this file for the vertical one (click, arrow
// keys, Home/End; the white pill slides). A horizontal list nobody has set up yet gets fumeSegmented.
// fumeTabs(root) is safe to call twice; it dispatches "fume:tabs-change" with { value: trigger } on the root.
(function () {
  if (window.fumeTabs) return;

  function placeVertical(list) {
    const ind = list.querySelector(".ui-tabs-indicator");
    const sel = list.querySelector('.ui-tabs-trigger[aria-selected="true"]');
    if (!ind || !sel) return;
    ind.style.setProperty("--y", sel.offsetTop + "px");
    ind.style.setProperty("--h", sel.offsetHeight + "px");
  }

  function fumeTabs(root) {
    if (!root || root.__fumeTabs) return root && root.__fumeTabs;
    const list = root.querySelector('[role="tablist"]');
    if (!list) return null;
    const triggers = () => Array.from(list.querySelectorAll('[role="tab"]'));
    const sync = () => {
      triggers().forEach((t) => {
        const on = t.getAttribute("aria-selected") === "true";
        t.dataset.state = on ? "active" : "inactive";
        const p = document.getElementById(t.getAttribute("aria-controls"));
        if (p) { p.dataset.state = on ? "active" : "inactive"; p.hidden = !on; }
      });
    };
    const vertical = list.classList.contains("ui-tabs-list--vertical");
    if (vertical) {
      const select = (t, focus) => {
        if (!t || t.disabled || t.hasAttribute("data-disabled") || t.getAttribute("aria-selected") === "true") return;
        triggers().forEach((o) => { o.setAttribute("aria-selected", String(o === t)); o.tabIndex = o === t ? 0 : -1; });
        if (focus) t.focus();
        placeVertical(list);
      };
      triggers().forEach((o) => { o.tabIndex = o.getAttribute("aria-selected") === "true" ? 0 : -1; });
      list.classList.add("is-placing"); placeVertical(list);
      requestAnimationFrame(() => requestAnimationFrame(() => { list.classList.add("is-ready"); list.classList.remove("is-placing"); }));
      list.addEventListener("click", (e) => select(e.target.closest('[role="tab"]')));
      list.addEventListener("keydown", (e) => {
        const all = triggers().filter((t) => !t.disabled && !t.hasAttribute("data-disabled")), i = all.indexOf(document.activeElement);
        if (i < 0) return;
        const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
        if (step) { e.preventDefault(); select(all[(i + step + all.length) % all.length], true); }
        if (e.key === "Home") { e.preventDefault(); select(all[0], true); }
        if (e.key === "End") { e.preventDefault(); select(all[all.length - 1], true); }
      });
      if (window.ResizeObserver) new ResizeObserver(() => { list.classList.add("is-placing"); placeVertical(list); requestAnimationFrame(() => list.classList.remove("is-placing")); }).observe(list);
    } else if (list.classList.contains("ui-seg") && window.fumeSegmented) {
      // The board (and apps) may set the control up themselves; only do it if nobody has by the next tick.
      setTimeout(() => { if (!list.classList.contains("is-ready") && !list.classList.contains("is-placing")) window.fumeSegmented(list); }, 0);
    }
    new MutationObserver((recs) => {
      if (!recs.some((r) => r.attributeName === "aria-selected" && r.target.getAttribute("aria-selected") === "true")) return;
      sync();
      const t = triggers().find((x) => x.getAttribute("aria-selected") === "true");
      root.dispatchEvent(new CustomEvent("fume:tabs-change", { detail: { value: t } }));
    }).observe(list, { subtree: true, attributes: true, attributeFilter: ["aria-selected"] });
    sync();
    const api = { sync };
    root.__fumeTabs = api;
    return api;
  }

  const initAll = () => document.querySelectorAll("[data-ui-tabs]").forEach(fumeTabs);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAll); else initAll();
  window.fumeTabs = fumeTabs;
})();
