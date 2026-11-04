// Which version of a document stands for it (the board, the Studio's tiles, a row's cover).
import type { CreativeDocument } from "../../../contract";

/** The picked version, else the newest rendered one. A version that did not render (FLOWS §29) never stands for the
 *  document: it has no picture. While a first render runs, that one (the board shows it rendering). */
export const shownVersion = (doc: CreativeDocument) =>
  doc.versions.find((v) => v.id === doc.pickedVersionId && v.state === "done") ??
  [...doc.versions].reverse().find((v) => v.state === "done") ??
  doc.versions.find((v) => v.state === "rendering");
