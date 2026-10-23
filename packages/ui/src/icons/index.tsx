// Icons: filled Lucide plus Fume's own (the checked triangle fume-check, the Engine fume-engine).
// The sprite is built by tools/icons/build.mjs; put <IconSprite /> in the page once, then use <Icon name="…" />.
import type { SVGProps } from "react";
import sprite from "../../../../design-system/icons/sprite.svg?raw";
import { cx } from "../cx";

/** Every icon in design-system/icons/sprite.svg. */
export type IconName =
  | "eye-cut"
  | "copy-cut"
  | "sliders-horizontal-cut"
  | "trash-cut"
  | "house-cut"
  | "image-cut"
  | "settings-cut"
  | "info-cut"
  | "circle-alert-cut"
  | "circle-check-cut"
  | "circle-x-cut"
  | "triangle-alert-cut"
  | "clock-cut"
  | "calendar-cut"
  | "pencil-cut"
  | "send-cut"
  | "panel-left-cut"
  | "mail-cut"
  | "inbox-cut"
  | "tag-cut"
  | "megaphone-cut"
  | "palette-cut"
  | "file-cut"
  | "file-text-cut"
  | "camera-cut"
  | "thumbs-up-cut"
  | "image-plus-cut"
  | "columns-2-cut"
  | "check"
  | "plus"
  | "x"
  | "arrow-right"
  | "rotate-ccw"
  | "search"
  | "loader-circle"
  | "ellipsis"
  | "message-square"
  | "eye"
  | "copy"
  | "download"
  | "sliders-horizontal"
  | "layout-grid"
  | "trash"
  | "house"
  | "folder"
  | "image"
  | "user"
  | "settings"
  | "bell"
  | "chevron-down"
  | "chevron-up"
  | "chevron-left"
  | "chevron-right"
  | "chevrons-up-down"
  | "minus"
  | "arrow-left"
  | "arrow-up"
  | "arrow-down"
  | "arrow-up-down"
  | "upload"
  | "link"
  | "paperclip"
  | "info"
  | "circle-alert"
  | "circle-check"
  | "circle-x"
  | "triangle-alert"
  | "clock"
  | "calendar"
  | "pencil"
  | "send"
  | "panel-left"
  | "grip-vertical"
  | "lock"
  | "mail"
  | "users"
  | "inbox"
  | "funnel"
  | "tag"
  | "log-out"
  | "megaphone"
  | "palette"
  | "list"
  | "bold"
  | "italic"
  | "command"
  | "menu"
  | "file"
  | "file-text"
  | "camera"
  | "zoom-in"
  | "zoom-out"
  | "maximize-2"
  | "minimize-2"
  | "square"
  | "play"
  | "pause"
  | "refresh-cw"
  | "trending-up"
  | "trending-down"
  | "chart-column"
  | "chart-line"
  | "chart-pie"
  | "reply"
  | "at-sign"
  | "thumbs-up"
  | "mic"
  | "undo-2"
  | "redo-2"
  | "crop"
  | "external-link"
  | "share-2"
  | "bookmark"
  | "arrow-up-right"
  | "user-plus"
  | "image-plus"
  | "columns-2"
  | "type"
  | "expand"
  | "package"
  | "layers"
  | "sticky-note"
  | "globe"
  | "fume-check"
  | "fume-engine";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  /** A label makes the icon meaningful to screen readers; without one it is decoration. */
  label?: string;
}

export function Icon({ name, label, className, ...props }: IconProps) {
  return (
    <svg
      className={cx("ico", className)}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      {...props}
    >
      <use href={`#fi-${name}`} />
    </svg>
  );
}

/** The icon sprite, out of sight, once per page (the app shell renders it). */
export function IconSprite() {
  // Not hidden: Chrome does not draw masks (the cut icons) from a display:none tree. The svg itself is 0 × 0.
  return <div aria-hidden="true" dangerouslySetInnerHTML={{ __html: sprite }} />;
}
