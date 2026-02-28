/**
 * Oracle-X Chrome Extension - Service Worker
 * 处理截图捕获和 Side Panel 通信
 */

// API 基础 URL（默认开发环境）
const DEFAULT_API_BASE_URL = 'http://localhost:3000';
const API_BASE_URL_STORAGE_KEY = 'oraclexApiBaseUrl';

// 存储当前截图数据
let currentScreenshot = null;
let currentAnalysisData = null;
let currentInterceptWindowId = null;

// ========== Ticker 缓存 ==========
const WATCHED_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT'];
let tickerCache = {};
const TICKER_REFRESH_INTERVAL_MIN = 1;

async function refreshTickerCache() {
  const apiBaseUrl = await getApiBaseUrl();
  for (const symbol of WATCHED_SYMBOLS) {
    try {
      const res = await fetch(`${apiBaseUrl}/api/ticker?symbol=${symbol}`);
      if (res.ok) {
        const data = await res.json();
        tickerCache[symbol] = { ...data, _cachedAt: Date.now() };
      }
    } catch { /* ignore */ }
  }
  try {
    chrome.storage.session.set({ oraclexTickerCache: tickerCache });
  } catch { /* ignore */ }
  console.log('[Oracle-X] Ticker cache refreshed:', Object.keys(tickerCache).length, 'symbols');
}

function getCachedTicker(symbol) {
  const cached = tickerCache[symbol];
  if (!cached) return null;
  if (Date.now() - cached._cachedAt > 120000) return null;
  return cached;
}

chrome.alarms.create('refreshTickers', { periodInMinutes: TICKER_REFRESH_INTERVAL_MIN });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'refreshTickers') refreshTickerCache();
});
refreshTickerCache();

function parseApiError(errorPayload, fallbackMessage) {
  if (!errorPayload || typeof errorPayload !== 'object') {
    return { message: fallbackMessage };
  }

  const message = errorPayload.detail || errorPayload.error || fallbackMessage;
  return {
    message,
    code: errorPayload.code,
    requestId: errorPayload.requestId,
  };
}

/**
 * 获取 API Base URL（支持 storage 覆盖）
 */
async function getApiBaseUrl() {
  return new Promise((resolve) => {
    chrome.storage.local.get([API_BASE_URL_STORAGE_KEY], (result) => {
      const value = result?.[API_BASE_URL_STORAGE_KEY];
      if (typeof value === 'string' && value.trim()) {
        resolve(value.trim().replace(/\/$/, ''));
      } else {
        resolve(DEFAULT_API_BASE_URL);
      }
    });
  });
}

/**
 * 监听扩展图标点击事件
 */
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // 1. 打开 Side Panel
    await chrome.sidePanel.open({ tabId: tab.id });

    // 2. 延迟捕获截图（等待 Side Panel 打开）
    setTimeout(async () => {
      await captureAndAnalyze(tab);
    }, 300);

  } catch (error) {
    console.error('Failed to handle action click:', error);
  }
});

/**
 * 捕获截图并发送识别请求
 */
async function captureAndAnalyze(tab) {
  try {
    // 1. 截取当前可见页面
    const screenshot = await chrome.tabs.captureVisibleTab(null, {
      format: 'png',
      quality: 90
    });

    currentScreenshot = screenshot;

    // 2. 通知 Side Panel 开始识别
    chrome.runtime.sendMessage({
      type: 'SCREENSHOT_CAPTURED',
      data: {
        screenshot,
        tabUrl: tab.url,
        tabTitle: tab.title
      }
    });

    // 3. 调用识别 API
    const recognizeResult = await callRecognizeAPI(screenshot);

    // 4. 发送识别结果到 Side Panel
    chrome.runtime.sendMessage({
      type: 'RECOGNIZE_COMPLETE',
      data: recognizeResult
    });

  } catch (error) {
    console.error('Capture and analyze error:', error);
    chrome.runtime.sendMessage({
      type: 'RECOGNIZE_ERROR',
      data: {
        error: error?.message || 'Recognition failed',
        code: error?.code,
        requestId: error?.requestId,
      }
    });
  }
}

/**
 * 调用视觉识别 API
 */
