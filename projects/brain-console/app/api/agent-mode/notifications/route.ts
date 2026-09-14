import { NextRequest, NextResponse } from 'next/server';
import { BrainCoreAttentionError, brainCoreAttentionRequest } from '@/lib/braincore-attention-server';
import { admitOperatorSession } from '@/lib/operator-control-server';

export const dynamic = 'force-dynamic';

function errorResponse(error: unknown): NextResponse {
  const code = error instanceof BrainCoreAttentionError ? error.code : 'attention_request_failed';
  const status = error instanceof BrainCoreAttentionError && error.status && error.status >= 400 && error.status <= 599 ? error.status : 503;
  return NextResponse.json({ ok: false, error: { code, message: 'Agent Mode attention is unavailable.' } }, { status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const admission = admitOperatorSession(request);
  if (!admission.ok) return admission.response;
  try {
    return NextResponse.json(await brainCoreAttentionRequest(admission.session.operatorId), { headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
  } catch (error) {
    return errorResponse(error);
  }
}
