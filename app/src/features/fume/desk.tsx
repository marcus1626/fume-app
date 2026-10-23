// The Fume chat on a desk (round 9, PROPOSED 19 Oct 2026; UX review DLAY-5, DTSK-13, DTSK-4, DTSK-3).
// Round 10 (PROPOSED 20 Oct 2026; FLOWS §23, Marcus's card "Én samtale"): there is ONE conversation, so the list of
// conversations is gone; the head names it "Fume". From 1280 px, while a campaign is being briefed, "The brief" fills
// in on the right, line by line as she answers, with the same lines, names and order as the plan page's brief
// (brief-lines.tsx), each line changed in place, and "Send to Fume" pinned at its foot: she SENDS the brief, Fume
// writes the plan from it, and she approves the plan before anything is made. Once it is sent the panel follows the
// campaign as "The plan" (plan.tsx). A phone keeps the brief card in the conversation.
import { Button, DataList, DataListItem, DataListNote, Field, FieldLabel, submitOnModEnter, Textarea, useToast } from "@fume/ui";
import { useId, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { useCatalogue, useChangeBrief, useHome, useSendBrief, useSession } from "../../api/hooks";
import type { Brief, CampaignView, Id } from "../../contract";
import * as copy from "../../copy";
import { date } from "../../lib/time";
import { BRIEF_ORDER, briefGaps, briefLabel, formatWords, type BriefLineKey } from "../campaigns/brief-lines";

// ─── The conversation's head ────────────────────────────────────────────────

/** The one conversation's name over it, at its left edge, small, so the conversation keeps the height; its quiet
 *  actions (Jump to a campaign, New campaign) on the right of the same line. */
export function ChatHead({ children }: { children?: ReactNode }) {
  return (
    <header className="ui-chat-head">
      <h1 className="ui-chat-head-title" tabIndex={-1}>
        Fume
      </h1>
      {children && <div className="ui-chat-head-actions">{children}</div>}
    </header>
  );
}

// ─── The brief, line by line ────────────────────────────────────────────────

type EditKey = "objective" | "audience" | "message" | "mandatory" | "never";
const editable: Partial<Record<BriefLineKey, EditKey>> = { objective: "objective", audience: "audience", message: "message", mandatory: "mandatory", never: "never" };

export interface BriefRow {
  key: BriefLineKey;
  label: string;
  /** What the brief says; undefined while it says nothing yet. */
  value?: string;
  /** A quiet line under the value ("of the 16 left in your package"). */
  note?: string;
  /** What shows while it is empty: "Fume is asking", "Not yet", "Nothing yet". */
  empty: string;
  /** Fume is asking about this line now. */
  asking?: boolean;
  /** The brief's own key when she can change this line in place. */
  edit?: EditKey;
}

/** Which line a missing answer fills ("Who it should reach" → audience). */
function missingLine(missing: string): BriefLineKey | undefined {
  if (/product/i.test(missing)) return "products";
  if (/market/i.test(missing)) return "market";
  if (/reach|audience/i.test(missing)) return "audience";
  if (/live|date|when/i.test(missing)) return "live";
  if (/say|message/i.test(missing)) return "message";
  if (/goal|objective/i.test(missing)) return "objective";
  return undefined;
}

/**
 * Every line of the brief in the one order (BRIEF_ORDER) with the one names (briefLabel), as the brief page shows
 * them (DTSK-4: the chat shows the whole brief, the formats, how many creatives and the market too). `named` are the
 * products she named that wait to be confirmed.
 */
export function useBriefRows(view: CampaignView | undefined, named: string[] = []): BriefRow[] {
  const catalogue = useCatalogue().data;
  const usage = useHome().data?.usage;
  // An agency pays by use, not from a package (round 12, DLOAD-6): its brief says the creatives count in the month.
  const byUse = Boolean(useSession().data?.workspace.agencyId);
  const brief: Brief | undefined = view?.brief;
  const campaign = view?.campaign;
  const missing = new Set((brief?.missing ?? []).map(missingLine).filter(Boolean) as BriefLineKey[]);
  const asking = brief?.state === "drafting" ? missingLine(brief.missing[0] ?? "") : undefined;
  const products = (catalogue?.products ?? []).filter((p) => campaign?.productIds.includes(p.id)).map((p) => p.name);
  const collections = campaign?.collectionIds?.length ?? 0;
  const left = usage ? Math.max(0, usage.creativeCap - usage.creativesUsed) : undefined;
  const open = brief && brief.state !== "approved";
  const value = (key: BriefLineKey): Pick<BriefRow, "value" | "note"> => {
    if (!brief || !campaign) return {};
    switch (key) {
      case "products":
        if (products.length) return { value: products.join(", ") };
        if (collections) return { value: copy.count(collections, "collection") };
        return named.length ? { value: named.join(" and "), note: "Not confirmed yet" } : {};
      case "objective":
      case "audience":
      case "message":
        return brief[key]?.trim() ? { value: brief[key] } : {};
      case "channels":
        return brief.channels.length ? { value: brief.channels.map((c) => copy.channel[c]).join(", ") } : {};
      case "formats":
        return brief.formats.length ? { value: formatWords(brief.formats) } : {};
      case "creatives":
        // What it costs, before she sends it (DTSK-4): the number, and what is left in her package.
        return brief.creatives > 0
          ? { value: String(brief.creatives), note: !open ? undefined : byUse ? "Counted in this month’s usage" : left !== undefined ? `Of the ${left} left in your package` : undefined }
          : {};
      case "market":
        return campaign.market ? { value: campaign.language ? `${campaign.market}, in ${campaign.language}` : campaign.market } : {};
      case "live":
        if (campaign.dueAt) return { value: date(campaign.dueAt) };
        return missing.has("live") ? {} : { value: "No fixed date" };
      case "mandatory":
      case "never":
        return brief[key].length ? { value: brief[key].join(". ") } : {};
      default:
        return {};
    }
  };
  return BRIEF_ORDER.map((key) => {
    const v = value(key);
    const empty = key === asking ? "Fume is asking" : key === "mandatory" || key === "never" ? "Nothing yet" : "Not yet";
    // A line Fume still asks about is answered in the chat; the rest can be changed here before she sends it.
    const edit = open && editable[key] && !missing.has(key) && (v.value || brief?.state === "ready") ? editable[key] : undefined;
    return { key, label: briefLabel[key], ...v, empty, asking: key === asking && !v.value, edit };
  });
}

/** The lines as a data list; with `onEdit` each line she may change carries its pencil, and the open one its form.
 *  Saving or putting a line back returns the focus to its pencil (DTSK-20). */
export function BriefRowsList({
  rows,
  campaignId,
  editing,
  onEdit,
  variant,
}: {
  rows: BriefRow[];
  campaignId?: Id;
  editing?: BriefLineKey | null;
  onEdit?: (key: BriefLineKey | null) => void;
  variant?: "default" | "stacked";
}) {
  const uid = useId();
  const pencil = (key: BriefLineKey) => `${uid}-edit-${key}`;
  const done = (key: BriefLineKey) => {
    onEdit?.(null);
    // once the line is back on the page; again if the saved brief redrew it before she moved on
    let tries = 0;
    const start = document.activeElement;
    const back = () => {
      const a = document.activeElement;
      if (a && a !== document.body && a !== start && a.isConnected && a.id !== pencil(key)) return;
      const el = document.getElementById(pencil(key));
      if (el && a !== el) el.focus();
      if (tries++ < 30) window.requestAnimationFrame(back);
    };
    window.requestAnimationFrame(back);
  };
  return (
    <DataList variant={variant} className="ui-chat-brief-lines">
      {rows.map((r) => (
        <DataListItem key={r.key} label={r.label}>
          {editing === r.key && r.edit && campaignId && onEdit ? (
            <LineForm label={r.label} field={r.edit} value={r.value ?? ""} campaignId={campaignId} onDone={() => done(r.key)} />
          ) : (
            <>
              {r.value ? <span className="ui-chat-brief-value">{r.value}</span> : <span className={r.asking ? "ui-chat-brief-value ui-chat-brief-asking" : "ui-chat-brief-value ui-chat-brief-empty"}>{r.empty}</span>}
              {r.note && <DataListNote>{r.note}</DataListNote>}
              {r.edit && onEdit && (
                <Button
                  id={pencil(r.key)}
                  variant="quiet"
                  size="sm"
                  iconOnly
                  icon="pencil"
                  className="ui-chat-brief-edit"
                  aria-label={`Change the ${r.label.toLowerCase()}`}
                  onClick={() => onEdit(r.key)}
                />
              )}
            </>
          )}
        </DataListItem>
      ))}
    </DataList>
  );
}

/** One line changed in place (DTSK-13: never a full page). ⌘↵ saves, Esc puts it back. */
function LineForm({ label, field, value, campaignId, onDone }: { label: string; field: EditKey; value: string; campaignId: Id; onDone: () => void }) {
  const id = useId();
  const list = field === "mandatory" || field === "never";
  const [text, setText] = useState(list ? value.split(". ").join("\n") : value);
  const change = useChangeBrief();
  const toast = useToast();
  function save(event?: FormEvent) {
    event?.preventDefault();
    const next = list ? text.split("\n").map((s) => s.trim().replace(/\.$/, "")).filter(Boolean) : text.trim();
    change.mutate(
      { campaignId, change: { [field]: next } },
      {
        onSuccess: () => {
          toast.done(`${label} changed.`);
          onDone();
        },
        onError: (e) => toast.error(`${label} wasn’t changed`, { description: e.message }),
      },
    );
  }
  // ⌘↵ / Ctrl+↵ saves: the form's own submit (SHELL's submitOnModEnter); Esc is the field's.
  const keys = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      // The field first: Esc closes this line, nothing behind it.
      e.preventDefault();
      e.stopPropagation();
      onDone();
    }
  };
  return (
    <form onSubmit={save} onKeyDown={submitOnModEnter} className="ui-app-stack ui-app-stack--tight">
      <Field>
        <FieldLabel htmlFor={id} className="ui-sr-only">
          {label}
        </FieldLabel>
        <Textarea id={id} value={text} rows={list ? 3 : 2} autoFocus onChange={(e) => setText(e.target.value)} onKeyDown={keys} placeholder={list ? "One line each" : undefined} />
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

// ─── The brief panel ────────────────────────────────────────────────────────

export interface BriefPanelProps {
  /** The campaign being briefed; undefined while she is still saying what it is for. */
  view?: CampaignView;
  /** Products she named that wait to be confirmed. */
  named?: string[];
  canAct: boolean;
  /** Who sends the brief, when it is not her ("Maja"). */
  approver?: string;
  /** She pressed Send: the chat follows this campaign (the panel turns into "The plan") and Fume's next line comes into
   *  view. Called before the brief goes out, as Fume's answer can arrive with it. */
  onSending?: () => void;
  /** The brief was sent from here: the focus goes back to the composer. */
  onSent?: () => void;
}

/** What the panel says under its title: what sending does, so nothing reads as made before the plan is approved. */
export const SEND_LINE = "Fume writes the plan from it. You approve the plan before anything is made.";

/** "The brief" beside the conversation, filling in as she answers; "Send to Fume" pinned at its foot (DLAY-5,
 *  DTSK-3/4/13; round 10: she sends the brief, she approves the plan). */
export function BriefPanel({ view, named, canAct, approver, onSending, onSent }: BriefPanelProps) {
  const role = useSession().data?.role;
  const send = useSendBrief();
  const toast = useToast();
  const rows = useBriefRows(view, named);
  const [editing, setEditing] = useState<BriefLineKey | null>(null);
  const brief = view?.brief;
  const campaign = view?.campaign;
  const covers = (campaign?.productIds.length ?? 0) + (campaign?.collectionIds?.length ?? 0);
  const gaps = brief ? briefGaps(brief) : [];
  const ready = brief?.state === "ready" && brief.missing.length === 0;
  const maySend = canAct && (role === "owner" || role === "approver");
  const canSend = maySend && ready && gaps.length === 0 && covers > 0;

  let note: string;
  if (!brief || brief.state === "drafting") note = "Fume fills this in as you answer, one question at a time.";
  else if (editing) note = "Save the line, then send the brief.";
  else if (gaps.length) note = `Write the ${gaps.join(" and the ").toLowerCase()} to send it.`;
  else if (!covers) note = "Pick the product in the chat to send it.";
  else if (!maySend) note = `${approver ?? "The approver"} sends the brief to Fume.`;
  else note = "It goes to Fume as it reads here.";

  return (
    <aside className="ui-chat-brief" aria-labelledby="fume-brief-title">
      <div className="ui-chat-brief-head">
        <h2 className="ui-chat-brief-title" id="fume-brief-title" tabIndex={-1}>
          The brief
        </h2>
        {campaign && <p className="ui-chat-brief-meta">{campaign.name}</p>}
        <p className="ui-chat-brief-lead">{SEND_LINE}</p>
      </div>
      <div className="ui-chat-brief-body">
        <BriefRowsList rows={rows} campaignId={campaign?.id} editing={editing} onEdit={canAct ? setEditing : undefined} />
      </div>
      <div className="ui-chat-brief-foot">
        <p className="ui-chat-brief-note" role="status">
          {note}
        </p>
        {canSend && !editing && (
          <Button
            icon="send"
            loading={send.isPending}
            onClick={() => {
              if (!campaign) return;
              onSending?.();
              // mutateAsync: once sent, this panel makes way for "The plan", and the toast and the focus still follow.
              send.mutateAsync(campaign.id).then(
                () => {
                  toast.done("Sent to Fume.", { description: "Fume is writing the plan. Nothing is made before you approve it." });
                  onSent?.();
                },
                (e: Error) => toast.error("The brief wasn’t sent", { description: e.message }),
              );
            }}
          >
            Send to Fume
          </Button>
        )}
      </div>
    </aside>
  );
}
