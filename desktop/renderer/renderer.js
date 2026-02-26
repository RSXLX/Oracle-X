/**
 * Oracle-X Desktop Renderer - with Wallet Support
 */

let walletAnalyzer = null;

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
  });
});

// Wallet management
const walletState = {
  wallets: [],
  currentChain: 'ethereum',
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
      </div>
      <button class="btn btn-secondary" onclick="selectWallet(${i})">查看</button>
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

async function selectWallet(index) {
  const wallet = walletState.wallets[index];
  if (!wallet) return;
  
  try {
    const analysis = await window.oracleDesktop.analyzeWallet(wallet.address, wallet.chain);
    renderWalletAnalysis(analysis);
    
    const txs = await window.oracleDesktop.getWalletTransactions(wallet.address, wallet.chain);
    renderTransactions(txs);
  } catch (err) {
    console.error('Wallet analysis error:', err);
  }
}

function renderWalletAnalysis(data) {
  const el = document.getElementById('walletAnalysis');
  if (!data || data.error) {
    el.innerHTML = '<p class="muted">无法获取分析</p>';
    return;
  }
  
  const s = data.stats || {};
  el.innerHTML = `
    <div class="stats-grid">
      <div class="stat">
        <span class="stat-label">交易次数</span>
        <span class="stat-value">${s.total || 0}</span>
      </div>
      <div class="stat">
        <span class="stat-label">交易风格</span>
        <span class="stat-value">${data.style || 'unknown'}</span>
      </div>
      <div class="stat">
        <span class="stat-label">风险等级</span>
        <span class="stat-value">${data.riskLevel || 'low'}</span>
      </div>
      <div class="stat">
        <span class="stat-label">日均交易</span>
        <span class="stat-value">${(s.tradingFrequency || 0).toFixed(1)}</span>
      </div>
    </div>
  `;
}

function renderTransactions(txs) {
  const tbody = document.getElementById('txTbody');
  if (!txs?.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="muted">暂无记录</td></tr>';
    return;
  }
  
  tbody.innerHTML = txs.slice(0, 20).map(tx => `
    <tr>
      <td>${new Date(tx.timestamp).toLocaleDateString()}</td>
      <td><span class="badge badge-${tx.isIncoming ? 'allow' : 'block'}">${tx.isIncoming ? '转入' : '转出'}</span></td>
      <td>${tx.value?.toFixed(4)} ${tx.symbol}</td>
      <td>${(tx.gas || 0).toFixed(6)}</td>
    </tr>
  `).join('');
}

// Event listeners
document.getElementById('addWalletBtn')?.addEventListener('click', addWallet);
document.getElementById('refreshWalletBtn')?.addEventListener('click', () => {
  if (walletState.wallets.length > 0) {
    selectWallet(0);
  }
});

// Initialize
(async () => {
  await loadSettings();
  await loadWallets();
  await refreshLogs();
})();
