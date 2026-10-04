-- Comments on a post that Claude turns into edits, and earlier versions of
-- a post so an edit can be undone ("Go back").
CREATE TABLE piece_comments (
  id               bigserial PRIMARY KEY,
  brand_id         uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  piece_id         uuid NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
  user_id          text NOT NULL,
  user_name        text NOT NULL DEFAULT '',
  text             text NOT NULL,
  status           text NOT NULL DEFAULT 'open' CHECK (status IN ('open','sent','done')),
  conversation_id  uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  sent_at          timestamptz
);
CREATE INDEX piece_comments_piece ON piece_comments (piece_id, created_at);

CREATE TABLE piece_versions (
  id               bigserial PRIMARY KEY,
  brand_id         uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  piece_id         uuid NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
  snapshot         jsonb NOT NULL,
  reason           text NOT NULL DEFAULT '',
  created_by       text NOT NULL,
  created_by_name  text NOT NULL DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX piece_versions_piece ON piece_versions (piece_id, created_at DESC);

-- While Claude works on a post's edits; the reply it gave last time.
ALTER TABLE pieces
  ADD COLUMN editing_started_at  timestamptz,
  ADD COLUMN edit_reply          text NOT NULL DEFAULT '',
  ADD COLUMN edit_error          text;
