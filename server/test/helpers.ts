import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { loadConfig, type Config } from "../src/config.ts";
import { createDb } from "../src/db/pool.ts";
import { migrate } from "../src/db/migrate.ts";
import { buildApp } from "../src/app.ts";

export const TEST_SECRET = "test-shared-secret";

// Encrypts a user context the way Boutiqly does (OpenSSL "Salted__" AES-256-CBC
// with a passphrase), so tests and the local dev page can stand in for it.
export function encryptLikeBoutiqly(data: unknown, secret = TEST_SECRET): string {
  const salt = randomBytes(8);
  let derived = Buffer.alloc(0);
  let block = Buffer.alloc(0);
  while (derived.length < 48) {
    block = createHash("md5").update(Buffer.concat([block, Buffer.from(secret), salt])).digest();
    derived = Buffer.concat([derived, block]);
  }
  const cipher = createCipheriv("aes-256-cbc", derived.subarray(0, 32), derived.subarray(32, 48));
  const enc = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]);
  return Buffer.concat([Buffer.from("Salted__"), salt, enc]).toString("base64");
}

export const LOCATION = "loc_test_1";
export const COMPANY = "co_boutiqly";

export const people = {
  agency: { userId: "u_agency", companyId: COMPANY, type: "agency", role: "admin", userName: "Katy Agency", email: "katy@example.com", activeLocation: LOCATION },
  owner: { userId: "u_owner", companyId: COMPANY, type: "location", role: "admin", userName: "Olive Owner", email: "olive@example.com", activeLocation: LOCATION },
  staff: { userId: "u_staff", companyId: COMPANY, type: "location", role: "user", userName: "Sam Staff", email: "sam@example.com", activeLocation: LOCATION },
  other: { userId: "u_other", companyId: COMPANY, type: "location", role: "user", userName: "Otto Other", email: "otto@example.com", activeLocation: LOCATION },
};

export async function testApp(fetchImpl?: typeof fetch) {
  const config: Config = {
    ...loadConfig(),
    databaseUrl: process.env.TEST_DATABASE_URL ?? "postgres://localhost:5432/social_studio_test",
    boutiqly: { ...loadConfig().boutiqly, sharedSecret: TEST_SECRET, clientId: "cid", clientSecret: "csecret", apiBase: "https://api.test" },
  };
  const { pool, db } = createDb(config.databaseUrl);
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await migrate(pool, () => {});
  const app = buildApp({ config, db, pool, fetchImpl });
  await app.ready();
  return { app, pool, db, config };
}

export async function signInAs(app: Awaited<ReturnType<typeof testApp>>["app"], person: object) {
  const res = await app.inject({ method: "POST", url: "/api/session", payload: { payload: encryptLikeBoutiqly(person) } });
  if (res.statusCode !== 200) throw new Error(`sign in failed: ${res.body}`);
  const body = res.json();
  return { token: body.token as string, me: body.me, headers: { authorization: `Bearer ${body.token}` } };
}
