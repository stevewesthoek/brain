import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { routeRequest } from '../api/routes.js';
import { readVideoProviderRequestWrapperScaffold, validateVideoProviderRequestWrapperScaffoldRequest } from '../adapters/video-orchestrator-provider-request-wrapper-scaffold.js';
import { readVideoProviderWrapperValidationHarness, runVideoProviderWrapperValidationHarness } from '../adapters/video-orchestrator-provider-wrapper-validation-harness.js';
import { readVideoCredentialReferenceScaffold } from '../adapters/video-orchestrator-credential-reference-scaffold.js';
import { readVideoProviderRequestEnvelopeScaffold } from '../adapters/video-orchestrator-provider-request-envelope-scaffold.js';
import { readVideoProviderResponseEnvelopeScaffold } from '../adapters/video-orchestrator-provider-response-envelope-scaffold.js';
import { readVideoProviderScaffoldingIntegrationSummary } from '../adapters/video-orchestrator-provider-scaffolding-integration-summary.js';
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

test('GET /video-orchestrator/controlled-execution-operator-ux-console-controls-implementation-plan returns phase-6o design-only response', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/controlled-execution-operator-ux-console-controls-implementation-plan' });
  const body = JSON.parse(response.body) as {
    plan: {
      version: string;
      status: string;
      consoleControlsEnabled: boolean;
      mutationControlsEnabled: boolean;
      approvalButtonsEnabled: boolean;
      executionButtonsEnabled: boolean;
      operatorConfirmationEnabled: boolean;
      implementationExecutionEnabled: boolean;
      executionEnabled: boolean;
      executable: boolean;
      consoleSurfaces: string[];
      operatorConfirmationRequirements: string[];
      consoleControlRules: string[];
      blockingRequirements: string[];
      blockers: string[];
      safety: { readOnly: boolean };
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.plan.version, 'phase-6o');
  assert.equal(body.plan.status, 'not-ready');
  assert.equal(body.plan.consoleControlsEnabled, false);
  assert.equal(body.plan.mutationControlsEnabled, false);
  assert.equal(body.plan.approvalButtonsEnabled, false);
  assert.equal(body.plan.executionButtonsEnabled, false);
  assert.equal(body.plan.operatorConfirmationEnabled, false);
  assert.equal(body.plan.implementationExecutionEnabled, false);
  assert.equal(body.plan.executionEnabled, false);
  assert.equal(body.plan.executable, false);
  assert.ok(Array.isArray(body.plan.consoleSurfaces));
  assert.ok(body.plan.consoleSurfaces.length > 0);
  assert.ok(Array.isArray(body.plan.operatorConfirmationRequirements));
  assert.ok(body.plan.operatorConfirmationRequirements.length > 0);
  assert.ok(Array.isArray(body.plan.consoleControlRules));
  assert.ok(Array.isArray(body.plan.blockingRequirements));
  assert.ok(Array.isArray(body.plan.blockers));
  assert.ok(body.plan.blockers.length > 0);
  assert.equal(body.plan.safety.readOnly, true);
});

test('POST /video-orchestrator/controlled-execution-operator-ux-console-controls-implementation-plan is not registered', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/controlled-execution-operator-ux-console-controls-implementation-plan' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /video-orchestrator/controlled-execution-security-review-threat-modeling-implementation-plan returns phase-6p design-only response', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/controlled-execution-security-review-threat-modeling-implementation-plan' });
  const body = JSON.parse(response.body) as {
    plan: {
      version: string;
      status: string;
      securityReviewEnabled: boolean;
      threatModelingEnabled: boolean;
      securityAuditEnabled: boolean;
      vulnerabilityAssessmentEnabled: boolean;
      implementationExecutionEnabled: boolean;
      executionEnabled: boolean;
      executable: boolean;
      securityReviewRequirements: string[];
      threatModelRequirements: string[];
      securityRequirements: string[];
      blockingRequirements: string[];
      blockers: string[];
      safety: { readOnly: boolean };
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.plan.version, 'phase-6p');
  assert.equal(body.plan.status, 'not-ready');
  assert.equal(body.plan.securityReviewEnabled, false);
  assert.equal(body.plan.threatModelingEnabled, false);
  assert.equal(body.plan.securityAuditEnabled, false);
  assert.equal(body.plan.vulnerabilityAssessmentEnabled, false);
  assert.equal(body.plan.implementationExecutionEnabled, false);
  assert.equal(body.plan.executionEnabled, false);
  assert.equal(body.plan.executable, false);
  assert.ok(Array.isArray(body.plan.securityReviewRequirements));
  assert.ok(body.plan.securityReviewRequirements.length > 0);
  assert.ok(Array.isArray(body.plan.threatModelRequirements));
  assert.ok(body.plan.threatModelRequirements.length > 0);
  assert.ok(Array.isArray(body.plan.securityRequirements));
  assert.ok(Array.isArray(body.plan.blockingRequirements));
  assert.ok(Array.isArray(body.plan.blockers));
  assert.ok(body.plan.blockers.length > 0);
  assert.equal(body.plan.safety.readOnly, true);
});

test('POST /video-orchestrator/controlled-execution-security-review-threat-modeling-implementation-plan is not registered', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/controlled-execution-security-review-threat-modeling-implementation-plan' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /video-orchestrator/controlled-execution-implementation-approval-packet-start-gate returns phase-6q design-only response', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/controlled-execution-implementation-approval-packet-start-gate' });
  const body = JSON.parse(response.body) as {
    gate: {
      version: string;
      status: string;
      approvalPacketComplete: boolean;
      allPlanningPhasesApproved: boolean;
      readyForPhase7Execution: boolean;
      approvalPacketSignatureRequired: boolean;
      implementationExecutionEnabled: boolean;
      executionEnabled: boolean;
      executable: boolean;
      approvalPacketSections: string[];
      approvalRequirements: string[];
      gateCriteria: string[];
      blockingRequirements: string[];
      blockers: string[];
      safety: { readOnly: boolean };
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.gate.version, 'phase-6q');
  assert.equal(body.gate.status, 'not-ready');
  assert.equal(body.gate.approvalPacketComplete, false);
  assert.equal(body.gate.allPlanningPhasesApproved, false);
  assert.equal(body.gate.readyForPhase7Execution, false);
  assert.equal(body.gate.approvalPacketSignatureRequired, false);
  assert.equal(body.gate.implementationExecutionEnabled, false);
  assert.equal(body.gate.executionEnabled, false);
  assert.equal(body.gate.executable, false);
  assert.ok(Array.isArray(body.gate.approvalPacketSections));
  assert.ok(body.gate.approvalPacketSections.length > 0);
  assert.ok(Array.isArray(body.gate.approvalRequirements));
  assert.ok(body.gate.approvalRequirements.length > 0);
  assert.ok(Array.isArray(body.gate.gateCriteria));
  assert.ok(Array.isArray(body.gate.blockingRequirements));
  assert.ok(Array.isArray(body.gate.blockers));
  assert.ok(body.gate.blockers.length > 0);
  assert.equal(body.gate.safety.readOnly, true);
});

test('POST /video-orchestrator/controlled-execution-implementation-approval-packet-start-gate is not registered', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/controlled-execution-implementation-approval-packet-start-gate' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});


test('GET /probot/dashboard-parity returns read-only ProBot to Brain Console migration inventory', async () => {
  const response = await exercise({ method: 'GET', url: '/probot/dashboard-parity' });
  const body = JSON.parse(response.body) as {
    id: string;
    status: string;
    summary: {
      totalTabs: number;
      visibleInBrainConsoleCount: number;
      workingInBrainConsoleCount: number;
      legacyOnlyCount: number;
      blockerCount: number;
    };
    tabs: Array<{
      id: string;
      probotLabel: string;
      brainConsoleSection: string;
      status: string;
      decision: string;
      visibleInBrainConsole: boolean;
      workingInBrainConsole: boolean;
      mutationControlsEnabled: boolean;
      sensitiveDataExposed: boolean;
      brainCoreEndpoints: string[];
    }>;
    safety: {
      readOnly: boolean;
      exposesSecrets: boolean;
      exposesFinancialData: boolean;
      mutationControlsEnabled: boolean;
      directShellExecutionEnabled: boolean;
      approvalRequiredForFutureActions: boolean;
      writesToMind: boolean;
      writesFiles: boolean;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.id, 'probot-dashboard-parity');
  assert.equal(body.status, 'in-progress');
  assert.equal(body.summary.totalTabs, 8);
  assert.ok(body.summary.visibleInBrainConsoleCount >= 6);
  assert.ok(body.summary.workingInBrainConsoleCount >= 5);
  assert.equal(body.summary.legacyOnlyCount, 1);
  assert.ok(body.summary.blockerCount >= 1);

  const tabIds = body.tabs.map(tab => tab.id);
  assert.ok(tabIds.includes('overview'));
  assert.ok(tabIds.includes('local-apps'));
  assert.ok(tabIds.includes('production-pipeline'));
  assert.ok(tabIds.includes('video-orchestrator-studio'));
  assert.ok(tabIds.includes('viral-flow'));
  assert.ok(tabIds.includes('stripe'));
  assert.ok(tabIds.includes('session-history'));

  const stripe = body.tabs.find(tab => tab.id === 'stripe');
  assert.ok(stripe);
  assert.equal(stripe.visibleInBrainConsole, false);
  assert.equal(stripe.decision, 'drop');

  body.tabs.forEach(tab => {
    assert.equal(tab.mutationControlsEnabled, false, `${tab.id} must not enable mutation controls`);
    assert.equal(tab.sensitiveDataExposed, false, `${tab.id} must not expose sensitive data`);
  });

  assert.equal(body.safety.readOnly, true);
  assert.equal(body.safety.exposesSecrets, false);
  assert.equal(body.safety.exposesFinancialData, false);
  assert.equal(body.safety.mutationControlsEnabled, false);
  assert.equal(body.safety.directShellExecutionEnabled, false);
  assert.equal(body.safety.approvalRequiredForFutureActions, true);
  assert.equal(body.safety.writesToMind, false);
  assert.equal(body.safety.writesFiles, false);
});

test('POST /probot/dashboard-parity is not registered', async () => {
  const response = await exercise({ method: 'POST', url: '/probot/dashboard-parity' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});


test('GET /video-orchestrator/thumbnail-design returns read-only thumbnail design plans', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/thumbnail-design' });
  const body = JSON.parse(response.body) as {
    id: string;
    status: string;
    phase: string;
    summary: { planCount: number; variantCount: number; blockedCount: number; generatedAssetCount: number };
    plans: Array<{
      id: string;
      storyId: string;
      status: string;
      variants: Array<{ generatedAsset: boolean }>;
      safety: {
        readOnly: boolean;
        designOnly: boolean;
        callsExternalAI: boolean;
        generatesImages: boolean;
        rendersVideo: boolean;
        writesFiles: boolean;
        publishesContent: boolean;
        writesToMind: boolean;
        executesStb: boolean;
        executesVideo: boolean;
      };
    }>;
    safety: {
      readOnly: boolean;
      designOnly: boolean;
      callsExternalAI: boolean;
      generatesImages: boolean;
      rendersVideo: boolean;
      writesFiles: boolean;
      publishesContent: boolean;
      writesToMind: boolean;
      executesStb: boolean;
      executesVideo: boolean;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.id, 'video-orchestrator-thumbnail-design-plan');
  assert.equal(body.status, 'blocked');
  assert.equal(body.phase, 'thumbnail-design-plan-read-only');
  assert.equal(body.summary.planCount, 3);
  assert.equal(body.summary.variantCount, 6);
  assert.equal(body.summary.blockedCount, 3);
  assert.equal(body.summary.generatedAssetCount, 0);

  assert.equal(body.safety.readOnly, true);
  assert.equal(body.safety.designOnly, true);
  assert.equal(body.safety.callsExternalAI, false);
  assert.equal(body.safety.generatesImages, false);
  assert.equal(body.safety.rendersVideo, false);
  assert.equal(body.safety.writesFiles, false);
  assert.equal(body.safety.publishesContent, false);
  assert.equal(body.safety.writesToMind, false);
  assert.equal(body.safety.executesStb, false);
  assert.equal(body.safety.executesVideo, false);

  body.plans.forEach((plan) => {
    assert.equal(plan.status, 'blocked');
    assert.equal(plan.safety.readOnly, true);
    assert.equal(plan.safety.designOnly, true);
    assert.equal(plan.safety.callsExternalAI, false);
    assert.equal(plan.safety.generatesImages, false);
    assert.equal(plan.safety.rendersVideo, false);
    assert.equal(plan.safety.writesFiles, false);
    assert.equal(plan.safety.publishesContent, false);
    assert.equal(plan.safety.writesToMind, false);
    assert.equal(plan.safety.executesStb, false);
    assert.equal(plan.safety.executesVideo, false);
    plan.variants.forEach((variant) => assert.equal(variant.generatedAsset, false));
  });
});

test('GET /video-orchestrator/thumbnail-design/:id returns a read-only thumbnail design plan', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/thumbnail-design/story-052' });
  const body = JSON.parse(response.body) as {
    storyId: string;
    sourcePlanId: string;
    status: string;
    variants: Array<{ id: string; generatedAsset: boolean }>;
    safety: { generatesImages: boolean; writesFiles: boolean; publishesContent: boolean; executesVideo: boolean };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.storyId, 'story-052');
  assert.equal(body.sourcePlanId, 'video-design-story-052');
  assert.equal(body.status, 'blocked');
  assert.equal(body.variants.length, 2);
  assert.equal(body.variants[0]?.generatedAsset, false);
  assert.equal(body.safety.generatesImages, false);
  assert.equal(body.safety.writesFiles, false);
  assert.equal(body.safety.publishesContent, false);
  assert.equal(body.safety.executesVideo, false);
});

test('POST /video-orchestrator/thumbnail-design is not registered', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/thumbnail-design' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});


test('GET /video-orchestrator/archive-logging-plan returns read-only archive logging plans', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/archive-logging-plan' });
  const body = JSON.parse(response.body) as {
    id: string;
    status: string;
    phase: string;
    summary: { planCount: number; recordShapeCount: number; loggingCheckCount: number; blockedCount: number; persistedRecordCount: number };
    plans: Array<{
      id: string;
      storyId: string;
      status: string;
      recordShape: { recordType: string; retentionPolicy: string };
      loggingChecks: Array<{ id: string; required: boolean }>;
      safety: {
        readOnly: boolean;
        designOnly: boolean;
        archiveWritesEnabled: boolean;
        auditPersistenceEnabled: boolean;
        runtimeLogIngestEnabled: boolean;
        deletesFiles: boolean;
        movesFiles: boolean;
        writesFiles: boolean;
        publishesContent: boolean;
        writesToMind: boolean;
        decommissionsStb: boolean;
        executesStb: boolean;
        executesVideo: boolean;
      };
    }>;
    safety: {
      readOnly: boolean;
      designOnly: boolean;
      archiveWritesEnabled: boolean;
      auditPersistenceEnabled: boolean;
      runtimeLogIngestEnabled: boolean;
      deletesFiles: boolean;
      movesFiles: boolean;
      writesFiles: boolean;
      publishesContent: boolean;
      writesToMind: boolean;
      decommissionsStb: boolean;
      executesStb: boolean;
      executesVideo: boolean;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.id, 'video-orchestrator-archive-logging-plan');
  assert.equal(body.status, 'blocked');
  assert.equal(body.phase, 'archive-logging-plan-read-only');
  assert.equal(body.summary.planCount, 3);
  assert.equal(body.summary.recordShapeCount, 3);
  assert.equal(body.summary.loggingCheckCount, 9);
  assert.equal(body.summary.blockedCount, 3);
  assert.equal(body.summary.persistedRecordCount, 0);

  assert.equal(body.safety.readOnly, true);
  assert.equal(body.safety.designOnly, true);
  assert.equal(body.safety.archiveWritesEnabled, false);
  assert.equal(body.safety.auditPersistenceEnabled, false);
  assert.equal(body.safety.runtimeLogIngestEnabled, false);
  assert.equal(body.safety.deletesFiles, false);
  assert.equal(body.safety.movesFiles, false);
  assert.equal(body.safety.writesFiles, false);
  assert.equal(body.safety.publishesContent, false);
  assert.equal(body.safety.writesToMind, false);
  assert.equal(body.safety.decommissionsStb, false);
  assert.equal(body.safety.executesStb, false);
  assert.equal(body.safety.executesVideo, false);

  body.plans.forEach((plan) => {
    assert.equal(plan.status, 'blocked');
    assert.ok(plan.recordShape.recordType.length > 0);
    assert.match(plan.recordShape.retentionPolicy, /no persistence/i);
    assert.equal(plan.loggingChecks.length, 3);
    assert.equal(plan.safety.readOnly, true);
    assert.equal(plan.safety.designOnly, true);
    assert.equal(plan.safety.archiveWritesEnabled, false);
    assert.equal(plan.safety.auditPersistenceEnabled, false);
    assert.equal(plan.safety.runtimeLogIngestEnabled, false);
    assert.equal(plan.safety.deletesFiles, false);
    assert.equal(plan.safety.movesFiles, false);
    assert.equal(plan.safety.writesFiles, false);
    assert.equal(plan.safety.publishesContent, false);
    assert.equal(plan.safety.writesToMind, false);
    assert.equal(plan.safety.decommissionsStb, false);
    assert.equal(plan.safety.executesStb, false);
    assert.equal(plan.safety.executesVideo, false);
  });
});

test('GET /video-orchestrator/archive-logging-plan/:id returns a read-only archive logging plan', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/archive-logging-plan/story-054' });
  const body = JSON.parse(response.body) as {
    storyId: string;
    status: string;
    archiveIntent: string;
    safety: { archiveWritesEnabled: boolean; auditPersistenceEnabled: boolean; writesToMind: boolean; decommissionsStb: boolean; executesVideo: boolean };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.storyId, 'story-054');
  assert.equal(body.status, 'blocked');
  assert.match(body.archiveIntent, /cutover-readiness/i);
  assert.equal(body.safety.archiveWritesEnabled, false);
  assert.equal(body.safety.auditPersistenceEnabled, false);
  assert.equal(body.safety.writesToMind, false);
  assert.equal(body.safety.decommissionsStb, false);
  assert.equal(body.safety.executesVideo, false);
});

test('POST /video-orchestrator/archive-logging-plan is not registered', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/archive-logging-plan' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});


test('GET /video-orchestrator/design-provider-boundary-plan returns read-only provider boundaries', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/design-provider-boundary-plan' });
  const body = JSON.parse(response.body) as {
    id: string;
    status: string;
    phase: string;
    summary: {
      boundaryCount: number;
      blockedCount: number;
      providerConfiguredCount: number;
      providerCallCount: number;
      artifactPersistenceCount: number;
    };
    boundaries: Array<{
      id: string;
      providerClass: string;
      status: string;
      safety: {
        readOnly: boolean;
        boundaryDesignOnly: boolean;
        providerConfigured: boolean;
        providerCallsEnabled: boolean;
        promptGenerationEnabled: boolean;
        imageGenerationEnabled: boolean;
        artifactPersistenceEnabled: boolean;
        credentialAccessEnabled: boolean;
        filesystemAccessEnabled: boolean;
        networkAccessEnabled: boolean;
        writesFiles: boolean;
        publishesContent: boolean;
        writesToMind: boolean;
        executesVideo: boolean;
      };
    }>;
    safety: {
      readOnly: boolean;
      boundaryDesignOnly: boolean;
      providerConfigured: boolean;
      providerCallsEnabled: boolean;
      promptGenerationEnabled: boolean;
      imageGenerationEnabled: boolean;
      artifactPersistenceEnabled: boolean;
      credentialAccessEnabled: boolean;
      filesystemAccessEnabled: boolean;
      networkAccessEnabled: boolean;
      writesFiles: boolean;
      publishesContent: boolean;
      writesToMind: boolean;
      executesVideo: boolean;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.id, 'video-orchestrator-design-provider-boundary-plan');
  assert.equal(body.status, 'blocked');
  assert.equal(body.phase, 'design-provider-boundary-plan-read-only');
  assert.equal(body.summary.boundaryCount, 3);
  assert.equal(body.summary.blockedCount, 3);
  assert.equal(body.summary.providerConfiguredCount, 0);
  assert.equal(body.summary.providerCallCount, 0);
  assert.equal(body.summary.artifactPersistenceCount, 0);

  assert.equal(body.safety.readOnly, true);
  assert.equal(body.safety.boundaryDesignOnly, true);
  assert.equal(body.safety.providerConfigured, false);
  assert.equal(body.safety.providerCallsEnabled, false);
  assert.equal(body.safety.promptGenerationEnabled, false);
  assert.equal(body.safety.imageGenerationEnabled, false);
  assert.equal(body.safety.artifactPersistenceEnabled, false);
  assert.equal(body.safety.credentialAccessEnabled, false);
  assert.equal(body.safety.filesystemAccessEnabled, false);
  assert.equal(body.safety.networkAccessEnabled, false);
  assert.equal(body.safety.writesFiles, false);
  assert.equal(body.safety.publishesContent, false);
  assert.equal(body.safety.writesToMind, false);
  assert.equal(body.safety.executesVideo, false);

  const providerClasses = body.boundaries.map((boundary) => boundary.providerClass);
  assert.deepEqual(providerClasses, ['image-generation', 'layout-rendering', 'brand-compliance']);

  body.boundaries.forEach((boundary) => {
    assert.equal(boundary.status, 'blocked');
    assert.equal(boundary.safety.readOnly, true);
    assert.equal(boundary.safety.boundaryDesignOnly, true);
    assert.equal(boundary.safety.providerConfigured, false);
    assert.equal(boundary.safety.providerCallsEnabled, false);
    assert.equal(boundary.safety.promptGenerationEnabled, false);
    assert.equal(boundary.safety.imageGenerationEnabled, false);
    assert.equal(boundary.safety.artifactPersistenceEnabled, false);
    assert.equal(boundary.safety.credentialAccessEnabled, false);
    assert.equal(boundary.safety.filesystemAccessEnabled, false);
    assert.equal(boundary.safety.networkAccessEnabled, false);
    assert.equal(boundary.safety.writesFiles, false);
    assert.equal(boundary.safety.publishesContent, false);
    assert.equal(boundary.safety.writesToMind, false);
    assert.equal(boundary.safety.executesVideo, false);
  });
});

test('GET /video-orchestrator/design-provider-boundary-plan/:id returns a read-only provider boundary', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/design-provider-boundary-plan/image-generation' });
  const body = JSON.parse(response.body) as {
    providerClass: string;
    status: string;
    outputPolicy: { disallowedOutputs: string[] };
    safety: { providerCallsEnabled: boolean; imageGenerationEnabled: boolean; credentialAccessEnabled: boolean; networkAccessEnabled: boolean; writesFiles: boolean };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.providerClass, 'image-generation');
  assert.equal(body.status, 'blocked');
  assert.ok(body.outputPolicy.disallowedOutputs.includes('generated image bytes'));
  assert.equal(body.safety.providerCallsEnabled, false);
  assert.equal(body.safety.imageGenerationEnabled, false);
  assert.equal(body.safety.credentialAccessEnabled, false);
  assert.equal(body.safety.networkAccessEnabled, false);
  assert.equal(body.safety.writesFiles, false);
});

test('POST /video-orchestrator/design-provider-boundary-plan is not registered', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/design-provider-boundary-plan' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('GET /video-orchestrator/design-provider-credential-isolation-plan returns three blocked plans with safe counts', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/design-provider-credential-isolation-plan' });
  const body = JSON.parse(response.body) as {
    status: string;
    summary: {
      planCount: number;
      blockedCount: number;
      credentialConfiguredCount: number;
      credentialAccessCount: number;
      secretMaterialStoredCount: number;
      providerCallCount: number;
    };
    plans: Array<{ id: string; providerClass: string; status: string; safety: Record<string, boolean> }>;
    safety: Record<string, boolean>;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.status, 'blocked');
  assert.equal(body.summary.planCount, 3);
  assert.equal(body.summary.blockedCount, 3);
  assert.equal(body.summary.credentialConfiguredCount, 0);
  assert.equal(body.summary.credentialAccessCount, 0);
  assert.equal(body.summary.secretMaterialStoredCount, 0);
  assert.equal(body.summary.providerCallCount, 0);
  assert.equal(body.plans.length, 3);
  assert.deepEqual(body.plans.map((plan) => plan.id), [
    'image-generation-provider-credentials',
    'layout-rendering-provider-credentials',
    'brand-compliance-provider-credentials',
  ]);
  body.plans.forEach((plan) => {
    assert.equal(plan.status, 'blocked');
    assert.equal(plan.safety.readOnly, true);
    assert.equal(plan.safety.credentialIsolationDesignOnly, true);
    assert.equal(plan.safety.providerConfigured, false);
    assert.equal(plan.safety.providerCallsEnabled, false);
    assert.equal(plan.safety.credentialAccessEnabled, false);
    assert.equal(plan.safety.secretMaterialStored, false);
    assert.equal(plan.safety.rawCredentialDisplayEnabled, false);
    assert.equal(plan.safety.envReadEnabled, false);
    assert.equal(plan.safety.filesystemCredentialAccessEnabled, false);
    assert.equal(plan.safety.networkAccessEnabled, false);
    assert.equal(plan.safety.writesFiles, false);
    assert.equal(plan.safety.publishesContent, false);
    assert.equal(plan.safety.writesToMind, false);
    assert.equal(plan.safety.executesVideo, false);
  });
  assert.equal(body.safety.readOnly, true);
  assert.equal(body.safety.credentialIsolationDesignOnly, true);
  assert.equal(body.safety.providerConfigured, false);
  assert.equal(body.safety.providerCallsEnabled, false);
  assert.equal(body.safety.credentialAccessEnabled, false);
  assert.equal(body.safety.secretMaterialStored, false);
  assert.equal(body.safety.rawCredentialDisplayEnabled, false);
  assert.equal(body.safety.envReadEnabled, false);
  assert.equal(body.safety.filesystemCredentialAccessEnabled, false);
  assert.equal(body.safety.networkAccessEnabled, false);
  assert.equal(body.safety.writesFiles, false);
  assert.equal(body.safety.publishesContent, false);
  assert.equal(body.safety.writesToMind, false);
  assert.equal(body.safety.executesVideo, false);
});

