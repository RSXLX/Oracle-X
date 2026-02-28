/**
 * Oracle-X 风险评估引擎（多市场版）
 * 综合评估交易风险并提供建议
 */

class RiskEngine {
  constructor() {
    // 风险因素权重（8维）
    this.weights = {
      frequency: 0.15,
      concentration: 0.12,
      volatility: 0.15,
      leverage: 0.12,
      highRiskExposure: 0.12,
      marketDiversity: 0.10,
      positionSizing: 0.12,
      costEfficiency: 0.12,
    };
  }

  /**
   * 综合风险评估
   */
  assessRisk(analysis, marketData = {}) {
    const scores = {
      frequency: this.assessFrequency(analysis),
      concentration: this.assessConcentration(analysis),
      volatility: this.assessVolatility(analysis),
      leverage: this.assessLeverage(analysis),
      highRiskExposure: this.assessHighRiskExposure(analysis),
      marketDiversity: this.assessMarketDiversity(analysis),
      positionSizing: this.assessPositionSizing(analysis),
      costEfficiency: this.assessCostEfficiency(analysis),
    };

    // 加权计算总分
    let totalScore = 0;
    for (const [factor, score] of Object.entries(scores)) {
      totalScore += score * (this.weights[factor] || 0);
    }

    // 风险等级
    let riskLevel = 'low';
    let riskLabel = '安全';

    if (totalScore >= 70) {
      riskLevel = 'critical';
      riskLabel = '极度危险';
    } else if (totalScore >= 50) {
      riskLevel = 'high';
      riskLabel = '高风险';
    } else if (totalScore >= 30) {
      riskLevel = 'medium';
      riskLabel = '中等风险';
    }

    return {
      score: Math.round(totalScore),
      riskLevel,
      riskLabel,
      factors: scores,
      recommendations: this.generateRecommendations(scores, analysis),
    };
  }

  /**
   * 评估交易频率风险
   */
  assessFrequency(analysis) {
    const stats = analysis?.stats || {};
    const total = stats.totalTrades || 0;

    if (total > 500) return 90;
    if (total > 200) return 70;
    if (total > 100) return 50;
    if (total > 50) return 30;
    return 10;
  }

  /**
   * 评估集中度风险
   */
  assessConcentration(analysis) {
    const stats = analysis?.stats || {};
    const unique = stats.uniqueSymbols || 0;
    const total = stats.totalTrades || 1;

    const topSymbols = analysis?.topSymbols || [];
    if (topSymbols.length > 0) {
      const topRatio = topSymbols[0].trades / total;
      if (topRatio > 0.8) return 80;
      if (topRatio > 0.5) return 60;
      if (topRatio > 0.3) return 40;
    }

    if (unique < 3) return 60;
    if (unique < 5) return 40;
    return 20;
  }

  /**
   * 评估波动性风险（多市场）
   */
  assessVolatility(analysis) {
    const stats = analysis?.stats || {};
    const categoryBreakdown = analysis?.categoryBreakdown || {};
    const marketBreakdown = analysis?.marketTypeBreakdown || {};
    const total = stats.totalTrades || 1;

    // Meme 币占比是最大波动源
    const memeRatio = (categoryBreakdown.meme || 0) / total;
    if (memeRatio > 0.5) return 90;
    if (memeRatio > 0.3) return 70;

    // 创业板/科创板占比
    const growthRatio = (categoryBreakdown.growth || 0) / total;
    if (growthRatio > 0.7) return 60;
    if (growthRatio > 0.4) return 45;

    // 加密货币总体比例
    const cryptoRatio = (marketBreakdown.crypto || 0) / total;
    if (cryptoRatio > 0.8) return 55;
    if (cryptoRatio > 0.5) return 40;

    return 25;
  }

  /**
   * 评估杠杆风险（从交易记录推断）
   */
  assessLeverage(analysis) {
    const topSymbols = analysis?.topSymbols || [];
    const categoryBreakdown = analysis?.categoryBreakdown || {};

    // 检测是否有合约/期货交易的痕迹
    let hasLeverage = false;
    for (const sym of topSymbols) {
      const s = sym.symbol?.toUpperCase() || '';
      // 常见合约标识：PERP, 永续, -SWAP, 期货
      if (/PERP|SWAP|FUTURE|永续|期货|合约/.test(s)) {
        hasLeverage = true;
        break;
      }
      if (sym.marketType === 'futures') {
        hasLeverage = true;
        break;
      }
    }

    if (hasLeverage) return 80;

    // 期货市场占比
    const futuresRatio = (categoryBreakdown.futures || 0) / (analysis?.stats?.totalTrades || 1);
    if (futuresRatio > 0.3) return 70;
    if (futuresRatio > 0.1) return 50;

    return 20;
  }

  /**
   * 评估高风险标的暴露（多市场版，替代原 assessMemeExposure）
   */
  assessHighRiskExposure(analysis) {
    const categoryBreakdown = analysis?.categoryBreakdown || {};
    const total = analysis?.stats?.totalTrades || 1;

    // 加密 Meme 币
    const memeRatio = (categoryBreakdown.meme || 0) / total;
    // 创业板/科创板
    const growthRatio = (categoryBreakdown.growth || 0) / total;
    // 未知类别
    const unknownRatio = (categoryBreakdown.unknown || 0) / total;

    const combinedHighRisk = memeRatio + growthRatio * 0.5 + unknownRatio * 0.3;

    if (combinedHighRisk > 0.6) return 90;
    if (combinedHighRisk > 0.4) return 70;
    if (combinedHighRisk > 0.2) return 50;
    if (combinedHighRisk > 0.1) return 35;
    return 15;
  }

