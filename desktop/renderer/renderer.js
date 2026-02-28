/**
 * Oracle-X Desktop Renderer - Enhanced with AI Analysis
 */

// i18n shorthand
const t = I18n.t.bind(I18n);

// 当前数据状态
let currentTransactions = null;
let currentWalletIndex = -1;

// ==================== 通用分页器 ====================
const paginationState = {};

function renderPagination(containerId, totalItems, perPage, currentPage, onPageChange) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const totalPages = Math.ceil(totalItems / perPage);
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  const start = (currentPage - 1) * perPage + 1;
  const end = Math.min(currentPage * perPage, totalItems);

  let buttonsHtml = '';

  // Prev button
  buttonsHtml += `<button ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">‹</button>`;

  // Page numbers with ellipsis
  const pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push('...');
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pages.push(i);
    }
    if (currentPage < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  pages.forEach(p => {
    if (p === '...') {
      buttonsHtml += '<span class="pagination-ellipsis">…</span>';
    } else {
      buttonsHtml += `<button class="${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`;
    }
  });

  // Next button
  buttonsHtml += `<button ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">›</button>`;

  container.innerHTML = `
    <span class="pagination-info">${start}-${end} / ${totalItems}</span>
    <div class="pagination-buttons">${buttonsHtml}</div>
  `;

  container.querySelectorAll('.pagination-buttons button').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = parseInt(btn.dataset.page);
      if (!isNaN(page) && page >= 1 && page <= totalPages) {
        onPageChange(page);
      }
    });
  });
}

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
      // AI 配置
      document.getElementById('aiBaseUrl').value = settings.apiBaseUrl || '';
      document.getElementById('aiApiKey').value = settings.apiKey || '';
      document.getElementById('aiModel').value = settings.aiModel || '';
      const tempSlider = document.getElementById('aiTemperature');
      tempSlider.value = settings.aiTemperature ?? 0.3;
      document.getElementById('aiTemperatureValue').textContent = tempSlider.value;
      document.getElementById('proxyUrl').value = settings.proxyUrl || '';
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
      apiBaseUrl: document.getElementById('aiBaseUrl').value.trim(),
      apiKey: document.getElementById('aiApiKey').value.trim(),
      aiModel: document.getElementById('aiModel').value.trim(),
      aiTemperature: parseFloat(document.getElementById('aiTemperature').value) || 0.3,
      proxyUrl: document.getElementById('proxyUrl').value.trim(),
    });
    showStatus('saveBtn', t('common.saved'), 'success');
  } catch (err) {
    showStatus('saveBtn', t('common.saveFailed'), 'error');
  }
}

// Temperature 滑块实时显示
document.getElementById('aiTemperature')?.addEventListener('input', (e) => {
  document.getElementById('aiTemperatureValue').textContent = e.target.value;
});

// API Key 显示/隐藏
document.getElementById('toggleApiKeyBtn')?.addEventListener('click', () => {
  const input = document.getElementById('aiApiKey');
  input.type = input.type === 'password' ? 'text' : 'password';
});

// 测试 AI 连接
document.getElementById('testAIBtn')?.addEventListener('click', async () => {
  const statusEl = document.getElementById('testAIStatus');
  statusEl.textContent = '⏳ 测试中...';
  statusEl.className = 'status-hint';
  try {
    const ok = await window.oracleDesktop.testAIConnection();
    if (ok) {
      statusEl.textContent = '✅ 连接成功';
      statusEl.className = 'status-hint status-success';
    } else {
      statusEl.textContent = '❌ 连接失败';
      statusEl.className = 'status-hint status-error';
    }
  } catch (err) {
    statusEl.textContent = '❌ ' + (err.message || '连接失败');
    statusEl.className = 'status-hint status-error';
  }
});

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
    list.innerHTML = `<p class="muted">${t('wallet.noWallet')}</p>`;
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
        <button class="btn btn-secondary" onclick="selectWallet(${i})">${t('wallet.viewBtn')}</button>
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
    alert(t('wallet.enterAddress'));
    return;
  }

  try {
    await window.oracleDesktop.addWallet(address, chain, label);
    document.getElementById('walletAddress').value = '';
    document.getElementById('walletLabel').value = '';
    await loadWallets();
  } catch (err) {
    alert(t('wallet.addFailed') + ': ' + err.message);
  }
}

async function removeWalletAction(index) {
  const wallet = walletState.wallets[index];
  if (!wallet) return;
  if (!confirm(t('wallet.confirmDelete', { label: wallet.label }))) return;

  try {
    await window.oracleDesktop.removeWallet(wallet.address);
    await loadWallets();
  } catch (err) {
    alert(t('common.deleteFailed') + ': ' + err.message);
  }
}

