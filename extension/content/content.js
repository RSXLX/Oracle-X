/**
 * Oracle-X Content Script - Smart Intercept
 * 自动监听交易平台买卖按钮，两阶段智能分析
 * Stage 1: 本地快速评分 (< 500ms)
 * Stage 2: AI 深度分析 (via Side Panel)
 */

(function () {
  'use strict';

  const PlatformDetector = window.OracleXPlatforms;
  const QuickScorer = window.OracleXQuickScorer;
  const Bubble = window.OracleXBubble;

  // 状态管理
  let smartInterceptEnabled = true;
  let interceptSensitivity = 'balanced';
  let lowRiskNotify = 'bubble';
  let apiTimeout = 30;
  let enabledPlatforms = [];
  let currentPlatform = null;

  // 防重复拦截
  const PROCEED_COOLDOWN_MS = 3000;
  let proceedTimestamps = {};  // { elementId: timestamp }

  // ========== 设置读取 ==========

  async function loadSettings() {
    try {
      const result = await new Promise((resolve) => {
        chrome.storage.local.get('oraclexSettings', (r) => resolve(r));
      });
      const settings = result.oraclexSettings || {};
      smartInterceptEnabled = settings.enableSmartIntercept !== false;
      interceptSensitivity = settings.interceptSensitivity || 'balanced';
      lowRiskNotify = settings.lowRiskNotify || 'bubble';
      apiTimeout = settings.apiTimeout || 5;
      enabledPlatforms = settings.enabledPlatforms || [];
    } catch {
      // 使用默认值
    }
  }

  // ========== 交易上下文提取 ==========

  function extractTradeContext(platform, tradeType, tradeInfo) {
    return {
      symbol: tradeInfo?.normalizedSymbol || tradeInfo?.symbol || 'UNKNOWN',
      rawSymbol: tradeInfo?.symbol || 'UNKNOWN',
      price: tradeInfo?.price || '0',
      direction: tradeType,    // 'buy' | 'sell'
      platform: platform.name,
      platformId: platform.id,
      leverage: tradeInfo?.leverage || null,
      amount: tradeInfo?.amount || null,
      orderType: tradeInfo?.orderType || null,
      ticker: null,            // 由缓存填充
    };
  }

  // ========== 获取缓存 Ticker ==========

  async function fetchCachedTicker(symbol) {
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { type: 'GET_CACHED_TICKER', data: { symbol } },
          (r) => resolve(r)
        );
      });
      return response || null;
    } catch {
      return null;
    }
  }

  // ========== 防重复拦截 ==========

  function getElementId(element) {
    // 为元素生成唯一标识
    if (element.id) return element.id;
    const tag = element.tagName;
    const text = (element.textContent || '').slice(0, 30);
    const rect = element.getBoundingClientRect();
    return `${tag}_${text}_${Math.round(rect.x)}_${Math.round(rect.y)}`;
  }

  function isInCooldown(element) {
    const id = getElementId(element);
    const ts = proceedTimestamps[id];
    if (!ts) return false;
    if (Date.now() - ts < PROCEED_COOLDOWN_MS) return true;
    delete proceedTimestamps[id];
    return false;
  }

  function markProceeded(element) {
    const id = getElementId(element);
    proceedTimestamps[id] = Date.now();
    element.setAttribute('data-oraclex-proceed', 'true');
  }

  // ========== 等待用户决策 ==========

  function awaitUserDecision(targetElement) {
    return new Promise((resolve) => {
      function onMessage(message) {
        if (message.type === 'PROCEED_TRADE') {
          chrome.runtime.onMessage.removeListener(onMessage);
          resolve(true);
        } else if (message.type === 'CANCEL_TRADE') {
          chrome.runtime.onMessage.removeListener(onMessage);
          resolve(false);
        }
      }
      chrome.runtime.onMessage.addListener(onMessage);

      // 超时自动放行
      setTimeout(() => {
        chrome.runtime.onMessage.removeListener(onMessage);
        console.log('[Oracle-X] Analysis timeout, auto-proceeding');
        resolve(true);
      }, apiTimeout * 1000);
    });
  }

  // ========== 记录决策日志 ==========

  function logDecision(tradeContext, scoreResult, aiRiskLevel, userAction) {
    try {
      chrome.runtime.sendMessage({
        type: 'LOG_INTERCEPT_DECISION',
        data: {
          timestamp: new Date().toISOString(),
          platform: tradeContext.platform,
          symbol: tradeContext.symbol,
          rawSymbol: tradeContext.rawSymbol,
          direction: tradeContext.direction,
          price: tradeContext.price,
          leverage: tradeContext.leverage,
          quickScore: scoreResult.score,
          quickLevel: scoreResult.level,
          quickReasons: scoreResult.reasons,
          aiRiskLevel: aiRiskLevel,
          userAction: userAction,  // 'proceed' | 'cancel' | 'auto_pass'
        }
      });
    } catch {
      // ignore
    }
  }

  // ========== 模拟原始点击 ==========

  function simulateOriginalClick(target) {
    markProceeded(target);
    // 使用 dispatchEvent 而非 target.click()，避免再次被拦截
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window,
    });
    // 标记为已放行的事件
    event._oraclex_proceed = true;
    target.dispatchEvent(event);
  }

  // ========== 主拦截处理 ==========

  async function handleIntercept(e, platform, tradeType) {
    const target = e.target.closest(
      tradeType === 'buy' ? platform.buyButton : platform.sellButton
    ) || e.target;

    // 防重复检查
    if (isInCooldown(target)) {
      console.log('[Oracle-X] Button in cooldown, skipping');
      return;
    }

    // 阻止原始操作
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    // 提取交易上下文
    const tradeInfo = PlatformDetector?.getTradeInfo(platform);
    const tradeContext = extractTradeContext(platform, tradeType, tradeInfo);

    console.log('[Oracle-X] Intercepted:', tradeType, 'on', platform.name, tradeContext);

    // 获取缓存的 ticker 数据
    const ticker = await fetchCachedTicker(tradeContext.symbol);
    tradeContext.ticker = ticker;

    // ===== Stage 1: 快速评分 =====
    const scoreResult = QuickScorer
      ? QuickScorer.quickScore(tradeContext, interceptSensitivity)
      : { score: 50, level: 'medium', reasons: ['评分引擎未加载'] };

    console.log('[Oracle-X] Quick Score:', scoreResult);

    // ===== 根据风险级别决定处理方式 =====
    if (scoreResult.level === 'low') {
      // 低风险：气泡通知 + 自动放行
      if (lowRiskNotify === 'bubble' && Bubble) {
        Bubble.show(scoreResult, e.clientX, e.clientY, tradeContext);
      }
      logDecision(tradeContext, scoreResult, null, 'auto_pass');
      simulateOriginalClick(target);
    } else {
      // 中/高风险：通知 Service Worker 打开 Side Panel
      try {
        chrome.runtime.sendMessage({
          type: 'INTERCEPT_TRADE',
          data: { tradeContext, scoreResult }
        });
      } catch (err) {
        console.error('[Oracle-X] Failed to notify SW:', err);
        // 降级：直接放行
        logDecision(tradeContext, scoreResult, null, 'auto_pass');
        simulateOriginalClick(target);
        return;
      }

      // 等待用户决策
      const proceed = await awaitUserDecision(target);

      if (proceed) {
        logDecision(tradeContext, scoreResult, null, 'proceed');
        simulateOriginalClick(target);
      } else {
        logDecision(tradeContext, scoreResult, null, 'cancel');
        console.log('[Oracle-X] Trade cancelled by user');
      }
    }
  }

  // ========== 初始化 ==========

  async function init() {
    console.log('[Oracle-X] Content script init started');

    // 加载设置
    await loadSettings();

    // 检测平台
    currentPlatform = PlatformDetector?.detectPlatform();
    if (!currentPlatform) {
      console.log('[Oracle-X] Not a supported trading platform, hostname:', window.location.hostname);
      return;
    }

    // 检查平台是否启用（localhost 始终允许）
    if (currentPlatform.id !== 'localhost' && enabledPlatforms.length > 0 && !enabledPlatforms.includes(currentPlatform.id)) {
      console.log('[Oracle-X] Platform disabled:', currentPlatform.name);
      return;
    }

    // 检查智能拦截是否启用
    if (!smartInterceptEnabled) {
      console.log('[Oracle-X] Smart Intercept is disabled');
      return;
    }

    console.log('[Oracle-X] Smart Intercept loaded for', currentPlatform.name);

    // 在捕获阶段监听点击
    document.addEventListener('click', function (e) {
      // 跳过已放行的点击
      if (e._oraclex_proceed) return;
      if (e.target.getAttribute?.('data-oraclex-proceed') === 'true') {
        e.target.removeAttribute('data-oraclex-proceed');
        return;
      }

      const target = e.target;
      const isBuyButton = target.closest(currentPlatform.buyButton);
      const isSellButton = target.closest(currentPlatform.sellButton);

      if (isBuyButton || isSellButton) {
        const tradeType = isBuyButton ? 'buy' : 'sell';
        handleIntercept(e, currentPlatform, tradeType);
      }
    }, true); // true = 捕获阶段

    // 监听设置变更
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.oraclexSettings) {
        const newSettings = changes.oraclexSettings.newValue || {};
        smartInterceptEnabled = newSettings.enableSmartIntercept !== false;
        interceptSensitivity = newSettings.interceptSensitivity || 'balanced';
        lowRiskNotify = newSettings.lowRiskNotify || 'bubble';
        apiTimeout = newSettings.apiTimeout || 5;
        enabledPlatforms = newSettings.enabledPlatforms || [];
        console.log('[Oracle-X] Settings updated');
      }
    });
  }

  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
