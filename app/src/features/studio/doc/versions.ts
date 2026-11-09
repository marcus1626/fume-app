// Which version of a document stands for it (the board, the Studio's tiles, a row's cover).
import type { CreativeDocument } from "../../../contract";

/** The picked version, else the newest rendered one. A version that did not render (FLOWS §29) never stands for the
 *  document: it has no picture. While a first render runs, that one (the board shows it rendering). */
export const shownVersion = (doc: CreativeDocument) =>
  doc.versions.find((v) => v.id === doc.pickedVersionId && v.state === "done") ??
  [...doc.versions].reverse().find((v) => v.state === "done") ??
  doc.versions.find((v) => v.state === "rendering");

/** The versions a studio's strip shows (round 14, FLOWS §34.5): Image shows the pictures; Design shows what Fume
 *  designed on them, or every version when Fume has designed none (a creative laid out by hand). */
export const tabVersions = (doc: CreativeDocument) => {
  const designs = doc.versions.filter((v) => v.design);
  if (doc.studio === "design") return designs.length ? designs : doc.versions;
  return doc.versions.filter((v) => !v.design);
};

/** The version a studio's board shows: the picked one when its strip has it; else, in Image, the picture under a picked
 *  design, and in Design, the newest design; else as shownVersion. */
export const tabShown = (doc: CreativeDocument) => {
  const list = tabVersions(doc);
  if (list.length === doc.versions.length) return shownVersion(doc);
  const picked = doc.versions.find((v) => v.id === doc.pickedVersionId);
  if (picked && list.includes(picked) && picked.state === "done") return picked;
  if (doc.studio !== "design" && picked?.design) {
    const under = doc.versions.find((v) => v.id === picked.design!.fromVersionId && v.state === "done");
    if (under) return under;
  }
  return (
    [...list].reverse().find((v) => v.state === "done") ?? list.find((v) => v.state === "rendering") ?? undefined
  );
};
