/**
 * Oracle-X Desktop Renderer
 */

// Elements
const els = {
  // AI Config
  aiProvider: document.getElementById('aiProvider'),
  apiKey: document.getElementById('apiKey'),
  apiBaseUrl: document.getElementById('apiBaseUrl'),
  aiModel: document.getElementById('aiModel'),
  // Intercept Settings
  profile: document.getElementById('profile'),
  decisionLogLimit: document.getElementById('decisionLogLimit'),
  enableNoFomoBlock: document.getElementById('enableNoFomoBlock'),
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
  profile: 'balanced',
  decisionLogLimit: 50,
  enableNoFomoBlock: true,
  autoAnalyze: true,
  backendUrl: 'http://localhost:3000',
};

async function loadSettings() {
  try {
    const settings = await window.oracleDesktop.getSettings();
    els.aiProvider.value = settings.aiProvider || DEFAULT_SETTINGS.aiProvider;
    els.apiKey.value = settings.apiKey || '';
    els.apiBaseUrl.value = settings.apiBaseUrl || DEFAULT_SETTINGS.apiBaseUrl;
    els.aiModel.value = settings.aiModel || DEFAULT_SETTINGS.aiModel;
    els.profile.value = settings.profile || DEFAULT_SETTINGS.profile;
    els.decisionLogLimit.value = settings.decisionLogLimit || DEFAULT_SETTINGS.decisionLogLimit;
    els.enableNoFomoBlock.checked = settings.enableNoFomoBlock !== false;
    els.autoAnalyze.checked = settings.autoAnalyze !== false;
    els.backendUrl.value = settings.backendUrl || DEFAULT_SETTINGS.backendUrl;
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

async function saveSettings() {
  const settings = {
    aiProvider: els.aiProvider.value,
    apiKey: els.apiKey.value,
    apiBaseUrl: els.apiBaseUrl.value,
    aiModel: els.aiModel.value,
    profile: els.profile.value,
    decisionLogLimit: Number(els.decisionLogLimit.value),
    enableNoFomoBlock: els.enableNoFomoBlock.checked,
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
    const limit = Number(els.decisionLogLimit.value) || 50;
    const res = await window.oracleDesktop.listDecisionLogs(limit);
    renderLogs(res.items || []);
    // Update stats
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
    console.error('Failed to load logs:', err);
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
  Object.assign(DEFAULT_SETTINGS, { backendUrl: els.backendUrl.value });
  els.aiProvider.value = DEFAULT_SETTINGS.aiProvider;
  els.apiKey.value = '';
  els.apiBaseUrl.value = DEFAULT_SETTINGS.apiBaseUrl;
  els.aiModel.value = DEFAULT_SETTINGS.aiModel;
  els.profile.value = DEFAULT_SETTINGS.profile;
  els.decisionLogLimit.value = DEFAULT_SETTINGS.decisionLogLimit;
  els.enableNoFomoBlock.checked = DEFAULT_SETTINGS.enableNoFomoBlock;
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
