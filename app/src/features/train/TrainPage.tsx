// Train the Engine (Marcus, 6 Nov 2026): Fume's own people go through the Engine's pictures from every brand, one at a
// time, and say yes or no, with why in their own words: they have the eye and the experience, and the Engine learns
// from the why (each answer becomes a lesson for that brand). Beside the picture, Fume's check says what it found on
// the product, with the part on the picture next to the same part on the product's own photograph, and they say
// whether the check is right; those words measure the check and correct it. Fume's own people only; never an agency's,
// never a customer's.
// The deck is the Taste deck: swipe right or Y for Yes, left or N for No, Why? after, Back one. The cards stay as they
// were read for the whole visit, so an answer never moves the next card.
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardMedia,
  CardTitle,
  CreativeMedia,
  Input,
  PageHeader,
  TasteDeck,
  ToggleGroup,
  ToggleGroupItem,
  useToast,
  type TasteDeckAnswer,
  type TasteDeckCard,
} from "@fume/ui";
import { useMemo, useRef, useState } from "react";
import { useTrainAnswer, useTrainDeck, useTrainJudge } from "../../api/hooks";
import type { CheckVerdict, TrainCard, TrainDeck } from "../../contract";
import * as copy from "../../copy";
import { Nothing, Page, Query } from "../../shell/Page";

const ROUND = 10;
const yesWhy = ["Product is right", "On brand", "Looks real", "The light", "The composition"];
const noWhy = ["Product is wrong", "Not on brand", "Looks AI-made", "The light", "The composition", "Text or label"];

export function TrainPage() {
  const deck = useTrainDeck();
  return (
    <Page title="Train the Engine">
      <Query query={deck} loading="Loading the Engine’s pictures">
        {(d) => <Train key={deck.dataUpdatedAt} deck={d} onMore={() => deck.refetch()} />}
      </Query>
    </Page>
  );
}

