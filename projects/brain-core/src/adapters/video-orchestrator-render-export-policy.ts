import type {
  BrainCoreVideoRenderExportPolicyItem,
  BrainCoreVideoRenderExportPolicySection,
  BrainCoreVideoRenderExportPolicy,
  BrainCoreVideoRenderExportPolicyResponse,
} from '../types/api.js';
import { readVideoProductionGate } from './video-orchestrator-production-gate.js';
import { readControlledDualRunRequestDesign } from './stb-video-controlled-dual-run-request.js';
import { readVideoAssemblyPlans } from './video-orchestrator-assembly-plan.js';
import { readVideoManualExportPackages } from './video-orchestrator-manual-export-package.js';

const disabledSafety: BrainCoreVideoRenderExportPolicyItem['safety'] = {
  readOnly: true,
  rendersVideo: false,
  callsFfmpeg: false,
  writesFiles: false,
  createsDownload: false,
  createsApproval: false,
  publishesContent: false,
  writesToMind: false,
};

function summarizeSection(
  id: string,
  title: string,
  items: BrainCoreVideoRenderExportPolicyItem[],
): BrainCoreVideoRenderExportPolicySection {
  const satisfied = items.filter(item => item.status === 'satisfied').length;
  const blocked = items.filter(item => item.status === 'blocked').length;
  const missing = items.filter(item => item.status === 'missing').length;

  return {
    id,
    title,
    status: blocked > 0 ? 'blocked' : missing > 0 ? 'missing' : satisfied === items.length ? 'passed' : 'partial',
    items,
    summary: {
      total: items.length,
      satisfied,
      blocked,
      missing,
    },
  };
}

