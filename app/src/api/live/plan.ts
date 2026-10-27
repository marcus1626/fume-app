// The plan on the live backend (FLOWS §22): Fume's plan versions from the sent brief to her approval. Every change is a
// new version (plan_versions, never overwritten); an approval, a check and an ask name the version they are for, so
// each call reads the current version first and passes it (docs/mvp/domain-model.md, gap 3: the contract's
// approvePlan(campaignId) has no version, so a plan changed since the page was read is approved as it is now).
//
// Fume writes the plan with a language model when that is on (supabase/functions/fume-plan): the plan is 'writing'
// until it is done, else it is the one direction built from the brief. Changing a line or a planned creative in place
// writes the next version through change_plan (the approver while it is ready for her, a designer until it is
// approved); "Change it with Fume" has Fume write the next version from her words.
import {
  FumeError,
  type CampaignPlan,
  type CreativeLook,
  type Format,
  type FumeApi,
  type Id,
  type PlanDirection,
  type PlanLine,
  type PlanSource,
  type PlanState,
  type PlanStep,
  type PlanVersionNote,
  type PlannedCreative,
} from "../../contract";
import { seesPlan } from "../../domain/plan";
import type { Live } from "./context";
import { askFumeToWrite, command, requestKey, rows, supabase } from "./supabase";

type Calls =
  | "plan"
  | "approvePlan"
  | "undoApprovePlan"
  | "changePlan"
  | "choosePlanDirection"
  | "askPlanChanges"
  | "changePlanWithFume"
  | "askPlanCheck"
  | "checkPlan";

type Json = Record<string, unknown>;

interface PlanRow {
  id: string;
  campaign_id: string;
  workspace_id: string;
  version: number;
  brief_version_id: string;
  body: Json;
  state: PlanState | "superseded";
  check_asked_by: string | null;
  checked_by: string | null;
  checked_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  written_by: string;
  changes: string[];
  created_at: string;
}
const PLAN =
  "id, campaign_id, workspace_id, version, brief_version_id, body, state, check_asked_by, checked_by, checked_at, approved_by, approved_at, written_by, changes, created_at";

interface AskRow {
  actor: string | null;
  action: "plan.changes_asked" | "plan.check_asked";
  subject_id: string;
  detail: Json;
  at: string;
}

// ─── The body as the contract's plan ─────────────────────────────────────────

const str = (v: unknown) => (typeof v === "string" ? v : "");
const arr = (v: unknown): Json[] =>
  Array.isArray(v) ? v.filter((x): x is Json => Boolean(x) && typeof x === "object") : [];
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const SOURCES: PlanSource[] = ["brief", "brand_dna", "taste", "moodboard", "memory", "product", "fume", "you"];
const source = (v: unknown): PlanSource => SOURCES.find((s) => s === v) ?? "fume";
const FORMATS: Format[] = ["feed", "square", "story"];
const opt = <K extends string>(key: K, v: unknown) =>
  (typeof v === "string" && v ? { [key]: v } : {}) as Partial<Record<K, string>>;

function toLine(x: Json, i: number): PlanLine {
  return {
    key: str(x.key) || `line${i + 1}`,
    label: str(x.label),
    value: str(x.value),
    source: source(x.source),
    ...opt("why", x.why),
    ...opt("changedBy", x.changedBy),
    ...opt("changedAt", x.changedAt),
  };
}

function toPlanned(x: Json, i: number): PlannedCreative {
  const look = x.look && typeof x.look === "object" ? (x.look as CreativeLook) : undefined;
  const medium = (["image", "video", "carousel"] as const).find((m) => m === x.medium);
  return {
    id: str(x.id) || `pc${i + 1}`,
    name: str(x.name) || `Creative ${i + 1}`,
    kind: x.kind === "variant" ? "variant" : "master",
    ...opt("of", x.of),
    format: FORMATS.find((f) => f === x.format) ?? "feed",
    productIds: strings(x.productIds),
    scene: str(x.scene),
    ...opt("text", x.text),
    people: str(x.people) || "No people",
    ...opt("changedBy", x.changedBy),
    ...opt("changedAt", x.changedAt),
    ...(look ? { look } : {}),
    ...opt("liveAt", x.liveAt),
    ...(medium ? { medium } : {}),
  };
}

