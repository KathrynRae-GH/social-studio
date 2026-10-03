-- Milestone 3: Claude in the app. Spend guard and usage ledger, each shop's
-- look (style set), designs rendered by the worker, asset tagging, and
-- Ask Claude conversations. Everything is keyed by brand_id.

-- Claude is off for a shop until Boutiqly's team turns it on. Until wallet
-- billing exists (Milestone 6) a monthly cap in cents of Claude cost applies.
ALTER TABLE brands
  ADD COLUMN claude_enabled   boolean NOT NULL DEFAULT false,
  ADD COLUMN claude_cap_cents integer NOT NULL DEFAULT 2000 CHECK (claude_cap_cents >= 0);

-- One row per Claude call. Never deleted: it's the record wallet charges will
-- be matched against.
CREATE TABLE usage_ledger (
  id                 bigserial PRIMARY KEY,
  brand_id           uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  user_id            text NOT NULL,
  purpose            text NOT NULL,              -- ask_claude, tag_asset, ...
  ref_id             text,                       -- conversation or asset id
  model              text NOT NULL,
  input_tokens       integer NOT NULL DEFAULT 0,
  output_tokens      integer NOT NULL DEFAULT 0,
  cache_read_tokens  integer NOT NULL DEFAULT 0,
  cache_write_tokens integer NOT NULL DEFAULT 0,
  web_searches       integer NOT NULL DEFAULT 0,
  cost_cents         numeric(12,4) NOT NULL,     -- what Claude cost us
  credits            numeric(12,4) NOT NULL,     -- Studio credits (cost x markup)
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX usage_brand_time ON usage_ledger (brand_id, created_at);

-- Each shop's look, as data for the shared engine.
CREATE TABLE style_sets (
  brand_id      uuid PRIMARY KEY REFERENCES brands(id) ON DELETE CASCADE,
  logo_asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
  colors        jsonb NOT NULL DEFAULT '[]',     -- [{name, hex, role}]
  heading_font  text NOT NULL DEFAULT 'Montserrat',
  body_font     text NOT NULL DEFAULT 'Montserrat',
  vibe          text NOT NULL DEFAULT '',
  dos_donts     text NOT NULL DEFAULT '',
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved')),
  approved_by   text,
  approved_at   timestamptz,
  updated_by    text NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Designs: HTML/CSS/SVG per frame, rendered to PNGs by the worker.
ALTER TABLE pieces
  ADD COLUMN source text NOT NULL DEFAULT 'owner' CHECK (source IN ('owner','claude')),
  ADD COLUMN design jsonb;                     -- {size, frames: [{html}], renderedAt}

-- Rendered files waiting for the server to move them into Boutiqly media storage.
CREATE TABLE render_outputs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  frame       integer NOT NULL,
  mime        text NOT NULL,
  data        bytea NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, frame)
);

-- What Claude saw in each file, and the owner's rules for it.
ALTER TABLE assets
  ADD COLUMN description     text NOT NULL DEFAULT '',
  ADD COLUMN tags            text[] NOT NULL DEFAULT '{}',
  ADD COLUMN has_people      boolean,
  ADD COLUMN possible_minor  boolean NOT NULL DEFAULT false,
  ADD COLUMN sensitive       jsonb NOT NULL DEFAULT '[]',   -- [{kind, note, box:{x,y,w,h} in 0..1}]
  ADD COLUMN flags_cleared   boolean NOT NULL DEFAULT false,
  ADD COLUMN people_rule     text NOT NULL DEFAULT 'ok' CHECK (people_rule IN ('ok','no_faces','dont_use')),
  ADD COLUMN tagged_at       timestamptz,
  ADD COLUMN source_asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,  -- a blurred copy points at its original
  ADD COLUMN made_by         text NOT NULL DEFAULT 'upload' CHECK (made_by IN ('upload','render','blur'));

-- Ask Claude.
CREATE TABLE conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id    uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  user_id     text NOT NULL,
  title       text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conversations_brand ON conversations (brand_id, updated_at DESC);

CREATE TABLE conversation_messages (
  id               bigserial PRIMARY KEY,
  conversation_id  uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role             text NOT NULL CHECK (role IN ('user','assistant')),
  content          jsonb NOT NULL,             -- the API content blocks, kept whole
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conversation_messages_conv ON conversation_messages (conversation_id, id);

-- Changes Claude proposes; nothing happens until someone on the Team taps Apply.
CREATE TABLE proposals (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id         uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  conversation_id  uuid REFERENCES conversations(id) ON DELETE CASCADE,
  kind             text NOT NULL,              -- add_to_calendar, move_entry, set_caption
  summary          text NOT NULL,
  payload          jsonb NOT NULL,
  status           text NOT NULL DEFAULT 'open' CHECK (status IN ('open','applied','dismissed')),
  decided_by       text,
  decided_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);
