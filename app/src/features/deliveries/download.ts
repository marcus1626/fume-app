// Taking a delivery home (walk-through 15 Oct, Must 6): all of it, one format, or one creative. Every download
// shows what is under way and when it is done: a loading toast with the share prepared, then "2 creatives
// downloaded". The real backend answers with a signed link to a zip.
// Round 9 (desktop review 19 Oct, DTSK-17, DLOAD-15; PROPOSED 19 Oct 2026): Download all is ONE zip, never a row of
// loose files: LYSNE_Autumn-launch_Masters.zip, with a folder per collection, product and format inside
// (AW26/Night-Body-Oil/Feed-4x5/). One format is the same zip of that format (…_Masters_Feed-4x5.zip). The demo
// packs a real zip in the browser (mock/r9-campaign.ts) and saves it under that name.
import { useToast } from "@fume/ui";
import { useRef, useState } from "react";
import { useApi } from "../../api/client";
import { useSession } from "../../api/hooks";
import type { Creative, Format, Id } from "../../contract";
import * as copy from "../../copy";
import { bytes as size } from "../../lib/time";

const usingMock = (import.meta.env.VITE_FUME_API ?? "mock") === "mock";

/** What one download takes: everything, one format, or one creative. */
export type DownloadKey = "all" | Format | `creative:${Id}`;

export interface DownloadJob {
  key: DownloadKey;
  /** 0 to 100. */
  progress: number;
}

/** Saves one picture under a name, the way a browser saves a link with a download name. */
function save(href: string, name: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.rel = "noopener";
  document.body.append(a);
  a.click();
  a.remove();
}

const fileName = (c: Creative) => `${c.name}.${c.current.image.split(".").pop()?.split("?")[0] || "jpg"}`;

/** "Autumn launch" → "Autumn-launch", "Feed 4:5" → "Feed-4x5": safe on every disk. */
const slug = (s: string) =>
  s
    .trim()
    .replace(/:/g, "x")
    .replace(/[\\/?%*|"<>]/g, "")
    .replace(/\s+/g, "-");

/** The zip's name: the brand, then the delivery's name, then the format when it is one format.
 *  "LYSNE" + "Autumn launch · Masters" → LYSNE_Autumn-launch_Masters.zip; with Feed → LYSNE_Autumn-launch_Masters_Feed-4x5.zip. */
export function zipName(brand: string, delivery: string, format?: Format): string {
  const parts = [
    brand.toUpperCase(),
    ...delivery.split(" · "),
    ...(format ? [`${copy.format[format].label} ${copy.format[format].ratio}`] : []),
  ];
  return `${parts.map(slug).filter(Boolean).join("_")}.zip`;
}

export function useDeliveryDownload(
  deliveryId: Id | undefined,
  totalBytes: number,
  totalCount: number,
  deliveryName = "Delivery",
) {
  const api = useApi();
  const toast = useToast();
  const brand = useSession().data?.workspace.brandName ?? "Fume";
  const [job, setJob] = useState<DownloadJob | null>(null);
  /** What this person has taken in this visit. */
  const [taken, setTaken] = useState<Set<DownloadKey>>(new Set());
  const timer = useRef<number | undefined>(undefined);

  const shareOf = (n: number) => (totalCount ? Math.round((totalBytes * n) / totalCount) : 0);

  async function start(key: DownloadKey, creatives: Creative[]) {
    if (!deliveryId || job) return;
    const n = creatives.length;
    const words = `${copy.creatives(n)} (${size(shareOf(n))})`;
    // One creative is its own picture: no packing, it saves at once.
    if (key.startsWith("creative:")) {
      const c = creatives[0];
      if (!c) return;
      save(c.current.image, fileName(c));
      setTaken((s) => new Set(s).add(key));
      toast.done(`${c.title} downloaded`, { meta: size(shareOf(1)) });
      return;
    }
    const format = key === "all" ? undefined : (key as Format);
    setJob({ key, progress: 0 });
    const t = toast.loading(`Preparing ${words}`, { meta: "0 %" });
    try {
      const url = await api.downloadUrl(deliveryId, format);
      if (!usingMock) {
        t.update({ type: "done", title: `${copy.creatives(n)} downloading`, meta: size(shareOf(n)) });
        window.location.assign(url);
        setTaken((s) => new Set(s).add(key));
        setJob(null);
        return;
      }
      // The demo packs for a moment, in steps, so the progress reads as it will with the real zip.
      await new Promise<void>((resolve) => {
        let p = 0;
        timer.current = window.setInterval(() => {
          p = Math.min(100, p + 20);
          setJob({ key, progress: p });
          t.update({ type: "loading", title: `Preparing ${words}`, meta: `${p} %` });
          if (p >= 100) {
            window.clearInterval(timer.current);
            resolve();
          }
        }, 260);
      });
      // One zip, named for the brand and the delivery, folders inside (DTSK-17).
      save(url, zipName(brand, deliveryName, format));
      if (url.startsWith("blob:")) window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setTaken((s) => new Set(s).add(key));
      t.update({ type: "done", title: `${copy.creatives(n)} downloaded`, meta: size(shareOf(n)) });
    } catch {
      t.update({
        type: "error",
        title: "The download didn’t start. Your creatives are safe; try again in a moment.",
        meta: undefined,
      });
    } finally {
      setJob(null);
    }
  }

  return { job, taken, start, busy: (key: DownloadKey) => job?.key === key, shareOf };
}
