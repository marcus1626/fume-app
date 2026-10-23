// Checkbox: toggles .ui-checkbox (a <button role="checkbox">) and keeps "select all" in step. DECIDED 13 Oct, from round 7.
// Same states as Radix Checkbox: aria-checked true | false | mixed, data-state checked | unchecked | indeterminate.
// Space toggles (the button's own click); Enter does not, as in Radix. A label around the box or with
// for= toggles it too.
// Select all: put the boxes in one container with data-ui-checkbox-group, mark the parent box with
// data-ui-checkbox-all. The parent turns mixed when some are checked and checks or clears them all.
// Each change dispatches "ui-checkedchange" (bubbles; detail.checked is true, false or "mixed").
// Clicks are delegated from the document, so boxes added later work too. fumeCheckbox(root) settles
// data-state and the select-all boxes under root (call it after rendering); safe to load twice.
(() => {
  if (window.fumeCheckbox) return;
  const SEL = '.ui-checkbox[role="checkbox"]';
  const off = (el) => el.disabled || el.hasAttribute("data-disabled") || el.getAttribute("aria-disabled") === "true";
  const STATE = { true: "checked", false: "unchecked", mixed: "indeterminate" };
  const set = (el, v, notify) => {
    const before = el.getAttribute("aria-checked");
    el.setAttribute("aria-checked", v); el.dataset.state = STATE[v];
    const ind = el.querySelector(".ui-checkbox-indicator"); if (ind) ind.dataset.state = STATE[v];
    if (notify && before !== v) el.dispatchEvent(new CustomEvent("ui-checkedchange", { bubbles: true, detail: { checked: v === "mixed" ? "mixed" : v === "true" } }));
  };
  const sync = (group, notify) => {
    const all = group.querySelector(SEL + "[data-ui-checkbox-all]"); if (!all) return;
    const kids = Array.from(group.querySelectorAll(SEL + ":not([data-ui-checkbox-all])"));
    const on = kids.filter((k) => k.getAttribute("aria-checked") === "true").length;
    set(all, on === 0 ? "false" : on === kids.length ? "true" : "mixed", notify);
  };
  document.addEventListener("click", (e) => {
    const el = e.target.closest && e.target.closest(SEL);
    if (!el || off(el)) return;
    const next = el.getAttribute("aria-checked") === "true" ? "false" : "true"; // mixed checks, as in Radix
    set(el, next, true);
    const group = el.closest("[data-ui-checkbox-group]");
    if (!group) return;
    if (el.hasAttribute("data-ui-checkbox-all")) group.querySelectorAll(SEL + ":not([data-ui-checkbox-all])").forEach((k) => { if (!off(k)) set(k, next, true); });
    sync(group, true);
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.closest && e.target.closest(SEL)) e.preventDefault(); });
  window.fumeCheckbox = (root = document) => {
    root.querySelectorAll(SEL).forEach((el) => set(el, el.getAttribute("aria-checked") || "false"));
    root.querySelectorAll("[data-ui-checkbox-group]").forEach((g) => sync(g));
    if (root.matches && root.matches("[data-ui-checkbox-group]")) sync(root);
  };
  // fumeCheckbox.set(el, true | false | "mixed") changes a box from code and keeps its group in step
  window.fumeCheckbox.set = (el, v) => { set(el, String(v), true); const g = el.closest("[data-ui-checkbox-group]"); if (g && !el.hasAttribute("data-ui-checkbox-all")) sync(g, true); };
  if (document.readyState !== "loading") window.fumeCheckbox(); else document.addEventListener("DOMContentLoaded", () => window.fumeCheckbox());
})();
