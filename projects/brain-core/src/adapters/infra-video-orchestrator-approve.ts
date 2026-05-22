import pg from 'pg';

export interface ApproveVOJobResult {
  ok: boolean;
  jobId: string;
  previousStatus: string | null;
  error?: string;
}

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
    _pool.on('error', () => {});
  }
  return _pool;
}

export function _injectPoolForTesting(pool: pg.Pool | null): void {
  _pool = pool;
}

export async function approveVOJob(jobId: string): Promise<ApproveVOJobResult> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query<{ previous_status: string }>(
      `UPDATE jobs
          SET approval_status = 'approved'
        WHERE job_id = $1
          AND approval_status = 'pending_approval'
    RETURNING approval_status AS previous_status`,
      [jobId],
    );
    if (result.rowCount === 0) {
      const check = await client.query<{ approval_status: string }>(
        `SELECT approval_status FROM jobs WHERE job_id = $1`,
        [jobId],
      );
      if (check.rowCount === 0) {
        return { ok: false, jobId, previousStatus: null, error: `Job ${jobId} not found` };
      }
      const current = check.rows[0]?.approval_status ?? null;
      return { ok: false, jobId, previousStatus: current, error: `Job is not in pending_approval state (current: ${current ?? 'null'})` };
    }
    return { ok: true, jobId, previousStatus: 'pending_approval' };
  } catch (err) {
    return { ok: false, jobId, previousStatus: null, error: String(err) };
  } finally {
    client.release();
  }
}

export async function rejectVOJob(jobId: string): Promise<ApproveVOJobResult> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query<{ previous_status: string }>(
      `UPDATE jobs
          SET approval_status = 'rejected',
              job_status = 'failed',
              error_message = 'Rejected via Brain Console'
        WHERE job_id = $1
          AND approval_status = 'pending_approval'
    RETURNING approval_status AS previous_status`,
      [jobId],
    );
    if (result.rowCount === 0) {
      const check = await client.query<{ approval_status: string }>(
        `SELECT approval_status FROM jobs WHERE job_id = $1`,
        [jobId],
      );
      if (check.rowCount === 0) {
        return { ok: false, jobId, previousStatus: null, error: `Job ${jobId} not found` };
      }
      const current = check.rows[0]?.approval_status ?? null;
      return { ok: false, jobId, previousStatus: current, error: `Job is not in pending_approval state (current: ${current ?? 'null'})` };
    }
    return { ok: true, jobId, previousStatus: 'pending_approval' };
  } catch (err) {
    return { ok: false, jobId, previousStatus: null, error: String(err) };
  } finally {
    client.release();
  }
}
