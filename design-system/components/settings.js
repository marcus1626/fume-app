// Settings layout. DECIDED 13 Oct, from round 8. Runs [data-ui-settings]: the phone's list then page, and the save bar.
// List then page (only where the layout is narrow; settings.css decides): a row with
// data-ui-settings-open="<panel id>" selects that page (its tab, through tabs.js) and shows it with
// data-view="page" on the root; focus goes to the page title. [data-ui-settings-back] goes back to the list
// (data-view="list") and focus returns to the row it came from.
// Save bar: every .ui-settings-form remembers its values (fields, native selects, switches and checkboxes);
// as soon as one differs, its .ui-settings-savebar .ui-action-bar slides in (toolbar.js fumeActionBar), and
// when they are all back, it leaves. [data-ui-settings-discard] puts the remembered values back; submitting
// the form saves: the Save button is busy for a moment, the values become the new remembered ones, the bar
// leaves, "ui:settings-save" fires on the form and a toast says so (data-ui-settings-saved="Brand DNA saved").
// window.fumeSettings(root) is safe to call twice; roots with data-ui-settings start by themselves.
(() => {
  if (window.fumeSettings) return;
  const FIELDS = "input:not([type=hidden]), textarea, select, [role=switch], [role=checkbox]";

  function snapshot(form) {
    return Array.from(form.querySelectorAll(FIELDS)).map((el) => {
      if (el.matches("[role=switch], [role=checkbox]")) return el.getAttribute("aria-checked");
      if (el.type === "checkbox" || el.type === "radio") return String(el.checked);
      return el.value;
    });
  }
  function restore(form, values) {
    Array.from(form.querySelectorAll(FIELDS)).forEach((el, i) => {
      const v = values[i];
      if (el.matches("[role=switch]")) { if (el.getAttribute("aria-checked") !== v) (window.fumeSwitch && window.fumeSwitch.set ? window.fumeSwitch.set(el, v === "true") : el.setAttribute("aria-checked", v)); }
      else if (el.matches("[role=checkbox]")) { el.setAttribute("aria-checked", v); el.dataset.state = v === "true" ? "checked" : "unchecked"; }
      else if (el.type === "checkbox" || el.type === "radio") el.checked = v === "true";
      else el.value = v;
    });
  }

  function fumeSettings(root) {
    if (!root || root.__fumeSettings) return root && root.__fumeSettings;
    let from = null; // the row that opened the page
    const panelRow = (id) => root.querySelector('[data-ui-settings-open="' + id + '"]');

    root.addEventListener("click", (e) => {
      const row = e.target.closest("[data-ui-settings-open]");
      if (row && root.contains(row)) {
        const id = row.getAttribute("data-ui-settings-open");
        const tab = root.querySelector('[role="tab"][aria-controls="' + id + '"]');
        if (tab && tab.getAttribute("aria-selected") !== "true") tab.click();
        from = row; root.dataset.view = "page";
        const panel = document.getElementById(id), title = panel && panel.querySelector(".ui-settings-page-title");
        if (root.getBoundingClientRect().top < 0) root.scrollIntoView({ block: "start" });
        if (title) title.focus({ preventScroll: true });
        return;
      }
      const back = e.target.closest("[data-ui-settings-back]");
      if (back && root.contains(back)) {
        root.dataset.view = "list";
        const page = back.closest('[role="tabpanel"]');
        const to = from || (page && panelRow(page.id));
        if (to) to.focus({ preventScroll: true });
        return;
      }
      const discard = e.target.closest("[data-ui-settings-discard]");
      if (discard && root.contains(discard)) {
        const form = discard.closest(".ui-settings-form");
        if (form && form.__saved) { restore(form, form.__saved); check(form); }
      }
    });

    function bar(form) { return form.querySelector(".ui-settings-savebar .ui-action-bar"); }
    function check(form) {
      const b = bar(form); if (!b || !form.__saved) return;
      const dirty = snapshot(form).some((v, i) => v !== form.__saved[i]);
      const api = window.fumeActionBar;
      if (dirty) { if (api) api.show(b); else { b.hidden = false; b.dataset.state = "open"; } }
      else if (!b.hidden) {
        if (b.contains(document.activeElement)) { const first = form.querySelector(FIELDS); if (first) first.focus({ preventScroll: true }); }
        if (api) api.hide(b); else { b.hidden = true; b.dataset.state = "closed"; }
      }
    }
    root.querySelectorAll(".ui-settings-form").forEach((form) => {
      form.__saved = snapshot(form);
      const later = () => requestAnimationFrame(() => check(form));
      form.addEventListener("input", later);
      form.addEventListener("change", later);
      form.addEventListener("ui-checkedchange", later);
      form.addEventListener("reset", (e) => { e.preventDefault(); restore(form, form.__saved); later(); });
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const save = e.submitter || form.querySelector('.ui-settings-savebar [type="submit"]');
        if (save) save.setAttribute("aria-busy", "true");
        setTimeout(() => {
          if (save) save.removeAttribute("aria-busy");
          form.__saved = snapshot(form); check(form);
          form.dispatchEvent(new CustomEvent("ui:settings-save", { bubbles: true }));
          const msg = form.getAttribute("data-ui-settings-saved");
          if (msg && window.fumeToast) window.fumeToast({ type: "done", title: msg });
        }, 600);
      });
    });
    if (!root.dataset.view) root.dataset.view = "list";
    root.__fumeSettings = { open: (id) => { const r = panelRow(id); if (r) r.click(); }, back: () => { const b = root.querySelector('[role="tabpanel"]:not([hidden]) [data-ui-settings-back]'); if (b) b.click(); } };
    return root.__fumeSettings;
  }

  const initAll = () => document.querySelectorAll("[data-ui-settings]").forEach(fumeSettings);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAll); else initAll();
  window.fumeSettings = fumeSettings;
})();
