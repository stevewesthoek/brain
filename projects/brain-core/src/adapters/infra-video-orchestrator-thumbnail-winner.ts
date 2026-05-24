import pg from 'pg';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DeclareThumbnailWinnerRequest {
  jobId: string;
  variantId: string;
  reason?: 'manual' | 'auto-ctr' | 'time-slice' | string;
}

export interface DeclareThumbnailWinnerResponse {
  ok: boolean;
  jobId: string;
  winningVariantId: string;
  winner_declared_at: string;
  re_applied_to_youtube: boolean;
  error?: string;
}

// ── Internal types for DB rows ────────────────────────────────────────────────

interface ThumbnailVariant {
  id: string;
  active?: boolean;
  [key: string]: unknown;
}

interface ThumbnailArtifact {
  variants?: ThumbnailVariant[];
  winner_declared_at?: string;
  [key: string]: unknown;
}

interface JobRow {
  job_id: string;
  task_config: Record<string, unknown>;
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

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Attempt to re-apply the winning thumbnail to YouTube.
 * Returns true if successful, false if not available or errored.
 * This is a best-effort call; the winner is still declared even if it fails.
 */
async function trySetYoutubeThumbnail(
  jobId: string,
  variantId: string,
): Promise<boolean> {
  try {
    // Attempt to call the YouTube uploader's set_thumbnail via subprocess.
    // If the script is unavailable, we degrade gracefully.
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);

    const scriptPath = [
      process.env.HOME ?? '/root',
      '.local/video-orchestrator/scripts/set_thumbnail.py',
    ].join('/');

    await execFileAsync('python3', [scriptPath, '--job-id', jobId, '--variant-id', variantId], {
      timeout: 30_000,
    });
    return true;
  } catch {
    // Script not available or failed — degrade gracefully
    return false;
  }
}

// ── Main function ─────────────────────────────────────────────────────────────

export async function declareThumbnailWinner(
  req: DeclareThumbnailWinnerRequest,
): Promise<DeclareThumbnailWinnerResponse> {
  const { jobId, variantId } = req;
  const winnerDeclaredAt = new Date().toISOString();

  const pool = getPool();

  try {
    const client = await pool.connect();
    try {
      // 1. Read the job from the jobs table
      const jobResult = await client.query<JobRow>(
        `SELECT job_id, task_config FROM jobs WHERE job_id = $1`,
        [jobId],
      );

      if (jobResult.rowCount === 0 || !jobResult.rows[0]) {
        return {
          ok: false,
          jobId,
          winningVariantId: variantId,
          winner_declared_at: winnerDeclaredAt,
          re_applied_to_youtube: false,
          error: `Job ${jobId} not found`,
        };
      }

      const jobRow = jobResult.rows[0];
      const taskConfig = jobRow.task_config;

      // 2. Extract the thumbnail artifact from task_config
      const artifact = (taskConfig['thumbnail_artifact'] ?? taskConfig['artifact'] ?? null) as ThumbnailArtifact | null;

      if (!artifact) {
        return {
          ok: false,
          jobId,
          winningVariantId: variantId,
          winner_declared_at: winnerDeclaredAt,
          re_applied_to_youtube: false,
          error: `Job ${jobId} has no thumbnail artifact`,
        };
      }

      // 3. Find the matching variant
      const variants: ThumbnailVariant[] = Array.isArray(artifact.variants) ? artifact.variants : [];
      const targetVariant = variants.find((v) => v.id === variantId);

      if (!targetVariant) {
        return {
          ok: false,
          jobId,
          winningVariantId: variantId,
          winner_declared_at: winnerDeclaredAt,
          re_applied_to_youtube: false,
          error: `Variant ${variantId} not found in job ${jobId}`,
        };
      }

      // 4. Set the winning variant as active and record the winner timestamp
      const updatedVariants: ThumbnailVariant[] = variants.map((v) => ({
        ...v,
        active: v.id === variantId,
      }));

      const updatedArtifact: ThumbnailArtifact = {
        ...artifact,
        variants: updatedVariants,
        winner_declared_at: winnerDeclaredAt,
      };

      // 5. Update the job's task_config with the new artifact
      const updatedTaskConfig: Record<string, unknown> = { ...taskConfig };
      if ('thumbnail_artifact' in taskConfig) {
        updatedTaskConfig['thumbnail_artifact'] = updatedArtifact;
      } else {
        updatedTaskConfig['artifact'] = updatedArtifact;
      }

      await client.query(
        `UPDATE jobs SET task_config = $1 WHERE job_id = $2`,
        [JSON.stringify(updatedTaskConfig), jobId],
      );

      // 6. Attempt to re-apply to YouTube (best-effort)
      const reApplied = await trySetYoutubeThumbnail(jobId, variantId);

      return {
        ok: true,
        jobId,
        winningVariantId: variantId,
        winner_declared_at: winnerDeclaredAt,
        re_applied_to_youtube: reApplied,
      };
    } finally {
      client.release();
    }
  } catch (err) {
    return {
      ok: false,
      jobId,
      winningVariantId: variantId,
      winner_declared_at: winnerDeclaredAt,
      re_applied_to_youtube: false,
      error: String(err),
    };
  }
}
