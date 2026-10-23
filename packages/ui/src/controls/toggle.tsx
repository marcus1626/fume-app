// Toggle and toggle group (design-system/components/toggle.css), shadcn's toggle and toggle-group with Radix's
// attributes, written here (no Radix toggle dependency), behaving as toggle.js does. A toggle is a pill (an
// icon-only one a circle): off quiet or outline, on Ink. Never Amber.
// Toggle: <Toggle pressed={on} onPressedChange={setOn}>Logo</Toggle>, aria-pressed and data-state="on|off".
// Group, type "single": role="radiogroup", items role="radio" with aria-checked, one stays on (allowEmpty lets
// the last go off). Type "multiple": role="group", items keep aria-pressed. Arrow keys, Home and End move focus
// (roving tabindex); Space and Enter toggle.
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { cx } from "../cx";
import { Icon, type IconName } from "../icons";

export type ToggleVariant = "default" | "outline";
export type ToggleSize = "sm" | "md" | "lg";

interface ToggleLook {
  variant?: ToggleVariant;
  size?: ToggleSize;
  iconOnly?: boolean;
}

function toggleClass({ variant = "default", size = "md", iconOnly = false }: ToggleLook, className?: string): string {
  return cx("ui-toggle", variant === "outline" && "ui-toggle--outline", size !== "md" && `ui-toggle--${size}`, iconOnly && "ui-toggle--icon", className);
}

/** Uncontrolled-or-controlled state, as Radix's useControllableState. */
function useControllable<T>(value: T | undefined, defaultValue: T, onChange?: (v: T) => void): [T, (v: T) => void] {
  const [own, setOwn] = useState<T>(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? (value as T) : own;
  const set = useCallback(
    (v: T) => {
      if (!controlled) setOwn(v);
      onChange?.(v);
    },
    [controlled, onChange],
  );
  return [current, set];
}

export interface ToggleProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** default (quiet when off) or outline (the white secondary button when off). */
  variant?: ToggleVariant;
  /** sm 32, md 40 (default), lg 48. */
  size?: ToggleSize;
  /** A circle with only an icon: give it an aria-label. */
  iconOnly?: boolean;
  /** Icon before the label. */
  icon?: IconName;
  pressed?: boolean;
  defaultPressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
}

export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(function Toggle(
  { variant, size, iconOnly, icon, pressed, defaultPressed = false, onPressedChange, onClick, disabled, className, children, ...props },
  ref,
) {
  const [on, setOn] = useControllable(pressed, defaultPressed, onPressedChange);
  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={on}
      data-state={on ? "on" : "off"}
      data-disabled={disabled ? "" : undefined}
      disabled={disabled}
      className={toggleClass({ variant, size, iconOnly }, className)}
      onClick={(e: MouseEvent<HTMLButtonElement>) => {
        onClick?.(e);
        if (!e.defaultPrevented) setOn(!on);
      }}
      {...props}
    >
      {icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
});

/* ---------- group ---------- */

interface GroupContext extends ToggleLook {
  type: "single" | "multiple";
  values: string[];
  toggle: (value: string) => void;
  focusValue: string | undefined;
  disabled: boolean;
}

const ToggleGroupContext = createContext<GroupContext | null>(null);

interface ToggleGroupBase extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  variant?: ToggleVariant;
  size?: ToggleSize;
  /** Items stay separate pills 4 apart; loose puts them 8 apart (larger toggles). */
  loose?: boolean;
  orientation?: "horizontal" | "vertical";
  disabled?: boolean;
}

export interface ToggleGroupSingleProps extends ToggleGroupBase {
  type: "single";
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Let the chosen item be pressed off, leaving none (value ""). */
  allowEmpty?: boolean;
}

export interface ToggleGroupMultipleProps extends ToggleGroupBase {
  type: "multiple";
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
}

export type ToggleGroupProps = ToggleGroupSingleProps | ToggleGroupMultipleProps;

