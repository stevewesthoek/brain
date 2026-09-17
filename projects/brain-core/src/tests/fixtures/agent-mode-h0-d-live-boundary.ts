import { existsSync, readFileSync } from 'node:fs';

export const H0_D_SCHEMA_VERSION = 'agent-mode.h0-d-live-boundary.v1' as const;
export const H0_D_HARNESS_ROOT = '/Users/Office/.local/brain/runtimes/deepseek-harness/c389f96bf3a9b6807cb71ed6bdad5849be0df6d8';
export const H0_D_HARNESS_PIN = {
  repository: 'https://github.com/deepseek-ai/deepseek-harness',
  commit: 'c389f96bf3a9b6807cb71ed6bdad5849be0df6d8',
  version: '0.1.3-alpha.2',
} as const;

export type H0DLiveStatus = 'live_pass' | 'blocked' | 'not_run';
export type H0DClassification = 'SUPPORTED_LOCAL' | 'EXTERNAL_SENSITIVE' | 'UNSUPPORTED';

export type H0DGateReadiness = {
  faultClass: 'provider_outage' | 'host_loss_reconnect' | 'sandbox_denial' | 'tool_denial';
  classification: H0DClassification;
  liveStatus: H0DLiveStatus;
  blocker: string | null;
};

export const H0_D_GATE_READINESS: readonly H0DGateReadiness[] = [
  {
    faultClass: 'provider_outage',
    classification: 'EXTERNAL_SENSITIVE',
    liveStatus: 'blocked',
    blocker: 'Requires separately authorized disposable provider account/profile/resource; no provider request is permitted in H0-D.',
  },
  {
    faultClass: 'host_loss_reconnect',
    classification: 'EXTERNAL_SENSITIVE',
    liveStatus: 'blocked',
    blocker: 'Requires separately authorized disposable remote BrainNode and real reconnect boundary; no host, SSH, or Tailscale contact is permitted in H0-D.',
  },
  {
    faultClass: 'sandbox_denial',
    classification: 'UNSUPPORTED',
    liveStatus: 'not_run',
    blocker: 'Current safe local Harness adapter exposes only the fixture bridge; the production sandbox boundary is not safely injectable without widening authority or adding an unapproved live topology.',
  },
  {
    faultClass: 'tool_denial',
    classification: 'UNSUPPORTED',
    liveStatus: 'not_run',
    blocker: 'Current safe local Harness adapter exposes no tools; a genuine denied-tool child path would require an authorized live tool topology and is not faked by the capability fixture.',
  },
] as const;

export const H0_D_AUTHORIZATION_PACKETS = {
  providerOutage: {
    preferredMechanism: 'dedicated-disposable-provider-account-profile',
    target: 'one harmless Bedrock probe through the existing ModelGateway transport boundary',
    bounds: { maxRequests: 1, maxCostUsd: 0, maxTokens: 64, maxElapsedMs: 120_000, maxRetries: 0 },
    requiredControls: ['explicit deny/failure injection at the disposable boundary', 'no fallback route', 'durable failure and recovery evidence', 'rollback and resource teardown'],
    productionScope: 'no production account, credential, provider, route, or repository may be touched',
  },
  hostLossReconnect: {
    preferredMechanism: 'dedicated-disposable-remote-brain-node',
    target: 'one harmless repo.read operation against a disposable test checkout',
    bounds: { maxCommands: 2, maxElapsedMs: 180_000, maxReconnects: 1, maxRepositoryWrites: 0 },
    requiredControls: ['real enrollment and identity verification', 'controlled disconnect/reconnect', 'no personal MacBook target', 'node teardown and credential revocation'],
    productionScope: 'no Office host, production node, SSH/Tailscale identity, repository, or credential may be touched',
  },
} as const;

export function inspectPinnedHarnessAvailability(): 'SUPPORTED_LOCAL' | 'MISSING' | 'PIN_MISMATCH' {
  const requiredFiles = [
    'package.json',
    'packages/sdk/client/package.json',
    'packages/sdk/client/lib/index.js',
    'packages/llm/llm/lib/index.js',
  ];
  if (!existsSync(H0_D_HARNESS_ROOT) || requiredFiles.some((file) => !existsSync(`${H0_D_HARNESS_ROOT}/${file}`))) return 'MISSING';
  try {
    const root = JSON.parse(readFileSync(`${H0_D_HARNESS_ROOT}/package.json`, 'utf8')) as { version?: unknown };
    const client = JSON.parse(readFileSync(`${H0_D_HARNESS_ROOT}/packages/sdk/client/package.json`, 'utf8')) as { version?: unknown };
    return root.version === H0_D_HARNESS_PIN.version && client.version === H0_D_HARNESS_PIN.version ? 'SUPPORTED_LOCAL' : 'PIN_MISMATCH';
  } catch {
    return 'PIN_MISMATCH';
  }
}
