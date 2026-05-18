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

test('GET /agent-runs returns list of agent run summaries with safety flags disabled', async () => {
  const response = await exercise({ method: 'GET', url: '/agent-runs' });
  const body = JSON.parse(response.body) as {
    runs: Array<{
      id: string;
      agentId: string;
      status: string;
      safety: { writesToMind: boolean; executesShell: boolean; executionEnabled: boolean };
    }>;
  };

  assert.equal(response.statusCode, 200);
  assert.ok(Array.isArray(body.runs));
  assert.ok(body.runs.length > 0);

  body.runs.forEach(run => {
    assert.equal(run.safety.writesToMind, false, 'All runs must have writesToMind: false');
    assert.equal(run.safety.executionEnabled, false, 'All runs must have executionEnabled: false');
  });
});

test('GET /agent-runs/:id returns single agent run detail', async () => {
  const listResponse = await exercise({ method: 'GET', url: '/agent-runs' });
  const listBody = JSON.parse(listResponse.body) as {
    runs: Array<{ id: string }>;
  };

  assert.ok(listBody.runs.length > 0);
  const runId = listBody.runs[0]!.id;

  const detailResponse = await exercise({ method: 'GET', url: `/agent-runs/${runId}` });
  const detailBody = JSON.parse(detailResponse.body) as {
    run: { id: string; status: string };
  };

  assert.equal(detailResponse.statusCode, 200);
  assert.equal(detailBody.run.id, runId);
});

