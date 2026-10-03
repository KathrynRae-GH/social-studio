-- Drafts sent to Boutiqly's social planner as a connection test. Drafts never publish.
ALTER TABLE calendar_entries
  ADD COLUMN planner_draft_ids text[] NOT NULL DEFAULT '{}', -- one per Story frame, in order
  ADD COLUMN draft_sent_at     timestamptz;
