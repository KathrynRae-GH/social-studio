import { loadConfig } from "./config.ts";
import { createDb } from "./db/pool.ts";
import { migrate } from "./db/migrate.ts";
import { buildApp } from "./app.ts";
import { activeAskRuns } from "./claude/ask.ts";

// If the server ever stops, say why in the logs.
process.on("uncaughtException", (err) => {
  console.error("Server crashed:", err);
  process.exit(1);
});
process.on("unhandledRejection", (err) => {
  console.error("Server crashed (unhandled promise):", err);
  process.exit(1);
});

const config = loadConfig();
console.log(`Starting Social Studio on Node ${process.version}, port ${config.port}`);
const { pool, db } = createDb(config.databaseUrl);
// A dropped idle database connection shouldn't take the server down.
pool.on("error", (err) => console.error("Database connection error:", err.message));
await migrate(pool);
const app = buildApp({ config, db, pool, background: true });
await app.listen({ port: config.port, host: "0.0.0.0" });
console.log(`Social Studio listening on ${config.port}`);

// When Render replaces this copy of the app (an update), new visitors already
// go to the new copy. Let replies Claude is still writing here finish first,
// for up to 4.5 minutes (Render waits up to maxShutdownDelaySeconds).
const SHUTDOWN_WAIT_MS = 270_000;
async function letRepliesFinish() {
  const until = Date.now() + SHUTDOWN_WAIT_MS;
  while (activeAskRuns() > 0 && Date.now() < until) {
    console.log(`Waiting for ${activeAskRuns()} Claude repl${activeAskRuns() === 1 ? "y" : "ies"} to finish before shutting down`);
    await new Promise((r) => setTimeout(r, 5000));
  }
}

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, async () => {
    console.log(`Received ${signal}, shutting down`);
    await letRepliesFinish();
    await app.close().catch(() => {});
    await pool.end().catch(() => {});
    process.exit(0);
  });
}