async function selectWallet(index) {
  const wallet = walletState.wallets[index];
  if (!wallet) return;
  currentWalletIndex = index;

  const analysisEl = document.getElementById('walletAnalysis');
  analysisEl.innerHTML = `<div class="loading">${t('common.loading')}</div>`;

  try {
    const [analysis, txs] = await Promise.all([
      window.oracleDesktop.analyzeWallet(wallet.address, wallet.chain),
      window.oracleDesktop.getWalletTransactions(wallet.address, wallet.chain),
    ]);

    renderWalletAnalysis(analysis, wallet);
    renderWalletTransactions(txs);
    await loadWallets(); // 刷新余额
  } catch (err) {
    analysisEl.innerHTML = `<p class="error">${t('common.loadFailed')}: ${err.message}</p>`;
  }
}

async function aiAnalyzeWalletAction(index) {
  const wallet = walletState.wallets[index];
  if (!wallet) return;

  const aiEl = document.getElementById('walletAIAnalysis');
  aiEl.innerHTML = `<div class="loading">${t('wallet.aiAnalyzing')}</div>`;

  try {
    const result = await window.oracleDesktop.aiAnalyzeWallet(wallet.address, wallet.chain);
    renderWalletAIAnalysis(result);
  } catch (err) {
    aiEl.innerHTML = `<p class="error">${t('wallet.aiFailed')}: ${err.message}</p>`;
  }
}

function renderWalletAnalysis(data, wallet = {}) {
  const el = document.getElementById('walletAnalysis');
  if (!data || data.error) {
    el.innerHTML = `<p class="muted">${t('wallet.analysisFailed')}</p>`;
    return;
  }

  const s = data.stats || {};
  el.innerHTML = `
    <div class="stats-grid">
      <div class="stat"><span class="stat-label">${t('wallet.txCount')}</span><span class="stat-value">${s.total || 0}</span></div>
      <div class="stat"><span class="stat-label">${t('wallet.tradeStyle')}</span><span class="stat-value">${data.style || '?'}</span></div>
      <div class="stat"><span class="stat-label">${t('wallet.riskLevel')}</span><span class="stat-value">${data.riskLevel || 'low'}</span></div>
      <div class="stat"><span class="stat-label">${t('wallet.dailyAvg')}</span><span class="stat-value">${(s.tradingFrequency || 0).toFixed(1)}</span></div>
      <div class="stat"><span class="stat-label">${t('wallet.totalReceived')}</span><span class="stat-value">${(s.totalReceived || 0).toFixed(4)}</span></div>
      <div class="stat"><span class="stat-label">${t('wallet.totalSent')}</span><span class="stat-value">${(s.totalSent || 0).toFixed(4)}</span></div>
    </div>
    ${data.topMethods?.length ? `
      <h3 style="margin-top:12px;">${t('wallet.topMethods')}</h3>
      <div style="display:flex;flex-wrap:wrap;gap:4px;">
        ${data.topMethods.map(m => `<span class="ai-pattern">${m.method} (${m.count})</span>`).join('')}
      </div>
    ` : ''}
  `;
}

function renderWalletAIAnalysis(data) {
  const el = document.getElementById('walletAIAnalysis');
  if (!data || data.error) {
    el.innerHTML = `<p class="error">${data?.error || t('wallet.aiFailed')}</p>`;
    return;
  }

  let html = '<div class="ai-result">';

  if (data.summary) {
    html += `<div class="ai-section"><h4>${t('wallet.aiSummary')}</h4><div class="ai-summary">${data.summary}</div></div>`;
  }
  if (data.walletType) {
    html += `<div class="ai-section"><h4>${t('wallet.aiWalletType')}</h4><span class="badge badge-allow">${data.walletType}</span> · ${t('wallet.aiActivity')}: ${data.activityLevel || '?'}</div>`;
  }
  if (data.mainActivities?.length) {
    html += `<div class="ai-section"><h4>${t('wallet.aiMainActivities')}</h4>${data.mainActivities.map(a => `<div class="ai-suggestion">${a}</div>`).join('')}</div>`;
  }
  if (data.riskIndicators?.length) {
    html += `<div class="ai-section"><h4>${t('wallet.aiRiskIndicators')}</h4>${data.riskIndicators.map(r => `<div class="insight-warning">${r}</div>`).join('')}</div>`;
  }
  if (data.suggestions?.length) {
    html += `<div class="ai-section"><h4>${t('wallet.aiSuggestions')}</h4>${data.suggestions.map(s => `<div class="ai-suggestion">${s}</div>`).join('')}</div>`;
  }

  html += '</div>';
  el.innerHTML = html;
}

// 存储钱包交易数据用于分页
let walletTxData = [];

