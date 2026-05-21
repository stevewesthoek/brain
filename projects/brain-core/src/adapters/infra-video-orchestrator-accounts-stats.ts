import pg from 'pg';
import type { BrainCoreInfraVOAccountStatsResponse } from '../types/api.js';

let _pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!_pool) {
    _pool = new pg.Pool({
      host: '127.0.0.1',
      port: 5450,
      database: 'video_orchestrator',
      user: 'postgres',
      password: 'postgres',
      max: 3,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    _pool.on('error', () => undefined);
  }
  return _pool;
}

export function _injectPoolForTesting(pool: pg.Pool | null): void {
  _pool = pool;
}

export async function getInfraVOAccountStats(): Promise<BrainCoreInfraVOAccountStatsResponse> {
  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const result = await client.query<{
        account_id: string;
        account_handle: string;
        platform: string;
        total_jobs: string;
        succeeded_jobs: string;
        failed_jobs: string;
        last_job_at: Date | null;
        last_succeeded_at: Date | null;
        adapter_mode: string | null;
      }>(
        `SELECT
           a.account_id,
           a.account_handle,
           a.platform,
           COUNT(j.job_id)                                           AS total_jobs,
           COUNT(j.job_id) FILTER (WHERE j.job_status = 'succeeded') AS succeeded_jobs,
           COUNT(j.job_id) FILTER (WHERE j.job_status IN ('failed', 'dead')) AS failed_jobs,
           MAX(j.created_at)                                          AS last_job_at,
           MAX(j.created_at) FILTER (WHERE j.job_status = 'succeeded') AS last_succeeded_at,
           MAX(j.output->>'adapter_mode') FILTER (WHERE j.job_status = 'succeeded') AS adapter_mode
         FROM accounts a
         LEFT JOIN jobs j
           ON (j.task_config->>'account_id') ~* '^[0-9a-f-]{36}$'
          AND j.job_type = 'post'
          AND j.created_at > NOW() - INTERVAL '30 days'
          AND a.account_id::text = (j.task_config->>'account_id')
         GROUP BY a.account_id, a.account_handle, a.platform
         ORDER BY a.platform, a.account_handle`,
      );

      const stats = result.rows.map(row => {
        const total = parseInt(row.total_jobs, 10);
        const succeeded = parseInt(row.succeeded_jobs, 10);
        const failed = parseInt(row.failed_jobs, 10);
        return {
          accountId: row.account_id,
          accountHandle: row.account_handle,
          platform: row.platform,
          totalJobs30d: total,
          succeededJobs30d: succeeded,
          failedJobs30d: failed,
          successRate30d: total > 0 ? Math.round((succeeded / total) * 100) : null,
          lastJobAt: row.last_job_at ? row.last_job_at.toISOString() : null,
          lastSucceededAt: row.last_succeeded_at ? row.last_succeeded_at.toISOString() : null,
          lastAdapterMode: row.adapter_mode ?? null,
        };
      });

      return { ok: true, stats };
    } finally {
      client.release();
    }
  } catch (err) {
    return {
      ok: false,
      stats: [],
      error: err instanceof Error ? err.message : 'VO DB unreachable',
    };
  }
}
