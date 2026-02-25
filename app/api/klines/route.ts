import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, getRequestId } from '@/lib/api-error';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';

const BINANCE_API_BASE = 'https://api.binance.com/api/v3';
const ALLOWED_INTERVALS = new Set(['1m', '5m', '15m', '30m', '1h', '4h', '1d']);

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol');
  const interval = searchParams.get('interval');
  const limitRaw = searchParams.get('limit') || '100';

  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const limitState = checkRateLimit(getClientKey(clientIp, '/api/klines'), 120, 60_000);
  if (!limitState.allowed) {
    return errorResponse(429, 'RATE_LIMITED', 'Too many requests', requestId, 'Rate limit exceeded');
  }

  if (!symbol || !interval) {
    return errorResponse(400, 'INVALID_PARAMETERS', 'Missing parameters', requestId, 'symbol and interval are required');
  }

  if (!ALLOWED_INTERVALS.has(interval)) {
    return errorResponse(400, 'INVALID_INTERVAL', 'Invalid parameters', requestId, 'Unsupported interval');
  }

  const limit = Number.parseInt(limitRaw, 10);
  if (Number.isNaN(limit) || limit < 1 || limit > 500) {
    return errorResponse(400, 'INVALID_LIMIT', 'Invalid parameters', requestId, 'limit must be between 1 and 500');
  }

  try {
    const res = await fetch(
      `${BINANCE_API_BASE}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
      { headers: { 'Content-Type': 'application/json' }, cache: 'no-store' }
    );

    if (!res.ok) {
      return errorResponse(502, 'UPSTREAM_ERROR', 'Failed to fetch data', requestId, `Binance API error: ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data, {
      headers: {
        'X-Request-Id': requestId,
      },
    });
  } catch {
    return errorResponse(500, 'INTERNAL_ERROR', 'Failed to fetch data', requestId);
  }
}
