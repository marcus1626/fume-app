// The plan as one document (FLOWS §22.2, PROPOSED 20 Oct 2026): what Fume will make, before anything is made, read like
// an agency's treatment and shot list. In order: the brief in Fume's words (her own lines fold under it), the
// direction (its idea, the idea in one line, why it fits with each reason's source, the reference pictures, and the
// two more directions Fume considered), how every creative looks (the look and the content, each line with its source,
// Change in place), the creatives (the masters first, then what follows them), the rules it keeps and when. At 960 px
// of column and more a summary aside stays in view; narrower it is a strip above the parts. The decision (Approve the
// plan, Ask for changes, Mark checked) is the caller's step footer.
// Round 12 (UX review DLAY-10, DLOAD-9, DLOAD-10, DWAY-12, DLOAD-22, DLOAD-3, DLOAD-4; PROPOSED 20 Oct 2026): the same
// plan, tighter. The aside holds the index of the parts ("In this plan", each entry its part's heading), the facts and
// who checked it (and what changed since); the plan's own intro sentence is gone (the aside says it once). Lines are a
// compact spec with one quiet source each; the masters are compact rows; what follows them is a table; the other
// directions are rows. A product the plan uses that still waits to be confirmed is named on the Products line, with
// the way to confirm it. Who approves follows who reads it (people.ts): the customer in Fume, the agency in a brand an
// agency runs; the agency's client reads it with no decision ("Brygga Studio approves the plan; you approve the
// creatives."). The expert and the agency read the brand's lines about the customer by her name.
// Round 13 (Marcus's comments #25, #28, #67; PROPOSED 22 Oct 2026): the expert's check is optional, so "Checked by
// Anna" is the Focus pointer in Amber (as Check marks "Checked by you"), and only when she checked it; a plan nobody was
// asked to check says nothing about a check. A new version says what changed in it. When holds a small calendar strip
// of the days the creatives go live, each day editable, and a link to the content calendar (GoLive.tsx).
import { Button, CheckMark, Collapsible, CollapsibleContent, CollapsibleTrigger, Icon, useToast } from "@fume/ui";
import { useMemo, type ReactNode } from "react";
import { useCampaigns, useCatalogue, useChoosePlanDirection, useStudioKit } from "../../api/hooks";
import type { Brief, Campaign, CampaignPlan, PlanLine, Product } from "../../contract";
import * as copy from "../../copy";
import { BriefFacts } from "../campaigns/brief-lines";
import { useOpenProductCheck } from "../check/ProductCheckHost";
import { GoLive } from "./GoLive";
import { ChangedTag, ConsideredCard, FollowList, LineRow, MasterCard, SourceTag, Steps, versionWords, type Step } from "./parts";
import { PlanIndex } from "./PlanIndex";
import type { PlanPeople } from "./people";
import { byDay, chosenOf, countWords, creativesOf, onDay, partsOf, sentOn, sourceLabel, voiceFor } from "./words";

export type PlanMode = "ready" | "approved" | "previous" | "staff";

export interface PlanDocumentProps {
  plan: CampaignPlan;
  campaign: Campaign;
  brief: Brief;
  people: PlanPeople;
  mode: PlanMode;
  /** Lines and creatives change in place (she, while it is ready; the expert, until it is approved). */
  edit: boolean;
  /** "Use this direction" (she, while it is ready). */
  choose: boolean;
  /** More for the summary aside, under the index and the facts (the expert's page: the customer's brief beside the lines
   *  she checks, DLAY-11). With it, the facts fold to one line so it has the room. */
  aside?: ReactNode;
}

type Tag = (s: PlanLine["source"], o?: { campaignId?: string; text?: string }) => string;

