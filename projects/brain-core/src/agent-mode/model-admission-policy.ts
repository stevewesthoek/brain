/** Brain-owned logical model policy. Provider adapters translate only after admission. */
export const BRAIN_REQUESTED_MODEL_POLICIES = Object.freeze([
  'auto',
  'gpt-5.6-luna',
  'gpt-5.6-sol',
  'gpt-5.6-terra',
  'gpt-5.5',
] as const);

export type BrainRequestedModelPolicy = typeof BRAIN_REQUESTED_MODEL_POLICIES[number];

export function admitBrainRequestedModel(value: unknown): BrainRequestedModelPolicy | null {
  return typeof value === 'string' && (BRAIN_REQUESTED_MODEL_POLICIES as readonly string[]).includes(value)
    ? value as BrainRequestedModelPolicy
    : null;
}
