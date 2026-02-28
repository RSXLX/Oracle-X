/**
 * 钱包信息获取 & 动向分析模拟脚本
 * 目标钱包: 0xc14354FD30215d4177dAe9c386f6E9338240D453
 */

const WALLET = '0xc14354FD30215d4177dAe9c386f6E9338240D453';
const RPC_URL = 'https://ethereum-mainnet.g.allthatnode.com/full/evm/0d35aeffdccb405fb831f6539c284afd';
const ETHERSCAN_API = 'https://api.etherscan.io/v2/api?chainid=1';

// ==================== 工具函数 ====================

async function rpcCall(method, params = []) {
    const res = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
    });
    const data = await res.json();
    if (data.error) throw new Error(`RPC error: ${data.error.message}`);
    return data.result;
}

function weiToEth(weiHex) {
    return parseInt(weiHex, 16) / 1e18;
}

function formatEth(val) {
    return val.toFixed(6) + ' ETH';
}

// ==================== Step 1: 基础信息 ====================

async function fetchBasicInfo() {
    console.log('='.repeat(60));
    console.log('📊 Step 1: 获取钱包基础信息');
    console.log('='.repeat(60));
    console.log(`🔗 地址: ${WALLET}`);
    console.log(`⛓️  链: Ethereum Mainnet`);

    const [balanceHex, txCountHex, codeHex] = await Promise.all([
        rpcCall('eth_getBalance', [WALLET, 'latest']),
        rpcCall('eth_getTransactionCount', [WALLET, 'latest']),
        rpcCall('eth_getCode', [WALLET, 'latest']),
    ]);

    const balance = weiToEth(balanceHex);
    const txCount = parseInt(txCountHex, 16);
    const isContract = codeHex && codeHex !== '0x';

    console.log(`💰 ETH 余额: ${formatEth(balance)}`);
    console.log(`📝 Nonce (发出交易数): ${txCount}`);
    console.log(`📋 地址类型: ${isContract ? '合约地址 (Contract)' : '外部账户 (EOA)'}`);

    return { balance, txCount, isContract };
}

// ==================== Step 2: 交易记录 (Etherscan) ====================

async function fetchTransactions() {
    console.log('\n' + '='.repeat(60));
    console.log('📜 Step 2: 获取最近交易记录 (Etherscan API)');
    console.log('='.repeat(60));

    const url = `${ETHERSCAN_API}&module=account&action=txlist&address=${WALLET}&startblock=0&endblock=99999999&page=1&offset=25&sort=desc&apikey=`;

    try {
        const res = await fetch(url);
        const data = await res.json();

        if (data.status !== '1' || !Array.isArray(data.result)) {
            console.log(`⚠️  Etherscan 返回: ${data.message} — ${typeof data.result === 'string' ? data.result : ''}`);
            console.log('   尝试使用 RPC 扫描...');
            return await fetchTransactionsViaRPC();
        }

        const txs = data.result.map(tx => ({
            hash: tx.hash,
            from: tx.from.toLowerCase(),
            to: (tx.to || '').toLowerCase(),
            value: parseFloat(tx.value) / 1e18,
            gasUsed: parseFloat(tx.gasUsed) * parseFloat(tx.gasPrice) / 1e18,
            timestamp: new Date(parseInt(tx.timeStamp) * 1000),
            blockNumber: parseInt(tx.blockNumber),
            isIncoming: tx.to?.toLowerCase() === WALLET.toLowerCase(),
            method: tx.functionName?.split('(')[0] || (tx.input === '0x' ? 'transfer' : 'contract_call'),
            isError: tx.isError === '1',
        }));

        console.log(`✅ 获取到 ${txs.length} 条交易记录\n`);
        printTransactions(txs);
        return txs;
    } catch (err) {
        console.log(`❌ Etherscan API 错误: ${err.message}`);
        console.log('   回退到 RPC 扫描...');
        return await fetchTransactionsViaRPC();
    }
}

