// Conversation calls: the one Fume chat, campaign threads, the questions Fume waits on, meetings, and the Engine chat
// for Fume's people. Fume's replies arrive as events (events.ts).

import type { Id, Instant } from "../entities/common";
import type {
  EngineField,
  EngineMessage,
  EngineThread,
  EngineTopic,
  EngineWriting,
  Meeting,
  Message,
  OpenQuestion,
  Thread,
} from "../entities/conversation";

export interface ConversationApi {
  // One Fume chat (FLOWS §12, §23): no list of chats, Fume remembers everything
  conversation(): Promise<Message[]>;
  say(text: string, attachments?: { name: string; bytes: number }[]): Promise<Message>;

  // Threads: per campaign, and one general thread
  threads(): Promise<Thread[]>;
  messages(threadId: Id): Promise<Message[]>;
  send(threadId: Id, text: string, attachments?: { name: string; bytes: number }[]): Promise<Message>;

  // Questions: one question, one sheet
  /** The questions Fume still waits on (open only), the soonest needed first. */
  questions(): Promise<OpenQuestion[]>;
  /** Answer one: in words, or with a picture for a picture question. Returns what is still open. */
  answerQuestion(input: {
    questionId: Id;
    text?: string;
    picture?: { name: string; bytes: number; src?: string };
    keepPicture?: boolean;
  }): Promise<OpenQuestion[]>;

  // Meetings (FLOWS §21)
  meetingSlots(): Promise<Instant[]>;
  /** What a meeting with Fume is usually about (the presets under "What it is about"). */
  meetingTopics(): Promise<string[]>;
  bookMeeting(input: { at: Instant; topic: string }): Promise<Meeting>;
  meetings(): Promise<Meeting[]>;

  // The Engine chat (Fume's people, FLOWS §19). Round 15 (PROPOSED 9 Nov 2026): one Engine, in threads. A brand has
  // its Everything thread (no topic) and one per campaign; a Studio document's thread is its Engine changes.
  engineChat(workspaceId: Id, topic?: EngineTopic): Promise<EngineMessage[]>;
  /** `about`: the thread it goes to, the field she asks about ("Ask about this"), and the part of the project she
   *  writes from (round 16: earlier chats are named by it). */
  engineSay(
    workspaceId: Id,
    text: string,
    about?: { topic?: EngineTopic; field?: EngineField; page?: string },
  ): Promise<EngineMessage>;
  /** The brand's threads: Everything, then every campaign and document the Engine has talked about. */
  engineThreads(workspaceId: Id): Promise<EngineThread[]>;
  /** "Write with Engine": words for one field, from what the Engine knows (the brief, the Brand DNA, the voice). */
  engineWrite(field: EngineField): Promise<EngineWriting>;
  answerEngineWidget(
    workspaceId: Id,
    messageId: Id,
    answer: { picked?: Id[]; choice?: string },
  ): Promise<EngineMessage>;
}
