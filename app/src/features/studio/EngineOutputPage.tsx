// Engine output for one brand (FLOWS §4.2): every run and its versions, best first by what the Engine's own evaluation
// found (Product Truth, brand rules, artefacts). Open any version in the Studio to work on it there. One noun for what
// the Engine made, "version" (as in the Studio). A run's "Open in the Studio" opens its best version (the document that
// holds it), never an empty "Untitled creative"; a run whose creatives all went to Check has no such button.
import { Button, CreativeGrid, EngineRun, PageHeader, SegmentedControl, SegmentedOption } from "@fume/ui";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useBrandWorkspace } from "../../api/hooks";
import * as copy from "../../copy";
import { Nothing, Page, Query, Section } from "../../shell/Page";
import { runProps } from "../shared/creatives";
import { bestFirst, CandidateTile, distinctOutput, useOpenInStudio } from "./shared";

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
      />

      <Query query={view} loading="Loading what the Engine made">
        {(v) =>
          v.engineOutput.length === 0 ? (
            <Nothing
              icon="fume-engine"
              scene="studio"
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
