import { createHash } from 'node:crypto';
import { realpathSync, statSync } from 'node:fs';
import path from 'node:path';

export const JARVIS_INTAKE_SCHEMA_VERSION = 'agent-mode.jarvis-intake.v2' as const;
export const JARVIS_CONTEXT_SCHEMA_VERSION = 'agent-mode.jarvis-context.v1' as const;
export const JARVIS_CONTEXT_EXPANSION_SCHEMA_VERSION = 'agent-mode.jarvis-context-expansion.v1' as const;

export type JarvisContextKind = 'repository' | 'filesystem';
export type JarvisContextAccess = 'read' | 'write';
export type JarvisContextOrigin = 'direct' | 'repos-client' | 'local-folder' | 'expansion';

export type JarvisContextRequestV1 = {
  kind: JarvisContextKind;
  path: string;
  repositoryRef?: string | null;
  requestedAccess: JarvisContextAccess;
  recursive: boolean;
  origin: JarvisContextOrigin;
};

export type JarvisAdmittedContextV1 = {
  schemaVersion: typeof JARVIS_CONTEXT_SCHEMA_VERSION;
  contextId: string;
  contextKey: string;
  rootGoalId: string;
  kind: JarvisContextKind;
  canonicalPath: string;
  repositoryRef: string | null;
  requestedAccess: JarvisContextAccess;
  admittedAccess: JarvisContextAccess;
  recursive: boolean;
  origin: JarvisContextOrigin;
  admissionStatus: 'admitted';
  admissionRef: string;
  createdAt: string;
};

export type JarvisContextSetV1 = {
  schemaVersion: typeof JARVIS_CONTEXT_SCHEMA_VERSION;
  contextSetId: string;
  rootGoalId: string;
  contexts: readonly JarvisAdmittedContextV1[];
};

export type JarvisContextExpansionV1 = {
  schemaVersion: typeof JARVIS_CONTEXT_EXPANSION_SCHEMA_VERSION;
  expansionId: string;
  rootGoalId: string;
  requestedContexts: readonly JarvisContextRequestV1[];
  admittedContextIds: readonly string[];
  reasonCode: string;
  causationRef: string;
  materialHash: string;
  createdAt: string;
};

export type JarvisAttemptExecutionScopeV1 = {
  schemaVersion: 'agent-mode.attempt-execution-scope.v1';
  scopeId: string;
  rootGoalId: string;
  attemptId: string;
  contexts: readonly Pick<JarvisAdmittedContextV1, 'contextId' | 'kind' | 'canonicalPath' | 'repositoryRef' | 'admittedAccess' | 'recursive'>[];
  scopeDigest: string;
};

export type JarvisContextAdmissionOptions = {
  home: string;
  eligibleRoots?: readonly string[];
  writableRoots?: readonly string[];
  now?: string;
};

export type JarvisContextDenialCode = 'CONTEXT_INVALID' | 'CONTEXT_NOT_FOUND' | 'CONTEXT_OUTSIDE_ELIGIBLE_ROOT' | 'CONTEXT_SYMLINK_ESCAPE' | 'SENSITIVE_CONTEXT_DENIED' | 'WRITE_NOT_ADMITTED' | 'REPOSITORY_INVALID';
export type JarvisContextAdmissionResult =
  | { result: 'admitted'; context: JarvisAdmittedContextV1 }
  | { result: 'denied'; reasonCode: JarvisContextDenialCode };

const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u;
const CONTROL = /[\u0000-\u001f\u007f]/u;
const SENSITIVE_SEGMENTS = new Set(['.ssh', '.gnupg', '.aws', '.npmrc', '.pypirc', '.docker', 'keychains', 'credentials', 'secrets', 'private-keys']);

function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

function contained(candidate: string, root: string): boolean {
  return candidate === root || candidate.startsWith(`${root}${path.sep}`);
}

