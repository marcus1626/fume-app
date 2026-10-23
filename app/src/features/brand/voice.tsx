// Round 13 (Marcus's video comment #4, 22 Oct 2026; PROPOSED): the voice is much more than three lines (Fume's own
// came out of a 37-page brand process), so it has five parts:
//   - Identity: who we are, what we believe, the personality.
//   - How we speak: tone traits with a do and a don't each, words we use and avoid, sentences, formality, languages.
//   - Rules: what every line must and must never do, and the claims the brand may make.
//   - Audience: who we write for and what they care about.
//   - Examples: good lines, in the brand's languages.
// The onboarding shows what Fume found for each part on one card with Confirm · Change, so it stays quick to get
// through. Brand › Voice (/brand/voice) is the whole voice, a section per part. The look is r13-brand.css.
import { Badge, Button, DataList, DataListItem, Field, FieldDescription, FieldLabel, PageHeader, Textarea, useToast } from "@fume/ui";
import { useId, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { useBrandBoard, useDecideVoicePart } from "../../api/hooks";
import type { VoiceBook, VoicePartId } from "../../contract";
import { Back, Nothing, Page, Query } from "../../shell/Page";
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
  if (id === "rules") return [`${book.rules.must.length} musts`, `${book.rules.never.length} nevers`, `${book.rules.claims.length} claims`];
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
        <Textarea id={id} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={keys} rows={2} autoFocus aria-describedby={`${id}-help`} />
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
  const confirm = () => decide.mutate({ part: id, verdict: "keep" }, { onError: (error) => toast.error("That wasn’t saved", { description: error.message }) });
  const actions =
    canApprove && !changing ? (
      <div className="ui-proposal-actions">
        {proposed && (
          <Button size="sm" variant="secondary" icon="check" onClick={confirm} disabled={decide.isPending} aria-label={`Confirm ${voicePartTitle[id]}`}>
            Confirm
          </Button>
        )}
        <Button size="sm" variant="quiet" onClick={() => setChanging(true)} disabled={decide.isPending} aria-label={`Change ${voicePartTitle[id]}`}>
          Change
        </Button>
      </div>
    ) : null;
  const change = changing ? <VoiceChange part={id} onDone={() => setChanging(false)} /> : null;
  return { part, proposed, actions, change };
}

/** What she asked Fume to change in a part, until Fume has redone it. */
const NoteLine = ({ note, who }: { note?: string; who: string }) => (note ? <p className="ui-voice-note">{who} asked: “{note}”</p> : null);

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
                <span className="ui-voice-line-text">“{e.line}”</span> <span className="ui-voice-line-lang">{languageWord[e.language]}</span>
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
function PartSection({ book, id, children }: { book: VoiceBook; id: VoicePartId; children: ReactNode }) {
  const a = usePartActions(book, id);
  const viewer = useViewer();
  return (
    <section className="ui-voice-part" id={`voice-${id}`} aria-labelledby={`voice-${id}-title`} data-state={a.part.provenance.state}>
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

/** The whole voice, a section per part. */
export function VoiceBookView({ book }: { book: VoiceBook }) {
  return (
    <div className="ui-voice-book">
      <PartSection book={book} id="identity">
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

      <PartSection book={book} id="speak">
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

      <PartSection book={book} id="rules">
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

      <PartSection book={book} id="audience">
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

      <PartSection book={book} id="examples">
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
    </div>
  );
}

/** Brand › Voice (/brand/voice): the whole voice. */
export function VoicePage() {
  const board = useBrandBoard();
  const viewer = useViewer();
  return (
    <Page title="Voice · Brand" width="reading">
      <PageHeader
        title="Voice"
        back={<Back to="/brand" label="Brand" />}
        description={`${viewer.staff ? `${viewer.brand}’s voice` : "Your voice"} in five parts. Every word on a creative is held against it.`}
      />
      <Query query={board} loading="Loading the voice">
        {(view) =>
          view.identity.voiceBook ? (
            <VoiceBookView book={view.identity.voiceBook} />
          ) : (
            <Nothing icon="message-square" title="No voice yet" text="Fume reads it from your website and the material you give it." />
          )
        }
      </Query>
    </Page>
  );
}
