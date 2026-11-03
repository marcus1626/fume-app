// The Fume chat on the live backend (20261103120000_conversation.sql). Her words go in with the command `say`; Fume
// answers in the edge function `fume-chat` (a language model, supabase/functions/fume-chat), and a person at Fume
// takes over in the same chat when Fume cannot answer. New messages reach the open chat over Realtime (events.ts).
// Starting a campaign from the chat, the questions Fume waits on and meetings are not live yet.
import type { FumeApi, Id, Message, MessageCard, Thread } from "../../contract";
import type { Live } from "./context";
import { command, requestKey, rows, supabase } from "./supabase";

type Calls = "conversation" | "say" | "threads" | "messages" | "send";

interface ThreadRow {
  id: string;
  workspace_id: string;
  campaign_id: string | null;
  title: string;
  updated_at: string;
}
export interface MessageRow {
  id: string;
  thread_id: string;
  author_kind: "person" | "fume";
  author_id: string | null;
  text: string;
  card: MessageCard | null;
  attachments: { id: string; name: string; bytes: number; kind: "image" | "document" }[] | null;
  answers: string | null;
  at: string;
}
const MESSAGE = "id, thread_id, author_kind, author_id, text, card, attachments, answers, at";

export function toMessage(r: MessageRow): Message {
  return {
    id: r.id,
    threadId: r.thread_id,
    author: r.author_kind === "fume" || !r.author_id ? { kind: "fume" } : { kind: "person", userId: r.author_id },
    text: r.text,
    at: r.at,
    ...(r.attachments?.length ? { attachments: r.attachments } : {}),
    ...(r.card ? { card: r.card } : {}),
  };
}

const asked = new Set<string>();
/** Asks Fume to answer her message (once per message from this tab). The answer arrives over Realtime; a failure
 *  here only means the next read of the conversation asks again. */
function askFume(messageId: string): void {
  if (asked.has(messageId)) return;
  asked.add(messageId);
  void supabase()
    .functions.invoke("fume-chat", { body: { messageId } })
    .catch(() => asked.delete(messageId));
}

export function conversationCalls(live: Live): Pick<FumeApi, Calls> {
  const threadRows = async () =>
    rows<ThreadRow>(
      supabase()
        .from("conversation_threads")
        .select("id, workspace_id, campaign_id, title, updated_at")
        .eq("workspace_id", await live.workspaceId()),
    );
  const messageRows = async (filter: { threadId?: Id }) => {
    let q = supabase().from("conversation_messages").select(MESSAGE).order("at", { ascending: true }).limit(500);
    q = filter.threadId ? q.eq("thread_id", filter.threadId) : q.eq("workspace_id", await live.workspaceId());
    return rows<MessageRow>(q);
  };

  /** Her last words still waiting on an answer from Fume (the tab closed before it asked): ask again. */
  const unanswered = async (list: MessageRow[]) => {
    const last = list.at(-1);
    if (!last || last.author_kind !== "person" || last.author_id !== (await live.uid())) return;
    if (Date.now() - Date.parse(last.at) > 10 * 60_000 || (await live.role()) === null) return;
    askFume(last.id);
  };

  const say = async (threadId: Id | null, text: string, attachments?: { name: string; bytes: number }[]) => {
    const row = await command<MessageRow & { fume_answers: boolean }>("say", {
      p_workspace_id: await live.workspaceId(),
      p_text: text,
      p_thread_id: threadId,
      p_attachments: attachments ?? [],
      p_key: requestKey(),
    });
    if (row.fume_answers) askFume(row.id);
    return toMessage(row);
  };

  return {
    async conversation() {
      const list = await messageRows({});
      void unanswered(list).catch(() => undefined);
      void command("mark_conversation_read", { p_workspace_id: await live.workspaceId() }).catch(() => undefined);
      return list.map(toMessage);
    },
    async say(text, attachments) {
      return say(null, text, attachments);
    },
    async threads() {
      const me = await live.uid();
      const [threads, reads, list] = await Promise.all([
        threadRows(),
        rows<{ thread_id: string; read_at: string }>(
          supabase().from("conversation_reads").select("thread_id, read_at").eq("user_id", me),
        ),
        rows<{ thread_id: string; author_id: string | null; at: string }>(
          supabase()
            .from("conversation_messages")
            .select("thread_id, author_id, at")
            .eq("workspace_id", await live.workspaceId()),
        ),
      ]);
      const readAt = new Map(reads.map((r) => [r.thread_id, r.read_at]));
      return threads
        .map((t): Thread => ({
          id: t.id,
          workspaceId: t.workspace_id,
          campaignId: t.campaign_id,
          kind: "fume",
          title: t.title,
          updatedAt: t.updated_at,
          unread: list.filter((m) => m.thread_id === t.id && m.author_id !== me && m.at > (readAt.get(t.id) ?? ""))
            .length,
        }))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    async messages(threadId) {
      return (await messageRows({ threadId })).map(toMessage);
    },
    async send(threadId, text, attachments) {
      return say(threadId, text, attachments);
    },
  };
}
