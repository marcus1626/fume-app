// Fields (design-system/components/field.css), shadcn's input, textarea, label and field parts: Field,
// FieldLabel, FieldContent, FieldTitle, FieldDescription, FieldError, FieldGroup, FieldSet, FieldLegend,
// FieldSeparator; plus Fume's FieldFoot, FieldCount, FieldOptional, FieldControl, FileInput and the choice cards
// (FieldChoices, FieldChoice). A field is white with one hairline, radius 12; an error is the Rouge edge plus
// words under the field. Proximity comes from the CSS: label 8 above, description or error 4 under, fields 24 apart.
//   <Field invalid={!!error}>
//     <FieldLabel htmlFor="name">Campaign name</FieldLabel>
//     <Input id="name" aria-describedby="name-d" aria-invalid={!!error || undefined} />
//     {error ? <FieldError id="name-d">{error}</FieldError> : <FieldDescription id="name-d">…</FieldDescription>}
//   </Field>
import {
  forwardRef,
  useCallback,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FieldsetHTMLAttributes,
  type FormEvent,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
  type Ref,
  type TextareaHTMLAttributes,
} from "react";
import { cx } from "../cx";
import { Icon, type IconName } from "../icons";
import { composeRefs } from "./slot";

export type FieldSize = "sm" | "md" | "lg";

/* ---------- input and textarea ---------- */

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** sm 32, md 40 (default), lg 48 with 16 px text. Touch screens make every field 44 with 16 px text. */
  size?: FieldSize;
}

/** A text field (.ui-input). Mark errors with aria-invalid and words in a FieldError. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = "md", type = "text", className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cx("ui-input", size !== "md" && `ui-input--${size}`, className)}
      {...props}
    />
  );
});

const fieldSizing =
  typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("field-sizing", "content");

/** Grows a textarea to its text where the browser lacks CSS field-sizing (as field.js does). */
export function growTextarea(el: HTMLTextAreaElement | null): void {
  if (!el || fieldSizing) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

/** A textarea (.ui-textarea): starts at three lines and grows with its text, then scrolls. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, onInput, ...props },
  ref,
) {
  const grow = useCallback((node: HTMLTextAreaElement | null) => growTextarea(node), []);
  return (
    <textarea
      ref={composeRefs(ref, grow)}
      className={cx("ui-textarea", className)}
      onInput={(e: FormEvent<HTMLTextAreaElement>) => {
        growTextarea(e.currentTarget);
        onInput?.(e);
      }}
      {...props}
    />
  );
});

/* ---------- label ---------- */

/** shadcn's Label (.ui-label): a label on its own, beside any control. */
export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(function Label(
  { className, ...props },
  ref,
) {
  return <label ref={ref} className={cx("ui-label", className)} {...props} />;
});

export interface FieldLabelProps extends LabelHTMLAttributes<HTMLElement> {
  /** "label" (default) or "span", for the label of a group or a Select (point aria-labelledby at its id). */
  as?: "label" | "span";
}

/** The label of a Field (.ui-field-label), 8 above its control. */
export const FieldLabel = forwardRef<HTMLElement, FieldLabelProps>(function FieldLabel(
  { as = "label", className, htmlFor, ...props },
  ref,
) {
  if (as === "span")
    return <span ref={ref as Ref<HTMLSpanElement>} className={cx("ui-field-label", className)} {...props} />;
  return (
    <label
      ref={ref as Ref<HTMLLabelElement>}
      htmlFor={htmlFor}
      className={cx("ui-field-label", className)}
      {...props}
    />
  );
});

/** "Optional" beside a label: say what may be left out instead of starring what may not. */
export const FieldOptional = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>(function FieldOptional(
  { className, children, ...props },
  ref,
) {
  return (
    <span ref={ref} className={cx("ui-field-optional", className)} {...props}>
      {children ?? "Optional"}
    </span>
  );
});

/* ---------- field ---------- */

export interface FieldProps extends HTMLAttributes<HTMLDivElement> {
  /** vertical (default): label above. horizontal: label beside. responsive: horizontal once the FieldGroup is 560 wide. */
  orientation?: "vertical" | "horizontal" | "responsive";
  /** Rouge edge on the control inside. */
  invalid?: boolean;
  /** Greys the label and description. Disable the control itself too. */
  disabled?: boolean;
}

export const Field = forwardRef<HTMLDivElement, FieldProps>(function Field(
  { orientation, invalid, disabled, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      role="group"
      data-orientation={orientation}
      data-invalid={invalid ? "true" : undefined}
      data-disabled={disabled ? "true" : undefined}
      className={cx("ui-field", className)}
      {...props}
    />
  );
});

/** Label and description together, beside a control in a horizontal Field. */
export const FieldContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function FieldContent(
  { className, ...props },
  ref,
) {
  return <div ref={ref} className={cx("ui-field-content", className)} {...props} />;
});

