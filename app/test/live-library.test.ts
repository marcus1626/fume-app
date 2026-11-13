// FLOWS §37 on the live reader: real row mapping and scoping, with Supabase and storage replaced at their boundary.
import { beforeEach, expect, test, vi } from "vitest";
import { libraryCalls } from "../src/api/live/library";
import { deskOf } from "../src/api/live/production";
import type { Live } from "../src/api/live/context";
import type { User, VersionState } from "../src/contract";

const db = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  reads: [] as string[],
  customer: false,
  kinds: [] as { version_id: string; kind: "design" | "picture" }[],
  rpcs: [] as { name: string; params: { p_version_ids: string[] } }[],
  pages: [] as { table: string; from: number; orders: string[] }[],
  rpcError: null as { message: string; details: string } | null,
  error: null as { message: string; details: string } | null,
}));
vi.mock("../src/api/live/supabase", async (original) => ({
  ...(await original<typeof import("../src/api/live/supabase")>()),
  supabase: () => ({
    rpc: (name: string, params: { p_version_ids: string[] }) => {
      db.rpcs.push({ name, params });
      const q = {
        order: () => q,
        range: () => q,
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({
            data: db.kinds.filter((v) => params.p_version_ids.includes(v.version_id)),
            error: db.rpcError,
          }).then(resolve),
      };
      return q;
    },
    from: (table: string) => {
      db.reads.push(table);
      let data = [...(db.tables[table] ?? [])];
      const orders: { key: string; ascending: boolean }[] = [];
      let from = 0;
      let to = 999;
      let versionAscending: boolean | undefined;
      let versionLimit: number | undefined;
      const q = {
        select: () => q,
        in: (key: string, ids: unknown[]) => {
          data = data.filter((r) => ids.includes(r[key]));
          return q;
        },
        eq: (key: string, value: unknown) => {
          data = data.filter((r) => r[key] === value);
          return q;
        },
        neq: (key: string, value: unknown) => {
          data = data.filter((r) => r[key] !== value);
          return q;
        },
        is: () => q,
        overrideTypes: () => q,
        order: (key: string, options?: { referencedTable?: string; ascending?: boolean }) => {
          if (options?.referencedTable === "creative_versions") versionAscending = options.ascending !== false;
          if (!options?.referencedTable) orders.push({ key, ascending: options?.ascending !== false });
          return q;
        },
        limit: (count: number, options?: { referencedTable?: string }) => {
          if (options?.referencedTable === "creative_versions") versionLimit = count;
          return q;
        },
        range: (start: number, end: number) => {
          from = start;
          to = end;
          return q;
        },
        then: (resolve: (value: unknown) => unknown) => {
          db.pages.push({ table, from, orders: orders.map((o) => o.key) });
          data.sort((a, b) => {
            for (const { key, ascending } of orders) {
              if (a[key] === b[key]) continue;
              return (a[key]! < b[key]! ? -1 : 1) * (ascending ? 1 : -1);
            }
            return 0;
          });
          const page = data.slice(from, Math.min(to + 1, from + 1000)).map((row) => {
            if (table !== "creatives") return row;
            const versions = (row.creative_versions as ReturnType<typeof version>[]).filter(
              (v) =>
                !db.customer ||
                (v.sent_at !== null && ["checked", "changes_requested", "approved", "delivered"].includes(v.state)),
            );
            if (versionAscending !== undefined)
              versions.sort((a, b) => (a.number - b.number) * (versionAscending ? 1 : -1));
            return {
              ...row,
              creative_versions: versions.slice(0, Math.min(versionLimit ?? 1000, 1000)),
            };
          });
          return Promise.resolve({ data: page, error: db.error }).then(resolve);
        },
      };
      return q;
    },
  }),
}));
vi.mock("../src/api/live/signed", () => ({
  signedLinks: async (_bucket: string, paths: string[]) => new Map(paths.map((p) => [p, `signed:${p}`])),
}));

