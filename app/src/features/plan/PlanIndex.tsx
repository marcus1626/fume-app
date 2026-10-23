// The plan's index (FLOWS §22.2). Round 12 (UX review DLAY-10, DWAY-12, DLOAD-10; PROPOSED 20 Oct 2026): it sits in the
// plan's sticky summary aside, "In this plan" above the facts, beside what it indexes (Stripe's docs, Notion's outline),
// not in the campaign's tab row: so "Creatives" is never both a tab and a part, and the expert's page needs no second
// sticky row. Each entry is its part's own heading ("The brief", "Window light", "How it looks", "The 9 creatives",
// "Rules", "When"). The part in view is lit by weight and colour; a press glides to its part, clear of the sticky rows
// (the part's own scroll-margin), and the keyboard lands there too.
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { partsOf } from "./words";

const scrollerOf = (el: Element | null) =>
  (el?.closest(".ui-sidebar-inset") as HTMLElement | null) ?? (document.scrollingElement as HTMLElement | null);

/** How much of the scroller's top the sticky rows cover: the parts say it themselves (scroll-margin-top). */
const covered = (el: Element | null) => (el ? parseFloat(getComputedStyle(el).scrollMarginTop) || 0 : 0);

export function PlanIndex({
  label = "In this plan",
  parts = partsOf(),
}: {
  label?: string;
  parts?: { id: string; label: string }[];
}) {
  const nav = useRef<HTMLElement>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const picked = useRef<{ id: string; at: number } | null>(null);
  const ids = parts.map((p) => p.id).join(" ");

  useEffect(() => {
    const s = scrollerOf(nav.current);
    if (!s) return;
    const list = ids.split(" ");
    let frame = 0;
    const pick = () => {
      const top = s.getBoundingClientRect().top;
      const off = covered(document.getElementById(list[0]!));
      const line = top + off + (s.clientHeight - off) / 4;
      let at = -1;
      list.forEach((id, i) => {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) at = i;
      });
      if (s.scrollTop + s.clientHeight >= s.scrollHeight - 2) at = list.length - 1;
      const pin = picked.current;
      if (pin && Date.now() - pin.at < 900) at = list.indexOf(pin.id);
      else picked.current = null;
      setCurrent(at >= 0 ? list[at]! : list[0]!);
    };
    const onScroll = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(pick);
    };
    pick();
    s.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      s.removeEventListener("scroll", onScroll);
      window.cancelAnimationFrame(frame);
    };
  }, [ids]);

  const go = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const el = document.getElementById(id);
    const s = scrollerOf(nav.current);
    if (!el || !s) return;
    e.preventDefault();
    picked.current = { id, at: Date.now() };
    setCurrent(id);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const y = el.getBoundingClientRect().top - s.getBoundingClientRect().top + s.scrollTop - covered(el);
    s.scrollTo({ top: Math.max(0, y), behavior: reduce ? "auto" : "smooth" });
    // the keyboard lands where the eye does
    el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
  };

  return (
    <nav ref={nav} className="ui-plandoc-index" aria-label={label}>
      <p className="ui-plandoc-index-title" aria-hidden="true">
        {label}
      </p>
      <ul className="ui-plandoc-index-list">
        {parts.map((p) => (
          <li key={p.id}>
            <a
              href={`#${p.id}`}
              className="ui-plandoc-index-link"
              aria-current={current === p.id ? "location" : undefined}
              onClick={(e) => go(e, p.id)}
            >
              {p.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
