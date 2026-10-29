// Brand DNA on the live backend, read only: the approved (or newest) Brand DNA version, its rules, the brand's
// products and its sources. The parts the Engine learns later (references, taste, memory, the understanding check,
// the board's identity and moodboard) still answer from the empty workspace (live/index.ts), so their pages show
// nothing rather than the demo's data. Changing a rule or approving Brand DNA is not live yet.
import type { BrandDna, BrandRule, FumeApi, SourceAsset, SourceAssetKind } from "../../contract";
import type { Live } from "./context";
import { fileUrls } from "./map";
import { readProducts } from "./products";
import { rows, supabase } from "./supabase";

type Calls = "brandDna" | "brandBoard";

interface DnaRow {
  id: string;
  workspace_id: string;
  version: number;
  state: "draft" | "in_review" | "approved" | "superseded";
  approved_by: string | null;
  approved_at: string | null;
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

/** The approved version if there is one, else the newest draft. */
async function currentDna(workspaceId: string): Promise<DnaRow | undefined> {
  const list = await rows<DnaRow>(
    supabase()
      .from("brand_dna_versions")
      .select("id, workspace_id, version, state, approved_by, approved_at")
      .eq("workspace_id", workspaceId)
      .neq("state", "superseded")
      .order("version", { ascending: false }),
  );
  return list.find((d) => d.state === "approved") ?? list[0];
}

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
  return { dna: toDna(workspaceId, d, ruleRows), rules: ruleRows.map((r) => toRule(r, approved)) };
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

export function brandCalls(live: Live, empty: Pick<FumeApi, Calls>): Pick<FumeApi, Calls> {
  return {
    async brandDna() {
      const workspaceId = await live.workspaceId();
      const [brand, products, assets, rest] = await Promise.all([
        readBrand(workspaceId),
        readProducts(workspaceId),
        readAssets(workspaceId),
        empty.brandDna(),
      ]);
      return { ...rest, ...brand, products, assets };
    },
    async brandBoard() {
      const [brand, rest] = await Promise.all([readBrand(await live.workspaceId()), empty.brandBoard()]);
      return { ...rest, ...brand };
    },
  };
}
