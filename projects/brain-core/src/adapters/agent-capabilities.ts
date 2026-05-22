import fs from 'node:fs';
import path from 'node:path';
import { listAgentCliCapabilities } from './agent-cli-capability-manifest.js';

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
];

export function listAgentCapabilities(skillsRoot = getSkillsRoot()): AgentCapabilitySummary[] {
  const skillAndAiCapabilities = AGENT_CAPABILITIES.map((capability) => {
    const cloned = cloneCapability(capability);

    if (!capability.id.startsWith('skill.')) {
      return cloned;
    }

    const skillName = capability.id.slice('skill.'.length);
    const frontmatter = readSkillFrontmatter(skillName, skillsRoot);

    if (!frontmatter) {
      return cloned;
    }

    return {
      ...cloned,
      label: frontmatter.name ?? cloned.label,
      description: frontmatter.description ?? cloned.description,
    };
  });

  return [...skillAndAiCapabilities, ...listAgentCliCapabilities()];
}

interface SkillFrontmatter {
  name?: string;
  description?: string;
}

function cloneCapability(capability: AgentCapabilitySummary): AgentCapabilitySummary {
  return {
    ...capability,
    requiresApprovalFor: [...capability.requiresApprovalFor],
    preferredAiTaskTypes: [...capability.preferredAiTaskTypes],
    verification: [...capability.verification],
  };
}

export function readSkillFrontmatter(skillName: string, skillsRoot = getSkillsRoot()): SkillFrontmatter | null {
  const skillFilePath = path.resolve(skillsRoot, skillName, 'SKILL.md');

  if (!fs.existsSync(skillFilePath)) {
    return null;
  }

  const content = fs.readFileSync(skillFilePath, 'utf8');
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);

  if (!match) {
    return null;
  }

  return parseFrontmatter(match[1] ?? '');
}

function parseFrontmatter(input: string): SkillFrontmatter {
  const metadata: SkillFrontmatter = {};

  for (const line of input.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key === 'name' && value) {
      metadata.name = value;
    }

    if (key === 'description' && value) {
      metadata.description = value;
    }
  }

  return metadata;
}

function getSkillsRoot(): string {
  return path.resolve(process.cwd(), '../../ai/skills/custom');
}
