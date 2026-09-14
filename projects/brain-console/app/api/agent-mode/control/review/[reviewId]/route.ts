import { NextRequest, NextResponse } from 'next/server';
import { handleReviewControl } from '@/lib/operator-control-server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, context: { params: Promise<{ reviewId: string }> }): Promise<NextResponse> {
  const { reviewId } = await context.params;
  return handleReviewControl(request, reviewId);
}