export function readVideoRenderExportPolicy(): BrainCoreVideoRenderExportPolicyResponse {
  const productionGate = readVideoProductionGate().gate;
  const controlledDualRunRequest = readControlledDualRunRequestDesign().design;
  const assemblyPlans = readVideoAssemblyPlans();
  const manualExportPackages = readVideoManualExportPackages();

  const sections: BrainCoreVideoRenderExportPolicySection[] = [
    summarizeSection('rendering-engine', 'Rendering Engine', [
      {
        id: 'rendering-disabled',
        label: 'Rendering is disabled',
        category: 'rendering',
        status: 'blocked',
        severity: 'blocking',
        evidence: [
          `Production gate status: ${productionGate.status}`,
          'Production gate critical blocker: video rendering engine not implemented',
        ],
        blockers: [
          'No rendering engine is implemented',
          'No render runner is registered',
          'No video generation path exists',
        ],
        nextSafeStep: 'Design approval policy and artifact sandbox before any render execution design.',
        safety: disabledSafety,
      },
      {
        id: 'render-runner-not-registered',
        label: 'ffmpeg/export runner is not registered',
        category: 'rendering',
        status: 'blocked',
        severity: 'blocking',
        evidence: [
          'Assembly plans are planning-only',
          'Timeline items mark callsFfmpeg=false and generatesFiles=false',
        ],
        blockers: [
          'No ffmpeg runner is available through Brain Core',
          'No export runner is available through Brain Core',
          'No executable action is registered for rendering or export',
        ],
        nextSafeStep: 'Keep runner registration out of scope until approval and sandbox policies exist.',
        safety: disabledSafety,
      },
      {
        id: 'assembly-plan-planning-only',
        label: 'Assembly plan exists but is planning-only',
        category: 'artifact',
        status: 'satisfied',
        severity: 'info',
        evidence: [
          `Assembly plan count: ${assemblyPlans.summary.total}`,
          `Assembly timeline items: ${assemblyPlans.summary.totalTimelineItems}`,
          'Assembly plan safety: rendersVideo=false, callsFfmpeg=false, generatesFiles=false',
        ],
        blockers: [],
        nextSafeStep: 'Use assembly plans only as input evidence for future policy review.',
        safety: disabledSafety,
      },
    ]),
    summarizeSection('export-package', 'Export Package', [
      {
        id: 'manual-export-package-planning-only',
        label: 'Manual export package plan exists',
        category: 'export',
        status: 'satisfied',
        severity: 'info',
        evidence: [
          `Manual export package count: ${manualExportPackages.summary.total}`,
          `Manual export package item count: ${manualExportPackages.summary.totalItems}`,
          'Manual export package safety: writesFiles=false, createsDownload=false, writesClipboard=false',
        ],
        blockers: [],
        nextSafeStep: 'Use package plans only as non-executable policy evidence.',
        safety: disabledSafety,
      },
      {
        id: 'file-writing-disabled',
        label: 'File writing is disabled',
        category: 'export',
        status: 'blocked',
        severity: 'blocking',
        evidence: [
          'Manual export package blockers include file writing disabled',
          'No output path is approved',
        ],
        blockers: [
          'Export/write policy not approved',
          'No artifact sandbox exists',
          'No output path policy exists',
        ],
        nextSafeStep: 'Design artifact sandbox and output path policy placeholders.',
        safety: disabledSafety,
      },
      {
        id: 'downloads-and-clipboard-disabled',
        label: 'Downloads and clipboard writes are disabled',
        category: 'export',
        status: 'blocked',
        severity: 'blocking',
        evidence: [
          'Manual export package safety: createsDownload=false',
          'Manual export package safety: writesClipboard=false',
        ],
        blockers: [
          'Download creation disabled',
          'Clipboard writing disabled',
          'No operator-approved export package creation exists',
        ],
        nextSafeStep: 'Keep downloads and clipboard writes disabled until explicit approval policy exists.',
        safety: disabledSafety,
      },
    ]),
    summarizeSection('artifact-sandbox', 'Artifact Sandbox', [
      {
        id: 'artifact-requirements-placeholder',
        label: 'Artifact requirements are placeholders only',
        category: 'artifact',
        status: 'missing',
        severity: 'warning',
        evidence: [
          'Allowed artifact types placeholder: metadata summaries, references, checklist text',
          'Blocked artifact types placeholder: rendered video, generated media, downloadable bundles',
        ],
        blockers: [
          'Allowed artifact type policy not approved',
          'Blocked artifact type policy not reviewed',
        ],
        nextSafeStep: 'Create artifact sandbox design with allowed and blocked artifact type lists.',
        safety: disabledSafety,
      },
      {
        id: 'sandbox-policy-missing',
        label: 'Sandbox and isolation policy is missing',
        category: 'sandbox',
        status: 'missing',
        severity: 'blocking',
        evidence: [],
        blockers: [
          'No artifact sandbox policy exists',
          'No render isolation boundary exists',
          'No storage lifecycle boundary exists',
        ],
        nextSafeStep: 'Design artifact sandbox policy before dry-run or render execution design.',
        safety: disabledSafety,
      },
      {
        id: 'output-path-policy-missing',
        label: 'Approved output path policy is missing',
        category: 'output-path',
        status: 'missing',
        severity: 'blocking',
        evidence: [
          'No generated artifacts exist',
          'No output path is approved',
        ],
        blockers: [
          'No allowed output directory placeholder approved',
          'No path validation policy exists',
          'No cleanup boundary exists',
        ],
        nextSafeStep: 'Define output path policy placeholders without creating directories or files.',
        safety: disabledSafety,
      },
      {
        id: 'cleanup-policy-missing',
        label: 'Cleanup policy is missing',
        category: 'cleanup',
        status: 'missing',
        severity: 'blocking',
        evidence: [],
        blockers: [
          'No cleanup policy exists',
          'No retention policy exists',
          'No generated artifact deletion procedure exists',
        ],
        nextSafeStep: 'Design cleanup and retention requirements for future sandbox artifacts.',
        safety: disabledSafety,
      },
    ]),
    summarizeSection('approval-rollback', 'Approval / Rollback', [
      {
        id: 'approval-policy-missing',
        label: 'Approval policy is missing',
        category: 'approval',
        status: 'missing',
        severity: 'blocking',
        evidence: [
          `Controlled dual-run request status: ${controlledDualRunRequest.status}`,
          'Controlled dual-run request canRequestApproval=false',
          'No approval record is created by this policy',
        ],
        blockers: [
          'No approval policy module exists',
          'No render/export approval gates are defined',
          'No executable approval exists',
        ],
        nextSafeStep: 'Implement approval policy design as the next safe module.',
        safety: disabledSafety,
      },
      {
        id: 'rollback-plan-missing',
        label: 'Rollback plan is missing',
        category: 'rollback',
        status: 'missing',
        severity: 'blocking',
        evidence: [
          'Controlled dual-run request blockers include rollback plan not defined',
        ],
        blockers: [
          'No rollback procedure specified',
          'No failure recovery path exists',
          'No generated artifact cleanup rollback exists',
        ],
        nextSafeStep: 'Define rollback and cleanup requirements before execution design.',
        safety: disabledSafety,
      },
      {
        id: 'controlled-dual-run-design-only',
        label: 'Controlled dual-run request remains design-only',
        category: 'approval',
        status: 'blocked',
        severity: 'blocking',
        evidence: [
          'Controlled dual-run request canExecute=false',
          'Controlled dual-run request executableActionRegistered=false',
        ],
        blockers: controlledDualRunRequest.blockers,
        nextSafeStep: controlledDualRunRequest.nextSafeStep,
        safety: disabledSafety,
      },
    ]),
    summarizeSection('safety', 'Safety', [
      {
        id: 'stb-source-of-truth-protected',
        label: 'STB remains source of truth',
        category: 'safety',
        status: 'satisfied',
        severity: 'info',
        evidence: [
          'Production gate safety: executesStb=false and decommissionsStb=false',
          'Controlled dual-run request safety: executesStb=false and decommissionsStb=false',
        ],
        blockers: [],
        nextSafeStep: 'Continue using STB as operational source of truth until explicit cutover approval.',
        safety: disabledSafety,
      },
      {
        id: 'production-gate-blocked',
        label: 'Production gate remains blocked/not-ready',
        category: 'safety',
        status: 'blocked',
        severity: 'blocking',
        evidence: [
          `Production gate status: ${productionGate.status}`,
          `Production gate blocked items: ${productionGate.summary.blockedItems}`,
        ],
        blockers: productionGate.criticalBlockers,
        nextSafeStep: productionGate.nextSafeStep,
        safety: disabledSafety,
      },
      {
        id: 'publishing-and-decommission-disabled',
        label: 'Publishing and decommission remain disabled',
        category: 'safety',
        status: 'blocked',
        severity: 'blocking',
        evidence: [
          'Production gate safety: publishesContent=false',
          'Production gate safety: decommissionsStb=false',
          'No platform API calls are added by this policy',
        ],
        blockers: [
          'Publishing execution disabled',
          'STB decommission blocked',
          'Production readiness not approved',
        ],
        nextSafeStep: 'Keep publishing and decommission blocked until production gate is ready and approved.',
        safety: disabledSafety,
      },
    ]),
  ];

  const totalItems = sections.reduce((sum, section) => sum + section.summary.total, 0);
  const satisfiedCount = sections.reduce((sum, section) => sum + section.summary.satisfied, 0);
  const blockedCount = sections.reduce((sum, section) => sum + section.summary.blocked, 0);
  const missingCount = sections.reduce((sum, section) => sum + section.summary.missing, 0);
  const blockingSeverityCount = sections.reduce(
    (sum, section) => sum + section.items.filter(item => item.severity === 'blocking').length,
    0,
  );

  const blockers = sections
    .flatMap(section => section.items)
    .flatMap(item => item.blockers)
    .filter((blocker, index, all) => all.indexOf(blocker) === index);

  const policy: BrainCoreVideoRenderExportPolicy = {
    id: 'video-orchestrator-render-export-policy',
    generatedAt: new Date().toISOString(),
    status: 'policy-only',
    canRender: false,
    canExport: false,
    executableActionRegistered: false,
    sections,
    summary: {
      totalItems,
      satisfiedCount,
      blockedCount,
      missingCount,
      blockingSeverityCount,
    },
    blockers,
    nextSafeStep: 'Implement approval policy design or artifact sandbox design before any render/export execution design.',
    safety: {
      readOnly: true,
      rendersVideo: false,
      callsFfmpeg: false,
      writesFiles: false,
      createsDownload: false,
      createsApproval: false,
      publishesContent: false,
      writesToMind: false,
    },
  };

  return { policy };
}