/** The directions of a body; the chosen one holds the planned creatives when it lists none itself. */
function directionsOf(body: Json): PlanDirection[] {
  const chosen = str(body.chosen_direction_id);
  const planned = arr(body.planned_creatives);
  return arr(body.directions).map((d, i) => {
    const own = arr(d.creatives);
    const id = str(d.id) || String.fromCharCode(97 + i);
    return {
      id,
      letter: (["A", "B", "C"] as const)[i] ?? "C",
      name: str(d.name),
      idea: str(d.idea),
      hook: str(d.hook),
      why: arr(d.why).map((w) => ({ text: str(w.text), source: source(w.source) })),
      references: arr(d.references).map((r) => ({
        image: str(r.image),
        caption: str(r.caption),
        source: source(r.source),
        ...opt("campaignId", r.campaignId),
      })),
      look: arr(d.look).map(toLine),
      creatives: (own.length || id !== chosen ? own : planned).map(toPlanned),
      ...(d.recommended === true ? { recommended: true } : {}),
    };
  });
}

export function toPlan(
  rowsByVersion: PlanRow[],
  asks: AskRow[],
  briefVersion: number,
  roundsIncluded: number,
): CampaignPlan {
  const p = rowsByVersion[rowsByVersion.length - 1]!;
  const body = p.body ?? {};
  const askOf = (row: PlanRow | undefined, action: AskRow["action"]) =>
    row ? asks.filter((a) => a.subject_id === row.id && a.action === action).at(-1) : undefined;
  const by = (writtenBy: string) => (writtenBy === "fume" ? ("fume" as const) : writtenBy);
  const asked = askOf(p, "plan.changes_asked");
  const checkAsked = askOf(p, "plan.check_asked");
  const versions: PlanVersionNote[] = rowsByVersion.flatMap((row, i) => {
    if (i === 0) return [];
    const before = rowsByVersion[i - 1]!;
    const ask = askOf(before, "plan.changes_asked");
    const changes = row.changes.length
      ? row.changes
      : row.brief_version_id !== before.brief_version_id
        ? ["Written again from the brief sent since"]
        : [];
    return [
      {
        version: row.version,
        at: row.created_at,
        by: by(row.written_by),
        ...(ask && str(ask.detail.note) ? { asked: str(ask.detail.note) } : {}),
        changes,
      },
    ];
  });
  const latest = versions.at(-1);
  const note =
    p.state === "changes_asked" && asked
      ? { by: asked.actor ?? ("fume" as const), text: str(asked.detail.note), at: asked.at }
      : latest && latest.version === p.version && latest.changes.length
        ? { by: latest.by, text: latest.changes.join("; "), at: latest.at }
        : undefined;
  const directions = directionsOf(body);
  const chosenReason = str(body.chosen_reason);
  const strategicTask = str(body.strategic_task);
  const openQuestions = strings(body.open_questions).filter((q) => q.trim());
  return {
    campaignId: p.campaign_id,
    version: p.version,
    state: p.state === "superseded" ? "ready" : p.state,
    summary: str(body.summary),
    ...(strategicTask ? { strategicTask } : {}),
    ...(openQuestions.length ? { openQuestions } : {}),
    briefVersion,
    directions,
    chosenDirectionId: str(body.chosen_direction_id) || directions[0]?.id || "a",
    ...(chosenReason ? { chosenReason } : {}),
    content: arr(body.content).map(toLine),
    rules: arr(body.rules).map((r) => ({
      text: str(r.text),
      kind: r.kind === "never" ? ("never" as const) : ("must" as const),
      source: source(r.source),
      ...opt("ruleId", r.ruleId),
    })),
    timeline: arr(body.timeline).map((s): PlanStep => ({ label: str(s.label), at: str(s.at) })),
    changeRequestsIncluded: roundsIncluded,
    ...(note ? { note } : {}),
    writtenAt: p.created_at,
    ...(p.checked_by ? { checkedBy: p.checked_by } : {}),
    ...(p.checked_at ? { checkedAt: p.checked_at } : {}),
    ...(p.approved_by ? { approvedBy: p.approved_by } : {}),
    ...(p.approved_at ? { approvedAt: p.approved_at } : {}),
    ...(p.check_asked_by ? { checkAsked: { by: p.check_asked_by, at: checkAsked?.at ?? p.created_at } } : {}),
    ...(versions.length ? { versions } : {}),
  };
}

