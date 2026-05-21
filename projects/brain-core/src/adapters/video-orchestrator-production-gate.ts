import type {
  BrainCoreVideoProductionGateItem,
  BrainCoreVideoProductionGateSection,
  BrainCoreVideoProductionGateChecklist,
  BrainCoreVideoProductionGateResponse,
} from '../types/api.js';

function generatePlanningChainSection(): BrainCoreVideoProductionGateSection {
  const items: BrainCoreVideoProductionGateItem[] = [
    {
      id: 'planning-intake',
      label: 'Intake stage implemented',
      category: 'planning-chain',
      status: 'ready',
      severity: 'info',
      evidence: [
        'GET /video-orchestrator/intake endpoint live',
        '5 test fixtures available (stories 052-056)',
        'All safety flags disabled (readOnly=true, executesStb=false, executesVideo=false)',
      ],
      blockers: [],
      safety: {
        readOnly: true,
        executesStb: false,
        executesVideo: false,
        rendersVideo: false,
        exportsArtifact: false,
        publishesContent: false,
        writesFiles: false,
        writesToMind: false,
      },
    },
    {
      id: 'planning-research',
      label: 'Research stage implemented',
      category: 'planning-chain',
      status: 'ready',
      severity: 'info',
      evidence: [
        'GET /video-orchestrator/research endpoint live',
        'Research briefs available for 5 test stories',
        'Passages, themes, and research questions available',
      ],
      blockers: [],
      safety: {
        readOnly: true,
        executesStb: false,
        executesVideo: false,
        rendersVideo: false,
        exportsArtifact: false,
        publishesContent: false,
        writesFiles: false,
        writesToMind: false,
      },
    },
    {
      id: 'planning-script',
      label: 'Script stage implemented',
      category: 'planning-chain',
      status: 'ready',
      severity: 'info',
      evidence: [
        'GET /video-orchestrator/script endpoint live',
        'Script outlines with sections and timing available',
        'Structural placeholders only (no long narrative prose)',
      ],
      blockers: [],
      safety: {
        readOnly: true,
        executesStb: false,
        executesVideo: false,
        rendersVideo: false,
        exportsArtifact: false,
        publishesContent: false,
        writesFiles: false,
        writesToMind: false,
      },
    },
    {
      id: 'planning-asset-plan',
      label: 'Asset planning stage implemented',
      category: 'planning-chain',
      status: 'ready',
      severity: 'info',
      evidence: [
        'GET /video-orchestrator/asset-plan endpoint live',
        'Asset requirements (thumbnail, title-card, passage-card, scene-visual, platform-derivative)',
        'Structural requirements only (no image generation)',
      ],
      blockers: [],
      safety: {
        readOnly: true,
        executesStb: false,
        executesVideo: false,
        rendersVideo: false,
        exportsArtifact: false,
        publishesContent: false,
        writesFiles: false,
        writesToMind: false,
      },
    },
    {
      id: 'planning-design-plan',
      label: 'Design planning stage implemented',
      category: 'planning-chain',
      status: 'ready',
      severity: 'info',
      evidence: [
        'GET /video-orchestrator/design-plan endpoint live',
        'Design specs and style guides available',
        'Layout and typography guidelines only (no design generation)',
      ],
      blockers: [],
      safety: {
        readOnly: true,
        executesStb: false,
        executesVideo: false,
        rendersVideo: false,
        exportsArtifact: false,
        publishesContent: false,
        writesFiles: false,
        writesToMind: false,
      },
    },
    {
      id: 'planning-voiceover-plan',
      label: 'Voiceover planning stage implemented',
      category: 'planning-chain',
      status: 'ready',
      severity: 'info',
      evidence: [
        'GET /video-orchestrator/voiceover-plan endpoint live',
        'Voiceover specifications and timing available',
        'Speaker notes and tone guidelines only (no synthesis)',
      ],
      blockers: [],
      safety: {
        readOnly: true,
        executesStb: false,
        executesVideo: false,
        rendersVideo: false,
        exportsArtifact: false,
        publishesContent: false,
        writesFiles: false,
        writesToMind: false,
      },
    },
    {
      id: 'planning-visuals-plan',
      label: 'Visuals planning stage implemented',
      category: 'planning-chain',
      status: 'ready',
      severity: 'info',
      evidence: [
        'GET /video-orchestrator/visuals-plan endpoint live',
        'Visual composition requirements available',
        'Scene descriptions and visual timing only (no rendering)',
      ],
      blockers: [],
      safety: {
        readOnly: true,
        executesStb: false,
        executesVideo: false,
        rendersVideo: false,
        exportsArtifact: false,
        publishesContent: false,
        writesFiles: false,
        writesToMind: false,
      },
    },
    {
      id: 'planning-assembly-plan',
      label: 'Assembly planning stage implemented',
      category: 'planning-chain',
      status: 'ready',
      severity: 'info',
      evidence: [
        'GET /video-orchestrator/assembly-plan endpoint live',
        'Assembly sequence and composition timeline available',
        'Asset integration specifications only (no execution)',
      ],
      blockers: [],
      safety: {
        readOnly: true,
        executesStb: false,
        executesVideo: false,
        rendersVideo: false,
        exportsArtifact: false,
        publishesContent: false,
        writesFiles: false,
        writesToMind: false,
      },
    },
    {
      id: 'planning-metadata-plan',
      label: 'Metadata planning stage implemented',
      category: 'planning-chain',
      status: 'ready',
      severity: 'info',
      evidence: [
        'GET /video-orchestrator/metadata-plan endpoint live',
        'Metadata specifications (title, description, tags, SEO) available',
        'Platform-specific metadata requirements only (no generation)',
      ],
      blockers: [],
      safety: {
        readOnly: true,
        executesStb: false,
        executesVideo: false,
        rendersVideo: false,
        exportsArtifact: false,
        publishesContent: false,
        writesFiles: false,
        writesToMind: false,
      },
    },
    {
      id: 'planning-publishing-prep',
      label: 'Publishing prep stage implemented',
      category: 'planning-chain',
      status: 'ready',
      severity: 'info',
      evidence: [
        'GET /video-orchestrator/publishing-prep endpoint live',
        'Publishing checklist and platform pre-checks available',
        'Compliance and compliance-gate specifications only (no execution)',
      ],
      blockers: [],
      safety: {
        readOnly: true,
        executesStb: false,
        executesVideo: false,
        rendersVideo: false,
        exportsArtifact: false,
        publishesContent: false,
        writesFiles: false,
        writesToMind: false,
      },
    },
    {
      id: 'planning-manual-export',
      label: 'Manual export package stage implemented',
      category: 'planning-chain',
      status: 'ready',
      severity: 'info',
      evidence: [
        'GET /video-orchestrator/manual-export-package endpoint live',
        'Export package specifications and manual workflow available',
        'Artifact bundling specifications only (no export)',
      ],
      blockers: [],
      safety: {
        readOnly: true,
        executesStb: false,
        executesVideo: false,
        rendersVideo: false,
        exportsArtifact: false,
        publishesContent: false,
        writesFiles: false,
        writesToMind: false,
      },
    },
  ];

  const ready = items.filter(i => i.status === 'ready').length;
  const blocked = items.filter(i => i.status === 'blocked').length;
  const inProgress = items.filter(i => i.status === 'in-progress').length;

  return {
    id: 'section-planning-chain',
    label: 'Planning Chain (11 Stages)',
    category: 'planning-chain',
    items,
    summary: {
      total: items.length,
      ready,
      blocked,
      inProgress,
    },
  };
}

