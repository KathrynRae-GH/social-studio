// The shop's online store, as the Brand screen shows it.
export interface ProductView {
  id: string;
  title: string;
  url: string;
  productType: string;
  available: boolean | null;
  addedAt: string | null; // when the store added it, or when we first saw it (after the first read)
  isNew: boolean; // added in the last 14 days
  photo: { assetId: string; url: string } | null;
}

export interface StoreView {
  url: string;
  platform: "unknown" | "shopify" | "other";
  status: "new" | "reading" | "ok" | "error";
  lastReadAt: string | null;
  lastError: string | null;
  productCount: number;
  newCount: number;
  products: ProductView[]; // newest first
}

export const NEW_PRODUCT_DAYS = 14;
