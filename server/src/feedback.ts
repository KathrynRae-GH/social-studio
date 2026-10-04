// Love it / not this, and why: the owner's verdicts on posts. Claude reads
// the recent ones before designing, the way the prototype's skills learned
// from Katy's notes.
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "./db/pool.ts";
import { pieceFeedback, pieces } from "./db/schema.ts";
import { AccessError, audit, requirePermission, type Brand, type Viewer } from "./brands.ts";
import { getPieceRow } from "./library.ts";
import type { FeedbackView } from "../../shared/content.ts";

export async function feedbackFor(db: Db, viewer: Viewer, pieceId: string): Promise<FeedbackView[]> {
  const brand = requirePermission(viewer, "use_tab");
  await getPieceRow(db, brand, pieceId);
  const rows = await db
    .select()
    .from(pieceFeedback)
    .where(and(eq(pieceFeedback.brandId, brand.id), eq(pieceFeedback.pieceId, pieceId)))
    .orderBy(desc(pieceFeedback.createdAt))
    .limit(50);
  return rows.map((r) => ({ rating: r.rating === 1 ? 1 : -1, note: r.note, by: r.userName, at: r.createdAt.toISOString() }));
}

export async function addFeedback(db: Db, viewer: Viewer, pieceId: string, input: { rating?: unknown; note?: unknown }): Promise<FeedbackView[]> {
  const brand = requirePermission(viewer, "use_tab");
  await getPieceRow(db, brand, pieceId);
  const rating = Number(input.rating);
  if (rating !== 1 && rating !== -1) throw new AccessError("Pick love it or not this.", 400);
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 1000) : "";
  await db.insert(pieceFeedback).values({ brandId: brand.id, pieceId, userId: viewer.ctx.userId, userName: viewer.ctx.name, rating, note });
  await audit(db, viewer, "piece.feedback", { pieceId, rating });
  return feedbackFor(db, viewer, pieceId);
}

// The shop's recent verdicts, newest first, for Claude's instructions.
export async function recentVerdicts(db: Db, brand: Brand, limit = 15): Promise<string> {
  const rows = await db
    .select({ rating: pieceFeedback.rating, note: pieceFeedback.note, title: pieces.title, kind: pieces.kind, design: pieces.design })
    .from(pieceFeedback)
    .innerJoin(pieces, eq(pieces.id, pieceFeedback.pieceId))
    .where(eq(pieceFeedback.brandId, brand.id))
    .orderBy(desc(pieceFeedback.createdAt))
    .limit(limit);
  const archived = await db
    .select({ title: pieces.title, design: pieces.design })
    .from(pieces)
    .where(and(eq(pieces.brandId, brand.id), eq(pieces.source, "claude"), eq(pieces.archived, true)))
    .orderBy(desc(pieces.updatedAt))
    .limit(5);
  const lines = rows.map(
    (r) =>
      `- ${r.rating === 1 ? "LOVED" : "NOT THIS"}: "${r.title}" (${r.kind}${r.design?.layout ? `, ${r.design.layout}` : ""}${r.design?.motifs ? `; motifs: ${r.design.motifs}` : ""})${r.note ? ` — "${r.note}"` : ""}`,
  );
  lines.push(...archived.map((a) => `- ARCHIVED (probably not wanted): "${a.title}"${a.design?.layout ? ` (${a.design.layout})` : ""}`));
  return lines.join("\n");
}
