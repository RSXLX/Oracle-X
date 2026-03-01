/**
 * Oracle-X AI 交易分析模块
 * 使用 AI 解析买卖点，定位时间，做出分析
 */

const AI_CONFIG = (() => {
    // .env.local 在 desktop/ 根目录，而当前文件在 desktop/src/analyzer/
    const envPath = require('path').join(__dirname, '..', '..', '.env.local');
    const cfg = { baseUrl: 'https://mydmx.huoyuanqudao.cn/v1', apiKey: '', model: 'MiniMax-M2.5-highspeed' };
    try {
        const content = require('fs').readFileSync(envPath, 'utf-8');
        for (const line of content.split('\n')) {
            const t = line.trim();
            if (!t || t.startsWith('#')) continue;
            const eq = t.indexOf('=');
            if (eq > 0) {
                const k = t.slice(0, eq).trim(), v = t.slice(eq + 1).trim();
                if (k === 'AI_BASE_URL') cfg.baseUrl = v;
                if (k === 'AI_API_KEY') cfg.apiKey = v;
                if (k === 'AI_MODEL') cfg.model = v;
            }
        }
    } catch (e) { /* ignore */ }
    return cfg;
})();

class AITradeAnalyzer {
    constructor(config = {}) {
        this.baseUrl = config.baseUrl || AI_CONFIG.baseUrl;
        this.apiKey = config.apiKey || AI_CONFIG.apiKey;
        this.model = config.model || AI_CONFIG.model;
    }

