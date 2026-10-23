// StudioFolds: a desk panel's folding sections, like Photoshop's panels (FLOWS §9.1). The panel never scrolls: when
// the open sections no longer fit its height, the one opened longest ago folds, until they fit (one stays open).
// Opening a section makes it the newest. On a tall screen several stay open; on a short one, one at a time.
//   <StudioFolds label="Variables" sections={[{ id: "Light", title: "Light", meta: "4", children: … }]} />
import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "../cx";
import { Icon } from "../icons";

export interface StudioFold {
  id: string;
  title: ReactNode;
  /** A count or a state beside the title, in tertiary. */
  meta?: ReactNode;
  children: ReactNode;
}

export interface StudioFoldsProps {
  sections: StudioFold[];
  /** Names the group for assistive tech ("Variables"). */
  label: string;
  /** Which sections start open, first = most wanted. Default all, so the panel shows as much as fits. */
  initialOpen?: string[];
  /** A section that just grew or was just used (advanced light turned on): it opens and becomes the newest, so the
   *  others fold first to make room for it. Takes effect whenever it changes. */
  newest?: string;
  /** Changes to bring the same `newest` forward again. */
  newestKey?: number;
  className?: string;
}

export function StudioFolds({ sections, label, initialOpen, newest, newestKey, className }: StudioFoldsProps) {
  // Ordered oldest → newest; the oldest folds first when space runs out.
  const [open, setOpen] = useState<string[]>(() => [...(initialOpen ?? sections.map((s) => s.id))].reverse());
  const root = useRef<HTMLDivElement>(null);

  const fit = useCallback(() => {
    const el = root.current;
    if (!el) return;
    if (el.scrollHeight > el.clientHeight + 1) setOpen((o) => (o.length > 1 ? o.slice(1) : o));
  }, []);
  useLayoutEffect(fit);
  useLayoutEffect(() => {
    const el = root.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => fit());
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);

  useLayoutEffect(() => {
    if (newest) setOpen((o) => (o.at(-1) === newest ? o : [...o.filter((x) => x !== newest), newest]));
  }, [newest, newestKey]);

  const toggle = (id: string) => setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));

  return (
    <div ref={root} className={cx("ui-sc-folds", className)} role="group" aria-label={label}>
      {sections.map((s) => {
        const isOpen = open.includes(s.id);
        const bodyId = `fold-${label}-${s.id}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
        return (
          <section key={s.id} className="ui-sc-fold" data-state={isOpen ? "open" : "closed"}>
            <h3 className="ui-sc-fold-head">
              <button
                type="button"
                className="ui-sc-fold-trigger"
                aria-expanded={isOpen}
                aria-controls={bodyId}
                onClick={() => toggle(s.id)}
              >
                <span className="ui-sc-fold-title">{s.title}</span>
                {s.meta !== undefined && s.meta !== null && <span className="ui-sc-fold-meta">{s.meta}</span>}
                <Icon name="chevron-down" className="ui-sc-fold-chevron" />
              </button>
            </h3>
            {isOpen && (
              <div id={bodyId} className="ui-sc-fold-body">
                {s.children}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
