/**
 * Oracle-X API 测试套件
 */

const assert = require('assert');

/**
 * API 测试
 */
async function testAPI() {
  console.log('【API 测试】\n');
  console.log('======================================');
  console.log('     Oracle-X API 测试');
  console.log('======================================\n');

  const baseUrl = 'http://localhost:3000/api';
  let passed = 0;
  let failed = 0;

  // 1. 配置状态 API
  try {
    const res = await fetch(`${baseUrl}/config-status`);
    const data = await res.json();
    assert.strictEqual(data.aiApiKeyConfigured, true, 'AI Key 应已配置');
    console.log('✅ 配置状态 API');
    passed++;
  } catch (err) {
    console.log('❌ 配置状态 API:', err.message);
    failed++;
  }

  // 2. 决策 API - 正常交易
  try {
    const res = await fetch(`${baseUrl}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: 'BTCUSDT',
        direction: 'LONG',
        marketData: { price: 50000, change24h: 2.5 }
      })
    });
    const data = await res.json();
    assert(data.decision, '应有决策结果');
    console.log('✅ 决策 API (正常交易)');
    passed++;
  } catch (err) {
    console.log('❌ 决策 API:', err.message);
    failed++;
  }

  // 3. 决策 API - 高波动
  try {
    const res = await fetch(`${baseUrl}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: 'ETHUSDT',
        direction: 'LONG',
        marketData: { price: 3000, change24h: 15 }
      })
    });
    const data = await res.json();
    assert(data.decision, '应有决策结果');
    console.log('✅ 决策 API (高波动)');
    passed++;
  } catch (err) {
    console.log('❌ 决策 API (高波动):', err.message);
    failed++;
  }

  // 4. 决策日志 API
  try {
    const res = await fetch(`${baseUrl}/decision-log?limit=5`);
    const data = await res.json();
    assert(Array.isArray(data.items), '应有日志数组');
    console.log('✅ 决策日志 API');
    passed++;
  } catch (err) {
    console.log('❌ 决策日志 API:', err.message);
    failed++;
  }

  // 5. 市场数据 API
  try {
    const res = await fetch(`${baseUrl}/market?symbol=BTCUSDT`);
    const data = await res.json();
    assert(data.symbol, '应有交易对数据');
    console.log('✅ 市场数据 API');
    passed++;
  } catch (err) {
    console.log('❌ 市场数据 API:', err.message);
    failed++;
  }

  // 6. K线 API
  try {
    const res = await fetch(`${baseUrl}/klines?symbol=BTCUSDT&interval=1h&limit=10`);
    const data = await res.json();
    assert(Array.isArray(data), '应有K线数据');
    console.log('✅ K线 API');
    passed++;
  } catch (err) {
    console.log('❌ K线 API:', err.message);
    failed++;
  }

  console.log('\n======================================');
  console.log(`结果: ${passed}/${passed + failed} 通过`);
  console.log('======================================\n');

  return failed === 0;
}

/**
 * 桌面端功能测试
 */
async function testDesktop() {
  console.log('【桌面端测试】\n');
  console.log('======================================');
  console.log('     Oracle-X Desktop 测试');
  console.log('======================================\n');

  let passed = 0;
  let failed = 0;

  // 检查进程
  try {
    const { execSync } = require('child_process');
    const output = execSync('ps aux | grep -i electron | grep -v grep', { encoding: 'utf-8' });
    if (output.includes('Electron')) {
      console.log('✅ Electron 进程运行中');
      passed++;
    } else {
      console.log('❌ Electron 进程未运行');
      failed++;
    }
  } catch (err) {
    console.log('❌ 进程检查失败:', err.message);
    failed++;
  }

  // 检查数据目录
  try {
    const fs = require('fs');
    const path = require('path');
    const dataDir = path.join(process.env.HOME || '', 'Library/Application Support/oracle-x-desktop');
    if (fs.existsSync(dataDir)) {
      console.log('✅ 应用数据目录存在');
      passed++;
    } else {
      console.log('❌ 应用数据目录不存在');
      failed++;
    }
  } catch (err) {
    console.log('❌ 数据目录检查失败:', err.message);
    failed++;
  }

  console.log('\n======================================');
  console.log(`结果: ${passed}/${passed + failed} 通过`);
  console.log('======================================\n');

  return failed === 0;
}

/**
 * 主入口
 */
async function main() {
  console.log('\n');

  let allPassed = true;

  if (!(await testAPI())) allPassed = false;
  if (!(await testDesktop())) allPassed = false;

  console.log('======================================');
  if (allPassed) {
    console.log('🎉 所有测试通过!');
  } else {
    console.log('❌ 有测试失败');
    process.exit(1);
  }
  console.log('======================================\n');
}

main().catch(console.error);
