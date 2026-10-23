// The plan document's parts (design-system/components/plan.css): a line's source tag, a line with Change in place,
// a master as a row with a placeholder in its own ratio, what follows the masters, a direction Fume also considered,
// the steps. Words (FLOWS §22, round 10 brief): "Change" edits a line in place (Esc cancels, ⌘↵ saves); a line she
// changed says "Changed by you"; "Use this direction" takes another direction; "Fume's pick" names the one Fume
// recommends.
// Round 12 (UX review DLAY-10, DLOAD-9, DWAY-18, DLOAD-17; PROPOSED 20 Oct 2026): set like a spec, not like prose. A line
// is one row: its label with its one quiet source under it, the value, what it rests on, and Change as a pencil that
// shows on the row's hover and keyboard focus (always on a touch screen), not fifteen pills at rest. A master is a
// compact row with a small placeholder in its ratio. What follows the masters is a table of one line each; two that
// would be the same creative are one row, "2 ×". A direction Fume also considered is one row: two pictures, its name,
// its idea, "Use this direction". Change puts the caret at the end of the words; Save, Cancel and Esc give the focus
// back to the pencil that opened it.
// Round 13 (Marcus's comments #26, #28, #67; PROPOSED 22 Oct 2026): a creative can have its own look ("Own look": its
// light, the light's direction, its camera) beside the plan's look, which still holds for every other creative; Change
// edits it in place. A creative Fume changed as she asked says "Changed by Fume". A step the expert checks carries the
// Focus pointer (Amber once checked).
import { Button, Field, FieldLabel, Icon, Input, Textarea, submitOnModEnter, useToast } from "@fume/ui";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { Link } from "react-router-dom";
import { useChangePlan } from "../../api/hooks";
import type {
  CampaignPlan,
  CreativeLook,
  PlanDirection,
  PlanLine,
  PlannedCreative,
  PlanSource,
  Product,
} from "../../contract";
import type { PlanPeople } from "./people";
import { formatWord, plannedName, sourceIcon } from "./words";

// ─── The source of a line ───────────────────────────────────────────────────

/** "Your Brand DNA" with its icon; `to` makes it a link (a Brand DNA rule opens the brand's rules). */
export function SourceTag({ source, label, to }: { source: PlanSource; label: string; to?: string }) {
  const inner = (
    <>
      <Icon name={sourceIcon[source]} />
      {label}
    </>
  );
  return to ? (
    <Link to={to} className="ui-plandoc-source ui-link" data-source={source}>
      {inner}
    </Link>
  ) : (
    <span className="ui-plandoc-source" data-source={source}>
      {inner}
    </span>
  );
}

/** Esc leaves the field as it was, ⌘↵ saves it: the keys of every change in place on the plan. */
function editKeys(onCancel: () => void) {
  return (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key === "Escape" && !e.defaultPrevented) {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
      return;
    }
    submitOnModEnter(e);
  };
}

function EditActions({ busy, onCancel }: { busy: boolean; onCancel: () => void }) {
  // Save is a secondary pill: the plan's one Ink stays its footer's decision.
  return (
    <div className="ui-plandoc-edit-actions">
      <Button type="submit" variant="secondary" size="sm" icon="check" loading={busy}>
        Save
      </Button>
      <Button type="button" variant="quiet" size="sm" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

/** The caret after the last word (DWAY-18): a change adds to the line more often than it starts it again. */
function useCaretAtEnd<T extends HTMLTextAreaElement | HTMLInputElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    const end = el.value.length;
    el.setSelectionRange(end, end);
  }, []);
  return ref;
}

/** A change in place: open, and once it closes (saved, cancelled, Esc) the focus goes back to the pencil that opened it. */
function useEditing() {
  const [editing, setEditing] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const done = () => {
    setEditing(false);
    window.requestAnimationFrame(() => opener.current?.focus());
  };
  return { editing, open: () => setEditing(true), done, opener };
}

/** The pencil: on the row's hover and keyboard focus on a desk, always on a touch screen (plan.css). */
function ChangePencil({
  label,
  onClick,
  opener,
}: {
  label: string;
  onClick: () => void;
  opener: RefObject<HTMLButtonElement>;
}) {
  return (
    <Button
      ref={opener}
      className="ui-plandoc-change"
      variant="quiet"
      size="sm"
      iconOnly
      icon="pencil"
      aria-label={label}
      onClick={onClick}
    />
  );
}

// ─── A line: label and its source, the value and what it rests on, Change in place ──────────

