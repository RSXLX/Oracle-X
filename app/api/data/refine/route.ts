/**
 * POST /api/data/refine
 * 多源数据聚合 — 接收 symbol，返回 K线+指标+情绪+NoFOMO 综合数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, getRequestId } from '@/lib/api-error';
import { calculateAllIndicators } from '@/lib/indicators';
import { compressKlinesMulti } from '@/lib/kline-processor';
import { getTwitterSentiment } from '@/lib/twitter';
import { evaluateNoFomo } from '@/lib/no-fomo';
import { ALLOWED_SYMBOLS } from '@/types/analyze';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    const requestId = getRequestId(request);

    let body: { symbol?: string; direction?: string; fearGreedIndex?: number };
    try {
        body = await request.json();
    } catch {
        return errorResponse(400, 'INVALID_JSON', 'Invalid JSON body', requestId);
    }

    const symbol = body.symbol;
    if (!symbol || !(ALLOWED_SYMBOLS as readonly string[]).includes(symbol)) {
        return errorResponse(400, 'INVALID_SYMBOL', 'Invalid or missing symbol', requestId);
    }

    try {
        // 并行获取 ticket + 多周期 K 线 + Twitter
        const [tickerRes, klines1hRes, klines4hRes, klines1dRes, twitterData] = await Promise.allSettled([
            fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`),
            fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=200`),
            fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=4h&limit=100`),
            fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=30`),
            getTwitterSentiment(symbol),
        ]);

        // 解析 ticker
        let ticker = null;
        let change24h = 0;
        if (tickerRes.status === 'fulfilled' && tickerRes.value.ok) {
            ticker = await tickerRes.value.json();
            change24h = parseFloat(ticker.priceChangePercent || '0');
        }

        // 解析多周期 K 线
        const parseKlines = (res: PromiseSettledResult<Response>) => {
            if (res.status !== 'fulfilled' || !res.value.ok) return [];
            return res.value.json().then((raw: [number, string, string, string, string, string, ...unknown[]][]) =>
                raw.map((k) => ({
                    openTime: k[0], time: Math.floor(k[0] / 1000),
                    open: k[1], high: k[2], low: k[3], close: k[4], volume: k[5],
                }))
            );
        };

        const [klines1h, klines4h, klines1d] = await Promise.all([
            parseKlines(klines1hRes),
            parseKlines(klines4hRes),
            parseKlines(klines1dRes),
        ]);

        // 技术指标
        const currentPrice = klines1h.length > 0
            ? parseFloat(klines1h[klines1h.length - 1].close as string) || 0
            : ticker ? parseFloat(ticker.lastPrice) : 0;
        const indicators = klines1h.length > 0 ? calculateAllIndicators(klines1h, currentPrice) : null;

        // K线压缩摘要
        const klineSummary = klines1h.length > 0 ? await compressKlinesMulti(klines1h, klines4h, klines1d) : null;

        // Twitter 情绪
        const sentiment = twitterData.status === 'fulfilled' ? twitterData.value : null;

        // NoFOMO 评估
        const noFomo = evaluateNoFomo({
            change24h,
            fearGreedIndex: body.fearGreedIndex ?? null,
            twitterSentiment: sentiment?.overallSentiment || null,
            twitterConfidence: sentiment?.confidencePercent || null,
        });

        return NextResponse.json(
            {
                requestId,
                symbol,
                ticker: ticker ? {
                    price: ticker.lastPrice,
                    change24h: ticker.priceChangePercent,
                    high24h: ticker.highPrice,
                    low24h: ticker.lowPrice,
                    volume24h: ticker.volume,
                } : null,
                indicators,
                klineSummary,
                sentiment,
                noFomo,
            },
            { headers: { 'X-Request-Id': requestId, 'Cache-Control': 'no-store' } }
        );
    } catch {
        return errorResponse(500, 'INTERNAL_ERROR', 'Data refinement failed', requestId);
    }
}
