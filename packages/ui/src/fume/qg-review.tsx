// Quality Gate review: Anna's screen (design-system/components/qg-review.css, behaviour from qg-review.js).
// DECIDED 13 Oct, round 8. Composable parts inside QgScreen:
//   <QgScreen state reviewer checkedAt notesCount onMarkChecked onRequestChanges onUndo onPrev onNext onAddNote>
//     <QgBar …/>                      back, the creative's name, the format switch, previous · 3 of 12 · next
//     <QgStage src format notes …/>   the creative large in its well, Anna's numbered pins, the seal
//     <QgPanel title meta summary>    the Brand DNA checklist (a glass sheet on a phone)
//       <QgChecklist><QgCheckRow …/></QgChecklist> <QgNotes>…</QgNotes> <QgCompose/>
//     </QgPanel>                      the decision (QgDecision) and the keys sit at its foot
//   </QgScreen>
// Keys while focus is in the screen and not in a field: C marks it checked, R requests changes, the arrows move to
// the previous and next creative. Pressing the creative pins a new note there and moves focus to the note field;
// Enter adds the note, Escape takes the pin away. A pin and its note light up together.
// Words (rule expert-checks): "In check" while it waits, "Checked · Anna" on the seal, "Checked by Anna at 14:32."
// as the outcome, and the action is "Mark checked". Never "approve" for the expert: only the customer approves.
// The toast after a decision ("Checked. Maja can approve it now.") is the screen's, with the overlays' Toast.
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { cx } from "../cx";
import { Icon, type IconName } from "../icons";
import { Avatar, Btn, Kbd, Seg, formatAttrs, vars, type CreativeFormat, type PersonSign } from "./_parts";

/** Contract CheckState. waiting, in_check and held show the decision; checked and changes_requested the outcome. */
export type QgState = "waiting" | "in_check" | "held" | "checked" | "changes_requested";

type Phase = "waiting" | "approved" | "changes";
const phaseOf = (s: QgState): Phase => (s === "checked" ? "approved" : s === "changes_requested" ? "changes" : "waiting");

export interface QgDraft {
  /** 0–1 from the left. */
  x: number;
  /** 0–1 from the top. */
  y: number;
  /** The number the new pin gets. */
  number: number;
}

interface QgContextValue {
  phase: Phase;
  reviewer: string;
  checkedAt?: string;
  notesCount: number;
  draft: QgDraft | null;
  setDraft: (d: QgDraft | null) => void;
  active: number | null;
  setActive: (n: number | null) => void;
  snap: "peek" | "full";
  openSheet: (open?: boolean) => void;
  hint: string | null;
  noteField: RefObject<HTMLInputElement>;
  nextButton: RefObject<HTMLButtonElement>;
  checkButton: RefObject<HTMLButtonElement>;
  rootRef: RefObject<HTMLDivElement>;
  markChecked: () => void;
  requestChanges: () => void;
  undo: () => void;
  prev: () => void;
  next: () => void;
  addNote: (text: string) => void;
}

const QgContext = createContext<QgContextValue | null>(null);
function useQg(): QgContextValue {
  const c = useContext(QgContext);
  if (!c) throw new Error("Quality Gate parts go inside <QgScreen>.");
  return c;
}

export interface QgNoteInput {
  text: string;
  /** Where the pin sits (0–1), when the note was pinned to the creative. */
  x?: number;
  y?: number;
  /** The pin's number, when pinned. */
  number?: number;
}

export interface QgScreenProps extends HTMLAttributes<HTMLDivElement> {
  /** The check's state (contract Check.state). */
  state: QgState;
  /** The expert's name: "Anna". */
  reviewer: string;
  /** When she marked it checked, as shown ("14:32"). */
  checkedAt?: string;
  /** How many notes the creative has (pinned and unpinned): Request changes needs one. */
  notesCount: number;
  /** aria-label of the screen: "Quality Gate, creative 3 of 12". */
  label: string;
  /** Mark checked (C). The screen sets state="checked" and checkedAt, and shows the toast. */
  onMarkChecked: () => void;
  /** Request changes (R), only with at least one note. */
  onRequestChanges: () => void;
  /** Undo the decision. */
  onUndo?: () => void;
  /** Arrow left / previous. */
  onPrev?: () => void;
  /** Arrow right / next, and "Next creative" after a decision. */
  onNext?: () => void;
  /** A note Anna wrote; pinned when she pressed the creative first. */
  onAddNote?: (note: QgNoteInput) => void;
  children: ReactNode;
}

