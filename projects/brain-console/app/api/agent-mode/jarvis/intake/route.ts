import { NextRequest, NextResponse } from 'next/server';
import { brainCoreJarvisIntakeRequest, BrainCoreJarvisIntakeError } from '@/lib/braincore-jarvis-intake-server';
import { admitOperatorMutation } from '@/lib/operator-control-server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ requestId: z.string().min(1).max(128), source: z.enum(['typed', 'voice']), text: z.string().min(1).max(4_000) }).strict();

function errorResponse(code: string, status = 400): NextResponse {
  return NextResponse.json({ ok: false, error: { code, message: 'Jarvis intake is unavailable.' } }, { status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const admission = admitOperatorMutation(request);
  if (!admission.ok) return admission.response;
  const contentLength = request.headers.get('content-length');
  if (contentLength && (!/^\d+$/u.test(contentLength) || Number(contentLength) > 8_192)) return errorResponse('intake_body_too_large', 413);
  let body: unknown;
  try { const text = await request.text(); if (new TextEncoder().encode(text).length > 8_192) return errorResponse('intake_body_too_large', 413); body = JSON.parse(text); } catch { return errorResponse('intake_body_invalid'); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return errorResponse('intake_body_invalid');
  try {
    return NextResponse.json(await brainCoreJarvisIntakeRequest({ ...parsed.data, operatorId: admission.session.operatorId }), { headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
  } catch (error) {
    const code = error instanceof BrainCoreJarvisIntakeError ? error.code : 'intake_request_failed';
    const status = error instanceof BrainCoreJarvisIntakeError && error.status && error.status >= 400 && error.status <= 599 ? error.status : 503;
    return errorResponse(code, status);
  }
}
