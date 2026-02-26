/**
 * Oracle-X Platform Detection Module
 * 自动检测交易平台并提供对应的按钮选择器
 */

const PLATFORMS = {
  // Binance
  binance: {
    id: 'binance',
    name: 'Binance',
    hostname: 'binance.com',
    // 买入按钮选择器
    buyButton: [
      'button[class*="buy"]',
      '[class*="buyButton"]',
      '[class*="btn-buy"]',
      '.css-1ap5wc6 button',
      'button[data-bn-type="button"]',
    ].join(', '),
    // 卖出按钮选择器
    sellButton: [
      'button[class*="sell"]',
      '[class*="sellButton"]',
      '[class*="btn-sell"]',
      '.css-1ap5wc6 button',
    ].join(', '),
    // 交易对选择器
    symbolSelector: [
      '.symbolTitle',
      '.css-1ap5wc6',
      '[class*="symbol"]',
    ].join(', '),
    // 价格选择器
    priceSelector: [
      '.lastPrice',
      '[class*="price"]',
    ].join(', '),
  },

  // OKX
  okx: {
    id: 'okx',
    name: 'OKX',
    hostname: 'okx.com',
    buyButton: [
      '.trade-btn_buy',
      '.buy-btn',
      '[class*="buy-button"]',
      'button:contains("买入")',
    ].join(', '),
    sellButton: [
      '.trade-btn_sell',
      '.sell-btn',
      '[class*="sell-button"]',
      'button:contains("卖出")',
    ].join(', '),
    symbolSelector: [
      '.symbol-name',
      '.trade-coin',
      '.contract-symbol',
    ].join(', '),
    priceSelector: [
      '.lastPrice',
      '.current-price',
    ].join(', '),
  },

  // Bybit
  bybit: {
    id: 'bybit',
    name: 'Bybit',
    hostname: 'bybit.com',
    buyButton: [
      '.buy-btn',
      '[class*="buyButton"]',
      'button:contains("Buy")',
    ].join(', '),
    sellButton: [
      '.sell-btn',
      '[class*="sellButton"]',
      'button:contains("Sell")',
    ].join(', '),
    symbolSelector: [
      '.symbol-name',
      '.trade-coin',
      '[class*="symbol"]',
    ].join(', '),
    priceSelector: [
      '.lastPrice',
      '.price',
    ].join(', '),
  },

  // Coinbase
  coinbase: {
    id: 'coinbase',
    name: 'Coinbase',
    hostname: 'coinbase.com',
    buyButton: [
      '[data-testid="buy-button"]',
      '.buy-button',
      'button:contains("Buy")',
    ].join(', '),
    sellButton: [
      '[data-testid="sell-button"]',
      '.sell-button',
      'button:contains("Sell")',
    ].join(', '),
    symbolSelector: [
      '.asset-name',
      '[data-testid="asset-name"]',
    ].join(', '),
    priceSelector: [
      '.price',
      '.current-price',
    ].join(', '),
  },

  // Kraken
  kraken: {
    id: 'kraken',
    name: 'Kraken',
    hostname: 'kraken.com',
    buyButton: [
      '.buy-button',
      'button:contains("Buy")',
    ].join(', '),
    sellButton: [
      '.sell-button',
      'button:contains("Sell")',
    ].join(', '),
    symbolSelector: [
      '.pair-selector',
      '.asset-name',
    ].join(', '),
    priceSelector: [
      '.price',
    ].join(', '),
  },

  // Gate.io
  gate: {
    id: 'gate',
    name: 'Gate.io',
    hostname: 'gate.io',
    buyButton: [
      '.buy-btn',
      '[class*="buy"]',
      'button:contains("买入")',
    ].join(', '),
    sellButton: [
      '.sell-btn',
      '[class*="sell"]',
      'button:contains("卖出")',
    ].join(', '),
    symbolSelector: [
      '.currency-pair',
      '.pair-name',
    ].join(', '),
    priceSelector: [
      '.price',
      '.current-price',
    ].join(', '),
  },

  // Uniswap
  uniswap: {
    id: 'uniswap',
    name: 'Uniswap',
    hostname: 'uniswap.org',
    buyButton: [
      '[data-testid="swap-button"]',
      '.swap-button',
      'button:contains("Swap")',
    ].join(', '),
    sellButton: [
      // Uniswap 是 AMM，没有买卖按钮，只有 Swap
    ].join(', '),
    symbolSelector: [
      '[data-testid="currency-input"]',
      '.token-symbol',
    ].join(', '),
    priceSelector: [
      '.price',
    ].join(', '),
  },
};

/**
 * 检测当前所在的交易平台
 * @returns {Object|null} 平台信息或 null
 */
function detectPlatform() {
  const hostname = window.location.hostname;
  
  for (const platform of Object.values(PLATFORMS)) {
    if (hostname.includes(platform.hostname)) {
      console.log('[Oracle-X] Detected platform:', platform.name);
      return platform;
    }
  }
  
  return null;
}

/**
 * 查找匹配的按钮元素
 * @param {string} selector - 选择器字符串
 * @returns {Element|null} 匹配的元素
 */
function findButton(selector) {
  if (!selector) return null;
  
  try {
    const elements = document.querySelectorAll(selector);
    // 返回第一个可见的元素
    for (const el of elements) {
      if (el.offsetParent !== null) { // 元素可见
        return el;
      }
    }
  } catch (e) {
    console.warn('[Oracle-X] Invalid selector:', e.message);
  }
  return null;
}

/**
 * 获取页面上的交易信息
 * @param {Object} platform - 平台配置
 * @returns {Object} 交易信息
 */
function getTradeInfo(platform) {
  const info = {
    platform: platform.name,
    symbol: null,
    price: null,
    action: null,
  };

  // 获取交易对
  try {
    const symbolEl = document.querySelector(platform.symbolSelector);
    if (symbolEl) {
      info.symbol = symbolEl.textContent?.trim() || symbolEl.innerText?.trim();
    }
  } catch (e) {}

  // 获取价格
  try {
    const priceEl = document.querySelector(platform.priceSelector);
    if (priceEl) {
      info.price = priceEl.textContent?.trim() || priceEl.innerText?.trim();
    }
  } catch (e) {}

  return info;
}

// 导出供 content.js 使用
if (typeof window !== 'undefined') {
  window.OracleXPlatforms = {
    detectPlatform,
    findButton,
    getTradeInfo,
    PLATFORMS,
  };
}