test('GET /agent-runs/:id returns 404 for unknown run', async () => {
  const response = await exercise({ method: 'GET', url: '/agent-runs/nonexistent-run-id' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /agent-events returns approval audit events mapped to agent events', async () => {
  const response = await exercise({ method: 'GET', url: '/agent-events' });
  const body = JSON.parse(response.body) as {
    events: Array<{
      id: string;
      agentId?: string;
      type: string;
      createdAt: string;
      severity: string;
    }>;
  };

  assert.equal(response.statusCode, 200);
  assert.ok(Array.isArray(body.events));

  if (body.events.length > 0) {
    body.events.forEach(event => {
      assert.ok(['requested', 'approved', 'rejected', 'executed', 'blocked', 'unknown'].includes(event.type));
      assert.ok(['info', 'warning', 'error'].includes(event.severity));
    });
  }
});

test('GET /approval-audit returns approval audit events', async () => {
  const response = await exercise({ method: 'GET', url: '/approval-audit' });
  const body = JSON.parse(response.body) as {
    events: Array<{
      id: string;
      approvalId: string;
      event: string;
    }>;
  };

  assert.equal(response.statusCode, 200);
  assert.ok(Array.isArray(body.events));
});

test('GET /recovery returns recovery items with no auto-fix capability', async () => {
  const response = await exercise({ method: 'GET', url: '/recovery' });
  const body = JSON.parse(response.body) as {
    items: Array<{
      id: string;
      severity: string;
      source: string;
      safety: { canAutoFix: boolean; writesToMind: boolean };
    }>;
  };

  assert.equal(response.statusCode, 200);
  assert.ok(Array.isArray(body.items));

  body.items.forEach(item => {
    assert.equal(item.safety.canAutoFix, false, 'Recovery items must not auto-fix');
    assert.equal(item.safety.writesToMind, false, 'Recovery items must not write to Mind');
  });
});

test('GET /video-orchestrator/intake returns sources and plans with safety flags', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/intake' });
  const body = JSON.parse(response.body) as {
    id: string;
    sources: Array<{ id: string; source: string; status: string }>;
    plans: Array<{ id: string; status: string; safety: object }>;
    summary: { sourceCount: number; planCount: number };
    safety: {
      readOnly: boolean;
      executesStb: boolean;
      executesVideo: boolean;
      writesFiles: boolean;
      publishesContent: boolean;
      writesToMind: boolean;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.id, 'video-orchestrator-intake');
  assert.ok(Array.isArray(body.sources), 'sources should be array');
  assert.ok(Array.isArray(body.plans), 'plans should be array');
  assert.ok(body.summary.sourceCount > 0, 'should have sources');
  assert.ok(body.summary.planCount > 0, 'should have plans');
  assert.equal(body.safety.readOnly, true, 'must be read-only');
  assert.equal(body.safety.executesStb, false, 'must not execute STB');
  assert.equal(body.safety.executesVideo, false, 'must not execute Video');
  assert.equal(body.safety.writesFiles, false, 'must not write files');
  assert.equal(body.safety.publishesContent, false, 'must not publish');
  assert.equal(body.safety.writesToMind, false, 'must not write to Mind');
});

test('GET /video-orchestrator/intake/:id returns a single plan with safety flags', async () => {
  const listResponse = await exercise({ method: 'GET', url: '/video-orchestrator/intake' });
  const listBody = JSON.parse(listResponse.body) as { plans: Array<{ id: string }> };
  assert.ok(listBody.plans.length > 0, 'should have at least one plan');

  const firstPlanId = listBody.plans[0]?.id;
  const response = await exercise({ method: 'GET', url: `/video-orchestrator/intake/${firstPlanId}` });
  const body = JSON.parse(response.body) as {
    id: string;
    sourceId: string;
    title: string;
    status: string;
    safety: {
      readOnly: boolean;
      executesStb: boolean;
      executesVideo: boolean;
      writesFiles: boolean;
      publishesContent: boolean;
      writesToMind: boolean;
    };
    normalizedInputs: { title: string; durationTargetMinutes: number; platforms: string[] };
  };

  assert.equal(response.statusCode, 200);
  assert.ok(body.id.startsWith('plan-'), 'plan id should have plan- prefix');
  assert.ok(body.title, 'should have title');
  assert.equal(body.safety.readOnly, true);
  assert.equal(body.safety.executesStb, false);
  assert.equal(body.safety.executesVideo, false);
  assert.equal(body.safety.writesFiles, false);
  assert.equal(body.safety.publishesContent, false);
  assert.equal(body.safety.writesToMind, false);
  assert.ok(body.normalizedInputs.title);
  assert.equal(body.normalizedInputs.durationTargetMinutes, 30);
  assert.ok(Array.isArray(body.normalizedInputs.platforms));
});

test('GET /video-orchestrator/intake/:id with unknown id returns 404', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/intake/unknown-plan-id' });
  assert.equal(response.statusCode, 404);

  const body = JSON.parse(response.body) as { error?: { code: string; message: string } };
  assert.equal(body.error?.code, 'not_found');
  assert.ok(body.error?.message.includes('intake plan'));
});

test('GET /video-orchestrator/research returns briefs with safety flags', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/research' });
  const body = JSON.parse(response.body) as {
    id: string;
    briefs: Array<{ id: string; status: string; title: string }>;
    summary: { total: number; readyCount: number };
    safety: {
      readOnly: boolean;
      executesStb: boolean;
      callsExternalAI: boolean;
      writesFiles: boolean;
      publishesContent: boolean;
      writesToMind: boolean;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.id, 'video-orchestrator-research');
  assert.ok(Array.isArray(body.briefs), 'briefs should be array');
  assert.ok(body.summary.total > 0, 'should have briefs');
  assert.equal(body.safety.readOnly, true, 'must be read-only');
  assert.equal(body.safety.executesStb, false, 'must not execute STB');
  assert.equal(body.safety.callsExternalAI, false, 'must not call external AI');
  assert.equal(body.safety.writesFiles, false, 'must not write files');
  assert.equal(body.safety.publishesContent, false, 'must not publish');
  assert.equal(body.safety.writesToMind, false, 'must not write to Mind');
});

test('GET /video-orchestrator/research/:id returns a single research plan', async () => {
  const intakeResponse = await exercise({ method: 'GET', url: '/video-orchestrator/intake' });
  const intakeBody = JSON.parse(intakeResponse.body) as { plans: Array<{ id: string }> };
  assert.ok(intakeBody.plans.length > 0, 'should have at least one intake plan');

  const firstIntakePlanId = intakeBody.plans[0]?.id;
  const response = await exercise({ method: 'GET', url: `/video-orchestrator/research/${firstIntakePlanId}` });
  const body = JSON.parse(response.body) as {
    id: string;
    researchBrief: { title: string; status: string };
    questions: Array<{ sequence: number; question: string }>;
    sources: Array<{ id: string; type: string }>;
    safety: {
      readOnly: boolean;
      executesStb: boolean;
      callsExternalAI: boolean;
      writesFiles: boolean;
      publishesContent: boolean;
      writesToMind: boolean;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.ok(body.researchBrief);
  assert.ok(Array.isArray(body.questions));
  assert.ok(Array.isArray(body.sources));
  assert.equal(body.safety.readOnly, true);
  assert.equal(body.safety.executesStb, false);
  assert.equal(body.safety.callsExternalAI, false);
  assert.equal(body.safety.writesFiles, false);
  assert.equal(body.safety.publishesContent, false);
  assert.equal(body.safety.writesToMind, false);
});

test('GET /video-orchestrator/research/:id with unknown id returns 404', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/research/unknown-brief-id' });
  assert.equal(response.statusCode, 404);

  const body = JSON.parse(response.body) as { error?: { code: string; message: string } };
  assert.equal(body.error?.code, 'not_found');
  assert.ok(body.error?.message.includes('research plan'));
});

test('GET /video-orchestrator/script returns plans with safety flags', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/script' });
  const body = JSON.parse(response.body) as {
    id: string;
    plans: Array<{ id: string; status: string; title: string }>;
    summary: { total: number; availableCount: number };
    safety: {
      readOnly: boolean;
      executesStb: boolean;
      executesVideo: boolean;
      callsExternalAI: boolean;
      writesFiles: boolean;
      publishesContent: boolean;
      writesToMind: boolean;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.id, 'video-orchestrator-script');
  assert.ok(Array.isArray(body.plans), 'plans should be array');
  assert.ok(body.summary.total > 0, 'should have plans');
  assert.equal(body.safety.readOnly, true, 'must be read-only');
  assert.equal(body.safety.executesStb, false, 'must not execute STB');
  assert.equal(body.safety.executesVideo, false, 'must not execute Video');
  assert.equal(body.safety.callsExternalAI, false, 'must not call external AI');
  assert.equal(body.safety.writesFiles, false, 'must not write files');
  assert.equal(body.safety.publishesContent, false, 'must not publish');
  assert.equal(body.safety.writesToMind, false, 'must not write to Mind');
});

test('GET /video-orchestrator/script/:id returns a single script plan', async () => {
  const intakeResponse = await exercise({ method: 'GET', url: '/video-orchestrator/intake' });
  const intakeBody = JSON.parse(intakeResponse.body) as { plans: Array<{ id: string }> };
  assert.ok(intakeBody.plans.length > 0, 'should have at least one intake plan');

  const firstIntakePlanId = intakeBody.plans[0]?.id;
  const response = await exercise({ method: 'GET', url: `/video-orchestrator/script/${firstIntakePlanId}` });
  const body = JSON.parse(response.body) as {
    id: string;
    type: string;
    plan?: { outline: object; draft: object };
    safety: {
      readOnly: boolean;
      executesStb: boolean;
      executesVideo: boolean;
      callsExternalAI: boolean;
      writesFiles: boolean;
      publishesContent: boolean;
      writesToMind: boolean;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.ok(body.plan, 'should have plan');
  assert.ok(body.plan?.outline, 'plan should have outline');
  assert.ok(body.plan?.draft, 'plan should have draft');
  assert.equal(body.safety.readOnly, true);
  assert.equal(body.safety.executesStb, false);
  assert.equal(body.safety.executesVideo, false);
  assert.equal(body.safety.callsExternalAI, false);
  assert.equal(body.safety.writesFiles, false);
  assert.equal(body.safety.publishesContent, false);
  assert.equal(body.safety.writesToMind, false);
});

test('GET /video-orchestrator/script/:id with unknown id returns 404', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/script/unknown-plan-id' });
  assert.equal(response.statusCode, 404);

  const body = JSON.parse(response.body) as { error?: { code: string; message: string } };
  assert.equal(body.error?.code, 'not_found');
  assert.ok(body.error?.message.includes('script plan'));
});

test('GET /video-orchestrator/asset-plan returns plans with safety flags', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/asset-plan' });
  const body = JSON.parse(response.body) as {
    id: string;
    plans: Array<{ id: string; status: string; requirements: Array<{ id: string }> }>;
    summary: { total: number; previewReadyCount: number; totalRequirements: number };
    safety: {
      readOnly: boolean;
      executesStb: boolean;
      executesVideo: boolean;
      generatesImage: boolean;
      callsExternalAI: boolean;
      writesFiles: boolean;
      publishesContent: boolean;
      writesToMind: boolean;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.id, 'video-orchestrator-asset-plan');
  assert.ok(Array.isArray(body.plans), 'plans should be array');
  assert.ok(body.summary.total > 0, 'should have plans');
  assert.equal(body.safety.readOnly, true, 'must be read-only');
  assert.equal(body.safety.executesStb, false, 'must not execute STB');
  assert.equal(body.safety.executesVideo, false, 'must not execute Video');
  assert.equal(body.safety.generatesImage, false, 'must not generate images');
  assert.equal(body.safety.callsExternalAI, false, 'must not call external AI');
  assert.equal(body.safety.writesFiles, false, 'must not write files');
  assert.equal(body.safety.publishesContent, false, 'must not publish');
  assert.equal(body.safety.writesToMind, false, 'must not write to Mind');
});

test('GET /video-orchestrator/asset-plan/:id returns a single asset plan', async () => {
  const intakeResponse = await exercise({ method: 'GET', url: '/video-orchestrator/intake' });
  const intakeBody = JSON.parse(intakeResponse.body) as { plans: Array<{ id: string }> };
  assert.ok(intakeBody.plans.length > 0, 'should have at least one intake plan');

  const firstIntakePlanId = intakeBody.plans[0]?.id;
  const response = await exercise({ method: 'GET', url: `/video-orchestrator/asset-plan/${firstIntakePlanId}` });
  const body = JSON.parse(response.body) as {
    id: string;
    plan: {
      requirements: Array<{
        id: string;
        kind: string;
        placeholder: string;
        safety: {
          readOnly: boolean;
          generatesImage: boolean;
          callsExternalAI: boolean;
          writesFiles: boolean;
          publishesContent: boolean;
          writesToMind: boolean;
        };
      }>;
    };
    safety: {
      readOnly: boolean;
      executesStb: boolean;
      executesVideo: boolean;
      generatesImage: boolean;
      callsExternalAI: boolean;
      writesFiles: boolean;
      publishesContent: boolean;
      writesToMind: boolean;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.ok(body.plan);
  assert.ok(Array.isArray(body.plan.requirements));
  assert.ok(body.plan.requirements.length > 0, 'should have requirements');

  body.plan.requirements.forEach(req => {
    assert.equal(req.safety.readOnly, true, `${req.kind} must be read-only`);
    assert.equal(req.safety.generatesImage, false, `${req.kind} must not generate images`);
    assert.equal(req.safety.callsExternalAI, false, `${req.kind} must not call external AI`);
    assert.ok(req.placeholder, `${req.kind} must have placeholder`);
    assert.ok(req.placeholder.includes('placeholder'), `${req.kind} placeholder must be structural only`);
  });

  assert.equal(body.safety.readOnly, true);
  assert.equal(body.safety.executesStb, false);
  assert.equal(body.safety.executesVideo, false);
  assert.equal(body.safety.generatesImage, false);
  assert.equal(body.safety.callsExternalAI, false);
  assert.equal(body.safety.writesFiles, false);
  assert.equal(body.safety.publishesContent, false);
  assert.equal(body.safety.writesToMind, false);
});

test('GET /video-orchestrator/asset-plan/:id with unknown id returns 404', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/asset-plan/unknown-plan-id' });
  assert.equal(response.statusCode, 404);

  const body = JSON.parse(response.body) as { error?: { code: string; message: string } };
  assert.equal(body.error?.code, 'not_found');
  assert.ok(body.error?.message.includes('asset plan'));
});

test('GET /video-orchestrator/design-plan returns plans with safety flags', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/design-plan' });
  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body) as {
    id: string;
    summary?: { total: number };
    safety?: Record<string, unknown>;
    plans?: Array<{ safety?: Record<string, unknown> }>;
  };
  assert.equal(body.id, 'video-orchestrator-design-plan');
  assert.ok(body.summary?.total !== undefined);
  assert.equal(body.safety?.readOnly, true);
  assert.equal(body.safety?.generatesImage, false);
  assert.equal(body.safety?.generatesPrompt, false);
  assert.equal(body.safety?.callsExternalAI, false);
  assert.equal(body.safety?.writesFiles, false);
  assert.equal(body.safety?.publishesContent, false);
  assert.equal(body.safety?.writesToMind, false);
  assert.ok(Array.isArray(body.plans));
});

test('GET /video-orchestrator/design-plan/:id returns a single design plan', async () => {
  const listResponse = await exercise({ method: 'GET', url: '/video-orchestrator/design-plan' });
  const listBody = JSON.parse(listResponse.body) as {
    plans?: Array<{ id: string; assetPlanId: string }>;
  };
  const firstPlan = listBody.plans?.[0];
  assert.ok(firstPlan?.assetPlanId);

  const response = await exercise({
    method: 'GET',
    url: `/video-orchestrator/design-plan/${encodeURIComponent(firstPlan.assetPlanId)}`,
  });
  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body) as {
    plan?: {
      specs?: Array<{ safety?: Record<string, unknown>; placeholder?: string }>;
      safety?: Record<string, unknown>;
    };
  };
  assert.ok(body.plan?.specs);
  assert.ok(Array.isArray(body.plan.specs));

  for (const spec of body.plan.specs ?? []) {
    assert.equal(spec.safety?.readOnly, true);
    assert.equal(spec.safety?.generatesImage, false);
    assert.equal(spec.safety?.generatesPrompt, false);
    assert.equal(spec.safety?.callsExternalAI, false);
    assert.ok(spec.placeholder?.includes('placeholder'));
  }

  assert.equal(body.plan?.safety?.readOnly, true);
  assert.equal(body.plan?.safety?.generatesImage, false);
  assert.equal(body.plan?.safety?.generatesPrompt, false);
});

test('GET /video-orchestrator/design-plan/:id with unknown id returns 404', async () => {
  const response = await exercise({
    method: 'GET',
    url: '/video-orchestrator/design-plan/unknown-plan-id',
  });
  assert.equal(response.statusCode, 404);

  const body = JSON.parse(response.body) as { error?: { code: string; message: string } };
  assert.equal(body.error?.code, 'not_found');
  assert.ok(body.error?.message.includes('design plan'));
});

test('GET /video-orchestrator/voiceover-plan returns plans with safety flags', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/voiceover-plan' });
  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body) as {
    id: string;
    summary?: { total: number };
    safety?: Record<string, unknown>;
    plans?: Array<{ safety?: Record<string, unknown> }>;
  };
  assert.equal(body.id, 'video-orchestrator-voiceover-plan');
  assert.ok(body.summary?.total !== undefined);
  assert.equal(body.safety?.readOnly, true);
  assert.equal(body.safety?.generatesAudio, false);
  assert.equal(body.safety?.callsTts, false);
  assert.equal(body.safety?.callsExternalAI, false);
  assert.equal(body.safety?.writesFiles, false);
  assert.equal(body.safety?.publishesContent, false);
  assert.equal(body.safety?.writesToMind, false);
  assert.ok(Array.isArray(body.plans));
});

