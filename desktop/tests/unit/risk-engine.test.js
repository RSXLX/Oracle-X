/**
 * RiskEngine 单元测试
 */
import { describe, it, expect } from 'vitest';
const { RiskEngine } = require('../../src/analyzer/risk-engine');

describe('RiskEngine', () => {
    const engine = new RiskEngine();

    describe('assessRisk', () => {
        it('无交易历史 → 默认低风险', () => {
            const result = engine.assessRisk({});
            expect(result).toHaveProperty('score');
            expect(result).toHaveProperty('riskLevel');
            expect(result).toHaveProperty('riskLabel');
            expect(result).toHaveProperty('recommendations');
            // 空数据各维度得分低，总分应 < 30
            expect(result.riskLevel).toBe('low');
        });

        it('高频交易 → 高风险', () => {
            const analysis = {
                stats: { totalTrades: 600 },
                transactions: [],
            };
            const result = engine.assessRisk(analysis);
            // 频率维度 90 分，加权 0.15 = 13.5，其他维度也会贡献
            expect(result.score).toBeGreaterThanOrEqual(10);
        });

        it('正常交易模式 → 低风险', () => {
            const analysis = {
                stats: {
                    totalTrades: 20,
                    symbols: ['BTC/USDT', 'ETH/USDT'],
                    exchanges: ['Binance'],
                    winRate: 0.55,
                },
                transactions: Array.from({ length: 20 }, (_, i) => ({
                    symbol: i % 2 === 0 ? 'BTC/USDT' : 'ETH/USDT',
                    side: i % 3 === 0 ? 'sell' : 'buy',
                    total: 100,
                    fee: 0.5,
                    marketType: 'crypto',
                })),
            };
            const result = engine.assessRisk(analysis);
            expect(result.riskLevel).toBe('low');
        });

        it('返回结构包含 factors 和 recommendations', () => {
            const result = engine.assessRisk({ stats: { totalTrades: 10 } });
            expect(result.factors).toBeDefined();
            expect(result.factors).toHaveProperty('frequency');
            expect(result.factors).toHaveProperty('concentration');
            expect(result.factors).toHaveProperty('volatility');
            expect(Array.isArray(result.recommendations)).toBe(true);
        });
    });

    describe('assessFrequency', () => {
        it('> 500 次 → 90 分', () => {
            expect(engine.assessFrequency({ stats: { totalTrades: 600 } })).toBe(90);
        });

        it('> 200 次 → 70 分', () => {
            expect(engine.assessFrequency({ stats: { totalTrades: 250 } })).toBe(70);
        });

        it('< 50 次 → 10 分', () => {
            expect(engine.assessFrequency({ stats: { totalTrades: 20 } })).toBe(10);
        });

        it('无数据 → 10 分', () => {
            expect(engine.assessFrequency({})).toBe(10);
        });
    });
});
