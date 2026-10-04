// Reads a shop's public product list. Shopify stores publish theirs as
// /products.json. Other stores (Square Online, Squarespace, Wix,
// WooCommerce...) are read through their sitemap and the product details
// each product page carries for search engines. Prices are never kept:
// the owner decided posts don't mention prices.
import { StoreReadError, type StoreFetch } from "./net.ts";

export interface StoreProduct {
  externalId: string;
  title: string;
  url: string;
  description: string;
  productType: string;
  tags: string[];
  imageUrl: string | null;
  available: boolean | null;
  publishedAt: Date | null;
  pageLastmod: string | null;
}

export interface StoreRead {
  platform: "shopify" | "other";
  products: StoreProduct[];
  // Other stores: product pages we already know and didn't re-read this time.
  unchanged: string[];
}

const MAX_PRODUCTS = 1000;
const SHOPIFY_PAGES = 4; // 250 each
const MAX_PAGES_PER_READ = 150; // product pages read per refresh (other stores)
const MAX_CHILD_SITEMAPS = 6;
const PAGE_CONCURRENCY = 4;

export function plainText(html: string, max = 800): string {
  return decodeEntities(html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<br\s*\/?>|<\/p>|<\/li>/gi, "\n").replace(/<[^>]+>/g, " "))
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim()
    .slice(0, max);
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function date(v: unknown): Date | null {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function httpsUrl(v: unknown, base: string): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  try {
    const u = new URL(v.trim().startsWith("//") ? `https:${v.trim()}` : v.trim(), base);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

// ---- Shopify ----

interface ShopifyProduct {
  id: number | string;
  title?: string;
  handle?: string;
  body_html?: string;
  product_type?: string;
  tags?: string | string[];
  published_at?: string;
  created_at?: string;
  variants?: { available?: boolean }[];
  images?: { src?: string }[];
}

export function parseShopify(origin: string, items: ShopifyProduct[]): StoreProduct[] {
  return items
    .filter((p) => p && p.id != null && p.title && p.handle)
    .map((p) => ({
      externalId: `shopify:${p.id}`,
      title: String(p.title).slice(0, 300),
      url: `${origin}/products/${encodeURIComponent(String(p.handle))}`,
      description: plainText(p.body_html ?? ""),
      productType: String(p.product_type ?? "").slice(0, 100),
      tags: (Array.isArray(p.tags) ? p.tags : String(p.tags ?? "").split(","))
        .map((t) => String(t).trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 20),
      imageUrl: httpsUrl(p.images?.[0]?.src, origin),
      available: Array.isArray(p.variants) && p.variants.length ? p.variants.some((v) => v.available !== false) : null,
      publishedAt: date(p.published_at) ?? date(p.created_at),
      pageLastmod: null,
    }));
}

async function tryShopify(origin: string, get: StoreFetch): Promise<StoreProduct[] | null> {
  const all: ShopifyProduct[] = [];
  for (let page = 1; page <= SHOPIFY_PAGES; page++) {
    let res;
    try {
      res = await get(`${origin}/products.json?limit=250&page=${page}`, { accept: "application/json", maxBytes: 12_000_000 });
    } catch (err) {
      if (page === 1) return null;
      throw err;
    }
    if (res.status !== 200) return page === 1 ? null : parseShopify(origin, all);
    let data: { products?: ShopifyProduct[] };
    try {
      data = JSON.parse(res.body.toString("utf8"));
    } catch {
      return page === 1 ? null : parseShopify(origin, all);
    }
    if (!Array.isArray(data.products)) return page === 1 ? null : parseShopify(origin, all);
    all.push(...data.products);
    if (data.products.length < 250 || all.length >= MAX_PRODUCTS) break;
  }
  return parseShopify(origin, all.slice(0, MAX_PRODUCTS));
}

// ---- Other stores: sitemap + product pages ----

export function sitemapEntries(xml: string): { loc: string; lastmod: string | null }[] {
  const out: { loc: string; lastmod: string | null }[] = [];
  for (const m of xml.matchAll(/<(?:url|sitemap)>([\s\S]*?)<\/(?:url|sitemap)>/gi)) {
    const loc = m[1]!.match(/<loc>\s*(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?\s*<\/loc>/i)?.[1];
    if (!loc) continue;
    const lastmod = m[1]!.match(/<lastmod>\s*([^<]+?)\s*<\/lastmod>/i)?.[1] ?? null;
    out.push({ loc: decodeEntities(loc.trim()), lastmod });
  }
  return out;
}

const isIndex = (xml: string) => /<sitemapindex[\s>]/i.test(xml);

// Product page addresses on the common store builders.
export function looksLikeProductPage(url: string): boolean {
  try {
    const p = new URL(url).pathname.toLowerCase();
    return /\/(product|products|shop\/p|store\/p|product-page)\/[^/]+/.test(p) && !/\/(category|categories|collections?|tag)\//.test(p);
  } catch {
    return false;
  }
}

interface LdNode {
  "@type"?: string | string[];
  "@graph"?: LdNode[];
  name?: string;
  description?: string;
  image?: unknown;
  url?: string;
  sku?: string;
  productID?: string;
  category?: string;
  offers?: unknown;
  hasVariant?: LdNode[];
  [k: string]: unknown;
}

function findProduct(node: unknown): LdNode | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const f = findProduct(n);
      if (f) return f;
    }
    return null;
  }
  const n = node as LdNode;
  const types = ([] as string[]).concat(n["@type"] ?? []).map((t) => String(t).toLowerCase());
  if (types.includes("product") || types.includes("productgroup")) return n;
  if (n["@graph"]) return findProduct(n["@graph"]);
  return null;
}

