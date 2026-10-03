// Boutiqly hands the tab an encrypted note saying who is looking. The tab
// passes it to us untouched; only the server holds the shared secret that
// unlocks it. Format: OpenSSL-compatible AES-256-CBC with a passphrase
// ("Salted__" + 8-byte salt + ciphertext, base64), the same format the
// platform's official app template decrypts.
import { createDecipheriv, createHash } from "node:crypto";

export interface UserContext {
  userId: string;
  companyId: string;
  locationId: string | null; // the sub-account the tab is open in
  isAgencyUser: boolean;
  platformRole: string; // the platform's own role, e.g. "admin" or "user"
  name: string;
  email: string;
}

export class UserContextError extends Error {}

function evpBytesToKey(passphrase: Buffer, salt: Buffer, keyLen: number, ivLen: number) {
  let derived = Buffer.alloc(0);
  let block = Buffer.alloc(0);
  while (derived.length < keyLen + ivLen) {
    block = createHash("md5").update(Buffer.concat([block, passphrase, salt])).digest();
    derived = Buffer.concat([derived, block]);
  }
  return { key: derived.subarray(0, keyLen), iv: derived.subarray(keyLen, keyLen + ivLen) };
}

export function decryptPayload(payload: string, sharedSecret: string): unknown {
  if (!sharedSecret) throw new UserContextError("Shared secret is not set");
  const raw = Buffer.from(payload, "base64");
  if (raw.length < 32 || raw.subarray(0, 8).toString("latin1") !== "Salted__") {
    throw new UserContextError("Not a recognized user context payload");
  }
  const { key, iv } = evpBytesToKey(Buffer.from(sharedSecret, "utf8"), raw.subarray(8, 16), 32, 16);
  try {
    const decipher = createDecipheriv("aes-256-cbc", key, iv);
    const plain = Buffer.concat([decipher.update(raw.subarray(16)), decipher.final()]);
    return JSON.parse(plain.toString("utf8"));
  } catch {
    throw new UserContextError("User context could not be decrypted");
  }
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

// Turns the decrypted note into the fields we use. Unknown or missing
// fields fail closed: no user id or agency id means no access.
export function parseUserContext(data: unknown): UserContext {
  if (!data || typeof data !== "object") throw new UserContextError("User context is empty");
  const d = data as Record<string, unknown>;
  const userId = str(d.userId);
  const companyId = str(d.companyId);
  if (!userId || !companyId) throw new UserContextError("User context is missing the user or agency");

  const type = str(d.type).toLowerCase();
  const name = str(d.userName) || [str(d.firstName), str(d.lastName)].filter(Boolean).join(" ");
  return {
    userId,
    companyId,
    locationId: str(d.activeLocation) || str(d.locationId) || null,
    isAgencyUser: type === "agency",
    platformRole: str(d.role).toLowerCase(),
    name: name || str(d.email) || "Unknown user",
    email: str(d.email),
  };
}

export function decryptUserContext(payload: string, sharedSecret: string): UserContext {
  return parseUserContext(decryptPayload(payload, sharedSecret));
}
