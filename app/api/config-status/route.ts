import { NextResponse } from 'next/server';
import { getRuntimeConfigStatus } from '@/lib/env';

export const runtime = 'nodejs';

export async function GET() {
  const status = getRuntimeConfigStatus();
  return NextResponse.json(status, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