const at = (day: number) => `2026-11-${String(day).padStart(2, "0")}T12:00:00Z`;
const file = (id: string) => ({
  id,
  path: `w1/${id}.png`,
  name: `${id}.png`,
  content_type: "image/png",
  bytes: 10,
  sha256: null,
  width: 1080,
  height: 1350,
});
function version(state: VersionState, number = 2) {
  return {
    id: `v${number}`,
    workspace_id: "w1",
    creative_id: "cr1",
    number,
    state,
    file_id: "f1",
    candidate_id: "p1",
    job_id: "j1",
    master_version_id: null,
    held_reason: null,
    sent_at: at(11) as string | null,
    sent_by: "operator",
    created_at: at(10),
    files: file("f1"),
    expert_checks: {
      id: "check1",
      version_id: `v${number}`,
      state: "checked",
      items: [],
      expert_id: "anna",
      decided_at: at(11),
      note: null,
      created_at: at(10),
    },
    approvals:
      state === "approved" || state === "delivered"
        ? [{ id: "a1", version_id: `v${number}`, decided_by: "maja", created_at: at(12), revoked_at: null }]
        : [],
  };
}
function creative(id: string, campaign = "c1", versions = [] as ReturnType<typeof version>[]) {
  return {
    id,
    workspace_id: campaign === "c1" ? "w1" : "w2",
    campaign_id: campaign,
    master_id: null,
    kind: "master",
    format: "feed",
    channel: "paid_social",
    name: `${id}_delivery`,
    title: "Dawn run",
    slot: "pc1",
    created_at: at(1),
    creative_versions: versions,
  };
}
function live(user: Partial<User> = {}): Live {
  return {
    me: async () => ({
      id: "anna",
      name: "Anna",
      title: "Designer",
      email: "anna@example.test",
      staffRole: "expert",
      ...user,
    }),
    workspaces: async () => [
      { id: "w1", organisationId: "org1", brandName: "Nike", market: "UK", language: "en", agencyId: "agency1" },
      { id: "w2", organisationId: "org2", brandName: "Other", market: "UK", language: "en" },
    ],
    workspaceId: async () => "w1",
    role: async () => "owner",
    uid: async () => "anna",
    setWorkspace: () => {},
    people: async () => new Map(),
    forget: () => {},
  };
}
beforeEach(() => {
  db.reads = [];
  db.kinds = [];
  db.rpcs = [];
  db.pages = [];
  db.customer = false;
  db.error = null;
  db.rpcError = null;
  db.tables = {
    campaigns: [
      { id: "c1", workspace_id: "w1", name: "Nike UK" },
      { id: "c2", workspace_id: "w2", name: "Other campaign" },
    ],
    creatives: [
      creative("cr1", "c1", [version("checked"), version("approved", 1)]),
      creative("draft"),
      creative("empty"),
    ],
    production_jobs: [
      { id: "j1", creative_id: "cr1", requested_by: "maker" },
      { id: "j2", creative_id: "draft", requested_by: "maker" },
    ],
    candidates: [
      { id: "p1", job_id: "j1", file_id: "f1", made_by: "maker", created_at: at(10) },
      { id: "p2", job_id: "j2", file_id: "f2", made_by: "maker", created_at: at(9) },
      { id: "p3", job_id: "j2", file_id: "f3", made_by: "maker", created_at: at(13) },
    ],
    files: [file("f2"), file("f3")],
    campaign_products: [{ campaign_id: "c1", product_id: "shoe" }],
    products: [{ id: "shoe", name: "Air Max" }],
    plan_versions: [
      { campaign_id: "c1", version: 2, state: "approved", planned: [{ id: "pc1", name: "The first mile" }] },
    ],
    design_layers: [{ creative_id: "draft", state: "made", result_candidate_id: "p3" }],
  };
});

test("current versions carry signed pictures, names, people and product; drafts are unique and newest first", async () => {
  const items = await libraryCalls(live()).library();
  expect(items.map((i) => i.id)).toEqual(["draft", "cr1"]);
  expect(items[0]).toMatchObject({
    title: "Dawn run",
    state: "studio",
    version: 2,
    image: "signed:w1/f3.png",
    studio: "design",
    documentId: "draft",
    kind: "draft",
  });
  expect(items[1]).toMatchObject({
    title: "Dawn run",
    name: "cr1_delivery",
    state: "checked",
    version: 2,
    image: "signed:w1/f1.png",
    checkedBy: "anna",
    checkedAt: at(11),
    madeBy: "maker",
    productName: "Air Max",
    campaignName: "Nike UK",
  });
  expect(items[1].approvedBy).toBeUndefined();
});

test("a draft uses its picked picture; a generic master gets its planned name", async () => {
  db.tables.creatives![1]!.title = "Master 1";
  const context = live();
  deskOf(context, "draft").picked = "p2";
  const item = (await libraryCalls(context).library()).find((i) => i.id === "draft");
  expect(item).toMatchObject({
    title: "The first mile",
    state: "studio",
    image: "signed:w1/f2.png",
    version: 1,
    studio: "render",
  });
});

