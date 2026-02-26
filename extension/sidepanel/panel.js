/**
 * Oracle-X Side Panel - 交互逻辑
 */

// 状态管理
const state = {
  screenshot: null,
  recognizeResult: null,
  selectedIntent: null,
  analysisText: '',
  status: 'idle', // idle | recognizing | recognized | analyzing | complete | error
  noFomoDecision: null,
  noFomoCountdown: null,
  noFomoRemaining: 0,
  pendingAnalyzePayload: null,
};

// DOM 元素
const elements = {
  retryBtn: document.getElementById('retryBtn'),
  statusSection: document.getElementById('statusSection'),
  statusContent: document.getElementById('statusContent'),
  recognizeCard: document.getElementById('recognizeCard'),
  recognizeContent: document.getElementById('recognizeContent'),
  intentSection: document.getElementById('intentSection'),
  longBtn: document.getElementById('longBtn'),
  shortBtn: document.getElementById('shortBtn'),
  analyzeOnlyBtn: document.getElementById('analyzeOnlyBtn'),
  noFomoSection: document.getElementById('noFomoSection'),
  noFomoContent: document.getElementById('noFomoContent'),
  noFomoActions: document.getElementById('noFomoActions'),
  noFomoProceedBtn: document.getElementById('noFomoProceedBtn'),
  noFomoCancelBtn: document.getElementById('noFomoCancelBtn'),
  scoreSection: document.getElementById('scoreSection'),
  scoreArc: document.getElementById('scoreArc'),
  scoreValue: document.getElementById('scoreValue'),
  scoreSummary: document.getElementById('scoreSummary'),
  analysisSection: document.getElementById('analysisSection'),
  analysisContent: document.getElementById('analysisContent'),
  conclusionSection: document.getElementById('conclusionSection'),
  conclusionBadge: document.getElementById('conclusionBadge'),
  // Twitter 元素
  twitterSection: document.getElementById('twitterSection'),
  twitterContent: document.getElementById('twitterContent'),
  // 分析阶段元素
  stageSection: document.getElementById('stageSection'),
  stageContent: document.getElementById('stageContent'),
};

/**
 * 初始化
 */
function init() {
  // 绑定事件
  elements.retryBtn.addEventListener('click', handleRetry);
  elements.longBtn.addEventListener('click', () => handleIntentSelect('LONG'));
  elements.shortBtn.addEventListener('click', () => handleIntentSelect('SHORT'));
  elements.analyzeOnlyBtn.addEventListener('click', () => handleIntentSelect('ANALYZE'));
  elements.noFomoProceedBtn.addEventListener('click', continueToAnalysis);
  elements.noFomoCancelBtn.addEventListener('click', cancelNoFomoFlow);
  
  // 监听来自 Service Worker 的消息
  chrome.runtime.onMessage.addListener(handleMessage);

  checkConfigStatus();
  
  // 请求当前截图（如果已存在）
  chrome.runtime.sendMessage({ type: 'GET_SCREENSHOT' }, (response) => {
    if (response && response.screenshot) {
      state.screenshot = response.screenshot;
    }
  });
}

async function checkConfigStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'CHECK_CONFIG_STATUS' });
    if (!response?.success) {
      showStatus(`配置检查失败：${response?.error || 'unknown error'}`, response?.code, response?.requestId);
      return;
    }

    const cfg = response.data || {};
    const missing = [];
    if (!cfg.aiApiKeyConfigured) missing.push('STEP_API_KEY');
    if (!cfg.aiBaseUrlConfigured) missing.push('AI_BASE_URL');
    if (!cfg.aiModelConfigured) missing.push('AI_MODEL');

    if (missing.length > 0) {
      showStatus(`后端配置缺失：${missing.join(', ')}`);
    }
  } catch (error) {
    showStatus(`配置检查失败：${error?.message || 'unknown error'}`);
  }
}

/**
 * 处理来自 Service Worker 的消息
 */
