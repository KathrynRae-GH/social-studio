import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.ts";

export function createDb(databaseUrl: string) {
  // Render's internal database URL doesn't use TLS; its external one does.
  const ssl = /render\.com/.test(databaseUrl) ? { rejectUnauthorized: false } : undefined;
  const pool = new pg.Pool({ connectionString: databaseUrl, ssl, max: 10 });
  return { pool, db: drizzle(pool, { schema }) };
}

export type Db = ReturnType<typeof createDb>["db"];
