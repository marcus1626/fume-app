// Command palette (design-system/components/command.css, behaviour of command.js), a Radix Dialog with a
// filtered list, as shadcn's command dialog (cmdk is not a dependency).
// Markup: div.ui-dialog-overlay + div.ui-glass.ui-dialog.ui-command-dialog[role=dialog]
//   > div.ui-command
//     > div.ui-command-input-wrapper (svg search, input.ui-command-input[role=combobox][aria-activedescendant])
//     > div.ui-command-list[role=listbox]
//       > div.ui-command-group[role=group] > div.ui-command-group-heading + div.ui-command-item[role=option][data-selected][aria-selected][data-disabled]
//         (svg icon, span.ui-command-item-label, span.ui-command-meta | span.ui-command-shortcut > kbd.ui-kbd)
//       > div.ui-command-empty (span.ui-command-empty-title, span.ui-command-empty-hint)
//     > div.ui-command-footer (key hints; hidden on touch by the CSS)
// Typing filters (every word must match the label or keywords; case and accents ignored), empty groups go,
// the empty state says so and offers a next step. Arrow keys, PageUp/PageDown and Ctrl+Home/End move the
// highlight while focus stays in the field; Enter or a click chooses, the palette closes, then onSelect runs.
// ⌘K / Ctrl+K opens and closes it (hotkey). It starts clean every time it opens.
// Round 9 (DWAY-8, DWAY-10; PROPOSED 19 Oct 2026): closing gives focus back to what had it when the palette opened
// (the Search button, a field), unless the choice went to another page, whose title then takes it. The list is
// min(600 px, 70 %) tall on a desk (command.css).
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { cx } from "../cx";
import { Icon, type IconName } from "../icons";
import { DialogOverlay } from "./dialog";
import { currentOpener, returnFocusTo, useControllableState } from "./shared";

export interface CommandPaletteItem {
  /** Stable and unique within the palette. */
  id: string;
  /** The row's words (span.ui-command-item-label). */
  label: string;
  /** The group heading it sits under ("Creatives", "Campaigns", "Actions"); groups keep the order they first appear in. */
  group?: string;
  icon?: IconName;
  /** Keys, one per kbd ("⌘", "G"). Shown instead of meta when both are given. */
  shortcut?: string[];
  /** Quiet words at the end ("Approved", "12 creatives", "After the check"): span.ui-command-meta. */
  meta?: string;
  /** More words to match on, not shown ("lysne approved anna"). */
  keywords?: string;
  disabled?: boolean;
  onSelect: () => void;
}

export interface CommandPaletteProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  items: CommandPaletteItem[];
  /** The dialog's name for screen readers; default "Command palette". */
  label?: string;
  /** The field's aria-label; default "Search creatives, campaigns and actions". */
  inputLabel?: string;
  /** Default "Search creatives and actions". */
  placeholder?: string;
  /** Nothing found: the title, given the query; default Nothing matches “query”. */
  emptyTitle?: (query: string) => ReactNode;
  /** Nothing found: a next step; default "Try a campaign, a format such as Story, or Anna." */
  emptyHint?: ReactNode;
  /** Key hints at the foot; false hides them. Default Move, Open, Close. */
  footer?: ReactNode | false;
  /** ⌘K / Ctrl+K toggles the palette; default true. Mount one palette with the hotkey per page. */
  hotkey?: boolean;
  className?: string;
  container?: HTMLElement | null;
}

/** Lower case, accents off (ø, æ, å too), as command.js matches. */
export function normalizeSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/å/g, "a");
}

function matches(item: CommandPaletteItem, words: string[]): boolean {
  if (!words.length) return true;
  const hay = normalizeSearch(`${item.label} ${item.meta ?? ""} ${item.group ?? ""} ${item.keywords ?? ""}`);
  return words.every((w) => hay.includes(w));
}

const DEFAULT_FOOTER = (
  <>
    <span>
      <kbd className="ui-kbd">↑</kbd>
      <kbd className="ui-kbd">↓</kbd>Move
    </span>
    <span>
      <kbd className="ui-kbd">↵</kbd>Open
    </span>
    <span>
      <kbd className="ui-kbd">esc</kbd>Close
    </span>
  </>
);

