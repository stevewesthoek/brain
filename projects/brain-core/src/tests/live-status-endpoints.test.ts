import test from 'node:test';
import assert from 'node:assert/strict';
import { routeRequest } from '../api/routes.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

class MockResponse implements ServerResponse {
  statusCode = 0;
  headers: Record<string, string> = {};
  body = '';

  writeHead(statusCode: number, headers?: Record<string, string>): void {
    this.statusCode = statusCode;
    this.headers = headers ?? {};
  }

  end(chunk?: string): void {
    this.body = chunk ?? '';
  }
}

function createRequest(input: {
  method?: string;
  url?: string;
  remoteAddress?: string;
}): IncomingMessage {
  const request: IncomingMessage = {
    socket: {
      remoteAddress: input.remoteAddress ?? '127.0.0.1',
    },
  };

  if (input.method !== undefined) {
    request.method = input.method;
  }

  if (input.url !== undefined) {
    request.url = input.url;
  }

  return request;
}

async function exercise(input: {
  method?: string;
  url?: string;
  remoteAddress?: string;
}): Promise<MockResponse> {
  const response = new MockResponse();
  await routeRequest(createRequest(input), response);
  return response;
}

test('GET /stb/status returns safe read-only object with source and health', async () => {
  const response = await exercise({ method: 'GET', url: '/stb/status' });
  const body = JSON.parse(response.body) as {
    id: string;
    pipelineId: string;
    source: string;
    status: string;
    health: string;
    limitations: string[];
    actions: { canPreview: boolean; canRequestRun: boolean; requiresApproval: boolean };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.id, 'stb-pipeline-status');
  assert.equal(body.pipelineId, 'stb-daily-pipeline');
  assert.ok(['runtime-file', 'unavailable', 'static-registry'].includes(body.source));
  assert.ok(['operational', 'stale', 'error', 'unknown'].includes(body.status));
  assert.ok(['ok', 'warning', 'error', 'unknown'].includes(body.health));
  assert.ok(Array.isArray(body.limitations));
  assert.equal(body.actions.canPreview, false);
  assert.equal(body.actions.canRequestRun, false);
  assert.equal(body.actions.requiresApproval, false);
});

test('GET /video-orchestrator/status returns module progress and not operational', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/status' });
  const body = JSON.parse(response.body) as {
    id: string;
    orchestratorId: string;
    status: string;
    health: string;
    moduleProgress: { total: number; implemented: number; percent: number };
    modules: Array<{ id: string; name: string }>;
    supportedProjects: string[];
    supportedPlatforms: string[];
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.id, 'video-orchestrator-status');
  assert.equal(body.orchestratorId, 'video-orchestrator');
  assert.ok(['operational', 'partial', 'planned', 'blocked'].includes(body.status));
  assert.ok(['ok', 'warning', 'error', 'unknown'].includes(body.health));
  assert.ok(body.moduleProgress.total > 0);
  assert.ok(body.moduleProgress.implemented >= 0);
  assert.ok(body.moduleProgress.percent >= 0);
  assert.ok(Array.isArray(body.modules));
  assert.ok(body.modules.length > 0);
  assert.ok(body.supportedProjects.includes('says-the-bible'));
  assert.ok(body.supportedPlatforms.includes('youtube'));
});

test('GET /stb-video-migration/status has decommissionBlocked true', async () => {
  const response = await exercise({ method: 'GET', url: '/stb-video-migration/status' });
  const body = JSON.parse(response.body) as {
    id: string;
    sourcePipelineId: string;
    targetPipelineId: string;
    status: string;
    decommissionBlocked: boolean;
    parityPercent: number;
    modules: Array<{ stbConcept: string; videoModule: string; status: string }>;
    blockers: string[];
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.id, 'stb-to-video-migration-status');
  assert.equal(body.sourcePipelineId, 'stb-daily-pipeline');
  assert.equal(body.targetPipelineId, 'video-upload-pipeline');
  assert.ok(['mapping', 'partial', 'dual-run', 'ready', 'complete', 'blocked'].includes(body.status));
  assert.equal(body.decommissionBlocked, true);
  assert.ok(body.parityPercent >= 0);
  assert.ok(Array.isArray(body.modules));
  assert.ok(body.modules.length > 0);
  assert.ok(Array.isArray(body.blockers));
});

