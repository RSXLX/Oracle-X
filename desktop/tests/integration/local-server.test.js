/**
 * Local Server 集成测试
 * 启动 HTTP 服务 → 测试各端点 → 关闭
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
const { startLocalServer, stopLocalServer, LOCAL_SERVER_PORT } = require('../../src/local-server');

const BASE = `http://127.0.0.1:${LOCAL_SERVER_PORT}`;

// Mock 依赖
const mockSettings = {
    get current() {
        return {
            aiModel: 'gpt-4o-mini',
            apiKey: 'test-key',
            apiBaseUrl: 'https://api.example.com/v1',
            cooldown: 5,
            enableBlock: true,
        };
    },
};

const mockMarketData = {
    fetchMarketData: async () => ({
        price: 42000,
        change24h: 1.5,
        high24h: 43000,
        low24h: 41000,
    }),
};

const mockDecisionLogger = {
    get: async (limit) => [],
    getStats: async () => ({
        total: 0,
        today: 0,
        blocked: 0,
        proceeded: 0,
    }),
};

describe('Local HTTP Server', () => {
    beforeAll(() => {
        startLocalServer(mockSettings, mockMarketData, mockDecisionLogger);
    });

    afterAll(() => {
        stopLocalServer();
    });

    it('GET /api/ping → 200 + ok:true', async () => {
        const res = await fetch(`${BASE}/api/ping`);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.ok).toBe(true);
    });

    it('GET /api/settings → 200 + 包含关键配置字段', async () => {
        const res = await fetch(`${BASE}/api/settings`);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data).toHaveProperty('aiModel');
        expect(typeof data.aiModel).toBe('string');
    });

    it('GET /api/decision-logs → 200 + items 数组', async () => {
        const res = await fetch(`${BASE}/api/decision-logs`);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.ok).toBe(true);
        expect(Array.isArray(data.items)).toBe(true);
    });

    it('GET /api/stats → 200 + 统计字段', async () => {
        const res = await fetch(`${BASE}/api/stats`);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.ok).toBe(true);
    });

    it('未知路径 → 404', async () => {
        const res = await fetch(`${BASE}/api/nonexistent`);
        expect(res.status).toBe(404);
    });

    it('CORS 头对可信 Origin 正确设置', async () => {
        const res = await fetch(`${BASE}/api/ping`, {
            headers: { 'Origin': 'chrome-extension://test-extension-id' }
        });
        expect(res.headers.get('access-control-allow-origin')).toBe('chrome-extension://test-extension-id');
    });
});
