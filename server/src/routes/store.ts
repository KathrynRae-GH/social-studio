// The shop's online store: connect by address, refresh, disconnect.
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Viewer } from "../brands.ts";
import { connectStore, disconnectStore, getStore, refreshStore, type StoreDeps } from "../store/sync.ts";

interface Deps {
  store: StoreDeps;
  viewerFrom: (req: FastifyRequest) => Promise<Viewer>;
}

export async function storeRoutes(app: FastifyInstance, deps: Deps) {
  const { viewerFrom } = deps;
  const db = deps.store.db;
  app.get("/api/store", async (req) => ({ store: await getStore(db, await viewerFrom(req)) }));
  app.put<{ Body: { url?: unknown } }>("/api/store", async (req) => ({ store: await connectStore(deps.store, await viewerFrom(req), req.body?.url) }));
  app.post("/api/store/refresh", async (req) => ({ store: await refreshStore(deps.store, await viewerFrom(req)) }));
  app.delete("/api/store", async (req) => {
    await disconnectStore(db, await viewerFrom(req));
    return { store: null };
  });
}
