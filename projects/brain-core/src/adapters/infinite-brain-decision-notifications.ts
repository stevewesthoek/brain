import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { InfiniteBrainDecisionQueue } from './infinite-brain-decision-core.js';
import { computeDecisionNotificationPlan } from './infinite-brain-decision-runtime.mjs';

const DEFAULT_RELATIVE_PATH = 'runtime/local/infinite-brain/decision-notification-state.json';
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const BRAIN_ROOT = path.resolve(MODULE_DIR, '..', '..', '..', '..');

export type InfiniteBrainDecisionNotificationKind = 'attention' | 'daily-digest';

export interface InfiniteBrainDecisionNotification {
  id: string;
  kind: InfiniteBrainDecisionNotificationKind;
  generatedAt: string;
  reasons: Array<'high-priority' | 'zero-to-pending' | 'daily-digest'>;
  pendingCount: number;
  highPriorityPendingCount: number;
  decisionIds: string[];
  message: string;
  sensitiveSourceTextIncluded: false;
}

interface InfiniteBrainDecisionNotificationState {
  schemaVersion: '1.0.0';
  lastPendingCount: number;
  notifiedHighDecisionIds: string[];
  lastDigestDate: string | null;
  updatedAt: string;
}

function getNotificationStatePath(): string {
  const envPath = process.env.IBR_DECISION_NOTIFICATION_STATE_PATH;
  if (envPath) return path.isAbsolute(envPath) ? envPath : path.resolve(BRAIN_ROOT, envPath);
  return path.resolve(BRAIN_ROOT, DEFAULT_RELATIVE_PATH);
}

function readState(): InfiniteBrainDecisionNotificationState {
  try {
    const parsed = JSON.parse(fs.readFileSync(getNotificationStatePath(), 'utf8')) as Partial<InfiniteBrainDecisionNotificationState>;
    return {
      schemaVersion: '1.0.0',
      lastPendingCount: Number.isInteger(parsed.lastPendingCount) ? Math.max(0, parsed.lastPendingCount ?? 0) : 0,
      notifiedHighDecisionIds: Array.isArray(parsed.notifiedHighDecisionIds)
        ? parsed.notifiedHighDecisionIds.filter((value): value is string => typeof value === 'string')
        : [],
      lastDigestDate: typeof parsed.lastDigestDate === 'string' ? parsed.lastDigestDate : null,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
    };
  } catch {
    return {
      schemaVersion: '1.0.0',
      lastPendingCount: 0,
      notifiedHighDecisionIds: [],
      lastDigestDate: null,
      updatedAt: new Date(0).toISOString(),
    };
  }
}

function writeState(state: InfiniteBrainDecisionNotificationState): boolean {
  const filePath = getNotificationStatePath();
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmpPath = `${filePath}.tmp-${process.pid}`;
    fs.writeFileSync(tmpPath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(tmpPath, filePath);
    return true;
  } catch {
    return false;
  }
}

export function computeInfiniteBrainDecisionNotifications(
  queue: InfiniteBrainDecisionQueue,
  previousState: InfiniteBrainDecisionNotificationState,
  now: Date = new Date(),
): { notifications: InfiniteBrainDecisionNotification[]; nextState: InfiniteBrainDecisionNotificationState } {
  return computeDecisionNotificationPlan(queue, previousState, now) as {
    notifications: InfiniteBrainDecisionNotification[];
    nextState: InfiniteBrainDecisionNotificationState;
  };
}

export function pollInfiniteBrainDecisionNotifications(
  queue: InfiniteBrainDecisionQueue,
  now: Date = new Date(),
): { ok: boolean; notifications: InfiniteBrainDecisionNotification[]; pendingCount: number; statePath: string } {
  const previousState = readState();
  const { notifications, nextState } = computeInfiniteBrainDecisionNotifications(queue, previousState, now);
  const ok = writeState(nextState);
  return {
    ok,
    notifications: ok ? notifications : [],
    pendingCount: queue.counts.pending,
    statePath: path.relative(BRAIN_ROOT, getNotificationStatePath()) || DEFAULT_RELATIVE_PATH,
  };
}
