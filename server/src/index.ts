import { loadConfig } from "./config.ts";
import { createDb } from "./db/pool.ts";
import { migrate } from "./db/migrate.ts";
import { buildApp } from "./app.ts";

const config = loadConfig();
const { pool, db } = createDb(config.databaseUrl);
await migrate(pool);
const app = buildApp({ config, db, pool });
await app.listen({ port: config.port, host: "0.0.0.0" });
console.log(`Social Studio listening on ${config.port}`);
