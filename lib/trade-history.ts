/**
 * Oracle-X 用户交易历史分析器
 * 读取用户在各平台的交易历史，分析交易习惯
 */

const PLATFORM_APIS = {
  // Binance API（需要用户授权 API Key）
  binance: {
    name: 'Binance',
    endpoints: {
      // 现货账户交易历史
      account: 'https://api.binance.com/api/v3/account',
      // 现货成交历史
      myTrades: 'https://api.binance.com/api/v3/myTrades',
      // 现货订单历史
      allOrders: 'https://api.binance.com/api/v3/allOrders',
      // 持仓（U本位合约）
      position: 'https://fapi.binance.com/fapi/v3/positionRisk',
      // 账户收益（U本位合约）
      accountBalance: 'https://fapi.binance.com/fapi/v3/accountBalance',
    },
    parseTrades: (data) => {
      // 解析 Binance 成交记录
      return data.map(t => ({
        platform: 'binance',
        symbol: t.symbol,
        side: t.isBuyer ? 'BUY' : 'SELL',
        price: parseFloat(t.price),
        qty: parseFloat(t.qty),
        commission: parseFloat(t.commission),
        time: new Date(t.time).toISOString(),
        orderId: t.orderId,
      }));
    }
  },

  // OKX API
  okx: {
    name: 'OKX',
    endpoints: {
      // 账户资产
      balance: 'https://www.okx.com/api/v5/account/balance',
      // 历史成交
      history: 'https://www.okx.com/api/v5/trade/fills',
      // 历史订单
      orders: 'https://www.okx.com/api/v5/trade/orders-history-last-7days',
    },
    parseTrades: (data) => {
      if (!data.data) return [];
      return data.data[0]?.fills?.map(t => ({
        platform: 'okx',
        symbol: t.instId,
        side: t.side,
        price: parseFloat(t.fillPx),
        qty: parseFloat(t.fillSz),
        commission: parseFloat(t.fee),
        time: new Date(t.fillTime).toISOString(),
        orderId: t.ordId,
      })) || [];
    }
  },

  // Bybit API
  bybit: {
    name: 'Bybit',
    endpoints: {
      // 仓位信息
      positions: 'https://api.bybit.com/v5/position/closed-pnl',
      // 历史成交
      executions: 'https://api.bybit.com/v5/execution/list',
      // 钱包余额
      wallet: 'https://api.bybit.com/v5/account/wallet-balance',
    },
    parseTrades: (data) => {
      if (!data.list) return [];
      return data.list.map(t => ({
        platform: 'bybit',
        symbol: t.symbol,
        side: t.side,
        price: parseFloat(t.execPrice),
        qty: parseFloat(t.execQty),
        commission: parseFloat(t.commission),
        time: new Date(t.execTime).toISOString(),
        orderId: t.orderId,
      })) || [];
    }
  },
};

/**
 * 用户交易历史分析器
 */
class TradeHistoryAnalyzer {
  constructor() {
    this.platforms = {};
  }

  /**
   * 添加平台 API 凭证
   */
  addPlatform(platform, apiKey, apiSecret) {
    this.platforms[platform] = { apiKey, apiSecret };
  }

  /**
   * 生成签名（用于需要签名的 API）
   */
  sign(method, url, params, secret) {
    const crypto = require('crypto');
    const query = new URLSearchParams(params).toString();
    const timestamp = Date.now();
    const signStr = timestamp + method + new URL(url).pathname + query;
    const signature = crypto.createHmac('sha256', secret).update(signStr).digest('hex');
    return { timestamp, signature };
  }

  /**
   * 获取所有平台的交易历史
   */
  async getAllTrades(days = 30) {
    const results = {};
    
    for (const [platform, creds] of Object.entries(this.platforms)) {
      try {
        const trades = await this.getPlatformTrades(platform, days);
        results[platform] = trades;
      } catch (err) {
        console.error(`[TradeHistory] Failed to fetch ${platform}:`, err);
        results[platform] = [];
      }
    }
    
    return results;
  }

  /**
   * 获取单个平台的交易历史
   */
  async getPlatformTrades(platform, days = 30) {
    const config = PLATFORM_APIS[platform];
    if (!config) return [];

    const creds = this.platforms[platform];
    if (!creds?.apiKey) return [];

    const endTime = Date.now();
    const startTime = endTime - days * 24 * 60 * 60 * 1000;

    try {
      // 简化实现：实际需要根据不同平台构造签名
      const url = `${config.endpoints.myTrades}?symbol=BTCUSDT&limit=500`;
      
      const response = await fetch(url, {
        headers: {
          'X-MBX-APIKEY': creds.apiKey
        }
      });
      
      if (!response.ok) return [];
      
      const data = await response.json();
      return config.parseTrades(data);
    } catch (err) {
      console.error(`[TradeHistory] ${platform} error:`, err);
      return [];
    }
  }

  /**
   * 分析用户交易习惯
   */
  analyzePattern(tradesByPlatform) {
    const allTrades = Object.values(tradesByPlatform).flat();
    
    if (allTrades.length === 0) {
      return { error: 'No trading data available' };
    }

    // 统计
    const stats = {
      totalTrades: allTrades.length,
      platforms: Object.keys(tradesByPlatform).filter(k => tradesByPlatform[k].length > 0),
      totalVolume: 0,
      totalFees: 0,
      bySymbol: {},
      bySide: { BUY: 0, SELL: 0 },
      byHour: {},
      avgTradeSize: 0,
      winRate: 0, // 需要匹配买卖对计算
    };

    // 详细分析
    for (const trade of allTrades) {
      stats.totalVolume += trade.price * trade.qty;
      stats.totalFees += trade.commission;
      
      // 按交易对统计
      if (!stats.bySymbol[trade.symbol]) {
        stats.bySymbol[trade.symbol] = { trades: 0, volume: 0 };
      }
      stats.bySymbol[trade.symbol].trades++;
      stats.bySymbol[trade.symbol].volume += trade.price * trade.qty;
      
      // 买卖统计
      if (trade.side === 'BUY' || trade.side === 'buy') stats.bySide.BUY++;
      if (trade.side === 'SELL' || trade.side === 'sell') stats.bySide.SELL++;
      
      // 按小时统计
      const hour = new Date(trade.time).getHours();
      stats.byHour[hour] = (stats.byHour[hour] || 0) + 1;
    }

    stats.avgTradeSize = stats.totalVolume / stats.totalTrades;
    
    // 计算交易频率
    const dates = new Set(allTrades.map(t => new Date(t.time).toDateString()));
    stats.tradingDays = dates.size;
    stats.avgTradesPerDay = (stats.totalTrades / stats.tradingDays).toFixed(2);

    // 判断交易风格
    let style = 'investor';
    if (stats.tradingDays > 20 && stats.avgTradesPerDay > 5) {
      style = 'dayTrader';
    } else if (stats.tradingDays > 10 && stats.avgTradesPerDay > 1) {
      style = 'swingTrader';
    }

    return {
      stats,
      style,
      topSymbols: Object.entries(stats.bySymbol)
        .sort((a, b) => b[1].volume - a[1].volume)
        .slice(0, 5)
        .map(([sym, d]) => ({ symbol: sym, ...d })),
      peakHours: Object.entries(stats.byHour)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([h, c]) => ({ hour: parseInt(h), count: c })),
    };
  }
}

module.exports = { TradeHistoryAnalyzer, PLATFORM_APIS };
