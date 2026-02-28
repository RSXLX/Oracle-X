/**
 * Oracle-X 拦截决策引擎
 * 在拦截触发时串联：DB 交易历史 + 实时市场行情 + 风险评估
 * 生成个性化的智能风控报告
 */

class InterceptionEngine {
    /**
     * @param {object} deps
     * @param {object} deps.db          - MySQL 连接池
     * @param {object} deps.marketData  - MarketDataService 实例
     * @param {object} deps.riskEngine  - RiskEngine 实例
     * @param {object} deps.decisionLogger - DecisionLogger 实例
     */
    constructor({ db, marketData, riskEngine, decisionLogger }) {
        this.db = db;
        this.marketData = marketData;
        this.riskEngine = riskEngine;
        this.decisionLogger = decisionLogger;
    }

    /**
     * 核心方法：从截图分析结果 → 综合风险报告
     * @param {object} screenshotResult - ScreenshotAnalyzer 返回的结果
     * @param {string} appName          - 触发拦截的应用名称
     * @returns {object} 综合风险报告
     */
    async evaluate(screenshotResult, appName) {
        const symbol = screenshotResult?.symbol || null;
        const marketType = screenshotResult?.marketType || 'crypto';

        console.log(`[InterceptionEngine] 🔍 开始综合评估 | 应用: ${appName} | 品种: ${symbol || '未识别'} | 市场: ${marketType}`);

        // 并行执行：DB 交易历史 + 实时市场行情
        console.log('[InterceptionEngine] ⏳ 并行查询: DB 交易历史 + 实时市场行情...');
        const [tradeHistory, marketInfo] = await Promise.all([
            symbol ? this.getUserTradeHistory(symbol, marketType) : this.getOverallTradeHistory(),
            symbol ? this.getMarketInfo(symbol, marketType) : null,
        ]);

        console.log(`[InterceptionEngine] 📊 交易历史: ${tradeHistory ? tradeHistory.count + ' 条记录' : '无数据'}`);
        console.log(`[InterceptionEngine] 📈 市场行情: ${marketInfo ? marketInfo.price + ' (' + (marketInfo.change24h >= 0 ? '+' : '') + marketInfo.change24h + '%)' : '未获取'}`);

        // 构建分析数据供 RiskEngine 使用
        const analysisData = this.buildAnalysisData(tradeHistory);

        // 风险评估
        let risk = null;
        if (analysisData) {
            risk = this.riskEngine.assessRisk(analysisData, marketInfo || {});
            console.log(`[InterceptionEngine] ⚠️ 风险评估: ${risk.riskLabel} (${risk.score}/100)`);
        } else {
            console.log('[InterceptionEngine] ⚠️ 风险评估: 跳过（无交易数据）');
        }

        // 组装最终报告
        const report = this.buildReport({
            appName,
            symbol,
            marketType,
            screenshotResult,
            tradeHistory,
            marketInfo,
            risk,
        });

        console.log('[InterceptionEngine] ✅ 综合评估完成，弹出智能弹窗');
        return report;
    }

    /**
     * 查询用户在指定品种上的历史交易
     */
    async getUserTradeHistory(symbol, marketType) {
        if (!this.db) return null;

        try {
            // 模糊匹配 symbol（支持 BTCUSDT / BTC 等变体）
            const likeSymbol = `%${symbol.replace(/USDT$|USD$|BUSD$/i, '')}%`;
            const [rows] = await this.db.execute(
                `SELECT symbol, side, price, qty, total, fee, is_buy, timestamp, market_type
         FROM transactions
         WHERE symbol LIKE ? AND market_type = ?
         ORDER BY timestamp DESC
         LIMIT 100`,
                [likeSymbol, marketType]
            );

            if (!rows.length) return null;

            return this.summarizeHistory(rows, symbol);
        } catch (err) {
            console.error('[InterceptionEngine] DB query error:', err.message);
            return null;
        }
    }

    /**
     * 查询用户的总体交易历史概览（无品种时的降级方案）
     */
    async getOverallTradeHistory() {
        if (!this.db) return null;

        try {
            const [rows] = await this.db.execute(
                `SELECT symbol, side, price, qty, total, fee, is_buy, timestamp, market_type
         FROM transactions
         ORDER BY timestamp DESC
         LIMIT 200`
            );

            if (!rows.length) return null;

            return this.summarizeHistory(rows, null);
        } catch (err) {
            console.error('[InterceptionEngine] DB overall query error:', err.message);
            return null;
        }
    }

