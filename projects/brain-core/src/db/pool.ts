import pg from 'pg';

// ── VO Studio DB pool ─────────────────────────────────────────────────────────
//
// Connects to the local VO Studio PostgreSQL instance.
// All VO approval writes/reads use this pool.
//
// Override with DATABASE_URL env var for tests or alternative environments.

let _pool: pg.Pool | null = null;

export function getVoStudioPool(): pg.Pool {
  if (!_pool) {
    const connectionString = process.env.DATABASE_URL;
    _pool = connectionString
      ? new pg.Pool({ connectionString, max: 3, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 })
      : new pg.Pool({
          host: '127.0.0.1',
          port: 5432,
          database: 'vo_studio',
          user: 'postgres',
          max: 3,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
        });

    _pool.on('error', () => {
      // Pool-level errors are silenced; failures surface per-query.
    });
  }
  return _pool;
}

/** Test helper — not for production use. */
export function _injectVoStudioPoolForTesting(pool: pg.Pool | null): void {
  _pool = pool;
}
