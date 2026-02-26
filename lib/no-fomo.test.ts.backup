import { evaluateNoFomo } from '@/lib/no-fomo';

describe('evaluateNoFomo', () => {
  it('returns ALLOW on calm market', () => {
    const result = evaluateNoFomo({
      change24h: 1.8,
      fearGreedIndex: 52,
      twitterSentiment: 'NEUTRAL',
      twitterConfidence: 45,
    });

    expect(result.action).toBe('ALLOW');
    expect(result.impulseScore).toBeLessThan(40);
  });

  it('returns WARN on elevated volatility', () => {
    const result = evaluateNoFomo({
      change24h: 8.2,
      fearGreedIndex: 83,
      twitterSentiment: 'BULLISH',
      twitterConfidence: 70,
    });

    expect(['WARN', 'BLOCK']).toContain(result.action);
    expect(result.impulseScore).toBeGreaterThanOrEqual(40);
  });

  it('returns BLOCK on extreme fomo setup', () => {
    const result = evaluateNoFomo({
      change24h: 12.6,
      fearGreedIndex: 89,
      twitterSentiment: 'BULLISH',
      twitterConfidence: 92,
      recentLossStreak: 3,
    });

    expect(result.action).toBe('BLOCK');
    expect(result.coolingSeconds).toBeGreaterThan(0);
    expect(result.impulseScore).toBeGreaterThanOrEqual(70);
  });
});
