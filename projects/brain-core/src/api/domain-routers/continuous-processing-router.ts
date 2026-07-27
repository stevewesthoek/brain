import { getContinuousProcessingSelection } from '../../adapters/continuous-processing-selection.js';
import { getContinuousProcessingStabilityView } from '../../adapters/continuous-processing-stability.js';
import { getContinuousProcessingConcurrencyView } from '../../adapters/continuous-processing-concurrency.js';
import { getContinuousProcessingFailureBufferView } from '../../adapters/continuous-processing-failure-buffer.js';
import { getContinuousProcessingLargeFileFallbackView, getLargeFileNightlyFallbackPlan } from '../../adapters/continuous-processing-large-file-fallback.js';
import { getContinuousProcessingMeasurementView } from '../../adapters/continuous-processing-measurement.js';
import { getContinuousProcessingDisableRecoveryView } from '../../adapters/continuous-processing-disable-recovery.js';

export interface ContinuousProcessingRouteResponse {
  statusCode: number;
  body: unknown;
}

export function getContinuousProcessingRouteResponse(pathname: string): ContinuousProcessingRouteResponse | null {
  switch (pathname) {
    case '/scheduler/continuous-processing/selection':
      return { statusCode: 200, body: getContinuousProcessingSelection() };
    case '/scheduler/continuous-processing/stability':
      return { statusCode: 200, body: getContinuousProcessingStabilityView() };
    case '/scheduler/continuous-processing/concurrency':
      return { statusCode: 200, body: getContinuousProcessingConcurrencyView() };
    case '/scheduler/continuous-processing/failure-buffer':
      return { statusCode: 200, body: getContinuousProcessingFailureBufferView() };
    case '/scheduler/continuous-processing/large-file-fallback':
      return { statusCode: 200, body: getContinuousProcessingLargeFileFallbackView() };
    case '/scheduler/continuous-processing/large-file-fallback/plan':
      return { statusCode: 200, body: getLargeFileNightlyFallbackPlan() };
    case '/scheduler/continuous-processing/measurement':
      return { statusCode: 200, body: getContinuousProcessingMeasurementView() };
    case '/scheduler/continuous-processing/disable-recovery':
      return { statusCode: 200, body: getContinuousProcessingDisableRecoveryView() };
    default:
      return null;
  }
}

