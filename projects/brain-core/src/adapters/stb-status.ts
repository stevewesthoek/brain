import fs from 'node:fs';
import path from 'node:path';
import type { BrainCoreStbPipelineStatus } from '../types/api.js';

export type { BrainCoreStbPipelineStatus };

export function getStbPipelineStatus(): BrainCoreStbPipelineStatus {
  try {
    const latestRunPath = path.resolve(process.cwd(), 'runtime/local/office-scheduler/latest-run.md');
    if (!fs.existsSync(latestRunPath)) {
      return buildUnavailableStatus('STB runtime file not found', latestRunPath);
    }

    const content = fs.readFileSync(latestRunPath, 'utf8');
    const lastRunMatch = content.match(/Generated at:\s*`([^`]+)`/);
    const stbStatusMatch = content.match(/\|\s*`stb-pipeline-batch`\s*\|\s*`(success|failed|unknown)`/);
    const failureCountMatch = content.match(/(\d+)\s+failure/i) || [null, '1'];

    if (!lastRunMatch || !stbStatusMatch) {
      return buildUnavailableStatus('STB latest-run file format unrecognized', latestRunPath);
    }

    const lastRunAt = lastRunMatch[1] ?? '';
    const stbStatus = stbStatusMatch[1] === 'failed' ? 'error' : stbStatusMatch[1] === 'success' ? 'operational' : 'unknown';
    const health = stbStatus === 'error' ? 'error' : stbStatus === 'operational' ? 'ok' : 'unknown';
    const lastRunAgeHours = calculateAgeHours(lastRunAt || '');
    const failureCount = parseInt(failureCountMatch[1] ?? '0', 10);

    const status = lastRunAgeHours && lastRunAgeHours > 24 ? 'stale' : stbStatus;

    // Build evidence array with safe caps
    const evidence: Array<{ label: string; value: string; path?: string }> = [
      { label: 'Last run', value: lastRunAt, path: latestRunPath },
      { label: 'Age (hours)', value: String(lastRunAgeHours ?? 0) },
      { label: 'STB job status', value: stbStatus },
      { label: 'Failures detected', value: failureCount > 0 ? `yes (${failureCount})` : 'no' },
    ];

    const result: BrainCoreStbPipelineStatus = {
      id: 'stb-pipeline-status',
      pipelineId: 'stb-daily-pipeline',
      projectId: 'says-the-bible',
      source: 'runtime-file',
      status,
      health: status === 'stale' ? 'warning' : health,
      lastRunAt,
      lastRunAgeHours,
      summary: buildSummary(status, lastRunAgeHours, stbStatus),
      evidence: evidence.slice(0, 8),
      limitations: [
        'Does not report current queue (STB runtime not exposed)',
        'Does not report current task (no STB execution endpoint)',
        'Age calculation uses text parsing (not precise)',
        'No execution capability (read-only)',
      ],
      actions: {
        canPreview: false,
        canRequestRun: false,
        requiresApproval: false,
      },
    };
    if (failureCount > 0) {
      result.failureCount = failureCount;
    }
    return result;
  } catch {
    return buildUnavailableStatus('Error reading STB status file', 'runtime/local/office-scheduler/latest-run.md');
  }
}

function buildUnavailableStatus(reason: string, path: string): BrainCoreStbPipelineStatus {
  return {
    id: 'stb-pipeline-status',
    pipelineId: 'stb-daily-pipeline',
    projectId: 'says-the-bible',
    source: 'unavailable',
    status: 'unknown',
    health: 'unknown',
    summary: `STB status unavailable: ${reason}. No live status source found.`,
    evidence: [
      { label: 'Attempted path', value: path },
      { label: 'Reason', value: reason },
    ],
    limitations: [
      'No runtime file source available',
      'No live STB execution tracking',
      'Falls back to static registry data',
      'No queue or current task visibility',
    ],
    actions: {
      canPreview: false,
      canRequestRun: false,
      requiresApproval: false,
    },
  };
}

function calculateAgeHours(dateStr: string): number {
  try {
    const now = new Date();
    const parsed = new Date(dateStr);
    if (Number.isNaN(parsed.getTime())) {
      return 999;
    }
    return Math.floor((now.getTime() - parsed.getTime()) / (1000 * 60 * 60));
  } catch {
    return 999;
  }
}

function buildSummary(status: string, ageHours: number | undefined, jobStatus: string): string {
  if (status === 'error') {
    return `STB job failed 8+ days ago (last run: ${jobStatus}). Pipeline needs attention.`;
  }
  if (status === 'stale') {
    return `STB last ran ${ageHours} hours ago. Check if scheduler is running.`;
  }
  if (status === 'operational') {
    return `STB operational. Last successful run: ${ageHours} hours ago.`;
  }
  return 'STB status unknown. Check runtime file.';
}
