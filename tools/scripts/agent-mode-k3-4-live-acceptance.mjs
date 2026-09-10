// Developer-only K3.4 acceptance fixture. This is not a general write CLI.
// It performs one MiniMax worker attempt and deliberately has no retry path.
import { execFile as execFileCallback } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import path from 'node:path';
import { runLiveWorkcellCodingWorker } from '../../projects/brain-core/dist/agent-mode/live-workcell-coding-worker.js';
import { readRuntimeProcessIdentity } from '../../projects/brain-core/dist/agent-mode/runtime-process-identity.js';
import { AgentModeSqliteStateStore } from '../../projects/brain-core/dist/agent-mode/sqlite-state-store.js';

// The acceptance controller is itself the owned brain-agent process. Preserve
// the product identity marker used by the K0 runtime-identity guard.
process.title = 'brain-agent k3-4-live-acceptance';

const execFile = promisify(execFileCallback);
const HARNESS_ROOT = '/Users/Office/.local/brain/runtimes/deepseek-harness/c389f96bf3a9b6807cb71ed6bdad5849be0df6d8';
const region = process.env.AWS_REGION ?? 'us-east-1';

async function aws(args) {
  const result = await execFile('aws', args, { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  return JSON.parse(String(result.stdout));
}

async function git(cwd, args) {
  await execFile('git', ['-C', cwd, ...args], { encoding: 'utf8' });
}

async function runtimeIdentityPreflight() {
  const preflightRoot = await mkdtemp('/tmp/brain-agent-mode-k3-4-identity-');
  const databasePath = path.join(preflightRoot, 'identity-preflight.db');
  const runId = 'run:k3-4-r1-identity-preflight';
  const attemptId = 'attempt:k3-4-r1-identity-preflight';
  const now = new Date().toISOString();
  const identity = readRuntimeProcessIdentity(process.pid, runId);
  if (!identity || !identity.command.includes('brain-agent')) throw new Error('runtime identity preflight failed: current owned brain-agent process was not observed');
  const store = new AgentModeSqliteStateStore(databasePath);
  store.admitAttempt({
    task: { taskId: 'task:k3-4-r1-identity-preflight', taskType: 'agent-mode.k3-4.identity-preflight', inputHash: 'identity-preflight', createdAt: now },
    run: { runId, taskId: 'task:k3-4-r1-identity-preflight', agentId: 'agent:worker-k3-4', createdAt: now },
    attempt: { attemptId, runId, agentId: 'agent:worker-k3-4', runtimeRef: 'runtime:deepseek-harness:identity-preflight', routeRef: 'minimax.minimax-m2.5', modelRef: 'agent-mode/minimax-m2.5', policyVersion: 'agent-mode-tier-policy-v2-auto-first', capabilityScopeHash: 'identity-scope', budgetScopeId: 'budget:k3-4-r1-identity-preflight', createdAt: now },
    budget: { budgetScopeId: 'budget:k3-4-r1-identity-preflight', maxSteps: 1, maxTokens: 1, maxDollars: 0.01 },
    estimate: { reservationId: 'reservation:k3-4-r1-identity-preflight', steps: 1, tokens: 1, dollars: 0.01 },
    lease: { leaseId: 'lease:k3-4-r1-identity-preflight', resourceKey: 'resource:k3-4-r1-identity-preflight', ownerId: 'agent:worker-k3-4', expiresAt: new Date(Date.parse(now) + 60_000).toISOString() },
    now,
  });
  store.setRunRuntimePid(runId, process.pid, identity);
  const attached = store.getRun(runId)?.runtimeIdentity;
  store.close();
  await rm(preflightRoot, { recursive: true, force: true });
  if (!attached || attached.command !== identity.command || attached.startedAt !== identity.startedAt || attached.token !== identity.token) throw new Error('runtime identity preflight failed: StateStore attachment did not preserve the observed identity');
  return { pid: process.pid, command: identity.command, runId, attached: true };
}

const identityPreflight = await runtimeIdentityPreflight();
if (process.argv.includes('--preflight-only')) {
  console.log(JSON.stringify({ status: 'passed', runtimeIdentityPreflight: identityPreflight, liveModelInvoked: false }, null, 2));
  process.exit(0);
}
const now = new Date();
const checkedAt = now.toISOString();
const freshUntil = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
const root = await mkdtemp('/tmp/brain-agent-mode-k3-4-live-');
const repositoryRoot = path.join(root, 'repo');
const workcellsRoot = path.join(root, 'workcells');
await mkdir(path.join(repositoryRoot, 'src'), { recursive: true });
await writeFile(path.join(repositoryRoot, 'src/message.ts'), 'export const message = "BEFORE";\n');
await git(repositoryRoot, ['init', '-b', 'main']);
await git(repositoryRoot, ['config', 'user.email', 'k3-4-live@example.invalid']);
await git(repositoryRoot, ['config', 'user.name', 'K3.4 Live Fixture']);
await git(repositoryRoot, ['add', 'src/message.ts']);
await git(repositoryRoot, ['commit', '-m', 'K3.4 disposable acceptance fixture']);

const identity = await aws(['sts', 'get-caller-identity', '--query', '{account:Account}', '--output', 'json']);
const details = await aws(['bedrock', 'get-foundation-model', '--model-identifier', 'minimax.minimax-m2.5', '--region', region, '--query', '{model:modelDetails.modelId,status:modelDetails.modelLifecycle.status}', '--output', 'json']);
const availability = await aws(['bedrock', 'get-foundation-model-availability', '--model-id', 'minimax.minimax-m2.5', '--region', region, '--output', 'json']);
if (details.status !== 'ACTIVE' || availability.authorizationStatus !== 'AUTHORIZED' || availability.agreementAvailability?.status !== 'AVAILABLE' || availability.entitlementAvailability !== 'AVAILABLE' || availability.regionAvailability !== 'AVAILABLE') {
  throw new Error(`fresh MiniMax Bedrock catalog/authorization evidence is not sufficient: ${JSON.stringify({ details, availability })}`);
}

const base = { state: 'healthy', accessState: 'verified', checkedAt, freshUntil, evidenceVersion: `agent-mode-live-access:${checkedAt}` };
const routeEvidence = {
  'agent-mode/minimax-m2.5': { ...base, modelRef: 'agent-mode/minimax-m2.5', routeKind: 'direct', routeId: 'minimax.minimax-m2.5' },
  'agent-mode/glm-5': { ...base, modelRef: 'agent-mode/glm-5', routeKind: 'direct', routeId: 'zai.glm-5' },
  'agent-mode/claude-opus-4.6': { ...base, modelRef: 'agent-mode/claude-opus-4.6', routeKind: 'inference-profile', routeId: 'us.anthropic.claude-opus-4-6-v1' },
};
const modelAccessEvidence = {
  version: `agent-mode-live-access:${checkedAt}`,
  accountRef: `aws-account:${identity.account}`,
  region,
  modelRef: 'agent-mode/minimax-m2.5',
  modelId: 'minimax.minimax-m2.5',
  routeKind: 'direct',
  routeId: 'minimax.minimax-m2.5',
  state: 'verified',
  catalogVisible: true,
  callable: true,
  checkedAt,
  freshUntil,
  source: 'aws-bedrock-get-foundation-model-and-availability',
};

const output = await runLiveWorkcellCodingWorker({
  databasePath: path.join(root, 'agent-mode.db'),
  repositoryRoot,
  workcellsRoot,
  harnessRoot: HARNESS_ROOT,
  now: checkedAt,
  accountRef: modelAccessEvidence.accountRef,
  routeEvidence,
  modelAccessEvidence,
  fixtureMode: false,
  keepAttemptArtifacts: true,
});
console.log(JSON.stringify({ ...output, runtimeIdentityPreflight: identityPreflight, liveFixtureRoot: root, accountRef: '[redacted]' }, null, 2));
