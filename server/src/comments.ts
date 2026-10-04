// Comments on a post that Claude turns into edits. People collect comments,
// then "Send edits to Claude" sends them all at once: the post's current
// version is kept (so "Go back" can restore it), the post goes back to
// Suggested (its unsent calendar spots are removed), and Claude revises it in
// the background through Ask Claude's tools.
import { and, asc, desc, eq, inArray, isNull, lt, or } from "drizzle-orm";
import type { Db } from "./db/pool.ts";
import { assets, calendarEntries, captions, pieceComments, pieceVersions, pieces, type PieceSnapshot } from "./db/schema.ts";
import { AccessError, audit, requirePermission, type Viewer } from "./brands.ts";
import { getPieceRow } from "./library.ts";
import { ask, type AskDeps } from "./claude/ask.ts";
import type { AskEvent } from "../../shared/ask.ts";
import type { PieceComments } from "../../shared/content.ts";

const STALE_EDIT_MS = 20 * 60_000; // an edit that never finished (server restart) stops blocking after this
const MAX_OPEN = 30;

type Piece = typeof pieces.$inferSelect;

function isEditing(p: Pick<Piece, "editingStartedAt">): boolean {
  return !!p.editingStartedAt && Date.now() - p.editingStartedAt.getTime() < STALE_EDIT_MS;
}

export async function commentsFor(db: Db, viewer: Viewer, pieceId: string): Promise<PieceComments> {
  const brand = requirePermission(viewer, "use_tab");
  const piece = await getPieceRow(db, brand, pieceId);
  const rows = await db.select().from(pieceComments).where(eq(pieceComments.pieceId, piece.id)).orderBy(asc(pieceComments.createdAt)).limit(200);
  const versions = await db.select().from(pieceVersions).where(eq(pieceVersions.pieceId, piece.id)).orderBy(desc(pieceVersions.createdAt)).limit(20);
  const firstFrames = versions.map((v) => v.snapshot.assetIds[0]).filter((id): id is string => !!id);
  const frames = firstFrames.length ? await db.select().from(assets).where(and(eq(assets.brandId, brand.id), inArray(assets.id, firstFrames))) : [];
  return {
    comments: rows.map((c) => ({ id: c.id, by: c.userName || "Someone", mine: c.userId === viewer.ctx.userId, text: c.text, status: c.status, at: c.createdAt.toISOString() })),
    versions: versions.map((v) => {
      const a = frames.find((f) => f.id === v.snapshot.assetIds[0]);
      return { id: v.id, reason: v.reason, by: v.createdByName, at: v.createdAt.toISOString(), preview: a ? { id: a.id, url: a.url, mime: a.mime, name: a.name } : null };
    }),
    editing: isEditing(piece),
    reply: piece.editReply,
    error: piece.editError,
  };
}

export async function addComment(db: Db, viewer: Viewer, pieceId: string, input: { text?: unknown }): Promise<PieceComments> {
  const brand = requirePermission(viewer, "use_tab");
  const piece = await getPieceRow(db, brand, pieceId);
  const text = typeof input.text === "string" ? input.text.trim().slice(0, 2000) : "";
  if (!text) throw new AccessError("Write a comment first.", 400);
  const open = await db.select({ id: pieceComments.id }).from(pieceComments).where(and(eq(pieceComments.pieceId, piece.id), eq(pieceComments.status, "open")));
  if (open.length >= MAX_OPEN) throw new AccessError("That's a lot of comments. Send these to Claude first.", 400);
  await db.insert(pieceComments).values({ brandId: brand.id, pieceId: piece.id, userId: viewer.ctx.userId, userName: viewer.ctx.name, text });
  await audit(db, viewer, "comment.add", { pieceId });
  return commentsFor(db, viewer, pieceId);
}