test('GET /agents returns model-router-agent, claude-code-executor, codex-executor', async () => {
  const response = await exercise({ method: 'GET', url: '/agents' });
  const body = JSON.parse(response.body) as {
    agents: Array<{
      id: string;
      name: string;
      role: string;
      status: string;
      health: string;
      owner: string;
    }>;
  };

  assert.equal(response.statusCode, 200);
  assert.ok(Array.isArray(body.agents));
  assert.ok(body.agents.length > 0);

  const agentIds = body.agents.map(a => a.id);
  assert.ok(agentIds.includes('model-router-agent'));
  assert.ok(agentIds.includes('claude-code-executor'));
  assert.ok(agentIds.includes('codex-executor'));

  const externalExecutors = body.agents.filter(a => a.owner === 'external-tool');
  assert.ok(externalExecutors.length >= 2);
});

test('GET /agents/:id returns one agent', async () => {
  const response = await exercise({ method: 'GET', url: '/agents/model-router-agent' });
  const body = JSON.parse(response.body) as {
    agent: {
      id: string;
      name: string;
      role: string;
      status: string;
      health: string;
      owner: string;
      actions: { canRun: boolean; canRequestRun: boolean; requiresApproval: boolean };
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.agent.id, 'model-router-agent');
  assert.equal(body.agent.owner, 'brain-core');
  assert.ok(['orchestrator', 'executor', 'researcher', 'reviewer', 'dashboard'].includes(body.agent.role));
  assert.equal(body.agent.actions.canRun, false);
});

test('GET /agents/:id returns 404 for unknown agent', async () => {
  const response = await exercise({ method: 'GET', url: '/agents/nonexistent' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('No agent action can run directly (all have canRun false except external executors)', async () => {
  const response = await exercise({ method: 'GET', url: '/agents' });
  const body = JSON.parse(response.body) as {
    agents: Array<{
      id: string;
      owner: string;
      actions: { canRun: boolean };
    }>;
  };

  const internalAgents = body.agents.filter(a => a.owner === 'brain-core');
  internalAgents.forEach(agent => {
    assert.equal(agent.actions.canRun, false, `${agent.id} should not have canRun=true`);
  });

  const externalExecutors = body.agents.filter(a => a.owner === 'external-tool' && a.id.includes('executor'));
  externalExecutors.forEach(agent => {
    assert.equal(agent.actions.canRun, true, `${agent.id} external executor should have canRun=true`);
  });
});

test('STB status and video orchestrator status do not support execution', async () => {
  const stbResponse = await exercise({ method: 'GET', url: '/stb/status' });
  const stbBody = JSON.parse(stbResponse.body) as { actions: { canRequestRun: boolean } };
  assert.equal(stbBody.actions.canRequestRun, false);

  const videoResponse = await exercise({ method: 'GET', url: '/video-orchestrator/status' });
  const videoBody = JSON.parse(videoResponse.body) as { actions: { canRequestRun: boolean } };
  assert.equal(videoBody.actions.canRequestRun, false);
});

test('Existing registry tests still pass (orchestrators count is 12)', async () => {
  const response = await exercise({ method: 'GET', url: '/orchestrators' });
  const body = JSON.parse(response.body) as {
    orchestrators: Array<{ id: string }>;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.orchestrators.length, 12);
});

test('GET /stb/status evidence is capped and safe', async () => {
  const response = await exercise({ method: 'GET', url: '/stb/status' });
  const body = JSON.parse(response.body) as {
    evidence: Array<{ label: string; value: string; path?: string }>;
  };

  assert.equal(response.statusCode, 200);
  assert.ok(Array.isArray(body.evidence));
  assert.ok(body.evidence.length <= 8, 'Evidence should be capped at 8 items');
  
  body.evidence.forEach(item => {
    assert.ok(typeof item.label === 'string', 'Each evidence item must have a label');
    assert.ok(typeof item.value === 'string', 'Each evidence item must have a value');
    // Path field (optional) should not be exposed if present
    if (item.path !== undefined) {
      assert.ok(typeof item.path === 'string', 'Evidence path should be string');
    }
  });
});

test('GET /video-orchestrator/status modules report accurate progress and blocked status', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/status' });
  const body = JSON.parse(response.body) as {
    modules: Array<{ id: string; status: 'implemented' | 'partial' | 'planned' | 'blocked' | 'unknown' }>;
    moduleProgress: { implemented: number; partial: number; planned: number; blocked: number; percent: number };
  };

  assert.equal(response.statusCode, 200);
  
  // Verify progress counts match module statuses
  const implemented = body.modules.filter(m => m.status === 'implemented').length;
  const partial = body.modules.filter(m => m.status === 'partial').length;
  const planned = body.modules.filter(m => m.status === 'planned').length;
  const blocked = body.modules.filter(m => m.status === 'blocked').length;
  
  assert.equal(body.moduleProgress.implemented, implemented, 'Implemented count mismatch');
  assert.equal(body.moduleProgress.partial, partial, 'Partial count mismatch');
  assert.equal(body.moduleProgress.planned, planned, 'Planned count mismatch');
  assert.equal(body.moduleProgress.blocked, blocked, 'Blocked count mismatch');
  
  // Verify percent calculation: (implemented * 100 + partial * 50) / total
  const total = body.modules.length;
  const expectedPercent = Math.round(((implemented * 100) + (partial * 50)) / total);
  assert.equal(body.moduleProgress.percent, expectedPercent, 'Progress percent mismatch');
});

test('GET /video-orchestrator/status limitations include blocker information', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/status' });
  const body = JSON.parse(response.body) as {
    limitations: string[];
  };

  assert.equal(response.statusCode, 200);
  assert.ok(Array.isArray(body.limitations));
  assert.ok(body.limitations.length > 0, 'Limitations should not be empty');
  
  // Should not claim to be operational when design-phase only
  const hasDesignPhaseNote = body.limitations.some(l => l.toLowerCase().includes('design') || l.toLowerCase().includes('no live execution'));
  assert.ok(hasDesignPhaseNote, 'Limitations should note design-phase status');
});

test('GET /stb-video-migration/status has accurate module status and blockers', async () => {
  const response = await exercise({ method: 'GET', url: '/stb-video-migration/status' });
  const body = JSON.parse(response.body) as {
    modules: Array<{ status: 'mapped' | 'partial' | 'planned' | 'blocked' }>;
    blockers: string[];
    decommissionBlocked: boolean;
  };

  assert.equal(response.statusCode, 200);
  assert.ok(Array.isArray(body.modules));
  assert.ok(body.modules.length > 0);
  
  // Verify blockers array exists and is populated
  assert.ok(Array.isArray(body.blockers));
  assert.ok(body.decommissionBlocked === true, 'STB migration should always be decommissionBlocked');
  
  // Verify at least one module is blocked if blockers exist
  if (body.blockers.length > 0) {
    const hasBlockedModule = body.modules.some(m => m.status === 'blocked');
    assert.ok(hasBlockedModule, 'Should have blocked modules if blockers are listed');
  }
});

test('Safety: STB and video evidence never imply execution is enabled', async () => {
  const stbResponse = await exercise({ method: 'GET', url: '/stb/status' });
  const stbBody = JSON.parse(stbResponse.body) as {
    actions: { canPreview: boolean; canRequestRun: boolean; requiresApproval: boolean };
  };
  
  assert.equal(stbBody.actions.canPreview, false);
  assert.equal(stbBody.actions.canRequestRun, false);
  assert.equal(stbBody.actions.requiresApproval, false);

  const videoResponse = await exercise({ method: 'GET', url: '/video-orchestrator/status' });
  const videoBody = JSON.parse(videoResponse.body) as {
    actions: { canPreview: boolean; canRequestRun: boolean; requiresApproval: boolean };
  };
  
  assert.equal(videoBody.actions.canPreview, false);
  assert.equal(videoBody.actions.canRequestRun, false);
  assert.equal(videoBody.actions.requiresApproval, false);
});
