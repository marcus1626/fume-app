// The Vercel function (built to app/api/shot.js by tools/build.mjs, served by the fume-app project): a headless
// Chromium that opens a brand's page and screenshots it as a visitor sees it (src/shot.ts says why).
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { DISMISS, handleShot, type View } from "../src/shot.ts";

async function capture(url: string, views: View[]): Promise<Uint8Array[]> {
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: process.env.FUME_CHROMIUM ?? (await chromium.executablePath()),
    headless: true,
  });
  try {
    const out: Uint8Array[] = [];
    for (const v of views) {
      const page = await browser.newPage();
      await page.setViewport({ width: v.width, height: v.height, deviceScaleFactor: v.scale, isMobile: v.name === "mobile" });
      await page.setUserAgent(
        v.name === "mobile"
          ? "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
          : "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
      );
      await page.goto(url, { waitUntil: "networkidle2", timeout: 25_000 }).catch(() => undefined);
      await page.evaluate(DISMISS).catch(() => false);
      await new Promise((r) => setTimeout(r, 1200));
      if (v.scrollScreens) await page.evaluate((y) => window.scrollTo(0, y), v.height * v.scrollScreens);
      await new Promise((r) => setTimeout(r, 800));
      out.push(new Uint8Array(await page.screenshot({ type: "jpeg", quality: 80 })));
      await page.close();
    }
    return out;
  } finally {
    await browser.close();
  }
}

export async function POST(req: Request): Promise<Response> {
  return handleShot(req, { storageHost: process.env.FUME_STORAGE_HOST ?? "vkusmctftfzsrxbcxtdz.supabase.co", fetch, capture });
}

export async function GET(): Promise<Response> {
  return new Response(JSON.stringify({ service: "fume-shot", ok: true }), { headers: { "content-type": "application/json" } });
}
