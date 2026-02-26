/**
 * Oracle-X 增强版 CSV 导入器
 * 支持自动格式识别 + 市场数据整合
 */

const fs = require('fs');

/**
 * 增强 CSV 交易记录分析器
 */
class EnhancedCSVImporter {
  constructor() {
    // 交易所格式定义
    this.formatDefinitions = {
      // Binance
      binance: {
        name: 'Binance',
        headers: ['Date(UTC)', 'Pair', 'Side', 'Price', 'Executed', 'Amount', 'Fee'],
        columnMap: {
          time: ['Date(UTC)', 'Date', 'Time'],
          symbol: ['Pair', 'Symbol', 'Market'],
          side: ['Side', 'Type', 'Action', 'Buy/Sell'],
          price: ['Price', 'Exec Price'],
          qty: ['Executed', 'Amount', 'Qty', 'Size', 'Quantity'],
          total: ['Amount', 'Total', 'Turnover'],
          fee: ['Fee', 'Commission'],
        },
      },
      // OKX
      okx: {
        name: 'OKX',
        headers: ['Trade ID', 'InstID', 'Side', 'Px', 'Sz', 'Fee'],
        columnMap: {
          time: ['Time', 'Trade Time', 'Date'],
          symbol: ['InstID', 'Instrument', 'Symbol'],
          side: ['Side', 'Buy/Sell'],
          price: ['Px', 'Price'],
          qty: ['Sz', 'Size', 'Quantity'],
          total: ['Amount', 'Total'],
          fee: ['Fee', 'Commission'],
        },
      },
      // Bybit
      bybit: {
        name: 'Bybit',
        headers: ['Order ID', 'Symbol', 'Side', 'Price', 'Qty', 'Fee'],
        columnMap: {
          time: ['Created Time', 'Time', 'Date'],
          symbol: ['Symbol', 'Pair'],
          side: ['Side', 'Buy/Sell'],
          price: ['Price', 'Exec Price'],
          qty: ['Qty', 'Quantity', 'Size'],
          total: ['Turnover', 'Total', 'Amount'],
          fee: ['Fee', 'Commission'],
        },
      },
      // Coinbase
      coinbase: {
        name: 'Coinbase',
        headers: ['Transaction Hash', 'Timestamp', 'Asset', 'Transaction Type', 'Spot Price', 'Quantity Transacted'],
        columnMap: {
          time: ['Timestamp', 'Time', 'Date'],
          symbol: ['Asset', 'Currency'],
          side: ['Transaction Type', 'Type'],
          price: ['Spot Price', 'Price'],
          qty: ['Quantity Transacted', 'Amount', 'Quantity'],
          total: ['Subtotal', 'Total', 'Amount'],
          fee: ['Fees', 'Fee'],
        },
      },
      // Kraken
      kraken: {
        name: 'Kraken',
        headers: ['txid', 'pair', 'type', 'price', 'volume', 'fee'],
        columnMap: {
          time: ['time', 'Time'],
          symbol: ['pair', 'Asset'],
          side: ['type', 'Side'],
          price: ['price', 'Price'],
          qty: ['volume', 'Amount', 'Qty'],
          total: ['cost', 'Total'],
          fee: ['fee', 'Fee'],
        },
      },
      // Gate.io
      gateio: {
        name: 'Gate.io',
        headers: ['Order ID', 'Market', 'Side', 'Price', 'Amount', 'Fee'],
        columnMap: {
          time: ['Time', 'CreateTime'],
          symbol: ['Market', 'Pair', 'Symbol'],
          side: ['Side', 'Type'],
          price: ['Price', 'Rate'],
          qty: ['Amount', 'Quantity', 'Size'],
          total: ['Total', 'Value'],
          fee: ['Fee', 'Commission'],
        },
      },
      // KuCoin
      kucoin: {
        name: 'KuCoin',
        headers: ['Order ID', 'Symbol', 'Side', 'Price', 'Size', 'Fee'],
        columnMap: {
          time: ['Time', 'Created At'],
          symbol: ['Symbol', 'Pair'],
          side: ['Side', 'Type'],
          price: ['Price', 'Deal Price'],
          qty: ['Size', 'Amount', 'Quantity'],
          total: ['Total', 'Turnover'],
          fee: ['Fee', 'Commission'],
        },
      },
    };

    // 加密货币基本信息（用于分析）
    this.cryptoInfo = {
      'BTCUSDT': { name: 'Bitcoin', symbol: 'BTC', category: 'layer1' },
      'ETHUSDT': { name: 'Ethereum', symbol: 'ETH', category: 'layer1' },
      'BNBUSDT': { name: 'BNB', symbol: 'BNB', category: 'layer1' },
      'SOLUSDT': { name: 'Solana', symbol: 'SOL', category: 'layer1' },
      'XRPUSDT': { name: 'XRP', symbol: 'XRP', category: 'layer1' },
      'ADAUSDT': { name: 'Cardano', symbol: 'ADA', category: 'layer1' },
      'DOGEUSDT': { name: 'Dogecoin', symbol: 'DOGE', category: 'meme' },
      'PEPEUSDT': { name: 'Pepe', symbol: 'PEPE', category: 'meme' },
      'ETHBTC': { name: 'Ethereum', symbol: 'ETH', category: 'layer1' },
    };
  }

