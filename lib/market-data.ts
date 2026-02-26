/**
 * Oracle-X 市场数据获取与分析模块
 * 获取市场现状、技术指标、市场情绪分析
 */

const BINANCE_API = 'https://api.binance.com/api/v3';

// 技术指标计算
const INDICATORS = {
  /**
   * 计算 RSI (Relative Strength Index)
   */
  calculateRSI: (closes, period = 14) => {
    if (closes.length < period + 1) return null;
    
    let gains = 0, losses = 0;
    
    // 初始平均涨跌幅
    for (let i = closes.length - period; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }
    
    let avgGain = gains / period;
    let avgLoss = losses / period;
    
    // 后续使用平滑
    for (let i = closes.length - period - 1; i >= 0; i--) {
      const change = closes[i] - closes[i - 1];
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? Math.abs(change) : 0;
      
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }
    
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    return {
      value: Math.round(rsi * 100) / 100,
      signal: rsi > 70 ? 'OVERBOUGHT' : rsi < 30 ? 'OVERSOLD' : 'NEUTRAL',
      description: rsi > 70 ? '超买区域，注意风险' : rsi < 30 ? '超卖区域，可能反弹' : '中性区域'
    };
  },

  /**
   * 计算 MACD
   */
  calculateMACD: (closes, fast = 12, slow = 26, signal = 9) => {
    if (closes.length < slow) return null;
    
    // 计算 EMA
    const calcEMA = (data, period) => {
      const k = 2 / (period + 1);
      let ema = data.slice(0, period).reduce((a, b) => a + b) / period;
      const result = [ema];
      
      for (let i = period; i < data.length; i++) {
        ema = data[i] * k + ema * (1 - k);
        result.push(ema);
      }
      return result;
    };
    
    const emaFast = calcEMA(closes, fast);
    const emaSlow = calcEMA(closes, slow);
    const macdLine = emaFast.map((f, i) => f - emaSlow[i]);
    const signalLine = calcEMA(macdLine.slice(-9), 9);
    const histogram = macdLine.slice(-1)[0] - signalLine.slice(-1)[0];
    
    return {
      macd: Math.round(macdLine.slice(-1)[0] * 100) / 100,
      signal: Math.round(signalLine.slice(-1)[0] * 100) / 100,
      histogram: Math.round(histogram * 100) / 100,
      description: histogram > 0 ? '多头信号' : '空头信号'
    };
  },

  /**
   * 计算布林带
   */
  calculateBollingerBands: (closes, period = 20, stdDev = 2) => {
    if (closes.length < period) return null;
    
    const recent = closes.slice(-period);
    const sma = recent.reduce((a, b) => a + b) / period;
    const variance = recent.reduce((sum, p) => sum + Math.pow(p - sma, 2), 0) / period;
    const std = Math.sqrt(variance);
    
    const upper = sma + stdDev * std;
    const lower = sma - stdDev * std;
    const position = (closes.slice(-1)[0] - lower) / (upper - lower) * 100;
    
    return {
      upper: Math.round(upper * 100) / 100,
      middle: Math.round(sma * 100) / 100,
      lower: Math.round(lower * 100) / 100,
      position: Math.round(position * 100) / 100,
      description: position > 80 ? '触及上轨，注意回调' : position < 20 ? '触及下轨，可能反弹' : '在中轨附近'
    };
  },

  /**
   * 计算 ATR (Average True Range)
   */
  calculateATR: (klines, period = 14) => {
    if (klines.length < period + 1) return null;
    
    const highs = klines.map(k => parseFloat(k.high));
    const lows = klines.map(k => parseFloat(k.low));
    const closes = klines.map(k => parseFloat(k.close));
    
    const trs = [];
    for (let i = 1; i < highs.length; i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      trs.push(tr);
    }
    
    const atr = trs.slice(-period).reduce((a, b) => a + b) / period;
    const volatility = atr / closes.slice(-1)[0] * 100;
    
    return {
      value: Math.round(atr * 100) / 100,
      volatility: Math.round(volatility * 100) / 100,
      description: volatility > 5 ? '高波动率' : volatility > 2 ? '中等波动率' : '低波动率'
    };
  }
};

/**
 * 市场数据获取器
 */
class MarketDataFetcher {
  constructor() {
    this.baseUrl = BINANCE_API;
  }

  /**
   * 获取 K 线数据
   */
  async getKlines(symbol, interval = '1h', limit = 200) {
    try {
      const url = `${this.baseUrl}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
      const res = await fetch(url);
      const data = await res.json();
      
      return data.map(k => ({
        openTime: k[0],
        open: k[1],
        high: k[2],
        low: k[3],
        close: k[4],
        volume: k[5],
        closeTime: k[6],
      }));
    } catch (err) {
      console.error('[Market] Failed to fetch klines:', err);
      return [];
    }
  }

  /**
   * 获取 24h 行情统计
   */
  async get24hTicker(symbol) {
    try {
      const url = `${this.baseUrl}/ticker/24hr?symbol=${symbol}`;
      const res = await fetch(url);
      return await res.json();
    } catch (err) {
      console.error('[Market] Failed to fetch ticker:', err);
      return null;
    }
  }

  /**
   * 获取恐惧贪婪指数（模拟，实际需要 API）
   */
  async getFearGreedIndex() {
    // 简化实现：基于 BTC 走势模拟
    // 实际可接入 alternative.me API
    try {
      const ticker = await this.get24hTicker('BTCUSDT');
      const change = parseFloat(ticker?.priceChangePercent || 0);
      
      // 基于价格变化估算
      let value, label;
      if (change > 5) {
        value = Math.min(100, 75 + change * 2);
        label = 'Extreme Greed';
      } else if (change > 2) {
        value = 50 + change * 5;
        label = 'Greed';
      } else if (change < -5) {
        value = Math.max(0, 25 + change * 2);
        label = 'Extreme Fear';
      } else if (change < -2) {
        value = 50 + change * 5;
        label = 'Fear';
      } else {
        value = 50;
        label = 'Neutral';
      }
      
      return {
        value: Math.round(value),
        label: label === 'Extreme Fear' ? '极度恐惧' : 
              label === 'Fear' ? '恐惧' : 
              label === 'Neutral' ? '中性' : 
              label === 'Greed' ? '贪婪' : '极度贪婪'
      };
    } catch {
      return { value: 50, label: '中性' };
    }
  }

  /**
   * 综合市场分析
   */
  async analyzeMarket(symbol = 'BTCUSDT') {
    const [klines, ticker, fgi] = await Promise.all([
      this.getKlines(symbol, '1h', 100),
      this.get24hTicker(symbol),
      this.getFearGreedIndex()
    ]);

    if (klines.length === 0) {
      return { error: 'Failed to fetch market data' };
    }

    const closes = klines.map(k => parseFloat(k.close));

    // 计算技术指标
    const indicators = {
      rsi: INDICATORS.calculateRSI(closes),
      macd: INDICATORS.calculateMACD(closes),
      bollinger: INDICATORS.calculateBollingerBands(closes),
      atr: INDICATORS.calculateATR(klines)
    };

    return {
      symbol,
      price: ticker?.lastPrice || closes.slice(-1)[0],
      change24h: ticker?.priceChangePercent || '0',
      volume24h: ticker?.volume || '0',
      high24h: ticker?.highPrice || '0',
      low24h: ticker?.lowPrice || '0',
      fearGreedIndex: fgi,
      indicators,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = { MarketDataFetcher, INDICATORS };
