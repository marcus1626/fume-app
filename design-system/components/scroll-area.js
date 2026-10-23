// Scroll area: a thin overlay thumb instead of the native scrollbar. DECIDED 13 Oct, from round 7. Radix-like parts and states.
// Markup: <div class="ui-scroll-area" data-ui-scroll-area>
//           <div class="ui-scroll-area-viewport" tabindex="0">…content…</div>
//           <div class="ui-scroll-area-scrollbar" data-orientation="horizontal"><div class="ui-scroll-area-thumb"></div></div>
//         </div>   (add a data-orientation="vertical" scrollbar for vertical scrolling; one or both)
// Initialises every [data-ui-scroll-area] on DOMContentLoaded; call window.fumeScrollArea(el?) for content added
// later (el: one area or a container of areas). Safe to call more than once. The thumb shows while scrolling
// (data-state="visible") and on hover, can be dragged, and a press on the bar jumps there.
(function () {
  if (window.fumeScrollArea) return;
  const MIN = 24; // shortest thumb, px: still easy to see and to grab
  const ms = (name, fallback) => {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return parseFloat(v) || fallback;
  };

  function setup(root) {
    if (root._fumeScroll) { root._fumeScroll(); return; }
    const vp = root.querySelector(":scope > .ui-scroll-area-viewport");
    if (!vp) return;
    const bars = Array.from(root.querySelectorAll(":scope > .ui-scroll-area-scrollbar"));
    let hideTimer = 0;

    const metrics = (bar) => {
      const h = bar.getAttribute("data-orientation") === "horizontal";
      const view = h ? vp.clientWidth : vp.clientHeight, size = h ? vp.scrollWidth : vp.scrollHeight;
      const pos = h ? Math.abs(vp.scrollLeft) : vp.scrollTop;
      const cs = getComputedStyle(bar);
      const track = (h ? bar.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) : bar.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom));
      const thumb = Math.max(MIN, Math.min(track, (view / size) * track));
      const max = size - view;
      return { h, view, size, pos, track, thumb, max };
    };
    const place = () => {
      bars.forEach((bar) => {
        const t = bar.querySelector(".ui-scroll-area-thumb"); if (!t) return;
        const m = metrics(bar);
        bar.setAttribute("data-overflow", String(m.max > 1));
        t.style.setProperty("--thumb-size", m.thumb + "px");
        t.style.setProperty("--thumb-pos", (m.max > 0 ? (m.pos / m.max) * (m.track - m.thumb) : 0) + "px");
      });
    };
    const show = () => {
      bars.forEach((b) => b.setAttribute("data-state", "visible"));
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => bars.forEach((b) => { if (!b.querySelector("[data-dragging]")) b.setAttribute("data-state", "hidden"); }), ms("--ui-motion-slow", 480) * 2);
    };

    vp.addEventListener("scroll", () => { place(); show(); }, { passive: true });

    bars.forEach((bar) => {
      bar.setAttribute("data-state", "hidden");
      const thumb = bar.querySelector(".ui-scroll-area-thumb");
      bar.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        const m = metrics(bar);
        const r = bar.getBoundingClientRect();
        const start = m.h ? e.clientX : e.clientY;
        if (e.target !== thumb) { // a press on the bar: jump so the thumb centres there
          const at = (m.h ? e.clientX - r.left : e.clientY - r.top) - m.thumb / 2;
          const to = (at / Math.max(1, m.track - m.thumb)) * m.max;
          vp.scrollTo({ [m.h ? "left" : "top"]: to, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
          return;
        }
        e.preventDefault();
        const from = m.h ? vp.scrollLeft : vp.scrollTop;
        thumb.setAttribute("data-dragging", "");
        bar.setPointerCapture(e.pointerId);
        const move = (ev) => {
          const d = (m.h ? ev.clientX : ev.clientY) - start;
          const to = from + d * (m.max / Math.max(1, m.track - m.thumb));
          if (m.h) vp.scrollLeft = to; else vp.scrollTop = to;
        };
        const up = () => {
          thumb.removeAttribute("data-dragging");
          bar.removeEventListener("pointermove", move); bar.removeEventListener("pointerup", up); bar.removeEventListener("pointercancel", up);
          show();
        };
        bar.addEventListener("pointermove", move); bar.addEventListener("pointerup", up); bar.addEventListener("pointercancel", up);
      });
    });

    if (window.ResizeObserver) {
      const ro = new ResizeObserver(place);
      ro.observe(vp); Array.from(vp.children).forEach((c) => ro.observe(c));
    }
    root.classList.add("is-ready");
    root._fumeScroll = place;
    place();
  }

  window.fumeScrollArea = function (el) {
    const scope = el || document;
    const list = scope.matches && scope.matches("[data-ui-scroll-area]") ? [scope] : Array.from(scope.querySelectorAll("[data-ui-scroll-area]"));
    list.forEach(setup);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => window.fumeScrollArea());
  else window.fumeScrollArea();
})();