/** div.ui-qg > div.ui-qg-screen[data-state]: the screen, its keys and the shared state of its parts. */
export const QgScreen = forwardRef<HTMLDivElement, QgScreenProps>(function QgScreen(
  { state, reviewer, checkedAt, notesCount, label, onMarkChecked, onRequestChanges, onUndo, onPrev, onNext, onAddNote, className, children, ...props },
  ref,
) {
  const phase = phaseOf(state);
  const rootRef = useRef<HTMLDivElement>(null);
  const noteField = useRef<HTMLInputElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const checkButton = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState<QgDraft | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [snap, setSnap] = useState<"peek" | "full">("peek");
  const [hint, setHint] = useState<string | null>(null);

  const openSheet = useCallback((open?: boolean) => setSnap((s) => (open === undefined ? (s === "full" ? "peek" : "full") : open ? "full" : "peek")), []);
  const focus = (el: HTMLElement | null) => el?.focus({ preventScroll: true });

  const markChecked = useCallback(() => {
    if (phase === "waiting") onMarkChecked();
  }, [phase, onMarkChecked]);
  const requestChanges = useCallback(() => {
    if (phase !== "waiting") return;
    if (!notesCount) {
      setHint("Add a note first, so the Engine knows what to change.");
      setSnap("full");
      requestAnimationFrame(() => focus(noteField.current));
      return;
    }
    onRequestChanges();
  }, [phase, notesCount, onRequestChanges]);
  const undo = useCallback(() => {
    if (phase !== "waiting") onUndo?.();
  }, [phase, onUndo]);
  const prev = useCallback(() => {
    setDraft(null);
    onPrev?.();
  }, [onPrev]);
  const next = useCallback(() => {
    setDraft(null);
    onNext?.();
  }, [onNext]);
  const addNote = useCallback(
    (text: string) => {
      const t = text.trim();
      if (!t) return;
      onAddNote?.(draft ? { text: t, x: draft.x, y: draft.y, number: draft.number } : { text: t });
      setDraft(null);
      setHint(null);
    },
    [draft, onAddNote],
  );

  // after a decision focus goes to Next creative; after undo, back to Mark checked
  const lastPhase = useRef(phase);
  useEffect(() => {
    if (lastPhase.current === phase) return;
    const from = lastPhase.current;
    lastPhase.current = phase;
    if (phase !== "waiting") requestAnimationFrame(() => focus(nextButton.current));
    else if (from !== "waiting") requestAnimationFrame(() => focus(checkButton.current));
  }, [phase]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    props.onKeyDown?.(e);
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target as HTMLElement;
    if (t.closest(".ui-qg-format")) return; // the format switch keeps its own arrows
    if (t.closest("input, textarea, select, [contenteditable='true']")) return; // the note field handles its keys
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === "c") {
      e.preventDefault();
      markChecked();
    } else if (k === "r") {
      e.preventDefault();
      requestChanges();
    } else if (k === "ArrowRight") {
      e.preventDefault();
      next();
    } else if (k === "ArrowLeft") {
      e.preventDefault();
      prev();
    } else if (k === "Escape" && draft) {
      e.preventDefault();
      setDraft(null);
    }
  };

  const value = useMemo<QgContextValue>(
    () => ({ phase, reviewer, checkedAt, notesCount, draft, setDraft, active, setActive, snap, openSheet, hint, noteField, nextButton, checkButton, rootRef, markChecked, requestChanges, undo, prev, next, addNote }),
    [phase, reviewer, checkedAt, notesCount, draft, active, snap, openSheet, hint, markChecked, requestChanges, undo, prev, next, addNote],
  );

  return (
    <QgContext.Provider value={value}>
      <div ref={ref} className={cx("ui-qg", className)} {...props} onKeyDown={onKeyDown}>
        <div ref={rootRef} className="ui-qg-screen" data-state={phase} tabIndex={-1} aria-label={label}>
          {children}
        </div>
      </div>
    </QgContext.Provider>
  );
});

// ---------- bar ----------

export interface QgFormatOption {
  value: CreativeFormat;
  label: string;
  /** "1080 × 1350": shown in the caption when chosen. */
  size?: string;
}

