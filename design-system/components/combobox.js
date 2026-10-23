// Combobox: a field that filters a glass listbox. DECIDED 13 Oct, from round 7. Built on shadcn's combobox (Base UI:
// input role="combobox", list role="listbox", items role="option" with aria-selected and
// data-highlighted, empty).
// Markup:  <div class="ui-combobox" data-ui-combobox>
//            <label class="ui-combobox-label" for="brand">Brand</label>
//            <div class="ui-combobox-field">
//              <input class="ui-combobox-input" id="brand" placeholder="Pick a brand">
//              <button class="ui-btn ui-btn--quiet ui-btn--icon ui-btn--sm ui-combobox-trigger" aria-label="Show brands" tabindex="-1">…chevrons…</button></div>
//            <div class="ui-glass ui-menu ui-combobox-content" hidden>
//              <div class="ui-menu-item ui-combobox-item" data-value="lysne">LYSNE<svg class="ui-menu-check">…</svg></div> …
//              <div class="ui-combobox-empty" hidden>No brand called “<span data-ui-combobox-query></span>”.</div></div></div>
// Typing opens and filters the list (accents and case ignored: "solv" finds Sølv), ArrowDown opens it,
// arrows, Home and End move the highlight, Enter or a click chooses, Escape closes it (and puts back the
// chosen name), Tab and a click outside close it. The chosen row gets aria-selected="true" (its check
// shows); the root gets data-value and fires "ui:select" with detail.value and detail.label.
// The list is fixed, 8 under the field and as wide as it, flipped above when there is no room.
// window.fumeCombobox = { open(root), close(root), value(root, v) }. Delegated, safe to load twice.
(function () {
  if (window.fumeCombobox) return;
  var uid = 0, current = null;
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/å/g, 'a'); }
  function rootOf(n) { return n && n.closest ? n.closest('[data-ui-combobox]') : null; }
  function parts(r) { return { input: r.querySelector('.ui-combobox-input'), field: r.querySelector('.ui-combobox-field'), list: r._uiList || r.querySelector('.ui-combobox-content') }; }
  function options(r) { var l = parts(r).list; return l ? Array.prototype.slice.call(l.querySelectorAll('[role="option"], .ui-combobox-item')) : []; }
  function usable(r) { return options(r).filter(function (o) { return !o.hidden && !o.hasAttribute('data-disabled') && o.getAttribute('aria-disabled') !== 'true'; }); }
  // the row's name: data-label, a .ui-combobox-item-label, or the row's own text (not its meta)
  function label(o) {
    if (o.hasAttribute('data-label')) return o.getAttribute('data-label');
    var l = o.querySelector('.ui-combobox-item-label'); if (l) return l.textContent.trim();
    var t = ''; Array.prototype.forEach.call(o.childNodes, function (n) { if (n.nodeType === 3) t += n.nodeValue; });
    return t.trim() || o.textContent.trim();
  }

  function wire(r) {
    if (r._uiWired) return; r._uiWired = true;
    var p = parts(r);
    r._uiList = p.list; p.list._uiRoot = r;
    if (!p.list.id) p.list.id = 'ui-combobox-list-' + (++uid);
    p.list.setAttribute('role', 'listbox');
    p.input.setAttribute('role', 'combobox'); p.input.setAttribute('aria-controls', p.list.id);
    p.input.setAttribute('aria-expanded', 'false'); p.input.setAttribute('aria-autocomplete', 'list');
    p.input.setAttribute('autocomplete', 'off'); p.input.setAttribute('spellcheck', 'false');
    options(r).forEach(function (o) { o.setAttribute('role', 'option'); if (!o.id) o.id = 'ui-combobox-opt-' + (++uid); if (!o.hasAttribute('aria-selected')) o.setAttribute('aria-selected', 'false'); });
    var sel = options(r).filter(function (o) { return o.getAttribute('aria-selected') === 'true'; })[0];
    if (sel) r.setAttribute('data-value', sel.getAttribute('data-value') || label(sel));
  }

  function highlight(r, o, scroll) {
    options(r).forEach(function (x) { if (x === o) x.setAttribute('data-highlighted', ''); else x.removeAttribute('data-highlighted'); });
    var inp = parts(r).input;
    if (o) { inp.setAttribute('aria-activedescendant', o.id); if (scroll) o.scrollIntoView({ block: 'nearest' }); } else inp.removeAttribute('aria-activedescendant');
  }

  function filter(r, showAll) {
    var p = parts(r), q = showAll ? '' : norm(p.input.value.trim());
    options(r).forEach(function (o) { o.hidden = !!q && norm(label(o) + ' ' + (o.getAttribute('data-keywords') || '')).indexOf(q) < 0; });
    var any = usable(r).length > 0, empty = p.list.querySelector('.ui-combobox-empty');
    if (empty) { empty.hidden = any; Array.prototype.forEach.call(empty.querySelectorAll('[data-ui-combobox-query]'), function (s) { s.textContent = p.input.value.trim(); }); }
    var sel = usable(r).filter(function (o) { return o.getAttribute('aria-selected') === 'true'; })[0];
    highlight(r, showAll && sel ? sel : usable(r)[0], true);
    if (r === current) place(r);
  }

  function place(r) {
    var p = parts(r);
    p.list.style.width = p.field.offsetWidth + 'px';
    if (window.fumePopover) window.fumePopover.place(p.list, p.field, { side: 'bottom', align: 'start' });
    else { var a = p.field.getBoundingClientRect(); p.list.style.left = a.left + 'px'; p.list.style.top = (a.bottom + 8) + 'px'; }
  }

  function open(r, showAll) {
    wire(r);
    if (current && current !== r) close(current, false);
    var p = parts(r);
    if (p.input.disabled || p.input.readOnly) return;
    current = r;
    if (p.list.hidden || p.list.getAttribute('data-state') !== 'open') {
      p.list.hidden = false; p.list.setAttribute('data-state', 'open');
      p.input.setAttribute('aria-expanded', 'true'); r.setAttribute('data-state', 'open');
    }
    filter(r, showAll);
    place(r);
  }

  function close(r, restore) {
    if (!r) return;
    var p = parts(r);
    if (r === current) current = null;
    if (p.list.hidden) return;
    p.list.setAttribute('data-state', 'closed');
    p.input.setAttribute('aria-expanded', 'false'); r.setAttribute('data-state', 'closed');
    highlight(r, null);
    var hide = function () { if (p.list.getAttribute('data-state') === 'closed') p.list.hidden = true; };
    if (window.fumePopover) window.fumePopover.afterAnimation(p.list, hide); else hide();
    if (restore !== false) {
      var sel = options(r).filter(function (o) { return o.getAttribute('aria-selected') === 'true'; })[0];
      p.input.value = sel ? label(sel) : (r.hasAttribute('data-ui-combobox-free') ? p.input.value : '');
    }
  }

  function choose(r, o) {
    if (!o) return;
    options(r).forEach(function (x) { x.setAttribute('aria-selected', String(x === o)); });
    var v = o.getAttribute('data-value') || label(o);
    r.setAttribute('data-value', v);
    var p = parts(r);
    p.input.value = label(o);
    p.input.removeAttribute('aria-invalid');
    close(r, false);
    r.dispatchEvent(new CustomEvent('ui:select', { bubbles: true, detail: { value: v, label: label(o) } }));
  }

  document.addEventListener('input', function (e) {
    if (!e.target.classList || !e.target.classList.contains('ui-combobox-input')) return;
    var r = rootOf(e.target); if (r) open(r, false);
  });
  document.addEventListener('keydown', function (e) {
    if (!e.target.classList || !e.target.classList.contains('ui-combobox-input')) return;
    var r = rootOf(e.target); if (!r) return; wire(r);
    var p = parts(r), isOpen = !p.list.hidden && p.list.getAttribute('data-state') === 'open';
    var list = usable(r), cur = p.list.querySelector('[data-highlighted]'), i = list.indexOf(cur);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) { open(r, true); return; }
      if (!list.length) return;
      var step = e.key === 'ArrowDown' ? 1 : -1;
      highlight(r, list[i < 0 ? 0 : (i + step + list.length) % list.length], true);
    } else if (isOpen && (e.key === 'Home' || e.key === 'End') && list.length) {
      e.preventDefault(); highlight(r, e.key === 'Home' ? list[0] : list[list.length - 1], true);
    } else if (e.key === 'Enter' && isOpen) {
      e.preventDefault(); if (cur) choose(r, cur);
    } else if (e.key === 'Escape' && isOpen) {
      e.preventDefault(); close(r, true);
    } else if (e.key === 'Tab' && isOpen) {
      close(r, true);
    }
  }, true); // capture: the open list takes Escape before a popover or dialog around it
  // the trigger toggles the full list and keeps focus in the field
  document.addEventListener('mousedown', function (e) {
    var t = e.target.closest && e.target.closest('.ui-combobox-trigger, .ui-combobox-content');
    if (t) e.preventDefault();
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    var t = e.target.closest('.ui-combobox-trigger');
    if (t) {
      var r = rootOf(t); if (!r) return; wire(r);
      var p = parts(r);
      if (!p.list.hidden && p.list.getAttribute('data-state') === 'open') close(r, true); else { open(r, true); p.input.focus(); }
      return;
    }
    var c = e.target.closest('.ui-combobox-clear');
    if (c) {
      var rc = rootOf(c); if (!rc) return; wire(rc);
      options(rc).forEach(function (x) { x.setAttribute('aria-selected', 'false'); });
      rc.removeAttribute('data-value'); parts(rc).input.value = ''; parts(rc).input.focus();
      rc.dispatchEvent(new CustomEvent('ui:select', { bubbles: true, detail: { value: null, label: '' } }));
      return;
    }
    var o = e.target.closest('.ui-combobox-item, [role="option"]');
    var list = o && o.closest('.ui-combobox-content');
    if (o && list && list._uiRoot && !o.hasAttribute('data-disabled')) choose(list._uiRoot, o);
  });
  document.addEventListener('pointermove', function (e) {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    var o = e.target.closest && e.target.closest('.ui-combobox-item');
    var list = o && o.closest('.ui-combobox-content');
    if (o && list && list._uiRoot && !o.hasAttribute('data-highlighted') && !o.hasAttribute('data-disabled')) highlight(list._uiRoot, o, false);
  });
  // a press outside closes it and puts back the chosen name
  document.addEventListener('pointerdown', function (e) {
    if (!current) return;
    var p = parts(current);
    if (current.contains(e.target) || p.list.contains(e.target)) return;
    close(current, true);
  }, true);
  document.addEventListener('focusout', function (e) {
    if (!current || !e.target.classList || !e.target.classList.contains('ui-combobox-input')) return;
    var r = current, p = parts(r);
    setTimeout(function () { if (current === r && !r.contains(document.activeElement) && !p.list.contains(document.activeElement)) close(r, true); }, 0);
  });
  window.addEventListener('resize', function () { if (current) place(current); });
  window.addEventListener('scroll', function (e) { if (current && !parts(current).list.contains(e.target)) place(current); }, true);

  window.fumeCombobox = {
    open: function (r) { open(r, true); }, close: function (r) { close(r, true); },
    value: function (r, v) { wire(r); var o = options(r).filter(function (x) { return (x.getAttribute('data-value') || label(x)) === v; })[0]; if (o) choose(r, o); return r.getAttribute('data-value'); }
  };
})();
