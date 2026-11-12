// The words and addresses the Library's Uploaded half shares (FLOWS §38): a picture's place, a shoot's rights, and
// where the Library is in each frame (all brands, one brand, or the customer's own).
import { useParams } from "react-router-dom";
import { useSession } from "../../api/hooks";
import type { OwnSort, ShootPeople, ShootRights } from "../../contract";
import { brandBase, frameRoot, useFrameKind } from "../../shell/scope";

export const SORTS: { value: OwnSort; tab: string; one: string }[] = [
  { value: "pick", tab: "Picks", one: "Pick" },
  { value: "rest", tab: "The rest", one: "Kept for later" },
  { value: "out", tab: "Left out", one: "Left out" },
];
export const sortWords = (s: OwnSort) => SORTS.find((x) => x.value === s)!;

export const PEOPLE: { value: ShootPeople; label: string; hint: string }[] = [
  { value: "none", label: "No people", hint: "Only products, places and things" },
  { value: "released", label: "Everyone in them signed a release", hint: "Models, staff or customers who said yes" },
  { value: "unsure", label: "Not sure yet", hint: "Nothing is used until someone answers it" },
];

const untilFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Oslo",
});

/** The rights in one line: who took them, how long they may be used, who is in them. */
export function rightsWords(r: ShootRights): string[] {
  return [
    r.photographer ? (r.photographer === "Our own" ? "Our own pictures" : `Taken by ${r.photographer}`) : "",
    r.until ? `Usable until ${untilFmt.format(Date.parse(r.until))}` : "Usable for good",
    r.people === "none" ? "No people" : r.people === "released" ? "Everyone in them signed a release" : "",
  ].filter(Boolean);
}

/** Where the Library is for the signed-in person: /studio/library, /studio/b/:id/library, /agency/…, or the
 *  customer's /library. */
export function useLibraryBase(): { base: string; customer: boolean; workspaceId?: string } {
  const { workspaceId } = useParams();
  const frame = useFrameKind();
  const session = useSession().data;
  const customer = !session?.user.staffRole;
  if (customer) return { base: "/library", customer, workspaceId: session?.workspace.id };
  return {
    base: workspaceId ? `${brandBase(frame, workspaceId)}/library` : `${frameRoot[frame]}/library`,
    customer,
    workspaceId,
  };
}