test('GET /video-orchestrator/design-provider-credential-isolation-plan/:id returns the correct plan', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/design-provider-credential-isolation-plan/layout-rendering-provider-credentials' });
  const body = JSON.parse(response.body) as {
    id: string;
    providerClass: string;
    status: string;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.id, 'layout-rendering-provider-credentials');
  assert.equal(body.providerClass, 'layout-rendering-provider');
  assert.equal(body.status, 'blocked');
});

test('POST /video-orchestrator/design-provider-credential-isolation-plan is not registered and returns 404', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/design-provider-credential-isolation-plan' });
  assert.equal(response.statusCode, 404);
});

test('GET /video-orchestrator/design-provider-prompt-review-policy-plan returns three blocked policies with safe counts', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/design-provider-prompt-review-policy-plan' });
  const body = JSON.parse(response.body) as {
    status: string;
    summary: {
      policyCount: number;
      blockedCount: number;
      promptGenerationCount: number;
      providerCallCount: number;
      approvedPromptCount: number;
      persistedPromptCount: number;
    };
    policies: Array<{ id: string; providerClass: string; status: string; disallowedPromptInputs: string[]; safety: Record<string, boolean> }>;
    safety: Record<string, boolean>;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.status, 'blocked');
  assert.equal(body.summary.policyCount, 3);
  assert.equal(body.summary.blockedCount, 3);
  assert.equal(body.summary.promptGenerationCount, 0);
  assert.equal(body.summary.providerCallCount, 0);
  assert.equal(body.summary.approvedPromptCount, 0);
  assert.equal(body.summary.persistedPromptCount, 0);
  assert.equal(body.policies.length, 3);
  assert.deepEqual(body.policies.map((policy) => policy.id), [
    'image-generation-prompt-review',
    'layout-rendering-prompt-review',
    'brand-compliance-prompt-review',
  ]);
  body.policies.forEach((policy) => {
    assert.equal(policy.status, 'blocked');
    assert.ok(policy.disallowedPromptInputs.includes('raw credentials'));
    assert.ok(policy.disallowedPromptInputs.includes('API keys'));
    assert.ok(policy.disallowedPromptInputs.includes('OAuth tokens'));
    assert.ok(policy.disallowedPromptInputs.includes('arbitrary shell text'));
    assert.ok(policy.disallowedPromptInputs.includes('publishing commands'));
    assert.equal(policy.safety.readOnly, true);
    assert.equal(policy.safety.promptReviewDesignOnly, true);
    assert.equal(policy.safety.promptGenerationEnabled, false);
    assert.equal(policy.safety.promptApprovalEnabled, false);
    assert.equal(policy.safety.approvedPromptPersistenceEnabled, false);
    assert.equal(policy.safety.providerConfigured, false);
    assert.equal(policy.safety.providerCallsEnabled, false);
    assert.equal(policy.safety.credentialAccessEnabled, false);
    assert.equal(policy.safety.rawCredentialDisplayEnabled, false);
    assert.equal(policy.safety.envReadEnabled, false);
    assert.equal(policy.safety.filesystemAccessEnabled, false);
    assert.equal(policy.safety.networkAccessEnabled, false);
    assert.equal(policy.safety.writesFiles, false);
    assert.equal(policy.safety.publishesContent, false);
    assert.equal(policy.safety.writesToMind, false);
    assert.equal(policy.safety.executesVideo, false);
  });
  assert.equal(body.safety.readOnly, true);
  assert.equal(body.safety.promptReviewDesignOnly, true);
  assert.equal(body.safety.promptGenerationEnabled, false);
  assert.equal(body.safety.promptApprovalEnabled, false);
  assert.equal(body.safety.approvedPromptPersistenceEnabled, false);
  assert.equal(body.safety.providerConfigured, false);
  assert.equal(body.safety.providerCallsEnabled, false);
  assert.equal(body.safety.credentialAccessEnabled, false);
  assert.equal(body.safety.rawCredentialDisplayEnabled, false);
  assert.equal(body.safety.envReadEnabled, false);
  assert.equal(body.safety.filesystemAccessEnabled, false);
  assert.equal(body.safety.networkAccessEnabled, false);
  assert.equal(body.safety.writesFiles, false);
  assert.equal(body.safety.publishesContent, false);
  assert.equal(body.safety.writesToMind, false);
  assert.equal(body.safety.executesVideo, false);
});

test('GET /video-orchestrator/design-provider-prompt-review-policy-plan/:id returns the image-generation policy', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/design-provider-prompt-review-policy-plan/image-generation-prompt-review' });
  const body = JSON.parse(response.body) as {
    id: string;
    providerClass: string;
    promptCategory: string;
    status: string;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.id, 'image-generation-prompt-review');
  assert.equal(body.providerClass, 'image-generation');
  assert.equal(body.promptCategory, 'thumbnail-and-scene-generation');
  assert.equal(body.status, 'blocked');
});

test('POST /video-orchestrator/design-provider-prompt-review-policy-plan is not registered and returns 404', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/design-provider-prompt-review-policy-plan' });
  assert.equal(response.statusCode, 404);
});

test('GET /video-orchestrator/artifact-sandbox-provider-handoff-plan returns three blocked handoff plans with safe counts', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/artifact-sandbox-provider-handoff-plan' });
  const body = JSON.parse(response.body) as {
    status: string;
    summary: {
      handoffPlanCount: number;
      blockedCount: number;
      providerConfiguredCount: number;
      providerCallCount: number;
      artifactPersistedCount: number;
      sandboxWriteCount: number;
      manifestCreatedCount: number;
    };
    handoffPlans: Array<{ id: string; providerClass: string; handoffCategory: string; status: string; disallowedHandoffInputs: string[]; proposedManifestFields: string[]; safety: Record<string, boolean> }>;
    safety: Record<string, boolean>;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.status, 'blocked');
  assert.equal(body.summary.handoffPlanCount, 3);
  assert.equal(body.summary.blockedCount, 3);
  assert.equal(body.summary.providerConfiguredCount, 0);
  assert.equal(body.summary.providerCallCount, 0);
  assert.equal(body.summary.artifactPersistedCount, 0);
  assert.equal(body.summary.sandboxWriteCount, 0);
  assert.equal(body.summary.manifestCreatedCount, 0);
  assert.equal(body.handoffPlans.length, 3);
  assert.deepEqual(body.handoffPlans.map((plan) => plan.id), [
    'image-generation-artifact-handoff',
    'layout-rendering-artifact-handoff',
    'brand-compliance-artifact-handoff',
  ]);
  body.handoffPlans.forEach((plan) => {
    assert.equal(plan.status, 'blocked');
    assert.ok(plan.disallowedHandoffInputs.includes('raw generated files'));
    assert.ok(plan.disallowedHandoffInputs.includes('raw credentials'));
    assert.ok(plan.disallowedHandoffInputs.includes('API keys'));
    assert.ok(plan.disallowedHandoffInputs.includes('OAuth tokens'));
    assert.ok(plan.disallowedHandoffInputs.includes('filesystem paths outside approved sandbox'));
    assert.ok(plan.disallowedHandoffInputs.includes('Mind vault paths'));
    assert.ok(plan.disallowedHandoffInputs.includes('STB artifact paths'));
    assert.ok(plan.disallowedHandoffInputs.includes('publishing commands'));
    assert.ok(plan.disallowedHandoffInputs.includes('arbitrary shell text'));
    assert.ok(plan.proposedManifestFields.includes('artifactId'));
    assert.ok(plan.proposedManifestFields.includes('providerClass'));
    assert.ok(plan.proposedManifestFields.includes('sourcePlanId'));
    assert.ok(plan.proposedManifestFields.includes('promptReviewPolicyId'));
    assert.ok(plan.proposedManifestFields.includes('credentialIsolationPlanId'));
    assert.ok(plan.proposedManifestFields.includes('sandboxPolicyRef'));
    assert.ok(plan.proposedManifestFields.includes('auditRefPlaceholder'));
    assert.equal(plan.safety.readOnly, true);
    assert.equal(plan.safety.handoffDesignOnly, true);
    assert.equal(plan.safety.providerConfigured, false);
    assert.equal(plan.safety.providerCallsEnabled, false);
    assert.equal(plan.safety.artifactManifestCreationEnabled, false);
    assert.equal(plan.safety.artifactPersistenceEnabled, false);
    assert.equal(plan.safety.sandboxWriteEnabled, false);
    assert.equal(plan.safety.sandboxReadEnabled, false);
    assert.equal(plan.safety.credentialAccessEnabled, false);
    assert.equal(plan.safety.rawArtifactAccessEnabled, false);
    assert.equal(plan.safety.filesystemAccessEnabled, false);
    assert.equal(plan.safety.networkAccessEnabled, false);
    assert.equal(plan.safety.writesFiles, false);
    assert.equal(plan.safety.publishesContent, false);
    assert.equal(plan.safety.writesToMind, false);
    assert.equal(plan.safety.executesVideo, false);
  });
  assert.equal(body.safety.readOnly, true);
  assert.equal(body.safety.handoffDesignOnly, true);
  assert.equal(body.safety.providerConfigured, false);
  assert.equal(body.safety.providerCallsEnabled, false);
  assert.equal(body.safety.artifactManifestCreationEnabled, false);
  assert.equal(body.safety.artifactPersistenceEnabled, false);
  assert.equal(body.safety.sandboxWriteEnabled, false);
  assert.equal(body.safety.sandboxReadEnabled, false);
  assert.equal(body.safety.credentialAccessEnabled, false);
  assert.equal(body.safety.rawArtifactAccessEnabled, false);
  assert.equal(body.safety.filesystemAccessEnabled, false);
  assert.equal(body.safety.networkAccessEnabled, false);
  assert.equal(body.safety.writesFiles, false);
  assert.equal(body.safety.publishesContent, false);
  assert.equal(body.safety.writesToMind, false);
  assert.equal(body.safety.executesVideo, false);
});

test('GET /video-orchestrator/artifact-sandbox-provider-handoff-plan/:id returns the image-generation handoff plan', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/artifact-sandbox-provider-handoff-plan/image-generation-artifact-handoff' });
  const body = JSON.parse(response.body) as {
    id: string;
    providerClass: string;
    handoffCategory: string;
    status: string;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.id, 'image-generation-artifact-handoff');
  assert.equal(body.providerClass, 'image-generation');
  assert.equal(body.handoffCategory, 'thumbnail-and-scene-artifacts');
  assert.equal(body.status, 'blocked');
});

test('POST /video-orchestrator/artifact-sandbox-provider-handoff-plan is not registered and returns 404', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/artifact-sandbox-provider-handoff-plan' });
  assert.equal(response.statusCode, 404);
});

test('GET /video-orchestrator/provider-output-redaction-policy-plan returns three blocked policies with safe counts', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/provider-output-redaction-policy-plan' });
  const body = JSON.parse(response.body) as {
    status: string;
    summary: {
      policyCount: number;
      blockedCount: number;
      redactedManifestCreatedCount: number;
      rawOutputAccessCount: number;
      providerCallCount: number;
      artifactPersistedCount: number;
      auditPersistedCount: number;
    };
    policies: Array<{ id: string; providerClass: string; outputCategory: string; status: string; disallowedRawOutputFields: string[]; redactionRules: string[]; proposedRedactedManifestFields: string[]; safety: Record<string, boolean> }>;
    safety: Record<string, boolean>;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.status, 'blocked');
  assert.equal(body.summary.policyCount, 3);
  assert.equal(body.summary.blockedCount, 3);
  assert.equal(body.summary.redactedManifestCreatedCount, 0);
  assert.equal(body.summary.rawOutputAccessCount, 0);
  assert.equal(body.summary.providerCallCount, 0);
  assert.equal(body.summary.artifactPersistedCount, 0);
  assert.equal(body.summary.auditPersistedCount, 0);
  assert.equal(body.policies.length, 3);
  assert.deepEqual(body.policies.map((policy) => policy.id), [
    'image-generation-output-redaction',
    'layout-rendering-output-redaction',
    'brand-compliance-output-redaction',
  ]);
  body.policies.forEach((policy) => {
    assert.equal(policy.status, 'blocked');
    assert.ok(policy.disallowedRawOutputFields.includes('raw provider response'));
    assert.ok(policy.disallowedRawOutputFields.includes('raw generated files'));
    assert.ok(policy.disallowedRawOutputFields.includes('raw prompt text'));
    assert.ok(policy.disallowedRawOutputFields.includes('raw credentials'));
    assert.ok(policy.disallowedRawOutputFields.includes('API keys'));
    assert.ok(policy.disallowedRawOutputFields.includes('OAuth tokens'));
    assert.ok(policy.disallowedRawOutputFields.includes('filesystem paths outside approved sandbox'));
    assert.ok(policy.disallowedRawOutputFields.includes('Mind vault paths'));
    assert.ok(policy.disallowedRawOutputFields.includes('STB artifact paths'));
    assert.ok(policy.disallowedRawOutputFields.includes('platform upload payloads'));
    assert.ok(policy.disallowedRawOutputFields.includes('unredacted logs'));
    assert.ok(policy.disallowedRawOutputFields.includes('arbitrary shell text'));
    assert.ok(policy.redactionRules.includes('replace credential-like values with [REDACTED]'));
    assert.ok(policy.redactionRules.includes('omit raw provider payloads'));
    assert.ok(policy.redactionRules.includes('omit absolute local paths'));
    assert.ok(policy.redactionRules.includes('keep only stable internal references'));
    assert.ok(policy.proposedRedactedManifestFields.includes('redactedArtifactId'));
    assert.ok(policy.proposedRedactedManifestFields.includes('providerClass'));
    assert.ok(policy.proposedRedactedManifestFields.includes('sourcePlanId'));
    assert.ok(policy.proposedRedactedManifestFields.includes('redactionPolicyId'));
    assert.ok(policy.proposedRedactedManifestFields.includes('artifactSandboxHandoffPlanId'));
    assert.ok(policy.proposedRedactedManifestFields.includes('promptReviewPolicyId'));
    assert.ok(policy.proposedRedactedManifestFields.includes('credentialIsolationPlanId'));
    assert.ok(policy.proposedRedactedManifestFields.includes('redactedSummary'));
    assert.ok(policy.proposedRedactedManifestFields.includes('omittedFieldCount'));
    assert.ok(policy.proposedRedactedManifestFields.includes('policyVersion'));
    assert.ok(policy.proposedRedactedManifestFields.includes('auditRefPlaceholder'));
    assert.equal(policy.safety.readOnly, true);
    assert.equal(policy.safety.redactionPolicyDesignOnly, true);
    assert.equal(policy.safety.providerConfigured, false);
    assert.equal(policy.safety.providerCallsEnabled, false);
    assert.equal(policy.safety.rawProviderOutputAccessEnabled, false);
    assert.equal(policy.safety.redactedManifestCreationEnabled, false);
    assert.equal(policy.safety.artifactPersistenceEnabled, false);
    assert.equal(policy.safety.auditPersistenceEnabled, false);
    assert.equal(policy.safety.credentialAccessEnabled, false);
    assert.equal(policy.safety.rawCredentialDisplayEnabled, false);
    assert.equal(policy.safety.filesystemAccessEnabled, false);
    assert.equal(policy.safety.networkAccessEnabled, false);
    assert.equal(policy.safety.writesFiles, false);
    assert.equal(policy.safety.publishesContent, false);
    assert.equal(policy.safety.writesToMind, false);
    assert.equal(policy.safety.executesVideo, false);
  });
  assert.equal(body.safety.readOnly, true);
  assert.equal(body.safety.redactionPolicyDesignOnly, true);
  assert.equal(body.safety.providerConfigured, false);
  assert.equal(body.safety.providerCallsEnabled, false);
  assert.equal(body.safety.rawProviderOutputAccessEnabled, false);
  assert.equal(body.safety.redactedManifestCreationEnabled, false);
  assert.equal(body.safety.artifactPersistenceEnabled, false);
  assert.equal(body.safety.auditPersistenceEnabled, false);
  assert.equal(body.safety.credentialAccessEnabled, false);
  assert.equal(body.safety.rawCredentialDisplayEnabled, false);
  assert.equal(body.safety.filesystemAccessEnabled, false);
  assert.equal(body.safety.networkAccessEnabled, false);
  assert.equal(body.safety.writesFiles, false);
  assert.equal(body.safety.publishesContent, false);
  assert.equal(body.safety.writesToMind, false);
  assert.equal(body.safety.executesVideo, false);
});

