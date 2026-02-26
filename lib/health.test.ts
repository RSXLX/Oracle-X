import { NextRequest } from 'next/server';
import { GET } from '@/app/api/health/route';

describe('GET /api/health', () => {
  it('returns health status (healthy or degraded)', async () => {
    const req = new NextRequest('http://localhost/api/health');
    const res = await GET(req);
    // Accept both 200 (healthy) and 503 (degraded) as valid responses
    expect([200, 503]).toContain(res.status);
    const json = await res.json();
    expect(json.status).toBeDefined();
    expect(json.checks).toBeDefined();
  });
});
