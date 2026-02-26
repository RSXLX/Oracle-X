/**
 * Oracle-X 市场数据模块
 * 实时获取币种信息 + 价格数据
 */

const BINANCE_API = 'https://api.binance.com/api/v3';

/**
 * 市场数据服务
 */
class MarketDataService {
  constructor() {
    this.cache = new Map();
    this.cacheTTL = 60 * 1000; // 1分钟缓存
  }

  /**
   * 获取币种信息
   */
  async getSymbolInfo(symbol) {
    const cacheKey = `info_${symbol}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.time < this.cacheTTL) {
      return cached.data;
    }

    try {
      // 获取 ticker 数据
      const tickerRes = await fetch(`${BINANCE_API}/ticker/24hr?symbol=${symbol}`);
      const ticker = await tickerRes.json();
      
      // 获取最近价格
      const priceRes = await fetch(`${BINANCE_API}/ticker/price?symbol=${symbol}`);
      const priceData = await priceRes.json();
      
      const info = {
        symbol: ticker.symbol,
        price: parseFloat(ticker.lastPrice),
        change24h: parseFloat(ticker.priceChangePercent),
        high24h: parseFloat(ticker.highPrice),
        low24h: parseFloat(ticker.lowPrice),
        volume24h: parseFloat(ticker.volume),
        quoteVolume: parseFloat(ticker.quoteVolume),
        timestamp: new Date().toISOString(),
      };

      this.cache.set(cacheKey, { data: info, time: Date.now() });
      return info;
    } catch (err) {
      console.error('[Market] Error:', err.message);
      return null;
    }
  }

  /**
   * 批量获取多个币种
   */
  async getMultipleSymbols(symbols) {
    const results = await Promise.all(
      symbols.map(s => this.getSymbolInfo(s))
    );
    return results.filter(r => r !== null);
  }

  /**
   * 获取热门币种
   */
  async getTopSymbols(limit = 20) {
    try {
      const res = await fetch(`${BINANCE_API}/ticker/24hr`);
      const data = await res.json();
      
      // 按交易量排序
      const sorted = data
        .filter(t => t.symbol.endsWith('USDT'))
        .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
        .slice(0, limit)
        .map(t => ({
          symbol: t.symbol,
          price: parseFloat(t.lastPrice),
          change24h: parseFloat(t.priceChangePercent),
          volume: parseFloat(t.quoteVolume),
        }));

      return sorted;
    } catch (err) {
      console.error('[Market] Top symbols error:', err.message);
      return [];
    }
  }

  /**
   * 获取币种新闻/事件（简化版）
   */
  async getMarketNews(symbol) {
    // 简化实现 - 实际应该调用新闻 API
    return {
      symbol,
      events: [],
      sentiment: 'neutral',
    };
  }
}

module.exports = { MarketDataService };
