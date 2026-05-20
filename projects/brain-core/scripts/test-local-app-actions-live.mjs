import { setTimeout as delay } from 'node:timers/promises';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const EXCLUDED_LIVE_ACTION_APPS = new Set(['buildflow']);
const preferredLiveActions = [
  ['video-orchestrator', 'restart'],
  ['video-orchestrator', 'start'],
  ['says-the-bible', 'stop'],
  ['comfyui', 'stop'],
  ['firecrawl', 'stop'],
];
const fixedLifecycleCandidates = [
  ['probot', 'start'],
  ['via-di-eden', 'start'],
  ['via-di-eden', 'restart'],
  ['oliveto-organizing', 'start'],
  ['oliveto-organizing', 'restart'],
  ['jpv-bootcamp', 'start'],
  ['xgrow', 'start'],
  ['xgrow', 'restart'],
  ['family-finance', 'start'],
  ['tradebot', 'start'],
];

let server;
let baseUrl = process.env.BRAIN_CORE_URL;
const managedProcessSandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-core-live-managed-process-'));
const previousManagedProcessPath = process.env.BRAIN_CORE_LOCAL_APP_MANAGED_PROCESS_PATH;
process.env.BRAIN_CORE_LOCAL_APP_MANAGED_PROCESS_PATH = path.join(managedProcessSandbox, 'managed-processes.json');

if (!baseUrl) {
  const { createBrainCoreServer } = await import('../dist/api/server.js');
  server = createBrainCoreServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Temporary Brain Core server did not expose a TCP address.');
  baseUrl = `http://127.0.0.1:${address.port}`;
}

const results = [];

