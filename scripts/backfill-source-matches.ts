/**
 * Backfill source_match1_id and source_match2_id for all matches.
 *
 * For each match, finds every other match whose next_match_id points to it.
 * Those are the "feeder" matches. Sorted by match_index ascending:
 *   feeders[0] → source_match1_id
 *   feeders[1] → source_match2_id  (null if only one feeder)
 *
 * First-round matches (no feeders) → both columns stay null.
 * Safe to re-run: skips rows already set correctly.
 *
 * Usage:
 *   npx tsx scripts/backfill-source-matches.ts [--dry-run]
 */

import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import * as dotenv from "dotenv";

dotenv.config();
neonConfig.webSocketConstructor = ws;

const isDryRun = process.argv.includes("--dry-run");

interface MatchRow {
  id: string;
  round: number;
  match_index: number | null;
  next_match_id: string | null;
  source_match1_id: string | null;
  source_match2_id: string | null;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL is not set.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // ── 1. Load every match ──────────────────────────────────────────────────
    const { rows } = await pool.query<MatchRow>(`
      SELECT id, round, match_index, next_match_id,
             source_match1_id, source_match2_id
      FROM matches
    `);

    console.log(`Loaded ${rows.length} matches.${isDryRun ? " (DRY RUN)" : ""}`);

    // ── 2. Build reverse map: matchId → feeder matches[] ────────────────────
    //    A "feeder" of match X is any match whose next_match_id = X.id
    const feedersOf = new Map<string, MatchRow[]>();

    for (const m of rows) {
      if (!m.next_match_id) continue;
      if (!feedersOf.has(m.next_match_id)) feedersOf.set(m.next_match_id, []);
      feedersOf.get(m.next_match_id)!.push(m);
    }

    // ── 3. For each match, assign source fields ──────────────────────────────
    let updated = 0;
    let skipped = 0;

    for (const match of rows) {
      const feeders = feedersOf.get(match.id) ?? [];

      if (feeders.length === 0) {
        // First-round match — no feeders, leave both null
        skipped++;
        continue;
      }

      // Sort feeders by match_index so assignment is deterministic
      feeders.sort((a, b) => (a.match_index ?? 0) - (b.match_index ?? 0));

      const src1 = feeders[0]?.id ?? null;
      const src2 = feeders[1]?.id ?? null;

      // Skip if already correct (idempotent)
      if (match.source_match1_id === src1 && match.source_match2_id === src2) {
        skipped++;
        continue;
      }

      if (isDryRun) {
        console.log(
          `  match ${match.id} (r${match.round} i${match.match_index ?? "?"})` +
          ` → src1=${src1} src2=${src2 ?? "null"}`
        );
      } else {
        await pool.query(
          `UPDATE matches
             SET source_match1_id = $1,
                 source_match2_id = $2
           WHERE id = $3`,
          [src1, src2, match.id]
        );
      }

      updated++;
    }

    // ── 4. Report ────────────────────────────────────────────────────────────
    console.log(`\nDone.`);
    console.log(`  ${isDryRun ? "Would update" : "Updated"}: ${updated}`);
    console.log(`  Skipped (no change / first-round): ${skipped}`);
    if (isDryRun) console.log(`\n  Re-run without --dry-run to apply.`);

  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
