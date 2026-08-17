import { createObservation } from './infrastructure-observation-runtime.mjs';

function findBinding(bindings, providerId, predicate) {
  return bindings.filter((binding) => binding.providerId === providerId).find(predicate);
}

function providerFallback(bindings, providerId, providerState, now, provenanceSource) {
  return bindings.filter((binding) => binding.providerId === providerId).map((binding) => createObservation({
    resourceId: binding.resourceId,
    providerId,
    observedAt: new Date(now).toISOString(),
    freshnessSeconds: binding.freshnessSeconds,
    providerState,
    status: 'unknown',
    metricsSummary: { providerState },
    conditionCodes: [providerState === 'error' ? 'provider_error' : 'provider_unavailable'],
    provenanceSource,
    now,
  }));
}

export function normalizeNewRelic(status, bindings, { now = new Date() } = {}) {
  if (!status || status.status !== 'ok') return providerFallback(bindings, 'newrelic', status?.status ?? 'unavailable', now, 'infra-new-relic');
  const observations = [];
  for (const binding of bindings.filter((entry) => entry.providerId === 'newrelic')) {
    const host = (status.hosts ?? []).find((candidate) => binding.selector.kind === 'entity-name' && binding.selector.names.some((name) => name.toLowerCase() === String(candidate.name).toLowerCase()));
    if (!host) {
      observations.push(createObservation({ resourceId: binding.resourceId, providerId: 'newrelic', observedAt: new Date(now).toISOString(), freshnessSeconds: binding.freshnessSeconds, status: 'unknown', sourceEntityId: null, metricsSummary: { expectedNames: binding.selector.names, observed: false }, conditionCodes: ['provider_entity_missing'], provenanceSource: 'infra-new-relic', now }));
      continue;
    }
    const observedAt = host.lastSeenAt ?? new Date(now).toISOString();
    const conditions = [];
    if (host.reporting === false || host.online === false) conditions.push('host_not_reporting');
    if (typeof host.diskUsedPercent === 'number' && host.diskUsedPercent >= 90) conditions.push('disk_capacity_critical');
    else if (typeof host.diskUsedPercent === 'number' && host.diskUsedPercent >= 80) conditions.push('disk_capacity_warning');
    if (host.alertSeverity && String(host.alertSeverity).toLowerCase() !== 'not_alerting') conditions.push('provider_alert');
    const statusValue = conditions.includes('host_not_reporting') || conditions.includes('disk_capacity_critical') ? 'unhealthy' : conditions.length ? 'degraded' : 'healthy';
    observations.push(createObservation({ resourceId: binding.resourceId, providerId: 'newrelic', observedAt, freshnessSeconds: binding.freshnessSeconds, status: statusValue, sourceEntityId: host.name, metricsSummary: { reporting: host.reporting ?? null, online: host.online ?? null, cpuPercent: host.cpuPercent ?? null, memoryPercent: host.memoryPercent ?? null, diskUsedPercent: host.diskUsedPercent ?? null, processCount: host.processCount ?? null, apmReporting: status.apm?.filter((entity) => entity.reporting).length ?? 0, openIssues: status.issues?.open ?? null, criticalIssues: status.issues?.critical ?? null, syntheticFailures: status.synthetics?.filter((synthetic) => synthetic.online === false || synthetic.lastResult === 'FAILED').length ?? 0 }, conditionCodes: conditions, provenanceSource: 'infra-new-relic', now }));
  }
  return observations;
}

