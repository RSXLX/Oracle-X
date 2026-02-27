# Oracle-X Chrome Extension 使用文档

## 安装

1. 打开 Chrome 浏览器，访问 `chrome://extensions/`
2. 开启右上角「**开发者模式**」
3. 点击「**加载已解压的扩展程序**」
4. 选择项目中的 `extension/` 文件夹

## 配置

### 方式一：设置页面（推荐）

1. 右键 Oracle-X 扩展图标 → 点击「**选项**」
2. 填写 **API 基础地址**（默认 `http://localhost:3000`）
3. 选择 **风险档位**：
   - 保守型：低容忍度，严格拦截
   - 平衡型：适中拦截（默认）
   - 积极型：仅极端情况拦截
4. 设置 **冷静期**（5-120 秒）
5. 开关 **NoFOMO 强制阻断**
6. 选择要监控的 **交易平台**
7. 点击「💾 保存设置」

### 方式二：Service Worker Console

```js
// 在扩展 Service Worker Console 中执行
chrome.storage.local.set({
  oraclexApiBaseUrl: 'http://localhost:3000'
});
```

## 支持的交易平台

| 平台 | URL | 状态 |
|------|-----|------|
| Binance | `*.binance.com` | ✅ |
| OKX | `*.okx.com` | ✅ |
| Bybit | `*.bybit.com` | ✅ |
| Coinbase | `*.coinbase.com` | ✅ |
| Kraken | `*.kraken.com` | ✅ |
| Huobi | `*.huobi.com` | ✅ |
| Gate.io | `*.gate.io` | ✅ |
| Uniswap | `app.uniswap.org` | ✅ |

## 使用流程

1. 打开任意支持的交易平台页面
2. Extension 自动注入 content script，监听买/卖按钮
3. 当用户点击交易按钮时：
   - 拦截默认操作
   - 弹出冷静层弹窗
   - 调用 AI 视觉分析截图
   - 显示 NoFOMO 评估结果（ALLOW / WARN / BLOCK）
4. 也可手动点击扩展图标打开 Side Panel
5. 在 Side Panel 中选择 LONG/SHORT 触发完整 AI 分析

## 快捷键

| 快捷键 | 说明 |
|--------|------|
| `Ctrl+Shift+O` (Win/Linux) | 打开 Side Panel |
| `⌘+Shift+O` (macOS) | 打开 Side Panel |

## 故障排查

- **截图识别失败**：点击 Side Panel 中的 Retry 重试
- **API 连接失败**：检查 Next.js 后端是否运行在配置的地址上
- **按钮拦截不生效**：确认目标平台已在设置中启用
