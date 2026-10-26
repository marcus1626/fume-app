// The conversations with Fume: the general thread, one per campaign, and Contact (Fume's people); their messages; and
// the questions Fume waits on.
import type { Id, Message, Thread } from "../../contract";
import { at } from "./helpers";

export const threads: Thread[] = [
  {
    id: "t-general",
    workspaceId: "w-lysne",
    campaignId: null,
    title: "Fume",
    kind: "fume",
    updatedAt: at(60 * 3),
    unread: 0,
  },
  {
    id: "t-autumn",
    workspaceId: "w-lysne",
    campaignId: "c-autumn",
    title: "Autumn launch",
    kind: "fume",
    updatedAt: at(6),
    unread: 1,
  },
  {
    id: "t-winter",
    workspaceId: "w-lysne",
    campaignId: "c-winter",
    title: "Winter gifting",
    kind: "fume",
    updatedAt: at(2),
    unread: 0,
  },
  {
    id: "t-balm",
    workspaceId: "w-lysne",
    campaignId: "c-balm",
    title: "Hand Balm introduction",
    kind: "fume",
    updatedAt: at(60 * 3),
    unread: 1,
  },
  // The Contact thread is people: Fume (AI) never answers there.
  {
    id: "t-contact",
    workspaceId: "w-lysne",
    campaignId: null,
    title: "Contact",
    kind: "contact",
    updatedAt: at(60 * 20),
    unread: 1,
  },
];

const general: Message[] = [
  {
    id: "msg1",
    threadId: "t-autumn",
    author: { kind: "person", userId: "u-maja" },
    text: "Autumn launch for the night body oil. Low evening light, stone and skin, calm and close. Paid social, email and the product page.",
    at: at(60 * 24 * 12),
  },
  {
    id: "msg2",
    threadId: "t-autumn",
    author: { kind: "fume" },
    text: "Here is your brief. Change anything that is off, then send it to Fume.",
    at: at(60 * 24 * 12 - 2),
    card: { kind: "brief", campaignId: "c-autumn", version: 2 },
  },
  {
    id: "msg3",
    threadId: "t-autumn",
    author: { kind: "fume" },
    text: "Three directions are ready. Pick one to take forward, or tell us why none fits.",
    at: at(60 * 24 * 7),
    card: { kind: "directions", campaignId: "c-autumn" },
  },
  {
    id: "msg4",
    threadId: "t-autumn",
    author: { kind: "person", userId: "u-maja" },
    text: "A. Evening stone is the autumn feeling.",
    at: at(60 * 24 * 6),
  },
  {
    id: "msg5",
    threadId: "t-autumn",
    author: { kind: "engine" },
    text: "Variants and channel formats for Masters 1 and 2.",
    at: at(120),
    card: { kind: "run", runId: "run-autumn-v" },
  },
  {
    id: "msg6",
    threadId: "t-autumn",
    author: { kind: "fume" },
    text: "Anna checked 6 creatives. They are ready for you; 3 more are in check.",
    at: at(6),
    card: {
      kind: "creatives",
      campaignId: "c-autumn",
      creativeIds: ["cr-a-v1", "cr-a-v2", "cr-a-v3", "cr-a-v4", "cr-a-v5", "cr-a-v6"],
    },
  },
  {
    id: "msg7",
    threadId: "t-balm",
    author: { kind: "person", userId: "u-maja" },
    text: "Let's introduce the hand balm to people who already love the oil.",
    at: at(60 * 3 + 2),
  },
  {
    id: "msg8",
    threadId: "t-balm",
    author: { kind: "fume" },
    text: "Which claims may we use for Hand Balm?",
    at: at(60 * 3),
    card: {
      kind: "question",
      question: "Which claims may we use for Hand Balm?",
      why: "Fume checks every line on a creative against your approved claims, so we need them before any work starts.",
      options: ["Same as the oil", "I'll send a list"],
    },
  },
  {
    id: "msg9",
    threadId: "t-winter",
    author: { kind: "fume" },
    text: "The plan for Winter gifting is ready and Anna checked it. Approve it and Fume starts on the 3 masters; nothing is made before that.",
    at: at(60 * 3),
    card: { kind: "plan", campaignId: "c-winter", version: 1 },
  },
  {
    id: "msg10",
    threadId: "t-general",
    author: { kind: "fume" },
    text: "Tell Fume what you need. We'll ask a few questions and write the plan with you; nothing is made before you approve it.",
    at: at(60 * 24 * 12 + 5),
  },
];

