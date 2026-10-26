// Deliveries: what Fume hands over once creatives are approved, and "Download all" as one zip.
import { FumeError, type Creative, type Delivery, type FumeApi } from "../contract";
import type { Mock } from "./context";

type Calls = "deliveries" | "delivery" | "downloadUrl" | "confirmLive" | "makeDelivery";

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

export function deliveryCalls(m: Mock): Pick<FumeApi, Calls> {
  const { db, wait } = m;
  return {
    async deliveries() {
      const ids = new Set(m.myCampaigns().map((c) => c.id));
      return wait(
        db.deliveries.filter((d) => ids.has(d.campaignId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
    },
    async delivery(id) {
      const delivery = m.find(db.deliveries, id, "delivery");
      return wait({
        delivery,
        campaign: m.campaignOf(delivery.campaignId),
        creatives: db.creatives.filter((c) => delivery.creativeIds.includes(c.id)),
      });
    },
    // The real backend answers with a signed link to one zip; the mock packs the delivery's pictures into a real zip in
    // the browser (stored, not compressed: they are JPEGs already), a folder per collection › product › format, and
    // answers with its blob: link.
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
    async confirmLive(id) {
      const d = m.find(db.deliveries, id, "delivery");
      d.state = "confirmed_live";
      return wait(d);
    },
    // Only what is in no delivery yet, so a second delivery never packs the same creatives again.
    async makeDelivery({ campaignId, collectionId }) {
      m.mustApprove();
      const c = m.find(db.campaigns, campaignId, "campaign");
      const collection = collectionId ? m.find(db.collections, collectionId, "collection") : undefined;
      const packed = new Set(db.deliveries.filter((x) => x.campaignId === campaignId).flatMap((x) => x.creativeIds));
      const creatives = db.creatives.filter(
        (cr) => cr.campaignId === campaignId && cr.current.state === "approved" && !packed.has(cr.id),
      );
      if (!creatives.length)
        throw new FumeError("conflict", "Every approved creative in this campaign is in a delivery already.");
      const d: Delivery = {
        id: m.nextId("dl"),
        campaignId,
        name: collection ? `${c.name} · ${collection.name}` : c.name,
        creativeIds: creatives.map((cr) => cr.id),
        state: "preparing",
        rightsNote:
          "For LYSNE's paid and organic channels in the Nordics, no end date. Images with AI people are labelled.",
        bytes: creatives.length * 4_800_000,
        createdAt: m.now(),
        formats: [...new Set(creatives.map((cr) => cr.format))],
        scope: collection ? "collection" : "campaign",
        collectionId,
      };
      db.deliveries.unshift(d);
      setTimeout(() => (d.state = "ready"), 1500);
      return wait(d);
    },
  };
}
