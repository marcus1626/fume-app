// Brief composer and its attachments. DECIDED 13 Oct, from round 8. Delegated from the document, so composers
// added later work without setup; safe to load more than once. Markup (see composer.css):
//   <form class="ui-composer" data-ui-composer data-limit="2000" data-state="idle">
//     <div class="ui-attachment-group ui-composer-attachments"> attachments </div>
//     <textarea class="ui-composer-input" id="brief" …></textarea>
//     … <button data-ui-composer-attach="brief|image"> <button data-ui-composer-mention>
//     … <label class="ui-composer-chip"><span class="ui-composer-chip-value">LYSNE</span>
//          <select class="ui-composer-chip-select" data-ui-composer-select>…</select></label>
//     … <button class="ui-btn ui-btn--primary ui-btn--icon ui-btn--sm ui-composer-send" type="submit"
//          aria-label="Send the brief" data-label-stop="Stop the Engine">
//   </form>
//   <div class="ui-composer-foot"> <span data-ui-composer-count="brief" hidden></span>
//     <p class="ui-field-error" data-ui-composer-error="brief" hidden></p> </div>
// Enter sends and Shift + Enter makes a new line with a keyboard; on a touch screen Enter makes a new
// line and the send button sends. Nothing is sent while an input method is still composing. Send is
// disabled while the brief is empty or over data-limit; near the limit the count shows, over it the
// field turns Rouge and says how much to cut. Sending dispatches "ui-composer-submit" on the form
// (bubbles, cancelable; detail: text, formats, choices, attachments); unless it is cancelled the brief
// and its attachments clear. fumeComposer.running(form, true) turns send into stop (data-state="running");
// pressing stop dispatches "ui-composer-stop". Attach opens the system picker and adds attachments;
// [data-ui-attachment-remove] removes one and moves focus to the next. window.fumeComposer(root)
// settles counts, buttons and chips under root.
(() => {
  if (window.fumeComposer) return;
  const SEL = "[data-ui-composer]";
  const num = (n) => n.toLocaleString("en-GB");
  const parts = (form) => {
    const input = form.querySelector(".ui-composer-input");
    const id = input && input.id;
    const by = (attr) => (id ? document.querySelector("[" + attr + "=\"" + id + "\"]") : null);
    return { input, send: form.querySelector(".ui-composer-send"), count: by("data-ui-composer-count"), error: by("data-ui-composer-error"), group: form.querySelector(".ui-composer-attachments") };
  };
  const running = (form) => form.getAttribute("data-state") === "running";

  function update(form) {
    const { input, send, count, error, group } = parts(form);
    if (!input) return;
    const limit = parseInt(form.getAttribute("data-limit"), 10) || 0;
    const n = input.value.length, over = !!limit && n > limit;
    if (count && limit) {
      count.textContent = num(n) + " / " + num(limit);
      count.hidden = n < limit * 0.8;
      count.toggleAttribute("data-near", n >= limit * 0.9 && !over);
      count.toggleAttribute("data-over", over);
    }
    if (over) input.setAttribute("aria-invalid", "true"); else input.removeAttribute("aria-invalid");
    if (error) {
      error.hidden = !over;
      const words = error.querySelector("[data-ui-composer-error-text]") || error;
      if (over) words.textContent = "Shorten the brief by " + num(n - limit) + (n - limit === 1 ? " character" : " characters") + " to send it.";
    }
    const has = !!input.value.trim() || !!(group && group.querySelector(".ui-attachment"));
    if (send) {
      const stop = running(form);
      send.disabled = input.disabled || (!stop && (!has || over));
      if (!send.dataset.labelSend) send.dataset.labelSend = send.getAttribute("aria-label") || "Send the brief";
      send.setAttribute("aria-label", stop ? (send.dataset.labelStop || "Stop the Engine") : send.dataset.labelSend);
    }
  }

  function syncChip(select) {
    const chip = select.closest(".ui-composer-chip");
    const opt = select.options[select.selectedIndex];
    if (!chip || !opt) return;
    const value = chip.querySelector(".ui-composer-chip-value");
    if (value) value.textContent = opt.getAttribute("data-display") || opt.textContent;
    const av = chip.querySelector(".ui-avatar");
    if (av && opt.getAttribute("data-initial")) av.textContent = opt.getAttribute("data-initial");
  }

  function submit(form) {
    const { input, send, group } = parts(form);
    if (!input) return;
    if (running(form)) { form.dispatchEvent(new CustomEvent("ui-composer-stop", { bubbles: true })); return; }
    update(form);
    if (!send || send.disabled) return;
    const detail = {
      text: input.value.trim(),
      formats: Array.from(form.querySelectorAll(".ui-composer-format")).filter((t) => t.getAttribute("aria-pressed") === "true" || t.dataset.state === "on").map((t) => t.value || t.textContent.trim()),
      choices: Object.fromEntries(Array.from(form.querySelectorAll("[data-ui-composer-select]")).map((s) => [s.name || s.id, s.value])),
      attachments: group ? Array.from(group.querySelectorAll(".ui-attachment-title")).map((t) => t.textContent.trim()) : [],
    };
    if (!form.dispatchEvent(new CustomEvent("ui-composer-submit", { bubbles: true, cancelable: true, detail }))) return;
    input.value = "";
    if (group) group.querySelectorAll(".ui-attachment").forEach(removeOne);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function removeOne(att) {
    const img = att.querySelector("img[data-ui-object-url]");
    if (img) URL.revokeObjectURL(img.src);
    att.remove();
  }

  const size = (b) => (b >= 1e6 ? (b / 1e6).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1e3)) + " KB");
  function attachment(f, onGlass) {
    const image = /^image\//.test(f.type);
    const ext = (f.name.split(".").pop() || "").toUpperCase();
    const el = document.createElement("div");
    el.className = "ui-attachment";
    el.setAttribute("data-slot", "attachment");
    el.setAttribute("data-state", "done");
    el.innerHTML = '<div class="ui-attachment-media" data-variant="' + (image ? "image" : "icon") + '">' +
      (image ? '<img alt="" data-ui-object-url>' : '<svg aria-hidden="true"><use href="#fi-file-text"/></svg>') + "</div>" +
      '<div class="ui-attachment-content"><span class="ui-attachment-title"></span>' +
      '<span class="ui-attachment-description"><span class="ui-attachment-meta"></span></span></div>' +
      '<div class="ui-attachment-actions"><button class="ui-btn ' + (onGlass ? "ui-btn--glass-clear" : "ui-btn--quiet") + ' ui-btn--icon ui-btn--sm" type="button" data-ui-attachment-remove>' +
      '<svg aria-hidden="true"><use href="#fi-x"/></svg></button></div>';
    el.querySelector(".ui-attachment-title").textContent = f.name;
    el.querySelector(".ui-attachment-title").title = f.name;
    el.querySelector(".ui-attachment-meta").textContent = (ext ? ext + " · " : "") + size(f.size);
    el.querySelector("[data-ui-attachment-remove]").setAttribute("aria-label", "Remove " + f.name);
    if (image) el.querySelector("img").src = URL.createObjectURL(f);
    return el;
  }

  function pick(form, kind) {
    const { group } = parts(form);
    if (!group) return;
    const inp = document.createElement("input");
    inp.type = "file";
    inp.multiple = true;
    inp.accept = kind === "image" ? "image/*" : ".pdf,.doc,.docx,.txt,.md,image/*";
    inp.hidden = true;
    form.appendChild(inp);
    inp.addEventListener("change", () => {
      Array.from(inp.files || []).forEach((f) => group.appendChild(attachment(f, form.classList.contains("ui-glass"))));
      inp.remove();
      update(form);
    });
    inp.click();
  }

  document.addEventListener("input", (e) => {
    const t = e.target;
    const form = t instanceof Element && t.matches(".ui-composer-input") && t.closest(SEL);
    if (form) update(form);
  });
  document.addEventListener("keydown", (e) => {
    const t = e.target;
    if (e.key !== "Enter" || !(t instanceof Element) || !t.matches(".ui-composer-input")) return;
    if (e.shiftKey || e.altKey || e.isComposing || e.keyCode === 229) return;
    if (!(e.metaKey || e.ctrlKey) && window.matchMedia && matchMedia("(pointer: coarse)").matches) return;
    const form = t.closest(SEL);
    if (!form) return;
    e.preventDefault();
    if (!running(form)) submit(form);
  });
  document.addEventListener("submit", (e) => {
    const form = e.target instanceof Element && e.target.matches(SEL) && e.target;
    if (!form) return;
    e.preventDefault();
    submit(form);
  });
  document.addEventListener("change", (e) => {
    const t = e.target;
    if (t instanceof HTMLSelectElement && t.matches("[data-ui-composer-select]")) syncChip(t);
  });
  document.addEventListener("click", (e) => {
    const el = e.target instanceof Element ? e.target : null;
    if (!el) return;
    const attach = el.closest("[data-ui-composer-attach]");
    if (attach) { const form = attach.closest(SEL); if (form) pick(form, attach.getAttribute("data-ui-composer-attach")); return; }
    const mention = el.closest("[data-ui-composer-mention]");
    if (mention) {
      const form = mention.closest(SEL), input = form && parts(form).input;
      if (!input || input.disabled) return;
      const a = input.selectionStart ?? input.value.length, b = input.selectionEnd ?? a;
      const before = a > 0 && !/\s/.test(input.value[a - 1]) ? " @" : "@";
      input.setRangeText(before, a, b, "end");
      input.focus();
      input.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    const rm = el.closest("[data-ui-attachment-remove]");
    if (rm) {
      const att = rm.closest(".ui-attachment"), form = rm.closest(SEL);
      if (!att) return;
      const list = Array.from(att.parentElement.querySelectorAll(".ui-attachment"));
      const i = list.indexOf(att), next = list[i + 1] || list[i - 1];
      const name = (att.querySelector(".ui-attachment-title") || {}).textContent || "";
      att.dispatchEvent(new CustomEvent("ui-attachment-remove", { bubbles: true, detail: { name } }));
      removeOne(att);
      const focus = (next && next.querySelector("[data-ui-attachment-remove]")) || (form && parts(form).input);
      if (focus) focus.focus();
      if (form) update(form);
    }
  });

  const fumeComposer = function fumeComposer(root) {
    const r = root || document;
    const forms = Array.from(r.querySelectorAll(SEL));
    if (r.matches && r.matches(SEL)) forms.push(r);
    forms.forEach((form) => {
      form.querySelectorAll("[data-ui-composer-select]").forEach(syncChip);
      update(form);
    });
  };
  fumeComposer.running = (form, on) => {
    form.setAttribute("data-state", on ? "running" : "idle");
    update(form);
  };
  fumeComposer.update = update;
  window.fumeComposer = fumeComposer;
  if (document.readyState !== "loading") fumeComposer(); else document.addEventListener("DOMContentLoaded", () => fumeComposer());
})();