function generateDualRunEvidenceSection(): BrainCoreVideoProductionGateSection {
  const items: BrainCoreVideoProductionGateItem[] = [
    {
      id: 'dualrun-stb-available',
      label: 'STB pipeline status available',
      category: 'dual-run-evidence',
      status: 'ready',
      severity: 'info',
      evidence: [
        'GET /stb/status endpoint provides latest STB run evidence',
        'STB source of truth: latest run metadata available from runtime',
      ],
      blockers: [],
      safety: {
        readOnly: true,
        executesStb: false,
        executesVideo: false,
        rendersVideo: false,
        exportsArtifact: false,
        publishesContent: false,
        writesFiles: false,
        writesToMind: false,
      },
    },
    {
      id: 'dualrun-video-fixtures',
      label: 'Video planning fixtures available',
      category: 'dual-run-evidence',
      status: 'ready',
      severity: 'info',
      evidence: [
        'Video fixtures 052-056: 5 story references with complete planning data',
        'All 11 planning stages have fixtures for parity analysis',
      ],
      blockers: [],
      safety: {
        readOnly: true,
        executesStb: false,
        executesVideo: false,
        rendersVideo: false,
        exportsArtifact: false,
        publishesContent: false,
        writesFiles: false,
        writesToMind: false,
      },
    },
    {
      id: 'dualrun-first-normalize',
      label: 'First real normalize job completed',
      category: 'dual-run-evidence',
      status: 'ready',
      severity: 'info',
      evidence: [
        'Job 23c87e1b: genesis-noah-30m 4K source normalized to 5 platform crops',
        'Formats: landscape_1920x1080, portrait_1080x1920, square_1080x1080, landscape_1280x720, portrait_720x1280',
        'Duration: ~35 minutes (4K 30-min source on Apple Silicon)',
        'Files confirmed valid with ffprobe',
        'Output dir: /tmp/vo_norm_genesis_noah/',
      ],
      blockers: [],
      safety: {
        readOnly: true,
        executesStb: false,
        executesVideo: false,
        rendersVideo: false,
        exportsArtifact: false,
        publishesContent: false,
        writesFiles: false,
        writesToMind: false,
      },
    },
    {
      id: 'dualrun-first-post-manual',
      label: 'First YouTube post job executed (manual mode)',
      category: 'dual-run-evidence',
      status: 'in-progress',
      severity: 'medium',
      evidence: [
        'Job fbe09ce7: post to YouTube @says-the-bible queued from landscape crop',
        'Job succeeded with adapter_mode=manual (n8n dispatch returned HTTP 403)',
        'Posting instructions written to ~/.local/video-orchestrator/packages/fbe09ce7/posting_instructions.md',
        'Root cause: worker has no Cloudflare Access service token for n8n webhook',
      ],
      blockers: [
        'CF Access service token for video-orchestrator-worker not created yet (Zero Trust → Service Tokens)',
        'YouTube OAuth not authorized for @says-the-bible (no token in keychain)',
        'After token setup: reload worker plist and re-run post job',
      ],
      safety: {
        readOnly: true,
        executesStb: false,
        executesVideo: false,
        rendersVideo: false,
        exportsArtifact: false,
        publishesContent: false,
        writesFiles: false,
        writesToMind: false,
      },
    },
    {
      id: 'dualrun-comparison-pending',
      label: 'Output comparison pending n8n connectivity',
      category: 'dual-run-evidence',
      status: 'blocked',
      severity: 'medium',
      evidence: [
        'Normalize pipeline confirmed working end-to-end',
        'Post pipeline blocked on n8n/CF Access setup only',
        'All blocking items are infrastructure configuration, not code',
      ],
      blockers: [
        'CF Access service token for video-orchestrator-worker (manual: Cloudflare Zero Trust)',
        'YouTube OAuth credentials for @says-the-bible (manual: auth-url + auth-exchange)',
      ],
      safety: {
        readOnly: true,
        executesStb: false,
        executesVideo: false,
        rendersVideo: false,
        exportsArtifact: false,
        publishesContent: false,
        writesFiles: false,
        writesToMind: false,
      },
    },
  ];

  const ready = items.filter(i => i.status === 'ready').length;
  const blocked = items.filter(i => i.status === 'blocked').length;
  const inProgress = items.filter(i => i.status === 'in-progress').length;

  return {
    id: 'section-dual-run-evidence',
    label: 'Dual-Run Evidence & Parity',
    category: 'dual-run-evidence',
    items,
    summary: {
      total: items.length,
      ready,
      blocked,
      inProgress,
    },
    ...(inProgress > 0 || blocked > 0 ? { blockerReason: 'Awaiting CF Access token + YouTube OAuth to complete first end-to-end post' } : {}),
  };
}