test.each([
  ["making", "making"],
  ["in_check", "to_check"],
  ["correcting", "to_check"],
  ["held", "to_check"],
  ["checked", "checked"],
  ["changes_requested", "changes"],
  ["approved", "approved"],
  ["delivered", "delivered"],
] as const)("%s maps to %s, with the version id as the way into Check", async (state, expected) => {
  db.tables.creatives![0]!.creative_versions = [version(state)];
  const item = (await libraryCalls(live()).library()).find((i) => i.id === "cr1")!;
  expect(item.state).toBe(expected);
  expect(item.checkItemId).toBe(expected === "to_check" ? "v2" : undefined);
  if (state === "approved" || state === "delivered") expect(item.approvedBy).toBe("maja");
});

test("the admin can read pictures and drafts, with no ways into Studio or Check", async () => {
  db.tables.creatives![0]!.creative_versions = [version("in_check")];
  const items = await libraryCalls(live({ staffRole: "admin" })).library();
  expect(items).toHaveLength(2);
  for (const item of items) {
    expect(item.image).toBeTruthy();
    expect(item.documentId).toBeUndefined();
    expect(item.checkItemId).toBeUndefined();
  }
});

test("brand scope and agency clients are enforced before reading creatives", async () => {
  db.tables.creatives!.push(creative("other", "c2", [{ ...version("approved"), creative_id: "other" }]));
  expect((await libraryCalls(live()).library("w2")).map((i) => i.id)).toEqual(["other"]);
  const agency = libraryCalls(live({ agency: { organisationId: "agency1", role: "lead" } }));
  expect((await agency.library()).every((i) => i.workspaceId === "w1")).toBe(true);
  expect(await agency.library("w2")).toEqual([]);
  expect(await libraryCalls(live()).library("missing")).toEqual([]);
});

test("customers get approved and delivered work only in their open brand, with no production reads", async () => {
  db.customer = true;
  const calls = libraryCalls(live({ staffRole: undefined }));
  expect(await calls.library("w2")).toEqual([]);
  db.tables.creatives![0]!.creative_versions = [version("delivered")];
  const items = await calls.library("w2");
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ workspaceId: "w1", state: "delivered", approvedBy: "maja" });
  expect(items[0]!.documentId).toBeUndefined();
  expect(db.reads).not.toContain("candidates");
  expect(db.reads).not.toContain("production_jobs");
  expect(db.reads).not.toContain("design_layers");
});

test("empty data stays empty, and database failures are not hidden behind mock results", async () => {
  db.tables.campaigns = [];
  expect(await libraryCalls(live()).library()).toEqual([]);
  db.error = { message: "Unavailable", details: "unavailable" };
  await expect(libraryCalls(live()).library()).rejects.toMatchObject({ code: "unavailable" });
});

test("a customer without a role cannot read the Library", async () => {
  const context = live({ staffRole: undefined });
  context.role = async () => null;
  await expect(libraryCalls(context).library()).rejects.toMatchObject({ code: "forbidden" });
});

test("generic titles from both the creative and the plan fall back to the creative's own name", async () => {
  db.tables.creatives![0]!.title = "Master 1";
  db.tables.plan_versions![0]!.planned = [{ id: "pc1", name: "Master 1" }];
  expect((await libraryCalls(live()).library()).find((i) => i.id === "cr1")?.title).toBe("cr1_delivery");
});

test("customers never get an unsent approved version, and keep the latest sent version", async () => {
  db.customer = true;
  const sent = version("delivered", 1);
  const unsent = { ...version("approved", 2), sent_at: null };
  db.tables.creatives = [
    creative("cr1", "c1", [unsent, sent]),
    creative("unsent", "c1", [{ ...unsent, creative_id: "unsent" }]),
  ];
  db.kinds = [
    { version_id: "v1", kind: "picture" },
    { version_id: "v2", kind: "design" },
  ];
  const items = await libraryCalls(live({ staffRole: undefined })).library();
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ id: "cr1", state: "delivered", version: 1, studio: "render" });
  expect(db.rpcs).toEqual([{ name: "library_version_kinds", params: { p_version_ids: ["v1"] } }]);
});

