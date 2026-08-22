import { z } from 'zod';

const provenanceSchema = z.object({
  sourceRef: z.string().optional(),
  classification: z.string().optional(),
  verifiedAt: z.string().optional(),
  freshnessDeadline: z.string().optional(),
  owner: z.string().optional(),
}).passthrough().nullable().optional();

export const infrastructureResourceSchema = z.object({
  resourceId: z.string(),
  resourceClass: z.string(),
  name: z.string(),
  lifecycleState: z.string(),
  owner: z.string().optional(),
  attributes: z.record(z.unknown()).optional(),
  provenance: provenanceSchema,
  freshness: z.enum(['fresh', 'stale', 'unknown']),
}).passthrough();

const infrastructureRelationSchema = z.object({
  relationId: z.string().optional(),
  sourceId: z.string(),
  targetId: z.string(),
  relationType: z.string(),
  freshness: z.enum(['fresh', 'stale', 'unknown']).optional(),
}).passthrough();

const infrastructureBackupPolicySchema = z.object({
  policyId: z.string().optional(),
  resourceId: z.string().optional(),
  backupSystemId: z.string().optional(),
  backupJobId: z.string().optional(),
  cadence: z.string(),
  retentionRef: z.string(),
  destinationRef: z.string().optional(),
  recoveryClass: z.string().optional(),
  freshness: z.enum(['fresh', 'stale', 'unknown']).optional(),
}).passthrough();

const infrastructureCredentialSchema = z.object({
  credentialRefId: z.string(),
  providerRef: z.string().nullable(),
  purpose: z.string().nullable(),
  variableNames: z.array(z.string()),
  scopes: z.array(z.string()),
  expiryKnown: z.boolean(),
  expiresAt: z.string().nullable(),
  lastVerifiedAt: z.string().nullable(),
  freshness: z.enum(['fresh', 'stale', 'unknown']),
}).passthrough();

export const infrastructureStatusSchema = z.object({
  schemaVersion: z.string(),
  catalog: z.object({
    catalogVersion: z.string().nullable(),
    resources: z.array(infrastructureResourceSchema),
    serviceBindings: z.array(z.record(z.unknown())),
  }).passthrough(),
  topology: z.object({
    catalogVersion: z.string().nullable(),
    resourceIds: z.array(z.string()),
    relations: z.array(infrastructureRelationSchema),
  }).passthrough(),
  health: z.object({
    runtimeState: z.enum(['ok', 'missing', 'invalid']),
    observations: z.array(z.record(z.unknown())),
    policies: z.array(z.record(z.unknown())),
  }).passthrough(),
  incidents: z.object({
    runtimeState: z.enum(['ok', 'missing', 'invalid']),
    incidents: z.array(z.record(z.unknown())),
  }).passthrough(),
  backups: z.object({
    backupPolicies: z.array(infrastructureBackupPolicySchema),
  }).passthrough(),
  credentials: z.object({
    credentialReferences: z.array(infrastructureCredentialSchema),
    containsSecrets: z.literal(false),
  }).passthrough(),
  safety: z.object({
    executionEnabled: z.literal(false),
    executionPerformed: z.literal(false),
    actualEffects: z.array(z.unknown()).length(0),
    safetyPolicies: z.array(z.record(z.unknown())),
  }).passthrough(),
  actionReceipts: z.object({
    runtimeState: z.enum(['ok', 'missing', 'invalid']),
    receipts: z.array(z.record(z.unknown())),
    executionEnabled: z.literal(false),
  }).passthrough(),
  doctor: z.object({
    catalogVersion: z.string().nullable(),
    readOnly: z.literal(true),
    executionEnabled: z.literal(false),
    counts: z.object({
      resources: z.number(),
      relations: z.number(),
      serviceBindings: z.number(),
      healthPolicies: z.number(),
      safetyPolicies: z.number(),
      backupPolicies: z.number(),
      credentialReferences: z.number(),
      observations: z.number(),
      activeIncidents: z.number(),
      actionReceipts: z.number(),
      unknownBackups: z.number(),
      unknownCredentialExpiry: z.number(),
    }),
    freshness: z.object({
      fresh: z.number(),
      stale: z.number(),
      unknown: z.number(),
    }),
    runtime: z.object({
      health: z.enum(['ok', 'missing', 'invalid']),
      incidents: z.enum(['ok', 'missing', 'invalid']),
      actionReceipts: z.enum(['ok', 'missing', 'invalid']),
    }),
    unknowns: z.array(z.string()),
  }).passthrough(),
});

export type InfrastructureStatus = z.infer<typeof infrastructureStatusSchema>;
