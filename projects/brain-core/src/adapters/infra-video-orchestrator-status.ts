import pg from 'pg';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InfraVOQueueDepth {
  pending: number;
  running: number;
  failed: number;
  dead?: number;
}

export interface InfraVORecentPost {
  jobId: string;
  platform: string;
  accountHandle: string;
  title: string;
  postedAt: string;
  pipelineState: string;
}

export interface InfraVOAnalyticsSnapshot {
  totalViews7d: number;
  avgEngagement7d: number;
  topPlatform: string;
}

export interface InfraVOStatusResponse {
  ok: boolean;
  queueDepth?: InfraVOQueueDepth;
  jobsByType?: Record<string, number>;
  activeAccounts?: number;
  accountsByPlatform?: Record<string, number>;
  recentPosts?: InfraVORecentPost[];
  analyticsSnapshot?: InfraVOAnalyticsSnapshot;
  lastJobAt?: string | null;
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

// ── Main builder ──────────────────────────────────────────────────────────────

export async function getInfraVideoOrchestratorStatus(): Promise<InfraVOStatusResponse> {
  const pool = getPool();

  try {
    // Queue depth by job_status
    const queueResult = await queryWithTimeout<{ job_status: string; cnt: string }>(
      pool,
      `SELECT job_status, COUNT(*) AS cnt
       FROM jobs
       WHERE job_status IN ('pending', 'running', 'failed', 'dead')
       GROUP BY job_status`,
    );

    const queueDepth: InfraVOQueueDepth = { pending: 0, running: 0, failed: 0, dead: 0 };
    for (const row of queueResult.rows) {
      const count = parseInt(row.cnt, 10);
      if (row.job_status === 'pending') queueDepth.pending = count;
      else if (row.job_status === 'running') queueDepth.running = count;
      else if (row.job_status === 'failed') queueDepth.failed = count;
      else if (row.job_status === 'dead') queueDepth.dead = count;
    }

    // Jobs by type (last 7 days)
    const typeResult = await queryWithTimeout<{ job_type: string; cnt: string }>(
      pool,
      `SELECT job_type, COUNT(*) AS cnt
       FROM jobs
       WHERE created_at >= NOW() - INTERVAL '7 days'
       GROUP BY job_type`,
    );
    const jobsByType: Record<string, number> = {};
    for (const row of typeResult.rows) {
      jobsByType[row.job_type] = parseInt(row.cnt, 10);
    }

    // Active accounts and breakdown by platform
    const accountResult = await queryWithTimeout<{ platform: string; cnt: string }>(
      pool,
      `SELECT platform, COUNT(*) AS cnt
       FROM accounts
       WHERE account_status = 'active'
       GROUP BY platform`,
    );
    let activeAccounts = 0;
    const accountsByPlatform: Record<string, number> = {};
    for (const row of accountResult.rows) {
      const count = parseInt(row.cnt, 10);
      accountsByPlatform[row.platform] = count;
      activeAccounts += count;
    }

    // Recent posts (last 3 posted jobs — platform/title/account from task_config jsonb)
    const postsResult = await queryWithTimeout<{
      job_id: string;
      platform: string;
      account_handle: string;
      title: string;
      completed_at: Date | null;
      pipeline_state: string;
    }>(
      pool,
      `SELECT j.job_id,
              j.task_config->>'platform'      AS platform,
              COALESCE(
                (SELECT a2.account_handle FROM accounts a2 WHERE a2.account_id = (j.task_config->>'account_id')::uuid LIMIT 1),
                j.task_config->>'account_handle',
                j.task_config->>'account_id'
              ) AS account_handle,
              COALESCE(j.task_config->>'title', '') AS title,
              j.completed_at,
              j.pipeline_state
       FROM jobs j
       WHERE j.pipeline_state = 'posted'
       ORDER BY j.completed_at DESC NULLS LAST
       LIMIT 3`,
    );
    const recentPosts: InfraVORecentPost[] = postsResult.rows.map((row) => ({
      jobId: row.job_id,
      platform: row.platform ?? 'unknown',
      accountHandle: row.account_handle ?? 'unknown',
      title: row.title ?? 'untitled',
      postedAt: row.completed_at ? row.completed_at.toISOString() : '',
      pipelineState: row.pipeline_state,
    }));

    // Analytics snapshot (views/engagement last 7d)
    const analyticsResult = await queryWithTimeout<{
      platform: string;
      total_views: string;
      avg_engagement: string;
    }>(
      pool,
      `SELECT platform,
              SUM(views) AS total_views,
              AVG(engagement_rate) AS avg_engagement
       FROM performance_metrics
       WHERE created_at >= NOW() - INTERVAL '7 days'
       GROUP BY platform
       ORDER BY SUM(views) DESC`,
    );

    let totalViews7d = 0;
    let totalEngagementSum = 0;
    let engagementRowCount = 0;
    let topPlatform = '';
    let topPlatformViews = -1;

    for (const row of analyticsResult.rows) {
      const views = parseInt(row.total_views, 10) || 0;
      const eng = parseFloat(row.avg_engagement) || 0;
      totalViews7d += views;
      totalEngagementSum += eng;
      engagementRowCount++;
      if (views > topPlatformViews) {
        topPlatformViews = views;
        topPlatform = row.platform;
      }
    }

    const analyticsSnapshot: InfraVOAnalyticsSnapshot = {
      totalViews7d,
      avgEngagement7d: engagementRowCount > 0 ? Math.round((totalEngagementSum / engagementRowCount) * 1000) / 1000 : 0,
      topPlatform,
    };

    // Last job timestamp
    const lastJobResult = await queryWithTimeout<{ last_job_at: Date | null }>(
      pool,
      `SELECT MAX(created_at) AS last_job_at FROM jobs`,
    );
    const lastJobAt = lastJobResult.rows[0]?.last_job_at?.toISOString() ?? null;

    return {
      ok: true,
      queueDepth,
      jobsByType,
      activeAccounts,
      accountsByPlatform,
      recentPosts,
      analyticsSnapshot,
      lastJobAt,
    };
  } catch (err) {
    return {
      ok: false,
      error: 'VO DB unreachable',
    };
  }
}