export function PlanDocument({ plan, campaign, brief, people, mode, edit, choose, aside }: PlanDocumentProps) {
  const campaigns = useCampaigns().data ?? [];
  const catalogue = useCatalogue();
  const kit = useStudioKit(people.staff ? campaign.workspaceId : undefined);
  const products = useMemo<Product[]>(() => [...(catalogue.data?.products ?? []), ...(kit.data?.products ?? [])], [catalogue.data, kit.data]);
  const openCheck = useOpenProductCheck();
  const { viewer } = people;
  const tag: Tag = (source, opts) => sourceLabel(source, campaigns, { ...opts, viewer });
  const customer = people.name(campaign.approverId);
  const voice = voiceFor(viewer, customer);
  const direction = chosenOf(plan);
  if (!direction) return null;
  const { masters, variants, all } = creativesOf(plan);
  // Who approves the creatives (the customer, the agency's client): "you" for her, her name for everyone else.
  const approvesCreatives = people.name(campaign.approverId);
  const yours = viewer === "customer";

  // A product the plan uses whose details still wait to be confirmed (DLOAD-3): the Products line names it.
  const waiting = campaign.productIds
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is Product => Boolean(p && p.state === "needs_you"))
    .filter((p, i, list) => list.findIndex((x) => x.id === p.id) === i);
  // Who confirms products: the customer in Fume, the agency in a brand it runs.
  const confirms = viewer === "agency" ? "you" : viewer === "client" ? (people.agencyName ?? "the agency") : customer;
  const productNote =
    waiting.length > 0 && mode !== "approved" && mode !== "previous" ? (
      <p className="ui-plandoc-line-ask">
        <Icon name="tag" />
        <span>
          {listWords(waiting.map((p) => p.name))} {waiting.length === 1 ? "waits" : "wait"} for {confirms} to confirm {waiting.length === 1 ? "its" : "their"} details. Nothing is made with{" "}
          {waiting.length === 1 ? "it" : "them"} before that.
        </span>
        {confirms === "you" &&
          waiting.slice(0, 1).map((p) => (
            <Button key={p.id} variant="quiet" size="sm" iconEnd="arrow-right" onClick={() => openCheck(p.id)}>
              Confirm {p.name}
            </Button>
          ))}
      </p>
    ) : undefined;

  const briefSender = brief.approvedBy;
  const briefWho = people.isMe(briefSender) ? "Your brief" : viewer === "client" ? `${people.agencyName ?? "The agency"}’s brief` : briefSender ? `${people.Name(briefSender)}’s brief` : yours ? "Your brief" : `${cap(customer)}’s brief`;

  return (
    <div className="ui-plandoc-wrap">
      <div className="ui-plandoc" data-mode={mode} data-aside={aside ? "more" : undefined}>
        <PlanHead plan={plan} people={people} mode={mode} customer={customer} />
        <Summary plan={plan} campaign={campaign} people={people} mode={mode} more={aside} />

        <div className="ui-plandoc-body">
          {/* 1. The brief, in words */}
          <section className="ui-plandoc-part" id="plan-brief" aria-labelledby="plan-brief-title">
            <h2 className="ui-plandoc-part-title" id="plan-brief-title">
              The brief
            </h2>
            <p className="ui-plandoc-summary">{voice(plan.summary)}</p>
            <Collapsible className="ui-plandoc-brief">
              <CollapsibleTrigger>
                {briefWho}
                {brief.approvedAt ? `, sent ${sentOn(brief.approvedAt)}` : ""}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <BriefFacts brief={brief} campaign={campaign} editable={false} made={campaign.counts.creatives} />
              </CollapsibleContent>
            </Collapsible>
          </section>

          {/* 2. The direction */}
          <DirectionPart plan={plan} campaign={campaign} people={people} choose={choose} tag={tag} voice={voice} />

          {/* 3. How every creative looks (the variables) */}
          <section className="ui-plandoc-part" id="plan-variables" aria-labelledby="plan-variables-title">
            <div className="ui-plandoc-part-head">
              <h2 className="ui-plandoc-part-title" id="plan-variables-title">
                How it looks
              </h2>
              <p className="ui-plandoc-part-lead">Every creative keeps to these lines.{edit ? " Change any of them." : ""}</p>
            </div>
            <div className="ui-plandoc-group">
              <h3 className="ui-plandoc-group-title">The look</h3>
              <ul className="ui-plandoc-lines">
                {direction.look.map((l) => (
                  <LineRow key={`${direction.id}-${l.key}`} line={l} campaignId={campaign.id} editable={edit} voice={voice} tag={<LineTag line={l} tag={tag} people={people} />} />
                ))}
              </ul>
            </div>
            <div className="ui-plandoc-group">
              <h3 className="ui-plandoc-group-title">Products, formats and words</h3>
              <ul className="ui-plandoc-lines">
                {plan.content.map((l) => (
                  <LineRow
                    key={l.key}
                    line={l}
                    campaignId={campaign.id}
                    editable={edit}
                    voice={voice}
                    tag={<LineTag line={l} tag={tag} people={people} />}
                    note={l.key === "products" ? productNote : undefined}
                  />
                ))}
              </ul>
            </div>
          </section>

          {/* 4. The creatives: the masters, then what follows them */}
          <section className="ui-plandoc-part" id="plan-creatives" aria-labelledby="plan-creatives-title">
            <div className="ui-plandoc-part-head">
              <h2 className="ui-plandoc-part-title" id="plan-creatives-title">
                The {copy.creatives(all.length)}
              </h2>
              <p className="ui-plandoc-part-lead">
                {masters.length === 1 ? "One master first: the first creative. " : `${copy.count(masters.length, "master")} first: the first creatives, one per scene. `}
                {cap(approvesCreatives)} {approvesCreatives === "you" ? "approve" : "approves"} {masters.length === 1 ? "it" : "them"} before the rest is made.
                {brief.creatives > 0 && brief.creatives !== all.length ? ` ${yours ? "Your" : "The"} brief asked for ${brief.creatives}.` : ""}
              </p>
            </div>
            <ul className="ui-plandoc-masters" aria-label="The masters">
              {masters.map((m) => (
                <MasterCard key={m.id} creative={m} products={products} campaignId={campaign.id} language={campaign.language} editable={edit} people={people} voice={voice} />
              ))}
            </ul>
            {variants.length > 0 && (
              <div className="ui-plandoc-group">
                <h3 className="ui-plandoc-group-title">
                  Then {variants.length === 1 ? "1 variant or format" : `${variants.length} variants and formats`}, once {approvesCreatives} {approvesCreatives === "you" ? "approve" : "approves"} the masters
                </h3>
                <FollowList masters={masters} variants={variants} language={campaign.language} voice={voice} />
              </div>
            )}
          </section>

          {/* 5. Rules it keeps */}
          <section className="ui-plandoc-part" id="plan-rules" aria-labelledby="plan-rules-title">
            <div className="ui-plandoc-part-head">
              <h2 className="ui-plandoc-part-title" id="plan-rules-title">
                Rules
              </h2>
              <p className="ui-plandoc-part-lead">From {yours ? "your" : "the"} brief and {yours ? "your" : "the"} Brand DNA, on every creative.</p>
            </div>
            <div className="ui-plandoc-rules">
              {(["must", "never"] as const).map((kind) => {
                const list = plan.rules.filter((r) => r.kind === kind);
                if (list.length === 0) return null;
                return (
                  <div key={kind} className="ui-plandoc-group">
                    <h3 className="ui-plandoc-group-title">{kind === "must" ? "Always" : "Never"}</h3>
                    <ul className="ui-plandoc-rule-list">
                      {list.map((r) => (
                        <li key={r.text} className="ui-plandoc-rule">
                          <span>{voice(r.text)}</span>
                          <SourceTag source={r.source} label={tag(r.source)} to={r.source === "brand_dna" && viewer === "customer" ? "/brand#rules" : undefined} />
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 6. When */}
          <section className="ui-plandoc-part" id="plan-when" aria-labelledby="plan-when-title">
            <h2 className="ui-plandoc-part-title" id="plan-when-title">
              When
            </h2>
            <Steps steps={stepsOf(plan, campaign, people)} label="The steps and their dates" />
            <GoLive plan={plan} campaign={campaign} edit={edit} />
            <p className="ui-plandoc-included">
              <Icon name="refresh-cw" />
              {copy.count(plan.changeRequestsIncluded, "change request")} included, for the creatives
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const listWords = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : (names[0] ?? ""));

/** A line's tag: "Changed by you" (or "Changed by Anna") once someone changed it, else its source. */
function LineTag({ line, tag, people }: { line: PlanLine; tag: Tag; people: PlanPeople }) {
  if (line.changedBy) return <ChangedTag by={line.changedBy} people={people} />;
  if (line.source === "you") return <SourceTag source="you" label={tag("you")} />;
  return <SourceTag source={line.source} label={tag(line.source, { text: line.why })} />;
}

// ─── The head: only what the aside cannot say ───────────────────────────────

/** The head holds what the summary aside does not: the version she asked to change, Fume's note on a new version, the
 *  expert's status line, and for the agency's client who decides. The plan's intro sentence is gone (DLOAD-9): the
 *  aside says who checked it. */
function PlanHead({ plan, people, mode, customer }: { plan: CampaignPlan; people: PlanPeople; mode: PlanMode; customer: string }) {
  const checked = plan.checkedBy && plan.checkedAt ? `Checked by ${people.name(plan.checkedBy)} ${onDay(plan.checkedAt)}.` : "";
  const wrote = `Fume wrote it from ${people.staff ? `${customer}’s` : "your"} brief${plan.writtenAt ? ` ${onDay(plan.writtenAt, false)}` : ""}.`;
  let title: string | undefined;
  let status: string | undefined;
  if (mode === "previous") {
    title = `Version ${plan.version}`;
    status = `The version ${people.staff ? `${customer} asked` : "you asked"} to change, as it was. ${wrote}`;
  } else if (mode === "staff") {
    title = "The plan";
    status =
      plan.state === "ready"
        ? `${checked || wrote} It waits on ${customer}.`
        : plan.state === "approved"
          ? `${people.Name(plan.approvedBy)} approved it${plan.approvedAt ? ` ${onDay(plan.approvedAt)}` : ""}.`
          : plan.checkAsked
            ? // Round 13 (#25): the check is one she asked for
              `${wrote} ${people.Name(plan.checkAsked.by)} asked for a check ${onDay(plan.checkAsked.at)}; once you check it, it goes back to ${people.isMe(plan.checkAsked.by) ? "you" : people.name(plan.checkAsked.by)}.`
            : `${wrote} You check it; then it goes to ${customer}.`;
  }
  const note = plan.note && plan.note.by === "fume" && plan.version > 1 && mode !== "previous" ? plan.note.text : undefined;
  // Round 13 (#25): what this version changed, line by line, when Fume says so
  const latest = plan.versions?.find((v) => v.version === plan.version);
  if (!title && !status && !note) return null;
  return (
    <header className="ui-plandoc-head">
      {title && (
        <div className="ui-plandoc-title-row">
          <h2 className="ui-plandoc-title">{title}</h2>
          {mode === "staff" && <span className="ui-plandoc-version-meta">{versionWords(plan)}</span>}
        </div>
      )}
      {status && <p className="ui-plandoc-status">{status}</p>}
      {note && (
        <p className="ui-plandoc-note">
          <Icon name="message-square" />
          <span>
            Version {plan.version} · {latest?.changes.length ? `Changed as ${latest.by === "fume" || people.isMe(latest.by) ? "you" : people.name(latest.by)} asked${latest.asked ? `: “${latest.asked}”` : ""}` : note}
            {latest && latest.changes.length > 0 && (
              <ul className="ui-plandoc-note-changes">
                {latest.changes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            )}
          </span>
        </p>
      )}
    </header>
  );
}

// ─── The summary: the aside on a desk (the index, the facts, who checked it), a strip of facts narrower ─────

/** What changed since the expert checked it (DLOAD-22), as "the direction and 1 line"; nothing when nothing did. */
function changedSince(plan: CampaignPlan, checkedAt?: string): { words: string; by: string[] } | undefined {
  const direction = chosenOf(plan)!;
  const after = (x: { changedBy?: string; changedAt?: string }) => Boolean(x.changedBy && x.changedBy !== plan.checkedBy && (!checkedAt || !x.changedAt || x.changedAt > checkedAt));
  const lines = [...direction.look, ...plan.content].filter(after);
  const made = direction.creatives.filter(after);
  const parts = [
    ...(plan.state === "ready" && !direction.recommended ? ["the direction"] : []),
    ...(lines.length ? [copy.count(lines.length, "line")] : []),
    ...(made.length ? [made.length === 1 ? made[0].name : copy.count(made.length, "creative")] : []),
  ];
  if (!parts.length) return undefined;
  return { words: listWords(parts), by: [...new Set([...lines, ...made].map((x) => x.changedBy!))] };
}

function Summary({ plan, campaign, people, mode, more }: { plan: CampaignPlan; campaign: Campaign; people: PlanPeople; mode: PlanMode; more?: ReactNode }) {
  const direction = chosenOf(plan)!;
  const counts = countWords(plan);
  const masters = plan.timeline[0];
  // "Goes live", not "Delivery" (which has "live" inside it)
  const live = plan.timeline.find((s) => /^goes live/i.test(s.label))?.at ?? campaign.dueAt;
  const checker = plan.checkedBy ? people.user(plan.checkedBy) : undefined;
  const chooser = people.planner(campaign);
  const picked = direction.recommended ? "Fume’s pick" : `Chosen by ${chooser}`;

  let status: ReactNode = null;
  // Round 13 (Marcus's card, 23 Oct 2026): in a brand an agency runs the agency checks the plan and the client approves
  // it, so it reads as in Fume: "Maja approved it · Checked by Nora" (the client reads the agency's name for the check).
  const agencyRun = people.viewer === "agency" || people.viewer === "client";
  const checkWords = (id: string) => copy.checkedBy(people.viewer === "client" && !people.isMe(id) ? (people.agencyName ?? people.name(id)) : people.name(id));
  if (mode === "approved") {
    status = (
      <p className="ui-plandoc-checked">
        <span>
          {people.Name(plan.approvedBy)} approved it{plan.approvedAt ? ` ${onDay(plan.approvedAt)}` : ""}
          {plan.approvedNote ? ` · ${plan.approvedNote.charAt(0).toLowerCase()}${plan.approvedNote.slice(1)}` : ""}.
          {checker && <CheckMark className="ui-plandoc-checked-sub" state="checked" label={checkWords(checker.id)} />}
        </span>
      </p>
    );
  } else if (agencyRun) {
    // Unchecked, the plan waits on the agency's check; checked, it is with the client (she approves it).
    status =
      plan.state !== "ready" ? null : plan.checkedBy ? (
        <p className="ui-plandoc-checked">
          <span className="ui-creative-check ui-plandoc-checked-mark" data-check="approved" aria-hidden="true">
            <Icon name="fume-check" />
          </span>
          <span>
            {checkWords(plan.checkedBy)}
            {plan.checkedAt ? ` ${onDay(plan.checkedAt)}` : ""}
            <span className="ui-plandoc-checked-sub">{people.viewer === "agency" ? `With ${people.approver(campaign)}; she approves it` : "Waits on you"}</span>
          </span>
        </p>
      ) : people.viewer === "agency" ? (
        <p className="ui-plandoc-checked">Waits for your check</p>
      ) : null;
  } else if (people.viewer !== "client") {
    // Round 13 (#25, #28): only a plan someone checked, or one in check, says so; the check is optional.
    const expert = checker ?? (plan.state === "in_check" ? people.expert : undefined);
    const since = mode !== "staff" && checker ? changedSince(plan, plan.checkedAt) : undefined;
    status = expert ? (
      <p className="ui-plandoc-checked">
        <span className="ui-creative-check ui-plandoc-checked-mark" data-check={checker ? "approved" : "waiting"} aria-hidden="true">
          <Icon name="fume-check" />
        </span>
        <span>
          {checker ? copy.checkedBy(people.name(checker.id)) : `In check with ${people.name(expert.id)}`}
          {since && (
            <span className="ui-plandoc-checked-sub">
              Since then {since.by.length === 1 && people.isMe(since.by[0]) ? "you" : listWords(since.by.map((id) => people.name(id)))} changed {since.words}
            </span>
          )}
        </span>
      </p>
    ) : null;
  }

  return (
    <aside className="ui-plandoc-aside" aria-label="The plan in short">
      <PlanIndex parts={partsOf(plan)} />
      {more ? (
        <p className="ui-plandoc-facts-line">
          {[`${direction.letter} · ${direction.name}`, counts.total, live ? `live ${byDay(live)}` : ""].filter(Boolean).join(" · ")}
        </p>
      ) : (
        <dl className="ui-plandoc-facts">
          <div className="ui-plandoc-fact">
            <dt>Direction</dt>
            <dd>
              {direction.letter} · {direction.name}
              <span className="ui-plandoc-fact-sub">{picked}</span>
            </dd>
          </div>
          <div className="ui-plandoc-fact">
            <dt>Creatives</dt>
            <dd>
              {counts.total}
              <span className="ui-plandoc-fact-sub">{counts.split}</span>
            </dd>
          </div>
          {masters && (
            <div className="ui-plandoc-fact">
              <dt>Masters</dt>
              <dd>by {byDay(masters.at)}</dd>
            </div>
          )}
          {live && (
            <div className="ui-plandoc-fact">
              <dt>Goes live</dt>
              <dd>{byDay(live)}</dd>
            </div>
          )}
        </dl>
      )}
      {status}
      {more && <div className="ui-plandoc-aside-more">{more}</div>}
    </aside>
  );
}

// ─── The direction ──────────────────────────────────────────────────────────

function DirectionPart({ plan, campaign, people, choose, tag, voice }: { plan: CampaignPlan; campaign: Campaign; people: PlanPeople; choose: boolean; tag: Tag; voice: (t: string) => string }) {
  const direction = chosenOf(plan)!;
  const others = plan.directions.filter((d) => d.id !== direction.id);
  const pick = useChoosePlanDirection();
  const toast = useToast();
  const use = (id: string) => {
    const before = plan.chosenDirectionId;
    const next = plan.directions.find((d) => d.id === id)!;
    pick.mutate(
      { campaignId: campaign.id, directionId: id },
      {
        onSuccess: () =>
          toast.done(`Direction ${next.letter}, ${next.name}, is the plan’s direction now.`, {
            action: {
              label: "Undo",
              onClick: () =>
                void pick
                  .mutateAsync({ campaignId: campaign.id, directionId: before })
                  .then(undefined, (e: Error) => toast.error("That wasn’t undone", { description: e.message })),
            },
          }),
        onError: (e) => toast.error("The direction wasn’t changed", { description: e.message }),
      },
    );
  };
  const eyebrow = `Direction ${direction.letter} · ${direction.recommended ? "Fume’s pick" : `chosen by ${people.planner(campaign)}`}`;
  return (
    <section className="ui-plandoc-part" id="plan-direction" aria-labelledby="plan-direction-title">
      <div className="ui-plandoc-direction-head">
        <p className="ui-plandoc-eyebrow">{eyebrow}</p>
        <h2 className="ui-plandoc-direction-name" id="plan-direction-title">
          {direction.name}
        </h2>
      </div>
      <p className="ui-plandoc-idea">{voice(direction.idea)}</p>
      {direction.hook && (
        <div className="ui-plandoc-hook">
          <p className="ui-plandoc-label">The idea in one line</p>
          <p className="ui-plandoc-hook-line">“{direction.hook.replace(/^[“"]|[”"]$/g, "")}”</p>
        </div>
      )}
      {direction.why.length > 0 && (
        <div className="ui-plandoc-group">
          <h3 className="ui-plandoc-group-title">Why it fits</h3>
          <ul className="ui-plandoc-why">
            {direction.why.map((w) => (
              <li key={w.text} className="ui-plandoc-why-item">
                <span>{voice(w.text)}</span>
                <SourceTag source={w.source} label={tag(w.source, { text: w.text })} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {direction.references.length > 0 && (
        <div className="ui-plandoc-group">
          <h3 className="ui-plandoc-group-title">References</h3>
          <ul className="ui-plandoc-refs">
            {direction.references.map((r) => (
              <li key={r.image + r.caption}>
                <figure className="ui-plandoc-ref">
                  <img className="ui-plandoc-ref-media" src={r.image} alt={voice(r.caption)} loading="lazy" />
                  <figcaption className="ui-plandoc-ref-caption">
                    <span>{voice(r.caption)}</span> <SourceTag source={r.source} label={tag(r.source, { campaignId: r.campaignId, text: r.caption })} />
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </div>
      )}
      {others.length > 0 && (
        <div className="ui-plandoc-group">
          <h3 className="ui-plandoc-group-title">
            {others.length === 1 ? "One more direction" : others.length === 2 ? "Two more directions" : `${others.length} more directions`} Fume considered
          </h3>
          <ul className="ui-plandoc-alts">
            {others.map((d) => (
              <ConsideredCard key={d.id} direction={d} voice={voice} onUse={choose ? () => use(d.id) : undefined} busy={pick.isPending && pick.variables?.directionId === d.id} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// ─── When ───────────────────────────────────────────────────────────────────

/** "You approve the plan" (once you approve) → each step with its date. The step under way is an Ink ring. The plan's
 *  approver follows who reads it: "You", "Maja", "Brygga Studio". */
function stepsOf(plan: CampaignPlan, campaign: Campaign, people: PlanPeople): Step[] {
  const approved = plan.state === "approved";
  const expert = people.expert ? people.name(people.expert.id) : undefined;
  const who = people.approver(campaign);
  const Who = people.Approver(campaign);
  // How far the campaign is once the plan is approved: the step under way follows its stage.
  const doneSteps = campaign.state === "delivered" || campaign.state === "closed" ? plan.timeline.length : campaign.stage === "variants" ? 1 : campaign.stage === "delivery" ? 2 : 0;
  // Round 13 (Marcus's card, 23 Oct 2026): the client approves the plan in agency work too, so the first step is hers.
  const first: Step = approved
    ? { label: `${people.Name(plan.approvedBy)} approved the plan`, when: plan.approvedAt ? byDay(plan.approvedAt) : undefined, time: plan.approvedAt, state: "done" }
    : { label: `${Who} ${who === "you" ? "approve" : "approves"} the plan`, when: `once ${who} ${who === "you" ? "approve" : "approves"}`, state: "now" };
  return [
    first,
    ...plan.timeline.map((s, i): Step => {
      // "Masters, checked by Anna"; "by you" for the one who checks.
      const by = /^Masters, checked(?: by (\S+))?$/.exec(s.label);
      const named = by?.[1];
      const checker = by ? (named ? (people.me?.name.split(" ")[0] === named ? "you" : named) : expert) : undefined;
      const label = by ? (checker ? `Masters, checked by ${checker}` : "Masters, checked") : s.label;
      const state: Step["state"] = !approved ? "ahead" : i < doneSteps ? "done" : i === doneSteps ? "now" : "ahead";
      return { label, when: byDay(s.at), time: s.at, state, check: Boolean(by) };
    }),
  ];
}
