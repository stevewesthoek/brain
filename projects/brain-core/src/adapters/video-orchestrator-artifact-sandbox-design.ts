import type {
  BrainCoreVideoArtifactSandboxBoundary,
  BrainCoreVideoArtifactSandboxDesign,
  BrainCoreVideoArtifactSandboxDesignResponse,
  BrainCoreVideoArtifactSandboxPolicyItem,
} from '../types/api.js';
import { readVideoApprovalPolicyDesign } from './video-orchestrator-approval-policy-design.js';
import { readVideoRenderExportPolicy } from './video-orchestrator-render-export-policy.js';
import { readVideoManualExportPackages } from './video-orchestrator-manual-export-package.js';

const policyItemSafety: BrainCoreVideoArtifactSandboxPolicyItem['safety'] = {
  readOnly: true,
  createsDirectory: false,
  writesFiles: false,
  deletesFiles: false,
  rendersVideo: false,
  createsDownload: false,
  callsExternalAI: false,
  publishesContent: false,
  writesToMind: false,
};

const boundarySafety: BrainCoreVideoArtifactSandboxBoundary['safety'] = {
  readOnly: true,
  createsDirectory: false,
  writesFiles: false,
  deletesFiles: false,
  rendersVideo: false,
  createsDownload: false,
  publishesContent: false,
  writesToMind: false,
};

function item(input: Omit<BrainCoreVideoArtifactSandboxPolicyItem, 'safety'>): BrainCoreVideoArtifactSandboxPolicyItem {
  return { ...input, safety: policyItemSafety };
}

function boundary(input: Omit<BrainCoreVideoArtifactSandboxBoundary, 'safety'>): BrainCoreVideoArtifactSandboxBoundary {
  return { ...input, safety: boundarySafety };
}

