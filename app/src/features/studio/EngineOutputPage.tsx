// Engine output for one brand (FLOWS §4.2): every run and its versions, best first by what the Engine's own evaluation
// found (Product Truth, brand rules, artefacts). Open any version in the Studio to work on it there. One noun for what
// the Engine made, "version" (as in the Studio). A run's "Open in the Studio" opens its best version (the document that
// holds it), never an empty "Untitled creative"; a run whose creatives all went to Check has no such button.
// - Teach the Engine (FLOWS §29, Fume's own people): Yes or No on each picture it made, and why if you like, in the
//   same deck as Brand › Taste. Only people's answers teach; each one becomes a lesson for the brand (engine_lessons).
import {
  Button,
  CreativeGrid,
  EngineRun,
  PageHeader,
  SegmentedControl,
  SegmentedOption,
  TasteDeck,
  TasteDeckStage,
  useToast,
  type TasteDeckAnswer,
  type TasteDeckCard,
} from "@fume/ui";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useBrandWorkspace, useTeachEngine } from "../../api/hooks";
import type { Generation } from "../../contract";
import * as copy from "../../copy";
import { Nothing, Page, Query, Section } from "../../shell/Page";
import { runProps } from "../shared/creatives";
import { bestFirst, CandidateTile, distinctOutput, useFumeTeam, useOpenInStudio } from "./shared";

type Show = "all" | "clean" | "flagged";

export function EngineOutputPage() {
  const { workspaceId = "" } = useParams();
  const view = useBrandWorkspace(workspaceId);
  const studio = useOpenInStudio(workspaceId);
  const [show, setShow] = useState<Show>("all");
  const v = view.data;
  const all = v ? distinctOutput(v.engineOutput).flatMap((o) => o.generations) : [];
  const flagged = all.filter(
    (g) =>
      g.evaluation.productTruth === "flag" || g.evaluation.brandRules === "flag" || g.evaluation.artefacts !== "none",
  );
  // Teaching: the pictures nobody has answered yet, best first in each run; a sitting keeps the cards it opened with.
  const teaches = useFumeTeam();
  const untaught = v
    ? distinctOutput(v.engineOutput).flatMap(({ campaign, generations }) =>
        bestFirst(generations)
          .filter((g) => !g.taught && g.state !== "making" && g.image)
          .map((g) => ({ g, campaign: campaign.name })),
      )
    : [];
  const [sitting, setSitting] = useState<{ key: number; cards: TasteDeckCard[] }>();
  const [teaching, setTeaching] = useState(false);
  const teach = () => {
    setSitting((s) => ({
      key: (s?.key ?? 0) + 1,
      cards: untaught.map(({ g, campaign }) => teachCard(g, campaign, v?.workspace.brandName ?? "the brand")),
    }));
    setTeaching(true);
  };

  return (
    <Page title={v ? `${v.workspace.brandName} Engine output` : "Engine output"}>
      <PageHeader
        title="Engine output"
        description={
          v
            ? `Every run for ${v.workspace.brandName} and what it made, best first. Open a version in the Studio to work on it.`
            : undefined
        }
        meta={
          v
            ? [copy.count(v.engineOutput.length, "run"), copy.count(all.length, "version"), `${flagged.length} flagged`]
            : undefined
        }
        actions={
          teaches && all.length ? (
            <Button variant="secondary" icon="thumbs-up" disabled={!untaught.length} onClick={teach}>
              {untaught.length ? `Teach the Engine · ${untaught.length}` : "All taught"}
            </Button>
          ) : undefined
        }
      />
      {teaches && sitting && v && (
        <TeachEngine
          key={sitting.key}
          open={teaching}
          onOpenChange={setTeaching}
          cards={sitting.cards}
          brand={v.workspace.brandName}
        />
      )}

      <Query query={view} loading="Loading what the Engine made">
        {(v) =>
          v.engineOutput.length === 0 ? (
            <Nothing
              icon="fume-engine"
              title="No runs yet"
              text={`The Engine’s runs for ${v.workspace.brandName} show here with every candidate they made.`}
            />
          ) : (
            <>
              {distinctOutput(v.engineOutput).map(({ run, campaign, generations }, i) => {
                const shown = bestFirst(generations).filter((g) =>
                  show === "all" ? true : show === "flagged" ? flagged.includes(g) : !flagged.includes(g),
                );
                return (
                  <Section
                    key={run.id}
                    title={campaign.name}
                    meta={copy.count(generations.length, "version")}
                    titleId={`run-${run.id}`}
                    action={
                      i === 0 ? (
                        <SegmentedControl
                          value={show}
                          onValueChange={(s) => setShow(s as Show)}
                          aria-label="Which versions to show"
                        >
                          <SegmentedOption value="all" count={all.length}>
                            All
                          </SegmentedOption>
                          <SegmentedOption value="clean" count={all.length - flagged.length}>
                            Clean
                          </SegmentedOption>
                          <SegmentedOption value="flagged" count={flagged.length}>
                            Flagged
                          </SegmentedOption>
                        </SegmentedControl>
                      ) : undefined
                    }
                  >
                    <EngineRun
                      {...runProps(run)}
                      actions={
                        generations.length ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            icon="layers"
                            disabled={studio.pending}
                            onClick={() =>
                              studio.open({ campaignId: campaign.id, fromGenerationId: bestFirst(generations)[0]!.id })
                            }
                          >
                            Open the best in the Studio
                          </Button>
                        ) : undefined
                      }
                    />
                    {shown.length ? (
                      <CreativeGrid>
                        {shown.map((g) => (
                          <CandidateTile
                            key={g.id}
                            g={g}
                            onOpen={() => studio.open({ campaignId: campaign.id, fromGenerationId: g.id })}
                          />
                        ))}
                      </CreativeGrid>
                    ) : (
                      <p className="ui-app-section-text">
                        {generations.length
                          ? "No versions of this run match."
                          : "This run’s creatives went to Check; no Studio document holds them."}
                      </p>
                    )}
                  </Section>
                );
              })}
            </>
          )
        }
      </Query>
    </Page>
  );
}