    /**
     * 获取实时市场行情
     */
    async getMarketInfo(symbol, marketType) {
        if (!this.marketData) return null;

        try {
            // 标准化 symbol 给 MarketDataService
            let querySymbol = symbol;
            if (marketType === 'crypto' && !symbol.endsWith('USDT')) {
                querySymbol = symbol + 'USDT';
            }

            const info = await this.marketData.getSymbolInfo(querySymbol, marketType);
            return info;
        } catch (err) {
            console.error('[InterceptionEngine] Market data error:', err.message);
            return null;
        }
    }

    /**
     * 汇总交易历史为简洁的统计数据
     */
    summarizeHistory(rows, targetSymbol) {
        const count = rows.length;
        const buys = rows.filter(r => r.is_buy).length;
        const sells = count - buys;

        // 最近一次交易时间
        const lastTradeTime = rows[0]?.timestamp
            ? new Date(rows[0].timestamp).toLocaleString('zh-CN')
            : null;

        // 粗略盈亏计算（简化版：买入总额 vs 卖出总额）
        let totalBuyAmount = 0;
        let totalSellAmount = 0;
        for (const row of rows) {
            const amount = row.total || (row.price * row.qty) || 0;
            if (row.is_buy) {
                totalBuyAmount += amount;
            } else {
                totalSellAmount += amount;
            }
        }

        const roughPnl = totalSellAmount - totalBuyAmount;
        let pnlSummary = null;
        if (totalBuyAmount > 0 && totalSellAmount > 0) {
            const pnlPct = (roughPnl / totalBuyAmount * 100).toFixed(1);
            const sign = roughPnl >= 0 ? '+' : '';
            pnlSummary = `${sign}${roughPnl.toFixed(2)} (${sign}${pnlPct}%)`;
        }

        // 交易频率（最近 7 天）
        const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
        const recentCount = rows.filter(r => new Date(r.timestamp) > weekAgo).length;

        // 涉及的品种
        const symbols = [...new Set(rows.map(r => r.symbol))];

        // 买卖时间分布
        const hourDistribution = new Array(24).fill(0);
        for (const row of rows) {
            if (row.timestamp) {
                const h = new Date(row.timestamp).getHours();
                hourDistribution[h]++;
            }
        }

        // 找出交易最活跃的小时
        const peakHour = hourDistribution.indexOf(Math.max(...hourDistribution));

        return {
            targetSymbol,
            count,
            buys,
            sells,
            lastTradeTime,
            pnlSummary,
            roughPnl,
            recentCount,
            recentFrequency: recentCount > 0 ? `近7天 ${recentCount} 笔` : null,
            symbols,
            peakHour,
            totalBuyAmount,
            totalSellAmount,
        };
    }

    /**
     * 构建 RiskEngine 所需的 analysis 数据结构
     */
    buildAnalysisData(tradeHistory) {
        if (!tradeHistory) return null;

        // 映射为 RiskEngine.assessRisk 期望的格式
        const bySymbol = {};
        for (const sym of tradeHistory.symbols) {
            bySymbol[sym] = { trades: 0, volume: 0 };
        }

        return {
            stats: {
                totalTrades: tradeHistory.count,
                uniqueSymbols: tradeHistory.symbols.length,
            },
            topSymbols: tradeHistory.symbols.map(s => ({
                symbol: s,
                trades: Math.ceil(tradeHistory.count / tradeHistory.symbols.length),
            })),
            categoryBreakdown: {},
            marketTypeBreakdown: {},
        };
    }

    /**
     * 组装最终弹窗展示报告
     */
    buildReport({ appName, symbol, marketType, screenshotResult, tradeHistory, marketInfo, risk }) {
        return {
            appName,
            symbol,
            marketType,
            timestamp: new Date().toISOString(),

            // 截图分析原始结果
            screenshot: {
                platform: screenshotResult?.platform || appName,
                buttons: screenshotResult?.buttons || [],
                riskLevel: screenshotResult?.riskLevel || 'medium',
            },

            // 用户交易历史
            tradeHistory: tradeHistory || null,

            // 实时市场行情
            marketInfo: marketInfo ? {
                price: marketInfo.price,
                change24h: marketInfo.change24h,
                high24h: marketInfo.high24h,
                low24h: marketInfo.low24h,
                volume24h: marketInfo.volume24h,
                currency: marketInfo.currency,
            } : null,

            // 风险评估
            risk: risk || null,
        };
    }
}

module.exports = { InterceptionEngine };
