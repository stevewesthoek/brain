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

test('GET /video-orchestrator/operator-decision-queue returns read-only decisions', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/operator-decision-queue' });
  const body = JSON.parse(response.body) as {
    queue: {
      id: string;
      status: string;
      canCreateApproval: boolean;
      executableActionRegistered: boolean;
      decisions: Array<{
        id: string;
        category: string;
        requiredBeforeExecution: boolean;
        safety: Record<string, boolean>;
      }>;
      summary: { totalDecisions: number; decisionRequiredCount: number; blockedCount: number; highPriorityCount: number };
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.queue.id, 'video-orchestrator-operator-decision-queue');
  assert.ok(['queue-only', 'blocked'].includes(body.queue.status));
  assert.equal(body.queue.canCreateApproval, false);
  assert.equal(body.queue.executableActionRegistered, false);
  assert.ok(body.queue.summary.totalDecisions >= 6);
  assert.ok(body.queue.summary.highPriorityCount > 0);

  const categories = body.queue.decisions.map(decision => decision.category);
  assert.ok(categories.includes('candidate-selection'));
  assert.ok(categories.includes('rollback-cleanup'));
  assert.ok(categories.includes('artifact-sandbox'));
  assert.ok(categories.includes('comparison-schema'));
  assert.ok(categories.includes('release-candidate'));
  assert.ok(categories.includes('controlled-execution'));

  assert.equal(body.queue.safety.readOnly, true);
  assert.equal(body.queue.safety.createsApproval, false);
  assert.equal(body.queue.safety.registersAction, false);
  assert.equal(body.queue.safety.executesStb, false);
  assert.equal(body.queue.safety.executesVideo, false);
  assert.equal(body.queue.safety.rendersVideo, false);
  assert.equal(body.queue.safety.publishesContent, false);
  assert.equal(body.queue.safety.decommissionsStb, false);
  assert.equal(body.queue.safety.writesToMind, false);

  body.queue.decisions.forEach(decision => {
    assert.equal(decision.requiredBeforeExecution, true);
    assert.equal(decision.safety.readOnly, true);
    assert.equal(decision.safety.createsApproval, false);
    assert.equal(decision.safety.registersAction, false);
    assert.equal(decision.safety.executesStb, false);
    assert.equal(decision.safety.executesVideo, false);
    assert.equal(decision.safety.rendersVideo, false);
    assert.equal(decision.safety.publishesContent, false);
    assert.equal(decision.safety.decommissionsStb, false);
    assert.equal(decision.safety.writesToMind, false);
  });
});

test('POST /video-orchestrator/operator-decision-queue is not available', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/operator-decision-queue' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /video-orchestrator/controlled-execution-policy-boundary returns read-only blocked boundary', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/controlled-execution-policy-boundary' });
  const body = JSON.parse(response.body) as {
    boundary: {
      id: string;
      status: string;
      canRegisterAction: boolean;
      canCreateApproval: boolean;
      canExecute: boolean;
      canWriteFiles: boolean;
      canPublish: boolean;
      canDecommissionStb: boolean;
      sections: Array<{ category: string; safety: Record<string, boolean> }>;
      summary: { totalSections: number; blockedCount: number; missingCount: number; blockingSeverityCount: number };
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.boundary.id, 'video-orchestrator-controlled-execution-policy-boundary');
  assert.ok(['boundary-only', 'blocked'].includes(body.boundary.status));
  assert.equal(body.boundary.canRegisterAction, false);
  assert.equal(body.boundary.canCreateApproval, false);
  assert.equal(body.boundary.canExecute, false);
  assert.equal(body.boundary.canWriteFiles, false);
  assert.equal(body.boundary.canPublish, false);
  assert.equal(body.boundary.canDecommissionStb, false);
  assert.ok(body.boundary.summary.totalSections >= 7);
  assert.ok(body.boundary.summary.blockedCount > 0);
  assert.ok(body.boundary.summary.blockingSeverityCount > 0);

  const categories = body.boundary.sections.map(section => section.category);
  assert.ok(categories.includes('action-registration'));
  assert.ok(categories.includes('approval-execution'));
  assert.ok(categories.includes('runtime-isolation'));
  assert.ok(categories.includes('artifact-write'));
  assert.ok(categories.includes('platform-publishing'));
  assert.ok(categories.includes('stb-decommission'));
  assert.ok(categories.includes('human-decision'));

  assert.equal(body.boundary.safety.readOnly, true);
  assert.equal(body.boundary.safety.canRegisterAction, false);
  assert.equal(body.boundary.safety.canCreateApproval, false);
  assert.equal(body.boundary.safety.canExecute, false);
  assert.equal(body.boundary.safety.canWriteFiles, false);
  assert.equal(body.boundary.safety.canPublish, false);
  assert.equal(body.boundary.safety.canDecommissionStb, false);
  assert.equal(body.boundary.safety.writesToMind, false);

  body.boundary.sections.forEach(section => {
    assert.equal(section.safety.readOnly, true);
    assert.equal(section.safety.canRegisterAction, false);
    assert.equal(section.safety.canCreateApproval, false);
    assert.equal(section.safety.canExecute, false);
    assert.equal(section.safety.canWriteFiles, false);
    assert.equal(section.safety.canPublish, false);
    assert.equal(section.safety.canDecommissionStb, false);
    assert.equal(section.safety.writesToMind, false);
  });
});

test('POST /video-orchestrator/controlled-execution-policy-boundary is not available', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/controlled-execution-policy-boundary' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /video-orchestrator/controlled-execution-readiness-index returns blocked readiness index', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/controlled-execution-readiness-index' });
  const body = JSON.parse(response.body) as {
    index: {
      id: string;
      status: string;
      readinessPercent: number;
      canExecute: boolean;
      canRegisterAction: boolean;
      canCreateApproval: boolean;
      canRender: boolean;
      canExport: boolean;
      canPublish: boolean;
      canMarkReleaseCandidate: boolean;
      canDecommissionStb: boolean;
      executableActionRegistered: boolean;
      items: Array<{ safety: Record<string, boolean> }>;
      summary: { totalItems: number; readyCount: number; blockedCount: number; missingCount: number; blockingSeverityCount: number };
      blockers: string[];
      nextSafeStep: string;
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.index.id, 'video-orchestrator-controlled-execution-readiness-index');
  assert.ok(['blocked', 'design-only', 'ready-for-review'].includes(body.index.status));
  assert.ok(body.index.readinessPercent >= 0);
  assert.ok(body.index.readinessPercent < 100);
  assert.equal(body.index.canExecute, false);
  assert.equal(body.index.canRegisterAction, false);
  assert.equal(body.index.canCreateApproval, false);
  assert.equal(body.index.canRender, false);
  assert.equal(body.index.canExport, false);
  assert.equal(body.index.canPublish, false);
  assert.equal(body.index.canMarkReleaseCandidate, false);
  assert.equal(body.index.canDecommissionStb, false);
  assert.equal(body.index.executableActionRegistered, false);
  assert.ok(body.index.summary.totalItems > 0);
  assert.ok(body.index.summary.blockedCount > 0 || body.index.summary.missingCount > 0);
  assert.ok(body.index.summary.blockingSeverityCount > 0);
  assert.ok(body.index.blockers.length > 0);
  assert.ok(body.index.nextSafeStep.length > 0);

  assert.equal(body.index.safety.readOnly, true);
  assert.equal(body.index.safety.canExecute, false);
  assert.equal(body.index.safety.canRegisterAction, false);
  assert.equal(body.index.safety.canCreateApproval, false);
  assert.equal(body.index.safety.canRender, false);
  assert.equal(body.index.safety.canExport, false);
  assert.equal(body.index.safety.canPublish, false);
  assert.equal(body.index.safety.canMarkReleaseCandidate, false);
  assert.equal(body.index.safety.canDecommissionStb, false);
  assert.equal(body.index.safety.writesToMind, false);

  body.index.items.forEach(item => {
    assert.equal(item.safety.readOnly, true);
    assert.equal(item.safety.canExecute, false);
    assert.equal(item.safety.canRegisterAction, false);
    assert.equal(item.safety.canCreateApproval, false);
    assert.equal(item.safety.canRender, false);
    assert.equal(item.safety.canExport, false);
    assert.equal(item.safety.canPublish, false);
    assert.equal(item.safety.canMarkReleaseCandidate, false);
    assert.equal(item.safety.canDecommissionStb, false);
    assert.equal(item.safety.writesToMind, false);
  });
});

test('POST /video-orchestrator/controlled-execution-readiness-index is not available', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/controlled-execution-readiness-index' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /video-orchestrator/roadmap-checkpoint returns blocked checkpoint', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/roadmap-checkpoint' });
  const body = JSON.parse(response.body) as {
    checkpoint: {
      id: string;
      status: string;
      completedPhaseCount: number;
      blockedPhaseCount: number;
      approvalRequiredCount: number;
      phases: Array<{ status: string; group: string; safety: Record<string, boolean> }>;
      blockers: string[];
      nextSafeStep: string;
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.checkpoint.id, 'video-orchestrator-roadmap-checkpoint');
  assert.ok(['checkpoint-only', 'blocked', 'ready-for-review'].includes(body.checkpoint.status));
  assert.ok(body.checkpoint.completedPhaseCount > 0);
  assert.ok(body.checkpoint.blockedPhaseCount > 0);
  assert.ok(body.checkpoint.approvalRequiredCount > 0);
  assert.ok(body.checkpoint.phases.some(phase => phase.status === 'blocked' || phase.status === 'requires-approval'));
  assert.ok(body.checkpoint.blockers.length > 0);
  assert.ok(body.checkpoint.nextSafeStep.length > 0);
  assert.equal(body.checkpoint.safety.readOnly, true);
  assert.equal(body.checkpoint.safety.executesStb, false);
  assert.equal(body.checkpoint.safety.executesVideo, false);
  assert.equal(body.checkpoint.safety.createsApproval, false);
  assert.equal(body.checkpoint.safety.registersAction, false);
  assert.equal(body.checkpoint.safety.publishesContent, false);
  assert.equal(body.checkpoint.safety.decommissionsStb, false);
  assert.equal(body.checkpoint.safety.writesToMind, false);

  body.checkpoint.phases.forEach(phase => {
    assert.equal(phase.safety.readOnly, true);
    assert.equal(phase.safety.executesStb, false);
    assert.equal(phase.safety.executesVideo, false);
    assert.equal(phase.safety.createsApproval, false);
    assert.equal(phase.safety.registersAction, false);
    assert.equal(phase.safety.publishesContent, false);
    assert.equal(phase.safety.decommissionsStb, false);
    assert.equal(phase.safety.writesToMind, false);
  });
});

test('POST /video-orchestrator/roadmap-checkpoint is not available', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/roadmap-checkpoint' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /video-orchestrator/operator-review-packet returns blocked review packet', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/operator-review-packet' });
  const body = JSON.parse(response.body) as {
    packet: {
      id: string;
      status: string;
      canCreateApproval: boolean;
      canExecute: boolean;
      canMarkReviewed: boolean;
      sections: Array<{ status: string; safety: Record<string, boolean> }>;
      summary: { totalSections: number; includedCount: number; blockedCount: number; missingCount: number };
      blockers: string[];
      nextSafeStep: string;
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.packet.id, 'video-orchestrator-operator-review-packet');
  assert.ok(['review-packet-only', 'blocked', 'ready-for-review'].includes(body.packet.status));
  assert.equal(body.packet.canCreateApproval, false);
  assert.equal(body.packet.canExecute, false);
  assert.equal(body.packet.canMarkReviewed, false);
  assert.ok(body.packet.summary.totalSections > 0);
  assert.ok(body.packet.summary.includedCount > 0);
  assert.ok(body.packet.summary.blockedCount > 0 || body.packet.summary.missingCount > 0);
  assert.ok(body.packet.blockers.length > 0);
  assert.ok(body.packet.nextSafeStep.length > 0);
  assert.equal(body.packet.safety.readOnly, true);
  assert.equal(body.packet.safety.createsApproval, false);
  assert.equal(body.packet.safety.registersAction, false);
  assert.equal(body.packet.safety.executesStb, false);
  assert.equal(body.packet.safety.executesVideo, false);
  assert.equal(body.packet.safety.publishesContent, false);
  assert.equal(body.packet.safety.decommissionsStb, false);
  assert.equal(body.packet.safety.writesToMind, false);

  body.packet.sections.forEach(section => {
    assert.equal(section.safety.readOnly, true);
    assert.equal(section.safety.createsApproval, false);
    assert.equal(section.safety.registersAction, false);
    assert.equal(section.safety.executesStb, false);
    assert.equal(section.safety.executesVideo, false);
    assert.equal(section.safety.publishesContent, false);
    assert.equal(section.safety.decommissionsStb, false);
    assert.equal(section.safety.writesToMind, false);
  });
});

