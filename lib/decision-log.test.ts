import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { appendDecisionLog, readDecisionLogs } from '@/lib/decision-log';

describe('decision-log storage', () => {
  const originalCwd = process.cwd();
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oraclex-log-test-'));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('appends and reads latest records in reverse order', () => {
    appendDecisionLog({
      requestId: 'r1',
      symbol: 'BTCUSDT',
      direction: 'LONG',
      decision: {
        action: 'WARN',
        impulseScore: 45,
        confidence: 74,
        coolingSeconds: 20,
        reasons: ['test'],
      },
      marketData: {
        price: '68000',
        change24h: '6.2',
        fearGreedIndex: 80,
      },
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    appendDecisionLog({
      requestId: 'r2',
      symbol: 'ETHUSDT',
      direction: 'SHORT',
      decision: {
        action: 'ALLOW',
        impulseScore: 10,
        confidence: 68,
        coolingSeconds: 0,
        reasons: ['ok'],
      },
      marketData: {
        price: '3100',
        change24h: '1.2',
        fearGreedIndex: 52,
      },
      createdAt: '2026-01-01T00:01:00.000Z',
    });

    const rows = readDecisionLogs(10);
    expect(rows).toHaveLength(2);
    expect(rows[0].requestId).toBe('r2');
    expect(rows[1].requestId).toBe('r1');
  });

  it('clamps read limit', () => {
    appendDecisionLog({
      requestId: 'x',
      symbol: 'BTCUSDT',
      direction: 'LONG',
      decision: {
        action: 'ALLOW',
        impulseScore: 0,
        confidence: 68,
        coolingSeconds: 0,
        reasons: ['ok'],
      },
      marketData: {
        price: '1',
        change24h: '0',
        fearGreedIndex: null,
      },
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    expect(readDecisionLogs(0)).toHaveLength(1);
    expect(readDecisionLogs(9999)).toHaveLength(1);
  });
});