async function fetchTransactionsViaRPC() {
    console.log('🔍 使用 RPC 扫描最近区块...');
    const latestBlockHex = await rpcCall('eth_blockNumber', []);
    const latestBlock = parseInt(latestBlockHex, 16);
    console.log(`   当前最新区块: ${latestBlock}`);

    const txs = [];
    const addr = WALLET.toLowerCase();
    const step = 1;
    const maxBlocks = 200;

    for (let b = latestBlock; b > latestBlock - maxBlocks && txs.length < 10; b -= step) {
        try {
            const blockData = await rpcCall('eth_getBlockByNumber', ['0x' + b.toString(16), true]);
            if (blockData?.transactions) {
                for (const tx of blockData.transactions) {
                    if (tx.from?.toLowerCase() === addr || tx.to?.toLowerCase() === addr) {
                        txs.push({
                            hash: tx.hash,
                            from: tx.from?.toLowerCase() || '',
                            to: tx.to?.toLowerCase() || '',
                            value: parseInt(tx.value, 16) / 1e18,
                            gasUsed: parseInt(tx.gas, 16) * parseInt(tx.gasPrice || '0', 16) / 1e18,
                            timestamp: new Date(parseInt(blockData.timestamp, 16) * 1000),
                            blockNumber: parseInt(tx.blockNumber, 16),
                            isIncoming: tx.to?.toLowerCase() === addr,
                            method: tx.input === '0x' ? 'transfer' : 'contract_call',
                            isError: false,
                        });
                    }
                }
            }
        } catch (e) { /* skip */ }
    }

    console.log(`   RPC 扫描到 ${txs.length} 条交易`);
    if (txs.length) printTransactions(txs);
    return txs;
}

function printTransactions(txs) {
    for (const tx of txs.slice(0, 15)) {
        const dir = tx.isIncoming ? '⬅️  IN ' : '➡️  OUT';
        const val = tx.value.toFixed(6);
        const date = tx.timestamp.toISOString().slice(0, 19).replace('T', ' ');
        const err = tx.isError ? ' ❌FAIL' : '';
        const counterparty = tx.isIncoming
            ? `from ${tx.from.slice(0, 8)}...${tx.from.slice(-4)}`
            : `to   ${(tx.to || 'Contract Creation').slice(0, 8)}...${(tx.to || '').slice(-4)}`;
        console.log(`  ${dir} | ${date} | ${val.padStart(14)} ETH | ${tx.method.padEnd(20)} | ${counterparty}${err}`);
    }
    if (txs.length > 15) console.log(`  ... 还有 ${txs.length - 15} 条交易`);
}

// ==================== Step 3: ERC-20 Token 交易 ====================

async function fetchTokenTransfers() {
    console.log('\n' + '='.repeat(60));
    console.log('🪙 Step 3: 获取 ERC-20 Token 转账记录');
    console.log('='.repeat(60));

    const url = `${ETHERSCAN_API}&module=account&action=tokentx&address=${WALLET}&page=1&offset=20&sort=desc&apikey=`;

    try {
        const res = await fetch(url);
        const data = await res.json();

        if (data.status !== '1' || !Array.isArray(data.result)) {
            console.log(`⚠️  Token 交易查询: ${data.message} — ${typeof data.result === 'string' ? data.result : '无数据'}`);
            return [];
        }

        const tokens = data.result.map(tx => ({
            hash: tx.hash,
            tokenName: tx.tokenName,
            tokenSymbol: tx.tokenSymbol,
            tokenDecimal: parseInt(tx.tokenDecimal),
            from: tx.from.toLowerCase(),
            to: tx.to.toLowerCase(),
            value: parseFloat(tx.value) / Math.pow(10, parseInt(tx.tokenDecimal)),
            timestamp: new Date(parseInt(tx.timeStamp) * 1000),
            isIncoming: tx.to.toLowerCase() === WALLET.toLowerCase(),
        }));

        console.log(`✅ 获取到 ${tokens.length} 条 Token 转账\n`);

        for (const tx of tokens.slice(0, 15)) {
            const dir = tx.isIncoming ? '⬅️  IN ' : '➡️  OUT';
            const date = tx.timestamp.toISOString().slice(0, 19).replace('T', ' ');
            const val = tx.value.toFixed(4);
            console.log(`  ${dir} | ${date} | ${val.padStart(16)} ${tx.tokenSymbol.padEnd(8)} | ${tx.tokenName}`);
        }

        return tokens;
    } catch (err) {
        console.log(`❌ Token 查询错误: ${err.message}`);
        return [];
    }
}

// ==================== Step 4: 内部交易 ====================

