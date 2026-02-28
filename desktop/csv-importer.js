/**
 * Oracle-X 增强版交易记录导入器
 * 支持 CSV / XLSX 自动格式识别 + AI 智能表头识别 + 多市场支持
 */

const fs = require('fs');
const path = require('path');

// 延迟加载 xlsx（可能未安装）
let XLSX = null;
function getXLSX() {
  if (!XLSX) {
    try { XLSX = require('xlsx'); } catch (e) {
      console.warn('[CSV-Importer] xlsx package not installed, XLSX import disabled');
    }
  }
  return XLSX;
}

// AI 配置（从 .env.local 读取）
const AI_CONFIG = (() => {
  const envPath = require('path').join(__dirname, '.env.local');
  const cfg = { baseUrl: 'https://mydmx.huoyuanqudao.cn/v1', apiKey: '', model: 'MiniMax-M2.5-highspeed' };
  try {
    const content = require('fs').readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq > 0) {
        const k = t.slice(0, eq).trim(), v = t.slice(eq + 1).trim();
        if (k === 'AI_BASE_URL') cfg.baseUrl = v;
        if (k === 'AI_API_KEY') cfg.apiKey = v;
        if (k === 'AI_MODEL') cfg.model = v;
      }
    }
  } catch (e) { /* ignore */ }
  return cfg;
})();

/**
 * 市场类型枚举
 */
const MARKET_TYPES = {
  CRYPTO: 'crypto',
  A_SHARE: 'a_share',
  US_STOCK: 'us_stock',
  HK_STOCK: 'hk_stock',
  FOREX: 'forex',
  FUTURES: 'futures',
  OTHER: 'other',
};

/**
 * 增强 CSV/XLSX 交易记录分析器
 */
