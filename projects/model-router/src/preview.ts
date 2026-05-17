import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const MIND_PREVIEW_ALLOWED_TARGETS = [
  'router/current.md',
  'capture/inbox/',
  'capture/failed/',
  'live/tasks.md',
  'live/projects.md',
  'live/decisions.md',
  'sources/index.md',
  'wiki/index.md',
] as const;

export const MIND_PREVIEW_BLOCKED_PREFIXES = [
  '.git/',
  '.obsidian/',
  'node_modules/',
  'dist/',
  'build/',
  'coverage/',
  'runtime/',
  'logs/',
  '01-inbox/',
  '02-strategy/',
  '03-projects/',
  '04-tasks/',
  '05-areas/',
  '06-resources/',
  '07-templates/',
  '08-archive/',
  'archive/old/',
] as const;

export const MIND_PREVIEW_BLOCKED_EXACT_PATHS = ['.env'] as const;
export const MIND_PREVIEW_BLOCKED_SUFFIXES = ['.env'] as const;

export type MindPreviewOperation = 'patch' | 'overwrite' | 'create';
export type MindPreviewActionKind = 'model-router-update-current-context';

export interface MindPreviewApprovalRecord {
  id: string;
  kind: MindPreviewActionKind;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  expiresAt?: string;
  previewHash: string;
}

export interface MindPreviewPolicyResult {
  targetPath: string;
  allowedRoot: boolean;
  blockedRoot: boolean;
  reasons: string[];
}

export interface CreateMindWritePreviewInput {
  actionKind: MindPreviewActionKind;
  targetPath: string;
  operation: MindPreviewOperation;
  oldContent: string | null;
  newContent: string;
  now?: Date;
}

export interface MindWritePreview {
  kind: 'model-router-mind-preview';
  actionKind: MindPreviewActionKind;
  mindRootId: 'mind';
  targetPath: string;
  operation: MindPreviewOperation;
  allowedRoot: boolean;
  blockedRoot: boolean;
  policyReasons: string[];
  oldHash: string | null;
  newHash: string;
  lineCountBefore: number;
  lineCountAfter: number;
  maxLines: number | null;
  unifiedDiff: string;
  writesToMind: false;
  externalSideEffects: false;
  createdAt: string;
}

export interface MindWriteApplyInput {
  preview: MindWritePreview;
  approval: MindPreviewApprovalRecord | null;
  now?: Date;
}

export interface MindWriteApplyResult {
  kind: 'model-router-mind-apply';
  actionKind: MindPreviewActionKind;
  targetPath: string;
  applied: boolean;
  writesToMind: boolean;
  externalSideEffects: false;
  approvalId: string;
  previewHash: string;
  oldHash: string | null;
  newHash: string;
  rollback: {
    targetPath: string;
    restoreContentHash: string | null;
    validation: 'rerun-model-router-validation';
    instructions: string;
  };
  audit: {
    event: 'applied' | 'blocked';
    approvalId: string;
    previewHash: string;
    kind: MindPreviewActionKind;
    targetPath: string;
    writesToMind: boolean;
    externalSideEffects: false;
    status: 'ok' | 'blocked';
    appliedAt: string | null;
    oldHash: string | null;
    newHash: string;
  };
  validation: {
    accepted: boolean;
    reasons: string[];
  };
}

export interface MindPreviewArtifact {
  previewId: string;
  createdAt: string;
  expiresAt: string;
  actionKind: MindPreviewActionKind;
  targetPath: string;
  operation: MindPreviewOperation;
  oldHash: string | null;
  newHash: string;
  lineCountBefore: number;
  lineCountAfter: number;
  maxLines: number | null;
  unifiedDiff: string;
  writesToMind: false;
  externalSideEffects: false;
  policyReasons: string[];
  blockedRoot: boolean;
  allowedRoot: boolean;
}

export interface MindPreviewArtifactSummary {
  previewId: string;
  createdAt: string;
  expiresAt: string;
  actionKind: MindPreviewActionKind;
  targetPath: string;
  operation: MindPreviewOperation;
  blockedRoot: boolean;
  allowedRoot: boolean;
  expired: boolean;
  writesToMind: false;
  externalSideEffects: false;
}

export interface WriteMindPreviewArtifactInput {
  preview: MindWritePreview;
  previewId?: string;
  expiresAt?: Date;
  runtimeRoot?: string;
}

export interface WriteMindPreviewArtifactResult {
  artifact: MindPreviewArtifact;
  artifactPath: string;
  safeRoot: string;
}

