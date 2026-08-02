import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {loadJsonFile, validateCapabilityManifest, DEFAULT_ALLOWED_EVIDENCE_COMMANDS} from './capability-manifest-utils.mjs';

const BEGIN = '<!-- BEGIN GENERATED CAPABILITY STATUS -->';
const END = '<!-- END GENERATED CAPABILITY STATUS -->';

function defaultManifestPath() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../operations/specs/infinite-brain-capabilities.json');
}

function defaultRunbookPath() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../operations/runbooks/infinite-brain-roadmap-status.md');
}

function escapeCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

function evidenceStatusText(capability, evidenceResult) {
  if (capability.state !== 'verified') return 'not-run';
  if (!evidenceResult.ok) return `FAILED: ${capability.evidenceCommand}`;
  return `pass: ${capability.evidenceReport}`;
}

function defaultEvidenceRunner(command) {
  const result = spawnSync('sh', ['-lc', command], {
    cwd: path.resolve('.'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function runEvidence(manifest, evidenceRunner = defaultEvidenceRunner) {
  const results = new Map();
  for (const capability of manifest.capabilities ?? []) {
    if (capability.state !== 'verified') {
      results.set(capability.capabilityId, {ok: false, skipped: true});
      continue;
    }
    if (!DEFAULT_ALLOWED_EVIDENCE_COMMANDS.has(capability.evidenceCommand)) {
      results.set(capability.capabilityId, {ok: false, skipped: false, reason: 'not-allowlisted'});
      continue;
    }
    results.set(capability.capabilityId, evidenceRunner(capability.evidenceCommand));
  }
  return results;
}

export function renderCapabilityStatus(manifest, {evidenceRunner = defaultEvidenceRunner} = {}) {
  const validationErrors = validateCapabilityManifest(manifest, {runEvidence: false});
  if (validationErrors.length > 0) {
    throw new Error(`invalid_manifest:${validationErrors.join(',')}`);
  }
  const evidenceResults = runEvidence(manifest, evidenceRunner);
  const capabilities = [...manifest.capabilities].sort((left, right) => left.capabilityId.localeCompare(right.capabilityId));
  const lines = [];
  lines.push(BEGIN);
  lines.push('| Capability ID | Owner | State | Safety | Repo | Deployed | Observed | Verified | Entrypoint | Evidence Command | Last Verified | Dependencies | Feature Flag | Approval | Rollback/Disable | Evidence |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const capability of capabilities) {
    const evidenceResult = evidenceResults.get(capability.capabilityId) ?? {ok: false, skipped: true};
    lines.push([
      escapeCell(capability.capabilityId),
      escapeCell(capability.owner),
      escapeCell(capability.state),
      escapeCell(capability.safetyMode),
      escapeCell(capability.repositoryState),
      escapeCell(capability.deployedState),
      escapeCell(capability.observedState),
      escapeCell(capability.verifiedState),
      escapeCell(capability.entrypoint),
      escapeCell(capability.evidenceCommand),
      escapeCell(capability.lastVerified),
      escapeCell((capability.dependencies ?? []).join(', ')),
      escapeCell(capability.featureFlag),
      escapeCell(capability.approvalRequirement),
      escapeCell(capability.rollbackOrDisableCommand),
      escapeCell(evidenceStatusText(capability, evidenceResult)),
    ].join(' | '));
  }
  lines.push(END);
  return lines.join('\n');
}

export function mergeGeneratedBlock(content, generatedBlock) {
  const beginIndex = content.indexOf(BEGIN);
  const endIndex = content.indexOf(END);
  if (beginIndex === -1 || endIndex === -1 || endIndex < beginIndex) {
    const heading = '## Capability table';
    const headingIndex = content.indexOf(heading);
    if (headingIndex === -1) return `${content.trimEnd()}\n\n${generatedBlock}\n`;
    const afterHeading = content.indexOf('\n', headingIndex);
    const insertAt = afterHeading === -1 ? content.length : afterHeading + 1;
    return `${content.slice(0, insertAt)}\n${generatedBlock}\n${content.slice(insertAt)}`;
  }
  const before = content.slice(0, beginIndex).trimEnd();
  const after = content.slice(endIndex + END.length).trimStart();
  return `${before}\n${generatedBlock}\n${after}`;
}

export function generateCapabilityStatus({
  manifestPath = defaultManifestPath(),
  runbookPath = defaultRunbookPath(),
  write = false,
  check = false,
  evidenceRunner = defaultEvidenceRunner,
} = {}) {
  const manifest = loadJsonFile(manifestPath);
  const block = renderCapabilityStatus(manifest, {evidenceRunner});
  const current = fs.readFileSync(runbookPath, 'utf8');
  const next = mergeGeneratedBlock(current, block);
  const changed = next !== current;
  if (check) {
    return {changed, current, next, block, manifestPath, runbookPath};
  }
  if (write) {
    fs.writeFileSync(runbookPath, `${next}`);
  }
  return {changed, current, next, block, manifestPath, runbookPath};
}

async function main(argv = process.argv.slice(2)) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const [flag, inline] = token.split('=', 2);
    const key = flag.slice(2);
    const next = argv[i + 1];
    const value = inline ?? (next && !next.startsWith('--') ? argv[++i] : true);
    args[key] = value ?? true;
  }
  try {
    const result = generateCapabilityStatus({
      manifestPath: args.manifest ?? defaultManifestPath(),
      runbookPath: args.file ?? defaultRunbookPath(),
      write: args.write === true || args.write === 'true',
      check: args.check === true || args.check === 'true',
    });
    if (args.check === true || args.check === 'true') {
      process.stdout.write(`${result.changed ? 'capability-status=diff' : 'capability-status=pass'} capabilities=${loadJsonFile(args.manifest ?? defaultManifestPath()).capabilities.length}\n`);
      process.exitCode = result.changed ? 1 : 0;
      return;
    }
    process.stdout.write(`capability-status=${args.write ? 'written' : 'rendered'} capabilities=${loadJsonFile(args.manifest ?? defaultManifestPath()).capabilities.length}\n`);
  } catch (error) {
    process.stderr.write(`${String(error?.message ?? error)}\n`);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
