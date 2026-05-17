export interface BrainCoreStatus {
  service: 'brain-core';
  mode: 'read-only';
  ok: boolean;
  startedAt: string;
  uptimeSeconds: number;
  version: string;
  host: string;
}

export interface BrainCoreSessionSummary {
  id: string;
  tool: 'claude' | 'codex' | 'gemini' | 'unknown';
  repo?: string;
  title: string;
  updatedAt?: string;
  age?: string;
  intent?: string;
  score?: number;
  source: 'placeholder' | 'adapter';
}

export interface BrainCoreSkillSummary {
  id: string;
  name: string;
  sourcePath: string;
  status: 'indexed' | 'placeholder';
}

export interface BrainCoreRepoSummary {
  alias: string;
  path: string;
  exists: boolean;
  handoffPath?: string;
  handoffExists: boolean;
  source: 'env' | 'placeholder';
}

export interface BrainCoreErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

export interface BrainCoreRoutes {
  '/status': BrainCoreStatus;
  '/sessions': {
    sessions: BrainCoreSessionSummary[];
  };
  '/skills': {
    skills: BrainCoreSkillSummary[];
  };
  '/repos': {
    repos: BrainCoreRepoSummary[];
  };
}
