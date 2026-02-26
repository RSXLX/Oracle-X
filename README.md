# Oracle-X NoFOMO

**AI 驱动的交易冷静层** - 监听任意应用，防止 FOMO 交易

## 功能特性

- 🌐 **全局应用监听** - 监控任意 App，不限于浏览器
- 📸 **截图 AI 分析** - 自动识别交易按钮
- ⚡ **实时阻断** - 检测到交易操作时弹窗警告
- 🔔 **系统托盘** - 常驻后台，最小化运行
- 🤖 **多 AI 提供商** - 支持 StepFun、OpenAI、Gemini
- 📊 **决策日志** - 记录所有交易决策

## 快速开始

### 1. 安装依赖

```bash
cd desktop
npm install
```

### 2. 配置 API

在应用界面配置 AI API Key（推荐 StepFun）

### 3. 启动

```bash
npm run dev
```

### 4. 设置自启动（可选）

macOS: 系统设置 → 用户与群组 → 登录项

## 监控模式

| 模式 | 说明 |
|------|------|
| 应用监听 | 监控目标应用是否在前台运行 |
| 截图分析 | 定时截图 + AI 识别交易按钮 |
| 全局快捷键 | 自定义快捷键触发冷静层 |

## 支持平台

- Binance
- OKX
- Bybit
- Coinbase
- TradingView
- MetaTrader
- 自定义应用

## 技术栈

- Electron
- React (Renderer)
- StepFun/OpenAI/Gemini Vision API

## 版本

v1.0.0 - Desktop 优先架构
