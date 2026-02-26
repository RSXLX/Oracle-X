# Oracle-X 测试文档

## 运行测试

```bash
# 单元测试
node tests/index.js

# API 测试
node tests/api.js

# 所有测试
npm test
```

## 测试覆盖

| 模块 | 测试数 | 状态 |
|------|--------|------|
| CSV 导入器 | 4 | ✅ |
| 风险引擎 | 3 | ✅ |
| 钱包分析器 | 3 | ✅ |
| 数据导出器 | 3 | ✅ |

## 测试数据

```bash
# 测试数据位于
test_data/
├── binance_test.csv   # 币安
├── okx_test.csv      # 欧易
└── ashares_test.csv  # A股
```

## 示例

```bash
# 测试 CSV 导入
node -e "
const { EnhancedCSVImporter } = require('./desktop/csv-importer.js');
const importer = new EnhancedCSVImporter();
importer.parseCSV('./test_data/binance_test.csv').then(r => console.log(r));
"
```
