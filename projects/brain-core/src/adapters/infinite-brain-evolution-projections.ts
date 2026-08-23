import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createProjectionEnvelope } from './projection-envelope.js';
import type { ProjectionEnvelope } from '../types/projection.js';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const BRAIN_ROOT = path.resolve(MODULE_DIR, '..', '..', '..', '..');
const RUNTIME_ROOT = path.join(BRAIN_ROOT, 'runtime', 'local');
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export type EvolutionProjectionKind = 'evolution' | 'promotion' | 'transactions' | 'receipts';

type ArtifactSpec = { relativePath: string; role: string };

const SPECS: Record<EvolutionProjectionKind, readonly ArtifactSpec[]> = {
  evolution: [
    { relativePath: 'mind-steward/unified-review/workflow-latest.json', role: 'review-workflow' },
    { relativePath: 'mind-steward/daily-loop/latest.json', role: 'daily-intelligence-loop' },
    { relativePath: 'mind-steward/calibration/latest.json', role: 'calibration' },
    { relativePath: 'mind-steward/learning/latest.json', role: 'learning-checkpoint' },
    { relativePath: 'infinite-brain/proposals-latest.json', role: 'proposal-report' },
    { relativePath: 'infinite-brain/proposal-approvals.json', role: 'proposal-approval-state' },
    { relativePath: 'infinite-brain/proposal-application-plan-latest.json', role: 'prepared-transaction' },
    { relativePath: 'infinite-brain/proposal-execution-readiness-latest.json', role: 'validation-readiness' },
    { relativePath: 'infinite-brain/proposal-executor-dry-run-latest.json', role: 'execution-dry-run' },
  ],
  promotion: [
    { relativePath: 'mind-steward/unified-review/workflow-latest.json', role: 'review-workflow' },
    { relativePath: 'mind-steward/promotions', role: 'promotion-artifacts' },
  ],
  transactions: [
    { relativePath: 'infinite-brain/proposal-application-plan-latest.json', role: 'prepared-transaction' },
    { relativePath: 'infinite-brain/proposal-execution-readiness-latest.json', role: 'validation-readiness' },
    { relativePath: 'infinite-brain/proposal-executor-dry-run-latest.json', role: 'execution-dry-run' },
    { relativePath: 'infinite-brain/write-manifest-latest.json', role: 'write-manifest' },
  ],
  receipts: [
    { relativePath: 'infinite-brain/post-write-verification-latest.json', role: 'post-write-verification' },
    { relativePath: 'infinite-brain/write-manifest-latest.json', role: 'write-manifest' },
    { relativePath: 'infinite-brain/proposal-executor-dry-run-latest.json', role: 'execution-dry-run' },
    { relativePath: 'mind-steward/promotions', role: 'promotion-receipts' },
  ],
};

export interface EvolutionArtifact {
  role: string;
  sourcePath: string;
  present: boolean;
  artifactRevision: string | null;
  capturedAt: string | null;
  freshness: 'fresh' | 'stale' | 'unknown' | 'unavailable';
  artifactSummary: Record<string, unknown> | null;
}

export interface EvolutionProjectionData {
  kind: EvolutionProjectionKind;
  artifacts: EvolutionArtifact[];
  summary: {
    availableArtifacts: number;
    missingArtifacts: number;
    staleArtifacts: number;
    promotionStates: string[];
    transactionStates: string[];
    receiptStates: string[];
  };
  safety: {
    readOnly: true;
    writesToMind: false;
    writesToBrainCanonical: false;
    automaticPromotion: false;
    automaticDecisions: false;
    providerCalls: false;
  };
}

function hash(value: string): string { return crypto.createHash('sha256').update(value).digest('hex'); }
function nowIso(now: Date): string { return now.toISOString(); }
function safety(): EvolutionProjectionData['safety'] {
  return { readOnly: true, writesToMind: false, writesToBrainCanonical: false, automaticPromotion: false, automaticDecisions: false, providerCalls: false };
}