export async function deleteComment(db: Db, viewer: Viewer, pieceId: string, commentId: number): Promise<PieceComments> {
  const brand = requirePermission(viewer, "use_tab");
  const piece = await getPieceRow(db, brand, pieceId);
  const [c] = await db.select().from(pieceComments).where(and(eq(pieceComments.id, commentId), eq(pieceComments.pieceId, piece.id)));
  if (!c) throw new AccessError("That comment isn't here.", 404);
  if (c.status !== "open") throw new AccessError("That comment was already sent to Claude.", 400);
  if (c.userId !== viewer.ctx.userId && viewer.role !== "boutiqly_team" && viewer.role !== "owner") throw new AccessError("You can only remove your own comments.");
  await db.delete(pieceComments).where(eq(pieceComments.id, c.id));
  return commentsFor(db, viewer, pieceId);
}

async function snapshotOf(db: Db, piece: Piece): Promise<PieceSnapshot> {
  const caps = await db.select().from(captions).where(eq(captions.pieceId, piece.id));
  return {
    kind: piece.kind,
    title: piece.title,
    link: piece.link,
    assetIds: piece.assetIds,
    design: piece.design ?? null,
    captions: Object.fromEntries(caps.map((c) => [c.channel, { text: c.text, altText: c.altText }])),
  };
}

// The post goes back to Suggested: approval cleared, captions back to draft,
// calendar spots that haven't gone to Boutiqly removed. A post already in
// Boutiqly's social planner can't be edited here.
async function backToSuggested(db: Db, piece: Piece): Promise<number> {
  const entries = await db.select().from(calendarEntries).where(eq(calendarEntries.pieceId, piece.id));
  const sent = entries.filter((e) => e.status === "scheduled" || e.status === "posted" || e.plannerPostIds.length > 0);
  if (sent.length) {
    throw new AccessError("This post is already scheduled or posted in Boutiqly's social planner. Delete it there first (or make a new post), then edit it here.", 400);
  }
  if (entries.length) await db.delete(calendarEntries).where(inArray(calendarEntries.id, entries.map((e) => e.id)));
  const now = new Date();
  await db.update(captions).set({ status: "draft", updatedAt: now }).where(eq(captions.pieceId, piece.id));
  await db.update(pieces).set({ approvedAt: null, approvedBy: null, approvedByName: "", approvedChannels: [], updatedAt: now }).where(eq(pieces.id, piece.id));
  return entries.length;
}

function editRequest(piece: Piece, comments: { userName: string; text: string }[]): string {
  return `Please revise the post "${piece.title || "Untitled"}" (piece_id ${piece.id}, a ${piece.kind.replace("_", " ")}) using these comments from the shop's team:
${comments.map((c) => `- ${c.userName || "Team"}: ${c.text}`).join("\n")}

Change only what the comments ask for and keep everything else as it is. First look at the current frames (search_library gives their asset ids; look_at_image shows them). Then call design_piece with piece_id ${piece.id}: include the full updated design if any comment is about the visuals (keep the same layout unless a comment asks otherwise, and set owner_asked_for_this_layout), and the captions if any comment is about the words. Finish with one or two plain sentences on what you changed.`;
}

