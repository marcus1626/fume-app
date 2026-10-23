// Sidebar: expands, collapses to the icon rail, and opens as a glass drawer on a phone. DECIDED 13 Oct, from round 7.
// Markup: <div class="ui-sidebar-wrapper" data-ui-sidebar data-state="expanded">
//           <aside class="ui-sidebar" id="…" data-state="expanded"> … </aside>
//           <div class="ui-sidebar-scrim" aria-hidden="true"></div>
//           <main class="ui-sidebar-inset"> … <button data-ui-sidebar-trigger aria-controls="…">…</button> … </main>
//         </div>
// Any [data-ui-sidebar-trigger] inside the wrapper (or pointing at the sidebar with aria-controls) toggles it.
// Wide: data-state expanded <-> collapsed (the rail). Narrow (the CSS says --sidebar-mode: drawer): the drawer
// opens over the scrim (data-open-mobile="true"), the page goes inert, focus moves into the drawer; Escape or
// the scrim closes it and focus returns to the trigger. Add data-ui-sidebar-shortcut to let Cmd/Ctrl+B toggle.
// fumeSidebar(wrapper) returns { toggle, setExpanded, setOpenMobile, isDrawer }; it is safe to call twice.
(function () {
  if (window.fumeSidebar) return;
  const FOCUSABLE = "a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])";

  function fumeSidebar(wrapper) {
    if (!wrapper || wrapper.__fumeSidebar) return wrapper && wrapper.__fumeSidebar;
    const sb = wrapper.querySelector(".ui-sidebar");
    const inset = wrapper.querySelector(".ui-sidebar-inset");
    const scrim = wrapper.querySelector(".ui-sidebar-scrim");
    if (!sb) return null;
    let lastTrigger = null;
    const triggers = () => {
      const inside = Array.from(wrapper.querySelectorAll("[data-ui-sidebar-trigger]"));
      const outside = sb.id ? Array.from(document.querySelectorAll('[data-ui-sidebar-trigger][aria-controls="' + sb.id + '"]')) : [];
      return Array.from(new Set(inside.concat(outside)));
    };
    const isDrawer = () => getComputedStyle(sb).getPropertyValue("--sidebar-mode").trim() === "drawer";
    const sync = () => {
      const drawer = isDrawer(), open = wrapper.dataset.openMobile === "true";
      const expanded = drawer ? open : wrapper.dataset.state !== "collapsed";
      triggers().forEach((t) => t.setAttribute("aria-expanded", String(expanded)));
      sb.toggleAttribute("data-mobile", drawer);
      if (drawer) { sb.setAttribute("role", "dialog"); sb.setAttribute("aria-modal", "true"); }
      else { sb.removeAttribute("role"); sb.removeAttribute("aria-modal"); }
      if (inset) inset.inert = drawer && open;
      sb.inert = drawer && !open;
    };
    function setExpanded(open) {
      const s = open ? "expanded" : "collapsed";
      wrapper.dataset.state = s; sb.dataset.state = s; sb.dataset.collapsible = open ? "" : "icon";
      sync();
    }
    function setOpenMobile(open, focus) {
      wrapper.dataset.openMobile = String(!!open);
      sync();
      if (open && focus !== false) {
        const first = sb.querySelector('[aria-current="page"], [data-active="true"]') || sb.querySelector(FOCUSABLE);
        if (first) setTimeout(() => first.focus({ preventScroll: true }), 0);
      } else if (!open && lastTrigger && focus !== false) lastTrigger.focus({ preventScroll: true });
    }
    function toggle(from) {
      if (from) lastTrigger = from;
      if (isDrawer()) setOpenMobile(wrapper.dataset.openMobile !== "true");
      else setExpanded(wrapper.dataset.state === "collapsed");
    }
    wrapper.addEventListener("click", (e) => {
      const t = e.target.closest("[data-ui-sidebar-trigger]");
      if (t && wrapper.contains(t)) { e.preventDefault(); toggle(t); return; }
      if (scrim && e.target === scrim) setOpenMobile(false);
      // a link chosen in the drawer closes it
      if (isDrawer() && wrapper.dataset.openMobile === "true" && e.target.closest(".ui-sidebar a[href]")) setOpenMobile(false, false);
    });
    triggers().filter((t) => !wrapper.contains(t)).forEach((t) => t.addEventListener("click", (e) => { e.preventDefault(); toggle(t); }));
    wrapper.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isDrawer() && wrapper.dataset.openMobile === "true") { e.stopPropagation(); setOpenMobile(false); }
      // keep Tab inside the open drawer
      if (e.key === "Tab" && isDrawer() && wrapper.dataset.openMobile === "true") {
        const f = Array.from(sb.querySelectorAll(FOCUSABLE)).filter((x) => x.offsetParent !== null);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
    if (window.ResizeObserver) { let mode = isDrawer(); new ResizeObserver(() => { const m = isDrawer(); if (m !== mode) { mode = m; if (!m) wrapper.dataset.openMobile = "false"; } sync(); }).observe(wrapper); }
    if (!wrapper.dataset.state) wrapper.dataset.state = sb.dataset.state || "expanded";
    sb.dataset.state = wrapper.dataset.state;
    sync();
    const api = { toggle, setExpanded, setOpenMobile, isDrawer };
    wrapper.__fumeSidebar = api;
    return api;
  }

  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "b") {
      const w = document.querySelector("[data-ui-sidebar][data-ui-sidebar-shortcut]");
      if (w && fumeSidebar(w)) { e.preventDefault(); fumeSidebar(w).toggle(); }
    }
  });
  const initAll = () => document.querySelectorAll("[data-ui-sidebar]").forEach(fumeSidebar);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAll); else initAll();
  window.fumeSidebar = fumeSidebar;
})();
