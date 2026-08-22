import fs from 'node:fs';
import path from 'node:path';

import { computeInfrastructureActionHash } from './infrastructure-action-safety.mjs';

export const INFRASTRUCTURE_ACTION_RECEIPT_RUNTIME_VERSION = '1.0.0';
export const DEFAULT_MAX_ACTION_RECEIPTS = 500;
export const DEFAULT_MAX_ACTION_RECEIPT_AGE_SECONDS = 30 * 24 * 60 * 60;
export const DEFAULT_ACTION_RECEIPT_STATE_PATH = path.join('runtime', 'local', 'infrastructure', 'action-receipts.json');

const ALLOWED_DECISIONS = new Set(['forbidden', 'approval_required', 'denied', 'allowed_read_only', 'preflight_ready']);
const RECEIPT_KEYS = new Set([
  'receiptVersion', 'schemaVersion', 'actionId', 'actionHash', 'idempotencyKey', 'evaluatedAt', 'decision', 'safetyClass',
  'policyCatalogVersion', 'targetResourceIds', 'policyRefs', 'postCheckRequirements', 'executionEnabled', 'executionPerformed',
  'actualEffects', 'containsSecrets',
]);

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function sortedUnique(values = []) {
  return [...new Set(values)].sort();
}

function fail(message) {
  throw new Error(`Infrastructure action receipt rejected: ${message}`);
}

function iso(value, label) {
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value ?? '');
  if (!Number.isFinite(parsed)) fail(`invalid ${label}`);
  return new Date(parsed).toISOString();
}

function sameStringSet(left, right) {
  return stableStringify(sortedUnique(left)) === stableStringify(sortedUnique(right));
}

function validateStoredReceipt(receipt) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) fail('stored receipt must be an object');
  for (const key of Object.keys(receipt)) {
    if (!RECEIPT_KEYS.has(key)) fail(`stored receipt contains unsupported field ${key}`);
  }
  if (receipt.receiptVersion !== INFRASTRUCTURE_ACTION_RECEIPT_RUNTIME_VERSION) fail(`unsupported receiptVersion ${receipt.receiptVersion}`);
  if (receipt.schemaVersion !== '1.0.0') fail(`unsupported action schemaVersion ${receipt.schemaVersion}`);
  if (typeof receipt.actionId !== 'string' || receipt.actionId.length === 0) fail('stored receipt actionId is required');
  if (typeof receipt.actionHash !== 'string' || !/^[a-f0-9]{64}$/.test(receipt.actionHash)) fail('stored receipt actionHash must be SHA-256 hex');
  if (typeof receipt.idempotencyKey !== 'string' || receipt.idempotencyKey.length === 0) fail('stored receipt idempotencyKey is required');
  iso(receipt.evaluatedAt, 'evaluatedAt');
  if (!ALLOWED_DECISIONS.has(receipt.decision)) fail(`unsupported decision ${receipt.decision}`);
  if (typeof receipt.safetyClass !== 'string' || receipt.safetyClass.length === 0) fail('stored receipt safetyClass is required');
  if (typeof receipt.policyCatalogVersion !== 'string' || receipt.policyCatalogVersion.length === 0) fail('stored receipt policyCatalogVersion is required');
  if (!Array.isArray(receipt.targetResourceIds) || receipt.targetResourceIds.length === 0) fail('stored receipt targetResourceIds are required');
  if (!Array.isArray(receipt.policyRefs)) fail('stored receipt policyRefs must be an array');
  if (!Array.isArray(receipt.postCheckRequirements)) fail('stored receipt postCheckRequirements must be an array');
  if (receipt.executionEnabled !== false) fail('stored receipt cannot enable execution');
  if (receipt.executionPerformed !== false) fail('stored receipt cannot report execution');
  if (!Array.isArray(receipt.actualEffects) || receipt.actualEffects.length !== 0) fail('stored receipt cannot contain actual effects');
  if (receipt.containsSecrets !== false) fail('stored receipt must explicitly contain no secrets');
  return receipt;
}

