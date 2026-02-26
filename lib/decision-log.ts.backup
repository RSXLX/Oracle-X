import fs from 'node:fs';
import path from 'node:path';

export interface DecisionLogItem {
  requestId: string;
  symbol: string;
  direction: string;
  decision: {
    action: 'ALLOW' | 'WARN' | 'BLOCK';
    impulseScore: number;
    confidence: number;
    coolingSeconds: number;
    reasons: string[];
  };
  marketData: {
    price: string;
    change24h: string;
    fearGreedIndex: number | null;
  };
  createdAt: string;
}

function getStorePaths() {
  const dataDir = path.join(process.cwd(), 'data');
  const logFile = path.join(dataDir, 'decision-log.jsonl');
  return { dataDir, logFile };
}

function ensureStore() {
  const { dataDir, logFile } = getStorePaths();
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(logFile)) {
    fs.writeFileSync(logFile, '', 'utf8');
  }
}

export function appendDecisionLog(item: DecisionLogItem) {
  ensureStore();
  const { logFile } = getStorePaths();
  fs.appendFileSync(logFile, `${JSON.stringify(item)}\n`, 'utf8');
}

export function readDecisionLogs(limit = 50): DecisionLogItem[] {
  ensureStore();
  const { logFile } = getStorePaths();
  const text = fs.readFileSync(logFile, 'utf8');
  const lines = text.split('\n').filter(Boolean);
  const parsed = lines
    .map((line) => {
      try {
        return JSON.parse(line) as DecisionLogItem;
      } catch {
        return null;
      }
    })
    .filter((item): item is DecisionLogItem => Boolean(item));

  return parsed.slice(-Math.max(1, Math.min(limit, 500))).reverse();
}
