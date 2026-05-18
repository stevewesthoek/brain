import type {
  BrainCoreVideoManualExportPackageItem,
  BrainCoreVideoManualExportPackage,
  BrainCoreVideoManualExportPackageListResponse,
  BrainCoreVideoManualExportPackageDetailResponse,
} from '../types/api.js';

interface ManualExportPackageFixture {
  intakePlanId: string;
  publishingPrepPlanId: string;
  metadataPlanId: string;
  assemblyPlanId: string;
  assetPlanId: string;
  storySlug: string;
  title: string;
}

function generateManualExportPackageItems(): BrainCoreVideoManualExportPackageItem[] {
  return [
    {
      id: 'item-metadata-bundle',
      label: 'Metadata Bundle',
      kind: 'metadata-bundle',
      status: 'planned',
      placeholder: 'Metadata bundle placeholder for validation only.',
      sourceRef: 'metadata-plan',
      blockers: ['Export/write policy not approved', 'File writing disabled'],
      safety: {
        readOnly: true,
        writesFiles: false,
        createsDownload: false,
        writesClipboard: false,
        callsPlatformApi: false,
        schedulesPost: false,
        publishesContent: false,
        writesToMind: false,
      },
    },
    {
      id: 'item-asset-bundle',
      label: 'Asset References',
      kind: 'asset-reference',
      status: 'planned',
      placeholder: 'Artifact placeholder for validation only.',
      sourceRef: 'asset-plan',
      blockers: ['Export/write policy not approved', 'File writing disabled'],
      safety: {
        readOnly: true,
        writesFiles: false,
        createsDownload: false,
        writesClipboard: false,
        callsPlatformApi: false,
        schedulesPost: false,
        publishesContent: false,
        writesToMind: false,
      },
    },
    {
      id: 'item-assembly-bundle',
      label: 'Assembly References',
      kind: 'assembly-reference',
      status: 'planned',
      placeholder: 'Assembly reference placeholder for validation only.',
      sourceRef: 'assembly-plan',
      blockers: ['Export/write policy not approved', 'File writing disabled'],
      safety: {
        readOnly: true,
        writesFiles: false,
        createsDownload: false,
        writesClipboard: false,
        callsPlatformApi: false,
        schedulesPost: false,
        publishesContent: false,
        writesToMind: false,
      },
    },
    {
      id: 'item-publishing-checklist',
      label: 'Publishing Readiness Checklist',
      kind: 'publishing-checklist',
      status: 'planned',
      placeholder: 'Publishing checklist placeholder for validation only.',
      sourceRef: 'publishing-prep',
      blockers: ['Export/write policy not approved'],
      safety: {
        readOnly: true,
        writesFiles: false,
        createsDownload: false,
        writesClipboard: false,
        callsPlatformApi: false,
        schedulesPost: false,
        publishesContent: false,
        writesToMind: false,
      },
    },
    {
      id: 'item-manual-upload-checklist',
      label: 'Manual Upload Checklist',
      kind: 'manual-review',
      status: 'planned',
      placeholder: 'Manual review placeholder for validation only.',
      blockers: ['Export/write policy not approved', 'Operator review process not enabled'],
      safety: {
        readOnly: true,
        writesFiles: false,
        createsDownload: false,
        writesClipboard: false,
        callsPlatformApi: false,
        schedulesPost: false,
        publishesContent: false,
        writesToMind: false,
      },
    },
    {
      id: 'item-platform-upload-notes',
      label: 'Platform Upload Notes',
      kind: 'platform-note',
      status: 'planned',
      placeholder: 'Validation placeholder for validation only.',
      blockers: ['Export/write policy not approved', 'Platform API integration disabled'],
      safety: {
        readOnly: true,
        writesFiles: false,
        createsDownload: false,
        writesClipboard: false,
        callsPlatformApi: false,
        schedulesPost: false,
        publishesContent: false,
        writesToMind: false,
      },
    },
    {
      id: 'item-validation-status',
      label: 'Package Validation Status',
      kind: 'validation-note',
      status: 'planned',
      placeholder: 'Validation placeholder for validation only.',
      blockers: ['Export/write policy not approved'],
      safety: {
        readOnly: true,
        writesFiles: false,
        createsDownload: false,
        writesClipboard: false,
        callsPlatformApi: false,
        schedulesPost: false,
        publishesContent: false,
        writesToMind: false,
      },
    },
  ];
}

