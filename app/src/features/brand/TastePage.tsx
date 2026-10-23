// Taste (ARCHITECTURE §4.2): what the brand looks like when words run out. Fume reads the pictures she picks and
// passes on, and the reason weighs more than the pick. Owner, approver and member teach and add; a viewer reads.
// Round 8 (UX review LOAD-12, MOB-11, PROPOSED 19 Oct 2026): taste is taught with the same deck as the onboarding, one
// card at a time on its own screen: a pair is a tap on the picture that is more you, a single picture is swiped right
// ("This is us") or left ("Not us"), with the two pills too, and "Why?" is optional chips after the pick. Every answer
// is saved on the tap. "Teach Fume your taste" opens it; how sure Fume is reads as one sentence, not five bars.
// Round 9 (desktop review DLOAD-1, DLOAD-6, DLOAD-22, DLAY-15; PROPOSED 19 Oct 2026): one pair of words for taste,
// "This is us" / "Not us", in the lists, the add form and its toast; the moodboard is named once (a pill beside
// Teach Fume your taste), not as a section of its own over the same pictures; what Fume learned last is said on the
// lessons page and after a sitting, not on the tab; "Taste Map" is "Taste"; Add a reference opens as the right panel.
import {
  Button,
  Choice,
  ChoiceText,
  CreativeGrid,
  CreativeTile,
  Dropzone,
  Field,
  FieldGroup,
  FieldLabel,
  FieldOptional,
  Input,
  PageHeader,
  RadioGroup,
  RadioGroupItem,
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  TasteDeck,
  TasteDeckStage,
  useToast,
  type DropzoneItem,
  type TasteDeckAnswer,
  type TasteDeckCard,
} from "@fume/ui";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  useAddReference,
  useAnswerTaste,
  useBrandDna,
  useChooseTastePair,
  usePassTastePair,
  usePeople,
  useSession,
  useTasteTraining,
} from "../../api/hooks";
import type { Reference, TasteArea, TasteCard, TastePair, TasteState } from "../../contract";
import { Back, Nothing, Page, Query, Section } from "../../shell/Page";
import { directory } from "../../shell/people";
import { tasteParts } from "../onboarding/GoThrough";
import { useRole, useViewer } from "./parts";

