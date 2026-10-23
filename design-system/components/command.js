// Command palette: filter, keyboard, ⌘K. DECIDED 13 Oct, from round 7. Built on shadcn's command (cmdk: input, list,
// group, item with data-selected and data-disabled, empty) and command dialog.
// Markup:  <div class="ui-glass ui-dialog ui-command-dialog" id="palette" role="dialog" aria-label="Command palette" data-ui-command-hotkey hidden>
//            <div class="ui-command">
//              <div class="ui-command-input-wrapper"><svg>…search…</svg><input class="ui-command-input" placeholder="…"></div>
//              <div class="ui-command-list">
//                <div class="ui-command-group" aria-label="Creatives"><div class="ui-command-group-heading">Creatives</div>
//                  <div class="ui-command-item" data-keywords="lysne feed">…</div></div>
//                <div class="ui-command-empty" hidden>No match for “<span data-ui-command-query></span>”.</div>
//              </div></div></div>
// Typing filters the rows (every word must match the row's text or data-keywords; accents and case are
// ignored), hides empty groups and shows the empty state. Arrow keys, Home and End move the highlight
// (aria-activedescendant, so focus stays in the field); Enter or a click chooses: the row's own click
// runs and "ui:select" fires on the palette with detail.item; inside a dialog the dialog closes.
// ⌘K or Ctrl+K opens the palette marked data-ui-command-hotkey (through fumeDialog) or closes it.
// window.fumeCommand = { reset(el), filter(el), select(el, item) }. Delegated, safe to load twice.
(function () {
  if (window.fumeCommand) return;
  var uid = 0;
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/å/g, 'a'); }
  function cmdOf(n) { return n && n.closest ? n.closest('.ui-command') : null; }
  function all(cmd) { return Array.prototype.slice.call(cmd.querySelectorAll('.ui-command-item')); }
  function usable(cmd) { return all(cmd).filter(function (i) { return !i.hidden && i.getAttribute('data-disabled') !== 'true' && i.getAttribute('aria-disabled') !== 'true'; }); }
  function input(cmd) { return cmd.querySelector('.ui-command-input'); }

  function wire(cmd) {
    if (cmd._uiWired) return; cmd._uiWired = true;
    var list = cmd.querySelector('.ui-command-list'), inp = input(cmd);
    if (list) { if (!list.id) list.id = 'ui-command-list-' + (++uid); list.setAttribute('role', 'listbox'); }
    if (inp) {
      inp.setAttribute('role', 'combobox'); inp.setAttribute('aria-expanded', 'true'); inp.setAttribute('aria-autocomplete', 'list');
      if (list) inp.setAttribute('aria-controls', list.id);
      inp.setAttribute('autocomplete', 'off'); inp.setAttribute('spellcheck', 'false');
    }
    Array.prototype.forEach.call(cmd.querySelectorAll('.ui-command-group'), function (g) {
      g.setAttribute('role', 'group');
      var h = g.querySelector('.ui-command-group-heading');
      if (h) { if (!h.id) h.id = 'ui-command-h-' + (++uid); g.setAttribute('aria-labelledby', h.id); }
    });
    all(cmd).forEach(function (i) { i.setAttribute('role', 'option'); if (!i.id) i.id = 'ui-command-item-' + (++uid); if (i.getAttribute('data-disabled') === 'true') i.setAttribute('aria-disabled', 'true'); });
  }

  function select(cmd, item, scroll) {
    all(cmd).forEach(function (i) { var on = i === item; i.setAttribute('data-selected', String(on)); i.setAttribute('aria-selected', String(on)); });
    var inp = input(cmd); if (inp) { if (item) inp.setAttribute('aria-activedescendant', item.id); else inp.removeAttribute('aria-activedescendant'); }
    if (item && scroll) item.scrollIntoView({ block: 'nearest' });
  }

  function filter(cmd) {
    wire(cmd);
    var inp = input(cmd), q = norm(inp ? inp.value.trim() : ''), words = q ? q.split(/\s+/) : [];
    all(cmd).forEach(function (i) {
      var hay = norm(i.textContent + ' ' + (i.getAttribute('data-keywords') || ''));
      i.hidden = !words.every(function (w) { return hay.indexOf(w) >= 0; });
    });
    Array.prototype.forEach.call(cmd.querySelectorAll('.ui-command-group'), function (g) { g.hidden = !g.querySelector('.ui-command-item:not([hidden])'); });
    Array.prototype.forEach.call(cmd.querySelectorAll('.ui-command-separator'), function (s) { s.hidden = !!q; });
    var shown = all(cmd).filter(function (i) { return !i.hidden; });
    var empty = cmd.querySelector('.ui-command-empty');
    if (empty) { empty.hidden = shown.length > 0; Array.prototype.forEach.call(empty.querySelectorAll('[data-ui-command-query]'), function (s) { s.textContent = inp ? inp.value.trim() : ''; }); }
    select(cmd, usable(cmd)[0], false);
    var list = cmd.querySelector('.ui-command-list'); if (list) { list.scrollTop = 0; fit(list); }
  }
  // when the results scroll, the list stops at the middle of a row (never through the top of a line of
  // text): half a row is the scroll hint
  function fit(list) {
    list.style.maxHeight = '';
    var cs = getComputedStyle(list), max = parseFloat(cs.maxHeight);
    if (!max || !/auto|scroll/.test(cs.overflowY) || list.scrollHeight <= max + 1) return;
    // layout positions (offsetTop), not the screen: the palette is still scaling in while this runs
    var cut = 0, base = list.offsetTop;
    Array.prototype.forEach.call(list.querySelectorAll('.ui-command-item'), function (i) {
      if (i.hidden || !i.offsetHeight) return;
      var mid = (i.offsetParent === list ? i.offsetTop : i.offsetTop - base) + i.offsetHeight / 2;
      if (mid <= max && mid > cut) cut = mid;
    });
    if (cut) list.style.maxHeight = Math.round(cut) + 'px';
  }

  function reset(cmd) { wire(cmd); var inp = input(cmd); if (inp) inp.value = ''; filter(cmd); }

  function choose(cmd, item) {
    if (!item || item.getAttribute('data-disabled') === 'true') return;
    cmd.dispatchEvent(new CustomEvent('ui:select', { bubbles: true, detail: { item: item } }));
    var layer = cmd.closest('.ui-dialog');
    if (layer && window.fumeDialog && layer.getAttribute('data-state') === 'open') window.fumeDialog.close(layer);
  }

  document.addEventListener('input', function (e) { if (e.target.classList && e.target.classList.contains('ui-command-input')) filter(cmdOf(e.target)); });
  document.addEventListener('keydown', function (e) {
    // ⌘K / Ctrl+K anywhere
    if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.key === 'k' || e.key === 'K')) {
      var pal = document.querySelector('[data-ui-command-hotkey]');
      if (pal && window.fumeDialog) {
        e.preventDefault();
        if (pal.getAttribute('data-state') === 'open') window.fumeDialog.close(pal); else window.fumeDialog.open(pal, document.activeElement);
      }
      return;
    }
    var cmd = cmdOf(e.target); if (!cmd || !e.target.classList.contains('ui-command-input')) return;
    var list = usable(cmd), cur = cmd.querySelector('.ui-command-item[data-selected="true"]'), i = list.indexOf(cur);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); if (!list.length) return;
      var step = e.key === 'ArrowDown' ? 1 : -1;
      select(cmd, list[i < 0 ? 0 : (i + step + list.length) % list.length], true);
    } else if (e.key === 'Home' && e.ctrlKey || e.key === 'PageUp') { e.preventDefault(); select(cmd, list[0], true); }
    else if (e.key === 'End' && e.ctrlKey || e.key === 'PageDown') { e.preventDefault(); select(cmd, list[list.length - 1], true); }
    else if (e.key === 'Enter') { e.preventDefault(); if (cur) cur.click(); }
  });
  document.addEventListener('pointermove', function (e) {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    var it = e.target.closest && e.target.closest('.ui-command-item'); if (!it || it.getAttribute('data-selected') === 'true' || it.getAttribute('data-disabled') === 'true') return;
    var cmd = cmdOf(it); if (cmd) select(cmd, it, false);
  });
  // a press on a row keeps the focus (and the caret) in the field
  document.addEventListener('mousedown', function (e) { if (e.target.closest && e.target.closest('.ui-command-item, .ui-command-empty, .ui-command-group-heading')) e.preventDefault(); });
  document.addEventListener('click', function (e) {
    var it = e.target.closest && e.target.closest('.ui-command-item'); if (!it) return;
    var cmd = cmdOf(it); if (cmd) choose(cmd, it);
  });
  // every time the palette opens it starts clean
  document.addEventListener('ui:open', function (e) { var cmd = e.target.querySelector && e.target.querySelector('.ui-command'); if (cmd) reset(cmd); });

  window.fumeCommand = { reset: reset, filter: filter, select: function (cmd, item) { select(cmd, item, true); } };
})();
