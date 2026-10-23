// Dropdown menu (design-system/components/menu.css), on Radix DropdownMenu as shadcn does.
// Markup: div.ui-glass.ui-menu[role=menu][data-state][data-side]
//   > div.ui-menu-item[role=menuitem][data-highlighted] (svg icon, words, kbd.ui-menu-shortcut),
//     div.ui-menu-item[role=menuitemcheckbox|menuitemradio][aria-checked][data-state=checked] (svg.ui-menu-check last),
//     div.ui-menu-label, div.ui-menu-sep[role=separator] (space between groups, never a line),
//     div.ui-menu-item.ui-menu-item--danger (Delete: neutral at rest, Rouge when reached).
// Rows fill the menu edge to edge; Radix's data-highlighted is the keyboard highlight the CSS reads.
// A danger row that cannot be undone opens an AlertDialog that asks first.
// Round 9 (DWAY-4, DWAY-8; PROPOSED 19 Oct 2026): solid over the light app (glass.css); a row that goes to another page
// does not hand focus back to the menu's button, so the new page's title can take it.
import * as MenuPrimitive from "@radix-ui/react-dropdown-menu";
import { forwardRef, useRef, type ComponentPropsWithoutRef, type ElementRef, type HTMLAttributes } from "react";
import { cx } from "../cx";
import { Icon, type IconName } from "../icons";
import { floatingStyle, leftPage, pagePath, tokenPx } from "./shared";

/** Root. Props: open, defaultOpen, onOpenChange(open), modal (default true). */
export const DropdownMenu = MenuPrimitive.Root;
export type DropdownMenuProps = MenuPrimitive.DropdownMenuProps;
/** The button that opens it (aria-haspopup="menu", aria-expanded, data-state); use asChild around a Button. */
export const DropdownMenuTrigger = MenuPrimitive.Trigger;
/** A group of rows (role=group); parts of a menu are separated by DropdownMenuSeparator, not by the group. */
export const DropdownMenuGroup = MenuPrimitive.Group;
/** Holds DropdownMenuRadioItem rows. Props: value, onValueChange(value). */
export const DropdownMenuRadioGroup = MenuPrimitive.RadioGroup;

export interface DropdownMenuContentProps extends ComponentPropsWithoutRef<typeof MenuPrimitive.Content> {
  container?: HTMLElement | null;
}

/**
 * The glass menu in a portal. align default start, side default bottom, 8 from the trigger.
 * menu.css gives the menu no stacking of its own (context-menu.css and select.css do), so it takes the
 * float layer token inline, above a dialog it opens from.
 */
export const DropdownMenuContent = forwardRef<ElementRef<typeof MenuPrimitive.Content>, DropdownMenuContentProps>(
  (
    {
      className,
      side = "bottom",
      align = "start",
      sideOffset,
      collisionPadding,
      container,
      style,
      onCloseAutoFocus,
      ...props
    },
    ref,
  ) => {
    // a row that went to another page leaves focus to that page's title, not to this menu's button (DWAY-8)
    const openedOn = useRef(pagePath());
    return (
      <MenuPrimitive.Portal container={container}>
        <MenuPrimitive.Content
          ref={ref}
          side={side}
          align={align}
          sideOffset={sideOffset ?? tokenPx("--ui-overlay-offset", 8)}
          collisionPadding={collisionPadding ?? tokenPx("--ui-overlay-margin", 16)}
          className={cx("ui-glass ui-menu", className)}
          style={floatingStyle("--radix-dropdown-menu-content-transform-origin", {
            zIndex: "var(--ui-overlay-z-float)",
            ...style,
          })}
          onCloseAutoFocus={(event) => {
            onCloseAutoFocus?.(event);
            if (!event.defaultPrevented && leftPage(openedOn.current)) event.preventDefault();
          }}
          {...props}
        />
      </MenuPrimitive.Portal>
    );
  },
);
DropdownMenuContent.displayName = "DropdownMenuContent";