/** A title that is not a <label> (in a choice card or a FieldContent). */
export const FieldTitle = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>(function FieldTitle(
  { className, ...props },
  ref,
) {
  return <span ref={ref} className={cx("ui-field-title", className)} {...props} />;
});

/** A control with its error under it, in the right column of a horizontal Field. */
export const FieldControl = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function FieldControl(
  { className, ...props },
  ref,
) {
  return <div ref={ref} className={cx("ui-field-control", className)} {...props} />;
});

/** Help under a field, 4 below it. Point the control's aria-describedby at its id. */
export const FieldDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  function FieldDescription({ className, ...props }, ref) {
    return <p ref={ref} className={cx("ui-field-description", className)} {...props} />;
  },
);

export interface FieldErrorProps extends HTMLAttributes<HTMLParagraphElement> {
  /** Several messages: shown as a list. */
  errors?: ReactNode[];
}

/** What is wrong, in words, after the circle-alert icon. Renders nothing when empty. */
export const FieldError = forwardRef<HTMLParagraphElement, FieldErrorProps>(function FieldError(
  { errors, className, children, ...props },
  ref,
) {
  const list = errors?.filter((e) => e !== null && e !== undefined && e !== false && e !== "") ?? [];
  const body =
    children ??
    (list.length > 1 ? (
      <ul>
        {list.map((e, i) => (
          <li key={i}>{e}</li>
        ))}
      </ul>
    ) : (
      list[0]
    ));
  if (body === undefined || body === null || body === false || body === "") return null;
  return (
    <p ref={ref} role="alert" className={cx("ui-field-error", className)} {...props}>
      <Icon name="circle-alert" />
      <span>{body}</span>
    </p>
  );
});

/** A description or error and a FieldCount on one line under the field. */
export const FieldFoot = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function FieldFoot(
  { className, ...props },
  ref,
) {
  return <div ref={ref} className={cx("ui-field-foot", className)} {...props} />;
});

export interface FieldCountProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  /** Characters typed. */
  count: number;
  /** The control's maxLength: shows "n / max" and turns Ink at 90 %. */
  max?: number;
}

/** A character count in the data face, at the end of the line. */
export const FieldCount = forwardRef<HTMLSpanElement, FieldCountProps>(function FieldCount(
  { count, max, className, ...props },
  ref,
) {
  const near = max !== undefined && max > 0 && count >= max * 0.9;
  return (
    <span
      ref={ref}
      aria-live="polite"
      data-near={near ? "" : undefined}
      className={cx("ui-field-count", className)}
      {...props}
    >
      {max ? `${count} / ${max}` : String(count)}
    </span>
  );
});

/** Fields 24 apart; field sets 32 apart. The container for responsive Fields. */
export const FieldGroup = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function FieldGroup(
  { className, ...props },
  ref,
) {
  return <div ref={ref} className={cx("ui-field-group", className)} {...props} />;
});

/** A <fieldset> of fields with a FieldLegend. */
export const FieldSet = forwardRef<HTMLFieldSetElement, FieldsetHTMLAttributes<HTMLFieldSetElement>>(function FieldSet(
  { className, ...props },
  ref,
) {
  return <fieldset ref={ref} className={cx("ui-field-set", className)} {...props} />;
});

export interface FieldLegendProps extends HTMLAttributes<HTMLLegendElement> {
  /** "legend" (default, 16 px) or "label" (14 px, a label's size). */
  variant?: "legend" | "label";
}

export const FieldLegend = forwardRef<HTMLLegendElement, FieldLegendProps>(function FieldLegend(
  { variant = "legend", className, ...props },
  ref,
) {
  return (
    <legend
      ref={ref}
      data-variant={variant === "label" ? "label" : undefined}
      className={cx("ui-field-legend", className)}
      {...props}
    />
  );
});

