// The brief, finished where it is read. Before the brief is sent every line is editable in place: press it, change it,
// save. An empty line says so and shows Fume's suggestion, taken from the last brief the customer sent, with "Use it".
// briefGaps is the one rule for when a brief is done (the objective, the audience and the message), in the chat, on the
// brief page and on the form written by hand, so a brief is never sent half empty. One set of names for the brief's
// lines, in one order, lives here (briefLabel, BRIEF_ORDER). The form reads its first line the way Fume reads it in the
// chat (channelsIn, audienceIn, namedIn, nameFrom), so it only asks what it cannot read. Once sent, Fume writes the
// plan from the brief (FLOWS §22). BriefFacts is the whole brief as one list (the Plan tab before the plan exists, and
// "Your brief, sent 13 Oct" under it).
import {
  Button,
  CreativeMedia,
  DataList,
  DataListData,
  DataListItem,
  DataListNote,
  Field,
  FieldLabel,
  Textarea,
  submitOnModEnter,
  useToast,
} from "@fume/ui";
import { useId, useState, type FormEvent, type KeyboardEvent } from "react";
import { useCampaign, useCampaigns, useCatalogue, useChangeBrief } from "../../api/hooks";
import type { Brief, Campaign, Channel, Format, Id, Product } from "../../contract";
import * as copy from "../../copy";
import { due } from "../../lib/time";

type TextKey = "objective" | "audience" | "offer" | "message";
type ListKey = "mandatory" | "never";

/** Every line of a brief, by its one name. Use these words wherever a brief is shown or written: the form's labels, the
 *  brief page, the chat's brief panel and card. */
export const briefLabel = {
  products: "Product",
  objective: "Goal",
  audience: "Audience",
  offer: "Offer",
  message: "Message",
  channels: "Channels",
  formats: "Formats",
  creatives: "Creatives",
  market: "Market",
  live: "Goes live",
  mandatory: "Must show",
  never: "Never",
} as const;
export type BriefLineKey = keyof typeof briefLabel;

/** The brief's lines in the one order every place shows them. */
export const BRIEF_ORDER: BriefLineKey[] = [
  "products",
  "objective",
  "audience",
  "message",
  "channels",
  "formats",
  "creatives",
  "market",
  "live",
  "mandatory",
  "never",
];

/** "Feed 4:5, Story 9:16": the formats as every place writes them. */
export const formatWords = (formats: Format[]) =>
  formats.map((f) => `${copy.format[f].label} ${copy.format[f].ratio}`).join(", ");

const textLines: { key: TextKey; label: string; required: boolean }[] = [
  { key: "objective", label: briefLabel.objective, required: true },
  { key: "audience", label: briefLabel.audience, required: true },
  { key: "offer", label: briefLabel.offer, required: false },
  { key: "message", label: briefLabel.message, required: true },
];
const listLines: { key: ListKey; label: string }[] = [
  { key: "mandatory", label: briefLabel.mandatory },
  { key: "never", label: briefLabel.never },
];

/** The lines a brief still needs before it can be sent, in words: ["Audience", "Message"]. */
export function briefGaps(brief: Pick<Brief, TextKey>): string[] {
  return textLines.filter((l) => l.required && !(brief[l.key] ?? "").trim()).map((l) => l.label);
}

/** The same rule as briefGaps, as the brief's own keys: ["audience", "message"]. For a form that marks its fields. */
export function briefGapKeys(brief: Pick<Brief, TextKey>): TextKey[] {
  return textLines.filter((l) => l.required && !(brief[l.key] ?? "").trim()).map((l) => l.key);
}

/** Fume's suggestion for an empty line: what the customer said last time, in the most recent brief she sent.
 *  `except` leaves out the campaign the brief belongs to; a brief not made yet (the form) passes nothing. */
export function useBriefSuggestion(except?: Id) {
  const campaigns = useCampaigns();
  const last = (campaigns.data ?? []).find((c) => c.id !== except && !["draft", "awaiting_input"].includes(c.state));
  const view = useCampaign(last?.id);
  const brief = view.data?.brief.state === "approved" ? view.data.brief : undefined;
  return { from: last?.name, brief };
}

// ─── Reading the first line, as Fume reads it in the chat ────────────────────────────────────────────────────────

/** Where it runs, read from her words the way the chat reads them: "on Instagram" is Organic social. */
export function channelsIn(text: string): Channel[] {
  const t = text.toLowerCase();
  const out: Channel[] = [];
  if (/paid|\bads?\b|annonse/.test(t)) out.push("paid_social");
  if (/organic|instagram|social/.test(t) && !/paid/.test(t)) out.push("organic_social");
  if (/e-?mail|newsletter|nyhetsbrev/.test(t)) out.push("email");
  return out;
}