export function normalizeCloudflare(status, bindings, { now = new Date() } = {}) {
  if (!status || status.status !== 'ok') return providerFallback(bindings, 'cloudflare', status?.status ?? 'unavailable', now, 'infra-cloudflare-tunnels');
  const observations = [];
  for (const binding of bindings.filter((entry) => entry.providerId === 'cloudflare')) {
    const tunnel = (status.tunnels ?? []).find((candidate) => {
      const hostnames = (candidate.hostnames ?? []).map((item) => item.hostname);
      return binding.selector.kind === 'hostname' && binding.selector.names.some((name) => hostnames.includes(name));
    });
    if (!tunnel) {
      observations.push(createObservation({ resourceId: binding.resourceId, providerId: 'cloudflare', observedAt: new Date(now).toISOString(), freshnessSeconds: binding.freshnessSeconds, status: 'unknown', sourceEntityId: null, metricsSummary: { expectedHostnames: binding.selector.names, observed: false }, conditionCodes: ['provider_entity_missing'], provenanceSource: 'infra-cloudflare-tunnels', now }));
      continue;
    }
    const connectionCount = Number.isInteger(tunnel.connectionCount) ? tunnel.connectionCount : null;
    const conditions = [];
    if (connectionCount === 0 || String(tunnel.status).toLowerCase().includes('down')) conditions.push('tunnel_connector_missing');
    if (typeof connectionCount === 'number' && connectionCount > 1) conditions.push('tunnel_connector_conflict');
    if ((tunnel.hostnames ?? []).some((item) => item.online === false)) conditions.push('tunnel_origin_unreachable');
    const state = conditions.includes('tunnel_connector_missing') || conditions.includes('tunnel_connector_conflict') ? 'unhealthy' : conditions.length ? 'degraded' : 'healthy';
    observations.push(createObservation({ resourceId: binding.resourceId, providerId: 'cloudflare', observedAt: new Date(now).toISOString(), freshnessSeconds: binding.freshnessSeconds, status: state, sourceEntityId: tunnel.id ?? tunnel.name ?? null, metricsSummary: { tunnelStatus: tunnel.status ?? 'unknown', connectionCount, hostnames: (tunnel.hostnames ?? []).map((item) => ({ hostname: item.hostname, online: item.online ?? null, serviceKind: String(item.service ?? '').split(':')[0] || 'unknown' })) }, conditionCodes: conditions, provenanceSource: 'infra-cloudflare-tunnels', now }));
  }
  return observations;
}

export function normalizeTailscale(status, bindings, { now = new Date() } = {}) {
  if (!status || status.status !== 'ok') return providerFallback(bindings, 'tailscale', status?.status ?? 'unavailable', now, 'infra-tailscale');
  const observations = [];
  for (const binding of bindings.filter((entry) => entry.providerId === 'tailscale')) {
    const expected = binding.selector.names;
    const device = (status.devices ?? []).find((candidate) => (candidate.addresses ?? []).some((address) => expected.includes(address)));
    if (!device) {
      observations.push(createObservation({ resourceId: binding.resourceId, providerId: 'tailscale', observedAt: new Date(now).toISOString(), freshnessSeconds: binding.freshnessSeconds, providerState: 'ok', status: 'unhealthy', metricsSummary: { expectedAddresses: expected, observed: false }, conditionCodes: ['tailscale_device_missing'], provenanceSource: 'infra-tailscale', now }));
      continue;
    }
    const conditions = [];
    if (device.online === false) conditions.push('tailscale_device_offline');
    if (device.sshReachable === false) conditions.push('ssh_probe_failed');
    if (device.routeState === 'error') conditions.push('tailscale_route_unhealthy');
    const state = conditions.includes('tailscale_device_offline') ? 'unhealthy' : conditions.length ? 'degraded' : 'healthy';
    observations.push(createObservation({ resourceId: binding.resourceId, providerId: 'tailscale', observedAt: device.lastSeenAt ?? new Date(now).toISOString(), freshnessSeconds: binding.freshnessSeconds, status: state, sourceEntityId: device.name ?? expected[0] ?? null, metricsSummary: { online: device.online ?? null, addresses: device.addresses ?? [], routeState: device.routeState ?? 'unknown', connectivity: device.connectivity ?? 'unknown', sshReachable: device.sshReachable ?? null }, conditionCodes: conditions, provenanceSource: 'infra-tailscale', now }));
  }
  return observations;
}

export function normalizeDokploy(status, bindings, { now = new Date() } = {}) {
  const targets = bindings.filter((entry) => entry.providerId === 'dokploy');
  if (!status || status.status !== 'ok') return providerFallback(bindings, 'dokploy', status?.status ?? 'unavailable', now, 'infra-dokploy');
  return targets.map((binding) => {
    const unhealthyApps = (status.apps ?? []).filter((app) => !['running', 'done', 'healthy', 'idle'].includes(String(app.status).toLowerCase()));
    const unhealthyCompose = (status.compose ?? []).filter((app) => !['running', 'done', 'healthy', 'idle'].includes(String(app.status).toLowerCase()));
    const conditions = [...(unhealthyApps.length || unhealthyCompose.length ? ['service_unhealthy'] : [])];
    return createObservation({ resourceId: binding.resourceId, providerId: 'dokploy', observedAt: new Date(now).toISOString(), freshnessSeconds: binding.freshnessSeconds, status: conditions.length ? 'degraded' : 'healthy', sourceEntityId: 'provider-summary', metricsSummary: { totalApps: status.totalApps ?? 0, totalCompose: status.totalCompose ?? 0, unhealthyApps: unhealthyApps.length, unhealthyCompose: unhealthyCompose.length, unmappedProviderEntities: [...unhealthyApps, ...unhealthyCompose].map((entry) => `${entry.project}/${entry.environment}/${entry.name}`) }, conditionCodes: conditions, provenanceSource: 'infra-dokploy', now });
  });
}

