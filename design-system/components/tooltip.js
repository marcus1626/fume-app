// Tooltip: one small glass label for every [data-ui-tooltip] trigger. DECIDED 13 Oct, from round 7. Built on shadcn's
// tooltip (Radix: provider with delayDuration and skipDelayDuration, content with data-state and
// data-side, the trigger described by the content).
// Markup:  <button class="ui-btn ui-btn--quiet ui-btn--icon" aria-label="Download" data-ui-tooltip="Download"
//                  data-ui-tooltip-kbd="⌘D" data-ui-tooltip-side="top">…</button>
// The trigger keeps its own label (aria-label or text): the tooltip repeats it for the eye and never holds
// the only copy of anything. It shows after --ui-tooltip-delay under a resting mouse, at once when the
// mouse moves on to the next trigger within --ui-tooltip-skip-delay, and at once on keyboard focus.
// A press, Escape, leaving or scrolling hides it. On a touch screen a long press (--ui-tooltip-long-press)
// shows it for a moment and the tap that ends the long press does not act; a short tap acts as usual.
// window.fumeTooltip = { show(trigger), hide() }. Delegated, safe to load twice.
(function () {
  if (window.fumeTooltip) return;
  var root = document.documentElement;
  var tip = null, label = null, kbd = null, current = null, showTimer = 0, longTimer = 0, hideTimer = 0, lastHide = 0, suppress = null;
  function ms(name, fb) { var v = getComputedStyle(root).getPropertyValue(name).trim(); if (!v) return fb; var n = parseFloat(v); return /ms$/.test(v) ? n : /s$/.test(v) ? n * 1000 : n; }
  function triggerOf(n) { return n && n.closest ? n.closest('[data-ui-tooltip]') : null; }
  function ensure() {
    if (tip && tip.isConnected) return;
    tip = document.createElement('div');
    tip.className = 'ui-glass ui-glass--small ui-tooltip';
    tip.id = 'ui-tooltip';
    tip.setAttribute('role', 'tooltip');
    tip.hidden = true;
    label = document.createElement('span'); label.className = 'ui-tooltip-label';
    kbd = document.createElement('span'); kbd.className = 'ui-tooltip-kbd';
    tip.appendChild(label); tip.appendChild(kbd);
    document.body.appendChild(tip);
  }
  function accessibleName(t) { return (t.getAttribute('aria-label') || t.textContent || '').trim(); }

  function show(t) {
    clearTimeout(showTimer); clearTimeout(hideTimer);
    ensure();
    var was = current && !tip.hidden && tip.getAttribute('data-state') === 'open';
    if (current && current !== t) current.removeAttribute('aria-describedby');
    current = t;
    label.textContent = t.getAttribute('data-ui-tooltip');
    kbd.textContent = t.getAttribute('data-ui-tooltip-kbd') || '';
    tip.hidden = false;
    if (!was) tip.setAttribute('data-state', 'open');
    if (window.fumePopover) window.fumePopover.place(tip, t, { side: t.getAttribute('data-ui-tooltip-side') || 'top', align: 'center' });
    // describe the trigger only when the tooltip adds something to its name (a shortcut, a longer label)
    if (kbd.textContent || accessibleName(t) !== label.textContent) t.setAttribute('aria-describedby', 'ui-tooltip');
    t.setAttribute('data-state', 'delayed-open');
  }
  function hide() {
    clearTimeout(showTimer); clearTimeout(longTimer); clearTimeout(hideTimer);
    if (!tip || tip.hidden || !current) { current = null; return; }
    current.removeAttribute('aria-describedby'); current.setAttribute('data-state', 'closed');
    current = null; lastHide = Date.now();
    tip.setAttribute('data-state', 'closed');
    var done = function () { if (tip.getAttribute('data-state') === 'closed') tip.hidden = true; };
    if (window.fumePopover) window.fumePopover.afterAnimation(tip, done); else done();
  }

  document.addEventListener('pointerover', function (e) {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    var t = triggerOf(e.target); if (!t || t === current) return;
    clearTimeout(showTimer);
    var quick = (current && !tip.hidden) || Date.now() - lastHide < ms('--ui-tooltip-skip-delay', 300);
    if (quick) show(t); else showTimer = setTimeout(function () { show(t); }, ms('--ui-tooltip-delay', 500));
  });
  document.addEventListener('pointerout', function (e) {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    var t = triggerOf(e.target); if (!t) return;
    if (triggerOf(e.relatedTarget) === t) return;
    clearTimeout(showTimer);
    if (t === current) hide();
  });
  document.addEventListener('focusin', function (e) {
    var t = triggerOf(e.target); if (!t || t !== e.target) return;
    var kb = true; try { kb = t.matches(':focus-visible'); } catch (x) {}
    if (kb) show(t);
  });
  document.addEventListener('focusout', function (e) { if (triggerOf(e.target) === current) hide(); });
  document.addEventListener('pointerdown', function (e) {
    var t = triggerOf(e.target);
    if (current) hide();
    suppress = null;
    if (!t || e.pointerType !== 'touch') return;
    clearTimeout(longTimer);
    var x = e.clientX, y = e.clientY;
    longTimer = setTimeout(function () {
      show(t); suppress = t;
      hideTimer = setTimeout(hide, 1500);
    }, ms('--ui-tooltip-long-press', 500));
    t._uiTipStart = { x: x, y: y };
  }, true);
  document.addEventListener('pointermove', function (e) {
    var t = triggerOf(e.target);
    if (e.pointerType === 'touch' && t && t._uiTipStart && Math.hypot(e.clientX - t._uiTipStart.x, e.clientY - t._uiTipStart.y) > 10) clearTimeout(longTimer);
  });
  document.addEventListener('pointerup', function () { clearTimeout(longTimer); });
  document.addEventListener('pointercancel', function () { clearTimeout(longTimer); });
  // the tap that ends a long press only showed the label
  document.addEventListener('click', function (e) {
    if (suppress && triggerOf(e.target) === suppress) { e.preventDefault(); e.stopPropagation(); }
    suppress = null;
  }, true);
  document.addEventListener('contextmenu', function (e) { if (suppress && triggerOf(e.target) === suppress) e.preventDefault(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && current && !e.defaultPrevented) { e.preventDefault(); hide(); }
  }, true);
  window.addEventListener('scroll', function () { if (current) hide(); }, true);

  window.fumeTooltip = { show: show, hide: hide };
})();
