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

const DATA_DIR = path.join(process.cwd(), 'data');
const LOG_FILE = path.join(DATA_DIR, 'decision-log.jsonl');

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, '', 'utf8');
  }
}

export function appendDecisionLog(item: DecisionLogItem) {
  ensureStore();
  fs.appendFileSync(LOG_FILE, `${JSON.stringify(item)}\n`, 'utf8');
}

export function readDecisionLogs(limit = 50): DecisionLogItem[] {
  ensureStore();
  const text = fs.readFileSync(LOG_FILE, 'utf8');
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