export interface QgBarProps extends HTMLAttributes<HTMLElement> {
  /** "Creative 3". */
  title: string;
  /** The campaign, before "Quality Gate" ("Autumn launch"); hidden on a phone. */
  campaign?: string;
  /** "Quality Gate". */
  eyebrow?: string;
  onBack?: () => void;
  backLabel?: string;
  /** The format switch: Feed, Story, Banner (and Square). */
  formats?: QgFormatOption[];
  format?: CreativeFormat;
  onFormatChange?: (format: CreativeFormat) => void;
  /** 1-based position and the total: "3 of 12" (data). */
  index: number;
  total: number;
}

/** header.ui-qg-bar. Previous and next call QgScreen's onPrev and onNext. */
export function QgBar({ title, campaign, eyebrow = "Quality Gate", onBack, backLabel, formats, format, onFormatChange, index, total, className, ...props }: QgBarProps) {
  const qg = useQg();
  return (
    <header className={cx("ui-qg-bar", className)} {...props}>
      {onBack && <Btn variant="quiet" iconOnly icon="chevron-left" aria-label={backLabel ?? (campaign ? `Back to ${campaign}` : "Back")} onClick={onBack} />}
      <div className="ui-qg-title">
        <span className="ui-qg-eyebrow">
          {campaign && <span className="ui-qg-crumb">{campaign} · </span>}
          {eyebrow}
        </span>
        <h3 className="ui-qg-name">{title}</h3>
      </div>
      {formats && formats.length > 0 && format && onFormatChange && (
        <div className="ui-qg-format">
          <Seg
            label="Format"
            value={format}
            onChange={onFormatChange}
            options={formats.map((f) => ({ value: f.value, label: f.label, data: { format: f.value, ...(f.size ? { size: f.size } : {}) } }))}
          />
        </div>
      )}
      <div className="ui-qg-nav">
        <Btn variant="quiet" iconOnly icon="chevron-left" aria-label="Previous creative" onClick={qg.prev} />
        <span className="ui-qg-count" aria-live="polite">
          {index} of {total}
        </span>
        <Btn variant="quiet" iconOnly icon="chevron-right" aria-label="Next creative" onClick={qg.next} />
      </div>
    </header>
  );
}

// ---------- stage ----------

export interface QgPin {
  number: number;
  /** 0–1 from the left (contract CheckNote.x). */
  x: number;
  /** 0–1 from the top. */
  y: number;
  /** The note's words, for the pin's label. */
  text?: string;
}

export interface QgStageProps extends HTMLAttributes<HTMLDivElement> {
  src: string;
  alt: string;
  format: CreativeFormat;
  /** Anna's pinned notes. */
  pins?: QgPin[];
  /** Under the creative, at the start: "Engine run 214 · Brief v2". */
  caption?: ReactNode;
  /** Under the creative, at the end, as data: "1080 × 1350". */
  size?: string;
}

