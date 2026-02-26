/**
 * Oracle-X 市场情绪分析器
 * 分析 Twitter/社交媒体情绪
 */

const SENTIMENT_ANALYZERS = {
  /**
   * 基于关键词的情绪分类
   */
  keywordBased: {
    name: '关键词分析',
    analyze: (texts) => {
      const positive = [
        'bullish', 'pump', 'moon', 'buy', 'long', 'breakout', 'surge', 'rally',
      'higher', 'up', 'gain', 'profit', 'bull', 'green', 'ath', 'strong',
      '🚀', '📈', '💎', '🔥', '💪', '🟢', '牛', '多', '涨', '突破'
      ];
      const negative = [
        'bearish', 'dump', 'crash', 'sell', 'short', 'breakdown', 'drop', 'fall',
        'lower', 'down', 'loss', 'bear', 'red', 'weak', 'fear', 'scam', '崩',
        '📉', '🔴', '💀', '⚠️', '熊', '空', '跌', '爆仓'
      ];

      let pos = 0, neg = 0;
      for (const text of texts) {
        const lower = text.toLowerCase();
        for (const p of positive) if (lower.includes(p)) pos++;
        for (const n of negative) if (lower.includes(n)) neg++;
      }

      const total = pos + neg;
      if (total === 0) return { sentiment: 'NEUTRAL', score: 50, confidence: 30 };

      const ratio = pos / total;
      return {
        sentiment: ratio > 0.6 ? 'BULLISH' : ratio < 0.4 ? 'BEARISH' : 'NEUTRAL',
        score: Math.round(ratio * 100),
        confidence: Math.min(90, 30 + total * 5),
        positive: pos,
        negative: neg
      };
    }
  }
};

/**
 * 市场情绪聚合器
 */
class MarketSentimentAnalyzer {
  constructor() {
    this.twitterApiKey = '';
  }

  setTwitterKey(key) {
    this.twitterApiKey = key;
  }

  /**
   * 获取 Twitter 情绪
   */
  async getTwitterSentiment(symbol) {
    if (!this.twitterApiKey) {
      return this.getFallbackSentiment(symbol);
    }

    try {
      const query = this.getSearchQuery(symbol);
      const url = `https://twitter241.p.rapidapi.com/search?type=Top&count=20&query=${encodeURIComponent(query)}`;

      const response = await fetch(url, {
        headers: {
          'x-rapidapi-host': 'twitter241.p.rapidapi.com',
          'x-rapidapi-key': this.twitterApiKey
        }
      });

      if (!response.ok) {
        return this.getFallbackSentiment(symbol);
      }

      const data = await response.json();
      const tweets = this.parseTweets(data);
      
      return SENTIMENT_ANALYZERS.keywordBased.analyze(tweets);
    } catch (err) {
      console.error('[Sentiment] Twitter API failed:', err);
      return this.getFallbackSentiment(symbol);
    }
  }

  /**
   * 解析 Twitter API 响应
   */
  parseTweets(data) {
    const texts = [];
    try {
      const entries = data?.result?.timeline?.instructions?.[0]?.entries || [];
      for (const entry of entries) {
        const tweet = entry?.content?.itemContent?.tweet_results?.result;
        if (tweet?.legacy?.full_text) {
          texts.push(tweet.legacy.full_text);
        }
      }
    } catch {}
    return texts;
  }

  /**
   * 获取搜索关键词
   */
  getSearchQuery(symbol) {
    const map = {
      'BTCUSDT': 'bitcoin OR btc price',
      'ETHUSDT': 'ethereum OR eth price',
      'SOLUSDT': 'solana OR sol price',
    };
    return map[symbol] || `${symbol.replace('USDT', '')} crypto`;
  }

  /**
   * 基于市场数据的降级情绪分析
   */
  getFallbackSentiment(symbol) {
    // 简化实现：基于价格走势估算
    // 实际应接入更多数据源
    return {
      sentiment: 'NEUTRAL',
      score: 50,
      confidence: 20,
      source: 'fallback',
      note: 'Configure Twitter API for better sentiment'
    };
  }

  /**
   * 综合多源情绪分析
   */
  async analyze(symbol, priceChange24h) {
    const [twitter, priceSentiment] = await Promise.all([
      this.getTwitterSentiment(symbol),
      this.analyzePriceSentiment(priceChange24h)
    ]);

    // 综合加权
    const twitterWeight = twitter.confidence > 30 ? 0.7 : 0.3;
    const priceWeight = 1 - twitterWeight;

    const combined = Math.round(
      twitter.score * twitterWeight + priceSentiment.score * priceWeight
    );

    return {
      overall: combined > 60 ? 'BULLISH' : combined < 40 ? 'BEARISH' : 'NEUTRAL',
      score: combined,
      sources: {
        twitter,
        price: priceSentiment
      },
      recommendation: combined > 70 ? '过度乐观，注意风险' : 
                       combined < 30 ? '过度悲观，可能有机会' : '情绪中性'
    };
  }

  /**
   * 基于价格波动的情绪分析
   */
  analyzePriceSentiment(change24h) {
    const change = parseFloat(change24h) || 0;
    
    if (change > 10) {
      return { sentiment: 'BULLISH', score: 85, source: 'price' };
    } else if (change > 5) {
      return { sentiment: 'BULLISH', score: 70, source: 'price' };
    } else if (change > 2) {
      return { sentiment: 'BULLISH', score: 60, source: 'price' };
    } else if (change > -2) {
      return { sentiment: 'NEUTRAL', score: 50, source: 'price' };
    } else if (change > -5) {
      return { sentiment: 'BEARISH', score: 40, source: 'price' };
    } else if (change > -10) {
      return { sentiment: 'BEARISH', score: 30, source: 'price' };
    } else {
      return { sentiment: 'BEARISH', score: 15, source: 'price' };
    }
  }
}

module.exports = { MarketSentimentAnalyzer, SENTIMENT_ANALYZERS };
