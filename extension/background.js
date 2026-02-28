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

// Desktop 本地服务地址
const DESKTOP_API = 'http://127.0.0.1:17891';
const DESKTOP_PING_TIMEOUT = 500; // ms

/**
 * 探测 Desktop 本地服务并返回配置
 * 成功返回 Desktop 配置对象，失败返回 null
 */
async function fetchDesktopSettings() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DESKTOP_PING_TIMEOUT);
    const res = await fetch(`${DESKTOP_API}/api/settings`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function getExtensionSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['oraclexBackendUrl', 'oraclexAiBaseUrl', 'oraclexAiApiKey', 'oraclexAiModel', 'oraclexAiVisionModel', 'oraclexApiBaseUrl'], async (result) => {
      const local = {
        backendUrl: result.oraclexBackendUrl || result.oraclexApiBaseUrl || 'http://localhost:3000',
        aiBaseUrl: (result.oraclexAiBaseUrl || 'https://api.stepfun.com/v1').replace(/\/$/, ''),
        aiApiKey: result.oraclexAiApiKey || '',
        aiModel: result.oraclexAiModel || 'step-1-8k',
        aiVisionModel: result.oraclexAiVisionModel || 'step-1o-turbo-vision',
      };

      // Desktop 优先：尝试从 Desktop 本地服务获取配置
      const desktop = await fetchDesktopSettings();
      if (desktop) {
        resolve({
          backendUrl: `${DESKTOP_API}`,  // 行情、ticker 表继续自从 Desktop 拿
          aiBaseUrl: desktop.aiBaseUrl || local.aiBaseUrl,
          aiApiKey: desktop.aiApiKey || local.aiApiKey,
          aiModel: desktop.aiModel || local.aiModel,
          aiVisionModel: desktop.aiVisionModel || local.aiVisionModel,
        });
      } else {
        // Desktop 不在线，降级到本地 chrome.storage 配置
        resolve(local);
      }
    });
  });
}

/**
 * 获取 API Base URL（用于传统的获取行情/推特）
 */
async function getApiBaseUrl() {
  const settings = await getExtensionSettings();
  return settings.backendUrl;
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
 * 调用视觉识别 — Desktop 优先，降级到 Extension 本地 Vision API
 */
async function callRecognizeAPI(screenshotBase64) {
  // 尝试 Desktop 代理
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(`${DESKTOP_API}/api/recognize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ screenshot: screenshotBase64 }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const result = await res.json();
      if (result && result.platform !== undefined) return result;
    }
  } catch { }

  // 降级：Extension 自身调 Vision API
  console.log('[Oracle-X] Desktop unavailable, fallback to local Vision AI');
  return callRecognizeAPILocal(screenshotBase64);
}

/**
 * 原有视觉识别逻辑（Extension 自身调 Vision API，作为降级 fallback）
 */
async function callRecognizeAPILocal(screenshotBase64) {
  const settings = await getExtensionSettings();
  if (!settings.aiApiKey) {
    throw new Error('AI API Key 未配置，请在扩展设置中填写。');
  }

  const base64Data = screenshotBase64.startsWith('data:') ? screenshotBase64 : `data:image/png;base64,${screenshotBase64.replace(/^data:image\/\w+;base64,/, '')}`;

  const prompt = `你是一个专业的交易界面识别专家。请分析这张交易平台截图，提取以下信息：

1. **平台** (platform): 识别交易平台名称，如 Binance、OKX、Bybit、Coinbase、Uniswap 等
2. **交易对** (pair): 识别正在查看的交易对，如 BTC/USDT、ETH/USDT 等
3. **交易类型** (trade_type): 判断是现货(spot)、永续合约(perpetual)还是交割合约(futures)
4. **方向提示** (direction_hint): 如果界面上有明显的做多/做空按钮被选中或价格走势暗示，给出方向提示

请严格按以下 JSON 格式输出（不要添加任何其他文字）：
{
  "platform": "平台名称",
  "pair": "交易对（格式：BASE/QUOTE）",
  "trade_type": "spot|perpetual|futures",
  "direction_hint": "long|short|null",
  "confidence": 0-100之间的置信度
}

如果无法识别某个字段，使用 null。`;

  const response = await fetch(`${settings.aiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${settings.aiApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: settings.aiVisionModel,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: base64Data } },
            { type: 'text', text: prompt }
          ]
        }
      ],
      temperature: 0.2,
      max_tokens: 500,
      stream: false
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vision AI error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  let result;
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      result = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON found in response');
    }
  } catch {
    result = { platform: null, pair: null, trade_type: null, direction_hint: null, confidence: 0 };
  }
  return result;
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
 * 处理分析请求 — Desktop 优先，降级到 Extension 本地 AI
 */
async function handleAnalysis(data) {
  // 尝试通过 Desktop 代理分析
  const desktopOk = await tryDesktopAnalysis(data);
  if (desktopOk) return { fullText: desktopOk };

  // 降级：Extension 自身 AI 逻辑
  console.log('[Oracle-X] Desktop unavailable, fallback to local AI');
  return handleAnalysisFallback(data);
}

/**
 * 通过 Desktop /api/analyze 进行 SSE 流式分析
 * 成功返回 fullText，失败返回 null
 */
