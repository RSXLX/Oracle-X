/**
 * POST /api/recognize
 * 交易截图视觉识别 API
 */

import { NextRequest } from 'next/server';
import { getVisionConfig, callVisionAI } from '@/lib/ai-client';
import { errorResponse, getRequestId } from '@/lib/api-error';

export const runtime = 'edge';

interface RecognizeResult {
  platform: string | null;
  pair: string | null;
  trade_type: 'spot' | 'perpetual' | 'futures' | null;
  direction_hint: 'long' | 'short' | null;
  confidence: number;
}

const RECOGNIZE_PROMPT = `你是一个专业的交易界面识别专家。请分析这张交易平台截图，提取以下信息：

1. **平台** (platform): 识别交易平台名称，如 Binance、OKX、Bybit、Coinbase、Uniswap 等
2. **交易对** (pair): 识别正在查看的交易对，如 BTC/USDT、ETH/USDT 等
3. **交易类型** (trade_type): 判断是现货(spot)、永续合约(perpetual)还是交割合约(futures)
4. **方向提示** (direction_hint): 如果界面上有明显的做多/做空按钮被选中或价格走势暗示，给出方向提示

请严格按以下 JSON 格式输出（不要添加任何其他文字）：
{
  "platform": "平台名称",
  "pair": "交易对（格式：BASE/QUOTE）",
  "trade_type": "spot|perpetual|futures",
  "direction_hint": "long|short|null",
  "confidence": 0-100之间的置信度
}

如果无法识别某个字段，使用 null。`;

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);

  try {
    let body: { image?: string };
    try {
      body = await request.json();
    } catch {
      return errorResponse(400, 'INVALID_JSON', 'Invalid parameters', requestId, 'Invalid JSON body');
    }

    if (!body.image || typeof body.image !== 'string') {
      return errorResponse(400, 'INVALID_PARAMETERS', 'Invalid parameters', requestId, 'Missing or invalid image field');
    }

    if (body.image.length > 15 * 1024 * 1024) {
      return errorResponse(400, 'IMAGE_TOO_LARGE', 'Invalid parameters', requestId, 'Image too large (max 10MB)');
    }

    const config = getVisionConfig();
    if (!config.apiKey) {
      return errorResponse(500, 'AI_API_KEY_MISSING', 'AI service unavailable', requestId, 'API key not configured');
    }

    let aiResponse: string;
    try {
      aiResponse = await callVisionAI(body.image, RECOGNIZE_PROMPT, config);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return errorResponse(500, 'AI_UPSTREAM_ERROR', 'AI service unavailable', requestId, message);
    }

    let result: RecognizeResult;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch {
      result = {
        platform: null,
        pair: null,
        trade_type: null,
        direction_hint: null,
        confidence: 0,
      };
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
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
