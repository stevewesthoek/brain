#!/usr/bin/env node

import { AGENT_MODE_MODEL_ROUTES, type AdmittedModelRef, type ModelAccessEvidence } from './model-gateway.js';
import { admitManualModelOverride } from './model-tier-policy.js';
import type { RouteEvidence } from './model-tier-policy.js';
import { defaultAgentModeDatabasePath, AgentModeSqliteStateStore } from './sqlite-state-store.js';
import { AGENT_MODE_CONTROL_SCHEMA_VERSION, AgentModeControlService, deriveAgentModeControlOperationId } from './agent-mode-control-service.js';
import { runLiveAgentModeSlice } from './live-agent-mode-slice.js';
import { WorkcellManager } from './workcell.js';
import { runAgentModeSchedulerTick } from './scheduler.js';
import { BRAIN_TASK_LIFECYCLE_SOURCE, GIT_REPOSITORY_REVISION_SOURCE, INFRASTRUCTURE_HOST_HEALTH_SOURCE, GitRepositoryEventSourceAdapter, HostHealthEventSourceAdapter, InternalLifecycleEventSourceAdapter, pollEventSourcesOnce } from './event-source.js';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { loadBrainRuntimeConfig, safeBrainRuntimeConfigView } from './portable-runtime-config.js';
import { bootstrapPlanJson, createBrainBootstrapPlan } from './bootstrap-plan.js';
import { assertPackagedConsoleBoot, buildRuntimePackage, verifyRuntimePackage } from './runtime-package.js';
import { createLocalInstallPlan, installRuntimePackage, readRuntimePackageManifest } from './local-install.js';
import { createStateSnapshot, importStateSnapshot, readStateSnapshot, verifyStateSnapshot, writeStateSnapshot } from './state-relocation.js';
import { createReleaseManifest, createReleaseManifestWithSigner, readReleaseManifest, retainVerifiedRelease, verifyReleaseManifest, writeReleaseManifest } from './release-maintenance.js';
import { inspectNodeExecutable, runProductionServiceDoctor } from './service-resilience.js';
import { brainServiceContentSha256, signBrainServiceRequest, BRAIN_SERVICE_AUTH_PROTOCOL_VERSION } from '../security/brain-service-auth.js';
import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline';
import { resolveBrainServiceIdentity } from './service-identity.js';
import { runInteractiveTerminalSession } from './interactive-terminal-session.js';
import { startTerminalSubmissionFeedback, type TerminalSubmissionFeedback } from './terminal-console.js';
import type { TerminalExecutionStatus } from './terminal-intake.js';
import { JARVIS_CONTEXT_INTAKE_SCHEMA_VERSION } from './jarvis-context-intake.js';
import type { JarvisContextRequestV1 } from './jarvis-local-context.js';
import { applyEventSourceRetentionPlan, planEventSourceRetention } from './event-source-retention.js';

const BASE_URL = process.env.BRAIN_CORE_URL ?? 'http://127.0.0.1:4877';

function jsonEnv<T>(name: string): T | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  try { return JSON.parse(raw) as T; } catch { throw new Error(`${name} must contain valid JSON`); }
}

const MODEL_REFS: Record<string, AdmittedModelRef | 'auto'> = {
  auto: 'auto',
  'minimax-m2.5': 'agent-mode/minimax-m2.5',
  'agent-mode/minimax-m2.5': 'agent-mode/minimax-m2.5',
  'glm-5': 'agent-mode/glm-5',
  'agent-mode/glm-5': 'agent-mode/glm-5',
  'opus-4.6': 'agent-mode/claude-opus-4.6',
  'agent-mode/claude-opus-4.6': 'agent-mode/claude-opus-4.6',
};

function usage(): void {
  console.error('Usage: brain-agent jarvis [--task TEXT] [--context PATH] [--repo REF=PATH] [--no-context] [--conversation-id ID] [--model auto|minimax-m2.5|glm-5|opus-4.6|codex] [--json] | brain-agent submit --repository-ref REF --repository-root PATH [--model auto|codex] [--task TEXT] [--conversation-id ID] [--json] | brain-agent config validate | brain-agent bootstrap plan --dry-run --install-root PATH [--source-root PATH] | brain-agent package build|verify ... | brain-agent release create|verify|retain ... | brain-agent state export|verify|import ... | brain-agent state event-sources plan|apply --store PATH [--now ISO] [--retired-at ISO] [--plan-digest DIGEST] [--allow-write] | brain-agent local install plan|apply ... | brain-agent service doctor ... | brain-agent capabilities | brain-agent heartbeat --once | brain-agent scheduler tick | brain-agent sources poll --once ... | brain-agent run ... | brain-agent inspect|pause|resume|cancel|kill RUN_ID ... | brain-agent workcell create|inspect|destroy ...');
}

function canonicalTerminalRequest(value: Record<string, unknown>): string { return JSON.stringify(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))); }

type TerminalStatusPayload = {
  ok: boolean;
  status?: TerminalExecutionStatus;
  error?: { message?: string };
};

function terminalStatusUrl(coreUrl: string, rootGoalId: string): string {
  return `${coreUrl.replace(/\/$/u, '')}/agent-mode/terminal/intake/${encodeURIComponent(rootGoalId)}`;
}

async function readTerminalStatus(coreUrl: string, rootGoalId: string): Promise<TerminalExecutionStatus> {
  const response = await fetch(terminalStatusUrl(coreUrl, rootGoalId));
  const payload = await response.json() as TerminalStatusPayload;
  if (!response.ok || !payload.ok || !payload.status) throw new Error(payload.error?.message ?? 'terminal status unavailable');
  return payload.status;
}

