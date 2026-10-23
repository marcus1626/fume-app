// The official logo files from assets/logo, inlined (never redrawn or recoloured; rules Logo). The lockup leads;
// it folds to the mark where there is no room (F-D080). The file's own <svg> is the element on the page, so the
// design system's `> svg` sizing rules (sidebar, nav bar) reach it.
import lockupInk from "../../../assets/logo/lockup-horizontal/fume-lockup-horizontal-ink.svg?raw";
import markInk from "../../../assets/logo/mark/fume-mark-ink.svg?raw";

function parts(svg: string) {
  const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1];
  const inner = svg.slice(svg.indexOf(">") + 1, svg.lastIndexOf("</svg>"));
  return { viewBox, inner };
}
const lockup = parts(lockupInk);
const mark = parts(markInk);

export function Lockup({ className }: { className?: string }) {
  return <svg className={className} viewBox={lockup.viewBox} role="img" aria-label="Fume" dangerouslySetInnerHTML={{ __html: lockup.inner }} />;
}

export function Mark({ className }: { className?: string }) {
  return <svg className={className} viewBox={mark.viewBox} role="img" aria-label="Fume" dangerouslySetInnerHTML={{ __html: mark.inner }} />;
}