/** Who it should reach, when her line says it: "existing customers", "new customers", "both". */
export function audienceIn(text: string): string | undefined {
  const t = text.toLowerCase();
  if (/existing and new|new and existing|both new and existing|eksisterende og nye|alle kunder/.test(t))
    return "Existing and new customers";
  if (/existing customers?|eksisterende kunder|faste kunder/.test(t)) return "Existing customers";
  if (/new customers?|nye kunder/.test(t)) return "New customers";
  return undefined;
}

const OCCASIONS: [RegExp, string][] = [
  [/black friday/, "Black Friday"],
  [/christmas|\bjul\b/, "Christmas"],
  [/mother|morsdag/, "Mother’s Day"],
  [/valentine/, "Valentine’s Day"],
  [/summer|sommer/, "Summer"],
  [/spring|\bvår/, "Spring"],
  [/autumn|høst/, "Autumn"],
];

/** Words of a product's name that say nothing about which product it is ("a Christmas gift" is not the gift box). */
const COMMON = new Set(["gift", "gifts", "with", "edition", "limited", "set", "sets", "pack"]);

/** The products her line names: a whole name, or a word of a name that no other product has ("the candle"). */
export function namedIn(text: string, products: Product[]): Product[] {
  const t = text.toLowerCase();
  if (!t.trim()) return [];
  const whole = products.filter((p) => t.includes(p.name.toLowerCase()));
  const words = new Map<string, Product[]>();
  for (const p of products)
    for (const w of p.name.toLowerCase().split(/\s+/))
      if (w.length >= 4 && !COMMON.has(w)) words.set(w, [...(words.get(w) ?? []), p]);
  const byWord = [...words.entries()]
    .filter(([w, list]) => list.length === 1 && new RegExp(`\\b${w}s?\\b`).test(t))
    .map(([, [p]]) => p);
  return [...new Set([...whole, ...byWord])];
}

/** A name for the campaign, as the chat names it: "Christmas · Night Body Oil"; else the first words of her line. */
export function nameFrom(goal: string, productNames: string[]): string {
  const t = goal.toLowerCase();
  const occasion = OCCASIONS.find(([re]) => re.test(t))?.[1];
  if (occasion && productNames.length === 1) return `${occasion} · ${productNames[0]}`;
  if (occasion) return occasion;
  if (productNames.length === 1) return `${productNames[0]} campaign`;
  const words = goal
    .trim()
    .replace(/[.,;:]+$/, "")
    .split(/\s+/)
    .slice(0, 5)
    .join(" ");
  return words ? words[0].toUpperCase() + words.slice(1) : "New campaign";
}

/** The formats where it runs asks for: social in Feed and Story, the rest Square. */
export function formatsFor(channels: Channel[]): Format[] {
  const out = new Set<Format>();
  for (const c of channels) {
    if (c === "paid_social" || c === "organic_social") out.add("feed").add("story");
    else out.add("square");
  }
  return out.size ? [...out] : ["feed"];
}

/** The editable lines of a brief: objective, audience, offer, message, must show and never. */
export function BriefLines({ brief, campaign, editable }: { brief: Brief; campaign: Campaign; editable: boolean }) {
  const [editing, setEditing] = useState<TextKey | ListKey | null>(null);
  const hint = useBriefSuggestion(campaign.id);
  return (
    <>
      {textLines.map(({ key, label, required }) => {
        const value = brief[key] ?? "";
        if (!value && !required && !editable) return null;
        if (!value && !required && editing !== key) return null;
        return (
          <DataListItem key={key} label={label}>
            {editing === key ? (
              <LineForm
                label={label}
                value={value}
                campaignId={campaign.id}
                field={key}
                onDone={() => setEditing(null)}
              />
            ) : (
              <LineValue
                value={value}
                empty={required ? "Not set yet" : undefined}
                suggestion={!value && editable ? hint.brief?.[key] : undefined}
                field={key}
                campaignId={campaign.id}
                editable={editable}
                label={label}
                onEdit={() => setEditing(key)}
              />
            )}
          </DataListItem>
        );
      })}
      {listLines.map(({ key, label }) => {
        const items = brief[key];
        return (
          <DataListItem key={key} label={label}>
            {editing === key ? (
              <LineForm
                label={label}
                value={items.join("\n")}
                list
                campaignId={campaign.id}
                field={key}
                onDone={() => setEditing(null)}
              />
            ) : (
              <LineValue
                value={items.join(". ")}
                empty="Nothing yet"
                field={key}
                campaignId={campaign.id}
                editable={editable}
                label={label}
                onEdit={() => setEditing(key)}
              />
            )}
          </DataListItem>
        );
      })}
    </>
  );
}