function generateRenderingExportSection(): BrainCoreVideoProductionGateSection {
  const items: BrainCoreVideoProductionGateItem[] = [
    {
      id: 'render-engine',
      label: 'Video rendering engine available',
      category: 'rendering-export',
      status: 'blocked',
      severity: 'critical',
      evidence: [],
      blockers: [
        'No video rendering engine implemented',
        'Video orchestrator is planning layer only',
        'No FFmpeg or rendering service integration',
      ],
      safety: {
        readOnly: true,
        executesStb: false,
        executesVideo: false,
        rendersVideo: false,
        exportsArtifact: false,
        publishesContent: false,
        writesFiles: false,
        writesToMind: false,
      },
    },
    {
      id: 'render-artifact',
      label: 'Rendered video artifact available',
      category: 'rendering-export',
      status: 'blocked',
      severity: 'critical',
      evidence: [],
      blockers: [
        'No video rendering means no artifacts',
        'Cannot produce publishable video file',
        'Cannot store rendered output',
      ],
      safety: {
        readOnly: true,
        executesStb: false,
        executesVideo: false,
        rendersVideo: false,
        exportsArtifact: false,
        publishesContent: false,
        writesFiles: false,
        writesToMind: false,
      },
    },
    {
      id: 'export-package',
      label: 'Manual export package available',
      category: 'rendering-export',
      status: 'ready',
      severity: 'info',
      evidence: [
        'GET /video-orchestrator/manual-export-package endpoint live',
        'Manual export specifications and bundling checklist available',
        'No automatic export execution (read-only specifications only)',
      ],
      blockers: [],
      safety: {
        readOnly: true,
        executesStb: false,
        executesVideo: false,
        rendersVideo: false,
        exportsArtifact: false,
        publishesContent: false,
        writesFiles: false,
        writesToMind: false,
      },
    },
  ];

  const ready = items.filter(i => i.status === 'ready').length;
  const blocked = items.filter(i => i.status === 'blocked').length;
  const inProgress = items.filter(i => i.status === 'in-progress').length;

  return {
    id: 'section-rendering-export',
    label: 'Rendering & Export',
    category: 'rendering-export',
    items,
    summary: {
      total: items.length,
      ready,
      blocked,
      inProgress,
    },
    blockerReason: 'Video rendering engine not implemented; export execution disabled',
  };
}

