# 测试数据说明

## 目录结构

```
test_data/
├── binance_test.csv   # 币安交易记录 (15笔)
├── okx_test.csv      # 欧易交易记录 (15笔)
└── ashares_test.csv  # A股交易记录 (15笔)
```

## 测试结果

### 用户画像分析

| 指标 | 数值 |
|------|------|
| 总交易次数 | 45 笔 |
| 总交易额 | 876万 USDT |
| 交易风格 | 投资者 (investor) |
| 风险等级 | 低 |

### 支持的格式

- **Binance**: Date, Pair, Side, Price, Executed, Amount, Fee
- **OKX**: Time, InstID, Side, Px, Sz, Fee
- **A股**: 交易日期, 股票代码, 股票名称, 买卖方向, 成交价格, 成交数量, 成交金额, 手续费
- **通用**: 自动检测列名

## 运行测试

```bash
node -e "
const { EnhancedCSVImporter } = require('./desktop/csv-importer.js');
const importer = new EnhancedCSVImporter();
importer.parseCSV('./test_data/binance_test.csv').then(console.log);
"
```