async function callRecognizeAPI(screenshotBase64) {
  // 移除 data:image/png;base64, 前缀
  const base64Data = screenshotBase64.replace(/^data:image\/\w+;base64,/, '');
  const apiBaseUrl = await getApiBaseUrl();

  const response = await fetch(`${apiBaseUrl}/api/recognize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ image: base64Data })
  });

  if (!response.ok) {
    const error = await response.json();
    throw parseApiError(error, 'Recognition failed');
  }

  return await response.json();
}

/**
 * 调用分析 API（SSE 流式）
 */
async function callAnalyzeAPI(symbol, direction, marketData) {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      symbol,
      direction,
      marketData
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw parseApiError(error, 'Analysis failed');
  }

  return response;
}

/**
 * 调用 Twitter 情绪分析 API
 */
async function callTwitterAPI(symbol) {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/twitter?symbol=${symbol}`);

  if (!response.ok) {
    const error = await response.json();
    throw parseApiError(error, 'Twitter sentiment analysis failed');
  }

  return await response.json();
}

async function callConfigStatusAPI() {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/config-status`);

  if (!response.ok) {
    const error = await response.json();
    throw parseApiError(error, 'Config status check failed');
  }

  return await response.json();
}

async function callTickerAPI(symbol) {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/ticker?symbol=${symbol}`);

  if (!response.ok) {
    const error = await response.json();
    throw parseApiError(error, 'Ticker fetch failed');
  }

  return await response.json();
}

