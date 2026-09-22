import { admitBrainRequestedModel, BRAIN_REQUESTED_MODEL_POLICIES, type BrainRequestedModelPolicy } from './model-admission-policy.js';

/** Adapter compatibility view over the Brain-owned logical model policy. */
export const CODEX_ADMITTED_MODELS = BRAIN_REQUESTED_MODEL_POLICIES;

export type AdmittedCodexModel = BrainRequestedModelPolicy;

export function admitCodexModel(value: unknown): AdmittedCodexModel | null {
  return admitBrainRequestedModel(value);
}

export function codexModelArgument(value: AdmittedCodexModel): string | null {
  return value === 'auto' ? null : value;
}