async function fetchInternalTxs() {
    console.log('\n' + '='.repeat(60));
    console.log('🔄 Step 4: 获取内部交易 (Internal Transactions)');
    console.log('='.repeat(60));

    const url = `${ETHERSCAN_API}&module=account&action=txlistinternal&address=${WALLET}&startblock=0&endblock=99999999&page=1&offset=15&sort=desc&apikey=`;

    try {
        const res = await fetch(url);
        const data = await res.json();

        if (data.status !== '1' || !Array.isArray(data.result)) {
            console.log(`⚠️  内部交易查询: ${data.message} — ${typeof data.result === 'string' ? data.result : '无数据'}`);
            return [];
        }

        console.log(`✅ 获取到 ${data.result.length} 条内部交易\n`);

        for (const tx of data.result.slice(0, 10)) {
            const value = parseFloat(tx.value) / 1e18;
            const dir = tx.to.toLowerCase() === WALLET.toLowerCase() ? '⬅️  IN ' : '➡️  OUT';
            const date = new Date(parseInt(tx.timeStamp) * 1000).toISOString().slice(0, 19).replace('T', ' ');
            console.log(`  ${dir} | ${date} | ${value.toFixed(6).padStart(14)} ETH | type: ${tx.type || 'call'}`);
        }

        return data.result;
    } catch (err) {
        console.log(`❌ 内部交易查询错误: ${err.message}`);
        return [];
    }
}

// ==================== Step 5: 综合分析 ====================

