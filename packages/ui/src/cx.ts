/** Joins class names, dropping empty ones: cx("ui-btn", primary && "ui-btn--primary", className). */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
