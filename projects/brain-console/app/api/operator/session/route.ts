import { NextRequest, NextResponse } from 'next/server';
import {
  OPERATOR_LOGIN_BODY_MAX_BYTES,
  OPERATOR_SESSION_COOKIE_NAME,
  createOperatorSession,
  loadOperatorConfiguration,
  operatorSessionCookieOptions,
  operatorSessionResponse,
  operatorLoginAdmission,
  recordOperatorLoginFailure,
  clearOperatorLoginFailures,
  parseOperatorLoginBody,
  serializeOperatorSession,
  verifyOperatorLogin,
  verifyOperatorSession,
} from '@/lib/operator-session-server';
import { operatorSessionAuthenticatedResponseSchema, operatorSessionResponseSchema } from '@/lib/braincore-schemas';
import { loopbackTransport, secureTransport } from '@/lib/operator-request-boundary';

export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set('cache-control', 'no-store');
  response.headers.set('x-content-type-options', 'nosniff');
  return response;
}

async function readLoginBody(request: NextRequest): Promise<unknown | undefined> {
  const contentLength = request.headers.get('content-length');
  if (contentLength && (!/^\d+$/u.test(contentLength) || Number(contentLength) > OPERATOR_LOGIN_BODY_MAX_BYTES)) return undefined;
  const raw = await request.text();
  if (Buffer.byteLength(raw, 'utf8') > OPERATOR_LOGIN_BODY_MAX_BYTES) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!loopbackTransport(request)) return json({ ok: false, error: { code: 'operator_transport_unsupported', message: 'Operator login is supported only from the local Brain Console transport.' } }, 403);
  const body = parseOperatorLoginBody(await readLoginBody(request));
  const configuration = loadOperatorConfiguration();
  if (!body) return json({ ok: false, error: { code: 'operator_login_invalid', message: 'Operator authentication failed.' } }, 400);
  if (!configuration) return json({ ok: false, error: { code: 'operator_auth_unavailable', message: 'Operator authentication is unavailable.' } }, 503);
  if (operatorLoginAdmission(body.operatorId) === 'cooldown') return json({ ok: false, error: { code: 'operator_login_throttled', message: 'Operator authentication failed.' } }, 429);
  if (!verifyOperatorLogin({ body, configuration })) {
    recordOperatorLoginFailure(body.operatorId);
    return json({ ok: false, error: { code: 'operator_login_failed', message: 'Operator authentication failed.' } }, 401);
  }
  clearOperatorLoginFailures(body.operatorId);
  const session = createOperatorSession({ configuration });
  const responseBody = operatorSessionResponse(session);
  if (!operatorSessionAuthenticatedResponseSchema.safeParse(responseBody).success) return json({ ok: false, error: { code: 'operator_session_invalid', message: 'Operator session is unavailable.' } }, 503);
  const response = json(responseBody);
  response.cookies.set({ name: OPERATOR_SESSION_COOKIE_NAME, value: serializeOperatorSession(session, configuration), ...operatorSessionCookieOptions({ secure: secureTransport(request), expiresAt: session.expiresAt, now: session.issuedAt }) });
  return response;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!loopbackTransport(request)) return json({ ok: false, error: { code: 'operator_transport_unsupported', message: 'Operator session is supported only from the local Brain Console transport.' } }, 403);
  const verification = verifyOperatorSession({ token: request.cookies.get(OPERATOR_SESSION_COOKIE_NAME)?.value, configuration: loadOperatorConfiguration() });
  const responseBody = operatorSessionResponse(verification.authenticated ? verification.session : undefined);
  const parsed = operatorSessionResponseSchema.safeParse(responseBody);
  return parsed.success ? json(parsed.data) : json({ ok: false, error: { code: 'operator_session_invalid', message: 'Operator session is unavailable.' } }, 503);
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  if (!loopbackTransport(request)) return json({ ok: false, error: { code: 'operator_transport_unsupported', message: 'Operator session is supported only from the local Brain Console transport.' } }, 403);
  const response = json(operatorSessionResponse(undefined));
  response.cookies.set({ name: OPERATOR_SESSION_COOKIE_NAME, value: '', httpOnly: true, sameSite: 'strict', path: '/api', secure: secureTransport(request), maxAge: 0, expires: new Date(0) });
  return response;
}
