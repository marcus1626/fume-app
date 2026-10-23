// Carousel: native scroll with snap, previous/next and position dots. DECIDED 13 Oct, from round 7.
// Markup: <div class="ui-carousel" data-ui-carousel role="region" aria-roledescription="carousel" aria-label="…">
//           <div class="ui-carousel-viewport">
//             <div class="ui-carousel-content" tabindex="0"> <div class="ui-carousel-item"> … </div> … </div>
//             <button class="ui-carousel-previous …" aria-label="Previous creative">…</button>
//             <button class="ui-carousel-next …" aria-label="Next creative">…</button>
//           </div>
//           <div class="ui-carousel-dots" aria-hidden="true"></div>
//         </div>
// One stop per snap position (the last few slides share the end stop), a dot per stop. ArrowLeft/ArrowRight
// move one stop while focus is in the carousel; the buttons are disabled (and fade) at the ends. Smooth
// scrolling unless reduced motion is asked for. fumeCarousel(root) is safe to call twice and returns
// { go(i), prev(), next() }; "fume:carousel-select" fires with { index, count }.
(function () {
  if (window.fumeCarousel) return;
  const reduce = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function fumeCarousel(root) {
    if (!root || root.__fumeCarousel) return root && root.__fumeCarousel;
    const vp = root.querySelector(".ui-carousel-content");
    if (!vp) return null;
    const prev = root.querySelector(".ui-carousel-previous"), next = root.querySelector(".ui-carousel-next");
    const dotsEl = root.querySelector(".ui-carousel-dots");
    const items = () => Array.from(vp.children);
    let stops = [0], index = 0, raf = 0;

    const measure = () => {
      const max = Math.max(0, vp.scrollWidth - vp.clientWidth), base = items()[0] ? items()[0].offsetLeft : 0;
      const s = [];
      items().forEach((it) => { const x = Math.min(max, Math.max(0, it.offsetLeft - base)); if (!s.length || x - s[s.length - 1] > 2) s.push(x); });
      stops = s.length ? s : [0];
      if (dotsEl && dotsEl.children.length !== stops.length) dotsEl.innerHTML = stops.map(() => '<span class="ui-carousel-dot"></span>').join("");
      items().forEach((it, i) => { it.setAttribute("role", "group"); it.setAttribute("aria-roledescription", "slide"); it.setAttribute("aria-label", i + 1 + " of " + items().length); });
    };
    const update = () => {
      raf = 0;
      const x = vp.scrollLeft;
      let best = 0; stops.forEach((s, i) => { if (Math.abs(s - x) < Math.abs(stops[best] - x)) best = i; });
      const changed = best !== index; index = best;
      if (prev) prev.disabled = x <= 2;
      if (next) next.disabled = x >= vp.scrollWidth - vp.clientWidth - 2;
      if (dotsEl) Array.from(dotsEl.children).forEach((d, i) => d.toggleAttribute("data-active", i === index));
      if (changed) root.dispatchEvent(new CustomEvent("fume:carousel-select", { detail: { index, count: stops.length } }));
    };
    const go = (i) => { i = Math.max(0, Math.min(stops.length - 1, i)); vp.scrollTo({ left: stops[i], behavior: reduce() ? "auto" : "smooth" }); };
    if (prev) prev.addEventListener("click", () => go(index - 1));
    if (next) next.addEventListener("click", () => go(index + 1));
    vp.addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
    root.addEventListener("keydown", (e) => {
      if (e.target.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1); }
      if (e.key === "ArrowRight") { e.preventDefault(); go(index + 1); }
    });
    const refresh = () => { measure(); update(); };
    if (window.ResizeObserver) new ResizeObserver(refresh).observe(vp);
    vp.querySelectorAll("img").forEach((img) => { if (!img.complete) img.addEventListener("load", refresh, { once: true }); });
    refresh();
    const api = { go, prev: () => go(index - 1), next: () => go(index + 1), refresh };
    root.__fumeCarousel = api;
    return api;
  }

  const initAll = () => document.querySelectorAll("[data-ui-carousel]").forEach(fumeCarousel);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAll); else initAll();
  window.fumeCarousel = fumeCarousel;
})();