/** The ⌘K palette. Items are data; the palette renders, filters, moves and chooses. */
export function CommandPalette({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  items,
  label = "Command palette",
  inputLabel = "Search creatives, campaigns and actions",
  placeholder = "Search creatives, campaigns and actions",
  emptyTitle = (q) => `Nothing matches “${q}”`,
  emptyHint = "Try a campaign, a format such as Story, or Anna.",
  footer = DEFAULT_FOOTER,
  hotkey = true,
  className,
  container,
}: CommandPaletteProps) {
  const [open, setOpen] = useControllableState<boolean>(openProp, defaultOpen, onOpenChange);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const scrollNext = useRef(false);
  const [listEl, setListEl] = useState<HTMLDivElement | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const content = useRef<HTMLDivElement | null>(null);
  const uid = useId();
  const listId = `${uid}-list`;
  const optionId = (id: string) => `${uid}-opt-${id}`;

  // ⌘K / Ctrl+K anywhere
  useEffect(() => {
    if (!hotkey) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen(!open);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [hotkey, open, setOpen]);

  const words = useMemo(() => {
    const q = normalizeSearch(query.trim());
    return q ? q.split(/\s+/) : [];
  }, [query]);

  const shown = useMemo(() => items.filter((i) => matches(i, words)), [items, words]);
  const usable = useMemo(() => shown.filter((i) => !i.disabled), [shown]);
  const groups = useMemo(() => {
    const order: string[] = [];
    const by = new Map<string, CommandPaletteItem[]>();
    for (const item of shown) {
      const g = item.group ?? "";
      if (!by.has(g)) {
        by.set(g, []);
        order.push(g);
      }
      by.get(g)!.push(item);
    }
    return order.map((name) => ({ name, items: by.get(name)! }));
  }, [shown]);

  // every time it opens it starts clean
  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  // the first usable row is highlighted after every filter (keyed on the rows, not the array, so a parent
  // render does not move the highlight)
  const usableKey = usable.map((i) => i.id).join("\u0000");
  const firstUsable = usable[0]?.id ?? null;
  useEffect(() => {
    setActive(firstUsable);
    if (listEl) listEl.scrollTop = 0;
  }, [usableKey, firstUsable, listEl]);

  // keyboard moves keep the highlighted row in view
  useEffect(() => {
    if (!scrollNext.current || !active) return;
    scrollNext.current = false;
    document.getElementById(`${uid}-opt-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, uid]);

  // when the results scroll, the list stops at the middle of a row: half a row is the scroll hint (command.js fit)
  useLayoutEffect(() => {
    const list = listEl;
    if (!list) return;
    list.style.maxHeight = "";
    const cs = getComputedStyle(list);
    const max = parseFloat(cs.maxHeight);
    if (!max || !/auto|scroll/.test(cs.overflowY) || list.scrollHeight <= max + 1) return;
    let cut = 0;
    const base = list.offsetTop;
    list.querySelectorAll<HTMLElement>(".ui-command-item").forEach((i) => {
      if (!i.offsetHeight) return;
      const mid = (i.offsetParent === list ? i.offsetTop : i.offsetTop - base) + i.offsetHeight / 2;
      if (mid <= max && mid > cut) cut = mid;
    });
    if (cut) list.style.maxHeight = `${Math.round(cut)}px`;
  }, [shown, listEl]);

  const choose = (item: CommandPaletteItem | undefined) => {
    if (!item || item.disabled) return;
    setOpen(false);
    item.onSelect();
  };

  const move = (to: CommandPaletteItem | undefined) => {
    if (!to) return;
    scrollNext.current = true;
    setActive(to.id);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    const i = usable.findIndex((x) => x.id === active);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!usable.length) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      move(usable[i < 0 ? 0 : (i + step + usable.length) % usable.length]);
    } else if ((e.key === "Home" && e.ctrlKey) || e.key === "PageUp") {
      e.preventDefault();
      move(usable[0]);
    } else if ((e.key === "End" && e.ctrlKey) || e.key === "PageDown") {
      e.preventDefault();
      move(usable[usable.length - 1]);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(usable[i]);
    }
  };

  const keepFocus = (e: ReactMouseEvent) => e.preventDefault(); // a press on a row keeps the caret in the field

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal container={container}>
        <DialogOverlay />
        <DialogPrimitive.Content
          ref={content}
          aria-modal="true"
          aria-describedby={undefined}
          className={cx("ui-glass ui-dialog ui-command-dialog", className)}
          onOpenAutoFocus={() => {
            opener.current = currentOpener();
          }}
          onCloseAutoFocus={(event) => {
            if (returnFocusTo(opener.current, content.current)) event.preventDefault();
          }}
        >
          <DialogPrimitive.Title hidden>{label}</DialogPrimitive.Title>
          <div className="ui-command">
            <div className="ui-command-input-wrapper">
              <Icon name="search" />
              <input
                className="ui-command-input"
                type="text"
                role="combobox"
                aria-expanded="true"
                aria-autocomplete="list"
                aria-controls={listId}
                aria-activedescendant={active ? optionId(active) : undefined}
                aria-label={inputLabel}
                placeholder={placeholder}
                autoComplete="off"
                spellCheck={false}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
              />
            </div>
            <div className="ui-command-list" id={listId} role="listbox" aria-label={label} ref={setListEl}>
              {groups.map((g, gi) => {
                const headingId = `${uid}-g${gi}`;
                return (
                  <div className="ui-command-group" role="group" key={g.name || `group-${gi}`} aria-labelledby={g.name ? headingId : undefined}>
                    {g.name && (
                      <div className="ui-command-group-heading" id={headingId} onMouseDown={keepFocus}>
                        {g.name}
                      </div>
                    )}
                    {g.items.map((item) => {
                      const selected = item.id === active;
                      return (
                        <div
                          key={item.id}
                          id={optionId(item.id)}
                          className="ui-command-item"
                          role="option"
                          aria-selected={selected}
                          data-selected={String(selected)}
                          data-disabled={item.disabled ? "true" : undefined}
                          aria-disabled={item.disabled || undefined}
                          onMouseDown={keepFocus}
                          onPointerMove={(e) => {
                            if (e.pointerType && e.pointerType !== "mouse") return;
                            if (!selected && !item.disabled) setActive(item.id);
                          }}
                          onClick={() => choose(item)}
                        >
                          {item.icon && <Icon name={item.icon} />}
                          <span className="ui-command-item-label">{item.label}</span>
                          {item.shortcut?.length ? (
                            <span className="ui-command-shortcut">
                              {item.shortcut.map((k, ki) => (
                                <kbd className="ui-kbd" key={ki}>
                                  {k}
                                </kbd>
                              ))}
                            </span>
                          ) : item.meta ? (
                            <span className="ui-command-meta">{item.meta}</span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              {shown.length === 0 && (
                <div className="ui-command-empty" onMouseDown={keepFocus}>
                  <span className="ui-command-empty-title">{emptyTitle(query.trim())}</span>
                  {emptyHint && <span className="ui-command-empty-hint">{emptyHint}</span>}
                </div>
              )}
            </div>
            {footer !== false && <div className="ui-command-footer">{footer}</div>}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