export function readVideoArtifactSandboxDesign(): BrainCoreVideoArtifactSandboxDesignResponse {
  const renderPolicy = readVideoRenderExportPolicy().policy;
  const approvalPolicy = readVideoApprovalPolicyDesign().policy;
  const manualExportPackages = readVideoManualExportPackages();

  const policyItems: BrainCoreVideoArtifactSandboxPolicyItem[] = [
    item({
      id: 'sandbox-allowed-policy-artifacts',
      label: 'Policy and checklist artifacts are allowed as references only',
      category: 'allowed-artifact',
      status: 'defined',
      severity: 'info',
      evidence: [
        'Allowed artifact kinds: metadata summary, checklist summary, evidence reference, manifest placeholder',
        `Manual export package plans available: ${manualExportPackages.summary.total}`,
      ],
      blockers: [],
      nextSafeStep: 'Keep allowed artifacts as structured in-memory API data until file write policy exists.',
    }),
    item({
      id: 'sandbox-blocked-media-artifacts',
      label: 'Rendered media and generated assets remain blocked',
      category: 'blocked-artifact',
      status: 'blocked',
      severity: 'blocking',
      evidence: [
        'Blocked artifact kinds: rendered video, generated audio, generated images, downloadable bundle',
        `Render/export policy canRender=${renderPolicy.canRender} canExport=${renderPolicy.canExport}`,
      ],
      blockers: ['No rendering engine approved', 'No export/write policy approved', 'No artifact output directory approved'],
      nextSafeStep: 'Keep media artifacts blocked until render, export, approval, and sandbox policies are complete.',
    }),
    item({
      id: 'sandbox-output-root-placeholder',
      label: 'Output root is a placeholder only',
      category: 'output-path',
      status: 'missing',
      severity: 'blocking',
      evidence: ['Allowed output root placeholder: [repo-runtime-video-artifacts]', 'No directory is created by this design.'],
      blockers: ['No approved output root exists', 'No path validation implementation exists'],
      nextSafeStep: 'Define path validation implementation before any artifact write route.',
    }),
    item({
      id: 'sandbox-storage-boundary-policy',
      label: 'Storage boundary must be repo-local or runtime-local',
      category: 'storage-boundary',
      status: 'defined',
      severity: 'warning',
      evidence: ['Boundary is designed as repo-local/runtime-local placeholder only.', 'Absolute paths and traversal are forbidden by design.'],
      blockers: ['Boundary is not enforced by code because no write route exists.'],
      nextSafeStep: 'Convert design into validation-only policy before any future write attempt.',
    }),
    item({
      id: 'sandbox-retention-cleanup-missing',
      label: 'Retention and cleanup policy is missing',
      category: 'retention-cleanup',
      status: 'missing',
      severity: 'blocking',
      evidence: ['No artifacts are created, so cleanup is not executable in this phase.'],
      blockers: ['No retention period approved', 'No cleanup workflow designed', 'No rollback cleanup checklist exists'],
      nextSafeStep: 'Define cleanup and rollback checklist as read-only policy artifact.',
    }),
    item({
      id: 'sandbox-validation-required',
      label: 'Sandbox validation must precede any future write',
      category: 'validation',
      status: 'blocked',
      severity: 'blocking',
      evidence: [`Approval policy canCreateApproval=${approvalPolicy.canCreateApproval}`, 'No artifact write action is registered.'],
      blockers: ['Validation runner does not exist', 'No action is registered', 'Approval policy remains blocked'],
      nextSafeStep: 'Implement validation-only dry-run design before controlled execution design.',
    }),
    item({
      id: 'sandbox-safety-no-side-effects',
      label: 'Sandbox design has no side effects',
      category: 'safety',
      status: 'defined',
      severity: 'info',
      evidence: ['createsDirectory=false', 'writesFiles=false', 'deletesFiles=false', 'createsDownload=false'],
      blockers: [],
      nextSafeStep: 'Continue to controlled dry-run design with the same no-side-effect boundary.',
    }),
  ];

  const boundaries: BrainCoreVideoArtifactSandboxBoundary[] = [
    boundary({
      id: 'boundary-runtime-video-artifacts-placeholder',
      label: 'Runtime video artifacts placeholder boundary',
      scope: 'runtime-placeholder',
      status: 'blocked',
      allowedArtifactKinds: ['metadata-summary', 'checklist-summary', 'evidence-reference', 'manifest-placeholder'],
      blockedArtifactKinds: ['rendered-video', 'generated-audio', 'generated-image', 'downloadable-bundle', 'platform-upload-payload'],
      pathPolicy: {
        allowedRootPlaceholder: '[repo-runtime-video-artifacts]',
        requiresRelativePaths: true,
        forbidsTraversal: true,
        forbidsAbsolutePaths: true,
        validatesExtensions: true,
      },
      blockers: ['No runtime artifact directory approved', 'No directory creation allowed'],
    }),
    boundary({
      id: 'boundary-operator-provided-output-placeholder',
      label: 'Operator-provided output boundary placeholder',
      scope: 'operator-provided',
      status: 'blocked',
      allowedArtifactKinds: ['manual-review-note', 'operator-checklist'],
      blockedArtifactKinds: ['raw-shell-command', 'credential-reference', 'platform-api-payload', 'external-upload'],
      pathPolicy: {
        allowedRootPlaceholder: '[operator-approved-output-root]',
        requiresRelativePaths: true,
        forbidsTraversal: true,
        forbidsAbsolutePaths: true,
        validatesExtensions: true,
      },
      blockers: ['Operator output root is not approved', 'No approval payload exists'],
    }),
  ];

  const definedCount = policyItems.filter(policyItem => policyItem.status === 'defined').length;
  const blockedCount = policyItems.filter(policyItem => policyItem.status === 'blocked').length;
  const missingCount = policyItems.filter(policyItem => policyItem.status === 'missing').length;
  const blockingSeverityCount = policyItems.filter(policyItem => policyItem.severity === 'blocking').length;
  const blockers = [...policyItems.flatMap(policyItem => policyItem.blockers), ...boundaries.flatMap(item => item.blockers)]
    .filter((blocker, index, all) => all.indexOf(blocker) === index);

  const sandbox: BrainCoreVideoArtifactSandboxDesign = {
    id: 'video-orchestrator-artifact-sandbox-design',
    generatedAt: new Date().toISOString(),
    status: 'blocked',
    canCreateSandbox: false,
    canWriteFiles: false,
    canCleanup: false,
    executableActionRegistered: false,
    policyItems,
    boundaries,
    summary: {
      totalPolicyItems: policyItems.length,
      definedCount,
      blockedCount,
      missingCount,
      blockingSeverityCount,
      boundaryCount: boundaries.length,
    },
    blockers,
    nextSafeStep: 'Implement controlled dry-run execution design as read-only validation; do not add write routes or executable artifact actions.',
    safety: {
      readOnly: true,
      createsDirectory: false,
      writesFiles: false,
      deletesFiles: false,
      rendersVideo: false,
      createsDownload: false,
      createsApproval: false,
      executableActionRegistered: false,
      publishesContent: false,
      decommissionsStb: false,
      writesToMind: false,
    },
  };

  return { sandbox };
}