function analyzeWallet(basicInfo, txs, tokenTxs, internalTxs) {
    console.log('\n' + '='.repeat(60));
    console.log('🧠 Step 5: 钱包动向综合分析');
    console.log('='.repeat(60));

    if (!txs.length && !tokenTxs.length) {
        console.log('⚠️  数据不足，无法进行深度分析');
        return;
    }

    // --- 交易统计 ---
    console.log('\n📈 交易统计:');
    const totalIn = txs.filter(t => t.isIncoming).reduce((s, t) => s + t.value, 0);
    const totalOut = txs.filter(t => !t.isIncoming).reduce((s, t) => s + t.value, 0);
    const totalGas = txs.reduce((s, t) => s + (t.gasUsed || 0), 0);
    const failedTxs = txs.filter(t => t.isError).length;

    console.log(`   总流入: ${formatEth(totalIn)}`);
    console.log(`   总流出: ${formatEth(totalOut)}`);
    console.log(`   净流量: ${formatEth(totalIn - totalOut)}`);
    console.log(`   Gas 消耗: ${formatEth(totalGas)}`);
    console.log(`   失败交易: ${failedTxs} / ${txs.length}`);

    // --- 时间分析 ---
    if (txs.length > 1) {
        console.log('\n⏰ 活跃时段分析:');
        const hourBuckets = {};
        const dayBuckets = {};
        const monthBuckets = {};

        for (const tx of txs) {
            const h = tx.timestamp.getHours();
            hourBuckets[h] = (hourBuckets[h] || 0) + 1;

            const dayKey = tx.timestamp.toISOString().slice(0, 10);
            dayBuckets[dayKey] = (dayBuckets[dayKey] || 0) + 1;

            const monthKey = tx.timestamp.toISOString().slice(0, 7);
            monthBuckets[monthKey] = (monthBuckets[monthKey] || 0) + 1;
        }

        const peakHour = Object.entries(hourBuckets).sort((a, b) => b[1] - a[1])[0];
        const activeDays = Object.keys(dayBuckets).length;
        const firstTx = txs[txs.length - 1].timestamp;
        const lastTx = txs[0].timestamp;
        const spanDays = Math.max(1, (lastTx - firstTx) / (86400 * 1000));

        console.log(`   活跃天数: ${activeDays} 天`);
        console.log(`   时间跨度: ${firstTx.toISOString().slice(0, 10)} → ${lastTx.toISOString().slice(0, 10)} (${Math.round(spanDays)} 天)`);
        console.log(`   日均交易: ${(txs.length / spanDays).toFixed(2)} 笔`);
        if (peakHour) console.log(`   高峰时段: ${peakHour[0]}:00 UTC (${peakHour[1]} 笔)`);

        console.log('\n   月度交易分布:');
        for (const [month, count] of Object.entries(monthBuckets).sort()) {
            const bar = '█'.repeat(Math.min(count, 40));
            console.log(`   ${month} | ${bar} ${count}`);
        }
    }

    // --- 交互方法分析 ---
    console.log('\n🔧 合约交互分析:');
    const methodCounts = {};
    for (const tx of txs) {
        methodCounts[tx.method] = (methodCounts[tx.method] || 0) + 1;
    }
    const topMethods = Object.entries(methodCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    for (const [method, count] of topMethods) {
        const pct = ((count / txs.length) * 100).toFixed(1);
        console.log(`   ${method.padEnd(30)} ${count} 次 (${pct}%)`);
    }

    // --- Token 持仓分析 ---
    if (tokenTxs.length) {
        console.log('\n🪙 Token 活动分析:');
        const tokenStats = {};
        for (const tx of tokenTxs) {
            if (!tokenStats[tx.tokenSymbol]) {
                tokenStats[tx.tokenSymbol] = { name: tx.tokenName, in: 0, out: 0, inCount: 0, outCount: 0 };
            }
            if (tx.isIncoming) {
                tokenStats[tx.tokenSymbol].in += tx.value;
                tokenStats[tx.tokenSymbol].inCount += 1;
            } else {
                tokenStats[tx.tokenSymbol].out += tx.value;
                tokenStats[tx.tokenSymbol].outCount += 1;
            }
        }

        for (const [symbol, s] of Object.entries(tokenStats)) {
            console.log(`   ${symbol} (${s.name}):`);
            console.log(`     流入: ${s.in.toFixed(4)} (${s.inCount} 笔) | 流出: ${s.out.toFixed(4)} (${s.outCount} 笔)`);
        }
    }

    // --- 交易对手分析 ---
    console.log('\n🤝 高频交互地址 (Top 5):');
    const counterparties = {};
    const addrLower = WALLET.toLowerCase();
    for (const tx of txs) {
        const cp = tx.isIncoming ? tx.from : tx.to;
        if (cp && cp !== addrLower) {
            if (!counterparties[cp]) counterparties[cp] = { count: 0, totalValue: 0 };
            counterparties[cp].count += 1;
            counterparties[cp].totalValue += tx.value;
        }
    }
    const topCPs = Object.entries(counterparties).sort((a, b) => b[1].count - a[1].count).slice(0, 5);
    for (const [addr, info] of topCPs) {
        console.log(`   ${addr.slice(0, 10)}...${addr.slice(-4)} | ${info.count} 次 | ${formatEth(info.totalValue)}`);
    }

    // --- 风险/风格评估 ---
    console.log('\n🎯 钱包画像:');
    const freq = txs.length / Math.max(1, Object.keys(txs.reduce((acc, t) => {
        acc[t.timestamp.toISOString().slice(0, 10)] = 1; return acc;
    }, {})).length);

    let style, riskLevel;
    if (freq > 10) { style = '高频交易者 (Degen)'; riskLevel = '高'; }
    else if (freq > 3) { style = '日内交易者 (Day Trader)'; riskLevel = '中'; }
    else if (freq > 0.5) { style = '波段交易者 (Swing Trader)'; riskLevel = '中低'; }
    else { style = '长线投资者 (Hodler)'; riskLevel = '低'; }

    const hasDeFi = topMethods.some(([m]) => ['swap', 'addLiquidity', 'removeLiquidity', 'deposit', 'withdraw', 'stake', 'claim'].includes(m));
    const hasNFT = topMethods.some(([m]) => ['mint', 'safeTransferFrom', 'setApprovalForAll'].includes(m));

    console.log(`   交易风格: ${style}`);
    console.log(`   日均频率: ${freq.toFixed(2)} 笔/天`);
    console.log(`   风险等级: ${riskLevel}`);
    console.log(`   DeFi 活跃: ${hasDeFi ? '✅ 是' : '❌ 否'}`);
    console.log(`   NFT 活跃: ${hasNFT ? '✅ 是' : '❌ 否'}`);
    console.log(`   余额: ${formatEth(basicInfo.balance)}`);
    console.log(`   累计发送交易: ${basicInfo.txCount} 笔`);
}

// ==================== 主流程 ====================

async function main() {
    console.log('🚀 Oracle-X 钱包分析模拟');
    console.log(`📅 执行时间: ${new Date().toISOString()}`);
    console.log(`🎯 目标钱包: ${WALLET}\n`);

    try {
        const basicInfo = await fetchBasicInfo();
        const txs = await fetchTransactions();
        const tokenTxs = await fetchTokenTransfers();
        const internalTxs = await fetchInternalTxs();
        analyzeWallet(basicInfo, txs, tokenTxs, internalTxs);

        console.log('\n' + '='.repeat(60));
        console.log('✅ 分析完成');
        console.log('='.repeat(60));
    } catch (err) {
        console.error(`\n❌ 致命错误: ${err.message}`);
        console.error(err.stack);
    }
}

main();
