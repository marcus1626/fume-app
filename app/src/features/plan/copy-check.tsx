// The copy check on a plan (FLOWS §31, PROPOSED): before the expert reads the plan, Fume read every line of words it
// has the brand say for claims and against the brand's Tone of Voice (task_runs.copy_check). Only Fume's own people
// see it: never the customer, an agency or its client.
// - On the line (a line of the plan's words, or a master's words) a quiet note per finding: a claim no verified fact
//   backs in Rouge with its alert mark; off the voice and a word the voice avoids in the secondary colour. A claim a
//   fact backs, or one the brand's own words make (a price, an offer, where it is from), is only counted.
// - A line the expert changed after the check keeps its notes, muted, under "You changed this line after the check".
// - In the aside, above the brief: "The words, checked" as the aside's clearest title, how many things to look at, each
//   finding as a link that glides to its line, then folded: the Tone of Voice it wrote in and the rewrite Fume already
//   made (round 14, FLOWS §34.2: fewer words in the aside).
// A machine's reading never blocks on its own: Mark checked stays as it is; its foot only says what is still open.
import { Collapsible, CollapsibleContent, CollapsibleTrigger, Icon } from "@fume/ui";
import type { MouseEvent } from "react";
import type {
  CampaignPlan,
  PlanClaimKind,
  PlanCopyCheck,
  PlanCopyFinding,
  PlannedCreative,
  PlanLine,
} from "../../contract";
import * as copy from "../../copy";
import type { PlanPeople } from "./people";
import { glideTo } from "./PlanIndex";
import { chosenOf } from "./words";

/** The ref the check gives a line of the plan's words. */
export const lineRef = (line: PlanLine) => `copy:${line.key}`;
/** The ref the check gives a planned creative's words. */
export const creativeRef = (directionId: string, creative: PlannedCreative) => `${directionId}/${creative.id}`;
/** The element a finding's link glides to. */
export const wordsAnchor = (ref: string) => `plan-words-${ref.replace(/[^a-z0-9]+/gi, "-")}`;

const kindWords: Record<PlanClaimKind, string> = {
  result: "A result claim",
  health: "A health claim",
  superlative: "A claim of best or most",
  comparison: "A comparison",
  price: "A price",
  offer: "An offer",
  origin: "A claim of where it is from",
  award: "An award",
  other: "A claim",
};

const order: Record<PlanCopyFinding["kind"], number> = { unbacked_claim: 0, off_voice: 1, avoided_word: 2 };

/** What one finding says on its line. */
function findingWords(check: PlanCopyCheck, f: PlanCopyFinding): string[] {
  if (f.kind === "off_voice") return [`Off the voice. ${f.note}`];
  if (f.kind === "avoided_word") return [f.note];
  const claims = check.lines.find((l) => l.ref === f.ref)?.claims.filter((c) => c.verdict === "unbacked") ?? [];
  if (!claims.length) return [f.note];
  return claims.map((c) => `No verified fact says this: “${c.words}”. ${kindWords[c.kind]} needs one.`);
}

/** Whether someone changed the line after the check read it (the check reads the plan as Fume wrote it). */
export function changedAfter(plan: CampaignPlan, x: { changedBy?: string; changedAt?: string }): boolean {
  return Boolean(x.changedBy && (!plan.writtenAt || !x.changedAt || x.changedAt > plan.writtenAt));
}

/** The notes under one line: nothing when the check found nothing on it. */
export function CopyNotes({
  check,
  refId,
  changedBy,
  people,
}: {
  check: PlanCopyCheck;
  refId: string;
  /** Who changed the line after the check, if anyone. */
  changedBy?: string;
  people: PlanPeople;
}) {
  const found = check.findings.filter((f) => f.ref === refId).sort((a, b) => order[a.kind] - order[b.kind]);
  if (!found.length) return null;
  const who = changedBy ? (people.isMe(changedBy) ? "You" : people.Name(changedBy)) : undefined;
  return (
    <ul className="ui-plandoc-copy-notes" data-stale={who ? "" : undefined} aria-label="What Fume’s word check found">
      {who && <li className="ui-plandoc-copy-stale">{who} changed this line after the check.</li>}
      {found.flatMap((f) =>
        findingWords(check, f).map((w) => (
          <li key={`${f.kind}-${w}`} className="ui-plandoc-copy-note" data-kind={f.kind}>
            <Icon
              name={f.kind === "unbacked_claim" ? "circle-alert" : f.kind === "off_voice" ? "message-square" : "type"}
            />
            <span>{w}</span>
          </li>
        )),
      )}
    </ul>
  );
}

