// Toggle and toggle group. DECIDED 13 Oct, from round 7. Same states as Radix Toggle and ToggleGroup:
// a toggle has aria-pressed and data-state="on|off". In a group with data-type="single" the items are
// role="radio" with aria-checked and one stays on (add data-deselect to let the last one go off);
// with data-type="multiple" each item keeps aria-pressed. Arrow keys move focus inside a group
// (roving focus, as in Radix); Space and Enter toggle (the button's own click).
// Each change dispatches "ui-pressedchange" on the toggle (bubbles; detail.pressed, detail.value).
// Clicks and keys are delegated from the document. fumeToggle(root) settles data-state and the roving
// tabindex under root (call it after rendering); safe to load twice.
(() => {
  if (window.fumeToggle) return;
  const SEL = "button.ui-toggle, .ui-toggle[role=\"button\"], .ui-toggle[role=\"radio\"]";
  const isOn = (el) => el.getAttribute("aria-pressed") === "true" || el.getAttribute("aria-checked") === "true"
    || (!el.hasAttribute("aria-pressed") && !el.hasAttribute("aria-checked") && el.dataset.state === "on");
  const single = (g) => g && g.dataset.type === "single";
  const set = (el, on) => {
    if (single(el.closest(".ui-toggle-group"))) { el.setAttribute("role", "radio"); el.setAttribute("aria-checked", String(on)); el.removeAttribute("aria-pressed"); }
    else el.setAttribute("aria-pressed", String(on));
    el.dataset.state = on ? "on" : "off";
  };
  const items = (g) => Array.from(g.querySelectorAll(SEL)).filter((el) => el.closest(".ui-toggle-group") === g);
  const roving = (g) => {
    const list = items(g).filter((x) => !x.disabled), on = list.find(isOn) || list[0];
    list.forEach((x) => { x.tabIndex = x === on ? 0 : -1; });
  };
  document.addEventListener("click", (e) => {
    const el = e.target.closest && e.target.closest(SEL);
    if (!el || el.disabled || el.hasAttribute("data-disabled")) return;
    const g = el.closest(".ui-toggle-group");
    let on = !isOn(el);
    if (single(g)) {
      if (!on && !g.hasAttribute("data-deselect")) return;
      items(g).forEach((x) => { if (x !== el) set(x, false); });
    }
    set(el, on);
    if (g) { items(g).forEach((x) => { x.tabIndex = -1; }); el.tabIndex = 0; }
    el.dispatchEvent(new CustomEvent("ui-pressedchange", { bubbles: true, detail: { pressed: on, value: el.value || el.dataset.value || el.textContent.trim() } }));
  });
  document.addEventListener("keydown", (e) => {
    const el = e.target.closest && e.target.closest(SEL); if (!el) return;
    const g = el.closest(".ui-toggle-group"); if (!g) return;
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    const list = items(g).filter((x) => !x.disabled), i = list.indexOf(el);
    let next = null;
    if (step) next = list[(i + step + list.length) % list.length];
    if (e.key === "Home") next = list[0];
    if (e.key === "End") next = list[list.length - 1];
    if (!next) return;
    e.preventDefault(); list.forEach((x) => { x.tabIndex = x === next ? 0 : -1; }); next.focus();
  });
  window.fumeToggle = (root = document) => {
    root.querySelectorAll(SEL).forEach((el) => set(el, isOn(el)));
    const groups = Array.from(root.querySelectorAll(".ui-toggle-group"));
    if (root.matches && root.matches(".ui-toggle-group")) groups.push(root);
    groups.forEach((g) => { if (single(g)) g.setAttribute("role", "radiogroup"); roving(g); });
  };
  if (document.readyState !== "loading") window.fumeToggle(); else document.addEventListener("DOMContentLoaded", () => window.fumeToggle());
})();
