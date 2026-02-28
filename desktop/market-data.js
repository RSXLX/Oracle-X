/**
 * Oracle-X 多市场行情数据模块
 * 支持：加密货币 (Binance) / A股 (新浪) / 美股 (Yahoo Finance)
 */

const BINANCE_API = 'https://api.binance.com/api/v3';

/**
 * 市场数据服务（多市场）
 */
class MarketDataService {
  constructor() {
    this.cache = new Map();
    this.cacheTTL = 60 * 1000; // 1分钟缓存
  }

  /**
   * 统一入口：根据市场类型获取行情
   */
  async getSymbolInfo(symbol, marketType = 'crypto') {
    const cacheKey = `info_${marketType}_${symbol}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.time < this.cacheTTL) {
      return cached.data;
    }

    let info = null;
    try {
      switch (marketType) {
        case 'a_share':
          info = await this.getAShareQuote(symbol);
          break;
        case 'us_stock':
          info = await this.getUSStockQuote(symbol);
          break;
        case 'hk_stock':
          info = await this.getHKStockQuote(symbol);
          break;
        case 'crypto':
        default:
          info = await this.getCryptoQuote(symbol);
          break;
      }
    } catch (err) {
      console.error(`[Market] Error fetching ${marketType}/${symbol}:`, err.message);
      return null;
    }

    if (info) {
      this.cache.set(cacheKey, { data: info, time: Date.now() });
    }
    return info;
  }

  /**
   * 加密货币行情 (Binance)
   */
  async getCryptoQuote(symbol) {
    const tickerRes = await fetch(`${BINANCE_API}/ticker/24hr?symbol=${symbol}`);
    if (!tickerRes.ok) return null;
    const ticker = await tickerRes.json();

    return {
      symbol: ticker.symbol,
      name: ticker.symbol,
      marketType: 'crypto',
      price: parseFloat(ticker.lastPrice),
      change24h: parseFloat(ticker.priceChangePercent),
      high24h: parseFloat(ticker.highPrice),
      low24h: parseFloat(ticker.lowPrice),
      volume24h: parseFloat(ticker.volume),
      quoteVolume: parseFloat(ticker.quoteVolume),
      currency: 'USDT',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * A股行情（新浪财经 API）
   */
  async getAShareQuote(symbol) {
    // 标准化代码：600xxx → sh600xxx, 000xxx → sz000xxx
    const code = symbol.replace(/[^0-9]/g, '');
    const prefix = code.startsWith('6') ? 'sh' : 'sz';
    const fullCode = `${prefix}${code}`;

    const res = await fetch(`https://hq.sinajs.cn/list=${fullCode}`, {
      headers: { 'Referer': 'https://finance.sina.com.cn' },
    });

    if (!res.ok) return null;

    const text = await res.text();
    // 解析新浪API返回格式: var hq_str_sh600519="名称,开盘价,昨收,当前价,最高,最低,...";
    const dataMatch = text.match(/"(.+)"/);
    if (!dataMatch) return null;

    const parts = dataMatch[1].split(',');
    if (parts.length < 7) return null;

    const name = parts[0];
    const openPrice = parseFloat(parts[1]);
    const prevClose = parseFloat(parts[2]);
    const currentPrice = parseFloat(parts[3]);
    const high = parseFloat(parts[4]);
    const low = parseFloat(parts[5]);
    const volume = parseFloat(parts[8]); // 成交量（股）
    const amount = parseFloat(parts[9]); // 成交金额

    const change = prevClose > 0 ? ((currentPrice - prevClose) / prevClose * 100) : 0;

    return {
      symbol: code,
      name,
      marketType: 'a_share',
      price: currentPrice,
      change24h: parseFloat(change.toFixed(2)),
      high24h: high,
      low24h: low,
      volume24h: volume,
      quoteVolume: amount,
      openPrice,
      prevClose,
      currency: 'CNY',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 美股行情（Yahoo Finance API）
   */
  async getUSStockQuote(symbol) {
    const ticker = symbol.toUpperCase().replace(/[^A-Z]/g, '');

    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const quote = result.indicators?.quote?.[0] || {};

    return {
      symbol: ticker,
      name: meta.shortName || ticker,
      marketType: 'us_stock',
      price: meta.regularMarketPrice || 0,
      change24h: meta.regularMarketChangePercent
        ? parseFloat(meta.regularMarketChangePercent.toFixed(2))
        : 0,
      high24h: quote.high?.[0] || meta.regularMarketDayHigh || 0,
      low24h: quote.low?.[0] || meta.regularMarketDayLow || 0,
      volume24h: meta.regularMarketVolume || 0,
      quoteVolume: 0,
      prevClose: meta.previousClose || 0,
      currency: meta.currency || 'USD',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 港股行情（新浪 API）
   */
  async getHKStockQuote(symbol) {
    const code = symbol.replace(/[^0-9]/g, '').padStart(5, '0');

    const res = await fetch(`https://hq.sinajs.cn/list=rt_hk${code}`, {
      headers: { 'Referer': 'https://finance.sina.com.cn' },
    });

    if (!res.ok) return null;

    const text = await res.text();
    const dataMatch = text.match(/"(.+)"/);
    if (!dataMatch) return null;

    const parts = dataMatch[1].split(',');
    if (parts.length < 10) return null;

    return {
      symbol: code,
      name: parts[1] || code,
      marketType: 'hk_stock',
      price: parseFloat(parts[6]) || 0,
      change24h: parseFloat(parts[8]) || 0,
      high24h: parseFloat(parts[4]) || 0,
      low24h: parseFloat(parts[5]) || 0,
      volume24h: parseFloat(parts[12]) || 0,
      quoteVolume: parseFloat(parts[11]) || 0,
      prevClose: parseFloat(parts[3]) || 0,
      currency: 'HKD',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 批量获取多个标的
   */
  async getMultipleSymbols(symbols, marketType = 'crypto') {
    const results = await Promise.all(
      symbols.map(s => this.getSymbolInfo(s, marketType))
    );
    return results.filter(r => r !== null);
  }

  /**
   * 获取加密货币热门排行
   */
  async getTopSymbols(limit = 20) {
    try {
      const res = await fetch(`${BINANCE_API}/ticker/24hr`);
      const data = await res.json();

      return data
        .filter(t => t.symbol.endsWith('USDT'))
        .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
        .slice(0, limit)
        .map(t => ({
          symbol: t.symbol,
          price: parseFloat(t.lastPrice),
          change24h: parseFloat(t.priceChangePercent),
          volume: parseFloat(t.quoteVolume),
          marketType: 'crypto',
        }));
    } catch (err) {
      console.error('[Market] Top symbols error:', err.message);
      return [];
    }
  }

  /**
   * 获取市场新闻/事件（预留接口）
   */
  async getMarketNews(symbol, marketType = 'crypto') {
    return {
      symbol,
      marketType,
      events: [],
      sentiment: 'neutral',
    };
  }
}

module.exports = { MarketDataService };
