-- The inspiration board: posts a shop loves (its own or others'). Claude
-- studies them before designing but never puts them in a post.
ALTER TABLE assets
  ADD COLUMN purpose text NOT NULL DEFAULT 'content' CHECK (purpose IN ('content','inspiration'));
