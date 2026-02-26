/**
 * Oracle-X 市场与情绪数据源管理器
 * 支持用户自定义数据源，数据提炼服务
 */

// 支持的市场类型
const MARKET_TYPES = {
  CRYPTO: 'crypto',
  STOCK: 'stock',
  FOREX: 'forex',
  FUTURES: 'futures',
  OPTIONS: 'options',
};

// 市场数据源配置
const DATA_SOURCES = {
  // 加密货币
  crypto: {
    binance: { name: 'Binance', type: 'exchange', api: 'https://api.binance.com' },
    coinbase: { name: 'Coinbase', type: 'exchange', api: 'https://api.coinbase.com' },
    bybit: { name: 'Bybit', type: 'exchange', api: 'https://api.bybit.com' },
  },
  // 股票（需要 API key）
  stock: {
    alpaca: { name: 'Alpaca', type: 'broker', api: 'https://data.alpaca.markets' },
    polygon: { name: 'Polygon', type: 'data', api: 'https://api.polygon.io' },
    yahoo: { name: 'Yahoo Finance', type: 'data', api: 'query1.finance.yahoo.com' },
  },
  // 期货
  futures: {
    binance_futures: { name: 'Binance Futures', type: 'exchange', api: 'https://fapi.binance.com' },
    bybit_futures: { name: 'Bybit Futures', type: 'exchange', api: 'https://api.bybit.com' },
  },
  // 外汇
  forex: {
    forexfactory: { name: 'Forex Factory', type: 'calendar', api: 'https://www.forexfactory.com' },
    exchangerate: { name: 'Exchange Rate', type: 'data', api: 'https://api.exchangerate-api.com' },
  },
};

// 情绪数据源
const SENTIMENT_SOURCES = {
  twitter: {
    name: 'Twitter/X',
    type: 'social',
    config: { apiKey: true, endpoint: 'https://twitter241.p.rapidapi.com' },
  },
  telegram: {
    name: 'Telegram',
    type: 'social',
    config: { botToken: true, chatIds: [] },
  },
  discord: {
    name: 'Discord',
    type: 'social',
    config: { botToken: true, channelIds: [] },
  },
  news: {
    name: 'News API',
    type: 'news',
    config: { apiKey: true, endpoint: 'https://newsapi.org/v2' },
  },
  cryptoPanic: {
    name: 'CryptoPanic',
    type: 'news',
    config: { apiKey: true, endpoint: 'https://cryptopanic.com/api/v1' },
  },
  coingecko: {
    name: 'CoinGecko',
    type: 'data',
    config: { apiKey: false, endpoint: 'https://api.coingecko.com/v3' },
  },
};

/**
 * 数据源管理器
 */
class DataSourceManager {
  constructor() {
    this.config = {
      markets: ['crypto'], // 启用的市场
      sentimentSources: ['coingecko'], // 启用的情绪源
      credentials: {}, // API 凭证
    };
  }

  /**
   * 配置市场数据源
   */
  configureMarket(market, source, credentials = {}) {
    if (!DATA_SOURCES[market]?.[source]) {
      throw new Error(`Unknown market/source: ${market}/${source}`);
    }
    
    this.config.markets = [...new Set([...this.config.markets, market])];
    this.config.credentials[`${market}_${source}`] = credentials;
  }

  /**
   * 配置情绪数据源
   */
  configureSentiment(source, credentials = {}) {
    if (!SENTIMENT_SOURCES[source]) {
      throw new Error(`Unknown sentiment source: ${source}`);
    }
    
    this.config.sentimentSources = [...new Set([...this.config.sentimentSources, source])];
    if (credentials) {
      this.config.credentials[source] = credentials;
    }
  }

  /**
   * 获取启用的市场
   */
  getEnabledMarkets() {
    return this.config.markets;
  }

  /**
   * 获取启用的情绪源
   */
  getEnabledSentimentSources() {
    return this.config.sentimentSources;
  }

  /**
   * 数据提炼服务
   */
  async refineMarketData(market, symbol) {
    const results = {};
    
    // 根据市场类型获取数据
    for (const source of this.config.markets) {
      try {
        const data = await this.fetchMarketData(source, symbol);
        if (data) {
          results[source] = this.normalizeData(source, data);
        }
      } catch (err) {
        console.warn(`[DataRefine] ${source} failed:`, err.message);
      }
    }
    
    return this.aggregateMarketData(results);
  }

  /**
   * 获取市场数据
   */
  async fetchMarketData(source, symbol) {
    const creds = this.config.credentials[`${source}`];
    
    switch (source) {
      case 'binance':
        return this.fetchBinance(symbol);
      case 'coingecko':
        return this.fetchCoinGecko(symbol);
      default:
        return null;
    }
  }

