// Encrypts Boutiqly OAuth tokens before they're stored (AES-256-GCM).
// The key comes from TOKEN_ENCRYPTION_KEY; any long random string works,
// it's hashed to 32 bytes.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function keyFrom(secret: string): Buffer {
  return createHash("sha256").update(secret, "utf8").digest();
}

export function seal(plain: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(secret), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), enc.toString("base64url")].join(".");
}

export function open(sealed: string, secret: string): string {
  const [version, iv, tag, enc] = sealed.split(".");
  if (version !== "v1" || !iv || !tag || !enc) throw new Error("Unrecognized sealed value");
  const decipher = createDecipheriv("aes-256-gcm", keyFrom(secret), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(enc, "base64url")), decipher.final()]).toString("utf8");
}