test('POST /video-orchestrator/operator-review-packet is not available', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/operator-review-packet' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /video-orchestrator/preview-completion-index returns execution-blocked preview completion index', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/preview-completion-index' });
  const body = JSON.parse(response.body) as {
    index: {
      id: string;
      status: string;
      previewComplete: boolean;
      executionBlocked: boolean;
      readinessPercent: number;
      summary: { totalItems: number; completeCount: number; blockedCount: number; approvalRequiredCount: number };
      items: Array<{ status: string; safety: Record<string, boolean> }>;
      blockers: string[];
      nextMacroPhase: string;
      nextSafeStep: string;
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.index.id, 'video-orchestrator-preview-completion-index');
  assert.ok(['preview-complete', 'execution-blocked'].includes(body.index.status));
  assert.equal(body.index.previewComplete, true);
  assert.equal(body.index.executionBlocked, true);
  assert.ok(body.index.readinessPercent >= 0);
  assert.ok(body.index.readinessPercent < 100);
  assert.ok(body.index.summary.totalItems > 0);
  assert.ok(body.index.summary.completeCount > 0);
  assert.ok(body.index.summary.blockedCount > 0);
  assert.ok(body.index.summary.approvalRequiredCount > 0);
  assert.ok(body.index.items.some(item => item.status === 'blocked' || item.status === 'requires-approval'));
  assert.ok(body.index.blockers.length > 0);
  assert.ok(body.index.nextMacroPhase.length > 0);
  assert.ok(body.index.nextSafeStep.length > 0);
  assert.equal(body.index.safety.readOnly, true);
  assert.equal(body.index.safety.executesStb, false);
  assert.equal(body.index.safety.executesVideo, false);
  assert.equal(body.index.safety.createsApproval, false);
  assert.equal(body.index.safety.registersAction, false);
  assert.equal(body.index.safety.publishesContent, false);
  assert.equal(body.index.safety.decommissionsStb, false);
  assert.equal(body.index.safety.writesToMind, false);

  body.index.items.forEach(item => {
    assert.equal(item.safety.readOnly, true);
    assert.equal(item.safety.executesStb, false);
    assert.equal(item.safety.executesVideo, false);
    assert.equal(item.safety.createsApproval, false);
    assert.equal(item.safety.registersAction, false);
    assert.equal(item.safety.publishesContent, false);
    assert.equal(item.safety.decommissionsStb, false);
    assert.equal(item.safety.writesToMind, false);
  });
});

test('POST /video-orchestrator/preview-completion-index is not available', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/preview-completion-index' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /video-orchestrator/controlled-execution-preflight-checklist returns blocked preflight checklist', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/controlled-execution-preflight-checklist' });
  const body = JSON.parse(response.body) as {
    checklist: {
      id: string;
      status: string;
      canPassPreflight: boolean;
      items: Array<{ status: string; safety: Record<string, boolean> }>;
      summary: { totalItems: number; blockedCount: number; missingCount: number; plannedCount: number };
      blockers: string[];
      nextSafeStep: string;
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.checklist.id, 'video-orchestrator-controlled-execution-preflight-checklist');
  assert.ok(['blocked', 'ready-for-review'].includes(body.checklist.status));
  assert.equal(body.checklist.canPassPreflight, false);
  assert.ok(body.checklist.summary.totalItems > 0);
  assert.ok(body.checklist.summary.blockedCount > 0);
  assert.ok(body.checklist.blockers.length > 0);
  assert.ok(body.checklist.nextSafeStep.length > 0);
  assert.equal(body.checklist.safety.readOnly, true);
  assert.equal(body.checklist.safety.canPassPreflight, false);
  assert.equal(body.checklist.safety.canCreateApproval, false);
  assert.equal(body.checklist.safety.canRegisterAction, false);
  assert.equal(body.checklist.safety.canExecute, false);
  assert.equal(body.checklist.safety.canWriteFiles, false);
  assert.equal(body.checklist.safety.canPublish, false);
  assert.equal(body.checklist.safety.canDecommissionStb, false);
  assert.equal(body.checklist.safety.writesToMind, false);

  body.checklist.items.forEach(item => {
    assert.equal(item.safety.readOnly, true);
    assert.equal(item.safety.canPassPreflight, false);
    assert.equal(item.safety.canCreateApproval, false);
    assert.equal(item.safety.canRegisterAction, false);
    assert.equal(item.safety.canExecute, false);
    assert.equal(item.safety.canWriteFiles, false);
    assert.equal(item.safety.canPublish, false);
    assert.equal(item.safety.canDecommissionStb, false);
    assert.equal(item.safety.writesToMind, false);
  });
});

test('POST /video-orchestrator/controlled-execution-preflight-checklist is not available', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/controlled-execution-preflight-checklist' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /video-orchestrator/controlled-execution-risk-register returns blocked risk register', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/controlled-execution-risk-register' });
  const body = JSON.parse(response.body) as {
    register: {
      id: string;
      status: string;
      canAcceptRisk: boolean;
      canExecuteMitigation: boolean;
      risks: Array<{ severity: string; safety: Record<string, boolean> }>;
      summary: { totalRisks: number; blockingCount: number; highCount: number; mediumCount: number };
      blockers: string[];
      nextSafeStep: string;
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.register.id, 'video-orchestrator-controlled-execution-risk-register');
  assert.ok(['blocked', 'ready-for-review'].includes(body.register.status));
  assert.equal(body.register.canAcceptRisk, false);
  assert.equal(body.register.canExecuteMitigation, false);
  assert.ok(body.register.risks.length > 0);
  assert.ok(body.register.summary.blockingCount > 0);
  assert.ok(body.register.summary.highCount > 0 || body.register.summary.mediumCount > 0);
  assert.ok(body.register.blockers.length > 0);
  assert.ok(body.register.nextSafeStep.length > 0);
  assert.equal(body.register.safety.readOnly, true);
  assert.equal(body.register.safety.canAcceptRisk, false);
  assert.equal(body.register.safety.canExecuteMitigation, false);
  assert.equal(body.register.safety.canCreateApproval, false);
  assert.equal(body.register.safety.canRegisterAction, false);
  assert.equal(body.register.safety.canExecute, false);
  assert.equal(body.register.safety.canDecommissionStb, false);
  assert.equal(body.register.safety.writesToMind, false);

  body.register.risks.forEach(risk => {
    assert.equal(risk.safety.readOnly, true);
    assert.equal(risk.safety.canAcceptRisk, false);
    assert.equal(risk.safety.canExecuteMitigation, false);
    assert.equal(risk.safety.canCreateApproval, false);
    assert.equal(risk.safety.canRegisterAction, false);
    assert.equal(risk.safety.canExecute, false);
    assert.equal(risk.safety.canDecommissionStb, false);
    assert.equal(risk.safety.writesToMind, false);
  });
});

test('POST /video-orchestrator/controlled-execution-risk-register is not available', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/controlled-execution-risk-register' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /video-orchestrator/controlled-execution-approval-payload-schema returns blocked schema-only payload schema', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/controlled-execution-approval-payload-schema' });
  const body = JSON.parse(response.body) as {
    schema: {
      id: string;
      status: string;
      canCreateApproval: boolean;
      canRegisterAction: boolean;
      canExecute: boolean;
      sections: Array<{
        status: string;
        fields: Array<{ status: string; safety: Record<string, boolean> }>;
        safety: Record<string, boolean>;
      }>;
      summary: {
        totalSections: number;
        totalFields: number;
        requiredFieldCount: number;
        blockedFieldCount: number;
        missingFieldCount: number;
      };
      blockers: string[];
      nextSafeStep: string;
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.schema.id, 'video-orchestrator-controlled-execution-approval-payload-schema');
  assert.ok(['schema-only', 'blocked', 'ready-for-review'].includes(body.schema.status));
  assert.equal(body.schema.canCreateApproval, false);
  assert.equal(body.schema.canRegisterAction, false);
  assert.equal(body.schema.canExecute, false);
  assert.ok(body.schema.sections.length > 0);
  assert.ok(body.schema.summary.totalFields > 0);
  assert.ok(body.schema.summary.requiredFieldCount > 0);
  assert.ok(body.schema.summary.blockedFieldCount > 0 || body.schema.summary.missingFieldCount > 0);
  assert.ok(body.schema.blockers.length > 0);
  assert.ok(body.schema.nextSafeStep.length > 0);
  assert.equal(body.schema.safety.readOnly, true);
  assert.equal(body.schema.safety.createsApproval, false);
  assert.equal(body.schema.safety.registersAction, false);
  assert.equal(body.schema.safety.executesStb, false);
  assert.equal(body.schema.safety.executesVideo, false);
  assert.equal(body.schema.safety.writesFiles, false);
  assert.equal(body.schema.safety.publishesContent, false);
  assert.equal(body.schema.safety.decommissionsStb, false);
  assert.equal(body.schema.safety.writesToMind, false);

  body.schema.sections.forEach(section => {
    assert.equal(section.safety.readOnly, true);
    assert.equal(section.safety.createsApproval, false);
    assert.equal(section.safety.registersAction, false);
    assert.equal(section.safety.executesStb, false);
    assert.equal(section.safety.executesVideo, false);
    assert.equal(section.safety.writesFiles, false);
    assert.equal(section.safety.publishesContent, false);
    assert.equal(section.safety.decommissionsStb, false);
    assert.equal(section.safety.writesToMind, false);

    section.fields.forEach(field => {
      assert.equal(field.safety.readOnly, true);
      assert.equal(field.safety.createsApproval, false);
      assert.equal(field.safety.registersAction, false);
      assert.equal(field.safety.executesStb, false);
      assert.equal(field.safety.executesVideo, false);
      assert.equal(field.safety.writesFiles, false);
      assert.equal(field.safety.publishesContent, false);
      assert.equal(field.safety.decommissionsStb, false);
      assert.equal(field.safety.writesToMind, false);
    });
  });
});

test('POST /video-orchestrator/controlled-execution-approval-payload-schema is not available', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/controlled-execution-approval-payload-schema' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /video-orchestrator/controlled-execution-approval-request-design returns blocked approval-request-only design', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/controlled-execution-approval-request-design' });
  const body = JSON.parse(response.body) as {
    design: {
      id: string;
      version: string;
      status: string;
      approvalRequestEnabled: boolean;
      createsApproval: boolean;
      registersAction: boolean;
      executable: boolean;
      summary: { totalRequiredPreconditions: number; missingPreconditionsCount: number; blockerCount: number };
      requestShape: {
        candidateStoryId: string;
        sourceEpisodeId: string;
        scopeType: string;
        selectedDecisionIds: string[];
        evidenceReferences: string[];
        requestedBy: string;
        expiresAt: string;
        rollbackRequirement: string;
        dryRunOnly: boolean;
      };
      requiredPreconditions: string[];
      missingPreconditions: string[];
      blockers: string[];
      evidenceReferences: string[];
      nextSafeStep: string;
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.design.id, 'video-orchestrator-controlled-execution-approval-request-design');
  assert.equal(body.design.version, 'phase-5e');
  assert.ok(['blocked', 'disabled'].includes(body.design.status));
  assert.equal(body.design.approvalRequestEnabled, false);
  assert.equal(body.design.createsApproval, false);
  assert.equal(body.design.registersAction, false);
  assert.equal(body.design.executable, false);
  assert.ok(body.design.summary.totalRequiredPreconditions > 0);
  assert.ok(body.design.summary.missingPreconditionsCount > 0);
  assert.ok(body.design.summary.blockerCount > 0);
  assert.equal(body.design.requestShape.scopeType, 'single-story-only');
  assert.equal(body.design.requestShape.dryRunOnly, true);
  assert.ok(body.design.requestShape.evidenceReferences.length > 0);
  assert.ok(body.design.requiredPreconditions.length > 0);
  assert.ok(body.design.missingPreconditions.length > 0);
  assert.ok(body.design.blockers.length > 0);
  assert.ok(body.design.nextSafeStep.length > 0);
  assert.equal(body.design.safety.readOnly, true);
  assert.equal(body.design.safety.approvalRequestOnly, true);
  assert.equal(body.design.safety.createsApproval, false);
  assert.equal(body.design.safety.registersAction, false);
  assert.equal(body.design.safety.runsValidator, false);
  assert.equal(body.design.safety.createsExecutionPlan, false);
  assert.equal(body.design.safety.executionPlanExecutable, false);
  assert.equal(body.design.safety.executesStb, false);
  assert.equal(body.design.safety.executesVideo, false);
  assert.equal(body.design.safety.writesFiles, false);
  assert.equal(body.design.safety.publishesContent, false);
  assert.equal(body.design.safety.decommissionsStb, false);
  assert.equal(body.design.safety.writesToMind, false);
});