export interface DropdownMenuItemProps extends ComponentPropsWithoutRef<typeof MenuPrimitive.Item> {
  /** An icon before the words (ignored with asChild: put it inside the child). */
  icon?: IconName;
  /** Delete and other destructive rows: .ui-menu-item--danger. */
  danger?: boolean;
}

/** A row: div.ui-menu-item. Props: onSelect(event), disabled, textValue, asChild (an <a> for a link row). */
export const DropdownMenuItem = forwardRef<ElementRef<typeof MenuPrimitive.Item>, DropdownMenuItemProps>(
  ({ className, icon, danger, asChild, children, ...props }, ref) => (
    <MenuPrimitive.Item
      ref={ref}
      asChild={asChild}
      className={cx("ui-menu-item", danger && "ui-menu-item--danger", className)}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {icon && <Icon name={icon} />}
          {children}
        </>
      )}
    </MenuPrimitive.Item>
  ),
);
DropdownMenuItem.displayName = "DropdownMenuItem";

export interface DropdownMenuCheckboxItemProps extends ComponentPropsWithoutRef<typeof MenuPrimitive.CheckboxItem> {
  icon?: IconName;
}

/** A row that toggles: the check (svg.ui-menu-check) sits at the end, shown when checked. Props: checked, onCheckedChange(checked). */
export const DropdownMenuCheckboxItem = forwardRef<
  ElementRef<typeof MenuPrimitive.CheckboxItem>,
  DropdownMenuCheckboxItemProps
>(({ className, icon, children, ...props }, ref) => (
  <MenuPrimitive.CheckboxItem ref={ref} className={cx("ui-menu-item", className)} {...props}>
    {icon && <Icon name={icon} />}
    {children}
    <Icon name="check" className="ui-menu-check" />
  </MenuPrimitive.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName = "DropdownMenuCheckboxItem";

export interface DropdownMenuRadioItemProps extends ComponentPropsWithoutRef<typeof MenuPrimitive.RadioItem> {
  icon?: IconName;
}

/** One choice of a DropdownMenuRadioGroup, the check at the end when chosen. Props: value (required). */
export const DropdownMenuRadioItem = forwardRef<ElementRef<typeof MenuPrimitive.RadioItem>, DropdownMenuRadioItemProps>(
  ({ className, icon, children, ...props }, ref) => (
    <MenuPrimitive.RadioItem ref={ref} className={cx("ui-menu-item", className)} {...props}>
      {icon && <Icon name={icon} />}
      {children}
      <Icon name="check" className="ui-menu-check" />
    </MenuPrimitive.RadioItem>
  ),
);
DropdownMenuRadioItem.displayName = "DropdownMenuRadioItem";

/** A group's name in the label type: div.ui-menu-label. */
export const DropdownMenuLabel = forwardRef<
  ElementRef<typeof MenuPrimitive.Label>,
  ComponentPropsWithoutRef<typeof MenuPrimitive.Label>
>(({ className, ...props }, ref) => (
  <MenuPrimitive.Label ref={ref} className={cx("ui-menu-label", className)} {...props} />
));
DropdownMenuLabel.displayName = "DropdownMenuLabel";

/** Space between groups, never a line: div.ui-menu-sep[role=separator]. */
export const DropdownMenuSeparator = forwardRef<
  ElementRef<typeof MenuPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof MenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <MenuPrimitive.Separator ref={ref} className={cx("ui-menu-sep", className)} {...props} />
));
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

/** The row's shortcut at its end, in the data face: kbd.ui-menu-shortcut ("⌘D", "↵"). Put it last in the row. */
export const DropdownMenuShortcut = forwardRef<HTMLElement, HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => <kbd ref={ref} className={cx("ui-menu-shortcut", className)} {...props} />,
);
DropdownMenuShortcut.displayName = "DropdownMenuShortcut";