async function promptTerminalTask(prompt = 'Jarvis › '): Promise<string | null> {
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await new Promise<string | null>((resolve) => {
      let settled = false;
      const finish = (value: string | null): void => { if (!settled) { settled = true; resolve(value); } };
      readline.once('close', () => finish(null));
      readline.question(prompt, (answer) => finish(answer));
    });
  } finally { readline.close(); }
}

async function cancelTerminalRun(rootRunId: string): Promise<string> {
  const databasePath = process.env.BRAIN_AGENT_MODE_DATABASE ?? defaultAgentModeDatabasePath();
  const store = new AgentModeSqliteStateStore(databasePath);
  try {
    const requestedAt = new Date().toISOString();
    const command = {
      schemaVersion: AGENT_MODE_CONTROL_SCHEMA_VERSION,
      action: 'cancel' as const,
      runId: rootRunId,
      actor: { source: 'cli' as const, actorId: 'brain-agent-terminal-console' },
      requestedAt,
      reason: 'terminal console cancel',
    };
    const control = new AgentModeControlService(store);
    const result = control.cancelRun({ ...command, operationId: deriveAgentModeControlOperationId(command) });
    return `Cancel ${result.outcome}: ${result.reasonCode}`;
  } finally { store.close(); }
}

async function submitTerminalTask(): Promise<void> {
  const repositoryRef = requiredFlag('--repository-ref');
  const repositoryRoot = requiredFlag('--repository-root');
  const rawModel = flag('--model') ?? 'auto';
  const model = rawModel;
  const conversationId = flag('--conversation-id') ?? flag('--resume');
  const initialText = flag('--task') ?? await promptTerminalTask();
  const operatorId = flag('--operator-id') ?? 'operator:local-terminal';
  const coreUrl = flag('--core-url') ?? BASE_URL;
  if (!['auto', 'minimax-m2.5', 'glm-5', 'opus-4.6', 'codex'].includes(model)) throw new Error('terminal intake model is not admitted');
  const json = process.argv.includes('--json');
  let submissionFeedback: TerminalSubmissionFeedback | undefined;
  const session = await runInteractiveTerminalSession({
    initialText,
    ...(conversationId ? { conversationId } : {}),
    json,
    interactive: !json && Boolean(process.stdin.isTTY && process.stdout.isTTY),
    prompt: () => promptTerminalTask(),
    readStatus: (rootGoalId) => readTerminalStatus(coreUrl, rootGoalId),
    cancelTurn: (rootRunId) => cancelTerminalRun(rootRunId),
    submissionHooks: {
      onStart: () => {
        if (!json && process.stdin.isTTY && process.stdout.isTTY) submissionFeedback = startTerminalSubmissionFeedback({ output: process.stdout, color: !process.env.NO_COLOR });
      },
      onFinish: () => {
        submissionFeedback?.stop();
        submissionFeedback = undefined;
      },
    },
    submitTurn: async (text, turnNumber, activeConversationId) => {
      const material = { repositoryRef, repositoryRoot, model, text, turnNumber, conversationId: activeConversationId ?? null };
      const requestId = `request:terminal:${createHash('sha256').update(canonicalTerminalRequest(material)).digest('hex').slice(0, 48)}`;
      const body = JSON.stringify({ schemaVersion: 'agent-mode.terminal-intake.v1', requestId, operatorId, repositoryRef, repositoryRoot, model, text, ...(activeConversationId ? { conversationId: activeConversationId } : {}), ...(model === 'codex' ? { codexEscalation: { runtime: 'codex-cli', reason: flag('--codex-reason') ?? '', requestedCapability: 'repo.read', approvalId: flag('--approval-id') ?? '', approvedBy: operatorId } } : {}) });
      const identity = resolveBrainServiceIdentity();
      const timestamp = new Date().toISOString();
      const contentSha256 = brainServiceContentSha256(body);
      const headers = {
        'content-type': 'application/json',
        'x-brain-auth-version': BRAIN_SERVICE_AUTH_PROTOCOL_VERSION,
        'x-brain-service-id': identity.serviceId,
        'x-brain-request-id': requestId,
        'x-brain-request-timestamp': timestamp,
        'x-brain-content-sha256': contentSha256,
        'x-brain-signature': signBrainServiceRequest({ serviceId: identity.serviceId, secret: identity.secret, method: 'POST', pathname: '/agent-mode/terminal/intake', requestId, timestamp, contentSha256 }),
      };
      const response = await fetch(`${coreUrl.replace(/\/$/u, '')}/agent-mode/terminal/intake`, { method: 'POST', headers, body });
      const payload = await response.json() as Record<string, unknown>;
      const resultRecord = payload.result as Record<string, unknown> | undefined;
      const receipt = resultRecord?.receipt as Record<string, unknown> | undefined;
      const rootGoalId = typeof receipt?.rootGoalId === 'string' ? receipt.rootGoalId : undefined;
      const rootRunId = typeof receipt?.rootRunId === 'string' ? receipt.rootRunId : undefined;
      if (!response.ok || !rootGoalId || !rootRunId) {
        if (json) process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
        else process.stderr.write(`${String((payload.error as Record<string, unknown> | undefined)?.message ?? 'terminal intake failed')}\n`);
        process.exitCode = 1;
        return null;
      }
      (json ? process.stderr : process.stdout).write(`Jarvis accepted · ${turnNumber === 1 ? 'starting' : `turn ${turnNumber}`}\n`);
      return { rootGoalId, rootRunId, ...(typeof receipt?.conversationId === 'string' ? { conversationId: receipt.conversationId } : {}), ...(typeof receipt?.createdAt === 'string' ? { startedAt: receipt.createdAt } : {}) };
    },
  });
  if (!session.detached && session.lastStatus?.status && session.lastStatus.status !== 'completed') process.exitCode = 1;
}

