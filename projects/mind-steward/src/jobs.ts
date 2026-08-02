import type {
  MindContractDryRunResult,
  MindContractSnapshot,
  MindPathStatus,
  MindRouterJobId,
  MindRouterJobResult,
} from './contracts.js';
import {
  MIND_LEGACY_READ_ONLY_PATHS,
  MIND_LIVE_FILES,
  MIND_REQUIRED_INDEX_FILES,
  MIND_REQUIRED_PATHS,
  MIND_ROUTER_CONTRACT_FILES,
} from './contracts.js';

export const MIND_ROUTER_JOBS: MindRouterJobId[] = [
  'mind-compile-loop',
  'mind-memory-loop',
  'mind-hygiene-loop',
  'mind-drift-error-loop',
];

const ALL_CONTRACT_CHECK_PATHS = [
  ...MIND_REQUIRED_PATHS,
  ...MIND_ROUTER_CONTRACT_FILES,
  ...MIND_LIVE_FILES,
  ...MIND_REQUIRED_INDEX_FILES,
  ...MIND_LEGACY_READ_ONLY_PATHS,
] as const;

export function createDryRunResult(jobId: MindRouterJobId): MindRouterJobResult {
  return {
    jobId,
    mode: 'dry-run',
    ok: true,
    checkedPaths: [...ALL_CONTRACT_CHECK_PATHS],
    plannedWrites: [],
    warnings: [
      'Initial scaffold only; no live scheduler integration has been enabled.',
      'Legacy numbered folders are read-only until validation and archive phase.',
    ],
    errors: [],
  };
}

export function createAllDryRunResults(): MindRouterJobResult[] {
  return MIND_ROUTER_JOBS.map(createDryRunResult);
}

export function createMindContractDryRunResult(
  snapshot: MindContractSnapshot,
): MindContractDryRunResult {
  const pathMap = createPathStatusMap(snapshot.paths);
  const missingRequiredPaths = findMissing(MIND_REQUIRED_PATHS, pathMap);
  const missingRouterContractFiles = findMissing(MIND_ROUTER_CONTRACT_FILES, pathMap);
  const missingLiveFiles = findMissing(MIND_LIVE_FILES, pathMap);
  const missingIndexFiles = findMissing(MIND_REQUIRED_INDEX_FILES, pathMap);
  const presentLegacyReadOnlyPaths = findPresent(MIND_LEGACY_READ_ONLY_PATHS, pathMap);
  const saveToMindTarget = snapshot.saveToMindTarget ?? 'unknown';
  const liveDeploymentVerified = snapshot.liveDeploymentVerified === true;
  const failureBufferStatus = snapshot.failureBufferStatus ?? 'unknown';
  const failureBufferReadyForArchivePhase = failureBufferStatus === 'real-error-verified';
  const errors = [
    ...toMissingErrors('required Mind OS path', missingRequiredPaths),
    ...toMissingErrors('router contract file', missingRouterContractFiles),
    ...toMissingErrors('live cockpit file', missingLiveFiles),
    ...toMissingErrors('index/readme file', missingIndexFiles),
  ];
  const warnings = createContractWarnings({
    presentLegacyReadOnlyPaths,
    saveToMindTarget,
    liveDeploymentVerified,
    failureBufferStatus,
    failureBufferReadyForArchivePhase,
  });

  return {
    jobId: 'mind-drift-error-loop',
    mode: 'dry-run',
    ok: errors.length === 0,
    checkedPaths: [...ALL_CONTRACT_CHECK_PATHS],
    plannedWrites: [],
    warnings,
    errors,
    missingRequiredPaths,
    missingRouterContractFiles,
    missingLiveFiles,
    missingIndexFiles,
    presentLegacyReadOnlyPaths,
    saveToMindTarget,
    liveDeploymentVerified,
    failureBufferStatus,
    failureBufferReadyForArchivePhase,
  };
}

function createPathStatusMap(paths: MindPathStatus[]): Map<string, MindPathStatus> {
  return new Map(paths.map((pathStatus) => [normalizeMindPath(pathStatus.path), pathStatus]));
}

function findMissing(paths: readonly string[], pathMap: Map<string, MindPathStatus>): string[] {
  return paths.filter((path) => pathMap.get(normalizeMindPath(path))?.exists !== true);
}

function findPresent(paths: readonly string[], pathMap: Map<string, MindPathStatus>): string[] {
  return paths.filter((path) => pathMap.get(normalizeMindPath(path))?.exists === true);
}

function normalizeMindPath(path: string): string {
  return path.replace(/^\.\//, '');
}

function toMissingErrors(label: string, paths: string[]): string[] {
  return paths.map((path) => `Missing ${label}: ${path}`);
}

function createContractWarnings(input: {
  presentLegacyReadOnlyPaths: string[];
  saveToMindTarget: MindContractSnapshot['saveToMindTarget'];
  liveDeploymentVerified: boolean;
  failureBufferStatus: MindContractSnapshot['failureBufferStatus'];
  failureBufferReadyForArchivePhase: boolean;
}): string[] {
  const warnings = [
    'Dry-run only; do not move, delete, archive, or rewrite legacy numbered folders.',
  ];

  if (input.presentLegacyReadOnlyPaths.length > 0) {
    warnings.push(
      `Legacy read-only folders still present: ${input.presentLegacyReadOnlyPaths.join(', ')}`,
    );
  }

  if (input.saveToMindTarget !== 'inbox-new') {
    warnings.push(
      `Save-to-Mind target is not verified as canonical inbox/new/; current target: ${input.saveToMindTarget ?? 'unknown'}`,
    );
  }

  if (!input.liveDeploymentVerified) {
    warnings.push('Live n8n deployment has not been verified; repo JSON changes are not proof of production behavior.');
  }

  if (input.failureBufferStatus !== 'real-error-verified') {
    warnings.push(
      `Failure buffer is not real-error verified; current status: ${input.failureBufferStatus ?? 'unknown'}`,
    );
  }

  if (!input.failureBufferReadyForArchivePhase) {
    warnings.push('Archive phase remains blocked until failure-buffer behavior is verified against a real recoverable error.');
  }

  return warnings;
}