function handleMessage(message) {
  switch (message.type) {
    case 'SCREENSHOT_CAPTURED':
      state.screenshot = message.data.screenshot;
      state.status = 'recognizing';
      renderRecognizing();
      break;
      
    case 'RECOGNIZE_COMPLETE':
      state.recognizeResult = message.data;
      state.status = 'recognized';
      renderRecognizeResult();
      break;
      
    case 'RECOGNIZE_ERROR':
      state.status = 'error';
      renderRecognizeError(message.data.error, {
        code: message.data.code,
        requestId: message.data.requestId
      });
      break;
      
    case 'ANALYSIS_STREAM':
      state.analysisText = message.data.fullText;
      renderAnalysisStream();
      break;
      
    case 'ANALYSIS_COMPLETE':
      state.analysisText = message.data.fullText;
      state.status = 'complete';
      hideStatus();
      renderAnalysisComplete();
      break;
      
    case 'ANALYSIS_ERROR':
      state.status = 'error';
      renderAnalysisError(message.data.error, {
        code: message.data.code,
        requestId: message.data.requestId
      });
      break;
  }
}

/**
 * 渲染识别中状态
 */
function renderRecognizing() {
  hideStatus();
  showStageIndicator('recognizing', '正在识别交易页面...');
  elements.recognizeContent.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <span>正在识别交易页面...</span>
    </div>
  `;
  elements.intentSection.classList.add('hidden');
  elements.scoreSection.classList.add('hidden');
  elements.analysisSection.classList.add('hidden');
  elements.conclusionSection.classList.add('hidden');
}

/**
 * 渲染识别结果
 */
function renderRecognizeResult() {
  updateStageIndicator('recognized', `已识别: ${state.recognizeResult?.platform || 'Unknown'} ${state.recognizeResult?.pair || ''}`);
  const result = state.recognizeResult;
  
  if (!result || (!result.platform && !result.pair)) {
    elements.recognizeContent.innerHTML = `
      <div class="error-state">
        <span>⚠️</span>
        <span>无法识别交易页面，请确保页面显示完整</span>
      </div>
    `;
    return;
  }
  
  const platformIcon = getPlatformIcon(result.platform);
  const tradeTypeLabel = getTradeTypeLabel(result.trade_type);
  
  elements.recognizeContent.innerHTML = `
    <div class="recognize-result">
      <div class="platform-badge">
        ${platformIcon}
        <span>${result.platform || '未知平台'}</span>
      </div>
      <div class="pair-display">${result.pair || '未知交易对'}</div>
      ${tradeTypeLabel ? `<div class="trade-type">${tradeTypeLabel}</div>` : ''}
    </div>
  `;
  
  // 显示意图选择
  elements.intentSection.classList.remove('hidden');
}

/**
 * 渲染识别错误
 */
function renderRecognizeError(error, meta = {}) {
  showStatus(`识别失败：${error}`, meta.code, meta.requestId);
  elements.recognizeContent.innerHTML = `
    <div class="error-state">
      <span>❌</span>
      <span>识别失败: ${error}</span>
    </div>
  `;
}

/**
 * 处理意图选择
 */
async function handleIntentSelect(intent) {
  state.selectedIntent = intent;
  state.status = 'analyzing';
  state.analysisText = '';

  const result = state.recognizeResult;
  const symbol = (result?.pair || 'BTCUSDT').replace('/', '');
  const direction = intent === 'LONG' ? 'LONG' : intent === 'SHORT' ? 'SHORT' : 'LONG';

  state.pendingAnalyzePayload = {
    symbol,
    direction,
    marketData: {
      price: '0',
      change24h: '0',
      volume: '0',
      high24h: '0',
      low24h: '0',
      fearGreedIndex: null,
      fearGreedLabel: null,
      klines: null,
    }
  };

  elements.intentSection.classList.add('hidden');
  elements.noFomoSection.classList.remove('hidden');
  elements.noFomoActions.classList.add('hidden');
  elements.noFomoContent.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <span>正在计算 NoFOMO 风险...</span>
    </div>
  `;

  showStageIndicator('nofomo', 'NoFOMO 冷静层检查中...');

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_NOFOMO_DECISION',
      data: { symbol, direction }
    });

    if (!response?.success) {
      showStatus(`NoFOMO 决策失败：${response?.error || 'unknown error'}`, response?.code, response?.requestId);
      continueToAnalysis();
      return;
    }

    const decision = response.data?.decision;
    state.noFomoDecision = decision;
    renderNoFomoDecision(decision);
  } catch (error) {
    showStatus(`NoFOMO 决策失败：${error?.message || 'unknown error'}`);
    continueToAnalysis();
  }
}