// ─── Reading ─────────────────────────────────────────────────────────────────

/** Every version of the campaign's plan, oldest first; the last is the current one. Empty before the brief is sent. */
async function planRows(campaignId: Id): Promise<PlanRow[]> {
  return rows<PlanRow>(
    supabase().from("plan_versions").select(PLAN).eq("campaign_id", campaignId).order("version", { ascending: true }),
  );
}

async function current(campaignId: Id): Promise<PlanRow> {
  const found = (await planRows(campaignId)).at(-1);
  if (!found || found.state === "superseded")
    throw new FumeError("not_found", "This campaign has no plan yet. Send the brief first.");
  return found;
}

async function readPlan(campaignId: Id): Promise<CampaignPlan | null> {
  const list = await planRows(campaignId);
  const p = list.at(-1);
  if (!p || p.state === "superseded") return null;
  const [briefs, asks, campaign] = await Promise.all([
    rows<{ version: number }>(supabase().from("brief_versions").select("version").eq("id", p.brief_version_id)),
    rows<AskRow>(
      supabase()
        .from("record_events")
        .select("actor, action, subject_id, detail, at")
        .in(
          "subject_id",
          list.map((r) => r.id),
        )
        .in("action", ["plan.changes_asked", "plan.check_asked"])
        .order("at", { ascending: true }),
    ),
    rows<{ rounds_included: number }>(supabase().from("campaigns").select("rounds_included").eq("id", campaignId)),
  ]);
  return toPlan(list, asks, briefs[0]?.version ?? 1, campaign[0]?.rounds_included ?? 2);
}

const dayWords = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Oslo" })
    .format(new Date(iso))
    .replace(",", "");

// ─── The calls ───────────────────────────────────────────────────────────────

