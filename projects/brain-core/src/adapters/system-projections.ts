import type { BrainCoreCapabilitySummary, BrainCoreRepoSummary, BrainCoreStatus } from '../types/api.js';
import { createProjectionEnvelope } from './projection-envelope.js';
import type { ProjectionEnvelope } from '../types/projection.js';

export type ProjectionHealthState = 'healthy' | 'healthy_with_attention' | 'degraded' | 'unavailable' | 'unknown';

export interface SystemHealthProjection {
  state: ProjectionHealthState;
  api: { available: boolean; service: string; version: string; mode: string };
  capabilities: { active: string[]; degraded: string[]; unavailable: string[] };
  validation: { status: 'verified' | 'unknown'; lastEvidence: string | null; reason: string | null };
  attention: string[];
}

export interface TopologyNode {
  id: string;
  kind: 'service' | 'repository' | 'client' | 'authority' | 'contract';
  label: string;
  ownership: 'brain' | 'mind-reference' | 'client-adapter' | 'external-reference';
  status: 'available' | 'unknown' | 'not_instrumented';
  sourceReferences: string[];
}

export interface TopologyProjection {
  nodes: TopologyNode[];
  relationships: Array<{ from: string; to: string; relationship: 'owns' | 'serves' | 'references' | 'consumes' }>;
}

export interface ServicesProjection {
  services: Array<{ id: string; label: string; status: TopologyNode['status']; owner: TopologyNode['ownership']; sourceReferences: string[] }>;
}

export interface ContractsProjection {
  contracts: Array<{ id: string; version: string; owner: 'brain'; status: 'available'; sourceReferences: string[] }>;
}

function sourceRefs(...refs: string[]): string[] {
  return refs;
}

export function readSystemHealthProjection(input: {
  status: BrainCoreStatus;
  capabilities: BrainCoreCapabilitySummary;
  generatedAt: string;
}): ProjectionEnvelope<SystemHealthProjection> {
  const active = [...input.capabilities.readEndpoints];
  const attention = [
    'Last validation evidence is not registered in the runtime projection.',
    'Capability availability is derived from the Brain Core manifest, not live provider probes.',
  ];
  const state: ProjectionHealthState = input.status.ok ? 'healthy_with_attention' : 'unavailable';
  return createProjectionEnvelope({
    projection: 'health',
    authorityOwner: 'brain',
    provenance: {
      sourceReferences: [
        { ref: '/status', kind: 'route' },
        { ref: '/capabilities', kind: 'route' },
        { ref: 'operations/specs/brain-core-projection-envelope-v1.md', kind: 'contract' },
      ],
      adapter: 'brain-core-system-health-projection',
      capturedAt: input.generatedAt,
      sourceRevision: null,
    },
    freshness: input.status.ok ? 'fresh' : 'unavailable',
    confidence: input.status.ok ? 'high' : 'unknown',
    uncertainty: attention,
    privacyClassification: 'public-local',
    generatedAt: input.generatedAt,
    availability: input.status.ok ? 'available' : 'unavailable',
    failure: input.status.ok ? null : { code: 'brain_core_unavailable', message: 'Brain Core status is not healthy.' },
    data: {
      state,
      api: { available: input.status.ok, service: input.status.service, version: input.status.version, mode: input.status.mode },
      capabilities: { active, degraded: [], unavailable: [] },
      validation: {
        status: 'unknown',
        lastEvidence: null,
        reason: 'No runtime validation receipt is registered for this foundation projection.',
      },
      attention,
    },
  });
}

