-- The shop's strategy: posting times per network and content pillars.
CREATE TABLE strategies (
  brand_id             uuid PRIMARY KEY REFERENCES brands(id) ON DELETE CASCADE,
  links                jsonb NOT NULL DEFAULT '[]',
  summary              text NOT NULL DEFAULT '',
  times                jsonb NOT NULL DEFAULT '{}',
  pillars              jsonb NOT NULL DEFAULT '[]',
  status               text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved')),
  approved_by          text,
  approved_at          timestamptz,
  suggesting_started_at timestamptz,
  suggest_error        text,
  suggested_at         timestamptz,
  updated_by           text NOT NULL,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- Which content pillar a post belongs to (a pillar id from the strategy).
ALTER TABLE pieces ADD COLUMN pillar text;
