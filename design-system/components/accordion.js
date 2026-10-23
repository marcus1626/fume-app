// Accordion and collapsible. DECIDED 13 Oct, from round 7. Same states as Radix: data-state="open|closed" on the item,
// trigger and content; aria-expanded on the trigger; data-disabled.
// Markup (accordion):
//   <div class="ui-accordion" data-ui-accordion data-type="single|multiple" data-collapsible>
//     <div class="ui-accordion-item" data-state="open">
//       <h3 class="ui-accordion-header"><button class="ui-accordion-trigger" type="button" aria-expanded="true"
//           aria-controls="c1" id="t1" data-state="open"><span class="ui-accordion-label">Voice</span>
//           <svg class="ui-accordion-chevron">…</svg></button></h3>
//       <div class="ui-accordion-content" id="c1" role="region" aria-labelledby="t1" data-state="open">
//         <div><div class="ui-accordion-body">…</div></div></div></div></div>
// Markup (collapsible): <div class="ui-collapsible" data-ui-collapsible data-state="closed">
//   <button class="ui-collapsible-trigger" aria-expanded="false" aria-controls="c2">…</button>
//   <div class="ui-collapsible-content" id="c2" data-state="closed"><div>…</div></div></div>
// Keyboard (accordion): Enter and Space toggle (native button), ArrowDown and ArrowUp move between triggers,
// Home and End jump to the first and last. Works by delegation: no init call, content added later works too.
// window.fumeAccordion(el, open?) opens, closes or toggles an accordion item or a collapsible from code.
(function () {
  if (window.fumeAccordion) return; // safe to load more than once

  const contentOf = (scope, trigger) => {
    const id = trigger && trigger.getAttribute("aria-controls");
    return (id && document.getElementById(id)) || scope.querySelector(".ui-accordion-content, .ui-collapsible-content");
  };
  const setState = (scope, open) => {
    const trigger = scope.querySelector(".ui-accordion-trigger, .ui-collapsible-trigger");
    const content = contentOf(scope, trigger);
    const s = open ? "open" : "closed";
    scope.setAttribute("data-state", s);
    if (trigger) { trigger.setAttribute("data-state", s); trigger.setAttribute("aria-expanded", String(open)); }
    if (content) content.setAttribute("data-state", s);
  };
  const disabled = (t) => !t || t.disabled || t.hasAttribute("data-disabled") || t.getAttribute("aria-disabled") === "true";

  function toggleItem(item, open) {
    const root = item.closest(".ui-accordion");
    const isOpen = item.getAttribute("data-state") === "open";
    const next = open === undefined ? !isOpen : open;
    if (next === isOpen) return;
    const single = !root || root.getAttribute("data-type") !== "multiple";
    if (single && !next && root && !root.hasAttribute("data-collapsible")) return; // single, not collapsible: one stays open
    if (single && next && root) {
      root.querySelectorAll(":scope > .ui-accordion-item[data-state='open']").forEach((o) => { if (o !== item) setState(o, false); });
    }
    setState(item, next);
  }
  function toggleCollapsible(root, open) {
    const isOpen = root.getAttribute("data-state") === "open";
    setState(root, open === undefined ? !isOpen : open);
  }

  document.addEventListener("click", (e) => {
    const t = e.target.closest && e.target.closest(".ui-accordion-trigger, .ui-collapsible-trigger");
    if (!t || disabled(t)) return;
    const item = t.closest(".ui-accordion-item");
    const coll = t.closest("[data-ui-collapsible]");
    if (item && item.closest("[data-ui-accordion]")) toggleItem(item);
    else if (coll) toggleCollapsible(coll);
  });

  document.addEventListener("keydown", (e) => {
    const t = e.target.closest && e.target.closest(".ui-accordion-trigger");
    if (!t) return;
    const root = t.closest("[data-ui-accordion]");
    if (!root) return;
    const list = Array.from(root.querySelectorAll(":scope > .ui-accordion-item > .ui-accordion-header > .ui-accordion-trigger")).filter((x) => !disabled(x));
    const i = list.indexOf(t);
    if (i < 0) return;
    const go = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: list.length - 1 }[e.key];
    if (go === undefined) return;
    e.preventDefault();
    list[(go + list.length) % list.length].focus();
  });

  window.fumeAccordion = function (el, open) {
    if (!el) return;
    const item = el.closest(".ui-accordion-item");
    if (item) return toggleItem(item, open);
    const coll = el.closest("[data-ui-collapsible]");
    if (coll) return toggleCollapsible(coll, open);
  };
})();