/** div.ui-qg-stage > figure.ui-qg-creative: the well, the creative, the pins and the seal. Press it to pin a note. */
export function QgStage({ src, alt, format, pins = [], caption, size, className, ...props }: QgStageProps) {
  const qg = useQg();
  const [changing, setChanging] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setChanging(true);
  }, [src, format]);

  // the Amber triangle lands once, from blur to sharp, when Anna marks it checked
  const [landing, setLanding] = useState(false);
  const lastPhase = useRef(qg.phase);
  useEffect(() => {
    if (lastPhase.current !== "approved" && qg.phase === "approved") {
      setLanding(true);
      const t = window.setTimeout(() => setLanding(false), 900);
      lastPhase.current = qg.phase;
      return () => window.clearTimeout(t);
    }
    lastPhase.current = qg.phase;
  }, [qg.phase]);

  // a new creative drops the draft pin
  useEffect(() => {
    qg.setDraft(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  const press = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest(".ui-qg-pin") || qg.phase !== "waiting") return;
    const b = e.currentTarget.getBoundingClientRect();
    const x = Math.max(4, Math.min(92, ((e.clientX - b.left) / b.width) * 100)) / 100;
    const y = Math.max(10, Math.min(98, ((e.clientY - b.top) / b.height) * 100)) / 100;
    qg.setDraft({ x, y, number: qg.draft?.number ?? pins.length + 1 });
    qg.openSheet(true);
    requestAnimationFrame(() => qg.noteField.current?.focus({ preventScroll: true }));
  };

  const openPin = (n: number) => {
    qg.openSheet(true);
    qg.setActive(n);
    requestAnimationFrame(() => qg.rootRef.current?.querySelector<HTMLElement>(`.ui-qg-row[data-pin="${n}"]`)?.focus());
  };

  const check = qg.phase;
  const fa = formatAttrs(format);
  return (
    <div className={cx("ui-qg-stage", className)} {...props}>
      <figure className="ui-qg-creative" {...fa}>
        <div className={cx("ui-qg-media", changing && "is-changing")} onClick={press}>
          <img key={src + format} src={src} alt={alt} />
          {pins.map((p) => (
            <button
              key={p.number}
              className={cx("ui-qg-pin", qg.active === p.number && "is-active")}
              type="button"
              data-pin={p.number}
              style={vars({ "--x": `${(p.x * 100).toFixed(1)}%`, "--y": `${(p.y * 100).toFixed(1)}%` })}
              aria-label={p.text ? `Note ${p.number}: ${p.text}` : `Note ${p.number}`}
              onClick={() => openPin(p.number)}
              onPointerEnter={() => qg.setActive(p.number)}
              onPointerLeave={() => qg.setActive(null)}
              onFocus={() => qg.setActive(p.number)}
              onBlur={() => qg.setActive(null)}
            >
              {p.number}
            </button>
          ))}
          {qg.draft && (
            <button
              className="ui-qg-pin is-new"
              type="button"
              data-state="draft"
              data-pin={qg.draft.number}
              style={vars({ "--x": `${(qg.draft.x * 100).toFixed(1)}%`, "--y": `${(qg.draft.y * 100).toFixed(1)}%` })}
              aria-label={`Note ${qg.draft.number}, not written yet`}
              onClick={() => qg.noteField.current?.focus()}
            >
              {qg.draft.number}
            </button>
          )}
          <span className={cx("ui-qg-seal", landing && "is-landing")} data-check={check}>
            <Icon name="fume-check" />
            <span className="ui-qg-seal-text">{check === "approved" ? `Checked · ${qg.reviewer}` : check === "changes" ? "Changes requested" : "In check"}</span>
            <time className="ui-qg-seal-time">{check === "approved" ? qg.checkedAt ?? "" : ""}</time>
          </span>
        </div>
        {(caption || size) && (
          <figcaption className="ui-qg-caption">
            <span>{caption}</span>
            {size && <span className="ui-qg-caption-size">{size}</span>}
          </figcaption>
        )}
      </figure>
    </div>
  );
}

// ---------- panel ----------

export interface QgPanelProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  /** "Brand DNA check". */
  title: string;
  /** Facts under the title: QgMetaItem (hidden on a phone). */
  meta?: ReactNode;
  /** One line on a phone, in the peek: "3 of 4 pass, 1 note from Anna". */
  summary?: ReactNode;
  /** The decision at the foot; QgDecision by default. */
  decision?: ReactNode;
  /** The keys line (C, R, arrows) under the decision. */
  keys?: boolean;
  /** The checklist, the notes and the compose field. */
  children: ReactNode;
}

/** aside.ui-qg-sheet[data-snap]: the checklist and the decision; on a phone a glass sheet with a handle. */
export function QgPanel({ title, meta, summary, decision, keys = true, className, children, ...props }: QgPanelProps) {
  const qg = useQg();
  const sheet = useRef<HTMLElement>(null);
  const [top, setTop] = useState<number | null>(null);
  useEffect(() => {
    if (qg.snap !== "full") return;
    const root = qg.rootRef.current, bar = root?.querySelector(".ui-qg-bar");
    if (root && bar) setTop(Math.round(bar.getBoundingClientRect().bottom - root.getBoundingClientRect().top));
  }, [qg.snap, qg.rootRef]);
  const full = qg.snap === "full";
  return (
    <aside
      ref={sheet}
      className={cx("ui-qg-sheet", className)}
      data-snap={qg.snap}
      aria-label={title}
      {...props}
      style={{ ...props.style, ...(full && top !== null ? vars({ "--qg-top": `${top}px` }) : null) }}
    >
      <button className="ui-qg-handle" type="button" aria-expanded={full} aria-label={full ? "Show less" : "Show the whole checklist"} onClick={() => qg.openSheet()} />
      <div className="ui-qg-head">
        <h4 className="ui-qg-sheet-title">{title}</h4>
        {meta && <div className="ui-qg-meta">{meta}</div>}
        {summary && <p className="ui-qg-summary">{summary}</p>}
      </div>
      <div className="ui-qg-more">{children}</div>
      {decision ?? <QgDecision />}
      {keys && (
        <p className="ui-qg-keys">
          <span>
            <Kbd>C</Kbd>mark checked
          </span>
          <span>
            <Kbd>R</Kbd>request changes
          </span>
          <span>
            <span className="ui-kbd-group">
              <Kbd label="Left arrow">
                <Icon name="arrow-left" />
              </Kbd>
              <Kbd label="Right arrow">
                <Icon name="arrow-right" />
              </Kbd>
            </span>
            move
          </span>
        </p>
      )}
    </aside>
  );
}

