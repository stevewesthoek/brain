import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
const profile = JSON.parse(fs.readFileSync(path.join(root, 'operations/specs/graphify-operational-profile.json'), 'utf8'));
const legacyScript = fs.readFileSync(path.join(root, 'tools/scripts/graphify-nightly.sh'), 'utf8');
const scheduler = fs.readFileSync(path.join(root, 'tools/scripts/office-nightly-scheduler.sh'), 'utf8');
const typedJobs = JSON.parse(fs.readFileSync(path.join(root, 'operations/specs/typed-scheduler-jobs.json'), 'utf8'));
const errors = [];

if (profile.profileId !== 'graphify-bounded-semantic') errors.push('bounded semantic profile required');
if (profile.operationalOutputRoot !== 'runtime/local/graphify') errors.push('canonical output root required');
if (profile.generatedOutputAuthority !== 'non-authoritative') errors.push('generated output cannot be authoritative');
if (profile.publication !== 'atomic-staged-rename') errors.push('atomic publication required');
if (profile.corpus?.mode !== 'explicit-allowlist') errors.push('explicit allowlist required');
if (JSON.stringify(profile.corpus?.repositories) !== JSON.stringify(['brain'])) errors.push('Brain-only repository scope required');
if (profile.corpus?.mindApproved !== false) errors.push('Mind scope must remain unapproved');
if (!Array.isArray(profile.corpus?.semanticScopes) || profile.corpus.semanticScopes.length < 1) errors.push('semantic scope required');
for (const scope of profile.corpus?.semanticScopes ?? []) {
  if (scope.repository !== 'brain') errors.push(`scope ${scope.scopeId} is not Brain-only`);
  if (!Array.isArray(scope.paths) || scope.paths.length < 1) errors.push(`scope ${scope.scopeId} has no documents`);
  for (const documentPath of scope.paths ?? []) {
    if (!documentPath.endsWith('.md')) errors.push(`non-document semantic path ${documentPath}`);
    if (documentPath.toLowerCase().includes('/mind/') || documentPath.startsWith('mind/')) errors.push(`Mind path forbidden ${documentPath}`);
  }
}
for (const [key, value] of Object.entries(profile.caps ?? {})) if (!Number.isInteger(value) || value <= 0) errors.push(`invalid cap ${key}`);
for (const marker of ['.env', 'vendor', 'node_modules', 'runtime', 'graphify-out', 'credential', 'secret', 'backup', 'generated']) {
  if (!profile.corpus?.excluded?.some((item) => item.includes(marker))) errors.push(`missing exclusion ${marker}`);
}
if (profile.execution?.repositoryMutation !== 'forbidden') errors.push('repository mutation forbidden');
if (profile.execution?.automaticFullScan !== false) errors.push('automatic full scan must remain false');
if (profile.execution?.incrementalMode !== 'changed-approved-documents-only') errors.push('changed-document-only mode required');
if (profile.execution?.runnerMode !== 'explicit-only') errors.push('runner must be explicit-only');
if (profile.execution?.disableEnvironmentVariable !== 'GRAPHIFY_SEMANTIC_DISABLED') errors.push('named semantic disable environment variable required');
if (profile.execution?.codeOnlyInvokeRunner !== false) errors.push('code-only runner invocation forbidden');
if (profile.execution?.interpretUnchangedCode !== false) errors.push('unchanged code interpretation forbidden');
if (profile.execution?.structuralGraphGeneration !== 'frozen') errors.push('structural Graphify must remain frozen');
if (profile.safety?.exactSourceAuthority !== true || profile.safety?.cbmStructuralDefault !== true) errors.push('B8.4 authority hierarchy required');
if (profile.safety?.graphifyMayReadMind !== false) errors.push('Graphify Mind reads forbidden');
if (profile.safety?.externalOrLocalModelRequired !== false) errors.push('profile cannot require a model runtime');
if (!legacyScript.includes('GRAPHIFY_CONTAINED_EXECUTION')) errors.push('legacy structural entrypoint is not fail-closed');
if (!scheduler.includes('graphify-semantic-event.mjs')) errors.push('scheduler must call semantic event gate');
if (scheduler.includes("GRAPHIFY_PHASES=%q")) errors.push('legacy phased Graphify scheduler still active');
const job = typedJobs.jobs.find((item) => item.id === 'graphify-nightly');
if (!job || job.entrypoint !== 'tools/graphify-semantic-event.mjs' || job.scheduleType !== 'event-driven' || job.lifecycle !== 'policy-blocked' || job.mode !== 'disabled') errors.push('typed Graphify job is not a blocked event-driven semantic gate');

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('graphify-operational-profile-valid mode=event-driven-semantic-only structural=frozen mind=unapproved');