function canonicalExistingDirectory(value: string): string | undefined {
  try {
    const resolved = realpathSync(value);
    return statSync(resolved).isDirectory() ? resolved : undefined;
  } catch {
    return undefined;
  }
}

function sensitivePath(value: string): boolean {
  const segments = value.split(path.sep).filter(Boolean).map((segment) => segment.toLowerCase());
  return segments.some((segment) => SENSITIVE_SEGMENTS.has(segment) || segment === 'library/keychains')
    || segments.some((segment) => segment === '.env' || segment.startsWith('.env.'));
}

function normalizedRoots(values: readonly string[], home: string): string[] {
  return [...new Set(values.map(canonicalExistingDirectory).filter((value): value is string => Boolean(value)))]
    .filter((value) => value !== path.parse(value).root || value === home)
    .sort((a, b) => a.localeCompare(b));
}

export function deriveJarvisContextKey(input: Pick<JarvisContextRequestV1, 'kind' | 'path' | 'repositoryRef' | 'requestedAccess' | 'recursive'>, canonicalPath = input.path): string {
  return `context-key:sha256:${digest({ kind: input.kind, canonicalPath, repositoryRef: input.repositoryRef ?? null, requestedAccess: input.requestedAccess, recursive: input.recursive })}`;
}

export function deriveJarvisContextId(rootGoalId: string, contextKey: string): string {
  return `context:${digest({ domain: JARVIS_CONTEXT_SCHEMA_VERSION, rootGoalId, contextKey }).slice(0, 48)}`;
}

export function deriveJarvisContextSetId(rootGoalId: string): string {
  return `context-set:${digest({ domain: JARVIS_CONTEXT_SCHEMA_VERSION, rootGoalId }).slice(0, 48)}`;
}

export function deriveJarvisExpansionId(rootGoalId: string, requests: readonly JarvisContextRequestV1[], causationRef: string): string {
  return `context-expansion:${digest({ domain: JARVIS_CONTEXT_EXPANSION_SCHEMA_VERSION, rootGoalId, requests, causationRef }).slice(0, 48)}`;
}

export function deriveJarvisAttemptScopeId(rootGoalId: string, attemptId: string, contextIds: readonly string[]): string {
  return `attempt-scope:${digest({ domain: 'agent-mode.attempt-execution-scope.v1', rootGoalId, attemptId, contextIds: [...contextIds].sort() }).slice(0, 48)}`;
}

