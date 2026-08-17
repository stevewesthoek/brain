import fs from 'node:fs';
import path from 'node:path';

export const OBSERVATION_SCHEMA_VERSION = '1.0.0';
export const DEFAULT_MAX_OBSERVATIONS = 500;
export const DEFAULT_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export function computeFreshness({ observedAt, now = new Date(), freshnessSeconds, providerState = 'ok' }) {
  if (providerState === 'not-configured' || providerState === 'unavailable') return { freshness: 'unknown', ageSeconds: null };
  const observedMs = Date.parse(observedAt ?? '');
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (!Number.isFinite(observedMs) || !Number.isFinite(nowMs)) return { freshness: 'unknown', ageSeconds: null };
  const ageSeconds = Math.max(0, Math.floor((nowMs - observedMs) / 1000));
  if (providerState === 'error') return { freshness: 'stale', ageSeconds };
  return { freshness: ageSeconds <= freshnessSeconds ? 'fresh' : 'stale', ageSeconds };
}

export function effectiveStatus(status, freshness) {
  if (freshness !== 'fresh' && status === 'healthy') return 'unknown';
  if (!['healthy', 'degraded', 'unhealthy', 'unknown'].includes(status)) return 'unknown';
  return status;
}

export function createObservation({ resourceId, providerId, observedAt, freshnessSeconds, providerState = 'ok', status = 'unknown', sourceEntityId = null, metricsSummary = {}, conditionCodes = [], provenanceSource, now = new Date() }) {
  const freshnessResult = computeFreshness({ observedAt, now, freshnessSeconds, providerState });
  const freshness = freshnessResult.freshness;
  const finalConditions = [...new Set(conditionCodes.filter(Boolean))];
  if (freshness === 'stale' && !finalConditions.includes('observation_stale')) finalConditions.push('observation_stale');
  if (freshness === 'unknown' && !finalConditions.includes('observation_unknown')) finalConditions.push('observation_unknown');
  const finalStatus = effectiveStatus(status, freshness);
  const safeObservedAt = Number.isFinite(Date.parse(observedAt ?? '')) ? new Date(observedAt).toISOString() : new Date(now).toISOString();
  const entityPart = String(sourceEntityId ?? 'summary').toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
  return {
    schemaVersion: OBSERVATION_SCHEMA_VERSION,
    observationId: `observation:${providerId}:${resourceId}:${entityPart}:${safeObservedAt}`.toLowerCase().replace(/[^a-z0-9._:-]+/g, '-'),
    resourceId,
    providerId,
    observedAt: safeObservedAt,
    status: finalStatus,
    freshness,
    sourceEntityId,
    metricsSummary: { ...metricsSummary, ...(freshnessResult.ageSeconds === null ? {} : { ageSeconds: freshnessResult.ageSeconds }) },
    conditionCodes: finalConditions,
    provenance: { source: provenanceSource, readOnly: true, authority: 'derived-runtime' },
  };
}

export function pruneObservations(observations, { now = new Date(), maxObservations = DEFAULT_MAX_OBSERVATIONS, maxAgeSeconds = DEFAULT_MAX_AGE_SECONDS } = {}) {
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  return [...observations]
    .filter((entry) => {
      const observedMs = Date.parse(entry.observedAt ?? '');
      return Number.isFinite(observedMs) && nowMs - observedMs <= maxAgeSeconds * 1000;
    })
    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))
    .slice(0, maxObservations);
}

export function writeObservationSnapshot(observations, { root = process.cwd(), now = new Date(), maxObservations = DEFAULT_MAX_OBSERVATIONS, maxAgeSeconds = DEFAULT_MAX_AGE_SECONDS, outputPath } = {}) {
  const relativePath = outputPath ?? path.join('runtime', 'local', 'infrastructure', 'health-state.json');
  const absolutePath = path.isAbsolute(relativePath) ? relativePath : path.join(root, relativePath);
  const retained = pruneObservations(observations, { now, maxObservations, maxAgeSeconds });
  const snapshot = { schemaVersion: OBSERVATION_SCHEMA_VERSION, generatedAt: new Date(now).toISOString(), maxObservations, maxAgeSeconds, observations: retained };
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true, mode: 0o700 });
  const tempPath = `${absolutePath}.tmp-${process.pid}`;
  fs.writeFileSync(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(tempPath, absolutePath);
  return { path: absolutePath, snapshot };
}
