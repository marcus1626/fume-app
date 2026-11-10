// Editing a book in place (FLOWS §34.3, PROPOSED). Marcus, 9 Nov: the Tone of Voice felt like "click to open edit",
// static and cold. Now every line of words is the field itself: click it, write, and it is kept when you leave it.
// - Fume's people edit a draft directly: each line saves as they leave it, with Undo in the toast. On the newest
//   version when no draft is open, the first edit starts the next version, a draft the expert checks.
// - The customer's owner or approver edits the version she reads the same way; her lines wait on the page, marked hers,
//   until she sends them: Fume writes the next version with them, the expert checks it, and she approves it.
// - A line someone changed keeps a quiet mark (a dotted underline), and says who changed it and what it said before.
// - In a list, "Add" puts a new line at its end; an emptied line, or its ×, takes the line out.
// The look is book-edit.css.
// Round 15 (PROPOSED 9 Nov 2026): where Fume's people edit directly, a line carries the Engine's two small buttons after
// it, on hover and focus (always on a touch screen): Write with Engine, whose words come under the line to keep (saved
// as if she wrote them) or drop, and Ask about this, the Engine panel with the line as context (engine/field.tsx). A
// customer never has them. `engine={false}` leaves them off a line.
import { Button, cx, Icon } from "@fume/ui";
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ElementType,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { useParams } from "react-router-dom";
import { useSession } from "../../api/hooks";
import type { BookEdit, BookEditMark } from "../../contract";
import { useEngineField } from "../engine/field";

export type EditMode = "direct" | "suggest" | "read";

interface EditContext {
  mode: EditMode;
  marks: BookEditMark[];
  /** One line changed: the new words (null takes a list's item out). */
  commit: (edit: BookEdit, label: string) => void;
  /** Who a mark names, for its title: "you", "Anna". */
  who: (id: string) => string;
}

const Ctx = createContext<EditContext>({ mode: "read", marks: [], commit: () => {}, who: () => "Someone" });

export const EditProvider = Ctx.Provider;
export const useEditMode = () => useContext(Ctx).mode;
/** Round 15 (PROPOSED 9 Nov 2026): the whole context, for a book's blocks (blocks.tsx): put in, moved, taken out. */
export const useBookEdit = () => useContext(Ctx);

/** The title a changed line carries: who changed it, and what it said before. */
function markTitle(mark: BookEditMark | undefined, who: (id: string) => string): string | undefined {
  if (!mark) return undefined;
  const name = who(mark.by);
  const by = name === "you" ? "You" : name;
  return mark.from === null ? `${by} added this line.` : `${by} changed this line. It said: “${mark.from}”`;
}

/** One line of words that is its own field. In a book no one may edit here, the words alone. */
export function Editable({
  path,
  value,
  label,
  as: As = "span",
  className,
  lang,
  autoFocus,
  onEmpty,
  onCancel,
  onDone,
  engine,
}: {
  path: string;
  value: string;
  /** What the line is, for a screen reader: "Who we are", "Headline example 2". */
  label: string;
  as?: ElementType;
  className?: string;
  lang?: string;
  autoFocus?: boolean;
  /** Left empty: a list takes the line out (or drops a new one); anywhere else the words come back. */
  onEmpty?: () => void;
  /** Escape on a new line: it goes. */
  onCancel?: () => void;
  /** The line was kept (a new line's row closes then). */
  onDone?: () => void;
  /** The Engine's buttons by the line, where Fume's people edit directly (Round 15): on unless false; `where` names
   *  the book for the Engine panel ("LYSNE’s Tone of Voice"). */
  engine?: false | { where?: string };
}) {
  const { mode, marks, commit, who } = useContext(Ctx);
  const ref = useRef<HTMLElement>(null);
  const mark = marks.find((m) => m.path === path);
  const session = useSession().data;
  const { workspaceId = session?.workspace.id ?? "" } = useParams();
  const brandName = session?.workspaces.find((w) => w.id === workspaceId)?.brandName ?? "The brand";
  const withEngine = useEngineField({
    field: { kind: "book_line", workspaceId, path, label, value },
    where: (engine && engine.where) || `${brandName}’s brand book`,
    enabled: mode === "direct" && engine !== false && Boolean(value),
    onKeep: (text) => commit({ path, to: text }, label),
  });

  // The words live in the element, not in React's children, so writing never fights a render.
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.textContent !== value) el.textContent = value;
  }, [value, mode]);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  if (mode === "read")
    return (
      <As className={className} lang={lang} data-edited={mark ? "" : undefined} title={markTitle(mark, who)}>
        {value}
      </As>
    );

  function leave(e: FocusEvent<HTMLElement>) {
    const text = (e.currentTarget.textContent ?? "").replace(/\s+/g, " ").trim();
    if (text === value) return;
    if (!text) {
      if (onEmpty) onEmpty();
      else e.currentTarget.textContent = value;
      return;
    }
    e.currentTarget.textContent = text;
    commit({ path, to: text }, label);
    onDone?.();
  }
  function keys(e: KeyboardEvent<HTMLElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.textContent = value;
      if (onCancel) onCancel();
      e.currentTarget.blur();
    }
  }
  const field = (
    <As
      ref={ref}
      className={cx(className, "ui-edit")}
      lang={lang}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      role="textbox"
      aria-label={label}
      spellCheck
      data-edited={mark ? "" : undefined}
      data-mode={mode}
      title={markTitle(mark, who)}
      onBlur={leave}
      onKeyDown={keys}
    />
  );
  // The wrapper stays while the line is edited, even before it has words: swapping it in when the first words land
  // would mount a new field and leave the typed words beside it (a new Tone of Voice block read its line twice).
  if (mode !== "direct" || engine === false) return field;
  return (
    <span className="ui-engine-field">
      {field}
      {withEngine.tools}
      {withEngine.suggestion}
    </span>
  );
}

