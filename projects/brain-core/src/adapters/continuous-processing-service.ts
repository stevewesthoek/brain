/**
 * Continuous Processing Service Runner.
 *
 * Manages a polling loop that periodically checks and runs the mind-steward
 * inbox queue dry-run workflow. The service is created in a stopped state and
 * must be explicitly started. All execution is gated behind feature flags and
 * the kill switch.
 *
 * Safety guarantees:
 * - Does not write to Mind
 * - Does not move or delete captures
 * - Does not write to Kanban
 * - Disabled by default (must be explicitly started)
 * - Requires feature flag and kill switch off before any execution
 * - Pauses automatically after 5 consecutive failures
 * - One job at a time (internal concurrency cap)
 */

import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  refreshMindStewardInboxQueue,
  enforceMindStewardInboxQueuePolicy,
  recordMindStewardInboxQueueFailure,
  recordMindStewardInboxQueueVideoOutcome,
  type MindStewardInboxQueueItem,
} from './mind-steward-inbox-queue.js';
import { dispatchMindStewardVideoCapture } from './mind-steward-video-dispatcher.js';
import {
  isExecutionKillSwitchEnabled,
  isMindStewardInboxQueueDryRunExecutionFlagEnabled,
} from './execution-plans.js';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
// From src/adapters/ → src/ → brain-core/ → projects/ → brain/
const BRAIN_ROOT = path.resolve(MODULE_DIR, '..', '..', '..', '..');

const CONSECUTIVE_FAILURE_PAUSE_THRESHOLD = 5;

const SAFETY = {
  writesToMind: false,
  movesCaptures: false,
  deletesCaptures: false,
  writesKanban: false,
  localOnly: true,
  disabledByDefault: true,
  requiresFeatureFlag: true,
  requiresKillSwitchOff: true,
} as const;

export interface ContinuousProcessingServiceOptions {
  pollingIntervalMs?: number;
  mindRoot?: string;
  statePath?: string;
}

export interface ContinuousProcessingServiceStatus {
  id: 'continuous-processing-service';
  running: boolean;
  enabled: boolean;
  pollingIntervalMs: number;
  iterationCount: number;
  lastIterationAt: string | null;
  lastRunAt: string | null;
  runCount: number;
  failureCount: number;
  consecutiveFailures: number;
  paused: boolean;
  pausedReason: string | null;
  safety: typeof SAFETY;
}

export interface ContinuousProcessingService {
  start(): void;
  stop(): void;
  getStatus(): ContinuousProcessingServiceStatus;
}

