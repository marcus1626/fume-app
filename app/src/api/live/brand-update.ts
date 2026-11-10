// Update the brand (/brand/update): an onboarded brand's website is read again (brand-scan, as in the onboarding).
// The reading lands in a new draft of Brand DNA as Fume's proposals; here they are compared with the approved Brand
// DNA. What matches is counted and left out, the rest is new, changed (same name, another value) or unsure (Fume was
// not sure). Her answers are the same Keep, Change and Remove as on the board; Approve all keeps the rest and approves
// the draft as the next Brand DNA. Reading uploaded files comes with the Engine.
import {
  FumeError,
  type BrandFound,
  type BrandIdentity,
  type BrandUpdate,
  type FumeApi,
  type Provenance,
} from "../../contract";
import { scanCall } from "./brand";
import type { Live } from "./context";
import { command, rows, supabase } from "./supabase";

type Calls = "startBrandUpdate" | "brandUpdate" | "decideBrandFound" | "approveBrandUpdate";

interface VersionRow {
  id: string;
  version: number;
  state: "draft" | "in_review" | "approved" | "superseded";
  approved_by: string | null;
  approved_at: string | null;
  identity: Partial<BrandIdentity> | null;
}
interface UpdateScanRow {
  id: string;
  workspace_id: string;
  source: BrandUpdate["source"];
  url: string | null;
  files: string[] | null;
  state: "done" | "failed";
  sources: BrandUpdate["sources"] | null;
  error: string | null;
  created_at: string;
}

type Kind = "colour" | "typeface" | "logo" | "voice" | "image";
interface Item {
  kind: Kind;
  id: string;
  /** What she reads as its name. */
  title: string;
  /** What it is: a hex, a face, a line, a picture. */
  value: string;
  image?: string;
  provenance: Provenance;
}

/** Every item of an identity, one list, with what names it and what it holds. */
function itemsOf(identity: Partial<BrandIdentity> | null | undefined): Item[] {
  const i = identity ?? {};
  return [
    ...(i.colours ?? []).map((x) => ({
      kind: "colour" as const,
      id: x.id,
      title: x.name,
      value: x.hex,
      provenance: x.provenance,
    })),
    ...(i.typefaces ?? []).map((x) => ({
      kind: "typeface" as const,
      id: x.id,
      title: x.name,
      value: x.name,
      provenance: x.provenance,
    })),
    ...(i.logos ?? []).map((x) => ({
      kind: "logo" as const,
      id: x.id,
      title: x.name,
      value: x.image ?? x.wordmark,
      ...(x.image ? { image: x.image } : {}),
      provenance: x.provenance,
    })),
    ...(i.voice ?? []).map((x) => ({
      kind: "voice" as const,
      id: x.id,
      title: x.statement,
      value: x.statement,
      provenance: x.provenance,
    })),
    ...(i.imagery ?? []).map((x) => ({
      kind: "image" as const,
      id: x.id,
      title: x.caption,
      value: x.image,
      image: x.image,
      provenance: x.provenance,
    })),
  ].filter((x) => x.provenance);
}