  /**
   * 评估市场分散度（新增维度）
   */
  assessMarketDiversity(analysis) {
    const marketBreakdown = analysis?.marketTypeBreakdown || {};
    const marketCount = Object.keys(marketBreakdown).length;
    const total = analysis?.stats?.totalTrades || 1;

    if (marketCount === 0) return 50;
    if (marketCount === 1) {
      // 单一市场 — 中等风险
      return 40;
    }

    // 多市场 — 检查是否过度分散
    const maxRatio = Math.max(...Object.values(marketBreakdown)) / total;
    if (maxRatio < 0.3 && marketCount > 4) return 45; // 过度分散
    return 15; // 适度分散
  }

  /**
   * 评估仓位管理风险（新增维度）
   */
  assessPositionSizing(analysis) {
    const pnl = analysis?.pnl;
    if (!pnl?.hasPairs) return 30; // 无数据时默认中等

    const ps = pnl.positionSizing;
    // 单笔最大占比
    if (ps.maxTradeRatio > 50) return 90;
    if (ps.maxTradeRatio > 30) return 70;
    if (ps.maxTradeRatio > 15) return 50;
    // 单标的集中
    if (ps.maxSymbolRatio > 80) return 75;
    if (ps.maxSymbolRatio > 60) return 55;
    return 20;
  }

  /**
   * 评估交易成本效率（新增维度）
   */
  assessCostEfficiency(analysis) {
    const pnl = analysis?.pnl;
    if (!pnl?.hasPairs) return 20; // 无数据时默认低风险

    const ce = pnl.costEfficiency;
    // 手续费占交易额比例
    if (ce.feeToVolumeRatio > 2) return 80;
    if (ce.feeToVolumeRatio > 1) return 60;
    if (ce.feeToVolumeRatio > 0.5) return 40;
    // 手续费占盈利比例
    if (ce.feeToPnlRatio !== null && ce.feeToPnlRatio > 80) return 85;
    if (ce.feeToPnlRatio !== null && ce.feeToPnlRatio > 50) return 65;
    return 15;
  }

  /**
   * 生成建议（多市场 + 盈亏维度）
   */
  generateRecommendations(scores, analysis = {}) {
    const recommendations = [];
    const marketBreakdown = analysis?.marketTypeBreakdown || {};
    const hasMultiMarket = Object.keys(marketBreakdown).length > 1;
    const pnl = analysis?.pnl;

    if (scores.frequency > 60) {
      recommendations.push({
        type: 'warning',
        title: '交易过于频繁',
        text: '建议降低交易频率，避免情绪化交易。频繁交易会增加手续费成本。',
      });
    }

    if (scores.concentration > 60) {
      recommendations.push({
        type: 'warning',
        title: '投资过于集中',
        text: `建议分散投资，降低单一${hasMultiMarket ? '标的' : '币种'}的仓位风险。`,
      });
    }

    if (scores.highRiskExposure > 60) {
      const parts = [];
      if ((analysis?.categoryBreakdown?.meme || 0) > 0) parts.push('Meme 币');
      if ((analysis?.categoryBreakdown?.growth || 0) > 0) parts.push('创业板/科创板');
      recommendations.push({
        type: 'danger',
        title: '高风险标的暴露',
        text: `${parts.join('、') || '高波动标的'}占比较高，建议控制仓位。`,
      });
    }

    if (scores.leverage > 60) {
      recommendations.push({
        type: 'danger',
        title: '杠杆/合约风险',
        text: '检测到合约/期货交易，杠杆交易风险极高，请确保设置止损。',
      });
    }

    if (scores.volatility > 50) {
      recommendations.push({
        type: 'info',
        title: '注意波动性',
        text: '持仓标的整体波动较大，建议适当配置低波动资产。',
      });
    }

    if (scores.marketDiversity > 40 && Object.keys(marketBreakdown).length <= 1) {
      recommendations.push({
        type: 'info',
        title: '考虑跨市场配置',
        text: '当前仅交易单一市场，可考虑跨市场分散风险。',
      });
    }

    // 新增：仓位管理建议
    if (scores.positionSizing > 60) {
      recommendations.push({
        type: 'warning',
        title: '仓位管理不当',
        text: '单笔交易或单标的仓位占比过大，建议控制单次操作不超过总资金的15%。',
      });
    }

    // 新增：交易成本建议
    if (scores.costEfficiency > 60) {
      recommendations.push({
        type: 'warning',
        title: '交易成本过高',
        text: '手续费占比较大，建议降低交易频率或选择费率更低的交易平台。',
      });
    }

    // 新增：基于盈亏的建议
    if (pnl?.hasPairs) {
      if (pnl.winRate < 40 && pnl.profitFactor < 1) {
        recommendations.push({
          type: 'danger',
          title: '交易系统需优化',
          text: `胜率 ${pnl.winRate.toFixed(1)}%、盈亏比 ${pnl.profitFactor.toFixed(2)}，建议复盘亏损交易，优化入场策略。`,
        });
      }

      if (pnl.streaks.maxLossStreak >= 5) {
        recommendations.push({
          type: 'warning',
          title: '情绪管理提醒',
          text: `出现 ${pnl.streaks.maxLossStreak} 笔连续亏损，建议设置单日最大亏损限额，触发后暂停交易。`,
        });
      }
    }

    if (recommendations.length === 0) {
      recommendations.push({
        type: 'success',
        title: '交易习惯良好',
        text: '继续保持理性投资',
      });
    }

    return recommendations;
  }
}

module.exports = { RiskEngine };
