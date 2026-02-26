/**
 * Oracle-X CSV 交易记录导入与分析
 * 支持 Binance/OKX/Bybit 等交易所 CSV
 */

const fs = require('fs');

/**
 * CSV 交易记录分析器
 */
class CSVTradeImporter {
  constructor() {
    this.supportedFormats = ['binance', 'okx', 'bybit', 'coinbase', 'generic'];
  }

  /**
   * 解析 CSV 文件
   */
  async parseCSV(filePath) {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    
    if (lines.length < 2) {
      throw new Error('CSV 文件为空');
    }

    // 检测格式
    const format = this.detectFormat(lines[0]);
    
    // 解析数据
    const transactions = this.parseLines(lines, format);
    
    return {
      format,
      count: transactions.length,
      transactions,
    };
  }

  /**
   * 检测 CSV 格式
   */
  detectFormat(header) {
    const h = header.toLowerCase();
    
    if (h.includes('binance') || h.includes('datetime(utc)')) return 'binance';
    if (h.includes('okx') || h.includes('trade id')) return 'okx';
    if (h.includes('bybit') || h.includes('order id')) return 'bybit';
    if (h.includes('coinbase') || h.includes('transaction hash')) return 'coinbase';
    
    return 'generic';
  }

  /**
   * 解析行数据
   */
  parseLines(lines, format) {
    const header = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const transactions = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = this.parseCSVLine(lines[i]);
        const tx = this.mapToTransaction(values, header, format);
        if (tx) transactions.push(tx);
      } catch (e) {
        // 跳过无效行
      }
    }

    return transactions;
  }

  /**
   * 解析 CSV 行（处理引号内逗号）
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
    try {
      const getIdx = (name) => header.findIndex(h => h.toLowerCase().includes(name));
      
      let tx = {
        timestamp: '',
        symbol: '',
        side: '',
        price: 0,
        qty: 0,
        total: 0,
        fee: 0,
        feeSymbol: '',
        exchange: format,
      };

      switch (format) {
        case 'binance':
          tx.timestamp = values[getIdx('time')] || values[getIdx('date')];
          tx.symbol = values[getIdx('pair')] || values[getIdx('symbol')];
          tx.side = values[getIdx('side')] || values[getIdx('action')];
          tx.price = parseFloat(values[getIdx('price')] || 0);
          tx.qty = parseFloat(values[getIdx('amount')] || values[getIdx('qty')] || 0);
          tx.total = parseFloat(values[getIdx('total')] || 0);
          tx.fee = parseFloat(values[getIdx('fee')] || 0);
          break;

        case 'okx':
          tx.timestamp = values[getIdx('time')] || values[getIdx('date')];
          tx.symbol = values[getIdx('instid')] || values[getIdx('symbol')];
          tx.side = values[getIdx('side')];
          tx.price = parseFloat(values[getIdx('px')] || values[getIdx('price')] || 0);
          tx.qty = parseFloat(values[getIdx('sz')] || values[getIdx('size')] || 0);
          tx.total = tx.price * tx.qty;
          tx.fee = parseFloat(values[getIdx('fee')] || 0);
          break;

        case 'bybit':
          tx.timestamp = values[getIdx('createdtime')] || values[getIdx('time')];
          tx.symbol = values[getIdx('symbol')];
          tx.side = values[getIdx('side')];
          tx.price = parseFloat(values[getIdx('price')] || 0);
          tx.qty = parseFloat(values[getIdx('qty')] || values[getIdx('orderqty')] || 0);
          tx.total = parseFloat(values[getIdx('total')] || 0);
          tx.fee = parseFloat(values[getIdx('fee')] || 0);
          break;

        default:
          // 通用格式尝试智能匹配
          tx.timestamp = values[Math.max(0, getIdx('time') || getIdx('date') || 0)];
          tx.symbol = values[getIdx('symbol') || getIdx('pair') || 1] || '';
          tx.side = values[getIdx('side') || getIdx('type') || 2] || '';
          tx.price = parseFloat(values[getIdx('price') || 3] || 0);
          tx.qty = parseFloat(values[getIdx('qty') || getIdx('amount') || 4] || 0);
          tx.total = parseFloat(values[getIdx('total') || 5] || 0);
      }

      // 标准化
      tx.side = tx.side?.toUpperCase();
      tx.isBuy = tx.side?.includes('BUY') || tx.side?.includes('买入') || tx.side?.includes('买入') || false;
      tx.isSell = tx.side?.includes('SELL') || tx.side?.includes('卖出');

      return tx;
    } catch (e) {
      return null;
    }
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
      byMonth: {},
      byDayOfWeek: new Array(7).fill(0),
      byHour: new Array(24).fill(0),
      avgTradeSize: 0,
      winRate: 0,
      pnl: 0,
    };

    // 计算盈亏（简化版）
    const buys = new Map();
    const sells = new Map();

    for (const tx of transactions) {
      // 买卖统计
      if (tx.isBuy) {
        stats.buyTrades++;
        stats.totalVolume += tx.total;
        buys.set(tx.symbol, (buys.get(tx.symbol) || 0) + tx.total);
      } else if (tx.isSell) {
        stats.sellTrades++;
        stats.totalVolume += tx.total;
        sells.set(tx.symbol, (sells.get(tx.symbol) || 0) + tx.total);
      }

      stats.totalFees += tx.fee || 0;
      stats.uniqueSymbols.add(tx.symbol);

      // 时间分析
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

    // 计算胜率（简化）
    if (stats.buyTrades > 0 && stats.sellTrades > 0) {
      stats.winRate = Math.min(100, Math.round((stats.sellTrades / stats.buyTrades) * 100));
    }

    // 交易风格判断
    const avgPerDay = stats.totalTrades / Math.max(1, Object.keys(stats.byMonth).length * 30);
    let style = 'investor';
    if (avgPerDay > 10) style = 'degen';
    else if (avgPerDay > 3) style = 'dayTrader';
    else if (avgPerDay > 0.5) style = 'swingTrader';

    // 风险评估
    let riskLevel = 'low';
    if (stats.totalTrades > 500 || stats.totalFees > 100) riskLevel = 'high';
    else if (stats.totalTrades > 100 || stats.totalFees > 10) riskLevel = 'medium';

    return {
      style,
      riskLevel,
      stats: {
        ...stats,
        byMonth: stats.byMonth,
        byDayOfWeek: stats.byDayOfWeek,
        byHour: stats.byHour,
      },
      insights: this.generateInsights(stats),
    };
  }

  /**
   * 生成洞察
   */
  generateInsights(stats) {
    const insights = [];

    // 交易频率
    if (stats.totalTrades > 100) {
      insights.push({ type: 'warning', text: `交易频率较高 (${stats.totalTrades} 笔)` });
    }

    // 手续费
    if (stats.totalFees > 50) {
      insights.push({ type: 'warning', text: `手续费支出较高 (${stats.totalFees.toFixed(2)} USDT)` });
    }

    // 多样化
    if (stats.uniqueSymbols < 3 && stats.totalTrades > 20) {
      insights.push({ type: 'info', text: `建议分散投资，当前仅交易 ${stats.uniqueSymbols} 个币种` });
    }

    // 最佳交易时段
    const peakHour = stats.byHour.indexOf(Math.max(...stats.byHour));
    if (peakHour > 0) {
      insights.push({ type: 'info', text: `您最活跃的交易时段: ${peakHour}:00` });
    }

    return insights;
  }
}

module.exports = { CSVTradeImporter };
