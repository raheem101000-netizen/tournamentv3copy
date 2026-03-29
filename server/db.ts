import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "../shared/schema.js";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  console.error("FATAL: DATABASE_URL must be set. Did you forget to provision a database?");
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

console.log("[DB] Initializing database connection...");

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,              // Reduced from 100 to 20 for serverless stability
  min: 0,               // Set to 0 for serverless (scale down when idle)
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Test pool connection
pool.on('error', (err) => {
  console.error('[DB] Pool error:', err);
});

export const db = drizzle({ client: pool, schema });

console.log("[DB] Database connection initialized");

/**
 * Idempotent startup migration.
 * Runs the bracket schema changes (prev_match1_id / prev_match2_id) directly
 * against the DB using IF NOT EXISTS / IF EXISTS guards so it is always safe
 * to run — even on the very first cold start after a Vercel deploy.
 * No drizzle-kit, no migration files, no manual steps required.
 */
export async function runStartupMigrations(): Promise<void> {
  console.log("[DB] Running startup migrations...");
  try {
    // Each statement is a separate call — neon serverless Pool does not
    // support multi-statement strings in a single query() call.
    await pool.query("ALTER TABLE matches ADD COLUMN IF NOT EXISTS prev_match1_id VARCHAR");
    await pool.query("ALTER TABLE matches ADD COLUMN IF NOT EXISTS prev_match2_id VARCHAR");
    await pool.query("ALTER TABLE matches DROP COLUMN IF EXISTS source_match1_id");
    await pool.query("ALTER TABLE matches DROP COLUMN IF EXISTS source_match2_id");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_matches_prev_match1 ON matches(prev_match1_id)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_matches_prev_match2 ON matches(prev_match2_id)");
    console.log("[DB] Startup migrations complete.");
  } catch (err) {
    // Log but don't crash — the app can still serve requests for old brackets
    // even if the migration fails (e.g. insufficient privileges in read-only replica).
    console.error("[DB] Startup migration error (non-fatal):", err);
  }
}
