/**
 * Oracle-X Desktop Renderer - Full Settings
 */

const els = {
  // AI Config
  aiProvider: document.getElementById('aiProvider'),
  apiKey: document.getElementById('apiKey'),
  apiBaseUrl: document.getElementById('apiBaseUrl'),
  aiModel: document.getElementById('aiModel'),
  
  // Data Sources
  source_binance: document.getElementById('source_binance'),
  source_bybit: document.getElementById('source_bybit'),
  source_coingecko: document.getElementById('source_coingecko'),
  source_alpaca: document.getElementById('source_alpaca'),
  alpaca_key: document.getElementById('alpaca_key'),
  alpaca_secret: document.getElementById('alpaca_secret'),
  
  // Sentiment
  sentiment_coingecko: document.getElementById('sentiment_coingecko'),
  sentiment_twitter: document.getElementById('sentiment_twitter'),
  sentiment_news: document.getElementById('sentiment_news'),
  twitter_key: document.getElementById('twitter_key'),
  news_key: document.getElementById('news_key'),
  
  // Intercept Settings
  profile: document.getElementById('profile'),
  cooldown: document.getElementById('cooldown'),
  enableBlock: document.getElementById('enableBlock'),
  autoAnalyze: document.getElementById('autoAnalyze'),
  
  // Backend
  backendUrl: document.getElementById('backendUrl'),
  testConnection: document.getElementById('testConnection'),
  connectionStatus: document.getElementById('connectionStatus'),
  
  // Actions
  saveBtn: document.getElementById('saveBtn'),
  resetBtn: document.getElementById('resetBtn'),
  
  // Stats
  todayBlock: document.getElementById('todayBlock'),
  todayAnalyze: document.getElementById('todayAnalyze'),
  mitigationRate: document.getElementById('mitigationRate'),
  
  // Logs
  refreshLogBtn: document.getElementById('refreshLogBtn'),
  logTbody: document.getElementById('logTbody'),
};

const DEFAULT_SETTINGS = {
  aiProvider: 'stepfun',
  apiKey: '',
  apiBaseUrl: 'https://api.stepfun.com/v1',
  aiModel: 'step-1-8k',
  
  dataSources: {
    crypto: ['binance', 'coingecko'],
    stock: [],
    futures: [],
  },
  
  sentimentSources: ['coingecko'],
  
  credentials: {
    alpaca_key: '',
    alpaca_secret: '',
    twitter_key: '',
    news_key: '',
  },
  
  profile: 'balanced',
  cooldown: 5,
  enableBlock: true,
  autoAnalyze: true,
  backendUrl: 'http://localhost:3000',
};

async function loadSettings() {
  try {
    const s = await window.oracleDesktop.getSettings();
    if (!s) return;
    
    els.aiProvider.value = s.aiProvider || DEFAULT_SETTINGS.aiProvider;
    els.apiKey.value = s.apiKey || '';
    els.apiBaseUrl.value = s.apiBaseUrl || DEFAULT_SETTINGS.apiBaseUrl;
    els.aiModel.value = s.aiModel || DEFAULT_SETTINGS.aiModel;
    
    // Data Sources
    els.source_binance.checked = s.dataSources?.crypto?.includes('binance');
    els.source_bybit.checked = s.dataSources?.crypto?.includes('bybit');
    els.source_coingecko.checked = s.dataSources?.crypto?.includes('coingecko');
    els.source_alpaca.checked = s.dataSources?.stock?.includes('alpaca');
    els.alpaca_key.value = s.credentials?.alpaca_key || '';
    els.alpaca_secret.value = s.credentials?.alpaca_secret || '';
    
    // Sentiment
    els.sentiment_coingecko.checked = s.sentimentSources?.includes('coingecko');
    els.sentiment_twitter.checked = s.sentimentSources?.includes('twitter');
    els.sentiment_news.checked = s.sentimentSources?.includes('news');
    els.twitter_key.value = s.credentials?.twitter_key || '';
    els.news_key.value = s.credentials?.news_key || '';
    
    // Intercept
    els.profile.value = s.profile || DEFAULT_SETTINGS.profile;
    els.cooldown.value = s.cooldown || DEFAULT_SETTINGS.cooldown;
    els.enableBlock.checked = s.enableBlock !== false;
    els.autoAnalyze.checked = s.autoAnalyze !== false;
    
    // Backend
    els.backendUrl.value = s.backendUrl || DEFAULT_SETTINGS.backendUrl;
  } catch (err) {
    console.error('Load settings error:', err);
  }
}

