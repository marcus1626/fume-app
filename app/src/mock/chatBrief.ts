// How the mock's Fume reads a new campaign from the chat: the products named (whole names, or a word only one product
// has: "the candle"), the occasion, a name and an objective written out, the audience in words, and an open campaign
// with the same occasion, so Fume asks before making a second one. Then it asks only what it cannot read from the
// first line or the Brand DNA, one question at a time; each answer fills its line of the brief.
import type { Campaign, Channel, Message, Product, ProductQuestionCard } from "../contract";
import type { BriefQuestion } from "./context";

const OCCASIONS: [string, string][] = [
  ["black friday", "Black Friday"],
  ["christmas", "Christmas"],
  ["jul", "Christmas"],
  ["mother", "Mother’s Day"],
  ["morsdag", "Mother’s Day"],
  ["valentine", "Valentine’s Day"],
  ["summer", "Summer"],
  ["sommer", "Summer"],
  ["spring", "Spring"],
  ["vår", "Spring"],
  ["autumn", "Autumn"],
  ["høst", "Autumn"],
];

export const occasionOf = (said: string) => OCCASIONS.find(([k]) => new RegExp(`\\b${k}`).test(said))?.[1];

/** The products named: a whole name, or a word of a name that no other product has ("candle", "diffuser"). */
export function productsNamed(said: string, products: Product[]): Product[] {
  const t = said.toLowerCase();
  const whole = products.filter((p) => t.includes(p.name.toLowerCase()));
  const words = new Map<string, Product[]>();
  for (const p of products)
    for (const w of p.name.toLowerCase().split(/\s+/)) if (w.length >= 4) words.set(w, [...(words.get(w) ?? []), p]);
  const byWord = [...words.entries()]
    .filter(([w, list]) => list.length === 1 && new RegExp(`\\b${w}s?\\b`).test(t))
    .map(([, [p]]) => p);
  return [...new Set([...whole, ...byWord])];
}

const listWords = (names: string[]) =>
  names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

export function campaignName(occasion: string | undefined, products: Product[]): string {
  const names = products.map((p) => p.name);
  if (occasion && names.length === 1) return `${occasion} · ${names[0]}`;
  if (occasion) return occasion;
  if (names.length === 1) return `${names[0]} campaign`;
  return names.length ? `${listWords(names.slice(0, 2))}${names.length > 2 ? " and more" : ""}` : "New campaign";
}

const channelWords: Record<Channel, string> = {
  paid_social: "paid social",
  organic_social: "organic social",
  email: "email",
  product_page: "the product page",
  display: "display ads",
};

/** "Sell Evening Candle as a Christmas gift in paid social." */
export function objectiveOf(occasion: string | undefined, products: Product[], channels: Channel[]): string {
  const what = products.length ? listWords(products.map((p) => p.name)) : "the products";
  const when = occasion
    ? /christmas|mother|valentine/i.test(occasion)
      ? ` as a ${occasion} gift`
      : ` for ${occasion}`
    : "";
  const where = channels.length ? ` in ${listWords(channels.map((c) => channelWords[c]))}` : "";
  return `Sell ${what}${when}${where}.`;
}

/** The audience answer in words: a tapped option becomes a phrase, typed words stay as typed. */
export function audienceWords(answer: string): string {
  const a = answer.trim();
  if (/^both$/i.test(a)) return "Existing and new customers";
  if (/^existing customers$/i.test(a)) return "Existing customers";
  if (/^new customers$/i.test(a)) return "New customers";
  return a;
}

/** An open campaign with the same occasion (or the same name). */
export function sameCampaign(campaigns: Campaign[], occasion: string | undefined, name: string): Campaign | undefined {
  const open = campaigns.filter((c) => !["closed", "delivered"].includes(c.state));
  return open.find(
    (c) =>
      (occasion && c.name.toLowerCase().includes(occasion.toLowerCase())) ||
      c.name.toLowerCase() === name.toLowerCase(),
  );
}

export const productQuestion = {
  // Said once, by the card: Fume's line is the card's question.
  text: "Which product is it for?",
  question: "Which product is it for?",
  why: "We make creatives of the real product, as you have confirmed it.",
  missing: "Which product it is for",
};

/** The audience when the first line names it ("existing customers", "nye kunder"), so Fume does not ask again. */
export function audienceIn(said: string): string | undefined {
  const t = said.toLowerCase();
  const existing =
    /\b(existing|current|loyal|returning|our)\s+customers\b|eksisterende kunder|faste kunder|våre kunder/.test(t);
  const fresh = /\bnew\s+(customers|audience)\b|nye kunder/.test(t);
  if ((existing && fresh) || /\bboth\b[^.]*customers|begge/.test(t)) return "Existing and new customers";
  if (existing) return "Existing customers";
  if (fresh) return "New customers";
  return undefined;
}

const MONTHS = ["jan", "feb", "mar", "apr", "ma", "jun", "jul", "aug", "sep", "o", "nov", "d"];