function allFlags(name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < process.argv.length; index += 1) { const value = process.argv[index + 1]; if (process.argv[index] === name && value) values.push(value); }
  return values;
}

function contextArguments(): JarvisContextRequestV1[] {
  if (process.argv.includes('--no-context')) return [];
  const encoded = allFlags('--context-json');
  const contexts = encoded.flatMap((value) => {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) throw new Error('--context-json must contain an array');
    return parsed as JarvisContextRequestV1[];
  });
  for (const value of allFlags('--context')) contexts.push({ kind: 'filesystem', path: value, requestedAccess: 'read', recursive: true, origin: 'direct' });
  for (const value of allFlags('--repo')) {
    const separator = value.indexOf('=');
    if (separator < 1) throw new Error('--repo must use REF=PATH');
    contexts.push({ kind: 'repository', repositoryRef: value.slice(0, separator), path: value.slice(separator + 1), requestedAccess: 'read', recursive: true, origin: 'direct' });
  }
  if (contexts.length > 0) return contexts;
  const cwd = process.cwd();
  return [{ kind: 'filesystem', path: cwd, requestedAccess: 'read', recursive: true, origin: 'direct' }];
}

async function submitJarvisContextTask(): Promise<void> {
  const rawModel = flag('--model') ?? 'auto';
  const model = rawModel;
  const conversationId = flag('--conversation-id') ?? flag('--resume');
  const initialText = flag('--task') ?? await promptTerminalTask();
  const operatorId = flag('--operator-id') ?? 'operator:local-terminal';
  const coreUrl = flag('--core-url') ?? BASE_URL;
  const contexts = contextArguments();
  const json = process.argv.includes('--json');
  let submissionFeedback: TerminalSubmissionFeedback | undefined;
  const session = await runInteractiveTerminalSession({
    initialText,
    ...(conversationId ? { conversationId } : {}),
    json,
    interactive: !json && Boolean(process.stdin.isTTY && process.stdout.isTTY),
    prompt: () => promptTerminalTask(),
    readStatus: (rootGoalId) => readTerminalStatus(coreUrl, rootGoalId),
    cancelTurn: (rootRunId) => cancelTerminalRun(rootRunId),
    submissionHooks: {
      onStart: () => {
        if (!json && process.stdin.isTTY && process.stdout.isTTY) submissionFeedback = startTerminalSubmissionFeedback({ output: process.stdout, color: !process.env.NO_COLOR });
      },
      onFinish: () => {
        submissionFeedback?.stop();
        submissionFeedback = undefined;
      },
    },
    submitTurn: async (text, turnNumber, activeConversationId) => {
      const material = { operatorId, model, text, contexts, turnNumber, conversationId: activeConversationId ?? null };
      const requestId = `request:jarvis-context:${createHash('sha256').update(canonicalTerminalRequest(material)).digest('hex').slice(0, 48)}`;
      const body = JSON.stringify({ schemaVersion: JARVIS_CONTEXT_INTAKE_SCHEMA_VERSION, requestId, operatorId, model, text, contexts, ...(activeConversationId ? { conversationId: activeConversationId } : {}), ...(model === 'codex' ? { codexEscalation: { runtime: 'codex-cli', reason: flag('--codex-reason') ?? '', requestedCapability: 'repo.read', approvalId: flag('--approval-id') ?? '', approvedBy: operatorId } } : {}) });
      const identity = resolveBrainServiceIdentity();
      const timestamp = new Date().toISOString();
      const contentSha256 = brainServiceContentSha256(body);
      const headers = {
        'content-type': 'application/json',
        'x-brain-auth-version': BRAIN_SERVICE_AUTH_PROTOCOL_VERSION,
        'x-brain-service-id': identity.serviceId,
        'x-brain-request-id': requestId,
        'x-brain-request-timestamp': timestamp,
        'x-brain-content-sha256': contentSha256,
        'x-brain-signature': signBrainServiceRequest({ serviceId: identity.serviceId, secret: identity.secret, method: 'POST', pathname: '/agent-mode/jarvis/intake/v2', requestId, timestamp, contentSha256 }),
      };
      const response = await fetch(`${coreUrl.replace(/\/$/u, '')}/agent-mode/jarvis/intake/v2`, { method: 'POST', headers, body });
      const payload = await response.json() as Record<string, unknown>;
      if (!response.ok) {
        if (json) process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
        else process.stderr.write(`${String((payload.error as Record<string, unknown> | undefined)?.message ?? (payload.result as Record<string, unknown> | undefined)?.reasonCode ?? 'Jarvis context intake failed')}\n`);
        process.exitCode = 1;
        return null;
      }
      const result = payload.result as Record<string, unknown> | undefined;
      const receipt = result?.receipt as Record<string, unknown> | undefined;
      const rootGoalId = typeof receipt?.rootGoalId === 'string' ? receipt.rootGoalId : undefined;
      const rootRunId = typeof receipt?.rootRunId === 'string' ? receipt.rootRunId : undefined;
      if (!rootGoalId || !rootRunId) {
        if (json) process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
        else process.stderr.write('Jarvis context intake returned no executable receipt.\n');
        process.exitCode = 1;
        return null;
      }
      if (json) process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
      else process.stdout.write(`Jarvis accepted · ${Array.isArray(receipt?.contextIds) ? receipt.contextIds.length : 0} admitted context(s)\n`);
      return { rootGoalId, rootRunId, ...(typeof receipt?.conversationId === 'string' ? { conversationId: receipt.conversationId } : {}), ...(typeof receipt?.createdAt === 'string' ? { startedAt: receipt.createdAt } : {}) };
    },
  });
  if (!session.detached && session.lastStatus?.status && session.lastStatus.status !== 'completed') process.exitCode = 1;
}

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

