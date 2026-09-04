import path from 'node:path';
import { getBindHost, getPort } from '../security/localhost.js';
import {
  DEPLOYMENT_IDENTITY_CONTRACT,
  type DeploymentBuildMode,
  type DeploymentIdentity,
  type DeploymentIdentityState,
} from '../types/deployment-identity.js';

const DEFAULT_CORE_SERVICE_LABEL = 'com.office.brain-core';
const DEFAULT_CONSOLE_SERVICE_LABEL = 'com.office.brain-console';
const DEFAULT_SCHEDULER_SERVICE_LABEL = 'com.office.nightly-scheduler';
const DEFAULT_CONSOLE_ENDPOINT = 'http://127.0.0.1:4881';

export interface DeploymentIdentityInput {
  metadataAvailable?: boolean;
  canonicalSourcePath?: string | null;
  sourceRevision?: string | null;
  runtimePath?: string | null;
  deploymentRevision?: string | null;
  buildMode?: DeploymentBuildMode;
  buildTimestamp?: string | null;
  brainCoreServiceLabel?: string;
  brainConsoleServiceLabel?: string;
  schedulerServiceLabel?: string;
  brainCoreEndpoint?: string;
  brainConsoleEndpoint?: string;
}

function optionalString(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function buildMode(value: string | undefined): DeploymentBuildMode {
  if (value === 'development' || value === 'production') return value;
  return 'unknown';
}

function identityState(input: {
  metadataAvailable: boolean;
  sourceRevision: string | null;
  deploymentRevision: string | null;
  buildMode: DeploymentBuildMode;
}): DeploymentIdentityState {
  if (!input.metadataAvailable) return 'unavailable';
  if (input.buildMode === 'development' && !input.deploymentRevision) return 'development';
  if (input.sourceRevision && input.deploymentRevision) {
    return input.sourceRevision === input.deploymentRevision ? 'matching' : 'stale';
  }
  return input.buildMode === 'development' ? 'development' : 'unknown';
}

export function createDeploymentIdentity(input: DeploymentIdentityInput = {}): DeploymentIdentity {
  const metadataAvailable = input.metadataAvailable ?? true;
  const canonicalSourcePath = optionalString(input.canonicalSourcePath);
  const sourceRevision = optionalString(input.sourceRevision);
  const runtimePath = optionalString(input.runtimePath);
  const deploymentRevision = optionalString(input.deploymentRevision);
  const resolvedBuildMode = input.buildMode ?? 'unknown';

  return {
    contract: DEPLOYMENT_IDENTITY_CONTRACT,
    version: 1,
    identityState: identityState({ metadataAvailable, sourceRevision, deploymentRevision, buildMode: resolvedBuildMode }),
    metadataAvailable,
    canonicalSource: {
      repository: 'brain',
      path: canonicalSourcePath,
      revision: sourceRevision,
    },
    deployment: {
      runtimePath,
      revision: deploymentRevision,
      buildMode: resolvedBuildMode,
      buildTimestamp: optionalString(input.buildTimestamp),
    },
    services: {
      brainCore: optionalString(input.brainCoreServiceLabel) ?? DEFAULT_CORE_SERVICE_LABEL,
      brainConsole: optionalString(input.brainConsoleServiceLabel) ?? DEFAULT_CONSOLE_SERVICE_LABEL,
      scheduler: optionalString(input.schedulerServiceLabel) ?? DEFAULT_SCHEDULER_SERVICE_LABEL,
    },
    endpoints: {
      brainCore: optionalString(input.brainCoreEndpoint) ?? `http://${getBindHost()}:${getPort()}`,
      brainConsole: optionalString(input.brainConsoleEndpoint) ?? DEFAULT_CONSOLE_ENDPOINT,
    },
    contractVersions: {
      projection: 'brain-core-projection-v1',
      operationalSnapshot: 'operational-snapshot-v1',
      obsidian: 'brain-console-obsidian-widget-contract-v1',
    },
    safety: {
      readOnly: true,
      exposesSecrets: false,
      exposesEnvironmentValues: false,
    },
  };
}

export function readDeploymentIdentity(): DeploymentIdentity {
  const metadataAvailable = process.env.BRAIN_DEPLOYMENT_IDENTITY_AVAILABLE !== 'false';
  const configuredBuildMode = process.env.BRAIN_BUILD_MODE;
  const inferredBuildMode = configuredBuildMode ?? (process.env.NODE_ENV === 'production' ? 'production' : undefined);
  const input: DeploymentIdentityInput = {
    metadataAvailable,
    canonicalSourcePath: process.env.BRAIN_CANONICAL_SOURCE_PATH ? path.resolve(process.env.BRAIN_CANONICAL_SOURCE_PATH) : null,
    sourceRevision: process.env.BRAIN_SOURCE_REVISION ?? process.env.BRAIN_BUILD_SOURCE_REVISION ?? null,
    runtimePath: process.env.BRAIN_RUNTIME_PATH ? path.resolve(process.env.BRAIN_RUNTIME_PATH) : process.cwd(),
    deploymentRevision: process.env.BRAIN_DEPLOYMENT_REVISION ?? null,
    buildMode: buildMode(inferredBuildMode),
    buildTimestamp: process.env.BRAIN_BUILD_TIMESTAMP ?? null,
  };
  if (process.env.BRAIN_CORE_SERVICE_LABEL !== undefined) input.brainCoreServiceLabel = process.env.BRAIN_CORE_SERVICE_LABEL;
  if (process.env.BRAIN_CONSOLE_SERVICE_LABEL !== undefined) input.brainConsoleServiceLabel = process.env.BRAIN_CONSOLE_SERVICE_LABEL;
  if (process.env.BRAIN_SCHEDULER_SERVICE_LABEL !== undefined) input.schedulerServiceLabel = process.env.BRAIN_SCHEDULER_SERVICE_LABEL;
  if (process.env.BRAIN_CORE_ENDPOINT !== undefined) input.brainCoreEndpoint = process.env.BRAIN_CORE_ENDPOINT;
  if (process.env.BRAIN_CONSOLE_ENDPOINT !== undefined) input.brainConsoleEndpoint = process.env.BRAIN_CONSOLE_ENDPOINT;
  return createDeploymentIdentity(input);
}
