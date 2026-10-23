// One brand's boards (FLOWS §3.3, §4.2): the brand moodboard, one moodboard per campaign, idea boards and layouts. Each
// opens the board itself (/studio/b/:workspaceId/boards/:boardId). One grid while there are few (each card's meta line
// already says its kind); headed groups only once a kind holds four boards or more.
import { PageHeader } from "@fume/ui";
import { useParams } from "react-router-dom";
import { useBrandWorkspace } from "../../api/hooks";
import type { BoardKind } from "../../contract";
import * as copy from "../../copy";
import { Nothing, Page, Query, Section } from "../../shell/Page";
import { BoardCard } from "./shared";

const groups: { kind: BoardKind; title: string; empty: string }[] = [
  {
    kind: "brand_moodboard",
    title: "Brand moodboard",
    empty: "The brand moodboard starts from the images the Engine read and the customer liked.",
  },
  {
    kind: "campaign_moodboard",
    title: "Campaign moodboards",
    empty: "Each campaign gets its moodboard when it starts.",
  },
  { kind: "ideas", title: "Idea boards", empty: "Free boards for ideas, references and notes." },
  { kind: "layout", title: "Layouts", empty: "Designed pages built from the brand’s own components and tokens." },
];

export function BoardsListPage() {
  const { workspaceId = "" } = useParams();
  const view = useBrandWorkspace(workspaceId);
  const v = view.data;

  return (
    <Page title={v ? `${v.workspace.brandName} boards` : "Boards"}>
      <PageHeader
        title="Boards"
        description={
          v
            ? `${v.workspace.brandName}’s moodboards, idea boards and layouts. Liked and disliked images with their reasons feed the taste.`
            : undefined
        }
        meta={v ? [copy.count(v.boards.length, "board")] : undefined}
      />
      <Query query={view} loading="Loading the boards">
        {(v) =>
          v.boards.length === 0 ? (
            <Nothing
              icon="layout-grid"
              title="No boards yet"
              text="The brand moodboard is made during onboarding; campaign moodboards come with each campaign."
            />
          ) : v.boards.length < 4 || groups.every((g) => v.boards.filter((b) => b.kind === g.kind).length < 4) ? (
            <div className="ui-app-grid">
              {groups
                .flatMap((g) => v.boards.filter((b) => b.kind === g.kind))
                .map((b) => (
                  <BoardCard key={b.id} board={b} to={`/studio/b/${workspaceId}/boards/${b.id}`} />
                ))}
            </div>
          ) : (
            <>
              {groups.map((g) => {
                const boards = v.boards.filter((b) => b.kind === g.kind);
                return (
                  <Section
                    key={g.kind}
                    title={g.title}
                    meta={boards.length || undefined}
                    titleId={`boards-${g.kind}`}
                    text={boards.length ? undefined : g.empty}
                  >
                    {boards.length > 0 && (
                      <div className="ui-app-grid">
                        {boards.map((b) => (
                          <BoardCard key={b.id} board={b} to={`/studio/b/${workspaceId}/boards/${b.id}`} />
                        ))}
                      </div>
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
