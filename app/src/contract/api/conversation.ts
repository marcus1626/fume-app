// Conversation calls: the one Fume chat, campaign threads, the questions Fume waits on, meetings, and the Engine chat
// for Fume's people. Fume's replies arrive as events (events.ts).

import type { Id, Instant } from "../entities/common";
import type { EngineMessage, Meeting, Message, OpenQuestion, Thread } from "../entities/conversation";

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

  // The Engine chat (Fume's people, FLOWS §19)
  engineChat(workspaceId: Id): Promise<EngineMessage[]>;
  engineSay(workspaceId: Id, text: string): Promise<EngineMessage>;
  answerEngineWidget(
    workspaceId: Id,
    messageId: Id,
    answer: { picked?: Id[]; choice?: string },
  ): Promise<EngineMessage>;
}
