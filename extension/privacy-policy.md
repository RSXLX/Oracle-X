# Oracle-X Privacy Policy

**Last Updated: March 1, 2026**

## Overview

Oracle-X is an AI-powered trading assistant that helps users make informed trading decisions. We are committed to protecting your privacy and being transparent about our data practices.

## Data Collection

### What We Collect
- **Trading platform interactions**: Button clicks on supported exchanges (Binance, OKX, Bybit, etc.) for risk analysis
- **Screenshots**: Captured only when you explicitly trigger analysis (via hotkey or button click)
- **Settings**: Your AI configuration preferences stored locally

### What We Do NOT Collect
- Personal identification information
- Login credentials or financial account details
- Browsing history outside of supported trading platforms
- Trading account balances or transaction history from exchanges

## Data Storage

- All data is stored **locally on your device** using SQLite (Desktop) or Chrome storage API (Extension)
- Screenshots are processed in-memory and **never uploaded to our servers**
- AI analysis is performed via your own configured API endpoints (e.g., OpenAI, MiniMax)

## Third-Party Services

- **AI API Providers**: When you configure an AI API key, screenshot data may be sent to your chosen AI provider for analysis. Please review their privacy policies.
- **Market Data**: We fetch public market data (prices, 24h changes) from Binance API for risk assessment.

## Permissions Explained

| Permission | Purpose |
|------------|---------|
| `activeTab` | Capture screenshots of the current tab for analysis |
| `sidePanel` | Display analysis results in the Chrome side panel |
| `storage` | Save your settings and preferences locally |
| `alarms` | Periodically refresh market data cache |

## Data Sharing

We do **NOT** share, sell, or transmit your data to any third party. All processing happens locally or through your self-configured AI API endpoints.

## Contact

For privacy-related questions, please open an issue on our [GitHub repository](https://github.com/RSXLX/Oracle-X).

---

# Oracle-X 隐私政策

**最后更新：2026年3月1日**

## 概述

Oracle-X 是一款 AI 驱动的交易助手，帮助用户做出明智的交易决策。我们致力于保护您的隐私。

## 数据收集

### 我们收集的数据
- **交易平台交互**：在支持的交易所上的按钮点击事件，用于风险分析
- **截图**：仅在您主动触发分析时捕获（通过快捷键或按钮）
- **设置**：您的 AI 配置偏好，存储在本地

### 我们不收集的数据
- 个人身份信息
- 登录凭据或金融账户信息
- 交易平台以外的浏览记录
- 交易账户余额或交易历史

## 数据存储

- 所有数据**存储在您的本地设备**上（Desktop 使用 SQLite，Extension 使用 Chrome Storage API）
- 截图在内存中处理，**绝不上传至我们的服务器**
- AI 分析通过您自行配置的 API 端点进行

## 权限说明

| 权限 | 用途 |
|------|------|
| `activeTab` | 捕获当前标签页截图用于分析 |
| `sidePanel` | 在 Chrome 侧边栏展示分析结果 |
| `storage` | 本地保存设置 |
| `alarms` | 定期刷新市场数据缓存 |

## 联系方式

如有隐私相关问题，请在 [GitHub](https://github.com/RSXLX/Oracle-X) 提交 Issue。
