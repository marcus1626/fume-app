// Creative viewer: full screen on Ink, previous and next, zoom, pan, swipe, info. DECIDED 13 Oct, from round 8.
// Opens like shadcn's dialog through dialog.js (focus trap, Escape closes, focus back to the creative you
// came from, the page stops scrolling); without dialog.js it opens on its own.
// Markup:
//   <button data-ui-viewer-open="viewer" data-name="Feed · 03" data-campaign="Autumn launch · LYSNE"
//      data-format="feed" data-size="1080 × 1350" data-run="Run 214 · 12 Oct 14:02"
//      data-check="approved" data-by="Anna" data-time="14:32"><img src="…" alt="…"></button>   (one per creative)
//   <div class="ui-viewer" id="viewer" role="dialog" aria-modal="true" aria-label="Creative viewer" hidden> …
//     [data-viewer-field="name|campaign|count|format|size|run|status|time"], .ui-viewer-frame, .ui-viewer-media img,
//     [data-viewer-action="close|prev|next|zoom-in|zoom-out|fit|expand|info|download"] … </div>
//   A viewer shown in place (.ui-viewer--inline data-ui-viewer-list="viewer") reads the same triggers and works
//   the same, without the modal part.
// Keys inside the viewer: the arrows move, + and - zoom, 0 fits, I shows the info, F expands, Escape closes.
// A swipe of --ui-viewer-swipe moves on touch; past fit a drag pans; a double press zooms to 2x and back.
// window.fumeViewer = { open(idOrEl, index, trigger), close(idOrEl), show(el, index) }. Safe to load twice.
(function () {
  if (window.fumeViewer) return;
  var LEVELS = [1, 1.5, 2, 3];
  var FORMAT = { feed: 'Feed · 4:5', story: 'Story · 9:16', banner: 'Banner · 1.91:1' };
  var root = document.documentElement;
  var px = function (name, fb) { var v = parseFloat(getComputedStyle(root).getPropertyValue(name)); return isNaN(v) ? fb : v; };
  var el$ = function (x) { return typeof x === 'string' ? document.getElementById(x) : x; };
  var q = function (r, s) { return r.querySelector(s); };
  var qa = function (r, s) { return Array.prototype.slice.call(r.querySelectorAll(s)); };
  var listId = function (v) { return v.getAttribute('data-ui-viewer-list') || v.id; };
  var triggers = function (v) { return qa(document, '[data-ui-viewer-open="' + listId(v) + '"]'); };

  function data(t) {
    var img = q(t, 'img');
    return {
      src: t.getAttribute('data-src') || (img && (img.currentSrc || img.src)) || '',
      alt: (img && img.alt) || t.getAttribute('aria-label') || '',
      name: t.getAttribute('data-name') || '', campaign: t.getAttribute('data-campaign') || '',
      format: t.getAttribute('data-format') || 'feed', size: t.getAttribute('data-size') || '',
      run: t.getAttribute('data-run') || '', check: t.getAttribute('data-check') || 'waiting',
      by: t.getAttribute('data-by') || 'Anna', time: t.getAttribute('data-time') || ''
    };
  }
  function field(v, name, text) { qa(v, '[data-viewer-field="' + name + '"]').forEach(function (n) { n.textContent = text; }); }

  function show(v, i) {
    var list = triggers(v); if (!list.length) return;
    i = ((i % list.length) + list.length) % list.length;
    var d = data(list[i]), prev = +v.getAttribute('data-index');
    v.setAttribute('data-index', String(i));
    var img = q(v, '.ui-viewer-media img'); if (img) { img.src = d.src; img.alt = d.alt; }
    var frame = q(v, '.ui-viewer-frame'); if (frame) frame.setAttribute('data-format', d.format);
    field(v, 'name', d.name); field(v, 'campaign', d.campaign); field(v, 'count', (i + 1) + ' of ' + list.length);
    field(v, 'format', FORMAT[d.format] || d.format); field(v, 'size', d.size); field(v, 'run', d.run);
    field(v, 'status', d.check === 'approved' ? 'Checked · ' + d.by : 'In check'); field(v, 'time', d.check === 'approved' ? d.time : '');
    qa(v, '.ui-viewer-status').forEach(function (s) { s.setAttribute('data-check', d.check === 'approved' ? 'approved' : 'waiting'); });
    zoom(v, 1);
    if (!isNaN(prev) && prev !== i) { var m = q(v, '.ui-viewer-media'); if (m) { m.classList.remove('is-changing'); void m.offsetWidth; m.classList.add('is-changing'); } }
  }
  function go(v, step) { show(v, (+v.getAttribute('data-index') || 0) + step); }

  function zoom(v, z) {
    z = Math.max(LEVELS[0], Math.min(LEVELS[LEVELS.length - 1], z));
    v.setAttribute('data-zoom', String(z));
    v.toggleAttribute('data-zoomed', z > 1);
    var m = q(v, '.ui-viewer-media'); if (m) m.style.setProperty('--zoom', String(z));
    if (z === 1) pan(v, 0, 0); else pan(v, v._px || 0, v._py || 0);
    var lv = q(v, '.ui-viewer-zoom-num'); if (lv) lv.textContent = z === 1 ? 'Fit' : Math.round(z * 100) + ' %';
    var out = q(v, '[data-viewer-action="zoom-out"]'), inn = q(v, '[data-viewer-action="zoom-in"]');
    if (out) out.disabled = z <= LEVELS[0];
    if (inn) inn.disabled = z >= LEVELS[LEVELS.length - 1];
  }
  function step(v, dir) {
    var z = +v.getAttribute('data-zoom') || 1, i = LEVELS.indexOf(z);
    if (i < 0) i = 0;
    zoom(v, LEVELS[Math.max(0, Math.min(LEVELS.length - 1, i + dir))]);
  }
  function pan(v, x, y) {
    var m = q(v, '.ui-viewer-media'), f = q(v, '.ui-viewer-frame'); if (!m || !f) return;
    var z = +v.getAttribute('data-zoom') || 1, w = f.offsetWidth, h = f.offsetHeight;
    var mx = (z - 1) * w / 2, my = (z - 1) * h / 2;
    v._px = Math.max(-mx, Math.min(mx, x)); v._py = Math.max(-my, Math.min(my, y));
    m.style.setProperty('--pan-x', v._px + 'px'); m.style.setProperty('--pan-y', v._py + 'px');
  }

  function info(v, on) {
    var open = on == null ? v.getAttribute('data-info') === 'closed' : on;
    v.setAttribute('data-info', open ? 'open' : 'closed');
    qa(v, '[data-viewer-action="info"]').forEach(function (b) { b.setAttribute('aria-pressed', String(open)); });
  }
  function expand(v, on) {
    var hide = on == null ? v.getAttribute('data-chrome') !== 'hidden' : on;
    if (hide) v.setAttribute('data-chrome', 'hidden'); else v.removeAttribute('data-chrome');
    qa(v, '[data-viewer-action="expand"]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(hide));
      b.setAttribute('aria-label', hide ? 'Show the tools' : 'Expand: the creative alone');
      var use = q(b, 'use'); if (use) use.setAttribute('href', hide ? '#fi-minimize-2' : '#fi-maximize-2');
    });
  }
  function narrow(v) { return v.getBoundingClientRect().width < 720; }

  function open(target, index, trigger) {
    var v = el$(target); if (!v) return;
    expand(v, false);
    if (window.fumeDialog) window.fumeDialog.open(v, trigger); else { v.hidden = false; v.setAttribute('data-state', 'open'); v._back = trigger; }
    info(v, !narrow(v));
    show(v, index || 0);
  }
  function close(target) {
    var v = el$(target); if (!v) return;
    zoom(v, 1);
    if (window.fumeDialog && window.fumeDialog.top && window.fumeDialog.top() === v) window.fumeDialog.close(v);
    else { v.setAttribute('data-state', 'closed'); v.hidden = true; if (v._back) v._back.focus(); }
  }

  function download(v) {
    var img = q(v, '.ui-viewer-media img'); if (!img || !img.src) return;
    var name = (q(v, '[data-viewer-field="name"]') || {}).textContent || 'creative';
    var a = document.createElement('a');
    a.href = img.src; a.download = ('lysne ' + name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.jpg';
    document.body.appendChild(a); try { a.click(); } catch (e) {} a.remove();
    if (window.fumeToast) window.fumeToast({ type: 'done', title: 'Downloading ' + name });
  }

  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    var t = e.target.closest('[data-ui-viewer-open]');
    if (t) { e.preventDefault(); open(t.getAttribute('data-ui-viewer-open'), triggers(el$(t.getAttribute('data-ui-viewer-open'))).indexOf(t), t); return; }
    var a = e.target.closest('[data-viewer-action]'); if (!a) return;
    var v = a.closest('.ui-viewer'); if (!v) return;
    var act = a.getAttribute('data-viewer-action');
    if (act === 'close') close(v);
    else if (act === 'prev') go(v, -1);
    else if (act === 'next') go(v, 1);
    else if (act === 'zoom-in') step(v, 1);
    else if (act === 'zoom-out') step(v, -1);
    else if (act === 'fit') zoom(v, 1);
    else if (act === 'info') info(v);
    else if (act === 'expand') expand(v);
    else if (act === 'download') download(v);
  });

  document.addEventListener('dblclick', function (e) {
    var m = e.target.closest && e.target.closest('.ui-viewer-media'); if (!m) return;
    var v = m.closest('.ui-viewer'); zoom(v, (+v.getAttribute('data-zoom') || 1) > 1 ? 1 : 2);
  });

  document.addEventListener('keydown', function (e) {
    var v = e.target.closest && e.target.closest('.ui-viewer');
    if (!v || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest('input, textarea, select')) return;
    var k = e.key;
    if (k === 'ArrowRight') { e.preventDefault(); go(v, 1); }
    else if (k === 'ArrowLeft') { e.preventDefault(); go(v, -1); }
    else if (k === '+' || k === '=') { e.preventDefault(); step(v, 1); }
    else if (k === '-' || k === '_') { e.preventDefault(); step(v, -1); }
    else if (k === '0') { e.preventDefault(); zoom(v, 1); }
    else if (k === 'i' || k === 'I') { e.preventDefault(); info(v); }
    else if (k === 'f' || k === 'F') { e.preventDefault(); expand(v); }
    else if (k === 'Escape' && v.classList.contains('ui-viewer--inline') && v.getAttribute('data-chrome') === 'hidden') { e.preventDefault(); expand(v, false); }
  });

  // swipe to move, drag to pan once zoomed
  var drag = null;
  document.addEventListener('pointerdown', function (e) {
    var s = e.target.closest && e.target.closest('.ui-viewer-stage'); if (!s || e.button > 0) return;
    if (e.target.closest('button, a')) return;
    var v = s.closest('.ui-viewer');
    drag = { v: v, s: s, x: e.clientX, y: e.clientY, px: v._px || 0, py: v._py || 0, id: e.pointerId, moved: false };
  });
  document.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    if (!drag.moved) { drag.moved = true; drag.v.setAttribute('data-dragging', ''); try { drag.s.setPointerCapture(drag.id); } catch (x) {} }
    var z = +drag.v.getAttribute('data-zoom') || 1, m = q(drag.v, '.ui-viewer-media');
    if (z > 1) pan(drag.v, drag.px + dx, drag.py + dy);
    else if (m) m.style.setProperty('--drag-x', dx * 0.6 + 'px');
  });
  function end(e) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    var d = drag; drag = null;
    d.v.removeAttribute('data-dragging');
    var m = q(d.v, '.ui-viewer-media'); if (m) m.style.setProperty('--drag-x', '0px');
    if (!d.moved || (+d.v.getAttribute('data-zoom') || 1) > 1 || !e) return;
    var dx = e.clientX - d.x, far = px('--ui-viewer-swipe', 48);
    if (Math.abs(dx) > far && Math.abs(dx) > Math.abs(e.clientY - d.y)) go(d.v, dx < 0 ? 1 : -1);
  }
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', function () { if (drag) { var v = drag.v; drag = null; v.removeAttribute('data-dragging'); var m = q(v, '.ui-viewer-media'); if (m) m.style.setProperty('--drag-x', '0px'); } });

  function init() {
    qa(document, '.ui-viewer[data-ui-viewer-list]').forEach(function (v) {
      if (v.hasAttribute('data-ui-ready')) return;
      v.setAttribute('data-ui-ready', '');
      if (!v.hasAttribute('data-info')) info(v, !narrow(v));
      show(v, +v.getAttribute('data-start') || 0);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  window.fumeViewer = { open: open, close: close, show: show, init: init };
})();
