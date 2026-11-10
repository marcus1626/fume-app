// Brand DNA on the live backend, read only: the approved (or newest) Brand DNA version, its rules, the brand's
// products and its sources. The parts the Engine learns later (references, taste, memory, the understanding check,
// the board's identity and moodboard) still answer from the empty workspace (live/index.ts), so their pages show
// nothing rather than the demo's data. Changing a rule or approving Brand DNA is not live yet.
import { FunctionsHttpError } from "@supabase/supabase-js";
import type {
  BrandDna,
  BrandIdentity,
  BrandRule,
  BrandScan,
  FumeApi,
  OnboardingProgress,
  FumeErrorCode,
  Provenance,
  SourceAsset,
  SourceAssetKind,
} from "../../contract";
import { FumeError } from "../../contract";
import type { Live } from "./context";
import { fileUrls } from "./map";
import { readProducts } from "./products";
import { command, rows, supabase } from "./supabase";
import { brandMoodboard } from "./boards";
import { learnTaste, readDeck, readReferences } from "./taste";

type Calls =
  | "brandDna"
  | "brandBoard"
  | "decide"
  | "setColourUses"
  | "moveImage"
  | "decideVoicePart"
  | "approveBrandDna"
  | "startBrandScan"
  | "brandScan"
  | "onboardingProgress"
  | "saveOnboardingProgress";

const EMPTY: BrandIdentity = { colours: [], typefaces: [], logos: [], voice: [], imagery: [] };
interface ScanRow {
  id: string;
  workspace_id: string;
  source: BrandScan["source"];
  url: string | null;
  files: string[];
  state: BrandScan["state"];
  sources: BrandScan["sources"];
  finds: BrandScan["finds"];
  error: string | null;
}
const toScan = (r: ScanRow, needsYou: number): BrandScan => ({
  id: r.id,
  workspaceId: r.workspace_id,
  source: r.source,
  ...(r.url ? { url: r.url } : {}),
  files: r.files ?? [],
  state: r.state,
  sources: r.sources ?? [],
  finds: r.finds ?? [],
  needsYou,
  ...(r.error ? { error: r.error } : {}),
});

interface DnaRow {
  id: string;
  workspace_id: string;
  version: number;
  state: "draft" | "in_review" | "approved" | "superseded";
  approved_by: string | null;
  approved_at: string | null;
  identity: BrandIdentity | null;
}
interface RuleRow {
  id: string;
  area: BrandRule["area"];
  statement: string;
  kind: BrandRule["kind"];
  origin: "supplied" | "inferred" | "learned";
}
interface SourceRow {
  id: string;
  kind: SourceAssetKind | "website";
  name: string;
  file_id: string | null;
  created_by: string | null;
  created_at: string;
}

const RULE_AREAS: BrandRule["area"][] = ["logo", "colour", "type", "voice", "layout", "imagery", "claims"];

/** The newest version: the draft that takes her decisions, else the approved one. */
async function currentDna(workspaceId: string): Promise<DnaRow | undefined> {
  const list = await rows<DnaRow>(
    supabase()
      .from("brand_dna_versions")
      .select("id, workspace_id, version, state, approved_by, approved_at, identity")
      .eq("workspace_id", workspaceId)
      .neq("state", "superseded")
      .order("version", { ascending: false }),
  );
  return list[0];
}

/** The identity as the board shows it: what she removed is left out. */
function identityOf(d: DnaRow | undefined): BrandIdentity {
  const id = { ...EMPTY, ...(d?.identity ?? {}) };
  const kept = <T extends { provenance: Provenance }>(list: T[] | undefined) =>
    (list ?? []).filter((x) => x.provenance?.state !== "removed");
  return {
    colours: kept(id.colours),
    typefaces: kept(id.typefaces),
    logos: kept(id.logos),
    voice: kept(id.voice),
    imagery: kept(id.imagery),
    ...(id.voiceBook ? { voiceBook: id.voiceBook } : {}),
  };
}
const openOf = (i: BrandIdentity) =>
  [...i.colours, ...i.typefaces, ...i.logos, ...i.voice, ...i.imagery].filter((x) => x.provenance.state === "proposed")
    .length;

