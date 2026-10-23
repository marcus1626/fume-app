// Select: a field-like trigger that opens a glass listbox. DECIDED 13 Oct, from round 7.
// Same parts and attributes as shadcn's select (Radix): the trigger is role=combobox with aria-expanded,
// aria-controls, data-state="open|closed" and data-placeholder when nothing is chosen; the content is
// role=listbox with data-state and data-side="bottom|top"; items are role=option with aria-selected,
// data-state="checked|unchecked", data-highlighted and data-disabled.
// Markup (the listbox wears .ui-glass .ui-menu, so it is the menu's material):
//   <div class="ui-select" data-ui-select data-name="brand">
//     <button class="ui-select-trigger" type="button" aria-labelledby="brand-label">
//       <span class="ui-select-value">Choose a brand</span><svg class="ui-select-icon"><use href="#fi-chevrons-up-down"/></svg></button>
//     <div class="ui-glass ui-menu ui-select-content" role="listbox" hidden>
//       <div class="ui-select-group" role="group"><div class="ui-menu-label ui-select-label">Brands</div>
//         <div class="ui-menu-item ui-select-item" role="option" data-value="lysne">
//           <span class="ui-select-item-text">LYSNE</span><svg class="ui-menu-check ui-select-item-indicator"><use href="#fi-check"/></svg></div>
//       </div></div></div>
// Keyboard: Enter, Space, Arrow Down and Arrow Up open it on the chosen row; the arrows, Home and End
// move; Enter and Space choose; Escape and Tab close; typing jumps to the first row that starts with
// what was typed (also on the closed trigger, like a native select). Focus returns to the trigger.
// A click outside closes it. It opens 8 under the trigger, at least as wide, and above the trigger when
// there is no room below. While open the listbox moves to <body>, so no clipping parent or glass bar
// cuts it off or blurs it twice; it goes back on close.
// Events: "change" on the .ui-select root, detail { value, label }. fumeSelect(root) sets up ARIA under
// root (the listeners are on the document, so it is safe to call more than once and to load twice).
(function () {
  if (typeof window === "undefined" || window.fumeSelect) return;
  let uid = 0, openSel = null, typed = "", typedAt = 0;
  const home = new WeakMap();
  const parts = (sel) => {
    const list = (home.get(sel) || {}).list || sel.querySelector(".ui-select-content");
    return { trigger: sel.querySelector(".ui-select-trigger"), list, value: sel.querySelector(".ui-select-value") };
  };
  const items = (list) => Array.from(list.querySelectorAll('[role="option"]'));
  const enabled = (list) => items(list).filter((o) => !o.hasAttribute("data-disabled") && o.getAttribute("aria-disabled") !== "true");
  const label = (o) => ((o.querySelector(".ui-select-item-text") || o).textContent || "").trim();
  const space = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ui-space-sm")) || 8;

  function setup(sel) {
    if (sel.hasAttribute("data-ui-ready")) return;
    const { trigger, list } = parts(sel);
    if (!trigger || !list) return;
    const id = list.id || (list.id = "ui-select-" + ++uid);
    trigger.setAttribute("role", "combobox");
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-controls", id);
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-autocomplete", "none");
    trigger.dataset.state = "closed";
    list.dataset.state = "closed";
    list.hidden = true;
    list.tabIndex = -1;
    if (!list.hasAttribute("aria-labelledby") && trigger.getAttribute("aria-labelledby")) list.setAttribute("aria-labelledby", trigger.getAttribute("aria-labelledby"));
    items(list).forEach((o) => {
      if (!o.id) o.id = id + "-" + ++uid;
      o.tabIndex = -1;
      const on = o.getAttribute("aria-selected") === "true";
      o.setAttribute("aria-selected", String(on));
      o.dataset.state = on ? "checked" : "unchecked";
      if (o.hasAttribute("data-disabled")) o.setAttribute("aria-disabled", "true");
    });
    const chosen = items(list).find((o) => o.getAttribute("aria-selected") === "true");
    trigger.toggleAttribute("data-placeholder", !chosen);
    if (sel.dataset.name && !sel.querySelector('input[type="hidden"]')) {
      const h = document.createElement("input");
      h.type = "hidden"; h.name = sel.dataset.name; h.value = chosen ? chosen.dataset.value || label(chosen) : "";
      sel.appendChild(h);
    }
    sel.setAttribute("data-ui-ready", "");
  }

  function place(sel) {
    const { trigger, list } = parts(sel);
    const r = trigger.getBoundingClientRect(), gap = space(), edge = 16;
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    list.style.minWidth = r.width + "px";
    list.style.maxWidth = vw - 2 * edge + "px";
    list.style.removeProperty("--max-h");
    const cap = parseFloat(getComputedStyle(list).maxHeight) || 320;
    const natural = Math.min(list.scrollHeight, cap);
    const below = vh - r.bottom - gap - edge, above = r.top - gap - edge;
    const side = below >= natural || below >= above ? "bottom" : "top";
    const room = Math.max(120, side === "bottom" ? below : above);
    list.style.setProperty("--max-h", Math.min(cap, room) + "px");
    const h = Math.min(natural, room);
    const w = list.offsetWidth;
    const left = Math.min(Math.max(r.left, edge), Math.max(edge, vw - edge - w));
    const top = side === "bottom" ? r.bottom + gap : r.top - gap - h;
    list.style.left = left + window.scrollX + "px";
    list.style.top = top + window.scrollY + "px";
    list.dataset.side = side;
  }

  function highlight(sel, o, scroll) {
    const { list } = parts(sel);
    items(list).forEach((x) => x.toggleAttribute("data-highlighted", x === o));
    if (!o) return;
    o.focus({ preventScroll: true });
    if (scroll) o.scrollIntoView({ block: "nearest" });
  }

  function open(sel) {
    if (openSel && openSel !== sel) close(openSel, false);
    setup(sel);
    const { trigger, list } = parts(sel);
    if (trigger.disabled || trigger.hasAttribute("data-disabled") || openSel === sel) return;
    home.set(sel, { list, parent: list.parentNode, next: list.nextSibling });
    document.body.appendChild(list);
    list.hidden = false;
    list.dataset.state = "open";
    trigger.dataset.state = "open";
    trigger.setAttribute("aria-expanded", "true");
    openSel = sel;
    place(sel);
    const chosen = enabled(list).find((o) => o.getAttribute("aria-selected") === "true");
    highlight(sel, chosen || enabled(list)[0], true);
  }

  function close(sel, focus) {
    const h = home.get(sel);
    const { trigger, list } = parts(sel);
    list.hidden = true;
    list.dataset.state = "closed";
    trigger.dataset.state = "closed";
    trigger.setAttribute("aria-expanded", "false");
    items(list).forEach((x) => x.removeAttribute("data-highlighted"));
    if (h && h.parent) h.parent.insertBefore(list, h.next && h.next.parentNode === h.parent ? h.next : null);
    home.delete(sel);
    if (openSel === sel) openSel = null;
    if (focus) trigger.focus();
  }

  function choose(sel, o) {
    if (!o || o.hasAttribute("data-disabled") || o.getAttribute("aria-disabled") === "true") return;
    const { trigger, list, value } = parts(sel);
    items(list).forEach((x) => {
      const on = x === o;
      x.setAttribute("aria-selected", String(on));
      x.dataset.state = on ? "checked" : "unchecked";
    });
    if (value) value.textContent = label(o);
    trigger.removeAttribute("data-placeholder");
    const v = o.dataset.value || label(o);
    const hidden = sel.querySelector('input[type="hidden"]');
    if (hidden) hidden.value = v;
    sel.dispatchEvent(new CustomEvent("change", { bubbles: true, detail: { value: v, label: label(o) } }));
  }

  // typeahead: letters typed within 600 ms add up; the same letter again steps through matches
  function match(list, key, from) {
    const now = Date.now();
    typed = now - typedAt > 600 ? key : typed + key;
    typedAt = now;
    const q = typed.toLowerCase(), all = enabled(list);
    const same = q.split("").every((c) => c === q[0]);
    const start = from ? all.indexOf(from) : -1;
    const ordered = all.slice(start + 1).concat(all.slice(0, start + 1));
    return same && q.length > 1
      ? ordered.find((o) => label(o).toLowerCase().startsWith(q[0]))
      : (from && label(from).toLowerCase().startsWith(q) ? from : ordered.find((o) => label(o).toLowerCase().startsWith(q)));
  }
  const printable = (e) => e.key.length === 1 && e.key !== " " && !e.ctrlKey && !e.metaKey && !e.altKey;
  const selOf = (el) => {
    if (!(el instanceof Element)) return null;
    const s = el.closest("[data-ui-select]");
    if (s) return s;
    const list = el.closest(".ui-select-content");
    return openSel && list && parts(openSel).list === list ? openSel : null;
  };

  document.addEventListener("click", (e) => {
    const sel = selOf(e.target);
    if (!sel) return;
    const t = e.target.closest(".ui-select-trigger");
    if (t) { setup(sel); openSel === sel ? close(sel, true) : open(sel); return; }
    const o = e.target.closest('[role="option"]');
    if (o && openSel === sel && !o.hasAttribute("data-disabled")) { choose(sel, o); close(sel, true); }
  });
  document.addEventListener("pointerdown", (e) => {
    if (!openSel) return;
    const { trigger, list } = parts(openSel);
    if (!trigger.contains(e.target) && !list.contains(e.target)) close(openSel, false);
  }, true);
  document.addEventListener("pointermove", (e) => {
    if (!openSel || e.pointerType === "touch") return;
    const o = e.target instanceof Element && e.target.closest('[role="option"]');
    if (o && parts(openSel).list.contains(o) && !o.hasAttribute("data-highlighted") && !o.hasAttribute("data-disabled")) highlight(openSel, o, false);
  });
  document.addEventListener("keydown", (e) => {
    const sel = selOf(e.target);
    if (!sel) return;
    const { trigger, list } = parts(sel);
    if (e.target === trigger || trigger.contains(e.target)) {
      setup(sel);
      if (["ArrowDown", "ArrowUp"].includes(e.key) || (openSel !== sel && ["Enter", " "].includes(e.key))) { e.preventDefault(); open(sel); }
      else if (printable(e) && openSel !== sel) {
        const cur = enabled(list).find((o) => o.getAttribute("aria-selected") === "true");
        const m = match(list, e.key, cur);
        if (m) { e.preventDefault(); choose(sel, m); }
      }
      return;
    }
    if (openSel !== sel || !list.contains(e.target)) return;
    const all = enabled(list), cur = all.indexOf(list.querySelector("[data-highlighted]"));
    const go = (i) => { e.preventDefault(); highlight(sel, all[Math.max(0, Math.min(all.length - 1, i))], true); };
    if (e.key === "ArrowDown") go(cur + 1);
    else if (e.key === "ArrowUp") go(cur < 0 ? all.length - 1 : cur - 1);
    else if (e.key === "Home" || e.key === "PageUp") go(0);
    else if (e.key === "End" || e.key === "PageDown") go(all.length - 1);
    else if (e.key === "Enter") { e.preventDefault(); choose(sel, all[cur]); close(sel, true); }
    // Space: close on keyup, so the key's release does not press the trigger and open it again
    else if (e.key === " ") { e.preventDefault(); choose(sel, all[cur]); document.addEventListener("keyup", () => close(sel, true), { once: true, capture: true }); }
    else if (e.key === "Escape" || e.key === "Tab") { e.preventDefault(); close(sel, true); }
    else if (printable(e)) { const m = match(list, e.key, all[cur]); if (m) { e.preventDefault(); highlight(sel, m, true); } }
  });
  const replace = () => { if (openSel) place(openSel); };
  window.addEventListener("resize", replace);
  document.addEventListener("scroll", (e) => { if (openSel && !parts(openSel).list.contains(e.target)) replace(); }, true);

  window.fumeSelect = function fumeSelect(root) {
    (root || document).querySelectorAll("[data-ui-select]").forEach(setup);
  };
  window.fumeSelect.open = open;
  window.fumeSelect.close = (sel) => close(sel, false);
})();