function renderWalletTransactions(txs, page = 1) {
  const tbody = document.getElementById('txTbody');
  if (!txs?.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="muted">${t('common.noRecord')}</td></tr>`;
    renderPagination('walletTxPagination', 0, 15, 1, () => { });
    return;
  }

  walletTxData = txs;
  const perPage = 15;
  const start = (page - 1) * perPage;
  const pageData = txs.slice(start, start + perPage);

  tbody.innerHTML = pageData.map(tx => `
    <tr>
      <td>${tx.timestamp ? new Date(tx.timestamp).toLocaleString() : '-'}</td>
      <td><span class="badge badge-${tx.isIncoming ? 'allow' : 'block'}">${tx.isIncoming ? t('wallet.incoming') : t('wallet.outgoing')}</span></td>
      <td>${tx.value?.toFixed(4)} ${tx.symbol}</td>
      <td>${(tx.gas || 0).toFixed(6)}</td>
      <td>${tx.method || '-'}</td>
    </tr>
  `).join('');

  renderPagination('walletTxPagination', txs.length, perPage, page, (p) => {
    renderWalletTransactions(walletTxData, p);
  });
}

document.getElementById('addWalletBtn')?.addEventListener('click', addWallet);
document.getElementById('refreshWalletBtn')?.addEventListener('click', () => {
  if (currentWalletIndex >= 0) selectWallet(currentWalletIndex);
  else if (walletState.wallets.length > 0) selectWallet(0);
});
document.getElementById('saveWalletsBtn')?.addEventListener('click', async () => {
  try {
    await window.oracleDesktop.saveWalletData();
    showStatus('saveWalletsBtn', t('common.saved'), 'success');
  } catch (err) {
    showStatus('saveWalletsBtn', t('common.saveFailed'), 'error');
  }
});

// ==================== 文件导入（CSV / XLSX）====================
async function importFile() {
  const statusEl = document.getElementById('csvStatus');
  statusEl.innerHTML = `<div class="loading">${t('common.importing')}</div>`;

  try {
    const result = await window.oracleDesktop.importFile();

    if (result.error) {
      statusEl.innerHTML = `<span class="error">${result.error}</span>`;
      return;
    }

    statusEl.innerHTML = `<span class="success">${t('csv.importedCount', { count: result.count, format: result.format })}</span>`;
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
  const pnl = a.pnl;
  const el = document.getElementById('csvAnalysis');

  // 基础统计卡片
  let html = `
    <div class="stats-grid">
      <div class="stat"><span class="stat-label">${t('csv.totalTrades')}</span><span class="stat-value">${stats.totalTrades || 0}</span></div>
      <div class="stat"><span class="stat-label">${t('csv.tradeStyle')}</span><span class="stat-value">${a.style || '?'}</span></div>
      <div class="stat"><span class="stat-label">${t('csv.riskLevel')}</span><span class="stat-value">${a.riskLevel || 'low'}</span></div>
      <div class="stat"><span class="stat-label">${t('csv.symbols')}</span><span class="stat-value">${stats.uniqueSymbols || 0}</span></div>
      <div class="stat"><span class="stat-label">${t('csv.totalVolume')}</span><span class="stat-value">${(stats.totalVolume || 0).toFixed(0)}</span></div>
      <div class="stat"><span class="stat-label">${t('csv.totalFees')}</span><span class="stat-value">${(stats.totalFees || 0).toFixed(2)}</span></div>
    </div>
  `;

  // 盈亏分析卡片
  if (pnl?.hasPairs) {
    const pnlColor = pnl.netPnl >= 0 ? '#3fb950' : '#f85149';
    const pnlSign = pnl.netPnl >= 0 ? '+' : '';
    html += `
      <h3 style="margin-top:16px;">${t('csv.pnlTitle')}</h3>
      <div class="stats-grid">
        <div class="stat"><span class="stat-label">${t('csv.realizedPnl')}</span><span class="stat-value" style="color:${pnlColor}">${pnlSign}${pnl.totalPnl.toFixed(2)}</span></div>
        <div class="stat"><span class="stat-label">${t('csv.netPnl')}</span><span class="stat-value" style="color:${pnlColor}">${pnlSign}${pnl.netPnl.toFixed(2)}</span></div>
        <div class="stat"><span class="stat-label">${t('csv.pnlPct')}</span><span class="stat-value" style="color:${pnlColor}">${pnl.pnlPct.toFixed(2)}%</span></div>
        <div class="stat"><span class="stat-label">${t('csv.pairsCount')}</span><span class="stat-value">${pnl.pairsCount}</span></div>
      </div>

      <h3 style="margin-top:12px;">${t('csv.winRateTitle')}</h3>
      <div class="stats-grid">
        <div class="stat"><span class="stat-label">${t('csv.winRate')}</span><span class="stat-value">${pnl.winRate.toFixed(1)}%</span></div>
        <div class="stat"><span class="stat-label">${t('csv.winLoss')}</span><span class="stat-value">${pnl.wins}/${pnl.losses}</span></div>
        <div class="stat"><span class="stat-label">${t('csv.avgWin')}</span><span class="stat-value" style="color:#3fb950">${pnl.avgWin.toFixed(2)}</span></div>
        <div class="stat"><span class="stat-label">${t('csv.avgLoss')}</span><span class="stat-value" style="color:#f85149">${pnl.avgLoss.toFixed(2)}</span></div>
        <div class="stat"><span class="stat-label">${t('csv.profitFactor')}</span><span class="stat-value">${pnl.profitFactor === Infinity ? '∞' : pnl.profitFactor.toFixed(2)}</span></div>
        <div class="stat"><span class="stat-label">${t('csv.winLossStreak')}</span><span class="stat-value">${pnl.streaks.maxWinStreak}/${pnl.streaks.maxLossStreak}</span></div>
      </div>

      <h3 style="margin-top:12px;">${t('csv.holdTitle')}</h3>
      <div class="stats-grid">
        <div class="stat"><span class="stat-label">${t('csv.avgHold')}</span><span class="stat-value">${formatHoldTime(pnl.holdPeriod.avgHours)}</span></div>
        <div class="stat"><span class="stat-label">${t('csv.medianHold')}</span><span class="stat-value">${formatHoldTime(pnl.holdPeriod.medianHours)}</span></div>
        <div class="stat"><span class="stat-label">${t('csv.intraday')}</span><span class="stat-value">${pnl.holdPeriod.buckets.intraday}</span></div>
        <div class="stat"><span class="stat-label">${t('csv.shortTerm')}</span><span class="stat-value">${pnl.holdPeriod.buckets.short}</span></div>
        <div class="stat"><span class="stat-label">${t('csv.mediumTerm')}</span><span class="stat-value">${pnl.holdPeriod.buckets.medium}</span></div>
        <div class="stat"><span class="stat-label">${t('csv.longTerm')}</span><span class="stat-value">${pnl.holdPeriod.buckets.long}</span></div>
      </div>

      <h3 style="margin-top:12px;">${t('csv.positionTitle')}</h3>
      <div class="stats-grid">
        <div class="stat"><span class="stat-label">${t('csv.maxTradeRatio')}</span><span class="stat-value">${pnl.positionSizing.maxTradeRatio.toFixed(1)}%</span></div>
        <div class="stat"><span class="stat-label">${t('csv.maxSymbolRatio')}</span><span class="stat-value">${pnl.positionSizing.maxSymbolRatio.toFixed(1)}%</span></div>
        <div class="stat"><span class="stat-label">${t('csv.avgTradeSize')}</span><span class="stat-value">${pnl.positionSizing.avgTradeSize.toFixed(2)}</span></div>
        <div class="stat"><span class="stat-label">${t('csv.feeRatio')}</span><span class="stat-value">${pnl.costEfficiency.feeToVolumeRatio.toFixed(3)}%</span></div>
      </div>
    `;
  } else if (pnl && !pnl.hasPairs) {
    html += `<div class="insight-info" style="margin-top:12px;">${t('csv.pnlMessage', { message: pnl.message })}</div>`;
  }

  // Top 交易品种
  if (a.topSymbols?.length) {
    html += `
      <h3 style="margin-top:12px;">${t('csv.topSymbols')}</h3>
      <div style="display:flex;flex-wrap:wrap;gap:4px;">
        ${a.topSymbols.slice(0, 5).map(s => `<span class="ai-pattern">${s.symbol} (${s.trades} ${t('csv.trades')})</span>`).join('')}
      </div>
    `;
  }

  // 洞察
  if (a.insights?.length) {
    html += `
      <div class="insights" style="margin-top:12px;">
        ${a.insights.map(i => `<div class="insight-${i.type}">${i.text}</div>`).join('')}
      </div>
    `;
  }

  el.innerHTML = html;
  window.currentAnalysis = a;
}

// 格式化持仓时间显示
function formatHoldTime(hours) {
  if (hours < 1) return t('time.minutes', { n: Math.round(hours * 60) });
  if (hours < 24) return t('time.hours', { n: hours.toFixed(1) });
  if (hours < 24 * 30) return t('time.days', { n: (hours / 24).toFixed(1) });
  return t('time.months', { n: (hours / 24 / 30).toFixed(1) });
}

// 存储 CSV 交易数据用于分页
let csvTxData = [];

function renderCSVTransactions(txs, page = 1) {
  const tbody = document.getElementById('csvTbody');
  if (!txs?.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="muted">${t('common.noData')}</td></tr>`;
    renderPagination('csvTxPagination', 0, 20, 1, () => { });
    return;
  }

  csvTxData = txs;
  const perPage = 20;
  const start = (page - 1) * perPage;
  const pageData = txs.slice(start, start + perPage);

  const marketLabels = {
    crypto: t('marketLabels.crypto'),
    a_share: t('marketLabels.a_share'),
    us_stock: t('marketLabels.us_stock'),
    hk_stock: t('marketLabels.hk_stock'),
    forex: t('marketLabels.forex'),
    futures: t('marketLabels.futures'),
    other: t('marketLabels.other'),
  };

  tbody.innerHTML = pageData.map(tx => `
    <tr>
      <td>${tx.timestamp ? new Date(tx.timestamp).toLocaleString() : tx.rawTime || '-'}</td>
      <td>${tx.symbol || tx.ticker || '-'}${tx.assetName ? ` <small>${tx.assetName}</small>` : ''}</td>
      <td><span class="badge">${marketLabels[tx.marketType || tx.market_type] || '-'}</span></td>
      <td><span class="badge badge-${tx.isBuy || tx.is_buy ? 'allow' : 'block'}">${tx.isBuy || tx.is_buy ? t('csv.buy') : t('csv.sell')}</span></td>
      <td>${tx.price?.toFixed(2) || '-'}</td>
      <td>${tx.qty?.toFixed(4) || '-'}</td>
      <td>${tx.total?.toFixed(2) || '-'}</td>
      <td>${tx.currency || '-'}</td>
    </tr>
  `).join('');

  renderPagination('csvTxPagination', txs.length, perPage, page, (p) => {
    renderCSVTransactions(csvTxData, p);
  });
}

