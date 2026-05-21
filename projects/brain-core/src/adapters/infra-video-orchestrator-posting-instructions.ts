import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

export interface InfraVOPostingInstructionsResponse {
  ok: boolean;
  jobId: string;
  platform: string | null;
  account: string | null;
  content: string;
  exists: boolean;
  error?: string;
}

let _pool: pg.Pool | null = null;
let _packagesDir: string | null = null;

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

export function _injectPackagesDirForTesting(packagesDir: string | null): void {
  _packagesDir = packagesDir;
}

export async function getInfraVOPostingInstructions(jobIdInput: string): Promise<InfraVOPostingInstructionsResponse> {
  const jobId = jobIdInput.trim();
  if (!/^[a-f0-9-]{8,64}$/i.test(jobId)) {
    return {
      ok: false,
      jobId,
      platform: null,
      account: null,
      content: '',
      exists: false,
      error: 'Invalid VO job id',
    };
  }

  let platform: string | null = null;
  let account: string | null = null;
  let resolvedJobId = jobId;

  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      const result = await client.query<{
        job_id: string;
        platform: string | null;
        account_handle: string | null;
      }>(
        `SELECT j.job_id,
                j.task_config->>'platform' AS platform,
                COALESCE(a.account_handle, j.task_config->>'account_handle', j.task_config->>'account_id') AS account_handle
           FROM jobs j
           LEFT JOIN accounts a
             ON (j.task_config->>'account_id') ~* '^[0-9a-f-]{36}$'
            AND a.account_id = (j.task_config->>'account_id')::uuid
          WHERE j.job_id::text LIKE $1
          LIMIT 1`,
        [`${jobId}%`],
      );
      const row = result.rows[0];
      if (row) {
        resolvedJobId = row.job_id;
        platform = row.platform ?? null;
        account = row.account_handle ?? null;
      }
    } finally {
      client.release();
    }
  } catch {
    return {
      ok: false,
      jobId,
      platform: null,
      account: null,
      content: '',
      exists: false,
      error: 'VO DB unreachable',
    };
  }

  const instructionsPath = path.join(resolvePackagesDir(), resolvedJobId.slice(0, 8), 'posting_instructions.md');
  try {
    const content = fs.readFileSync(instructionsPath, 'utf8');
    return {
      ok: true,
      jobId: resolvedJobId,
      platform,
      account,
      content,
      exists: true,
    };
  } catch {
    return {
      ok: true,
      jobId: resolvedJobId,
      platform,
      account,
      content: '',
      exists: false,
    };
  }
}

function resolvePackagesDir(): string {
  return _packagesDir ?? process.env.VO_PACKAGES_DIR ?? path.join(process.env.HOME || '/Users/Office', '.local/video-orchestrator/packages');
}