test('GET /video-orchestrator/voiceover-plan/:id returns a single voiceover plan', async () => {
  const listResponse = await exercise({ method: 'GET', url: '/video-orchestrator/voiceover-plan' });
  const listBody = JSON.parse(listResponse.body) as {
    plans?: Array<{ id: string; scriptPlanId: string }>;
  };
  const firstPlan = listBody.plans?.[0];
  assert.ok(firstPlan?.scriptPlanId);

  const response = await exercise({
    method: 'GET',
    url: `/video-orchestrator/voiceover-plan/${encodeURIComponent(firstPlan.scriptPlanId)}`,
  });
  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body) as {
    plan?: {
      segments?: Array<{ safety?: Record<string, unknown>; placeholder?: string }>;
      safety?: Record<string, unknown>;
    };
  };
  assert.ok(body.plan?.segments);
  assert.ok(Array.isArray(body.plan.segments));

  for (const segment of body.plan.segments ?? []) {
    assert.equal(segment.safety?.readOnly, true);
    assert.equal(segment.safety?.generatesAudio, false);
    assert.equal(segment.safety?.callsTts, false);
    assert.equal(segment.safety?.callsExternalAI, false);
    assert.ok(segment.placeholder?.includes('placeholder'));
  }

  assert.equal(body.plan?.safety?.readOnly, true);
  assert.equal(body.plan?.safety?.generatesAudio, false);
  assert.equal(body.plan?.safety?.callsTts, false);
});

test('GET /video-orchestrator/voiceover-plan/:id with unknown id returns 404', async () => {
  const response = await exercise({
    method: 'GET',
    url: '/video-orchestrator/voiceover-plan/unknown-plan-id',
  });
  assert.equal(response.statusCode, 404);

  const body = JSON.parse(response.body) as { error?: { code: string; message: string } };
  assert.equal(body.error?.code, 'not_found');
  assert.ok(body.error?.message.includes('voiceover plan'));
});

test('GET /video-orchestrator/visuals-plan returns plans with safety flags', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/visuals-plan' });
  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body) as {
    id: string;
    summary?: { total: number };
    safety?: Record<string, unknown>;
    plans?: Array<{ safety?: Record<string, unknown> }>;
  };
  assert.equal(body.id, 'video-orchestrator-visuals-plan');
  assert.ok(body.summary?.total !== undefined);
  assert.equal(body.safety?.readOnly, true);
  assert.equal(body.safety?.generatesImage, false);
  assert.equal(body.safety?.generatesVideo, false);
  assert.equal(body.safety?.generatesPrompt, false);
  assert.equal(body.safety?.callsExternalAI, false);
  assert.equal(body.safety?.writesFiles, false);
  assert.equal(body.safety?.publishesContent, false);
  assert.equal(body.safety?.writesToMind, false);
  assert.ok(Array.isArray(body.plans));
});

test('GET /video-orchestrator/visuals-plan/:id returns a single visuals plan', async () => {
  const listResponse = await exercise({ method: 'GET', url: '/video-orchestrator/visuals-plan' });
  const listBody = JSON.parse(listResponse.body) as {
    plans?: Array<{ id: string; voiceoverPlanId: string }>;
  };
  const firstPlan = listBody.plans?.[0];
  assert.ok(firstPlan?.voiceoverPlanId);

  const response = await exercise({
    method: 'GET',
    url: `/video-orchestrator/visuals-plan/${encodeURIComponent(firstPlan.voiceoverPlanId)}`,
  });
  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body) as {
    plan?: {
      sequence?: Array<{ safety?: Record<string, unknown>; placeholder?: string }>;
      safety?: Record<string, unknown>;
    };
  };
  assert.ok(body.plan?.sequence);
  assert.ok(Array.isArray(body.plan.sequence));

  for (const item of body.plan.sequence ?? []) {
    assert.equal(item.safety?.readOnly, true);
    assert.equal(item.safety?.generatesImage, false);
    assert.equal(item.safety?.generatesVideo, false);
    assert.equal(item.safety?.generatesPrompt, false);
    assert.equal(item.safety?.callsExternalAI, false);
    assert.ok(item.placeholder?.includes('placeholder'));
  }

  assert.equal(body.plan?.safety?.readOnly, true);
  assert.equal(body.plan?.safety?.generatesImage, false);
  assert.equal(body.plan?.safety?.generatesVideo, false);
});

test('GET /video-orchestrator/visuals-plan/:id with unknown id returns 404', async () => {
  const response = await exercise({
    method: 'GET',
    url: '/video-orchestrator/visuals-plan/unknown-visuals-plan-id',
  });
  assert.equal(response.statusCode, 404);

  const body = JSON.parse(response.body) as { error?: { code: string; message: string } };
  assert.equal(body.error?.code, 'not_found');
  assert.ok(body.error?.message.includes('visuals plan'));
});

test('GET /video-orchestrator/assembly-plan returns plans with safety flags', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/assembly-plan' });
  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body) as {
    id: string;
    summary?: { total: number };
    safety?: Record<string, unknown>;
    plans?: Array<{ safety?: Record<string, unknown> }>;
  };
  assert.equal(body.id, 'video-orchestrator-assembly-plan');
  assert.ok(body.summary?.total !== undefined);
  assert.equal(body.safety?.readOnly, true);
  assert.equal(body.safety?.rendersVideo, false);
  assert.equal(body.safety?.callsFfmpeg, false);
  assert.equal(body.safety?.generatesFiles, false);
  assert.equal(body.safety?.callsExternalAI, false);
  assert.equal(body.safety?.publishesContent, false);
  assert.equal(body.safety?.writesToMind, false);
  assert.ok(Array.isArray(body.plans));
});

test('GET /video-orchestrator/assembly-plan/:id returns a single assembly plan', async () => {
  const listResponse = await exercise({ method: 'GET', url: '/video-orchestrator/assembly-plan' });
  const listBody = JSON.parse(listResponse.body) as {
    plans?: Array<{ id: string; voiceoverPlanId: string }>;
  };
  const firstPlan = listBody.plans?.[0];
  assert.ok(firstPlan?.voiceoverPlanId);

  const response = await exercise({
    method: 'GET',
    url: `/video-orchestrator/assembly-plan/${encodeURIComponent(firstPlan.voiceoverPlanId)}`,
  });
  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body) as {
    plan?: {
      timeline?: Array<{ safety?: Record<string, unknown>; placeholder?: string }>;
      safety?: Record<string, unknown>;
    };
  };
  assert.ok(body.plan?.timeline);
  assert.ok(Array.isArray(body.plan.timeline));

  for (const item of body.plan.timeline ?? []) {
    assert.equal(item.safety?.readOnly, true);
    assert.equal(item.safety?.rendersVideo, false);
    assert.equal(item.safety?.callsFfmpeg, false);
    assert.equal(item.safety?.generatesFiles, false);
    assert.ok(item.placeholder?.includes('placeholder'));
  }

  assert.equal(body.plan?.safety?.readOnly, true);
  assert.equal(body.plan?.safety?.rendersVideo, false);
  assert.equal(body.plan?.safety?.callsFfmpeg, false);
});

test('GET /video-orchestrator/assembly-plan/:id with unknown id returns 404', async () => {
  const response = await exercise({
    method: 'GET',
    url: '/video-orchestrator/assembly-plan/unknown-assembly-plan-id',
  });
  assert.equal(response.statusCode, 404);

  const body = JSON.parse(response.body) as { error?: { code: string; message: string } };
  assert.equal(body.error?.code, 'not_found');
  assert.ok(body.error?.message.includes('assembly plan'));
});

test('GET /video-orchestrator/metadata-plan returns plans with safety flags', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/metadata-plan' });
  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body) as {
    id: string;
    summary?: { total: number };
    safety?: Record<string, unknown>;
    plans?: Array<{ safety?: Record<string, unknown> }>;
  };
  assert.equal(body.id, 'video-orchestrator-metadata-plan');
  assert.ok(body.summary?.total !== undefined);
  assert.equal(body.safety?.readOnly, true);
  assert.equal(body.safety?.generatesSeoCopy, false);
  assert.equal(body.safety?.callsExternalAI, false);
  assert.equal(body.safety?.callsPlatformApi, false);
  assert.equal(body.safety?.schedulesPost, false);
  assert.equal(body.safety?.publishesContent, false);
  assert.equal(body.safety?.writesFiles, false);
  assert.equal(body.safety?.writesToMind, false);
  assert.ok(Array.isArray(body.plans));
});

