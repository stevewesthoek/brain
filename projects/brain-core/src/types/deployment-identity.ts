export const DEPLOYMENT_IDENTITY_CONTRACT = 'brain-core-deployment-identity-v1' as const;

export type DeploymentBuildMode = 'development' | 'production' | 'unknown';
export type DeploymentIdentityState = 'matching' | 'stale' | 'unknown' | 'development' | 'unavailable';
export type DeploymentServiceState = 'running' | 'stopped' | 'unknown';
export type DeploymentLaunchMechanism = 'launchagent' | 'manual' | 'container' | 'process-manager' | 'unknown';

export interface DeploymentIdentity {
  contract: typeof DEPLOYMENT_IDENTITY_CONTRACT;
  version: 1;
  identityState: DeploymentIdentityState;
  metadataAvailable: boolean;
  canonicalSource: {
    repository: 'brain';
    path: string | null;
    revision: string | null;
  };
  deployment: {
    runtimePath: string | null;
    revision: string | null;
    buildMode: DeploymentBuildMode;
    buildTimestamp: string | null;
  };
  services: {
    brainCore: string;
    brainConsole: string;
    scheduler: string;
  };
  endpoints: {
    brainCore: string;
    brainConsole: string;
  };
  runtime: {
    serviceState: DeploymentServiceState;
    launchMechanism: DeploymentLaunchMechanism;
  };
  contractVersions: {
    projection: string;
    operationalSnapshot: string;
    obsidian: string;
  };
  safety: {
    readOnly: true;
    exposesSecrets: false;
    exposesEnvironmentValues: false;
  };
}
