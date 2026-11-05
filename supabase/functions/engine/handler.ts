// The edge function `engine` (supabase/migrations/20261104130000_engine.sql). The Studio calls it after Render, and
// again while a creative shows the Engine at work. The caller's own token decides whether they may see the job; the
// service role takes the attempt, and the database records every step. The answer comes at once (202); the work goes
// on in the background: write and check the prompt, have the image model make the picture, keep it as a candidate.
// Without an image provider (no HF_CREDENTIALS yet) the prompt is still written and checked, and the job says so.
// handler.test.ts runs it without Supabase or any model.
import {
  buildBrand,
  buildConcept,
  buildKnowledge,
  buildLedger,
  chooseVariants,
  COMPOSITION_ROLE,
  buildProduct,
  checklist,
  type Composer,
  type Decider,
  DIALECTS,
  type EngineTask,
  type Evaluation,
  formatOf,
  FORMATS,
  GRAMMARS,
  type Looked,
  type MachineResult,
  type ManifestItem,
  type ModelCall,
  runPromptMachine,
  selectMethod,
  toEvaluation,
  type Verifier,
} from "../_shared/engine/index.ts";
import type { ImageProvider } from "./provider.ts";

type Failure = { message: string } | null;
type Stored = { path: string; bucket?: string };
/** A product picture: a file in the workspace's folder, or an address on the brand's own website. */
type Picture = { slot: string | null; name?: string } & ({ path: string; bucket?: string; url?: undefined } | { url: string; path?: undefined });

/** What public.engine_take hands over, before the pictures' addresses are signed. */
export type Taken = Omit<EngineTask, "products" | "master" | "composition"> & {
  run: { job_id: string; attempt_id: string; attempt: number; workspace_id: string; kind: string; image_model: string };
  products: (Omit<EngineTask["products"][number], "pictures"> & { pictures: Picture[] })[];
  master: (Stored & { title: string; picked?: boolean }) | null;
  /** How each way of writing a prompt did for this model, per kind of picture (the prompt graph, every brand). */
  arms?: { image_type: string; feature: string; n: number; sum: number }[];
  /** The campaign moodboard's picture for composition, light and mood (never the product's truth). */
  composition?: ({ id: string; note?: string } & ({ path: string; bucket?: string; url?: undefined } | { url: string; path?: undefined })) | null;
  /** A correction's problem and what must change and stay; `ask` and `direction` are the designer's words with Render. */
  change: { problem: string; must_change: string[]; must_stay: string[]; ask?: string; direction?: string } | null;
};
/** A person's answer on one of the Engine's pictures, with the prompt behind it. */
export type Pending = { id: string; verdict: "yes" | "no"; why: string; image_model: string | null; updated_at: string; concept: string; slots: { slotKey: string; text: string }[] };
export type DigestLesson = { statement: string; polarity: "do" | "avoid"; reason: string; scope: "brand" | "brand_and_model" };
/** Looks at a picture against the prompt's checklist (and the product's own photograph). */
export type Evaluator = (input: {
  pictureUrl: string;
  /** The product's own photographs, at most three. */
  productUrls: string[];
  checks: ReturnType<typeof checklist>;
  size?: { width: number; height: number };
}) => Promise<{ looked: Looked; call: ModelCall }>;
/** Turns one answer into at most three lessons, from what the person said only. */
export type Digester = (answer: Pending) => Promise<{ lessons: DigestLesson[]; call: ModelCall }>;
export type ToEvaluate = {
  candidates: { id: string; path: string; width?: number | null; height?: number | null }[];
  manifest: ManifestItem[];
  references: { url: string; role: string }[];
};
export type Collect = { job_id: string; attempt_id: string; workspace_id: string; provider: string; model: string; provider_job_id: string; started_at: string };

