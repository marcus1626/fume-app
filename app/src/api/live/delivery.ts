// Deliveries on the live backend. A delivery holds exact approved versions and their files (delivery_items, with each
// file's checksum); downloading answers short-lived signed links to exactly those files, and only the customer's
// download marks it downloaded (mark_downloaded). Usage and the agency's licence stay on the fallback.
import {
  FumeError,
  type Creative,
  type Delivery,
  type FumeApi,
  type Format,
  type Id,
  type Workspace,
} from "../../contract";
import type { Live } from "./context";
import { BUCKET, FILE, readCampaigns, readCreatives, type FileRow } from "./map";
import { command, one, requestKey, rows, supabase } from "./supabase";

type Calls = "deliveries" | "delivery" | "makeDelivery" | "downloadUrl" | "confirmLive";

/** A signed link lives this long: enough to start the download, not to pass around. */
const LINK_SECONDS = 5 * 60;

interface DeliveryRow {
  id: string;
  workspace_id: string;
  campaign_id: string;
  name: string;
  state: Delivery["state"];
  rights_note: string;
  created_at: string;
}
const DELIVERY = "id, workspace_id, campaign_id, name, state, rights_note, created_at";

interface ItemRow {
  delivery_id: string;
  creative_id: string;
  version_id: string;
  file_id: string;
  sha256: string | null;
  filename: string;
}
const ITEM = "delivery_id, creative_id, version_id, file_id, sha256, filename";

const toFormat = (f: string): Format => (f === "square" || f === "story" ? f : "feed");

/** A format's folder in the zip, as the mock names it ("Feed-4x5"). */
const FOLDER: Record<Format, string> = { feed: "Feed-4x5", square: "Square-1x1", story: "Story-9x16" };

interface Parts {
  items: ItemRow[];
  formats: Map<Id, Format>;
  files: Map<Id, FileRow>;
}

/** A delivery's items, its creatives' formats and its files (the caller's row-level security applies). */
async function readParts(deliveryIds: Id[]): Promise<Parts> {
  const items = deliveryIds.length
    ? await rows<ItemRow>(supabase().from("delivery_items").select(ITEM).in("delivery_id", deliveryIds))
    : [];
  const creativeIds = [...new Set(items.map((i) => i.creative_id))];
  const fileIds = [...new Set(items.map((i) => i.file_id))];
  const [creatives, files] = await Promise.all([
    creativeIds.length
      ? rows<{ id: string; format: string }>(supabase().from("creatives").select("id, format").in("id", creativeIds))
      : Promise.resolve([]),
    fileIds.length ? rows<FileRow>(supabase().from("files").select(FILE).in("id", fileIds)) : Promise.resolve([]),
  ]);
  return {
    items,
    formats: new Map(creatives.map((c) => [c.id, toFormat(c.format)])),
    files: new Map(files.map((f) => [f.id, f])),
  };
}

function toDelivery(d: DeliveryRow, parts: Parts): Delivery {
  const mine = parts.items.filter((i) => i.delivery_id === d.id);
  return {
    id: d.id,
    campaignId: d.campaign_id,
    name: d.name,
    creativeIds: [...new Set(mine.map((i) => i.creative_id))],
    state: d.state,
    rightsNote: d.rights_note,
    bytes: mine.reduce((n, i) => n + (parts.files.get(i.file_id)?.bytes ?? 0), 0),
    createdAt: d.created_at,
    formats: [...new Set(mine.flatMap((i) => parts.formats.get(i.creative_id) ?? []))],
    scope: "campaign",
  };
}

async function readDeliveries(filter: { workspaceId?: Id; ids?: Id[] }): Promise<Delivery[]> {
  let q = supabase().from("deliveries").select(DELIVERY);
  if (filter.workspaceId) q = q.eq("workspace_id", filter.workspaceId);
  if (filter.ids) q = q.in("id", filter.ids);
  const list = await rows<DeliveryRow>(q.order("created_at", { ascending: false }));
  const parts = await readParts(list.map((d) => d.id));
  return list.map((d) => toDelivery(d, parts));
}

async function readDelivery(id: Id): Promise<Delivery> {
  const [d] = await readDeliveries({ ids: [id] });
  if (!d) throw new FumeError("not_found", "No such delivery.");
  return d;
}

/** A short-lived link to one file that saves it under its delivered name. */
async function signedLink(file: FileRow, filename?: string): Promise<string> {
  const { data, error } = await supabase()
    .storage.from(BUCKET)
    .createSignedUrl(file.path, LINK_SECONDS, filename ? { download: filename } : undefined);
  if (error || !data?.signedUrl) throw new FumeError("forbidden", "This file cannot be fetched.");
  return data.signedUrl;
}

