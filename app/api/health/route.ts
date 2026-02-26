import { NextResponse } from 'next/server';
import { getAIConfig } from '@/lib/ai-client';

export const runtime = 'nodejs';

export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  // AI API key 配置
  const aiConfig = getAIConfig();
  checks.aiKey = {
    ok: Boolean(aiConfig.apiKey),
    detail: aiConfig.apiKey ? `model: ${aiConfig.model}` : 'missing',
  };

  // AI Base URL
  checks.aiBaseUrl = {
    ok: Boolean(aiConfig.baseUrl),
    detail: aiConfig.baseUrl || 'missing',
  };

  // RapidAPI (Twitter)
  checks.rapidApi = {
    ok: Boolean(process.env.RAPIDAPI_KEY),
  };

  // 核心决策日志可写性（通过尝试读取判断）
  try {
    const { readDecisionLogs } = await import('@/lib/decision-log');
    const logs = readDecisionLogs(1);
    checks.decisionLog = { ok: true, detail: `${logs.length} recent` };
  } catch (err) {
    checks.decisionLog = { ok: false, detail: String(err) };
  }

  const allOk = Object.values(checks).every((c) => c.ok);
  const status = allOk ? 200 : 503;

  return NextResponse.json(
    {
      status: allOk ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    },
    { status, headers: { 'Cache-Control': 'no-store' } }
  );
}