test('GET /video-orchestrator/metadata-plan/:id returns a single metadata plan', async () => {
  const listResponse = await exercise({ method: 'GET', url: '/video-orchestrator/metadata-plan' });
  const listBody = JSON.parse(listResponse.body) as {
    plans?: Array<{ id: string; intakePlanId: string }>;
  };
  const firstPlan = listBody.plans?.[0];
  assert.ok(firstPlan?.intakePlanId);

  const response = await exercise({
    method: 'GET',
    url: `/video-orchestrator/metadata-plan/${encodeURIComponent(firstPlan.intakePlanId)}`,
  });
  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body) as {
    plan?: {
      platforms?: Array<{ safety?: Record<string, unknown>; titlePlaceholder?: string }>;
      safety?: Record<string, unknown>;
    };
  };
  assert.ok(body.plan?.platforms);
  assert.ok(Array.isArray(body.plan.platforms));

  for (const platform of body.plan.platforms ?? []) {
    assert.equal(platform.safety?.readOnly, true);
    assert.equal(platform.safety?.generatesSeoCopy, false);
    assert.equal(platform.safety?.callsExternalAI, false);
    assert.equal(platform.safety?.callsPlatformApi, false);
    assert.ok(platform.titlePlaceholder?.includes('placeholder'));
  }

  assert.equal(body.plan?.safety?.readOnly, true);
  assert.equal(body.plan?.safety?.generatesSeoCopy, false);
  assert.equal(body.plan?.safety?.callsExternalAI, false);
});

test('GET /video-orchestrator/metadata-plan/:id with unknown id returns 404', async () => {
  const response = await exercise({
    method: 'GET',
    url: '/video-orchestrator/metadata-plan/unknown-metadata-plan-id',
  });
  assert.equal(response.statusCode, 404);

  const body = JSON.parse(response.body) as { error?: { code: string; message: string } };
  assert.equal(body.error?.code, 'not_found');
  assert.ok(body.error?.message.includes('metadata plan'));
});

test('GET /video-orchestrator/publishing-prep returns plans with safety flags', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/publishing-prep' });
  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body) as {
    id: string;
    summary?: { total: number };
    safety?: Record<string, unknown>;
    plans?: Array<{ safety?: Record<string, unknown> }>;
  };
  assert.equal(body.id, 'video-orchestrator-publishing-prep');
  assert.ok(body.summary?.total !== undefined);
  assert.equal(body.safety?.readOnly, true);
  assert.equal(body.safety?.callsPlatformApi, false);
  assert.equal(body.safety?.schedulesPost, false);
  assert.equal(body.safety?.publishesContent, false);
  assert.equal(body.safety?.writesFiles, false);
  assert.equal(body.safety?.writesToMind, false);
  assert.ok(Array.isArray(body.plans));
});

test('GET /video-orchestrator/publishing-prep/:id returns a single publishing prep plan', async () => {
  const listResponse = await exercise({ method: 'GET', url: '/video-orchestrator/publishing-prep' });
  const listBody = JSON.parse(listResponse.body) as {
    plans?: Array<{ id: string; intakePlanId: string }>;
  };
  const firstPlan = listBody.plans?.[0];
  assert.ok(firstPlan?.intakePlanId);

  const response = await exercise({
    method: 'GET',
    url: `/video-orchestrator/publishing-prep/${encodeURIComponent(firstPlan.intakePlanId)}`,
  });
  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body) as {
    plan?: {
      platforms?: Array<{ safety?: Record<string, unknown>; checklist?: Array<{ placeholder?: string }> }>;
      safety?: Record<string, unknown>;
    };
  };
  assert.ok(body.plan?.platforms);
  assert.ok(Array.isArray(body.plan.platforms));

  for (const platform of body.plan.platforms ?? []) {
    assert.equal(platform.safety?.readOnly, true);
    assert.equal(platform.safety?.callsPlatformApi, false);
    assert.equal(platform.safety?.schedulesPost, false);
    assert.ok(Array.isArray(platform.checklist));
    for (const item of platform.checklist ?? []) {
      assert.ok(item.placeholder?.includes('placeholder'));
    }
  }

  assert.equal(body.plan?.safety?.readOnly, true);
  assert.equal(body.plan?.safety?.callsPlatformApi, false);
  assert.equal(body.plan?.safety?.schedulesPost, false);
});

test('GET /video-orchestrator/publishing-prep/:id with unknown id returns 404', async () => {
  const response = await exercise({
    method: 'GET',
    url: '/video-orchestrator/publishing-prep/unknown-publishing-prep-id',
  });
  assert.equal(response.statusCode, 404);

  const body = JSON.parse(response.body) as { error?: { code: string; message: string } };
  assert.equal(body.error?.code, 'not_found');
  assert.ok(body.error?.message.includes('publishing prep plan'));
});

test('GET /video-orchestrator/manual-export-package returns packages with safety flags', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/manual-export-package' });
  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body) as {
    id: string;
    summary?: { total: number };
    safety?: Record<string, unknown>;
    packages?: Array<{ safety?: Record<string, unknown> }>;
  };
  assert.equal(body.id, 'video-orchestrator-manual-export-package');
  assert.ok(body.summary?.total !== undefined);
  assert.equal(body.safety?.readOnly, true);
  assert.equal(body.safety?.writesFiles, false);
  assert.equal(body.safety?.createsDownload, false);
  assert.equal(body.safety?.writesClipboard, false);
  assert.equal(body.safety?.callsPlatformApi, false);
  assert.equal(body.safety?.schedulesPost, false);
  assert.equal(body.safety?.publishesContent, false);
  assert.equal(body.safety?.writesToMind, false);
  assert.ok(Array.isArray(body.packages));
});

test('GET /video-orchestrator/manual-export-package/:id returns a single manual export package', async () => {
  const listResponse = await exercise({ method: 'GET', url: '/video-orchestrator/manual-export-package' });
  const listBody = JSON.parse(listResponse.body) as {
    packages?: Array<{ intakePlanId: string }>;
  };
  const firstPackage = listBody.packages?.[0];
  assert.ok(firstPackage?.intakePlanId);

  const response = await exercise({
    method: 'GET',
    url: `/video-orchestrator/manual-export-package/${encodeURIComponent(firstPackage.intakePlanId)}`,
  });
  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body) as {
    package?: {
      items?: Array<{ safety?: Record<string, unknown>; placeholder?: string }>;
      safety?: Record<string, unknown>;
    };
  };
  assert.ok(body.package?.items);
  assert.ok(Array.isArray(body.package.items));

  for (const item of body.package.items ?? []) {
    assert.equal(item.safety?.readOnly, true);
    assert.equal(item.safety?.writesFiles, false);
    assert.equal(item.safety?.createsDownload, false);
    assert.equal(item.safety?.writesClipboard, false);
    assert.equal(item.safety?.callsPlatformApi, false);
    assert.equal(item.safety?.schedulesPost, false);
    assert.ok(item.placeholder?.includes('placeholder'));
  }

  assert.equal(body.package?.safety?.readOnly, true);
  assert.equal(body.package?.safety?.writesFiles, false);
  assert.equal(body.package?.safety?.createsDownload, false);
  assert.equal(body.package?.safety?.writesClipboard, false);
});

test('GET /video-orchestrator/manual-export-package/:id with unknown id returns 404', async () => {
  const response = await exercise({
    method: 'GET',
    url: '/video-orchestrator/manual-export-package/unknown-export-package-id',
  });
  assert.equal(response.statusCode, 404);

  const body = JSON.parse(response.body) as { error?: { code: string; message: string } };
  assert.equal(body.error?.code, 'not_found');
  assert.ok(body.error?.message.includes('manual export package'));
});

test('GET /stb-video/dual-run-evidence returns evidence report with safety flags', async () => {
  const response = await exercise({ method: 'GET', url: '/stb-video/dual-run-evidence' });
  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body) as {
    evidence?: {
      id: string;
      status: string;
      summary?: { totalStages: number };
      safety?: Record<string, unknown>;
      stages?: Array<{ safety?: Record<string, unknown> }>;
    };
  };
  assert.equal(body.evidence?.id, 'stb-video-dual-run-evidence');
  assert.ok(['not-ready', 'evidence-partial', 'candidate-ready', 'blocked'].includes(body.evidence?.status ?? ''));
  assert.ok(body.evidence?.summary?.totalStages !== undefined);
  assert.equal(body.evidence?.safety?.readOnly, true);
  assert.equal(body.evidence?.safety?.executesStb, false);
  assert.equal(body.evidence?.safety?.executesVideo, false);
  assert.equal(body.evidence?.safety?.writesFiles, false);
  assert.equal(body.evidence?.safety?.publishesContent, false);
  assert.equal(body.evidence?.safety?.decommissionsStb, false);
  assert.equal(body.evidence?.safety?.writesToMind, false);
  assert.ok(Array.isArray(body.evidence?.stages));
});

test('GET /stb-video/dual-run-evidence stages have all expected safety flags', async () => {
  const response = await exercise({ method: 'GET', url: '/stb-video/dual-run-evidence' });
  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body) as {
    evidence?: {
      stages?: Array<{
        stage: string;
        safety?: Record<string, unknown>;
        stbEvidence?: Array<{ safety?: Record<string, unknown> }>;
        videoEvidence?: Array<{ safety?: Record<string, unknown> }>;
      }>;
    };
  };

  for (const stage of body.evidence?.stages ?? []) {
    assert.ok(stage.stage);
    assert.equal(stage.safety?.readOnly, true);
    assert.equal(stage.safety?.executesStb, false);
    assert.equal(stage.safety?.executesVideo, false);
    assert.equal(stage.safety?.writesFiles, false);
    assert.equal(stage.safety?.publishesContent, false);
    assert.equal(stage.safety?.writesToMind, false);

    for (const item of [...(stage.stbEvidence ?? []), ...(stage.videoEvidence ?? [])]) {
      assert.equal(item.safety?.readOnly, true);
      assert.equal(item.safety?.executesStb, false);
      assert.equal(item.safety?.executesVideo, false);
      assert.equal(item.safety?.writesFiles, false);
      assert.equal(item.safety?.publishesContent, false);
      assert.equal(item.safety?.writesToMind, false);
    }
  }
});

