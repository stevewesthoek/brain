import pg from 'pg';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InfraVOJob {
  jobId: string;
  jobType: string;           // 'render' | 'post' | 'multi_post' | 'normalize' | 'screen_record'
  jobStatus: string;         // 'pending' | 'running' | 'succeeded' | 'failed' | 'dead'
  pipelineState: string;     // 'planned' | 'rendered' | 'posted'
  adapterMode: string | null;
  platform: string | null;   // from task_config->>'platform'
  accountHandle: string | null;  // resolved from accounts join
  title: string | null;      // from task_config->>'title'
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface InfraVOJobsResponse {
  ok: boolean;
  jobs: InfraVOJob[];
  totalCount: number;
  error?: string;
}

// ── Lazy pool ─────────────────────────────────────────────────────────────────

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
    _pool.on('error', () => {
      // Pool error — connection will be retried on next request
    });
  }
  return _pool;
}

// ── Test helper (not for production use) ──────────────────────────────────────

export function _injectPoolForTesting(pool: pg.Pool | null): void {
  _pool = pool;
}

// ── Query helpers ─────────────────────────────────────────────────────────────

async function queryWithTimeout<T extends pg.QueryResultRow>(
  pool: pg.Pool,
  sql: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  const client = await pool.connect();
  try {
    return await client.query<T>(sql, params);
  } finally {
    client.release();
  }
}

// ── Main function ─────────────────────────────────────────────────────────────

export async function getInfraVOJobs(opts?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<InfraVOJobsResponse> {
  const pool = getPool();

  const limit = Math.min(opts?.limit ?? 20, 100);
  const offset = opts?.offset ?? 0;
  const statusFilter = opts?.status;

  try {
    // Build WHERE clause
    const whereClauses: string[] = [];
    const params: unknown[] = [];

    if (statusFilter !== undefined) {
      params.push(statusFilter);
      whereClauses.push(`j.job_status = $${params.length}`);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Count query
    const countResult = await queryWithTimeout<{ cnt: string }>(
      pool,
      `SELECT COUNT(*) AS cnt
       FROM jobs j
       ${whereClause}`,
      params,
    );
    const totalCount = parseInt(countResult.rows[0]?.cnt ?? '0', 10);

    // Data query — LEFT JOIN accounts to resolve account handle
    const dataParams = [...params, limit, offset];
    const limitParam = `$${dataParams.length - 1}`;
    const offsetParam = `$${dataParams.length}`;

    const jobResult = await queryWithTimeout<{
      job_id: string;
      job_type: string;
      job_status: string;
      pipeline_state: string;
      adapter_mode: string | null;
      platform: string | null;
      account_handle: string | null;
      title: string | null;
      error_message: string | null;
      created_at: Date;
      completed_at: Date | null;
    }>(
      pool,
      `SELECT j.job_id,
              j.job_type,
              j.job_status,
              j.pipeline_state,
              j.task_config->>'adapter_mode'                                            AS adapter_mode,
              j.task_config->>'platform'                                               AS platform,
              COALESCE(
                a.account_handle,
                j.task_config->>'account_handle',
                j.task_config->>'account_id'
              )                                                                        AS account_handle,
              j.task_config->>'title'                                                  AS title,
              j.error_message,
              j.created_at,
              j.completed_at
       FROM jobs j
       LEFT JOIN accounts a
         ON a.account_id = (j.task_config->>'account_id')::uuid
       ${whereClause}
       ORDER BY j.created_at DESC
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      dataParams,
    );

    const jobs: InfraVOJob[] = jobResult.rows.map((row) => ({
      jobId: row.job_id,
      jobType: row.job_type,
      jobStatus: row.job_status,
      pipelineState: row.pipeline_state,
      adapterMode: row.adapter_mode ?? null,
      platform: row.platform ?? null,
      accountHandle: row.account_handle ?? null,
      title: row.title ?? null,
      errorMessage: row.error_message ?? null,
      createdAt: row.created_at.toISOString(),
      completedAt: row.completed_at ? row.completed_at.toISOString() : null,
    }));

    return {
      ok: true,
      jobs,
      totalCount,
    };
  } catch {
    return {
      ok: false,
      jobs: [],
      totalCount: 0,
      error: 'VO DB unreachable',
    };
  }
}
