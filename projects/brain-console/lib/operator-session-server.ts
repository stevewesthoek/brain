import 'server-only';

import { createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

export const OPERATOR_SESSION_PROTOCOL_VERSION = 'brain-console-operator-v1' as const;
export const OPERATOR_SESSION_COOKIE_NAME = 'brain_console_operator_v1';
export const OPERATOR_SESSION_COOKIE_PATH = '/api';
export const OPERATOR_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
export const OPERATOR_ID_MAX_LENGTH = 128;
export const OPERATOR_SECRET_MAX_LENGTH = 512;
export const OPERATOR_SESSION_TOKEN_MAX_LENGTH = 4096;
export const OPERATOR_CSRF_TOKEN_MAX_LENGTH = 128;
export const OPERATOR_LOGIN_BODY_MAX_BYTES = 4096;
export const OPERATOR_LOGIN_MAX_FAILURES = 5;
export const OPERATOR_LOGIN_FAILURE_WINDOW_MS = 30_000;
export const OPERATOR_LOGIN_COOLDOWN_MS = 5_000;
const OPERATOR_LOGIN_BUCKET_LIMIT = 256;

type LoginFailureBucket = { failures: number; firstFailureAt: number; lastFailureAt: number; blockedUntil: number };
const loginFailureBuckets = new Map<string, LoginFailureBucket>();

const operatorSessionPayloadSchema = z.object({
  protocolVersion: z.literal(OPERATOR_SESSION_PROTOCOL_VERSION),
  operatorId: z.string().min(1).max(OPERATOR_ID_MAX_LENGTH),
  sessionId: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/u),
  issuedAt: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
  csrfNonce: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/u),
}).strict();

const operatorLoginBodySchema = z.object({
  schemaVersion: z.literal(OPERATOR_SESSION_PROTOCOL_VERSION),
  operatorId: z.string().min(1).max(OPERATOR_ID_MAX_LENGTH),
  operatorSecret: z.string().min(1).max(OPERATOR_SECRET_MAX_LENGTH),
}).strict();

export type OperatorLoginBody = z.infer<typeof operatorLoginBodySchema>;

export type OperatorSession = {
  protocolVersion: typeof OPERATOR_SESSION_PROTOCOL_VERSION;
  operatorId: string;
  sessionId: string;
  issuedAt: number;
  expiresAt: number;
  csrfNonce: string;
};

export type OperatorConfiguration = {
  operatorId: string;
  operatorSecret: string;
};

export type OperatorSessionVerification =
  | { authenticated: true; session: OperatorSession }
  | { authenticated: false; reason: 'configuration_missing' | 'cookie_missing' | 'cookie_invalid' | 'session_expired' };

export class OperatorSessionError extends Error {
  constructor(readonly code: string) {
    super('Operator session is unavailable.');
    this.name = 'OperatorSessionError';
  }
}

function boundedConfigurationValue(value: string | undefined, maxLength: number): string | undefined {
  return value && value.length > 0 && value.length <= maxLength ? value : undefined;
}

export function loadOperatorConfiguration(env: NodeJS.ProcessEnv = process.env): OperatorConfiguration | undefined {
  const operatorId = boundedConfigurationValue(env.BRAIN_CONSOLE_OPERATOR_ID, OPERATOR_ID_MAX_LENGTH);
  const operatorSecret = boundedConfigurationValue(env.BRAIN_CONSOLE_OPERATOR_SECRET, OPERATOR_SECRET_MAX_LENGTH);
  if (!operatorId || !operatorSecret || operatorSecret.length < 16) return undefined;
  return { operatorId, operatorSecret };
}

function purposeKey(secret: string, purpose: string): Buffer {
  return Buffer.from(hkdfSync(
    'sha256',
    Buffer.from(secret, 'utf8'),
    Buffer.from(OPERATOR_SESSION_PROTOCOL_VERSION, 'utf8'),
    Buffer.from(purpose, 'utf8'),
    32,
  ));
}

function timingSafeStringEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, 'utf8');
  const rightBytes = Buffer.from(right, 'utf8');
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function validBase64Url(value: string): boolean {
  return value.length > 0 && /^[A-Za-z0-9_-]+$/u.test(value);
}

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decode(value: string): string | undefined {
  if (!validBase64Url(value)) return undefined;
  try {
    return Buffer.from(value, 'base64url').toString('utf8');
  } catch {
    return undefined;
  }
}

function canonicalPayload(session: OperatorSession): string {
  return JSON.stringify({
    protocolVersion: session.protocolVersion,
    operatorId: session.operatorId,
    sessionId: session.sessionId,
    issuedAt: session.issuedAt,
    expiresAt: session.expiresAt,
    csrfNonce: session.csrfNonce,
  });
}

function signPayload(encodedPayload: string, secret: string): string {
  return createHmac('sha256', purposeKey(secret, 'session-signing'))
    .update(encodedPayload, 'utf8')
    .digest('base64url');
}

function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

export function createOperatorSession(input: { configuration: OperatorConfiguration; now?: number }): OperatorSession {
  const now = input.now ?? Date.now();
  if (!Number.isSafeInteger(now) || now <= 0) throw new OperatorSessionError('session_timestamp_invalid');
  return {
    protocolVersion: OPERATOR_SESSION_PROTOCOL_VERSION,
    operatorId: input.configuration.operatorId,
    sessionId: randomToken(),
    issuedAt: now,
    expiresAt: now + OPERATOR_SESSION_MAX_AGE_SECONDS * 1000,
    csrfNonce: randomToken(),
  };
}

export function serializeOperatorSession(session: OperatorSession, configuration: OperatorConfiguration): string {
  const parsed = operatorSessionPayloadSchema.safeParse(session);
  if (!parsed.success || session.operatorId !== configuration.operatorId) throw new OperatorSessionError('session_payload_invalid');
  const encodedPayload = encode(canonicalPayload(session));
  const token = `${encodedPayload}.${signPayload(encodedPayload, configuration.operatorSecret)}`;
  if (token.length > OPERATOR_SESSION_TOKEN_MAX_LENGTH) throw new OperatorSessionError('session_token_too_large');
  return token;
}

export function verifyOperatorSession(input: { token: string | undefined; configuration: OperatorConfiguration | undefined; now?: number }): OperatorSessionVerification {
  if (!input.configuration) return { authenticated: false, reason: 'configuration_missing' };
  if (!input.token) return { authenticated: false, reason: 'cookie_missing' };
  if (input.token.length > OPERATOR_SESSION_TOKEN_MAX_LENGTH) return { authenticated: false, reason: 'cookie_invalid' };
  const parts = input.token.split('.');
  if (parts.length !== 2 || !validBase64Url(parts[0] ?? '') || !validBase64Url(parts[1] ?? '')) return { authenticated: false, reason: 'cookie_invalid' };
  const encodedPayload = parts[0] ?? '';
  const suppliedSignature = parts[1] ?? '';
  const expectedSignature = signPayload(encodedPayload, input.configuration.operatorSecret);
  if (!timingSafeStringEqual(suppliedSignature, expectedSignature)) return { authenticated: false, reason: 'cookie_invalid' };
  const decodedPayload = decode(encodedPayload);
  if (!decodedPayload || decodedPayload.length > 2048) return { authenticated: false, reason: 'cookie_invalid' };
  let value: unknown;
  try {
    value = JSON.parse(decodedPayload);
  } catch {
    return { authenticated: false, reason: 'cookie_invalid' };
  }
  const parsed = operatorSessionPayloadSchema.safeParse(value);
  if (!parsed.success || !timingSafeStringEqual(parsed.data.operatorId, input.configuration.operatorId)) return { authenticated: false, reason: 'cookie_invalid' };
  const now = input.now ?? Date.now();
  if (!Number.isSafeInteger(now) || parsed.data.expiresAt <= parsed.data.issuedAt || parsed.data.expiresAt - parsed.data.issuedAt > OPERATOR_SESSION_MAX_AGE_SECONDS * 1000 || parsed.data.issuedAt > now + 5 * 60 * 1000) return { authenticated: false, reason: 'cookie_invalid' };
  if (parsed.data.expiresAt <= now) return { authenticated: false, reason: 'session_expired' };
  return { authenticated: true, session: parsed.data };
}