  /**
   * Binance 数据获取
   */
  async fetchBinance(symbol) {
    try {
      const [ticker, klines] = await Promise.all([
        fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`).then(r => r.json()),
        fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=100`).then(r => r.json())
      ]);
      return { ticker, klines };
    } catch {
      return null;
    }
  }

  /**
   * CoinGecko 数据获取
   */
  async fetchCoinGecko(symbol) {
    const id = symbol.replace('USDT', '').toLowerCase();
    try {
      const [market, history] = await Promise.all([
        fetch(`https://api.coingecko.com/v3/coins/${id}?localization=false&tickers=false&community_data=false&developer_data=false`).then(r => r.json()),
        fetch(`https://api.coingecko.com/v3/coins/${id}/market_chart?vs_currency=usd&days=7`).then(r => r.json())
      ]);
      return { market, history };
    } catch {
      return null;
    }
  }

  /**
   * 数据标准化
   */
  normalizeData(source, data) {
    // 统一数据结构
    const normalized = {
      source,
      timestamp: Date.now(),
      price: 0,
      change24h: 0,
      volume24h: 0,
      high24h: 0,
      low24h: 0,
      marketCap: 0,
    };

    switch (source) {
      case 'binance':
        if (data.ticker) {
          normalized.price = parseFloat(data.ticker.lastPrice);
          normalized.change24h = parseFloat(data.ticker.priceChangePercent);
          normalized.volume24h = parseFloat(data.ticker.volume);
          normalized.high24h = parseFloat(data.ticker.highPrice);
          normalized.low24h = parseFloat(data.ticker.lowPrice);
        }
        break;
      case 'coingecko':
        if (data.market) {
          normalized.price = data.market.market_data?.current_price?.usd || 0;
          normalized.change24h = data.market.market_data?.price_change_percentage_24h || 0;
          normalized.volume24h = data.market.market_data?.total_volume?.usd || 0;
          normalized.high24h = data.market.market_data?.high_24h?.usd || 0;
          normalized.low24h = data.market.market_data?.low_24h?.usd || 0;
          normalized.marketCap = data.market.market_data?.market_cap?.usd || 0;
        }
        break;
    }

    return normalized;
  }

  /**
   * 数据聚合
   */
  aggregateMarketData(results) {
    const sources = Object.keys(results);
    if (sources.length === 0) return null;
    
    if (sources.length === 1) {
      return { ...results[sources[0]], aggregated: false };
    }

    // 多源加权平均
    let totalWeight = 0;
    let weightedPrice = 0;
    let totalVolume = 0;

    for (const source of sources) {
      const r = results[source];
      const weight = r.volume24h > 0 ? Math.log10(r.volume24h) : 1;
      weightedPrice += r.price * weight;
      totalVolume += r.volume24h;
      totalWeight += weight;
    }

    return {
      aggregated: true,
      sources,
      price: weightedPrice / totalWeight,
      totalVolume,
      timestamp: Date.now(),
      bySource: results
    };
  }

  /**
   * 情绪数据提炼
   */
  async refineSentiment(symbol) {
    const results = {};
    
    for (const source of this.config.sentimentSources) {
      try {
        const data = await this.fetchSentimentData(source, symbol);
        if (data) {
          results[source] = this.analyzeSentiment(source, data);
        }
      } catch (err) {
        console.warn(`[Sentiment] ${source} failed:`, err.message);
      }
    }
    
    return this.aggregateSentiment(results);
  }

  /**
   * 获取情绪数据
   */
  async fetchSentimentData(source, symbol) {
    switch (source) {
      case 'coingecko':
        const id = symbol.replace('USDT', '').toLowerCase();
        return fetch(`https://api.coingecko.com/v3/coins/${id}/sentiment`).then(r => r.json()).catch(() => null);
      default:
        return null;
    }
  }

  /**
   * 分析情绪
   */
  analyzeSentiment(source, data) {
    // 简化实现
    if (source === 'coingecko' && data?.data) {
      const atb = data.data?.sentiment_votes_up_percentage || 50;
      return {
        source,
        score: atb,
        sentiment: atb > 60 ? 'BULLISH' : atb < 40 ? 'BEARISH' : 'NEUTRAL',
        confidence: Math.abs(atb - 50) + 20
      };
    }
    return { source, score: 50, sentiment: 'NEUTRAL', confidence: 20 };
  }

  /**
   * 聚合情绪
   */
  aggregateSentiment(results) {
    const sources = Object.keys(results);
    if (sources.length === 0) return { sentiment: 'NEUTRAL', score: 50, confidence: 0 };
    
    let totalScore = 0;
    let totalConfidence = 0;
    
    for (const source of sources) {
      totalScore += results[source].score * results[source].confidence;
      totalConfidence += results[source].confidence;
    }
    
    const avgScore = totalScore / totalConfidence;
    
    return {
      sentiment: avgScore > 60 ? 'BULLISH' : avgScore < 40 ? 'BEARISH' : 'NEUTRAL',
      score: Math.round(avgScore),
      confidence: Math.min(90, totalConfidence),
      sources
    };
  }
}

module.exports = { 
  DataSourceManager, 
  MARKET_TYPES, 
  DATA_SOURCES, 
  SENTIMENT_SOURCES 
};