test('POST /video-orchestrator/controlled-execution-approval-request-design is not available', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/controlled-execution-approval-request-design' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /video-orchestrator/controlled-execution-disabled-gate returns blocked disabled gate', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/controlled-execution-disabled-gate' });
  const body = JSON.parse(response.body) as {
    gate: {
      id: string;
      version: string;
      status: string;
      executionEnabled: boolean;
      secondApprovalRequired: boolean;
      secondApprovalPolicyExists: boolean;
      executable: boolean;
      summary: { gateCount: number; disabledReasonCount: number; requiredBeforeExecutionCount: number; blockerCount: number };
      gateChain: string[];
      disabledReasons: string[];
      requiredBeforeExecution: string[];
      evidenceReferences: string[];
      blockers: string[];
      nextSafeStep: string;
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.gate.id, 'video-orchestrator-controlled-execution-disabled-gate');
  assert.equal(body.gate.version, 'phase-5f');
  assert.ok(['blocked', 'disabled'].includes(body.gate.status));
  assert.equal(body.gate.executionEnabled, false);
  assert.equal(body.gate.secondApprovalRequired, true);
  assert.equal(body.gate.secondApprovalPolicyExists, false);
  assert.equal(body.gate.executable, false);
  assert.ok(body.gate.summary.gateCount > 0);
  assert.ok(body.gate.summary.disabledReasonCount > 0);
  assert.ok(body.gate.summary.requiredBeforeExecutionCount > 0);
  assert.ok(body.gate.summary.blockerCount > 0);
  assert.ok(body.gate.gateChain.includes('approval payload schema'));
  assert.ok(body.gate.gateChain.includes('preflight validator schema'));
  assert.ok(body.gate.gateChain.includes('execution plan stub'));
  assert.ok(body.gate.gateChain.includes('approval request design'));
  assert.ok(body.gate.gateChain.includes('explicit second approval gate'));
  assert.ok(body.gate.gateChain.includes('execution runner disabled'));
  assert.ok(body.gate.disabledReasons.length > 0);
  assert.ok(body.gate.requiredBeforeExecution.length > 0);
  assert.ok(body.gate.evidenceReferences.length > 0);
  assert.ok(body.gate.blockers.length > 0);
  assert.ok(body.gate.nextSafeStep.length > 0);
  assert.equal(body.gate.safety.readOnly, true);
  assert.equal(body.gate.safety.approvalRequestOnly, false);
  assert.equal(body.gate.safety.createsApproval, false);
  assert.equal(body.gate.safety.registersAction, false);
  assert.equal(body.gate.safety.registersAllowlist, false);
  assert.equal(body.gate.safety.runsValidator, false);
  assert.equal(body.gate.safety.createsExecutionPlan, false);
  assert.equal(body.gate.safety.executionPlanExecutable, false);
  assert.equal(body.gate.safety.executionEnabled, false);
  assert.equal(body.gate.safety.requiresSecondApproval, true);
  assert.equal(body.gate.safety.secondApprovalPolicyExists, false);
  assert.equal(body.gate.safety.executesStb, false);
  assert.equal(body.gate.safety.executesVideo, false);
  assert.equal(body.gate.safety.writesFiles, false);
  assert.equal(body.gate.safety.rendersVideo, false);
  assert.equal(body.gate.safety.exportsArtifacts, false);
  assert.equal(body.gate.safety.publishesContent, false);
  assert.equal(body.gate.safety.decommissionsStb, false);
  assert.equal(body.gate.safety.writesToMind, false);
});

test('POST /video-orchestrator/controlled-execution-disabled-gate is not available', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/controlled-execution-disabled-gate' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /video-orchestrator/controlled-execution-preflight-validator-schema returns blocked validator schema', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/controlled-execution-preflight-validator-schema' });
  const body = JSON.parse(response.body) as {
    schema: {
      id: string;
      status: string;
      canRunValidator: boolean;
      canCreateApproval: boolean;
      canRegisterAction: boolean;
      canExecute: boolean;
      rules: Array<{ status: string; safety: Record<string, boolean> }>;
      failureCodes: Array<{ code: string; safety: Record<string, boolean> }>;
      summary: { totalRules: number; definedRules: number; blockedRules: number; missingRules: number; failureCodeCount: number; blockingFailureCodeCount: number };
      blockers: string[];
      nextSafeStep: string;
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.schema.id, 'video-orchestrator-controlled-execution-preflight-validator-schema');
  assert.ok(['schema-only', 'blocked', 'ready-for-review'].includes(body.schema.status));
  assert.equal(body.schema.canRunValidator, false);
  assert.equal(body.schema.canCreateApproval, false);
  assert.equal(body.schema.canRegisterAction, false);
  assert.equal(body.schema.canExecute, false);
  assert.ok(body.schema.rules.length > 0);
  assert.ok(body.schema.failureCodes.length > 0);
  assert.ok(body.schema.summary.totalRules > 0);
  assert.ok(body.schema.summary.failureCodeCount > 0);
  assert.ok(body.schema.summary.blockingFailureCodeCount > 0);
  assert.ok(body.schema.rules.some(rule => rule.status === 'blocked'));
  assert.ok(body.schema.blockers.length > 0);
  assert.ok(body.schema.nextSafeStep.length > 0);
  assert.equal(body.schema.safety.readOnly, true);
  assert.equal(body.schema.safety.runsValidator, false);
  assert.equal(body.schema.safety.createsApproval, false);
  assert.equal(body.schema.safety.registersAction, false);
  assert.equal(body.schema.safety.executesStb, false);
  assert.equal(body.schema.safety.executesVideo, false);
  assert.equal(body.schema.safety.writesFiles, false);
  assert.equal(body.schema.safety.publishesContent, false);
  assert.equal(body.schema.safety.decommissionsStb, false);
  assert.equal(body.schema.safety.writesToMind, false);

  body.schema.rules.forEach(rule => {
    assert.equal(rule.safety.readOnly, true);
    assert.equal(rule.safety.runsValidator, false);
    assert.equal(rule.safety.createsApproval, false);
    assert.equal(rule.safety.registersAction, false);
    assert.equal(rule.safety.executesStb, false);
    assert.equal(rule.safety.executesVideo, false);
    assert.equal(rule.safety.writesFiles, false);
    assert.equal(rule.safety.publishesContent, false);
    assert.equal(rule.safety.decommissionsStb, false);
    assert.equal(rule.safety.writesToMind, false);
  });

  body.schema.failureCodes.forEach(code => {
    assert.equal(code.safety.readOnly, true);
    assert.equal(code.safety.runsValidator, false);
    assert.equal(code.safety.createsApproval, false);
    assert.equal(code.safety.registersAction, false);
    assert.equal(code.safety.executesStb, false);
    assert.equal(code.safety.executesVideo, false);
    assert.equal(code.safety.writesFiles, false);
    assert.equal(code.safety.publishesContent, false);
    assert.equal(code.safety.decommissionsStb, false);
    assert.equal(code.safety.writesToMind, false);
  });
});

test('POST /video-orchestrator/controlled-execution-preflight-validator-schema is not available', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/controlled-execution-preflight-validator-schema' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /video-orchestrator/controlled-execution-plan-stub returns blocked plan stub', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/controlled-execution-plan-stub' });
  const body = JSON.parse(response.body) as {
    plan: {
      id: string;
      status: string;
      createsExecutionPlan: boolean;
      executionPlanExecutable: boolean;
      candidateScope: { scopeType: string; approvedCandidatePresent: boolean };
      planSteps: Array<{ status: string; blockers: string[]; nextSafeStep: string }>;
      requiredInputs: string[];
      missingInputs: string[];
      evidenceReferences: string[];
      blockers: string[];
      summary: { totalSteps: number; plannedSteps: number; blockedSteps: number; missingInputs: number; requiredInputs: number };
      nextSafeStep: string;
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.plan.id, 'video-orchestrator-controlled-execution-plan-stub');
  assert.ok(['blocked', 'disabled'].includes(body.plan.status));
  assert.equal(body.plan.createsExecutionPlan, false);
  assert.equal(body.plan.executionPlanExecutable, false);
  assert.equal(body.plan.candidateScope.scopeType, 'single-story-only');
  assert.equal(body.plan.candidateScope.approvedCandidatePresent, false);
  assert.ok(body.plan.planSteps.length > 0);
  assert.ok(body.plan.summary.totalSteps > 0);
  assert.ok(body.plan.summary.blockedSteps > 0);
  assert.ok(body.plan.requiredInputs.length > 0);
  assert.ok(body.plan.missingInputs.length > 0);
  assert.ok(body.plan.evidenceReferences.length > 0);
  assert.ok(body.plan.blockers.length > 0);
  assert.ok(body.plan.nextSafeStep.length > 0);
  assert.equal(body.plan.safety.readOnly, true);
  assert.equal(body.plan.safety.createsApproval, false);
  assert.equal(body.plan.safety.registersAction, false);
  assert.equal(body.plan.safety.runsValidator, false);
  assert.equal(body.plan.safety.createsExecutionPlan, false);
  assert.equal(body.plan.safety.executionPlanExecutable, false);
  assert.equal(body.plan.safety.executesStb, false);
  assert.equal(body.plan.safety.executesVideo, false);
  assert.equal(body.plan.safety.writesFiles, false);
  assert.equal(body.plan.safety.publishesContent, false);
  assert.equal(body.plan.safety.decommissionsStb, false);
  assert.equal(body.plan.safety.writesToMind, false);
  body.plan.planSteps.forEach(step => {
    assert.equal(step.status, 'blocked');
    assert.ok(step.blockers.length >= 0);
    assert.ok(step.nextSafeStep.length > 0);
  });
});

test('POST /video-orchestrator/controlled-execution-plan-stub is not available', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/controlled-execution-plan-stub' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /video-orchestrator/controlled-execution-second-approval-policy returns blocked policy design', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/controlled-execution-second-approval-policy' });
  const body = JSON.parse(response.body) as {
    policy: {
      id: string;
      generatedAt: string;
      version: string;
      status: string;
      policyExists: boolean;
      policyAccepted: boolean;
      secondApprovalCreationEnabled: boolean;
      executionEnabled: boolean;
      executable: boolean;
      summary: {
        policyCount: number;
        policySectionCount: number;
        requiredEvidenceCount: number;
        missingEvidenceCount: number;
        blockerCount: number;
      };
      policySections: string[];
      requiredEvidence: string[];
      missingEvidence: string[];
      evidenceReferences: string[];
      blockers: string[];
      nextSafeStep: string;
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.policy.id, 'video-orchestrator-controlled-execution-second-approval-policy');
  assert.equal(body.policy.version, 'phase-5g');
  assert.ok(['blocked', 'disabled'].includes(body.policy.status));
  assert.equal(body.policy.policyExists, false);
  assert.equal(body.policy.policyAccepted, false);
  assert.equal(body.policy.secondApprovalCreationEnabled, false);
  assert.equal(body.policy.executionEnabled, false);
  assert.equal(body.policy.executable, false);
  assert.ok(body.policy.summary.policyCount > 0);
  assert.ok(body.policy.summary.policySectionCount > 0);
  assert.ok(body.policy.summary.requiredEvidenceCount > 0);
  assert.ok(body.policy.summary.missingEvidenceCount > 0);
  assert.ok(body.policy.summary.blockerCount > 0);
  assert.ok(body.policy.policySections.length > 0);
  assert.ok(body.policy.policySections.some(s => s.includes('Operator identity')));
  assert.ok(body.policy.policySections.some(s => s.includes('approval scope')));
  assert.ok(body.policy.policySections.some(s => s.includes('sandbox') || s.includes('Sandbox')));
  assert.ok(body.policy.requiredEvidence.length > 0);
  assert.ok(body.policy.missingEvidence.length > 0);
  assert.ok(body.policy.evidenceReferences.length > 0);
  assert.ok(body.policy.blockers.length > 0);
  assert.ok(body.policy.nextSafeStep.length > 0);
  assert.equal(body.policy.safety.readOnly, true);
  assert.equal(body.policy.safety.policyDesignOnly, true);
  assert.equal(body.policy.safety.policyExists, false);
  assert.equal(body.policy.safety.policyAccepted, false);
  assert.equal(body.policy.safety.createsApproval, false);
  assert.equal(body.policy.safety.createsSecondApproval, false);
  assert.equal(body.policy.safety.approvalExecutionEnabled, false);
  assert.equal(body.policy.safety.registersAction, false);
  assert.equal(body.policy.safety.registersAllowlist, false);
  assert.equal(body.policy.safety.runsValidator, false);
  assert.equal(body.policy.safety.createsExecutionPlan, false);
  assert.equal(body.policy.safety.executionPlanExecutable, false);
  assert.equal(body.policy.safety.executionEnabled, false);
  assert.equal(body.policy.safety.executesStb, false);
  assert.equal(body.policy.safety.executesVideo, false);
  assert.equal(body.policy.safety.writesFiles, false);
  assert.equal(body.policy.safety.rendersVideo, false);
  assert.equal(body.policy.safety.exportsArtifacts, false);
  assert.equal(body.policy.safety.publishesContent, false);
  assert.equal(body.policy.safety.decommissionsStb, false);
  assert.equal(body.policy.safety.writesToMind, false);
  assert.ok(body.policy.evidenceReferences.includes('/video-orchestrator/controlled-execution-disabled-gate'));
  assert.ok(body.policy.evidenceReferences.includes('/video-orchestrator/controlled-execution-approval-request-design'));
});

