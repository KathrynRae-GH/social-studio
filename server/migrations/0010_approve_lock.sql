-- Posts are approved in the Library, for the networks the owner ticks.
-- Calendar entries can be locked (no more moving) before they're sent.
ALTER TABLE pieces
  ADD COLUMN approved_at        timestamptz,
  ADD COLUMN approved_by        text,
  ADD COLUMN approved_by_name   text NOT NULL DEFAULT '',
  ADD COLUMN approved_channels  text[] NOT NULL DEFAULT '{}';

ALTER TABLE calendar_entries
  ADD COLUMN locked_at  timestamptz,
  ADD COLUMN locked_by  text;