    /**
     * AI 分析交易记录 - 解析买卖点
     */
    async analyzeTrades(transactions) {
        if (!transactions?.length) {
            return { error: '无交易记录' };
        }

        // 准备交易摘要给 AI
        const summary = this.buildTradeSummary(transactions);

        const prompt = `你是一位资深交易分析师。请分析以下交易记录，找出关键买卖点并给出专业建议。

## 交易记录摘要
${summary}

## 请输出以下分析（JSON 格式）：
{
  "buyPoints": [
    { "time": "时间", "symbol": "币种", "price": 价格, "analysis": "买入原因分析" }
  ],
  "sellPoints": [
    { "time": "时间", "symbol": "币种", "price": 价格, "analysis": "卖出原因分析" }
  ],
  "tradingPatterns": ["pattern1", "pattern2"],
  "riskAssessment": "整体风险评估",
  "suggestions": ["建议1", "建议2", "建议3"],
  "summary": "总体分析总结（100字以内）"
}

注意：
1. 分析买入/卖出的时间点选择是否合理
2. 识别追涨杀跌、频繁交易等不良模式
3. 基于时间分布分析交易习惯
4. 给出具体可执行的改进建议`;

        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        { role: 'system', content: '你是一位专业的加密货币/股票交易分析师，擅长从历史交易记录中发现模式和问题。始终返回有效的 JSON。' },
                        { role: 'user', content: prompt },
                    ],
                    temperature: 0.3,
                    max_tokens: 2000,
                }),
            });

            if (!response.ok) {
                const err = await response.text();
                console.error('[AI-Analyzer] API Error:', err);
                return { error: `AI 请求失败: ${response.status}` };
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content || '';

            return this.parseAIResponse(content);
        } catch (err) {
            console.error('[AI-Analyzer] Error:', err.message);
            return { error: `AI 分析失败: ${err.message}` };
        }
    }

    /**
     * AI 分析钱包交易模式
     */
    async analyzeWalletPattern(transactions, walletInfo = {}) {
        if (!transactions?.length) {
            return { error: '无交易记录' };
        }

        const txSummary = transactions.slice(0, 50).map(tx =>
            `${tx.timestamp} | ${tx.isIncoming ? '收入' : '支出'} | ${tx.value?.toFixed(4)} ${tx.symbol} | Gas: ${(tx.gas || 0).toFixed(6)}`
        ).join('\n');

        const prompt = `分析这个钱包的交易行为模式：

钱包: ${walletInfo.address || '未知'}
链: ${walletInfo.chain || '未知'}
交易数: ${transactions.length}

最近交易记录：
${txSummary}

请返回 JSON：
{
  "walletType": "类型（巨鲸/散户/机器人/DeFi用户等）",
  "activityLevel": "高/中/低",
  "mainActivities": ["活动1", "活动2"],
  "riskIndicators": ["风险指标1"],
  "suggestions": ["建议1", "建议2"],
  "summary": "总结（100字以内）"
}`;

        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        { role: 'system', content: '你是一位区块链分析师，擅长从链上数据分析钱包行为。始终返回有效的 JSON。' },
                        { role: 'user', content: prompt },
                    ],
                    temperature: 0.3,
                    max_tokens: 1500,
                }),
            });

            if (!response.ok) {
                return { error: `AI 请求失败: ${response.status}` };
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content || '';
            return this.parseAIResponse(content);
        } catch (err) {
            console.error('[AI-Analyzer] Wallet analysis error:', err.message);
            return { error: `AI 分析失败: ${err.message}` };
        }
    }

    /**
     * 构建交易摘要文本（支持附加 PnL 统计）
     */
    buildTradeSummary(transactions, pnlStats = null) {
        // 按时间排序
        const sorted = [...transactions].sort((a, b) =>
            new Date(a.timestamp) - new Date(b.timestamp)
        );

        // 统计信息
        const symbols = new Set(sorted.map(t => t.symbol));
        const buys = sorted.filter(t => t.isBuy);
        const sells = sorted.filter(t => t.isSell);

        let summary = `总交易: ${sorted.length} 笔\n`;
        summary += `买入: ${buys.length} 笔 | 卖出: ${sells.length} 笔\n`;
        summary += `涉及币种: ${[...symbols].join(', ')}\n`;
        summary += `时间范围: ${sorted[0]?.timestamp || '?'} ~ ${sorted[sorted.length - 1]?.timestamp || '?'}\n\n`;

        // 附加 PnL 统计（如果有）
        if (pnlStats?.hasPairs) {
            summary += `## 已计算的统计指标\n`;
            summary += `已实现盈亏: ${pnlStats.totalPnl.toFixed(2)} | 净盈亏: ${pnlStats.netPnl.toFixed(2)} | 盈亏率: ${pnlStats.pnlPct.toFixed(2)}%\n`;
            summary += `胜率: ${pnlStats.winRate.toFixed(1)}% | 盈利${pnlStats.wins}笔/亏损${pnlStats.losses}笔\n`;
            summary += `盈亏比: ${pnlStats.profitFactor === Infinity ? '∞' : pnlStats.profitFactor.toFixed(2)} | 平均盈利: ${pnlStats.avgWin.toFixed(2)} | 平均亏损: ${pnlStats.avgLoss.toFixed(2)}\n`;
            summary += `平均持仓: ${pnlStats.holdPeriod.avgHours.toFixed(1)}小时 | 日内占比: ${Math.round(pnlStats.holdPeriod.buckets.intraday / pnlStats.pairsCount * 100)}%\n`;
            summary += `最大连胜: ${pnlStats.streaks.maxWinStreak} | 最大连败: ${pnlStats.streaks.maxLossStreak}\n`;
            summary += `单笔最大占比: ${pnlStats.positionSizing.maxTradeRatio.toFixed(1)}% | 单标的最大占比: ${pnlStats.positionSizing.maxSymbolRatio.toFixed(1)}%\n`;
            summary += `手续费占比: ${pnlStats.costEfficiency.feeToVolumeRatio.toFixed(3)}%\n\n`;
        }

        // 取前 30 笔详细记录
        summary += '详细记录（最多30笔）：\n';
        sorted.slice(0, 30).forEach(tx => {
            summary += `${tx.timestamp || tx.rawTime} | ${tx.symbol} | ${tx.isBuy ? '买入' : '卖出'} | 价格: ${tx.price} | 数量: ${tx.qty} | 总额: ${tx.total}\n`;
        });

        if (sorted.length > 30) {
            summary += `... 还有 ${sorted.length - 30} 笔记录未显示\n`;
        }

        return summary;
    }

    /**
     * 解析 AI 响应
     */
    parseAIResponse(content) {
        try {
            // 尝试提取 JSON
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            console.warn('[AI-Analyzer] JSON parse error:', e.message);
        }

        // 降级：返回原始文本
        return {
            summary: content.slice(0, 500),
            buyPoints: [],
            sellPoints: [],
            suggestions: ['AI 返回格式异常，请查看原始分析'],
            rawContent: content,
        };
    }
    /**
     * AI 分析单次交易（用于快捷键截图的二次风控研判）
     */
    async analyzeSingleTrade(symbol, directionHint, tradeType, platform, marketData) {
        let mdSnippet = '无法获取实时行情数据';
        if (marketData) {
            const pricePos = marketData.high24h && marketData.low24h && marketData.price
                ? ((parseFloat(marketData.price) - parseFloat(marketData.low24h)) / (parseFloat(marketData.high24h) - parseFloat(marketData.low24h)) * 100).toFixed(0)
                : null;
            mdSnippet = `价格: $${marketData.price || '0'}, 24h变动: ${marketData.change24h || '0'}%, 24h高/低: $${marketData.high24h || '0'} / $${marketData.low24h || '0'}`;
            if (pricePos !== null) mdSnippet += `, 当前价格处于24h区间的 ${pricePos}% 位置`;
        }

        const prompt = `你是一名资深金融风控分析师，请对这笔即将在客户端执行的交易做极速评估。

[交易参数]
- 币种/标的: ${symbol}
- 操作方向: ${directionHint === 'long' ? '开多/买入' : directionHint === 'short' ? '开空/卖出' : '未知方向'}
- 交易类型: ${tradeType === 'perpetual' ? '永续合约' : tradeType === 'spot' ? '现货' : tradeType === 'futures' ? '交割合约' : tradeType}
- 交易平台: ${platform}
- 市场行情: ${mdSnippet}

请严格按以下 JSON 格式输出分析结果：
{
  "action": "block|warn|allow",
  "riskLevel": "high|medium|low",
  "summary": "针对这笔交易的专业分析和建议（两到三句话，指出核心风险点和当前盘面提示，如果是高风险直接说明不要操作原因）"
}`;

        try {
            console.log(`[AI-Analyzer] Calling MiniMax for single trade: ${symbol} ${directionHint}`);
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        { role: 'system', content: '你是一个冷静、客观、极度注重风险控制的顶级交易系统AI。直接输出JSON数据。' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.3,
                    max_tokens: 800
                })
            });

            if (!response.ok) {
                console.error('[AI-Analyzer] MiniMax request failed:', await response.text());
                return { action: 'warn', riskLevel: 'medium', summary: 'AI风控分析暂不可用，请注意风险。' };
            }

            const data = await response.json();
            const content = data.choices[0].message.content;

            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            return { action: 'warn', riskLevel: 'medium', summary: content.slice(0, 200) };
        } catch (e) {
            console.error('[AI-Analyzer] Analysis error:', e.message);
            return { action: 'warn', riskLevel: 'medium', summary: 'AI风控分析遇到网络或解析错误。' };
        }
    }
}

module.exports = { AITradeAnalyzer };
