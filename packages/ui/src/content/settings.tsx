// Settings layout: design-system/components/settings.css, behaviour from settings.js and tabs.js. Navigation on the
// left (vertical tabs: the sunken track with the white pill that moves to the chosen page), the page beside it at a
// calm measure. Sections are parted by space alone, each with a title and one line on what it is for. The save bar
// only exists once something changed: the Smoke glass pill sticks to the foot of the page with "Unsaved changes",
// Discard and Save changes (the one white button). Narrow (under 640 px): list then page, as on a phone. A list row
// opens its page full width and focus goes to the page title; the Settings pill goes back and focus returns to the row.
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type FormHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { cx } from "../cx";
import { Icon, type IconName } from "../icons";
import { useControllable } from "./internal";
import { ActionBar } from "./toolbar";

export interface SettingsSectionDef {
  id: string;
  /** The tab's and the row's words ("Brand DNA"). */
  label: string;
  icon?: IconName;
  /** A quiet count or word at the tab's end ("4"). */
  hint?: ReactNode;
  /** The phone row's line of description ("Voice, look and the Quality Gate"). */
  description?: ReactNode;
  /** The page: a SettingsPage. */
  content: ReactNode;
}

export interface SettingsLayoutProps extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue"> {
  /** A PageHeader ("Settings"); it hides when a page is open on a phone. */
  header?: ReactNode;
  sections: SettingsSectionDef[];
  /** The chosen page's id. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  /** The tab list's and the phone list's name; "Settings". */
  navLabel?: string;
  /** The phone's view; uncontrolled by default. */
  view?: "list" | "page";
  onViewChange?: (view: "list" | "page") => void;
}

interface SettingsCtx {
  back: () => void;
  backLabel: string;
}
const SettingsContext = createContext<SettingsCtx | null>(null);

