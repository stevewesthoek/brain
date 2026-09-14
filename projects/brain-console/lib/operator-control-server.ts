import 'server-only';

import { createHash } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { brainCoreControlRequest, BrainCoreControlError, type BrainCoreLifecycleControlBody, type BrainCoreReviewControlBody } from './braincore-control-server';
import {
  OPERATOR_CSRF_TOKEN_MAX_LENGTH,
  OPERATOR_SESSION_COOKIE_NAME,
  loadOperatorConfiguration,
  verifyOperatorSession,
  type OperatorSession,
} from './operator-session-server';
import { loopbackTransport, sameOriginRequest } from './operator-request-boundary';

const operatorControlBodySchema = z.object({
  schemaVersion: z.literal('agent-mode-control-v1'),
  operationId: z.string().min(1).max(128),
  reason: z.string().min(1).max(512),
}).strict();

const lifecycleControlBodySchema = operatorControlBodySchema.extend({
  action: z.enum(['pause', 'resume', 'cancel', 'kill']),
}).strict();

const reviewControlBodySchema = operatorControlBodySchema.extend({
  decision: z.enum(['approved', 'rejected']),
  evidenceHash: z.string().min(1).max(256),
}).strict();

const MAX_PROXY_BODY_BYTES = 16_384;
type OperatorAdmission =
  | { ok: true; session: OperatorSession }
  | { ok: false; response: NextResponse };

export type OperatorControlDependencies = {
  controlRequest?: typeof brainCoreControlRequest;
};

function json(body: unknown, status = 200): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set('cache-control', 'no-store');
  response.headers.set('x-content-type-options', 'nosniff');
  return response;
}

function errorResponse(code: string, status: number, message = 'Agent Mode control is unavailable.'): NextResponse {
  return json({ ok: false, error: { code, message } }, status);
}

export function admitOperatorSession(request: NextRequest, requireSameOrigin = false): OperatorAdmission {
  if (!loopbackTransport(request)) return { ok: false, response: errorResponse('operator_transport_unsupported', 403, 'Operator controls are supported only from the local Brain Console transport.') };
  if (requireSameOrigin && !sameOriginRequest(request)) return { ok: false, response: errorResponse('operator_origin_invalid', 403, 'Operator control provenance is invalid.') };
  const configuration = loadOperatorConfiguration();
  const verification = verifyOperatorSession({ token: request.cookies.get(OPERATOR_SESSION_COOKIE_NAME)?.value, configuration });
  if (!verification.authenticated) return { ok: false, response: errorResponse(verification.reason === 'configuration_missing' ? 'operator_auth_unavailable' : 'operator_session_required', verification.reason === 'configuration_missing' ? 503 : 401, 'Authenticated operator session is required.') };
  return { ok: true, session: verification.session };
}

export function admitOperatorMutation(request: NextRequest): OperatorAdmission {
  const admission = admitOperatorSession(request, true);
  if (!admission.ok) return admission;
  const csrf = request.headers.get('x-brain-console-csrf');
  if (!csrf || csrf.length > OPERATOR_CSRF_TOKEN_MAX_LENGTH || csrf !== admission.session.csrfNonce) return { ok: false, response: errorResponse('operator_csrf_invalid', 403, 'Operator control provenance is invalid.') };
  return admission;
}

export function operatorSessionAuditId(session: OperatorSession): string {
  return createHash('sha256').update(`${session.protocolVersion}:${session.sessionId}`, 'utf8').digest('hex');
}

async function readBody(request: NextRequest): Promise<unknown | undefined> {
  const contentLength = request.headers.get('content-length');
  if (contentLength && (!/^\d+$/u.test(contentLength) || Number(contentLength) > MAX_PROXY_BODY_BYTES)) return undefined;
  const raw = await request.text();
  if (Buffer.byteLength(raw, 'utf8') > MAX_PROXY_BODY_BYTES) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function coreErrorResponse(error: unknown): NextResponse {
  if (error instanceof BrainCoreControlError) {
    const status = error.status && error.status >= 400 && error.status <= 599 ? error.status : error.code.startsWith('control_request') || error.code === 'service_identity_unavailable' ? 503 : 400;
    const message = status === 503 ? 'Brain Core control is unavailable.' : 'Brain Core did not apply the requested Agent Mode control.';
    return errorResponse(error.code.slice(0, 128), status, message);
  }
  return errorResponse('control_request_failed', 503);
}

export async function handleLifecycleControl(request: NextRequest, runId: string, dependencies?: OperatorControlDependencies): Promise<NextResponse> {
  const admission = admitOperatorMutation(request);
  if (!admission.ok) return admission.response;
  const body = await readBody(request);
  const parsed = lifecycleControlBodySchema.safeParse(body);
  if (!parsed.success || runId.length === 0 || runId.length > 256 || runId.includes('/')) return errorResponse('control_body_invalid', 400, 'Agent Mode control request is invalid.');
  const controlBody: BrainCoreLifecycleControlBody = { ...parsed.data, operator: { operatorId: admission.session.operatorId, sessionAuditId: operatorSessionAuditId(admission.session) } };
  try {
    return json(await (dependencies?.controlRequest ?? brainCoreControlRequest)({ pathname: `/agent-mode/control/run/${encodeURIComponent(runId)}`, body: controlBody }), 200);
  } catch (error) {
    return coreErrorResponse(error);
  }
}

export async function handleReviewControl(request: NextRequest, reviewId: string, dependencies?: OperatorControlDependencies): Promise<NextResponse> {
  const admission = admitOperatorMutation(request);
  if (!admission.ok) return admission.response;
  const body = await readBody(request);
  const parsed = reviewControlBodySchema.safeParse(body);
  if (!parsed.success || reviewId.length === 0 || reviewId.length > 256 || reviewId.includes('/')) return errorResponse('control_body_invalid', 400, 'Agent Mode control request is invalid.');
  const controlBody: BrainCoreReviewControlBody = { ...parsed.data, operator: { operatorId: admission.session.operatorId, sessionAuditId: operatorSessionAuditId(admission.session) } };
  try {
    return json(await (dependencies?.controlRequest ?? brainCoreControlRequest)({ pathname: `/agent-mode/control/review/${encodeURIComponent(reviewId)}`, body: controlBody }), 200);
  } catch (error) {
    return coreErrorResponse(error);
  }
}
