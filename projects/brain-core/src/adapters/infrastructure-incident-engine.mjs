import { createHash } from 'node:crypto';

export const INCIDENT_SCHEMA_VERSION = '1.0.0';

function iso(value) {
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value ?? '');
  if (!Number.isFinite(parsed)) throw new Error(`Invalid incident timestamp: ${value}`);
  return new Date(parsed).toISOString();
}

function sortObservations(observations) {
  return [...observations].sort((a, b) => {
    const timeDelta = Date.parse(a.observedAt) - Date.parse(b.observedAt);
    if (timeDelta !== 0) return timeDelta;
    return String(a.observationId).localeCompare(String(b.observationId));
  });
}

export function resolveHealthPolicy(resourceId, conditionCode, healthPolicies = []) {
  for (const policy of healthPolicies) {
    if (policy.resourceId !== resourceId) continue;
    const condition = (policy.conditions ?? []).find((entry) => entry.conditionCode === conditionCode);
    if (condition) {
      return {
        healthPolicyId: policy.healthPolicyId,
        severity: condition.severity,
        policyAuthority: 'authoritative',
      };
    }
  }
  return {
    healthPolicyId: null,
    severity: 'unknown',
    policyAuthority: 'unknown',
  };
}

export function incidentFingerprint({ resourceId, conditionCode, healthPolicyId, policyCatalogVersion }) {
  const policyIdentity = healthPolicyId ?? 'unknown';
  return createHash('sha256')
    .update([resourceId, conditionCode, policyIdentity, policyCatalogVersion].join('\n'))
    .digest('hex')
    .slice(0, 32);
}

export function incidentIdFromFingerprint(fingerprint) {
  return `incident:${fingerprint}`;
}

function providerRefsForObservation(observation) {
  return [{
    providerId: observation.providerId,
    sourceEntityId: observation.sourceEntityId ?? null,
  }];
}

function mergeProviderRefs(existing = [], incoming = []) {
  const byKey = new Map();
  for (const ref of [...existing, ...incoming]) {
    const key = `${ref.providerId}|${ref.sourceEntityId ?? ''}`;
    if (!byKey.has(key)) byKey.set(key, { providerId: ref.providerId, sourceEntityId: ref.sourceEntityId ?? null });
  }
  return [...byKey.values()].sort((a, b) => `${a.providerId}|${a.sourceEntityId ?? ''}`.localeCompare(`${b.providerId}|${b.sourceEntityId ?? ''}`));
}

function isFresh(observation) {
  return observation.freshness === 'fresh';
}

function cloneIncident(incident) {
  return JSON.parse(JSON.stringify(incident));
}

function createIncident({ observation, conditionCode, policy, policyCatalogVersion }) {
  const fingerprint = incidentFingerprint({
    resourceId: observation.resourceId,
    conditionCode,
    healthPolicyId: policy.healthPolicyId,
    policyCatalogVersion,
  });
  const observedAt = iso(observation.observedAt);
  return {
    schemaVersion: INCIDENT_SCHEMA_VERSION,
    incidentId: incidentIdFromFingerprint(fingerprint),
    fingerprint,
    resourceId: observation.resourceId,
    conditionCode,
    severity: policy.severity,
    healthPolicyId: policy.healthPolicyId,
    policyCatalogVersion,
    policyAuthority: policy.policyAuthority,
    openedAt: observedAt,
    lastObservedAt: observedAt,
    observationCount: 1,
    occurrenceCount: 1,
    status: 'open',
    lastTransition: 'opened',
    freshness: observation.freshness,
    providerRefs: providerRefsForObservation(observation),
    affectedResourceIds: [observation.resourceId],
    recoveryEvidence: null,
    acknowledgement: null,
    provenance: {
      source: 'ikhp3-incident-projector',
      readOnly: true,
      authority: 'derived-runtime',
    },
  };
}

function continueIncident(incident, observation) {
  return {
    ...incident,
    lastObservedAt: iso(observation.observedAt),
    observationCount: incident.observationCount + 1,
    status: incident.status === 'suppressed' ? 'suppressed' : 'open',
    lastTransition: incident.status === 'suppressed' ? 'suppressed' : 'continued',
    freshness: observation.freshness,
    providerRefs: mergeProviderRefs(incident.providerRefs, providerRefsForObservation(observation)),
    recoveryEvidence: null,
  };
}

function reopenIncident(incident, observation) {
  return {
    ...incident,
    lastObservedAt: iso(observation.observedAt),
    observationCount: incident.observationCount + 1,
    occurrenceCount: incident.occurrenceCount + 1,
    status: 'open',
    lastTransition: 'reopened',
    freshness: observation.freshness,
    providerRefs: mergeProviderRefs(incident.providerRefs, providerRefsForObservation(observation)),
    recoveryEvidence: null,
  };
}

