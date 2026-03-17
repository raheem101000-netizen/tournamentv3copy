ALTER TABLE matches ADD COLUMN IF NOT EXISTS match_index integer;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS side text;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS next_match_id varchar;
