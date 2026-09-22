import { listAgentCapabilities, type AgentCapabilitySummary } from '../adapters/agent-capabilities.js';
import type { ReflexCandidate } from './system-one-reflex.js';

const MAX_SKILL_CANDIDATES = 8;
const MAX_SKILL_LABEL = 96;
const MAX_SKILL_DESCRIPTION = 240;
const MAX_SKILL_CONTEXT_LINES = 8;

export type JarvisSkillContextCandidate = {
  id: string;
  label: string;
  description: string;
  safetyClass: AgentCapabilitySummary['safetyClass'];
};

function bounded(value: string, max: number): string {
  return value.replace(/\s+/gu, ' ').trim().slice(0, max);
}

function isVisibleSkill(capability: AgentCapabilitySummary): boolean {
  return capability.kind === 'skill' && capability.enabled && /^skill\.[a-z0-9][a-z0-9._-]{0,127}$/u.test(capability.id);
}

export async function listJarvisSkillCandidates(): Promise<readonly JarvisSkillContextCandidate[]> {
  const capabilities = await listAgentCapabilities();
  return capabilities
    .filter(isVisibleSkill)
    .sort((left, right) => left.id.localeCompare(right.id))
    .slice(0, MAX_SKILL_CANDIDATES)
    .map((capability) => ({
      id: capability.id,
      label: bounded(capability.label, MAX_SKILL_LABEL),
      description: bounded(capability.description, MAX_SKILL_DESCRIPTION),
      safetyClass: capability.safetyClass,
    }));
}

export function asReflexSkillCandidates(candidates: readonly JarvisSkillContextCandidate[]): readonly ReflexCandidate[] {
  return candidates.map((candidate) => ({ id: candidate.id, label: candidate.label + ' · ' + candidate.safetyClass }));
}

export function selectJarvisSkillCandidates(candidates: readonly JarvisSkillContextCandidate[], selectedIds: readonly string[] | undefined): readonly JarvisSkillContextCandidate[] {
  if (!selectedIds || selectedIds.length === 0) return candidates.slice(0, MAX_SKILL_CONTEXT_LINES);
  const selected = new Set(selectedIds);
  return candidates.filter((candidate) => selected.has(candidate.id)).slice(0, MAX_SKILL_CONTEXT_LINES);
}

export function buildJarvisSkillContext(candidates: readonly JarvisSkillContextCandidate[]): string {
  if (candidates.length === 0) return '';
  const lines = candidates.slice(0, MAX_SKILL_CONTEXT_LINES).map((candidate) => '- ' + candidate.id + ': ' + candidate.label + '; safety=' + candidate.safetyClass + '; ' + candidate.description);
  return [
    'Authorized Brain skill summaries for this read-only turn. These are descriptive context only; do not execute a skill, grant authority, or widen scope.',
    ...lines,
  ].join('\n');
}
