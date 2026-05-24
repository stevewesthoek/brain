import { execFile } from 'child_process';
import { promisify } from 'util';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import type {
  InfraVOStorageStats,
  InfraVOStorageCleanupRequest,
  InfraVOStorageCleanupResponse,
  InfraVOStorageCleanupCandidate,
} from '../types/api.js';

const execFileAsync = promisify(execFile);

/**
 * Read storage statistics across all VO directories.
 * Returns: directory counts, total size, oldest job age, and cleanup candidate estimates.
 */
export async function readStorageStats(): Promise<InfraVOStorageStats> {
  const homeDir = process.env.HOME || '/root';
  const dirs = [
    join(homeDir, '.local/video-orchestrator/data'),
    join(homeDir, '.local/video-orchestrator/packages'),
    join(homeDir, '.local/video-orchestrator/output'),
  ];

  let totalBytes = 0;
  let totalFiles = 0;
  let oldestJobAge: number | null = null;
  const now = Date.now();

  try {
    for (const dir of dirs) {
      try {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const { size, age } = await directoryStats(join(dir, entry.name));
            totalBytes += size;
            totalFiles += 1;
            if (oldestJobAge === null || age > oldestJobAge) {
              oldestJobAge = age;
            }
          }
        }
      } catch (error) {
        // Directory may not exist yet; that's OK
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }
    }
  } catch (error) {
    throw new Error(`Failed to read storage stats: ${String(error)}`);
  }

  return {
    ok: true,
    status: 'ok',
    dirs_scanned: dirs.length,
    total_files: totalFiles,
    total_bytes: totalBytes,
    oldest_job_age_seconds: oldestJobAge ?? 0,
    eligible_for_cleanup_30d: Math.floor((oldestJobAge ?? 0) / 86400) >= 30,
  };
}

/**
 * Recursively calculate directory size and age (in seconds).
 */
async function directoryStats(dir: string): Promise<{ size: number; age: number }> {
  const now = Date.now();
  let totalSize = 0;
  let oldestModTime = now;

  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      try {
        const stats = await stat(fullPath);
        // entry.isFile() / entry.isDirectory() work on Dirent, not Stats
        if (entry.isFile()) {
          totalSize += stats.size;
          oldestModTime = Math.min(oldestModTime, stats.mtime.getTime());
        } else if (entry.isDirectory()) {
          const sub = await directoryStats(fullPath);
          totalSize += sub.size;
          oldestModTime = Math.min(oldestModTime, sub.age * 1000);
        }
      } catch {
        // Skip files we can't stat
      }
    }
  } catch {
    // Directory may be unreadable; return 0 size
  }

  const ageSeconds = Math.floor((now - oldestModTime) / 1000);
  return { size: totalSize, age: ageSeconds };
}

/**
 * Trigger storage cleanup via the Python script.
 * Returns the cleanup result (candidate count, archived count, etc).
 */
export async function triggerStorageCleanup(
  req: InfraVOStorageCleanupRequest,
): Promise<InfraVOStorageCleanupResponse> {
  const scriptPath = join(
    process.env.HOME || '/root',
    '.local/video-orchestrator/scripts/storage_cleanup.py',
  );
  const args: string[] = ['run', '--days', String(req.retention_days ?? 30)];

  if (req.dry_run) {
    args.push('--dry-run');
  }

  try {
    const { stdout } = await execFileAsync('python3', [scriptPath, ...args], {
      timeout: 60000,
      maxBuffer: 10 * 1024 * 1024, // 10 MB
    });

    const result = JSON.parse(stdout);
    return {
      ok: true,
      status: result.status || 'ok',
      retention_days: result.retention_days || 30,
      dry_run: result.dry_run || req.dry_run || false,
      candidate_count: result.candidate_count || 0,
      archived_count: result.archived_count || 0,
      candidates: result.candidates || [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Storage cleanup failed: ${message}`);
  }
}
