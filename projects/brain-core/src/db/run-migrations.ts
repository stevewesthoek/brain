import fs, { type Dirent } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { getVoStudioPool } from './pool.js';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
// In dist/ the migrations folder is alongside the compiled JS files.
const MIGRATIONS_DIR = path.join(MODULE_DIR, 'migrations');

export interface MigrationResult {
  migration: string;
  ok: boolean;
  error?: string;
}

/**
 * Run all pending SQL migrations in the migrations/ directory.
 *
 * Uses a simple sequential numbered naming convention (001_, 002_, …).
 * Idempotent: all DDL statements use IF NOT EXISTS guards.
 */
export async function runMigrations(pool?: pg.Pool): Promise<MigrationResult[]> {
  const db = pool ?? getVoStudioPool();

  // Explicitly typed to avoid Dirent overload ambiguity under strict tsconfig.
  const allEntries: string[] = fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .map((d: Dirent) => d.name);
  const migrationFiles = allEntries.filter((f) => f.endsWith('.sql')).sort();

  const results: MigrationResult[] = [];

  for (const migration of migrationFiles) {
    const filePath = path.join(MIGRATIONS_DIR, migration);
    const sql = fs.readFileSync(filePath, 'utf8');

    const client = await db.connect();
    try {
      await client.query(sql);
      results.push({ migration, ok: true });
      console.log(`[migrations] OK: ${migration}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ migration, ok: false, error: message });
      console.error(`[migrations] FAILED: ${migration} — ${message}`);
      client.release();
      // Stop on first failure so subsequent migrations don't run against a broken schema.
      throw new Error(`Migration failed: ${migration} — ${message}`);
    } finally {
      client.release();
    }
  }

  return results;
}