export function buildInfrastructureActionRuntimeReceipt({ actionPlan, evaluation }) {
  if (!actionPlan || typeof actionPlan !== 'object') fail('actionPlan is required');
  if (!evaluation || typeof evaluation !== 'object') fail('evaluation is required');
  if (!evaluation.receipt || typeof evaluation.receipt !== 'object') fail('evaluation receipt is required');
  if (actionPlan.provenance?.containsSecrets !== false) fail('action plan must explicitly contain no secrets');

  const expectedHash = computeInfrastructureActionHash(actionPlan);
  const receipt = evaluation.receipt;
  if (evaluation.schemaVersion !== actionPlan.schemaVersion || receipt.schemaVersion !== actionPlan.schemaVersion) fail('schemaVersion mismatch');
  if (evaluation.actionId !== actionPlan.actionId || receipt.actionId !== actionPlan.actionId) fail('actionId mismatch');
  if (evaluation.actionHash !== expectedHash || receipt.actionHash !== expectedHash) fail('actionHash mismatch');
  if (receipt.idempotencyKey !== actionPlan.idempotencyKey) fail('idempotencyKey mismatch');
  if (receipt.evaluatedAt !== evaluation.evaluatedAt) fail('evaluatedAt mismatch');
  if (receipt.decision !== evaluation.decision) fail('decision mismatch');
  if (receipt.safetyClass !== evaluation.safetyClass) fail('safetyClass mismatch');
  if (!sameStringSet(receipt.targetResourceIds, evaluation.targetResourceIds)) fail('targetResourceIds mismatch');
  if (!sameStringSet(receipt.policyRefs, evaluation.policyRefs)) fail('policyRefs mismatch');
  if (evaluation.executionEnabled !== false) fail('evaluation cannot enable execution');
  if (evaluation.executionPerformed !== false || receipt.executionPerformed !== false) fail('evaluation cannot report execution');
  if (!Array.isArray(evaluation.actualEffects) || evaluation.actualEffects.length !== 0) fail('evaluation cannot contain actual effects');
  if (receipt.containsSecrets !== false) fail('evaluation receipt must explicitly contain no secrets');
  if (!ALLOWED_DECISIONS.has(evaluation.decision)) fail(`unsupported decision ${evaluation.decision}`);

  const durableReceipt = {
    receiptVersion: INFRASTRUCTURE_ACTION_RECEIPT_RUNTIME_VERSION,
    schemaVersion: receipt.schemaVersion,
    actionId: receipt.actionId,
    actionHash: receipt.actionHash,
    idempotencyKey: receipt.idempotencyKey,
    evaluatedAt: iso(receipt.evaluatedAt, 'evaluatedAt'),
    decision: receipt.decision,
    safetyClass: receipt.safetyClass,
    policyCatalogVersion: actionPlan.policyCatalogVersion,
    targetResourceIds: sortedUnique(receipt.targetResourceIds),
    policyRefs: sortedUnique(receipt.policyRefs),
    postCheckRequirements: structuredClone(evaluation.postCheckRequirements ?? []),
    executionEnabled: false,
    executionPerformed: false,
    actualEffects: [],
    containsSecrets: false,
  };
  validateStoredReceipt(durableReceipt);
  return durableReceipt;
}

export function pruneInfrastructureActionReceipts(receipts, {
  now = new Date(),
  maxReceipts = DEFAULT_MAX_ACTION_RECEIPTS,
  maxAgeSeconds = DEFAULT_MAX_ACTION_RECEIPT_AGE_SECONDS,
} = {}) {
  if (!Number.isInteger(maxReceipts) || maxReceipts < 1) fail('maxReceipts must be a positive integer');
  if (!Number.isInteger(maxAgeSeconds) || maxAgeSeconds < 1) fail('maxAgeSeconds must be a positive integer');
  const nowMs = Date.parse(iso(now, 'now'));
  return [...(receipts ?? [])]
    .map(validateStoredReceipt)
    .filter((receipt) => nowMs - Date.parse(receipt.evaluatedAt) <= maxAgeSeconds * 1000)
    .sort((a, b) => Date.parse(b.evaluatedAt) - Date.parse(a.evaluatedAt) || a.actionId.localeCompare(b.actionId))
    .slice(0, maxReceipts);
}

function resolveBoundedReceiptPath(root, outputPath = DEFAULT_ACTION_RECEIPT_STATE_PATH) {
  const absoluteRoot = path.resolve(root);
  const runtimeRoot = path.join(absoluteRoot, 'runtime', 'local', 'infrastructure');
  const absolutePath = path.isAbsolute(outputPath) ? path.resolve(outputPath) : path.resolve(absoluteRoot, outputPath);
  if (absolutePath !== runtimeRoot && !absolutePath.startsWith(`${runtimeRoot}${path.sep}`)) fail('output path must remain under runtime/local/infrastructure');
  return absolutePath;
}

function validateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) fail('runtime snapshot must be an object');
  if (snapshot.runtimeSchemaVersion !== INFRASTRUCTURE_ACTION_RECEIPT_RUNTIME_VERSION) fail(`unsupported runtimeSchemaVersion ${snapshot.runtimeSchemaVersion}`);
  iso(snapshot.generatedAt, 'generatedAt');
  if (!Number.isInteger(snapshot.maxReceipts) || snapshot.maxReceipts < 1) fail('snapshot maxReceipts must be positive');
  if (!Number.isInteger(snapshot.maxAgeSeconds) || snapshot.maxAgeSeconds < 1) fail('snapshot maxAgeSeconds must be positive');
  if (!Array.isArray(snapshot.receipts)) fail('snapshot receipts must be an array');
  snapshot.receipts.forEach(validateStoredReceipt);
  return snapshot;
}

export function readInfrastructureActionReceiptSnapshot({ root = process.cwd(), inputPath = DEFAULT_ACTION_RECEIPT_STATE_PATH } = {}) {
  const absolutePath = resolveBoundedReceiptPath(root, inputPath);
  if (!fs.existsSync(absolutePath)) return { path: absolutePath, exists: false, snapshot: null };

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
    validateSnapshot(parsed);
  } catch (error) {
    throw new Error(`Infrastructure action receipt state failed validation at ${absolutePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
  return { path: absolutePath, exists: true, snapshot: parsed };
}

function replayIdentity(receipt) {
  const { evaluatedAt, ...identity } = receipt;
  return identity;
}

export function persistInfrastructureActionReceipt({ actionPlan, evaluation }, {
  root = process.cwd(),
  now = new Date(),
  maxReceipts = DEFAULT_MAX_ACTION_RECEIPTS,
  maxAgeSeconds = DEFAULT_MAX_ACTION_RECEIPT_AGE_SECONDS,
  outputPath = DEFAULT_ACTION_RECEIPT_STATE_PATH,
} = {}) {
  const candidate = buildInfrastructureActionRuntimeReceipt({ actionPlan, evaluation });
  const absolutePath = resolveBoundedReceiptPath(root, outputPath);
  const existing = readInfrastructureActionReceiptSnapshot({ root, inputPath: outputPath });
  const receipts = existing.snapshot?.receipts ?? [];

  const sameKey = receipts.find((receipt) => receipt.idempotencyKey === candidate.idempotencyKey);
  if (sameKey) {
    if (sameKey.actionHash !== candidate.actionHash) fail('idempotency key is already bound to a different action hash');
    if (stableStringify(replayIdentity(sameKey)) !== stableStringify(replayIdentity(candidate))) fail('idempotent replay does not match the stored receipt');
    return { path: absolutePath, snapshot: existing.snapshot, receipt: sameKey, replayed: true, persisted: false };
  }

  const sameAction = receipts.find((receipt) => receipt.actionId === candidate.actionId);
  if (sameAction) fail('actionId is already bound to a different idempotency key or action hash');

  const retained = pruneInfrastructureActionReceipts([...receipts, candidate], { now, maxReceipts, maxAgeSeconds });
  const snapshot = {
    runtimeSchemaVersion: INFRASTRUCTURE_ACTION_RECEIPT_RUNTIME_VERSION,
    generatedAt: iso(now, 'now'),
    maxReceipts,
    maxAgeSeconds,
    receipts: retained,
  };
  validateSnapshot(snapshot);

  fs.mkdirSync(path.dirname(absolutePath), { recursive: true, mode: 0o700 });
  const tempPath = `${absolutePath}.tmp-${process.pid}`;
  try {
    fs.writeFileSync(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(tempPath, absolutePath);
  } catch (error) {
    try {
      if (fs.existsSync(tempPath)) fs.rmSync(tempPath, { force: true });
    } catch {
      // Preserve the original persistence error.
    }
    throw error;
  }

  return { path: absolutePath, snapshot, receipt: candidate, replayed: false, persisted: true };
}
