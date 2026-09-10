import { readFile } from 'node:fs/promises';
import type { BrainNodeCapability, BrainNodeDescriptor, BrainNodeResourceBinding } from './brain-node.js';
import { BRAIN_NODE_PROTOCOL_VERSION, BRAIN_NODE_READ_CAPABILITY } from './brain-node.js';

export type SshNodeEnrollment = {
  resourceRef: string;
  nodeId: string;
  transportRef: string;
  hostAlias: string;
  authRef: string;
};

export type NodeLocalConfig = {
  nodeId: string;
  resourceRef: string;
  protocolVersion: string;
  runnerVersion: string;
  authRef: string;
  platform: { os: string; arch: string };
  capabilities: readonly BrainNodeCapability[];
  binding: BrainNodeResourceBinding;
  dedupPath?: string;
};

export const SSH_NODE_RUNNER_ARGV = Object.freeze(['~/.local/brain/node/brain-node-runner'] as const);

export function validateSshNodeEnrollment(enrollment: SshNodeEnrollment, knownResourceRefs: ReadonlySet<string>): void {
  if (!knownResourceRefs.has(enrollment.resourceRef)) throw new Error(`unknown infrastructure resource: ${enrollment.resourceRef}`);
  for (const [field, value] of Object.entries(enrollment)) {
    if (typeof value !== 'string' || value.trim().length === 0 || /[\u0000-\u001f\u007f]/.test(value)) throw new Error(`invalid node enrollment ${field}`);
  }
}

export function descriptorFromNodeLocalConfig(config: NodeLocalConfig, knownResourceRefs: ReadonlySet<string>, checkedAt = new Date().toISOString()): BrainNodeDescriptor {
  if (!knownResourceRefs.has(config.resourceRef)) throw new Error(`unknown infrastructure resource: ${config.resourceRef}`);
  if (config.protocolVersion !== BRAIN_NODE_PROTOCOL_VERSION) throw new Error('unsupported node protocol');
  if (!config.nodeId || !config.runnerVersion || !config.authRef || !config.platform.os || !config.platform.arch) throw new Error('incomplete node-local configuration');
  if (config.capabilities.length !== 1 || config.capabilities[0]?.capabilityId !== BRAIN_NODE_READ_CAPABILITY || !Number.isSafeInteger(config.capabilities[0]?.maxBytes) || config.capabilities[0]!.maxBytes <= 0) {
    throw new Error('node must advertise exactly repo.read');
  }
  if (!config.binding.resourceId || !config.binding.rootPath || config.binding.resourceId !== config.resourceRef) throw new Error('node-local resource binding mismatch');
  return {
    nodeId: config.nodeId,
    resourceRef: config.resourceRef,
    protocolVersion: BRAIN_NODE_PROTOCOL_VERSION,
    runnerVersion: config.runnerVersion,
    platform: config.platform,
    capabilities: config.capabilities,
    bindings: [config.binding],
    health: { state: 'available', checkedAt },
  };
}

export async function readNodeLocalConfig(configPath: string, knownResourceRefs: ReadonlySet<string>): Promise<BrainNodeDescriptor> {
  const config = JSON.parse(await readFile(configPath, 'utf8')) as NodeLocalConfig;
  return descriptorFromNodeLocalConfig(config, knownResourceRefs);
}
