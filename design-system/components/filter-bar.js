// Filter bar. DECIDED 13 Oct, from round 8. Runs [data-ui-filter-bar] over the items in data-ui-filter-target.
// State: a search (input[data-ui-filter-search]), filters (every [data-ui-filter-option] with data-filter and
// data-value; menu rows keep aria-checked, sheet rows aria-pressed, all kept in step), and a sort ("attr:asc"
// or "attr:desc" from a select inside [data-ui-filter-sort], or a sheet row [data-ui-filter-sort-option]).
// An item ([data-ui-filter-item]) shows when, for every filter with values, its data-<filter> is one of
// them, and when its data-keywords (or its text) holds the search. Items are put in order of data-<attr>.
// Kept up to date: chips (data-active and their count), the pills ([data-ui-filter-pills]: key, value, a
// remove circle), the count ([data-ui-filter-count]: "3 of 8 creatives", from data-noun="one,many"), the
// sheet's [data-ui-filter-show] ("Show 3 creatives"), [data-ui-filter-badge] (how many values are on),
// Clear all ([data-ui-filter-clear], hidden or disabled when nothing filters) and an empty state
// ([data-ui-filter-empty="<bar id>"]). The sheet (a drawer) belongs to the bar by data-ui-filter-for="<bar id>".
// "/" anywhere outside a field jumps to the search. Each change fires "ui:filterchange" (detail: query,
// filters, sort, shown, total). window.fumeFilterBar(root) returns { state(), clear(), toggle(key, value) }.
(() => {
  if (window.fumeFilterBar) return;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const on = (el) => el.getAttribute("aria-checked") === "true" || el.getAttribute("aria-pressed") === "true";

  function fumeFilterBar(root) {
    if (!root) return null;
    if (root.__fumeFilterBar) return root.__fumeFilterBar;
    const target = document.querySelector(root.getAttribute("data-ui-filter-target") || "#none");
    const sheets = () => (root.id ? Array.from(document.querySelectorAll('[data-ui-filter-for="' + root.id + '"]')) : []);
    const inScope = (sel) => [root, ...sheets()].flatMap((s) => Array.from(s.querySelectorAll(sel)));
    const [one, many] = (root.getAttribute("data-noun") || "item,items").split(",");
    const search = root.querySelector("[data-ui-filter-search]");
    const state = { query: search ? search.value.trim() : "", filters: {}, sort: null };

    inScope("[data-ui-filter-option]").forEach((o) => { if (on(o)) add(o.dataset.filter, o.dataset.value); });
    { // the sort the markup starts with
      const sortRoot = root.querySelector("[data-ui-filter-sort]");
      const sel = sortRoot && (sortRoot.querySelector('[role="option"][aria-selected="true"]') || sortRoot.querySelector("select"));
      const row = inScope("[data-ui-filter-sort-option]").find(on);
      state.sort = (sel && (sel.dataset.value || sel.value)) || (row && row.dataset.value) || null;
    }

    function add(k, v) { const a = state.filters[k] || (state.filters[k] = []); if (!a.includes(v)) a.push(v); }
    function remove(k, v) { state.filters[k] = (state.filters[k] || []).filter((x) => x !== v); }
    const optionFor = (k, v) => inScope("[data-ui-filter-option]").find((o) => o.dataset.filter === k && o.dataset.value === v);
    const labelOf = (k, v) => { const o = optionFor(k, v); return o ? o.dataset.label || o.textContent.trim() : v; };
    const keyOf = (k) => { const c = root.querySelector('[data-ui-filter-chip="' + k + '"]'); return c ? c.dataset.label || k : k; };
    const active = () => Object.entries(state.filters).flatMap(([k, vs]) => vs.map((v) => [k, v]));

    function syncSort() {
      const sortRoot = root.querySelector("[data-ui-filter-sort]");
      if (sortRoot) {
        const native = sortRoot.querySelector("select"); if (native && state.sort) native.value = state.sort;
        const opts = Array.from(sortRoot.querySelectorAll('[role="option"]'));
        const chosen = opts.find((o) => o.dataset.value === state.sort);
        if (chosen) {
          opts.forEach((o) => { const yes = o === chosen; o.setAttribute("aria-selected", String(yes)); o.dataset.state = yes ? "checked" : "unchecked"; });
          const val = sortRoot.querySelector(".ui-select-value"); const t = chosen.querySelector(".ui-select-item-text");
          if (val) val.textContent = (t || chosen).textContent.trim();
        }
      }
      inScope("[data-ui-filter-sort-option]").forEach((r) => r.setAttribute("aria-pressed", String(r.dataset.value === state.sort)));
    }

    function apply(changed) {
      inScope("[data-ui-filter-option]").forEach((o) => {
        const yes = (state.filters[o.dataset.filter] || []).includes(o.dataset.value);
        if (o.hasAttribute("aria-pressed")) o.setAttribute("aria-pressed", String(yes));
        else { o.setAttribute("aria-checked", String(yes)); o.dataset.state = yes ? "checked" : "unchecked"; }
      });
      root.querySelectorAll("[data-ui-filter-chip]").forEach((c) => {
        const n = (state.filters[c.dataset.uiFilterChip] || []).length;
        c.toggleAttribute("data-active", n > 0);
        const count = c.querySelector(".ui-filter-chip-count"); if (count) { count.textContent = String(n); count.hidden = n === 0; }
        c.setAttribute("aria-label", c.dataset.label + (n ? ", " + n + " chosen" : ""));
      });
      syncSort();

      let shown = 0, total = 0;
      if (target) {
        const items = Array.from(target.querySelectorAll("[data-ui-filter-item]"));
        const q = state.query.toLowerCase();
        items.forEach((it) => {
          total++;
          let ok = Object.entries(state.filters).every(([k, vs]) => !vs.length || vs.includes(it.dataset[k]));
          if (ok && q) ok = (it.dataset.keywords || it.textContent).toLowerCase().includes(q);
          it.hidden = !ok; if (ok) shown++;
        });
        if (state.sort) {
          const [attr, dir] = state.sort.split(":"), sign = dir === "desc" ? -1 : 1;
          items.slice().sort((a, b) => { const x = a.dataset[attr] || "", y = b.dataset[attr] || ""; return (x < y ? -1 : x > y ? 1 : 0) * sign; })
            .forEach((el) => el.parentNode.appendChild(el));
        }
      }
      const filtering = active().length > 0 || !!state.query;
      const count = root.querySelector("[data-ui-filter-count]");
      if (count) count.textContent = filtering ? shown + " of " + total + " " + (total === 1 ? one : many) : total + " " + (total === 1 ? one : many);
      inScope("[data-ui-filter-show]").forEach((b) => { b.textContent = shown ? "Show " + shown + " " + (shown === 1 ? one : many) : "Nothing to show"; });
      inScope("[data-ui-filter-badge]").forEach((b) => { b.textContent = String(active().length); b.hidden = !active().length; });
      inScope("[data-ui-filter-clear]").forEach((b) => { if (b.closest("[data-ui-filter-for]")) b.disabled = !filtering; else b.hidden = !filtering; });
      if (root.id) document.querySelectorAll('[data-ui-filter-empty="' + root.id + '"]').forEach((e) => { e.hidden = shown > 0; });

      const pills = root.querySelector("[data-ui-filter-pills]");
      if (pills) {
        pills.innerHTML = active().map(([k, v]) => {
          const key = keyOf(k), val = labelOf(k, v);
          return '<li class="ui-filter-pill"><span class="ui-filter-pill-key">' + esc(key) + '</span><span class="ui-filter-pill-value">' + esc(val) + '</span>' +
            '<button class="ui-filter-pill-remove" type="button" data-ui-filter-remove data-filter="' + esc(k) + '" data-value="' + esc(v) + '" aria-label="Remove ' + esc(key + ": " + val) + '">' +
            '<svg class="ico" aria-hidden="true"><use href="#fi-x"/></svg></button></li>';
        }).join("");
      }
      if (changed) root.dispatchEvent(new CustomEvent("ui:filterchange", { bubbles: true, detail: { query: state.query, filters: JSON.parse(JSON.stringify(state.filters)), sort: state.sort, shown, total } }));
    }

    function clear() {
      state.filters = {}; state.query = "";
      if (search) search.value = "";
      apply(true);
    }
    function toggle(k, v) { if ((state.filters[k] || []).includes(v)) remove(k, v); else add(k, v); apply(true); }

    if (search) search.addEventListener("input", () => { state.query = search.value.trim(); apply(true); });
    root.addEventListener("change", (e) => {
      const s = e.target.closest && e.target.closest("[data-ui-filter-sort]");
      if (!s) return;
      const v = (e.detail && e.detail.value) || e.target.value;
      if (v && v !== state.sort) { state.sort = v; apply(true); }
    });

    apply(false);
    root.__fumeFilterBar = {
      state: () => JSON.parse(JSON.stringify(state)),
      clear, toggle,
      sort: (v) => { state.sort = v; apply(true); },
      removeAt: (k, v) => { remove(k, v); apply(true); },
    };
    return root.__fumeFilterBar;
  }

  const barOf = (el) => {
    const own = el.closest("[data-ui-filter-bar]"); if (own) return own;
    const s = el.closest("[data-ui-filter-for]"); return s ? document.getElementById(s.getAttribute("data-ui-filter-for")) : null;
  };
  document.addEventListener("click", (e) => {
    const t = e.target.closest && e.target.closest("[data-ui-filter-option], [data-ui-filter-sort-option], [data-ui-filter-remove], [data-ui-filter-clear]");
    if (!t) return;
    const bar = barOf(t), api = bar && fumeFilterBar(bar);
    if (!api) return;
    if (t.matches("[data-ui-filter-option]")) api.toggle(t.dataset.filter, t.dataset.value);
    else if (t.matches("[data-ui-filter-sort-option]")) api.sort(t.dataset.value);
    else if (t.matches("[data-ui-filter-remove]")) {
      // focus moves to the next pill's remove circle, or back to the search
      const pills = Array.from(bar.querySelectorAll("[data-ui-filter-remove]")), i = pills.indexOf(t);
      api.removeAt(t.dataset.filter, t.dataset.value);
      const rest = Array.from(bar.querySelectorAll("[data-ui-filter-remove]"));
      const next = rest[Math.min(i, rest.length - 1)] || bar.querySelector("[data-ui-filter-search]");
      if (next) next.focus({ preventScroll: true });
    } else if (t.matches("[data-ui-filter-clear]")) {
      const inSheet = !!t.closest("[data-ui-filter-for]");
      api.clear();
      if (!inSheet) { const s = bar.querySelector("[data-ui-filter-search]"); if (s) s.focus({ preventScroll: true }); }
    }
  });
  // "/" jumps to the search of the first filter bar on screen
  document.addEventListener("keydown", (e) => {
    if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    const s = Array.from(document.querySelectorAll("[data-ui-filter-bar] [data-ui-filter-search]")).find((x) => {
      const r = x.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < innerHeight;
    });
    if (s) { e.preventDefault(); s.focus(); }
  });

  const initAll = () => document.querySelectorAll("[data-ui-filter-bar]").forEach(fumeFilterBar);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAll); else initAll();
  window.fumeFilterBar = fumeFilterBar;
})();