export interface ListMindPreviewArtifactsInput {
  runtimeRoot?: string;
  now?: Date;
}

export interface ReadMindPreviewArtifactInput {
  previewId: string;
  runtimeRoot?: string;
  now?: Date;
}

const LINE_LIMITS: Partial<Record<string, number>> = {
  'router/current.md': 150,
  'live/tasks.md': 300,
  'live/projects.md': 250,
};

const PREVIEW_RUNTIME_ROOT = path.join('runtime', 'local', 'model-router', 'previews');
const PREVIEW_RUNTIME_DISALLOWED_SEGMENTS = ['..', '.env', '.git', 'node_modules', 'dist', 'build', 'mind'];

export function evaluateMindPreviewPolicy(targetPath: string): MindPreviewPolicyResult {
  const normalized = normalizeMindPath(targetPath);
  const reasons: string[] = [];

  if (normalized !== targetPath) {
    reasons.push('Target path was normalized before policy evaluation.');
  }

  if (!normalized || normalized.startsWith('/') || normalized.includes('..')) {
    reasons.push('Target path must be a repo-relative Mind path without traversal.');
  }

  const blockedByPrefix = MIND_PREVIEW_BLOCKED_PREFIXES.find((prefix) => normalized.startsWith(prefix));
  const blockedByExact = MIND_PREVIEW_BLOCKED_EXACT_PATHS.includes(
    normalized as (typeof MIND_PREVIEW_BLOCKED_EXACT_PATHS)[number],
  );
  const blockedBySuffix = MIND_PREVIEW_BLOCKED_SUFFIXES.some((suffix) => normalized.endsWith(`/${suffix}`));
  const blockedRoot = Boolean(blockedByPrefix || blockedByExact || blockedBySuffix);

  if (blockedByPrefix) reasons.push(`Target path is blocked by prefix ${blockedByPrefix}.`);
  if (blockedByExact) reasons.push(`Target path is blocked by exact path ${normalized}.`);
  if (blockedBySuffix) reasons.push('Target path is blocked because env files are not allowed.');

  const allowedRoot = MIND_PREVIEW_ALLOWED_TARGETS.some((allowedPath) => {
    if (allowedPath.endsWith('/')) return normalized.startsWith(allowedPath);
    return normalized === allowedPath;
  });

  if (!allowedRoot) reasons.push('Target path is not in the preview allowed target list.');
  if (allowedRoot && !blockedRoot && reasons.length === 0) reasons.push('Target path is allowed for preview-only planning.');

  return {
    targetPath: normalized,
    allowedRoot,
    blockedRoot,
    reasons,
  };
}

export function createMindWritePreview(input: CreateMindWritePreviewInput): MindWritePreview {
  const policy = evaluateMindPreviewPolicy(input.targetPath);
  const oldContent = input.oldContent ?? '';
  const maxLines = LINE_LIMITS[policy.targetPath] ?? null;
  const lineCountAfter = countLines(input.newContent);
  const policyReasons = [...policy.reasons];

  if (maxLines !== null && lineCountAfter > maxLines) {
    policyReasons.push(`Target content exceeds ${maxLines} line limit.`);
  }

  if (containsLiveLookingSecret(input.newContent)) {
    policyReasons.push('Target content contains live-looking secret material.');
  }

  return {
    kind: 'model-router-mind-preview',
    actionKind: input.actionKind,
    mindRootId: 'mind',
    targetPath: policy.targetPath,
    operation: input.operation,
    allowedRoot: policy.allowedRoot,
    blockedRoot: policy.blockedRoot || policyReasons.some((reason) => reason.includes('secret material')),
    policyReasons,
    oldHash: input.oldContent === null ? null : hashContent(input.oldContent),
    newHash: hashContent(input.newContent),
    lineCountBefore: input.oldContent === null ? 0 : countLines(input.oldContent),
    lineCountAfter,
    maxLines,
    unifiedDiff: createSimpleUnifiedDiff(policy.targetPath, oldContent, input.newContent),
    writesToMind: false,
    externalSideEffects: false,
    createdAt: (input.now ?? new Date()).toISOString(),
  };
}