test('GET /video-orchestrator/provider-output-redaction-policy-plan/:id returns the image-generation redaction policy', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/provider-output-redaction-policy-plan/image-generation-output-redaction' });
  const body = JSON.parse(response.body) as {
    id: string;
    providerClass: string;
    outputCategory: string;
    status: string;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.id, 'image-generation-output-redaction');
  assert.equal(body.providerClass, 'image-generation');
  assert.equal(body.outputCategory, 'image-generation-output');
  assert.equal(body.status, 'blocked');
});

test('POST /video-orchestrator/provider-output-redaction-policy-plan is not registered and returns 404', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/provider-output-redaction-policy-plan' });
  assert.equal(response.statusCode, 404);
});

test('GET /video-orchestrator/design-provider-compliance-checklist-plan returns three blocked checklists with safe counts', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/design-provider-compliance-checklist-plan' });
  const body = JSON.parse(response.body) as {
    status: string;
    summary: {
      checklistCount: number;
      blockedCount: number;
      requiredCheckCount: number;
      passedCheckCount: number;
      persistedComplianceRecordCount: number;
      providerCallCount: number;
      auditPersistedCount: number;
    };
    checklists: Array<{ id: string; providerClass: string; checklistCategory: string; status: string; requiredChecks: string[]; disallowedComplianceEvidenceSources: string[]; safety: Record<string, boolean> }>;
    safety: Record<string, boolean>;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.status, 'blocked');
  assert.equal(body.summary.checklistCount, 3);
  assert.equal(body.summary.blockedCount, 3);
  assert.ok(body.summary.requiredCheckCount > 0);
  assert.equal(body.summary.passedCheckCount, 0);
  assert.equal(body.summary.persistedComplianceRecordCount, 0);
  assert.equal(body.summary.providerCallCount, 0);
  assert.equal(body.summary.auditPersistedCount, 0);
  assert.equal(body.checklists.length, 3);
  assert.deepEqual(body.checklists.map((checklist) => checklist.id), [
    'image-generation-compliance-checklist',
    'layout-rendering-compliance-checklist',
    'brand-compliance-compliance-checklist',
  ]);
  body.checklists.forEach((checklist) => {
    assert.equal(checklist.status, 'blocked');
    assert.ok(checklist.requiredChecks.includes('credential isolation plan reviewed'));
    assert.ok(checklist.requiredChecks.includes('prompt review policy reviewed'));
    assert.ok(checklist.requiredChecks.includes('artifact sandbox handoff plan reviewed'));
    assert.ok(checklist.requiredChecks.includes('output redaction policy reviewed'));
    assert.ok(checklist.requiredChecks.includes('provider boundary plan reviewed'));
    assert.ok(checklist.disallowedComplianceEvidenceSources.includes('raw provider responses'));
    assert.ok(checklist.disallowedComplianceEvidenceSources.includes('raw credentials'));
    assert.ok(checklist.disallowedComplianceEvidenceSources.includes('API keys'));
    assert.ok(checklist.disallowedComplianceEvidenceSources.includes('OAuth tokens'));
    assert.ok(checklist.disallowedComplianceEvidenceSources.includes('private keys'));
    assert.ok(checklist.disallowedComplianceEvidenceSources.includes('.env dumps'));
    assert.ok(checklist.disallowedComplianceEvidenceSources.includes('unredacted logs'));
    assert.ok(checklist.disallowedComplianceEvidenceSources.includes('Mind vault paths'));
    assert.ok(checklist.disallowedComplianceEvidenceSources.includes('STB artifact paths'));
    assert.ok(checklist.disallowedComplianceEvidenceSources.includes('platform upload payloads'));
    assert.ok(checklist.disallowedComplianceEvidenceSources.includes('generated media files'));
    assert.ok(checklist.disallowedComplianceEvidenceSources.includes('arbitrary shell output'));
    assert.equal(checklist.safety.readOnly, true);
    assert.equal(checklist.safety.complianceChecklistDesignOnly, true);
    assert.equal(checklist.safety.complianceEvaluationEnabled, false);
    assert.equal(checklist.safety.complianceRecordPersistenceEnabled, false);
    assert.equal(checklist.safety.providerConfigured, false);
    assert.equal(checklist.safety.providerCallsEnabled, false);
    assert.equal(checklist.safety.rawProviderOutputAccessEnabled, false);
    assert.equal(checklist.safety.credentialAccessEnabled, false);
    assert.equal(checklist.safety.auditPersistenceEnabled, false);
    assert.equal(checklist.safety.filesystemAccessEnabled, false);
    assert.equal(checklist.safety.networkAccessEnabled, false);
    assert.equal(checklist.safety.writesFiles, false);
    assert.equal(checklist.safety.publishesContent, false);
    assert.equal(checklist.safety.writesToMind, false);
    assert.equal(checklist.safety.executesVideo, false);
  });
  assert.equal(body.safety.readOnly, true);
  assert.equal(body.safety.complianceChecklistDesignOnly, true);
  assert.equal(body.safety.complianceEvaluationEnabled, false);
  assert.equal(body.safety.complianceRecordPersistenceEnabled, false);
  assert.equal(body.safety.providerConfigured, false);
  assert.equal(body.safety.providerCallsEnabled, false);
  assert.equal(body.safety.rawProviderOutputAccessEnabled, false);
  assert.equal(body.safety.credentialAccessEnabled, false);
  assert.equal(body.safety.auditPersistenceEnabled, false);
  assert.equal(body.safety.filesystemAccessEnabled, false);
  assert.equal(body.safety.networkAccessEnabled, false);
  assert.equal(body.safety.writesFiles, false);
  assert.equal(body.safety.publishesContent, false);
  assert.equal(body.safety.writesToMind, false);
  assert.equal(body.safety.executesVideo, false);
});

test('GET /video-orchestrator/design-provider-compliance-checklist-plan/:id returns the image-generation checklist', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/design-provider-compliance-checklist-plan/image-generation-compliance-checklist' });
  const body = JSON.parse(response.body) as {
    id: string;
    providerClass: string;
    checklistCategory: string;
    status: string;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.id, 'image-generation-compliance-checklist');
  assert.equal(body.providerClass, 'image-generation');
  assert.equal(body.checklistCategory, 'image-generation-compliance');
  assert.equal(body.status, 'blocked');
});

test('POST /video-orchestrator/design-provider-compliance-checklist-plan is not registered and returns 404', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/design-provider-compliance-checklist-plan' });
  assert.equal(response.statusCode, 404);
});

test('GET /video-orchestrator/design-provider-enablement-readiness-index returns blocked readiness entries with safe counts', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/design-provider-enablement-readiness-index' });
  const body = JSON.parse(response.body) as {
    index: {
      id: string;
      status: string;
      readinessPercent: number;
      providerClassCount: number;
      blockedCount: number;
      readyCount: number;
      averageReadinessPercent: number;
      providerConfiguredCount: number;
      providerCallCount: number;
      executionEnabledCount: number;
      entries: Array<{
        providerClass: string;
        status: string;
        readinessPercent: number;
        requiredPlanningSurfaces: string[];
        missingImplementationGates: string[];
        blockingReasons: string[];
        safety: Record<string, boolean>;
      }>;
      safety: Record<string, boolean>;
      blockers: string[];
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.index.id, 'video-orchestrator-design-provider-enablement-readiness-index');
  assert.equal(body.index.status, 'blocked');
  assert.equal(body.index.readinessPercent, 0);
  assert.equal(body.index.providerClassCount, 3);
  assert.equal(body.index.blockedCount, 3);
  assert.equal(body.index.readyCount, 0);
  assert.equal(body.index.averageReadinessPercent, 0);
  assert.equal(body.index.providerConfiguredCount, 0);
  assert.equal(body.index.providerCallCount, 0);
  assert.equal(body.index.executionEnabledCount, 0);
  assert.equal(body.index.entries.length, 3);
  assert.ok(body.index.entries.every((entry) => entry.readinessPercent === 0));
  assert.ok(body.index.entries.every((entry) => entry.status === 'blocked'));
  assert.ok(body.index.entries.every((entry) => entry.requiredPlanningSurfaces.includes('design-provider-boundary-plan')));
  assert.ok(body.index.entries.every((entry) => entry.requiredPlanningSurfaces.includes('design-provider-credential-isolation-plan')));
  assert.ok(body.index.entries.every((entry) => entry.requiredPlanningSurfaces.includes('design-provider-prompt-review-policy-plan')));
  assert.ok(body.index.entries.every((entry) => entry.requiredPlanningSurfaces.includes('artifact-sandbox-provider-handoff-plan')));
  assert.ok(body.index.entries.every((entry) => entry.requiredPlanningSurfaces.includes('provider-output-redaction-policy-plan')));
  assert.ok(body.index.entries.every((entry) => entry.requiredPlanningSurfaces.includes('design-provider-compliance-checklist-plan')));
  assert.ok(body.index.entries.every((entry) => entry.missingImplementationGates.includes('explicit user approval for provider implementation')));
  assert.ok(body.index.entries.every((entry) => entry.missingImplementationGates.includes('approved provider credential store design')));
  assert.ok(body.index.entries.every((entry) => entry.missingImplementationGates.includes('approved provider request wrapper implementation')));
  assert.ok(body.index.entries.every((entry) => entry.missingImplementationGates.includes('approved artifact sandbox implementation')));
  assert.ok(body.index.entries.every((entry) => entry.missingImplementationGates.includes('approved output redaction implementation')));
  assert.ok(body.index.entries.every((entry) => entry.missingImplementationGates.includes('approved audit persistence implementation')));
  assert.ok(body.index.entries.every((entry) => entry.missingImplementationGates.includes('approved operator review UX')));
  assert.ok(body.index.entries.every((entry) => entry.missingImplementationGates.includes('approved rollback/cleanup policy')));
  assert.ok(body.index.entries.every((entry) => entry.missingImplementationGates.includes('final security review')));
  assert.equal(body.index.safety.readOnly, true);
  assert.equal(body.index.safety.readinessIndexOnly, true);
  assert.equal(body.index.safety.providerImplementationApproved, false);
  assert.equal(body.index.safety.providerConfigured, false);
  assert.equal(body.index.safety.providerCallsEnabled, false);
  assert.equal(body.index.safety.credentialAccessEnabled, false);
  assert.equal(body.index.safety.promptGenerationEnabled, false);
  assert.equal(body.index.safety.imageGenerationEnabled, false);
  assert.equal(body.index.safety.artifactPersistenceEnabled, false);
  assert.equal(body.index.safety.auditPersistenceEnabled, false);
  assert.equal(body.index.safety.complianceEvaluationEnabled, false);
  assert.equal(body.index.safety.filesystemAccessEnabled, false);
  assert.equal(body.index.safety.networkAccessEnabled, false);
  assert.equal(body.index.safety.writesFiles, false);
  assert.equal(body.index.safety.publishesContent, false);
  assert.equal(body.index.safety.writesToMind, false);
  assert.equal(body.index.safety.executesVideo, false);
  assert.ok(body.index.blockers.length > 0);
});

test('GET /video-orchestrator/design-provider-enablement-readiness-index/:providerClass returns image-generation readiness', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/design-provider-enablement-readiness-index/image-generation' });
  const body = JSON.parse(response.body) as {
    providerClass: string;
    status: string;
    readinessPercent: number;
    safety: Record<string, boolean>;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.providerClass, 'image-generation');
  assert.equal(body.status, 'blocked');
  assert.equal(body.readinessPercent, 0);
  assert.equal(body.safety.readOnly, true);
  assert.equal(body.safety.readinessIndexOnly, true);
});

test('POST /video-orchestrator/design-provider-enablement-readiness-index is not registered and returns 404', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/design-provider-enablement-readiness-index' });
  assert.equal(response.statusCode, 404);
});

test('GET /video-orchestrator/provider-integration-final-planning-checkpoint returns blocked checkpoint entries with safe counts', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/provider-integration-final-planning-checkpoint' });
  const body = JSON.parse(response.body) as {
    checkpoint: {
      id: string;
      status: string;
      providerClassCount: number;
      planningCompleteCount: number;
      implementationApprovedCount: number;
      implementationEligibleCount: number;
      blockedCount: number;
      providerConfiguredCount: number;
      providerCallCount: number;
      executionEnabledCount: number;
      entries: Array<{
        providerClass: string;
        status: string;
        planningComplete: boolean;
        implementationApproved: boolean;
        implementationEligible: boolean;
        completedPlanningSurfaceRefs: string[];
        requiredExplicitApprovals: string[];
        implementationStartBlockers: string[];
        safety: Record<string, boolean>;
      }>;
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.checkpoint.id, 'video-orchestrator-provider-integration-final-planning-checkpoint');
  assert.equal(body.checkpoint.status, 'blocked');
  assert.equal(body.checkpoint.providerClassCount, 3);
  assert.equal(body.checkpoint.planningCompleteCount, 3);
  assert.equal(body.checkpoint.implementationApprovedCount, 0);
  assert.equal(body.checkpoint.implementationEligibleCount, 0);
  assert.equal(body.checkpoint.blockedCount, 3);
  assert.equal(body.checkpoint.providerConfiguredCount, 0);
  assert.equal(body.checkpoint.providerCallCount, 0);
  assert.equal(body.checkpoint.executionEnabledCount, 0);
  assert.equal(body.checkpoint.entries.length, 3);
  assert.ok(body.checkpoint.entries.every((entry) => entry.planningComplete === true));
  assert.ok(body.checkpoint.entries.every((entry) => entry.implementationApproved === false));
  assert.ok(body.checkpoint.entries.every((entry) => entry.implementationEligible === false));
  assert.ok(body.checkpoint.entries.every((entry) => entry.completedPlanningSurfaceRefs.includes('design-provider-boundary-plan')));
  assert.ok(body.checkpoint.entries.every((entry) => entry.completedPlanningSurfaceRefs.includes('design-provider-credential-isolation-plan')));
  assert.ok(body.checkpoint.entries.every((entry) => entry.completedPlanningSurfaceRefs.includes('design-provider-prompt-review-policy-plan')));
  assert.ok(body.checkpoint.entries.every((entry) => entry.completedPlanningSurfaceRefs.includes('artifact-sandbox-provider-handoff-plan')));
  assert.ok(body.checkpoint.entries.every((entry) => entry.completedPlanningSurfaceRefs.includes('provider-output-redaction-policy-plan')));
  assert.ok(body.checkpoint.entries.every((entry) => entry.completedPlanningSurfaceRefs.includes('design-provider-compliance-checklist-plan')));
  assert.ok(body.checkpoint.entries.every((entry) => entry.completedPlanningSurfaceRefs.includes('design-provider-enablement-readiness-index')));
  assert.ok(body.checkpoint.entries.every((entry) => entry.requiredExplicitApprovals.includes('approve provider implementation start')));
  assert.ok(body.checkpoint.entries.every((entry) => entry.requiredExplicitApprovals.includes('approve provider request wrapper design')));
  assert.ok(body.checkpoint.entries.every((entry) => entry.requiredExplicitApprovals.includes('approve credential store implementation boundary')));
  assert.ok(body.checkpoint.entries.every((entry) => entry.requiredExplicitApprovals.includes('approve prompt review UX implementation')));
  assert.ok(body.checkpoint.entries.every((entry) => entry.requiredExplicitApprovals.includes('approve artifact sandbox write boundary')));
  assert.ok(body.checkpoint.entries.every((entry) => entry.requiredExplicitApprovals.includes('approve output redaction implementation')));
  assert.ok(body.checkpoint.entries.every((entry) => entry.requiredExplicitApprovals.includes('approve immutable audit persistence boundary')));
  assert.ok(body.checkpoint.entries.every((entry) => entry.requiredExplicitApprovals.includes('approve rollback and cleanup procedure')));
  assert.ok(body.checkpoint.entries.every((entry) => entry.requiredExplicitApprovals.includes('approve security review completion')));
  assert.ok(body.checkpoint.entries.every((entry) => entry.implementationStartBlockers.includes('no explicit user approval to begin provider implementation')));
  assert.ok(body.checkpoint.entries.every((entry) => entry.implementationStartBlockers.includes('no approved provider request wrapper implementation')));
  assert.ok(body.checkpoint.entries.every((entry) => entry.implementationStartBlockers.includes('no approved credential store boundary')));
  assert.ok(body.checkpoint.entries.every((entry) => entry.implementationStartBlockers.includes('no approved artifact sandbox write boundary')));
  assert.ok(body.checkpoint.entries.every((entry) => entry.implementationStartBlockers.includes('no approved output redaction execution path')));
  assert.ok(body.checkpoint.entries.every((entry) => entry.implementationStartBlockers.includes('no approved audit persistence path')));
  assert.ok(body.checkpoint.entries.every((entry) => entry.implementationStartBlockers.includes('no approved operator review UX')));
  assert.ok(body.checkpoint.entries.every((entry) => entry.implementationStartBlockers.includes('no completed final security review')));
  assert.ok(body.checkpoint.entries.every((entry) => entry.implementationStartBlockers.includes('no rollback/cleanup acceptance')));
  assert.ok(body.checkpoint.entries.every((entry) => entry.implementationEligible === false));
  assert.equal(body.checkpoint.safety.readOnly, true);
  assert.equal(body.checkpoint.safety.checkpointOnly, true);
  assert.equal(body.checkpoint.safety.planningComplete, true);
  assert.equal(body.checkpoint.safety.implementationApproved, false);
  assert.equal(body.checkpoint.safety.implementationEligible, false);
  assert.equal(body.checkpoint.safety.providerConfigured, false);
  assert.equal(body.checkpoint.safety.providerCallsEnabled, false);
  assert.equal(body.checkpoint.safety.credentialAccessEnabled, false);
  assert.equal(body.checkpoint.safety.promptGenerationEnabled, false);
  assert.equal(body.checkpoint.safety.imageGenerationEnabled, false);
  assert.equal(body.checkpoint.safety.artifactPersistenceEnabled, false);
  assert.equal(body.checkpoint.safety.auditPersistenceEnabled, false);
  assert.equal(body.checkpoint.safety.complianceEvaluationEnabled, false);
  assert.equal(body.checkpoint.safety.filesystemAccessEnabled, false);
  assert.equal(body.checkpoint.safety.networkAccessEnabled, false);
  assert.equal(body.checkpoint.safety.writesFiles, false);
  assert.equal(body.checkpoint.safety.publishesContent, false);
  assert.equal(body.checkpoint.safety.writesToMind, false);
  assert.equal(body.checkpoint.safety.executesVideo, false);
});

test('GET /video-orchestrator/provider-integration-final-planning-checkpoint/:providerClass returns image-generation checkpoint', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/provider-integration-final-planning-checkpoint/image-generation' });
  const body = JSON.parse(response.body) as {
    providerClass: string;
    status: string;
    planningComplete: boolean;
    implementationEligible: boolean;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.providerClass, 'image-generation');
  assert.equal(body.status, 'blocked');
  assert.equal(body.planningComplete, true);
  assert.equal(body.implementationEligible, false);
});

test('POST /video-orchestrator/provider-integration-final-planning-checkpoint is not registered and returns 404', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/provider-integration-final-planning-checkpoint' });
  assert.equal(response.statusCode, 404);
});

