# 变更日志

本文档记录 Oracle-X 项目的所有重要变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [2.2.0] - 2026-02-28

### 新增

- Desktop 设置面板用户可自配置 AI（API Key / Base URL / Model / Temperature / Proxy）
- Desktop "测试 AI 连接"按钮，验证 API 可用性
- GitHub Actions 自动构建 macOS dmg（Intel + Apple Silicon）并发布 Release
- Website 新增"下载 macOS 版"按钮，指向 GitHub Releases

### 优化

- `.env.local` 移出打包，用户配置改为 SQLite 持久化
- 代理配置支持热更新

## [2.1.0] - 2026-02-28

### 新增

- Desktop 侧边栏分析面板（截图→AI分析→右侧滑出展示）
- Desktop 堆叠通知系统（多条同时显示，渐变配色 + 自动消失）
- Desktop 分析记录可回看列表
- Desktop i18n 国际化支持（中文 / English）
- Desktop 拦截引擎 `interception-engine.js`（交易习惯 + 市场联合分析）
- Desktop 统计面板实时更新（截图分析次数 / 风险检测 / 化解率）

### 优化

- 截图分析 UX 重做：从系统通知改为侧边栏面板交互
- `preload.js` 新增 `onScreenshotResult/Captured/Error` 事件
- `main.js` 截图 IPC 改为完整截图+分析+展示流程

## [2.0.0] - 2026-02-28

### 新增

- SQLite 零配置存储（`better-sqlite3` 替代 MySQL）
- 数据自动存储于 `~/Library/Application Support/Oracle-X/oraclex.db`
- 隐私权限分级引导（默认关闭自动监控，按需授权）
- `permission-manager.js` 权限管理模块
- `database.js` SQLite 数据库模块

### 移除

- 移除 MySQL 依赖

## [1.5.1] - 2026-02-28

### 修复

- Extension 极速拦截弹窗 `intercept/intercept.html` + `intercept.js`
- `sidePanel.open()` → `windows.create()` 绕过用户手势限制
- 评分阈值调优（balanced: low 30→20, high 60→45）
- 杠杆评分加强（50x: 20→35, 20x: 18→25）
- CSP 合规：内联脚本拆分为独立 JS 文件

## [1.5.0] - 2026-02-27

### 新增

- **Smart Intercept 两阶段智能拦截分析**
  - Stage 1：本地快速评分（波动率 + 频率 + RSI + 杠杆，< 500ms）
  - Stage 2：AI 深度分析（SSE 流式，仅中/高风险触发）
- 渐进式干预：低风险气泡通知 → 中风险弹窗 → 高风险强制冷静
- `quick-scorer.js` 本地评分模块
- `bubble-notification.js` 气泡通知组件

## [1.4.0] - 2026-02-27

### 新增

- `/api/market` 聚合市场数据 API
- `/api/trade/history` 交易历史分析 API
- `/api/data/refine` 多源数据聚合 API
- Extension 设置页面（`settings/`）
- Chrome Extension 平台配置管理

### 优化

- HTTP 代理硬编码 → `HTTP_PROXY` 环境变量化

## [1.3.0] - 2026-02-27

### 新增

- `risk-engine.js` 风险评估引擎
- Jest 测试体系 + 自定义 TestRunner
- `ai-trade-analyzer.js` AI 交易行为分析模块

## [1.2.0] - 2026-02-26

### 新增

- `wallet-analyzer.js` 钱包分析（ETH/BSC/SOL/Polygon/Arbitrum）
- `csv-importer.js` CSV 导入（支持 7+ 交易所格式）
- `market-data.js` 市场数据模块（CoinGecko）
- `data-exporter.js` 数据导出模块

## [1.1.0] - 2026-02-26

### 新增

- Electron Desktop App 完整功能
- 全局截图监控 + 交易按钮检测
- MiniMax Vision AI 截图识别
- 系统托盘常驻 + 开机自启
- 全局快捷键支持

## [1.0.0] - 2026-02-25

### 新增

- Next.js 14 Web App 初始版本
- 实时市场数据监控（Binance API）
- 专业技术指标计算（RSI、MACD、布林带、ATR）
- AI 驱动的交易分析（基于阶跃星辰 API）
- 流式响应展示分析过程
- Chrome Extension 基础版本
- 三级风险评估系统
- Twitter 情绪分析集成
- Decision Log 看板

### 技术架构

- Next.js 14.2.5 + React 18.3 + TypeScript 5.4
- lightweight-charts 图表库
- technicalindicators 技术分析库

---

## 版本说明

版本号格式：主版本号.次版本号.修订号

- **主版本号**：不兼容的 API 变更
- **次版本号**：向下兼容的功能性新增
- **修订号**：向下兼容的问题修正
