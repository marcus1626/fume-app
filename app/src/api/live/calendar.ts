// The content calendar on the live backend (FLOWS §21): the creatives planned on a day in a placement
// (public.calendar_posts), the campaigns with a due day as spans, and the deliveries on the day they were made. Planning,
// moving and taking off go through the database's commands, which say who may.
import type { CalendarEntry, FumeApi, Id } from "../../contract";
import type { Live } from "./context";
import { readCreatives } from "./map";
import { command, rows, supabase } from "./supabase";

type Calls = "calendar" | "schedule" | "moveEntry" | "removeEntry";

type Row = PostRow & { creatives: { campaign_id: string; title: string } | null };
interface PostRow {
  id: string;
  workspace_id: string;
  creative_id: string;
  placement_id: string;
  at: string;
}

const iso = (t: string) => new Date(t).toISOString();

async function withImages(entries: CalendarEntry[]): Promise<CalendarEntry[]> {
  const ids = [...new Set(entries.flatMap((e) => (e.creativeId ? [e.creativeId] : [])))];
  if (!ids.length) return entries;
  const creatives = new Map((await readCreatives({ creativeIds: ids })).map((c) => [c.id, c]));
  return entries.map((e) => {
    const c = e.creativeId ? creatives.get(e.creativeId) : undefined;
    return c ? { ...e, title: c.title, ...(c.current.image ? { image: c.current.image } : {}) } : e;
  });
}

export function calendarCalls(live: Live): Pick<FumeApi, Calls> {
  const postOf = async (id: Id) => {
    const found = await rows<Row>(
      supabase()
        .from("calendar_posts")
        .select("id, workspace_id, creative_id, placement_id, at, creatives(campaign_id, title)")
        .eq("id", id)
        .overrideTypes<Row[], { merge: false }>(),
    );
    return found[0];
  };
  const toPost = (p: Row): CalendarEntry => ({
    id: p.id,
    workspaceId: p.workspace_id,
    kind: "post",
    title: p.creatives?.title ?? "",
    start: iso(p.at),
    placementId: p.placement_id,
    creativeId: p.creative_id,
    ...(p.creatives ? { campaignId: p.creatives.campaign_id } : {}),
  });

  return {
    async calendar({ from, to }) {
      const ws = await live.workspaceId();
      const [posts, campaigns, deliveries] = await Promise.all([
        rows<Row>(
          supabase()
            .from("calendar_posts")
            .select("id, workspace_id, creative_id, placement_id, at, creatives(campaign_id, title)")
            .eq("workspace_id", ws)
            .gte("at", from)
            .lte("at", to)
            .overrideTypes<Row[], { merge: false }>(),
        ),
        rows<{ id: string; name: string; created_at: string; due_at: string | null }>(
          supabase()
            .from("campaigns")
            .select("id, name, created_at, due_at")
            .eq("workspace_id", ws)
            .not("due_at", "is", null)
            .lte("created_at", to)
            .gte("due_at", from),
        ),
        rows<{ id: string; name: string; campaign_id: string; created_at: string }>(
          supabase()
            .from("deliveries")
            .select("id, name, campaign_id, created_at")
            .eq("workspace_id", ws)
            .gte("created_at", from)
            .lte("created_at", to),
        ),
      ]);
      const entries: CalendarEntry[] = [
        ...campaigns.map((c) => ({
          id: `campaign-${c.id}`,
          workspaceId: ws,
          kind: "campaign" as const,
          title: c.name,
          start: iso(c.created_at),
          end: iso(c.due_at!),
          campaignId: c.id,
        })),
        ...deliveries.map((d) => ({
          id: `delivery-${d.id}`,
          workspaceId: ws,
          kind: "delivery" as const,
          title: d.name,
          start: iso(d.created_at),
          campaignId: d.campaign_id,
        })),
        ...posts.map(toPost),
      ];
      return (await withImages(entries)).sort((a, b) => a.start.localeCompare(b.start));
    },
    async schedule({ creativeId, placementId, at }) {
      const p = await command<{ id: string }>("schedule_post", {
        p_creative_id: creativeId,
        p_placement_id: placementId,
        p_at: at,
      });
      return (await withImages([toPost((await postOf(p.id))!)]))[0]!;
    },
    async moveEntry(entryId, at) {
      await command("move_post", { p_post_id: entryId, p_at: at });
      return (await withImages([toPost((await postOf(entryId))!)]))[0]!;
    },
    async removeEntry(entryId) {
      await command("remove_post", { p_post_id: entryId });
    },
  };
}