function LineValue({
  value,
  empty,
  suggestion,
  field,
  campaignId,
  editable,
  label,
  onEdit,
}: {
  value: string;
  empty?: string;
  suggestion?: string;
  field: TextKey | ListKey;
  campaignId: string;
  editable: boolean;
  label: string;
  onEdit: () => void;
}) {
  const change = useChangeBrief();
  const toast = useToast();
  const use = () =>
    change.mutate(
      { campaignId, change: { [field]: suggestion } },
      {
        onSuccess: () => toast.done(`${label} filled in`),
        onError: (e) => toast.error(`${label} wasn’t saved`, { description: e.message }),
      },
    );
  return (
    <>
      <span>{value || empty}</span>
      {/* Fume's suggestion in its own words, without "as in <another campaign>". */}
      {suggestion && <DataListNote>Fume suggests “{suggestion.replace(/[.\s]+$/, "")}”</DataListNote>}
      {editable && (
        <span className="ui-app-row">
          {suggestion && (
            <Button variant="secondary" size="sm" icon="check" loading={change.isPending} onClick={use}>
              Use it
            </Button>
          )}
          {value ? (
            <Button
              variant="quiet"
              size="sm"
              iconOnly
              icon="pencil"
              onClick={onEdit}
              aria-label={`Change the ${label.toLowerCase()}`}
            />
          ) : (
            // One verb for editing a line: Change.
            <Button
              variant="quiet"
              size="sm"
              icon="pencil"
              onClick={onEdit}
              aria-label={`Change the ${label.toLowerCase()}`}
            >
              Change
            </Button>
          )}
        </span>
      )}
    </>
  );
}

function LineForm({
  label,
  value,
  list,
  campaignId,
  field,
  onDone,
}: {
  label: string;
  value: string;
  list?: boolean;
  campaignId: string;
  field: TextKey | ListKey;
  onDone: () => void;
}) {
  const id = useId();
  const [text, setText] = useState(value);
  const change = useChangeBrief();
  const toast = useToast();
  function save(event: FormEvent) {
    event.preventDefault();
    const next = list
      ? text
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
      : text.trim();
    change.mutate(
      { campaignId, change: { [field]: next } },
      {
        onSuccess: () => {
          toast.done(`${label} saved`);
          onDone();
        },
        onError: (e) => toast.error(`${label} wasn’t saved`, { description: e.message }),
      },
    );
  }
  // Esc leaves the line as it was (the field first, never the page behind); ⌘↵ saves it.
  const keys = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key === "Escape" && !e.defaultPrevented) {
      e.preventDefault();
      e.stopPropagation();
      onDone();
      return;
    }
    submitOnModEnter(e);
  };
  return (
    <form onSubmit={save} onKeyDown={keys} className="ui-app-stack ui-app-stack--tight">
      <Field>
        <FieldLabel htmlFor={id} className="ui-sr-only">
          {label}
        </FieldLabel>
        <Textarea
          id={id}
          value={text}
          rows={list ? 3 : 2}
          autoFocus
          onChange={(e) => setText(e.target.value)}
          placeholder={list ? "One line each" : undefined}
        />
      </Field>
      <div className="ui-app-row">
        <Button type="submit" size="sm" loading={change.isPending}>
          Save
        </Button>
        <Button type="button" variant="quiet" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** The whole brief as one list, in BRIEF_ORDER: the product, her lines (changeable in place until it is sent), where it
 *  runs, the formats, how many creatives, the market and the go-live, then her reference pictures. */
export function BriefFacts({
  brief,
  campaign,
  editable,
  made = 0,
}: {
  brief: Brief;
  campaign: Campaign;
  editable: boolean;
  made?: number;
}) {
  const catalogue = useCatalogue();
  const products = (catalogue.data?.products ?? []).filter((p) => campaign.productIds.includes(p.id));
  // The brief's number and what is made agree: once creatives exist and the count differs, both are said.
  const creatives =
    made > 0 && made !== brief.creatives ? `${brief.creatives} · ${made} made so far` : String(brief.creatives);
  return (
    <>
      <DataList className="ui-plandoc-brieflist">
        {products.length > 0 && (
          <DataListItem label={briefLabel.products}>{products.map((p) => p.name).join(", ")}</DataListItem>
        )}
        <BriefLines brief={brief} campaign={campaign} editable={editable} />
        <DataListItem label={briefLabel.channels}>
          {brief.channels.map((c) => copy.channel[c]).join(", ") || "Not set yet"}
        </DataListItem>
        <DataListItem label={briefLabel.formats}>
          {brief.formats.length ? formatWords(brief.formats) : "Not set yet"}
        </DataListItem>
        <DataListItem label={briefLabel.creatives}>
          <DataListData>{creatives}</DataListData>
        </DataListItem>
        <DataListItem label={briefLabel.market}>
          {campaign.market}, in {copy.languageName(campaign.language)}
        </DataListItem>
        <DataListItem label={briefLabel.live}>{campaign.dueAt ? due(campaign.dueAt) : "Not set yet"}</DataListItem>
      </DataList>
      {brief.references.length > 0 && (
        <div className="ui-app-stack ui-app-stack--tight">
          <p className="ui-app-section-text">References</p>
          <div className="ui-app-grid">
            {brief.references.map((src, i) => (
              <CreativeMedia key={src} src={src} alt={`Reference ${i + 1}`} ratio={1} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
