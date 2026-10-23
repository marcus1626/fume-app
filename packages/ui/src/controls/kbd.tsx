// Kbd and KbdGroup (design-system/components/kbd.css), shadcn's kbd: a key is a sunken pill in the mono face.
// A key shows a shortcut; it is never a button. <KbdGroup><Kbd>⌘</Kbd><Kbd>K</Kbd></KbdGroup>
// Shortcuts are written once the Mac way ("⌘B", "⇧⌘Z") and shown the way the person's keyboard says it: "⌘B" on a Mac,
// "Ctrl+B" elsewhere (shortcutLabel). Tooltips and key hints use it.
import { forwardRef, type HTMLAttributes } from "react";
import { cx } from "../cx";

export const Kbd = forwardRef<HTMLElement, HTMLAttributes<HTMLElement>>(function Kbd({ className, ...props }, ref) {
  return <kbd ref={ref} className={cx("ui-kbd", className)} {...props} />;
});

/** Keys pressed together, 4 apart. */
export const KbdGroup = forwardRef<HTMLElement, HTMLAttributes<HTMLElement>>(function KbdGroup(
  { className, ...props },
  ref,
) {
  return <kbd ref={ref} className={cx("ui-kbd-group", className)} {...props} />;
});

/** True on a Mac (and an iPad or iPhone with a keyboard): ⌘ is the command key there; elsewhere it is Ctrl. */
export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return true;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform || nav.platform || nav.userAgent || "";
  return /mac|iphone|ipad|ipod/i.test(platform);
}

const MODS: Record<string, string> = { "⌘": "Ctrl", "⌃": "Ctrl", "⌥": "Alt", "⇧": "Shift" };
const ORDER = ["Ctrl", "Alt", "Shift"];

/**
 * A shortcut written the Mac way ("⌘K", "⇧⌘Z", "Esc", "←") as this keyboard says it: unchanged on a Mac,
 * "Ctrl+K" and "Ctrl+Shift+Z" elsewhere. Keys without a modifier stay as they are.
 */
export function shortcutLabel(shortcut: string, mac: boolean = isMacPlatform()): string {
  if (mac) return shortcut;
  const chars = Array.from(shortcut);
  const mods = chars.filter((c) => c in MODS).map((c) => MODS[c]!);
  if (!mods.length) return shortcut;
  const key = chars
    .filter((c) => !(c in MODS))
    .join("")
    .trim();
  const sorted = ORDER.filter((m) => mods.includes(m));
  return [...sorted, key].filter(Boolean).join("+");
}