test('GET /stb-video/dual-run-evidence shows parityReady false (no real execution)', async () => {
  const response = await exercise({ method: 'GET', url: '/stb-video/dual-run-evidence' });
  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body) as {
    evidence?: {
      stages?: Array<{
        comparison?: {
          parityReady: boolean;
        };
      }>;
    };
  };

  for (const stage of body.evidence?.stages ?? []) {
    assert.equal(stage.comparison?.parityReady, false);
  }
});

test('GET /video-orchestrator/production-gate returns production gate checklist', async () => {
  const response = await exercise({
    method: 'GET',
    url: '/video-orchestrator/production-gate',
  });
  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body) as {
    gate?: {
      id: string;
      status: string;
      readinessPercent: number;
      sections: Array<{
        id: string;
        label: string;
        category: string;
        items: Array<{
          id: string;
          status: string;
          severity: string;
        }>;
      }>;
      summary: {
        totalItems: number;
        readyItems: number;
        blockedItems: number;
      };
      blockers: string[];
      criticalBlockers: string[];
    };
  };

  assert.equal(body.gate?.id, 'video-production-gate');
  assert(body.gate?.sections && body.gate.sections.length > 0);
  assert.equal(body.gate.sections.length, 5);
  assert.ok(body.gate.summary);
});

test('GET /video-orchestrator/production-gate status is blocked or not-ready (not production ready)', async () => {
  const response = await exercise({
    method: 'GET',
    url: '/video-orchestrator/production-gate',
  });
  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body) as {
    gate?: {
      status: string;
    };
  };

  assert(body.gate?.status === 'blocked' || body.gate?.status === 'not-ready' || body.gate?.status === 'in-progress');
  assert.notEqual(body.gate?.status, 'ready');
});

test('GET /video-orchestrator/production-gate readinessPercent is below 100', async () => {
  const response = await exercise({
    method: 'GET',
    url: '/video-orchestrator/production-gate',
  });
  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body) as {
    gate?: {
      readinessPercent: number;
    };
  };

  assert.ok(body.gate?.readinessPercent !== undefined);
  assert(body.gate?.readinessPercent < 100);
});

test('GET /video-orchestrator/production-gate has expected sections', async () => {
  const response = await exercise({
    method: 'GET',
    url: '/video-orchestrator/production-gate',
  });
  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body) as {
    gate?: {
      sections: Array<{ category: string }>;
    };
  };

  const categories = body.gate?.sections?.map(s => s.category) ?? [];
  assert.ok(categories.includes('planning-chain'));
  assert.ok(categories.includes('dual-run-evidence'));
  assert.ok(categories.includes('rendering-export'));
  assert.ok(categories.includes('publishing-platform'));
  assert.ok(categories.includes('safety-approval'));
});

test('GET /video-orchestrator/production-gate has blocking items (not fully ready)', async () => {
  const response = await exercise({
    method: 'GET',
    url: '/video-orchestrator/production-gate',
  });
  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body) as {
    gate?: {
      summary: {
        blockedItems: number;
      };
      blockers: string[];
    };
  };

  assert.ok(body.gate?.summary?.blockedItems && body.gate.summary.blockedItems > 0);
  assert(body.gate?.blockers && body.gate.blockers.length > 0);
});

test('GET /video-orchestrator/production-gate has safety flags all disabled', async () => {
  const response = await exercise({
    method: 'GET',
    url: '/video-orchestrator/production-gate',
  });
  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body) as {
    gate?: {
      safety: {
        readOnly: boolean;
        executesStb: boolean;
        executesVideo: boolean;
        rendersVideo: boolean;
        publishesContent: boolean;
      };
    };
  };

  assert.equal(body.gate?.safety?.readOnly, true);
  assert.equal(body.gate?.safety?.executesStb, false);
  assert.equal(body.gate?.safety?.executesVideo, false);
  assert.equal(body.gate?.safety?.rendersVideo, false);
  assert.equal(body.gate?.safety?.publishesContent, false);
});

test('GET /video-orchestrator/production-gate documents STB decommission is blocked', async () => {
  const response = await exercise({
    method: 'GET',
    url: '/video-orchestrator/production-gate',
  });
  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body) as {
    gate?: {
      blockers: string[];
      criticalBlockers: string[];
      sections: Array<{
        items: Array<{ id: string; label: string }>;
      }>;
    };
  };

  const allItems = body.gate?.sections?.flatMap(s => s.items) ?? [];
  const stbDecommissionItem = allItems.find(i => i.id?.includes('stb-decommission'));
  assert.ok(stbDecommissionItem, 'STB decommission blocking item should exist');

  assert.ok(
    body.gate?.blockers?.some(b => b.toLowerCase().includes('stb')) ||
    body.gate?.criticalBlockers?.some(b => b.toLowerCase().includes('stb')),
    'Should document STB decommission as blocker'
  );
});

test('GET /video-orchestrator/production-gate has no executable operations implied', async () => {
  const response = await exercise({
    method: 'GET',
    url: '/video-orchestrator/production-gate',
  });
  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body) as {
    gate?: {
      sections: Array<{
        items: Array<{ safety: Record<string, boolean> }>;
      }>;
    };
  };

  const allItems = body.gate?.sections?.flatMap(s => s.items) ?? [];
  for (const item of allItems) {
    assert.equal(item.safety?.rendersVideo, false, 'Item should not imply video rendering');
    assert.equal(item.safety?.exportsArtifact, false, 'Item should not imply artifact export');
    assert.equal(item.safety?.publishesContent, false, 'Item should not imply publishing');
  }
});

test('GET /stb-video/controlled-dual-run-request returns request design', async () => {
  const response = await exercise({
    method: 'GET',
    url: '/stb-video/controlled-dual-run-request',
  });
  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body) as {
    design?: {
      id: string;
      status: string;
      canRequestApproval: boolean;
      canExecute: boolean;
      requirements: Array<{ id: string; label: string }>;
      lifecycle: Array<{ id: string; label: string }>;
      summary: { totalRequirements: number };
    };
  };

  assert.equal(body.design?.id, 'controlled-dual-run-request-design');
  assert(body.design?.requirements && body.design.requirements.length > 0);
  assert(body.design?.lifecycle && body.design.lifecycle.length > 0);
});

test('GET /stb-video/controlled-dual-run-request canRequestApproval is false', async () => {
  const response = await exercise({
    method: 'GET',
    url: '/stb-video/controlled-dual-run-request',
  });
  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body) as { design?: { canRequestApproval: boolean } };
  assert.equal(body.design?.canRequestApproval, false);
});

test('GET /stb-video/controlled-dual-run-request canExecute is false', async () => {
  const response = await exercise({
    method: 'GET',
    url: '/stb-video/controlled-dual-run-request',
  });
  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body) as { design?: { canExecute: boolean } };
  assert.equal(body.design?.canExecute, false);
});

test('GET /stb-video/controlled-dual-run-request executableActionRegistered is false', async () => {
  const response = await exercise({
    method: 'GET',
    url: '/stb-video/controlled-dual-run-request',
  });
  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body) as { design?: { safety: { executableActionRegistered: boolean } } };
  assert.equal(body.design?.safety?.executableActionRegistered, false);
});

test('GET /stb-video/controlled-dual-run-request status is design-only or blocked (not executable)', async () => {
  const response = await exercise({
    method: 'GET',
    url: '/stb-video/controlled-dual-run-request',
  });
  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body) as { design?: { status: string } };
  assert(body.design?.status === 'design-only' || body.design?.status === 'blocked');
  assert.notEqual(body.design?.status, 'executable');
});

test('GET /stb-video/controlled-dual-run-request has blocked requirements', async () => {
  const response = await exercise({
    method: 'GET',
    url: '/stb-video/controlled-dual-run-request',
  });
  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body) as {
    design?: {
      requirements: Array<{ status: string; severity: string }>;
      summary: { blockedCount: number; blockingSeverityCount: number };
    };
  };

  assert(body.design?.summary?.blockedCount && body.design.summary.blockedCount > 0);
  assert(body.design?.summary?.blockingSeverityCount && body.design.summary.blockingSeverityCount > 0);

  const hasBlocked = body.design?.requirements?.some(r => r.status === 'blocked') ?? false;
  assert(hasBlocked, 'Should have at least one blocked requirement');
});

test('GET /stb-video/controlled-dual-run-request lifecycle steps have blocked status', async () => {
  const response = await exercise({
    method: 'GET',
    url: '/stb-video/controlled-dual-run-request',
  });
  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body) as {
    design?: {
      lifecycle: Array<{ status: string; blockers: string[] }>;
    };
  };

  const hasBlockedStep = body.design?.lifecycle?.some(s => s.status === 'blocked') ?? false;
  assert(hasBlockedStep, 'Should have at least one blocked lifecycle step');
});

