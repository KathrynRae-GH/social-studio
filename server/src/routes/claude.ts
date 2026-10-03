// Claude in the tab: the spend switch, the shop's look, the Assets screen,
// Ask Claude and its proposals. Every route starts from the verified viewer.
import type { FastifyInstance, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import type { Db } from "../db/pool.ts";
import { brands } from "../db/schema.ts";
import { AccessError, audit, requirePermission, type Brand, type Viewer } from "../brands.ts";
import { claudeSettings, type ClaudeDeps } from "../claude/client.ts";
import { ask, decideProposal, getConversation, listConversations, type AskDeps } from "../claude/ask.ts";
import { approveStyleSet, getStyleSet, saveStyleSet } from "../styles.ts";
import { finishBlur, listAssetDetails, startBlur, tagAsset, updateAssetRules } from "../assets.ts";
import { finishRender } from "../render.ts";
import multipart from "@fastify/multipart";
import { MAX_FONT_BYTES, deleteFont, fontFile, listFonts, uploadFont } from "../fonts.ts";
import { getPiece } from "../library.ts";
import type { AskEvent } from "../../../shared/ask.ts";

interface Deps {
  db: Db;
  ask: AskDeps;
  fetchImpl: typeof fetch;
  viewerFrom: (req: FastifyRequest) => Promise<Viewer>;
}

type Body = Record<string, unknown>;

// Tags a new upload in the background when Claude is on for the shop.
export function autoTagger(deps: ClaudeDeps & { fetchImpl: typeof fetch }) {
  return (viewer: Viewer, brand: Brand, assetId: string, mime: string) => {
    if (!brand.claudeEnabled || !mime.startsWith("image/")) return;
    tagAsset(deps, viewer, assetId).catch((err) => console.warn(`[tag] ${assetId}: ${(err as Error).message}`));
  };
}

export async function claudeRoutes(app: FastifyInstance, deps: Deps) {
  const { db, viewerFrom } = deps;

  // ---- Claude on/off and the monthly limit ----
  app.get("/api/claude/status", async (req) => {
    const viewer = await viewerFrom(req);
    return claudeSettings(deps.ask, requirePermission(viewer, "use_tab"));
  });
  app.put<{ Body: Body }>("/api/settings/claude", async (req) => {
    const viewer = await viewerFrom(req);
    const brand = requirePermission(viewer, "manage_brand");
    if (viewer.role !== "boutiqly_team") throw new AccessError("Only Boutiqly's team can turn Claude on or off, or change the limit.");
    const changes: Partial<typeof brands.$inferInsert> = {};
    if (req.body?.enabled !== undefined) changes.claudeEnabled = !!req.body.enabled;
    if (req.body?.capCents !== undefined) {
      const cap = Number(req.body.capCents);
      if (!Number.isInteger(cap) || cap < 0 || cap > 1_000_000) throw new AccessError("Set the limit in whole cents, from 0 to $10,000.", 400);
      changes.claudeCapCents = cap;
    }
    if (Object.keys(changes).length) {
      await db.update(brands).set(changes).where(eq(brands.id, brand.id));
      await audit(db, viewer, "claude.settings", changes);
    }
    return claudeSettings(deps.ask, brand);
  });

  // ---- The shop's look ----
  app.get("/api/style", async (req) => ({ style: await getStyleSet(db, await viewerFrom(req)) }));
  app.put<{ Body: Body }>("/api/style", async (req) => ({ style: await saveStyleSet(db, await viewerFrom(req), req.body ?? {}) }));
  app.post("/api/style/approve", async (req) => ({ style: await approveStyleSet(db, await viewerFrom(req)) }));

  // ---- Uploaded fonts ----
  await app.register(multipart, { limits: { fileSize: MAX_FONT_BYTES + 1, files: 1, fields: 5 } });
  app.get("/api/fonts", async (req) => ({ fonts: await listFonts(db, await viewerFrom(req)) }));
  app.post("/api/fonts", async (req) => {
    const viewer = await viewerFrom(req);
    requirePermission(viewer, "manage_brand");
    const file = await req.file();
    if (!file) throw new AccessError("Choose a font file to upload.", 400);
    const bytes = await file.toBuffer().catch(() => {
      throw new AccessError("That font file is over 5 MB.", 413);
    });
    const field = (name: string) => {
      const f = file.fields[name] as { value?: unknown } | undefined;
      return f && "value" in f ? f.value : undefined;
    };
    return { font: await uploadFont(db, deps.ask.pool, viewer, { bytes: new Uint8Array(bytes), fileName: file.filename, family: field("family"), weight: field("weight"), italic: field("italic") }) };
  });
  app.delete<{ Params: { id: string } }>("/api/fonts/:id", async (req) => {
    await deleteFont(db, await viewerFrom(req), req.params.id);
    return { ok: true };
  });
  app.get<{ Params: { id: string } }>("/api/fonts/:id/file", async (req, reply) => {
    const f = await fontFile(deps.ask.pool, await viewerFrom(req), req.params.id);
    return reply.type(f.mime).header("cache-control", "private, max-age=3600").send(f.data);
  });

  // ---- Assets ----
  app.get("/api/assets", async (req) => ({ assets: await listAssetDetails(db, await viewerFrom(req)) }));
  app.patch<{ Params: { id: string }; Body: Body }>("/api/assets/:id", async (req) => ({
    asset: await updateAssetRules(db, await viewerFrom(req), req.params.id, req.body ?? {}),
  }));
  app.post<{ Params: { id: string } }>("/api/assets/:id/tag", async (req) => ({
    asset: await tagAsset({ ...deps.ask, fetchImpl: deps.fetchImpl }, await viewerFrom(req), req.params.id),
  }));
  app.post<{ Params: { id: string } }>("/api/assets/:id/blur", async (req) => startBlur(deps.ask.render, await viewerFrom(req), req.params.id));
  app.get<{ Params: { id: string; jobId: string } }>("/api/assets/:id/blur/:jobId", async (req) =>
    finishBlur(deps.ask.render, await viewerFrom(req), req.params.id, req.params.jobId),
  );

  // A piece whose render may still be finishing.
  app.post<{ Params: { id: string } }>("/api/pieces/:id/render", async (req) => {
    const viewer = await viewerFrom(req);
    const brand = requirePermission(viewer, "use_tab");
    const state = await finishRender(deps.ask.render, brand, req.params.id, viewer.ctx.userId);
    return { state, piece: await getPiece(db, viewer, req.params.id) };
  });

  // ---- Ask Claude ----
  app.get("/api/conversations", async (req) => ({ conversations: await listConversations(db, await viewerFrom(req)) }));
  app.get<{ Params: { id: string } }>("/api/conversations/:id", async (req) => ({
    conversation: await getConversation(db, await viewerFrom(req), req.params.id),
  }));

  // Streams the reply as one JSON event per line.
  app.post<{ Body: Body }>("/api/ask", async (req, reply) => {
    const viewer = await viewerFrom(req);
    requirePermission(viewer, "use_tab");
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!text) throw new AccessError("Type a message first.", 400);
    reply.hijack();
    reply.raw.writeHead(200, {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    });
    const emit = (e: AskEvent) => {
      if (!reply.raw.writableEnded) reply.raw.write(`${JSON.stringify(e)}\n`);
    };
    try {
      await ask(deps.ask, viewer, req.body ?? {}, emit);
    } catch (err) {
      emit({ type: "error", message: err instanceof AccessError ? err.message : "Something went wrong. Try again in a moment." });
      if (!(err instanceof AccessError)) req.log.error(err);
    } finally {
      reply.raw.end();
    }
  });

  app.post<{ Params: { id: string; decision: string } }>("/api/proposals/:id/:decision", async (req) => {
    const decision = req.params.decision;
    if (decision !== "apply" && decision !== "dismiss") throw new AccessError("Apply or dismiss.", 400);
    return { proposal: await decideProposal(deps.ask, await viewerFrom(req), req.params.id, decision) };
  });
}
