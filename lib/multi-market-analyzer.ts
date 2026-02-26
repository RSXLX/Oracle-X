/**
 * Oracle-X 多市场交易历史分析器
 * 支持：加密货币、股票、期货、外汇
 */

const MARKET_CONFIGS = {
  // 加密货币
  crypto: {
    name: '加密货币',
    exchanges: {
      binance: {
        name: 'Binance',
        endpoints: {
          trades: 'https://api.binance.com/api/v3/myTrades',
          orders: 'https://api.binance.com/api/v3/allOrders',
          account: 'https://api.binance.com/api/v3/account',
        },
        needSecret: true
      },
      bybit: {
        name: 'Bybit',
        endpoints: {
          trades: 'https://api.bybit.com/v5/execution/list',
          orders: 'https://api.bybit.com/v5/order/history',
          positions: 'https://api.bybit.com/v5/position/closed-pnl',
        },
        needSecret: true
      }
    }
  },
  
  // 股票
  stock: {
    name: '股票',
    brokers: {
      alpaca: {
        name: 'Alpaca',
        endpoints: {
          positions: 'https://paper-api.alpaca.markets/v2/positions',
          orders: 'https://paper-api.alpaca.markets/v2/orders',
          account: 'https://paper-api.alpaca.markets/v2/account',
        },
        needSecret: true
      },
      ib: {
        name: 'Interactive Brokers',
        // IB 需要 TWS API
        needSecret: true
      }
    }
  },
  
  // 期货
  futures: {
    name: '期货',
    exchanges: {
      binance_futures: {
        name: 'Binance Futures',
        endpoints: {
          positions: 'https://fapi.binance.com/fapi/v3/positionRisk',
          trades: 'https://fapi.binance.com/fapi/v3/userTrades',
          balance: 'https://fapi.binance.com/fapi/v3/account',
        },
        needSecret: true
      }
    }
  },
  
  // 外汇
  forex: {
    name: '外汇',
    brokers: {
      oanda: {
        name: 'OANDA',
        needSecret: true
      },
      forexcom: {
        name: 'FOREX.com',
        needSecret: true
      }
    }
  }
};

/**
 * 多市场交易历史分析器
 */
class MultiMarketTradeAnalyzer {
  constructor() {
    this.credentials = {};
    this.cache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5分钟缓存
  }

  /**
   * 添加账户凭证
   */
  addCredential(market, exchange, apiKey, apiSecret = '') {
    this.credentials[`${market}_${exchange}`] = { apiKey, apiSecret };
  }