function firstImage(v: unknown): unknown {
  if (Array.isArray(v)) return firstImage(v[0]);
  if (v && typeof v === "object") return (v as { url?: unknown; contentUrl?: unknown }).url ?? (v as { contentUrl?: unknown }).contentUrl;
  return v;
}

function availability(offers: unknown): boolean | null {
  const list = ([] as unknown[]).concat(offers ?? []);
  const states = list
    .flatMap((o) => (o && typeof o === "object" ? ([] as unknown[]).concat((o as { offers?: unknown }).offers ?? o) : []))
    .map((o) => String((o as { availability?: unknown }).availability ?? ""))
    .filter(Boolean);
  if (!states.length) return null;
  return states.some((s) => /instock|in_stock|preorder|limitedavailability/i.test(s));
}

function meta(html: string, prop: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
  return content ? decodeEntities(content) : null;
}

// One product page → a product, from its search-engine details (JSON-LD),
// or its sharing details (Open Graph) when that's all it has.
export function parseProductPage(pageUrl: string, html: string, lastmod: string | null): StoreProduct | null {
  let product: LdNode | null = null;
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      product = findProduct(JSON.parse(m[1]!.trim()));
    } catch {
      continue;
    }
    if (product) break;
  }
  const canonical = httpsUrl(html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1], pageUrl);
  const ogType = meta(html, "og:type") ?? "";
  if (!product && !/product/i.test(ogType) && !looksLikeProductPage(pageUrl)) return null;
  const title = (product?.name ?? meta(html, "og:title") ?? "").toString().trim();
  if (!title) return null;
  const url = canonical ?? httpsUrl(product?.url, pageUrl) ?? pageUrl;
  return {
    externalId: `page:${new URL(url).pathname}`,
    title: plainText(title, 300),
    url,
    description: plainText(String(product?.description ?? meta(html, "og:description") ?? "")),
    productType: String(product?.category ?? "").slice(0, 100),
    tags: [],
    imageUrl: httpsUrl(firstImage(product?.image ?? (product?.hasVariant?.[0]?.image)), pageUrl) ?? httpsUrl(meta(html, "og:image"), pageUrl),
    available: product ? availability(product.offers ?? product.hasVariant?.map((v) => v.offers)) : null,
    publishedAt: null,
    pageLastmod: lastmod,
  };
}