function requiredFlag(name: string): string {
  const value = flag(name);
  if (!value) throw new Error(`missing required ${name}`);
  return value;
}

function signWithMacOSKeychain(material: string, service: string, account: string, keyId: string): string {
  const script = path.resolve(process.cwd(), 'tools/infrastructure-identity-access/macos-keychain-release-signer.swift');
  let parsed: { ok?: boolean; signatureBase64?: string; privateKeyExported?: boolean; algorithm?: string };
  try {
    const stdout = execFileSync('/usr/bin/swift', [script, 'sign', service, account, keyId], { cwd: '/', env: { PATH: '/usr/bin:/bin:/usr/sbin:/sbin', HOME: process.env.HOME ?? '/' }, input: material, encoding: 'utf8', timeout: 30_000, maxBuffer: 64 * 1024 });
    parsed = JSON.parse(String(stdout)) as typeof parsed;
  } catch { throw new Error('macOS Keychain release signer failed or returned malformed output'); }
  if (parsed.ok !== true || parsed.algorithm !== 'Ed25519' || parsed.privateKeyExported !== false || typeof parsed.signatureBase64 !== 'string') throw new Error('macOS Keychain signer response was not admissible');
  return parsed.signatureBase64;
}

function printModelRequest(rawModel: string): void {
  const modelRef = MODEL_REFS[rawModel.toLowerCase()];
  if (!modelRef || (modelRef !== 'auto' && !admitManualModelOverride(modelRef).ok)) {
    console.error(`Invalid Brain model override: ${rawModel}`);
    process.exitCode = 2;
    return;
  }
  process.stdout.write(`${JSON.stringify({
    kind: 'agent-mode-model-request',
    policy: 'brain-agent-mode',
    admission: modelRef === 'auto' ? 'required' : admitManualModelOverride(modelRef),
    model: rawModel,
    modelRef: modelRef === 'auto' ? null : modelRef,
    route: modelRef === 'auto' ? null : AGENT_MODE_MODEL_ROUTES[modelRef],
    note: 'This is a policy request; Brain performs access, health, budget, capability, safety, and admission checks before invocation.',
  }, null, 2)}\n`);
}

