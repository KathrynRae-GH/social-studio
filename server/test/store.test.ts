import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { people, signInAs, testApp } from "./helpers.ts";
import { isPrivateAddress, storeOrigin, type StoreFetch } from "../src/store/net.ts";
import { looksLikeProductPage, parseProductPage, parseShopify, sitemapEntries } from "../src/store/reader.ts";

// ---- Pieces that need no database ----

describe("the address guard", () => {
  it("refuses this server's own network", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ["23.227.38.65", "8.8.8.8", "2606:4700::1"]) expect(isPrivateAddress(ip), ip).toBe(false);
  });

  it("turns what the owner typed into the store's home address", () => {
    expect(storeOrigin("makespace.com")).toBe("https://makespace.com");
    expect(storeOrigin(" https://Shop.Example.com/products/mug?x=1 ")).toBe("https://shop.example.com");
    expect(storeOrigin("http://example.square.site/")).toBe("https://example.square.site");
    for (const bad of ["", "localhost", "http://127.0.0.1", "intranet", "https://user:pw@shop.com", "https://shop.com:8443", "printer.local"]) {
      expect(() => storeOrigin(bad), bad).toThrow();
    }
  });
});

describe("reading store pages", () => {
  it("reads Shopify's product list, without prices", () => {
    const [p] = parseShopify("https://shop.test", [
      {
        id: 42,
        title: "Linen Apron",
        handle: "linen-apron",
        body_html: "<p>Soft &amp; sturdy.</p><ul><li>Pockets</li></ul>",
        product_type: "Aprons",
        tags: "linen, Kitchen",
        published_at: "2026-10-01T10:00:00Z",
        variants: [{ available: false, price: "38.00" } as never, { available: true }],
        images: [{ src: "//cdn.shopify.com/apron.jpg" }],
      },
    ]);
    expect(p).toMatchObject({
      externalId: "shopify:42",
      title: "Linen Apron",
      url: "https://shop.test/products/linen-apron",
      description: "Soft & sturdy.\nPockets",
      productType: "Aprons",
      tags: ["linen", "kitchen"],
      imageUrl: "https://cdn.shopify.com/apron.jpg",
      available: true,
    });
    expect(JSON.stringify(p)).not.toContain("38");
  });

  it("reads a Square-style product page from its search details, or its sharing details", () => {
    const html = `<html><head><link rel="canonical" href="https://shop.test/product/candle/7">
      <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebSite"},{"@type":"Product","name":"Fig Candle","description":"Hand-poured.","image":["https://img.test/fig.jpg"],"offers":{"@type":"Offer","price":"24","availability":"https://schema.org/InStock"}}]}</script>
      </head></html>`;
    expect(parseProductPage("https://shop.test/product/candle/7", html, "2026-10-02")).toMatchObject({
      title: "Fig Candle",
      url: "https://shop.test/product/candle/7",
      description: "Hand-poured.",
      imageUrl: "https://img.test/fig.jpg",
      available: true,
      pageLastmod: "2026-10-02",
    });
    const og = `<meta property="og:type" content="product"><meta property="og:title" content="Tote &amp; Bag"><meta property="og:image" content="/img/tote.png">`;
    expect(parseProductPage("https://shop.test/shop/p/tote", og, null)).toMatchObject({ title: "Tote & Bag", imageUrl: "https://shop.test/img/tote.png" });
    expect(parseProductPage("https://shop.test/about", `<meta property="og:title" content="About us">`, null)).toBeNull();
  });

  it("finds product pages in a sitemap", () => {
    const xml = `<urlset><url><loc>https://shop.test/product/a/1</loc><lastmod>2026-10-01</lastmod></url><url><loc>https://shop.test/about</loc></url></urlset>`;
    expect(sitemapEntries(xml)).toEqual([
      { loc: "https://shop.test/product/a/1", lastmod: "2026-10-01" },
      { loc: "https://shop.test/about", lastmod: null },
    ]);
    expect(looksLikeProductPage("https://shop.test/products/mug")).toBe(true);
    expect(looksLikeProductPage("https://shop.test/collections/x/products/mug")).toBe(false);
    expect(looksLikeProductPage("https://shop.test/blog/post")).toBe(false);
  });
});

// ---- Connecting a store (with stand-ins for Boutiqly and the store) ----

let uploads = 0;
const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
const fakeBoutiqly = (async (url: string) => {
  const path = url.replace("https://api.test", "");
  if (path === "/oauth/token") return json({ access_token: "tok", refresh_token: "ref", expires_in: 86_400, userType: "Location", companyId: "co_boutiqly", locationId: "loc_test_1" });
  if (path === "/locations/loc_test_1") return json({ location: { name: "Test Boutique", timezone: "America/Chicago" } });
  if (path === "/medias/folder") return json({ _id: "folder_1" });
  if (path === "/medias/upload-file") {
    uploads++;
    return json({ fileId: `file_${uploads}`, url: `https://cdn.test/file_${uploads}.jpg` });
  }
  return new Response("not found", { status: 404 });
}) as unknown as typeof fetch;

