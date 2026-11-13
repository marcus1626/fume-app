import { PREVIEW, signPreview } from "./preview.ts";
Deno.test("storage signing requests a capped, compressed preview without touching the original", async () => {
  const requests: unknown[] = [];
  const storage = {
    from: (bucket: string) => ({
      createSignedUrl: async (...args: unknown[]) => {
        requests.push([bucket, ...args]);
        return { data: { signedUrl: "https://storage/render/image/sign/preview" }, error: null };
      },
    }),
  };
  const url = await signPreview(storage, { bucket: "b", path: "original.jpg" });
  if (
    url !== "https://storage/render/image/sign/preview" ||
    JSON.stringify(requests) !==
      JSON.stringify([
        ["b", "original.jpg", 900, { transform: { width: 1024, height: 1024, resize: "contain", quality: 70 } }],
      ])
  )
    throw new Error("Storage must sign the transformed preview.");
  if (PREVIEW.width !== 1024) throw new Error("Unexpected cap");
  let refused = false;
  try {
    await signPreview(storage, { url: "https://example.com/full-original.jpg" });
  } catch {
    refused = true;
  }
  if (!refused || requests.length !== 1) throw new Error("Imported originals must not bypass preview limits");
});
