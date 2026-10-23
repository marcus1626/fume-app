// Segmented control and tabs: slides the indicator to the chosen option. DECIDED 13 Oct, from round 3.
// Markup: <div class="ui-seg" role="tablist"><span class="ui-seg-indicator"></span>
//           <button class="ui-seg-option" role="tab" aria-selected="true">All</button> ...</div>
// Call fumeSegmented(el, onChange?) once per control. With React/Radix, keep Radix for state and
// only place the indicator from the active trigger (same --x and --w).
function fumeSegmented(el, onChange) {
  const ind = el.querySelector(".ui-seg-indicator");
  const opts = () => Array.from(el.querySelectorAll(".ui-seg-option"));
  const place = () => {
    const s = opts().find((o) => o.getAttribute("aria-selected") === "true");
    if (!s || !ind) return;
    ind.style.setProperty("--x", s.offsetLeft + "px");
    ind.style.setProperty("--w", s.offsetWidth + "px");
  };
  const select = (b, focus, silent) => {
    if (!b || b.getAttribute("aria-selected") === "true") return;
    opts().forEach((o) => { o.setAttribute("aria-selected", String(o === b)); o.tabIndex = o === b ? 0 : -1; });
    if (focus) b.focus();
    place();
    if (onChange && !silent) onChange(b);
  };
  opts().forEach((o) => { o.tabIndex = o.getAttribute("aria-selected") === "true" ? 0 : -1; });
  el.classList.add("is-placing"); place();
  requestAnimationFrame(() => requestAnimationFrame(() => { el.classList.add("is-ready"); el.classList.remove("is-placing"); }));
  el.addEventListener("click", (e) => select(e.target.closest(".ui-seg-option")));
  el.addEventListener("keydown", (e) => {
    const list = opts(), i = list.indexOf(document.activeElement);
    if (i < 0) return;
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (step) { e.preventDefault(); select(list[(i + step + list.length) % list.length], true); }
    if (e.key === "Home") { e.preventDefault(); select(list[0], true); }
    if (e.key === "End") { e.preventDefault(); select(list[list.length - 1], true); }
  });
  if (window.ResizeObserver) new ResizeObserver(() => { el.classList.add("is-placing"); place(); requestAnimationFrame(() => el.classList.remove("is-placing")); }).observe(el);
  // select(option) from code moves the pill without calling onChange
  return { place, select: (b) => select(b, false, true) };
}
if (typeof module !== "undefined") module.exports = { fumeSegmented };
