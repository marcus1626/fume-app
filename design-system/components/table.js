// Data table: sorting and row selection. DECIDED 13 Oct, from round 7.
// Markup: <table class="ui-table" data-ui-table data-ui-checkbox-group> …
//           <th class="ui-table-head" aria-sort="none" data-sort="time">
//             <button class="ui-table-sort" type="button">Time <svg><use href="#fi-arrow-up-down"/></svg></button></th>
//           <th class="ui-table-head ui-table-cell--select"><button class="ui-checkbox" role="checkbox" data-ui-checkbox-all …>
//         … <tr class="ui-table-row" data-time="14:32" data-name="Feed 04"> <td class="ui-table-cell ui-table-cell--select">
//             <button class="ui-checkbox" role="checkbox" aria-checked="false" …> …
// Sort: a header with data-sort="key" sorts the body rows by each row's data-key (numbers as numbers, the
// rest in natural order), ascending then descending; aria-sort and the arrow icon follow.
// Select: the boxes are Fume checkboxes (checkbox.css + checkbox.js, which also runs select all); this file
// keeps each row's data-state="selected" and aria-selected in step with its box, and Shift-click selects
// the range from the last box clicked. Every change dispatches "fume:table-select" with { count, rows }
// (it bubbles). fumeTable(table) is safe to call twice and returns { select(rows, on), clear() }.
(function () {
  if (window.fumeTable) return;
  const ICON = { ascending: "arrow-up", descending: "arrow-down" };
  const BOX = '.ui-checkbox[role="checkbox"]';

  function fumeTable(table) {
    if (!table || table.__fumeTable) return table && table.__fumeTable;
    const body = table.tBodies[0], head = table.tHead;
    if (!body) return null;
    const rows = () => Array.from(body.rows);
    const boxOf = (row) => row.querySelector(BOX);
    let anchor = null, shift = false, busy = false, queued = false;

    const syncRow = (row) => {
      const b = boxOf(row), on = !!b && b.getAttribute("aria-checked") === "true";
      if (on) row.dataset.state = "selected"; else row.removeAttribute("data-state");
      row.setAttribute("aria-selected", String(on));
    };
    const emit = () => {
      queued = false;
      const sel = rows().filter((r) => r.dataset.state === "selected");
      table.dispatchEvent(new CustomEvent("fume:table-select", { bubbles: true, detail: { count: sel.length, rows: sel } }));
    };
    const setBox = (b, on) => {
      if (!b || b.disabled) return;
      if (window.fumeCheckbox && window.fumeCheckbox.set) window.fumeCheckbox.set(b, on);
      else { b.setAttribute("aria-checked", String(on)); b.dataset.state = on ? "checked" : "unchecked"; }
    };
    // Shift-click: remember it before checkbox.js (on the document) toggles the box.
    table.addEventListener("click", (e) => {
      const b = e.target.closest(BOX);
      if (b && body.contains(b)) shift = e.shiftKey;
      const s = e.target.closest(".ui-table-sort");
      if (s && head && head.contains(s)) sort(s.closest("th"));
    });
    table.addEventListener("ui-checkedchange", (e) => {
      const row = e.target.closest("tr");
      if (row && body.contains(row)) {
        syncRow(row);
        if (!busy && shift && anchor && anchor !== row && rows().includes(anchor)) {
          busy = true;
          const list = rows(), [a, z] = [list.indexOf(anchor), list.indexOf(row)].sort((m, n) => m - n), on = e.detail.checked === true;
          list.slice(a, z + 1).forEach((r) => { if (r !== row) { setBox(boxOf(r), on); syncRow(r); } });
          busy = false;
        }
        if (!busy) { anchor = row; shift = false; }
      }
      if (!queued) { queued = true; queueMicrotask(emit); }
    });

    const icon = (th) => {
      const use = th.querySelector(".ui-table-sort use"); if (!use) return;
      use.setAttribute("href", "#fi-" + (ICON[th.getAttribute("aria-sort")] || "arrow-up-down"));
    };
    function sort(th) {
      const key = th && th.dataset.sort; if (!key) return;
      const dir = th.getAttribute("aria-sort") === "ascending" ? "descending" : "ascending";
      head.querySelectorAll("th[data-sort]").forEach((h) => { h.setAttribute("aria-sort", h === th ? dir : "none"); icon(h); });
      const val = (r) => r.dataset[key] || "";
      const num = (x) => (/^-?\d+(\.\d+)?$/.test(x.trim()) ? parseFloat(x) : NaN);
      rows().sort((a, b) => {
        const x = val(a), y = val(b), nx = num(x), ny = num(y);
        const c = !isNaN(nx) && !isNaN(ny) ? nx - ny : x.localeCompare(y, undefined, { numeric: true, sensitivity: "base" });
        return dir === "ascending" ? c : -c;
      }).forEach((r) => body.appendChild(r));
    }
    if (head) head.querySelectorAll("th[data-sort]").forEach((h) => { if (!h.hasAttribute("aria-sort")) h.setAttribute("aria-sort", "none"); icon(h); });
    rows().forEach(syncRow);
    emit();
    const api = {
      select: (list, on) => { list.forEach((r) => { setBox(boxOf(r), on !== false); syncRow(r); }); emit(); },
      clear: () => { rows().forEach((r) => { setBox(boxOf(r), false); syncRow(r); }); emit(); },
    };
    table.__fumeTable = api;
    return api;
  }

  const initAll = () => document.querySelectorAll("[data-ui-table]").forEach(fumeTable);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAll); else initAll();
  window.fumeTable = fumeTable;
})();
