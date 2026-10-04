// Reading a shop's public store pages from the server. The owner types the
// address, so every request is checked: web addresses only, never this
// server's own network (private, loopback or cloud metadata addresses),
// a time limit, a size limit, and at most a few redirects, each re-checked.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Agent, fetch as undiciFetch } from "undici";

export type StoreFetch = (url: string, opts?: { accept?: string; maxBytes?: number }) => Promise<{ url: string; status: number; contentType: string; body: Buffer }>;

export class StoreReadError extends Error {}

const MAX_REDIRECTS = 4;
const TIMEOUT_MS = 15_000;
const USER_AGENT = "SocialStudio/1.0 (+https://boutiqly.com; reads public product pages for the shop's own social posts)";

function v4Private(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number) as [number, number];
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224 // multicast and reserved
  );
}

export function isPrivateAddress(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return v4Private(ip);
  if (kind === 6) {
    const s = ip.toLowerCase();
    const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return v4Private(mapped[1]!);
    return s === "::" || s === "::1" || s.startsWith("fc") || s.startsWith("fd") || s.startsWith("fe8") || s.startsWith("fe9") || s.startsWith("fea") || s.startsWith("feb") || s.startsWith("ff") || s.startsWith("64:ff9b");
  }
  return true;
}

// Turns what the owner typed ("makespace.com", "https://shop.example.com/products/x")
// into the store's home address.
export function storeOrigin(input: string): string {
  let s = input.trim();
  if (!s) throw new StoreReadError("Type your store's web address, like yourshop.com.");
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    throw new StoreReadError("That doesn't look like a web address. Try something like yourshop.com.");
  }
  if (u.username || u.password) throw new StoreReadError("Leave any login details out of the address.");
  const host = u.hostname.toLowerCase();
  if (!host.includes(".") || isIP(host.replace(/^\[|\]$/g, "")) || host.endsWith(".local") || host.endsWith(".internal") || host === "localhost") {
    throw new StoreReadError("Use your store's public web address, like yourshop.com.");
  }
  if (u.port && u.port !== "443" && u.port !== "80") throw new StoreReadError("Use your store's normal web address, without a port number.");
  return `https://${host}`;
}

function checkUrl(raw: string): URL {
  const u = new URL(raw);
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new StoreReadError("Only web addresses can be read.");
  if (u.username || u.password) throw new StoreReadError("Addresses with login details can't be read.");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && isPrivateAddress(host)) throw new StoreReadError("That address isn't a public website.");
  if (host === "localhost" || !host.includes(".")) throw new StoreReadError("That address isn't a public website.");
  return u;
}

// Every connection checks the address it is about to reach (so a name that
// resolves to a private address is refused at connect time too).
const guardedAgent = new Agent({
  connect: {
    lookup(hostname, options, cb) {
      lookup(hostname, { all: true })
        .then((addrs) => {
          const bad = addrs.find((a) => isPrivateAddress(a.address));
          if (bad || addrs.length === 0) return cb(new StoreReadError("That address isn't a public website."), "", 0);
          const wantAll = (options as { all?: boolean }).all;
          if (wantAll) return (cb as unknown as (e: null, a: { address: string; family: number }[]) => void)(null, addrs);
          cb(null, addrs[0]!.address, addrs[0]!.family);
        })
        .catch((err) => cb(err, "", 0));
    },
  },
  bodyTimeout: TIMEOUT_MS,
  headersTimeout: TIMEOUT_MS,
});

async function readCapped(body: ReadableStream<Uint8Array> | null, maxBytes: number): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  const chunks: Buffer[] = [];
  let total = 0;
  const reader = body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new StoreReadError("That page is too big to read.");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

export const safeStoreFetch: StoreFetch = async (start, opts = {}) => {
  let url = checkUrl(start);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await undiciFetch(url, {
      dispatcher: guardedAgent,
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": USER_AGENT, accept: opts.accept ?? "*/*" },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      await res.body?.cancel().catch(() => {});
      url = checkUrl(new URL(res.headers.get("location")!, url).toString());
      continue;
    }
    const body = await readCapped(res.body as ReadableStream<Uint8Array> | null, opts.maxBytes ?? 3_000_000);
    return { url: url.toString(), status: res.status, contentType: res.headers.get("content-type") ?? "", body };
  }
  throw new StoreReadError("The store sent us around in circles (too many redirects).");
};
