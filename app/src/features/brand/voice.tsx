// The brand's voice, in five parts:
//   - Identity: who we are, what we believe, the personality.
//   - How we speak: tone traits with a do and a don't each, words we use and avoid, sentences, formality, languages.
//   - Rules: what every line must and must never do, and the claims the brand may make.
//   - Audience: who we write for and what they care about.
//   - Examples: good lines, in the brand's languages.
// The onboarding shows what Fume found for each part on one card with Confirm · Change, so it stays quick to get
// through. Brand › Voice (/brand/voice) is the whole voice, a section per part. The look is r13-brand.css.
import {
  Badge,
  Button,
  DataList,
  DataListItem,
  Field,
  FieldDescription,
  FieldLabel,
  Textarea,
  useToast,
} from "@fume/ui";
import { useId, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { useBrandBoard, useDecideVoicePart } from "../../api/hooks";
import type { VoiceBook, VoicePartId } from "../../contract";
import { Query } from "../../shell/Page";
import { BookFrame, NoBook } from "./books";
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
  children,
}: {
  book: VoiceBook;
  id: VoicePartId;
  /** In a version of the Tone of Voice: the book is approved as a whole, so a part has no Confirm · Change. */
  bare?: boolean;
  children: ReactNode;
}) {
  if (bare)
    return (
      <Section id={id} title={voicePartTitle[id]} line={voicePartLine[id]}>
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
function Section({ id, title, line, children }: { id: string; title: string; line?: string; children: ReactNode }) {
  return (
    <section className="ui-voice-part" id={`voice-${id}`} aria-labelledby={`voice-${id}-title`}>
      <div className="ui-voice-part-head">
        <div className="ui-voice-part-words">
          <h2 className="ui-voice-part-title" id={`voice-${id}-title`}>
            {title}
          </h2>
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

const Words = ({ items, avoid }: { items: string[]; avoid?: boolean }) => (
  <p className="ui-voice-chips" data-avoid={avoid ? "" : undefined}>
    {items.map((w) => (
      <Badge key={w} variant={avoid ? "neutral" : "secondary"}>
        {w}
      </Badge>
    ))}
  </p>
);

/** The whole voice, a section per part; a version of the Tone of Voice also holds the voice at work. */
export function VoiceBookView({ book, inBook }: { book: VoiceBook; inBook?: boolean }) {
  return (
    <div className="ui-voice-book">
      {book.summary && <p className="ui-voice-lead ui-brandbook-summary">{book.summary}</p>}
      <PartSection book={book} id="identity" bare={inBook}>
        <p className="ui-voice-lead">{book.identity.who}</p>
        <div className="ui-voice-cols">
          <div className="ui-voice-block">
            <h3 className="ui-voice-sub">What we believe</h3>
            <List items={book.identity.believe} />
          </div>
          <div className="ui-voice-block">
            <h3 className="ui-voice-sub">Personality</h3>
            <Words items={book.identity.personality} />
          </div>
        </div>
      </PartSection>

      <PartSection book={book} id="speak" bare={inBook}>
        <ul className="ui-voice-traits" aria-label="Tone">
          {book.speak.traits.map((t) => (
            <li key={t.trait} className="ui-voice-trait">
              <p className="ui-voice-trait-name">{t.trait}</p>
              <p className="ui-voice-trait-means">{t.means}</p>
              <p className="ui-voice-say" data-say="do">
                <span className="ui-voice-say-label">Do</span>“{t.do}”
              </p>
              <p className="ui-voice-say" data-say="dont">
                <span className="ui-voice-say-label">Don’t</span>“{t.dont}”
              </p>
            </li>
          ))}
        </ul>
        <div className="ui-voice-cols">
          <div className="ui-voice-block">
            <h3 className="ui-voice-sub">Words we use</h3>
            <Words items={book.speak.use} />
          </div>
          <div className="ui-voice-block">
            <h3 className="ui-voice-sub">Words we avoid</h3>
            <Words items={book.speak.avoid} avoid />
          </div>
        </div>
        <DataList variant="stacked" className="ui-voice-facts">
          <DataListItem label="Sentences">{book.speak.sentences}</DataListItem>
          <DataListItem label="Formality">{book.speak.formality}</DataListItem>
          <DataListItem label="Languages">{book.speak.languages}</DataListItem>
        </DataList>
      </PartSection>

      <PartSection book={book} id="rules" bare={inBook}>
        <div className="ui-voice-cols" data-cols="3">
          <div className="ui-voice-block">
            <h3 className="ui-voice-sub">Every line must</h3>
            <List items={book.rules.must} />
          </div>
          <div className="ui-voice-block">
            <h3 className="ui-voice-sub">Never</h3>
            <List items={book.rules.never} />
          </div>
          <div className="ui-voice-block">
            <h3 className="ui-voice-sub">Claims we may make</h3>
            <List items={book.rules.claims} />
          </div>
        </div>
      </PartSection>

      <PartSection book={book} id="audience" bare={inBook}>
        <p className="ui-voice-lead">{book.audience.who}</p>
        <div className="ui-voice-cols">
          <div className="ui-voice-block">
            <h3 className="ui-voice-sub">What they care about</h3>
            <List items={book.audience.cares} />
          </div>
          <div className="ui-voice-block">
            <h3 className="ui-voice-sub">Not for</h3>
            <p className="ui-voice-text">{book.audience.notFor}</p>
          </div>
        </div>
      </PartSection>

      <PartSection book={book} id="examples" bare={inBook}>
        <ul className="ui-voice-lines">
          {book.examples.map((e) => (
            <li key={e.line} lang={e.language === "no" ? "nb" : "en"}>
              <span className="ui-voice-line-text">“{e.line}”</span>
              <span className="ui-voice-line-meta">
                <span className="ui-voice-line-lang">{languageWord[e.language]}</span> · {e.where}
              </span>
            </li>
          ))}
        </ul>
      </PartSection>
      <VoiceAtWork book={book} />
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
};

/** The long Tone of Voice's other parts: where the voice sits, its mechanics, its words, the channels, headlines and
 *  calls to action, on brand against off brand, and what Fume still needs to know. Each shows only when it is there. */
function VoiceAtWork({ book }: { book: VoiceBook }) {
  const lang = book.speak.languages.toLowerCase().includes("norw") ? "nb" : undefined;
  return (
    <>
      {book.scale && book.scale.length > 0 && (
        <Section id="scale" title="Where we sit" line="Between two words, where the voice sits.">
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
      )}
      {book.mechanics && (
        <Section id="mechanics" title="Mechanics" line="Casing, punctuation, numbers and names.">
          <DataList variant="stacked" className="ui-voice-facts">
            <DataListItem label="Casing">{book.mechanics.casing}</DataListItem>
            <DataListItem label="Punctuation">{book.mechanics.punctuation}</DataListItem>
            <DataListItem label="Numbers">{book.mechanics.numbers}</DataListItem>
            <DataListItem label="Emoji">{book.mechanics.emoji}</DataListItem>
            <DataListItem label="Names">{book.mechanics.names}</DataListItem>
          </DataList>
        </Section>
      )}
      {book.vocabulary && book.vocabulary.length > 0 && (
        <Section id="vocabulary" title="Our words" line="The brand’s own words, and how to use them.">
          <DataList variant="stacked" className="ui-voice-facts">
            {book.vocabulary.map((v) => (
              <DataListItem key={v.word} label={v.word}>
                {v.use}
              </DataListItem>
            ))}
          </DataList>
        </Section>
      )}
      {book.channels && book.channels.length > 0 && (
        <Section id="channels" title="Channels" line="How the voice works in each place, and how long it may be.">
          <ul className="ui-brandbook-cards">
            {book.channels.map((c) => (
              <li key={c.channel} className="ui-voice-trait">
                <p className="ui-voice-trait-name">{channelWord[c.channel]}</p>
                <p className="ui-voice-trait-means">{c.how}</p>
                <p className="ui-brandbook-length">{c.length}</p>
                <p className="ui-voice-say" lang={lang}>
                  <span className="ui-voice-say-label">For example</span>“{c.example}”
                </p>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {((book.headlines?.length ?? 0) > 0 || (book.ctas?.length ?? 0) > 0) && (
        <Section id="headlines" title="Headlines and calls to action" line="Patterns to write from.">
          <div className="ui-voice-cols">
            {book.headlines && book.headlines.length > 0 && (
              <div className="ui-voice-block">
                <h3 className="ui-voice-sub">Headlines</h3>
                <ul className="ui-brandbook-rows">
                  {book.headlines.map((h) => (
                    <li key={h.pattern}>
                      <span className="ui-brandbook-row-main" lang={lang}>
                        “{h.example}”
                      </span>
                      <span className="ui-brandbook-row-meta">{h.pattern}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {book.ctas && book.ctas.length > 0 && (
              <div className="ui-voice-block">
                <h3 className="ui-voice-sub">Calls to action</h3>
                <ul className="ui-brandbook-rows">
                  {book.ctas.map((c) => (
                    <li key={c.cta}>
                      <span className="ui-brandbook-row-main" lang={lang}>
                        {c.cta}
                      </span>
                      <span className="ui-brandbook-row-meta">{c.when}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Section>
      )}
      {book.pairs && book.pairs.length > 0 && (
        <Section id="pairs" title="On brand, off brand" line="The same thing said two ways, and why one is ours.">
          <ul className="ui-brandbook-pairs">
            {book.pairs.map((x) => (
              <li key={x.good} className="ui-brandbook-pair">
                <p className="ui-voice-say" lang={lang}>
                  <span className="ui-voice-say-label">On brand</span>“{x.good}”
                </p>
                <p className="ui-voice-say" data-say="dont" lang={lang}>
                  <span className="ui-voice-say-label">Off brand</span>“{x.bad}”
                </p>
                <p className="ui-voice-trait-means">{x.why}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <BookEnd gaps={book.gaps} sources={book.sources} />
    </>
  );
}

/** What Fume still needs to know, and where each part comes from: the end of both books. */
export function BookEnd({ gaps, sources }: { gaps?: string[]; sources?: VoiceBook["sources"] }) {
  return (
    <>
      {gaps && gaps.length > 0 && (
        <Section
          id="gaps"
          title="What Fume still needs to know"
          line="Questions for the brand. An answer goes into the next version."
        >
          <List items={gaps} />
        </Section>
      )}
      {sources && sources.length > 0 && (
        <Section id="sources" title="Where it comes from">
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
