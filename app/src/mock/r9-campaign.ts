// The mock backend's round 9 calls for CAMPAIGN (PROPOSED 19 Oct 2026).
// 1. Every campaign carries its `waits` (contract CampaignWaits): the questions Fume still has for the brief, the
//    directions ready to choose from, whether the brief waits on its approval, and the date Fume works to for the step
//    under way. copy.campaignStatus reads them, so Home, the list, the header, ⌘K, the collection and the chat say ONE
//    sentence with the same numbers (UX review DLOAD-3). They are live: a getter on each campaign row, read when a
//    call returns it, so an answered question or a chosen direction shows everywhere at once.
// 2. "Download all" is ONE zip (DTSK-17, DLOAD-15): the real backend answers with a signed link to it; the mock packs
//    the delivery's pictures into a real .zip in the browser (stored, not compressed: they are JPEGs already), with a
//    folder per collection › product › format, and answers with its blob: link. The screen names it
//    LYSNE_Autumn-launch_Masters.zip (features/deliveries/download.ts).

import type {
  Brief,
  Campaign,
  CampaignPlan,
  CampaignWaits,
  Collection,
  Creative,
  Delivery,
  Direction,
  FumeApi,
  Id,
  Product,
  ServiceClock,
} from "../contract";
import { FumeError } from "../contract";
import { unsentByFume } from "./r13-studio";

interface Db {
  campaigns: Campaign[];
  briefs: Brief[];
  directions: Direction[];
  clocks: ServiceClock[];
  deliveries: Delivery[];
  creatives: Creative[];
  products: Product[];
  collections: Collection[];
  /** Round 10: the plans (r10-plan.ts). */
  plans?: CampaignPlan[];
  /** Round 12: who runs a workspace (an agency, r11-agency.ts). */
  workspaces?: { id: Id; agencyId?: Id }[];
}

/** Round 12 NUMBERS (DLOAD-1, DLOAD-5): checked creatives not sent to the customer yet. In Fume, a campaign in production
 *  holds its checked set until it is released. An agency sends its checked creatives to the client itself: r11-client.ts
 *  fills that one. */
function toSendOf(db: Db, campaign: Campaign | undefined): Pick<CampaignWaits, "toSend"> {
  if (!campaign || db.workspaces?.find((w) => w.id === campaign.workspaceId)?.agencyId) return {};
  const checked = db.creatives.filter((cr) => cr.campaignId === campaign.id && cr.current.state === "checked").length;
  // Round 13 (robots' note 06): after the first send, the creatives checked since wait for the next (r13-studio.ts).
  const held = db.creatives.filter((cr) => cr.campaignId === campaign.id && unsentByFume(cr)).length;
  return checked ? { toSend: campaign.state === "in_production" ? checked : held } : {};
}

export interface R9CampaignContext {
  db: Db;
  wait: <T>(value: T) => Promise<T>;
}

/** Three working days on (the promise for the first directions once a brief is approved; fumeBrief.ts says it in the
 *  chat with the same rule). */
function workingDays(from: string, days: number): string {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) left--;
  }
  return d.toISOString();
}

/** Round 10 FLOW: the approved plan's masters, while the Engine makes them (stage masters, nothing checked yet). */
function mastersOf(db: Db, campaign: Campaign | undefined): Pick<CampaignWaits, "masters"> {
  if (!campaign || campaign.stage !== "masters" || campaign.state !== "in_production") return {};
  const plan = db.plans?.find((p) => p.campaignId === campaign.id && p.state === "approved");
  // Round 13 (robot note 03): a master whose product still waits to be confirmed is not under way, so it is not counted
  // (the toast and the status say the same: "The Engine has started on Master 2" / "making 1 master").
  const waiting = new Set(
    db.products.filter((p) => campaign.productIds.includes(p.id) && p.state === "needs_you").map((p) => p.id),
  );
  const all =
    plan?.directions.find((d) => d.id === plan.chosenDirectionId)?.creatives.filter((c) => c.kind === "master") ?? [];
  const going = all.filter((m) => !m.productIds.some((id) => waiting.has(id))).length;
  const n = going || all.length;
  return n ? { masters: n } : {};
}

/** Round 12 NUMBERS: the plan's "Delivery" step and its creatives (the chosen direction's), for the labelled dates
 *  ("Delivery Tue 27 Oct", never a bare "Due") and "Planned: 9 creatives" before any is made. */
function planNumbers(db: Db, id: Id): Pick<CampaignWaits, "delivery" | "planned"> {
  const campaign = db.campaigns.find((c) => c.id === id);
  // A delivered campaign's date is its delivery's; one closed before deliveries were recorded keeps its last change.
  const sent = db.deliveries
    .filter((d) => d.campaignId === id && d.state === "confirmed_live")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (campaign && ["delivered", "closed"].includes(campaign.state))
    return { delivery: sent?.createdAt ?? campaign.updatedAt };
  // A campaign made before plans existed (it chose a direction) has a plan written afterwards from its brief, on
  // demand: its dates are not the record, so they are left out (the go-live stays).
  const plan = campaign?.chosenDirectionId ? undefined : db.plans?.find((p) => p.campaignId === id);
  if (!plan) return {};
  const delivery = plan.timeline.find((t) => t.label === "Delivery")?.at;
  const planned = plan.directions.find((d) => d.id === plan.chosenDirectionId)?.creatives.length;
  return { ...(delivery ? { delivery } : {}), ...(planned ? { planned } : {}) };
}