export function applyApprovedMindWritePreview(
  input: MindWriteApplyInput,
): MindWriteApplyResult {
  const reasons: string[] = [];
  const preview = input.preview;
  const approval = input.approval;
  const approvedAt = (input.now ?? new Date()).toISOString();
  const allowedPreviewHash = preview.newHash;

  if (preview.actionKind !== 'model-router-update-current-context') {
    reasons.push('Exact action kind model-router-update-current-context is required.');
  }

  if (preview.targetPath !== 'router/current.md') {
    reasons.push('Target path must be exactly router/current.md.');
  }

  if (!preview.allowedRoot || preview.blockedRoot) {
    reasons.push(`Preview target ${preview.targetPath} is not an allowed unblocked Mind root.`);
  }

  if (preview.targetPath !== 'router/current.md') {
    reasons.push('Preview target path must be router/current.md.');
  }

  for (const reason of preview.policyReasons) {
    if (reason.includes('allowed for preview-only planning')) {
      continue;
    }
    if (!reasons.includes(reason)) {
      reasons.push(reason);
    }
  }

  if (preview.maxLines !== 150) {
    reasons.push('router/current.md must use the 150 line limit.');
  }

  if (preview.lineCountAfter > 150) {
    reasons.push('router/current.md content exceeds the 150 line limit.');
  }

  if (containsLiveLookingSecret(preview.unifiedDiff) || containsLiveLookingSecret(preview.newHash)) {
    reasons.push('Preview content contains live-looking secret material.');
  }

  if (!approval) {
    reasons.push('Approval record is required.');
  } else {
    if (approval.kind !== 'model-router-update-current-context') {
      reasons.push('Approval kind must match the action kind.');
    }

    if (approval.status !== 'approved') {
      reasons.push('Approval status must be approved.');
    }

    if (typeof approval.expiresAt === 'string' && Date.parse(approval.expiresAt) <= Date.parse(approvedAt)) {
      reasons.push('Approval is expired.');
    }

    if (approval.previewHash !== allowedPreviewHash) {
      reasons.push('Approval preview hash does not match the approved preview.');
    }
  }

  const applied = reasons.length === 0;

  return {
    kind: 'model-router-mind-apply',
    actionKind: preview.actionKind,
    targetPath: preview.targetPath,
    applied,
    writesToMind: applied,
    externalSideEffects: false,
    approvalId: approval?.id ?? 'missing-approval',
    previewHash: allowedPreviewHash,
    oldHash: preview.oldHash,
    newHash: preview.newHash,
    rollback: {
      targetPath: preview.targetPath,
      restoreContentHash: preview.oldHash,
      validation: 'rerun-model-router-validation',
      instructions: `Restore ${preview.targetPath} to the content captured by oldHash ${preview.oldHash ?? 'null'} and rerun model-router validation.`,
    },
    audit: {
      event: applied ? 'applied' : 'blocked',
      approvalId: approval?.id ?? 'missing-approval',
      previewHash: allowedPreviewHash,
      kind: preview.actionKind,
      targetPath: preview.targetPath,
      writesToMind: applied,
      externalSideEffects: false,
      status: applied ? 'ok' : 'blocked',
      appliedAt: applied ? approvedAt : null,
      oldHash: preview.oldHash,
      newHash: preview.newHash,
    },
    validation: {
      accepted: applied,
      reasons,
    },
  };
}

export function createMindPreviewArtifact(input: WriteMindPreviewArtifactInput): MindPreviewArtifact {
  const previewId = input.previewId ?? createPreviewId(input.preview);
  const createdAt = (input.preview.createdAt ? new Date(input.preview.createdAt) : new Date()).toISOString();
  const expiresAt = (input.expiresAt ?? new Date(Date.parse(createdAt) + 24 * 60 * 60 * 1000)).toISOString();

  return {
    previewId,
    createdAt,
    expiresAt,
    actionKind: input.preview.actionKind,
    targetPath: input.preview.targetPath,
    operation: input.preview.operation,
    oldHash: input.preview.oldHash,
    newHash: input.preview.newHash,
    lineCountBefore: input.preview.lineCountBefore,
    lineCountAfter: input.preview.lineCountAfter,
    maxLines: input.preview.maxLines,
    unifiedDiff: input.preview.unifiedDiff,
    writesToMind: false,
    externalSideEffects: false,
    policyReasons: [...input.preview.policyReasons],
    blockedRoot: input.preview.blockedRoot,
    allowedRoot: input.preview.allowedRoot,
  };
}

