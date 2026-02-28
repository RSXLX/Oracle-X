/**
 * Oracle-X Desktop Renderer - Enhanced with AI Analysis
 */

// 当前数据状态
let currentTransactions = null;
let currentWalletIndex = -1;

// ==================== Tab 切换 ====================
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
  });
});

// ==================== 设置 ====================
async function loadSettings() {
  try {
    const settings = await window.oracleDesktop.getSettings();
    if (settings) {
      document.getElementById('cooldown').value = settings.cooldown || 5;
      document.getElementById('enableBlock').checked = settings.enableBlock ?? true;
      document.getElementById('autoStart').checked = settings.autoStart ?? false;
    }
  } catch (err) {
    console.error('Load settings error:', err);
  }
}

async function saveSettings() {
  try {
    await window.oracleDesktop.saveSettings({
      cooldown: parseInt(document.getElementById('cooldown').value) || 5,
      enableBlock: document.getElementById('enableBlock').checked,
      autoStart: document.getElementById('autoStart').checked,
    });
    showStatus('saveBtn', '已保存', 'success');
  } catch (err) {
    showStatus('saveBtn', '保存失败', 'error');
  }
}

document.getElementById('saveBtn')?.addEventListener('click', saveSettings);

// ==================== 状态提示 ====================
function showStatus(nearElementId, text, type = 'success') {
  const el = document.getElementById(nearElementId);
  if (!el) return;
  const span = document.createElement('span');
  span.className = `status ${type}`;
  span.textContent = text;
  el.parentElement.appendChild(span);
  setTimeout(() => span.remove(), 3000);
}

// ==================== 钱包管理 ====================
const walletState = {
  wallets: [],
};

async function loadWallets() {
  try {
    const res = await window.oracleDesktop.getWallets();
    walletState.wallets = res || [];
    renderWalletList();
  } catch (err) {
    console.error('Load wallets error:', err);
  }
}

function renderWalletList() {
  const list = document.getElementById('walletList');
  if (!walletState.wallets.length) {
    list.innerHTML = '<p class="muted">暂无钱包</p>';
    return;
  }

  list.innerHTML = walletState.wallets.map((w, i) => `
    <div class="wallet-item">
      <div class="wallet-info">
        <strong>${w.label}</strong>
        <span>${w.address.slice(0, 6)}...${w.address.slice(-4)}</span>
        <span class="badge">${w.chain}</span>
        ${w.balance ? `<span class="badge badge-allow">${w.balance.balance?.toFixed(4)} ${w.balance.symbol}</span>` : ''}
      </div>
      <div class="wallet-actions">
        <button class="btn btn-secondary" onclick="selectWallet(${i})">📊 查看</button>
        <button class="btn btn-accent" onclick="aiAnalyzeWalletAction(${i})">🤖 AI</button>
        <button class="btn btn-secondary" onclick="removeWalletAction(${i})">🗑️</button>
      </div>
    </div>
  `).join('');
}

async function addWallet() {
  const address = document.getElementById('walletAddress').value.trim();
  const chain = document.getElementById('walletChain').value;
  const label = document.getElementById('walletLabel').value || `Wallet ${walletState.wallets.length + 1}`;

  if (!address) {
    alert('请输入钱包地址');
    return;
  }

  try {
    await window.oracleDesktop.addWallet(address, chain, label);
    document.getElementById('walletAddress').value = '';
    document.getElementById('walletLabel').value = '';
    await loadWallets();
  } catch (err) {
    alert('添加失败: ' + err.message);
  }
}

async function removeWalletAction(index) {
  const wallet = walletState.wallets[index];
  if (!wallet) return;
  if (!confirm(`确认删除钱包 "${wallet.label}"？`)) return;

  try {
    await window.oracleDesktop.removeWallet(wallet.address);
    await loadWallets();
  } catch (err) {
    alert('删除失败: ' + err.message);
  }
}