/** What waits in one campaign, read from the rows that say it. */
function waitsOf(db: Db, id: Id): CampaignWaits {
  const brief = db.briefs.find((b) => b.campaignId === id);
  const clock = db.clocks.find((k) => k.campaignId === id);
  const open = brief && brief.state !== "approved";
  // A campaign that has just started (its brief approved, no directions yet, no service clock): the directions are
  // due three working days after the approval, as the chat said when it was approved.
  const campaign = db.campaigns.find((c) => c.id === id);
  const fresh =
    !clock &&
    brief?.state === "approved" &&
    brief.approvedAt &&
    (campaign?.stage === "directions" || campaign?.stage === "plan") &&
    !db.directions.some((d) => d.campaignId === id);
  return {
    questions: open ? brief.missing.length : 0,
    directions: db.directions.filter((d) => d.campaignId === id && d.state === "proposed").length,
    briefReady: Boolean(open && brief.state === "ready" && brief.missing.length === 0),
    // Round 10: where the plan stands, while it is the step under way (the status sentence says it).
    ...(campaign?.stage === "plan" && db.plans?.some((p) => p.campaignId === id)
      ? {
          plan: db.plans.find((p) => p.campaignId === id)!.state,
          planChecked: Boolean(db.plans.find((p) => p.campaignId === id)!.checkedBy),
        }
      : {}),
    // Round 10 FLOW: how many masters the Engine makes, from the approved plan, while the masters are being made.
    ...mastersOf(db, campaign),
    // Round 12: checked, not sent yet ("6 creatives to send to Maja").
    ...toSendOf(db, campaign),
    // Round 12 (DLOAD-13, DLOAD-21): the plan's delivery date and how many creatives it holds.
    ...planNumbers(db, id),
    // Only while Fume works to it: a clock paused on the customer, met or late is not a promise.
    ...(clock?.state === "running" ? { by: clock.dueAt } : fresh ? { by: workingDays(brief.approvedAt!, 3) } : {}),
  };
}

/** Gives every campaign row its live `waits`; new rows get it as they are pushed. */
function decorate(db: Db) {
  const give = (c: Campaign) => {
    if (Object.getOwnPropertyDescriptor(c, "waits")?.get) return;
    Object.defineProperty(c, "waits", { get: () => waitsOf(db, c.id), enumerable: true, configurable: true });
  };
  db.campaigns.forEach(give);
  const list = db.campaigns;
  const push = list.push.bind(list);
  list.push = (...rows: Campaign[]) => {
    rows.forEach(give);
    return push(...rows);
  };
}

// ─── A stored zip, by hand (no package): local headers, the files, the central directory ──────────────────────

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (data: Uint8Array) => {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function zip(files: { path: string; data: Uint8Array }[]): Blob {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.path);
    const crc = crc32(f.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(8, 0, true); // stored
    local.setUint32(14, crc, true);
    local.setUint32(18, f.data.length, true);
    local.setUint32(22, f.data.length, true);
    local.setUint16(26, name.length, true);
    parts.push(new Uint8Array(local.buffer), name, f.data);
    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true);
    dir.setUint16(4, 20, true);
    dir.setUint16(6, 20, true);
    dir.setUint16(8, 0x0800, true);
    dir.setUint32(16, crc, true);
    dir.setUint32(20, f.data.length, true);
    dir.setUint32(24, f.data.length, true);
    dir.setUint16(28, name.length, true);
    dir.setUint32(42, offset, true);
    central.push(new Uint8Array(dir.buffer), name);
    offset += 30 + name.length + f.data.length;
  }
  const size = central.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, size, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)] as BlobPart[], { type: "application/zip" });
}

/** A format's folder, as the delivery names it ("Feed 4:5"). */
const formatFolder: Record<Creative["format"], string> = {
  feed: "Feed 4:5",
  square: "Square 1:1",
  story: "Story 9:16",
};

/** "Night Body Oil" → "Night-Body-Oil", "Feed 4:5" → "Feed-4x5": safe on every disk. */
const slug = (s: string) =>
  s
    .trim()
    .replace(/:/g, "x")
    .replace(/[\\/?%*|"<>]/g, "")
    .replace(/\s+/g, "-");

export function r9CampaignApi(ctx: R9CampaignContext): Pick<FumeApi, "downloadUrl"> {
  const { db, wait } = ctx;
  decorate(db);
  return {
    async downloadUrl(id, format) {
      const d = db.deliveries.find((x) => x.id === id);
      if (!d) throw new FumeError("not_found", `No delivery ${id}`);
      const fallback = `/demo/download/${id}${format ? `-${format}` : ""}.zip`;
      if (typeof fetch === "undefined" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function")
        return wait(fallback);
      const campaign = db.campaigns.find((c) => c.id === d.campaignId);
      const creatives = db.creatives.filter((c) => d.creativeIds.includes(c.id) && (!format || c.format === format));
      const productId = campaign?.productIds.length === 1 ? campaign.productIds[0] : undefined;
      const product = db.products.find((p) => p.id === productId);
      const collection =
        db.collections.find((c) => c.id === d.collectionId) ??
        db.collections.find(
          (c) => campaign?.collectionIds?.includes(c.id) && (!productId || c.productIds.includes(productId)),
        );
      try {
        const files = await Promise.all(
          creatives.map(async (c) => {
            const res = await fetch(c.current.image);
            if (!res.ok) throw new Error(c.current.image);
            const ext = c.current.image.split("?")[0]!.split(".").pop() || "jpg";
            const folder = [collection?.name, product?.name, formatFolder[c.format]]
              .filter(Boolean)
              .map((s) => slug(s!));
            return { path: [...folder, `${c.name}.${ext}`].join("/"), data: new Uint8Array(await res.arrayBuffer()) };
          }),
        );
        return wait(URL.createObjectURL(zip(files)));
      } catch {
        return wait(fallback);
      }
    },
  };
}