export function planCalls(live: Live): Pick<FumeApi, Calls> {
  /** The next version: the current body changed, with what changed in words. */
  const writeNext = async (p: PlanRow, body: Json, changes: string[]) => {
    await command("change_plan", {
      p_campaign_id: p.campaign_id,
      p_version: p.version,
      p_body: body,
      p_changes: changes,
      p_key: requestKey(),
    });
    return calls.plan(p.campaign_id) as Promise<CampaignPlan>;
  };

  /** A copy of the body to change, with the chosen direction holding its creatives. */
  const editable = (p: PlanRow) => {
    const body = structuredClone(p.body ?? {}) as Json;
    const directions = arr(body.directions);
    body.directions = directions;
    const chosen = directions.find((d) => d.id === body.chosen_direction_id) ?? directions[0];
    if (!chosen) throw new FumeError("invalid", "This plan has no direction to change.");
    if (!arr(chosen.creatives).length) chosen.creatives = arr(body.planned_creatives);
    return { body, chosen, creatives: chosen.creatives as Json[] };
  };

  const calls: Pick<FumeApi, Calls> = {
    // The customer reads it once it is ready; while it is written or checked she sees only where it is.
    async plan(campaignId) {
      const [plan, me] = await Promise.all([readPlan(campaignId), live.me()]);
      // While Fume writes, each read makes sure it is (a run that never came back is taken again).
      if (plan?.state === "writing") askFumeToWrite(campaignId);
      if (plan && !seesPlan(me, undefined, plan))
        return { ...plan, directions: [], content: [], rules: [], summary: "" };
      return plan;
    },

    async approvePlan(campaignId) {
      const p = await current(campaignId);
      await command("approve_plan", { p_campaign_id: campaignId, p_version: p.version, p_key: requestKey() });
      return (await calls.plan(campaignId))!;
    },
    async undoApprovePlan(campaignId) {
      const p = await current(campaignId);
      if (p.state === "approved")
        await command("undo_approve_plan", { p_campaign_id: campaignId, p_version: p.version });
      return (await calls.plan(campaignId))!;
    },

    async changePlan(campaignId, change) {
      const p = await current(campaignId);
      const me = await live.me();
      const staff = Boolean(me.staffRole);
      const { body, chosen, creatives } = editable(p);
      const by = { changedBy: me.id, changedAt: new Date().toISOString() };
      let what: string;
      if (change.step) {
        const step = arr(body.timeline).find(
          (s) => s.label === change.step || str(s.label).startsWith(`${change.step},`),
        );
        if (!step || !change.stepAt) throw new FumeError("not_found", "No such step in the plan.");
        step.at = change.stepAt;
        what = `${str(step.label)}: ${dayWords(change.stepAt)}`;
      } else if (change.creativeId) {
        const pc = creatives.find((x) => x.id === change.creativeId);
        if (!pc) throw new FumeError("not_found", "No such creative in the plan.");
        const name = str(pc.name) || "A creative";
        const parts: string[] = [];
        if (change.creative) {
          Object.assign(pc, change.creative);
          parts.push(
            ...Object.keys(change.creative).map((k) => (k === "scene" ? `scene: ${change.creative!.scene}` : k)),
          );
        }
        if (change.value !== undefined) {
          pc.scene = change.value;
          parts.push(`scene: ${change.value}`);
        }
        if (change.look !== undefined) {
          const look = change.look && Object.values(change.look).some((v) => v?.trim()) ? change.look : undefined;
          if (look) pc.look = look;
          else delete pc.look;
          parts.push(look ? "its own look" : "the plan's look");
        }
        if (change.liveAt) {
          pc.liveAt = change.liveAt;
          parts.push(`goes live ${dayWords(change.liveAt)}`);
        }
        if (!parts.length) throw new FumeError("invalid", "Say what should change.");
        Object.assign(pc, by);
        what = `${name}’s ${parts.join(", ")}`;
      } else if (change.line) {
        const l = [...arr(chosen.look), ...arr(body.content)].find((x) => x.key === change.line);
        if (!l) throw new FumeError("not_found", "No such line in the plan.");
        const value = (change.value ?? "").trim();
        if (!value) throw new FumeError("invalid", "Write what it should be.");
        // The expert's change keeps its source and why; hers is "you" (Changed by … on both sides).
        Object.assign(l, { value, ...(staff ? {} : { source: "you" }) }, by);
        if (!staff) delete l.why;
        what = `${str(l.label) || "A line"}: ${value}`;
      } else throw new FumeError("invalid", "Say what should change.");
      body.planned_creatives = creatives;
      return writeNext(p, body, [what]);
    },

    async choosePlanDirection(campaignId, directionId, reason) {
      const p = await current(campaignId);
      const { body } = editable(p);
      const d = arr(body.directions).find((x) => x.id === directionId);
      if (!d) throw new FumeError("not_found", "No such direction in the plan.");
      const why = reason?.trim() ?? "";
      if (body.chosen_direction_id === directionId && str(body.chosen_reason) === why)
        return (await calls.plan(campaignId))!;
      body.chosen_direction_id = directionId;
      if (why) body.chosen_reason = why;
      else delete body.chosen_reason;
      if (arr(d.creatives).length) body.planned_creatives = d.creatives;
      return writeNext(p, body, [`The direction: ${str(d.name) || directionId}`]);
    },

    async askPlanChanges(campaignId, note) {
      if (!note.trim()) throw new FumeError("invalid", "Write what Fume should change.");
      const p = await current(campaignId);
      await command("ask_plan_changes", { p_campaign_id: campaignId, p_version: p.version, p_note: note.trim() });
      return (await calls.plan(campaignId))!;
    },

    // Fume writes the next version from her words (change_plan_with_fume); when the language model is off, her
    // words go to Fume's designer as a request for changes.
    async changePlanWithFume(campaignId, text) {
      if (!text.trim()) throw new FumeError("invalid", "Write what Fume should change.");
      const p = await current(campaignId);
      await command("change_plan_with_fume", {
        p_campaign_id: campaignId,
        p_version: p.version,
        p_note: text.trim(),
        p_key: requestKey(),
      });
      askFumeToWrite(campaignId, true);
      return (await calls.plan(campaignId))!;
    },

    async askPlanCheck(campaignId) {
      const p = await current(campaignId);
      await command("ask_plan_check", { p_campaign_id: campaignId, p_version: p.version });
      return (await calls.plan(campaignId))!;
    },
    async checkPlan(campaignId) {
      const p = await current(campaignId);
      await command("check_plan", { p_campaign_id: campaignId, p_version: p.version });
      return (await calls.plan(campaignId))!;
    },
  };
  return calls;
}