/** One picture as a card of the deck: is it right for the brand? */
const teachCard = (g: Generation, campaign: string, brand: string): TasteDeckCard => ({
  id: g.id,
  kind: "single",
  question: `Is this right for ${brand}?`,
  eyebrow: campaign,
  a: g.image,
  altA: `A version the Engine made for ${campaign}`,
});

const noReasons = (brand: string) => [
  "The product is off",
  "The light",
  "The composition",
  `Not ${brand}`,
  "Artefacts",
  "Text in the picture",
];
const yesReasons = (brand: string) => ["The product is right", "The light", "The composition", `Feels like ${brand}`];

/** The deck on its own screen: Yes or No on each picture, and why. Every answer is saved at once. */
function TeachEngine({
  open,
  onOpenChange,
  cards,
  brand,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cards: TasteDeckCard[];
  brand: string;
}) {
  const teach = useTeachEngine();
  const toast = useToast();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, TasteDeckAnswer>>({});
  const save = (card: TasteDeckCard, answer: TasteDeckAnswer, why?: string) =>
    teach.mutate(
      { generationId: card.id, verdict: answer === "yes" ? "yes" : "no", why },
      { onError: (e) => toast.error("That answer wasn’t saved", { description: e.message }) },
    );
  const given = Object.keys(answers).length;
  const shown = cards.map((c) => (answers[c.id] ? { ...c, answer: answers[c.id] } : c));

  return (
    <TasteDeckStage
      open={open}
      onOpenChange={onOpenChange}
      title="Teach the Engine"
      description={`Yes or no on each picture, and why if you like. Each answer becomes a lesson for ${brand}.`}
    >
      <TasteDeck
        label={`Is it right for ${brand}?`}
        cards={shown}
        index={index}
        onIndexChange={setIndex}
        yesLabel="Yes"
        noLabel="No"
        onAnswer={(c, a) => {
          setAnswers((all) => ({ ...all, [c.id]: a }));
          save(c, a);
        }}
        reasons={(_, a) => (a === "no" ? noReasons(brand) : yesReasons(brand))}
        onReason={(c, a, why) => save(c, a, why)}
        end={
          <div className="ui-ob-understood">
            <div className="ui-ob-understood-head">
              <h2 className="ui-ob-understood-title">Thank you</h2>
              <p className="ui-ob-understood-lede">
                {given
                  ? `The Engine keeps ${copy.count(given, "answer")} as lessons for ${brand} and uses them from the next render.`
                  : "Nothing was answered this time."}
              </p>
            </div>
            <div className="ui-ob-line-actions">
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </div>
          </div>
        }
      />
    </TasteDeckStage>
  );
}
