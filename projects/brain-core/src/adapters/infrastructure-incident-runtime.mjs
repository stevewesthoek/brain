import fs from 'node:fs';
import path from 'node:path';

export const INCIDENT_RUNTIME_SCHEMA_VERSION = '1.0.0';
export const DEFAULT_MAX_INCIDENTS = 200;
export const DEFAULT_MAX_INCIDENT_AGE_SECONDS = 30 * 24 * 60 * 60;
export const DEFAULT_RECOVERED_RETENTION_SECONDS = 7 * 24 * 60 * 60;
export const DEFAULT_INCIDENT_STATE_PATH = path.join('runtime', 'local', 'infrastructure', 'incident-state.json');

function toEpochMs(value, label) {
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value ?? '');
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}: ${value}`);
  return parsed;
}

function iso(value, label = 'timestamp') {
  return new Date(toEpochMs(value, label)).toISOString();
}

function isActiveIncident(incident) {
  return incident?.status === 'open' || incident?.status === 'suppressed';
}

function recoveredAtMs(incident) {
  const recoveredAt = incident?.recoveryEvidence?.recoveredAt ?? incident?.lastObservedAt;
  const parsed = Date.parse(recoveredAt ?? '');
  return Number.isFinite(parsed) ? parsed : null;
}

function historicalAgeSeconds(incident, nowMs) {
  const timestamp = recoveredAtMs(incident);
  if (timestamp === null) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((nowMs - timestamp) / 1000));
}

function newestFirst(a, b) {
  const aTime = Date.parse(a.lastObservedAt ?? a.openedAt ?? '') || 0;
  const bTime = Date.parse(b.lastObservedAt ?? b.openedAt ?? '') || 0;
  if (aTime !== bTime) return bTime - aTime;
  return String(a.incidentId ?? '').localeCompare(String(b.incidentId ?? ''));
}

/**
 * Pure bounded-retention helper.
 * Active open/suppressed incidents are never dropped because of age or count.
 * Only recovered historical incidents are eligible for retention pruning.
 */
export function pruneIncidents(incidents, {
  now,
  maxIncidents = DEFAULT_MAX_INCIDENTS,
  maxIncidentAgeSeconds = DEFAULT_MAX_INCIDENT_AGE_SECONDS,
  recoveredRetentionSeconds = DEFAULT_RECOVERED_RETENTION_SECONDS,
} = {}) {
  const nowMs = toEpochMs(now, 'now');
  if (!Number.isInteger(maxIncidents) || maxIncidents < 1) throw new Error('maxIncidents must be a positive integer');
  if (!Number.isInteger(maxIncidentAgeSeconds) || maxIncidentAgeSeconds < 1) throw new Error('maxIncidentAgeSeconds must be a positive integer');
  if (!Number.isInteger(recoveredRetentionSeconds) || recoveredRetentionSeconds < 1) throw new Error('recoveredRetentionSeconds must be a positive integer');

  const active = [];
  const historical = [];

  for (const incident of incidents ?? []) {
    if (isActiveIncident(incident)) {
      active.push(incident);
      continue;
    }
    if (incident?.status !== 'recovered') continue;
    const ageSeconds = historicalAgeSeconds(incident, nowMs);
    if (ageSeconds > recoveredRetentionSeconds) continue;
    if (ageSeconds > maxIncidentAgeSeconds) continue;
    historical.push(incident);
  }

  active.sort(newestFirst);
  historical.sort(newestFirst);

  if (active.length >= maxIncidents) return active;
  const remainingSlots = maxIncidents - active.length;
  return [...active, ...historical.slice(0, remainingSlots)];
}

function validateIncidentSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw new Error('Incident state is not an object');
  if (snapshot.schemaVersion !== INCIDENT_RUNTIME_SCHEMA_VERSION) throw new Error(`Unsupported incident state schemaVersion: ${snapshot.schemaVersion}`);
  if (!Array.isArray(snapshot.incidents)) throw new Error('Incident state incidents must be an array');
  for (const [index, incident] of snapshot.incidents.entries()) {
    if (!incident || typeof incident !== 'object' || Array.isArray(incident)) throw new Error(`Incident state entry ${index} is not an object`);
    if (typeof incident.incidentId !== 'string' || incident.incidentId.length === 0) throw new Error(`Incident state entry ${index} has invalid incidentId`);
    if (!['open', 'recovered', 'suppressed'].includes(incident.status)) throw new Error(`Incident state entry ${index} has invalid status`);
  }
  return snapshot;
}

export function readIncidentSnapshot({
  root = process.cwd(),
  now,
  inputPath = DEFAULT_INCIDENT_STATE_PATH,
  maxIncidents = DEFAULT_MAX_INCIDENTS,
  maxIncidentAgeSeconds = DEFAULT_MAX_INCIDENT_AGE_SECONDS,
  recoveredRetentionSeconds = DEFAULT_RECOVERED_RETENTION_SECONDS,
} = {}) {
  const absolutePath = path.isAbsolute(inputPath) ? inputPath : path.join(root, inputPath);
  if (!fs.existsSync(absolutePath)) {
    return {
      path: absolutePath,
      exists: false,
      snapshot: {
        schemaVersion: INCIDENT_RUNTIME_SCHEMA_VERSION,
        generatedAt: iso(now, 'now'),
        maxIncidents,
        maxIncidentAgeSeconds,
        recoveredRetentionSeconds,
        incidents: [],
      },
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    throw new Error(`Incident state is malformed at ${absolutePath}: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    validateIncidentSnapshot(parsed);
  } catch (error) {
    throw new Error(`Incident state failed validation at ${absolutePath}: ${error instanceof Error ? error.message : String(error)}`);
  }

  return { path: absolutePath, exists: true, snapshot: parsed };
}

export function writeIncidentSnapshot(incidents, {
  root = process.cwd(),
  now,
  maxIncidents = DEFAULT_MAX_INCIDENTS,
  maxIncidentAgeSeconds = DEFAULT_MAX_INCIDENT_AGE_SECONDS,
  recoveredRetentionSeconds = DEFAULT_RECOVERED_RETENTION_SECONDS,
  outputPath = DEFAULT_INCIDENT_STATE_PATH,
} = {}) {
  const generatedAt = iso(now, 'now');
  const absolutePath = path.isAbsolute(outputPath) ? outputPath : path.join(root, outputPath);
  const retained = pruneIncidents(incidents, {
    now,
    maxIncidents,
    maxIncidentAgeSeconds,
    recoveredRetentionSeconds,
  });
  const snapshot = {
    schemaVersion: INCIDENT_RUNTIME_SCHEMA_VERSION,
    generatedAt,
    maxIncidents,
    maxIncidentAgeSeconds,
    recoveredRetentionSeconds,
    incidents: retained,
  };

  fs.mkdirSync(path.dirname(absolutePath), { recursive: true, mode: 0o700 });
  const tempPath = `${absolutePath}.tmp-${process.pid}`;
  try {
    fs.writeFileSync(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(tempPath, absolutePath);
  } catch (error) {
    try {
      if (fs.existsSync(tempPath)) fs.rmSync(tempPath, { force: true });
    } catch {
      // Preserve the original write error; cleanup failure must not mask it.
    }
    throw error;
  }

  return { path: absolutePath, snapshot };
}
