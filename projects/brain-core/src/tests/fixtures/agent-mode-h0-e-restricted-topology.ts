export const H0_E_SCHEMA_VERSION = 'agent-mode.h0-e-restricted-topology.v1' as const;

export const H0_E_DENIAL_DECISIONS = {
  toolDenial: {
    status: 'not_run',
    classification: 'UNSUPPORTED',
    selectedTopology: 'none',
    reasonCode: 'RESTRICTED_COMPOSITION_HAS_NO_TOOL_SURFACE',
  },
  sandboxDenial: {
    status: 'not_run',
    classification: 'UNSUPPORTED',
    selectedTopology: 'none',
    reasonCode: 'RESTRICTED_COMPOSITION_HAS_NO_SANDBOX_SURFACE',
  },
} as const;

export const H0_E_PRODUCTION_INVARIANTS = {
  productionAuthorityWidened: false,
  productionDenialInjection: false,
  productionToolRegistration: false,
  productionSandboxRegistration: false,
  providerAccessAdded: false,
  networkAccessAdded: false,
} as const;
