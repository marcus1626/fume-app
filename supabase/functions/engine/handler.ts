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
  buildProduct,
  type Composer,
  type Decider,
  DIALECTS,
  type EngineTask,
  formatOf,
  GRAMMARS,
  type MachineResult,
  type ModelCall,
  runPromptMachine,
  selectMethod,
  type Verifier,
} from "../_shared/engine/index.ts";
import type { ImageProvider } from "./provider.ts";

type Failure = { message: string } | null;
type Stored = { path: string; bucket?: string };
/** A product picture: a file in the workspace's folder, or an address on the brand's own website. */
type Picture = { slot: string | null; name?: string } & ({ path: string; bucket?: string; url?: undefined } | { url: string; path?: undefined });

/** What public.engine_take hands over, before the pictures' addresses are signed. */
export type Taken = Omit<EngineTask, "products" | "master"> & {
  run: { job_id: string; attempt_id: string; attempt: number; workspace_id: string; kind: string; image_model: string };
  products: (Omit<EngineTask["products"][number], "pictures"> & { pictures: Picture[] })[];
  master: (Stored & { title: string }) | null;
  change: { problem: string; must_change: string[]; must_stay: string[] } | null;
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
  };
  models: { compose: Composer; decide: Decider; verify: Verifier };
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
    master: t.master ? { title: t.master.title, url: await deps.service.sign(t.master) } : null,
  };
}

/** What must change and stay in a correction: held to the prompt like any rule. */
function enforcedOf(t: Taken): { id: string; statement: string }[] {
  if (!t.change) return [];
  const out: { id: string; statement: string }[] = [];
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
      return error ? "failed" : "made";
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
    const task = await signTask(t, deps);
    const target = { imageType: "campaign_still", imageModel: t.run.image_model };
    const method = selectMethod(target);
    const maxReferences = method.method === "compose" ? method.dialect.maxReferences : 3;
    const concept = buildConcept(task);
    const result: MachineResult = await runPromptMachine(
      {
        target,
        grammars: GRAMMARS,
        dialects: DIALECTS,
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
    await deps.service.submitted(attemptId, deps.provider.name, submitted.providerJobId, result.request);
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
    try {
      const body = (await req.json()) as { jobId?: unknown; probe?: unknown };
      jobId = body.jobId;
      probe = body.probe === true;
    } catch {
      return answer(400, { error: "Send the job's id." });
    }
    if (typeof jobId !== "string" || !/^[0-9a-f-]{36}$/i.test(jobId)) return answer(400, { error: "Send the job's id." });
    const d = deps(authorization);
    if (!(await d.canRead(jobId))) return answer(404, { error: "No such job." });
    // Fume's people check the image provider's key without making a picture.
    if (probe) return answer(200, { provider: d.provider?.name ?? null, probe: d.provider?.probe ? await d.provider.probe() : null });
    d.later(runJob(jobId, d).catch(() => undefined));
    return answer(202, { ok: true });
  })();
}