function toDna(workspaceId: string, d: DnaRow | undefined, rules: RuleRow[]): BrandDna {
  if (!d) return { workspaceId, version: 0, state: "draft", completeness: 0, summary: "" };
  const covered = new Set(rules.map((r) => r.area)).size / RULE_AREAS.length;
  return {
    workspaceId,
    version: d.version,
    state: d.state === "superseded" ? "approved" : d.state,
    ...(d.approved_by ? { approvedBy: d.approved_by } : {}),
    ...(d.approved_at ? { approvedAt: d.approved_at } : {}),
    completeness: Math.round(covered * 100) / 100,
    summary: "",
  };
}

function toRule(r: RuleRow, approved: boolean): BrandRule {
  return {
    id: r.id,
    area: r.area,
    statement: r.statement,
    kind: r.kind,
    // What the customer supplied and approved counts as verified; what Fume inferred or learned stays theirs to confirm.
    source: approved && r.origin === "supplied" ? "verified" : r.origin,
    confidence: approved ? "high" : r.origin === "supplied" ? "medium" : "low",
  };
}

async function readBrand(workspaceId: string) {
  const d = await currentDna(workspaceId);
  const ruleRows = d
    ? await rows<RuleRow>(
        supabase()
          .from("brand_rules")
          .select("id, area, statement, kind, origin")
          .eq("brand_dna_version_id", d.id)
          .order("created_at"),
      )
    : [];
  const approved = d?.state === "approved";
  return {
    dna: toDna(workspaceId, d, ruleRows),
    rules: ruleRows.map((r) => toRule(r, approved)),
    identity: identityOf(d),
  };
}

/** The brand's own files (logo, guidelines, pictures). Product pictures belong to their product. */
async function readAssets(workspaceId: string): Promise<SourceAsset[]> {
  const list = await rows<SourceRow>(
    supabase()
      .from("sources")
      .select("id, kind, name, file_id, created_by, created_at")
      .eq("workspace_id", workspaceId)
      .is("product_id", null)
      .neq("kind", "website")
      .order("created_at", { ascending: false }),
  );
  const urls = await fileUrls(list.map((s) => s.file_id));
  return list.map((s) => {
    const f = s.file_id ? urls.get(s.file_id) : undefined;
    const picture = f?.file.content_type.startsWith("image/");
    return {
      id: s.id,
      kind: s.kind === "website" ? "other" : s.kind,
      name: s.name,
      bytes: f?.file.bytes ?? 0,
      uploadedBy: s.created_by ?? "",
      at: s.created_at,
      ...(picture && f ? { thumbnail: f.url } : {}),
    };
  });
}

export async function scanCall(body: Record<string, unknown>): Promise<ScanRow> {
  const { data, error } = await supabase().functions.invoke<{ scan: ScanRow }>("brand-scan", { body });
  if (error) {
    const said: { code?: FumeErrorCode; message?: string } =
      error instanceof FunctionsHttpError ? await error.context.json().catch(() => ({})) : {};
    throw new FumeError(said.code ?? "unavailable", said.message ?? "Fume could not read the website just now.");
  }
  return data!.scan;
}

