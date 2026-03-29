-- Add sourceMatch1Id and sourceMatch2Id to explicitly track which matches feed into each match.
-- This eliminates the need for dynamic reverse-lookups via nextMatchId at runtime.
-- sourceMatch1Id = the match whose winner fills team1Id slot
-- sourceMatch2Id = the match whose winner fills team2Id slot
ALTER TABLE matches ADD COLUMN IF NOT EXISTS source_match1_id VARCHAR;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS source_match2_id VARCHAR;
