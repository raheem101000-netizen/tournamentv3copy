-- Add matchType column to distinguish bracket-driven matches from manually created ones.
-- 'bracket' = auto-managed by the bracket progression engine (default for all existing rows)
-- 'manual'  = organiser-created match (e.g. 3rd-place playoff); never participates in bracket logic.
ALTER TABLE matches ADD COLUMN IF NOT EXISTS match_type TEXT DEFAULT 'auto';
