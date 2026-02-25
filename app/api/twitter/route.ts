import { NextRequest, NextResponse } from 'next/server';
import { getTwitterSentiment } from '@/lib/twitter';
import { errorResponse, getRequestId } from '@/lib/api-error';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const symbol = request.nextUrl.searchParams.get('symbol') || 'BTCUSDT';

  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const limit = checkRateLimit(getClientKey(clientIp, '/api/twitter'), 30, 60_000);
  if (!limit.allowed) {
    return errorResponse(429, 'RATE_LIMITED', 'Too many requests', requestId, 'Rate limit exceeded');
  }

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
