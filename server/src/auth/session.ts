// The tab's login pass. Browsers block cookies inside an embedded page, so
// after verifying Boutiqly's user context we give the page a short-lived
// signed token that it sends back as "Authorization: Bearer <token>".
// The token only carries what Boutiqly told us; roles are looked up fresh
// from the database on every request.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { UserContext } from "./userContext.ts";

export const SESSION_TTL_SECONDS = 60 * 60; // one hour; the tab quietly asks Boutiqly again after that

interface SessionBody extends UserContext {
  exp: number; // seconds since epoch
}

function sign(data: string, key: string): string {
  return createHmac("sha256", key).update(data).digest("base64url");
}

export function createSessionToken(ctx: UserContext, key: string, now = Date.now()): string {
  const body: SessionBody = { ...ctx, exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS };
  const data = Buffer.from(JSON.stringify(body)).toString("base64url");
  return `${data}.${sign(data, key)}`;
}

export function verifySessionToken(token: string, key: string, now = Date.now()): UserContext | null {
  const [data, sig, extra] = token.split(".");
  if (!data || !sig || extra !== undefined) return null;
  const expected = Buffer.from(sign(data, key));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { exp, ...ctx } = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as SessionBody;
    if (typeof exp !== "number" || exp * 1000 <= now) return null;
    return ctx;
  } catch {
    return null;
  }
}