document.getElementById('importFileBtn')?.addEventListener('click', importFile);

// ==================== AI 分析买卖点 ====================
async function aiAnalyzeTrades() {
  if (!currentTransactions?.length) {
    alert(t('csv.importFirst'));
    return;
  }

  const card = document.getElementById('aiAnalysisCard');
  const resultEl = document.getElementById('aiAnalysisResult');
  card.style.display = 'block';
  resultEl.innerHTML = `<div class="loading">${t('csv.aiAnalyzing')}</div>`;

  // 禁用按钮
  const btn = document.getElementById('aiAnalyzeBtn');
  if (btn) btn.disabled = true;

  try {
    const result = await window.oracleDesktop.aiAnalyzeTrades(currentTransactions);
    renderAIAnalysis(result);
  } catch (err) {
    resultEl.innerHTML = `<p class="error">${t('csv.aiFailed')}: ${err.message}</p>`;
  } finally {
    if (btn) btn.disabled = false;
  }
}

function renderAIAnalysis(data) {
  const el = document.getElementById('aiAnalysisResult');

  if (!data || data.error) {
    el.innerHTML = `<p class="error">${data?.error || t('csv.aiFailed')}</p>`;
    return;
  }

  let html = '<div class="ai-result">';

  // 总结
  if (data.summary) {
    html += `<div class="ai-section"><h4>${t('csv.aiSummary')}</h4><div class="ai-summary">${data.summary}</div></div>`;
  }

  // 买入点
  if (data.buyPoints?.length) {
    html += `<div class="ai-section"><h4>${t('csv.aiBuyPoints')}</h4>`;
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
    html += `<div class="ai-section"><h4>${t('csv.aiSellPoints')}</h4>`;
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
    html += `<div class="ai-section"><h4>${t('csv.aiPatterns')}</h4><div>${data.tradingPatterns.map(p => `<span class="ai-pattern">${p}</span>`).join('')}</div></div>`;
  }

  // 风险评估
  if (data.riskAssessment) {
    html += `<div class="ai-section"><h4>${t('csv.aiRisk')}</h4><div class="insight-warning">${data.riskAssessment}</div></div>`;
  }

  // 建议
  if (data.suggestions?.length) {
    html += `<div class="ai-section"><h4>${t('csv.aiSuggestions')}</h4>${data.suggestions.map(s => `<div class="ai-suggestion">${s}</div>`).join('')}</div>`;
  }

  // 原始内容（降级情况）
  if (data.rawContent) {
    html += `<div class="ai-section"><h4>${t('csv.aiRawContent')}</h4><pre style="white-space:pre-wrap;color:#8b949e;font-size:12px;">${data.rawContent.slice(0, 1000)}</pre></div>`;
  }

  html += '</div>';
  el.innerHTML = html;
}