export function writeMindPreviewArtifact(input: WriteMindPreviewArtifactInput): WriteMindPreviewArtifactResult {
  const safeRoot = resolveSafePreviewRoot(input.runtimeRoot);
  const artifact = createMindPreviewArtifact(input);
  const artifactPath = path.join(safeRoot, `${artifact.previewId}.json`);
  fs.mkdirSync(safeRoot, { recursive: true });
  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
  return { artifact, artifactPath, safeRoot };
}

export function listMindPreviewArtifacts(input: ListMindPreviewArtifactsInput = {}): MindPreviewArtifactSummary[] {
  const safeRoot = resolveSafePreviewRoot(input.runtimeRoot);
  if (!fs.existsSync(safeRoot)) {
    return [];
  }

  const now = input.now ?? new Date();
  return fs
    .readdirSync(safeRoot)
    .filter((entry) => entry.endsWith('.json'))
    .map((entry) => readMindPreviewArtifactByPath(path.join(safeRoot, entry), now))
    .filter((artifact): artifact is MindPreviewArtifactSummary => artifact !== null)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function readMindPreviewArtifact(input: ReadMindPreviewArtifactInput): MindPreviewArtifactSummary | null {
  const safeRoot = resolveSafePreviewRoot(input.runtimeRoot);
  const artifactPath = path.join(safeRoot, `${input.previewId}.json`);
  return readMindPreviewArtifactByPath(artifactPath, input.now ?? new Date());
}

function normalizeMindPath(targetPath: string): string {
  return targetPath.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/+/g, '/').trim();
}

function countLines(content: string): number {
  if (content.length === 0) return 0;
  return content.split('\n').length;
}

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function createSimpleUnifiedDiff(path: string, oldContent: string, newContent: string): string {
  if (oldContent === newContent) return `--- a/${path}\n+++ b/${path}\n`;

  const oldLines = oldContent.length === 0 ? [] : oldContent.split('\n');
  const newLines = newContent.length === 0 ? [] : newContent.split('\n');
  const removed = oldLines.map((line) => `-${line}`);
  const added = newLines.map((line) => `+${line}`);

  return [`--- a/${path}`, `+++ b/${path}`, '@@ preview @@', ...removed, ...added].join('\n');
}

function containsLiveLookingSecret(content: string): boolean {
  const secretPrefixes = ['sk-', 'gh' + 'p_', 'AI' + 'za'];
  const privateKeyHeader = ['-----BEGIN', 'PRIVATE KEY-----'].join(' ');

  if (content.includes(privateKeyHeader)) return true;

  return secretPrefixes.some((prefix) => {
    const index = content.indexOf(prefix);
    if (index < 0) return false;
    const rest = content.slice(index + prefix.length);
    const tokenRun = rest.match(/^[0-9A-Za-z_-]{20,}/);
    return tokenRun !== null;
  });
}

function createPreviewId(preview: MindWritePreview): string {
  const seed = [
    preview.actionKind,
    preview.targetPath,
    preview.operation,
    preview.oldHash ?? 'null',
    preview.newHash,
    preview.createdAt,
  ].join('\0');
  return `preview-${createHash('sha256').update(seed).digest('hex').slice(0, 16)}`;
}

function resolveSafePreviewRoot(runtimeRoot?: string): string {
  const configured = runtimeRoot ?? path.join(process.cwd(), PREVIEW_RUNTIME_ROOT);
  const normalized = configured.replaceAll('\\', '/');
  const segments = normalized.split('/').map((segment) => segment.toLowerCase());
  if (segments.some((segment) => PREVIEW_RUNTIME_DISALLOWED_SEGMENTS.includes(segment))) {
    throw new Error(`Unsafe preview runtime path: ${configured}`);
  }
  return path.resolve(configured);
}

function readMindPreviewArtifactByPath(filePath: string, now: Date): MindPreviewArtifactSummary | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Partial<MindPreviewArtifact>;
    if (!parsed.previewId || !parsed.createdAt || !parsed.expiresAt || !parsed.actionKind || !parsed.targetPath) {
      return null;
    }
    return {
      previewId: parsed.previewId,
      createdAt: parsed.createdAt,
      expiresAt: parsed.expiresAt,
      actionKind: parsed.actionKind,
      targetPath: parsed.targetPath,
      operation: parsed.operation ?? 'overwrite',
      allowedRoot: parsed.allowedRoot === true,
      blockedRoot: parsed.blockedRoot === true,
      expired: Date.parse(parsed.expiresAt) <= now.getTime(),
      writesToMind: false,
      externalSideEffects: false,
    };
  } catch {
    return null;
  }
}
