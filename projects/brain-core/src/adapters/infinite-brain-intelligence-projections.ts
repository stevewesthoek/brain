import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createProjectionEnvelope } from './projection-envelope.js';
import type { ProjectionEnvelope } from '../types/projection.js';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const BRAIN_ROOT = path.resolve(MODULE_DIR, '..', '..', '..', '..');
const RUNTIME_ROOT = path.join(BRAIN_ROOT, 'runtime', 'local', 'mind-steward');
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

type ProjectionKind = 'ingestion' | 'review' | 'intelligence' | 'calibration' | 'learning';

interface ArtifactSpec {
  kind: ProjectionKind;
  projection: string;
  relativePath: string;
  sourceReference: string;
}

const ARTIFACTS: readonly ArtifactSpec[] = [
  { kind: 'ingestion', projection: 'infinite-brain-ingestion', relativePath: 'inbox-classifier-latest.json', sourceReference: 'runtime/local/mind-steward/inbox-classifier-latest.json' },
  { kind: 'review', projection: 'infinite-brain-review', relativePath: 'unified-review/workflow-latest.json', sourceReference: 'runtime/local/mind-steward/unified-review/workflow-latest.json' },
  { kind: 'intelligence', projection: 'infinite-brain-intelligence', relativePath: 'unified-review/briefing-latest.json', sourceReference: 'runtime/local/mind-steward/unified-review/briefing-latest.json' },
  { kind: 'calibration', projection: 'infinite-brain-calibration', relativePath: 'calibration/latest.json', sourceReference: 'runtime/local/mind-steward/calibration/latest.json' },
  { kind: 'learning', projection: 'infinite-brain-learning', relativePath: 'learning/latest.json', sourceReference: 'runtime/local/mind-steward/learning/latest.json' },
];

export interface IntelligenceProjectionData {
  kind: ProjectionKind;
  sourcePath: string;
  present: boolean;
  artifactGeneratedAt: string | null;
  artifactRevision: string | null;
  artifact: unknown;
  safety: {
    reportOnly: true;
    writesToMind: false;
    writesToBrainCanonical: false;
    automaticPromotion: false;
    automaticDecisions: false;
    providerCalls: false;
  };
}

function nowIso(now: Date): string {
  return now.toISOString();
}

function hash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function readArtifact(spec: ArtifactSpec, now: Date): ProjectionEnvelope<IntelligenceProjectionData> {
  const filePath = path.join(RUNTIME_ROOT, spec.relativePath);
  const sourceReference = { ref: spec.sourceReference, kind: 'file' as const };
  const baseData = { kind: spec.kind, sourcePath: spec.sourceReference, present: false, artifactGeneratedAt: null, artifactRevision: null, artifact: null };
  if (!fs.existsSync(filePath)) {
    return createProjectionEnvelope({
      projection: spec.projection,
      authorityOwner: 'derived-runtime',
      provenance: { sourceReferences: [sourceReference], adapter: 'brain-core-infinite-brain-intelligence-projections', capturedAt: nowIso(now), sourceRevision: null },
      freshness: 'unavailable', confidence: 'unknown', uncertainty: ['runtime artifact is not present; no usage or intelligence claim is made'],
      privacyClassification: 'private-local', generatedAt: nowIso(now), availability: 'empty', data: { ...baseData, safety: safety() },
    });
  }
  let raw: string;
  let artifact: unknown;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
    artifact = JSON.parse(raw) as unknown;
  } catch {
    return createProjectionEnvelope({
      projection: spec.projection,
      authorityOwner: 'derived-runtime',
      provenance: { sourceReferences: [sourceReference], adapter: 'brain-core-infinite-brain-intelligence-projections', capturedAt: nowIso(now), sourceRevision: null },
      freshness: 'unknown', confidence: 'unknown', uncertainty: ['runtime artifact exists but is not valid JSON'],
      privacyClassification: 'private-local', generatedAt: nowIso(now), availability: 'invalid', failure: { code: 'invalid_runtime_artifact', message: `Unable to parse ${spec.sourceReference}` }, data: { ...baseData, present: true, safety: safety() },
    });
  }
  const stat = fs.statSync(filePath);
  const freshness = now.getTime() - stat.mtime.getTime() > STALE_AFTER_MS ? 'stale' : 'fresh';
  const artifactRecord = artifact && typeof artifact === 'object' ? artifact as Record<string, unknown> : null;
  const artifactGeneratedAt = typeof artifactRecord?.generated_at === 'string' ? artifactRecord.generated_at : null;
  const revision = hash(raw);
  return createProjectionEnvelope({
    projection: spec.projection,
    authorityOwner: 'derived-runtime',
    provenance: { sourceReferences: [sourceReference], adapter: 'brain-core-infinite-brain-intelligence-projections', capturedAt: nowIso(now), sourceRevision: revision },
    freshness, confidence: freshness === 'fresh' ? 'high' : 'low', uncertainty: freshness === 'stale' ? ['runtime artifact is older than the projection freshness window'] : [],
    privacyClassification: 'private-local', generatedAt: nowIso(now), revision, availability: 'available', data: { kind: spec.kind, sourcePath: spec.sourceReference, present: true, artifactGeneratedAt, artifactRevision: revision, artifact, safety: safety() },
  });
}

function safety(): IntelligenceProjectionData['safety'] {
  return { reportOnly: true, writesToMind: false, writesToBrainCanonical: false, automaticPromotion: false, automaticDecisions: false, providerCalls: false };
}

export function readInfiniteBrainIntelligenceProjections(now = new Date()): Record<ProjectionKind, ProjectionEnvelope<IntelligenceProjectionData>> {
  return Object.fromEntries(ARTIFACTS.map((spec) => [spec.kind, readArtifact(spec, now)])) as Record<ProjectionKind, ProjectionEnvelope<IntelligenceProjectionData>>;
}

export function readInfiniteBrainProjection(kind: ProjectionKind, now = new Date()): ProjectionEnvelope<IntelligenceProjectionData> {
  const spec = ARTIFACTS.find((candidate) => candidate.kind === kind);
  if (!spec) throw new Error(`unknown_infinite_brain_projection:${kind}`);
  return readArtifact(spec, now);
}