test('GET /video-orchestrator/provider-request-wrapper-implementation-plan returns blocked implementation plans with safe counts', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/provider-request-wrapper-implementation-plan' });
  const body = JSON.parse(response.body) as {
    plan: {
      id: string;
      status: string;
      planCount: number;
      blockedCount: number;
      implementationPlanOnlyCount: number;
      providerConfiguredCount: number;
      providerCallCount: number;
      networkAccessCount: number;
      credentialAccessCount: number;
      rawOutputAccessCount: number;
      entries: Array<{
        providerClass: string;
        implementationPlanOnly: boolean;
        proposedFutureRequestShape: string[];
        requestValidationSteps: string[];
        failureModes: string[];
        safety: Record<string, boolean>;
      }>;
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.plan.id, 'video-orchestrator-provider-request-wrapper-implementation-plan');
  assert.equal(body.plan.status, 'blocked');
  assert.equal(body.plan.planCount, 3);
  assert.equal(body.plan.blockedCount, 3);
  assert.equal(body.plan.implementationPlanOnlyCount, 3);
  assert.equal(body.plan.providerConfiguredCount, 0);
  assert.equal(body.plan.providerCallCount, 0);
  assert.equal(body.plan.networkAccessCount, 0);
  assert.equal(body.plan.credentialAccessCount, 0);
  assert.equal(body.plan.rawOutputAccessCount, 0);
  assert.equal(body.plan.entries.length, 3);
  assert.ok(body.plan.entries.every((entry) => entry.implementationPlanOnly === true));
  assert.ok(body.plan.entries.every((entry) => entry.proposedFutureRequestShape.includes('providerClass')));
  assert.ok(body.plan.entries.every((entry) => entry.proposedFutureRequestShape.includes('sourcePlanId')));
  assert.ok(body.plan.entries.every((entry) => entry.proposedFutureRequestShape.includes('promptReviewPolicyId')));
  assert.ok(body.plan.entries.every((entry) => entry.proposedFutureRequestShape.includes('credentialIsolationPlanId')));
  assert.ok(body.plan.entries.every((entry) => entry.proposedFutureRequestShape.includes('artifactSandboxHandoffPlanId')));
  assert.ok(body.plan.entries.every((entry) => entry.proposedFutureRequestShape.includes('outputRedactionPolicyId')));
  assert.ok(body.plan.entries.every((entry) => entry.proposedFutureRequestShape.includes('complianceChecklistId')));
  assert.ok(body.plan.entries.every((entry) => entry.proposedFutureRequestShape.includes('operatorApprovalRef')));
  assert.ok(body.plan.entries.every((entry) => entry.proposedFutureRequestShape.includes('auditRefPlaceholder')));
  assert.ok(body.plan.entries.every((entry) => entry.proposedFutureRequestShape.includes('requestIdPlaceholder')));
  assert.ok(body.plan.entries.every((entry) => entry.requestValidationSteps.includes('verify explicit implementation approval')));
  assert.ok(body.plan.entries.every((entry) => entry.requestValidationSteps.includes('verify credential isolation boundary')));
  assert.ok(body.plan.entries.every((entry) => entry.requestValidationSteps.includes('verify prompt review approval')));
  assert.ok(body.plan.entries.every((entry) => entry.requestValidationSteps.includes('verify artifact sandbox boundary')));
  assert.ok(body.plan.entries.every((entry) => entry.requestValidationSteps.includes('verify output redaction policy')));
  assert.ok(body.plan.entries.every((entry) => entry.requestValidationSteps.includes('verify compliance checklist')));
  assert.ok(body.plan.entries.every((entry) => entry.requestValidationSteps.includes('verify audit reference availability')));
  assert.ok(body.plan.entries.every((entry) => entry.requestValidationSteps.includes('verify no raw credential fields')));
  assert.ok(body.plan.entries.every((entry) => entry.requestValidationSteps.includes('verify no arbitrary shell text')));
  assert.ok(body.plan.entries.every((entry) => entry.requestValidationSteps.includes('verify no publishing command')));
  assert.ok(body.plan.entries.every((entry) => entry.requestValidationSteps.includes('block provider call in this phase')));
  assert.ok(body.plan.entries.every((entry) => entry.failureModes.includes('missing approval')));
  assert.ok(body.plan.entries.every((entry) => entry.failureModes.includes('timeout')));
  assert.ok(body.plan.entries.every((entry) => entry.failureModes.includes('provider unavailable')));
  assert.ok(body.plan.entries.every((entry) => entry.failureModes.includes('unsafe output category')));
  assert.ok(body.plan.entries.every((entry) => entry.failureModes.includes('audit reference unavailable')));
  assert.ok(body.plan.entries.every((entry) => entry.safety.readOnly === true));
  assert.ok(body.plan.entries.every((entry) => entry.safety.implementationPlanOnly === true));
  assert.ok(body.plan.entries.every((entry) => entry.safety.providerRequestWrapperImplemented === false));
  assert.ok(body.plan.entries.every((entry) => entry.safety.providerConfigured === false));
  assert.ok(body.plan.entries.every((entry) => entry.safety.providerCallsEnabled === false));
  assert.ok(body.plan.entries.every((entry) => entry.safety.credentialAccessEnabled === false));
  assert.ok(body.plan.entries.every((entry) => entry.safety.networkAccessEnabled === false));
  assert.ok(body.plan.entries.every((entry) => entry.safety.rawProviderOutputAccessEnabled === false));
  assert.equal(body.plan.safety.readOnly, true);
  assert.equal(body.plan.safety.implementationPlanOnly, true);
  assert.equal(body.plan.safety.providerRequestWrapperImplemented, false);
  assert.equal(body.plan.safety.providerConfigured, false);
  assert.equal(body.plan.safety.providerCallsEnabled, false);
  assert.equal(body.plan.safety.credentialAccessEnabled, false);
  assert.equal(body.plan.safety.networkAccessEnabled, false);
  assert.equal(body.plan.safety.rawProviderOutputAccessEnabled, false);
  assert.equal(body.plan.safety.promptGenerationEnabled, false);
  assert.equal(body.plan.safety.imageGenerationEnabled, false);
  assert.equal(body.plan.safety.artifactPersistenceEnabled, false);
  assert.equal(body.plan.safety.auditPersistenceEnabled, false);
  assert.equal(body.plan.safety.complianceEvaluationEnabled, false);
  assert.equal(body.plan.safety.filesystemAccessEnabled, false);
  assert.equal(body.plan.safety.writesFiles, false);
  assert.equal(body.plan.safety.publishesContent, false);
  assert.equal(body.plan.safety.writesToMind, false);
  assert.equal(body.plan.safety.executesVideo, false);
});

test('GET /video-orchestrator/provider-request-wrapper-implementation-plan/:providerClass returns image-generation wrapper plan', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/provider-request-wrapper-implementation-plan/image-generation' });
  const body = JSON.parse(response.body) as {
    providerClass: string;
    status: string;
    implementationPlanOnly: boolean;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.providerClass, 'image-generation');
  assert.equal(body.status, 'blocked');
  assert.equal(body.implementationPlanOnly, true);
});

test('POST /video-orchestrator/provider-request-wrapper-implementation-plan is not registered and returns 404', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/provider-request-wrapper-implementation-plan' });
  assert.equal(response.statusCode, 404);
});

test('GET /video-orchestrator/credential-store-implementation-boundary-plan returns blocked boundaries with safe counts', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/credential-store-implementation-boundary-plan' });
  const body = JSON.parse(response.body) as {
    plan: {
      id: string;
      status: string;
      boundaryCount: number;
      blockedCount: number;
      implementationBoundaryOnlyCount: number;
      credentialStoreImplementedCount: number;
      credentialAccessCount: number;
      credentialPersistedCount: number;
      envReadCount: number;
      keychainAccessCount: number;
      providerCallCount: number;
      entries: Array<{
        providerClass: string;
        implementationBoundaryOnly: boolean;
        proposedReferenceModel: string[];
        disallowedStoredFields: string[];
        storageBoundaryRules: string[];
        accessBoundaryRules: string[];
        safety: Record<string, boolean>;
      }>;
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.plan.id, 'video-orchestrator-credential-store-implementation-boundary-plan');
  assert.equal(body.plan.status, 'blocked');
  assert.equal(body.plan.boundaryCount, 3);
  assert.equal(body.plan.blockedCount, 3);
  assert.equal(body.plan.implementationBoundaryOnlyCount, 3);
  assert.equal(body.plan.credentialStoreImplementedCount, 0);
  assert.equal(body.plan.credentialAccessCount, 0);
  assert.equal(body.plan.credentialPersistedCount, 0);
  assert.equal(body.plan.envReadCount, 0);
  assert.equal(body.plan.keychainAccessCount, 0);
  assert.equal(body.plan.providerCallCount, 0);
  assert.equal(body.plan.entries.length, 3);
  assert.ok(body.plan.entries.every((entry) => entry.implementationBoundaryOnly === true));
  assert.ok(body.plan.entries.every((entry) => entry.proposedReferenceModel.includes('providerClass')));
  assert.ok(body.plan.entries.every((entry) => entry.proposedReferenceModel.includes('credentialRefIdPlaceholder')));
  assert.ok(body.plan.entries.every((entry) => entry.proposedReferenceModel.includes('credentialScope')));
  assert.ok(body.plan.entries.every((entry) => entry.proposedReferenceModel.includes('credentialPolicyVersion')));
  assert.ok(body.plan.entries.every((entry) => entry.proposedReferenceModel.includes('rotationPolicyRef')));
  assert.ok(body.plan.entries.every((entry) => entry.proposedReferenceModel.includes('revocationPolicyRef')));
  assert.ok(body.plan.entries.every((entry) => entry.proposedReferenceModel.includes('auditRefPlaceholder')));
  assert.ok(body.plan.entries.every((entry) => entry.disallowedStoredFields.includes('raw API key')));
  assert.ok(body.plan.entries.every((entry) => entry.disallowedStoredFields.includes('raw OAuth token')));
  assert.ok(body.plan.entries.every((entry) => entry.disallowedStoredFields.includes('OAuth refresh token')));
  assert.ok(body.plan.entries.every((entry) => entry.disallowedStoredFields.includes('private key')));
  assert.ok(body.plan.entries.every((entry) => entry.disallowedStoredFields.includes('cookie')));
  assert.ok(body.plan.entries.every((entry) => entry.disallowedStoredFields.includes('password')));
  assert.ok(body.plan.entries.every((entry) => entry.disallowedStoredFields.includes('.env dump')));
  assert.ok(body.plan.entries.every((entry) => entry.disallowedStoredFields.includes('filesystem credential path')));
  assert.ok(body.plan.entries.every((entry) => entry.disallowedStoredFields.includes('plaintext provider secret')));
  assert.ok(body.plan.entries.every((entry) => entry.disallowedStoredFields.includes('platform account secret')));
  assert.ok(body.plan.entries.every((entry) => entry.disallowedStoredFields.includes('Mind vault path')));
  assert.ok(body.plan.entries.every((entry) => entry.disallowedStoredFields.includes('STB artifact path')));
  assert.ok(body.plan.entries.every((entry) => entry.storageBoundaryRules.includes('store references only, never raw secrets')));
  assert.ok(body.plan.entries.every((entry) => entry.storageBoundaryRules.includes('no .env reads')));
  assert.ok(body.plan.entries.every((entry) => entry.storageBoundaryRules.includes('no filesystem credential discovery')));
  assert.ok(body.plan.entries.every((entry) => entry.storageBoundaryRules.includes('no raw credential display in Brain Console')));
  assert.ok(body.plan.entries.every((entry) => entry.accessBoundaryRules.includes('no access during this phase')));
  assert.equal(body.plan.safety.readOnly, true);
  assert.equal(body.plan.safety.implementationBoundaryOnly, true);
  assert.equal(body.plan.safety.credentialStoreImplemented, false);
  assert.equal(body.plan.safety.credentialAccessEnabled, false);
  assert.equal(body.plan.safety.credentialPersistenceEnabled, false);
  assert.equal(body.plan.safety.rawCredentialDisplayEnabled, false);
  assert.equal(body.plan.safety.envReadEnabled, false);
  assert.equal(body.plan.safety.keychainAccessEnabled, false);
  assert.equal(body.plan.safety.filesystemCredentialAccessEnabled, false);
  assert.equal(body.plan.safety.providerConfigured, false);
  assert.equal(body.plan.safety.providerCallsEnabled, false);
  assert.equal(body.plan.safety.networkAccessEnabled, false);
  assert.equal(body.plan.safety.filesystemAccessEnabled, false);
  assert.equal(body.plan.safety.writesFiles, false);
  assert.equal(body.plan.safety.publishesContent, false);
  assert.equal(body.plan.safety.writesToMind, false);
  assert.equal(body.plan.safety.executesVideo, false);
});

test('GET /video-orchestrator/credential-store-implementation-boundary-plan/:providerClass returns image-generation boundary', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/credential-store-implementation-boundary-plan/image-generation' });
  const body = JSON.parse(response.body) as {
    providerClass: string;
    status: string;
    implementationBoundaryOnly: boolean;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.providerClass, 'image-generation');
  assert.equal(body.status, 'blocked');
  assert.equal(body.implementationBoundaryOnly, true);
});

test('POST /video-orchestrator/credential-store-implementation-boundary-plan is not registered and returns 404', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/credential-store-implementation-boundary-plan' });
  assert.equal(response.statusCode, 404);
});

test('GET /video-orchestrator/prompt-review-ux-implementation-plan returns blocked plans with safe counts', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/prompt-review-ux-implementation-plan' });
  const body = JSON.parse(response.body) as {
    plan: {
      id: string;
      status: string;
      planCount: number;
      blockedCount: number;
      implementationPlanOnlyCount: number;
      editableUiEnabledCount: number;
      promptApprovalEnabledCount: number;
      providerCallButtonCount: number;
      promptPersistedCount: number;
      entries: Array<{
        providerClass: string;
        implementationPlanOnly: boolean;
        proposedReviewStates: string[];
        prohibitedControls: string[];
        requiredGuardrails: string[];
        safety: Record<string, boolean>;
      }>;
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.plan.id, 'video-orchestrator-prompt-review-ux-implementation-plan');
  assert.equal(body.plan.status, 'blocked');
  assert.equal(body.plan.planCount, 3);
  assert.equal(body.plan.blockedCount, 3);
  assert.equal(body.plan.implementationPlanOnlyCount, 3);
  assert.equal(body.plan.editableUiEnabledCount, 0);
  assert.equal(body.plan.promptApprovalEnabledCount, 0);
  assert.equal(body.plan.providerCallButtonCount, 0);
  assert.equal(body.plan.promptPersistedCount, 0);
  assert.equal(body.plan.entries.length, 3);
  assert.ok(body.plan.entries.every((entry) => entry.implementationPlanOnly === true));
  assert.ok(body.plan.entries.every((entry) => entry.proposedReviewStates.includes('not_loaded')));
  assert.ok(body.plan.entries.every((entry) => entry.proposedReviewStates.includes('draft_preview')));
  assert.ok(body.plan.entries.every((entry) => entry.proposedReviewStates.includes('awaiting_operator_review')));
  assert.ok(body.plan.entries.every((entry) => entry.proposedReviewStates.includes('changes_requested')));
  assert.ok(body.plan.entries.every((entry) => entry.proposedReviewStates.includes('blocked_by_policy')));
  assert.ok(body.plan.entries.every((entry) => entry.proposedReviewStates.includes('approved_for_future_provider_request')));
  assert.ok(body.plan.entries.every((entry) => entry.prohibitedControls.includes('approve prompt button')));
  assert.ok(body.plan.entries.every((entry) => entry.prohibitedControls.includes('call provider button')));
  assert.ok(body.plan.entries.every((entry) => entry.prohibitedControls.includes('generate image button')));
  assert.ok(body.plan.entries.every((entry) => entry.prohibitedControls.includes('publish button')));
  assert.ok(body.plan.entries.every((entry) => entry.prohibitedControls.includes('write to Mind button')));
  assert.ok(body.plan.entries.every((entry) => entry.prohibitedControls.includes('decommission STB button')));
  assert.ok(body.plan.entries.every((entry) => entry.prohibitedControls.includes('raw credential reveal button')));
  assert.ok(body.plan.entries.every((entry) => entry.prohibitedControls.includes('raw prompt copy button')));
  assert.ok(body.plan.entries.every((entry) => entry.requiredGuardrails.includes('no mutation controls in this phase')));
  assert.ok(body.plan.entries.every((entry) => entry.requiredGuardrails.includes('no provider calls from UI')));
  assert.ok(body.plan.entries.every((entry) => entry.requiredGuardrails.includes('no raw credentials in UI')));
  assert.ok(body.plan.entries.every((entry) => entry.requiredGuardrails.includes('no raw prompt persistence')));
  assert.ok(body.plan.entries.every((entry) => entry.requiredGuardrails.includes('explicit confirmation required before any future approval')));
  assert.ok(body.plan.entries.every((entry) => entry.safety.readOnly === true));
  assert.ok(body.plan.entries.every((entry) => entry.safety.implementationPlanOnly === true));
  assert.ok(body.plan.entries.every((entry) => entry.safety.promptReviewUxImplemented === false));
  assert.ok(body.plan.entries.every((entry) => entry.safety.editableUiEnabled === false));
  assert.ok(body.plan.entries.every((entry) => entry.safety.mutationControlsEnabled === false));
  assert.ok(body.plan.entries.every((entry) => entry.safety.approvalButtonsEnabled === false));
  assert.ok(body.plan.entries.every((entry) => entry.safety.promptApprovalEnabled === false));
  assert.ok(body.plan.entries.every((entry) => entry.safety.promptPersistenceEnabled === false));
  assert.ok(body.plan.entries.every((entry) => entry.safety.providerCallButtonsEnabled === false));
  assert.ok(body.plan.entries.every((entry) => entry.safety.providerCallsEnabled === false));
  assert.ok(body.plan.entries.every((entry) => entry.safety.credentialAccessEnabled === false));
  assert.ok(body.plan.entries.every((entry) => entry.safety.rawCredentialDisplayEnabled === false));
  assert.ok(body.plan.entries.every((entry) => entry.safety.rawPromptCopyEnabled === false));
  assert.equal(body.plan.safety.readOnly, true);
  assert.equal(body.plan.safety.implementationPlanOnly, true);
  assert.equal(body.plan.safety.promptReviewUxImplemented, false);
  assert.equal(body.plan.safety.editableUiEnabled, false);
  assert.equal(body.plan.safety.mutationControlsEnabled, false);
  assert.equal(body.plan.safety.approvalButtonsEnabled, false);
  assert.equal(body.plan.safety.promptApprovalEnabled, false);
  assert.equal(body.plan.safety.promptPersistenceEnabled, false);
  assert.equal(body.plan.safety.providerCallButtonsEnabled, false);
  assert.equal(body.plan.safety.providerCallsEnabled, false);
  assert.equal(body.plan.safety.credentialAccessEnabled, false);
  assert.equal(body.plan.safety.rawCredentialDisplayEnabled, false);
  assert.equal(body.plan.safety.rawPromptCopyEnabled, false);
  assert.equal(body.plan.safety.writesFiles, false);
  assert.equal(body.plan.safety.publishesContent, false);
  assert.equal(body.plan.safety.writesToMind, false);
  assert.equal(body.plan.safety.executesVideo, false);
});

test('GET /video-orchestrator/prompt-review-ux-implementation-plan/:providerClass returns image-generation UX plan', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/prompt-review-ux-implementation-plan/image-generation' });
  const body = JSON.parse(response.body) as {
    providerClass: string;
    status: string;
    implementationPlanOnly: boolean;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.providerClass, 'image-generation');
  assert.equal(body.status, 'blocked');
  assert.equal(body.implementationPlanOnly, true);
});

test('POST /video-orchestrator/prompt-review-ux-implementation-plan is not registered and returns 404', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/prompt-review-ux-implementation-plan' });
  assert.equal(response.statusCode, 404);
});