async function selectWallet(index) {
  const wallet = walletState.wallets[index];
  if (!wallet) return;
  currentWalletIndex = index;

  const analysisEl = document.getElementById('walletAnalysis');
  analysisEl.innerHTML = '<div class="loading">加载中</div>';

  try {
    const [analysis, txs] = await Promise.all([
      window.oracleDesktop.analyzeWallet(wallet.address, wallet.chain),
      window.oracleDesktop.getWalletTransactions(wallet.address, wallet.chain),
    ]);

    renderWalletAnalysis(analysis, wallet);
    renderWalletTransactions(txs);
    await loadWallets(); // 刷新余额
  } catch (err) {
    analysisEl.innerHTML = '<p class="error">加载失败: ' + err.message + '</p>';
  }
}

async function aiAnalyzeWalletAction(index) {
  const wallet = walletState.wallets[index];
  if (!wallet) return;

  const aiEl = document.getElementById('walletAIAnalysis');
  aiEl.innerHTML = '<div class="loading">AI 分析中，请稍候</div>';

  try {
    const result = await window.oracleDesktop.aiAnalyzeWallet(wallet.address, wallet.chain);
    renderWalletAIAnalysis(result);
  } catch (err) {
    aiEl.innerHTML = '<p class="error">AI 分析失败: ' + err.message + '</p>';
  }
}

function renderWalletAnalysis(data, wallet = {}) {
  const el = document.getElementById('walletAnalysis');
  if (!data || data.error) {
    el.innerHTML = '<p class="muted">无法获取分析</p>';
    return;
  }

  const s = data.stats || {};
  el.innerHTML = `
    <div class="stats-grid">
      <div class="stat"><span class="stat-label">交易次数</span><span class="stat-value">${s.total || 0}</span></div>
      <div class="stat"><span class="stat-label">交易风格</span><span class="stat-value">${data.style || '?'}</span></div>
      <div class="stat"><span class="stat-label">风险等级</span><span class="stat-value">${data.riskLevel || 'low'}</span></div>
      <div class="stat"><span class="stat-label">日均交易</span><span class="stat-value">${(s.tradingFrequency || 0).toFixed(1)}</span></div>
      <div class="stat"><span class="stat-label">总收入</span><span class="stat-value">${(s.totalReceived || 0).toFixed(4)}</span></div>
      <div class="stat"><span class="stat-label">总支出</span><span class="stat-value">${(s.totalSent || 0).toFixed(4)}</span></div>
    </div>
    ${data.topMethods?.length ? `
      <h3 style="margin-top:12px;">常用合约方法</h3>
      <div style="display:flex;flex-wrap:wrap;gap:4px;">
        ${data.topMethods.map(m => `<span class="ai-pattern">${m.method} (${m.count})</span>`).join('')}
      </div>
    ` : ''}
  `;
}

function renderWalletAIAnalysis(data) {
  const el = document.getElementById('walletAIAnalysis');
  if (!data || data.error) {
    el.innerHTML = `<p class="error">${data?.error || 'AI 分析失败'}</p>`;
    return;
  }

  let html = '<div class="ai-result">';

  if (data.summary) {
    html += `<div class="ai-section"><h4>📝 总结</h4><div class="ai-summary">${data.summary}</div></div>`;
  }
  if (data.walletType) {
    html += `<div class="ai-section"><h4>🏷️ 钱包类型</h4><span class="badge badge-allow">${data.walletType}</span> · 活跃度: ${data.activityLevel || '?'}</div>`;
  }
  if (data.mainActivities?.length) {
    html += `<div class="ai-section"><h4>🎯 主要活动</h4>${data.mainActivities.map(a => `<div class="ai-suggestion">${a}</div>`).join('')}</div>`;
  }
  if (data.riskIndicators?.length) {
    html += `<div class="ai-section"><h4>⚠️ 风险指标</h4>${data.riskIndicators.map(r => `<div class="insight-warning">${r}</div>`).join('')}</div>`;
  }
  if (data.suggestions?.length) {
    html += `<div class="ai-section"><h4>💡 建议</h4>${data.suggestions.map(s => `<div class="ai-suggestion">${s}</div>`).join('')}</div>`;
  }

  html += '</div>';
  el.innerHTML = html;
}

