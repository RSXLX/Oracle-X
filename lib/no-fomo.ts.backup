export type DecisionAction = 'ALLOW' | 'WARN' | 'BLOCK';

export interface NoFomoDecision {
  action: DecisionAction;
  impulseScore: number; // 0-100
  confidence: number; // 0-100
  coolingSeconds: number;
  reasons: string[];
}

export interface NoFomoInput {
  change24h: number;
  fearGreedIndex?: number | null;
  twitterSentiment?: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | null;
  twitterConfidence?: number | null;
  recentLossStreak?: number; // optional future extension
}

function clamp(num: number, min: number, max: number) {
  return Math.max(min, Math.min(max, num));
}

export function evaluateNoFomo(input: NoFomoInput): NoFomoDecision {
  const reasons: string[] = [];
  let score = 0;

  const abs24h = Math.abs(input.change24h || 0);
  if (abs24h >= 10) {
    score += 30;
    reasons.push('24h 波动剧烈（≥10%），追涨杀跌风险高');
  } else if (abs24h >= 6) {
    score += 18;
    reasons.push('24h 波动偏高（≥6%），需警惕情绪化入场');
  }

  if (input.fearGreedIndex !== null && input.fearGreedIndex !== undefined) {
    if (input.fearGreedIndex >= 80) {
      score += 22;
      reasons.push('市场极度贪婪，FOMO 风险显著上升');
    } else if (input.fearGreedIndex <= 20) {
      score += 10;
      reasons.push('市场极度恐惧，反应性交易概率上升');
    }
  }

  if (input.twitterSentiment === 'BULLISH' && (input.twitterConfidence || 0) >= 75) {
    score += 16;
    reasons.push('社媒情绪高度一致偏多，存在拥挤交易风险');
  }

  if (input.recentLossStreak && input.recentLossStreak >= 2) {
    score += 20;
    reasons.push('近期连续亏损后再入场，易出现补偿性交易');
  }

  score = clamp(Math.round(score), 0, 100);

  if (score >= 70) {
    return {
      action: 'BLOCK',
      impulseScore: score,
      confidence: 82,
      coolingSeconds: 45,
      reasons: reasons.length ? reasons : ['当前风险显著，建议暂停并等待确认信号'],
    };
  }

  if (score >= 40) {
    return {
      action: 'WARN',
      impulseScore: score,
      confidence: 74,
      coolingSeconds: 20,
      reasons: reasons.length ? reasons : ['当前存在一定冲动交易风险，请二次确认'],
    };
  }

  return {
    action: 'ALLOW',
    impulseScore: score,
    confidence: 68,
    coolingSeconds: 0,
    reasons: reasons.length ? reasons : ['暂无明显 FOMO 风险信号'],
  };
}