export function parseOperatorLoginBody(value: unknown): OperatorLoginBody | undefined {
  const parsed = operatorLoginBodySchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function verifyOperatorLogin(input: { body: OperatorLoginBody; configuration: OperatorConfiguration | undefined }): boolean {
  if (!input.configuration) return false;
  return timingSafeStringEqual(input.body.operatorId, input.configuration.operatorId)
    && timingSafeStringEqual(input.body.operatorSecret, input.configuration.operatorSecret);
}

function pruneLoginFailureBuckets(now: number): void {
  for (const [key, bucket] of loginFailureBuckets) {
    if (bucket.blockedUntil <= now && now - bucket.lastFailureAt > OPERATOR_LOGIN_FAILURE_WINDOW_MS) loginFailureBuckets.delete(key);
  }
  while (loginFailureBuckets.size > OPERATOR_LOGIN_BUCKET_LIMIT) {
    const oldest = [...loginFailureBuckets.entries()].sort((left, right) => left[1].lastFailureAt - right[1].lastFailureAt)[0];
    if (!oldest) break;
    loginFailureBuckets.delete(oldest[0]);
  }
}

export function operatorLoginAdmission(operatorId: string, now = Date.now()): 'allowed' | 'cooldown' {
  pruneLoginFailureBuckets(now);
  const bucket = loginFailureBuckets.get(operatorId);
  return bucket && bucket.blockedUntil > now ? 'cooldown' : 'allowed';
}

export function recordOperatorLoginFailure(operatorId: string, now = Date.now()): void {
  pruneLoginFailureBuckets(now);
  const previous = loginFailureBuckets.get(operatorId);
  const bucket = previous && now - previous.firstFailureAt <= OPERATOR_LOGIN_FAILURE_WINDOW_MS
    ? { ...previous, failures: previous.failures + 1, lastFailureAt: now }
    : { failures: 1, firstFailureAt: now, lastFailureAt: now, blockedUntil: 0 };
  if (bucket.failures >= OPERATOR_LOGIN_MAX_FAILURES) bucket.blockedUntil = now + OPERATOR_LOGIN_COOLDOWN_MS;
  loginFailureBuckets.set(operatorId, bucket);
  pruneLoginFailureBuckets(now);
}

export function clearOperatorLoginFailures(operatorId: string): void {
  loginFailureBuckets.delete(operatorId);
}

export function operatorSessionCookieOptions(input: { secure: boolean; expiresAt: number; now?: number }): {
  httpOnly: true;
  sameSite: 'strict';
  path: typeof OPERATOR_SESSION_COOKIE_PATH;
  secure: boolean;
  expires: Date;
  maxAge: number;
} {
  const now = input.now ?? Date.now();
  return {
    httpOnly: true,
    sameSite: 'strict',
    path: OPERATOR_SESSION_COOKIE_PATH,
    secure: input.secure,
    expires: new Date(input.expiresAt),
    maxAge: Math.max(0, Math.floor((input.expiresAt - now) / 1000)),
  };
}

export function operatorSessionCsrfToken(session: OperatorSession): string {
  return session.csrfNonce;
}

export function operatorSessionResponse(session: OperatorSession | undefined) {
  return session
    ? { schemaVersion: OPERATOR_SESSION_PROTOCOL_VERSION, authenticated: true as const, operatorId: session.operatorId, expiresAt: new Date(session.expiresAt).toISOString(), csrfToken: session.csrfNonce }
    : { schemaVersion: OPERATOR_SESSION_PROTOCOL_VERSION, authenticated: false as const, operatorId: null, expiresAt: null, csrfToken: null };
}