function generatePublishingPlatformSection(): BrainCoreVideoProductionGateSection {
  const items: BrainCoreVideoProductionGateItem[] = [
    {
      id: 'platform-youtube',
      label: 'YouTube publishing enabled',
      category: 'publishing-platform',
      status: 'blocked',
      severity: 'critical',
      evidence: [],
      blockers: [
        'YouTube API integration designed but not wired',
        'Publishing execution disabled (read-only inspection only)',
        'No upload capability',
      ],
      safety: {
        readOnly: true,
        executesStb: false,
        executesVideo: false,
        rendersVideo: false,
        exportsArtifact: false,
        publishesContent: false,
        writesFiles: false,
        writesToMind: false,
      },
    },
    {
      id: 'platform-policies',
      label: 'Platform policies documented',
      category: 'publishing-platform',
      status: 'ready',
      severity: 'info',
      evidence: [
        'GET /post-orchestrator/platform-policies endpoint available',
        'YouTube, Pinterest, Facebook, TikTok, Instagram platform policies documented',
        'Content compliance requirements specified',
      ],
      blockers: [],
      safety: {
        readOnly: true,
        executesStb: false,
        executesVideo: false,
        rendersVideo: false,
        exportsArtifact: false,
        publishesContent: false,
        writesFiles: false,
        writesToMind: false,
      },
    },
    {
      id: 'platform-approval',
      label: 'Platform policy compliance approval required',
      category: 'publishing-platform',
      status: 'blocked',
      severity: 'critical',
      evidence: [],
      blockers: [
        'Platform policy compliance review not performed',
        'Content moderation checklist not completed',
        'Platform-specific requirements not validated',
      ],
      safety: {
        readOnly: true,
        executesStb: false,
        executesVideo: false,
        rendersVideo: false,
        exportsArtifact: false,
        publishesContent: false,
        writesFiles: false,
        writesToMind: false,
      },
    },
  ];

  const ready = items.filter(i => i.status === 'ready').length;
  const blocked = items.filter(i => i.status === 'blocked').length;
  const inProgress = items.filter(i => i.status === 'in-progress').length;

  return {
    id: 'section-publishing-platform',
    label: 'Publishing & Platform Requirements',
    category: 'publishing-platform',
    items,
    summary: {
      total: items.length,
      ready,
      blocked,
      inProgress,
    },
    blockerReason: 'Platform publishing execution disabled; approval workflow not wired',
  };
}

