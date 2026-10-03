// Library, Calendar, Ideas and posting routes. Every route starts from the
// verified viewer, so it only ever touches the brand the tab is open in.
import type { FastifyInstance, FastifyRequest } from "fastify";
import multipart from "@fastify/multipart";
import { eq } from "drizzle-orm";
import type { Db } from "../db/pool.ts";
import { brands } from "../db/schema.ts";
import { AccessError, requirePermission, type Brand, type Viewer } from "../brands.ts";
import type { BoutiqlyClient } from "../boutiqly/api.ts";
import { addAsset, createPiece, deleteIdea, getPiece, listIdeas, listPieces, saveIdea, setCaption, updatePiece } from "../library.ts";
import {
  addEntries,
  approveEntry,
  sendDraft,
  brandTimezone,
  entryForPack,
  getCalendar,
  listAccounts,
  markPosted,
  moveEntry,
  removeEntry,
  setLivePosting,
  type CalendarDeps,
} from "../calendar.ts";
import { buildPack } from "../packs.ts";

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const MEDIA_FOLDER = "Social Studio";

interface Deps {
  db: Db;
  calendar: CalendarDeps;
  viewerFrom: (req: FastifyRequest) => Promise<Viewer>;
  clientFor: (brand: Brand) => BoutiqlyClient;
  fetchImpl: typeof fetch;
}

type Body = Record<string, unknown>;

export async function contentRoutes(app: FastifyInstance, deps: Deps) {
  const { db, calendar, viewerFrom, clientFor } = deps;
  await app.register(multipart, { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });

  // ---- Files ----
  app.post("/api/assets", async (req) => {
    const viewer = await viewerFrom(req);
    const brand = requirePermission(viewer, "use_tab");
    const file = await req.file();
    if (!file) throw new AccessError("Choose a file to upload.", 400);
    if (!/^(image|video)\//.test(file.mimetype)) throw new AccessError("Only photos and videos can be uploaded.", 400);
    const buffer = await file.toBuffer().catch(() => {
      throw new AccessError("That file is over 100 MB. Make it smaller and try again.", 413);
    });

    const client = clientFor(brand);
    let folderId = brand.mediaFolderId;
    if (!folderId) {
      folderId = await client.createFolder(MEDIA_FOLDER);
      await db.update(brands).set({ mediaFolderId: folderId }).where(eq(brands.id, brand.id));
    }
    const name = file.filename.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "upload";
    const uploaded = await client.uploadFile(new Blob([new Uint8Array(buffer)], { type: file.mimetype }), name, folderId);
    return {
      asset: await addAsset(db, viewer, {
        boutiqlyFileId: uploaded.fileId,
        url: uploaded.url,
        mime: file.mimetype,
        name,
        sizeBytes: buffer.length,
      }),
    };
  });

  // ---- Library ----
  app.get<{ Querystring: { archived?: string } }>("/api/pieces", async (req) => ({
    pieces: await listPieces(db, await viewerFrom(req), { archived: req.query.archived === "1" }),
  }));
  app.get<{ Params: { id: string } }>("/api/pieces/:id", async (req) => ({
    piece: await getPiece(db, await viewerFrom(req), req.params.id),
  }));
  app.post<{ Body: Body }>("/api/pieces", async (req) => ({
    piece: await createPiece(db, await viewerFrom(req), req.body ?? {}),
  }));
  app.patch<{ Params: { id: string }; Body: Body }>("/api/pieces/:id", async (req) => ({
    piece: await updatePiece(db, await viewerFrom(req), req.params.id, req.body ?? {}),
  }));
  app.put<{ Params: { id: string; channel: string }; Body: Body }>("/api/pieces/:id/captions/:channel", async (req) => ({
    piece: await setCaption(db, await viewerFrom(req), req.params.id, req.params.channel, req.body ?? {}),
  }));

  // ---- Calendar ----
  app.get<{ Querystring: { from?: string; to?: string } }>("/api/calendar", async (req) =>
    getCalendar(calendar, await viewerFrom(req), req.query),
  );
  app.post<{ Body: Body }>("/api/calendar", async (req) => ({
    entries: await addEntries(calendar, await viewerFrom(req), req.body ?? {}),
  }));
  app.patch<{ Params: { id: string }; Body: Body }>("/api/calendar/:id", async (req) => ({
    entry: await moveEntry(calendar, await viewerFrom(req), req.params.id, req.body ?? {}),
  }));
  app.delete<{ Params: { id: string } }>("/api/calendar/:id", async (req) => {
    await removeEntry(calendar, await viewerFrom(req), req.params.id);
    return { ok: true };
  });
  app.post<{ Params: { id: string } }>("/api/calendar/:id/approve", async (req) =>
    approveEntry(calendar, await viewerFrom(req), req.params.id),
  );
  app.post<{ Params: { id: string } }>("/api/calendar/:id/draft", async (req) =>
    sendDraft(calendar, await viewerFrom(req), req.params.id),
  );
  app.post<{ Params: { id: string } }>("/api/calendar/:id/posted", async (req) => ({
    entry: await markPosted(calendar, await viewerFrom(req), req.params.id),
  }));
  app.get<{ Params: { id: string } }>("/api/calendar/:id/pack", async (req, reply) => {
    const { brand, entry, piece, media, caption } = await entryForPack(calendar, await viewerFrom(req), req.params.id);
    const zip = await buildPack(
      {
        channelId: entry.channel,
        kind: piece.kind as never,
        title: piece.title,
        scheduledAt: entry.scheduledAt,
        timezone: brandTimezone(brand),
        caption: caption?.text ?? "",
        altText: caption?.altText ?? "",
        link: piece.link,
        files: [],
        media,
      },
      deps.fetchImpl,
    );
    return reply
      .type("application/zip")
      .header("content-disposition", `attachment; filename="social-studio-${entry.channel}-pack.zip"`)
      .send(Buffer.from(zip));
  });

  // ---- Accounts and posting switch ----
  app.get("/api/accounts", async (req) => ({ accounts: await listAccounts(calendar, await viewerFrom(req)) }));
  app.put<{ Body: { on?: unknown } }>("/api/settings/live-posting", async (req) => {
    if (typeof req.body?.on !== "boolean") throw new AccessError("Say on or off.", 400);
    await setLivePosting(calendar, await viewerFrom(req), req.body.on);
    return { livePosting: req.body.on };
  });

  // ---- Ideas ----
  app.get("/api/ideas", async (req) => ({ ideas: await listIdeas(db, await viewerFrom(req)) }));
  app.post<{ Body: Body }>("/api/ideas", async (req) => ({ idea: await saveIdea(db, await viewerFrom(req), null, req.body ?? {}) }));
  app.patch<{ Params: { id: string }; Body: Body }>("/api/ideas/:id", async (req) => ({
    idea: await saveIdea(db, await viewerFrom(req), req.params.id, req.body ?? {}),
  }));
  app.delete<{ Params: { id: string } }>("/api/ideas/:id", async (req) => {
    await deleteIdea(db, await viewerFrom(req), req.params.id);
    return { ok: true };
  });
}
