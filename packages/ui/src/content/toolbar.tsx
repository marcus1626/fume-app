// Toolbar and floating action bar: design-system/components/toolbar.css, behaviour from toolbar.js.
// Toolbar follows Radix Toolbar: role="toolbar", one tab stop, arrows (Home, End) move along its controls and skip
// disabled ones. Groups are parted by space, never a line. Icon tools are quiet circles; a tool that stays on is a
// toggle (toggle.css) and turns Ink; the zoom readout is data in an <output>. The wide group steps away under 600 px.
// ActionBar: the Smoke glass bar that floats in when creatives are selected ("3 selected · Download · Delete ·
// Send to Anna"). One white action moves the work on; the rest are glass-clear. It slides in (data-state="open") and
// leaves faster (data-state="closed", then hidden). Under 480 px the wide actions fold into a More circle with a glass
// menu above the bar; under 360 px the label keeps only its count. Escape or the x clears the selection.
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type FocusEvent as ReactFocusEvent,
  type OutputHTMLAttributes,
  type ReactNode,
} from "react";
import { cx } from "../cx";
import { Icon, type IconName } from "../icons";
import { mergeRefs, motionMs, useGlassMenu, useRovingBar } from "./internal";

/* ---------- toolbar ---------- */

export interface ToolbarProps extends HTMLAttributes<HTMLDivElement> {
  /** Required: the toolbar's name ("Edit creative"). */
  "aria-label": string;
  orientation?: "horizontal" | "vertical";
  /** No tray (.ui-toolbar--bare): the tools sit on the surface. */
  bare?: boolean;
}

export const Toolbar = forwardRef<HTMLDivElement, ToolbarProps>(function Toolbar(
  { orientation = "horizontal", bare, className, onKeyDown, onFocus, ...props },
  ref,
) {
  const inner = useRef<HTMLDivElement>(null);
  const roving = useRovingBar(inner, orientation === "vertical");
  return (
    <div
      ref={mergeRefs(ref, inner)}
      role="toolbar"
      aria-orientation={orientation}
      className={cx("ui-toolbar", bare && "ui-toolbar--bare", className)}
      onKeyDown={(e: ReactKeyboardEvent<HTMLDivElement>) => {
        onKeyDown?.(e);
        if (!e.defaultPrevented) roving.onKeyDown(e);
      }}
      onFocus={(e: ReactFocusEvent<HTMLDivElement>) => {
        onFocus?.(e);
        roving.onFocus(e);
      }}
      {...props}
    />
  );
});

export interface ToolbarGroupProps extends HTMLAttributes<HTMLDivElement> {
  /** Steps away on a phone (under 600 px), as the zoom group does. */
  wide?: boolean;
  /** A single or multiple choice of toggles (.ui-toggle-group with data-type). */
  toggle?: "single" | "multiple";
}
export function ToolbarGroup({ wide, toggle, className, ...props }: ToolbarGroupProps) {
  return (
    <div
      role="group"
      data-type={toggle}
      className={cx(toggle && "ui-toggle-group", "ui-toolbar-group", wide && "ui-toolbar-group--wide", className)}
      {...props}
    />
  );
}

/** Radix's separator; in Fume it is space. */
export function ToolbarSeparator({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div role="separator" aria-orientation="vertical" className={cx("ui-toolbar-separator", className)} {...props} />;
}

export interface ToolbarButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  /** Required: the tool's name ("Undo"). */
  "aria-label": string;
}
/** A quiet icon circle. */
export const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(function ToolbarButton({ icon, className, type = "button", ...props }, ref) {
  return (
    <button ref={ref} type={type} className={cx("ui-btn ui-btn--quiet ui-btn--icon", className)} {...props}>
      <Icon name={icon} />
    </button>
  );
});

export interface ToolbarToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  icon?: IconName;
  pressed: boolean;
  onPressedChange?: (pressed: boolean) => void;
  /** In a single-choice ToolbarGroup: role="radio" with aria-checked instead of aria-pressed (Radix ToggleGroup). */
  radio?: boolean;
}
/** A tool that stays on (Crop, Compare): toggle.css's icon toggle, aria-pressed. Give icon-only toggles an aria-label. */
export const ToolbarToggle = forwardRef<HTMLButtonElement, ToolbarToggleProps>(function ToolbarToggle(
  { icon, pressed, onPressedChange, radio, className, children, onClick, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      role={radio ? "radio" : undefined}
      aria-pressed={radio ? undefined : pressed}
      aria-checked={radio ? pressed : undefined}
      data-state={pressed ? "on" : "off"}
      className={cx("ui-toggle", icon && children === undefined && "ui-toggle--icon", className)}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) onPressedChange?.(!pressed);
      }}
      {...props}
    >
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
});

/** The readout ("100 %") in the data face, at a fixed width. */
export function ToolbarNumber({ className, ...props }: OutputHTMLAttributes<HTMLOutputElement>) {
  return <output className={cx("ui-toolbar-num", className)} {...props} />;
}

/* ---------- action bar ---------- */

export interface ActionBarItem {
  label: string;
  icon?: IconName;
  onSelect?: () => void;
  disabled?: boolean;
  /** "white": the one action that moves the work on (Send to Anna); "danger": the glass-danger moment. Default clear. */
  variant?: "clear" | "white" | "danger";
  /** Folds into More under 480 px (Download, Delete). */
  fold?: boolean;
  /** In the folded menu: a Delete row (.ui-menu-item--danger). */
  danger?: boolean;
}

