/**
 * Oracle-X 测试套件
 * 包含单元测试、集成测试和 E2E 测试
 */

const assert = require('assert');

/**
 * 测试工具类
 */
class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  /**
   * 添加测试
   */
  add(name, fn) {
    this.tests.push({ name, fn });
  }

  /**
   * 运行测试
   */
  async run() {
    console.log('======================================');
    console.log('     Oracle-X 测试套件');
    console.log('======================================\n');

    for (const test of this.tests) {
      try {
        await test.fn();
        this.passed++;
        console.log(`✅ ${test.name}`);
      } catch (err) {
        this.failed++;
        console.log(`❌ ${test.name}`);
        console.log(`   Error: ${err.message}`);
      }
    }

    console.log('\n======================================');
    console.log(`结果: ${this.passed}/${this.passed + this.failed} 通过`);
    console.log('======================================');

    return this.failed === 0;
  }
}

/**
 * CSV 导入器测试
 */
function testCSVImporter() {
  const runner = new TestRunner();
  
  runner.add('CSVImporter - Binance 格式检测', async () => {
    const { EnhancedCSVImporter } = require('../desktop/csv-importer.js');
    const importer = new EnhancedCSVImporter();
    const result = await importer.parseCSV('./test_data/binance_test.csv');
    assert.strictEqual(result.format, 'Binance', '应识别为 Binance');
    assert(result.transactions.length > 0, '应有交易记录');
  });

  runner.add('CSVImporter - OKX 格式检测', async () => {
    const { EnhancedCSVImporter } = require('../desktop/csv-importer.js');
    const importer = new EnhancedCSVImporter();
    const result = await importer.parseCSV('./test_data/okx_test.csv');
    assert.strictEqual(result.format, 'OKX', '应识别为 OKX');
  });

  runner.add('CSVImporter - 交易数据解析', async () => {
    const { EnhancedCSVImporter } = require('../desktop/csv-importer.js');
    const importer = new EnhancedCSVImporter();
    const result = await importer.parseCSV('./test_data/binance_test.csv');
    const tx = result.transactions[0];
    assert(tx.symbol, '应有交易对');
    assert(tx.price > 0, '价格应大于0');
  });

  runner.add('CSVImporter - 交易习惯分析', async () => {
    const { EnhancedCSVImporter } = require('../desktop/csv-importer.js');
    const importer = new EnhancedCSVImporter();
    const result = await importer.parseCSV('./test_data/binance_test.csv');
    const analysis = importer.analyzePattern(result.transactions);
    assert(analysis.style, '应有交易风格');
    assert(analysis.stats.totalTrades > 0, '应有交易次数');
  });

  return runner.run();
}

/**
 * 风险引擎测试
 */
function testRiskEngine() {
  const runner = new TestRunner();

  runner.add('RiskEngine - 低风险评估', async () => {
    const { RiskEngine } = require('../desktop/risk-engine.js');
    const engine = new RiskEngine();
    const analysis = {
      stats: {
        totalTrades: 10,
        uniqueSymbols: 5,
        categoryBreakdown: { layer1: 10 }
      },
      topSymbols: [
        { symbol: 'BTC', trades: 5, volume: 50000 }
      ]
    };
    const risk = engine.assessRisk(analysis);
    assert(risk.riskLevel === 'low', '应为低风险');
  });

  runner.add('RiskEngine - 高风险评估', async () => {
    const { RiskEngine } = require('../desktop/risk-engine.js');
    const engine = new RiskEngine();
    const analysis = {
      stats: {
        totalTrades: 1000,
        uniqueSymbols: 1,
        categoryBreakdown: { meme: 800 }
      },
      topSymbols: [
        { symbol: 'PEPE', trades: 800, volume: 1000 }
      ]
    };
    const risk = engine.assessRisk(analysis);
    assert(risk.riskLevel === 'high' || risk.riskLevel === 'critical', '应为高风险');
  });

  runner.add('RiskEngine - 建议生成', async () => {
    const { RiskEngine } = require('../desktop/risk-engine.js');
    const engine = new RiskEngine();
    const analysis = {
      stats: { totalTrades: 1000, uniqueSymbols: 1, categoryBreakdown: {} },
      topSymbols: []
    };
    const risk = engine.assessRisk(analysis);
    assert(Array.isArray(risk.recommendations), '应有建议列表');
  });

  return runner.run();
}

