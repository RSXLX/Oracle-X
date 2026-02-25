import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, getRequestId } from '@/lib/api-error';

const BINANCE_API_BASE = 'https://api.binance.com/api/v3';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol');

  if (!symbol) {
    return errorResponse(400, 'INVALID_PARAMETERS', 'Missing parameters', requestId, 'symbol is required');
  }

  try {
    const res = await fetch(`${BINANCE_API_BASE}/ticker/24hr?symbol=${symbol}`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

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