/** The whole settings screen (div.ui-settings). */
export function SettingsLayout({
  header,
  sections,
  value,
  defaultValue,
  onValueChange,
  navLabel = "Settings",
  view: viewProp,
  onViewChange,
  className,
  ...props
}: SettingsLayoutProps) {
  const base = `ui-settings-${useId().replace(/:/g, "")}`;
  const [selected, setSelected] = useControllable<string>(value, defaultValue ?? sections[0]?.id ?? "", onValueChange);
  const [view, setView] = useControllable<"list" | "page">(viewProp, "list", onViewChange);
  const listRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const rowRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const focusTitle = useRef(false);
  const from = useRef<string | null>(null);
  const [placing, setPlacing] = useState(true);
  const [ready, setReady] = useState(false);

  // the pill follows the chosen tab (tabs.js placeVertical)
  const place = () => {
    const ind = indicatorRef.current,
      sel = tabRefs.current[selected];
    if (!ind || !sel) return;
    ind.style.setProperty("--y", sel.offsetTop + "px");
    ind.style.setProperty("--h", sel.offsetHeight + "px");
  };
  useLayoutEffect(place);
  useEffect(() => {
    let r1 = 0,
      r2 = 0;
    r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => {
        setReady(true);
        setPlacing(false);
      });
    });
    const list = listRef.current;
    let ro: ResizeObserver | null = null;
    if (list && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        setPlacing(true);
        place();
        requestAnimationFrame(() => setPlacing(false));
      });
      ro.observe(list);
    }
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
      ro?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // a row opened its page: focus goes to its title
  useEffect(() => {
    if (!focusTitle.current) return;
    focusTitle.current = false;
    const panel = document.getElementById(`${base}-p-${selected}`);
    const title = panel?.querySelector<HTMLElement>(".ui-settings-page-title");
    const root = rootRef.current;
    if (root && root.getBoundingClientRect().top < 0) root.scrollIntoView({ block: "start" });
    title?.focus({ preventScroll: true });
  });

  const choose = (id: string) => {
    if (id !== selected) setSelected(id);
  };
  const open = (id: string) => {
    choose(id);
    from.current = id;
    focusTitle.current = true;
    setView("page");
  };
  const back = () => {
    setView("list");
    const to = rowRefs.current[from.current ?? selected];
    requestAnimationFrame(() => to?.focus({ preventScroll: true }));
  };

  const onTabKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const ids = sections.map((s) => s.id);
    const i = ids.indexOf(selected);
    let next: number | null = null;
    if (e.key === "ArrowDown") next = (i + 1) % ids.length;
    else if (e.key === "ArrowUp") next = (i - 1 + ids.length) % ids.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = ids.length - 1;
    if (next === null) return;
    e.preventDefault();
    choose(ids[next]);
    tabRefs.current[ids[next]]?.focus();
  };

  return (
    <SettingsContext.Provider value={{ back, backLabel: navLabel }}>
      <div ref={rootRef} className={cx("ui-settings", className)} data-view={view} {...props}>
        {header}
        <div className="ui-tabs ui-settings-layout" data-orientation="vertical">
          <div
            ref={listRef}
            className={cx(
              "ui-tabs-list ui-tabs-list--vertical ui-settings-nav",
              placing && "is-placing",
              ready && "is-ready",
            )}
            role="tablist"
            aria-orientation="vertical"
            aria-label={navLabel}
            onKeyDown={onTabKey}
          >
            <span ref={indicatorRef} className="ui-tabs-indicator" aria-hidden="true" />
            {sections.map((s) => (
              <button
                key={s.id}
                ref={(el) => {
                  tabRefs.current[s.id] = el;
                }}
                className="ui-tabs-trigger"
                type="button"
                role="tab"
                id={`${base}-t-${s.id}`}
                aria-selected={s.id === selected}
                aria-controls={`${base}-p-${s.id}`}
                data-state={s.id === selected ? "active" : "inactive"}
                tabIndex={s.id === selected ? 0 : -1}
                onClick={() => choose(s.id)}
              >
                {s.icon && <Icon name={s.icon} />}
                {s.label}
                {s.hint !== undefined && <span className="ui-tabs-hint">{s.hint}</span>}
              </button>
            ))}
          </div>
          {sections.map((s) => (
            <section
              key={s.id}
              className="ui-tabs-content ui-settings-page"
              role="tabpanel"
              id={`${base}-p-${s.id}`}
              aria-labelledby={`${base}-t-${s.id}`}
              data-state={s.id === selected ? "active" : "inactive"}
              hidden={s.id !== selected}
            >
              {s.content}
            </section>
          ))}
          <div className="ui-item-group ui-settings-list" role="list" aria-label={navLabel}>
            {sections.map((s) => (
              <button
                key={s.id}
                ref={(el) => {
                  rowRefs.current[s.id] = el;
                }}
                className="ui-item"
                type="button"
                onClick={() => open(s.id)}
              >
                {s.icon && (
                  <span className="ui-item-media ui-item-media--icon" aria-hidden="true">
                    <Icon name={s.icon} />
                  </span>
                )}
                <span className="ui-item-content">
                  <span className="ui-item-title">{s.label}</span>
                  {s.description !== undefined && <span className="ui-item-description">{s.description}</span>}
                </span>
                <span className="ui-item-actions" aria-hidden="true">
                  <Icon name="chevron-right" />
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </SettingsContext.Provider>
  );
}

export interface SettingsPageProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title: ReactNode;
  description?: ReactNode;
  /** The phone's back pill; default the layout's navLabel ("Settings"). */
  backLabel?: string;
}
/** A page's head (the Settings back pill on a phone, the title, one line) followed by its children (a SettingsForm). */
export function SettingsPage({ title, description, backLabel, className, children, ...props }: SettingsPageProps) {
  const ctx = useContext(SettingsContext);
  return (
    <>
      <div className={cx("ui-settings-page-head", className)} {...props}>
        {/* the app's one back: the arrow in its rounded square, the parent's name beside it (back-link.css; WAY-21) */}
        <button className="ui-back ui-settings-back" type="button" onClick={ctx?.back}>
          <span className="ui-back-icon" aria-hidden="true">
            <Icon name="arrow-left" />
          </span>
          <span className="ui-back-label">
            <span className="ui-sr-only">Back to </span>
            {backLabel ?? ctx?.backLabel ?? "Settings"}
          </span>
        </button>
        <h2 className="ui-settings-page-title" tabIndex={-1}>
          {title}
        </h2>
        {description !== undefined && <p className="ui-settings-page-description">{description}</p>}
      </div>
      {children}
    </>
  );
}

export interface SettingsFormProps extends Omit<FormHTMLAttributes<HTMLFormElement>, "onSubmit"> {
  /** Something changed: the save bar slides in. */
  dirty: boolean;
  /** Saving: Save changes carries its spinner (aria-busy). */
  saving?: boolean;
  /** Discard: put the fields back as saved. */
  onDiscard: () => void;
  /** Save; the default is prevented. Say "Brand DNA saved" in a toast once it is done. */
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  unsavedLabel?: string;
  discardLabel?: string;
  saveLabel?: string;
}
/** The page's form (form.ui-settings-form) with its save bar. */
export function SettingsForm({
  dirty,
  saving,
  onDiscard,
  onSubmit,
  unsavedLabel = "Unsaved changes",
  discardLabel = "Discard",
  saveLabel = "Save changes",
  className,
  children,
  ...props
}: SettingsFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={formRef}
      className={cx("ui-settings-form", className)}
      onSubmit={(e) => {
        e.preventDefault();
        if (!saving) onSubmit(e);
      }}
      onReset={(e) => {
        e.preventDefault();
        onDiscard();
      }}
      {...props}
    >
      {children}
      <div className="ui-settings-savebar">
        <ActionBar
          open={dirty}
          dock="none"
          role="region"
          aria-label={unsavedLabel}
          label={unsavedLabel}
          optionalLabel
          onFocusLost={() => {
            const first = formRef.current?.querySelector<HTMLElement>(
              "input:not([type=hidden]), textarea, select, [role=switch], [role=checkbox]",
            );
            first?.focus({ preventScroll: true });
          }}
        >
          <button className="ui-btn ui-btn--glass-clear" type="button" onClick={onDiscard}>
            {discardLabel}
          </button>
          <button className="ui-btn ui-btn--glass-white" type="submit" aria-busy={saving || undefined}>
            <Icon name="loader-circle" className="ui-spin" />
            {saveLabel}
          </button>
        </ActionBar>
      </div>
    </form>
  );
}

export interface SettingsSectionProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title: ReactNode;
  /** One line on what the section is for. */
  description?: ReactNode;
}
/** A group of fields, parted from the next by space alone. */
export function SettingsSection({ title, description, className, children, ...props }: SettingsSectionProps) {
  return (
    <section className={cx("ui-settings-section", className)} {...props}>
      <div className="ui-settings-section-head">
        <h3 className="ui-settings-section-title">{title}</h3>
        {description !== undefined && <p className="ui-settings-section-description">{description}</p>}
      </div>
      <div className="ui-settings-section-body">{children}</div>
    </section>
  );
}
