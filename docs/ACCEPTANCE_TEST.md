# Oracle-X 操作验收文档

> **验收日期**：2026-02-27
> **验收范围**：批次 1-5 全部变更（代理环境变量化、Extension 设置页、3 个新 API、文档对齐、Desktop 验证）

---

## 一、环境检查

### 1.1 Node.js 环境
```bash
node --version   # 期望：v20+ 
npm --version    # 期望：v9+
```

### 1.2 Web App 依赖
```bash
cd /Users/hmwz/AI项目/Oracle-X
ls node_modules/.package-lock.json  # 应存在
```

### 1.3 Desktop 依赖
```bash
ls desktop/node_modules/.package-lock.json  # 应存在
```

### 1.4 环境变量
```bash
cat .env.local
```
- [ ] `STEP_API_KEY` 已配置
- [ ] `AI_BASE_URL` 已配置
- [ ] `AI_MODEL` 已配置
- [ ] `HTTP_PROXY` 已配置（如需代理），或留空（直连 Binance）

---

## 二、代码质量门禁

```bash
# 在项目根目录执行
npm run type-check   # TypeScript 类型检查
npm run build        # 构建
npm run lint         # ESLint
npm test             # Jest 单元测试
```

- [ ] `type-check` 通过（零错误）
- [ ] `build` 通过（应看到 12 个 API 路由）
- [ ] `lint` 无阻断错误
- [ ] `test` 通过

---

## 三、Web App 验收

### 3.1 启动服务
```bash
npm run dev
# 期望：http://localhost:3000 启动
```

### 3.2 主页面功能

打开浏览器访问 `http://localhost:3000`：

- [ ] K 线图正常渲染
- [ ] 可切换时间周期（1m / 5m / 15m / 1h / 4h / 1d）
- [ ] 可切换交易对（ETH/USDT、BTC/USDT、SOL/USDT）
- [ ] 技术指标面板显示 RSI、MACD、布林带、ATR
- [ ] Twitter 情绪面板加载（有 RapidAPI Key 时）

### 3.3 AI 分析功能

- [ ] 点击 LONG 或 SHORT → 弹出分析弹窗
- [ ] 看到流式文本逐字输出
- [ ] 分析完成后出现结论 Badge（🟢 / 🟡 / 🔴）

### 3.4 Decision Log 页面

打开 `http://localhost:3000/decision-log`：

- [ ] 页面正常渲染
- [ ] 有数据时可筛选（交易对、动作）
- [ ] 导出 JSON 按钮可点击
- [ ] 导出 CSV 按钮可点击
- [ ] 显示复盘指标（拦截率、风险化解率）

---

## 四、新增 API 验收

> 确保 `npm run dev` 正在运行

### 4.1 GET /api/market

```bash
curl -s "http://localhost:3000/api/market?symbol=BTCUSDT" | head -c 500
```

- [ ] 返回 JSON，包含 `ticker`、`indicators`、`sentiment` 字段
- [ ] `ticker.price` 有值

### 4.2 POST /api/decision

```bash
curl -s -X POST http://localhost:3000/api/decision \
  -H "Content-Type: application/json" \
  -d '{"symbol":"BTCUSDT","direction":"LONG","marketData":{"price":"50000","change24h":"2.5"}}' | python3 -m json.tool
```

- [ ] 返回 `decision` 对象（含 `action`、`impulseScore`、`reasons`）

### 4.3 GET /api/decision-log

```bash
curl -s "http://localhost:3000/api/decision-log?limit=5" | python3 -m json.tool
```

- [ ] 返回 `items` 数组

### 4.4 POST /api/trade/history

```bash
curl -s -X POST http://localhost:3000/api/trade/history \
  -H "Content-Type: application/json" \
  -d '{"csv":"symbol,side,price,quantity,time\nBTCUSDT,BUY,50000,0.1,2026-01-01\nETHUSDT,SELL,3000,1,2026-01-02\nBTCUSDT,BUY,51000,0.2,2026-01-03"}' | python3 -m json.tool
```

- [ ] 返回 `stats`（含 `totalTrades`、`buyCount`、`sellCount`）
- [ ] 返回 `topSymbols`、`style`、`concentration`

### 4.5 POST /api/data/refine

```bash
curl -s -X POST http://localhost:3000/api/data/refine \
  -H "Content-Type: application/json" \
  -d '{"symbol":"BTCUSDT"}' | head -c 500
```

- [ ] 返回 JSON，包含 `ticker`、`indicators`、`klineSummary`、`sentiment`、`noFomo`

### 4.6 GET /api/health

```bash
curl -s "http://localhost:3000/api/health" | python3 -m json.tool
```

- [ ] 返回 `status`（healthy 或 degraded）
- [ ] `checks.aiKey.ok` 为 true

### 4.7 GET /api/config-status

```bash
curl -s "http://localhost:3000/api/config-status" | python3 -m json.tool
```

- [ ] `aiApiKeyConfigured` 为 true
- [ ] `aiBaseUrlConfigured` 为 true

---

## 五、Chrome Extension 验收

### 5.1 加载扩展

1. 打开 `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」→ 选择 `extension/` 目录

- [ ] 扩展加载成功，无报错
- [ ] 工具栏出现 Oracle-X 图标

### 5.2 设置页（新增功能）

1. 右键 Oracle-X 图标 → 点击「选项」

- [ ] 设置页打开，暗色主题
- [ ] 可修改 API 基础地址
- [ ] 可选择风险档位（保守 / 平衡 / 积极）
- [ ] 可调整冷静期（5-120 秒）
- [ ] NoFOMO 开关可切换
- [ ] 平台开关可勾选/取消
- [ ] 点击「保存设置」→ 出现绿色提示
- [ ] 刷新页面后设置仍保留

### 5.3 Side Panel

1. 点击 Oracle-X 图标

- [ ] Side Panel 打开

---

## 六、Desktop App 验收

### 6.1 启动

```bash
cd /Users/hmwz/AI项目/Oracle-X/desktop
npm run dev
```

- [ ] Electron 窗口出现
- [ ] macOS 菜单栏出现系统托盘图标
- [ ] 控制台显示 `[Oracle-X] Started`

### 6.2 功能检查

- [ ] 设置 Tab：可修改 API URL、风险档位
- [ ] 监控 Tab：显示监控状态
- [ ] CSV Tab：可导入 CSV 文件（使用 `test_data/binance_test.csv` 测试）
- [ ] 钱包 Tab：可添加钱包地址

---

## 七、文档验收

- [ ] `README.md` — 包含 Web App、Desktop、Extension 三端说明
- [ ] `docs/EXTENSION_USAGE.md` — Extension 安装、配置、使用流程完整
- [ ] `docs/02_开发计划/EXECUTION_PLAN.md` — 任务状态已更新
- [ ] `.gitignore` — 包含 `*.backup` 规则

---

## 八、验收签字

| 检查大类 | 检查项数 | 通过数 | 备注 |
|----------|---------|--------|------|
| 环境检查 | 4 | | |
| 代码质量 | 4 | | |
| Web App | 9 | | |
| 新增 API | 7 | | |
| Extension | 10 | | |
| Desktop | 5 | | |
| 文档 | 4 | | |
| **合计** | **43** | | |

验收人签字：________________  日期：________________
