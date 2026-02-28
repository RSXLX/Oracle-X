/**
 * Oracle-X Quick Scorer
 * Stage 1 快速风险评分引擎 — 本地执行，无网络请求，< 10ms
 */

(function () {
    'use strict';

    // ========== 评分权重 ==========
    const SCORE_WEIGHTS = {
        volatility: 30,   // 价格波动率 (24h)
        frequency: 25,    // 交易频率 (5分钟内同向操作)
        indicator: 25,    // RSI 极端值
        leverage: 20,     // 杠杆倍数
    };

    // ========== 灵敏度预设 ==========
    const SENSITIVITY_THRESHOLDS = {
        conservative: { low: 40, high: 70 },
        balanced: { low: 20, high: 45 },
        aggressive: { low: 10, high: 30 },
    };

    // ========== 交易频率跟踪 ==========
    const TRADE_HISTORY_KEY = 'oraclex_trade_history';
    const FREQUENCY_WINDOW_MS = 5 * 60 * 1000; // 5 分钟

    function getRecentTrades() {
        try {
            const raw = sessionStorage.getItem(TRADE_HISTORY_KEY);
            if (!raw) return [];
            const trades = JSON.parse(raw);
            const cutoff = Date.now() - FREQUENCY_WINDOW_MS;
            return trades.filter(t => t.timestamp > cutoff);
        } catch {
            return [];
        }
    }

    function recordTrade(symbol, direction) {
        try {
            const trades = getRecentTrades();
            trades.push({ symbol, direction, timestamp: Date.now() });
            // 只保留最近 50 条
            sessionStorage.setItem(TRADE_HISTORY_KEY, JSON.stringify(trades.slice(-50)));
        } catch {
            // ignore
        }
    }

    function countRecentSameDirectionTrades(symbol, direction) {
        const trades = getRecentTrades();
        return trades.filter(t => t.symbol === symbol && t.direction === direction).length;
    }

    // ========== 评分函数 ==========

    /**
     * 波动率评分 (0 - 30)
     * @param {string|number} change24h - 24h 涨跌幅百分比
     */
    function scoreVolatility(change24h) {
        const absChange = Math.abs(parseFloat(change24h) || 0);
        if (absChange > 20) return 30;
        if (absChange > 15) return 25;
        if (absChange > 10) return 20;
        if (absChange > 5) return 10;
        if (absChange > 3) return 5;
        return 0;
    }

    /**
     * 交易频率评分 (0 - 25)
     * @param {number} recentCount - 5分钟内同向操作次数
     */
    function scoreFrequency(recentCount) {
        if (recentCount >= 4) return 25;
        if (recentCount >= 3) return 20;
        if (recentCount >= 2) return 15;
        if (recentCount >= 1) return 5;
        return 0;
    }

    /**
     * RSI 指标评分 (0 - 25)
     * @param {number|null} rsi - RSI 值
     * @param {string} direction - 'buy' | 'sell'
     */
    function scoreIndicator(rsi, direction) {
        if (rsi == null) return 0;
        // 买入时 RSI 高 = 风险高（追高）
        if (direction === 'buy') {
            if (rsi > 85) return 25;
            if (rsi > 75) return 20;
            if (rsi > 70) return 15;
            if (rsi < 20) return 5; // 极度超卖买入其实是机会，低分
            return 0;
        }
        // 卖出时 RSI 低 = 风险高（恐慌抛售）
        if (direction === 'sell') {
            if (rsi < 15) return 25;
            if (rsi < 25) return 20;
            if (rsi < 30) return 15;
            if (rsi > 80) return 5; // 超买卖出是合理的
            return 0;
        }
        return 0;
    }

    /**
     * 杠杆评分 (0 - 20)
     * @param {number|null} leverage - 杠杆倍数
     */
    function scoreLeverage(leverage) {
        if (!leverage || leverage <= 1) return 0;
        if (leverage >= 50) return 35;  // 极端高杠杆
        if (leverage >= 20) return 25;  // 高杠杆
        if (leverage >= 10) return 18;
        if (leverage >= 5) return 12;
        if (leverage >= 3) return 5;
        return 2;
    }

    // ========== 主评分函数 ==========

    /**
     * 快速风险评分
     * @param {Object} context - 交易上下文
     * @param {string} context.symbol - 标准化交易对
     * @param {string} context.price - 当前价格
     * @param {string} context.direction - 'buy' | 'sell'
     * @param {string} context.platform - 平台 ID
     * @param {number|null} context.leverage - 杠杆倍数
     * @param {Object|null} context.ticker - 缓存的 ticker 数据
     * @param {string} [sensitivity='balanced'] - 灵敏度
     * @returns {{ score: number, level: string, reasons: string[], breakdown: Object }}
     */
    function quickScore(context, sensitivity) {
        sensitivity = sensitivity || 'balanced';
        const thresholds = SENSITIVITY_THRESHOLDS[sensitivity] || SENSITIVITY_THRESHOLDS.balanced;

        const ticker = context.ticker || {};
        const change24h = ticker.priceChangePercent || '0';
        const rsi = ticker.rsi || null;

        // 记录本次交易
        recordTrade(context.symbol, context.direction);

        // 获取频率
        const recentCount = countRecentSameDirectionTrades(context.symbol, context.direction);

        // 各维度评分
        const vScore = scoreVolatility(change24h);
        const fScore = scoreFrequency(recentCount);
        const iScore = scoreIndicator(rsi, context.direction);
        const lScore = scoreLeverage(context.leverage);

        const totalScore = vScore + fScore + iScore + lScore;

        // 评分原因
        const reasons = [];
        if (vScore >= 20) reasons.push(`24h波动${Math.abs(parseFloat(change24h)).toFixed(1)}%，波动率较高`);
        else if (vScore >= 10) reasons.push(`24h波动${Math.abs(parseFloat(change24h)).toFixed(1)}%`);
        if (fScore >= 15) reasons.push(`5分钟内已有${recentCount}次同向操作，交易频繁`);
        else if (fScore >= 5) reasons.push(`近期已有${recentCount}次同向操作`);
        if (iScore >= 15) {
            const rsiLabel = context.direction === 'buy' ? '超买区间' : '超卖区间';
            reasons.push(`RSI ${rsi?.toFixed(0)} 处于${rsiLabel}，风险偏高`);
        }
        if (lScore >= 10) reasons.push(`杠杆${context.leverage}x，仓位风险较大`);
        else if (lScore > 0) reasons.push(`杠杆${context.leverage}x`);

        if (reasons.length === 0) reasons.push('当前市场环境平稳');

        // 确定风险级别
        let level;
        if (totalScore <= thresholds.low) {
            level = 'low';
        } else if (totalScore > thresholds.high) {
            level = 'high';
        } else {
            level = 'medium';
        }

        return {
            score: Math.min(totalScore, 100),
            level,
            reasons,
            breakdown: {
                volatility: vScore,
                frequency: fScore,
                indicator: iScore,
                leverage: lScore,
            },
        };
    }

    // ========== 分析缓存 ==========
    const ANALYSIS_CACHE_KEY = 'oraclex_analysis_cache';

    function getCachedAnalysis(symbol) {
        try {
            const raw = sessionStorage.getItem(ANALYSIS_CACHE_KEY);
            if (!raw) return null;
            const cache = JSON.parse(raw);
            const entry = cache[symbol];
            if (!entry) return null;
            // 检查过期（默认 5 分钟）
            const expiry = (window.OracleXSettings?.cacheExpiry || 300) * 1000;
            if (Date.now() - entry.timestamp > expiry) {
                delete cache[symbol];
                sessionStorage.setItem(ANALYSIS_CACHE_KEY, JSON.stringify(cache));
                return null;
            }
            return entry;
        } catch {
            return null;
        }
    }

    function setCachedAnalysis(symbol, data) {
        try {
            const raw = sessionStorage.getItem(ANALYSIS_CACHE_KEY);
            const cache = raw ? JSON.parse(raw) : {};
            cache[symbol] = { ...data, timestamp: Date.now() };
            sessionStorage.setItem(ANALYSIS_CACHE_KEY, JSON.stringify(cache));
        } catch {
            // ignore
        }
    }

    function clearAnalysisCache() {
        try {
            sessionStorage.removeItem(ANALYSIS_CACHE_KEY);
        } catch {
            // ignore
        }
    }

    // ========== 导出 ==========
    if (typeof window !== 'undefined') {
        window.OracleXQuickScorer = {
            quickScore,
            getCachedAnalysis,
            setCachedAnalysis,
            clearAnalysisCache,
            recordTrade,
            // 暴露子函数用于测试
            _scoreVolatility: scoreVolatility,
            _scoreFrequency: scoreFrequency,
            _scoreIndicator: scoreIndicator,
            _scoreLeverage: scoreLeverage,
        };
    }
})();
