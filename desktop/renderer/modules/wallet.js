/**
 * Oracle-X Desktop — 钱包管理模块
 */

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
        <button class="btn btn-accent" onclick="aiAnalyzeWalletAction(${i})"><span class="ox-icon ox-icon-bot"></span> AI</button>
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
