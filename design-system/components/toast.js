// Toast (sonner): a stack of glass pill bars at the bottom centre. DECIDED 13 Oct, from round 7. Built on shadcn's
// sonner (toast(), toast.success, toast.error, toast.loading, toast.promise, an action, dismiss).
// API:     var t = fumeToast({ type: 'done' | 'error' | 'loading' | 'info', title: '3 creatives approved',
//                              meta: '4 of 12', action: { label: 'Undo', onClick: fn }, duration: ms });
//          t.update({ type: 'done', title: '12 creatives ready', action: … }); t.dismiss();
//          fumeToast.done(title, opts), .error(title, opts), .loading(title, opts),
//          .promise(promise, { loading, done, error }), .dismiss(id?)
// Markup:  <button data-ui-toast="done" data-ui-toast-title="3 creatives approved" data-ui-toast-action="Undo">
// Up to three show; each older one sits a little higher and smaller behind the newest, with its words
// hidden; a mouse over the stack (or focus in it) opens it into a column and pauses every timer, as
// does a hidden page. A toast leaves after --ui-toast-duration (--ui-toast-duration-long with an action or
// for an error; a loading toast stays until updated), swipes away sideways or down past --ui-toast-swipe,
// and Escape dismisses the one with focus. Alt+T moves focus to the stack. The region is a polite live
// region, created once, so every new toast is announced.
(function () {
  if (window.fumeToast) return;
  var root = document.documentElement;
  var region = null, list = null, toasts = [], n = 0, expanded = false, paused = false;
  var ICON = { done: 'circle-check', success: 'circle-check', error: 'circle-alert', loading: 'loader-circle', info: 'info' };
  function css(name) { return getComputedStyle(root).getPropertyValue(name).trim(); }
  function ms(name, fb) { var v = css(name); if (!v) return fb; var x = parseFloat(v); return /ms$/.test(v) ? x : /s$/.test(v) ? x * 1000 : x; }
  function px(name, fb) { var v = parseFloat(css(name)); return isNaN(v) ? fb : v; }

  function ensure() {
    if (region && region.isConnected) return;
    if (!document.body) return;
    region = document.createElement('section');
    region.className = 'ui-toaster';
    region.setAttribute('aria-label', 'Notifications (Alt+T)');
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-relevant', 'additions text');
    region.tabIndex = -1;
    list = document.createElement('ol');
    list.className = 'ui-toaster-list';
    region.appendChild(list);
    document.body.appendChild(region);
    region.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') setExpanded(true); });
    region.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && !region.contains(document.activeElement)) setExpanded(false); });
    region.addEventListener('focusin', function () { setExpanded(true); });
    region.addEventListener('focusout', function (e) { if (!region.contains(e.relatedTarget)) setExpanded(false); });
  }
  function setExpanded(on) { expanded = on; region.classList.toggle('is-expanded', on); setPaused(on || document.hidden); }
  function setPaused(on) {
    if (on === paused) return; paused = on;
    toasts.forEach(function (t) { if (on) stop(t); else start(t); });
  }
  document.addEventListener('visibilitychange', function () { setPaused(expanded || document.hidden); });

  function durationOf(t) {
    if (t.type === 'loading') return Infinity;
    if (t.duration) return t.duration;
    return (t.type === 'error' || t.action) ? ms('--ui-toast-duration-long', 8000) : ms('--ui-toast-duration', 5000);
  }
  function start(t) {
    stop(t); if (paused) return;
    if (t.left == null) t.left = durationOf(t);
    if (!isFinite(t.left)) return;
    t.since = Date.now();
    t.timer = setTimeout(function () { dismiss(t); }, t.left);
  }
  function stop(t) { if (t.timer) { clearTimeout(t.timer); t.timer = null; if (t.since) t.left = Math.max(0, t.left - (Date.now() - t.since)); } }

  function render(t) {
    var li = t.li;
    li.setAttribute('data-type', t.type);
    li.textContent = '';
    var ic = ICON[t.type];
    if (ic) {
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'ico ui-toast-icon'); svg.setAttribute('aria-hidden', 'true');
      var use = document.createElementNS('http://www.w3.org/2000/svg', 'use'); use.setAttribute('href', '#fi-' + ic);
      svg.appendChild(use); li.appendChild(svg);
    }
    var title = document.createElement('span'); title.className = 'ui-toast-title'; title.textContent = t.title || ''; li.appendChild(title);
    if (t.meta) { var meta = document.createElement('span'); meta.className = 'ui-toast-meta'; meta.textContent = t.meta; li.appendChild(meta); }
    if (t.action) {
      var b = document.createElement('button'); b.type = 'button';
      b.className = 'ui-btn ui-btn--glass-clear ui-btn--sm ui-toast-action';
      b.textContent = t.action.label || t.action;
      b.addEventListener('click', function (e) { e.stopPropagation(); if (t.action.onClick) t.action.onClick(e); dismiss(t); });
      li.appendChild(b);
    }
  }

  function layout() {
    toasts.forEach(function (t, i) {
      t.li.style.setProperty('--i', i);
      t.li.setAttribute('data-index', String(i));
      t.li.style.zIndex = String(10 - i);
      t.li.setAttribute('aria-hidden', i > 2 ? 'true' : 'false');
    });
  }

  function toast(opts) {
    if (typeof opts === 'string') opts = { title: opts };
    opts = opts || {};
    ensure(); if (!region) return null;
    var t = { id: opts.id || ++n, type: opts.type || 'done', title: opts.title, meta: opts.meta, action: opts.action, duration: opts.duration };
    if (typeof t.action === 'string') t.action = { label: t.action };
    t.li = document.createElement('li');
    t.li.className = 'ui-glass ui-glass--bar ui-toast';
    t.li.setAttribute('data-state', 'open');
    t.li.tabIndex = 0;
    render(t);
    list.appendChild(t.li);
    toasts.unshift(t);
    swipe(t);
    layout();
    toasts.slice(3).forEach(function (old) { dismiss(old); });
    start(t);
    var api = {
      id: t.id,
      update: function (o) { Object.keys(o || {}).forEach(function (k) { t[k] = o[k]; }); if (typeof t.action === 'string') t.action = { label: t.action }; render(t); t.left = null; start(t); return api; },
      dismiss: function () { dismiss(t); }
    };
    t.api = api;
    return api;
  }

  function dismiss(t, dir) {
    var i = toasts.indexOf(t); if (i < 0) return;
    toasts.splice(i, 1);
    stop(t);
    var focused = t.li.contains(document.activeElement);
    if (dir) { t.li.style.setProperty('--exit-x', dir.x + 'px'); t.li.style.setProperty('--exit-y', dir.y + 'px'); }
    t.li.setAttribute('data-state', 'closed');
    var gone = false, remove = function () { if (!gone) { gone = true; t.li.remove(); } };
    t.li.addEventListener('animationend', function (e) { if (e.target === t.li) remove(); });
    setTimeout(remove, 600);
    if (getComputedStyle(t.li).animationName === 'none') remove();
    layout();
    if (focused) { var next = toasts[0]; if (next) next.li.focus(); else region.focus(); }
    if (!toasts.length && expanded && !region.matches(':hover')) setExpanded(false);
  }

  // swipe sideways or down to dismiss; shorter springs back
  function swipe(t) {
    var li = t.li, s = null;
    li.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button') || e.button > 0) return;
      s = { x: e.clientX, y: e.clientY, id: e.pointerId, t: performance.now() };
      try { li.setPointerCapture(e.pointerId); } catch (x) {}
    });
    li.addEventListener('pointermove', function (e) {
      if (!s || e.pointerId !== s.id) return;
      var dx = e.clientX - s.x, dy = Math.max(0, e.clientY - s.y);
      if (Math.abs(dx) > 2 || dy > 2) li.setAttribute('data-swiping', '');
      li.style.setProperty('--swipe-x', dx + 'px');
      li.style.setProperty('--swipe-y', dy + 'px');
      s.dx = dx; s.dy = dy;
    });
    function end(e) {
      if (!s || (e && e.pointerId !== s.id)) return;
      var d = s; s = null; li.removeAttribute('data-swiping');
      var far = px('--ui-toast-swipe', 48), v = Math.hypot(d.dx || 0, d.dy || 0) / Math.max(1, performance.now() - d.t);
      if (Math.abs(d.dx || 0) > far || (d.dy || 0) > far || v > 0.6) {
        var sideways = Math.abs(d.dx || 0) >= (d.dy || 0);
        dismiss(t, sideways ? { x: (d.dx > 0 ? 1 : -1) * li.offsetWidth, y: 0 } : { x: 0, y: li.offsetHeight * 2 });
      } else { li.style.setProperty('--swipe-x', '0px'); li.style.setProperty('--swipe-y', '0px'); }
    }
    li.addEventListener('pointerup', end);
    li.addEventListener('pointercancel', end);
  }

  document.addEventListener('keydown', function (e) {
    if (e.altKey && (e.code === 'KeyT')) { ensure(); if (toasts.length) { e.preventDefault(); var b = toasts[0].li.querySelector('button'); (b || toasts[0].li).focus(); } return; }
    if (e.key === 'Escape' && region && region.contains(e.target) && !e.defaultPrevented) {
      var t = toasts.filter(function (x) { return x.li.contains(e.target); })[0];
      if (t) { e.preventDefault(); dismiss(t); }
    }
  });

  // declarative triggers
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-ui-toast]'); if (!b) return;
    toast({ type: b.getAttribute('data-ui-toast') || 'done', title: b.getAttribute('data-ui-toast-title') || b.textContent.trim(), meta: b.getAttribute('data-ui-toast-meta') || undefined, action: b.getAttribute('data-ui-toast-action') || undefined });
  });

  if (document.body) ensure(); else document.addEventListener('DOMContentLoaded', ensure);

  toast.done = function (title, o) { return toast(Object.assign({}, o, { type: 'done', title: title })); };
  toast.success = toast.done;
  toast.error = function (title, o) { return toast(Object.assign({}, o, { type: 'error', title: title })); };
  toast.loading = function (title, o) { return toast(Object.assign({}, o, { type: 'loading', title: title })); };
  toast.info = function (title, o) { return toast(Object.assign({}, o, { type: 'info', title: title })); };
  toast.promise = function (p, m) {
    var t = toast.loading(m.loading);
    Promise.resolve(p).then(function (v) { t.update(Object.assign({ type: 'done' }, typeof m.done === 'function' ? m.done(v) : { title: m.done })); },
      function (err) { t.update(Object.assign({ type: 'error' }, typeof m.error === 'function' ? m.error(err) : { title: m.error })); });
    return t;
  };
  toast.dismiss = function (id) { toasts.slice().forEach(function (t) { if (id == null || t.id === id) dismiss(t); }); };
  window.fumeToast = toast;
})();
