-- The shop's online store (one per brand for now) and the products read
-- from it. Prices are never stored: posts don't mention them.
CREATE TABLE stores (
  brand_id        uuid PRIMARY KEY REFERENCES brands(id) ON DELETE CASCADE,
  url             text NOT NULL,
  platform        text NOT NULL DEFAULT 'unknown' CHECK (platform IN ('unknown','shopify','other')),
  status          text NOT NULL DEFAULT 'new' CHECK (status IN ('new','reading','ok','error')),
  last_read_at    timestamptz,
  last_error      text,
  connected_by    text NOT NULL,
  connected_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  external_id     text NOT NULL,
  title           text NOT NULL,
  url             text NOT NULL,
  description     text NOT NULL DEFAULT '',
  product_type    text NOT NULL DEFAULT '',
  tags            text[] NOT NULL DEFAULT '{}',
  image_url       text,
  asset_id        uuid REFERENCES assets(id) ON DELETE SET NULL,
  asset_image_url text,          -- the store photo address asset_id was copied from
  available       boolean,
  published_at    timestamptz,   -- from the store, when it says
  first_seen_at   timestamptz NOT NULL DEFAULT now(),
  in_first_read   boolean NOT NULL DEFAULT false,
  page_lastmod    text,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  removed_at      timestamptz,
  UNIQUE (brand_id, external_id)
);
CREATE INDEX products_brand_new ON products (brand_id, removed_at, first_seen_at DESC);

ALTER TABLE assets ADD COLUMN product_id uuid REFERENCES products(id) ON DELETE SET NULL;
