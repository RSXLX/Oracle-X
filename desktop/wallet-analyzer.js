/**
 * Oracle-X 钱包交易记录模块
 * 支持 ETH/BSC 通过 RPC 读取链上数据 + MySQL 持久化
 */

// RPC 端点配置
const RPC_CONFIG = {
  ethereum: {
    name: 'Ethereum',
    symbol: 'ETH',
    chainId: 1,
    rpcUrl: 'https://ethereum-mainnet.g.allthatnode.com/full/evm/0d35aeffdccb405fb831f6539c284afd',
    explorerApi: 'https://api.etherscan.io/api',
    decimals: 18,
  },
  bsc: {
    name: 'BNB Smart Chain',
    symbol: 'BNB',
    chainId: 56,
    rpcUrl: 'https://bsc-mainnet.g.allthatnode.com/full/evm/0d35aeffdccb405fb831f6539c284afd',
    explorerApi: 'https://api.bscscan.com/api',
    decimals: 18,
  },
};

// Explorer API keys（免费 tier，可选）
const EXPLORER_KEYS = {
  ethereum: '',
  bsc: '',
};

class WalletAnalyzer {
  constructor(db) {
    this.db = db;
    this.wallets = new Map(); // 内存缓存
  }

  // ==================== 钱包管理 ====================

  async addWallet(address, chain = 'ethereum', label = '') {
    const addr = address.toLowerCase().trim();
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    await this.db.execute(
      `INSERT INTO wallets (address, chain, label, added_at)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE label = ?, chain = ?`,
      [addr, chain, label || `Wallet`, now, label || `Wallet`, chain]
    );

    this.wallets.set(addr, {
      address: addr,
      chain,
      label: label || 'Wallet',
      addedAt: now,
      transactions: [],
      balance: null,
      txCount: null,
    });

    return addr;
  }

  async removeWallet(address) {
    const addr = address.toLowerCase().trim();
    await this.db.execute('DELETE FROM wallets WHERE address = ?', [addr]);
    await this.db.execute("DELETE FROM transactions WHERE wallet_address = ? AND source = 'chain'", [addr]);
    this.wallets.delete(addr);
    return true;
  }

  async getWallets() {
    const [rows] = await this.db.execute('SELECT * FROM wallets ORDER BY added_at DESC');
    // 同步内存缓存
    this.wallets.clear();
    for (const row of rows) {
      this.wallets.set(row.address, {
        address: row.address,
        chain: row.chain,
        label: row.label,
        addedAt: row.added_at,
        balance: row.balance ? { balance: row.balance, symbol: row.balance_symbol } : null,
        txCount: row.tx_count,
        transactions: [],
      });
    }
    return rows.map(r => ({
      address: r.address,
      chain: r.chain,
      label: r.label,
      addedAt: r.added_at,
      balance: r.balance ? { balance: r.balance, symbol: r.balance_symbol } : null,
      txCount: r.tx_count,
      lastUpdated: r.last_updated,
    }));
  }

  // ==================== RPC 调用 ====================