function recoverIncident(incident, observation) {
  return {
    ...incident,
    lastObservedAt: iso(observation.observedAt),
    status: 'recovered',
    lastTransition: 'recovered',
    freshness: 'fresh',
    providerRefs: mergeProviderRefs(incident.providerRefs, providerRefsForObservation(observation)),
    recoveryEvidence: {
      recoveredAt: iso(observation.observedAt),
      evidenceObservationId: observation.observationId,
    },
  };
}

function applyAcknowledgement(incident, acknowledgement) {
  if (!acknowledgement) return incident;
  return {
    ...incident,
    lastTransition: 'acknowledged',
    acknowledgement: {
      acknowledgedAt: iso(acknowledgement.acknowledgedAt),
      acknowledgedBy: acknowledgement.acknowledgedBy,
      expiresAt: acknowledgement.expiresAt == null ? null : iso(acknowledgement.expiresAt),
    },
  };
}

function applySuppression(incident, suppression) {
  if (!suppression) return incident;
  return {
    ...incident,
    status: 'suppressed',
    lastTransition: 'suppressed',
  };
}

function acknowledgementFor(acknowledgements, incident) {
  if (!acknowledgements) return null;
  if (Array.isArray(acknowledgements)) {
    return acknowledgements.find((entry) => entry.incidentId === incident.incidentId || entry.fingerprint === incident.fingerprint) ?? null;
  }
  return acknowledgements[incident.incidentId] ?? acknowledgements[incident.fingerprint] ?? null;
}

function suppressionFor(suppressions, incident) {
  if (!suppressions) return null;
  if (Array.isArray(suppressions)) {
    return suppressions.find((entry) => entry.incidentId === incident.incidentId || entry.fingerprint === incident.fingerprint) ?? null;
  }
  return suppressions[incident.incidentId] ?? suppressions[incident.fingerprint] ?? null;
}

/**
 * Pure IKHP3 incident projection.
 *
 * Inputs are plain data. The function performs no filesystem, network,
 * environment, provider, notification, Decision Core, or runtime persistence work.
 */
export function projectIncidents({
  previousIncidents = [],
  observations = [],
  healthPolicies = [],
  policyCatalogVersion,
  acknowledgements = null,
  suppressions = null,
  now,
} = {}) {
  if (!policyCatalogVersion) throw new Error('policyCatalogVersion is required');
  iso(now); // Require caller-injected deterministic clock, even when no transition uses it directly.

  const byFingerprint = new Map(previousIncidents.map((incident) => [incident.fingerprint, cloneIncident(incident)]));
  const transitions = [];

  for (const observation of sortObservations(observations)) {
    const observedConditions = new Set(observation.conditionCodes ?? []);

    for (const conditionCode of observedConditions) {
      const policy = resolveHealthPolicy(observation.resourceId, conditionCode, healthPolicies);
      const fingerprint = incidentFingerprint({
        resourceId: observation.resourceId,
        conditionCode,
        healthPolicyId: policy.healthPolicyId,
        policyCatalogVersion,
      });
      const existing = byFingerprint.get(fingerprint);
      let next;
      if (!existing) {
        next = createIncident({ observation, conditionCode, policy, policyCatalogVersion });
      } else if (existing.status === 'recovered') {
        next = reopenIncident(existing, observation);
      } else {
        next = continueIncident(existing, observation);
      }
      byFingerprint.set(fingerprint, next);
      transitions.push({ incidentId: next.incidentId, transition: next.lastTransition, observationId: observation.observationId });
    }

    if (isFresh(observation)) {
      for (const [fingerprint, incident] of byFingerprint.entries()) {
        if (incident.resourceId !== observation.resourceId) continue;
        if (incident.status !== 'open' && incident.status !== 'suppressed') continue;
        if (observedConditions.has(incident.conditionCode)) continue;
        const recovered = recoverIncident(incident, observation);
        byFingerprint.set(fingerprint, recovered);
        transitions.push({ incidentId: recovered.incidentId, transition: 'recovered', observationId: observation.observationId });
      }
    } else {
      for (const [fingerprint, incident] of byFingerprint.entries()) {
        if (incident.resourceId !== observation.resourceId) continue;
        if (incident.status === 'recovered') continue;
        byFingerprint.set(fingerprint, { ...incident, freshness: observation.freshness });
      }
    }
  }

  for (const [fingerprint, incident] of byFingerprint.entries()) {
    let next = incident;
    next = applyAcknowledgement(next, acknowledgementFor(acknowledgements, next));
    next = applySuppression(next, suppressionFor(suppressions, next));
    byFingerprint.set(fingerprint, next);
  }

  const incidents = [...byFingerprint.values()].sort((a, b) => a.incidentId.localeCompare(b.incidentId));
  return {
    schemaVersion: INCIDENT_SCHEMA_VERSION,
    generatedAt: iso(now),
    policyCatalogVersion,
    incidents,
    transitions,
  };
}