  /**
   * 解析 CSV
   */
  async parseCSV(filePath) {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const lines = content.trim().split(/\r?\n/);
    
    if (lines.length < 2) {
      throw new Error('CSV 文件为空');
    }

    // 解析头部
    const header = this.parseCSVLine(lines[0]);
    
    // 自动识别格式
    const format = this.detectFormat(header);
    console.log('[CSV] Detected format:', format.name);

    // 解析数据行
    const transactions = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      try {
        const values = this.parseCSVLine(lines[i]);
        const tx = this.mapToTransaction(values, header, format);
        if (tx) transactions.push(tx);
      } catch (e) {
        // 跳过无效行
      }
    }

    // 补充市场数据
    const enrichedTxs = await this.enrichWithMarketData(transactions);

    return {
      format: format.name,
      count: enrichedTxs.length,
      transactions: enrichedTxs,
    };
  }

  /**
   * 检测 CSV 格式
   */
  detectFormat(header) {
    const h = header.map(x => x.toLowerCase());
    
    // 检查每个已知格式
    for (const [key, def] of Object.entries(this.formatDefinitions)) {
      const matchCount = def.headers.filter(hdr => 
        h.some(header => header.includes(hdr.toLowerCase()))
      ).length;
      
      if (matchCount >= 3) {
        return { ...def, key };
      }
    }

    // 通用格式
    return {
      key: 'generic',
      name: 'Generic',
      columnMap: this.createGenericColumnMap(header),
    };
  }

  /**
   * 为通用格式创建列映射
   */
  createGenericColumnMap(header) {
    const map = {};
    const h = header.map(x => x.toLowerCase());
    
    // 智能匹配
    map.time = header.filter((_, i) => h[i].match(/time|date|时间/))[0];
    map.symbol = header.filter((_, i) => h[i].match(/symbol|pair|market|币种/))[0];
    map.side = header.filter((_, i) => h[i].match(/side|type|action|buy|sell|买卖/))[0];
    map.price = header.filter((_, i) => h[i].match(/price|价格/))[0];
    map.qty = header.filter((_, i) => h[i].match(/qty|amount|quantity|数量/))[0];
    map.total = header.filter((_, i) => h[i].match(/total|amount|总额/))[0];
    map.fee = header.filter((_, i) => h[i].match(/fee|commission|手续费/))[0];
    
    return map;
  }

  /**
   * 解析 CSV 行
   */
  parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    return values;
  }

  /**
   * 映射到标准交易格式
   */
  mapToTransaction(values, header, format) {
    const getValue = (field) => {
      const possibleNames = format.columnMap[field] || [];
      for (const name of possibleNames) {
        const idx = header.findIndex(h => h.toLowerCase().includes(name.toLowerCase()));
        if (idx >= 0 && idx < values.length) {
          return values[idx];
        }
      }
      return null;
    };

    try {
      const rawTime = getValue('time') || '';
      const rawSymbol = getValue('symbol') || '';
      const rawSide = getValue('side') || '';
      const rawPrice = getValue('price');
      const rawQty = getValue('qty');
      const rawTotal = getValue('total');
      const rawFee = getValue('fee');

      // 标准化交易对
      const symbol = this.normalizeSymbol(rawSymbol);

      const tx = {
        timestamp: this.parseTimestamp(rawTime),
        rawTime,
        symbol: symbol,
        symbolInfo: this.getSymbolInfo(symbol),
        side: rawSide?.toUpperCase() || '',
        price: this.parseNumber(rawPrice),
        qty: this.parseNumber(rawQty),
        total: this.parseNumber(rawTotal),
        fee: this.parseNumber(rawFee),
        exchange: format.name,
        isBuy: /buy|买入|买/i.test(rawSide),
        isSell: /sell|卖出|卖/i.test(rawSide),
      };

      // 如果没有 total，用 price * qty 计算
      if (!tx.total && tx.price && tx.qty) {
        tx.total = tx.price * tx.qty;
      }

      return tx;
    } catch (e) {
      return null;
    }
  }

  /**
   * 标准化交易对
   */
  normalizeSymbol(symbol) {
    if (!symbol) return '';
    // 移除常见后缀，转换为标准格式
    return symbol.toUpperCase()
      .replace(/USDT$/, 'USDT')
      .replace(/BUSD$/, 'USDT')
      .replace(/USD$/, 'USDT')
      .trim();
  }

  /**
   * 获取币种信息
   */
  getSymbolInfo(symbol) {
    // 直接匹配
    if (this.cryptoInfo[symbol]) {
      return this.cryptoInfo[symbol];
    }

    // 提取基础币种
    const baseSymbol = symbol.replace(/USDT|BUSD|USD|ETH|BTC$/g, '');
    
    return {
      name: baseSymbol,
      symbol: baseSymbol,
      category: 'unknown',
    };
  }

  /**
   * 解析时间
   */
  parseTimestamp(timeStr) {
    if (!timeStr) return new Date().toISOString();
    
    // 尝试多种格式
    const formats = [
      /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):?(\d{2})?/,
      /^(\d{2})\/(\d{2})\/(\d{4})[T ](\d{2}):(\d{2}):?(\d{2})?/,
      /^(\d{10})$/,
    ];

    for (const fmt of formats) {
      const match = timeStr.match(fmt);
      if (match) {
        if (match[1].length === 10) {
          return new Date(parseInt(match[1]) * 1000).toISOString();
        }
        return new Date(timeStr).toISOString();
      }
    }

    return new Date(timeStr).toISOString();
  }

  /**
   * 解析数字
   */
  parseNumber(val) {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    return parseFloat(val.replace(/,/g, '').replace(/"/g, '')) || 0;
  }

  /**
   * 整合市场数据（模拟）
   */
  async enrichWithMarketData(transactions) {
    // 实际应该调用 API 获取实时数据
    // 这里使用模拟数据
    const enriched = transactions.map(tx => {
      const info = tx.symbolInfo;
      
      // 模拟市场数据
      return {
        ...tx,
        marketData: {
          category: info.category,
          riskLevel: this.getCategoryRisk(info.category),
          volatility: this.getCategoryVolatility(info.category),
        },
      };
    });

    return enriched;
  }

  /**
   * 获取类别风险
   */
  getCategoryRisk(category) {
    const risks = {
      'meme': 'high',
      'layer1': 'low',
      'defi': 'medium',
      'unknown': 'medium',
    };
    return risks[category] || 'medium';
  }

  /**
   * 获取类别波动性
   */
  getCategoryVolatility(category) {
    const vols = {
      'meme': 95,
      'layer1': 40,
      'defi': 60,
      'unknown': 50,
    };
    return vols[category] || 50;
  }

  /**
   * 分析交易习惯
   */
  analyzePattern(transactions) {
    if (!transactions?.length) {
      return { error: 'No transactions' };
    }

    const stats = {
      totalTrades: transactions.length,
      buyTrades: 0,
      sellTrades: 0,
      totalVolume: 0,
      totalFees: 0,
      uniqueSymbols: new Set(),
      bySymbol: {},
      byMonth: {},
      byDayOfWeek: new Array(7).fill(0),
      byHour: new Array(24).fill(0),
      byCategory: {},
      avgTradeSize: 0,
    };

    // 统计
    for (const tx of transactions) {
      if (tx.isBuy) stats.buyTrades++;
      if (tx.isSell) stats.sellTrades++;

      stats.totalVolume += tx.total || 0;
      stats.totalFees += tx.fee || 0;
      stats.uniqueSymbols.add(tx.symbol);

      // 按币种统计
      if (!stats.bySymbol[tx.symbol]) {
        stats.bySymbol[tx.symbol] = { trades: 0, volume: 0, buys: 0, sells: 0 };
      }
      stats.bySymbol[tx.symbol].trades++;
      stats.bySymbol[tx.symbol].volume += tx.total || 0;
      if (tx.isBuy) stats.bySymbol[tx.symbol].buys++;
      if (tx.isSell) stats.bySymbol[tx.symbol].sells++;

      // 按类别统计
      const cat = tx.marketData?.category || 'unknown';
      stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;

      // 时间统计
      const date = new Date(tx.timestamp);
      if (!isNaN(date.getTime())) {
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        stats.byMonth[monthKey] = (stats.byMonth[monthKey] || 0) + 1;
        stats.byDayOfWeek[date.getDay()]++;
        stats.byHour[date.getHours()]++;
      }
    }

    stats.avgTradeSize = stats.totalVolume / stats.totalTrades;
    stats.uniqueSymbols = stats.uniqueSymbols.size;

    // 交易风格
    const days = Object.keys(stats.byMonth).length || 1;
    const avgPerDay = stats.totalTrades / Math.max(1, days * 30);
    
    let style = 'investor';
    if (avgPerDay > 10) style = 'degen';
    else if (avgPerDay > 3) style = 'dayTrader';
    else if (avgPerDay > 0.5) style = 'swingTrader';

    // 风险评估
    let riskLevel = 'low';
    const memeRatio = (stats.byCategory['meme'] || 0) / stats.totalTrades;
    if (memeRatio > 0.3 || stats.totalTrades > 500) riskLevel = 'high';
    else if (memeRatio > 0.1 || stats.totalTrades > 100) riskLevel = 'medium';

    // Top 交易币种
    const topSymbols = Object.entries(stats.bySymbol)
      .sort((a, b) => b[1].volume - a[1].volume)
      .slice(0, 10)
      .map(([sym, d]) => ({
        symbol: sym,
        trades: d.trades,
        volume: d.volume,
        buys: d.buys,
        sells: d.sells,
      }));

    return {
      style,
      riskLevel,
      stats: {
        ...stats,
        bySymbol: undefined,
        uniqueSymbols: stats.uniqueSymbols,
      },
      topSymbols,
      categoryBreakdown: stats.byCategory,
      insights: this.generateInsights(stats),
    };
  }

  /**
   * 生成洞察
   */
  generateInsights(stats) {
    const insights = [];

    // Meme 币风险
    const memeRatio = (stats.byCategory['meme'] || 0) / stats.totalTrades;
    if (memeRatio > 0.3) {
      insights.push({ type: 'warning', text: `Meme 币交易占比 ${Math.round(memeRatio * 100)}%，风险较高` });
    }

    // 交易频率
    if (stats.totalTrades > 500) {
      insights.push({ type: 'warning', text: `交易频繁 (${stats.totalTrades} 笔)，注意风险控制` });
    }

    // 分散度
    if (stats.uniqueSymbols < 3 && stats.totalTrades > 20) {
      insights.push({ type: 'info', text: `建议分散投资，当前仅交易 ${stats.uniqueSymbols} 个币种` });
    }

    // 手续费
    if (stats.totalFees > 50) {
      insights.push({ type: 'warning', text: `手续费支出较高 (${stats.totalFees.toFixed(2)} USDT)` });
    }

    return insights;
  }
}

module.exports = { EnhancedCSVImporter };
