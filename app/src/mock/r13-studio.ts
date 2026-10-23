// Round 13, builder E (studio). Robots' note 06: checking a creative of a campaign whose set already went to the
// customer said "Not sent to Maja yet" in Check, yet the creative went straight to "With the customer" (6 -> 8) and
// "To send" never showed. Checked work reaches the customer only when it is sent (ARCHITECTURE §5.2, brief r12), also
// after the first set: a creative checked once its campaign is out of production waits here until the next "Send to
// Maja" (release). While a campaign is in production its whole checked set waits anyway (toSendOf, r9-campaign.ts);
// an agency's sends are r11-client.ts's own.
import type { Creative, Id } from "../contract";

/** Version ids checked after their campaign's set was sent, not sent yet. */
const unsent = new Set<Id>();

/** The check holds this version back from the customer until its campaign's next send. */
export const holdUntilSent = (versionId: Id) => void unsent.add(versionId);

/** Undo the check: nothing to hold. */
export const releaseHold = (versionId: Id) => void unsent.delete(versionId);

/** True for a checked creative Fume has not sent to the customer yet (outside a campaign in production). */
export const unsentByFume = (c: Creative) => c.current.state === "checked" && unsent.has(c.current.id);

/** "Send to Maja": every held creative of the campaign goes to the customer. */
export function sendHeld(creatives: Creative[], campaignId: Id) {
  for (const c of creatives) if (c.campaignId === campaignId) unsent.delete(c.current.id);
}