try {
  const status = await expectGet('/status');
  assert(status.ok === true, '/status did not report ok=true');

  const dashboard = await expectGet('/local-apps/dashboard');
  assert(dashboard.id === 'local-apps-dashboard', 'dashboard id mismatch');
  assert(Array.isArray(dashboard.apps), 'dashboard apps missing');
  assert(dashboard.appCount === dashboard.apps.length, 'dashboard count does not match apps length');
  assert(dashboard.apps.length >= 16, 'dashboard canonical inventory unexpectedly below 16 apps');

  const diagnostics = await expectGet('/local-apps/source-diagnostics');
  assert(diagnostics.canonicalAppCount >= 15, 'source diagnostics canonical count unexpectedly low');
  assert(diagnostics.displayedAppCount >= diagnostics.canonicalAppCount, 'displayed count below canonical count');

  const actionStatusBefore = await expectGet('/local-apps/actions/status');
  const backlog = await expectGet('/local-apps/action-enablement-backlog');
  assert(actionStatusBefore.safety?.commandOverrideAccepted === false, 'action status must reject command overrides');
  assert(backlog.disabledActionCount >= 0, 'backlog disabled action count should be reported');
  assert(backlog.disabledActionCount === backlog.items.length, 'backlog disabledActionCount should match item count');

  const unknownApp = await post('/local-apps/unknown-local-app/start');
  assert(unknownApp.statusCode === 404, 'unknown app POST should return 404');
  assert(unknownApp.body.status === 'not_found', 'unknown app POST should return not_found');

  const unsupportedAction = await post('/local-apps/model-router/delete');
  assert(unsupportedAction.statusCode === 404, 'unsupported action POST should return 404');

  const notExecutable = await post('/local-apps/model-router/start');
  assert(notExecutable.statusCode === 200, 'model-router start probe should return structured 200 result');
  assert(notExecutable.body.status === 'not_executable', 'model-router start should be not_executable');
  assert(notExecutable.body.safety?.commandOverrideAccepted === false, 'model-router probe must not accept command overrides');

  const executable = selectExecutableAction(dashboard.apps);
  let liveActionResult = null;
  if (executable) {
    const [appId, action] = executable;
    liveActionResult = await post(`/local-apps/${encodeURIComponent(appId)}/${action}`);
    assert(liveActionResult.statusCode === 200, `safe executable ${appId}/${action} did not return 200`);
    assert(liveActionResult.body.appId === appId, 'live action app id mismatch');
    assert(liveActionResult.body.action === action, 'live action action mismatch');
    assert(liveActionResult.body.safety?.commandOverrideAccepted === false, 'live action accepted command override unexpectedly');
  }

  const stillAlive = await expectGet('/status');
  assert(stillAlive.ok === true, 'Brain Core did not respond after POST probes');
  const actionStatusAfter = await expectGet('/local-apps/actions/status');
  if (liveActionResult) {
    const visibleResult = actionStatusAfter.recentResults?.find((result) => result.id === liveActionResult.body.id);
    assert(Boolean(visibleResult), 'recent action result was not visible in action status');
    assert(visibleResult.ok === liveActionResult.body.ok, 'visible result ok mismatch');
    assert(visibleResult.status === liveActionResult.body.status, 'visible result status mismatch');
    assert((actionStatusAfter.audit?.persistedResultCount ?? 0) >= (actionStatusBefore.audit?.persistedResultCount ?? 0), 'persisted result count should not decrease');
  }

  const compositeRestartCandidate = dashboard.apps.find((app) => app.restartSupported && app.startSupported && app.stopSupported);
  let compositeRestartResult = null;
  if (compositeRestartCandidate) {
    compositeRestartResult = await post(`/local-apps/${encodeURIComponent(compositeRestartCandidate.id)}/restart`);
    assert(compositeRestartResult.statusCode === 200, `composite restart for ${compositeRestartCandidate.id} did not return 200`);
    assert(compositeRestartResult.body.action === 'restart', 'composite restart action mismatch');
  }

  const managedNpmCandidate = dashboard.apps.find(
    (app) => app.id === 'prochat' && app.startSupported && !app.stopSupported,
  );
  let managedLifecycle = { status: 'skipped', reason: 'No managed npm lifecycle candidate was reported.' };
  if (managedNpmCandidate) {
    const startResult = await post(`/local-apps/${encodeURIComponent(managedNpmCandidate.id)}/start`);
    if (startResult.statusCode === 200 && startResult.body.ok === true) {
      const statusWithManaged = await expectGet('/local-apps/actions/status');
      const managedRecord = statusWithManaged.managedProcesses?.find((entry) => entry.appId === managedNpmCandidate.id);
      if (managedRecord) {
        const stopResult = await post(`/local-apps/${encodeURIComponent(managedNpmCandidate.id)}/stop`);
        if (stopResult.statusCode === 200 && stopResult.body.ok === true) {
          managedLifecycle = {
            status: stopResult.body.status,
            reason: stopResult.body.message,
          };
        } else {
          managedLifecycle = {
            status: 'skipped',
            reason: `Managed stop for ${managedNpmCandidate.id} was not successful.`,
          };
        }
      } else {
        managedLifecycle = {
          status: 'skipped',
          reason: `Managed process record was not visible after starting ${managedNpmCandidate.id}.`,
        };
      }
    } else {
      managedLifecycle = {
        status: 'skipped',
        reason: `Brain Core-managed start for ${managedNpmCandidate.id} was not accepted.`,
      };
    }
  }

  const executableActions = dashboard.apps.flatMap((app) => {
    const actions = [];
    if (app.startSupported) actions.push(`${app.id}:start`);
    if (app.stopSupported) actions.push(`${app.id}:stop`);
    if (app.restartSupported) actions.push(`${app.id}:restart`);
    return actions;
  });
  const disabledActions = dashboard.apps.flatMap((app) => {
    const actions = [];
    if (!app.startSupported) actions.push({ appId: app.id, action: 'start', reason: app.actionDisabledReasons?.start ?? app.actionDisabledReason ?? 'No reason reported.' });
    if (!app.stopSupported) actions.push({ appId: app.id, action: 'stop', reason: app.actionDisabledReasons?.stop ?? app.actionDisabledReason ?? 'No reason reported.' });
    if (!app.restartSupported) actions.push({ appId: app.id, action: 'restart', reason: app.actionDisabledReasons?.restart ?? app.actionDisabledReason ?? 'No reason reported.' });
    return actions;
  });
  const newlyExecutableActions = fixedLifecycleCandidates
    .map(([appId, action]) => `${appId}:${action}`)
    .filter((action) => executableActions.includes(action));
  assert(backlog.disabledActionCount === disabledActions.length, 'backlog disabled count must match dashboard disabled actions');
  const backlogDisabledKeys = new Set(backlog.items.map((item) => `${item.appId}:${item.action}`));
  for (const action of executableActions) {
    assert(!backlogDisabledKeys.has(action), `executable action unexpectedly listed as disabled: ${action}`);
  }
  for (const disabled of disabledActions) {
    assert(backlogDisabledKeys.has(`${disabled.appId}:${disabled.action}`), `disabled dashboard action missing from backlog: ${disabled.appId}:${disabled.action}`);
  }

  const summary = {
    baseUrl,
    status: 'passed',
    dashboard: {
      status: dashboard.status,
      appCount: dashboard.appCount,
      runningCount: dashboard.runningCount,
      stoppedCount: dashboard.stoppedCount,
      unknownCount: dashboard.unknownCount,
      actionPolicyStatus: dashboard.actionPolicy?.status,
    },
    sourceDiagnostics: {
      canonicalAppCount: diagnostics.canonicalAppCount,
      displayedAppCount: diagnostics.displayedAppCount,
      mismatches: diagnostics.mismatches ?? [],
    },
    probes: results,
    executableActions,
    newlyExecutableActions,
    disabledActionCount: disabledActions.length,
    backlogDisabledActionCount: backlog.disabledActionCount,
    backlogCategories: backlog.categories,
    disabledActions,
    liveAction: liveActionResult
      ? {
          appId: liveActionResult.body.appId,
          action: liveActionResult.body.action,
          status: liveActionResult.body.status,
          ok: liveActionResult.body.ok,
          message: liveActionResult.body.message,
          errorCode: liveActionResult.body.errorCode ?? null,
        }
      : {
          status: 'skipped',
          reason: 'No safe executable app/action was reported by /local-apps/dashboard.',
          missing: dashboard.apps.map((app) => ({ id: app.id, reason: app.actionDisabledReason })).filter((entry) => entry.reason),
        },
    compositeRestart: compositeRestartResult
      ? {
          appId: compositeRestartResult.body.appId,
          action: compositeRestartResult.body.action,
          status: compositeRestartResult.body.status,
          ok: compositeRestartResult.body.ok,
          message: compositeRestartResult.body.message,
        }
      : { status: 'skipped', reason: 'No composite restart candidate was available.' },
    managedLifecycle,
    actionStatusAfter: {
      recentResultCount: actionStatusAfter.recentResults?.length ?? 0,
      lockCount: actionStatusAfter.locks?.length ?? 0,
      managedProcessCount: actionStatusAfter.managedProcesses?.length ?? 0,
    },
  };

  console.log(JSON.stringify(summary, null, 2));
} finally {
  if (previousManagedProcessPath === undefined) {
    delete process.env.BRAIN_CORE_LOCAL_APP_MANAGED_PROCESS_PATH;
  } else {
    process.env.BRAIN_CORE_LOCAL_APP_MANAGED_PROCESS_PATH = previousManagedProcessPath;
  }
  fs.rmSync(managedProcessSandbox, { recursive: true, force: true });
  if (server) {
    await new Promise((resolve) => server.close(resolve));
    await delay(25);
  }
}

