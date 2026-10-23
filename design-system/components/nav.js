// Navigation menus: opens and closes the top bar's dropdowns, its folded Menu on a phone, and the
// breadcrumb's ellipsis menu. DECIDED 13 Oct, from round 7.
// Markup: <button data-ui-nav-trigger aria-controls="id" aria-expanded="false">…</button>
//         <div id="id" class="ui-glass ui-nav-content" data-state="closed" hidden>… links …</div>
// Click toggles; one menu is open at a time; Escape or a click outside closes it and focus returns to the
// trigger; opened from the keyboard, focus goes to the first link; ArrowDown/ArrowUp/Home/End move between
// links. Content that starts with data-state="open" stays open (shown in place) until something closes it.
// fumeNav(trigger) returns { open, close, toggle }; it is safe to load twice.
(function () {
  if (window.fumeNav) return;
  const ITEMS = "a[href], button:not([disabled]), [role='menuitem']";
  let current = null;
  const contentOf = (t) => document.getElementById(t.getAttribute("aria-controls"));
  const items = (c) => Array.from(c.querySelectorAll(ITEMS)).filter((x) => !x.hidden && x.offsetParent !== null);

  function set(t, open, focus) {
    const c = contentOf(t); if (!c) return;
    t.setAttribute("aria-expanded", String(open));
    t.dataset.state = open ? "open" : "closed";
    c.dataset.state = open ? "open" : "closed";
    c.hidden = !open;
    if (open) {
      if (current && current !== t) set(current, false);
      current = t;
      if (focus) { const f = items(c)[0]; if (f) f.focus({ preventScroll: true }); }
    } else {
      if (current === t) current = null;
      if (focus) t.focus({ preventScroll: true });
    }
  }
  function fumeNav(t) {
    if (!t) return null;
    if (!t.__fumeNav) {
      const c = contentOf(t);
      const open = !!c && (c.dataset.state === "open" || (!c.hidden && c.dataset.state !== "closed"));
      if (c) { t.setAttribute("aria-expanded", String(open)); t.dataset.state = open ? "open" : "closed"; c.dataset.state = open ? "open" : "closed"; c.hidden = !open; }
      if (open) current = t;
      t.__fumeNav = {
        open: (focus) => set(t, true, focus), close: (focus) => set(t, false, focus),
        toggle: (focus) => set(t, t.getAttribute("aria-expanded") !== "true", focus),
      };
    }
    return t.__fumeNav;
  }

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-ui-nav-trigger]");
    if (t) { e.preventDefault(); fumeNav(t).toggle(e.detail === 0); return; }
    if (current) {
      const c = contentOf(current);
      if (c && c.contains(e.target)) { if (e.target.closest("a[href], [role='menuitem']")) set(current, false); return; }
      set(current, false);
    }
  });
  document.addEventListener("keydown", (e) => {
    const t = e.target.closest && e.target.closest("[data-ui-nav-trigger]");
    if (t && e.key === "ArrowDown") { e.preventDefault(); fumeNav(t).open(true); return; }
    if (!current) return;
    const c = contentOf(current); if (!c) return;
    if (e.key === "Escape") { e.preventDefault(); set(current, false, true); return; }
    if (!c.contains(e.target)) return;
    const list = items(c), i = list.indexOf(document.activeElement);
    const step = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (step) { e.preventDefault(); list[(i + step + list.length) % list.length].focus(); }
    if (e.key === "Home") { e.preventDefault(); list[0].focus(); }
    if (e.key === "End") { e.preventDefault(); list[list.length - 1].focus(); }
  });
  // focus leaving the open menu (Tab past the last link) closes it
  document.addEventListener("focusout", (e) => {
    if (!current || !e.relatedTarget) return;
    const c = contentOf(current);
    if (c && c.contains(e.target) && !c.contains(e.relatedTarget) && e.relatedTarget !== current) set(current, false);
  });
  const initAll = () => document.querySelectorAll("[data-ui-nav-trigger]").forEach(fumeNav);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAll); else initAll();
  window.fumeNav = fumeNav;
})();
