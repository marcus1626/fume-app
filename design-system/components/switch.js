// Switch: flips .ui-switch (a <button role="switch">) on click, Enter and Space. DECIDED 13 Oct, from round 7.
// Same states as Radix Switch: aria-checked, and data-state="checked|unchecked" on the root and its thumb.
// A label around the switch (a .ui-choice row) or with for= flips it too.
// Each change dispatches "ui-checkedchange" (bubbles; detail.checked). Clicks are delegated from the
// document. fumeSwitch(root) settles data-state under root (call it after rendering); safe to load twice.
(() => {
  if (window.fumeSwitch) return;
  const SEL = '.ui-switch[role="switch"]';
  const set = (el, on) => {
    const s = on ? "checked" : "unchecked";
    el.setAttribute("aria-checked", String(on)); el.dataset.state = s;
    const t = el.querySelector(".ui-switch-thumb"); if (t) t.dataset.state = s;
  };
  document.addEventListener("click", (e) => {
    const el = e.target.closest && e.target.closest(SEL);
    if (!el || el.disabled || el.hasAttribute("data-disabled")) return;
    const on = el.getAttribute("aria-checked") !== "true";
    set(el, on);
    el.dispatchEvent(new CustomEvent("ui-checkedchange", { bubbles: true, detail: { checked: on } }));
  });
  window.fumeSwitch = (root = document) => root.querySelectorAll(SEL).forEach((el) => set(el, el.getAttribute("aria-checked") === "true"));
  window.fumeSwitch.set = (el, on) => set(el, !!on);
  if (document.readyState !== "loading") window.fumeSwitch(); else document.addEventListener("DOMContentLoaded", () => window.fumeSwitch());
})();
