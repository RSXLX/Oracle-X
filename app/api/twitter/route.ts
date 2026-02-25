import { NextRequest, NextResponse } from 'next/server';
import { getTwitterSentiment } from '@/lib/twitter';
import { errorResponse, getRequestId } from '@/lib/api-error';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const symbol = request.nextUrl.searchParams.get('symbol') || 'BTCUSDT';

  if (!process.env.RAPIDAPI_KEY) {
    return errorResponse(500, 'RAPIDAPI_KEY_MISSING', 'RapidAPI key not configured', requestId);
  }

  try {
    const result = await getTwitterSentiment(symbol);

    if (!result) {
      return errorResponse(502, 'TWITTER_UPSTREAM_ERROR', 'Failed to fetch Twitter data', requestId);
    }

    return NextResponse.json(result, {
      headers: {
        'X-Request-Id': requestId,
      },
    });
  } catch {
    return errorResponse(500, 'INTERNAL_ERROR', 'Failed to fetch Twitter data', requestId);
  }
}