let pages: Record<string, { status?: number; type: string; body: string | Buffer }> = {};
let requested: string[] = [];
const fakeStore: StoreFetch = async (url) => {
  requested.push(url);
  const page = pages[url];
  if (!page) return { url, status: 404, contentType: "text/html", body: Buffer.from("not found") };
  return { url, status: page.status ?? 200, contentType: page.type, body: Buffer.isBuffer(page.body) ? page.body : Buffer.from(page.body) };
};

const shopifyProduct = (id: number, title: string, publishedAt: string, extra: Record<string, unknown> = {}) => ({
  id,
  title,
  handle: title.toLowerCase().replace(/\W+/g, "-"),
  body_html: `<p>${title} description</p>`,
  product_type: "Home",
  tags: "",
  published_at: publishedAt,
  variants: [{ available: true, price: "19.00" }],
  images: [{ src: `https://cdn.shopify.com/s/files/${id}.jpg` }],
  ...extra,
});

let t: Awaited<ReturnType<typeof testApp>>;
let agency: Awaited<ReturnType<typeof signInAs>>;

beforeEach(async () => {
  if (t) await t.pool.end();
  uploads = 0;
  pages = {};
  requested = [];
  t = await testApp(fakeBoutiqly, undefined, fakeStore);
  await t.app.inject({ url: "/oauth/callback?code=abc" });
  agency = await signInAs(t.app, people.agency);
});
afterAll(async () => {
  await t?.pool.end();
});

async function settled(headers = agency.headers) {
  for (let i = 0; i < 100; i++) {
    const store = (await t.app.inject({ url: "/api/store", headers })).json().store;
    if (store && store.status !== "new" && store.status !== "reading") {
      // Wait for the background read to let go of its lock too.
      const { rows } = await t.pool.query("SELECT count(*)::int AS n FROM pg_locks WHERE locktype = 'advisory'");
      if (rows[0].n === 0) return store;
    }
    await new Promise((r) => setTimeout(r, 30));
  }
  throw new Error("The store read never finished");
}

const recent = new Date(Date.now() - 2 * 86_400_000).toISOString();
const old = "2025-01-15T10:00:00Z";
const jpeg = { type: "image/jpeg", body: Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3]) };

