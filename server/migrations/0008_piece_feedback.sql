-- What the owner and team think of each post (love it / not this, and why).
-- Claude reads recent verdicts before every design.
CREATE TABLE piece_feedback (
  id          bigserial PRIMARY KEY,
  brand_id    uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  piece_id    uuid NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
  user_id     text NOT NULL,
  user_name   text NOT NULL DEFAULT '',
  rating      smallint NOT NULL CHECK (rating IN (-1, 1)),
  note        text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX piece_feedback_brand ON piece_feedback (brand_id, created_at DESC);
