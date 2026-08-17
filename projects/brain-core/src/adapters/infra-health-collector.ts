import fs from 'node:fs';
import path from 'node:path';

import { getInfraCloudfareDomains } from './infra-cloudflare-domains.js';
import { getInfraCloudflareTunnels } from './infra-cloudflare-tunnels.js';
import { getInfraDokployStatus } from './infra-dokploy.js';
import { getInfraNewRelicStatus } from './infra-new-relic.js';
import { getInfraOfficeScheduler } from './infra-office-scheduler.js';
import { getInfraTailscaleStatus } from './infra-tailscale.js';
import {
  normalizeAccessHealth,
  normalizeBackupHealth,
  normalizeCloudflare,
  normalizeCloudflareDomains,
  normalizeDokploy,
  normalizeNewRelic,
  normalizeTailscale,
} from './infrastructure-provider-normalizers.mjs';
import { writeObservationSnapshot } from './infrastructure-observation-runtime.mjs';

interface ProviderBinding {
  bindingId: string;
  providerId: string;
  resourceId: string;
  selector: { kind: string; names: string[] };
  freshnessSeconds: number;
}

interface AccessReference {
  credentialRefId: string;
  scopes?: string[];
  expiryKnown: boolean;
  expiresAt?: string | null;
  rotateBeforeDays?: number | null;
}

interface CollectorOptions {
  root?: string;
  now?: Date;
  probeSsh?: boolean;
  persist?: boolean;
  maxObservations?: number;
  maxAgeSeconds?: number;
}

function loadJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function resolveRepoRoot(explicitRoot?: string): string {
  if (explicitRoot) return explicitRoot;
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, 'operations', 'infrastructure', 'catalog', 'manifest.v1.json'))) return cwd;
  const candidate = path.resolve(cwd, '../..');
  if (fs.existsSync(path.join(candidate, 'operations', 'infrastructure', 'catalog', 'manifest.v1.json'))) return candidate;
  throw new Error('IKHP repository root not found');
}

function rotationDueAt(reference: AccessReference): string | null {
  if (!reference.expiryKnown || !reference.expiresAt || reference.rotateBeforeDays == null) return null;
  const expiryMs = Date.parse(reference.expiresAt);
  if (!Number.isFinite(expiryMs)) return null;
  return new Date(expiryMs - reference.rotateBeforeDays * 86_400_000).toISOString();
}

export async function collectInfraHealthObservations(options: CollectorOptions = {}) {
  const root = resolveRepoRoot(options.root);
  const now = options.now ?? new Date();
  const bindingsDoc = loadJson<{ bindings: ProviderBinding[] }>(path.join(root, 'operations', 'infrastructure', 'health', 'provider-bindings.v1.json'));
  const assetsDoc = loadJson<{ resources: Array<{ resourceId: string }> }>(path.join(root, 'operations', 'infrastructure', 'catalog', 'assets.v1.json'));
  const backupPoliciesDoc = loadJson<{ backupPolicies: Array<Record<string, unknown>> }>(path.join(root, 'operations', 'infrastructure', 'catalog', 'backup-policies.v1.json'));
  const accessDoc = loadJson<{ credentialReferences: AccessReference[] }>(path.join(root, 'operations', 'infrastructure', 'catalog', 'access-references.v1.json'));
  const resourceIds = new Set(assetsDoc.resources.map((resource) => resource.resourceId));
  const invalidBindings = bindingsDoc.bindings.filter((binding) => !resourceIds.has(binding.resourceId));
  if (invalidBindings.length > 0) {
    throw new Error(`IKHP2 provider bindings reference unknown IKHP1 resources: ${invalidBindings.map((binding) => binding.resourceId).join(', ')}`);
  }

  const [newrelic, cloudflare, cloudflareDomains, dokploy, scheduler, tailscale] = await Promise.all([
    getInfraNewRelicStatus(),
    getInfraCloudflareTunnels(),
    getInfraCloudfareDomains(),
    getInfraDokployStatus(),
    getInfraOfficeScheduler(),
    getInfraTailscaleStatus({ probeSsh: options.probeSsh ?? false }),
  ]);

  const cloudflareAccessStatus: 'ok' | 'not-configured' | 'error' =
    cloudflare.status === 'ok' || cloudflareDomains.status === 'ok'
      ? 'ok'
      : cloudflare.status === 'not-configured' && cloudflareDomains.status === 'not-configured'
        ? 'not-configured'
        : 'error';
  const providerStatus: Record<string, 'ok' | 'not-configured' | 'error'> = {
    newrelic: newrelic.status,
    cloudflare: cloudflareAccessStatus,
    dokploy: dokploy.status,
  };
  const accessHealth = bindingsDoc.bindings
    .filter((binding) => binding.providerId === 'access-health')
    .map((binding) => {
      const reference = accessDoc.credentialReferences.find((entry) => entry.credentialRefId === binding.resourceId);
      const providerName = binding.selector.names[0] ?? '';
      const status = providerStatus[providerName] ?? 'error';
      return {
        resourceId: binding.resourceId,
        configured: status !== 'not-configured',
        connected: status === 'ok' ? true : status === 'not-configured' ? false : null,
        expiresAt: reference?.expiresAt ?? null,
        expiryKnown: reference?.expiryKnown ?? false,
        rotationDueAt: reference ? rotationDueAt(reference) : null,
        lastVerifiedAt: now.toISOString(),
        scopeSummary: reference?.scopes ?? [],
        verificationStatus: status === 'ok' ? 'verified' : status === 'not-configured' ? 'not-configured' : 'unavailable',
      };
    });

  const observations = [
    ...normalizeNewRelic(newrelic, bindingsDoc.bindings, { now }),
    ...normalizeCloudflare(cloudflare, bindingsDoc.bindings, { now }),
    ...normalizeCloudflareDomains(cloudflareDomains, bindingsDoc.bindings, { now }),
    ...normalizeTailscale(tailscale, bindingsDoc.bindings, { now }),
    ...normalizeDokploy(dokploy, bindingsDoc.bindings, { now }),
    ...normalizeBackupHealth(scheduler, backupPoliciesDoc.backupPolicies, bindingsDoc.bindings, { now }),
    ...normalizeAccessHealth(accessHealth, bindingsDoc.bindings, { now }),
  ];

  const result = {
    schemaVersion: '1.0.0',
    generatedAt: now.toISOString(),
    readOnly: true,
    canonicalCatalogMutated: false,
    providerMutationPerformed: false,
    observations,
    providerStates: {
      newrelic: newrelic.status,
      cloudflare: cloudflare.status,
      cloudflareDomains: cloudflareDomains.status,
      tailscale: tailscale.status,
      dokploy: dokploy.status,
      scheduler: scheduler.status,
    },
  };

  if (options.persist) {
    writeObservationSnapshot(observations, {
      root,
      now,
      ...(options.maxObservations !== undefined ? { maxObservations: options.maxObservations } : {}),
      ...(options.maxAgeSeconds !== undefined ? { maxAgeSeconds: options.maxAgeSeconds } : {}),
    });
  }

  return result;
}

export async function collectAndPersistInfraHealthObservations(options: Omit<CollectorOptions, 'persist'> = {}) {
  return collectInfraHealthObservations({ ...options, persist: true });
}