function startAnalysisFlow() {
  const payload = state.pendingAnalyzePayload;
  if (!payload) return;

  elements.scoreSection.classList.remove('hidden');
  elements.analysisSection.classList.remove('hidden');
  elements.noFomoSection.classList.add('hidden');

  elements.analysisContent.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <span>AI 正在分析...</span>
    </div>
  `;

  chrome.runtime.sendMessage({
    type: 'START_ANALYSIS',
    data: payload,
  });

  fetchAndRenderTwitterSentiment(payload.symbol);
}

function renderNoFomoDecision(decision) {
  if (!decision) {
    continueToAnalysis();
    return;
  }

  const actionColor = decision.action === 'BLOCK'
    ? 'var(--accent-red)'
    : decision.action === 'WARN'
      ? 'var(--accent-yellow)'
      : 'var(--accent-green)';

  elements.noFomoContent.innerHTML = `
    <div class="nofomo-top" style="border-left: 3px solid ${actionColor}">
      <div><strong>决策：</strong>${decision.action}</div>
      <div><strong>Impulse Score：</strong>${decision.impulseScore}</div>
      <div><strong>冷静倒计时：</strong>${decision.coolingSeconds}s</div>
    </div>
    <ul class="nofomo-reasons">
      ${(decision.reasons || []).map((r) => `<li>${r}</li>`).join('')}
    </ul>
  `;

  if (decision.action === 'ALLOW') {
    startAnalysisFlow();
    return;
  }

  elements.noFomoActions.classList.remove('hidden');

  if (decision.coolingSeconds > 0) {
    state.noFomoRemaining = decision.coolingSeconds;
    elements.noFomoProceedBtn.disabled = true;
    elements.noFomoProceedBtn.textContent = `冷静中 ${state.noFomoRemaining}s`;

    clearInterval(state.noFomoCountdown);
    state.noFomoCountdown = setInterval(() => {
      state.noFomoRemaining -= 1;
      if (state.noFomoRemaining <= 0) {
        clearInterval(state.noFomoCountdown);
        state.noFomoCountdown = null;
        elements.noFomoProceedBtn.disabled = false;
        elements.noFomoProceedBtn.textContent = '继续分析';
      } else {
        elements.noFomoProceedBtn.textContent = `冷静中 ${state.noFomoRemaining}s`;
      }
    }, 1000);
  } else {
    elements.noFomoProceedBtn.disabled = false;
    elements.noFomoProceedBtn.textContent = '继续分析';
  }
}

function continueToAnalysis() {
  clearInterval(state.noFomoCountdown);
  state.noFomoCountdown = null;
  elements.noFomoActions.classList.add('hidden');
  startAnalysisFlow();
}

function cancelNoFomoFlow() {
  clearInterval(state.noFomoCountdown);
  state.noFomoCountdown = null;
  state.pendingAnalyzePayload = null;
  state.noFomoDecision = null;

  elements.noFomoSection.classList.add('hidden');
  elements.intentSection.classList.remove('hidden');
  elements.scoreSection.classList.add('hidden');
  elements.analysisSection.classList.add('hidden');
  elements.twitterSection.classList.add('hidden');
  elements.conclusionSection.classList.add('hidden');
  elements.analysisContent.innerHTML = '';
}

/**
 * 渲染流式分析内容
 */
function renderAnalysisStream() {
  updateStageIndicator('analyzing', 'AI 分析中...');
  elements.analysisContent.innerHTML = state.analysisText + '<span class="cursor-blink">▊</span>';
  elements.analysisContent.scrollTop = elements.analysisContent.scrollHeight;
  
  // 更新分数
  updateScoreFromText(state.analysisText);
}

/**
 * 渲染分析完成
 */
function renderAnalysisComplete() {
  hideStageIndicator();
  elements.analysisContent.innerHTML = state.analysisText;
  
  // 更新最终分数
  updateScoreFromText(state.analysisText);
  
  // 显示结论
  renderConclusion();
}

/**
 * 渲染分析错误
 */
function renderAnalysisError(error, meta = {}) {
  showStatus(`分析失败：${error}`, meta.code, meta.requestId);
  elements.analysisContent.innerHTML = `
    <div class="error-state">
      <span>❌</span>
      <span>分析失败: ${error}</span>
    </div>
  `;
}

/**
 * 从文本中提取分数并更新仪表盘
 */
function updateScoreFromText(text) {
  // 尝试从文本中提取评分
  let score = 50; // 默认分数
  let summary = '分析中...';
  
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('🟢') || lowerText.includes('建议执行')) {
    score = 75;
    summary = '当前市场环境有利';
  } else if (lowerText.includes('🔴') || lowerText.includes('高风险')) {
    score = 25;
    summary = '当前市场风险较高';
  } else if (lowerText.includes('🟡') || lowerText.includes('观望')) {
    score = 50;
    summary = '建议谨慎观望';
  }
  
  // 更新仪表盘
  const arcLength = (score / 100) * 126; // 126 是半圆弧长
  elements.scoreArc.style.strokeDasharray = `${arcLength} 126`;
  elements.scoreValue.textContent = score;
  elements.scoreSummary.textContent = summary;
  
  // 更新分数颜色
  if (score >= 60) {
    elements.scoreValue.style.color = '#22c55e';
  } else if (score <= 40) {
    elements.scoreValue.style.color = '#ef4444';
  } else {
    elements.scoreValue.style.color = '#eab308';
  }
}

/**
 * 渲染结论徽章
 */
function renderConclusion() {
  hideStageIndicator();
  const text = state.analysisText.toLowerCase();
  let riskLevel = 'medium';
  let title = '🟡 建议观望';
  let desc = '市场信号混合，建议谨慎评估后再行动';
  
  if (text.includes('🟢') || text.includes('建议执行')) {
    riskLevel = 'low';
    title = '🟢 条件有利';
    desc = '技术指标和市场情绪支持当前交易方向';
  } else if (text.includes('🔴') || text.includes('高风险')) {
    riskLevel = 'high';
    title = '🔴 高风险警告';
    desc = '当前市场条件不利，建议暂缓操作';
  }
  
  elements.conclusionBadge.className = `conclusion-badge ${riskLevel}`;
  elements.conclusionBadge.querySelector('.conclusion-title').textContent = title;
  elements.conclusionBadge.querySelector('.conclusion-desc').textContent = desc;
  elements.conclusionSection.classList.remove('hidden');
}

/**
 * 处理重试
 */
function handleRetry() {
  state.status = 'idle';
  state.recognizeResult = null;
  state.analysisText = '';
  
  chrome.runtime.sendMessage({ type: 'RETRY_CAPTURE' });
  renderRecognizing();
}

function showStatus(message, code, requestId) {
  const extras = [];
  if (code) extras.push(`code: ${code}`);
  if (requestId) extras.push(`request: ${requestId}`);

  const extraLine = extras.length > 0 ? `<div class="status-meta">${extras.join(' · ')}</div>` : '';
  elements.statusContent.innerHTML = `
    <div class="status-text">${message}</div>
    ${extraLine}
  `;
  elements.statusSection.classList.remove('hidden');
}

function hideStatus() {
  elements.statusSection.classList.add('hidden');
  elements.statusContent.innerHTML = '';
}

/**
 * 分析阶段指示器
 */
function showStageIndicator(stage, message) {
  if (!elements.stageSection || !elements.stageContent) return;
  elements.stageSection.classList.remove('hidden');
  const stageIcons = {
    idle: '⏳',
    recognizing: '🔍',
    recognized: '✅',
    nofomo: '🧊',
    analyzing: '⚡',
    complete: '🎯'
  };
  elements.stageContent.innerHTML = `
    <div class="stage-item active">
      <span class="stage-icon">${stageIcons[stage] || '⏳'}</span>
      <span>${message}</span>
    </div>
  `;
}

function updateStageIndicator(stage, message) {
  showStageIndicator(stage, message);
}

function hideStageIndicator() {
  if (elements.stageSection) {
    elements.stageSection.classList.add('hidden');
  }
}

/**
 * 获取平台图标
 */
function getPlatformIcon(platform) {
  const icons = {
    'Binance': '🟡',
    'OKX': '⚪',
    'Bybit': '🟠',
    'Coinbase': '🔵',
    'Uniswap': '🦄',
    'default': '📊'
  };
  return icons[platform] || icons.default;
}

/**
 * 获取交易类型标签
 */
function getTradeTypeLabel(type) {
  const labels = {
    'spot': '现货交易',
    'perpetual': '永续合约',
    'futures': '交割合约'
  };
  return labels[type] || '';
}

/**
 * 获取并渲染 Twitter 情绪
 */
async function fetchAndRenderTwitterSentiment(symbol) {
  elements.twitterSection.classList.remove('hidden');
  elements.twitterContent.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <span>正在分析推文...</span>
    </div>
  `;

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'FETCH_TWITTER_SENTIMENT',
      data: { symbol }
    });

    if (response.success) {
      renderTwitterSentiment(response.data);
    } else {
      renderTwitterError(response.error);
    }
  } catch (error) {
    renderTwitterError(error.message);
  }
}