export interface Deps {
  canRead(jobId: string): Promise<boolean>;
  service: {
    take(jobId: string): Promise<{ data: { collect: Collect } | Taken | null; error: Failure }>;
    prompted(attemptId: string, prompt: Record<string, unknown>): Promise<{ error: Failure }>;
    submitted(attemptId: string, provider: string, providerJobId: string, request: unknown): Promise<{ error: Failure }>;
    finish(attemptId: string, files: Record<string, unknown>[], response: unknown, costCents: number): Promise<{ error: Failure }>;
    fail(attemptId: string, error: string, response: unknown, costCents: number, final: boolean): Promise<{ error: Failure }>;
    /** A signed address an image model may read, for an hour. */
    sign(file: Stored): Promise<string>;
    /** Keeps a made picture in the workspace's folder. */
    store(path: string, bytes: Uint8Array, contentType: string): Promise<{ error: Failure }>;
    /** The brand's answers that wait to become lessons (public.engine_pending). */
    pending?(workspaceId: string): Promise<{ data: Pending[] | null; error: Failure }>;
    /** An answer's lessons (public.engine_digested); 0 when the answer changed in the meantime. */
    digested?(answerId: string, updatedAt: string, lessons: DigestLesson[], llmUsd: number): Promise<{ data: number | null; error: Failure }>;
    /** An attempt's pictures that wait to be looked at, with the prompt's manifest (public.engine_to_evaluate). */
    toEvaluate?(attemptId: string): Promise<{ data: ToEvaluate | null; error: Failure }>;
    evaluated?(candidateId: string, evaluation: Evaluation, llmUsd: number): Promise<{ error: Failure }>;
    /** Asks the details function to read the product's small print on a picture (docs/mvp/detail-read.md). */
    askDetails?(candidateId: string): Promise<void>;
  };
  models: { compose: Composer; decide: Decider; verify: Verifier; digest?: Digester; evaluate?: Evaluator };
  /** null: no image provider yet (a dry run). */
  provider: ImageProvider | null;
  download(url: string): Promise<{ bytes: Uint8Array; contentType: string }>;
  later(work: Promise<unknown>): void;
  /** Waits between looks at the image model. */
  wait(ms: number): Promise<void>;
  /** How long one run keeps looking before it leaves the rest to the next call. */
  collectForMs?: number;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const answer = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

export const NO_PROVIDER = "The prompt passed Fume's checks. No image model is connected yet, so nothing was rendered.";

/** The pictures the Engine needs, signed; the task as the prompt machine reads it. */
async function signTask(t: Taken, deps: Deps): Promise<EngineTask> {
  return {
    ...t,
    products: await Promise.all(t.products.map(async (p) => ({
      ...p,
      pictures: await Promise.all(p.pictures.map(async (pic) => ({
        slot: pic.slot,
        name: pic.name,
        url: pic.url ?? (await deps.service.sign({ path: pic.path!, bucket: pic.bucket })),
      }))),
    }))),
    master: t.master
      ? { title: t.master.title, url: await deps.service.sign(t.master), ...(t.master.picked ? { picked: true } : {}) }
      : null,
    composition: t.composition
      ? { id: t.composition.id, url: t.composition.url ?? (await deps.service.sign({ path: t.composition.path!, bucket: t.composition.bucket })), ...(t.composition.note ? { note: t.composition.note } : {}) }
      : null,
  };
}

const isFormat = (t: Partial<Pick<Taken, "run" | "creative" | "master">>) =>
  t.run?.kind === "format" && Boolean(t.master) && Boolean(t.creative);

/** What must change and stay in a correction, and what the designer asked: held to the prompt like any rule. */
export function enforcedOf(t: Pick<Taken, "change"> & Partial<Pick<Taken, "run" | "creative" | "master">>): { id: string; statement: string }[] {
  const out: { id: string; statement: string }[] = [];
  const said = t.change?.ask?.trim().replace(/[.!?]*$/, ".");
  // A format is the approved master in another shape: the same picture, recomposed where the frame changes.
  const format = isFormat(t)
    ? `Make the first picture in the ${t.creative!.format} format, ${(FORMATS[t.creative!.format] ?? FORMATS.feed).aspectRatio}: extend or recompose the scene where the frame changes, and keep the product whole and exactly as it is.`
    : null;
  if (format || said)
    out.push({ id: "ask", statement: [format, said && `The designer asks for this change: ${said}`].filter(Boolean).join(" ") });
  if (!t.change) return out;
  if (t.change.direction?.trim() && !said)
    out.push({ id: "direction", statement: `The designer's direction for the picture: ${t.change.direction.trim().replace(/[.!?]*$/, ".")}` });
  if (t.change.problem?.trim()) out.push({ id: "change", statement: `Fix this: ${t.change.problem.trim()}` });
  (t.change.must_change ?? []).forEach((x, i) => out.push({ id: `change-${i + 1}`, statement: `Change ${x}.` }));
  (t.change.must_stay ?? []).forEach((x, i) => out.push({ id: `stay-${i + 1}`, statement: `Keep ${x} exactly as it is.` }));
  return out;
}

const SIZE_PNG = (b: Uint8Array) =>
  b.length > 24 && b[0] === 0x89 && b[1] === 0x50 ? { width: new DataView(b.buffer, b.byteOffset).getUint32(16), height: new DataView(b.buffer, b.byteOffset).getUint32(20) } : null;
function sizeOf(b: Uint8Array): { width: number; height: number } | null {
  const png = SIZE_PNG(b);
  if (png) return png;
  if (b[0] === 0xff && b[1] === 0xd8) {
    // JPEG: the first start-of-frame marker carries the size.
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1];
      const len = (b[i + 2] << 8) | b[i + 3];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
        return { height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8] };
      i += 2 + len;
    }
  }
  return null;
}
async function sha256(b: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new Uint8Array(b));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/** Looks at the image model until the picture is there (or the time is up), then keeps it. */
async function collect(
  c: { attemptId: string; workspaceId: string; jobId: string; providerJobId: string; model: string; title: string; number?: number },
  deps: Deps,
): Promise<"made" | "failed" | "waiting"> {
  const provider = deps.provider!;
  const until = Date.now() + (deps.collectForMs ?? 110_000);
  let delay = 2_000;
  while (Date.now() < until) {
    const r = await provider.collect(c.providerJobId);
    if (r.state === "failed") {
      await deps.service.fail(c.attemptId, r.error, r.response, 0, r.final);
      return "failed";
    }
    if (r.state === "done") {
      const files: Record<string, unknown>[] = [];
      for (const [i, url] of r.urls.entries()) {
        const { bytes, contentType } = await deps.download(url);
        const ext = EXT[contentType] ?? "png";
        const path = `${c.workspaceId}/engine/${c.jobId}/${c.attemptId}-${i + 1}.${ext}`;
        const { error } = await deps.service.store(path, bytes, contentType);
        if (error) {
          await deps.service.fail(c.attemptId, `The picture could not be kept: ${error.message}`, r.response, 0, false);
          return "failed";
        }
        files.push({ path, name: `${c.title}, Engine ${i + 1}.${ext}`, content_type: contentType, bytes: bytes.length, sha256: await sha256(bytes), ...sizeOf(bytes) });
      }
      const { error } = await deps.service.finish(c.attemptId, files, r.response, provider.priceCents(c.model) * r.urls.length);
      if (error) return "failed";
      await evaluatePictures(c.attemptId, deps);
      return "made";
    }
    await deps.wait(delay);
    delay = Math.min(delay * 1.5, 10_000);
  }
  return "waiting";
}