class EnhancedCSVImporter {
  constructor(aiConfig = {}) {
    this.aiBaseUrl = aiConfig.baseUrl || AI_CONFIG.baseUrl;
    this.aiApiKey = aiConfig.apiKey || AI_CONFIG.apiKey;
    this.aiModel = aiConfig.model || AI_CONFIG.model;

    // 交易所格式定义（加密货币）
    this.formatDefinitions = {
      binance: {
        name: 'Binance',
        marketType: MARKET_TYPES.CRYPTO,
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
      okx: {
        name: 'OKX',
        marketType: MARKET_TYPES.CRYPTO,
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
      bybit: {
        name: 'Bybit',
        marketType: MARKET_TYPES.CRYPTO,
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
      coinbase: {
        name: 'Coinbase',
        marketType: MARKET_TYPES.CRYPTO,
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
      kraken: {
        name: 'Kraken',
        marketType: MARKET_TYPES.CRYPTO,
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
      gateio: {
        name: 'Gate.io',
        marketType: MARKET_TYPES.CRYPTO,
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
      kucoin: {
        name: 'KuCoin',
        marketType: MARKET_TYPES.CRYPTO,
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
      // ===== 传统市场格式 =====
      eastmoney: {
        name: '东方财富',
        marketType: MARKET_TYPES.A_SHARE,
        headers: ['成交时间', '证券代码', '证券名称', '买卖方向', '成交价格', '成交数量'],
        columnMap: {
          time: ['成交时间', '委托时间', '日期'],
          symbol: ['证券代码', '股票代码', '代码'],
          name: ['证券名称', '股票名称', '名称'],
          side: ['买卖方向', '操作', '交易类型', '委托方向'],
          price: ['成交价格', '成交均价', '价格'],
          qty: ['成交数量', '成交量', '数量'],
          total: ['成交金额', '金额', '发生金额'],
          fee: ['手续费', '佣金', '总费用', '交易费用'],
        },
      },
      tonghuashun: {
        name: '同花顺',
        marketType: MARKET_TYPES.A_SHARE,
        headers: ['委托时间', '证券代码', '操作', '成交均价', '成交数量', '成交金额'],
        columnMap: {
          time: ['委托时间', '成交时间', '日期'],
          symbol: ['证券代码', '代码'],
          name: ['证券名称', '名称'],
          side: ['操作', '买卖方向', '交易类型'],
          price: ['成交均价', '成交价格', '委托价格'],
          qty: ['成交数量', '委托数量'],
          total: ['成交金额', '金额'],
          fee: ['手续费', '佣金'],
        },
      },
      tdameritrade: {
        name: 'TD Ameritrade',
        marketType: MARKET_TYPES.US_STOCK,
        headers: ['DATE', 'TRANSACTION ID', 'DESCRIPTION', 'QUANTITY', 'SYMBOL', 'PRICE', 'AMOUNT'],
        columnMap: {
          time: ['DATE', 'Date', 'Trade Date'],
          symbol: ['SYMBOL', 'Symbol', 'Ticker'],
          side: ['DESCRIPTION', 'Action', 'Type', 'Transaction Type'],
          price: ['PRICE', 'Price'],
          qty: ['QUANTITY', 'Quantity', 'Shares'],
          total: ['AMOUNT', 'Amount', 'Net Amount'],
          fee: ['COMMISSION', 'Commission', 'Fee', 'Fees'],
        },
      },
      ibkr: {
        name: 'Interactive Brokers',
        marketType: MARKET_TYPES.US_STOCK,
        headers: ['Symbol', 'Date/Time', 'Quantity', 'T. Price', 'Proceeds', 'Comm/Fee'],
        columnMap: {
          time: ['Date/Time', 'TradeDate', 'DateTime'],
          symbol: ['Symbol', 'Ticker'],
          side: ['Buy/Sell', 'Action', 'Side'],
          price: ['T. Price', 'Price'],
          qty: ['Quantity', 'Shares'],
          total: ['Proceeds', 'Amount', 'NetCash'],
          fee: ['Comm/Fee', 'Commission', 'IBCommission'],
        },
      },
      futu: {
        name: '富途牛牛',
        marketType: MARKET_TYPES.US_STOCK,
        headers: ['成交时间', '股票代码', '股票名称', '方向', '成交价', '成交数量'],
        columnMap: {
          time: ['成交时间', '日期'],
          symbol: ['股票代码', '代码'],
          name: ['股票名称', '名称'],
          side: ['方向', '买卖方向'],
          price: ['成交价', '成交均价', '价格'],
          qty: ['成交数量', '数量'],
          total: ['成交金额', '金额'],
          fee: ['手续费', '佣金', '费用'],
        },
      },
    };

    // 多市场标的信息
    this.assetInfo = {
      // 加密货币
      'BTCUSDT': { name: 'Bitcoin', symbol: 'BTC', category: 'layer1', marketType: MARKET_TYPES.CRYPTO },
      'ETHUSDT': { name: 'Ethereum', symbol: 'ETH', category: 'layer1', marketType: MARKET_TYPES.CRYPTO },
      'BNBUSDT': { name: 'BNB', symbol: 'BNB', category: 'layer1', marketType: MARKET_TYPES.CRYPTO },
      'SOLUSDT': { name: 'Solana', symbol: 'SOL', category: 'layer1', marketType: MARKET_TYPES.CRYPTO },
      'XRPUSDT': { name: 'XRP', symbol: 'XRP', category: 'layer1', marketType: MARKET_TYPES.CRYPTO },
      'ADAUSDT': { name: 'Cardano', symbol: 'ADA', category: 'layer1', marketType: MARKET_TYPES.CRYPTO },
      'DOGEUSDT': { name: 'Dogecoin', symbol: 'DOGE', category: 'meme', marketType: MARKET_TYPES.CRYPTO },
      'PEPEUSDT': { name: 'Pepe', symbol: 'PEPE', category: 'meme', marketType: MARKET_TYPES.CRYPTO },
      'ETHBTC': { name: 'Ethereum', symbol: 'ETH', category: 'layer1', marketType: MARKET_TYPES.CRYPTO },
      // A股常见
      '600519': { name: '贵州茅台', symbol: '600519', category: 'consumer', marketType: MARKET_TYPES.A_SHARE },
      '000001': { name: '平安银行', symbol: '000001', category: 'finance', marketType: MARKET_TYPES.A_SHARE },
      // 美股常见
      'AAPL': { name: 'Apple', symbol: 'AAPL', category: 'tech', marketType: MARKET_TYPES.US_STOCK },
      'TSLA': { name: 'Tesla', symbol: 'TSLA', category: 'tech', marketType: MARKET_TYPES.US_STOCK },
      'NVDA': { name: 'NVIDIA', symbol: 'NVDA', category: 'tech', marketType: MARKET_TYPES.US_STOCK },
    };
  }

  /**
   * 统一入口：自动检测文件类型并解析
   */
  async parseFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.xlsx' || ext === '.xls') {
      return this.parseXLSX(filePath);
    }
    return this.parseCSV(filePath);
  }

  /**
   * 解析 XLSX 文件
   */
  async parseXLSX(filePath) {
    const xlsx = getXLSX();
    if (!xlsx) {
      throw new Error('未安装 xlsx 依赖，请运行 npm install xlsx');
    }

    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    if (!rows.length) {
      throw new Error('XLSX 文件为空');
    }

    const header = Object.keys(rows[0]);
    const sampleRows = rows.slice(0, 5).map(row => header.map(h => String(row[h] ?? '')));
    const format = await this.detectFormatSmart(header, sampleRows);
    console.log('[XLSX] Detected format:', format.name, '| Market:', format.marketType, '| Rows:', rows.length);

    const transactions = [];
    for (const row of rows) {
      try {
        const values = header.map(h => String(row[h] ?? ''));
        const tx = this.mapToTransaction(values, header, format);
        if (tx) transactions.push(tx);
      } catch (e) {
        // 跳过无效行
      }
    }

    const enrichedTxs = await this.enrichWithMarketData(transactions);

    return {
      format: format.name + ' (XLSX)',
      marketType: format.marketType,
      count: enrichedTxs.length,
      transactions: enrichedTxs,
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

    const header = this.parseCSVLine(lines[0]);
    const sampleRows = lines.slice(1, 6).map(l => this.parseCSVLine(l));
    const format = await this.detectFormatSmart(header, sampleRows);
    console.log('[CSV] Detected format:', format.name, '| Market:', format.marketType);

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

    const enrichedTxs = await this.enrichWithMarketData(transactions);

    return {
      format: format.name,
      marketType: format.marketType,
      count: enrichedTxs.length,
      transactions: enrichedTxs,
    };
  }

  /**
   * 智能格式检测：规则优先 → AI 兜底
   */
  async detectFormatSmart(header, sampleRows = []) {
    // 第一步：尝试硬编码规则匹配
    const ruleResult = this.detectFormat(header);
    if (ruleResult.key !== 'generic') {
      return ruleResult;
    }

    // 第二步：规则未命中，尝试 AI 识别
    try {
      const aiResult = await this.detectFormatWithAI(header, sampleRows);
      if (aiResult) {
        console.log('[CSV-Importer] AI identified format:', aiResult.name);
        return aiResult;
      }
    } catch (e) {
      console.warn('[CSV-Importer] AI header detection failed, fallback to generic:', e.message);
    }

    // 第三步：兜底 generic
    return ruleResult;
  }

  /**
   * 规则匹配检测格式
   */
  detectFormat(header) {
    const h = header.map(x => x.toLowerCase());

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
      marketType: this.guessMarketTypeFromHeaders(header),
      columnMap: this.createGenericColumnMap(header),
    };
  }

  /**
   * AI 智能表头识别
   * 将表头和样本数据发给 AI，返回标准化的列映射和市场类型
   */
  async detectFormatWithAI(header, sampleRows) {
    if (!this.aiApiKey) return null;

    const sampleText = sampleRows.slice(0, 3).map(row => row.join(' | ')).join('\n');
    const prompt = `你是一个数据解析专家。请分析以下表头和示例数据，识别它属于哪种交易记录格式。

## 表头
${header.join(' | ')}

## 示例数据（前3行）
${sampleText}

## 请返回 JSON（严格按以下格式）：
{
  "exchangeName": "来源平台名称（如 Binance、东方财富、TD Ameritrade 等）",
  "marketType": "crypto 或 a_share 或 us_stock 或 hk_stock 或 forex 或 futures 或 other",
  "columnMap": {
    "time": "表头中对应时间/日期的列名",
    "symbol": "表头中对应标的代码/交易对的列名",
    "name": "表头中对应标的名称的列名（没有则为 null）",
    "side": "表头中对应买卖方向的列名",
    "price": "表头中对应价格的列名",
    "qty": "表头中对应数量的列名",
    "total": "表头中对应总金额的列名（没有则为 null）",
    "fee": "表头中对应手续费的列名（没有则为 null）"
  }
}

注意：columnMap 的值必须是表头中实际存在的列名字符串，不能自己编造。如果找不到对应列，设为 null。`;

    const response = await fetch(`${this.aiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.aiApiKey}`,
      },
      body: JSON.stringify({
        model: this.aiModel,
        messages: [
          { role: 'system', content: '你是数据解析专家，擅长识别各种交易记录文件格式，包括加密货币、A股、美股、港股、期货、外汇。始终返回有效的 JSON。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // 提取 JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    // 将 AI 返回的单值 columnMap 转为数组形式（兼容现有 getValue 逻辑）
    const columnMap = {};
    for (const [field, value] of Object.entries(parsed.columnMap || {})) {
      columnMap[field] = value ? [value] : [];
    }

    return {
      key: 'ai_detected',
      name: parsed.exchangeName || 'AI Detected',
      marketType: parsed.marketType || MARKET_TYPES.OTHER,
      columnMap,
    };
  }

  /**
   * 从表头关键词猜测市场类型
   */
  guessMarketTypeFromHeaders(header) {
    const joined = header.join(' ').toLowerCase();
    if (/证券|股票|a股|沪|深|代码/.test(joined)) return MARKET_TYPES.A_SHARE;
    if (/ticker|shares|nasdaq|nyse/.test(joined)) return MARKET_TYPES.US_STOCK;
    if (/港股|hk|恒生/.test(joined)) return MARKET_TYPES.HK_STOCK;
    if (/期货|合约到期|交割/.test(joined)) return MARKET_TYPES.FUTURES;
    if (/外汇|forex|currency pair/.test(joined)) return MARKET_TYPES.FOREX;
    if (/usdt|busd|pair|instid/.test(joined)) return MARKET_TYPES.CRYPTO;
    return MARKET_TYPES.OTHER;
  }

  /**
   * 为通用格式创建列映射
   */
  createGenericColumnMap(header) {
    const map = {};
    const h = header.map(x => x.toLowerCase());

    map.time = header.filter((_, i) => h[i].match(/time|date|时间|日期/))[0];
    map.symbol = header.filter((_, i) => h[i].match(/symbol|pair|market|ticker|币种|代码|股票/))[0];
    map.name = header.filter((_, i) => h[i].match(/name|名称|证券名/))[0];
    map.side = header.filter((_, i) => h[i].match(/side|type|action|buy|sell|买卖|方向|操作/))[0];
    map.price = header.filter((_, i) => h[i].match(/price|价格|成交价|均价/))[0];
    map.qty = header.filter((_, i) => h[i].match(/qty|amount|quantity|数量|成交量|shares/))[0];
    map.total = header.filter((_, i) => h[i].match(/total|amount|总额|金额|成交金额/))[0];
    map.fee = header.filter((_, i) => h[i].match(/fee|commission|手续费|佣金|费用/))[0];

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
   * 映射到标准交易格式（多市场统一）
   */
  mapToTransaction(values, header, format) {
    const getValue = (field) => {
      const possibleNames = format.columnMap[field] || [];
      // 支持 AI 返回的单值和数组两种形式
      const names = Array.isArray(possibleNames) ? possibleNames : [possibleNames];
      for (const name of names) {
        if (!name) continue;
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
      const rawName = getValue('name') || '';
      const rawSide = getValue('side') || '';
      const rawPrice = getValue('price');
      const rawQty = getValue('qty');
      const rawTotal = getValue('total');
      const rawFee = getValue('fee');

      const marketType = format.marketType || MARKET_TYPES.OTHER;
      const { ticker, normalizedSymbol, currency } = this.normalizeSymbol(rawSymbol, marketType);
      const symbolInfo = this.getSymbolInfo(ticker || normalizedSymbol, marketType);

      const tx = {
        timestamp: this.parseTimestamp(rawTime),
        rawTime,
        symbol: normalizedSymbol,
        ticker,
        assetName: rawName || symbolInfo.name || '',
        currency,
        marketType,
        symbolInfo,
        side: rawSide?.toUpperCase() || '',
        price: this.parseNumber(rawPrice),
        qty: this.parseNumber(rawQty),
        total: this.parseNumber(rawTotal),
        fee: this.parseNumber(rawFee),
        exchange: format.name,
        isBuy: /buy|买入|买|申购|融资买入|担保品买入/i.test(rawSide),
        isSell: /sell|卖出|卖|赎回|融资卖出|担保品卖出/i.test(rawSide),
      };

      if (!tx.total && tx.price && tx.qty) {
        tx.total = tx.price * tx.qty;
      }

      return tx;
    } catch (e) {
      return null;
    }
  }

  /**
   * 标准化标的代码（多市场）
   */
  normalizeSymbol(symbol, marketType) {
    if (!symbol) return { ticker: '', normalizedSymbol: '', currency: '' };

    const s = symbol.trim();

    switch (marketType) {
      case MARKET_TYPES.A_SHARE: {
        // A股: 提取纯数字代码，推断交易所
        const code = s.replace(/[^0-9]/g, '').slice(0, 6);
        const exchange = code.startsWith('6') ? 'SH' : 'SZ';
        return { ticker: code, normalizedSymbol: `${exchange}${code}`, currency: 'CNY' };
      }
      case MARKET_TYPES.US_STOCK: {
        const ticker = s.toUpperCase().replace(/[^A-Z]/g, '');
        return { ticker, normalizedSymbol: ticker, currency: 'USD' };
      }
      case MARKET_TYPES.HK_STOCK: {
        const code = s.replace(/[^0-9]/g, '').padStart(5, '0');
        return { ticker: code, normalizedSymbol: `HK${code}`, currency: 'HKD' };
      }
      case MARKET_TYPES.CRYPTO:
      default: {
        const upper = s.toUpperCase()
          .replace(/BUSD$/, 'USDT')
          .replace(/USD$/, 'USDT')
          .trim();
        const base = upper.replace(/USDT|ETH|BTC$/g, '');
        return { ticker: base, normalizedSymbol: upper, currency: 'USDT' };
      }
    }
  }

  /**
   * 获取标的信息（多市场）
   */
  getSymbolInfo(symbol, marketType) {
    // 直接匹配静态表
    if (this.assetInfo[symbol]) {
      return this.assetInfo[symbol];
    }

    // 推断 category
    let category = 'unknown';
    if (marketType === MARKET_TYPES.A_SHARE) {
      const code = symbol.replace(/[^0-9]/g, '');
      if (code.startsWith('300') || code.startsWith('688')) category = 'growth';
      else if (code.startsWith('6')) category = 'main_board';
      else if (code.startsWith('0')) category = 'main_board';
      else category = 'other';
    } else if (marketType === MARKET_TYPES.US_STOCK) {
      category = 'us_equity';
    } else if (marketType === MARKET_TYPES.CRYPTO) {
      category = 'unknown';
    }

    return {
      name: symbol,
      symbol,
      category,
      marketType: marketType || MARKET_TYPES.OTHER,
    };
  }

  /**
   * 解析时间
   */
  parseTimestamp(timeStr) {
    if (!timeStr) return new Date().toISOString();

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
    return parseFloat(val.replace(/,/g, '').replace(/"/g, '').replace(/¥|￥|\$/g, '')) || 0;
  }

  /**
   * 整合市场数据
   */
  async enrichWithMarketData(transactions) {
    return transactions.map(tx => {
      const info = tx.symbolInfo;
      return {
        ...tx,
        marketData: {
          marketType: tx.marketType,
          category: info.category,
          riskLevel: this.getCategoryRisk(info.category, tx.marketType),
          volatility: this.getCategoryVolatility(info.category, tx.marketType),
        },
      };
    });
  }

  /**
   * 获取类别风险（多市场）
   */
  getCategoryRisk(category, marketType) {
    if (marketType === MARKET_TYPES.CRYPTO) {
      const risks = { 'meme': 'high', 'layer1': 'low', 'defi': 'medium', 'unknown': 'medium' };
      return risks[category] || 'medium';
    }
    if (marketType === MARKET_TYPES.A_SHARE || marketType === MARKET_TYPES.US_STOCK) {
      const risks = { 'growth': 'medium', 'main_board': 'low', 'tech': 'medium', 'us_equity': 'low' };
      return risks[category] || 'low';
    }
    return 'medium';
  }

  /**
   * 获取类别波动性（多市场）
   */
  getCategoryVolatility(category, marketType) {
    if (marketType === MARKET_TYPES.CRYPTO) {
      const vols = { 'meme': 95, 'layer1': 40, 'defi': 60, 'unknown': 50 };
      return vols[category] || 50;
    }
    if (marketType === MARKET_TYPES.A_SHARE) {
      const vols = { 'growth': 50, 'main_board': 30, 'other': 35 };
      return vols[category] || 30;
    }
    if (marketType === MARKET_TYPES.US_STOCK) {
      const vols = { 'tech': 45, 'us_equity': 25 };
      return vols[category] || 25;
    }
    return 40;
  }

  /**
   * 分析交易习惯（多市场）
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
      byMarketType: {},
      avgTradeSize: 0,
    };

    for (const tx of transactions) {
      if (tx.isBuy) stats.buyTrades++;
      if (tx.isSell) stats.sellTrades++;

      stats.totalVolume += tx.total || 0;
      stats.totalFees += tx.fee || 0;
      stats.uniqueSymbols.add(tx.symbol);

      // 按标的统计
      if (!stats.bySymbol[tx.symbol]) {
        stats.bySymbol[tx.symbol] = { trades: 0, volume: 0, buys: 0, sells: 0, marketType: tx.marketType };
      }
      stats.bySymbol[tx.symbol].trades++;
      stats.bySymbol[tx.symbol].volume += tx.total || 0;
      if (tx.isBuy) stats.bySymbol[tx.symbol].buys++;
      if (tx.isSell) stats.bySymbol[tx.symbol].sells++;

      // 按类别统计
      const cat = tx.marketData?.category || 'unknown';
      stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;

      // 按市场类型统计
      const mt = tx.marketType || 'other';
      stats.byMarketType[mt] = (stats.byMarketType[mt] || 0) + 1;

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

    // 风险评估（多市场）
    let riskLevel = 'low';
    const memeRatio = (stats.byCategory['meme'] || 0) / stats.totalTrades;
    const cryptoRatio = (stats.byMarketType[MARKET_TYPES.CRYPTO] || 0) / stats.totalTrades;
    const growthRatio = (stats.byCategory['growth'] || 0) / stats.totalTrades;
    if (memeRatio > 0.3 || stats.totalTrades > 500) riskLevel = 'high';
    else if (memeRatio > 0.1 || cryptoRatio > 0.5 || growthRatio > 0.5 || stats.totalTrades > 100) riskLevel = 'medium';

    // Top 交易标的
    const topSymbols = Object.entries(stats.bySymbol)
      .sort((a, b) => b[1].volume - a[1].volume)
      .slice(0, 10)
      .map(([sym, d]) => ({
        symbol: sym,
        trades: d.trades,
        volume: d.volume,
        buys: d.buys,
        sells: d.sells,
        marketType: d.marketType,
      }));

    // 盈亏分析
    const pnlResult = this.analyzePnL(transactions);

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
      marketTypeBreakdown: stats.byMarketType,
      pnl: pnlResult,
      insights: this.generateInsights(stats, pnlResult),
    };
  }

  /**
   * 高级盈亏分析（FIFO 配对）
   * 返回：盈亏、胜率、持仓周期、仓位管理、成本效率、连续盈亏
   */
  analyzePnL(transactions) {
    if (!transactions?.length) return null;

    // === 1. FIFO 配对买卖 ===
    // 按标的分组，每组内按时间排序
    const bySymbol = {};
    for (const tx of transactions) {
      if (!tx.symbol) continue;
      if (!bySymbol[tx.symbol]) bySymbol[tx.symbol] = [];
      bySymbol[tx.symbol].push(tx);
    }

    const pairs = [];       // 配对结果
    const symbolPnL = {};   // 每个标的的盈亏

    for (const [symbol, txs] of Object.entries(bySymbol)) {
      const sorted = [...txs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      const buyQueue = []; // FIFO 队列

      for (const tx of sorted) {
        if (tx.isBuy) {
          buyQueue.push({ ...tx, remainingQty: tx.qty });
        } else if (tx.isSell && buyQueue.length > 0) {
          let sellQty = tx.qty;
          while (sellQty > 0 && buyQueue.length > 0) {
            const buy = buyQueue[0];
            const matchQty = Math.min(sellQty, buy.remainingQty);
            const buyTotal = matchQty * buy.price;
            const sellTotal = matchQty * tx.price;
            const pnl = sellTotal - buyTotal;
            const pnlPct = buyTotal > 0 ? (pnl / buyTotal) * 100 : 0;

            // 持仓时间（毫秒 → 小时）
            const buyTime = new Date(buy.timestamp);
            const sellTime = new Date(tx.timestamp);
            const holdHours = Math.max(0, (sellTime - buyTime) / (1000 * 60 * 60));

            pairs.push({
              symbol,
              buyPrice: buy.price,
              sellPrice: tx.price,
              qty: matchQty,
              pnl,
              pnlPct,
              holdHours,
              buyTime: buy.timestamp,
              sellTime: tx.timestamp,
              fee: ((buy.fee || 0) + (tx.fee || 0)) * (matchQty / (tx.qty || 1)),
            });

            buy.remainingQty -= matchQty;
            sellQty -= matchQty;
            if (buy.remainingQty <= 0) buyQueue.shift();
          }
        }
      }

      // 每个标的汇总
      const symPairs = pairs.filter(p => p.symbol === symbol);
      if (symPairs.length > 0) {
        const totalPnl = symPairs.reduce((s, p) => s + p.pnl, 0);
        const totalCost = symPairs.reduce((s, p) => s + p.qty * p.buyPrice, 0);
        symbolPnL[symbol] = {
          pairs: symPairs.length,
          totalPnl,
          pnlPct: totalCost > 0 ? (totalPnl / totalCost) * 100 : 0,
          wins: symPairs.filter(p => p.pnl > 0).length,
          losses: symPairs.filter(p => p.pnl <= 0).length,
        };
      }
    }

    if (pairs.length === 0) {
      return {
        hasPairs: false,
        message: '无法配对买卖交易（需要同一标的的买入和卖出记录）',
      };
    }

    // === 2. 总盈亏统计 ===
    const totalPnl = pairs.reduce((s, p) => s + p.pnl, 0);
    const totalFees = pairs.reduce((s, p) => s + p.fee, 0);
    const netPnl = totalPnl - totalFees;
    const totalCost = pairs.reduce((s, p) => s + p.qty * p.buyPrice, 0);

    // === 3. 胜率与赔率 ===
    const wins = pairs.filter(p => p.pnl > 0);
    const losses = pairs.filter(p => p.pnl <= 0);
    const winRate = (wins.length / pairs.length) * 100;
    const avgWin = wins.length > 0 ? wins.reduce((s, p) => s + p.pnl, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, p) => s + p.pnl, 0) / losses.length) : 0;
    const totalWin = wins.reduce((s, p) => s + p.pnl, 0);
    const totalLoss = Math.abs(losses.reduce((s, p) => s + p.pnl, 0));
    const profitFactor = totalLoss > 0 ? totalWin / totalLoss : totalWin > 0 ? Infinity : 0;

    // === 4. 持仓周期 ===
    const holdHours = pairs.map(p => p.holdHours).sort((a, b) => a - b);
    const avgHold = holdHours.reduce((s, h) => s + h, 0) / holdHours.length;
    const medianHold = holdHours[Math.floor(holdHours.length / 2)];
    const minHold = holdHours[0];
    const maxHold = holdHours[holdHours.length - 1];

    // 持仓周期分桶
    const holdBuckets = { intraday: 0, short: 0, medium: 0, long: 0 };
    for (const h of holdHours) {
      if (h < 24) holdBuckets.intraday++;
      else if (h < 72) holdBuckets.short++;
      else if (h < 24 * 30) holdBuckets.medium++;
      else holdBuckets.long++;
    }

    // === 5. 仓位管理 ===
    const tradeSizes = transactions.map(t => t.total || 0).filter(v => v > 0);
    const totalVolume = tradeSizes.reduce((s, v) => s + v, 0);
    const maxTradeSize = Math.max(...tradeSizes, 0);
    const maxTradeRatio = totalVolume > 0 ? (maxTradeSize / totalVolume) * 100 : 0;

    // 单标的最大仓位占比
    const symbolVolumes = {};
    for (const tx of transactions) {
      if (!tx.symbol) continue;
      symbolVolumes[tx.symbol] = (symbolVolumes[tx.symbol] || 0) + (tx.total || 0);
    }
    const maxSymbolVolume = Math.max(...Object.values(symbolVolumes), 0);
    const maxSymbolRatio = totalVolume > 0 ? (maxSymbolVolume / totalVolume) * 100 : 0;

    // === 6. 交易成本效率 ===
    const allFees = transactions.reduce((s, t) => s + (t.fee || 0), 0);
    const feeToVolumeRatio = totalVolume > 0 ? (allFees / totalVolume) * 100 : 0;
    const feeToPnlRatio = totalPnl > 0 ? (allFees / totalPnl) * 100 : null;

    // === 7. 连续盈亏 ===
    let maxWinStreak = 0, maxLossStreak = 0, curWin = 0, curLoss = 0;
    const sortedPairs = [...pairs].sort((a, b) => new Date(a.sellTime) - new Date(b.sellTime));
    for (const p of sortedPairs) {
      if (p.pnl > 0) {
        curWin++;
        curLoss = 0;
        maxWinStreak = Math.max(maxWinStreak, curWin);
      } else {
        curLoss++;
        curWin = 0;
        maxLossStreak = Math.max(maxLossStreak, curLoss);
      }
    }

    return {
      hasPairs: true,
      pairsCount: pairs.length,

      // 盈亏
      totalPnl,
      totalFees,
      netPnl,
      totalCost,
      pnlPct: totalCost > 0 ? (totalPnl / totalCost) * 100 : 0,

      // 胜率与赔率
      winRate,
      wins: wins.length,
      losses: losses.length,
      avgWin,
      avgLoss,
      profitFactor,

      // 持仓周期
      holdPeriod: {
        avgHours: avgHold,
        medianHours: medianHold,
        minHours: minHold,
        maxHours: maxHold,
        buckets: holdBuckets,
      },

      // 仓位管理
      positionSizing: {
        maxTradeSize,
        maxTradeRatio,
        maxSymbolRatio,
        avgTradeSize: totalVolume / Math.max(tradeSizes.length, 1),
      },

      // 交易成本
      costEfficiency: {
        totalFees: allFees,
        feeToVolumeRatio,
        feeToPnlRatio,
      },

      // 连续盈亏
      streaks: {
        maxWinStreak,
        maxLossStreak,
      },

      // 按标的盈亏
      symbolPnL,
    };
  }

  /**
   * 生成洞察（多市场）
   */
  generateInsights(stats, pnlResult = null) {
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
      insights.push({ type: 'info', text: `建议分散投资，当前仅交易 ${stats.uniqueSymbols} 个标的` });
    }

    // 手续费
    if (stats.totalFees > 50) {
      insights.push({ type: 'warning', text: `手续费支出较高 (${stats.totalFees.toFixed(2)})` });
    }

    // 多市场分布
    const marketTypes = Object.keys(stats.byMarketType || {});
    if (marketTypes.length > 1) {
      const breakdown = marketTypes.map(mt => {
        const labels = { crypto: '加密货币', a_share: 'A股', us_stock: '美股', hk_stock: '港股', forex: '外汇', futures: '期货', other: '其他' };
        return `${labels[mt] || mt} ${stats.byMarketType[mt]}笔`;
      }).join('、');
      insights.push({ type: 'info', text: `多市场交易：${breakdown}` });
    }

    // 创业板/科创板集中度
    const growthRatio = (stats.byCategory['growth'] || 0) / stats.totalTrades;
    if (growthRatio > 0.5) {
      insights.push({ type: 'warning', text: `创业板/科创板占比 ${Math.round(growthRatio * 100)}%，波动较大` });
    }

    // ===== 基于盈亏分析的洞察 =====
    if (pnlResult?.hasPairs) {
      // 胜率
      if (pnlResult.winRate < 30) {
        insights.push({ type: 'warning', text: `胜率仅 ${pnlResult.winRate.toFixed(1)}%，建议优化选品和择时策略` });
      } else if (pnlResult.winRate > 60) {
        insights.push({ type: 'success', text: `胜率 ${pnlResult.winRate.toFixed(1)}%，选品能力较强` });
      }

      // 盈亏比
      if (pnlResult.profitFactor < 1 && pnlResult.profitFactor !== 0) {
        insights.push({ type: 'warning', text: `盈亏比 ${pnlResult.profitFactor.toFixed(2)}，总体处于亏损状态` });
      } else if (pnlResult.profitFactor > 2) {
        insights.push({ type: 'success', text: `盈亏比 ${pnlResult.profitFactor.toFixed(2)}，盈利能力优秀` });
      }

      // 连续亏损
      if (pnlResult.streaks.maxLossStreak >= 5) {
        insights.push({ type: 'warning', text: `最大连续亏损 ${pnlResult.streaks.maxLossStreak} 笔，注意心态管理和止损纪律` });
      }

      // 仓位集中
      if (pnlResult.positionSizing.maxTradeRatio > 30) {
        insights.push({ type: 'warning', text: `单笔最大交易占总量 ${pnlResult.positionSizing.maxTradeRatio.toFixed(1)}%，仓位过重` });
      }

      if (pnlResult.positionSizing.maxSymbolRatio > 60) {
        insights.push({ type: 'warning', text: `单标的最大占比 ${pnlResult.positionSizing.maxSymbolRatio.toFixed(1)}%，风险集中` });
      }

      // 交易成本
      if (pnlResult.costEfficiency.feeToVolumeRatio > 1) {
        insights.push({ type: 'warning', text: `手续费占比 ${pnlResult.costEfficiency.feeToVolumeRatio.toFixed(2)}%，交易成本偏高` });
      }

      if (pnlResult.costEfficiency.feeToPnlRatio !== null && pnlResult.costEfficiency.feeToPnlRatio > 50) {
        insights.push({ type: 'warning', text: `手续费吃掉 ${pnlResult.costEfficiency.feeToPnlRatio.toFixed(0)}% 的盈利，建议降低交易频率` });
      }

      // 持仓周期
      if (pnlResult.holdPeriod.buckets.intraday > pnlResult.pairsCount * 0.7) {
        insights.push({ type: 'info', text: `${Math.round(pnlResult.holdPeriod.buckets.intraday / pnlResult.pairsCount * 100)}% 为日内交易，注意短线频繁操作的成本` });
      }
    }

    return insights;
  }
}

module.exports = { EnhancedCSVImporter, MARKET_TYPES };
