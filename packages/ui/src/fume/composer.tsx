// Brief composer (design-system/components/composer.css, behaviour from composer.js). DECIDED 13 Oct, round 8.
// One field that floats: the brief (16 px, grows 2 to 10 lines with field-sizing), its attachments, then the
// brief's settings as chips (the Brand DNA, the formats as toggle pills, how many creatives), the quiet circles
// (attach a brief, add a reference image, mention), and the Ink send circle that turns into stop in place while
// the Engine runs. Enter sends, Shift + Enter makes a new line; on a touch screen Enter makes a new line.
// Controlled: the screen owns the text, the choices and the attachments; onSubmit hands it all over and the
// screen clears what it sent.
import { forwardRef, useId, useRef, type ForwardedRef, type FormEvent, type HTMLAttributes, type KeyboardEvent, type ReactElement, type Ref } from "react";
import { cx } from "../cx";
import { Icon } from "../icons";
import { Attachment, AttachmentGroup, type AttachmentMedia } from "./attachment";
import { Btn, Glyph, Kbd, isCoarsePointer, pickFiles } from "./_parts";

export interface ComposerOption<V extends string = string> {
  value: V;
  /** The words in the list ("LYSNE, Brand DNA v3"). */
  label: string;
  /** The words on the chip when chosen ("LYSNE"); defaults to label. */
  display?: string;
  /** The letter in the brand's circle (Brand DNA chip only); defaults to the first letter of display. */
  initial?: string;
}

export interface ComposerAttachment {
  id: string;
  name: string;
  /** "PDF · 240 KB". */
  meta?: string;
  media?: AttachmentMedia;
  state?: "idle" | "uploading" | "processing" | "error" | "done";
  progress?: number;
  error?: string;
}

export interface ComposerSubmit<F extends string = string> {
  text: string;
  formats: F[];
  brand?: string;
  count?: number;
  attachmentIds: string[];
}

export interface ComposerProps<F extends string = string> extends Omit<HTMLAttributes<HTMLDivElement>, "onSubmit"> {
  /** The brief. */
  value: string;
  onValueChange: (value: string) => void;
  /** Send (the circle or Enter). Not called while running, empty or over the limit. */
  onSubmit: (brief: ComposerSubmit<F>) => void;
  /** The Engine is running: send turns into stop (data-state="running"); the brief can still be written. */
  running?: boolean;
  /** Pressing stop while running. */
  onStop?: () => void;
  /** Disabled: say why in `placeholder` ("Only editors can brief the Engine"). */
  disabled?: boolean;
  placeholder?: string;
  /** Characters; over it the edge and the count turn Rouge and send waits. 0 for none. */
  limit?: number;
  /** The form's aria-label. */
  label?: string;
  /** The textarea's aria-label. */
  inputLabel?: string;
  /** The textarea id (the error line points at it). */
  inputId?: string;
  /** The Brand DNA chip (with the brand's circle). Omit to leave it out. */
  brand?: { value: string; options: ComposerOption[]; onChange: (value: string) => void; label?: string };
  /** The format toggles (multiple). Options from the contract: feed, story, square (the board shows Banner too). */
  formats?: { value: F[]; options: ComposerOption<F>[]; onChange: (value: F[]) => void; label?: string };
  /** How many creatives. */
  count?: { value: number; options: number[]; onChange: (value: number) => void; label?: string; format?: (n: number) => string };
  /** Attachments above the brief. */
  attachments?: ComposerAttachment[];
  onRemoveAttachment?: (id: string) => void;
  /** Shows Attach a brief (paperclip) and Add a reference image (image-plus); hands over what was picked. */
  onAttach?: (files: File[], kind: "brief" | "image") => void;
  /** Shows Mention someone (at-sign): inserts "@" at the caret, then calls this. */
  onMention?: () => void;
  /** Round 13 (app's Fume chat, #16): the @ button's name, when it names things rather than people. */
  mentionLabel?: string;
  /** An error from the screen (e.g. the brief could not be sent), shown on the error line. */
  error?: string;
  /** Show "Enter sends · Shift Enter new line" under it (never on touch screens). */
  hint?: boolean;
  /** Over a creative: Smoke glass, the white send. */
  glass?: boolean;
  /** Docked at the bottom of a phone screen (.ui-composer-dock--sticky). */
  sticky?: boolean;
  /** One line that grows as you type, the circles inside it on the right (.ui-composer--inline; PROPOSED 19 Oct 2026,
   *  the Fume chat on a phone, MOB-2): the conversation keeps the room. No settings chips in this form. */
  inline?: boolean;
  sendLabel?: string;
  stopLabel?: string;
}