/** A list of lines, each its own field, with Add at its end. */
export function EditList({
  path,
  items,
  label,
  className = "ui-voice-list",
  lang,
}: {
  path: string;
  items: string[];
  /** The list's name, singular: "Belief", "Must". */
  label: string;
  className?: string;
  lang?: string;
}) {
  const { mode, commit } = useContext(Ctx);
  const [adding, setAdding] = useState(false);
  if (mode === "read")
    return (
      <ul className={className}>
        {items.map((t, i) => (
          <li key={`${i}-${t}`}>
            <Editable path={`${path}.${i}`} value={t} label={`${label} ${i + 1}`} lang={lang} />
          </li>
        ))}
      </ul>
    );
  return (
    <ul className={cx(className, "ui-edit-list")}>
      {items.map((t, i) => (
        <li key={`${i}-${t}`} className="ui-edit-item">
          <Editable
            path={`${path}.${i}`}
            value={t}
            label={`${label} ${i + 1}`}
            lang={lang}
            onEmpty={() => commit({ path: `${path}.${i}`, to: null }, `${label} ${i + 1}`)}
          />
          <button
            type="button"
            className="ui-edit-remove"
            aria-label={`Take out ${label.toLowerCase()} ${i + 1}`}
            onClick={() => commit({ path: `${path}.${i}`, to: null }, `${label} ${i + 1}`)}
          >
            <Icon name="x" />
          </button>
        </li>
      ))}
      {adding ? (
        <li className="ui-edit-item">
          <Editable
            path={`${path}.${items.length}`}
            value=""
            label={`New ${label.toLowerCase()}`}
            lang={lang}
            autoFocus
            onDone={() => setAdding(false)}
            onEmpty={() => setAdding(false)}
            onCancel={() => setAdding(false)}
          />
        </li>
      ) : (
        <li className="ui-edit-add-row">
          <AddButton label={label} onClick={() => setAdding(true)} />
        </li>
      )}
    </ul>
  );
}

/** Words as chips: × takes one out, and a new one is written at the end. */
export function EditWords({
  path,
  items,
  label,
  avoid,
}: {
  path: string;
  items: string[];
  label: string;
  avoid?: boolean;
}) {
  const { mode, marks, commit, who } = useContext(Ctx);
  const [adding, setAdding] = useState(false);
  return (
    <p className="ui-voice-chips ui-edit-words" data-avoid={avoid ? "" : undefined}>
      {items.map((w, i) => {
        const mark = marks.find((m) => m.path === `${path}.${i}`);
        return (
          <span
            key={`${i}-${w}`}
            className={cx("ui-badge ui-edit-word", !avoid && "ui-badge--secondary")}
            data-edited={mark ? "" : undefined}
            title={markTitle(mark, who)}
          >
            {w}
            {mode !== "read" && (
              <button
                type="button"
                className="ui-edit-word-x"
                aria-label={`Take out “${w}”`}
                onClick={() => commit({ path: `${path}.${i}`, to: null }, label)}
              >
                <Icon name="x" />
              </button>
            )}
          </span>
        );
      })}
      {mode !== "read" &&
        (adding ? (
          <Editable
            path={`${path}.${items.length}`}
            value=""
            label={`New ${label.toLowerCase()}`}
            className={cx("ui-badge ui-edit-word", !avoid && "ui-badge--secondary")}
            autoFocus
            onDone={() => setAdding(false)}
            onEmpty={() => setAdding(false)}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <AddButton label="word" onClick={() => setAdding(true)} />
        ))}
    </p>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button size="sm" variant="quiet" icon="plus" className="ui-edit-add" onClick={onClick}>
      Add {label === "word" ? "a word" : "a line"}
    </Button>
  );
}
