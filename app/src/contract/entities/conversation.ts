// Conversation: the one Fume chat with the customer (FLOWS §12, §23), the questions Fume waits on, meetings with Fume's
// people (FLOWS §21), and the Engine chat for Fume's people (FLOWS §19). The Engine never talks to customers.

import type { Id, Instant } from "./common";

// ─── The Fume chat ──────────────────────────────────────────────────────────

export type MessageAuthor = { kind: "person"; userId: Id } | { kind: "fume" } | { kind: "engine" };

/** What a link in the Fume chat points at. On a desk it opens in the panel beside the conversation, with "Open full
 *  page"; on a phone it goes to the page. */
export type ChatLink =
  | { kind: "campaign"; campaignId: Id }
  | { kind: "plan"; campaignId: Id }
  | { kind: "creative"; campaignId: Id; creativeId: Id }
  | { kind: "product"; productId: Id }
  | { kind: "collection"; collectionId: Id };

/** What a message can carry besides text: the cards Fume shows in the conversation. */
export type MessageCard =
  | { kind: "brief"; campaignId: Id; version: number }
  | { kind: "directions"; campaignId: Id }
  /** The plan, written or ready (FLOWS §22); the card opens it. */
  | { kind: "plan"; campaignId: Id; version: number }
  | { kind: "run"; runId: Id }
  | {
      kind: "question";
      question: string;
      why: string;
      options?: string[];
      /** Fume asks for the product with its picture grid. */
      productIds?: Id[];
    }
  | { kind: "creatives"; campaignId: Id; creativeIds: Id[] }
  /** Fume hands the conversation to a person at Fume (FLOWS §21). */
  | { kind: "handover"; userId: Id; reason: string }
  /** Fume offers meeting times (FLOWS §21). */
  | {
      kind: "meeting";
      meetingId?: Id;
      slots: Instant[];
      /** What the customer asked to talk about ("Christmas plans"). */
      topic?: string;
    }
  /** A campaign, plan, creative, product or collection Fume points at; it opens in the panel. */
  | { kind: "link"; link: ChatLink }
  /** What waits on her, or this month in numbers, read from the same source as Home. */
  | { kind: "summary"; of: "waiting" | "month" };

/** Fume's product question names the products the customer asked for that wait to be confirmed. Confirming the last
 *  of them over the conversation answers the question, so Fume moves on. */
export type ProductQuestionCard = Extract<MessageCard, { kind: "question" }> & { named?: Id[] };

export interface Attachment {
  id: Id;
  name: string;
  bytes: number;
  kind: "image" | "document";
  thumbnail?: string;
}

export interface Message {
  id: Id;
  threadId: Id;
  author: MessageAuthor;
  text: string;
  at: Instant;
  attachments?: Attachment[];
  card?: MessageCard;
}

export interface Thread {
  id: Id;
  workspaceId: Id;
  /** Null for the general thread with Fume. */
  campaignId: Id | null;
  /** fume: the conversation with Fume (AI); contact: people (your contact and your expert). */
  kind?: "fume" | "contact";
  title: string;
  updatedAt: Instant;
  unread: number;
}

// ─── Questions ──────────────────────────────────────────────────────────────

/** A question Fume waits on. One question, one sheet: it shows wherever it matters (Home, the chat, a campaign, the
 *  product it is about) and is answered in one shared sheet; the answer lands on the product's line, the brief and
 *  the chat at once, so it is closed everywhere. */
export interface OpenQuestion {
  id: Id;
  /** As Fume asks it: "Which claims may we use for Hand Balm?" */
  question: string;
  /** Why Fume asks, in one sentence. */
  why: string;
  /** The brief's line it fills: "The claims we may use for Hand Balm". */
  line: string;
  /** text: a written answer; picture: a photo (a packshot). */
  answer: "text" | "picture";
  /** The campaign whose brief waits on it, when one does. */
  campaignId?: Id;
  /** The product it is about: the question is a line of that product. */
  productId?: Id;
  factId?: Id;
  shotSlotId?: Id;
  /** Short answers Fume suggests, as pills: the label on the pill, and the words it puts in the field. */
  suggestions?: { label: string; text: string }[];
  /** What a good answer looks like, for the field's placeholder. */
  hint?: string;
  /** A picture question: the photo the Engine found, which the customer may keep instead of adding one. */
  picture?: string;
  /** What this kind of product usually says, when the brand's own site does not: starting points she changes. */
  templates?: { label: string; text: string }[];
  /** Why Fume offers them, in one line ("lysne.no says nothing about the claims of Hand Balm. …"). */
  templatesWhy?: string;
}