function renderWalletTransactions(txs) {
  const tbody = document.getElementById('txTbody');
  if (!txs?.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="muted">暂无记录</td></tr>';
    return;
  }

  tbody.innerHTML = txs.slice(0, 30).map(tx => `
    <tr>
      <td>${tx.timestamp ? new Date(tx.timestamp).toLocaleString() : '-'}</td>
      <td><span class="badge badge-${tx.isIncoming ? 'allow' : 'block'}">${tx.isIncoming ? '收入' : '支出'}</span></td>
      <td>${tx.value?.toFixed(4)} ${tx.symbol}</td>
      <td>${(tx.gas || 0).toFixed(6)}</td>
      <td>${tx.method || '-'}</td>
    </tr>
  `).join('');
}

document.getElementById('addWalletBtn')?.addEventListener('click', addWallet);
document.getElementById('refreshWalletBtn')?.addEventListener('click', () => {
  if (currentWalletIndex >= 0) selectWallet(currentWalletIndex);
  else if (walletState.wallets.length > 0) selectWallet(0);
});
document.getElementById('saveWalletsBtn')?.addEventListener('click', async () => {
  try {
    await window.oracleDesktop.saveWalletData();
    showStatus('saveWalletsBtn', '已保存', 'success');
  } catch (err) {
    showStatus('saveWalletsBtn', '保存失败', 'error');
  }
});

// ==================== 文件导入（CSV / XLSX）====================
async function importFile() {
  const statusEl = document.getElementById('csvStatus');
  statusEl.innerHTML = '<div class="loading">导入中</div>';

  try {
    const result = await window.oracleDesktop.importFile();

    if (result.error) {
      statusEl.innerHTML = `<span class="error">${result.error}</span>`;
      return;
    }

    statusEl.innerHTML = `<span class="success">✅ 已导入 ${result.count} 笔交易 (${result.format}) · 已保存到数据库</span>`;
    currentTransactions = result.transactions;

    // 启用 AI 分析按钮
    const aiBtn = document.getElementById('aiAnalyzeBtn');
    if (aiBtn) aiBtn.disabled = false;

    // 显示分析
    if (result.analysis && !result.analysis.error) {
      renderCSVAnalysis(result.analysis);
    }

    // 显示交易明细
    renderCSVTransactions(result.transactions);
  } catch (err) {
    statusEl.innerHTML = `<span class="error">${err.message}</span>`;
  }

  // 刷新历史导入列表
  await loadImportHistory();
}

function renderCSVAnalysis(a) {
  const stats = a.stats || {};
  const el = document.getElementById('csvAnalysis');

  el.innerHTML = `
    <div class="stats-grid">
      <div class="stat"><span class="stat-label">交易次数</span><span class="stat-value">${stats.totalTrades || 0}</span></div>
      <div class="stat"><span class="stat-label">交易风格</span><span class="stat-value">${a.style || '?'}</span></div>
      <div class="stat"><span class="stat-label">风险等级</span><span class="stat-value">${a.riskLevel || 'low'}</span></div>
      <div class="stat"><span class="stat-label">交易币种</span><span class="stat-value">${stats.uniqueSymbols || 0}</span></div>
      <div class="stat"><span class="stat-label">总交易额</span><span class="stat-value">${(stats.totalVolume || 0).toFixed(0)}</span></div>
      <div class="stat"><span class="stat-label">总手续费</span><span class="stat-value">${(stats.totalFees || 0).toFixed(2)}</span></div>
    </div>
    ${a.topSymbols?.length ? `
      <h3 style="margin-top:12px;">Top 交易品种</h3>
      <div style="display:flex;flex-wrap:wrap;gap:4px;">
        ${a.topSymbols.slice(0, 5).map(s => `<span class="ai-pattern">${s.symbol} (${s.trades}笔)</span>`).join('')}
      </div>
    ` : ''}
    ${a.insights?.length ? `
      <div class="insights" style="margin-top:12px;">
        ${a.insights.map(i => `<div class="insight-${i.type}">${i.text}</div>`).join('')}
      </div>
    ` : ''}
  `;

  window.currentAnalysis = a;
}

