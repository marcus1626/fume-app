// A delivery in the app's words: its state and the one data line under its name.
import { Badge } from "@fume/ui";
import type { Collection, Delivery } from "../../contract";
import * as copy from "../../copy";
import { bytes, date } from "../../lib/time";

export const deliveryState: Record<Delivery["state"], string> = {
  preparing: "Being prepared",
  ready: "Ready to download",
  downloaded: "Downloaded",
  confirmed_live: "Live",
};

/** "Whole campaign" or "Collection · AW26". */
export function scopeWords(d: Delivery, collections?: Collection[]): string {
  if (d.scope !== "collection") return "Whole campaign";
  const name = collections?.find((c) => c.id === d.collectionId)?.name;
  return name ? `Collection · ${name}` : "One collection";
}

/** "2 creatives · Feed, Story · 9.6 MB · 12 Oct" */
export const deliveryLine = (d: Delivery) =>
  [
    copy.creatives(d.creativeIds.length),
    d.formats.map((f) => copy.format[f].label).join(", "),
    bytes(d.bytes),
    date(d.createdAt),
  ].join(" · ");

/** The state as a badge: ready to download wears Moss, the proposed state green (round 13, #39); a breathing dot while
 *  it is prepared, a quiet one once it is downloaded or live. */
export function DeliveryBadge({ state }: { state: Delivery["state"] }) {
  return (
    <Badge
      dot={state === "ready" ? "on" : state === "preparing" ? "live" : "idle"}
      className={state === "ready" ? "ui-badge--ready" : undefined}
    >
      {deliveryState[state]}
    </Badge>
  );
}

/** Who may take a delivery: everyone but a viewer (copy.roleHelp). */
export const canTake = (role: string | null) => role === "owner" || role === "approver" || role === "member";
