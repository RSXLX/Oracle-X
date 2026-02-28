/**
 * POST /api/analyze
 * 加密货币交易风险评估 API
 */

import { NextRequest } from 'next/server';
import { validateAnalyzeRequest } from '@/lib/validators';
import { calculateAllIndicators } from '@/lib/indicators';
import { compressKlinesMulti } from '@/lib/kline-processor';
import { getTwitterSentiment } from '@/lib/twitter';
import { buildSystemPrompt, buildUserPrompt } from '@/lib/prompt-builder';
import { getAIConfig, callAIStream, transformToSSE } from '@/lib/ai-client';
import { errorResponse, getRequestId } from '@/lib/api-error';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';
import { normalizeSymbol } from '@/lib/constants';
import { ProxyAgent, fetch as proxyFetch } from 'undici';

export const runtime = 'nodejs';

const HTTP_PROXY = process.env.HTTP_PROXY || '';
const proxyAgent = HTTP_PROXY ? new ProxyAgent(HTTP_PROXY) : null;
const AI_TIMEOUT_MS = 45000;

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);

  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const limit = checkRateLimit(getClientKey(clientIp, '/api/analyze'), 20, 60_000);
  if (!limit.allowed) {
    return errorResponse(429, 'RATE_LIMITED', 'Too many requests', requestId, 'Rate limit exceeded');
  }

  try {
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

    const { data: requestData } = validation;

    // 标准化 symbol（兼容各平台格式）
    requestData.symbol = normalizeSymbol(requestData.symbol);

    let klines = requestData.marketData.klines || [];
    let klines4h: typeof klines = [];
    let klines1d: typeof klines = [];

    if (klines.length === 0) {
      const symbol = requestData.symbol;
      const urls = {
        '1h': `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=200`,
        '4h': `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=4h&limit=100`,
        '1d': `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=30`,
      };

      const parseKlines = (rawKlines: [number, string, string, string, string, string, ...unknown[]][]) =>
        rawKlines.map((k) => ({
          openTime: k[0],
          time: Math.floor(k[0] / 1000),
          open: k[1],
          high: k[2],
          low: k[3],
          close: k[4],
          volume: k[5],
        }));

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        const fetchUrl = (url: string) =>
          proxyAgent
            ? proxyFetch(url, { signal: controller.signal, dispatcher: proxyAgent })
            : fetch(url, { signal: controller.signal });

        const [res1h, res4h, res1d] = await Promise.allSettled([
          fetchUrl(urls['1h']),
          fetchUrl(urls['4h']),
          fetchUrl(urls['1d']),
        ]);
        clearTimeout(timeoutId);

        if (res1h.status === 'fulfilled' && res1h.value.ok) {
          const raw = (await res1h.value.json()) as [number, string, string, string, string, string, ...unknown[]][];
          klines = parseKlines(raw);
        }

        if (res4h.status === 'fulfilled' && res4h.value.ok) {
          const raw = (await res4h.value.json()) as [number, string, string, string, string, string, ...unknown[]][];
          klines4h = parseKlines(raw);
        }

        if (res1d.status === 'fulfilled' && res1d.value.ok) {
          const raw = (await res1d.value.json()) as [number, string, string, string, string, string, ...unknown[]][];
          klines1d = parseKlines(raw);
        }
      } catch {
        // 忽略K线拉取失败，继续用已有数据
      }
    }

    const currentPrice =
      parseFloat(requestData.marketData.price) ||
      (klines.length > 0 ? parseFloat(klines[klines.length - 1].close as string) : 0);

    const [klineSummary, twitterSentiment] = await Promise.all([
      klines.length > 0 ? compressKlinesMulti(klines, klines4h, klines1d) : null,
      getTwitterSentiment(requestData.symbol),
    ]);

    requestData.marketData.twitterSentiment = twitterSentiment;
    const indicators = calculateAllIndicators(klines, currentPrice);

    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(requestData, klineSummary, indicators);

    const config = getAIConfig();
    if (!config.apiKey) {
      return errorResponse(500, 'AI_API_KEY_MISSING', 'AI service unavailable', requestId, 'API key not configured');
    }

    let aiResponse: Response;
    try {
      aiResponse = await Promise.race([
        callAIStream(systemPrompt, userPrompt, config),
        new Promise<Response>((_, reject) =>
          setTimeout(() => reject(new Error('AI upstream timeout')), AI_TIMEOUT_MS)
        ),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return errorResponse(500, 'AI_UPSTREAM_ERROR', 'AI service unavailable', requestId, message);
    }

    const sseStream = transformToSSE(aiResponse);

    return new Response(sseStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Request-Id': requestId,
      },
    });
  } catch {
    return errorResponse(500, 'INTERNAL_ERROR', 'Internal server error', requestId);
  }
}

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Method not allowed', requestId);
}
