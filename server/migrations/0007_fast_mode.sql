-- Fast mode: the speed each Claude call actually ran at (fast costs 2x).
ALTER TABLE usage_ledger
  ADD COLUMN speed text NOT NULL DEFAULT 'standard' CHECK (speed IN ('standard','fast'));