export interface ActionBarProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Shown (slides in) or not (slides out, then hidden). */
  open: boolean;
  /** The number selected; with `label` " selected" it reads "3 selected", the count kept under 360 px. */
  count?: number;
  /** The words after the count, or the whole label when there is no count ("Unsaved changes"). Default " selected". */
  label?: ReactNode;
  /** A label that only names the bar steps aside under 360 px (.ui-action-bar-label--optional). */
  optionalLabel?: boolean;
  /** The x before the label ("Clear the selection"); Escape calls it too. */
  onClear?: () => void;
  clearLabel?: string;
  /** "fixed" floats over the screen (default); "contained" sits at the bottom of a positioned parent; "none" renders no dock. */
  dock?: "fixed" | "contained" | "none";
  /** The bar's actions, in order; the white one goes last. */
  actions?: ActionBarItem[];
  /** Other controls in the actions row, after `actions`. */
  children?: ReactNode;
  /** More's name; "More for the selection". */
  moreLabel?: string;
  /** Called when the bar closes with focus inside it, so the page can put focus back on the grid. */
  onFocusLost?: () => void;
}

/** The floating action bar (div.ui-glass.ui-glass--bar.ui-action-bar, role toolbar). */
export const ActionBar = forwardRef<HTMLDivElement, ActionBarProps>(function ActionBar(
  {
    open,
    count,
    label,
    optionalLabel,
    onClear,
    clearLabel = "Clear the selection",
    dock = "fixed",
    actions = [],
    children,
    moreLabel = "More for the selection",
    onFocusLost,
    className,
    role = "toolbar",
    "aria-label": ariaLabel,
    onKeyDown,
    onFocus,
    ...props
  },
  ref,
) {
  const bar = useRef<HTMLDivElement>(null);
  const roving = useRovingBar(bar, false, onClear);
  const menuId = `ui-actionbar-${useId().replace(/:/g, "")}`;
  const more = useGlassMenu(menuId);
  const [hidden, setHidden] = useState(!open);
  const words = label ?? (count !== undefined ? " selected" : undefined);
  const name = ariaLabel ?? (count !== undefined && typeof words === "string" ? `${count}${words}` : typeof words === "string" ? words : undefined);

  useEffect(() => {
    if (open) {
      setHidden(false);
      return;
    }
    const el = bar.current;
    if (el && el.contains(document.activeElement)) onFocusLost?.();
    const t = window.setTimeout(() => setHidden(true), motionMs("--ui-motion-base", 240) + 40);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const folded = actions.filter((a) => a.fold);
  const btn = (a: ActionBarItem, i: number) => (
    <button
      key={i}
      type="button"
      disabled={a.disabled}
      onClick={a.onSelect}
      className={cx(
        "ui-btn",
        a.variant === "white" ? "ui-btn--glass-white" : a.variant === "danger" ? "ui-btn--glass-danger" : "ui-btn--glass-clear",
        a.fold && "ui-action-bar-wide",
      )}
    >
      {a.icon && <Icon name={a.icon} />}
      {a.label}
    </button>
  );
  const firstWhite = actions.findIndex((a) => a.variant === "white" || a.variant === "danger");
  const before = firstWhite < 0 ? actions : actions.slice(0, firstWhite);
  const after = firstWhite < 0 ? [] : actions.slice(firstWhite);

  const barEl = (
    <div
      ref={mergeRefs(ref, bar)}
      role={role}
      aria-label={name}
      data-state={open ? "open" : "closed"}
      hidden={hidden && !open}
      className={cx("ui-glass ui-glass--bar ui-action-bar", className)}
      onKeyDown={(e: ReactKeyboardEvent<HTMLDivElement>) => {
        onKeyDown?.(e);
        if (!e.defaultPrevented) roving.onKeyDown(e);
      }}
      onFocus={(e: ReactFocusEvent<HTMLDivElement>) => {
        onFocus?.(e);
        roving.onFocus(e);
      }}
      {...props}
    >
      {onClear && (
        <button className="ui-btn ui-btn--glass-clear ui-btn--icon ui-action-bar-clear" type="button" aria-label={clearLabel} onClick={onClear}>
          <Icon name="x" />
        </button>
      )}
      {(count !== undefined || words !== undefined) && (
        <span className={cx("ui-action-bar-label", optionalLabel && "ui-action-bar-label--optional")} aria-live={count !== undefined ? "polite" : undefined}>
          {count !== undefined ? (
            <>
              <span className="ui-action-bar-count">{count}</span>
              {words !== undefined && <span className="ui-action-bar-label-text">{words}</span>}
            </>
          ) : (
            words
          )}
        </span>
      )}
      {(actions.length > 0 || children !== undefined) && (
        <div className="ui-action-bar-actions">
          {before.map(btn)}
          {folded.length > 0 && (
            <button {...more.triggerProps} className="ui-btn ui-btn--glass-clear ui-btn--icon ui-action-bar-more" aria-label={moreLabel}>
              <Icon name="ellipsis" />
            </button>
          )}
          {after.map((a, i) => btn(a, before.length + i))}
          {children}
        </div>
      )}
    </div>
  );

  const menuEl =
    folded.length > 0 ? (
      <div {...more.contentProps} className="ui-glass ui-menu ui-action-bar-menu" role="menu" aria-label={moreLabel}>
        {folded.map((a, i) => (
          <button
            key={i}
            className={cx("ui-menu-item", a.danger && "ui-menu-item--danger")}
            type="button"
            role="menuitem"
            disabled={a.disabled}
            onClick={a.onSelect}
          >
            {a.icon && <Icon name={a.icon} />}
            {a.label}
          </button>
        ))}
      </div>
    ) : null;

  if (dock === "none")
    return (
      <>
        {barEl}
        {menuEl}
      </>
    );
  return (
    <div className={cx("ui-action-bar-dock", dock === "contained" && "ui-action-bar-dock--contained")}>
      {barEl}
      {menuEl}
    </div>
  );
});