function renderCSVTransactions(txs) {
  const tbody = document.getElementById('csvTbody');
  if (!txs?.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="muted">暂无数据</td></tr>';
    return;
  }

  tbody.innerHTML = txs.slice(0, 50).map(tx => `
    <tr>
      <td>${tx.timestamp ? new Date(tx.timestamp).toLocaleString() : tx.rawTime || '-'}</td>
      <td>${tx.symbol || '-'}</td>
      <td><span class="badge badge-${tx.isBuy ? 'allow' : 'block'}">${tx.isBuy ? '买入' : '卖出'}</span></td>
      <td>${tx.price?.toFixed(2) || '-'}</td>
      <td>${tx.qty?.toFixed(4) || '-'}</td>
      <td>${tx.total?.toFixed(2) || '-'}</td>
    </tr>
  `).join('');
}

document.getElementById('importFileBtn')?.addEventListener('click', importFile);

// ==================== AI 分析买卖点 ====================
async function aiAnalyzeTrades() {
  if (!currentTransactions?.length) {
    alert('请先导入交易记录');
    return;
  }

  const card = document.getElementById('aiAnalysisCard');
  const resultEl = document.getElementById('aiAnalysisResult');
  card.style.display = 'block';
  resultEl.innerHTML = '<div class="loading">AI 正在分析买卖点，请稍候</div>';

  // 禁用按钮
  const btn = document.getElementById('aiAnalyzeBtn');
  if (btn) btn.disabled = true;

  try {
    const result = await window.oracleDesktop.aiAnalyzeTrades(currentTransactions);
    renderAIAnalysis(result);
  } catch (err) {
    resultEl.innerHTML = `<p class="error">AI 分析失败: ${err.message}</p>`;
  } finally {
    if (btn) btn.disabled = false;
  }
}

function renderAIAnalysis(data) {
  const el = document.getElementById('aiAnalysisResult');

  if (!data || data.error) {
    el.innerHTML = `<p class="error">${data?.error || 'AI 分析失败'}</p>`;
    return;
  }

  let html = '<div class="ai-result">';

  // 总结
  if (data.summary) {
    html += `<div class="ai-section"><h4>📝 分析总结</h4><div class="ai-summary">${data.summary}</div></div>`;
  }

  // 买入点
  if (data.buyPoints?.length) {
    html += '<div class="ai-section"><h4>🟢 买入点分析</h4>';
    data.buyPoints.forEach(p => {
      html += `<div class="ai-point buy">
        <div class="point-time">${p.time || ''} · ${p.symbol || ''} · ¥${p.price || ''}</div>
        <div class="point-detail">${p.analysis || ''}</div>
      </div>`;
    });
    html += '</div>';
  }

  // 卖出点
  if (data.sellPoints?.length) {
    html += '<div class="ai-section"><h4>🔴 卖出点分析</h4>';
    data.sellPoints.forEach(p => {
      html += `<div class="ai-point sell">
        <div class="point-time">${p.time || ''} · ${p.symbol || ''} · ¥${p.price || ''}</div>
        <div class="point-detail">${p.analysis || ''}</div>
      </div>`;
    });
    html += '</div>';
  }

  // 交易模式
  if (data.tradingPatterns?.length) {
    html += `<div class="ai-section"><h4>🔍 识别的交易模式</h4><div>${data.tradingPatterns.map(p => `<span class="ai-pattern">${p}</span>`).join('')}</div></div>`;
  }

  // 风险评估
  if (data.riskAssessment) {
    html += `<div class="ai-section"><h4>⚠️ 风险评估</h4><div class="insight-warning">${data.riskAssessment}</div></div>`;
  }

  // 建议
  if (data.suggestions?.length) {
    html += `<div class="ai-section"><h4>💡 改进建议</h4>${data.suggestions.map(s => `<div class="ai-suggestion">${s}</div>`).join('')}</div>`;
  }

  // 原始内容（降级情况）
  if (data.rawContent) {
    html += `<div class="ai-section"><h4>📄 原始分析</h4><pre style="white-space:pre-wrap;color:#8b949e;font-size:12px;">${data.rawContent.slice(0, 1000)}</pre></div>`;
  }

  html += '</div>';
  el.innerHTML = html;
}

document.getElementById('aiAnalyzeBtn')?.addEventListener('click', aiAnalyzeTrades);

