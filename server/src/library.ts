// The Library: pieces (posts, carousels, Stories, Reels, text posts…), the
// files they use and their captions per channel. Every function works on the
// one brand the verified viewer is looking at; ids from the browser are
// always checked against that brand.
import { and, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "./db/pool.ts";
import { assets, calendarEntries, captions, ideas, pieces } from "./db/schema.ts";
import { AccessError, audit, requirePermission, type Brand, type Viewer } from "./brands.ts";
import { KIND_LABELS, channel, type Kind } from "../../shared/channels.ts";
import type { AssetView, CaptionView, IdeaView, PieceView } from "../../shared/content.ts";

const KINDS = Object.keys(KIND_LABELS) as Kind[];

export function isKind(value: unknown): value is Kind {
  return typeof value === "string" && (KINDS as string[]).includes(value);
}

function assetView(a: typeof assets.$inferSelect): AssetView {
  return { id: a.id, url: a.url, mime: a.mime, name: a.name };
}

export async function addAsset(
  db: Db,
  viewer: Viewer,
  file: { boutiqlyFileId: string | null; url: string; mime: string; name: string; sizeBytes: number; purpose?: "content" | "inspiration" },
): Promise<AssetView> {
  const brand = requirePermission(viewer, file.purpose === "inspiration" ? "manage_brand" : "use_tab");
  const [row] = await db
    .insert(assets)
    .values({ brandId: brand.id, ...file, uploadedBy: viewer.ctx.userId })
    .returning();
  await audit(db, viewer, file.purpose === "inspiration" ? "inspiration.add" : "asset.upload", { assetId: row!.id, name: file.name });
  return assetView(row!);
}

// Asset ids from the browser, kept only if they belong to this brand, in the
// order given.
async function ownAssetIds(db: Db, brand: Brand, ids: unknown): Promise<string[]> {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const wanted = ids.filter((id): id is string => typeof id === "string").slice(0, 35);
  if (wanted.length === 0) return [];
  const rows = await db
    .select({ id: assets.id })
    .from(assets)
    .where(and(eq(assets.brandId, brand.id), inArray(assets.id, wanted)));
  const mine = new Set(rows.map((r) => r.id));
  if (mine.size !== new Set(wanted).size) throw new AccessError("One of those files isn't in this shop's library.", 400);
  return wanted;
}

async function piecesWithDetails(db: Db, brand: Brand, rows: (typeof pieces.$inferSelect)[]): Promise<PieceView[]> {
  if (rows.length === 0) return [];
  const pieceIds = rows.map((p) => p.id);
  const assetIds = [...new Set(rows.flatMap((p) => p.assetIds))];
  const [assetRows, captionRows, entryRows] = await Promise.all([
    assetIds.length
      ? db.select().from(assets).where(and(eq(assets.brandId, brand.id), inArray(assets.id, assetIds)))
      : Promise.resolve([]),
    db.select().from(captions).where(inArray(captions.pieceId, pieceIds)),
    db
      .select({ pieceId: calendarEntries.pieceId, channel: calendarEntries.channel, status: calendarEntries.status })
      .from(calendarEntries)
      .where(and(eq(calendarEntries.brandId, brand.id), inArray(calendarEntries.pieceId, pieceIds))),
  ]);
  const assetById = new Map(assetRows.map((a) => [a.id, assetView(a)]));
  return rows.map((p) => ({
    id: p.id,
    kind: p.kind as Kind,
    title: p.title,
    link: p.link,
    archived: p.archived,
    assets: p.assetIds.map((id) => assetById.get(id)).filter((a): a is AssetView => !!a),
    captions: Object.fromEntries(
      captionRows
        .filter((c) => c.pieceId === p.id)
        .map((c): [string, CaptionView] => [c.channel, { text: c.text, altText: c.altText, status: c.status }]),
    ),
    onCalendar: entryRows.filter((e) => e.pieceId === p.id).map((e) => ({ channel: e.channel, status: e.status })),
    updatedAt: p.updatedAt.toISOString(),
    source: p.source,
    design: p.design ?? null,
  }));
}

export async function listPieces(db: Db, viewer: Viewer, opts: { archived?: boolean } = {}): Promise<PieceView[]> {
  const brand = requirePermission(viewer, "use_tab");
  const rows = await db
    .select()
    .from(pieces)
    .where(and(eq(pieces.brandId, brand.id), eq(pieces.archived, !!opts.archived)))
    .orderBy(desc(pieces.updatedAt))
    .limit(500);
  return piecesWithDetails(db, brand, rows);
}

export async function getPieceRow(db: Db, brand: Brand, pieceId: string) {
  const [row] = await db.select().from(pieces).where(and(eq(pieces.id, pieceId), eq(pieces.brandId, brand.id)));
  if (!row) throw new AccessError("That post isn't in this shop's library.", 404);
  return row;
}

export async function getPiece(db: Db, viewer: Viewer, pieceId: string): Promise<PieceView> {
  const brand = requirePermission(viewer, "use_tab");
  const [view] = await piecesWithDetails(db, brand, [await getPieceRow(db, brand, pieceId)]);
  return view!;
}

export interface PieceInput {
  kind?: unknown;
  title?: unknown;
  link?: unknown;
  assetIds?: unknown;
  archived?: unknown;
}

function cleanText(value: unknown, max: number): string | undefined {
  return typeof value === "string" ? value.trim().slice(0, max) : undefined;
}

export async function createPiece(db: Db, viewer: Viewer, input: PieceInput): Promise<PieceView> {
  const brand = requirePermission(viewer, "use_tab");
  if (!isKind(input.kind)) throw new AccessError("Pick what kind of post this is.", 400);
  const [row] = await db
    .insert(pieces)
    .values({
      brandId: brand.id,
      kind: input.kind,
      title: cleanText(input.title, 200) ?? "",
      link: cleanText(input.link, 2048) ?? "",
      assetIds: await ownAssetIds(db, brand, input.assetIds),
      createdBy: viewer.ctx.userId,
    })
    .returning();
  await audit(db, viewer, "piece.create", { pieceId: row!.id, kind: input.kind });
  return getPiece(db, viewer, row!.id);
}

export async function updatePiece(db: Db, viewer: Viewer, pieceId: string, input: PieceInput): Promise<PieceView> {
  const brand = requirePermission(viewer, "use_tab");
  await getPieceRow(db, brand, pieceId);
  const changes: Partial<typeof pieces.$inferInsert> = { updatedAt: new Date() };
  if (input.kind !== undefined) {
    if (!isKind(input.kind)) throw new AccessError("Pick what kind of post this is.", 400);
    changes.kind = input.kind;
  }
  const title = cleanText(input.title, 200);
  if (title !== undefined) changes.title = title;
  const link = cleanText(input.link, 2048);
  if (link !== undefined) changes.link = link;
  if (input.assetIds !== undefined) changes.assetIds = await ownAssetIds(db, brand, input.assetIds);
  if (typeof input.archived === "boolean") changes.archived = input.archived;
  await db.update(pieces).set(changes).where(and(eq(pieces.id, pieceId), eq(pieces.brandId, brand.id)));
  await audit(db, viewer, "piece.update", { pieceId, fields: Object.keys(changes).filter((k) => k !== "updatedAt") });
  return getPiece(db, viewer, pieceId);
}

export async function setCaption(
  db: Db,
  viewer: Viewer,
  pieceId: string,
  channelId: string,
  input: { text?: unknown; altText?: unknown; status?: unknown },
): Promise<PieceView> {
  const brand = requirePermission(viewer, "use_tab");
  await getPieceRow(db, brand, pieceId);
  if (!channel(channelId)) throw new AccessError("That isn't a channel Social Studio writes for.", 400);
  const values = {
    text: cleanText(input.text, 70_000) ?? "",
    altText: cleanText(input.altText, 2000) ?? "",
    status: input.status === "final" ? ("final" as const) : ("draft" as const),
    updatedAt: new Date(),
  };
  await db
    .insert(captions)
    .values({ pieceId, channel: channelId, ...values })
    .onConflictDoUpdate({ target: [captions.pieceId, captions.channel], set: values });
  await db.update(pieces).set({ updatedAt: new Date() }).where(eq(pieces.id, pieceId));
  await audit(db, viewer, "caption.set", { pieceId, channel: channelId, status: values.status });
  return getPiece(db, viewer, pieceId);
}

// ---- Ideas ----

function ideaView(i: typeof ideas.$inferSelect): IdeaView {
  return { id: i.id, title: i.title, pitch: i.pitch, format: i.format, status: i.status, pieceId: i.pieceId };
}

export async function listIdeas(db: Db, viewer: Viewer): Promise<IdeaView[]> {
  const brand = requirePermission(viewer, "use_tab");
  const rows = await db.select().from(ideas).where(eq(ideas.brandId, brand.id)).orderBy(desc(ideas.createdAt));
  return rows.map(ideaView);
}

const IDEA_STATUSES = ["now", "later", "built", "done"] as const;

export async function saveIdea(
  db: Db,
  viewer: Viewer,
  ideaId: string | null,
  input: { title?: unknown; pitch?: unknown; format?: unknown; status?: unknown },
): Promise<IdeaView> {
  const brand = requirePermission(viewer, "use_tab");
  const status = IDEA_STATUSES.find((s) => s === input.status);
  const fields = {
    ...(cleanText(input.title, 200) !== undefined && { title: cleanText(input.title, 200)! }),
    ...(cleanText(input.pitch, 2000) !== undefined && { pitch: cleanText(input.pitch, 2000)! }),
    ...(cleanText(input.format, 100) !== undefined && { format: cleanText(input.format, 100)! }),
    ...(status && { status }),
  };
  if (ideaId === null) {
    if (!fields.title) throw new AccessError("Give the idea a title.", 400);
    const [row] = await db
      .insert(ideas)
      .values({ brandId: brand.id, title: fields.title, ...fields, createdBy: viewer.ctx.userId })
      .returning();
    await audit(db, viewer, "idea.create", { ideaId: row!.id });
    return ideaView(row!);
  }
  const [row] = await db
    .update(ideas)
    .set(fields)
    .where(and(eq(ideas.id, ideaId), eq(ideas.brandId, brand.id)))
    .returning();
  if (!row) throw new AccessError("That idea isn't in this shop's board.", 404);
  await audit(db, viewer, "idea.update", { ideaId });
  return ideaView(row);
}

export async function deleteIdea(db: Db, viewer: Viewer, ideaId: string): Promise<void> {
  const brand = requirePermission(viewer, "use_tab");
  await db.delete(ideas).where(and(eq(ideas.id, ideaId), eq(ideas.brandId, brand.id)));
  await audit(db, viewer, "idea.delete", { ideaId });
}
