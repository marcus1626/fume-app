// The brief form's tools (FLOWS §26.2):
// - Templates: "Start from" at the top of the form. Fume's own (Product launch, Seasonal, Black Friday, Always-on
//   social, Email) and hers, which Fume made from her past campaigns ("Like Autumn launch"). Picking one fills the
//   form; she changes anything after.
// - Alternatives: Fume writes three alternatives for the message, or for the whole brief (goal, audience and message).
//   She picks one, or says what to change ("Warmer", "Shorter", her own words) and gets three new ones. It is the
//   Engine's writing, said in Fume's voice: the Engine never talks to customers.
// - Inspiration: pictures she adds, pictures from her boards and links to pages she likes. The pictures start the
//   campaign's moodboard; the links go to Fume with the brief.
import {
  Button,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  useToast,
} from "@fume/ui";
import { useState, type KeyboardEvent } from "react";
import { useBriefAlternatives, useBriefTemplates } from "../../api/hooks";
import type { BriefTemplate } from "../../contract";
import { MoodboardPicker, type MoodboardDraft } from "../boards/StartMoodboard";

// ─── Templates ──────────────────────────────────────────────────────────────

export function TemplatePicker({ value, onPick }: { value: string; onPick: (t: BriefTemplate) => void }) {
  const templates = useBriefTemplates();
  const list = templates.data ?? [];
  const fume = list.filter((t) => t.kind === "fume");
  const yours = list.filter((t) => t.kind === "yours");
  const picked = list.find((t) => t.id === value);
  return (
    <Field className="ui-brief-template">
      <FieldLabel as="span" id="brief-template-label">
        Start from
      </FieldLabel>
      <Select
        value={value || undefined}
        onValueChange={(id) => {
          const t = list.find((x) => x.id === id);
          if (t) onPick(t);
        }}
        disabled={!list.length}
      >
        <SelectTrigger
          id="brief-template"
          aria-labelledby="brief-template-label"
          aria-describedby="brief-template-help"
        >
          <SelectValue placeholder="A blank brief" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Fume templates</SelectLabel>
            {fume.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectGroup>
          {yours.length > 0 && (
            <SelectGroup>
              <SelectLabel>Your templates</SelectLabel>
              {yours.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>
      <FieldDescription id="brief-template-help">
        {picked
          ? `${picked.description} Change anything below.`
          : yours.length
            ? "Fume’s templates, and yours: Fume made them from your past campaigns."
            : "Fume’s templates fill the form; change anything after."}
      </FieldDescription>
    </Field>
  );
}

// ─── Alternatives ───────────────────────────────────────────────────────────

export interface BriefWords {
  goal: string;
  audience: string;
  message: string;
}

const NUDGES = ["Warmer", "Shorter", "Bolder"] as const;

/** "Alternatives" and, once open, three alternatives under the field: pick one, or say what to change and get new ones. */
export function Alternatives({
  part,
  now,
  productIds,
  onPick,
  label,
}: {
  part: "message" | "brief";
  /** The brief as it stands, so the alternatives start from her words. */
  now: BriefWords;
  productIds: string[];
  onPick: (b: BriefWords) => void;
  /** The button's words. */
  label: string;
}) {
  const alt = useBriefAlternatives();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);
  const [feedback, setFeedback] = useState("");
  const what = part === "message" ? "the message" : "the brief";
  const ask = (nextRound: number, words = feedback) => {
    setRound(nextRound);
    alt.mutate(
      {
        part,
        goal: now.goal,
        audience: now.audience,
        message: now.message,
        productIds,
        feedback: words.trim() || undefined,
        round: nextRound,
      },
      { onError: (e) => toast.error("No alternatives this time", { description: e.message }) },
    );
  };
  const start = () => {
    setOpen(true);
    ask(0, "");
  };
  const close = () => {
    setOpen(false);
    setFeedback("");
  };
  const nudge = (word: string) => {
    const words = feedback.toLowerCase().includes(word.toLowerCase())
      ? feedback
      : [feedback.trim(), word.toLowerCase()].filter(Boolean).join(", ");
    setFeedback(words);
    ask(round + 1, words);
  };
  const keys = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      e.stopPropagation();
      ask(round + 1);
    }
  };
  if (!open)
    return (
      <Button
        type="button"
        variant={part === "brief" ? "secondary" : "quiet"}
        size="sm"
        icon="fume-engine"
        onClick={start}
        aria-label={`${label}: three alternatives for ${what}`}
      >
        {label}
      </Button>
    );
  const options = alt.data ?? [];
  return (
    <div
      className="ui-brief-alts"
      role="group"
      aria-label={`Three alternatives for ${what}`}
      aria-busy={alt.isPending || undefined}
    >
      <div className="ui-brief-alts-head">
        <p className="ui-brief-alts-title">Three alternatives for {what}</p>
        <Button
          type="button"
          variant="quiet"
          size="sm"
          iconOnly
          icon="x"
          aria-label="Close the alternatives"
          onClick={close}
        />
      </div>
      <ul className="ui-brief-alts-list">
        {alt.isPending && !options.length
          ? [0, 1, 2].map((i) => <li key={i} className="ui-brief-alt" data-loading="" aria-hidden="true" />)
          : options.map((o, i) => (
              <li key={`${round}-${i}`} className="ui-brief-alt" data-stale={alt.isPending || undefined}>
                <div className="ui-brief-alt-text">
                  {part === "brief" ? (
                    <>
                      <p className="ui-brief-alt-main">{o.goal}</p>
                      <p className="ui-brief-alt-sub">For {o.audience.charAt(0).toLowerCase() + o.audience.slice(1)}</p>
                      <p className="ui-brief-alt-sub">“{o.message}”</p>
                    </>
                  ) : (
                    <p className="ui-brief-alt-main">“{o.message}”</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon="check"
                  disabled={alt.isPending}
                  aria-label={`Use alternative ${i + 1}`}
                  onClick={() => {
                    onPick(o);
                    close();
                  }}
                >
                  Use this
                </Button>
              </li>
            ))}
      </ul>
      <div className="ui-brief-alts-again">
        <div className="ui-brief-alts-nudges" role="group" aria-label="Make them">
          {NUDGES.map((n) => (
            <Button
              key={n}
              type="button"
              variant="secondary"
              size="sm"
              disabled={alt.isPending}
              onClick={() => nudge(n)}
            >
              {n}
            </Button>
          ))}
        </div>
        <div className="ui-brief-alts-say">
          <Input
            size="sm"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            onKeyDown={keys}
            placeholder="Or say what to change"
            aria-label={`What to change in the alternatives for ${what}`}
            autoComplete="off"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon="refresh-cw"
            loading={alt.isPending}
            onClick={() => ask(round + 1)}
          >
            New alternatives
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Inspiration ────────────────────────────────────────────────────────────

export interface Inspiration {
  pictures: MoodboardDraft;
  links: string[];
}

const linkOf = (text: string) => {
  const t = text.trim();
  if (!t) return undefined;
  try {
    return new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`).toString();
  } catch {
    return undefined;
  }
};

/** Pictures (her own and from her boards) and links: the pictures start the campaign's moodboard. */
export function InspirationPicker({ value, onChange }: { value: Inspiration; onChange: (next: Inspiration) => void }) {
  const [link, setLink] = useState("");
  const [bad, setBad] = useState(false);
  const add = () => {
    const url = linkOf(link);
    if (!url) return setBad(true);
    setBad(false);
    setLink("");
    if (!value.links.includes(url)) onChange({ ...value, links: [...value.links, url] });
  };
  return (
    <div className="ui-app-stack">
      <FieldDescription>
        Pictures and pages that show the feeling you want. The pictures start the campaign’s moodboard; Fume reads the
        links with the brief.
      </FieldDescription>
      <MoodboardPicker
        value={value.pictures}
        onChange={(pictures) => onChange({ ...value, pictures })}
        legend="From your boards"
        optional
      />
      <Field invalid={bad}>
        <FieldLabel htmlFor="brief-link">Links</FieldLabel>
        <div className="ui-brief-link-add">
          <Input
            id="brief-link"
            type="url"
            inputMode="url"
            value={link}
            onChange={(e) => {
              setLink(e.target.value);
              setBad(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                e.stopPropagation();
                add();
              }
            }}
            placeholder="Paste a link to a picture, a post or a page"
            aria-describedby={bad ? "brief-link-error" : undefined}
            autoComplete="off"
          />
          <Button type="button" variant="secondary" icon="link" onClick={add}>
            Add
          </Button>
        </div>
        <FieldError id="brief-link-error">{bad ? "That doesn’t look like a link." : undefined}</FieldError>
        {value.links.length > 0 && (
          <ul className="ui-brief-links" aria-label="Your links">
            {value.links.map((l) => (
              <li key={l} className="ui-brief-link">
                <a href={l} target="_blank" rel="noreferrer" className="ui-link">
                  {l.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                </a>
                <Button
                  type="button"
                  variant="quiet"
                  size="sm"
                  iconOnly
                  icon="x"
                  aria-label={`Remove ${l}`}
                  onClick={() => onChange({ ...value, links: value.links.filter((x) => x !== l) })}
                />
              </li>
            ))}
          </ul>
        )}
      </Field>
    </div>
  );
}