function Train({ deck, onMore }: { deck: TrainDeck; onMore: () => void }) {
  const toast = useToast();
  const answer = useTrainAnswer();
  // The deck as it was read when the page opened: new answers never reshuffle it.
  const [cards] = useState(deck.cards);
  const [index, setIndex] = useState(0);
  // The pictures answered on this visit (a picture answered again after Back one counts once), and the words on the
  // check given on this visit, so a card come back to shows them.
  const [answered, setAnswered] = useState<ReadonlySet<string>>(new Set());
  const words = useRef(new Map<string, Said>()).current;
  const card = cards[index];

  const deckCards = useMemo(
    () =>
      cards.map((c, i): TasteDeckCard => ({
        id: c.id,
        kind: "single",
        eyebrow: c.brandName,
        question: "Good enough to show the customer?",
        a: c.image,
        altA: `The Engine’s picture for ${c.brandName}`,
        // Ten at a time, so the head counts a round, not the whole deck
        part:
          cards.length > ROUND
            ? { label: `Round ${Math.floor(i / ROUND) + 1} of ${Math.ceil(cards.length / ROUND)}` }
            : undefined,
      })),
    [cards],
  );

  const failed = (e: Error) => toast.error("That answer was not saved", { description: e.message });
  const save = (id: string, verdict: TasteDeckAnswer, why?: string) =>
    answer.mutate({ cardId: id, verdict: verdict === "yes" ? "yes" : "no", why }, { onError: failed });

  return (
    <>
      <PageHeader
        title="Train the Engine"
        description="Yes or no, and why in your own words: the Engine learns from the why. Say too whether Fume’s check is right."
        meta={[
          `${copy.count(deck.answered + answered.size, "picture")} answered`,
          `${Math.max(cards.length - index, 0)} to go`,
        ]}
      />
      {cards.length === 0 ? (
        <Nothing
          icon="fume-engine"
          title="Nothing to train on right now"
          text="Every picture the Engine has made is answered. New ones show here as the Engine makes them."
        />
      ) : (
        <div className="ui-train">
          <TasteDeck
            label="The Engine’s pictures"
            cards={deckCards}
            index={index}
            onIndexChange={setIndex}
            yesLabel="Yes"
            noLabel="No"
            onAnswer={(c, a) => {
              setAnswered((s) => new Set(s).add(c.id));
              save(c.id, a);
            }}
            reasons={(_, a) => (a === "yes" ? yesWhy : noWhy)}
            onReason={(c, a, why) => save(c.id, a, why)}
            aside={card && <CheckPanel key={`check-${card.id}`} card={card} words={words} />}
            end={
              <Card size="lg">
                <CardHeader>
                  <CardTitle as="h2">That is every picture for now</CardTitle>
                  <CardDescription>
                    {`${copy.count(answered.size, "picture")} answered this time. The Engine turns each why into a lesson for that brand before its next picture.`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="secondary" onClick={onMore}>
                    Look for new pictures
                  </Button>
                </CardContent>
              </Card>
            }
          />
        </div>
      )}
    </>
  );
}

type Said = { judged: CheckVerdict | ""; note?: string };

/** What Fume's check found on the product in the picture shown, and the person's word on it; then the real product. */
function CheckPanel({ card, words }: { card: TrainCard; words: Map<string, Said> }) {
  const word = (key: string, said?: Said) => ({
    said: words.get(`${card.id}:${key}`) ?? said,
    keep: (next: Said) => words.set(`${card.id}:${key}`, next),
  });
  return (
    <aside className="ui-train-check" aria-label="Fume’s check">
      {!card.checked ? (
        <Card>
          <CardHeader>
            <CardTitle>Fume’s check</CardTitle>
            <CardDescription>
              The check has not read this picture. Your why says what is right or wrong.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : card.findings.length === 0 ? (
        <Word
          card={card}
          wordKey="none"
          title="Fume’s check found nothing wrong"
          text="Is the product in the picture right?"
          right="Right"
          wrong="Missed something"
          ask="What did it miss?"
          {...word("none", card.clean)}
        />
      ) : (
        card.findings.map((f) => (
          <Word
            key={f.key}
            card={card}
            wordKey={f.key}
            title={`Fume’s check: ${f.label}`}
            text={f.note}
            right="Right"
            wrong="Wrong"
            ask="Why? (optional)"
            {...word(f.key, f.judged ? { judged: f.judged, note: f.judgedNote } : undefined)}
            closeUps={f.seenImage || f.expectedImage ? { seen: f.seenImage, expected: f.expectedImage } : undefined}
          />
        ))
      )}
      {card.product && (
        <Card>
          <CardHeader>
            <CardTitle>The real product</CardTitle>
            <CardDescription>{card.product.name}</CardDescription>
          </CardHeader>
          {card.product.image && (
            <CardMedia>
              <CreativeMedia
                ratio={1}
                src={card.product.image}
                alt={`${card.product.name}, the brand’s own photograph`}
              />
            </CardMedia>
          )}
        </Card>
      )}
      <Button asChild variant="quiet" size="sm" icon="external-link">
        <a href={card.image} target="_blank" rel="noreferrer">
          The picture full size
        </a>
      </Button>
    </aside>
  );
}

/** One thing the check said, with Right / Wrong and a line of why; each saves at once. */
function Word({
  card,
  wordKey,
  title,
  text,
  right,
  wrong,
  ask,
  said,
  keep,
  closeUps,
}: {
  card: TrainCard;
  wordKey: string;
  title: string;
  text: string;
  right: string;
  wrong: string;
  ask: string;
  said?: Said;
  keep: (next: Said) => void;
  closeUps?: { seen?: string; expected?: string };
}) {
  const toast = useToast();
  const judge = useTrainJudge();
  const [verdict, setVerdict] = useState<CheckVerdict | "">(said?.judged ?? "");
  const [note, setNote] = useState(said?.note ?? "");
  const saved = useRef(said?.note ?? "");

  const send = (v: CheckVerdict | "", words: string) => {
    keep({ judged: v, note: words });
    judge.mutate(
      { cardId: card.id, key: wordKey, verdict: v || null, note: words },
      { onError: (e) => toast.error("That word was not saved", { description: e.message }) },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{text}</CardDescription>
      </CardHeader>
      {closeUps && (
        <CardMedia>
          {closeUps.seen && <CreativeMedia ratio={1} src={closeUps.seen} alt="The part on the picture" />}
          {closeUps.expected && (
            <CreativeMedia ratio={1} src={closeUps.expected} alt="The same part on the product’s own photograph" />
          )}
        </CardMedia>
      )}
      <CardContent className="ui-app-stack ui-app-stack--tight">
        {closeUps && <CardDescription>On the picture, then on the product.</CardDescription>}
        <ToggleGroup
          type="single"
          allowEmpty
          variant="outline"
          size="sm"
          value={verdict}
          aria-label={`Is the check right? ${title}`}
          onValueChange={(v) => {
            const next = v as CheckVerdict | "";
            setVerdict(next);
            const words = next ? note : "";
            if (!next) setNote("");
            saved.current = words;
            send(next, words);
          }}
        >
          <ToggleGroupItem value="right">{right}</ToggleGroupItem>
          <ToggleGroupItem value="wrong">{wrong}</ToggleGroupItem>
        </ToggleGroup>
        {verdict && (
          <Input
            size="sm"
            aria-label={ask}
            placeholder={ask}
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => {
              if (note.trim() === saved.current.trim()) return;
              saved.current = note;
              send(verdict, note);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}
