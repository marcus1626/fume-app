// What the studio's screens share: the words for Fume's own people (they see states the customer never does), the
// service clock in words, what changed since a creative's last version, and the queue's grouping by due date.
// The studio speaks to the expert and the operator, so it names the customer's people and the workspace plainly.
import { Badge } from "@fume/ui";
import type {
  CampaignState,
  CheckArea,
  CheckState,
  Creative,
  Format,
  ServiceClock,
  Severity,
  StaffRole,
} from "../../contract";
import * as copy from "../../copy";
import { due, now } from "../../lib/time";

/** The six areas of the Quality Gate list (Roadmap §11.2), in the order the expert works through them. */
export const areas: CheckArea[] = ["product_truth", "brand_rules", "claims", "channel", "artifacts", "naming"];

export const areaLabel: Record<CheckArea, string> = {
  product_truth: "Product Truth",
  brand_rules: "Brand rules",
  claims: "Claims",
  channel: "Channel",
  artifacts: "Artefacts",
  naming: "Naming",
};

export const severityLabel: Record<Severity, string> = { critical: "Critical", major: "Major", minor: "Minor" };

export const staffRoleLabel: Record<StaffRole, string> = { expert: "Expert", operator: "Operator", admin: "Admin" };

/** A check's state in the studio's words (the expert's own view; the customer only ever sees counts). */
export const checkStateLabel: Record<CheckState, string> = {
  waiting: "Waiting",
  in_check: "In check",
  checked: "Checked",
  changes_requested: "Sent back for correction",
  held: "Held back",
};

/** A campaign's state for Fume's people: the same states as the customer's, said from Fume's side. */
export const campaignStateForStaff: Record<CampaignState, string> = {
  draft: "Brief with Fume",
  awaiting_input: "Waiting on the customer",
  scoped: "Brief sent",
  in_production: "In production",
  in_review: "With the customer",
  revision: "Customer changes under way",
  approved: "Approved",
  delivered: "Delivered",
  closed: "Closed",
};

/** "Feed 4:5" */
export const formatName = (format: Format) => `${copy.format[format].label} ${copy.format[format].ratio}`;

/**
 * What changed since the creative's last version, in words. The contract keeps no change note on a version, so the
 * line reads it from the version chain: what happened to the version before this one.
 */
export function whatChanged(creative: Creative): string {
  const versions = creative.versions;
  if (versions.length < 2) return "First version";
  const before = versions[versions.length - 2]!;
  if (before.state === "changes_requested") return `Remade after the customer’s changes to V${before.number}`;
  if (before.state === "correcting" || before.state === "held") return `Corrected from V${before.number}`;
  return `New since V${before.number}`;
}

/** The service clock in words: "Due Fri 17 Oct", "Paused: Fume needs the Hand Balm claims." */
export function clockWords(clock: ServiceClock | undefined, dueAt?: string): string {
  if (!clock) return dueAt ? `Due ${due(dueAt)}` : "No date yet";
  switch (clock.state) {
    case "paused_waiting_on_you":
      return `Paused${clock.pausedReason ? `: ${clock.pausedReason}` : ", waiting on the customer"}`;
    case "met":
      return "Met";
    case "missed":
      return `Missed, was due ${due(clock.dueAt)}`;
    default:
      return `${copy.stage[clock.stage]} due ${due(clock.dueAt)}`;
  }
}

/** The clock as a badge: paused and missed are the ones the operator acts on. */
export function ClockBadge({ clock }: { clock: ServiceClock | undefined }) {
  if (!clock) return null;
  if (clock.state === "paused_waiting_on_you") return <Badge icon="pause">Paused</Badge>;
  if (clock.state === "missed")
    return (
      <Badge variant="danger" icon="clock">
        Missed
      </Badge>
    );
  if (clock.state === "met") return <Badge icon="circle-check">Met</Badge>;
  return <Badge icon="clock">Due {due(clock.dueAt)}</Badge>;
}

/** "Due today" holds what is due today and anything already late; the rest is "Later". */
export function dueGroup(dueAt: string): "today" | "later" {
  return due(dueAt) === "today" || Date.parse(dueAt) < now() ? "today" : "later";
}

/** A note with no pin on the creative: the contract asks for a place, so the studio sends one outside the creative. */
export const UNPINNED = -1;
export const isPinned = (note: { x: number; y: number }) => note.x >= 0 && note.y >= 0;
