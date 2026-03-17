ALTER TABLE matches ADD COLUMN IF NOT EXISTS player1_result text;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS player2_result text;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS player1_submitted_at timestamp;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS player2_submitted_at timestamp;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS match_status text DEFAULT 'PENDING';
