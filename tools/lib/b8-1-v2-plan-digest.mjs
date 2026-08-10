import crypto from 'node:crypto';

export const PLAN_VERSION = '8.0.0';
export const CONTRACT_VERSION = 'B8.1-V2.1';
export const KNOWN_STALE_DIGESTS = new Set([
  '86859184919a029c9a3aaa989c55240ad07aff368c09e6895d9564577dfadf30',
  'c037d9e2dbf67431ee8df0958a4cbe3d95e93dddefeef019a801661aeb939588',
  '57156d49e4f3ab273efb791dc3e4e128a839ba10552b860ab3219ae58e8bd1d1',
  '02971f6e644b004094ec6b60015ad3a5c379b63c25b14ea292ce425a5618dcbf',
  'd95c684c0aca9355d704b921f2d194f0a70959ff4518c20447645b6601fb4284',
  'f0695fdfe163c50f96544e9ff901dec8737eca1eff458d8a87dd01ca7664fe34',
  'd828c726920a0ec40b52a39fee23dcf8ebd79cf0b3573d2451634514a39b9a0b',
  'd6b9586e898a9e3a5ef24eaf13456f5d54be5101ae9765fb00a4d59aa46d36c6',
  'c4fa507e06b9614d7e23914d90a3fbf9bef2bfc3f371b6e8b7eeb6415707ac07',
]);
export const EXCLUDED_FIELDS = new Set(['planSha256', 'createdAt']);
export const ALLOWED_PLAN_FIELDS = new Set([
  'planVersion', 'contractVersion', 'runId', 'mode', 'canonicalMaterializationAuthorized',
  'canonicalExecutionAuthorized', 'selectedSubjects', 'graphifyStatus', 'partialEvidence',
  'manifest', 'manifestSchema', 'evidenceSchema', 'architecture', 'provider', 'runtime',
  'sandbox', 'sourcePins', 'implementationIdentity', 'brainImplementationCommit',
  'rehearsalEvidence', 'host', 'plannedCanonicalRunPath', 'checks', 'planSha256', 'createdAt',
]);

export function canonicalize(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
}
export function digestProjection(plan) {
  return Object.fromEntries(Object.entries(plan).filter(([key]) => !EXCLUDED_FIELDS.has(key)));
}
export function computePlanDigest(plan) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(digestProjection(plan)))).digest('hex');
}
export function verifyPlan(plan) {
  const errors = [];
  const unknownFields = Object.keys(plan).filter(key => !ALLOWED_PLAN_FIELDS.has(key));
  if (unknownFields.length) errors.push(`unknown plan fields: ${unknownFields.sort().join(',')}`);
  if (plan.planVersion !== PLAN_VERSION) errors.push(`planVersion must equal ${PLAN_VERSION}`);
  if (plan.contractVersion !== CONTRACT_VERSION) errors.push(`contractVersion must equal ${CONTRACT_VERSION}`);
  const computed = computePlanDigest(plan);
  if (plan.planSha256 !== computed) errors.push(`planSha256 mismatch: expected ${computed}`);
  if (KNOWN_STALE_DIGESTS.has(plan.planSha256)) errors.push('plan digest is a known stale historical digest');
  return { valid: errors.length === 0, computed, errors };
}
