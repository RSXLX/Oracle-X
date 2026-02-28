# 🔮 Oracle-X

> **AI 驱动的加密货币交易冷静层 + 全链路投资分析工具**
> 在你执行交易前，让 AI 为你把关。

![Version](https://img.shields.io/badge/version-1.5.0-blue)
![Status](https://img.shields.io/badge/status-ready-green)

---

## 📖 项目简介

Oracle-X 包含三个终端，共同构成完整的交易决策辅助体系：

| 终端 | 技术 | 作用 |
|------|------|------|
| **Web App** | Next.js 14 + React 18 | 实时行情、K 线图、技术指标、AI 分析弹窗 |
| **Desktop App** | Electron + Node.js | 全局监控、钱包分析、CSV 导入、设置管理 |
| **Chrome Extension** | Manifest V3 | 交易平台按钮拦截、截图识别、冷静层弹窗 |

---

## 🎯 核心功能

### Web App
- 接入 Binance API 获取实时行情和 K 线数据
- 技术指标面板（RSI、MACD、布林带、ATR）
- Twitter 社交情绪分析
- AI 流式分析 + 三级风险建议（🟢建议执行 / 🟡建议观望 / 🔴高风险）
- Decision Log 看板（筛选、导出 JSON/CSV、复盘指标）

### Desktop App
- 全局截图监控 + 交易按钮检测
- MiniMax Vision AI 截图识别
- 钱包分析（ETH/BSC/SOL）
- CSV 交易记录导入（支持 7+ 交易所）
- 风险评估引擎 + 系统托盘常驻

### Chrome Extension
- 自动拦截 8 大交易平台买卖按钮
- **🆕 Smart Intercept 两阶段智能分析**
  - Stage 1：本地快速评分（波动率 + 频率 + RSI + 杠杆，< 500ms）
  - Stage 2：AI 深度分析（SSE 流式，仅中/高风险触发）
- 渐进式干预：低风险气泡通知 → 中风险 Side Panel → 高风险强制冷静
- 截图 → 视觉 AI 分析 → NoFOMO 冲动评估
- 设置页面配置 API 地址、风险参数、智能拦截灵敏度

---

## 🚀 快速开始

### Web App

```bash
# 安装依赖
cd Oracle-X && npm install

# 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，填入 STEP_API_KEY、AI_BASE_URL 等

# 启动开发服务器
npm run dev
# 访问 http://localhost:3000
```

### Desktop App

```bash
cd desktop && npm install
npm run dev
```

### Chrome Extension

> 详见 [Extension 使用文档](docs/EXTENSION_USAGE.md)

1. 打开 `chrome://extensions/`，开启开发者模式
2. 加载已解压的扩展程序 → 选择 `extension/` 目录
3. 右键扩展图标 → 选项 → 配置 API 地址和风险参数

---

## 📡 API 接口

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/analyze` | POST | 核心 AI 分析（SSE 流式返回） |
| `/api/market` | GET | 聚合市场数据（ticker + 指标 + 情绪） |
| `/api/decision` | POST | NoFOMO 决策评估 |
| `/api/decision-log` | GET | 决策日志查询 |
| `/api/trade/history` | POST | 交易历史 CSV 分析 |
| `/api/data/refine` | POST | 多源数据聚合 |
| `/api/recognize` | POST | 截图视觉识别 |
| `/api/klines` | GET | Binance K 线代理 |
| `/api/ticker` | GET | Binance Ticker 代理 |
| `/api/twitter` | GET | Twitter 情绪分析 |
| `/api/health` | GET | 健康检查 |
| `/api/config-status` | GET | 配置状态检查 |

---

## 🏗️ 技术栈

| 层级 | 技术 |
|------|------|
| Web 前端 | Next.js 14 + React 18 + TypeScript |
| 图表 | lightweight-charts (TradingView) |
| 技术分析 | technicalindicators (RSI/MACD/BB/ATR) |
| AI 引擎 | MiniMax / Step AI（兼容 OpenAI 格式） |
| 桌面端 | Electron + Node.js |
| 数据源 | Binance API + RapidAPI (Twitter) |
| 测试 | Jest + 自定义 TestRunner |

---

## 📁 目录结构

```
Oracle-X/
├── app/                # Next.js Web App
│   ├── api/            # 12 个 API 路由
│   ├── components/     # React 组件
│   ├── hooks/          # 自定义 Hooks
│   └── decision-log/   # 决策日志页面
├── lib/                # 核心业务逻辑
├── desktop/            # Electron 桌面端
├── extension/          # Chrome Extension
│   ├── content/        # Content Script（平台拦截）
│   ├── sidepanel/      # Side Panel
│   └── settings/       # 设置页面
├── tests/              # 测试套件
├── test_data/          # 测试 CSV 数据
├── docs/               # 项目文档
└── types/              # TypeScript 类型定义
```

---

## 🔧 环境变量

```bash
STEP_API_KEY=your_api_key     # AI API Key（必填）
AI_BASE_URL=https://...       # AI 网关地址
AI_MODEL=model_name           # 模型名称
HTTP_PROXY=                   # HTTP 代理（可选，留空则直连）
RAPIDAPI_KEY=                 # Twitter API（可选）
```

---

## 📋 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.5.0 | 2026-02-27 | **Smart Intercept** 两阶段智能拦截分析 |
| v1.4.0 | 2026-02-27 | 补全 3 API + Extension 设置页 + 代理环境变量化 |
| v1.3.0 | 2026-02-27 | 风险引擎 + 测试体系 |
| v1.2.0 | 2026-02-26 | 钱包分析 + CSV 导入 |
| v1.1.0 | 2026-02-26 | Desktop 完整功能 |
| v1.0.0 | 2026-02-25 | 初始版本 |

## 许可证

MIT
