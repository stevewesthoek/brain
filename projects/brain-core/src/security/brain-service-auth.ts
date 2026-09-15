import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';

export const BRAIN_SERVICE_AUTH_PROTOCOL_VERSION = 'brain-service-auth-v1' as const;
export const BRAIN_SERVICE_AGENT_MODE_CONTROL_CAPABILITY = 'agent-mode.control' as const;
export const BRAIN_SERVICE_AGENT_MODE_NOTIFICATIONS_CAPABILITY = 'agent-mode.notifications' as const;
export const BRAIN_SERVICE_AGENT_MODE_INTAKE_CAPABILITY = 'agent-mode.intake' as const;
export const BRAIN_SERVICE_AUTH_MAX_CLOCK_SKEW_MS = 60_000;
export const BRAIN_SERVICE_AUTH_MAX_SERVICE_ID_LENGTH = 128;
export const BRAIN_SERVICE_AUTH_MAX_REQUEST_ID_LENGTH = 128;
export const BRAIN_SERVICE_AUTH_MAX_TIMESTAMP_LENGTH = 64;
export const BRAIN_SERVICE_AUTH_MAX_DIGEST_LENGTH = 64;
export const BRAIN_SERVICE_AUTH_MAX_SIGNATURE_LENGTH = 128;

export const BRAIN_SERVICE_AUTH_HEADERS = {
  version: 'x-brain-auth-version',
  serviceId: 'x-brain-service-id',
  requestId: 'x-brain-request-id',
  timestamp: 'x-brain-request-timestamp',
  contentSha256: 'x-brain-content-sha256',
  signature: 'x-brain-signature',
} as const;

export type BrainServiceIdentityConfig = {
  serviceId: string;
  secret: string;
  allowedCapabilities: readonly string[];
};

export type BrainServiceTrustedIdentity = {
  protocolVersion: typeof BRAIN_SERVICE_AUTH_PROTOCOL_VERSION;
  serviceId: string;
  capabilities: readonly string[];
  requestId: string;
  requestTimestamp: string;
};

export type BrainServiceAuthFailureCode =
  | 'service_identity_missing'
  | 'service_identity_unknown'
  | 'service_auth_version_invalid'
  | 'service_request_id_invalid'
  | 'service_timestamp_missing'
  | 'service_timestamp_invalid'
  | 'service_request_expired'
  | 'service_request_not_yet_valid'
  | 'service_content_digest_invalid'
  | 'service_signature_missing'
  | 'service_signature_invalid'
  | 'service_capability_denied';

export type BrainServiceAuthResult =
  | { ok: true; identity: BrainServiceTrustedIdentity }
  | { ok: false; code: BrainServiceAuthFailureCode };

export type BrainServiceAuthRequest = {
  method: string;
  pathname: string;
  headers: IncomingHttpHeaders | Record<string, string | string[] | undefined>;
  now?: string | number | Date;
};

export type BrainServiceAuthenticatorOptions = {
  identities: readonly BrainServiceIdentityConfig[];
  clock?: () => number;
  maxClockSkewMs?: number;
};

function boundedHeader(value: string | undefined, maxLength: number): string | undefined {
  return value && value.length > 0 && value.length <= maxLength ? value : undefined;
}

function headerValue(headers: BrainServiceAuthRequest['headers'], name: string): string | undefined {
  const raw = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw.length === 1 ? raw[0] : undefined;
  return typeof raw === 'string' ? raw : undefined;
}

function safeEqualHex(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, 'utf8');
  const rightBytes = Buffer.from(right, 'utf8');
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function epochMs(value: string | number | Date | undefined): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Date.parse(value);
  return Number.NaN;
}

function validSha256(value: string | undefined): value is string {
  return Boolean(value && value.length === 64 && /^[0-9a-f]{64}$/u.test(value));
}

function validSignature(value: string | undefined): value is string {
  return Boolean(value && value.length === 64 && /^[0-9a-f]{64}$/u.test(value));
}

function validateConfiguredIdentity(identity: BrainServiceIdentityConfig): void {
  if (!boundedHeader(identity.serviceId, BRAIN_SERVICE_AUTH_MAX_SERVICE_ID_LENGTH)) throw new Error('service identity serviceId is invalid');
  if (!identity.secret || identity.secret.length > 512) throw new Error('service identity secret is invalid');
  if (!Array.isArray(identity.allowedCapabilities) || identity.allowedCapabilities.length > 16) throw new Error('service identity capabilities are invalid');
  for (const capability of identity.allowedCapabilities) {
    if (!capability || capability.length > 128 || capability === '*') throw new Error('service identity capability is invalid');
  }
}

function canonicalMaterial(input: {
  protocolVersion: string;
  serviceId: string;
  method: string;
  pathname: string;
  requestId: string;
  timestamp: string;
  contentSha256: string;
}): string {
  return JSON.stringify({
    protocolVersion: input.protocolVersion,
    serviceId: input.serviceId,
    method: input.method.toUpperCase(),
    pathname: input.pathname,
    requestId: input.requestId,
    timestamp: input.timestamp,
    contentSha256: input.contentSha256,
  });
}

export function signBrainServiceRequest(input: {
  serviceId: string;
  secret: string;
  method: string;
  pathname: string;
  requestId: string;
  timestamp: string;
  contentSha256: string;
}): string {
  return createHmac('sha256', input.secret).update(canonicalMaterial({ ...input, protocolVersion: BRAIN_SERVICE_AUTH_PROTOCOL_VERSION })).digest('hex');
}