export type RunOutcome = "nothing" | "made" | "failed" | "waiting" | "dry";

/** One run of a job: up to three attempts in a row (a refused picture is often made on the next try). */
export async function runJob(jobId: string, deps: Deps): Promise<RunOutcome> {
  let outcome: RunOutcome = "nothing";
  for (let round = 0; round < 3; round++) {
    const { data, error } = await deps.service.take(jobId);
    if (error || !data) return outcome;
    if ("collect" in data) {
      const c = data.collect;
      if (!deps.provider) return "waiting";
      return await collect({ attemptId: c.attempt_id, workspaceId: c.workspace_id, jobId: c.job_id, providerJobId: c.provider_job_id, model: c.model, title: "Engine" }, deps);
    }
    outcome = await attempt(data, deps);
    if (outcome !== "failed") return outcome;
  }
  return outcome;
}

/** The Engine looks at the pictures it just kept. A failure here never undoes the picture: it is simply not evaluated,
 *  and the expert checks it by eye as with any picture. */
async function evaluatePictures(attemptId: string, deps: Deps): Promise<void> {
  const evaluate = deps.models.evaluate;
  if (!evaluate || !deps.service.toEvaluate || !deps.service.evaluated) return;
  try {
    const { data } = await deps.service.toEvaluate(attemptId);
    if (!data?.candidates.length) return;
    // The product's photographs (the picture this is made from is not one: context.ts names it "the approved …" or "the
    // picture of …").
    const productUrls = (data.references ?? [])
      .filter((r) => !r.role.startsWith("the approved ") && !r.role.startsWith("the picture of ") && r.role !== COMPOSITION_ROLE)
      .map((r) => r.url)
      .slice(0, 3);
    const checks = checklist(data.manifest ?? [], productUrls.length > 0);
    for (const c of data.candidates) {
      const pictureUrl = await deps.service.sign({ path: c.path });
      const size = c.width && c.height ? { width: c.width, height: c.height } : undefined;
      const { looked, call } = await evaluate({ pictureUrl, productUrls, checks, ...(size ? { size } : {}) });
      await deps.service.evaluated(c.id, toEvaluation(checks, looked), call.costUsd ?? 0);
      // The small print is read closer, against the product's own photographs, after the picture is evaluated.
      if (productUrls.length > 0) await deps.service.askDetails?.(c.id).catch(() => undefined);
    }
  } catch {
    // Not evaluated: the expert checks by eye.
  }
}