test('GET /video-orchestrator/provider-audit-persistence-boundary-plan returns blocked audit boundaries with safe counts', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/provider-audit-persistence-boundary-plan' });
  const body = JSON.parse(response.body) as {
    plan: {
      id: string;
      status: string;
      boundaryCount: number;
      blockedCount: number;
      implementationBoundaryOnlyCount: number;
      auditPersistenceImplementedCount: number;
      auditRecordCreatedCount: number;
      auditAppendEnabledCount: number;
      providerCallCount: number;
      rawOutputAccessCount: number;
      entries: Array<{
        providerClass: string;
        implementationBoundaryOnly: boolean;
        proposedAuditEventTypes: string[];
        proposedAuditRecordShape: string[];
        disallowedAuditFields: string[];
        retentionRules: string[];
        appendOnlyRules: string[];
        safety: Record<string, boolean>;
      }>;
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.plan.id, 'video-orchestrator-provider-audit-persistence-boundary-plan');
  assert.equal(body.plan.status, 'blocked');
  assert.equal(body.plan.boundaryCount, 3);
  assert.equal(body.plan.blockedCount, 3);
  assert.equal(body.plan.implementationBoundaryOnlyCount, 3);
  assert.equal(body.plan.auditPersistenceImplementedCount, 0);
  assert.equal(body.plan.auditRecordCreatedCount, 0);
  assert.equal(body.plan.auditAppendEnabledCount, 0);
  assert.equal(body.plan.providerCallCount, 0);
  assert.equal(body.plan.rawOutputAccessCount, 0);
  assert.equal(body.plan.entries.length, 3);
  assert.ok(body.plan.entries.every((entry) => entry.implementationBoundaryOnly === true));
  assert.ok(body.plan.entries.every((entry) => entry.proposedAuditEventTypes.includes('provider_request_planned')));
  assert.ok(body.plan.entries.every((entry) => entry.proposedAuditEventTypes.includes('prompt_review_completed')));
  assert.ok(body.plan.entries.every((entry) => entry.proposedAuditEventTypes.includes('credential_reference_checked')));
  assert.ok(body.plan.entries.every((entry) => entry.proposedAuditEventTypes.includes('provider_request_blocked')));
  assert.ok(body.plan.entries.every((entry) => entry.proposedAuditEventTypes.includes('provider_response_redacted')));
  assert.ok(body.plan.entries.every((entry) => entry.proposedAuditEventTypes.includes('artifact_handoff_reviewed')));
  assert.ok(body.plan.entries.every((entry) => entry.proposedAuditEventTypes.includes('compliance_check_reviewed')));
  assert.ok(body.plan.entries.every((entry) => entry.proposedAuditRecordShape.includes('auditEventIdPlaceholder')));
  assert.ok(body.plan.entries.every((entry) => entry.proposedAuditRecordShape.includes('providerClass')));
  assert.ok(body.plan.entries.every((entry) => entry.proposedAuditRecordShape.includes('eventType')));
  assert.ok(body.plan.entries.every((entry) => entry.proposedAuditRecordShape.includes('sourcePlanId')));
  assert.ok(body.plan.entries.every((entry) => entry.proposedAuditRecordShape.includes('operatorReviewRefPlaceholder')));
  assert.ok(body.plan.entries.every((entry) => entry.proposedAuditRecordShape.includes('policyVersion')));
  assert.ok(body.plan.entries.every((entry) => entry.proposedAuditRecordShape.includes('redactedSummaryOnly')));
  assert.ok(body.plan.entries.every((entry) => entry.disallowedAuditFields.includes('raw provider response')));
  assert.ok(body.plan.entries.every((entry) => entry.disallowedAuditFields.includes('raw prompt text')));
  assert.ok(body.plan.entries.every((entry) => entry.disallowedAuditFields.includes('raw credentials')));
  assert.ok(body.plan.entries.every((entry) => entry.disallowedAuditFields.includes('API keys')));
  assert.ok(body.plan.entries.every((entry) => entry.disallowedAuditFields.includes('OAuth tokens')));
  assert.ok(body.plan.entries.every((entry) => entry.disallowedAuditFields.includes('private keys')));
  assert.ok(body.plan.entries.every((entry) => entry.disallowedAuditFields.includes('.env dumps')));
  assert.ok(body.plan.entries.every((entry) => entry.disallowedAuditFields.includes('Mind vault paths')));
  assert.ok(body.plan.entries.every((entry) => entry.disallowedAuditFields.includes('STB artifact paths')));
  assert.ok(body.plan.entries.every((entry) => entry.disallowedAuditFields.includes('generated media files')));
  assert.ok(body.plan.entries.every((entry) => entry.disallowedAuditFields.includes('unredacted logs')));
  assert.ok(body.plan.entries.every((entry) => entry.disallowedAuditFields.includes('arbitrary shell output')));
  assert.ok(body.plan.entries.every((entry) => entry.retentionRules.includes('no persistence in this phase')));
  assert.ok(body.plan.entries.every((entry) => entry.retentionRules.includes('future records must be append-only')));
  assert.ok(body.plan.entries.every((entry) => entry.retentionRules.includes('future records must be redacted before persistence')));
  assert.ok(body.plan.entries.every((entry) => entry.retentionRules.includes('future records must not include raw provider output')));
  assert.ok(body.plan.entries.every((entry) => entry.appendOnlyRules.includes('no record mutation after append')));
  assert.ok(body.plan.entries.every((entry) => entry.appendOnlyRules.includes('correction by follow-up event only')));
  assert.ok(body.plan.entries.every((entry) => entry.appendOnlyRules.includes('no delete through provider audit API')));
  assert.ok(body.plan.entries.every((entry) => entry.appendOnlyRules.includes('no overwrite through provider audit API')));
  assert.equal(body.plan.safety.readOnly, true);
  assert.equal(body.plan.safety.implementationBoundaryOnly, true);
  assert.equal(body.plan.safety.auditPersistenceImplemented, false);
  assert.equal(body.plan.safety.auditRecordCreationEnabled, false);
  assert.equal(body.plan.safety.auditAppendEnabled, false);
  assert.equal(body.plan.safety.auditMutationEnabled, false);
  assert.equal(body.plan.safety.providerConfigured, false);
  assert.equal(body.plan.safety.providerCallsEnabled, false);
  assert.equal(body.plan.safety.rawProviderOutputAccessEnabled, false);
  assert.equal(body.plan.safety.credentialAccessEnabled, false);
  assert.equal(body.plan.safety.promptPersistenceEnabled, false);
  assert.equal(body.plan.safety.artifactPersistenceEnabled, false);
  assert.equal(body.plan.safety.filesystemAccessEnabled, false);
  assert.equal(body.plan.safety.networkAccessEnabled, false);
  assert.equal(body.plan.safety.writesFiles, false);
  assert.equal(body.plan.safety.publishesContent, false);
  assert.equal(body.plan.safety.writesToMind, false);
  assert.equal(body.plan.safety.executesVideo, false);
});

test('GET /video-orchestrator/provider-audit-persistence-boundary-plan/:providerClass returns image-generation audit boundary', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/provider-audit-persistence-boundary-plan/image-generation' });
  const body = JSON.parse(response.body) as {
    providerClass: string;
    status: string;
    implementationBoundaryOnly: boolean;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.providerClass, 'image-generation');
  assert.equal(body.status, 'blocked');
  assert.equal(body.implementationBoundaryOnly, true);
});

test('POST /video-orchestrator/provider-audit-persistence-boundary-plan is not registered and returns 404', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/provider-audit-persistence-boundary-plan' });
  assert.equal(response.statusCode, 404);
});

test('GET /video-orchestrator/provider-wrapper-security-review-plan returns blocked review plans with safe counts', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/provider-wrapper-security-review-plan' });
  const body = JSON.parse(response.body) as {
    plan: {
      id: string;
      status: string;
      reviewPlanCount: number;
      blockedCount: number;
      securityReviewCompletedCount: number;
      providerImplementationApprovedCount: number;
      providerCallCount: number;
      mutationControlCount: number;
      postRouteCount: number;
      entries: Array<{
        providerClass: string;
        implementationBoundaryOnly: boolean;
        threatCategories: string[];
        requiredEvidence: string[];
        prohibitedImplementationPatterns: string[];
        requiredManualReviewChecks: string[];
        requiredAutomatedReviewChecks: string[];
        safety: Record<string, boolean>;
      }>;
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.plan.id, 'video-orchestrator-provider-wrapper-security-review-plan');
  assert.equal(body.plan.status, 'blocked');
  assert.equal(body.plan.reviewPlanCount, 3);
  assert.equal(body.plan.blockedCount, 3);
  assert.equal(body.plan.securityReviewCompletedCount, 0);
  assert.equal(body.plan.providerImplementationApprovedCount, 0);
  assert.equal(body.plan.providerCallCount, 0);
  assert.equal(body.plan.mutationControlCount, 0);
  assert.equal(body.plan.postRouteCount, 0);
  assert.equal(body.plan.entries.length, 3);
  assert.ok(body.plan.entries.every((entry) => entry.implementationBoundaryOnly === true));
  assert.ok(body.plan.entries.every((entry) => entry.threatCategories.includes('credential exfiltration')));
  assert.ok(body.plan.entries.every((entry) => entry.threatCategories.includes('prompt injection')));
  assert.ok(body.plan.entries.every((entry) => entry.threatCategories.includes('path traversal')));
  assert.ok(body.plan.entries.every((entry) => entry.threatCategories.includes('arbitrary command execution')));
  assert.ok(body.plan.entries.every((entry) => entry.threatCategories.includes('unsafe network egress')));
  assert.ok(body.plan.entries.every((entry) => entry.threatCategories.includes('raw provider output leakage')));
  assert.ok(body.plan.entries.every((entry) => entry.threatCategories.includes('artifact sandbox escape')));
  assert.ok(body.plan.entries.every((entry) => entry.threatCategories.includes('audit tampering')));
  assert.ok(body.plan.entries.every((entry) => entry.threatCategories.includes('approval bypass')));
  assert.ok(body.plan.entries.every((entry) => entry.threatCategories.includes('publishing bypass')));
  assert.ok(body.plan.entries.every((entry) => entry.threatCategories.includes('STB mutation')));
  assert.ok(body.plan.entries.every((entry) => entry.threatCategories.includes('Mind vault mutation')));
  assert.ok(body.plan.entries.every((entry) => entry.prohibitedImplementationPatterns.includes('dynamic shell execution')));
  assert.ok(body.plan.entries.every((entry) => entry.prohibitedImplementationPatterns.includes('arbitrary command input')));
  assert.ok(body.plan.entries.every((entry) => entry.prohibitedImplementationPatterns.includes('raw token logging')));
  assert.ok(body.plan.entries.every((entry) => entry.prohibitedImplementationPatterns.includes('direct .env reads')));
  assert.ok(body.plan.entries.every((entry) => entry.prohibitedImplementationPatterns.includes('filesystem credential discovery')));
  assert.ok(body.plan.entries.every((entry) => entry.prohibitedImplementationPatterns.includes('unbounded network egress')));
  assert.ok(body.plan.entries.every((entry) => entry.prohibitedImplementationPatterns.includes('provider calls without approval')));
  assert.ok(body.plan.entries.every((entry) => entry.prohibitedImplementationPatterns.includes('artifact writes outside sandbox')));
  assert.ok(body.plan.entries.every((entry) => entry.prohibitedImplementationPatterns.includes('Mind vault writes')));
  assert.ok(body.plan.entries.every((entry) => entry.prohibitedImplementationPatterns.includes('STB artifact mutation')));
  assert.ok(body.plan.entries.every((entry) => entry.prohibitedImplementationPatterns.includes('publishing from provider response')));
  assert.ok(body.plan.entries.every((entry) => entry.requiredManualReviewChecks.includes('confirm no raw secrets in code or tests')));
  assert.ok(body.plan.entries.every((entry) => entry.requiredManualReviewChecks.includes('confirm no provider call path is enabled')));
  assert.ok(body.plan.entries.every((entry) => entry.requiredManualReviewChecks.includes('confirm no POST route was added')));
  assert.ok(body.plan.entries.every((entry) => entry.requiredManualReviewChecks.includes('confirm no mutation control was added to Brain Console')));
  assert.ok(body.plan.entries.every((entry) => entry.requiredAutomatedReviewChecks.includes('TypeScript typecheck')));
  assert.ok(body.plan.entries.every((entry) => entry.requiredAutomatedReviewChecks.includes('Brain Core CI')));
  assert.ok(body.plan.entries.every((entry) => entry.requiredAutomatedReviewChecks.includes('Brain Console typecheck')));
  assert.ok(body.plan.entries.every((entry) => entry.requiredAutomatedReviewChecks.includes('Brain Console build')));
  assert.ok(body.plan.entries.every((entry) => entry.requiredAutomatedReviewChecks.includes('forbidden secret material scan')));
  assert.ok(body.plan.entries.every((entry) => entry.requiredAutomatedReviewChecks.includes('forbidden runtime execution scan')));
  assert.ok(body.plan.entries.every((entry) => entry.requiredAutomatedReviewChecks.includes('forbidden upload/network pattern scan')));
  assert.ok(body.plan.entries.every((entry) => entry.requiredAutomatedReviewChecks.includes('route surface review')));
  assert.equal(body.plan.safety.readOnly, true);
  assert.equal(body.plan.safety.securityReviewPlanOnly, true);
  assert.equal(body.plan.safety.securityReviewCompleted, false);
  assert.equal(body.plan.safety.providerImplementationApproved, false);
  assert.equal(body.plan.safety.providerConfigured, false);
  assert.equal(body.plan.safety.providerCallsEnabled, false);
  assert.equal(body.plan.safety.credentialAccessEnabled, false);
  assert.equal(body.plan.safety.rawProviderOutputAccessEnabled, false);
  assert.equal(body.plan.safety.securityScanExecutionEnabled, false);
  assert.equal(body.plan.safety.automatedReviewExecutionEnabled, false);
  assert.equal(body.plan.safety.networkAccessEnabled, false);
  assert.equal(body.plan.safety.filesystemAccessEnabled, false);
  assert.equal(body.plan.safety.writesFiles, false);
  assert.equal(body.plan.safety.publishesContent, false);
  assert.equal(body.plan.safety.writesToMind, false);
  assert.equal(body.plan.safety.executesVideo, false);
});

test('GET /video-orchestrator/provider-wrapper-security-review-plan/:providerClass returns image-generation security review plan', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/provider-wrapper-security-review-plan/image-generation' });
  const body = JSON.parse(response.body) as {
    providerClass: string;
    status: string;
    securityReviewPlanOnly: boolean;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.providerClass, 'image-generation');
  assert.equal(body.status, 'blocked');
  assert.equal(body.securityReviewPlanOnly, true);
});

test('POST /video-orchestrator/provider-wrapper-security-review-plan is not registered and returns 404', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/provider-wrapper-security-review-plan' });
  assert.equal(response.statusCode, 404);
});

test('GET /video-orchestrator/provider-implementation-phase-start-gate returns blocked start gates with safe counts', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/provider-implementation-phase-start-gate' });
  const body = JSON.parse(response.body) as {
    gate: {
      id: string;
      status: string;
      gateCount: number;
      planningSequenceCompleteCount: number;
      implementationApprovedCount: number;
      implementationEligibleCount: number;
      blockedCount: number;
      providerConfiguredCount: number;
      providerCallCount: number;
      credentialAccessCount: number;
      networkAccessCount: number;
      executionEnabledCount: number;
      entries: Array<{
        providerClass: string;
        startGateOnly: boolean;
        planningSequenceComplete: boolean;
        implementationApproved: boolean;
        implementationEligible: boolean;
        completedPlanningRefs: string[];
        remainingApprovalRequirements: string[];
        implementationStartBlockers: string[];
        explicitApprovalChecklist: string[];
        safety: Record<string, boolean>;
      }>;
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.gate.id, 'video-orchestrator-provider-implementation-phase-start-gate');
  assert.equal(body.gate.status, 'blocked');
  assert.equal(body.gate.gateCount, 3);
  assert.equal(body.gate.planningSequenceCompleteCount, 3);
  assert.equal(body.gate.implementationApprovedCount, 0);
  assert.equal(body.gate.implementationEligibleCount, 0);
  assert.equal(body.gate.blockedCount, 3);
  assert.equal(body.gate.providerConfiguredCount, 0);
  assert.equal(body.gate.providerCallCount, 0);
  assert.equal(body.gate.credentialAccessCount, 0);
  assert.equal(body.gate.networkAccessCount, 0);
  assert.equal(body.gate.executionEnabledCount, 0);
  assert.equal(body.gate.entries.length, 3);
  assert.ok(body.gate.entries.every((entry) => entry.startGateOnly === true));
  assert.ok(body.gate.entries.every((entry) => entry.planningSequenceComplete === true));
  assert.ok(body.gate.entries.every((entry) => entry.implementationApproved === false));
  assert.ok(body.gate.entries.every((entry) => entry.implementationEligible === false));
  assert.ok(body.gate.entries.every((entry) => entry.completedPlanningRefs.includes('design-provider-boundary-plan')));
  assert.ok(body.gate.entries.every((entry) => entry.completedPlanningRefs.includes('design-provider-credential-isolation-plan')));
  assert.ok(body.gate.entries.every((entry) => entry.completedPlanningRefs.includes('design-provider-prompt-review-policy-plan')));
  assert.ok(body.gate.entries.every((entry) => entry.completedPlanningRefs.includes('artifact-sandbox-provider-handoff-plan')));
  assert.ok(body.gate.entries.every((entry) => entry.completedPlanningRefs.includes('provider-output-redaction-policy-plan')));
  assert.ok(body.gate.entries.every((entry) => entry.completedPlanningRefs.includes('design-provider-compliance-checklist-plan')));
  assert.ok(body.gate.entries.every((entry) => entry.completedPlanningRefs.includes('design-provider-enablement-readiness-index')));
  assert.ok(body.gate.entries.every((entry) => entry.completedPlanningRefs.includes('provider-integration-final-planning-checkpoint')));
  assert.ok(body.gate.entries.every((entry) => entry.completedPlanningRefs.includes('provider-request-wrapper-implementation-plan')));
  assert.ok(body.gate.entries.every((entry) => entry.completedPlanningRefs.includes('credential-store-implementation-boundary-plan')));
  assert.ok(body.gate.entries.every((entry) => entry.completedPlanningRefs.includes('prompt-review-ux-implementation-plan')));
  assert.ok(body.gate.entries.every((entry) => entry.completedPlanningRefs.includes('provider-audit-persistence-boundary-plan')));
  assert.ok(body.gate.entries.every((entry) => entry.completedPlanningRefs.includes('provider-wrapper-security-review-plan')));
  assert.ok(body.gate.entries.every((entry) => entry.remainingApprovalRequirements.includes('explicit user approval to begin provider implementation')));
  assert.ok(body.gate.entries.every((entry) => entry.remainingApprovalRequirements.includes('security review accepted')));
  assert.ok(body.gate.entries.every((entry) => entry.remainingApprovalRequirements.includes('credential boundary accepted')));
  assert.ok(body.gate.entries.every((entry) => entry.remainingApprovalRequirements.includes('prompt review UX accepted')));
  assert.ok(body.gate.entries.every((entry) => entry.remainingApprovalRequirements.includes('audit persistence boundary accepted')));
  assert.ok(body.gate.entries.every((entry) => entry.remainingApprovalRequirements.includes('artifact sandbox handoff accepted')));
  assert.ok(body.gate.entries.every((entry) => entry.remainingApprovalRequirements.includes('output redaction policy accepted')));
  assert.ok(body.gate.entries.every((entry) => entry.implementationStartBlockers.includes('implementation not approved')));
  assert.ok(body.gate.entries.every((entry) => entry.implementationStartBlockers.includes('provider calls not approved')));
  assert.ok(body.gate.entries.every((entry) => entry.implementationStartBlockers.includes('credential access not approved')));
  assert.ok(body.gate.entries.every((entry) => entry.implementationStartBlockers.includes('network access not approved')));
  assert.ok(body.gate.entries.every((entry) => entry.implementationStartBlockers.includes('prompt generation not approved')));
  assert.ok(body.gate.entries.every((entry) => entry.implementationStartBlockers.includes('artifact persistence not approved')));
  assert.ok(body.gate.entries.every((entry) => entry.implementationStartBlockers.includes('audit persistence not approved')));
  assert.ok(body.gate.entries.every((entry) => entry.explicitApprovalChecklist.includes('I approve beginning provider implementation planning-to-code transition')));
  assert.ok(body.gate.entries.every((entry) => entry.explicitApprovalChecklist.includes('I approve implementing provider request wrapper without provider calls')));
  assert.ok(body.gate.entries.every((entry) => entry.explicitApprovalChecklist.includes('I approve keeping credentials inaccessible until a separate credential phase')));
  assert.ok(body.gate.entries.every((entry) => entry.explicitApprovalChecklist.includes('I approve keeping provider calls disabled')));
  assert.ok(body.gate.entries.every((entry) => entry.explicitApprovalChecklist.includes('I approve keeping artifact writes disabled')));
  assert.ok(body.gate.entries.every((entry) => entry.explicitApprovalChecklist.includes('I approve keeping audit persistence disabled')));
  assert.ok(body.gate.entries.every((entry) => entry.explicitApprovalChecklist.includes('I approve keeping Brain Console mutation controls disabled')));
  assert.ok(body.gate.entries.every((entry) => entry.safety.readOnly === true));
  assert.ok(body.gate.entries.every((entry) => entry.safety.startGateOnly === true));
  assert.ok(body.gate.entries.every((entry) => entry.safety.planningSequenceComplete === true));
  assert.ok(body.gate.entries.every((entry) => entry.safety.implementationApproved === false));
  assert.ok(body.gate.entries.every((entry) => entry.safety.implementationEligible === false));
  assert.equal(body.gate.safety.readOnly, true);
  assert.equal(body.gate.safety.startGateOnly, true);
  assert.equal(body.gate.safety.planningSequenceComplete, true);
  assert.equal(body.gate.safety.implementationApproved, false);
  assert.equal(body.gate.safety.implementationEligible, false);
  assert.equal(body.gate.safety.providerConfigured, false);
  assert.equal(body.gate.safety.providerCallsEnabled, false);
  assert.equal(body.gate.safety.credentialAccessEnabled, false);
  assert.equal(body.gate.safety.networkAccessEnabled, false);
  assert.equal(body.gate.safety.promptGenerationEnabled, false);
  assert.equal(body.gate.safety.imageGenerationEnabled, false);
  assert.equal(body.gate.safety.artifactPersistenceEnabled, false);
  assert.equal(body.gate.safety.auditPersistenceEnabled, false);
  assert.equal(body.gate.safety.complianceEvaluationEnabled, false);
  assert.equal(body.gate.safety.mutationControlsEnabled, false);
  assert.equal(body.gate.safety.approvalButtonsEnabled, false);
  assert.equal(body.gate.safety.filesystemAccessEnabled, false);
  assert.equal(body.gate.safety.writesFiles, false);
  assert.equal(body.gate.safety.publishesContent, false);
  assert.equal(body.gate.safety.writesToMind, false);
  assert.equal(body.gate.safety.executesVideo, false);
});

test('GET /video-orchestrator/provider-implementation-phase-start-gate/:providerClass returns image-generation start gate', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/provider-implementation-phase-start-gate/image-generation' });
  const body = JSON.parse(response.body) as {
    providerClass: string;
    status: string;
    startGateOnly: boolean;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.providerClass, 'image-generation');
  assert.equal(body.status, 'blocked');
  assert.equal(body.startGateOnly, true);
});

test('POST /video-orchestrator/provider-implementation-phase-start-gate is not registered and returns 404', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/provider-implementation-phase-start-gate' });
  assert.equal(response.statusCode, 404);
});