test("reads every page with stable ordering, including pictures, jobs, plans and draft images", async () => {
  const count = 1001;
  // Reverse insertion order and tied timestamps ensure pagination needs a unique ordering key.
  const ids = Array.from({ length: count }, (_, i) => String(i).padStart(4, "0")).reverse();
  db.tables.campaigns = ids.map((id) => ({ id: `c${id}`, workspace_id: "w1", name: `Campaign ${id}` }));
  db.tables.creatives = ids.map((id) => ({ ...creative(`cr${id}`, `c${id}`), title: "Master 1" }));
  db.tables.campaign_products = ids.map((id) => ({ campaign_id: `c${id}`, product_id: `product${id}` }));
  db.tables.products = ids.map((id) => ({ id: `product${id}`, name: `Product ${id}` }));
  db.tables.plan_versions = ids.map((id) => ({
    campaign_id: `c${id}`,
    version: 1,
    state: "approved",
    planned: [{ id: "pc1", name: `Title ${id}` }],
  }));
  db.tables.production_jobs = ids.map((id) => ({ id: `j${id}`, creative_id: `cr${id}`, requested_by: "maker" }));
  db.tables.candidates = ids.map((id) => ({
    id: `p${id}`,
    job_id: `j${id}`,
    file_id: `f${id}`,
    made_by: "maker",
    created_at: at(10),
  }));
  db.tables.files = ids.map((id) => file(`f${id}`));
  db.tables.design_layers = ids.map((id) => ({
    id: `d${id}`,
    creative_id: `cr${id}`,
    state: "made",
    result_candidate_id: `p${id}`,
  }));
  // More than one page belonging to one creative exercises range pagination within each IN batch too.
  for (const id of ids) {
    db.tables.production_jobs.push({ id: `extra${id}`, creative_id: "cr0000", requested_by: "maker" });
    db.tables.candidates.push({
      id: `extra${id}`,
      job_id: "j0000",
      file_id: `f${id}`,
      made_by: "maker",
      created_at: at(9),
    });
    db.tables.plan_versions.push({
      campaign_id: "c0000",
      version: Number(id) + 2,
      state: "approved",
      planned: [{ id: "pc1", name: `Newest ${id}` }],
    });
    db.tables.design_layers.push({ id: `extra${id}`, creative_id: "cr0000", state: "made", result_candidate_id: null });
    db.tables.campaign_products.push({ campaign_id: "c0000", product_id: `zextra${id}` });
  }
  const items = await libraryCalls(live()).library("w1");
  expect(items).toHaveLength(count);
  expect(new Set(items.map((i) => i.id)).size).toBe(count);
  for (const id of ids) {
    expect(items.find((i) => i.id === `cr${id}`)).toMatchObject({
      title: id === "0000" ? "Newest 1000" : `Title ${id}`,
      image: `signed:w1/f${id}.png`,
      productName: `Product ${id}`,
      studio: "design",
    });
  }
  for (const table of [
    "campaigns",
    "production_jobs",
    "candidates",
    "plan_versions",
    "design_layers",
    "campaign_products",
  ]) {
    expect(
      db.pages.some((p) => p.table === table && p.from === 1000),
      table,
    ).toBe(true);
  }
  expect(db.pages.every((p) => p.orders.length > 0)).toBe(true);
});

test("more than 1000 creatives in one campaign keep their latest version and signed image", async () => {
  db.tables.creatives = Array.from({ length: 1001 }, (_, i) =>
    creative(`cr${i}`, "c1", [
      { ...version("checked", 1), creative_id: `cr${i}` },
      { ...version("approved", 1001), creative_id: `cr${i}` },
    ]),
  ).reverse();
  const items = await libraryCalls(live()).library("w1");
  expect(items).toHaveLength(1001);
  expect(items.every((i) => i.version === 1001 && i.image === "signed:w1/f1.png")).toBe(true);
  expect(db.pages.some((p) => p.table === "creatives" && p.from === 1000)).toBe(true);
});

test("a creative with more than 1000 versions reads only its newest visible version", async () => {
  db.tables.creatives = [
    creative(
      "cr1",
      "c1",
      Array.from({ length: 1001 }, (_, i) => version("approved", i + 1)),
    ),
  ];
  const items = await libraryCalls(live()).library("w1");
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ id: "cr1", version: 1001, state: "approved" });
});

test("customers classify sent versions through the narrow RPC without reading design layers", async () => {
  db.customer = true;
  db.tables.creatives = [
    creative("cr1", "c1", [version("delivered")]),
    creative("picture", "c1", [{ ...version("approved", 3), creative_id: "picture" }]),
  ];
  db.kinds = [
    { version_id: "v2", kind: "design" },
    { version_id: "v3", kind: "picture" },
  ];
  const items = await libraryCalls(live({ staffRole: undefined })).library();
  expect(items.find((i) => i.id === "cr1")?.studio).toBe("design");
  expect(items.find((i) => i.id === "picture")?.studio).toBe("render");
  expect(db.rpcs).toEqual([{ name: "library_version_kinds", params: { p_version_ids: ["v2", "v3"] } }]);
  expect(db.reads).not.toContain("design_layers");
  expect(db.reads).not.toContain("candidates");
});

test("customer kind lookup failures propagate", async () => {
  db.customer = true;
  db.tables.creatives![0]!.creative_versions = [version("delivered")];
  db.rpcError = { message: "Kind lookup failed", details: "unavailable" };
  await expect(libraryCalls(live({ staffRole: undefined })).library()).rejects.toMatchObject({ code: "unavailable" });
});
