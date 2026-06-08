/**
 * Infinite Brain Metadata Writer Enablement Gate
 * Records operator intent to allow metadata writer dry-run or future execution
 * This phase: recording intent only, all write operations remain disabled
 *
 * Runtime output:
 * - runtime/local/infinite-brain/metadata-writer-enablement-latest.json
 *
 * Safety: writeEnabled: false, canWrite: false, canWriteToMind: false always
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const DEFAULT_ENABLEMENT_RELATIVE_PATH = 'runtime/local/infinite-brain/metadata-writer-enablement-latest.json';
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const BRAIN_ROOT = path.resolve(MODULE_DIR, '..', '..', '..', '..');

export type MetadataWriterEnablementDecision = 'disabled' | 'dry-run-only' | 'future-enabled-requested';

export interface MetadataWriterEnablementRecord {
  enablementId: string;
  generatedAt: string;
  operator: string;
  decision: MetadataWriterEnablementDecision;
  reason: string;
  scope: 'metadata-writer-enablement';
  writerCategory: 'entity-metadata';
  writeEnabled: false;
  canWrite: false;
  canWriteToMind: false;
  executionEnabled: false;
  expiresAt?: string;
  requiredNextGates: string[];
  safety: MetadataWriterEnablementSafety;
}

export interface MetadataWriterEnablementSafety {
  writesToMind: false;
  modifiesMind: false;
  appliesProposals: false;
  canWrite: false;
  canWriteToMind: false;
  writeEnabled: false;
  executionEnabled: false;
  enablementRecordOnly: true;
  continuousRuntime: false;
  modelCalls: false;
  usesShell: false;
}

export interface MetadataWriterEnablementSummary {
  available: boolean;
  generatedAt?: string;
  operator?: string;
  decision?: MetadataWriterEnablementDecision;
  writeEnabled?: false;
  canWrite?: false;
  canWriteToMind?: false;
  executionEnabled?: false;
  reason?: string;
}

function getEnablementPath(): string {
  const envPath = process.env.IBR_METADATA_WRITER_ENABLEMENT_PATH;
  if (envPath) {
    return path.isAbsolute(envPath) ? envPath : path.resolve(BRAIN_ROOT, envPath);
  }
  return path.resolve(BRAIN_ROOT, DEFAULT_ENABLEMENT_RELATIVE_PATH);
}

function readJsonSafely<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

function generateEnablementId(operator: string, decision: MetadataWriterEnablementDecision, reason: string): string {
  const input = `${operator}|${decision}|reason|entity-metadata`;
  const hash = crypto.createHash('sha256').update(input).digest('hex').substring(0, 12);
  return `enbl-${hash}`;
}

function generateSafetyBlock(): MetadataWriterEnablementSafety {
  return {
    writesToMind: false,
    modifiesMind: false,
    appliesProposals: false,
    canWrite: false,
    canWriteToMind: false,
    writeEnabled: false,
    executionEnabled: false,
    enablementRecordOnly: true,
    continuousRuntime: false,
    modelCalls: false,
    usesShell: false,
  };
}

export function generateMetadataWriterEnablementRecord(input: {
  operator: string;
  decision: MetadataWriterEnablementDecision;
  reason: string;
}): MetadataWriterEnablementRecord {
  const enablementId = generateEnablementId(input.operator, input.decision, input.reason);

  const requiredNextGates: string[] = [];
  if (input.decision !== 'disabled') {
    requiredNextGates.push('iosSyncSafetyVerification');
    requiredNextGates.push('allowlistedWriterDeployment');
    requiredNextGates.push('postWriteVerification');
  }

  return {
    enablementId,
    generatedAt: new Date().toISOString(),
    operator: input.operator,
    decision: input.decision,
    reason: input.reason,
    scope: 'metadata-writer-enablement',
    writerCategory: 'entity-metadata',
    writeEnabled: false,
    canWrite: false,
    canWriteToMind: false,
    executionEnabled: false,
    requiredNextGates,
    safety: generateSafetyBlock(),
  };
}

export function writeMetadataWriterEnablementRecord(record: MetadataWriterEnablementRecord): boolean {
  try {
    const recordPath = getEnablementPath();
    const recordDir = path.dirname(recordPath);
    fs.mkdirSync(recordDir, { recursive: true });
    fs.writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`);
    return true;
  } catch {
    return false;
  }
}

export function readMetadataWriterEnablementRecord(): MetadataWriterEnablementRecord | null {
  const recordPath = getEnablementPath();
  return readJsonSafely<MetadataWriterEnablementRecord>(recordPath);
}

export function readMetadataWriterEnablementSummary(): MetadataWriterEnablementSummary {
  const record = readMetadataWriterEnablementRecord();
  if (!record) {
    return { available: false };
  }

  return {
    available: true,
    generatedAt: record.generatedAt,
    operator: record.operator,
    decision: record.decision,
    writeEnabled: false,
    canWrite: false,
    canWriteToMind: false,
    executionEnabled: false,
    reason: record.reason,
  };
}
