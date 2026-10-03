-- Fonts a shop uploads because they aren't on Google Fonts. Kept here (not in
-- Boutiqly media storage, which is built for photos and videos); they're small
-- and the worker reads them directly when rendering, for the job's own shop only.
CREATE TABLE brand_fonts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id    uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  family      text NOT NULL,
  weight      integer NOT NULL DEFAULT 400 CHECK (weight BETWEEN 100 AND 900),
  italic      boolean NOT NULL DEFAULT false,
  format      text NOT NULL CHECK (format IN ('woff2','woff','truetype','opentype')),
  file_name   text NOT NULL DEFAULT '',
  data        bytea NOT NULL,
  size_bytes  integer NOT NULL,
  uploaded_by text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX brand_fonts_brand ON brand_fonts (brand_id, family);
