// Moodboards on the live backend (20261103216000_boards.sql): the brand's own moodboard and each campaign's. A picture
// from her computer (a blob: address) is stored first, then placed by its file; a picture from the web or from the app
// is placed by its address. What she likes or not on a board teaches Fume her taste (taste-learn runs after).
import type { Board, BoardItem, FumeApi, Id } from "../../contract";
import type { Live } from "./context";
import { fileUrls, uploadFile } from "./map";
import { command, rows, supabase } from "./supabase";
import { learnTaste } from "./taste";

type Calls =
  "boards" | "board" | "addBoardItem" | "updateBoardItem" | "removeBoardItem" | "startMoodboard" | "skipMoodboard";

interface BoardRow {
  id: string;
  workspace_id: string;
  kind: Board["kind"];
  campaign_id: string | null;
  name: string;
  width: number;
  height: number;
  updated_at: string;
}
interface ItemRow {
  id: string;
  board_id: string;
  kind: BoardItem["kind"];
  x: number;
  y: number;
  w: number;
  h: number;
  image_url: string | null;
  file_id: string | null;
  text: string | null;
  hex: string | null;
  verdict: BoardItem["verdict"] | null;
  note: string | null;
  origin: "customer" | "fume" | "engine";
  created_by: string | null;
  created_at: string;
}
const BOARD = "id, workspace_id, kind, campaign_id, name, width, height, updated_at";
const ITEM =
  "id, board_id, kind, x, y, w, h, image_url, file_id, text, hex, verdict, note, origin, created_by, created_at";

export async function readBoards(filter: { workspaceId?: Id; ids?: Id[] }): Promise<Board[]> {
  let q = supabase().from("boards").select(BOARD);
  if (filter.workspaceId) q = q.eq("workspace_id", filter.workspaceId);
  if (filter.ids) q = q.in("id", filter.ids);
  const boards = await rows<BoardRow>(q.order("created_at"));
  if (!boards.length) return [];
  const items = await rows<ItemRow>(
    supabase()
      .from("board_items")
      .select(ITEM)
      .in(
        "board_id",
        boards.map((b) => b.id),
      )
      .order("created_at"),
  );
  const files = await fileUrls(items.map((i) => i.file_id));
  return boards.map((b) => ({
    id: b.id,
    workspaceId: b.workspace_id,
    kind: b.kind,
    ...(b.campaign_id ? { campaignId: b.campaign_id } : {}),
    name: b.name,
    width: b.width,
    height: b.height,
    updatedAt: b.updated_at,
    items: items
      .filter((i) => i.board_id === b.id)
      .map((i) => {
        const image = i.file_id ? files.get(i.file_id)?.url : (i.image_url ?? undefined);
        return {
          id: i.id,
          boardId: i.board_id,
          kind: i.kind,
          x: i.x,
          y: i.y,
          w: i.w,
          h: i.h,
          ...(image ? { image } : {}),
          ...(i.text ? { text: i.text } : {}),
          ...(i.hex ? { hex: i.hex } : {}),
          ...(i.verdict ? { verdict: i.verdict } : {}),
          ...(i.note ? { note: i.note } : {}),
          provenance: {
            origin: i.origin === "fume" ? "fume" : i.origin === "engine" ? "engine" : "customer",
            state: "approved",
            ...(i.created_by ? { by: i.created_by } : {}),
            at: i.created_at,
          },
        } as BoardItem;
      }),
  }));
}

/** The brand's own moodboard (made the first time it is asked for). */
export async function brandMoodboard(workspaceId: Id): Promise<Board> {
  const b = await command<{ id: string }>("brand_moodboard", { p_workspace_id: workspaceId });
  return (await readBoards({ ids: [b.id] }))[0]!;
}

/** A picture the board may place: one from her computer is stored first. */
async function placeable(workspaceId: Id, image: string): Promise<{ image?: string; fileId?: string }> {
  if (/^https:\/\//.test(image) || image.startsWith("/")) return { image };
  const blob = await (await fetch(image)).blob();
  const name = `moodboard.${(blob.type.split("/")[1] ?? "jpg").replace("jpeg", "jpg")}`;
  return { fileId: await uploadFile(workspaceId, blob, { name, purpose: "source" }) };
}

export function boardCalls(live: Live): Pick<FumeApi, Calls> {
  const one = async (boardId: Id) => {
    const b = (await readBoards({ ids: [boardId] }))[0];
    if (!b) throw new Error("No such board.");
    return b;
  };
  const wsOf = async (boardId: Id) =>
    (await rows<{ workspace_id: string }>(supabase().from("boards").select("workspace_id").eq("id", boardId)))[0]
      ?.workspace_id ?? (await live.workspaceId());
  return {
    async boards() {
      const ws = await live.workspaceId();
      await brandMoodboard(ws);
      return readBoards({ workspaceId: ws });
    },
    board: one,
    async addBoardItem(boardId, item) {
      const ws = await wsOf(boardId);
      const { image, ...rest } = item;
      const pic = image ? await placeable(ws, image) : {};
      await command("add_board_item", { p_board_id: boardId, p_item: { ...rest, ...pic } });
      if (item.verdict) learnTaste(ws, true);
      return one(boardId);
    },
    async updateBoardItem(boardId, itemId, change) {
      await command("update_board_item", { p_item_id: itemId, p_change: change });
      if ("verdict" in change || "note" in change) learnTaste(await wsOf(boardId), true);
      return one(boardId);
    },
    async removeBoardItem(boardId, itemId) {
      await command("remove_board_item", { p_item_id: itemId });
      return one(boardId);
    },
    async startMoodboard(campaignId, images) {
      const ws = await live.workspaceId();
      const pics = await Promise.all(images.map((i) => placeable(ws, i)));
      const b = await command<{ id: string }>("start_moodboard", { p_campaign_id: campaignId, p_images: pics });
      learnTaste(ws, true);
      return one(b.id);
    },
    async skipMoodboard(campaignId) {
      await command("skip_moodboard", { p_campaign_id: campaignId });
      const { readCampaigns } = await import("./map");
      return (await readCampaigns({ ids: [campaignId] }))[0]!;
    },
  };
}
