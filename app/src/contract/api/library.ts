// The brand's own pictures (FLOWS §38, DECIDED 13 Nov 2026): shoots uploaded to the Library, the Engine's read of them, an
// expert's check of its picks, and a checked pick becoming a creative in a campaign.

import type { Id } from "../entities/common";
import type { OwnKind, OwnSort, Shoot, ShootRights } from "../entities/library";
import type { ShootSummary } from "../views/library";

/** One file in a new shoot, as the browser has it. */
export interface ShootFile {
  name: string;
  src: string;
  kind: OwnKind;
  poster?: string;
  width?: number;
  height?: number;
  seconds?: number;
  bytes?: number;
}

export interface LibraryApi {
  /** One brand's shoots, or every brand's the person may see, newest first. The customer sees their own brand's. */
  shoots(workspaceId?: Id): Promise<ShootSummary[]>;
  /** A shoot with its pictures. A customer gets the Engine's read only once an expert has checked the picks. */
  shoot(shootId: Id): Promise<Shoot>;
  /** Keeps the files as they are and starts the Engine reading them: answered at once, the shoot "reading". The
   *  customer, Fume's people and an agency's people add shoots; Fume's admin does not. */
  addShoot(input: {
    workspaceId: Id;
    name: string;
    shotOn?: string;
    rights: ShootRights;
    files: ShootFile[];
  }): Promise<Shoot>;
  /** Updates who took the shoot, its usage period and the recorded release answer. */
  updateShootRights(shootId: Id, rights: ShootRights): Promise<Shoot>;
  /** An expert moves a picture to the picks, the rest or left out; the move wins over the Engine's place. Moving a
   *  picture of a checked shoot opens its check again. */
  movePicture(pictureId: Id, sort: OwnSort): Promise<Shoot>;
  /** An expert checks the shoot's picks by name. Never the admin; in a brand an agency runs, only the agency. */
  checkPicks(shootId: Id): Promise<Shoot>;
  /** Fume's people: each chosen checked pick becomes a creative in the campaign with the photograph as V1. Answers the
   *  documents made, first to last. Refused while the shoot's people are "unsure". */
  useShootInCampaign(input: { shootId: Id; campaignId: Id; pictureIds?: Id[] }): Promise<{ documentIds: Id[] }>;
}
