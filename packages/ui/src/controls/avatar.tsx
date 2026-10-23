// Avatar (design-system/components/avatar.css), shadcn's parts: Avatar, AvatarImage, AvatarFallback, AvatarBadge,
// AvatarGroup, AvatarGroupCount. Circles; initials in Ink on the sunken step when there is no image (or it fails
// to load); ink for the person who decides (you, or Anna on a check). People are real people: never an AI face.
// An avatar is not a control; put it in a button or a row to press it.
// Short form: <Avatar src={url} alt="LYSNE" initials="L" />; parts: <Avatar><AvatarFallback>A</AvatarFallback>
// <AvatarImage src={url} alt="" /></Avatar>.
import { forwardRef, useEffect, useState, type HTMLAttributes, type ImgHTMLAttributes } from "react";
import { cx } from "../cx";

export type AvatarSize = "sm" | "md" | "lg";

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  /** sm 24, md 32 (default), lg 40. */
  size?: AvatarSize;
  /** Ink with Paper initials. */
  ink?: boolean;
  /** Image URL; the initials show beneath until it loads, and stay if it fails. */
  src?: string;
  /** The image's alt text. */
  alt?: string;
  /** Initials for the fallback ("A"). */
  initials?: string;
  /** A status dot: here (Ink) or away (grey). Say it in the avatar's aria-label too. */
  status?: "here" | "away";
}

export const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(function Avatar(
  { size = "md", ink = false, src, alt = "", initials, status, className, children, ...props },
  ref,
) {
  return (
    <span ref={ref} className={cx("ui-avatar", size !== "md" && `ui-avatar--${size}`, ink && "ui-avatar--ink", className)} {...props}>
      {initials !== undefined ? <AvatarFallback>{initials}</AvatarFallback> : null}
      {src ? <AvatarImage src={src} alt={alt} /> : null}
      {children}
      {status ? <AvatarBadge status={status} /> : null}
    </span>
  );
});

/** The image; covers the fallback once it loads, and removes itself if it fails. */
export const AvatarImage = forwardRef<HTMLImageElement, ImgHTMLAttributes<HTMLImageElement>>(function AvatarImage(
  { className, src, onError, alt = "", ...props },
  ref,
) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) return null;
  return (
    <img
      ref={ref}
      src={src}
      alt={alt}
      className={cx("ui-avatar-image", className)}
      onError={(e) => {
        setFailed(true);
        onError?.(e);
      }}
      {...props}
    />
  );
});

/** The initials beneath the image. */
export const AvatarFallback = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>(function AvatarFallback({ className, ...props }, ref) {
  return <span ref={ref} className={cx("ui-avatar-fallback", className)} {...props} />;
});

export interface AvatarBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Default "here" (Ink). */
  status?: "here" | "away";
}

/** The status dot, cut out of the avatar with the ground colour. */
export const AvatarBadge = forwardRef<HTMLSpanElement, AvatarBadgeProps>(function AvatarBadge({ status = "here", className, ...props }, ref) {
  return <span ref={ref} aria-hidden="true" data-status={status === "away" ? "away" : undefined} className={cx("ui-avatar-badge", className)} {...props} />;
});

/** Overlapping avatars; give it role="img" and an aria-label naming everyone ("Anna, Marcus and 3 more"). */
export const AvatarGroup = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>(function AvatarGroup({ className, ...props }, ref) {
  return <span ref={ref} className={cx("ui-avatar-group", className)} {...props} />;
});

/** "+3" at the end of a group. */
export const AvatarGroupCount = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>(function AvatarGroupCount({ className, ...props }, ref) {
  return <span ref={ref} className={cx("ui-avatar-group-count", className)} {...props} />;
});