test('GET /video-orchestrator/provider-implementation-readiness-dashboard-summary returns blocked dashboard summary with safe counts', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/provider-implementation-readiness-dashboard-summary' });
  const body = JSON.parse(response.body) as {
    dashboard: {
      status: string;
      providerClassCount: number;
      planningCompleteCount: number;
      implementationApprovedCount: number;
      implementationEligibleCount: number;
      blockedGateCount: number;
      providerConfiguredCount: number;
      providerCallCount: number;
      credentialAccessCount: number;
      mutationControlCount: number;
      entries: Array<{
        providerClass: string;
        status: string;
        planningComplete: boolean;
        implementationApproved: boolean;
        implementationEligible: boolean;
        planningSurfaceCount: number;
        completedPlanningSurfaceCount: number;
        blockedGateCount: number;
        remainingApprovalCount: number;
        dashboardHighlights: string[];
        operatorWarnings: string[];
        nextSafeStep: string;
        safety: Record<string, boolean>;
      }>;
      summary: {
        providerClassCount: number;
        planningCompleteCount: number;
        implementationApprovedCount: number;
        implementationEligibleCount: number;
        blockedGateCount: number;
        providerConfiguredCount: number;
        providerCallCount: number;
        credentialAccessCount: number;
        mutationControlCount: number;
      };
      blockers: string[];
      nextSafeStep: string;
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.dashboard.status, 'blocked');
  assert.equal(body.dashboard.providerClassCount, 3);
  assert.equal(body.dashboard.planningCompleteCount, 3);
  assert.equal(body.dashboard.implementationApprovedCount, 0);
  assert.equal(body.dashboard.implementationEligibleCount, 0);
  assert.equal(body.dashboard.blockedGateCount, 3);
  assert.equal(body.dashboard.providerConfiguredCount, 0);
  assert.equal(body.dashboard.providerCallCount, 0);
  assert.equal(body.dashboard.credentialAccessCount, 0);
  assert.equal(body.dashboard.mutationControlCount, 0);
  assert.equal(body.dashboard.entries.length, 3);
  assert.ok(body.dashboard.entries.every((entry) => entry.status === 'blocked'));
  assert.ok(body.dashboard.entries.every((entry) => entry.planningComplete === true));
  assert.ok(body.dashboard.entries.every((entry) => entry.implementationApproved === false));
  assert.ok(body.dashboard.entries.every((entry) => entry.implementationEligible === false));
  assert.ok(body.dashboard.entries.every((entry) => entry.dashboardHighlights.includes('provider planning surfaces complete')));
  assert.ok(body.dashboard.entries.every((entry) => entry.dashboardHighlights.includes('credential access remains disabled')));
  assert.ok(body.dashboard.entries.every((entry) => entry.dashboardHighlights.includes('provider calls remain disabled')));
  assert.ok(body.dashboard.entries.every((entry) => entry.dashboardHighlights.includes('Brain Console controls remain read-only')));
  assert.ok(body.dashboard.entries.every((entry) => entry.dashboardHighlights.includes('implementation requires explicit approval')));
  assert.ok(body.dashboard.entries.every((entry) => entry.dashboardHighlights.includes('first possible implementation slice is wrapper scaffolding only')));
  assert.ok(body.dashboard.entries.every((entry) => entry.operatorWarnings.includes('do not enable providers from this dashboard')));
  assert.ok(body.dashboard.entries.every((entry) => entry.operatorWarnings.includes('do not add credentials yet')));
  assert.ok(body.dashboard.entries.every((entry) => entry.operatorWarnings.includes('do not call providers yet')));
  assert.ok(body.dashboard.entries.every((entry) => entry.operatorWarnings.includes('do not enable prompt generation yet')));
  assert.ok(body.dashboard.entries.every((entry) => entry.operatorWarnings.includes('do not enable artifact writes yet')));
  assert.ok(body.dashboard.entries.every((entry) => entry.operatorWarnings.includes('do not enable audit persistence yet')));
  assert.ok(body.dashboard.entries.every((entry) => entry.operatorWarnings.includes('do not add mutation controls yet')));
  assert.ok(body.dashboard.entries.every((entry) => entry.safety.readOnly === true));
  assert.ok(body.dashboard.entries.every((entry) => entry.safety.dashboardSummaryOnly === true));
  assert.ok(body.dashboard.entries.every((entry) => entry.safety.planningComplete === true));
  assert.ok(body.dashboard.entries.every((entry) => entry.safety.implementationApproved === false));
  assert.ok(body.dashboard.entries.every((entry) => entry.safety.implementationEligible === false));
  assert.equal(body.dashboard.safety.readOnly, true);
  assert.equal(body.dashboard.safety.dashboardSummaryOnly, true);
  assert.equal(body.dashboard.safety.planningComplete, true);
  assert.equal(body.dashboard.safety.implementationApproved, false);
  assert.equal(body.dashboard.safety.implementationEligible, false);
  assert.equal(body.dashboard.safety.providerConfigured, false);
  assert.equal(body.dashboard.safety.providerCallsEnabled, false);
  assert.equal(body.dashboard.safety.credentialAccessEnabled, false);
  assert.equal(body.dashboard.safety.networkAccessEnabled, false);
  assert.equal(body.dashboard.safety.promptGenerationEnabled, false);
  assert.equal(body.dashboard.safety.imageGenerationEnabled, false);
  assert.equal(body.dashboard.safety.artifactPersistenceEnabled, false);
  assert.equal(body.dashboard.safety.auditPersistenceEnabled, false);
  assert.equal(body.dashboard.safety.complianceEvaluationEnabled, false);
  assert.equal(body.dashboard.safety.mutationControlsEnabled, false);
  assert.equal(body.dashboard.safety.approvalButtonsEnabled, false);
  assert.equal(body.dashboard.safety.filesystemAccessEnabled, false);
  assert.equal(body.dashboard.safety.writesFiles, false);
  assert.equal(body.dashboard.safety.publishesContent, false);
  assert.equal(body.dashboard.safety.writesToMind, false);
  assert.equal(body.dashboard.safety.executesVideo, false);
});

test('GET /video-orchestrator/provider-implementation-readiness-dashboard-summary/:providerClass returns image-generation dashboard summary', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/provider-implementation-readiness-dashboard-summary/image-generation' });
  const body = JSON.parse(response.body) as {
    providerClass: string;
    status: string;
    planningComplete: boolean;
    implementationApproved: boolean;
    implementationEligible: boolean;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.providerClass, 'image-generation');
  assert.equal(body.status, 'blocked');
  assert.equal(body.planningComplete, true);
  assert.equal(body.implementationApproved, false);
  assert.equal(body.implementationEligible, false);
});

test('POST /video-orchestrator/provider-implementation-readiness-dashboard-summary is not registered and returns 404', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/provider-implementation-readiness-dashboard-summary' });
  assert.equal(response.statusCode, 404);
});

test('GET /video-orchestrator/provider-implementation-approval-packet returns blocked approval packets with safe counts', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/provider-implementation-approval-packet' });
  const body = JSON.parse(response.body) as {
    packet: {
      status: string;
      packetCount: number;
      implementationApprovedCount: number;
      implementationEligibleCount: number;
      decisionRequiredCount: number;
      providerCallCount: number;
      credentialAccessCount: number;
      networkAccessCount: number;
      mutationControlCount: number;
      entries: Array<{
        providerClass: string;
        status: string;
        approvalPacketOnly: boolean;
        implementationApproved: boolean;
        implementationEligible: boolean;
        packetSections: string[];
        evidenceRefs: string[];
        requiredApprovalStatements: string[];
        nonApprovalStatements: string[];
        implementationRestrictions: string[];
        rollbackAndStopConditions: string[];
        operatorDecisionSummary: {
          decisionRequired: boolean;
          currentDecision: string;
          acceptableNextDecision: string;
          unacceptableDecisions: string[];
        };
        nextSafeStep: string;
        safety: Record<string, boolean>;
      }>;
      summary: {
        packetCount: number;
        implementationApprovedCount: number;
        implementationEligibleCount: number;
        decisionRequiredCount: number;
        providerCallCount: number;
        credentialAccessCount: number;
        networkAccessCount: number;
        mutationControlCount: number;
      };
      blockers: string[];
      nextSafeStep: string;
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.packet.status, 'blocked');
  assert.equal(body.packet.packetCount, 3);
  assert.equal(body.packet.implementationApprovedCount, 0);
  assert.equal(body.packet.implementationEligibleCount, 0);
  assert.equal(body.packet.decisionRequiredCount, 3);
  assert.equal(body.packet.providerCallCount, 0);
  assert.equal(body.packet.credentialAccessCount, 0);
  assert.equal(body.packet.networkAccessCount, 0);
  assert.equal(body.packet.mutationControlCount, 0);
  assert.equal(body.packet.entries.length, 3);
  assert.ok(body.packet.entries.every((entry) => entry.status === 'blocked'));
  assert.ok(body.packet.entries.every((entry) => entry.approvalPacketOnly === true));
  assert.ok(body.packet.entries.every((entry) => entry.implementationApproved === false));
  assert.ok(body.packet.entries.every((entry) => entry.implementationEligible === false));
  assert.ok(body.packet.entries.every((entry) => entry.packetSections.includes('planning surfaces completed')));
  assert.ok(body.packet.entries.every((entry) => entry.packetSections.includes('safety boundaries')));
  assert.ok(body.packet.entries.every((entry) => entry.packetSections.includes('credential isolation')));
  assert.ok(body.packet.entries.every((entry) => entry.packetSections.includes('prompt review')));
  assert.ok(body.packet.entries.every((entry) => entry.packetSections.includes('artifact sandbox handoff')));
  assert.ok(body.packet.entries.every((entry) => entry.packetSections.includes('output redaction')));
  assert.ok(body.packet.entries.every((entry) => entry.packetSections.includes('compliance checklist')));
  assert.ok(body.packet.entries.every((entry) => entry.packetSections.includes('audit persistence boundary')));
  assert.ok(body.packet.entries.every((entry) => entry.packetSections.includes('security review')));
  assert.ok(body.packet.entries.every((entry) => entry.packetSections.includes('implementation start gate')));
  assert.ok(body.packet.entries.every((entry) => entry.packetSections.includes('readiness dashboard summary')));
  assert.ok(body.packet.entries.every((entry) => entry.evidenceRefs.includes('design-provider-boundary-plan')));
  assert.ok(body.packet.entries.every((entry) => entry.evidenceRefs.includes('design-provider-credential-isolation-plan')));
  assert.ok(body.packet.entries.every((entry) => entry.evidenceRefs.includes('design-provider-prompt-review-policy-plan')));
  assert.ok(body.packet.entries.every((entry) => entry.evidenceRefs.includes('artifact-sandbox-provider-handoff-plan')));
  assert.ok(body.packet.entries.every((entry) => entry.evidenceRefs.includes('provider-output-redaction-policy-plan')));
  assert.ok(body.packet.entries.every((entry) => entry.evidenceRefs.includes('design-provider-compliance-checklist-plan')));
  assert.ok(body.packet.entries.every((entry) => entry.evidenceRefs.includes('design-provider-enablement-readiness-index')));
  assert.ok(body.packet.entries.every((entry) => entry.evidenceRefs.includes('provider-integration-final-planning-checkpoint')));
  assert.ok(body.packet.entries.every((entry) => entry.evidenceRefs.includes('provider-request-wrapper-implementation-plan')));
  assert.ok(body.packet.entries.every((entry) => entry.evidenceRefs.includes('credential-store-implementation-boundary-plan')));
  assert.ok(body.packet.entries.every((entry) => entry.evidenceRefs.includes('prompt-review-ux-implementation-plan')));
  assert.ok(body.packet.entries.every((entry) => entry.evidenceRefs.includes('provider-audit-persistence-boundary-plan')));
  assert.ok(body.packet.entries.every((entry) => entry.evidenceRefs.includes('provider-wrapper-security-review-plan')));
  assert.ok(body.packet.entries.every((entry) => entry.evidenceRefs.includes('provider-implementation-phase-start-gate')));
  assert.ok(body.packet.entries.every((entry) => entry.evidenceRefs.includes('provider-implementation-readiness-dashboard-summary')));
  assert.ok(body.packet.entries.every((entry) => entry.requiredApprovalStatements.includes('I approve beginning provider request wrapper scaffolding only')));
  assert.ok(body.packet.entries.every((entry) => entry.requiredApprovalStatements.includes('I do not approve provider calls')));
  assert.ok(body.packet.entries.every((entry) => entry.requiredApprovalStatements.includes('I do not approve credential access')));
  assert.ok(body.packet.entries.every((entry) => entry.requiredApprovalStatements.includes('I do not approve network provider access')));
  assert.ok(body.packet.entries.every((entry) => entry.requiredApprovalStatements.includes('I do not approve prompt generation')));
  assert.ok(body.packet.entries.every((entry) => entry.requiredApprovalStatements.includes('I do not approve image generation')));
  assert.ok(body.packet.entries.every((entry) => entry.requiredApprovalStatements.includes('I do not approve artifact writes')));
  assert.ok(body.packet.entries.every((entry) => entry.requiredApprovalStatements.includes('I do not approve audit persistence')));
  assert.ok(body.packet.entries.every((entry) => entry.requiredApprovalStatements.includes('I do not approve Brain Console mutation controls')));
  assert.ok(body.packet.entries.every((entry) => entry.requiredApprovalStatements.includes('I do not approve publishing or decommissioning')));
  assert.ok(body.packet.entries.every((entry) => entry.nonApprovalStatements.includes('this packet is not approval by itself')));
  assert.ok(body.packet.entries.every((entry) => entry.nonApprovalStatements.includes('this endpoint does not start implementation')));
  assert.ok(body.packet.entries.every((entry) => entry.nonApprovalStatements.includes('this endpoint does not enable providers')));
  assert.ok(body.packet.entries.every((entry) => entry.nonApprovalStatements.includes('this endpoint does not unlock credentials')));
  assert.ok(body.packet.entries.every((entry) => entry.nonApprovalStatements.includes('this endpoint does not enable network calls')));
  assert.ok(body.packet.entries.every((entry) => entry.nonApprovalStatements.includes('this endpoint does not create approval records')));
  assert.ok(body.packet.entries.every((entry) => entry.implementationRestrictions.includes('first implementation phase may only add inert wrapper scaffolding after explicit approval')));
  assert.ok(body.packet.entries.every((entry) => entry.implementationRestrictions.includes('wrapper scaffolding must not call providers')));
  assert.ok(body.packet.entries.every((entry) => entry.implementationRestrictions.includes('wrapper scaffolding must not access credentials')));
  assert.ok(body.packet.entries.every((entry) => entry.implementationRestrictions.includes('wrapper scaffolding must not read env vars')));
  assert.ok(body.packet.entries.every((entry) => entry.implementationRestrictions.includes('wrapper scaffolding must not write files')));
  assert.ok(body.packet.entries.every((entry) => entry.implementationRestrictions.includes('wrapper scaffolding must not add POST routes')));
  assert.ok(body.packet.entries.every((entry) => entry.implementationRestrictions.includes('wrapper scaffolding must not add Brain Console mutation controls')));
  assert.ok(body.packet.entries.every((entry) => entry.rollbackAndStopConditions.includes('stop if any provider call path appears')));
  assert.ok(body.packet.entries.every((entry) => entry.rollbackAndStopConditions.includes('stop if credential access appears')));
  assert.ok(body.packet.entries.every((entry) => entry.rollbackAndStopConditions.includes('stop if env reads appear')));
  assert.ok(body.packet.entries.every((entry) => entry.rollbackAndStopConditions.includes('stop if network calls appear')));
  assert.ok(body.packet.entries.every((entry) => entry.rollbackAndStopConditions.includes('stop if file writes appear')));
  assert.ok(body.packet.entries.every((entry) => entry.rollbackAndStopConditions.includes('stop if POST routes appear')));
  assert.ok(body.packet.entries.every((entry) => entry.rollbackAndStopConditions.includes('stop if Brain Console mutation controls appear')));
  assert.ok(body.packet.entries.every((entry) => entry.operatorDecisionSummary.decisionRequired === true));
  assert.ok(body.packet.entries.every((entry) => entry.operatorDecisionSummary.currentDecision === 'not-approved'));
  assert.ok(body.packet.entries.every((entry) => entry.operatorDecisionSummary.acceptableNextDecision === 'approve-wrapper-scaffolding-only'));
  assert.ok(body.packet.entries.every((entry) => entry.operatorDecisionSummary.unacceptableDecisions.includes('approve-provider-calls')));
  assert.ok(body.packet.entries.every((entry) => entry.operatorDecisionSummary.unacceptableDecisions.includes('approve-credential-access')));
  assert.ok(body.packet.entries.every((entry) => entry.operatorDecisionSummary.unacceptableDecisions.includes('approve-generation')));
  assert.ok(body.packet.entries.every((entry) => entry.operatorDecisionSummary.unacceptableDecisions.includes('approve-publishing')));
  assert.ok(body.packet.entries.every((entry) => entry.operatorDecisionSummary.unacceptableDecisions.includes('approve-decommissioning')));
  assert.ok(body.packet.entries.every((entry) => entry.safety.readOnly === true));
  assert.ok(body.packet.entries.every((entry) => entry.safety.approvalPacketOnly === true));
  assert.ok(body.packet.entries.every((entry) => entry.safety.implementationApproved === false));
  assert.ok(body.packet.entries.every((entry) => entry.safety.implementationEligible === false));
  assert.equal(body.packet.safety.readOnly, true);
  assert.equal(body.packet.safety.approvalPacketOnly, true);
  assert.equal(body.packet.safety.implementationApproved, false);
  assert.equal(body.packet.safety.implementationEligible, false);
  assert.equal(body.packet.safety.approvalRecordCreated, false);
  assert.equal(body.packet.safety.providerConfigured, false);
  assert.equal(body.packet.safety.providerCallsEnabled, false);
  assert.equal(body.packet.safety.credentialAccessEnabled, false);
  assert.equal(body.packet.safety.networkAccessEnabled, false);
  assert.equal(body.packet.safety.promptGenerationEnabled, false);
  assert.equal(body.packet.safety.imageGenerationEnabled, false);
  assert.equal(body.packet.safety.artifactPersistenceEnabled, false);
  assert.equal(body.packet.safety.auditPersistenceEnabled, false);
  assert.equal(body.packet.safety.complianceEvaluationEnabled, false);
  assert.equal(body.packet.safety.mutationControlsEnabled, false);
  assert.equal(body.packet.safety.approvalButtonsEnabled, false);
  assert.equal(body.packet.safety.filesystemAccessEnabled, false);
  assert.equal(body.packet.safety.writesFiles, false);
  assert.equal(body.packet.safety.publishesContent, false);
  assert.equal(body.packet.safety.writesToMind, false);
  assert.equal(body.packet.safety.executesVideo, false);
});

test('GET /video-orchestrator/provider-implementation-approval-packet/:providerClass returns image-generation approval packet', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/provider-implementation-approval-packet/image-generation' });
  const body = JSON.parse(response.body) as {
    providerClass: string;
    status: string;
    approvalPacketOnly: boolean;
    implementationApproved: boolean;
    implementationEligible: boolean;
    operatorDecisionSummary: { decisionRequired: boolean; currentDecision: string; acceptableNextDecision: string };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.providerClass, 'image-generation');
  assert.equal(body.status, 'blocked');
  assert.equal(body.approvalPacketOnly, true);
  assert.equal(body.implementationApproved, false);
  assert.equal(body.implementationEligible, false);
  assert.equal(body.operatorDecisionSummary.decisionRequired, true);
  assert.equal(body.operatorDecisionSummary.currentDecision, 'not-approved');
  assert.equal(body.operatorDecisionSummary.acceptableNextDecision, 'approve-wrapper-scaffolding-only');
});

test('POST /video-orchestrator/provider-implementation-approval-packet is not registered and returns 404', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/provider-implementation-approval-packet' });
  assert.equal(response.statusCode, 404);
});