  /**
   * 获取交易历史
   */
  async getTrades(market, exchange, symbol, days = 30) {
    const cacheKey = `${market}_${exchange}_${symbol}_${days}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    try {
      const data = await this.fetchTrades(market, exchange, symbol, days);
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch (err) {
      console.error('[TradeAnalyzer] Failed to fetch:', err);
      return [];
    }
  }

  /**
   * 获取持仓
   */
  async getPositions(market, exchange) {
    const creds = this.credentials[`${market}_${exchange}`];
    if (!creds?.apiKey) return [];

    switch (exchange) {
      case 'binance':
        return this.fetchBinancePositions(creds);
      case 'alpaca':
        return this.fetchAlpacaPositions(creds);
      default:
        return [];
    }
  }

  /**
   * 获取账户信息
   */
  async getAccountInfo(market, exchange) {
    const creds = this.credentials[`${market}_${exchange}`];
    if (!creds?.apiKey) return null;

    switch (exchange) {
      case 'binance':
        return this.fetchBinanceAccount(creds);
      default:
        return null;
    }
  }

  // === 私有方法 ===

  async fetchTrades(market, exchange, symbol, days) {
    const creds = this.credentials[`${market}_${exchange}`];
    if (!creds?.apiKey) return [];

    const endTime = Date.now();
    const startTime = endTime - days * 24 * 60 * 60 * 1000;

    switch (exchange) {
      case 'binance':
        return this.fetchBinanceTrades(creds, symbol, startTime);
      default:
        return [];
    }
  }

  async fetchBinanceTrades(creds, symbol, startTime) {
    try {
      const url = `https://api.binance.com/api/v3/myTrades?symbol=${symbol}&startTime=${startTime}&limit=1000`;
      const res = await fetch(url, {
        headers: { 'X-MBX-APIKEY': creds.apiKey }
      });
      
      if (!res.ok) return [];
      
      const data = await res.json();
      return data.map(t => ({
        id: t.id,
        market: 'crypto',
        exchange: 'binance',
        symbol: t.symbol,
        side: t.isBuyer ? 'BUY' : 'SELL',
        price: parseFloat(t.price),
        qty: parseFloat(t.qty),
        commission: parseFloat(t.commission),
        time: new Date(t.time).toISOString(),
      }));
    } catch {
      return [];
    }
  }

  async fetchBinancePositions(creds) {
    try {
      const url = 'https://fapi.binance.com/fapi/v3/positionRisk';
      const res = await fetch(url, {
        headers: { 'X-MBX-APIKEY': creds.apiKey }
      });
      
      if (!res.ok) return [];
      
      const data = await res.json();
      return data.filter(p => parseFloat(p.positionAmt) !== 0).map(p => ({
        symbol: p.symbol,
        side: parseFloat(p.positionAmt) > 0 ? 'LONG' : 'SHORT',
        qty: Math.abs(parseFloat(p.positionAmt)),
        entryPrice: parseFloat(p.entryPrice),
        markPrice: parseFloat(p.markPrice),
        pnl: parseFloat(p.unrealizedProfit),
        leverage: parseFloat(p.leverage),
      }));
    } catch {
      return [];
    }
  }

  async fetchBinanceAccount(creds) {
    try {
      const url = 'https://api.binance.com/api/v3/account';
      const res = await fetch(url, {
        headers: { 'X-MBX-APIKEY': creds.apiKey }
      });
      
      if (!res.ok) return null;
      
      const data = await res.json();
      return {
        balances: data.balances.filter(b => parseFloat(b.free) > 0).map(b => ({
          asset: b.asset,
          free: parseFloat(b.free),
          locked: parseFloat(b.locked),
        })),
        totalAsset: parseFloat(data.totalAsset || 0),
      };
    } catch {
      return null;
    }
  }

  async fetchAlpacaPositions(creds) {
    try {
      const res = await fetch('https://paper-api.alpaca.markets/v2/positions', {
        headers: {
          'APCA-API-KEY-ID': creds.apiKey,
          'APCA-API-SECRET-KEY': creds.apiSecret,
        }
      });
      
      if (!res.ok) return [];
      
      const data = await res.json();
      return data.map(p => ({
        symbol: p.symbol,
        qty: parseFloat(p.qty),
        side: p.side === 'long' ? 'LONG' : 'SHORT',
        avgEntryPrice: parseFloat(p.avg_entry_price),
        currentPrice: parseFloat(p.current_price),
        marketValue: parseFloat(p.market_value),
        unrealizedPL: parseFloat(p.unrealized_pl),
      }));
    } catch {
      return [];
    }
  }

  /**
   * 综合分析交易习惯
   */
  analyzePattern(trades) {
    if (!trades?.length) {
      return {
        error: 'No trading data',
        style: 'unknown',
        stats: {}
      };
    }

    const stats = {
      totalTrades: trades.length,
      totalVolume: 0,
      totalFees: 0,
      bySymbol: {},
      bySide: { BUY: 0, SELL: 0 },
      byHour: new Array(24).fill(0),
      byDay: new Array(7).fill(0),
      avgTradeSize: 0,
      winRate: 0,
    };

    // 统计
    for (const t of trades) {
      stats.totalVolume += t.price * t.qty;
      stats.totalFees += t.commission || 0;
      
      // 按交易对
      if (!stats.bySymbol[t.symbol]) {
        stats.bySymbol[t.symbol] = { trades: 0, volume: 0, pnl: 0 };
      }
      stats.bySymbol[t.symbol].trades++;
      stats.bySymbol[t.symbol].volume += t.price * t.qty;
      
      // 买卖方向
      if (t.side === 'BUY' || t.side === 'buy') stats.bySide.BUY++;
      else if (t.side === 'SELL' || t.side === 'sell') stats.bySide.SELL++;
      
      // 时间分布
      const hour = new Date(t.time).getHours();
      const day = new Date(t.time).getDay();
      stats.byHour[hour]++;
      stats.byDay[day]++;
    }

    stats.avgTradeSize = stats.totalVolume / stats.totalTrades;

    // 判断交易风格
    const tradingDays = new Set(trades.map(t => new Date(t.time).toDateString())).size;
    const avgPerDay = stats.totalTrades / Math.max(1, tradingDays);

    let style = 'investor';
    if (avgPerDay > 10) style = 'dayTrader';
    else if (avgPerDay > 2) style = 'swingTrader';
    else if (avgPerDay > 0.3) style = 'positionTrader';

    return {
      style,
      stats,
      topSymbols: Object.entries(stats.bySymbol)
        .sort((a, b) => b[1].volume - a[1].volume)
        .slice(0, 5)
        .map(([sym, d]) => ({ symbol: sym, ...d })),
      peakHours: stats.byHour
        .map((c, h) => ({ hour: h, count: c }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3),
    };
  }
}

module.exports = { MultiMarketTradeAnalyzer, MARKET_CONFIGS };