const fmt = (n: number) => n.toLocaleString("en-GB");

function ComposerInner<F extends string>(
  {
    value,
    onValueChange,
    onSubmit,
    running,
    onStop,
    disabled,
    placeholder,
    limit = 2000,
    label = "Brief for the Engine",
    inputLabel = "Brief",
    inputId,
    brand,
    formats,
    count,
    attachments = [],
    onRemoveAttachment,
    onAttach,
    onMention,
    mentionLabel = "Mention someone",
    error,
    hint,
    glass,
    sticky,
    inline,
    sendLabel = "Send the brief",
    stopLabel = "Stop the Engine",
    className,
    ...props
  }: ComposerProps<F>,
  ref: ForwardedRef<HTMLDivElement>,
) {
  const autoId = useId();
  const id = inputId ?? `composer-${autoId}`;
  const errorId = `${id}-error`;
  const input = useRef<HTMLTextAreaElement>(null);
  const formatsRef = useRef<HTMLDivElement>(null);

  const n = value.length;
  const over = !!limit && n > limit;
  const has = !!value.trim() || attachments.length > 0;
  const sendDisabled = !!disabled || (!running && (!has || over));
  const errorText = over ? `Shorten the brief by ${fmt(n - limit)}${n - limit === 1 ? " character" : " characters"} to send it.` : error;
  const tool = glass ? "glass-clear" : "quiet";

  const send = () => {
    if (running) {
      onStop?.();
      return;
    }
    if (sendDisabled) return;
    onSubmit({
      text: value.trim(),
      formats: formats?.value ?? [],
      brand: brand?.value,
      count: count?.value,
      attachmentIds: attachments.map((a) => a.id),
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.altKey || e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (!(e.metaKey || e.ctrlKey) && isCoarsePointer()) return;
    e.preventDefault();
    if (!running) send();
  };

  const mention = () => {
    const el = input.current;
    if (!el || el.disabled) return;
    const a = el.selectionStart ?? value.length, b = el.selectionEnd ?? a;
    const before = a > 0 && !/\s/.test(value[a - 1]) ? " @" : "@";
    const next = value.slice(0, a) + before + value.slice(b);
    onValueChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const at = a + before.length;
      el.setSelectionRange(at, at);
    });
    onMention?.();
  };

  const attach = async (kind: "brief" | "image") => {
    if (!onAttach) return;
    const files = await pickFiles(kind === "image" ? "image/*" : ".pdf,.doc,.docx,.txt,.md,image/*");
    if (files.length) onAttach(files, kind);
  };

  const removeAttachment = (id: string, i: number) => {
    onRemoveAttachment?.(id);
    // focus the next remove circle, or the brief
    requestAnimationFrame(() => {
      const list = input.current?.closest(".ui-composer")?.querySelectorAll<HTMLButtonElement>(".ui-composer-attachments .ui-attachment-actions .ui-btn");
      const next = list && (list[i] ?? list[i - 1]);
      (next ?? input.current)?.focus();
    });
  };

  const toggleFormat = (v: F) => {
    if (!formats) return;
    const on = formats.value.includes(v);
    formats.onChange(on ? formats.value.filter((x) => x !== v) : [...formats.value, v]);
  };

  const showCount = !!limit && n >= limit * 0.8;
  const brandOpt = brand && (brand.options.find((o) => o.value === brand.value) ?? brand.options[0]);
  const brandDisplay = brandOpt ? brandOpt.display ?? brandOpt.label : "";
  const countFmt = count?.format ?? ((c: number) => `${c} creatives`);

  return (
    <div ref={ref} className={cx("ui-composer-dock", sticky && "ui-composer-dock--sticky", className)} {...props}>
      <form
        className={cx("ui-composer", glass && "ui-glass", inline && "ui-composer--inline")}
        data-state={running ? "running" : "idle"}
        data-limit={limit || undefined}
        aria-label={label}
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          send();
        }}
      >
        <AttachmentGroup className="ui-composer-attachments">
          {attachments.map((a, i) => (
            <Attachment
              key={a.id}
              title={a.name}
              meta={a.meta}
              media={a.media}
              state={a.state ?? "done"}
              progress={a.progress}
              error={a.error}
              glass={glass}
              onRemove={onRemoveAttachment ? () => removeAttachment(a.id, i) : undefined}
            />
          ))}
        </AttachmentGroup>
        <textarea
          ref={input}
          className="ui-composer-input"
          id={id}
          name="brief"
          rows={inline ? 1 : 2}
          aria-label={inputLabel}
          aria-describedby={errorText ? errorId : undefined}
          aria-invalid={over || undefined}
          placeholder={placeholder}
          disabled={disabled}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="ui-composer-toolbar">
          {(onAttach || onMention) && (
            <div className="ui-composer-tools">
              {onAttach && (
                <>
                  <Btn variant={tool} size="sm" iconOnly icon="paperclip" aria-label="Attach a brief" disabled={disabled} onClick={() => attach("brief")} />
                  <Btn variant={tool} size="sm" iconOnly icon="image-plus" aria-label="Add a reference image" disabled={disabled} onClick={() => attach("image")} />
                </>
              )}
              {onMention && <Btn variant={tool} size="sm" iconOnly icon="at-sign" aria-label={mentionLabel} disabled={disabled} onClick={mention} />}
            </div>
          )}
          {(brand || formats) && (
            <div className="ui-composer-options">
              {brand && brandOpt && (
                <label className="ui-composer-chip">
                  <span className="ui-avatar ui-avatar--sm" aria-hidden="true">
                    {brandOpt.initial ?? brandDisplay.charAt(0).toUpperCase()}
                  </span>
                  <span className="ui-composer-chip-value">{brandDisplay}</span>
                  <Glyph name="chevrons-up-down" />
                  <select
                    className="ui-composer-chip-select"
                    name="brand"
                    aria-label={brand.label ?? "Brand DNA"}
                    disabled={disabled}
                    value={brand.value}
                    onChange={(e) => brand.onChange(e.target.value)}
                  >
                    {brand.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {formats && (
                <div
                  ref={formatsRef}
                  className="ui-toggle-group"
                  role="group"
                  data-type="multiple"
                  aria-label={formats.label ?? "Formats"}
                  onKeyDown={(e) => {
                    const step = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[e.key];
                    if (!step) return;
                    const items = Array.from(formatsRef.current?.querySelectorAll<HTMLButtonElement>(".ui-toggle:not(:disabled)") ?? []);
                    const i = items.indexOf(document.activeElement as HTMLButtonElement);
                    if (i < 0) return;
                    e.preventDefault();
                    items[(i + step + items.length) % items.length]?.focus();
                  }}
                >
                  {formats.options.map((o) => {
                    const on = formats.value.includes(o.value);
                    return (
                      <button
                        key={o.value}
                        className="ui-toggle ui-toggle--sm ui-composer-format"
                        type="button"
                        value={o.value}
                        aria-pressed={on}
                        data-state={on ? "on" : "off"}
                        disabled={disabled}
                        onClick={() => toggleFormat(o.value)}
                      >
                        <Glyph name="check" className="ui-composer-format-check" />
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <div className="ui-composer-submit">
            {count && (
              <label className="ui-composer-chip">
                <span className="ui-composer-chip-value">{countFmt(count.value)}</span>
                <Glyph name="chevrons-up-down" />
                <select
                  className="ui-composer-chip-select"
                  name="count"
                  aria-label={count.label ?? "How many creatives"}
                  disabled={disabled}
                  value={String(count.value)}
                  onChange={(e) => count.onChange(Number(e.target.value))}
                >
                  {count.options.map((c) => (
                    <option key={c} value={String(c)}>
                      {countFmt(c)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              className={cx("ui-btn", glass ? "ui-btn--glass-white" : "ui-btn--primary", "ui-btn--icon ui-btn--sm ui-composer-send")}
              type="submit"
              aria-label={running ? stopLabel : sendLabel}
              disabled={sendDisabled}
            >
              <Icon name="arrow-up" className="ui-composer-send-icon" />
              <Icon name="square" className="ui-composer-stop-icon" />
            </button>
          </div>
        </div>
      </form>
      {!glass && (hint || showCount || errorText) && (
        <div className="ui-composer-foot">
          {hint && (
            <span className="ui-composer-hint">
              <span>
                <Kbd>Enter</Kbd>sends
              </span>
              <span>
                <span className="ui-kbd-group">
                  <Kbd>Shift</Kbd>
                  <Kbd>Enter</Kbd>
                </span>
                new line
              </span>
            </span>
          )}
          {showCount && (
            <span className="ui-composer-count" data-near={n >= limit * 0.9 && !over ? "" : undefined} data-over={over ? "" : undefined}>
              {fmt(n)} / {fmt(limit)}
            </span>
          )}
          {errorText && (
            <p className="ui-field-error" id={errorId}>
              <Glyph name="circle-alert" />
              <span>{errorText}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** The brief composer: div.ui-composer-dock > form.ui-composer + div.ui-composer-foot. */
export const Composer = forwardRef(ComposerInner) as <F extends string = string>(
  props: ComposerProps<F> & { ref?: Ref<HTMLDivElement> },
) => ReactElement;