test('POST /video-orchestrator/controlled-execution-second-approval-policy is not available', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/controlled-execution-second-approval-policy' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /video-orchestrator/controlled-execution-operator-identity-protocol returns blocked protocol design', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/controlled-execution-operator-identity-protocol' });
  const body = JSON.parse(response.body) as {
    protocol: {
      id: string;
      generatedAt: string;
      version: string;
      status: string;
      protocolExists: boolean;
      identityVerificationEnabled: boolean;
      operatorAuthenticated: boolean;
      secondApprovalAllowed: boolean;
      executionEnabled: boolean;
      executable: boolean;
      summary: {
        requirementCount: number;
        missingRequirementCount: number;
        verificationStepCount: number;
        blockerCount: number;
      };
      identityRequirements: string[];
      missingRequirements: string[];
      verificationSteps: string[];
      evidenceReferences: string[];
      blockers: string[];
      nextSafeStep: string;
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.protocol.id, 'video-orchestrator-controlled-execution-operator-identity-protocol');
  assert.equal(body.protocol.version, 'phase-5h');
  assert.ok(['blocked', 'disabled'].includes(body.protocol.status));
  assert.equal(body.protocol.protocolExists, false);
  assert.equal(body.protocol.identityVerificationEnabled, false);
  assert.equal(body.protocol.operatorAuthenticated, false);
  assert.equal(body.protocol.secondApprovalAllowed, false);
  assert.equal(body.protocol.executionEnabled, false);
  assert.equal(body.protocol.executable, false);
  assert.ok(body.protocol.summary.requirementCount > 0);
  assert.ok(body.protocol.summary.missingRequirementCount > 0);
  assert.ok(body.protocol.summary.verificationStepCount > 0);
  assert.ok(body.protocol.summary.blockerCount > 0);
  assert.ok(body.protocol.identityRequirements.length > 0);
  assert.ok(body.protocol.identityRequirements.some(r => r.includes('Operator identifier')));
  assert.ok(body.protocol.identityRequirements.some(r => r.includes('role') || r.includes('Role')));
  assert.ok(body.protocol.identityRequirements.some(r => r.includes('local-only') || r.includes('Local-only')));
  assert.ok(body.protocol.missingRequirements.length > 0);
  assert.ok(body.protocol.verificationSteps.length > 0);
  assert.ok(body.protocol.evidenceReferences.length > 0);
  assert.ok(body.protocol.blockers.length > 0);
  assert.ok(body.protocol.nextSafeStep.length > 0);
  assert.equal(body.protocol.safety.readOnly, true);
  assert.equal(body.protocol.safety.protocolDesignOnly, true);
  assert.equal(body.protocol.safety.protocolExists, false);
  assert.equal(body.protocol.safety.identityVerificationEnabled, false);
  assert.equal(body.protocol.safety.authenticatesOperator, false);
  assert.equal(body.protocol.safety.createsSession, false);
  assert.equal(body.protocol.safety.createsApproval, false);
  assert.equal(body.protocol.safety.createsSecondApproval, false);
  assert.equal(body.protocol.safety.approvalExecutionEnabled, false);
  assert.equal(body.protocol.safety.registersAction, false);
  assert.equal(body.protocol.safety.registersAllowlist, false);
  assert.equal(body.protocol.safety.runsValidator, false);
  assert.equal(body.protocol.safety.createsExecutionPlan, false);
  assert.equal(body.protocol.safety.executionPlanExecutable, false);
  assert.equal(body.protocol.safety.executionEnabled, false);
  assert.equal(body.protocol.safety.executesStb, false);
  assert.equal(body.protocol.safety.executesVideo, false);
  assert.equal(body.protocol.safety.writesFiles, false);
  assert.equal(body.protocol.safety.rendersVideo, false);
  assert.equal(body.protocol.safety.exportsArtifacts, false);
  assert.equal(body.protocol.safety.publishesContent, false);
  assert.equal(body.protocol.safety.decommissionsStb, false);
  assert.equal(body.protocol.safety.writesToMind, false);
  assert.ok(body.protocol.evidenceReferences.includes('/video-orchestrator/controlled-execution-second-approval-policy'));
  assert.ok(body.protocol.evidenceReferences.includes('/video-orchestrator/controlled-execution-disabled-gate'));
});

test('POST /video-orchestrator/controlled-execution-operator-identity-protocol is not available', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/controlled-execution-operator-identity-protocol' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /video-orchestrator/controlled-execution-role-policy returns blocked policy design', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/controlled-execution-role-policy' });
  const body = JSON.parse(response.body) as {
    policy: {
      id: string;
      generatedAt: string;
      version: string;
      status: string;
      policyExists: boolean;
      policyEnforced: boolean;
      roleVerificationEnabled: boolean;
      secondApprovalAllowed: boolean;
      executionEnabled: boolean;
      executable: boolean;
      summary: {
        roleCount: number;
        privilegeRequirementCount: number;
        missingRequirementCount: number;
        blockerCount: number;
      };
      roles: Array<{ name: string; canExecute: boolean; canPublish: boolean; canDecommission: boolean }>;
      privilegeRequirements: string[];
      missingPolicyRequirements: string[];
      evidenceReferences: string[];
      blockers: string[];
      nextSafeStep: string;
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.policy.id, 'video-orchestrator-controlled-execution-role-policy');
  assert.equal(body.policy.version, 'phase-5i');
  assert.ok(['blocked', 'disabled'].includes(body.policy.status));
  assert.equal(body.policy.policyExists, false);
  assert.equal(body.policy.policyEnforced, false);
  assert.equal(body.policy.roleVerificationEnabled, false);
  assert.equal(body.policy.secondApprovalAllowed, false);
  assert.equal(body.policy.executionEnabled, false);
  assert.equal(body.policy.executable, false);
  assert.ok(body.policy.summary.roleCount > 0);
  assert.ok(body.policy.summary.privilegeRequirementCount > 0);
  assert.ok(body.policy.summary.missingRequirementCount > 0);
  assert.ok(body.policy.summary.blockerCount > 0);
  assert.ok(body.policy.roles.length > 0);
  assert.ok(body.policy.roles.some(r => r.name === 'viewer'));
  assert.ok(body.policy.roles.some(r => r.name === 'admin'));
  assert.ok(body.policy.privilegeRequirements.length > 0);
  assert.ok(body.policy.missingPolicyRequirements.length > 0);
  assert.ok(body.policy.evidenceReferences.length > 0);
  assert.ok(body.policy.blockers.length > 0);
  assert.ok(body.policy.nextSafeStep.length > 0);
  assert.equal(body.policy.safety.readOnly, true);
  assert.equal(body.policy.safety.policyDesignOnly, true);
  assert.equal(body.policy.safety.policyExists, false);
  assert.equal(body.policy.safety.policyEnforced, false);
  assert.equal(body.policy.safety.roleVerificationEnabled, false);
  assert.equal(body.policy.safety.authenticatesOperator, false);
  assert.equal(body.policy.safety.createsSession, false);
  assert.equal(body.policy.safety.createsApproval, false);
  assert.equal(body.policy.safety.createsSecondApproval, false);
  assert.equal(body.policy.safety.approvalExecutionEnabled, false);
  assert.equal(body.policy.safety.registersAction, false);
  assert.equal(body.policy.safety.registersAllowlist, false);
  assert.equal(body.policy.safety.runsValidator, false);
  assert.equal(body.policy.safety.createsExecutionPlan, false);
  assert.equal(body.policy.safety.executionPlanExecutable, false);
  assert.equal(body.policy.safety.executionEnabled, false);
  assert.equal(body.policy.safety.executesStb, false);
  assert.equal(body.policy.safety.executesVideo, false);
  assert.equal(body.policy.safety.writesFiles, false);
  assert.equal(body.policy.safety.rendersVideo, false);
  assert.equal(body.policy.safety.exportsArtifacts, false);
  assert.equal(body.policy.safety.publishesContent, false);
  assert.equal(body.policy.safety.decommissionsStb, false);
  assert.equal(body.policy.safety.writesToMind, false);
  body.policy.roles.forEach(role => {
    assert.equal(role.canExecute, false);
    assert.equal(role.canPublish, false);
    assert.equal(role.canDecommission, false);
  });
  assert.ok(body.policy.evidenceReferences.includes('/video-orchestrator/controlled-execution-operator-identity-protocol'));
  assert.ok(body.policy.evidenceReferences.includes('/video-orchestrator/controlled-execution-second-approval-policy'));
});

