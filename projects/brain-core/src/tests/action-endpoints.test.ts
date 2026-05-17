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

test('GET /actions returns list of all actions', async () => {
  const response = await exercise({ method: 'GET', url: '/actions' });
  const body = JSON.parse(response.body) as {
    actions: Array<{
      id: string;
      kind: string;
      label: string;
      status: string;
      risk: string;
      canExecuteNow: boolean;
      safety: object;
    }>;
  };

  assert.equal(response.statusCode, 200);
  assert.ok(Array.isArray(body.actions));
  assert.ok(body.actions.length > 0);

  const modelRouterAction = body.actions.find((a) => a.id === 'model-router-dry-run');
  assert.ok(modelRouterAction, 'model-router-dry-run action should exist');
});

test('GET /actions - every action has canExecuteNow false', async () => {
  const response = await exercise({ method: 'GET', url: '/actions' });
  const body = JSON.parse(response.body) as {
    actions: Array<{ id: string; canExecuteNow: boolean }>;
  };

  body.actions.forEach((action) => {
    assert.equal(action.canExecuteNow, false, `${action.id} should have canExecuteNow: false`);
  });
});

test('GET /actions - every action has safety object', async () => {
  const response = await exercise({ method: 'GET', url: '/actions' });
  const body = JSON.parse(response.body) as {
    actions: Array<{
      id: string;
      safety: {
        writesToMind: boolean;
        executesShell: boolean;
        mutatesRuntime: boolean;
        touchesStb: boolean;
        touchesVideo: boolean;
        requiresHumanReview: boolean;
      };
    }>;
  };

  body.actions.forEach((action) => {
    assert.ok(action.safety, `${action.id} should have safety object`);
    assert.equal(typeof action.safety.writesToMind, 'boolean');
    assert.equal(typeof action.safety.executesShell, 'boolean');
    assert.equal(typeof action.safety.mutatesRuntime, 'boolean');
    assert.equal(typeof action.safety.touchesStb, 'boolean');
    assert.equal(typeof action.safety.touchesVideo, 'boolean');
    assert.equal(typeof action.safety.requiresHumanReview, 'boolean');
  });
});

test('GET /actions - no action has writesToMind true', async () => {
  const response = await exercise({ method: 'GET', url: '/actions' });
  const body = JSON.parse(response.body) as {
    actions: Array<{
      id: string;
      safety: { writesToMind: boolean };
    }>;
  };

  body.actions.forEach((action) => {
    assert.equal(
      action.safety.writesToMind,
      false,
      `${action.id} should have writesToMind: false in this slice`,
    );
  });
});

test('GET /actions - no action has executesShell true except safe ones', async () => {
  const response = await exercise({ method: 'GET', url: '/actions' });
  const body = JSON.parse(response.body) as {
    actions: Array<{
      id: string;
      safety: { executesShell: boolean };
      status: string;
      kind: string;
    }>;
  };

  body.actions.forEach((action) => {
    if (action.kind === 'model-router-dry-run') {
      assert.equal(action.safety.executesShell, true, 'model-router-dry-run should have executesShell');
    } else if (
      action.kind === 'stb-status-refresh' ||
      action.kind === 'video-status-refresh' ||
      action.kind === 'stb-video-migration-review' ||
      action.kind === 'agent-readiness-review'
    ) {
      assert.equal(action.safety.executesShell, false, `${action.id} is read-only, should not execute shell`);
    }
  });
});