export function brandCalls(live: Live): Pick<FumeApi, Calls> {
  const board = async () => {
    const ws = await live.workspaceId();
    const [{ dna, rules, identity }, moodboard] = await Promise.all([readBrand(ws), brandMoodboard(ws)]);
    return {
      dna,
      rules,
      identity,
      moodboard,
      open: openOf(identity),
    };
  };
  const calls: Pick<FumeApi, Calls> = {
    async brandDna() {
      const workspaceId = await live.workspaceId();
      const [brand, products, assets, deck, references] = await Promise.all([
        readBrand(workspaceId),
        readProducts(workspaceId),
        readAssets(workspaceId),
        readDeck(workspaceId).catch(() => undefined),
        readReferences(workspaceId).catch(() => []),
      ]);
      learnTaste(workspaceId);
      // What Fume understood from uploaded material, and the memory it keeps, come with the Engine; until then they
      // are empty for every brand (never the demo brand's).
      return {
        dna: brand.dna,
        rules: brand.rules,
        products,
        assets,
        references,
        tastePairs: deck?.pairs ?? [],
        memory: [],
        understanding: { version: brand.dna.version, summary: [], conflicts: [], unknowns: [], testDirections: [] },
      };
    },
    brandBoard: board,
    // Only the customer decides; the database says so when someone else tries.
    async decide({ kind, id, verdict, value }) {
      if (!["colour", "typeface", "logo", "voice", "image"].includes(kind))
        throw new FumeError("unavailable", "Deciding on this comes soon.");
      await command("decide_identity", {
        p_workspace_id: await live.workspaceId(),
        p_kind: kind,
        p_id: id,
        p_verdict: verdict,
        p_value: value ?? null,
      });
      if (kind === "image") learnTaste(await live.workspaceId(), true);
      return board();
    },
    async setColourUses({ colourId, uses }) {
      return command("set_colour_uses", {
        p_workspace_id: await live.workspaceId(),
        p_colour_id: colourId,
        p_uses: uses,
      });
    },
    async moveImage({ imageId, group, campaign }) {
      return command("move_image", {
        p_workspace_id: await live.workspaceId(),
        p_image_id: imageId,
        p_group: group,
        p_campaign: campaign ?? null,
      });
    },
    async decideVoicePart({ part, verdict, note }) {
      return command("decide_voice_part", {
        p_workspace_id: await live.workspaceId(),
        p_part: part,
        p_verdict: verdict,
        p_note: note ?? null,
      });
    },
    async approveBrandDna() {
      const ws = await live.workspaceId();
      await command("approve_brand_dna", { p_workspace_id: ws });
      learnTaste(ws, true);
      live.forget();
      return (await readBrand(ws)).dna;
    },
    // Fume reads the website now (the edge function brand-scan); reading uploaded files comes with the Engine.
    async startBrandScan({ source, url }) {
      if (source === "upload" || !url)
        throw new FumeError(
          "unavailable",
          "Reading files comes soon. Give Fume the website, or upload the files to Brand and Fume's people add them.",
        );
      const ws = await live.workspaceId();
      const workspace = (await live.workspaces()).find((w) => w.id === ws);
      const row = await scanCall({ workspaceId: ws, url, brand: workspace?.brandName });
      return toScan(row, openOf((await readBrand(ws)).identity));
    },
    // Where the brand's people got to in the onboarding, kept on the workspace (moves forward only).
    async onboardingProgress() {
      const list = await rows<OnboardingProgress & { part: string | null }>(
        supabase()
          .from("onboarding_progress")
          .select("step, part, lines")
          .eq("workspace_id", await live.workspaceId()),
      );
      const r = list[0];
      return r ? { step: r.step, ...(r.part ? { part: r.part } : {}), lines: r.lines ?? [] } : { step: "", lines: [] };
    },
    async saveOnboardingProgress({ step, part, line }) {
      return command<OnboardingProgress>("save_onboarding_progress", {
        p_workspace_id: await live.workspaceId(),
        p_step: step ?? null,
        p_part: part ?? null,
        p_line: line ?? null,
      });
    },
    async brandScan() {
      const ws = await live.workspaceId();
      const [list, brand] = await Promise.all([
        rows<ScanRow>(
          supabase()
            .from("brand_scans")
            .select("id, workspace_id, source, url, files, state, sources, finds, error")
            .eq("workspace_id", ws)
            .order("created_at", { ascending: false })
            .limit(1),
        ),
        readBrand(ws),
      ]);
      return list[0] ? toScan(list[0], openOf(brand.identity)) : null;
    },
  };
  return calls;
}