/** The why without the source it starts with: the tag beside it already says "Your Brand DNA". */
const whyOf = (why: string) => {
  const rest = why.replace(/^(Your (Brand DNA|brief|taste|moodboard|voice)|Product Truth):\s*/, "");
  return rest.charAt(0).toUpperCase() + rest.slice(1);
};

export function LineRow({
  line,
  campaignId,
  editable,
  tag,
  voice = (t) => t,
  note,
}: {
  line: PlanLine;
  campaignId: string;
  editable: boolean;
  tag: ReactNode;
  /** The plan's sentences as this reader says them (words.ts voiceFor). */
  voice?: (text: string) => string;
  /** A line under the value that asks something of her (a product that waits to be confirmed). */
  note?: ReactNode;
}) {
  const { editing, open, done, opener } = useEditing();
  const id = useId();
  const why = line.why && !line.changedBy ? voice(whyOf(line.why)) : undefined;
  return (
    <li className="ui-plandoc-line" data-changed={line.changedBy ? "" : undefined}>
      <div className="ui-plandoc-line-head">
        <span className="ui-plandoc-line-label" id={`${id}-label`}>
          {line.label}
        </span>
        {tag}
      </div>
      <div className="ui-plandoc-line-body">
        {editing ? (
          <LineEdit line={line} campaignId={campaignId} labelId={`${id}-label`} onDone={done} />
        ) : (
          <>
            <p className="ui-plandoc-line-value">{voice(line.value)}</p>
            {why && <p className="ui-plandoc-line-why">{why}</p>}
            {note}
          </>
        )}
      </div>
      {editable && !editing && (
        <ChangePencil opener={opener} label={`Change the ${line.label.toLowerCase()}`} onClick={open} />
      )}
    </li>
  );
}

function LineEdit({
  line,
  campaignId,
  labelId,
  onDone,
}: {
  line: PlanLine;
  campaignId: string;
  labelId: string;
  onDone: () => void;
}) {
  const [text, setText] = useState(line.value);
  const change = useChangePlan();
  const toast = useToast();
  const field = useCaretAtEnd<HTMLTextAreaElement>();
  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    if (text.trim() === line.value) return onDone();
    change.mutate(
      { campaignId, line: line.key, value: text.trim() },
      {
        onSuccess: () => {
          toast.done(`${line.label} changed`, { description: "Every creative keeps to the new line." });
          onDone();
        },
        onError: (err) => toast.error(`${line.label} wasn’t changed`, { description: err.message }),
      },
    );
  };
  return (
    <form className="ui-plandoc-edit" onSubmit={save} onKeyDown={editKeys(onDone)}>
      <Textarea ref={field} aria-labelledby={labelId} value={text} rows={3} onChange={(e) => setText(e.target.value)} />
      <EditActions busy={change.isPending} onCancel={onDone} />
    </form>
  );
}

// ─── The creatives ──────────────────────────────────────────────────────────

const langOf = (language?: string) =>
  ({ Norwegian: "nb", Swedish: "sv", Danish: "da", English: "en", German: "de" })[language ?? ""] ?? undefined;

/** One master before it exists, as a compact row: a small placeholder in its own ratio with the product's packshot in
 *  the middle (never a fake finished picture), its one name with its format, the scene, the words on it, the people,
 *  and Change in place. */
export function MasterCard({
  creative,
  products,
  campaignId,
  language,
  editable,
  people,
  voice = (t) => t,
}: {
  creative: PlannedCreative;
  products: Product[];
  campaignId: string;
  language?: string;
  editable: boolean;
  people: PlanPeople;
  voice?: (text: string) => string;
}) {
  const { editing, open, done, opener } = useEditing();
  const shown = creative.productIds
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is Product => Boolean(p));
  const productWords = shown.map((p) => p.name).join(" and ");
  return (
    <li className="ui-plandoc-master" data-changed={creative.changedBy ? "" : undefined}>
      <div
        className="ui-plandoc-stage"
        role="img"
        aria-label={`Not made yet: ${formatWord(creative.format)}${productWords ? ` with ${productWords}` : ""}`}
      >
        <div className="ui-plandoc-frame" data-format={creative.format}>
          <span className="ui-plandoc-frame-products" aria-hidden="true">
            {shown
              .slice(0, 2)
              .map((p) => (p.images[0] ? <img key={p.id} src={p.images[0]} alt="" loading="lazy" /> : null))}
          </span>
        </div>
      </div>
      <div className="ui-plandoc-master-text">
        <p className="ui-plandoc-master-name">{plannedName(creative)}</p>
        {editing ? (
          <CreativeEdit creative={creative} campaignId={campaignId} onDone={done} />
        ) : (
          <>
            <p className="ui-plandoc-scene">{voice(creative.scene)}</p>
            <p className="ui-plandoc-master-meta">
              {creative.text && (
                <span className="ui-plandoc-words" lang={langOf(language)}>
                  “{creative.text.replace(/^[“"]|[”"]$/g, "")}”
                </span>
              )}
              <span className="ui-plandoc-people">
                <Icon name="user" />
                {creative.people}
              </span>
              {creative.changedBy && <ChangedTag by={creative.changedBy} people={people} />}
            </p>
            <OwnLook look={creative.look} voice={voice} />
          </>
        )}
      </div>
      {editable && !editing && <ChangePencil opener={opener} label={`Change ${creative.name}`} onClick={open} />}
    </li>
  );
}