/** Before a prompt is written, the brand's answers that say why become lessons, and this prompt already uses them. A
 *  failure here never stops the render: the answers wait for the next one. */
async function digestAnswers(t: Taken, deps: Deps): Promise<void> {
  const digest = deps.models.digest;
  if (!digest || !deps.service.pending || !deps.service.digested) return;
  try {
    const { data } = await deps.service.pending(t.run.workspace_id);
    for (const a of data ?? []) {
      const { lessons, call } = await digest(a);
      const kept = lessons.slice(0, 3);
      const { data: n, error } = await deps.service.digested(a.id, a.updated_at, kept, call.costUsd ?? 0);
      if (error || !n) continue;
      t.lessons = [...kept.map((l, i) => ({ id: `${a.id}:${i}`, statement: l.statement, polarity: l.polarity, reason: l.reason })), ...t.lessons];
    }
  } catch {
    // The answers stay pending; the next render digests them.
  }
}

async function attempt(t: Taken, deps: Deps): Promise<RunOutcome> {
  const calls: ModelCall[] = [];
  const keep = <A, R extends { call: ModelCall | null }>(f: (a: A) => Promise<R>) => async (a: A) => {
    try {
      const r = await f(a);
      if (r.call) calls.push(r.call);
      return r;
    } catch (e) {
      const call = (e as { call?: ModelCall }).call;
      if (call) calls.push(call);
      throw e;
    }
  };
  const llmUsd = () => Math.round(calls.reduce((s, c) => s + (c.costUsd ?? 0), 0) * 10_000) / 10_000;
  const attemptId = t.run.attempt_id;
  let recorded = false;
  try {
    await digestAnswers(t, deps);
    const task = await signTask(t, deps);
    // Words on a picture already made change that picture, and a format reshapes its master; everything else is a new
    // campaign still.
    const target = { imageType: t.master?.picked || isFormat(t) ? "picture_edit" : "campaign_still", imageModel: t.run.image_model };
    // One way of saying each thing the dialect has a choice for, drawn from how each did (learn.ts).
    const arms = (t.arms ?? []).filter((a) => a.image_type === target.imageType);
    const dialects = DIALECTS.map((d) => (d.imageModel === target.imageModel ? chooseVariants(d, arms).dialect : d));
    const method = selectMethod(target, GRAMMARS, dialects);
    const maxReferences = method.method === "compose" ? method.dialect.maxReferences : 3;
    const concept = buildConcept(task);
    const result: MachineResult = await runPromptMachine(
      {
        target,
        grammars: GRAMMARS,
        dialects,
        product: buildProduct(task, maxReferences),
        brand: buildBrand(task, concept.lookKey),
        concept,
        format: formatOf(task),
        knowledge: buildKnowledge(task),
        enforcedLessons: enforcedOf(t),
      },
      { compose: keep(deps.models.compose), decide: keep(deps.models.decide), verify: keep(deps.models.verify) },
    );
    const record = result.status === "blocked"
      ? { hash: "", status: "blocked", reason: result.code, image_model: target.imageModel, message: result.message, findings: [], llm_usd: llmUsd(), calls }
      : {
        hash: result.hash,
        status: result.status,
        reason: result.status === "escalated" ? result.reason : null,
        image_model: target.imageModel,
        compile_package: result.compilePackage,
        slots: result.status === "validated" ? result.assembly.slots : (result.attempts.at(-1)?.slots ?? []),
        text: result.status === "validated" ? result.assembly.text : (result.attempts.at(-1)?.text ?? null),
        findings: result.status === "validated" ? [] : result.findings,
        attempts: result.attempts,
        calls,
        llm_usd: llmUsd(),
        // What of the brand's data went into this prompt, how it was checked there, and why the rest was left out.
        ledger: buildLedger(task, result.compilePackage, result.attempts.at(-1)?.decisions ?? []),
      };
    await deps.service.prompted(attemptId, record);
    recorded = true;
    if (result.status !== "validated") return "failed";
    if (!deps.provider) {
      await deps.service.fail(attemptId, NO_PROVIDER, null, 0, true);
      return "dry";
    }
    const submitted = await deps.provider.submit(result.request);
    if (!submitted.ok) {
      await deps.service.fail(attemptId, submitted.error, null, 0, submitted.final);
      return "failed";
    }
    await deps.service.submitted(attemptId, submitted.provider ?? deps.provider.name, submitted.providerJobId, result.request);
    return await collect({ attemptId, workspaceId: t.run.workspace_id, jobId: t.run.job_id, providerJobId: submitted.providerJobId, model: t.run.image_model, title: t.creative.title }, deps);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (recorded) {
      await deps.service.fail(attemptId, message, null, 0, false);
      return "failed";
    }
    // The prompt was not recorded: keep what its calls cost with the failure.
    await deps.service.prompted(attemptId, { hash: "", status: "blocked", reason: "error", image_model: t.run.image_model, message, findings: [{ code: "error", message }], calls, llm_usd: llmUsd() });
    return "failed";
  }
}

