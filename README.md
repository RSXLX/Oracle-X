# Oracle-X

> **AI 驱动的加密货币交易冷静层 + 全链路投资分析工具**
> 在你执行交易前，让 AI 为你把关。

![Version](https://img.shields.io/badge/version-2.1.0-blue)
![Status](https://img.shields.io/badge/status-ready-green)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 📖 项目简介

Oracle-X 包含三个终端，共同构成完整的交易决策辅助体系：

| 终端 | 技术 | 作用 |
|------|------|------|
| **Web App** | Next.js 14 + React 18 | 实时行情、K 线图、技术指标、AI 分析弹窗 |
| **Desktop App** | Electron + SQLite | 全局监控、AI 截图分析、钱包分析、拦截引擎、i18n 双语 |
| **Chrome Extension** | Manifest V3 | 交易平台按钮拦截、Smart Intercept 智能分析、冷静层弹窗 |

---

## 🎯 核心功能

### Web App
- 接入 Binance API 获取实时行情和 K 线数据
- 技术指标面板（RSI、MACD、布林带、ATR）
- Twitter 社交情绪分析
- AI 流式分析 + 三级风险建议（🟢建议执行 / 🟡建议观望 / 🔴高风险）
- Decision Log 看板（筛选、导出 JSON/CSV、复盘指标）

### Desktop App
- **零配置启动** — SQLite 本地存储，无需安装数据库
- **侧边栏分析面板** — 截图 → AI 分析 → 右侧滑出展示（平台识别 / 风险等级 / 建议操作）
- **拦截引擎** — 结合用户交易习惯 + 实时市场分析的智能风险评估
- **堆叠通知系统** — 多条通知同时显示，渐变配色 + 自动消失
- **i18n 双语支持** — 中文 / English 界面切换
- 全局截图监控 + 交易按钮检测（MiniMax Vision AI）
- 钱包分析（ETH/BSC/SOL/Polygon/Arbitrum）
- CSV/XLSX 交易记录导入（支持 8+ 交易所格式）
- 全局快捷键（`⌘+Shift+O` 截图 / `⌘+Shift+S` 分析）
- 系统托盘常驻 + 开机自启 + 隐私权限分级引导

### Chrome Extension
- 自动拦截 8 大交易平台买卖按钮
- **🆕 Smart Intercept 两阶段智能分析**
  - Stage 1：本地快速评分（波动率 + 频率 + RSI + 杠杆，< 500ms）
  - Stage 2：AI 深度分析（SSE 流式，仅中/高风险触发）
- 渐进式干预：低风险气泡通知 → 中风险极速弹窗 → 高风险强制冷静
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

> 首次启动会自动创建 SQLite 数据库于 `~/Library/Application Support/Oracle-X/oraclex.db`，无需额外配置。

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

> 详细请求/响应格式参见 [API 文档](docs/API.md)

---

## 🏗️ 技术栈

| 层级 | 技术 |
|------|------|
| Web 前端 | Next.js 14 + React 18 + TypeScript |
| 图表 | lightweight-charts (TradingView) |
| 技术分析 | technicalindicators (RSI/MACD/BB/ATR) |
| AI 引擎 | MiniMax / Step AI（兼容 OpenAI 格式） |
| 桌面端 | Electron + better-sqlite3 + uiohook-napi |
| 浏览器扩展 | Chrome Manifest V3 |
| 国际化 | 自研 i18n（中文/English） |
| 数据源 | Binance API + RapidAPI (Twitter) + CoinGecko |
| 打包 | electron-builder (Mac/Win/Linux) |
| 测试 | Jest + 自定义 TestRunner |

---

## 📁 目录结构

```
Oracle-X/
├── app/                    # Next.js Web App
│   ├── api/                # 12 个 API 路由
│   ├── components/         # React 组件
│   ├── hooks/              # 自定义 Hooks
│   └── decision-log/       # 决策日志页面
├── lib/                    # 核心业务逻辑（AI Client、指标计算、验证器等）
├── desktop/                # Electron 桌面端
│   ├── src/
│   │   ├── main.js         # Electron 主进程
│   │   ├── preload.js      # 上下文桥接
│   │   ├── analyzer/       # AI 分析（截图、钱包、风险引擎、交易分析器）
│   │   ├── core/           # 核心（拦截引擎）
│   │   ├── data/           # 数据层（SQLite、CSV 导入、市场数据、设置存储）
│   │   ├── monitor/        # 监控（全局监听、截图捕获）
│   │   ├── ocr/            # OCR（Vision AI 识别）
│   │   └── system/         # 系统（托盘、通知、自启动、快捷键、权限管理）
│   └── renderer/           # 渲染进程
│       ├── index.html      # 主页面
│       ├── renderer.js     # 渲染脚本
│       ├── styles.css      # 样式
│       ├── i18n.js          # 国际化引擎
│       └── locales/        # 语言包（zh-CN / en）
├── extension/              # Chrome Extension
│   ├── content/            # Content Script（平台拦截 + 快速评分）
│   ├── intercept/          # 极速拦截弹窗
│   ├── sidepanel/          # Side Panel 分析面板
│   └── settings/           # 设置页面
├── tests/                  # 测试套件
├── test_data/              # 测试 CSV 数据
├── docs/                   # 项目文档
└── types/                  # TypeScript 类型定义
```

---

## 🔧 环境变量

```bash
# === 必填 ===
STEP_API_KEY=your_api_key        # AI API Key
AI_BASE_URL=https://...          # AI 网关地址
AI_MODEL=model_name              # 文本模型

# === 可选 ===
AI_VISION_MODEL=vision_model     # 视觉模型（截图分析）
AI_TEMPERATURE=0.3               # 温度参数
AI_MAX_TOKENS=1000               # 最大令牌数
HTTP_PROXY=                      # HTTP 代理（留空则直连）
RAPIDAPI_KEY=                    # Twitter API
```

---

## 📋 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| v2.1.0 | 2026-02-28 | 侧边栏分析面板 + 堆叠通知 + i18n 双语 + 拦截引擎 |
| v2.0.0 | 2026-02-28 | MySQL → SQLite 零配置 + 隐私权限分级引导 |
| v1.5.1 | 2026-02-28 | Extension 验收修复：极速弹窗 + 阈值调优 |
| v1.5.0 | 2026-02-27 | **Smart Intercept** 两阶段智能拦截分析 |
| v1.4.0 | 2026-02-27 | 补全 3 API + Extension 设置页 + 代理环境变量化 |
| v1.3.0 | 2026-02-27 | 风险引擎 + 测试体系 |
| v1.2.0 | 2026-02-26 | 钱包分析 + CSV 导入 |
| v1.1.0 | 2026-02-26 | Desktop 完整功能 |
| v1.0.0 | 2026-02-25 | 初始版本 |

> 详细变更记录见 [CHANGELOG.md](CHANGELOG.md)

## 📄 文档索引

| 文档 | 说明 |
|------|------|
| [架构设计](docs/ARCHITECTURE.md) | 系统架构、模块清单、数据流图 |
| [开发指南](docs/DEVELOPMENT.md) | 本地开发环境搭建与调试 |
| [API 文档](docs/API.md) | 12 个 API 端点的请求/响应格式 |
| [部署指南](docs/DEPLOYMENT.md) | Vercel / Docker / VPS 部署方案 |
| [Extension 使用](docs/EXTENSION_USAGE.md) | Chrome 扩展安装与配置 |
| [贡献指南](CONTRIBUTING.md) | 代码提交规范与 PR 流程 |
| [项目状态](docs/PROJECT_STATUS.md) | 当前进度与待办事项 |

## 许可证

MIT