async function readSitemap(origin: string, get: StoreFetch): Promise<{ loc: string; lastmod: string | null }[]> {
  const starts = new Set<string>([`${origin}/sitemap.xml`]);
  try {
    const robots = await get(`${origin}/robots.txt`, { accept: "text/plain", maxBytes: 200_000 });
    if (robots.status === 200) {
      for (const m of robots.body.toString("utf8").matchAll(/^\s*sitemap:\s*(\S+)/gim)) {
        const u = httpsUrl(m[1], origin);
        if (u && new URL(u).hostname === new URL(origin).hostname) starts.add(u);
      }
    }
  } catch {
    /* no robots.txt is fine */
  }
  const pages = new Map<string, string | null>();
  const queue = [...starts];
  let childrenRead = 0;
  const seen = new Set<string>();
  while (queue.length && childrenRead <= MAX_CHILD_SITEMAPS) {
    const next = queue.shift()!;
    if (seen.has(next)) continue;
    seen.add(next);
    let res;
    try {
      res = await get(next, { accept: "application/xml,text/xml", maxBytes: 8_000_000 });
    } catch {
      continue;
    }
    if (res.status !== 200) continue;
    childrenRead++;
    const xml = res.body.toString("utf8");
    const entries = sitemapEntries(xml);
    if (isIndex(xml)) {
      // Product sitemaps first.
      const sorted = entries.map((e) => e.loc).sort((a, b) => Number(/product/i.test(b)) - Number(/product/i.test(a)));
      for (const loc of sorted) if (new URL(loc, origin).hostname === new URL(origin).hostname) queue.push(loc);
      continue;
    }
    const productSitemap = /product/i.test(next);
    for (const e of entries) {
      if (new URL(e.loc, origin).hostname !== new URL(origin).hostname) continue;
      if (productSitemap || looksLikeProductPage(e.loc)) pages.set(e.loc, e.lastmod);
    }
  }
  return [...pages].map(([loc, lastmod]) => ({ loc, lastmod })).slice(0, MAX_PRODUCTS);
}

// known: product page address → the sitemap date when we last read it.
async function readOther(origin: string, get: StoreFetch, known: Map<string, string | null>): Promise<StoreRead> {
  const pages = await readSitemap(origin, get);
  if (pages.length === 0) {
    throw new StoreReadError("We couldn't find a product list on that site. Check the address is your online store (for a Square store, the address your customers shop at).");
  }
  // New pages first, then pages that changed; unchanged pages are skipped.
  const fresh = pages.filter((p) => !known.has(p.loc));
  const changed = pages.filter((p) => known.has(p.loc) && p.lastmod && known.get(p.loc) !== p.lastmod);
  const toRead = [...fresh, ...changed].slice(0, MAX_PAGES_PER_READ);
  const reading = new Set(toRead.map((p) => p.loc));
  const unchanged = pages.filter((p) => !reading.has(p.loc) && known.has(p.loc)).map((p) => p.loc);
  const products: StoreProduct[] = [];
  for (let i = 0; i < toRead.length; i += PAGE_CONCURRENCY) {
    const batch = await Promise.allSettled(
      toRead.slice(i, i + PAGE_CONCURRENCY).map(async (p) => {
        const res = await get(p.loc, { accept: "text/html", maxBytes: 3_000_000 });
        if (res.status !== 200 || !/html/i.test(res.contentType)) return null;
        const found = parseProductPage(p.loc, res.body.toString("utf8"), p.lastmod);
        // Keep the sitemap address as the key so the next refresh can match it.
        return found ? { ...found, externalId: `page:${p.loc}` } : null;
      }),
    );
    for (const r of batch) if (r.status === "fulfilled" && r.value) products.push(r.value);
  }
  if (products.length === 0 && unchanged.length === 0) {
    throw new StoreReadError("We found your store's pages but couldn't read any products on them. Send the address to Boutiqly and we'll take a look.");
  }
  return { platform: "other", products, unchanged };
}

export async function readStore(origin: string, get: StoreFetch, known: Map<string, string | null> = new Map()): Promise<StoreRead> {
  const shopify = await tryShopify(origin, get);
  if (shopify) return { platform: "shopify", products: shopify, unchanged: [] };
  return readOther(origin, get, known);
}