async function callDecisionAPI(symbol, direction, marketData) {
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/decision`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      symbol,
      direction,
      marketData
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw parseApiError(error, 'Decision fetch failed');
  }

  return await response.json();
}

/**
 * 监听来自 Side Panel 的消息
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_SCREENSHOT') {
    // 返回当前截图
    sendResponse({ screenshot: currentScreenshot });
    return true;
  }

  if (message.type === 'START_ANALYSIS') {
    // 开始分析流程
    handleAnalysis(message.data)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // 保持消息通道开放
  }

  if (message.type === 'FETCH_TWITTER_SENTIMENT') {
    // 获取 Twitter 情绪
    callTwitterAPI(message.data.symbol)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message, code: error.code, requestId: error.requestId }));
    return true;
  }

  if (message.type === 'CHECK_CONFIG_STATUS') {
    callConfigStatusAPI()
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message, code: error.code, requestId: error.requestId }));
    return true;
  }

  if (message.type === 'GET_NOFOMO_DECISION') {
    const { symbol, direction } = message.data || {};
    callTickerAPI(symbol)
      .then((ticker) => {
        const marketData = {
          price: ticker?.lastPrice || '0',
          change24h: ticker?.priceChangePercent || '0',
          volume: ticker?.volume || '0',
          high24h: ticker?.highPrice || '0',
          low24h: ticker?.lowPrice || '0',
          fearGreedIndex: null,
          fearGreedLabel: null,
          klines: null,
        };
        return callDecisionAPI(symbol, direction || 'LONG', marketData);
      })
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((error) => sendResponse({ success: false, error: error.message, code: error.code, requestId: error.requestId }));
    return true;
  }

  if (message.type === 'RETRY_CAPTURE') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]) await captureAndAnalyze(tabs[0]);
    });
    return true;
  }

  // ========== Smart Intercept ==========

  if (message.type === 'INTERCEPT_TRADE') {
    handleTradeIntercept(message.data, sender)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === 'USER_DECISION') {
    const tabId = message.data?.tabId;
    const msgType = message.data.proceed ? 'PROCEED_TRADE' : 'CANCEL_TRADE';
    if (tabId) {
      chrome.tabs.sendMessage(tabId, { type: msgType });
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { type: msgType });
      });
    }
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'GET_CACHED_TICKER') {
    sendResponse(getCachedTicker(message.data?.symbol));
    return true;
  }

  if (message.type === 'LOG_INTERCEPT_DECISION') {
    handleLogInterceptDecision(message.data);
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'OPEN_SIDE_PANEL') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]) {
        try { await chrome.sidePanel.open({ tabId: tabs[0].id }); } catch { }
      }
    });
    sendResponse({ success: true });
    return true;
  }
});

/**
 * 处理分析请求
 */
async function handleAnalysis(data) {
  const { symbol, direction, marketData } = data;

  try {
    const response = await callAnalyzeAPI(symbol, direction, marketData);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          if (parsed.content) {
            fullText += parsed.content;
            // 流式发送到 Side Panel
            chrome.runtime.sendMessage({
              type: 'ANALYSIS_STREAM',
              data: { content: parsed.content, fullText }
            });
          }
        } catch {
          // 忽略解析错误
        }
      }
    }

    // 分析完成
    chrome.runtime.sendMessage({
      type: 'ANALYSIS_COMPLETE',
      data: { fullText }
    });

    return { fullText };

  } catch (error) {
    chrome.runtime.sendMessage({
      type: 'ANALYSIS_ERROR',
      data: {
        error: error?.message || 'Analysis failed',
        code: error?.code,
        requestId: error?.requestId,
      }
    });
    throw error;
  }
}

// ========== Smart Intercept Handlers ==========

async function handleTradeIntercept(data, sender) {
  const tabId = sender?.tab?.id;
  if (!tabId) return;

  try {
    // 1. 先写入 session storage（panel 打开后会读取）
    const interceptPayload = { ...data, tabId, timestamp: Date.now() };
    console.log('[Oracle-X BG] Storing intercept payload for tab:', tabId);
    await chrome.storage.session.set({ oraclex_pending_intercept: interceptPayload });

    // 2. 打开分析窗口（防重复）
    console.log('[Oracle-X BG] Opening analysis popup for tab:', tabId);
    if (currentInterceptWindowId) {
      try {
        const existingWin = await chrome.windows.get(currentInterceptWindowId);
        if (existingWin) {
          await chrome.windows.update(currentInterceptWindowId, { focused: true });
          console.log('[Oracle-X BG] Focused existing popup');
        }
      } catch {
        currentInterceptWindowId = null;
      }
    }
    if (!currentInterceptWindowId) {
      const win = await chrome.windows.create({
        url: 'intercept/intercept.html',
        type: 'popup',
        width: 400,
        height: 560,
        focused: true,
      });
      currentInterceptWindowId = win.id;
      // 窗口关闭时清除 ID
      chrome.windows.onRemoved.addListener(function onClose(id) {
        if (id === currentInterceptWindowId) {
          currentInterceptWindowId = null;
          chrome.windows.onRemoved.removeListener(onClose);
        }
      });
    }
    console.log('[Oracle-X BG] Analysis popup ready');

    // 3. 延迟也发消息（双保险）
    setTimeout(() => {
      console.log('[Oracle-X BG] Sending TRADE_INTERCEPTED message');
      chrome.runtime.sendMessage({
        type: 'TRADE_INTERCEPTED',
        data: interceptPayload
      }).catch((e) => { console.log('[Oracle-X BG] TRADE_INTERCEPTED send failed:', e.message); });
    }, 800);

    const { tradeContext } = data;
    const direction = tradeContext.direction === 'buy' ? 'LONG' : 'SHORT';
    const symbol = tradeContext.symbol;

    let marketData = {
      price: tradeContext.price || '0',
      change24h: '0', volume: '0', high24h: '0', low24h: '0',
      fearGreedIndex: null, fearGreedLabel: null, klines: null,
    };

    try {
      const ticker = await callTickerAPI(symbol);
      if (ticker) {
        marketData.price = ticker.lastPrice || marketData.price;
        marketData.change24h = ticker.priceChangePercent || '0';
        marketData.volume = ticker.volume || '0';
        marketData.high24h = ticker.highPrice || '0';
        marketData.low24h = ticker.lowPrice || '0';
      }
    } catch { }

    await handleAnalysis({ symbol, direction, marketData });
  } catch (error) {
    console.error('[Oracle-X] Trade intercept failed:', error);
    if (tabId) chrome.tabs.sendMessage(tabId, { type: 'PROCEED_TRADE' });
  }
}

async function handleLogInterceptDecision(data) {
  try {
    const result = await new Promise((resolve) => {
      chrome.storage.local.get('oraclex_intercept_logs', (r) => resolve(r));
    });
    const logs = result.oraclex_intercept_logs || [];
    logs.unshift(data);
    await new Promise((resolve) => {
      chrome.storage.local.set({ oraclex_intercept_logs: logs.slice(0, 1000) }, resolve);
    });
  } catch (err) {
    console.error('[Oracle-X] Failed to save intercept log:', err);
  }
}

console.log('Oracle-X Service Worker initialized (Smart Intercept enabled)');
