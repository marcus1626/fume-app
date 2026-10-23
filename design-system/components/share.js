// Share: invite by email, roles, remove, the link switch and Copy link. DECIDED 13 Oct, from round 8. CSS: share.css.
// The dialog opens and closes with dialog.js (data-ui-dialog-open="share-…"): focus trap, Escape, scrim,
// focus back to the trigger. Markup (the whole of it in review/sections/90-patterns.html):
//   <div class="ui-glass ui-dialog ui-share" id="share-autumn" role="dialog" data-link="on"
//        data-share-url="fumecreatives.com/s/lysne-autumn-launch" hidden>
//     <form class="ui-share-invite" data-share-invite> <input data-share-email> <div class="ui-select" data-ui-select>…
//       <button type="submit">Invite</button> <p class="ui-field-error" data-share-error hidden><svg/><span></span></p></form>
//     <ul class="ui-share-list"> <li class="ui-share-person" data-name="Kristian" data-email="kristian@lysne.no">…
//       <button data-share-action="remove" aria-label="Remove Kristian">…</button></li></ul>
//     <button class="ui-switch ui-switch--glass" role="switch" data-share-link-switch>  <p data-share-link-hint data-on="…" data-off="…">
//     <button class="ui-share-copy" data-share-action="copy"><svg><use href="#fi-link"/></svg>…</button>
//     <p class="ui-share-live" aria-live="polite"></p></div>
// Invite checks the address (it says what is wrong, in words, under the field), adds the person under you
// with the role chosen and sends a toast. Remove takes the row out with Undo in a toast. Copy link says
// Copied for --ui-share-copied. Events on the .ui-share root: "ui:share-invite" { email, role },
// "ui:share-remove" { name }, "ui:share-link" { on }, "ui:share-copy" { url }.
// A role select inside a modal dialog: its listbox moves to <body> while open (select.js), outside the
// dialog's focus trap, so this file keeps focus in the listbox and lets Escape close the listbox first.
// window.fumeShare = { invite(root), remove(button), copy(root), init(root) }. Safe to load twice.
(function () {
  if (window.fumeShare) return;
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function q(r, s) { return r.querySelector(s); }
  function qa(r, s) { return Array.prototype.slice.call(r.querySelectorAll(s)); }
  function ms(name, fb) { var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); if (!v) return fb; var x = parseFloat(v); return /ms$/.test(v) ? x : /s$/.test(v) ? x * 1000 : x; }
  function fire(r, name, detail) { r.dispatchEvent(new CustomEvent(name, { bubbles: true, detail: detail })); }
  function toast(o) { if (window.fumeToast) return window.fumeToast(o); }
  function say(r, text) { var l = q(r, '.ui-share-live'); if (!l) return; l.textContent = ''; setTimeout(function () { l.textContent = text; }, 40); }
  function rootOf(n) { return n && n.closest ? n.closest('.ui-share') : null; }
  function count(r) {
    var n = qa(r, '.ui-share-person:not(.is-leaving)').length, c = q(r, '.ui-share-count');
    if (c) c.textContent = n + (n === 1 ? ' person' : ' people');
  }
  function useIcon(btn, name) { var u = btn.querySelector('svg use'); if (u) u.setAttribute('href', '#fi-' + name); }

  // the role select's listbox leaves the dialog while it is open: keep the dialog's trap off it
  function guard(sel) {
    var list = sel.querySelector('.ui-select-content');
    if (!list || list._shareSel) return;
    list._shareSel = sel;
    list.addEventListener('focusin', function (e) { e.stopPropagation(); });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' && e.key !== 'Tab') return;
    var list = e.target.closest && e.target.closest('.ui-select-content');
    if (!list || !list._shareSel || !window.fumeSelect) return;
    e.preventDefault(); e.stopPropagation();
    window.fumeSelect.close(list._shareSel);
    var t = list._shareSel.querySelector('.ui-select-trigger'); if (t) t.focus();
  }, true);

  function chosenRole(sel) {
    var o = sel && (sel.querySelector('[role="option"][aria-selected="true"]') || sel.querySelector('[role="option"]'));
    return o ? { value: o.getAttribute('data-value'), label: (o.querySelector('.ui-select-item-text') || o).textContent.trim() } : { value: 'viewer', label: 'Viewer' };
  }
  // a person's role select: a copy of the invite row's, set to their role
  function roleSelect(r, value, who) {
    var src = q(r, '.ui-share-invite [data-ui-select]'); if (!src) return null;
    var sel = src.cloneNode(true);
    var list = (src.querySelector('.ui-select-content') || document.querySelector('#' + (q(src, '.ui-select-trigger').getAttribute('aria-controls') || 'none')));
    if (!sel.querySelector('.ui-select-content') && list) sel.appendChild(list.cloneNode(true)); // the invite's listbox was open in <body>
    sel.removeAttribute('data-ui-ready'); sel.removeAttribute('data-name');
    qa(sel, 'input[type="hidden"]').forEach(function (h) { h.remove(); });
    qa(sel, '[id]').forEach(function (n) { n.removeAttribute('id'); });
    var c = sel.querySelector('.ui-select-content'); if (c) { c.hidden = true; c.removeAttribute('data-state'); c.removeAttribute('style'); c.removeAttribute('aria-labelledby'); c.setAttribute('aria-label', 'Role for ' + who); }
    var t = sel.querySelector('.ui-select-trigger');
    t.removeAttribute('aria-labelledby'); t.removeAttribute('aria-controls'); t.setAttribute('aria-label', 'Role for ' + who);
    qa(sel, '[role="option"]').forEach(function (o) {
      var on = o.getAttribute('data-value') === value;
      o.setAttribute('aria-selected', String(on)); o.setAttribute('data-state', on ? 'checked' : 'unchecked'); o.removeAttribute('data-highlighted');
      if (on) { var v = sel.querySelector('.ui-select-value'); if (v) v.textContent = (o.querySelector('.ui-select-item-text') || o).textContent.trim(); }
    });
    return sel;
  }

  function error(r, text) {
    var input = q(r, '[data-share-email]'), err = q(r, '[data-share-error]');
    if (input) { if (text) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid'); }
    if (err) { err.hidden = !text; var s = err.querySelector('span') || err; if (text) s.textContent = text; }
  }

  function invite(r) {
    var input = q(r, '[data-share-email]'); if (!input) return;
    var v = input.value.trim(), low = v.toLowerCase();
    if (!v) { error(r, 'Write the email of the person you want to invite.'); input.focus(); return; }
    if (!EMAIL.test(v)) { error(r, 'That is not an email address yet. Check the part after the @.'); input.focus(); return; }
    if (qa(r, '.ui-share-person').some(function (p) { return (p.getAttribute('data-email') || '').toLowerCase() === low; })) {
      error(r, v + ' already has access.'); input.focus(); return;
    }
    error(r, null);
    var role = chosenRole(q(r, '.ui-share-invite [data-ui-select]'));
    var local = low.split('@')[0].replace(/[._-]+/g, ' ').trim();
    var li = document.createElement('li');
    li.className = 'ui-share-person is-new';
    li.setAttribute('data-name', v); li.setAttribute('data-email', low);
    li.innerHTML = '<span class="ui-avatar" aria-hidden="true"></span><span class="ui-share-who"><span class="ui-share-name"></span><span class="ui-share-mail">Invited, not opened yet</span></span>';
    q(li, '.ui-avatar').textContent = (local[0] || '?').toUpperCase() + ((local.split(' ')[1] || '')[0] || '').toUpperCase();
    q(li, '.ui-share-name').textContent = v;
    var sel = roleSelect(r, role.value, v); if (sel) li.appendChild(sel);
    var rm = document.createElement('button');
    rm.type = 'button'; rm.className = 'ui-btn ui-btn--glass-clear ui-btn--icon ui-btn--sm';
    rm.setAttribute('data-share-action', 'remove'); rm.setAttribute('aria-label', 'Remove ' + v);
    rm.innerHTML = '<svg class="ico" aria-hidden="true"><use href="#fi-x"/></svg>';
    li.appendChild(rm);
    var list = q(r, '.ui-share-list'), owner = q(r, '.ui-share-person[data-owner]');
    list.insertBefore(li, owner ? owner.nextSibling : list.firstChild);
    if (sel && window.fumeSelect) { window.fumeSelect(li); guard(sel); }
    setTimeout(function () { li.classList.remove('is-new'); }, ms('--ui-motion-base', 240) + 40);
    list.scrollTop = 0;
    count(r);
    input.value = '';
    input.focus();
    toast({ type: 'done', title: 'Invite sent to ' + v, meta: role.label });
    fire(r, 'ui:share-invite', { email: v, role: role.value });
  }

  function remove(btn) {
    var r = rootOf(btn), row = btn.closest('.ui-share-person'); if (!r || !row || row.classList.contains('is-leaving')) return;
    var name = row.getAttribute('data-name') || 'They', list = row.parentNode, next = row.nextElementSibling;
    var land = (next && next.querySelector('[data-share-action="remove"]')) || (row.previousElementSibling && row.previousElementSibling.querySelector('[data-share-action="remove"]')) || q(r, '[data-share-email]');
    row.classList.add('is-leaving');
    count(r);
    if (land) land.focus();
    setTimeout(function () { if (row.classList.contains('is-leaving')) row.remove(); }, ms('--ui-motion-base', 240));
    toast({ type: 'info', title: name + ' no longer has access', action: { label: 'Undo', onClick: function () {
      row.classList.remove('is-leaving'); row.classList.add('is-new');
      list.insertBefore(row, next && next.parentNode === list ? next : null);
      setTimeout(function () { row.classList.remove('is-new'); }, ms('--ui-motion-base', 240) + 40);
      count(r);
    } } });
    fire(r, 'ui:share-remove', { name: name });
  }

  function copy(r) {
    var btn = q(r, '[data-share-action="copy"]'), url = r.getAttribute('data-share-url') || location.href;
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText('https://' + url.replace(/^https?:\/\//, '')).catch(function () {}); } catch (e) {}
    if (btn) {
      btn.setAttribute('data-state', 'copied'); useIcon(btn, 'check');
      clearTimeout(btn._shareT);
      btn._shareT = setTimeout(function () { btn.removeAttribute('data-state'); useIcon(btn, 'link'); }, ms('--ui-share-copied', 2000));
    }
    say(r, 'Link copied');
    fire(r, 'ui:share-copy', { url: url });
  }

  function link(r, on) {
    r.setAttribute('data-link', on ? 'on' : 'off');
    var h = q(r, '[data-share-link-hint]');
    if (h) h.textContent = h.getAttribute(on ? 'data-on' : 'data-off') || h.textContent;
    fire(r, 'ui:share-link', { on: on });
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-share-action]'); if (!a) return;
    var r = rootOf(a); if (!r) return;
    var act = a.getAttribute('data-share-action');
    if (act === 'remove') remove(a);
    else if (act === 'copy') copy(r);
  });
  document.addEventListener('submit', function (e) {
    var f = e.target.closest && e.target.closest('[data-share-invite]'); if (!f) return;
    e.preventDefault(); invite(rootOf(f));
  });
  document.addEventListener('input', function (e) {
    if (e.target.matches && e.target.matches('[data-share-email]') && e.target.getAttribute('aria-invalid') === 'true') error(rootOf(e.target), null);
  });
  document.addEventListener('ui-checkedchange', function (e) {
    var s = e.target.closest && e.target.closest('[data-share-link-switch]'); if (!s) return;
    var r = rootOf(s); if (r) link(r, !!(e.detail && e.detail.checked));
  });
  document.addEventListener('change', function (e) {
    var sel = e.target.closest && e.target.closest('.ui-share-person [data-ui-select]'); if (!sel) return;
    var row = sel.closest('.ui-share-person'), r = rootOf(sel);
    if (r && row && e.detail) say(r, (row.getAttribute('data-name') || 'They') + ': ' + e.detail.label);
  });

  function init(scope) {
    qa(scope || document, '.ui-share').forEach(function (r) {
      if (window.fumeSelect) window.fumeSelect(r);
      qa(r, '[data-ui-select]').forEach(guard);
      count(r);
    });
  }
  if (document.readyState !== 'loading') init(); else document.addEventListener('DOMContentLoaded', function () { init(); });

  window.fumeShare = { invite: invite, remove: remove, copy: function (r) { copy(rootOf(r) || r); }, init: init };
})();