export function normalizeBackupHealth(schedulerStatus, backupPolicies, bindings, { now = new Date() } = {}) {
  const observations = [];
  for (const binding of bindings.filter((entry) => entry.providerId === 'scheduler')) {
    const job = (schedulerStatus?.jobs ?? []).find((candidate) => binding.selector.names.includes(candidate.key));
    const policy = (backupPolicies ?? []).find((candidate) => candidate.backupJobId === binding.resourceId);
    if (!schedulerStatus || schedulerStatus.status !== 'ok' || !job) {
      observations.push(createObservation({ resourceId: binding.resourceId, providerId: 'scheduler', observedAt: new Date(now).toISOString(), freshnessSeconds: binding.freshnessSeconds, providerState: schedulerStatus?.status ?? 'unavailable', status: 'unknown', metricsSummary: { expectedCadence: policy?.cadence ?? null, retention: policy?.retentionRef ?? null, storageDestination: policy?.destinationRef ?? null, restoreLastVerified: null, restoreVerificationAgeSeconds: null }, conditionCodes: ['backup_state_unknown'], provenanceSource: 'infra-office-scheduler', now }));
      continue;
    }
    const conditions = [];
    if (job.status === 'failed' || job.status === 'timeout') conditions.push('backup_failed');
    const lastAttempt = job.lastRunAt ?? null;
    const lastSuccess = job.status === 'success' ? job.lastRunAt ?? null : null;
    const lastFailure = job.status === 'failed' || job.status === 'timeout' ? job.lastRunAt ?? null : null;
    const ageSeconds = lastAttempt ? Math.max(0, Math.floor((new Date(now).getTime() - Date.parse(lastAttempt)) / 1000)) : null;
    if (ageSeconds === null || ageSeconds > binding.freshnessSeconds) conditions.push('backup_stale');
    if (policy?.restoreVerificationCadenceDays == null) conditions.push('restore_verification_unknown');
    const state = conditions.includes('backup_failed') ? 'unhealthy' : conditions.length ? 'degraded' : 'healthy';
    observations.push(createObservation({ resourceId: binding.resourceId, providerId: 'scheduler', observedAt: lastAttempt ?? new Date(now).toISOString(), freshnessSeconds: binding.freshnessSeconds, status: state, sourceEntityId: job.key, metricsSummary: { lastAttempt, lastSuccess, lastFailure, ageSeconds, expectedCadence: policy?.cadence ?? null, retention: policy?.retentionRef ?? null, storageDestination: policy?.destinationRef ?? null, restoreLastVerified: null, restoreVerificationAgeSeconds: null, exitCode: job.exitCode ?? null }, conditionCodes: conditions, provenanceSource: 'infra-office-scheduler', now }));
  }
  return observations;
}

export function normalizeAccessHealth(entries, bindings, { now = new Date() } = {}) {
  return (entries ?? []).flatMap((entry) => {
    const binding = bindings.find((candidate) => candidate.providerId === 'access-health' && candidate.resourceId === entry.resourceId);
    if (!binding) return [];
    const conditions = [];
    if (!entry.configured) conditions.push('credential_not_configured');
    if (entry.configured && entry.connected === false) conditions.push('credential_probe_failed');
    if (entry.expiryKnown && entry.expiresAt && Date.parse(entry.expiresAt) <= new Date(now).getTime()) conditions.push('credential_expired');
    else if (entry.expiryKnown && entry.rotationDueAt && Date.parse(entry.rotationDueAt) <= new Date(now).getTime()) conditions.push('credential_expiring');
    const state = conditions.includes('credential_expired') || conditions.includes('credential_probe_failed') ? 'unhealthy' : conditions.length ? 'degraded' : entry.connected === true ? 'healthy' : 'unknown';
    return [createObservation({ resourceId: binding.resourceId, providerId: 'access-health', observedAt: entry.lastVerifiedAt ?? new Date(now).toISOString(), freshnessSeconds: binding.freshnessSeconds, providerState: entry.verificationStatus === 'unavailable' ? 'unavailable' : 'ok', status: state, sourceEntityId: entry.resourceId, metricsSummary: { configured: Boolean(entry.configured), connected: entry.connected ?? null, expiresAt: entry.expiresAt ?? null, expiryKnown: Boolean(entry.expiryKnown), rotationDueAt: entry.rotationDueAt ?? null, lastVerifiedAt: entry.lastVerifiedAt ?? null, scopeSummary: entry.scopeSummary ?? [], verificationStatus: entry.verificationStatus ?? 'unknown' }, conditionCodes: conditions, provenanceSource: 'access-health', now })];
  });
}



