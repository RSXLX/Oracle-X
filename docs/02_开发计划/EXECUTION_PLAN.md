# Oracle-X 详细开发执行计划

## 当前进度
- ✅ Chrome Extension 自动拦截 (content_script)
- ✅ Desktop App 设置面板增强
- ✅ 多平台识别 + AI 分析
- ✅ Extension 设置页
- ✅ 3 个补全 API
- ✅ 代理环境变量化
- ✅ 文档对齐

---

## 阶段一：多平台识别引擎 ✅

### 1.1 创建平台检测模块
**文件**: `extension/content/platforms.js`
- ✅ 实现平台自动检测（Binance/OKX/Bybit/Coinbase/Kraken/Huobi/Gate/Uniswap）
- ✅ 每个平台的按钮选择器映射
- ✅ DOM 特征识别

---

## 阶段二：视觉 AI 分析 ✅

### 2.1 截图捕获
- ✅ 使用 chrome.tabs.captureVisibleTab() 捕获页面

### 2.2 调用视觉 AI
- ✅ 支持 MiniMax Vision / Step AI Vision
- ✅ 解析结构化数据

### 2.3 决策逻辑
- ✅ NoFOMO 评分引擎（ALLOW/WARN/BLOCK）
- ✅ 决策日志记录

---

## 阶段三：用户配置 ✅

### 3.1 Extension 设置页
- ✅ `extension/settings/settings.html` — 设置页 UI
- ✅ `extension/settings/settings.js` — chrome.storage 读写
- ✅ `extension/settings/settings.css` — 暗色主题样式

### 3.2 Extension ↔ Desktop 通信
- ✅ chrome.storage 同步配置
- ✅ chrome.runtime.sendMessage 事件推送

---

## 阶段四：验收测试 🔄

### 4.1 Extension 测试
- ✅ 加载 unpacked extension
- [ ] 访问 Binance 测试拦截
- [ ] 验证弹窗显示

### 4.2 Desktop 测试
- [ ] 启动 Desktop App
- [ ] 验证设置保存
- [ ] 验证日志读取

---

## 执行命令

```bash
# 启动 Next.js 后端
cd Oracle-X && npm run dev

# 启动 Desktop App
cd desktop && npm install && npm run dev

# 加载 Extension
chrome://extensions/ → 加载已解压的扩展程序
```
