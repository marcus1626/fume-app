// Empty state: design-system/components/empty.css (shadcn's empty parts). Calm and centred, one icon in a soft square
// (the Engine where the next step is to generate, the grey checked triangle for an empty check queue), one next step.
// A page with nothing in it can be a scene instead: <Empty scene><EmptyScene src/><EmptySceneGlass>…</EmptySceneGlass>
// (PROPOSED 27 Oct 2026, round 3): one of Fume's pictures across the width, dimmed, with one Smoke pill bar on it.
import { type HTMLAttributes, type ReactNode } from "react";
import { cx } from "../cx";
import { Icon, type IconName } from "../icons";

export interface EmptyProps extends HTMLAttributes<HTMLDivElement> {
  /** Inside a panel: a surface step (.ui-empty--surface). */
  surface?: boolean;
  /** Smaller air and title (.ui-empty--sm), for cards and charts. */
  size?: "default" | "sm";
  /** A page with nothing in it: a picture across the width with a Smoke pill bar on it (.ui-empty--scene, PROPOSED). */
  scene?: boolean;
}
export function Empty({ surface, size = "default", scene, className, ...props }: EmptyProps) {
  return (
    <div
      data-slot="empty"
      className={cx(
        "ui-empty",
        surface && !scene && "ui-empty--surface",
        size === "sm" && "ui-empty--sm",
        scene && "ui-empty--scene",
        className,
      )}
      {...props}
    />
  );
}

export interface EmptySceneProps {
  /** The picture: one of Fume's own, made with the Engine. */
  src: string;
  /** It sets the mood, so it is decorative by default. */
  alt?: string;
}
/** The scene's picture, behind the glass of <Empty scene>. No label on it (round 3, Marcus). */
export function EmptyScene({ src, alt = "" }: EmptySceneProps) {
  return (
    <img
      data-slot="empty-scene"
      className="ui-empty-scene-img"
      src={src}
      alt={alt}
      decoding="async"
      draggable={false}
    />
  );
}

/** The Smoke pill bar on the scene: the header (icon, title, text) and the next step go inside it. */
export function EmptySceneGlass({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="empty-scene-glass" className={cx("ui-empty-scene-glass", className)} {...props} />;
}

export function EmptyHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="empty-header" className={cx("ui-empty-header", className)} {...props} />;
}

export interface EmptyMediaProps extends HTMLAttributes<HTMLDivElement> {
  /** "icon": the soft sunken square. */
  variant?: "default" | "icon";
  /** Shortcut: the icon to show (fume-engine, fume-check, funnel, …). */
  icon?: IconName;
  /** The grey checked triangle of an empty check queue (.ui-empty-media--waiting). */
  waiting?: boolean;
  children?: ReactNode;
}
export function EmptyMedia({ variant = "icon", icon, waiting, className, children, ...props }: EmptyMediaProps) {
  return (
    <div
      data-slot="empty-media"
      className={cx(
        "ui-empty-media",
        variant === "icon" && "ui-empty-media--icon",
        waiting && "ui-empty-media--waiting",
        className,
      )}
      {...props}
    >
      {icon && <Icon name={icon} />}
      {children}
    </div>
  );
}

export interface EmptyTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  /** The heading element; h3 by default. */
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p";
}
export function EmptyTitle({ as: Tag = "h3", className, ...props }: EmptyTitleProps) {
  return <Tag data-slot="empty-title" className={cx("ui-empty-title", className)} {...props} />;
}

export function EmptyDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p data-slot="empty-description" className={cx("ui-empty-description", className)} {...props} />;
}

/** The next step: one Ink primary button, at most one quiet or secondary beside it. */
export function EmptyContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="empty-content" className={cx("ui-empty-content", className)} {...props} />;
}
