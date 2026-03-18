-- Migration: Add league_pair_tracker table for league/round-robin match generation
-- Tracks the number of matches created between each pair of players,
-- enforcing the rule that no more than 2 matches are generated per pair.

CREATE TABLE IF NOT EXISTS "league_pair_tracker" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tournament_id" varchar NOT NULL,
  "player_a_id" varchar NOT NULL,
  "player_b_id" varchar NOT NULL,
  "matches_played" integer DEFAULT 0 NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_league_pair_tracker_tournament_id"
  ON "league_pair_tracker" ("tournament_id");

CREATE UNIQUE INDEX IF NOT EXISTS "uq_league_pair"
  ON "league_pair_tracker" ("tournament_id", "player_a_id", "player_b_id");
