import { execFileSync } from 'node:child_process';
import path from 'node:path';

const LAUNCHD_LABEL = 'com.office.video-orchestrator-worker';
const LOG_PATH = path.join(
  process.env.HOME || '/Users/Office',
  '.local/video-orchestrator/logs/worker.log',
);

export interface InfraVOWorkerHealthResponse {
  ok: boolean;
  status: 'running' | 'stopped' | 'degraded';
  pid: number | null;
  label: string;
  logPath: string;
  detail: string;
  error?: string;
}

export function getInfraVOWorkerHealth(): InfraVOWorkerHealthResponse {
  try {
    const output = execFileSync('launchctl', ['list', LAUNCHD_LABEL], {
      encoding: 'utf8',
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const pidMatch = /"PID"\s*=\s*(\d+)/.exec(output) ?? /"PID" = (\d+)/.exec(output);
    const lastExitMatch = /"LastExitStatus"\s*=\s*(\d+)/.exec(output) ?? /"LastExitStatus" = (\d+)/.exec(output);
    const pid = pidMatch ? parseInt(pidMatch[1] ?? '0', 10) : null;
    const lastExit = lastExitMatch ? parseInt(lastExitMatch[1] ?? '0', 10) : 0;

    if (pid && pid > 0) {
      return {
        ok: true,
        status: 'running',
        pid,
        label: LAUNCHD_LABEL,
        logPath: LOG_PATH,
        detail: `Worker running under launchd (PID ${pid}).`,
      };
    }

    return {
      ok: true,
      status: lastExit === 0 ? 'stopped' : 'degraded',
      pid: null,
      label: LAUNCHD_LABEL,
      logPath: LOG_PATH,
      detail: lastExit === 0
        ? 'Worker is not running.'
        : `Worker is not running and last exit status was ${lastExit}.`,
    };
  } catch (error) {
    return {
      ok: false,
      status: 'stopped',
      pid: null,
      label: LAUNCHD_LABEL,
      logPath: LOG_PATH,
      detail: 'Worker launchd record could not be read.',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
