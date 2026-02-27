/**
 * POST /api/trade/history
 * 接收交易历史 CSV 文本，返回交易习惯分析
 */

import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, getRequestId } from '@/lib/api-error';

export const runtime = 'nodejs';

interface TradeRecord {
    symbol: string;
    side: string;
    price: number;
    quantity: number;
    timestamp: string;
}

function parseCSVText(csv: string): TradeRecord[] {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return [];

    const header = lines[0].toLowerCase();
    const records: TradeRecord[] = [];

    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
        if (cols.length < 4) continue;

        // 智能列映射（兼容 Binance/OKX/通用格式）
        let symbol = '', side = '', price = 0, quantity = 0, timestamp = '';

        if (header.includes('pair') || header.includes('symbol') || header.includes('交易对')) {
            const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ''));
            const sIdx = headers.findIndex((h) => h.includes('symbol') || h.includes('pair') || h.includes('交易对'));
            const dIdx = headers.findIndex((h) => h.includes('side') || h.includes('type') || h.includes('方向'));
            const pIdx = headers.findIndex((h) => h.includes('price') || h.includes('价格'));
            const qIdx = headers.findIndex((h) => h.includes('quantity') || h.includes('amount') || h.includes('数量'));
            const tIdx = headers.findIndex((h) => h.includes('time') || h.includes('date') || h.includes('时间'));

            symbol = sIdx >= 0 ? cols[sIdx] : cols[0];
            side = dIdx >= 0 ? cols[dIdx] : cols[1];
            price = pIdx >= 0 ? parseFloat(cols[pIdx]) : parseFloat(cols[2]);
            quantity = qIdx >= 0 ? parseFloat(cols[qIdx]) : parseFloat(cols[3]);
            timestamp = tIdx >= 0 ? cols[tIdx] : cols[4] || '';
        } else {
            symbol = cols[0];
            side = cols[1];
            price = parseFloat(cols[2]);
            quantity = parseFloat(cols[3]);
            timestamp = cols[4] || '';
        }

        if (symbol && !isNaN(price) && price > 0) {
            records.push({ symbol, side, price, quantity, timestamp });
        }
    }

    return records;
}

function analyzeTradeHistory(records: TradeRecord[]) {
    const symbols = new Map<string, number>();
    let buyCount = 0, sellCount = 0;
    let totalVolume = 0;

    for (const r of records) {
        symbols.set(r.symbol, (symbols.get(r.symbol) || 0) + 1);
        if (r.side.toLowerCase().includes('buy') || r.side.includes('买')) {
            buyCount++;
        } else {
            sellCount++;
        }
        totalVolume += r.price * r.quantity;
    }

    const topSymbols = Array.from(symbols.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([symbol, count]) => ({ symbol, trades: count }));

    // 交易风格判定
    let style = '均衡型';
    if (records.length > 100) style = '高频交易者';
    else if (symbols.size <= 2) style = '专注型';
    else if (symbols.size > 10) style = '分散型';

    const riskLevel = symbols.size <= 1 ? 'high' : symbols.size <= 3 ? 'medium' : 'low';

    return {
        stats: {
            totalTrades: records.length,
            buyCount,
            sellCount,
            uniqueSymbols: symbols.size,
            totalVolume: Math.round(totalVolume * 100) / 100,
        },
        topSymbols,
        style,
        concentration: {
            riskLevel,
            description: riskLevel === 'high' ? '集中度过高，建议分散' : riskLevel === 'medium' ? '适度集中' : '良好分散',
        },
    };
}

export async function POST(request: NextRequest) {
    const requestId = getRequestId(request);

    let body: { csv?: string };
    try {
        body = await request.json();
    } catch {
        return errorResponse(400, 'INVALID_JSON', 'Invalid JSON body', requestId);
    }

    if (!body.csv || typeof body.csv !== 'string') {
        return errorResponse(400, 'MISSING_CSV', 'Missing csv field', requestId, 'Body must contain a "csv" string field');
    }

    if (body.csv.length > 2_000_000) {
        return errorResponse(400, 'CSV_TOO_LARGE', 'CSV too large', requestId, 'Max 2MB');
    }

    const records = parseCSVText(body.csv);
    if (records.length === 0) {
        return errorResponse(400, 'NO_RECORDS', 'No valid records found', requestId);
    }

    const analysis = analyzeTradeHistory(records);

    return NextResponse.json(
        { requestId, ...analysis },
        { headers: { 'X-Request-Id': requestId, 'Cache-Control': 'no-store' } }
    );
}