export function readTopologyProjection(input: { repos: BrainCoreRepoSummary[]; generatedAt: string }): ProjectionEnvelope<TopologyProjection> {
  const nodes: TopologyNode[] = [
    { id: 'brain-core', kind: 'service', label: 'Brain Core API', ownership: 'brain', status: 'available', sourceReferences: sourceRefs('/status', '/capabilities') },
    { id: 'brain', kind: 'repository', label: 'Brain repository', ownership: 'brain', status: 'available', sourceReferences: sourceRefs('repository:brain') },
    { id: 'mind-reference', kind: 'authority', label: 'Mind authority reference', ownership: 'mind-reference', status: 'unknown', sourceReferences: sourceRefs('operations/specs/brain-core-projection-envelope-v1.md') },
    { id: 'client-obsidian', kind: 'client', label: 'Obsidian Brain Console', ownership: 'client-adapter', status: 'available', sourceReferences: sourceRefs('operations/specs/brain-console-obsidian-plugin.md') },
    { id: 'client-brain-console', kind: 'client', label: 'Standalone Brain Console', ownership: 'client-adapter', status: 'available', sourceReferences: sourceRefs('projects/brain-console/README.md') },
    { id: 'client-claude', kind: 'client', label: 'Claude client adapter', ownership: 'client-adapter', status: 'not_instrumented', sourceReferences: sourceRefs('client:claude') },
    { id: 'client-codex', kind: 'client', label: 'Codex client adapter', ownership: 'client-adapter', status: 'not_instrumented', sourceReferences: sourceRefs('client:codex') },
    { id: 'client-workbench', kind: 'client', label: 'Workbench client adapter', ownership: 'client-adapter', status: 'not_instrumented', sourceReferences: sourceRefs('client:workbench') },
    ...input.repos.map((repo) => ({
      id: `repository:${repo.alias}`,
      kind: 'repository' as const,
      label: repo.alias,
      ownership: 'external-reference' as const,
      status: repo.exists ? 'available' as const : 'unknown' as const,
      sourceReferences: sourceRefs('/repos'),
    })),
  ];
  const relationships: TopologyProjection['relationships'] = [
    { from: 'brain', to: 'brain-core', relationship: 'owns' },
    { from: 'mind-reference', to: 'brain-core', relationship: 'references' },
    { from: 'brain-core', to: 'client-obsidian', relationship: 'serves' },
    { from: 'brain-core', to: 'client-brain-console', relationship: 'serves' },
    { from: 'brain-core', to: 'client-claude', relationship: 'serves' },
    { from: 'brain-core', to: 'client-codex', relationship: 'serves' },
    { from: 'brain-core', to: 'client-workbench', relationship: 'serves' },
    ...input.repos.map((repo) => ({ from: 'brain-core', to: `repository:${repo.alias}`, relationship: 'references' as const })),
  ];
  return createProjectionEnvelope({
    projection: 'topology',
    authorityOwner: 'brain',
    provenance: {
      sourceReferences: [
        { ref: '/repos', kind: 'route' },
        { ref: 'operations/specs/brain-core-projection-envelope-v1.md', kind: 'contract' },
      ],
      adapter: 'brain-core-system-topology-projection',
      capturedAt: input.generatedAt,
      sourceRevision: null,
    },
    freshness: 'unknown',
    confidence: 'medium',
    uncertainty: ['Client runtime health is not inferred from topology relationships.', 'Mind is represented as a reference authority, not read or copied.'],
    privacyClassification: 'sensitive-reference',
    generatedAt: input.generatedAt,
    availability: 'available',
    data: { nodes, relationships },
  });
}

export function readServicesProjection(input: { generatedAt: string }): ProjectionEnvelope<ServicesProjection> {
  return createProjectionEnvelope({
    projection: 'services',
    authorityOwner: 'brain',
    provenance: {
      sourceReferences: [{ ref: '/status', kind: 'route' }, { ref: '/capabilities', kind: 'route' }],
      adapter: 'brain-core-services-projection',
      capturedAt: input.generatedAt,
      sourceRevision: null,
    },
    freshness: 'unknown',
    confidence: 'medium',
    uncertainty: ['Service inventory is contract/topology metadata, not live provider health.'],
    privacyClassification: 'public-local',
    generatedAt: input.generatedAt,
    availability: 'available',
    data: {
      services: [{ id: 'brain-core', label: 'Brain Core API', status: 'available', owner: 'brain', sourceReferences: sourceRefs('/status') }],
    },
  });
}

export function readContractsProjection(input: { generatedAt: string }): ProjectionEnvelope<ContractsProjection> {
  return createProjectionEnvelope({
    projection: 'contracts',
    authorityOwner: 'brain',
    provenance: {
      sourceReferences: [{ ref: 'operations/specs/brain-core-projection-envelope-v1.md', kind: 'contract' }],
      adapter: 'brain-core-contracts-projection',
      capturedAt: input.generatedAt,
      sourceRevision: null,
    },
    freshness: 'fresh',
    confidence: 'verified',
    privacyClassification: 'public-local',
    generatedAt: input.generatedAt,
    availability: 'available',
    data: { contracts: [{ id: 'brain-core-projection', version: 'v1', owner: 'brain', status: 'available', sourceReferences: sourceRefs('operations/specs/brain-core-projection-envelope-v1.md') }] },
  });
}