/**
 * 钱包分析器测试
 */
function testWalletAnalyzer() {
  const runner = new TestRunner();

  runner.add('WalletAnalyzer - 添加钱包', () => {
    const { WalletAnalyzer } = require('../desktop/wallet-analyzer.js');
    const analyzer = new WalletAnalyzer();
    const addr = analyzer.addWallet('0x1234567890abcdef', 'ethereum', 'Test');
    assert(addr, '应返回钱包地址');
    assert(analyzer.getWallets().length === 1, '应有1个钱包');
  });

  runner.add('WalletAnalyzer - 移除钱包', () => {
    const { WalletAnalyzer } = require('../desktop/wallet-analyzer.js');
    const analyzer = new WalletAnalyzer();
    analyzer.addWallet('0x123', 'ethereum');
    const removed = analyzer.removeWallet('0x123');
    assert(removed === true, '应返回true');
    assert(analyzer.getWallets().length === 0, '应无钱包');
  });

  runner.add('WalletAnalyzer - 交易模式分析', () => {
    const { WalletAnalyzer } = require('../desktop/wallet-analyzer.js');
    const analyzer = new WalletAnalyzer();
    const txs = [
      { timestamp: '2026-02-26T10:00:00Z', value: 1, isIncoming: true },
      { timestamp: '2026-02-26T11:00:00Z', value: 0.5, isIncoming: false },
    ];
    const result = analyzer.analyzePattern(txs);
    assert(result.stats.total === 2, '应有2笔交易');
  });

  return runner.run();
}

/**
 * 数据导出器测试
 */
function testDataExporter() {
  const runner = new TestRunner();

  runner.add('DataExporter - JSON 导出', () => {
    const { DataExporter } = require('../desktop/data-exporter.js');
    const exporter = new DataExporter();
    const data = [{ symbol: 'BTC', price: 50000 }];
    const result = exporter.exportTransactions(data, 'json');
    assert(result.content.includes('BTC'), '应包含BTC');
  });

  runner.add('DataExporter - CSV 导出', () => {
    const { DataExporter } = require('../desktop/data-exporter.js');
    const exporter = new DataExporter();
    const data = [{ symbol: 'BTC', price: 50000, timestamp: '2026-01-01' }];
    const result = exporter.exportTransactions(data, 'csv');
    assert(result.content.includes('BTC'), '应包含BTC');
    assert(result.content.includes('时间'), '应包含时间列');
  });

  runner.add('DataExporter - Markdown 导出', () => {
    const { DataExporter } = require('../desktop/data-exporter.js');
    const exporter = new DataExporter();
    const data = [{ symbol: 'ETH', price: 3000 }];
    const result = exporter.exportTransactions(data, 'markdown');
    assert(result.content.includes('#'), '应为Markdown格式');
  });

  return runner.run();
}

/**
 * 主测试入口
 */
async function main() {
  console.log('\n');

  let allPassed = true;

  console.log('【1. CSV 导入器测试】\n');
  if (!(await testCSVImporter())) allPassed = false;

  console.log('\n【2. 风险引擎测试】\n');
  if (!(await testRiskEngine())) allPassed = false;

  console.log('\n【3. 钱包分析器测试】\n');
  if (!(await testWalletAnalyzer())) allPassed = false;

  console.log('\n【4. 数据导出器测试】\n');
  if (!(await testDataExporter())) allPassed = false;

  console.log('\n======================================');
  if (allPassed) {
    console.log('🎉 所有测试通过!');
  } else {
    console.log('❌ 有测试失败');
    process.exit(1);
  }
  console.log('======================================\n');
}

main().catch(console.error);
