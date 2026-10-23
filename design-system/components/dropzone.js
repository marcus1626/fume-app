// Upload box (dropzone): drop, press or tap to add creatives; previews, progress, errors in words. DECIDED 13 Oct, from round 8.
// Declarative and delegated from the document, so upload boxes added later work without setup. Safe to load
// more than once. Markup (see dropzone.css for the parts):
//   <div class="ui-dropzone" data-ui-dropzone data-max="200 MB" data-target="Autumn launch" data-simulate>
//     <ul class="ui-dropzone-grid" aria-label="Added creatives"></ul>        tiles once a creative is in (optional)
//     <ul class="ui-dropzone-list" aria-label="Uploads"></ul>                rows while uploading, or with an error
//     <button class="ui-dropzone-area" type="button" aria-labelledby="t" aria-describedby="m">…</button>
//     <input class="ui-dropzone-input" type="file" multiple accept="image/jpeg,image/png,video/mp4" hidden>
//     <div class="ui-dropzone-overlay" aria-hidden="true">…Drop to add to Autumn launch…</div>
//   </div>
//   Any element with data-ui-dropzone-choose inside opens the picker too (an "Add more" button, a link on a
//   panel). A panel that takes drops anywhere: class="ui-dropzone-panel" data-ui-dropzone, with a list inside.
// What it does: checks each creative against accept (types) and data-max (size) and says why in words when one
// cannot be added; reads image previews with FileReader (a video shows its first frame); shows a row with
// progress while a creative uploads, then a tile in the grid (or the row, done, when there is no grid);
// cancel, retry and remove per creative; announces the result in a live region ("3 creatives added to Autumn
// launch"); data-filled on the zone once it holds creatives, data-drag while creatives are over it.
// Uploading: the zone fires "ui:dropzone-upload" ({ item, file }) for each creative; the app uploads it and
// calls fumeDropzone.progress(item, 0–100), .done(item) or .fail(item, "words"). data-simulate fakes it with a
// short timer that always ends (for the review board). "ui:dropzone-change" ({ count, size }) fires whenever
// the creatives in a zone change. window.fumeDropzone(root) sets up zones under root (labels, live regions).
(function () {
  if (typeof window === "undefined" || window.fumeDropzone) return;
  var ZONE = "[data-ui-dropzone]";
  var drags = new WeakMap(); // zone -> nested dragenter count
  var state = new WeakMap(); // row or tile -> item
  var uid = 0;

  function zoneOf(n) { return n && n.closest ? n.closest(ZONE) : null; }
  function own(zone, sel) { return Array.prototype.filter.call(zone.querySelectorAll(sel), function (n) { return zoneOf(n) === zone; })[0] || null; }
  function disabled(zone) { var a = own(zone, ".ui-dropzone-area"); return zone.hasAttribute("data-disabled") || !!(a && a.disabled); }
  function icon(name) { return '<svg class="ico" aria-hidden="true"><use href="#fi-' + name + '"/></svg>'; }
  // a size: one decimal under 100, whole from 100 up ("19.2 MB", "148 MB"); number and unit never part at a line end
  var NB = "\u00a0";
  function num(v) { return v >= 100 ? String(Math.round(v)) : v.toFixed(1); }
  function size(b) { return b >= 1e9 ? num(b / 1e9) + NB + "GB" : b >= 1e6 ? num(b / 1e6) + NB + "MB" : Math.max(1, Math.round(b / 1e3)) + NB + "KB"; }
  function part(a, b) { var u = b >= 1e9 ? 1e9 : b >= 1e6 ? 1e6 : 1e3; return (u === 1e3 ? String(Math.round(a / u)) : num(a / u)) + " / " + size(b); }
  function bytes(s) { var m = /([\d.]+)\s*(KB|MB|GB)?/i.exec(String(s || "")); if (!m) return 0; var u = (m[2] || "MB").toUpperCase(); return parseFloat(m[1]) * (u === "GB" ? 1e9 : u === "KB" ? 1e3 : 1e6); }
  function ext(name) { var m = /\.([a-z0-9]+)$/i.exec(name || ""); return m ? m[1].toUpperCase() : ""; }
  function plural(n) { return n + (n === 1 ? " creative" : " creatives"); }

  function config(zone) {
    var input = own(zone, ".ui-dropzone-input");
    var accept = ((input && input.accept) || zone.getAttribute("data-accept") || "").split(",").map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
    var names = accept.map(function (a) { a = a.replace(/^\./, "").replace(/^.*\//, ""); return a === "jpeg" ? "JPG" : a === "*" ? "" : a.toUpperCase(); }).filter(function (a, i, all) { return a && all.indexOf(a) === i; });
    return {
      input: input, accept: accept, max: bytes(zone.getAttribute("data-max")), target: zone.getAttribute("data-target") || "",
      limit: (zone.getAttribute("data-max") || "").trim().replace(/\s+/g, NB), // as written: "200 MB", not "200.0 MB"
      types: names.length > 1 ? names.slice(0, -1).join(", ") + " or " + names[names.length - 1] : names[0] || "",
    };
  }
  function allowed(file, c) {
    if (!c.accept.length) return true;
    var type = (file.type || "").toLowerCase(), name = (file.name || "").toLowerCase();
    return c.accept.some(function (a) {
      if (a.charAt(0) === ".") return name.slice(-a.length) === a || (a === ".jpg" && /\.jpeg$/.test(name));
      if (/\/\*$/.test(a)) return type.indexOf(a.slice(0, -1)) === 0;
      return type === a;
    });
  }
  function check(file, c) {
    if (!allowed(file, c)) return (ext(file.name) || "This type") + " is not supported here. Use " + c.types + ".";
    if (c.max && file.size > c.max) return "Too big at " + size(file.size) + ". Up to " + (c.limit || size(c.max)) + ".";
    return "";
  }

  // ---------- parts ----------
  function status(zone) {
    var s = own(zone, ".ui-dropzone-status");
    if (!s) { s = document.createElement("p"); s.className = "ui-dropzone-status"; s.setAttribute("role", "status"); s.setAttribute("aria-live", "polite"); zone.appendChild(s); }
    return s;
  }
  function say(zone, text) {
    var s = status(zone); s.textContent = "";
    setTimeout(function () { s.textContent = text; }, 60); // a fresh node change, so the same words are read twice
  }
  function list(zone) {
    var l = own(zone, ".ui-dropzone-list");
    if (!l) {
      l = document.createElement("ul"); l.className = "ui-dropzone-list"; l.setAttribute("aria-label", "Uploads");
      var area = own(zone, ".ui-dropzone-area"); zone.insertBefore(l, area || null);
    }
    return l;
  }
  function setup(zone) {
    var area = own(zone, ".ui-dropzone-area"), meta = area && area.querySelector(".ui-dropzone-meta");
    if (meta && !area.hasAttribute("aria-describedby")) { if (!meta.id) meta.id = "ui-dropzone-meta-" + ++uid; area.setAttribute("aria-describedby", meta.id); }
    status(zone);
    // creatives already in the markup (a saved draft) can be removed like new ones
    items(zone).forEach(function (el) {
      if (state.has(el)) return;
      var name = el.querySelector(".ui-dropzone-name, .ui-creative-format"), sz = el.querySelector(".ui-dropzone-size");
      state.set(el, { el: el, zone: zone, name: name ? name.textContent.trim() : "Creative", size: bytes(el.getAttribute("data-size") || (sz && sz.textContent)), state: el.getAttribute("data-state") || "done", progress: 100, settled: true });
    });
    sync(zone, true);
  }
  function items(zone) {
    return Array.prototype.filter.call(zone.querySelectorAll(".ui-dropzone-row, .ui-dropzone-tile"), function (n) { return zoneOf(n) === zone; });
  }
  function sync(zone, quiet) {
    var all = items(zone), count = 0, total = 0;
    all.forEach(function (n) {
      var it = state.get(n), st = it ? it.state : n.getAttribute("data-state") || "done";
      if (st !== "error") { count++; total += it ? it.size : 0; }
    });
    zone.toggleAttribute("data-filled", all.length > 0);
    if (!quiet) zone.dispatchEvent(new CustomEvent("ui:dropzone-change", { bubbles: true, detail: { count: count, size: total } }));
  }

  // ---------- one creative ----------
  function media(it, el) {
    var m = el.querySelector(".ui-item-media, .ui-creative-media");
    if (!m) return;
    m.textContent = "";
    if (it.src && it.kind === "video") { var v = document.createElement("video"); v.muted = true; v.playsInline = true; v.preload = "metadata"; v.src = it.src + "#t=0.1"; v.setAttribute("aria-hidden", "true"); m.appendChild(v); }
    else if (it.src) { var img = document.createElement("img"); img.alt = ""; img.src = it.src; m.appendChild(img); }
    else m.innerHTML = icon(it.kind === "video" ? "play" : "image");
  }
  function button(kind, it, glass) {
    var b = document.createElement("button");
    var labels = { cancel: "Cancel " + it.name, retry: "Try " + it.name + " again", remove: "Remove " + it.name };
    b.type = "button";
    b.className = "ui-btn ui-btn--icon ui-btn--sm " + (glass ? "ui-btn--glass-clear" : "ui-btn--quiet");
    b.setAttribute("data-ui-dropzone-" + kind, "");
    b.setAttribute("aria-label", labels[kind]);
    b.innerHTML = icon(kind === "retry" ? "rotate-ccw" : "x");
    return b;
  }
  function row(it) {
    var li = document.createElement("li");
    li.className = "ui-item ui-item--sm ui-dropzone-row";
    li.innerHTML = '<span class="ui-item-media ui-item-media--creative"></span>' +
      '<div class="ui-item-content"><div class="ui-dropzone-row-head"><span class="ui-dropzone-name"></span><span class="ui-dropzone-size"></span></div>' +
      '<div class="ui-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" data-state="loading"><span class="ui-progress-indicator"></span></div>' +
      '<p class="ui-field-error" hidden>' + icon("circle-alert") + '<span></span></p></div>' +
      '<div class="ui-item-actions"></div>';
    li.querySelector(".ui-dropzone-name").textContent = it.name;
    li.querySelector(".ui-progress").setAttribute("aria-label", "Uploading " + it.name);
    state.set(li, it); it.el = li;
    media(it, li); paint(it);
    return li;
  }
  function tile(it) {
    var li = document.createElement("li");
    li.className = "ui-creative ui-dropzone-tile";
    li.innerHTML = '<div class="ui-creative-frame"><div class="ui-creative-media"></div><span class="ui-creative-actions ui-glass ui-glass--small"></span></div>' +
      '<div class="ui-creative-caption"><span class="ui-creative-format"></span><span class="ui-dropzone-size"></span></div>';
    li.querySelector(".ui-creative-format").textContent = it.name;
    li.querySelector(".ui-dropzone-size").textContent = size(it.size);
    li.querySelector(".ui-creative-actions").appendChild(button("remove", it, true));
    state.set(li, it); it.el = li;
    media(it, li);
    return li;
  }
  // a row shows what the creative is doing now
  function paint(it) {
    var li = it.el; if (!li || !li.classList.contains("ui-dropzone-row")) return;
    var err = li.querySelector(".ui-field-error"), bar = li.querySelector(".ui-progress"), acts = li.querySelector(".ui-item-actions");
    li.setAttribute("data-state", it.state);
    li.querySelector(".ui-dropzone-size").textContent = it.state === "uploading" ? part(it.size * it.progress / 100, it.size) : size(it.size);
    err.hidden = it.state !== "error";
    if (it.state === "error") { err.lastChild.textContent = it.error; }
    bar.style.setProperty("--value", String(it.progress));
    bar.setAttribute("aria-valuenow", String(it.progress));
    acts.textContent = ""; // quiet circles; on glass dropzone.css turns them Porcelain
    if (it.state === "uploading") acts.appendChild(button("cancel", it, false));
    else { if (it.state === "error" && it.retry) acts.appendChild(button("retry", it, false)); acts.appendChild(button("remove", it, false)); }
  }
  function preview(it) {
    var f = it.file;
    if (it.state === "error" && !it.retry) return; // nothing to show for a creative that cannot be added
    if (/^video\//.test(f.type)) { it.kind = "video"; try { it.src = URL.createObjectURL(f); it.url = true; } catch (e) {} if (it.el) media(it, it.el); return; }
    if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(f.type) || typeof FileReader === "undefined") return;
    var r = new FileReader();
    r.onload = function () { it.src = String(r.result); if (it.el && it.el.isConnected) media(it, it.el); };
    r.readAsDataURL(f);
  }

  // ---------- upload ----------
  function start(it) {
    it.state = "uploading"; it.progress = 0; paint(it);
    it.zone.dispatchEvent(new CustomEvent("ui:dropzone-upload", { bubbles: true, detail: { item: it.el, file: it.file } }));
    if (!it.zone.hasAttribute("data-simulate")) return;
    var total = Math.min(3600, Math.max(1400, 1200 + it.size / 2e4)), t0 = Date.now();
    (function tick() {
      if (it.state !== "uploading") return;
      var p = Math.min(1, (Date.now() - t0) / total);
      progress(it.el, Math.round(100 * (1 - (1 - p) * (1 - p))));
      it.timer = setTimeout(p >= 1 ? function () { done(it.el); } : tick, p >= 1 ? 240 : 320);
    })();
  }
  function progress(el, value) {
    var it = state.get(el); if (!it || it.state !== "uploading") return;
    it.progress = Math.max(0, Math.min(100, Math.round(value))); paint(it);
  }
  function settle(it) {
    var b = it.batch; if (!b || it.settled) return;
    it.settled = true; b.left--;
    if (b.left > 0) return;
    var words = b.added ? plural(b.added) + " added" + (b.target ? " to " + b.target : "") + "." : "";
    if (b.rejected) words += (words ? " " : "") + (b.rejected === 1 ? "1 creative" : b.rejected + " creatives") + " could not be added.";
    if (b.failed) words += (words ? " " : "") + plural(b.failed) + " stopped uploading.";
    if (words) say(it.zone, words);
  }
  function done(el) {
    var it = state.get(el); if (!it || it.state !== "uploading") return;
    clearTimeout(it.timer); it.state = "done"; it.progress = 100;
    var grid = own(it.zone, ".ui-dropzone-grid");
    if (grid) {
      var had = document.activeElement && it.el.contains(document.activeElement);
      var old = it.el, t = tile(it); state.delete(old); old.remove(); grid.appendChild(t);
      if (had) t.querySelector("[data-ui-dropzone-remove]").focus(); // focus stays with the creative
    } else paint(it);
    if (it.batch) it.batch.added++;
    settle(it); sync(it.zone);
    it.zone.dispatchEvent(new CustomEvent("ui:dropzone-done", { bubbles: true, detail: { item: it.el, file: it.file } }));
  }
  function fail(el, words) {
    var it = state.get(el); if (!it || it.state !== "uploading") return;
    clearTimeout(it.timer); it.state = "error"; it.retry = true; it.error = words || "Upload stopped. Check your connection and try again.";
    paint(it);
    if (it.batch) it.batch.failed++;
    settle(it); sync(it.zone);
  }

  // ---------- add, cancel, retry, remove ----------
  function add(zone, files) {
    if (!zone || disabled(zone)) return;
    var c = config(zone), l = list(zone), batch = { left: 0, added: 0, rejected: 0, failed: 0, target: c.target }, made = [];
    Array.prototype.forEach.call(files || [], function (f) {
      var err = check(f, c);
      var it = { file: f, name: f.name || "Untitled creative", size: f.size || 0, zone: zone, batch: batch, progress: 0, state: err ? "error" : "uploading", error: err, kind: /^video\//.test(f.type) ? "video" : "image" };
      if (err) batch.rejected++; else batch.left++;
      l.appendChild(row(it)); made.push(it);
      preview(it);
    });
    if (!made.length) return;
    sync(zone);
    made.forEach(function (it) { if (it.state === "uploading") start(it); });
    if (!batch.left) say(zone, made.length === 1 ? made[0].name + " could not be added. " + made[0].error : batch.rejected + " creatives could not be added. Each row says why.");
    zone.dispatchEvent(new CustomEvent("ui:dropzone-add", { bubbles: true, detail: { items: made.map(function (it) { return it.el; }), files: made.map(function (it) { return it.file; }) } }));
  }
  function focusNear(zone, from) {
    var btns = Array.prototype.filter.call(zone.querySelectorAll("[data-ui-dropzone-cancel], [data-ui-dropzone-remove]"), function (b) { return zoneOf(b) === zone && (!from || !from.contains(b)); });
    var next = null;
    if (from) btns.forEach(function (b) { if (!next && (from.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)) next = b; });
    next = next || btns[btns.length - 1] || own(zone, ".ui-dropzone-area");
    if (next) { try { next.focus({ preventScroll: true }); } catch (e) { next.focus(); } }
  }
  function remove(el, words) {
    var it = state.get(el); if (!it) return;
    var zone = it.zone, had = document.activeElement && el.contains(document.activeElement);
    clearTimeout(it.timer);
    if (it.state === "uploading") { it.state = "cancelled"; settle(it); }
    if (had) focusNear(zone, el);
    if (it.url) { try { URL.revokeObjectURL(it.src); } catch (e) {} }
    state.delete(el); el.remove();
    sync(zone);
    say(zone, words || it.name + " removed.");
  }
  function retry(el) {
    var it = state.get(el); if (!it || it.state !== "error" || !it.retry) return;
    it.batch = { left: 1, added: 0, rejected: 0, failed: 0, target: config(it.zone).target }; it.settled = false;
    start(it);
    var c = it.el.querySelector("[data-ui-dropzone-cancel]"); if (c) c.focus();
  }

  // ---------- events, delegated ----------
  document.addEventListener("click", function (e) {
    var t = e.target instanceof Element ? e.target : null;
    if (!t || t.matches(".ui-dropzone-input")) return;
    var opener = t.closest(".ui-dropzone-area, [data-ui-dropzone-choose]");
    var zone = zoneOf(opener);
    if (opener && zone) {
      if (disabled(zone)) return;
      var input = own(zone, ".ui-dropzone-input"); if (input) input.click();
      return;
    }
    var b = t.closest("[data-ui-dropzone-cancel], [data-ui-dropzone-remove], [data-ui-dropzone-retry]");
    if (!b || !zoneOf(b)) return;
    var el = b.closest(".ui-dropzone-row, .ui-dropzone-tile"), it = el && state.get(el);
    if (!it) return;
    if (b.hasAttribute("data-ui-dropzone-retry")) retry(el);
    else remove(el, b.hasAttribute("data-ui-dropzone-cancel") ? "Upload of " + it.name + " cancelled." : "");
  });
  document.addEventListener("change", function (e) {
    var f = e.target;
    if (!(f instanceof HTMLInputElement) || !f.matches(".ui-dropzone-input")) return;
    if (f.files && f.files.length) add(zoneOf(f), f.files);
    f.value = ""; // the same creative can be chosen again
  });

  function isFiles(e) { var t = e.dataTransfer && e.dataTransfer.types; return !!t && Array.prototype.indexOf.call(t, "Files") >= 0; }
  function clear(zone) { drags.set(zone, 0); zone.removeAttribute("data-drag"); }
  document.addEventListener("dragenter", function (e) {
    if (!isFiles(e)) return;
    var zone = zoneOf(e.target); if (!zone) return;
    e.preventDefault();
    drags.set(zone, (drags.get(zone) || 0) + 1);
    if (!disabled(zone)) zone.setAttribute("data-drag", "");
  });
  document.addEventListener("dragover", function (e) {
    if (!isFiles(e) || e.defaultPrevented || !document.querySelector(ZONE)) return;
    var zone = zoneOf(e.target);
    e.preventDefault(); // a creative dropped beside a zone must not replace the page
    e.dataTransfer.dropEffect = zone && !disabled(zone) ? "copy" : "none";
  });
  document.addEventListener("dragleave", function (e) {
    if (!isFiles(e)) return;
    var zone = zoneOf(e.target); if (!zone) return;
    var n = (drags.get(zone) || 1) - 1;
    if (n <= 0) clear(zone); else drags.set(zone, n);
  });
  document.addEventListener("drop", function (e) {
    if (!isFiles(e) || e.defaultPrevented || !document.querySelector(ZONE)) return;
    e.preventDefault();
    var zone = zoneOf(e.target);
    document.querySelectorAll(ZONE + "[data-drag]").forEach(clear);
    if (zone && !disabled(zone)) add(zone, e.dataTransfer.files);
  });

  window.fumeDropzone = function fumeDropzone(root) {
    var r = root || document, zones = Array.prototype.slice.call(r.querySelectorAll(ZONE));
    if (r.matches && r.matches(ZONE)) zones.unshift(r);
    zones.forEach(setup);
    return zones;
  };
  window.fumeDropzone.add = add;
  window.fumeDropzone.progress = progress;
  window.fumeDropzone.done = done;
  window.fumeDropzone.fail = fail;
  window.fumeDropzone.remove = function (el) { remove(el); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { window.fumeDropzone(); });
  else window.fumeDropzone();
})();
