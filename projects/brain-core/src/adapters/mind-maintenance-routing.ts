import { selectAiModel, type AiModelSelectionResult } from './ai-model-selector-service.js';
import { defaultDependencies, type MindMaintenancePilotCliDependencies } from '../bin/mind-maintenance-pilot.js';
import {
  type MindMaintenancePilotRunnerInput,
  type MindMaintenancePilotRunnerResult,
} from '../mind-maintenance-pilot/pilot-runner.js';

export const MIND_MAINTENANCE_SCHEDULER_JOB = {
  id: 'mind-maintenance-report-only',
  name: 'Mind maintenance report-only review',
  owner: 'mind-steward',
  runtime: 'brain-core',
  mutationRequired: false,
  mode: 'report-only',
} as const;

type ResolvablePilotInput = Omit<
  MindMaintenancePilotRunnerInput,
  'mindRoot' | 'sourceCommit' | 'generatedAt' | 'listChangedPaths'
> & {
  mindRoot?: string;
  sourceCommit?: string;
  generatedAt?: string;
  listChangedPaths?: () => Promise<readonly string[]>;
};

export interface MindMaintenanceRoutingInput extends ResolvablePilotInput {
  ambiguousSemanticChecks: number;
}

export interface MindMaintenanceRoutingResult {
  route: {
    runtime: 'brain-core';
    schedulerJob: typeof MIND_MAINTENANCE_SCHEDULER_JOB;
    owner: 'mind-steward';
    modelSelector: {
      consulted: boolean;
      selection: AiModelSelectionResult | null;
      policy: 'only-for-ambiguous-semantic-checks';
    };
  };
  result: MindMaintenancePilotRunnerResult;
}

export interface MindMaintenanceRoutingDependencies {
  selectModel: typeof selectAiModel;
  pilot: Pick<
    MindMaintenancePilotCliDependencies,
    'now' | 'resolveMindRoot' | 'resolveSourceCommit' | 'listChangedPaths' | 'runPilot'
  >;
}

export function createMindMaintenanceJobRouter(
  dependencies: MindMaintenanceRoutingDependencies,
): (input: MindMaintenanceRoutingInput) => Promise<MindMaintenanceRoutingResult> {
  return async (input) => {
    if (!Number.isInteger(input.ambiguousSemanticChecks) || input.ambiguousSemanticChecks < 0) {
      throw new Error('Mind maintenance routing requires a non-negative ambiguousSemanticChecks count.');
    }

    const selection = input.ambiguousSemanticChecks > 0
      ? await dependencies.selectModel({
          task: 'mind-maintenance-semantic-comparison',
          capability: 'bounded-semantic-classification',
          complexity: 'medium',
          sensitivity: 'high',
          maxLatencyMs: 3000,
        })
      : null;

    const {
      ambiguousSemanticChecks: _ambiguousSemanticChecks,
      mindRoot: requestedMindRoot,
      sourceCommit: requestedSourceCommit,
      generatedAt: requestedGeneratedAt,
      listChangedPaths: requestedListChangedPaths,
      ...pilotInput
    } = input;

    const mindRoot = dependencies.pilot.resolveMindRoot(requestedMindRoot ?? '');
    const sourceCommit = requestedSourceCommit
      ?? await dependencies.pilot.resolveSourceCommit(mindRoot);
    const generatedAt = requestedGeneratedAt
      ?? dependencies.pilot.now().toISOString();
    const listChangedPaths = requestedListChangedPaths
      ?? (() => dependencies.pilot.listChangedPaths(mindRoot));

    const result = await dependencies.pilot.runPilot({
      ...pilotInput,
      mindRoot,
      sourceCommit,
      generatedAt,
      listChangedPaths,
      generatedBy: 'brain-core/scheduler/mind-steward',
    });

    return {
      route: {
        runtime: 'brain-core',
        schedulerJob: MIND_MAINTENANCE_SCHEDULER_JOB,
        owner: 'mind-steward',
        modelSelector: {
          consulted: selection !== null,
          selection,
          policy: 'only-for-ambiguous-semantic-checks',
        },
      },
      result,
    };
  };
}

export const routeMindMaintenanceJob = createMindMaintenanceJobRouter({
  selectModel: selectAiModel,
  pilot: defaultDependencies,
});
