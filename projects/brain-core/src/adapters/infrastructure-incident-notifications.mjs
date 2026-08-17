import fs from 'node:fs';
import path from 'node:path';

export const INCIDENT_NOTIFICATION_SCHEMA_VERSION = '1.0.0';
export const DEFAULT_NOTIFICATION_STATE_PATH = path.join('runtime', 'local', 'infrastructure', 'incident-notification-state.json');
export const DEFAULT_MAX_IMMEDIATE_PER_RESOURCE_PER_HOUR = 5;
export const DEFAULT_MAX_DEDUPE_KEYS = 1000;
export const DEFAULT_MAX_IMMEDIATE_HISTORY = 500;
export const DEFAULT_MAX_DIGEST_DAYS = 31;

function toEpochMs(value, label) {
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value ?? '');
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}: ${value}`);
  return parsed;
}

function iso(value, label = 'timestamp') {
  return new Date(toEpochMs(value, label)).toISOString();
}

function utcDay(value) {
  return iso(value).slice(0, 10);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isAcknowledgementActive(incident, nowMs) {
  const acknowledgement = incident?.acknowledgement;
  if (!acknowledgement) return false;
  const acknowledgedAt = Date.parse(acknowledgement.acknowledgedAt ?? '');
  if (!Number.isFinite(acknowledgedAt) || acknowledgedAt > nowMs) return false;
  if (acknowledgement.expiresAt == null) return true;
  const expiresAt = Date.parse(acknowledgement.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > nowMs;
}

function safeOccurredAt(incident, transition, now) {
  if (transition === 'recovered' && incident?.recoveryEvidence?.recoveredAt) return iso(incident.recoveryEvidence.recoveredAt);
  if (incident?.lastObservedAt) return iso(incident.lastObservedAt);
  return iso(now, 'now');
}

function safePayload(incident, transition, openIncidentCount, now) {
  return {
    incidentId: incident.incidentId,
    resourceId: incident.resourceId,
    conditionCode: incident.conditionCode,
    severity: incident.severity,
    transition,
    openIncidentCount,
    occurredAt: safeOccurredAt(incident, transition, now),
  };
}

function notificationKey(payload) {
  return [payload.incidentId, payload.transition, payload.occurredAt].join('|');
}

function countImmediateWithinHour(history, resourceId, occurredAt) {
  const eventMs = toEpochMs(occurredAt, 'occurredAt');
  const windowStart = eventMs - 60 * 60 * 1000;
  return history.filter((entry) => {
    if (entry.resourceId !== resourceId) return false;
    const at = Date.parse(entry.occurredAt ?? '');
    return Number.isFinite(at) && at >= windowStart && at <= eventMs;
  }).length;
}

function normalizeCursor(cursor, now) {
  if (!cursor) return emptyNotificationCursor({ now });
  return {
    schemaVersion: INCIDENT_NOTIFICATION_SCHEMA_VERSION,
    generatedAt: cursor.generatedAt ?? iso(now, 'now'),
    deliveredKeys: Array.isArray(cursor.deliveredKeys) ? [...cursor.deliveredKeys] : [],
    immediateHistory: Array.isArray(cursor.immediateHistory) ? clone(cursor.immediateHistory) : [],
    digestDays: Array.isArray(cursor.digestDays) ? [...cursor.digestDays] : [],
  };
}

function boundedCursor(cursor, {
  now,
  maxDedupeKeys = DEFAULT_MAX_DEDUPE_KEYS,
  maxImmediateHistory = DEFAULT_MAX_IMMEDIATE_HISTORY,
  maxDigestDays = DEFAULT_MAX_DIGEST_DAYS,
} = {}) {
  return {
    schemaVersion: INCIDENT_NOTIFICATION_SCHEMA_VERSION,
    generatedAt: iso(now, 'now'),
    deliveredKeys: [...new Set(cursor.deliveredKeys)].slice(-maxDedupeKeys),
    immediateHistory: [...cursor.immediateHistory]
      .filter((entry) => Number.isFinite(Date.parse(entry.occurredAt ?? '')))
      .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))
      .slice(-maxImmediateHistory),
    digestDays: [...new Set(cursor.digestDays)].sort().slice(-maxDigestDays),
  };
}

export function emptyNotificationCursor({ now } = {}) {
  return {
    schemaVersion: INCIDENT_NOTIFICATION_SCHEMA_VERSION,
    generatedAt: iso(now, 'now'),
    deliveredKeys: [],
    immediateHistory: [],
    digestDays: [],
  };
}

/**
 * Pure IKHP3 attention planner. It consumes incident authority and a delivery
 * cursor, but never mutates incident health or calls delivery/provider systems.
 */
export function planIncidentAttention({
  incidents = [],
  transitions = [],
  previousCursor = null,
  now,
  attentionPolicy = {},
} = {}) {
  const nowIso = iso(now, 'now');
  const nowMs = toEpochMs(now, 'now');
  const policy = {
    maxImmediatePerResourcePerHour: attentionPolicy.maxImmediatePerResourcePerHour ?? DEFAULT_MAX_IMMEDIATE_PER_RESOURCE_PER_HOUR,
    immediateSeverities: attentionPolicy.immediateSeverities ?? ['critical', 'high'],
    immediateTransitions: attentionPolicy.immediateTransitions ?? ['opened', 'reopened', 'recovered'],
  };
  if (!Number.isInteger(policy.maxImmediatePerResourcePerHour) || policy.maxImmediatePerResourcePerHour < 1) {
    throw new Error('maxImmediatePerResourcePerHour must be a positive integer');
  }

  const incidentById = new Map(incidents.map((incident) => [incident.incidentId, incident]));
  const openIncidentCount = incidents.filter((incident) => incident.status === 'open').length;
  const cursor = normalizeCursor(previousCursor, now);
  const deliveredKeys = new Set(cursor.deliveredKeys);
  const immediate = [];
  const deferred = [];
  const immediateHistory = [...cursor.immediateHistory];

  for (const transitionRecord of transitions) {
    const incident = incidentById.get(transitionRecord.incidentId);
    if (!incident) continue;
    const transition = transitionRecord.transition;
    if (!policy.immediateTransitions.includes(transition)) continue;
    if (!policy.immediateSeverities.includes(incident.severity)) continue;
    if (isAcknowledgementActive(incident, nowMs)) continue;

    const payload = safePayload(incident, transition, openIncidentCount, now);
    const key = notificationKey(payload);
    if (deliveredKeys.has(key)) continue;

    const recentCount = countImmediateWithinHour(immediateHistory, incident.resourceId, payload.occurredAt);
    if (recentCount >= policy.maxImmediatePerResourcePerHour) {
      deferred.push({ type: 'digest-deferred', reason: 'immediate-rate-limit', payload });
      continue;
    }

    immediate.push({ type: transition === 'recovered' ? 'recovery' : 'immediate', payload });
    immediateHistory.push({ resourceId: incident.resourceId, occurredAt: payload.occurredAt, key });
    deliveredKeys.add(key);
  }

  const digestDay = utcDay(nowIso);
  const digestAlreadyPlanned = cursor.digestDays.includes(digestDay);
  const digestCandidates = incidents.filter((incident) => {
    if (incident.status !== 'open') return false;
    if (isAcknowledgementActive(incident, nowMs)) return false;
    return ['medium', 'low', 'unknown'].includes(incident.severity);
  });
  const digest = !digestAlreadyPlanned && (digestCandidates.length > 0 || deferred.length > 0)
    ? {
        type: 'daily-digest',
        day: digestDay,
        openIncidentCount,
        items: [
          ...digestCandidates.map((incident) => safePayload(incident, incident.lastTransition, openIncidentCount, now)),
          ...deferred.map((entry) => entry.payload),
        ],
      }
    : null;

  const nextCursor = boundedCursor({
    ...cursor,
    deliveredKeys: [...deliveredKeys],
    immediateHistory,
    digestDays: digest ? [...cursor.digestDays, digestDay] : cursor.digestDays,
  }, { now });

  return {
    schemaVersion: INCIDENT_NOTIFICATION_SCHEMA_VERSION,
    generatedAt: nowIso,
    openIncidentCount,
    immediate,
    deferred,
    digest,
    nextCursor,
  };
}

function validateCursor(cursor) {
  if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor)) throw new Error('Incident notification cursor is not an object');
  if (cursor.schemaVersion !== INCIDENT_NOTIFICATION_SCHEMA_VERSION) throw new Error(`Unsupported incident notification schemaVersion: ${cursor.schemaVersion}`);
  if (!Array.isArray(cursor.deliveredKeys)) throw new Error('Incident notification cursor deliveredKeys must be an array');
  if (!Array.isArray(cursor.immediateHistory)) throw new Error('Incident notification cursor immediateHistory must be an array');
  if (!Array.isArray(cursor.digestDays)) throw new Error('Incident notification cursor digestDays must be an array');
  for (const entry of cursor.immediateHistory) {
    if (!entry || typeof entry.resourceId !== 'string' || !Number.isFinite(Date.parse(entry.occurredAt ?? ''))) {
      throw new Error('Incident notification cursor contains invalid immediate history');
    }
  }
  return cursor;
}

export function readNotificationCursor({ root = process.cwd(), now, inputPath = DEFAULT_NOTIFICATION_STATE_PATH } = {}) {
  const absolutePath = path.isAbsolute(inputPath) ? inputPath : path.join(root, inputPath);
  if (!fs.existsSync(absolutePath)) {
    return { path: absolutePath, exists: false, cursor: emptyNotificationCursor({ now }) };
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    throw new Error(`Incident notification cursor is malformed at ${absolutePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    validateCursor(parsed);
  } catch (error) {
    throw new Error(`Incident notification cursor failed validation at ${absolutePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
  return { path: absolutePath, exists: true, cursor: parsed };
}

export function writeNotificationCursor(cursor, {
  root = process.cwd(),
  now,
  outputPath = DEFAULT_NOTIFICATION_STATE_PATH,
  maxDedupeKeys = DEFAULT_MAX_DEDUPE_KEYS,
  maxImmediateHistory = DEFAULT_MAX_IMMEDIATE_HISTORY,
  maxDigestDays = DEFAULT_MAX_DIGEST_DAYS,
} = {}) {
  const absolutePath = path.isAbsolute(outputPath) ? outputPath : path.join(root, outputPath);
  const bounded = boundedCursor(validateCursor(cursor), { now, maxDedupeKeys, maxImmediateHistory, maxDigestDays });
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true, mode: 0o700 });
  const tempPath = `${absolutePath}.tmp-${process.pid}`;
  try {
    fs.writeFileSync(tempPath, `${JSON.stringify(bounded, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(tempPath, absolutePath);
  } catch (error) {
    try {
      if (fs.existsSync(tempPath)) fs.rmSync(tempPath, { force: true });
    } catch {
      // Preserve the original persistence failure.
    }
    throw error;
  }
  return { path: absolutePath, cursor: bounded };
}
