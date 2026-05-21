import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import type { BrainCoreInfraVOManualQueueResponse } from '../types/api.js';

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

function resolvePackagesDir(): string {
  return process.env.VO_PACKAGES_DIR ?? path.join(process.env.HOME || '/Users/Office', '.local/video-orchestrator/packages');
}

export async function getInfraVOManualQueue(opts: { limit?: number; offset?: number } = {}): Promise<BrainCoreInfraVOManualQueueResponse> {
  const limit = Math.min(opts.limit ?? 20, 100);
  const offset = opts.offset ?? 0;

  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      // Jobs that ended in manual mode: succeeded post jobs where n8n dispatch failed
      // Detect by querying output json for adapter_mode=manual
      const result = await client.query<{
        job_id: string;
        job_status: string;
        task_config: Record<string, unknown>;
        output: Record<string, unknown> | null;
        created_at: Date;
        completed_at: Date | null;
        account_handle: string | null;
      }>(
        `SELECT j.job_id,
                j.job_status,
                j.task_config,
                j.output,
                j.created_at,
                j.completed_at,
                COALESCE(a.account_handle, j.task_config->>'account_handle', j.task_config->>'account_id') AS account_handle
           FROM jobs j
           LEFT JOIN accounts a
             ON (j.task_config->>'account_id') ~* '^[0-9a-f-]{36}$'
            AND a.account_id = (j.task_config->>'account_id')::uuid
          WHERE j.job_type = 'post'
            AND j.job_status = 'succeeded'
            AND (j.output->>'adapter_mode' = 'manual' OR j.output->>'status' = 'draft')
          ORDER BY j.created_at DESC
          LIMIT $1 OFFSET $2`,
        [limit, offset],
      );

      const countResult = await client.query<{ cnt: string }>(
        `SELECT COUNT(*) AS cnt FROM jobs
          WHERE job_type = 'post'
            AND job_status = 'succeeded'
            AND (output->>'adapter_mode' = 'manual' OR output->>'status' = 'draft')`,
      );
      const totalCount = parseInt(countResult.rows[0]?.cnt ?? '0', 10);

      const packagesDir = resolvePackagesDir();

      const jobs = result.rows.map((row) => {
        const cfg = row.task_config ?? {};
        const out = row.output ?? {};
        const jobIdShort = row.job_id.slice(0, 8);
        const instructionsPath = typeof out['instructions_path'] === 'string'
          ? out['instructions_path']
          : path.join(packagesDir, jobIdShort, 'posting_instructions.md');

        let hasInstructions = false;
        try {
          hasInstructions = fs.existsSync(instructionsPath);
        } catch {
          hasInstructions = false;
        }

        return {
          jobId: row.job_id,
          platform: typeof cfg['platform'] === 'string' ? cfg['platform'] : (typeof out['platform'] === 'string' ? out['platform'] : 'unknown'),
          accountHandle: row.account_handle ?? 'unknown',
          title: typeof cfg['title'] === 'string' ? cfg['title'] : 'untitled',
          videoPath: typeof cfg['video_path'] === 'string' ? cfg['video_path'] : '',
          instructionsPath,
          status: typeof out['status'] === 'string' ? out['status'] : 'draft',
          createdAt: row.created_at.toISOString(),
          hasInstructions,
        };
      });

      return { ok: true, jobs, totalCount };
    } finally {
      client.release();
    }
  } catch (err) {
    return {
      ok: false,
      jobs: [],
      totalCount: 0,
      error: err instanceof Error ? err.message : 'VO DB unreachable',
    };
  }
}