test('GET /stb-video/controlled-dual-run-request all requirements and steps have safety flags false', async () => {
  const response = await exercise({
    method: 'GET',
    url: '/stb-video/controlled-dual-run-request',
  });
  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body) as {
    design?: {
      requirements: Array<{ safety: Record<string, boolean> }>;
      lifecycle: Array<{ safety: Record<string, boolean> }>;
    };
  };

  const allReqs = body.design?.requirements ?? [];
  for (const req of allReqs) {
    assert.equal(req.safety?.readOnly, true, 'Requirement readOnly should be true');
    assert.equal(req.safety?.createsApproval, false, 'Requirement createsApproval should be false');
    assert.equal(req.safety?.executesStb, false, 'Requirement executesStb should be false');
    assert.equal(req.safety?.executesVideo, false, 'Requirement executesVideo should be false');
  }

  const allSteps = body.design?.lifecycle ?? [];
  for (const step of allSteps) {
    assert.equal(step.safety?.readOnly, true, 'Step readOnly should be true');
    assert.equal(step.safety?.createsApproval, false, 'Step createsApproval should be false');
    assert.equal(step.safety?.executesStb, false, 'Step executesStb should be false');
    assert.equal(step.safety?.executesVideo, false, 'Step executesVideo should be false');
  }
});

test('No POST route exists for controlled dual-run request', async () => {
  const response = await exercise({
    method: 'POST',
    url: '/stb-video/controlled-dual-run-request',
  });

  assert.notEqual(response.statusCode, 200, 'POST should not succeed for design-only module');
  assert(response.statusCode === 405 || response.statusCode === 404, 'Should reject POST method');
});

test('GET /video-orchestrator/render-export-policy returns policy', async () => {
  const response = await exercise({
    method: 'GET',
    url: '/video-orchestrator/render-export-policy',
  });
  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body) as {
    policy?: {
      id: string;
      status: string;
      sections: Array<{ id: string; title: string }>;
      summary: { totalItems: number };
    };
  };

  assert.equal(body.policy?.id, 'video-orchestrator-render-export-policy');
  assert.ok(body.policy?.summary.totalItems && body.policy.summary.totalItems > 0);
  assert.ok(Array.isArray(body.policy?.sections));
});

test('No POST route exists for render/export policy', async () => {
  const response = await exercise({
    method: 'POST',
    url: '/video-orchestrator/render-export-policy',
  });

  assert.notEqual(response.statusCode, 200, 'POST should not succeed for policy-only module');
  assert(response.statusCode === 404 || response.statusCode === 405, 'Should reject POST method');
});

test('GET /video-orchestrator/render-export-policy cannot render/export or register executable action', async () => {
  const response = await exercise({
    method: 'GET',
    url: '/video-orchestrator/render-export-policy',
  });
  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body) as {
    policy?: {
      status: string;
      canRender: boolean;
      canExport: boolean;
      executableActionRegistered: boolean;
      summary: { blockedCount: number };
    };
  };

  assert.equal(body.policy?.canRender, false);
  assert.equal(body.policy?.canExport, false);
  assert.equal(body.policy?.executableActionRegistered, false);
  assert.ok(body.policy?.status === 'policy-only' || body.policy?.status === 'blocked');
  assert.notEqual(body.policy?.status, 'executable');
  assert.ok(body.policy?.summary.blockedCount && body.policy.summary.blockedCount > 0);
});

test('GET /video-orchestrator/render-export-policy has expected sections', async () => {
  const response = await exercise({
    method: 'GET',
    url: '/video-orchestrator/render-export-policy',
  });
  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body) as {
    policy?: {
      sections: Array<{ id: string; title: string; status: string }>;
    };
  };

  const sectionIds = body.policy?.sections.map(section => section.id) ?? [];
  assert.ok(sectionIds.includes('rendering-engine'));
  assert.ok(sectionIds.includes('export-package'));
  assert.ok(sectionIds.includes('artifact-sandbox'));
  assert.ok(sectionIds.includes('approval-rollback'));
  assert.ok(sectionIds.includes('safety'));
});

test('GET /video-orchestrator/render-export-policy every item has disabled safety flags', async () => {
  const response = await exercise({
    method: 'GET',
    url: '/video-orchestrator/render-export-policy',
  });
  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body) as {
    policy?: {
      sections: Array<{
        items: Array<{ safety: Record<string, boolean> }>;
      }>;
    };
  };

  const allItems = body.policy?.sections.flatMap(section => section.items) ?? [];
  assert.ok(allItems.length > 0, 'Policy should include checklist items');

  for (const item of allItems) {
    assert.equal(item.safety.readOnly, true);
    assert.equal(item.safety.rendersVideo, false);
    assert.equal(item.safety.callsFfmpeg, false);
    assert.equal(item.safety.writesFiles, false);
    assert.equal(item.safety.createsDownload, false);
    assert.equal(item.safety.createsApproval, false);
    assert.equal(item.safety.publishesContent, false);
    assert.equal(item.safety.writesToMind, false);
  }
});

test('Render/export policy has no executable action in action registry or execution plans', async () => {
  const actionsResponse = await exercise({ method: 'GET', url: '/actions' });
  const actionsBody = JSON.parse(actionsResponse.body) as {
    actions: Array<{ id: string; kind: string; label: string }>;
  };
  const plansResponse = await exercise({ method: 'GET', url: '/execution/plans' });
  const plansBody = JSON.parse(plansResponse.body) as {
    plans: Array<{ kind: string; label?: string }>;
  };

  const executableTerms = /render-export|render-video|export-video|run-render|execute-render/i;
  assert.equal(actionsBody.actions.some(action => executableTerms.test(`${action.id} ${action.kind} ${action.label}`)), false);
  assert.equal(plansBody.plans.some(plan => executableTerms.test(`${plan.kind} ${plan.label ?? ''}`)), false);
});

test('Render/export policy keeps production gate blocked/not-ready', async () => {
  const policyResponse = await exercise({
    method: 'GET',
    url: '/video-orchestrator/render-export-policy',
  });
  const gateResponse = await exercise({
    method: 'GET',
    url: '/video-orchestrator/production-gate',
  });

  assert.equal(policyResponse.statusCode, 200);
  assert.equal(gateResponse.statusCode, 200);

  const gateBody = JSON.parse(gateResponse.body) as {
    gate?: { status: string; readinessPercent: number; summary: { blockedItems: number } };
  };

  assert.ok(gateBody.gate?.status === 'blocked' || gateBody.gate?.status === 'not-ready');
  assert.ok(gateBody.gate.summary.blockedItems > 0);
  assert.ok(gateBody.gate.readinessPercent < 100);
});


test('GET /video-orchestrator/approval-policy-design returns design-only policy', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/approval-policy-design' });
  const body = JSON.parse(response.body) as {
    policy: {
      id: string;
      status: string;
      canCreateApproval: boolean;
      canRegisterAction: boolean;
      canExecute: boolean;
      requirements: Array<{ status: string; severity: string; safety: Record<string, boolean> }>;
      lifecycle: Array<{ status: string; safety: Record<string, boolean> }>;
      summary: { totalRequirements: number; blockedCount: number; missingCount: number; blockingSeverityCount: number };
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.policy.id, 'video-orchestrator-approval-policy-design');
  assert.ok(['policy-only', 'blocked', 'ready-for-review'].includes(body.policy.status));
  assert.equal(body.policy.canCreateApproval, false);
  assert.equal(body.policy.canRegisterAction, false);
  assert.equal(body.policy.canExecute, false);
  assert.ok(body.policy.summary.totalRequirements > 0);
  assert.ok(body.policy.summary.blockedCount > 0 || body.policy.summary.missingCount > 0);
  assert.ok(body.policy.summary.blockingSeverityCount > 0);
  assert.equal(body.policy.safety.readOnly, true);
  assert.equal(body.policy.safety.createsApproval, false);
  assert.equal(body.policy.safety.executableActionRegistered, false);
  assert.equal(body.policy.safety.executesStb, false);
  assert.equal(body.policy.safety.executesVideo, false);
  assert.equal(body.policy.safety.writesFiles, false);
  assert.equal(body.policy.safety.publishesContent, false);
  assert.equal(body.policy.safety.decommissionsStb, false);
  assert.equal(body.policy.safety.writesToMind, false);

  body.policy.requirements.forEach(requirement => {
    assert.equal(requirement.safety.readOnly, true);
    assert.equal(requirement.safety.createsApproval, false);
    assert.equal(requirement.safety.registersAction, false);
    assert.equal(requirement.safety.executesStb, false);
    assert.equal(requirement.safety.executesVideo, false);
    assert.equal(requirement.safety.writesFiles, false);
    assert.equal(requirement.safety.publishesContent, false);
    assert.equal(requirement.safety.writesToMind, false);
  });

  body.policy.lifecycle.forEach(step => {
    assert.equal(step.safety.readOnly, true);
    assert.equal(step.safety.createsApproval, false);
    assert.equal(step.safety.registersAction, false);
    assert.equal(step.safety.executesStb, false);
    assert.equal(step.safety.executesVideo, false);
    assert.equal(step.safety.writesFiles, false);
    assert.equal(step.safety.publishesContent, false);
    assert.equal(step.safety.writesToMind, false);
  });
});

