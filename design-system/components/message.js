// Messages: the scroller, copy, and text that arrives word by word. DECIDED 13 Oct, from round 8. Same parts and
// states as shadcn's message-scroller (data-direction="end", data-active="true|false" on the button).
// Markup:
//   <div class="ui-message-scroller" data-ui-message-scroller data-fit="half">
//     <div class="ui-message-scroller-viewport" tabindex="0" role="region" aria-label="Conversation">
//       <div class="ui-message-scroller-content"> messages and markers </div></div>
//     <div class="ui-message-scroller-button ui-glass ui-glass--small ui-glass--bar" data-direction="end" data-active="false">
//       <button class="ui-btn ui-btn--glass-clear ui-btn--sm" type="button"><svg><use href="#fi-arrow-down"/></svg>
//         <span data-ui-message-unread>Jump to latest</span></button></div>
//     <div class="ui-message-scroller-announce" role="status" aria-live="polite"></div>
//   </div>
// A scroller starts at the end and stays there while you are there: whatever grows at the end (a new
// message, words arriving, a run card filling with creatives) keeps the end in view. Scrolled up, it
// leaves you where you are; the pill comes in and counts the messages that arrived meanwhile; pressing
// it goes back to the end and puts focus on the conversation. New messages are read out once each
// through the live region, never word by word. data-fit="half" sizes the viewport once (and again
// after a resize, if you are at the end) so the message cut at the top shows about half.
// window.fumeMessage(root)                   sets up scrollers under root; safe to call more than once.
// fumeMessage.add(scroller, node, text, {follow})  adds a message: follows it when you were at the end
//                                            (or always, with follow: true, for your own message),
//                                            otherwise counts it on the pill; text is read out.
// fumeMessage.stream(target, text, {delay})  writes text into target word by word with the quiet caret
//                                            (data-state="streaming", aria-busy); resolves when done.
//                                            Set target.dataset.stop = "true" to end it early. With
//                                            reduced motion the text arrives at once.
// fumeMessage.announce(scroller, text)       reads text out through the scroller's live region.
// A button with data-ui-message-copy copies its message's words and shows a check for a moment.
(() => {
  if (window.fumeMessage) return;
  const reduce = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const hit = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ui-size-hit")) || 44;
  const parts = (s) => ({
    vp: s.querySelector(".ui-message-scroller-viewport"),
    content: s.querySelector(".ui-message-scroller-content"),
    pill: s.querySelector(".ui-message-scroller-button"),
    live: s.querySelector(".ui-message-scroller-announce"),
  });
  const atEnd = (vp) => vp.scrollHeight - vp.scrollTop - vp.clientHeight <= hit();
  const toEnd = (vp, smooth) => vp.scrollTo({ top: vp.scrollHeight, behavior: smooth && !reduce() ? "smooth" : "auto" });

  function announce(s, text) {
    const { live } = parts(s);
    if (!live || !text) return;
    live.textContent = "";
    setTimeout(() => { live.textContent = text; }, 60);
  }

  function label(s) {
    const { pill } = parts(s);
    if (!pill) return;
    const t = pill.querySelector("[data-ui-message-unread]"), b = pill.querySelector("button");
    if (t && !t.hasAttribute("data-label")) t.setAttribute("data-label", t.textContent.trim());
    const n = s._unread || 0;
    const words = n ? (n === 1 ? "1 new message" : n + " new messages") : (t ? t.getAttribute("data-label") : "Jump to latest");
    if (t) t.textContent = words;
    if (b) b.setAttribute("aria-label", n ? words + ", jump to latest" : "Jump to latest");
  }

  // s._stick: you are at the end, so growth keeps the end in view. s._following: a smooth scroll to the
  // end is on its way, so the scroll events it fires on the way do not count as scrolling up.
  function sync(s) {
    const { vp, pill } = parts(s);
    if (!vp) return;
    const end = atEnd(vp);
    if (s._following) { if (end) s._following = false; else return; }
    s._stick = end;
    if (end && s._unread) { s._unread = 0; label(s); }
    if (pill) pill.setAttribute("data-active", String(!end));
  }
  function goEnd(s, smooth) {
    const { vp } = parts(s);
    if (!vp) return;
    s._stick = true;
    if (smooth && !reduce()) {
      s._following = true;
      clearTimeout(s._followTimer);
      s._followTimer = setTimeout(() => { s._following = false; sync(s); }, 1200);
    }
    toEnd(vp, smooth);
  }

  // once, not in a loop: the message cut at the top of the viewport shows about half
  function fit(s) {
    if (s.getAttribute("data-fit") !== "half") return;
    const { vp } = parts(s);
    if (!vp || !vp.clientHeight) return;
    s.style.height = "";
    toEnd(vp);
    if (vp.scrollHeight <= vp.clientHeight + 1) return;
    const top = vp.getBoundingClientRect().top;
    const items = Array.from(s.querySelectorAll(".ui-message-scroller-content .ui-message, .ui-message-scroller-content .ui-marker"));
    // the message the top edge cuts through; when the edge falls between two, the one just above it
    let cut = items.find((el) => { const r = el.getBoundingClientRect(); return r.top < top - 1 && r.bottom > top + 1; });
    if (!cut) cut = items.filter((el) => el.getBoundingClientRect().bottom <= top + 1).pop();
    if (!cut) return;
    const r = cut.getBoundingClientRect(), h = s.offsetHeight;
    const delta = Math.max(-h * 0.35, Math.min(h * 0.35, top - (r.top + r.height / 2)));
    if (Math.abs(delta) < 2) return;
    s.style.height = Math.round(h + delta) + "px";
    toEnd(vp);
    sync(s);
  }

  function setup(s) {
    if (s._fumeMessage) return;
    const { vp, pill } = parts(s);
    if (!vp) return;
    s._fumeMessage = true;
    let frame = 0;
    vp.addEventListener("scroll", () => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; sync(s); });
    }, { passive: true });
    const b = pill && pill.querySelector("button");
    if (b) b.addEventListener("click", () => {
      goEnd(s, true);
      s._unread = 0; label(s);
      vp.focus({ preventScroll: true });
    });
    label(s);
    toEnd(vp);
    s._stick = true;
    sync(s);
    fit(s);
    // growth at the end (and a viewport that changes size) keeps the end in view while you are there
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => { if (s._following) toEnd(vp, true); else if (s._stick) toEnd(vp); });
      const { content } = parts(s);
      if (content) ro.observe(content);
      ro.observe(vp);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (atEnd(vp)) { fit(s); toEnd(vp); sync(s); } });
  }

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      document.querySelectorAll("[data-ui-message-scroller][data-fit=\"half\"]").forEach((s) => { const { vp } = parts(s); if (vp && atEnd(vp)) fit(s); });
    }, 200);
  });

  // copy a message's words; the icon turns into a check for a moment
  document.addEventListener("click", (e) => {
    const b = e.target instanceof Element && e.target.closest("[data-ui-message-copy]");
    if (!b) return;
    const m = b.closest(".ui-message");
    const src = m && m.querySelector(".ui-message-text, .ui-bubble-content");
    const text = src ? src.innerText.trim() : "";
    const use = b.querySelector("use");
    if (use && !b.dataset.icon) b.dataset.icon = use.getAttribute("href");
    if (!b.dataset.label) b.dataset.label = b.getAttribute("aria-label") || "Copy";
    const done = () => {
      if (use) use.setAttribute("href", "#fi-check");
      b.setAttribute("aria-label", "Copied");
      b.setAttribute("data-state", "copied");
      const s = b.closest(".ui-message-scroller");
      if (s) announce(s, "Copied");
      clearTimeout(b._fumeCopy);
      b._fumeCopy = setTimeout(() => {
        if (use) use.setAttribute("href", b.dataset.icon);
        b.setAttribute("aria-label", b.dataset.label);
        b.removeAttribute("data-state");
      }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, done);
    else done();
  });

  function stream(target, text, opts) {
    const o = opts || {};
    return new Promise((resolve) => {
      const msg = target.closest(".ui-message");
      const s = target.closest(".ui-message-scroller");
      const vp = s && parts(s).vp;
      const keep = () => { if (vp && s._stick && !s._following) toEnd(vp); };
      const node = document.createTextNode("");
      const caret = document.createElement("span");
      caret.className = "ui-message-caret";
      caret.setAttribute("aria-hidden", "true");
      target.appendChild(node);
      target.appendChild(caret);
      delete target.dataset.stop;
      if (msg) { msg.setAttribute("data-state", "streaming"); msg.setAttribute("aria-busy", "true"); }
      const finish = () => {
        caret.remove();
        if (msg) { msg.removeAttribute("data-state"); msg.removeAttribute("aria-busy"); }
        resolve();
      };
      const words = String(text).split(/(\s+)/);
      if (reduce()) { node.data = text; keep(); finish(); return; }
      let i = 0;
      const tick = () => {
        if (target.dataset.stop === "true" || !target.isConnected) { finish(); return; }
        node.data += (words[i++] || "") + (words[i] && /^\s+$/.test(words[i]) ? words[i++] : "");
        keep();
        if (i < words.length) setTimeout(tick, o.delay || 55); else finish();
      };
      tick();
    });
  }

  function add(s, node, text, opts) {
    const { vp, content, pill } = parts(s);
    if (!vp || !content) return;
    const end = s._following || atEnd(vp);
    content.appendChild(node);
    if (end) { toEnd(vp); s._stick = true; }
    else if (opts && opts.follow) goEnd(s, true);
    else { s._unread = (s._unread || 0) + 1; label(s); if (pill) pill.setAttribute("data-active", "true"); }
    if (text) announce(s, text);
  }

  const fumeMessage = function fumeMessage(root) {
    const r = root || document;
    const list = Array.from(r.querySelectorAll("[data-ui-message-scroller]"));
    if (r.matches && r.matches("[data-ui-message-scroller]")) list.push(r);
    list.forEach(setup);
  };
  fumeMessage.add = add;
  fumeMessage.stream = stream;
  fumeMessage.announce = announce;
  fumeMessage.fit = fit;
  fumeMessage.sync = sync; // call after moving a scroller's viewport yourself
  window.fumeMessage = fumeMessage;
  if (document.readyState !== "loading") fumeMessage(); else document.addEventListener("DOMContentLoaded", () => fumeMessage());
})();
