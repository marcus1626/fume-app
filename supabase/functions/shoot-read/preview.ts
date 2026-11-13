import type { Source } from "./handler.ts";
export const PREVIEW = { width: 1024, height: 1024, resize: "contain", quality: 70 } as const;
type Storage = {
  from(bucket: string): {
    createSignedUrl(
      path: string,
      seconds: number,
      options: { transform: typeof PREVIEW },
    ): PromiseLike<{ data: { signedUrl: string } | null; error: { message: string } | null }>;
  };
};
/** Never fall back to original bytes, including imported URL references. */
export async function signPreview(storage: Storage, p: Source): Promise<string> {
  if (!p.bucket || !p.path) throw new Error("The product reference needs a stored, resized preview.");
  const { data, error } = await storage.from(p.bucket).createSignedUrl(p.path, 900, { transform: PREVIEW });
  if (error || !data) throw new Error(error?.message ?? "The preview could not be opened.");
  return data.signedUrl;
}
