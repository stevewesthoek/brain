import test from 'node:test';
import assert from 'node:assert/strict';
import { getContinuousProcessingRouteResponse } from '../api/domain-routers/continuous-processing-router.js';

test('continuous-processing prefix routes are handled by one domain router', () => {
  const cases = [
    ['/scheduler/continuous-processing/selection', 'continuous-processing-workflow-selection'],
    ['/scheduler/continuous-processing/stability', 'continuous-processing-stability-view'],
    ['/scheduler/continuous-processing/concurrency', 'continuous-processing-concurrency-view'],
    ['/scheduler/continuous-processing/failure-buffer', 'continuous-processing-failure-buffer-view'],
    ['/scheduler/continuous-processing/large-file-fallback', 'continuous-processing-large-file-fallback-view'],
    ['/scheduler/continuous-processing/large-file-fallback/plan', 'large-file-nightly-fallback-plan'],
    ['/scheduler/continuous-processing/measurement', 'continuous-processing-measurement-view'],
    ['/scheduler/continuous-processing/disable-recovery', 'continuous-processing-disable-recovery-view'],
  ] as const;

  for (const [pathname, expectedId] of cases) {
    const response = getContinuousProcessingRouteResponse(pathname);
    assert(response, `expected ${pathname} to be routed`);
    assert.equal(response?.statusCode, 200);
    assert.equal((response?.body as { id?: string }).id, expectedId);
  }

  assert.equal(getContinuousProcessingRouteResponse('/scheduler/other'), null);
});