// ==================== 导出报告 ====================
async function exportReport() {
  const analysis = window.currentAnalysis;
  if (!analysis) {
    alert('没有可导出的分析数据');
    return;
  }

  const report = generateReport(analysis);
  const blob = new Blob([report], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'oraclex-report.md';
  a.click();
  URL.revokeObjectURL(url);
}

function generateReport(analysis) {
  const stats = analysis.stats || {};
  return `# Oracle-X 交易分析报告

生成: ${new Date().toLocaleString()}

风格: ${analysis.style} | 风险: ${analysis.riskLevel}

交易: ${stats.totalTrades}笔 | 金额: ${stats.totalVolume?.toFixed(2)}USDT | 币种: ${stats.uniqueSymbols}

${analysis.topSymbols?.length ? '## Top 交易品种\n' + analysis.topSymbols.map(s => `- ${s.symbol}: ${s.trades}笔, ${s.volume?.toFixed(2)} USDT`).join('\n') : ''}

${analysis.insights?.length ? '## 洞察\n' + analysis.insights.map(i => `- [${i.type}] ${i.text}`).join('\n') : ''}
`;
}

document.getElementById('exportReportBtn')?.addEventListener('click', exportReport);

// ==================== 决策日志（占位）====================
async function refreshLogs() {
  // 占位 - 决策日志功能
}

// ==================== 历史导入 ====================
async function loadImportHistory() {
  try {
    const history = await window.oracleDesktop.getImportHistory();
    const select = document.getElementById('importHistorySelect');
    if (!select) return;

    select.innerHTML = '<option value="">-- 选择历史批次 --</option>';
    for (const batch of history) {
      const time = batch.imported_at ? new Date(batch.imported_at).toLocaleString() : '未知';
      const option = document.createElement('option');
      option.value = batch.import_batch;
      option.textContent = `${batch.exchange || '未知'} · ${batch.count} 笔 · ${time}`;
      select.appendChild(option);
    }
  } catch (err) {
    console.error('Load import history error:', err);
  }
}

async function loadHistoryBatch() {
  const select = document.getElementById('importHistorySelect');
  const batchId = select?.value;
  if (!batchId) { alert('请选择一个批次'); return; }

  const infoEl = document.getElementById('importHistoryInfo');
  infoEl.innerHTML = '<div class="loading">加载中</div>';

  try {
    const txs = await window.oracleDesktop.getTransactionsByBatch(batchId);
    currentTransactions = txs;
    infoEl.innerHTML = `<span class="success">✅ 已加载 ${txs.length} 笔历史记录</span>`;

    // 启用 AI 分析按钮
    const aiBtn = document.getElementById('aiAnalyzeBtn');
    if (aiBtn) aiBtn.disabled = false;

    renderCSVTransactions(txs);
  } catch (err) {
    infoEl.innerHTML = `<span class="error">加载失败: ${err.message}</span>`;
  }
}

document.getElementById('loadHistoryBtn')?.addEventListener('click', loadHistoryBatch);

// ==================== 截图分析核心逻辑 ====================
let analysisCount = 0;
let riskCount = 0;

// ==================== 堆叠通知系统 ====================
function pushNotification(title, body, type = 'info', duration = 5000) {
  const stack = document.getElementById('notificationStack');
  const item = document.createElement('div');
  item.className = `notification-item notif-${type}`;
  const time = new Date().toLocaleTimeString();
  item.innerHTML = `
    <span class="notif-time">${time}</span>
    <div class="notif-title">${title}</div>
    <div class="notif-body">${body}</div>`;
  item.addEventListener('click', () => {
    item.classList.add('fade-out');
    setTimeout(() => item.remove(), 300);
  });
  stack.appendChild(item);
  while (stack.children.length > 5) stack.firstChild.remove();
  setTimeout(() => {
    if (item.parentNode) {
      item.classList.add('fade-out');
      setTimeout(() => item.remove(), 300);
    }
  }, duration);
}

// ==================== 侧边栏面板 ====================
function openSidePanel() {
  document.getElementById('sidePanelOverlay').classList.add('open');
  document.getElementById('sidePanel').classList.add('open');
}
function closeSidePanel() {
  document.getElementById('sidePanelOverlay').classList.remove('open');
  document.getElementById('sidePanel').classList.remove('open');
}
document.getElementById('sidePanelOverlay')?.addEventListener('click', closeSidePanel);
document.getElementById('sidePanelClose')?.addEventListener('click', closeSidePanel);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSidePanel(); });

