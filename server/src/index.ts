import { loadConfig } from "./config.ts";
import { createDb } from "./db/pool.ts";
import { migrate } from "./db/migrate.ts";
import { buildApp } from "./app.ts";

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
const app = buildApp({ config, db, pool });
await app.listen({ port: config.port, host: "0.0.0.0" });
console.log(`Social Studio listening on ${config.port}`);

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, async () => {
    console.log(`Received ${signal}, shutting down`);
    await app.close().catch(() => {});
    await pool.end().catch(() => {});
    process.exit(0);
  });
}