export const ToggleGroup = forwardRef<HTMLDivElement, ToggleGroupProps>(function ToggleGroup(props, ref) {
  const { type, variant, size, loose = false, orientation, disabled = false, className, children, onKeyDown, ...rest } = props;
  const single = type === "single";
  // Normalise both kinds to a list of values.
  const singleProps = props as ToggleGroupSingleProps;
  const multiProps = props as ToggleGroupMultipleProps;
  const [values, setValues] = useControllable<string[]>(
    single ? (singleProps.value !== undefined ? (singleProps.value ? [singleProps.value] : []) : undefined) : multiProps.value,
    single ? (singleProps.defaultValue ? [singleProps.defaultValue] : []) : (multiProps.defaultValue ?? []),
    (next) => (single ? singleProps.onValueChange?.(next[0] ?? "") : multiProps.onValueChange?.(next)),
  );
  const toggle = (value: string) => {
    const on = values.includes(value);
    if (single) {
      if (on && !singleProps.allowEmpty) return;
      setValues(on ? [] : [value]);
    } else {
      setValues(on ? values.filter((v) => v !== value) : [...values, value]);
    }
  };
  const domProps = { ...rest } as Record<string, unknown>;
  for (const key of ["value", "defaultValue", "onValueChange", "allowEmpty"]) delete domProps[key];

  const onKeys = (e: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button.ui-toggle:not(:disabled)")).filter(
      (el) => el.closest(".ui-toggle-group") === e.currentTarget,
    );
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    const step = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[e.key];
    let next: HTMLButtonElement | undefined;
    if (step) next = items[(i + step + items.length) % items.length];
    if (e.key === "Home") next = items[0];
    if (e.key === "End") next = items[items.length - 1];
    if (!next) return;
    e.preventDefault();
    items.forEach((x) => (x.tabIndex = x === next ? 0 : -1));
    next.focus();
  };

  return (
    <ToggleGroupContext.Provider value={{ type, variant, size, values, toggle, focusValue: values[0], disabled }}>
      <div
        ref={ref}
        role={single ? "radiogroup" : "group"}
        data-type={type}
        data-orientation={orientation}
        className={cx("ui-toggle-group", loose && "ui-toggle-group--loose", className)}
        onKeyDown={onKeys}
        {...(domProps as HTMLAttributes<HTMLDivElement>)}
      >
        {children}
      </div>
    </ToggleGroupContext.Provider>
  );
});

export interface ToggleGroupItemProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "value"> {
  value: string;
  /** A circle with only an icon: give it an aria-label. */
  iconOnly?: boolean;
  icon?: IconName;
}

/** One toggle in a ToggleGroup; variant and size come from the group. */
export const ToggleGroupItem = forwardRef<HTMLButtonElement, ToggleGroupItemProps>(function ToggleGroupItem(
  { value, iconOnly, icon, disabled, onClick, className, children, ...props },
  ref,
) {
  const group = useContext(ToggleGroupContext);
  if (!group) throw new Error("ToggleGroupItem must be inside a ToggleGroup");
  const on = group.values.includes(value);
  const off = disabled || group.disabled;
  const single = group.type === "single";
  // Roving focus: the chosen item (or the first, when none is chosen) is the one Tab reaches.
  const tabbable = group.focusValue === undefined ? undefined : group.focusValue === value ? 0 : -1;
  return (
    <button
      ref={ref}
      type="button"
      value={value}
      role={single ? "radio" : undefined}
      aria-checked={single ? on : undefined}
      aria-pressed={single ? undefined : on}
      data-state={on ? "on" : "off"}
      data-disabled={off ? "" : undefined}
      disabled={off}
      tabIndex={tabbable}
      className={toggleClass({ variant: group.variant, size: group.size, iconOnly }, className)}
      onClick={(e: MouseEvent<HTMLButtonElement>) => {
        onClick?.(e);
        if (!e.defaultPrevented) group.toggle(value);
      }}
      {...props}
    >
      {icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
});