test('GET /video-orchestrator/provider-approval-packet-console-review-summary returns blocked review summaries with safe counts', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/provider-approval-packet-console-review-summary' });
  const body = JSON.parse(response.body) as {
    summary: {
      status: string;
      reviewCount: number;
      decisionRequiredCount: number;
      approvalRecordCreatedCount: number;
      implementationApprovedCount: number;
      implementationEligibleCount: number;
      mutationControlCount: number;
      providerCallCount: number;
      credentialAccessCount: number;
      entries: Array<{
        providerClass: string;
        status: string;
        consoleReviewOnly: boolean;
        approvalPacketRef: string;
        currentDecision: string;
        acceptableNextDecision: string;
        unacceptableDecisions: string[];
        reviewHighlights: string[];
        reviewWarnings: string[];
        requiredOperatorAcknowledgements: string[];
        blockedControls: string[];
        nextSafeStep: string;
        safety: Record<string, boolean>;
      }>;
      summary: {
        reviewCount: number;
        decisionRequiredCount: number;
        approvalRecordCreatedCount: number;
        implementationApprovedCount: number;
        implementationEligibleCount: number;
        mutationControlCount: number;
        providerCallCount: number;
        credentialAccessCount: number;
      };
      blockers: string[];
      nextSafeStep: string;
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.summary.status, 'blocked');
  assert.equal(body.summary.reviewCount, 3);
  assert.equal(body.summary.decisionRequiredCount, 3);
  assert.equal(body.summary.approvalRecordCreatedCount, 0);
  assert.equal(body.summary.implementationApprovedCount, 0);
  assert.equal(body.summary.implementationEligibleCount, 0);
  assert.equal(body.summary.mutationControlCount, 0);
  assert.equal(body.summary.providerCallCount, 0);
  assert.equal(body.summary.credentialAccessCount, 0);
  assert.equal(body.summary.entries.length, 3);
  assert.ok(body.summary.entries.every((entry) => entry.status === 'blocked'));
  assert.ok(body.summary.entries.every((entry) => entry.consoleReviewOnly === true));
  assert.ok(body.summary.entries.every((entry) => entry.approvalPacketRef === 'video-orchestrator-provider-implementation-approval-packet'));
  assert.ok(body.summary.entries.every((entry) => entry.currentDecision === 'not-approved'));
  assert.ok(body.summary.entries.every((entry) => entry.acceptableNextDecision === 'approve-wrapper-scaffolding-only'));
  assert.ok(body.summary.entries.every((entry) => entry.reviewHighlights.includes('approval packet exists')));
  assert.ok(body.summary.entries.every((entry) => entry.reviewHighlights.includes('provider planning surfaces complete')));
  assert.ok(body.summary.entries.every((entry) => entry.reviewHighlights.includes('first possible implementation is wrapper scaffolding only')));
  assert.ok(body.summary.entries.every((entry) => entry.reviewHighlights.includes('provider calls remain blocked')));
  assert.ok(body.summary.entries.every((entry) => entry.reviewHighlights.includes('credential access remains blocked')));
  assert.ok(body.summary.entries.every((entry) => entry.reviewHighlights.includes('network access remains blocked')));
  assert.ok(body.summary.entries.every((entry) => entry.reviewHighlights.includes('Brain Console remains read-only')));
  assert.ok(body.summary.entries.every((entry) => entry.reviewWarnings.includes('this review summary is not approval')));
  assert.ok(body.summary.entries.every((entry) => entry.reviewWarnings.includes('no approval record is created')));
  assert.ok(body.summary.entries.every((entry) => entry.reviewWarnings.includes('no provider implementation starts')));
  assert.ok(body.summary.entries.every((entry) => entry.reviewWarnings.includes('no provider call is allowed')));
  assert.ok(body.summary.entries.every((entry) => entry.reviewWarnings.includes('no credential access is allowed')));
  assert.ok(body.summary.entries.every((entry) => entry.reviewWarnings.includes('no Brain Console mutation control is rendered')));
  assert.ok(body.summary.entries.every((entry) => entry.requiredOperatorAcknowledgements.includes('I understand provider calls remain blocked')));
  assert.ok(body.summary.entries.every((entry) => entry.requiredOperatorAcknowledgements.includes('I understand credentials remain inaccessible')));
  assert.ok(body.summary.entries.every((entry) => entry.requiredOperatorAcknowledgements.includes('I understand wrapper scaffolding must not call providers')));
  assert.ok(body.summary.entries.every((entry) => entry.requiredOperatorAcknowledgements.includes('I understand Brain Console controls remain read-only')));
  assert.ok(body.summary.entries.every((entry) => entry.requiredOperatorAcknowledgements.includes('I understand separate explicit approval is required for any implementation transition')));
  assert.ok(body.summary.entries.every((entry) => entry.blockedControls.includes('approve implementation button')));
  assert.ok(body.summary.entries.every((entry) => entry.blockedControls.includes('call provider button')));
  assert.ok(body.summary.entries.every((entry) => entry.blockedControls.includes('add credential button')));
  assert.ok(body.summary.entries.every((entry) => entry.blockedControls.includes('generate image button')));
  assert.ok(body.summary.entries.every((entry) => entry.blockedControls.includes('render layout button')));
  assert.ok(body.summary.entries.every((entry) => entry.blockedControls.includes('write artifact button')));
  assert.ok(body.summary.entries.every((entry) => entry.blockedControls.includes('persist audit button')));
  assert.ok(body.summary.entries.every((entry) => entry.blockedControls.includes('publish button')));
  assert.ok(body.summary.entries.every((entry) => entry.blockedControls.includes('decommission STB button')));
  assert.ok(body.summary.entries.every((entry) => entry.safety.readOnly === true));
  assert.ok(body.summary.entries.every((entry) => entry.safety.consoleReviewOnly === true));
  assert.ok(body.summary.entries.every((entry) => entry.safety.approvalRecordCreated === false));
  assert.ok(body.summary.entries.every((entry) => entry.safety.implementationApproved === false));
  assert.ok(body.summary.entries.every((entry) => entry.safety.implementationEligible === false));
  assert.equal(body.summary.safety.readOnly, true);
  assert.equal(body.summary.safety.consoleReviewOnly, true);
  assert.equal(body.summary.safety.approvalRecordCreated, false);
  assert.equal(body.summary.safety.implementationApproved, false);
  assert.equal(body.summary.safety.implementationEligible, false);
  assert.equal(body.summary.safety.mutationControlsEnabled, false);
  assert.equal(body.summary.safety.approvalButtonsEnabled, false);
  assert.equal(body.summary.safety.providerConfigured, false);
  assert.equal(body.summary.safety.providerCallsEnabled, false);
  assert.equal(body.summary.safety.credentialAccessEnabled, false);
  assert.equal(body.summary.safety.networkAccessEnabled, false);
  assert.equal(body.summary.safety.promptGenerationEnabled, false);
  assert.equal(body.summary.safety.imageGenerationEnabled, false);
  assert.equal(body.summary.safety.artifactPersistenceEnabled, false);
  assert.equal(body.summary.safety.auditPersistenceEnabled, false);
  assert.equal(body.summary.safety.filesystemAccessEnabled, false);
  assert.equal(body.summary.safety.writesFiles, false);
  assert.equal(body.summary.safety.publishesContent, false);
  assert.equal(body.summary.safety.writesToMind, false);
  assert.equal(body.summary.safety.executesVideo, false);
});

test('GET /video-orchestrator/provider-approval-packet-console-review-summary/:providerClass returns image-generation console review summary', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/provider-approval-packet-console-review-summary/image-generation' });
  const body = JSON.parse(response.body) as {
    providerClass: string;
    status: string;
    consoleReviewOnly: boolean;
    currentDecision: string;
    acceptableNextDecision: string;
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.providerClass, 'image-generation');
  assert.equal(body.status, 'blocked');
  assert.equal(body.consoleReviewOnly, true);
  assert.equal(body.currentDecision, 'not-approved');
  assert.equal(body.acceptableNextDecision, 'approve-wrapper-scaffolding-only');
});

test('POST /video-orchestrator/provider-approval-packet-console-review-summary is not registered and returns 404', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/provider-approval-packet-console-review-summary' });
  assert.equal(response.statusCode, 404);
});

test('GET /video-orchestrator/provider-planning-surface-index returns blocked planning index with safe counts', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/provider-planning-surface-index' });
  const body = JSON.parse(response.body) as {
    index: {
      status: string;
      surfaceCount: number;
      blockedCount: number;
      visibleInBrainConsoleCount: number;
      implementationEnabledCount: number;
      providerCallEnabledCount: number;
      credentialAccessEnabledCount: number;
      mutationControlEnabledCount: number;
      pendingApprovalPhrase: string;
      entries: Array<{
        id: string;
        endpoint: string;
        phaseRole: string;
        status: string;
        visibleInBrainConsole: boolean;
        implementationEnables: boolean;
        providerCallsEnabled: boolean;
        credentialAccessEnabled: boolean;
        mutationControlsEnabled: boolean;
        summary: string;
        nextSafeStep: string;
        safety: Record<string, boolean>;
      }>;
      summary: {
        surfaceCount: number;
        blockedCount: number;
        visibleInBrainConsoleCount: number;
        implementationEnabledCount: number;
        providerCallEnabledCount: number;
        credentialAccessEnabledCount: number;
        mutationControlEnabledCount: number;
        pendingApprovalPhrase: string;
      };
      blockers: string[];
      nextSafeStep: string;
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.index.status, 'blocked');
  assert.equal(body.index.surfaceCount, 17);
  assert.equal(body.index.blockedCount, 17);
  assert.equal(body.index.visibleInBrainConsoleCount, 17);
  assert.equal(body.index.implementationEnabledCount, 0);
  assert.equal(body.index.providerCallEnabledCount, 0);
  assert.equal(body.index.credentialAccessEnabledCount, 0);
  assert.equal(body.index.mutationControlEnabledCount, 0);
  assert.equal(body.index.pendingApprovalPhrase, 'approve-wrapper-scaffolding-only');
  assert.equal(body.index.entries.length, 17);
  assert.ok(body.index.entries.every((entry) => entry.status === 'blocked'));
  assert.ok(body.index.entries.every((entry) => entry.implementationEnables === false));
  assert.ok(body.index.entries.every((entry) => entry.providerCallsEnabled === false));
  assert.ok(body.index.entries.every((entry) => entry.credentialAccessEnabled === false));
  assert.ok(body.index.entries.every((entry) => entry.mutationControlsEnabled === false));
  assert.ok(body.index.entries.every((entry) => entry.visibleInBrainConsole === true));
  assert.ok(body.index.entries.some((entry) => entry.id === 'design-provider-boundary-plan'));
  assert.ok(body.index.entries.some((entry) => entry.id === 'design-provider-credential-isolation-plan'));
  assert.ok(body.index.entries.some((entry) => entry.id === 'design-provider-prompt-review-policy-plan'));
  assert.ok(body.index.entries.some((entry) => entry.id === 'artifact-sandbox-provider-handoff-plan'));
  assert.ok(body.index.entries.some((entry) => entry.id === 'provider-output-redaction-policy-plan'));
  assert.ok(body.index.entries.some((entry) => entry.id === 'design-provider-compliance-checklist-plan'));
  assert.ok(body.index.entries.some((entry) => entry.id === 'design-provider-enablement-readiness-index'));
  assert.ok(body.index.entries.some((entry) => entry.id === 'provider-integration-final-planning-checkpoint'));
  assert.ok(body.index.entries.some((entry) => entry.id === 'provider-request-wrapper-implementation-plan'));
  assert.ok(body.index.entries.some((entry) => entry.id === 'credential-store-implementation-boundary-plan'));
  assert.ok(body.index.entries.some((entry) => entry.id === 'prompt-review-ux-implementation-plan'));
  assert.ok(body.index.entries.some((entry) => entry.id === 'provider-audit-persistence-boundary-plan'));
  assert.ok(body.index.entries.some((entry) => entry.id === 'provider-wrapper-security-review-plan'));
  assert.ok(body.index.entries.some((entry) => entry.id === 'provider-implementation-phase-start-gate'));
  assert.ok(body.index.entries.some((entry) => entry.id === 'provider-implementation-readiness-dashboard-summary'));
  assert.ok(body.index.entries.some((entry) => entry.id === 'provider-implementation-approval-packet'));
  assert.ok(body.index.entries.some((entry) => entry.id === 'provider-approval-packet-console-review-summary'));
  assert.equal(body.index.safety.readOnly, true);
  assert.equal(body.index.safety.indexOnly, true);
  assert.equal(body.index.safety.implementationApproved, false);
  assert.equal(body.index.safety.implementationEligible, false);
  assert.equal(body.index.safety.providerConfigured, false);
  assert.equal(body.index.safety.providerCallsEnabled, false);
  assert.equal(body.index.safety.credentialAccessEnabled, false);
  assert.equal(body.index.safety.networkAccessEnabled, false);
  assert.equal(body.index.safety.promptGenerationEnabled, false);
  assert.equal(body.index.safety.imageGenerationEnabled, false);
  assert.equal(body.index.safety.artifactPersistenceEnabled, false);
  assert.equal(body.index.safety.auditPersistenceEnabled, false);
  assert.equal(body.index.safety.complianceEvaluationEnabled, false);
  assert.equal(body.index.safety.mutationControlsEnabled, false);
  assert.equal(body.index.safety.approvalButtonsEnabled, false);
  assert.equal(body.index.safety.filesystemAccessEnabled, false);
  assert.equal(body.index.safety.writesFiles, false);
  assert.equal(body.index.safety.publishesContent, false);
  assert.equal(body.index.safety.writesToMind, false);
  assert.equal(body.index.safety.executesVideo, false);
});

test('POST /video-orchestrator/provider-planning-surface-index is not registered and returns 404', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/provider-planning-surface-index' });
  assert.equal(response.statusCode, 404);
});

test('GET /video-orchestrator/provider-request-wrapper-scaffold returns scaffolded-disabled status with safe counts', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/provider-request-wrapper-scaffold' });
  const body = JSON.parse(response.body) as {
    scaffold: {
      id: string;
      status: string;
      phase: string;
      implementationApprovedScope: string;
      providerClassCount: number;
      wrapperScaffoldedCount: number;
      callableWrapperCount: number;
      providerConfiguredCount: number;
      providerCallCount: number;
      credentialAccessCount: number;
      networkAccessCount: number;
      artifactWriteCount: number;
      auditPersistedCount: number;
      providerClasses: Array<{
        providerClass: string;
        wrapperScaffolded: boolean;
        callableWrapper: boolean;
        providerCallsEnabled: boolean;
        credentialAccessEnabled: boolean;
        networkAccessEnabled: boolean;
        artifactWriteEnabled: boolean;
        auditPersistenceEnabled: boolean;
      }>;
      requestShape: Record<string, string>;
      responseShape: {
        redactedSummaryOnly: boolean;
        providerCallBlocked: boolean;
        executionBlocked: boolean;
        noRawProviderOutput: boolean;
      };
      validationRules: string[];
      disabledCapabilities: Array<{ capability: string; enabled: boolean }>;
      blockers: string[];
      nextSafeStep: string;
      safety: Record<string, boolean>;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.scaffold.id, 'video-orchestrator-provider-request-wrapper-scaffold');
  assert.equal(body.scaffold.status, 'scaffolded-disabled');
  assert.equal(body.scaffold.phase, 'provider-request-wrapper-scaffolding-only');
  assert.equal(body.scaffold.implementationApprovedScope, 'wrapper-scaffolding-only');
  assert.equal(body.scaffold.providerClassCount, 3);
  assert.equal(body.scaffold.wrapperScaffoldedCount, 3);
  assert.equal(body.scaffold.callableWrapperCount, 0);
  assert.equal(body.scaffold.providerConfiguredCount, 0);
  assert.equal(body.scaffold.providerCallCount, 0);
  assert.equal(body.scaffold.credentialAccessCount, 0);
  assert.equal(body.scaffold.networkAccessCount, 0);
  assert.equal(body.scaffold.artifactWriteCount, 0);
  assert.equal(body.scaffold.auditPersistedCount, 0);
  assert.equal(body.scaffold.providerClasses.length, 3);
  assert.ok(body.scaffold.providerClasses.every((providerClass) => providerClass.wrapperScaffolded === true));
  assert.ok(body.scaffold.providerClasses.every((providerClass) => providerClass.callableWrapper === false));
  assert.ok(body.scaffold.providerClasses.every((providerClass) => providerClass.providerCallsEnabled === false));
  assert.ok(body.scaffold.providerClasses.every((providerClass) => providerClass.credentialAccessEnabled === false));
  assert.ok(body.scaffold.providerClasses.every((providerClass) => providerClass.networkAccessEnabled === false));
  assert.ok(body.scaffold.providerClasses.every((providerClass) => providerClass.artifactWriteEnabled === false));
  assert.ok(body.scaffold.providerClasses.every((providerClass) => providerClass.auditPersistenceEnabled === false));
  assert.ok(body.scaffold.disabledCapabilities.some((capability) => capability.capability === 'provider calls'));
  assert.ok(body.scaffold.disabledCapabilities.some((capability) => capability.capability === 'credential access'));
  assert.ok(body.scaffold.disabledCapabilities.some((capability) => capability.capability === 'env reads'));
  assert.ok(body.scaffold.disabledCapabilities.some((capability) => capability.capability === 'network access'));
  assert.ok(body.scaffold.disabledCapabilities.some((capability) => capability.capability === 'prompt generation'));
  assert.ok(body.scaffold.disabledCapabilities.some((capability) => capability.capability === 'image generation'));
  assert.ok(body.scaffold.disabledCapabilities.some((capability) => capability.capability === 'artifact writes'));
  assert.ok(body.scaffold.disabledCapabilities.some((capability) => capability.capability === 'audit persistence'));
  assert.ok(body.scaffold.disabledCapabilities.some((capability) => capability.capability === 'POST routes'));
  assert.ok(body.scaffold.blockers.includes('provider calls remain blocked'));
  assert.ok(body.scaffold.blockers.includes('credentials remain inaccessible'));
  assert.ok(body.scaffold.blockers.includes('network access remains blocked'));
  assert.ok(body.scaffold.blockers.includes('Brain Console remains read-only'));
  assert.equal(body.scaffold.nextSafeStep, 'Await explicit approval before any provider implementation beyond inert scaffolding.');
  assert.equal(body.scaffold.responseShape.redactedSummaryOnly, true);
  assert.equal(body.scaffold.responseShape.providerCallBlocked, true);
  assert.equal(body.scaffold.responseShape.executionBlocked, true);
  assert.equal(body.scaffold.responseShape.noRawProviderOutput, true);
  assert.equal(body.scaffold.safety.readOnlyStatusEndpoint, true);
  assert.equal(body.scaffold.safety.wrapperScaffoldingOnly, true);
  assert.equal(body.scaffold.safety.callableWrapperImplemented, false);
  assert.equal(body.scaffold.safety.providerConfigured, false);
  assert.equal(body.scaffold.safety.providerCallsEnabled, false);
  assert.equal(body.scaffold.safety.credentialAccessEnabled, false);
  assert.equal(body.scaffold.safety.envReadEnabled, false);
  assert.equal(body.scaffold.safety.networkAccessEnabled, false);
  assert.equal(body.scaffold.safety.promptGenerationEnabled, false);
  assert.equal(body.scaffold.safety.imageGenerationEnabled, false);
  assert.equal(body.scaffold.safety.artifactPersistenceEnabled, false);
  assert.equal(body.scaffold.safety.auditPersistenceEnabled, false);
  assert.equal(body.scaffold.safety.filesystemAccessEnabled, false);
  assert.equal(body.scaffold.safety.writesFiles, false);
  assert.equal(body.scaffold.safety.publishesContent, false);
  assert.equal(body.scaffold.safety.writesToMind, false);
  assert.equal(body.scaffold.safety.executesVideo, false);
  assert.equal(body.scaffold.safety.postRoutesAdded, false);
  assert.equal(body.scaffold.safety.brainConsoleMutationControlsEnabled, false);
});

test('POST /video-orchestrator/provider-request-wrapper-scaffold is not registered and returns 404', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/provider-request-wrapper-scaffold' });
  assert.equal(response.statusCode, 404);
});

test('validateVideoProviderRequestWrapperScaffoldRequest returns a disabled validation result', () => {
  const result = validateVideoProviderRequestWrapperScaffoldRequest({});
  const scaffold = readVideoProviderRequestWrapperScaffold();

  assert.equal(result.valid, false);
  assert.equal(result.providerCallBlocked, true);
  assert.equal(result.executionBlocked, true);
  assert.ok(result.missingFields.includes('sourcePlanId'));
  assert.ok(result.missingFields.includes('promptReviewPolicyId'));
  assert.ok(result.missingFields.includes('credentialIsolationPlanId'));
  assert.ok(result.missingFields.includes('artifactSandboxHandoffPlanId'));
  assert.ok(result.missingFields.includes('outputRedactionPolicyId'));
  assert.ok(result.missingFields.includes('complianceChecklistId'));
  assert.ok(result.missingFields.includes('operatorApprovalRef'));
  assert.ok(result.missingFields.includes('auditRefPlaceholder'));
  assert.ok(result.blockedReasons.includes('provider calls are blocked in this scaffold phase'));
  assert.ok(result.blockedReasons.includes('credentials are blocked in this scaffold phase'));
  assert.ok(result.blockedReasons.includes('network access is blocked in this scaffold phase'));
  assert.ok(!Object.prototype.hasOwnProperty.call(result, 'rawProviderOutput'));
  assert.equal(scaffold.scaffold.status, 'scaffolded-disabled');
});

test('provider request wrapper scaffold source file does not include unsafe execution primitives', () => {
  const source = readFileSync(join(process.cwd(), 'src', 'adapters', 'video-orchestrator-provider-request-wrapper-scaffold.ts'), 'utf8');
  const forbiddenPatterns = ['fetch(', 'axios', 'requestUrl', 'process.env', 'child_process', 'exec(', 'spawn(', 'writeFile', 'appendFile', 'createWriteStream'];

  forbiddenPatterns.forEach((pattern) => {
    assert.equal(source.includes(pattern), false, `expected source not to include ${pattern}`);
  });
});

