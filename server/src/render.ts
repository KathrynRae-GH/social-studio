// Designs → finished images. The server builds each frame's HTML document
// (shared engine + the shop's approved look + allowed photos), the worker
// renders it in Chromium, and the PNGs move into the shop's Boutiqly media
// storage and onto the piece, in order.
import { and, eq, inArray } from "drizzle-orm";
import type pg from "pg";
import type { Db } from "./db/pool.ts";
import { assets, pieces } from "./db/schema.ts";
import { AccessError, type Brand } from "./brands.ts";
import type { BoutiqlyClient } from "./boutiqly/api.ts";
import { usableInDesign } from "./assets.ts";
import { styleForDesign } from "./styles.ts";
import { clearOutputs, enqueueJob, getJob, takeOutputs, tryWithLock, waitForJob } from "./jobs.ts";
import { storeFile } from "./media.ts";
import { SIZES, assetRefs, frameDocument, type Design, type DesignSize } from "../../shared/design.ts";

export interface RenderDeps {
  db: Db;
  pool: pg.Pool;
  clientFor: (brand: Brand) => BoutiqlyClient;
}

const MAX_FRAMES = 10;
const MAX_HTML = 60_000;

export function cleanDesign(input: unknown): Design {
  const d = input as Partial<Design> | null;
  if (!d || typeof d !== "object") throw new AccessError("A design needs a size and frames.", 400);
  if (!d.size || !(d.size in SIZES)) throw new AccessError(`Pick a size: ${Object.keys(SIZES).join(", ")}.`, 400);
  if (!Array.isArray(d.frames) || d.frames.length === 0 || d.frames.length > MAX_FRAMES) {
    throw new AccessError(`A design has 1 to ${MAX_FRAMES} frames.`, 400);
  }
  const css = typeof d.css === "string" ? d.css : "";
  const frames = d.frames.map((f) => ({ html: typeof f?.html === "string" ? f.html : "" }));
  if (css.length > MAX_HTML || frames.some((f) => f.html.length > MAX_HTML || !f.html.trim())) {
    throw new AccessError("Each frame needs content, and each part must stay under 60,000 characters.", 400);
  }
  return { size: d.size as DesignSize, css, frames };
}

// Builds the documents and queues the render. Throws (with a reason Claude
// can act on) if the design uses a file it may not use.
export async function startRender(deps: RenderDeps, brand: Brand, pieceId: string, designInput: unknown): Promise<string> {
  const design = cleanDesign(designInput);
  const [piece] = await deps.db.select().from(pieces).where(and(eq(pieces.id, pieceId), eq(pieces.brandId, brand.id)));
  if (!piece) throw new AccessError("That post isn't in this shop's library.", 404);

  const style = await styleForDesign(deps.db, brand);
  const refs = assetRefs(design);
  const ids = refs.filter((r) => r !== "logo");
  const rows = ids.length ? await deps.db.select().from(assets).where(and(eq(assets.brandId, brand.id), inArray(assets.id, ids))) : [];
  const urls: Record<string, string> = {};
  for (const id of ids) {
    const a = rows.find((r) => r.id === id);
    if (!a) throw new AccessError(`asset:${id} isn't one of this shop's files.`, 400);
    const ok = usableInDesign(a);
    if (!ok.ok) throw new AccessError(`asset:${id} can't be used: ${ok.reason}`, 400);
    urls[id] = a.url;
  }
  if (refs.includes("logo")) {
    if (!style.logoUrl) throw new AccessError("This shop has no approved logo, so leave the logo out.", 400);
    urls.logo = style.logoUrl;
  }

  const { width, height } = SIZES[design.size];
  const allowedHosts = [...new Set([...Object.values(urls)].map((u) => new URL(u).host))];
  const docs = design.frames.map((_f, i) => frameDocument(design, i, style, urls));
  const jobId = await enqueueJob(deps.pool, brand.id, "render", { docs, width, height, allowedHosts, pieceId, brandId: brand.id });
  await deps.db
    .update(pieces)
    .set({ design: { ...design, renderJobId: jobId, renderedAt: null, renderError: null }, updatedAt: new Date() })
    .where(eq(pieces.id, pieceId));
  return jobId;
}

export type RenderState = "done" | "pending" | "failed";

// Moves a finished render's images onto the piece. Safe to call repeatedly
// and from several places at once.
export async function finishRender(deps: RenderDeps, brand: Brand, pieceId: string, userId: string): Promise<RenderState> {
  const result = await tryWithLock(deps.pool, `render:${pieceId}`, async (): Promise<RenderState> => {
    const [piece] = await deps.db.select().from(pieces).where(and(eq(pieces.id, pieceId), eq(pieces.brandId, brand.id)));
    const design = piece?.design;
    if (!piece || !design?.renderJobId) return "done";
    if (design.renderedAt) return "done";
    if (design.renderError) return "failed";
    const job = await getJob(deps.pool, brand.id, design.renderJobId);
    if (!job) return "failed";
    if (job.status === "queued" || job.status === "running") return "pending";
    if (job.status === "failed") {
      await deps.db
        .update(pieces)
        .set({ design: { ...design, renderError: job.error?.slice(0, 500) ?? "The render didn't work." } })
        .where(eq(pieces.id, pieceId));
      return "failed";
    }
    const outputs = await takeOutputs(deps.pool, design.renderJobId);
    if (outputs.length !== design.frames.length) {
      await deps.db.update(pieces).set({ design: { ...design, renderError: "Some frames didn't render." } }).where(eq(pieces.id, pieceId));
      return "failed";
    }
    const client = deps.clientFor(brand);
    const newIds: string[] = [];
    const slug = (piece.title || piece.kind).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "design";
    for (const out of outputs) {
      const name = `${slug}-${out.frame + 1}.png`;
      const stored = await storeFile(deps.db, brand, client, { bytes: out.data, mime: out.mime, name });
      const [row] = await deps.db
        .insert(assets)
        .values({
          brandId: brand.id,
          boutiqlyFileId: stored.fileId,
          url: stored.url,
          mime: out.mime,
          name,
          sizeBytes: out.data.length,
          uploadedBy: userId,
          description: `Frame ${out.frame + 1} of the design "${piece.title}"`,
          taggedAt: new Date(),
          madeBy: "render",
        })
        .returning({ id: assets.id });
      newIds.push(row!.id);
    }
    await deps.db
      .update(pieces)
      .set({ assetIds: newIds, design: { ...design, renderedAt: new Date().toISOString() }, updatedAt: new Date() })
      .where(eq(pieces.id, pieceId));
    await clearOutputs(deps.pool, design.renderJobId);
    return "done";
  });
  return result ?? "pending";
}

export async function renderAndWait(deps: RenderDeps, brand: Brand, pieceId: string, design: unknown, userId: string, timeoutMs = 120_000): Promise<RenderState> {
  const jobId = await startRender(deps, brand, pieceId, design);
  await waitForJob(deps.pool, brand.id, jobId, timeoutMs);
  return finishRender(deps, brand, pieceId, userId);
}
