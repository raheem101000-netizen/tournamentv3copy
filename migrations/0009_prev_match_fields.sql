-- Replace source_match1_id / source_match2_id with prev_match1_id / prev_match2_id.
-- Uses ADD/DROP instead of RENAME so this is safe whether or not migration 0008 ran.
--
-- prev_match1_id: the match whose winner fills team1Id in this match
-- prev_match2_id: the match whose winner fills team2Id in this match
--
-- next_match_id is kept for backwards compatibility with existing bracket data.

ALTER TABLE matches ADD COLUMN IF NOT EXISTS prev_match1_id VARCHAR;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS prev_match2_id VARCHAR;
ALTER TABLE matches DROP COLUMN IF EXISTS source_match1_id;
ALTER TABLE matches DROP COLUMN IF EXISTS source_match2_id;
CREATE INDEX IF NOT EXISTS idx_matches_prev_match1 ON matches(prev_match1_id);
CREATE INDEX IF NOT EXISTS idx_matches_prev_match2 ON matches(prev_match2_id);
