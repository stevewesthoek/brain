export type AgentCapabilityKind = 'skill' | 'cli' | 'ai_surface' | 'service' | 'workflow';
export type AgentCapabilitySafetyClass =
  | 'read_only'
  | 'local_write'
  | 'repo_write'
  | 'external_state'
  | 'credential_sensitive'
  | 'destructive'
  | 'financial';

export interface AgentCapabilitySummary {
  id: string;
  kind: AgentCapabilityKind;
  label: string;
  source: string;
  description: string;
  safetyClass: AgentCapabilitySafetyClass;
  requiresApprovalFor: string[];
  preferredAiTaskTypes: string[];
  verification: string[];
  enabled: boolean;
  priority?: number;
}

const AGENT_CAPABILITIES: AgentCapabilitySummary[] = [
  {
    id: 'skill.code',
    kind: 'skill',
    label: 'Code Orchestrator',
    source: 'ai/skills/custom/code/SKILL.md',
    description: 'Routes coding work through map, plan, implement, review, and ship workflows.',
    safetyClass: 'repo_write',
    requiresApprovalFor: ['file_write', 'commit', 'push', 'deploy'],
    preferredAiTaskTypes: ['code_generation', 'code_review', 'refactoring'],
    verification: ['npm run typecheck', 'npm test', 'git diff --check'],
    enabled: true,
  },
  {
    id: 'skill.design',
    kind: 'skill',
    label: 'Design Orchestrator',
    source: 'ai/skills/custom/design/SKILL.md',
    description: 'Routes design, layout, and UI work through the shared design workflow.',
    safetyClass: 'repo_write',
    requiresApprovalFor: ['file_write', 'commit', 'push'],
    preferredAiTaskTypes: ['ui_design', 'visual_direction', 'component_spec'],
    verification: ['visual review', 'git diff --check'],
    enabled: true,
  },
  {
    id: 'skill.research',
    kind: 'skill',
    label: 'Research Orchestrator',
    source: 'ai/skills/custom/research/SKILL.md',
    description: 'Routes evidence gathering, source verification, and synthesis through the research workflow.',
    safetyClass: 'read_only',
    requiresApprovalFor: [],
    preferredAiTaskTypes: ['research', 'fact_check', 'comparison'],
    verification: ['source table', 'citations', 'web primary-source checks'],
    enabled: true,
  },
  {
    id: 'skill.web',
    kind: 'skill',
    label: 'Web Orchestrator',
    source: 'ai/skills/custom/web/SKILL.md',
    description: 'Routes browser, scraping, and web automation work through the web workflow.',
    safetyClass: 'external_state',
    requiresApprovalFor: ['login', 'form_submit', 'write_action', 'deploy'],
    preferredAiTaskTypes: ['web_research', 'browser_automation', 'site_testing'],
    verification: ['browser screenshot', 'test assertions', 'response checks'],
    enabled: true,
  },
  {
    id: 'skill.video',
    kind: 'skill',
    label: 'Video Orchestrator',
    source: 'ai/skills/custom/video/SKILL.md',
    description: 'Routes script, design, rendering, publishing, and analytics work through the video workflow.',
    safetyClass: 'repo_write',
    requiresApprovalFor: ['file_write', 'commit', 'push', 'publish', 'deploy'],
    preferredAiTaskTypes: ['video_planning', 'thumbnail_generation', 'metadata_generation'],
    verification: ['render preview', 'artifact inspection', 'git diff --check'],
    enabled: true,
  },
  {
    id: 'ai.ollama-m4pro',
    kind: 'ai_surface',
    label: 'Mac Mini M4 Pro Ollama',
    source: 'projects/brain-core/docs/ai-model-selector-architecture.md',
    description: 'Primary local AI execution surface on the M4 Pro.',
    safetyClass: 'read_only',
    requiresApprovalFor: [],
    preferredAiTaskTypes: ['text/small', 'text/medium', 'text/large', 'text/review'],
    verification: ['curl http://localhost:11434/api/tags'],
    enabled: true,
    priority: 1,
  },
  {
    id: 'ai.ollama-m1',
    kind: 'ai_surface',
    label: 'MacBook M1 Ollama',
    source: 'projects/brain-core/docs/ai-model-selector-architecture.md',
    description: 'Secondary local AI execution surface on the M1 Thunderbolt node.',
    safetyClass: 'read_only',
    requiresApprovalFor: [],
    preferredAiTaskTypes: ['text/small', 'text/medium'],
    verification: ['curl http://192.168.2.2:11434/api/tags'],
    enabled: true,
    priority: 2,
  },
  {
    id: 'ai.codex-cli',
    kind: 'ai_surface',
    label: 'Codex CLI',
    source: 'projects/brain-core/docs/ai-model-selector-architecture.md',
    description: 'Subscription-backed OpenAI execution surface for tasks local AI cannot handle well enough.',
    safetyClass: 'read_only',
    requiresApprovalFor: [],
    preferredAiTaskTypes: ['code_generation', 'code_review', 'reasoning'],
    verification: ['codex --help'],
    enabled: true,
    priority: 3,
  },
  {
    id: 'ai.claude-bedrock',
    kind: 'ai_surface',
    label: 'Claude via Amazon Bedrock',
    source: 'projects/brain-core/docs/ai-model-selector-architecture.md',
    description: 'Paid fallback Claude execution surface for tasks that need it.',
    safetyClass: 'read_only',
    requiresApprovalFor: [],
    preferredAiTaskTypes: ['reasoning', 'large_context_batch', 'code_review'],
    verification: ['aws sts get-caller-identity'],
    enabled: true,
    priority: 4,
  },
  {
    id: 'cli.cloudflare',
    kind: 'cli',
    label: 'Cloudflare CLI',
    source: 'operations/runbooks/cloudflare-deploy.md',
    description: 'Cloudflare tooling for DNS, tunnels, and deployment-related operations.',
    safetyClass: 'external_state',
    requiresApprovalFor: ['dns_change', 'deploy', 'external_state', 'credential_sensitive'],
    preferredAiTaskTypes: ['infrastructure', 'dns', 'deploy'],
    verification: ['cloudflare --help', 'wrangler --version'],
    enabled: true,
  },
  {
    id: 'cli.dokploy',
    kind: 'cli',
    label: 'Dokploy CLI',
    source: 'operations/runbooks/dokploy.md',
    description: 'Dokploy tooling for app deployment and hosting lifecycle management.',
    safetyClass: 'external_state',
    requiresApprovalFor: ['deploy', 'external_state', 'credential_sensitive'],
    preferredAiTaskTypes: ['infrastructure', 'deploy'],
    verification: ['dokploy --help'],
    enabled: true,
  },
  {
    id: 'cli.aws',
    kind: 'cli',
    label: 'AWS CLI',
    source: 'operations/runbooks/aws.md',
    description: 'AWS tooling for cloud infrastructure, IAM, and Bedrock access.',
    safetyClass: 'credential_sensitive',
    requiresApprovalFor: ['deploy', 'external_state', 'credential_sensitive'],
    preferredAiTaskTypes: ['infrastructure', 'cloud'],
    verification: ['aws --version'],
    enabled: true,
  },
  {
    id: 'cli.azure',
    kind: 'cli',
    label: 'Azure CLI',
    source: 'operations/runbooks/azure.md',
    description: 'Azure tooling for cloud infrastructure and resource management.',
    safetyClass: 'credential_sensitive',
    requiresApprovalFor: ['deploy', 'external_state', 'credential_sensitive'],
    preferredAiTaskTypes: ['infrastructure', 'cloud'],
    verification: ['az --version'],
    enabled: true,
  },
  {
    id: 'cli.github',
    kind: 'cli',
    label: 'GitHub CLI',
    source: 'operations/runbooks/github.md',
    description: 'GitHub tooling for repository and pull request operations.',
    safetyClass: 'repo_write',
    requiresApprovalFor: ['commit', 'push', 'repo_write'],
    preferredAiTaskTypes: ['code', 'repo_management'],
    verification: ['gh --version'],
    enabled: true,
  },
];

export function listAgentCapabilities(): AgentCapabilitySummary[] {
  return AGENT_CAPABILITIES.map((capability) => ({
    ...capability,
    requiresApprovalFor: [...capability.requiresApprovalFor],
    preferredAiTaskTypes: [...capability.preferredAiTaskTypes],
    verification: [...capability.verification],
  }));
}
