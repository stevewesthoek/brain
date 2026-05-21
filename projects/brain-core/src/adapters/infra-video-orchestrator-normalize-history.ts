import { readdir } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import type { BrainCoreInfraVONormalizeHistoryResponse } from '../types/api.js';

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

async function listMp4s(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir);
    return entries.filter(f => f.endsWith('.mp4')).map(f => path.join(dir, f));
  } catch {
    return [];
  }
}

export async function getInfraVONormalizeHistory(opts: { limit?: number; offset?: number } = {}): Promise<BrainCoreInfraVONormalizeHistoryResponse> {
  const limit = Math.min(opts.limit ?? 20, 100);
  const offset = opts.offset ?? 0;

  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const result = await client.query<{
        job_id: string;
        job_status: string;
        task_config: Record<string, unknown>;
        created_at: Date;
        completed_at: Date | null;
        error_message: string | null;
      }>(
        `SELECT job_id, job_status, task_config, created_at, completed_at, error_message
           FROM jobs
          WHERE job_type = 'normalize'
          ORDER BY created_at DESC
          LIMIT $1 OFFSET $2`,
        [limit, offset],
      );

      const countResult = await client.query<{ cnt: string }>(
        `SELECT COUNT(*) AS cnt FROM jobs WHERE job_type = 'normalize'`,
      );
      const totalCount = parseInt(countResult.rows[0]?.cnt ?? '0', 10);
      const packagesDir = resolvePackagesDir();

      const jobs = await Promise.all(result.rows.map(async (row) => {
        const cfg = row.task_config ?? {};
        const jobIdShort = row.job_id.slice(0, 8);
        const outputDir = typeof cfg['output_dir'] === 'string' ? cfg['output_dir'] : '';
        const formatKeys: string[] = Array.isArray(cfg['format_keys']) ? (cfg['format_keys'] as string[]) : [];

        let outputFiles = outputDir ? await listMp4s(outputDir) : [];
        if (!outputFiles.length) {
          outputFiles = await listMp4s(path.join(packagesDir, jobIdShort));
        }

        return {
          jobId: row.job_id,
          status: row.job_status,
          inputPath: typeof cfg['master_path'] === 'string' ? cfg['master_path'] : '',
          outputDir,
          formats: formatKeys,
          createdAt: row.created_at.toISOString(),
          completedAt: row.completed_at ? row.completed_at.toISOString() : null,
          errorMessage: row.error_message ?? null,
          outputFiles,
        };
      }));

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