// A picture's address loses its query (a shop's CDN adds a version to it), so the same picture reads as the same.
const norm = (v: string) => (/^https?:\/\//.test(v.trim()) ? v.trim().split(/[?#]/)[0]! : v).trim().toLowerCase();
const same = (a: string, b: string) => norm(a) === norm(b);
const DECISION = { approved: "kept", changed: "fixed", removed: "removed" } as const;

interface Compared {
  update: BrandUpdate;
  /** Proposals that match what Brand DNA already holds: removed when she approves all. */
  duplicates: Item[];
  /** Kept changes replace the item they change. */
  targets: Map<string, string>;
}

async function readUpdate(workspaceId: string): Promise<Compared | null> {
  const [scans, versions] = await Promise.all([
    rows<UpdateScanRow>(
      supabase()
        .from("brand_scans")
        .select("id, workspace_id, source, url, files, state, sources, error, created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(1),
    ),
    rows<VersionRow>(
      supabase()
        .from("brand_dna_versions")
        .select("id, version, state, approved_by, approved_at, identity")
        .eq("workspace_id", workspaceId)
        .order("version", { ascending: false }),
    ),
  ]);
  const scan = scans[0];
  if (!scan) return null;
  // An update is a reading after Brand DNA was first approved; the onboarding's reading is not one.
  const firstApproval = versions
    .map((v) => v.approved_at)
    .filter((a): a is string => Boolean(a))
    .sort()[0];
  if (!firstApproval || firstApproval > scan.created_at) return null;

  const base = {
    id: scan.id,
    workspaceId,
    source: scan.source,
    ...(scan.url ? { url: scan.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") } : {}),
    files: scan.files ?? [],
    sources: scan.sources ?? [],
    startedAt: scan.created_at,
  };
  if (scan.state === "failed")
    return {
      update: { ...base, state: "failed", found: [], unchanged: 0, ...(scan.error ? { error: scan.error } : {}) },
      duplicates: [],
      targets: new Map(),
    };

  const approved = versions.find((v) => v.state === "approved");
  const draft = versions.find((v) => v.state === "draft" || v.state === "in_review");
  // Approved since the reading: the update is applied.
  if (approved?.approved_at && approved.approved_at > scan.created_at && !draft)
    return {
      update: {
        ...base,
        state: "applied",
        found: [],
        unchanged: 0,
        appliedAt: approved.approved_at,
        ...(approved.approved_by ? { appliedBy: approved.approved_by } : {}),
      },
      duplicates: [],
      targets: new Map(),
    };

  const before = itemsOf(approved?.identity);
  const beforeIds = new Set(before.map((x) => x.id));
  const fresh = itemsOf(draft?.identity).filter((x) => !beforeIds.has(x.id) && x.provenance.origin === "engine");
  const duplicates: Item[] = [];
  const targets = new Map<string, string>();
  const found: BrandFound[] = [];
  for (const x of fresh) {
    const kin = before.filter((b) => b.kind === x.kind && b.provenance.state !== "removed");
    if (kin.some((b) => same(b.value, x.value))) {
      duplicates.push(x);
      continue;
    }
    const target = x.kind === "colour" || x.kind === "logo" ? kin.find((b) => same(b.title, x.title)) : undefined;
    if (target) targets.set(x.id, `${target.kind}:${target.id}`);
    const decided = x.provenance.state in DECISION ? DECISION[x.provenance.state as keyof typeof DECISION] : undefined;
    const confidence = x.provenance.confidence ?? "medium";
    found.push({
      id: `${x.kind}:${x.id}`,
      kind: x.kind,
      status: target ? "changed" : confidence === "low" ? "unsure" : "new",
      title: x.title,
      ...(x.kind === "colour" ? { subtitle: x.value } : {}),
      ...(x.image ? { image: x.image } : {}),
      ...(target ? { before: target.value, after: x.value, targetId: target.id } : {}),
      confidence,
      source: x.provenance.evidence ?? base.url ?? "",
      ...(decided ? { decision: decided } : {}),
    });
  }
  return { update: { ...base, state: "ready", found, unchanged: duplicates.length }, duplicates, targets };
}

export function brandUpdateCalls(live: Live): Pick<FumeApi, Calls> {
  const current = async () => readUpdate(await live.workspaceId());
  const decide = async (kind: string, id: string, verdict: "keep" | "change" | "remove", value?: string) =>
    command("decide_identity", {
      p_workspace_id: await live.workspaceId(),
      p_kind: kind,
      p_id: id,
      p_verdict: verdict,
      p_value: value ?? null,
    });
  const must = async () => {
    const r = await current();
    if (!r) throw new FumeError("not_found", "There is no update of the brand.");
    return r;
  };
  // Keep everything not answered yet, leave out what Brand DNA already holds, and approve the draft.
  const applyUpdate = async (r: Compared) => {
    for (const d of r.duplicates) await decide(d.kind, d.id, "remove");
    for (const f of r.update.found.filter((x) => !x.decision)) {
      const [kind, id] = f.id.split(":");
      await decide(kind!, id!, "keep");
      const target = r.targets.get(id!);
      if (target) {
        const [tk, tid] = target.split(":");
        await decide(tk!, tid!, "remove").catch(() => undefined);
      }
    }
    await command("approve_brand_dna", { p_workspace_id: await live.workspaceId() });
    live.forget();
    return (await must()).update;
  };
  return {
    async startBrandUpdate({ source, url }) {
      if (source === "upload" || !url)
        throw new FumeError("unavailable", "Reading files comes soon. Give Fume the website for now.");
      const ws = await live.workspaceId();
      const workspace = (await live.workspaces()).find((w) => w.id === ws);
      await scanCall({ workspaceId: ws, url, brand: workspace?.brandName });
      live.forget();
      const r = await must();
      // Nothing new or changed: Brand DNA stays as it is, so the reading closes itself (when she may decide).
      if (r.update.state === "ready" && r.update.found.length === 0) return applyUpdate(r).catch(() => r.update);
      return r.update;
    },
    async brandUpdate() {
      return (await current())?.update ?? null;
    },
    async decideBrandFound({ foundId, verdict, value }) {
      const r = await must();
      const [kind, id] = foundId.split(":");
      if (!kind || !id || !r.update.found.some((f) => f.id === foundId))
        throw new FumeError("not_found", "Fume found no such thing.");
      await decide(kind, id, verdict === "keep" ? "keep" : verdict === "fix" ? "change" : "remove", value);
      // A kept change takes the place of what it changes.
      const target = r.targets.get(id);
      if (target && verdict !== "remove") {
        const [tk, tid] = target.split(":");
        await decide(tk!, tid!, "remove").catch(() => undefined);
      }
      live.forget();
      return (await must()).update;
    },
    async approveBrandUpdate() {
      const r = await must();
      if (r.update.state !== "ready") return r.update;
      return applyUpdate(r);
    },
  };
}
