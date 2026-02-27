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

    statusEl.innerHTML = `<span class="success">✅ 已导入 ${result.count} 笔交易 (${result.format})</span>`;
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

// ==================== 初始化 ====================
(async () => {
  await loadSettings();
  await loadWallets();
  await refreshLogs();
})();