export function normalizeCloudflareDomains(status, bindings, { now = new Date() } = {}) {
  const domainBindings = bindings.filter((entry) => entry.providerId === 'cloudflare-domain');
  const dnsBindings = bindings.filter((entry) => entry.providerId === 'cloudflare-dns');
  if (!status || status.status !== 'ok') {
    return [
      ...providerFallback(domainBindings, 'cloudflare-domain', status?.status ?? 'unavailable', now, 'infra-cloudflare-domains'),
      ...providerFallback(dnsBindings, 'cloudflare-dns', status?.status ?? 'unavailable', now, 'infra-cloudflare-domains'),
    ];
  }

  const observations = [];
  for (const binding of domainBindings) {
    const domain = (status.domains ?? []).find((candidate) => binding.selector.kind === 'domain-name' && binding.selector.names.includes(candidate.name));
    if (!domain) {
      observations.push(createObservation({ resourceId: binding.resourceId, providerId: 'cloudflare-domain', observedAt: new Date(now).toISOString(), freshnessSeconds: binding.freshnessSeconds, status: 'unknown', metricsSummary: { expectedDomains: binding.selector.names, observed: false }, conditionCodes: ['provider_entity_missing'], provenanceSource: 'infra-cloudflare-domains', now }));
      continue;
    }
    const conditions = [];
    if (String(domain.status).toLowerCase() !== 'active') conditions.push('domain_inactive');
    if (typeof domain.daysUntilExpiry === 'number' && domain.daysUntilExpiry <= 0) conditions.push('domain_expired');
    else if (typeof domain.daysUntilExpiry === 'number' && domain.daysUntilExpiry <= 30) conditions.push('domain_expiring');
    const state = conditions.includes('domain_expired') || conditions.includes('domain_inactive') ? 'unhealthy' : conditions.length ? 'degraded' : 'healthy';
    observations.push(createObservation({ resourceId: binding.resourceId, providerId: 'cloudflare-domain', observedAt: new Date(now).toISOString(), freshnessSeconds: binding.freshnessSeconds, status: state, sourceEntityId: domain.name, metricsSummary: { domainStatus: domain.status ?? 'unknown', createdAt: domain.createdAt ?? null, expiresAt: domain.expiresAt ?? null, daysUntilExpiry: domain.daysUntilExpiry ?? null }, conditionCodes: conditions, provenanceSource: 'infra-cloudflare-domains', now }));
  }

  for (const binding of dnsBindings) {
    const records = (status.domains ?? []).flatMap((domain) => domain.dnsRecords ?? []).filter((record) => binding.selector.kind === 'dns-name' && binding.selector.names.includes(record.name));
    if (records.length === 0) {
      observations.push(createObservation({ resourceId: binding.resourceId, providerId: 'cloudflare-dns', observedAt: new Date(now).toISOString(), freshnessSeconds: binding.freshnessSeconds, status: 'unhealthy', metricsSummary: { expectedNames: binding.selector.names, observedRecords: [], driftStatus: 'missing' }, conditionCodes: ['dns_record_missing'], provenanceSource: 'infra-cloudflare-domains', now }));
      continue;
    }
    observations.push(createObservation({ resourceId: binding.resourceId, providerId: 'cloudflare-dns', observedAt: new Date(now).toISOString(), freshnessSeconds: binding.freshnessSeconds, status: 'unknown', sourceEntityId: records[0]?.name ?? null, metricsSummary: { observedRecords: records.map((record) => ({ name: record.name, type: record.type, content: record.content, proxied: record.proxied ?? null })), driftStatus: 'unknown', expectedStateKnown: false }, conditionCodes: ['dns_expected_state_unknown'], provenanceSource: 'infra-cloudflare-domains', now }));
  }

  return observations;
}