function selectExecutableAction(apps) {
  for (const [preferredAppId, preferredAction] of preferredLiveActions) {
    const app = apps.find((entry) => entry.id === preferredAppId);
    if (app && supports(app, preferredAction)) return [preferredAppId, preferredAction];
  }

  const fallback = apps.find((app) =>
    !EXCLUDED_LIVE_ACTION_APPS.has(app.id) && (app.startSupported || app.stopSupported || app.restartSupported),
  );
  if (!fallback) return null;
  if (fallback.restartSupported) return [fallback.id, 'restart'];
  if (fallback.stopSupported) return [fallback.id, 'stop'];
  return [fallback.id, 'start'];
}

function supports(app, action) {
  if (action === 'start') return app.startSupported === true;
  if (action === 'stop') return app.stopSupported === true;
  if (action === 'restart') return app.restartSupported === true;
  return false;
}

async function expectGet(path) {
  const response = await get(path);
  assert(response.statusCode === 200, `${path} expected 200, got ${response.statusCode}`);
  return response.body;
}

async function get(path) {
  return request('GET', path);
}

async function post(path) {
  return request('POST', path);
}

async function request(method, path) {
  const url = `${baseUrl}${path}`;
  const startedAt = Date.now();
  const response = await fetch(url, { method });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { parseError: text.slice(0, 200) };
  }
  results.push({ method, path, statusCode: response.status, durationMs: Date.now() - startedAt });
  return { statusCode: response.status, body };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