/** span.ui-qg-meta-item: an icon and a fact ("Run 214", "Brief v2", "Sent 14:02"); put data in `data`. */
export function QgMetaItem({ icon, children, data }: { icon: IconName; children: ReactNode; data?: string }) {
  return (
    <span className="ui-qg-meta-item">
      <Icon name={icon} />
      {children}
      {data && (
        <>
          {" "}
          <span className="ui-qg-meta-data">{data}</span>
        </>
      )}
    </span>
  );
}

export interface QgChecklistProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  /** "Against LYSNE’s Brand DNA". */
  title: string;
  /** "3 / 4" (data). */
  count?: string;
  children: ReactNode;
}

/** section.ui-qg-section > ul.ui-qg-list: the Brand DNA checklist. Children: QgCheckRow. */
export function QgChecklist({ title, count, className, children, ...props }: QgChecklistProps) {
  return (
    <section className={cx("ui-qg-section", className)} aria-label={title} {...props}>
      <div className="ui-qg-section-head">
        <span>{title}</span>
        {count && <span className="ui-qg-section-count">{count}</span>}
      </div>
      <ul className="ui-qg-list">{children}</ul>
    </section>
  );
}

export interface QgCheckRowProps {
  /** Contract CheckItem.result: pass = the Ink check; note = her note on a surface step; pending = not yet. */
  result: "pass" | "note" | "pending";
  /** "Logo clear space". */
  title?: string;
  /** What it was checked against, or the note's words. */
  text: ReactNode;
  /** The pin the note belongs to (its number); a note without a pin shows the message-square. */
  pin?: number;
  /** Who wrote the note, and when (data). */
  by?: PersonSign;
  time?: string;
}

/** li > div|button.ui-qg-row[data-result]: one checklist row. A note row lights its pin and the pin lights it. */
export function QgCheckRow({ result, title, text, pin, by, time }: QgCheckRowProps) {
  const qg = useQg();
  if (result !== "note")
    return (
      <li>
        <div className="ui-qg-row" data-result={result}>
          {result === "pass" && (
            <span className="ui-qg-mark" aria-hidden="true">
              <Icon name="check" />
            </span>
          )}
          {title && <span className="ui-qg-row-title">{title}</span>}
          <span className="ui-qg-row-text">{text}</span>
        </div>
      </li>
    );
  const on = pin !== undefined && qg.active === pin;
  return (
    <li>
      <button
        className={cx("ui-qg-row", on && "is-active")}
        type="button"
        data-result="note"
        data-pin={pin}
        onClick={() => pin !== undefined && qg.setActive(pin)}
        onPointerEnter={() => pin !== undefined && qg.setActive(pin)}
        onPointerLeave={() => pin !== undefined && qg.setActive(null)}
        onFocus={() => pin !== undefined && qg.setActive(pin)}
        onBlur={() => pin !== undefined && qg.setActive(null)}
      >
        <span className={cx("ui-qg-mark ui-qg-mark--note", on && "is-active")} aria-hidden="true">
          {pin !== undefined ? pin : <Icon name="message-square" />}
        </span>
        {title && <span className="ui-qg-row-title">{title}</span>}
        <span className="ui-qg-row-text">{text}</span>
        {by && (
          <span className="ui-qg-by">
            <Avatar person={{ ink: true, ...by }} size="sm" />
            <span>{by.name}</span>
            {time && <time className="ui-qg-by-time">{time}</time>}
          </span>
        )}
      </button>
    </li>
  );
}

