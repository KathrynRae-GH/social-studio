// Files go into the shop's own Boutiqly media storage, in a "Social Studio"
// folder made on first use. The database keeps only the address.
import { eq } from "drizzle-orm";
import type { Db } from "./db/pool.ts";
import { brands } from "./db/schema.ts";
import type { Brand } from "./brands.ts";
import type { BoutiqlyClient } from "./boutiqly/api.ts";

export const MEDIA_FOLDER = "Social Studio";

export async function storeFile(
  db: Db,
  brand: Brand,
  client: BoutiqlyClient,
  file: { bytes: Uint8Array; mime: string; name: string },
): Promise<{ fileId: string | null; url: string }> {
  let folderId = brand.mediaFolderId;
  if (!folderId) {
    // Another request may have made it meanwhile; re-read before creating.
    const [fresh] = await db.select({ id: brands.mediaFolderId }).from(brands).where(eq(brands.id, brand.id));
    folderId = fresh?.id ?? null;
  }
  if (!folderId) {
    folderId = await client.createFolder(MEDIA_FOLDER);
    await db.update(brands).set({ mediaFolderId: folderId }).where(eq(brands.id, brand.id));
  }
  brand.mediaFolderId = folderId;
  const name = file.name.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "file";
  return client.uploadFile(new Blob([new Uint8Array(file.bytes)], { type: file.mime }), name, folderId);
}
