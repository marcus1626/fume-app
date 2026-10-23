// Dialog, alert dialog, sheet and drawer: open, close, focus, scroll lock, drawer snaps. DECIDED 13 Oct, from round 7.
// Built on shadcn's dialog, alert-dialog, sheet (all Radix Dialog) and drawer (vaul).
// Markup:  <button data-ui-dialog-open="send">Send for check</button>
//          <div class="ui-glass ui-dialog" id="send" role="dialog" aria-labelledby="send-title" hidden>
//            … <button data-ui-dialog-close>Not yet</button> …</div>
//          role="alertdialog": the scrim does not close it and the first [data-ui-dialog-close] (Cancel)
//          gets focus. data-ui-dialog-open-narrow="id" opens another layer on a phone (max-width 600px),
//          for shadcn's responsive pattern: the sheet on a desk, the drawer on a phone.
//          Drawer: <div class="ui-glass ui-drawer" …><button class="ui-drawer-handle" aria-label="…"></button>…
// On open: a scrim (.ui-dialog-overlay) goes in under it, data-state="open", the page stops scrolling,
// focus moves to [data-ui-autofocus] or the first control, Tab stays inside. Escape closes the top layer
// (unless something on top of it took the Escape first), the scrim closes a dialog (not an alert
// dialog), and focus returns to the trigger. It fires "ui:open" and "ui:close" on the layer.
// window.fumeDialog = { open(idOrEl, trigger), close(idOrEl), top() }. Delegated, safe to load twice.
(function () {
  if (window.fumeDialog) return;
  var root = document.documentElement;
  var stack = [];
  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  var FLOATING = '.ui-popover, .ui-hover-card, .ui-context-menu, .ui-combobox-content, .ui-select-content, .ui-toaster, .ui-tooltip';
  function css(name) { return getComputedStyle(root).getPropertyValue(name).trim(); }
  function el$(x) { return typeof x === 'string' ? document.getElementById(x) : x; }
  function visible(n) { return !!(n.offsetWidth || n.offsetHeight || n.getClientRects().length) && getComputedStyle(n).visibility !== 'hidden'; }
  function focusables(layer) { return Array.prototype.filter.call(layer.querySelectorAll(FOCUSABLE), visible); }
  function focus(n) { if (!n) return; try { n.focus({ preventScroll: true }); } catch (e) { n.focus(); } }
  function afterAnimation(el, fn) {
    var done = false;
    function finish() { if (!done) { done = true; fn(); } }
    var cs = getComputedStyle(el);
    if (cs.animationName === 'none' || parseFloat(cs.animationDuration) === 0) return finish();
    el.addEventListener('animationend', function h(e) { if (e.target === el) { el.removeEventListener('animationend', h); finish(); } });
    setTimeout(finish, 700);
  }

  function open(target, trigger) {
    var el = el$(target);
    if (!el || stack.some(function (l) { return l.el === el; })) return;
    var active = document.activeElement;
    // a trigger inside a menu that is closing (a context menu's Delete) hands focus back to where it went
    var returnTo = trigger && !trigger.closest('[data-state="closed"], [hidden]') ? trigger : (active && active !== document.body ? active : trigger);
    var scrim = document.createElement('div');
    scrim.className = 'ui-dialog-overlay';
    scrim.setAttribute('data-state', 'open');
    scrim.setAttribute('aria-hidden', 'true');
    el.parentNode.insertBefore(scrim, el);
    el.hidden = false;
    el.setAttribute('data-state', 'open');
    el.setAttribute('aria-modal', 'true');
    if (!el.hasAttribute('tabindex')) el.tabIndex = -1;
    if (trigger) { trigger.setAttribute('aria-expanded', 'true'); trigger.setAttribute('data-state', 'open'); }
    var layer = { el: el, scrim: scrim, trigger: trigger, returnTo: returnTo };
    stack.push(layer);
    root.classList.add('ui-scroll-lock');
    scrim.addEventListener('click', function () { if (el.getAttribute('role') !== 'alertdialog' && el.getAttribute('data-ui-dismiss') !== 'false') close(el); });
    if (el.classList.contains('ui-drawer')) drawerOpen(el);
    var first = el.querySelector('[data-ui-autofocus]')
      || (el.getAttribute('role') === 'alertdialog' && el.querySelector('[data-ui-dialog-close]:not(.ui-dialog-close)'))
      || focusables(el).filter(function (n) { return !n.matches('.ui-dialog-close, .ui-sheet-close, .ui-drawer-handle'); })[0]
      || el;
    requestAnimationFrame(function () { focus(first); });
    el.dispatchEvent(new CustomEvent('ui:open', { bubbles: true }));
  }

  function close(target) {
    var el = el$(target);
    var i = -1;
    stack.forEach(function (l, j) { if (l.el === el) i = j; });
    if (i < 0) return;
    var layer = stack.splice(i, 1)[0];
    el.setAttribute('data-state', 'closed');
    layer.scrim.setAttribute('data-state', 'closed');
    if (layer.trigger) { layer.trigger.setAttribute('aria-expanded', 'false'); layer.trigger.setAttribute('data-state', 'closed'); }
    afterAnimation(el, function () {
      if (el.getAttribute('data-state') === 'closed') { el.hidden = true; el.style.height = ''; el.style.removeProperty('--drawer-y'); }
      layer.scrim.remove();
    });
    if (!stack.length) root.classList.remove('ui-scroll-lock');
    var back = layer.returnTo;
    if (back && back.isConnected && visible(back)) focus(back);
    else if (layer.trigger && layer.trigger.isConnected && visible(layer.trigger)) focus(layer.trigger);
    el.dispatchEvent(new CustomEvent('ui:close', { bubbles: true }));
  }

  function top() { return stack.length ? stack[stack.length - 1].el : null; }

  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    var t = e.target.closest('[data-ui-dialog-open]');
    if (t) {
      e.preventDefault();
      var narrow = t.getAttribute('data-ui-dialog-open-narrow');
      var id = narrow && window.matchMedia('(max-width: 600px)').matches ? narrow : t.getAttribute('data-ui-dialog-open');
      open(id, t);
      return;
    }
    var c = e.target.closest('[data-ui-dialog-close]');
    if (c) { var layer = c.closest('.ui-dialog, .ui-sheet, .ui-drawer'); if (layer) close(layer); }
  });

  document.addEventListener('keydown', function (e) {
    var t = top(); if (!t) return;
    if (e.key === 'Escape') {
      // the innermost thing closes first: an open list, menu or select inside the layer takes the Escape
      var a0 = document.activeElement;
      if (a0 && a0.closest && (a0.closest('[role="listbox"]:not([hidden]), [role="menu"]:not([hidden])') || a0.closest('[aria-haspopup][aria-expanded="true"], [role="combobox"][aria-expanded="true"]'))) return;
      if (!e.defaultPrevented) { e.preventDefault(); close(t); }
      return;
    }
    if (e.key !== 'Tab') return;
    if (e.target.closest && e.target.closest(FLOATING) && !t.contains(e.target)) return;
    var f = focusables(t);
    if (!f.length) { e.preventDefault(); focus(t); return; }
    var first = f[0], last = f[f.length - 1], a = document.activeElement;
    if (e.shiftKey && (a === first || !t.contains(a))) { e.preventDefault(); focus(last); }
    else if (!e.shiftKey && (a === last || !t.contains(a))) { e.preventDefault(); focus(first); }
  });
  // focus that escapes the top layer (a click on the page through a gap, a script) comes back
  document.addEventListener('focusin', function (e) {
    var t = top(); if (!t || t.contains(e.target)) return;
    if (e.target.closest && e.target.closest(FLOATING)) return;
    var f = focusables(t); focus(f[0] || t);
  });

  // ---------- drawer: snap points, drag, keyboard ----------
  function snaps(el) {
    var prev = el.style.height; el.style.height = '';
    var full = el.offsetHeight;                       // its content, up to the CSS max-height
    el.style.height = prev;
    var share = parseFloat(css('--ui-drawer-snap')) || 0.6;
    var first = Math.min(full, Math.round(window.innerHeight * share));
    return first < full - 24 ? [first, full] : [full];
  }
  function setHeight(el, h, animate) {
    el.classList.toggle('is-snapping', !!animate);
    el.style.height = Math.round(h) + 'px';
    el.style.setProperty('--drawer-y', '0px');
    el._uiSnap = h;
  }
  function drawerOpen(el) {
    el._uiSnaps = snaps(el);
    setHeight(el, el._uiSnaps[0], false);
    el.setAttribute('data-snap', '0');
  }
  function snapTo(el, i) {
    var s = el._uiSnaps || snaps(el); i = Math.max(0, Math.min(s.length - 1, i));
    setHeight(el, s[i], true); el.setAttribute('data-snap', String(i));
  }
  var drag = null;
  document.addEventListener('pointerdown', function (e) {
    var h = e.target.closest && e.target.closest('.ui-drawer-handle, .ui-drawer-header');
    if (!h || e.button > 0) return;
    var el = h.closest('.ui-drawer'); if (!el || el.getAttribute('data-state') !== 'open') return;
    if (e.target.closest('button:not(.ui-drawer-handle), a, input, textarea, select')) return;
    el._uiSnaps = el._uiSnaps || snaps(el);
    drag = { el: el, y: e.clientY, h: el.offsetHeight, t: performance.now(), lastY: e.clientY, lastT: performance.now(), moved: false, id: e.pointerId, handle: h };
    try { h.setPointerCapture(e.pointerId); } catch (x) {}
  });
  document.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dy = e.clientY - drag.y;
    if (!drag.moved && Math.abs(dy) < 4) return;
    drag.moved = true; drag.el.setAttribute('data-dragging', '');
    drag.el.classList.remove('is-snapping');
    var s = drag.el._uiSnaps, min = s[0], max = s[s.length - 1];
    var h = drag.h - dy;
    if (h > max) h = max + (h - max) / 6;                 // a little give past fully open
    if (h >= min) { drag.el.style.height = h + 'px'; drag.el.style.setProperty('--drawer-y', '0px'); }
    else { drag.el.style.height = min + 'px'; drag.el.style.setProperty('--drawer-y', (min - h) + 'px'); }
    drag.v = (e.clientY - drag.lastY) / Math.max(1, performance.now() - drag.lastT);
    drag.lastY = e.clientY; drag.lastT = performance.now();
  });
  function endDrag(e) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    var d = drag; drag = null;
    d.el.removeAttribute('data-dragging');
    if (!d.moved) return;
    d.el._uiNoClick = true; setTimeout(function () { d.el._uiNoClick = false; }, 0); // the click after a drag is not a press
    var s = d.el._uiSnaps, h = d.h - (d.lastY - d.y), v = d.v || 0;
    if (h < s[0] * 0.66 || (v > 0.6 && h < s[0] + 8)) { close(d.el); return; }
    var target = 0, best = Infinity;
    s.forEach(function (p, i) { var dist = Math.abs(p - h) - (v < -0.4 && p > h ? 200 : 0) - (v > 0.4 && p < h ? 200 : 0); if (dist < best) { best = dist; target = i; } });
    snapTo(d.el, target);
  }
  document.addEventListener('pointerup', endDrag);
  document.addEventListener('pointercancel', endDrag);
  // a click on the handle (no drag) and the keyboard move between snaps
  document.addEventListener('click', function (e) {
    var h = e.target.closest && e.target.closest('.ui-drawer-handle'); if (!h) return;
    var el = h.closest('.ui-drawer'); if (!el || el._uiNoClick) return;
    var s = el._uiSnaps || [], i = +(el.getAttribute('data-snap') || 0);
    if (s.length > 1) snapTo(el, (i + 1) % s.length);
  });
  document.addEventListener('keydown', function (e) {
    var h = e.target.closest && e.target.closest('.ui-drawer-handle'); if (!h) return;
    var el = h.closest('.ui-drawer'); if (!el) return;
    var i = +(el.getAttribute('data-snap') || 0);
    if (e.key === 'ArrowUp') { e.preventDefault(); snapTo(el, i + 1); }
    if (e.key === 'ArrowDown') { e.preventDefault(); snapTo(el, i - 1); }
  });
  window.addEventListener('resize', function () {
    stack.forEach(function (l) { if (l.el.classList.contains('ui-drawer')) { l.el._uiSnaps = snaps(l.el); snapTo(l.el, +(l.el.getAttribute('data-snap') || 0)); } });
  });

  window.fumeDialog = { open: open, close: close, top: top };
})();