/** Space between fields, with words when there are any ("or"). Never a line. */
export const FieldSeparator = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function FieldSeparator(
  { className, children, ...props },
  ref,
) {
  return (
    <div ref={ref} role={children ? undefined : "none"} className={cx("ui-field-separator", className)} {...props}>
      {children}
    </div>
  );
});

/* ---------- file input ---------- */

function formatSize(bytes: number): string {
  return bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`;
}

export interface FileInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "size" | "placeholder" | "value"
> {
  /** What to choose, shown until a creative is chosen: "Add an image the Engine should follow". */
  placeholder: string;
  /** Icon at the start. Default "paperclip" until chosen, then "image". */
  icon?: IconName;
  /** The action pill's words before a choice. Default "Browse". */
  actionLabel?: string;
  /** The action pill's words after a choice. Default "Replace". */
  replaceLabel?: string;
  /** Called with the chosen files. */
  onFilesChange?: (files: File[]) => void;
}

/** The creative upload field (.ui-input-file): the real <input type="file"> lies invisibly over a field-shaped
 *  row; the chosen creative's name and size (data) replace the placeholder. Label it with a FieldLabel htmlFor. */
export const FileInput = forwardRef<HTMLInputElement, FileInputProps>(function FileInput(
  { placeholder, icon, actionLabel = "Browse", replaceLabel = "Replace", onFilesChange, onChange, className, ...props },
  ref,
) {
  const [files, setFiles] = useState<File[]>([]);
  const chosen = files.length > 0;
  const name = !chosen ? placeholder : files.length === 1 ? files[0].name : `${files.length} creatives`;
  const total = files.reduce((s, f) => s + f.size, 0);
  return (
    <label className={cx("ui-input-file", className)}>
      <Icon name={icon ?? (chosen ? "image" : "paperclip")} />
      <span className="ui-input-file-name" data-placeholder={chosen ? undefined : ""}>
        {name}
      </span>
      <span className="ui-input-file-meta">{chosen ? formatSize(total) : ""}</span>
      <span className="ui-input-file-action" aria-hidden="true">
        {chosen ? replaceLabel : actionLabel}
      </span>
      <input
        ref={ref}
        type="file"
        className="ui-input-file-control"
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const list = Array.from(e.currentTarget.files ?? []);
          setFiles(list);
          onFilesChange?.(list);
          onChange?.(e);
        }}
        {...props}
      />
    </label>
  );
});

/* ---------- choice cards ---------- */

/** A row of choice cards that turns into side-by-side cards once there is room. role="group", label it. */
export const FieldChoices = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function FieldChoices(
  { className, ...props },
  ref,
) {
  return <div ref={ref} role="group" className={cx("ui-field-choices", className)} {...props} />;
});

export interface FieldChoiceProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size" | "title"> {
  /** checkbox (default, choose several) or radio (choose one; give them one name). */
  type?: "checkbox" | "radio";
  /** The card's title: "Feed". */
  title: ReactNode;
  /** Its detail, in the data face: "1080 × 1350". */
  description?: ReactNode;
  /** The format's shape, as an aspect ratio: "4 / 5". Leave out for no shape. */
  ratio?: string;
  /** The shape is taller than wide (fits the height). */
  tall?: boolean;
}

/** A choice card: a white field with the shape of a format, chosen with the Ink ring and the Ink check. */
export const FieldChoice = forwardRef<HTMLInputElement, FieldChoiceProps>(function FieldChoice(
  { type = "checkbox", title, description, ratio, tall = false, className, ...props },
  ref,
) {
  return (
    <label className={cx("ui-field-choice", className)}>
      <input ref={ref} type={type} className="ui-field-choice-input" {...props} />
      {ratio ? (
        <span
          className="ui-field-choice-media"
          data-tall={tall ? "" : undefined}
          style={{ "--ratio": ratio } as CSSProperties}
        />
      ) : null}
      <span className="ui-field-content">
        <span className="ui-field-title">{title}</span>
        {description !== undefined ? <span className="ui-field-description">{description}</span> : null}
      </span>
      <span className="ui-field-choice-mark" aria-hidden="true">
        <Icon name="check" />
      </span>
    </label>
  );
});
