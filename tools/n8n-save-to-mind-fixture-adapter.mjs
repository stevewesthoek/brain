import fs from 'node:fs';
import path from 'node:path';

export const CONTRACT_VERSION = 1;
export const FIXTURE_ID_PATTERNS = {
  success: /^b1-0a-success-fixture-[0-9]{8}T[0-9]{6}Z$/,
  failure: /^b1-0a-failure-fixture-[0-9]{8}T[0-9]{6}Z$/,
};
export const FIXED_REQUEST = Object.freeze({ method: 'POST', path: '/webhook/save-to-mind-fixture', timeoutMs: 30_000, redirects: 'error', retries: 0 });
const DESTINATIONS = Object.freeze({ success: 'inbox/new', failure: 'inbox/failed' });
const INSPECTED_DESTINATIONS = Object.freeze(['inbox/new', 'inbox/failed', 'capture/inbox', 'capture/failed']);

const fail = code => { throw new Error(code); };
const isPlainObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export function assertFixtureInput(input) {
  if (!isPlainObject(input) || Object.keys(input).sort().join(',') !== 'fixtureId,kind') fail('fixture_input_not_allowed');
  if (!Object.hasOwn(FIXTURE_ID_PATTERNS, input.kind) || !FIXTURE_ID_PATTERNS[input.kind].test(input.fixtureId)) fail('fixture_id_or_kind_invalid');
  return { kind: input.kind, fixtureId: input.fixtureId };
}

export function buildFixturePayload({ kind, fixtureId }) {
  assertFixtureInput({ kind, fixtureId });
  return Object.freeze({ contractVersion: CONTRACT_VERSION, fixtureId, fixtureKind: kind, source: 'brain-to-mind-b1-0a-fixture-v1', forceFailure: kind === 'failure' });
}

export async function executeFixture(input, { request, replayStore = new Set() } = {}) {
  const fixture = assertFixtureInput(input);
  if (typeof request !== 'function') fail('fixed_client_unavailable');
  if (replayStore.has(fixture.fixtureId)) fail('fixture_replay_rejected');
  replayStore.add(fixture.fixtureId);
  let response;
  try {
    response = await request({ ...FIXED_REQUEST, payload: buildFixturePayload(fixture) });
  } catch {
    return { contractVersion: CONTRACT_VERSION, fixtureId: fixture.fixtureId, fixtureKind: fixture.kind, classification: 'ambiguous', requestCount: 1, retries: 0, rawResponseEmitted: false };
  }
  if (!isPlainObject(response) || !Number.isInteger(response.status)) fail('fixture_response_invalid');
  const classification = response.status >= 200 && response.status < 300 ? 'succeeded' : response.status >= 400 && response.status < 500 ? 'definitively_failed' : 'ambiguous';
  return { contractVersion: CONTRACT_VERSION, fixtureId: fixture.fixtureId, fixtureKind: fixture.kind, classification, requestCount: 1, retries: 0, rawResponseEmitted: false, ...(typeof response.receiptId === 'string' && /^[A-Za-z0-9._-]{1,200}$/.test(response.receiptId) ? { receiptId: response.receiptId } : {}) };
}

function walk(root, fixtureId) {
  if (!fs.existsSync(root)) return [];
  const result = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const resolved = path.join(root, entry.name);
    if (entry.isDirectory()) result.push(...walk(resolved, fixtureId));
    else if (entry.isFile() && entry.name.includes(fixtureId)) result.push(resolved);
  }
  return result;
}

export function createFixtureEvidenceInspector({ rootResolver } = {}) {
  if (typeof rootResolver !== 'function') fail('fixture_evidence_root_unavailable');
  return function inspectFixtureEvidence(input) {
    const fixture = assertFixtureInput(input);
    const root = rootResolver();
    if (typeof root !== 'string' || !path.isAbsolute(root)) fail('fixture_evidence_root_invalid');
    const matches = Object.fromEntries(INSPECTED_DESTINATIONS.map(destination => [destination, walk(path.join(root, destination), fixture.fixtureId).map(file => path.relative(root, file).replaceAll(path.sep, '/'))]));
    const expected = DESTINATIONS[fixture.kind];
    if (matches[expected].length !== 1) fail('fixture_destination_count_invalid');
    if (INSPECTED_DESTINATIONS.filter(destination => destination !== expected).some(destination => matches[destination].length !== 0)) fail('fixture_destination_policy_failed');
    return { contractVersion: CONTRACT_VERSION, fixtureId: fixture.fixtureId, fixtureKind: fixture.kind, repositoryRelativePath: matches[expected][0], destination: expected, createdFileCount: 1, overwrite: false, retiredPathWrite: false };
  };
}

export function validateFixtureEvidence(value) {
  if (!isPlainObject(value)) fail('fixture_evidence_invalid');
  const allowed = new Set(['contractVersion', 'fixtureId', 'fixtureKind', 'repositoryRelativePath', 'destination', 'createdFileCount', 'overwrite', 'retiredPathWrite', 'failureStage', 'timestamp', 'hash', 'receiptId']);
  if (Object.keys(value).some(key => !allowed.has(key) || /credential|secret|content|authorization|token/i.test(key))) fail('fixture_evidence_field_not_allowed');
  const fixture = assertFixtureInput({ kind: value.fixtureKind, fixtureId: value.fixtureId });
  if (value.contractVersion !== CONTRACT_VERSION || value.destination !== DESTINATIONS[fixture.kind] || typeof value.repositoryRelativePath !== 'string' || !value.repositoryRelativePath.startsWith(`${value.destination}/`) || value.createdFileCount !== 1 || value.overwrite !== false || value.retiredPathWrite !== false) fail('fixture_evidence_policy_failed');
  if (fixture.kind === 'failure' && (typeof value.failureStage !== 'string' || value.failureStage.length < 1 || value.failureStage.length > 200)) fail('fixture_failure_stage_required');
  return true;
}