/** A day written in words ("1 Dec", "15. november", "from 3 des"), as the next such day after `from`. */
export function dayIn(said: string, from: string): string | undefined {
  const day = /\b(\d{1,2})\.?\s*(jan|feb|mar|apr|may|mai|jun|jul|aug|sep|oct|okt|nov|dec|des)/i.exec(said);
  if (!day) return undefined;
  const month = MONTHS.findIndex((m) => day[2].toLowerCase().startsWith(m));
  if (month < 0) return undefined;
  const start = new Date(from);
  const year = start.getUTCFullYear() + (month < start.getUTCMonth() ? 1 : 0);
  return new Date(Date.UTC(year, month, +day[1], 15)).toISOString();
}

/** When it should go live, as options that fit the occasion: a Christmas campaign is not offered "in two weeks". */
export function dateOptions(occasion: string | undefined): { text: string; options: string[] } {
  const fit: Record<string, string[]> = {
    Christmas: ["From 15 Nov", "From 1 Dec"],
    "Black Friday": ["From 20 Nov", "On 27 Nov"],
    "Valentine’s Day": ["From 1 Feb", "On 14 Feb"],
  };
  // Fume's line leads into the card and never repeats its question (a line equal to it is not shown).
  if (occasion && fit[occasion])
    return {
      text: `For ${occasion}, we would go live in good time. Tap a day, or write your own.`,
      options: [...fit[occasion], "No fixed date"],
    };
  return { text: "When should it go live?", options: ["In two weeks", "In a month", "No fixed date"] };
}

/** The line every creative carries, as Fume would put it for the occasion, and the brand's last approved one. */
export function messageOptions(
  occasion: string | undefined,
  lastApproved: string | undefined,
): { text: string; options: string[] } {
  const byOccasion: Record<string, string> = {
    Christmas: "Something soft, given.",
    "Black Friday": "The ritual, for less.",
    "Valentine’s Day": "Kept close.",
    "Mother’s Day": "For the one who gave you evenings.",
    Summer: "Light that stays late.",
    Autumn: "Warmth, kept.",
  };
  const ours = (occasion && byOccasion[occasion]) || "Made to be felt.";
  const options = [...new Set([ours, ...(lastApproved ? [lastApproved] : [])])];
  return {
    text:
      options.length > 1
        ? "Last thing. The first line is our suggestion, the second is the one from your last brief. Or write your own."
        : "Last thing. Tap our suggestion, or write your own line.",
    options,
  };
}

const messageQuestion = {
  missing: "What it should say",
  text: "Last thing. Tap our suggestion, or write your own line.",
  question: "What should it say?",
  why: "It is the one line every creative carries, in the pictures more than in words.",
};

/** What Fume can ask about a brief started in the chat. The market comes from Settings; the message is asked last, so
 *  a chat brief passes the same gaps rule as the form. */
export const briefQuestions: BriefQuestion[] = [
  {
    key: "market",
    missing: "Which market it is for",
    text: "Which market is this for? It decides the language and the claims we can use.",
    question: "Which market is this for?",
    why: "It decides the language and the claims we can use.",
    options: ["Norway", "Sweden", "The Nordics"],
    fill: (answer, c) =>
      Object.assign(c, {
        market: answer,
        language: /swed|sver/i.test(answer)
          ? "Swedish"
          : /nordic|norden/i.test(answer)
            ? "Norwegian and Swedish"
            : "Norwegian",
      }),
  },
  {
    key: "audience",
    missing: "Who it should reach",
    text: "Who should it reach?",
    question: "Who should it reach?",
    why: "It decides the tone, and whether we show the product new or as an old friend.",
    options: ["Existing customers", "New customers", "Both"],
    fill: (answer, _c, b) => Object.assign(b, { audience: audienceWords(answer) }),
  },
  {
    key: "date",
    missing: "When it goes live",
    text: "When should it go live?",
    question: "When should it go live?",
    why: "We plan the work back from that day and tell you if your package needs longer.",
    options: ["In two weeks", "In a month", "No fixed date"],
    fill: (answer, c) => {
      // A day in words ("From 1 Dec", "15. november") is that day.
      const day = dayIn(answer, c.createdAt);
      const days = /two weeks|2 weeks/i.test(answer) ? 14 : /month/i.test(answer) ? 30 : 0;
      if (day) c.dueAt = day;
      else if (days) c.dueAt = new Date(Date.parse(c.createdAt) + days * 864e5).toISOString();
    },
  },
  {
    key: "message",
    missing: messageQuestion.missing,
    text: messageQuestion.text,
    question: messageQuestion.question,
    why: messageQuestion.why,
    options: [],
    fill: (answer, _c, b) => Object.assign(b, { message: answer.trim().replace(/^[“"]|[”"]$/g, "") }),
  },
];

/** A question as the card Fume shows; the product question carries the products she named. */
export function questionCard(q: BriefQuestion): Message["card"] {
  const card: ProductQuestionCard = {
    kind: "question",
    question: q.question,
    why: q.why,
    options: q.options,
    ...(q.productIds ? { productIds: q.productIds } : {}),
    ...(q.named?.length ? { named: q.named } : {}),
  };
  return card;
}