  async rpcCall(chain, method, params = []) {
    const config = RPC_CONFIG[chain];
    if (!config) throw new Error(`不支持的链: ${chain}`);

    const response = await fetch(config.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params,
      }),
    });

    if (!response.ok) throw new Error(`RPC error: ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(`RPC error: ${data.error.message}`);
    return data.result;
  }

  async getBalance(address, chain = 'ethereum') {
    try {
      const result = await this.rpcCall(chain, 'eth_getBalance', [address, 'latest']);
      const config = RPC_CONFIG[chain];
      const balance = parseInt(result, 16) / Math.pow(10, config.decimals);
      return { balance, symbol: config.symbol };
    } catch (err) {
      console.error('[WalletAnalyzer] Balance error:', err.message);
      return { balance: 0, symbol: RPC_CONFIG[chain]?.symbol || '?' };
    }
  }

  async getTxCount(address, chain = 'ethereum') {
    try {
      const result = await this.rpcCall(chain, 'eth_getTransactionCount', [address, 'latest']);
      return parseInt(result, 16);
    } catch (err) {
      console.error('[WalletAnalyzer] TxCount error:', err.message);
      return 0;
    }
  }

  async getBlockNumber(chain = 'ethereum') {
    try {
      const result = await this.rpcCall(chain, 'eth_blockNumber', []);
      return parseInt(result, 16);
    } catch (err) {
      console.error('[WalletAnalyzer] BlockNumber error:', err.message);
      return 0;
    }
  }

  async getRecentTransactionsViaRPC(address, chain = 'ethereum', blockRange = 5000) {
    const addr = address.toLowerCase();
    const transactions = [];

    try {
      const latestBlock = await this.getBlockNumber(chain);
      const startBlock = Math.max(0, latestBlock - blockRange);
      const step = 50;

      for (let block = latestBlock; block >= startBlock && transactions.length < 50; block -= step) {
        try {
          const blockHex = '0x' + block.toString(16);
          const blockData = await this.rpcCall(chain, 'eth_getBlockByNumber', [blockHex, true]);

          if (blockData?.transactions) {
            for (const tx of blockData.transactions) {
              if (tx.from?.toLowerCase() === addr || tx.to?.toLowerCase() === addr) {
                const config = RPC_CONFIG[chain];
                transactions.push({
                  hash: tx.hash,
                  from: tx.from?.toLowerCase() || '',
                  to: tx.to?.toLowerCase() || '',
                  value: parseInt(tx.value, 16) / Math.pow(10, config.decimals),
                  gas: parseInt(tx.gas, 16) * parseInt(tx.gasPrice || '0', 16) / 1e18,
                  blockNumber: parseInt(tx.blockNumber, 16),
                  timestamp: blockData.timestamp ? new Date(parseInt(blockData.timestamp, 16) * 1000).toISOString() : '',
                  chain: config.name,
                  symbol: config.symbol,
                  isIncoming: tx.to?.toLowerCase() === addr,
                });
              }
            }
          }
        } catch (e) {
          // 跳过失败的区块
        }
      }
    } catch (err) {
      console.error('[WalletAnalyzer] RPC scan error:', err.message);
    }

    return transactions;
  }

  // ==================== Explorer API 调用 ====================

  async fetchTransactions(address, chain = 'ethereum', limit = 50) {
    const addr = address.toLowerCase().trim();
    const config = RPC_CONFIG[chain];
    if (!config) return [];

    try {
      const txs = await this.fetchViaExplorerAPI(addr, chain, limit);

      const [balanceInfo, txCount] = await Promise.all([
        this.getBalance(addr, chain),
        this.getTxCount(addr, chain),
      ]);

      // 更新钱包信息到 DB
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      await this.db.execute(
        `UPDATE wallets SET balance = ?, balance_symbol = ?, tx_count = ?, last_updated = ? WHERE address = ?`,
        [balanceInfo.balance, balanceInfo.symbol, txCount, now, addr]
      );

      // 存储交易到 DB
      await this.saveChainTransactions(addr, txs);

      // 更新内存缓存
      const wallet = this.wallets.get(addr);
      if (wallet) {
        wallet.transactions = txs;
        wallet.balance = balanceInfo;
        wallet.txCount = txCount;
        wallet.lastUpdated = now;
      }

      return txs;
    } catch (err) {
      console.error('[WalletAnalyzer] Fetch error:', err.message);
      return this.getRecentTransactionsViaRPC(addr, chain);
    }
  }

  /**
   * 保存链上交易到 MySQL
   */
  async saveChainTransactions(walletAddress, txs) {
    if (!txs?.length) return;

    for (const tx of txs) {
      const ts = tx.timestamp
        ? new Date(tx.timestamp).toISOString().slice(0, 19).replace('T', ' ')
        : null;

      await this.db.execute(
        `INSERT INTO transactions
         (source, wallet_address, hash, timestamp, symbol, chain, is_incoming, \`value\`, gas, method)
         VALUES ('chain', ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE timestamp = VALUES(timestamp)`,
        [
          walletAddress,
          tx.hash || '',
          ts,
          tx.symbol || '',
          tx.chain || '',
          tx.isIncoming ? 1 : 0,
          tx.value || 0,
          tx.gas || 0,
          tx.method || '',
        ]
      );
    }
  }

  async fetchViaExplorerAPI(address, chain, limit) {
    const config = RPC_CONFIG[chain];
    const apiKey = EXPLORER_KEYS[chain] || '';
    const url = `${config.explorerApi}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=${limit}&sort=desc&apikey=${apiKey}`;

    try {
      const res = await fetch(url);
      const data = await res.json();

      if (data.status !== '1' || !data.result?.length) {
        console.warn('[WalletAnalyzer] Explorer API:', data.message || data.result || 'no data');
        console.warn('[WalletAnalyzer] Falling back to RPC scan...');
        return this.getRecentTransactionsViaRPC(address, chain);
      }

      return data.result.map(tx => ({
        hash: tx.hash,
        from: tx.from.toLowerCase(),
        to: tx.to?.toLowerCase() || '',
        value: parseFloat(tx.value) / Math.pow(10, config.decimals),
        gas: parseFloat(tx.gasUsed) * parseFloat(tx.gasPrice) / 1e18,
        timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
        blockNumber: parseInt(tx.blockNumber),
        chain: config.name,
        symbol: config.symbol,
        isIncoming: tx.to?.toLowerCase() === address,
        method: tx.functionName?.split('(')[0] || '',
      }));
    } catch (err) {
      console.error('[WalletAnalyzer] Explorer API error:', err.message);
      return this.getRecentTransactionsViaRPC(address, chain);
    }
  }

  // ==================== 分析 ====================

  analyzePattern(transactions) {
    if (!transactions?.length) {
      return { error: 'No transactions' };
    }

    const stats = {
      total: transactions.length,
      totalReceived: 0,
      totalSent: 0,
      gasFees: 0,
      byMonth: {},
      byDay: {},
      avgTxValue: 0,
      tradingFrequency: 0,
      methods: {},
    };

    for (const tx of transactions) {
      if (tx.isIncoming || tx.is_incoming) {
        stats.totalReceived += tx.value || 0;
      } else {
        stats.totalSent += tx.value || 0;
      }
      stats.gasFees += tx.gas || 0;

      if (tx.method) {
        stats.methods[tx.method] = (stats.methods[tx.method] || 0) + 1;
      }

      const date = new Date(tx.timestamp);
      if (!isNaN(date.getTime())) {
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const dayKey = date.toDateString();
        stats.byMonth[monthKey] = (stats.byMonth[monthKey] || 0) + 1;
        stats.byDay[dayKey] = (stats.byDay[dayKey] || 0) + 1;
      }
    }

    stats.avgTxValue = (stats.totalReceived + stats.totalSent) / stats.total;
    const days = Object.keys(stats.byDay).length || 1;
    stats.tradingFrequency = transactions.length / days;

    let style = 'investor';
    if (stats.tradingFrequency > 10) style = 'degen';
    else if (stats.tradingFrequency > 3) style = 'dayTrader';
    else if (stats.tradingFrequency > 0.5) style = 'swingTrader';

    const topMethods = Object.entries(stats.methods)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([method, count]) => ({ method, count }));

    return {
      style,
      stats,
      topMethods,
      riskLevel: this.calculateRiskLevel(stats),
    };
  }

  calculateRiskLevel(stats) {
    if (stats.tradingFrequency > 10 || stats.total > 1000) return 'high';
    if (stats.tradingFrequency > 3 || stats.total > 100) return 'medium';
    return 'low';
  }

  /**
   * 从 DB 加载钱包的链上交易
   */
  async getWalletTransactionsFromDB(address) {
    const [rows] = await this.db.execute(
      "SELECT * FROM transactions WHERE wallet_address = ? AND source = 'chain' ORDER BY timestamp DESC LIMIT 100",
      [address.toLowerCase()]
    );
    return rows;
  }
}

module.exports = { WalletAnalyzer, RPC_CONFIG };
