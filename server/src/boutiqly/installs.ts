// Boutiqly app installs: when the agency installs Social Studio for a
// sub-account, Boutiqly sends the browser to /oauth/callback with a one-time
// code. We swap it for an access token (about a day) and a refresh token,
// and store both encrypted.
import { eq } from "drizzle-orm";
import type { Db } from "../db/pool.ts";
import { installs } from "../db/schema.ts";
import { open, seal } from "../auth/secretBox.ts";
import type { Config } from "../config.ts";

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
  userType?: string;
  companyId?: string;
  locationId?: string;
}

type Fetch = typeof fetch;

async function requestToken(config: Config, params: Record<string, string>, fetchImpl: Fetch): Promise<TokenResponse> {
  const res = await fetchImpl(`${config.boutiqly.apiBase}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      client_id: config.boutiqly.clientId,
      client_secret: config.boutiqly.clientSecret,
      ...params,
    }),
  });
  if (!res.ok) throw new Error(`Boutiqly token request failed (${res.status})`);
  const data = (await res.json()) as TokenResponse;
  if (!data.access_token || !data.refresh_token) throw new Error("Boutiqly token response was incomplete");
  return data;
}

async function saveTokens(db: Db, config: Config, t: TokenResponse): Promise<string> {
  const resourceId = t.locationId || t.companyId;
  if (!resourceId) throw new Error("Boutiqly token response named no sub-account or agency");
  const row = {
    userType: t.userType ?? (t.locationId ? "Location" : "Company"),
    companyId: t.companyId ?? null,
    locationId: t.locationId ?? null,
    accessTokenEnc: seal(t.access_token, config.tokenEncryptionKey),
    refreshTokenEnc: seal(t.refresh_token, config.tokenEncryptionKey),
    expiresAt: new Date(Date.now() + t.expires_in * 1000),
    scope: t.scope ?? "",
    updatedAt: new Date(),
  };
  await db.insert(installs).values({ resourceId, ...row }).onConflictDoUpdate({ target: installs.resourceId, set: row });
  return resourceId;
}

export async function completeInstall(db: Db, config: Config, code: string, fetchImpl: Fetch = fetch): Promise<string> {
  const tokens = await requestToken(config, { grant_type: "authorization_code", code, user_type: "Location" }, fetchImpl);
  return saveTokens(db, config, tokens);
}

// A working access token for a sub-account, refreshed when it's within five
// minutes of expiring. Returns null when the app isn't installed there.
export async function accessTokenFor(db: Db, config: Config, resourceId: string, fetchImpl: Fetch = fetch): Promise<string | null> {
  const [row] = await db.select().from(installs).where(eq(installs.resourceId, resourceId));
  if (!row) return null;
  if (row.expiresAt.getTime() - Date.now() > 5 * 60 * 1000) return open(row.accessTokenEnc, config.tokenEncryptionKey);

  const tokens = await requestToken(
    config,
    { grant_type: "refresh_token", refresh_token: open(row.refreshTokenEnc, config.tokenEncryptionKey), user_type: row.userType },
    fetchImpl,
  );
  await saveTokens(db, config, { ...tokens, locationId: tokens.locationId ?? row.locationId ?? undefined, companyId: tokens.companyId ?? row.companyId ?? undefined });
  return tokens.access_token;
}

export async function isInstalled(db: Db, locationId: string): Promise<boolean> {
  const [row] = await db.select({ id: installs.resourceId }).from(installs).where(eq(installs.resourceId, locationId));
  return !!row;
}

// When Social Studio was installed for the whole agency rather than one
// sub-account, Boutiqly can hand out a sub-account token from the agency's.
// Those are kept in memory only and fetched again when they expire.
const derivedTokens = new Map<string, { token: string; expiresAt: number }>();

export async function locationAccessToken(
  db: Db,
  config: Config,
  locationId: string,
  companyId: string,
  fetchImpl: Fetch = fetch,
): Promise<string | null> {
  const direct = await accessTokenFor(db, config, locationId, fetchImpl);
  if (direct) return direct;

  const cached = derivedTokens.get(locationId);
  if (cached && cached.expiresAt - Date.now() > 5 * 60 * 1000) return cached.token;

  const agencyToken = await accessTokenFor(db, config, companyId, fetchImpl);
  if (!agencyToken) return null;
  const res = await fetchImpl(`${config.boutiqly.apiBase}/oauth/locationToken`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${agencyToken}`,
      version: "2021-07-28",
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: new URLSearchParams({ companyId, locationId }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;
  derivedTokens.set(locationId, { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 });
  return data.access_token;
}