test('POST /video-orchestrator/controlled-execution-role-policy is not available', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/controlled-execution-role-policy' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});


test('GET /video-orchestrator/controlled-execution-first-approval-authority-policy returns blocked policy design', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/controlled-execution-first-approval-authority-policy' });
  const body = JSON.parse(response.body) as {
    policy: {
      id: string;
      version: string;
      status: string;
      policyExists: boolean;
      policyAccepted: boolean;
      firstApprovalAuthorityEnabled: boolean;
      firstApprovalCreationEnabled: boolean;
      secondApprovalRequired: boolean;
      secondApprovalAllowed: boolean;
      executionEnabled: boolean;
      executable: boolean;
      eligibleRoles: Array<{
        role: string;
        canIssueFirstApproval: boolean;
      }>;
      approvalScope: {
        scopeType: string;
        permitsExecution: boolean;
        permitsPublishing: boolean;
        permitsStbMutation: boolean;
        permitsMindWrites: boolean;
        requiresSecondApprovalBeforeExecution: boolean;
      };
      evidenceReferences: string[];
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.policy.id, 'video-orchestrator-controlled-execution-first-approval-authority-policy');
  assert.equal(body.policy.version, 'phase-5j');
  assert.ok(['blocked', 'disabled'].includes(body.policy.status));
  assert.equal(body.policy.policyExists, false);
  assert.equal(body.policy.policyAccepted, false);
  assert.equal(body.policy.firstApprovalAuthorityEnabled, false);
  assert.equal(body.policy.firstApprovalCreationEnabled, false);
  assert.equal(body.policy.secondApprovalRequired, true);
  assert.equal(body.policy.secondApprovalAllowed, false);
  assert.equal(body.policy.executionEnabled, false);
  assert.equal(body.policy.executable, false);
  assert.equal(body.policy.approvalScope.scopeType, 'single-story-only');
  assert.equal(body.policy.approvalScope.permitsExecution, false);
  assert.equal(body.policy.approvalScope.permitsPublishing, false);
  assert.equal(body.policy.approvalScope.permitsStbMutation, false);
  assert.equal(body.policy.approvalScope.permitsMindWrites, false);
  assert.equal(body.policy.approvalScope.requiresSecondApprovalBeforeExecution, true);
  assert.ok(body.policy.evidenceReferences.includes('/video-orchestrator/controlled-execution-role-policy'));
  assert.ok(body.policy.evidenceReferences.includes('/video-orchestrator/controlled-execution-second-approval-policy'));

  body.policy.eligibleRoles.forEach(role => {
    assert.equal(role.canIssueFirstApproval, false, `${role.role} must not issue first approvals yet`);
  });

  assert.equal(body.policy.safety.readOnly, true);
  assert.equal(body.policy.safety.policyDesignOnly, true);
  assert.equal(body.policy.safety.policyExists, false);
  assert.equal(body.policy.safety.policyAccepted, false);
  assert.equal(body.policy.safety.authorityVerificationEnabled, false);
  assert.equal(body.policy.safety.authenticatesOperator, false);
  assert.equal(body.policy.safety.createsSession, false);
  assert.equal(body.policy.safety.createsApproval, false);
  assert.equal(body.policy.safety.createsFirstApproval, false);
  assert.equal(body.policy.safety.createsSecondApproval, false);
  assert.equal(body.policy.safety.approvalExecutionEnabled, false);
  assert.equal(body.policy.safety.registersAction, false);
  assert.equal(body.policy.safety.registersAllowlist, false);
  assert.equal(body.policy.safety.runsValidator, false);
  assert.equal(body.policy.safety.createsExecutionPlan, false);
  assert.equal(body.policy.safety.executionPlanExecutable, false);
  assert.equal(body.policy.safety.executionEnabled, false);
  assert.equal(body.policy.safety.executesStb, false);
  assert.equal(body.policy.safety.executesVideo, false);
  assert.equal(body.policy.safety.writesFiles, false);
  assert.equal(body.policy.safety.rendersVideo, false);
  assert.equal(body.policy.safety.exportsArtifacts, false);
  assert.equal(body.policy.safety.publishesContent, false);
  assert.equal(body.policy.safety.decommissionsStb, false);
  assert.equal(body.policy.safety.writesToMind, false);
});

test('POST /video-orchestrator/controlled-execution-first-approval-authority-policy is not registered', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/controlled-execution-first-approval-authority-policy' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});


test('GET /video-orchestrator/controlled-execution-first-approval-audit-expiry-model returns blocked model design', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/controlled-execution-first-approval-audit-expiry-model' });
  const body = JSON.parse(response.body) as {
    model: {
      id: string;
      version: string;
      status: string;
      modelExists: boolean;
      auditPersistenceEnabled: boolean;
      expiryEnforcementEnabled: boolean;
      firstApprovalCreationEnabled: boolean;
      executionEnabled: boolean;
      executable: boolean;
      auditFields: string[];
      expiryRules: string[];
      invalidationRules: string[];
      evidenceReferences: string[];
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.model.id, 'video-orchestrator-controlled-execution-first-approval-audit-expiry-model');
  assert.equal(body.model.version, 'phase-5k');
  assert.ok(['blocked', 'disabled'].includes(body.model.status));
  assert.equal(body.model.modelExists, false);
  assert.equal(body.model.auditPersistenceEnabled, false);
  assert.equal(body.model.expiryEnforcementEnabled, false);
  assert.equal(body.model.firstApprovalCreationEnabled, false);
  assert.equal(body.model.executionEnabled, false);
  assert.equal(body.model.executable, false);
  assert.ok(body.model.auditFields.length > 0);
  assert.ok(body.model.expiryRules.length > 0);
  assert.ok(body.model.invalidationRules.length > 0);
  assert.ok(body.model.evidenceReferences.includes('/video-orchestrator/controlled-execution-first-approval-authority-policy'));

  assert.equal(body.model.safety.readOnly, true);
  assert.equal(body.model.safety.modelDesignOnly, true);
  assert.equal(body.model.safety.auditPersistenceEnabled, false);
  assert.equal(body.model.safety.expiryEnforcementEnabled, false);
  assert.equal(body.model.safety.createsApproval, false);
  assert.equal(body.model.safety.createsFirstApproval, false);
  assert.equal(body.model.safety.createsSecondApproval, false);
  assert.equal(body.model.safety.approvalExecutionEnabled, false);
  assert.equal(body.model.safety.registersAction, false);
  assert.equal(body.model.safety.registersAllowlist, false);
  assert.equal(body.model.safety.runsValidator, false);
  assert.equal(body.model.safety.createsExecutionPlan, false);
  assert.equal(body.model.safety.executionPlanExecutable, false);
  assert.equal(body.model.safety.executionEnabled, false);
  assert.equal(body.model.safety.executesStb, false);
  assert.equal(body.model.safety.executesVideo, false);
  assert.equal(body.model.safety.writesFiles, false);
  assert.equal(body.model.safety.rendersVideo, false);
  assert.equal(body.model.safety.exportsArtifacts, false);
  assert.equal(body.model.safety.publishesContent, false);
  assert.equal(body.model.safety.decommissionsStb, false);
  assert.equal(body.model.safety.writesToMind, false);
});

test('POST /video-orchestrator/controlled-execution-first-approval-audit-expiry-model is not registered', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/controlled-execution-first-approval-audit-expiry-model' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /video-orchestrator/controlled-execution-candidate-story-lock returns blocked lock design', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/controlled-execution-candidate-story-lock' });
  const body = JSON.parse(response.body) as {
    lock: {
      id: string;
      version: string;
      status: string;
      lockExists: boolean;
      lockPersistenceEnabled: boolean;
      lockEnforcementEnabled: boolean;
      lockCreationEnabled: boolean;
      executionEnabled: boolean;
      executable: boolean;
      lockFields: string[];
      lockRules: string[];
      invalidationTriggers: string[];
      evidenceReferences: string[];
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.lock.id, 'video-orchestrator-controlled-execution-candidate-story-lock');
  assert.equal(body.lock.version, 'phase-5l');
  assert.ok(['blocked', 'disabled'].includes(body.lock.status));
  assert.equal(body.lock.lockExists, false);
  assert.equal(body.lock.lockPersistenceEnabled, false);
  assert.equal(body.lock.lockEnforcementEnabled, false);
  assert.equal(body.lock.lockCreationEnabled, false);
  assert.equal(body.lock.executionEnabled, false);
  assert.equal(body.lock.executable, false);
  assert.ok(body.lock.lockFields.length > 0);
  assert.ok(body.lock.lockRules.length > 0);
  assert.ok(body.lock.invalidationTriggers.length > 0);
  assert.ok(body.lock.evidenceReferences.includes('/video-orchestrator/controlled-execution-first-approval-audit-expiry-model'));

  assert.equal(body.lock.safety.readOnly, true);
  assert.equal(body.lock.safety.lockDesignOnly, true);
  assert.equal(body.lock.safety.lockPersistenceEnabled, false);
  assert.equal(body.lock.safety.lockEnforcementEnabled, false);
  assert.equal(body.lock.safety.createsLock, false);
  assert.equal(body.lock.safety.persistsLock, false);
  assert.equal(body.lock.safety.enforcesLock, false);
  assert.equal(body.lock.safety.createsApproval, false);
  assert.equal(body.lock.safety.createsFirstApproval, false);
  assert.equal(body.lock.safety.createsSecondApproval, false);
  assert.equal(body.lock.safety.approvalExecutionEnabled, false);
  assert.equal(body.lock.safety.registersAction, false);
  assert.equal(body.lock.safety.registersAllowlist, false);
  assert.equal(body.lock.safety.runsValidator, false);
  assert.equal(body.lock.safety.createsExecutionPlan, false);
  assert.equal(body.lock.safety.executionPlanExecutable, false);
  assert.equal(body.lock.safety.executionEnabled, false);
  assert.equal(body.lock.safety.executesStb, false);
  assert.equal(body.lock.safety.executesVideo, false);
  assert.equal(body.lock.safety.writesFiles, false);
  assert.equal(body.lock.safety.rendersVideo, false);
  assert.equal(body.lock.safety.exportsArtifacts, false);
  assert.equal(body.lock.safety.publishesContent, false);
  assert.equal(body.lock.safety.decommissionsStb, false);
  assert.equal(body.lock.safety.writesToMind, false);
});

test('POST /video-orchestrator/controlled-execution-candidate-story-lock is not registered', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/controlled-execution-candidate-story-lock' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /video-orchestrator/controlled-execution-preflight-evidence-hash-design returns blocked hash design', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/controlled-execution-preflight-evidence-hash-design' });
  const body = JSON.parse(response.body) as {
    design: {
      id: string;
      version: string;
      status: string;
      hashDesignExists: boolean;
      hashComputationEnabled: boolean;
      evidencePersistenceEnabled: boolean;
      readsGeneratedArtifacts: boolean;
      validatorExecutionEnabled: boolean;
      lockEnforcementEnabled: boolean;
      executionEnabled: boolean;
      executable: boolean;
      hashInputs: string[];
      hashRules: string[];
      missingRequirements: string[];
      evidenceReferences: string[];
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.design.id, 'video-orchestrator-controlled-execution-preflight-evidence-hash-design');
  assert.equal(body.design.version, 'phase-5m');
  assert.ok(['blocked', 'disabled'].includes(body.design.status));
  assert.equal(body.design.hashDesignExists, false);
  assert.equal(body.design.hashComputationEnabled, false);
  assert.equal(body.design.evidencePersistenceEnabled, false);
  assert.equal(body.design.readsGeneratedArtifacts, false);
  assert.equal(body.design.validatorExecutionEnabled, false);
  assert.equal(body.design.lockEnforcementEnabled, false);
  assert.equal(body.design.executionEnabled, false);
  assert.equal(body.design.executable, false);
  assert.ok(body.design.hashInputs.length > 0);
  assert.ok(body.design.hashRules.length > 0);
  assert.ok(body.design.missingRequirements.length > 0);
  assert.ok(body.design.evidenceReferences.includes('/video-orchestrator/controlled-execution-candidate-story-lock'));

  assert.equal(body.design.safety.readOnly, true);
  assert.equal(body.design.safety.hashDesignOnly, true);
  assert.equal(body.design.safety.hashComputationEnabled, false);
  assert.equal(body.design.safety.evidencePersistenceEnabled, false);
  assert.equal(body.design.safety.readsGeneratedArtifacts, false);
  assert.equal(body.design.safety.createsApproval, false);
  assert.equal(body.design.safety.createsFirstApproval, false);
  assert.equal(body.design.safety.createsSecondApproval, false);
  assert.equal(body.design.safety.approvalExecutionEnabled, false);
  assert.equal(body.design.safety.registersAction, false);
  assert.equal(body.design.safety.registersAllowlist, false);
  assert.equal(body.design.safety.runsValidator, false);
  assert.equal(body.design.safety.createsExecutionPlan, false);
  assert.equal(body.design.safety.executionPlanExecutable, false);
  assert.equal(body.design.safety.executionEnabled, false);
  assert.equal(body.design.safety.executesStb, false);
  assert.equal(body.design.safety.executesVideo, false);
  assert.equal(body.design.safety.writesFiles, false);
  assert.equal(body.design.safety.rendersVideo, false);
  assert.equal(body.design.safety.exportsArtifacts, false);
  assert.equal(body.design.safety.publishesContent, false);
  assert.equal(body.design.safety.decommissionsStb, false);
  assert.equal(body.design.safety.writesToMind, false);
});

test('POST /video-orchestrator/controlled-execution-preflight-evidence-hash-design is not registered', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/controlled-execution-preflight-evidence-hash-design' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /video-orchestrator/controlled-execution-operator-decision-snapshot-design returns blocked snapshot design', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/controlled-execution-operator-decision-snapshot-design' });
  const body = JSON.parse(response.body) as {
    snapshot: {
      id: string;
      version: string;
      status: string;
      snapshotDesignExists: boolean;
      snapshotPersistenceEnabled: boolean;
      decisionQueueMutationEnabled: boolean;
      approvalCreationEnabled: boolean;
      executionEnabled: boolean;
      executable: boolean;
      decisionFields: string[];
      snapshotRules: string[];
      missingRequirements: string[];
      evidenceReferences: string[];
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.snapshot.id, 'video-orchestrator-controlled-execution-operator-decision-snapshot-design');
  assert.equal(body.snapshot.version, 'phase-5n');
  assert.ok(['blocked', 'disabled'].includes(body.snapshot.status));
  assert.equal(body.snapshot.snapshotDesignExists, false);
  assert.equal(body.snapshot.snapshotPersistenceEnabled, false);
  assert.equal(body.snapshot.decisionQueueMutationEnabled, false);
  assert.equal(body.snapshot.approvalCreationEnabled, false);
  assert.equal(body.snapshot.executionEnabled, false);
  assert.equal(body.snapshot.executable, false);
  assert.ok(body.snapshot.decisionFields.length > 0);
  assert.ok(body.snapshot.snapshotRules.length > 0);
  assert.ok(body.snapshot.evidenceReferences.includes('/video-orchestrator/operator-decision-queue'));

  assert.equal(body.snapshot.safety.readOnly, true);
  assert.equal(body.snapshot.safety.snapshotDesignOnly, true);
  assert.equal(body.snapshot.safety.snapshotPersistenceEnabled, false);
  assert.equal(body.snapshot.safety.decisionQueueMutationEnabled, false);
  assert.equal(body.snapshot.safety.createsApproval, false);
  assert.equal(body.snapshot.safety.createsFirstApproval, false);
  assert.equal(body.snapshot.safety.createsSecondApproval, false);
  assert.equal(body.snapshot.safety.approvalExecutionEnabled, false);
  assert.equal(body.snapshot.safety.registersAction, false);
  assert.equal(body.snapshot.safety.registersAllowlist, false);
  assert.equal(body.snapshot.safety.runsValidator, false);
  assert.equal(body.snapshot.safety.createsExecutionPlan, false);
  assert.equal(body.snapshot.safety.executionPlanExecutable, false);
  assert.equal(body.snapshot.safety.executionEnabled, false);
  assert.equal(body.snapshot.safety.executesStb, false);
  assert.equal(body.snapshot.safety.executesVideo, false);
  assert.equal(body.snapshot.safety.writesFiles, false);
  assert.equal(body.snapshot.safety.rendersVideo, false);
  assert.equal(body.snapshot.safety.exportsArtifacts, false);
  assert.equal(body.snapshot.safety.publishesContent, false);
  assert.equal(body.snapshot.safety.decommissionsStb, false);
  assert.equal(body.snapshot.safety.writesToMind, false);
});

test('POST /video-orchestrator/controlled-execution-operator-decision-snapshot-design is not registered', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/controlled-execution-operator-decision-snapshot-design' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /video-orchestrator/controlled-execution-runtime-sandbox-boundary-design returns blocked boundary design', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/controlled-execution-runtime-sandbox-boundary-design' });
  const body = JSON.parse(response.body) as {
    boundary: {
      id: string;
      version: string;
      status: string;
      sandboxDesignExists: boolean;
      sandboxProvisioningEnabled: boolean;
      sandboxExecutionEnabled: boolean;
      filesystemAccessEnabled: boolean;
      networkAccessEnabled: boolean;
      executionEnabled: boolean;
      executable: boolean;
      sandboxBoundaryRules: string[];
      requiredBeforeSandbox: string[];
      missingRequirements: string[];
      evidenceReferences: string[];
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.boundary.id, 'video-orchestrator-controlled-execution-runtime-sandbox-boundary-design');
  assert.equal(body.boundary.version, 'phase-5o');
  assert.ok(['blocked', 'disabled'].includes(body.boundary.status));
  assert.equal(body.boundary.sandboxDesignExists, false);
  assert.equal(body.boundary.sandboxProvisioningEnabled, false);
  assert.equal(body.boundary.sandboxExecutionEnabled, false);
  assert.equal(body.boundary.filesystemAccessEnabled, false);
  assert.equal(body.boundary.networkAccessEnabled, false);
  assert.equal(body.boundary.executionEnabled, false);
  assert.equal(body.boundary.executable, false);
  assert.ok(body.boundary.sandboxBoundaryRules.length > 0);
  assert.ok(body.boundary.requiredBeforeSandbox.length > 0);
  assert.ok(body.boundary.evidenceReferences.includes('/video-orchestrator/controlled-execution-disabled-gate'));

  assert.equal(body.boundary.safety.readOnly, true);
  assert.equal(body.boundary.safety.sandboxDesignOnly, true);
  assert.equal(body.boundary.safety.sandboxProvisioningEnabled, false);
  assert.equal(body.boundary.safety.sandboxExecutionEnabled, false);
  assert.equal(body.boundary.safety.filesystemAccessEnabled, false);
  assert.equal(body.boundary.safety.networkAccessEnabled, false);
  assert.equal(body.boundary.safety.createsApproval, false);
  assert.equal(body.boundary.safety.createsFirstApproval, false);
  assert.equal(body.boundary.safety.createsSecondApproval, false);
  assert.equal(body.boundary.safety.approvalExecutionEnabled, false);
  assert.equal(body.boundary.safety.registersAction, false);
  assert.equal(body.boundary.safety.registersAllowlist, false);
  assert.equal(body.boundary.safety.runsValidator, false);
  assert.equal(body.boundary.safety.createsExecutionPlan, false);
  assert.equal(body.boundary.safety.executionPlanExecutable, false);
  assert.equal(body.boundary.safety.executionEnabled, false);
  assert.equal(body.boundary.safety.executesStb, false);
  assert.equal(body.boundary.safety.executesVideo, false);
  assert.equal(body.boundary.safety.writesFiles, false);
  assert.equal(body.boundary.safety.rendersVideo, false);
  assert.equal(body.boundary.safety.exportsArtifacts, false);
  assert.equal(body.boundary.safety.publishesContent, false);
  assert.equal(body.boundary.safety.decommissionsStb, false);
  assert.equal(body.boundary.safety.writesToMind, false);
});

test('POST /video-orchestrator/controlled-execution-runtime-sandbox-boundary-design is not registered', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/controlled-execution-runtime-sandbox-boundary-design' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /video-orchestrator/controlled-execution-approval-review-audit-design returns blocked review design', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/controlled-execution-approval-review-audit-design' });
  const body = JSON.parse(response.body) as {
    review: {
      id: string;
      version: string;
      status: string;
      reviewDesignExists: boolean;
      auditCaptureEnabled: boolean;
      approvalReviewEnabled: boolean;
      approvalCreationEnabled: boolean;
      approvalExecutionEnabled: boolean;
      executionEnabled: boolean;
      executable: boolean;
      reviewFields: string[];
      reviewRules: string[];
      evidenceReferences: string[];
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.review.id, 'video-orchestrator-controlled-execution-approval-review-audit-design');
  assert.equal(body.review.version, 'phase-5p');
  assert.ok(['blocked', 'disabled'].includes(body.review.status));
  assert.equal(body.review.reviewDesignExists, false);
  assert.equal(body.review.auditCaptureEnabled, false);
  assert.equal(body.review.approvalReviewEnabled, false);
  assert.equal(body.review.approvalCreationEnabled, false);
  assert.equal(body.review.approvalExecutionEnabled, false);
  assert.equal(body.review.executionEnabled, false);
  assert.equal(body.review.executable, false);
  assert.ok(body.review.reviewFields.length > 0);
  assert.ok(body.review.reviewRules.length > 0);
  assert.ok(body.review.evidenceReferences.includes('/video-orchestrator/controlled-execution-operator-decision-snapshot-design'));
  assert.equal(body.review.safety.readOnly, true);
  assert.equal(body.review.safety.reviewDesignOnly, true);
  assert.equal(body.review.safety.persistsAuditEvent, false);
  assert.equal(body.review.safety.createsApproval, false);
  assert.equal(body.review.safety.executionEnabled, false);
});

test('POST /video-orchestrator/controlled-execution-approval-review-audit-design is not registered', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/controlled-execution-approval-review-audit-design' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /video-orchestrator/controlled-execution-immutable-audit-trail-schema returns blocked schema design', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/controlled-execution-immutable-audit-trail-schema' });
  const body = JSON.parse(response.body) as {
    schema: {
      id: string;
      version: string;
      status: string;
      schemaExists: boolean;
      auditTrailPersistenceEnabled: boolean;
      immutableStoreEnabled: boolean;
      appendOnlyWriteEnabled: boolean;
      approvalCreationEnabled: boolean;
      executionEnabled: boolean;
      executable: boolean;
      auditEventTypes: string[];
      auditRecordFields: string[];
      immutabilityRules: string[];
      evidenceReferences: string[];
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.schema.id, 'video-orchestrator-controlled-execution-immutable-audit-trail-schema');
  assert.equal(body.schema.version, 'phase-5q');
  assert.ok(['blocked', 'disabled'].includes(body.schema.status));
  assert.equal(body.schema.schemaExists, false);
  assert.equal(body.schema.auditTrailPersistenceEnabled, false);
  assert.equal(body.schema.immutableStoreEnabled, false);
  assert.equal(body.schema.appendOnlyWriteEnabled, false);
  assert.equal(body.schema.approvalCreationEnabled, false);
  assert.equal(body.schema.executionEnabled, false);
  assert.equal(body.schema.executable, false);
  assert.ok(body.schema.auditEventTypes.length > 0);
  assert.ok(body.schema.auditRecordFields.length > 0);
  assert.ok(body.schema.immutabilityRules.length > 0);
  assert.ok(body.schema.evidenceReferences.includes('/video-orchestrator/controlled-execution-approval-review-audit-design'));
  assert.equal(body.schema.safety.readOnly, true);
  assert.equal(body.schema.safety.schemaDesignOnly, true);
  assert.equal(body.schema.safety.appendOnlyWriteEnabled, false);
  assert.equal(body.schema.safety.createsApproval, false);
  assert.equal(body.schema.safety.executionEnabled, false);
});

test('POST /video-orchestrator/controlled-execution-immutable-audit-trail-schema is not registered', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/controlled-execution-immutable-audit-trail-schema' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /video-orchestrator/controlled-execution-audit-compliance-evidence-packet-design returns blocked packet design', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/controlled-execution-audit-compliance-evidence-packet-design' });
  const body = JSON.parse(response.body) as {
    packet: {
      id: string;
      version: string;
      status: string;
      packetDesignExists: boolean;
      packetGenerationEnabled: boolean;
      evidenceCollectionEnabled: boolean;
      auditTrailPersistenceEnabled: boolean;
      approvalCreationEnabled: boolean;
      executionEnabled: boolean;
      executable: boolean;
      packetSections: string[];
      complianceRules: string[];
      evidenceReferences: string[];
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.packet.id, 'video-orchestrator-controlled-execution-audit-compliance-evidence-packet-design');
  assert.equal(body.packet.version, 'phase-5r');
  assert.ok(['blocked', 'disabled'].includes(body.packet.status));
  assert.equal(body.packet.packetDesignExists, false);
  assert.equal(body.packet.packetGenerationEnabled, false);
  assert.equal(body.packet.evidenceCollectionEnabled, false);
  assert.equal(body.packet.auditTrailPersistenceEnabled, false);
  assert.equal(body.packet.approvalCreationEnabled, false);
  assert.equal(body.packet.executionEnabled, false);
  assert.equal(body.packet.executable, false);
  assert.ok(body.packet.packetSections.length > 0);
  assert.ok(body.packet.complianceRules.length > 0);
  assert.ok(body.packet.evidenceReferences.includes('/video-orchestrator/controlled-execution-immutable-audit-trail-schema'));
  assert.equal(body.packet.safety.readOnly, true);
  assert.equal(body.packet.safety.packetDesignOnly, true);
  assert.equal(body.packet.safety.packetGenerationEnabled, false);
  assert.equal(body.packet.safety.evidenceCollectionEnabled, false);
  assert.equal(body.packet.safety.createsApproval, false);
  assert.equal(body.packet.safety.executionEnabled, false);
});

test('POST /video-orchestrator/controlled-execution-audit-compliance-evidence-packet-design is not registered', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/controlled-execution-audit-compliance-evidence-packet-design' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /video-orchestrator/controlled-execution-implementation-readiness-checkpoint returns design phase complete', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/controlled-execution-implementation-readiness-checkpoint' });
  const body = JSON.parse(response.body) as {
    checkpoint: {
      id: string;
      version: string;
      status: string;
      designPhaseComplete: boolean;
      implementationPlanningEnabled: boolean;
      implementationExecutionEnabled: boolean;
      executionEnabled: boolean;
      executable: boolean;
      summary: {
        completedDesignPhaseCount: number;
        blockingRequirementCount: number;
        requiredImplementationPlanCount: number;
        safetyBoundaryCount: number;
      };
      completedDesignPhases: string[];
      requiredImplementationPlans: string[];
      blockingRequirements: string[];
      evidenceReferences: string[];
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.checkpoint.id, 'video-orchestrator-controlled-execution-implementation-readiness-checkpoint');
  assert.equal(body.checkpoint.version, 'phase-6a');
  assert.ok(['not-ready', 'ready'].includes(body.checkpoint.status));
  assert.equal(body.checkpoint.designPhaseComplete, true);
  assert.equal(body.checkpoint.implementationPlanningEnabled, true);
  assert.equal(body.checkpoint.implementationExecutionEnabled, false);
  assert.equal(body.checkpoint.executionEnabled, false);
  assert.equal(body.checkpoint.executable, false);
  assert.equal(body.checkpoint.summary.completedDesignPhaseCount, 18);
  assert.ok(body.checkpoint.summary.blockingRequirementCount > 0);
  assert.ok(body.checkpoint.summary.requiredImplementationPlanCount > 0);
  assert.ok(body.checkpoint.completedDesignPhases.length === 18);
  assert.ok(body.checkpoint.requiredImplementationPlans.length > 0);
  assert.ok(body.checkpoint.blockingRequirements.length > 0);
  assert.ok(body.checkpoint.evidenceReferences.includes('/video-orchestrator/controlled-execution-approval-payload-schema'));

  assert.equal(body.checkpoint.safety.readOnly, true);
  assert.equal(body.checkpoint.safety.checkpointOnly, true);
  assert.equal(body.checkpoint.safety.designPhaseComplete, true);
  assert.equal(body.checkpoint.safety.implementationPlanningEnabled, true);
  assert.equal(body.checkpoint.safety.implementationExecutionEnabled, false);
  assert.equal(body.checkpoint.safety.featureFlagsEnabled, false);
  assert.equal(body.checkpoint.safety.persistenceEnabled, false);
  assert.equal(body.checkpoint.safety.approvalCreationEnabled, false);
  assert.equal(body.checkpoint.safety.validatorExecutionEnabled, false);
  assert.equal(body.checkpoint.safety.lockPersistenceEnabled, false);
  assert.equal(body.checkpoint.safety.auditPersistenceEnabled, false);
  assert.equal(body.checkpoint.safety.sandboxProvisioningEnabled, false);
  assert.equal(body.checkpoint.safety.createsApproval, false);
  assert.equal(body.checkpoint.safety.createsExecutionPlan, false);
  assert.equal(body.checkpoint.safety.executionEnabled, false);
  assert.equal(body.checkpoint.safety.writesFiles, false);
});

test('POST /video-orchestrator/controlled-execution-implementation-readiness-checkpoint is not registered', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/controlled-execution-implementation-readiness-checkpoint' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /video-orchestrator/controlled-execution-feature-flag-rollout-plan returns plan design', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/controlled-execution-feature-flag-rollout-plan' });
  const body = JSON.parse(response.body) as {
    plan: {
      id: string;
      version: string;
      status: string;
      planExists: boolean;
      featureFlagFrameworkEnabled: boolean;
      flagEvaluationEnabled: boolean;
      rolloutExecutionEnabled: boolean;
      implementationExecutionEnabled: boolean;
      executionEnabled: boolean;
      executable: boolean;
      proposedFlags: string[];
      rolloutPhases: string[];
      gatingRules: string[];
      blockingRequirements: string[];
      evidenceReferences: string[];
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.plan.id, 'video-orchestrator-controlled-execution-feature-flag-rollout-plan');
  assert.equal(body.plan.version, 'phase-6b');
  assert.ok(['not-ready', 'ready'].includes(body.plan.status));
  assert.equal(body.plan.planExists, false);
  assert.equal(body.plan.featureFlagFrameworkEnabled, false);
  assert.equal(body.plan.flagEvaluationEnabled, false);
  assert.equal(body.plan.rolloutExecutionEnabled, false);
  assert.equal(body.plan.implementationExecutionEnabled, false);
  assert.equal(body.plan.executionEnabled, false);
  assert.equal(body.plan.executable, false);
  assert.ok(body.plan.proposedFlags.length === 10);
  assert.ok(body.plan.proposedFlags.every(f => f.endsWith('.enabled')));
  assert.ok(body.plan.rolloutPhases.length > 0);
  assert.ok(body.plan.gatingRules.length > 0);
  assert.ok(body.plan.blockingRequirements.length > 0);
  assert.ok(body.plan.evidenceReferences.includes('/video-orchestrator/controlled-execution-implementation-readiness-checkpoint'));

  assert.equal(body.plan.safety.readOnly, true);
  assert.equal(body.plan.safety.planDesignOnly, true);
  assert.equal(body.plan.safety.featureFlagFrameworkEnabled, false);
  assert.equal(body.plan.safety.flagEvaluationEnabled, false);
  assert.equal(body.plan.safety.featureFlagsEnabled, false);
  assert.equal(body.plan.safety.persistenceEnabled, false);
  assert.equal(body.plan.safety.approvalCreationEnabled, false);
  assert.equal(body.plan.safety.validatorExecutionEnabled, false);
  assert.equal(body.plan.safety.sandboxProvisioningEnabled, false);
  assert.equal(body.plan.safety.executionEnabled, false);
  assert.equal(body.plan.safety.writesFiles, false);
});

test('POST /video-orchestrator/controlled-execution-feature-flag-rollout-plan is not registered', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/controlled-execution-feature-flag-rollout-plan' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /video-orchestrator/controlled-execution-approval-store-implementation-plan returns plan design', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/controlled-execution-approval-store-implementation-plan' });
  const body = JSON.parse(response.body) as {
    plan: {
      id: string;
      version: string;
      status: string;
      planExists: boolean;
      approvalStoreEnabled: boolean;
      persistenceEnabled: boolean;
      approvalCreationEnabled: boolean;
      approvalExecutionEnabled: boolean;
      expiryEnforcementEnabled: boolean;
      revocationEnabled: boolean;
      auditLinkingEnabled: boolean;
      implementationExecutionEnabled: boolean;
      executionEnabled: boolean;
      executable: boolean;
      proposedSchema: string[];
      lifecycleStates: string[];
      storageRequirements: string[];
      blockingRequirements: string[];
      evidenceReferences: string[];
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.plan.id, 'video-orchestrator-controlled-execution-approval-store-implementation-plan');
  assert.equal(body.plan.version, 'phase-6c');
  assert.ok(['not-ready', 'ready'].includes(body.plan.status));
  assert.equal(body.plan.planExists, false);
  assert.equal(body.plan.approvalStoreEnabled, false);
  assert.equal(body.plan.persistenceEnabled, false);
  assert.equal(body.plan.approvalCreationEnabled, false);
  assert.equal(body.plan.approvalExecutionEnabled, false);
  assert.equal(body.plan.expiryEnforcementEnabled, false);
  assert.equal(body.plan.revocationEnabled, false);
  assert.equal(body.plan.auditLinkingEnabled, false);
  assert.equal(body.plan.implementationExecutionEnabled, false);
  assert.equal(body.plan.executionEnabled, false);
  assert.equal(body.plan.executable, false);
  assert.ok(body.plan.proposedSchema.includes('approvalId'));
  assert.ok(body.plan.proposedSchema.includes('status'));
  assert.ok(body.plan.proposedSchema.includes('expiresAt'));
  assert.ok(body.plan.proposedSchema.includes('revokedAt'));
  assert.ok(body.plan.proposedSchema.includes('invalidatedAt'));
  assert.ok(body.plan.proposedSchema.includes('auditTrailRef'));
  assert.ok(body.plan.lifecycleStates.includes('execution_still_disabled'));
  assert.ok(body.plan.storageRequirements.length > 0);
  assert.ok(body.plan.blockingRequirements.length > 0);
  assert.ok(body.plan.evidenceReferences.includes('/video-orchestrator/controlled-execution-feature-flag-rollout-plan'));

  assert.equal(body.plan.safety.readOnly, true);
  assert.equal(body.plan.safety.planDesignOnly, true);
  assert.equal(body.plan.safety.approvalStoreEnabled, false);
  assert.equal(body.plan.safety.persistenceEnabled, false);
  assert.equal(body.plan.safety.expiryEnforcementEnabled, false);
  assert.equal(body.plan.safety.revocationEnabled, false);
  assert.equal(body.plan.safety.auditLinkingEnabled, false);
  assert.equal(body.plan.safety.createsApproval, false);
  assert.equal(body.plan.safety.executionEnabled, false);
  assert.equal(body.plan.safety.writesFiles, false);
});

test('POST /video-orchestrator/controlled-execution-approval-store-implementation-plan is not registered', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/controlled-execution-approval-store-implementation-plan' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /video-orchestrator/controlled-execution-first-approval-creation-implementation-plan returns plan design', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/controlled-execution-first-approval-creation-implementation-plan' });
  const body = JSON.parse(response.body) as {
    plan: {
      id: string;
      version: string;
      status: string;
      planExists: boolean;
      firstApprovalCreationEnabled: boolean;
      approvalCreationEnabled: boolean;
      approvalStoreEnabled: boolean;
      persistenceEnabled: boolean;
      operatorVerificationEnabled: boolean;
      roleEnforcementEnabled: boolean;
      scopeValidationEnabled: boolean;
      evidenceCaptureEnabled: boolean;
      implementationExecutionEnabled: boolean;
      executionEnabled: boolean;
      executable: boolean;
      summary: Record<string, number>;
      requiredInputs: string[];
      validationSteps: string[];
      outputRecordShape: string[];
      implementationGates: string[];
      blockingRequirements: string[];
      evidenceReferences: string[];
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.plan.id, 'video-orchestrator-controlled-execution-first-approval-creation-implementation-plan');
  assert.equal(body.plan.version, 'phase-6d');
  assert.ok(['not-ready', 'ready'].includes(body.plan.status));
  assert.equal(body.plan.planExists, false);
  assert.equal(body.plan.firstApprovalCreationEnabled, false);
  assert.equal(body.plan.approvalCreationEnabled, false);
  assert.equal(body.plan.approvalStoreEnabled, false);
  assert.equal(body.plan.persistenceEnabled, false);
  assert.equal(body.plan.operatorVerificationEnabled, false);
  assert.equal(body.plan.roleEnforcementEnabled, false);
  assert.equal(body.plan.scopeValidationEnabled, false);
  assert.equal(body.plan.evidenceCaptureEnabled, false);
  assert.equal(body.plan.implementationExecutionEnabled, false);
  assert.equal(body.plan.executionEnabled, false);
  assert.equal(body.plan.executable, false);
  assert.ok(body.plan.requiredInputs.includes('candidateStoryId'));
  assert.ok(body.plan.requiredInputs.includes('sourceEpisodeId'));
  assert.ok(body.plan.requiredInputs.includes('operatorIdentity'));
  assert.ok(body.plan.requiredInputs.includes('operatorRole'));
  assert.ok(body.plan.validationSteps.includes('verify approval does not authorize execution'));
  assert.ok(body.plan.validationSteps.includes('verify second approval remains required'));
  assert.ok(body.plan.outputRecordShape.includes('approvalType: first_approval'));
  assert.ok(body.plan.outputRecordShape.includes('status: first_approval_pending'));
  assert.ok(body.plan.implementationGates.length > 0);
  assert.ok(body.plan.blockingRequirements.length > 0);
  assert.ok(body.plan.evidenceReferences.includes('/video-orchestrator/controlled-execution-approval-store-implementation-plan'));

  assert.equal(body.plan.safety.readOnly, true);
  assert.equal(body.plan.safety.planDesignOnly, true);
  assert.equal(body.plan.safety.firstApprovalCreationEnabled, false);
  assert.equal(body.plan.safety.approvalCreationEnabled, false);
  assert.equal(body.plan.safety.approvalStoreEnabled, false);
  assert.equal(body.plan.safety.persistenceEnabled, false);
  assert.equal(body.plan.safety.operatorVerificationEnabled, false);
  assert.equal(body.plan.safety.roleEnforcementEnabled, false);
  assert.equal(body.plan.safety.scopeValidationEnabled, false);
  assert.equal(body.plan.safety.evidenceCaptureEnabled, false);
  assert.equal(body.plan.safety.createsApproval, false);
  assert.equal(body.plan.safety.createsFirstApproval, false);
  assert.equal(body.plan.safety.executionEnabled, false);
  assert.equal(body.plan.safety.writesFiles, false);
});

test('POST /video-orchestrator/controlled-execution-first-approval-creation-implementation-plan is not registered', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/controlled-execution-first-approval-creation-implementation-plan' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /video-orchestrator/controlled-execution-second-approval-creation-implementation-plan returns plan design', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/controlled-execution-second-approval-creation-implementation-plan' });
  const body = JSON.parse(response.body) as {
    plan: {
      id: string;
      version: string;
      status: string;
      planExists: boolean;
      secondApprovalCreationEnabled: boolean;
      firstApprovalCreationEnabled: boolean;
      approvalCreationEnabled: boolean;
      approvalStoreEnabled: boolean;
      persistenceEnabled: boolean;
      operatorVerificationEnabled: boolean;
      roleEnforcementEnabled: boolean;
      firstApprovalRequired: boolean;
      firstApprovalVerificationEnabled: boolean;
      scopeValidationEnabled: boolean;
      evidenceCaptureEnabled: boolean;
      implementationExecutionEnabled: boolean;
      executionEnabled: boolean;
      executable: boolean;
      summary: Record<string, number>;
      requiredInputs: string[];
      validationSteps: string[];
      outputRecordShape: string[];
      implementationGates: string[];
      blockingRequirements: string[];
      evidenceReferences: string[];
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.plan.id, 'video-orchestrator-controlled-execution-second-approval-creation-implementation-plan');
  assert.equal(body.plan.version, 'phase-6e');
  assert.ok(['not-ready', 'ready'].includes(body.plan.status));
  assert.equal(body.plan.planExists, false);
  assert.equal(body.plan.secondApprovalCreationEnabled, false);
  assert.equal(body.plan.firstApprovalCreationEnabled, false);
  assert.equal(body.plan.approvalCreationEnabled, false);
  assert.equal(body.plan.approvalStoreEnabled, false);
  assert.equal(body.plan.persistenceEnabled, false);
  assert.equal(body.plan.operatorVerificationEnabled, false);
  assert.equal(body.plan.roleEnforcementEnabled, false);
  assert.equal(body.plan.firstApprovalRequired, true);
  assert.equal(body.plan.firstApprovalVerificationEnabled, false);
  assert.equal(body.plan.scopeValidationEnabled, false);
  assert.equal(body.plan.evidenceCaptureEnabled, false);
  assert.equal(body.plan.implementationExecutionEnabled, false);
  assert.equal(body.plan.executionEnabled, false);
  assert.equal(body.plan.executable, false);
  assert.ok(body.plan.requiredInputs.includes('firstApprovalId'));
  assert.ok(body.plan.requiredInputs.includes('secondOperatorIdentity'));
  assert.ok(body.plan.requiredInputs.includes('secondOperatorRole'));
  assert.ok(body.plan.validationSteps.includes('verify first approval exists and is valid'));
  assert.ok(body.plan.validationSteps.includes('verify second operator differs from first operator'));
  assert.ok(body.plan.validationSteps.includes('verify second approval does not authorize execution'));
  assert.ok(body.plan.validationSteps.includes('verify execution remains disabled until runner plan is approved'));
  assert.ok(body.plan.outputRecordShape.includes('approvalType: second_approval'));
  assert.ok(body.plan.outputRecordShape.includes('status: second_approval_pending'));
  assert.ok(body.plan.outputRecordShape.includes('firstApprovalId'));
  assert.ok(body.plan.implementationGates.length > 0);
  assert.ok(body.plan.blockingRequirements.length > 0);
  assert.ok(body.plan.evidenceReferences.includes('/video-orchestrator/controlled-execution-first-approval-creation-implementation-plan'));

  assert.equal(body.plan.safety.readOnly, true);
  assert.equal(body.plan.safety.planDesignOnly, true);
  assert.equal(body.plan.safety.secondApprovalCreationEnabled, false);
  assert.equal(body.plan.safety.firstApprovalCreationEnabled, false);
  assert.equal(body.plan.safety.approvalCreationEnabled, false);
  assert.equal(body.plan.safety.approvalStoreEnabled, false);
  assert.equal(body.plan.safety.persistenceEnabled, false);
  assert.equal(body.plan.safety.operatorVerificationEnabled, false);
  assert.equal(body.plan.safety.roleEnforcementEnabled, false);
  assert.equal(body.plan.safety.firstApprovalVerificationEnabled, false);
  assert.equal(body.plan.safety.createsApproval, false);
  assert.equal(body.plan.safety.createsSecondApproval, false);
  assert.equal(body.plan.safety.executionEnabled, false);
  assert.equal(body.plan.safety.writesFiles, false);
});

test('POST /video-orchestrator/controlled-execution-second-approval-creation-implementation-plan is not registered', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/controlled-execution-second-approval-creation-implementation-plan' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /video-orchestrator/controlled-execution-validator-implementation-plan returns plan design', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/controlled-execution-validator-implementation-plan' });
  const body = JSON.parse(response.body) as {
    plan: {
      id: string;
      version: string;
      status: string;
      planExists: boolean;
      validatorExecutionEnabled: boolean;
      dryRunEnabled: boolean;
      persistenceEnabled: boolean;
      approvalCreationEnabled: boolean;
      implementationExecutionEnabled: boolean;
      executionEnabled: boolean;
      executable: boolean;
      summary: Record<string, number>;
      requiredInputs: string[];
      validationRules: string[];
      outputRecordShape: string[];
      implementationGates: string[];
      blockingRequirements: string[];
      evidenceReferences: string[];
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.plan.id, 'video-orchestrator-controlled-execution-validator-implementation-plan');
  assert.equal(body.plan.version, 'phase-6f');
  assert.ok(['not-ready', 'ready'].includes(body.plan.status));
  assert.equal(body.plan.planExists, false);
  assert.equal(body.plan.validatorExecutionEnabled, false);
  assert.equal(body.plan.dryRunEnabled, false);
  assert.equal(body.plan.persistenceEnabled, false);
  assert.equal(body.plan.approvalCreationEnabled, false);
  assert.equal(body.plan.implementationExecutionEnabled, false);
  assert.equal(body.plan.executionEnabled, false);
  assert.equal(body.plan.executable, false);
  assert.ok(body.plan.requiredInputs.includes('candidateStoryId'));
  assert.ok(body.plan.requiredInputs.includes('preflightValidatorSchemaRef'));
  assert.ok(body.plan.validationRules.includes('verify dry-run produces no real output'));
  assert.ok(body.plan.validationRules.includes('verify no persistence of validation results'));
  assert.ok(body.plan.outputRecordShape.includes('validationReportId'));
  assert.ok(body.plan.outputRecordShape.includes('passedRuleCount'));
  assert.ok(body.plan.outputRecordShape.includes('blockedRuleCount'));
  assert.ok(body.plan.implementationGates.length > 0);
  assert.ok(body.plan.blockingRequirements.length > 0);
  assert.ok(body.plan.evidenceReferences.includes('/video-orchestrator/controlled-execution-preflight-validator-schema'));

  assert.equal(body.plan.safety.readOnly, true);
  assert.equal(body.plan.safety.planDesignOnly, true);
  assert.equal(body.plan.safety.validatorExecutionEnabled, false);
  assert.equal(body.plan.safety.dryRunEnabled, false);
  assert.equal(body.plan.safety.persistenceEnabled, false);
  assert.equal(body.plan.safety.approvalCreationEnabled, false);
  assert.equal(body.plan.safety.createsApproval, false);
  assert.equal(body.plan.safety.executionEnabled, false);
  assert.equal(body.plan.safety.writesFiles, false);
});

test('POST /video-orchestrator/controlled-execution-validator-implementation-plan is not registered', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/controlled-execution-validator-implementation-plan' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /video-orchestrator/controlled-execution-execution-plan-implementation-plan returns plan design', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/controlled-execution-execution-plan-implementation-plan' });
  const body = JSON.parse(response.body) as {
    plan: {
      id: string;
      version: string;
      status: string;
      planExists: boolean;
      executionPlanEnabled: boolean;
      planExecutionEnabled: boolean;
      persistenceEnabled: boolean;
      approvalCreationEnabled: boolean;
      implementationExecutionEnabled: boolean;
      executionEnabled: boolean;
      executable: boolean;
      summary: Record<string, number>;
      requiredInputs: string[];
      executionPlanSteps: string[];
      outputRecordShape: string[];
      implementationGates: string[];
      blockingRequirements: string[];
      evidenceReferences: string[];
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.plan.id, 'video-orchestrator-controlled-execution-execution-plan-implementation-plan');
  assert.equal(body.plan.version, 'phase-6g');
  assert.ok(['not-ready', 'ready'].includes(body.plan.status));
  assert.equal(body.plan.planExists, false);
  assert.equal(body.plan.executionPlanEnabled, false);
  assert.equal(body.plan.planExecutionEnabled, false);
  assert.equal(body.plan.persistenceEnabled, false);
  assert.equal(body.plan.approvalCreationEnabled, false);
  assert.equal(body.plan.implementationExecutionEnabled, false);
  assert.equal(body.plan.executionEnabled, false);
  assert.equal(body.plan.executable, false);
  assert.ok(body.plan.requiredInputs.includes('candidateStoryId'));
  assert.ok(body.plan.requiredInputs.includes('firstApprovalId'));
  assert.ok(body.plan.requiredInputs.includes('secondApprovalId'));
  assert.ok(body.plan.executionPlanSteps.includes('load validated story fixtures'));
  assert.ok(body.plan.executionPlanSteps.includes('mark candidate as execution-pending'));
  assert.ok(body.plan.executionPlanSteps.includes('stage execution without running'));
  assert.ok(body.plan.outputRecordShape.includes('planStatus: execution_planned_not_running'));
  assert.ok(body.plan.outputRecordShape.includes('preExecutionStateSnapshot'));
  assert.ok(body.plan.implementationGates.length > 0);
  assert.ok(body.plan.blockingRequirements.length > 0);

  assert.equal(body.plan.safety.readOnly, true);
  assert.equal(body.plan.safety.planDesignOnly, true);
  assert.equal(body.plan.safety.executionPlanEnabled, false);
  assert.equal(body.plan.safety.planExecutionEnabled, false);
  assert.equal(body.plan.safety.persistenceEnabled, false);
  assert.equal(body.plan.safety.executionEnabled, false);
  assert.equal(body.plan.safety.executesStb, false);
  assert.equal(body.plan.safety.writesFiles, false);
});

test('POST /video-orchestrator/controlled-execution-execution-plan-implementation-plan is not registered', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/controlled-execution-execution-plan-implementation-plan' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /video-orchestrator/controlled-execution-rollback-cleanup-implementation-plan returns plan design', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/controlled-execution-rollback-cleanup-implementation-plan' });
  const body = JSON.parse(response.body) as {
    plan: {
      id: string;
      version: string;
      status: string;
      rollbackAcceptanceEnabled: boolean;
      cleanupExecutionEnabled: boolean;
      rollbackExecutionEnabled: boolean;
      artifactDeletionEnabled: boolean;
      executionEnabled: boolean;
      rollbackRequirements: string[];
      cleanupPlanSteps: string[];
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.plan.version, 'phase-6h');
  assert.equal(body.plan.rollbackAcceptanceEnabled, false);
  assert.equal(body.plan.cleanupExecutionEnabled, false);
  assert.equal(body.plan.rollbackExecutionEnabled, false);
  assert.equal(body.plan.artifactDeletionEnabled, false);
  assert.equal(body.plan.executionEnabled, false);
  assert.ok(body.plan.cleanupPlanSteps.includes('block actual cleanup execution'));
  assert.equal(body.plan.safety.deletesFiles, false);
  assert.equal(body.plan.safety.filesystemAccessEnabled, false);
});

test('POST /video-orchestrator/controlled-execution-rollback-cleanup-implementation-plan is not registered', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/controlled-execution-rollback-cleanup-implementation-plan' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /video-orchestrator/controlled-execution-sandbox-provisioning-implementation-plan returns plan design', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/controlled-execution-sandbox-provisioning-implementation-plan' });
  const body = JSON.parse(response.body) as {
    plan: {
      id: string;
      version: string;
      status: string;
      sandboxProvisioningEnabled: boolean;
      sandboxCreationEnabled: boolean;
      filesystemAccessEnabled: boolean;
      networkAccessEnabled: boolean;
      executionEnabled: boolean;
      sandboxRequirements: string[];
      boundaryRules: string[];
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.plan.version, 'phase-6i');
  assert.equal(body.plan.sandboxProvisioningEnabled, false);
  assert.equal(body.plan.sandboxCreationEnabled, false);
  assert.equal(body.plan.filesystemAccessEnabled, false);
  assert.equal(body.plan.networkAccessEnabled, false);
  assert.equal(body.plan.executionEnabled, false);
  assert.ok(body.plan.boundaryRules.includes('sandbox cannot authorize execution'));
  assert.equal(body.plan.safety.filesystemAccessEnabled, false);
  assert.equal(body.plan.safety.networkAccessEnabled, false);
});

test('POST /video-orchestrator/controlled-execution-sandbox-provisioning-implementation-plan is not registered', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/controlled-execution-sandbox-provisioning-implementation-plan' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /video-orchestrator/controlled-execution-sandbox-execution-implementation-plan returns plan design', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/controlled-execution-sandbox-execution-implementation-plan' });
  const body = JSON.parse(response.body) as {
    plan: {
      id: string;
      version: string;
      status: string;
      sandboxExecutionEnabled: boolean;
      runnerExecutionEnabled: boolean;
      dryRunExecutionEnabled: boolean;
      filesystemAccessEnabled: boolean;
      networkAccessEnabled: boolean;
      executionEnabled: boolean;
      executionPreconditions: string[];
      runnerBoundaryRules: string[];
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.plan.version, 'phase-6j');
  assert.equal(body.plan.sandboxExecutionEnabled, false);
  assert.equal(body.plan.runnerExecutionEnabled, false);
  assert.equal(body.plan.dryRunExecutionEnabled, false);
  assert.equal(body.plan.filesystemAccessEnabled, false);
  assert.equal(body.plan.networkAccessEnabled, false);
  assert.equal(body.plan.executionEnabled, false);
  assert.ok(body.plan.runnerBoundaryRules.includes('runner cannot execute shell text'));
  assert.ok(body.plan.runnerBoundaryRules.includes('runner must produce report-only result until explicit execution approval'));
  assert.equal(body.plan.safety.executionEnabled, false);
  assert.equal(body.plan.safety.writesFiles, false);
});

test('POST /video-orchestrator/controlled-execution-sandbox-execution-implementation-plan is not registered', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/controlled-execution-sandbox-execution-implementation-plan' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /video-orchestrator/controlled-execution-sandbox-teardown-recovery-implementation-plan returns plan design', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/controlled-execution-sandbox-teardown-recovery-implementation-plan' });
  const body = JSON.parse(response.body) as {
    plan: {
      version: string;
      sandboxTeardownEnabled: boolean;
      recoveryExecutionEnabled: boolean;
      executionEnabled: boolean;
      recoverySteps: string[];
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.plan.version, 'phase-6k');
  assert.equal(body.plan.sandboxTeardownEnabled, false);
  assert.equal(body.plan.recoveryExecutionEnabled, false);
  assert.equal(body.plan.executionEnabled, false);
  assert.ok(body.plan.recoverySteps.includes('block actual teardown and recovery execution'));
  assert.equal(body.plan.safety.deletesFiles, false);
});

test('POST /video-orchestrator/controlled-execution-sandbox-teardown-recovery-implementation-plan is not registered', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/controlled-execution-sandbox-teardown-recovery-implementation-plan' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /video-orchestrator/controlled-execution-artifact-policy-implementation-plan returns plan design', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/controlled-execution-artifact-policy-implementation-plan' });
  const body = JSON.parse(response.body) as {
    plan: {
      version: string;
      artifactPolicyEnabled: boolean;
      artifactGenerationEnabled: boolean;
      renderingEnabled: boolean;
      executionEnabled: boolean;
      artifactBoundaryRules: string[];
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.plan.version, 'phase-6l');
  assert.equal(body.plan.artifactPolicyEnabled, false);
  assert.equal(body.plan.artifactGenerationEnabled, false);
  assert.equal(body.plan.renderingEnabled, false);
  assert.equal(body.plan.executionEnabled, false);
  assert.ok(body.plan.artifactBoundaryRules.includes('artifact export cannot authorize publishing'));
  assert.equal(body.plan.safety.exportsArtifacts, false);
});

test('POST /video-orchestrator/controlled-execution-artifact-policy-implementation-plan is not registered', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/controlled-execution-artifact-policy-implementation-plan' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /video-orchestrator/controlled-execution-stb-protection-decommission-prevention-plan returns plan design', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/controlled-execution-stb-protection-decommission-prevention-plan' });
  const body = JSON.parse(response.body) as {
    plan: {
      version: string;
      stbProtectionEnabled: boolean;
      decommissionPreventionEnabled: boolean;
      stbMutationEnabled: boolean;
      decommissionEnabled: boolean;
      executionEnabled: boolean;
      decommissionGuards: string[];
      protectionRequirements: string[];
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.plan.version, 'phase-6m');
  assert.equal(body.plan.stbProtectionEnabled, false);
  assert.equal(body.plan.decommissionPreventionEnabled, false);
  assert.equal(body.plan.stbMutationEnabled, false);
  assert.equal(body.plan.decommissionEnabled, false);
  assert.equal(body.plan.executionEnabled, false);
  assert.ok(body.plan.decommissionGuards.includes('no decommission from controlled execution path'));
  assert.ok(body.plan.protectionRequirements.includes('controlled execution cannot mutate STB state'));
  assert.equal(body.plan.safety.decommissionsStb, false);
});

test('POST /video-orchestrator/controlled-execution-stb-protection-decommission-prevention-plan is not registered', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/controlled-execution-stb-protection-decommission-prevention-plan' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /video-orchestrator/controlled-execution-implementation-completion-readiness-checkpoint returns checkpoint', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/controlled-execution-implementation-completion-readiness-checkpoint' });
  const body = JSON.parse(response.body) as {
    checkpoint: {
      version: string;
      planningPhaseComplete: boolean;
      completedPlanningPhaseCount: number;
      requiredPlanningPhaseCount: number;
      remainingPlanningPhaseCount: number;
      implementationExecutionEnabled: boolean;
      executionEnabled: boolean;
      completedPlanningPhases: string[];
      remainingPlanningPhases: string[];
      readinessBlockers: string[];
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.checkpoint.version, 'phase-6n');
  assert.equal(body.checkpoint.planningPhaseComplete, false);
  assert.equal(body.checkpoint.completedPlanningPhaseCount, 13);
  assert.equal(body.checkpoint.requiredPlanningPhaseCount, 17);
  assert.equal(body.checkpoint.remainingPlanningPhaseCount, 4);
  assert.equal(body.checkpoint.implementationExecutionEnabled, false);
  assert.equal(body.checkpoint.executionEnabled, false);
  assert.ok(body.checkpoint.completedPlanningPhases.includes('6M STB protection decommission prevention plan'));
  assert.ok(body.checkpoint.remainingPlanningPhases.includes('6O operator UX and console controls implementation plan'));
  assert.ok(body.checkpoint.readinessBlockers.includes('no explicit user approval to begin Phase 7'));
  assert.equal(body.checkpoint.safety.executionEnabled, false);
});

test('POST /video-orchestrator/controlled-execution-implementation-completion-readiness-checkpoint is not registered', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/controlled-execution-implementation-completion-readiness-checkpoint' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});