export function admitJarvisContext(rootGoalId: string, request: JarvisContextRequestV1, options: JarvisContextAdmissionOptions, createdAt = options.now ?? new Date().toISOString()): JarvisContextAdmissionResult {
  if (!rootGoalId || !request || !['repository', 'filesystem'].includes(request.kind) || !['read', 'write'].includes(request.requestedAccess) || typeof request.path !== 'string' || request.path.length === 0 || request.path.length > 1_024 || CONTROL.test(request.path) || typeof request.recursive !== 'boolean' || !['direct', 'repos-client', 'local-folder', 'expansion'].includes(request.origin) || (request.repositoryRef !== undefined && request.repositoryRef !== null && (!SAFE_REF.test(request.repositoryRef) || request.repositoryRef.length > 256))) return { result: 'denied', reasonCode: 'CONTEXT_INVALID' };
  const requested = canonicalExistingDirectory(request.path);
  if (!requested) return { result: 'denied', reasonCode: 'CONTEXT_NOT_FOUND' };
  const home = canonicalExistingDirectory(options.home);
  if (!home) return { result: 'denied', reasonCode: 'CONTEXT_NOT_FOUND' };
  const eligibleRoots = normalizedRoots([home, ...(options.eligibleRoots ?? [])], home);
  const writableRoots = normalizedRoots(options.writableRoots ?? [], home);
  if (!eligibleRoots.some((root) => contained(requested, root))) return { result: 'denied', reasonCode: 'CONTEXT_OUTSIDE_ELIGIBLE_ROOT' };
  if (sensitivePath(requested)) return { result: 'denied', reasonCode: 'SENSITIVE_CONTEXT_DENIED' };
  if (request.kind === 'repository') {
    let gitPath: string;
    try { gitPath = realpathSync(path.join(requested, '.git')); } catch { return { result: 'denied', reasonCode: 'REPOSITORY_INVALID' }; }
    if (!statSync(gitPath).isDirectory() && !statSync(gitPath).isFile()) return { result: 'denied', reasonCode: 'REPOSITORY_INVALID' };
    if (!request.repositoryRef || !SAFE_REF.test(request.repositoryRef)) return { result: 'denied', reasonCode: 'CONTEXT_INVALID' };
  }
  if (request.requestedAccess === 'write' && !writableRoots.some((root) => contained(requested, root))) return { result: 'denied', reasonCode: 'WRITE_NOT_ADMITTED' };
  const contextKey = deriveJarvisContextKey(request, requested);
  const admissionRef = `context-admission:sha256:${digest({ rootGoalId, contextKey, eligibleRoots, writableRoots, createdAt }).slice(0, 48)}`;
  return {
    result: 'admitted',
    context: {
      schemaVersion: JARVIS_CONTEXT_SCHEMA_VERSION,
      contextId: deriveJarvisContextId(rootGoalId, contextKey),
      contextKey,
      rootGoalId,
      kind: request.kind,
      canonicalPath: requested,
      repositoryRef: request.repositoryRef ?? null,
      requestedAccess: request.requestedAccess,
      admittedAccess: request.requestedAccess,
      recursive: request.recursive,
      origin: request.origin,
      admissionStatus: 'admitted',
      admissionRef,
      createdAt,
    },
  };
}

export function admitJarvisContextSet(rootGoalId: string, requests: readonly JarvisContextRequestV1[], options: JarvisContextAdmissionOptions, createdAt = options.now ?? new Date().toISOString()): { result: 'admitted'; contextSet: JarvisContextSetV1 } | { result: 'denied'; reasonCode: string; index: number } {
  if (!Array.isArray(requests) || requests.length > 32) return { result: 'denied', reasonCode: 'CONTEXT_SET_TOO_LARGE', index: requests.length };
  const results = requests.map((request) => admitJarvisContext(rootGoalId, request, options, createdAt));
  const denied = results.find((entry) => entry.result === 'denied');
  if (denied) return { result: 'denied', reasonCode: denied.reasonCode, index: results.indexOf(denied) };
  const contexts = results.filter((entry): entry is { result: 'admitted'; context: JarvisAdmittedContextV1 } => entry.result === 'admitted').map((entry) => entry.context).sort((a, b) => a.contextKey.localeCompare(b.contextKey));
  if (new Set(contexts.map((context) => context.contextKey)).size !== contexts.length) return { result: 'denied', reasonCode: 'DUPLICATE_CONTEXT', index: 0 };
  return { result: 'admitted', contextSet: { schemaVersion: JARVIS_CONTEXT_SCHEMA_VERSION, contextSetId: deriveJarvisContextSetId(rootGoalId), rootGoalId, contexts } };
}

export function createAttemptExecutionScope(rootGoalId: string, attemptId: string, contexts: readonly JarvisAdmittedContextV1[]): JarvisAttemptExecutionScopeV1 {
  const bounded = contexts.slice().sort((a, b) => a.contextKey.localeCompare(b.contextKey)).map(({ contextId, kind, canonicalPath, repositoryRef, admittedAccess, recursive }) => ({ contextId, kind, canonicalPath, repositoryRef, admittedAccess, recursive }));
  const scopeDigest = digest({ rootGoalId, attemptId, contexts: bounded });
  return { schemaVersion: 'agent-mode.attempt-execution-scope.v1', scopeId: deriveJarvisAttemptScopeId(rootGoalId, attemptId, bounded.map((context) => context.contextId)), rootGoalId, attemptId, contexts: bounded, scopeDigest };
}
