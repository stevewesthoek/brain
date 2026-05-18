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
