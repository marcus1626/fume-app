// Popover and hover card: placement, open and close. DECIDED 13 Oct, from round 7. Built on shadcn's popover and
// hover-card (Radix: data-state="open|closed" on trigger and content, data-side and data-align on the
// content, aria-expanded on a popover's trigger).
// Popover:    <button data-ui-popover-open="share" aria-haspopup="dialog">Share</button>
//             <div class="ui-glass ui-popover" id="share" role="dialog" aria-label="Share with Anna"
//                  data-ui-side="bottom" data-ui-align="start" hidden>…</div>
//             A click toggles it; focus moves into it and returns to the trigger; Escape, a click outside
//             or [data-ui-popover-close] closes it.
// Hover card: <a class="ui-hover-card-trigger" href="#anna" data-ui-hover-card="anna">Anna</a>
//             <div class="ui-glass ui-hover-card" id="anna" data-ui-side="top" hidden>…</div>
//             Opens after --ui-popover-hover-delay under a resting mouse or on keyboard focus, stays while
//             the pointer travels into it; on a touch screen the first tap opens it, the next follows the link.
// Placement:  side bottom|top|start|end (left and right too), align start|center|end. The requested side
//             is data-ui-side; the side it got (after a flip) is written to data-side, as Radix does.
//             It flips when the side has no room and keeps --ui-overlay-margin inside the screen.
// window.fumePopover = { place(el, anchor, opts), open(el, trigger), close(el, opts), toggle(el, trigger) }.
// Delegated from document, so it works for content rendered later. Safe to load more than once.
(function () {
  if (window.fumePopover) return;
  var root = document.documentElement;
  function css(name) { return getComputedStyle(root).getPropertyValue(name).trim(); }
  function px(name, fb) { var v = parseFloat(css(name)); return isNaN(v) ? fb : v; }
  function ms(name, fb) { var v = css(name); if (!v) return fb; var n = parseFloat(v); return /ms$/.test(v) ? n : /s$/.test(v) ? n * 1000 : n; }
  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  var OPP = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
  var open = []; // open popovers and hover cards, last is on top

  function physical(side) {
    var rtl = getComputedStyle(document.body || root).direction === 'rtl';
    if (side === 'start') return rtl ? 'right' : 'left';
    if (side === 'end') return rtl ? 'left' : 'right';
    return side || 'bottom';
  }

  // Place a fixed element next to an anchor (an element or a rect {left, top, right, bottom}).
  function place(el, anchor, opts) {
    opts = opts || {};
    var a = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : anchor;
    if (!a) return;
    var aw = a.right - a.left, ah = a.bottom - a.top;
    var side = physical(opts.side || el.getAttribute('data-ui-side') || 'bottom');
    var align = opts.align || el.getAttribute('data-ui-align') || 'center';
    var gap = opts.offset != null ? opts.offset : px('--ui-overlay-offset', 8);
    var m = px('--ui-overlay-margin', 16);
    var vw = root.clientWidth, vh = window.innerHeight;
    el.style.left = '0px'; el.style.top = '0px';
    var w = el.offsetWidth, h = el.offsetHeight;
    var room = { bottom: vh - a.bottom - gap - m, top: a.top - gap - m, right: vw - a.right - gap - m, left: a.left - gap - m };
    var need = side === 'top' || side === 'bottom' ? h : w;
    if (room[side] < need && room[OPP[side]] > room[side]) side = OPP[side];
    // beside the anchor and no room on either side (a phone): below it, or above when that has more room
    if (room[side] < need && (side === 'left' || side === 'right')) side = room.bottom >= h || room.bottom >= room.top ? 'bottom' : 'top';
    var x, y;
    if (side === 'top' || side === 'bottom') {
      y = side === 'bottom' ? a.bottom + gap : a.top - gap - h;
      x = align === 'start' ? a.left : align === 'end' ? a.right - w : a.left + aw / 2 - w / 2;
    } else {
      x = side === 'right' ? a.right + gap : a.left - gap - w;
      y = align === 'start' ? a.top : align === 'end' ? a.bottom - h : a.top + ah / 2 - h / 2;
    }
    x = Math.max(m, Math.min(x, vw - m - w));
    y = Math.max(m, Math.min(y, vh - m - h));
    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';
    el.setAttribute('data-side', side);
    el.setAttribute('data-align', align);
    // grow from the anchor
    var ox = Math.max(0, Math.min(w, a.left + aw / 2 - x)), oy = Math.max(0, Math.min(h, a.top + ah / 2 - y));
    el.style.transformOrigin = side === 'bottom' ? ox + 'px 0' : side === 'top' ? ox + 'px 100%' : side === 'right' ? '0 ' + oy + 'px' : '100% ' + oy + 'px';
    return side;
  }

  function afterAnimation(el, fn) {
    var done = false;
    function finish() { if (!done) { done = true; fn(); } }
    var cs = getComputedStyle(el);
    if (cs.animationName === 'none' || parseFloat(cs.animationDuration) === 0) return finish();
    el.addEventListener('animationend', function h(e) { if (e.target === el) { el.removeEventListener('animationend', h); finish(); } });
    setTimeout(finish, 600);
  }

  function byId(id) { return id ? document.getElementById(id) : null; }
  function isHoverCard(el) { return el.classList.contains('ui-hover-card'); }

  function show(el, trigger, focus) {
    if (!el) return;
    if (open.indexOf(el) >= 0) { if (trigger) place(el, trigger); return; }
    // one popover at a time, unless it is nested in another
    open.slice().forEach(function (o) { if (!o.contains(trigger) && isHoverCard(o) === isHoverCard(el)) hide(o, { focus: false }); });
    el._uiTrigger = trigger || el._uiTrigger;
    el.hidden = false;
    el.setAttribute('data-state', 'open');
    var t = el._uiTrigger;
    if (t) {
      t.setAttribute('data-state', 'open');
      if (!isHoverCard(el)) { t.setAttribute('aria-expanded', 'true'); if (el.id) t.setAttribute('aria-controls', el.id); }
      place(el, t);
    }
    open.push(el);
    if (focus !== false && !isHoverCard(el)) {
      var f = el.querySelector('[data-ui-autofocus]') || el.querySelector(FOCUSABLE);
      if (!f) { el.tabIndex = -1; f = el; }
      requestAnimationFrame(function () { try { f.focus({ preventScroll: true }); } catch (e) { f.focus(); } });
    }
  }

  function hide(el, opts) {
    opts = opts || {};
    var i = open.indexOf(el); if (i < 0) return;
    open.splice(i, 1);
    clearTimeout(el._uiTimer);
    el.setAttribute('data-state', 'closed');
    var t = el._uiTrigger;
    if (t) { t.setAttribute('data-state', 'closed'); if (!isHoverCard(el)) t.setAttribute('aria-expanded', 'false'); }
    afterAnimation(el, function () { if (el.getAttribute('data-state') === 'closed') el.hidden = true; });
    if (opts.focus !== false && t && el.contains(document.activeElement)) { try { t.focus({ preventScroll: true }); } catch (e) { t.focus(); } }
    else if (opts.focus === true && t) t.focus();
  }

  function toggle(el, trigger) { if (open.indexOf(el) >= 0) hide(el, { focus: true }); else show(el, trigger); }

  // ---------- popover: click ----------
  var lastPointer = 'mouse';
  document.addEventListener('pointerdown', function (e) {
    lastPointer = e.pointerType || 'mouse';
    // a press outside every open layer (and its trigger) closes it
    open.slice().forEach(function (el) {
      var t = el._uiTrigger;
      if (el.contains(e.target) || (t && t.contains(e.target))) return;
      if (e.target.closest && e.target.closest('.ui-popover, .ui-hover-card, .ui-context-menu, .ui-combobox-content, .ui-tooltip') && !isHoverCard(el)) return;
      hide(el, { focus: false });
    });
  }, true);

  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-ui-popover-open]');
    if (t) { e.preventDefault(); toggle(byId(t.getAttribute('data-ui-popover-open')), t); return; }
    var c = e.target.closest && e.target.closest('[data-ui-popover-close]');
    if (c) { var p = c.closest('.ui-popover, .ui-hover-card'); if (p) hide(p, { focus: true }); return; }
    // hover card on touch: the first tap opens, the next follows the link
    var h = e.target.closest && e.target.closest('[data-ui-hover-card]');
    if (h && lastPointer !== 'mouse') {
      var card = byId(h.getAttribute('data-ui-hover-card'));
      if (card && open.indexOf(card) < 0) { e.preventDefault(); show(card, h, false); }
    }
  });

  // Escape closes the top layer first, before a dialog under it (capture, then preventDefault)
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !open.length || e.defaultPrevented) return;
    var top = open[open.length - 1];
    e.preventDefault();
    hide(top, { focus: !isHoverCard(top) ? true : false });
  }, true);

  // ---------- hover card: rest, travel, focus ----------
  function cardFor(node) {
    if (!node || !node.closest) return null;
    var t = node.closest('[data-ui-hover-card]');
    if (t) return { card: byId(t.getAttribute('data-ui-hover-card')), trigger: t };
    var c = node.closest('.ui-hover-card');
    return c ? { card: c, trigger: c._uiTrigger } : null;
  }
  function schedule(card, fn, delay) { clearTimeout(card._uiTimer); card._uiTimer = setTimeout(fn, delay); }
  document.addEventListener('pointerover', function (e) {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    var hit = cardFor(e.target); if (!hit || !hit.card) return;
    if (open.indexOf(hit.card) >= 0) { clearTimeout(hit.card._uiTimer); return; }
    schedule(hit.card, function () { show(hit.card, hit.trigger, false); }, ms('--ui-popover-hover-delay', 500));
  });
  document.addEventListener('pointerout', function (e) {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    var from = cardFor(e.target); if (!from || !from.card) return;
    var to = cardFor(e.relatedTarget);
    if (to && to.card === from.card) return;
    if (open.indexOf(from.card) < 0) { clearTimeout(from.card._uiTimer); return; }
    schedule(from.card, function () { hide(from.card, { focus: false }); }, ms('--ui-popover-hover-close-delay', 240));
  });
  document.addEventListener('focusin', function (e) {
    var t = e.target.closest && e.target.closest('[data-ui-hover-card]');
    if (!t) return;
    var focusVisible = false; try { focusVisible = t.matches(':focus-visible'); } catch (x) { focusVisible = true; }
    if (!focusVisible) return;
    var card = byId(t.getAttribute('data-ui-hover-card'));
    if (card) schedule(card, function () { show(card, t, false); }, ms('--ui-popover-hover-delay', 500));
  });
  document.addEventListener('focusout', function (e) {
    var t = e.target.closest && e.target.closest('[data-ui-hover-card]');
    if (!t) return;
    var card = byId(t.getAttribute('data-ui-hover-card'));
    if (card) { if (open.indexOf(card) >= 0) hide(card, { focus: false }); else clearTimeout(card._uiTimer); }
  });

  // keep open layers on their anchors
  function replace() { open.forEach(function (el) { if (el._uiTrigger && el._uiTrigger.isConnected) place(el, el._uiTrigger); }); }
  window.addEventListener('resize', replace);
  window.addEventListener('scroll', replace, true);

  window.fumePopover = { place: place, open: show, close: hide, toggle: toggle, afterAnimation: afterAnimation };
})();