function readOne(spec: ArtifactSpec, now: Date): EvolutionArtifact[] {
  const absolute = path.join(RUNTIME_ROOT, spec.relativePath);
  if (fs.existsSync(absolute) && fs.statSync(absolute).isDirectory()) {
    return fs.readdirSync(absolute, { withFileTypes: true }).filter(entry => entry.isFile() && entry.name.endsWith('.json')).map(entry => readOne({ ...spec, relativePath: path.join(spec.relativePath, entry.name) }, now)[0]).filter((item): item is EvolutionArtifact => Boolean(item));
  }
  if (!fs.existsSync(absolute)) return [{ role: spec.role, sourcePath: `runtime/local/${spec.relativePath}`, present: false, artifactRevision: null, capturedAt: null, freshness: 'unavailable', artifactSummary: null }];
  try {
    const raw = fs.readFileSync(absolute, 'utf8');
    const artifact = JSON.parse(raw) as unknown;
    const stat = fs.statSync(absolute);
    const freshness = now.getTime() - stat.mtime.getTime() > STALE_AFTER_MS ? 'stale' : 'fresh';
    const record = artifact && typeof artifact === 'object' ? artifact as Record<string, unknown> : null;
    const artifactSummary: Record<string, unknown> = record ? {
      generated_at: record.generated_at ?? null,
      state: record.state ?? null,
      status: record.status ?? null,
      summary: record.summary ?? null,
      counts: record.counts ?? null,
      safety: record.safety ?? null,
      invariants: record.invariants ?? null,
      rollback_reference: record.rollback_reference ?? null,
      source_paths: record.source_paths ?? null,
      evidence_references: record.evidence_references ?? null,
    } : { value_type: typeof artifact };
    return [{ role: spec.role, sourcePath: `runtime/local/${spec.relativePath}`, present: true, artifactRevision: hash(raw), capturedAt: typeof record?.generated_at === 'string' ? record.generated_at : null, freshness, artifactSummary }];
  } catch {
    return [{ role: spec.role, sourcePath: `runtime/local/${spec.relativePath}`, present: true, artifactRevision: null, capturedAt: null, freshness: 'unknown', artifactSummary: null }];
  }
}

function stateValues(artifacts: EvolutionArtifact[], keys: string[]): string[] {
  const values = artifacts.flatMap(item => {
    const record = item.artifactSummary;
    return keys.flatMap(key => typeof record?.[key] === 'string' ? [record[key] as string] : []);
  });
  return [...new Set(values)].sort();
}

export function readInfiniteBrainEvolutionProjection(kind: EvolutionProjectionKind, now = new Date()): ProjectionEnvelope<EvolutionProjectionData> {
  const specs = SPECS[kind];
  if (!specs) throw new Error(`unknown_evolution_projection:${kind}`);
  const artifacts = specs.flatMap(spec => readOne(spec, now));
  const available = artifacts.filter(item => item.present);
  const stale = artifacts.filter(item => item.freshness === 'stale');
  const missing = artifacts.filter(item => !item.present);
  const sourceReferences = specs.map(spec => ({ ref: `runtime/local/${spec.relativePath}`, kind: 'file' as const }));
  const invalid = available.some(item => item.artifactSummary === null);
  const availability = invalid ? 'invalid' : available.length ? 'available' : 'empty';
  const freshness = invalid ? 'unknown' : stale.length ? 'stale' : available.length ? 'fresh' : 'unavailable';
  return createProjectionEnvelope({
    projection: `infinite-brain-${kind}`,
    authorityOwner: 'derived-runtime',
    provenance: { sourceReferences, adapter: 'brain-core-infinite-brain-evolution-projections', capturedAt: nowIso(now), sourceRevision: null },
    freshness, confidence: available.length && !invalid ? (stale.length ? 'low' : 'high') : 'unknown',
    uncertainty: [ ...(missing.length ? ['one or more runtime artifacts are unavailable'] : []), ...(stale.length ? ['one or more runtime artifacts are stale'] : []), ...(invalid ? ['one or more runtime artifacts are invalid'] : []) ],
    privacyClassification: 'private-local', generatedAt: nowIso(now), availability,
    data: {
      kind, artifacts,
      summary: { availableArtifacts: available.length, missingArtifacts: missing.length, staleArtifacts: stale.length, promotionStates: stateValues(artifacts, ['state']), transactionStates: stateValues(artifacts, ['status']), receiptStates: stateValues(artifacts, ['receipt_status', 'verification_status']) },
      safety: safety(),
    },
  });
}
