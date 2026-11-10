// The Engine chat on the live backend (20261110060000_engine_chat.sql): Fume's people talk with the Engine about a
// brand, in its Everything thread or a campaign's. Her words go in with engine_say; the Engine answers in the edge
// function `engine-chat` (a language model), and the answer reaches the open panel over Realtime (events.ts). "Write
// with Engine" asks the same function for words for one field. A document's thread is its Engine changes, which the
// Studio reads with the document. The Engine never talks to a customer.
import {
  FumeError,
  type EngineField,
  type EngineMessage,
  type EngineThread,
  type EngineTopic,
  type FumeApi,
  type Id,
} from "../../contract";
import type { Live } from "./context";
import { command, rows, supabase } from "./supabase";

type Calls = "engineChat" | "engineSay" | "engineThreads" | "engineWrite" | "answerEngineWidget";

export interface EngineMessageRow {
  id: string;
  workspace_id: string;
  campaign_id: string | null;
  author_id: string | null;
  text: string;
  answers: string | null;
  field: EngineField | null;
  page: string | null;
  widget: EngineMessage["widget"] | null;
  answer: EngineMessage["answer"] | null;
  created_at: string;
}
const ROW = "id, workspace_id, campaign_id, author_id, text, answers, field, page, widget, answer, created_at";

export function toEngineMessage(r: EngineMessageRow): EngineMessage {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    author: r.author_id ? { kind: "person", userId: r.author_id } : { kind: "engine" },
    text: r.text,
    at: r.created_at,
    ...(r.campaign_id ? { topic: { kind: "campaign", id: r.campaign_id } } : {}),
    ...(r.field ? { field: r.field } : {}),
    ...(r.page ? { page: r.page } : {}),
    ...(r.widget ? { widget: r.widget } : {}),
    ...(r.answer ? { answer: r.answer } : {}),
  };
}

const asked = new Set<string>();
/** The Engine answers her message (once per message from this tab). */
function askEngine(messageId: string): void {
  if (asked.has(messageId)) return;
  asked.add(messageId);
  void supabase()
    .functions.invoke("engine-chat", { body: { messageId } })
    .catch(() => asked.delete(messageId));
}

export function engineChatCalls(live: Live): Pick<FumeApi, Calls> {
  return {
    async engineChat(workspaceId, topic) {
      // A document's thread is its Engine changes, read with the document.
      if (topic?.kind === "document") return [];
      let q = supabase()
        .from("engine_messages")
        .select(ROW)
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true })
        .limit(300);
      q = topic ? q.eq("campaign_id", topic.id) : q.is("campaign_id", null);
      const list = await rows<EngineMessageRow>(q);
      // Her last words still waiting on the Engine (the tab closed before it asked): ask again.
      const last = list.at(-1);
      if (
        last?.author_id &&
        last.author_id === (await live.uid()) &&
        Date.now() - Date.parse(last.created_at) < 10 * 60_000
      )
        askEngine(last.id);
      return list.map(toEngineMessage);
    },
    async engineSay(workspaceId, text, about) {
      const topic: EngineTopic | undefined = about?.topic;
      const row = await command<EngineMessageRow>("engine_say", {
        p_workspace_id: workspaceId,
        p_text: text,
        p_campaign_id: topic?.kind === "campaign" ? topic.id : null,
        p_field: about?.field ?? null,
        p_page: about?.page ?? null,
      });
      askEngine(row.id);
      return toEngineMessage(row);
    },
    async engineThreads(workspaceId) {
      const list = await rows<{ campaign_id: string | null; created_at: string }>(
        supabase().from("engine_messages").select("campaign_id, created_at").eq("workspace_id", workspaceId),
      );
      const ids = [...new Set(list.flatMap((m) => (m.campaign_id ? [m.campaign_id] : [])))];
      const names = ids.length
        ? await rows<{ id: string; name: string }>(supabase().from("campaigns").select("id, name").in("id", ids))
        : [];
      const thread = (of: typeof list) => ({
        count: of.length,
        lastAt: of
          .map((m) => m.created_at)
          .sort()
          .at(-1),
      });
      const campaigns = ids
        .map((id): EngineThread => ({
          topic: { kind: "campaign", id },
          title: names.find((c) => c.id === id)?.name ?? "A campaign",
          ...thread(list.filter((m) => m.campaign_id === id)),
        }))
        .sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
      return [{ title: "Everything", ...thread(list.filter((m) => !m.campaign_id)) }, ...campaigns];
    },
    async engineWrite(field) {
      const { data, error } = await supabase().functions.invoke("engine-chat", { body: { field } });
      if (error || !data?.text) {
        throw new FumeError("unavailable", "The Engine could not write it just now. Ask again in a moment.");
      }
      return { text: String(data.text), why: String(data.why ?? "") };
    },
    // The live Engine asks nothing back yet: its answers carry words for a field, or the creatives in Check.
    async answerEngineWidget(_workspaceId: Id, _messageId: Id) {
      throw new FumeError("invalid", "Nothing to answer.");
    },
  };
}
