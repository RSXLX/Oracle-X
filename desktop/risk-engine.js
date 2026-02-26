/**
 * Oracle-X 风险评估引擎
 * 综合评估交易风险并提供建议
 */

class RiskEngine {
  constructor() {
    // 风险因素权重
    this.weights = {
      frequency: 0.2,
      concentration: 0.15,
      volatility: 0.2,
      leverage: 0.25,
      memeExposure: 0.2,
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
      memeExposure: this.assessMemeExposure(analysis),
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
      recommendations: this.generateRecommendations(scores),
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
    
    // 单一币种交易占比
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
   * 评估波动性风险
   */
  assessVolatility(analysis) {
    const stats = analysis?.stats || {};
    const categoryBreakdown = stats.categoryBreakdown || {};
    
    // Meme 币占比
    const memeRatio = (categoryBreakdown.meme || 0) / (stats.totalTrades || 1);
    if (memeRatio > 0.5) return 90;
    if (memeRatio > 0.3) return 70;
    if (memeRatio > 0.1) return 50;
    
    return 30;
  }

  /**
   * 评估杠杆风险
   */
  assessLeverage(analysis) {
    // 简化实现 - 需要从交易记录中检测杠杆
    return 30; // 默认低风险
  }

  /**
   * 评估 Meme 币暴露
   */
  assessMemeExposure(analysis) {
    const stats = analysis?.stats || {};
    const categoryBreakdown = stats.categoryBreakdown || {};
    
    const meme = categoryBreakdown.meme || 0;
    const total = stats.totalTrades || 1;
    
    const ratio = meme / total;
    if (ratio > 0.5) return 95;
    if (ratio > 0.3) return 75;
    if (ratio > 0.1) return 55;
    return 25;
  }

  /**
   * 生成建议
   */
  generateRecommendations(scores) {
    const recommendations = [];

    if (scores.frequency > 60) {
      recommendations.push({
        type: 'warning',
        title: '交易过于频繁',
        text: '建议降低交易频率，避免情绪化交易',
      });
    }

    if (scores.concentration > 60) {
      recommendations.push({
        type: 'warning',
        title: '投资过于集中',
        text: '建议分散投资，降低单一币种风险',
      });
    }

    if (scores.memeExposure > 60) {
      recommendations.push({
        type: 'danger',
        title: 'Meme 币风险',
        text: 'Meme 币波动大，建议控制仓位',
      });
    }

    if (scores.volatility > 50) {
      recommendations.push({
        type: 'info',
        title: '注意波动性',
        text: '近期市场波动较大，建议谨慎操作',
      });
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