function generateSafetyApprovalSection(): BrainCoreVideoProductionGateSection {
  const items: BrainCoreVideoProductionGateItem[] = [
    {
      id: 'safety-stb-decommission',
      label: 'STB decommission approval required',
      category: 'safety-approval',
      status: 'blocked',
      severity: 'critical',
      evidence: [],
      blockers: [
        'STB remains source of truth',
        'Cannot decommission STB without video parity validation',
        'Video orchestrator not yet production-ready',
      ],
      safety: {
        readOnly: true,
        executesStb: false,
        executesVideo: false,
        rendersVideo: false,
        exportsArtifact: false,
        publishesContent: false,
        writesFiles: false,
        writesToMind: false,
      },
    },
    {
      id: 'safety-production-approval',
      label: 'Production readiness approval required',
      category: 'safety-approval',
      status: 'blocked',
      severity: 'critical',
      evidence: [],
      blockers: [
        'Video rendering not implemented',
        'Dual-run execution not available',
        'Output comparison not available',
        'Platform publishing not enabled',
      ],
      safety: {
        readOnly: true,
        executesStb: false,
        executesVideo: false,
        rendersVideo: false,
        exportsArtifact: false,
        publishesContent: false,
        writesFiles: false,
        writesToMind: false,
      },
    },
    {
      id: 'safety-publishing-disabled',
      label: 'Publishing execution disabled (safety)',
      category: 'safety-approval',
      status: 'ready',
      severity: 'info',
      evidence: [
        'All publishesContent flags: false',
        'Platform integrations read-only',
        'No uploads to production platforms',
      ],
      blockers: [],
      safety: {
        readOnly: true,
        executesStb: false,
        executesVideo: false,
        rendersVideo: false,
        exportsArtifact: false,
        publishesContent: false,
        writesFiles: false,
        writesToMind: false,
      },
    },
  ];

  const ready = items.filter(i => i.status === 'ready').length;
  const blocked = items.filter(i => i.status === 'blocked').length;
  const inProgress = items.filter(i => i.status === 'in-progress').length;

  return {
    id: 'section-safety-approval',
    label: 'Safety & Approval Requirements',
    category: 'safety-approval',
    items,
    summary: {
      total: items.length,
      ready,
      blocked,
      inProgress,
    },
    blockerReason: 'Multiple critical blockers prevent production approval',
  };
}

export function readVideoProductionGate(): BrainCoreVideoProductionGateResponse {
  const sections: BrainCoreVideoProductionGateSection[] = [
    generatePlanningChainSection(),
    generateDualRunEvidenceSection(),
    generateRenderingExportSection(),
    generatePublishingPlatformSection(),
    generateSafetyApprovalSection(),
  ];

  const totalItems = sections.reduce((sum, s) => sum + s.summary.total, 0);
  const readyItems = sections.reduce((sum, s) => sum + s.summary.ready, 0);
  const blockedItems = sections.reduce((sum, s) => sum + s.summary.blocked, 0);
  const inProgressItems = sections.reduce((sum, s) => sum + s.summary.inProgress, 0);

  const readinessPercent = totalItems > 0 ? Math.round((readyItems / totalItems) * 100) : 0;

  const gate: BrainCoreVideoProductionGateChecklist = {
    id: 'video-production-gate',
    generatedAt: new Date().toISOString(),
    status: blockedItems > 0 ? 'blocked' : readinessPercent < 100 ? 'in-progress' : 'ready',
    readinessPercent,
    sections,
    summary: {
      totalItems,
      readyItems,
      blockedItems,
      inProgressItems,
    },
    blockers: [
      'No real dual-run execution implemented',
      'No video rendering/artifact generation',
      'No STB-vs-video output comparison available',
      'Platform publishing execution disabled',
      'STB remains source of truth (cannot decommission)',
    ],
    criticalBlockers: [
      'Video rendering engine not implemented',
      'Dual-run execution not available',
      'Production approval blocked until rendering and dual-run validation complete',
      'Platform policy compliance approval not completed',
      'STB decommission blocked',
    ],
    nextSafeStep: 'Implement controlled dual-run request design or production gate checklist before attempting live dual-run. Video orchestrator remains planning and validation layer only.',
    requiredApprovals: [
      'Video rendering implementation review',
      'Dual-run execution design review',
      'Platform policy compliance approval',
      'Production readiness validation',
      'STB decommission planning',
    ],
    safety: {
      readOnly: true,
      executesStb: false,
      executesVideo: false,
      rendersVideo: false,
      exportsArtifact: false,
      publishesContent: false,
      decommissionsStb: false,
      writesFiles: false,
      writesToMind: false,
    },
  };

  return {
    gate,
  };
}
