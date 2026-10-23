// Radio group: picks one .ui-radio (a <button role="radio">) in its [role="radiogroup"]. DECIDED 13 Oct, from round 7.
// Same states as Radix RadioGroup: aria-checked and data-state="checked|unchecked" on each item.
// Keyboard as in Radix: Tab reaches the chosen item only (roving focus); the arrow keys move to the next
// or previous item and choose it, wrapping and skipping disabled ones; Space chooses the focused item.
// A label around the radio (a .ui-choice row, a .ui-radio-card) chooses it too.
// Each change dispatches "ui-valuechange" on the group (bubbles; detail.value is the item's value or id).
// Clicks and keys are delegated from the document. fumeRadio(root) sets the roving tabindex and
// data-state under root (call it after rendering); safe to load twice.
(() => {
  if (window.fumeRadio) return;
  const ITEM = '[role="radio"].ui-radio';
  const off = (el) => el.disabled || el.hasAttribute("data-disabled");
  const items = (g) => Array.from(g.querySelectorAll(ITEM)).filter((el) => el.closest('[role="radiogroup"]') === g);
  const settle = (g) => {
    const list = items(g), on = list.find((el) => el.getAttribute("aria-checked") === "true");
    const first = on || list.find((el) => !off(el));
    list.forEach((el) => {
      const c = el === on; el.setAttribute("aria-checked", String(c)); el.dataset.state = c ? "checked" : "unchecked";
      el.tabIndex = el === first ? 0 : -1;
    });
  };
  const choose = (el, focus) => {
    const g = el.closest('[role="radiogroup"]'); if (!g || off(el)) return;
    const was = el.getAttribute("aria-checked") === "true";
    items(g).forEach((x) => { const c = x === el; x.setAttribute("aria-checked", String(c)); x.dataset.state = c ? "checked" : "unchecked"; x.tabIndex = c ? 0 : -1; });
    if (focus) el.focus();
    if (!was) g.dispatchEvent(new CustomEvent("ui-valuechange", { bubbles: true, detail: { value: el.value || el.dataset.value || el.id, item: el } }));
  };
  document.addEventListener("click", (e) => { const el = e.target.closest && e.target.closest(ITEM); if (el) choose(el); });
  document.addEventListener("keydown", (e) => {
    const el = e.target.closest && e.target.closest(ITEM); if (!el) return;
    const g = el.closest('[role="radiogroup"]'); if (!g) return;
    if (e.key === "Enter") { e.preventDefault(); return; }
    const vertical = g.getAttribute("aria-orientation") === "vertical";
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const list = items(g).filter((x) => !off(x)); if (!list.length) return;
    const dir = (getComputedStyle(g).direction === "rtl" && !vertical && /Left|Right/.test(e.key)) ? -step : step;
    choose(list[(list.indexOf(el) + dir + list.length) % list.length], true);
  });
  window.fumeRadio = (root = document) => {
    const groups = Array.from(root.querySelectorAll('[role="radiogroup"]'));
    if (root.matches && root.matches('[role="radiogroup"]')) groups.push(root);
    groups.forEach(settle);
  };
  // fumeRadio.choose(item) picks an item from code
  window.fumeRadio.choose = (el) => choose(el, false);
  if (document.readyState !== "loading") window.fumeRadio(); else document.addEventListener("DOMContentLoaded", () => window.fumeRadio());
})();
