/**
 * GET /api/market?symbol=BTCUSDT
 * 聚合市场数据：ticker + 技术指标 + 情绪
 */

import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, getRequestId } from '@/lib/api-error';
import { calculateAllIndicators } from '@/lib/indicators';
import { getTwitterSentiment } from '@/lib/twitter';
import { ALLOWED_SYMBOLS } from '@/types/analyze';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
    const requestId = getRequestId(request);
    const symbol = request.nextUrl.searchParams.get('symbol');

    if (!symbol || !(ALLOWED_SYMBOLS as readonly string[]).includes(symbol)) {
        return errorResponse(400, 'INVALID_SYMBOL', 'Invalid or missing symbol', requestId);
    }

    try {
        // 并行获取 ticker + klines + twitter
        const [tickerRes, klinesRes, twitterData] = await Promise.allSettled([
            fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`),
            fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=200`),
            getTwitterSentiment(symbol),
        ]);

        // Ticker
        let ticker = null;
        if (tickerRes.status === 'fulfilled' && tickerRes.value.ok) {
            ticker = await tickerRes.value.json();
        }

        // Klines + 技术指标
        let indicators = null;
        if (klinesRes.status === 'fulfilled' && klinesRes.value.ok) {
            const rawKlines = (await klinesRes.value.json()) as [number, string, string, string, string, string, ...unknown[]][];
            const klines = rawKlines.map((k) => ({
                openTime: k[0],
                time: Math.floor(k[0] / 1000),
                open: k[1],
                high: k[2],
                low: k[3],
                close: k[4],
                volume: k[5],
            }));
            const price = parseFloat(klines[klines.length - 1]?.close as string) || 0;
            indicators = calculateAllIndicators(klines, price);
        }

        // Twitter 情绪
        const sentiment = twitterData.status === 'fulfilled' ? twitterData.value : null;

        return NextResponse.json(
            {
                requestId,
                symbol,
                ticker: ticker
                    ? {
                        price: ticker.lastPrice,
                        change24h: ticker.priceChangePercent,
                        high24h: ticker.highPrice,
                        low24h: ticker.lowPrice,
                        volume24h: ticker.volume,
                        quoteVolume24h: ticker.quoteVolume,
                    }
                    : null,
                indicators,
                sentiment,
            },
            {
                headers: {
                    'Cache-Control': 'public, max-age=30',
                    'X-Request-Id': requestId,
                },
            }
        );
    } catch {
        return errorResponse(500, 'INTERNAL_ERROR', 'Failed to fetch market data', requestId);
    }
}
