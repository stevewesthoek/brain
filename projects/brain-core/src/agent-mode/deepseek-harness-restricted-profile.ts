/**
 * Brain's admission-side description of the DeepSeek Harness runtime spike.
 *
 * This is intentionally not a Harness configuration file. Harness profiles
 * are upstream application composition, while Brain owns the authority to
 * decide which observed runtime topology may receive an admitted attempt.
 * Keeping this boundary here prevents an upstream profile from becoming a
 * second policy engine.
 */

export const DEEPSEEK_HARNESS_PIN = {
  repository: 'https://github.com/deepseek-ai/deepseek-harness',
  commit: 'c389f96bf3a9b6807cb71ed6bdad5849be0df6d8',
  version: '0.1.3-alpha.2',
} as const;

export const BRAIN_RESTRICTED_PROFILE = {
  name: 'brain-agent-mode-restricted',
  allowedServiceRows: [
    'sdk-app-startup',
    'sdk-jsonrpc-server',
    'llm',
    'session',
    'session-projection',
    'system-prompt',
    'tools',
    'agent',
    'agent-loop',
    'invariants',
    'session-invariant',
    'agent-invariant',
    'scope-invariant',
    'agent-loop-invariant',
    'sessions',
  ],
  deniedServiceRows: [
    'sandbox',
    'sandbox-policy',
    'subprocess',
    'pty',
    'terminal-bash',
    'terminal-pwsh',
    'fs-local',
    'persistent-bash',
    'persistent-pwsh',
    'str-replace-editor',
    'jobs',
    'subagents',
  ],
  allowedToolNames: ['brain_read'],
  deniedEffectKinds: ['capability.write', 'runtime.child', 'runtime.schedule', 'runtime.shell'],
} as const;

export interface HarnessTopologyObservation {
  serviceRows: readonly string[];
  toolNames: readonly string[];
  providerIds: readonly string[];
  processIsolation: 'separate-child' | 'same-process' | 'unknown';
  environmentPolicy: 'explicit-complete-env' | 'inherited-parent-env' | 'unknown';
  profile: string;
}

export interface RestrictedTopologyDecision {
  ok: boolean;
  reasons: readonly string[];
}

/**
 * Check the observed topology before Brain sends an admitted operation.
 * Unknown process or environment policy is refused closed; a runtime must
 * prove its boundary rather than rely on a caller's launch convention.
 */
export function verifyRestrictedTopology(
  observation: HarnessTopologyObservation,
): RestrictedTopologyDecision {
  const reasons: string[] = [];
  const allowedServices = new Set<string>(BRAIN_RESTRICTED_PROFILE.allowedServiceRows);
  const deniedServices = new Set<string>(BRAIN_RESTRICTED_PROFILE.deniedServiceRows);
  const allowedTools = new Set<string>(BRAIN_RESTRICTED_PROFILE.allowedToolNames);

  if (observation.profile !== BRAIN_RESTRICTED_PROFILE.name) {
    reasons.push('runtime profile is not the Brain restricted profile');
  }
  for (const row of observation.serviceRows) {
    if (deniedServices.has(row)) reasons.push(`denied service row is active: ${row}`);
    else if (!allowedServices.has(row)) reasons.push(`service row is not explicitly allowlisted: ${row}`);
  }
  for (const tool of observation.toolNames) {
    if (!allowedTools.has(tool)) reasons.push(`tool is not explicitly allowlisted: ${tool}`);
  }
  if (observation.providerIds.length !== 1) {
    reasons.push('runtime must expose exactly one admitted provider route');
  }
  if (observation.processIsolation !== 'separate-child') {
    reasons.push('runtime is not proven to run in a separate child process');
  }
  if (observation.environmentPolicy !== 'explicit-complete-env') {
    reasons.push('runtime environment is not an explicit complete credential policy');
  }
  return { ok: reasons.length === 0, reasons };
}