test('GET /actions/:id returns model-router-dry-run action', async () => {
  const response = await exercise({ method: 'GET', url: '/actions/model-router-dry-run' });
  const body = JSON.parse(response.body) as {
    action: {
      id: string;
      kind: string;
      label: string;
      status: string;
      canRequestApproval: boolean;
      canExecuteNow: boolean;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.action.id, 'model-router-dry-run');
  assert.equal(body.action.status, 'approval-required');
  assert.equal(body.action.canRequestApproval, true);
  assert.equal(body.action.canExecuteNow, false);
});

test('GET /actions/:id returns mind-write-apply action as blocked', async () => {
  const response = await exercise({ method: 'GET', url: '/actions/mind-write-apply' });
  const body = JSON.parse(response.body) as {
    action: {
      id: string;
      status: string;
      canRequestApproval: boolean;
      canExecuteNow: boolean;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.action.id, 'mind-write-apply');
  assert.equal(body.action.status, 'blocked');
  assert.equal(body.action.canRequestApproval, false);
  assert.equal(body.action.canExecuteNow, false);
});

test('GET /actions/:id returns not found for unknown action', async () => {
  const response = await exercise({ method: 'GET', url: '/actions/nonexistent' });
  const body = JSON.parse(response.body) as { error: { code: string } };

  assert.equal(response.statusCode, 404);
  assert.equal(body.error.code, 'not_found');
});

test('POST /actions/model-router-dry-run/request-approval returns action request', async () => {
  const response = await exercise({ method: 'POST', url: '/actions/model-router-dry-run/request-approval' });
  const body = JSON.parse(response.body) as {
    actionId: string;
    status: string;
    executionDidRun: boolean;
    safety: object;
  };

  assert.ok([200, 202, 400].includes(response.statusCode), `Unexpected status: ${response.statusCode}`);
  assert.equal(body.actionId, 'model-router-dry-run');
  assert.equal(body.executionDidRun, false);
  assert.ok(body.safety, 'Should have safety object');
});

test('POST /actions/mind-write-apply/request-approval returns blocked', async () => {
  const response = await exercise({ method: 'POST', url: '/actions/mind-write-apply/request-approval' });
  const body = JSON.parse(response.body) as {
    actionId: string;
    status: string;
    executionDidRun: boolean;
  };

  assert.equal(response.statusCode, 400);
  assert.equal(body.actionId, 'mind-write-apply');
  assert.equal(body.status, 'blocked');
  assert.equal(body.executionDidRun, false);
});

test('POST /actions/local-app-start/request-approval returns blocked (planned)', async () => {
  const response = await exercise({ method: 'POST', url: '/actions/local-app-start/request-approval' });
  const body = JSON.parse(response.body) as {
    actionId: string;
    status: string;
  };

  assert.equal(response.statusCode, 400);
  assert.equal(body.actionId, 'local-app-start');
  assert.equal(body.status, 'blocked');
});

test('POST /actions/orchestrator-run/request-approval returns blocked', async () => {
  const response = await exercise({ method: 'POST', url: '/actions/orchestrator-run/request-approval' });
  const body = JSON.parse(response.body) as {
    actionId: string;
    status: string;
  };

  assert.equal(response.statusCode, 400);
  assert.equal(body.actionId, 'orchestrator-run');
  assert.equal(body.status, 'blocked');
});

test('POST /actions/nonexistent/request-approval returns invalid', async () => {
  const response = await exercise({ method: 'POST', url: '/actions/nonexistent/request-approval' });
  const body = JSON.parse(response.body) as {
    status: string;
  };

  assert.equal(response.statusCode, 400);
  assert.equal(body.status, 'invalid');
});

test('Requestable actions cannot request if status is blocked/planned', async () => {
  const response = await exercise({ method: 'GET', url: '/actions' });
  const body = JSON.parse(response.body) as {
    actions: Array<{
      id: string;
      status: string;
      canRequestApproval: boolean;
    }>;
  };

  body.actions.forEach((action) => {
    if (action.status === 'blocked' || action.status === 'planned') {
      assert.equal(action.canRequestApproval, false, `${action.id} is ${action.status}, should not be requestable`);
    }
  });
});

test('No action response has executionDidRun true', async () => {
  const actions = ['model-router-dry-run', 'mind-write-apply', 'local-app-start'];

  for (const actionId of actions) {
    const response = await exercise({ method: 'POST', url: `/actions/${actionId}/request-approval` });
    const body = JSON.parse(response.body) as { executionDidRun: boolean };

    assert.equal(
      body.executionDidRun,
      false,
      `POST /actions/${actionId}/request-approval should have executionDidRun: false`,
    );
  }
});

test('All blocked/planned actions have correct status', async () => {
  const blockedActions = [
    'local-app-start',
    'local-app-stop',
    'local-app-restart',
    'orchestrator-run',
    'pipeline-dry-run',
    'mind-write-apply',
  ];

  for (const actionId of blockedActions) {
    const response = await exercise({ method: 'GET', url: `/actions/${actionId}` });
    const body = JSON.parse(response.body) as {
      action: {
        status: string;
        canExecuteNow: boolean;
      };
    };

    assert.equal(
      body.action.status === 'blocked' || body.action.status === 'planned',
      true,
      `${actionId} should be blocked or planned`,
    );
    assert.equal(body.action.canExecuteNow, false, `${actionId} should have canExecuteNow: false`);
  }
});

test('GET /actions/stb-status-refresh is read-only available', async () => {
  const response = await exercise({ method: 'GET', url: '/actions/stb-status-refresh' });
  const body = JSON.parse(response.body) as {
    action: {
      id: string;
      status: string;
      canRequestApproval: boolean;
      requiresApproval: boolean;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.action.status, 'available');
  assert.equal(body.action.requiresApproval, false);
  assert.equal(body.action.canRequestApproval, false);
});

test('GET /actions/video-status-refresh is read-only available', async () => {
  const response = await exercise({ method: 'GET', url: '/actions/video-status-refresh' });
  const body = JSON.parse(response.body) as {
    action: {
      id: string;
      status: string;
      requiresApproval: boolean;
    };
  };

  assert.equal(response.statusCode, 200);
  assert.equal(body.action.status, 'available');
  assert.equal(body.action.requiresApproval, false);
});

test('GET /actions/model-router-dry-run includes readiness status', async () => {
  const response = await exercise({ method: 'GET', url: '/actions/model-router-dry-run' });
  const body = JSON.parse(response.body) as {
    action: {
      id: string;
      readiness?: {
        status: string;
        blockers: string[];
        executionWillWriteToMind: boolean;
        executionWillApplyChanges: boolean;
        executionKind: string;
      };
    };
  };

  assert.equal(response.statusCode, 200);
  assert.ok(body.action.readiness, 'model-router-dry-run should have readiness field');
  assert.ok(['ready', 'blocked'].includes(body.action.readiness!.status), 'readiness status should be ready or blocked');
  assert.ok(Array.isArray(body.action.readiness!.blockers), 'blockers should be an array');
  assert.equal(body.action.readiness!.executionWillWriteToMind, false, 'should never write to mind');
  assert.equal(body.action.readiness!.executionWillApplyChanges, false, 'should never apply changes');
  assert.equal(body.action.readiness!.executionKind, 'report-only', 'execution kind should be report-only');
});

test('GET /actions returns all actions with readiness for model-router-dry-run', async () => {
  const response = await exercise({ method: 'GET', url: '/actions' });
  const body = JSON.parse(response.body) as {
    actions: Array<{
      id: string;
      readiness?: object;
    }>;
  };

  assert.equal(response.statusCode, 200);

  const modelRouterAction = body.actions.find((a) => a.id === 'model-router-dry-run');
  assert.ok(modelRouterAction, 'model-router-dry-run action should exist');
  assert.ok(modelRouterAction!.readiness, 'model-router-dry-run should have readiness in list response');
});

test('GET /actions/model-router-dry-run readiness respects execution flag', async () => {
  const flagName = 'BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION';
  const originalValue = process.env[flagName];

  try {
    // Test with flag disabled (default)
    delete process.env[flagName];
    let response = await exercise({ method: 'GET', url: '/actions/model-router-dry-run' });
    let body = JSON.parse(response.body) as {
      action: { readiness?: { status: string; blockers: string[] } };
    };

    assert.equal(body.action.readiness!.status, 'blocked', 'should be blocked without execution flag');
    assert.ok(
      body.action.readiness!.blockers.some((b) => b.includes('BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION')),
      'should include flag name in blockers',
    );

    // Test with flag enabled
    process.env[flagName] = 'true';
    response = await exercise({ method: 'GET', url: '/actions/model-router-dry-run' });
    body = JSON.parse(response.body) as {
      action: { readiness?: { status: string; blockers: string[] } };
    };

    assert.equal(body.action.readiness!.status, 'ready', 'should be ready with execution flag enabled');
    assert.equal(body.action.readiness!.blockers.length, 0, 'should have no blockers with flag enabled');
  } finally {
    // Restore original value
    if (originalValue !== undefined) {
      process.env[flagName] = originalValue;
    } else {
      delete process.env[flagName];
    }
  }
});
