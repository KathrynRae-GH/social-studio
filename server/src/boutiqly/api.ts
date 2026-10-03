// Reading from Boutiqly's API for one sub-account. Every call uses that
// sub-account's own install token, so it can only ever see that shop.
import type { Db } from "../db/pool.ts";
import type { Config } from "../config.ts";
import { locationAccessToken } from "./installs.ts";

export class NotInstalledError extends Error {}

type Fetch = typeof fetch;

async function get<T>(db: Db, config: Config, locationId: string, companyId: string, path: string, fetchImpl: Fetch): Promise<T> {
  const token = await locationAccessToken(db, config, locationId, companyId, fetchImpl);
  if (!token) throw new NotInstalledError("Social Studio isn't installed in this sub-account yet.");
  const res = await fetchImpl(`${config.boutiqly.apiBase}${path}`, {
    headers: { authorization: `Bearer ${token}`, version: "2021-07-28", accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Boutiqly request failed (${res.status})`);
  return (await res.json()) as T;
}

export interface BoutiqlyUser {
  id: string;
  name: string;
  email: string;
  isAgency: boolean;
}

interface RawUser {
  id?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  deleted?: boolean;
  roles?: { type?: string; locationIds?: string[] };
}

// Everyone with a login to this sub-account, as Boutiqly lists them.
export async function listLocationUsers(
  db: Db,
  config: Config,
  locationId: string,
  companyId: string,
  fetchImpl: Fetch = fetch,
): Promise<BoutiqlyUser[]> {
  const data = await get<{ users?: RawUser[] }>(
    db, config, locationId, companyId, `/users/?locationId=${encodeURIComponent(locationId)}`, fetchImpl,
  );
  return (data.users ?? [])
    .filter((u) => u.id && !u.deleted)
    .map((u) => ({
      id: u.id!,
      name: (u.name || [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || "Unnamed user").trim(),
      email: u.email ?? "",
      isAgency: (u.roles?.type ?? "").toLowerCase() === "agency",
    }));
}

export async function getLocationName(
  db: Db,
  config: Config,
  locationId: string,
  companyId: string,
  fetchImpl: Fetch = fetch,
): Promise<string | null> {
  const data = await get<{ location?: { name?: string } }>(
    db, config, locationId, companyId, `/locations/${encodeURIComponent(locationId)}`, fetchImpl,
  );
  return data.location?.name?.trim() || null;
}