function showSidePanelLoading() {
  document.getElementById('sidePanelTitle').textContent = '🔍 AI 正在分析...';
  document.getElementById('sidePanelBody').innerHTML = `
    <div style="text-align:center;padding:40px 0;">
      <div class="loading">截图已捕获，AI 正在识别交易界面...</div>
      <p style="color:#6e7681;font-size:12px;margin-top:16px;">分析通常需要 3-5 秒</p>
    </div>`;
  document.getElementById('sidePanelActions').style.display = 'none';
  openSidePanel();
}

function renderSidePanelResult(result) {
  const action = result?.action || 'allow';
  const risk = result?.riskLevel || 'low';
  const platform = result?.platform || '未识别';
  const buttons = result?.buttons || [];
  const hasTrade = result?.hasTradingButtons || false;
  const summary = result?.summary || '';

  const rc = {
    high: { bg: '#3a1a1a', border: '#dc2626', text: '#f87171', emoji: '🔴', label: '高风险' },
    medium: { bg: '#3a2a1a', border: '#d97706', text: '#fbbf24', emoji: '🟡', label: '中风险' },
    low: { bg: '#1a3a2a', border: '#16a34a', text: '#4ade80', emoji: '🟢', label: '低风险' },
  }[risk] || { bg: '#1a3a2a', border: '#16a34a', text: '#4ade80', emoji: '🟢', label: '低风险' };

  document.getElementById('sidePanelTitle').textContent = `${rc.emoji} 分析结果 — ${rc.label}`;
  document.getElementById('sidePanelBody').innerHTML = `
    <div class="analysis-detail-card" style="border:1px solid ${rc.border};background:${rc.bg};">
      <div class="detail-grid">
        <div class="detail-item"><span class="detail-label">平台识别</span><span class="detail-value">${platform}</span></div>
        <div class="detail-item"><span class="detail-label">风险等级</span><span class="detail-value" style="color:${rc.text};">${rc.emoji} ${rc.label}</span></div>
        <div class="detail-item"><span class="detail-label">交易按钮</span><span class="detail-value">${hasTrade ? '✅ 已检测到' : '❌ 未检测到'}</span></div>
        <div class="detail-item"><span class="detail-label">建议操作</span><span class="detail-value" style="color:${rc.text};">${action === 'block' ? '🛑 建议阻止' : action === 'warn' ? '⚠️ 需注意' : '✅ 可放行'}</span></div>
      </div>
      ${buttons.length ? `<div style="margin-bottom:12px;"><span class="detail-label">检测到的交易按钮</span><div class="analysis-buttons-list" style="margin-top:6px;">${buttons.map(b => `<span class="analysis-button-tag">${b}</span>`).join('')}</div></div>` : ''}
    </div>
    ${summary ? `<div class="card" style="margin:0;"><h2 style="font-size:14px;">💡 AI 建议</h2><p style="color:#8b949e;font-size:13px;line-height:1.6;">${summary}</p></div>` : ''}
    <div class="card" style="margin-top:12px;">
      <h2 style="font-size:14px;">📋 分析详情</h2>
      <div style="font-size:12px;color:#6e7681;">
        <div style="margin-bottom:4px;">时间：${new Date().toLocaleString()}</div>
        <div style="margin-bottom:4px;">分析引擎：MiniMax-M2.5-highspeed</div>
        <div>截图已自动删除（隐私保护）</div>
      </div>
    </div>`;
  document.getElementById('sidePanelActions').style.display = (action === 'block' || action === 'warn') ? 'flex' : 'none';
  openSidePanel();
}

// 侧边栏操作按钮
document.getElementById('sidePanelBlock')?.addEventListener('click', () => {
  pushNotification('🛑 交易已取消', '您选择了取消本次交易操作', 'warning');
  closeSidePanel();
});
document.getElementById('sidePanelAllow')?.addEventListener('click', () => {
  pushNotification('✅ 交易已放行', '请注意风险管理', 'success');
  closeSidePanel();
});