describe("connecting an online store", () => {
  it("reads a Shopify store, copies product photos into Assets, and flags new products", async () => {
    pages["https://shop.test/products.json?limit=250&page=1"] = {
      type: "application/json",
      body: JSON.stringify({ products: [shopifyProduct(1, "Linen Apron", recent), shopifyProduct(2, "Clay Mug", old)] }),
    };
    pages["https://cdn.shopify.com/s/files/1.jpg?width=1600"] = jpeg;
    pages["https://cdn.shopify.com/s/files/2.jpg?width=1600"] = jpeg;

    const res = await t.app.inject({ method: "PUT", url: "/api/store", headers: agency.headers, payload: { url: "shop.test" } });
    expect(res.statusCode).toBe(200);
    const store = await settled();
    expect(store).toMatchObject({ url: "https://shop.test", platform: "shopify", status: "ok", productCount: 2, newCount: 1 });
    expect(store.products.map((p: { title: string }) => p.title)).toEqual(["Linen Apron", "Clay Mug"]);
    expect(store.products[0]).toMatchObject({ url: "https://shop.test/products/linen-apron", isNew: true });
    expect(store.products[0].photo.url).toMatch(/^https:\/\/cdn\.test\//);

    const assets = (await t.app.inject({ url: "/api/assets", headers: agency.headers })).json().assets;
    expect(assets).toHaveLength(2);
    expect(assets[0]).toMatchObject({ fromStore: true, tagged: false, madeBy: "upload" });
    expect(assets[0].usable.ok).toBe(false); // Claude must look at it first

    // Nothing about prices is kept anywhere.
    const { rows } = await t.pool.query("SELECT row_to_json(p)::text AS r FROM products p");
    for (const r of rows) expect(r.r).not.toContain("19.00");
  });

  it("refreshes: new products show up, removed ones are hidden, photos aren't copied twice", async () => {
    const list = "https://shop.test/products.json?limit=250&page=1";
    pages[list] = { type: "application/json", body: JSON.stringify({ products: [shopifyProduct(1, "Linen Apron", old), shopifyProduct(2, "Clay Mug", old)] }) };
    pages["https://cdn.shopify.com/s/files/1.jpg?width=1600"] = jpeg;
    pages["https://cdn.shopify.com/s/files/2.jpg?width=1600"] = jpeg;
    pages["https://cdn.shopify.com/s/files/3.jpg?width=1600"] = jpeg;
    await t.app.inject({ method: "PUT", url: "/api/store", headers: agency.headers, payload: { url: "https://shop.test" } });
    expect((await settled()).newCount).toBe(0);

    pages[list] = { type: "application/json", body: JSON.stringify({ products: [shopifyProduct(1, "Linen Apron", old), shopifyProduct(3, "Fig Candle", recent)] }) };
    await t.app.inject({ method: "POST", url: "/api/store/refresh", headers: agency.headers });
    const store = await settled();
    expect(store.products.map((p: { title: string }) => p.title)).toEqual(["Fig Candle", "Linen Apron"]);
    expect(store.newCount).toBe(1);
    expect(uploads).toBe(3);
  });

  it("reads other stores (Square and the like) through the sitemap; later additions count as new", async () => {
    const page = (name: string) => ({
      type: "text/html; charset=utf-8",
      body: `<script type="application/ld+json">{"@type":"Product","name":"${name}","image":"https://img.test/${name}.jpg"}</script>`,
    });
    pages["https://sq.test/robots.txt"] = { type: "text/plain", body: "Sitemap: https://sq.test/sitemap-index.xml" };
    pages["https://sq.test/sitemap-index.xml"] = { type: "application/xml", body: `<sitemapindex><sitemap><loc>https://sq.test/sitemap-products.xml</loc></sitemap></sitemapindex>` };
    pages["https://sq.test/sitemap-products.xml"] = { type: "application/xml", body: `<urlset><url><loc>https://sq.test/product/rug/1</loc></url></urlset>` };
    pages["https://sq.test/product/rug/1"] = page("Wool Rug");
    pages["https://img.test/Wool Rug.jpg"] = jpeg;
    await t.app.inject({ method: "PUT", url: "/api/store", headers: agency.headers, payload: { url: "sq.test" } });
    let store = await settled();
    expect(store).toMatchObject({ platform: "other", status: "ok", productCount: 1, newCount: 0 });

    pages["https://sq.test/sitemap-products.xml"].body = `<urlset><url><loc>https://sq.test/product/rug/1</loc></url><url><loc>https://sq.test/product/vase/2</loc></url></urlset>`;
    pages["https://sq.test/product/vase/2"] = page("Glass Vase");
    requested = [];
    await t.app.inject({ method: "POST", url: "/api/store/refresh", headers: agency.headers });
    store = await settled();
    expect(store.productCount).toBe(2);
    expect(store.products[0]).toMatchObject({ title: "Glass Vase", isNew: true });
    expect(requested).not.toContain("https://sq.test/product/rug/1"); // unchanged pages aren't re-read
  });

  it("says plainly when it can't find products", async () => {
    await t.app.inject({ method: "PUT", url: "/api/store", headers: agency.headers, payload: { url: "empty.test" } });
    const store = await settled();
    expect(store.status).toBe("error");
    expect(store.lastError).toContain("couldn't find a product list");
  });

  it("only the owner side can connect; addresses on this server's network are refused", async () => {
    const staff = await signInAs(t.app, people.staff);
    expect((await t.app.inject({ method: "PUT", url: "/api/store", headers: staff.headers, payload: { url: "shop.test" } })).statusCode).toBe(403);
    const bad = await t.app.inject({ method: "PUT", url: "/api/store", headers: agency.headers, payload: { url: "http://169.254.169.254/latest" } });
    expect(bad.statusCode).toBe(400);
    expect((await t.app.inject({ url: "/api/store", headers: agency.headers })).json().store).toBeNull();
  });

  it("disconnecting removes the product list but keeps the copied photos", async () => {
    pages["https://shop.test/products.json?limit=250&page=1"] = { type: "application/json", body: JSON.stringify({ products: [shopifyProduct(1, "Linen Apron", old)] }) };
    pages["https://cdn.shopify.com/s/files/1.jpg?width=1600"] = jpeg;
    await t.app.inject({ method: "PUT", url: "/api/store", headers: agency.headers, payload: { url: "shop.test" } });
    await settled();
    expect((await t.app.inject({ method: "DELETE", url: "/api/store", headers: agency.headers })).statusCode).toBe(200);
    expect((await t.app.inject({ url: "/api/store", headers: agency.headers })).json().store).toBeNull();
    expect((await t.app.inject({ url: "/api/assets", headers: agency.headers })).json().assets).toHaveLength(1);
  });
});