export function createContinuousProcessingService(
  options: ContinuousProcessingServiceOptions = {},
): ContinuousProcessingService {
  const pollingIntervalMs = options.pollingIntervalMs ?? 60_000;
  const mindRoot = options.mindRoot ?? process.env.BRAIN_CORE_MIND_STEWARD_MIND_ROOT;
  const statePath = options.statePath ?? process.env.BRAIN_CORE_MIND_STEWARD_INBOX_QUEUE_STATE_PATH;

  // Mutable service state
  let running = false;
  let intervalHandle: ReturnType<typeof setInterval> | null = null;
  let iterationCount = 0;
  let lastIterationAt: string | null = null;
  let lastRunAt: string | null = null;
  let runCount = 0;
  let failureCount = 0;
  let consecutiveFailures = 0;
  let paused = false;
  let pausedReason: string | null = null;
  let jobRunning = false;

  // Build options objects with only defined properties (exactOptionalPropertyTypes)
  function buildRefreshOptions() {
    return {
      ...(mindRoot !== undefined ? { mindRoot } : {}),
      ...(statePath !== undefined ? { statePath } : {}),
    };
  }

  async function runOneTick(): Promise<void> {
    iterationCount += 1;
    lastIterationAt = new Date().toISOString();

    // Gate 1: kill switch
    if (isExecutionKillSwitchEnabled()) {
      return;
    }

    // Gate 2: feature flag
    if (!isMindStewardInboxQueueDryRunExecutionFlagEnabled()) {
      return;
    }

    // Gate 3: paused due to consecutive failures
    if (paused) {
      return;
    }

    // Gate 4: one-job concurrency cap
    if (jobRunning) {
      return;
    }

    jobRunning = true;
    try {
      // Refresh queue state
      const queueState = refreshMindStewardInboxQueue(buildRefreshOptions());

      // Check policy
      const policy = enforceMindStewardInboxQueuePolicy({
        state: queueState,
        featureFlagEnabled: true,
        ...(lastRunAt !== null ? { lastRunAt } : {}),
      });

      if (!policy.canStartRun) {
        // Not an error — just not ready yet
        return;
      }

      // Video captures use the same queue lifecycle but dispatch through the
      // canonical Brain video operation. Persistence produces a reviewed
      // Apply-one preview; it does not write to Mind from this worker.
      const videoItem = policy.selectedItems.find((item) => /\.(?:md|txt|mp4|webm|mov|mkv|m4v|avi|flv|wmv)$/i.test(item.path));
      if (videoItem) {
        const dispatched = await dispatchMindStewardVideoCapture(videoItem, { mindRoot: queueState.mindRoot });
        if (dispatched.kind === 'video' && dispatched.result) {
          const persistenceStatus = dispatched.result.persistence?.status;
          const canMarkDone = persistenceStatus === 'already_applied' || persistenceStatus === 'applied';
          recordMindStewardInboxQueueVideoOutcome({
            capturePath: videoItem.path,
            jobId: dispatched.result.job_id,
            status: canMarkDone ? 'done' : 'blocked',
            error: canMarkDone ? null : 'video_analysis_result_requires_mind_apply_one_approval',
            ...(statePath !== undefined ? { statePath } : {}),
          });
          runCount += 1;
          consecutiveFailures = 0;
          lastRunAt = new Date().toISOString();
          return;
        }
      }

      // Run the dry-run report shell script
      const brainRoot = BRAIN_ROOT;
      const result = spawnSync(
        'bash',
        ['tools/scripts/mind-steward-inbox-queue-dry-run-report.sh'],
        {
          cwd: brainRoot,
          encoding: 'utf8',
          timeout: 300_000, // 5 minute timeout
          env: {
            ...process.env,
            ...(mindRoot !== undefined ? { MIND_STEWARD_MIND_ROOT: mindRoot } : {}),
          },
        },
      );

      if (result.error || result.status !== 0) {
        const errorMessage = result.error?.message
          ?? result.stderr?.toString()?.trim()
          ?? `exit code ${result.status}`;
        throw new Error(`dry-run-report script failed: ${errorMessage}`);
      }

      // Success
      runCount += 1;
      consecutiveFailures = 0;
      lastRunAt = new Date().toISOString();
    } catch (err) {
      failureCount += 1;
      consecutiveFailures += 1;

      // Record failure for each selected item
      const errMessage = err instanceof Error ? err.message : String(err);
      try {
        const currentState = refreshMindStewardInboxQueue(buildRefreshOptions());
        const selectedItems: MindStewardInboxQueueItem[] = currentState.items.filter(
          item => item.selectedForSample,
        );
        for (const item of selectedItems) {
          recordMindStewardInboxQueueFailure({
            capturePath: item.path,
            error: errMessage,
            ...(statePath !== undefined ? { statePath } : {}),
          });
        }
      } catch {
        // Best-effort failure recording — do not cascade
      }

      if (consecutiveFailures >= CONSECUTIVE_FAILURE_PAUSE_THRESHOLD) {
        paused = true;
        pausedReason = 'consecutiveFailuresThresholdReached';
      }
    } finally {
      jobRunning = false;
    }
  }

  return {
    start(): void {
      if (running) return;
      running = true;
      intervalHandle = setInterval(() => {
        runOneTick().catch(() => {
          // runOneTick handles all errors internally; this is belt-and-suspenders
        });
      }, pollingIntervalMs);
    },

    stop(): void {
      if (!running) return;
      running = false;
      if (intervalHandle !== null) {
        clearInterval(intervalHandle);
        intervalHandle = null;
      }
    },

    getStatus(): ContinuousProcessingServiceStatus {
      const flagEnabled = isMindStewardInboxQueueDryRunExecutionFlagEnabled();
      const killSwitchOff = !isExecutionKillSwitchEnabled();
      return {
        id: 'continuous-processing-service',
        running,
        enabled: flagEnabled && killSwitchOff,
        pollingIntervalMs,
        iterationCount,
        lastIterationAt,
        lastRunAt,
        runCount,
        failureCount,
        consecutiveFailures,
        paused,
        pausedReason,
        safety: SAFETY,
      };
    },
  };
}
