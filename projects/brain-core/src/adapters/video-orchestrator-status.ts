export interface BrainCoreVideoOrchestratorStatus {
  id: 'video-orchestrator-status';
  orchestratorId: 'video-orchestrator';
  pipelineId: 'video-upload-pipeline';
  status: 'operational' | 'partial' | 'planned' | 'blocked' | 'unknown';
  health: 'ok' | 'warning' | 'error' | 'unknown';
  moduleProgress: {
    total: number;
    implemented: number;
    partial: number;
    planned: number;
    blocked: number;
    percent: number;
  };
  modules: Array<{
    id: string;
    name: string;
    status: 'implemented' | 'partial' | 'planned' | 'blocked' | 'unknown';
    summary: string;
  }>;
  supportedProjects: string[];
  supportedPlatforms: string[];
  queueCount?: number;
  lastRunAt?: string;
  summary: string;
  limitations: string[];
  actions: {
    canPreview: boolean;
    canRequestRun: boolean;
    requiresApproval: boolean;
  };
}

export function getVideoOrchestratorStatus(): BrainCoreVideoOrchestratorStatus {
  const modules: BrainCoreVideoOrchestratorStatus['modules'] = [
    {
      id: 'intake-stage',
      name: 'Intake & Research',
      status: 'partial',
      summary: 'Bible research + topic intake. ProBot design phase complete; code not started.',
    },
    {
      id: 'script-generation',
      name: 'Script Generation',
      status: 'partial',
      summary: 'Content outline + spoken-word script. Design drafted; implementation pending.',
    },
    {
      id: 'asset-generation',
      name: 'Asset Generation',
      status: 'partial',
      summary: 'Visual assets + backgrounds. Design drafted; no live generation yet.',
    },
    {
      id: 'design-orchestrator',
      name: 'Thumbnail Design',
      status: 'planned',
      summary: 'Integrated design system for thumbnails. Design orchestrator not yet built.',
    },
    {
      id: 'video-assembly',
      name: 'Video Assembly',
      status: 'partial',
      summary: 'Compose video from assets. Design phase; no rendering yet.',
    },
    {
      id: 'metadata-enrichment',
      name: 'Metadata Enrichment',
      status: 'planned',
      summary: 'Title, description, tags, SEO. Designed; not implemented.',
    },
    {
      id: 'platform-publish-youtube',
      name: 'YouTube Publishing',
      status: 'partial',
      summary: 'Upload, schedule, captions. API integration designed; no live uploads.',
    },
    {
      id: 'platform-publish-pinterest',
      name: 'Pinterest Publishing',
      status: 'partial',
      summary: 'Pin creation + board management. API integration designed; no live posts.',
    },
    {
      id: 'platform-publish-facebook',
      name: 'Facebook Publishing',
      status: 'partial',
      summary: 'Post creation + scheduling. API integration designed; no live posts.',
    },
    {
      id: 'approval-gate',
      name: 'Approval Gate',
      status: 'planned',
      summary: 'Human review before publishing. Brain Console approval model designed; not wired.',
    },
    {
      id: 'archive-logging',
      name: 'Archive & Logging',
      status: 'planned',
      summary: 'Audit trail + asset archival. Designed; not persisting.',
    },
  ];

  const implemented = modules.filter(m => m.status === 'implemented').length;
  const partial = modules.filter(m => m.status === 'partial').length;
  const planned = modules.filter(m => m.status === 'planned').length;
  const blocked = modules.filter(m => m.status === 'blocked').length;
  const total = modules.length;
  const percent = Math.round(((implemented * 100) + (partial * 50)) / total);

  return {
    id: 'video-orchestrator-status',
    orchestratorId: 'video-orchestrator',
    pipelineId: 'video-upload-pipeline',
    status: 'partial',
    health: 'warning',
    moduleProgress: {
      total,
      implemented,
      partial,
      planned,
      blocked,
      percent,
    },
    modules,
    supportedProjects: ['says-the-bible', 'video-content-production'],
    supportedPlatforms: ['youtube', 'pinterest', 'facebook', 'tiktok', 'instagram', 'bluesky'],
    summary: `Video orchestrator ${percent}% complete. ${partial} modules designed; 0 modules live. ${blocked} module(s) blocked. Migration from STB planned for Stage 3.`,
    limitations: [
      'Design phase only (no live execution yet)',
      'No module can run independently (design orchestrator blocks thumbnail module)',
      'No live queue or task tracking (not running)',
      'No runtime metrics or performance data available',
      'Cannot compare STB vs video output (cannot run in parallel for testing)',
      'Cannot publish to platforms (read-only inspection only)',
      'Thumbnail design module blocked: design orchestrator not yet built',
    ],
    actions: {
      canPreview: false,
      canRequestRun: false,
      requiresApproval: false,
    },
  };
}