const contact: Message[] = [
  {
    id: "cm1",
    threadId: "t-contact",
    author: { kind: "person", userId: "u-sander" },
    text: "Hi Maja, I'm Sander, your producer at Fume. Anna checks every creative before you see it. Write here whenever you'd rather talk to a person.",
    at: at(60 * 24 * 12),
  },
  {
    id: "cm2",
    threadId: "t-contact",
    author: { kind: "person", userId: "u-maja" },
    text: "Can we use the autumn creatives in print as well?",
    at: at(60 * 22),
  },
  {
    id: "cm3",
    threadId: "t-contact",
    author: { kind: "person", userId: "u-sander" },
    text: "Yes. Your rights note covers paid and organic channels; print is fine too. I've added it to the delivery's note.",
    at: at(60 * 20),
  },
];

/** Fume hands a question over to a person, inside the one conversation. */
const handover: Message[] = [
  {
    id: "msg-h1",
    threadId: "t-general",
    author: { kind: "person", userId: "u-maja" },
    text: "Can we move the invoice date for October to the end of the month?",
    at: at(60 * 20 + 3),
  },
  {
    id: "msg-h2",
    threadId: "t-general",
    author: { kind: "fume" },
    text: "That is one for a person. Sander at Fume will answer you here.",
    at: at(60 * 20 + 2),
    card: { kind: "handover", userId: "u-sander", reason: "Invoices are handled by people at Fume." },
  },
  {
    id: "msg-h3",
    threadId: "t-general",
    author: { kind: "person", userId: "u-sander" },
    text: "Hi Maja, done: the October invoice is now due on the 31st.",
    at: at(60 * 20),
  },
];

export const messages: Message[] = [...general, ...contact, ...handover];

// ─── Questions ──────────────────────────────────────────────────────────────
// One question, one record: a question Fume asks shows in many places (a line the brief misses, an unknown line of a
// product, a card in the chat). An answer given in any place closes the record everywhere.

export interface QuestionRecord {
  id: Id;
  workspaceId: Id;
  /** The campaign whose brief waits on it, when one does. */
  campaignId?: Id;
  /** The brief's line, as Fume writes it there: "The claims we may use for Hand Balm". */
  line: string;
  /** Where it is quickest to answer. */
  href: string;
  /** The question as Fume asks it, why, and how it is answered. */
  ask: string;
  why: string;
  kind: "text" | "picture";
  suggestions?: { label: string; text: string }[];
  hint?: string;
  /** The places the same question shows. */
  productId?: Id;
  factId?: Id;
  specFieldId?: string;
  shotSlotId?: string;
  unknownId?: Id;
  answer?: string;
  answeredBy?: Id;
  answeredAt?: string;
}

/** LYSNE's open questions. Hand Balm's brief waits on its claims and a packshot of the tube. */
export const seedQuestions: QuestionRecord[] = [
  {
    id: "q-balm-claims",
    workspaceId: "w-lysne",
    campaignId: "c-balm",
    line: "The claims we may use for Hand Balm",
    href: "/brand/products/pr-balm#needs",
    productId: "pr-balm",
    factId: "f10",
    specFieldId: "claims",
    unknownId: "un1",
    ask: "Which claims may we use for Hand Balm?",
    why: "Every line on a creative must be true. Fume’s expert checks each one against your answer, so we never guess it.",
    kind: "text",
    suggestions: [{ label: "The same as Night Body Oil", text: "For the hour before sleep." }],
    hint: "One claim per line, as it may stand on a creative",
  },
  {
    id: "q-balm-packshot",
    workspaceId: "w-lysne",
    campaignId: "c-balm",
    line: "A packshot of the tube",
    href: "/brand/products/pr-balm#needs",
    productId: "pr-balm",
    shotSlotId: "front",
    ask: "Is this the Hand Balm packshot?",
    why: "The Engine draws the tube from this photo, so its shape, cap and label come out right. Confirm it, or add a better one.",
    kind: "picture",
  },
];
