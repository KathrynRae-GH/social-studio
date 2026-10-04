import { useEffect, useRef, useState } from "react";
import type { Me } from "../../../shared/roles.ts";
import type { StoreView } from "../../../shared/store.ts";
import { api } from "../boutiqly.ts";
import { ErrorNote } from "./bits.tsx";

const SHOWN = 12;
const WHEN = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// The shop's online store: Claude reads its products (names, links, photos;
// never prices) so posts can feature real products and link to them.
export function StorePanel({ me }: { me: Me }) {
  const canEdit = me.permissions.includes("manage_brand");
  const [store, setStore] = useState<StoreView | null | undefined>(undefined);
  const [address, setAddress] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function load() {
    try {
      const { store } = await api.store();
      setStore(store);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, []);

  // While a read is running, check back every few seconds.
  useEffect(() => {
    if (store && (store.status === "new" || store.status === "reading")) {
      timer.current = setTimeout(() => void load(), 3000);
      return () => { if (timer.current) clearTimeout(timer.current); };
    }
  }, [store]);

  async function run(fn: () => Promise<{ store: StoreView | null }>) {
    setError("");
    setBusy(true);
    try {
      setStore((await fn()).store);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const reading = store && (store.status === "new" || store.status === "reading");
  const list = store ? (showAll ? store.products : store.products.slice(0, SHOWN)) : [];

  return (
    <div className="card">
      <h2>Online store</h2>
      {store === undefined ? (
        <p className="muted small">Loading…</p>
      ) : store === null ? (
        <>
          <p className="small">
            Connect the shop's online store and Claude can feature real products in posts, link to them, and suggest posts about new arrivals. It works with Shopify and Square stores (and most others). No login needed: just the address your customers shop at.
          </p>
          {canEdit ? (
            <form className="field-row" onSubmit={(e) => { e.preventDefault(); void run(() => api.connectStore(address)); }}>
              <label className="field" style={{ flex: "1 1 260px" }}>
                <span>Store address</span>
                <input type="text" inputMode="url" placeholder="yourshop.com" value={address} onChange={(e) => setAddress(e.target.value)} />
              </label>
              <button className="btn-secondary small" disabled={busy || !address.trim()}>Connect store</button>
            </form>
          ) : (
            <p className="muted small">The shop's owner can connect the online store here.</p>
          )}
        </>
      ) : (
        <>
          <p className="small">
            <a href={store.url} target="_blank" rel="noreferrer">{store.url.replace(/^https:\/\//, "")}</a>
            {store.platform === "shopify" ? " · Shopify" : ""}
            {" · "}
            {store.productCount} product{store.productCount === 1 ? "" : "s"}
            {store.newCount > 0 && <> · <strong>{store.newCount} new</strong> in the last 2 weeks</>}
          </p>
          {reading ? (
            <p className="notice small">Reading your store's products… This takes a minute or two the first time.</p>
          ) : store.status === "error" ? (
            <p className="notice attention small">{store.lastError}</p>
          ) : (
            <p className="muted small">
              Refreshed {store.lastReadAt ? WHEN.format(new Date(store.lastReadAt)) : "—"}. It refreshes every day on its own. Product photos are copied into Assets so Claude can design with them. Posts never mention prices.
            </p>
          )}

          {list.length > 0 && (
            <ul className="product-list">
              {list.map((p) => (
                <li key={p.id} className="product-row">
                  {p.photo ? <img src={p.photo.url} alt="" className="product-thumb" loading="lazy" /> : <span className="product-thumb thumb-empty" aria-hidden="true" />}
                  <span className="product-name">
                    <a href={p.url} target="_blank" rel="noreferrer">{p.title}</a>
                    <span className="muted small">{[p.productType, p.available === false ? "Sold out" : ""].filter(Boolean).join(" · ")}</span>
                  </span>
                  {p.isNew && <span className="status-chip status-suggested">New</span>}
                </li>
              ))}
            </ul>
          )}
          {store.products.length > SHOWN && (
            <button className="btn-link small" onClick={() => setShowAll(!showAll)}>
              {showAll ? "Show fewer" : `Show all ${store.products.length}`}
            </button>
          )}

          <div className="field-row">
            <button className="btn-secondary small" disabled={busy || !!reading} onClick={() => void run(() => api.refreshStore())}>Refresh now</button>
            {canEdit && (
              <button
                className="btn-link small"
                disabled={busy}
                onClick={() => {
                  if (confirm("Disconnect the store? Claude stops seeing its products. Photos already copied stay in Assets.")) void run(() => api.disconnectStore());
                }}
              >
                Disconnect
              </button>
            )}
          </div>
        </>
      )}
      <ErrorNote message={error} />
    </div>
  );
}
