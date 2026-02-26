import { NextRequest, NextResponse } from 'next/server';
import { readDecisionLogs } from '@/lib/decision-log';
import { errorResponse, getRequestId } from '@/lib/api-error';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const limitRaw = request.nextUrl.searchParams.get('limit') || '50';
  const limit = Number.parseInt(limitRaw, 10);

  if (Number.isNaN(limit) || limit < 1 || limit > 500) {
    return errorResponse(400, 'INVALID_LIMIT', 'Invalid parameters', requestId, 'limit must be between 1 and 500');
  }

  const rows = readDecisionLogs(limit);

  return NextResponse.json(
    {
      count: rows.length,
      items: rows,
      requestId,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
        'X-Request-Id': requestId,
      },
    }
  );
}