// Sends every open comment to Claude. Returns straight away; Claude works in
// the background and the post updates when it's done.
export async function sendEdits(deps: AskDeps, viewer: Viewer, pieceId: string): Promise<PieceComments> {
  const brand = requirePermission(viewer, "use_tab");
  const piece = await getPieceRow(deps.db, brand, pieceId);
  if (!brand.claudeEnabled) throw new AccessError("Claude isn't turned on for this shop yet.", 400);
  if (isEditing(piece)) throw new AccessError("Claude is already working on this post's edits.", 409);
  const open = await deps.db.select().from(pieceComments).where(and(eq(pieceComments.pieceId, piece.id), eq(pieceComments.status, "open"))).orderBy(asc(pieceComments.createdAt));
  if (open.length === 0) throw new AccessError("Leave a comment first.", 400);

  // Claim the post for editing (only one edit at a time).
  const [claimed] = await deps.db
    .update(pieces)
    .set({ editingStartedAt: new Date(), editError: null })
    .where(and(eq(pieces.id, piece.id), or(isNull(pieces.editingStartedAt), lt(pieces.editingStartedAt, new Date(Date.now() - STALE_EDIT_MS)))))
    .returning({ id: pieces.id });
  if (!claimed) throw new AccessError("Claude is already working on this post's edits.", 409);

  try {
    const snapshot = await snapshotOf(deps.db, piece);
    const removed = await backToSuggested(deps.db, piece);
    await deps.db.insert(pieceVersions).values({ brandId: brand.id, pieceId: piece.id, snapshot, reason: "Before Claude's edits", createdBy: viewer.ctx.userId, createdByName: viewer.ctx.name });
    await deps.db.update(pieceComments).set({ status: "sent", sentAt: new Date() }).where(inArray(pieceComments.id, open.map((c) => c.id)));
    await audit(deps.db, viewer, "comment.send_edits", { pieceId, comments: open.length, removedEntries: removed });
  } catch (err) {
    await deps.db.update(pieces).set({ editingStartedAt: null }).where(eq(pieces.id, piece.id));
    throw err;
  }

  void runEdit(deps, viewer, piece, open);
  return commentsFor(deps.db, viewer, pieceId);
}

async function runEdit(deps: AskDeps, viewer: Viewer, piece: Piece, open: { id: number; userName: string; text: string }[]): Promise<void> {
  let reply = "";
  let error: string | null = null;
  let conversationId: string | null = null;
  const emit = (e: AskEvent) => {
    if (e.type === "start") conversationId = e.conversationId;
    if (e.type === "status") reply = ""; // keep only what Claude says after its last tool
    if (e.type === "text") reply += e.delta;
    if (e.type === "error") error = e.message;
  };
  try {
    await ask(deps, viewer, { text: editRequest(piece, open) }, emit);
  } catch (err) {
    error = err instanceof AccessError ? err.message : "Something went wrong talking to Claude. Try again in a moment.";
    console.error(`[edits] piece ${piece.id}: ${(err as Error).message}`);
  }
  try {
    await deps.db
      .update(pieceComments)
      .set({ status: error ? "open" : "done", conversationId })
      .where(inArray(pieceComments.id, open.map((c) => c.id)));
    await deps.db
      .update(pieces)
      .set({ editingStartedAt: null, editReply: error ? "" : reply.trim().slice(0, 2000), editError: error })
      .where(eq(pieces.id, piece.id));
  } catch (err) {
    console.error(`[edits] couldn't save the result for ${piece.id}: ${(err as Error).message}`);
  }
}

// Restores an earlier version. The current one is kept first, so going back
// can itself be undone. The post goes back to Suggested.
export async function restoreVersion(db: Db, viewer: Viewer, pieceId: string, versionId: number): Promise<void> {
  const brand = requirePermission(viewer, "use_tab");
  const piece = await getPieceRow(db, brand, pieceId);
  if (isEditing(piece)) throw new AccessError("Claude is still working on this post. Try again when it's done.", 409);
  const [v] = await db.select().from(pieceVersions).where(and(eq(pieceVersions.id, versionId), eq(pieceVersions.pieceId, piece.id)));
  if (!v) throw new AccessError("That version isn't here.", 404);
  const current = await snapshotOf(db, piece);
  await backToSuggested(db, piece);
  await db.insert(pieceVersions).values({ brandId: brand.id, pieceId: piece.id, snapshot: current, reason: "Before going back", createdBy: viewer.ctx.userId, createdByName: viewer.ctx.name });
  const s = v.snapshot;
  await db.update(pieces).set({ kind: s.kind, title: s.title, link: s.link, assetIds: s.assetIds, design: s.design, updatedAt: new Date() }).where(eq(pieces.id, piece.id));
  await db.delete(captions).where(eq(captions.pieceId, piece.id));
  const rows = Object.entries(s.captions).map(([channel, c]) => ({ pieceId: piece.id, channel, text: c.text, altText: c.altText, status: "draft" as const }));
  if (rows.length) await db.insert(captions).values(rows);
  await audit(db, viewer, "piece.restore_version", { pieceId, versionId });
}
