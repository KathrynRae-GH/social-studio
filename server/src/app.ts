import Fastify, { type FastifyRequest } from "fastify";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type pg from "pg";
import type { Config } from "./config.ts";
import { missingSettings } from "./config.ts";
import type { Db } from "./db/pool.ts";
import { UserContextError, decryptPayload, parseUserContext } from "./auth/userContext.ts";
import { createSessionToken, verifySessionToken, SESSION_TTL_SECONDS } from "./auth/session.ts";
import {
  AccessError,
  describeViewer,
  hasRequestedAccess,
  listTeam,
  loadViewer,
  removeFromTeam,
  requestAccess,
  setTeamRole,
  type Viewer,
} from "./brands.ts";
import { completeInstall } from "./boutiqly/installs.ts";
import { healthReport, healthPage } from "./health.ts";

export interface AppDeps {
  config: Config;
  db: Db;
  pool: pg.Pool;
  fetchImpl?: typeof fetch;
}

const WEB_DIST = fileURLToPath(new URL("../../web/dist", import.meta.url));

export function buildApp({ config, db, pool, fetchImpl = fetch }: AppDeps) {
  const app = Fastify({
    // Logs never carry the login pass or query strings (install codes travel in them).
    logger: config.production
      ? {
          level: "info",
          serializers: {
            req: (req) => ({ method: req.method, url: req.url.split("?")[0], remoteAddress: req.ip }),
          },
        }
      : false,
    trustProxy: true,
    bodyLimit: 1_000_000,
  });

  // The tab is shown inside Boutiqly in a frame; only Boutiqly may frame it.
  app.addHook("onSend", async (_req, reply) => {
    reply.header("Content-Security-Policy", `frame-ancestors 'self' ${config.frameAncestors.join(" ")}`);
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AccessError) return reply.code(err.statusCode).send({ error: err.message });
    if (err instanceof UserContextError) return reply.code(401).send({ error: "We couldn't confirm who you are. Reload the page in Boutiqly." });
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status < 500) return reply.code(status).send({ error: (err as Error).message });
    req.log.error(err);
    return reply.code(500).send({ error: "Something went wrong on our side. Try again in a minute." });
  });

  async function viewerFrom(req: FastifyRequest): Promise<Viewer> {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const ctx = token ? verifySessionToken(token, config.sessionSigningKey) : null;
    if (!ctx) throw new AccessError("Your session ended. Reload the page in Boutiqly.", 401);
    return loadViewer(db, ctx);
  }

  // ---- Health ----
  app.get("/health", async (req, reply) => {
    const report = await healthReport(pool, missingSettings(config));
    reply.code(report.ok ? 200 : 503);
    if ((req.headers.accept ?? "").includes("text/html")) return reply.type("text/html").send(healthPage(report));
    return report;
  });

  // ---- Sign in from Boutiqly's user context ----
  app.post<{ Body: { payload?: string } }>("/api/session", async (req) => {
    const payload = req.body?.payload;
    if (typeof payload !== "string" || payload.length > 20_000) throw new UserContextError("Missing payload");
    const raw = decryptPayload(payload, config.boutiqly.sharedSecret);
    let ctx;
    try {
      ctx = parseUserContext(raw);
    } catch (err) {
      // Field names only, never values: tells us if Boutiqly's format differs.
      req.log.warn({ fields: raw && typeof raw === "object" ? Object.keys(raw) : typeof raw }, "Unexpected user context shape");
      throw err;
    }
    const viewer = await loadViewer(db, ctx);
    return {
      token: createSessionToken(ctx, config.sessionSigningKey),
      expiresIn: SESSION_TTL_SECONDS,
      me: await describeViewer(db, viewer),
      requested: await hasRequestedAccess(db, viewer),
    };
  });

  app.get("/api/me", async (req) => {
    const viewer = await viewerFrom(req);
    return { me: await describeViewer(db, viewer), requested: await hasRequestedAccess(db, viewer) };
  });

  app.post("/api/access-requests", async (req) => {
    const viewer = await viewerFrom(req);
    await requestAccess(db, viewer);
    return { ok: true };
  });

  // ---- Team list ----
  app.get("/api/team", async (req) => ({ team: await listTeam(db, await viewerFrom(req)) }));

  app.put<{ Params: { userId: string }; Body: { role?: string } }>("/api/team/:userId", async (req) => {
    const role = req.body?.role;
    if (role !== "owner" && role !== "team") throw new AccessError("Role must be owner or team.", 400);
    const viewer = await viewerFrom(req);
    await setTeamRole(db, viewer, req.params.userId, role);
    return { team: await listTeam(db, viewer) };
  });

  app.delete<{ Params: { userId: string } }>("/api/team/:userId", async (req) => {
    const viewer = await viewerFrom(req);
    await removeFromTeam(db, viewer, req.params.userId);
    return { team: await listTeam(db, viewer) };
  });

  // ---- App install (OAuth) ----
  app.get<{ Querystring: { code?: string } }>("/oauth/callback", async (req, reply) => {
    const code = req.query.code;
    if (!code) return reply.code(400).type("text/html").send(simplePage("Install didn't finish", "Boutiqly didn't send an install code. Try installing Social Studio again."));
    try {
      const resourceId = await completeInstall(db, config, code, fetchImpl);
      req.log.info({ resourceId }, "Social Studio installed");
      return reply.type("text/html").send(simplePage("Social Studio is installed", "You can close this tab and open Social Studio from the sub-account's menu."));
    } catch (err) {
      req.log.error(err, "Install failed");
      return reply.code(502).type("text/html").send(simplePage("Install didn't finish", "Boutiqly didn't accept the install. Check the app's Client ID and Client Secret in Render, then try again."));
    }
  });

  // ---- The tab itself ----
  if (existsSync(WEB_DIST)) {
    app.register(fastifyStatic, { root: WEB_DIST, index: ["index.html"] });
    app.setNotFoundHandler((req, reply) => {
      if (req.method === "GET" && !req.url.startsWith("/api/")) return reply.sendFile("index.html");
      return reply.code(404).send({ error: "Not found" });
    });
  }

  return app;
}

function simplePage(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>body{font-family:Montserrat,system-ui,sans-serif;background:#fbf8f3;color:#1d3c34;margin:0;padding:48px 16px}
main{max-width:520px;margin:auto;background:#fff;border:1px solid #e8eeeb;border-radius:12px;padding:24px}p{color:#5b6f69}</style></head>
<body><main><h1>${title}</h1><p>${body}</p></main></body></html>`;
}
