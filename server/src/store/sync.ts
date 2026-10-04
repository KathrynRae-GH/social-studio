// Connecting a shop's online store and keeping its product list current.
// Reading happens in the background: right after connecting, when someone
// taps Refresh, and once a day on its own. The main photo of the newest
// products is copied into the shop's Assets (Boutiqly media storage), where
// Claude looks at it like any upload before it can go in a design.
import { and, desc, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import type pg from "pg";
import type { Db } from "../db/pool.ts";
import { assets, brands, products, stores } from "../db/schema.ts";
import { AccessError, audit, requirePermission, type Brand, type Viewer } from "../brands.ts";
import { tryWithLock } from "../jobs.ts";
import { storeFile } from "../media.ts";
import type { BoutiqlyClient } from "../boutiqly/api.ts";
import { readStore, type StoreProduct } from "./reader.ts";
import { StoreReadError, storeOrigin, type StoreFetch } from "./net.ts";
import { NEW_PRODUCT_DAYS, type ProductView, type StoreView } from "../../../shared/store.ts";

export interface StoreDeps {
  db: Db;
  pool: pg.Pool;
  storeFetch: StoreFetch;
  clientFor: (brand: Brand) => BoutiqlyClient;
  // Claude looks at a newly copied photo (only when someone is signed in and Claude is on).
  tagPhoto?: (viewer: Viewer, assetId: string) => Promise<unknown>;
}

const PHOTOS_PER_READ = 40;
const MAX_STORE_PHOTOS = 300;
const REFRESH_HOURS = 20;
const PHOTO_MIME = /^image\/(jpeg|png|webp|gif)$/;
const DAY = 86_400_000;

type ProductRow = typeof products.$inferSelect;

export function addedAt(p: Pick<ProductRow, "publishedAt" | "firstSeenAt" | "inFirstRead">): Date | null {
  return p.publishedAt ?? (p.inFirstRead ? null : p.firstSeenAt);
}

export function isNewProduct(p: Pick<ProductRow, "publishedAt" | "firstSeenAt" | "inFirstRead">, now = Date.now()): boolean {
  const at = addedAt(p);
  return !!at && now - at.getTime() <= NEW_PRODUCT_DAYS * DAY;
}

function sortNewest(a: ProductRow, b: ProductRow): number {
  return (addedAt(b)?.getTime() ?? 0) - (addedAt(a)?.getTime() ?? 0) || a.title.localeCompare(b.title);
}

export async function liveProducts(db: Db, brandId: string): Promise<ProductRow[]> {
  const rows = await db.select().from(products).where(and(eq(products.brandId, brandId), isNull(products.removedAt)));
  return rows.sort(sortNewest);
}

export async function getStore(db: Db, viewer: Viewer): Promise<StoreView | null> {
  const brand = requirePermission(viewer, "use_tab");
  const [store] = await db.select().from(stores).where(eq(stores.brandId, brand.id));
  if (!store) return null;
  const rows = await liveProducts(db, brand.id);
  const photoIds = rows.map((r) => r.assetId).filter((x): x is string => !!x);
  const photos = new Map(
    photoIds.length ? (await db.select({ id: assets.id, url: assets.url }).from(assets).where(and(eq(assets.brandId, brand.id), inArray(assets.id, photoIds)))).map((a) => [a.id, a.url]) : [],
  );
  const view: ProductView[] = rows.map((p) => ({
    id: p.id,
    title: p.title,
    url: p.url,
    productType: p.productType,
    available: p.available,
    addedAt: addedAt(p)?.toISOString() ?? null,
    isNew: isNewProduct(p),
    photo: p.assetId && photos.has(p.assetId) ? { assetId: p.assetId, url: photos.get(p.assetId)! } : null,
  }));
  return {
    url: store.url,
    platform: store.platform,
    status: store.status,
    lastReadAt: store.lastReadAt?.toISOString() ?? null,
    lastError: store.lastError,
    productCount: view.length,
    newCount: view.filter((p) => p.isNew).length,
    products: view.slice(0, 200),
  };
}

export async function connectStore(deps: StoreDeps, viewer: Viewer, input: unknown): Promise<StoreView | null> {
  const brand = requirePermission(viewer, "manage_brand");
  let url: string;
  try {
    url = storeOrigin(typeof input === "string" ? input : "");
  } catch (err) {
    throw new AccessError((err as Error).message, 400);
  }
  const [existing] = await deps.db.select().from(stores).where(eq(stores.brandId, brand.id));
  if (existing && existing.url !== url) {
    // A different store: start its product list fresh (copied photos stay in Assets).
    await deps.db.delete(products).where(eq(products.brandId, brand.id));
  }
  await deps.db
    .insert(stores)
    .values({ brandId: brand.id, url, connectedBy: viewer.ctx.userId })
    .onConflictDoUpdate({ target: stores.brandId, set: { url, status: "new", lastError: null, connectedBy: viewer.ctx.userId, connectedAt: new Date() } });
  await audit(deps.db, viewer, "store.connect", { url });
  startRead(deps, brand, viewer);
  return getStore(deps.db, viewer);
}

export async function disconnectStore(db: Db, viewer: Viewer): Promise<void> {
  const brand = requirePermission(viewer, "manage_brand");
  await db.delete(products).where(eq(products.brandId, brand.id));
  await db.delete(stores).where(eq(stores.brandId, brand.id));
  await audit(db, viewer, "store.disconnect");
}

export async function refreshStore(deps: StoreDeps, viewer: Viewer): Promise<StoreView | null> {
  const brand = requirePermission(viewer, "use_tab");
  const [store] = await deps.db.select().from(stores).where(eq(stores.brandId, brand.id));
  if (!store) throw new AccessError("Connect your online store first.", 400);
  startRead(deps, brand, viewer);
  return getStore(deps.db, viewer);
}

function startRead(deps: StoreDeps, brand: Brand, viewer: Viewer | null): void {
  readStoreNow(deps, brand, viewer).catch((err) => console.warn(`[store] ${brand.id}: ${(err as Error).message}`));
}

// Reads the store and saves what changed. Returns false if a read for this
// shop was already running.
export async function readStoreNow(deps: StoreDeps, brand: Brand, viewer: Viewer | null): Promise<boolean> {
  const done = await tryWithLock(deps.pool, `store:${brand.id}`, async () => {
    const [store] = await deps.db.select().from(stores).where(eq(stores.brandId, brand.id));
    if (!store) return true;
    await deps.db.update(stores).set({ status: "reading" }).where(eq(stores.brandId, brand.id));
    try {
      const existing = await deps.db.select().from(products).where(eq(products.brandId, brand.id));
      const firstRead = existing.length === 0;
      const known = new Map(existing.filter((p) => p.externalId.startsWith("page:")).map((p) => [p.externalId.slice(5), p.pageLastmod]));
      const read = await readStore(store.url, deps.storeFetch, known);
      await saveProducts(deps.db, brand.id, read.products, read.unchanged.map((u) => `page:${u}`), firstRead);
      await deps.db.update(stores).set({ platform: read.platform, status: "ok", lastError: null, lastReadAt: new Date() }).where(eq(stores.brandId, brand.id));
    } catch (err) {
      const message = err instanceof StoreReadError ? err.message : "We couldn't read the store just now. We'll try again tomorrow, or tap Refresh.";
      if (!(err instanceof StoreReadError)) console.warn(`[store] read failed for ${brand.id}: ${(err as Error).message}`);
      await deps.db.update(stores).set({ status: "error", lastError: message, lastReadAt: new Date() }).where(eq(stores.brandId, brand.id));
      return true;
    }
    await copyPhotos(deps, brand, viewer);
    return true;
  });
  return done !== null;
}

async function saveProducts(db: Db, brandId: string, found: StoreProduct[], unchanged: string[], firstRead: boolean): Promise<void> {
  const now = new Date();
  for (const p of found) {
    await db
      .insert(products)
      .values({
        brandId,
        externalId: p.externalId,
        title: p.title,
        url: p.url,
        description: p.description,
        productType: p.productType,
        tags: p.tags,
        imageUrl: p.imageUrl,
        available: p.available,
        publishedAt: p.publishedAt,
        inFirstRead: firstRead,
        pageLastmod: p.pageLastmod,
      })
      .onConflictDoUpdate({
        target: [products.brandId, products.externalId],
        set: {
          title: p.title,
          url: p.url,
          description: p.description,
          productType: p.productType,
          tags: p.tags,
          imageUrl: p.imageUrl,
          available: p.available,
          publishedAt: p.publishedAt,
          pageLastmod: p.pageLastmod,
          updatedAt: now,
          removedAt: null,
        },
      });
  }
  // Products the store no longer lists are hidden (kept, in case they come back).
  const stillListed = [...found.map((p) => p.externalId), ...unchanged];
  await db
    .update(products)
    .set({ removedAt: now })
    .where(
      and(
        eq(products.brandId, brandId),
        isNull(products.removedAt),
        stillListed.length ? notInArray(products.externalId, stillListed) : undefined,
      ),
    );
}

function photoAddress(url: string): string {
  try {
    const u = new URL(url);
    // Shopify's image server makes a smaller copy on request.
    if (u.hostname === "cdn.shopify.com" || u.pathname.includes("/cdn/shop/")) u.searchParams.set("width", "1600");
    return u.toString();
  } catch {
    return url;
  }
}

async function copyPhotos(deps: StoreDeps, brand: Brand, viewer: Viewer | null): Promise<void> {
  const [{ count }] = (await deps.db.select({ count: sql<number>`count(*)::int` }).from(assets).where(and(eq(assets.brandId, brand.id), sql`${assets.productId} IS NOT NULL`))) as [{ count: number }];
  let room = Math.min(PHOTOS_PER_READ, MAX_STORE_PHOTOS - count);
  if (room <= 0) return;
  const wanted = (await liveProducts(deps.db, brand.id)).filter((p) => p.imageUrl && (!p.assetId || p.assetImageUrl !== p.imageUrl) && p.available !== false);
  const [freshBrand] = await deps.db.select().from(brands).where(eq(brands.id, brand.id));
  const copied: string[] = [];
  for (const p of wanted) {
    if (room <= 0) break;
    try {
      const res = await deps.storeFetch(photoAddress(p.imageUrl!), { accept: "image/jpeg,image/png,image/webp,image/gif", maxBytes: 15_000_000 });
      const mime = res.contentType.split(";")[0]!.trim().toLowerCase();
      if (res.status !== 200 || !PHOTO_MIME.test(mime) || res.body.length === 0) {
        // Remember the attempt so a broken photo isn't retried every day.
        await deps.db.update(products).set({ assetImageUrl: p.imageUrl }).where(eq(products.id, p.id));
        continue;
      }
      const ext = mime.split("/")[1]!.replace("jpeg", "jpg");
      const name = `${p.title.slice(0, 80)}.${ext}`;
      const stored = await storeFile(deps.db, freshBrand ?? brand, deps.clientFor(freshBrand ?? brand), { bytes: res.body, mime, name });
      const [row] = await deps.db
        .insert(assets)
        .values({
          brandId: brand.id,
          boutiqlyFileId: stored.fileId,
          url: stored.url,
          mime,
          name,
          sizeBytes: res.body.length,
          uploadedBy: viewer?.ctx.userId ?? "store",
          productId: p.id,
          description: "",
        })
        .returning({ id: assets.id });
      await deps.db.update(products).set({ assetId: row!.id, assetImageUrl: p.imageUrl }).where(eq(products.id, p.id));
      copied.push(row!.id);
      room--;
    } catch (err) {
      console.warn(`[store] photo for ${p.id} not copied: ${(err as Error).message}`);
      if (err instanceof StoreReadError) await deps.db.update(products).set({ assetImageUrl: p.imageUrl }).where(eq(products.id, p.id));
    }
  }
  // Claude looks at the new photos, a few at a time, when someone is here to pay for it.
  if (viewer && deps.tagPhoto && (freshBrand ?? brand).claudeEnabled) {
    for (let i = 0; i < copied.length; i += 4) {
      await Promise.allSettled(copied.slice(i, i + 4).map((id) => deps.tagPhoto!(viewer, id)));
    }
  }
}

// Once an hour, re-reads stores that haven't been read for a day.
export function startStoreRefresher(deps: StoreDeps, everyMs = 3_600_000): () => void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const due = await deps.db
        .select({ brand: brands })
        .from(stores)
        .innerJoin(brands, eq(brands.id, stores.brandId))
        .where(sql`${stores.lastReadAt} IS NULL OR ${stores.lastReadAt} < now() - make_interval(hours => ${REFRESH_HOURS})`)
        .orderBy(desc(stores.connectedAt))
        .limit(20);
      for (const { brand } of due) await readStoreNow(deps, brand, null);
    } catch (err) {
      console.warn(`[store] refresh round failed: ${(err as Error).message}`);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), everyMs);
  const first = setTimeout(() => void tick(), 60_000);
  return () => {
    clearInterval(timer);
    clearTimeout(first);
  };
}
