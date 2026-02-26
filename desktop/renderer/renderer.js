/**
 * Oracle-X Desktop Renderer - Global Monitor
 */

const els = {
  // Monitor
  monitorMode: document.getElementById('monitorMode'),
  app_binance: document.getElementById('app_binance'),
  app_okx: document.getElementById('app_okx'),
  app_bybit: document.getElementById('app_bybit'),
  app_coinbase: document.getElementById('app_coinbase'),
  app_tradingview: document.getElementById('app_tradingview'),
  app_metatrader: document.getElementById('app_metatrader'),
  app_custom: document.getElementById('app_custom'),
  customApp: document.getElementById('customApp'),
  
  // AI
  aiProvider: document.getElementById('aiProvider'),
  apiKey: document.getElementById('apiKey'),
  apiBaseUrl: document.getElementById('apiBaseUrl'),
  
  // Cooldown
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
  
  // Status
  monitorStatus: document.getElementById('monitorStatus'),
  todayBlock: document.getElementById('todayBlock'),
  mitigationRate: document.getElementById('mitigationRate'),
  
  // Logs
  refreshLogBtn: document.getElementById('refreshLogBtn'),
  logTbody: document.getElementById('logTbody'),
};

const DEFAULT_SETTINGS = {
  monitorMode: 'accessibility',
  targetApps: ['Binance', 'OKX', 'Bybit'],
  aiProvider: 'stepfun',
  apiKey: '',
  apiBaseUrl: 'https://api.stepfun.com/v1',
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
    
    els.monitorMode.value = s.monitorMode || DEFAULT_SETTINGS.monitorMode;
    els.app_binance.checked = s.targetApps?.includes('Binance');
    els.app_okx.checked = s.targetApps?.includes('OKX');
    els.app_bybit.checked = s.targetApps?.includes('Bybit');
    els.app_coinbase.checked = s.targetApps?.includes('Coinbase');
    els.app_tradingview.checked = s.targetApps?.includes('TradingView');
    els.app_metatrader.checked = s.targetApps?.includes('MetaTrader');
    
    els.aiProvider.value = s.aiProvider || DEFAULT_SETTINGS.aiProvider;
    els.apiKey.value = s.apiKey || '';
    els.apiBaseUrl.value = s.apiBaseUrl || DEFAULT_SETTINGS.apiBaseUrl;
    
    els.profile.value = s.profile || DEFAULT_SETTINGS.profile;
    els.cooldown.value = s.cooldown || DEFAULT_SETTINGS.cooldown;
    els.enableBlock.checked = s.enableBlock !== false;
    els.autoAnalyze.checked = s.autoAnalyze !== false;
    els.backendUrl.value = s.backendUrl || DEFAULT_SETTINGS.backendUrl;
    
    updateMonitorStatus();
  } catch (err) {
    console.error('Load settings error:', err);
  }
}

async function saveSettings() {
  const targetApps = [];
  if (els.app_binance.checked) targetApps.push('Binance');
  if (els.app_okx.checked) targetApps.push('OKX');
  if (els.app_bybit.checked) targetApps.push('Bybit');
  if (els.app_coinbase.checked) targetApps.push('Coinbase');
  if (els.app_tradingview.checked) targetApps.push('TradingView');
  if (els.app_metatrader.checked) targetApps.push('MetaTrader');
  if (els.customApp.value) targetApps.push(els.customApp.value);
  
  const settings = {
    monitorMode: els.monitorMode.value,
    targetApps,
    aiProvider: els.aiProvider.value,
    apiKey: els.apiKey.value,
    apiBaseUrl: els.apiBaseUrl.value,
    profile: els.profile.value,
    cooldown: parseInt(els.cooldown.value) || 5,
    enableBlock: els.enableBlock.checked,
    autoAnalyze: els.autoAnalyze.checked,
    backendUrl: els.backendUrl.value,
  };
  
  await window.oracleDesktop.saveSettings(settings);
}

function updateMonitorStatus() {
  const modeNames = {
    'accessibility': '应用监听',
    'screenshot': '屏幕截图',
    'global_key': '全局快捷键'
  };
  els.monitorStatus.textContent = modeNames[els.monitorMode.value] || '未知';
}

function renderLogs(items = []) {
  if (!items?.length) {
    els.logTbody.innerHTML = '<tr><td colspan="4" class="muted">暂无决策日志</td></tr>';
    return;
  }
  
  els.logTbody.innerHTML = items.slice(0, 50).map(row => `
    <tr>
      <td>${new Date(row.createdAt).toLocaleString()}</td>
      <td>${row.appName || '-'}</td>
      <td>${row.action || '-'}</td>
      <td><span class="badge badge-${(row.decision?.action || 'allow').toLowerCase()}">${row.decision?.action || '-'}</span></td>
    </tr>
  `).join('');
}

async function refreshLogs() {
  try {
    const res = await window.oracleDesktop.listDecisionLogs(50);
    const items = res.items || [];
    renderLogs(items);
    
    const today = new Date().toDateString();
    const todayItems = items.filter(i => new Date(i.createdAt).toDateString() === today);
    const blocks = todayItems.filter(i => i.decision?.action === 'BLOCK').length;
    const mitigation = items.length > 0 ? Math.round((items.length - blocks) / items.length * 100) : 0;
    
    els.todayBlock.textContent = blocks;
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
  els.monitorMode.value = DEFAULT_SETTINGS.monitorMode;
  els.app_binance.checked = true;
  els.app_okx.checked = true;
  els.app_bybit.checked = true;
  els.app_coinbase.checked = false;
  els.app_tradingview.checked = false;
  els.app_metatrader.checked = false;
  els.customApp.value = '';
  els.aiProvider.value = DEFAULT_SETTINGS.aiProvider;
  els.apiKey.value = '';
  els.apiBaseUrl.value = DEFAULT_SETTINGS.apiBaseUrl;
  els.profile.value = DEFAULT_SETTINGS.profile;
  els.cooldown.value = DEFAULT_SETTINGS.cooldown;
  els.enableBlock.checked = DEFAULT_SETTINGS.enableBlock;
  els.autoAnalyze.checked = DEFAULT_SETTINGS.autoAnalyze;
  await saveSettings();
});

els.testConnection.addEventListener('click', testConnection);
els.refreshLogBtn.addEventListener('click', refreshLogs);
els.monitorMode.addEventListener('change', updateMonitorStatus);

// Listen for app activation events from main process
if (window.oracleDesktop?.onAppActivated) {
  window.oracleDesktop.onAppActivated((appName) => {
    console.log('App activated:', appName);
    // 可以在这里显示实时通知
  });
}

// Init
(async () => {
  await loadSettings();
  await refreshLogs();
})();