async function saveSettings() {
  const settings = {
    aiProvider: els.aiProvider.value,
    apiKey: els.apiKey.value,
    apiBaseUrl: els.apiBaseUrl.value,
    aiModel: els.aiModel.value,
    
    dataSources: {
      crypto: [
        ...(els.source_binance.checked ? ['binance'] : []),
        ...(els.source_bybit.checked ? ['bybit'] : []),
        ...(els.source_coingecko.checked ? ['coingecko'] : []),
      ],
      stock: [
        ...(els.source_alpaca.checked ? ['alpaca'] : []),
      ],
      futures: [],
    },
    
    sentimentSources: [
      ...(els.sentiment_coingecko.checked ? ['coingecko'] : []),
      ...(els.sentiment_twitter.checked ? ['twitter'] : []),
      ...(els.sentiment_news.checked ? ['news'] : []),
    ],
    
    credentials: {
      alpaca_key: els.alpaca_key.value,
      alpaca_secret: els.alpaca_secret.value,
      twitter_key: els.twitter_key.value,
      news_key: els.news_key.value,
    },
    
    profile: els.profile.value,
    cooldown: parseInt(els.cooldown.value) || 5,
    enableBlock: els.enableBlock.checked,
    autoAnalyze: els.autoAnalyze.checked,
    backendUrl: els.backendUrl.value,
  };
  
  await window.oracleDesktop.saveSettings(settings);
}

function renderLogs(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    els.logTbody.innerHTML = '<tr><td colspan="6" class="muted">暂无决策日志</td></tr>';
    return;
  }
  
  els.logTbody.innerHTML = items.slice(0, 100).map(row => `
    <tr>
      <td>${new Date(row.createdAt).toLocaleString()}</td>
      <td>${row.symbol || '-'}</td>
      <td>${row.direction || '-'}</td>
      <td><span class="badge badge-${(row.decision?.action || 'ALLOW').toLowerCase()}">${row.decision?.action || '-'}</span></td>
      <td>${row.decision?.impulseScore ?? '-'}</td>
      <td>${row.marketData?.change24h ?? '-'}</td>
    </tr>
  `).join('');
}

async function refreshLogs() {
  try {
    const limit = 50;
    const res = await window.oracleDesktop.listDecisionLogs(limit);
    renderLogs(res.items || []);
    
    const items = res.items || [];
    const today = new Date().toDateString();
    const todayItems = items.filter(i => new Date(i.createdAt).toDateString() === today);
    const blocks = todayItems.filter(i => i.decision?.action === 'BLOCK').length;
    const analyzed = todayItems.length;
    const mitigation = analyzed > 0 ? Math.round((analyzed - blocks) / analyzed * 100) : 0;
    
    els.todayBlock.textContent = blocks;
    els.todayAnalyze.textContent = analyzed;
    els.mitigationRate.textContent = mitigation + '%';
  } catch (err) {
    console.error('Load logs error:', err);
  }
}

async function testConnection() {
  els.connectionStatus.textContent = '测试中...';
  els.connectionStatus.className = 'status';
  
  try {
    const ok = await window.oracleDesktop.testConnection();
    els.connectionStatus.textContent = ok ? '✅ 连接成功' : '❌ 连接失败';
    els.connectionStatus.className = ok ? 'status success' : 'status error';
  } catch (err) {
    els.connectionStatus.textContent = '❌ ' + (err?.message || err);
    els.connectionStatus.className = 'status error';
  }
}

// Event Listeners
els.saveBtn.addEventListener('click', async () => {
  await saveSettings();
  els.saveBtn.textContent = '已保存 ✅';
  setTimeout(() => els.saveBtn.textContent = '保存配置', 2000);
});

els.resetBtn.addEventListener('click', async () => {
  els.aiProvider.value = DEFAULT_SETTINGS.aiProvider;
  els.apiKey.value = '';
  els.apiBaseUrl.value = DEFAULT_SETTINGS.apiBaseUrl;
  els.aiModel.value = DEFAULT_SETTINGS.aiModel;
  els.source_binance.checked = true;
  els.source_coingecko.checked = true;
  els.source_bybit.checked = false;
  els.source_alpaca.checked = false;
  els.sentiment_coingecko.checked = true;
  els.sentiment_twitter.checked = false;
  els.sentiment_news.checked = false;
  els.profile.value = DEFAULT_SETTINGS.profile;
  els.cooldown.value = DEFAULT_SETTINGS.cooldown;
  els.enableBlock.checked = DEFAULT_SETTINGS.enableBlock;
  els.autoAnalyze.checked = DEFAULT_SETTINGS.autoAnalyze;
  await saveSettings();
});

els.testConnection.addEventListener('click', testConnection);
els.refreshLogBtn.addEventListener('click', refreshLogs);

// Init
(async () => {
  await loadSettings();
  await refreshLogs();
})();