export async function runAgentModeCli(): Promise<void> {
  const command = process.argv[2];

  if (command === 'submit') {
    try { await submitTerminalTask(); } catch (error) { console.error(`brain-agent submit failed: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; }
    return;
  }

  if (command === 'jarvis') {
    try { await submitJarvisContextTask(); } catch (error) { console.error(`brain-agent jarvis failed: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; }
    return;
  }

  if (command === 'config') {
    if (process.argv[3] !== 'validate' || process.argv.length !== 4) { usage(); process.exitCode = 1; return; }
    const config = loadBrainRuntimeConfig();
    process.stdout.write(`${JSON.stringify({ kind: 'brain-runtime-config-validation', schemaVersion: config.schemaVersion, profile: config.profile, capabilities: config.optionalCapabilities, config: safeBrainRuntimeConfigView(config) }, null, 2)}\n`);
    return;
  }

  if (command === 'bootstrap') {
    if (process.argv[3] !== 'plan' || !process.argv.includes('--dry-run')) {
      console.error('D0-B bootstrap is planning-only; use: brain-agent bootstrap plan --dry-run --install-root PATH [--source-root PATH]');
      process.exitCode = 1;
      return;
    }
    const sourceRoot = flag('--source-root') ?? process.cwd();
    const installationRoot = requiredFlag('--install-root');
    const profilePath = flag('--profile');
    const hostProfilePath = flag('--host-profile');
    const stateRoot = flag('--state-root');
    const mode = flag('--mode') as 'source-development' | 'packaged-release' | undefined;
    const platform = flag('--platform');
    const architecture = flag('--architecture');
    const nodeVersion = flag('--node-version');
    const npmVersion = flag('--npm-version');
    const env: NodeJS.ProcessEnv = { ...process.env, ...(stateRoot ? { BRAIN_RUNTIME_STATE_ROOT: stateRoot } : {}), ...(profilePath ? { BRAIN_RUNTIME_PROFILE_PATH: profilePath } : {}), ...(hostProfilePath ? { BRAIN_RUNTIME_HOST_PROFILE_PATH: hostProfilePath } : {}) };
    const runtimeConfig = loadBrainRuntimeConfig({ env, ...(profilePath ? { portableProfilePath: profilePath } : {}), ...(hostProfilePath ? { hostProfilePath } : {}) });
    const sourceRevision = flag('--source-revision');
    const plan = createBrainBootstrapPlan({ sourceRoot, installationRoot, runtimeConfig, mode: mode ?? 'source-development', ...(sourceRevision ? { sourceRevision } : {}), ...(profilePath ? { profilePath } : {}), ...(hostProfilePath ? { hostProfilePath } : {}), ...(platform ? { platform } : {}), ...(architecture ? { architecture } : {}), ...(nodeVersion ? { nodeVersion } : {}), ...(npmVersion ? { npmVersion } : {}), serviceAuthConfigured: Boolean(env.BRAIN_CORE_SERVICE_ID && env.BRAIN_CORE_SERVICE_SECRET), operatorAuthConfigured: Boolean(env.BRAIN_CONSOLE_OPERATOR_ID && env.BRAIN_CONSOLE_OPERATOR_SECRET) });
    process.stdout.write(bootstrapPlanJson(plan));
    return;
  }

  if (command === 'package') {
    const action = process.argv[3];
    if (action === 'build') {
      const outputRoot = requiredFlag('--output');
      const releaseRevision = requiredFlag('--release-revision');
      const sourceRoot = flag('--source-root') ?? process.cwd();
      const platform = flag('--platform');
      const architecture = flag('--architecture');
      process.stdout.write(`${JSON.stringify(buildRuntimePackage({ sourceRoot, outputRoot, releaseRevision, requireCleanSource: true, ...(platform ? { platform } : {}), ...(architecture ? { architecture } : {}) }), null, 2)}\n`);
      return;
    }
    if (action === 'verify') {
      const result = verifyRuntimePackage(requiredFlag('--root'));
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      if (!result.ok) process.exitCode = 1;
      return;
    }
    usage();
    process.exitCode = 1;
    return;
  }

  if (command === 'release') {
    const action = process.argv[3];
    if (action === 'create') {
      const packageRoot = requiredFlag('--package'); const releaseVersion = requiredFlag('--release-version'); const sourceRevision = requiredFlag('--source-revision'); const keyId = requiredFlag('--key-id'); const buildTimestamp = flag('--build-timestamp') ?? new Date().toISOString(); const previousReleaseVersion = flag('--previous-release-version') ?? null;
      const keychainService = flag('--keychain-service'); const keychainAccount = flag('--keychain-account');
      if (Boolean(keychainService) !== Boolean(keychainAccount) || (keychainService && flag('--private-key'))) throw new Error('release create requires either --private-key or both keychain service and account');
      assertPackagedConsoleBoot(packageRoot);
      const manifest = keychainService && keychainAccount
        ? createReleaseManifestWithSigner({ packageRoot, releaseVersion, sourceRevision, keyId, buildTimestamp, previousReleaseVersion, signer: (material) => {
          return signWithMacOSKeychain(material, keychainService, keychainAccount, keyId);
        } })
        : createReleaseManifest({ packageRoot, releaseVersion, sourceRevision, keyId, privateKey: readFileSync(requiredFlag('--private-key')), buildTimestamp, previousReleaseVersion });
      const output = requiredFlag('--output');
      writeReleaseManifest(manifest, output);
      process.stdout.write(`${JSON.stringify({ ok: true, releaseId: manifest.releaseId, releaseVersion: manifest.releaseVersion, output }, null, 2)}\n`);
      return;
    }
    if (action === 'verify') {
      const expectedSourceRevision = flag('--expected-source-revision'); const expectedReleaseVersion = flag('--expected-release-version');
      const result = verifyReleaseManifest(readReleaseManifest(requiredFlag('--manifest')), { packageRoot: requiredFlag('--package'), publicKey: readFileSync(requiredFlag('--public-key')), ...(expectedSourceRevision ? { expectedSourceRevision } : {}), ...(expectedReleaseVersion ? { expectedReleaseVersion } : {}) });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`); if (!result.ok) process.exitCode = 1; return;
    }
    if (action === 'retain') {
      const result = retainVerifiedRelease({ packageRoot: requiredFlag('--package'), releaseManifestPath: requiredFlag('--manifest'), signingPublicMetadataPath: requiredFlag('--signing-public'), publicKey: readFileSync(requiredFlag('--public-key')), vaultRoot: requiredFlag('--vault-root'), retainedAt: flag('--retained-at') ?? new Date().toISOString() });
      process.stdout.write(`${JSON.stringify({ ok: true, status: result.status, vaultPath: result.vaultPath, receipt: result.receipt }, null, 2)}\n`);
      return;
    }
    usage(); process.exitCode = 1; return;
  }

  if (command === 'state') {
    const action = process.argv[3];
    if (action === 'verify') {
      const result = verifyStateSnapshot(JSON.parse(readFileSync(requiredFlag('--snapshot'), 'utf8')));
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      if (!result.ok) process.exitCode = 1;
      return;
    }
    if (action === 'export') {
      const sourcePath = requiredFlag('--store'); const outputPath = requiredFlag('--output');
      const source = AgentModeSqliteStateStore.openExisting(sourcePath);
      if (!source) throw new Error('state export requires an existing closed source store');
      try {
        const snapshot = createStateSnapshot(source, { mode: (flag('--mode') as 'relocation-final' | 'backup/logical-fixture' | undefined) ?? 'relocation-final', createdAt: new Date().toISOString() });
        writeStateSnapshot(snapshot, outputPath); process.stdout.write(`${JSON.stringify({ ok: true, snapshotId: snapshot.snapshotId, outputPath }, null, 2)}\n`);
      } finally { source.close(); }
      return;
    }
    if (action === 'import') {
      const snapshot = readStateSnapshot(requiredFlag('--snapshot')); const result = importStateSnapshot(snapshot, requiredFlag('--target-store'), requiredFlag('--expect-snapshot'));
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`); if (!result.ok) process.exitCode = 1; return;
    }
    if (action === 'event-sources') {
      const mode = process.argv[4];
      const databasePath = requiredFlag('--store');
      const now = flag('--now') ?? new Date().toISOString();
      if (mode === 'plan') {
        const store = AgentModeSqliteStateStore.openExisting(databasePath);
        if (!store) throw new Error('event-source retention plan requires an existing StateStore');
        try { process.stdout.write(`${JSON.stringify(planEventSourceRetention(store, now), null, 2)}\n`); } finally { store.close(); }
        return;
      }
      if (mode === 'apply') {
        if (!process.argv.includes('--allow-write')) throw new Error('event-source retention apply requires --allow-write');
        const store = new AgentModeSqliteStateStore(databasePath);
        try {
          const plan = planEventSourceRetention(store, now);
          const expectedDigest = flag('--plan-digest');
          if (expectedDigest && expectedDigest !== plan.planDigest) throw new Error('event-source retention plan digest conflict');
          const retiredAt = flag('--retired-at') ?? now;
          const result = applyEventSourceRetentionPlan(store, plan, retiredAt);
          process.stdout.write(`${JSON.stringify({ plan, result }, null, 2)}\n`);
        } finally { store.close(); }
        return;
      }
      usage(); process.exitCode = 1; return;
    }
    usage(); process.exitCode = 1; return;
  }

  if (command === 'local' && process.argv[3] === 'install') {
    const action = process.argv[4];
    const packageRoot = requiredFlag('--package');
    const installRoot = requiredFlag('--install-root');
    const platform = flag('--platform') as 'darwin' | 'linux' | undefined;
    const architecture = flag('--architecture') as 'arm64' | 'x64' | undefined;
    if (!platform || !architecture) throw new Error('local install requires --platform and --architecture');
    const pkg = readRuntimePackageManifest(packageRoot);
    const input = { packageRoot, installRoot, platform, architecture, nodeExecutable: flag('--node-executable') ?? process.execPath, nodeVersion: flag('--node-version') ?? process.version, secretRef: flag('--secret-ref') ?? 'config/secrets.env' };
    if (action === 'plan') {
      process.stdout.write(`${JSON.stringify(createLocalInstallPlan(input, pkg), null, 2)}\n`);
      return;
    }
    if (action === 'apply') {
      const runtime = inspectNodeExecutable(input.nodeExecutable);
      if (!runtime.ok) throw new Error(`local install requires an executable compatible Node runtime: ${runtime.reason ?? 'unknown'}`);
      const result = installRuntimePackage({ ...input, nodeVersion: runtime.version ?? input.nodeVersion });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      if (!result.ok) process.exitCode = 1;
      return;
    }
    usage(); process.exitCode = 1; return;
  }

  if (command === 'service' && process.argv[3] === 'doctor') {
    const expectedNodeMajor = Number(flag('--expected-node-major') ?? '26');
    if (!Number.isInteger(expectedNodeMajor) || expectedNodeMajor < 1) throw new Error('--expected-node-major must be a positive integer');
    const configPath = flag('--config-path');
    const runtimeBasePath = flag('--runtime-base-path');
    const coreLabel = flag('--core-label');
    const consoleLabel = flag('--console-label');
    const terminalReadiness = process.argv.includes('--require-terminal-readiness');
    const result = runProductionServiceDoctor({
      expected: {
        runtimeRoot: requiredFlag('--runtime-root'),
        ...(runtimeBasePath ? { runtimeBasePath } : {}),
        packageId: requiredFlag('--expected-package-id'),
        sourceRevision: requiredFlag('--expected-source-revision'),
        nodeExecutable: flag('--expected-node') ?? '/opt/homebrew/bin/node',
        nodeMajor: expectedNodeMajor,
        stateStorePath: requiredFlag('--state-store'),
        ...(configPath ? { configPath } : {}),
        ...(coreLabel ? { coreLabel } : {}),
        ...(consoleLabel ? { consoleLabel } : {}),
        ...(terminalReadiness ? { terminalReadiness: true } : {}),
      },
      coreDescriptorPath: requiredFlag('--core-descriptor'),
      consoleDescriptorPath: requiredFlag('--console-descriptor'),
      ...(flag('--uid') ? { uid: Number(flag('--uid')) } : {}),
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.outcome !== 'PASS') process.exitCode = 1;
    return;
  }

  if (command === 'sources') {
    const action = process.argv[3];
    const once = process.argv[4] === '--once';
    if (action !== 'poll' || !once) {
      usage();
      process.exitCode = 1;
      return;
    }
    const sourceType = flag('--source-type') ?? GIT_REPOSITORY_REVISION_SOURCE;
    if (sourceType !== GIT_REPOSITORY_REVISION_SOURCE && sourceType !== BRAIN_TASK_LIFECYCLE_SOURCE && sourceType !== INFRASTRUCTURE_HOST_HEALTH_SOURCE) throw new Error(`unsupported source type: ${sourceType}`);
    const sourceId = flag('--source-id') ?? (sourceType === BRAIN_TASK_LIFECYCLE_SOURCE ? BRAIN_TASK_LIFECYCLE_SOURCE : sourceType === INFRASTRUCTURE_HOST_HEALTH_SOURCE ? INFRASTRUCTURE_HOST_HEALTH_SOURCE : requiredFlag('--source-id'));
    const repositoryRef = flag('--repository-ref') ?? (sourceType === GIT_REPOSITORY_REVISION_SOURCE ? requiredFlag('--repository-ref') : 'infrastructure-plane');
    const repositoryRoot = flag('--repository-root');
    if (sourceType === GIT_REPOSITORY_REVISION_SOURCE && !repositoryRoot) throw new Error('missing required --repository-root');
    const numberFlag = (name: string, fallback: number): number => {
      const raw = flag(name);
      if (!raw) return fallback;
      const parsed = Number(raw);
      if (!Number.isInteger(parsed)) throw new Error(`${name} must be an integer`);
      return parsed;
    };
    const config = {
      sourceId,
      sourceType,
      repositoryRef,
      adapterType: sourceType,
      debounceWindowMs: numberFlag('--debounce-ms', 0),
      cooldownWindowMs: numberFlag('--cooldown-ms', 0),
      catchUpLimit: numberFlag('--catch-up-limit', 10),
      enabled: true,
      bootstrapWatermark: null,
    };
    const databasePath = process.env.BRAIN_AGENT_MODE_DATABASE ?? defaultAgentModeDatabasePath();
    const store = new AgentModeSqliteStateStore(databasePath);
    try {
      const configuration = store.upsertEventSource(config);
      const adapter = sourceType === BRAIN_TASK_LIFECYCLE_SOURCE
        ? new InternalLifecycleEventSourceAdapter({ store })
        : sourceType === INFRASTRUCTURE_HOST_HEALTH_SOURCE
          ? new HostHealthEventSourceAdapter()
          : new GitRepositoryEventSourceAdapter({ sourceId, repositoryRef, repositoryRoot: repositoryRoot as string });
      const result = await pollEventSourcesOnce({ store, adapters: [adapter] });
      process.stdout.write(`${JSON.stringify({ kind: 'agent-mode-event-source-poll', configuration, ...result }, null, 2)}\n`);
    } catch (error) {
      console.error(`brain-agent sources poll failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    } finally {
      store.close();
    }
    return;
  }

  if (command === 'heartbeat' || command === 'scheduler') {
    const valid = command === 'heartbeat' ? process.argv[3] === '--once' && process.argv.length === 4 : process.argv[3] === 'tick' && process.argv.length === 4;
    if (!valid) {
      usage();
      process.exitCode = 1;
      return;
    }
    const databasePath = process.env.BRAIN_AGENT_MODE_DATABASE ?? defaultAgentModeDatabasePath();
    if (!existsSync(databasePath)) {
      process.stdout.write(`${JSON.stringify({ kind: 'agent-mode-heartbeat', outcome: 'NO_ACTION', reason: 'state_store_absent', databasePresent: false })}\n`);
      return;
    }
    const store = new AgentModeSqliteStateStore(databasePath);
    try {
      process.stdout.write(`${JSON.stringify({ kind: 'agent-mode-heartbeat', databasePresent: true, ...runAgentModeSchedulerTick({ store }) }, null, 2)}\n`);
    } catch (error) {
      console.error(`brain-agent heartbeat failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    } finally {
      store.close();
    }
    return;
  }

  if (command === 'workcell') {
    const action = process.argv[3];
    if (!action || !['create', 'inspect', 'destroy'].includes(action)) {
      usage();
      process.exitCode = 1;
      return;
    }
    const databasePath = process.env.BRAIN_AGENT_MODE_DATABASE ?? defaultAgentModeDatabasePath();
    const store = existsSync(databasePath) || action === 'create' ? new AgentModeSqliteStateStore(databasePath) : undefined;
    if (!store) {
      console.error(`No durable Agent Mode StateStore at ${databasePath}`);
      process.exitCode = 1;
      return;
    }
    try {
      const manager = new WorkcellManager({ store });
      if (action === 'create') {
        const baseRef = flag('--base-ref');
        const workcell = await manager.create({
          taskId: requiredFlag('--task-id'),
          runId: requiredFlag('--run-id'),
          attemptId: requiredFlag('--attempt-id'),
          repositoryRef: requiredFlag('--repository-ref'),
          repositoryRoot: requiredFlag('--repository-root'),
          workcellsRoot: requiredFlag('--workcells-root'),
          ownerAgent: requiredFlag('--owner-agent'),
          ...(baseRef ? { baseRef } : {}),
        });
        process.stdout.write(`${JSON.stringify(workcell, null, 2)}\n`);
      } else if (action === 'inspect') {
        const inspection = await manager.inspect(requiredFlag('--workcell-id'), requiredFlag('--actor'));
        process.stdout.write(`${JSON.stringify(inspection, null, 2)}\n`);
      } else {
        const workcell = await manager.destroy(requiredFlag('--workcell-id'), requiredFlag('--actor'));
        process.stdout.write(`${JSON.stringify(workcell, null, 2)}\n`);
      }
    } catch (error) {
      console.error(`brain-agent workcell ${action} failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    } finally {
      store.close();
    }
    return;
  }

  if (command === 'run') {
    const modelIndex = process.argv.indexOf('--model');
    const modelArg = modelIndex >= 0 ? (process.argv[modelIndex + 1] ?? '') : 'auto';
    const taskIndex = process.argv.indexOf('--task');
    const taskText = taskIndex >= 0 ? process.argv[taskIndex + 1] : undefined;
    const modelRef = MODEL_REFS[modelArg.toLowerCase()];
    if (!modelRef) {
      console.error('Unknown Brain model. Use auto, minimax-m2.5, glm-5, or opus-4.6; all choices remain policy-gated.');
      process.exitCode = 2;
      return;
    }
    try {
      const harnessRoot = process.env.BRAIN_AGENT_MODE_HARNESS_ROOT;
      const accountRef = process.env.BRAIN_AGENT_MODE_ACCOUNT_REF;
      const routeEvidence = jsonEnv<Readonly<Record<AdmittedModelRef, RouteEvidence>>>('BRAIN_AGENT_MODE_ROUTE_EVIDENCE_JSON');
      const modelAccessEvidence = jsonEnv<ModelAccessEvidence>('BRAIN_AGENT_MODE_ACCESS_EVIDENCE_JSON');
      if (!harnessRoot || !accountRef || !routeEvidence || !modelAccessEvidence) throw new Error('brain-agent run requires BRAIN_AGENT_MODE_HARNESS_ROOT, BRAIN_AGENT_MODE_ACCOUNT_REF, BRAIN_AGENT_MODE_ROUTE_EVIDENCE_JSON, and BRAIN_AGENT_MODE_ACCESS_EVIDENCE_JSON');
      const result = await runLiveAgentModeSlice({
        databasePath: process.env.BRAIN_AGENT_MODE_DATABASE ?? defaultAgentModeDatabasePath(),
        fixtureRoot: path.resolve(new URL('../../fixtures', import.meta.url).pathname),
        harnessRoot,
        accountRef,
        routeEvidence,
        modelAccessEvidence,
        ...(taskText ? { taskText } : {}),
        ...(modelRef !== 'auto' ? { modelRef } : {}),
      });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } catch (error) {
      console.error(`brain-agent run failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    }
    return;
  }

  if (['inspect', 'pause', 'resume', 'cancel', 'kill'].includes(command ?? '')) {
    const runId = process.argv[3];
    if (!runId) {
      usage();
      process.exitCode = 1;
      return;
    }
    if (command === 'inspect' && process.argv.length > 4) {
      usage();
      process.exitCode = 1;
      return;
    }
    if (command !== 'inspect') {
      for (let index = 4; index < process.argv.length; index += 2) {
        const name = process.argv[index];
        if (name !== '--operation-id' && name !== '--reason' || !process.argv[index + 1] || process.argv[index + 1]!.startsWith('--')) {
          usage();
          process.exitCode = 1;
          return;
        }
      }
    }
    const databasePath = process.env.BRAIN_AGENT_MODE_DATABASE ?? defaultAgentModeDatabasePath();
    const store = command === 'inspect'
      ? AgentModeSqliteStateStore.openExisting(databasePath)
      : existsSync(databasePath) ? new AgentModeSqliteStateStore(databasePath) : undefined;
    if (!store) {
      console.error(`No durable Agent Mode StateStore at ${databasePath}`);
      process.exitCode = 1;
      return;
    }
    try {
      const run = store.getRun(runId);
      const attempts = store.listAttempts().filter((attempt) => attempt.runId === runId);
      if (!run) {
        console.error(`Run not found: ${runId}`);
        process.exitCode = 1;
        return;
      }
      if (command === 'pause' || command === 'resume' || command === 'cancel' || command === 'kill') {
        const now = new Date().toISOString();
        const reason = flag('--reason') ?? `brain-agent ${command}`;
        const control = new AgentModeControlService(store);
        const commandWithoutOperationId = {
          schemaVersion: AGENT_MODE_CONTROL_SCHEMA_VERSION,
          action: command,
          runId,
          actor: { source: 'cli', actorId: 'brain-agent' },
          requestedAt: now,
          reason,
        } as const;
        const operationId = flag('--operation-id') ?? deriveAgentModeControlOperationId(commandWithoutOperationId);
        const controlCommand = { ...commandWithoutOperationId, operationId } as const;
        const result = command === 'pause' ? control.pauseRun(controlCommand)
          : command === 'resume' ? control.resumeRun(controlCommand)
            : command === 'cancel' ? control.cancelRun(controlCommand)
              : control.killRun(controlCommand);
        const current = store.getRun(runId);
        const operation = result.outcome === 'completed' ? 'created' : result.outcome === 'already_applied' ? 'duplicate' : result.outcome === 'conflict' ? 'conflict' : result.outcome;
        process.stdout.write(`${JSON.stringify({ action: command, runId, attemptId: attempts[0]?.attemptId, operation, status: current?.status, durable: true, ...(result.receipt?.recoveryCode ? { recovery: result.outcome === 're_admission_required' ? 're-admission_required' : result.receipt.recoveryCode.toLowerCase() } : {}), ...(result.signal ? { runtimePid: current?.runtimePid, signal: { sent: result.signal.sent, reason: result.signal.reasonCode.toLowerCase() } } : {}) }, null, 2)}\n`);
        return;
      }
      const telemetryAttempts = attempts.map((attempt) => {
        const receipt = store.getRuntimeReceiptForAttempt(attempt.attemptId);
        return { attemptId: attempt.attemptId, agentId: attempt.agentId, runtimeRef: attempt.runtimeRef, modelRef: attempt.modelRef, status: attempt.status, telemetry: receipt?.telemetry ?? null };
      });
      const completedTelemetry = telemetryAttempts.map((entry) => entry.telemetry).filter((entry): entry is NonNullable<typeof entry> => entry !== null);
      const totalTokens = completedTelemetry.reduce((sum, entry) => sum + (entry.usage.totalTokens ?? 0), 0);
      const estimatedCost = completedTelemetry.every((entry) => entry.cost.estimatedUsd !== null) ? completedTelemetry.reduce((sum, entry) => sum + (entry.cost.estimatedUsd ?? 0), 0) : null;
      process.stdout.write(`${JSON.stringify({ run, task: store.getTask(run.taskId), attempts, executionTelemetry: { attempts: telemetryAttempts, aggregate: { agentCount: new Set(telemetryAttempts.map((entry) => entry.agentId)).size, totalTokens, estimatedCostUsd: estimatedCost, contextHighWaterMark: null } }, events: store.listRecentEvents(500).filter((event) => event.entityId === runId || attempts.some((attempt) => event.entityId === attempt.attemptId)) }, null, 2)}\n`);
    } finally {
      store.close();
    }
    return;
  }

  if (command === '--model') {
    const model = process.argv[3];
    if (!model || process.argv.length > 4) {
      usage();
      process.exitCode = 1;
      return;
    }
    printModelRequest(model);
    return;
  }

  if (command !== 'capabilities') {
    usage();
    process.exitCode = 1;
    return;
  }

  try {
    const response = await fetch(`${BASE_URL}/api/agent/capabilities`, {
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      throw new Error(`Brain Core returned ${response.status}`);
    }

    const body = (await response.json()) as unknown;
    process.stdout.write(`${JSON.stringify(body, null, 2)}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`brain-agent capabilities failed: ${message}`);
    process.exitCode = 1;
  }
}