/** Add a reference: one picture, this is us or not, and a note on why. A form, so the right panel on a desk. */
function AddReferencePanel({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const add = useAddReference();
  const toast = useToast();
  const [picked, setPicked] = useState<DropzoneItem | null>(null);
  const [verdict, setVerdict] = useState<"liked" | "disliked">("liked");
  const [note, setNote] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!picked?.src) return;
    add.mutate(
      { image: picked.src, verdict, note: note.trim() || undefined },
      {
        onSuccess: () => {
          toast.done(verdict === "liked" ? "Added to This is us" : "Added to Not us");
          setPicked(null);
          setNote("");
          onOpenChange(false);
        },
        onError: (error) => toast.error("The reference wasn’t added", { description: error.message }),
      },
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <form className="ui-sheet-form" onSubmit={submit}>
          <SheetHeader>
            <SheetTitle>Add a reference</SheetTitle>
            <SheetDescription>
              A picture that is you, or one that is not. A line on why helps Fume most.
            </SheetDescription>
          </SheetHeader>
          <SheetBody>
            <FieldGroup>
              <Dropzone
                items={picked ? [picked] : []}
                onFiles={(files) => {
                  const f = files[0];
                  if (f)
                    setPicked({
                      id: `ref-${Date.now()}`,
                      name: f.name,
                      bytes: f.size,
                      state: "done",
                      src: URL.createObjectURL(f),
                      kind: "image",
                    });
                }}
                onRemove={() => setPicked(null)}
                accept="image/jpeg,image/png,image/webp"
                maxBytes={30_000_000}
                maxLabel="30 MB"
                icon="image-plus"
                copy="Drop a picture here or choose one"
                touchCopy="Choose a picture"
                moreCopy="Choose another picture"
                gridLabel="The reference"
                target="your taste"
              />
              <RadioGroup
                value={verdict}
                onValueChange={(v) => setVerdict(v as "liked" | "disliked")}
                aria-label="Is it you?"
              >
                <Choice>
                  <RadioGroupItem value="liked" />
                  <ChoiceText label="This is us" hint="Fume moves toward it" />
                </Choice>
                <Choice>
                  <RadioGroupItem value="disliked" />
                  <ChoiceText label="Not us" hint="Fume stays away from it" />
                </Choice>
              </RadioGroup>
              <Field>
                <FieldLabel htmlFor="reference-note">
                  Why <FieldOptional />
                </FieldLabel>
                <Input id="reference-note" value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
            </FieldGroup>
          </SheetBody>
          <SheetFooter>
            <SheetClose asChild>
              <Button type="button" variant="glass-clear">
                Later
              </Button>
            </SheetClose>
            <Button type="submit" variant="glass-white" loading={add.isPending} disabled={!picked}>
              Add the reference
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function References({ list, me, name }: { list: Reference[]; me: string; name: (id?: string) => string }) {
  return (
    <CreativeGrid>
      {list.map((r) => (
        <CreativeTile
          key={r.id}
          src={r.image}
          alt={r.note ?? "A reference"}
          format="feed"
          label={r.note ?? "A reference"}
          caption={`${r.note ? `${r.note} ` : ""}Added by ${r.addedBy === me ? "you" : name(r.addedBy)}`}
        />
      ))}
    </CreativeGrid>
  );
}

// ─── Teach Fume your taste ──────────────────────────────────────────────────

const areaLabel: Record<TasteArea, string> = {
  light: "Light",
  colour: "Colour",
  people: "People",
  composition: "Composition",
  styling: "Styling",
};
const areaWords: Record<TasteArea, string> = {
  light: "light",
  colour: "colours",
  people: "people",
  composition: "composition",
  styling: "styling",
};
const areas = Object.keys(areaLabel) as TasteArea[];
const and = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

/** How sure Fume is, in one sentence: "Fume knows your light and colours well, and is still learning people and styling." */
export function tasteSentence(state: TasteState, brand: string, your = "your") {
  if (state.answered === 0)
    return `Fume is just starting to learn ${your} taste. A couple of minutes of pictures teaches it what is ${brand}.`;
  const well = areas.filter((a) => state.confidence[a] >= 0.7).map((a) => areaWords[a]);
  const less = areas.filter((a) => state.confidence[a] < 0.5).map((a) => areaWords[a]);
  const first = well.length ? `Fume knows ${your} ${and(well)} well` : `Fume is getting to know ${your} taste`;
  return `${first}${less.length ? `, and is still learning ${and(less)}` : ""}. ${state.answered} answers so far.`;
}

const pairReasons = ["Warmer", "Calmer", "More air", "The product is clearer"];
const yesReasons = ["The light", "The calm", "The colours", "The setting"];
const noReasons = ["Too cold", "Too busy", "Too staged", "Not our colours"];
const neitherReasons = ["Both too cold", "Both too busy", "Both too staged", "Not our colours"];
const reasonsFor = (card: TasteDeckCard, answer: TasteDeckAnswer) =>
  card.kind === "pair"
    ? answer === "neither"
      ? neitherReasons
      : pairReasons
    : answer === "no"
      ? noReasons
      : yesReasons;

/**
 * One sitting, about two minutes: Part 1, the pairs (the onboarding's still open, then training pairs), and Part 2,
 * the single pictures (round 13, #5: the two parts named, each with what it teaches; #47: "Neither" in a pair).
 */
const SITTING = 8;
function sittingOf(pairs: TastePair[], cards: TasteCard[], brand: string): TasteDeckCard[] {
  const open: TasteDeckCard[] = pairs
    .filter((p) => !p.chosen && !p.neither)
    .map((p) => ({ id: `p:${p.id}`, kind: "pair", question: p.question, a: p.a, b: p.b }));
  const training: TasteDeckCard[] = cards.map((c) => ({
    id: `t:${c.id}`,
    kind: c.kind,
    eyebrow: areaLabel[c.area],
    question: c.question,
    a: c.a,
    b: c.b,
  }));
  const pairCards = [...open, ...training.filter((c) => c.kind === "pair")];
  const singles = training.filter((c) => c.kind === "single");
  const p = pairCards.slice(0, Math.max(SITTING - singles.length, SITTING / 2));
  return tasteParts(brand, p, singles.slice(0, SITTING - p.length));
}

/** The deck on its own screen. Its cards are fixed when it opens, so an answered card never comes round again mid-way. */
function TeachTaste({
  open,
  onOpenChange,
  cards,
  onMore,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cards: TasteDeckCard[];
  onMore: () => void;
}) {
  const choose = useChooseTastePair();
  const answerTaste = useAnswerTaste();
  const pass = usePassTastePair();
  const training = useTasteTraining();
  const toast = useToast();
  const brand = useSession().data?.workspace.brandName ?? "your brand";
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, TasteDeckAnswer>>({});
  const failed = (e: Error) => toast.error("That answer wasn’t saved", { description: e.message });

  function save(card: TasteDeckCard, answer: TasteDeckAnswer, reason?: string) {
    const [kind, id] = [card.id.slice(0, 1), card.id.slice(2)];
    if (answer === "neither")
      pass.mutate(kind === "p" ? { pairId: id, reason } : { cardId: id, reason }, { onError: failed });
    else if (kind === "p") choose.mutate({ pairId: id, chosen: answer as "a" | "b", reason }, { onError: failed });
    else answerTaste.mutate({ cardId: id, answer, reason }, { onError: failed });
  }

  const shown = cards.map((c) => (answers[c.id] ? { ...c, answer: answers[c.id] } : c));
  const state = training.data?.state;
  return (
    <TasteDeckStage
      open={open}
      onOpenChange={onOpenChange}
      title="Teach Fume your taste"
      description="Every answer is saved as you go. Stop whenever you like."
    >
      <TasteDeck
        label={`Is it ${brand}?`}
        cards={shown}
        index={index}
        onIndexChange={setIndex}
        onAnswer={(c, a) => {
          setAnswers((all) => ({ ...all, [c.id]: a }));
          save(c, a);
        }}
        reasons={reasonsFor}
        onReason={(c, a, r) => save(c, a, r)}
        neitherLabel={`Neither feels like ${brand}`}
        end={
          <div className="ui-ob-understood">
            <div className="ui-ob-understood-head">
              <h2 className="ui-ob-understood-title">Thank you</h2>
              <p className="ui-ob-understood-lede">
                {state ? tasteSentence(state, brand) : "Fume took your answers into your taste."}
              </p>
            </div>
            <div className="ui-ob-line-actions">
              <Button
                variant="secondary"
                iconEnd="arrow-right"
                onClick={() => {
                  setIndex(0);
                  setAnswers({});
                  onMore();
                }}
              >
                More pictures
              </Button>
            </div>
          </div>
        }
      />
    </TasteDeckStage>
  );
}

/** The Taste tab of Brand: how sure Fume is and the deck (and the moodboard, named once), then This is us and Not us. */
export function TasteContent({ moodboardId, moodboardItems }: { moodboardId?: string; moodboardItems?: number }) {
  const brand = useBrandDna();
  const training = useTasteTraining();
  const session = useSession().data!;
  const dir = directory(usePeople().data);
  const { canEdit, me } = useRole();
  const [adding, setAdding] = useState(false);
  const [teaching, setTeaching] = useState(false);
  const [sitting, setSitting] = useState<{ key: number; cards: TasteDeckCard[] }>({ key: 0, cards: [] });
  const brandName = session.workspace.brandName;
  const viewer = useViewer();
  const ready = Boolean(brand.data && training.data);

  function teach() {
    if (!brand.data || !training.data) return;
    setSitting((s) => ({ key: s.key + 1, cards: sittingOf(brand.data!.tastePairs, training.data!.cards, brandName) }));
    setTeaching(true);
  }

  const state = training.data?.state;
  return (
    <>
      <Section
        title={`${viewer.Your} taste`}
        titleId="taste-teach"
        text={state ? tasteSentence(state, brandName, viewer.your) : undefined}
        action={
          <div className="ui-app-row">
            {moodboardId && (
              <Button asChild variant="secondary" iconEnd="arrow-right">
                <Link
                  to={`/boards/${moodboardId}`}
                  aria-label={moodboardItems ? `Open the moodboard, ${moodboardItems} pictures` : undefined}
                >
                  Open the moodboard
                </Link>
              </Button>
            )}
            {canEdit && (
              <Button icon="layers" onClick={teach} disabled={!ready}>
                Teach Fume your taste
              </Button>
            )}
          </div>
        }
      />
      {canEdit && (
        <TeachTaste key={sitting.key} open={teaching} onOpenChange={setTeaching} cards={sitting.cards} onMore={teach} />
      )}

      <Query query={brand} loading="Loading your taste">
        {(view) => {
          const liked = view.references.filter((r) => r.verdict === "liked");
          const disliked = view.references.filter((r) => r.verdict === "disliked");
          return (
            <>
              <Section
                title="This is us"
                meta={liked.length || undefined}
                titleId="taste-liked"
                action={
                  canEdit ? (
                    <Button variant="quiet" size="sm" icon="image-plus" onClick={() => setAdding(true)}>
                      Add a reference
                    </Button>
                  ) : undefined
                }
              >
                {liked.length === 0 ? (
                  <Nothing
                    icon="thumbs-up"
                    title="No pictures here yet"
                    text="Add pictures that feel like you, from anywhere."
                  />
                ) : (
                  <References list={liked} me={me} name={dir.name} />
                )}
              </Section>

              <Section title="Not us" meta={disliked.length || undefined} titleId="taste-disliked">
                {disliked.length === 0 ? (
                  <Nothing
                    icon="x"
                    title="Nothing here yet"
                    text="A picture that is wrong for you teaches Fume as much as one that is right."
                  />
                ) : (
                  <References list={disliked} me={me} name={dir.name} />
                )}
              </Section>
            </>
          );
        }}
      </Query>

      {canEdit && <AddReferencePanel open={adding} onOpenChange={setAdding} />}
    </>
  );
}

export function TastePage() {
  const brand = useBrandDna();
  const viewer = useViewer();
  const refs = brand.data?.references ?? [];
  return (
    <Page title="Taste · Brand">
      <PageHeader
        title="Taste"
        back={<Back to="/brand" label="Brand" />}
        description={`What ${viewer.staff ? viewer.brand : "your brand"} looks like when words run out. Pick, pass and say why; Fume learns from all of it.`}
        meta={
          brand.data
            ? [
                `${refs.filter((r) => r.verdict === "liked").length} This is us`,
                `${refs.filter((r) => r.verdict === "disliked").length} Not us`,
              ]
            : undefined
        }
      />
      <TasteContent />
    </Page>
  );
}
