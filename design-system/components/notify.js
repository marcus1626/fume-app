// Notifications: read state, the bell's count, mark all read, the inbox filter, the popover's half row.
// DECIDED 13 Oct, from round 8. CSS: notify.css. The popover itself opens with popover.js (data-ui-popover-open).
// Markup:  <div class="ui-notify" id="inbox-list" data-ui-notify data-filter="all">
//            <section class="ui-notify-section"><h4 class="ui-notify-group">Today</h4>
//              <ul class="ui-notify-rows"><li><a class="ui-notify-item" href="#" data-state="unread" data-kind="mention">…</a></li></ul>
//            </section></div>
//          <span class="ui-notify-count" data-notify-count="inbox-list"></span>        the bell's count
//          <button data-notify-bell="inbox-list" aria-label="Notifications">            its label follows
//          <button data-notify-action="read-all" data-notify-for="inbox-list">Mark all read</button>
//          <div class="ui-seg" data-notify-filter="inbox-list">… <button class="ui-seg-option" data-filter="unread">
//          <div class="ui-notify-empty" data-notify-empty="inbox-list" hidden>…</div>  shown when nothing is left
//          <div class="ui-notify-scroll" data-notify-fit>                                stops on half a row
// A press on a row reads it; Mark all read reads them all; the filter (All, Unread, Mentions) shows the
// rows that match and the empty state when none do. Arrow Up and Down move between rows, Home and End
// jump. Each change fires "ui:notify-change" on the list, detail { unread }.
// window.fumeNotify = { read(row), readAll(list), filter(list, name), fit(scroll), sync(list) }. Safe to load twice.
(function () {
  if (window.fumeNotify) return;
  function byId(id) { return id ? document.getElementById(id) : null; }
  function qa(root, sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); }
  function rows(list) { return qa(list, '.ui-notify-item'); }
  function shown(n) { return !!(n.offsetWidth || n.offsetHeight || n.getClientRects().length); }
  function listOf(n) { return n && n.closest ? n.closest('[data-ui-notify]') : null; }

  function sync(list) {
    if (!list) return;
    var unread = rows(list).filter(function (r) { return r.getAttribute('data-state') === 'unread'; }).length;
    var id = list.id;
    if (id) {
      qa(document, '[data-notify-count="' + id + '"]').forEach(function (c) { c.textContent = unread ? (unread > 9 ? '9+' : String(unread)) : ''; c.hidden = !unread; });
      qa(document, '[data-notify-bell="' + id + '"]').forEach(function (b) { b.setAttribute('aria-label', unread ? 'Notifications, ' + unread + ' unread' : 'Notifications'); });
      qa(document, '[data-notify-action="read-all"][data-notify-for="' + id + '"]').forEach(function (b) { b.disabled = !unread; });
      qa(document, '[data-notify-unread="' + id + '"]').forEach(function (n) { n.textContent = unread ? unread + ' unread' : 'All read'; });
    }
    rows(list).forEach(function (r) {
      var u = r.getAttribute('data-state') === 'unread';
      var sr = r.querySelector('.ui-notify-sr');
      if (sr) sr.textContent = u ? 'Unread. ' : '';
    });
    list.dispatchEvent(new CustomEvent('ui:notify-change', { bubbles: true, detail: { unread: unread } }));
  }

  function read(row) {
    if (!row || row.getAttribute('data-state') !== 'unread') return;
    row.setAttribute('data-state', 'read');
    sync(listOf(row));
  }
  function readAll(list) {
    if (!list) return;
    rows(list).forEach(function (r) { r.setAttribute('data-state', 'read'); });
    sync(list);
    filter(list); // a list filtered to Unread empties: the calm empty state says so
  }

  // the filter shows the rows that match; a section with none left goes, and the empty state comes
  function filter(list, name) {
    if (!list) return;
    if (name) list.setAttribute('data-filter', name);
    var f = list.getAttribute('data-filter') || 'all', left = 0;
    rows(list).forEach(function (r) {
      var ok = f === 'all' || (f === 'unread' && r.getAttribute('data-state') === 'unread') || (f !== 'unread' && r.getAttribute('data-kind') === f.replace(/s$/, ''));
      (r.closest('li') || r).hidden = !ok;
      if (ok) left++;
    });
    qa(list, '.ui-notify-section').forEach(function (s) { s.hidden = !qa(s, '.ui-notify-item').some(function (r) { return !(r.closest('li') || r).hidden; }); });
    list.hidden = !left;
    if (list.id) qa(document, '[data-notify-empty="' + list.id + '"]').forEach(function (e) { e.hidden = !!left; });
  }

  // the popover list stops on the middle of a row, never on a label or a sliver: the row that crosses
  // the label plus --ui-notify-rows-visible rows is cut in half
  function fit(scroll) {
    if (!scroll || !shown(scroll)) return;
    var cs = getComputedStyle(document.documentElement);
    var rowH = parseFloat(cs.getPropertyValue('--ui-notify-row')) || 68;
    var label = parseFloat(cs.getPropertyValue('--ui-notify-label')) || 32;
    var n = parseFloat(cs.getPropertyValue('--ui-notify-rows-visible')) || 3.5;
    var target = label + rowH * n, top = scroll.getBoundingClientRect().top - scroll.scrollTop;
    var items = qa(scroll, '.ui-notify-item').filter(shown);
    var last = items[items.length - 1];
    if (!last || last.getBoundingClientRect().bottom - top <= target) { scroll.style.maxHeight = 'none'; return; }
    for (var i = 0; i < items.length; i++) {
      var r = items[i].getBoundingClientRect(), t = r.top - top, b = r.bottom - top;
      if (b > target) { scroll.style.maxHeight = Math.round(t + r.height / 2) + 'px'; return; }
    }
  }

  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    var all = e.target.closest('[data-notify-action="read-all"]');
    if (all) { readAll(byId(all.getAttribute('data-notify-for')) || listOf(all)); return; }
    var opt = e.target.closest('[data-notify-filter] .ui-seg-option');
    if (opt) { var seg = opt.closest('[data-notify-filter]'); filter(byId(seg.getAttribute('data-notify-filter')), opt.getAttribute('data-filter') || 'all'); return; }
    var row = e.target.closest('.ui-notify-item');
    if (row && listOf(row)) {
      if (row.getAttribute('href') === '#') e.preventDefault();
      read(row);
      return;
    }
    var open = e.target.closest('[data-ui-popover-open]');
    if (open) {
      var pop = byId(open.getAttribute('data-ui-popover-open'));
      if (pop) requestAnimationFrame(function () { qa(pop, '[data-notify-fit]').forEach(fit); });
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    var seg = e.target.closest && e.target.closest('[data-notify-filter]');
    if (seg && /^Arrow/.test(e.key)) {
      setTimeout(function () { var o = seg.querySelector('[aria-selected="true"]'); if (o) filter(byId(seg.getAttribute('data-notify-filter')), o.getAttribute('data-filter') || 'all'); }, 0);
      return;
    }
    var row = e.target.closest && e.target.closest('.ui-notify-item'), list = listOf(row);
    if (!row || !list) return;
    var items = rows(list).filter(shown), i = items.indexOf(row), j = -1;
    if (e.key === 'ArrowDown') j = Math.min(items.length - 1, i + 1);
    else if (e.key === 'ArrowUp') j = Math.max(0, i - 1);
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = items.length - 1;
    else return;
    e.preventDefault();
    if (items[j]) { items[j].focus(); items[j].scrollIntoView({ block: 'nearest' }); }
  });

  function init() {
    qa(document, '[data-ui-notify]').forEach(function (l) { sync(l); filter(l); });
    qa(document, '[data-notify-fit]').forEach(fit);
  }
  if (document.readyState !== 'loading') init(); else document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('resize', function () { qa(document, '[data-notify-fit]').forEach(fit); });

  window.fumeNotify = { read: read, readAll: readAll, filter: filter, fit: fit, sync: sync, init: init };
})();
