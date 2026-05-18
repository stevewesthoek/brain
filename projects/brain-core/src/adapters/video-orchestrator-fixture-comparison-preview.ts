import type {
  BrainCoreVideoFixtureComparisonPreview,
  BrainCoreVideoFixtureComparisonPreviewItem,
  BrainCoreVideoFixtureComparisonPreviewResponse,
} from '../types/api.js';
import { readVideoComparisonSchemaDesign } from './video-orchestrator-comparison-schema-design.js';

const safety: BrainCoreVideoFixtureComparisonPreviewItem['safety'] = {
  readOnly: true,
  comparesRealOutputs: false,
  readsGeneratedArtifacts: false,
  executesStb: false,
  executesVideo: false,
  writesEvidence: false,
  createsApproval: false,
  publishesContent: false,
  writesToMind: false,
};

function item(input: Omit<BrainCoreVideoFixtureComparisonPreviewItem, 'safety'>): BrainCoreVideoFixtureComparisonPreviewItem {
  return { ...input, safety };
}

export function readVideoFixtureComparisonPreview(): BrainCoreVideoFixtureComparisonPreviewResponse {
  const schema = readVideoComparisonSchemaDesign().schema;

  const items: BrainCoreVideoFixtureComparisonPreviewItem[] = schema.fields.map(field => {
    const blocked = field.status === 'blocked';
    const manual = field.comparisonMode === 'manual-review' || field.comparisonMode === 'semantic';

    return item({
      id: `fixture-preview-${field.id}`,
      schemaFieldId: field.id,
      label: field.label,
      status: blocked ? 'blocked' : 'preview-available',
      fixtureSource: blocked ? 'none' : field.category === 'safety' ? 'stb-evidence-summary' : 'planning-fixture',
      comparisonMode: field.comparisonMode,
      previewResult: blocked ? 'blocked' : manual ? 'requires-manual-review' : 'matches-fixture',
      evidence: [
        `Schema field status: ${field.status}`,
        `Schema comparison mode: ${field.comparisonMode}`,
        'Preview uses fixtures and summaries only; it does not read generated artifacts.',
      ],
      blockers: blocked ? field.blockers : [],
    });
  });

  const previewAvailableCount = items.filter(entry => entry.status === 'preview-available').length;
  const blockedCount = items.filter(entry => entry.status === 'blocked').length;
  const manualReviewCount = items.filter(entry => entry.previewResult === 'requires-manual-review').length;
  const blockers = items.flatMap(entry => entry.blockers).filter((blocker, index, all) => all.indexOf(blocker) === index);

  const preview: BrainCoreVideoFixtureComparisonPreview = {
    id: 'video-orchestrator-fixture-comparison-preview',
    generatedAt: new Date().toISOString(),
    status: blockedCount > 0 ? 'blocked' : 'preview-only',
    canCompareRealOutputs: false,
    canReadGeneratedArtifacts: false,
    canWriteEvidence: false,
    executableActionRegistered: false,
    items,
    summary: {
      totalItems: items.length,
      previewAvailableCount,
      blockedCount,
      manualReviewCount,
    },
    blockers,
    nextSafeStep: 'Design production cutover gate and keep fixture preview separate from real output comparison.',
    safety: {
      readOnly: true,
      comparesRealOutputs: false,
      readsGeneratedArtifacts: false,
      executesStb: false,
      executesVideo: false,
      writesEvidence: false,
      createsApproval: false,
      executableActionRegistered: false,
      publishesContent: false,
      decommissionsStb: false,
      writesToMind: false,
    },
  };

  return { preview };
}