export function handleEngine(req: Request, deps: (authorization: string) => Deps): Promise<Response> | Response {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return answer(405, { error: "Use POST." });
  const authorization = req.headers.get("Authorization");
  if (!authorization) return answer(401, { error: "Sign in first." });
  return (async () => {
    let jobId: unknown;
    let probe = false;
    let routes: string[] | undefined;
    try {
      const body = (await req.json()) as { jobId?: unknown; probe?: unknown; routes?: unknown };
      jobId = body.jobId;
      probe = body.probe === true;
      if (Array.isArray(body.routes)) routes = body.routes.filter((r): r is string => typeof r === "string" && /^(https:\/\/[a-z0-9-]+\.higgsfield\.ai)?[\w./-]{1,160}$/.test(r)).slice(0, 40);
    } catch {
      return answer(400, { error: "Send the job's id." });
    }
    if (typeof jobId !== "string" || !/^[0-9a-f-]{36}$/i.test(jobId)) return answer(400, { error: "Send the job's id." });
    const d = deps(authorization);
    if (!(await d.canRead(jobId))) return answer(404, { error: "No such job." });
    // Fume's people check the image provider's key without making a picture.
    if (probe) return answer(200, { provider: d.provider?.name ?? null, probe: d.provider?.probe ? await d.provider.probe(routes) : null });
    d.later(runJob(jobId, d).catch(() => undefined));
    return answer(202, { ok: true });
  })();
}
