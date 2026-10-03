-- Milestone 2: the Library, the Calendar and posting through Boutiqly.
-- Everything is keyed by brand_id. Media files live in the sub-account's
-- Boutiqly media storage; this database keeps only their address and details.

ALTER TABLE brands
  ADD COLUMN timezone        text,
  ADD COLUMN live_posting    boolean NOT NULL DEFAULT false,
  ADD COLUMN media_folder_id text,
  ADD COLUMN synced_at       timestamptz;

CREATE TABLE assets (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id          uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  boutiqly_file_id  text,
  url               text NOT NULL,
  mime              text NOT NULL,
  name              text NOT NULL DEFAULT '',
  size_bytes        bigint,
  uploaded_by       text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assets_brand ON assets (brand_id, created_at DESC);

CREATE TABLE pieces (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id    uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('post','carousel','story','story_set','reel','text','short','pin','google_update')),
  title       text NOT NULL DEFAULT '',
  asset_ids   uuid[] NOT NULL DEFAULT '{}',   -- in order: carousel slides, Story frames
  link        text NOT NULL DEFAULT '',        -- pins, Google updates
  archived    boolean NOT NULL DEFAULT false,
  created_by  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pieces_brand ON pieces (brand_id, updated_at DESC);

CREATE TABLE captions (
  piece_id    uuid NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
  channel     text NOT NULL,
  text        text NOT NULL DEFAULT '',
  alt_text    text NOT NULL DEFAULT '',
  status      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','final')),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (piece_id, channel)
);

CREATE TABLE calendar_entries (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id           uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  piece_id           uuid NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
  channel            text NOT NULL,
  scheduled_at       timestamptz NOT NULL,
  status             text NOT NULL DEFAULT 'suggested'
                     CHECK (status IN ('suggested','approved','scheduled','posted','needs_attention')),
  route              text NOT NULL CHECK (route IN ('publish','app_ping','pack','share_from_ig')),
  planner_account_id text,
  planner_post_ids   text[] NOT NULL DEFAULT '{}', -- one per Story frame, in order
  dry_run            jsonb,                        -- what would have been sent while live posting was off
  last_error         text,
  source             text NOT NULL DEFAULT 'owner', -- owner or claude
  approved_by        text,
  approved_at        timestamptz,
  created_by         text NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX calendar_brand_time ON calendar_entries (brand_id, scheduled_at);

CREATE TABLE ideas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id    uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  title       text NOT NULL,
  pitch       text NOT NULL DEFAULT '',
  format      text NOT NULL DEFAULT '',
  status      text NOT NULL DEFAULT 'later' CHECK (status IN ('now','later','built','done')),
  piece_id    uuid REFERENCES pieces(id) ON DELETE SET NULL,
  source      text NOT NULL DEFAULT 'owner',
  created_by  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ideas_brand ON ideas (brand_id, created_at DESC);

CREATE TABLE shots (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id   uuid NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  text      text NOT NULL,
  done      boolean NOT NULL DEFAULT false,
  position  int NOT NULL DEFAULT 0
);

CREATE TABLE events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id    uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  title       text NOT NULL,
  starts_at   timestamptz NOT NULL,
  link        text NOT NULL DEFAULT '',
  canceled    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX events_brand ON events (brand_id, starts_at);
