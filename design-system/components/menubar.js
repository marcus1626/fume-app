// Menubar. DECIDED 13 Oct, from round 8. Runs shadcn's menubar (Radix Menubar) on Fume's glass menus.
// Markup: <div class="ui-menubar" role="menubar" data-ui-menubar aria-label="…">
//           <div class="ui-menubar-menu">
//             <button class="ui-menubar-trigger" role="menuitem" aria-haspopup="menu" aria-controls="m1">Campaign</button>
//             <div class="ui-glass ui-menu ui-menubar-content" id="m1" role="menu" hidden>
//               <button class="ui-menu-item ui-menubar-item" role="menuitem">…</button>
//               <button … role="menuitemcheckbox" aria-checked="true">…</button>      a checkbox row
//               <div role="group"><button … role="menuitemradio" aria-checked="true">…</button>…</div>
//               <button … aria-haspopup="menu" aria-controls="m1-sub">Export as</button>  a submenu row
//             </div>
//             <div class="ui-glass ui-menu ui-menubar-sub-content" id="m1-sub" role="menu" hidden>…</div>
//           </div> …</div>
// Keys, as Radix: ArrowLeft/Right move along the bar (and switch menus while one is open), Enter, Space or
// ArrowDown open a menu on its first row (ArrowUp on its last), ArrowUp/Down/Home/End move in a menu, a
// letter jumps to the next row starting with it, ArrowRight opens a submenu and ArrowLeft closes it,
// Escape closes and returns focus to the menu name, Tab leaves. With a mouse, one click opens a menu and
// moving to another name switches to its menu; a click outside closes. Rows get data-highlighted.
// Choosing a row closes the menu and fires "ui-menubar-select" (detail: item, value, checked) on the bar;
// checkbox and radio rows keep aria-checked and data-state in step. A menu that starts open (not hidden,
// data-state="open") stays open until something closes it. Folded rows in the phone drawer
// (.ui-menubar-row[aria-pressed]) toggle on a tap.
// window.fumeMenubar(bar) returns { open(trigger), close() }; safe to load twice.
(() => {
  if (window.fumeMenubar) return;
  const ROW = '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]';
  const shown = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  const enabled = (el) => !el.disabled && !el.hasAttribute("data-disabled") && el.getAttribute("aria-disabled") !== "true";
  const byId = (id) => (id ? document.getElementById(id) : null);
  const focus = (el) => { if (!el) return; try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } };
  const num = (el, name, fb) => { const v = parseFloat(getComputedStyle(el).getPropertyValue(name)); return isNaN(v) ? fb : v; };

  function fumeMenubar(bar) {
    if (!bar) return null;
    if (bar.__fumeMenubar) return bar.__fumeMenubar;
    let open = null; // the menu name whose menu is open
    let sub = null;  // the row whose submenu is open
    const allTriggers = () => Array.from(bar.querySelectorAll(".ui-menubar-trigger"));
    const triggers = () => allTriggers().filter((t) => shown(t) && enabled(t));
    const menuOf = (t) => byId(t && t.getAttribute("aria-controls"));
    const rows = (menu) => Array.from(menu.querySelectorAll(ROW)).filter((r) => r.closest('[role="menu"]') === menu && enabled(r));
    const roving = (t) => { const cur = t || triggers()[0]; allTriggers().forEach((x) => { x.tabIndex = x === cur ? 0 : -1; }); };
    const hasSub = (row) => row.getAttribute("aria-haspopup") === "menu" && !!menuOf(row);

    function highlight(menu, row, move) {
      if (!menu) return;
      menu.querySelectorAll("[data-highlighted]").forEach((r) => r.removeAttribute("data-highlighted"));
      if (!row) return;
      row.setAttribute("data-highlighted", "");
      if (move !== false) focus(row);
    }
    function closeSub(focusBack) {
      if (!sub) return;
      const s = sub, c = menuOf(s); sub = null;
      s.setAttribute("aria-expanded", "false"); s.dataset.state = "closed";
      if (c) { c.hidden = true; c.dataset.state = "closed"; highlight(c, null); }
      if (focusBack) { highlight(s.closest('[role="menu"]'), s); }
    }
    // the submenu is its own glass beside the menu (glass in glass would blur only the menu under it)
    function placeSub(c, parent, s) {
      const gap = num(bar, "--ui-menubar-sub-gap", 4), margin = num(document.documentElement, "--ui-overlay-margin", 16);
      c.style.top = parent.offsetTop + s.offsetTop + "px";
      c.style.left = parent.offsetLeft + parent.offsetWidth + gap + "px";
      c.style.transformOrigin = "top left"; c.dataset.side = "right";
      if (c.getBoundingClientRect().right > document.documentElement.clientWidth - margin) {
        c.style.left = parent.offsetLeft - c.offsetWidth - gap + "px";
        c.style.transformOrigin = "top right"; c.dataset.side = "left";
      }
    }
    function openSub(s, first) {
      const c = menuOf(s); if (!c) return;
      if (sub !== s) {
        closeSub(false);
        sub = s; s.setAttribute("aria-expanded", "true"); s.dataset.state = "open";
        c.hidden = false; c.dataset.state = "open";
        placeSub(c, s.closest('[role="menu"]'), s);
      }
      if (first) highlight(c, rows(c)[0]);
    }
    function closeMenu(focusBack) {
      closeSub(false);
      if (!open) return;
      const t = open, m = menuOf(t); open = null;
      t.setAttribute("aria-expanded", "false"); t.dataset.state = "closed";
      if (m) { m.hidden = true; m.dataset.state = "closed"; highlight(m, null); }
      if (focusBack) focus(t);
    }
    function openMenu(t, where) {
      const m = menuOf(t); if (!t || !m) return;
      if (open && open !== t) closeMenu(false);
      open = t; roving(t);
      t.setAttribute("aria-expanded", "true"); t.dataset.state = "open";
      m.hidden = false; m.dataset.state = "open";
      // keep it on the screen: a menu that would run off the right edge lines up with its name's end
      m.classList.remove("ui-menubar-content--end");
      if (m.getBoundingClientRect().right > document.documentElement.clientWidth - num(document.documentElement, "--ui-overlay-margin", 16)) m.classList.add("ui-menubar-content--end");
      highlight(m, null);
      const list = rows(m);
      if (where === "first") highlight(m, list[0]);
      else if (where === "last") highlight(m, list[list.length - 1]);
      else focus(t);
    }
    function step(from, by) {
      const list = triggers(); if (!list.length) return;
      const i = Math.max(0, list.indexOf(from));
      const next = by === "first" ? list[0] : by === "last" ? list[list.length - 1] : list[(i + by + list.length) % list.length];
      if (open) openMenu(next, "first"); else { roving(next); focus(next); }
    }
    function choose(row) {
      const role = row.getAttribute("role");
      if (role === "menuitemcheckbox") {
        const on = row.getAttribute("aria-checked") !== "true";
        row.setAttribute("aria-checked", String(on)); row.dataset.state = on ? "checked" : "unchecked";
      } else if (role === "menuitemradio") {
        const group = row.closest('[role="group"]') || row.closest('[role="menu"]');
        group.querySelectorAll('[role="menuitemradio"]').forEach((r) => { const on = r === row; r.setAttribute("aria-checked", String(on)); r.dataset.state = on ? "checked" : "unchecked"; });
      }
      closeMenu(true);
      bar.dispatchEvent(new CustomEvent("ui-menubar-select", { bubbles: true, detail: { item: row, value: row.dataset.value || row.textContent.trim(), checked: row.getAttribute("aria-checked") === "true" } }));
    }

    bar.addEventListener("click", (e) => {
      const t = e.target.closest(".ui-menubar-trigger");
      if (t && bar.contains(t)) { if (open === t) closeMenu(false); else openMenu(t, e.detail === 0 ? "first" : null); return; }
      const row = e.target.closest(ROW);
      if (!row || !bar.contains(row) || !row.closest('[role="menu"]') || !enabled(row)) return;
      if (hasSub(row)) { openSub(row, e.detail === 0); return; }
      choose(row);
    });

    bar.addEventListener("keydown", (e) => {
      const t = e.target.closest(".ui-menubar-trigger");
      if (t && bar.contains(t)) {
        const k = e.key;
        if (k === "ArrowRight" || k === "ArrowLeft") { e.preventDefault(); step(t, k === "ArrowRight" ? 1 : -1); }
        else if (k === "Home" || k === "End") { e.preventDefault(); step(t, k === "Home" ? "first" : "last"); }
        else if (k === "ArrowDown" || k === "Enter" || k === " ") { e.preventDefault(); openMenu(t, "first"); }
        else if (k === "ArrowUp") { e.preventDefault(); openMenu(t, "last"); }
        else if (k === "Escape" && open) { e.preventDefault(); e.stopPropagation(); closeMenu(true); }
        return;
      }
      const row = e.target.closest(ROW), menu = row && row.closest('[role="menu"]');
      if (!row || !menu || !bar.contains(menu)) return;
      const isSub = menu.classList.contains("ui-menubar-sub-content");
      const list = rows(menu), i = list.indexOf(row), k = e.key;
      if (k === "ArrowDown" || k === "ArrowUp") { e.preventDefault(); highlight(menu, list[(i + (k === "ArrowDown" ? 1 : -1) + list.length) % list.length]); }
      else if (k === "Home" || k === "End") { e.preventDefault(); highlight(menu, k === "Home" ? list[0] : list[list.length - 1]); }
      else if (k === "ArrowRight") { e.preventDefault(); if (hasSub(row)) openSub(row, true); else step(open, 1); }
      else if (k === "ArrowLeft") { e.preventDefault(); if (isSub) closeSub(true); else step(open, -1); }
      else if (k === "Enter" || k === " ") { e.preventDefault(); if (hasSub(row)) openSub(row, true); else row.click(); }
      else if (k === "Escape") { e.preventDefault(); e.stopPropagation(); if (isSub) closeSub(true); else closeMenu(true); }
      else if (k === "Tab") closeMenu(false);
      else if (k.length === 1 && /\S/.test(k) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const key = k.toLowerCase();
        const next = list.slice(i + 1).concat(list.slice(0, i + 1)).find((r) => r.textContent.trim().toLowerCase().startsWith(key));
        if (next) highlight(menu, next);
      }
    });

    // a mouse moves between open menus and highlights rows
    bar.addEventListener("pointerover", (e) => {
      if (e.pointerType !== "mouse") return;
      const t = e.target.closest(".ui-menubar-trigger");
      if (t && bar.contains(t)) { if (open && open !== t && enabled(t)) openMenu(t); return; }
      const row = e.target.closest(ROW), menu = row && row.closest('[role="menu"]');
      if (!row || !menu || !bar.contains(menu)) return;
      if (!enabled(row)) { highlight(menu, null); return; }
      highlight(menu, row);
      if (!menu.classList.contains("ui-menubar-sub-content")) { if (hasSub(row)) openSub(row, false); else closeSub(false); }
    });

    document.addEventListener("pointerdown", (e) => { if (open && !bar.contains(e.target)) closeMenu(false); }, true);
    bar.addEventListener("focusout", (e) => { if (open && e.relatedTarget && !bar.contains(e.relatedTarget)) closeMenu(false); });
    window.addEventListener("resize", () => closeSub(false));

    // settle the start: menus that start open stay open; rows are reached with the arrow keys, not Tab
    allTriggers().forEach((t) => {
      const m = menuOf(t), isOpen = !!m && !m.hidden && m.dataset.state === "open";
      t.setAttribute("aria-expanded", String(isOpen)); t.dataset.state = isOpen ? "open" : "closed";
      if (m) { m.hidden = !isOpen; m.dataset.state = isOpen ? "open" : "closed"; }
      if (isOpen && !open) open = t;
    });
    bar.querySelectorAll('[role="menu"]').forEach((m) => m.querySelectorAll(ROW).forEach((r) => { r.tabIndex = -1; }));
    roving(open);

    bar.__fumeMenubar = { open: (t) => openMenu(typeof t === "number" ? triggers()[t] : t, null), close: () => closeMenu(false) };
    return bar.__fumeMenubar;
  }

  // the folded menus in the phone drawer: toggle rows
  document.addEventListener("click", (e) => {
    const r = e.target.closest && e.target.closest(".ui-menubar-row[aria-pressed]");
    if (r) r.setAttribute("aria-pressed", String(r.getAttribute("aria-pressed") !== "true"));
  });

  const initAll = () => document.querySelectorAll("[data-ui-menubar]").forEach(fumeMenubar);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAll); else initAll();
  window.fumeMenubar = fumeMenubar;
})();
