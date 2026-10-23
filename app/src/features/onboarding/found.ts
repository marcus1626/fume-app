// What Fume found that she has not confirmed yet: the one count the onboarding uses (step 2's summary, step 3's
// parts and its "12 left" in the progress, step 1's Continue, and the end card's "12 finds are not confirmed yet").
// Round 9 (desktop review DTSK-5, PROPOSED 19 Oct 2026): it lives on its own so the frame can count without
// importing the steps.
import type { BrandIdentity, Provenance } from "../../contract";

/** The parts of step 3, in order. Products are not part of the onboarding: each is confirmed when it is first used. */
export const checkParts = [
  { id: "logo", label: "Logo" },
  { id: "colour", label: "Colour" },
  { id: "type", label: "Type" },
  { id: "imagery", label: "Imagery" },
  { id: "voice", label: "Voice" },
] as const;
export type CheckPart = (typeof checkParts)[number]["id"];

export const isOpen = (p: { provenance: Provenance }) => p.provenance.state === "proposed";

export function listOf(identity: BrandIdentity, part: CheckPart): { provenance: Provenance }[] {
  if (part === "logo") return identity.logos;
  if (part === "colour") return identity.colours;
  if (part === "type") return identity.typefaces;
  if (part === "imagery") return identity.imagery;
  // Round 13 (#4): the voice is five parts (Identity, How we speak, Rules, Audience, Examples), each confirmed once
  return identity.voiceBook?.parts ?? identity.voice;
}

/** The open items of one part. */
export const openIn = (identity: BrandIdentity, part: CheckPart | string) => listOf(identity, part as CheckPart).filter(isOpen).length;

/** The open items of all five parts. */
export const openTotal = (identity: BrandIdentity) => checkParts.reduce((sum, p) => sum + openIn(identity, p.id), 0);

/** The first part with something open, for "Confirm them now". */
export const firstOpenPart = (identity: BrandIdentity): CheckPart | undefined => checkParts.find((p) => openIn(identity, p.id) > 0)?.id;

/** "12 finds", the word the onboarding uses for what Fume found. */
export const finds = (n: number) => `${n} ${n === 1 ? "find" : "finds"}`;
