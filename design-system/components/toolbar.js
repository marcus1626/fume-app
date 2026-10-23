// Toolbar and floating action bar. DECIDED 13 Oct, from round 8. Radix Toolbar's roving focus for [data-ui-toolbar]
// (and every .ui-action-bar): the bar is one tab stop; ArrowLeft/Right (ArrowUp/Down with
// aria-orientation="vertical"), Home and End move between its controls and skip the disabled ones. Toggle
// groups inside keep their own state (toggle.js); the arrows here walk the whole bar.
// Action bar: window.fumeActionBar = { show(bar, label?), hide(bar) }. show() takes hidden away and sets
// the label ("3 selected" fills .ui-action-bar-count and .ui-action-bar-label-text when the label has them),
// data-state="open" (it slides in); hide() sets data-state="closed" and hides it when the slide is done.
// A [data-ui-action-bar-clear] control inside, or Escape, fires "ui:actionbar-clear" on the bar (the page
// clears its selection and calls hide). Safe to load twice.
(() => {
  if (window.fumeActionBar) return;
  const CTRL = "button, a[href], input, select, textarea, output[tabindex], [tabindex]:not([tabindex='-1'])";
  const BAR = "[data-ui-toolbar], .ui-action-bar";
  const shown = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  const usable = (el) => shown(el) && !el.disabled && el.getAttribute("aria-disabled") !== "true" && !el.closest("[hidden]");
  // controls of this bar only (not those in a menu that hangs off it)
  const controls = (bar) => Array.from(bar.querySelectorAll("button, a[href], input, select, textarea")).filter((el) => el.closest(BAR) === bar && !el.closest('[role="menu"]') && usable(el));

  function settle(bar, current) {
    const list = controls(bar);
    if (!list.length) return;
    const pick = current && list.includes(current) ? current
      : list.find((el) => el.getAttribute("aria-checked") === "true" || el.getAttribute("aria-pressed") === "true") || list[0];
    bar.querySelectorAll("button, a[href], input, select, textarea").forEach((el) => { if (el.closest(BAR) === bar && !el.closest('[role="menu"]')) el.tabIndex = -1; });
    pick.tabIndex = 0;
  }

  document.addEventListener("focusin", (e) => {
    const bar = e.target.closest && e.target.closest(BAR);
    if (bar && e.target.matches(CTRL) && !e.target.closest('[role="menu"]')) settle(bar, e.target);
  });
  // a disabled tool that comes back (undo after the first edit) must stay reachable
  document.addEventListener("ui:toolbar-change", (e) => { const bar = e.target.closest && e.target.closest(BAR); if (bar) settle(bar, bar.querySelector('[tabindex="0"]')); });

  document.addEventListener("keydown", (e) => {
    const bar = e.target.closest && e.target.closest(BAR);
    if (!bar || e.target.closest('[role="menu"]') || !e.target.matches(CTRL)) return;
    if (e.key === "Escape" && bar.classList.contains("ui-action-bar")) { bar.dispatchEvent(new CustomEvent("ui:actionbar-clear", { bubbles: true })); return; }
    const vertical = bar.getAttribute("aria-orientation") === "vertical";
    const map = vertical ? { ArrowDown: 1, ArrowUp: -1 } : { ArrowRight: 1, ArrowLeft: -1 };
    const list = controls(bar), i = list.indexOf(e.target);
    let next = null;
    if (map[e.key]) next = list[(i + map[e.key] + list.length) % list.length];
    else if (e.key === "Home") next = list[0];
    else if (e.key === "End") next = list[list.length - 1];
    if (!next) return;
    e.preventDefault(); e.stopPropagation(); // the bar moves, not the toggle group alone (toggle.js)
    settle(bar, next); next.focus();
  }, true);

  document.addEventListener("click", (e) => {
    const c = e.target.closest && e.target.closest("[data-ui-action-bar-clear]");
    const bar = c && c.closest(".ui-action-bar");
    if (bar) bar.dispatchEvent(new CustomEvent("ui:actionbar-clear", { bubbles: true }));
  });

  const timers = new WeakMap();
  function show(bar, label) {
    if (!bar) return;
    clearTimeout(timers.get(bar));
    if (label != null) {
      // "3 selected": the number goes in .ui-action-bar-count and the words beside it, when the label has both
      const l = bar.querySelector(".ui-action-bar-label"), m = String(label).match(/^(\d+)(.*)$/);
      const c = l && l.querySelector(".ui-action-bar-count"), w = l && l.querySelector(".ui-action-bar-label-text");
      if (c && w && m) { c.textContent = m[1]; w.textContent = m[2]; } else if (l) l.textContent = label;
    }
    const was = !bar.hidden && bar.dataset.state === "open";
    bar.hidden = false; bar.dataset.state = "open";
    if (!was) settle(bar);
  }
  function hide(bar) {
    if (!bar || bar.hidden) return;
    const back = bar.contains(document.activeElement);
    bar.dataset.state = "closed";
    const ms = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ui-motion-base")) || 240;
    timers.set(bar, setTimeout(() => { if (bar.dataset.state === "closed") bar.hidden = true; }, ms + 40));
    if (back) bar.dispatchEvent(new CustomEvent("ui:actionbar-blur", { bubbles: true }));
  }

  const initAll = () => document.querySelectorAll(BAR).forEach((b) => settle(b));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAll); else initAll();
  window.fumeActionBar = { show, hide, settle };
})();
