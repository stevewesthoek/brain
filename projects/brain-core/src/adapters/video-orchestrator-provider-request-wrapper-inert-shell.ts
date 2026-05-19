import type {
  BrainCoreVideoProviderRequestWrapperInertShell,
  BrainCoreVideoProviderRequestWrapperInertShellResponse,
} from '../types/api.js';

const supportedProviderClasses = ['image-generation', 'layout-rendering', 'brand-compliance'] as const;

export class VideoProviderRequestWrapperInertShell {
  readonly className = 'VideoProviderRequestWrapperInertShell' as const;
  readonly supportedProviderClasses = [...supportedProviderClasses] as const;

  describeCapabilities() {
    return {
      providerCalls: false,
      credentialAccess: false,
      networkAccess: false,
      promptGeneration: false,
      imageGeneration: false,
      artifactWrites: false,
      auditPersistence: false,
    } as const;
  }

  validateRequestShape(input: { providerClass?: string }) {
    const providerClassSupported = supportedProviderClasses.includes(input.providerClass as (typeof supportedProviderClasses)[number]);
    return {
      valid: providerClassSupported,
      blocked: !providerClassSupported,
      providerCallBlocked: true,
      executionBlocked: true,
    } as const;
  }

  sendRequest() {
    return { providerCallBlocked: true, executionBlocked: true } as const;
  }
}

export function createVideoProviderRequestWrapperInertShell() {
  return new VideoProviderRequestWrapperInertShell();
}

export function readVideoProviderRequestWrapperInertShellStatus(): BrainCoreVideoProviderRequestWrapperInertShellResponse {
  const shell = createVideoProviderRequestWrapperInertShell();
  return {
    shell: {
      id: 'video-orchestrator-provider-request-wrapper-inert-shell',
      status: 'scaffolded-disabled',
      phase: 'provider-request-wrapper-inert-class-shell',
      implementationApprovedScope: 'wrapper-scaffolding-only',
      className: shell.className,
      supportedProviderClasses: [...shell.supportedProviderClasses],
      methodSurface: ['describeCapabilities', 'validateRequestShape', 'sendRequest'],
      blockedMethodResults: [
        { method: 'describeCapabilities', providerCallBlocked: true, executionBlocked: true },
        { method: 'validateRequestShape', providerCallBlocked: true, executionBlocked: true },
        { method: 'sendRequest', providerCallBlocked: true, executionBlocked: true },
      ],
      summary: {
        shellClassCount: 1,
        supportedProviderClassCount: 3,
        callableProviderMethodCount: 0,
        blockedMethodCount: 3,
        providerCallCount: 0,
        credentialAccessCount: 0,
        networkAccessCount: 0,
      },
      safety: {
        readOnlyStatusEndpoint: true,
        inertShellOnly: true,
        providerCallMethodsImplemented: false,
        providerConfigured: false,
        providerCallsEnabled: false,
        credentialAccessEnabled: false,
        envReadEnabled: false,
        networkAccessEnabled: false,
        promptGenerationEnabled: false,
        imageGenerationEnabled: false,
        artifactPersistenceEnabled: false,
        auditPersistenceEnabled: false,
        filesystemAccessEnabled: false,
        writesFiles: false,
        publishesContent: false,
        writesToMind: false,
        executesVideo: false,
        postRoutesAdded: false,
        brainConsoleMutationControlsEnabled: false,
      },
      blockers: [
        'provider calls remain blocked',
        'credentials remain inaccessible',
        'network access remains blocked',
      ],
      nextSafeStep: 'Await explicit approval before any provider implementation beyond inert scaffolding.',
    },
  };
}

export const readVideoProviderRequestWrapperInertShell = readVideoProviderRequestWrapperInertShellStatus;