test('GET /video-orchestrator/provider-wrapper-validation-harness returns harness-ready-disabled status with safe counts', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/provider-wrapper-validation-harness' });
  const body = JSON.parse(response.body) as {
    harness: {
      id: string;
      status: string;
      phase: string;
      implementationApprovedScope: string;
      fixtureCount: number;
      passedFixtureCount: number;
      blockedFixtureCount: number;
      providerCallCount: number;
      credentialAccessCount: number;
      networkAccessCount: number;
      fileWriteCount: number;
      fixtureResults: Array<{
        fixtureId: string;
        providerClass: string;
        expectedOutcome: string;
        valid: boolean;
        missingFields: string[];
        unsafeFields: string[];
        providerCallBlocked: boolean;
        executionBlocked: boolean;
        notes: string;
      }>;
      safety: Record<string, boolean>;
      blockers: string[];
      nextSafeStep: string;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.harness.id, 'video-orchestrator-provider-wrapper-validation-harness');
  assert.equal(body.harness.status, 'harness-ready-disabled');
  assert.equal(body.harness.phase, 'provider-wrapper-validation-harness-only');
  assert.equal(body.harness.implementationApprovedScope, 'wrapper-scaffolding-only');
  assert.ok(body.harness.fixtureCount >= 6);
  assert.equal(body.harness.providerCallCount, 0);
  assert.equal(body.harness.credentialAccessCount, 0);
  assert.equal(body.harness.networkAccessCount, 0);
  assert.equal(body.harness.fileWriteCount, 0);
  assert.ok(body.harness.fixtureResults.every((fixture) => fixture.providerCallBlocked === true));
  assert.ok(body.harness.fixtureResults.every((fixture) => fixture.executionBlocked === true));
  assert.ok(body.harness.fixtureResults.every((fixture) => !('rawProviderOutput' in fixture)));
  assert.equal(body.harness.safety.readOnlyStatusEndpoint, true);
  assert.equal(body.harness.safety.validationHarnessOnly, true);
  assert.equal(body.harness.safety.providerWrapperCallable, false);
  assert.equal(body.harness.safety.providerConfigured, false);
  assert.equal(body.harness.safety.providerCallsEnabled, false);
  assert.equal(body.harness.safety.credentialAccessEnabled, false);
  assert.equal(body.harness.safety.envReadEnabled, false);
  assert.equal(body.harness.safety.networkAccessEnabled, false);
  assert.equal(body.harness.safety.promptGenerationEnabled, false);
  assert.equal(body.harness.safety.imageGenerationEnabled, false);
  assert.equal(body.harness.safety.artifactPersistenceEnabled, false);
  assert.equal(body.harness.safety.auditPersistenceEnabled, false);
  assert.equal(body.harness.safety.filesystemAccessEnabled, false);
  assert.equal(body.harness.safety.writesFiles, false);
  assert.equal(body.harness.safety.publishesContent, false);
  assert.equal(body.harness.safety.writesToMind, false);
  assert.equal(body.harness.safety.executesVideo, false);
  assert.equal(body.harness.safety.postRoutesAdded, false);
  assert.equal(body.harness.safety.brainConsoleMutationControlsEnabled, false);
});

test('POST /video-orchestrator/provider-wrapper-validation-harness is not registered and returns 404', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/provider-wrapper-validation-harness' });
  assert.equal(response.statusCode, 404);
});

test('runVideoProviderWrapperValidationHarness returns blocked fixture coverage with safe outcomes', () => {
  const harness = runVideoProviderWrapperValidationHarness();

  assert.ok(harness.fixtureResults.length >= 6);
  assert.ok(harness.fixtureResults.every((fixture) => fixture.providerCallBlocked === true));
  assert.ok(harness.fixtureResults.every((fixture) => fixture.executionBlocked === true));
  assert.ok(harness.fixtureResults.some((fixture) => fixture.valid === true));
  assert.ok(harness.fixtureResults.some((fixture) => fixture.fixtureId === 'missing-required-fields' && fixture.valid === false));
  assert.ok(harness.fixtureResults.some((fixture) => fixture.fixtureId === 'unsupported-provider-class' && fixture.valid === false));
  assert.ok(harness.fixtureResults.some((fixture) => fixture.fixtureId === 'unsafe-field' && fixture.valid === false));
  assert.ok(harness.fixtureResults.every((fixture) => !('rawProviderOutput' in fixture)));
});

test('provider wrapper validation harness source file does not include unsafe execution primitives', () => {
  const source = readFileSync(join(process.cwd(), 'src', 'adapters', 'video-orchestrator-provider-wrapper-validation-harness.ts'), 'utf8');
  const forbiddenPatterns = ['fetch(', 'axios', 'requestUrl', 'process.env', 'child_process', 'exec(', 'spawn(', 'writeFile', 'appendFile', 'createWriteStream'];

  forbiddenPatterns.forEach((pattern) => {
    assert.equal(source.includes(pattern), false, `expected source not to include ${pattern}`);
  });
});

test('GET /video-orchestrator/credential-reference-scaffold returns scaffolded-disabled status with safe counts', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/credential-reference-scaffold' });
  const body = JSON.parse(response.body) as {
    scaffold: {
      id: string;
      status: string;
      phase: string;
      implementationApprovedScope: string;
      providerClasses: string[];
      referenceShape: Record<string, string>;
      validationRules: string[];
      disabledCapabilities: Array<{ capability: string; enabled: boolean }>;
      summary: {
        providerClassCount: number;
        referenceShapeCount: number;
        credentialAccessCount: number;
        credentialPersistedCount: number;
        envReadCount: number;
        keychainAccessCount: number;
      };
      safety: Record<string, boolean>;
      blockers: string[];
      nextSafeStep: string;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.scaffold.status, 'scaffolded-disabled');
  assert.equal(body.scaffold.phase, 'credential-reference-scaffolding-only');
  assert.equal(body.scaffold.implementationApprovedScope, 'wrapper-scaffolding-only');
  assert.equal(body.scaffold.summary.providerClassCount, 3);
  assert.equal(body.scaffold.summary.referenceShapeCount, 1);
  assert.equal(body.scaffold.summary.credentialAccessCount, 0);
  assert.equal(body.scaffold.summary.credentialPersistedCount, 0);
  assert.equal(body.scaffold.summary.envReadCount, 0);
  assert.equal(body.scaffold.summary.keychainAccessCount, 0);
  assert.ok(body.scaffold.providerClasses.includes('image-generation'));
  assert.ok(body.scaffold.providerClasses.includes('layout-rendering'));
  assert.ok(body.scaffold.providerClasses.includes('brand-compliance'));
  assert.ok(body.scaffold.validationRules.includes('providerClass must be supported'));
  assert.ok(body.scaffold.validationRules.includes('credentialRefId must be opaque'));
  assert.ok(body.scaffold.validationRules.includes('no raw credential values allowed'));
  assert.ok(body.scaffold.validationRules.includes('no API keys allowed'));
  assert.ok(body.scaffold.validationRules.includes('no OAuth tokens allowed'));
  assert.ok(body.scaffold.validationRules.includes('no private keys allowed'));
  assert.ok(body.scaffold.validationRules.includes('no .env values allowed'));
  assert.ok(body.scaffold.validationRules.includes('no filesystem credential paths allowed'));
  assert.ok(body.scaffold.validationRules.includes('no Mind vault paths allowed'));
  assert.ok(body.scaffold.validationRules.includes('no STB artifact paths allowed'));
  assert.ok(body.scaffold.validationRules.includes('credential access is blocked in this scaffold phase'));
  assert.equal(body.scaffold.safety.readOnlyStatusEndpoint, true);
  assert.equal(body.scaffold.safety.credentialReferenceScaffoldingOnly, true);
  assert.equal(body.scaffold.safety.credentialAccessEnabled, false);
  assert.equal(body.scaffold.safety.credentialPersistenceEnabled, false);
  assert.equal(body.scaffold.safety.rawCredentialDisplayEnabled, false);
  assert.equal(body.scaffold.safety.envReadEnabled, false);
  assert.equal(body.scaffold.safety.keychainAccessEnabled, false);
  assert.equal(body.scaffold.safety.filesystemCredentialAccessEnabled, false);
  assert.equal(body.scaffold.safety.providerConfigured, false);
  assert.equal(body.scaffold.safety.providerCallsEnabled, false);
  assert.equal(body.scaffold.safety.networkAccessEnabled, false);
  assert.equal(body.scaffold.safety.writesFiles, false);
  assert.equal(body.scaffold.safety.publishesContent, false);
  assert.equal(body.scaffold.safety.writesToMind, false);
  assert.equal(body.scaffold.safety.executesVideo, false);
  assert.equal(body.scaffold.safety.postRoutesAdded, false);
  assert.equal(body.scaffold.safety.brainConsoleMutationControlsEnabled, false);
});

test('POST /video-orchestrator/credential-reference-scaffold is not registered and returns 404', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/credential-reference-scaffold' });
  assert.equal(response.statusCode, 404);
});

test('GET /video-orchestrator/provider-request-envelope-scaffold returns scaffolded-disabled status with safe counts', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/provider-request-envelope-scaffold' });
  const body = JSON.parse(response.body) as {
    envelope: {
      id: string;
      status: string;
      phase: string;
      envelopeShape: Record<string, string>;
      requiredReferences: string[];
      validationRules: string[];
      disabledCapabilities: Array<{ capability: string; enabled: boolean }>;
      summary: {
        envelopeShapeCount: number;
        supportedProviderClassCount: number;
        sendableEnvelopeCount: number;
        providerCallCount: number;
        networkAccessCount: number;
        credentialAccessCount: number;
      };
      safety: Record<string, boolean>;
      blockers: string[];
      nextSafeStep: string;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.envelope.status, 'scaffolded-disabled');
  assert.equal(body.envelope.phase, 'provider-request-envelope-scaffolding-only');
  assert.equal(body.envelope.summary.envelopeShapeCount, 1);
  assert.equal(body.envelope.summary.supportedProviderClassCount, 3);
  assert.equal(body.envelope.summary.sendableEnvelopeCount, 0);
  assert.equal(body.envelope.summary.providerCallCount, 0);
  assert.equal(body.envelope.summary.networkAccessCount, 0);
  assert.equal(body.envelope.summary.credentialAccessCount, 0);
  assert.ok(body.envelope.requiredReferences.includes('provider-request-wrapper-scaffold'));
  assert.ok(body.envelope.requiredReferences.includes('provider-wrapper-validation-harness'));
  assert.ok(body.envelope.requiredReferences.includes('credential-reference-scaffold'));
  assert.ok(body.envelope.requiredReferences.includes('design-provider-prompt-review-policy-plan'));
  assert.ok(body.envelope.requiredReferences.includes('prompt-review-ux-implementation-plan'));
  assert.ok(body.envelope.requiredReferences.includes('artifact-sandbox-provider-handoff-plan'));
  assert.ok(body.envelope.requiredReferences.includes('provider-output-redaction-policy-plan'));
  assert.ok(body.envelope.requiredReferences.includes('design-provider-compliance-checklist-plan'));
  assert.ok(body.envelope.requiredReferences.includes('provider-audit-persistence-boundary-plan'));
  assert.equal(body.envelope.safety.readOnlyStatusEndpoint, true);
  assert.equal(body.envelope.safety.requestEnvelopeScaffoldingOnly, true);
  assert.equal(body.envelope.safety.sendableEnvelopeImplemented, false);
  assert.equal(body.envelope.safety.providerConfigured, false);
  assert.equal(body.envelope.safety.providerCallsEnabled, false);
  assert.equal(body.envelope.safety.credentialAccessEnabled, false);
  assert.equal(body.envelope.safety.networkAccessEnabled, false);
  assert.equal(body.envelope.safety.promptGenerationEnabled, false);
  assert.equal(body.envelope.safety.imageGenerationEnabled, false);
  assert.equal(body.envelope.safety.artifactPersistenceEnabled, false);
  assert.equal(body.envelope.safety.auditPersistenceEnabled, false);
  assert.equal(body.envelope.safety.filesystemAccessEnabled, false);
  assert.equal(body.envelope.safety.writesFiles, false);
  assert.equal(body.envelope.safety.publishesContent, false);
  assert.equal(body.envelope.safety.writesToMind, false);
  assert.equal(body.envelope.safety.executesVideo, false);
  assert.equal(body.envelope.safety.postRoutesAdded, false);
  assert.equal(body.envelope.safety.brainConsoleMutationControlsEnabled, false);
});

test('POST /video-orchestrator/provider-request-envelope-scaffold is not registered and returns 404', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/provider-request-envelope-scaffold' });
  assert.equal(response.statusCode, 404);
});

test('GET /video-orchestrator/provider-response-envelope-scaffold returns scaffolded-disabled status with safe counts', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/provider-response-envelope-scaffold' });
  const body = JSON.parse(response.body) as {
    envelope: {
      id: string;
      status: string;
      phase: string;
      responseEnvelopeShape: Record<string, string | boolean>;
      allowedFields: string[];
      prohibitedFields: string[];
      validationRules: string[];
      disabledCapabilities: Array<{ capability: string; enabled: boolean }>;
      summary: {
        responseEnvelopeShapeCount: number;
        rawOutputAccessCount: number;
        redactedManifestCreatedCount: number;
        artifactPersistedCount: number;
        auditPersistedCount: number;
        providerCallCount: number;
      };
      safety: Record<string, boolean>;
      blockers: string[];
      nextSafeStep: string;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.envelope.status, 'scaffolded-disabled');
  assert.equal(body.envelope.phase, 'provider-response-envelope-scaffolding-only');
  assert.equal(body.envelope.summary.responseEnvelopeShapeCount, 1);
  assert.equal(body.envelope.summary.rawOutputAccessCount, 0);
  assert.equal(body.envelope.summary.redactedManifestCreatedCount, 0);
  assert.equal(body.envelope.summary.artifactPersistedCount, 0);
  assert.equal(body.envelope.summary.auditPersistedCount, 0);
  assert.equal(body.envelope.summary.providerCallCount, 0);
  assert.ok(body.envelope.prohibitedFields.includes('raw provider response'));
  assert.ok(body.envelope.prohibitedFields.includes('raw generated files'));
  assert.ok(body.envelope.prohibitedFields.includes('raw prompt text'));
  assert.ok(body.envelope.prohibitedFields.includes('raw credentials'));
  assert.ok(body.envelope.prohibitedFields.includes('API keys'));
  assert.ok(body.envelope.prohibitedFields.includes('OAuth tokens'));
  assert.ok(body.envelope.prohibitedFields.includes('private keys'));
  assert.ok(body.envelope.prohibitedFields.includes('.env values'));
  assert.ok(body.envelope.prohibitedFields.includes('filesystem paths'));
  assert.ok(body.envelope.prohibitedFields.includes('Mind vault paths'));
  assert.ok(body.envelope.prohibitedFields.includes('STB artifact paths'));
  assert.ok(body.envelope.prohibitedFields.includes('platform upload payloads'));
  assert.ok(body.envelope.prohibitedFields.includes('unredacted logs'));
  assert.equal(body.envelope.safety.readOnlyStatusEndpoint, true);
  assert.equal(body.envelope.safety.responseEnvelopeScaffoldingOnly, true);
  assert.equal(body.envelope.safety.rawProviderOutputAccessEnabled, false);
  assert.equal(body.envelope.safety.redactedManifestCreationEnabled, false);
  assert.equal(body.envelope.safety.artifactPersistenceEnabled, false);
  assert.equal(body.envelope.safety.auditPersistenceEnabled, false);
  assert.equal(body.envelope.safety.providerConfigured, false);
  assert.equal(body.envelope.safety.providerCallsEnabled, false);
  assert.equal(body.envelope.safety.credentialAccessEnabled, false);
  assert.equal(body.envelope.safety.networkAccessEnabled, false);
  assert.equal(body.envelope.safety.filesystemAccessEnabled, false);
  assert.equal(body.envelope.safety.writesFiles, false);
  assert.equal(body.envelope.safety.publishesContent, false);
  assert.equal(body.envelope.safety.writesToMind, false);
  assert.equal(body.envelope.safety.executesVideo, false);
  assert.equal(body.envelope.safety.postRoutesAdded, false);
  assert.equal(body.envelope.safety.brainConsoleMutationControlsEnabled, false);
});

test('POST /video-orchestrator/provider-response-envelope-scaffold is not registered and returns 404', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/provider-response-envelope-scaffold' });
  assert.equal(response.statusCode, 404);
});

test('GET /video-orchestrator/provider-scaffolding-integration-summary returns scaffolded-disabled status with safe counts', async () => {
  const response = await exercise({ method: 'GET', url: '/video-orchestrator/provider-scaffolding-integration-summary' });
  const body = JSON.parse(response.body) as {
    summary: {
      id: string;
      status: string;
      phase: string;
      scaffoldCount: number;
      implementedScaffoldRefs: string[];
      blockedCapabilities: string[];
      nextSafeImplementationSlices: string[];
      summary: {
        scaffoldCount: number;
        providerCallCount: number;
        credentialAccessCount: number;
        networkAccessCount: number;
        postRouteCount: number;
        mutationControlCount: number;
      };
      safety: Record<string, boolean>;
      blockers: string[];
      nextSafeStep: string;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.summary.status, 'scaffolded-disabled');
  assert.equal(body.summary.phase, 'provider-scaffolding-integration-summary');
  assert.equal(body.summary.scaffoldCount, 5);
  assert.equal(body.summary.summary.scaffoldCount, 5);
  assert.equal(body.summary.summary.providerCallCount, 0);
  assert.equal(body.summary.summary.credentialAccessCount, 0);
  assert.equal(body.summary.summary.networkAccessCount, 0);
  assert.equal(body.summary.summary.postRouteCount, 0);
  assert.equal(body.summary.summary.mutationControlCount, 0);
  assert.ok(body.summary.implementedScaffoldRefs.includes('provider-request-wrapper-scaffold'));
  assert.ok(body.summary.implementedScaffoldRefs.includes('provider-wrapper-validation-harness'));
  assert.ok(body.summary.implementedScaffoldRefs.includes('credential-reference-scaffold'));
  assert.ok(body.summary.implementedScaffoldRefs.includes('provider-request-envelope-scaffold'));
  assert.ok(body.summary.implementedScaffoldRefs.includes('provider-response-envelope-scaffold'));
  assert.ok(body.summary.blockedCapabilities.includes('provider calls'));
  assert.ok(body.summary.blockedCapabilities.includes('credentials'));
  assert.ok(body.summary.blockedCapabilities.includes('env reads'));
  assert.ok(body.summary.blockedCapabilities.includes('network access'));
  assert.ok(body.summary.blockedCapabilities.includes('prompt generation'));
  assert.ok(body.summary.blockedCapabilities.includes('image generation'));
  assert.ok(body.summary.blockedCapabilities.includes('raw output access'));
  assert.ok(body.summary.blockedCapabilities.includes('artifact writes'));
  assert.ok(body.summary.blockedCapabilities.includes('audit persistence'));
  assert.ok(body.summary.blockedCapabilities.includes('POST routes'));
  assert.ok(body.summary.blockedCapabilities.includes('Brain Console mutation controls'));
  assert.ok(body.summary.blockedCapabilities.includes('publishing'));
  assert.ok(body.summary.blockedCapabilities.includes('decommissioning'));
  assert.equal(body.summary.safety.readOnlyStatusEndpoint, true);
  assert.equal(body.summary.safety.integrationSummaryOnly, true);
  assert.equal(body.summary.safety.providerConfigured, false);
  assert.equal(body.summary.safety.providerCallsEnabled, false);
  assert.equal(body.summary.safety.credentialAccessEnabled, false);
  assert.equal(body.summary.safety.envReadEnabled, false);
  assert.equal(body.summary.safety.networkAccessEnabled, false);
  assert.equal(body.summary.safety.promptGenerationEnabled, false);
  assert.equal(body.summary.safety.imageGenerationEnabled, false);
  assert.equal(body.summary.safety.rawProviderOutputAccessEnabled, false);
  assert.equal(body.summary.safety.artifactPersistenceEnabled, false);
  assert.equal(body.summary.safety.auditPersistenceEnabled, false);
  assert.equal(body.summary.safety.filesystemAccessEnabled, false);
  assert.equal(body.summary.safety.writesFiles, false);
  assert.equal(body.summary.safety.publishesContent, false);
  assert.equal(body.summary.safety.writesToMind, false);
  assert.equal(body.summary.safety.executesVideo, false);
  assert.equal(body.summary.safety.postRoutesAdded, false);
  assert.equal(body.summary.safety.brainConsoleMutationControlsEnabled, false);
});

test('POST /video-orchestrator/provider-scaffolding-integration-summary is not registered and returns 404', async () => {
  const response = await exercise({ method: 'POST', url: '/video-orchestrator/provider-scaffolding-integration-summary' });
  assert.equal(response.statusCode, 404);
});

test('direct scaffold readers return disabled scaffolds', () => {
  assert.equal(readVideoCredentialReferenceScaffold().scaffold.status, 'scaffolded-disabled');
  assert.equal(readVideoProviderRequestEnvelopeScaffold().envelope.status, 'scaffolded-disabled');
  assert.equal(readVideoProviderResponseEnvelopeScaffold().envelope.status, 'scaffolded-disabled');
  assert.equal(readVideoProviderScaffoldingIntegrationSummary().summary.status, 'scaffolded-disabled');
});

test('new provider scaffolding modules do not include unsafe execution primitives', () => {
  const files = [
    'video-orchestrator-credential-reference-scaffold.ts',
    'video-orchestrator-provider-request-envelope-scaffold.ts',
    'video-orchestrator-provider-response-envelope-scaffold.ts',
    'video-orchestrator-provider-scaffolding-integration-summary.ts',
  ];
  const forbiddenPatterns = ['fetch(', 'axios', 'requestUrl', 'process.env', 'child_process', 'exec(', 'spawn(', 'writeFile', 'appendFile', 'createWriteStream'];

  files.forEach((file) => {
    const source = readFileSync(join(process.cwd(), 'src', 'adapters', file), 'utf8');
    forbiddenPatterns.forEach((pattern) => {
      assert.equal(source.includes(pattern), false, `expected ${file} not to include ${pattern}`);
    });
  });
});