export function brainServiceContentSha256(body: string | Buffer): string {
  return createHash('sha256').update(body).digest('hex');
}

export function loadBrainServiceIdentityRegistry(env: NodeJS.ProcessEnv = process.env): readonly BrainServiceIdentityConfig[] {
  const serviceId = env.BRAIN_CORE_SERVICE_ID;
  const secret = env.BRAIN_CORE_SERVICE_SECRET;
  if (!serviceId || !secret) return [];
  return [{ serviceId, secret, allowedCapabilities: [BRAIN_SERVICE_AGENT_MODE_CONTROL_CAPABILITY, BRAIN_SERVICE_AGENT_MODE_NOTIFICATIONS_CAPABILITY, BRAIN_SERVICE_AGENT_MODE_INTAKE_CAPABILITY] }];
}

export class BrainServiceAuthenticator {
  private readonly identities: ReadonlyMap<string, BrainServiceIdentityConfig>;
  private readonly clock: () => number;
  private readonly maxClockSkewMs: number;

  constructor(options: BrainServiceAuthenticatorOptions) {
    for (const identity of options.identities) validateConfiguredIdentity(identity);
    const identityMap = new Map<string, BrainServiceIdentityConfig>();
    for (const identity of options.identities) {
      if (identityMap.has(identity.serviceId)) throw new Error(`duplicate service identity: ${identity.serviceId}`);
      identityMap.set(identity.serviceId, identity);
    }
    this.identities = identityMap;
    this.clock = options.clock ?? (() => Date.now());
    this.maxClockSkewMs = options.maxClockSkewMs ?? BRAIN_SERVICE_AUTH_MAX_CLOCK_SKEW_MS;
    if (!Number.isSafeInteger(this.maxClockSkewMs) || this.maxClockSkewMs < 0 || this.maxClockSkewMs > BRAIN_SERVICE_AUTH_MAX_CLOCK_SKEW_MS) throw new Error('service auth clock skew is invalid');
  }

  authenticateRequest(input: BrainServiceAuthRequest, requiredCapability?: string): BrainServiceAuthResult {
    const version = headerValue(input.headers, BRAIN_SERVICE_AUTH_HEADERS.version);
    if (version !== BRAIN_SERVICE_AUTH_PROTOCOL_VERSION) return { ok: false, code: version ? 'service_auth_version_invalid' : 'service_identity_missing' };
    const serviceId = boundedHeader(headerValue(input.headers, BRAIN_SERVICE_AUTH_HEADERS.serviceId), BRAIN_SERVICE_AUTH_MAX_SERVICE_ID_LENGTH);
    if (!serviceId) return { ok: false, code: 'service_identity_missing' };
    const identity = this.identities.get(serviceId);
    if (!identity) return { ok: false, code: 'service_identity_unknown' };
    const requestId = boundedHeader(headerValue(input.headers, BRAIN_SERVICE_AUTH_HEADERS.requestId), BRAIN_SERVICE_AUTH_MAX_REQUEST_ID_LENGTH);
    if (!requestId) return { ok: false, code: 'service_request_id_invalid' };
    const timestamp = boundedHeader(headerValue(input.headers, BRAIN_SERVICE_AUTH_HEADERS.timestamp), BRAIN_SERVICE_AUTH_MAX_TIMESTAMP_LENGTH);
    if (!timestamp) return { ok: false, code: 'service_timestamp_missing' };
    const timestampMs = Date.parse(timestamp);
    if (!Number.isFinite(timestampMs)) return { ok: false, code: 'service_timestamp_invalid' };
    const suppliedNowMs = epochMs(input.now);
    const nowMs = Number.isFinite(suppliedNowMs) ? suppliedNowMs : this.clock();
    if (!Number.isFinite(nowMs)) return { ok: false, code: 'service_timestamp_invalid' };
    const delta = timestampMs - nowMs;
    if (delta > this.maxClockSkewMs) return { ok: false, code: 'service_request_not_yet_valid' };
    if (delta < -this.maxClockSkewMs) return { ok: false, code: 'service_request_expired' };
    const contentSha256 = headerValue(input.headers, BRAIN_SERVICE_AUTH_HEADERS.contentSha256);
    if (!validSha256(contentSha256)) return { ok: false, code: 'service_content_digest_invalid' };
    const signature = headerValue(input.headers, BRAIN_SERVICE_AUTH_HEADERS.signature);
    if (!signature) return { ok: false, code: 'service_signature_missing' };
    if (!validSignature(signature)) return { ok: false, code: 'service_signature_invalid' };
    const expected = signBrainServiceRequest({ serviceId, secret: identity.secret, method: input.method, pathname: input.pathname, requestId, timestamp, contentSha256 });
    if (!safeEqualHex(signature, expected)) return { ok: false, code: 'service_signature_invalid' };
    if (requiredCapability && !identity.allowedCapabilities.includes(requiredCapability)) return { ok: false, code: 'service_capability_denied' };
    return { ok: true, identity: { protocolVersion: BRAIN_SERVICE_AUTH_PROTOCOL_VERSION, serviceId, capabilities: identity.allowedCapabilities, requestId, requestTimestamp: timestamp } };
  }
}

export function createBrainServiceAuthenticator(options: BrainServiceAuthenticatorOptions): BrainServiceAuthenticator {
  return new BrainServiceAuthenticator(options);
}
