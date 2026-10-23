// Context menu: right click, long press and the Menu key open the glass menu. DECIDED 13 Oct, from round 7.
// Built on shadcn's context-menu (Radix: trigger, content role="menu", items role="menuitem",
// data-state, data-highlighted).
// Markup:  <figure class="ui-context-menu-trigger" tabindex="0" data-ui-context-menu="tile-menu">…</figure>
//          <div class="ui-glass ui-menu ui-context-menu" id="tile-menu" role="menu" aria-label="Creative" hidden>
//            <button class="ui-menu-item" role="menuitem">…</button> …</div>
// Opens at the pointer (right click), at the finger after --ui-tooltip-long-press (touch), or at the
// trigger (Menu key, Shift+F10). Arrow keys, Home and End move the highlight, a letter jumps to the row
// that starts with it, Enter or Space chooses, Escape, Tab or a click outside closes; focus goes back to
// the trigger. The trigger's own element gets data-state="open" while it is open, and the menu fires
// "ui:select" with detail.item when a row is chosen.
// window.fumeContextMenu = { open(menu, trigger, x, y), close() }. Delegated, safe to load twice.
(function () {
  if (window.fumeContextMenu) return;
  var root = document.documentElement;
  var current = null; // { menu, trigger }
  function ms(name, fb) { var v = getComputedStyle(root).getPropertyValue(name).trim(); if (!v) return fb; var n = parseFloat(v); return /ms$/.test(v) ? n : /s$/.test(v) ? n * 1000 : n; }
  function items(menu) { return Array.prototype.filter.call(menu.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]'), function (i) { return !i.disabled && !i.hasAttribute('data-disabled') && i.getAttribute('aria-disabled') !== 'true'; }); }
  function highlight(menu, item) {
    Array.prototype.forEach.call(menu.querySelectorAll('[data-highlighted]'), function (i) { i.removeAttribute('data-highlighted'); });
    if (item) { item.setAttribute('data-highlighted', ''); try { item.focus({ preventScroll: true }); } catch (e) { item.focus(); } }
  }

  function open(menu, trigger, x, y) {
    if (typeof menu === 'string') menu = document.getElementById(menu);
    if (!menu) return;
    if (current) close(false);
    current = { menu: menu, trigger: trigger };
    menu.hidden = false;
    menu.setAttribute('data-state', 'open');
    menu.querySelectorAll('[role^="menuitem"]').forEach(function (i) { i.tabIndex = -1; });
    if (trigger) trigger.setAttribute('data-state', 'open');
    // at the point, growing from it; flipped to stay on screen
    var m = parseFloat(getComputedStyle(root).getPropertyValue('--ui-overlay-margin')) || 16;
    menu.style.left = '0px'; menu.style.top = '0px';
    var w = menu.offsetWidth, h = menu.offsetHeight, vw = root.clientWidth, vh = window.innerHeight;
    var left = x + w > vw - m ? Math.max(m, x - w) : x, top = y + h > vh - m ? Math.max(m, y - h) : y;
    menu.style.left = Math.round(left) + 'px'; menu.style.top = Math.round(top) + 'px';
    menu.style.transformOrigin = (left < x ? '100%' : '0') + ' ' + (top < y ? '100%' : '0');
    menu.setAttribute('data-side', top < y ? 'top' : 'bottom');
    requestAnimationFrame(function () { highlight(menu, items(menu)[0]); });
  }

  function close(returnFocus) {
    if (!current) return;
    var c = current; current = null;
    c.menu.setAttribute('data-state', 'closed');
    Array.prototype.forEach.call(c.menu.querySelectorAll('[data-highlighted]'), function (i) { i.removeAttribute('data-highlighted'); });
    var hide = function () { if (c.menu.getAttribute('data-state') === 'closed') c.menu.hidden = true; };
    if (window.fumePopover) window.fumePopover.afterAnimation(c.menu, hide); else hide();
    if (c.trigger) {
      c.trigger.setAttribute('data-state', 'closed');
      if (returnFocus !== false) { try { c.trigger.focus({ preventScroll: true }); } catch (e) { c.trigger.focus(); } }
    }
  }

  function triggerOf(node) { return node && node.closest ? node.closest('[data-ui-context-menu]') : null; }
  function menuOf(t) { return document.getElementById(t.getAttribute('data-ui-context-menu')); }

  document.addEventListener('contextmenu', function (e) {
    var t = triggerOf(e.target); if (!t) return;
    if (t._uiLongPressed) { e.preventDefault(); return; }
    if (press && press.t === t) { cancelPress(); t._uiLongPressed = true; } // the system's long press came first
    e.preventDefault();
    open(menuOf(t), t, e.clientX, e.clientY);
  });

  // long press on touch
  var press = null;
  document.addEventListener('pointerdown', function (e) {
    if (current && !current.menu.contains(e.target)) close(false);
    if (e.pointerType !== 'touch') return;
    var t = triggerOf(e.target); if (!t) return;
    t._uiLongPressed = false;
    press = { t: t, x: e.clientX, y: e.clientY, timer: setTimeout(function () {
      t.removeAttribute('data-pressing');
      t._uiLongPressed = true;
      if (navigator.vibrate) { try { navigator.vibrate(8); } catch (x) {} }
      open(menuOf(t), t, press ? press.x : e.clientX, press ? press.y : e.clientY);
      press = null;
    }, ms('--ui-tooltip-long-press', 500)) };
    t.setAttribute('data-pressing', '');
  }, true);
  function cancelPress() { if (press) { clearTimeout(press.timer); press.t.removeAttribute('data-pressing'); press = null; } }
  document.addEventListener('pointermove', function (e) { if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) cancelPress(); });
  document.addEventListener('pointerup', cancelPress);
  document.addEventListener('pointercancel', cancelPress);
  // the tap that ends a long press is not a click on the creative
  document.addEventListener('click', function (e) {
    var t = triggerOf(e.target);
    if (t && t._uiLongPressed) { e.preventDefault(); e.stopPropagation(); t._uiLongPressed = false; }
  }, true);

  // keyboard: open from the trigger, move and choose inside the menu
  document.addEventListener('keydown', function (e) {
    if (!current) {
      var t = triggerOf(e.target);
      if (t && e.target === t && (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10'))) {
        e.preventDefault(); var r = t.getBoundingClientRect(); open(menuOf(t), t, r.left + Math.min(24, r.width / 2), r.top + Math.min(24, r.height / 2));
      }
      return;
    }
    var menu = current.menu, list = items(menu), i = list.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
    if (e.key === 'Tab') { e.preventDefault(); close(true); return; }
    if (!menu.contains(e.target)) return;
    var step = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (step) { e.preventDefault(); highlight(menu, list[(i + step + list.length) % list.length]); return; }
    if (e.key === 'Home') { e.preventDefault(); highlight(menu, list[0]); return; }
    if (e.key === 'End') { e.preventDefault(); highlight(menu, list[list.length - 1]); return; }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (list[i]) list[i].click(); return; }
    if (e.key.length === 1 && /\S/.test(e.key)) {
      var k = e.key.toLowerCase(), from = list.slice(i + 1).concat(list.slice(0, i + 1));
      var hit = from.filter(function (n) { return n.textContent.trim().toLowerCase().charAt(0) === k; })[0];
      if (hit) highlight(menu, hit);
    }
  }, true);

  // pointer: the row under the mouse is the highlighted one; a click chooses it
  document.addEventListener('pointermove', function (e) {
    if (!current || e.pointerType !== 'mouse') return;
    var it = e.target.closest && e.target.closest('[role^="menuitem"]');
    if (it && current.menu.contains(it) && !it.hasAttribute('data-highlighted') && items(current.menu).indexOf(it) >= 0) highlight(current.menu, it);
  });
  document.addEventListener('click', function (e) {
    if (!current) return;
    var it = e.target.closest && e.target.closest('[role^="menuitem"]');
    if (!it || !current.menu.contains(it)) return;
    var menu = current.menu;
    close(true);
    menu.dispatchEvent(new CustomEvent('ui:select', { bubbles: true, detail: { item: it } }));
  });
  window.addEventListener('resize', function () { close(false); });
  window.addEventListener('scroll', function (e) { if (current && !current.menu.contains(e.target)) close(false); }, true);

  window.fumeContextMenu = { open: open, close: close };
})();