/** "Changed by you", "Changed by Anna", "Changed by Fume" (a change she asked Fume for, round 13). */
export function ChangedTag({ by, people }: { by: string; people: PlanPeople }) {
  return by === "fume" ? (
    <SourceTag source="fume" label="Changed by Fume" />
  ) : (
    <SourceTag source="you" label={`Changed by ${people.name(by)}`} />
  );
}

const LOOK_PARTS = [
  ["light", "Light"],
  ["direction", "Light direction"],
  ["camera", "Camera"],
] as const;

const hasLook = (look?: CreativeLook | null) => Boolean(look && LOOK_PARTS.some(([k]) => look[k]?.trim()));

/** A creative's own look (#26): what differs from the plan's look for this one creative. Nothing when it has none. */
export function OwnLook({ look, voice = (t) => t }: { look?: CreativeLook; voice?: (text: string) => string }) {
  if (!look || !hasLook(look)) return null;
  return (
    <dl className="ui-plandoc-own-look" aria-label="Its own look">
      <dt className="ui-plandoc-own-look-title">Own look</dt>
      {LOOK_PARTS.filter(([k]) => look[k]?.trim()).map(([k, label]) => (
        <dd key={k}>
          <span className="ui-plandoc-own-look-label">{label}</span> {voice(look[k]!.trim())}
        </dd>
      ))}
    </dl>
  );
}

