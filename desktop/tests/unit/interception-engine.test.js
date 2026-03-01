/**
 * InterceptionEngine 单元测试 — Mock 所有外部依赖
 */
import { describe, it, expect, vi } from 'vitest';
const { InterceptionEngine } = require('../../src/core/interception-engine');

// Mock 依赖
function createMockDeps() {
    return {
        db: {
            execute: vi.fn().mockResolvedValue([[], []]),
        },
        marketData: {
            fetchMarketData: vi.fn().mockResolvedValue({
                price: 42000,
                change24h: 2.5,
                high24h: 43000,
                low24h: 41000,
                currency: 'USDT',
            }),
        },
        riskEngine: {
            assessRisk: vi.fn().mockReturnValue({
                score: 35,
                riskLevel: 'medium',
                riskLabel: '中等风险',
                recommendations: [{ title: '建议控制仓位' }],
            }),
        },
        decisionLogger: {
            add: vi.fn().mockResolvedValue(true),
        },
    };
}

describe('InterceptionEngine', () => {
    it('构造成功', () => {
        const deps = createMockDeps();
        const engine = new InterceptionEngine(deps);
        expect(engine).toBeDefined();
        expect(engine.db).toBe(deps.db);
    });

    it('evaluate 返回完整报告结构', async () => {
        const deps = createMockDeps();
        const engine = new InterceptionEngine(deps);

        const screenshotResult = {
            symbol: 'BTC/USDT',
            platform: 'Binance',
            marketType: 'crypto',
            action: 'block',
            buttons: ['买入/做多'],
        };

        const report = await engine.evaluate(screenshotResult, 'Binance');

        expect(report).toBeDefined();
        expect(report).toHaveProperty('symbol');
        expect(report).toHaveProperty('screenshot');
    });

    it('无 symbol 时使用降级方案', async () => {
        const deps = createMockDeps();
        const engine = new InterceptionEngine(deps);

        const screenshotResult = {
            platform: 'Unknown',
            action: 'warn',
        };

        const report = await engine.evaluate(screenshotResult, 'Unknown App');
        expect(report).toBeDefined();
    });

    it('市场数据获取失败时不抛异常', async () => {
        const deps = createMockDeps();
        deps.marketData.fetchMarketData.mockRejectedValue(new Error('Network error'));
        const engine = new InterceptionEngine(deps);

        const report = await engine.evaluate(
            { symbol: 'BTC/USDT', platform: 'Binance', marketType: 'crypto' },
            'Binance'
        );
        expect(report).toBeDefined();
    });
});
