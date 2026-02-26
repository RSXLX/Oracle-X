import { NextRequest, NextResponse } from 'next/server';
import { validateAnalyzeRequest } from '@/lib/validators';
import { errorResponse, getRequestId } from '@/lib/api-error';
import { evaluateNoFomo } from '@/lib/no-fomo';
import { appendDecisionLog } from '@/lib/decision-log';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, 'INVALID_JSON', 'Invalid parameters', requestId, 'Invalid JSON body');
  }

  const validation = validateAnalyzeRequest(body);
  if (!validation.valid) {
    return errorResponse(400, 'INVALID_PARAMETERS', validation.error.error, requestId, validation.error.detail);
  }

  const data = validation.data;
  const change24h = Number.parseFloat(data.marketData.change24h || '0');

  const decision = evaluateNoFomo({
    change24h: Number.isNaN(change24h) ? 0 : change24h,
    fearGreedIndex: data.marketData.fearGreedIndex,
    twitterSentiment: data.marketData.twitterSentiment?.overallSentiment || null,
    twitterConfidence: data.marketData.twitterSentiment?.confidencePercent || null,
  });

  try {
    appendDecisionLog({
      requestId,
      symbol: data.symbol,
      direction: data.direction,
      decision,
      marketData: {
        price: data.marketData.price,
        change24h: data.marketData.change24h,
        fearGreedIndex: data.marketData.fearGreedIndex,
      },
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to append decision log:', error);
  }

  return NextResponse.json(
    {
      requestId,
      decision,
    },
    {
      headers: {
        'X-Request-Id': requestId,
        'Cache-Control': 'no-store',
      },
    }
  );
}
