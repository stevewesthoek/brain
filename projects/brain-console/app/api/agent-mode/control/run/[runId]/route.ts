import { NextRequest, NextResponse } from 'next/server';
import { handleLifecycleControl } from '@/lib/operator-control-server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, context: { params: Promise<{ runId: string }> }): Promise<NextResponse> {
  const { runId } = await context.params;
  return handleLifecycleControl(request, runId);
}
