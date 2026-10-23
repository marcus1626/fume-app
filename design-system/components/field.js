// Fields: character counts, growing textareas, clear buttons and the file field. DECIDED 13 Oct, from round 7.
// Declarative and delegated from the document, so fields added later work without setup. Safe to load
// more than once. Markup:
//   <textarea class="ui-textarea" id="brief" maxlength="600"></textarea>
//   <span class="ui-field-count" data-ui-count="brief">0 / 600</span>     count of the control with that id
//   <div class="ui-input-group"><input class="ui-input-group-input" placeholder="…">
//     <div class="ui-input-group-addon" data-align="inline-end"><button data-ui-clear …></button></div></div>
//   <label class="ui-input-file"><span class="ui-input-file-name" data-placeholder>…</span>
//     <span class="ui-input-file-meta"></span><input class="ui-input-file-control" type="file"></label>
// A textarea grows with its text through CSS field-sizing where the browser has it, and here otherwise.
// Escape in a field with a clear button clears it. fumeField(root) refreshes counts and heights under
// root (call it after rendering fields from a template).
(function () {
  if (typeof window === "undefined" || window.fumeField) return;
  const sizing = typeof CSS !== "undefined" && CSS.supports && CSS.supports("field-sizing", "content");
  const grow = (t) => {
    if (sizing || !t.matches(".ui-textarea, .ui-input-group-textarea")) return;
    t.style.height = "auto";
    t.style.height = t.scrollHeight + "px";
  };
  const update = (c) => {
    const t = document.getElementById(c.getAttribute("data-ui-count"));
    if (!t) return;
    const n = t.value.length, max = t.maxLength > 0 ? t.maxLength : 0;
    c.textContent = max ? n + " / " + max : String(n);
    c.toggleAttribute("data-near", !!max && n >= max * 0.9);
  };
  const counts = (t) => {
    if (!t.id) return;
    document.querySelectorAll("[data-ui-count]").forEach((c) => { if (c.getAttribute("data-ui-count") === t.id) update(c); });
  };
  const clear = (group) => {
    const i = group && group.querySelector(".ui-input-group-input, .ui-input-group-textarea, input, textarea");
    if (!i || i.disabled || i.readOnly) return;
    i.value = "";
    i.dispatchEvent(new Event("input", { bubbles: true }));
    i.focus();
  };
  const size = (b) => (b >= 1e6 ? (b / 1e6).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1e3)) + " KB");

  document.addEventListener("input", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.matches("textarea")) grow(t);
    counts(t);
  });
  document.addEventListener("click", (e) => {
    const b = e.target instanceof Element && e.target.closest("[data-ui-clear]");
    if (b) clear(b.closest(".ui-input-group"));
  });
  document.addEventListener("keydown", (e) => {
    const t = e.target;
    if (e.key !== "Escape" || !(t instanceof HTMLElement) || !t.value) return;
    const g = t.closest(".ui-input-group");
    if (g && g.querySelector("[data-ui-clear]")) { e.preventDefault(); clear(g); }
  });
  document.addEventListener("change", (e) => {
    const f = e.target;
    if (!(f instanceof HTMLInputElement) || !f.matches(".ui-input-file-control")) return;
    const w = f.closest(".ui-input-file");
    const name = w && w.querySelector(".ui-input-file-name"), meta = w && w.querySelector(".ui-input-file-meta");
    const files = Array.from(f.files || []);
    if (!name) return;
    if (!name.hasAttribute("data-empty-text")) name.setAttribute("data-empty-text", name.textContent);
    if (!files.length) { name.textContent = name.getAttribute("data-empty-text"); name.setAttribute("data-placeholder", ""); if (meta) meta.textContent = ""; return; }
    name.textContent = files.length === 1 ? files[0].name : files.length + " creatives";
    name.removeAttribute("data-placeholder");
    if (meta) meta.textContent = size(files.reduce((s, x) => s + x.size, 0));
  });

  window.fumeField = function fumeField(root) {
    const r = root || document;
    r.querySelectorAll("[data-ui-count]").forEach(update);
    r.querySelectorAll(".ui-textarea, .ui-input-group-textarea").forEach(grow);
  };
})();
