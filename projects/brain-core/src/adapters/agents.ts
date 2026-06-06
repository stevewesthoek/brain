export interface BrainCoreAgentSummary {
  id: string;
  name: string;
  role: 'orchestrator' | 'executor' | 'researcher' | 'maintainer' | 'reviewer' | 'dashboard' | 'unknown';
  status: 'available' | 'planned' | 'external' | 'blocked' | 'unknown';
  health: 'ok' | 'warning' | 'error' | 'unknown';
  owner: 'brain-core' | 'mind-steward' | 'external-tool' | 'planned';
  description: string;
  relatedOrchestratorId?: string;
  skills: string[];
  actions: {
    canRun: boolean;
    canRequestRun: boolean;
    requiresApproval: boolean;
  };
}

const AGENTS: BrainCoreAgentSummary[] = [
  {
    id: 'mind-steward-agent',
    name: 'Mind Steward Agent',
    role: 'orchestrator',
    status: 'available',
    health: 'ok',
    owner: 'brain-core',
    description: 'Routes AI model selection for cost optimization and capability matching',
    relatedOrchestratorId: 'mind-steward',
    skills: ['claude-routing', 'codex-routing', 'gemini-routing', 'cost-tracking', 'dry-run-execution'],
    actions: {
      canRun: false,
      canRequestRun: true,
      requiresApproval: true,
    },
  },
  {
    id: 'brain-console-dashboard-agent',
    name: 'Brain Console Dashboard',
    role: 'dashboard',
    status: 'available',
    health: 'ok',
    owner: 'brain-core',
    description: 'Unified dashboard view of orchestrators, pipelines, projects, platforms',
    relatedOrchestratorId: 'brain-console',
    skills: ['registry-read', 'status-aggregation', 'timeline-render', 'obsidian-plugin'],
    actions: {
      canRun: false,
      canRequestRun: false,
      requiresApproval: false,
    },
  },
  {
    id: 'stb-pipeline-agent',
    name: 'Says the Bible Pipeline Agent',
    role: 'executor',
    status: 'external',
    health: 'warning',
    owner: 'external-tool',
    description: 'Daily Bible content generation and publication',
    relatedOrchestratorId: 'stb-pipeline',
    skills: ['research-input', 'script-generation', 'asset-generation', 'platform-publish', 'scheduler-integration'],
    actions: {
      canRun: false,
      canRequestRun: false,
      requiresApproval: false,
    },
  },
  {
    id: 'video-orchestrator-agent',
    name: 'Video Orchestrator Agent',
    role: 'executor',
    status: 'planned',
    health: 'unknown',
    owner: 'planned',
    description: 'Unified multi-platform video production and publishing (future)',
    relatedOrchestratorId: 'video-orchestrator',
    skills: ['script-gen', 'asset-gen', 'video-render', 'metadata-enrichment', 'youtube', 'pinterest', 'facebook'],
    actions: {
      canRun: false,
      canRequestRun: false,
      requiresApproval: false,
    },
  },
  {
    id: 'research-agent',
    name: 'Research Agent',
    role: 'researcher',
    status: 'available',
    health: 'ok',
    owner: 'brain-core',
    description: 'Web research and information gathering',
    relatedOrchestratorId: 'research-orchestrator',
    skills: ['web-search', 'firecrawl', 'data-aggregation', 'fact-checking'],
    actions: {
      canRun: false,
      canRequestRun: true,
      requiresApproval: false,
    },
  },
  {
    id: 'bible-research-agent',
    name: 'Bible Research Agent',
    role: 'researcher',
    status: 'available',
    health: 'ok',
    owner: 'brain-core',
    description: 'Scriptural content analysis and retrieval',
    relatedOrchestratorId: 'bible-research',
    skills: ['scripture-lookup', 'context-retrieval', 'cross-reference', 'language-analysis'],
    actions: {
      canRun: false,
      canRequestRun: true,
      requiresApproval: false,
    },
  },
  {
    id: 'code-agent',
    name: 'Code Review & Refactoring Agent',
    role: 'reviewer',
    status: 'available',
    health: 'ok',
    owner: 'brain-core',
    description: 'Code analysis, review, and refactoring',
    relatedOrchestratorId: 'code-orchestrator',
    skills: ['static-analysis', 'code-review', 'refactoring', 'test-generation'],
    actions: {
      canRun: false,
      canRequestRun: true,
      requiresApproval: false,
    },
  },
  {
    id: 'design-agent',
    name: 'Design System & UI Agent',
    role: 'executor',
    status: 'available',
    health: 'ok',
    owner: 'brain-core',
    description: 'Design system generation and UI component creation',
    relatedOrchestratorId: 'design-orchestrator',
    skills: ['ui-generation', 'component-library', 'design-tokens', 'motion-design'],
    actions: {
      canRun: false,
      canRequestRun: true,
      requiresApproval: false,
    },
  },
  {
    id: 'claude-code-executor',
    name: 'Claude Code (Local AI Executor)',
    role: 'executor',
    status: 'external',
    health: 'ok',
    owner: 'external-tool',
    description: 'Claude 3 local CLI executor for coding tasks',
    skills: ['code-generation', 'refactoring', 'testing', 'documentation', 'debugging'],
    actions: {
      canRun: true,
      canRequestRun: false,
      requiresApproval: false,
    },
  },
  {
    id: 'codex-executor',
    name: 'Codex CLI (Secondary AI Executor)',
    role: 'executor',
    status: 'external',
    health: 'ok',
    owner: 'external-tool',
    description: 'Codex CLI for code review and dual analysis',
    skills: ['code-review', 'adversarial-testing', 'performance-analysis'],
    actions: {
      canRun: true,
      canRequestRun: false,
      requiresApproval: false,
    },
  },
];

export function listAgents(): BrainCoreAgentSummary[] {
  return AGENTS;
}

export function getAgent(id: string): BrainCoreAgentSummary | undefined {
  return AGENTS.find(a => a.id === id);
}
