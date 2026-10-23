// Option menu: one button that opens a few ways to do one thing, each with a line on what it means
// (design-system/components/option-menu.css), as "New campaign" holds "Start with Fume" and "Write the brief yourself".
// On a desk the glass dropdown menu under the button; on a phone the drawer from the bottom (sheet.tsx), in reach of
// the thumb. Each option is an icon, its name and one line; 2 to 4 options, never more.
import { cloneElement, isValidElement, useState, type ReactElement, type ReactNode } from "react";
import { cx } from "../cx";
import { Icon, type IconName } from "../icons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../overlays/dropdown-menu";
import { Drawer, DrawerBody, DrawerContent, DrawerHeader, DrawerTitle } from "../overlays/sheet";
import { useNarrowScreen } from "../overlays/shared";

export interface OptionMenuOption {
  id: string;
  icon: IconName;
  label: string;
  /** One line on what this way means ("Talk it through; Fume writes the brief"). */
  description?: ReactNode;
  onSelect: () => void;
}

export interface OptionMenuProps {
  /** The button that opens it (a Button); it gets aria-haspopup and aria-expanded. */
  children: ReactElement;
  /** The menu's name, the drawer's title on a phone ("New campaign"). */
  title: string;
  options: OptionMenuOption[];
  /** Where the menu lines up with its button on a desk; default end. */
  align?: "start" | "center" | "end";
  className?: string;
}

function Row({ option }: { option: OptionMenuOption }) {
  return (
    <>
      <span className="ui-option-menu-icon" aria-hidden="true">
        <Icon name={option.icon} />
      </span>
      <span className="ui-option-menu-text">
        <span className="ui-option-menu-label">{option.label}</span>
        {option.description && <span className="ui-option-menu-description">{option.description}</span>}
      </span>
    </>
  );
}

/** A button with a short menu of ways (desk) or a drawer of them (phone). */
export function OptionMenu({ children, title, options, align = "end", className }: OptionMenuProps) {
  const narrow = useNarrowScreen("(max-width: 639px)");
  const [open, setOpen] = useState(false);
  if (narrow) {
    const trigger = isValidElement(children)
      ? cloneElement(
          children as ReactElement<{ onClick?: () => void; "aria-haspopup"?: string; "aria-expanded"?: boolean }>,
          {
            onClick: () => setOpen(true),
            "aria-haspopup": "dialog",
            "aria-expanded": open,
          },
        )
      : children;
    return (
      <>
        {trigger}
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent className={cx("ui-option-menu-drawer", className)} aria-describedby={undefined}>
            <DrawerHeader>
              <DrawerTitle>{title}</DrawerTitle>
            </DrawerHeader>
            <DrawerBody>
              <div className="ui-option-menu-list">
                {options.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    className="ui-menu-item ui-option-menu-item"
                    onClick={() => {
                      setOpen(false);
                      o.onSelect();
                    }}
                  >
                    <Row option={o} />
                  </button>
                ))}
              </div>
            </DrawerBody>
          </DrawerContent>
        </Drawer>
      </>
    );
  }
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} aria-label={title} className={cx("ui-option-menu", className)}>
        {options.map((o) => (
          <DropdownMenuItem key={o.id} className="ui-option-menu-item" onSelect={o.onSelect}>
            <Row option={o} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
