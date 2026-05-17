import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { MindMaintenancePreviewQueue } from './maintenance-preview.js';

const DEFAULT_RUNTIME_ROOT = 'runtime/local/model-router/maintenance-previews';
const QUEUE_EXPIRY_HOURS = 24;

const BLOCKED_RUNTIME_ROOTS = [
  'mind',
  '.git',
  '.env',
  'node_modules',
  'dist',
  'build',
];

export interface WriteMaintenancePreviewArtifactInput {
  queue: MindMaintenancePreviewQueue;
  runtimeRoot?: string;
}

export interface MaintenancePreviewArtifactMeta {
  queueId: string;
  createdAt: string;
  expiresAt: string;
  actionCount: number;
  approvalRequiredCount: number;
}

function isRuntimeRootSafe(runtimeRoot: string): boolean {
  const normalized = path.normalize(runtimeRoot);

  // Check for traversal
  if (normalized.includes('..')) {
    return false;
  }

  // Check if it's a system-level absolute path (starts with / but not a user temp)
  // Allow user temp folders like /var/folders (macOS) or /tmp when created by tests
  // But reject things like /tmp/malicious or /etc/...
  if (normalized.startsWith('/') && !normalized.includes('runtime')) {
    return false;
  }

  // Check each blocked segment as a distinct directory component
  for (const blocked of BLOCKED_RUNTIME_ROOTS) {
    const pattern = new RegExp(`(^|/)${blocked}(/|$)`);
    if (pattern.test(normalized)) {
      return false;
    }
  }

  return true;
}

function createQueueId(queue: MindMaintenancePreviewQueue): string {
  const sortedActionIds = queue.actions.map((a) => a.id).sort();
  const input = `${queue.createdAt}:${sortedActionIds.join(',')}`;
  const hash = createHash('sha256').update(input).digest('hex').slice(0, 12);
  return `queue-${hash}`;
}

export function writeMaintenancePreviewArtifact(input: WriteMaintenancePreviewArtifactInput): MaintenancePreviewArtifactMeta {
  const runtimeRoot = input.runtimeRoot || DEFAULT_RUNTIME_ROOT;

  if (!isRuntimeRootSafe(runtimeRoot)) {
    throw new Error(`Unsafe runtime root for maintenance preview artifact: ${runtimeRoot}`);
  }

  const queueId = createQueueId(input.queue);
  const expiresAtDate = new Date(new Date(input.queue.createdAt).getTime() + QUEUE_EXPIRY_HOURS * 60 * 60 * 1000);

  // Create the artifact directory
  fs.mkdirSync(runtimeRoot, { recursive: true });

  // Write the queue artifact
  const artifactPath = path.join(runtimeRoot, `${queueId}.json`);
  const artifact = {
    ...input.queue,
    queueId,
    expiresAt: expiresAtDate.toISOString(),
  };

  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);

  // Write latest symlink metadata
  const latestPath = path.join(runtimeRoot, 'latest.json');
  const latestMeta = {
    queueId,
    createdAt: input.queue.createdAt,
    expiresAt: expiresAtDate.toISOString(),
    actionCount: input.queue.actions.length,
    approvalRequiredCount: input.queue.summary.approvalRequiredCount,
  };
  fs.writeFileSync(latestPath, `${JSON.stringify(latestMeta, null, 2)}\n`);

  return latestMeta;
}

export interface ListMaintenancePreviewArtifactsInput {
  runtimeRoot?: string;
}

export interface MaintenancePreviewArtifactListItem {
  queueId: string;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
  actionCount: number;
  approvalRequiredCount: number;
}

export function listMaintenancePreviewArtifacts(input: ListMaintenancePreviewArtifactsInput): MaintenancePreviewArtifactListItem[] {
  const runtimeRoot = input.runtimeRoot || DEFAULT_RUNTIME_ROOT;

  if (!isRuntimeRootSafe(runtimeRoot)) {
    throw new Error(`Unsafe runtime root for maintenance preview artifact listing: ${runtimeRoot}`);
  }

  if (!fs.existsSync(runtimeRoot)) {
    return [];
  }

  const items: MaintenancePreviewArtifactListItem[] = [];
  const files = fs.readdirSync(runtimeRoot).filter((f) => f.endsWith('.json') && f !== 'latest.json');

  const now = new Date();
  for (const file of files) {
    const filePath = path.join(runtimeRoot, file);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);
      const expiresAt = new Date(data.expiresAt);
      items.push({
        queueId: data.queueId,
        createdAt: data.createdAt,
        expiresAt: data.expiresAt,
        expired: expiresAt < now,
        actionCount: data.actions?.length ?? 0,
        approvalRequiredCount: data.summary?.approvalRequiredCount ?? 0,
      });
    } catch {
      // Skip malformed artifacts
    }
  }

  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export interface ReadMaintenancePreviewArtifactInput {
  queueId: string;
  runtimeRoot?: string;
}

export function readMaintenancePreviewArtifact(input: ReadMaintenancePreviewArtifactInput): MindMaintenancePreviewQueue | null {
  const runtimeRoot = input.runtimeRoot || DEFAULT_RUNTIME_ROOT;

  if (!isRuntimeRootSafe(runtimeRoot)) {
    throw new Error(`Unsafe runtime root for maintenance preview artifact read: ${runtimeRoot}`);
  }

  const artifactPath = path.join(runtimeRoot, `${input.queueId}.json`);
  if (!fs.existsSync(artifactPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(artifactPath, 'utf8');
    const data = JSON.parse(content);
    // Return the core queue, stripping any metadata we added
    return {
      kind: data.kind,
      createdAt: data.createdAt,
      source: data.source,
      actions: data.actions,
      summary: data.summary,
      writesToMind: data.writesToMind,
      externalSideEffects: data.externalSideEffects,
    } as MindMaintenancePreviewQueue;
  } catch {
    return null;
  }
}