/**
 * 渲染 Twitter 情绪面板
 */
function renderTwitterSentiment(data) {
  const { totalCount, positive, negative, neutral, overallSentiment, confidencePercent, tweets } = data;
  
  const positivePercent = totalCount > 0 ? Math.round((positive / totalCount) * 100) : 0;
  const negativePercent = totalCount > 0 ? Math.round((negative / totalCount) * 100) : 0;
  const neutralPercent = totalCount > 0 ? Math.round((neutral / totalCount) * 100) : 0;
  
  const sentimentColor = overallSentiment === 'BULLISH' ? 'var(--accent-green)' : 
                         overallSentiment === 'BEARISH' ? 'var(--accent-red)' : '#9e9e9e';
  
  const emoji = overallSentiment === 'BULLISH' ? '🟢' : overallSentiment === 'BEARISH' ? '🔴' : '⚪';

  elements.twitterContent.innerHTML = `
    <div class="twitter-dashboard">
      <div class="sentiment-overall" style="border-left: 3px solid ${sentimentColor}">
        <span>${emoji} ${overallSentiment}</span>
        <span style="color: ${sentimentColor}">${confidencePercent}%</span>
      </div>
      
      <div class="sentiment-bar">
        <div class="bar-segment bg-green" style="width: ${positivePercent}%"></div>
        <div class="bar-segment bg-gray" style="width: ${neutralPercent}%"></div>
        <div class="bar-segment bg-red" style="width: ${negativePercent}%"></div>
      </div>
      
      <div class="tweets-list">
        ${tweets.slice(0, 5).map(tweet => `
          <div class="tweet-card ${tweet.sentiment.toLowerCase()}">
            <div class="tweet-header">
              <span class="tweet-author">@${tweet.authorHandle || tweet.author}</span>
              <span class="tweet-time">${tweet.timeAgo || new Date(tweet.createdAt).toLocaleDateString()}</span>
            </div>
            <div class="tweet-text">${tweet.text}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * 渲染 Twitter 错误
 */
function renderTwitterError(error) {
  elements.twitterContent.innerHTML = `
    <div class="error-state">
      <span>❌</span>
      <span>获取推文失败: ${error}</span>
    </div>
  `;
}

// 初始化
init();