async function tryDesktopAnalysis(data) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(`${DESKTOP_API}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) return null;

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
        const dataStr = line.slice(5).trim();
        if (dataStr === '[DONE]') continue;

        try {
          const parsed = JSON.parse(dataStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            fullText += content;
            chrome.runtime.sendMessage({
              type: 'ANALYSIS_STREAM',
              data: { content, fullText }
            });
          }
        } catch { }
      }
    }

    chrome.runtime.sendMessage({
      type: 'ANALYSIS_COMPLETE',
      data: { fullText }
    });

    return fullText;
  } catch {
    return null;
  }
}

/**
 * 原有分析逻辑（Extension 自身调 AI，作为降级 fallback）
 */
async function handleAnalysisFallback(data) {
  const { symbol, direction, marketData } = data;
  const settings = await getExtensionSettings();

  if (!settings.aiApiKey) {
    chrome.runtime.sendMessage({
      type: 'ANALYSIS_ERROR',
      data: { error: 'AI API Key 未配置，请在扩展设置中填写。' }
    });
    throw new Error('Missing AI API Key');
  }

  try {
    // 1. 尝试从本地后端获取复杂指标，作为附加参考
    let backendMarketData = null;
    try {
      if (settings.backendUrl) {
        const res = await fetch(`${settings.backendUrl}/api/market?symbol=${symbol}`);
        if (res.ok) backendMarketData = await res.json();
      }
    } catch {
      console.log('[Oracle-X] Backend unavailable, fallback to basic analysis');
    }

    // 2. 构造 Prompt
    let prompt = `请作为一名资深的加密货币交易员，对 ${symbol} 的 ${direction === 'LONG' ? '做多' : '做空'} 交易进行风险评估。\n\n`;
    prompt += `【当前基础行情】\n价格: $${marketData.price}\n24h涨跌: ${marketData.change24h}%\n24h高/低: $${marketData.high24h} / $${marketData.low24h}\n24h成交量: ${marketData.volume}\n\n`;

    if (backendMarketData && backendMarketData.indicators) {
      prompt += `【高级技术指标】\n`;
      const inds = backendMarketData.indicators;
      if (inds.rsi) prompt += `- RSI(14): ${inds.rsi.description}\n`;
      if (inds.macd) prompt += `- MACD: ${inds.macd.description}\n`;
      if (inds.bollingerBands) prompt += `- 布林带: ${inds.bollingerBands.description}\n`;
      if (inds.atr) prompt += `- ATR: ${inds.atr.description}\n`;
      prompt += '\n';
    } else {
      prompt += `（未提供高级技术指标，请以基础行情和截图信息为主）\n\n`;
    }

    if (backendMarketData && backendMarketData.sentiment) {
      prompt += `【社交情绪】\n综合情绪: ${backendMarketData.sentiment.overallSentiment} (置信度 ${backendMarketData.sentiment.confidencePercent}%)\n\n`;
    }

    prompt += `请综合上述数据，给出：\n1. 核心观点（看多/看空/震荡）\n2. 风险提示\n3. 最终操作建议（包含 🟢建议执行 或 🟡建议观望 或 🔴高风险）及简短理由。保持专业和简练。`;

    const systemPrompt = "你是一个冷静、客观、极度注重风险控制的顶级交易系统AI。你精通技术分析，总是试图寻找交易的潜在漏洞和高危信号。请直接输出分析内容，不要出现客套话。";

    // 3. 直接请求大模型
    const response = await fetch(`${settings.aiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.aiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: settings.aiModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1000,
        stream: true
      })
    });

    if (!response.ok) {
      throw new Error(`AI error: ${response.status}`);
    }

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
        const dataStr = line.slice(5).trim();
        if (dataStr === '[DONE]') continue;

        try {
          const parsed = JSON.parse(dataStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            fullText += content;
            chrome.runtime.sendMessage({
              type: 'ANALYSIS_STREAM',
              data: { content, fullText }
            });
          }
        } catch { }
      }
    }

    chrome.runtime.sendMessage({
      type: 'ANALYSIS_COMPLETE',
      data: { fullText }
    });

    return { fullText };
  } catch (error) {
    chrome.runtime.sendMessage({
      type: 'ANALYSIS_ERROR',
      data: { error: error?.message || 'Analysis failed' }
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
    // 1. 写入 chrome.storage（插件自身本地存储）
    const result = await new Promise((resolve) => {
      chrome.storage.local.get('oraclex_intercept_logs', (r) => resolve(r));
    });
    const logs = result.oraclex_intercept_logs || [];
    logs.unshift(data);
    await new Promise((resolve) => {
      chrome.storage.local.set({ oraclex_intercept_logs: logs.slice(0, 1000) }, resolve);
    });

    // 2. 同步写入 Desktop SQLite（fire-and-forget，失败静默）
    fetch(`${DESKTOP_API}/api/log-intercept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'intercept_from_extension',
        appName: data.symbol ? `Chrome Extension (${data.symbol})` : 'Chrome Extension',
        action: data.userAction || 'unknown',
        detail: { symbol: data.symbol, direction: data.direction, analysisText: data.analysisText },
      }),
    }).catch(() => { /* Desktop 不在线时静默失败 */ });

  } catch (err) {
    console.error('[Oracle-X] Failed to save intercept log:', err);
  }
}

console.log('Oracle-X Service Worker initialized (Smart Intercept enabled)');
