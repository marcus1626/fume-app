// The brand's voice, in five parts:
//   - Identity: who we are, what we believe, the personality.
//   - How we speak: tone traits with a do and a don't each, words we use and avoid, sentences, formality, languages.
//   - Rules: what every line must and must never do, and the claims the brand may make.
//   - Audience: who we write for and what they care about.
//   - Examples: good lines, in the brand's languages.
// The onboarding shows what Fume found for each part on one card with Confirm · Change, so it stays quick to get
// through. Brand › Voice (/brand/voice) is the whole voice, a section per part. The look is r13-brand.css.
// Round 14 (FLOWS §34.3, PROPOSED): a version of the Tone of Voice reads as a book in three groups, Voice, Copy and
// This version, with its index on the left; copy has its own big group (headlines, calls to action, channels, on
// brand against off brand, and Try a line), and every line is edited in place (edit.tsx, book-edit.css).
import {
  Badge,
  Button,
  cx,
  DataList,
  DataListItem,
  Field,
  FieldDescription,
  FieldLabel,
  Icon,
  NativeSelect,
  Textarea,
  useToast,
} from "@fume/ui";
import { useId, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { useBrandBoard, useCheckCopyLine, useDecideVoicePart } from "../../api/hooks";
import type { VoiceBook, VoiceChannel, VoicePartId } from "../../contract";
import { Query } from "../../shell/Page";
import { BookFrame, NoBook, type BookIndexGroup } from "./books";
import { Editable, EditList, EditWords } from "./edit";
import { ProvenanceTag } from "./decide";
import { useRole, useViewer } from "./parts";

export const voiceParts: VoicePartId[] = ["identity", "speak", "rules", "audience", "examples"];

export const voicePartTitle: Record<VoicePartId, string> = {
  identity: "Identity",
  speak: "How we speak",
  rules: "Rules",
  audience: "Audience",
  examples: "Examples",
};

export const voicePartLine: Record<VoicePartId, string> = {
  identity: "Who we are, what we believe, our personality.",
  speak: "Tone, the words we use and avoid, sentences and formality.",
  rules: "What every line must and must never do, and the claims we may make.",
  audience: "Who we write for, and what they care about.",
  examples: "Lines that sound like us.",
};

const languageWord = { no: "Norsk", en: "English" } as const;

/** Up to four short chips of what Fume found in a part, for the onboarding's card. */
function chipsOf(book: VoiceBook, id: VoicePartId): string[] {
  if (id === "identity") return book.identity.personality;
  if (id === "speak") return book.speak.traits.map((t) => t.trait);
  if (id === "rules")
    return [
      `${book.rules.must.length} musts`,
      `${book.rules.never.length} nevers`,
      `${book.rules.claims.length} claims`,
    ];
  if (id === "audience") return book.audience.cares.slice(0, 4);
  return [];
}

/** Change for a part: she says in words what is off, and Fume redoes the part from it. */
function VoiceChange({ part, onDone }: { part: VoicePartId; onDone: (saved: boolean) => void }) {
  const decide = useDecideVoicePart();
  const toast = useToast();
  const id = useId();
  const [text, setText] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      await decide.mutateAsync({ part, verdict: "change", note: text.trim() });
      toast.done(`${voicePartTitle[part]} changed`, { description: "Fume writes from your words from now on." });
      onDone(true);
    } catch (error) {
      toast.error("The change wasn’t saved", { description: error instanceof Error ? error.message : undefined });
    }
  }
  function keys(e: KeyboardEvent<HTMLElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onDone(false);
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.currentTarget.closest("form")?.requestSubmit();
    }
  }
  return (
    <form className="ui-brand-change" onSubmit={submit} aria-label={`Change ${voicePartTitle[part]}`}>
      <Field>
        <FieldLabel htmlFor={id}>What should be different?</FieldLabel>
        <Textarea
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={keys}
          rows={2}
          autoFocus
          aria-describedby={`${id}-help`}
        />
        <FieldDescription id={`${id}-help`}>In your own words. Fume rewrites the part from them.</FieldDescription>
      </Field>
      <div className="ui-brand-change-actions">
        <Button type="submit" size="sm" variant="secondary" loading={decide.isPending} disabled={!text.trim()}>
          Save the change
        </Button>
        <Button type="button" size="sm" variant="quiet" onClick={() => onDone(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** Confirm · Change for a part, or its state, and Change opening in place. */
function usePartActions(book: VoiceBook, id: VoicePartId) {
  const { canApprove } = useRole();
  const decide = useDecideVoicePart();
  const toast = useToast();
  const [changing, setChanging] = useState(false);
  const part = book.parts.find((p) => p.id === id)!;
  const proposed = part.provenance.state === "proposed";
  const confirm = () =>
    decide.mutate(
      { part: id, verdict: "keep" },
      { onError: (error) => toast.error("That wasn’t saved", { description: error.message }) },
    );
  const actions =
    canApprove && !changing ? (
      <div className="ui-proposal-actions">
        {proposed && (
          <Button
            size="sm"
            variant="secondary"
            icon="check"
            onClick={confirm}
            disabled={decide.isPending}
            aria-label={`Confirm ${voicePartTitle[id]}`}
          >
            Confirm
          </Button>
        )}
        <Button
          size="sm"
          variant="quiet"
          onClick={() => setChanging(true)}
          disabled={decide.isPending}
          aria-label={`Change ${voicePartTitle[id]}`}
        >
          Change
        </Button>
      </div>
    ) : null;
  const change = changing ? <VoiceChange part={id} onDone={() => setChanging(false)} /> : null;
  return { part, proposed, actions, change };
}

/** What she asked Fume to change in a part, until Fume has redone it. */
const NoteLine = ({ note, who }: { note?: string; who: string }) =>
  note ? (
    <p className="ui-voice-note">
      {who} asked: “{note}”
    </p>
  ) : null;

/** The onboarding's card for one part: what Fume found in one line, a few chips, where, Confirm · Change. */
export function VoicePartCard({ book, id }: { book: VoiceBook; id: VoicePartId }) {
  const a = usePartActions(book, id);
  const chips = chipsOf(book, id);
  const { canApprove } = useRole();
  return (
    <div className="ui-brand-confirm ui-voice-card" data-state={a.part.provenance.state} data-media="none">
      <div className="ui-brand-confirm-body">
        <p className="ui-brand-confirm-title">
          <span>{voicePartTitle[id]}</span>
          <span className="ui-brand-confirm-meta">
            <span className="ui-brand-caption-meta">{voicePartLine[id]}</span>
          </span>
        </p>
        <p className="ui-voice-found">{a.part.found}</p>
        {chips.length > 0 && (
          <p className="ui-voice-chips">
            {chips.map((c) => (
              <Badge key={c} variant="secondary">
                {c}
              </Badge>
            ))}
          </p>
        )}
        {id === "examples" && (
          <ul className="ui-voice-lines" data-size="small">
            {book.examples.slice(0, 2).map((e) => (
              <li key={e.line}>
                <span className="ui-voice-line-text">“{e.line}”</span>{" "}
                <span className="ui-voice-line-lang">{languageWord[e.language]}</span>
              </li>
            ))}
          </ul>
        )}
        <NoteLine note={a.part.note} who="You" />
        <p className="ui-brand-confirm-tags">
          <ProvenanceTag provenance={a.part.provenance} />
          {a.proposed && !canApprove && <span className="ui-proposal-tag">An owner or an approver confirms it</span>}
        </p>
        {a.change}
      </div>
      {a.actions && <div className="ui-brand-confirm-actions">{a.actions}</div>}
    </div>
  );
}

/** A part's section on the voice page: its title and line, where it came from, Confirm · Change, then the part. */
function PartSection({
  book,
  id,
  bare,
  level,
  children,
}: {
  book: VoiceBook;
  id: VoicePartId;
  /** In a version of the Tone of Voice: the book is approved as a whole, so a part has no Confirm · Change. */
  bare?: boolean;
  level?: 2 | 3;
  children: ReactNode;
}) {
  if (bare)
    return (
      <Section id={id} title={voicePartTitle[id]} line={voicePartLine[id]} level={level}>
        {children}
      </Section>
    );
  return (
    <DecidedPart book={book} id={id}>
      {children}
    </DecidedPart>
  );
}

/** A section of the Tone of Voice: its title, its line, then what it holds. */
function Section({
  id,
  title,
  line,
  level = 2,
  children,
}: {
  id: string;
  title: string;
  line?: string;
  /** 3 inside a book's group ("Voice", "Copy"). */
  level?: 2 | 3;
  children: ReactNode;
}) {
  const H = level === 3 ? "h3" : "h2";
  return (
    <section className="ui-voice-part" id={`voice-${id}`} aria-labelledby={`voice-${id}-title`}>
      <div className="ui-voice-part-head">
        <div className="ui-voice-part-words">
          <H className="ui-voice-part-title" id={`voice-${id}-title`}>
            {title}
          </H>
          {line && <p className="ui-voice-part-line">{line}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function DecidedPart({ book, id, children }: { book: VoiceBook; id: VoicePartId; children: ReactNode }) {
  const a = usePartActions(book, id);
  const viewer = useViewer();
  return (
    <section
      className="ui-voice-part"
      id={`voice-${id}`}
      aria-labelledby={`voice-${id}-title`}
      data-state={a.part.provenance.state}
    >
      <div className="ui-voice-part-head">
        <div className="ui-voice-part-words">
          <h2 className="ui-voice-part-title" id={`voice-${id}-title`}>
            {voicePartTitle[id]}
          </h2>
          <p className="ui-voice-part-line">{voicePartLine[id]}</p>
          <p className="ui-brand-confirm-tags">
            <ProvenanceTag provenance={a.part.provenance} />
          </p>
        </div>
        {a.actions}
      </div>
      <NoteLine note={a.part.note} who={viewer.staff ? viewer.brand : "You"} />
      {a.change}
      {children}
    </section>
  );
}

const List = ({ items }: { items: string[] }) => (
  <ul className="ui-voice-list">
    {items.map((t) => (
      <li key={t}>{t}</li>
    ))}
  </ul>
);

/** One line of the book, its own field where she may write (edit.tsx). */
const Line = ({
  path,
  value,
  label,
  className,
  quote,
  lang,
}: {
  path: string;
  value: string;
  label: string;
  className?: string;
  /** Between quotation marks: a line the brand says. */
  quote?: boolean;
  lang?: string;
}) => <Editable path={path} value={value} label={label} className={cx(className, quote && "ui-voice-q")} lang={lang} />;

/** A group of the book's parts: "Voice", "Copy", "This version", with its own line. */
function Group({ id, title, line }: { id: string; title: string; line: string }) {
  return (
    <header className="ui-book-group" id={`voice-${id}`}>
      <h2 className="ui-book-group-title">{title}</h2>
      <p className="ui-book-group-line">{line}</p>
    </header>
  );
}

/** The voice book's index on the left (FLOWS §34.3): the voice, the copy, and this version. Each part shows only
 *  when the book has it. */
export function voiceIndex(book: VoiceBook): BookIndexGroup[] {
  const has = (x?: unknown[] | object) => (Array.isArray(x) ? x.length > 0 : Boolean(x));
  const part = (id: string, label: string, here = true) => (here ? [{ id: `voice-${id}`, label }] : []);
  return [
    {
      title: "Voice",
      parts: [
        ...part("identity", "Identity"),
        ...part("speak", "How we speak"),
        ...part("scale", "Where we sit", has(book.scale)),
        ...part("rules", "Rules"),
        ...part("audience", "Audience"),
      ],
    },
    {
      title: "Copy",
      parts: [
        ...part("try", "Try a line"),
        ...part("headlines", "Headlines", has(book.headlines)),
        ...part("ctas", "Calls to action", has(book.ctas)),
        ...part("channels", "Channels", has(book.channels)),
        ...part("pairs", "On brand, off brand", has(book.pairs)),
        ...part("examples", "Examples"),
        ...part("vocabulary", "Our words", has(book.vocabulary)),
        ...part("mechanics", "Mechanics", has(book.mechanics)),
      ],
    },
    {
      title: "This version",
      parts: [
        ...part("gaps", "Still to know", has(book.gaps)),
        ...part("sources", "Where it comes from", has(book.sources)),
      ],
    },
  ];
}

/** The whole voice, a section per part. A version of the Tone of Voice reads as a book in three groups (FLOWS §34.3):
 *  the voice, the copy written from it, and this version; its lines are edited in place. */
export function VoiceBookView({ book, inBook }: { book: VoiceBook; inBook?: boolean }) {
  const lang = book.speak.languages.toLowerCase().includes("norw") ? "nb" : undefined;
  const level = inBook ? 3 : 2;
  return (
    <div className="ui-voice-book" data-book={inBook ? "" : undefined}>
      {inBook && <Group id="group-voice" title="Voice" line="Who the brand is, and how it speaks." />}
      {book.summary && (
        <Line
          path="summary"
          value={book.summary}
          label="The voice in short"
          className="ui-voice-lead ui-brandbook-summary"
        />
      )}
      <PartSection book={book} id="identity" bare={inBook} level={level}>
        <Line path="identity.who" value={book.identity.who} label="Who we are" className="ui-voice-lead" />
        <div className="ui-voice-cols">
          <div className="ui-voice-block">
            <h4 className="ui-voice-sub">What we believe</h4>
            <EditList path="identity.believe" items={book.identity.believe} label="Belief" />
          </div>
          <div className="ui-voice-block">
            <h4 className="ui-voice-sub">Personality</h4>
            <EditWords path="identity.personality" items={book.identity.personality} label="Personality" />
          </div>
        </div>
      </PartSection>

      <PartSection book={book} id="speak" bare={inBook} level={level}>
        <ul className="ui-voice-traits" aria-label="Tone">
          {book.speak.traits.map((t, i) => (
            <li key={`${i}-${t.trait}`} className="ui-voice-trait">
              <Line
                path={`speak.traits.${i}.trait`}
                value={t.trait}
                label={`Trait ${i + 1}`}
                className="ui-voice-trait-name"
              />
              <Line
                path={`speak.traits.${i}.means`}
                value={t.means}
                label={`What ${t.trait} means`}
                className="ui-voice-trait-means"
              />
              <p className="ui-voice-say" data-say="do">
                <span className="ui-voice-say-label">Do</span>
                <Line path={`speak.traits.${i}.do`} value={t.do} label={`${t.trait}: do`} quote lang={lang} />
              </p>
              <p className="ui-voice-say" data-say="dont">
                <span className="ui-voice-say-label">Don’t</span>
                <Line path={`speak.traits.${i}.dont`} value={t.dont} label={`${t.trait}: don’t`} quote lang={lang} />
              </p>
            </li>
          ))}
        </ul>
        <div className="ui-voice-cols">
          <div className="ui-voice-block">
            <h4 className="ui-voice-sub">Words we use</h4>
            <EditWords path="speak.use" items={book.speak.use} label="Word we use" />
          </div>
          <div className="ui-voice-block">
            <h4 className="ui-voice-sub">Words we avoid</h4>
            <EditWords path="speak.avoid" items={book.speak.avoid} label="Word we avoid" avoid />
          </div>
        </div>
        <DataList variant="stacked" className="ui-voice-facts">
          <DataListItem label="Sentences">
            <Line path="speak.sentences" value={book.speak.sentences} label="Sentences" />
          </DataListItem>
          <DataListItem label="Formality">
            <Line path="speak.formality" value={book.speak.formality} label="Formality" />
          </DataListItem>
          <DataListItem label="Languages">
            <Line path="speak.languages" value={book.speak.languages} label="Languages" />
          </DataListItem>
        </DataList>
      </PartSection>

      {inBook && <Scale book={book} level={level} />}

      <PartSection book={book} id="rules" bare={inBook} level={level}>
        <div className="ui-voice-cols" data-cols="3">
          <div className="ui-voice-block">
            <h4 className="ui-voice-sub">Every line must</h4>
            <EditList path="rules.must" items={book.rules.must} label="Must" />
          </div>
          <div className="ui-voice-block">
            <h4 className="ui-voice-sub">Never</h4>
            <EditList path="rules.never" items={book.rules.never} label="Never" />
          </div>
          <div className="ui-voice-block">
            <h4 className="ui-voice-sub">Claims we may make</h4>
            <EditList path="rules.claims" items={book.rules.claims} label="Claim" />
          </div>
        </div>
      </PartSection>

      <PartSection book={book} id="audience" bare={inBook} level={level}>
        <Line path="audience.who" value={book.audience.who} label="Who we write for" className="ui-voice-lead" />
        <div className="ui-voice-cols">
          <div className="ui-voice-block">
            <h4 className="ui-voice-sub">What they care about</h4>
            <EditList path="audience.cares" items={book.audience.cares} label="What they care about" />
          </div>
          <div className="ui-voice-block">
            <h4 className="ui-voice-sub">Not for</h4>
            <Line path="audience.notFor" value={book.audience.notFor} label="Not for" className="ui-voice-text" />
          </div>
        </div>
      </PartSection>

      {inBook ? (
        <>
          <Group
            id="group-copy"
            title="Copy"
            line="Every word on a creative is written from here: headlines, calls to action, each channel's words."
          />
          <TryLine book={book} level={level} />
          <Copy book={book} lang={lang} level={level} />
        </>
      ) : null}

      <PartSection book={book} id="examples" bare={inBook} level={level}>
        <ul className="ui-voice-lines">
          {book.examples.map((e, i) => (
            <li key={`${i}-${e.line}`} lang={e.language === "no" ? "nb" : "en"}>
              <Line
                path={`examples.${i}.line`}
                value={e.line}
                label={`Example ${i + 1}`}
                className="ui-voice-line-text"
                quote
              />
              <span className="ui-voice-line-meta">
                <span className="ui-voice-line-lang">{languageWord[e.language]}</span> ·{" "}
                <Line path={`examples.${i}.where`} value={e.where} label={`Where example ${i + 1} is used`} />
              </span>
            </li>
          ))}
        </ul>
      </PartSection>
      {inBook && <Words book={book} level={level} />}
      {inBook && (
        <Group
          id="group-version"
          title="This version"
          line="What Fume still needs to know, and where each part comes from."
        />
      )}
      <BookEnd gaps={book.gaps} sources={book.sources} level={level} editable />
    </div>
  );
}

const channelWord: Record<NonNullable<VoiceBook["channels"]>[number]["channel"], string> = {
  instagram_feed: "Instagram feed",
  instagram_story: "Instagram story",
  tiktok: "TikTok",
  paid_social: "Paid social",
  email: "Email",
  website: "Website",
  packaging: "Packaging",
  print: "Print",
};

const sourceWord: Record<NonNullable<VoiceBook["sources"]>[number]["source"], string> = {
  site: "The website",
  brand_dna: "Brand DNA",
  rules: "The rules",
  products: "The products",
  taste: "Taste",
  memory: "Past campaigns",
  fume: "Fume’s proposal",
  pictures: "The brand’s pictures",
};

/** Where the voice sits between two words. */
function Scale({ book, level }: { book: VoiceBook; level: 2 | 3 }) {
  if (!book.scale?.length) return null;
  return (
    <Section id="scale" title="Where we sit" line="Between two words, where the voice sits." level={level}>
      <ul className="ui-brandbook-scales">
        {book.scale.map((x) => (
          <li key={`${x.from}-${x.to}`} className="ui-brandbook-scale">
            <span className="ui-brandbook-scale-word">{x.from}</span>
            <span
              className="ui-brandbook-scale-track"
              role="img"
              aria-label={`${x.at} of 5, from ${x.from} to ${x.to}`}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} className="ui-brandbook-scale-step" data-at={n === x.at ? "" : undefined} />
              ))}
            </span>
            <span className="ui-brandbook-scale-word" data-end="">
              {x.to}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** The copy the voice writes: headlines, calls to action, each channel, and on brand against off brand. */
function Copy({ book, lang, level }: { book: VoiceBook; lang?: string; level: 2 | 3 }) {
  return (
    <>
      {book.headlines && book.headlines.length > 0 && (
        <Section
          id="headlines"
          title="Headlines"
          line="Patterns to write from, each with a line in the brand’s words."
          level={level}
        >
          <ul className="ui-copy-rows">
            {book.headlines.map((h, i) => (
              <li key={`${i}-${h.pattern}`} className="ui-copy-row">
                <Line
                  path={`headlines.${i}.example`}
                  value={h.example}
                  label={`Headline ${i + 1}`}
                  className="ui-copy-headline"
                  lang={lang}
                />
                <Line
                  path={`headlines.${i}.pattern`}
                  value={h.pattern}
                  label={`Pattern of headline ${i + 1}`}
                  className="ui-copy-pattern"
                />
              </li>
            ))}
          </ul>
        </Section>
      )}
      {book.ctas && book.ctas.length > 0 && (
        <Section id="ctas" title="Calls to action" line="The words on a button, and when each is used." level={level}>
          <ul className="ui-copy-ctas">
            {book.ctas.map((c, i) => (
              <li key={`${i}-${c.cta}`} className="ui-copy-cta">
                <Line
                  path={`ctas.${i}.cta`}
                  value={c.cta}
                  label={`Call to action ${i + 1}`}
                  className="ui-copy-cta-words"
                  lang={lang}
                />
                <Line
                  path={`ctas.${i}.when`}
                  value={c.when}
                  label={`When call to action ${i + 1} is used`}
                  className="ui-copy-cta-when"
                />
              </li>
            ))}
          </ul>
        </Section>
      )}
      {book.channels && book.channels.length > 0 && (
        <Section
          id="channels"
          title="Channels"
          line="How the voice works in each place, and how long it may be."
          level={level}
        >
          <ul className="ui-brandbook-cards">
            {book.channels.map((c, i) => (
              <li key={c.channel} className="ui-voice-trait">
                <p className="ui-voice-trait-name">{channelWord[c.channel]}</p>
                <p className="ui-voice-say" lang={lang}>
                  <Line
                    path={`channels.${i}.example`}
                    value={c.example}
                    label={`${channelWord[c.channel]}: example`}
                    className="ui-copy-headline"
                    quote
                  />
                </p>
                <Line
                  path={`channels.${i}.how`}
                  value={c.how}
                  label={`${channelWord[c.channel]}: how`}
                  className="ui-voice-trait-means"
                />
                <Line
                  path={`channels.${i}.length`}
                  value={c.length}
                  label={`${channelWord[c.channel]}: length`}
                  className="ui-brandbook-length"
                />
              </li>
            ))}
          </ul>
        </Section>
      )}
      {book.pairs && book.pairs.length > 0 && (
        <Section
          id="pairs"
          title="On brand, off brand"
          line="The same thing said two ways, and why one is ours."
          level={level}
        >
          <ul className="ui-brandbook-pairs">
            {book.pairs.map((x, i) => (
              <li key={`${i}-${x.good}`} className="ui-brandbook-pair">
                <p className="ui-voice-say" lang={lang}>
                  <span className="ui-voice-say-label">On brand</span>
                  <Line path={`pairs.${i}.good`} value={x.good} label={`On brand ${i + 1}`} quote />
                </p>
                <p className="ui-voice-say" data-say="dont" lang={lang}>
                  <span className="ui-voice-say-label">Off brand</span>
                  <Line path={`pairs.${i}.bad`} value={x.bad} label={`Off brand ${i + 1}`} quote />
                </p>
                <Line
                  path={`pairs.${i}.why`}
                  value={x.why}
                  label={`Why, pair ${i + 1}`}
                  className="ui-voice-trait-means"
                />
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}

/** The brand's own words and its mechanics: casing, punctuation, numbers and names. */
function Words({ book, level }: { book: VoiceBook; level: 2 | 3 }) {
  const m = book.mechanics;
  return (
    <>
      {book.vocabulary && book.vocabulary.length > 0 && (
        <Section id="vocabulary" title="Our words" line="The brand’s own words, and how to use them." level={level}>
          <DataList variant="stacked" className="ui-voice-facts">
            {book.vocabulary.map((v, i) => (
              <DataListItem key={v.word} label={v.word}>
                <Line path={`vocabulary.${i}.use`} value={v.use} label={`How to use ${v.word}`} />
              </DataListItem>
            ))}
          </DataList>
        </Section>
      )}
      {m && (
        <Section id="mechanics" title="Mechanics" line="Casing, punctuation, numbers and names." level={level}>
          <DataList variant="stacked" className="ui-voice-facts">
            {(["casing", "punctuation", "numbers", "emoji", "names"] as const).map((k) => (
              <DataListItem key={k} label={cap(k)}>
                <Line path={`mechanics.${k}`} value={m[k]} label={cap(k)} />
              </DataListItem>
            ))}
          </DataList>
        </Section>
      )}
    </>
  );
}

/** Try a line (FLOWS §34.3): write a headline, a call to action or a caption, and Fume holds it against the voice, as
 *  the plan's copy check does: the words the voice avoids, a claim no fact backs, the mechanics, the channel's length.
 *  With something found, Fume's version of the line. A reading only: it changes nothing. */
function TryLine({ book, level }: { book: VoiceBook; level: 2 | 3 }) {
  const check = useCheckCopyLine();
  const toast = useToast();
  const id = useId();
  const [text, setText] = useState("");
  const [channel, setChannel] = useState<VoiceChannel | "">(book.channels?.[0]?.channel ?? "");
  const result = check.data;
  function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!text.trim()) return;
    check.mutate(
      { text: text.trim(), ...(channel ? { channel } : {}) },
      { onError: (err) => toast.error("The line wasn’t checked", { description: err.message }) },
    );
  }
  const found = result?.findings ?? [];
  return (
    <Section
      id="try"
      title="Try a line"
      line="Write a headline, a call to action or a caption. Fume holds it against this Tone of Voice."
      level={level}
    >
      <form className="ui-copylab" onSubmit={submit} aria-label="Try a line">
        <Textarea
          id={`${id}-line`}
          aria-label="A line of copy"
          rows={2}
          value={text}
          maxLength={600}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          className="ui-copylab-input"
        />
        <div className="ui-copylab-bar">
          <NativeSelect
            aria-label="Where it runs"
            value={channel}
            onChange={(e) => setChannel(e.target.value as VoiceChannel | "")}
            className="ui-copylab-channel"
          >
            <option value="">Anywhere</option>
            {(book.channels ?? []).map((c) => (
              <option key={c.channel} value={c.channel}>
                {channelWord[c.channel]}
              </option>
            ))}
          </NativeSelect>
          <Button type="submit" size="sm" variant="secondary" loading={check.isPending} disabled={!text.trim()}>
            Check the line
          </Button>
        </div>
      </form>
      {result && (
        <div className="ui-copylab-result" role="status" aria-live="polite">
          <p className="ui-copylab-verdict" data-found={found.length ? "" : undefined}>
            <Icon name={found.length ? "circle-alert" : "check"} />
            <span>
              {found.length
                ? `${found.length} ${found.length === 1 ? "thing" : "things"} against the voice`
                : "In the voice"}
            </span>
            {result.length && (
              <span className="ui-copylab-length">
                {result.length.words} of {result.length.max} words
              </span>
            )}
          </p>
          {found.length > 0 && (
            <ul className="ui-copylab-findings">
              {found.map((f) => (
                <li key={`${f.kind}-${f.words ?? f.note}`}>{f.note}</li>
              ))}
            </ul>
          )}
          {result.rewrite && (
            <div className="ui-copylab-rewrite">
              <span className="ui-voice-say-label">Fume’s version</span>
              <p className="ui-copy-headline ui-voice-q">{result.rewrite}</p>
              <div className="ui-copylab-rewrite-actions">
                <Button size="sm" variant="quiet" icon="arrow-up" onClick={() => setText(result.rewrite!)}>
                  Use it
                </Button>
              </div>
            </div>
          )}
          <p className="ui-copylab-against">Held against version {result.version} of the Tone of Voice.</p>
        </div>
      )}
    </Section>
  );
}

/** What Fume still needs to know, and where each part comes from: the end of both books. */
export function BookEnd({
  gaps,
  sources,
  level = 2,
  editable,
}: {
  gaps?: string[];
  sources?: VoiceBook["sources"];
  level?: 2 | 3;
  /** The voice's questions are lines of the book (an answer is written in their place). */
  editable?: boolean;
}) {
  return (
    <>
      {gaps && gaps.length > 0 && (
        <Section
          id="gaps"
          title="What Fume still needs to know"
          line="Questions for the brand. An answer goes into the next version."
          level={level}
        >
          {editable ? <EditList path="gaps" items={gaps} label="Question" /> : <List items={gaps} />}
        </Section>
      )}
      {sources && sources.length > 0 && (
        <Section id="sources" title="Where it comes from" level={level}>
          <DataList variant="stacked" className="ui-voice-facts">
            {sources.map((x) => (
              <DataListItem key={`${x.part}-${x.evidence}`} label={cap(x.part)}>
                {sourceWord[x.source]} · {x.evidence}
              </DataListItem>
            ))}
          </DataList>
        </Section>
      )}
    </>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Brand › Tone of Voice (/brand/voice): the version in use or the one on its way (FLOWS §30). Before Fume has written
 *  a version, the voice in five parts from the onboarding. */
export function VoicePage() {
  const viewer = useViewer();
  return (
    <BookFrame
      kind="voice"
      description={`How ${viewer.staff ? viewer.brand : "your brand"} writes. Every word on a creative is held against it.`}
      empty={<FiveParts />}
      index={voiceIndex}
    >
      {(body) => <VoiceBookView book={body} inBook />}
    </BookFrame>
  );
}

/** The voice from the onboarding, before the long Tone of Voice. */
function FiveParts() {
  const board = useBrandBoard();
  const viewer = useViewer();
  return (
    <Query query={board} loading="Loading the voice">
      {(view) =>
        view.identity.voiceBook ? (
          <VoiceBookView book={view.identity.voiceBook} />
        ) : (
          <NoBook kind="voice" staff={viewer.staff} brand={viewer.brand} />
        )
      }
    </Query>
  );
}
