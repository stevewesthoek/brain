import { NextRequest, NextResponse } from 'next/server';
import { BrainCoreAttentionError, brainCoreMarkNotificationRead } from '@/lib/braincore-attention-server';
import { admitOperatorMutation } from '@/lib/operator-control-server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, context: { params: Promise<{ notificationId: string }> }): Promise<NextResponse> {
  const admission = admitOperatorMutation(request);
  if (!admission.ok) return admission.response;
  const { notificationId } = await context.params;
  try {
    return NextResponse.json(await brainCoreMarkNotificationRead(notificationId, admission.session.operatorId), { headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
  } catch (error) {
    const code = error instanceof BrainCoreAttentionError ? error.code : 'attention_request_failed';
    const status = error instanceof BrainCoreAttentionError && error.status && error.status >= 400 && error.status <= 599 ? error.status : 503;
    return NextResponse.json({ ok: false, error: { code, message: 'Agent Mode notification was not marked read.' } }, { status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
  }
}