// ─── Meetings (FLOWS §21) ───────────────────────────────────────────────────

export interface Meeting {
  id: Id;
  workspaceId: Id;
  topic: string;
  at: Instant;
  minutes: number;
  /** Fume's person, and who joins from the brand. */
  hostId: Id;
  guestIds: Id[];
  state: "booked" | "done" | "cancelled";
}

// ─── The Engine chat (Fume's people, FLOWS §19) ─────────────────────────────

export type EngineWidget =
  | { kind: "products"; productIds: Id[]; picked?: Id[] }
  | { kind: "choice"; question: string; options: string[]; answer?: string }
  | { kind: "batch"; batchId: Id }
  | { kind: "document"; documentId: Id }
  /** Words the Engine wrote for a field she asked about: she puts them by the field, where she keeps or drops them. */
  | { kind: "suggestion"; field: EngineField; text: string };

/** What one of the Engine's threads is about (Round 15, PROPOSED 9 Nov 2026): a campaign or a Studio document. A
 *  message without one is in the brand's "Everything" thread. A document's thread is its Engine changes
 *  (CreativeDocument.edits, or its video's), so it needs no messages of its own. */
export type EngineTopic = { kind: "campaign"; id: Id } | { kind: "document"; id: Id };

/** One of a brand's Engine threads, for the panel's switch: Everything first, then the projects, latest first. */
export interface EngineThread {
  /** None: the brand's Everything thread. */
  topic?: EngineTopic;
  /** "Everything", "Winter gifting", "Night ritual" */
  title: string;
  /** How many turns it holds (her words and the Engine's answers). */
  count: number;
  lastAt?: Instant;
}

/** A field the Engine is asked to write, or asked about (Round 15): a line of a plan, a planned creative's scene or
 *  words, a line of a brand book. `value` is what the field says now. */
export type EngineField =
  | { kind: "plan_line"; campaignId: Id; key: string; label: string; value: string }
  | {
      kind: "plan_creative";
      campaignId: Id;
      creativeId: Id;
      part: "scene" | "text";
      label: string;
      value: string;
    }
  | { kind: "book_line"; workspaceId: Id; path: string; label: string; value: string };

/** What the Engine wrote for a field: a suggestion she keeps or drops; it is never written over her words. */
export interface EngineWriting {
  text: string;
  /** One short line on what it wrote from ("From the brief: warm, low light"). */
  why: string;
}

/** The Engine chat's answer to a question about the work: the items in Check it is about. */
export interface EngineCheckAnswer {
  kind: "check";
  itemIds: Id[];
}

/** What the Engine chat has been told for the next run: its products, mode, count, campaign and format, and the one
 *  it is asking about now. "No campaign" is the product page. */
export interface EngineRunDraft {
  productIds?: Id[];
  mode?: string;
  perProduct?: number;
  campaign?: string;
  format?: string;
  asking?: "products" | "mode" | "count" | "campaign" | "format";
}

export interface EngineMessage {
  id: Id;
  workspaceId: Id;
  author: { kind: "person"; userId: Id } | { kind: "engine" };
  text: string;
  at: Instant;
  widget?: EngineWidget;
  /** Its answer to a question about the work, with the items in Check. */
  answer?: EngineCheckAnswer;
  /** What the next run has been told so far. */
  run?: EngineRunDraft;
  /** The project thread it is in; none: the brand's Everything thread. */
  topic?: EngineTopic;
  /** The field she asked about with it ("Ask about this"). */
  field?: EngineField;
  /** The part of the project she wrote it from ("The plan", "Tone of Voice"): earlier chats are named by it
   *  (round 16, PROPOSED 9 Nov 2026). */
  page?: string;
}