test('POST /video-orchestrator/approval-policy-design is not available', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/approval-policy-design' });
  const body = JSON.parse(response.body) as { error: { code: string; message: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});


test('GET /video-orchestrator/artifact-sandbox-design returns read-only sandbox design', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/artifact-sandbox-design' });
  const body = JSON.parse(response.body) as {
    sandbox: {
      id: string;
      status: string;
      canCreateSandbox: boolean;
      canWriteFiles: boolean;
      canCleanup: boolean;
      executableActionRegistered: boolean;
      policyItems: Array<{ status: string; severity: string; safety: Record<string, boolean> }>;
      boundaries: Array<{ status: string; pathPolicy: Record<string, boolean | string>; safety: Record<string, boolean> }>;
      summary: { totalPolicyItems: number; blockedCount: number; missingCount: number; blockingSeverityCount: number; boundaryCount: number };
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.sandbox.id, 'video-orchestrator-artifact-sandbox-design');
  assert.ok(['design-only', 'blocked', 'ready-for-review'].includes(body.sandbox.status));
  assert.equal(body.sandbox.canCreateSandbox, false);
  assert.equal(body.sandbox.canWriteFiles, false);
  assert.equal(body.sandbox.canCleanup, false);
  assert.equal(body.sandbox.executableActionRegistered, false);
  assert.ok(body.sandbox.summary.totalPolicyItems > 0);
  assert.ok(body.sandbox.summary.boundaryCount > 0);
  assert.ok(body.sandbox.summary.blockedCount > 0 || body.sandbox.summary.missingCount > 0);
  assert.ok(body.sandbox.summary.blockingSeverityCount > 0);
  assert.equal(body.sandbox.safety.readOnly, true);
  assert.equal(body.sandbox.safety.createsDirectory, false);
  assert.equal(body.sandbox.safety.writesFiles, false);
  assert.equal(body.sandbox.safety.deletesFiles, false);
  assert.equal(body.sandbox.safety.rendersVideo, false);
  assert.equal(body.sandbox.safety.createsDownload, false);
  assert.equal(body.sandbox.safety.createsApproval, false);
  assert.equal(body.sandbox.safety.executableActionRegistered, false);
  assert.equal(body.sandbox.safety.publishesContent, false);
  assert.equal(body.sandbox.safety.decommissionsStb, false);
  assert.equal(body.sandbox.safety.writesToMind, false);

  body.sandbox.policyItems.forEach(item => {
    assert.equal(item.safety.readOnly, true);
    assert.equal(item.safety.createsDirectory, false);
    assert.equal(item.safety.writesFiles, false);
    assert.equal(item.safety.deletesFiles, false);
    assert.equal(item.safety.rendersVideo, false);
    assert.equal(item.safety.createsDownload, false);
    assert.equal(item.safety.callsExternalAI, false);
    assert.equal(item.safety.publishesContent, false);
    assert.equal(item.safety.writesToMind, false);
  });

  body.sandbox.boundaries.forEach(boundary => {
    assert.equal(boundary.pathPolicy.requiresRelativePaths, true);
    assert.equal(boundary.pathPolicy.forbidsTraversal, true);
    assert.equal(boundary.pathPolicy.forbidsAbsolutePaths, true);
    assert.equal(boundary.pathPolicy.validatesExtensions, true);
    assert.equal(boundary.safety.createsDirectory, false);
    assert.equal(boundary.safety.writesFiles, false);
    assert.equal(boundary.safety.deletesFiles, false);
    assert.equal(boundary.safety.rendersVideo, false);
    assert.equal(boundary.safety.createsDownload, false);
    assert.equal(boundary.safety.publishesContent, false);
    assert.equal(boundary.safety.writesToMind, false);
  });
});

test('POST /video-orchestrator/artifact-sandbox-design is not available', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/artifact-sandbox-design' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});


test('GET /video-orchestrator/controlled-dry-run-design returns read-only design', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/controlled-dry-run-design' });
  const body = JSON.parse(response.body) as {
    dryRun: {
      id: string;
      status: string;
      canExecuteDryRun: boolean;
      canReadStbOutputs: boolean;
      canReadVideoOutputs: boolean;
      canWriteEvidence: boolean;
      executableActionRegistered: boolean;
      steps: Array<{ status: string; requiredBeforeExecution: boolean; safety: Record<string, boolean> }>;
      summary: { totalSteps: number; plannedCount: number; blockedCount: number; requiredBeforeExecutionCount: number };
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.dryRun.id, 'video-orchestrator-controlled-dry-run-design');
  assert.ok(['design-only', 'blocked', 'ready-for-review'].includes(body.dryRun.status));
  assert.equal(body.dryRun.canExecuteDryRun, false);
  assert.equal(body.dryRun.canReadStbOutputs, false);
  assert.equal(body.dryRun.canReadVideoOutputs, false);
  assert.equal(body.dryRun.canWriteEvidence, false);
  assert.equal(body.dryRun.executableActionRegistered, false);
  assert.ok(body.dryRun.summary.totalSteps > 0);
  assert.ok(body.dryRun.summary.blockedCount > 0);
  assert.equal(body.dryRun.summary.requiredBeforeExecutionCount, body.dryRun.summary.totalSteps);
  assert.equal(body.dryRun.safety.readOnly, true);
  assert.equal(body.dryRun.safety.executesStb, false);
  assert.equal(body.dryRun.safety.executesVideo, false);
  assert.equal(body.dryRun.safety.rendersVideo, false);
  assert.equal(body.dryRun.safety.callsFfmpeg, false);
  assert.equal(body.dryRun.safety.writesFiles, false);
  assert.equal(body.dryRun.safety.createsApproval, false);
  assert.equal(body.dryRun.safety.executableActionRegistered, false);
  assert.equal(body.dryRun.safety.publishesContent, false);
  assert.equal(body.dryRun.safety.decommissionsStb, false);
  assert.equal(body.dryRun.safety.writesToMind, false);

  body.dryRun.steps.forEach(step => {
    assert.equal(step.requiredBeforeExecution, true);
    assert.equal(step.safety.readOnly, true);
    assert.equal(step.safety.executesStb, false);
    assert.equal(step.safety.executesVideo, false);
    assert.equal(step.safety.rendersVideo, false);
    assert.equal(step.safety.writesFiles, false);
    assert.equal(step.safety.createsApproval, false);
    assert.equal(step.safety.publishesContent, false);
    assert.equal(step.safety.writesToMind, false);
  });
});

test('POST /video-orchestrator/controlled-dry-run-design is not available', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/controlled-dry-run-design' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});


test('GET /video-orchestrator/rollback-cleanup-checklist returns read-only checklist', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/rollback-cleanup-checklist' });
  const body = JSON.parse(response.body) as {
    checklist: {
      id: string;
      status: string;
      canRollback: boolean;
      canCleanup: boolean;
      canDeleteFiles: boolean;
      executableActionRegistered: boolean;
      items: Array<{ status: string; severity: string; safety: Record<string, boolean> }>;
      summary: { totalItems: number; blockedCount: number; missingCount: number; blockingSeverityCount: number };
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.checklist.id, 'video-orchestrator-rollback-cleanup-checklist');
  assert.ok(['checklist-only', 'blocked', 'ready-for-review'].includes(body.checklist.status));
  assert.equal(body.checklist.canRollback, false);
  assert.equal(body.checklist.canCleanup, false);
  assert.equal(body.checklist.canDeleteFiles, false);
  assert.equal(body.checklist.executableActionRegistered, false);
  assert.ok(body.checklist.summary.totalItems > 0);
  assert.ok(body.checklist.summary.blockedCount > 0 || body.checklist.summary.missingCount > 0);
  assert.ok(body.checklist.summary.blockingSeverityCount > 0);
  assert.equal(body.checklist.safety.readOnly, true);
  assert.equal(body.checklist.safety.deletesFiles, false);
  assert.equal(body.checklist.safety.writesFiles, false);
  assert.equal(body.checklist.safety.executesCleanup, false);
  assert.equal(body.checklist.safety.executesRollback, false);
  assert.equal(body.checklist.safety.createsApproval, false);
  assert.equal(body.checklist.safety.executableActionRegistered, false);
  assert.equal(body.checklist.safety.publishesContent, false);
  assert.equal(body.checklist.safety.decommissionsStb, false);
  assert.equal(body.checklist.safety.writesToMind, false);

  body.checklist.items.forEach(item => {
    assert.equal(item.safety.readOnly, true);
    assert.equal(item.safety.deletesFiles, false);
    assert.equal(item.safety.writesFiles, false);
    assert.equal(item.safety.executesCleanup, false);
    assert.equal(item.safety.executesRollback, false);
    assert.equal(item.safety.createsApproval, false);
    assert.equal(item.safety.publishesContent, false);
    assert.equal(item.safety.decommissionsStb, false);
    assert.equal(item.safety.writesToMind, false);
  });
});

test('POST /video-orchestrator/rollback-cleanup-checklist is not available', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/rollback-cleanup-checklist' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});


test('GET /video-orchestrator/comparison-schema-design returns read-only schema', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/comparison-schema-design' });
  const body = JSON.parse(response.body) as {
    schema: {
      id: string;
      status: string;
      canCompareOutputs: boolean;
      canReadGeneratedArtifacts: boolean;
      canWriteEvidence: boolean;
      executableActionRegistered: boolean;
      fields: Array<{ status: string; comparisonMode: string; safety: Record<string, boolean> }>;
      summary: { totalFields: number; definedCount: number; blockedCount: number; blockingSeverityCount: number };
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.schema.id, 'video-orchestrator-comparison-schema-design');
  assert.ok(['schema-only', 'blocked', 'ready-for-review'].includes(body.schema.status));
  assert.equal(body.schema.canCompareOutputs, false);
  assert.equal(body.schema.canReadGeneratedArtifacts, false);
  assert.equal(body.schema.canWriteEvidence, false);
  assert.equal(body.schema.executableActionRegistered, false);
  assert.ok(body.schema.summary.totalFields > 0);
  assert.ok(body.schema.summary.definedCount > 0);
  assert.ok(body.schema.summary.blockedCount > 0);
  assert.ok(body.schema.summary.blockingSeverityCount > 0);
  assert.equal(body.schema.safety.readOnly, true);
  assert.equal(body.schema.safety.readsGeneratedArtifacts, false);
  assert.equal(body.schema.safety.executesComparison, false);
  assert.equal(body.schema.safety.executesStb, false);
  assert.equal(body.schema.safety.executesVideo, false);
  assert.equal(body.schema.safety.writesFiles, false);
  assert.equal(body.schema.safety.createsApproval, false);
  assert.equal(body.schema.safety.executableActionRegistered, false);
  assert.equal(body.schema.safety.publishesContent, false);
  assert.equal(body.schema.safety.decommissionsStb, false);
  assert.equal(body.schema.safety.writesToMind, false);

  body.schema.fields.forEach(field => {
    assert.equal(field.safety.readOnly, true);
    assert.equal(field.safety.readsGeneratedArtifacts, false);
    assert.equal(field.safety.executesComparison, false);
    assert.equal(field.safety.executesStb, false);
    assert.equal(field.safety.executesVideo, false);
    assert.equal(field.safety.writesFiles, false);
    assert.equal(field.safety.createsApproval, false);
    assert.equal(field.safety.publishesContent, false);
    assert.equal(field.safety.writesToMind, false);
  });
});

test('POST /video-orchestrator/comparison-schema-design is not available', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/comparison-schema-design' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});


test('GET /video-orchestrator/fixture-comparison-preview returns read-only preview', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/fixture-comparison-preview' });
  const body = JSON.parse(response.body) as {
    preview: {
      id: string;
      status: string;
      canCompareRealOutputs: boolean;
      canReadGeneratedArtifacts: boolean;
      canWriteEvidence: boolean;
      executableActionRegistered: boolean;
      items: Array<{ status: string; previewResult: string; safety: Record<string, boolean> }>;
      summary: { totalItems: number; previewAvailableCount: number; blockedCount: number; manualReviewCount: number };
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.preview.id, 'video-orchestrator-fixture-comparison-preview');
  assert.ok(['preview-only', 'blocked', 'ready-for-review'].includes(body.preview.status));
  assert.equal(body.preview.canCompareRealOutputs, false);
  assert.equal(body.preview.canReadGeneratedArtifacts, false);
  assert.equal(body.preview.canWriteEvidence, false);
  assert.equal(body.preview.executableActionRegistered, false);
  assert.ok(body.preview.summary.totalItems > 0);
  assert.ok(body.preview.summary.previewAvailableCount > 0);
  assert.ok(body.preview.summary.blockedCount > 0);
  assert.equal(body.preview.safety.readOnly, true);
  assert.equal(body.preview.safety.comparesRealOutputs, false);
  assert.equal(body.preview.safety.readsGeneratedArtifacts, false);
  assert.equal(body.preview.safety.executesStb, false);
  assert.equal(body.preview.safety.executesVideo, false);
  assert.equal(body.preview.safety.writesEvidence, false);
  assert.equal(body.preview.safety.createsApproval, false);
  assert.equal(body.preview.safety.executableActionRegistered, false);
  assert.equal(body.preview.safety.publishesContent, false);
  assert.equal(body.preview.safety.decommissionsStb, false);
  assert.equal(body.preview.safety.writesToMind, false);

  body.preview.items.forEach(item => {
    assert.equal(item.safety.readOnly, true);
    assert.equal(item.safety.comparesRealOutputs, false);
    assert.equal(item.safety.readsGeneratedArtifacts, false);
    assert.equal(item.safety.executesStb, false);
    assert.equal(item.safety.executesVideo, false);
    assert.equal(item.safety.writesEvidence, false);
    assert.equal(item.safety.createsApproval, false);
    assert.equal(item.safety.publishesContent, false);
    assert.equal(item.safety.writesToMind, false);
  });
});

test('POST /video-orchestrator/fixture-comparison-preview is not available', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/fixture-comparison-preview' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});


test('GET /video-orchestrator/production-cutover-gate returns read-only blocked gate', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/production-cutover-gate' });
  const body = JSON.parse(response.body) as {
    gate: {
      id: string;
      status: string;
      canCutover: boolean;
      canMarkProductionReady: boolean;
      canDecommissionStb: boolean;
      executableActionRegistered: boolean;
      items: Array<{ status: string; severity: string; safety: Record<string, boolean> }>;
      summary: { totalItems: number; passedCount: number; blockedCount: number; missingCount: number; blockingSeverityCount: number };
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.gate.id, 'video-orchestrator-production-cutover-gate');
  assert.ok(['gate-only', 'blocked', 'ready-for-review'].includes(body.gate.status));
  assert.equal(body.gate.canCutover, false);
  assert.equal(body.gate.canMarkProductionReady, false);
  assert.equal(body.gate.canDecommissionStb, false);
  assert.equal(body.gate.executableActionRegistered, false);
  assert.ok(body.gate.summary.totalItems > 0);
  assert.ok(body.gate.summary.passedCount > 0);
  assert.ok(body.gate.summary.blockedCount > 0 || body.gate.summary.missingCount > 0);
  assert.ok(body.gate.summary.blockingSeverityCount > 0);
  assert.equal(body.gate.safety.readOnly, true);
  assert.equal(body.gate.safety.marksProductionReady, false);
  assert.equal(body.gate.safety.switchesTraffic, false);
  assert.equal(body.gate.safety.decommissionsStb, false);
  assert.equal(body.gate.safety.executesStb, false);
  assert.equal(body.gate.safety.executesVideo, false);
  assert.equal(body.gate.safety.publishesContent, false);
  assert.equal(body.gate.safety.createsApproval, false);
  assert.equal(body.gate.safety.executableActionRegistered, false);
  assert.equal(body.gate.safety.writesToMind, false);

  body.gate.items.forEach(item => {
    assert.equal(item.safety.readOnly, true);
    assert.equal(item.safety.marksProductionReady, false);
    assert.equal(item.safety.switchesTraffic, false);
    assert.equal(item.safety.decommissionsStb, false);
    assert.equal(item.safety.executesStb, false);
    assert.equal(item.safety.executesVideo, false);
    assert.equal(item.safety.publishesContent, false);
    assert.equal(item.safety.createsApproval, false);
    assert.equal(item.safety.writesToMind, false);
  });
});

test('POST /video-orchestrator/production-cutover-gate is not available', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/production-cutover-gate' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});


test('GET /video-orchestrator/release-candidate-readiness returns read-only blocked snapshot', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/release-candidate-readiness' });
  const body = JSON.parse(response.body) as {
    snapshot: {
      id: string;
      status: string;
      readinessPercent: number;
      canMarkReleaseCandidate: boolean;
      executableActionRegistered: boolean;
      items: Array<{ status: string; severity: string; safety: Record<string, boolean> }>;
      summary: { totalItems: number; readyCount: number; blockedCount: number; missingCount: number; blockingSeverityCount: number };
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.snapshot.id, 'video-orchestrator-release-candidate-readiness');
  assert.ok(['snapshot-only', 'blocked', 'ready-for-review'].includes(body.snapshot.status));
  assert.equal(body.snapshot.canMarkReleaseCandidate, false);
  assert.equal(body.snapshot.executableActionRegistered, false);
  assert.ok(body.snapshot.readinessPercent >= 0);
  assert.ok(body.snapshot.readinessPercent < 100);
  assert.ok(body.snapshot.summary.totalItems > 0);
  assert.ok(body.snapshot.summary.readyCount > 0);
  assert.ok(body.snapshot.summary.blockedCount > 0 || body.snapshot.summary.missingCount > 0);
  assert.ok(body.snapshot.summary.blockingSeverityCount > 0);
  assert.equal(body.snapshot.safety.readOnly, true);
  assert.equal(body.snapshot.safety.marksReleaseCandidate, false);
  assert.equal(body.snapshot.safety.executesStb, false);
  assert.equal(body.snapshot.safety.executesVideo, false);
  assert.equal(body.snapshot.safety.rendersVideo, false);
  assert.equal(body.snapshot.safety.publishesContent, false);
  assert.equal(body.snapshot.safety.createsApproval, false);
  assert.equal(body.snapshot.safety.executableActionRegistered, false);
  assert.equal(body.snapshot.safety.decommissionsStb, false);
  assert.equal(body.snapshot.safety.writesToMind, false);

  body.snapshot.items.forEach(item => {
    assert.equal(item.safety.readOnly, true);
    assert.equal(item.safety.marksReleaseCandidate, false);
    assert.equal(item.safety.executesStb, false);
    assert.equal(item.safety.executesVideo, false);
    assert.equal(item.safety.rendersVideo, false);
    assert.equal(item.safety.publishesContent, false);
    assert.equal(item.safety.createsApproval, false);
    assert.equal(item.safety.writesToMind, false);
  });
});

test('POST /video-orchestrator/release-candidate-readiness is not available', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/release-candidate-readiness' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});
