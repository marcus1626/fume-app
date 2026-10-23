// Quality Gate review: Anna's screen. DECIDED 13 Oct, from round 8. See qg-review.css for the look.
// Markup (shortened):
//   <div class="ui-qg" data-ui-qg data-index="3" data-total="12" data-reviewer="Anna"
//        data-approved-message="Checked. Marcus can approve it now." [data-now="14:32"]>   data-now fixes the clock
//     <div class="ui-qg-screen" data-state="waiting" tabindex="-1">        waiting | approved | changes
//       <header class="ui-qg-bar">… <span class="ui-qg-count">3 of 12</span> [data-qg-action="prev|next"] …
//         <div class="ui-qg-format"><div class="ui-seg">… <button class="ui-seg-option" data-format="story" data-size="1080 × 1920">
//       <div class="ui-qg-stage"><figure class="ui-qg-creative" data-format="feed">
//         <div class="ui-qg-media"><img> <button class="ui-qg-pin" data-pin="1" style="--x: 40%; --y: 30%">1</button>
//           <span class="ui-qg-seal" data-check="waiting">…<span class="ui-qg-seal-text">In check</span><time class="ui-qg-seal-time"></time></span></div>
//       <aside class="ui-qg-sheet" data-snap="peek"> <button class="ui-qg-handle"> … rows with data-pin="1" …
//         <div class="ui-qg-compose"><input class="ui-input"> … <ol class="ui-qg-notes" hidden>
//         <div class="ui-qg-decision ui-qg-decision--waiting"> [data-qg-action="approve"] [data-qg-action="changes"]
//         <div class="ui-qg-decision ui-qg-decision--done"> <p class="ui-qg-outcome"> [data-qg-action="undo"] [data-qg-action="next"]
// Keys (while focus is in the screen, not in a field): C marks it checked, R requests changes, the arrows move
// to the previous and next creative. Pressing the creative pins a new note there and moves focus to the
// note field; Enter adds the note, Escape takes the pin away. A pin and its note light up together.
// On a phone the handle opens and closes the sheet.
// A decision shows one toast in words (Undo is on the screen, next to the outcome); undo takes the toast away.
// Events on the .ui-qg root: "ui:qg-decide" { decision: "approved" | "changes" | "undo", index },
// "ui:qg-navigate" { index, step }, "ui:qg-format" { format }, "ui:qg-note" { pin, text }.
// window.fumeQG = { approve(root), changes(root), undo(root), go(root, step), set(root, { state, time, by }) }.
// Delegated from document, so it works for screens rendered later; safe to load twice.
(function () {
  if (window.fumeQG) return;
  var pad = function (n) { return String(n).padStart(2, '0'); };
  // the clock; data-now on the screen fixes it (a demo or a test tells one consistent story)
  var now = function (r) { var f = r && r.getAttribute('data-now'); if (f) return f; var d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  var rootOf = function (n) { return n && n.closest ? n.closest('[data-ui-qg]') : null; };
  var q = function (r, s) { return r.querySelector(s); };
  var qa = function (r, s) { return Array.prototype.slice.call(r.querySelectorAll(s)); };
  var screen = function (r) { return q(r, '.ui-qg-screen'); };
  var stateOf = function (r) { return screen(r).getAttribute('data-state') || 'waiting'; };
  var fire = function (r, name, detail) { r.dispatchEvent(new CustomEvent(name, { bubbles: true, detail: detail })); };
  var focus = function (n) { if (n) { try { n.focus({ preventScroll: true }); } catch (e) { n.focus(); } } };
  // one toast per screen, words only: the Undo lives on the screen, where the decision was made, so the
  // toast keeps its whole line on a phone. A new decision replaces it; undo takes it away (it would be stale)
  var toast = function (r, opts) { drop(r); if (window.fumeToast) r._qgToast = window.fumeToast(opts); };
  var drop = function (r) { if (r._qgToast) { r._qgToast.dismiss(); r._qgToast = null; } };

  function seal(r, check, by, time, land) {
    var s = q(r, '.ui-qg-seal'); if (!s) return;
    var text = q(s, '.ui-qg-seal-text'), t = q(s, '.ui-qg-seal-time');
    s.setAttribute('data-check', check);
    if (text) text.textContent = check === 'approved' ? 'Checked · ' + by : check === 'changes' ? 'Changes requested' : 'In check';
    if (t) t.textContent = check === 'approved' ? time : '';
    s.classList.remove('is-landing');
    if (land) {
      void s.offsetWidth; // restart the landing
      s.classList.add('is-landing');
      setTimeout(function () { s.classList.remove('is-landing'); }, 900);
    }
  }
  function outcome(r, words) { var o = q(r, '.ui-qg-outcome'); if (o) o.textContent = words; }
  function notes(r) { return qa(r, '.ui-qg-pin:not([data-state="draft"])').filter(function (p) { return !p.hidden; }).length; }

  function set(r, o) {
    o = o || {};
    var st = o.state || 'waiting', by = o.by || r.getAttribute('data-reviewer') || 'Anna';
    screen(r).setAttribute('data-state', st);
    seal(r, st, by, o.time || '', false);
    if (st === 'approved') outcome(r, 'Checked by ' + by + ' at ' + (o.time || now(r)) + '.');
    if (st === 'changes') outcome(r, 'Sent back to the Engine with ' + plural(Math.max(1, notes(r)), 'note') + '.');
  }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }

  function approve(r) {
    if (stateOf(r) !== 'waiting') return;
    var by = r.getAttribute('data-reviewer') || 'Anna', time = now(r);
    screen(r).setAttribute('data-state', 'approved');
    seal(r, 'approved', by, time, true);
    outcome(r, 'Checked by ' + by + ' at ' + time + '.');
    toast(r, { type: 'done', title: r.getAttribute('data-approved-message') || 'Checked.' });
    focus(q(r, '.ui-qg-decision--done [data-qg-action="next"]'));
    fire(r, 'ui:qg-decide', { decision: 'approved', index: +r.getAttribute('data-index') });
  }

  function changes(r) {
    if (stateOf(r) !== 'waiting') return;
    var n = notes(r), field = q(r, '.ui-qg-compose .ui-input'), hint = q(r, '.ui-qg-compose-hint');
    if (!n) {
      if (hint) { hint.setAttribute('data-was', hint.getAttribute('data-was') || hint.textContent); hint.textContent = 'Add a note first, so the Engine knows what to change.'; }
      openSheet(r, true);
      focus(field);
      return;
    }
    screen(r).setAttribute('data-state', 'changes');
    seal(r, 'changes', '', '', false);
    outcome(r, 'Sent back to the Engine with ' + plural(n, 'note') + '.');
    toast(r, { type: 'done', title: 'Sent back to the Engine.' });
    focus(q(r, '.ui-qg-decision--done [data-qg-action="next"]'));
    fire(r, 'ui:qg-decide', { decision: 'changes', index: +r.getAttribute('data-index') });
  }

  function undo(r) {
    if (stateOf(r) === 'waiting') return;
    drop(r);
    screen(r).setAttribute('data-state', 'waiting');
    seal(r, 'waiting', '', '', false);
    focus(q(r, '[data-qg-action="approve"]'));
    fire(r, 'ui:qg-decide', { decision: 'undo', index: +r.getAttribute('data-index') });
  }

  function go(r, step) {
    var n = +r.getAttribute('data-total') || 1, i = +r.getAttribute('data-index') || 1;
    var j = ((i - 1 + step) % n + n) % n + 1;
    r.setAttribute('data-index', String(j));
    r._qgToast = null; // the toast stays as said; it no longer belongs to this creative
    var c = q(r, '.ui-qg-count'); if (c) c.textContent = j + ' of ' + n;
    dropDraft(r);
    var m = q(r, '.ui-qg-media'); if (m) { m.classList.remove('is-changing'); void m.offsetWidth; m.classList.add('is-changing'); }
    fire(r, 'ui:qg-navigate', { index: j, step: step });
  }

  // the format switch: the creative takes the chosen shape
  function syncFormat(r) {
    var opt = q(r, '.ui-qg-format [aria-selected="true"]'); if (!opt) return;
    var f = opt.getAttribute('data-format') || 'feed', cr = q(r, '.ui-qg-creative');
    if (!cr || cr.getAttribute('data-format') === f) return;
    cr.setAttribute('data-format', f);
    var size = opt.getAttribute('data-size');
    qa(r, '[data-qg-size]').forEach(function (n) { if (size) n.textContent = size; });
    var m = q(r, '.ui-qg-media'); if (m) { m.classList.remove('is-changing'); void m.offsetWidth; m.classList.add('is-changing'); }
    fire(r, 'ui:qg-format', { format: f });
  }

  // pins: a press on the creative places a draft pin and opens the note field
  function dropDraft(r) { qa(r, '.ui-qg-pin[data-state="draft"]').forEach(function (p) { p.remove(); }); label(r, null); }
  function label(r, n) {
    var l = q(r, '.ui-qg-compose-label'); if (!l) return;
    if (!l.hasAttribute('data-was')) l.setAttribute('data-was', l.textContent);
    l.textContent = n ? 'Note ' + n + ', pinned to the creative' : l.getAttribute('data-was');
  }
  function nextNumber(r) { return qa(r, '.ui-qg-pin:not([data-state="draft"])').length + 1; }
  function placeDraft(r, media, x, y) {
    var p = q(media, '.ui-qg-pin[data-state="draft"]'), n = nextNumber(r);
    if (!p) {
      p = document.createElement('button');
      p.type = 'button'; p.className = 'ui-qg-pin is-new'; p.setAttribute('data-state', 'draft'); p.setAttribute('data-pin', String(n));
      p.setAttribute('aria-label', 'Note ' + n + ', not written yet'); p.textContent = String(n);
      media.appendChild(p);
    }
    p.style.setProperty('--x', x.toFixed(1) + '%'); p.style.setProperty('--y', y.toFixed(1) + '%');
    label(r, n);
    openSheet(r, true);
    focus(q(r, '.ui-qg-compose .ui-input'));
  }
  function addNote(r) {
    var field = q(r, '.ui-qg-compose .ui-input'); if (!field) return;
    var text = field.value.trim(); if (!text) return;
    var p = q(r, '.ui-qg-pin[data-state="draft"]'), list = q(r, '.ui-qg-notes');
    var n = p ? +p.getAttribute('data-pin') : null, by = r.getAttribute('data-reviewer') || 'Anna', time = now(r);
    if (p) { p.removeAttribute('data-state'); p.classList.remove('is-active'); p.setAttribute('aria-label', 'Note ' + n + ': ' + text); }
    if (list) {
      var li = document.createElement('li');
      li.innerHTML = '<button class="ui-qg-row" type="button" data-result="note"><span class="ui-qg-mark ui-qg-mark--note" aria-hidden="true"></span>' +
        '<span class="ui-qg-row-text"></span><span class="ui-qg-by"><span class="ui-avatar ui-avatar--sm ui-avatar--ink" aria-hidden="true"></span><span></span><time class="ui-qg-by-time"></time></span></button>';
      var row = q(li, '.ui-qg-row'), mark = q(li, '.ui-qg-mark');
      if (n) { row.setAttribute('data-pin', String(n)); mark.textContent = String(n); } else { mark.innerHTML = '<svg class="ico" aria-hidden="true"><use href="#fi-message-square"/></svg>'; }
      q(li, '.ui-qg-row-text').textContent = text;
      q(li, '.ui-avatar').textContent = by.charAt(0);
      q(li, '.ui-qg-by > span:not(.ui-avatar)').textContent = by;
      q(li, '.ui-qg-by-time').textContent = time;
      list.appendChild(li); list.hidden = false;
      // in the open phone sheet the checklist scrolls: bring the new note and the field under it into view
      var more = q(r, '.ui-qg-more'), compose = q(r, '.ui-qg-compose');
      if (more && compose && more.scrollHeight > more.clientHeight) {
        var over = compose.getBoundingClientRect().bottom - more.getBoundingClientRect().bottom;
        if (over > 0) more.scrollTop += over;
      }
    }
    field.value = '';
    var hint = q(r, '.ui-qg-compose-hint'); if (hint && hint.hasAttribute('data-was')) hint.textContent = hint.getAttribute('data-was');
    label(r, null);
    fire(r, 'ui:qg-note', { pin: n, text: text });
  }

  function light(r, pin, on) {
    if (!pin) return;
    qa(r, '[data-pin="' + pin + '"]').forEach(function (n) {
      if (n.getAttribute('data-state') === 'draft') return;
      n.classList.toggle('is-active', on);
      var m = n.classList.contains('ui-qg-row') ? q(n, '.ui-qg-mark--note') : null; if (m) m.classList.toggle('is-active', on);
    });
  }

  function openSheet(r, open) {
    var s = q(r, '.ui-qg-sheet'), h = q(r, '.ui-qg-handle'); if (!s) return;
    var full = open == null ? s.getAttribute('data-snap') !== 'full' : open;
    s.setAttribute('data-snap', full ? 'full' : 'peek');
    // open, the sheet stops under the bar, so the creative's name and the arrows stay in view
    var bar = q(r, '.ui-qg-bar'), scr = screen(r);
    if (full && bar && scr) s.style.setProperty('--qg-top', Math.round(bar.getBoundingClientRect().bottom - scr.getBoundingClientRect().top) + 'px');
    if (h) { h.setAttribute('aria-expanded', String(full)); h.setAttribute('aria-label', full ? 'Show less' : 'Show the whole checklist'); }
  }

  document.addEventListener('click', function (e) {
    var r = rootOf(e.target); if (!r) return;
    var a = e.target.closest('[data-qg-action]');
    if (a && r.contains(a)) {
      var act = a.getAttribute('data-qg-action');
      if (act === 'approve') approve(r);
      else if (act === 'changes') changes(r);
      else if (act === 'undo') undo(r);
      else if (act === 'next') go(r, 1);
      else if (act === 'prev') go(r, -1);
      else if (act === 'note') addNote(r);
      return;
    }
    if (e.target.closest('.ui-qg-handle')) { openSheet(r); return; }
    if (e.target.closest('.ui-qg-format .ui-seg-option')) { syncFormat(r); return; }
    var pin = e.target.closest('.ui-qg-pin');
    if (pin) {
      if (pin.getAttribute('data-state') === 'draft') { focus(q(r, '.ui-qg-compose .ui-input')); return; }
      var row = q(r, '.ui-qg-row[data-pin="' + pin.getAttribute('data-pin') + '"]');
      openSheet(r, true);
      if (row) { focus(row); light(r, pin.getAttribute('data-pin'), true); }
      return;
    }
    var media = e.target.closest('.ui-qg-media');
    if (media && stateOf(r) === 'waiting') {
      var b = media.getBoundingClientRect();
      var x = Math.max(4, Math.min(92, (e.clientX - b.left) / b.width * 100)), y = Math.max(10, Math.min(98, (e.clientY - b.top) / b.height * 100));
      placeDraft(r, media, x, y);
    }
  });

  document.addEventListener('keydown', function (e) {
    var r = rootOf(e.target); if (!r || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target;
    if (t.closest('.ui-qg-format')) { if (/^Arrow|^Home$|^End$/.test(e.key)) setTimeout(function () { syncFormat(r); }, 0); return; }
    if (t.closest('input, textarea, select, [contenteditable="true"]')) {
      if (t.closest('.ui-qg-compose') && e.key === 'Enter') { e.preventDefault(); addNote(r); }
      else if (t.closest('.ui-qg-compose') && e.key === 'Escape' && q(r, '.ui-qg-pin[data-state="draft"]')) { e.preventDefault(); dropDraft(r); }
      return;
    }
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === 'c') { e.preventDefault(); approve(r); } // C: mark checked
    else if (k === 'r') { e.preventDefault(); changes(r); }
    else if (k === 'ArrowRight') { e.preventDefault(); go(r, 1); }
    else if (k === 'ArrowLeft') { e.preventDefault(); go(r, -1); }
    else if (k === 'Escape' && q(r, '.ui-qg-pin[data-state="draft"]')) { e.preventDefault(); dropDraft(r); }
  });

  // a pin and its note light up together
  ['pointerover', 'focusin'].forEach(function (type) {
    document.addEventListener(type, function (e) {
      var n = e.target.closest && e.target.closest('[data-ui-qg] [data-pin]'); if (!n) return;
      light(rootOf(n), n.getAttribute('data-pin'), true);
    });
  });
  ['pointerout', 'focusout'].forEach(function (type) {
    document.addEventListener(type, function (e) {
      var n = e.target.closest && e.target.closest('[data-ui-qg] [data-pin]'); if (!n) return;
      var to = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('[data-pin]');
      if (to && to.getAttribute('data-pin') === n.getAttribute('data-pin')) return;
      light(rootOf(n), n.getAttribute('data-pin'), false);
    });
  });

  window.fumeQG = { approve: approve, changes: changes, undo: undo, go: go, set: set, open: openSheet };
})();