/**
 * The rights a delivery states. The contract's makeDelivery has no field for them yet, so they come from the
 * campaign's brief when it names them ("rights" or "usage"), else the workspace's own channels in its market.
 */
function rightsNote(draft: Record<string, unknown> | null, workspace: Workspace | undefined): string {
  for (const key of ["rights", "usage", "usage_rights"]) {
    const v = draft?.[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  const brand = workspace?.brandName ?? "the brand";
  return `For ${brand}'s own channels${workspace?.market ? ` in ${workspace.market}` : ""}, as agreed with Fume.`;
}

// ─── One zip, stored (the pictures are compressed already), checked byte for byte ──────────────────────────────────

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(data: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

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
    local.setUint16(6, 0x0800, true);
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
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, size, true);
  end.setUint32(16, offset, true);
  end.setUint32(0, 0x06054b50, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)] as BlobPart[], { type: "application/zip" });
}

async function sha256(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function deliveryCalls(live: Live): Pick<FumeApi, Calls> {
  return {
    // A customer sees the deliveries of the brand she has open; Fume's people every delivery they may read.
    async deliveries() {
      const role = await live.role();
      return readDeliveries(role ? { workspaceId: await live.workspaceId() } : {});
    },

    // The delivery's creatives at exactly the delivered version, each picture a link that saves it under its
    // delivered name.
    async delivery(deliveryId) {
      const delivery = await readDelivery(deliveryId);
      const parts = await readParts([deliveryId]);
      const [creatives, [campaign]] = await Promise.all([
        readCreatives({ creativeIds: delivery.creativeIds }),
        readCampaigns({ ids: [delivery.campaignId] }),
      ]);
      if (!campaign) throw new FumeError("not_found", "No such campaign.");
      const pinned = await Promise.all(
        parts.items.map(async (item): Promise<Creative[]> => {
          const creative = creatives.find((c) => c.id === item.creative_id);
          const version = creative?.versions.find((v) => v.id === item.version_id);
          const file = parts.files.get(item.file_id);
          if (!creative || !version) return [];
          const image = file ? await signedLink(file, item.filename).catch(() => version.image) : version.image;
          return [{ ...creative, current: { ...version, image } }];
        }),
      );
      return { delivery, creatives: pinned.flat(), campaign };
    },

    async makeDelivery({ campaignId }) {
      const c = await one<{
        id: string;
        name: string;
        workspace_id: string;
        brief_draft: Record<string, unknown> | null;
      }>(
        supabase().from("campaigns").select("id, name, workspace_id, brief_draft").eq("id", campaignId).maybeSingle(),
        "campaign",
      );
      const workspace = (await live.workspaces()).find((w) => w.id === c.workspace_id);
      const made = await command<{ id: Id }>("make_delivery", {
        p_campaign_id: c.id,
        p_rights_note: rightsNote(c.brief_draft, workspace),
        p_version_ids: null,
        p_name: c.name,
        p_key: requestKey(),
      });
      return readDelivery(made.id);
    },

    // One file: a signed link that saves it under its delivered name. Several: one zip made here from signed links,
    // each file checked against the checksum of the approved version before it goes in. Only then is the delivery
    // marked downloaded (the database refuses a viewer, and Fume's own fetch does not count).
    async downloadUrl(deliveryId, format) {
      const parts = await readParts([deliveryId]);
      const items = parts.items.filter((i) => !format || parts.formats.get(i.creative_id) === format);
      if (items.length === 0) throw new FumeError("not_found", "Nothing in this delivery to download.");
      const fileOf = (i: ItemRow) => {
        const f = parts.files.get(i.file_id);
        if (!f) throw new FumeError("forbidden", "A file in this delivery cannot be fetched.");
        return f;
      };
      let url: string;
      if (items.length === 1) {
        url = await signedLink(fileOf(items[0]!), items[0]!.filename);
      } else {
        const files = await Promise.all(
          items.map(async (i) => {
            const res = await fetch(await signedLink(fileOf(i)));
            if (!res.ok) throw new FumeError("unavailable", "A file did not arrive. Try again in a moment.");
            const data = new Uint8Array(await res.arrayBuffer());
            if (i.sha256 && (await sha256(data)) !== i.sha256)
              throw new FumeError("conflict", `${i.filename} is not the approved file. Fume has been told.`);
            const folder = FOLDER[parts.formats.get(i.creative_id) ?? "feed"];
            return { path: `${folder}/${i.filename}`, data };
          }),
        );
        url = URL.createObjectURL(zip(files));
      }
      try {
        await command("mark_downloaded", { p_delivery_id: deliveryId });
      } catch (e) {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
        throw e;
      }
      return url;
    },

    async confirmLive(deliveryId) {
      await command("confirm_live", { p_delivery_id: deliveryId });
      return readDelivery(deliveryId);
    },
  };
}
