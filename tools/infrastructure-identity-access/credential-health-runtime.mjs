import fs from 'node:fs';
import path from 'node:path';

import { loadJson, validateJsonSchema } from '../context-learning/context-learning-core.mjs';

export const CREDENTIAL_HEALTH_RUNTIME_SCHEMA_VERSION = '1.0.0';
export const DEFAULT_CREDENTIAL_HEALTH_STATE_PATH = path.join('runtime', 'local', 'infrastructure', 'credential-health-state.json');
export const DEFAULT_MAX_EVALUATIONS = 500;
const RUNTIME_SCHEMA = loadJson(path.resolve(import.meta.dirname, '../../operations/specs/infrastructure-credential-health-runtime-v1.schema.json'));

function iso(value) {
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value ?? '');
  if (!Number.isFinite(parsed)) throw new Error(`Invalid timestamp: ${value}`);
  return new Date(parsed).toISOString();
}

export function emptyCredentialHealthState({ now = new Date(), policyCatalogVersion } = {}) {
  return {
    schemaVersion: CREDENTIAL_HEALTH_RUNTIME_SCHEMA_VERSION,
    generatedAt: iso(now),
    policyCatalogVersion: policyCatalogVersion ?? null,
    containsSecrets: false,
    evaluations: [],
  };
}

function scan(value, pathLabel = '$') {
  if (Array.isArray(value)) return value.forEach((entry, index) => scan(entry, `${pathLabel}[${index}]`));
  if (!value || typeof value !== 'object') return;
  const forbidden = new Set(['value', 'token', 'password', 'apikey', 'api_key', 'access_token', 'refresh_token', 'client_secret', 'secretstoreref']);
  for (const [key, child] of Object.entries(value)) {
    if (forbidden.has(key.toLowerCase())) throw new Error(`Credential health runtime contains forbidden field at ${pathLabel}.${key}`);
    scan(child, `${pathLabel}.${key}`);
  }
}

function validate(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw new Error('Credential health runtime is not an object');
  if (snapshot.schemaVersion !== CREDENTIAL_HEALTH_RUNTIME_SCHEMA_VERSION) throw new Error(`Unsupported credential health runtime schemaVersion: ${snapshot.schemaVersion}`);
  if (snapshot.containsSecrets !== false) throw new Error('Credential health runtime must declare containsSecrets=false');
  if (!Array.isArray(snapshot.evaluations)) throw new Error('Credential health runtime evaluations must be an array');
  const schemaErrors = validateJsonSchema(RUNTIME_SCHEMA, snapshot, RUNTIME_SCHEMA, '$.credentialHealthRuntime');
  if (schemaErrors.length > 0) throw new Error(`Credential health runtime schema validation failed: ${schemaErrors.join('; ')}`);
  scan(snapshot);
  return snapshot;
}

export function readCredentialHealthState({ root = process.cwd(), now = new Date(), inputPath = DEFAULT_CREDENTIAL_HEALTH_STATE_PATH, policyCatalogVersion = null } = {}) {
  const absolutePath = path.isAbsolute(inputPath) ? inputPath : path.join(root, inputPath);
  if (!fs.existsSync(absolutePath)) return { path: absolutePath, exists: false, state: emptyCredentialHealthState({ now, policyCatalogVersion }) };
  let parsed;
  try { parsed = JSON.parse(fs.readFileSync(absolutePath, 'utf8')); } catch (error) { throw new Error(`Credential health runtime is malformed at ${absolutePath}: ${error instanceof Error ? error.message : String(error)}`); }
  return { path: absolutePath, exists: true, state: validate(parsed) };
}

export function writeCredentialHealthState(evaluations, { root = process.cwd(), now = new Date(), policyCatalogVersion = null, outputPath = DEFAULT_CREDENTIAL_HEALTH_STATE_PATH, maxEvaluations = DEFAULT_MAX_EVALUATIONS } = {}) {
  if (!Number.isInteger(maxEvaluations) || maxEvaluations < 1) throw new Error('maxEvaluations must be a positive integer');
  const snapshot = validate({
    ...emptyCredentialHealthState({ now, policyCatalogVersion }),
    evaluations: [...(evaluations ?? [])].sort((a, b) => String(a.credentialId).localeCompare(String(b.credentialId))).slice(0, maxEvaluations),
  });
  const absolutePath = path.isAbsolute(outputPath) ? outputPath : path.join(root, outputPath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true, mode: 0o700 });
  const tempPath = `${absolutePath}.tmp-${process.pid}`;
  try {
    fs.writeFileSync(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 });
    fs.chmodSync(tempPath, 0o600);
    fs.renameSync(tempPath, absolutePath);
  } catch (error) {
    try { if (fs.existsSync(tempPath)) fs.rmSync(tempPath, { force: true }); } catch { /* preserve original error */ }
    throw error;
  }
  return { path: absolutePath, state: snapshot };
}
