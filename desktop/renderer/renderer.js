const apiBaseUrlInput = document.getElementById('apiBaseUrl');
const profileInput = document.getElementById('profile');
const decisionLogLimitInput = document.getElementById('decisionLogLimit');
const enableNoFomoBlockInput = document.getElementById('enableNoFomoBlock');
const saveBtn = document.getElementById('saveBtn');
const saveStatus = document.getElementById('saveStatus');

const refreshStatusBtn = document.getElementById('refreshStatusBtn');
const configStatusEl = document.getElementById('configStatus');
const refreshLogBtn = document.getElementById('refreshLogBtn');
const logMetaEl = document.getElementById('logMeta');
const logTbody = document.getElementById('logTbody');

async function refreshConfigStatus() {
  try {
    configStatusEl.textContent = '加载中...';
    const status = await window.oracleDesktop.getConfigStatus();
    configStatusEl.textContent = JSON.stringify(status, null, 2);
  } catch (err) {
    configStatusEl.textContent = `加载失败: ${err?.message || err}`;
  }
}

function renderLogs(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    logTbody.innerHTML = '<tr><td colspan="6" class="muted">暂无决策日志</td></tr>';
    return;
  }

  logTbody.innerHTML = items
    .slice(0, 200)
    .map((row) => {
      return `<tr>
        <td>${new Date(row.createdAt).toLocaleString()}</td>
        <td>${row.symbol}</td>
        <td>${row.direction}</td>
        <td>${row.decision?.action || '-'}</td>
        <td>${row.decision?.impulseScore ?? '-'}</td>
        <td>${row.marketData?.change24h ?? '-'}</td>
      </tr>`;
    })
    .join('');
}

async function refreshLogs() {
  try {
    logMetaEl.textContent = '日志加载中...';
    const limit = Number(decisionLogLimitInput.value || '50');
    const res = await window.oracleDesktop.listDecisionLogs(limit);
    renderLogs(res.items || []);
    logMetaEl.textContent = `共 ${res.count || 0} 条（limit=${limit}）`;
  } catch (err) {
    logMetaEl.textContent = `日志加载失败: ${err?.message || err}`;
  }
}

async function init() {
  const settings = await window.oracleDesktop.getSettings();
  apiBaseUrlInput.value = settings.apiBaseUrl || 'http://localhost:3000';
  profileInput.value = settings.profile || 'balanced';
  enableNoFomoBlockInput.checked = Boolean(settings.enableNoFomoBlock);
  decisionLogLimitInput.value = String(settings.decisionLogLimit || 50);

  await refreshConfigStatus();
  await refreshLogs();
}

saveBtn.addEventListener('click', async () => {
  await window.oracleDesktop.saveSettings({
    apiBaseUrl: apiBaseUrlInput.value.trim(),
    profile: profileInput.value,
    enableNoFomoBlock: enableNoFomoBlockInput.checked,
    decisionLogLimit: Number(decisionLogLimitInput.value || '50'),
  });
  saveStatus.textContent = `已保存（${new Date().toLocaleTimeString()}）`;
  await refreshConfigStatus();
  await refreshLogs();
});

refreshStatusBtn.addEventListener('click', async () => {
  await refreshConfigStatus();
});

refreshLogBtn.addEventListener('click', async () => {
  await refreshLogs();
});

init();