document.getElementById('aiAnalyzeBtn')?.addEventListener('click', aiAnalyzeTrades);

// ==================== 导出报告 ====================
async function exportReport() {
  const analysis = window.currentAnalysis;
  if (!analysis) {
    alert(t('csv.noExportData'));
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
  const pnl = analysis.pnl;
  const marketLabels = {
    crypto: t('marketLabelsFull.crypto'),
    a_share: t('marketLabelsFull.a_share'),
    us_stock: t('marketLabelsFull.us_stock'),
    hk_stock: t('marketLabelsFull.hk_stock'),
    forex: t('marketLabelsFull.forex'),
    futures: t('marketLabelsFull.futures'),
    other: t('marketLabelsFull.other'),
  };

  let report = `# ${t('report.title')}

${t('report.generated')}: ${new Date().toLocaleString()}

${t('report.style')}: ${analysis.style} | ${t('report.risk')}: ${analysis.riskLevel}

${t('report.tradesCount')}: ${stats.totalTrades} | ${t('report.amount')}: ${stats.totalVolume?.toFixed(2)} | ${t('report.symbolsCount')}: ${stats.uniqueSymbols}
`;

  // 盈亏分析
  if (pnl?.hasPairs) {
    const sign = pnl.netPnl >= 0 ? '+' : '';
    report += `
## ${t('report.pnlTitle')}

- ${t('report.realizedPnl')}: ${sign}${pnl.totalPnl.toFixed(2)}
- ${t('report.netPnl')}: ${sign}${pnl.netPnl.toFixed(2)}
- ${t('report.pnlPct')}: ${pnl.pnlPct.toFixed(2)}%
- ${t('report.pairsCount')}: ${pnl.pairsCount}

## ${t('report.winRateTitle')}

- ${t('report.winRate')}: ${pnl.winRate.toFixed(1)}%
- ${t('report.winLossCount')}: ${pnl.wins}/${pnl.losses}
- ${t('report.avgWin')}: ${pnl.avgWin.toFixed(2)}
- ${t('report.avgLoss')}: ${pnl.avgLoss.toFixed(2)}
- ${t('report.profitFactor')}: ${pnl.profitFactor === Infinity ? '∞' : pnl.profitFactor.toFixed(2)}
- ${t('report.maxWinStreak')}: ${pnl.streaks.maxWinStreak}
- ${t('report.maxLossStreak')}: ${pnl.streaks.maxLossStreak}

## ${t('report.holdTitle')}

- ${t('report.avgHold')}: ${formatHoldTime(pnl.holdPeriod.avgHours)}
- ${t('csv.intraday')}: ${pnl.holdPeriod.buckets.intraday} | ${t('csv.shortTerm')}: ${pnl.holdPeriod.buckets.short} | ${t('csv.mediumTerm')}: ${pnl.holdPeriod.buckets.medium} | ${t('csv.longTerm')}: ${pnl.holdPeriod.buckets.long}

## ${t('report.positionTitle')}

- ${t('report.maxTradeRatio')}: ${pnl.positionSizing.maxTradeRatio.toFixed(1)}%
- ${t('report.maxSymbolRatio')}: ${pnl.positionSizing.maxSymbolRatio.toFixed(1)}%
- ${t('report.feeRatio')}: ${pnl.costEfficiency.feeToVolumeRatio.toFixed(3)}%
`;
  }

  // 市场分布
  if (analysis.marketTypeBreakdown && Object.keys(analysis.marketTypeBreakdown).length > 0) {
    report += `\n## ${t('report.marketDistribution')}\n`;
    for (const [mt, count] of Object.entries(analysis.marketTypeBreakdown)) {
      report += `- ${marketLabels[mt] || mt}: ${count} ${t('csv.trades')}\n`;
    }
  }

  if (analysis.topSymbols?.length) {
    report += `\n## ${t('report.topSymbols')}\n` + analysis.topSymbols.map(s =>
      `- ${s.symbol} [${marketLabels[s.marketType] || ''}]: ${s.trades} ${t('csv.trades')}, ${s.volume?.toFixed(2)}`
    ).join('\n');
  }

  if (analysis.insights?.length) {
    report += `\n\n## ${t('report.insights')}\n` + analysis.insights.map(i => `- [${i.type}] ${i.text}`).join('\n');
  }

  return report;
}

document.getElementById('exportReportBtn')?.addEventListener('click', exportReport);

// ==================== 决策日志 ====================
let allDecisionLogs = [];

async function refreshLogs() {
  try {
    const { items } = await window.oracleDesktop.listDecisionLogs(100);
    const el = document.getElementById('decisionLogs');
    if (!el) return;

    if (!items?.length) {
      el.innerHTML = `<p class="muted">${t('monitor.decisionLogEmpty')}</p>`;
      renderPagination('decisionLogsPagination', 0, 10, 1, () => { });
      return;
    }

    allDecisionLogs = items;
    renderDecisionLogsPage(1);
  } catch (err) {
    console.error('Load logs error:', err);
  }
}

function renderDecisionLogsPage(page) {
  const el = document.getElementById('decisionLogs');
  if (!el) return;

  const perPage = 10;
  const start = (page - 1) * perPage;
  const pageData = allDecisionLogs.slice(start, start + perPage);

  const actionLabels = { block: t('monitor.actionBlock'), warn: t('monitor.actionWarn'), allow: t('monitor.actionAllow') };
  el.innerHTML = pageData.map(log => {
    const time = log.created_at ? new Date(log.created_at).toLocaleString() : '-';
    const badge = log.action === 'block' ? 'block' : log.action === 'warn' ? 'warn' : 'allow';
    return `<div class="log-item">
      <span class="badge badge-${badge}">${actionLabels[log.action] || log.action || '-'}</span>
      <span>${log.app_name || '-'}</span>
      <span class="muted">${time}</span>
      ${log.detail ? `<small class="muted">${typeof log.detail === 'string' ? log.detail.slice(0, 80) : ''}</small>` : ''}
    </div>`;
  }).join('');

  renderPagination('decisionLogsPagination', allDecisionLogs.length, perPage, page, (p) => {
    renderDecisionLogsPage(p);
  });
}

// ==================== 历史导入 ====================
async function loadImportHistory() {
  try {
    const history = await window.oracleDesktop.getImportHistory();
    const select = document.getElementById('importHistorySelect');
    if (!select) return;

    select.innerHTML = `<option value="">${t('csv.historySelect')}</option>`;
    for (const batch of history) {
      const time = batch.imported_at ? new Date(batch.imported_at).toLocaleString() : t('common.unknown');
      const option = document.createElement('option');
      option.value = batch.import_batch;
      option.textContent = `${batch.exchange || t('common.unknown')} · ${batch.count} ${t('csv.trades')} · ${time}`;
      select.appendChild(option);
    }
  } catch (err) {
    console.error('Load import history error:', err);
  }
}

async function loadHistoryBatch() {
  const select = document.getElementById('importHistorySelect');
  const batchId = select?.value;
  if (!batchId) { alert(t('csv.selectBatch')); return; }

  const infoEl = document.getElementById('importHistoryInfo');
  infoEl.innerHTML = `<div class="loading">${t('common.loading')}</div>`;

  try {
    const txs = await window.oracleDesktop.getTransactionsByBatch(batchId);
    currentTransactions = txs;
    infoEl.innerHTML = `<span class="success">${t('csv.historyLoaded', { count: txs.length })}</span>`;

    // 启用 AI 分析按钮
    const aiBtn = document.getElementById('aiAnalyzeBtn');
    if (aiBtn) aiBtn.disabled = false;

    renderCSVTransactions(txs);
  } catch (err) {
    infoEl.innerHTML = `<span class="error">${t('common.loadFailed')}: ${err.message}</span>`;
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
  document.getElementById('sidePanelTitle').textContent = t('sidePanel.loadingTitle');
  document.getElementById('sidePanelBody').innerHTML = `
    <div style="text-align:center;padding:40px 0;">
      <div class="loading">${t('sidePanel.loading')}</div>
      <p style="color:#6e7681;font-size:12px;margin-top:16px;">${t('sidePanel.loadingHint')}</p>
    </div>`;
  document.getElementById('sidePanelActions').style.display = 'none';
  openSidePanel();
}

function renderSidePanelResult(result) {
  const action = result?.action || 'allow';
  const risk = result?.riskLevel || 'low';
  const platform = result?.platform || t('sidePanel.unidentified');
  const buttons = result?.buttons || [];
  const hasTrade = result?.hasTradingButtons || false;
  const summary = result?.summary || '';

  const rc = {
    high: { bg: '#3a1a1a', border: '#dc2626', text: '#f87171', emoji: '🔴', label: t('sidePanel.riskHigh') },
    medium: { bg: '#3a2a1a', border: '#d97706', text: '#fbbf24', emoji: '🟡', label: t('sidePanel.riskMedium') },
    low: { bg: '#1a3a2a', border: '#16a34a', text: '#4ade80', emoji: '🟢', label: t('sidePanel.riskLow') },
  }[risk] || { bg: '#1a3a2a', border: '#16a34a', text: '#4ade80', emoji: '🟢', label: t('sidePanel.riskLow') };

  document.getElementById('sidePanelTitle').textContent = t('sidePanel.resultTitle', { emoji: rc.emoji, label: rc.label });
  document.getElementById('sidePanelBody').innerHTML = `
    <div class="analysis-detail-card" style="border:1px solid ${rc.border};background:${rc.bg};">
      <div class="detail-grid">
        <div class="detail-item"><span class="detail-label">${t('sidePanel.platform')}</span><span class="detail-value">${platform}</span></div>
        <div class="detail-item"><span class="detail-label">${t('sidePanel.riskLevel')}</span><span class="detail-value" style="color:${rc.text};">${rc.emoji} ${rc.label}</span></div>
        <div class="detail-item"><span class="detail-label">${t('sidePanel.tradeButtons')}</span><span class="detail-value">${hasTrade ? t('sidePanel.detected') : t('sidePanel.notDetected')}</span></div>
        <div class="detail-item"><span class="detail-label">${t('sidePanel.suggestedAction')}</span><span class="detail-value" style="color:${rc.text};">${action === 'block' ? t('sidePanel.actionBlock') : action === 'warn' ? t('sidePanel.actionWarn') : t('sidePanel.actionAllow')}</span></div>
      </div>
      ${buttons.length ? `<div style="margin-bottom:12px;"><span class="detail-label">${t('sidePanel.detectedButtons')}</span><div class="analysis-buttons-list" style="margin-top:6px;">${buttons.map(b => `<span class="analysis-button-tag">${b}</span>`).join('')}</div></div>` : ''}
    </div>
    ${summary ? `<div class="card" style="margin:0;"><h2 style="font-size:14px;">${t('sidePanel.aiSuggestion')}</h2><p style="color:#8b949e;font-size:13px;line-height:1.6;">${summary}</p></div>` : ''}
    <div class="card" style="margin-top:12px;">
      <h2 style="font-size:14px;">${t('sidePanel.detailTitle')}</h2>
      <div style="font-size:12px;color:#6e7681;">
        <div style="margin-bottom:4px;">${t('sidePanel.detailTime', { time: new Date().toLocaleString() })}</div>
        <div style="margin-bottom:4px;">${t('sidePanel.detailEngine')}</div>
        <div>${t('sidePanel.detailPrivacy')}</div>
      </div>
    </div>`;
  document.getElementById('sidePanelActions').style.display = (action === 'block' || action === 'warn') ? 'flex' : 'none';
  openSidePanel();
}

// 侧边栏操作按钮
document.getElementById('sidePanelBlock')?.addEventListener('click', () => {
  pushNotification(t('notification.tradeCancelled'), t('notification.tradeCancelledBody'), 'warning');
  closeSidePanel();
});
document.getElementById('sidePanelAllow')?.addEventListener('click', () => {
  pushNotification(t('notification.tradeAllowed'), t('notification.tradeAllowedBody'), 'success');
  closeSidePanel();
});

// ==================== 截图按钮 ====================
document.getElementById('screenshotBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('screenshotBtn');
  btn.disabled = true;
  btn.textContent = t('monitor.screenshotting');
  showSidePanelLoading();
  pushNotification(t('notification.screenshotting'), t('notification.screenshottingBody'), 'info', 3000);

  try {
    const result = await window.oracleDesktop.takeScreenshot();
    if (!result) {
      closeSidePanel();
      pushNotification(t('notification.screenshotFailed'), t('notification.screenshotFailedBody'), 'error');
    }
  } catch (err) {
    closeSidePanel();
    pushNotification(t('notification.analysisError'), err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = t('monitor.screenshotBtn');
  }
});

// 快捷键截图也打开侧边栏
if (window.oracleDesktop.onScreenshotCaptured) {
  window.oracleDesktop.onScreenshotCaptured(() => {
    showSidePanelLoading();
    pushNotification(t('notification.screenshotSuccess'), t('notification.screenshotSuccessBody'), 'info', 4000);
  });
}

// 分析结果 → 侧边栏 + 通知 + 记录
if (window.oracleDesktop.onScreenshotResult) {
  window.oracleDesktop.onScreenshotResult((result) => {
    renderSidePanelResult(result);
    addAnalysisLog(result);
    updateStats(result);
    const risk = result?.riskLevel || 'low';
    const label = risk === 'high' ? t('sidePanel.riskHigh') : risk === 'medium' ? t('sidePanel.riskMedium') : t('sidePanel.riskLow');
    const emoji = risk === 'high' ? '🔴' : risk === 'medium' ? '🟡' : '🟢';
    const type = risk === 'high' ? 'error' : risk === 'medium' ? 'warning' : 'success';
    pushNotification(`${emoji} ${label} · ${result?.platform || t('sidePanel.unidentified')}`,
      result?.action === 'block' ? t('notification.suggestCancel') : t('notification.safeOperation'), type, 6000);
  });
}

// 分析错误
if (window.oracleDesktop.onScreenshotError) {
  window.oracleDesktop.onScreenshotError((data) => {
    closeSidePanel();
    pushNotification(t('notification.analysisFailed'), data?.error || t('common.error'), 'error');
  });
}

// ==================== 分析记录 ====================
function addAnalysisLog(result) {
  const logEl = document.getElementById('screenshotLog');
  if (logEl.querySelector('.muted')) logEl.innerHTML = '';

  const risk = result?.riskLevel || 'low';
  const emoji = risk === 'high' ? '🔴' : risk === 'medium' ? '🟡' : '🟢';
  const label = risk === 'high' ? t('sidePanel.riskHigh') : risk === 'medium' ? t('sidePanel.riskMedium') : t('sidePanel.riskLow');
  const platform = result?.platform || t('sidePanel.unidentified');
  const time = new Date().toLocaleTimeString();
  const action = result?.action || 'allow';

  const entry = document.createElement('div');
  entry.style.cssText = 'padding:8px 12px;margin-bottom:6px;border-radius:6px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);font-size:13px;cursor:pointer;transition:background 0.2s;';
  entry.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <span>${emoji} <strong>${label}</strong> · ${platform}</span>
      <span style="color:#8b949e;font-size:11px;">${time}</span>
    </div>
    ${result?.buttons?.length ? `<div style="color:#8b949e;font-size:11px;margin-top:4px;">${t('monitor.buttons')}: ${result.buttons.join(', ')}</div>` : ''}
    <div style="color:${action === 'block' ? '#f87171' : '#8b949e'};font-size:11px;margin-top:2px;">→ ${action === 'block' ? t('monitor.blocked') : action === 'warn' ? t('monitor.warned') : t('monitor.allowed')}</div>`;
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