// ==================== 截图按钮 ====================
document.getElementById('screenshotBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('screenshotBtn');
  btn.disabled = true;
  btn.textContent = '⏳ 截图中...';
  showSidePanelLoading();
  pushNotification('📸 截图中', '正在截取屏幕...', 'info', 3000);

  try {
    const result = await window.oracleDesktop.takeScreenshot();
    if (!result) {
      closeSidePanel();
      pushNotification('❌ 截图失败', '请检查屏幕录制权限', 'error');
    }
  } catch (err) {
    closeSidePanel();
    pushNotification('❌ 错误', err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '📸 立即截图分析';
  }
});

// 快捷键截图也打开侧边栏
if (window.oracleDesktop.onScreenshotCaptured) {
  window.oracleDesktop.onScreenshotCaptured(() => {
    showSidePanelLoading();
    pushNotification('📸 截图成功', 'AI 正在分析中...', 'info', 4000);
  });
}

// 分析结果 → 侧边栏 + 通知 + 记录
if (window.oracleDesktop.onScreenshotResult) {
  window.oracleDesktop.onScreenshotResult((result) => {
    renderSidePanelResult(result);
    addAnalysisLog(result);
    updateStats(result);
    const risk = result?.riskLevel || 'low';
    const label = risk === 'high' ? '高风险' : risk === 'medium' ? '中风险' : '低风险';
    const emoji = risk === 'high' ? '🔴' : risk === 'medium' ? '🟡' : '🟢';
    const type = risk === 'high' ? 'error' : risk === 'medium' ? 'warning' : 'success';
    pushNotification(`${emoji} ${label} · ${result?.platform || '未识别'}`,
      result?.action === 'block' ? '建议取消本次交易' : '当前操作安全', type, 6000);
  });
}

// 分析错误
if (window.oracleDesktop.onScreenshotError) {
  window.oracleDesktop.onScreenshotError((data) => {
    closeSidePanel();
    pushNotification('❌ 分析失败', data?.error || '未知错误', 'error');
  });
}

// ==================== 分析记录 ====================
function addAnalysisLog(result) {
  const logEl = document.getElementById('screenshotLog');
  if (logEl.querySelector('.muted')) logEl.innerHTML = '';

  const risk = result?.riskLevel || 'low';
  const emoji = risk === 'high' ? '🔴' : risk === 'medium' ? '🟡' : '🟢';
  const label = risk === 'high' ? '高风险' : risk === 'medium' ? '中风险' : '低风险';
  const platform = result?.platform || '未识别';
  const time = new Date().toLocaleTimeString();
  const action = result?.action || 'allow';

  const entry = document.createElement('div');
  entry.style.cssText = 'padding:8px 12px;margin-bottom:6px;border-radius:6px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);font-size:13px;cursor:pointer;transition:background 0.2s;';
  entry.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <span>${emoji} <strong>${label}</strong> · ${platform}</span>
      <span style="color:#8b949e;font-size:11px;">${time}</span>
    </div>
    ${result?.buttons?.length ? `<div style="color:#8b949e;font-size:11px;margin-top:4px;">按钮: ${result.buttons.join(', ')}</div>` : ''}
    <div style="color:${action === 'block' ? '#f87171' : '#8b949e'};font-size:11px;margin-top:2px;">→ ${action === 'block' ? '已阻止' : action === 'warn' ? '已警告' : '已放行'}</div>`;
  entry.addEventListener('click', () => renderSidePanelResult(result));
  entry.addEventListener('mouseenter', () => entry.style.background = 'rgba(255,255,255,0.08)');
  entry.addEventListener('mouseleave', () => entry.style.background = 'rgba(255,255,255,0.04)');
  logEl.prepend(entry);
}

// ==================== 统计更新 ====================
function updateStats(result) {
  analysisCount++;
  const el1 = document.getElementById('todayAnalyses');
  if (el1) el1.textContent = analysisCount;
  if (result?.action === 'block' || result?.action === 'warn') {
    riskCount++;
    const el2 = document.getElementById('todayBlock');
    if (el2) el2.textContent = riskCount;
  }
  const rate = analysisCount > 0 ? Math.round((riskCount / analysisCount) * 100) : 0;
  const el3 = document.getElementById('mitigationRate');
  if (el3) el3.textContent = rate + '%';
}

// ==================== 初始化 ====================
(async () => {
  await loadSettings();
  await loadWallets();
  await refreshLogs();
  await loadImportHistory();
})();