function CreativeEdit({
  creative,
  campaignId,
  onDone,
}: {
  creative: PlannedCreative;
  campaignId: string;
  onDone: () => void;
}) {
  const id = useId();
  const [scene, setScene] = useState(creative.scene);
  const [text, setText] = useState(creative.text ?? "");
  const [look, setLook] = useState<CreativeLook>({ ...creative.look });
  const change = useChangePlan();
  const toast = useToast();
  const field = useCaretAtEnd<HTMLTextAreaElement>();
  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!scene.trim()) return;
    change.mutate(
      {
        campaignId,
        creativeId: creative.id,
        creative: { scene: scene.trim(), text: text.trim() || undefined },
        // its own look (#26): empty takes it back to the plan's look
        ...(hasLook(look)
          ? {
              look: {
                light: look.light?.trim() || undefined,
                direction: look.direction?.trim() || undefined,
                camera: look.camera?.trim() || undefined,
              },
            }
          : creative.look
            ? { look: null }
            : {}),
      },
      {
        onSuccess: () => {
          toast.done(`${creative.name} changed`);
          onDone();
        },
        onError: (err) => toast.error(`${creative.name} wasn’t changed`, { description: err.message }),
      },
    );
  };
  return (
    <form className="ui-plandoc-edit" onSubmit={save} onKeyDown={editKeys(onDone)}>
      <Field>
        <FieldLabel htmlFor={`${id}-scene`}>The scene</FieldLabel>
        <Textarea ref={field} id={`${id}-scene`} value={scene} rows={3} onChange={(e) => setScene(e.target.value)} />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-words`}>The words on it</FieldLabel>
        <Input id={`${id}-words`} value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
      <fieldset className="ui-plandoc-look-fields">
        <legend className="ui-plandoc-look-legend">Own look, for this creative only</legend>
        {LOOK_PARTS.map(([k, label]) => (
          <Field key={k}>
            <FieldLabel htmlFor={`${id}-${k}`}>{label}</FieldLabel>
            <Input
              id={`${id}-${k}`}
              value={look[k] ?? ""}
              placeholder="As the look"
              onChange={(e) => setLook((l) => ({ ...l, [k]: e.target.value }))}
            />
          </Field>
        ))}
      </fieldset>
      <EditActions busy={change.isPending} onCancel={onDone} />
    </form>
  );
}

/** The variants and formats as a table of one line each: the creative's one name, the master it comes from, what changes
 *  and its words when they differ. Two that would be the same creative (the same master, format, scene and words) are
 *  one row, "2 ×" (DLOAD-17). */
export function FollowList({
  masters,
  variants,
  language,
  voice = (t) => t,
}: {
  masters: PlannedCreative[];
  variants: PlannedCreative[];
  language?: string;
  voice?: (text: string) => string;
}) {
  const rows: { v: PlannedCreative; n: number }[] = [];
  for (const v of variants) {
    const same = rows.find(
      (r) =>
        r.v.of === v.of &&
        r.v.format === v.format &&
        r.v.scene === v.scene &&
        r.v.text === v.text &&
        !hasLook(r.v.look) &&
        !hasLook(v.look),
    );
    if (same) same.n++;
    else rows.push({ v, n: 1 });
  }
  const masterOf = (id?: string) => masters.find((m) => m.id === id);
  return (
    <ul className="ui-plandoc-follows" aria-label="What follows the masters">
      {rows.map(({ v, n }) => {
        const master = masterOf(v.of);
        return (
          <li key={v.id} className="ui-plandoc-follow">
            <span className="ui-plandoc-follow-name">
              {n > 1 && <span className="ui-plandoc-follow-count">{n} × </span>}
              {plannedName(v)}
            </span>
            {/* "from Master 1", unless its name already says so ("Master 1 · Story 9:16") */}
            <span className="ui-plandoc-follow-from">
              {master && !plannedName(v).startsWith(`${master.name} `) ? `from ${master.name}` : ""}
            </span>
            <span className="ui-plandoc-follow-what">
              {voice(v.scene)}
              {v.text && v.text !== master?.text && (
                <>
                  {" "}
                  <span className="ui-plandoc-follow-words" lang={langOf(language)}>
                    “{v.text}”
                  </span>
                </>
              )}
              <OwnLook look={v.look} voice={voice} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ─── A direction Fume also considered ───────────────────────────────────────

export function ConsideredCard({
  direction,
  onUse,
  busy,
  voice = (t) => t,
}: {
  direction: PlanDirection;
  onUse?: () => void;
  busy?: boolean;
  voice?: (text: string) => string;
}) {
  return (
    <li className="ui-plandoc-alt">
      <div className="ui-plandoc-alt-pictures">
        {direction.references.slice(0, 2).map((r) => (
          <img key={r.image} src={r.image} alt={voice(r.caption)} loading="lazy" />
        ))}
      </div>
      <div className="ui-plandoc-alt-text">
        <p className="ui-plandoc-alt-name">
          {direction.letter} · {direction.name}
          {direction.recommended && <span className="ui-plandoc-alt-pick">Fume’s pick</span>}
        </p>
        <p className="ui-plandoc-alt-idea">{voice(direction.idea)}</p>
      </div>
      {onUse && (
        <Button
          variant="secondary"
          size="sm"
          loading={busy}
          aria-label={`Use this direction, ${direction.letter} ${direction.name}`}
          onClick={onUse}
        >
          Use this direction
        </Button>
      )}
    </li>
  );
}

// ─── When ───────────────────────────────────────────────────────────────────

export interface Step {
  label: string;
  /** A date, or words where there is none ("once you approve"). */
  when?: string;
  time?: string;
  state: "done" | "now" | "ahead";
  /** The expert checks this step (round 13, #28): the Focus pointer, Amber once checked. */
  check?: boolean;
}

export function Steps({ steps, label }: { steps: Step[]; label: string }) {
  return (
    <ol className="ui-plandoc-when" aria-label={label}>
      {steps.map((s, i) => (
        <li
          key={i}
          className="ui-plandoc-step"
          data-state={s.state}
          aria-current={s.state === "now" ? "step" : undefined}
        >
          <span className="ui-plandoc-step-dot" aria-hidden="true" />
          <span className="ui-plandoc-step-label">
            {s.check && (
              <span
                className="ui-creative-check ui-plandoc-step-check"
                data-check={s.state === "done" ? "approved" : "waiting"}
              >
                <Icon name="fume-check" />
              </span>
            )}
            {s.label}
          </span>
          {s.time ? (
            <time className="ui-plandoc-step-time" dateTime={s.time}>
              {s.when}
            </time>
          ) : (
            s.when && <span className="ui-plandoc-step-words">{s.when}</span>
          )}
        </li>
      ))}
    </ol>
  );
}

/** The plan's version as its meta, "version 2". */
export const versionWords = (plan: Pick<CampaignPlan, "version">) => `version ${plan.version}`;
