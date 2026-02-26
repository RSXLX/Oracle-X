/**
 * Oracle-X 钱包交易记录模块
 * 支持 ETH/BSC/SOL 钱包交互记录
 */

const WALLET_SUPPORT = {
  ethereum: {
    name: 'Ethereum',
    symbol: 'ETH',
    chainId: 1,
    api: 'https://api.etherscan.io/api',
  },
  bsc: {
    name: 'BNB Smart Chain',
    symbol: 'BNB',
    chainId: 56,
    api: 'https://api.bscscan.com/api',
  },
  polygon: {
    name: 'Polygon',
    symbol: 'MATIC',
    chainId: 137,
    api: 'https://api.polygonscan.com/api',
  },
  arbitrum: {
    name: 'Arbitrum',
    symbol: 'ETH',
    chainId: 42161,
    api: 'https://api.arbiscan.io/api',
  },
  solana: {
    name: 'Solana',
    symbol: 'SOL',
    chainId: 'solana',
    api: 'https://api.solscan.io',
  },
};

/**
 * 钱包交易记录分析器
 */
class WalletAnalyzer {
  constructor() {
    this.wallets = new Map(); // address -> wallet info
    this.apiKeys = {}; // chain -> API key
  }

  /**
   * 添加钱包
   */
  addWallet(address, chain = 'ethereum', label = '') {
    const normalizedAddr = address.toLowerCase().trim();
    
    this.wallets.set(normalizedAddr, {
      address: normalizedAddr,
      chain,
      label: label || `Wallet ${this.wallets.size + 1}`,
      addedAt: new Date().toISOString(),
      transactions: [],
    });
    
    return normalizedAddr;
  }

  /**
   * 移除钱包
   */
  removeWallet(address) {
    return this.wallets.delete(address.toLowerCase().trim());
  }

  /**
   * 获取所有钱包
   */
  getWallets() {
    return Array.from(this.wallets.values());
  }

  /**
   * 配置 API Key
   */
  setApiKey(chain, apiKey) {
    this.apiKeys[chain] = apiKey;
  }

  /**
   * 获取钱包交易记录
   */
  async fetchTransactions(walletAddress, chain = 'ethereum', limit = 50) {
    const normalizedAddr = walletAddress.toLowerCase().trim();
    const config = WALLET_SUPPORT[chain];
    
    if (!config) {
      throw new Error(`Unsupported chain: ${chain}`);
    }

    try {
      let transactions = [];
      
      switch (chain) {
        case 'ethereum':
        case 'bsc':
        case 'polygon':
        case 'arbitrum':
          transactions = await this.fetchEVMTransactions(normalizedAddr, config, limit);
          break;
        case 'solana':
          transactions = await this.fetchSolanaTransactions(normalizedAddr, limit);
          break;
      }
      
      // 更新本地存储
      const wallet = this.wallets.get(normalizedAddr);
      if (wallet) {
        wallet.transactions = transactions;
        wallet.lastUpdated = new Date().toISOString();
      }
      
      return transactions;
    } catch (err) {
      console.error('[WalletAnalyzer] Fetch error:', err.message);
      return [];
    }
  }

  /**
   * 获取 EVM 链交易
   */
  async fetchEVMTransactions(address, config, limit) {
    const apiKey = this.apiKeys[config.chainId] || '';
    const url = `${config.apiKey}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=${limit}&sort=desc&apikey=${apiKey}`;
    
    try {
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.status !== '1') {
        console.warn('[WalletAnalyzer] API error:', data.message);
        return [];
      }
      
      return data.result.map(tx => ({
        hash: tx.hash,
        from: tx.from.toLowerCase(),
        to: tx.to?.toLowerCase() || '',
        value: parseFloat(tx.value) / 1e18, // 转为 ETH
        gas: parseFloat(tx.gasUsed) * parseFloat(tx.gasPrice) / 1e18,
        timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
        chain: config.name,
        symbol: config.symbol,
        isIncoming: tx.to.toLowerCase() === address.toLowerCase(),
      }));
    } catch (err) {
      console.error('[WalletAnalyzer] EVM fetch error:', err.message);
      return [];
    }
  }

  /**
   * 获取 Solana 交易
   */
  async fetchSolanaTransactions(address, limit) {
    try {
      const res = await fetch(`${WALLET_SUPPORT.solana.api}/account/transaction?address=${address}&limit=${limit}`, {
        headers: { 'Accept': 'application/json' }
      });
      
      if (!res.ok) return [];
      
      const data = await res.json();
      
      return (data.data || []).map(tx => ({
        hash: tx.txHash,
        from: tx.sender || '',
        to: tx.receiver || '',
        value: (tx.amount || 0) / 1e9, // SOL
        fee: (tx.fee || 0) / 1e9,
        timestamp: new Date(tx.blockTime * 1000).toISOString(),
        chain: 'Solana',
        symbol: 'SOL',
        isIncoming: tx.receiver === address,
      }));
    } catch (err) {
      console.error('[WalletAnalyzer] Solana fetch error:', err.message);
      return [];
    }
  }

  /**
   * 分析交易习惯
   */
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
    };

    for (const tx of transactions) {
      if (tx.isIncoming) {
        stats.totalReceived += tx.value;
      } else {
        stats.totalSent += tx.value;
      }
      stats.gasFees += tx.gas || 0;

      const date = new Date(tx.timestamp);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const dayKey = date.toDateString();

      stats.byMonth[monthKey] = (stats.byMonth[monthKey] || 0) + 1;
      stats.byDay[dayKey] = (stats.byDay[dayKey] || 0) + 1;
    }

    stats.avgTxValue = (stats.totalReceived + stats.totalSent) / stats.total;
    
    // 交易频率
    const days = new Set(transactions.map(t => new Date(t.timestamp).toDateString())).size;
    stats.tradingFrequency = transactions.length / Math.max(1, days);

    // 交易风格
    let style = 'investor';
    if (stats.tradingFrequency > 10) style = 'degen';
    else if (stats.tradingFrequency > 3) style = 'dayTrader';
    else if (stats.tradingFrequency > 0.5) style = 'swingTrader';

    return {
      style,
      stats,
      riskLevel: this.calculateRiskLevel(stats),
    };
  }

  /**
   * 计算风险等级
   */
  calculateRiskLevel(stats) {
    if (stats.tradingFrequency > 10 || stats.total > 1000) return 'high';
    if (stats.tradingFrequency > 3 || stats.total > 100) return 'medium';
    return 'low';
  }
}

module.exports = { WalletAnalyzer, WALLET_SUPPORT };
