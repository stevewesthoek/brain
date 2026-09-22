import { JARVIS_AUTO_MODEL_CANDIDATES } from './jarvis-runtime-routing.js';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  normalizeSystemOneReflexMode,
  runSystemOnePostflight,
  runSystemOnePreflight,
  createJevBridgeDecisionClient,
  type ReflexCandidate,
  type ReflexDecisionClient,
  type ReflexPostflightResult,
  type SystemOneReflexInput,
  type SystemOneReflexMode,
  type TurnDecisionEnvelopeV1,
} from './system-one-reflex.js';

export type JarvisReflexTurn = {
  text: string;
  requestedModel?: string;
  sessionSummary?: string;
  candidateSkills?: readonly ReflexCandidate[];
  candidateContexts?: readonly ReflexCandidate[];
  actualRouteModelRef?: string;
};

export type JarvisSystemOneReflexOptions = {
  mode?: SystemOneReflexMode;
  client?: ReflexDecisionClient;
  runtimeFacts?: { available: readonly string[]; policyVersion: string };
};

export type JarvisSystemOneReflexHook = Pick<JarvisSystemOneReflexService, 'preflight' | 'postflight'> & { readonly mode?: SystemOneReflexMode };

/**
 * Optional Jarvis foreground seam. It adds bounded annotations to an original
 * turn; it never selects an unadmitted runtime, changes permissions, or
 * replaces the original text.
 */
export class JarvisSystemOneReflexService {
  readonly mode: SystemOneReflexMode;
  private readonly client: ReflexDecisionClient | undefined;
  private readonly runtimeFacts: { available: readonly string[]; policyVersion: string };

  constructor(options: JarvisSystemOneReflexOptions = {}) {
    this.mode = options.mode ?? normalizeSystemOneReflexMode(process.env.BRAIN_JEV_REFLEX_MODE);
    this.client = options.client;
    this.runtimeFacts = options.runtimeFacts ?? { available: [], policyVersion: 'jarvis-reflex-policy-v1' };
  }

  preflight(turn: JarvisReflexTurn): Promise<TurnDecisionEnvelopeV1> {
    const available = new Set(this.runtimeFacts.available);
    const candidateModels = JARVIS_AUTO_MODEL_CANDIDATES.filter((modelRef) => available.has(modelRef));
    const input: SystemOneReflexInput = {
      userRequest: turn.text,
      ...(turn.requestedModel ? { requestedModel: turn.requestedModel } : {}),
      ...(turn.sessionSummary ? { sessionSummary: turn.sessionSummary } : {}),
      candidateModels: candidateModels.map((id) => ({ id })),
      candidateSkills: turn.candidateSkills ?? [],
      candidateContexts: turn.candidateContexts ?? [],
      runtimeFacts: this.runtimeFacts,
      ...(turn.actualRouteModelRef ? { actualRouteModelRef: turn.actualRouteModelRef } : {}),
      mode: this.mode,
    };
    return runSystemOnePreflight(input, this.client);
  }

  postflight(input: { originalRequestHash: string; resultFacts: Readonly<Record<string, unknown>> }): Promise<ReflexPostflightResult> {
    return runSystemOnePostflight({ ...input, mode: this.mode }, this.client);
  }
}

/**
 * Resolve the optional candidate-only bridge without making reflexes part of
 * the default runtime. The caller must explicitly set BRAIN_JEV_REFLEX_MODE
 * to SHADOW or ACTIVE_PILOT; a missing bridge is a safe no-op.
 */
export function createConfiguredJarvisSystemOneReflexService(options: {
  bridgePath?: string;
  runtimeFacts?: { available: readonly string[]; policyVersion: string };
} = {}): JarvisSystemOneReflexService | undefined {
  const mode = normalizeSystemOneReflexMode(process.env.BRAIN_JEV_REFLEX_MODE);
  if (mode === 'OFF') return undefined;
  const bridgePath = options.bridgePath
    ?? process.env.BRAIN_JEV_BRIDGE_PATH
    ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../tools/jev/brain-jev.mjs');
  if (!existsSync(bridgePath)) return undefined;
  return new JarvisSystemOneReflexService({
    mode,
    runtimeFacts: options.runtimeFacts ?? { available: [], policyVersion: 'jarvis-reflex-policy-v1' },
    client: createJevBridgeDecisionClient({ bridgePath }),
  });
}