/** ol.ui-qg-notes: notes Anna added that belong to no checklist row. Children: QgCheckRow result="note". */
export function QgNotes({ children, label = "Notes" }: { children?: ReactNode; label?: string }) {
  const empty = !children || (Array.isArray(children) && children.length === 0);
  return (
    <ol className="ui-qg-notes" aria-label={label} hidden={empty}>
      {children}
    </ol>
  );
}

export interface QgComposeProps {
  label?: string;
  placeholder?: string;
  hint?: string;
  addLabel?: string;
}

/** div.ui-qg-compose: the note field. Enter adds, Escape takes the draft pin away. */
export function QgCompose({ label = "Add a note", placeholder = "What should the Engine change?", hint = "Press the creative to pin the note to a spot.", addLabel = "Add" }: QgComposeProps) {
  const qg = useQg();
  const id = useId();
  const [text, setText] = useState("");
  const add = () => {
    if (!text.trim()) return;
    qg.addNote(text);
    setText("");
  };
  return (
    <div className="ui-qg-compose">
      <label className="ui-qg-compose-label" htmlFor={id}>
        {qg.draft ? `Note ${qg.draft.number}, pinned to the creative` : label}
      </label>
      <div className="ui-qg-compose-row">
        <input
          ref={qg.noteField}
          className="ui-input"
          id={id}
          type="text"
          placeholder={placeholder}
          autoComplete="off"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            } else if (e.key === "Escape" && qg.draft) {
              e.preventDefault();
              qg.setDraft(null);
            }
          }}
        />
        <Btn variant="secondary" onClick={add}>
          {addLabel}
        </Btn>
      </div>
      <p className="ui-qg-compose-hint">{qg.hint ?? hint}</p>
    </div>
  );
}

export interface QgDecisionProps {
  changesLabel?: string;
  checkLabel?: string;
  undoLabel?: string;
  nextLabel?: string;
  /** The outcome line; defaults to "Checked by Anna at 14:32." or "Sent back to the Engine with 2 notes." */
  outcome?: string;
}

/** div.ui-qg-decision--waiting (Request changes R, Mark checked C) and div.ui-qg-decision--done (outcome, Undo, Next). */
export function QgDecision({ changesLabel = "Request changes", checkLabel = "Mark checked", undoLabel = "Undo", nextLabel = "Next creative", outcome }: QgDecisionProps) {
  const qg = useQg();
  const n = Math.max(1, qg.notesCount);
  const words =
    outcome ??
    (qg.phase === "approved"
      ? `Checked by ${qg.reviewer}${qg.checkedAt ? ` at ${qg.checkedAt}` : ""}.`
      : qg.phase === "changes"
        ? `Sent back to the Engine with ${n} ${n === 1 ? "note" : "notes"}.`
        : "");
  return (
    <>
      <div className="ui-qg-decision ui-qg-decision--waiting">
        <Btn variant="secondary" onClick={qg.requestChanges}>
          {changesLabel}
          <Kbd className="ui-qg-key">R</Kbd>
        </Btn>
        <Btn ref={qg.checkButton} variant="primary" icon="check" onClick={qg.markChecked}>
          {checkLabel}
          <Kbd className="ui-qg-key">C</Kbd>
        </Btn>
      </div>
      <div className="ui-qg-decision ui-qg-decision--done">
        <p className="ui-qg-outcome" aria-live="polite">
          {words}
        </p>
        <Btn variant="quiet" icon="undo-2" onClick={qg.undo}>
          {undoLabel}
        </Btn>
        <Btn ref={qg.nextButton} variant="primary" iconEnd="arrow-right" onClick={qg.next}>
          {nextLabel}
        </Btn>
      </div>
    </>
  );
}

/** The seal on its own (In check, Checked · Anna 14:32, Changes requested), e.g. on a crop in a list. */
export function QgSeal({ state, by, time }: { state: QgState; by?: string; time?: string }) {
  const p = phaseOf(state);
  return (
    <span className="ui-qg-seal" data-check={p}>
      <Icon name="fume-check" />
      <span className="ui-qg-seal-text">{p === "approved" ? `Checked · ${by ?? ""}` : p === "changes" ? "Changes requested" : "In check"}</span>
      <time className="ui-qg-seal-time">{p === "approved" ? time ?? "" : ""}</time>
    </span>
  );
}
