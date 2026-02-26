import { NextRequest, NextResponse } from 'next/server';
import { readDecisionLogs } from '@/lib/decision-log';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const limitRaw = request.nextUrl.searchParams.get('limit') || '50';
  const limit = Number.parseInt(limitRaw, 10);
  const rows = readDecisionLogs(Number.isNaN(limit) ? 50 : limit);

  return NextResponse.json(
    {
      count: rows.length,
      items: rows,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}
