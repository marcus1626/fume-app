// One board, full height (FLOWS §3.3): /boards/:boardId for the customer (the brand moodboard, a campaign's
// moodboard, an idea board) and /studio/b/:workspaceId/boards/:boardId for Fume's people. Same Board component.
// Round 9 (desktop review DWAY-15, DLOAD-6, DLOAD-7, DLAY-8; PROPOSED 19 Oct 2026): the brand moodboard's fixed parent
// is Taste (/brand/taste), where it lives, so its Back says "Taste" on a cold load too. The meta says what is on it
// in her words: "6 pictures · 1 from Fume · updated 12 Oct" (no kind label, never "Engine proposal"). The header
// sits on the shared 1200 grid (board.css), so the left edge does not jump from the Brand page.
import { PageHeader } from "@fume/ui";
import { useParams } from "react-router-dom";
import { useBoard, useCampaign } from "../../api/hooks";
import type { Board as BoardData } from "../../contract";
import * as copy from "../../copy";
import { when } from "../../lib/time";
import { Back, Page, Query } from "../../shell/Page";
import { Board } from "./Board";

export function BoardPage() {
  const { boardId, workspaceId } = useParams<"boardId" | "workspaceId">();
  const board = useBoard(boardId);
  return (
    <Page title={board.data?.name ?? "Board"} width="fill">
      <Query query={board} loading="Opening the board">
        {(b) => <BoardScreen board={b} workspaceId={workspaceId} />}
      </Query>
    </Page>
  );
}

function BoardScreen({ board, workspaceId }: { board: BoardData; workspaceId?: string }) {
  const campaign = useCampaign(workspaceId ? undefined : board.campaignId);
  const back = workspaceId
    ? { label: "Boards", href: `/studio/b/${workspaceId}/boards` }
    : board.campaignId
      ? { label: campaign.data?.campaign.name ?? "Campaign", href: `/campaigns/${board.campaignId}/moodboard` }
      : { label: "Taste", href: "/brand/taste" };
  const shown = board.items.filter((i) => i.provenance.state !== "removed");
  const proposals = shown.filter((i) => i.provenance.state === "proposed").length;
  const pictures = shown.filter((i) => i.kind === "image" || i.kind === "creative").length;

  return (
    <>
      <div className="ui-board-head">
        <PageHeader
          title={board.name}
          back={<Back to={back.href} label={back.label} />}
          meta={[
            pictures ? copy.count(pictures, "picture") : copy.count(shown.length, "item"),
            ...(proposals ? [`${proposals} from Fume`] : []),
            `updated ${when(board.updatedAt)}`,
          ]}
        />
      </div>
      <div className="ui-board-frame">
        <Board board={board} />
      </div>
    </>
  );
}