const manualExportPackageFixtures: ManualExportPackageFixture[] = [
  {
    intakePlanId: 'intake-052',
    publishingPrepPlanId: 'publishing-prep-story-052-genesis-creation',
    metadataPlanId: 'metadata-plan-story-052-genesis-creation',
    assemblyPlanId: 'assembly-052',
    assetPlanId: 'asset-052',
    storySlug: 'story-052-genesis-creation',
    title: 'Video 052 - Genesis: Creation Story - Export Package',
  },
  {
    intakePlanId: 'intake-053',
    publishingPrepPlanId: 'publishing-prep-story-053-noah-flood',
    metadataPlanId: 'metadata-plan-story-053-noah-flood',
    assemblyPlanId: 'assembly-053',
    assetPlanId: 'asset-053',
    storySlug: 'story-053-noah-flood',
    title: 'Video 053 - Noah and the Flood - Export Package',
  },
  {
    intakePlanId: 'intake-054',
    publishingPrepPlanId: 'publishing-prep-story-054-abraham-covenant',
    metadataPlanId: 'metadata-plan-story-054-abraham-covenant',
    assemblyPlanId: 'assembly-054',
    assetPlanId: 'asset-054',
    storySlug: 'story-054-abraham-covenant',
    title: 'Video 054 - Abraham and the Covenant - Export Package',
  },
  {
    intakePlanId: 'intake-055',
    publishingPrepPlanId: 'publishing-prep-story-055-moses-exodus',
    metadataPlanId: 'metadata-plan-story-055-moses-exodus',
    assemblyPlanId: 'assembly-055',
    assetPlanId: 'asset-055',
    storySlug: 'story-055-moses-exodus',
    title: 'Video 055 - Moses and the Exodus - Export Package',
  },
  {
    intakePlanId: 'intake-056',
    publishingPrepPlanId: 'publishing-prep-story-056-david-psalms',
    metadataPlanId: 'metadata-plan-story-056-david-psalms',
    assemblyPlanId: 'assembly-056',
    assetPlanId: 'asset-056',
    storySlug: 'story-056-david-psalms',
    title: 'Video 056 - David and the Psalms - Export Package',
  },
];

function generateManualExportPackage(fixture: ManualExportPackageFixture): BrainCoreVideoManualExportPackage {
  const items = generateManualExportPackageItems();
  const plannedCount = items.filter(i => i.status === 'planned').length;
  const blockedCount = items.filter(i => i.status === 'blocked').length;
  const missingCount = items.filter(i => i.status === 'missing').length;

  return {
    id: `manual-export-package-${fixture.storySlug}`,
    intakePlanId: fixture.intakePlanId,
    publishingPrepPlanId: fixture.publishingPrepPlanId,
    metadataPlanId: fixture.metadataPlanId,
    assemblyPlanId: fixture.assemblyPlanId,
    assetPlanId: fixture.assetPlanId,
    projectId: 'says-the-bible',
    title: fixture.title,
    generatedAt: new Date().toISOString(),
    status: blockedCount === 0 ? 'preview-ready' : 'blocked',
    items,
    summary: {
      totalItems: items.length,
      plannedCount,
      blockedCount,
      missingCount,
    },
    blockers: [
      'Export/write policy not approved',
      'File writing disabled',
      'Download creation disabled',
      'Clipboard writing disabled',
      'Platform publishing disabled',
    ],
    nextSafeStep: 'Proceed to dual-run evidence collection or render readiness/export policy definition.',
    safety: {
      readOnly: true,
      executesStb: false,
      executesVideo: false,
      writesFiles: false,
      createsDownload: false,
      writesClipboard: false,
      callsPlatformApi: false,
      schedulesPost: false,
      publishesContent: false,
      writesToMind: false,
    },
  };
}

export function readVideoManualExportPackages(): BrainCoreVideoManualExportPackageListResponse {
  const packages = manualExportPackageFixtures.map(generateManualExportPackage);
  const previewReadyCount = packages.filter(p => p.status === 'preview-ready').length;
  const blockedCount = packages.filter(p => p.status === 'blocked').length;
  const totalItems = packages.reduce((sum, p) => sum + p.items.length, 0);

  return {
    id: 'video-orchestrator-manual-export-package',
    generatedAt: new Date().toISOString(),
    version: '1.0',
    packages,
    summary: {
      total: packages.length,
      previewReadyCount,
      blockedCount,
      totalItems,
    },
    safety: {
      readOnly: true,
      executesStb: false,
      executesVideo: false,
      writesFiles: false,
      createsDownload: false,
      writesClipboard: false,
      callsPlatformApi: false,
      schedulesPost: false,
      publishesContent: false,
      writesToMind: false,
    },
  };
}

export function readVideoManualExportPackage(id: string): BrainCoreVideoManualExportPackageDetailResponse | null {
  const fixture = manualExportPackageFixtures.find(f => f.intakePlanId === id);
  if (!fixture) return null;

  const pkg = generateManualExportPackage(fixture);

  return {
    id: pkg.id,
    generatedAt: pkg.generatedAt,
    version: '1.0',
    package: pkg,
    upstream: {
      publishingPrepPlanId: fixture.publishingPrepPlanId,
      metadataPlanId: fixture.metadataPlanId,
      assemblyPlanId: fixture.assemblyPlanId,
      assetPlanId: fixture.assetPlanId,
      intakePlanId: fixture.intakePlanId,
    },
    nextSafeStep: 'Proceed to dual-run evidence collection or render readiness/export policy definition.',
    safety: {
      readOnly: true,
      executesStb: false,
      executesVideo: false,
      writesFiles: false,
      createsDownload: false,
      writesClipboard: false,
      callsPlatformApi: false,
      schedulesPost: false,
      publishesContent: false,
      writesToMind: false,
    },
  };
}
