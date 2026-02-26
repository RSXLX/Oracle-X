/**
 * Oracle-X Desktop Renderer
 */

const els = {
  monitorMode: document.getElementById('monitorMode'),
  app_binance: document.getElementById('app_binance'),
  app_okx: document.getElementById('app_okx'),
  app_bybit: document.getElementById('app_bybit'),
  app_coinbase: document.getElementById('app_coinbase'),
  app_tradingview: document.getElementById('app_tradingview'),
  app_metatrader: document.getElementById('app_metatrader'),
  
  aiProvider: document.getElementById('aiProvider'),
  apiKey: document.getElementById('apiKey'),
  apiBaseUrl: document.getElementById('apiBaseUrl'),
  
  profile: document.getElementById('profile'),
  cooldown: document.getElementById('cooldown'),
  enableBlock: document.getElementById('enableBlock'),
  autoAnalyze: document.getElementById('autoAnalyze'),
  
  minimizeToTray: document.getElementById('minimizeToTray'),
  autoStart: document.getElementById('autoStart'),
  notifications: document.getElementById('notifications'),
  
  backendUrl: document.getElementById('backendUrl'),
  testConnection: document.getElementById('testConnection'),
  connectionStatus: document.getElementById('connectionStatus'),
  
  saveBtn: document.getElementById('saveBtn'),
  resetBtn: document.getElementById('resetBtn'),
  
  monitorStatus: document.getElementById('monitorStatus'),
  todayBlock: document.getElementById('todayBlock'),
  mitigationRate: document.getElementById('mitigationRate'),
  
  refreshLogBtn: document.getElementById('refreshLogBtn'),
  logTbody: document.getElementById('logTbody'),
};

const DEFAULT_SETTINGS = {
  monitorMode: 'screenshot',
  targetApps: ['Binance', 'OKX', 'Bybit'],
  aiProvider: 'minimax',
  apiKey: '',
  apiBaseUrl: 'https://fucaixie.xyz/V1',
  profile: 'balanced',
  cooldown: 5,
  enableBlock: true,
  autoAnalyze: true,
  minimizeToTray: true,
  autoStart: false,
  notifications: true,
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
    
    els.minimizeToTray.checked = s.minimizeToTray !== false;
    els.autoStart.checked = s.autoStart === true;
    els.notifications.checked = s.notifications !== false;
    
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
    minimizeToTray: els.minimizeToTray.checked,
    autoStart: els.autoStart.checked,
    notifications: els.notifications.checked,
    backendUrl: els.backendUrl.value,
  };
  
  await window.oracleDesktop.saveSettings(settings);
}

function updateMonitorStatus() {
  const modeNames = { 'accessibility': '应用监听', 'screenshot': '截图分析', 'global_key': '快捷键' };
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
  els.aiProvider.value = DEFAULT_SETTINGS.aiProvider;
  els.apiKey.value = '';
  els.apiBaseUrl.value = DEFAULT_SETTINGS.apiBaseUrl;
  els.profile.value = DEFAULT_SETTINGS.profile;
  els.cooldown.value = DEFAULT_SETTINGS.cooldown;
  els.enableBlock.checked = DEFAULT_SETTINGS.enableBlock;
  els.autoAnalyze.checked = DEFAULT_SETTINGS.autoAnalyze;
  els.minimizeToTray.checked = DEFAULT_SETTINGS.minimizeToTray;
  els.autoStart.checked = DEFAULT_SETTINGS.autoStart;
  els.notifications.checked = DEFAULT_SETTINGS.notifications;
  await saveSettings();
});

els.testConnection.addEventListener('click', testConnection);
els.refreshLogBtn.addEventListener('click', refreshLogs);
els.monitorMode.addEventListener('change', updateMonitorStatus);

// Init
(async () => {
  await loadSettings();
  await refreshLogs();
})();