/** The refs of the lines someone changed after the check. */
function changedRefs(plan: CampaignPlan): Set<string> {
  const direction = chosenOf(plan);
  return new Set([
    ...plan.content.filter((l) => changedAfter(plan, l)).map(lineRef),
    ...(direction?.creatives ?? []).filter((c) => changedAfter(plan, c)).map((c) => creativeRef(direction!.id, c)),
  ]);
}

/** The claims nothing backs that are still in the plan: on a line nobody changed since the check. */
export function openUnbacked(plan: CampaignPlan): number {
  const check = plan.copyCheck;
  if (!check) return 0;
  const changed = changedRefs(plan);
  return check.lines
    .filter((l) => !changed.has(l.ref))
    .reduce((n, l) => n + l.claims.filter((c) => c.verdict === "unbacked").length, 0);
}

const stateWords = { approved: "approved", checked: "checked, not approved yet", draft: "a draft, not checked yet" };

/** The aside's block: what the check read and found, each finding a way to its line. */
export function CopyCheckSummary({ plan }: { plan: CampaignPlan }) {
  const check = plan.copyCheck;
  if (!check) return null;
  const unbacked = check.lines.reduce((n, l) => n + l.claims.filter((c) => c.verdict === "unbacked").length, 0);
  const off = check.findings.filter((f) => f.kind === "off_voice").length;
  const avoided = check.findings.filter((f) => f.kind === "avoided_word").length;
  const toLook = unbacked + off + avoided;
  const read = copy.count(check.lines.length, "line");
  const go = (e: MouseEvent<HTMLAnchorElement>, ref: string) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (glideTo(wordsAnchor(ref), e.currentTarget)) e.preventDefault();
  };
  const found = [...check.findings].sort((a, b) => order[a.kind] - order[b.kind]);
  const changed = changedRefs(plan);
  return (
    <section className="ui-plandoc-copy" aria-labelledby="plan-copy-title">
      <h3 className="ui-plandoc-copy-title" id="plan-copy-title">
        The words, checked
      </h3>
      {!check.read ? (
        <p className="ui-plandoc-copy-line">
          Fume could not read the words for claims{check.error ? `: ${check.error}` : "."} Read them yourself.
        </p>
      ) : (
        <>
          <p className="ui-plandoc-copy-sub">
            {toLook ? `${toLook} to look at, in ${read}` : `Nothing found in ${read}`}
          </p>
          {found.length > 0 && (
            <ul className="ui-plandoc-copy-list">
              {found.map((f) => {
                const where = check.lines.find((l) => l.ref === f.ref)?.where ?? "A line";
                return (
                  <li key={`${f.ref}-${f.kind}`} data-kind={f.kind} data-stale={changed.has(f.ref) ? "" : undefined}>
                    <a className="ui-plandoc-copy-link" href={`#${wordsAnchor(f.ref)}`} onClick={(e) => go(e, f.ref)}>
                      <Icon
                        name={
                          f.kind === "unbacked_claim"
                            ? "circle-alert"
                            : f.kind === "off_voice"
                              ? "message-square"
                              : "type"
                        }
                      />
                      <span>
                        <span className="ui-plandoc-copy-link-text">{where.replace(/^Direction [A-C]: /, "")}</span>
                        <span className="ui-plandoc-copy-link-sub">
                          {f.kind === "unbacked_claim"
                            ? "A claim nothing backs"
                            : f.kind === "off_voice"
                              ? "Off the voice"
                              : "A word the voice avoids"}
                          {changed.has(f.ref) ? " · changed since" : ""}
                        </span>
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
      {(check.voiceBook || (check.rewritten && check.rewroteFor && check.rewroteFor.length > 0)) && (
        <Collapsible className="ui-plandoc-copy-more">
          <CollapsibleTrigger>How Fume wrote them</CollapsibleTrigger>
          <CollapsibleContent>
            {check.voiceBook && (
              <p className="ui-plandoc-copy-sub">
                In the Tone of Voice, version {check.voiceBook.version} ({stateWords[check.voiceBook.state]}).
              </p>
            )}
            {check.rewritten && check.rewroteFor && check.rewroteFor.length > 0 && (
              <p className="ui-plandoc-copy-sub">
                Written again once, for a claim nothing backed:{" "}
                {check.rewroteFor.map((r, i) => (
                  <span key={r.ref}>
                    {i > 0 ? ", " : ""}“{r.text}”
                  </span>
                ))}
                {/[.!?]$/.test(check.rewroteFor[check.rewroteFor.length - 1].text) ? "" : "."}
              </p>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}
    </section>
  );
}
